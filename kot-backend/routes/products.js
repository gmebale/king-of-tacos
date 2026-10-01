const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePagePermission } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
const PREPARATION_STATIONS = ['bar', 'cuisine_chaude', 'cuisine_froide'];
const PRODUCT_TYPES = ['simple', 'configurable', 'combo', 'modifier'];

function parseTaxRateIds(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  const ids = [...new Set(value.map(Number))];
  return ids.every(id => Number.isInteger(id) && id > 0) ? ids : null;
}

async function validateTaxRates(tx, ids, activeOnly = true) {
  const rows = ids.length ? await tx.taxRate.findMany({
    where: { id: { in: ids }, ...(activeOnly ? { active: true } : {}) },
    select: { id: true }
  }) : [];
  return rows.length === ids.length;
}

function normalizeProductType(value) {
  return PRODUCT_TYPES.includes(value) ? value : null;
}

function normalizeOptionGroups(customization) {
  if (!Array.isArray(customization?.optionGroups)) return [];
  return customization.optionGroups.map((group, index) => ({
    ...group,
    id: String(group.id || `group-${index + 1}`),
    name: String(group.name || `Choix ${index + 1}`),
    type: group.type === 'single' ? 'single' : 'multiple',
    minSelections: Math.max(0, Number(group.minSelections ?? (group.required ? 1 : 0)) || 0),
    maxSelections: group.type === 'single' ? 1 : (group.maxSelections == null || group.maxSelections === '' ? null : Math.max(1, Number(group.maxSelections))),
    includedCount: Math.max(0, Number(group.includedCount) || 0),
    extraPrice: Math.max(0, Number(group.extraPrice) || 0),
    options: Array.isArray(group.options) ? group.options.map(option => ({
      ...option,
      id: String(option.id ?? option.productId ?? ''),
      productId: Number(option.productId ?? option.id) || null,
      priceModifier: Math.max(0, Number(option.priceModifier) || 0)
    })) : []
  }));
}

function validateCustomization(type, customization) {
  const value = customization && typeof customization === 'object'
    ? customization
    : { isConfigurable: false, optionGroups: [], recommendations: [] };
  const groups = Array.isArray(value.optionGroups) ? value.optionGroups : [];
  const recommendationIds = Array.isArray(value.recommendations) ? value.recommendations.map(Number) : [];
  if (recommendationIds.some(id => !Number.isInteger(id) || id < 1) || new Set(recommendationIds).size !== recommendationIds.length) return 'La liste de suggestions contient une référence invalide ou en double.';
  if (['configurable', 'combo'].includes(type) && groups.length === 0) return 'Ajoutez au moins une étape de choix pour ce type de produit.';
  const groupIds = new Set();
  for (const group of groups) {
    if (!group || !String(group.id || '').trim() || !String(group.name || '').trim()) return 'Chaque étape doit avoir un identifiant et un nom.';
    if (groupIds.has(String(group.id))) return 'Les identifiants des étapes doivent être uniques.';
    groupIds.add(String(group.id));
    if (!['single', 'multiple'].includes(group.type)) return `Mode de choix invalide dans « ${group.name} ».`;
    const min = Number(group.minSelections ?? (group.required ? 1 : 0));
    const max = group.type === 'single' ? 1 : group.maxSelections == null || group.maxSelections === '' ? null : Number(group.maxSelections);
    if (!Number.isInteger(min) || min < 0 || (max !== null && (!Number.isInteger(max) || max < Math.max(1, min)))) return `Limites de choix invalides dans « ${group.name} ».`;
    if (!Array.isArray(group.options) || group.options.length === 0) return `Ajoutez au moins un choix dans « ${group.name} ».`;
    const optionIds = new Set();
    for (const option of group.options) {
      const productId = Number(option?.productId);
      const modifier = Number(option?.priceModifier ?? 0);
      if (!Number.isInteger(productId) || productId < 1 || !String(option?.name || '').trim() || !Number.isInteger(modifier) || modifier < 0) return `Choix invalide dans « ${group.name} ».`;
      if (optionIds.has(String(option.id ?? productId))) return `Un choix est dupliqué dans « ${group.name} ».`;
      optionIds.add(String(option.id ?? productId));
    }
  }
  return null;
}

