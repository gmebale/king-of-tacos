const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requirePagePermission, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const PAYMENT_SETTING_KEYS = [
  'mobile_money_enabled',
  'mobile_money_airtel_enabled',
  'mobile_money_moov_enabled',
  'mobile_money_mobicash_enabled'
];
const DEFAULT_LOCATIONS = [
  { slug: 'salon_principal', name: 'Salon principal' },
  { slug: 'terrasse', name: 'Terrasse' },
  { slug: 'vip', name: 'Espace VIP' },
  { slug: 'bar', name: 'Bar' }
];
const ORDERING_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EMPTY_ORDERING_SCHEDULE = Object.fromEntries(ORDERING_WEEKDAYS.map(day => [day, { active: false, open_time: '11:00', last_order_time: '21:30' }]));

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

function parseOnlineOrderingConfig(value) {
  try {
    const parsed = JSON.parse(value || '{}');
    return {
      enabled: parsed.enabled !== false,
      outside_hours_mode: parsed.outside_hours_mode === 'next_opening' ? 'next_opening' : 'closed',
      weekly: { ...EMPTY_ORDERING_SCHEDULE, ...(parsed.weekly || {}) }
    };
  } catch (_error) {
    return { enabled: true, outside_hours_mode: 'closed', weekly: EMPTY_ORDERING_SCHEDULE };
  }
}

router.get('/online-ordering', async (_req, res) => {
  try {
    const row = await prisma.settings.findUnique({ where: { key: 'online_ordering_config' }, select: { value: true } });
    const { getOnlineOrderingState } = require('../utils/onlineOrdering');
    const config = parseOnlineOrderingConfig(row?.value);
    res.json({ ...config, ...getOnlineOrderingState(row?.value) });
  } catch (error) {
    console.error('Get online ordering settings error:', error);
    res.status(500).json({ message: 'Impossible de charger les horaires de commande' });
  }
});

router.put('/online-ordering', authenticateToken, requirePagePermission('settings'), async (req, res) => {
  try {
    const { enabled, outside_hours_mode, weekly } = req.body || {};
    if (typeof enabled !== 'boolean' || !['closed', 'next_opening'].includes(outside_hours_mode) || !weekly || typeof weekly !== 'object') {
      return res.status(400).json({ message: 'Configuration des commandes en ligne invalide' });
    }
    const normalizedWeekly = {};
    for (const dayName of ORDERING_WEEKDAYS) {
      const day = weekly[dayName];
      if (!day || typeof day.active !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(day.open_time || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(day.last_order_time || '')) {
        return res.status(400).json({ message: `Horaires invalides pour ${dayName}` });
      }
      if (day.active && day.open_time === day.last_order_time) {
        return res.status(400).json({ message: `L’ouverture et l’heure limite ne peuvent pas être identiques (${dayName})` });
      }
      normalizedWeekly[dayName] = { active: day.active, open_time: day.open_time, last_order_time: day.last_order_time };
    }
    const config = { enabled, outside_hours_mode, weekly: normalizedWeekly };
    await prisma.settings.upsert({
      where: { key: 'online_ordering_config' },
      update: { value: JSON.stringify(config) },
      create: { key: 'online_ordering_config', value: JSON.stringify(config) }
    });
    res.json({ ...config, configured: true });
  } catch (error) {
    console.error('Update online ordering settings error:', error);
    res.status(500).json({ message: 'Impossible d’enregistrer les horaires de commande' });
  }
});

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

router.get('/tax-rates', authenticateToken, requirePagePermission('stock'), async (_req, res) => {
  try {
    const rates = await prisma.taxRate.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] });
    res.json(rates.map(rate => ({ ...rate, percentage: rate.percentage_basis_points / 100 })));
  } catch (error) {
    console.error('Get tax rates error:', error);
    res.status(500).json({ message: 'Impossible de charger les taux de taxe' });
  }
});

router.get('/tax-rates/manage', authenticateToken, requireRole(['admin']), async (_req, res) => {
  try {
    const rates = await prisma.taxRate.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] });
    res.json(rates.map(rate => ({ ...rate, percentage: rate.percentage_basis_points / 100 })));
  } catch (error) {
    console.error('Manage tax rates error:', error);
    res.status(500).json({ message: 'Impossible de charger les taux de taxe' });
  }
});

router.post('/tax-rates', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const percentage = Number(req.body.percentage);
    if (!name || name.length > 80 || !Number.isFinite(percentage) || percentage < 0 || percentage > 100 || Math.abs(Math.round(percentage * 100) - percentage * 100) > 1e-7) {
      return res.status(400).json({ message: 'Nom ou pourcentage de taxe invalide (de 0 à 100 %, deux décimales maximum)' });
    }
    const rate = await prisma.taxRate.create({ data: { name, percentage_basis_points: Math.round(percentage * 100) } });
    res.status(201).json({ ...rate, percentage });
  } catch (error) {
    console.error('Create tax rate error:', error);
    res.status(error.code === 'P2002' ? 409 : 500).json({ message: error.code === 'P2002' ? 'Un taux porte déjà ce nom' : 'Impossible de créer le taux' });
  }
});

