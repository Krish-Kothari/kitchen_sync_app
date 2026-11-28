const crypto = require('crypto');
const prisma = require('../config/prisma');
const config = require('../config/env');
const AppError = require('../utils/appError');
const { isValidCoordinate, getHubRoomKey } = require('../utils/geo');
const { resolveTierPrice } = require('../utils/tierPricing');
const { findNearbyOpenPools } = require('../services/spatial.service');

async function getNearbyPools(req, res, next) {
  try {
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: req.user.id },
      select: { latitude: true, longitude: true, locality: true },
    });

    if (!kitchen) {
      throw new AppError('Kitchen profile not found', 404);
    }

    const lat = req.query.latitude !== undefined ? Number(req.query.latitude) : kitchen.latitude;
    const lng = req.query.longitude !== undefined ? Number(req.query.longitude) : kitchen.longitude;

    if (!isValidCoordinate(lat, lng)) {
      throw new AppError('Invalid latitude or longitude query parameters', 400);
    }

    const radiusMeters = Number(req.query.radiusMeters) || config.defaultRadiusMeters;
    const commodityId = req.query.commodityId ? String(req.query.commodityId) : null;

    const pools = await findNearbyOpenPools({
      latitude: lat,
      longitude: lng,
      radiusMeters,
      commodityId,
    });

    res.status(200).json({
      origin: { latitude: lat, longitude: lng, locality: kitchen.locality },
      radiusMeters,
      count: pools.length,
      pools,
    });
  } catch (err) {
    next(err);
  }
}

async function getPoolById(req, res, next) {
  try {
    const { poolId } = req.params;

    const pool = await prisma.orderPool.findUnique({
      where: { id: poolId },
      include: {
        commodity: {
          include: {
            tiers: { orderBy: { minWeight: 'asc' } },
            wholesaler: {
              select: {
                id: true,
                businessName: true,
                mandiAddress: true,
                rating: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, locality: true },
        },
        subOrders: {
          where: { status: { not: 'CANCELLED' } },
          include: {
            kitchen: {
              select: { id: true, name: true, locality: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!pool) {
      throw new AppError('Order pool not found', 404);
    }

    const pricing = resolveTierPrice(
      pool.commodity.retailPrice,
      pool.commodity.tiers,
      pool.currentWeight
    );

    res.status(200).json({
      pool: {
        ...pool,
        hubRoomKey: getHubRoomKey(pool.centerLatitude, pool.centerLongitude),
        participantsCount: pool.subOrders.length,
        moqReached: pool.currentWeight >= pool.moqWeight,
        fillPercent: Math.min(
          100,
          Math.round((pool.currentWeight / Math.max(pool.moqWeight, 1)) * 100)
        ),
        pricing,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function createSeedPool(req, res, next) {
  try {
    const { commodityId, quantityWeight, cutoffHours = 4, radiusMeters } = req.body;

    if (!commodityId) {
      throw new AppError('commodityId is required', 400);
    }

    const weight = Number(quantityWeight);
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new AppError('quantityWeight must be a positive number', 400);
    }

    const hours = Number(cutoffHours);
    if (!Number.isFinite(hours) || hours < 1 || hours > 24) {
      throw new AppError('cutoffHours must be between 1 and 24 hours', 400);
    }

    const [kitchen, commodity] = await Promise.all([
      prisma.kitchen.findUnique({ where: { id: req.user.id } }),
      prisma.commodity.findUnique({
        where: { id: String(commodityId) },
        include: { tiers: { orderBy: { minWeight: 'asc' } } },
      }),
    ]);

    if (!kitchen) {
      throw new AppError('Kitchen profile not found', 404);
    }

    if (!commodity || !commodity.isActive) {
      throw new AppError('Commodity not found or inactive', 404);
    }

    if (weight > commodity.maxPoolCapacity) {
      throw new AppError(
        `Initial weight (${weight} ${commodity.unit}) exceeds max pool capacity (${commodity.maxPoolCapacity} ${commodity.unit})`,
        400
      );
    }

    const effectiveRadius = Math.min(
      Math.max(Number(radiusMeters) || config.defaultRadiusMeters, 1000),
      config.expandedRadiusMeters
    );

    const cutoffAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const pricing = resolveTierPrice(commodity.retailPrice, commodity.tiers, weight);
    const idempotencyKey = req.idempotencyKey || `seed_${crypto.randomUUID()}`;

    const result = await prisma.$transaction(async (tx) => {
      const pool = await tx.orderPool.create({
        data: {
          commodityId: commodity.id,
          createdById: kitchen.id,
          hubLocality: kitchen.locality,
          centerLatitude: kitchen.latitude,
          centerLongitude: kitchen.longitude,
          radiusMeters: effectiveRadius,
          currentWeight: weight,
          moqWeight: commodity.baseMoqWeight,
          maxCapacity: commodity.maxPoolCapacity,
          currentUnitPrice: pricing.unitPrice,
          status: 'OPEN',
          cutoffAt,
        },
        include: {
          commodity: {
            include: {
              tiers: { orderBy: { minWeight: 'asc' } },
              wholesaler: {
                select: { id: true, businessName: true, rating: true },
              },
            },
          },
        },
      });

      const subOrder = await tx.subOrder.create({
        data: {
          poolId: pool.id,
          kitchenId: kitchen.id,
          idempotencyKey,
          quantityWeight: weight,
          status: 'PLEDGED',
        },
      });

      return { pool, subOrder };
    });

    res.status(201).json({
      message: 'Seed order pool created and opened to nearby kitchens',
      hubRoomKey: getHubRoomKey(kitchen.latitude, kitchen.longitude),
      pool: {
        ...result.pool,
        participantsCount: 1,
        moqReached: result.pool.currentWeight >= result.pool.moqWeight,
        fillPercent: Math.min(
          100,
          Math.round((result.pool.currentWeight / Math.max(result.pool.moqWeight, 1)) * 100)
        ),
        pricing,
      },
      subOrder: result.subOrder,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNearbyPools,
  getPoolById,
  createSeedPool,
};
