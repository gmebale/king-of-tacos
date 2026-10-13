const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePagePermission } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { format } = require('date-fns');
const { recognizeOrderStockSale } = require('../utils/inventory');
const { awardOrderPoints, reverseOrderPoints } = require('../utils/loyalty');
const { getPaidItemTaxMultiplier, getOrderItemTaxQuantity } = require('../utils/orderTaxAdjustment');

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

// Normalize period dates helper
function getPeriodRange(period) {
  const now = new Date();
  const timeZone = 'Africa/Libreville';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const localDate = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const localMidnight = new Date(`${localDate.year}-${localDate.month}-${localDate.day}T00:00:00+01:00`);
  let startDate = localMidnight;

  switch (period) {
    case 'day': {
      break;
    }
    case 'week': {
      const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now);
      const daysSinceMonday = ({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 })[weekday];
      startDate = new Date(localMidnight.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
      break;
    }
    case 'month':
      startDate = new Date(`${localDate.year}-${localDate.month}-01T00:00:00+01:00`);
      break;
    case 'year':
      startDate = new Date(`${localDate.year}-01-01T00:00:00+01:00`);
      break;
    default:
      throw new Error('Invalid period');
  }

  return { startDate, endDate: now };
}

// Standardize category display names in reports
function normalizeCategoryName(categoryName) {
  if (!categoryName) return 'Non catégorisé';
  return categoryName.toLowerCase() === 'options' ? 'Taille' : categoryName;
}

function formatAmount(amount) {
  const numericAmount = Number(amount || 0);
  return `${numericAmount.toLocaleString('fr-GA', { maximumFractionDigits: 0 })} FCFA`;
}

// PDF helpers for styling
const palette = {
  primary: '#0ea5e9',
  secondary: '#6366f1',
  accent: '#10b981',
  text: '#0f172a',
  muted: '#475569',
  lightBg: '#f8fafc',
  border: '#e2e8f0'
};

function drawDivider(doc) {
  const { x, y, page } = doc;
  doc
    .moveTo(page.margins.left, y + 4)
    .lineTo(page.width - page.margins.right, y + 4)
    .strokeColor(palette.border)
    .lineWidth(1)
    .stroke();
  doc.moveDown();
  doc.strokeColor(palette.text).lineWidth(1);
  doc.x = x;
}

function sectionTitle(doc, title) {
  doc
    .fillColor(palette.primary)
    .fontSize(13)
    .font('Helvetica-Bold')
    .text(title.toUpperCase());
  drawDivider(doc);
  doc.fillColor(palette.text).font('Helvetica');
}

function metricRow(doc, label, value) {
  doc
    .fontSize(10)
    .fillColor(palette.muted)
    .text(label, { continued: true })
    .fillColor(palette.text)
    .font('Helvetica-Bold')
    .text(`  ${value}`);
}

function pill(doc, text, color = palette.secondary) {
  const paddingX = 6;
  const paddingY = 3;
  const textWidth = doc.widthOfString(text) + paddingX * 2;
  const textHeight = doc.currentLineHeight() + paddingY * 2;
  const startX = doc.x;
  const startY = doc.y;

  // Some PDFKit builds expose roundedRect, not roundRect
  const drawRect = doc.roundedRect ? 'roundedRect' : 'rect';
  const radius = drawRect === 'roundedRect' ? 6 : undefined;

  if (drawRect === 'roundedRect') {
    doc.roundedRect(startX, startY, textWidth, textHeight, radius).fill(color);
  } else {
    doc.rect(startX, startY, textWidth, textHeight).fill(color);
  }

  doc
    .fillColor('#fff')
    .text(text, startX + paddingX, startY + paddingY);

  doc.fillColor(palette.text);
  doc.moveDown(0.2);
}

