import assert from "node:assert/strict";
import fs from "node:fs";
import { formatWorkerPhone, normalizeWorkerPhone } from "../src/utils/workerPhone.mjs";

assert.equal(normalizeWorkerPhone("+998 90 123 45 67"), "+998901234567");
assert.equal(normalizeWorkerPhone("998 (90) 123-45-67"), "+998901234567");
assert.equal(normalizeWorkerPhone("90 123 45 67"), "+998901234567");
assert.equal(formatWorkerPhone("+998901234567"), "+998 90 123 45 67");

for (const invalidPhone of [undefined, null, "", " ", "+99890123", "+9989012345678", "+1 202 555 0100", "call +998901234567"]) {
  assert.equal(normalizeWorkerPhone(invalidPhone), null);
  assert.equal(formatWorkerPhone(invalidPhone), null);
}

const profileSource = fs.readFileSync(new URL("../src/screens/marketplace/WorkerProfileScreen.js", import.meta.url), "utf8");
assert.match(profileSource, /Linking\.openURL\(`tel:\$\{phone\}`\)/);
assert.match(profileSource, /normalizeWorkerPhone\(worker\.phone\)/);
assert.doesNotMatch(profileSource, /Linking\.canOpenURL/);

const appConfig = fs.readFileSync(new URL("../app.base.json", import.meta.url), "utf8");
const androidManifest = fs.readFileSync(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
assert.doesNotMatch(appConfig, /CALL_PHONE/);
assert.doesNotMatch(androidManifest, /android\.permission\.CALL_PHONE/);

console.log("Worker phone normalization, tel dialer path, and no-CALL_PHONE checks passed.");
