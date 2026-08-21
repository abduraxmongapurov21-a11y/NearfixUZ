import { prisma } from "../../db/prisma.js";
import { UserRole, WorkerProfileStatus } from "@prisma/client";

type PromoteProviderInput = {
  profession?: string;
  basePrice?: number;
  serviceLat?: number;
  serviceLng?: number;
};

export async function promoteUserToProvider(userId: string, input: PromoteProviderInput = {}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw Object.assign(new Error("User not found"), { status: 404, code: "USER_NOT_FOUND" });
    if (user.role !== UserRole.CLIENT) {
      throw Object.assign(new Error("Only clients can receive a worker application"), {
        status: 409,
        code: "WORKER_APPLICATION_CLIENT_REQUIRED"
      });
    }

    await tx.workerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, status: WorkerProfileStatus.DRAFT }
    });

    const hasServiceLocation = input.serviceLat !== undefined && input.serviceLng !== undefined;
    if (input.profession || input.basePrice || hasServiceLocation) {
      await tx.workerProfile.update({
        where: { userId },
        data: {
          profession: input.profession,
          basePrice: input.basePrice,
          ...(hasServiceLocation
            ? {
                serviceLat: input.serviceLat,
                serviceLng: input.serviceLng,
                serviceLocationUpdatedAt: new Date()
              }
            : {})
        }
      });
    }

    return user;
  });
}
