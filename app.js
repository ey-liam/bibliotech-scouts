// ============================================================================
// BiblioTech — Aplicacion Principal (Sitio Web Publico)
// Creador: Liam Duran - Provincia TLXH
// ============================================================================

const IS_LOCAL_SERVER = false;

const GITHUB_RELEASE_BASE =
  "https://github.com/ey-liam/bibliotech-scouts/releases/download/v1.0/";

const STATE = {
  catalog: null,
  spreadsheets: null,
  allDocuments: [],
  documents: [], // Documentos oficiales accesibles en Biblioteca y Catalogo (incluye guias HTML autonomas)
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

  // Biblioteca Scout interactiva (Lectura libre + filtro por seccion, subcategoria y alcance)
  activeShelf: "featured",
  libraryQuery: "",
  librarySection: "all",
  librarySubcategory: "all",
  librarySubcatOpen: false,
  libraryScope: "shelf",
  libraryVisibleCount: 6,
  currentShelfDocs: [],
  currentReadingIndex: -1,

  // Catalogo general
  filteredDocs: [],
  visibleCount: 6,
  pageSize: 12,
  searchQuery: "",
  categoryFilter: "all",
  subcategoryFilter: "all",
  catalogSubcatOpen: false,
  sectionFilter: "all",
  extFilter: "all",
  onlyLatest: false,
  sortOrder: "recent",

  // Contexto de la última respuesta mostrada y correo de contacto
  lastAnswerContext: null,
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
  if (doc.sha12) {
    if (doc.has_web_file) {
      return `files/${doc.sha12}.${extLow}`;
    }
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

// La primera pregunta puede llegar antes de que initApp termine de cargar el
// catálogo y la base de conocimiento. Esta promesa espera a que todo el estado
// necesario esté listo para responder sin conexión desde el primer intento.
let appReadyPromise = null;
let appReadyDone = false;
let resolveAppReady = null;

function waitForAppReady() {
  if (appReadyDone) return Promise.resolve();
  if (!appReadyPromise) {
    appReadyPromise = new Promise((resolve) => {
      resolveAppReady = resolve;
    });
  }
  return appReadyPromise;
}

function markAppReady() {
  appReadyDone = true;
  if (resolveAppReady) {
    resolveAppReady();
    resolveAppReady = null;
  }
}

function loadQuestionBank() {
  if (STATE.questionBank.length) return Promise.resolve(STATE.questionBank);
  if (questionBankPromise) return questionBankPromise;

  // El banco base y los bancos ampliados V3 y V4 se descargan en paralelo.
  // Si alguno de los adicionales falla, la página sigue funcionando con lo disponible.
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
    loadJsonBank("data/faq_v4.json"),
  ])
    .then(([baseData, v3Data, v4Data]) => {
      const base = (baseData && baseData.questions) || [];
      const extra = ((v3Data && v3Data.questions) || []).concat((v4Data && v4Data.questions) || []);
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
const IS_APPLE_TOUCH =
  /iPhone|iPad|iPod/i.test(navigator.userAgent || "") ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

let __activeDialogTrap = null;

function debounce(fn, delay = 120) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function getFocusableElements(root) {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null && !el.closest(".hidden"));
}

function activateDialogFocusTrap(dialogEl, initialFocusSelector) {
  if (!dialogEl) return;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (__activeDialogTrap && __activeDialogTrap.cleanup) __activeDialogTrap.cleanup();

  const onKeydown = (e) => {
    if (e.key !== "Tab") return;
    const focusables = getFocusableElements(dialogEl);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  dialogEl.addEventListener("keydown", onKeydown);
  __activeDialogTrap = {
    dialogEl,
    previousFocus,
    cleanup: () => dialogEl.removeEventListener("keydown", onKeydown),
  };

  const target = (initialFocusSelector && dialogEl.querySelector(initialFocusSelector)) || getFocusableElements(dialogEl)[0];
  if (target && typeof target.focus === "function") {
    requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }
}

function releaseDialogFocusTrap(dialogEl) {
  if (!__activeDialogTrap) return;
  if (dialogEl && __activeDialogTrap.dialogEl !== dialogEl) return;
  const prev = __activeDialogTrap.previousFocus;
  __activeDialogTrap.cleanup();
  __activeDialogTrap = null;
  if (prev && document.contains(prev) && typeof prev.focus === "function") {
    prev.focus({ preventScroll: true });
  }
}

async function initApp() {
  initPrivacyAndTelemetry();
  setupIosExperience();
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
    // Incluir documentos descargables y guias HTML autonomas legibles (is_readable_html)
    STATE.documents = STATE.allDocuments.filter(
      (d) => String(d.ext || "").toUpperCase() !== "HTML" || d.is_readable_html === true
    );
    const scopeOpt = document.querySelector('#libraryScopeSelect option[value="all"]');
    if (scopeOpt) scopeOpt.textContent = `Todos los estantes (${STATE.documents.length})`;
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

    // Registro de PWA Service Worker (solo en versión Web, fuera de Capacitor)
    if ("serviceWorker" in navigator && !window.Capacitor) {
      navigator.serviceWorker
        .register("sw.js", { updateViaCache: "none" })
        .then((reg) => reg && typeof reg.update === "function" && reg.update())
        .catch(() => {});
    }
  } catch (err) {
    console.error("Error cargando datos de BiblioTech:", err);
  } finally {
    markAppReady();
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

  const docEl = document.documentElement;
  if (!docEl.dataset.scrollAnimReady) {
    docEl.dataset.scrollAnimReady = "1";
  }

  // Barra flotante de acceso rapido + Scroll-Spy de navegacion
  const quickBar = document.getElementById("floatingQuickBar");
  const askFab = document.getElementById("floatingAskBtn");
  const topFab = document.getElementById("floatingTopBtn");
  const navLinks = Array.from(document.querySelectorAll(".main-nav .nav-link"));
  const spyIds = ["buscador", "guia-inicio", "biblioteca", "agentes", "secciones", "cambios", "explorar", "app"];

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

// ============================================================================
// EXPLORADOR DINAMICO DE LAS +5,412 PREGUNTAS + AUTOCOMPLETADO EN VIVO
// ============================================================================
const DEFAULT_FEATURED_QUESTIONS = [
  "¿En dónde encuentro un Grupo Scout?",
  "¿Cómo inscribo a mi hijo o hija en los Scouts, en dónde se registra y con quién tengo que hablar comúnmente del registro?",
  "¿Qué es el SISAS, qué es ExplorApp y qué es CarpetApp?",
  "¿En dónde puedo subir mis proyectos como Caminante (Agentes de Cambio.MX), cómo se hace un proyecto y qué formatos se necesitan?",
  "¿Qué es el CPRC y qué es el CNRC (Comité Nacional de la Red de Caminantes) y quiénes son sus integrantes actuales?",
  "¿Cómo se aplica el nuevo esquema PJOS y pueden combinarse las nuevas insignias con las antiguas?",
  "¿Dónde compro el uniforme scout?",
  "¿Qué es el Centro Scout o Campo Escuela Meztitla y dónde se ubica?",
  "¿Qué es la plataforma RECME y qué significan SCNCD y CNAMS?",
  "¿Qué es la Política Nacional A Salvo del Peligro?"
];

function renderExplorerQuestions(cat, shuffle = false) {
  const container = document.getElementById("dynamicQuestionsChips");
  if (!container) return;

  const isRandomAll = cat === "__RANDOM__";
  const count = 6;

  if (cat === "Destacadas" && !shuffle && (!STATE.activeAskSection || STATE.activeAskSection === "all")) {
    container.innerHTML = DEFAULT_FEATURED_QUESTIONS.slice(0, count)
      .map(
        (qText, idx) =>
          `<button type="button" class="quick-q-chip" style="animation-delay:${idx * 24}ms" data-query="${escapeHtml(qText)}">${escapeHtml(qText)}</button>`
      )
      .join("");
    return;
  }

  if (!STATE.questionBank.length) return;

  const activeSec = STATE.activeAskSection || "all";
  let pool = STATE.questionBank.filter((item) => {
    const nq = normalizeStr(item.q || "");
    if (!nq || nq.includes("falda")) return false;
    if (!isQuestionMatchingAskSection(item, activeSec)) return false;
    if (isRandomAll) return true;
    if (cat === "Destacadas") return !item.doc_id;
    return item.cat === cat;
  });

  if (!pool.length) {
    pool = STATE.questionBank.filter(
      (item) => !normalizeStr(item.q || "").includes("falda") && isQuestionMatchingAskSection(item, activeSec)
    );
  }
  if (!pool.length) {
    pool = STATE.questionBank.filter((item) => !normalizeStr(item.q || "").includes("falda"));
  }

  const selected = [];
  if (shuffle || isRandomAll) {
    // Muestreo aleatorio real sin repetir los elementos consecutivos
    const used = new Set();
    const triesMax = Math.min(pool.length * 3, 180);
    for (let t = 0; t < triesMax && selected.length < count; t++) {
      const idx = Math.floor(Math.random() * pool.length);
      const candidate = pool[idx];
      if (candidate && !used.has(candidate.q)) {
        used.add(candidate.q);
        selected.push(candidate);
      }
    }
  } else {
    const step = Math.max(1, Math.floor(pool.length / count));
    for (let i = 0; i < count && i < pool.length; i++) {
      const idx = (STATE.qShuffleOffset + i * step) % pool.length;
      const candidate = pool[idx];
      if (candidate && !selected.some((x) => x.q === candidate.q)) {
        selected.push(candidate);
      }
    }
  }

  container.innerHTML = selected
    .map(
      (item, idx) =>
        `<button type="button" class="quick-q-chip" style="animation-delay:${idx * 24}ms" data-query="${escapeHtml(item.q)}">${escapeHtml(item.q)}</button>`
    )
    .join("");
}

function isQuestionMatchingAskSection(item, targetSection) {
  if (!targetSection || targetSection === "all") return true;

  // 1. Si la pregunta tiene doc_id y el documento existe en catálogo
  if (item.doc_id && STATE.docsById[item.doc_id]) {
    const doc = STATE.docsById[item.doc_id];
    const applicable = doc.applicable_sections || (doc.section ? [doc.section] : []);
    if (applicable.includes(targetSection)) return true;
    if (doc.section && doc.section !== targetSection && doc.section !== "general") {
      return false;
    }
  }

  // 2. Mapeo directo por categoría de la pregunta
  const cat = item.cat || "";
  const catMap = {
    "Comunidad de Caminantes": "comunidad",
    "Tropa de Scouts": "tropa",
    "Manada de Lobatos": "manada",
    "Clan de Rovers": "clan",
    "Adultos y Scouters": "adultos",
    "World Scouting": "internacional",
    "Insignias Mundiales (WOSM)": "internacional"
  };
  if (catMap[cat]) {
    return catMap[cat] === targetSection;
  }

  // 3. Verificación de términos exclusivos de otra sección
  const qNorm = normalizeStr(item.q || "");
  const sectionKeywords = {
    manada: ["lobato", "lobatos", "lobata", "lobatas", "lobezno", "manada", "akela", "baloo", "bagheera", "viejo lobo"],
    tropa: ["tropa", "scout", "scouts", "patrulla", "patrullas", "guia de patrulla", "subguia", "alta patrulla"],
    comunidad: ["comunidad", "caminante", "caminantes", "cprc", "cnrc", "caravan", "expedicion", "escalamiento", "siempre adelante"],
    clan: ["clan", "rover", "rovers", "precursora", "precursoras", "precursor", "escudero", "horquilla", "servicio rover"],
    adultos: ["scouter", "scouters", "dirigente", "dirigentes", "jefe de grupo", "consejo de grupo", "comisionado"],
    internacional: ["wosm", "jamboree", "moot", "interamericano", "mundial"]
  };

  const targetKeywords = sectionKeywords[targetSection] || [];
  const hasTargetKw = targetKeywords.some((kw) => qNorm.includes(kw));

  for (const [sec, kws] of Object.entries(sectionKeywords)) {
    if (sec !== targetSection && kws.some((kw) => qNorm.includes(kw))) {
      if (!hasTargetKw) return false;
    }
  }

  return true;
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

    // Si el usuario seleccionó una sección en el buscador, no mostrar sugerencias de otras secciones
    if (STATE.activeAskSection && STATE.activeAskSection !== "all") {
      if (!isQuestionMatchingAskSection(item, STATE.activeAskSection)) {
        continue;
      }
    }

    let score = 0;
    // Bonificación de relevancia si coincide específicamente con la sección activa
    if (STATE.activeAskSection && STATE.activeAskSection !== "all") {
      const catSec = {
        "Comunidad de Caminantes": "comunidad",
        "Tropa de Scouts": "tropa",
        "Manada de Lobatos": "manada",
        "Clan de Rovers": "clan",
        "Insignias Mundiales (WOSM)": "internacional"
      }[item.cat];
      if (catSec === STATE.activeAskSection) score += 20;
    }
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
    "Especialidades Scouts (FES)",
    "Plantillas PJOS, FAES y RECME",
    "Guías SISAS, CONECTA y Soporte Digital",
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
// APARTADO DE BIBLIOTECA INTERACTIVA POR LAS 11 CATEGORIAS Y SUBCATEGORIAS
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
        "P9.3_Formato_de_solicitud_de_IF_CC_v2.pdf",
        "P3.3.2_PasaporteComunidad_v1.1.pdf",
        "P3.4_MapaRutas_v1.1.pdf",
        "FES_CC_SYB_PRIMEROS AUXILIOS AGRESTES.pdf",
        "Directorio_Help_Desk_ASMAC_Tickets_y_KB.html",
        "REGLAMENTO 2023.pdf",
        "Estatutos 2023.pdf",
        "010 Guia Red de Caminantes.pdf",
        "Guía Punta de Flecha_2025-COMUNIDAD.pdf",
        "Política Diversidad, Equidad e Inclusion 2024.pdf",
        "CODIGO DE CONDUCTA 2025.pdf",
        "Manual del Pie Tierno.pdf",
        "Escultismo para Muchachos.pdf",
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
        } else if ((d.ext === "PDF" || d.is_readable_html) && d.is_latest_in_family !== false) {
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
    case "especialidades_fes":
      return list.filter((d) => d.category === "Especialidades Scouts (FES)");
    case "plantillas_recme":
      return list.filter((d) => d.category === "Plantillas PJOS, FAES y RECME");
    case "soporte_sisas":
      return list.filter((d) => d.category === "Guías SISAS, CONECTA y Soporte Digital");
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

function renderSubcategoryPills(containerId, docsPool, activeSub, isOpen, onToggleOpen, onSelect) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const counts = {};
  for (const d of docsPool) {
    if (d.subcategory) counts[d.subcategory] = (counts[d.subcategory] || 0) + 1;
  }
  const subs = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  if (subs.length <= 1) {
    wrap.innerHTML = "";
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  const hasActive = activeSub && activeSub !== "all";
  wrap.innerHTML = `
    <div class="subcat-toggle-row">
      <button type="button" class="btn-subcat-toggle" aria-expanded="${isOpen ? "true" : "false"}">
        <span>Subcategorías</span>
        <span class="subcat-count-badge">${subs.length}</span>
        <svg class="subcat-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      ${hasActive ? `<button type="button" class="subcat-active-chip" title="Quitar filtro de subcategoría"><span>${escapeHtml(activeSub)}</span><span aria-hidden="true">×</span></button>` : ""}
    </div>
    <div class="subcat-drawer-panel${isOpen ? "" : " hidden"}" role="group" aria-label="Subcategorías disponibles">
      <button type="button" class="subcat-pill${!hasActive ? " active" : ""}" data-sub="all">Todas (${docsPool.length})</button>
      ${subs
        .map(
          ([sub, cnt]) =>
            `<button type="button" class="subcat-pill${activeSub === sub ? " active" : ""}" data-sub="${escapeHtml(sub)}">${escapeHtml(sub)} (${cnt})</button>`
        )
        .join("")}
    </div>
  `;
  const toggleBtn = wrap.querySelector(".btn-subcat-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => onToggleOpen(!isOpen));
  }
  const clearChip = wrap.querySelector(".subcat-active-chip");
  if (clearChip) {
    clearChip.addEventListener("click", () => onSelect("all"));
  }
  wrap.querySelectorAll(".subcat-pill").forEach((btn) => {
    btn.addEventListener("click", () => onSelect(btn.getAttribute("data-sub") || "all"));
  });
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
      const hay = normalizeStr(`${d.title} ${d.filename} ${d.category} ${d.subcategory || ""} ${d.section_label} ${d.summary || ""} ${d.code || ""}`);
      for (const tk of tokens) {
        if (!hay.includes(tk)) return false;
      }
    }
    return true;
  });

  let baseDocs = scope === "all" ? readable : filterDocsByShelfName(readable, shelf);
  if (scope !== "all" && tokens.length && !baseDocs.length && readable.length) {
    baseDocs = readable;
  }

  renderSubcategoryPills(
    "librarySubcategoryPills",
    baseDocs,
    STATE.librarySubcategory,
    STATE.librarySubcatOpen,
    (nextOpen) => {
      STATE.librarySubcatOpen = nextOpen;
      renderLibraryShelf();
    },
    (sub) => {
      STATE.librarySubcategory = sub;
      STATE.libraryVisibleCount = resolveDefaultLibraryCount();
      renderLibraryShelf();
    }
  );

  if (STATE.librarySubcategory && STATE.librarySubcategory !== "all") {
    const subFiltered = baseDocs.filter((d) => d.subcategory === STATE.librarySubcategory);
    if (subFiltered.length) return subFiltered;
  }
  return baseDocs;
}

function resolveDefaultLibraryCount() {
  if (STATE.libraryQuery.trim() !== "") return Infinity;
  const isDefaultView =
    STATE.activeShelf === "featured" &&
    STATE.librarySection === "all" &&
    STATE.librarySubcategory === "all" &&
    STATE.libraryScope === "shelf";
  return isDefaultView ? 6 : 24;
}

function renderLibraryShelf() {
  const grid = document.getElementById("libraryBookshelfGrid");
  const moreBtn = document.getElementById("libraryShowMoreBtn");
  if (!grid) return;

  const docs = getDocsForShelf(STATE.activeShelf, STATE.libraryQuery);
  STATE.currentShelfDocs = docs;
  const visibleLimit = STATE.libraryQuery.trim() !== "" ? docs.length : STATE.libraryVisibleCount;
  const slice = docs.slice(0, visibleLimit);

  if (!slice.length) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:2rem;color:#64748b;">No se encontraron documentos con ese filtro en este estante.</p>`;
    if (moreBtn) moreBtn.classList.add("hidden");
    return;
  }

  grid.innerHTML = slice
    .map((d, idx) => {
      const coverUrl = d.sha12 ? `covers/${d.sha12}.jpg` : "";
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
          <span class="book-meta">${escapeHtml(d.section_label)}${d.subcategory ? ` · ${escapeHtml(d.subcategory)}` : ""}</span>
          ${d.summary ? `<p class="book-desc">${escapeHtml(d.summary)}</p>` : ''}
          <button type="button" class="book-read-btn">Abrir lectura</button>
        </article>
      `;
    })
    .join("");

  if (moreBtn) {
    if (docs.length > visibleLimit) {
      moreBtn.classList.remove("hidden");
      moreBtn.textContent = `Ver más documentos de este estante (${docs.length - visibleLimit} restantes)`;
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
  const querySource = options.source || (syncInput ? "manual" : "sugerencia");

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
        displayAnswer(data, q);
        renderRelatedQuestions(q);
        recordQueryTelemetry(q, data, querySource);
        container.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    } catch (_) {}
  }

  // El banco, los fragmentos y el catálogo se cargan en el primer toque. La
  // respuesta puede llegar antes de que terminen de descargarse; esperamos aquí
  // para que la primera pregunta también funcione sin conexión y con todas las
  // fuentes, incluso si se hace justo al abrir la app.
  try {
    await Promise.all([waitForAppReady(), loadQuestionBank(), loadWebChunks()]);
  } catch (_) {}

  const ans = answerLocallyInBrowser(q);
  displayAnswer(ans, q);
  renderRelatedQuestions(q);
  recordQueryTelemetry(q, ans, querySource);
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

// ============================================================================
// MOTOR DE RESPUESTAS DIRECTAS
// ----------------------------------------------------------------------------
// El banco tiene miles de preguntas generadas a partir de documentos. Muchas
// describen un archivo («¿De qué trata…?») y no responden a una duda real. Este
// motor prioriza respuestas concretas: primero una pregunta del banco cuya
// respuesta cubra la consulta; después un tema curado del que se extrae el
// bloque y la frase que mejor responden. Las listas de documentos quedan como
// último recurso.
// ============================================================================

const ENGINE_STOPWORDS = new Set([
  ...STOPWORDS_ES,
  "hacer", "hago", "hacerlo", "hace", "hacen", "debo", "debe", "deben",
  "alguien", "algo", "cosa", "cosas", "pasa", "pasar", "cuanto", "cuanta",
  "cuantos", "cuantas", "ser", "soy", "eres", "somos", "son", "esta", "estan",
  "aqui", "alli", "entonces", "asi", "solo", "sola", "solo", "cada", "vez",
  "hacia", "durante", "antes", "despues", "siempre", "nunca", "caso", "casos"
]);

const SYNONYMS = {
  inscribir: ["inscripcion", "registro", "registrar", "integrar", "ingresar", "unir", "unirme"],
  inscribirme: ["inscripcion", "registro", "registrar", "integrar", "ingresar", "unir"],
  inscribo: ["inscripcion", "registro", "registrar", "integrar", "ingresar", "unir"],
  inscriba: ["inscripcion", "registro", "registrar", "integrar", "ingresar", "unir"],
  inscribirse: ["inscripcion", "registro", "registrar", "integrar", "ingresar", "unir"],
  inscripcion: ["inscribir", "registro", "registrar", "integrar", "ingresar"],
  registro: ["inscripcion", "inscribir", "registrar", "integrar"],
  registrarme: ["inscripcion", "inscribir", "registro", "registrar"],
  registrar: ["inscripcion", "inscribir", "registro"],
  integrarme: ["inscripcion", "inscribir", "registro", "unir", "ingresar"],
  integrar: ["inscripcion", "inscribir", "registro", "unir", "ingresar"],
  integro: ["inscripcion", "inscribir", "registro", "unir", "ingresar"],
  unirme: ["inscripcion", "inscribir", "registro", "integrar"],
  unir: ["inscripcion", "inscribir", "registro", "integrar"],
  ingresar: ["inscripcion", "inscribir", "registro", "integrar"],
  entrar: ["inscripcion", "inscribir", "registro", "integrar"],
  requisito: ["documentacion", "documento", "necesita", "autorizacion", "ficha"],
  requisitos: ["documentacion", "documento", "necesita", "autorizacion", "ficha"],
  documentacion: ["requisito", "autorizacion", "ficha", "registro"],
  documento: ["documentacion", "requisito", "autorizacion", "ficha"],
  documentos: ["documentacion", "requisito", "autorizacion", "ficha"],
  lastimar: ["accidente", "emergencia", "herida", "lesion", "primeros auxilios", "urgencia"],
  lastima: ["accidente", "emergencia", "herida", "lesion", "primeros auxilios", "urgencia"],
  lastimo: ["accidente", "emergencia", "herida", "lesion", "primeros auxilios", "urgencia"],
  lastimado: ["accidente", "emergencia", "herida", "lesion", "primeros auxilios"],
  lesion: ["accidente", "emergencia", "herida", "lastimar", "primeros auxilios"],
  lesionado: ["accidente", "emergencia", "herida", "lastimar", "primeros auxilios"],
  accidente: ["emergencia", "herida", "lesion", "seguro", "siniestro", "lastimar"],
  accidenta: ["emergencia", "herida", "lesion", "seguro", "siniestro", "lastimar"],
  accidentar: ["emergencia", "herida", "lesion", "seguro", "siniestro", "lastimar"],
  accidento: ["emergencia", "herida", "lesion", "seguro", "siniestro", "lastimar"],
  accidentado: ["emergencia", "herida", "lesion", "seguro", "siniestro", "lastimar"],
  lesiona: ["accidente", "emergencia", "herida", "lastimar", "primeros auxilios"],
  lesionar: ["accidente", "emergencia", "herida", "lastimar", "primeros auxilios"],
  lastimarse: ["accidente", "emergencia", "herida", "lesion", "primeros auxilios"],
  lastimaron: ["accidente", "emergencia", "herida", "lesion", "primeros auxilios"],
  emergencia: ["accidente", "primeros auxilios", "urgencia", "lastimar"],
  herida: ["accidente", "lesion", "primeros auxilios"],
  herido: ["accidente", "lesion", "primeros auxilios"],
  campamento: ["acampar", "campismo"],
  acampar: ["campamento", "campismo"],
  campismo: ["campamento", "acampar"],
  cuota: ["costo", "precio", "membresia", "pago"],
  costo: ["cuota", "precio", "membresia"],
  precio: ["cuota", "costo", "membresia"],
  membresia: ["cuota", "costo", "registro", "pago"],
  uniforme: ["camisola", "insignia", "prenda", "vestimenta"],
  camisola: ["uniforme", "prenda"],
  insignia: ["uniforme", "distintivo"],
  dirigente: ["scouter", "jefe", "adulto"],
  scouter: ["dirigente", "jefe", "adulto"],
  jefe: ["dirigente", "scouter"],
  hijo: ["menor", "nino", "nina", "familia"],
  hija: ["menor", "nino", "nina", "familia"],
  nino: ["menor", "hijo", "familia"],
  nina: ["menor", "hija", "familia"],
  edad: ["edades", "anos", "rango", "seccion"],
  edades: ["edad", "anos", "rango", "seccion"],
  seccion: ["secciones", "edad", "rango"],
  secciones: ["seccion", "edad", "rango"],
  seguro: ["poliza", "accidente", "siniestro", "cobertura"],
  poliza: ["seguro", "cobertura"],
  cobertura: ["seguro", "poliza"],
  siniestro: ["seguro", "accidente"],
  ficha: ["salud", "medica", "documento"],
  salud: ["ficha", "medica", "seguro"],
  caminantes: ["comunidad", "red", "cnrc", "aventura", "senderos"],
  comunidad: ["caminantes", "red", "everest"],
  manada: ["lobatos", "lobellas", "seisena", "akela", "selva"],
  tropa: ["scouts", "patrulla", "guia", "rumbos"],
  clan: ["rovers", "servicio", "horquilla", "rutas", "ppv"],
  agentes: ["cambio", "cnrc", "ods", "proyectos", "salud", "sustentabilidad", "paz", "habilidades"],
  promesa: ["ley", "principios", "virtudes", "flor", "lis", "investidura"]
};

const PHRASE_SYNONYMS = [
  { rx: /\bser scout\b|\bquiero ser scout\b|\bcomo ser scout\b|\bpara ser scout\b/, add: ["inscripcion", "registro", "integrar", "requisito"] },
  { rx: /\bme lastime\b|\bse lastimo\b|\bse lastima\b|\bse lesiona\b|\bse hirio\b|\bse accidento\b|\bse accidenta\b|\bse accidente\b/, add: ["emergencia", "accidente", "primeros auxilios", "herida"] },
  { rx: /\bprimeros auxilios\b|\bprimer respondiente\b/, add: ["emergencia", "accidente"] },
  { rx: /\bcuanto cuesta\b|\bcuanto sale\b|\bprecio\b|\bcosto\b/, add: ["cuota", "membresia"] },
  { rx: /\bas de guia\b/, add: ["nudo", "cuerda"] },
  { rx: /\bjefe de grupo\b/, add: ["dirigente", "grupo"] },
  { rx: /\bdocumentos?\b|\brequisitos?\b/, add: ["documentacion", "autorizacion", "ficha", "registro"] },
  { rx: /\bagentes de cambio\b|\bred de caminantes\b/, add: ["cnrc", "proyectos", "salud", "sustentabilidad", "paz", "habilidades"] }
];

function expandScoutQueryTokens(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    if (SYNONYMS[token]) {
      for (const syn of SYNONYMS[token]) {
        syn.split(/\s+/).forEach((w) => expanded.add(canonicalToken(w)));
      }
    }
  }
  return Array.from(expanded).filter(Boolean);
}

function canonicalToken(word) {
  let x = normalizeStr(word).replace(/[^a-z0-9]/g, "");
  if (!x) return "";
  if (x.length > 5 && (x.endsWith("me") || x.endsWith("te") || x.endsWith("se"))) {
    const stem = x.slice(0, -2);
    if (/(ar|er|ir)$/.test(stem)) x = stem;
  }
  if (x.length > 5 && x.endsWith("ciones")) x = x.slice(0, -5) + "cion";
  else if (x.length > 4 && x.endsWith("es")) x = x.slice(0, -2);
  else if (x.length > 3 && x.endsWith("s")) x = x.slice(0, -1);
  if (x.length > 5 && x.endsWith("ando")) x = x.slice(0, -4);
  if (x.length > 5 && x.endsWith("iendo")) x = x.slice(0, -5);
  return x;
}

function tokenVariants(word) {
  const raw = normalizeStr(word).replace(/[^a-z0-9]/g, "");
  if (!raw) return [];
  const out = new Set([raw]);
  const canonical = canonicalToken(raw);
  if (canonical) out.add(canonical);
  if (raw.length > 4 && raw.endsWith("es")) out.add(raw.slice(0, -1));
  if (raw.length > 3 && raw.endsWith("s")) out.add(raw.slice(0, -1));
  return [...out];
}

function baseTokenSet(text) {
  const rawLower = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const all = normalizeStr(text).match(/[a-z0-9]{2,}/g) || [];
  const filtered = all.filter((w) => !ENGINE_STOPWORDS.has(w));
  const words = filtered.length ? filtered : all;
  const set = new Set();
  for (const word of words) for (const variant of tokenVariants(word)) set.add(variant);
  // Preservar códigos con punto o guion como P6.2, P9.4, JSN 25.009, v1.1 para no colisionar P6.1 con P6.2
  const compoundCodes = rawLower.match(/\b(?:[a-z]{1,4}\s*)?\d+(?:[._-]\d+)+\b|\b[a-z]+\d+(?:[._-]\d+)+\b/g) || [];
  for (const code of compoundCodes) {
    const joined = code.replace(/[^a-z0-9]/g, "");
    if (joined.length >= 2) set.add(joined);
  }
  return set;
}

function expandTokenSet(text) {
  const set = new Set(baseTokenSet(text));
  for (const token of [...set]) {
    const direct = Object.prototype.hasOwnProperty.call(SYNONYMS, token) ? SYNONYMS[token] : [];
    for (const synonym of direct) for (const variant of tokenVariants(synonym)) set.add(variant);
  }
  const normalized = normalizeQuestionKey(text);
  for (const phrase of PHRASE_SYNONYMS) {
    if (phrase.rx.test(normalized)) {
      for (const synonym of phrase.add) for (const variant of tokenVariants(synonym)) set.add(variant);
    }
  }
  return set;
}

function isGenericDocQuestion(question) {
  const normalized = normalizeQuestionKey(question);
  return /^(de que trata|que informacion oficial publica|que requisitos fechas|que especifica la pagina|que informacion contiene|que dice la pagina|que requisitos, fechas)/.test(normalized) ||
    (/«/.test(question) && /(de que trata|informacion oficial|que especifica|que requisitos)/.test(normalized));
}

let bankIndexCache = null;

function getBankIndex() {
  if (bankIndexCache && bankIndexCache.length === STATE.questionBank.length) return bankIndexCache;
  bankIndexCache = STATE.questionBank.map((item) => ({
    ...item,
    _nq: normalizeQuestionKey(item.q || ""),
    _base: baseTokenSet(item.q || ""),
    _search: expandTokenSet(item.q || ""),
    _answer: null
  }));
  return bankIndexCache;
}

function rankQuestionBank(query) {
  if (!STATE.questionBank.length) return { item: null, score: 0, coverage: 0, bodyCoverage: 0 };
  const qSet = expandTokenSet(query);
  const qNorm = normalizeQuestionKey(query);
  const qTokens = [...qSet];
  const bank = getBankIndex();
  let best = null;
  let bestScore = 0;
  let bestCoverage = 0;
  let bestBody = 0;

  for (const item of bank) {
    if (!item.ans || !item._nq) continue;
    if (isGenericDocQuestion(item.q)) continue;
    let hits = 0;
    for (const token of qTokens) if (item._search.has(token)) hits++;
    if (!hits) continue;
    const coverage = hits / Math.max(1, qSet.size);
    if (coverage < 0.55 && !(qSet.size > 5 && hits >= 3)) continue;
    const exact = item._nq === qNorm || item._nq.includes(qNorm) || qNorm.includes(item._nq);
    if (hits < 2 && !(qSet.size === 1 && hits === 1 && exact)) continue;

    // La respuesta se tokeniza solo para los candidatos que ya coinciden con la
    // pregunta. Así el índice inicial sigue siendo ligero en el teléfono.
    const answerTokens = item._answer || (item._answer = expandTokenSet(item.ans || ""));
    let bodyHits = 0;
    for (const token of qTokens) if (answerTokens.has(token)) bodyHits++;
    const bodyCoverage = bodyHits / Math.max(1, qSet.size);
    const itemCoverage = hits / Math.max(1, item._base.size);

    let score = coverage * 60 + itemCoverage * 15 + bodyCoverage * 24 + hits * 4;
    if (exact) score += 30;
    if (item.doc_id) score += 2;
    if (item.topic_id) score += 3;
    if (item.cat) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = item;
      bestCoverage = coverage;
      bestBody = bodyCoverage;
    }
  }
  return { item: best, score: bestScore, coverage: bestCoverage, bodyCoverage: bestBody };
}

function splitTopicSections(content) {
  const lines = String(content || "").split("\n");
  let title = "";
  let start = 0;
  const first = (lines[0] || "").match(/^#{2,4}\s+(.+)$/);
  if (first) {
    title = first[1].trim();
    start = 1;
  }
  const intro = [];
  const sections = [];
  let current = null;
  const headingRx = /^(#{2,4})\s+(.+)$/;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(headingRx);
    if (heading) {
      if (current) sections.push(current);
      current = { heading: line.trim(), lines: [line] };
    } else if (current) {
      current.lines.push(line);
    } else {
      intro.push(line);
    }
  }
  if (current) sections.push(current);
  const usable = sections
    .map((section) => ({ heading: section.heading, text: section.lines.join("\n").trim() }))
    .filter((section) => section.text.replace(/^#{2,4}\s+.+$/m, "").trim().length > 0);
  return { title, intro: intro.join("\n").trim(), sections: usable };
}

function prepareTopic(topic) {
  if (topic._sections) return topic;
  const { title, intro, sections } = splitTopicSections(topic.content);
  topic._intro = intro || (title ? `**${title}**` : "");
  topic._sections = sections.map((section) => ({
    text: section.text,
    heading: section.heading,
    headingTokens: expandTokenSet(section.heading),
    tokens: expandTokenSet(section.text)
  }));
  const frequencies = new Map();
  for (const section of topic._sections) {
    const seen = new Set();
    for (const token of section.tokens) {
      if (token.length < 3 || seen.has(token)) continue;
      seen.add(token);
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    }
  }
  topic._df = frequencies;
  topic._titleTokens = expandTokenSet(`${topic.title || ""} ${topic.id || ""}`);
  return topic;
}

function scoreTopic(topic, qSet, qNorm) {
  let score = 0;
  for (const pattern of topic.patterns || []) {
    try {
      if (new RegExp(pattern, "i").test(qNorm)) score += 30;
    } catch (_) {}
  }
  for (const keyword of topic.keywords || []) {
    const normalized = normalizeQuestionKey(keyword);
    if (!normalized) continue;
    const core = [...baseTokenSet(keyword)].filter((token) => token.length >= 3);
    if (!core.length) continue;
    if (core.length > 1 && qNorm.includes(normalized)) {
      score += 10 + Math.min(6, core.length * 2);
      continue;
    }
    let hits = 0;
    for (const token of core) if (qSet.has(token)) hits++;
    if (hits === core.length) score += core.length >= 2 ? 8 : 6;
  }
  const titleTokens = topic._titleTokens || (topic._titleTokens = expandTokenSet(`${topic.title || ""} ${topic.id || ""}`));
  let titleHits = 0;
  for (const token of titleTokens) if (qSet.has(token) && token.length >= 3) titleHits++;
  score += Math.min(12, titleHits * 3);

  // Preguntas de definición («¿Qué es…?», «¿Qué hace…?») valoran los términos
  // que el tema destaca en negritas al inicio de sus viñetas.
  if (/^(que hace|que es|que significa|quien es|quienes son)\b/.test(qNorm)) {
    if (!topic._bold) {
      topic._bold = [...String(topic.content || "").matchAll(/\*\*([^*]{3,90})\*\*/g)]
        .map((match) => expandTokenSet(match[1]))
        .slice(0, 30);
    }
    let definitionBoost = 0;
    for (const bold of topic._bold) {
      let hits = 0;
      for (const token of qSet) if (bold.has(token) && token.length >= 3) hits++;
      if (hits >= 2) definitionBoost = 7;
    }
    score += definitionBoost;
  }
  return score;
}

function rankTopics(query) {
  const qSet = expandTokenSet(query);
  const qNorm = normalizeQuestionKey(query);
  const ranked = [];
  for (const topic of STATE.topics) {
    const score = scoreTopic(topic, qSet, qNorm);
    if (score > 0) ranked.push({ topic, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function matchTopicsInBrowser(query) {
  return rankTopics(query).slice(0, 2).map((entry) => entry.topic);
}

function phraseLine(excerpt, query) {
  const queryWords = normalizeStr(query).match(/[a-z0-9]{2,}/g) || [];
  const generic = new Set(["scout", "scouts", "scoutismo", "escultismo", "movimiento"]);
  const primary = queryWords.filter(
    (word) => word.length >= 4 && !ENGINE_STOPWORDS.has(word) && !generic.has(word)
  );
  const grams = [];
  for (let size = 3; size >= 2; size--) {
    for (let i = 0; i + size <= queryWords.length; i++) {
      const parts = queryWords.slice(i, i + size);
      if (!parts.some((word) => word.length >= 3 && !ENGINE_STOPWORDS.has(word) && !generic.has(word))) continue;
      grams.push(parts.join(" "));
    }
  }
  if (!grams.length || !primary.length) return null;
  const querySet = expandTokenSet(query);
  let best = null;
  for (const raw of String(excerpt || "").split("\n")) {
    const line = raw.trim();
    if (!line || /^#{2,4}\s/.test(line) || line.length < 35) continue;
    const normalized = normalizeQuestionKey(line);
    let primaryHits = 0;
    for (const word of primary) if (normalized.includes(word)) primaryHits++;
    if (!primaryHits) continue;
    let score = primaryHits * 2;
    for (const gram of grams) if (normalized.includes(gram)) score += gram.split(" ").length;
    const definition = line.match(/^[-*]?\s*\*\*([^*]{3,90}):\*\*/);
    if (definition) {
      const head = expandTokenSet(definition[1]);
      let headHits = 0;
      for (const token of querySet) if (head.has(token) && token.length >= 3) headHits++;
      if (headHits >= 2) score += 6;
    }
    if (score >= 4 && (!best || score > best.score)) best = { line, score };
  }
  return best;
}

function trimSection(text, maxChars) {
  const clean = String(text || "").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= maxChars) return clean;
  const lines = clean.split("\n");
  let out = "";
  for (const line of lines) {
    if ((out + "\n" + line).length > maxChars) break;
    out += (out ? "\n" : "") + line;
  }
  if (out) return out.trim();
  const cut = clean.slice(0, maxChars);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"), cut.lastIndexOf("; "));
  return (lastStop > maxChars * 0.55 ? cut.slice(0, lastStop + 1) : cut).trim() + "…";
}

function buildTopicAnswer(topic, query, maxChars = 1500) {
  prepareTopic(topic);
  const qSet = expandTokenSet(query);
  const qNorm = normalizeQuestionKey(query);
  const wantsDocs = /\b(document\w*|requisito\w*|papel\w*|permiso\w*|autorizacion|ficha)\b/.test(qNorm);
  const wantsPrice = /\b(cuesta|precio|costo|cuota|membresia|pago)\b/.test(qNorm);
  const wantsSteps = /\b(pasos|procedimiento|proceso|inscrip|registro|como)\b/.test(qNorm);
  const wantsWhere = /\b(donde|direccion|ubicacion|tienda|portal|sitio)\b/.test(qNorm);
  const scored = topic._sections.map((section) => {
    let hits = 0;
    let weight = 0;
    const total = Math.max(1, topic._sections.length);
    for (const token of qSet) {
      if (!section.tokens.has(token) || token.length < 3) continue;
      hits++;
      const frequency = topic._df.get(token) || 1;
      weight += 1 + Math.log((total + 1) / (frequency + 1));
    }
    let headingWeight = 0;
    for (const token of qSet) {
      if (!section.headingTokens.has(token) || token.length < 3) continue;
      const frequency = topic._df.get(token) || 1;
      headingWeight += (1 + Math.log((total + 1) / (frequency + 1))) * 1.8;
    }
    const body = normalizeQuestionKey(section.text);
    let boost = 0;
    if (wantsDocs && /(document|autoriz|ficha|permiso|acta|curp|codigo de conducta)/.test(body)) boost += 14;
    if (wantsPrice && /(\$|cuota|precio|costo|membresia|pago)/.test(body)) boost += 10;
    if (wantsSteps && /(pasos|procedimiento|proceso|inscrip|registro)/.test(normalizeQuestionKey(section.heading))) boost += 6;
    if (wantsWhere && /(donde|direccion|ubicacion|tienda|portal|sitio)/.test(body)) boost += 6;
    return { section, hits, score: weight + headingWeight + boost };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] && scored[0].hits > 0 ? scored[0] : null;
  const intro = topic._intro && !/^#{2,4}\s/.test(topic._intro) ? topic._intro : "";
  let out = intro;
  if (best) {
    if (out) out += "\n\n";
    out += best.section.text;
  } else if (!out && topic._sections.length) {
    out = topic._sections[0].text;
  }
  if (!out) out = topic.content || "";
  if (best && best.hits <= 1 && scored[1] && scored[1].hits > 1 && out.length < 900) {
    out += "\n\n" + scored[1].section.text;
  }
  out = trimSection(out, maxChars);
  const phrase = phraseLine(out, query);
  if (phrase && out.indexOf(phrase.line) > 80 && !(/\$/.test(phrase.line) && !wantsPrice)) {
    const withoutPhrase = out
      .split("\n")
      .filter((line) => line.trim() !== phrase.line.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    out = `**En concreto:** ${phrase.line}\n\n${withoutPhrase}`;
  }
  return out;
}

function buildAnswerLocally(query) {
  const qNorm = normalizeQuestionKey(query);
  const bank = getBankIndex();
  const exact = bank.find((item) => item._nq === qNorm);
  if (exact && exact.ans && !isGenericDocQuestion(exact.q)) {
    return { kind: "exact", text: exact.ans, item: exact };
  }

  const topicRank = rankTopics(query);
  const qa = rankQuestionBank(query);
  const top = topicRank[0];
  const second = topicRank[1];
  const topicScore = top ? top.score : 0;
  const qaCoverage = qa.item ? qa.coverage : 0;

  if (qa.item && qaCoverage >= 0.92 && topicScore < 30) {
    return { kind: "qa", text: qa.item.ans, item: qa.item, qa, top };
  }
  if (qa.item && qa.bodyCoverage >= 0.55 && topicScore < 32) {
    let text = qa.item.ans;
    let extraTopic = null;
    if (top && topicScore >= 12 && top.topic.id !== qa.item.topic_id) {
      const related = buildTopicAnswer(top.topic, query, 700);
      if (related) {
        text += "\n\n**Información relacionada:**\n" + related;
        extraTopic = top.topic;
      }
    }
    return { kind: "qa", text, item: qa.item, qa, top, extraTopic };
  }
  if (top && topicScore >= 20) {
    let primary = top;
    let secondary = second;
    let text = buildTopicAnswer(primary.topic, query, 1500);
    let primaryPhrase = phraseLine(text, query);
    let secondText = secondary ? buildTopicAnswer(secondary.topic, query, 900) : "";
    let secondPhrase = secondText ? phraseLine(secondText, query) : null;
    if (
      secondary &&
      secondary.score >= Math.max(18, topicScore * 0.85) &&
      secondPhrase &&
      (!primaryPhrase || secondPhrase.score > primaryPhrase.score)
    ) {
      [primary, secondary] = [secondary, primary];
      [text, secondText] = [secondText, text];
      [primaryPhrase, secondPhrase] = [secondPhrase, primaryPhrase];
    }
    let extraTopic = null;
    if (secondary && secondary.score >= Math.max(16, primary.score * 0.62) && secondary.topic.id !== primary.topic.id) {
      const firstNorm = normalizeStr(text);
      const secondLead = normalizeStr(secondText).slice(0, 120);
      if (secondLead && !firstNorm.includes(secondLead)) {
        text += "\n\n**También aplica:**\n" + secondText;
        extraTopic = secondary.topic;
      }
    }
    return { kind: "topic", text, topic: primary.topic, extraTopic, score: primary.score, topics: topicRank.slice(0, 4) };
  }
  if (qa.item && qaCoverage >= 0.6 && qa.score >= 45) {
    return { kind: "qa", text: qa.item.ans, item: qa.item, qa, top };
  }
  if (top && topicScore >= 12) {
    return { kind: "topic", text: buildTopicAnswer(top.topic, query, 1300), topic: top.topic, score: topicScore, topics: topicRank.slice(0, 4) };
  }
  return { kind: "none", topicRank: topicRank.slice(0, 5), qa };
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

  const engine = buildAnswerLocally(query);
  const matchedTopics =
    engine.kind === "topic"
      ? [engine.topic, engine.extraTopic].filter(Boolean)
      : engine.top
        ? [engine.top.topic]
        : [];
  const tokens = tokenizeQuery(query);

  if (engine.kind === "exact" || engine.kind === "qa") {
    const qSources = [];
    if (engine.item && engine.item.doc_id && STATE.docsById[engine.item.doc_id]) {
      const doc = STATE.docsById[engine.item.doc_id];
      qSources.push({
        doc_id: doc.id,
        title: doc.title,
        filename: doc.filename,
        ext: doc.ext,
        year: doc.year,
        page_start: engine.item.page || 1
      });
    }
    for (const topic of matchedTopics) {
      for (const sourceFile of topic.source_files || []) {
        const doc = findDocByFilename(sourceFile);
        if (!doc || (String(doc.ext || "").toUpperCase() === "HTML" && doc.is_readable_html !== true)) continue;
        if (qSources.some((source) => source.doc_id === doc.id)) continue;
        qSources.push({
          doc_id: doc.id,
          title: doc.title,
          filename: doc.filename,
          ext: doc.ext,
          year: doc.year,
          page_start: 1
        });
      }
    }
    return {
      query,
      answer_markdown: engine.text,
      sources: qSources.slice(0, 6)
    };
  }
  const sources = [];
  const seenIds = new Set();

  for (const t of matchedTopics) {
    for (const sf of t.source_files || []) {
      const d = findDocByFilename(sf);
      if (d && !seenIds.has(d.id) && (String(d.ext || "").toUpperCase() !== "HTML" || d.is_readable_html === true)) {
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
      if (!d || (String(d.ext || "").toUpperCase() === "HTML" && d.is_readable_html !== true)) continue;
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
      if (STATE.activeAskSection && STATE.activeAskSection !== "all") {
        const secs = d.applicable_sections || [d.section];
        if (!secs.includes(STATE.activeAskSection)) continue;
      }
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
      answer_markdown: engine.text,
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

function displayAnswer(data, queryText = "") {
  const bodyEl = document.getElementById("answerBody");
  const sourcesEl = document.getElementById("answerSourcesGrid");

  bodyEl.innerHTML = renderMarkdown(data.answer_markdown || "");

  const sources = data.sources || [];
  updateAnswerFeedbackUI(queryText, data, sources.length);
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

    // Si el buscador tiene una sección activa, evitar sugerencias de secciones incompatibles
    if (STATE.activeAskSection && STATE.activeAskSection !== "all") {
      if (!isQuestionMatchingAskSection(item, STATE.activeAskSection)) {
        continue;
      }
    }

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

function syncCatalogSubcategoryDropdown(docsPool) {
  const select = document.getElementById("filterSubcategory");
  if (!select) return;
  const counts = {};
  for (const d of docsPool) {
    if (d.subcategory) counts[d.subcategory] = (counts[d.subcategory] || 0) + 1;
  }
  const subs = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  if (STATE.subcategoryFilter !== "all" && !counts[STATE.subcategoryFilter]) {
    STATE.subcategoryFilter = "all";
  }
  select.innerHTML = `<option value="all">Todas las subcategorías (${docsPool.length})</option>`;
  for (const [sub, cnt] of subs) {
    const opt = document.createElement("option");
    opt.value = sub;
    opt.textContent = `${sub} (${cnt})`;
    select.appendChild(opt);
  }
  select.value = STATE.subcategoryFilter || "all";
  select.disabled = subs.length <= 1;
}

function applyCatalogFilters() {
  const q = normalizeStr(STATE.searchQuery.trim());
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

  const baseFiltered = STATE.documents.filter((d) => {
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
      const hay = normalizeStr(`${d.title} ${d.filename} ${d.code || ""} ${d.category} ${d.subcategory || ""} ${d.section_label} ${d.summary || ""}`);
      for (const tk of tokens) {
        if (!hay.includes(tk)) return false;
      }
    }
    return true;
  });

  syncCatalogSubcategoryDropdown(baseFiltered);

  renderSubcategoryPills(
    "catalogSubcategoryPills",
    baseFiltered,
    STATE.subcategoryFilter,
    STATE.catalogSubcatOpen,
    (nextOpen) => {
      STATE.catalogSubcatOpen = nextOpen;
      applyCatalogFilters();
    },
    (sub) => {
      STATE.subcategoryFilter = sub;
      applyCatalogFilters();
    }
  );

  let filtered = baseFiltered;
  if (STATE.subcategoryFilter && STATE.subcategoryFilter !== "all") {
    const subOnly = baseFiltered.filter((d) => d.subcategory === STATE.subcategoryFilter);
    if (subOnly.length) filtered = subOnly;
  }

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
  const hasSearch = STATE.searchQuery.trim() !== "";
  const hasNonSearchFilter =
    STATE.categoryFilter !== "all" ||
    STATE.subcategoryFilter !== "all" ||
    STATE.sectionFilter !== "all" ||
    STATE.extFilter !== "all" ||
    STATE.onlyLatest;
  STATE.visibleCount = hasSearch ? filtered.length : hasNonSearchFilter ? 24 : 6;
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
    STATE.subcategoryFilter !== "all" ||
    STATE.sectionFilter !== "all" ||
    STATE.extFilter !== "all" ||
    STATE.onlyLatest;
  resetBtn.classList.toggle("hidden", !hasActiveFilter);

  const slice = STATE.filteredDocs.slice(0, STATE.visibleCount);
  grid.innerHTML = slice
    .map((d) => {
      const dlUrl = buildFileUrl(d, true);
      const dlName = cleanDownloadFilename(d);
      const coverUrl = d.sha12 ? `covers/${d.sha12}.jpg` : "";
      const sizeText = d.size_mb >= 1 ? `${d.size_mb} MB` : `${d.size_kb || 15} KB`;
      return `
        <article class="doc-card">
          <div class="doc-card-top">
            <div class="doc-badges">
              <span class="badge badge-ext">${escapeHtml(d.ext)}</span>
              <span class="badge badge-year">${d.year}</span>
              <span class="badge badge-sec">${escapeHtml(d.section_label)}</span>
            </div>
            <span style="font-size:0.74rem;color:#64748b;font-weight:700;">${sizeText}</span>
          </div>
          <div class="doc-card-body-row">
            ${
              coverUrl
                ? `<img src="${coverUrl}" alt="${escapeHtml(d.title)}" class="doc-card-thumb" loading="lazy" decoding="async" onerror="this.style.display='none'" />`
                : ""
            }
            <div class="doc-card-text-col">
              <h3 class="doc-title">${escapeHtml(d.title)}</h3>
              <p class="doc-summary">${escapeHtml(d.summary || d.filename)}</p>
            </div>
          </div>
          <div class="doc-card-footer">
            <span style="font-size:0.74rem;color:#64748b;font-weight:600;">${escapeHtml(d.category)}${d.subcategory ? ` · ${escapeHtml(d.subcategory)}` : ""}</span>
            <div class="doc-actions">
              <button type="button" class="btn-doc-view" data-open-doc="${escapeHtml(d.id)}">Leer</button>
              <a href="${dlUrl}" download="${escapeHtml(dlName)}" data-dl-doc="${escapeHtml(d.id)}" class="btn-doc-dl">Descargar</a>
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
function cleanDownloadFilename(doc) {
  const extLow = String((doc && doc.ext) || "pdf").toLowerCase();
  let base = String((doc && (doc.filename || doc.title)) || "documento_scout").trim();
  if (/^(?:1|ha-resource|pictures-and-videos|sdp-|diapositiva)/i.test(base) && doc && doc.title) {
    base = doc.title;
  }
  base = base.replace(/\.[a-z0-9]{2,5}$/i, "");
  base = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._ -]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_\.]+|[_\.]+$/g, "")
    .slice(0, 72);
  return `${base || "documento_scout"}.${extLow}`;
}

function showWebToast(msg) {
  let el = document.getElementById("btWebToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "btWebToast";
    el.className = "bt-web-toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("is-visible");
  clearTimeout(showWebToast._t);
  showWebToast._t = setTimeout(() => el.classList.remove("is-visible"), 3200);
}

async function triggerWebDownload(doc, triggerEl) {
  if (!doc) return false;
  const dlUrl = buildFileUrl(doc, true);
  const friendlyName = cleanDownloadFilename(doc);
  const origText = triggerEl ? triggerEl.textContent : "";

  // En archivos alojados dentro de la misma web (files/ o servidor local),
  // descargar mediante Blob garantiza conservar el nombre legible y dar confirmación real.
  if (doc.has_web_file || IS_LOCAL_SERVER) {
    try {
      if (triggerEl) triggerEl.textContent = "Descargando...";
      const res = await fetch(dlUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = friendlyName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
      showWebToast(`Descargado: ${friendlyName}`);
      if (triggerEl) {
        triggerEl.textContent = "Descargado";
        setTimeout(() => {
          triggerEl.textContent = origText;
        }, 1800);
      }
      return true;
    } catch (_) {
      if (triggerEl) triggerEl.textContent = origText;
    }
  }

  // Respaldo limpio para binarios en GitHub Releases v1.0
  const a = document.createElement("a");
  a.href = dlUrl;
  a.download = friendlyName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  showWebToast(`Iniciando descarga: ${friendlyName}`);
  return true;
}

async function ensureSpreadsheets() {
  if (STATE.spreadsheets) return STATE.spreadsheets;
  try {
    const res = await fetch("data/spreadsheets.json");
    if (res.ok) {
      STATE.spreadsheets = await res.json();
      return STATE.spreadsheets;
    }
  } catch (_) {}
  STATE.spreadsheets = {};
  return STATE.spreadsheets;
}

function xlsxColLetter(idx) {
  let n = idx + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function renderSpreadsheetReaderView(doc, sheetPkg, dlUrl, viewUrl, fullTextContent) {
  const sheets = sheetPkg && Array.isArray(sheetPkg.sheets) ? sheetPkg.sheets : [];
  if (!sheets.length) {
    return renderWebReaderView(doc, fullTextContent, dlUrl, viewUrl);
  }
  const absXlsxUrl = /^https?:\/\//i.test(viewUrl)
    ? viewUrl
    : new URL(viewUrl, window.location.href).href;
  const officeUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(absXlsxUrl)}`;

  const renderTableHtml = (sheet, filterText = "") => {
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    const needle = normalizeStr(filterText || "");
    const visible = needle
      ? rows.filter((r, rIdx) => rIdx === 0 || r.some((cell) => normalizeStr(cell).includes(needle)))
      : rows;
    const colsCount = Math.max(sheet.total_cols || 1, ...visible.map((r) => r.length), 1);
    const colHeaders = Array.from({ length: colsCount }, (_, i) => `<th>${xlsxColLetter(i)}</th>`).join("");
    const bodyRows = visible
      .map((r, rIdx) => {
        const cls = rIdx === 0 ? ' class="xlsx-row-header"' : "";
        const cells = Array.from({ length: colsCount }, (_, cIdx) => {
          const val = r[cIdx] !== undefined && r[cIdx] !== null ? String(r[cIdx]) : "";
          return `<td>${escapeHtml(val)}</td>`;
        }).join("");
        return `<tr${cls}><th class="xlsx-row-num">${rIdx + 1}</th>${cells}</tr>`;
      })
      .join("");
    const truncNote = sheet.truncated
      ? `<p class="xlsx-trunc-note">Mostrando las primeras ${sheet.displayed_rows} de ${sheet.total_rows} filas con datos. Descarga el archivo .xlsx para revisar o editar el libro completo.</p>`
      : "";
    return `
      <div class="xlsx-table-wrap">
        <table class="xlsx-grid-table">
          <thead><tr><th class="xlsx-corner">#</th>${colHeaders}</tr></thead>
          <tbody>${bodyRows || `<tr><td colspan="${colsCount + 1}" class="xlsx-empty">Sin filas coincidentes.</td></tr>`}</tbody>
        </table>
      </div>
      ${truncNote}
    `;
  };

  setTimeout(() => {
    const rootEl = document.getElementById("xlsxReaderRoot");
    if (!rootEl) return;
    let activeIdx = 0;
    const stageEl = rootEl.querySelector("#xlsxTableStage");
    const searchEl = rootEl.querySelector("#xlsxRowSearch");
    const tabBtns = Array.from(rootEl.querySelectorAll(".xlsx-sheet-tab"));
    const refresh = () => {
      if (!stageEl || !sheets[activeIdx]) return;
      stageEl.innerHTML = renderTableHtml(sheets[activeIdx], searchEl ? searchEl.value : "");
    };
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        activeIdx = Number(btn.dataset.sheetIdx || 0);
        tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
        refresh();
      });
    });
    if (searchEl) {
      searchEl.addEventListener("input", refresh);
    }
    const csvBtn = rootEl.querySelector("#xlsxExportCsvBtn");
    if (csvBtn) {
      csvBtn.addEventListener("click", () => {
        const s = sheets[activeIdx];
        if (!s || !Array.isArray(s.rows)) return;
        const csvLines = s.rows.map((r) =>
          r.map((cell) => `"${String(cell == null ? "" : cell).replace(/"/g, '""')}"`).join(",")
        );
        const bomBlob = new Blob(["\uFEFF" + csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(bomBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${cleanDownloadFilename(doc).replace(/\.xlsx$/i, "")}_${String(s.name || "hoja").replace(/[^\w-]+/g, "_")}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showWebToast(`Hoja exportada a CSV: ${s.name}`);
      });
    }
    refresh();
  }, 0);

  return `
    <div id="xlsxReaderRoot" class="xlsx-reader-wrap">
      <div class="xlsx-reader-head">
        <div>
          <span class="xlsx-kicker">HOJA DE CÁLCULO INTERACTIVA (${escapeHtml(doc.ext)}) • ${sheets.length} ${sheets.length === 1 ? "HOJA" : "HOJAS"}</span>
          <h3 class="xlsx-reader-title">${escapeHtml(doc.title)}</h3>
          <p class="xlsx-reader-sub">${escapeHtml(doc.filename)} · Vista en tabla sin conexión lista para consultar</p>
        </div>
        <div class="xlsx-reader-actions">
          <a href="${dlUrl}" download="${escapeHtml(cleanDownloadFilename(doc))}" data-dl-doc="${escapeHtml(doc.id)}" class="btn-modal-primary">Descargar .xlsx</a>
          <button type="button" id="xlsxExportCsvBtn" class="btn-modal-secondary">Exportar hoja CSV</button>
          <a href="${officeUrl}" target="_blank" rel="noopener" class="btn-modal-secondary">Vista Office Online</a>
        </div>
      </div>
      <div class="xlsx-controls-row">
        <div class="xlsx-sheet-tabs" role="tablist" aria-label="Hojas del libro Excel">
          ${sheets
            .map(
              (s, i) =>
                `<button type="button" class="xlsx-sheet-tab ${i === 0 ? "active" : ""}" data-sheet-idx="${i}">${escapeHtml(s.name)} <span>(${s.total_rows})</span></button>`
            )
            .join("")}
        </div>
        <input type="search" id="xlsxRowSearch" class="xlsx-row-search" placeholder="Filtrar texto dentro de la hoja..." aria-label="Filtrar filas en Excel" />
      </div>
      <div id="xlsxTableStage" class="xlsx-table-stage"></div>
    </div>
  `;
}

