import "./test-isolation-preload.js";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/http/app.js";
import { supportContactHtml } from "../src/modules/legal/legal-contact.js";
import { env } from "../src/config/env.js";

assert.equal(supportContactHtml(undefined), "");
assert.throws(() => supportContactHtml('invalid"<script>'), /valid email/);
assert.match(supportContactHtml("support+request@example.test"), /mailto:support%2Brequest%40example.test/);
assert.match(supportContactHtml("o'brien@example.test", 'request " & < >'), /o&#39;brien@example.test/);
assert.doesNotMatch(supportContactHtml("support@example.test", '"><script>'), /<script>/);

const app = createApp();
const server = app.listen(0, "127.0.0.1");

try {
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  for (const route of ["/legal/privacy", "/legal/terms", "/legal/account-deletion"]) {
    const response = await fetch(`${baseUrl}${route}`);
    const html = await response.text();

    assert.equal(response.status, 200, `${route} must return HTTP 200`);
    assert.match(response.headers.get("content-type") || "", /^text\/html;\s*charset=utf-8/i);
    assert.match(html, /<!doctype html>/i);
    assert.match(html, /<html lang="uz">/i);
    assert.match(html, /Oxirgi yangilanish:/);
    assert.doesNotMatch(html, /to‘lov provayder|payment provider|bank karta/i);
    if (env.PUBLIC_SUPPORT_EMAIL) {
      assert.ok(html.includes(`mailto:${encodeURIComponent(env.PUBLIC_SUPPORT_EMAIL)}`), `${route} must offer public email contact`);
      if (route === "/legal/account-deletion") {
        assert.match(html, /id="request-deletion"/);
        assert.match(html, /Ilovani qayta o‘rnatish shart emas/);
        assert.match(html, /Faol buyurtmalarni avval yakunlang yoki bekor qiling/);
      }
    }
  }

  console.log("Public legal routes passed");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
