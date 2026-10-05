async function recognizeOrderStockSale(tx, orderId) {
  const items = await tx.orderItem.findMany({
    where: { order_id: orderId, stock_deducted: false, product_id: { not: null } }
  });

  for (const item of items) {
    const claimed = await tx.orderItem.updateMany({
      where: { id: item.id, stock_deducted: false },
      data: { stock_deducted: true }
    });
    if (claimed.count !== 1) continue;

    const needs = new Map([[item.product_id, item.quantity]]);
    for (const component of Array.isArray(item.inventory_components) ? item.inventory_components : []) {
      const productId = Number(component.product_id);
      const quantity = Number(component.quantity) * item.quantity;
      if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1) continue;
      needs.set(productId, (needs.get(productId) || 0) + quantity);
    }

    let parentProduct;
    for (const [productId, quantity] of needs) {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw Object.assign(new Error(`Un produit suivi en stock de la commande ${item.product_name} n’existe plus.`), { statusCode: 409 });
      if (productId === item.product_id) parentProduct = product;
      const deducted = await tx.product.updateMany({
        where: { id: productId, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } }
      });
      if (deducted.count !== 1) {
        throw Object.assign(new Error(`Stock insuffisant pour « ${product.name} » (disponible : ${product.stock}, demandé : ${quantity}).`), { statusCode: 409 });
      }
    }

    await tx.orderItem.update({
      where: { id: item.id },
      data: { unit_cost_snapshot: parentProduct?.average_purchase_cost ?? null }
    });
  }
}

async function recordOrderStockSale(prisma, orderId) {
  return prisma.$transaction(tx => recognizeOrderStockSale(tx, orderId));
}

module.exports = { recognizeOrderStockSale, recordOrderStockSale };
