const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { format } = require('date-fns');

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
      created_date: {
        gte: startDate,
        lte: endDate
      },
      status: {
        in: ['livree', 'en_livraison', 'prete']
      }
    },
    include: {
      items: true,
      user: true
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
  const paymentBreakdown = {
    cash: 0,
    card: 0,
    mobile_money: 0,
    loyalty_points: 0,
    other: 0
  };
  const productSales = {};
  const userSales = {};

  for (const order of orders) {
    const orderItemsTotal = order.items.reduce(
      (sum, item) => sum + (item.price || 0) * item.quantity,
      0
    );
    const orderRevenue = order.total_amount ?? orderItemsTotal;
    totalRevenue += orderRevenue;

    const orderQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    totalItems += orderQuantity;

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
      const product = productMapByName.get(item.product_name);
      const unitPrice = item.price ?? product?.price ?? 0;
      const lineTotal = unitPrice * item.quantity;

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

  return {
    period,
    startDate,
    endDate,
    totalRevenue,
    totalOrders,
    totalItems,
    averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    paymentBreakdown,
    topProducts,
    categoryReport,
    userReport
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

    // Calculate session totals from orders (amounts are stored in centimes)
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
        closed_at: new Date(),
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
        expectedBalance: (session.opening_balance + totalRevenueCents) / 100,
        actualBalance: closing_balance,
        difference: closing_balance - (session.opening_balance + totalRevenueCents)
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
router.get('/reports/:period', authenticateToken, requireRole(['admin']), async (req, res) => {
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
router.get('/reports/:period/pdf', authenticateToken, requireRole(['admin']), async (req, res) => {
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

    doc.end();
  } catch (error) {
    console.error('Generate sales report PDF error:', error);
    if (error.message === 'Invalid period') {
      return res.status(400).json({ message: 'Invalid period' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark order as paid/delivered
// Mark order as paid and update cash register balance
router.put('/orders/:id/pay', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method } = req.body;

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

    // Update order payment method
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { 
        payment_method: payment_method || 'cash',
        status: order.status === 'en_attente' ? 'en_preparation' : order.status
      },
      include: { items: true }
    });

    // Update cash register balance if payment method is cash
    if (payment_method === 'cash' || !payment_method) {
      const session = await prisma.cashRegisterSession.findFirst({
        where: { closed_at: null }
      });

      if (session) {
        await prisma.cashRegisterSession.update({
          where: { id: session.id },
          data: {
            current_balance: session.current_balance + order.total_amount,
            total_revenue: (session.total_revenue || 0) + order.total_amount,
            cash_payments: (session.cash_payments || 0) + order.total_amount
          }
        });
      }
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error('Pay order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

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

    // If order is not already marked as paid, mark it as paid with cash and update cash register
    let paymentUpdated = false;
    if (!order.payment_method) {
      // Mark as paid with cash
      await prisma.order.update({
        where: { id },
        data: { payment_method: 'cash' }
      });

      // Update cash register balance
      const session = await prisma.cashRegisterSession.findFirst({
        where: { closed_at: null }
      });

      if (session) {
        await prisma.cashRegisterSession.update({
          where: { id: session.id },
          data: {
            current_balance: session.current_balance + order.total_amount,
            total_revenue: (session.total_revenue || 0) + order.total_amount,
            cash_payments: (session.cash_payments || 0) + order.total_amount
          }
        });
      }
      paymentUpdated = true;
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

    // If order is marked as ready and user exists, add loyalty points
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
    console.error('Deliver order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Generate cash register closing report PDF
router.get('/session/close-report', authenticateToken, requireRole(['admin']), async (req, res) => {
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
        created_date: {
          gte: session.opened_at,
          lte: reportEndDate
        },
        status: {
          in: ['livree', 'prete']
        }
      },
      include: { items: true }
    });

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