async function openDocumentModal(docId, shelfIndex = -1) {
  const doc = STATE.docsById[docId];
  if (!doc) return;

  recordDocOpenTelemetry(doc);
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

  // Cada documento abre en «Lectura del Documento». Antes se conservaba la
  // pestaña anterior y, si era «Texto Extraído», las imágenes no se veían.
  document.querySelectorAll(".modal-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === "preview");
  });
  previewPane.classList.remove("hidden");
  document.getElementById("modalTextPane").classList.add("hidden");

  titleEl.textContent = doc.title;
  fnameEl.textContent = `${doc.filename} • ${doc.category}${doc.subcategory ? ` • ${doc.subcategory}` : ""}`;
  badgesEl.innerHTML = `
    <span class="badge badge-ext">${escapeHtml(doc.ext)}</span>
    <span class="badge badge-year">${doc.year}</span>
    <span class="badge badge-sec">${escapeHtml(doc.section_label)}</span>
  `;

  // Descripción y sinopsis del documento
  const descEl = document.getElementById("modalDocDescBox");
  if (descEl) {
    const descContent = doc.summary || doc.full_excerpt || "";
    if (descContent) {
      descEl.innerHTML = `<strong>Contenido del documento:</strong> ${escapeHtml(descContent)}`;
      descEl.classList.remove("hidden");
    } else {
      descEl.innerHTML = "";
      descEl.classList.add("hidden");
    }
  }

  const viewUrl = buildFileUrl(doc, false);
  const dlUrl = buildFileUrl(doc, true);
  openTabBtn.href = viewUrl;
  dlBtn.href = dlUrl;
  dlBtn.setAttribute("download", cleanDownloadFilename(doc));
  dlBtn.setAttribute("data-dl-doc", doc.id);

  // Si es una imagen (PNG, JPG, WEBP, AVIF), 'Abrir en pestaña' abre un visor web
  // limpio en la nueva pestaña para evitar que el navegador la descargue forzosamente
  // por el Content-Disposition: attachment de GitHub Releases.
  if (['PNG', 'JPG', 'JPEG', 'WEBP', 'AVIF'].includes(doc.ext)) {
    openTabBtn.onclick = (e) => {
      e.preventDefault();
      const tab = window.open('', '_blank');
      if (tab) {
        tab.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(doc.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
    body { background: #07090e; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; }
    header { position: sticky; top: 0; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.1); padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 50; }
    .title-group { max-width: 75%; }
    .badge { display: inline-block; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #a855f7; margin-bottom: 2px; }
    h1 { font-size: 1.15rem; font-weight: 800; color: #fff; line-height: 1.3; }
    .fname { font-size: 0.8rem; color: #94a3b8; }
    .btn-dl { background: #7c3aed; color: #fff; text-decoration: none; padding: 9px 18px; border-radius: 10px; font-weight: 700; font-size: 0.88rem; transition: background 0.2s; }
    .btn-dl:hover { background: #6d28d9; }
    main { flex: 1; display: flex; justify-content: center; align-items: center; padding: 24px; }
    img { max-width: 95vw; max-height: calc(100vh - 120px); object-fit: contain; border-radius: 12px; box-shadow: 0 15px 40px rgba(0,0,0,0.85); background: #0f172a; }
  </style>
</head>
<body>
  <header>
    <div class="title-group">
      <span class="badge">Vista Previa • ${escapeHtml(doc.category || 'ASMAC')}</span>
      <h1>${escapeHtml(doc.title)}</h1>
      <span class="fname">${escapeHtml(doc.filename)}</span>
    </div>
    <a href="${dlUrl}" download class="btn-dl">Descargar Archivo</a>
  </header>
  <main>
    <img src="${viewUrl}" alt="${escapeHtml(doc.title)}">
  </main>
</body>
</html>`);
        tab.document.close();
      }
    };

  } else {
    openTabBtn.onclick = null;
  }

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

  const isMobileUa =
    /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "") ||
    IS_APPLE_TOUCH ||
    window.innerWidth < 860;
  const canEmbedDirectPdf = IS_LOCAL_SERVER || (doc.has_web_file === true && !isMobileUa);

  if (doc.ext === "PDF") {
    const absPdfUrl = /^https?:\/\//i.test(viewUrl)
      ? viewUrl
      : new URL(viewUrl, window.location.href).href;
    const gDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(absPdfUrl)}&embedded=true`;
    const initialMode = canEmbedDirectPdf ? "direct" : "gdocs";
    const canWebShare = typeof navigator.share === "function" && !window.Capacitor;

    const mountPdfMode = (mode) => {
      const targetSrc = mode === "direct" ? `${absPdfUrl}#view=FitH` : gDocsUrl;
      const modeLabel = mode === "direct" ? "Visor PDF directo (rápido)" : "Visor PDF en la nube (Google Docs)";
      const toggleLabel = mode === "direct" ? "Usar Visor en la Nube" : "Usar Visor Directo";
      const nextMode = mode === "direct" ? "gdocs" : "direct";
      previewPane.innerHTML = `
        <div class="pdf-quick-bar">
          <span>${modeLabel}</span>
          <div class="pdf-quick-actions">
            ${doc.has_web_file || IS_LOCAL_SERVER ? `<button type="button" class="btn-pdf-toggle-mode">${toggleLabel}</button>` : ""}
            <a href="${absPdfUrl}" target="_blank" rel="noopener">Abrir PDF directo</a>
            ${canWebShare ? `<button type="button" class="btn-pdf-share">Compartir / Guardar</button>` : ""}
            <button type="button" class="btn-pdf-switch-text">Cambiar a Texto</button>
          </div>
        </div>
        <iframe id="gDocsIframe" src="${targetSrc}" title="${escapeHtml(doc.title)}" class="doc-viewer-iframe" style="width:100%;height:calc(100% - 40px);min-height:540px;border:none;background:#ffffff;" allowfullscreen></iframe>
      `;
      const swBtn = previewPane.querySelector(".btn-pdf-switch-text");
      if (swBtn) {
        swBtn.onclick = () => {
          document.querySelectorAll(".modal-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "text"));
          previewPane.classList.add("hidden");
          document.getElementById("modalTextPane").classList.remove("hidden");
        };
      }
      const shareBtn = previewPane.querySelector(".btn-pdf-share");
      if (shareBtn) {
        shareBtn.onclick = async () => {
          try {
            await navigator.share({ title: doc.title, url: absPdfUrl });
          } catch (_) {}
        };
      }
      const toggleBtn = previewPane.querySelector(".btn-pdf-toggle-mode");
      if (toggleBtn) {
        toggleBtn.onclick = () => mountPdfMode(nextMode);
      }
    };

    mountPdfMode(initialMode);
    if (IS_LOCAL_SERVER || doc.has_web_file) {
      openTabBtn.href = absPdfUrl;
      openTabBtn.onclick = null;
    } else {
      openTabBtn.onclick = (e) => {
        e.preventDefault();
        window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(absPdfUrl)}`, "_blank");
      };
    }

    if (initialMode === "gdocs") {
      const gIframe = document.getElementById("gDocsIframe");
      let gIframeLoaded = false;
      if (gIframe) {
        gIframe.onload = () => { gIframeLoaded = true; };
      }
      setTimeout(() => {
        if (!gIframeLoaded && (!navigator.onLine || !gIframe || !gIframe.contentWindow)) {
          const banner = document.createElement("div");
          banner.className = "viewer-resilience-banner";
          banner.style.cssText = "padding:10px 14px;background:rgba(245,158,11,0.18);border:1px solid rgba(245,158,11,0.4);color:#fef3c7;border-radius:10px;margin:8px 0;font-size:0.82rem;display:flex;justify-content:space-between;align-items:center;gap:10px;";
          banner.innerHTML = `<span>El visor en la nube está demorando. ¿Deseas leer el texto completo del documento de forma inmediata?</span> <button type="button" style="background:#d97706;color:#ffffff;border:none;border-radius:6px;padding:5px 12px;font-size:0.78rem;font-weight:700;cursor:pointer;white-space:nowrap;">Leer Texto</button>`;
          const btn = banner.querySelector("button");
          if (btn) {
            btn.onclick = () => {
              document.querySelectorAll(".modal-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "text"));
              previewPane.classList.add("hidden");
              document.getElementById("modalTextPane").classList.remove("hidden");
            };
          }
          if (previewPane.parentNode && !previewPane.classList.contains("hidden")) {
            previewPane.prepend(banner);
          }
        }
      }, 5000);
    }
  } else if (["PNG", "JPG", "JPEG", "WEBP", "AVIF"].includes(doc.ext)) {
    previewPane.innerHTML = `
      <figure class="preview-image-figure">
        <div class="img-quick-bar">
          <span>Imagen (${escapeHtml(doc.ext)})</span>
          <div class="pdf-quick-actions">
            <button type="button" id="imgBgToggleBtn">Fondo cuadrícula</button>
            <button type="button" id="imgResetZoomBtn">Ajustar 100%</button>
          </div>
        </div>
        <figcaption class="preview-image-figcaption">
          <span class="preview-image-kicker">Vista previa de imagen (${escapeHtml(doc.ext)})</span>
          <span class="preview-image-title">${escapeHtml(doc.title)}</span>
        </figcaption>
        <div class="preview-image-stage" id="previewImageStage">
          <img src="${viewUrl}" alt="${escapeHtml(doc.title)}" loading="lazy" decoding="async" class="preview-image-el" onerror="this.alt='No se pudo cargar la vista previa. Usa el botón Descargar.'; this.style.minHeight='120px';" />
        </div>
        <p class="preview-image-meta">Archivo: <strong>${escapeHtml(doc.filename)}</strong></p>
      </figure>
    `;
    const imgStage = previewPane.querySelector("#previewImageStage");
    const bgBtn = previewPane.querySelector("#imgBgToggleBtn");
    const rstBtn = previewPane.querySelector("#imgResetZoomBtn");
    if (bgBtn && imgStage) {
      bgBtn.onclick = () => {
        const next = imgStage.classList.toggle("is-checker");
        bgBtn.textContent = next ? "Fondo normal" : "Fondo cuadrícula";
      };
    }
    if (rstBtn) {
      rstBtn.onclick = () => {
        const imgEl = previewPane.querySelector(".preview-image-el");
        if (imgEl) imgEl.style.transform = "none";
      };
    }
  } else if (doc.ext === "HTML" && ((IS_LOCAL_SERVER) || (doc.is_readable_html && doc.has_web_file))) {
    previewPane.innerHTML = `
      <div class="html-quick-bar">
        <span>Guía Web Interactiva (HTML Autónoma)</span>
        <div class="pdf-quick-actions">
          <a href="${viewUrl}" target="_blank" rel="noopener">Abrir guía en pestaña completa</a>
          <button type="button" class="btn-pdf-switch-text">Cambiar a Texto</button>
        </div>
      </div>
      <iframe src="${viewUrl}" title="${escapeHtml(doc.title)}" class="doc-viewer-iframe" style="width:100%;height:calc(100% - 40px);min-height:540px;border:none;background:#ffffff;"></iframe>
    `;
    const swBtn = previewPane.querySelector(".btn-pdf-switch-text");
    if (swBtn) {
      swBtn.onclick = () => {
        document.querySelectorAll(".modal-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "text"));
        previewPane.classList.add("hidden");
        document.getElementById("modalTextPane").classList.remove("hidden");
      };
    }
    openTabBtn.href = viewUrl;
    openTabBtn.onclick = null;
  } else if (doc.ext === "XLSX") {
    const sheetsDb = await ensureSpreadsheets();
    const sheetPkg = sheetsDb ? sheetsDb[doc.sha12] : null;
    previewPane.innerHTML = renderSpreadsheetReaderView(doc, sheetPkg, dlUrl, viewUrl, fullTextContent);
    if (!IS_LOCAL_SERVER) {
      const absOffice = /^https?:\/\//i.test(viewUrl) ? viewUrl : new URL(viewUrl, window.location.href).href;
      openTabBtn.href = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(absOffice)}`;
      openTabBtn.onclick = null;
    }
  } else {
    previewPane.innerHTML = renderWebReaderView(doc, fullTextContent, dlUrl, viewUrl);
    if (!IS_LOCAL_SERVER && ["DOCX", "PPTX"].includes(doc.ext)) {
      const absOffice = /^https?:\/\//i.test(viewUrl) ? viewUrl : new URL(viewUrl, window.location.href).href;
      openTabBtn.href = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(absOffice)}`;
      openTabBtn.onclick = null;
    }
  }

  chunksContainer.innerHTML = `<div class="chunk-block" style="white-space:pre-wrap;">${escapeHtml(fullTextContent || doc.summary || doc.title)}</div>`;
  setupReaderQoLHandlers(doc, fullTextContent);
  modal.classList.remove("hidden");
  // Mientras el lector está abierto, la página de fondo no debe desplazarse.
  // Esto aplica también al modo normal, no solo a pantalla completa.
  document.documentElement.classList.add("reader-open");
  document.body.classList.add("reader-open");
  const modalBody = modal.querySelector(".modal-body");
  if (modalBody) modalBody.scrollTop = 0;
  activateDialogFocusTrap(modal, "#closeDocModalBtn");
}

function renderWebReaderView(doc, fullTextContent, dlUrl, viewUrl = "") {
  const coverUrl = doc.sha12 ? `covers/${doc.sha12}.jpg` : "";
  const blocks = (fullTextContent || doc.summary || "")
    .split(/\n--- Página \d+ ---\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const absFileUrl = viewUrl
    ? (/^https?:\/\//i.test(viewUrl) ? viewUrl : new URL(viewUrl, window.location.href).href)
    : "";
  const officeBtn = ["DOCX", "PPTX", "XLSX"].includes(doc.ext) && absFileUrl && !IS_LOCAL_SERVER
    ? `<a href="https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(absFileUrl)}" target="_blank" rel="noopener" class="btn-modal-secondary">Vista Office Online</a>`
    : "";

  return `
    <div class="web-reader-wrap">
      <div class="web-reader-inner">
        <div class="web-reader-hero">
          ${
            coverUrl
              ? `<img src="${coverUrl}" alt="${escapeHtml(doc.title)}" loading="lazy" decoding="async" class="web-reader-cover" onerror="this.style.display='none'" />`
              : ""
          }
          <div class="web-reader-hero-body">
            <span class="web-reader-kicker">MODO LECTURA LIBRE • ${escapeHtml(doc.section_label)}</span>
            <h2 class="web-reader-title">${escapeHtml(doc.title)}</h2>
            <p class="web-reader-meta">Archivo original: <code>${escapeHtml(doc.filename)}</code> (${doc.year})</p>
            <div class="web-reader-actions">
              <a href="${dlUrl}" download="${escapeHtml(cleanDownloadFilename(doc))}" data-dl-doc="${escapeHtml(doc.id)}" class="btn-modal-primary">Descargar archivo original (${escapeHtml(doc.ext)})</a>
              ${officeBtn}
            </div>
          </div>
        </div>
        ${blocks
          .map(
            (blk, i) => `
          <div class="web-reader-block">${
            blocks.length > 1
              ? `<div class="web-reader-block-tag">SECCIÓN / PÁGINA ${i + 1}</div>`
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
// Lleva el foco y la vista a los resultados cuando se elige un estante.
// Así el cambio se nota aunque el banner del Centenario quede en medio.
function revealLibraryResults() {
  const grid = document.getElementById("libraryBookshelfGrid");
  if (!grid) return;
  grid.focus({ preventScroll: true });
  grid.scrollIntoView({ behavior: "smooth", block: "start" });
}

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

  const toggleSecBtn = document.getElementById("toggleAskSectionBtn");
  const secDrawer = document.getElementById("askSectionDrawer");
  const secBadge = document.getElementById("askSectionActiveBadge");
  const randomPoolBtn = document.getElementById("randomPoolBtn");
  const shuffleBtn = document.getElementById("shuffleQuestionsBtn");

  if (toggleSecBtn && secDrawer) {
    toggleSecBtn.addEventListener("click", () => {
      const willOpen = secDrawer.classList.contains("hidden");
      secDrawer.classList.toggle("hidden", !willOpen);
      toggleSecBtn.setAttribute("aria-expanded", String(willOpen));
    });
  }

  document.querySelectorAll(".qcat-tab").forEach((tab) => {
    tab.addEventListener("click", async () => {
      document.querySelectorAll(".qcat-tab").forEach((t) => t.classList.remove("active"));
      if (randomPoolBtn) randomPoolBtn.classList.remove("active");
      tab.classList.add("active");
      STATE.activeQCat = tab.getAttribute("data-qcat") || "Destacadas";
      await loadQuestionBank();
      renderExplorerQuestions(STATE.activeQCat, false);
    });
  });

  if (randomPoolBtn) {
    randomPoolBtn.addEventListener("click", async () => {
      document.querySelectorAll(".qcat-tab").forEach((t) => t.classList.remove("active"));
      randomPoolBtn.classList.add("active");
      STATE.activeQCat = "__RANDOM__";
      await loadQuestionBank();
      renderExplorerQuestions("__RANDOM__", true);
    });
  }

  if (shuffleBtn) {
    shuffleBtn.addEventListener("click", async () => {
      await loadQuestionBank();
      renderExplorerQuestions(STATE.activeQCat || "__RANDOM__", true);
    });
  }

  document.querySelectorAll(".sec-pill").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".sec-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const sec = btn.dataset.section || "all";
      STATE.activeAskSection = sec;
      if (secBadge) secBadge.textContent = btn.getAttribute("data-short") || btn.textContent.trim();
      if (secDrawer && toggleSecBtn) {
        secDrawer.classList.add("hidden");
        toggleSecBtn.setAttribute("aria-expanded", "false");
      }

      // Si está en modo azar, recargar preguntas aleatorias de esa sección; si no, sincronizar pestaña
      if (STATE.activeQCat === "__RANDOM__") {
        await loadQuestionBank();
        renderExplorerQuestions("__RANDOM__", true);
      } else {
        const secToCat = {
          comunidad: "Comunidad de Caminantes",
          tropa: "Tropa de Scouts",
          manada: "Manada de Lobatos",
          clan: "Clan de Rovers",
          adultos: "Manuales Oficiales y de Operación",
          internacional: "Insignias Mundiales (WOSM)",
          all: "Destacadas"
        };
        const targetCat = secToCat[sec] || "Destacadas";
        document.querySelectorAll(".qcat-tab").forEach((t) => {
          t.classList.toggle("active", t.dataset.qcat === targetCat);
        });
        STATE.activeQCat = targetCat;
        await loadQuestionBank();
        renderExplorerQuestions(targetCat, false);
      }

      // Si el buscador ya tiene texto, refrescar el autocompletado en vivo
      const askInput = document.getElementById("askInput");
      if (askInput && askInput.value.trim().length >= 2) {
        updateAutocompleteDropdown(askInput.value.trim());
      }

      // Si hay una respuesta visible en pantalla, refrescar las preguntas relacionadas para que no mezclen secciones
      const titleEl = document.getElementById("answerQuestionTitle");
      const container = document.getElementById("answerContainer");
      if (titleEl && container && !container.classList.contains("hidden") && titleEl.textContent) {
        renderRelatedQuestions(titleEl.textContent);
      }
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
    const dlLink = e.target.closest("[data-dl-doc]");
    if (dlLink && !window.Capacitor) {
      e.preventDefault();
      const targetDoc = STATE.docsById[dlLink.getAttribute("data-dl-doc")];
      if (targetDoc) triggerWebDownload(targetDoc, dlLink);
      return;
    }
    const shelfBtn = e.target.closest("[data-select-shelf]");
    if (shelfBtn) {
      const targetShelf = shelfBtn.getAttribute("data-select-shelf");
      document.querySelectorAll(".shelf-tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.shelf === targetShelf);
      });
      STATE.activeShelf = targetShelf;
      STATE.librarySubcategory = "all";
      STATE.libraryVisibleCount = resolveDefaultLibraryCount();
      renderLibraryShelf();
      revealLibraryResults();
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
      STATE.librarySubcategory = "all";
      STATE.libraryVisibleCount = resolveDefaultLibraryCount();
      renderLibraryShelf();
      revealLibraryResults();
    });
  });

  const libFilterInput = document.getElementById("libraryFilterInput");
  if (libFilterInput) {
    libFilterInput.addEventListener(
      "input",
      debounce(() => {
        STATE.libraryQuery = libFilterInput.value;
        STATE.libraryVisibleCount = resolveDefaultLibraryCount();
        renderLibraryShelf();
        scheduleSearchTelemetry("biblioteca", STATE.libraryQuery, STATE.currentShelfDocs.length);
      }, 120)
    );
  }

  const libSecSelect = document.getElementById("librarySectionFilter");
  if (libSecSelect) {
    libSecSelect.addEventListener("change", () => {
      STATE.librarySection = libSecSelect.value || "all";
      STATE.libraryVisibleCount = resolveDefaultLibraryCount();
      renderLibraryShelf();
    });
  }

  const libScopeSelect = document.getElementById("libraryScopeSelect");
  if (libScopeSelect) {
    libScopeSelect.addEventListener("change", () => {
      STATE.libraryScope = libScopeSelect.value || "shelf";
      STATE.libraryVisibleCount = resolveDefaultLibraryCount();
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
  const filterSubcat = document.getElementById("filterSubcategory");
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
      STATE.subcategoryFilter = "all";
      if (filterCat) filterCat.value = val;
      applyCatalogFilters();
    });
  });

  if (catSearch) {
    catSearch.addEventListener(
      "input",
      debounce(() => {
        STATE.searchQuery = catSearch.value;
        applyCatalogFilters();
        scheduleSearchTelemetry("catalogo", STATE.searchQuery, STATE.filteredDocs.length);
      }, 120)
    );
  }
  if (filterCat) {
    filterCat.addEventListener("change", () => {
      STATE.categoryFilter = filterCat.value;
      STATE.subcategoryFilter = "all";
      applyCatalogFilters();
    });
  }
  if (filterSubcat) {
    filterSubcat.addEventListener("change", () => {
      STATE.subcategoryFilter = filterSubcat.value || "all";
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
      STATE.subcategoryFilter = "all";
      STATE.catalogSubcatOpen = false;
      STATE.sectionFilter = "all";
      STATE.extFilter = "all";
      STATE.onlyLatest = false;
      if (catSearch) catSearch.value = "";
      if (filterCat) filterCat.value = "all";
      if (filterSubcat) filterSubcat.value = "all";
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
  const docModalBody = docModal ? docModal.querySelector(".modal-body") : null;
  const closeDocModalBtn = document.getElementById("closeDocModalBtn");
  const fullscreenBtn = document.getElementById("modalFullscreenBtn");
  const prevBookBtn = document.getElementById("modalPrevBookBtn");
  const nextBookBtn = document.getElementById("modalNextBookBtn");

  // La pantalla completa debe conservar el encabezado y sus acciones.
  // Se quita el relleno del overlay para que la barra no quede fuera de vista.
  const setReaderFullscreen = (on) => {
    docModal.classList.toggle("fullscreen-open", on);
    docModalContainer.classList.toggle("fullscreen-reader", on);
    document.documentElement.classList.toggle("reader-fullscreen", on);
    document.body.classList.toggle("reader-fullscreen", on);
    if (fullscreenBtn) {
      fullscreenBtn.setAttribute("aria-pressed", String(on));
      fullscreenBtn.textContent = on ? "Salir de pantalla completa" : "Pantalla completa";
      fullscreenBtn.title = on ? "Salir de pantalla completa" : "Alternar pantalla completa";
    }
  };

  const closeReader = () => {
    stopReaderTTS();
    setReaderFullscreen(false);
    docModal.classList.add("hidden");
    document.documentElement.classList.remove("reader-open");
    document.body.classList.remove("reader-open");
    document.getElementById("modalPreviewPane").innerHTML = "";
    releaseDialogFocusTrap(docModal);
  };

  if (closeDocModalBtn) {
    closeDocModalBtn.addEventListener("click", closeReader);
  }

  if (fullscreenBtn && docModalContainer) {
    fullscreenBtn.addEventListener("click", () => {
      setReaderFullscreen(!docModalContainer.classList.contains("fullscreen-reader"));
    });
  }

  // Escape sale de pantalla completa o cierra el lector. Sin esto, en
  // pantalla completa no había forma de cerrar si la X quedaba oculta.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || docModal.classList.contains("hidden")) return;
    if (docModalContainer.classList.contains("fullscreen-reader")) {
      setReaderFullscreen(false);
    } else {
      closeReader();
    }
  });

  // La rueda debe mover el documento abierto aunque el cursor esté sobre el
  // encabezado, las pestañas o el fondo del modal. Si el cursor ya está en el
  // cuerpo, se deja el scroll nativo y el `overscroll-behavior` evita que la
  // página de fondo se mueva al llegar al final.
  if (docModal && docModalBody) {
    docModal.addEventListener(
      "wheel",
      (event) => {
        if (docModal.classList.contains("hidden")) return;
        if (docModalBody.contains(event.target)) return;
        event.preventDefault();
        const factor = event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? docModalBody.clientHeight : 1;
        docModalBody.scrollTop += event.deltaY * factor;
      },
      { passive: false }
    );
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
      // Cada lectura empieza desde arriba; así la rueda no hereda la posición
      // de la pestaña anterior.
      if (docModalBody) docModalBody.scrollTop = 0;
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

  // Controles V6: Modo Campamento, Físicas 3D, Lienzo Ambiental, Ejes y Dock
  const btnToggleCampMode = document.getElementById("btnToggleCampMode");
  if (btnToggleCampMode) {
    btnToggleCampMode.addEventListener("click", () => {
      BiblioFeel.toggleCampMode();
    });
  }

  BiblioFeel.initCampMode();
  BiblioFeel.init3DTilt();
  BiblioFeel.initAmbientCanvas();
  setupModalSwipeGestures();
  setupAdcEjesInteractivity();
  setupUnifiedDock();
}

// ============================================================================
// BIBLIOTECH SCOUT V6 — MOTOR SENSORIAL BIBLIOFEEL, AUDIO TTS, MOCHILA & DOCK
// ============================================================================

const BiblioFeel = {
  hapticsEnabled: true,
  campMode: localStorage.getItem("bt_camp_mode") === "true",

  pulse(pattern = 10) {
    if (!this.hapticsEnabled) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (_) {}
  },

  initCampMode() {
    document.documentElement.setAttribute("data-camp-mode", String(this.campMode));
    const btn = document.getElementById("btnToggleCampMode");
    if (btn) {
      btn.setAttribute("aria-pressed", String(this.campMode));
    }
    syncThemeColorMetas(this.campMode);
  },

  toggleCampMode() {
    this.campMode = !this.campMode;
    localStorage.setItem("bt_camp_mode", String(this.campMode));
    document.documentElement.setAttribute("data-camp-mode", String(this.campMode));
    const btn = document.getElementById("btnToggleCampMode");
    if (btn) {
      btn.setAttribute("aria-pressed", String(this.campMode));
    }
    syncThemeColorMetas(this.campMode);
    this.pulse([12, 40, 12]);
    return this.campMode;
  },

  init3DTilt() {
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const selector = ".floating-photo, .hero-floating-card, .about-floating-photo, .book-card, .adc-axis-card, .adc-eje-item, .adc-cosmic-card, .starter-3d-card, .scout-sec-card, .service-info-card, .change-card, .liam-depth-stage";

    if (!coarse) {
      document.addEventListener("pointermove", (e) => {
        const card = e.target.closest(selector);
        if (!card) return;
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = (e.clientY - rect.top) / rect.height;
        card.style.setProperty("--rx", `${((0.5 - ny) * 9).toFixed(2)}deg`);
        card.style.setProperty("--ry", `${((nx - 0.5) * 10).toFixed(2)}deg`);
        card.style.setProperty("--glare-x", `${(nx * 100).toFixed(1)}%`);
        card.style.setProperty("--glare-y", `${(ny * 100).toFixed(1)}%`);
        card.classList.add("is-tilting", "is-tilting-3d");
      }, { passive: true });

      document.addEventListener("pointerout", (e) => {
        const card = e.target.closest(selector);
        if (!card || (e.relatedTarget && card.contains(e.relatedTarget))) return;
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
        card.classList.remove("is-tilting", "is-tilting-3d");
      }, { passive: true });
    }

    // Fases orbitales en fotos flotantes
    document.querySelectorAll(".floating-photo, .hero-floating-card, .about-floating-photo, .sec-popout-photo").forEach((el, idx) => {
      el.style.setProperty("--float-duration", `${6.5 + (idx % 4) * 1.3}s`);
      el.style.setProperty("--float-delay", `${(idx * -1.4).toFixed(1)}s`);
      el.style.setProperty("--drift-x", `${(idx % 2 === 0 ? 1 : -1) * (5 + (idx % 3) * 3)}px`);
      el.addEventListener("click", () => {
        this.pulse(12);
        el.classList.toggle("is-spotlight");
      });
    });
  },

  initAmbientCanvas() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let canvas = document.getElementById("btAmbientCanvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "btAmbientCanvas";
      canvas.setAttribute("aria-hidden", "true");
      document.body.prepend(canvas);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    window.addEventListener(
      "resize",
      debounce(() => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
      }, 180),
      { passive: true }
    );

    const count = window.innerWidth < 768 ? 24 : 44;
    const lightPalette = ["109, 40, 217", "2, 132, 199", "219, 39, 119"];
    const darkPalette = ["56, 189, 248", "167, 139, 250", "250, 204, 21"];
    const particles = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1.4 + Math.random() * 2.1,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -0.22 - Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      toneIdx: i % 3
    }));

    let rafId = null;
    const render = () => {
      rafId = null;
      if (document.hidden) return;
      ctx.clearRect(0, 0, w, h);
      const isDark = !!this.campMode;
      const palette = isDark ? darkPalette : lightPalette;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.phase += 0.03;
        if (p.y < -10) p.y = h + 10;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        const glow = (isDark ? 0.42 : 0.32) + Math.sin(p.phase) * (isDark ? 0.28 : 0.18);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${palette[p.toneIdx]}, ${Math.max(0.12, glow).toFixed(2)})`;
        ctx.fill();
      }
      rafId = requestAnimationFrame(render);
    };
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && rafId === null) {
        rafId = requestAnimationFrame(render);
      }
    });
    rafId = requestAnimationFrame(render);
  }
};

// ============================================================================
// AUDIO TTS, NOTAS DE CAMPO, MOCHILA SCOUT Y BUSCADOR INTERNO DEL LECTOR
// ============================================================================

let activeTTSUtterance = null;
let isTTSPlaying = false;
let internalSearchMatches = [];
let internalSearchIndex = -1;

function stopReaderTTS() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  isTTSPlaying = false;
  activeTTSUtterance = null;
  const btn = document.getElementById("btnReaderTTS");
  if (btn) {
    btn.classList.remove("is-active");
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg> <span>Escuchar</span>`;
  }
}

function toggleReaderTTS(textToRead) {
  if (!("speechSynthesis" in window)) {
    alert("Tu navegador no soporta lectura de texto en voz alta.");
    return;
  }
  if (isTTSPlaying) {
    stopReaderTTS();
    return;
  }
  stopReaderTTS();

  const cleanText = (textToRead || "").replace(/\[Pág\.\s*\d+\]/g, "").replace(/--- Página \d+ ---/g, "").trim();
  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 4500));
  utterance.lang = "es-MX";
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const esVoice = voices.find((v) => v.lang.startsWith("es"));
  if (esVoice) utterance.voice = esVoice;

  utterance.onend = () => {
    stopReaderTTS();
  };
  utterance.onerror = () => {
    stopReaderTTS();
  };

  activeTTSUtterance = utterance;
  isTTSPlaying = true;
  window.speechSynthesis.speak(utterance);

  const btn = document.getElementById("btnReaderTTS");
  if (btn) {
    btn.classList.add("is-active");
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> <span>Pausar</span>`;
  }
  BiblioFeel.pulse(12);
}

// ============================================================================
// GUARDADOS Y NOTAS EN ESTE NAVEGADOR (COOKIES + LOCALSTORAGE HÍBRIDO)
// ============================================================================

function setCookie(name, val, days = 365) {
  try {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = "expires=" + d.toUTCString();
    document.cookie = `${name}=${encodeURIComponent(val)};${expires};path=/;SameSite=Lax`;
  } catch (_) {}
}

function getCookie(name) {
  try {
    const cname = name + "=";
    const decoded = decodeURIComponent(document.cookie);
    const ca = decoded.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(cname) === 0) {
        return c.substring(cname.length, c.length);
      }
    }
  } catch (_) {}
  return "";
}

function getSavedPins() {
  try {
    const fromLs = localStorage.getItem("bt_saved_docs");
    if (fromLs) {
      const parsed = JSON.parse(fromLs);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  try {
    const fromCookie = getCookie("bt_saved_docs");
    if (fromCookie) {
      const parsed = JSON.parse(fromCookie);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  try {
    const legacy = localStorage.getItem("bt_backpack_pins");
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setSavedPins(parsed);
        return parsed;
      }
    }
  } catch (_) {}
  return [];
}

function setSavedPins(pins) {
  const json = JSON.stringify(pins);
  try { localStorage.setItem("bt_saved_docs", json); } catch (_) {}
  setCookie("bt_saved_docs", json);
  updateSavedBadge();
}

function toggleSavedPin(docId) {
  if (!docId) return false;
  let pins = getSavedPins();
  const idx = pins.indexOf(docId);
  let isSaved = false;
  if (idx >= 0) {
    pins.splice(idx, 1);
    isSaved = false;
  } else {
    pins.push(docId);
    isSaved = true;
  }
  setSavedPins(pins);
  BiblioFeel.pulse(isSaved ? [12, 30, 18] : 10);
  const savedDoc = STATE.docsById && STATE.docsById[docId];
  if (typeof window.btTrackEvent === "function") {
    window.btTrackEvent("doc_guardado", {
      accion: isSaved ? "guardado" : "quitado",
      doc: savedDoc ? savedDoc.title : docId
    });
  }
  return isSaved;
}

function getDocNote(docId) {
  try {
    const fromLs = localStorage.getItem("bt_note_" + docId);
    if (fromLs) return fromLs;
  } catch (_) {}
  try {
    const cookieNote = getCookie("bt_n_" + docId);
    if (cookieNote) return cookieNote;
  } catch (_) {}
  return "";
}

function setDocNote(docId, noteText) {
  const clean = (noteText || "").trim();
  try {
    if (clean) {
      localStorage.setItem("bt_note_" + docId, clean);
      setCookie("bt_n_" + docId, clean);
    } else {
      localStorage.removeItem("bt_note_" + docId);
      setCookie("bt_n_" + docId, "", -1);
    }
  } catch (_) {}
}

function updateSavedBadge() {
  const pins = getSavedPins();
  const countEl = document.getElementById("dockSavedCount");
  if (countEl) {
    countEl.textContent = String(pins.length);
    countEl.classList.toggle("hidden", pins.length === 0);
  }
}

function openSavedPanel() {
  const panel = document.getElementById("savedPanel");
  const list = document.getElementById("savedPanelList");
  if (!panel || !list) return;

  const pins = getSavedPins();
  if (pins.length === 0) {
    list.innerHTML = `
      <div class="saved-empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
        <p><strong>Aún no tienes documentos guardados</strong></p>
        <span>Abre cualquier libro, manual o documento de la biblioteca y toca <strong>Guardar</strong> para tenerlo siempre a la mano en este dispositivo.</span>
      </div>
    `;
  } else {
    const savedDocs = STATE.documents.filter((d) => pins.includes(d.id));
    list.innerHTML = savedDocs.map((doc) => {
      const note = getDocNote(doc.id);
      return `
        <article class="saved-card" data-doc-id="${escapeHtml(doc.id)}">
          <div class="saved-card-main">
            <span class="badge badge-ext">${escapeHtml(doc.ext)}</span>
            <span class="badge badge-sec">${escapeHtml(doc.section_label || 'General')}</span>
            <span class="badge badge-year">${doc.year || '2026'}</span>
            <h4 class="saved-card-title">${escapeHtml(doc.title)}</h4>
            <span class="saved-card-fname">${escapeHtml(doc.filename)}</span>
            ${note ? `<div class="saved-card-note"><strong>Notas:</strong> ${escapeHtml(note)}</div>` : ''}
          </div>
          <div class="saved-card-actions">
            <button type="button" class="btn-saved-open" data-open-doc="${escapeHtml(doc.id)}">Abrir</button>
            <button type="button" class="btn-saved-remove" data-remove-doc="${escapeHtml(doc.id)}" title="Quitar de guardados">Quitar</button>
          </div>
        </article>
      `;
    }).join("");

    list.querySelectorAll("[data-open-doc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-open-doc");
        closeSavedPanel();
        openDocumentModal(id);
      });
    });

    list.querySelectorAll("[data-remove-doc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-remove-doc");
        toggleSavedPin(id);
        openSavedPanel();
      });
    });
  }

  panel.classList.remove("hidden");
  document.documentElement.classList.add("modal-open");
  document.body.classList.add("modal-open");
  activateDialogFocusTrap(panel, ".saved-panel-close");
}

