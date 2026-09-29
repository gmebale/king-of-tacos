const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const getAllowedRoleValues = async () => {
  const dbRoles = await prisma.role.findMany({
    where: { is_active: true },
    select: { slug: true }
  });

  return new Set([
    'client',
    'staff',
    'admin',
    'serveur',
    'caissier',
    'cuisinier',
    'bar',
    'manager',
    ...dbRoles.map((role) => role.slug)
  ]);
};

// Get all users (admin only)
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        role: true,
        pagePermissions: true,
        loyalty_points: true,
        is_active: true,
        created_at: true,
        updated_at: true
      },
      orderBy: { created_at: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create user (admin only)
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { email, password, full_name, phone, role, pagePermissions } = req.body;
    const { server_code } = req.body;

    // Validation
    const allowedRoles = await getAllowedRoleValues();
    if (!email || !full_name) {
      return res.status(400).json({ message: 'Email et nom complet sont requis' });
    }
    if (role && !allowedRoles.has(role)) {
      return res.status(400).json({ message: 'Rôle utilisateur invalide' });
    }
    if (role === 'serveur' && !/^[a-z0-9]{6}$/i.test(server_code || '')) {
      return res.status(400).json({ message: 'Le code serveur doit contenir exactement 6 lettres ou chiffres' });
    }

    // Vérifier si l'email existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // Hasher le mot de passe si fourni
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Créer l'utilisateur
    const roleRecord = role ? await prisma.role.findUnique({ where: { slug: role } }) : null;
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        full_name,
        phone: phone || null,
        role: role || 'client',
        role_id: roleRecord?.id,
        server_pin_hash: role === 'serveur' ? await bcrypt.hash(server_code.toUpperCase(), 10) : null,
        is_active: true,
        pagePermissions: pagePermissions ? pagePermissions : undefined
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        role: true,
        pagePermissions: true,
        loyalty_points: true,
        is_active: true,
        created_at: true
      }
    });

    res.status(201).json(user);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get active roles for the staff editor (admin only)
router.get('/roles', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      where: { is_active: true },
      select: { name: true, slug: true },
      orderBy: { name: 'asc' }
    });
    res.json(roles);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user by ID (admin only)
router.get('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        role: true,
        loyalty_points: true,
        is_active: true,
        created_at: true,
        updated_at: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user (admin only)
router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, role, is_active, password, pagePermissions } = req.body;
    const { server_code } = req.body;

    // Vérifier que l'utilisateur existe
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validation du rôle
    const allowedRoles = await getAllowedRoleValues();
    if (role && !allowedRoles.has(role)) {
      return res.status(400).json({ message: 'Rôle utilisateur invalide' });
    }
    const targetRole = role !== undefined ? role : existingUser.role;
    if (server_code && !/^[a-z0-9]{6}$/i.test(server_code)) {
      return res.status(400).json({ message: 'Le code serveur doit contenir exactement 6 lettres ou chiffres' });
    }
    if (targetRole === 'serveur' && !existingUser.server_pin_hash && !server_code) {
      return res.status(400).json({ message: 'Un code serveur doit être défini pour ce compte' });
    }

    // Empêcher qu'un utilisateur se désactive lui-même
    if (is_active === false && existingUser.id === req.user.id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous désactiver vous-même' });
    }

    // Empêcher la désactivation du dernier admin
    if (is_active === false && existingUser.role === 'admin') {
      const adminCount = await prisma.user.count({
        where: {
          role: 'admin',
          is_active: true
        }
      });

      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Impossible de désactiver le dernier administrateur' });
      }
    }

    // Préparer les données de mise à jour
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) {
      updateData.role = role;
      const roleRecord = await prisma.role.findUnique({ where: { slug: role } });
      updateData.role_id = roleRecord?.id || null;
      if (role !== 'serveur') updateData.server_pin_hash = null;
    }
    if (server_code) updateData.server_pin_hash = await bcrypt.hash(server_code.toUpperCase(), 10);
    if (is_active !== undefined) updateData.is_active = is_active;
    if (pagePermissions !== undefined) updateData.pagePermissions = pagePermissions;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        role: true,
        pagePermissions: true,
        loyalty_points: true,
        is_active: true,
        created_at: true,
        updated_at: true
      }
    });

    res.json(user);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Toggle user active status (admin only)
router.patch('/:id/toggle-active', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Empêcher qu'un utilisateur se désactive lui-même
    if (existingUser.is_active && existingUser.id === req.user.id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous désactiver vous-même' });
    }

    // Empêcher la désactivation du dernier admin
    if (existingUser.is_active && existingUser.role === 'admin') {
      const adminCount = await prisma.user.count({
        where: {
          role: 'admin',
          is_active: true
        }
      });

      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Impossible de désactiver le dernier administrateur' });
      }
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { is_active: !existingUser.is_active },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        role: true,
        loyalty_points: true,
        is_active: true,
        created_at: true,
        updated_at: true
      }
    });

    res.json(user);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Toggle user active error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur existe
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Empêcher qu'un utilisateur se supprime lui-même
    if (existingUser.id === req.user.id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous supprimer vous-même' });
    }

    // Empêcher la suppression du dernier admin
    if (existingUser.role === 'admin') {
      const adminCount = await prisma.user.count({
        where: {
          role: 'admin',
          is_active: true
        }
      });

      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Impossible de supprimer le dernier administrateur' });
      }
    }

    await prisma.user.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
