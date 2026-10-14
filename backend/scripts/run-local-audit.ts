import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { localAuditDatabaseSuites, localAuditPureSuites } from "./local-audit-suites.js";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportDirectory = path.resolve(backendDirectory, "../artifacts/local-audit");
const mode = process.argv[2] || "all";
const auditStartedAt = new Date().toISOString();
if (!["all", "database", "pure"].includes(mode)) throw new Error("Expected all, database, or pure");
await mkdir(reportDirectory, { recursive: true });
const results: Array<{ suite: string; isolation: string; exitCode: number | null; passed: boolean; durationMs: number }> = [];

for (const group of [
  { isolation: "no-database", suites: mode === "database" ? [] : localAuditPureSuites },
  { isolation: "fresh-disposable-loopback-database", suites: mode === "pure" ? [] : localAuditDatabaseSuites }
]) {
  for (const suite of group.suites) {
    const started = Date.now();
    console.log(`[AUDIT] START ${suite} (${group.isolation})`);
    const args = group.isolation === "no-database"
      ? ["--import", "tsx", `scripts/${suite}.ts`]
      : ["--import", "tsx", "scripts/with-chat-test-database.ts", suite];
    const child = spawn(process.execPath, args, { cwd: backendDirectory, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => {
      const value = String(chunk); output += value; process.stdout.write(value);
    });
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject); child.once("close", resolve);
    });
    const passed = exitCode === 0;
    results.push({ suite, isolation: group.isolation, exitCode, passed, durationMs: Date.now() - started });
    await writeFile(path.join(reportDirectory, `backend-${suite}.log`), output);
    await writeFile(path.join(reportDirectory, `backend-results-${mode}.json`), JSON.stringify({
      startedAt: auditStartedAt, results,
      passed: results.filter((result) => result.passed).length,
      failed: results.filter((result) => !result.passed).length
    }, null, 2) + "\n");
    console.log(`[AUDIT] ${passed ? "PASS" : "FAIL"} ${suite}`);
  }
}
const failed = results.filter((result) => !result.passed).length;
console.log(`[AUDIT] ${results.length - failed}/${results.length} suites passed; ${failed} failed.`);
if (failed) process.exitCode = 1;