function closeSavedPanel() {
  const panel = document.getElementById("savedPanel");
  if (!panel) return;
  panel.classList.add("hidden");
  if (!document.querySelector(".modal-documento:not(.hidden)")) {
    document.documentElement.classList.remove("modal-open");
    document.body.classList.remove("modal-open");
  }
  releaseDialogFocusTrap(panel);
}

function setupReaderQoLHandlers(doc, fullText) {
  // Manejo de Zoom para tablets y pantallas grandes
  const previewPane = document.getElementById("modalPreviewPane");
  const textPane = document.getElementById("modalTextPane");
  let currentZoom = 1.0;

  const applyZoom = () => {
    if (previewPane) {
      const iframe = previewPane.querySelector("iframe");
      if (iframe) {
        iframe.style.transform = currentZoom === 1.0 ? "none" : `scale(${currentZoom})`;
        iframe.style.transformOrigin = "top center";
        iframe.style.width = currentZoom < 1.0 ? `${(100 / currentZoom).toFixed(1)}%` : "100%";
      }
      const imgEl = previewPane.querySelector(".preview-image-el");
      if (imgEl) {
        imgEl.style.transform = currentZoom === 1.0 ? "none" : `scale(${currentZoom})`;
        imgEl.style.transformOrigin = "center center";
      }
      const xlsxTbl = previewPane.querySelector(".xlsx-grid-table");
      if (xlsxTbl) {
        xlsxTbl.style.fontSize = `${(0.81 * currentZoom).toFixed(2)}rem`;
      }
    }
    if (textPane) {
      textPane.style.fontSize = `${(0.9 * currentZoom).toFixed(2)}rem`;
    }
  };

  const btnZoomOut = document.getElementById("btnZoomOut");
  if (btnZoomOut) {
    btnZoomOut.onclick = () => {
      if (currentZoom > 0.65) {
        currentZoom = Math.max(0.65, Number((currentZoom - 0.15).toFixed(2)));
        applyZoom();
        BiblioFeel.pulse(8);
      }
    };
  }

  const btnZoomIn = document.getElementById("btnZoomIn");
  if (btnZoomIn) {
    btnZoomIn.onclick = () => {
      if (currentZoom < 1.5) {
        currentZoom = Math.min(1.5, Number((currentZoom + 0.15).toFixed(2)));
        applyZoom();
        BiblioFeel.pulse(8);
      }
    };
  }

  const ttsBtn = document.getElementById("btnReaderTTS");
  if (ttsBtn) {
    ttsBtn.onclick = () => {
      toggleReaderTTS(fullText || doc.summary || doc.title);
    };
  }

  // Botón Guardar en este navegador
  const pinBtn = document.getElementById("btnPinDoc") || document.getElementById("btnPinBackpack");
  if (pinBtn) {
    const pins = getSavedPins();
    const isSaved = pins.includes(doc.id);
    pinBtn.classList.toggle("is-active", isSaved);
    pinBtn.title = isSaved ? "Quitar de guardados" : "Guardar documento en este navegador";
    const span = pinBtn.querySelector("span");
    if (span) span.textContent = isSaved ? "Guardado" : "Guardar";

    pinBtn.onclick = () => {
      const nowSaved = toggleSavedPin(doc.id);
      pinBtn.classList.toggle("is-active", nowSaved);
      pinBtn.title = nowSaved ? "Quitar de guardados" : "Guardar documento en este navegador";
      if (span) span.textContent = nowSaved ? "Guardado" : "Guardar";
    };
  }

  // Botón Notas
  const fieldNoteBtn = document.getElementById("btnFieldNote");
  const fieldNoteBox = document.getElementById("modalFieldNoteBox");
  const fieldNoteText = document.getElementById("modalFieldNoteText");
  const saveNoteBtn = document.getElementById("btnSaveFieldNote");
  const closeNoteBtn = document.getElementById("btnCloseFieldNote");

  if (fieldNoteBtn && fieldNoteBox && fieldNoteText) {
    const savedNote = getDocNote(doc.id);
    fieldNoteText.value = savedNote;
    fieldNoteBtn.classList.toggle("is-active", Boolean(savedNote));

    fieldNoteBtn.onclick = () => {
      fieldNoteBox.classList.toggle("hidden");
      if (!fieldNoteBox.classList.contains("hidden")) {
        fieldNoteText.focus();
      }
    };

    if (closeNoteBtn) {
      closeNoteBtn.onclick = () => {
        fieldNoteBox.classList.add("hidden");
      };
    }

    if (saveNoteBtn) {
      saveNoteBtn.onclick = () => {
        const val = fieldNoteText.value.trim();
        setDocNote(doc.id, val);
        fieldNoteBtn.classList.toggle("is-active", Boolean(val));
        fieldNoteBox.classList.add("hidden");
        BiblioFeel.pulse([10, 30]);
      };
    }
  }

  const searchInput = document.getElementById("modalInternalSearchInput");
  const prevBtn = document.getElementById("modalSearchPrevBtn");
  const nextBtn = document.getElementById("modalSearchNextBtn");
  const countEl = document.getElementById("modalSearchMatchesCount");

  internalSearchMatches = [];
  internalSearchIndex = -1;
  if (countEl) countEl.textContent = "";
  if (searchInput) searchInput.value = "";

  const performInternalSearch = () => {
    const query = (searchInput.value || "").trim().toLowerCase();
    const chunksContainer = document.getElementById("modalChunksContainer");
    if (!chunksContainer) return;

    // Restaurar texto original antes de resaltar
    chunksContainer.innerHTML = `<div class="chunk-block" style="white-space:pre-wrap;">${escapeHtml(fullText || doc.summary || doc.title)}</div>`;
    internalSearchMatches = [];
    internalSearchIndex = -1;

    if (!query || query.length < 2) {
      if (countEl) countEl.textContent = "";
      return;
    }

    // Switch automático a pestaña de texto si se busca texto
    document.querySelectorAll(".modal-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "text"));
    document.getElementById("modalPreviewPane").classList.add("hidden");
    document.getElementById("modalTextPane").classList.remove("hidden");

    const block = chunksContainer.querySelector(".chunk-block");
    if (!block) return;

    const raw = block.textContent;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    block.innerHTML = escapeHtml(raw).replace(regex, '<mark class="doc-highlight">$1</mark>');

    internalSearchMatches = Array.from(block.querySelectorAll("mark.doc-highlight"));
    if (countEl) {
      countEl.textContent = internalSearchMatches.length ? `1/${internalSearchMatches.length}` : "0/0";
    }
    if (internalSearchMatches.length) {
      internalSearchIndex = 0;
      internalSearchMatches[0].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  if (searchInput) {
    searchInput.oninput = () => performInternalSearch();
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      if (!internalSearchMatches.length) return;
      internalSearchIndex = (internalSearchIndex + 1) % internalSearchMatches.length;
      internalSearchMatches[internalSearchIndex].scrollIntoView({ behavior: "smooth", block: "center" });
      if (countEl) countEl.textContent = `${internalSearchIndex + 1}/${internalSearchMatches.length}`;
    };
  }
  if (prevBtn) {
    prevBtn.onclick = () => {
      if (!internalSearchMatches.length) return;
      internalSearchIndex = (internalSearchIndex - 1 + internalSearchMatches.length) % internalSearchMatches.length;
      internalSearchMatches[internalSearchIndex].scrollIntoView({ behavior: "smooth", block: "center" });
      if (countEl) countEl.textContent = `${internalSearchIndex + 1}/${internalSearchMatches.length}`;
    };
  }
}

// Gestos Swipe-Down para cerrar modal en móvil
function setupModalSwipeGestures() {
  const container = document.getElementById("docModalContainer");
  const handle = document.querySelector(".sheet-drag-handle");
  const headerTop = document.querySelector(".modal-header-top");
  if (!container) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    currentY = startY;
    isDragging = true;
  };

  const onTouchMove = (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const dy = currentY - startY;
    if (dy > 0) {
      container.style.transform = `translateY(${dy * 0.7}px)`;
    }
  };

  const onTouchEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    const dy = currentY - startY;
    if (dy > 90) {
      const closeBtn = document.getElementById("closeDocModalBtn");
      if (closeBtn) closeBtn.click();
      BiblioFeel.pulse(10);
    }
    container.style.transform = "";
  };

  if (handle) {
    handle.addEventListener("touchstart", onTouchStart, { passive: true });
    handle.addEventListener("touchmove", onTouchMove, { passive: true });
    handle.addEventListener("touchend", onTouchEnd, { passive: true });
  }
  if (headerTop) {
    headerTop.addEventListener("touchstart", onTouchStart, { passive: true });
    headerTop.addEventListener("touchmove", onTouchMove, { passive: true });
    headerTop.addEventListener("touchend", onTouchEnd, { passive: true });
  }
}

