const express = require('express');
const { PrismaClient, ReviewStatus } = require('@prisma/client');
const { authenticateToken, requirePagePermission } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Helper to validate rating
function isValidRating(rating) {
  const value = Number(rating);
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

// Public homepage feed: only reviews approved by an administrator are exposed.
router.get('/public', async (_req, res) => {
  try {
    const where = { status: ReviewStatus.published };
    const [total, aggregate, rows] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.aggregate({ where, _avg: { rating: true } }),
      prisma.review.findMany({
        where,
        take: 6,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          rating: true,
          comment: true,
          created_at: true,
          user: { select: { full_name: true } }
        }
      })
    ]);
    res.json({
      total,
      average_rating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : 0,
      data: rows.map(({ user, ...review }) => {
        const [firstName, ...familyNames] = String(user?.full_name || '').trim().split(/\s+/).filter(Boolean);
        const customerName = firstName
          ? `${firstName}${familyNames.length ? ` ${familyNames[0].charAt(0).toUpperCase()}.` : ''}`
          : 'Client King Of Tacos';
        return { ...review, customer_name: customerName };
      })
    });
  } catch (error) {
    console.error('Get public reviews error:', error);
    res.status(500).json({ message: 'Impossible de charger les avis' });
  }
});

// Create a review (user, linked to an order)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { orderId, rating, comment } = req.body;
    const normalizedComment = typeof comment === 'string' ? comment.trim() : '';

    if (typeof orderId !== 'string' || !orderId.trim() || !isValidRating(rating) || !normalizedComment) {
      return res.status(400).json({ message: 'orderId, rating (1-5) et commentaire sont requis' });
    }

    if (normalizedComment.length > 800) {
      return res.status(400).json({ message: 'Commentaire trop long (800 caractères max)' });
    }

    // Check order ownership
    const order = await prisma.order.findUnique({
      where: { id: orderId.trim() },
      select: { id: true, user_id: true, status: true, payment_status: true }
    });

    if (!order) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }

    if (order.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Cette commande ne vous appartient pas' });
    }
    if (!['livree', 'servie', 'recuperee'].includes(order.status) || order.payment_status !== 'paid') {
      return res.status(409).json({ message: 'Un avis est possible après le service et la confirmation du paiement.' });
    }

    // One review per order per user
    const existing = await prisma.review.findFirst({
      where: { order_id: order.id, user_id: req.user.id }
    });

    if (existing) {
      return res.status(409).json({ message: 'Un avis existe déjà pour cette commande' });
    }

    const created = await prisma.review.create({
      data: {
        order_id: order.id,
        user_id: req.user.id,
        rating: Number(rating),
        comment: normalizedComment,
        status: ReviewStatus.pending
      }
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Erreur interne' });
  }
});

// List reviews (admin only) with filters/pagination
router.get('/', authenticateToken, requirePagePermission('reviews'), async (req, res) => {
  try {
    const { status, rating, search, page = 1, pageSize = 20 } = req.query;
    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = ((Number(page) || 1) - 1) * take;

    const where = {};

    if (status && Object.values(ReviewStatus).includes(status)) {
      where.status = status;
    }

    if (rating && isValidRating(rating)) {
      where.rating = Number(rating);
    }

    if (search) {
      where.comment = { contains: search, mode: 'insensitive' };
    }

    const [total, items] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: {
          user: { select: { id: true, full_name: true, email: true } },
          order: { select: { id: true, order_code: true, created_date: true } }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take
      })
    ]);

    res.json({
      data: items,
      total,
      page: Number(page) || 1,
      pageSize: take
    });
  } catch (error) {
    console.error('List reviews error:', error);
    res.status(500).json({ message: 'Erreur interne' });
  }
});

// Update status (publish/hide/pending)
router.patch('/:id/status', authenticateToken, requirePagePermission('reviews'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = Object.values(ReviewStatus);

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Statut invalide' });
    }

    const updated = await prisma.review.update({
      where: { id: req.params.id },
      data: { status }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update review status error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Avis introuvable' });
    }
    res.status(500).json({ message: 'Erreur interne' });
  }
});

module.exports = router;

