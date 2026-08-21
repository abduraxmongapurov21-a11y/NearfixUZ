import { PrismaClient, UserRole, UserStatus, WorkerAvailabilityStatus, WorkerProfileStatus } from "@prisma/client";
import { parseEnv } from "../src/config/env.js";
import { assertLocalDatabaseTarget } from "../src/db/local-database.guard.js";
import { hashPassword } from "../src/modules/auth/password.js";
import { normalizePhone } from "../src/utils/phone.js";

const env = parseEnv(process.env);
const databaseIdentity = assertLocalDatabaseTarget(process.env);
const prisma = new PrismaClient();
const LOCAL_AVATAR_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function maskPhone(phone: string) {
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

async function assertFixtureTarget(phone: string, expectedRole: UserRole, expectedName: string) {
  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { role: true, name: true }
  });

  if (!existing) return;
  if (existing.role !== expectedRole || (existing.name && existing.name !== expectedName)) {
    throw new Error(`Refusing to modify a non-fixture user for ${maskPhone(phone)}`);
  }
}

async function main() {
  if (!env.APP_REVIEW_DEMO_ENABLED) {
    throw new Error("Local runtime fixture requires APP_REVIEW_DEMO_ENABLED=true");
  }

  const credentials = [
    env.APP_REVIEW_DEMO_CLIENT_PHONE,
    env.APP_REVIEW_DEMO_CLIENT_PASSWORD,
    env.APP_REVIEW_DEMO_WORKER_PHONE,
    env.APP_REVIEW_DEMO_WORKER_PASSWORD
  ];
  if (credentials.some((value) => !value)) {
    throw new Error("Local runtime fixture requires both configured demo identities");
  }

  const clientPhone = normalizePhone(env.APP_REVIEW_DEMO_CLIENT_PHONE!);
  const providerPhone = normalizePhone(env.APP_REVIEW_DEMO_WORKER_PHONE!);
  const clientName = "Local Runtime Client";
  const providerName = "Local Runtime Provider";

  await Promise.all([
    assertFixtureTarget(clientPhone, UserRole.CLIENT, clientName),
    assertFixtureTarget(providerPhone, UserRole.PROVIDER, providerName)
  ]);

  const [clientPasswordHash, providerPasswordHash] = await Promise.all([
    hashPassword(env.APP_REVIEW_DEMO_CLIENT_PASSWORD!),
    hashPassword(env.APP_REVIEW_DEMO_WORKER_PASSWORD!)
  ]);
  const passwordSetAt = new Date();

  const client = await prisma.user.upsert({
    where: { phone: clientPhone },
    update: {
      name: clientName,
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
      cityId: "tashkent",
      deletedAt: null,
      passwordHash: clientPasswordHash,
      passwordSetAt,
      passwordChangedAt: passwordSetAt,
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
      passwordChangedAt: passwordSetAt
    }
  });

  const provider = await prisma.user.upsert({
    where: { phone: providerPhone },
    update: {
      name: providerName,
      role: UserRole.PROVIDER,
      status: UserStatus.ACTIVE,
      cityId: "tashkent",
      deletedAt: null,
      passwordHash: providerPasswordHash,
      passwordSetAt,
      passwordChangedAt: passwordSetAt,
      sessionVersion: { increment: 1 }
    },
    create: {
      phone: providerPhone,
      name: providerName,
      role: UserRole.PROVIDER,
      status: UserStatus.ACTIVE,
      cityId: "tashkent",
      passwordHash: providerPasswordHash,
      passwordSetAt,
      passwordChangedAt: passwordSetAt
    }
  });

  await prisma.session.updateMany({
    where: { userId: { in: [client.id, provider.id] }, revoked: false },
    data: { revoked: true }
  });

  const worker = await prisma.workerProfile.upsert({
    where: { userId: provider.id },
    update: {
      status: WorkerProfileStatus.APPROVED,
      profession: "Santexnik",
      professions: ["Santexnik"],
      experienceYears: 5,
      profileImageUrl: LOCAL_AVATAR_DATA_URI,
      bio: "Mahalliy Android runtime sinovlari uchun tasdiqlangan usta.",
      basePrice: 100000,
      serviceLat: 41.311081,
      serviceLng: 69.240562,
      serviceLocationUpdatedAt: new Date(),
      submittedAt: new Date(),
      verifiedAt: new Date(),
      moderationReason: null
    },
    create: {
      userId: provider.id,
      status: WorkerProfileStatus.APPROVED,
      profession: "Santexnik",
      professions: ["Santexnik"],
      experienceYears: 5,
      profileImageUrl: LOCAL_AVATAR_DATA_URI,
      bio: "Mahalliy Android runtime sinovlari uchun tasdiqlangan usta.",
      basePrice: 100000,
      serviceLat: 41.311081,
      serviceLng: 69.240562,
      serviceLocationUpdatedAt: new Date(),
      submittedAt: new Date(),
      verifiedAt: new Date()
    }
  });

  await prisma.workerAvailability.upsert({
    where: { workerId: worker.id },
    update: { status: WorkerAvailabilityStatus.AVAILABLE, activeOrderId: null, lockedUntil: null },
    create: { workerId: worker.id, status: WorkerAvailabilityStatus.AVAILABLE }
  });

  console.log(JSON.stringify({
    prepared: true,
    database: databaseIdentity,
    client: maskPhone(client.phone),
    provider: maskPhone(provider.phone),
    passwordsPrinted: false
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Failed to prepare local runtime identities");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
