// ============================================================================
// BiblioTech — Aplicacion Principal (Sitio Web Publico)
// Creador: Liam Duran - Provincia TLXH
// ============================================================================

const IS_LOCAL_SERVER = false;

const GITHUB_RELEASE_BASE =
  "https://github.com/ey-liam/bibliotech-scouts/releases/download/v1.0/";

const STATE = {
  catalog: null,
  allDocuments: [],
  documents: [], // 498 documentos oficiales descargables (excluye paginas .html)
  docsById: {},
  docsByFilename: {},
  versionChains: [],
  topics: [],
  topicsById: {},
  questionBank: [],
  qBankByNorm: {},
  activeQCat: "Destacadas",
  qShuffleOffset: 0,
  webChunks: [], // [[doc_id, page_start, text], ...]
  activeAskSection: "all",

  // Biblioteca Scout interactiva (Lectura libre + filtro por seccion y alcance)
  activeShelf: "featured",
  libraryQuery: "",
  librarySection: "all",
  libraryScope: "shelf",
  libraryVisibleCount: 12,
  currentShelfDocs: [],
  currentReadingIndex: -1,

  // Catalogo general
  filteredDocs: [],
  visibleCount: 24,
  pageSize: 24,
  searchQuery: "",
  categoryFilter: "all",
  sectionFilter: "all",
  extFilter: "all",
  onlyLatest: false,
  sortOrder: "recent",

  // Correo de contacto para recibir aportes e issues de otros caminantes/scouts
  contactEmail: "rdc.tlxh@gmail.com"
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
  "documento", "documentos", "oficial", "oficiales", "explica", "explicame", "dime", "consiste", "trata",
  "pregunta", "preguntas", "duda", "dudas", "consulta", "consultar", "tema", "respuesta"
]);

function normalizeStr(s) {
  if (!s) return "";
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeQuestionKey(s) {
  return normalizeStr(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

    if (line.startsWith("#### ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h4>${formatInlineMd(line.slice(5))}</h4>`;
    } else if (line.startsWith("### ")) {
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
// CARGA DIFERIDA DE DATOS PESADOS
// El banco de preguntas (4.5 MB) y los fragmentos (13 MB) no son necesarios
// para pintar la primera pantalla. Se cargan al usarlos y se guardan en caché.
// ============================================================================
let questionBankPromise = null;
let webChunksPromise = null;

function loadQuestionBank() {
  if (STATE.questionBank.length) return Promise.resolve(STATE.questionBank);
  if (questionBankPromise) return questionBankPromise;

  // El banco base y el banco ampliado V3 se descargan en paralelo. Si el V3
  // falla, la página sigue funcionando con el banco base.
  const loadJsonBank = (url) =>
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch((error) => {
        console.warn(`BiblioTech: no se pudo cargar ${url}.`, error);
        return null;
      });

  questionBankPromise = Promise.all([
    loadJsonBank("data/questions_bank.json"),
    loadJsonBank("data/faq_v3.json"),
  ])
    .then(([baseData, v3Data]) => {
      const base = (baseData && baseData.questions) || [];
      const extra = (v3Data && v3Data.questions) || [];
      const seen = new Set();
      for (const item of base) {
        const key = normalizeQuestionKey(item.q || "");
        if (key) seen.add(key);
      }
      const merged = base.slice();
      for (const item of extra) {
        const key = normalizeQuestionKey(item.q || "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
      }

      STATE.questionBank = merged;
      STATE.qBankByNorm = {};
      for (const qObj of STATE.questionBank) {
        const nk = normalizeQuestionKey(qObj.q || "");
        if (nk) STATE.qBankByNorm[nk] = qObj;
      }
      const badge = document.getElementById("totalQuestionsCount");
      if (badge && STATE.questionBank.length) {
        badge.textContent = STATE.questionBank.length.toLocaleString("es-MX");
      }
      return STATE.questionBank;
    })
    .catch((error) => {
      console.warn("BiblioTech: no se pudo cargar el banco de preguntas.", error);
      questionBankPromise = null;
      return [];
    });

  return questionBankPromise;
}

function loadWebChunks() {
  if (STATE.webChunks.length) return Promise.resolve(STATE.webChunks);
  if (webChunksPromise) return webChunksPromise;

  webChunksPromise = fetch("data/chunks.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((arr) => {
      STATE.webChunks = arr || [];
      return STATE.webChunks;
    })
    .catch((error) => {
      console.warn("BiblioTech: no se pudieron cargar los fragmentos.", error);
      webChunksPromise = null;
      return [];
    });

  return webChunksPromise;
}

function setupLazyDataWarmup() {
  // El banco de preguntas se descarga en cuanto la persona interactúa con la
  // página (tocar, hacer clic, escribir o desplazarse), nunca durante la carga
  // inicial que mide Lighthouse.
  const events = ["pointerdown", "keydown", "touchstart", "scroll"];
  const run = () => {
    loadQuestionBank();
    events.forEach((event) => window.removeEventListener(event, run));
  };
  events.forEach((event) => window.addEventListener(event, run, { once: true, passive: true }));
}

// ============================================================================
// CARGA INICIAL (CATALOGO DE 498 DOCUMENTOS + 104 TEMAS)
// ============================================================================
async function initApp() {
  setupHeaderUI();
  setupContactEmailUI();
  bindEvents();
  setupScrollAnimations();

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
    STATE.allDocuments = data.documents || [];
    // Excluir archivos .html de la Biblioteca y del Catalogo (su contenido ya vive estructurado en el sitio y en Q&A)
    STATE.documents = STATE.allDocuments.filter((d) => String(d.ext || "").toUpperCase() !== "HTML");
    STATE.versionChains = data.version_chains || [];
    STATE.docsById = {};
    STATE.docsByFilename = {};
    for (const d of STATE.allDocuments) {
      STATE.docsById[d.id] = d;
      STATE.docsByFilename[normalizeStr(d.filename)] = d;
    }

    populateCategoryDropdown();
    renderVersionChains();
    renderLibraryShelf();
    applyCatalogFilters();

    // Cargar Base de Conocimiento Enciclopedica (104 temas maestros)
    const kbRes = await fetch("data/knowledge_base.json").catch(() => null);
    if (kbRes && kbRes.ok) {
      const kbData = await kbRes.json();
      STATE.topics = kbData.topics || [];
      STATE.topicsById = {};
      for (const t of STATE.topics) {
        if (t.id) STATE.topicsById[t.id] = t;
      }
    }

    // El banco de preguntas y los fragmentos se cargan de forma diferida:
    // primero la página, después los datos pesados cuando se usan.
    setupLazyDataWarmup();
  } catch (err) {
    console.error("Error cargando datos de BiblioTech:", err);
  }
}

// ============================================================================
// BARRA SUPERIOR: MENÚ MÓVIL, ESTADO AL DESPLAZAR Y PROGRESO DE LECTURA
// ============================================================================
function setupHeaderUI() {
  const header = document.querySelector(".main-header");
  if (!header) return;

  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("navegacion-principal");
  const backdrop = document.getElementById("navBackdrop");
  const progress = document.getElementById("scrollProgressBar");
  const firstNavLink = nav ? nav.querySelector(".nav-link") : null;

  const closeNav = (returnFocus = false) => {
    header.classList.remove("nav-open");
    document.body.classList.remove("nav-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    if (backdrop) backdrop.hidden = true;
    if (returnFocus && toggle) toggle.focus();
  };

  const openNav = () => {
    header.classList.add("nav-open");
    document.body.classList.add("nav-open");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    if (backdrop) backdrop.hidden = false;
    if (firstNavLink) firstNavLink.focus();
  };

  if (toggle) {
    toggle.addEventListener("click", () => {
      if (header.classList.contains("nav-open")) closeNav(true);
      else openNav();
    });
  }

  if (nav) {
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => closeNav());
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", () => closeNav(true));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && header.classList.contains("nav-open")) {
      closeNav(true);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1024 && header.classList.contains("nav-open")) {
      closeNav();
    }
  });

  let ticking = false;
  const updateScrollUI = () => {
    const sy = window.scrollY || document.documentElement.scrollTop || 0;
    header.classList.toggle("is-scrolled", sy > 16);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(sy / max, 1) : 0;
      progress.style.transform = `scaleX(${ratio})`;
    }
    ticking = false;
  };

  updateScrollUI();
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateScrollUI);
    },
    { passive: true }
  );
}

