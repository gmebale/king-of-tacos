const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, requireRole, requirePagePermission } = require('../middleware/auth');
const { buildTaxSnapshot } = require('../utils/orderItemPricing');
const { recognizeOrderStockSale } = require('../utils/inventory');
const { awardOrderPoints } = require('../utils/loyalty');
const { getOnlineOrderingState } = require('../utils/onlineOrdering');

const router = express.Router();
const prisma = new PrismaClient();

async function attachServiceLocationNames(orders) {
  const locations = await prisma.restaurantLocation.findMany({ select: { slug: true, name: true } });
  const names = new Map(locations.map(location => [location.slug, location.name]));
  const list = Array.isArray(orders) ? orders : [orders];
  for (const order of list) {
    if (order?.service_location) order.service_location_name = names.get(order.service_location) || order.service_location;
  }
  return orders;
}
function getPreparationStation(category) {
  if (category?.preparation_station) return category.preparation_station;
  const categoryName = typeof category === 'string' ? category : category?.name;
  if (categoryName === 'boissons') return 'bar';
  if (categoryName === 'desserts') return 'cuisine_froide';
  return 'cuisine_chaude';
}

function calculatePromoDiscount(promo, amount, orderType, totalAmount = amount) {
  if (promo.type === 'percentage') return Math.min(amount, Math.round(amount * promo.value / 100));
  if (promo.type === 'fixed_amount') return Math.min(amount, promo.value);
  if (promo.type === 'free_delivery') return orderType === 'livraison' ? Math.min(totalAmount, 2000) : 0;
  return 0;
}

