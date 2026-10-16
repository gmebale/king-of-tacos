const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { ACCESS_MODULES, deriveModuleAccess } = require('../config/accessControl');

const prisma = new PrismaClient();

const normalizeRole = (user) => {
  if (!user) return 'client';
  if (user.roleRef && user.roleRef.slug) return user.roleRef.slug;
  if (typeof user.role === 'string') return user.role;
  if (user.role && typeof user.role === 'object' && user.role.slug) return user.role.slug;
  return 'client';
};

const PAGE_CODE_PREFIXES = {
  dashboard: ['dashboard.', 'reports.sales_total'], orders: ['orders.'], kitchen: ['kitchen.'], kitchen_hot: ['kitchen.cuisine.'], kitchen_cold: ['kitchen.cuisine.'], bar: ['kitchen.bar.'], cashier: ['payments.', 'cash.', 'discounts.'],
  stock: ['stock.', 'admin.products', 'admin.prices', 'admin.menus'], finance: ['reports.sales_total', 'reports.sales_detail', 'reports.margins', 'reports.export'],
  settings: ['admin.settings'], staff: ['admin.users.', 'admin.access.'], loyalty: ['loyalty.'], reviews: ['reviews.'], customers: ['customers.']
};

const addPermission = (map, permission, granted) => {
  if (!permission?.code) return;

  map[permission.code] = granted;
};

const hasPermission = (user, code) => {
  if (!user) return false;
  if (normalizeRole(user) === 'admin') return true;
  if (user.permissions && Object.prototype.hasOwnProperty.call(user.permissions, code)) return user.permissions[code] === true;
  if (user.pagePermissions && Object.prototype.hasOwnProperty.call(user.pagePermissions, code)) return user.pagePermissions[code] === true;
  return false;
};

const requirePermission = (code) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  if (!hasPermission(req.user, code)) return res.status(403).json({ message: 'Accès refusé à cette opération' });
  next();
};

const requireStaffActionCode = async (req, res, next) => {
  try {
    const code = String(req.body?.staff_action_code || '');
    if (!req.user?.server_pin_hash) return res.status(428).json({ message: 'Aucun code personnel n’est configuré pour ce compte. Demandez à la Direction de le définir.' });
    if (!code || !(await bcrypt.compare(code.toUpperCase(), req.user.server_pin_hash))) return res.status(403).json({ message: 'Code personnel de confirmation incorrect.' });
    next();
  } catch (error) {
    console.error('Verify staff action code error:', error);
    res.status(500).json({ message: 'Impossible de vérifier le code personnel.' });
  }
};

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        roleRef: {
          include: {
            rolePermissions: { include: { permission: true } }
          }
        },
        userPermissions: { include: { permission: true } }
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (!user.is_active) {
      return res.status(403).json({ message: 'Ce compte est désactivé.' });
    }

    const roleValue = normalizeRole(user);
    const rolePermissionMap = {};
    const userPermissionMap = {};
    if (Array.isArray(user.roleRef?.rolePermissions)) {
      user.roleRef.rolePermissions.forEach((entry) => {
        addPermission(rolePermissionMap, entry.permission, entry.granted);
      });
    }
    if (Array.isArray(user.userPermissions)) {
      user.userPermissions.forEach((entry) => {
        addPermission(userPermissionMap, entry.permission, entry.granted);
      });
    }

    const permissionMap = { ...rolePermissionMap, ...userPermissionMap };
    const derivedPages = {};
    for (const [pageKey, prefixes] of Object.entries(PAGE_CODE_PREFIXES)) {
      const relevantCodes = Object.keys(permissionMap).filter(code => prefixes.some(prefix => prefix.endsWith('.') ? code.startsWith(prefix) : code === prefix));
      if (relevantCodes.length) derivedPages[pageKey] = relevantCodes.some(code => permissionMap[code] === true);
    }
    const allKitchenCodes = Object.keys(permissionMap).filter(code => code.startsWith('kitchen.'));
    if (allKitchenCodes.length) derivedPages.kitchen = allKitchenCodes.some(code => permissionMap[code] === true);

    const savedPagePermissions = user.pagePermissions && typeof user.pagePermissions === 'object' ? user.pagePermissions : {};
    const explicitModuleAccess = savedPagePermissions.__moduleAccess && typeof savedPagePermissions.__moduleAccess === 'object'
      ? savedPagePermissions.__moduleAccess
      : {};
    const legacyEnabledPages = Object.fromEntries(ACCESS_MODULES
      .filter(({ key }) => savedPagePermissions[key] === true)
      .map(({ key }) => [key, true]));
    const pagePermissions = {
      ...derivedPages,
      ...deriveModuleAccess(permissionMap, savedPagePermissions),
      ...legacyEnabledPages,
      ...permissionMap,
      ...explicitModuleAccess
    };

    req.user = {
      ...user,
      role: roleValue,
      permissions: permissionMap,
      pagePermissions
    };
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(normalizeRole(req.user))) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

const requirePagePermission = (...pageKeys) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const roleName = normalizeRole(req.user);
    if (roleName === 'admin') {
      return next();
    }

    const pagePermissions = req.user.pagePermissions || {};
    if (pageKeys.some((pageKey) => pagePermissions[pageKey] === true)) {
      return next();
    }

    if (req.user.permissions && pageKeys.some((pageKey) => req.user.permissions[pageKey] === true)) {
      return next();
    }

    return res.status(403).json({ message: 'Accès refusé à cette page' });
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requirePagePermission,
  requirePermission,
  requireStaffActionCode,
  hasPermission,
  normalizeRole
};
