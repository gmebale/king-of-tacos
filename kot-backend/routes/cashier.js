const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const router = express.Router();
const prisma = new PrismaClient();

// Utility function to format customization details
function formatCustomization(customization, productCustomization) {
  if (!customization || !productCustomization?.isConfigurable) {
    return { formattedText: '', details: [] };
  }

  const details = [];
  let formattedParts = [];

  // Process each option group
  productCustomization.optionGroups?.forEach(group => {
    const groupSelections = customization[group.id];

    if (!groupSelections) return;

    if (group.type === 'single') {
      // Single selection (e.g., size)
      const selectedOption = group.options.find(opt => opt.id === groupSelections);
      if (selectedOption) {
        details.push({
          groupName: group.name,
          type: 'single',
          value: selectedOption.name,
          priceModifier: selectedOption.priceModifier || 0
        });
        formattedParts.push(`${group.name}: ${selectedOption.name}`);
      }
    } else if (group.type === 'multiple') {
      // Multiple selection (e.g., supplements, sauces, meats)
      if (Array.isArray(groupSelections) && groupSelections.length > 0) {
        const selectedOptions = group.options.filter(opt => groupSelections.includes(opt.id));
        if (selectedOptions.length > 0) {
          const optionNames = selectedOptions.map(opt => opt.name);
          details.push({
            groupName: group.name,
            type: 'multiple',
            values: optionNames,
            priceModifiers: selectedOptions.map(opt => opt.priceModifier || 0)
          });
          formattedParts.push(`${group.name}: ${optionNames.join(', ')}`);
        }
      }
    }
  });

  return {
    formattedText: formattedParts.join(' | '),
    details: details
  };
}

