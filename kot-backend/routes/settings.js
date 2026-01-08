const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get restaurant settings
router.get('/restaurant', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const settings = await prisma.settings.findMany();
    const settingsObj = {};

    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });

    res.json(settingsObj);
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

module.exports = router;
