import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const tokenFile = join(root, "app", "ui-v1.css");
const ignoredDirectories = new Set([".git", ".next", "node_modules", "coverage", "playwright-report", "test-results"]);
const guardedProperties = /^(font-size|padding(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|margin(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap)$/i;
const literalLength = /(?:^|[\s:(,])(-?\d*\.?\d+)(px|rem|em)(?=$|[\s;),/])/i;
const literalHex = /#[0-9a-f]{3,8}\b/i;

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

const violations = [];
for (const file of await cssFiles(root)) {
  if (file === tokenFile) continue;
  const source = await readFile(file, "utf8");
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    const declaration = line.match(/^\s*([\w-]+)\s*:\s*([^;]+);?/);
    if (declaration && guardedProperties.test(declaration[1]) && literalLength.test(declaration[2])) {
      violations.push(`${relative(root, file).split(sep).join("/")}:${index + 1} ${declaration[1]} must use a Sapienworx typography/spacing token`);
    }
    if (literalHex.test(line)) {
      violations.push(`${relative(root, file).split(sep).join("/")}:${index + 1} literal hex colors are only allowed in app/ui-v1.css`);
    }
  });
}

if (violations.length) {
  console.error("Design-token guardrail failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("Design-token guardrail passed.");
