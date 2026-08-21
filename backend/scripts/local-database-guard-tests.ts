import assert from "node:assert/strict";
import { assertLocalDatabaseTarget } from "../src/db/local-database.guard.js";

const localDatabaseUrl = "postgresql://nearfix:nearfix@127.0.0.1:5432/nearfix?schema=public";
const localDirectUrl = "postgresql://nearfix:nearfix@127.0.0.1:5432/nearfix?schema=public";
const remoteDatabaseUrl = "postgresql://nearfix:secret@production.example.com:5432/nearfix";

assert.deepEqual(
  assertLocalDatabaseTarget({
    NODE_ENV: "development",
    DATABASE_URL: localDatabaseUrl,
    DIRECT_URL: localDirectUrl
  }),
  { host: "127.0.0.1", port: 5432, database: "nearfix", nodeEnv: "development" }
);

assert.throws(
  () => assertLocalDatabaseTarget({ NODE_ENV: "production", DATABASE_URL: localDatabaseUrl }),
  /NODE_ENV=development or NODE_ENV=test/
);
assert.throws(
  () => assertLocalDatabaseTarget({ NODE_ENV: "development", DATABASE_URL: remoteDatabaseUrl, DIRECT_URL: localDirectUrl }),
  /non-local DATABASE_URL host/
);
assert.throws(
  () => assertLocalDatabaseTarget({ NODE_ENV: "development", DATABASE_URL: localDatabaseUrl, DIRECT_URL: remoteDatabaseUrl }),
  /non-local DIRECT_URL host/
);
assert.throws(
  () =>
    assertLocalDatabaseTarget({
      NODE_ENV: "development",
      DATABASE_URL: localDatabaseUrl,
      DIRECT_URL: "postgresql://nearfix:nearfix@127.0.0.1:5432/other"
    }),
  /must target the same local database/
);

console.log("Local database fixture guard and mixed-target bypass tests passed.");
