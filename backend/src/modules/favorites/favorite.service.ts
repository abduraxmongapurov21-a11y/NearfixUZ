import { prisma } from "../../db/prisma.js";

export async function listFavorites(clientId: string) {
  return prisma.favorite.findMany({
    where: { clientId },
    include: {
      worker: {
        include: {
          user: true,
          availability: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function addFavorite(clientId: string, workerId: string) {
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
