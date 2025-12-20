const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

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
            customization: item.customization || null
          }))
        }
      },
      include: {
        items: true
      }
    });

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
    const { status, items, total_amount, customer_name, customer_phone, customer_email, order_type, delivery_address, pickup_time, notes } = req.body;

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
      // Admins/staff can only update status
      if (status) {
        updateData.status = status;
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