// Build detailed sales report used by both JSON and PDF endpoints
async function buildSalesReport(period, options = {}) {
  const periodRange = options.startDate && options.endDate
    ? { startDate: options.startDate, endDate: options.endDate }
    : getPeriodRange(period);
  const { startDate, endDate } = periodRange;
  const orderWhere = {
    closed_at: { gte: startDate, lte: endDate, not: null },
    payment_status: 'paid',
    status: { in: ['livree', 'servie', 'recuperee'] }
  };
  if (options.sessionId != null) orderWhere.cash_register_session_id = options.sessionId;

  const orders = await prisma.order.findMany({
    where: orderWhere,
    include: {
      items: true,
      promoCode: { select: { type: true } },
      user: true,
      validatedBy: { select: { id: true, full_name: true } },
      closedBy: { select: { id: true, full_name: true } }
    }
  });

  // Preload categories to ensure we list even categories without sales
  const categories = await prisma.categoryModel.findMany();
  const categoryMap = {};
  categories.forEach(category => {
    const displayName = normalizeCategoryName(category.displayName || category.name);
    categoryMap[category.id] = {
      id: category.id,
      name: displayName,
      quantity: 0,
      revenue: 0,
      products: {}
    };
  });
  categoryMap['uncategorized'] = {
    name: 'Non catégorisé',
    quantity: 0,
    revenue: 0,
    products: {}
  };

  // Preload products referenced in the period to avoid N+1 lookups
  const productNames = new Set();
  orders.forEach(order => {
    order.items.forEach(item => productNames.add(item.product_name));
  });

  const products = productNames.size > 0
    ? await prisma.product.findMany({
        where: { name: { in: Array.from(productNames) } },
        include: { category: true }
      })
    : [];

  const productMapByName = new Map();
  products.forEach(product => productMapByName.set(product.name, product));

  let totalRevenue = 0;
  let totalItems = 0;
  let totalTaxes = 0;
  let totalDiscounts = 0;
  const taxBreakdown = new Map();
  const paymentBreakdown = {
    cash: 0,
    card: 0,
    mobile_money: 0,
    loyalty_points: 0,
    other: 0
  };
  const productSales = {};
  const userSales = {};
  const locationSales = {};

  for (const order of orders) {
    const taxMultiplier = getPaidItemTaxMultiplier(order);
    const orderItemsTotal = order.items.reduce(
      (sum, item) => sum + (item.price || 0) * item.quantity,
      0
    );
    const orderRevenue = order.total_amount ?? orderItemsTotal;
    totalRevenue += orderRevenue;
    totalDiscounts += Math.max(0, order.discount_amount || 0);
    const locationKey = order.order_type === 'sur_place'
      ? (order.service_location || 'non_renseigne')
      : order.order_type === 'emporter' ? 'a_emporter' : order.order_type === 'livraison' ? 'livraison' : 'non_renseigne';
    if (!locationSales[locationKey]) locationSales[locationKey] = { orders: 0, revenue: 0, items: 0 };
    locationSales[locationKey].orders += 1;
    locationSales[locationKey].revenue += orderRevenue;

    const orderQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    totalItems += orderQuantity;
    locationSales[locationKey].items += orderQuantity;

    const paymentMethod = order.payment_method || 'cash';
    if (paymentBreakdown[paymentMethod] === undefined) {
      paymentBreakdown.other += orderRevenue;
    } else {
      paymentBreakdown[paymentMethod] += orderRevenue;
    }

    const staffMember = order.closedBy || order.validatedBy;
    const staffKey = staffMember?.id ?? 'unassigned';
    if (!userSales[staffKey]) {
      userSales[staffKey] = {
        id: staffMember?.id ?? null,
        name: staffMember?.full_name || 'Vente en ligne / non attribuée',
        orders: 0,
        quantity: 0,
        revenue: 0
      };
    }
    userSales[staffKey].orders += 1;
    userSales[staffKey].revenue += orderRevenue;

    for (const item of order.items) {
      const taxQuantity = getOrderItemTaxQuantity(item);
      totalTaxes += Math.round((item.unit_tax_total || 0) * taxQuantity * taxMultiplier);
      const itemTaxes = Array.isArray(item.tax_breakdown) ? item.tax_breakdown : [];
      for (const tax of itemTaxes) {
        const current = taxBreakdown.get(tax.id) || {
          id: tax.id, name: tax.name, percentage: tax.percentage_basis_points / 100,
          base: 0, amount: 0
        };
        current.base += Math.round((item.unit_tax_base || 0) * taxQuantity * taxMultiplier);
        current.amount += Math.round((tax.amount || 0) * taxQuantity * taxMultiplier);
        taxBreakdown.set(tax.id, current);
      }
      const product = productMapByName.get(item.product_name);
      const unitPrice = item.price ?? product?.price ?? 0;
      const lineTotal = Math.round(unitPrice * getOrderItemTaxQuantity(item) * taxMultiplier);

      userSales[staffKey].quantity += item.quantity;

      const productId = product?.id ?? item.product_name;
      if (!productSales[productId]) {
        productSales[productId] = {
          name: item.product_name,
          category: normalizeCategoryName(product?.category?.displayName || product?.category?.name),
          quantity: 0,
          revenue: 0
        };
      }
      productSales[productId].quantity += item.quantity;
      productSales[productId].revenue += lineTotal;

      const categoryKey = product?.categoryId ?? 'uncategorized';
      const categoryName = normalizeCategoryName(
        product?.category?.displayName || product?.category?.name || 'Non catégorisé'
      );

      if (!categoryMap[categoryKey]) {
        categoryMap[categoryKey] = {
          name: categoryName,
          quantity: 0,
          revenue: 0,
          products: {}
        };
      }

      categoryMap[categoryKey].quantity += item.quantity;
      categoryMap[categoryKey].revenue += lineTotal;

      if (!categoryMap[categoryKey].products[productId]) {
        categoryMap[categoryKey].products[productId] = {
          name: item.product_name,
          quantity: 0,
          revenue: 0
        };
      }
      categoryMap[categoryKey].products[productId].quantity += item.quantity;
      categoryMap[categoryKey].products[productId].revenue += lineTotal;
    }
  }

  const totalOrders = orders.length;
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const categoryReport = Object.values(categoryMap)
    .sort((a, b) => b.revenue - a.revenue)
    .map(category => ({
      ...category,
      products: Object.values(category.products).sort((a, b) => b.revenue - a.revenue)
    }));

  const userReport = Object.values(userSales).sort((a, b) => b.revenue - a.revenue);

  const locationLabels = new Map((await prisma.restaurantLocation.findMany({ select: { slug: true, name: true } }))
    .map(location => [location.slug, location.name]));
  const locationReport = Object.entries(locationSales)
    .map(([slug, stats]) => ({
      location: locationLabels.get(slug) || ({
        non_renseigne: 'Lieu non renseigné',
        a_emporter: 'À emporter',
        livraison: 'Livraison'
      }[slug] || slug),
      ...stats
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const sessionWhere = options.sessionId != null
    ? { id: options.sessionId }
    : { opened_at: { lte: endDate }, OR: [{ closed_at: null }, { closed_at: { gte: startDate } }] };
  const cashSessions = options.includeCashDetails
    ? await prisma.cashRegisterSession.findMany({
        where: sessionWhere,
        orderBy: { opened_at: 'asc' }
      })
    : [];
  const sessionReport = cashSessions.map(session => ({
    id: session.id,
    opened_at: session.opened_at,
    closed_at: session.closed_at,
    opening_balance: session.opening_balance,
    expected_balance: session.current_balance,
    closing_balance: session.closing_balance,
    difference: session.closing_balance == null ? null : session.closing_balance - session.current_balance,
    notes: session.notes
  }));
  const expenseWhere = options.sessionId != null
    ? { session_id: options.sessionId }
    : { expense_date: { gte: startDate, lte: endDate } };
  const expenses = options.includeCashDetails
    ? await prisma.cashExpense.findMany({
        where: expenseWhere,
        include: {
          items: { include: { product: { select: { name: true } } } },
          createdBy: { select: { full_name: true } }
        },
        orderBy: { expense_date: 'asc' }
      })
    : [];

  return {
    period: period || 'session',
    startDate,
    endDate,
    totalRevenue,
    totalTaxes,
    revenueExcludingTax: totalRevenue - totalTaxes,
    taxBreakdown: [...taxBreakdown.values()].sort((a, b) => b.amount - a.amount),
    totalOrders,
    totalItems,
    totalDiscounts,
    revenueBeforeDiscount: totalRevenue + totalDiscounts,
    averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    paymentBreakdown,
    locationReport,
    topProducts,
    categoryReport,
    userReport,
    sessionReport,
    expenses,
    totalExpenses: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    cashExpenses: expenses.filter(expense => expense.payment_method === 'cash').reduce((sum, expense) => sum + expense.amount, 0),
    orderDetails: options.includeCashDetails ? orders.map(order => ({
      id: order.id,
      order_code: order.order_code,
      status: order.status,
      order_type: order.order_type,
      service_location: order.service_location,
      service_location_label: locationLabels.get(order.service_location) || order.service_location,
      total_amount: order.total_amount,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      validated_by: order.validatedBy?.full_name || null,
      closed_by: order.closedBy?.full_name || null,
      closed_at: order.closed_at,
      items: order.items.map(item => ({ product_name: item.product_name, quantity: item.quantity }))
    })) : [],
    orders: orders.map(order => ({
      id: order.id,
      order_code: order.order_code,
      status: order.status,
      order_type: order.order_type,
      service_location: order.service_location,
      service_location_label: locationLabels.get(order.service_location) || order.service_location,
      total_amount: order.total_amount,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      validated_by: order.validatedBy?.full_name || null,
      closed_by: order.closedBy?.full_name || null,
      closed_at: order.closed_at
    }))
  };
}

// Get current cash register session
router.get('/session', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
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
router.post('/session/open', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { opening_balance } = req.body;

    if (!Number.isSafeInteger(opening_balance) || opening_balance < 0) {
      return res.status(400).json({ message: 'Le solde d’ouverture doit être un nombre entier de FCFA positif ou nul.' });
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
router.post('/session/close', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { closing_balance, notes } = req.body;

    if (!Number.isSafeInteger(closing_balance) || closing_balance < 0) {
      return res.status(400).json({ message: 'Le solde de clôture doit être un nombre entier de FCFA positif ou nul.' });
    }

    // Get current open session
    const session = await prisma.cashRegisterSession.findFirst({
      where: { closed_at: null }
    });

    if (!session) {
      return res.status(400).json({ message: 'No open cash register session found' });
    }

    const pendingCounterOrders = await prisma.order.findMany({
      where: {
        cash_register_session_id: session.id,
        closed_at: null,
        status: { notIn: ['annulee', 'cloturee'] }
      },
      select: { order_code: true, id: true, status: true }
    });
    if (pendingCounterOrders.length) {
      return res.status(409).json({
        message: `Clôture impossible : ${pendingCounterOrders.length} commande(s) de cette session ne sont pas clôturées.`,
        pendingOrders: pendingCounterOrders.map(order => order.order_code || order.id.slice(-8))
      });
    }

    // Calculate totals from completed, paid counter orders assigned to this session.
    const sessionClosedAt = new Date();
    const orders = await prisma.order.findMany({
      where: {
        cash_register_session_id: session.id,
        closed_at: {
          gte: session.opened_at,
          lte: sessionClosedAt
        },
        payment_status: 'paid',
        status: { in: ['livree', 'servie', 'recuperee'] }
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
      const amount = order.total_amount || 0;
      totalRevenue += amount;
      const method = order.payment_method || 'cash';
      if (paymentMethods[method] !== undefined) {
        paymentMethods[method] += amount;
      } else {
        paymentMethods.cash += amount;
      }
    }

    // Update session
    const updatedSession = await prisma.cashRegisterSession.update({
      where: { id: session.id },
      data: {
        closed_at: sessionClosedAt,
        closing_balance: closing_balance,
        total_revenue: totalRevenue,
        cash_payments: paymentMethods.cash,
        card_payments: paymentMethods.card,
        mobile_payments: paymentMethods.mobile_money,
        loyalty_payments: paymentMethods.loyalty_points,
        notes: notes || null
      }
    });
    res.json({
      message: 'Cash register closed successfully',
      session: updatedSession,
      summary: {
        totalRevenue,
        paymentMethods,
        expectedBalance: session.current_balance,
        actualBalance: closing_balance,
        difference: closing_balance - session.current_balance
      }
    });
  } catch (error) {
    console.error('Close cash register error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/session/expenses', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const session = await prisma.cashRegisterSession.findFirst({ where: { closed_at: null }, orderBy: { opened_at: 'desc' } });
    if (!session) return res.json({ session: null, expenses: [] });
    const expenses = await prisma.cashExpense.findMany({
      where: { session_id: session.id },
      include: { items: { include: { product: { select: { id: true, name: true } } } }, createdBy: { select: { full_name: true } } },
      orderBy: { expense_date: 'desc' }
    });
    res.json({ session, expenses });
  } catch (error) {
    console.error('List cash expenses error:', error);
    res.status(500).json({ message: 'Impossible de charger les dépenses de la session.' });
  }
});

router.post('/session/expenses', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { catalog_item_id, amount, payment_method = 'cash', supplier, items = [] } = req.body;
    if (!['cash', 'card', 'mobile_money', 'bank_transfer', 'other'].includes(payment_method)) {
      return res.status(400).json({ message: 'Moyen de paiement invalide.' });
    }
    const catalogItem = await prisma.expenseCatalogItem.findFirst({ where: { id: Number(catalog_item_id), active: true } });
    if (!catalogItem) return res.status(400).json({ message: 'Choisissez une dépense active du catalogue.' });

    let normalizedItems = [];
    let finalAmount = Number(amount);
    if (catalogItem.expense_type === 'stock_purchase') {
      if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Ajoutez au moins un produit reçu.' });
      normalizedItems = items.map(item => ({ product_id: Number(item.product_id), quantity: Number(item.quantity), unit_cost: Number(item.unit_cost) }));
      if (normalizedItems.some(item => !Number.isInteger(item.product_id) || item.product_id < 1 || !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isInteger(item.unit_cost) || item.unit_cost < 0)) {
        return res.status(400).json({ message: 'Produit, quantité ou coût unitaire invalide.' });
      }
      finalAmount = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
    } else if (!Number.isSafeInteger(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({ message: 'Le montant doit être un nombre entier de FCFA supérieur à zéro.' });
    }
    if (!Number.isSafeInteger(finalAmount) || finalAmount <= 0) return res.status(400).json({ message: 'Montant de dépense invalide.' });

    const created = await prisma.$transaction(async tx => {
      const session = await tx.cashRegisterSession.findFirst({ where: { closed_at: null }, orderBy: { opened_at: 'desc' } });
      if (!session) {
        const error = new Error('La caisse doit être ouverte pour enregistrer une dépense.');
        error.statusCode = 409;
        throw error;
      }
      if (payment_method === 'cash' && finalAmount > session.current_balance) {
        const error = new Error('Le montant dépasse le solde espèces actuellement disponible dans le tiroir.');
        error.statusCode = 409;
        throw error;
      }
      const activeCatalogItem = await tx.expenseCatalogItem.findFirst({ where: { id: catalogItem.id, active: true } });
      if (!activeCatalogItem) {
        const error = new Error('Cette dépense a été désactivée. Actualisez la liste.');
        error.statusCode = 409;
        throw error;
      }
      if (normalizedItems.length) {
        const ids = [...new Set(normalizedItems.map(item => item.product_id))];
        const products = await tx.product.findMany({ where: { id: { in: ids } } });
        if (products.length !== ids.length) {
          const error = new Error('Un produit de la dépense est introuvable.');
          error.statusCode = 400;
          throw error;
        }
      }
      const expense = await tx.cashExpense.create({
        data: {
          session_id: session.id,
          catalog_item_id: catalogItem.id,
          category: catalogItem.category,
          description: catalogItem.description,
          expense_type: catalogItem.expense_type,
          amount: finalAmount,
          payment_method,
          supplier: supplier ? String(supplier).trim() : null,
          created_by: req.user.id,
          ...(normalizedItems.length ? { items: { create: normalizedItems } } : {})
        },
        include: { items: { include: { product: { select: { id: true, name: true } } } }, createdBy: { select: { full_name: true } } }
      });
      const sessionUpdate = {};
      if (payment_method === 'cash') sessionUpdate.current_balance = { decrement: finalAmount };
      if (payment_method === 'cash') sessionUpdate.cash_expenses = { increment: finalAmount };
      if (Object.keys(sessionUpdate).length) await tx.cashRegisterSession.update({ where: { id: session.id }, data: sessionUpdate });

      for (const line of normalizedItems) {
        const product = await tx.product.findUnique({ where: { id: line.product_id } });
        const previousQuantity = Math.max(0, product.stock);
        const averageCost = product.average_purchase_cost === null || previousQuantity === 0
          ? line.unit_cost
          : Math.round((previousQuantity * product.average_purchase_cost + line.quantity * line.unit_cost) / (previousQuantity + line.quantity));
        await tx.product.update({ where: { id: product.id }, data: { stock: { increment: line.quantity }, average_purchase_cost: averageCost } });
      }
      return expense;
    });
    res.status(201).json(created);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('Create cash expense error:', error);
    res.status(500).json({ message: 'Impossible d’enregistrer cette dépense.' });
  }
});

// Get orders for cashier view (admin only) - all initiated orders
router.get('/orders', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: { not: 'en_attente' },
        closed_at: null
      },
      include: {
        user: {
          select: { id: true, full_name: true, email: true, phone: true }
        },
        validatedBy: { select: { id: true, full_name: true, role: true } },
        closedBy: { select: { id: true, full_name: true, role: true } },
        items: true
      },
      orderBy: { created_date: 'desc' }
    });
    const locationNames = new Map((await prisma.restaurantLocation.findMany({ select: { slug: true, name: true } }))
      .map(location => [location.slug, location.name]));
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
        service_location_name: order.service_location ? locationNames.get(order.service_location) || order.service_location : null,
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
router.get('/invoice/:orderId', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true, full_name: true, email: true, phone: true }
        },
        validatedBy: { select: { full_name: true } },
        closedBy: { select: { full_name: true } },
        items: true
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const serviceLocation = order.service_location
      ? await prisma.restaurantLocation.findUnique({ where: { slug: order.service_location }, select: { name: true } })
      : null;

    // Build display code (new token / friendly id)
    const displayCode = order.order_code || `KOT-${order.id.substring(0, 8)}`;

    // Get settings
    const settings = await prisma.settings.findMany();
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    const restaurantName = settingsObj.restaurant_name || 'KING OF TACOS';
    const currency = settingsObj.currency || 'FCFA';

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=facture-${displayCode}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(20).text(restaurantName, { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text('FACTURE', { align: 'center' });
    doc.moveDown();

    // Order details
    doc.fontSize(12);
    doc.text(`Numéro de commande: ${displayCode}`);
    doc.text(`Date: ${new Date(order.created_date).toLocaleDateString('fr-FR')}`);
    doc.text(`Type: ${order.order_type || '—'}${order.service_location ? ` · Lieu : ${serviceLocation?.name || order.service_location}` : ''}${order.table_number ? ` · Table ${order.table_number}` : ''}`);
    doc.text(`Moyen de paiement: ${order.payment_method || 'Non renseigné'} · Paiement: ${order.payment_status}`);
    doc.text(`Validé par: ${order.validatedBy?.full_name || 'Client en ligne'}`);
    doc.text(`Clôturé par: ${order.closedBy?.full_name || 'Non clôturée'}`);
    doc.moveDown();

    // Customer details
    doc.text('Client:');
    doc.text(order.customer_name);
    if (order.customer_phone) doc.text(`Téléphone: ${order.customer_phone}`);
    if (order.delivery_address) doc.text(`Adresse: ${order.delivery_address}`);
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
    for (const item of order.items) {
      // Order item prices are snapshots in whole FCFA; don't use a product's current price.
      const price = Number(item.price || 0);
      const itemTotal = item.quantity * price;
      total += itemTotal;

      doc.text(item.product_name, 50, y);
      doc.text(item.quantity.toString(), 300, y);
      doc.text(`${price.toLocaleString('fr-GA')} ${currency}`, 400, y);
      doc.text(`${itemTotal.toLocaleString('fr-GA')} ${currency}`, 480, y);

      y += 20;
    }

    // Total
    doc.moveTo(50, y + 5).lineTo(550, y + 5).stroke();
    doc.moveDown();
    doc.fontSize(12).text(`Total: ${total.toLocaleString('fr-GA')} ${currency}`, 400, y + 10);

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).text('Merci pour votre commande !', { align: 'center' });

    doc.end();

  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

function formatReportAmount(amount) {
  return `${Number(amount || 0).toFixed(2)} FCFA`;
}

function ensureReportSpace(doc, height = 24) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function reportMetric(doc, label, value, options = {}) {
  const fontSize = options.fontSize || 10;
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelWidth = Math.floor(width * 0.66);
  const valueWidth = width - labelWidth;
  doc.font('Helvetica').fontSize(fontSize);
  const labelHeight = doc.heightOfString(String(label), { width: labelWidth });
  doc.font('Helvetica-Bold');
  const valueHeight = doc.heightOfString(String(value), { width: valueWidth, align: 'right' });
  const rowHeight = Math.max(labelHeight, valueHeight) + 5;
  ensureReportSpace(doc, rowHeight);
  const y = doc.y;
  doc.font('Helvetica').fontSize(fontSize).fillColor(palette.muted)
    .text(String(label), x, y, { width: labelWidth });
  doc.font('Helvetica-Bold').fillColor(palette.text)
    .text(String(value), x + labelWidth, y, { width: valueWidth, align: 'right' });
  doc.y = y + rowHeight;
  doc.x = x;
}

function reportInlineMetric(doc, label, value, options = {}) {
  const fontSize = options.fontSize || 10;
  ensureReportSpace(doc, 18);
  doc.font('Helvetica').fontSize(fontSize).fillColor(palette.muted)
    .text(`${label}: `, { indent: options.indent || 0, continued: true })
    .font('Helvetica-Bold').fillColor(palette.text)
    .text(String(value));
  doc.font('Helvetica').fillColor(palette.text).moveDown(0.05);
}

function drawCashReport(doc, report, options = {}) {
  const title = options.title || 'RAPPORT DE CAISSE';
  doc.font('Helvetica-Bold').fontSize(18).fillColor(palette.secondary).text(title, { align: 'center' });
  doc.moveDown(0.3);
  const dateLabel = title === 'RAPPORT DE FERMETURE DE CAISSE' ? 'Service' : 'Période';
  doc.font('Helvetica').fontSize(10).fillColor(palette.muted)
    .text(`${dateLabel} du ${format(report.startDate, 'dd/MM/yyyy HH:mm')}`, { align: 'center' })
    .text(`au ${format(report.endDate, 'dd/MM/yyyy HH:mm')}`, { align: 'center' })
    .text(`Généré le : ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, { align: 'center' });
  doc.moveDown();

  sectionTitle(doc, 'Résumé du service');
  reportMetric(doc, "Chiffre d'affaires TTC net", formatReportAmount(report.totalRevenue));
  reportMetric(doc, "Chiffre d'affaires TTC avant remises", formatReportAmount(report.revenueBeforeDiscount));
  reportMetric(doc, 'Remises et offres enregistrées', formatReportAmount(report.totalDiscounts));
  reportMetric(doc, "Chiffre d'affaires HT", formatReportAmount(report.revenueExcludingTax));
  reportMetric(doc, 'Taxes collectées', formatReportAmount(report.totalTaxes));
  reportMetric(doc, 'Commandes clôturées', report.totalOrders);
  reportMetric(doc, 'Articles vendus', report.totalItems);
  reportMetric(doc, 'Panier moyen', formatReportAmount(report.averageOrderValue));
  doc.moveDown();

  sectionTitle(doc, 'Ventes par catégorie et produits');
  const soldCategories = report.categoryReport?.filter(category => category.quantity || category.revenue) || [];
  if (!soldCategories.length) {
    doc.fontSize(9).fillColor(palette.muted).text('Aucune vente enregistrée sur la période.');
  } else {
    soldCategories.forEach(category => {
      ensureReportSpace(doc, 54);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(palette.secondary).text(category.name);
      reportInlineMetric(doc, 'Articles', category.quantity);
      reportInlineMetric(doc, 'Ventes', formatReportAmount(category.revenue));
      category.products.filter(product => product.quantity || product.revenue).forEach(product => {
        ensureReportSpace(doc, 50);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(palette.text).text(`• ${product.name}`, { indent: 12 });
        reportInlineMetric(doc, 'Articles', product.quantity, { fontSize: 9, indent: 12 });
        reportInlineMetric(doc, 'Ventes', formatReportAmount(product.revenue), { fontSize: 9, indent: 12 });
      });
      doc.moveDown(0.45);
    });
  }
  doc.moveDown();

  sectionTitle(doc, 'Modes de paiement');
  const paymentLabels = { cash: 'Espèces', card: 'Carte', mobile_money: 'Mobile money', loyalty_points: 'Points fidélité', other: 'Autres' };
  Object.entries(report.paymentBreakdown || {}).forEach(([method, amount]) => {
    reportMetric(doc, paymentLabels[method] || method, formatReportAmount(amount));
  });
  reportMetric(doc, 'Total des paiements', formatReportAmount(report.totalRevenue));
  doc.moveDown();

  sectionTitle(doc, 'Fonds de caisse');
  if (!report.sessionReport?.length) {
    doc.fontSize(9).fillColor(palette.muted).text('Aucune session de caisse sur la période.');
  } else {
    report.sessionReport.forEach(session => {
      reportMetric(doc, `Session ${session.id} - ouverture ${format(session.opened_at, 'dd/MM/yyyy HH:mm')}`, session.closed_at ? format(session.closed_at, 'dd/MM/yyyy HH:mm') : 'Encore ouverte', { fontSize: 9 });
      reportMetric(doc, 'Fonds de caisse initial', formatReportAmount(session.opening_balance));
      reportMetric(doc, 'Solde attendu en caisse', formatReportAmount(session.expected_balance));
      reportMetric(doc, 'Fonds de caisse compté à la fermeture', session.closing_balance == null ? 'Non clôturée' : formatReportAmount(session.closing_balance));
      reportMetric(doc, 'Écart de caisse (compté - attendu)', session.difference == null ? 'Non clôturée' : formatReportAmount(session.difference));
      if (session.notes) reportMetric(doc, 'Note de clôture', session.notes, { fontSize: 9 });
      doc.moveDown(0.4);
    });
  }
  doc.moveDown();

  sectionTitle(doc, 'Ventes par membre du personnel');
  if (!report.userReport?.length) {
    doc.fontSize(9).fillColor(palette.muted).text('Aucune vente attribuée sur la période.');
  } else {
    report.userReport.forEach(staff => {
      reportMetric(doc, staff.name, formatReportAmount(staff.revenue));
      reportMetric(doc, 'Commandes / articles', `${staff.orders} commande(s) / ${staff.quantity} article(s)`, { fontSize: 9 });
    });
  }
  doc.moveDown();

  sectionTitle(doc, 'Ventes par lieu');
  if (!report.locationReport?.length) {
    doc.fontSize(9).fillColor(palette.muted).text('Aucune vente par lieu sur la période.');
  } else {
    report.locationReport.forEach(location => {
      ensureReportSpace(doc, 54);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(palette.secondary).text(location.location);
      reportInlineMetric(doc, 'Commandes', location.orders);
      reportInlineMetric(doc, 'Articles', location.items);
      reportInlineMetric(doc, 'Ventes', formatReportAmount(location.revenue));
      doc.moveDown(0.45);
    });
  }
  doc.moveDown();

  sectionTitle(doc, 'Taxes par taux');
  if (!report.taxBreakdown?.length) {
    doc.fontSize(9).fillColor(palette.muted).text('Aucune taxe enregistrée sur la période.');
  } else {
    report.taxBreakdown.forEach(tax => {
      reportMetric(doc, `${tax.name} (${Number(tax.percentage || 0).toFixed(2)} %)`, `Base ${formatReportAmount(tax.base)} - Taxe ${formatReportAmount(tax.amount)}`, { fontSize: 9 });
    });
  }
  reportMetric(doc, 'Total HT / taxes / TTC', `${formatReportAmount(report.revenueExcludingTax)} / ${formatReportAmount(report.totalTaxes)} / ${formatReportAmount(report.totalRevenue)}`, { fontSize: 9 });
  doc.moveDown();

  sectionTitle(doc, 'Dépenses');
  reportMetric(doc, 'Total des dépenses', formatReportAmount(report.totalExpenses));
  reportMetric(doc, 'Dont dépenses payées en espèces', formatReportAmount(report.cashExpenses));
  if (report.expenses?.length) {
    report.expenses.forEach(expense => {
      const products = expense.items?.map(item => `${item.quantity} x ${item.product?.name || 'Article'}`).join(', ');
      reportMetric(doc, `${format(expense.expense_date, 'dd/MM HH:mm')} - ${expense.category} - ${expense.payment_method}`, formatReportAmount(expense.amount), { fontSize: 9 });
      doc.fontSize(8).fillColor(palette.muted)
        .text([expense.description, expense.supplier ? `Fournisseur : ${expense.supplier}` : '', products || '', expense.createdBy?.full_name ? `Saisi par : ${expense.createdBy.full_name}` : ''].filter(Boolean).join(' - '));
    });
  } else {
    doc.fontSize(9).fillColor(palette.muted).text('Aucune dépense enregistrée sur la période.');
  }
  doc.moveDown();

  sectionTitle(doc, 'Détail des commandes');
  if (!report.orderDetails?.length) {
    doc.fontSize(9).fillColor(palette.muted).text('Aucune commande clôturée sur la période.');
  } else {
    report.orderDetails.forEach(order => {
      const code = order.order_code || order.id.slice(-8);
      reportMetric(doc, `Commande #${code} - ${order.order_type || 'Type non renseigné'} - ${order.service_location_label || 'Lieu non renseigné'}`, formatReportAmount(order.total_amount), { fontSize: 9 });
      doc.fontSize(8).fillColor(palette.muted)
        .text(`Paiement : ${order.payment_method || 'Non renseigné'} - Validée par : ${order.validated_by || 'Client en ligne'} - Clôturée par : ${order.closed_by || 'Non attribuée'}`);
      order.items?.forEach(item => {
        doc.fontSize(8).fillColor(palette.text).text(`  ${item.quantity} x ${item.product_name}`);
      });
      doc.moveDown(0.3);
    });
  }
}

// Get sales reports
router.get('/reports/:period', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { period } = req.params; // 'day', 'week', 'month', 'year'
    const report = await buildSalesReport(period);
    res.json(report);
  } catch (error) {
    console.error('Get sales report error:', error);
    if (error.message === 'Invalid period') {
      return res.status(400).json({ message: 'Invalid period' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate detailed cash report PDF for a selected period
router.get('/reports/:period/pdf', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const report = await buildSalesReport(req.params.period, { includeCashDetails: true });
    const filename = `rapport-caisse-${req.params.period}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    drawCashReport(doc, report, { title: 'RAPPORT DE CAISSE' });
    doc.end();
  } catch (error) {
    console.error('Generate cash report PDF error:', error);
    if (error.message === 'Invalid period') return res.status(400).json({ message: 'Invalid period' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/reports/:period/excel', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const report = await buildSalesReport(req.params.period, { includeCashDetails: true });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'King of Tacos';
    workbook.created = new Date();

    const summary = workbook.addWorksheet('Synthèse');
    summary.addRows([
      ['Rapport de caisse'],
      ['Période', format(report.startDate, 'dd/MM/yyyy HH:mm'), format(report.endDate, 'dd/MM/yyyy HH:mm')],
      ["Chiffre d'affaires TTC net (FCFA)", report.totalRevenue],
      ["Chiffre d'affaires TTC avant remises (FCFA)", report.revenueBeforeDiscount],
      ['Remises et offres enregistrées (FCFA)', report.totalDiscounts],
      ["Chiffre d'affaires HT (FCFA)", report.revenueExcludingTax],
      ['Taxes collectées (FCFA)', report.totalTaxes],
      ['Nombre de commandes', report.totalOrders],
      ['Articles vendus', report.totalItems],
      ['Panier moyen (FCFA)', report.averageOrderValue],
      [],
      ['Mode de paiement', 'Montant (FCFA)'],
      ...Object.entries(report.paymentBreakdown).map(([method, amount]) => [method, amount]),
      ['Total des paiements', report.totalRevenue],
      [],
      ['Catégorie', 'Articles vendus', 'Ventes TTC (FCFA)'],
      ...report.categoryReport.filter(category => category.quantity || category.revenue).map(category => [category.name, category.quantity, category.revenue])
    ]);
    summary.getRow(1).font = { bold: true, size: 16 };
    [12, 18, 20].forEach(row => { summary.getRow(row).font = { bold: true }; });
    summary.columns = [{ width: 38 }, { width: 24 }, { width: 24 }];

    const sessions = workbook.addWorksheet('Fonds de caisse');
    sessions.addRow(['Session', 'Ouverture', 'Fermeture', 'Fonds initial (FCFA)', 'Solde attendu (FCFA)', 'Montant compté (FCFA)', 'Écart (FCFA)', 'Note']).font = { bold: true };
    report.sessionReport.forEach(session => sessions.addRow([
      session.id, session.opened_at, session.closed_at, session.opening_balance,
      session.expected_balance, session.closing_balance, session.difference, session.notes || ''
    ]));
    sessions.columns = [
      { width: 12 }, { width: 22, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { width: 22, style: { numFmt: 'dd/mm/yyyy hh:mm' } }, { width: 20 },
      { width: 22 }, { width: 22 }, { width: 18 }, { width: 40 }
    ];

    const payments = workbook.addWorksheet('Modes de paiement');
    payments.addRow(['Mode de paiement', 'Montant (FCFA)']).font = { bold: true };
    const paymentLabels = { cash: 'Espèces', card: 'Carte', mobile_money: 'Mobile money', loyalty_points: 'Points fidélité', other: 'Autres' };
    Object.entries(report.paymentBreakdown).forEach(([method, amount]) => payments.addRow([paymentLabels[method] || method, amount]));
    payments.addRow(['Total', report.totalRevenue]).font = { bold: true };
    payments.columns = [{ width: 32 }, { width: 24 }];

    const locations = workbook.addWorksheet('Ventes par lieu');
    locations.addRow(['Lieu', 'Commandes', 'Articles', 'Ventes TTC (FCFA)']).font = { bold: true };
    report.locationReport.forEach(location => locations.addRow([location.location, location.orders, location.items, location.revenue]));
    locations.columns = [{ width: 32 }, { width: 16 }, { width: 16 }, { width: 24 }];

    const taxes = workbook.addWorksheet('Taxes et remises');
    taxes.addRow(['Taux', 'Pourcentage', 'Base HT (FCFA)', 'Taxe (FCFA)', 'Base + taxe (FCFA)']).font = { bold: true };
    report.taxBreakdown.forEach(tax => taxes.addRow([tax.name, tax.percentage, tax.base, tax.amount, tax.base + tax.amount]));
    taxes.addRow(['Total rapport', '', report.revenueExcludingTax, report.totalTaxes, report.totalRevenue]).font = { bold: true };
    taxes.addRow(['Remises et offres', '', '', '', report.totalDiscounts]);
    taxes.columns = [{ width: 28 }, { width: 16 }, { width: 22 }, { width: 20 }, { width: 24 }];

    const products = workbook.addWorksheet('Ventes par produit');
    products.addRow(['Catégorie', 'Produit', 'Quantité vendue', 'Ventes TTC (FCFA)']).font = { bold: true };
    report.categoryReport.forEach(category => category.products.forEach(product => {
      products.addRow([category.name, product.name, product.quantity, product.revenue]);
    }));
    products.columns = [{ width: 28 }, { width: 36 }, { width: 18 }, { width: 24 }];

    const staff = workbook.addWorksheet('Ventes par personnel');
    staff.addRow(['Membre du personnel', 'Commandes', 'Articles', 'Ventes TTC (FCFA)']).font = { bold: true };
    report.userReport.forEach(user => staff.addRow([user.name, user.orders, user.quantity, user.revenue]));
    staff.columns = [{ width: 34 }, { width: 16 }, { width: 16 }, { width: 24 }];

    const expenses = workbook.addWorksheet('Dépenses');
    expenses.addRow(['Date', 'Catégorie', 'Description', 'Fournisseur', 'Mode de paiement', 'Montant (FCFA)', 'Saisi par', 'Articles reçus']).font = { bold: true };
    report.expenses.forEach(expense => expenses.addRow([
      expense.expense_date, expense.category, expense.description, expense.supplier || '',
      expense.payment_method, expense.amount, expense.createdBy?.full_name || '',
      expense.items?.map(item => `${item.quantity} x ${item.product?.name || 'Article'}`).join(', ') || ''
    ]));
    expenses.addRow(['', '', 'Total des dépenses', '', '', report.totalExpenses]).font = { bold: true };
    expenses.addRow(['', '', 'Dont payées en espèces', '', '', report.cashExpenses]).font = { bold: true };
    expenses.columns = [
      { width: 22, style: { numFmt: 'dd/mm/yyyy hh:mm' } }, { width: 24 }, { width: 42 },
      { width: 24 }, { width: 20 }, { width: 20 }, { width: 28 }, { width: 40 }
    ];

    const orders = workbook.addWorksheet('Commandes');
    orders.addRow(['N° commande', 'Date', 'Type', 'Lieu', 'Statut', 'Moyen de paiement', 'Montant (FCFA)', 'Validé par', 'Clôturé par', 'Articles']).font = { bold: true };
    report.orderDetails.forEach(order => orders.addRow([
      order.order_code || order.id, order.closed_at ? new Date(order.closed_at) : null,
      order.order_type || '', order.service_location_label || '', order.status,
      order.payment_method || '', order.total_amount, order.validated_by || 'Client en ligne',
      order.closed_by || '', order.items.map(item => `${item.quantity} x ${item.product_name}`).join(', ')
    ]));
    orders.columns = [
      { width: 24 }, { width: 20, style: { numFmt: 'dd/mm/yyyy hh:mm' } }, { width: 18 },
      { width: 26 }, { width: 16 }, { width: 20 }, { width: 20 }, { width: 28 }, { width: 28 }, { width: 50 }
    ];

    for (const sheet of workbook.worksheets) {
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }
    for (const sheet of [sessions, payments, locations, taxes, products, staff, expenses, orders]) {
      sheet.autoFilter = { from: 'A1', to: sheet.getRow(1).getCell(sheet.columnCount).address };
    }

    const filename = `rapport-caisse-${req.params.period}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Generate cash Excel report error:', error);
    if (error.message === 'Invalid period') return res.status(400).json({ message: 'Invalid period' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark order as paid/delivered
// Mark order as paid and update cash register balance
router.put('/orders/:id/pay', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method } = req.body;

    if (!['cash', 'card', 'mobile_money'].includes(payment_method)) {
      return res.status(400).json({ message: 'Moyen de paiement invalide' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'annulee') {
      return res.status(400).json({ message: 'Cannot pay cancelled order' });
    }
    if (order.closed_at) return res.status(400).json({ message: 'La commande est déjà clôturée' });
    if (!['pending', 'failed'].includes(order.payment_status)) {
      return res.status(400).json({ message: 'Cette commande ne peut pas être encaissée dans son état actuel.' });
    }

    const paymentResult = await prisma.$transaction(async tx => {
      const session = await tx.cashRegisterSession.findFirst({ where: { closed_at: null }, orderBy: { opened_at: 'desc' } });
      if (!session) return { error: 'Aucune session de caisse ouverte. Ouvrez la caisse avant d’encaisser.' };

      const payment = await tx.order.updateMany({
        where: {
          id,
          status: order.status,
          closed_at: null,
          payment_status: order.payment_status
        },
        data: { payment_method, payment_status: 'paid' }
      });
      if (!payment.count) return { error: 'La commande a changé d’état. Actualisez-la avant de réessayer.' };

      const methodField = { cash: 'cash_payments', card: 'card_payments', mobile_money: 'mobile_payments' }[payment_method];
      const sessionUpdate = {
        total_revenue: session.total_revenue == null ? order.total_amount : { increment: order.total_amount }
      };
      if (payment_method === 'cash') sessionUpdate.current_balance = { increment: order.total_amount };
      if (methodField && methodField in session) {
        sessionUpdate[methodField] = session[methodField] == null ? order.total_amount : { increment: order.total_amount };
      }
      const updatedSession = await tx.cashRegisterSession.updateMany({
        where: { id: session.id, closed_at: null },
        data: sessionUpdate
      });
      if (!updatedSession.count) {
        const error = new Error('La session de caisse vient d’être clôturée. Paiement annulé.');
        error.statusCode = 409;
        throw error;
      }
      return { order: await tx.order.findUnique({ where: { id }, include: { items: true } }) };
    });

    if (paymentResult.error) return res.status(409).json({ message: paymentResult.error });
    const updatedOrder = paymentResult.order;
    await awardOrderPoints(prisma, id);

    res.json(updatedOrder);
  } catch (error) {
    console.error('Pay order error:', error);
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/orders/:id/refund', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const refundableOrder = order.status === 'annulee' || Boolean(order.closed_at);
    if (!refundableOrder || order.payment_status !== 'paid') {
      return res.status(400).json({ message: 'Seule une commande annulée ou clôturée et payée peut être remboursée' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { payment_status: 'refunded' }
    });
    await reverseOrderPoints(prisma, id, req.user.id);
    const session = await prisma.cashRegisterSession.findFirst({ where: { closed_at: null } });
    if (session) {
      const refundAmount = order.total_amount;
      const methodField = { cash: 'cash_payments', card: 'card_payments', mobile_money: 'mobile_payments', loyalty_points: 'loyalty_payments' }[order.payment_method];
      const sessionUpdate = {
        total_revenue: (session.total_revenue || 0) - refundAmount
      };
      if (order.payment_method === 'cash') sessionUpdate.current_balance = session.current_balance - refundAmount;
      if (methodField && methodField in session) sessionUpdate[methodField] = (session[methodField] || 0) - refundAmount;
      await prisma.cashRegisterSession.update({ where: { id: session.id }, data: sessionUpdate });
    }
    await prisma.log.create({
      data: {
        user_id: req.user.id,
        role: req.user.role,
        action: 'record_order_refund',
        details: `Refund recorded for order ${id} by user ${req.user.id}`
      }
    }).catch(error => console.warn('Unable to log order refund:', error));

    res.json(updatedOrder);
  } catch (error) {
    console.error('Record order refund error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/orders/:id/deliver', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, user: true }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.closed_at) return res.status(400).json({ message: 'La commande est déjà clôturée' });
    if (order.order_type !== 'livraison') return res.status(400).json({ message: 'Cette commande n’est pas une livraison' });
    if (order.status !== 'en_livraison') return res.status(400).json({ message: 'La commande doit être en livraison' });

    const updatedOrder = await prisma.$transaction(async tx => {
      const updated = await tx.order.update({
        where: { id },
        data: { status: 'livree' },
        include: {
          user: {
            select: { id: true, full_name: true, email: true, phone: true, loyalty_points: true }
          },
          items: true
        }
      });
      await recognizeOrderStockSale(tx, id);
      return updated;
    });

    if (updatedOrder.user_id) {
      await prisma.user.update({
        where: { id: updatedOrder.user_id },
        data: {
          loyalty_points: {
            increment: 5
          }
        }
      });
      // Refresh user data
      updatedOrder.user = await prisma.user.findUnique({
        where: { id: updatedOrder.user_id },
        select: { id: true, full_name: true, email: true, phone: true, loyalty_points: true }
      });
    }

    res.json({
      ...updatedOrder,
      paymentUpdated // Indicate if payment was also processed
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('Deliver order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate the detailed cash register closing report PDF
router.get('/session/close-report', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { sessionId } = req.query;
    let session;
    if (sessionId) {
      session = await prisma.cashRegisterSession.findUnique({ where: { id: Number(sessionId) } });
    } else {
      session = await prisma.cashRegisterSession.findFirst({
        where: { closed_at: { not: null } },
        orderBy: { closed_at: 'desc' }
      });
    }
    if (!session) return res.status(404).json({ message: 'Aucune session de caisse fermée trouvée' });

    const reportEndDate = session.closed_at || new Date();
    const report = await buildSalesReport('session', {
      startDate: session.opened_at,
      endDate: reportEndDate,
      sessionId: session.id,
      includeCashDetails: true
    });
    const filename = `fermeture-caisse-${session.id}-${format(reportEndDate, 'yyyy-MM-dd-HH-mm')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    drawCashReport(doc, report, { title: 'RAPPORT DE FERMETURE DE CAISSE' });
    doc.end();
  } catch (error) {
    console.error('Generate closing report error:', error);
    if (error.message === 'Invalid period') return res.status(400).json({ message: 'Invalid period' });
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
