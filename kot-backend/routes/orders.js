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

// Get all orders (admin/staff only)
router.get('/', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: { id: true, full_name: true, email: true }
        },
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

    res.json(orders);
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

    res.json(orders);
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
        items: true
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user owns the order or is admin/staff
    if (order.user_id !== req.user.id && !['admin', 'staff'].includes(req.user.role)) {
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

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create order (allows guest orders)
router.post('/', async (req, res) => {
  try {
    const { items, total_amount, customer_name, customer_phone, customer_email, order_type, delivery_address, pickup_time, notes } = req.body;

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

    // Create order
    const order = await prisma.order.create({
      data: {
        user_id: userId,
        total_amount: parseInt(total_amount),
        customer_name,
        customer_phone,
        customer_email,
        order_type,
        delivery_address,
        pickup_time,
        notes,
        items: {
          create: items.map(item => ({
            product_name: item.product_name,
            quantity: parseInt(item.quantity),
            price: parseInt(item.price),
            customization: item.customization || null,
            customizationSummary: item.customizationSummary || null
          }))
        }
      },
      include: {
        items: true
      }
    });

    console.log('Created order:', order.id, 'with items:', order.items.length);

    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Internal server error' });
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

    // Check permissions
    const isOwner = order.user_id === req.user.id;
    const isAdminOrStaff = ['admin', 'staff'].includes(req.user.role);

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
          create: items.map(item => ({
            product_name: item.product_name,
            quantity: parseInt(item.quantity),
            price: parseInt(item.price)
          }))
        };
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, full_name: true, email: true, loyalty_points: true }
        },
        items: true
      }
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

    // Assign loyalty points if order is completed and user is authenticated
    if ((status === 'livree' || status === 'prete') && updatedOrder.user_id) {
      await prisma.user.update({
        where: { id: updatedOrder.user_id },
        data: {
          loyalty_points: {
            increment: 5
          }
        }
      });
      // Refresh user data in response
      updatedOrder.user = await prisma.user.findUnique({
        where: { id: updatedOrder.user_id },
        select: { id: true, full_name: true, email: true, loyalty_points: true }
      });
    }

    res.json(updatedOrder);
  } catch (error) {
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

    if (order.status === 'cloturee') {
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
router.post('/:id/close', authenticateToken, requireRole(['caissier','admin','manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method, payment_provider_id, payment_receipt_url } = req.body;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.status === 'cloturee') {
      return res.status(400).json({ message: 'Order already closed' });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        closed_by: req.user.id,
        closed_at: new Date(),
        status: 'cloturee',
        payment_method: payment_method || order.payment_method,
        payment_provider_id: payment_provider_id || order.payment_provider_id,
        payment_receipt_url: payment_receipt_url || order.payment_receipt_url,
        payment_status: payment_method ? 'paid' : order.payment_status
      }
    });

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
    console.error('Close order error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete order (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

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
router.get('/filter', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
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