async function buildOrderItems(items, { giftedProductId = null } = {}) {
  const productIds = [...new Set(items.map(item => Number(item.product_id)).filter(id => Number.isInteger(id) && id > 0))];
  const names = [...new Set(items.map(item => item.product_name).filter(Boolean))];
  const products = await prisma.product.findMany({
    where: { OR: [
      ...(productIds.length ? [{ id: { in: productIds } }] : []),
      ...(names.length ? [{ name: { in: names } }] : [])
    ] },
    include: {
      category: { select: { name: true, preparation_station: true } },
      taxRates: { include: { taxRate: true } }
    }
  });
  const productByName = new Map(products.map(product => [product.name, product]));
  const productById = new Map(products.map(product => [product.id, product]));
  const configuredProductIds = products.map(product => product.id);
  const [legacyOptions, legacyRules] = configuredProductIds.length ? await Promise.all([
    prisma.productOption.findMany({ where: { productId: { in: configuredProductIds } }, include: { optionProduct: { select: { id: true, name: true, price: true, available: true } } } }),
    prisma.productCustomizationRule.findMany({ where: { productId: { in: configuredProductIds } } })
  ]) : [[], []];
  const legacyGroupsByProduct = new Map();
  for (const option of legacyOptions) {
    if (!legacyGroupsByProduct.has(option.productId)) legacyGroupsByProduct.set(option.productId, new Map());
    const groups = legacyGroupsByProduct.get(option.productId);
    if (!groups.has(option.optionType)) groups.set(option.optionType, []);
    groups.get(option.optionType).push({
      id: String(option.optionProduct.id),
      productId: option.optionProduct.id,
      name: option.optionProduct.name,
      priceModifier: option.optionProduct.price,
      available: option.optionProduct.available,
      required: option.required,
      maxQuantity: option.maxQuantity
    });
  }
  const legacyRulesByProduct = new Map();
  for (const rule of legacyRules) {
    if (!legacyRulesByProduct.has(rule.productId)) legacyRulesByProduct.set(rule.productId, []);
    legacyRulesByProduct.get(rule.productId).push(rule);
  }
  for (const [productId, groups] of legacyGroupsByProduct) {
    for (const [groupId, optionsForGroup] of groups) {
      const rule = legacyRulesByProduct.get(productId)?.find(item => item.optionType === groupId && !item.sizeOptionId);
      groups.set(groupId, {
        id: groupId,
        name: ({ size: 'Taille', meat: 'Viandes', sauce: 'Sauces', extra: 'Suppléments', side: 'Accompagnements', 'goût': 'Goûts' })[groupId] || groupId,
        type: optionsForGroup.some(option => option.required && option.maxQuantity === 1) ? 'single' : 'multiple',
        required: optionsForGroup.some(option => option.required),
        minSelections: optionsForGroup.some(option => option.required) ? 1 : 0,
        maxSelections: rule?.maxQuantity ?? optionsForGroup.reduce((minimum, option) => option.maxQuantity == null ? minimum : Math.min(minimum, option.maxQuantity), Infinity),
        includedCount: rule?.includedCount || 0,
        extraPrice: rule?.extraPrice || 0,
        options: optionsForGroup
      });
      const normalized = groups.get(groupId);
      if (!Number.isFinite(normalized.maxSelections)) normalized.maxSelections = null;
    }
  }
  const customizationGroups = product => Array.isArray(product.customization?.optionGroups) && product.customization.optionGroups.length
    ? product.customization.optionGroups
    : [...(legacyGroupsByProduct.get(product.id)?.values() || [])];
  const optionProductIds = [...new Set(products.flatMap(product =>
    customizationGroups(product).flatMap(group => group.options || []).map(option => Number(option.productId)).filter(id => Number.isInteger(id) && id > 0)
  ))];
  const availableOptionRows = optionProductIds.length
    ? await prisma.product.findMany({ where: { id: { in: optionProductIds }, available: true }, select: { id: true } })
    : [];
  const availableOptionIds = new Set(availableOptionRows.map(option => option.id));

  return items.map(item => {
    const requestedProductId = Number(item.product_id);
    const product = (Number.isInteger(requestedProductId) && requestedProductId > 0
      ? productById.get(requestedProductId)
      : null) || productByName.get(item.product_name);
    const quantity = Number(item.quantity);
    if (!product) throw Object.assign(new Error(`Produit introuvable : ${item.product_name || item.product_id}`), { statusCode: 400 });
    if (!product.available || product.type === 'modifier') throw Object.assign(new Error(`${product.name} n’est plus disponible.`), { statusCode: 409 });
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw Object.assign(new Error('Quantité de produit invalide.'), { statusCode: 400 });

    let price = Math.round(product.price * (1 - (product.discount_percentage || 0) / 100));
    const optionGroups = customizationGroups(product);
    if (['configurable', 'combo'].includes(product.type) && optionGroups.length === 0) throw Object.assign(new Error(`${product.name} n’a pas encore ses choix configurés.`), { statusCode: 409 });
    const selection = item.customization && typeof item.customization === 'object' ? item.customization : {};
    let generatedSummary = '';
    const inventoryComponentQuantities = new Map();

    if (optionGroups.length) {
      const knownGroupIds = new Set(optionGroups.map(group => String(group.id)));
      if (Object.keys(selection).some(groupId => !knownGroupIds.has(String(groupId)))) {
        throw Object.assign(new Error(`Choix inconnus pour ${product.name}.`), { statusCode: 400 });
      }
      const summaryParts = [];
      for (const group of optionGroups) {
        const raw = selection[group.id];
        const chosenIds = group.type === 'single'
          ? (raw == null || raw === '' ? [] : [String(raw)])
          : Array.isArray(raw) ? raw.map(String) : [];
        const min = Math.max(0, Number(group.minSelections ?? (group.required ? 1 : 0)) || 0);
        const max = group.type === 'single' ? 1 : (group.maxSelections ?? group.maxQuantity ?? null);
        if (chosenIds.length < min || (max != null && chosenIds.length > Number(max))) {
          throw Object.assign(new Error(`Vérifiez les choix du groupe « ${group.name} » pour ${product.name}.`), { statusCode: 400 });
        }
        if (new Set(chosenIds).size !== chosenIds.length) throw Object.assign(new Error(`Un choix est dupliqué dans « ${group.name} ».`), { statusCode: 400 });
        const chosenOptions = chosenIds.map(id => group.options?.find(option => String(option.id ?? option.productId) === id));
        if (chosenOptions.some(option => !option)) throw Object.assign(new Error(`Option indisponible dans « ${group.name} ».`), { statusCode: 400 });
        if (chosenOptions.some(option => option.productId && !availableOptionIds.has(Number(option.productId)))) throw Object.assign(new Error(`Un choix de « ${group.name} » n’est plus disponible.`), { statusCode: 409 });

        chosenOptions.forEach((option, index) => {
          const componentId = Number(option.productId);
          if (Number.isInteger(componentId) && componentId > 0) {
            inventoryComponentQuantities.set(componentId, (inventoryComponentQuantities.get(componentId) || 0) + 1);
          }
          if (group.type === 'multiple' && Number(group.includedCount) > 0 && index < Number(group.includedCount)) return;
          const modifier = group.type === 'multiple' && Number(group.includedCount) > 0 && Number(group.extraPrice) > 0
            ? Number(group.extraPrice)
            : Number(option.priceModifier ?? option.price) || 0;
          if (!Number.isFinite(modifier) || modifier < 0) throw Object.assign(new Error('Supplément de personnalisation invalide.'), { statusCode: 400 });
          price += Math.round(modifier);
        });
        if (chosenOptions.length) summaryParts.push(`${group.name}: ${chosenOptions.map(option => option.name).join(', ')}`);
      }
      generatedSummary = summaryParts.join(' · ');
      const submittedPrice = Number(item.price);
      if (!Number.isFinite(submittedPrice) || Math.round(submittedPrice) !== price) {
        throw Object.assign(new Error(`Le prix de ${product.name} a changé. Actualisez le panier avant de valider.`), { statusCode: 409 });
      }
    }

    const tax = buildTaxSnapshot(price, product);
    return {
      product_id: product.id,
      inventory_components: [...inventoryComponentQuantities].map(([product_id, component_quantity]) => ({ product_id, quantity: component_quantity })),
      product_name: product.name,
      quantity,
      price,
      unit_tax_base: tax.unitTaxBase,
      unit_tax_total: tax.unitTaxTotal,
      tax_breakdown: tax.breakdown,
      unit_loyalty_points: product?.loyalty_points || 0,
      free_quantity: product?.id === giftedProductId ? 1 : 0,
      customization: item.customization || null,
      customizationSummary: generatedSummary || item.customizationSummary || null,
      preparation_station: getPreparationStation(product.category),
      preparation_status: 'en_attente'
    };
  });
}