// ============================================================================
// INTERACTIVIDAD DE LOS 4 EJES TEMÁTICOS EN AGENTES DE CAMBIO.MX
// ============================================================================

const ADC_EJES_DATA = {
  salud: {
    title: "Salud y Bienestar",
    pilar: "Aprender a ser",
    desc: "Desarrollo armónico de la salud física, emocional y mental, hábitos saludables y prevención de adicciones en entornos seguros.",
    ideas: [
      "Taller de salud mental y manejo de estrés para jóvenes de comunidad.",
      "Campaña comunitaria de hidratación y acondicionamiento físico scout.",
      "Botiquín de primeros auxilios y capacitación de brigadas juveniles de emergencia."
    ],
    shelfCategory: "Manada",
    query: "¿En qué consiste el eje temático de Salud y Bienestar en Agentes de Cambio?"
  },
  habilidades: {
    title: "Habilidades para la Vida",
    pilar: "Aprender a hacer",
    desc: "Capacitación técnica, liderazgo, resolución de problemas, oratoria, emprendimiento scout y competencias para el futuro laboral.",
    ideas: [
      "Incubadora de proyectos de emprendimiento juvenil scout.",
      "Taller de robótica y tecnologías abiertas para comunidades vulnerables.",
      "Guía práctica de finanzas personales y orientación vocacional para Caminantes."
    ],
    shelfCategory: "Comunidad",
    query: "¿En qué consiste el eje temático de Habilidades para la Vida en Agentes de Cambio?"
  },
  sustentabilidad: {
    title: "Medio Ambiente y Sustentabilidad",
    pilar: "Aprender a saber",
    desc: "Acción por el clima, conservación de la biodiversidad, manejo de residuos, ecología práctica y proyectos alineados a los ODS de la ONU.",
    ideas: [
      "Jornada de reforestación con especies nativas y adopción de árboles.",
      "Huertos comunitarios urbanos con sistema de captación pluvial.",
      "Campaña de reducción y separación de plásticos de un solo uso en locales de grupo."
    ],
    shelfCategory: "General",
    query: "¿En qué consiste el eje temático de Medio Ambiente y Sustentabilidad en Agentes de Cambio?"
  },
  paz: {
    title: "Paz y Participación Comunitaria",
    pilar: "Aprender a convivir",
    desc: "Cultura de paz, derechos humanos, mediación pacífica de conflictos, servicio social transformador e inclusión activa.",
    ideas: [
      "Red de apoyo escolar y fomento a la lectura en albergues infantiles.",
      "Mural comunitario por la no violencia y la cultura de paz.",
      "Jornadas de voluntariado en asilos de ancianos y comedores comunitarios."
    ],
    shelfCategory: "General",
    query: "¿En qué consiste el eje temático de Paz y Participación Comunitaria en Agentes de Cambio?"
  }
};

