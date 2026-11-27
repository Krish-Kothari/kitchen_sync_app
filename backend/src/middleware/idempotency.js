const prisma = require('../config/prisma');
const AppError = require('../utils/appError');

function idempotencyGuard({ required = true } = {}) {
  return async (req, res, next) => {
    try {
      const rawKey = req.headers['x-idempotency-key'];
      const key = typeof rawKey === 'string' ? rawKey.trim() : '';

      if (!key) {
        if (required) {
          throw new AppError('Missing required x-idempotency-key header', 400);
        }
        return next();
      }

      if (key.length < 8 || key.length > 128) {
        throw new AppError('x-idempotency-key must be between 8 and 128 characters', 400);
      }

      const existing = await prisma.idempotencyRecord.findUnique({
        where: { key },
      });

      if (existing) {
        res.set('X-Idempotent-Replay', 'true');
        return res.status(existing.responseStatus).json(existing.responseBody);
      }

      req.idempotencyKey = key;

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        const statusCode = res.statusCode || 200;

        if (statusCode >= 200 && statusCode < 500) {
          prisma.idempotencyRecord
            .upsert({
              where: { key },
              update: {},
              create: {
                key,
                endpoint: `${req.method} ${req.originalUrl}`,
                responseStatus: statusCode,
                responseBody: body,
              },
            })
            .catch((err) => {
              console.error('[idempotency] Failed to persist record:', err.message);
            });
        }

        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { idempotencyGuard };
