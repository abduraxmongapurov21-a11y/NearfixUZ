import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const exportDirectory = path.resolve("dist-test-store");
const expectedApiUrl = "https://nearfix-production-c0db.up.railway.app";
const expectedLegalUrls = [
  `${expectedApiUrl}/legal/privacy`,
  `${expectedApiUrl}/legal/terms`
];
const requiredAssets = [
  "assets/images/icon.png",
  "assets/images/adaptive-icon.png",
  "assets/images/adaptive-monochrome.png",
  "assets/images/notification-icon.png",
  "assets/images/splash-icon.png"
];
const forbiddenApiPatterns = [
  /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?/gi
];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    })
  );
  return nestedFiles.flat();
}

for (const asset of requiredAssets) {
  await access(path.join(projectRoot, asset));
}

for (const asset of requiredAssets) {
  const png = await readFile(path.join(projectRoot, asset));
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (asset.endsWith("notification-icon.png")) {
    if (width !== 96 || height !== 96) throw new Error(`${asset} must be 96x96.`);
  } else if (width !== 1024 || height !== 1024) {
    throw new Error(`${asset} must be 1024x1024.`);
  }
  if (asset === "assets/images/icon.png" && [4, 6].includes(png[25])) {
    throw new Error(`${asset} must not contain an alpha channel for App Store submission.`);
  }
}

const appConfig = JSON.parse(await readFile(path.join(projectRoot, "app.base.json"), "utf8")).expo;
if (!appConfig.ios?.bundleIdentifier || !appConfig.android?.package) {
  throw new Error("Both ios.bundleIdentifier and android.package are required.");
}
if (appConfig.ios.bundleIdentifier !== appConfig.android.package) {
  throw new Error("iOS bundle identifier and Android package must stay aligned for NearFIX.");
}

const files = await listFiles(exportDirectory);
const searchableFiles = files.filter((file) => /\.(?:hbc|js|json|map|txt)$/i.test(file));
const requiredValues = [expectedApiUrl, ...expectedLegalUrls];
const foundValues = new Map(requiredValues.map((value) => [value, false]));
const forbiddenMatches = [];

for (const file of searchableFiles) {
  const contents = await readFile(file, "utf8");
  for (const value of requiredValues) {
    if (contents.includes(value)) foundValues.set(value, true);
  }
  for (const pattern of forbiddenApiPatterns) {
    pattern.lastIndex = 0;
    for (const match of contents.match(pattern) || []) {
      forbiddenMatches.push(`${path.relative(exportDirectory, file)}: ${match}`);
    }
  }
}

const missingValues = [...foundValues].filter(([, found]) => !found).map(([value]) => value);
if (missingValues.length) {
  throw new Error(`Required production URLs are missing from the export:\n${missingValues.join("\n")}`);
}
if (forbiddenMatches.length) {
  throw new Error(`Private or local URL found in the store export:\n${forbiddenMatches.join("\n")}`);
}

console.log(`Mobile release export verified for ${appConfig.ios.bundleIdentifier}.`);