function setupAdcEjesInteractivity() {
  const grid = document.querySelector(".adc-ejes-cards-grid");
  if (!grid) return;

  let tray = document.getElementById("adcEjesDetailTray");
  if (!tray) {
    tray = document.createElement("div");
    tray.id = "adcEjesDetailTray";
    tray.className = "adc-ejes-detail-tray hidden";
    grid.insertAdjacentElement("afterend", tray);
  }

  const ejeItems = document.querySelectorAll(".adc-eje-item");
  ejeItems.forEach((item) => {
    const ejeKey = item.classList.contains("eje-salud")
      ? "salud"
      : item.classList.contains("eje-habilidades")
      ? "habilidades"
      : item.classList.contains("eje-sustentabilidad")
      ? "sustentabilidad"
      : "paz";

    const trigger = () => {
      BiblioFeel.pulse(12);
      const data = ADC_EJES_DATA[ejeKey];
      if (!data) return;

      const isCurrentOpen = !tray.classList.contains("hidden") && tray.dataset.activeEje === ejeKey;
      if (isCurrentOpen) {
        tray.classList.add("hidden");
        tray.dataset.activeEje = "";
        ejeItems.forEach((el) => el.classList.remove("is-active"));
        return;
      }

      ejeItems.forEach((el) => el.classList.remove("is-active"));
      item.classList.add("is-active");
      tray.dataset.activeEje = ejeKey;
      tray.classList.remove("hidden");

      tray.innerHTML = `
        <div class="adc-eje-detail-card" style="margin-top:1.25rem;background:rgba(15,23,42,0.85);backdrop-filter:blur(18px);border:1.5px solid rgba(56,189,248,0.35);border-radius:18px;padding:1.5rem;box-shadow:0 12px 35px rgba(0,0,0,0.6);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;flex-wrap:wrap;gap:8px;">
            <h4 style="margin:0;font-size:1.15rem;font-weight:800;color:#38bdf8;">Eje: ${escapeHtml(data.title)}</h4>
            <span style="font-size:0.75rem;font-weight:700;background:rgba(56,189,248,0.18);color:#7dd3fc;padding:3px 10px;border-radius:999px;border:1px solid rgba(56,189,248,0.3);text-transform:uppercase;">Pilar: ${escapeHtml(data.pilar)}</span>
          </div>
          <p style="margin:0 0 1rem 0;font-size:0.88rem;color:#cbd5e1;line-height:1.5;">${escapeHtml(data.desc)}</p>
          <div style="margin-bottom:1.25rem;">
            <strong style="display:block;font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;color:#facc15;margin-bottom:0.4rem;">Ideas de proyectos para la Red de Caminantes:</strong>
            <ul style="margin:0;padding-left:1.2rem;font-size:0.85rem;color:#e2e8f0;line-height:1.6;">
              ${data.ideas.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}
            </ul>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button type="button" class="btn-adc-shelf-jump" style="background:#2563eb;color:#ffffff;border:none;border-radius:999px;padding:8px 16px;font-size:0.82rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
              <span>Ver manuales en Biblioteca</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
            <button type="button" class="btn-adc-query-jump" style="background:rgba(255,255,255,0.08);color:#f8fafc;border:1px solid rgba(255,255,255,0.2);border-radius:999px;padding:8px 16px;font-size:0.82rem;font-weight:600;cursor:pointer;">
              Consultar en el Buscador
            </button>
          </div>
        </div>
      `;

      const shelfJumpBtn = tray.querySelector(".btn-adc-shelf-jump");
      if (shelfJumpBtn) {
        shelfJumpBtn.onclick = () => {
          const biblio = document.getElementById("biblioteca");
          if (biblio) biblio.scrollIntoView({ behavior: "smooth", block: "start" });
        };
      }

      const queryJumpBtn = tray.querySelector(".btn-adc-query-jump");
      if (queryJumpBtn) {
        queryJumpBtn.onclick = () => {
          submitQuestion(data.query, { syncInput: true });
        };
      }
    };

    item.addEventListener("click", trigger);
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        trigger();
      }
    });
  });
}

