const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const PAYMENT_SETTING_KEYS = [
  'mobile_money_enabled',
  'mobile_money_airtel_enabled',
  'mobile_money_mobicash_enabled'
];

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

// Get restaurant settings
router.get('/restaurant', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const settings = await prisma.settings.findMany();
    res.json(mapSettings(settings));
  } catch (error) {
    console.error('Get restaurant settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update restaurant settings
router.put('/restaurant', authenticateToken, requireRole(['admin']), async (req, res) => {
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
router.put('/payment', authenticateToken, requireRole(['admin']), async (req, res) => {
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
