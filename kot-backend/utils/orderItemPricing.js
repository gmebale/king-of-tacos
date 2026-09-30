const TAX_SCALE = 10000;

function buildTaxSnapshot(unitPrice, product) {
  const activeRates = (product?.taxRates || [])
    .map(entry => entry.taxRate)
    .filter(rate => rate?.active)
    .map(rate => ({
      id: rate.id,
      name: rate.name,
      percentage_basis_points: rate.percentage_basis_points
    }));
  const combinedRate = activeRates.reduce((sum, rate) => sum + rate.percentage_basis_points, 0);
  const unitTaxBase = combinedRate > 0
    ? Math.round(unitPrice * TAX_SCALE / (TAX_SCALE + combinedRate))
    : unitPrice;
  const unitTaxTotal = unitPrice - unitTaxBase;
  const breakdown = activeRates.map(rate => ({
    id: rate.id,
    name: rate.name,
    percentage_basis_points: rate.percentage_basis_points,
    amount: Math.round(unitTaxBase * rate.percentage_basis_points / TAX_SCALE)
  }));

  if (breakdown.length) {
    const allocated = breakdown.reduce((sum, rate) => sum + rate.amount, 0);
    breakdown[breakdown.length - 1].amount += unitTaxTotal - allocated;
  }

  return { unitTaxBase, unitTaxTotal, breakdown };
}

module.exports = { buildTaxSnapshot };