function setupScrollAnimations() {
  const targets = document.querySelectorAll(
    ".starter-3d-card, .scout-sec-card, .service-info-card, .change-card, .centenario-collection-banner, .agentes-card, .about-card, .mosaic-item"
  );
  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("revealed"));
  } else {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" }
    );
    targets.forEach((el, idx) => {
      el.classList.add("reveal-on-scroll");
      el.style.transitionDelay = `${(idx % 6) * 45}ms`;
      obs.observe(el);
    });
  }

  setup3DTiltInteractions();

  // Barra flotante de acceso rapido + Scroll-Spy de navegacion
  const quickBar = document.getElementById("floatingQuickBar");
  const askFab = document.getElementById("floatingAskBtn");
  const topFab = document.getElementById("floatingTopBtn");
  const navLinks = Array.from(document.querySelectorAll(".main-nav .nav-link"));
  const spyIds = ["buscador", "biblioteca", "acerca", "agentes", "secciones", "cambios", "explorar"];

  if (askFab) {
    askFab.addEventListener("click", () => {
      const searchCard = document.getElementById("buscador");
      const input = document.getElementById("askInput");
      if (searchCard) searchCard.scrollIntoView({ behavior: "smooth", block: "center" });
      if (input) setTimeout(() => input.focus(), 380);
    });
  }
  if (topFab) {
    topFab.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const sy = window.scrollY || document.documentElement.scrollTop || 0;
        if (quickBar) {
          quickBar.classList.toggle("hidden", sy < 460);
        }
        let currentId = "buscador";
        for (const id of spyIds) {
          const el = document.getElementById(id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= 165) {
              currentId = id;
            }
          }
        }
        for (const link of navLinks) {
          const href = link.getAttribute("href") || "";
          link.classList.toggle("active", href === `#${currentId}`);
        }
        ticking = false;
      });
    },
    { passive: true }
  );

  // Soporte de teclado (Enter / Espacio) en elementos interactivos con data-query
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const target = e.target.closest('[data-query][role="button"]');
    if (!target) return;
    e.preventDefault();
    submitQuestion(target.getAttribute("data-query"));
  });
}

