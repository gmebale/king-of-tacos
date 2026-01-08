const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        discount_percentage: true,
        category: true,
        available: true,
        image: true,
        stock: true,
        stock_alert_threshold: true,
        customization: true
      }
    });
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create product (admin only)
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { name, description, price, discount_percentage, category, available, image, stock, stock_alert_threshold, customization } = req.body;

    // Find category by name
    const categoryRecord = await prisma.categoryModel.findUnique({
      where: { name: category }
    });

    if (!categoryRecord) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseInt(price),
        discount_percentage: parseInt(discount_percentage) || 0,
        categoryId: categoryRecord.id,
        available: available !== undefined ? available : true,
        image,
        stock: parseInt(stock) || 0,
        stock_alert_threshold: parseInt(stock_alert_threshold) || 10,
        customization: customization || { isConfigurable: false }
      }
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update product (admin only)
router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, discount_percentage, category, available, image, stock, stock_alert_threshold, customization } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = parseInt(price);
    if (discount_percentage !== undefined) data.discount_percentage = parseInt(discount_percentage);
    if (category !== undefined) {
      const categoryRecord = await prisma.categoryModel.findUnique({
        where: { name: category }
      });
      if (!categoryRecord) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      data.categoryId = categoryRecord.id;
    }
    if (available !== undefined) data.available = available;
    if (image !== undefined) data.image = image;
    if (stock !== undefined) data.stock = parseInt(stock);
    if (stock_alert_threshold !== undefined) data.stock_alert_threshold = parseInt(stock_alert_threshold);
    if (customization !== undefined) data.customization = customization;

    const product = await prisma.product.update({
      where: { id: parseInt(id) },
      data
    });

    res.json(product);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Product not found' });
    }
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete product (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.product.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Product not found' });
    }
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await prisma.categoryModel.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
