import { prisma } from "../../db/prisma.js";

export async function listFavorites(clientId: string) {
  return prisma.favorite.findMany({
    where: { clientId },
    include: {
      worker: {
        select: {
          id: true,
          profession: true,
          professions: true,
          experienceYears: true,
          profileImageUrl: true,
          bio: true,
          basePrice: true,
          ratingAvg: true,
          completedOrdersCount: true,
          user: { select: { name: true } },
          availability: { select: { status: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function addFavorite(clientId: string, workerId: string) {
  const worker = await prisma.workerProfile.findUnique({ where: { id: workerId }, select: { id: true } });
  if (!worker) {
    throw Object.assign(new Error("Worker not found"), { status: 404, code: "WORKER_NOT_FOUND" });
  }
  return prisma.favorite.upsert({
    where: {
      clientId_workerId: {
        clientId,
        workerId
      }
    },
    update: {},
    create: {
      clientId,
      workerId
    }
  });
}

export async function removeFavorite(clientId: string, workerId: string) {
  await prisma.favorite.deleteMany({
    where: {
      clientId,
      workerId
    }
  });
}
