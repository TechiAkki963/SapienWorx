import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const tokenFile = join(root, "app", "ui-v1.css");
const ignoredDirectories = new Set([".git", ".next", "node_modules", "coverage", "playwright-report", "test-results"]);
const guardedPropertyName = "font-size|padding(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|margin(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap";
const guardedDeclaration = new RegExp(`\\b(${guardedPropertyName})\\s*:\\s*([^;{}]+)`, "gi");
const literalLength = /(-?\d*\.?\d+)(px|rem|em)\b/i;
const literalHex = /#[0-9a-f]{3,8}\b/gi;

async function cssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await cssFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".css")) files.push(path);
  }
  return files;
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

const violations = [];
for (const file of await cssFiles(root)) {
  if (file === tokenFile) continue;
  const source = await readFile(file, "utf8");
  const displayPath = relative(root, file).split(sep).join("/");

  guardedDeclaration.lastIndex = 0;
  for (let match = guardedDeclaration.exec(source); match; match = guardedDeclaration.exec(source)) {
    if (literalLength.test(match[2])) {
      violations.push(`${displayPath}:${lineNumber(source, match.index)} ${match[1]} must use a Sapienworx typography/spacing token`);
    }
    literalLength.lastIndex = 0;
  }

  literalHex.lastIndex = 0;
  for (let match = literalHex.exec(source); match; match = literalHex.exec(source)) {
    violations.push(`${displayPath}:${lineNumber(source, match.index)} literal hex colors are only allowed in app/ui-v1.css`);
  }
}

if (violations.length) {
  console.error("Design-token guardrail failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("Design-token guardrail passed.");
