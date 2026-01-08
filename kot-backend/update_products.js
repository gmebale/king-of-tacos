const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateProducts() {
  console.log('Updating old products to have consistent structure...');

  // Always create categories first
  const categories = [
    { name: 'tacos', displayName: 'Tacos' },
    { name: 'burritos', displayName: 'Burritos' },
    { name: 'options', displayName: 'Options de Customisation' },
  ];

  const createdCategories = {};
  for (const cat of categories) {
    const category = await prisma.categoryModel.upsert({
      where: { name: cat.name },
      update: {},
      create: { name: cat.name, displayName: cat.displayName },
    });
    createdCategories[cat.name] = category.id;
  }

  // Update old products without categoryId
  await prisma.$queryRaw`UPDATE products SET categoryId = ${createdCategories.options}, type = 'main' WHERE categoryId IS NULL`;

  // Update specific products
  await prisma.product.updateMany({
    where: { name: { contains: 'Tacos' } },
    data: { categoryId: createdCategories.tacos, type: 'main' }
  });

  await prisma.product.updateMany({
    where: { name: { contains: 'Burger' } },
    data: { categoryId: createdCategories.tacos, type: 'main' }
  });

  await prisma.product.updateMany({
    where: { name: { contains: 'Frites' } },
    data: { categoryId: createdCategories.options, type: 'side' }
  });

  await prisma.product.updateMany({
    where: { name: { contains: 'Coca' } },
    data: { categoryId: createdCategories.options, type: 'drink' }
  });

  await prisma.product.updateMany({
    where: { name: { contains: 'Tiramisu' } },
    data: { categoryId: createdCategories.options, type: 'dessert' }
  });

  console.log('Products updated.');
  await prisma.$disconnect();
}

updateProducts();