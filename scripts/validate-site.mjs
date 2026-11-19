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

// 5. Validar sincronía de versión entre version.json, sw.js y src/app.js
try {
  const verJson = JSON.parse(await readFile(path.join(root, "version.json"), "utf8"));
  const appSrc = await readFile(path.join(root, "src", "app.js"), "utf8");
  const webVerMatch = appSrc.match(/const APP_WEB_VERSION\s*=\s*"([^"]+)"/);
  const cacheMatch = appSrc.match(/const WEB_OFFLINE_CACHE\s*=\s*"([^"]+)"/);
  const swCacheMatch = swText.match(/const CACHE_NAME\s*=\s*"([^"]+)"/);
  if (!webVerMatch || webVerMatch[1] !== verJson.version) {
    fail(`APP_WEB_VERSION en src/app.js (${webVerMatch?.[1]}) no coincide con version.json (${verJson.version})`);
  }
  if (!cacheMatch || cacheMatch[1] !== verJson.cache) {
    fail(`WEB_OFFLINE_CACHE en src/app.js (${cacheMatch?.[1]}) no coincide con version.json (${verJson.cache})`);
  }
  if (!swCacheMatch || swCacheMatch[1] !== verJson.cache) {
    fail(`CACHE_NAME en sw.js (${swCacheMatch?.[1]}) no coincide con version.json (${verJson.cache})`);
  }
  console.log(`OK sincronía version.json <-> src/app.js <-> sw.js (${verJson.version} / ${verJson.cache})`);
} catch (err) {
  fail(`Error validando sincronía de versiones: ${err.message}`);
}

if (errors > 0) {
  process.exit(1);
}
console.log("VALIDACION DE SITIO COMPLETADA SIN ERRORES.");
