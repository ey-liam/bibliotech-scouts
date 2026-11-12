import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
let errors = 0;

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  errors++;
}

// 1. Validar JSONs principales en data/
const requiredJson = [
  "catalog.json",
  "knowledge_base.json",
  "questions_bank.json",
  "faq_v3.json",
  "faq_v4.json",
  "spreadsheets.json",
  "chunks.json",
];

for (const file of requiredJson) {
  const full = path.join(root, "data", file);
  if (!existsSync(full)) {
    fail(`Falta data/${file}`);
    continue;
  }
  try {
    const parsed = JSON.parse(await readFile(full, "utf8"));
    if (file === "catalog.json" && (!Array.isArray(parsed.documents) || parsed.documents.length < 500)) {
      fail(`data/catalog.json tiene documentos insuficientes (${parsed.documents?.length || 0})`);
    }
    console.log(`OK JSON: data/${file}`);
  } catch (err) {
    fail(`JSON inválido en data/${file}: ${err.message}`);
  }
}

// 2. Validar manifest.webmanifest y sus iconos
try {
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.webmanifest"), "utf8"));
  for (const icon of manifest.icons || []) {
    if (!existsSync(path.join(root, icon.src))) {
      fail(`Icono faltante en manifest.webmanifest: ${icon.src}`);
    }
  }
  console.log(`OK manifest.webmanifest (${(manifest.icons || []).length} iconos)`);
} catch (err) {
  fail(`manifest.webmanifest inválido: ${err.message}`);
}

// 3. Validar rutas locales en sw.js (STATIC_ASSETS)
const swText = await readFile(path.join(root, "sw.js"), "utf8");
const swListMatch = swText.match(/const STATIC_ASSETS\s*=\s*\[([\s\S]*?)\];/);
if (!swListMatch) {
  fail("No se encontró STATIC_ASSETS en sw.js");
} else {
  const entries = Array.from(swListMatch[1].matchAll(/"([^"]+)"/g)).map((m) => m[1]);
  for (const item of entries) {
    if (item === "./") continue;
    if (!existsSync(path.join(root, item))) {
      fail(`Archivo faltante en STATIC_ASSETS de sw.js: ${item}`);
    }
  }
  console.log(`OK sw.js STATIC_ASSETS (${entries.length} entradas verificadas)`);
}

// 4. Validar referencias locales en index.html (src y href locales)
const htmlText = await readFile(path.join(root, "index.html"), "utf8");
const refRegex = /\b(?:src|href)="([^"]+)"/g;
const checked = new Set();
let refMatch;
while ((refMatch = refRegex.exec(htmlText)) !== null) {
  const raw = refMatch[1].trim();
  if (
    !raw ||
    raw.startsWith("#") ||
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("mailto:") ||
    raw.startsWith("data:")
  ) {
    continue;
  }
  const cleanRel = raw.split("?")[0].split("#")[0];
  if (!cleanRel || checked.has(cleanRel)) continue;
  checked.add(cleanRel);
  if (!existsSync(path.join(root, cleanRel))) {
    fail(`Recurso local faltante referido en index.html: ${cleanRel}`);
  }
}
console.log(`OK index.html (${checked.size} rutas locales verificadas)`);

if (errors > 0) {
  process.exit(1);
}
console.log("VALIDACION DE SITIO COMPLETADA SIN ERRORES.");
