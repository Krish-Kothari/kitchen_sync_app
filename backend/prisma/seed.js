const prisma = require('../src/config/prisma');
const { hashPassword } = require('../src/utils/auth');

async function seed() {
  console.log('[seed] Seeding CloudPool wholesalers, commodities, tiers, and Pune kitchens...');

  const wholesaler = await prisma.wholesaler.upsert({
    where: { email: 'dispatch@gultekdimandi.in' },
    update: {},
    create: {
      businessName: 'Gultekdi Agro Wholesale Co.',
      contactName: 'Ramesh Deshmukh',
      email: 'dispatch@gultekdimandi.in',
      phone: '+919822011223',
      mandiAddress: 'Gate 4, Market Yard, Gultekdi, Pune, Maharashtra 411037',
      latitude: 18.4917,
      longitude: 73.8732,
      rating: 4.8,
    },
  });

  const catalogData = [
    {
      name: 'Nashik Red Onions (Grade A)',
      category: 'Vegetables',
      unit: 'kg',
      retailPrice: 42,
      baseMoqWeight: 50,
      maxPoolCapacity: 300,
      tiers: [
        { tierName: 'Tier 1 (MOQ)', minWeight: 50, unitPrice: 34 },
        { tierName: 'Tier 2 (Bulk)', minWeight: 100, unitPrice: 29 },
        { tierName: 'Tier 3 (Mandi)', minWeight: 200, unitPrice: 25 },
      ],
    },
    {
      name: 'Refined Sunflower Cooking Oil',
      category: 'Oils & Fats',
      unit: 'L',
      retailPrice: 148,
      baseMoqWeight: 40,
      maxPoolCapacity: 250,
      tiers: [
        { tierName: 'Tier 1 (MOQ)', minWeight: 40, unitPrice: 132 },
        { tierName: 'Tier 2 (Bulk)', minWeight: 100, unitPrice: 124 },
        { tierName: 'Tier 3 (Mandi)', minWeight: 180, unitPrice: 118 },
      ],
    },
    {
      name: 'Aged Basmati Biryani Rice',
      category: 'Grains',
      unit: 'kg',
      retailPrice: 115,
      baseMoqWeight: 50,
      maxPoolCapacity: 300,
      tiers: [
        { tierName: 'Tier 1 (MOQ)', minWeight: 50, unitPrice: 96 },
        { tierName: 'Tier 2 (Bulk)', minWeight: 120, unitPrice: 88 },
        { tierName: 'Tier 3 (Mandi)', minWeight: 220, unitPrice: 81 },
      ],
    },
    {
      name: 'Fresh Malai Paneer Block',
      category: 'Dairy',
      unit: 'kg',
      retailPrice: 360,
      baseMoqWeight: 25,
      maxPoolCapacity: 120,
      tiers: [
        { tierName: 'Tier 1 (MOQ)', minWeight: 25, unitPrice: 315 },
        { tierName: 'Tier 2 (Bulk)', minWeight: 60, unitPrice: 290 },
        { tierName: 'Tier 3 (Mandi)', minWeight: 100, unitPrice: 270 },
      ],
    },
    {
      name: 'Hybrid Farm Tomatoes',
      category: 'Vegetables',
      unit: 'kg',
      retailPrice: 38,
      baseMoqWeight: 40,
      maxPoolCapacity: 240,
      tiers: [
        { tierName: 'Tier 1 (MOQ)', minWeight: 40, unitPrice: 30 },
        { tierName: 'Tier 2 (Bulk)', minWeight: 100, unitPrice: 25 },
        { tierName: 'Tier 3 (Mandi)', minWeight: 180, unitPrice: 21 },
      ],
    },
  ];

  const createdCommodities = [];
  for (const item of catalogData) {
    let commodity = await prisma.commodity.findFirst({
      where: { name: item.name, wholesalerId: wholesaler.id },
    });

    if (!commodity) {
      commodity = await prisma.commodity.create({
        data: {
          wholesalerId: wholesaler.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          retailPrice: item.retailPrice,
          baseMoqWeight: item.baseMoqWeight,
          maxPoolCapacity: item.maxPoolCapacity,
        },
      });
    }

    for (const tier of item.tiers) {
      await prisma.discountTier.upsert({
        where: {
          commodityId_minWeight: {
            commodityId: commodity.id,
            minWeight: tier.minWeight,
          },
        },
        update: { tierName: tier.tierName, unitPrice: tier.unitPrice },
        create: {
          commodityId: commodity.id,
          tierName: tier.tierName,
          minWeight: tier.minWeight,
          unitPrice: tier.unitPrice,
        },
      });
    }

    createdCommodities.push(commodity);
  }

  const demoPasswordHash = await hashPassword('Kitchen@123');

  const puneKitchens = [
    {
      name: 'SpiceRoute Cloud Kitchen',
      ownerName: 'Aarav Kulkarni',
      email: 'spiceroute@cloudpool.dev',
      phone: '+919850100001',
      address: 'Shop 12, Paud Road, Kothrud, Pune',
      locality: 'Kothrud',
      latitude: 18.5074,
      longitude: 73.8077,
    },
    {
      name: 'TandoorBox Express',
      ownerName: 'Meera Joshi',
      email: 'tandoorbox@cloudpool.dev',
      phone: '+919850100002',
      address: 'Lane 4, Karve Nagar, Pune',
      locality: 'Karve Nagar',
      latitude: 18.4962,
      longitude: 73.8165,
    },
    {
      name: 'Wok & Bowl Co.',
      ownerName: 'Rohan Patil',
      email: 'wokbowl@cloudpool.dev',
      phone: '+919850100003',
      address: 'Unit 7, Erandwane, Pune',
      locality: 'Erandwane',
      latitude: 18.5118,
      longitude: 73.8286,
    },
    {
      name: 'Biryani Craft Baner',
      ownerName: 'Sneha Gokhale',
      email: 'biryanicraft@cloudpool.dev',
      phone: '+919850100004',
      address: 'High Street Annex, Baner, Pune',
      locality: 'Baner',
      latitude: 18.559,
      longitude: 73.7868,
    },
  ];

  const seededKitchens = [];
  for (const k of puneKitchens) {
    const kitchen = await prisma.kitchen.upsert({
      where: { email: k.email },
      update: {},
      create: {
        ...k,
        passwordHash: demoPasswordHash,
        isVerified: true,
      },
    });
    seededKitchens.push(kitchen);
  }

  const existingPools = await prisma.orderPool.count();
  if (existingPools === 0 && createdCommodities.length >= 2) {
    const cutoffIn4Hours = new Date(Date.now() + 4 * 60 * 60 * 1000);
    await prisma.orderPool.createMany({
      data: [
        {
          commodityId: createdCommodities[0].id,
          createdById: seededKitchens[0].id,
          hubLocality: 'Kothrud',
          centerLatitude: seededKitchens[0].latitude,
          centerLongitude: seededKitchens[0].longitude,
          radiusMeters: 3000,
          currentWeight: 35,
          moqWeight: 50,
          maxCapacity: 300,
          currentUnitPrice: 42,
          status: 'OPEN',
          cutoffAt: cutoffIn4Hours,
        },
        {
          commodityId: createdCommodities[1].id,
          createdById: seededKitchens[1].id,
          hubLocality: 'Karve Nagar',
          centerLatitude: seededKitchens[1].latitude,
          centerLongitude: seededKitchens[1].longitude,
          radiusMeters: 3000,
          currentWeight: 60,
          moqWeight: 40,
          maxCapacity: 250,
          currentUnitPrice: 132,
          status: 'OPEN',
          cutoffAt: cutoffIn4Hours,
        },
      ],
    });
  }

  console.log(
    `[seed] Done! Seeded 1 wholesaler, ${createdCommodities.length} commodities, and ${seededKitchens.length} kitchens.`
  );
}

seed()
  .catch((err) => {
    console.error('[seed] Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
