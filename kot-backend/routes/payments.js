const express = require('express');
const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
const stripeSdk = require('stripe');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { authenticateToken, requirePagePermission } = require('../middleware/auth');
const ebilling = require('../services/ebilling');

const router = express.Router();
const prisma = new PrismaClient();

const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
const stripe = process.env.STRIPE_SECRET_KEY ? stripeSdk(process.env.STRIPE_SECRET_KEY) : null;
// Online payment providers remain unavailable until currency/amount validation and
// provider webhook verification are configured for production.
const onlinePaymentsEnabled = process.env.ONLINE_PAYMENTS_ENABLED === 'true';

function rejectDisabledOnlinePayment(res) {
  return res.status(503).json({ message: 'Le paiement en ligne n’est pas encore activé.' });
}

function parseEbillingDetails(order) {
  try {
    const details = JSON.parse(order?.payment_provider_id || 'null');
    if (details?.provider === 'ebilling') return details;
    if (details?.p === 'ebilling') {
      return {
        provider: 'ebilling',
        billId: details.b,
        reference: details.r,
        paymentSystemName: details.s,
        payerMsisdn: details.m,
        ussdPushId: details.u,
        pushState: details.t
      };
    }
    return null;
  } catch (_error) {
    return null;
  }
}

function serializeEbillingDetails(details) {
  return JSON.stringify({
    p: 'ebilling',
    b: details.billId,
    r: details.reference,
    s: details.paymentSystemName,
    m: details.payerMsisdn,
    u: details.ussdPushId || null,
    t: details.pushState || null
  });
}

function getInvoicePayload(payload) {
  return payload?.e_bill || payload?.invoice || payload || {};
}

function normalizeGabonMsisdn(value, paymentSystemName) {
  const digits = String(value || '').replace(/\D/g, '');
  if (paymentSystemName === 'SIMU') return digits.length === 9 ? digits : null;
  if (digits.startsWith('241') && digits.length === 11) return digits;
  if (digits.startsWith('0') && digits.length === 9) return `241${digits.slice(1)}`;
  if (digits.length === 8) return `241${digits}`;
  return null;
}

function verifyPaymentStatusToken(token, orderId) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { audience: 'ebilling-payment' });
    return payload.orderId === orderId;
  } catch (_error) {
    return false;
  }
}

function verifyEbillingWebhook(req) {
  const signature = req.get('X-Signature');
  const receivedKeyId = req.get('X-Key-Id');
  const timestamp = req.get('X-Signature-Timestamp');
  if (!signature && !receivedKeyId && !timestamp) return 'unsigned';

  const key = process.env.EBILLING_WEBHOOK_SIGNING_KEY;
  const keyId = process.env.EBILLING_WEBHOOK_KEY_ID;
  if (!key || !keyId) return 'unverifiable';
  if (!req.rawBody || !signature || receivedKeyId !== keyId || !/^\d+$/.test(timestamp || '')) return 'invalid';
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return 'invalid';

  const path = req.originalUrl.split('?')[0];
  const bodyHash = crypto.createHash('sha256').update(req.rawBody).digest('hex');
  const signedPayload = `${timestamp}.${req.method}.${path}.${bodyHash}`;
  const expected = crypto.createHmac('sha256', key).update(signedPayload).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer) ? 'valid' : 'invalid';
}

