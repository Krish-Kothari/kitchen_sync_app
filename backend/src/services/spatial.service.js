const prisma = require('../config/prisma');
const config = require('../config/env');
const { haversineMeters, getHubRoomKey } = require('../utils/geo');
const { resolveTierPrice } = require('../utils/tierPricing');

async function enrichPoolsWithDistance(matchedRows) {
  if (!matchedRows.length) return [];

  const distanceById = new Map(
    matchedRows.map((row) => [row.id, Math.round(Number(row.distanceMeters || 0))])
  );

  const pools = await prisma.orderPool.findMany({
    where: { id: { in: matchedRows.map((r) => r.id) } },
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
        select: {
          id: true,
          name: true,
          locality: true,
        },
      },
      _count: {
        select: { subOrders: true },
      },
    },
  });

  return pools
    .map((pool) => {
      const pricing = resolveTierPrice(
        pool.commodity.retailPrice,
        pool.commodity.tiers,
        pool.currentWeight
      );

      const fillPercent = Math.min(
        100,
        Math.round((pool.currentWeight / Math.max(pool.moqWeight, 1)) * 100)
      );

      return {
        ...pool,
        distanceMeters: distanceById.get(pool.id) ?? 0,
        hubRoomKey: getHubRoomKey(pool.centerLatitude, pool.centerLongitude),
        participantsCount: pool._count.subOrders,
        moqReached: pool.currentWeight >= pool.moqWeight,
        fillPercent,
        pricing,
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

async function findNearbyOpenPools({
  latitude,
  longitude,
  radiusMeters = config.defaultRadiusMeters,
  commodityId = null,
}) {
  const effectiveRadius = Number(radiusMeters) || config.defaultRadiusMeters;
  let matchedRows = [];

  try {
    if (commodityId) {
      matchedRows = await prisma.$queryRaw`
        SELECT
          id,
          ST_Distance(
            center_location,
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
          ) AS "distanceMeters"
        FROM "OrderPool"
        WHERE status IN ('OPEN', 'EXTENDED')
          AND "cutoffAt" > NOW()
          AND "commodityId" = ${commodityId}
          AND center_location IS NOT NULL
          AND ST_DWithin(
            center_location,
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
            ${effectiveRadius}
          )
        ORDER BY "distanceMeters" ASC;
      `;
    } else {
      matchedRows = await prisma.$queryRaw`
        SELECT
          id,
          ST_Distance(
            center_location,
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
          ) AS "distanceMeters"
        FROM "OrderPool"
        WHERE status IN ('OPEN', 'EXTENDED')
          AND "cutoffAt" > NOW()
          AND center_location IS NOT NULL
          AND ST_DWithin(
            center_location,
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
            ${effectiveRadius}
          )
        ORDER BY "distanceMeters" ASC;
      `;
    }
  } catch (_postgisFallback) {
    const whereClause = {
      status: { in: ['OPEN', 'EXTENDED'] },
      cutoffAt: { gt: new Date() },
      ...(commodityId ? { commodityId } : {}),
    };

    const candidates = await prisma.orderPool.findMany({
      where: whereClause,
      select: {
        id: true,
        centerLatitude: true,
        centerLongitude: true,
        radiusMeters: true,
      },
    });

    matchedRows = candidates
      .map((pool) => ({
        id: pool.id,
        distanceMeters: haversineMeters(
          latitude,
          longitude,
          pool.centerLatitude,
          pool.centerLongitude
        ),
      }))
      .filter((row) => row.distanceMeters <= effectiveRadius);
  }

  return enrichPoolsWithDistance(matchedRows);
}

module.exports = {
  findNearbyOpenPools,
  enrichPoolsWithDistance,
};
