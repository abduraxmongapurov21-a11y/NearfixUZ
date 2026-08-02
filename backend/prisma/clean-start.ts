import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const prisma = new PrismaClient();

const ADMIN_PHONE = "+998900000001";
const uploadsDir = join(process.cwd(), "uploads");

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    await tx.workerAvailability.updateMany({
      data: {
        activeOrderId: null,
        lockedUntil: null
      }
    });

    const deleted = {
      chatMessages: await tx.chatMessage.deleteMany(),
      chatParticipants: await tx.chatParticipant.deleteMany(),
      chatRooms: await tx.chatRoom.deleteMany(),
      payments: await tx.payment.deleteMany(),
      notifications: await tx.notification.deleteMany(),
      reviews: await tx.review.deleteMany(),
      orderEvents: await tx.orderEvent.deleteMany(),
      media: await tx.media.deleteMany(),
      favorites: await tx.favorite.deleteMany(),
      orders: await tx.order.deleteMany(),
      addresses: await tx.address.deleteMany(),
      workerAvailability: await tx.workerAvailability.deleteMany(),
      workerProfiles: await tx.workerProfile.deleteMany(),
      sessions: await tx.session.deleteMany(),
      otpChallenges: await tx.otpChallenge.deleteMany(),
      users: await tx.user.deleteMany()
    };

    const admin = await tx.user.create({
      data: {
        phone: ADMIN_PHONE,
        name: "NearFIX Admin",
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE
      }
    });

    return {
      deleted,
      admin: {
        id: admin.id,
        phone: admin.phone,
        role: admin.role
      }
    };
  });

  await rm(uploadsDir, { recursive: true, force: true });
  await mkdir(uploadsDir, { recursive: true });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
