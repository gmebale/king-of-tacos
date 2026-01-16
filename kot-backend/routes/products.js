const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Modèle d'options à attacher automatiquement par catégorie de produit principal.
// On se base sur les noms exacts des produits existants (table products) pour éviter
// d'ajouter toutes les options indistinctement.
const CUSTOM_OPTION_TEMPLATES = {
  tacos: [
    { names: ['Solo (1 viande)', 'Doble (2 viandes)', 'Trio (3 viandes)', 'Patron (3 viandes + fromage)'], optionType: 'size', required: true, maxQuantity: 1 },
    { names: ['Poulet', 'Boeuf', 'Merguez'], optionType: 'meat', required: true, maxQuantity: 3 },
    { names: ['Algérienne', 'Samouraï', 'Fromagère', 'Mayo', 'Ketchup', 'BBQ', 'Burger', 'Poivre', 'Curry', 'Creamy', 'Sweet Chili', 'Avocado Cream'], optionType: 'sauce', required: true, maxQuantity: 2 },
    { names: ['Oeuf', 'Poulet pané', 'Poulet braisé', 'Cordon bleu', 'Boeuf mariné', 'Dés de poisson', 'Crevettes marinées'], optionType: 'extra', required: false, maxQuantity: 2 },
    { names: ['Frites', 'Frites paprika', 'Frites cheddar', 'Riz blanc', 'Riz mexicain', 'Potatoes', 'Aloco', 'Fromage cheddar', 'Fromage gruyère', 'Fromage mozzarella'], optionType: 'side', required: false, maxQuantity: null }
  ],
  burritos: [
    { names: ['Petite Farita Poulet', 'Grande Farita Poulet'], optionType: 'size', required: false, maxQuantity: 1 },
    { names: ['Poulet', 'Boeuf', 'Merguez'], optionType: 'meat', required: true, maxQuantity: 3 },
    { names: ['Algérienne', 'Samouraï', 'Fromagère', 'Mayo', 'Ketchup', 'BBQ', 'Burger', 'Poivre', 'Curry', 'Creamy', 'Sweet Chili', 'Avocado Cream'], optionType: 'sauce', required: true, maxQuantity: 2 },
    { names: ['Oeuf', 'Poulet pané', 'Poulet braisé', 'Cordon bleu', 'Boeuf mariné', 'Dés de poisson', 'Crevettes marinées'], optionType: 'extra', required: false, maxQuantity: 2 },
    { names: ['Frites', 'Frites paprika', 'Frites cheddar', 'Riz blanc', 'Riz mexicain', 'Potatoes', 'Aloco', 'Fromage cheddar', 'Fromage gruyère', 'Fromage mozzarella'], optionType: 'side', required: false, maxQuantity: null }
  ],
  burger: [
    { names: ['Poulet', 'Boeuf', 'Merguez'], optionType: 'meat', required: true, maxQuantity: 1 },
    { names: ['Algérienne', 'Samouraï', 'Fromagère', 'Mayo', 'Ketchup', 'BBQ', 'Burger', 'Poivre', 'Curry', 'Creamy', 'Sweet Chili', 'Avocado Cream'], optionType: 'sauce', required: true, maxQuantity: 2 },
    { names: ['Oeuf', 'Poulet pané', 'Poulet braisé', 'Cordon bleu', 'Boeuf mariné', 'Dés de poisson', 'Crevettes marinées'], optionType: 'extra', required: false, maxQuantity: 2 },
    { names: ['Frites', 'Frites paprika', 'Frites cheddar', 'Riz blanc', 'Riz mexicain', 'Potatoes', 'Aloco', 'Fromage cheddar', 'Fromage gruyère', 'Fromage mozzarella'], optionType: 'side', required: false, maxQuantity: null }
  ]
};

/**
 * Attache les options définies dans CUSTOM_OPTION_TEMPLATES en se basant
 * sur les noms des produits optionnels existants.
 */
