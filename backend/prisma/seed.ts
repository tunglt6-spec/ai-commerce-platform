import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@commerce.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const tenantName = process.env.SEED_TENANT_NAME ?? 'Demo Store';

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      username: email.split('@')[0],
      passwordHash,
      firstName: 'Platform',
      lastName: 'Admin',
      role: 'admin',
    },
  });

  let tenant = await prisma.tenant.findFirst({ where: { ownerId: user.id } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: tenantName, slug: 'demo-store', ownerId: user.id },
    });
  }

  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: { role: 'admin' },
    create: { userId: user.id, tenantId: tenant.id, role: 'admin' },
  });

  const categoryNames = ['Shirts', 'Shorts', 'Accessories'];
  const categories: Record<string, string> = {};
  for (const name of categoryNames) {
    const slug = name.toLowerCase();
    const cat = await prisma.category.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug } },
      update: {},
      create: { tenantId: tenant.id, name, slug },
    });
    categories[name] = cat.id;
  }

  const sampleSku = 'TSHIRT-001';
  const existingProduct = await prisma.product.findFirst({
    where: { tenantId: tenant.id, sku: sampleSku },
  });
  if (!existingProduct) {
    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        sku: sampleSku,
        name: 'Pickleball T-Shirt Premium',
        shortDescription: 'Premium athletic t-shirt',
        categoryId: categories['Shirts'],
        costPrice: 50000,
        retailPrice: 150000,
        tags: ['trending', 'bestseller'],
        productScore: 78,
        profitMarginScore: 25,
        demandScore: 21,
        competitionScore: 12,
        contentViabilityScore: 10,
        riskScore: 5,
        scoreUpdatedAt: new Date(),
      },
    });
    await prisma.productVariant.create({
      data: {
        productId: product.id,
        variantSku: `${sampleSku}-M-RED`,
        size: 'M',
        color: 'Red',
        stockQuantity: 50,
        retailPrice: 150000,
      },
    });
  }

  await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: tenant.id, phone: '0987654321' } },
    update: {},
    create: {
      tenantId: tenant.id,
      phone: '0987654321',
      firstName: 'Ngân',
      lastName: 'Lê',
      city: 'Ho Chi Minh',
      segment: 'New',
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seed complete. Admin: ${email} / tenant: ${tenant.name} (${tenant.id})`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
