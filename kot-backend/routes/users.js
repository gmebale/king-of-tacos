const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { authenticateToken, requireRole, requirePermission, hasPermission } = require('../middleware/auth');
const { ACCESS_PERMISSIONS, PROFILE_GRANTS, ROLE_PROFILES } = require('../config/accessControl');

const router = express.Router();
const prisma = new PrismaClient();
let accessCatalogPromise = null;

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

const ensureAccessCatalog = () => {
  if (!accessCatalogPromise) {
    accessCatalogPromise = (async () => {
      const permissionRecords = await Promise.all(ACCESS_PERMISSIONS.map(permission => prisma.permission.upsert({
        where: { code: permission.code },
        update: { label: permission.label, module: permission.module },
        create: permission
      })));
      for (const roleData of ROLE_PROFILES) {
        const role = await prisma.role.upsert({
          where: { slug: roleData.slug },
          update: { name: roleData.name, description: roleData.description },
          create: { name: roleData.name, slug: roleData.slug, description: roleData.description }
        });
        const grants = new Set(PROFILE_GRANTS[roleData.profile] || []);
        await prisma.rolePermission.createMany({
          data: permissionRecords.map(permission => ({ role_id: role.id, permission_id: permission.id, granted: grants.has(permission.code) })),
          skipDuplicates: true
        });
      }
      const kitchenPermissions = await prisma.permission.findMany({ select: { id: true, code: true } });
      const barRole = await prisma.role.findUnique({ where: { slug: 'bar' } });
      if (barRole) {
        const grants = new Set(PROFILE_GRANTS.cuisine);
        await prisma.rolePermission.createMany({
          data: kitchenPermissions.map(permission => ({ role_id: barRole.id, permission_id: permission.id, granted: grants.has(permission.code) })),
          skipDuplicates: true
        });
      }
      return true;
    })().catch(error => {
      accessCatalogPromise = null;
      throw error;
    });
  }
  return accessCatalogPromise;
};

const prepareAccessCatalog = async (_req, res, next) => {
  try {
    await ensureAccessCatalog();
    next();
  } catch (error) {
    console.error('Prepare access catalog error:', error);
    res.status(500).json({ message: 'Impossible de préparer les droits d’accès.' });
  }
};

const recordAccessChange = (actor, action, details) => prisma.log.create({
  data: { user_id: actor.id, role: actor.role || 'admin', action, details }
}).catch(error => console.warn('Unable to write access audit entry:', error));