// ============================================================================
// DOCK INFERIOR FLOTANTE UNIFICADO (MÓVIL & ANDROID APP)
// ============================================================================

function setupUnifiedDock() {
  const dock = document.getElementById("unifiedBottomDock");
  if (!dock) return;

  const items = dock.querySelectorAll(".bt-dock-item");
  items.forEach((item) => {
    item.addEventListener("click", (e) => {
      BiblioFeel.pulse(8);
      const action = item.getAttribute("data-action");
      const target = item.getAttribute("data-target");

      if (action === "saved") {
        e.preventDefault();
        openSavedPanel();
        items.forEach((i) => i.classList.remove("is-active"));
        item.classList.add("is-active");
        return;
      }

      if (action === "night") {
        e.preventDefault();
        BiblioFeel.toggleCampMode();
        const isNight = document.documentElement.getAttribute("data-camp-mode") === "true";
        item.setAttribute("aria-pressed", isNight ? "true" : "false");
        item.classList.toggle("is-active", isNight);
        return;
      }

      if (target) {
        e.preventDefault();
        const el = document.getElementById(target);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        items.forEach((i) => i.classList.remove("is-active"));
        item.classList.add("is-active");
      }
    });
  });

  // Cerrar panel de guardados al pulsar backdrop, Escape o botones con data-close-saved
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-saved]")) {
      e.preventDefault();
      closeSavedPanel();
    }
  });
  document.addEventListener("keydown", (e) => {
    const panel = document.getElementById("savedPanel");
    if (e.key === "Escape" && panel && !panel.classList.contains("hidden")) {
      closeSavedPanel();
    }
  });

  // Vincular scroll spy con los items del dock (throttled con requestAnimationFrame)
  const dockSpyTargets = ["inicio", "buscador", "biblioteca", "agentes"];
  let dockScrollTicking = false;
  const updateDockSpy = () => {
    const sy = window.scrollY + 180;
    for (let i = dockSpyTargets.length - 1; i >= 0; i--) {
      const id = dockSpyTargets[i];
      const sec = document.getElementById(id);
      if (sec && sec.offsetTop <= sy) {
        items.forEach((item) => {
          if (item.getAttribute("data-target") === id) {
            items.forEach((it) => it.classList.remove("is-active"));
            item.classList.add("is-active");
          }
        });
        break;
      }
    }
    dockScrollTicking = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (dockScrollTicking) return;
      dockScrollTicking = true;
      window.requestAnimationFrame(updateDockSpy);
    },
    { passive: true }
  );

  updateSavedBadge();
}

function syncThemeColorMetas(isDark) {
  const color = isDark ? "#0a0616" : "#f8fafc";
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute("content", color);
  });
}

function setupIosExperience() {
  const root = document.documentElement;
  if (IS_APPLE_TOUCH) root.setAttribute("data-ios-safari", "true");
  const isStandalone =
    !window.Capacitor &&
    (window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches));
  if (isStandalone) {
    root.setAttribute("data-ios-standalone", "true");
    const statusPill = document.getElementById("iosStandaloneStatus");
    if (statusPill) statusPill.classList.remove("hidden");
  }

  const tabAndroid = document.getElementById("tabAppAndroid");
  const tabIos = document.getElementById("tabAppIos");
  const paneAndroid = document.getElementById("paneAppAndroid");
  const paneIos = document.getElementById("paneAppIos");
  const guideAndroid = document.getElementById("appGuideAndroid");
  const guideIos = document.getElementById("appGuideIos");

  const setPlatform = (platform) => {
    const isIos = platform === "ios";
    if (tabAndroid) {
      tabAndroid.classList.toggle("active", !isIos);
      tabAndroid.setAttribute("aria-selected", String(!isIos));
    }
    if (tabIos) {
      tabIos.classList.toggle("active", isIos);
      tabIos.setAttribute("aria-selected", String(isIos));
    }
    if (paneAndroid) paneAndroid.classList.toggle("hidden", isIos);
    if (paneIos) paneIos.classList.toggle("hidden", !isIos);
    if (guideAndroid) guideAndroid.classList.toggle("hidden", isIos);
    if (guideIos) guideIos.classList.toggle("hidden", !isIos);
  };

  if (tabAndroid) tabAndroid.addEventListener("click", () => setPlatform("android"));
  if (tabIos) tabIos.addEventListener("click", () => setPlatform("ios"));
  if (IS_APPLE_TOUCH) setPlatform("ios");

  const copyBtn = document.getElementById("copyIosUrlBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const url = "https://ey-liam.github.io/bibliotech-scouts/";
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        }
        showWebToast("Enlace copiado. Ábrelo en Safari y toca Agregar a pantalla de inicio.");
      } catch (_) {
        showWebToast("Copia: https://ey-liam.github.io/bibliotech-scouts/");
      }
    });
  }
}

// ============================================================================
// PRIVACIDAD, COOKIES, PREGUNTAS RECIENTES Y TELEMETRÍA ANÓNIMA INTEGRAL
// - En App Android (Capacitor) se habilita automáticamente sin mostrar banner.
// - En Web / iOS Safari / iOS App Web solicita autorización clara al entrar.
// - Registra de forma 100 % anónima (sin nombres, correos ni datos personales):
//   plataforma y vista, secciones vistas, filtros usados, búsquedas, archivos
//   abiertos/leídos/descargados, enlaces externos, preguntas y respuestas
//   completas + valoraciones, con top acumulado de uso.
// ============================================================================
const BT_CONSENT_KEY = "bt_consent_v1";
const BT_RECENT_QUERIES_KEY = "bt_recent_queries_v1";
const BT_ANON_QUEUE_KEY = "bt_anon_queue_v1";
const BT_ANON_STATS_KEY = "bt_anon_stats_v1";
const BT_LAST_SENT_KEY = "bt_last_telemetry_sent_v1";
const BT_SESSION_ID = "ses_" + Math.random().toString(36).slice(2, 8);

function hasTelemetryConsent() {
  try {
    if (window.Capacitor) return true;
    return localStorage.getItem(BT_CONSENT_KEY) === "accepted";
  } catch (_) {
    return false;
  }
}

function summarizeMarkdownPlain(mdText, maxLen = 2500) {
  const clean = String(mdText || "")
    .replace(/[#>*_`~|\[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen).trim() + "…";
}

function detectClientContext() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const w = window.innerWidth || 0;
  const h = window.innerHeight || 0;
  const isStandalone =
    window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);

  let os = "Desktop";
  if (window.Capacitor) os = "Android";
  else if (IS_APPLE_TOUCH || /iPhone|iPad|iPod/i.test(ua)) os = "iOS/iPadOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Navegador";
  if (window.Capacitor) browser = "App Android APK";
  else if (isStandalone && os === "iOS/iPadOS") browser = "iOS App Web (Pantalla inicio)";
  else if (isStandalone && os === "Android") browser = "Android PWA";
  else if (/EdgA?|EdgiOS/i.test(ua)) browser = "Edge";
  else if (/OPR|Opera/i.test(ua)) browser = "Opera";
  else if (/CriOS|Chrome/i.test(ua)) browser = "Chrome";
  else if (/FxiOS|Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua)) browser = "Safari";

  const viewMode = w <= 600 ? "Móvil" : w <= 1024 ? "Tablet" : "Escritorio";
  const theme = document.documentElement.getAttribute("data-camp-mode") === "true" ? "Oscuro" : "Claro";

  return {
    plat: window.Capacitor ? "AndroidAPK" : isStandalone ? `${os}_AppWeb` : `${os}_${browser}`,
    browser,
    os,
    vista: `${viewMode} (${w}x${h})`,
    tema: theme,
    idioma: (navigator && navigator.language) || "es"
  };
}

function bumpStatCounter(bucketKey, itemKey, limit = 25) {
  if (!hasTelemetryConsent() || !itemKey) return;
  try {
    const raw = JSON.parse(localStorage.getItem(BT_ANON_STATS_KEY) || "{}");
    const stats = raw && typeof raw === "object" ? raw : {};
    const bucket = stats[bucketKey] && typeof stats[bucketKey] === "object" ? stats[bucketKey] : {};
    const cleanKey = String(itemKey).trim().slice(0, 120);
    if (!cleanKey) return;
    bucket[cleanKey] = Number(bucket[cleanKey] || 0) + 1;
    // Conservar solo los elementos más frecuentes para mantener acotado localStorage
    const entries = Object.entries(bucket).sort((a, b) => b[1] - a[1]).slice(0, limit);
    stats[bucketKey] = Object.fromEntries(entries);
    localStorage.setItem(BT_ANON_STATS_KEY, JSON.stringify(stats));
  } catch (_) {}
}

function formatTopStatsBlock() {
  try {
    const stats = JSON.parse(localStorage.getItem(BT_ANON_STATS_KEY) || "{}");
    const fmt = (title, obj) => {
      const entries = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
      if (!entries.length) return "";
      return `${title}:\n` + entries.map(([k, v]) => `  - ${k} (${v})`).join("\n");
    };
    const qaTotals = stats.qaTotals || {};
    const qaSummary =
      qaTotals.ok || qaTotals.miss
        ? `Preguntas respondidas: ${qaTotals.ok || 0} | Sin coincidencia: ${qaTotals.miss || 0}`
        : "";
    return [
      qaSummary,
      fmt("Top archivos más vistos/descargados", stats.topDocs),
      fmt("Top filtros más usados", stats.topFilters),
      fmt("Top secciones visitadas", stats.topSections),
      fmt("Top consultas repetidas", stats.topQueries)
    ]
      .filter(Boolean)
      .join("\n");
  } catch (_) {
    return "";
  }
}

function renderRecentQueriesUI() {
  const row = document.getElementById("recentQueriesRow");
  const chips = document.getElementById("recentQueriesChips");
  if (!row || !chips) return;

  if (!hasTelemetryConsent()) {
    row.classList.add("hidden");
    chips.innerHTML = "";
    return;
  }

  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(BT_RECENT_QUERIES_KEY) || "[]");
  } catch (_) {
    list = [];
  }
  if (!Array.isArray(list) || !list.length) {
    row.classList.add("hidden");
    chips.innerHTML = "";
    return;
  }

  row.classList.remove("hidden");
  chips.innerHTML = list
    .slice(0, 8)
    .map(
      (q) =>
        `<button type="button" class="recent-query-chip" data-recent-query="${escapeHtml(q)}">${escapeHtml(q)}</button>`
    )
    .join("");
}

function saveRecentQueryLocal(query) {
  if (!hasTelemetryConsent()) return;
  const q = String(query || "").trim();
  if (q.length < 2) return;
  try {
    const prev = JSON.parse(localStorage.getItem(BT_RECENT_QUERIES_KEY) || "[]");
    const normNew = normalizeStr(q);
    const filtered = (Array.isArray(prev) ? prev : []).filter((item) => normalizeStr(item) !== normNew);
    filtered.unshift(q);
    localStorage.setItem(BT_RECENT_QUERIES_KEY, JSON.stringify(filtered.slice(0, 8)));
    renderRecentQueriesUI();
  } catch (_) {}
}

let btBatchCheckScheduled = false;
function enqueueAnonTelemetry(entry, flushNow = false) {
  if (!hasTelemetryConsent()) return;
  const ctx = detectClientContext();
  let qLen = 0;
  try {
    const prev = JSON.parse(localStorage.getItem(BT_ANON_QUEUE_KEY) || "[]");
    const queue = Array.isArray(prev) ? prev : [];
    queue.push({
      ...entry,
      ts: new Date().toISOString().slice(0, 19).replace("T", " "),
      ses: BT_SESSION_ID,
      plat: ctx.plat,
      vista: ctx.vista,
      tema: ctx.tema
    });
    const trimmed = queue.slice(-80);
    qLen = trimmed.length;
    localStorage.setItem(BT_ANON_QUEUE_KEY, JSON.stringify(trimmed));
  } catch (_) {}

  if (flushNow) {
    flushAnonymousTelemetry(true);
  } else if (qLen >= 8 && !btBatchCheckScheduled) {
    btBatchCheckScheduled = true;
    setTimeout(() => {
      btBatchCheckScheduled = false;
      flushAnonymousTelemetry(false);
    }, 15000);
  }
}

window.btTrackEvent = function btTrackEvent(type, payload = {}, flushNow = false) {
  enqueueAnonTelemetry({ t: type, ...payload }, flushNow);
};

function recordQueryTelemetry(query, data, querySource = "manual") {
  const q = String(query || "").trim();
  if (!q) return;
  saveRecentQueryLocal(q);
  const sources = Array.isArray(data && data.sources) ? data.sources : [];
  const answerFull = summarizeMarkdownPlain(data && data.answer_markdown, 2500);
  const unmatched =
    !sources.length && /no encontr[eé]|sin resultados|reformul|espec[ií]fica/i.test(answerFull);

  bumpStatCounter("topQueries", q, 25);
  try {
    if (hasTelemetryConsent()) {
      const stats = JSON.parse(localStorage.getItem(BT_ANON_STATS_KEY) || "{}");
      const totals = stats.qaTotals || { ok: 0, miss: 0 };
      if (unmatched) totals.miss = Number(totals.miss || 0) + 1;
      else totals.ok = Number(totals.ok || 0) + 1;
      stats.qaTotals = totals;
      localStorage.setItem(BT_ANON_STATS_KEY, JSON.stringify(stats));
    }
  } catch (_) {}

  enqueueAnonTelemetry(
    {
      t: "pregunta",
      origen: querySource,
      q,
      ans: answerFull,
      ok: unmatched ? "sin_coincidencia" : "respondida",
      src: sources.length,
      fuentes: sources.slice(0, 5).map((s) => s.title).join(" | "),
      sec: STATE.activeAskSection || "all"
    },
    false
  );
}

function recordDocOpenTelemetry(doc, sourceOrigin = "modal") {
  if (!doc) return;
  bumpStatCounter("topDocs", `${doc.title} [${doc.ext || "DOC"}]`, 30);
  enqueueAnonTelemetry(
    {
      t: "doc_abierto",
      origen: sourceOrigin,
      doc: String(doc.title || "").slice(0, 140),
      file: String(doc.filename || "").slice(0, 120),
      cat: String(doc.category || "").slice(0, 60),
      subcat: String(doc.subcategory || "").slice(0, 60),
      sec: String(doc.section_label || "").slice(0, 40),
      year: doc.year || ""
    },
    false
  );
}

