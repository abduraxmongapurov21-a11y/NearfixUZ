import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const directory = mkdtempSync(path.join(tmpdir(), "nearfix-production-command-"));
const fakeNpm = path.join(directory, "fake-npm.cjs");
const eas = JSON.parse(readFileSync(path.join(root, "eas.json"), "utf8"));
writeFileSync(fakeNpm, `console.log("DISPATCH:" + JSON.stringify({
  arguments: process.argv.slice(2), environment: process.env.EXPO_PUBLIC_APP_ENV,
  nodeEnvironment: process.env.NODE_ENV, api: process.env.EXPO_PUBLIC_API_BASE_URL,
  mapKeyPresent: Boolean(process.env.YANDEX_MAPKIT_API_KEY)
})); process.exit(Number(process.env.FAKE_EAS_EXIT || 0));`);

try {
  const environment = { ...process.env, EXPO_NO_DOTENV: "1", npm_execpath: fakeNpm,
    YANDEX_MAPKIT_API_KEY: "synthetic-private-test-value", EXPO_PUBLIC_APP_ENV: "development",
    EXPO_PUBLIC_API_BASE_URL: "http://localhost:4000" };
  delete environment.GOOGLE_SERVICES_JSON;
  for (const action of ["build", "submit"]) {
    const result = spawnSync(process.execPath, ["scripts/run-eas-production.mjs", action, "--platform", "android"], {
      cwd: root, env: environment, encoding: "utf8", windowsHide: true
    });
    assert.equal(result.status, 0, result.stderr);
    const dispatch = JSON.parse(result.stdout.split("DISPATCH:")[1]);
    assert.deepEqual(dispatch.arguments, ["exec", "--yes", `--package=eas-cli@${eas.cli.version}`, "--", "eas", action, "--platform", "android", "--profile", "production"]);
    assert.equal(dispatch.environment, "production");
    assert.equal(dispatch.nodeEnvironment, "production");
    assert.equal(dispatch.api, eas.build.production.env.EXPO_PUBLIC_API_BASE_URL);
    assert.equal(dispatch.mapKeyPresent, true);
    assert.equal(result.stdout.includes(environment.YANDEX_MAPKIT_API_KEY), false);
    assert.equal(dispatch.arguments.includes("--auto-submit"), false);
  }
  const failure = spawnSync(process.execPath, ["scripts/run-eas-production.mjs", "build", "--platform", "ios"], {
    cwd: root, env: { ...environment, FAKE_EAS_EXIT: "23" }, encoding: "utf8", windowsHide: true
  });
  assert.equal(failure.status, 23, "Cloud command failures must propagate to the caller.");
  const unsupported = spawnSync(process.execPath, ["scripts/run-eas-production.mjs", "unexpected"], {
    cwd: root, env: environment, encoding: "utf8", windowsHide: true
  });
  assert.notEqual(unsupported.status, 0);
  assert.equal(unsupported.stdout.includes("DISPATCH:"), false);
} finally {
  unlinkSync(fakeNpm);
  rmdirSync(directory);
}
console.log("Production command dispatch: pinned EAS, profile/environment propagation, private value redaction, no automatic submission, exit status PASS (fake CLI; no cloud build).");
