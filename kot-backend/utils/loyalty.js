async function awardOrderPoints(prisma, orderId) {
  return prisma.$transaction(async tx => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { id: true, role: true, is_active: true, roleRef: { select: { slug: true } } } }, items: true }
    });
    const orderUserRole = order?.user?.roleRef?.slug || order?.user?.role;
    if (!order || !order.user || orderUserRole !== 'client' || !order.user.is_active || order.payment_status !== 'paid' || !order.closed_at || !['servie', 'recuperee', 'livree'].includes(order.status)) return 0;
    const points = order.items.reduce((sum, item) => sum + Math.max(0, item.unit_loyalty_points || 0) * Math.max(0, item.quantity - (item.free_quantity || 0)), 0);
    if (!points) return 0;
    try {
      await tx.loyaltyPointEntry.create({ data: { user_id: order.user_id, order_id: order.id, type: 'earned', points, reason: `Points de la commande ${order.order_code || order.id}` } });
    } catch (error) {
      if (error.code === 'P2002') return 0;
      throw error;
    }
    await tx.user.update({ where: { id: order.user_id }, data: { loyalty_points: { increment: points } } });
    return points;
  });
}

async function reverseOrderPoints(prisma, orderId, actorId = null, reason = 'Remboursement de commande') {
  return prisma.$transaction(async tx => {
    const earned = await tx.loyaltyPointEntry.findFirst({ where: { order_id: orderId, type: 'earned' } });
    if (!earned) return 0;
    try {
      await tx.loyaltyPointEntry.create({ data: {
        user_id: earned.user_id,
        actor_id: actorId,
        order_id: orderId,
        type: 'refund_reversal',
        points: -earned.points,
        reason
      } });
    } catch (error) {
      if (error.code === 'P2002') return 0;
      throw error;
    }
    await tx.user.update({ where: { id: earned.user_id }, data: { loyalty_points: { decrement: earned.points } } });
    return earned.points;
  });
}

module.exports = { awardOrderPoints, reverseOrderPoints };