function setup3DTiltInteractions() {
  if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
  const tiltCards = document.querySelectorAll(
    ".starter-3d-card, .scout-sec-card, .service-info-card, .change-card, .liam-depth-stage"
  );
  tiltCards.forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const ry = ((x - 0.5) * 10).toFixed(2);
      const rx = ((0.5 - y) * 9).toFixed(2);
      card.style.setProperty("--rx", `${rx}deg`);
      card.style.setProperty("--ry", `${ry}deg`);
      card.style.setProperty("--glare-x", `${(x * 100).toFixed(1)}%`);
      card.style.setProperty("--glare-y", `${(y * 100).toFixed(1)}%`);
      card.classList.add("is-tilting-3d");
    });
    const resetTilt = () => {
      card.classList.remove("is-tilting-3d");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    };
    card.addEventListener("pointerleave", resetTilt);
    card.addEventListener("pointercancel", resetTilt);
  });
}

// ============================================================================
// EXPLORADOR DINAMICO DE LAS +5,412 PREGUNTAS + AUTOCOMPLETADO EN VIVO
// ============================================================================
const DEFAULT_FEATURED_QUESTIONS = [
  "¿En dónde encuentro un Grupo Scout?",
  "¿Cómo inscribo a mi hijo o hija en los Scouts, en dónde se registra y con quién tengo que hablar comúnmente del registro?",
  "¿Qué permisos necesita mi hijo para inscribirse o ir de campamento y qué necesito llevar para asistir?",
  "¿Qué es el SISAS, qué es ExplorApp y qué es CarpetApp?",
  "¿Qué es el Centro Scout o Campo Escuela Meztitla y dónde se ubica?",
  "¿Qué son el Jamboree Nacional, el World Scout Jamboree, el Philia y el World Scout Moot, dónde se hacen y cada cuánto?",
  "¿Qué es el CPRC y qué es el CNRC (Comité Nacional de la Red de Caminantes) y quiénes son sus integrantes actuales?",
  "¿Cómo se hace la elección del CPRC y del CNRC, en dónde se hace y cuál es el objetivo de los Foros?",
  "¿Cómo se hace un Foro Provincial paso a paso y quiénes son los encargados de organizarlo?",
  "¿Qué es el Asesor de la Red o Comité de Caminantes, cómo se elige, qué funciones y requisitos tiene y cómo se evalúa?",
  "¿En dónde puedo subir mis proyectos como Caminante (Agentes de Cambio.MX), cómo se hace un proyecto y qué formatos se necesitan?",
  "¿Qué especialidades, reconocimientos e insignias puedo obtener con mis proyectos de Caminante y cómo sé a qué Eje Temático pertenecen?",
  "¿Cómo se aplica el nuevo esquema PJOS y pueden combinarse las nuevas insignias con las antiguas?",
  "¿Cuántas insignias hay en el nuevo esquema en Manada, Tropa, Comunidad y Clan?",
  "¿Quién es el Jefe Scout Nacional, el Presidente Nacional, la Subcomisionada de Comunidad y quién dirige la Dirección Internacional?",
  "¿Dónde compro el uniforme scout?",
  "¿Cómo se atiende a una persona que se está atragantando?",
  "¿Cómo se purifica el agua en campamento?",
  "¿Qué es la Política Nacional A Salvo del Peligro?"
];

function renderExplorerQuestions(cat, shuffle = false) {
  const container = document.getElementById("dynamicQuestionsChips");
  if (!container) return;

  if (cat === "Destacadas" && !shuffle) {
    container.innerHTML = DEFAULT_FEATURED_QUESTIONS.map(
      (qText, idx) =>
        `<button type="button" class="quick-q-chip" style="animation-delay:${idx * 24}ms" data-query="${escapeHtml(qText)}">${escapeHtml(qText)}</button>`
    ).join("");
    return;
  }

  if (!STATE.questionBank.length) return;

  let pool = STATE.questionBank.filter((item) => {
    const nq = normalizeStr(item.q || "");
    if (nq.includes("falda")) return false;
    if (cat === "Destacadas") return !item.doc_id;
    return item.cat === cat;
  });

  if (!pool.length) {
    pool = STATE.questionBank.filter((item) => !normalizeStr(item.q || "").includes("falda"));
  }

  const count = 12;
  const selected = [];
  if (shuffle) {
    STATE.qShuffleOffset = (STATE.qShuffleOffset + 13) % Math.max(1, pool.length);
  }
  const step = Math.max(1, Math.floor(pool.length / count));
  for (let i = 0; i < count && i < pool.length; i++) {
    const idx = (STATE.qShuffleOffset + i * step + (shuffle ? Math.floor(Math.random() * 5) : 0)) % pool.length;
    const candidate = pool[idx];
    if (candidate && !selected.some((x) => x.q === candidate.q)) {
      selected.push(candidate);
    }
  }

  container.innerHTML = selected
    .map(
      (item, idx) =>
        `<button type="button" class="quick-q-chip" style="animation-delay:${idx * 25}ms" data-query="${escapeHtml(item.q)}">${escapeHtml(item.q)}</button>`
    )
    .join("");
}

