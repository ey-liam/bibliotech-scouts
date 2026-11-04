// ============================================================================
// BiblioTech — Aplicación Principal (Sitio Web Público + Servidor Local)
// Creado por: Liam Durán / Caminante
// ============================================================================

const IS_LOCAL_SERVER =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost";

const GITHUB_RELEASE_BASE =
  "https://github.com/ey-liam/bibliotech-scouts/releases/download/v1.0/";

const STATE = {
  catalog: null,
  documents: [],
  docsById: {},
  docsByFilename: {},
  versionChains: [],
  topics: [],
  webChunks: [], // [[doc_id, page_start, text], ...]
  activeAskSection: "all",

  // Biblioteca interactiva (Lectura libre)
  activeShelf: "featured",
  libraryQuery: "",
  libraryVisibleCount: 12,
  currentShelfDocs: [],
  currentReadingIndex: -1,

  // Catálogo general
  filteredDocs: [],
  visibleCount: 24,
  pageSize: 24,
  searchQuery: "",
  categoryFilter: "all",
  sectionFilter: "all",
  extFilter: "all",
  onlyLatest: false,
  sortOrder: "recent",

  // Correo de contacto para recibir aportes de otros caminantes/scouts
  contactEmail: localStorage.getItem("bibliotech_contact_email") || "rdc.tlxh@gmail.com"
};

const STOPWORDS_ES = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a", "en",
  "con", "por", "para", "sin", "sobre", "entre", "hacia", "hasta", "desde", "que", "como",
  "cual", "cuales", "cuando", "donde", "quien", "es", "son", "fue", "ser", "esta", "estan",
  "este", "estos", "estas", "ese", "esa", "esos", "esas", "mi", "tu", "su", "sus", "nuestro",
  "nuestra", "y", "o", "u", "pero", "mas", "si", "no", "se", "le", "les", "lo", "me", "te",
  "nos", "ya", "muy", "tambien", "todo", "toda", "todos", "todas", "otro", "otra", "otros",
  "otras", "mismo", "misma", "puedo", "puede", "pueden", "tiene", "tienen", "hay", "dice",
  "segun", "acerca", "necesito", "quiero", "saber", "informacion", "archivo", "archivos",
  "documento", "documentos", "oficial", "oficiales", "explica", "explicame", "dime", "consiste", "trata"
]);

