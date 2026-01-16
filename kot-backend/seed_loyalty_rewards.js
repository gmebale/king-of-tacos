const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const loyaltyRewards = [
  {
    id: 'seed-free-delivery',
    name: 'Livraison gratuite',
    description: 'Livraison offerte sur votre prochaine commande',
    type: 'free_delivery',
    points_required: 50,
  },
  {
    id: 'seed-5-euros',
    name: 'Réduction 5€',
    description: '5€ de réduction sur la commande',
    type: 'discount',
    points_required: 80,
  },
  {
    id: 'seed-free-dessert',
    name: 'Dessert offert',
    description: 'Un dessert offert au choix',
    type: 'gifted_product',
    points_required: 40,
  },
];

async function main() {
  console.log('Seeding loyalty rewards...');
  for (const reward of loyaltyRewards) {
    await prisma.loyaltyReward.upsert({
      where: { id: reward.id },
      update: {},
      create: reward,
    });
  }
  console.log('Loyalty rewards seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