async function applyEbillingInvoiceState(order, invoice, providerDetails) {
  const reference = invoice.external_reference || invoice.reference;
  if (!reference || reference !== providerDetails.reference) {
    throw new Error('La référence de facture E-Billing ne correspond pas à la commande.');
  }
  const billId = invoice.bill_id || invoice.id;
  if (!billId || String(billId) !== String(providerDetails.billId)) {
    throw new Error('La facture E-Billing ne correspond pas à la tentative enregistrée.');
  }
  if (invoice.amount === undefined || Number(invoice.amount) !== Number(order.total_amount)) {
    throw new Error('Le montant confirmé par E-Billing ne correspond pas au total de la commande.');
  }

  const providerState = String(invoice.state || '').toLowerCase();
  const nextPaymentStatus = ['paid', 'processed'].includes(providerState)
    ? 'paid'
    : ['failed', 'cancelled', 'expired'].includes(providerState)
      ? 'failed'
      : (!providerDetails.ussdPushId && order.payment_status === 'failed' ? 'failed' : 'requires_action');

  const conflict = order.status === 'annulee' || Boolean(order.closed_at);
  if (order.payment_status === nextPaymentStatus) return { paymentStatus: nextPaymentStatus, providerState, conflict: conflict && nextPaymentStatus === 'paid' };

  await prisma.$transaction(async tx => {
    const updated = await tx.order.updateMany({
      where: {
        id: order.id,
        payment_method: 'mobile_money',
        payment_provider_id: order.payment_provider_id,
        status: order.status,
        payment_status: { in: ['pending', 'requires_action', 'failed'] }
      },
      data: {
        payment_status: nextPaymentStatus,
        ...(nextPaymentStatus === 'paid' && order.status === 'en_attente' && !order.closed_at ? { status: 'en_preparation' } : {})
      }
    });

    if (updated.count && nextPaymentStatus === 'paid') {
      const session = await tx.cashRegisterSession.findFirst({ where: { closed_at: null }, orderBy: { opened_at: 'desc' } });
      if (session) {
        await tx.cashRegisterSession.updateMany({
          where: { id: session.id, closed_at: null },
          data: {
            total_revenue: session.total_revenue == null ? order.total_amount : { increment: order.total_amount },
            mobile_payments: session.mobile_payments == null ? order.total_amount : { increment: order.total_amount }
          }
        });
      }
    }
  });

  const refreshed = await prisma.order.findUnique({ where: { id: order.id }, select: { payment_status: true } });
  return { paymentStatus: refreshed?.payment_status || order.payment_status, providerState, conflict: conflict && nextPaymentStatus === 'paid' };
}

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

