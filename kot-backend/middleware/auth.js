const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const normalizeRole = (user) => {
  if (!user) return 'client';
  if (user.roleRef && user.roleRef.slug) return user.roleRef.slug;
  if (typeof user.role === 'string') return user.role;
  if (user.role && typeof user.role === 'object' && user.role.slug) return user.role.slug;
  return 'client';
};

const PAGE_PERMISSION_KEYS = [
  'dashboard', 'orders', 'kitchen', 'cashier', 'stock',
  'kitchen_hot', 'kitchen_cold', 'bar', 'finance', 'settings',
  'staff', 'reviews', 'customers', 'loyalty'
];

const addPermission = (map, permission, granted) => {
  if (!permission?.code) return;

  const code = permission.code.toLowerCase();
  const module = permission.module?.toLowerCase();
  map[permission.code] = granted;

  for (const pageKey of PAGE_PERMISSION_KEYS) {
    const tokens = code.split(/[._:-]/);
    if (module === pageKey || tokens.includes(pageKey)) {
      map[pageKey] = granted;
    }
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
    const permissionMap = {};
    if (Array.isArray(user.roleRef?.rolePermissions)) {
      user.roleRef.rolePermissions.forEach((entry) => {
        addPermission(permissionMap, entry.permission, entry.granted);
      });
    }
    if (Array.isArray(user.userPermissions)) {
      user.userPermissions.forEach((entry) => {
        addPermission(permissionMap, entry.permission, entry.granted);
      });
    }

    const pagePermissions = {
      ...permissionMap,
      ...(user.pagePermissions && typeof user.pagePermissions === 'object' ? user.pagePermissions : {})
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
  normalizeRole
};