// Get current cash register session
router.get('/session', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const session = await prisma.cashRegisterSession.findFirst({
      where: { closed_at: null },
      orderBy: { opened_at: 'desc' }
    });

    if (!session) {
      return res.json({ isOpen: false });
    }

    res.json({
      isOpen: true,
      session: {
        id: session.id,
        opened_at: session.opened_at,
        opening_balance: session.opening_balance,
        current_balance: session.current_balance
      }
    });
  } catch (error) {
    console.error('Get cash register session error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Open cash register
router.post('/session/open', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { opening_balance } = req.body;

    if (opening_balance === undefined || opening_balance < 0) {
      return res.status(400).json({ message: 'Opening balance is required and must be non-negative' });
    }

    // Check if there's already an open session
    const existingSession = await prisma.cashRegisterSession.findFirst({
      where: { closed_at: null }
    });

    if (existingSession) {
      return res.status(400).json({ message: 'A cash register session is already open' });
    }

    // Check if the last closed session was closed today
    const lastClosedSession = await prisma.cashRegisterSession.findFirst({
      where: { closed_at: { not: null } },
      orderBy: { closed_at: 'desc' }
    });

    if (lastClosedSession) {
      const lastClosedDate = new Date(lastClosedSession.closed_at);
      const today = new Date();
      const lastClosedDay = lastClosedDate.toDateString();
      const currentDay = today.toDateString();

      if (lastClosedDay === currentDay) {
        return res.status(400).json({
          message: 'La caisse a été fermée aujourd\'hui. Elle ne peut être ouverte que demain.'
        });
      }
    }

    const session = await prisma.cashRegisterSession.create({
      data: {
        opening_balance: opening_balance,
        current_balance: opening_balance
      }
    });

    res.json({
      message: 'Cash register opened successfully',
      session: {
        id: session.id,
        opened_at: session.opened_at,
        opening_balance: session.opening_balance,
        current_balance: session.current_balance
      }
    });
  } catch (error) {
    console.error('Open cash register error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Close cash register
router.post('/session/close', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { closing_balance, notes } = req.body;

    if (closing_balance === undefined || closing_balance < 0) {
      return res.status(400).json({ message: 'Closing balance is required and must be non-negative' });
    }

    // Get current open session
    const session = await prisma.cashRegisterSession.findFirst({
      where: { closed_at: null }
    });

    if (!session) {
      return res.status(400).json({ message: 'No open cash register session found' });
    }

    // Calculate session totals
    const orders = await prisma.order.findMany({
      where: {
        created_date: {
          gte: session.opened_at
        },
        status: {
          in: ['livree', 'prete']
        }
      },
      include: { items: true }
    });

    let totalRevenue = 0;
    const paymentMethods = {
      cash: 0,
      card: 0,
      mobile_money: 0,
      loyalty_points: 0
    };

    for (const order of orders) {
      for (const item of order.items) {
        const product = await prisma.product.findFirst({
          where: { name: item.product_name }
        });
        if (product) {
          const itemRevenue = item.quantity * (product.price / 100);
          totalRevenue += itemRevenue;

          // Count by payment method
          if (order.payment_method) {
            paymentMethods[order.payment_method] += itemRevenue;
          }
        }
      }
    }

    // Update session
    const updatedSession = await prisma.cashRegisterSession.update({
      where: { id: session.id },
      data: {
        closed_at: new Date(),
        closing_balance: closing_balance,
        total_revenue: Math.round(totalRevenue * 100), // Store in centimes
        cash_payments: Math.round(paymentMethods.cash * 100),
        card_payments: Math.round(paymentMethods.card * 100),
        mobile_payments: Math.round(paymentMethods.mobile_money * 100),
        loyalty_payments: Math.round(paymentMethods.loyalty_points * 100),
        notes: notes || null
      }
    });

    res.json({
      message: 'Cash register closed successfully',
      session: updatedSession,
      summary: {
        totalRevenue,
        paymentMethods,
        expectedBalance: session.opening_balance + totalRevenue,
        actualBalance: closing_balance,
        difference: closing_balance - (session.opening_balance + totalRevenue)
      }
    });
  } catch (error) {
    console.error('Close cash register error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get orders for cashier view (admin only) - all initiated orders
router.get('/orders', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: {
          not: 'en_attente' // Exclude only pending orders, show all initiated
        }
      },
      include: {
        user: {
          select: { id: true, full_name: true, email: true, phone: true }
        },
        items: true
      },
      orderBy: { created_date: 'desc' }
    });

    // Process orders to include formatted customizations
    const processedOrders = await Promise.all(orders.map(async (order) => {
      const processedItems = await Promise.all(order.items.map(async (item) => {
        // Get product customization configuration
        const product = await prisma.product.findFirst({
          where: { name: item.product_name },
          select: { customization: true }
        });

        // Format customization details
        const customizationInfo = formatCustomization(item.customization, product?.customization);

        return {
          ...item,
          customizationFormatted: customizationInfo.formattedText,
          customizationDetails: customizationInfo.details
        };
      }));

      return {
        ...order,
        items: processedItems,
        customer_address: order.delivery_address // Map for frontend compatibility
      };
    }));

    res.json(processedOrders);
  } catch (error) {
    console.error('Get cashier orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate invoice PDF for an order
router.get('/invoice/:orderId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true, full_name: true, email: true, phone: true }
        },
        items: true
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=facture-${order.id}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('KING OF TACOS', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('FACTURE', { align: 'center' });
    doc.moveDown();

    // Order details
    doc.fontSize(12);
    doc.text(`Numéro de commande: ${order.id}`);
    doc.text(`Date: ${new Date(order.created_date).toLocaleDateString('fr-FR')}`);
    doc.moveDown();

    // Customer details
    doc.text('Client:');
    doc.text(order.customer_name);
    if (order.customer_phone) doc.text(`Téléphone: ${order.customer_phone}`);
    if (order.customer_address) doc.text(`Adresse: ${order.customer_address}`);
    doc.moveDown();

    // Items table header
    const tableTop = doc.y;
    doc.fontSize(10);
    doc.text('Article', 50, tableTop);
    doc.text('Quantité', 300, tableTop);
    doc.text('Prix', 400, tableTop);
    doc.text('Total', 480, tableTop);

    // Line
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
    doc.moveDown();

    // Items
    let y = doc.y;
    let total = 0;
    const missingProducts = [];

    for (const item of order.items) {
      // Look up product price by name
      const product = await prisma.product.findFirst({
        where: { name: item.product_name }
      });

      if (!product) {
        missingProducts.push(item.product_name);
        continue;
      }

      const price = product.price / 100; // Convert from centimes to euros
      const itemTotal = item.quantity * price;
      total += itemTotal;

      doc.text(item.product_name, 50, y);
      doc.text(item.quantity.toString(), 300, y);
      doc.text(`${price.toFixed(2)} €`, 400, y);
      doc.text(`${itemTotal.toFixed(2)} €`, 480, y);

      y += 20;
    }

    if (missingProducts.length > 0) {
      return res.status(400).json({
        message: `Produits non trouvés dans la base de données: ${missingProducts.join(', ')}`
      });
    }

    // Total
    doc.moveTo(50, y + 5).lineTo(550, y + 5).stroke();
    doc.moveDown();
    doc.fontSize(12).text(`Total: ${total.toFixed(2)} €`, 400, y + 10);

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).text('Merci pour votre commande !', { align: 'center' });

    doc.end();

  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get sales reports
router.get('/reports/:period', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { period } = req.params; // 'day', 'week', 'month', 'year'
    const now = new Date();
    let startDate;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        const weekStart = now.getDate() - now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), weekStart);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return res.status(400).json({ message: 'Invalid period' });
    }

    const orders = await prisma.order.findMany({
      where: {
        created_date: {
          gte: startDate,
          lte: now
        },
        status: {
          in: ['livree', 'en_livraison', 'prete']
        }
      },
      include: {
        items: true
      }
    });

    // Calculate totals
    let totalRevenue = 0;
    const productSales = {};

    for (const order of orders) {
      for (const item of order.items) {
        const product = await prisma.product.findFirst({
          where: { name: item.product_name }
        });

        if (product) {
          const priceInCFA = product.price / 100; // Convert from centimes to CFA
          const itemRevenue = item.quantity * priceInCFA;
          totalRevenue += itemRevenue;

          if (!productSales[product.id]) {
            productSales[product.id] = {
              name: item.product_name,
              quantity: 0,
              revenue: 0
            };
          }
          productSales[product.id].quantity += item.quantity;
          productSales[product.id].revenue += itemRevenue;
        }
      }
    }

    const totalOrders = orders.length;

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      period,
      startDate,
      endDate: now,
      totalRevenue,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      topProducts
    });

  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark order as paid/delivered
router.put('/orders/:id/deliver', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, user: true }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update order status to delivered
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: 'livree' },
      include: {
        user: {
          select: { id: true, full_name: true, email: true, phone: true, loyalty_points: true }
        },
        items: true
      }
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error('Deliver order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
