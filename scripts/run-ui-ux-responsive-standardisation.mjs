import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourcePath = join(root, "scripts", "apply-ui-ux-responsive-standardisation.mjs");
const temporaryPath = join(root, "scripts", ".ui-standardisation-runtime.mjs");
const source = await readFile(sourcePath, "utf8");
const marker = "\nconst checkPath = join(root, \"scripts\", \"check-design-tokens.mjs\");";
const markerIndex = source.indexOf(marker);

if (markerIndex < 0) throw new Error("Could not locate checker-generation boundary in UI standardisation migration.");

let executable = source.slice(0, markerIndex);
executable = executable.replace(
  "consolidated = `${consolidated.trim()}${standardOverrides}`;",
  "if (!consolidated.includes(\"SapienWorx enterprise design-system contract\")) consolidated = `${consolidated.trim()}${standardOverrides}`;",
);
executable += "\nconsole.log(`UI/UX standardisation applied. Consolidated ${importedNames.length} active global layers, removed ${globalCssNames.length} legacy global CSS files, and migrated ${cssFiles.length - 1} scoped stylesheets.`);\n";

await writeFile(temporaryPath, executable, "utf8");
try {
  await import(`${pathToFileURL(temporaryPath).href}?run=${Date.now()}`);
} finally {
  await rm(temporaryPath, { force: true });
}
