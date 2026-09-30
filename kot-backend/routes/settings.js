const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePagePermission, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const PAYMENT_SETTING_KEYS = [
  'mobile_money_enabled',
  'mobile_money_airtel_enabled',
  'mobile_money_mobicash_enabled'
];
const DEFAULT_LOCATIONS = [
  { slug: 'salon_principal', name: 'Salon principal' },
  { slug: 'terrasse', name: 'Terrasse' },
  { slug: 'vip', name: 'Espace VIP' },
  { slug: 'bar', name: 'Bar' }
];

async function ensureDefaultLocations() {
  await prisma.restaurantLocation.createMany({ data: DEFAULT_LOCATIONS, skipDuplicates: true });
}

function locationSlug(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function mapSettings(rows, defaults = {}) {
  const settingsObj = { ...defaults };
  rows.forEach((setting) => {
    settingsObj[setting.key] = setting.value;
  });
  return settingsObj;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return String(value).toLowerCase() === 'true';
}

// Active restaurant locations are available to the server checkout.
router.get('/locations', async (_req, res) => {
  try {
    await ensureDefaultLocations();
    const locations = await prisma.restaurantLocation.findMany({
      where: { active: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, slug: true, name: true }
    });
    res.json(locations);
  } catch (error) {
    console.error('Get restaurant locations error:', error);
    res.status(500).json({ message: 'Impossible de charger les lieux' });
  }
});

router.get('/locations/manage', authenticateToken, requireRole(['admin']), async (_req, res) => {
  try {
    await ensureDefaultLocations();
    res.json(await prisma.restaurantLocation.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] }));
  } catch (error) {
    console.error('Manage restaurant locations error:', error);
    res.status(500).json({ message: 'Impossible de charger les lieux' });
  }
});

router.post('/locations', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const slug = locationSlug(name);
    if (!name || name.length > 80 || !slug) {
      return res.status(400).json({ message: 'Le nom du lieu doit contenir entre 1 et 80 caractères' });
    }
    const existing = await prisma.restaurantLocation.findUnique({ where: { slug } });
    if (existing) return res.status(409).json({ message: 'Un lieu avec ce nom existe déjà' });
    const location = await prisma.restaurantLocation.create({ data: { name, slug } });
    res.status(201).json(location);
  } catch (error) {
    console.error('Create restaurant location error:', error);
    res.status(500).json({ message: 'Impossible de créer le lieu' });
  }
});

router.patch('/locations/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Identifiant invalide' });
    const data = {};
    if (typeof req.body.active === 'boolean') data.active = req.body.active;
    if (typeof req.body.name === 'string') {
      const name = req.body.name.trim();
      if (!name || name.length > 80) return res.status(400).json({ message: 'Nom de lieu invalide' });
      data.name = name;
    }
    if (!Object.keys(data).length) return res.status(400).json({ message: 'Aucune modification fournie' });
    res.json(await prisma.restaurantLocation.update({ where: { id }, data }));
  } catch (error) {
    console.error('Update restaurant location error:', error);
    res.status(error.code === 'P2025' ? 404 : 500).json({ message: 'Impossible de modifier le lieu' });
  }
});

// Get restaurant settings
router.get('/restaurant', authenticateToken, requirePagePermission('settings'), async (req, res) => {
  try {
    const settings = await prisma.settings.findMany();
    res.json(mapSettings(settings));
  } catch (error) {
    console.error('Get restaurant settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update restaurant settings
router.put('/restaurant', authenticateToken, requirePagePermission('settings'), async (req, res) => {
  try {
    const { name, address, phone, email, opening_hours, delivery_radius, minimum_order } = req.body;

    const settingsToUpdate = {
      name,
      address,
      phone,
      email,
      opening_hours,
      delivery_radius: delivery_radius ? parseInt(delivery_radius) : null,
      minimum_order: minimum_order ? parseInt(minimum_order) : null
    };

    // Update or create each setting
    const updatedSettings = {};
    for (const [key, value] of Object.entries(settingsToUpdate)) {
      if (value !== null && value !== undefined && value !== '') {
        await prisma.settings.upsert({
          where: { key },
          update: { value: value.toString() },
          create: { key, value: value.toString() }
        });
        updatedSettings[key] = value;
      }
    }

    res.json(updatedSettings);
  } catch (error) {
    console.error('Update restaurant settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get payment settings (public)
router.get('/payment', async (req, res) => {
  try {
    const settings = await prisma.settings.findMany({
      where: { key: { in: PAYMENT_SETTING_KEYS } }
    });

    const settingsObj = mapSettings(settings, {
      mobile_money_enabled: 'true',
      mobile_money_airtel_enabled: 'true',
      mobile_money_mobicash_enabled: 'true'
    });

    res.json({
      mobile_money_enabled: toBoolean(settingsObj.mobile_money_enabled, true),
      mobile_money_airtel_enabled: toBoolean(settingsObj.mobile_money_airtel_enabled, true),
      mobile_money_mobicash_enabled: toBoolean(settingsObj.mobile_money_mobicash_enabled, true)
    });
  } catch (error) {
    console.error('Get payment settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update payment settings (admin)
router.put('/payment', authenticateToken, requirePagePermission('settings'), async (req, res) => {
  try {
    const {
      mobile_money_enabled,
      mobile_money_airtel_enabled,
      mobile_money_mobicash_enabled
    } = req.body;

    const updates = {
      mobile_money_enabled,
      mobile_money_airtel_enabled,
      mobile_money_mobicash_enabled
    };

    const updatedSettings = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      await prisma.settings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      });
      updatedSettings[key] = value;
    }

    res.json(updatedSettings);
  } catch (error) {
    console.error('Update payment settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
