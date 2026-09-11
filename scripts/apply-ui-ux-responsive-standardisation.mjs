import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

const root = process.cwd();
const appDir = join(root, "app");
const targetCss = join(appDir, "sapienworx.css");
const ignoredDirs = new Set([".git", ".next", "node_modules", "coverage", "playwright-report", "test-results"]);

const spacingReferenceMap = new Map([
  ["--space-1", "--spacing-xs"],
  ["--space-2", "--spacing-xs"],
  ["--space-3", "--spacing-sm"],
  ["--space-4", "--spacing-sm"],
  ["--space-5", "--spacing-md"],
  ["--space-6", "--spacing-lg"],
  ["--space-7", "--spacing-xl"],
  ["--space-8", "--spacing-2xl"],
  ["--space-9", "--spacing-3xl"],
]);

const allowedTypeTokens = {
  "--font-size-xs": "12px",
  "--font-size-sm": "14px",
  "--font-size-base": "14px",
  "--font-size-md": "16px",
  "--font-size-lg": "20px",
  "--font-size-xl": "24px",
  "--font-size-2xl": "32px",
};

function canonicalizeMediaQueries(source) {
  return source.replace(/@media\s*([^\{]+)\{/gi, (whole, query) => {
    if (!/(?:min|max)-width\s*:/i.test(query)) return whole;
    const next = query.replace(/(max-width\s*:\s*)(\d+)px/gi, (_, prefix, raw) => {
      const value = Number(raw);
      const canonical = value <= 639 ? 639 : value <= 1023 ? 1023 : 1439;
      return `${prefix}${canonical}px`;
    }).replace(/(min-width\s*:\s*)(\d+)px/gi, (_, prefix, raw) => {
      const value = Number(raw);
      const canonical = value <= 640 ? 640 : value <= 1024 ? 1024 : 1440;
      return `${prefix}${canonical}px`;
    });
    return `@media ${next.trim()} {`;
  });
}

function transformCss(source) {
  let css = source.replace(/\s*!important\b/g, "");

  for (const [from, to] of spacingReferenceMap) {
    css = css.replace(new RegExp(`var\\(\\s*${from.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*\\)`, "g"), `var(${to})`);
  }

  css = css
    .replace(/var\(\s*--font-size-(?:3xl|4xl)\s*\)/g, "var(--font-size-2xl)")
    .replace(/text-transform\s*:\s*uppercase\s*;/gi, "text-transform: none;")
    .replace(/font-weight\s*:\s*650\s*;/g, "font-weight: 600;")
    .replace(/font-weight\s*:\s*700\s*;/g, "font-weight: 600;")
    .replace(/font-weight\s*:\s*(?:800|900)\s*;/g, "font-weight: 700;")
    .replace(/align-items\s*:\s*(?:flex-start|start|flex-end|end)\s*;/gi, "align-items: center;");

  css = canonicalizeMediaQueries(css);
  css = css.replace(/clamp\(var\(--font-size-2xl\),\s*[^,]+,\s*var\(--font-size-2xl\)\)/g, "var(--font-size-2xl)");
  return css;
}

function migrateCanonicalDefinitions(source) {
  let css = source;
  for (const name of spacingReferenceMap.keys()) {
    css = css.replace(new RegExp(`^\\s*${name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*:[^;]+;\\s*$`, "gm"), "");
  }
  css = css.replace(/^\s*--font-size-(?:3xl|4xl)\s*:[^;]+;\s*$/gm, "");
  for (const [token, value] of Object.entries(allowedTypeTokens)) {
    const expression = new RegExp(`${token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*:[^;]+;`);
    if (expression.test(css)) css = css.replace(expression, `${token}: ${value};`);
  }
  css = css.replace(/--focus\s*:\s*var\(--indigo\)\s*;/g, "--focus: var(--portal-accent);");
  return css;
}

function canonicalTokenBlock() {
  return `\n  /* Strict 8px baseline. */\n  --spacing-xs: 8px;\n  --spacing-sm: 16px;\n  --spacing-md: 24px;\n  --spacing-lg: 32px;\n  --spacing-xl: 48px;\n  --spacing-2xl: 64px;\n  --spacing-3xl: 96px;\n  --page-padding-mobile: var(--spacing-sm);\n  --page-padding-tablet: var(--spacing-md);\n  --page-padding-desktop: var(--spacing-lg);\n  --card-padding: var(--spacing-md);\n`;
}

function ensureCanonicalSpacingDefinitions(source) {
  if (source.includes("--spacing-xs:")) return source;
  const anchor = /(--line-height-relaxed\s*:[^;]+;)/;
  if (!anchor.test(source)) throw new Error("Could not locate typography token anchor while consolidating CSS.");
  return source.replace(anchor, `$1${canonicalTokenBlock()}`);
}

async function walk(directory, extensions) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || ignoredDirs.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path, extensions));
    else if (entry.isFile() && extensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const currentEntry = await readFile(targetCss, "utf8");
const importedNames = [...currentEntry.matchAll(/^@import\s+["']\.\/(.+?\.css)["'];?\s*$/gm)].map((match) => match[1]);
const globalEntries = await readdir(appDir, { withFileTypes: true });
const globalCssNames = globalEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".css") && !entry.name.endsWith(".module.css") && entry.name !== "sapienworx.css")
  .map((entry) => entry.name);

const parts = [];
for (const name of importedNames) {
  const path = join(appDir, name);
  try {
    parts.push(`\n/* ===== Consolidated from ${name} ===== */\n${await readFile(path, "utf8")}\n`);
  } catch {
    // Idempotent reruns after source layers have already been deleted.
  }
}
const entryWithoutImports = currentEntry.replace(/^@import\s+["']\.\/.+?\.css["'];?\s*$/gm, "").trim();
parts.push(`\n/* ===== SapienWorx route-specific global layer ===== */\n${entryWithoutImports}\n`);

let consolidated = transformCss(parts.join("\n"));
consolidated = migrateCanonicalDefinitions(consolidated);
consolidated = ensureCanonicalSpacingDefinitions(consolidated);

const standardOverrides = `\n\n/* ===== SapienWorx enterprise design-system contract ===== */\n:root {\n  --control-height: 44px;\n  --content-max: 1280px;\n}\n\nhtml, body {\n  max-width: 100%;\n  overflow-x: clip;\n}\n\nbody, button, input, select, textarea {\n  font-family: var(--font-ui);\n}\n\nh1, h2, h3, h4, h5, h6, .page-heading h1, .section-title h2 {\n  font-family: var(--font-display);\n  letter-spacing: -0.01em;\n  font-weight: 600;\n}\n\n.page-heading h1 {\n  font-size: var(--font-size-2xl);\n  font-weight: 700;\n}\n\n.section-title h2 {\n  font-size: var(--font-size-xl);\n}\n\np, label, input, select, textarea, button, .button, .nav-item {\n  font-weight: 400;\n}\n\nbutton, .button, .nav-item, label, .account-trigger {\n  font-weight: 600;\n}\n\ntime, .mono, .metric-value, .stat-card > strong, [data-functional-data=\"true\"], [data-candidate-id], [data-salary] {\n  font-family: var(--font-data);\n  font-weight: 500;\n}\n\nbutton, .button, input, select, textarea, summary, [role=\"button\"], [role=\"tab\"] {\n  min-height: var(--control-height);\n}\n\n:is(.panel, .widget, .stat-card, .feature-card, .candidate-job-card, .candidate-application-card, .admin-team-card, .workflow-list, .master-wide-list, .master-investigation-request) {\n  padding: var(--card-padding);\n}\n\n:is(.topbar, .topbar-actions, .heading-actions, .section-title, .page-heading, .workspace-name, .candidate-desktop-nav, .hero-actions, .filter-actions, .candidate-job-result-controls) {\n  align-items: center;\n}\n\n.workspace-main {\n  min-width: 0;\n  padding-inline: var(--page-padding-desktop);\n}\n\n.workspace-main > * {\n  width: min(100%, var(--content-max));\n  margin-inline: auto;\n}\n\n.workspace-drawer-trigger, .workspace-drawer-backdrop {\n  display: none;\n}\n\n.workspace-shell-admin :is(.badge-blue, .badge-purple, .badge-amber, .stat-icon-blue, .stat-icon-purple, .stat-icon-amber) {\n  background: color-mix(in srgb, var(--ink) 7%, var(--cloud));\n  color: var(--ink);\n}\n\n.workspace-shell-admin :is(.button-primary, .nav-item-active, :focus-visible) {\n  --portal-accent: var(--ink);\n  --portal-accent-deep: var(--ink);\n}\n\n@media (max-width: 1023px) {\n  .workspace-shell-recruiter,\n  .workspace-shell-admin,\n  .workspace-shell-recruiter.recruiter-sidebar-collapsed {\n    grid-template-columns: minmax(0, 1fr);\n    grid-template-areas: \"topbar\" \"main\";\n  }\n\n  .workspace-shell-recruiter .workspace-main,\n  .workspace-shell-admin .workspace-main {\n    grid-area: main;\n    grid-column: 1;\n  }\n\n  .workspace-drawer-trigger {\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    width: var(--control-height);\n    min-width: var(--control-height);\n    border: 1px solid var(--line);\n    border-radius: var(--radius-sm);\n    background: var(--cloud);\n    color: var(--ink);\n  }\n\n  .workspace-shell-recruiter .sidebar,\n  .workspace-shell-admin .sidebar {\n    display: block;\n    position: fixed;\n    z-index: var(--z-navigation);\n    inset: 0 auto 0 0;\n    width: min(320px, 88vw);\n    height: 100dvh;\n    transform: translateX(-100%);\n    transition: transform 180ms ease;\n    overflow-y: auto;\n  }\n\n  .workspace-shell-recruiter .sidebar.workspace-drawer-open,\n  .workspace-shell-admin .sidebar.workspace-drawer-open {\n    transform: translateX(0);\n  }\n\n  .workspace-shell-recruiter .sidebar .workspace-name,\n  .workspace-shell-admin .sidebar .workspace-name {\n    display: flex;\n  }\n\n  .workspace-shell-recruiter .sidebar .workspace-name > div,\n  .workspace-shell-admin .sidebar .workspace-name > div,\n  .workspace-shell-recruiter .sidebar .nav-label,\n  .workspace-shell-admin .sidebar .nav-label {\n    display: block;\n  }\n\n  .workspace-shell-recruiter .sidebar .nav-item,\n  .workspace-shell-admin .sidebar .nav-item {\n    justify-content: flex-start;\n    padding-inline: var(--spacing-sm);\n  }\n\n  .workspace-drawer-backdrop {\n    display: block;\n    position: fixed;\n    z-index: calc(var(--z-navigation) - 1);\n    inset: 0;\n    width: 100%;\n    min-height: 100dvh;\n    border: 0;\n    background: color-mix(in srgb, var(--ink) 38%, transparent);\n  }\n\n  .sidebar-collapse {\n    display: none;\n  }\n}\n\n/* Mobile: <=639px */\n@media (max-width: 639px) {\n  .workspace-main {\n    padding-inline: var(--page-padding-mobile);\n  }\n\n  :is(.workflow-grid.workflow-two, .candidate-onboarding-grid, .admin-team-form, .permission-picker, .feature-grid, .ops-grid) {\n    grid-template-columns: minmax(0, 1fr);\n  }\n\n  .page-heading {\n    display: grid;\n    grid-template-columns: minmax(0, 1fr);\n    gap: var(--spacing-sm);\n  }\n\n  .public-filter-trigger {\n    display: flex;\n    position: sticky;\n    bottom: var(--spacing-xs);\n    z-index: var(--z-sticky);\n  }\n\n  .public-filter-sheet {\n    inset: auto 0 0;\n    width: 100%;\n    max-height: 85dvh;\n    border-radius: var(--radius-lg) var(--radius-lg) 0 0;\n  }\n\n  .admin-table-scroll {\n    max-width: 100%;\n    overflow-x: auto;\n    overscroll-behavior-inline: contain;\n  }\n}\n\n/* Tablet: 640-1023px */\n@media (min-width: 640px) and (max-width: 1023px) {\n  .workspace-main {\n    padding-inline: var(--page-padding-tablet);\n  }\n\n  :is(.feature-grid, .ops-grid, .permission-picker) {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n}\n\n/* Desktop: 1024-1439px */\n@media (min-width: 1024px) and (max-width: 1439px) {\n  .workspace-main {\n    padding-inline: var(--page-padding-desktop);\n  }\n}\n\n/* Wide: >=1440px */\n@media (min-width: 1440px) {\n  .workspace-main {\n    padding-inline: var(--page-padding-desktop);\n  }\n\n  .workspace-main > *, .public-shell > *, .landing > * {\n    max-width: var(--content-max);\n    margin-inline: auto;\n  }\n}\n`;

consolidated = `${consolidated.trim()}${standardOverrides}`;
await writeFile(targetCss, consolidated, "utf8");

for (const name of globalCssNames) {
  await unlink(join(appDir, name));
}

const cssFiles = await walk(root, new Set([".css"]));
for (const file of cssFiles) {
  if (file === targetCss) continue;
  const original = await readFile(file, "utf8");
  const migrated = transformCss(original);
  if (migrated !== original) await writeFile(file, migrated, "utf8");
}

const uiPath = join(root, "components", "ui.tsx");
let ui = await readFile(uiPath, "utf8");
if (!ui.includes("navigationDrawerOpen")) {
  ui = ui.replace(
    "  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);",
    "  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);\n  const [navigationDrawerOpen, setNavigationDrawerOpen] = useState(false);",
  );
  ui = ui.replace(
    "  const signOut = async () => {",
    `  useEffect(() => {\n    if (!navigationDrawerOpen) return;\n    const closeDrawer = (event) => { if (event.key === \"Escape\") setNavigationDrawerOpen(false); };\n    document.addEventListener(\"keydown\", closeDrawer);\n    document.body.style.overflow = \"hidden\";\n    return () => { document.removeEventListener(\"keydown\", closeDrawer); document.body.style.overflow = \"\"; };\n  }, [navigationDrawerOpen]);\n\n  const signOut = async () => {`,
  );
  ui = ui.replace(
    "      <Logo />\n      {workspace === \"candidate\"",
    "      {workspace !== \"candidate\" && <button className=\"workspace-drawer-trigger\" type=\"button\" aria-label={navigationDrawerOpen ? \"Close navigation\" : \"Open navigation\"} aria-expanded={navigationDrawerOpen} aria-controls=\"workspace-sidebar\" onClick={() => setNavigationDrawerOpen((open) => !open)}><Icon name={navigationDrawerOpen ? \"close\" : \"menu\"}/></button>}\n      <Logo />\n      {workspace === \"candidate\"",
  );
  ui = ui.replace(
    "\n    {workspace !== \"candidate\" && <aside className=\"sidebar\">",
    "\n    {workspace !== \"candidate\" && navigationDrawerOpen && <button className=\"workspace-drawer-backdrop\" type=\"button\" aria-label=\"Close navigation\" onClick={() => setNavigationDrawerOpen(false)}/>}\n    {workspace !== \"candidate\" && <aside id=\"workspace-sidebar\" className={`sidebar${navigationDrawerOpen ? \" workspace-drawer-open\" : \"\"}`}>",
  );
}
await writeFile(uiPath, ui, "utf8");

const agentsPath = join(root, "AGENTS.md");
let agents = await readFile(agentsPath, "utf8");
agents = agents.replace(/work on `complete-v1`/gi, "work on a dedicated feature branch from the current `main`");
if (!agents.includes("UI/UX responsive standardisation contract")) {
  agents += `\n\n## UI/UX responsive standardisation contract\n\n- \`app/sapienworx.css\` is the only global stylesheet. Do not add another global CSS file. Component-scoped \`*.module.css\` files are allowed and must consume the shared tokens.\n- Never use \`!important\`.\n- Margins, padding and gaps use the strict 8px baseline tokens: 8, 16, 24, 32, 48, 64 or 96px.\n- Page padding is 16px on mobile and 32px on desktop; card internal padding is 24px.\n- Explicit UI font sizes use only 12, 14, 16, 20, 24 or 32px through shared type tokens.\n- Space Grotesk is reserved for headings/display, Inter for UI/body copy, and IBM Plex Mono for functional data.\n- Candidate surfaces use amber, recruiter surfaces indigo, and admin surfaces neutral ink tones.\n- Width-responsive CSS may use only the canonical boundaries 639, 640, 1023, 1024, 1439 and 1440px.\n- Mobile is single-column and must not create page-level horizontal overflow. Tablet recruiter/admin navigation is an off-canvas drawer.\n- Wide layouts cap content at 1280px and centre the shell.\n`;
}
await writeFile(agentsPath, agents, "utf8");

const checkPath = join(root, "scripts", "check-design-tokens.mjs");
const checker = `import { readdir, readFile } from \"node:fs/promises\";\nimport { extname, join, relative, sep } from \"node:path\";\n\nconst root = process.cwd();\nconst tokenFile = join(root, \"app\", \"sapienworx.css\");\nconst ignoredDirectories = new Set([\".git\", \".next\", \"node_modules\", \"coverage\", \"playwright-report\", \"test-results\"]);\nconst guardedPropertyName = \"font-size|padding(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|margin(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap\";\nconst guardedDeclaration = new RegExp(\\`\\\\b(\\${guardedPropertyName})\\\\s*:\\\\s*([^;{}]+)\\`, \"gi\");\nconst literalLength = /(-?\\d*\\.?\\d+)(px|rem|em)\\b/i;\nconst literalHex = /#[0-9a-f]{3,8}\\b/gi;\nconst customPropertyDefinition = /(--[a-z0-9-_]+)\\s*:/gi;\nconst customPropertyReference = /var\\(\\s*(--[a-z0-9-_]+)/gi;\nconst inlineStyleBlock = /style\\s*=\\s*\\{\\{([\\s\\S]*?)\\}\\}/g;\nconst inlineSpacingProperty = /\\b(margin(?:Top|Right|Bottom|Left|Inline|Block|InlineStart|InlineEnd|BlockStart|BlockEnd)?|padding(?:Top|Right|Bottom|Left|Inline|Block|InlineStart|InlineEnd|BlockStart|BlockEnd)?|gap|rowGap|columnGap)\\s*:\\s*(?:[\"'\\x60])?(-?\\d*\\.?\\d+)(px|rem|em)?(?:[\"'\\x60])?/g;\nconst widthBoundary = /(?:min|max)-width\\s*:\\s*(\\d+)px/gi;\nconst runtimeProvidedVariables = new Set([\"--font-inter\", \"--font-space-grotesk\", \"--font-ibm-plex-mono\"]);\nconst allowedBoundaries = new Set([639, 640, 1023, 1024, 1439, 1440]);\nconst allowedTokenHex = new Set([\"#15171c\", \"#3a3d44\", \"#6b6e75\", \"#f6f5f1\", \"#ffffff\", \"#e3e0d8\", \"#f2a23b\", \"#c97f1e\", \"#4a2f06\", \"#3b3fa6\", \"#2a2d7c\", \"#eceafc\", \"#4a8b5c\", \"#c14a3a\"]);\n\nasync function filesMatching(directory, extensions) {\n  const entries = await readdir(directory, { withFileTypes: true });\n  const files = [];\n  for (const entry of entries) {\n    if (entry.name.startsWith(\".\") || ignoredDirectories.has(entry.name)) continue;\n    const path = join(directory, entry.name);\n    if (entry.isDirectory()) files.push(...await filesMatching(path, extensions));\n    else if (entry.isFile() && extensions.has(extname(entry.name))) files.push(path);\n  }\n  return files;\n}\n\nfunction lineNumber(source, index) { return source.slice(0, index).split(\"\\n\").length; }\nfunction displayPath(file) { return relative(root, file).split(sep).join(\"/\"); }\nfunction isGeneratedSocialImage(path) { return /(?:opengraph|twitter)-image\\.tsx$/.test(path); }\n\nconst cssFiles = await filesMatching(root, new Set([\".css\"]));\nconst sourceFiles = [...await filesMatching(join(root, \"app\"), new Set([\".ts\", \".tsx\"])), ...await filesMatching(join(root, \"components\"), new Set([\".ts\", \".tsx\"]))];\nconst violations = [];\nconst definedVariables = new Set(runtimeProvidedVariables);\n\nfor (const file of cssFiles) {\n  const source = await readFile(file, \"utf8\");\n  customPropertyDefinition.lastIndex = 0;\n  for (let match = customPropertyDefinition.exec(source); match; match = customPropertyDefinition.exec(source)) definedVariables.add(match[1]);\n}\n\nfor (const file of cssFiles) {\n  const source = await readFile(file, \"utf8\");\n  const path = displayPath(file);\n  if (/!important\\b/.test(source)) violations.push(\\`\\${path} contains !important\\`);\n  if (/var\\(\\s*--space-\\d/.test(source)) violations.push(\\`\\${path} references the retired non-8px spacing vocabulary\\`);\n\n  guardedDeclaration.lastIndex = 0;\n  for (let match = guardedDeclaration.exec(source); match; match = guardedDeclaration.exec(source)) {\n    if (literalLength.test(match[2])) violations.push(\\`\\${path}:\\${lineNumber(source, match.index)} \\${match[1]} must use a shared design token\\`);\n    literalLength.lastIndex = 0;\n  }\n\n  literalHex.lastIndex = 0;\n  for (let match = literalHex.exec(source); match; match = literalHex.exec(source)) {\n    const line = source.slice(source.lastIndexOf(\"\\n\", match.index) + 1, source.indexOf(\"\\n\", match.index) === -1 ? source.length : source.indexOf(\"\\n\", match.index));\n    const allowedDefinition = file === tokenFile && /--[a-z0-9-_]+\\s*:/.test(line) && allowedTokenHex.has(match[0].toLowerCase());\n    if (!allowedDefinition) violations.push(\\`\\${path}:\\${lineNumber(source, match.index)} hardcoded hex must be a semantic token definition\\`);\n  }\n\n  customPropertyReference.lastIndex = 0;\n  for (let match = customPropertyReference.exec(source); match; match = customPropertyReference.exec(source)) {\n    if (!definedVariables.has(match[1])) violations.push(\\`\\${path}:\\${lineNumber(source, match.index)} references undefined CSS variable \\${match[1]}\\`);\n  }\n\n  widthBoundary.lastIndex = 0;\n  for (let match = widthBoundary.exec(source); match; match = widthBoundary.exec(source)) {\n    if (!allowedBoundaries.has(Number(match[1]))) violations.push(\\`\\${path}:\\${lineNumber(source, match.index)} uses non-canonical responsive boundary \\${match[1]}px\\`);\n  }\n}\n\nfor (const file of sourceFiles) {\n  const source = await readFile(file, \"utf8\");\n  const path = displayPath(file);\n  if (isGeneratedSocialImage(path)) continue;\n  inlineStyleBlock.lastIndex = 0;\n  for (let styleMatch = inlineStyleBlock.exec(source); styleMatch; styleMatch = inlineStyleBlock.exec(source)) {\n    const block = styleMatch[1];\n    inlineSpacingProperty.lastIndex = 0;\n    for (let spacingMatch = inlineSpacingProperty.exec(block); spacingMatch; spacingMatch = inlineSpacingProperty.exec(block)) {\n      if (Number(spacingMatch[2]) !== 0) violations.push(\\`\\${path}:\\${lineNumber(source, styleMatch.index + spacingMatch.index)} inline \\${spacingMatch[1]} must move to token-backed CSS\\`);\n    }\n  }\n}\n\nconst globalCss = (await readdir(join(root, \"app\"))).filter((name) => name.endsWith(\".css\") && !name.endsWith(\".module.css\"));\nif (globalCss.length !== 1 || globalCss[0] !== \"sapienworx.css\") violations.push(\\`app must contain exactly one global stylesheet (sapienworx.css); found: \\${globalCss.join(\", \")}\\`);\n\nconst tokenSource = await readFile(tokenFile, \"utf8\");\nfor (const [token, value] of Object.entries(\\${JSON.stringify(allowedTypeTokens)})) {\n  if (!new RegExp(\\`\\${token.replace(/[-/\\^$*+?.()|[\\]{}]/g, \"\\\\$&\")}\\\\s*:\\\\s*\\${value.replace(\".\", \"\\\\.\")}\\\\s*;\\`).test(tokenSource)) violations.push(\\`\\${token} must resolve to \\${value}\\`);\n}\n\nif (violations.length) { console.error(\"Design-system guardrail failed:\\n\" + violations.map((item) => \\- \\${item}\\`).join(\"\\n\")); process.exit(1); }\nconsole.log(\\`Design-system guardrail passed across \\${cssFiles.length} CSS files and \\${sourceFiles.length} TS/TSX files.\\`);\n`;
await writeFile(checkPath, checker, "utf8");

console.log(`UI/UX standardisation applied. Consolidated ${importedNames.length} active global layers, removed ${globalCssNames.length} legacy global CSS files, and migrated ${cssFiles.length - 1} scoped stylesheets.`);
