import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const tokenFile = join(root, "app", "ui-v1.css");
const ignoredDirectories = new Set([".git", ".next", "node_modules", "coverage", "playwright-report", "test-results"]);
const spacingProperties = /^(padding(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|margin(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap)$/i;

const fontPxTokens = [
  [11, "--font-size-xs"],
  [13, "--font-size-sm"],
  [15, "--font-size-base"],
  [17, "--font-size-md"],
  [20, "--font-size-lg"],
  [24, "--font-size-xl"],
  [30, "--font-size-2xl"],
  [38, "--font-size-3xl"],
  [Infinity, "--font-size-4xl"],
];

const spacingToken = (value) => {
  const absolute = Math.abs(value);
  if (absolute <= 4) return "--space-1";
  if (absolute <= 9) return "--space-2";
  if (absolute <= 13) return "--space-3";
  if (absolute <= 19) return "--space-4";
  if (absolute <= 27) return "--space-5";
  if (absolute <= 39) return "--space-6";
  if (absolute <= 55) return "--space-7";
  if (absolute <= 79) return "--space-8";
  return "--space-9";
};

const fontTokenForPx = (value) => fontPxTokens.find(([upper]) => value <= upper)?.[1] ?? "--font-size-4xl";
const fontTokenForRem = (value) => fontTokenForPx(value * 16);

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

function migrateFontSize(value) {
  return value
    .replace(/(-?\d*\.?\d+)px\b/gi, (_, raw) => `var(${fontTokenForPx(Math.abs(Number(raw)))})`)
    .replace(/(-?\d*\.?\d+)rem\b/gi, (_, raw) => `var(${fontTokenForRem(Math.abs(Number(raw)))})`)
    .replace(/(-?\d*\.?\d+)em\b/gi, (_, raw) => `var(${fontTokenForRem(Math.abs(Number(raw)))})`);
}

function migrateSpacing(value) {
  return value.replace(/(-?\d*\.?\d+)px\b/gi, (_, raw) => {
    const numeric = Number(raw);
    if (numeric === 0) return "0";
    const token = `var(${spacingToken(numeric)})`;
    return numeric < 0 ? `calc(${token} * -1)` : token;
  });
}

let changedFiles = 0;
for (const file of await cssFiles(root)) {
  if (file === tokenFile) continue;
  const original = await readFile(file, "utf8");
  const migrated = original.replace(/(^|[;{}]\s*)([\w-]+)\s*:\s*([^;{}]+)(;?)/gm, (whole, prefix, property, value, suffix) => {
    const normalized = property.toLowerCase();
    if (normalized === "font-size") return `${prefix}${property}: ${migrateFontSize(value.trim())}${suffix}`;
    if (spacingProperties.test(normalized)) return `${prefix}${property}: ${migrateSpacing(value.trim())}${suffix}`;
    return whole;
  });
  if (migrated !== original) {
    await writeFile(file, migrated, "utf8");
    changedFiles += 1;
    console.log(`Migrated ${file.slice(root.length + 1)}`);
  }
}

console.log(`Design-token migration complete: ${changedFiles} CSS file(s) updated.`);