router.post('/ebilling/ussd-push', async (req, res) => {
  const config = ebilling.getEbillingConfig();
  if (!config.enabled) return res.status(503).json({ message: 'Le paiement E-Billing est désactivé sur ce serveur.' });
  let reservationOrderId = null;
  let reservationValue = null;
  let previousProviderId = null;

  try {
    const { orderId, paymentStatusToken, paymentSystemName } = req.body;
    if (!orderId || !verifyPaymentStatusToken(paymentStatusToken, orderId)) {
      return res.status(403).json({ message: 'Autorisation de paiement invalide ou expirée.' });
    }
    const testMode = new URL(config.apiBase).hostname === 'lab.billing-easy.net';
    if (!['airtelmoney', 'moovmoney', 'SIMU'].includes(paymentSystemName)) {
      return res.status(400).json({ message: 'Opérateur Mobile Money invalide.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { role: true } } }
    });
    if (!order) return res.status(404).json({ message: 'Commande introuvable.' });
    if (order.payment_method !== 'mobile_money') return res.status(409).json({ message: 'Cette commande ne prévoit pas un paiement Mobile Money.' });
    if (testMode && paymentSystemName !== 'SIMU') {
      return res.status(409).json({ message: 'En mode Lab, seuls les paiements SIMU sont autorisés.' });
    }
    if (paymentSystemName === 'SIMU' && (!testMode || order.user?.role !== 'admin')) {
      return res.status(403).json({ message: 'Le paiement SIMU est réservé aux commandes de test créées par un administrateur.' });
    }
    if (order.status === 'annulee' || order.closed_at || order.payment_status === 'paid' || order.payment_status === 'refunded') {
      return res.status(409).json({ message: 'Cette commande ne peut plus être payée.' });
    }

    const settings = await prisma.settings.findMany({
      where: { key: { in: ['mobile_money_enabled', 'mobile_money_airtel_enabled', 'mobile_money_moov_enabled', 'mobile_money_mobicash_enabled'] } }
    });
    const settingValues = Object.fromEntries(settings.map(setting => [setting.key, setting.value]));
    const moovEnabled = settingValues.mobile_money_moov_enabled ?? settingValues.mobile_money_mobicash_enabled ?? 'true';
    if (settingValues.mobile_money_enabled === 'false' ||
      (paymentSystemName === 'airtelmoney' && settingValues.mobile_money_airtel_enabled === 'false') ||
      (paymentSystemName === 'moovmoney' && moovEnabled === 'false')) {
      return res.status(409).json({ message: 'Cet opérateur Mobile Money est désactivé par le restaurant.' });
    }

    const payerMsisdn = normalizeGabonMsisdn(paymentSystemName === 'SIMU' ? req.body.payerMsisdn : order.customer_phone, paymentSystemName);
    if (!payerMsisdn) return res.status(400).json({ message: paymentSystemName === 'SIMU'
      ? 'Pour le simulateur, saisissez un numéro de test à 9 chiffres indiqué dans le guide E-Billing.'
      : 'Numéro gabonais invalide. Saisissez un numéro à 8 chiffres, avec ou sans le 0 initial.' });
    if (!Number.isInteger(order.total_amount) || order.total_amount <= 0) {
      return res.status(400).json({ message: 'Le montant de la commande ne peut pas être payé.' });
    }

    const existingDetails = parseEbillingDetails(order);
    if (existingDetails && ['pending', 'requires_action'].includes(order.payment_status)) {
      if (existingDetails.ussdPushId) {
        return res.json({
          orderCode: order.order_code,
          paymentStatus: order.payment_status,
          providerState: existingDetails.pushState || 'pending',
          paymentSystemName: existingDetails.paymentSystemName,
          reused: true
        });
      }
      return res.status(409).json({ message: 'Une tentative E-Billing est déjà en cours. Actualisez son statut avant de recommencer.' });
    }

    const reservation = `ebilling-starting:${Date.now()}`;
    reservationOrderId = order.id;
    reservationValue = reservation;
    previousProviderId = order.payment_provider_id;
    const claimed = await prisma.order.updateMany({
      where: {
        id: order.id,
        payment_method: 'mobile_money',
        payment_status: order.payment_status,
        payment_provider_id: order.payment_provider_id,
        status: order.status,
        closed_at: null
      },
      data: { payment_provider_id: reservation }
    });
    if (!claimed.count) return res.status(409).json({ message: 'Cette commande a changé d’état. Actualisez-la avant de payer.' });

    const reference = `${order.order_code || order.id}-${Date.now().toString(36)}`;
    const invoiceResponse = await ebilling.createInvoice({
      orderCode: order.order_code || order.id,
      externalReference: reference,
      amount: order.total_amount,
      payerMsisdn,
      payerEmail: order.customer_email || undefined
    });
    const invoice = getInvoicePayload(invoiceResponse);
    const billId = invoice.bill_id || invoice.id;
    if (!billId) throw new Error('E-Billing n’a pas renvoyé d’identifiant de facture.');

    // Use a per-attempt unique external reference even if the customer retries.
    // E-Billing receives the same value in the invoice body; patch and persist it
    // before requesting the asynchronous USSD push.
    if (invoice.external_reference && invoice.external_reference !== reference) {
      throw new Error('La référence externe de facture E-Billing est inattendue.');
    }
    const details = {
      provider: 'ebilling',
      billId: String(billId),
      reference,
      paymentSystemName,
      payerMsisdn,
      ussdPushId: null,
      pushState: null
    };
    const detailsJson = serializeEbillingDetails(details);
    const invoiceSaved = await prisma.order.updateMany({
      where: { id: order.id, payment_provider_id: reservation, payment_status: order.payment_status },
      data: { payment_provider_id: detailsJson }
    });
    if (!invoiceSaved.count) return res.status(409).json({ message: 'La commande a changé pendant la création de la facture.' });

    let pushResponse;
    try {
      pushResponse = await ebilling.createUssdPush({ billId, payerMsisdn, paymentSystemName });
    } catch (error) {
      if (error.providerStatus === 406) {
        await prisma.order.updateMany({
          where: { id: order.id, payment_provider_id: detailsJson, payment_status: order.payment_status },
          data: { payment_status: 'failed' }
        });
        return res.status(422).json({ message: 'L’opérateur a refusé la demande USSD. Vérifiez le numéro et réessayez.' });
      }
      throw error;
    }

    const push = pushResponse?.ussd_push || pushResponse;
    const finalizedDetails = { ...details, ussdPushId: push?.id ? String(push.id) : null, pushState: push?.state || 'accepted' };
    const finalizedDetailsJson = serializeEbillingDetails(finalizedDetails);
    const finalized = await prisma.order.updateMany({
      where: { id: order.id, payment_provider_id: detailsJson, payment_status: order.payment_status },
      data: { payment_provider_id: finalizedDetailsJson, payment_status: 'requires_action' }
    });
    if (!finalized.count) return res.status(409).json({ message: 'La demande a été envoyée, mais la commande a changé. Actualisez son statut.' });

    res.status(202).json({
      orderCode: order.order_code,
      paymentStatus: 'requires_action',
      providerState: finalizedDetails.pushState,
      paymentSystemName,
      message: 'Demande envoyée. Le client doit confirmer le paiement sur son téléphone.'
    });
  } catch (error) {
    console.error('E-Billing USSD initiation error:', error.message);
    if (reservationOrderId && reservationValue) {
      await prisma.order.updateMany({
        where: { id: reservationOrderId, payment_provider_id: reservationValue },
        data: { payment_provider_id: previousProviderId }
      }).catch(() => {});
    }
    res.status(502).json({
      message: 'E-Billing n’a pas pu confirmer le démarrage du paiement. Consultez le statut de la commande avant toute nouvelle tentative.'
    });
  }
});

async function reconcileEbillingOrder(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: 'Commande introuvable.' };
  const details = parseEbillingDetails(order);
  if (!details?.billId) return { error: 'Aucune facture E-Billing n’est associée à cette commande.' };
  const response = await ebilling.getInvoice(details.billId);
  const invoice = getInvoicePayload(response);
  let pushState = details.pushState;
  if (details.ussdPushId) {
    try {
      const pushResponse = await ebilling.getUssdPush(details.ussdPushId);
      pushState = (pushResponse?.ussd_push || pushResponse)?.state || pushState;
    } catch (_error) {
      // Invoice state remains authoritative if the optional push enquiry is unavailable.
    }
  }

  let result = await applyEbillingInvoiceState(order, invoice, details);
  const terminalPushFailure = ['failed', 'cancelled', 'expired'].includes(String(pushState || '').toLowerCase());
  if (terminalPushFailure && result.paymentStatus !== 'paid') {
    await prisma.order.updateMany({
      where: {
        id: order.id,
        payment_method: 'mobile_money',
        payment_provider_id: order.payment_provider_id,
        payment_status: { in: ['pending', 'requires_action'] }
      },
      data: { payment_status: 'failed' }
    });
    const refreshed = await prisma.order.findUnique({ where: { id: order.id }, select: { payment_status: true } });
    result = { ...result, paymentStatus: refreshed?.payment_status || result.paymentStatus };
  }
  return { ...result, pushState, amount: invoice.amount, orderCode: order.order_code };
}

