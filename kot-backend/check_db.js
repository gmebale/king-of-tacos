const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkOrders() {
  try {
    console.log('=== DERNIÈRES COMMANDES ===');
    const orders = await prisma.order.findMany({
      take: 5,
      orderBy: { created_date: 'desc' },
      include: {
        items: true
      }
    });

    orders.forEach(order => {
      console.log(`Commande ${order.id}: ${order.customer_name} - ${order.total_amount} FCFA`);
      console.log(`  Items: ${order.items.length}`);
      order.items.forEach(item => {
        console.log(`    - ${item.product_name} x${item.quantity} (${item.price} FCFA)`);
      });
      console.log('');
    });

    console.log('=== TOUS LES ITEMS DE COMMANDES ===');
    const allItems = await prisma.orderItem.findMany({
      take: 10,
      orderBy: { order_id: 'desc' }
    });

    allItems.forEach(item => {
      console.log(`${item.order_id}: ${item.product_name} x${item.quantity} (${item.price} FCFA)`);
    });

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrders();