function normalizeStr(s) {
  if (!s) return "";
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeQuery(txt) {
  const norm = normalizeStr(txt);
  const all = norm.match(/[a-z0-9]{2,}/g) || [];
  const filtered = all.filter((w) => !STOPWORDS_ES.has(w));
  return filtered.length ? filtered : all;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeAssetName(filename) {
  // GitHub release asset naming convention
  return normalizeStr(filename)
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildFileUrl(doc, download = false) {
  if (!doc) return "#";
  if (IS_LOCAL_SERVER) {
    const encoded = doc.rel_path
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    return `/raw-files/${encoded}${download ? "?download=1" : ""}`;
  }
  const extLow = (doc.ext || "pdf").toLowerCase();
  if (doc.has_web_file && doc.sha12) {
    return `files/${doc.sha12}.${extLow}`;
  }
  if (doc.sha12) {
    return `${GITHUB_RELEASE_BASE}${doc.sha12}.${extLow}`;
  }
  return `data/text/${doc.sha12}.txt`;
}

function renderMarkdown(md) {
  if (!md) return "";
  const lines = md.split("\n");
  let html = "";
  let inList = false;

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      continue;
    }
    if (line === "---") {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<hr style="border:none;border-top:1.5px dashed #cbd5e1;margin:1.25rem 0;" />`;
      continue;
    }

    if (line.startsWith("### ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3>${formatInlineMd(line.slice(4))}</h3>`;
    } else if (line.startsWith("> ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<blockquote>${formatInlineMd(line.slice(2))}</blockquote>`;
    } else if (/^[-•]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      const cleaned = line.replace(/^([-•]|\d+\.)\s+/, "");
      html += `<li>${formatInlineMd(cleaned)}</li>`;
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${formatInlineMd(line)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function formatInlineMd(text) {
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

// ============================================================================
// CARGA INICIAL (CATÁLOGO + BASE DE CONOCIMIENTO + FRAGMENTOS DE BÚSQUEDA)
// ============================================================================
async function initApp() {
  setupContactEmailUI();
  bindEvents();

  try {
    let catRes;
    if (IS_LOCAL_SERVER) {
      catRes = await fetch("/api/catalog").catch(() => null);
    }
    if (!catRes || !catRes.ok) {
      catRes = await fetch("data/catalog.json");
    }
    const data = await catRes.json();
    STATE.catalog = data;
    STATE.documents = data.documents || [];
    STATE.versionChains = data.version_chains || [];
    STATE.docsById = {};
    STATE.docsByFilename = {};
    for (const d of STATE.documents) {
      STATE.docsById[d.id] = d;
      STATE.docsByFilename[normalizeStr(d.filename)] = d;
    }

    populateCategoryDropdown();
    renderVersionChains();
    renderLibraryShelf();
    applyCatalogFilters();

    // Cargar Base de Conocimiento Enciclopédica (38+ temas)
    const kbRes = await fetch("data/knowledge_base.json").catch(() => null);
    if (kbRes && kbRes.ok) {
      const kbData = await kbRes.json();
      STATE.topics = kbData.topics || [];
    }

    // Cargar los 6,929 fragmentos en segundo plano para búsqueda profunda en el navegador
    fetch("data/chunks.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((arr) => {
        STATE.webChunks = arr || [];
      })
      .catch(() => {});
  } catch (err) {
    console.error("Error cargando datos de BiblioTech:", err);
  }
}

function findDocByFilename(fname) {
  const nf = normalizeStr(fname);
  if (STATE.docsByFilename[nf]) return STATE.docsByFilename[nf];
  for (const [k, d] of Object.entries(STATE.docsByFilename)) {
    if (k.includes(nf) || nf.includes(k)) return d;
  }
  return null;
}

function setupContactEmailUI() {
  const link = document.getElementById("contributeMailLink");
  if (!link) return;
  link.textContent = STATE.contactEmail;
  link.href = `mailto:${encodeURIComponent(STATE.contactEmail)}?subject=${encodeURIComponent("Aporte de documento para BiblioTech Scout")}`;
}

function populateCategoryDropdown() {
  const select = document.getElementById("filterCategory");
  if (!select) return;
  const counts = {};
  for (const d of STATE.documents) {
    counts[d.category] = (counts[d.category] || 0) + 1;
  }
  const sortedCats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  select.innerHTML = `<option value="all">Todas las categorías (${STATE.documents.length})</option>`;
  for (const cat of sortedCats) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = `${cat} (${counts[cat]})`;
    select.appendChild(opt);
  }
}

function renderVersionChains() {
  const grid = document.getElementById("versionChainsGrid");
  if (!grid) return;
  if (!STATE.versionChains.length) {
    grid.innerHTML = "<p>No hay cadenas de versión adicionales.</p>";
    return;
  }
  grid.innerHTML = STATE.versionChains
    .map(
      (vc) => `
      <div class="vchain-item">
        <strong>${escapeHtml(vc.family_name)}</strong>
        <div style="margin-top:4px;color:#166534;font-weight:700;">
          ✓ Vigente (${vc.latest_year}): ${escapeHtml(vc.latest_file)}
        </div>
        <div style="margin-top:2px;color:#64748b;font-size:0.78rem;">
          Anterior: ${escapeHtml((vc.older_files || []).join(", "))}
        </div>
      </div>
    `
    )
    .join("");
}

// ============================================================================
// APARTADO DE BIBLIOTECA INTERACTIVA (LECTURA LIBRE)
// ============================================================================
function getDocsForShelf(shelf, filterText = "") {
  const q = normalizeStr(filterText.trim());
  const pdfAndReadable = STATE.documents.filter((d) => {
    if (!["PDF", "DOCX", "HTML"].includes(d.ext)) return false;
    if (q) {
      const hay = normalizeStr(`${d.title} ${d.filename} ${d.category} ${d.section_label}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  let list = [];
  switch (shelf) {
    case "featured": {
      const priorityNames = [
        "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "El desafio de ser Caminante 2024.pdf",
        "Pistas de Aventura 2024.pdf",
        "Mis Rastros en la Selva 2024.pdf",
        "Las Rutas del Rover.pdf",
        "REGLAMENTO 2023.pdf",
        "Estatutos 2023.pdf",
        "010 Guia Red de Caminantes.pdf",
        "Guía Punta de Flecha_2025-COMUNIDAD.pdf",
        "Política Diversidad, Equidad e Inclusion 2024.pdf",
        "CODIGO DE CONDUCTA 2025.pdf",
        "Manual del Pie Tierno.pdf",
        "Escultismo para Muchachos.pdf",
        "40 Años de Expresión y Arte Scout.pdf",
        "Comunicado ASMAC DNME-CNPJ 26.010 Implementación de Cuadernillos Tribu de la Tierra.pdf",
        "Comunicado ASMAC JSN 26.133 Convocatoria EEAS 2026.pdf"
      ].map(normalizeStr);

      const featured = [];
      const rest = [];
      for (const d of pdfAndReadable) {
        const nf = normalizeStr(d.filename);
        const idx = priorityNames.findIndex((p) => nf.includes(p) || p.includes(nf));
        if (idx !== -1) {
          featured.push({ idx, d });
        } else if (d.ext === "PDF" && d.is_latest_in_family !== false) {
          rest.push(d);
        }
      }
      featured.sort((a, b) => a.idx - b.idx);
      list = [...featured.map((x) => x.d), ...rest];
      break;
    }
    case "secciones":
      list = pdfAndReadable.filter(
        (d) =>
          d.category.includes("Manuales") ||
          ["manada", "tropa", "comunidad", "clan", "adultos"].includes(d.section)
      );
      break;
    case "insignias":
      list = pdfAndReadable.filter((d) => {
        const t = normalizeStr(`${d.title} ${d.filename} ${d.category}`);
        return (
          t.includes("insignia") ||
          t.includes("tribu") ||
          t.includes("pjos") ||
          t.includes("sustentabilidad") ||
          t.includes("punta de flecha") ||
          t.includes("explorapp") ||
          t.includes("mundo mejor")
        );
      });
      break;
    case "reglamentos":
      list = pdfAndReadable.filter(
        (d) =>
          d.category.includes("Reglamentos") ||
          d.category.includes("Salud, Seguridad") ||
          normalizeStr(d.title).includes("politica") ||
          normalizeStr(d.title).includes("reglamento") ||
          normalizeStr(d.title).includes("uniforme")
      );
      break;
    case "libros":
      list = pdfAndReadable.filter((d) => d.category.includes("Libros"));
      break;
    case "revistas":
      list = pdfAndReadable.filter((d) => d.category.includes("Revistas"));
      break;
    case "formatos":
      list = pdfAndReadable.filter((d) => d.category.includes("Formatos"));
      break;
    case "comunicados":
      list = pdfAndReadable.filter((d) => d.category.includes("Comunicados"));
      break;
    default:
      list = pdfAndReadable;
  }

  return list;
}

function renderLibraryShelf() {
  const grid = document.getElementById("libraryBookshelfGrid");
  const moreBtn = document.getElementById("libraryShowMoreBtn");
  if (!grid) return;

  const docs = getDocsForShelf(STATE.activeShelf, STATE.libraryQuery);
  STATE.currentShelfDocs = docs;
  const slice = docs.slice(0, STATE.libraryVisibleCount);

  if (!slice.length) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:2rem;color:#64748b;">No se encontraron libros con ese filtro en este estante.</p>`;
    if (moreBtn) moreBtn.classList.add("hidden");
    return;
  }

  grid.innerHTML = slice
    .map((d, idx) => {
      const coverUrl = d.ext === "PDF" && d.sha12 ? `covers/${d.sha12}.jpg` : "";
      const pagesLabel = d.page_count > 1 ? `${d.page_count} págs.` : d.ext;
      return `
        <article class="book-card" data-doc-id="${escapeHtml(d.id)}" data-shelf-idx="${idx}">
          <div class="book-cover-wrap">
            ${
              coverUrl
                ? `<img src="${coverUrl}" alt="${escapeHtml(d.title)}" class="book-cover-img" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden');" />
                   <div class="book-cover-fallback hidden">
                     <span style="font-size:0.75rem;font-weight:800;opacity:0.8;">${escapeHtml(d.section_label)}</span>
                     <strong style="font-size:0.95rem;line-height:1.3;">${escapeHtml(d.title)}</strong>
                     <span style="font-size:0.72rem;opacity:0.85;">${escapeHtml(d.ext)} • ${d.year}</span>
                   </div>`
                : `<div class="book-cover-fallback">
                     <span style="font-size:0.75rem;font-weight:800;opacity:0.8;">${escapeHtml(d.section_label)}</span>
                     <strong style="font-size:0.95rem;line-height:1.3;">${escapeHtml(d.title)}</strong>
                     <span style="font-size:0.72rem;opacity:0.85;">${escapeHtml(d.ext)} • ${d.year}</span>
                   </div>`
            }
            <span class="book-year-pill">${d.year}</span>
            <span class="book-pages-pill">${escapeHtml(pagesLabel)}</span>
          </div>
          <h3 class="book-title" title="${escapeHtml(d.title)}">${escapeHtml(d.title)}</h3>
          <span class="book-meta">${escapeHtml(d.section_label)}</span>
          <button type="button" class="book-read-btn">📖 Leer libremente</button>
        </article>
      `;
    })
    .join("");

  if (moreBtn) {
    if (docs.length > STATE.libraryVisibleCount) {
      moreBtn.classList.remove("hidden");
      moreBtn.textContent = `Ver más libros en este estante (${docs.length - STATE.libraryVisibleCount} restantes)`;
    } else {
      moreBtn.classList.add("hidden");
    }
  }
}

// ============================================================================
// MOTOR INTELIGENTE DE RESPUESTAS (SERVIDOR LOCAL + NAVEGADOR PARA SITIO PÚBLICO)
// ============================================================================
async function submitQuestion(queryText) {
  const q = (queryText || "").trim();
  if (!q) return;

  const input = document.getElementById("askInput");
  const clearBtn = document.getElementById("clearAskBtn");
  if (input) input.value = q;
  if (clearBtn) clearBtn.classList.remove("hidden");

  const container = document.getElementById("answerContainer");
  const titleEl = document.getElementById("answerQuestionTitle");
  const bodyEl = document.getElementById("answerBody");
  const sourcesEl = document.getElementById("answerSourcesGrid");

  container.classList.remove("hidden");
  titleEl.textContent = q;
  bodyEl.innerHTML = `<p style="color:#6d28d9;font-weight:700;">Consultando la base de datos oficial...</p>`;
  sourcesEl.innerHTML = "";

  container.scrollIntoView({ behavior: "smooth", block: "nearest" });

  if (IS_LOCAL_SERVER) {
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          section: STATE.activeAskSection
        })
      });
      if (res.ok) {
        const data = await res.json();
        displayAnswer(data);
        return;
      }
    } catch (_) {}
  }

  // Motor completo en navegador (para el sitio web público en GitHub Pages)
  const ans = answerLocallyInBrowser(q);
  displayAnswer(ans);
}

function matchTopicsInBrowser(query) {
  const qNorm = normalizeStr(query);
  const qClean = qNorm.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const scored = [];
  for (const topic of STATE.topics) {
    let score = 0;
    for (const pat of topic.patterns || []) {
      try {
        const rx = new RegExp(pat, "i");
        if (rx.test(qClean)) score += 12;
      } catch (_) {}
    }
    for (const kw of topic.keywords || []) {
      const nkw = normalizeStr(kw);
      if (qClean.includes(nkw)) {
        score += nkw.includes(" ") ? 5 : 2;
      }
    }
    if (score >= 5) {
      scored.push({ score, topic });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  if (!scored.length) return [];
  const topScore = scored[0].score;
  const results = [scored[0].topic];
  if (scored.length > 1 && scored[1].score >= Math.max(8, topScore * 0.65)) {
    results.push(scored[1].topic);
  }
  return results;
}

function answerLocallyInBrowser(query) {
  const matchedTopics = matchTopicsInBrowser(query);
  const tokens = tokenizeQuery(query);
  const sources = [];
  const seenIds = new Set();

  for (const t of matchedTopics) {
    for (const sf of t.source_files || []) {
      const d = findDocByFilename(sf);
      if (d && !seenIds.has(d.id)) {
        seenIds.add(d.id);
        sources.push({
          doc_id: d.id,
          title: d.title,
          filename: d.filename,
          ext: d.ext,
          year: d.year,
          page_start: 1
        });
      }
    }
  }

  // Búsqueda en los 6,929 fragmentos si ya están cargados
  const chunkMatches = [];
  if (STATE.webChunks && STATE.webChunks.length && tokens.length) {
    for (const entry of STATE.webChunks) {
      const [docId, pageStart, rawText] = entry;
      const d = STATE.docsById[docId];
      if (!d) continue;
      if (STATE.activeAskSection !== "all") {
        const secs = d.applicable_sections || [d.section];
        if (!secs.includes(STATE.activeAskSection)) continue;
      }
      const normTxt = normalizeStr(rawText);
      const normTitle = normalizeStr(d.title);
      let sc = 0;
      let coreHits = 0;
      for (const tk of tokens) {
        if (normTxt.includes(tk)) {
          sc += 2;
          coreHits += 1;
        }
        if (normTitle.includes(tk)) {
          sc += 4;
        }
      }
      if (sc > 0) {
        if (coreHits > 1) sc *= 1 + 0.25 * coreHits;
        if (d.year >= 2026) sc *= 1.35;
        else if (d.year === 2025) sc *= 1.2;
        if (d.is_latest_in_family === false) sc *= 0.5;
        chunkMatches.push({ sc, doc: d, pageStart, rawText });
      }
    }
    chunkMatches.sort((a, b) => b.sc - a.sc);
    for (const cm of chunkMatches.slice(0, 6)) {
      if (!seenIds.has(cm.doc.id)) {
        seenIds.add(cm.doc.id);
        sources.push({
          doc_id: cm.doc.id,
          title: cm.doc.title,
          filename: cm.doc.filename,
          ext: cm.doc.ext,
          year: cm.doc.year,
          page_start: cm.pageStart,
          excerpt: cm.rawText.replace(/\[Pág\.\s*\d+\]\s*/g, "").slice(0, 480)
        });
      }
    }
  }

  // Si no habían cargado chunks aún, buscar en el catálogo
  if (!sources.length && tokens.length) {
    const docScores = [];
    for (const d of STATE.documents) {
      const hay = normalizeStr(`${d.title} ${d.filename} ${d.summary || ""} ${d.category}`);
      let sc = 0;
      for (const tk of tokens) {
        if (hay.includes(tk)) sc += 2;
        if (normalizeStr(d.title).includes(tk)) sc += 3;
      }
      if (sc > 0) docScores.push({ sc, d });
    }
    docScores.sort((a, b) => b.sc - a.sc);
    for (const item of docScores.slice(0, 5)) {
      sources.push({
        doc_id: item.d.id,
        title: item.d.title,
        filename: item.d.filename,
        ext: item.d.ext,
        year: item.d.year,
        page_start: 1,
        excerpt: item.d.summary
      });
    }
  }

  if (matchedTopics.length) {
    return {
      query,
      answer_markdown: matchedTopics.map((t) => t.content).join("\n\n---\n\n"),
      sources: sources.slice(0, 6)
    };
  }

  if (!sources.length) {
    return {
      query,
      answer_markdown:
        "No encontré coincidencias directas con esos términos exactos. Prueba preguntando por ejemplo:\n" +
        "- *«¿Qué son los Scouts y cómo iniciaron?»*\n" +
        "- *«¿Dónde encuentro a los Scouts y cómo me integro?»*\n" +
        "- *«¿Dónde compro el uniforme scout?»*\n" +
        "- *«¿Qué es la Manada, la Tropa, la Comunidad o el Clan?»*\n" +
        "- *«¿Cómo hago mi desarrollo personal o cómo hago un proyecto?»*\n" +
        "- *«¿Qué son los ejes temáticos o el nuevo esquema PJOS 2026?»*",
      sources: []
    };
  }

  const lines = [
    `**De acuerdo con «${sources[0].title}» (${sources[0].year}):**\n`,
    ...sources
      .slice(0, 3)
      .map((s) => `- ${s.excerpt || STATE.docsById[s.doc_id]?.summary || s.title}`)
  ];

  return {
    query,
    answer_markdown: lines.join("\n"),
    sources: sources.slice(0, 6)
  };
}

function displayAnswer(data) {
  const bodyEl = document.getElementById("answerBody");
  const sourcesEl = document.getElementById("answerSourcesGrid");

  bodyEl.innerHTML = renderMarkdown(data.answer_markdown || "");

  const sources = data.sources || [];
  if (!sources.length) {
    sourcesEl.innerHTML = `<span style="font-size:0.82rem;color:#64748b;">Síntesis general verificada de BiblioTech.</span>`;
    return;
  }

  sourcesEl.innerHTML = sources
    .map(
      (s) => `
      <button type="button" class="source-bottom-pill" data-open-doc="${escapeHtml(s.doc_id)}">
        <span class="source-pill-ext">${escapeHtml(s.ext || "PDF")}</span>
        <strong>${escapeHtml(s.title)}</strong>
        <span class="source-pill-year">${s.year || ""}${s.page_start ? ` • Pág. ${s.page_start}` : ""}</span>
      </button>
    `
    )
    .join("");
}

// ============================================================================
// CATÁLOGO GENERAL Y FILTROS
// ============================================================================
function applyCatalogFilters() {
  const q = normalizeStr(STATE.searchQuery.trim());
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

  const filtered = STATE.documents.filter((d) => {
    if (STATE.onlyLatest && d.is_latest_in_family === false) return false;
    if (STATE.categoryFilter !== "all" && d.category !== STATE.categoryFilter) return false;
    if (STATE.sectionFilter !== "all") {
      const secs = d.applicable_sections || [d.section];
      if (!secs.includes(STATE.sectionFilter)) return false;
    }
    if (STATE.extFilter !== "all") {
      if (STATE.extFilter === "IMAGE") {
        if (!["PNG", "JPG", "JPEG", "WEBP", "AVIF"].includes(d.ext)) return false;
      } else if (d.ext !== STATE.extFilter) {
        return false;
      }
    }
    if (tokens.length) {
      const hay = normalizeStr(`${d.title} ${d.filename} ${d.code || ""} ${d.category} ${d.section_label} ${d.summary || ""}`);
      for (const tk of tokens) {
        if (!hay.includes(tk)) return false;
      }
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (STATE.sortOrder === "title") {
      return a.title.localeCompare(b.title, "es");
    }
    if (STATE.sortOrder === "size") {
      return (b.size_bytes || 0) - (a.size_bytes || 0);
    }
    if (b.year !== a.year) return b.year - a.year;
    return String(b.date_sort || "").localeCompare(String(a.date_sort || ""));
  });

  STATE.filteredDocs = filtered;
  STATE.visibleCount = STATE.pageSize;
  renderCatalogGrid();
}

function renderCatalogGrid() {
  const grid = document.getElementById("catalogGrid");
  const countLabel = document.getElementById("catalogCountLabel");
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const resetBtn = document.getElementById("resetFiltersBtn");

  if (!grid) return;

  const total = STATE.filteredDocs.length;
  countLabel.textContent = `Mostrando ${Math.min(STATE.visibleCount, total)} de ${total} documentos`;

  const hasActiveFilter =
    STATE.searchQuery.trim() !== "" ||
    STATE.categoryFilter !== "all" ||
    STATE.sectionFilter !== "all" ||
    STATE.extFilter !== "all" ||
    STATE.onlyLatest;
  resetBtn.classList.toggle("hidden", !hasActiveFilter);

  const slice = STATE.filteredDocs.slice(0, STATE.visibleCount);
  grid.innerHTML = slice
    .map((d) => {
      const dlUrl = buildFileUrl(d, true);
      const sizeText = d.size_mb >= 1 ? `${d.size_mb} MB` : `${d.size_kb || 15} KB`;
      return `
        <article class="doc-card">
          <div>
            <div class="doc-card-top">
              <div class="doc-badges">
                <span class="badge badge-ext">${escapeHtml(d.ext)}</span>
                <span class="badge badge-year">${d.year}</span>
                <span class="badge badge-sec">${escapeHtml(d.section_label)}</span>
              </div>
              <span style="font-size:0.74rem;color:#64748b;font-weight:700;">${sizeText}</span>
            </div>
            <h3 class="doc-title">${escapeHtml(d.title)}</h3>
            <p class="doc-summary">${escapeHtml(d.summary || d.filename)}</p>
          </div>
          <div class="doc-card-footer">
            <span style="font-size:0.75rem;color:#64748b;">${escapeHtml(d.category)}</span>
            <div class="doc-actions">
              <button type="button" class="btn-doc-view" data-open-doc="${escapeHtml(d.id)}">📖 Leer</button>
              <a href="${dlUrl}" download class="btn-doc-dl">⬇ Descargar</a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  if (total > STATE.visibleCount) {
    loadMoreBtn.classList.remove("hidden");
    loadMoreBtn.textContent = `Mostrar más documentos (${total - STATE.visibleCount} restantes)`;
  } else {
    loadMoreBtn.classList.add("hidden");
  }
}

// ============================================================================
// LECTOR INTERACTIVO (MODO LECTURA LIBRE)
// ============================================================================
async function openDocumentModal(docId, shelfIndex = -1) {
  const doc = STATE.docsById[docId];
  if (!doc) return;

  STATE.currentReadingIndex = shelfIndex;

  const modal = document.getElementById("docModal");
  const titleEl = document.getElementById("modalDocTitle");
  const fnameEl = document.getElementById("modalDocFilename");
  const badgesEl = document.getElementById("modalDocBadges");
  const openTabBtn = document.getElementById("modalOpenTabBtn");
  const dlBtn = document.getElementById("modalDownloadBtn");
  const prevBtn = document.getElementById("modalPrevBookBtn");
  const nextBtn = document.getElementById("modalNextBookBtn");
  const previewPane = document.getElementById("modalPreviewPane");
  const textPane = document.getElementById("modalTextPane");
  const chunksContainer = document.getElementById("modalChunksContainer");

  titleEl.textContent = doc.title;
  fnameEl.textContent = `${doc.filename} • ${doc.category}`;
  badgesEl.innerHTML = `
    <span class="badge badge-ext">${escapeHtml(doc.ext)}</span>
    <span class="badge badge-year">${doc.year}</span>
    <span class="badge badge-sec">${escapeHtml(doc.section_label)}</span>
  `;

  const viewUrl = buildFileUrl(doc, false);
  const dlUrl = buildFileUrl(doc, true);
  openTabBtn.href = viewUrl;
  dlBtn.href = dlUrl;

  if (shelfIndex >= 0 && STATE.currentShelfDocs.length > 1) {
    prevBtn.classList.remove("hidden");
    nextBtn.classList.remove("hidden");
    prevBtn.disabled = shelfIndex <= 0;
    nextBtn.disabled = shelfIndex >= STATE.currentShelfDocs.length - 1;
  } else {
    prevBtn.classList.add("hidden");
    nextBtn.classList.add("hidden");
  }

  // Cargar el texto completo de lectura (disponible para los 650 documentos)
  let fullTextContent = "";
  if (doc.sha12) {
    try {
      const txtRes = await fetch(`data/text/${doc.sha12}.txt`);
      if (txtRes.ok) {
        fullTextContent = await txtRes.text();
      }
    } catch (_) {}
  }

  const canEmbedNative = IS_LOCAL_SERVER || Boolean(doc.has_web_file);

  if (canEmbedNative && (doc.ext === "PDF" || (IS_LOCAL_SERVER && doc.ext === "HTML"))) {
    previewPane.innerHTML = `<iframe src="${viewUrl}" title="${escapeHtml(doc.title)}"></iframe>`;
  } else if (canEmbedNative && ["PNG", "JPG", "JPEG", "WEBP", "AVIF"].includes(doc.ext)) {
    previewPane.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:1.5rem;">
        <img src="${viewUrl}" alt="${escapeHtml(doc.title)}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;" />
      </div>
    `;
  } else {
    previewPane.innerHTML = renderWebReaderView(doc, fullTextContent, dlUrl);
  }

  chunksContainer.innerHTML = `<div class="chunk-block" style="white-space:pre-wrap;">${escapeHtml(fullTextContent || doc.summary || doc.title)}</div>`;
  modal.classList.remove("hidden");
}

function renderWebReaderView(doc, fullTextContent, dlUrl) {
  const coverUrl = doc.ext === "PDF" && doc.sha12 ? `covers/${doc.sha12}.jpg` : "";
  const blocks = (fullTextContent || doc.summary || "")
    .split(/\n--- Página \d+ ---\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return `
    <div style="background:#f8fafc;min-height:100%;padding:2rem;color:#0f172a;overflow-y:auto;">
      <div style="max-width:860px;margin:0 auto;">
        <div style="display:flex;gap:1.5rem;align-items:center;background:#ffffff;padding:1.5rem;border-radius:20px;border:1.5px solid #dbeafe;margin-bottom:1.5rem;flex-wrap:wrap;">
          ${
            coverUrl
              ? `<img src="${coverUrl}" alt="${escapeHtml(doc.title)}" style="width:110px;border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,0.15);" onerror="this.style.display='none'" />`
              : ""
          }
          <div style="flex:1;min-width:220px;">
            <span style="font-size:0.75rem;font-weight:800;color:#6d28d9;text-transform:uppercase;">📖 MODO LECTURA LIBRE • ${escapeHtml(doc.section_label)}</span>
            <h2 style="font-size:1.4rem;color:#0c1938;margin:0.3rem 0;">${escapeHtml(doc.title)}</h2>
            <p style="font-size:0.84rem;color:#64748b;margin-bottom:0.85rem;">Archivo original: <code>${escapeHtml(doc.filename)}</code> (${doc.year})</p>
            <a href="${dlUrl}" download class="btn-modal-primary" style="display:inline-block;">⬇ Descargar archivo original (${escapeHtml(doc.ext)})</a>
          </div>
        </div>
        ${blocks
          .map(
            (blk, i) => `
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:1.5rem;margin-bottom:1rem;line-height:1.8;font-size:0.98rem;white-space:pre-wrap;">${
            blocks.length > 1
              ? `<div style="font-size:0.75rem;font-weight:800;color:#0284c7;margin-bottom:0.5rem;">SECCIÓN / PÁGINA ${i + 1}</div>`
              : ""
          }${escapeHtml(blk)}</div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

// ============================================================================
// EVENTOS DE INTERFAZ
// ============================================================================
function bindEvents() {
  const askForm = document.getElementById("askForm");
  const askInput = document.getElementById("askInput");
  const clearAskBtn = document.getElementById("clearAskBtn");

  if (askForm) {
    askForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitQuestion(askInput.value);
    });
  }

  if (askInput && clearAskBtn) {
    askInput.addEventListener("input", () => {
      clearAskBtn.classList.toggle("hidden", !askInput.value.trim());
    });
    clearAskBtn.addEventListener("click", () => {
      askInput.value = "";
      clearAskBtn.classList.add("hidden");
      askInput.focus();
    });
  }

  document.querySelectorAll(".sec-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sec-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.activeAskSection = btn.dataset.section || "all";
    });
  });

  document.querySelectorAll("[data-query]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.getAttribute("data-query");
      submitQuestion(q);
    });
  });

  const closeAnsBtn = document.getElementById("closeAnswerBtn");
  if (closeAnsBtn) {
    closeAnsBtn.addEventListener("click", () => {
      document.getElementById("answerContainer").classList.add("hidden");
    });
  }

  document.querySelectorAll(".shelf-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".shelf-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      STATE.activeShelf = tab.dataset.shelf || "featured";
      STATE.libraryVisibleCount = 12;
      renderLibraryShelf();
    });
  });

  const libFilterInput = document.getElementById("libraryFilterInput");
  if (libFilterInput) {
    libFilterInput.addEventListener("input", () => {
      STATE.libraryQuery = libFilterInput.value;
      STATE.libraryVisibleCount = 12;
      renderLibraryShelf();
    });
  }

  const libMoreBtn = document.getElementById("libraryShowMoreBtn");
  if (libMoreBtn) {
    libMoreBtn.addEventListener("click", () => {
      STATE.libraryVisibleCount += 12;
      renderLibraryShelf();
    });
  }

  const bookshelfGrid = document.getElementById("libraryBookshelfGrid");
  if (bookshelfGrid) {
    bookshelfGrid.addEventListener("click", (e) => {
      const card = e.target.closest(".book-card");
      if (!card) return;
      const docId = card.getAttribute("data-doc-id");
      const shelfIdx = parseInt(card.getAttribute("data-shelf-idx") || "-1", 10);
      openDocumentModal(docId, shelfIdx);
    });
  }

  document.body.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open-doc]");
    if (openBtn) {
      openDocumentModal(openBtn.getAttribute("data-open-doc"));
    }
  });

  document.querySelectorAll("[data-sec-jump]").forEach((card) => {
    card.addEventListener("click", () => {
      const sec = card.getAttribute("data-sec-jump");
      const secSelect = document.getElementById("filterSection");
      if (secSelect) {
        secSelect.value = sec;
        STATE.sectionFilter = sec;
        applyCatalogFilters();
        document.getElementById("explorar").scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  const catSearch = document.getElementById("catalogSearchInput");
  const filterCat = document.getElementById("filterCategory");
  const filterSec = document.getElementById("filterSection");
  const filterExt = document.getElementById("filterExt");
  const sortSelect = document.getElementById("sortOrderSelect");
  const onlyLatestChk = document.getElementById("onlyLatestCheckbox");
  const resetBtn = document.getElementById("resetFiltersBtn");
  const loadMoreBtn = document.getElementById("loadMoreBtn");

  if (catSearch) {
    catSearch.addEventListener("input", () => {
      STATE.searchQuery = catSearch.value;
      applyCatalogFilters();
    });
  }
  if (filterCat) {
    filterCat.addEventListener("change", () => {
      STATE.categoryFilter = filterCat.value;
      applyCatalogFilters();
    });
  }
  if (filterSec) {
    filterSec.addEventListener("change", () => {
      STATE.sectionFilter = filterSec.value;
      applyCatalogFilters();
    });
  }
  if (filterExt) {
    filterExt.addEventListener("change", () => {
      STATE.extFilter = filterExt.value;
      applyCatalogFilters();
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      STATE.sortOrder = sortSelect.value;
      applyCatalogFilters();
    });
  }
  if (onlyLatestChk) {
    onlyLatestChk.addEventListener("change", () => {
      STATE.onlyLatest = onlyLatestChk.checked;
      applyCatalogFilters();
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      STATE.searchQuery = "";
      STATE.categoryFilter = "all";
      STATE.sectionFilter = "all";
      STATE.extFilter = "all";
      STATE.onlyLatest = false;
      if (catSearch) catSearch.value = "";
      if (filterCat) filterCat.value = "all";
      if (filterSec) filterSec.value = "all";
      if (filterExt) filterExt.value = "all";
      if (onlyLatestChk) onlyLatestChk.checked = false;
      applyCatalogFilters();
    });
  }
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      STATE.visibleCount += STATE.pageSize;
      renderCatalogGrid();
    });
  }

  const docModal = document.getElementById("docModal");
  const docModalContainer = document.getElementById("docModalContainer");
  const closeDocModalBtn = document.getElementById("closeDocModalBtn");
  const fullscreenBtn = document.getElementById("modalFullscreenBtn");
  const prevBookBtn = document.getElementById("modalPrevBookBtn");
  const nextBookBtn = document.getElementById("modalNextBookBtn");

  if (closeDocModalBtn) {
    closeDocModalBtn.addEventListener("click", () => {
      docModal.classList.add("hidden");
      document.getElementById("modalPreviewPane").innerHTML = "";
    });
  }

  if (fullscreenBtn && docModalContainer) {
    fullscreenBtn.addEventListener("click", () => {
      docModalContainer.classList.toggle("fullscreen-reader");
    });
  }

  if (prevBookBtn) {
    prevBookBtn.addEventListener("click", () => {
      if (STATE.currentReadingIndex > 0) {
        const prevIdx = STATE.currentReadingIndex - 1;
        const prevDoc = STATE.currentShelfDocs[prevIdx];
        if (prevDoc) openDocumentModal(prevDoc.id, prevIdx);
      }
    });
  }

  if (nextBookBtn) {
    nextBookBtn.addEventListener("click", () => {
      if (STATE.currentReadingIndex >= 0 && STATE.currentReadingIndex < STATE.currentShelfDocs.length - 1) {
        const nextIdx = STATE.currentReadingIndex + 1;
        const nextDoc = STATE.currentShelfDocs[nextIdx];
        if (nextDoc) openDocumentModal(nextDoc.id, nextIdx);
      }
    });
  }

  document.querySelectorAll(".modal-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".modal-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      document.getElementById("modalPreviewPane").classList.toggle("hidden", target !== "preview");
      document.getElementById("modalTextPane").classList.toggle("hidden", target !== "text");
    });
  });

  const copyMailBtn = document.getElementById("copyMailBtn");
  const editMailBtn = document.getElementById("editMailBtn");
  const openUploadBtn = document.getElementById("openUploadModalBtn");
  const uploadModal = document.getElementById("uploadModal");
  const closeUploadBtn = document.getElementById("closeUploadModalBtn");
  const uploadInput = document.getElementById("uploadFileInput");
  const reindexBtn = document.getElementById("reindexAllBtn");

  if (copyMailBtn) {
    copyMailBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(STATE.contactEmail);
      copyMailBtn.textContent = "¡Copiado!";
      setTimeout(() => {
        copyMailBtn.textContent = "Copiar correo";
      }, 1800);
    });
  }

  if (editMailBtn) {
    editMailBtn.addEventListener("click", () => {
      const nuevo = prompt("Ingresa el correo donde recibirás los documentos de otros caminantes/scouts:", STATE.contactEmail);
      if (nuevo && nuevo.includes("@")) {
        STATE.contactEmail = nuevo.trim();
        localStorage.setItem("bibliotech_contact_email", STATE.contactEmail);
        setupContactEmailUI();
      }
    });
  }

  if (openUploadBtn && uploadModal) {
    openUploadBtn.addEventListener("click", () => uploadModal.classList.remove("hidden"));
  }
  if (closeUploadBtn && uploadModal) {
    closeUploadBtn.addEventListener("click", () => uploadModal.classList.add("hidden"));
  }

  if (uploadInput) {
    uploadInput.addEventListener("change", async () => {
      const file = uploadInput.files[0];
      if (!file) return;
      const statusBox = document.getElementById("uploadStatusBox");
      statusBox.classList.remove("hidden");
      statusBox.textContent = `Subiendo e indexando «${file.name}»...`;

      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = String(reader.result).split(",")[1] || "";
        try {
          const res = await fetch("/api/upload-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, contentBase64: b64 })
          });
          const out = await res.json();
          statusBox.textContent = out.message || out.error || "Listo";
          if (out.ok) initApp();
        } catch (err) {
          statusBox.textContent = "Para subir archivos, ejecuta server.py o actualizar_bibliotech.bat.";
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (reindexBtn) {
    reindexBtn.addEventListener("click", async () => {
      const statusBox = document.getElementById("uploadStatusBox");
      statusBox.classList.remove("hidden");
      statusBox.textContent = "Re-indexando documentos...";
      try {
        const res = await fetch("/api/reindex", { method: "POST" });
        const out = await res.json();
        statusBox.textContent = out.message || "Índice actualizado";
        if (out.ok) initApp();
      } catch (_) {
        statusBox.textContent = "Para re-indexar, ejecuta server.py localmente.";
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", initApp);