async function validateCustomizationReferences(tx, customization, excludedProductId = null) {
  const optionIds = (customization?.optionGroups || []).flatMap(group => group.options || []).map(option => Number(option.productId));
  const recommendationIds = (customization?.recommendations || []).map(Number);
  const ids = [...new Set([...optionIds, ...recommendationIds])];
  if (excludedProductId && ids.includes(Number(excludedProductId))) return 'Un produit ne peut pas se référencer lui-même comme option ou suggestion.';
  if (!ids.length) return null;
  const matches = await tx.product.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return matches.length === ids.length ? null : 'Un produit choisi comme option ou suggestion n’existe plus.';
}

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { NOT: { type: 'modifier' } },
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
        loyalty_points: true,
        type: true,
        customization: true,
        options: { select: { id: true }, take: 1 },
        taxRates: { include: { taxRate: true } }
      }
    });
    res.json(products.map(({ options, ...product }) => ({
      ...product,
      type: normalizeProductType(product.type) || (product.customization?.isConfigurable || options.length ? 'configurable' : 'simple')
    })));
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/admin/inventory', authenticateToken, requirePagePermission('stock'), async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { created_at: 'desc' },
      include: { taxRates: { include: { taxRate: true } }, options: { select: { id: true }, take: 1 } }
    });
    res.json(products);
  } catch (error) {
    console.error('Get inventory products error:', error);
    res.status(500).json({ message: 'Impossible de charger les données de stock' });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true, name: true, description: true, price: true, discount_percentage: true,
        category: true, available: true, image: true, stock: true, stock_alert_threshold: true, loyalty_points: true,
        type: true,
        customization: true, taxRates: { include: { taxRate: true } }
      }
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

router.get('/:id/recommendations', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) }, select: { customization: true } });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const recommendations = Array.isArray(product.customization?.recommendations) ? product.customization.recommendations : [];
    const ids = [...new Set(recommendations.map(Number).filter(id => Number.isInteger(id) && id > 0))];
    if (!ids.length) return res.json([]);
    const candidates = await prisma.product.findMany({
      where: { id: { in: ids }, available: true, NOT: { type: { in: ['modifier', 'configurable', 'combo'] } }, options: { none: {} }, category: { is: { is_menu_visible: true } } },
      select: { id: true, name: true, description: true, price: true, discount_percentage: true, image: true, type: true, customization: true },
    });
    const simpleCandidates = candidates.filter(candidate => !candidate.customization?.isConfigurable && !(candidate.customization?.optionGroups || []).length);
    const candidateIds = simpleCandidates.map(candidate => candidate.id);
    if (!candidateIds.length) return res.json([]);
    const soldLines = await prisma.orderItem.findMany({
      where: { product_id: { in: candidateIds }, order: { closed_at: { not: null }, payment_status: 'paid' } },
      select: { product_id: true, quantity: true }
    });
    const soldCount = new Map();
    for (const line of soldLines) soldCount.set(line.product_id, (soldCount.get(line.product_id) || 0) + line.quantity);
    simpleCandidates.sort((a, b) => (soldCount.get(b.id) || 0) - (soldCount.get(a.id) || 0) || ids.indexOf(a.id) - ids.indexOf(b.id));
    res.json(simpleCandidates.map(({ customization, ...candidate }) => candidate));
  } catch (error) {
    console.error('Get product recommendations error:', error);
    res.status(500).json({ message: 'Impossible de charger les suggestions' });
  }
});

