import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  AdminAccountRole,
  AdminAccountStatus,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  SupportTicketStatus,
  UserRole
} from "@prisma/client";
import { env } from "../src/config/env.js";
import { prisma } from "../src/db/prisma.js";
import { createApp } from "../src/http/app.js";
import { hashPassword } from "../src/modules/auth/password.js";
import { createAccessToken, hashRefreshToken } from "../src/modules/auth/session.js";
import { getAdminReport, updateAdminReport } from "../src/modules/reports/report.service.js";
import { getAdminSupportTicket, updateAdminSupportTicket } from "../src/modules/support/support.service.js";

type Kind = "report" | "support";
type Status = ReportStatus | SupportTicketStatus;
type Actor = {
  label: string;
  username: string;
  token: string;
  actorType: "ENV_ADMIN" | "ADMIN_ACCOUNT";
  actorAdminId: string | null;
};
type Payload = {
  token?: string;
  code?: string;
  user?: { role?: string };
  report?: { resolvedByAdminId?: string | null; resolvedByAdmin?: unknown };
  ticket?: { resolvedByAdminId?: string | null; resolvedByAdmin?: unknown };
};
type Evidence = Record<string, string | number | boolean | null>;

const terminalCases: { kind: Kind; status: Status }[] = [
  { kind: "support", status: SupportTicketStatus.RESOLVED },
  { kind: "support", status: SupportTicketStatus.CLOSED },
  { kind: "report", status: ReportStatus.RESOLVED },
  { kind: "report", status: ReportStatus.DISMISSED },
  { kind: "report", status: ReportStatus.ACTION_TAKEN }
];
const userIds: string[] = [];
const adminIds: string[] = [];
const targetIds: string[] = [];
let server: Server | undefined;
let currentCase = "fixture bootstrap";
let casesPassed = 0;
let httpCasesPassed = 0;
let serviceCasesPassed = 0;

async function runCase(label: string, layer: "HTTP+DB" | "SERVICE+DB", check: () => Promise<Evidence>) {
  currentCase = label;
  const evidence = await check();
  casesPassed += 1;
  if (layer === "HTTP+DB") httpCasesPassed += 1;
  else serviceCasesPassed += 1;
  console.log(`[F4] ${JSON.stringify({ case: label, layer, result: "PASS", ...evidence })}`);
}

