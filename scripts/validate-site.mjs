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

// 6. Regresión automática del banco de 21,195+ preguntas y temas críticos de telemetría
try {
  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const qBase = JSON.parse(await readFile(path.join(root, "data", "questions_bank.json"), "utf8")).questions || [];
  const qV3 = JSON.parse(await readFile(path.join(root, "data", "faq_v3.json"), "utf8")).questions || [];
  const qV4 = JSON.parse(await readFile(path.join(root, "data", "faq_v4.json"), "utf8")).questions || [];
  const mergedMap = new Map();
  for (const item of [...qBase, ...qV3, ...qV4]) {
    const k = norm(item.q);
    if (k && !mergedMap.has(k)) mergedMap.set(k, item);
  }
  const merged = Array.from(mergedMap.values());
  if (merged.length < 21195) {
    fail(`Conteo total de preguntas combinadas bajó a ${merged.length} (< 21195)`);
  }

  const catalog = JSON.parse(await readFile(path.join(root, "data", "catalog.json"), "utf8"));
  const docsById = new Set((catalog.documents || []).map((d) => d.id));
  const kb = JSON.parse(await readFile(path.join(root, "data", "knowledge_base.json"), "utf8"));
  const topicsById = new Set((kb.topics || []).map((t) => t.id));

  const requiredChecks = [
    { label: "Insignia Final Águila Real (P9.2)", rx: /aguila real.*requisitos|requisitos.*aguila real|p9 2/i, minLen: 260 },
    { label: "Método Scout (8 elementos)", rx: /metodo scout/i, minLen: 260 },
    { label: "Scouts Go Solar (P8.7)", rx: /scouts go solar/i, minLen: 200 },
    { label: "Mensajeros de la Paz (P8.3)", rx: /mensajeros de la paz/i, minLen: 200 },
    { label: "Plastic Tide Turners (P8.4)", rx: /tide turners|plastico/i, minLen: 200 },
    { label: "Champions for Nature (P8.1/P8.2)", rx: /champions for nature/i, minLen: 200 },
    { label: "Horquilla Baden Powell (P9.4)", rx: /baden powell.*requisitos|horquilla.*baden powell/i, minLen: 220 },
    { label: "Proceso 12 pasos CDC (26.011)", rx: /12 pasos|cdc|comite de desarrollo/i, minLen: 200 },
    { label: "Acreditación PJOS (26.007)", rx: /26 007|acredita/i, minLen: 200 },
    { label: "Insignia Everest (P9.3)", rx: /insignia.*everest|everest.*requisitos/i, minLen: 220 },
    { label: "Mapache de Cozumel / Aventuras", rx: /mapache.*cozumel|aventuras en la naturaleza/i, minLen: 200 },
  ];

  for (const chk of requiredChecks) {
    const hit = merged.find((it) => {
      const text = norm(it.q);
      const ans = String(it.ans || "");
      return chk.rx.test(text) && ans.length >= chk.minLen;
    });
    if (!hit) {
      fail(`Regresión de búsqueda: falta respuesta completa para "${chk.label}"`);
    } else {
      if (hit.doc_id && !docsById.has(hit.doc_id)) {
        fail(`Fuente inexistente (${hit.doc_id}) en pregunta de "${chk.label}"`);
      }
      if (hit.topic_id && !topicsById.has(hit.topic_id)) {
        fail(`topic_id inexistente (${hit.topic_id}) en pregunta de "${chk.label}"`);
      }
    }
  }
    console.log(`OK regresión de búsqueda y banco combinado (${merged.length} preguntas verificadas)`);

  // 7. Validar cobertura textual (>=400 chars en data/text) y bases visuales de las 24 páginas de plantillas
  let shortCount = 0;
  for (const d of catalog.documents || []) {
    const tPath = path.join(root, "data", "text", `${d.sha12}.txt`);
    if (!existsSync(tPath)) {
      fail(`Falta archivo de texto data/text/${d.sha12}.txt (${d.id})`);
      continue;
    }
    const txt = (await readFile(tPath, "utf8")).trim();
    if (txt.length < 400) {
      fail(`Documento ${d.id} (${d.sha12}.txt) tiene solo ${txt.length} chars (< 400)`);
      shortCount++;
    }
  }
  const requiredFormWebps = [
    "salud_p1.webp", "salud_p2.webp", "jl304_p1.webp", "jl304_p2.webp",
    "fes_p1.webp", "smart_p1.webp", "smart_p2.webp", "programa_p1.webp",
    "acta_p1.webp", "acta_p2.webp", "p1_p1.webp", "p2_p1.webp",
    "p8_p1.webp", "p8_mop_p1.webp", "p8_solar_p1.webp",
    "p9_p1.webp", "p9_p2.webp", "p9_alfa_p1.webp", "p9_alfa_p2.webp",
    "p9_everest_p1.webp", "p9_everest_p2.webp", "p9_bp_p1.webp", "p9_bp_p2.webp",
    "vales_p1.webp",
  ];
  for (const wf of requiredFormWebps) {
    if (!existsSync(path.join(root, "img", "forms", wf))) {
      fail(`Falta base de plantilla img/forms/${wf}`);
    }
  }
  console.log(`OK textos de catálogo (short=${shortCount}) y ${requiredFormWebps.length} bases de plantillas`);
} catch (err) {
  fail(`Error en validación de regresión del buscador: ${err.message}`);
}

if (errors > 0) {
  process.exit(1);
}
console.log("VALIDACION DE SITIO COMPLETADA SIN ERRORES.");