let btSearchTelemetryTimer = null;
function scheduleSearchTelemetry(scope, queryText, resultCount) {
  const term = String(queryText || "").trim();
  if (!hasTelemetryConsent() || term.length < 2) return;
  if (btSearchTelemetryTimer) clearTimeout(btSearchTelemetryTimer);
  btSearchTelemetryTimer = setTimeout(() => {
    bumpStatCounter("topFilters", `buscar:${scope}:${term.toLowerCase()}`, 25);
    enqueueAnonTelemetry(
      {
        t: "busqueda_archivo",
        scope,
        q: term.slice(0, 120),
        hits: Number(resultCount || 0)
      },
      false
    );
  }, 1200);
}

function updateAnswerFeedbackUI(queryText, data, sourcesCount) {
  const bar = document.getElementById("answerFeedbackBar");
  const btnUseful = document.getElementById("btnFeedbackUseful");
  const btnReport = document.getElementById("btnFeedbackReport");
  if (!bar) return;

  const titleEl = document.getElementById("answerQuestionTitle");
  const effectiveQuery = String(queryText || (titleEl ? titleEl.textContent : "") || "").trim();
  STATE.lastAnswerContext = {
    query: effectiveQuery,
    answerPreview: summarizeMarkdownPlain(data && data.answer_markdown, 2500),
    sourcesCount: Number(sourcesCount || 0),
    ratingSent: ""
  };

  if (btnUseful) {
    btnUseful.classList.remove("is-selected");
    btnUseful.disabled = false;
    btnUseful.textContent = "Útil";
  }
  if (btnReport) {
    btnReport.classList.remove("is-selected");
    btnReport.disabled = false;
    btnReport.textContent = "Reportar fallo o falta info";
  }
  bar.classList.remove("hidden");
}

function formatTelemetryEventLine(ev, idx) {
  const head = `${idx + 1}. [${ev.ts} · ${ev.ses || ""}]`;
  switch (ev.t) {
    case "sesion":
      return `${head} INICIO SESIÓN | ${ev.plat} | ${ev.vista} | Tema ${ev.tema} | Lang ${ev.idioma}`;
    case "pregunta":
      return `${head} PREGUNTA (${ev.origen || "manual"}, sec:${ev.sec}, ${ev.ok}, ${ev.src} fuentes)\n   P: ${ev.q}\n   R: ${ev.ans}${ev.fuentes ? `\n   Fuentes: ${ev.fuentes}` : ""}`;
    case "feedback":
      return `${head} VALORACIÓN: ${ev.rate}\n   P: ${ev.q}\n   R: ${ev.ans}`;
    case "doc_abierto":
      return `${head} DOC ABIERTO (${ev.origen}): ${ev.doc} (${ev.file}) [${ev.cat}${ev.subcat ? " / " + ev.subcat : ""} · ${ev.sec} · ${ev.year}]`;
    case "doc_descarga":
      return `${head} DOC DESCARGADO (${ev.origen || "web"}): ${ev.doc} (${ev.file || ""})`;
    case "doc_offline_apk":
      return `${head} APK DESCARGA OFFLINE: ${ev.doc} (${ev.ext || ""})`;
    case "pdf_nativo_apk":
      return `${head} APK LECTOR NATIVO: ${ev.doc} (${ev.ext || "pdf"})`;
    case "doc_visor_accion":
      return `${head} VISOR DOC (${ev.accion}): ${ev.doc || ""}`;
    case "doc_guardado":
      return `${head} GUARDADOS (${ev.accion}): ${ev.doc || ""}`;
    case "busqueda_archivo":
      return `${head} BÚSQUEDA [${ev.scope}]: "${ev.q}" -> ${ev.hits} docs`;
    case "filtro_usado":
      return `${head} FILTRO [${ev.filtro}]: ${ev.valor}`;
    case "vista_seccion":
      return `${head} SECCIÓN / MENÚ: ${ev.sec} (${ev.via || "scroll"})`;
    case "enlace_externo":
      return `${head} ENLACE EXTERNO: ${ev.label || ""} -> ${ev.url || ""}`;
    default:
      return `${head} ${ev.t}: ${JSON.stringify(ev).slice(0, 260)}`;
  }
}

let btFlushInFlight = false;
async function flushAnonymousTelemetry(forceImmediate = false) {
  if (!hasTelemetryConsent() || btFlushInFlight) return;
  // Nunca enviar telemetría externa durante pruebas en servidor local
  const host = String((window.location && window.location.hostname) || "").toLowerCase();
  if (host === "127.0.0.1" || host === "localhost" || host === "::1" || window.location.protocol === "file:") {
    return;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  let queue = [];
  try {
    queue = JSON.parse(localStorage.getItem(BT_ANON_QUEUE_KEY) || "[]");
  } catch (_) {
    queue = [];
  }
  if (!Array.isArray(queue) || !queue.length) return;

  const now = Date.now();
  const lastSent = Number(localStorage.getItem(BT_LAST_SENT_KEY) || "0");
  if (!forceImmediate && now - lastSent < 45000 && queue.length < 10) {
    return;
  }

  btFlushInFlight = true;
  try {
    const batch = queue.slice(0, 20);
    const ctx = detectClientContext();
    const lines = batch.map((ev, i) => formatTelemetryEventLine(ev, i));
    const statsBlock = formatTopStatsBlock();

    const endpoint = `https://formsubmit.co/ajax/${encodeURIComponent(STATE.contactEmail || "rdc.tlxh@gmail.com")}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        _subject: `BiblioTech Scout [${ctx.plat}] — ${batch.length} acciones anónimas (${BT_SESSION_ID})`,
        _template: "table",
        _captcha: "false",
        plataforma: `${ctx.plat} · ${ctx.vista}`,
        navegador_y_tema: `${ctx.browser} (${ctx.os}) · Tema ${ctx.tema}`,
        sesion_y_eventos: `${BT_SESSION_ID} (${batch.length} eventos en este envío)`,
        resumen_mas_usado: statsBlock || "Primeros eventos acumulados",
        actividad_completa: lines.join("\n\n")
      }),
      keepalive: true
    });
    if (res && res.ok) {
      const remaining = queue.slice(batch.length);
      localStorage.setItem(BT_ANON_QUEUE_KEY, JSON.stringify(remaining));
      localStorage.setItem(BT_LAST_SENT_KEY, String(Date.now()));
    }
  } catch (_) {
    // Reintentar en el siguiente ciclo/sesión si falla la red
  } finally {
    btFlushInFlight = false;
  }
}

let btObserversInitialized = false;
function setupFullActivityObservers() {
  if (btObserversInitialized) return;
  btObserversInitialized = true;

  const ctx = detectClientContext();
  enqueueAnonTelemetry(
    {
      t: "sesion",
      idioma: ctx.idioma,
      hash: (window.location && window.location.hash) || "#inicio"
    },
    false
  );

  // 1. Secciones visibles por scroll (deduplicadas una vez por sesión)
  const seenSections = new Set();
  if ("IntersectionObserver" in window) {
    const secObs = new IntersectionObserver(
      (entries) => {
        for (const ent of entries) {
          if (ent.isIntersecting && ent.target && ent.target.id && !seenSections.has(ent.target.id)) {
            seenSections.add(ent.target.id);
            bumpStatCounter("topSections", `#${ent.target.id}`, 20);
            enqueueAnonTelemetry({ t: "vista_seccion", sec: `#${ent.target.id}`, via: "scroll" }, false);
          }
        }
      },
      { threshold: 0.25 }
    );
    document.querySelectorAll("main section[id], footer.site-footer").forEach((el) => {
      if (el.id) secObs.observe(el);
    });
  }

  // 2. Delegación única para clics en filtros, menú, dock, descargas, pestañas y enlaces
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target && e.target.closest ? e.target : null;
      if (!target) return;

      const dlBtn = target.closest("[data-dl-doc]");
      if (dlBtn) {
        const doc = STATE.docsById[dlBtn.getAttribute("data-dl-doc")];
        if (doc) {
          bumpStatCounter("topDocs", `${doc.title} [${doc.ext || "DOC"}]`, 30);
          enqueueAnonTelemetry({ t: "doc_descarga", origen: "catalogo", doc: doc.title, file: doc.filename }, false);
        }
        return;
      }

      const modalDl = target.closest("#modalDownloadBtn");
      if (modalDl) {
        const title = (document.getElementById("modalDocTitle") || {}).textContent || "";
        bumpStatCounter("topDocs", `${title} [DESCARGA]`, 30);
        enqueueAnonTelemetry({ t: "doc_descarga", origen: "visor_modal", doc: title }, false);
        return;
      }

      const modalOpenTab = target.closest("#modalOpenTabBtn");
      if (modalOpenTab) {
        const title = (document.getElementById("modalDocTitle") || {}).textContent || "";
        enqueueAnonTelemetry({ t: "doc_visor_accion", accion: "abrir_pestaña", doc: title }, false);
        return;
      }

      const modalTab = target.closest(".modal-tab");
      if (modalTab) {
        const title = (document.getElementById("modalDocTitle") || {}).textContent || "";
        enqueueAnonTelemetry({ t: "doc_visor_accion", accion: `tab_${modalTab.dataset.tab || "otra"}`, doc: title }, false);
        return;
      }

      const ttsBtn = target.closest("#modalAudioReadBtn");
      if (ttsBtn) {
        const title = (document.getElementById("modalDocTitle") || {}).textContent || "";
        enqueueAnonTelemetry({ t: "doc_visor_accion", accion: "audio_tts", doc: title }, false);
        return;
      }

      const shelfTab = target.closest(".shelf-tab, [data-select-shelf]");
      if (shelfTab) {
        const val = shelfTab.dataset.shelf || shelfTab.getAttribute("data-select-shelf") || "";
        bumpStatCounter("topFilters", `estante:${val}`, 25);
        enqueueAnonTelemetry({ t: "filtro_usado", filtro: "estante", valor: val }, false);
        return;
      }

      const catPill = target.closest(".cat-filter-pill");
      if (catPill) {
        const val = catPill.getAttribute("data-cat-val") || "";
        bumpStatCounter("topFilters", `categoria:${val}`, 25);
        enqueueAnonTelemetry({ t: "filtro_usado", filtro: "categoria_pill", valor: val }, false);
        return;
      }

      const subPill = target.closest(".subcat-pill");
      if (subPill) {
        const val = subPill.textContent.trim();
        bumpStatCounter("topFilters", `subcategoria:${val}`, 25);
        enqueueAnonTelemetry({ t: "filtro_usado", filtro: "subcategoria", valor: val }, false);
        return;
      }

      const qcatTab = target.closest(".qcat-tab");
      if (qcatTab) {
        const val = qcatTab.dataset.qcat || qcatTab.textContent.trim();
        bumpStatCounter("topFilters", `tema_preguntas:${val}`, 25);
        enqueueAnonTelemetry({ t: "filtro_usado", filtro: "tema_preguntas", valor: val }, false);
        return;
      }

      const secPill = target.closest(".sec-pill");
      if (secPill) {
        const val = secPill.dataset.section || secPill.textContent.trim();
        bumpStatCounter("topFilters", `seccion_buscador:${val}`, 25);
        enqueueAnonTelemetry({ t: "filtro_usado", filtro: "seccion_buscador", valor: val }, false);
        return;
      }

      if (target.closest("#randomPoolBtn")) {
        bumpStatCounter("topFilters", "preguntas_al_azar", 25);
        enqueueAnonTelemetry({ t: "filtro_usado", filtro: "preguntas_al_azar", valor: "activar" }, false);
        return;
      }

      if (target.closest("#shuffleQuestionsBtn")) {
        bumpStatCounter("topFilters", "recargar_preguntas_azar", 25);
        enqueueAnonTelemetry({ t: "filtro_usado", filtro: "recargar_azar", valor: STATE.activeQCat || "random" }, false);
        return;
      }

      if (target.closest("#btnToggleCampMode, #dockBtnNight")) {
        enqueueAnonTelemetry({ t: "filtro_usado", filtro: "tema_visual", valor: "alternar_modo_noche" }, false);
        return;
      }

      const dockItem = target.closest(".bt-dock-item, header nav a, #mobileNavMenu a");
      if (dockItem) {
        const dest = dockItem.getAttribute("data-target") || dockItem.getAttribute("href") || dockItem.getAttribute("data-action") || dockItem.textContent.trim();
        bumpStatCounter("topSections", dest, 20);
        enqueueAnonTelemetry({ t: "vista_seccion", sec: dest, via: "menu_o_dock" }, false);
        return;
      }

      if (target.closest("#copyIosUrlBtn")) {
        enqueueAnonTelemetry({ t: "enlace_externo", label: "Copiar enlace iOS Safari", url: "pwa-ios" }, false);
        return;
      }

      const extLink = target.closest('a[href^="http"]');
      if (extLink) {
        enqueueAnonTelemetry(
          {
            t: "enlace_externo",
            label: extLink.textContent.trim().slice(0, 60),
            url: extLink.href
          },
          false
        );
      }
    },
    true
  );

  // 3. Delegación única para selectores <select> y checkboxes de filtros
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (!el || !el.id) return;
    const trackedIds = {
      librarySectionFilter: "bib_seccion",
      libraryScopeSelect: "bib_alcance",
      filterCategory: "cat_categoria",
      filterSubcategory: "cat_subcategoria",
      filterSection: "cat_seccion",
      filterExt: "cat_formato",
      sortOrderSelect: "cat_orden",
      onlyLatestCheckbox: "cat_solo_vigentes"
    };
    if (trackedIds[el.id]) {
      const val = el.type === "checkbox" ? String(el.checked) : String(el.value || "all");
      bumpStatCounter("topFilters", `${trackedIds[el.id]}:${val}`, 25);
      enqueueAnonTelemetry({ t: "filtro_usado", filtro: trackedIds[el.id], valor: val }, false);
    }
  });
}

function initPrivacyAndTelemetry() {
  const overlay = document.getElementById("cookieConsentBanner");
  const acceptBtn = document.getElementById("consentAcceptBtn");
  const declineBtn = document.getElementById("consentDeclineBtn");
  const openPrefsBtn = document.getElementById("openConsentModalBtn");
  const recentChips = document.getElementById("recentQueriesChips");
  const btnUseful = document.getElementById("btnFeedbackUseful");
  const btnReport = document.getElementById("btnFeedbackReport");

  // En APK Android el sistema acepta automáticamente el análisis anónimo sin interrumpir
  if (window.Capacitor) {
    try {
      localStorage.setItem(BT_CONSENT_KEY, "accepted");
    } catch (_) {}
    if (overlay) overlay.classList.add("hidden");
  } else {
    let saved = null;
    try {
      saved = localStorage.getItem(BT_CONSENT_KEY);
    } catch (_) {}
    if (!saved && overlay) {
      overlay.classList.remove("hidden");
    }
  }

  const applyChoice = (choice) => {
    try {
      localStorage.setItem(BT_CONSENT_KEY, choice);
      if (choice !== "accepted") {
        localStorage.removeItem(BT_ANON_QUEUE_KEY);
        localStorage.removeItem(BT_ANON_STATS_KEY);
      }
    } catch (_) {}
    if (overlay) overlay.classList.add("hidden");
    renderRecentQueriesUI();
    if (choice === "accepted") {
      setupFullActivityObservers();
      showWebToast("Preferencias guardadas. Gracias por ayudar a mejorar BiblioTech.");
      flushAnonymousTelemetry(false);
    } else {
      showWebToast("Solo almacenamiento esencial activado en este navegador.");
    }
  };

  if (acceptBtn) acceptBtn.addEventListener("click", () => applyChoice("accepted"));
  if (declineBtn) declineBtn.addEventListener("click", () => applyChoice("declined"));
  if (openPrefsBtn && overlay) {
    openPrefsBtn.addEventListener("click", () => overlay.classList.remove("hidden"));
  }

  if (recentChips) {
    recentChips.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-recent-query]");
      if (!chip) return;
      const q = chip.getAttribute("data-recent-query");
      if (q) submitQuestion(q, { syncInput: false, source: "reciente" });
    });
  }

  const handleFeedback = (ratingType) => {
    const ctx = STATE.lastAnswerContext;
    if (!ctx || ctx.ratingSent) return;
    ctx.ratingSent = ratingType;
    if (btnUseful) {
      btnUseful.classList.toggle("is-selected", ratingType === "useful");
      btnUseful.disabled = true;
    }
    if (btnReport) {
      btnReport.classList.toggle("is-selected", ratingType === "issue");
      btnReport.disabled = true;
    }
    if (hasTelemetryConsent()) {
      enqueueAnonTelemetry(
        {
          t: "feedback",
          rate: ratingType === "issue" ? "FALLO_O_FALTA_INFO" : "UTIL",
          q: ctx.query,
          ans: ctx.answerPreview,
          src: ctx.sourcesCount
        },
        true
      );
      showWebToast(
        ratingType === "issue"
          ? "Reporte anónimo registrado para revisión."
          : "Valoración anónima registrada. Gracias."
      );
    } else {
      showWebToast(
        ratingType === "issue"
          ? `Gracias por avisar. Puedes detallarlo en ${STATE.contactEmail}.`
          : "Gracias por tu valoración."
      );
    }
  };

  if (btnUseful) btnUseful.addEventListener("click", () => handleFeedback("useful"));
  if (btnReport) btnReport.addEventListener("click", () => handleFeedback("issue"));

  renderRecentQueriesUI();
  if (hasTelemetryConsent()) {
    setupFullActivityObservers();
  }

  // Envío al pasar a segundo plano (muy confiable en iOS Safari, Chrome móvil y APK)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushAnonymousTelemetry(true);
    }
  });
  window.addEventListener("pagehide", () => flushAnonymousTelemetry(true));
  setTimeout(() => flushAnonymousTelemetry(false), 12000);
}

document.addEventListener("DOMContentLoaded", initApp);

