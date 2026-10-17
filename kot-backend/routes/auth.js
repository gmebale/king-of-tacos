const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const appleSignin = require('apple-signin-auth');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { rateLimit } = require('../middleware/rateLimit');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Configuration Passport Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_REDIRECT_URI
},
async (accessToken, refreshToken, profile, done) => {
  try {
    // Recherche ou création d'utilisateur
    let user = await prisma.user.findUnique({
      where: { google_id: profile.id }
    });

    if (!user) {
      // Vérifier si l'email existe déjà
      const existingUser = await prisma.user.findUnique({
        where: { email: profile.emails[0].value }
      });

      if (existingUser) {
        if (!existingUser.is_active) return done(null, false);
        // Lier le compte Google existant
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: { google_id: profile.id }
        });
      } else {
        // Créer nouveau utilisateur
        user = await prisma.user.create({
          data: {
            google_id: profile.id,
            email: profile.emails[0].value,
            full_name: profile.displayName,
            password: null
          }
        });
      }
    }
    if (!user.is_active) return done(null, false);
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// Routes Google OAuth
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const code = crypto.randomBytes(32).toString('base64url');
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const now = new Date();
      await prisma.googleLoginCode.deleteMany({ where: { expires_at: { lte: now } } });
      await prisma.googleLoginCode.create({
        data: { code_hash: codeHash, user_id: req.user.id, expires_at: new Date(now.getTime() + 2 * 60 * 1000) }
      });
      const redirectUrl = new URL('/login', process.env.FRONTEND_URL);
      redirectUrl.searchParams.set('code', code);
      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('Google login exchange code error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth`);
    }
  }
);

router.post('/oauth/exchange', rateLimit({ windowMs: 15 * 60 * 1000, max: 12, message: 'Trop de tentatives de connexion. Réessayez plus tard.' }), async (req, res) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    if (code.length < 40 || code.length > 64) return res.status(401).json({ message: 'Code de connexion invalide ou expiré.' });
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const loginCode = await prisma.googleLoginCode.findUnique({ where: { code_hash: codeHash }, select: { user_id: true, expires_at: true } });
    const now = new Date();
    if (!loginCode || loginCode.expires_at <= now) return res.status(401).json({ message: 'Code de connexion invalide ou expiré.' });
    const consumed = await prisma.googleLoginCode.deleteMany({ where: { code_hash: codeHash, expires_at: { gt: now } } });
    if (!consumed.count) return res.status(401).json({ message: 'Ce code de connexion a déjà été utilisé.' });
    const user = await prisma.user.findFirst({ where: { id: loginCode.user_id, is_active: true }, select: { id: true, email: true } });
    if (!user) return res.status(401).json({ message: 'Compte désactivé ou introuvable.' });
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.set('Cache-Control', 'no-store');
    res.json({ token });
  } catch (error) {
    console.error('Google login exchange error:', error);
    res.status(500).json({ message: 'Impossible de terminer la connexion Google.' });
  }
});

// Route Sign in with Apple
router.post('/apple', async (req, res) => {
  try {
    const { identityToken, authorizationCode } = req.body;
    if (!identityToken) return res.status(400).json({ message: 'Jeton Apple requis.' });

    // Vérifier le jeton Apple et son expiration
    let appleUser;
    try {
      appleUser = await appleSignin.verifyIdToken(identityToken, {
        audience: process.env.APPLE_CLIENT_ID,
      });
    } catch (_tokenError) {
      return res.status(401).json({ message: 'Jeton Apple invalide ou expiré.' });
    }

    // Recherche ou création utilisateur
    let user = await prisma.user.findUnique({
      where: { apple_id: appleUser.sub }
    });

    if (!user) {
      const existingUser = await prisma.user.findUnique({
        where: { email: appleUser.email }
      });

      if (existingUser) {
        if (!existingUser.is_active) return res.status(403).json({ message: 'Ce compte est désactivé.' });
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: { apple_id: appleUser.sub }
        });
      } else {
        user = await prisma.user.create({
          data: {
            apple_id: appleUser.sub,
            email: appleUser.email,
            full_name: appleUser.email.split('@')[0], // Nom temporaire
            password: null
          }
        });
      }
    }
    if (!user.is_active) return res.status(403).json({ message: 'Ce compte est désactivé.' });

    // Générer token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Apple auth error:', error);
    res.status(500).json({ message: 'Erreur authentification Apple' });
  }
});

// Register
router.post('/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 6, message: 'Trop de tentatives d’inscription depuis cette connexion. Réessayez plus tard.' }), async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const full_name = typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Adresse e-mail invalide.' });
    }
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères et ne pas dépasser 72 octets.' });
    }
    if (full_name.length < 2 || full_name.length > 100 || /[\u0000-\u001f\u007f]/.test(full_name)) {
      return res.status(400).json({ message: 'Le nom doit contenir entre 2 et 100 caractères.' });
    }
    if (phone && (phone.length > 25 || !/^\+?[0-9][0-9 ()-]{5,22}$/.test(phone))) {
      return res.status(400).json({ message: 'Numéro de téléphone invalide.' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        full_name,
        phone
      }
    });

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'Cette adresse e-mail est déjà utilisée.' });
    console.error('Register error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login
router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true, message: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' }), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!user.is_active) {
      return res.status(403).json({ message: 'Ce compte est désactivé.' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        role: true,
        pagePermissions: true,
        created_at: true
      }
    });

    res.json({
      ...user,
      role: req.user.role,
      roleName: req.user.roleRef?.name || req.user.role,
      pagePermissions: req.user.pagePermissions
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { full_name, phone },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        role: true,
        pagePermissions: true
      }
    });

    res.json({
      ...user,
      role: req.user.role,
      roleName: req.user.roleRef?.name || req.user.role,
      pagePermissions: req.user.pagePermissions
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