function updateAutocompleteDropdown(rawInput) {
  const box = document.getElementById("askAutocomplete");
  if (!box) return;

  const qNorm = normalizeQuestionKey(rawInput);
  if (!qNorm || qNorm.length < 2 || !STATE.questionBank.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  // Se usan palabras significativas (sin artículos ni muletillas) para que al
  // escribir una pregunta completa también aparezcan temas relacionados.
  const tokens = tokenizeQuery(rawInput).filter((w) => w.length >= 2);
  if (!tokens.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  const minHits = tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.5);
  const userTypedFalda = qNorm.includes("falda");
  const matches = [];

  for (const item of STATE.questionBank) {
    const nq = normalizeQuestionKey(item.q || "");
    if (!userTypedFalda && nq.includes("falda")) continue;

    let score = 0;
    if (nq.startsWith(qNorm)) score += 30;
    else if (nq.includes(qNorm)) score += 18;

    let tokenHits = 0;
    for (const tk of tokens) {
      if (nq.includes(tk)) {
        score += tk.length >= 5 ? 5 : 3;
        tokenHits += 1;
      }
    }
    if (tokenHits >= minHits) {
      if (tokenHits === tokens.length) score += 12;
      if (!item.doc_id) score += 6;
      matches.push({ score, item });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  const top = matches.slice(0, 8).map((m) => m.item);

  if (!top.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  box.innerHTML = top
    .map(
      (item) => `
      <div class="ask-ac-item" data-ac-query="${escapeHtml(item.q)}">
        <span class="ask-ac-text">${escapeHtml(item.q)}</span>
        <span class="ask-ac-cat">${escapeHtml(item.cat || "General")}</span>
      </div>
    `
    )
    .join("");
  box.classList.remove("hidden");
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
  link.href = `mailto:${encodeURIComponent(STATE.contactEmail)}?subject=${encodeURIComponent("Aporte o Issue para BiblioTech Scout")}`;
}

function populateCategoryDropdown() {
  const select = document.getElementById("filterCategory");
  if (!select) return;
  const counts = {};
  for (const d of STATE.documents) {
    counts[d.category] = (counts[d.category] || 0) + 1;
  }
  const orderedCats = [
    "Colección Biblioteca del Centenario",
    "Guías, Carnets y Programa de Jóvenes (PJOS)",
    "Manuales Oficiales y de Operación",
    "Reglamentos, Estatutos y Políticas",
    "Convocatorias y Comunicados Nacionales",
    "Revistas Foro Joven y Boletines",
    "Formatos, Actas y Seguro Scout",
    "Identidad Gráfica y Recursos Visuales"
  ];
  select.innerHTML = `<option value="all">Todas las categorías (${STATE.documents.length})</option>`;
  for (const cat of orderedCats) {
    if (!counts[cat]) continue;
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
          Vigente (${vc.latest_year}): ${escapeHtml(vc.latest_file)}
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
// APARTADO DE BIBLIOTECA INTERACTIVA POR LAS 8 CATEGORIAS OFICIALES
// ============================================================================
function filterDocsByShelfName(list, shelf) {
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
      for (const d of list) {
        const nf = normalizeStr(d.filename);
        const idx = priorityNames.findIndex((p) => nf.includes(p) || p.includes(nf));
        if (idx !== -1) {
          featured.push({ idx, d });
        } else if (d.ext === "PDF" && d.is_latest_in_family !== false) {
          rest.push(d);
        }
      }
      featured.sort((a, b) => a.idx - b.idx);
      return [...featured.map((x) => x.d), ...rest];
    }
    case "centenario":
      return list
        .filter((d) => d.category === "Colección Biblioteca del Centenario")
        .sort((a, b) => a.filename.localeCompare(b.filename, "es", { numeric: true }));
    case "guias_pjos":
      return list.filter((d) => d.category === "Guías, Carnets y Programa de Jóvenes (PJOS)");
    case "manuales":
      return list.filter((d) => d.category === "Manuales Oficiales y de Operación");
    case "reglamentos":
      return list.filter((d) => d.category === "Reglamentos, Estatutos y Políticas");
    case "convocatorias":
      return list.filter((d) => d.category === "Convocatorias y Comunicados Nacionales");
    case "revistas":
      return list.filter((d) => d.category === "Revistas Foro Joven y Boletines");
    case "formatos":
      return list.filter((d) => d.category === "Formatos, Actas y Seguro Scout");
    case "identidad":
      return list.filter((d) => d.category === "Identidad Gráfica y Recursos Visuales");
    default:
      return list;
  }
}

function getDocsForShelf(shelf, filterText = "") {
  const q = normalizeStr(filterText.trim());
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const secFilter = STATE.librarySection || "all";
  const scope = STATE.libraryScope || "shelf";

  const readable = STATE.documents.filter((d) => {
    if (secFilter !== "all") {
      const secs = d.applicable_sections || [d.section];
      if (!secs.includes(secFilter)) return false;
    }
    if (tokens.length) {
      const hay = normalizeStr(`${d.title} ${d.filename} ${d.category} ${d.section_label} ${d.summary || ""} ${d.code || ""}`);
      for (const tk of tokens) {
        if (!hay.includes(tk)) return false;
      }
    }
    return true;
  });

  if (scope === "all") {
    return readable;
  }

  const shelfDocs = filterDocsByShelfName(readable, shelf);
  // Si el usuario escribio una busqueda y no hay coincidencias en el estante actual, mostrar coincidencias de todos los estantes
  if (tokens.length && !shelfDocs.length && readable.length) {
    return readable;
  }
  return shelfDocs;
}

function renderLibraryShelf() {
  const grid = document.getElementById("libraryBookshelfGrid");
  const moreBtn = document.getElementById("libraryShowMoreBtn");
  if (!grid) return;

  const docs = getDocsForShelf(STATE.activeShelf, STATE.libraryQuery);
  STATE.currentShelfDocs = docs;
  const slice = docs.slice(0, STATE.libraryVisibleCount);

  if (!slice.length) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:2rem;color:#64748b;">No se encontraron documentos con ese filtro en este estante.</p>`;
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
                ? `<img src="${coverUrl}" alt="${escapeHtml(d.title)}" class="book-cover-img" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden');" />
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
          <button type="button" class="book-read-btn">Abrir lectura</button>
        </article>
      `;
    })
    .join("");

  if (moreBtn) {
    if (docs.length > STATE.libraryVisibleCount) {
      moreBtn.classList.remove("hidden");
      moreBtn.textContent = `Ver más documentos de este estante (${docs.length - STATE.libraryVisibleCount} restantes)`;
    } else {
      moreBtn.classList.add("hidden");
    }
  }
}

// ============================================================================
// MOTOR DE RESPUESTAS DOCUMENTALES (SERVIDOR LOCAL + NAVEGADOR WEB PUBLICO)
// ============================================================================
async function submitQuestion(queryText, options = {}) {
  const q = (queryText || "").trim();
  if (!q) return;

  // Al abrir una pregunta sugerida no se escribe en la barra: la barra queda
  // libre para buscar otra cosa y la pregunta elegida se muestra en el panel.
  const syncInput = options.syncInput === true;

  // Los fragmentos se necesitan para enriquecer respuestas, no para cargar la página.
  loadWebChunks();

  const acBox = document.getElementById("askAutocomplete");
  if (acBox) acBox.classList.add("hidden");

  const input = document.getElementById("askInput");
  const clearBtn = document.getElementById("clearAskBtn");
  if (syncInput && input) input.value = q;
  if (syncInput && clearBtn) clearBtn.classList.remove("hidden");

  const container = document.getElementById("answerContainer");
  const titleEl = document.getElementById("answerQuestionTitle");
  const bodyEl = document.getElementById("answerBody");
  const sourcesEl = document.getElementById("answerSourcesGrid");

  container.classList.remove("hidden");
  titleEl.textContent = q;
  bodyEl.innerHTML = `<p style="color:#6d28d9;font-weight:700;">Consultando los documentos oficiales...</p>`;
  sourcesEl.innerHTML = "";

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
        renderRelatedQuestions(q);
        container.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    } catch (_) {}
  }

  const ans = answerLocallyInBrowser(q);
  displayAnswer(ans);
  renderRelatedQuestions(q);
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildDocSpecificAnswerInBrowser(doc) {
  const lines = [
    `### ${doc.title} (${doc.year})`,
    `- **Archivo oficial:** \`${doc.filename}\``,
    `- **Categoría:** ${doc.category} • **Sección:** ${doc.section_label}`,
    `- **Formato:** ${doc.ext}${doc.page_count > 1 ? ` (${doc.page_count} páginas)` : ""}${doc.code ? ` • **Código oficial:** \`${doc.code}\`` : ""}`,
    ""
  ];
  if (doc.summary) {
    lines.push(`**Resumen del documento:**\n${doc.summary}\n`);
  }

  const docChunks = (STATE.webChunks || []).filter((c) => c[0] === doc.id).slice(0, 3);
  if (docChunks.length) {
    lines.push("**Contenido destacado extraído del documento oficial:**");
    for (const [, pStart, rawTxt] of docChunks) {
      const clean = String(rawTxt || "")
        .replace(/\[Pág\.\s*\d+\]\s*/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 420);
      if (clean) {
        lines.push(`- *(Pág. ${pStart})* ${clean}`);
      }
    }
  }
  return lines.join("\n");
}

function matchTopicsInBrowser(query) {
  const qNorm = normalizeStr(query);
  const qClean = qNorm.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const results = [];
  const seenTopicIds = new Set();

  const exactQ = STATE.qBankByNorm[qClean];
  if (exactQ && exactQ.topic_id && STATE.topicsById[exactQ.topic_id]) {
    const t = STATE.topicsById[exactQ.topic_id];
    results.push(t);
    seenTopicIds.add(t.id);
  }

  const scored = [];
  for (const topic of STATE.topics) {
    if (seenTopicIds.has(topic.id)) continue;
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
  if (scored.length) {
    const topScore = scored[0].score;
    results.push(scored[0].topic);
    if (scored.length > 1 && scored[1].score >= Math.max(8, topScore * 0.65)) {
      results.push(scored[1].topic);
    }
  }
  return results.slice(0, 2);
}

function findBestQuestionBankAnswer(query, tokens) {
  if (!tokens || tokens.length < 2 || !STATE.questionBank.length) return null;
  const qNorm = normalizeQuestionKey(query);
  let best = null;
  let bestScore = 0;

  for (const item of STATE.questionBank) {
    if (!item.ans) continue;
    const nq = normalizeQuestionKey(item.q || "");
    if (!nq) continue;
    let hits = 0;
    let score = 0;
    for (const tk of tokens) {
      if (nq.includes(tk)) {
        hits += 1;
        score += tk.length >= 5 ? 4 : 2;
      }
    }
    if (hits === tokens.length || (tokens.length >= 3 && hits >= tokens.length - 1)) {
      if (nq.includes(qNorm)) score += 15;
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
  }
  return bestScore >= 6 ? best : null;
}

function answerLocallyInBrowser(query) {
  const qClean = normalizeQuestionKey(query);
  const exactQ = STATE.qBankByNorm[qClean];

  if (exactQ && exactQ.ans) {
    const qSources = [];
    if (exactQ.doc_id && STATE.docsById[exactQ.doc_id]) {
      const doc = STATE.docsById[exactQ.doc_id];
      qSources.push({
        doc_id: doc.id,
        title: doc.title,
        filename: doc.filename,
        ext: doc.ext,
        year: doc.year,
        page_start: exactQ.page || 1
      });
    }
    return {
      query,
      answer_markdown: exactQ.ans,
      sources: qSources
    };
  }

  if (exactQ && exactQ.doc_id && STATE.docsById[exactQ.doc_id] && !exactQ.topic_id) {
    const doc = STATE.docsById[exactQ.doc_id];
    return {
      query,
      answer_markdown: buildDocSpecificAnswerInBrowser(doc),
      sources: [
        {
          doc_id: doc.id,
          title: doc.title,
          filename: doc.filename,
          ext: doc.ext,
          year: doc.year,
          page_start: exactQ.page || 1
        }
      ]
    };
  }

  const matchedTopics = matchTopicsInBrowser(query);
  const tokens = tokenizeQuery(query);

  if (!matchedTopics.length) {
    const bestQA = findBestQuestionBankAnswer(query, tokens);
    if (bestQA && bestQA.ans) {
      const qSources = [];
      if (bestQA.doc_id && STATE.docsById[bestQA.doc_id]) {
        const doc = STATE.docsById[bestQA.doc_id];
        qSources.push({
          doc_id: doc.id,
          title: doc.title,
          filename: doc.filename,
          ext: doc.ext,
          year: doc.year,
          page_start: bestQA.page || 1
        });
      }
      return {
        query,
        answer_markdown: bestQA.ans,
        sources: qSources
      };
    }
  }
  const sources = [];
  const seenIds = new Set();

  for (const t of matchedTopics) {
    for (const sf of t.source_files || []) {
      const d = findDocByFilename(sf);
      if (d && !seenIds.has(d.id) && String(d.ext || "").toUpperCase() !== "HTML") {
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

  const chunkMatches = [];
  if (STATE.webChunks && STATE.webChunks.length && tokens.length) {
    for (const entry of STATE.webChunks) {
      const [docId, pageStart, rawText] = entry;
      const d = STATE.docsById[docId];
      if (!d || String(d.ext || "").toUpperCase() === "HTML") continue;
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
      if (sc >= 3 && (tokens.length < 2 || coreHits >= Math.min(2, tokens.length))) {
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

  if (!sources.length && tokens.length) {
    const docScores = [];
    for (const d of STATE.documents) {
      const hay = normalizeStr(`${d.title} ${d.filename} ${d.summary || ""} ${d.category}`);
      let sc = 0;
      let docHits = 0;
      for (const tk of tokens) {
        if (hay.includes(tk)) {
          sc += 2;
          docHits += 1;
        }
        if (normalizeStr(d.title).includes(tk)) sc += 3;
      }
      if (sc >= 4 && (tokens.length < 2 || docHits >= Math.min(2, tokens.length))) {
        docScores.push({ sc, d });
      }
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
        "### Información no disponible en el acervo actual\n" +
        "No se encontró información suficiente sobre esta consulta específica dentro de los documentos oficiales respaldados en BiblioTech.\n\n" +
        `- **Reporte o aporte de documentos:** Si deseas que se agregue información oficial sobre este tema próximamente o cuentas con el documento emitido por la ASMAC o WOSM, puedes dejar tu solicitud (issue) o enviar el archivo al correo \`${STATE.contactEmail}\`.\n` +
        "- **Sugerencia:** También puedes explorar por sección o consultar temas como *«¿Dónde compro el uniforme scout?»*, *«Explicación del nuevo esquema PJOS 2026»*, *«¿Qué es la Comunidad de Caminantes?»* o *«¿Cómo funciona la resolución de problemas y conflictos?»*.",
      sources: []
    };
  }

  const topDoc = STATE.docsById[sources[0].doc_id];
  if (topDoc && sources.length === 1) {
    return {
      query,
      answer_markdown: buildDocSpecificAnswerInBrowser(topDoc),
      sources: sources.slice(0, 6)
    };
  }

  const lines = [
    `### Respuesta basada en «${sources[0].title}» (${sources[0].year})\n`,
    ...sources
      .slice(0, 3)
      .map((s) => `- **${s.title} (${s.year}):** ${s.excerpt || STATE.docsById[s.doc_id]?.summary || s.title}`)
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
    sourcesEl.innerHTML = `<span style="font-size:0.82rem;color:#64748b;">Consulta directa en el índice de documentos oficiales de BiblioTech.</span>`;
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

// Sugiere preguntas del banco que comparten tema con la consulta actual.
// Se muestran dentro del panel para seguir explorando sin volver a escribir.
function renderRelatedQuestions(query) {
  const wrap = document.getElementById("answerRelated");
  const chipsEl = document.getElementById("answerRelatedChips");
  if (!wrap || !chipsEl) return;

  const qKey = normalizeQuestionKey(query);
  const tokens = tokenizeQuery(query).filter((w) => w.length >= 3);
  const current = STATE.qBankByNorm[qKey];
  const currentCat = current ? current.cat : "";
  const currentDoc = current ? current.doc_id : "";
  const currentTopic = current ? current.topic_id : "";

  if (!STATE.questionBank.length) {
    // El banco se descarga en el primer clic; al terminar, se recalculan las
    // relacionadas si la misma pregunta sigue visible en el panel.
    loadQuestionBank().then((bank) => {
      if (!bank || !bank.length) return;
      const titleEl = document.getElementById("answerQuestionTitle");
      if (titleEl && normalizeQuestionKey(titleEl.textContent) === qKey) {
        renderRelatedQuestions(query);
      }
    });
    wrap.classList.add("hidden");
    chipsEl.innerHTML = "";
    return;
  }

  if (!tokens.length && !currentCat) {
    wrap.classList.add("hidden");
    chipsEl.innerHTML = "";
    return;
  }

  const queryNorm = normalizeStr(query);
  const scored = [];

  for (const item of STATE.questionBank) {
    const key = normalizeQuestionKey(item.q || "");
    if (!key || key === qKey) continue;
    if (!queryNorm.includes("falda") && normalizeStr(item.q || "").includes("falda")) continue;

    let hits = 0;
    let score = 0;
    for (const tk of tokens) {
      if (key.includes(tk)) {
        hits += 1;
        score += tk.length >= 5 ? 3 : 1;
      }
    }

    const sameTopic = Boolean(currentTopic && item.topic_id === currentTopic);
    const sameCat = Boolean(currentCat && item.cat === currentCat);
    if (!hits && !sameTopic && !sameCat) continue;

    // El topic_id agrupa preguntas del mismo tema aunque sus títulos no se
    // parezcan (por ejemplo, todos los nudos o todos los amarres).
    if (sameTopic) score += 10;
    if (sameCat) score += 3;
    if (currentDoc && item.doc_id === currentDoc) score += 6;
    if (!item.doc_id) score += 1;
    if (score <= 0) continue;

    scored.push({ score, item, key });
  }

  scored.sort((a, b) => b.score - a.score || a.item.q.localeCompare(b.item.q, "es"));

  const picked = [];
  const seen = new Set([qKey]);
  for (const entry of scored) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    picked.push(entry.item);
    if (picked.length >= 5) break;
  }

  if (!picked.length) {
    wrap.classList.add("hidden");
    chipsEl.innerHTML = "";
    return;
  }

  chipsEl.innerHTML = picked
    .map(
      (item) =>
        `<button type="button" class="quick-q-chip" data-query="${escapeHtml(item.q)}">${escapeHtml(item.q)}</button>`
    )
    .join("");
  wrap.classList.remove("hidden");
}

