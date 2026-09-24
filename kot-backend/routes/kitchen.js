const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

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

// Get orders for kitchen view (staff and admin only)
router.get('/orders', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: ['en_attente', 'en_preparation', 'prete']
        }
      },
      include: {
        user: {
          select: { id: true, full_name: true, email: true, phone: true }
        },
        items: true
      },
      orderBy: { created_date: 'asc' } // Oldest first for processing
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

    res.json(orders);
  } catch (error) {
    console.error('Get kitchen orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update order status (kitchen mode)
router.put('/orders/:id/status', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status for kitchen
    const allowedStatuses = ['en_preparation', 'prete'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status for kitchen mode' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, user: true }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only allow status progression
    const statusOrder = ['en_attente', 'en_preparation', 'prete'];
    const currentIndex = statusOrder.indexOf(order.status);
    const newIndex = statusOrder.indexOf(status);

    if (newIndex <= currentIndex) {
      return res.status(400).json({ message: 'Cannot revert order status' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: { id: true, full_name: true, email: true, phone: true, loyalty_points: true }
        },
        items: true
      }
    });

    // If order is marked as ready and user exists, add loyalty points
    if (status === 'prete' && updatedOrder.user_id) {
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

    res.json(updatedOrder);
  } catch (error) {
    console.error('Update kitchen order status error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get order details for kitchen (with preparation notes)
router.get('/orders/:id', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { id } = req.params;
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

    res.json(order);
  } catch (error) {
    console.error('Get kitchen order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
