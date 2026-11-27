const AppError = require('../utils/appError');
const { verifyToken } = require('../utils/auth');

function requireAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('Authorization token missing or malformed', 401);
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError('Authorization token missing', 401);
    }

    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Session expired, please log in again', 401));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid authentication token', 401));
    }
    next(err);
  }
}

function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('Forbidden: insufficient role permissions', 403));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
