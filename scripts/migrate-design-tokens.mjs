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

const legacyColorMap = new Map([
  ["#fff", "var(--cloud)"],
  ["#ffffff", "var(--cloud)"],
  ["#144a75", "var(--indigo)"],
  ["#cbd8df", "var(--line)"],
  ["#dce4e8", "var(--line)"],
  ["#314b5f", "var(--ink-soft)"],
  ["#213c50", "var(--ink-soft)"],
  ["#526779", "var(--muted)"],
  ["#657a8b", "var(--muted)"],
  ["#eaf3f6", "var(--indigo-soft)"],
  ["#f0f5f7", "var(--paper)"],
  ["#f4fbfb", "var(--indigo-soft)"],
  ["#f5fbfb", "var(--indigo-soft)"],
  ["#c7e0e2", "var(--line)"],
  ["#cfe3e4", "var(--line)"],
  ["#315b60", "var(--indigo-deep)"],
  ["#e8c9c9", "var(--warn)"],
  ["#fff8f8", "color-mix(in srgb, var(--warn) 5%, var(--cloud))"],
]);

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

function migrateColors(source) {
  return source.replace(/#[0-9a-f]{3,8}\b/gi, (hex) => legacyColorMap.get(hex.toLowerCase()) ?? hex);
}

let changedFiles = 0;
for (const file of await cssFiles(root)) {
  if (file === tokenFile) continue;
  const original = await readFile(file, "utf8");
  const lines = migrateColors(original).split(/\r?\n/);
  const migrated = lines.map((line) => {
    const declaration = line.match(/^(\s*)([\w-]+)\s*:\s*([^;]+)(;.*)?$/);
    if (!declaration) return line;
    const [, indent, property, rawValue, suffix = ""] = declaration;
    const normalized = property.toLowerCase();
    let value = rawValue.trim();
    if (normalized === "font-size") value = migrateFontSize(value);
    else if (spacingProperties.test(normalized)) value = migrateSpacing(value);
    return `${indent}${property}: ${value}${suffix || ";"}`;
  }).join("\n");
  if (migrated !== original) {
    await writeFile(file, migrated, "utf8");
    changedFiles += 1;
    console.log(`Migrated ${file.slice(root.length + 1)}`);
  }
}

console.log(`Design-token migration complete: ${changedFiles} CSS file(s) updated.`);