// Create product (admin only)
router.post('/', authenticateToken, requirePagePermission('stock'), async (req, res) => {
  try {
    const { name, description, price, discount_percentage, category, available, image, stock, stock_alert_threshold, customization, tax_rate_ids, loyalty_points, type } = req.body;
    const taxRateIds = parseTaxRateIds(tax_rate_ids);
    if (taxRateIds === null) return res.status(400).json({ message: 'Liste de taux de taxe invalide' });

    // Find category by name
    const categoryRecord = await prisma.categoryModel.findUnique({
      where: { name: category }
    });

    if (!categoryRecord) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    if (type !== undefined && !normalizeProductType(type)) return res.status(400).json({ message: 'Type de produit invalide.' });
    const resolvedType = type || 'simple';
    const customizationError = validateCustomization(resolvedType, customization);
    if (customizationError) return res.status(400).json({ message: customizationError });

    // Transaction pour garder produit + options cohérents
    const product = await prisma.$transaction(async (tx) => {
      const storedCustomization = { ...(customization || {}), optionGroups: normalizeOptionGroups(customization), recommendations: Array.isArray(customization?.recommendations) ? customization.recommendations : [], isConfigurable: ['configurable', 'combo'].includes(resolvedType) };
      const invalidReference = await validateCustomizationReferences(tx, storedCustomization);
      if (invalidReference) {
        const error = new Error(invalidReference);
        error.statusCode = 400;
        throw error;
      }
      if (taxRateIds !== undefined && !(await validateTaxRates(tx, taxRateIds, true))) {
        const error = new Error('Un ou plusieurs taux sélectionnés sont indisponibles');
        error.statusCode = 400;
        throw error;
      }
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
          loyalty_points: Math.max(0, parseInt(loyalty_points, 10) || 0),
          type: resolvedType,
          customization: storedCustomization,
          ...(taxRateIds !== undefined ? { taxRates: { create: taxRateIds.map(tax_rate_id => ({ taxRate: { connect: { id: tax_rate_id } } })) } } : {})
        }
      });

      return createdProduct;
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update product (admin only)
router.put('/:id', authenticateToken, requirePagePermission('stock'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, discount_percentage, category, available, image, stock, stock_alert_threshold, customization, tax_rate_ids, loyalty_points, type } = req.body;
    const taxRateIds = parseTaxRateIds(tax_rate_ids);
    if (taxRateIds === null) return res.status(400).json({ message: 'Liste de taux de taxe invalide' });

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
    if (type !== undefined) {
      const normalizedType = normalizeProductType(type);
      if (!normalizedType) return res.status(400).json({ message: 'Type de produit invalide.' });
      data.type = normalizedType;
    }
    if (loyalty_points !== undefined) {
      const points = Number(loyalty_points);
      if (!Number.isInteger(points) || points < 0) return res.status(400).json({ message: 'Les points doivent être un entier positif ou nul' });
      data.loyalty_points = points;
    }
    if (customization !== undefined || type !== undefined) {
      const current = await prisma.product.findUnique({ where: { id: parseInt(id) }, select: { type: true, customization: true } });
      if (!current) return res.status(404).json({ message: 'Produit introuvable.' });
      const resolvedType = type === undefined ? current.type : normalizeProductType(type);
      if (!resolvedType) return res.status(400).json({ message: 'Type de produit invalide.' });
      const resolvedCustomization = customization === undefined ? current.customization : customization;
      const customizationError = validateCustomization(resolvedType, resolvedCustomization);
      if (customizationError) return res.status(400).json({ message: customizationError });
      data.type = resolvedType;
      data.customization = { ...(resolvedCustomization || {}), optionGroups: normalizeOptionGroups(resolvedCustomization), recommendations: Array.isArray(resolvedCustomization?.recommendations) ? resolvedCustomization.recommendations : [], isConfigurable: ['configurable', 'combo'].includes(resolvedType) };
    }

    const product = await prisma.$transaction(async tx => {
      if (data.customization !== undefined) {
        const invalidReference = await validateCustomizationReferences(tx, data.customization, parseInt(id));
        if (invalidReference) {
          const error = new Error(invalidReference);
          error.statusCode = 400;
          throw error;
        }
      }
      if (taxRateIds !== undefined) {
        if (!(await validateTaxRates(tx, taxRateIds, false))) {
          const error = new Error('Un ou plusieurs taux sélectionnés sont indisponibles');
          error.statusCode = 400;
          throw error;
        }
        await tx.productTax.deleteMany({ where: { product_id: parseInt(id) } });
        if (taxRateIds.length) {
          await tx.productTax.createMany({ data: taxRateIds.map(tax_rate_id => ({ product_id: parseInt(id), tax_rate_id })) });
        }
      }
      await tx.product.update({ where: { id: parseInt(id) }, data });
      return tx.product.findUnique({ where: { id: parseInt(id) }, include: { taxRates: { include: { taxRate: true } } } });
    });

    res.json(product);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Product not found' });
    }
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete product (admin only)
router.delete('/:id', authenticateToken, requirePagePermission('stock'), async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);

    const purchaseHistory = await prisma.expenseItem.count({ where: { product_id: productId } });
    if (purchaseHistory > 0) {
      return res.status(409).json({ message: 'Ce produit figure dans des achats de stock et doit être désactivé plutôt que supprimé.' });
    }

    const linkedRewards = await prisma.loyaltyReward.count({ where: { gifted_product_id: productId } });
    if (linkedRewards > 0) return res.status(409).json({ message: 'Ce produit est associé à une récompense fidélité. Désactivez-le ou modifiez la récompense avant suppression.' });

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

// Category management
router.post('/categories', authenticateToken, requirePagePermission('stock'), async (req, res) => {
  const { name, displayName, preparation_station, is_menu_visible, display_order } = req.body;
  const normalizedName = String(name || '').trim().toLowerCase().replace(/\s+/g, '_');
  const label = String(displayName || '').trim();
  const station = preparation_station || 'cuisine_chaude';
  const order = Number(display_order || 0);
  if (!/^[a-z0-9_-]{2,60}$/.test(normalizedName) || !label || label.length > 80 || !PREPARATION_STATIONS.includes(station) || !Number.isInteger(order)) {
    return res.status(400).json({ message: 'Nom, libellé, poste de préparation ou ordre invalide.' });
  }
  try {
    const category = await prisma.categoryModel.create({ data: {
      name: normalizedName,
      displayName: label,
      preparation_station: station,
      is_menu_visible: is_menu_visible !== false,
      display_order: order
    } });
    res.status(201).json(category);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'Une catégorie porte déjà ce nom technique.' });
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Impossible de créer la catégorie.' });
  }
});

