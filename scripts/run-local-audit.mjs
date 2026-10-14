import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const artifactDirectory = path.join(root, "artifacts", "local-audit");
const backendTsx = path.join(root, "backend", "node_modules", "tsx", "dist", "cli.mjs");
const tsxScripts = new Set([
  "test-worker-profile-isolation.mjs",
  "test-client-order-actions.mjs",
  "test-catalog-session-refresh.mjs",
  "test-catalog-gps-store.mjs",
  "test-authenticated-client-races.mjs",
  "test-provider-client-mode.mjs"
]);
const scripts = readdirSync(path.join(root, "scripts"), { withFileTypes: true })
  .filter((entry) => entry.isFile() && /^test-.*\.(?:mjs|cjs)$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();
const checks = [
  ...scripts.map((name) => ({ script: `scripts/${name}`, runner: tsxScripts.has(name) ? "backend tsx" : "node", suite: "test" })),
  { script: "scripts/verify-i18n.mjs", runner: "node", suite: "verification" }
];
// This runner invokes only the root synthetic/state tests. Backend database
// integration suites are run separately by their isolated database harness.
const environment = { ...process.env, EXPO_NO_DOTENV: "1" };
for (const name of ["DATABASE_URL", "DIRECT_URL", "SHADOW_DATABASE_URL", "TEST_DATABASE_URL"]) delete environment[name];
const results = [];
const startedAt = new Date().toISOString();
const start = Date.now();
mkdirSync(artifactDirectory, { recursive: true });

async function execute(check) {
  const scriptPath = path.join(root, check.script);
  const args = check.runner === "backend tsx" ? [backendTsx, scriptPath] : [scriptPath];
  const begin = Date.now();
  if (check.runner === "backend tsx" && !existsSync(backendTsx)) {
    return { ...check, status: "FAIL", exitCode: null, durationMs: 0, stdout: "", stderr: "The installed backend tsx runner is unavailable." };
  }
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let failure;
    const child = spawn(process.execPath, args, {
      cwd: root, env: environment, windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"], timeout: 120_000
    });
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { failure = error.message; });
    child.on("close", (exitCode, signal) => resolve({
      ...check, status: !failure && exitCode === 0 ? "PASS" : "FAIL",
      exitCode, signal, durationMs: Date.now() - begin,
      stdout, stderr: failure ? `${stderr}\n${failure}`.trim() : stderr
    }));
  });
}

for (const check of checks) {
  const result = await execute(check);
  results.push(result);
  console.log(`${result.status} ${check.script} (${result.durationMs} ms)`);
  if (result.status === "FAIL") console.error((result.stderr || result.stdout).trim());
}
const tests = results.filter((result) => result.suite === "test");
const failed = results.filter((result) => result.status === "FAIL");
const report = {
  startedAt, completedAt: new Date().toISOString(), durationMs: Date.now() - start,
  status: failed.length ? "FAIL" : "PASS",
  testScripts: { total: tests.length, passed: tests.filter((result) => result.status === "PASS").length, failed: tests.filter((result) => result.status === "FAIL").length },
  additionalChecks: { total: results.length - tests.length, failed: failed.filter((result) => result.suite !== "test").length },
  limits: "Root mobile/admin synthetic, state, source-contract and config tests only; no raw backend database integration suite, production requests, native device or full browser runtime verification.",
  results
};
writeFileSync(path.join(artifactDirectory, "mobile-and-admin-tests.json"), JSON.stringify(report, null, 2) + "\n");
const summary = `${report.status}: ${report.testScripts.passed}/${report.testScripts.total} root test scripts passed; ${report.additionalChecks.total - report.additionalChecks.failed}/${report.additionalChecks.total} additional checks passed.\n`;
const details = results.map((result) => [
  `${result.status} ${result.script} [${result.runner}] ${result.durationMs} ms`,
  result.stdout.trim(), result.stderr.trim()
].filter(Boolean).join("\n")).join("\n\n");
writeFileSync(path.join(artifactDirectory, "mobile-and-admin-tests.txt"), summary + "\n" + details + "\n");
console.log(summary.trim());
process.exitCode = failed.length ? 1 : 0;
