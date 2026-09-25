const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const normalizeRole = (user) => {
  if (!user) return 'client';
  if (typeof user.role === 'string') return user.role;
  if (user.role && typeof user.role === 'object' && user.role.slug) return user.role.slug;
  return 'client';
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
        roleRef: true,
        userPermissions: { include: { permission: true } }
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const roleValue = normalizeRole(user);
    const permissionMap = {};
    if (Array.isArray(user.userPermissions)) {
      user.userPermissions.forEach((entry) => {
        if (entry.permission && entry.permission.code) {
          permissionMap[entry.permission.code] = entry.granted;
        }
      });
    }

    req.user = {
      ...user,
      role: roleValue,
      permissions: permissionMap,
      pagePermissions: user.pagePermissions || permissionMap
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

const requirePagePermission = (pageKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const roleName = normalizeRole(req.user);
    if (roleName === 'admin') {
      return next();
    }

    const pagePermissions = req.user.pagePermissions || {};
    if (pagePermissions[pageKey] === true) {
      return next();
    }

    if (req.user.permissions && req.user.permissions[pageKey] === true) {
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
