import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default;
const VISIBLE_PROPS = new Set([
  "accessibilityHint",
  "accessibilityLabel",
  "emptyText",
  "emptyTitle",
  "helper",
  "initialReason",
  "label",
  "message",
  "placeholder",
  "subtitle",
  "text",
  "title"
]);
const COPY_RE = /[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ]/;
const NON_COPY = new Set([
  "NearFIX",
  "Near",
  "FIX",
  "Inter_400Regular",
  "Inter_500Medium",
  "Inter_600SemiBold",
  "Inter_700Bold",
  "Inter_800ExtraBold"
]);

export function normalizeCopy(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else if (/\.[cm]?jsx?$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

function isCandidate(value, explicit = false) {
  const copy = normalizeCopy(value);
  if (!copy || !COPY_RE.test(copy) || NON_COPY.has(copy)) return false;
  if (/^(?:https?:|mailto:|tel:|\.\.?\/)/i.test(copy)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(copy)) return false;
  if (!explicit && /^[a-z][a-zA-Z0-9_.:/-]*$/.test(copy)) return false;
  return true;
}

function templateValue(node) {
  return node.quasis
    .map((quasi, index) => `${quasi.value.cooked || ""}${index < node.expressions.length ? `{{value${index}}}` : ""}`)
    .join("");
}

function isInsideStyleSheet(pathRef) {
  return Boolean(
    pathRef.findParent(
      (candidate) =>
        candidate.isCallExpression() &&
        candidate.node.callee?.type === "MemberExpression" &&
        candidate.node.callee.object?.name === "StyleSheet" &&
        candidate.node.callee.property?.name === "create"
    )
  );
}

export function extractCopy({ root = process.cwd() } = {}) {
  const result = new Map();
  const sourceRoots = [path.join(root, "src")];
  const appFile = path.join(root, "App.js");
  const files = sourceRoots.flatMap((directory) => walk(directory));
  if (fs.existsSync(appFile)) files.push(appFile);

  function add(value, file, line, explicit = false) {
    const copy = normalizeCopy(value);
    if (!isCandidate(copy, explicit)) return;
    if (!result.has(copy)) result.set(copy, []);
    result.get(copy).push(`${path.relative(root, file)}:${line}`);
  }

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
    traverse(ast, {
      JSXText(pathRef) {
        add(pathRef.node.value, file, pathRef.node.loc.start.line, true);
      },
      StringLiteral(pathRef) {
        const parent = pathRef.parent;
        if (
          parent.type === "ImportDeclaration" ||
          parent.type === "ExportNamedDeclaration" ||
          parent.type === "ExportAllDeclaration"
        )
          return;
        if (parent.type === "ObjectProperty" && parent.key === pathRef.node && !parent.computed) return;
        if (isInsideStyleSheet(pathRef)) return;

        const jsxAttribute = pathRef.findParent((candidate) => candidate.isJSXAttribute());
        const jsxExpression = pathRef.findParent((candidate) => candidate.isJSXExpressionContainer());
        const alertCall = pathRef.findParent(
          (candidate) =>
            candidate.isCallExpression() &&
            candidate.node.callee?.type === "MemberExpression" &&
            candidate.node.callee.object?.name === "Alert" &&
            candidate.node.callee.property?.name === "alert"
        );
        const visibleProperty = pathRef.findParent(
          (candidate) =>
            candidate.isObjectProperty() &&
            candidate.node.key?.type === "Identifier" &&
            VISIBLE_PROPS.has(candidate.node.key.name)
        );
        const propName = jsxAttribute?.node.name?.name;
        const explicit = Boolean(jsxExpression || alertCall || visibleProperty || VISIBLE_PROPS.has(propName));
        add(pathRef.node.value, file, pathRef.node.loc.start.line, explicit);
      },
      TemplateLiteral(pathRef) {
        if (isInsideStyleSheet(pathRef)) return;
        const jsxExpression = pathRef.findParent((candidate) => candidate.isJSXExpressionContainer());
        const alertCall = pathRef.findParent(
          (candidate) =>
            candidate.isCallExpression() &&
            candidate.node.callee?.type === "MemberExpression" &&
            candidate.node.callee.object?.name === "Alert"
        );
        if (jsxExpression || alertCall) add(templateValue(pathRef.node), file, pathRef.node.loc.start.line, true);
      }
    });
  }

  return result;
}
