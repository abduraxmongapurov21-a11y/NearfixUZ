import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaClient, UserRole, UserStatus, WorkerAvailabilityStatus, WorkerProfileStatus } from "@prisma/client";
import { assertLocalDatabaseTarget } from "../src/db/local-database.guard.js";

const prisma = new PrismaClient();
const WORKERS_PER_CATEGORY = 3;
const FIXTURE_NAME_PREFIX = "NearFIX Demo";
const LOCAL_AVATAR_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function fixtureName(categorySlug: string, slot: number) {
  return `${FIXTURE_NAME_PREFIX} ${categorySlug} ${slot}`;
}

function fixturePhone(categorySlug: string, slot: number) {
  const digest = createHash("sha256").update(`nearfix-local-catalog:${categorySlug}:${slot}`).digest();
  const subscriber = String(digest.readUInt32BE(0) % 10_000_000).padStart(7, "0");
  return `+99833${subscriber}`;
}

async function assertFixtureTarget(phone: string, name: string) {
  const existing = await prisma.user.findUnique({
    where: { phone },
    select: { name: true, role: true }
  });

  if (!existing) return;
  if (existing.name !== name || existing.role !== UserRole.PROVIDER) {
    throw new Error(`Refusing to overwrite a non-fixture user at ${phone.slice(0, 6)}***${phone.slice(-3)}`);
  }
}

async function main() {
  const database = assertLocalDatabaseTarget(process.env);
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  if (!categories.length) {
    throw new Error("No active categories found. Run the category seed first.");
  }

  const fixtures = categories.flatMap((category) =>
    Array.from({ length: WORKERS_PER_CATEGORY }, (_, index) => {
      const slot = index + 1;
      return {
        category,
        slot,
        name: fixtureName(category.slug, slot),
        phone: fixturePhone(category.slug, slot)
      };
    })
  );

  if (new Set(fixtures.map((fixture) => fixture.phone)).size !== fixtures.length) {
    throw new Error("Generated fixture phone collision; no data was changed.");
  }

  for (const fixture of fixtures) {
    await assertFixtureTarget(fixture.phone, fixture.name);
  }

  const preparedWorkers = [];
  for (const fixture of fixtures) {
    const user = await prisma.user.upsert({
      where: { phone: fixture.phone },
      update: {
        name: fixture.name,
        role: UserRole.PROVIDER,
        status: UserStatus.ACTIVE,
        cityId: "tashkent",
        deletedAt: null
      },
      create: {
        phone: fixture.phone,
        name: fixture.name,
        role: UserRole.PROVIDER,
        status: UserStatus.ACTIVE,
        cityId: "tashkent"
      }
    });

    const worker = await prisma.workerProfile.upsert({
      where: { userId: user.id },
      update: {
        status: WorkerProfileStatus.APPROVED,
        profession: fixture.category.nameUz,
        professions: [fixture.category.nameUz],
        experienceYears: 2 + fixture.slot,
        profileImageUrl: LOCAL_AVATAR_DATA_URI,
        bio: `${fixture.category.nameUz} xizmatlari uchun local demo usta.`,
        basePrice: 70_000 + fixture.slot * 10_000,
        ratingAvg: 4.5 + fixture.slot / 10,
        completedOrdersCount: fixture.slot * 7,
        submittedAt: new Date(),
        verifiedAt: new Date(),
        moderationReason: null
      },
      create: {
        userId: user.id,
        status: WorkerProfileStatus.APPROVED,
        profession: fixture.category.nameUz,
        professions: [fixture.category.nameUz],
        experienceYears: 2 + fixture.slot,
        profileImageUrl: LOCAL_AVATAR_DATA_URI,
        bio: `${fixture.category.nameUz} xizmatlari uchun local demo usta.`,
        basePrice: 70_000 + fixture.slot * 10_000,
        ratingAvg: 4.5 + fixture.slot / 10,
        completedOrdersCount: fixture.slot * 7,
        submittedAt: new Date(),
        verifiedAt: new Date()
      }
    });

    await prisma.workerCategory.deleteMany({
      where: { workerId: worker.id, categoryId: { not: fixture.category.id } }
    });
    await prisma.workerCategory.upsert({
      where: { workerId_categoryId: { workerId: worker.id, categoryId: fixture.category.id } },
      update: { sortOrder: 0, isPrimary: true },
      create: { workerId: worker.id, categoryId: fixture.category.id, sortOrder: 0, isPrimary: true }
    });
    await prisma.workerAvailability.upsert({
      where: { workerId: worker.id },
      update: { status: WorkerAvailabilityStatus.AVAILABLE, activeOrderId: null, lockedUntil: null },
      create: { workerId: worker.id, status: WorkerAvailabilityStatus.AVAILABLE }
    });

    preparedWorkers.push({
      category: fixture.category.slug,
      workerId: worker.id,
      phone: fixture.phone
    });
  }

  console.log(
    JSON.stringify(
      {
        prepared: true,
        database,
        activeCategories: categories.length,
        workersPerCategory: WORKERS_PER_CATEGORY,
        totalWorkers: preparedWorkers.length,
        sampleWorker: preparedWorkers[0]
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Failed to prepare local catalog workers");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
