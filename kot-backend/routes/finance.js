const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getPaidItemTaxMultiplier, getOrderItemTaxQuantity } = require('../utils/orderTaxAdjustment');
const { authenticateToken, requirePagePermission } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
function getFinanceFilters(query, dateField = 'closed_at') {
  const where = {};
  if (dateField === 'closed_at') where.closed_at = { not: null };
  if (query.start_date || query.end_date) {
    where[dateField] = { ...(dateField === 'closed_at' ? { not: null } : {}) };
    if (query.start_date) where[dateField].gte = new Date(`${query.start_date}T00:00:00.000Z`);
    if (query.end_date) {
      const endExclusive = new Date(`${query.end_date}T00:00:00.000Z`);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      where[dateField].lt = endExclusive;
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
    status: { in: ['livree', 'servie', 'recuperee'] },
    payment_status: 'paid',
    closed_at: { ...(filters.closed_at || {}), not: null }
  };
}

function getLostOrderFilter(query) {
  return {
    ...getFinanceFilters(query, 'created_date'),
    OR: [{ status: 'annulee' }, { payment_status: 'refunded' }]
  };
}

// Get revenue data aggregated by date (admin only)
router.get('/revenue', authenticateToken, requirePagePermission('finance', 'dashboard'), async (req, res) => {
  try {
    const [sales, lostOrders] = await Promise.all([
      prisma.order.findMany({
        where: getNonLostOrderFilter(getFinanceFilters(req.query)),
        select: { closed_at: true, total_amount: true }
      }),
      prisma.order.findMany({
        where: getLostOrderFilter(req.query),
        select: { created_date: true, total_amount: true }
      })
    ]);

    // Aggregate by date
    const revenueByDate = {};
    sales.forEach(order => {
      const date = order.closed_at.toISOString().split('T')[0];
      if (!revenueByDate[date]) {
        revenueByDate[date] = { actual: 0, lost: 0 };
      }
      revenueByDate[date].actual += order.total_amount;
    });
    lostOrders.forEach(order => {
      const date = order.created_date.toISOString().split('T')[0];
      if (!revenueByDate[date]) revenueByDate[date] = { actual: 0, lost: 0 };
      revenueByDate[date].lost += order.total_amount;
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

        productStats[productName].revenue += item.quantity * item.price;
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
    const [orders, lostOrders] = await Promise.all([
      prisma.order.findMany({
        where: { ...getNonLostOrderFilter(getFinanceFilters(req.query)), order_type: 'sur_place' },
        select: { service_location: true, total_amount: true, status: true, payment_status: true }
      }),
      prisma.order.findMany({
        where: { ...getLostOrderFilter(req.query), order_type: 'sur_place' },
        select: { service_location: true, total_amount: true, status: true, payment_status: true }
      })
    ]);
    const locationStats = {};
    for (const order of [...orders, ...lostOrders]) {
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
    const baseFilter = getFinanceFilters(req.query);
    if (!baseFilter.validated_by) baseFilter.validated_by = { not: null };
    const [orders, lostOrders] = await Promise.all([
      prisma.order.findMany({
        where: getNonLostOrderFilter(baseFilter),
        select: { validated_by: true, total_amount: true, status: true, payment_status: true, validatedBy: { select: { full_name: true, role: true } } }
      }),
      prisma.order.findMany({
        where: { ...getLostOrderFilter(req.query), validated_by: baseFilter.validated_by },
        select: { validated_by: true, total_amount: true, status: true, payment_status: true, validatedBy: { select: { full_name: true, role: true } } }
      })
    ]);
    const serverStats = {};
    for (const order of [...orders, ...lostOrders]) {
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

router.get('/profit-summary', authenticateToken, requirePagePermission('finance', 'dashboard'), async (req, res) => {
  try {
    const dateFilter = getFinanceFilters({ start_date: req.query.start_date, end_date: req.query.end_date });
    const expenseDateFilter = getFinanceFilters({ start_date: req.query.start_date, end_date: req.query.end_date }, 'expense_date');
    const [orders, legacyExpenses, cashExpenses] = await Promise.all([
      prisma.order.findMany({
        where: {
          ...dateFilter,
          ...getNonLostOrderFilter(dateFilter)
        },
        select: {
          total_amount: true,
          discount_amount: true,
          promoCode: { select: { type: true } },
          items: {
            select: {
              price: true,
              quantity: true,
              free_quantity: true,
              unit_tax_base: true,
              unit_tax_total: true,
              tax_breakdown: true,
              unit_cost_snapshot: true,
              stock_deducted: true
            }
          }
        }
      }),
      prisma.expense.findMany({
        where: expenseDateFilter,
        select: { expense_type: true, amount: true }
      }),
      prisma.cashExpense.findMany({
        where: expenseDateFilter,
        select: { expense_type: true, amount: true }
      })
    ]);
    const expenses = [...legacyExpenses, ...cashExpenses];

    let revenueWithTax = 0;
    let taxTotal = 0;
    let costOfGoodsSold = 0;
    let uncostedQuantity = 0;
    const taxBreakdown = new Map();
    for (const order of orders) {
      const taxMultiplier = getPaidItemTaxMultiplier(order);
      revenueWithTax += order.total_amount;
      for (const item of order.items) {
        const taxQuantity = getOrderItemTaxQuantity(item);
        taxTotal += Math.round(item.unit_tax_total * taxQuantity * taxMultiplier);
        const breakdown = Array.isArray(item.tax_breakdown) ? item.tax_breakdown : [];
        for (const tax of breakdown) {
          const current = taxBreakdown.get(tax.id) || { id: tax.id, name: tax.name, rate: tax.percentage_basis_points / 100, amount: 0 };
          current.amount += Math.round((tax.amount || 0) * taxQuantity * taxMultiplier);
          taxBreakdown.set(tax.id, current);
        }
        if (item.stock_deducted && item.unit_cost_snapshot !== null) {
          costOfGoodsSold += item.unit_cost_snapshot * item.quantity;
        } else {
          uncostedQuantity += item.quantity;
        }
      }
    }

    const operatingExpenses = expenses.filter(expense => expense.expense_type !== 'stock_purchase')
      .reduce((sum, expense) => sum + expense.amount, 0);
    const stockPurchases = expenses.filter(expense => expense.expense_type === 'stock_purchase')
      .reduce((sum, expense) => sum + expense.amount, 0);
    const salesBeforeTax = revenueWithTax - taxTotal;
    res.json({
      revenueWithTax,
      taxTotal,
      salesBeforeTax,
      costOfGoodsSold,
      operatingExpenses,
      stockPurchases,
      netProfit: salesBeforeTax - costOfGoodsSold - operatingExpenses,
      uncostedQuantity,
      taxBreakdown: [...taxBreakdown.values()].sort((a, b) => b.amount - a.amount)
    });
  } catch (error) {
    console.error('Get profit summary error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/expense-catalog', authenticateToken, async (req, res) => {
  try {
    const items = await prisma.expenseCatalogItem.findMany({ orderBy: [{ active: 'desc' }, { category: 'asc' }] });
    res.json(items);
  } catch (error) {
    console.error('Get expense catalog error:', error);
    res.status(500).json({ message: 'Impossible de charger le catalogue des dépenses.' });
  }
});

router.post('/expense-catalog', authenticateToken, requirePagePermission('finance', 'dashboard'), async (req, res) => {
  try {
    const { category, description, expense_type = 'operating' } = req.body;
    if (!['operating', 'stock_purchase'].includes(expense_type) || !String(category || '').trim() || !String(description || '').trim()) {
      return res.status(400).json({ message: 'Catégorie, libellé et type de dépense valides sont requis.' });
    }
    const item = await prisma.expenseCatalogItem.create({ data: {
      category: String(category).trim(), description: String(description).trim(), expense_type, created_by: req.user.id
    } });
    res.status(201).json(item);
  } catch (error) {
    console.error('Create expense catalog item error:', error);
    res.status(500).json({ message: 'Impossible de créer ce poste de dépense.' });
  }
});

router.patch('/expense-catalog/:id', authenticateToken, requirePagePermission('finance', 'dashboard'), async (req, res) => {
  try {
    const item = await prisma.expenseCatalogItem.update({
      where: { id: Number(req.params.id) },
      data: { active: Boolean(req.body.active) }
    });
    res.json(item);
  } catch (error) {
    console.error('Update expense catalog item error:', error);
    res.status(404).json({ message: 'Poste de dépense introuvable.' });
  }
});

router.get('/expenses', authenticateToken, requirePagePermission('finance', 'dashboard'), async (req, res) => {
  try {
    const filters = getFinanceFilters({ start_date: req.query.start_date, end_date: req.query.end_date }, 'expense_date');
    const expenses = await prisma.expense.findMany({
      where: filters,
      include: {
        createdBy: { select: { full_name: true } },
        items: { include: { product: { select: { id: true, name: true } } } }
      },
      orderBy: { expense_date: 'desc' }
    });
    res.json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ message: 'Impossible de charger les dépenses' });
  }
});

router.get('/cash-expenses', authenticateToken, requirePagePermission('finance', 'dashboard'), async (req, res) => {
  try {
    const filters = getFinanceFilters({ start_date: req.query.start_date, end_date: req.query.end_date }, 'expense_date');
    const expenses = await prisma.cashExpense.findMany({
      where: filters,
      include: {
        session: { select: { id: true, opened_at: true } },
        createdBy: { select: { full_name: true } },
        items: { include: { product: { select: { id: true, name: true } } } }
      },
      orderBy: { expense_date: 'desc' }
    });
    res.json(expenses);
  } catch (error) {
    console.error('Get cash expenses error:', error);
    res.status(500).json({ message: 'Impossible de charger les mouvements de dépenses.' });
  }
});

router.post('/expenses', authenticateToken, requirePagePermission('finance', 'dashboard'), async (req, res) => {
  return res.status(410).json({ message: 'Les dépenses réelles se saisissent depuis une session ouverte dans le mode Caisse.' });
  /* Legacy endpoint retained below for reference; new expense entries are session-bound. */
  try {
    const {
      expense_type = 'operating', category, description, amount, expense_date,
      payment_method, supplier, items = []
    } = req.body;
    if (!['operating', 'stock_purchase'].includes(expense_type)) {
      return res.status(400).json({ message: 'Type de dépense invalide' });
    }
    if (!String(category || '').trim() || !String(description || '').trim()) {
      return res.status(400).json({ message: 'La catégorie et la description sont obligatoires' });
    }
    const expenseDate = expense_date ? new Date(expense_date) : new Date();
    if (Number.isNaN(expenseDate.getTime())) return res.status(400).json({ message: 'Date de dépense invalide' });

    let normalizedItems = [];
    let finalAmount = Number(amount);
    if (expense_type === 'stock_purchase') {
      if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Ajoutez au moins un produit à cet achat de stock' });
      normalizedItems = items.map(item => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost)
      }));
      if (normalizedItems.some(item => !Number.isInteger(item.product_id) || item.product_id < 1 || !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isInteger(item.unit_cost) || item.unit_cost < 0)) {
        return res.status(400).json({ message: 'Produit, quantité ou coût unitaire invalide' });
      }
      finalAmount = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
    } else if (!Number.isInteger(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({ message: 'Le montant de la dépense doit être supérieur à zéro' });
    }

    const expense = await prisma.$transaction(async tx => {
      if (expense_type === 'stock_purchase') {
        const productIds = [...new Set(normalizedItems.map(item => item.product_id))];
        const products = await tx.product.findMany({ where: { id: { in: productIds } } });
        if (products.length !== productIds.length) {
          const error = new Error('Un produit de l’achat est introuvable');
          error.statusCode = 400;
          throw error;
        }
      }
      const created = await tx.expense.create({
        data: {
          expense_type,
          category: String(category).trim(),
          description: String(description).trim(),
          amount: finalAmount,
          expense_date: expenseDate,
          payment_method: payment_method || null,
          supplier: supplier ? String(supplier).trim() : null,
          created_by: req.user.id,
          ...(expense_type === 'stock_purchase' ? { items: { create: normalizedItems } } : {})
        }
      });

      if (expense_type === 'stock_purchase') {
        for (const line of normalizedItems) {
          const product = await tx.product.findUnique({ where: { id: line.product_id } });
          const previousQuantity = Math.max(0, product.stock);
          const averageCost = product.average_purchase_cost === null || previousQuantity === 0
            ? line.unit_cost
            : Math.round((previousQuantity * product.average_purchase_cost + line.quantity * line.unit_cost) / (previousQuantity + line.quantity));
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { increment: line.quantity }, average_purchase_cost: averageCost }
          });
        }
      }
      return tx.expense.findUnique({
        where: { id: created.id },
        include: { items: { include: { product: { select: { id: true, name: true } } } }, createdBy: { select: { full_name: true } } }
      });
    });
    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    res.status(500).json({ message: 'Impossible d’enregistrer cette dépense' });
  }
});

module.exports = router;
