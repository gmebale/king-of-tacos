const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get revenue data aggregated by date (admin only)
router.get('/revenue', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let whereClause = {};
    if (start_date || end_date) {
      whereClause.created_date = {};
      if (start_date) whereClause.created_date.gte = new Date(start_date);
      if (end_date) whereClause.created_date.lte = new Date(end_date);
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        created_date: true,
        total_amount: true,
        status: true
      }
    });

    // Aggregate by date
    const revenueByDate = {};
    orders.forEach(order => {
      const date = order.created_date.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!revenueByDate[date]) {
        revenueByDate[date] = { actual: 0, lost: 0 };
      }

      if (order.status === 'annulee') {
        revenueByDate[date].lost += order.total_amount;
      } else {
        revenueByDate[date].actual += order.total_amount;
      }
    });

    // Convert to array format for frontend
    const result = Object.entries(revenueByDate).map(([date, data]) => ({
      date,
      actualRevenue: data.actual,
      lostRevenue: data.lost,
      netRevenue: data.actual - data.lost
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json(result);
  } catch (error) {
    console.error('Get revenue error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get top-selling products (admin only)
router.get('/top-products', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { start_date, end_date, limit = 10 } = req.query;

    let whereClause = {};
    if (start_date || end_date) {
      whereClause.created_date = {};
      if (start_date) whereClause.created_date.gte = new Date(start_date);
      if (end_date) whereClause.created_date.lte = new Date(end_date);
    }

    // Get all order items with order info
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: whereClause
      },
      include: {
        order: {
          select: { status: true }
        }
      }
    });

    // Aggregate by product name
    const productStats = {};
    for (const item of orderItems) {
      const productName = item.product_name;
      if (!productStats[productName]) {
        productStats[productName] = { quantity: 0, revenue: 0 };
      }

      // Only count non-canceled orders
      if (item.order.status !== 'annulee') {
        productStats[productName].quantity += item.quantity;

        // Get product price to calculate revenue
        const product = await prisma.product.findFirst({
          where: { name: productName },
          select: { price: true }
        });

        if (product) {
          productStats[productName].revenue += item.quantity * product.price;
        }
      }
    }

    // Convert to array and sort
    const result = Object.entries(productStats)
      .map(([name, stats]) => ({
        name,
        quantity: stats.quantity,
        revenue: stats.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, parseInt(limit));

    res.json(result);
  } catch (error) {
    console.error('Get top products error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get top customers (admin only)
router.get('/top-customers', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { start_date, end_date, limit = 10 } = req.query;

    let whereClause = { user_id: { not: null } }; // Only authenticated orders
    if (start_date || end_date) {
      whereClause.created_date = {};
      if (start_date) whereClause.created_date.gte = new Date(start_date);
      if (end_date) whereClause.created_date.lte = new Date(end_date);
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, full_name: true, email: true, loyalty_points: true }
        }
      }
    });

    // Aggregate by user
    const customerStats = {};
    orders.forEach(order => {
      if (!order.user) return;

      const userId = order.user.id;
      if (!customerStats[userId]) {
        customerStats[userId] = {
          id: userId,
          name: order.user.full_name,
          email: order.user.email,
          totalSpent: 0,
          orderCount: 0,
          loyaltyPoints: order.user.loyalty_points
        };
      }

      if (order.status !== 'annulee') {
        customerStats[userId].totalSpent += order.total_amount;
        customerStats[userId].orderCount += 1;
      }
    });

    // Convert to array and sort by total spent
    const result = Object.values(customerStats)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, parseInt(limit));

    res.json(result);
  } catch (error) {
    console.error('Get top customers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