async function generateOrderCode() {
  const now = new Date();
  const datePart = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('');

  const sequence = await prisma.orderCodeSequence.upsert({
    where: { date: datePart },
    update: { counter: { increment: 1 } },
    create: { date: datePart, counter: 1 }
  });

  let counter = sequence.counter;
  let code = `KOT-${datePart}-${String(counter).padStart(4, '0')}`;

  // Protect against an existing order code if the sequence table was reset.
  while (await prisma.order.findUnique({ where: { order_code: code }, select: { id: true } })) {
    const nextSequence = await prisma.orderCodeSequence.update({
      where: { date: datePart },
      data: { counter: { increment: 1 } }
    });
    counter = nextSequence.counter;
    code = `KOT-${datePart}-${String(counter).padStart(4, '0')}`;
  }

  return code;
}

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

// Get all orders (admin/staff only)
router.get('/', authenticateToken, requirePagePermission('orders', 'dashboard'), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: { id: true, full_name: true, email: true }
        },
        validatedBy: { select: { id: true, full_name: true, role: true } },
        closedBy: { select: { id: true, full_name: true, role: true } },
        cancellation: { include: { reason: true, cancelledBy: { select: { id: true, full_name: true, role: true } } } },
        items: true
      },
      orderBy: { created_date: 'desc' }
    });

    // Add product customization config to each item
    for (const order of orders) {
      for (const item of order.items) {
        const product = await prisma.product.findFirst({
          where: { name: item.product_name },
          select: { customization: true }
        });
        item.productCustomization = product?.customization || null;
        
        // Generate customization summary
        if (item.customization && product?.customization) {
          const customizationInfo = formatCustomization(item.customization, product.customization);
          item.customizationSummary = customizationInfo.formattedText;
        } else {
          item.customizationSummary = '';
        }
      }
    }

    res.json(await attachServiceLocationNames(orders));
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's orders
router.get('/my-orders', authenticateToken, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { user_id: req.user.id },
      include: {
        items: true,
        cancellation: { include: { reason: true } },
        reviews: { where: { user_id: req.user.id }, select: { id: true, status: true } }
      },
      orderBy: { created_date: 'desc' }
    });

    // Add product customization config to each item
    for (const order of orders) {
      for (const item of order.items) {
        const product = await prisma.product.findFirst({
          where: { name: item.product_name },
          select: { customization: true }
        });
        item.productCustomization = product?.customization || null;
        
        // Generate customization summary
        if (item.customization && product?.customization) {
          const customizationInfo = formatCustomization(item.customization, product.customization);
          item.customizationSummary = customizationInfo.formattedText;
        } else {
          item.customizationSummary = '';
        }
      }
    }

    res.json(await attachServiceLocationNames(orders));
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/cancellation-reasons', authenticateToken, async (_req, res) => {
  try {
    const reasons = await prisma.orderCancellationReason.findMany({
      where: { is_active: true },
      orderBy: [{ display_order: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, label: true }
    });
    res.json(reasons);
  } catch (error) {
    console.error('Get order cancellation reasons error:', error);
    res.status(500).json({ message: 'Impossible de charger les motifs d’annulation.' });
  }
});

