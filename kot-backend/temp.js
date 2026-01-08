const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, category: true },
    take: 5
  });
  console.log(JSON.stringify(products, null, 2));
  await prisma.$disconnect();
}

main();