function getPaidItemTaxMultiplier(order) {
  const itemsSubtotal = (order.items || []).reduce((sum, item) => sum + Math.max(0, item.price || 0) * Math.max(0, item.quantity || 0), 0);
  const giftedValue = (order.items || []).reduce((sum, item) => sum + Math.max(0, item.price || 0) * Math.max(0, item.free_quantity || 0), 0);
  const promoDiscount = order.promoCode?.type === 'free_delivery'
    ? 0
    : Math.max(0, (order.discount_amount || 0) - giftedValue);
  const remainingSubtotal = Math.max(0, itemsSubtotal - giftedValue);
  return remainingSubtotal > 0 ? Math.max(0, Math.min(1, (remainingSubtotal - promoDiscount) / remainingSubtotal)) : 0;
}

function getOrderItemTaxQuantity(item) {
  return Math.max(0, (item.quantity || 0) - (item.free_quantity || 0));
}

module.exports = { getPaidItemTaxMultiplier, getOrderItemTaxQuantity };
