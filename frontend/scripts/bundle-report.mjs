import { gzipSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = join(process.cwd(), ".next", "static", "chunks");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

const files = await walk(root);
const rows = [];
let totalRaw = 0;
let totalGzip = 0;

for (const file of files) {
  const body = await readFile(file);
  const raw = body.byteLength;
  const gzip = gzipSync(body, { level: 6 }).byteLength;
  totalRaw += raw;
  totalGzip += gzip;
  rows.push({ file: relative(process.cwd(), file), raw, gzip });
}

rows.sort((a, b) => b.gzip - a.gzip);
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

console.log("Largest client JavaScript chunks (gzip):");
for (const row of rows.slice(0, 20)) {
  console.log(`${kb(row.gzip).padStart(11)} gzip | ${kb(row.raw).padStart(11)} raw | ${row.file}`);
}
console.log(`Total static JS: ${kb(totalGzip)} gzip | ${kb(totalRaw)} raw across ${rows.length} chunks`);