async function attachTemplateOptions(tx, productId, categoryName) {
  const template = CUSTOM_OPTION_TEMPLATES[categoryName];
  if (!template) return 0;

  const allNames = template.flatMap((group) => group.names);
  if (!allNames.length) return 0;

  const optionProducts = await tx.product.findMany({
    where: { name: { in: allNames } },
    select: { id: true, name: true }
  });

  const nameToId = new Map(optionProducts.map((p) => [p.name, p.id]));
  const optionRows = [];

  for (const group of template) {
    for (const optName of group.names) {
      const optId = nameToId.get(optName);
      if (!optId) {
        console.warn(`Option "${optName}" introuvable, ignorée pour ${categoryName}`);
        continue;
        }
      optionRows.push({
        productId,
        optionProductId: optId,
        required: group.required ?? false,
        maxQuantity: group.maxQuantity ?? null,
        optionType: group.optionType || 'extra'
      });
    }
  }

  if (!optionRows.length) return 0;

  await tx.productOption.createMany({
    data: optionRows,
    skipDuplicates: true
  });

  return optionRows.length;
}

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

    const isCustomCategory = Boolean(CUSTOM_OPTION_TEMPLATES[categoryRecord.name]);

    // Transaction pour garder produit + options cohérents
    const product = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
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
          customization: customization || { isConfigurable: isCustomCategory }
        }
      });

      if (isCustomCategory) {
        try {
          await attachTemplateOptions(tx, createdProduct.id, categoryRecord.name);
        } catch (attachErr) {
          console.error('Auto attach template options failed:', attachErr);
        }
      }

      return createdProduct;
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
      // Handle both string (category name) and object (category with id/name) formats
      let categoryRecord;
      if (typeof category === 'string') {
        categoryRecord = await prisma.categoryModel.findUnique({
          where: { name: category }
        });
      } else if (typeof category === 'object' && category && category.name) {
        categoryRecord = await prisma.categoryModel.findUnique({
          where: { name: category.name }
        });
      } else if (typeof category === 'number') {
        categoryRecord = await prisma.categoryModel.findUnique({
          where: { id: category }
        });
      } else {
        return res.status(400).json({ message: 'Invalid category format' });
      }

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
    const productId = parseInt(id);

    // Supprimer d'abord toutes les options de personnalisation qui utilisent ce produit
    await prisma.productOption.deleteMany({
      where: {
        OR: [
          { productId: productId },      // Options de ce produit
          { optionProductId: productId } // Ce produit utilisé comme option
        ]
      }
    });

    // Maintenant supprimer le produit
    await prisma.product.delete({
      where: { id: productId }
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

// Get options for a specific product
router.get('/:id/options', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        options: {
          include: {
            optionProduct: true
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Récupérer les règles de customisation
    const rules = await prisma.productCustomizationRule.findMany({
      where: { productId: parseInt(id) }
    });

    // Group options by type
    const groupedOptions = product.options.reduce((acc, opt) => {
      const type = opt.optionType;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push({
        id: opt.optionProduct.id,
        name: opt.optionProduct.name,
        price: opt.optionProduct.price,
        priceModifier: opt.optionProduct.price,
        required: opt.required,
        maxQuantity: opt.maxQuantity
      });
      return acc;
    }, {});

    // Transformer en optionGroups avec règles dynamiques
    const optionGroups = Object.keys(groupedOptions).map(type => {
      const typeLabels = {
        size: 'Taille',
        meat: 'Viandes',
        sauce: 'Sauces',
        extra: 'Suppléments',
        goût: 'Goûts'
      };

      // Trouver la règle pour ce type (générale ou par taille)
      const generalRule = rules.find(r => r.optionType === type && !r.sizeOptionId);
      
      return {
        id: type,
        name: typeLabels[type] || type,
        type: groupedOptions[type].some(opt => opt.required && opt.maxQuantity === 1) ? 'single' : 'multiple',
        required: groupedOptions[type].some(opt => opt.required),
        priceBehavior: type === 'size' ? 'replace' : 'add',
        maxQuantity: generalRule ? generalRule.maxQuantity : null,
        includedCount: generalRule ? generalRule.includedCount : 0,
        extraPrice: generalRule ? generalRule.extraPrice : 0,
        options: groupedOptions[type]
      };
    });

    res.json({
      productId: product.id,
      productName: product.name,
      optionGroups,
      rules // Inclure les règles pour debug
    });
  } catch (error) {
    console.error('Get product options error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
