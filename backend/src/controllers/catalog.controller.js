const prisma = require('../config/prisma');
const config = require('../config/env');
const AppError = require('../utils/appError');
const { isValidCoordinate } = require('../utils/geo');
const { findNearbyOpenPools } = require('../services/spatial.service');

async function resolveSearchOrigin(req) {
  const queryLat = req.query.latitude !== undefined ? Number(req.query.latitude) : null;
  const queryLng = req.query.longitude !== undefined ? Number(req.query.longitude) : null;

  if (queryLat !== null && queryLng !== null && isValidCoordinate(queryLat, queryLng)) {
    return { latitude: queryLat, longitude: queryLng };
  }

  const kitchen = await prisma.kitchen.findUnique({
    where: { id: req.user.id },
    select: { latitude: true, longitude: true },
  });

  if (!kitchen) {
    throw new AppError('Kitchen profile not found', 404);
  }

  return { latitude: kitchen.latitude, longitude: kitchen.longitude };
}

async function listCatalog(req, res, next) {
  try {
    const { category, search } = req.query;
    const radiusMeters = Number(req.query.radiusMeters) || config.defaultRadiusMeters;

    const where = {
      isActive: true,
      ...(category && category !== 'All'
        ? { category: { equals: String(category).trim(), mode: 'insensitive' } }
        : {}),
      ...(search && String(search).trim()
        ? {
            OR: [
              { name: { contains: String(search).trim(), mode: 'insensitive' } },
              { category: { contains: String(search).trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [origin, commodities] = await Promise.all([
      resolveSearchOrigin(req),
      prisma.commodity.findMany({
        where,
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
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const nearbyPools = await findNearbyOpenPools({
      latitude: origin.latitude,
      longitude: origin.longitude,
      radiusMeters,
    });

    const poolsByCommodity = new Map();
    for (const pool of nearbyPools) {
      const list = poolsByCommodity.get(pool.commodityId) || [];
      list.push(pool);
      poolsByCommodity.set(pool.commodityId, list);
    }

    const enriched = commodities.map((item) => {
      const matchingPools = poolsByCommodity.get(item.id) || [];
      const lowestTierPrice = item.tiers.length
        ? Math.min(...item.tiers.map((t) => Number(t.unitPrice)))
        : Number(item.retailPrice);
      const maxSavingsPercent =
        item.retailPrice > 0
          ? Math.round(((item.retailPrice - lowestTierPrice) / item.retailPrice) * 100)
          : 0;

      return {
        ...item,
        lowestWholesalePrice: lowestTierPrice,
        maxSavingsPercent,
        nearbyOpenPoolsCount: matchingPools.length,
        nearestPool: matchingPools[0] || null,
      };
    });

    const categories = ['All', ...new Set(commodities.map((c) => c.category))];

    res.status(200).json({
      radiusMeters,
      count: enriched.length,
      categories,
      commodities: enriched,
    });
  } catch (err) {
    next(err);
  }
}

async function getCommodityById(req, res, next) {
  try {
    const { commodityId } = req.params;
    const radiusMeters = Number(req.query.radiusMeters) || config.defaultRadiusMeters;

    const commodity = await prisma.commodity.findUnique({
      where: { id: commodityId },
      include: {
        tiers: { orderBy: { minWeight: 'asc' } },
        wholesaler: {
          select: {
            id: true,
            businessName: true,
            contactName: true,
            mandiAddress: true,
            rating: true,
          },
        },
      },
    });

    if (!commodity) {
      throw new AppError('Commodity not found', 404);
    }

    const origin = await resolveSearchOrigin(req);
    const nearbyPools = await findNearbyOpenPools({
      latitude: origin.latitude,
      longitude: origin.longitude,
      radiusMeters,
      commodityId: commodity.id,
    });

    res.status(200).json({
      commodity,
      nearbyPools,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCatalog,
  getCommodityById,
};
