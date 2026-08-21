const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);

export type LocalDatabaseIdentity = {
  host: string;
  port: number;
  database: string;
  nodeEnv: "development" | "test";
};

function parseLocalDatabaseUrl(rawDatabaseUrl: string, variableName: "DATABASE_URL" | "DIRECT_URL") {
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new Error(`Local fixture ${variableName} is invalid`);
  }

  if (databaseUrl.protocol !== "postgresql:" && databaseUrl.protocol !== "postgres:") {
    throw new Error(`Local fixture ${variableName} requires PostgreSQL`);
  }

  if (!LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname)) {
    throw new Error(`Refusing to prepare a local fixture against a non-local ${variableName} host`);
  }

  const database = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
  if (!database) {
    throw new Error(`Local fixture ${variableName} database name is required`);
  }

  const port = Number(databaseUrl.port || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Local fixture ${variableName} port is invalid`);
  }

  return { host: databaseUrl.hostname, port, database };
}

export function assertLocalDatabaseTarget(source: NodeJS.ProcessEnv = process.env): LocalDatabaseIdentity {
  const nodeEnv = source.NODE_ENV;
  if (nodeEnv !== "development" && nodeEnv !== "test") {
    throw new Error("Local fixture requires NODE_ENV=development or NODE_ENV=test");
  }

  if (!source.DATABASE_URL) {
    throw new Error("Local fixture requires DATABASE_URL");
  }

  const databaseIdentity = parseLocalDatabaseUrl(source.DATABASE_URL, "DATABASE_URL");
  if (source.DIRECT_URL) {
    const directIdentity = parseLocalDatabaseUrl(source.DIRECT_URL, "DIRECT_URL");
    if (
      directIdentity.host !== databaseIdentity.host ||
      directIdentity.port !== databaseIdentity.port ||
      directIdentity.database !== databaseIdentity.database
    ) {
      throw new Error("Local fixture DATABASE_URL and DIRECT_URL must target the same local database");
    }
  }

  return {
    ...databaseIdentity,
    nodeEnv
  };
}
