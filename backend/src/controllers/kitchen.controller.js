const prisma = require('../config/prisma');
const config = require('../config/env');
const AppError = require('../utils/appError');
const { sanitizeKitchen } = require('../utils/auth');
const { isValidCoordinate, haversineMeters, getHubRoomKey } = require('../utils/geo');

async function getMyProfile(req, res, next) {
  try {
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: req.user.id },
      include: {
        _count: {
          select: {
            subOrders: true,
            createdPools: true,
          },
        },
      },
    });

    if (!kitchen) {
      throw new AppError('Kitchen profile not found', 404);
    }

    res.status(200).json({
      kitchen: sanitizeKitchen(kitchen),
      hubRoomKey: getHubRoomKey(kitchen.latitude, kitchen.longitude),
    });
  } catch (err) {
    next(err);
  }
}

async function verifyKitchenLocation(req, res, next) {
  try {
    const { latitude, longitude, address, locality } = req.body;
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!isValidCoordinate(lat, lng)) {
      throw new AppError('Valid numeric latitude and longitude are required', 400);
    }

    const updateData = {
      latitude: lat,
      longitude: lng,
      isVerified: true,
    };

    if (address && String(address).trim()) {
      updateData.address = String(address).trim();
    }
    if (locality && String(locality).trim()) {
      updateData.locality = String(locality).trim();
    }

    const updated = await prisma.kitchen.update({
      where: { id: req.user.id },
      data: updateData,
    });

    res.status(200).json({
      message: 'Kitchen location geo-verified successfully',
      kitchen: sanitizeKitchen(updated),
      hubRoomKey: getHubRoomKey(updated.latitude, updated.longitude),
    });
  } catch (err) {
    next(err);
  }
}

async function updatePushToken(req, res, next) {
  try {
    const { expoPushToken } = req.body;
    if (!expoPushToken || typeof expoPushToken !== 'string') {
      throw new AppError('Valid expoPushToken string is required', 400);
    }

    const updated = await prisma.kitchen.update({
      where: { id: req.user.id },
      data: { expoPushToken: expoPushToken.trim() },
    });

    res.status(200).json({
      message: 'Expo push token updated',
      expoPushToken: updated.expoPushToken,
    });
  } catch (err) {
    next(err);
  }
}

async function getNearbyKitchens(req, res, next) {
  try {
    const me = await prisma.kitchen.findUnique({
      where: { id: req.user.id },
      select: { id: true, latitude: true, longitude: true },
    });

    if (!me) {
      throw new AppError('Kitchen profile not found', 404);
    }

    const radiusMeters = Math.min(
      Number(req.query.radiusMeters) || config.defaultRadiusMeters,
      10000
    );

    let nearby = [];
    try {
      nearby = await prisma.$queryRaw`
        SELECT
          id,
          name,
          locality,
          latitude,
          longitude,
          ROUND(
            ST_Distance(
              location,
              ST_SetSRID(ST_MakePoint(${me.longitude}, ${me.latitude}), 4326)::geography
            )::numeric,
            0
          ) AS "distanceMeters"
        FROM "Kitchen"
        WHERE id <> ${me.id}
          AND location IS NOT NULL
          AND ST_DWithin(
            location,
            ST_SetSRID(ST_MakePoint(${me.longitude}, ${me.latitude}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY "distanceMeters" ASC;
      `;
    } catch (_postgisUnavailable) {
      const others = await prisma.kitchen.findMany({
        where: { id: { not: me.id } },
        select: { id: true, name: true, locality: true, latitude: true, longitude: true },
      });

      nearby = others
        .map((k) => ({
          ...k,
          distanceMeters: haversineMeters(me.latitude, me.longitude, k.latitude, k.longitude),
        }))
        .filter((k) => k.distanceMeters <= radiusMeters)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
    }

    res.status(200).json({
      radiusMeters,
      count: nearby.length,
      kitchens: nearby,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyProfile,
  verifyKitchenLocation,
  updatePushToken,
  getNearbyKitchens,
};
