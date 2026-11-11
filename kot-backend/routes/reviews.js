const express = require('express');
const { PrismaClient, ReviewStatus } = require('@prisma/client');
const { authenticateToken, requirePagePermission, requirePermission } = require('../middleware/auth');
const fetch = require('node-fetch');
const { rateLimit } = require('../middleware/rateLimit');

const router = express.Router();
const prisma = new PrismaClient();

// Google Places content is fetched live and is never persisted or cached here.
router.get('/google', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Trop de demandes d’avis Google. Réessayez dans quelques minutes.'
}), async (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!apiKey || !placeId) {
    return res.status(503).json({ configured: false, message: 'Les avis Google ne sont pas configurés.' });
  }

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=fr&regionCode=GA`,
      {
        method: 'GET',
        timeout: 8000,
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews,googleMapsUri'
        }
      }
    );

    if (!response.ok) {
      console.error(`Google Places request failed with status ${response.status}`);
      return res.status(502).json({ message: 'Les avis Google sont temporairement indisponibles.' });
    }

    const place = await response.json();
    const reviews = Array.isArray(place.reviews) ? place.reviews.slice(0, 5).map(review => ({
      rating: Number(review.rating) || 0,
      text: review.text?.text || review.originalText?.text || '',
      translated: Boolean(review.text?.text && review.originalText?.text && review.text.text !== review.originalText.text),
      published_description: review.relativePublishTimeDescription || '',
      author: {
        name: review.authorAttribution?.displayName || 'Client Google',
        uri: review.authorAttribution?.uri || null,
        photo_uri: review.authorAttribution?.photoUri || null
      },
      review_url: review.googleMapsUri || null,
      report_url: review.flagContentUri || null
    })) : [];

    return res.json({
      configured: true,
      source: 'google',
      display_name: place.displayName?.text || 'King Of Tacos',
      average_rating: Number(place.rating) || 0,
      total: Number(place.userRatingCount) || 0,
      place_url: place.googleMapsUri || null,
      review_url: process.env.GOOGLE_REVIEW_URL || null,
      reviews
    });
  } catch (error) {
    console.error('Get Google reviews error:', error.message);
    return res.status(502).json({ message: 'Les avis Google sont temporairement indisponibles.' });
  }
});

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
          user: { select: { id: true } }
        }
      })
    ]);
    res.json({
      total,
      average_rating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(1)) : 0,
      data: rows.map(({ user, ...review }) => {
        const customerName = user?.id ? `Client ${String(user.id).slice(-4)}` : 'Client vérifié';
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
router.patch('/:id/status', authenticateToken, requirePagePermission('reviews'), requirePermission('reviews.access'), async (req, res) => {
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

