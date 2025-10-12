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

  // Create regular user
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
  });

  console.log('Test users created:');
  console.log('Admin: admin@test.com / password123');
  console.log('User: user@test.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
