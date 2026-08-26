import { PrismaClient, UserRole, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_PHONE = "+998900000001";

const categories = [
  { slug: "plumbing", nameUz: "Santexnik", nameRu: "Сантехник", nameEn: "Plumber", iconKey: "wrench", sortOrder: 0 },
  { slug: "electric", nameUz: "Elektrik", nameRu: "Электрик", nameEn: "Electrician", iconKey: "zap", sortOrder: 1 },
  { slug: "welding", nameUz: "Payvandchi", nameRu: "Сварщик", nameEn: "Welder", iconKey: "flame", sortOrder: 2 },
  { slug: "repair", nameUz: "Usta", nameRu: "Мастер", nameEn: "Handyman", iconKey: "hammer", sortOrder: 3 },
  { slug: "ac", nameUz: "Konditsioner", nameRu: "Кондиционеры", nameEn: "Air conditioning", iconKey: "snowflake", sortOrder: 4 },
  { slug: "renovation", nameUz: "Ta'mirlash", nameRu: "Ремонт", nameEn: "Renovation", iconKey: "paint", sortOrder: 5 },
  { slug: "cleaning", nameUz: "Tozalash", nameRu: "Уборка", nameEn: "Cleaning", iconKey: "sparkles", sortOrder: 6 }
] as const;

async function main() {
  await Promise.all(
    categories.map((category) =>
      prisma.category.upsert({
        where: { slug: category.slug },
        update: category,
        create: category
      })
    )
  );

  const admin = await prisma.user.upsert({
    where: { phone: ADMIN_PHONE },
    update: {
      name: "NearFIX Admin",
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      cityId: null
    },
    create: {
      phone: ADMIN_PHONE,
      name: "NearFIX Admin",
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE
    }
  });

  console.log(
    JSON.stringify(
      {
        adminPhone: admin.phone,
        adminRole: admin.role,
        seededDemoUsers: 0,
        seededDemoWorkers: 0,
        seededDemoOrders: 0,
        seededDemoChats: 0,
        seededDemoReviews: 0,
        seededCategories: categories.length
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
