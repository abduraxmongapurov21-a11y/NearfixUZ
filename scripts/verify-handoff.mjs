import { readFileSync, lstatSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifestBytes = readFileSync(path.join(root, "SOURCE_MANIFEST.json"));
const metadata = JSON.parse(readFileSync(path.join(root, "SOURCE_HANDOFF.json"), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (sha256(manifestBytes) !== metadata.sourceManifestSha256) throw new Error("Source manifest checksum mismatch.");
const manifest = JSON.parse(manifestBytes);
for (const entry of manifest.files) {
  const file = path.resolve(root, entry.file);
  if (!file.startsWith(root) || path.isAbsolute(entry.file) || entry.file.split(/[\\/]/).includes("..")) throw new Error("Unsafe manifest path.");
  if (!lstatSync(file).isFile() || sha256(readFileSync(file)) !== entry.sha256) throw new Error(`Missing or changed handoff file: ${entry.file}`);
}
console.log(`PASS: ${manifest.files.length} files match the ${metadata.version} handoff; source commit ${metadata.sourceCommit}.`);