router.put('/categories/:id', authenticateToken, requirePagePermission('stock'), async (req, res) => {
  const id = Number(req.params.id);
  const { name, displayName, preparation_station, is_menu_visible, display_order } = req.body;
  const data = {};
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Catégorie invalide.' });
  if (name !== undefined) {
    const normalizedName = String(name).trim().toLowerCase().replace(/\s+/g, '_');
    if (!/^[a-z0-9_-]{2,60}$/.test(normalizedName)) return res.status(400).json({ message: 'Nom technique invalide.' });
    data.name = normalizedName;
  }
  if (displayName !== undefined) {
    const label = String(displayName).trim();
    if (!label || label.length > 80) return res.status(400).json({ message: 'Le libellé doit contenir de 1 à 80 caractères.' });
    data.displayName = label;
  }
  if (preparation_station !== undefined) {
    if (!PREPARATION_STATIONS.includes(preparation_station)) return res.status(400).json({ message: 'Poste de préparation invalide.' });
    data.preparation_station = preparation_station;
  }
  if (is_menu_visible !== undefined) data.is_menu_visible = Boolean(is_menu_visible);
  if (display_order !== undefined) {
    const order = Number(display_order);
    if (!Number.isInteger(order)) return res.status(400).json({ message: 'Ordre d’affichage invalide.' });
    data.display_order = order;
  }
  try {
    const category = await prisma.categoryModel.update({ where: { id }, data });
    res.json(category);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'Une catégorie porte déjà ce nom technique.' });
    if (error.code === 'P2025') return res.status(404).json({ message: 'Catégorie introuvable.' });
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Impossible de modifier la catégorie.' });
  }
});

// Get all categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await prisma.categoryModel.findMany({
      orderBy: [{ display_order: 'asc' }, { displayName: 'asc' }]
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

    if (Array.isArray(product.customization?.optionGroups) && product.customization.optionGroups.length) {
      return res.json({
        productId: product.id,
        productName: product.name,
        optionGroups: normalizeOptionGroups(product.customization)
      });
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
