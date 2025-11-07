import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@cozzy.local';
  const adminPassword = 'password123';

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Admin',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });

  const catNames = ['Apparel', 'Electronics', 'Home'];
  for (const name of catNames) {
    const slug = name.toLowerCase();
    await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
  }

  const categories = await prisma.category.findMany();
  const electronics = categories.find((c) => c.slug === 'electronics')!;

  await prisma.product.upsert({
    where: { slug: 'wireless-headphones' },
    update: {},
    create: {
      title: 'Wireless Headphones',
      slug: 'wireless-headphones',
      description: 'Comfortable over-ear wireless headphones with noise cancellation.',
      priceCents: 12999,
      currency: 'USD',
      images: [],
      active: true,
      stock: 25,
      categoryId: electronics.id,
    },
  });

  console.log('Seed complete. Admin:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
