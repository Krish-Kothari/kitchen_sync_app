function sortTiersAscending(tiers = []) {
  return [...tiers].sort((a, b) => Number(a.minWeight) - Number(b.minWeight));
}

function resolveTierPrice(retailPrice, tiers = [], totalWeight = 0) {
  const sorted = sortTiersAscending(tiers);
  let activeTier = null;
  let nextTier = null;

  for (const tier of sorted) {
    if (totalWeight >= Number(tier.minWeight)) {
      activeTier = tier;
    } else if (!nextTier) {
      nextTier = tier;
    }
  }

  const unitPrice = activeTier ? Number(activeTier.unitPrice) : Number(retailPrice);
  const savingsPerUnit = Math.max(0, Number(retailPrice) - unitPrice);
  const discountPercent =
    Number(retailPrice) > 0
      ? Math.round((savingsPerUnit / Number(retailPrice)) * 100)
      : 0;

  return {
    unitPrice,
    activeTierName: activeTier ? activeTier.tierName : 'Retail Base',
    savingsPerUnit,
    discountPercent,
    nextTier: nextTier
      ? {
          tierName: nextTier.tierName,
          minWeight: Number(nextTier.minWeight),
          unitPrice: Number(nextTier.unitPrice),
          weightNeeded: Number(Math.max(0, Number(nextTier.minWeight) - totalWeight).toFixed(2)),
        }
      : null,
  };
}

module.exports = {
  sortTiersAscending,
  resolveTierPrice,
};
