const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding test users...');

  // Hash password for test users
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      password: hashedPassword,
      full_name: 'Admin Test',
      phone: '0123456789',
      role: 'admin'
    }
  });

  /* Create regular user
  const user = await prisma.user.upsert({
    where: { email: 'user@test.com' },
    update: {},
    create: {
      email: 'user@test.com',
      password: hashedPassword,
      full_name: 'User Test',
      phone: '0987654321',
      role: 'client'
    }
  }); */

  console.log('Test users created:');
  console.log('Admin: admin@test.com / password123');
  //console.log('User: user@test.com / password123');

  //console.log('Seeding products...');

  /* French Tacos - Configurable
  const frenchTacos = await prisma.product.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'French Tacos',
      description: 'Délicieux tacos français avec viandes, sauces et accompagnements',
      price: 5000, // Prix de base
      category: 'tacos',
      available: true,
      stock: 100,
      customization: {
        isConfigurable: true,
        basePrice: 5000,
        optionGroups: [
          {
            id: 'size',
            name: 'Taille',
            type: 'single',
            required: true,
            options: [
              { id: 'S', name: 'SOLO', priceModifier: 0, description: '1 viande', maxMeats: 1 },
              { id: 'M', name: 'DOBLE', priceModifier: 1000, description: '2 viandes', maxMeats: 2 },
              { id: 'L', name: 'TRIO', priceModifier: 2000, description: '3 viandes', maxMeats: 3 },
              { id: 'XL', name: 'PATRON', priceModifier: 4000, description: '4 viandes', maxMeats: 4 }
            ]
          },
          {
            id: 'meats',
            name: 'Choix des viandes',
            type: 'multiple',
            required: true,
            minSelections: 1,
            maxSelections: 4,
            options: [
              { id: 'boeuf', name: 'Boeuf', priceModifier: 0 },
              { id: 'poulet', name: 'Poulet', priceModifier: 0 },
              { id: 'porc', name: 'Porc', priceModifier: 0 },
              { id: 'agneau', name: 'Agneau', priceModifier: 0 },
              { id: 'vegetarien', name: 'Végétarien', priceModifier: 0 }
            ]
          },
          {
            id: 'accompagnements',
            name: 'Accompagnements',
            type: 'multiple',
            required: false,
            options: [
              { id: 'frites_simple', name: 'Frites simple', priceModifier: 500 },
              { id: 'frites_cheddar', name: 'Frites au cheddar', priceModifier: 700 },
              { id: 'frites_paprika', name: 'Frites au paprika', priceModifier: 700 },
              { id: 'alloco', name: 'Alloco', priceModifier: 600 },
              { id: 'riz_blanc', name: 'Riz Blanc', priceModifier: 500 }
            ]
          },
          {
            id: 'supplements',
            name: 'Suppléments',
            type: 'multiple',
            required: false,
            options: [
              { id: 'oeuf', name: 'Oeuf', priceModifier: 300 },
              { id: 'poulet_pane', name: 'Poulet Pané (Nuggets)', priceModifier: 1200 },
              { id: 'poulet_braise', name: 'Poulet Braisé', priceModifier: 1200 },
              { id: 'cordon_bleu', name: 'Cordon Bleu', priceModifier: 1300 },
              { id: 'boeuf_marine', name: 'Boeuf mariné', priceModifier: 1500 },
              { id: 'des_poisson', name: 'Dés de poisson', priceModifier: 1400 },
              { id: 'crevettes_marinees', name: 'Crevettes marinées', priceModifier: 1600 }
            ]
          },
          {
            id: 'sauces',
            name: 'Sauces',
            type: 'multiple',
            required: true,
            includedCount: 2,
            extraPrice: 500,
            options: [
              { id: 'algerienne', name: 'Algérienne', priceModifier: 0 },
              { id: 'blanche', name: 'Blanche', priceModifier: 0 },
              { id: 'harissa', name: 'Harissa', priceModifier: 0 },
              { id: 'ketchup', name: 'Ketchup', priceModifier: 0 },
              { id: 'mayonnaise', name: 'Mayonnaise', priceModifier: 0 },
              { id: 'bbq', name: 'BBQ', priceModifier: 0 },
              { id: 'samourai', name: 'Samouraï', priceModifier: 0 },
              { id: 'curry', name: 'Curry', priceModifier: 0 }
            ]
          },
          {
            id: 'options',
            name: 'Options',
            type: 'multiple',
            required: false,
            options: [
              { id: 'gratine', name: 'Gratiné', priceModifier: 500 }
            ]
          }
        ]
      }
    }
  }); */

  /* Burger Classique - Configurable
  const burgerClassique = await prisma.product.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: 'Burger Classique',
      description: 'Burger avec steak haché, fromage, salade, tomate',
      price: 4500,
      category: 'tacos', // Note: category might need to be 'burgers' if added
      available: true,
      stock: 50,
      customization: {
        isConfigurable: true,
        basePrice: 4500,
        optionGroups: [
          {
            id: 'viande',
            name: 'Viande',
            type: 'single',
            required: true,
            options: [
              { id: 'boeuf', name: 'Boeuf', priceModifier: 0 },
              { id: 'poulet', name: 'Poulet', priceModifier: 0 },
              { id: 'vegetarien', name: 'Végétarien', priceModifier: 0 }
            ]
          },
          {
            id: 'fromage',
            name: 'Fromage',
            type: 'multiple',
            required: false,
            options: [
              { id: 'cheddar', name: 'Cheddar', priceModifier: 300 },
              { id: 'emmental', name: 'Emmental', priceModifier: 300 },
              { id: 'raclette', name: 'Raclette', priceModifier: 400 }
            ]
          },
          {
            id: 'sauces',
            name: 'Sauces',
            type: 'multiple',
            required: false,
            includedCount: 1,
            extraPrice: 200,
            options: [
              { id: 'ketchup', name: 'Ketchup', priceModifier: 0 },
              { id: 'mayonnaise', name: 'Mayonnaise', priceModifier: 0 },
              { id: 'bbq', name: 'BBQ', priceModifier: 0 },
              { id: 'harissa', name: 'Harissa', priceModifier: 0 }
            ]
          }
        ]
      }
    }
  }); */

  /* Menu Maxi Best Of - Configurable
  const menuMaxi = await prisma.product.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      name: 'Menu Maxi Best Of',
      description: 'Tacos + Burger + Boisson + Dessert',
      price: 12000,
      category: 'tacos', // Or 'menus'
      available: true,
      stock: 30,
      customization: {
        isConfigurable: true,
        basePrice: 12000,
        optionGroups: [
          {
            id: 'tacos_size',
            name: 'Taille du Tacos',
            type: 'single',
            required: true,
            options: [
              { id: 'M', name: 'DOBLE', priceModifier: 0 },
              { id: 'L', name: 'TRIO', priceModifier: 1000 }
            ]
          },
          {
            id: 'boisson',
            name: 'Boisson',
            type: 'single',
            required: true,
            options: [
              { id: 'coca', name: 'Coca-Cola', priceModifier: 0 },
              { id: 'fanta', name: 'Fanta', priceModifier: 0 },
              { id: 'sprite', name: 'Sprite', priceModifier: 0 },
              { id: 'orangina', name: 'Orangina', priceModifier: 0 }
            ]
          },
          {
            id: 'dessert',
            name: 'Dessert',
            type: 'single',
            required: true,
            options: [
              { id: 'tiramisu', name: 'Tiramisu', priceModifier: 0 },
              { id: 'mousse_chocolat', name: 'Mousse au Chocolat', priceModifier: 0 },
              { id: 'creme_brulee', name: 'Crème Brûlée', priceModifier: 0 }
            ]
          }
        ]
      }
    }
  }); */

  /* Produits simples
  const frites = await prisma.product.upsert({
    where: { id: 4 },
    update: {},
    create: {
      id: 4,
      name: 'Frites',
      description: 'Frites dorées et croustillantes',
      price: 1500,
      category: 'accompagnements',
      available: true,
      stock: 200,
      customization: { isConfigurable: false }
    }
  }); 

  const coca = await prisma.product.upsert({
    where: { id: 5 },
    update: {},
    create: {
      id: 5,
      name: 'Coca-Cola',
      description: 'Boisson gazeuse rafraîchissante',
      price: 1000,
      category: 'boissons',
      available: true,
      stock: 150,
      customization: { isConfigurable: false }
    }
  }); 

  const tiramisu = await prisma.product.upsert({
    where: { id: 6 },
    update: {},
    create: {
      id: 6,
      name: 'Tiramisu',
      description: 'Dessert italien au café et mascarpone',
      price: 2000,
      category: 'desserts',
      available: true,
      stock: 50,
      customization: { isConfigurable: false }
    }
  });

  console.log('Products seeded successfully');
} */

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  })  
};