import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

const root = process.cwd();
const tokenFile = join(root, "app", "sapienworx.css");
const ignoredDirectories = new Set([".git", ".next", "node_modules", "coverage", "playwright-report", "test-results"]);
const guardedPropertyName = "font-size|padding(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|margin(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap";
const guardedDeclaration = new RegExp(`\\b(${guardedPropertyName})\\s*:\\s*([^;{}]+)`, "gi");
const literalLength = /(-?\d*\.?\d+)(px|rem|em)\b/i;
const literalHex = /#[0-9a-f]{3,8}\b/gi;
const customPropertyDefinition = /(--[a-z0-9-_]+)\s*:/gi;
const customPropertyReference = /var\(\s*(--[a-z0-9-_]+)/gi;
const inlineStyleBlock = /style\s*=\s*\{\{([\s\S]*?)\}\}/g;
const inlineSpacingProperty = /\b(margin(?:Top|Right|Bottom|Left|Inline|Block|InlineStart|InlineEnd|BlockStart|BlockEnd)?|padding(?:Top|Right|Bottom|Left|Inline|Block|InlineStart|InlineEnd|BlockStart|BlockEnd)?|gap|rowGap|columnGap)\s*:\s*(?:["'`])?(-?\d*\.?\d+)(px|rem|em)?(?:["'`])?/g;
const widthBoundary = /(?:min|max)-width\s*:\s*(\d+)px/gi;
const runtimeProvidedVariables = new Set(["--font-inter", "--font-space-grotesk", "--font-ibm-plex-mono"]);
const generatedImageFile = /(?:^|\/)(?:opengraph-image|twitter-image)\.tsx$/;
const allowedBoundaries = new Set([639, 640, 1023, 1024, 1439, 1440]);
const allowedTokenHex = new Set([
  "#15171c", "#3a3d44", "#6b6e75", "#f6f5f1", "#ffffff", "#e3e0d8",
  "#f2a23b", "#c97f1e", "#4a2f06", "#3b3fa6", "#2a2d7c", "#eceafc",
  "#4a8b5c", "#c14a3a",
]);
const requiredTypeScale = new Map([
  ["--font-size-xs", "12px"],
  ["--font-size-sm", "14px"],
  ["--font-size-base", "14px"],
  ["--font-size-md", "16px"],
  ["--font-size-lg", "20px"],
  ["--font-size-xl", "24px"],
  ["--font-size-2xl", "32px"],
]);

async function filesMatching(directory, extensions) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesMatching(path, extensions));
    else if (entry.isFile() && extensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function displayPath(file) {
  return relative(root, file).split(sep).join("/");
}

const cssFiles = await filesMatching(root, new Set([".css"]));
const sourceFiles = [
  ...await filesMatching(join(root, "app"), new Set([".ts", ".tsx"])),
  ...await filesMatching(join(root, "components"), new Set([".ts", ".tsx"])),
];
const violations = [];
const definedVariables = new Set(runtimeProvidedVariables);

for (const file of cssFiles) {
  const source = await readFile(file, "utf8");
  customPropertyDefinition.lastIndex = 0;
  for (let match = customPropertyDefinition.exec(source); match; match = customPropertyDefinition.exec(source)) {
    definedVariables.add(match[1]);
  }
}

for (const file of cssFiles) {
  const source = await readFile(file, "utf8");
  const path = displayPath(file);

  if (/!important\b/.test(source)) violations.push(`${path} contains !important`);
  if (/var\(\s*--space-\d/.test(source)) violations.push(`${path} references the retired spacing vocabulary`);

  guardedDeclaration.lastIndex = 0;
  for (let match = guardedDeclaration.exec(source); match; match = guardedDeclaration.exec(source)) {
    if (literalLength.test(match[2])) violations.push(`${path}:${lineNumber(source, match.index)} ${match[1]} must use a shared design token`);
    literalLength.lastIndex = 0;
  }

  literalHex.lastIndex = 0;
  for (let match = literalHex.exec(source); match; match = literalHex.exec(source)) {
    const lineStart = source.lastIndexOf("\n", match.index) + 1;
    const nextBreak = source.indexOf("\n", match.index);
    const line = source.slice(lineStart, nextBreak === -1 ? source.length : nextBreak);
    const allowedDefinition = file === tokenFile && /--[a-z0-9-_]+\s*:/.test(line) && allowedTokenHex.has(match[0].toLowerCase());
    if (!allowedDefinition) violations.push(`${path}:${lineNumber(source, match.index)} hardcoded hex must be a semantic token definition`);
  }

  customPropertyReference.lastIndex = 0;
  for (let match = customPropertyReference.exec(source); match; match = customPropertyReference.exec(source)) {
    if (!definedVariables.has(match[1])) violations.push(`${path}:${lineNumber(source, match.index)} references undefined CSS variable ${match[1]}`);
  }

  widthBoundary.lastIndex = 0;
  for (let match = widthBoundary.exec(source); match; match = widthBoundary.exec(source)) {
    if (!allowedBoundaries.has(Number(match[1]))) violations.push(`${path}:${lineNumber(source, match.index)} uses non-canonical responsive boundary ${match[1]}px`);
  }
}

for (const file of sourceFiles) {
  const path = displayPath(file);
  if (generatedImageFile.test(path)) continue;
  const source = await readFile(file, "utf8");
  inlineStyleBlock.lastIndex = 0;
  for (let styleMatch = inlineStyleBlock.exec(source); styleMatch; styleMatch = inlineStyleBlock.exec(source)) {
    const block = styleMatch[1];
    inlineSpacingProperty.lastIndex = 0;
    for (let spacingMatch = inlineSpacingProperty.exec(block); spacingMatch; spacingMatch = inlineSpacingProperty.exec(block)) {
      if (Number(spacingMatch[2]) !== 0) {
        violations.push(`${path}:${lineNumber(source, styleMatch.index + spacingMatch.index)} inline ${spacingMatch[1]} must move to token-backed CSS`);
      }
    }
  }
}

const globalCss = (await readdir(join(root, "app"))).filter((name) => name.endsWith(".css") && !name.endsWith(".module.css"));
if (globalCss.length !== 1 || globalCss[0] !== "sapienworx.css") {
  violations.push(`app must contain exactly one global stylesheet (sapienworx.css); found: ${globalCss.join(", ")}`);
}

const tokenSource = await readFile(tokenFile, "utf8");
for (const [token, value] of requiredTypeScale) {
  const escaped = token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const expected = value.replace(".", "\\.");
  if (!new RegExp(`${escaped}\\s*:\\s*${expected}\\s*;`).test(tokenSource)) violations.push(`${token} must resolve to ${value}`);
}

if (violations.length) {
  console.error("Design-system guardrail failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Design-system guardrail passed across ${cssFiles.length} CSS files and ${sourceFiles.length} TS/TSX files.`);
