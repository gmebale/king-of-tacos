const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

const router = express.Router();
const prisma = new PrismaClient();

// Get orders for cashier view (admin only)
router.get('/orders', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: ['prete', 'en_livraison', 'livree']
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
    res.json(orders);
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
          select: { id: true, full_name: true, email: true, phone: true, address: true }
        },
        items: {
          include: {
            product: true
          }
        }
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

    order.items.forEach(item => {
      const itemTotal = item.quantity * item.price;
      total += itemTotal;

      doc.text(item.product_name, 50, y);
      doc.text(item.quantity.toString(), 300, y);
      doc.text(`${item.price.toFixed(2)} €`, 400, y);
      doc.text(`${itemTotal.toFixed(2)} €`, 480, y);

      y += 20;
    });

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
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Calculate totals
    const totalRevenue = orders.reduce((sum, order) => {
      return sum + order.items.reduce((orderSum, item) => orderSum + (item.quantity * item.price), 0);
    }, 0);

    const totalOrders = orders.length;

    // Product sales
    const productSales = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.product_id]) {
          productSales[item.product_id] = {
            name: item.product_name,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[item.product_id].quantity += item.quantity;
        productSales[item.product_id].revenue += item.quantity * item.price;
      });
    });

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