// Get all users (admin only)
router.get('/', prepareAccessCatalog, authenticateToken, requirePermission('admin.users.create'), async (req, res) => {
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
router.post('/', prepareAccessCatalog, authenticateToken, requirePermission('admin.users.create'), async (req, res) => {
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
    if (req.user.role !== 'admin' && ['admin', 'manager', 'responsable_service'].includes(role)) {
      return res.status(403).json({ message: 'Vous ne pouvez pas attribuer ce niveau de rôle.' });
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
        pagePermissions: req.user.role === 'admin' && pagePermissions ? pagePermissions : undefined
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

    await recordAccessChange(req.user, 'access_user_created', `Compte créé pour l’utilisateur ${user.full_name} (ID ${user.id}), profil ${user.role}.`);
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
router.get('/roles', prepareAccessCatalog, authenticateToken, requirePermission('admin.users.create'), async (req, res) => {
  try {
    await ensureAccessCatalog();
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

// Permission catalog and role matrix for the detailed access module.
router.get('/access/roles', authenticateToken, requireRole(['admin']), async (_req, res) => {
  try {
    await ensureAccessCatalog();
    const roles = await prisma.role.findMany({
      where: { is_active: true, slug: { in: ROLE_PROFILES.map(role => role.slug) } },
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { id: 'asc' }
    });
    const orderedRoles = roles.sort((a, b) => ROLE_PROFILES.findIndex(profile => profile.slug === a.slug) - ROLE_PROFILES.findIndex(profile => profile.slug === b.slug));
    res.json({ permissions: ACCESS_PERMISSIONS, roles: orderedRoles.map(role => ({
      id: role.id, slug: role.slug, name: role.name, description: role.description,
      permissions: Object.fromEntries(role.rolePermissions.map(entry => [entry.permission.code, entry.granted]))
    })) });
  } catch (error) {
    console.error('Get access matrix error:', error);
    res.status(500).json({ message: 'Impossible de charger la matrice des droits.' });
  }
});

router.put('/access/roles/:slug', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    await ensureAccessCatalog();
    const role = await prisma.role.findUnique({ where: { slug: req.params.slug } });
    if (!role || !ROLE_PROFILES.some(profile => profile.slug === role.slug)) return res.status(404).json({ message: 'Profil introuvable.' });
    const permissions = req.body?.permissions;
    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) return res.status(400).json({ message: 'Matrice de permissions invalide.' });
    const knownCodes = new Set(ACCESS_PERMISSIONS.map(permission => permission.code));
    if (Object.keys(permissions).some(code => !knownCodes.has(code)) || Object.values(permissions).some(value => typeof value !== 'boolean')) {
      return res.status(400).json({ message: 'La matrice contient des droits inconnus ou des valeurs invalides.' });
    }
    if (role.slug === 'admin' && ACCESS_PERMISSIONS.some(({ code }) => permissions[code] !== true)) {
      return res.status(400).json({ message: 'Le profil Direction conserve tous les droits.' });
    }
    // Resolve relation ids once to keep the bulk update explicit and deterministic.
    const catalog = await prisma.permission.findMany({ where: { code: { in: ACCESS_PERMISSIONS.map(permission => permission.code) } }, select: { id: true, code: true } });
    const permissionIds = new Map(catalog.map(permission => [permission.code, permission.id]));
    const updates = ACCESS_PERMISSIONS.map(({ code }) => prisma.rolePermission.upsert({
      where: { role_id_permission_id: { role_id: role.id, permission_id: permissionIds.get(code) } },
      update: { granted: permissions[code] === true },
      create: { role_id: role.id, permission_id: permissionIds.get(code), granted: permissions[code] === true }
    }));
    await prisma.$transaction(updates);
    await recordAccessChange(req.user, 'access_role_permissions_updated', `Matrice de droits modifiée pour le profil ${role.name}.`);
    res.json({ message: 'Droits du profil enregistrés.' });
  } catch (error) {
    console.error('Update access matrix error:', error);
    res.status(500).json({ message: 'Impossible d’enregistrer la matrice des droits.' });
  }
});

router.get('/access/audit', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const entries = await prisma.log.findMany({
      where: { action: { startsWith: 'access_' } },
      include: { user: { select: { id: true, full_name: true, role: true } } },
      orderBy: { created_at: 'desc' }, take: 200
    });
    res.json(entries);
  } catch (error) {
    console.error('Get access audit error:', error);
    res.status(500).json({ message: 'Impossible de charger le journal des droits.' });
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
router.put('/:id', prepareAccessCatalog, authenticateToken, requirePermission('admin.users.create'), async (req, res) => {
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
    if (req.user.role !== 'admin' && role !== undefined && role !== existingUser.role) {
      return res.status(403).json({ message: 'Seule la Direction peut modifier le rôle d’un utilisateur.' });
    }
    if (req.user.role !== 'admin' && is_active === false && !hasPermission(req.user, 'admin.users.disable')) {
      return res.status(403).json({ message: 'Vous n’êtes pas autorisé à désactiver les comptes.' });
    }
    if (req.user.role !== 'admin' && (server_code || password)) {
      return res.status(403).json({ message: 'Seule la Direction peut modifier les identifiants de connexion.' });
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
    if (pagePermissions !== undefined && req.user.role === 'admin') updateData.pagePermissions = pagePermissions;
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

    await recordAccessChange(req.user, 'access_user_updated', `Compte mis à jour pour l’utilisateur ${user.full_name} (ID ${user.id}).`);
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
router.patch('/:id/toggle-active', prepareAccessCatalog, authenticateToken, requirePermission('admin.users.disable'), async (req, res) => {
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

    await recordAccessChange(req.user, user.is_active ? 'access_user_activated' : 'access_user_disabled', `Compte ${user.is_active ? 'activé' : 'désactivé'} pour ${user.full_name} (ID ${user.id}).`);
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
