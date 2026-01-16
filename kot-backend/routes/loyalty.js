const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get user loyalty points
router.get('/points', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { loyalty_points: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ points: user.loyalty_points });
  } catch (error) {
    console.error('Get loyalty points error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get loyalty rewards available for user
router.get('/rewards', authenticateToken, async (req, res) => {
  try {
    const rewards = await prisma.loyaltyReward.findMany({
      where: { is_active: true },
      orderBy: { points_required: 'asc' }
    });

    res.json(rewards);
  } catch (error) {
    console.error('Get loyalty rewards error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Redeem a reward
router.post('/redeem/:rewardId', authenticateToken, async (req, res) => {
  try {
    const { rewardId } = req.params;

    const reward = await prisma.loyaltyReward.findUnique({
      where: { id: rewardId }
    });

    if (!reward || !reward.is_active) {
      return res.status(404).json({ message: 'Reward not found or inactive' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { loyalty_points: true }
    });

    if (user.loyalty_points < reward.points_required) {
      return res.status(400).json({ message: 'Insufficient loyalty points' });
    }

    // Deduct points and create redemption record
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { loyalty_points: user.loyalty_points - reward.points_required }
      }),
      prisma.loyaltyRedemption.create({
        data: {
          user_id: req.user.id,
          reward_id: rewardId,
          points_used: reward.points_required
        }
      })
    ]);

    res.json({ message: 'Reward redeemed successfully' });
  } catch (error) {
    console.error('Redeem reward error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's redemption history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const redemptions = await prisma.loyaltyRedemption.findMany({
      where: { user_id: req.user.id },
      include: {
        reward: true
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(redemptions);
  } catch (error) {
    console.error('Get redemption history error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin routes for loyalty rewards management
const { requireRole } = require('../middleware/auth');

// Get all loyalty rewards (admin only)
router.get('/admin/rewards', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const rewards = await prisma.loyaltyReward.findMany({
      orderBy: { created_at: 'desc' }
    });

    res.json(rewards);
  } catch (error) {
    console.error('Get all loyalty rewards error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a new loyalty reward (admin only)
router.post('/admin/rewards', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { name, description, type, points_required } = req.body;

    if (!name || !type || !points_required) {
      return res.status(400).json({ message: 'Name, type, and points_required are required' });
    }

    const reward = await prisma.loyaltyReward.create({
      data: {
        name,
        description,
        type,
        points_required: parseInt(points_required)
      }
    });

    res.status(201).json(reward);
  } catch (error) {
    console.error('Create loyalty reward error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update a loyalty reward (admin only)
router.put('/admin/rewards/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type, points_required, is_active } = req.body;

    const reward = await prisma.loyaltyReward.update({
      where: { id },
      data: {
        name,
        description,
        type,
        points_required: points_required ? parseInt(points_required) : undefined,
        is_active
      }
    });

    res.json(reward);
  } catch (error) {
    console.error('Update loyalty reward error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Reward not found' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a loyalty reward (admin only)
router.delete('/admin/rewards/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.loyaltyReward.delete({
      where: { id }
    });

    res.json({ message: 'Reward deleted successfully' });
  } catch (error) {
    console.error('Delete loyalty reward error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Reward not found' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Grant reward to user (admin only)
router.post('/admin/grant/:userId/:rewardId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { userId, rewardId } = req.params;

    const reward = await prisma.loyaltyReward.findUnique({
      where: { id: rewardId }
    });

    if (!reward || !reward.is_active) {
      return res.status(404).json({ message: 'Reward not found or inactive' });
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { loyalty_points: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.loyalty_points < reward.points_required) {
      return res.status(400).json({ message: 'User has insufficient loyalty points' });
    }

    // Deduct points and create redemption record
    await prisma.$transaction([
      prisma.user.update({
        where: { id: parseInt(userId) },
        data: { loyalty_points: user.loyalty_points - reward.points_required }
      }),
      prisma.loyaltyRedemption.create({
        data: {
          user_id: parseInt(userId),
          reward_id: rewardId,
          points_used: reward.points_required
        }
      })
    ]);

    res.json({ message: 'Reward granted successfully' });
  } catch (error) {
    console.error('Grant reward error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all users with loyalty points (admin only)
router.get('/admin/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        full_name: true,
        email: true,
        loyalty_points: true,
        created_at: true
      },
      orderBy: { loyalty_points: 'desc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Get users with loyalty points error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all redemptions (admin only)
router.get('/admin/redemptions', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const redemptions = await prisma.loyaltyRedemption.findMany({
      include: {
        user: {
          select: { full_name: true, email: true }
        },
        reward: true
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(redemptions);
  } catch (error) {
    console.error('Get all redemptions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Promo codes management

// Helper: convert euro string/number to integer cents (null-safe)
const toCents = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'string' ? value.replace(',', '.') : value;
  const parsed = parseFloat(num);
  if (Number.isNaN(parsed)) return null;
  return Math.round(parsed * 100);
};

// Get all promo codes (admin only)
router.get('/admin/promos', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const promos = await prisma.PromoCode.findMany({
      orderBy: { created_at: 'desc' }
    });

    res.json(promos);
  } catch (error) {
    console.error('Get all promo codes error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a new promo code (admin only)
router.post('/admin/promos', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { code, description, type, value, min_order_amount, max_uses, expires_at } = req.body;

    if (!code || !type) {
      return res.status(400).json({ message: 'Code and type are required' });
    }

    if (type !== 'free_delivery' && (value === undefined || value === null || value === '')) {
      return res.status(400).json({ message: 'Value is required for this promo type' });
    }

    const normalizedValue =
      type === 'percentage'
        ? parseInt(value)
        : type === 'free_delivery'
          ? 0
          : toCents(value);

    const normalizedMinAmount = toCents(min_order_amount);

    const promo = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        description,
        type,
        value: normalizedValue,
        min_order_amount: normalizedMinAmount,
        max_uses: max_uses ? parseInt(max_uses) : null,
        expires_at: expires_at ? new Date(expires_at) : null,
        is_active: req.body.is_active !== undefined ? req.body.is_active : true
      }
    });

    res.status(201).json(promo);
  } catch (error) {
    console.error('Create promo code error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Promo code already exists' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update a promo code (admin only)
router.put('/admin/promos/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, description, type, value, min_order_amount, max_uses, is_active, expires_at } = req.body;

    const normalizedValue =
      type === 'percentage'
        ? (value !== undefined && value !== null && value !== '' ? parseInt(value) : undefined)
        : type === 'free_delivery'
          ? 0
          : (value !== undefined && value !== null && value !== '' ? toCents(value) : undefined);

    const normalizedMinAmount =
      min_order_amount !== undefined && min_order_amount !== null && min_order_amount !== ''
        ? toCents(min_order_amount)
        : undefined;

    const promo = await prisma.promoCode.update({
      where: { id },
      data: {
        code: code ? code.toUpperCase() : undefined,
        description,
        type,
        value: normalizedValue,
        min_order_amount: normalizedMinAmount,
        max_uses: max_uses ? parseInt(max_uses) : null,
        is_active,
        expires_at: expires_at ? new Date(expires_at) : null
      }
    });

    res.json(promo);
  } catch (error) {
    console.error('Update promo code error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Promo code not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Promo code already exists' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a promo code (admin only)
router.delete('/admin/promos/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.promoCode.delete({
      where: { id }
    });

    res.json({ message: 'Promo code deleted successfully' });
  } catch (error) {
    console.error('Delete promo code error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Promo code not found' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Validate promo code (public)
router.post('/validate-promo', async (req, res) => {
  try {
    const { code, order_amount } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Promo code is required' });
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!promo || !promo.is_active) {
      return res.status(404).json({ message: 'Invalid promo code' });
    }

    if (promo.expires_at && new Date() > promo.expires_at) {
      return res.status(400).json({ message: 'Promo code has expired' });
    }

    if (promo.max_uses && promo.used_count >= promo.max_uses) {
      return res.status(400).json({ message: 'Promo code usage limit reached' });
    }

    if (promo.min_order_amount && order_amount < promo.min_order_amount) {
      return res.status(400).json({ message: 'Minimum order amount not met' });
    }

    res.json({
      valid: true,
      promo: {
        id: promo.id,
        code: promo.code,
        description: promo.description,
        type: promo.type,
        value: promo.value
      }
    });
  } catch (error) {
    console.error('Validate promo code error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
