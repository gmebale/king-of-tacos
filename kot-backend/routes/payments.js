const express = require('express');
const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
const stripeSdk = require('stripe');

const router = express.Router();
const prisma = new PrismaClient();

const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
const stripe = process.env.STRIPE_SECRET_KEY ? stripeSdk(process.env.STRIPE_SECRET_KEY) : null;

function isAllowedOrderType(orderType) {
  return ['livraison', 'emporter', 'pickup'].includes(orderType);
}

function calculateOrderTotal(order) {
  if (!order?.items?.length) return 0;
  return order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

async function getOrderWithItems(orderId) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });
}

async function markOrderPayment({ orderId, status, providerId, receiptUrl }) {
  if (!orderId) return;
  await prisma.order.update({
    where: { id: orderId },
    data: {
      payment_status: status,
      payment_provider_id: providerId,
      payment_receipt_url: receiptUrl,
      status: status === 'paid' ? 'en_preparation' : undefined
    }
  });
}

async function getPaypalAccessToken() {
  const basicAuth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PayPal token error: ${response.status} ${body}`);
  }
  const data = await response.json();
  return data.access_token;
}

router.post('/paypal/create', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: 'orderId requis' });
    }

    const order = await getOrderWithItems(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }

    if (!isAllowedOrderType(order.order_type)) {
      return res.status(400).json({ message: 'Le paiement en ligne est réservé aux commandes livraison ou pickup' });
    }

    const amount = calculateOrderTotal(order);
    if (amount <= 0) {
      return res.status(400).json({ message: 'Montant invalide pour cette commande' });
    }

    const accessToken = await getPaypalAccessToken();

    const paypalOrderRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'EUR',
              value: (amount / 100).toFixed(2)
            },
            reference_id: order.id
          }
        ],
        application_context: {
          return_url: `${process.env.FRONTEND_URL || ''}/payment/success?orderId=${orderId}`,
          cancel_url: `${process.env.FRONTEND_URL || ''}/payment/cancel?orderId=${orderId}`
        }
      })
    });

    const paypalOrder = await paypalOrderRes.json();
    if (!paypalOrderRes.ok) {
      console.error('PayPal create error', paypalOrder);
      return res.status(500).json({ message: 'Erreur de création PayPal' });
    }

    const approveUrl = paypalOrder.links?.find((l) => l.rel === 'approve')?.href;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        payment_method: 'paypal',
        payment_status: 'pending',
        payment_provider_id: paypalOrder.id
      }
    });

    res.json({
      paypalOrderId: paypalOrder.id,
      approveUrl,
      amount
    });
  } catch (error) {
    console.error('PayPal create error', error);
    res.status(500).json({ message: 'Erreur interne PayPal' });
  }
});

router.post('/paypal/webhook', async (req, res) => {
  try {
    const event = req.body;
    const eventType = event?.event_type;
    const resource = event?.resource || {};
    const orderId =
      resource?.purchase_units?.[0]?.reference_id ||
      resource?.supplementary_data?.related_ids?.order_id ||
      resource?.id;

    if (!orderId) {
      console.warn('PayPal webhook sans orderId', eventType);
      return res.status(400).json({ message: 'orderId manquant' });
    }

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      await markOrderPayment({
        orderId,
        status: 'paid',
        providerId: resource?.supplementary_data?.related_ids?.order_id || resource?.id,
        receiptUrl: resource?.links?.find((l) => l.rel === 'self')?.href
      });
    } else if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      await markOrderPayment({
        orderId,
        status: 'requires_action',
        providerId: resource?.id
      });
    }

    res.json({ received: true });
  } catch (error) {
    console.error('PayPal webhook error', error);
    res.status(500).json({ message: 'Erreur webhook PayPal' });
  }
});

router.post('/stripe/create-intent', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ message: 'Stripe non configuré' });
    }

    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: 'orderId requis' });
    }

    const order = await getOrderWithItems(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }

    if (!isAllowedOrderType(order.order_type)) {
      return res.status(400).json({ message: 'Le paiement en ligne est réservé aux commandes livraison ou pickup' });
    }

    const amount = calculateOrderTotal(order);
    if (amount <= 0) {
      return res.status(400).json({ message: 'Montant invalide pour cette commande' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      metadata: { orderId },
      automatic_payment_methods: { enabled: true }
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        payment_method: 'stripe',
        payment_status: 'pending',
        payment_provider_id: paymentIntent.id
      }
    });

    res.json({ clientSecret: paymentIntent.client_secret, amount });
  } catch (error) {
    console.error('Stripe intent error', error);
    res.status(500).json({ message: 'Erreur de création Stripe' });
  }
});

router.post('/stripe/webhook', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ message: 'Stripe non configuré' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature error', err);
    return res.status(400).json({ message: `Signature invalide: ${err.message}` });
  }

  const intent = event.data?.object;
  const orderId = intent?.metadata?.orderId;
  const charge = intent?.charges?.data?.[0];

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await markOrderPayment({
          orderId,
          status: 'paid',
          providerId: intent.id,
          receiptUrl: charge?.receipt_url
        });
        break;
      case 'payment_intent.payment_failed':
        await markOrderPayment({
          orderId,
          status: 'failed',
          providerId: intent.id
        });
        break;
      case 'charge.refunded':
        await markOrderPayment({
          orderId,
          status: 'refunded',
          providerId: charge?.payment_intent,
          receiptUrl: charge?.receipt_url
        });
        break;
      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook handling error', error);
    res.status(500).json({ message: 'Erreur webhook Stripe' });
  }
});

module.exports = router;

