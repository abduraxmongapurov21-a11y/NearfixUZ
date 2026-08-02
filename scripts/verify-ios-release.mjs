import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const exportDirectory = path.resolve("dist-test-ios");
const expectedApiUrl = "https://nearfix-production-c0db.up.railway.app";
const forbiddenApiPatterns = [
  /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+):4000/gi
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

const files = await listFiles(exportDirectory);
const searchableFiles = files.filter((file) => /\.(?:hbc|js|json|map|txt)$/i.test(file));
let productionUrlFound = false;
const forbiddenMatches = [];

for (const file of searchableFiles) {
  const contents = await readFile(file, "utf8");
  productionUrlFound ||= contents.includes(expectedApiUrl);

  for (const pattern of forbiddenApiPatterns) {
    pattern.lastIndex = 0;
    const matches = contents.match(pattern) || [];
    for (const match of matches) {
      forbiddenMatches.push(`${path.relative(exportDirectory, file)}: ${match}`);
    }
  }
}

if (!productionUrlFound) {
  throw new Error(`Production API URL was not found in the iOS export: ${expectedApiUrl}`);
}

if (forbiddenMatches.length > 0) {
  throw new Error(`Forbidden API URL found in the iOS export:\n${forbiddenMatches.join("\n")}`);
}

console.log(`iOS release export verified: ${expectedApiUrl}`);
