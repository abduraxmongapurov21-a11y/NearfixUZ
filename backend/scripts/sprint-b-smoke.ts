import {
  ChatParticipantRole,
  ChatRoomType,
  OrderStatus,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  ReviewStatus,
  SupportTicketStatus,
  UserRole,
  WorkerProfileStatus
} from "@prisma/client";
import { prisma } from "../src/db/prisma.js";
import type { AuthUser } from "../src/modules/auth/auth-context.js";
import { assertUsersNotBlocked, blockUser, listBlockedUsers, unblockUser } from "../src/modules/blocks/block.service.js";
import {
  createReport,
  getAdminReport,
  listAdminReports,
  updateAdminReport
} from "../src/modules/reports/report.service.js";
import { listWorkerReviews, setReviewVisibility } from "../src/modules/reviews/review.service.js";
import {
  createSupportTicket,
  listAdminSupportTickets,
  updateAdminSupportTicket
} from "../src/modules/support/support.service.js";

function authUser(user: { id: string; phone: string; name: string | null; role: UserRole; sessionVersion: number }): AuthUser {
  return {
    id: user.id,
    sessionId: "sprint-b-smoke",
    phone: user.phone,
    name: user.name,
    role: user.role.toLowerCase(),
    permissions: [],
    sessionVersion: user.sessionVersion
  };
}

function ensure(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function main() {
  const suffix = String(Date.now()).slice(-7);
  const reporterPhone = `+99890${suffix}`;
  const targetPhone = `+99891${suffix}`;
  const adminPhone = `+99893${suffix}`;
  let reporterId = "";
  let targetId = "";
  let adminId = "";
  let orderId = "";
  let roomId = "";

  try {
    const [reporter, target, admin] = await Promise.all([
      prisma.user.create({ data: { phone: reporterPhone, name: "Sprint B Client", role: UserRole.CLIENT } }),
      prisma.user.create({ data: { phone: targetPhone, name: "Sprint B Worker", role: UserRole.PROVIDER } }),
      prisma.user.create({ data: { phone: adminPhone, name: "Sprint B Admin", role: UserRole.SUPER_ADMIN } })
    ]);
    reporterId = reporter.id;
    targetId = target.id;
    adminId = admin.id;

    const worker = await prisma.workerProfile.create({
      data: {
        userId: target.id,
        status: WorkerProfileStatus.APPROVED,
        profession: "Sprint B test worker",
        ratingAvg: 5
      }
    });
    const order = await prisma.order.create({
      data: {
        publicCode: `SB-${suffix}`,
        clientId: reporter.id,
        workerId: worker.id,
        cityId: "tashkent",
        serviceType: "Sprint B",
        problemTitle: "Moderation smoke test",
        status: OrderStatus.COMPLETED
      }
    });
    orderId = order.id;
    const review = await prisma.review.create({
      data: { orderId: order.id, clientId: reporter.id, workerId: worker.id, rating: 5, text: "Sprint B review" }
    });
    const room = await prisma.chatRoom.create({
      data: {
        type: ChatRoomType.DIRECT,
        title: "Sprint B chat",
        createdById: reporter.id,
        participants: {
          create: [
            { userId: reporter.id, role: ChatParticipantRole.CLIENT },
            { userId: target.id, role: ChatParticipantRole.PROVIDER }
          ]
        }
      }
    });
    roomId = room.id;
    const message = await prisma.chatMessage.create({
      data: { roomId: room.id, senderId: target.id, body: "Sprint B reported message" }
    });

    const clientAuth = authUser(reporter);
    const workerAuth = authUser(target);

    const userReport = await createReport(clientAuth, {
      targetType: ReportTargetType.USER,
      targetId: target.id,
      reason: ReportReason.ABUSE,
      details: "Smoke test"
    });
    await createReport(clientAuth, {
      targetType: ReportTargetType.WORKER,
      targetId: worker.id,
      reason: ReportReason.SAFETY_RISK
    });
    await createReport(clientAuth, {
      targetType: ReportTargetType.MESSAGE,
      targetId: message.id,
      reason: ReportReason.HARASSMENT
    });
    await createReport(workerAuth, {
      targetType: ReportTargetType.REVIEW,
      targetId: review.id,
      reason: ReportReason.INAPPROPRIATE_CONTENT
    });
    await createReport(clientAuth, {
      targetType: ReportTargetType.ORDER,
      targetId: order.id,
      reason: ReportReason.OTHER
    });

    const reportDetail = await getAdminReport(userReport.id);
    ensure(reportDetail.target, "Admin report target context missing");
    await updateAdminReport(userReport.id, admin.id, {
      status: ReportStatus.ACTION_TAKEN,
      adminNote: "Smoke test complete"
    });
    await updateAdminReport(userReport.id, "env-admin", {
      status: ReportStatus.RESOLVED,
      adminNote: "Env admin compatibility"
    });
    const reports = await listAdminReports({ status: ReportStatus.PENDING });
    ensure(reports.length >= 4, "Admin report queue missing pending reports");

    await blockUser(clientAuth, target.id);
    ensure((await listBlockedUsers(clientAuth)).length === 1, "Blocked user list is empty");
    let blockedInteraction = false;
    try {
      await assertUsersNotBlocked(clientAuth.id, target.id);
    } catch {
      blockedInteraction = true;
    }
    ensure(blockedInteraction, "Blocked interaction was not rejected");
    await unblockUser(clientAuth, target.id);

    const clientTicket = await createSupportTicket(clientAuth, {
      orderId: order.id,
      reason: "Client smoke test",
      message: "Client support request"
    });
    await createSupportTicket(workerAuth, {
      orderId: order.id,
      reason: "Worker smoke test",
      message: "Worker support request"
    });
    ensure((await listAdminSupportTickets({})).some((ticket) => ticket.id === clientTicket.id), "Support queue missing ticket");
    await updateAdminSupportTicket(clientTicket.id, admin.id, {
      status: SupportTicketStatus.RESOLVED,
      adminNote: "Resolved by smoke test"
    });
    await updateAdminSupportTicket(clientTicket.id, "env-admin", {
      status: SupportTicketStatus.CLOSED,
      adminNote: "Env admin compatibility"
    });

    await setReviewVisibility(review.id, ReviewStatus.HIDDEN);
    ensure(!(await listWorkerReviews(worker.id)).some((item) => item.id === review.id), "Hidden review remains public");
    await setReviewVisibility(review.id, ReviewStatus.PUBLISHED);
    ensure((await listWorkerReviews(worker.id)).some((item) => item.id === review.id), "Restored review is not public");

    console.log(JSON.stringify({
      reports: "pass",
      blocks: "pass",
      support: "pass",
      reviewModeration: "pass"
    }));
  } finally {
    if (roomId) await prisma.chatRoom.deleteMany({ where: { id: roomId } });
    if (orderId) await prisma.order.deleteMany({ where: { id: orderId } });
    if (reporterId || targetId || adminId) {
      await prisma.user.deleteMany({ where: { id: { in: [reporterId, targetId, adminId].filter(Boolean) } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
