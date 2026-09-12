import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

const root = process.cwd();
const tokenFile = join(root, "app", "ui-v1.css");
const ignoredDirectories = new Set([".git", ".next", "node_modules", "coverage", "playwright-report", "test-results"]);
const guardedPropertyName = "font-size|padding(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|margin(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap";
const guardedDeclaration = new RegExp(`\\b(${guardedPropertyName})\\s*:\\s*([^;{}]+)`, "gi");
const literalLength = /(-?\d*\.?\d+)(px|rem|em)\b/i;
const literalHex = /#[0-9a-f]{3,8}\b/gi;
const customPropertyDefinition = /(--[a-z0-9-_]+)\s*:/gi;
const customPropertyReference = /var\(\s*(--[a-z0-9-_]+)/gi;
const inlineStyleBlock = /style\s*=\s*\{\{([\s\S]*?)\}\}/g;
const inlineSpacingProperty = /\b(margin(?:Top|Right|Bottom|Left|Inline|Block|InlineStart|InlineEnd|BlockStart|BlockEnd)?|padding(?:Top|Right|Bottom|Left|Inline|Block|InlineStart|InlineEnd|BlockStart|BlockEnd)?|gap|rowGap|columnGap)\s*:\s*(?:["'`])?(-?\d*\.?\d+)(px|rem|em)?(?:["'`])?/g;
const runtimeProvidedVariables = new Set(["--font-inter", "--font-space-grotesk", "--font-ibm-plex-mono", "--step-count"]);
const generatedImageFile = /(?:^|\/)(?:opengraph-image|twitter-image)\.tsx$/;

// These files predate the v2.3 literal-spacing guardrail and are tracked as migration debt.
// The exception is deliberately path-scoped: undefined variables and literal colours remain
// release-blocking everywhere, and every new/unlisted stylesheet must use spacing/type tokens.
const legacyLiteralLengthBaseline = new Set([
  "app/admin-auth-v2.css",
  "app/candidate-applications-v2.css",
  "app/candidate-profile-v2.css",
  "app/complete-v1.css",
  "app/rebuild-v2-first.css",
  "app/ui-v1-final.css",
  "components/candidate-dashboard-v2.module.css",
  "components/candidate-inbox-v1.module.css",
  "components/candidate-interviews.module.css",
  "components/candidate-jobs-v2.module.css",
  "components/master-admin-access-v2.module.css",
  "components/public-landing-rebuild-v2.module.css",
  "components/recruiter-communications.module.css",
  "components/recruiter-dashboard-v2.module.css",
  "components/recruiter-interviews-v2.module.css",
  "components/recruiter-pipeline-v2.module.css",
  "components/search-results-v3.module.css",
  "components/ui-v1-primitives.module.css",
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

  if (file !== tokenFile) {
    if (!legacyLiteralLengthBaseline.has(path)) {
      guardedDeclaration.lastIndex = 0;
      for (let match = guardedDeclaration.exec(source); match; match = guardedDeclaration.exec(source)) {
        if (literalLength.test(match[2])) {
          violations.push(`${path}:${lineNumber(source, match.index)} ${match[1]} must use a Sapienworx typography/spacing token`);
        }
        literalLength.lastIndex = 0;
      }
    }

    literalHex.lastIndex = 0;
    for (let match = literalHex.exec(source); match; match = literalHex.exec(source)) {
      violations.push(`${path}:${lineNumber(source, match.index)} literal hex colors are only allowed in app/ui-v1.css`);
    }
  }

  customPropertyReference.lastIndex = 0;
  for (let match = customPropertyReference.exec(source); match; match = customPropertyReference.exec(source)) {
    if (!definedVariables.has(match[1])) {
      violations.push(`${path}:${lineNumber(source, match.index)} references undefined CSS variable ${match[1]}`);
    }
  }
}

for (const file of sourceFiles) {
  const path = displayPath(file);
  // Next ImageResponse social cards are not DOM surfaces and cannot consume the app stylesheet.
  if (generatedImageFile.test(path)) continue;
  const source = await readFile(file, "utf8");
  inlineStyleBlock.lastIndex = 0;
  for (let styleMatch = inlineStyleBlock.exec(source); styleMatch; styleMatch = inlineStyleBlock.exec(source)) {
    const block = styleMatch[1];
    inlineSpacingProperty.lastIndex = 0;
    for (let spacingMatch = inlineSpacingProperty.exec(block); spacingMatch; spacingMatch = inlineSpacingProperty.exec(block)) {
      const numeric = Number(spacingMatch[2]);
      if (numeric !== 0) {
        const absoluteIndex = styleMatch.index + spacingMatch.index;
        violations.push(`${path}:${lineNumber(source, absoluteIndex)} inline ${spacingMatch[1]} must move to token-backed CSS`);
      }
    }
  }
}

if (violations.length) {
  console.error("Design-token guardrail failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Design-token guardrail passed across ${cssFiles.length} CSS files and ${sourceFiles.length} TS/TSX files.`);