// Get order by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, full_name: true, email: true }
        },
        validatedBy: { select: { id: true, full_name: true, role: true } },
        closedBy: { select: { id: true, full_name: true, role: true } },
        cancellation: { include: { reason: true, cancelledBy: { select: { id: true, full_name: true, role: true } } } },
        items: true
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user owns the order or is admin/staff
    if (order.user_id !== req.user.id && !['admin', 'staff'].includes(req.user.role) && req.user.pagePermissions?.orders !== true) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add product customization config to each item
    for (const item of order.items) {
      const product = await prisma.product.findFirst({
        where: { name: item.product_name },
        select: { customization: true }
      });
      item.productCustomization = product?.customization || null;
    }

    res.json(await attachServiceLocationNames(order));
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create order (allows guest orders)
router.post('/staff', authenticateToken, requireRole(['serveur']), async (req, res) => {
  try {
    const cashSession = await prisma.cashRegisterSession.findFirst({
      where: { closed_at: null },
      orderBy: { opened_at: 'desc' },
      select: { id: true }
    });
    if (!cashSession) {
      return res.status(409).json({ message: 'La caisse doit être ouverte pour prendre une commande au comptoir.' });
    }

    const {
      items, total_amount, customer_name, customer_phone, customer_email,
      order_type, table_number, service_location, delivery_address, pickup_time, notes,
      payment_method, server_code, loyalty_customer_id
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'La commande doit contenir au moins un produit' });
    }
    const orderItems = await buildOrderItems(items);
    const calculatedTotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (calculatedTotal !== Number(total_amount)) return res.status(409).json({ message: 'Le total du panier a changé. Actualisez-le avant de valider.' });
    if (!['sur_place', 'emporter'].includes(order_type)) {
      return res.status(400).json({ message: 'Type de commande du personnel invalide' });
    }
    if (order_type === 'sur_place' && !table_number) {
      return res.status(400).json({ message: 'Le numéro de table est requis pour une commande sur place' });
    }
    const selectedLocation = order_type === 'sur_place' && service_location
      ? await prisma.restaurantLocation.findFirst({ where: { slug: service_location, active: true } })
      : null;
    if (order_type === 'sur_place' && !selectedLocation) {
      return res.status(400).json({ message: 'Le lieu de service est requis pour une commande sur place' });
    }
    if (order_type === 'emporter' && !customer_name) {
      return res.status(400).json({ message: 'Le nom ou numéro de retrait est requis pour une commande à emporter' });
    }
    if (!Number.isFinite(Number(total_amount)) || Number(total_amount) < 0) {
      return res.status(400).json({ message: 'Montant total invalide' });
    }
    if (!['cash', 'card', 'mobile_money'].includes(payment_method)) {
      return res.status(400).json({ message: 'Moyen de paiement invalide' });
    }
    if (!/^[a-z0-9]{6}$/i.test(server_code || '') || !req.user.server_pin_hash) {
      return res.status(401).json({ message: 'Code serveur invalide ou non configuré' });
    }

    const codeMatches = await bcrypt.compare(server_code.toUpperCase(), req.user.server_pin_hash);
    if (!codeMatches) {
      return res.status(401).json({ message: 'Code serveur incorrect' });
    }

    const orderCode = await generateOrderCode();
    let loyaltyUserId = null;
    if (loyalty_customer_id) {
      const matchedCustomer = await prisma.user.findFirst({
        where: { id: Number(loyalty_customer_id), is_active: true, AND: [
          { OR: [{ role: 'client', role_id: null }, { roleRef: { is: { slug: 'client' } } }] },
          { OR: [{ email: customer_email || '' }, { phone: customer_phone || '' }] }
        ] },
        select: { id: true }
      });
      if (!matchedCustomer) return res.status(400).json({ message: 'Le compte fidélité ne correspond pas aux coordonnées du client.' });
      loyaltyUserId = matchedCustomer.id;
    }
    const order = await prisma.order.create({
      data: {
        order_code: orderCode,
        user_id: loyaltyUserId,
        total_amount: parseInt(total_amount, 10),
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        order_type,
        service_location: order_type === 'sur_place' ? service_location : null,
        table_number: order_type === 'sur_place' ? table_number : null,
        delivery_address: delivery_address || null,
        pickup_time: pickup_time || null,
        notes: notes || null,
        payment_method,
        validated_by: req.user.id,
        cash_register_session_id: cashSession.id,
        validated_at: new Date(),
        status: 'en_preparation',
        items: {
          create: orderItems
        }
      },
      include: { items: true }
    });

    res.status(201).json(order);
  } catch (error) {
    console.error('Create staff order error:', error);
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { items, total_amount, pre_discount_total, pre_discount_subtotal, promo_code, gifted_redemption_id, customer_name, customer_phone, customer_email, order_type, delivery_address, pickup_time, notes, payment_method } = req.body;

    if (payment_method && payment_method !== 'mobile_money') {
      return res.status(400).json({ message: 'Moyen de paiement en ligne invalide.' });
    }
    if (payment_method === 'mobile_money' && process.env.EBILLING_ENABLED !== 'true') {
      return res.status(503).json({ message: 'Le paiement Mobile Money en ligne est momentanément indisponible.' });
    }

    const orderingConfig = await prisma.settings.findUnique({ where: { key: 'online_ordering_config' }, select: { value: true } });
    const orderingState = getOnlineOrderingState(orderingConfig?.value);
    let acceptedPickupTime = pickup_time || null;
    if (orderingState.configured) {
      if (!orderingState.enabled) {
        return res.status(503).json({ message: 'Les commandes en ligne sont temporairement suspendues.' });
      }
      if (!orderingState.accepting_now) {
        if (orderingState.mode !== 'next_opening' || !orderingState.next_opening_at) {
          return res.status(403).json({ message: 'Les commandes en ligne sont fermées pour le moment.', next_opening_at: orderingState.next_opening_at });
        }
        acceptedPickupTime = orderingState.next_opening_at;
      }
    }

    if (order_type === 'sur_place') {
      return res.status(403).json({ message: 'Les commandes sur place doivent être saisies par un serveur' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'La commande doit contenir au moins un produit' });
    }

    console.log('Received order data:', { items, total_amount, customer_name });

    // Check if user is authenticated
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let userId = null;

    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId }
        });
        if (user) {
          userId = user.id;
        }
      } catch (error) {
        // Invalid token, treat as guest
      }
    }

    const orderItems = await buildOrderItems(items);
    const promoBasis = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = order_type === 'livraison' ? 2000 : 0;
    const baseTotal = promoBasis + deliveryFee;
    if (!Number.isFinite(baseTotal) || baseTotal < 0) return res.status(400).json({ message: 'Montant de commande invalide' });
    if (promo_code && gifted_redemption_id) return res.status(400).json({ message: 'Un seul avantage peut être utilisé par commande.' });
    let promo = null;
    let loyaltyRedemption = null;
    let discountAmount = 0;
    if (promo_code) {
      promo = await prisma.promoCode.findUnique({ where: { code: String(promo_code).toUpperCase() } });
      if (!promo || !promo.is_active || (promo.expires_at && promo.expires_at <= new Date()) || (promo.max_uses != null && promo.used_count >= promo.max_uses)) {
        return res.status(400).json({ message: 'Ce code promo est invalide, expiré ou déjà utilisé.' });
      }
      if (promo.user_id && promo.user_id !== userId) return res.status(403).json({ message: 'Ce code promo est réservé à son bénéficiaire.' });
      if (promo.min_order_amount && promoBasis < promo.min_order_amount) return res.status(400).json({ message: 'Le montant minimum requis pour ce code promo n’est pas atteint.' });
      discountAmount = calculatePromoDiscount(promo, promoBasis, order_type, baseTotal);
      if (!discountAmount) return res.status(400).json({ message: 'Ce code promo ne s’applique pas à cette commande.' });
      if (promo.user_id) {
        loyaltyRedemption = await prisma.loyaltyRedemption.findFirst({ where: { promo_code_id: promo.id, user_id: userId, status: 'claimed' } });
        if (!loyaltyRedemption) return res.status(400).json({ message: 'Cette récompense a déjà été utilisée.' });
      }
    }
    if (gifted_redemption_id) {
      if (!userId) return res.status(401).json({ message: 'Connectez-vous pour utiliser cette récompense.' });
      loyaltyRedemption = await prisma.loyaltyRedemption.findFirst({ where: { id: gifted_redemption_id, user_id: userId, status: 'claimed', expires_at: { gt: new Date() } }, include: { reward: true } });
      if (!loyaltyRedemption || loyaltyRedemption.reward.type !== 'gifted_product') return res.status(400).json({ message: 'Cette récompense produit n’est plus disponible.' });
      const matchingLine = orderItems.find(item => item.product_id === loyaltyRedemption.reward.gifted_product_id && item.quantity > item.free_quantity);
      if (!matchingLine) return res.status(400).json({ message: 'Ajoutez le produit offert à votre panier pour utiliser cette récompense.' });
      discountAmount = Math.max(0, matchingLine.price);
      matchingLine.free_quantity += 1;
    }
    const finalTotal = Math.max(0, baseTotal - discountAmount);
    if (!Number.isInteger(Number(total_amount)) || Number(total_amount) !== finalTotal) {
      return res.status(409).json({ message: 'Le total de la commande a changé. Revenez au panier pour actualiser les prix.' });
    }

    // Create order
    const orderCode = await generateOrderCode();
    const order = await prisma.order.create({
      data: {
        order_code: orderCode,
        user_id: userId,
        total_amount: finalTotal,
        discount_amount: discountAmount,
        promo_code_id: promo?.id || null,
        loyalty_redemption_id: loyaltyRedemption?.id || null,
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        service_location: null,
        delivery_address,
        pickup_time: acceptedPickupTime,
        notes,
        payment_method: payment_method || null,
        items: {
          create: orderItems
        }
      },
      include: {
        items: true
      }
    });

    if (promo) {
      const consumed = await prisma.promoCode.updateMany({
        where: { id: promo.id, is_active: true, used_count: promo.used_count },
        data: { used_count: { increment: 1 } }
      });
      if (!consumed.count) {
        await prisma.order.delete({ where: { id: order.id } });
        return res.status(409).json({ message: 'Ce code promo vient d’être utilisé.' });
      }
    }
    if (loyaltyRedemption) await prisma.loyaltyRedemption.update({ where: { id: loyaltyRedemption.id }, data: { status: 'used' } });

    console.log('Created order:', order.id, 'with items:', order.items.length);

    res.status(201).json({
      ...order,
      ...(payment_method === 'mobile_money' ? {
        payment_status_token: jwt.sign(
          { orderId: order.id },
          process.env.JWT_SECRET,
          { expiresIn: '24h', audience: 'ebilling-payment' }
        )
      } : {})
    });
  } catch (error) {
    console.error('Create order error:', error);
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const reasonId = Number(req.body.reasonId);
    const reasonText = typeof req.body.reasonText === 'string' ? req.body.reasonText.trim() : '';
    if (!Number.isInteger(reasonId) || reasonId <= 0) {
      return res.status(400).json({ message: 'Choisissez un motif d’annulation.' });
    }

    const reason = await prisma.orderCancellationReason.findFirst({ where: { id: reasonId, is_active: true } });
    if (!reason) return res.status(400).json({ message: 'Ce motif d’annulation n’est plus disponible.' });
    if (reason.code === 'other' && (reasonText.length < 3 || reasonText.length > 500)) {
      return res.status(400).json({ message: 'Précisez le motif en 3 à 500 caractères.' });
    }
    if (reason.code !== 'other' && reasonText.length > 500) {
      return res.status(400).json({ message: 'Le complément du motif ne peut pas dépasser 500 caractères.' });
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ message: 'Commande introuvable.' });
    const isAdminOrStaff = ['admin', 'staff'].includes(req.user.role) || req.user.pagePermissions?.orders === true;
    const isOwner = order.user_id === req.user.id;
    if (!isAdminOrStaff && !isOwner) return res.status(403).json({ message: 'Accès refusé.' });
    if (order.closed_at || !['en_attente', 'en_preparation', 'prete', 'en_livraison'].includes(order.status)) {
      return res.status(409).json({ message: 'Cette commande ne peut plus être annulée.' });
    }
    if (!isAdminOrStaff && order.status !== 'en_attente') {
      return res.status(409).json({ message: 'Vous ne pouvez annuler que les commandes encore en attente.' });
    }
    if (!isAdminOrStaff && order.payment_status === 'paid') {
      return res.status(409).json({ message: 'Cette commande est déjà payée. Contactez le restaurant pour demander son annulation.' });
    }

    const cancellation = await prisma.$transaction(async tx => {
      const updated = await tx.order.updateMany({
        where: {
          id,
          status: order.status,
          closed_at: null,
          ...(isAdminOrStaff ? {} : { payment_status: { not: 'paid' } })
        },
        data: { status: 'annulee' }
      });
      if (!updated.count) throw Object.assign(new Error('La commande a changé d’état. Actualisez la page avant de réessayer.'), { statusCode: 409 });

      const record = await tx.orderCancellation.create({
        data: {
          order_id: id,
          reason_id: reason.id,
          reason_text: reasonText || null,
          cancelled_by_user_id: req.user.id,
          actor_role: req.user.role || 'client'
        }
      });
      await tx.log.create({
        data: {
          user_id: req.user.id,
          role: req.user.role || 'client',
          action: 'cancel_order',
          details: `Commande ${order.order_code || id} annulée. Motif : ${reason.label}${reasonText ? ` — ${reasonText}` : ''}`
        }
      });
      return record;
    });

    res.json({
      status: 'annulee',
      cancellation: {
        ...cancellation,
        reason,
        cancelledBy: { id: req.user.id, full_name: req.user.full_name, role: req.user.role }
      },
      refundRequired: order.payment_status === 'paid'
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    if (error.code === 'P2002') return res.status(409).json({ message: 'Cette commande possède déjà un motif d’annulation.' });
    console.error('Cancel order error:', error);
    res.status(500).json({ message: 'Impossible d’annuler la commande.' });
  }
});

