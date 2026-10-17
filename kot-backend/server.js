require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { rateLimit } = require('./middleware/rateLimit');
const session = require('express-session');
const passport = require('passport');
require('./routes/auth'); // Charger la configuration Passport
const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/upload');
const financeRoutes = require('./routes/finance');
const kitchenRoutes = require('./routes/kitchen');
const cashierRoutes = require('./routes/cashier');
const loyaltyRoutes = require('./routes/loyalty');
const settingsRoutes = require('./routes/settings');
const paymentsRoutes = require('./routes/payments');
const reviewsRoutes = require('./routes/reviews');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);

// Configuration session (nécessaire pour Passport)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24h
  }
}));

// Initialisation Passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware
const allowedOrigins = new Set(
  [process.env.FRONTEND_URL, ...(process.env.CORS_ORIGINS || '').split(',')]
    .map(origin => origin?.trim().replace(/\/$/, ''))
    .filter(Boolean)
);
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.add('http://localhost:3000');
  allowedOrigins.add('http://127.0.0.1:3000');
}
app.use(cors({
  origin(origin, callback) {
    // Non-browser clients and same-origin requests do not send an Origin header.
    if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  }
}));
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/payments/ebilling/webhook', express.urlencoded({
  extended: false,
  verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); }
}));
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/stripe/webhook') {
    return next();
  }
  return express.json()(req, res, next);
});

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));
// The reverse proxy forwards /api/* to this container; expose uploaded media there too.
app.use('/api/uploads', express.static('uploads'));

// Passport serialize/deserialize
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/cashier', cashierRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reviews', reviewsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
