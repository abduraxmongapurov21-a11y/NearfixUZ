import {
  OrderEventActorType,
  OrderEventType,
  OrderStatus,
  Prisma,
  ReviewStatus,
  UserRole
} from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { AuthUser } from "../auth/auth-context.js";

type CreateReviewInput = {
  rating: number;
  comment?: string;
};

function roundRating(value: number) {
  return Math.round(value * 100) / 100;
}

async function refreshWorkerRating(tx: Prisma.TransactionClient, workerId: string) {
  const aggregate = await tx.review.aggregate({
    where: {
      workerId,
      status: ReviewStatus.PUBLISHED
    },
    _avg: {
      rating: true
    }
  });

  const ratingAvg = roundRating(aggregate._avg.rating || 0);

  await tx.workerProfile.update({
    where: { id: workerId },
    data: { ratingAvg }
  });

  return ratingAvg;
}

export async function setReviewVisibility(reviewId: string, status: ReviewStatus) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.review.findUnique({ where: { id: reviewId }, select: { id: true } });
    if (!existing) throw Object.assign(new Error("Review not found"), { status: 404, code: "REVIEW_NOT_FOUND" });

    const review = await tx.review.update({
      where: { id: reviewId },
      data: { status },
      include: {
        client: true,
        worker: { include: { user: true } }
      }
    });
    await refreshWorkerRating(tx, review.workerId);
    return review;
  });
}

export async function createOrderReview(user: AuthUser, orderId: string, input: CreateReviewInput) {
  if (user.role !== UserRole.CLIENT.toLowerCase()) {
    throw Object.assign(new Error("Only clients can create reviews"), {
      status: 403,
      code: "CLIENT_REQUIRED"
    });
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          reviews: {
            take: 1
          }
        }
      });

      if (!order) {
        throw Object.assign(new Error("Order not found"), {
          status: 404,
          code: "ORDER_NOT_FOUND"
        });
      }

      if (order.clientId !== user.id) {
        throw Object.assign(new Error("Only the order owner can review this order"), {
          status: 403,
          code: "ORDER_REVIEW_ACCESS_DENIED"
        });
      }

      if (order.status !== OrderStatus.COMPLETED) {
        throw Object.assign(new Error("Only completed orders can be reviewed"), {
          status: 409,
          code: "ORDER_NOT_COMPLETED"
        });
      }

      if (order.reviews.length) {
        throw Object.assign(new Error("This order already has a review"), {
          status: 409,
          code: "ORDER_REVIEW_EXISTS"
        });
      }

      const review = await tx.review.create({
        data: {
          orderId: order.id,
          clientId: order.clientId,
          workerId: order.workerId,
          rating: input.rating,
          text: input.comment?.trim() || null
        },
        include: {
          client: true,
          worker: { include: { user: true } },
          order: true
        }
      });

      const ratingAvg = await refreshWorkerRating(tx, order.workerId);

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          actorType: OrderEventActorType.CLIENT,
          actorId: user.id,
          eventType: OrderEventType.REVIEW_SUBMITTED,
          fromStatus: order.status,
          toStatus: order.status,
          message: "Client submitted review",
          metadata: {
            reviewId: review.id,
            rating: review.rating
          }
        }
      });

      return {
        review,
        rating: {
          workerId: order.workerId,
          ratingAvg
        }
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw Object.assign(new Error("This order already has a review"), {
        status: 409,
        code: "ORDER_REVIEW_EXISTS"
      });
    }

    throw error;
  }
}

export async function listWorkerReviews(workerId: string) {
  return prisma.review.findMany({
    where: {
      workerId,
      status: ReviewStatus.PUBLISHED
    },
    include: {
      client: true,
      order: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getWorkerRating(workerId: string) {
  const [worker, reviewsCount] = await Promise.all([
    prisma.workerProfile.findUnique({
      where: { id: workerId },
      select: {
        id: true,
        ratingAvg: true
      }
    }),
    prisma.review.count({
      where: {
        workerId,
        status: ReviewStatus.PUBLISHED
      }
    })
  ]);

  if (!worker) {
    throw Object.assign(new Error("Worker not found"), {
      status: 404,
      code: "WORKER_NOT_FOUND"
    });
  }

  return {
    workerId: worker.id,
    ratingAvg: Number(worker.ratingAvg),
    reviewsCount
  };
}
