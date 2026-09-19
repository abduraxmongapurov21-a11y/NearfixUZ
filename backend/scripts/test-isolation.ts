import { createHash, randomUUID } from "node:crypto";

// No application/Prisma/dotenv imports: validation cannot connect or bootstrap.
export function isolationClaim(source: NodeJS.ProcessEnv) {
  const deny = () => { throw new Error("TEST_ISOLATION_REFUSED"); };
  if (source.NODE_ENV !== "test" || !source.DATABASE_URL || !source.DIRECT_URL ||
      !source.F21_TEST_RUN_ID || !/^[a-f0-9-]{36}$/.test(source.F21_TEST_RUN_ID) ||
      !source.DOTENV_CONFIG_PATH || source.NODE_OPTIONS || source.DOTENV_CONFIG_OVERRIDE) deny();
  let url: URL;
  try { url = new URL(source.DATABASE_URL!); } catch { return deny(); }
  const database = url.pathname.slice(1);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || !url.port ||
      url.username !== "f1_test" || url.password || url.search !== "?schema=public" ||
      !/^nearfix_chat_test_[a-f0-9]{32}$/.test(database) ||
      database !== source.F1_DISPOSABLE_DATABASE || source.DIRECT_URL !== source.DATABASE_URL) deny();
  return {
    runId: source.F21_TEST_RUN_ID!,
    fingerprint: createHash("sha256").update(source.DATABASE_URL!).digest("hex")
  };
}

export type IsolationClaim = ReturnType<typeof isolationClaim>;
export type IsolationGrant = IsolationClaim & { approved: boolean; nonce: string };

export async function authorizeTestProcess(
  source: NodeJS.ProcessEnv,
  requestGrant?: (claim: IsolationClaim, nonce: string) => Promise<IsolationGrant>
) {
  if (!requestGrant) throw new Error("TEST_ISOLATION_REFUSED");
  const claim = isolationClaim(source);
  const nonce = randomUUID();
  const grant = await requestGrant(claim, nonce);
  if (!grant.approved || grant.nonce !== nonce || grant.runId !== claim.runId || grant.fingerprint !== claim.fingerprint) {
    throw new Error("TEST_ISOLATION_REFUSED");
  }
  // Catch any environment change while awaiting the live runner's response.
  if (JSON.stringify(isolationClaim(source)) !== JSON.stringify(claim)) throw new Error("TEST_ISOLATION_REFUSED");
  return claim;
}
