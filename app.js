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

    // Registro de PWA Service Worker (solo en versión Web, fuera de Capacitor)
    if ("serviceWorker" in navigator && !window.Capacitor) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
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

  setup3DTiltInteractions();

  // Barra flotante de acceso rapido + Scroll-Spy de navegacion
  const quickBar = document.getElementById("floatingQuickBar");
  const askFab = document.getElementById("floatingAskBtn");
  const topFab = document.getElementById("floatingTopBtn");
  const navLinks = Array.from(document.querySelectorAll(".main-nav .nav-link"));
  const spyIds = ["buscador", "biblioteca", "acerca", "agentes", "secciones", "cambios", "explorar", "app"];

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
  "¿Qué son las Insignias Mundiales y cómo funciona el Marco Mundo Mejor (Better World Framework) de la OMMS?",
  "¿Qué simbolizan los tres pétalos, la línea central, las dos estrellas de cinco puntas, la cuerda y el nudo llano de la Flor de Lis Mundial?",
  "¿Qué es la iniciativa Mensajeros de la Paz (Messengers of Peace) de la Organización Mundial Scout?",
  "¿Qué es la iniciativa Tribu de la Tierra (Earth Tribe) y cuál es su objetivo dentro de la OMMS y ASMAC?",
  "¿Qué es el Pin de la Tribu de la Tierra, cómo se obtiene, dónde se coloca y cuánto tiempo se puede portar?",
  "¿Qué es el Reconocimiento Scouts del Mundo (Scouts of the World Award - SWA) y quiénes pueden aspirar a él?",
  "¿Qué es la Insignia de Madera (Wood Badge), cuándo fue creada por Baden-Powell y cuál es su significado mundial?",
  "¿Qué es el Lobo de Bronce (Bronze Wolf Award) y por qué es la máxima y única condecoración del Comité Scout Mundial?",
  "¿Cómo inscribo a mi hijo o hija en los Scouts, en dónde se registra y con quién tengo que hablar comúnmente del registro?",
  "¿Qué es el SISAS, qué es ExplorApp y qué es CarpetApp?",
  "¿Qué es el Centro Scout o Campo Escuela Meztitla y dónde se ubica?",
  "¿Qué son el Jamboree Nacional, el World Scout Jamboree, el Philia y el World Scout Moot, dónde se hacen y cada cuánto?",
  "¿Qué es el CPRC y qué es el CNRC (Comité Nacional de la Red de Caminantes) y quiénes son sus integrantes actuales?",
  "¿Cómo se hace un Foro Provincial paso a paso y quiénes son los encargados de organizarlo?",
  "¿En dónde puedo subir mis proyectos como Caminante (Agentes de Cambio.MX), cómo se hace un proyecto y qué formatos se necesitan?",
  "¿Qué especialidades, reconocimientos e insignias puedo obtener con mis proyectos de Caminante y cómo sé a qué Eje Temático pertenecen?",
  "¿Cómo se aplica el nuevo esquema PJOS y pueden combinarse las nuevas insignias con las antiguas?",
  "¿Dónde compro el uniforme scout?",
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
          ${d.summary ? `<p class="book-desc">${escapeHtml(d.summary)}</p>` : ''}
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

  // El banco, los fragmentos y el catálogo se cargan en el primer toque. La
  // respuesta puede llegar antes de que terminen de descargarse; esperamos aquí
  // para que la primera pregunta también funcione sin conexión y con todas las
  // fuentes, incluso si se hace justo al abrir la app.
  try {
    await Promise.all([waitForAppReady(), loadQuestionBank(), loadWebChunks()]);
  } catch (_) {}

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
  const all = normalizeStr(text).match(/[a-z0-9]{2,}/g) || [];
  const filtered = all.filter((w) => !ENGINE_STOPWORDS.has(w));
  const words = filtered.length ? filtered : all;
  const set = new Set();
  for (const word of words) for (const variant of tokenVariants(word)) set.add(variant);
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
        if (!doc || String(doc.ext || "").toUpperCase() === "HTML") continue;
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

  // Cada documento abre en «Lectura del Documento». Antes se conservaba la
  // pestaña anterior y, si era «Texto Extraído», las imágenes no se veían.
  document.querySelectorAll(".modal-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === "preview");
  });
  previewPane.classList.remove("hidden");
  document.getElementById("modalTextPane").classList.add("hidden");

  titleEl.textContent = doc.title;
  fnameEl.textContent = `${doc.filename} • ${doc.category}`;
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

  const canEmbedNative = IS_LOCAL_SERVER || Boolean(doc.has_web_file);

  if (doc.ext === "PDF") {
    if (canEmbedNative) {
      previewPane.innerHTML = `<iframe src="${viewUrl}" title="${escapeHtml(doc.title)}" class="doc-viewer-iframe" style="width:100%;height:100%;min-height:580px;border:none;"></iframe>`;
      openTabBtn.href = viewUrl;
      openTabBtn.onclick = null;
    } else {
      // En la web pública, Google Docs Viewer renderiza el PDF original visual completo con todas sus páginas y formatos
      const gDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(viewUrl)}&embedded=true`;
      previewPane.innerHTML = `<iframe id="gDocsIframe" src="${gDocsUrl}" title="${escapeHtml(doc.title)}" class="doc-viewer-iframe" style="width:100%;height:100%;min-height:580px;border:none;background:#ffffff;" allowfullscreen></iframe>`;
      openTabBtn.onclick = (e) => {
        e.preventDefault();
        window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(viewUrl)}`, '_blank');
      };

      // Resiliencia: si el iframe no responde o está offline, ofrecer cambio rápido a lectura de texto
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
              document.querySelectorAll(".modal-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === "text"));
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
      <figure style="display:flex;flex-direction:column;align-items:center;gap:0.75rem;height:100%;margin:0;padding:1.5rem;box-sizing:border-box;">
        <figcaption style="flex:0 0 auto;text-align:center;">
          <span style="display:block;font-size:0.72rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#6d28d9;">Vista previa de imagen</span>
          <span style="display:block;font-size:1.05rem;font-weight:800;color:#0c1938;line-height:1.3;">${escapeHtml(doc.title)}</span>
        </figcaption>
        <img src="${viewUrl}" alt="${escapeHtml(doc.title)}" loading="lazy" decoding="async" style="flex:1 1 auto;min-height:0;max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;" onerror="this.alt='No se pudo cargar la vista previa. Usa el botón Descargar.'; this.style.minHeight='120px';" />
        <p style="flex:0 0 auto;margin:0;font-size:0.82rem;color:#64748b;text-align:center;">Archivo: <strong>${escapeHtml(doc.filename)}</strong></p>
      </figure>
    `;
  } else if (canEmbedNative && IS_LOCAL_SERVER && doc.ext === "HTML") {
    previewPane.innerHTML = `<iframe src="${viewUrl}" title="${escapeHtml(doc.title)}" class="doc-viewer-iframe"></iframe>`;
    openTabBtn.href = viewUrl;
    openTabBtn.onclick = null;
  } else {
    previewPane.innerHTML = renderWebReaderView(doc, fullTextContent, dlUrl);
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
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".sec-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const sec = btn.dataset.section || "all";
      STATE.activeAskSection = sec;

      // Sincronizar las pestañas del explorador de preguntas con la sección seleccionada
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
    const shelfBtn = e.target.closest("[data-select-shelf]");
    if (shelfBtn) {
      const targetShelf = shelfBtn.getAttribute("data-select-shelf");
      document.querySelectorAll(".shelf-tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.shelf === targetShelf);
      });
      STATE.activeShelf = targetShelf;
      STATE.libraryVisibleCount = 24;
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
      STATE.libraryVisibleCount = 12;
      renderLibraryShelf();
      revealLibraryResults();
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
  },

  toggleCampMode() {
    this.campMode = !this.campMode;
    localStorage.setItem("bt_camp_mode", String(this.campMode));
    document.documentElement.setAttribute("data-camp-mode", String(this.campMode));
    const btn = document.getElementById("btnToggleCampMode");
    if (btn) {
      btn.setAttribute("aria-pressed", String(this.campMode));
    }
    this.pulse([12, 40, 12]);
    return this.campMode;
  },

  init3DTilt() {
    const selector = ".floating-photo, .hero-floating-card, .about-floating-photo, .book-card, .adc-axis-card, .adc-eje-item, .adc-cosmic-card";
    document.addEventListener("pointermove", (e) => {
      const card = e.target.closest(selector);
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const xc = rect.width / 2;
      const yc = rect.height / 2;
      const rx = ((y - yc) / yc) * -6;
      const ry = ((x - xc) / xc) * 6;
      card.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
      card.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
      card.style.setProperty("--glare-x", `${((x / rect.width) * 100).toFixed(1)}%`);
      card.style.setProperty("--glare-y", `${((y / rect.height) * 100).toFixed(1)}%`);
      card.classList.add("is-tilting");
    }, { passive: true });

    document.addEventListener("pointerout", (e) => {
      const card = e.target.closest(selector);
      if (!card) return;
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
      card.classList.remove("is-tilting");
    }, { passive: true });

    // Fases orbitales aleatorias en fotos flotantes
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
    window.addEventListener("resize", () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }, { passive: true });

    const count = window.innerWidth < 768 ? 22 : 40;
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1.2 + Math.random() * 2.2,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -0.25 - Math.random() * 0.55,
      alpha: 0.2 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2
    }));

    const render = () => {
      if (!document.hidden) {
        ctx.clearRect(0, 0, w, h);
        const agentesSection = document.getElementById("agentes");
        let isCosmic = false;
        if (agentesSection) {
          const rect = agentesSection.getBoundingClientRect();
          isCosmic = rect.top < h * 0.65 && rect.bottom > h * 0.15;
        }
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.phase += 0.03;
          if (p.y < -10) p.y = h + 10;
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          const glow = 0.35 + Math.sin(p.phase) * 0.3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = this.campMode
            ? `rgba(255, 120, 0, ${glow})`
            : isCosmic
              ? `rgba(56, 189, 248, ${glow})`
              : `rgba(250, 204, 21, ${glow})`;
          ctx.fill();
        }
      }
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
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

function updateBackpackBadge() {
  const pins = getBackpackPins();
  const countEl = document.getElementById("dockBackpackCount");
  if (countEl) {
    countEl.textContent = String(pins.length);
    countEl.classList.toggle("hidden", pins.length === 0);
  }
}

function getBackpackPins() {
  try {
    return JSON.parse(localStorage.getItem("bt_backpack_pins") || "[]");
  } catch (_) {
    return [];
  }
}

function toggleBackpackPin(docId) {
  if (!docId) return false;
  let pins = getBackpackPins();
  const idx = pins.indexOf(docId);
  let isPinned = false;
  if (idx >= 0) {
    pins.splice(idx, 1);
    isPinned = false;
  } else {
    pins.push(docId);
    isPinned = true;
  }
  localStorage.setItem("bt_backpack_pins", JSON.stringify(pins));
  updateBackpackBadge();
  BiblioFeel.pulse(isPinned ? [12, 30, 18] : 10);
  return isPinned;
}

function setupReaderQoLHandlers(doc, fullText) {
  const ttsBtn = document.getElementById("btnReaderTTS");
  if (ttsBtn) {
    ttsBtn.onclick = () => {
      toggleReaderTTS(fullText || doc.summary || doc.title);
    };
  }

  const pinBtn = document.getElementById("btnPinBackpack");
  if (pinBtn) {
    const pins = getBackpackPins();
    const isPinned = pins.includes(doc.id);
    pinBtn.classList.toggle("is-active", isPinned);
    pinBtn.title = isPinned ? "Quitar de Mi Mochila" : "Guardar en Mi Mochila Scout";
    pinBtn.onclick = () => {
      const nowPinned = toggleBackpackPin(doc.id);
      pinBtn.classList.toggle("is-active", nowPinned);
      pinBtn.title = nowPinned ? "Quitar de Mi Mochila" : "Guardar en Mi Mochila Scout";
    };
  }

  const fieldNoteBtn = document.getElementById("btnFieldNote");
  const fieldNoteBox = document.getElementById("modalFieldNoteBox");
  const fieldNoteText = document.getElementById("modalFieldNoteText");
  const saveNoteBtn = document.getElementById("btnSaveFieldNote");
  const closeNoteBtn = document.getElementById("btnCloseFieldNote");

  if (fieldNoteBtn && fieldNoteBox && fieldNoteText) {
    const savedNote = localStorage.getItem("bt_note_" + doc.id) || "";
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
        if (val) {
          localStorage.setItem("bt_note_" + doc.id, val);
          fieldNoteBtn.classList.add("is-active");
        } else {
          localStorage.removeItem("bt_note_" + doc.id);
          fieldNoteBtn.classList.remove("is-active");
        }
        fieldNoteBox.classList.add("hidden");
        BiblioFeel.pulse([10, 30]);
      };
    }
  }

  // Buscador interno de texto en el lector
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

      if (action === "mochila") {
        e.preventDefault();
        const pins = getBackpackPins();
        if (!pins.length) {
          alert("Tu Mochila Scout aún no tiene manuales guardados. En cualquier documento del lector, presiona 'Mochila' para tenerlo siempre a mano.");
          return;
        }
        // Filtrar biblioteca por documentos guardados
        STATE.libraryQuery = "";
        STATE.librarySection = "all";
        STATE.currentShelfDocs = STATE.documents.filter((d) => pins.includes(d.id));
        renderLibraryShelfCards(STATE.currentShelfDocs);
        const biblio = document.getElementById("biblioteca");
        if (biblio) biblio.scrollIntoView({ behavior: "smooth", block: "start" });
        items.forEach((i) => i.classList.remove("is-active"));
        item.classList.add("is-active");
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

  // Vincular scroll spy con los items del dock
  const dockSpyTargets = ["inicio", "buscador", "biblioteca", "agentes"];
  window.addEventListener("scroll", () => {
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
  }, { passive: true });

  updateBackpackBadge();
}

document.addEventListener("DOMContentLoaded", initApp);