router.get('/ebilling/status/:orderId', async (req, res) => {
  const { orderId } = req.params;
  if (!verifyPaymentStatusToken(req.get('X-Payment-Token'), orderId)) {
    return res.status(403).json({ message: 'Autorisation de suivi invalide ou expirée.' });
  }
  try {
    const status = await reconcileEbillingOrder(orderId);
    if (status.error) return res.status(404).json({ message: status.error });
    res.json(status);
  } catch (error) {
    console.error('E-Billing status check error:', error.message);
    res.status(502).json({ message: 'Statut E-Billing temporairement indisponible.' });
  }
});

router.post('/ebilling/orders/:id/reconcile', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const status = await reconcileEbillingOrder(req.params.id);
    if (status.error) return res.status(404).json({ message: status.error });
    res.json(status);
  } catch (error) {
    console.error('E-Billing admin reconciliation error:', error.message);
    res.status(502).json({ message: 'Statut E-Billing temporairement indisponible.' });
  }
});

router.post('/ebilling/webhook', async (req, res) => {
  if (verifyEbillingWebhook(req) === 'invalid') return res.status(401).json({ message: 'Signature E-Billing invalide.' });
  try {
    const reference = req.body?.reference;
    const billId = req.body?.billingid;
    if (!reference || !billId) return res.status(400).json({ message: 'Référence ou identifiant de facture manquant.' });

    const order = await prisma.order.findFirst({ where: { payment_method: 'mobile_money', payment_provider_id: { contains: String(reference) } } });
    if (!order) return res.status(404).json({ message: 'Commande introuvable.' });
    const details = parseEbillingDetails(order);
    if (!details || String(details.billId) !== String(billId)) return res.status(409).json({ message: 'La facture ne correspond pas à la tentative de paiement.' });

    // The callback is a notification only. Query E-Billing over OAuth2 and only
    // reconcile from its authenticated invoice response.
    const invoiceResponse = await ebilling.getInvoice(details.billId);
    const invoice = getInvoicePayload(invoiceResponse);
    const result = await applyEbillingInvoiceState(order, invoice, details);
    if (result.conflict) return res.status(409).json({ message: 'La commande est annulée ou clôturée; intervention requise.' });
    res.json({ received: true });
  } catch (error) {
    console.error('E-Billing webhook processing error:', error.message);
    res.status(500).json({ message: 'Notification E-Billing non traitée.' });
  }
});

