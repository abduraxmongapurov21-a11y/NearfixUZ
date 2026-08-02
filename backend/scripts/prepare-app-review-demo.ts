import { PrismaClient, UserRole, UserStatus, WorkerAvailabilityStatus, WorkerProfileStatus } from "@prisma/client";
import { parseEnv } from "../src/config/env.js";
import { hashPassword } from "../src/modules/auth/password.js";
import { normalizePhone } from "../src/utils/phone.js";

const prisma = new PrismaClient();
const env = parseEnv(process.env);

function maskPhone(phone: string) {
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

async function assertDemoSeedTarget(phone: string, expectedRole: UserRole, expectedName: string) {
  const existing = await prisma.user.findUnique({
    where: { phone },
    select: {
      role: true,
      name: true
    }
  });

  if (!existing) return;

  if (existing.role !== expectedRole || (existing.name && existing.name !== expectedName)) {
    throw new Error(`Refusing to modify non-demo user for ${maskPhone(phone)}`);
  }
}

async function main() {
  const credentials = [
    env.APP_REVIEW_DEMO_CLIENT_PHONE,
    env.APP_REVIEW_DEMO_CLIENT_PASSWORD,
    env.APP_REVIEW_DEMO_WORKER_PHONE,
    env.APP_REVIEW_DEMO_WORKER_PASSWORD
  ];

  if (credentials.some((value) => !value)) {
    throw new Error(
      "APP_REVIEW_DEMO_CLIENT_PHONE, APP_REVIEW_DEMO_CLIENT_PASSWORD, APP_REVIEW_DEMO_WORKER_PHONE and APP_REVIEW_DEMO_WORKER_PASSWORD are required"
    );
  }

  const clientPhone = normalizePhone(env.APP_REVIEW_DEMO_CLIENT_PHONE!);
  const workerPhone = normalizePhone(env.APP_REVIEW_DEMO_WORKER_PHONE!);
  const [clientPasswordHash, workerPasswordHash] = await Promise.all([
    hashPassword(env.APP_REVIEW_DEMO_CLIENT_PASSWORD!),
    hashPassword(env.APP_REVIEW_DEMO_WORKER_PASSWORD!)
  ]);
  const passwordSetAt = new Date();
  const passwordChangedAt = passwordSetAt;
  const clientName = "App Review Client";
  const workerName = "App Review Worker";

  await Promise.all([
    assertDemoSeedTarget(clientPhone, UserRole.CLIENT, clientName),
    assertDemoSeedTarget(workerPhone, UserRole.PROVIDER, workerName)
  ]);

  const client = await prisma.user.upsert({
    where: { phone: clientPhone },
    update: {
      name: clientName,
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      passwordHash: clientPasswordHash,
      passwordSetAt,
      passwordChangedAt,
      sessionVersion: { increment: 1 }
    },
    create: {
      phone: clientPhone,
      name: clientName,
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
      cityId: "tashkent",
      passwordHash: clientPasswordHash,
      passwordSetAt,
      passwordChangedAt
    }
  });

  const workerUser = await prisma.user.upsert({
    where: { phone: workerPhone },
    update: {
      name: workerName,
      role: UserRole.PROVIDER,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      cityId: "tashkent",
      passwordHash: workerPasswordHash,
      passwordSetAt,
      passwordChangedAt,
      sessionVersion: { increment: 1 }
    },
    create: {
      phone: workerPhone,
      name: workerName,
      role: UserRole.PROVIDER,
      status: UserStatus.ACTIVE,
      cityId: "tashkent",
      passwordHash: workerPasswordHash,
      passwordSetAt,
      passwordChangedAt
    }
  });

  await prisma.session.updateMany({
    where: {
      userId: {
        in: [client.id, workerUser.id]
      },
      revoked: false
    },
    data: {
      revoked: true
    }
  });

  const worker = await prisma.workerProfile.upsert({
    where: { userId: workerUser.id },
    update: {
      status: WorkerProfileStatus.APPROVED,
      profession: "Usta",
      professions: ["Usta"],
      experienceYears: 5,
      bio: "App Review uchun tasdiqlangan demo usta.",
      basePrice: 100000,
      submittedAt: new Date(),
      verifiedAt: new Date(),
      moderationReason: null
    },
    create: {
      userId: workerUser.id,
      status: WorkerProfileStatus.APPROVED,
      profession: "Usta",
      professions: ["Usta"],
      experienceYears: 5,
      bio: "App Review uchun tasdiqlangan demo usta.",
      basePrice: 100000,
      submittedAt: new Date(),
      verifiedAt: new Date()
    }
  });

  await prisma.workerAvailability.upsert({
    where: { workerId: worker.id },
    update: {
      status: WorkerAvailabilityStatus.AVAILABLE,
      activeOrderId: null,
      lockedUntil: null
    },
    create: {
      workerId: worker.id,
      status: WorkerAvailabilityStatus.AVAILABLE
    }
  });

  console.log(
    JSON.stringify(
      {
        prepared: true,
        client: maskPhone(client.phone),
        worker: maskPhone(workerUser.phone),
        passwordsPrinted: false
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Failed to prepare App Review accounts");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
