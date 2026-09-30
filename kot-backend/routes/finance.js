const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePagePermission } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
function getFinanceFilters(query) {
  const where = {};
  if (query.start_date || query.end_date) {
    where.created_date = {};
    if (query.start_date) where.created_date.gte = new Date(`${query.start_date}T00:00:00.000Z`);
    if (query.end_date) {
      const endExclusive = new Date(`${query.end_date}T00:00:00.000Z`);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      where.created_date.lt = endExclusive;
    }
  }
  if (query.service_location) {
    where.service_location = query.service_location;
  }
  if (query.server_id && Number.isInteger(Number(query.server_id))) {
    where.validated_by = Number(query.server_id);
  }
  return where;
}

function isLostOrder(order) {
  return order.status === 'annulee' || order.payment_status === 'refunded';
}

function getNonLostOrderFilter(filters) {
  return {
    ...filters,
    status: { not: 'annulee' },
    payment_status: { not: 'refunded' }
  };
}

// Get revenue data aggregated by date (admin only)
router.get('/revenue', authenticateToken, requirePagePermission('finance', 'dashboard'), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: getFinanceFilters(req.query),
      select: {
        created_date: true,
        total_amount: true,
        status: true,
        payment_status: true
      }
    });

    // Aggregate by date
    const revenueByDate = {};
    orders.forEach(order => {
      const date = order.created_date.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!revenueByDate[date]) {
        revenueByDate[date] = { actual: 0, lost: 0 };
      }

      if (isLostOrder(order)) {
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
router.get('/top-products', authenticateToken, requirePagePermission('finance', 'dashboard'), async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const whereClause = getNonLostOrderFilter(getFinanceFilters(req.query));

    // Get all order items with order info
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: whereClause
      },
      include: {
        order: {
          select: { status: true, payment_status: true }
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
      if (!isLostOrder(item.order)) {
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
router.get('/top-customers', authenticateToken, requirePagePermission('finance', 'dashboard'), async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const whereClause = { ...getNonLostOrderFilter(getFinanceFilters(req.query)), user_id: { not: null } };

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

      customerStats[userId].totalSpent += order.total_amount;
      customerStats[userId].orderCount += 1;
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

router.get('/filter-options', authenticateToken, requirePagePermission('finance', 'dashboard'), async (_req, res) => {
  try {
    const [servers, locations] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'serveur' },
        select: { id: true, full_name: true },
        orderBy: { full_name: 'asc' }
      }),
      prisma.restaurantLocation.findMany({ where: { active: true }, select: { slug: true, name: true }, orderBy: { name: 'asc' } })
    ]);
    res.json({
      servers,
      locations: locations.map(location => ({ value: location.slug, label: location.name }))
    });
  } catch (error) {
    console.error('Get finance filter options error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/top-locations', authenticateToken, requirePagePermission('finance', 'dashboard'), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { ...getFinanceFilters(req.query), order_type: 'sur_place' },
      select: { service_location: true, total_amount: true, status: true, payment_status: true }
    });
    const locationStats = {};
    for (const order of orders) {
      const key = order.service_location || 'non_renseigne';
      if (!locationStats[key]) locationStats[key] = { location: key, revenue: 0, orders: 0, lostRevenue: 0, lostOrders: 0 };
      if (isLostOrder(order)) {
        locationStats[key].lostRevenue += order.total_amount;
        locationStats[key].lostOrders += 1;
      } else {
        locationStats[key].revenue += order.total_amount;
        locationStats[key].orders += 1;
      }
    }
    res.json(Object.values(locationStats).sort((a, b) => b.revenue - a.revenue));
  } catch (error) {
    console.error('Get top locations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/top-servers', authenticateToken, requirePagePermission('finance', 'dashboard'), async (req, res) => {
  try {
    const where = getFinanceFilters(req.query);
    if (!where.validated_by) where.validated_by = { not: null };
    const orders = await prisma.order.findMany({
      where,
      select: {
        validated_by: true,
        total_amount: true,
        status: true,
        payment_status: true,
        validatedBy: { select: { full_name: true, role: true } }
      }
    });
    const serverStats = {};
    for (const order of orders) {
      if (order.validatedBy?.role !== 'serveur') continue;
      const id = order.validated_by;
      if (!serverStats[id]) serverStats[id] = { id, name: order.validatedBy?.full_name || 'Serveur', revenue: 0, orders: 0, lostRevenue: 0, lostOrders: 0 };
      if (isLostOrder(order)) {
        serverStats[id].lostRevenue += order.total_amount;
        serverStats[id].lostOrders += 1;
      } else {
        serverStats[id].revenue += order.total_amount;
        serverStats[id].orders += 1;
      }
    }
    res.json(Object.values(serverStats).sort((a, b) => b.revenue - a.revenue));
  } catch (error) {
    console.error('Get top servers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