/* ============================================================================
 * DOCUMENTO MAESTRO UNIFICADO DE ARQUITECTURA, PROTOCOLO Y TRASPASO INTERNO
 * (Consolidación íntegra de AGENTS.md [Web y App], GEMINI.md,
 *  .github/copilot-instructions.md, TRASPASO.md y TRASPASO_GEMINI_ARGON.md)
 * ============================================================================
 *
 * Para: Próximos desarrolladores y agentes de IA
 * Fecha de corte: 11 de Noviembre de 2026
 * Versión actual del ecosistema: BETA V7 (Web) - V2.2.2 Mobile (Android)
 * Autor y Creador Exclusivo: Liam Durán - Provincia TLXH (Instagram: @liaadurg3)
 * Sitio Web Público: https://ey-liam.github.io/bibliotech-scouts/
 * Repositorio Web: https://github.com/ey-liam/bibliotech-scouts (rama main)
 * Repositorio App Android: https://github.com/ey-liam/bibliotech-scouts-app
 * Paquete Android: mx.bibliotechscout.app
 * APK Oficial Release: https://github.com/ey-liam/bibliotech-scouts-app/releases/latest/download/bibliotech-scout.apk
 *
 * ----------------------------------------------------------------------------
 * 1. OBJETIVO Y REGLAS FUNDAMENTALES (LECTURA OBLIGATORIA)
 * ----------------------------------------------------------------------------
 * BiblioTech Scout es un sitio estático (HTML, CSS y JavaScript sin compilación)
 * publicado con GitHub Pages y acompañado por su app Android en Capacitor 8.
 * Su prioridad es que cualquier persona pueda consultar y descargar
 * documentación oficial de ASMAC y WOSM de forma clara, rápida y accesible.
 *
 * Reglas estrictas del proyecto:
 * 1. Autoría y Colaboradores Exclusivos:
 *    - En todos los commits, PRs, README.md, licencias, créditos de interfaz y
 *      metadatos de GitHub, el único autor y creador reconocido es Liam Durán
 *      (ey-liam, correo verificado: rdc.tlxh@gmail.com / liamchuchundra1@gmail.com).
 *    - Bajo ninguna circunstancia se debe listar a agentes de IA (OpenCode,
 *      Antigravity, Gemini, Claude o Copilot) como autores o colaboradores en
 *      GitHub ni en la web.
 *    - Una tarea = una rama = un pull request. No trabajar directo en main.
 *      Nombres de rama: agent/opencode/<tema>, agent/gemini/<tema>,
 *      agent/copilot/<tema> o human/<tema>. Siempre fusionar a main con
 *      --squash y eliminar la rama para conservar un historial limpio.
 * 2. Cero Emojis en Código y Menús:
 *    - No utilizar emojis gráficos en ninguna parte del código fuente, menús,
 *      textos, títulos de botones, commits ni etiquetas. Únicamente iconos SVG
 *      vectoriales limpios y accesibles con atributos ARIA.
 * 3. Privacidad, Seguridad y Documentos Sensibles:
 *    - El acervo documental se compone únicamente de publicaciones, manuales,
 *      reglamentos, carnets y documentos públicos e institucionales de ASMAC y
 *      World Scouting (WOSM).
 *    - Jamás indexar ni subir documentos personales, consentimientos médicos,
 *      formatos con datos privados ni fotografías familiares de carpetas
 *      locales como SCOUTS DOCUMENTOS.
 *    - No subir tokens, contraseñas, keystores, archivos .env ni service.json.
 *      El MCP de GitHub obtiene el token de gh en tiempo de ejecución y la firma
 *      del APK usa secretos de GitHub Actions.
 * 4. Prohibición de Edición Manual de JSON Generados y Rigor Documental:
 *    - No editar a mano data/catalog.json, data/knowledge_base.json,
 *      data/questions_bank.json, data/faq_v3.json, data/faq_v4.json ni
 *      data/chunks.json. Todos salen de scripts generadores.
 *    - No inventar información documental: las respuestas deben salir únicamente
 *      de los documentos oficiales y de la base de conocimiento del proyecto.
 * 5. Sincronización Antes de Editar y entre Web y App:
 *    - Antes de empezar: git fetch origin y actualizar la rama desde
 *      origin/main (git rebase origin/main o git merge origin/main).
 *    - Cualquier cambio en la lógica web, estilos o base de datos de
 *      bibliotech-scouts debe sincronizarse en bibliotech-scouts-app con
 *      npm run sync:web y npx cap sync android.
 * 6. Cambios Pequeños, Respeto al Trabajo Ajeno y Accesibilidad:
 *    - Evitar PRs gigantes que mezclen datos, diseño y lógica.
 *    - Si un archivo tiene cambios ajenos, investigarlos antes de reemplazar.
 *    - Accesibilidad y rendimiento no son opcionales: cada cambio debe mantener
 *      o mejorar el resultado de Lighthouse, sin quitar alt, ARIA ni enlace de
 *      salto al contenido.
 * 7. Precaución con Scripts de Copia Masiva en Copia Local (Antigravity/Gemini):
 *    - En C:\Users\liamc\.gemini\antigravity\scratch\bibliotech-scouts\ existen
 *      public/ (fuente de scripts de generación) y dist_web/ (clon git).
 *    - prepare_public_site.py copia public/ sobre dist_web/. No ejecutar
 *      prepare_public_site.py, actualizar_bibliotech.bat ni PUBLICAR_WEB.bat
 *      mientras otro agente esté editando el sitio, y nunca antes de sincronizar
 *      index.html, styles.css, app.js, img/ y assets/ desde main hacia public/.
 * 8. Reglas Adicionales de la App Android (bibliotech-scouts-app):
 *    - Los cambios de interfaz nativa van en web-overlay/; no modificar app.js
 *      del sitio salvo necesidad justificada.
 *    - Si cambia el contrato con el sitio (rutas de datos, files/, catálogo),
 *      actualizar web-overlay/native-bridge.js y el README.
 *    - Cada cambio debe compilar en el workflow de Android antes de fusionarse.
 * 9. Idioma y Tono:
 *    - Contenido de cara al usuario redactado en español latinoamericano, con
 *      tono cercano, scout y fraterno.
 *
 * ----------------------------------------------------------------------------
 * 2. MAPA DE ARCHIVOS Y ARQUITECTURA DE AMBOS REPOSITORIOS
 * ----------------------------------------------------------------------------
 *
 * A) Repositorio Web (ey-liam/bibliotech-scouts):
 * - index.html (editable con cuidado): Estructura semántica y accesible con SVGs
 *   embebidos. Hero V7, buscador, catálogo por sección, biblioteca de 498
 *   documentos, propósito/autor, Agentes de Cambio.MX, sección #app, lector
 *   interactivo modal (#docModal), panel de guardados (#savedPanel) y dock
 *   inferior (#unifiedBottomDock).
 * - styles.css (editable): Diseño responsivo, variables CSS temáticas scout,
 *   aurora animada, glassmorphism, transformaciones 3D, estilos cósmicos, modo
 *   campamento / noche OLED (html[data-camp-mode="true"]), dock claro y
 *   animaciones de resorte (--spring-bounce).
 * - app.js (editable): Motor principal: estado, buscador, lector, audio TTS
 *   (speechSynthesis), gestor de guardados híbrido y carga de datos.
 * - manifest.webmanifest / 404.html / sw.js: Manifiesto PWA, redirección de
 *   GitHub Pages y Service Worker.
 * - data/catalog.json (NO editar a mano): Catálogo curado de 650 documentos
 *   (498 libros/manuales descargables), con título, año, sección, categoría,
 *   páginas, sinopsis y hash SHA-12.
 * - data/knowledge_base.json (NO editar a mano): Base enciclopédica estructurada
 *   (110 temas).
 * - data/questions_bank.json, data/faq_v3.json y data/faq_v4.json (NO editar a
 *   mano): Banco combinado de 11,254 preguntas y respuestas únicas (5,356 base,
 *   101 V3 [primeros auxilios, uniforme, Agentes de Cambio] y 5,797 V4 generadas
 *   con scripts/generate_faq_v4.js). La ampliación V4 añade tres capas:
 *   convocatorias (dirigido a, sede, fechas, cuotas, requisitos, contacto y
 *   modalidad), formatos/actas/seguro (asunto, datos solicitados, autorizaciones
 *   y orden del día) y menciones textuales con página y cita, además de podar
 *   cortes arbitrarios y limpiar encabezados/membretes en resumen().
 * - data/chunks.json (NO editar a mano): Fragmentos textuales indexados para
 *   búsqueda profunda por términos.
 * - data/text/ (NO editar a mano): 650 archivos de texto plano indexados por
 *   su hash SHA-12 (<sha12>.txt) para lectura rápida y motor offline.
 * - covers/: 599 portadas en formato JPG (<sha12>.jpg) cubriendo todos los formatos accesibles.
 * - img/ y assets/: Logotipos e imágenes optimizadas (incluido Liam.png APNG,
 *   Liam.webp estático, LiamFondo.jpg y assets/scouts/agentes_cambio/ para CNRC).
 * - README.md: Presentación pública y guía de uso del proyecto.
 *
 * Funcionamiento del Motor de Respuestas en app.js:
 * 1. Carga en paralelo y diferida de catalog.json, questions_bank.json,
 *    faq_v3.json, faq_v4.json, knowledge_base.json y chunks.json.
 * 2. Normalización de consultas eliminando acentos, signos y caracteres
 *    especiales (normalizeQuestionKey).
 * 3. Búsqueda por 3 capas:
 *    - Capa 1 (Coincidencia exacta / normalizada): Respuesta directa del banco
 *      con documento oficial citado.
 *    - Capa 2 (Coincidencia difusa y palabras clave): Evalúa similitud léxica,
 *      n-gramas, stopwords y sinónimos en el banco de preguntas y knowledge base.
 *    - Capa 3 (Fragmentos de documentos - chunks.json): Localiza los párrafos
 *      más relevantes en manuales y estatutos citando página y documento.
 * 4. Respuesta transparente: Si un dato no existe en documentos oficiales
 *    cargados, el motor lo indica sin inventar ni alucinar datos.
 *
 * B) Repositorio App Android (ey-liam/bibliotech-scouts-app):
 * Envuelve el sitio web utilizando Capacitor 8 e inyecta una capa nativa:
 * - package.json: Versión 2.2.2 y versionLabel "V2.2.2 Mobile - Web V7 (11/11/2026)".
 * - scripts/sync-web.mjs: Clona o toma ../bibliotech-scouts como fuente hacia
 *   www/, copia index.html, styles.css, app.js, manifest.webmanifest, data/,
 *   img/, covers/ y BASE_ASSETS; parchea la leyenda del pie desde package.json;
 *   inyecta native-early.js en <head>, native.css y native-bridge.js al final;
 *   y genera www/app-build.json.
 *   Lista exacta BASE_ASSETS (15 recursos empaquetados sin galerías de 66 MB):
 *     assets/Liam.png, assets/Liam.webp, assets/LiamFondo.jpg,
 *     assets/scouts/logo_biblioteca_centenario.png,
 *     assets/scouts/foto_secciones_nac.png, assets/scouts/foros_extra_2.jpg,
 *     assets/scouts/foros_evento_3.jpg, assets/scouts/wosm_photo2.jpg,
 *     assets/scouts/agentes_cambio/AgentesDeCambioLogo.png,
 *     assets/scouts/agentes_cambio/Salud.png,
 *     assets/scouts/agentes_cambio/Habilidades.png,
 *     assets/scouts/agentes_cambio/Sustentabilidad.png,
 *     assets/scouts/agentes_cambio/Paz.png,
 *     assets/scouts/agentes_cambio/LetreroCNRC.png,
 *     assets/scouts/agentes_cambio/Logos.png.
 * - scripts/make-assets.mjs: Genera iconos adaptativos y splash desde img/icon-512.png.
 * - scripts/make-native-test.mjs: Crea native-test.html con mock para probar
 *   la capa nativa en navegador sin incluir páginas de prueba en el APK.
 * - web-overlay/native-early.js: Script en <head> para interceptar fetch y
 *   servir caché offline / actualizaciones OTA antes de arrancar app.js.
 * - web-overlay/native-bridge.js: Orquestador de Mi biblioteca, descargas con
 *   @capacitor/filesystem, visor PDF nativo, actualización OTA web/datos y
 *   verificación de versión APK contra releases/latest de GitHub.
 * - web-overlay/native.css: Estilos del botón flotante inferior izquierdo,
 *   modal de descargas, banner OTA y visores nativos.
 * - android/app/build.gradle: Configuración Android (applicationId
 *   mx.bibliotechscout.app, versionName 2.2.2, versionCode 11 y compilación
 *   sobreescrita en tag vía APP_VERSION_NAME / APP_VERSION_CODE).
 * - android/app/src/main/AndroidManifest.xml: Permiso único
 *   android.permission.INTERNET (sin REQUEST_INSTALL_PACKAGES).
 * - android/app/src/main/java/mx/bibliotechscout/app/:
 *   - MainActivity.java: Registra PdfViewerPlugin y OtaUpdaterPlugin e
 *     intercepta recursos locales activos OTA mediante WebViewClient.
 *   - PdfViewerPlugin.java: Renderiza páginas PDF en HD con android.graphics.pdf.PdfRenderer.
 *   - OtaUpdaterPlugin.java: Gestor atómico de staging/promoción/rollback OTA.
 * - .github/workflows/android.yml: Compila en Node 22 + Java 21 + Android SDK 36;
 *   en push/PR genera apk debug de prueba; en tags v<semver> firma con keystore de
 *   GitHub Secrets (ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD,
 *   ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD) y publica bibliotech-scout.apk.
 *
 * ----------------------------------------------------------------------------
 * 3. HISTORIAL TÉCNICO CONSOLIDADO DE APORTES (OPENCODE + ANTIGRAVITY)
 * ----------------------------------------------------------------------------
 * Evolución coordinada bajo la dirección de Liam Durán:
 * - Diagnóstico y mitigación de Play Protect en Android (OpenCode):
 *   Retiro de android.permission.REQUEST_INSTALL_PACKAGES, eliminación completa
 *   de NativeUpdaterPlugin.java, su registro en MainActivity.java y su
 *   FileProvider; actualización redirigida al navegador mediante GitHub Releases
 *   latest; creación de sección #app en la web con guía de instalación e
 *   indicaciones de seguridad; y prototipos de motor de respuestas directas con
 *   stopwords y sinónimos sin APIs externas.
 * - Lectura, Biblioteca Móvil y V5/V6 (Antigravity):
 *   - Botón único de descargas: eliminación de #bt-header-btn redundante,
 *     centralizado en #bt-offline-fab (esquina inferior izquierda) y
 *     #bt-nav-downloads en el menú lateral.
 *   - Zoom y pliego en tablets: eliminación del límite Math.max(1, ...) para
 *     permitir zoom de 40% (0.4) hasta 250% (2.5) y soporte de lectura en pliego
 *     de 2 páginas lado a lado en modo horizontal/tablets.
 *   - Visor directo de PDFs en web pública: buildFileUrl apuntando limpiamente a
 *     assets de GitHub Releases v1.0 (<sha12>.pdf) y Google Docs Viewer embebido
 *     en #modalPreviewPane y en «Abrir en pestaña», evitando texto plano forzado.
 *   - Sinopsis y barras del lector: #modalDocDescBox (.modal-doc-desc-box),
 *     extractos de 2 líneas .book-desc en estantes, cierre separado en
 *     .modal-header-top, barra desplazable en .modal-toolbar-row y filtros de
 *     #biblioteca nivelados a 40 px.
 *   - Rediseño cósmico de Agentes de Cambio.MX (CNRC): estelar cósmico, bordes
 *     cian neón, 4 Ejes Temáticos (Salud y Bienestar, Habilidades para la Vida,
 *     Paz y Participación Comunitaria, Medio Ambiente y Sustentabilidad) ligados
 *     a los 4 pilares de la educación, chips conectados en data/faq_v3.json,
 *     enlaces a cnrc@scouts.org.mx, Instagram @RNC.MX e Instagram @liaadurg3.
 * - Reestructuración V7 y Mobile 2.2.x (Antigravity + OpenCode):
 *   - Inicio V7: tarjeta central inclinada rotate(-2deg), cinta diagonal
 *     .hero-band azul-morada, texto centrado «By Liam», 10 iconos SVG blancos
 *     flotantes, extensión continua del fondo oscuro hasta #seccion-buscador y
 *     garantía visual de «BiblioTech Scout» sin truncar en móviles.
 *   - Sustitución de «Mochila» por «Guardados»: persistencia híbrida en
 *     document.cookie + localStorage (bt_saved_docs y bt_note_) con modal/sheet
 *     #savedPanel para ver, abrir o borrar guardados y notas de campo.
 *   - Dock unificado y Modo Noche OLED: .bt-unified-dock claro frosted glass
 *     oculto en escritorio (min-width: 921px), botón #dockBtnNight con
 *     aria-pressed, modo oscuro limpio (html[data-camp-mode="true"]) sin tintes
 *     amarillos, y botón visible en cabecera solo para escritorio sin duplicar.
 *   - Banco ampliado V4 y OTA: expansión a 11,254 preguntas únicas (5,797 en
 *     faq_v4.json) + capa OTA de interfaz/datos y capturas web/móvil en README.
 *
 * ----------------------------------------------------------------------------
 * 4. REPARTO DE ROLES, FLUJO DE TRABAJO, VALIDACIÓN Y DESPLIEGUE
 * ----------------------------------------------------------------------------
 * A) Reparto recomendado de trabajo:
 * - OpenCode: Mejoras de UI, accesibilidad, rendimiento y SEO; refactorizaciones
 *   pequeñas de app.js; validación local, Lighthouse y revisión técnica de PRs;
 *   conexión con GitHub vía MCP oficial.
 * - Antigravity / Gemini: Generación y actualización de data/<archivo>.json;
 *   extracción de texto, portadas y documentos; publicación de assets y sitio
 *   cuando corresponda desde dist_web; revisión de contenido y consistencia.
 * - GitHub Copilot: Revisión de PRs y sugerencias de código; correcciones
 *   pequeñas desde issues; explicación y pruebas cuando aplique (en plan
 *   Student usa selección automática de modelo; Claude puede aparecer mediante
 *   esa selección, sin elegirse manualmente).
 * - Persona (Liam): Decide alcance de contenido, aprueba merges y confirma
 *   cambios que afecten publicación o datos oficiales.
 *
 * B) Configuración de agentes en esta máquina:
 * - OpenCode: MCP github en C:\Users\liamc\.config\opencode\opencode.json
 *   (usa token de gh mediante launcher.mjs; no guarda token en JSON).
 * - Antigravity: MCP github en C:\Users\liamc\.gemini\config\mcp_config.json
 *   (reiniciar Antigravity tras modificar ese archivo).
 * - Copilot: Usado desde GitHub.com, VS Code o GitHub Copilot CLI.
 *
 * C) Flujo de trabajo y PRs:
 * 1. Tomar o abrir issue con etiqueta del agente (agent:opencode / agent:gemini /
 *    agent:copilot) y área (area:ui / area:data / area:a11y / area:performance /
 *    area:docs). Ejemplos de asignación:
 *    "@opencode implementa el issue #12 en agent/opencode/mejoras-sitio",
 *    "@gemini regenera data/questions_bank.json y abre PR en agent/gemini/datos",
 *    "Copilot, revisa el PR #15 y señala riesgos de accesibilidad".
 * 2. Crear rama desde origin/main, hacer el cambio mínimo y validar en local.
 * 3. Al revisar un PR (guía Copilot): verificar cambio pequeño ligado al issue,
 *    accesibilidad (alt, contraste, landmarks, labels, teclado), rendimiento
 *    (imágenes sin loading="lazy", JSON pesados al inicio, animaciones
 *    costosas), que no se editaron JSON generados a mano y señalar riesgos
 *    concretos.
 * 4. Al proponer código: seguir estilo de app.js y styles.css, usar escapeHtml
 *    en contenido dinámico, no agregar dependencias sin justificar, dejar PR en
 *    revisión humana si afecta datos o publicación.
 * 5. En PRs que cambian datos (guía GEMINI): documentar qué datos/archivos
 *    cambiaron, qué script se ejecutó, cómo se validó el sitio y cuánto cambió
 *    el peso de archivos.
 * 6. Hacer merge con squash (--squash), borrar la rama y verificar GitHub Pages
 *    entre 1 y 2 minutos después.
 *
 * D) Validación mínima web (Definition of Done):
 * - Servidor local desde raíz: python -m http.server 8765 --bind 127.0.0.1
 * - Validar sintaxis: node --check app.js
 * - Validar JSON modificado: python -m json.tool data/catalog.json > $null
 * - Comprobar en navegador (escritorio y móvil 390 px de ancho sin desbordes):
 *   0 errores en consola, buscador responde con fuentes, pestañas de biblioteca
 *   y catálogo funcionan, lector abre y descarga, Lighthouse de accesibilidad y
 *   SEO igual o superior al previo, y ninguna imagen fuera de primera pantalla
 *   sin loading="lazy" ni decoding="async".
 *
 * E) Publicación desde copia scratch/dist_web (cuando se use ese flujo):
 * 1. git -C dist_web pull --ff-only (o alinear desde origin/main sin borrar
 *    archivos locales de promo).
 * 2. Sincronizar archivos del sitio desde dist_web hacia public/.
 * 3. Ejecutar el script generador correspondiente.
 * 4. Ejecutar prepare_public_site.py.
 * 5. Revisar git -C dist_web status antes de commitear.
 * 6. Commit con autoría exclusiva de Liam y push a main.
 * 7. Verificar sitio publicado en GitHub Pages.
 *
 * F) Resolución de conflictos:
 * - Dos agentes en el mismo archivo: gana el primer PR revisado e integrado; el
 *   segundo actualiza su rama y resuelve conflictos.
 * - Cambios en public/ vs repo: primero sincronizar public/ desde main.
 * - Datos generados diferentes: no sobrescribir sin comparar diff antes.
 * - Sitio publicado no refleja merge: esperar 1-2 min, revisar Actions Pages
 *   y recargar sin caché.
 *
 * G) Flujo, prueba y validación mínima en Android (bibliotech-scouts-app):
 * - Sincronizar sitio: npm run sync:web y npx cap sync android (debe reconocer
 *   los 8 plugins de Capacitor sin errores).
 * - Probar capa nativa en navegador:
 *   npx --yes http-server www -p 8766 -a 127.0.0.1 -c-1
 *   node scripts/make-native-test.mjs (abrir http://127.0.0.1:8766/native-test.html).
 *   Después volver a ejecutar npm run sync:web antes de cap sync para no meter
 *   páginas de prueba en el APK.
 * - Checklist Android: el workflow Build Android APK compila, Panel Offline abre
 *   y descarga archivo en dispositivo/emulador, arranca sin internet respondiendo
 *   preguntas, y nueva versión se instala encima conservando misma firma.
 * - Release de nuevo APK firmado: actualizar version y versionLabel en
 *   package.json, versionName y versionCode en android/app/build.gradle y
 *   leyendas en index.html; merge squash a main; crear tag anotado vX.Y.Z y
 *   hacer git push origin vX.Y.Z.
 *
 * ----------------------------------------------------------------------------
 * 5. PUNTOS CLAVE DE EVOLUCIÓN Y PENDIENTES CONOCIDOS
 * ----------------------------------------------------------------------------
 * 1. Refinamiento del ranking semántico local en app.js para consultas
 *    coloquiales ("qué hago si me lastimo", "cómo pasar de tropa a caminantes",
 *    "cuánto cuesta la membresía") sin penalizar términos comunes.
 * 2. Descarga de documentos en lote por estantes completos en Mi biblioteca
 *    (ej. los 39 libros del Centenario) con barra de progreso consolidada.
 * 3. Caché progresivo de portadas bajo demanda en @capacitor/filesystem.
 * 4. Play Protect: para erradicar por completo cualquier advertencia heurística
 *    de sideloading, la vía recomendada es publicar en Google Play Console o
 *    solicitar verificación de desarrollador independiente ante Google Play.
 * 5. Pendientes web heredados (issue #12): archivos alojados solo en releases
 *    (donde Content-Disposition: attachment fuerza descarga en «Abrir en
 *    pestaña», resoluble publicando copias web livianas en files/) y reemplazo
 *    de 7 portadas WhatsApp-Image de Identidad Gráfica.
 *
 * ----------------------------------------------------------------------------
 * 6. ENLACES DE REFERENCIA TÉCNICA
 * ----------------------------------------------------------------------------
 * - Documentación de GitHub Pages: https://docs.github.com/pages
 * - Accesibilidad web (WCAG 2.2): https://www.w3.org/WAI/WCAG22/quickref/
 * - Lighthouse: https://developer.chrome.com/docs/lighthouse/overview/
 * - Protocolo OpenCode: https://opencode.ai/docs/rules/
 * ============================================================================ */

