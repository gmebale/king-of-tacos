const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
const PREPARATION_STATIONS = ['bar', 'cuisine_chaude', 'cuisine_froide'];

function stationForCategory(categoryName) {
  if (categoryName === 'boissons') return 'bar';
  if (categoryName === 'desserts') return 'cuisine_froide';
  return 'cuisine_chaude';
}

function canAccessStation(user, station) {
  if (user.role === 'admin') return true;
  const permissions = user.pagePermissions || {};
  if (station === 'bar') return user.role === 'bar' || permissions.bar === true;
  const permission = station === 'cuisine_chaude' ? 'kitchen_hot' : 'kitchen_cold';
  return permissions[permission] === true || permissions.kitchen === true;
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

// Get active orders and only the items assigned to the selected station.
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const { station } = req.query;
    if (!PREPARATION_STATIONS.includes(station)) {
      return res.status(400).json({ message: 'Poste de préparation invalide' });
    }
    if (!canAccessStation(req.user, station)) {
      return res.status(403).json({ message: 'Accès refusé à ce poste de préparation' });
    }

    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: ['en_attente', 'en_preparation', 'prete']
        },
        closed_at: null
      },
      include: {
        user: {
          select: { id: true, full_name: true, email: true, phone: true }
        },
        items: true
      },
      orderBy: { created_date: 'asc' } // Oldest first for processing
    });

    const productNames = [...new Set(orders.flatMap(order => order.items.map(item => item.product_name)))];
    const products = await prisma.product.findMany({
      where: { name: { in: productNames } },
      include: { category: { select: { name: true } } }
    });
    const productsByName = new Map(products.map(product => [product.name, product]));
    const locationNames = new Map((await prisma.restaurantLocation.findMany({ select: { slug: true, name: true } }))
      .map(location => [location.slug, location.name]));

    for (const order of orders) {
      for (const item of order.items) {
        const product = productsByName.get(item.product_name);
        item.productCustomization = product?.customization || null;
        const isLegacyItem = !item.preparation_station;
        item.preparation_station = item.preparation_station || stationForCategory(product?.category?.name);
        if (order.status === 'prete') item.preparation_status = 'prete';
        else if (isLegacyItem && order.status === 'en_preparation' && item.preparation_status === 'en_attente') item.preparation_status = 'en_preparation';

        // Generate customization summary
        if (item.customization && product?.customization) {
          const customizationInfo = formatCustomization(item.customization, product.customization);
          item.customizationSummary = customizationInfo.formattedText;
        } else {
          item.customizationSummary = '';
        }
      }
      order.items = order.items.filter(item => item.preparation_station === station);
      if (order.service_location) order.service_location_name = locationNames.get(order.service_location) || order.service_location;
    }

    res.json(orders.filter(order => order.items.length > 0));
  } catch (error) {
    console.error('Get kitchen orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Move one item through its preparation steps at the assigned station.
router.put('/orders/:id/items/:itemId/status', authenticateToken, async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { status } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, user: true }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.closed_at || !['en_attente', 'en_preparation', 'prete'].includes(order.status)) {
      return res.status(400).json({ message: 'Cette commande ne peut plus être préparée' });
    }

    const item = order.items.find(entry => entry.id === Number(itemId));
    if (!item) return res.status(404).json({ message: 'Article introuvable dans cette commande' });

    const isLegacyItem = !item.preparation_station;
    let station = item.preparation_station;
    if (!station) {
      const product = await prisma.product.findFirst({
        where: { name: item.product_name },
        include: { category: { select: { name: true } } }
      });
      station = stationForCategory(product?.category?.name);
    }
    if (!canAccessStation(req.user, station)) {
      return res.status(403).json({ message: 'Accès refusé à ce poste de préparation' });
    }

    const currentItemStatus = order.status === 'prete'
      ? 'prete'
      : isLegacyItem && order.status === 'en_preparation' && item.preparation_status === 'en_attente'
        ? 'en_preparation'
        : item.preparation_status;
    const nextStatus = { en_attente: 'en_preparation', en_preparation: 'prete' }[currentItemStatus];
    if (nextStatus !== status) {
      return res.status(400).json({ message: 'Progression invalide pour cet article' });
    }

    await prisma.orderItem.update({
      where: { id: item.id },
      data: { preparation_station: station, preparation_status: status }
    });

    const currentItems = await prisma.orderItem.findMany({ where: { order_id: id } });
    const itemStatuses = currentItems.map(currentItem => {
      if (currentItem.id === item.id) return status;
      if (order.status === 'prete') return 'prete';
      if (!currentItem.preparation_station && order.status === 'en_preparation' && currentItem.preparation_status === 'en_attente') return 'en_preparation';
      return currentItem.preparation_status;
    });
    const nextOrderStatus = itemStatuses.every(itemStatus => itemStatus === 'prete')
      ? 'prete'
      : itemStatuses.some(itemStatus => itemStatus !== 'en_attente')
        ? 'en_preparation'
        : 'en_attente';

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: nextOrderStatus },
      include: {
        user: {
          select: { id: true, full_name: true, email: true, phone: true, loyalty_points: true }
        },
        items: true
      }
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error('Update kitchen order status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get order details for a station with its own item list only.
router.get('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { station } = req.query;
    if (!PREPARATION_STATIONS.includes(station) || !canAccessStation(req.user, station)) {
      return res.status(403).json({ message: 'Accès refusé à ce poste de préparation' });
    }
    const order = await prisma.order.findUnique({
      where: { id },
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

    const products = await prisma.product.findMany({
      where: { name: { in: [...new Set(order.items.map(item => item.product_name))] } },
      include: { category: { select: { name: true } } }
    });
    const productsByName = new Map(products.map(product => [product.name, product]));
    order.items = order.items
      .filter(item => (item.preparation_station || stationForCategory(productsByName.get(item.product_name)?.category?.name)) === station)
      .map(item => ({
        ...item,
        preparation_station: item.preparation_station || stationForCategory(productsByName.get(item.product_name)?.category?.name),
        preparation_status: order.status === 'prete' ? 'prete' : item.preparation_status
      }));
    if (order.service_location) {
      const location = await prisma.restaurantLocation.findUnique({ where: { slug: order.service_location }, select: { name: true } });
      order.service_location_name = location?.name || order.service_location;
    }

    res.json(order);
  } catch (error) {
    console.error('Get kitchen order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
