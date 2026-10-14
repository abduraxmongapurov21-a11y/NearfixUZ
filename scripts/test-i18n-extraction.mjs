import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { extractCopy } from "./i18n-copy-tools.mjs";

const root = await mkdtemp(path.join(tmpdir(), "nearfix-copy-extraction-"));
try {
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src", "fixture.js"), [
    'const code = "ACTIVE_ORDERS_EXIST";',
    'const Screen = () => <View key={`${id}:${placement}:${position}`} testID="test-node">',
    '  <Text>{`Buyurtma ${id}`}</Text>',
    '  <Text>{new Date().toLocaleDateString("uz-UZ", { month: "short", day: "numeric" })}</Text>',
    '  <Button onPress={() => Alert.alert("Buyurtma holati tasdiqlanmadi")} title="Qayta urinish" />',
    '</View>;'
  ].join("\n"));
  const copy = extractCopy({ root });
  assert.equal(copy.has("{{value0}}:{{value1}}:{{value2}}"), false, "React keys must not be translated");
  for (const technical of ["ACTIVE_ORDERS_EXIST", "uz-UZ", "short", "numeric"]) assert.equal(copy.has(technical), false, technical);
  for (const visible of ["Buyurtma {{value0}}", "Buyurtma holati tasdiqlanmadi", "Qayta urinish"]) assert.equal(copy.has(visible), true, visible);
  console.log("i18n extraction passed: visible text retained; React keys, locale options and machine codes excluded.");
} finally {
  const resolved = path.resolve(root);
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith("nearfix-copy-extraction-")) throw new Error("Unexpected fixture path");
  await rm(resolved, { recursive: true });
}
