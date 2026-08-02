import { PrismaClient, UserRole, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_PHONE = "+998900000001";

async function main() {
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
        seededDemoReviews: 0
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
