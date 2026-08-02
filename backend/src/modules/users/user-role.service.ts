import { prisma } from "../../db/prisma.js";
import { promoteClientToProvider } from "../auth/auth.service.js";

type PromoteProviderInput = {
  profession?: string;
  basePrice?: number;
  serviceLat?: number;
  serviceLng?: number;
};

export async function promoteUserToProvider(userId: string, input: PromoteProviderInput = {}) {
  return prisma.$transaction(async (tx) => {
    const user = await promoteClientToProvider(userId, tx);

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
