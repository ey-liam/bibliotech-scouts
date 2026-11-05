// Genera data/faq_v3.json a partir de scripts/faq_v3_source.js.
//
// - Valida que cada documento exista en data/catalog.json (nombre exacto).
// - Valida que la página esté dentro del documento.
// - Evita preguntas duplicadas contra data/questions_bank.json y entre sí.
// - Escribe el JSON en UTF-8, sin tocar los JSON generados existentes.
//
// Uso: node scripts/build_faq_v3.js

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");

function normalizeStr(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeQuestionKey(value) {
  return normalizeStr(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function main() {
  const entries = require(path.join(__dirname, "faq_v3_source.js"));
  const catalog = readJson(path.join(DATA, "catalog.json"));
  const bank = readJson(path.join(DATA, "questions_bank.json"));

  if (!Array.isArray(entries) || !entries.length) {
    throw new Error("La fuente editorial no contiene entradas.");
  }

  const docsByFilename = new Map();
  for (const doc of catalog.documents || []) {
    docsByFilename.set(String(doc.filename || "").toLowerCase(), doc);
  }

  const existingKeys = new Set(
    (bank.questions || [])
      .map((item) => normalizeQuestionKey(item.q))
      .filter(Boolean)
  );

  const errors = [];
  const warnings = [];
  const newKeys = new Set();
  const output = [];

  entries.forEach((entry, index) => {
    const label = `Entrada ${index + 1}`;
    const q = String(entry.q || "").trim();
    const cat = String(entry.cat || "").trim();
    const docName = String(entry.doc || "").trim();
    const page = Number(entry.page);
    const ans = String(entry.ans || "").trim();

    if (!q) errors.push(`${label}: falta la pregunta (q).`);
    if (!cat) errors.push(`${label}: falta la categoría (cat).`);
    if (!docName) errors.push(`${label}: falta el documento (doc).`);
    if (!ans) errors.push(`${label}: falta la respuesta (ans).`);
    if (!Number.isInteger(page) || page < 1) {
      errors.push(`${label}: la página debe ser un entero mayor o igual a 1.`);
    }

    const doc = docsByFilename.get(docName.toLowerCase());
    if (!doc) {
      errors.push(`${label}: el documento no existe en el catálogo: "${docName}".`);
      return;
    }

    const pageCount = Number(doc.page_count || 0);
    if (Number.isInteger(page) && pageCount && page > pageCount) {
      errors.push(
        `${label}: la página ${page} excede las ${pageCount} páginas de "${doc.filename}".`
      );
      return;
    }

    const key = normalizeQuestionKey(q);
    if (!key) {
      errors.push(`${label}: la pregunta queda vacía al normalizarla.`);
      return;
    }
    if (existingKeys.has(key)) {
      errors.push(`${label}: la pregunta ya existe en questions_bank.json: "${q}".`);
      return;
    }
    if (newKeys.has(key)) {
      errors.push(`${label}: pregunta duplicada dentro de la fuente: "${q}".`);
      return;
    }

    if (ans.length < 180) {
      warnings.push(`${label}: respuesta corta (${ans.length} caracteres).`);
    }

    newKeys.add(key);
    output.push({
      q,
      cat,
      doc_id: doc.id,
      doc: doc.filename,
      page,
      ans,
    });
  });

  if (errors.length) {
    console.error("Errores de validación:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const payload = {
    version: 3,
    generated_from: "scripts/faq_v3_source.js",
    total_questions: output.length,
    questions: output,
  };

  const target = path.join(DATA, "faq_v3.json");
  fs.writeFileSync(target, JSON.stringify(payload, null, 2) + "\n", "utf8");

  const byCategory = {};
  for (const item of output) {
    byCategory[item.cat] = (byCategory[item.cat] || 0) + 1;
  }

  console.log(`OK: ${output.length} preguntas escritas en data/faq_v3.json`);
  for (const [category, count] of Object.entries(byCategory)) {
    console.log(`  ${count}\t${category}`);
  }
  if (warnings.length) {
    console.warn("\nAdvertencias:");
    for (const warning of warnings) console.warn(`- ${warning}`);
  }
}

main();