// ============================================================================
// CATALOGO GENERAL Y FILTROS (498 DOCUMENTOS DESCARGABLES)
// ============================================================================
function syncCategoryPillsUI() {
  document.querySelectorAll("#catalogCategoryPills .cat-filter-pill").forEach((btn) => {
    const val = btn.getAttribute("data-cat-val") || "all";
    btn.classList.toggle("active", val === STATE.categoryFilter);
  });
}

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
      return a.title.localeCompare(b.title, "es", { numeric: true });
    }
    if (STATE.sortOrder === "size") {
      return (b.size_bytes || 0) - (a.size_bytes || 0);
    }
    if (b.year !== a.year) return b.year - a.year;
    return String(b.date_sort || "").localeCompare(String(a.date_sort || ""));
  });

  STATE.filteredDocs = filtered;
  STATE.visibleCount = STATE.pageSize;
  syncCategoryPillsUI();
  renderCatalogGrid();
}

function renderCatalogGrid() {
  const grid = document.getElementById("catalogGrid");
  const countLabel = document.getElementById("catalogCountLabel");
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const resetBtn = document.getElementById("resetFiltersBtn");

  if (!grid) return;

  const total = STATE.filteredDocs.length;
  countLabel.textContent = `Mostrando ${Math.min(STATE.visibleCount, total)} de ${total} documentos oficiales`;

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
            <span style="font-size:0.74rem;color:#64748b;font-weight:600;">${escapeHtml(d.category)}</span>
            <div class="doc-actions">
              <button type="button" class="btn-doc-view" data-open-doc="${escapeHtml(d.id)}">Leer</button>
              <a href="${dlUrl}" download class="btn-doc-dl">Descargar</a>
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
        <img src="${viewUrl}" alt="${escapeHtml(doc.title)}" loading="lazy" decoding="async" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;" />
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
              ? `<img src="${coverUrl}" alt="${escapeHtml(doc.title)}" loading="lazy" decoding="async" style="width:110px;border-radius:10px;box-shadow:0 8px 20px rgba(0,0,0,0.15);" onerror="this.style.display='none'" />`
              : ""
          }
          <div style="flex:1;min-width:220px;">
            <span style="font-size:0.75rem;font-weight:800;color:#6d28d9;text-transform:uppercase;">MODO LECTURA LIBRE • ${escapeHtml(doc.section_label)}</span>
            <h2 style="font-size:1.4rem;color:#0c1938;margin:0.3rem 0;">${escapeHtml(doc.title)}</h2>
            <p style="font-size:0.84rem;color:#64748b;margin-bottom:0.85rem;">Archivo original: <code>${escapeHtml(doc.filename)}</code> (${doc.year})</p>
            <a href="${dlUrl}" download class="btn-modal-primary" style="display:inline-block;">Descargar archivo original (${escapeHtml(doc.ext)})</a>
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
  const acBox = document.getElementById("askAutocomplete");

  if (askForm) {
    askForm.addEventListener("submit", (e) => {
      e.preventDefault();
      loadQuestionBank();
      submitQuestion(askInput.value, { syncInput: true });
    });
  }

  if (askInput && clearAskBtn) {
    askInput.addEventListener("focus", () => {
      loadQuestionBank().then(() => {
        const val = askInput.value.trim();
        if (val.length >= 2) updateAutocompleteDropdown(val);
      });
    });
    askInput.addEventListener("input", () => {
      const val = askInput.value.trim();
      clearAskBtn.classList.toggle("hidden", !val);
      updateAutocompleteDropdown(val);
    });
    askInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && acBox) {
        acBox.classList.add("hidden");
      }
    });
    clearAskBtn.addEventListener("click", () => {
      askInput.value = "";
      clearAskBtn.classList.add("hidden");
      if (acBox) acBox.classList.add("hidden");
      askInput.focus();
    });
  }

  if (acBox) {
    acBox.addEventListener("click", (e) => {
      const item = e.target.closest("[data-ac-query]");
      if (!item) return;
      const q = item.getAttribute("data-ac-query");
      acBox.classList.add("hidden");
      submitQuestion(q, { syncInput: true });
    });
  }

  document.addEventListener("click", (e) => {
    if (acBox && !e.target.closest("#askForm") && !e.target.closest("#askAutocomplete")) {
      acBox.classList.add("hidden");
    }
  });

  document.querySelectorAll(".qcat-tab").forEach((tab) => {
    tab.addEventListener("click", async () => {
      document.querySelectorAll(".qcat-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      STATE.activeQCat = tab.getAttribute("data-qcat") || "Destacadas";
      await loadQuestionBank();
      renderExplorerQuestions(STATE.activeQCat, false);
    });
  });

  const shuffleBtn = document.getElementById("shuffleQuestionsBtn");
  if (shuffleBtn) {
    shuffleBtn.addEventListener("click", async () => {
      await loadQuestionBank();
      renderExplorerQuestions(STATE.activeQCat, true);
    });
  }

  document.querySelectorAll(".sec-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sec-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.activeAskSection = btn.dataset.section || "all";
    });
  });

  document.body.addEventListener("click", (e) => {
    const qBtn = e.target.closest("[data-query]");
    if (qBtn) {
      const q = qBtn.getAttribute("data-query");
      submitQuestion(q);
      return;
    }
    const openBtn = e.target.closest("[data-open-doc]");
    if (openBtn) {
      openDocumentModal(openBtn.getAttribute("data-open-doc"));
      return;
    }
    const shelfBtn = e.target.closest("[data-select-shelf]");
    if (shelfBtn) {
      const targetShelf = shelfBtn.getAttribute("data-select-shelf");
      document.querySelectorAll(".shelf-tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.shelf === targetShelf);
      });
      STATE.activeShelf = targetShelf;
      STATE.libraryVisibleCount = 24;
      renderLibraryShelf();
      document.getElementById("libraryShelfTabs")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  const closeAnsBtn = document.getElementById("closeAnswerBtn");
  if (closeAnsBtn) {
    closeAnsBtn.addEventListener("click", () => {
      document.getElementById("answerContainer").classList.add("hidden");
    });
  }

  const newSearchBtn = document.getElementById("newSearchBtn");
  if (newSearchBtn) {
    newSearchBtn.addEventListener("click", () => {
      const input = document.getElementById("askInput");
      const clearBtn = document.getElementById("clearAskBtn");
      const ac = document.getElementById("askAutocomplete");
      if (input) input.value = "";
      if (clearBtn) clearBtn.classList.add("hidden");
      if (ac) ac.classList.add("hidden");
      document.getElementById("answerContainer").classList.add("hidden");
      const searchSection = document.getElementById("buscador");
      if (searchSection) searchSection.scrollIntoView({ behavior: "smooth", block: "center" });
      if (input) setTimeout(() => input.focus({ preventScroll: true }), 380);
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

  const libSecSelect = document.getElementById("librarySectionFilter");
  if (libSecSelect) {
    libSecSelect.addEventListener("change", () => {
      STATE.librarySection = libSecSelect.value || "all";
      STATE.libraryVisibleCount = 12;
      renderLibraryShelf();
    });
  }

  const libScopeSelect = document.getElementById("libraryScopeSelect");
  if (libScopeSelect) {
    libScopeSelect.addEventListener("change", () => {
      STATE.libraryScope = libScopeSelect.value || "shelf";
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

  document.querySelectorAll("#catalogCategoryPills .cat-filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const val = pill.getAttribute("data-cat-val") || "all";
      STATE.categoryFilter = val;
      if (filterCat) filterCat.value = val;
      applyCatalogFilters();
    });
  });

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
  if (copyMailBtn) {
    copyMailBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(STATE.contactEmail);
      copyMailBtn.textContent = "Copiado";
      setTimeout(() => {
        copyMailBtn.textContent = "Copiar correo";
      }, 1800);
    });
  }
}

document.addEventListener("DOMContentLoaded", initApp);
