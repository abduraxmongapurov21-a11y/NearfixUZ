import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  // Service coordinates are private by default. The narrowly scoped worker
  // self/admin and catalog distance queries explicitly opt back in.
  omit: {
    workerProfile: {
      serviceLat: true,
      serviceLng: true,
      serviceLocationUpdatedAt: true
    }
  },
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});