router.post('/paypal/create', async (req, res) => {
  if (!onlinePaymentsEnabled) return rejectDisabledOnlinePayment(res);
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
  if (!onlinePaymentsEnabled) return rejectDisabledOnlinePayment(res);
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
  if (!onlinePaymentsEnabled) return rejectDisabledOnlinePayment(res);
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
  if (!onlinePaymentsEnabled) return rejectDisabledOnlinePayment(res);
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

// List mobile money payments (admin only)
router.get('/mobile-money', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { status } = req.query;
    const where = { payment_method: 'mobile_money' };
    if (status) {
      where.payment_status = status;
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { created_date: 'desc' }
    });

    res.json(orders);
  } catch (error) {
    console.error('List mobile money payments error', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Approve mobile money payment (admin only)
router.put('/mobile-money/:id/approve', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }
    if (order.payment_method !== 'mobile_money') {
      return res.status(400).json({ message: 'Commande non mobile money' });
    }
    if (parseEbillingDetails(order)) {
      return res.status(409).json({ message: 'Ce paiement est vérifié directement auprès d’E-Billing et ne peut pas être approuvé manuellement.' });
    }
    if (!['pending', 'requires_action'].includes(order.payment_status) || order.status === 'annulee' || order.closed_at) {
      return res.status(409).json({ message: 'Seul un paiement Mobile Money en attente sur une commande active peut être approuvé.' });
    }

    const result = await prisma.order.updateMany({
      where: {
        id,
        payment_method: 'mobile_money',
        payment_status: order.payment_status,
        status: order.status,
        closed_at: null
      },
      data: {
        payment_status: 'paid',
        ...(order.status === 'en_attente' ? { status: 'en_preparation' } : {})
      }
    });
    if (!result.count) return res.status(409).json({ message: 'Le paiement a déjà été traité. Actualisez la liste.' });
    const updated = await prisma.order.findUnique({ where: { id }, include: { items: true } });

    res.json(updated);
  } catch (error) {
    console.error('Approve mobile money error', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Reject mobile money payment (admin only)
router.put('/mobile-money/:id/reject', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }
    if (order.payment_method !== 'mobile_money') {
      return res.status(400).json({ message: 'Commande non mobile money' });
    }
    if (parseEbillingDetails(order)) {
      return res.status(409).json({ message: 'Ce paiement est suivi directement par E-Billing et ne peut pas être rejeté manuellement.' });
    }
    if (!['pending', 'requires_action'].includes(order.payment_status) || order.status === 'annulee' || order.closed_at) {
      return res.status(409).json({ message: 'Seul un paiement Mobile Money en attente sur une commande active peut être rejeté.' });
    }

    const notes = order.notes ? `${order.notes} | Mobile money rejeté` : 'Mobile money rejeté';
    const result = await prisma.order.updateMany({
      where: {
        id,
        payment_method: 'mobile_money',
        payment_status: order.payment_status,
        status: order.status,
        closed_at: null
      },
      data: {
        payment_status: 'failed',
        status: 'annulee',
        notes
      }
    });
    if (!result.count) return res.status(409).json({ message: 'Le paiement a déjà été traité. Actualisez la liste.' });
    const updated = await prisma.order.findUnique({ where: { id }, include: { items: true } });

    res.json(updated);
  } catch (error) {
    console.error('Reject mobile money error', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

