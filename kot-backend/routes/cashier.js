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
  let startDate;

  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week': {
      const weekStart = now.getDate() - now.getDay();
      startDate = new Date(now.getFullYear(), now.getMonth(), weekStart);
      break;
    }
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
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
  return `${numericAmount.toFixed(2)} FCFA`;
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
async function buildSalesReport(period) {
  const { startDate, endDate } = getPeriodRange(period);

  const orders = await prisma.order.findMany({
    where: {
      closed_at: {
        gte: startDate,
        lte: endDate
      },
      closed_at: { not: null },
      payment_status: 'paid',
      status: { in: ['livree', 'servie', 'recuperee'] }
    },
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

    const userKey = order.user?.id ?? 'guest';
    if (!userSales[userKey]) {
      userSales[userKey] = {
        name: order.user?.full_name || 'Caisse / invité',
        orders: 0,
        quantity: 0,
        revenue: 0
      };
    }
    userSales[userKey].orders += 1;

    for (const item of order.items) {
      const taxQuantity = getOrderItemTaxQuantity(item);
      totalTaxes += Math.round((item.unit_tax_total || 0) * taxQuantity * taxMultiplier);
      const itemTaxes = Array.isArray(item.tax_breakdown) ? item.tax_breakdown : [];
      for (const tax of itemTaxes) {
        const current = taxBreakdown.get(tax.id) || {
          id: tax.id, name: tax.name, percentage: tax.percentage_basis_points / 100, amount: 0
        };
        current.amount += Math.round((tax.amount || 0) * taxQuantity * taxMultiplier);
        taxBreakdown.set(tax.id, current);
      }
      const product = productMapByName.get(item.product_name);
      const unitPrice = item.price ?? product?.price ?? 0;
      const lineTotal = Math.round(unitPrice * getOrderItemTaxQuantity(item) * taxMultiplier);

      userSales[userKey].quantity += item.quantity;
      userSales[userKey].revenue += lineTotal;

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

  return {
    period,
    startDate,
    endDate,
    totalRevenue,
    totalTaxes,
    revenueExcludingTax: totalRevenue - totalTaxes,
    taxBreakdown: [...taxBreakdown.values()].sort((a, b) => b.amount - a.amount),
    totalOrders,
    totalItems,
    averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    paymentBreakdown,
    locationReport,
    topProducts,
    categoryReport,
    userReport,
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
router.post('/session/close', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
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

    // Calculate the session totals from fulfilled, paid orders closed during this session.
    const sessionClosedAt = new Date();
    const orders = await prisma.order.findMany({
      where: {
        closed_at: {
          gte: session.opened_at,
          lte: sessionClosedAt
        },
        payment_status: 'paid',
        status: { in: ['livree', 'servie', 'recuperee'] }
      },
      include: { items: true }
    });

    let totalRevenueCents = 0;
    const paymentMethods = {
      cash: 0,
      card: 0,
      mobile_money: 0,
      loyalty_points: 0
    };

    for (const order of orders) {
      const amount = order.total_amount || 0;
      totalRevenueCents += amount;
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
        total_revenue: totalRevenueCents,
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
        totalRevenue: totalRevenueCents / 100,
        paymentMethods,
        expectedBalance: (session.opening_balance + paymentMethods.cash) / 100,
        actualBalance: closing_balance,
        difference: closing_balance - (session.opening_balance + paymentMethods.cash)
      }
    });
  } catch (error) {
    console.error('Close cash register error:', error);
    res.status(500).json({ message: 'Internal server error' });
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

      const price = product.price; // Convert from centimes to currency
      const itemTotal = item.quantity * price;
      total += itemTotal;

      doc.text(item.product_name, 50, y);
      doc.text(item.quantity.toString(), 300, y);
      doc.text(`${price.toFixed(2)} ${currency}`, 400, y);
      doc.text(`${itemTotal.toFixed(2)} ${currency}`, 480, y);

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
    doc.fontSize(12).text(`Total: ${total.toFixed(2)} ${currency}`, 400, y + 10);

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

// Generate detailed sales report PDF
router.get('/reports/:period/pdf', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { period } = req.params;
    const report = await buildSalesReport(period);

    const filename = `rapport-ventes-${period}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    // Header
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(palette.secondary)
      .text('RAPPORT DE VENTES', { align: 'center' });
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(palette.muted)
      .text(`Période: ${format(report.startDate, 'dd/MM/yyyy')} - ${format(report.endDate, 'dd/MM/yyyy')}`, { align: 'center' })
      .text(`Généré le: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, { align: 'center' });
    doc.moveDown(1);

    // Résumé général
    sectionTitle(doc, 'Résumé général');
    metricRow(doc, "Chiffre d'affaires", formatAmount(report.totalRevenue));
    metricRow(doc, 'Taxes incluses dans les ventes', formatAmount(report.totalTaxes));
    metricRow(doc, 'Ventes hors taxes', formatAmount(report.revenueExcludingTax));
    metricRow(doc, 'Nombre de commandes', report.totalOrders);
    metricRow(doc, "Nombre d'articles vendus", report.totalItems);
    metricRow(doc, 'Panier moyen', formatAmount(report.averageOrderValue));
    doc.moveDown();

    // Paiements
    sectionTitle(doc, 'Répartition par moyen de paiement');
    const paymentLabels = {
      cash: 'Espèces',
      card: 'Carte',
      mobile_money: 'Mobile money',
      loyalty_points: 'Points fidélité',
      other: 'Autres'
    };
    Object.entries(report.paymentBreakdown).forEach(([method, amount]) => {
      pill(doc, paymentLabels[method] || method, palette.primary);
      doc.moveUp(0.8);
      doc.x += 90;
      doc.fontSize(10).fillColor(palette.text).text(formatAmount(amount));
      doc.x = doc.page.margins.left;
      doc.moveDown(0.4);
    });
    doc.moveDown();

    sectionTitle(doc, 'Ventes par lieu');
    if (!report.locationReport.length) {
      doc.fontSize(10).fillColor(palette.muted).text('Aucune vente par lieu sur la période.');
    } else {
      report.locationReport.forEach(location => {
        metricRow(doc, `${location.location} · ${location.orders} commande(s) · ${location.items} article(s)`, formatAmount(location.revenue));
      });
    }
    doc.moveDown();

    sectionTitle(doc, 'Taxes collectées par taux');
    if (!report.taxBreakdown.length) {
      doc.fontSize(10).fillColor(palette.muted).text('Aucune taxe enregistrée sur la période.');
    } else {
      report.taxBreakdown.forEach(tax => metricRow(doc, `${tax.name} (${tax.percentage.toFixed(2)} %)`, formatAmount(tax.amount)));
    }
    doc.moveDown();

    // Utilisateurs
    sectionTitle(doc, 'Ventes par utilisateur');
    if (report.userReport.length === 0) {
      doc.fontSize(10).fillColor(palette.muted).text('Aucune vente sur la période.');
    } else {
      report.userReport.forEach(user => {
        doc
          .fontSize(10)
          .fillColor(palette.text)
          .font('Helvetica-Bold')
          .text(user.name);
        doc.font('Helvetica').fillColor(palette.muted);
        metricRow(doc, 'Commandes', user.orders);
        metricRow(doc, 'Articles', user.quantity);
        metricRow(doc, 'Ventes', formatAmount(user.revenue));
        doc.moveDown(0.6);
      });
    }
    doc.moveDown();

    // Catégories + produits
    sectionTitle(doc, 'Ventes par catégorie et produits');
    report.categoryReport.forEach(category => {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(palette.secondary)
        .text(`${category.name}`);
      doc.font('Helvetica').fillColor(palette.muted);
      metricRow(doc, 'Articles', category.quantity);
      metricRow(doc, 'Ventes', formatAmount(category.revenue));
      if (!category.products || category.products.length === 0) {
        doc.fontSize(9).fillColor(palette.muted).text('Aucune vente pour cette catégorie.', { indent: 12 });
      } else {
        category.products.forEach(product => {
          doc
            .fontSize(9)
            .fillColor(palette.text)
            .text(`• ${product.name}`, { indent: 12 });
          doc.fontSize(9).fillColor(palette.muted);
          metricRow(doc, 'Articles', product.quantity);
          metricRow(doc, 'Ventes', formatAmount(product.revenue));
        });
      }
      doc.moveDown(0.8);
    });

    sectionTitle(doc, 'Traçabilité des commandes clôturées');
    if (!report.orders.length) {
      doc.fontSize(9).fillColor(palette.muted).text('Aucune commande clôturée sur la période.');
    } else {
      report.orders.forEach(order => {
        const code = order.order_code || order.id.slice(-8);
        doc.fontSize(9).fillColor(palette.text)
        .text(`Commande #${code} — ${order.order_type || '—'}${order.service_location ? ` · ${order.service_location_label || order.service_location}` : ''} — ${order.status} — ${formatAmount(order.total_amount)}`);
        doc.fontSize(8).fillColor(palette.muted)
          .text(`Paiement : ${order.payment_method || '—'} (${order.payment_status}) | Validé par : ${order.validated_by || 'Client en ligne'} | Clôturé par : ${order.closed_by || '—'}`);
        doc.moveDown(0.4);
      });
    }

    doc.end();
  } catch (error) {
    console.error('Generate sales report PDF error:', error);
    if (error.message === 'Invalid period') {
      return res.status(400).json({ message: 'Invalid period' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/reports/:period/excel', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const report = await buildSalesReport(req.params.period);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'King of Tacos';
    workbook.created = new Date();

    const summary = workbook.addWorksheet('Synthèse');
    summary.addRows([
      ['Rapport de ventes'],
      ['Période', format(report.startDate, 'dd/MM/yyyy'), format(report.endDate, 'dd/MM/yyyy')],
      ["Chiffre d'affaires (FCFA)", report.totalRevenue],
      ['Taxes incluses (FCFA)', report.totalTaxes],
      ['Ventes hors taxes (FCFA)', report.revenueExcludingTax],
      ['Nombre de commandes', report.totalOrders],
      ["Nombre d'articles vendus", report.totalItems],
      ['Panier moyen (FCFA)', report.averageOrderValue],
      [],
      ['Moyen de paiement', 'Montant (FCFA)'],
      ...Object.entries(report.paymentBreakdown).map(([method, amount]) => [method, amount])
    ]);
    summary.getRow(1).font = { bold: true, size: 16 };
    summary.getRow(10).font = { bold: true };
    summary.columns = [{ width: 32 }, { width: 22 }, { width: 22 }];

    const locations = workbook.addWorksheet('Ventes par lieu');
    locations.addRow(['Lieu', 'Commandes', 'Articles', 'Ventes (FCFA)']).font = { bold: true };
    report.locationReport.forEach(location => locations.addRow([location.location, location.orders, location.items, location.revenue]));
    locations.columns = [{ width: 32 }, { width: 16 }, { width: 16 }, { width: 22 }];

    const taxes = workbook.addWorksheet('Taxes');
    taxes.addRow(['Taux', 'Pourcentage', 'Montant collecté (FCFA)']).font = { bold: true };
    report.taxBreakdown.forEach(tax => taxes.addRow([tax.name, tax.percentage, tax.amount]));
    taxes.columns = [{ width: 32 }, { width: 18 }, { width: 28 }];

    const products = workbook.addWorksheet('Produits');
    products.addRow(['Produit', 'Catégorie', 'Quantité', 'Ventes (FCFA)']).font = { bold: true };
    report.categoryReport.forEach(category => category.products.forEach(product => {
      products.addRow([product.name, category.name, product.quantity, product.revenue]);
    }));
    products.columns = [{ width: 36 }, { width: 24 }, { width: 14 }, { width: 20 }];

    const staff = workbook.addWorksheet('Ventes par utilisateur');
    staff.addRow(['Utilisateur', 'Commandes', 'Articles', 'Ventes (FCFA)']).font = { bold: true };
    report.userReport.forEach(user => staff.addRow([user.name, user.orders, user.quantity, user.revenue]));
    staff.columns = [{ width: 32 }, { width: 14 }, { width: 14 }, { width: 20 }];

    const orders = workbook.addWorksheet('Commandes clôturées');
    orders.addRow(['N° commande', 'Date', 'Type', 'Lieu', 'Statut', 'Moyen de paiement', 'Paiement', 'Montant (FCFA)', 'Validé par', 'Clôturé par']).font = { bold: true };
    report.orders.forEach(order => orders.addRow([
      order.order_code || order.id, order.closed_at ? new Date(order.closed_at) : null,
      order.order_type || '', order.service_location_label || '', order.status,
      order.payment_method || '', order.payment_status, order.total_amount,
      order.validated_by || 'Client en ligne', order.closed_by || ''
    ]));
    orders.columns = [
      { width: 24 }, { width: 20, style: { numFmt: 'dd/mm/yyyy hh:mm' } }, { width: 18 },
      { width: 24 }, { width: 16 }, { width: 20 }, { width: 18 }, { width: 20 }, { width: 28 }, { width: 28 }
    ];
    for (const sheet of [taxes, products, staff, orders]) sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const filename = `rapport-ventes-${req.params.period}-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Generate sales Excel report error:', error);
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

// Generate cash register closing report PDF
router.get('/session/close-report', authenticateToken, requirePagePermission('cashier'), async (req, res) => {
  try {
    const { sessionId } = req.query;

    // Prefer the provided session id, otherwise use the last closed session
    let session;
    if (sessionId) {
      session = await prisma.cashRegisterSession.findUnique({
        where: { id: Number(sessionId) }
      });
    } else {
      session = await prisma.cashRegisterSession.findFirst({
        where: { closed_at: { not: null } },
        orderBy: { closed_at: 'desc' }
      });
    }

    if (!session) {
      return res.status(404).json({ message: 'Aucune session de caisse fermée trouvée' });
    }

    const reportEndDate = session.closed_at || new Date();

    // Fetch orders in the session window
    const orders = await prisma.order.findMany({
      where: {
        closed_at: {
          gte: session.opened_at,
          lte: reportEndDate
        },
        status: { in: ['livree', 'servie', 'recuperee'] },
        payment_status: 'paid'
      },
      include: {
        items: true,
        validatedBy: { select: { full_name: true } },
        closedBy: { select: { full_name: true } }
      }
    });
    const locationNames = new Map((await prisma.restaurantLocation.findMany({ select: { slug: true, name: true } }))
      .map(location => [location.slug, location.name]));

    // Compute payment breakdown from orders (centimes)
    const paymentTotals = {
      cash: 0,
      card: 0,
      mobile_money: 0,
      loyalty_points: 0
    };

    let totalRevenue = 0;
    orders.forEach(order => {
      const amount = order.total_amount || 0;
      totalRevenue += amount;
      const method = order.payment_method || 'cash';
      if (paymentTotals[method] !== undefined) {
        paymentTotals[method] += amount;
      } else {
        paymentTotals.cash += amount;
      }
    });

    const doc = new PDFDocument();
    const filename = `fermeture-caisse-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).text('RAPPORT DE FERMETURE DE CAISSE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Généré le: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, { align: 'center' });
    doc.moveDown(2);

    // Session info
    doc.fontSize(14).text('Informations de la session:');
    doc.fontSize(10);
    doc.text(`Ouverture: ${format(session.opened_at, 'dd/MM/yyyy HH:mm')}`);
    doc.text(`Fermeture: ${session.closed_at ? format(session.closed_at, 'dd/MM/yyyy HH:mm') : 'Non clôturée'}`);
    doc.text(`Solde d'ouverture: ${(session.opening_balance / 100).toFixed(2)} FCFA`);
    if (session.closing_balance !== null && session.closing_balance !== undefined) {
      doc.text(`Solde de clôture: ${(session.closing_balance / 100).toFixed(2)} FCFA`);
    }
    doc.text(`Solde actuel (après clôture): ${(session.current_balance / 100).toFixed(2)} FCFA`);
    doc.moveDown();

    // Summary
    doc.fontSize(14).text('Résumé des ventes:');
    doc.fontSize(10);
    doc.text(`Revenus totaux: ${(totalRevenue / 100).toFixed(2)} FCFA`);
    doc.text(`Paiements en espèces: ${(paymentTotals.cash / 100).toFixed(2)} FCFA`);
    doc.text(`Paiements par carte: ${(paymentTotals.card / 100).toFixed(2)} FCFA`);
    doc.text(`Paiements mobile money: ${(paymentTotals.mobile_money / 100).toFixed(2)} FCFA`);
    doc.text(`Paiements points fidélité: ${(paymentTotals.loyalty_points / 100).toFixed(2)} FCFA`);
    doc.moveDown();

    // Orders summary
    doc.fontSize(14).text('Détail des commandes:');
    doc.moveDown();

    orders.forEach((order, index) => {
      const displayCode = order.order_code || order.id.substring(0, 8);
      doc.fontSize(10).text(
        `${index + 1}. Commande #${displayCode} - ${(order.total_amount / 100).toFixed(2)} FCFA - ${order.payment_method || 'cash'}`
      );
      doc.fontSize(8).text(`Validé par : ${order.validatedBy?.full_name || 'Client en ligne'} | Clôturé par : ${order.closedBy?.full_name || 'Non clôturée'}`);
      if (order.service_location) doc.fontSize(8).text(`Lieu : ${locationNames.get(order.service_location) || order.service_location}${order.table_number ? ` · Table ${order.table_number}` : ''}`);
      order.items.forEach(item => {
        doc.text(`   - ${item.quantity}x ${item.product_name}`, { indent: 20 });
      });
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (error) {
    console.error('Generate closing report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