// Update order (users can update their own orders if en_attente, admins/staff can update status)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, items, total_amount, customer_name, customer_phone, customer_email, order_type, delivery_address, pickup_time, notes, payment_method } = req.body;

    // Get the order first
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.closed_at) {
      return res.status(400).json({ message: 'Une commande clôturée ne peut plus être modifiée' });
    }

    if (status === 'cloturee') {
      return res.status(400).json({ message: 'Utilisez la procédure de clôture de caisse pour clôturer une commande' });
    }
    if (status === 'annulee') {
      return res.status(400).json({ message: 'Utilisez la procédure d’annulation avec motif.' });
    }

    if (status && status !== order.status) {
      const allowedTransitions = {
        en_attente: ['en_preparation'],
        en_preparation: ['prete', 'en_livraison'],
        prete: ['servie', 'recuperee'],
        en_livraison: ['livree']
      };
      if (!allowedTransitions[order.status]?.includes(status)) {
        return res.status(400).json({ message: `Transition de commande invalide : ${order.status} → ${status}` });
      }
    }

    // Check permissions
    const isOwner = order.user_id === req.user.id;
    const isAdminOrStaff = ['admin', 'staff'].includes(req.user.role) || req.user.pagePermissions?.orders === true;

    if (!isOwner && !isAdminOrStaff) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // If user is updating their own order, check if it's still en_attente
    if (isOwner && !isAdminOrStaff && order.status !== 'en_attente') {
      return res.status(400).json({ message: 'Cannot modify order that has already been processed' });
    }

    // Prepare update data
    let updateData = {};

    if (isAdminOrStaff) {
      // Admins/staff can update status and payment method
      if (status) {
        updateData.status = status;
      }
      if (payment_method !== undefined) {
        updateData.payment_method = payment_method;
      }
    } else {
      // Users can update everything if en_attente
      if (status) updateData.status = status;
      if (total_amount !== undefined) updateData.total_amount = parseInt(total_amount);
      if (customer_name !== undefined) updateData.customer_name = customer_name;
      if (customer_phone !== undefined) updateData.customer_phone = customer_phone;
      if (customer_email !== undefined) updateData.customer_email = customer_email;
      if (order_type !== undefined) updateData.order_type = order_type;
      if (delivery_address !== undefined) updateData.delivery_address = delivery_address;
      if (pickup_time !== undefined) updateData.pickup_time = pickup_time;
      if (notes !== undefined) updateData.notes = notes;

      // Update items if provided
      if (items) {
        // Delete existing items
        await prisma.orderItem.deleteMany({
          where: { order_id: id }
        });
        // Create new items
        updateData.items = {
          create: await buildOrderItems(items)
        };
      }
    }

    const updatedOrder = await prisma.$transaction(async tx => {
      const updated = await tx.order.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: { id: true, full_name: true, email: true, loyalty_points: true }
          },
          items: true
        }
      });
      if (status && ['livree', 'servie', 'recuperee'].includes(status)) {
        await recognizeOrderStockSale(tx, id);
      }
      return updated;
    });

    // Log status change when admin/staff update status
    if (isAdminOrStaff && status) {
      try {
        await prisma.log.create({
          data: {
            user_id: req.user.id,
            role: req.user.role,
            action: `update_status_${status}`,
            details: `Order ${id} status changed to ${status} by user ${req.user.id}`
          }
        });
      } catch (logErr) {
        console.warn('Unable to create log for status update:', logErr);
      }
    }

    res.json(updatedOrder);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Order not found' });
    }
    console.error('Update order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Validate order (serveurs only for on-site orders)
router.post('/:id/validate', authenticateToken, requireRole(['serveur','admin','manager']), async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Only on-site orders should be validated by a server, admins/managers can override
    if (order.order_type !== 'sur_place' && !['admin','manager'].includes(req.user.role)) {
      return res.status(400).json({ message: 'Seules les commandes sur place peuvent être validées par un serveur' });
    }

    if (order.closed_at) {
      return res.status(400).json({ message: 'Order already closed' });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        validated_by: req.user.id,
        validated_at: new Date(),
        status: 'en_preparation'
      }
    });
    // Log the validation
    try {
      await prisma.log.create({
        data: {
          user_id: req.user.id,
          role: req.user.role,
          action: 'validate_order',
          details: `Order ${id} validated by user ${req.user.id}`
        }
      });
    } catch (logErr) {
      console.warn('Unable to create log for order validation:', logErr);
    }

    res.json(updated);
  } catch (error) {
    console.error('Validate order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Close order (caissier closes in cash register)
router.post('/:id/close', authenticateToken, requireRole(['caissier','admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.closed_at) {
      return res.status(400).json({ message: 'Order already closed' });
    }

    if (order.status === 'annulee') {
      if (order.payment_status === 'paid') {
        return res.status(400).json({ message: 'Une commande annulée déjà payée doit être remboursée avant clôture' });
      }
    } else {
      if (!['servie', 'recuperee', 'livree'].includes(order.status)) {
        return res.status(400).json({ message: 'La commande doit être servie, récupérée ou livrée avant clôture' });
      }
    }

    const updated = await prisma.$transaction(async tx => {
      if (order.status !== 'annulee') await recognizeOrderStockSale(tx, id);
      return tx.order.update({
        where: { id },
        data: {
          closed_by: req.user.id,
          closed_at: new Date()
        }
      });
    });
    await awardOrderPoints(prisma, id);

    // Log the closure
    try {
      await prisma.log.create({
        data: {
          user_id: req.user.id,
          role: req.user.role,
          action: 'close_order',
          details: `Order ${id} closed by user ${req.user.id}`
        }
      });
    } catch (logErr) {
      console.warn('Unable to create log for order closure:', logErr);
    }

    res.json(updated);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('Close order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete order (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.closed_at) return res.status(400).json({ message: 'Une commande clôturée ne peut pas être supprimée' });

    await prisma.order.delete({
      where: { id }
    });

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Order not found' });
    }
    console.error('Delete order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Filter orders (admin/staff only)
router.get('/filter', authenticateToken, requirePagePermission('orders', 'dashboard'), async (req, res) => {
  try {
    const { status, user_id, date_from, date_to } = req.query;

    let where = {};

    if (status) {
      where.status = status;
    }

    if (user_id) {
      where.user_id = parseInt(user_id);
    }

    if (date_from || date_to) {
      where.created_date = {};
      if (date_from) {
        where.created_date.gte = new Date(date_from);
      }
      if (date_to) {
        where.created_date.lte = new Date(date_to);
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: { id: true, full_name: true, email: true }
        },
        validatedBy: { select: { id: true, full_name: true, role: true } },
        closedBy: { select: { id: true, full_name: true, role: true } },
        items: true
      },
      orderBy: { created_date: 'desc' }
    });

    res.json(orders);
  } catch (error) {
    console.error('Filter orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
