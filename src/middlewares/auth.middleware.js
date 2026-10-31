const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const ApiResponse = require('../utils/apiResponse');

/**
 * Extracts and verifies a Bearer JWT token from the Authorization header.
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return ApiResponse.error(
      res,
      'Unauthorized: Missing or invalid Authorization Bearer token',
      401
    );
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    req.user = decoded;
    req.userRole = decoded.role;
    if (decoded.providerId) {
      req.providerId = Number(decoded.providerId);
    }
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 'Unauthorized: Access token has expired', 401);
    }
    return ApiResponse.error(res, 'Unauthorized: Invalid access token', 401);
  }
}

/**
 * Optionally attaches decoded JWT user if Authorization header is present.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, env.jwt.secret);
      req.user = decoded;
      req.userRole = decoded.role;
      if (decoded.providerId) {
        req.providerId = Number(decoded.providerId);
      }
    } catch {
      // Ignore invalid token on optional routes
    }
  }
  next();
}

/**
 * Enforces tenant isolation by attaching the providerId (tenant) from JWT or x-provider-id header (FR-6.3, NFR-1).
 */
function requireProviderTenant(req, res, next) {
  const providerId = req.user?.providerId || req.headers['x-provider-id'];
  if (!providerId) {
    return ApiResponse.error(
      res,
      'Missing provider tenant context (login with a provider workspace role or supply x-provider-id header)',
      403
    );
  }
  req.providerId = Number(providerId);
  next();
}

/**
 * Checks if the requesting role (from decoded JWT or x-user-role header) is in the allowedRoles list.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const activeRole = req.user?.role || req.headers['x-user-role'];
    const allUserRoles = Array.isArray(req.user?.roles) ? req.user.roles : activeRole ? [activeRole] : [];

    const matchedRole = allowedRoles.find((r) => r === activeRole || allUserRoles.includes(r));
    if (!matchedRole) {
      return ApiResponse.error(
        res,
        `Forbidden: Requires one of roles [${allowedRoles.join(', ')}]`,
        403
      );
    }
    req.userRole = matchedRole;
    next();
  };
}

/**
 * Verifies that the user's role has the required granular permission in JWT claims or role_permissions.
 */
function requirePermission(permissionCode) {
  return async (req, res, next) => {
    try {
      if (Array.isArray(req.user?.permissions) && req.user.permissions.includes(permissionCode)) {
        return next();
      }

      const userRole = req.user?.role || req.headers['x-user-role'];
      if (!userRole) {
        return ApiResponse.error(res, 'Unauthorized: Missing user role context', 401);
      }

      const result = await query(
        `SELECT 1
         FROM role_permissions rp
         JOIN roles r ON r.id = rp.role_id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE r.code = $1 AND p.code = $2
         LIMIT 1`,
        [userRole, permissionCode]
      );

      if (result.rowCount === 0) {
        return ApiResponse.error(
          res,
          `Forbidden: Role "${userRole}" lacks required privilege "${permissionCode}"`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  authenticateJWT,
  optionalAuth,
  requireProviderTenant,
  requireRole,
  requirePermission,
};
