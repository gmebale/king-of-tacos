const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole, requirePagePermission } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
const prisma = new PrismaClient();
const clientRoleWhere = { OR: [{ role: 'client', role_id: null }, { roleRef: { is: { slug: 'client' } } }] };

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
    if (req.user.role !== 'client') return res.json([]);
    const rewards = await prisma.loyaltyReward.findMany({
      where: { is_active: true, expires_at: { gt: new Date() } },
      include: { giftedProduct: { select: { id: true, name: true, price: true, image: true } } },
      orderBy: { points_required: 'asc' }
    });
    const result = await Promise.all(rewards.map(async reward => {
      await expireRewardClaims(prisma, reward.id);
      const claimed = await prisma.loyaltyRedemption.count({ where: { reward_id: reward.id, status: { in: ['claimed', 'used'] } } });
      return { ...reward, available_quantity: reward.quantity_limit == null ? null : Math.max(0, reward.quantity_limit - claimed) };
    }));
    res.json(result);
  } catch (error) {
    console.error('Get loyalty rewards error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Redeem a reward
router.post('/redeem/:rewardId', authenticateToken, async (req, res) => {
  try {
    const { rewardId } = req.params;
    if (req.user.role !== 'client') return res.status(403).json({ message: 'La fidélité est réservée aux clients' });
    const redemption = await prisma.$transaction(async tx => {
      await expireRewardClaims(tx, rewardId);
      const reward = await tx.loyaltyReward.findUnique({ where: { id: rewardId }, include: { giftedProduct: true } });
      const now = new Date();
      if (!reward || !reward.is_active) throw Object.assign(new Error('Récompense indisponible'), { status: 404 });
      if (!reward.expires_at || reward.expires_at <= now || !reward.quantity_limit || reward.quantity_claimed >= reward.quantity_limit) {
        throw Object.assign(new Error('Cette récompense n’est plus disponible'), { status: 400 });
      }
      const reservation = await tx.loyaltyReward.updateMany({
        where: { id: reward.id, is_active: true, quantity_claimed: { lt: reward.quantity_limit } },
        data: { quantity_claimed: { increment: 1 } }
      });
      if (!reservation.count) throw Object.assign(new Error('Cette récompense vient d’être réclamée par un autre client'), { status: 409 });
      const debit = await tx.user.updateMany({
        where: { id: req.user.id, ...clientRoleWhere, loyalty_points: { gte: reward.points_required } },
        data: { loyalty_points: { decrement: reward.points_required } }
      });
      if (!debit.count) throw Object.assign(new Error('Points fidélité insuffisants'), { status: 400 });
      const created = await tx.loyaltyRedemption.create({ data: {
        user_id: req.user.id,
        reward_id: reward.id,
        points_used: reward.points_required,
        expires_at: reward.expires_at
      } });
      await tx.loyaltyPointEntry.create({ data: { user_id: req.user.id, type: 'redemption', points: -reward.points_required, reason: `Récompense réclamée : ${reward.name}` } });
      if (['discount', 'free_delivery'].includes(reward.type)) {
        const promo = await tx.promoCode.create({ data: {
          code: generateRewardCode(),
          description: reward.name,
          type: reward.type === 'discount' ? 'percentage' : 'free_delivery',
          value: reward.type === 'discount' ? reward.discount_percent : 0,
          max_uses: 1,
          user_id: req.user.id,
          expires_at: reward.expires_at
        } });
        return tx.loyaltyRedemption.update({ where: { id: created.id }, data: { promo_code_id: promo.id }, include: { reward: true, promoCode: true } });
      }
      return tx.loyaltyRedemption.findUnique({ where: { id: created.id }, include: { reward: { include: { giftedProduct: true } } } });
    });
    res.json({ message: 'Récompense réclamée', redemption });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
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
        reward: true,
        promoCode: true
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(redemptions);
  } catch (error) {
    console.error('Get redemption history error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/my-rewards', authenticateToken, async (req, res) => {
  if (req.user.role !== 'client') return res.json([]);
  try {
    const expiredClaims = await prisma.loyaltyRedemption.findMany({ where: { user_id: req.user.id, status: 'claimed', expires_at: { lte: new Date() } }, select: { reward_id: true } });
    for (const rewardId of new Set(expiredClaims.map(claim => claim.reward_id))) await expireRewardClaims(prisma, rewardId);
    const redemptions = await prisma.loyaltyRedemption.findMany({
      where: { user_id: req.user.id, status: 'claimed', OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] },
      include: { reward: { include: { giftedProduct: { select: { id: true, name: true, price: true } } } }, promoCode: true },
      orderBy: { created_at: 'desc' }
    });
    res.json(redemptions);
  } catch (error) {
    console.error('Get claimed rewards error:', error);
    res.status(500).json({ message: 'Impossible de charger vos récompenses' });
  }
});

router.get('/staff/customer', authenticateToken, requireRole(['serveur', 'caissier', 'admin']), async (req, res) => {
  const contact = String(req.query.contact || '').trim();
  if (contact.length < 5) return res.status(400).json({ message: 'Saisissez un téléphone ou un courriel complet.' });
  try {
    const matches = await prisma.user.findMany({
      where: { is_active: true, AND: [clientRoleWhere, { OR: [{ email: { equals: contact } }, { phone: { equals: contact } }] }] },
      select: { id: true, full_name: true, email: true, phone: true, loyalty_points: true },
      take: 2
    });
    if (matches.length !== 1) return res.status(matches.length ? 409 : 404).json({ message: matches.length ? 'Plusieurs clients correspondent. Utilisez le courriel du compte.' : 'Aucun compte client inscrit ne correspond.' });
    res.json(matches[0]);
  } catch (error) {
    console.error('Staff loyalty account lookup error:', error);
    res.status(500).json({ message: 'Impossible de rechercher le compte client.' });
  }
});

router.get('/admin/point-history', authenticateToken, requirePagePermission('loyalty'), async (_req, res) => {
  try {
    const entries = await prisma.loyaltyPointEntry.findMany({
      where: { type: 'manual_adjustment' },
      include: { user: { select: { id: true, full_name: true, email: true } }, actor: { select: { full_name: true } } },
      orderBy: { created_at: 'desc' }, take: 300
    });
    res.json(entries);
  } catch (error) {
    console.error('Get points history error:', error);
    res.status(500).json({ message: 'Impossible de charger l’historique des points' });
  }
});

router.post('/admin/points/:userId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const points = Number(req.body.points);
    const reason = String(req.body.reason || '').trim();
    if (!Number.isInteger(userId) || !Number.isInteger(points) || points === 0 || Math.abs(points) > 100000 || reason.length < 3 || reason.length > 191) {
      return res.status(400).json({ message: 'Indiquez un nombre entier de points non nul et un motif de 3 à 191 caractères.' });
    }
    const user = await prisma.user.findFirst({ where: { id: userId, ...clientRoleWhere } });
    if (!user) return res.status(404).json({ message: 'Compte client introuvable' });
    const result = await prisma.$transaction(async tx => {
      if (points < 0) {
        const updated = await tx.user.updateMany({ where: { id: userId, loyalty_points: { gte: -points } }, data: { loyalty_points: { decrement: -points } } });
        if (!updated.count) throw Object.assign(new Error('Le solde du client ne permet pas ce retrait'), { status: 400 });
      } else {
        await tx.user.update({ where: { id: userId }, data: { loyalty_points: { increment: points } } });
      }
      return tx.loyaltyPointEntry.create({ data: { user_id: userId, actor_id: req.user.id, type: 'manual_adjustment', points, reason } });
    });
    res.status(201).json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error('Manual points adjustment error:', error);
    res.status(500).json({ message: 'Impossible de modifier les points' });
  }
});

// Admin routes for loyalty rewards management
async function expireRewardClaims(tx, rewardId) {
  const expired = await tx.loyaltyRedemption.updateMany({
    where: { reward_id: rewardId, status: 'claimed', expires_at: { lte: new Date() } },
    data: { status: 'expired' }
  });
  if (expired.count) await tx.loyaltyReward.update({ where: { id: rewardId }, data: { quantity_claimed: { decrement: expired.count } } });
}

function generateRewardCode() {
  return `KOT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

// Get all loyalty rewards (admin only)
router.get('/admin/rewards', authenticateToken, requirePagePermission('loyalty'), async (req, res) => {
  try {
    const rewards = await prisma.loyaltyReward.findMany({
      include: { giftedProduct: { select: { id: true, name: true } } },
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
    const { name, description, type, points_required, quantity_limit, expires_at, discount_percent, gifted_product_id } = req.body;
    const points = Number(points_required);
    const limit = Number(quantity_limit);
    const expiry = new Date(expires_at);
    if (!name?.trim() || !['free_delivery', 'gifted_product', 'discount'].includes(type) || !Number.isInteger(points) || points <= 0 || !Number.isInteger(limit) || limit <= 0 || Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
      return res.status(400).json({ message: 'Nom, type, coût en points, quantité limitée et date d’expiration future sont obligatoires.' });
    }
    if (type === 'discount' && (!Number.isInteger(Number(discount_percent)) || Number(discount_percent) < 1 || Number(discount_percent) > 100)) return res.status(400).json({ message: 'La remise doit être comprise entre 1 et 100 %.' });
    if (type === 'gifted_product' && !(await prisma.product.findFirst({ where: { id: Number(gifted_product_id), available: true } }))) return res.status(400).json({ message: 'Sélectionnez un produit disponible à offrir.' });

    const reward = await prisma.loyaltyReward.create({
      data: {
        name,
        description,
        type,
        points_required: points,
        quantity_limit: limit,
        expires_at: expiry,
        discount_percent: type === 'discount' ? Number(discount_percent) : null,
        gifted_product_id: type === 'gifted_product' ? Number(gifted_product_id) : null
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
    const { name, description, type, points_required, is_active, quantity_limit, expires_at, discount_percent, gifted_product_id } = req.body;

    const current = await prisma.loyaltyReward.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ message: 'Récompense introuvable' });
    const limit = quantity_limit === undefined ? current.quantity_limit : Number(quantity_limit);
    const expiry = expires_at === undefined ? current.expires_at : new Date(expires_at);
    if (!Number.isInteger(limit) || limit < current.quantity_claimed || Number.isNaN(new Date(expiry).getTime())) return res.status(400).json({ message: 'La limite doit rester au moins égale au nombre déjà réclamé et la date doit être valide.' });
    const nextType = type || current.type;
    if (!['free_delivery', 'gifted_product', 'discount'].includes(nextType)) return res.status(400).json({ message: 'Type de récompense invalide.' });
    const nextPercent = discount_percent === undefined ? current.discount_percent : Number(discount_percent);
    const nextGift = gifted_product_id === undefined ? current.gifted_product_id : Number(gifted_product_id);
    if (points_required !== undefined && (!Number.isInteger(Number(points_required)) || Number(points_required) <= 0)) return res.status(400).json({ message: 'Les points requis doivent être un entier supérieur à zéro.' });
    if (nextType === 'discount' && (!Number.isInteger(nextPercent) || nextPercent < 1 || nextPercent > 100)) return res.status(400).json({ message: 'La remise doit être comprise entre 1 et 100 %.' });
    if (nextType === 'gifted_product' && !(await prisma.product.findFirst({ where: { id: nextGift, available: true } }))) return res.status(400).json({ message: 'Sélectionnez un produit disponible à offrir.' });

    const reward = await prisma.loyaltyReward.update({
      where: { id },
      data: {
        name,
        description,
        type,
        points_required: points_required ? parseInt(points_required) : undefined,
        is_active,
        quantity_limit: limit,
        expires_at: expiry,
        discount_percent: nextType === 'discount' ? nextPercent : null,
        gifted_product_id: nextType === 'gifted_product' ? nextGift : null
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

    if (await prisma.loyaltyRedemption.count({ where: { reward_id: id } })) {
      return res.status(409).json({ message: 'Cette récompense a déjà été réclamée. Désactivez-la pour conserver son historique.' });
    }

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
    const targetId = parseInt(userId, 10);
    if (!(await prisma.user.findFirst({ where: { id: targetId, ...clientRoleWhere } }))) return res.status(404).json({ message: 'Compte client introuvable' });
    const redemption = await prisma.$transaction(async tx => {
      await expireRewardClaims(tx, rewardId);
      const reward = await tx.loyaltyReward.findUnique({ where: { id: rewardId } });
      const now = new Date();
      if (!reward || !reward.is_active || !reward.expires_at || reward.expires_at <= now || !reward.quantity_limit || reward.quantity_claimed >= reward.quantity_limit) throw Object.assign(new Error('Récompense indisponible'), { status: 400 });
      const reservation = await tx.loyaltyReward.updateMany({ where: { id: rewardId, quantity_claimed: { lt: reward.quantity_limit } }, data: { quantity_claimed: { increment: 1 } } });
      if (!reservation.count) throw Object.assign(new Error('Récompense épuisée'), { status: 400 });
      const debit = await tx.user.updateMany({ where: { id: targetId, ...clientRoleWhere, loyalty_points: { gte: reward.points_required } }, data: { loyalty_points: { decrement: reward.points_required } } });
      if (!debit.count) throw Object.assign(new Error('Solde de points insuffisant'), { status: 400 });
      const created = await tx.loyaltyRedemption.create({ data: { user_id: targetId, reward_id: rewardId, points_used: reward.points_required, expires_at: reward.expires_at } });
      await tx.loyaltyPointEntry.create({ data: { user_id: targetId, actor_id: req.user.id, type: 'redemption', points: -reward.points_required, reason: `Récompense attribuée par l’administration : ${reward.name}` } });
      if (['discount', 'free_delivery'].includes(reward.type)) {
        const promo = await tx.promoCode.create({ data: { code: generateRewardCode(), description: reward.name, type: reward.type === 'discount' ? 'percentage' : 'free_delivery', value: reward.type === 'discount' ? reward.discount_percent : 0, max_uses: 1, user_id: targetId, expires_at: reward.expires_at } });
        return tx.loyaltyRedemption.update({ where: { id: created.id }, data: { promo_code_id: promo.id }, include: { reward: true, promoCode: true } });
      }
      return tx.loyaltyRedemption.findUnique({ where: { id: created.id }, include: { reward: { include: { giftedProduct: true } } } });
    });
    res.json({ message: 'Récompense attribuée', redemption });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error('Grant reward error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all users with loyalty points (admin only)
router.get('/admin/users', authenticateToken, requirePagePermission('loyalty'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: clientRoleWhere,
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
router.get('/admin/redemptions', authenticateToken, requirePagePermission('loyalty'), async (req, res) => {
  try {
    const redemptions = await prisma.loyaltyRedemption.findMany({
      include: {
        user: {
          select: { full_name: true, email: true }
        },
        reward: true,
        promoCode: true
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
router.get('/admin/promos', authenticateToken, requirePagePermission('loyalty'), async (req, res) => {
  try {
    const promos = await prisma.PromoCode.findMany({
      where: { user_id: null },
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

    if (!['percentage', 'fixed_amount', 'free_delivery'].includes(type)) return res.status(400).json({ message: 'Type de code promo invalide.' });

    if (type !== 'free_delivery' && (value === undefined || value === null || value === '')) {
      return res.status(400).json({ message: 'Value is required for this promo type' });
    }

    const normalizedValue =
      type === 'percentage'
        ? parseInt(value)
        : type === 'free_delivery'
          ? 0
          : toCents(value);
    if (type === 'percentage' && (!Number.isInteger(normalizedValue) || normalizedValue < 1 || normalizedValue > 100)) return res.status(400).json({ message: 'Le pourcentage doit être compris entre 1 et 100.' });
    if (type === 'fixed_amount' && (!Number.isInteger(normalizedValue) || normalizedValue <= 0)) return res.status(400).json({ message: 'Le montant de réduction doit être supérieur à zéro.' });
    if (max_uses !== undefined && max_uses !== null && max_uses !== '' && (!Number.isInteger(Number(max_uses)) || Number(max_uses) <= 0)) return res.status(400).json({ message: 'Le nombre maximal d’utilisations doit être supérieur à zéro.' });

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
    const { code, order_amount, order_type } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Promo code is required' });
    }
    const orderAmount = Number(order_amount);
    if (!Number.isFinite(orderAmount) || orderAmount < 0) return res.status(400).json({ message: 'Montant de commande invalide.' });

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!promo || !promo.is_active) {
      return res.status(404).json({ message: 'Invalid promo code' });
    }

    let authenticatedUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken');
        authenticatedUserId = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET).userId;
      } catch (_error) { /* Public promo codes may be used by guests. */ }
    }
    if (promo.user_id && promo.user_id !== authenticatedUserId) return res.status(403).json({ message: 'Ce code est réservé au compte qui a réclamé la récompense.' });

    if (promo.expires_at && new Date() > promo.expires_at) {
      return res.status(400).json({ message: 'Promo code has expired' });
    }

    if (promo.max_uses && promo.used_count >= promo.max_uses) {
      return res.status(400).json({ message: 'Promo code usage limit reached' });
    }

    if (promo.min_order_amount && orderAmount < promo.min_order_amount) {
      return res.status(400).json({ message: 'Minimum order amount not met' });
    }
    if (promo.type === 'free_delivery' && order_type && order_type !== 'livraison') return res.status(400).json({ message: 'Ce code est valable uniquement pour une livraison.' });

    res.json({
      valid: true,
      promo: {
        id: promo.id,
        code: promo.code,
        description: promo.description,
        type: promo.type,
        value: promo.value,
        expires_at: promo.expires_at,
        loyalty_reward: Boolean(promo.user_id)
      },
      discount_amount: promo.type === 'percentage'
        ? Math.min(orderAmount, Math.round(orderAmount * promo.value / 100))
        : promo.type === 'fixed_amount'
          ? Math.min(orderAmount, promo.value)
          : promo.type === 'free_delivery' ? (order_type === 'livraison' ? 2000 : 0) : 0
    });
  } catch (error) {
    console.error('Validate promo code error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
