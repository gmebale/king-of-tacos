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

    const product = await tx.product.findUnique({ where: { id: item.product_id } });
    if (!product) continue;
    await tx.product.update({
      where: { id: product.id },
      data: { stock: { decrement: item.quantity } }
    });
    await tx.orderItem.update({
      where: { id: item.id },
      data: { unit_cost_snapshot: product.average_purchase_cost, stock_deducted: true }
    });
  }
}

async function recordOrderStockSale(prisma, orderId) {
  return prisma.$transaction(tx => recognizeOrderStockSale(tx, orderId));
}

module.exports = { recognizeOrderStockSale, recordOrderStockSale };