async function main() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const password = `Terminal-${randomUUID()}`;
  const passwordHash = await hashPassword(password);
  const collisionId = `terminal-collision-${suffix}`;
  let baseUrl = "";

  async function request(method: string, path: string, token?: string, body?: unknown) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, payload: await response.json() as Payload };
  }

  async function login(
    username: string,
    actorType: Actor["actorType"],
    actorAdminId: string | null,
    label: string,
    expectedRole = actorType === "ENV_ADMIN" ? "super_admin" : "admin"
  ) {
    const result = await request("POST", "/admin/auth/login", undefined, {
      username,
      password: actorType === "ENV_ADMIN" ? env.ADMIN_PASSWORD : password
    });
    assert.equal(result.status, 200);
    assert.equal(typeof result.payload.token, "string");
    assert.equal(result.payload.user?.role, expectedRole);
    return { label, username, actorType, actorAdminId, token: result.payload.token! } satisfies Actor;
  }

  async function createAdmin(label: string, role: AdminAccountRole, permissions: string[], id?: string) {
    const admin = await prisma.adminAccount.create({
      data: {
        ...(id ? { id } : {}),
        username: `terminal-${label}-${suffix}`,
        name: `Terminal ${label}`,
        passwordHash,
        role,
        status: AdminAccountStatus.ACTIVE,
        mustChangePassword: false,
        permissions: { create: permissions.map((permission) => ({ permission })) }
      }
    });
    adminIds.push(admin.id);
    return admin;
  }

  async function createUser(label: string, role: UserRole, phone: string, id?: string) {
    const user = await prisma.user.create({ data: { ...(id ? { id } : {}), phone, name: `Terminal ${label}`, role } });
    userIds.push(user.id);
    return user;
  }

  try {
    const client = await createUser("client", UserRole.CLIENT, "+998991118201");
    const legacyAdmin = await createUser("legacy resolver", UserRole.SUPER_ADMIN, "+998991118202");
    const collisionUser = await createUser("different legacy identity", UserRole.SUPER_ADMIN, "+998991118203", collisionId);
    const dbSuper = await createAdmin("super", AdminAccountRole.SUPER_ADMIN, []);
    const dbManager = await createAdmin("manager", AdminAccountRole.ADMIN, [
      "reports.read", "reports.manage", "support.read", "support.manage"
    ], collisionId);
    const dbReader = await createAdmin("reader", AdminAccountRole.ADMIN, ["reports.read", "support.read"]);
    const dbNoPermission = await createAdmin("no-permission", AdminAccountRole.ADMIN, []);
    const dbReportOnly = await createAdmin("report-only", AdminAccountRole.ADMIN, ["reports.manage"]);
    const dbSupportOnly = await createAdmin("support-only", AdminAccountRole.ADMIN, ["support.manage"]);

    assert.equal(collisionUser.id, dbManager.id);
    assert.notEqual(collisionUser.name, dbManager.name);
    assert.equal(dbManager.role, AdminAccountRole.ADMIN);
    assert.equal(await prisma.user.count({ where: { id: dbSuper.id } }), 0);

    server = createApp().listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server!.once("listening", resolve);
      server!.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const authorized = [
      await login(env.ADMIN_USERNAME, "ENV_ADMIN", null, "environment admin"),
      await login(dbSuper.username, "ADMIN_ACCOUNT", dbSuper.id, "DB super admin", "super_admin"),
      await login(dbManager.username, "ADMIN_ACCOUNT", dbManager.id, "limited DB manager with colliding User ID")
    ];
    const reader = await login(dbReader.username, "ADMIN_ACCOUNT", dbReader.id, "read-only DB admin");
    const noPermission = await login(dbNoPermission.username, "ADMIN_ACCOUNT", dbNoPermission.id, "DB admin without permissions");
    const reportOnly = await login(dbReportOnly.username, "ADMIN_ACCOUNT", dbReportOnly.id, "reports.manage only");
    const supportOnly = await login(dbSupportOnly.username, "ADMIN_ACCOUNT", dbSupportOnly.id, "support.manage only");
    const mobileSession = await prisma.session.create({
      data: {
        userId: client.id,
        refreshToken: hashRefreshToken(randomUUID()),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }
    });
    const mobileToken = createAccessToken({ userId: client.id, sessionId: mobileSession.id, sessionVersion: client.sessionVersion });

    await runCase("mobile denial control has a valid mobile session", "HTTP+DB", async () => {
      const result = await request("GET", "/auth/me", mobileToken);
      assert.equal(result.status, 200);
      return { httpStatus: result.status };
    });

    async function createTarget(kind: Kind, resolved = false) {
      const resolver = resolved ? { resolvedByAdminId: legacyAdmin.id, resolvedAt: new Date("2026-01-01T12:00:00.000Z") } : {};
      const record = kind === "report"
        ? await prisma.report.create({ data: {
            reporterId: client.id,
            targetType: ReportTargetType.USER,
            targetId: collisionUser.id,
            reason: ReportReason.OTHER,
            status: resolved ? ReportStatus.RESOLVED : ReportStatus.REVIEWING,
            adminNote: "Existing fixture note",
            ...resolver
          } })
        : await prisma.supportTicket.create({ data: {
            userId: client.id,
            reason: "Terminal HTTP regression",
            status: resolved ? SupportTicketStatus.RESOLVED : SupportTicketStatus.IN_PROGRESS,
            adminNote: "Existing fixture note",
            ...resolver
          } });
      targetIds.push(record.id);
      return record.id;
    }

    function pathFor(kind: Kind, id: string, mutation = true) {
      return kind === "report" ? `/admin/reports/${id}${mutation ? "/status" : ""}` : `/admin/support/tickets/${id}`;
    }

    async function snapshot(kind: Kind, id: string) {
      return kind === "report"
        ? prisma.report.findUniqueOrThrow({ where: { id } })
        : prisma.supportTicket.findUniqueOrThrow({ where: { id } });
    }

    async function assertAudit(kind: Kind, id: string, status: Status, actor: Actor) {
      const action = kind === "support" ? "support.status_updated"
        : status === ReportStatus.DISMISSED ? "report.rejected"
        : status === ReportStatus.RESOLVED || status === ReportStatus.ACTION_TAKEN ? "report.resolved"
        : "report.status_updated";
      const logs = await prisma.adminAuditLog.findMany({ where: { targetId: id }, orderBy: { createdAt: "asc" } });
      assert.equal(logs.length, kind === "support" ? 2 : 1);
      const statusLogs = logs.filter((log) => log.action === action);
      assert.equal(statusLogs.length, 1);
      for (const log of logs) {
        assert.equal(log.actorType, actor.actorType);
        assert.equal(log.actorAdminId, actor.actorAdminId);
        assert.equal(log.targetType, kind === "report" ? "Report" : "SupportTicket");
        assert.equal((log.metadata as Record<string, unknown>).actorUsername, actor.username);
      }
      assert.equal((statusLogs[0].metadata as Record<string, unknown>).status, status);
      if (kind === "support") {
        const noteLog = logs.find((log) => log.action === "support.note_updated");
        assert.ok(noteLog);
        assert.equal((noteLog.metadata as Record<string, unknown>).hasAdminNote, true);
      }
    }

    for (const actor of authorized) {
      for (const { kind, status } of terminalCases) {
        await runCase(`${actor.label}: ${kind} ${status}`, "HTTP+DB", async () => {
          const id = await createTarget(kind);
          const result = await request("PATCH", pathFor(kind, id), actor.token, { status, adminNote: "  Terminal saved  " });
          assert.equal(result.status, 200);
          const saved = await snapshot(kind, id);
          assert.equal(saved.status, status);
          assert.equal(saved.adminNote, "Terminal saved");
          assert.equal(saved.resolvedByAdminId, null);
          assert.ok(saved.resolvedAt instanceof Date);
          const detail = await request("GET", pathFor(kind, id, false), actor.token);
          assert.equal(detail.status, 200);
          const resolvedRecord = kind === "report" ? detail.payload.report : detail.payload.ticket;
          assert.ok(resolvedRecord);
          assert.equal(resolvedRecord.resolvedByAdminId, null);
          assert.equal(resolvedRecord.resolvedByAdmin, null);
          await assertAudit(kind, id, status, actor);
          return {
            httpStatus: result.status,
            detailStatus: detail.status,
            resolverNull: true,
            resolvedAtPresent: true,
            auditActorVerified: true,
            collidingUserId: actor.actorAdminId === collisionUser.id
          };
        });
      }
    }

    for (const { actor, allowedKind } of [
      { actor: reportOnly, allowedKind: "report" },
      { actor: supportOnly, allowedKind: "support" }
    ] as const) {
      for (const { kind, status } of terminalCases) {
        if (kind === allowedKind) {
          await runCase(`${actor.label}: ${kind} ${status} writes without read permission`, "HTTP+DB", async () => {
            const id = await createTarget(kind);
            const result = await request("PATCH", pathFor(kind, id), actor.token, { status, adminNote: " Scoped terminal saved " });
            assert.equal(result.status, 200);
            const saved = await snapshot(kind, id);
            assert.equal(saved.status, status);
            assert.equal(saved.adminNote, "Scoped terminal saved");
            assert.equal(saved.resolvedByAdminId, null);
            assert.ok(saved.resolvedAt instanceof Date);
            await assertAudit(kind, id, status, actor);
            const auditCount = await prisma.adminAuditLog.count({ where: { targetId: id } });
            const detail = await request("GET", pathFor(kind, id, false), actor.token);
            assert.equal(detail.status, 403);
            assert.equal(detail.payload.code, "PERMISSION_REQUIRED");
            assert.deepEqual(await snapshot(kind, id), saved);
            assert.equal(await prisma.adminAuditLog.count({ where: { targetId: id } }), auditCount);
            return { httpStatus: result.status, detailStatus: detail.status, resolverNull: true, auditActorVerified: true, deniedReadUnchanged: true };
          });
        } else {
          await runCase(`${actor.label}: cross-scope ${kind} ${status} denied without mutation`, "HTTP+DB", async () => {
            const id = await createTarget(kind);
            const before = await snapshot(kind, id);
            const result = await request("PATCH", pathFor(kind, id), actor.token, { status, adminNote: "Must not cross scope" });
            assert.equal(result.status, 403);
            assert.equal(result.payload.code, "PERMISSION_REQUIRED");
            assert.deepEqual(await snapshot(kind, id), before);
            assert.equal(await prisma.adminAuditLog.count({ where: { targetId: id } }), 0);
            return { httpStatus: result.status, recordUnchanged: true, mutationAuditAbsent: true };
          });
        }
      }
    }

    const denied = [
      { label: reader.label, token: reader.token, expected: 403 },
      { label: noPermission.label, token: noPermission.token, expected: 403 },
      { label: "anonymous", token: undefined, expected: 401 },
      { label: "valid mobile client", token: mobileToken, expected: 401 }
    ];
    for (const actor of denied) {
      for (const { kind, status } of terminalCases) {
        await runCase(`${actor.label}: deny ${kind} ${status} without mutation`, "HTTP+DB", async () => {
          const id = await createTarget(kind);
          const before = await snapshot(kind, id);
          const result = await request("PATCH", pathFor(kind, id), actor.token, { status, adminNote: "Must not persist" });
          assert.equal(result.status, actor.expected);
          assert.deepEqual(await snapshot(kind, id), before);
          assert.equal(await prisma.adminAuditLog.count({ where: { targetId: id } }), 0);
          return { httpStatus: result.status, recordUnchanged: true, mutationAuditAbsent: true };
        });
      }
    }

    const manager = authorized[2];
    const reopenCases: { kind: Kind; status: Status }[] = [
      { kind: "support", status: SupportTicketStatus.OPEN },
      { kind: "support", status: SupportTicketStatus.IN_PROGRESS },
      { kind: "report", status: ReportStatus.PENDING },
      { kind: "report", status: ReportStatus.REVIEWING }
    ];
    for (const { kind, status } of reopenCases) {
      await runCase(`DB manager reopens ${kind} to ${status}`, "HTTP+DB", async () => {
        const id = await createTarget(kind, true);
        const before = await snapshot(kind, id);
        assert.equal(before.resolvedByAdminId, legacyAdmin.id);
        assert.ok(before.resolvedAt);
        const result = await request("PATCH", pathFor(kind, id), manager.token, { status, adminNote: " Reopened " });
        assert.equal(result.status, 200);
        const saved = await snapshot(kind, id);
        assert.equal(saved.status, status);
        assert.equal(saved.resolvedByAdminId, null);
        assert.equal(saved.resolvedAt, null);
        await assertAudit(kind, id, status, manager);
        return { httpStatus: result.status, resolverCleared: true, resolvedAtCleared: true, auditActorVerified: true };
      });
    }

    for (const kind of ["report", "support"] as const) {
      await runCase(`DB manager missing ${kind} returns 404`, "HTTP+DB", async () => {
        const id = `missing-terminal-${randomUUID()}`;
        const result = await request("PATCH", pathFor(kind, id), manager.token, { status: "RESOLVED" });
        assert.equal(result.status, 404);
        assert.equal(result.payload.code, kind === "report" ? "REPORT_NOT_FOUND" : "SUPPORT_TICKET_NOT_FOUND");
        assert.equal(await prisma.adminAuditLog.count({ where: { targetId: id } }), 0);
        return { httpStatus: result.status, mutationAuditAbsent: true };
      });
    }

    // These compatibility controls call the service directly; they do not
    // establish HTTP authentication or audit behavior for legacy User admins.
    for (const { kind, status } of terminalCases) {
      await runCase(`legacy User resolver: ${kind} ${status} (direct service)`, "SERVICE+DB", async () => {
        const id = await createTarget(kind);
        if (kind === "report") await updateAdminReport(id, legacyAdmin.id, { status: status as ReportStatus });
        else await updateAdminSupportTicket(id, legacyAdmin.id, { status: status as SupportTicketStatus });
        const saved = await snapshot(kind, id);
        assert.equal(saved.status, status);
        assert.equal(saved.resolvedByAdminId, legacyAdmin.id);
        assert.ok(saved.resolvedAt instanceof Date);
        const detail = kind === "report" ? await getAdminReport(id) : await getAdminSupportTicket(id);
        assert.equal(detail.resolvedByAdmin?.id, legacyAdmin.id);
        assert.equal(detail.resolvedByAdmin?.name, legacyAdmin.name);
        assert.equal(await prisma.adminAuditLog.count({ where: { targetId: id } }), 0);
        return { legacyUserForeignKeyPreserved: true, legacyRelationPreserved: true, httpExercised: false };
      });
    }

    for (const kind of ["report", "support"] as const) {
      await runCase(`env-admin sentinel: ${kind} (direct service)`, "SERVICE+DB", async () => {
        const id = await createTarget(kind);
        if (kind === "report") await updateAdminReport(id, "env-admin", { status: ReportStatus.RESOLVED });
        else await updateAdminSupportTicket(id, "env-admin", { status: SupportTicketStatus.CLOSED });
        const saved = await snapshot(kind, id);
        assert.equal(saved.resolvedByAdminId, null);
        assert.ok(saved.resolvedAt instanceof Date);
        return { sentinelCompatibility: true, resolverNull: true, httpExercised: false };
      });
    }

  } finally {
    const caseBeforeCleanup = currentCase;
    currentCase = "owned fixture cleanup";
    try {
      if (server?.listening) {
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => error ? reject(error) : resolve());
          server!.closeAllConnections();
        });
      }
    } finally {
      try {
        await prisma.adminAuditLog.deleteMany({ where: { OR: [
          { actorAdminId: { in: adminIds } },
          { targetId: { in: [...targetIds, ...adminIds] } }
        ] } });
        await prisma.report.deleteMany({ where: { reporterId: { in: userIds } } });
        await prisma.supportTicket.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.adminAccount.deleteMany({ where: { id: { in: adminIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      } finally {
        await prisma.$disconnect();
      }
    }
    currentCase = caseBeforeCleanup;
  }
  console.log(`[F4] ${JSON.stringify({ suite: "admin-terminal-http-tests", result: "PASS", casesPassed, httpCasesPassed, serviceCasesPassed, limits: "Disposable loopback HTTP+DB; seven labeled direct service compatibility controls; no production or external transport" })}`);
}

main().catch((error: unknown) => {
  console.log(`[F4] ${JSON.stringify({ case: currentCase, result: "FAIL", errorType: error instanceof Error ? error.name : "UnknownError", detailsSuppressed: true })}`);
  process.exitCode = 1;
});