router.patch('/tax-rates/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Identifiant invalide' });
    const data = {};
    if (typeof req.body.name === 'string') {
      const name = req.body.name.trim();
      if (!name || name.length > 80) return res.status(400).json({ message: 'Nom de taxe invalide' });
      data.name = name;
    }
    if (req.body.percentage !== undefined) {
      const percentage = Number(req.body.percentage);
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100 || Math.abs(Math.round(percentage * 100) - percentage * 100) > 1e-7) {
        return res.status(400).json({ message: 'Le pourcentage doit être compris entre 0 et 100, avec deux décimales maximum' });
      }
      data.percentage_basis_points = Math.round(percentage * 100);
    }
    if (typeof req.body.active === 'boolean') data.active = req.body.active;
    if (!Object.keys(data).length) return res.status(400).json({ message: 'Aucune modification fournie' });
    const rate = await prisma.taxRate.update({ where: { id }, data });
    res.json({ ...rate, percentage: rate.percentage_basis_points / 100 });
  } catch (error) {
    console.error('Update tax rate error:', error);
    const status = error.code === 'P2025' ? 404 : error.code === 'P2002' ? 409 : 500;
    res.status(status).json({ message: status === 409 ? 'Un taux porte déjà ce nom' : 'Impossible de modifier le taux' });
  }
});

// Get restaurant settings
router.get('/homepage', async (_req, res) => {
  try {
    const rows = await prisma.settings.findMany({ where: { key: { in: ['hero_media_url', 'hero_media_type', 'hero_overlay_opacity'] } } });
    const settings = mapSettings(rows);
    const overlayOpacity = Number(settings.hero_overlay_opacity);
    res.json({
      media_url: settings.hero_media_url || '',
      media_type: settings.hero_media_type || '',
      overlay_opacity: Number.isInteger(overlayOpacity) && overlayOpacity >= 0 && overlayOpacity <= 100 ? overlayOpacity : 85
    });
  } catch (error) {
    console.error('Get homepage settings error:', error);
    res.status(500).json({ message: 'Impossible de charger la bannière' });
  }
});

router.put('/homepage', authenticateToken, requirePagePermission('settings'), async (req, res) => {
  try {
    const mediaUrl = typeof req.body?.media_url === 'string' ? req.body.media_url.trim() : '';
    const mediaType = typeof req.body?.media_type === 'string' ? req.body.media_type : '';
    const overlayOpacity = Number(req.body?.overlay_opacity);
    if (!Number.isInteger(overlayOpacity) || overlayOpacity < 0 || overlayOpacity > 100) {
      return res.status(400).json({ message: 'L’opacité doit être un pourcentage entre 0 et 100.' });
    }
    if (!mediaUrl) {
      await prisma.$transaction([
        prisma.settings.deleteMany({ where: { key: { in: ['hero_media_url', 'hero_media_type'] } } }),
        prisma.settings.upsert({ where: { key: 'hero_overlay_opacity' }, update: { value: String(overlayOpacity) }, create: { key: 'hero_overlay_opacity', value: String(overlayOpacity) } })
      ]);
      return res.json({ media_url: '', media_type: '', overlay_opacity: overlayOpacity });
    }
    if (!['image', 'video'].includes(mediaType) || mediaUrl.length > 2048) {
      return res.status(400).json({ message: 'Média de bannière invalide.' });
    }
    let pathname;
    try {
      pathname = new URL(mediaUrl, 'https://kingoftacos.com').pathname;
    } catch (_error) {
      return res.status(400).json({ message: 'Adresse du média invalide.' });
    }
    const extension = pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const videoExtensions = ['mp4', 'webm', 'mov'];
    const allowedExtensions = mediaType === 'image' ? imageExtensions : videoExtensions;
    if (!['/uploads/', '/api/uploads/'].some(prefix => pathname.startsWith(prefix)) || !allowedExtensions.includes(extension)) {
      return res.status(400).json({ message: 'La bannière doit être un média téléversé dans un format pris en charge.' });
    }
    const normalizedMediaUrl = pathname.startsWith('/uploads/') ? `/api${pathname}` : pathname;
    await prisma.$transaction([
      prisma.settings.upsert({ where: { key: 'hero_media_url' }, update: { value: normalizedMediaUrl }, create: { key: 'hero_media_url', value: normalizedMediaUrl } }),
      prisma.settings.upsert({ where: { key: 'hero_media_type' }, update: { value: mediaType }, create: { key: 'hero_media_type', value: mediaType } }),
      prisma.settings.upsert({ where: { key: 'hero_overlay_opacity' }, update: { value: String(overlayOpacity) }, create: { key: 'hero_overlay_opacity', value: String(overlayOpacity) } })
    ]);
    res.json({ media_url: normalizedMediaUrl, media_type: mediaType, overlay_opacity: overlayOpacity });
  } catch (error) {
    console.error('Update homepage settings error:', error);
    res.status(500).json({ message: 'Impossible de sauvegarder la bannière' });
  }
});

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
      mobile_money_moov_enabled: settings.find(setting => setting.key === 'mobile_money_mobicash_enabled')?.value || 'true'
    });

    res.json({
      mobile_money_enabled: toBoolean(settingsObj.mobile_money_enabled, true),
      mobile_money_airtel_enabled: toBoolean(settingsObj.mobile_money_airtel_enabled, true),
      mobile_money_moov_enabled: toBoolean(settingsObj.mobile_money_moov_enabled, true),
      ebilling_enabled: process.env.EBILLING_ENABLED === 'true',
      ebilling_test_mode: (() => {
        try {
          const apiBase = process.env.EBILLING_API_BASE || 'https://lab.billing-easy.net/api';
          return new URL(apiBase).hostname === 'lab.billing-easy.net';
        } catch (_error) {
          return false;
        }
      })()
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
      mobile_money_moov_enabled
    } = req.body;

    const updates = {
      mobile_money_enabled,
      mobile_money_airtel_enabled,
      mobile_money_moov_enabled
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
