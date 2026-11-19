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

function btFetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  if (typeof AbortController !== "function" || !timeoutMs || timeoutMs <= 0) {
    return fetch(url, options);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    try {
      ctrl.abort();
    } catch (_) {}
  }, timeoutMs);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function btEnsureLibraryRendered() {
  if (!STATE.documents || !STATE.documents.length) return;
  if (!STATE._libraryRendered) {
    STATE._libraryRendered = true;
    renderLibraryShelf();
  }
}

function btEnsureCatalogRendered() {
  if (!STATE.documents || !STATE.documents.length) return;
  if (!STATE._catalogRendered) {
    STATE._catalogRendered = true;
    applyCatalogFilters();
  }
}

function btEnsureVersionChainsRendered() {
  if (!STATE.versionChains) return;
  if (!STATE._versionChainsRendered) {
    STATE._versionChainsRendered = true;
    renderVersionChains();
  }
}

async function initApp() {
  initPrivacyAndTelemetry();
  setupVersionAndUpdateChecker();
  setupWelcomeModal();
  setupIosExperience();
  setupBugReportModal();
  setupAutofillVault();
  setupScoutForum();
  setupHeaderUI();
  setupWorkspaceViews();
  setupContactEmailUI();
  bindEvents();
  setupScrollAnimations();

  try {
    const fetchCatalog = async () => {
      let res = null;
      if (IS_LOCAL_SERVER) {
        res = await fetch("/api/catalog").catch(() => null);
      }
      if (!res || !res.ok) {
        res = await fetch("data/catalog.json");
      }
      return res;
    };

    // Cargar catálogo y base de conocimiento en paralelo (elimina waterfall en móvil)
    const [catRes, kbRes] = await Promise.all([
      fetchCatalog(),
      fetch("data/knowledge_base.json").catch(() => null),
    ]);

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

    if (kbRes && kbRes.ok) {
      const kbData = await kbRes.json().catch(() => null);
      if (kbData && Array.isArray(kbData.topics)) {
        STATE.topics = kbData.topics;
        STATE.topicsById = {};
        for (const t of STATE.topics) {
          if (t.id) STATE.topicsById[t.id] = t;
        }
      }
    }

    // Si arrancamos directo en biblioteca o guía, renderizar ya; si estamos en Inicio, diferir a tiempo ocioso
    if (STATE.activeWorkspaceView === "biblioteca") {
      btEnsureLibraryRendered();
      btEnsureCatalogRendered();
    } else if (STATE.activeWorkspaceView === "guia") {
      btEnsureVersionChainsRendered();
    } else {
      const scheduleIdle = window.requestIdleCallback || ((fn) => setTimeout(fn, 180));
      scheduleIdle(() => {
        btEnsureLibraryRendered();
        btEnsureCatalogRendered();
        btEnsureVersionChainsRendered();
      });
    }

    // El banco de preguntas y los fragmentos se cargan de forma diferida:
    // primero la página, después los datos pesados cuando se usan.
    setupLazyDataWarmup();

    // Registro de PWA Service Worker (solo en versión Web, fuera de Capacitor)
    if ("serviceWorker" in navigator && !window.Capacitor) {
      navigator.serviceWorker
        .register("sw.js", { updateViaCache: "none" })
        .then((reg) => {
          if (!reg) return;
          if (reg.waiting && typeof window.__btShowUpdateBanner === "function") {
            window.__btShowUpdateBanner(
              "Hay una nueva versión de archivos lista para aplicar en tu navegador o App Web.",
              () => {
                try {
                  reg.waiting.postMessage({ type: "SKIP_WAITING" });
                } catch (_) {}
              }
            );
          }
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller &&
                typeof window.__btShowUpdateBanner === "function"
              ) {
                window.__btShowUpdateBanner(
                  "Se detectaron cambios recientes en archivos y funciones. Actualiza para ver la última versión.",
                  () => {
                    try {
                      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
                    } catch (_) {}
                  }
                );
              }
            });
          });
          if (typeof reg.update === "function") reg.update();
        })
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
    if (firstNavLink) firstNavLink.focus({ preventScroll: true });
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
    // El menú desplegable funciona en todas las pantallas; solo cerramos al rotar/redimensionar mucho si se desea, sin forzar cierre en >1024px
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

// ============================================================================
// ARQUITECTURA POR ESPACIOS DEDICADOS (VISTAS LIMPIAS + RUTAS COMPARTIBLES)
// ============================================================================
const BT_SECTION_VIEW_MAP = {
  inicio: { view: "inicio" },
  buscador: { view: "inicio" },
  "seccion-buscador": { view: "inicio" },
  btWorkspaceHub: { view: "inicio" },
  biblioteca: { view: "biblioteca", libMode: "shelves" },
  explorar: { view: "biblioteca", libMode: "catalog" },
  "guia-inicio": { view: "guia", guideTab: "guia-inicio" },
  acerca: { view: "guia", guideTab: "acerca" },
  agentes: { view: "guia", guideTab: "agentes" },
  secciones: { view: "guia", guideTab: "secciones" },
  servicios: { view: "guia", guideTab: "servicios" },
  cambios: { view: "guia", guideTab: "cambios" },
  app: { view: "guia", guideTab: "app" },
  foro: { view: "fogata" },
  "editor-formatos": { view: "formatos" }
};

STATE.activeWorkspaceView = "inicio";
STATE.activeLibraryMode = "shelves";
STATE.activeGuideTab = "all";

function btSetLibraryMode(mode = "shelves") {
  const safeMode = mode === "catalog" ? "catalog" : "shelves";
  STATE.activeLibraryMode = safeMode;
  document.querySelectorAll("#btLibraryModeBar [data-lib-mode]").forEach((btn) => {
    const isAct = btn.getAttribute("data-lib-mode") === safeMode;
    btn.classList.toggle("active", isAct);
    btn.setAttribute("aria-selected", String(isAct));
  });
  document.querySelectorAll("[data-bt-lib-panel]").forEach((sec) => {
    const matches = sec.getAttribute("data-bt-lib-panel") === safeMode;
    sec.classList.toggle("bt-subpanel-hidden", !matches);
  });
}

function btSetGuideTab(tab = "all") {
  const safeTab = tab || "all";
  STATE.activeGuideTab = safeTab;
  document.querySelectorAll("#btGuideSubnav [data-guide-tab]").forEach((btn) => {
    const isAct = btn.getAttribute("data-guide-tab") === safeTab;
    btn.classList.toggle("active", isAct);
    btn.setAttribute("aria-selected", String(isAct));
  });
  document.querySelectorAll("[data-bt-guide-panel]").forEach((sec) => {
    const pName = sec.getAttribute("data-bt-guide-panel");
    const visible = safeTab === "all" || pName === safeTab;
    sec.classList.toggle("bt-subpanel-hidden", !visible);
    if (visible) {
      sec.querySelectorAll(".reveal-on-scroll").forEach((el) => el.classList.add("revealed"));
    }
  });
}

function btSwitchView(viewName, options = {}) {
  const validViews = new Set(["inicio", "biblioteca", "guia", "fogata", "formatos"]);
  const nextView = validViews.has(viewName) ? viewName : "inicio";
  STATE.activeWorkspaceView = nextView;

  document.documentElement.setAttribute("data-bt-active-view", nextView);
  document.querySelectorAll("[data-bt-view]").forEach((el) => {
    const isMatch = el.getAttribute("data-bt-view") === nextView;
    el.classList.toggle("bt-view-hidden", !isMatch);
    if (isMatch) {
      el.querySelectorAll(".reveal-on-scroll").forEach((r) => r.classList.add("revealed"));
    }
  });

  if (nextView === "biblioteca") {
    if (typeof btEnsureLibraryRendered === "function") btEnsureLibraryRendered();
    if (typeof btEnsureCatalogRendered === "function") btEnsureCatalogRendered();
    btSetLibraryMode(options.libMode || STATE.activeLibraryMode || "shelves");
  }
  if (nextView === "guia") {
    if (typeof btEnsureVersionChainsRendered === "function") btEnsureVersionChainsRendered();
    btSetGuideTab(options.guideTab !== undefined ? options.guideTab : (STATE.activeGuideTab || "all"));
  }

  // Sincronizar estado activo en barra superior desktop
  document.querySelectorAll(".desktop-quick-nav [data-bt-go-view]").forEach((link) => {
    const linkView = link.getAttribute("data-bt-go-view");
    const guideJump = link.getAttribute("data-bt-guide-jump");
    let isAct = false;
    if (guideJump === "app") {
      isAct = nextView === "guia" && STATE.activeGuideTab === "app";
    } else if (linkView === "guia") {
      isAct = nextView === "guia" && STATE.activeGuideTab !== "app";
    } else {
      isAct = linkView === nextView;
    }
    link.classList.toggle("active", isAct);
  });

  // Sincronizar dock inferior móvil / Android
  document.querySelectorAll("#unifiedBottomDock .bt-dock-item[data-bt-go-view]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-bt-go-view") === nextView);
  });

  // Actualizar URL compartible (?vista=...) en web sin afectar Capacitor ni file://
  if (
    !window.Capacitor &&
    (window.location.protocol === "http:" || window.location.protocol === "https:") &&
    options.updateUrl !== false
  ) {
    try {
      const url = new URL(window.location.href);
      if (nextView === "inicio") {
        url.searchParams.delete("vista");
      } else {
        url.searchParams.set("vista", nextView);
      }
      if (!options.keepHash) url.hash = "";
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (_) {}
  }

  if (options.scrollToId) {
    const targetEl = document.getElementById(options.scrollToId);
    if (targetEl) {
      window.requestAnimationFrame(() => {
        targetEl.scrollIntoView({ behavior: options.instant ? "instant" : "smooth", block: "start" });
      });
    }
  } else if (options.scrollTop !== false) {
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

function btNavigateToSection(sectionId, options = {}) {
  const cleanId = String(sectionId || "").replace(/^#/, "").trim();
  if (!cleanId) return;
  const mapping = BT_SECTION_VIEW_MAP[cleanId];
  if (mapping) {
    btSwitchView(mapping.view, {
      libMode: options.libMode || mapping.libMode,
      guideTab: options.guideTab !== undefined ? options.guideTab : mapping.guideTab,
      scrollToId: cleanId === "inicio" ? "" : cleanId,
      scrollTop: cleanId === "inicio",
      instant: Boolean(options.instant)
    });
    return;
  }
  const el = document.getElementById(cleanId);
  if (el) {
    el.scrollIntoView({ behavior: options.instant ? "instant" : "smooth", block: "start" });
  }
}

window.__btSwitchView = btSwitchView;
window.__btNavigateToSection = btNavigateToSection;

function setupWorkspaceViews() {
  // Delegación global para botones/enlaces con data-bt-go-view o anclas internas #...
  document.addEventListener("click", (e) => {
    const openSavedTrigger = e.target.closest("[data-action-open-saved]");
    if (openSavedTrigger) {
      e.preventDefault();
      openSavedPanel();
      return;
    }

    const viewTrigger = e.target.closest("[data-bt-go-view]");
    if (viewTrigger) {
      e.preventDefault();
      const targetView = viewTrigger.getAttribute("data-bt-go-view");
      const libJump = viewTrigger.getAttribute("data-bt-lib-jump");
      const guideJump = viewTrigger.getAttribute("data-bt-guide-jump");
      const href = viewTrigger.getAttribute("href") || "";
      const hashId = href.startsWith("#") ? href.slice(1) : "";

      const opts = {
        libMode: libJump || undefined,
        guideTab: guideJump !== null ? guideJump : (targetView === "guia" ? "all" : undefined),
        scrollToId: hashId === "buscador" ? "buscador" : ""
      };
      btSwitchView(targetView, opts);

      // Cerrar menú desplegable si estaba abierto
      const header = document.querySelector(".main-header");
      if (header && header.classList.contains("nav-open")) {
        header.classList.remove("nav-open");
        document.body.classList.remove("nav-open");
        const navToggle = document.getElementById("navToggle");
        const navBackdrop = document.getElementById("navBackdrop");
        if (navToggle) navToggle.setAttribute("aria-expanded", "false");
        if (navBackdrop) navBackdrop.hidden = true;
      }
      return;
    }

    const anchor = e.target.closest('a[href^="#"]');
    if (anchor) {
      const href = anchor.getAttribute("href") || "";
      const targetId = href.slice(1);
      if (targetId && BT_SECTION_VIEW_MAP[targetId]) {
        e.preventDefault();
        btNavigateToSection(targetId);
      }
    }
  });

  // Conmutador Estantes Visuales / Catálogo Avanzado en vista Biblioteca
  document.querySelectorAll("#btLibraryModeBar [data-lib-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btSetLibraryMode(btn.getAttribute("data-lib-mode"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // Sub-pestañas en vista Guía y Movimiento Scout
  document.querySelectorAll("#btGuideSubnav [data-guide-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btSetGuideTab(btn.getAttribute("data-guide-tab"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // Determinar vista inicial desde URL (?vista=... o #hash)
  let initialApplied = false;
  try {
    const params = new URLSearchParams(window.location.search);
    const vParam = (params.get("vista") || "").toLowerCase();
    const hashId = (window.location.hash || "").replace(/^#/, "");
    if (hashId && BT_SECTION_VIEW_MAP[hashId]) {
      btNavigateToSection(hashId, { instant: true });
      initialApplied = true;
    } else if (vParam && ["inicio", "biblioteca", "guia", "fogata", "formatos"].includes(vParam)) {
      btSwitchView(vParam, { instant: true, updateUrl: false });
      initialApplied = true;
    }
  } catch (_) {}

  if (!initialApplied) {
    btSwitchView("inicio", { instant: true, scrollTop: false, updateUrl: false });
  }
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
      { threshold: 0.01, rootMargin: "120px 0px 120px 0px" }
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

  // Barra flotante de acceso rapido + Scroll-Spy de navegacion (en orden vertical exacto de la página)
  const quickBar = document.getElementById("floatingQuickBar");
  const askFab = document.getElementById("floatingAskBtn");
  const topFab = document.getElementById("floatingTopBtn");
  const navLinks = Array.from(document.querySelectorAll(".main-nav .nav-link"));
  const spyIds = ["buscador", "biblioteca", "guia-inicio", "acerca", "agentes", "secciones", "servicios", "cambios", "explorar", "app", "aportar"];

  if (askFab) {
    askFab.addEventListener("click", () => {
      btSwitchView("inicio", { scrollToId: "buscador" });
      const input = document.getElementById("askInput");
      if (input) setTimeout(() => input.focus({ preventScroll: true }), 380);
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
  {
    label: "¿En dónde encuentro un Grupo Scout?",
    q: "¿En dónde encuentro un Grupo Scout?"
  },
  {
    label: "¿Cómo inscribo a mi hijo y con quién hablo?",
    q: "¿Cómo inscribo a mi hijo o hija en los Scouts, en dónde se registra y con quién tengo que hablar comúnmente del registro?"
  },
  {
    label: "¿Qué son SISAS, ExplorApp y CarpetApp?",
    q: "¿Qué es el SISAS, qué es ExplorApp y qué es CarpetApp?"
  },
  {
    label: "¿Dónde subo mis proyectos y qué formatos ocupo?",
    q: "¿En dónde puedo subir mis proyectos como Caminante (Agentes de Cambio.MX), cómo se hace un proyecto y qué formatos se necesitan?"
  },
  {
    label: "¿Qué son el CPRC y el CNRC y quiénes lo integran?",
    q: "¿Qué es el CPRC y qué es el CNRC (Comité Nacional de la Red de Caminantes) y quiénes son sus integrantes actuales?"
  },
  {
    label: "¿Cómo aplicar el PJOS y combinar insignias?",
    q: "¿Cómo se aplica el nuevo esquema PJOS y pueden combinarse las nuevas insignias con las antiguas?"
  },
  {
    label: "¿Dónde compro el uniforme scout?",
    q: "¿Dónde compro el uniforme scout?"
  },
  {
    label: "¿Qué es Meztitla y dónde se ubica?",
    q: "¿Qué es el Centro Scout o Campo Escuela Meztitla y dónde se ubica?"
  },
  {
    label: "¿Qué es RECME y qué significan SCNCD y CNAMS?",
    q: "¿Qué es la plataforma RECME y qué significan SCNCD y CNAMS?"
  },
  {
    label: "¿Qué es la Política A Salvo del Peligro?",
    q: "¿Qué es la Política Nacional A Salvo del Peligro?"
  }
];

function renderExplorerQuestions(cat, shuffle = false) {
  const container = document.getElementById("dynamicQuestionsChips");
  if (!container) return;

  const isRandomAll = cat === "__RANDOM__";
  const count = 6;

  if (cat === "Destacadas" && !shuffle && (!STATE.activeAskSection || STATE.activeAskSection === "all")) {
    container.innerHTML = DEFAULT_FEATURED_QUESTIONS.slice(0, count)
      .map((item, idx) => {
        const qText = typeof item === "string" ? item : item.q;
        const label = typeof item === "string" ? item : item.label || item.q;
        return `<button type="button" class="quick-chip chip-featured" style="animation-delay:${idx * 24}ms" data-query="${escapeHtml(qText)}">${escapeHtml(label)}</button>`;
      })
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
  if (!nf) return null;
  if (STATE.docsByFilename[nf]) return STATE.docsByFilename[nf];
  for (const [k, d] of Object.entries(STATE.docsByFilename)) {
    if (k.includes(nf) || nf.includes(k)) return d;
  }
  const codeMatch = nf.match(/\b\d{2}\.\d{2,3}\b/);
  if (codeMatch) {
    const code = codeMatch[0];
    for (const [k, d] of Object.entries(STATE.docsByFilename)) {
      if (k.includes(code)) return d;
    }
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
  if (STATE.activeWorkspaceView !== "inicio") {
    btSwitchView("inicio", { scrollTop: false });
  }

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
    const hasTopic = Boolean(item.topic_id && STATE.topicsById[item.topic_id]);
    if ((!item.ans && !hasTopic) || !item._nq) continue;
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
    const bodySource = item.ans || (hasTopic ? STATE.topicsById[item.topic_id].content : "");
    const answerTokens = item._answer || (item._answer = expandTokenSet(bodySource || ""));
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
  if (best && !best.ans && best.topic_id && STATE.topicsById[best.topic_id]) {
    best = {
      ...best,
      ans: buildTopicAnswer(STATE.topicsById[best.topic_id], query, 1500)
    };
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
  if (exact && exact.topic_id && STATE.topicsById[exact.topic_id]) {
    const tObj = STATE.topicsById[exact.topic_id];
    const text = buildTopicAnswer(tObj, query, 1500);
    return { kind: "topic", text, topic: tObj, score: 95, topics: [{ topic: tObj, score: 95 }] };
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
  if (/^(?:1|ha-resource|pictures-and-videos|sdp-|diapositiva|whatsapp)/i.test(base) && doc && doc.title) {
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

  // Descripción y sinopsis del documento (oculta por defecto en cajón Info para ganar espacio)
  const infoDrawer = document.getElementById("modalDocInfoDrawer");
  const infoToggleBtn = document.getElementById("btnToggleDocInfo");
  if (infoDrawer) infoDrawer.classList.add("hidden");
  if (infoToggleBtn) {
    infoToggleBtn.setAttribute("aria-expanded", "false");
    infoToggleBtn.classList.remove("is-active");
  }
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
  const openTabBtnMobile = document.getElementById("modalOpenTabBtnMobile");
  if (openTabBtnMobile) openTabBtnMobile.href = viewUrl;
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
  const openTabBtnMobileSync = document.getElementById("modalOpenTabBtnMobile");
  if (openTabBtnMobileSync && openTabBtn) {
    openTabBtnMobileSync.href = openTabBtn.href;
    openTabBtnMobileSync.onclick = openTabBtn.onclick;
  }
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
        btNavigateToSection("explorar");
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
  campMode: false,
  _themeMediaBound: false,

  pulse(pattern = 10) {
    if (!this.hapticsEnabled) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (_) {}
  },

  applyDarkTheme(isDark) {
    this.campMode = Boolean(isDark);
    document.documentElement.setAttribute("data-camp-mode", String(this.campMode));
    const btn = document.getElementById("btnToggleCampMode");
    if (btn) {
      btn.setAttribute("aria-pressed", String(this.campMode));
      const label = this.campMode ? "Cambiar a modo claro" : "Modo oscuro";
      btn.setAttribute("title", label);
      btn.setAttribute("aria-label", label);
      btn.innerHTML = this.campMode
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    }
    const dockNight = document.getElementById("dockBtnNight");
    if (dockNight) {
      dockNight.setAttribute("aria-pressed", String(this.campMode));
      dockNight.classList.toggle("is-active", this.campMode);
    }
    syncThemeColorMetas(this.campMode);
  },

  initCampMode() {
    const mql =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    const sysDark = Boolean(mql && mql.matches);
    let initialDark = sysDark;

    try {
      const savedMode = localStorage.getItem("bt_camp_mode");
      const lastSys = localStorage.getItem("bt_theme_sys_snapshot");
      if (savedMode !== null && (lastSys === null || lastSys === String(sysDark))) {
        initialDark = savedMode === "true";
      } else {
        initialDark = sysDark;
        localStorage.setItem("bt_camp_mode", String(sysDark));
      }
      localStorage.setItem("bt_theme_sys_snapshot", String(sysDark));
    } catch (_) {}

    this.applyDarkTheme(initialDark);

    if (mql && !this._themeMediaBound) {
      this._themeMediaBound = true;
      this._mql = mql;
      const onSystemThemeChange = (e) => {
        const nextDark = Boolean(e && e.matches);
        try {
          localStorage.setItem("bt_camp_mode", String(nextDark));
          localStorage.setItem("bt_theme_sys_snapshot", String(nextDark));
        } catch (_) {}
        this.applyDarkTheme(nextDark);
      };
      this._onSystemThemeChange = onSystemThemeChange;
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onSystemThemeChange);
      } else if (typeof mql.addListener === "function") {
        mql.addListener(onSystemThemeChange);
      }
    }
  },

  toggleCampMode() {
    const nextDark = !this.campMode;
    try {
      localStorage.setItem("bt_camp_mode", String(nextDark));
      const mql =
        typeof window !== "undefined" && typeof window.matchMedia === "function"
          ? window.matchMedia("(prefers-color-scheme: dark)")
          : null;
      if (mql) localStorage.setItem("bt_theme_sys_snapshot", String(Boolean(mql.matches)));
    } catch (_) {}
    this.applyDarkTheme(nextDark);
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

window.__btSavedBridge = {
  getSavedPins,
  toggleSavedPin,
  getDocNote,
  setDocNote
};

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

  const infoToggleBtn = document.getElementById("btnToggleDocInfo");
  const infoDrawer = document.getElementById("modalDocInfoDrawer");
  if (infoToggleBtn && infoDrawer) {
    infoToggleBtn.onclick = () => {
      const willOpen = infoDrawer.classList.contains("hidden");
      infoDrawer.classList.toggle("hidden", !willOpen);
      infoToggleBtn.setAttribute("aria-expanded", String(willOpen));
      infoToggleBtn.classList.toggle("is-active", willOpen);
      if (willOpen) {
        const noteBox = document.getElementById("modalFieldNoteBox");
        if (noteBox) noteBox.classList.add("hidden");
      }
    };
  }

  const reportDocBtn = document.getElementById("btnReportDoc");
  if (reportDocBtn) {
    reportDocBtn.onclick = () => {
      if (typeof window.__btOpenBugReport === "function") {
        const docLabel = doc.filename ? `${doc.title || doc.id} (${doc.filename})` : (doc.title || doc.id);
        window.__btOpenBugReport("Lector / Visor PDF o Excel", docLabel, false);
      }
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
      const willOpen = fieldNoteBox.classList.contains("hidden");
      fieldNoteBox.classList.toggle("hidden", !willOpen);
      if (willOpen) {
        const infoDr = document.getElementById("modalDocInfoDrawer");
        const infoBtn = document.getElementById("btnToggleDocInfo");
        if (infoDr) infoDr.classList.add("hidden");
        if (infoBtn) {
          infoBtn.setAttribute("aria-expanded", "false");
          infoBtn.classList.remove("is-active");
        }
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
          btNavigateToSection("biblioteca");
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
      const viewName = item.getAttribute("data-bt-go-view");
      const target = item.getAttribute("data-target");

      if (action === "saved") {
        e.preventDefault();
        openSavedPanel();
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

      if (viewName) {
        e.preventDefault();
        btSwitchView(viewName);
        return;
      }

      if (target) {
        e.preventDefault();
        btNavigateToSection(target);
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

  const osPill = document.getElementById("appDetectedOsBadge");
  if (osPill) {
    const ua = (navigator && navigator.userAgent) || "";
    const isAndroidBrowser = /Android/i.test(ua);
    if (IS_APPLE_TOUCH) {
      osPill.textContent = isStandalone
        ? "Detectado: iPhone / iPad en modo App Web activa"
        : "Detectado: iPhone / iPad (iOS Safari) · Ambas guías siguen visibles";
    } else if (isAndroidBrowser) {
      osPill.textContent = "Detectado: Android · Recomendada la pestaña Android (.apk) para uso offline";
    } else {
      osPill.textContent = "Detectado: Navegador de escritorio · Puedes usar todo en web o elegir Android / iOS abajo";
    }
    osPill.classList.remove("hidden");
  }

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

  setupWebOfflineManager();
  setupGlobalShortcuts();
}

const APP_WEB_VERSION = "9.3.0";
const APP_MOBILE_VERSION = "3.3.0";
const APP_COOKIE_SCHEMA = "9.3";
const BT_SEEN_VERSION_KEY = "bt_seen_app_version_v1";
const BT_COOKIE_SCHEMA_KEY = "bt_cookie_schema_v1";
const WEB_OFFLINE_CACHE = "bibliotech-scout-v42";
const WEB_OFFLINE_META_KEY = "bt_web_offline_meta_v1";

function setupVersionAndUpdateChecker() {
  const banner = document.getElementById("updateAvailableBanner");
  const textEl = document.getElementById("updateAvailableText");
  const applyBtn = document.getElementById("btnApplyAppUpdate");
  const dismissBtn = document.getElementById("btnDismissAppUpdate");
  if (!banner || !textEl) return;

  let pendingAction = null;

  const showBanner = (message, onApplyFn = null, applyLabel = "Actualizar ahora") => {
    textEl.textContent = message;
    if (applyBtn) applyBtn.textContent = applyLabel;
    pendingAction = typeof onApplyFn === "function" ? onApplyFn : null;
    banner.classList.remove("hidden");
  };

  window.__btShowUpdateBanner = showBanner;

  const markVersionSeen = () => {
    try {
      localStorage.setItem(BT_SEEN_VERSION_KEY, APP_WEB_VERSION);
      localStorage.setItem(BT_COOKIE_SCHEMA_KEY, APP_COOKIE_SCHEMA);
    } catch (_) {}
  };

  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      markVersionSeen();
      banner.classList.add("hidden");
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener("click", async () => {
      markVersionSeen();
      if (pendingAction) {
        try {
          await pendingAction();
        } catch (_) {}
      }
      if ("caches" in window && !window.Capacitor) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.filter((k) => k !== WEB_OFFLINE_CACHE).map((k) => caches.delete(k)));
        } catch (_) {}
      }
      if ("serviceWorker" in navigator && !window.Capacitor) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          } else if (reg && typeof reg.update === "function") {
            await reg.update();
          }
        } catch (_) {}
      }
      window.location.reload();
    });
  }

  // 1) Detectar cambios importantes respecto a la última versión/cookies guardadas en este navegador o app
  try {
    const seenVersion = localStorage.getItem(BT_SEEN_VERSION_KEY);
    const seenSchema = localStorage.getItem(BT_COOKIE_SCHEMA_KEY);
    const hasPriorUserData = Boolean(
      seenVersion ||
      seenSchema ||
      localStorage.getItem("bt_cookie_consent_v1") ||
      localStorage.getItem("bt_saved_pins") ||
      localStorage.getItem("bt_recent_questions") ||
      localStorage.getItem("bt_autofill_profile_v1") ||
      localStorage.getItem("bt_forum_state_v1") ||
      localStorage.getItem(WEB_OFFLINE_META_KEY)
    );

    if (hasPriorUserData && (seenVersion !== APP_WEB_VERSION || seenSchema !== APP_COOKIE_SCHEMA)) {
      let msg = `BiblioTech Scout se actualizó a la versión ${APP_WEB_VERSION} con La Fogata y cambios en archivos y preferencias locales.`;
      try {
        const offlineMetaRaw = localStorage.getItem(WEB_OFFLINE_META_KEY);
        const offlineMeta = offlineMetaRaw ? JSON.parse(offlineMetaRaw) : null;
        if (offlineMeta && offlineMeta.version !== APP_WEB_VERSION) {
          msg = `Hay cambios importantes (versión ${APP_WEB_VERSION} con La Fogata). Actualiza para sincronizar archivos y tu paquete offline.`;
        }
      } catch (_) {}
      showBanner(msg);
    } else if (!hasPriorUserData) {
      markVersionSeen();
    }
  } catch (_) {}

  // 2) Comprobar contra el servidor si ya hay una versión más reciente publicada (Web, iOS Web App o Android)
  if (navigator.onLine !== false) {
    const remoteUrl = window.Capacitor
      ? `https://ey-liam.github.io/bibliotech-scouts/version.json?t=${Date.now()}`
      : `version.json?t=${Date.now()}`;
    btFetchWithTimeout(remoteUrl, { cache: "no-store" }, 6000)
      .then((res) => (res && res.ok ? res.json() : null))
      .then((remote) => {
        if (!remote || typeof remote !== "object") return;
        const remoteWeb = String(remote.version || "").trim();
        const remoteMobile = String(remote.mobileVersion || "").trim();
        const remoteSchema = String(remote.schemaCookieVersion || "").trim();
        const remoteCache = String(remote.cache || "").trim();

        if (window.Capacitor) {
          if (remoteMobile && remoteMobile !== APP_MOBILE_VERSION) {
            showBanner(
              `Nueva versión ${remoteMobile} disponible para BiblioTech Scout Mobile (Web ${remoteWeb || APP_WEB_VERSION}).`,
              () => {
                window.open("https://github.com/ey-liam/bibliotech-scouts-app/releases/latest", "_blank", "noopener");
              },
              "Ver actualización"
            );
          } else if ((remoteWeb && remoteWeb !== APP_WEB_VERSION) || (remoteSchema && remoteSchema !== APP_COOKIE_SCHEMA)) {
            showBanner(`Hay cambios recientes disponibles en archivos y datos (Web ${remoteWeb || APP_WEB_VERSION}).`);
          }
        } else if (
          (remoteWeb && remoteWeb !== APP_WEB_VERSION) ||
          (remoteSchema && remoteSchema !== APP_COOKIE_SCHEMA) ||
          (remoteCache && remoteCache !== WEB_OFFLINE_CACHE)
        ) {
          showBanner(
            `Nueva versión disponible (${remoteWeb || APP_WEB_VERSION}) con cambios importantes en archivos y funciones. Actualiza ahora.`
          );
        }
      })
      .catch(() => {});
  }
}

function setupGlobalShortcuts() {
  document.addEventListener("keydown", (e) => {
    const target = e.target;
    const isEditable =
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable);
    const isCmdK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
    const isSlash = !isEditable && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === "/";
    if (!isCmdK && !isSlash) return;

    const askInput = document.getElementById("askInput");
    if (!askInput) return;
    e.preventDefault();
    btSwitchView("inicio", { scrollTop: false });
    askInput.scrollIntoView({ behavior: "smooth", block: "center" });
    askInput.focus({ preventScroll: true });
    if (typeof askInput.select === "function") askInput.select();
  });
}

function setupWebOfflineManager() {
  const card = document.getElementById("iosOfflineCard");
  const netBanner = document.getElementById("webOfflineNetBanner");

  // En la App Android (Capacitor), la gestión offline vive en el panel nativo Mi biblioteca.
  if (window.Capacitor) {
    if (card) card.classList.add("hidden");
    if (netBanner) netBanner.classList.add("hidden");
    return;
  }

  const updateNetBanner = () => {
    if (!netBanner) return;
    netBanner.classList.toggle("hidden", navigator.onLine !== false);
  };
  window.addEventListener("online", updateNetBanner);
  window.addEventListener("offline", updateNetBanner);
  updateNetBanner();

  if (!card) return;
  if (!("caches" in window)) {
    card.classList.add("hidden");
    return;
  }

  const badge = document.getElementById("iosOfflineStatusBadge");
  const btnDownload = document.getElementById("btnDownloadWebOffline");
  const btnClear = document.getElementById("btnClearWebOffline");
  const chunksToggle = document.getElementById("iosIncludeChunksToggle");
  const progressWrap = document.getElementById("iosOfflineProgressWrap");
  const progressBar = document.getElementById("iosOfflineProgressBar");
  const progressText = document.getElementById("iosOfflineProgressText");

  const BASE_OFFLINE_URLS = [
    "./",
    "index.html",
    "styles.css",
    "app.js",
    "version.json",
    "manifest.webmanifest",
    "img/logo-flor.png",
    "img/logo-asmac.png",
    "img/logo-wosm.png",
    "img/apple-touch-icon.png",
    "img/qr-bibliotech.png",
    "img/qr-bibliotech.svg",
    "data/catalog.json",
    "data/knowledge_base.json",
    "data/faq_v3.json",
    "data/faq_v4.json",
    "data/questions_bank.json",
    "data/spreadsheets.json"
  ];

  const refreshStatus = async () => {
    try {
      const cache = await caches.open(WEB_OFFLINE_CACHE);
      const hasBank = await cache.match("data/questions_bank.json", { ignoreSearch: true });
      const hasFaq4 = await cache.match("data/faq_v4.json", { ignoreSearch: true });
      const hasChunks = await cache.match("data/chunks.json", { ignoreSearch: true });
      const rawMeta = localStorage.getItem(WEB_OFFLINE_META_KEY);
      const meta = rawMeta ? JSON.parse(rawMeta) : null;

      if (hasBank && hasFaq4) {
        if (badge) {
          badge.classList.add("ready");
          badge.textContent = hasChunks ? "Listo offline (completo)" : "Listo offline (13,525 preg.)";
        }
        if (btnDownload) {
          btnDownload.textContent = meta && meta.date ? `Actualizar (${meta.date})` : "Actualizar datos offline";
        }
        if (btnClear) btnClear.classList.remove("hidden");
      } else {
        if (badge) {
          badge.classList.remove("ready");
          badge.textContent = "Sin descargar";
        }
        if (btnDownload) btnDownload.textContent = "Descargar modo sin conexión";
        if (btnClear) btnClear.classList.add("hidden");
      }
    } catch (_) {}
  };

  if (btnDownload) {
    btnDownload.addEventListener("click", async () => {
      if (navigator.onLine === false) {
        showWebToast("Conéctate a internet para descargar el paquete offline.");
        return;
      }
      const includeChunks = Boolean(chunksToggle && chunksToggle.checked);
      const urls = includeChunks ? [...BASE_OFFLINE_URLS, "data/chunks.json"] : [...BASE_OFFLINE_URLS];

      btnDownload.disabled = true;
      if (progressWrap) progressWrap.classList.remove("hidden");

      try {
        const cache = await caches.open(WEB_OFFLINE_CACHE);
        let done = 0;
        for (const itemUrl of urls) {
          if (progressText) progressText.textContent = `Guardando (${done + 1}/${urls.length}): ${itemUrl}`;
          const res = await fetch(itemUrl, { cache: "reload" });
          if (!res || !res.ok) throw new Error(`HTTP ${res ? res.status : "?"} en ${itemUrl}`);
          await cache.put(itemUrl, res.clone());
          done++;
          const pct = Math.round((done / urls.length) * 100);
          if (progressBar) progressBar.style.width = `${pct}%`;
        }

        const today = new Date().toLocaleDateString("es-MX");
        localStorage.setItem(WEB_OFFLINE_META_KEY, JSON.stringify({ date: today, includeChunks, version: APP_WEB_VERSION }));
        if (progressText) progressText.textContent = "Paquete guardado correctamente para uso sin conexión.";
        showWebToast("Modo sin conexión listo en este dispositivo.");
      } catch (err) {
        if (progressText) progressText.textContent = "No se pudo completar la descarga. Intenta nuevamente.";
        enqueueAnonTelemetry({ t: "error_js", msg: `web_offline: ${String(err && err.message || err)}`, src: "ios_offline" }, false);
      } finally {
        btnDownload.disabled = false;
        await refreshStatus();
      }
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", async () => {
      try {
        const cache = await caches.open(WEB_OFFLINE_CACHE);
        await cache.delete("data/questions_bank.json");
        await cache.delete("data/faq_v4.json");
        await cache.delete("data/chunks.json");
        localStorage.removeItem(WEB_OFFLINE_META_KEY);
        if (progressWrap) progressWrap.classList.add("hidden");
        showWebToast("Caché pesada liberada de Safari / navegador.");
        await refreshStatus();
      } catch (_) {}
    });
  }

  refreshStatus();
}

const BT_WELCOME_SEEN_KEY = "bt_welcome_seen_v1";

function setupWelcomeModal() {
  const modal = document.getElementById("welcomeModal");
  if (!modal) return;

  const openMenuBtn = document.getElementById("openWelcomeMenuBtn");
  const openFooterBtn = document.getElementById("openWelcomeFooterBtn");
  const closeBtn = document.getElementById("closeWelcomeModalBtn");
  const skipBtn = document.getElementById("skipWelcomeModalBtn");
  const startBtn = document.getElementById("startWelcomeModalBtn");
  const shareQrBtn = document.getElementById("shareWelcomeQrBtn");
  const downloadQrBtn = document.getElementById("downloadWelcomeQrBtn");
  const openPrivacyBtn = document.getElementById("welcomeOpenPrivacyBtn");

  const closeMenuIfOpen = () => {
    const header = document.querySelector(".main-header");
    const navToggle = document.getElementById("navToggle");
    const navBackdrop = document.getElementById("navBackdrop");
    if (header) header.classList.remove("nav-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    if (navBackdrop) navBackdrop.hidden = true;
  };

  const openWelcome = () => {
    closeMenuIfOpen();
    modal.classList.remove("hidden");
    activateDialogFocusTrap(modal, "#startWelcomeModalBtn");
  };

  const dismissWelcome = (acceptConsentIfUnset = true) => {
    try {
      localStorage.setItem(BT_WELCOME_SEEN_KEY, "1");
      if (acceptConsentIfUnset && !localStorage.getItem(BT_CONSENT_KEY)) {
        localStorage.setItem(BT_CONSENT_KEY, "accepted");
        renderRecentQueriesUI();
        setupFullActivityObservers();
      }
    } catch (_) {}
    modal.classList.add("hidden");
    releaseDialogFocusTrap(modal);
  };

  let alreadySeen = false;
  try {
    alreadySeen = localStorage.getItem(BT_WELCOME_SEEN_KEY) === "1";
  } catch (_) {}

  if (!alreadySeen) {
    openWelcome();
  }

  if (openMenuBtn) openMenuBtn.addEventListener("click", openWelcome);
  if (openFooterBtn) openFooterBtn.addEventListener("click", openWelcome);
  if (closeBtn) closeBtn.addEventListener("click", () => dismissWelcome(true));
  if (skipBtn) skipBtn.addEventListener("click", () => dismissWelcome(true));
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      dismissWelcome(true);
      showWebToast("¡Bienvenido a BiblioTech Scout! Siempre Listos.");
    });
  }

  if (openPrivacyBtn) {
    openPrivacyBtn.addEventListener("click", () => {
      dismissWelcome(false);
      const consentOverlay = document.getElementById("cookieConsentBanner");
      if (consentOverlay) consentOverlay.classList.remove("hidden");
    });
  }

  if (shareQrBtn) {
    shareQrBtn.addEventListener("click", async () => {
      const shareUrl = "https://ey-liam.github.io/bibliotech-scouts/";
      const shareData = {
        title: "BiblioTech Scout — Biblioteca e Inteligencia Documental Scout",
        text: "Explora más de 750 documentos y 13,500 respuestas oficiales scouts en BiblioTech Scout:",
        url: shareUrl
      };
      enqueueAnonTelemetry({ t: "enlace_externo", label: "Compartir QR / Sitio Bienvenida", url: shareUrl }, false);
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (_) {}
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          showWebToast("¡Enlace copiado! Compártelo con tu Grupo o Provincia.");
          return;
        }
      } catch (_) {}
      showWebToast(`Comparte el enlace: ${shareUrl}`);
    });
  }

  if (downloadQrBtn) {
    downloadQrBtn.addEventListener("click", () => {
      enqueueAnonTelemetry({ t: "doc_descarga", origen: "bienvenida_qr", doc: "QR BiblioTech Scout" }, false);
      showWebToast("Descargando código QR oficial para compartir...");
    });
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) dismissWelcome(true);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) dismissWelcome(true);
  });
}

function setupBugReportModal() {
  const modal = document.getElementById("bugReportModal");
  const form = document.getElementById("bugReportForm");
  if (!modal || !form) return;

  const openMenuBtn = document.getElementById("openBugReportMenuBtn");
  const openFooterBtn = document.getElementById("openBugReportFooterBtn");
  const closeBtn = document.getElementById("closeBugReportBtn");
  const cancelBtn = document.getElementById("cancelBugReportBtn");
  const platformSelect = document.getElementById("bugReportPlatform");
  const sectionSelect = document.getElementById("bugReportSection");
  const targetInput = document.getElementById("bugReportTarget");
  const detailsInput = document.getElementById("bugReportDetails");
  const statusEl = document.getElementById("bugReportStatus");
  const submitBtn = document.getElementById("submitBugReportBtn");
  const bugTitleEl = document.getElementById("bugReportTitle");
  const bugLegendEl = document.getElementById("bugReportLegend");
  const bugDetailsLabelEl = document.getElementById("bugReportDetailsLabel");
  const bugReasonsBox = document.getElementById("bugReportReasons");
  const forumModReasonsBox = document.getElementById("forumModerationReasons");

  const setStatus = (msg, type = "") => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = "bt-bug-status" + (type ? ` is-${type}` : "");
    statusEl.classList.toggle("hidden", !msg);
  };

  const preselectPlatform = () => {
    if (!platformSelect) return;
    const ua = (navigator && navigator.userAgent) || "";
    const w = window.innerWidth || 0;
    if (window.Capacitor) {
      platformSelect.value = w >= 760 ? "Tablet (Web o App)" : "App Android (.apk)";
    } else if (IS_APPLE_TOUCH) {
      platformSelect.value = "iPhone / iPad (iOS Safari / Web App)";
    } else if (/Android/i.test(ua)) {
      platformSelect.value = w >= 760 ? "Tablet (Web o App)" : "Teléfono Android (Navegador)";
    } else {
      platformSelect.value = "Computadora (Navegador)";
    }
  };

  const closeMenuIfOpen = () => {
    const header = document.querySelector(".main-header");
    const navToggle = document.getElementById("navToggle");
    const navBackdrop = document.getElementById("navBackdrop");
    if (header) header.classList.remove("nav-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    if (navBackdrop) navBackdrop.hidden = true;
  };

  const applyReportModeUI = (isForumModeration) => {
    form.dataset.moderationMode = isForumModeration ? "1" : "";
    if (bugReasonsBox) bugReasonsBox.classList.toggle("hidden", Boolean(isForumModeration));
    if (forumModReasonsBox) forumModReasonsBox.classList.toggle("hidden", !isForumModeration);
    form.querySelectorAll('input[type="checkbox"]').forEach((c) => {
      c.checked = false;
    });
    if (bugTitleEl) {
      bugTitleEl.textContent = isForumModeration
        ? "Reportar contenido en La Fogata"
        : "Reportar error o falla";
    }
    if (bugLegendEl) {
      bugLegendEl.textContent = isForumModeration
        ? "¿Por qué reportas esta publicación o comentario? (marca los motivos)"
        : "¿Qué está fallando? (puedes marcar varios)";
    }
    if (bugDetailsLabelEl) {
      bugDetailsLabelEl.textContent = isForumModeration
        ? "Explica por qué reportas esto (obligatorio) *"
        : "Describe qué ocurrió y cómo pasó";
    }
    if (detailsInput) {
      detailsInput.placeholder = isForumModeration
        ? "Ej. Contiene una falta de respeto, expone un número privado o da un consejo peligroso..."
        : "Ej. Al abrir el PDF en modo oscuro sale en blanco, o falta el archivo...";
    }
  };

  const openModal = (prefillSection = "", prefillTarget = "", isForumModeration = false) => {
    closeMenuIfOpen();
    form.reset();
    applyReportModeUI(Boolean(isForumModeration));
    preselectPlatform();
    if (sectionSelect && prefillSection) {
      sectionSelect.value = prefillSection;
    }
    if (targetInput && prefillTarget) {
      targetInput.value = prefillTarget;
    }
    setStatus("");
    modal.classList.remove("hidden");
    activateDialogFocusTrap(modal, isForumModeration ? "#bugReportDetails" : "#bugReportPlatform");
  };

  window.__btOpenBugReport = openModal;

  const closeModal = () => {
    modal.classList.add("hidden");
    releaseDialogFocusTrap(modal);
  };

  if (openMenuBtn) openMenuBtn.addEventListener("click", () => openModal("", "", false));
  if (openFooterBtn) openFooterBtn.addEventListener("click", () => openModal("", "", false));
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const isModeration = form.dataset.moderationMode === "1";
    const activeContainer = isModeration ? forumModReasonsBox : bugReasonsBox;
    const checked = Array.from(
      (activeContainer || form).querySelectorAll('input[type="checkbox"]:checked')
    ).map((el) => el.value);
    const details = (detailsInput ? detailsInput.value : "").trim();
    const targetDoc = (targetInput ? targetInput.value : "").trim();
    const plat = platformSelect ? platformSelect.value : "Desconocida";
    const sec = sectionSelect ? sectionSelect.value : "Otro apartado";

    if (isModeration) {
      if (!checked.length) {
        setStatus("Selecciona al menos un motivo de por qué reportas este contenido.", "error");
        return;
      }
      if (details.length < 6) {
        setStatus("Explica brevemente el porqué de tu reporte (mínimo 6 caracteres).", "error");
        if (detailsInput) detailsInput.focus();
        return;
      }
    } else {
      if (!checked.length && !details) {
        setStatus("Marca al menos una opción o describe brevemente qué falló.", "error");
        return;
      }
      if (checked.includes("Otro problema específico") && details.length < 5) {
        setStatus("Describe brevemente qué problema específico ocurrió.", "error");
        if (detailsInput) detailsInput.focus();
        return;
      }
    }

    if (submitBtn) submitBtn.disabled = true;
    setStatus(isModeration ? "Enviando reporte de moderación..." : "Enviando reporte anónimo...");

    const ctx = detectClientContext();
    const payloadBody = JSON.stringify({
      _subject: isModeration
        ? `[MODERACIÓN LA FOGATA] ${sec} (${plat})`
        : `[REPORTE USUARIO / BUG] ${sec} (${plat})`,
      _template: "table",
      _captcha: "false",
      plataforma: `${plat} · Real: ${ctx.plat} · ${ctx.vista}`,
      navegador_y_tema: `${ctx.browser} (${ctx.os}) · Tema ${ctx.tema}`,
      alertas_bugs_o_sin_coincidencia: checked.join(" | ") || "Reporte manual",
      resumen_mas_usado: `Apartado: ${sec}${targetDoc ? ` · Ref: ${targetDoc}` : ""}`,
      actividad_completa: [
        isModeration
          ? `REPORTE DE MODERACIÓN EN LA FOGATA (${BT_SESSION_ID})`
          : `REPORTE EXPLÍCITO DEL USUARIO (${BT_SESSION_ID})`,
        `Usa BiblioTech en: ${plat}`,
        `Apartado: ${sec}`,
        `Motivos marcados: ${checked.join(", ") || "Ninguno"}`,
        targetDoc ? `Referencia: ${targetDoc}` : "",
        details ? `Porqué / Descripción: ${details}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    });

    const host = String((window.location && window.location.hostname) || "").toLowerCase();
    const isLocal = host === "127.0.0.1" || host === "localhost" || host === "::1" || window.location.protocol === "file:";

    let sentOk = isLocal;
    if (!isLocal) {
      const primaryEndpoint = (BT_TELEMETRY_CONFIG.workerEndpoint || "").trim();
      const fallbackEndpoint = `https://formsubmit.co/ajax/${encodeURIComponent(STATE.contactEmail || "rdc.tlxh@gmail.com")}`;
      const endpoints = primaryEndpoint ? [primaryEndpoint, fallbackEndpoint] : [fallbackEndpoint];
      const results = await Promise.allSettled(
        endpoints.map((ep) =>
          fetch(ep, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: payloadBody
          })
        )
      );
      sentOk = results.some((r) => r.status === "fulfilled" && r.value && r.value.ok);
    }

    if (submitBtn) submitBtn.disabled = false;

    if (sentOk) {
      setStatus("¡Gracias! Tu reporte anónimo se envió correctamente.", "ok");
      form.reset();
      preselectPlatform();
      setTimeout(() => closeModal(), 1400);
    } else {
      setStatus("No hay conexión ahora para enviarlo. Puedes escribir a rdc.tlxh@gmail.com.", "error");
    }
  });
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
const BT_TELEMETRY_CONFIG = {
  // Endpoint gratuito en Cloudflare Workers (Observability Logs) con respaldo automático a FormSubmit
  workerEndpoint: "https://bibliotech-telemetry.liamchuchundra1.workers.dev",
  emailFallback: `https://formsubmit.co/ajax/${encodeURIComponent(STATE.contactEmail || "rdc.tlxh@gmail.com")}`
};

const BT_CONSENT_KEY = "bt_consent_v1";
const BT_RECENT_QUERIES_KEY = "bt_recent_queries_v1";
const BT_ANON_QUEUE_KEY = "bt_anon_queue_v1";
const BT_ANON_STATS_KEY = "bt_anon_stats_v1";
const BT_SENT_HASHES_KEY = "bt_sent_hashes_v1";
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
function buildEventDedupKey(entry) {
  if (!entry || !entry.t) return "";
  switch (entry.t) {
    case "pregunta":
      return `q:${normalizeStr(entry.q || "")}`;
    case "feedback":
      return `fb:${entry.rate}:${normalizeStr(entry.q || "")}`;
    case "error_js":
      return `err:${String(entry.msg || "").slice(0, 80)}`;
    case "doc_abierto":
    case "doc_descarga":
    case "doc_offline_apk":
    case "pdf_nativo_apk":
      return `${entry.t}:${normalizeStr(entry.doc || entry.file || "")}`;
    case "busqueda_archivo":
      return `s:${entry.scope}:${normalizeStr(entry.q || "")}`;
    case "filtro_usado":
      return `f:${entry.filtro}:${entry.valor}`;
    case "vista_seccion":
      return `v:${entry.sec}`;
    default:
      return `${entry.t}:${entry.doc || entry.url || ""}`;
  }
}

function wasRecentlySentOrQueued(key, existingQueue) {
  if (!key) return false;
  if (Array.isArray(existingQueue) && existingQueue.some((it) => it && it.k === key)) {
    return true;
  }
  // Para acciones pasivas o repetidas dentro de la misma ventana de 24h, evitar duplicar reportes
  if (/^(v|f|q|doc_abierto|s|err):/.test(key)) {
    try {
      const cache = JSON.parse(localStorage.getItem(BT_SENT_HASHES_KEY) || "{}");
      const now = Date.now();
      if (cache && cache[key] && now - Number(cache[key]) < 86400000) {
        return true;
      }
    } catch (_) {}
  }
  return false;
}

function markHashesAsSent(events) {
  try {
    const raw = JSON.parse(localStorage.getItem(BT_SENT_HASHES_KEY) || "{}");
    const cache = raw && typeof raw === "object" ? raw : {};
    const now = Date.now();
    for (const ev of events || []) {
      if (ev && ev.k) cache[ev.k] = now;
    }
    // Conservar únicamente las últimas 160 firmas válidas (< 24h)
    const pruned = Object.entries(cache)
      .filter(([, ts]) => now - Number(ts) < 86400000)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 160);
    localStorage.setItem(BT_SENT_HASHES_KEY, JSON.stringify(Object.fromEntries(pruned)));
  } catch (_) {}
}

function enqueueAnonTelemetry(entry, flushNow = false) {
  if (!hasTelemetryConsent()) return;
  const ctx = detectClientContext();
  const dedupKey = buildEventDedupKey(entry);
  let qLen = 0;
  let newQuestionCount = 0;
  try {
    const prev = JSON.parse(localStorage.getItem(BT_ANON_QUEUE_KEY) || "[]");
    const queue = Array.isArray(prev) ? prev : [];
    // Evitar spam repetido del mismo evento en cola o ya enviado en 24h (salvo descargas / reportes explícitos)
    if (entry.t !== "feedback" && wasRecentlySentOrQueued(dedupKey, queue)) {
      return;
    }
    queue.push({
      ...entry,
      k: dedupKey,
      ts: new Date().toISOString().slice(0, 19).replace("T", " "),
      ses: BT_SESSION_ID,
      plat: ctx.plat,
      vista: ctx.vista,
      tema: ctx.tema
    });
    const trimmed = queue.slice(-80);
    qLen = trimmed.length;
    newQuestionCount = trimmed.filter((e) => e.t === "pregunta").length;
    localStorage.setItem(BT_ANON_QUEUE_KEY, JSON.stringify(trimmed));
  } catch (_) {}

  if (flushNow) {
    flushAnonymousTelemetry(true);
  } else if ((newQuestionCount >= 3 || qLen >= 12) && !btBatchCheckScheduled) {
    btBatchCheckScheduled = true;
    setTimeout(() => {
      btBatchCheckScheduled = false;
      flushAnonymousTelemetry(false);
    }, 30000);
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
    case "error_js":
      return `${head} [BUG / ERROR JS]: ${ev.msg} (${ev.src || ""})`;
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

  const isCritical = (e) => e && (e.t === "error_js" || (e.t === "feedback" && e.rate === "FALLO_O_FALTA_INFO"));
  const isMeaningful = (e) =>
    e &&
    (isCritical(e) ||
      e.t === "pregunta" ||
      e.t === "feedback" ||
      e.t === "doc_descarga" ||
      e.t === "doc_offline_apk" ||
      e.t === "pdf_nativo_apk" ||
      e.t === "doc_abierto" ||
      e.t === "busqueda_archivo");

  const criticalCount = queue.filter(isCritical).length;
  const meaningfulEvents = queue.filter(isMeaningful);
  const questionCount = queue.filter((e) => e.t === "pregunta").length;

  // No llenar la bandeja si solo hubo scroll pasivo sin preguntas, búsquedas ni documentos vistos
  if (!criticalCount && !meaningfulEvents.length) {
    return;
  }

  const now = Date.now();
  const lastSent = Number(localStorage.getItem(BT_LAST_SENT_KEY) || "0");
  // En salida de app (forceImmediate), enviar si hay al menos 1 acción sustancial nueva y pasaron >= 25s
  // En segundo plano periódico, exigir >= 3 preguntas o >= 3 minutos con actividad relevante
  if (!criticalCount) {
    if (forceImmediate) {
      if (now - lastSent < 25000 && meaningfulEvents.length < 2) return;
    } else {
      const cooldownOk = now - lastSent >= 180000;
      if (!cooldownOk && questionCount < 4) return;
      if (questionCount < 1 && meaningfulEvents.length < 3) return;
    }
  }

  btFlushInFlight = true;
  try {
    const batch = queue.slice(0, 25);
    const ctx = detectClientContext();
    const lines = batch.map((ev, i) => formatTelemetryEventLine(ev, i));
    const statsBlock = formatTopStatsBlock();
    const issueLines = batch
      .filter((ev) => isCritical(ev) || (ev.t === "pregunta" && ev.ok === "sin_coincidencia"))
      .map((ev) => `- [${ev.t}] ${ev.q || ev.msg || ""}`);

    const payloadBody = JSON.stringify({
      _subject: issueLines.length
        ? `[ALERTA/BUG] BiblioTech [${ctx.plat}] — ${batch.length} eventos (${BT_SESSION_ID})`
        : `BiblioTech Scout [${ctx.plat}] — ${questionCount} preg / ${meaningfulEvents.length} acciones`,
      _template: "table",
      _captcha: "false",
      plataforma: `${ctx.plat} · ${ctx.vista}`,
      navegador_y_tema: `${ctx.browser} (${ctx.os}) · Tema ${ctx.tema}`,
      alertas_bugs_o_sin_coincidencia: issueLines.length ? issueLines.join("\n") : "Ninguna falla ni pregunta sin respuesta en este lote",
      resumen_mas_usado: statsBlock || "Primeros eventos acumulados",
      actividad_completa: lines.join("\n\n")
    });

    const primaryEndpoint = (BT_TELEMETRY_CONFIG.workerEndpoint || "").trim();
    const fallbackEndpoint = `https://formsubmit.co/ajax/${encodeURIComponent(STATE.contactEmail || "rdc.tlxh@gmail.com")}`;
    const endpoints = primaryEndpoint ? [primaryEndpoint, fallbackEndpoint] : [fallbackEndpoint];

    const results = await Promise.allSettled(
      endpoints.map((ep) =>
        fetch(ep, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: payloadBody,
          keepalive: true
        })
      )
    );
    const sentOk = results.some((r) => r.status === "fulfilled" && r.value && r.value.ok);

    if (sentOk) {
      markHashesAsSent(batch);
      const remaining = queue.slice(batch.length);
      localStorage.setItem(BT_ANON_QUEUE_KEY, JSON.stringify(remaining));
      localStorage.setItem(BT_LAST_SENT_KEY, String(Date.now()));
    }
  } catch (_) {
    // Reintentar en la siguiente sesión si falla la red
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

  // 4. Despliegue de tarjetas/acordeones informativos
  document.addEventListener(
    "toggle",
    (e) => {
      const det = e.target;
      if (det && det.matches && det.matches("details.bt-acc-card") && det.open) {
        const title = (det.querySelector("h3") || {}).textContent || "";
        bumpStatCounter("topFilters", `acordeon:${title}`, 25);
        enqueueAnonTelemetry({ t: "filtro_usado", filtro: "acordeon_abierto", valor: title.trim() }, false);
      }
    },
    true
  );

  // 5. Captura anónima de errores JS / bugs reales de ejecución
  window.addEventListener("error", (ev) => {
    if (!hasTelemetryConsent() || !ev || !ev.message) return;
    enqueueAnonTelemetry(
      {
        t: "error_js",
        msg: String(ev.message).slice(0, 180),
        src: `${String(ev.filename || "").split("/").pop()}:${ev.lineno || 0}`
      },
      true
    );
  });
  window.addEventListener("unhandledrejection", (ev) => {
    if (!hasTelemetryConsent() || !ev || !ev.reason) return;
    const msg = ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason);
    enqueueAnonTelemetry(
      {
        t: "error_js",
        msg: String(msg).slice(0, 180),
        src: "promise_rejection"
      },
      true
    );
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
    let welcomeSeen = false;
    try {
      saved = localStorage.getItem(BT_CONSENT_KEY);
      welcomeSeen = localStorage.getItem(BT_WELCOME_SEEN_KEY) === "1";
    } catch (_) {}
    const welcomeModal = document.getElementById("welcomeModal");
    if (!saved && overlay && (!welcomeModal || welcomeSeen)) {
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

// ============================================================================
// BÓVEDA LOCAL DE AUTOLLENADO SCOUT + PRÓXIMAMENTE EDITOR DE FORMATOS
// ============================================================================

const BT_AUTOFILL_PROFILE_KEY = "bt_autofill_profile_v1";

function getAutofillProfile() {
  try {
    const raw = localStorage.getItem(BT_AUTOFILL_PROFILE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function setupAutofillVault() {
  const form = document.getElementById("autofillProfileForm");
  const statusBadge = document.getElementById("autofillStatusBadge");
  const previewBtn = document.getElementById("btnPreviewAutofillDemo");
  const clearBtn = document.getElementById("btnClearAutofillProfile");
  const demoBox = document.getElementById("autofillDemoPreview");

  const fields = {
    name: document.getElementById("afName"),
    cum: document.getElementById("afCum"),
    age: document.getElementById("afAge"),
    section: document.getElementById("afSection"),
    group: document.getElementById("afGroup"),
    province: document.getElementById("afProvince"),
    blood: document.getElementById("afBlood"),
    emergency: document.getElementById("afEmergency"),
    scouter: document.getElementById("afScouter")
  };

  const readFormProfile = () => ({
    name: (fields.name ? fields.name.value : "").trim(),
    cum: (fields.cum ? fields.cum.value : "").trim().toUpperCase(),
    age: (fields.age ? fields.age.value : "").trim(),
    section: (fields.section ? fields.section.value : "Comunidad de Caminantes").trim(),
    group: (fields.group ? fields.group.value : "").trim(),
    province: (fields.province ? fields.province.value : "").trim(),
    blood: (fields.blood ? fields.blood.value : "").trim(),
    emergency: (fields.emergency ? fields.emergency.value : "").trim(),
    scouter: (fields.scouter ? fields.scouter.value : "").trim()
  });

  const hasAnySavedData = (prof) =>
    Boolean(
      prof &&
        (prof.name || prof.cum || prof.age || prof.group || prof.province || prof.blood || prof.emergency || prof.scouter)
    );

  const updateBadge = (prof) => {
    if (!statusBadge) return;
    const ready = hasAnySavedData(prof);
    statusBadge.classList.toggle("is-ready", ready);
    statusBadge.textContent = ready ? "Perfil listo en este dispositivo" : "Sin datos guardados";
  };

  const fillFormFromStorage = () => {
    const prof = getAutofillProfile();
    if (fields.name && prof.name) fields.name.value = prof.name;
    if (fields.cum && prof.cum) fields.cum.value = prof.cum;
    if (fields.age && prof.age) fields.age.value = prof.age;
    if (fields.section && prof.section) fields.section.value = prof.section;
    if (fields.group && prof.group) fields.group.value = prof.group;
    if (fields.province && prof.province) fields.province.value = prof.province;
    if (fields.blood && prof.blood) fields.blood.value = prof.blood;
    if (fields.emergency && prof.emergency) fields.emergency.value = prof.emergency;
    if (fields.scouter && prof.scouter) fields.scouter.value = prof.scouter;
    updateBadge(prof);
  };

  const renderDemo = (profileData) => {
    if (!demoBox) return;
    const val = (k, fallback) => escapeHtml((profileData && profileData[k]) || fallback);
    demoBox.innerHTML = `
      <div class="autofill-demo-grid">
        <div class="autofill-demo-doc">
          <div class="autofill-demo-doc-head">Permiso de Salida (JL304)</div>
          <div class="autofill-demo-rows">
            <div class="autofill-demo-row"><span>Participante:</span><span class="autofill-demo-fill">${val("name", "(Nombre Scout)")}</span></div>
            <div class="autofill-demo-row"><span>CUM / Edad:</span><span class="autofill-demo-fill">${val("cum", "—")} · ${val("age", "—")} años</span></div>
            <div class="autofill-demo-row"><span>Grupo / Prov.:</span><span class="autofill-demo-fill">${val("group", "—")} · ${val("province", "—")}</span></div>
            <div class="autofill-demo-row"><span>Autoriza:</span><span class="autofill-demo-fill">${val("emergency", "(Padre/Tutor)")}</span></div>
            <div class="autofill-demo-row"><span>Responsable:</span><span class="autofill-demo-fill">${val("scouter", "(Scouter)")}</span></div>
          </div>
        </div>

        <div class="autofill-demo-doc">
          <div class="autofill-demo-doc-head">Ficha Médica y de Salud</div>
          <div class="autofill-demo-rows">
            <div class="autofill-demo-row"><span>Scout:</span><span class="autofill-demo-fill">${val("name", "(Nombre)")}</span></div>
            <div class="autofill-demo-row"><span>Sección:</span><span class="autofill-demo-fill">${val("section", "Comunidad de Caminantes")}</span></div>
            <div class="autofill-demo-row"><span>Sangre / Alergias:</span><span class="autofill-demo-fill">${val("blood", "(Sin completar)")}</span></div>
            <div class="autofill-demo-row"><span>Contacto SOS:</span><span class="autofill-demo-fill">${val("emergency", "(Contacto)")}</span></div>
          </div>
        </div>

        <div class="autofill-demo-doc">
          <div class="autofill-demo-doc-head">Cédula SMART / RECME</div>
          <div class="autofill-demo-rows">
            <div class="autofill-demo-row"><span>Proponente:</span><span class="autofill-demo-fill">${val("name", "(Nombre)")}</span></div>
            <div class="autofill-demo-row"><span>Sección:</span><span class="autofill-demo-fill">${val("section", "Comunidad de Caminantes")}</span></div>
            <div class="autofill-demo-row"><span>Grupo / Provincia:</span><span class="autofill-demo-fill">${val("group", "—")} · ${val("province", "—")}</span></div>
            <div class="autofill-demo-row"><span>Asesor / Scouter:</span><span class="autofill-demo-fill">${val("scouter", "(Sin asignar)")}</span></div>
          </div>
        </div>
      </div>
    `;
  };

  if (form) {
    fillFormFromStorage();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const prof = readFormProfile();
      try {
        localStorage.setItem(BT_AUTOFILL_PROFILE_KEY, JSON.stringify(prof));
      } catch (_) {}
      updateBadge(prof);
      if (demoBox && !demoBox.classList.contains("hidden")) {
        renderDemo(prof);
      }
      BiblioFeel.pulse([10, 24]);
      if (typeof window.__btSyncSmartFormFromProfile === "function") {
        window.__btSyncSmartFormFromProfile(prof, false);
      }
      showWebToast("Perfil local guardado. Listo para usar en el Editor de Formatos y La Fogata.");
      enqueueAnonTelemetry({ t: "ui_accion", label: "autofill_perfil_guardado" }, false);
    });
  }

  if (previewBtn && demoBox) {
    previewBtn.addEventListener("click", () => {
      const willOpen = demoBox.classList.contains("hidden");
      if (willOpen) {
        const prof = readFormProfile();
        renderDemo(prof);
        demoBox.classList.remove("hidden");
        previewBtn.textContent = "Ocultar demostración";
      } else {
        demoBox.classList.add("hidden");
        previewBtn.textContent = "Ver demostración de autollenado";
      }
    });
  }

  if (clearBtn && form) {
    clearBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem(BT_AUTOFILL_PROFILE_KEY);
      } catch (_) {}
      form.reset();
      if (fields.section) fields.section.value = "Comunidad de Caminantes";
      updateBadge({});
      if (demoBox) demoBox.classList.add("hidden");
      if (previewBtn) previewBtn.textContent = "Ver demostración de autollenado";
      showWebToast("Datos locales de autollenado borrados de este dispositivo.");
    });
  }

  setupSmartFormsEngine(readFormProfile);
}

// ============================================================================
// EDITOR INTELIGENTE DE FORMATOS SCOUT (100% LOCAL, OFFLINE, PDF Y WORD)
// ============================================================================
const BT_SF_ACTIVE_PREFIX = "bt_sf_active_v1_";
const BT_SF_DRAFTS_KEY = "bt_sf_named_drafts_v1";

const SMART_FORM_TEMPLATES = {
  salud: {
    id: "salud",
    code: "ASMAC-SALUD",
    baseDocId: "doc-0325",
    baseDocName: "FICHA MÉDICA EDITABLE.pdf",
    title: "Ficha Médica y de Salud Scout",
    subtitle: "Basado en el documento oficial FICHA MÉDICA EDITABLE.pdf de ASMAC",
    signatures: ["Firma del Padre, Madre o Tutor Legal", "Firma del Participante / Scout", "Recibió: Scouter Responsable"],
    officialPages: [
      {
        src: "img/forms/salud_p1.webp",
        aspect: "1311 / 1853",
        boxes: [
          { key: "date", x: 71.0, y: 13.6, w: 23.5, h: 1.3 },
          { key: "name", x: 20.3, y: 15.8, w: 40.5, h: 1.4 },
          { key: "age", x: 81.6, y: 15.8, w: 12.8, h: 1.4 },
          { key: "province", x: 20.3, y: 17.2, w: 40.5, h: 1.4 },
          { key: "group", x: 81.6, y: 17.2, w: 12.8, h: 1.4 },
          { key: "cum", x: 20.3, y: 18.5, w: 40.5, h: 1.4 },
          { key: "section", x: 81.6, y: 18.5, w: 12.8, h: 1.4 },
          { key: "blood", x: 8.8, y: 20.9, w: 85.5, h: 1.6 },
          { key: "blood", x: 21.3, y: 24.1, w: 12.2, h: 1.3 },
          { key: "insurance", x: 53.8, y: 27.6, w: 29.0, h: 1.4 },
          { key: "blood", x: 8.8, y: 34.8, w: 85.5, h: 2.2 },
          { key: "medications", x: 8.8, y: 39.5, w: 85.5, h: 2.3, multiline: true },
          { key: "notes", x: 9.2, y: 81.0, w: 84.5, h: 5.5, multiline: true }
        ]
      },
      {
        src: "img/forms/salud_p2.webp",
        aspect: "1311 / 1853",
        boxes: [
          { key: "emergency", x: 21.2, y: 39.2, w: 33.0, h: 1.3 },
          { key: "emergencyPhone", x: 21.2, y: 40.5, w: 33.0, h: 1.3 },
          { key: "scouter", x: 21.2, y: 43.0, w: 33.0, h: 1.3 },
          { key: "notes", x: 8.8, y: 49.2, w: 25.5, h: 10.0, multiline: true },
          { key: "emergency", x: 12.0, y: 70.2, w: 25.0, h: 1.6, align: "center" },
          { key: "name", x: 63.0, y: 70.2, w: 25.0, h: 1.6, align: "center" }
        ]
      }
    ],
    fields: [
      { key: "name", label: "Nombre completo del participante", type: "text", bind: "name", placeholder: "Ej. Liam Durán" },
      { key: "cum", label: "CUM", type: "text", bind: "cum", placeholder: "Ej. TLX0530123" },
      { key: "age", label: "Edad / Fecha de nacimiento", type: "text", bind: "age", placeholder: "Ej. 16 años" },
      { key: "section", label: "Sección", type: "text", bind: "section", placeholder: "Comunidad de Caminantes" },
      { key: "group", label: "Grupo Scout", type: "text", bind: "group", placeholder: "Ej. Grupo 53" },
      { key: "province", label: "Provincia Scout", type: "text", bind: "province", placeholder: "Ej. Tláhuac-Xochimilco" },
      { key: "blood", label: "Tipo de sangre y alergias", type: "text", bind: "blood", placeholder: "Ej. O+ · Sin alergias conocidas" },
      { key: "insurance", label: "Servicio médico / Seguro / NSS", type: "text", placeholder: "Ej. IMSS / Seguro Scout ASMAC vigente" },
      { key: "emergency", label: "Contacto de emergencia (Nombre y parentesco)", type: "text", bind: "emergency", placeholder: "Ej. Madre / Tutor responsable" },
      { key: "emergencyPhone", label: "Teléfono(s) de emergencia 24 h", type: "text", placeholder: "Ej. 55 1234 5678" },
      { key: "scouter", label: "Scouter responsable", type: "text", bind: "scouter", placeholder: "Ej. Coordinador de Comunidad" },
      { key: "date", label: "Fecha de actualización", type: "text", defaultToday: true },
      { key: "medications", label: "Medicamentos actuales, dosis o tratamientos en curso", type: "textarea", full: true, placeholder: "Indicar si toma algún medicamento, horario y dosis, o escribir «Ninguno»." },
      { key: "notes", label: "Restricciones alimenticias, físicas o indicaciones médicas importantes", type: "textarea", full: true, placeholder: "Observaciones de salud relevantes para el equipo de dirigentes en campamento." }
    ]
  },
  jl304: {
    id: "jl304",
    code: "FORMATO JL304 / JL306",
    baseDocId: "doc-0305",
    baseDocName: "ASMAC/DNGDI/CNAR/JL306 — Autorización de eventos",
    title: "Permiso de Actividad y Salida Scout (JL304 / JL306)",
    subtitle: "Basado en el formato oficial de Autorización de participación en eventos de ASMAC",
    signatures: ["Nombre y Firma del Padre, Madre o Tutor", "Firma del Scouter Responsable", "Vo. Bo. Jefatura de Grupo"],
    officialPages: [
      {
        src: "img/forms/jl304_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "departureDate", x: 47.0, y: 15.6, w: 40.0, h: 1.8, align: "center" },
          { key: "name", x: 13.0, y: 25.4, w: 74.0, h: 2.0, align: "center" },
          { key: "age", x: 47.0, y: 34.6, w: 40.0, h: 1.8, align: "center" },
          { key: "destination", x: 12.0, y: 47.7, w: 54.5, h: 1.5 },
          { key: "returnDate", x: 22.5, y: 49.4, w: 51.0, h: 1.5 },
          { key: "scouter", x: 35.0, y: 53.8, w: 45.5, h: 1.5 }
        ]
      },
      {
        src: "img/forms/jl304_p2.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "emergency", x: 12.0, y: 26.8, w: 30.0, h: 1.6, align: "center" },
          { key: "scouter", x: 54.0, y: 26.8, w: 30.0, h: 1.6, align: "center" },
          { key: "emergency", x: 12.0, y: 74.2, w: 30.0, h: 1.6, align: "center" },
          { key: "group", x: 54.0, y: 74.2, w: 30.0, h: 1.6, align: "center" }
        ]
      }
    ],
    fields: [
      { key: "name", label: "Nombre del Scout participante", type: "text", bind: "name", placeholder: "Ej. Liam Durán" },
      { key: "cum", label: "CUM", type: "text", bind: "cum", placeholder: "Ej. TLX0530123" },
      { key: "age", label: "Edad / Fecha de nacimiento", type: "text", bind: "age", placeholder: "Ej. 16 años" },
      { key: "section", label: "Sección", type: "text", bind: "section", placeholder: "Comunidad de Caminantes" },
      { key: "group", label: "Grupo Scout", type: "text", bind: "group", placeholder: "Ej. Grupo 53" },
      { key: "province", label: "Provincia Scout", type: "text", bind: "province", placeholder: "Ej. Tláhuac-Xochimilco" },
      { key: "eventName", label: "Nombre de la actividad o campamento", type: "text", placeholder: "Ej. Campamento de Sección en Meztitla" },
      { key: "destination", label: "Lugar / Evento denominado", type: "text", placeholder: "Ej. Campo Escuela Scout Meztitla, Tepoztlán, Mor." },
      { key: "departureDate", label: "Fecha de autorización / Salida", type: "text", defaultToday: true },
      { key: "returnDate", label: "Fechas del evento (Salida y regreso)", type: "text", placeholder: "Ej. 22 al 23 de noviembre de 2026" },
      { key: "meetingPoint", label: "Punto de reunión y entrega", type: "text", placeholder: "Ej. Local de Grupo / Parque habitual" },
      { key: "scouter", label: "Scouter responsable / Acompañante autorizado", type: "text", bind: "scouter", placeholder: "Nombre y cargo del dirigente" },
      { key: "emergency", label: "Padre, madre o tutor que autoriza", type: "text", bind: "emergency", placeholder: "Nombre completo del tutor" },
      { key: "blood", label: "Tipo de sangre y alergias a considerar", type: "text", bind: "blood", placeholder: "Ej. O+ · Ninguna" },
      { key: "gearAndCost", label: "Equipo requerido y observaciones de transporte", type: "textarea", full: true, placeholder: "Uniforme completo, equipo de acampado, hidratación, ficha médica vigente." },
      { key: "declaration", label: "Declaración de autorización", type: "textarea", full: true, defaultValue: "Autorizo que mi hijo(a) o tutorado(a) participe en la actividad descrita bajo las normas de la Asociación de Scouts de México, A.C. (ASMAC) y la política A Salvo del Peligro, facultando a los dirigentes responsables a tomar las medidas médicas de urgencia necesarias en caso de incidente." }
    ]
  },
  fes: {
    id: "fes",
    code: "PLANTILLA P5.1 · FES",
    baseDocId: "doc-0695",
    baseDocName: "P5.1_PlantillaEspecialidad_v1.1.pdf",
    title: "Ficha de Especialidad Scout (Plantilla Oficial P5.1)",
    subtitle: "Basado en el archivo oficial P5.1_PlantillaEspecialidad_v1.1.pdf de RECME ASMAC",
    signatures: ["Firma del Joven / Participante", "Firma del Sinodal o Asesor de Especialidad", "Firma del Scouter de Sección"],
    officialPages: [
      {
        src: "img/forms/fes_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "specialtyName", x: 5.2, y: 8.4, w: 58.0, h: 3.6 },
          { key: "section", x: 69.5, y: 8.4, w: 24.5, h: 3.6 },
          { key: "odsGoal", x: 70.0, y: 29.0, w: 24.0, h: 3.6 },
          { key: "learningGoals", x: 5.2, y: 24.0, w: 58.0, h: 10.0, multiline: true },
          { key: "fesAxis", x: 5.2, y: 36.7, w: 58.0, h: 3.2 },
          { key: "evidences", x: 5.2, y: 43.8, w: 58.0, h: 10.0, multiline: true },
          { key: "level", x: 5.2, y: 57.2, w: 58.0, h: 3.2 },
          { key: "scouter", x: 5.2, y: 64.2, w: 58.0, h: 9.8, multiline: true },
          { key: "group", x: 70.0, y: 77.5, w: 23.5, h: 11.0, multiline: true },
          { key: "name", x: 5.2, y: 94.6, w: 46.5, h: 3.2 }
        ]
      }
    ],
    fields: [
      { key: "name", label: "Elaboró (Nombre del Scout y CUM)", type: "text", bind: "name" },
      { key: "cum", label: "CUM", type: "text", bind: "cum" },
      { key: "section", label: "Sección", type: "text", bind: "section" },
      { key: "group", label: "Grupo, Provincia y Medidas de Seguridad", type: "text", bind: "group" },
      { key: "province", label: "Provincia Scout", type: "text", bind: "province" },
      { key: "specialtyName", label: "Nombre de mi Especialidad (FES)", type: "text", placeholder: "Ej. Gestión de Riesgos en Áreas Naturales / Primeros Auxilios" },
      { key: "fesAxis", label: "Eje temático FES / Qué más puedo aprender", type: "select", options: ["Salud y Bienestar", "Habilidades para la Vida", "Ambiente y Sustentabilidad", "Paz y Acción Comunitaria"] },
      { key: "odsGoal", label: "Tema relacionado y ODS (Agenda 2030)", type: "text", placeholder: "Ej. ODS 3: Salud y Bienestar / ODS 13: Acción por el Clima" },
      { key: "level", label: "Nivel o etapa / Qué más puedo hacer", type: "select", options: ["Nivel Básico / Exploración", "Nivel Intermedio / Dominio", "Nivel Avanzado / Servicio"] },
      { key: "scouter", label: "3. Comparto y Sinodal acompañante", type: "text", bind: "scouter" },
      { key: "evalDate", label: "Fecha de presentación", type: "text", defaultToday: true },
      { key: "learningGoals", label: "1. CONOZCO — Lo que tengo que aprender sobre la especialidad", type: "textarea", full: true, placeholder: "Qué conocimientos teóricos y habilidades prácticas se acordaron con el sinodal." },
      { key: "evidences", label: "2. APLICO — Lo que hago para demostrar los conocimientos adquiridos", type: "textarea", full: true, placeholder: "Describe las prácticas, talleres, bitácora o demostración realizada ante la sección." }
    ]
  },
  smart: {
    id: "smart",
    code: "PLANTILLA P6.2 · PROYECTO",
    baseDocId: "doc-0697",
    baseDocName: "P6.2_PlantillaProyecto_V1.0.pdf",
    title: "Ficha de Proyecto Scout (Plantilla Oficial P6.2)",
    subtitle: "Basado en el archivo oficial P6.2_PlantillaProyecto_V1.0.pdf de RECME ASMAC",
    signatures: ["Firma del Coordinador / Proponente", "Firma del Asesor o Scouter", "Validación Consejo / Red"],
    officialPages: [
      {
        src: "img/forms/smart_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "projectTitle", x: 41.2, y: 7.4, w: 52.5, h: 3.2 },
          { key: "startDate", x: 6.8, y: 9.0, w: 25.0, h: 2.5 },
          { key: "name", x: 6.8, y: 19.3, w: 25.0, h: 2.5 },
          { key: "scouter", x: 6.8, y: 24.4, w: 25.0, h: 2.5 },
          { key: "group", x: 6.8, y: 36.8, w: 25.0, h: 2.4 },
          { key: "province", x: 6.8, y: 46.2, w: 25.0, h: 2.4 },
          { key: "smartGoal", x: 41.0, y: 15.0, w: 25.0, h: 11.0, multiline: true },
          { key: "activities", x: 40.6, y: 30.0, w: 25.5, h: 25.5, multiline: true },
          { key: "diagnosis", x: 40.6, y: 59.8, w: 52.5, h: 5.2, multiline: true },
          { key: "impact", x: 40.6, y: 68.4, w: 52.5, h: 5.2, multiline: true },
          { key: "section", x: 40.6, y: 76.9, w: 52.5, h: 3.2 },
          { key: "framework", x: 40.6, y: 91.5, w: 52.5, h: 2.6 }
        ]
      }
    ],
    fields: [
      { key: "name", label: "Nombre de quien lidera y coordina el proyecto", type: "text", bind: "name" },
      { key: "cum", label: "CUM", type: "text", bind: "cum" },
      { key: "section", label: "Sección y alcance del proyecto", type: "text", bind: "section" },
      { key: "group", label: "Grupo Scout / Logística", type: "text", bind: "group" },
      { key: "province", label: "Provincia Scout / Relaciones institucionales", type: "text", bind: "province" },
      { key: "framework", label: "Palabras clave / Iniciativa o Insignia objetivo", type: "select", options: ["Agentes de Cambio.MX (Red de Caminantes)", "Tribu de la Tierra (Earth Tribe)", "Campeones de la Naturaleza", "Mensajeros de la Paz", "Horas al Aire Libre / Vida Silvestre", "Insignia de Jade / Insignia de Obsidiana", "Máxima Insignia de Sección"] },
      { key: "projectTitle", label: "Nombre del proyecto / Título", type: "text", full: true, placeholder: "Nombre claro y concreto del proyecto" },
      { key: "scouter", label: "Nombre de quien me asesora", type: "text", bind: "scouter" },
      { key: "startDate", label: "Fecha de inicio del proyecto", type: "text", defaultToday: true },
      { key: "smartGoal", label: "Objetivo General (SMART)", type: "textarea", full: true, placeholder: "Ej. Lograr recolectar/capacitar/restaurar [meta numérica] en [lugar] antes del [fecha]." },
      { key: "activities", label: "Objetivos Particulares y Fases del Proyecto", type: "textarea", full: true, placeholder: "Actividades principales, responsables, recursos y medidas de seguridad." },
      { key: "diagnosis", label: "¿Qué necesidad o problemática estoy atendiendo específicamente?", type: "textarea", full: true, placeholder: "Qué necesidad real de la comunidad o entorno atiende este proyecto." },
      { key: "impact", label: "¿A quién o quiénes afecta esta problemática y cuál es el impacto?", type: "textarea", full: true, placeholder: "Personas beneficiadas, horas totales de servicio del equipo y resultados verificables." }
    ]
  },
  programa: {
    id: "programa",
    code: "PLANTILLA P6.3 · PROGRAMA",
    baseDocId: "doc-0698",
    baseDocName: "P6.3_PlantillaPrograma_v1.0.pdf",
    title: "Formato Programa de Actividades (Plantilla Oficial P6.3)",
    subtitle: "Basado en el archivo oficial P6.3_PlantillaPrograma_v1.0.pdf de RECME ASMAC",
    signatures: ["Elaboró: Equipo / Consejo de Sección", "Revisó: Scouter Responsable", "Autorizó: Jefatura de Grupo"],
    officialPages: [
      {
        src: "img/forms/programa_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "group", x: 6.8, y: 3.7, w: 25.0, h: 2.5 },
          { key: "dates", x: 6.8, y: 9.0, w: 24.0, h: 2.5 },
          { key: "section", x: 35.4, y: 9.0, w: 13.0, h: 2.5 },
          { key: "eventName", x: 51.6, y: 9.0, w: 42.0, h: 2.5 },
          { key: "location", x: 6.8, y: 13.6, w: 24.0, h: 2.5 },
          { key: "scouter", x: 35.4, y: 13.6, w: 58.0, h: 2.5 },
          { key: "province", x: 6.8, y: 18.4, w: 24.0, h: 2.5 },
          { key: "gearList", x: 66.6, y: 19.6, w: 27.5, h: 20.0, multiline: true },
          { key: "emergency", x: 6.8, y: 35.2, w: 49.5, h: 5.2, multiline: true },
          { key: "scheduleBlocks", x: 7.0, y: 48.2, w: 87.0, h: 27.5, multiline: true },
          { key: "educationalGoal", x: 6.8, y: 80.6, w: 87.0, h: 7.0, multiline: true }
        ]
      }
    ],
    fields: [
      { key: "eventName", label: "Nombre de la sección / Evento o actividad", type: "text", full: true, placeholder: "Ej. Acantonamiento / Campamento de Patrullas / Actividad de Comunidad" },
      { key: "section", label: "Sección", type: "text", bind: "section" },
      { key: "group", label: "Grupo Scout", type: "text", bind: "group" },
      { key: "province", label: "Provincia / Duración total", type: "text", bind: "province" },
      { key: "dates", label: "Fecha", type: "text", defaultToday: true },
      { key: "location", label: "Lugar / Sede", type: "text", placeholder: "Lugar exacto y referencias de acceso" },
      { key: "scouter", label: "Responsable de la sección", type: "text", bind: "scouter" },
      { key: "emergency", label: "Medidas de seguridad y contacto de emergencia", type: "text", bind: "emergency" },
      { key: "scheduleBlocks", label: "Programa general (Minuto a minuto: Tiempo | Actividad | Responsable)", type: "textarea", full: true, placeholder: "08:00 | Registro y revisión JL304 | Jefatura\n09:00 | Apertura y montaje | Pequeños grupos\n11:00 | Gran Juego / Taller técnico | Equipo coordinador\n14:00 | Comida por pequeños grupos | Intendencia\n16:00 | Evaluación y cierre | Toda la sección" },
      { key: "gearList", label: "Materiales y equipo indispensable", type: "textarea", full: true, placeholder: "Mochila, bolsa estanca, lámpara frontal, cantimplora, impermeable, botiquín personal." },
      { key: "educationalGoal", label: "Competencias que se busca desarrollar", type: "textarea", full: true, placeholder: "Qué áreas de crecimiento, progresión o vida al aire libre se trabajan." }
    ]
  },
  acta: {
    id: "acta",
    code: "PLANTILLA P6.4 · ACTA",
    baseDocId: "doc-0699",
    baseDocName: "P6.4_PlantillaActadeConsejodeNivel_v1.0.pdf",
    title: "Acta de Consejo de Nivel y Corte de Honor (Plantilla Oficial P6.4)",
    subtitle: "Basado en el archivo oficial P6.4_PlantillaActadeConsejodeNivel_v1.0.pdf de RECME ASMAC",
    signatures: ["Firma de quien preside la sesión", "Firma de Secretaría / Redacción", "Firmas de conformidad de asistentes"],
    officialPages: [
      {
        src: "img/forms/acta_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "attendees", x: 5.5, y: 11.2, w: 61.0, h: 35.0, multiline: true },
          { key: "group", x: 70.2, y: 8.3, w: 24.5, h: 3.8 },
          { key: "province", x: 70.2, y: 15.4, w: 24.5, h: 3.8 },
          { key: "datePlace", x: 70.2, y: 22.8, w: 24.5, h: 3.8 },
          { key: "datePlace", x: 70.2, y: 37.2, w: 24.5, h: 3.8 },
          { key: "organType", x: 70.2, y: 44.2, w: 24.5, h: 3.8 },
          { key: "agenda", x: 5.2, y: 52.4, w: 89.5, h: 41.0, multiline: true }
        ]
      },
      {
        src: "img/forms/acta_p2.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "agreements", x: 5.2, y: 8.6, w: 89.5, h: 45.5, multiline: true },
          { key: "name", x: 5.2, y: 67.3, w: 42.5, h: 3.8 },
          { key: "scouter", x: 51.8, y: 67.3, w: 42.5, h: 3.8 },
          { key: "scouter", x: 5.2, y: 76.2, w: 89.5, h: 3.8 }
        ]
      }
    ],
    fields: [
      { key: "organType", label: "Tipo de sesión de Consejo / Órgano", type: "select", options: ["Consejo de Grupo", "Corte de Honor de Tropa", "Asamblea / Comité de Comunidad", "Consejo de Clan Rover", "Consejo de Roca de Manada", "Acuerdo de Diálogo Directo / MASC"] },
      { key: "datePlace", label: "Fecha, hora y lugar de la sesión", type: "text", defaultToday: true },
      { key: "group", label: "Grupo Scout", type: "text", bind: "group" },
      { key: "province", label: "Sección / Provincia Scout", type: "text", bind: "province" },
      { key: "name", label: "Elaboró (Secretaría / Redacción)", type: "text", bind: "name" },
      { key: "scouter", label: "Presidió / Scouter responsable", type: "text", bind: "scouter" },
      { key: "attendees", label: "1. Lista de asistencia (Nombre | CUM)", type: "textarea", full: true, placeholder: "Nombres y CUM de quienes integran la sesión." },
      { key: "agenda", label: "2. Orden del día / Puntos a tratar o revisar", type: "textarea", full: true, placeholder: "1) Lectura de acta anterior\n2) Evaluación de actividades\n3) Progresiones e insignias\n4) Próximo ciclo de programa" },
      { key: "agreements", label: "3. Acuerdos tomados, responsables y fechas compromiso (Página 2)", type: "textarea", full: true, placeholder: "Detallar cada acuerdo votado o consensuado, quién le da seguimiento y cuándo se revisa." }
    ]
  }
};

function setupSmartFormsEngine(readFormProfileFn) {
  const workspace = document.getElementById("smartFormWorkspace");
  const selectEl = document.getElementById("sfTemplateSelect");
  const fieldsContainer = document.getElementById("sfFormFieldsContainer");
  const sheetEl = document.getElementById("sfDocumentSheet");
  const statusEl = document.getElementById("sfSaveStatus");
  const applyProfileBtn = document.getElementById("btnSfApplyProfile");
  const saveDraftBtn = document.getElementById("btnSfSaveNamedDraft");
  const resetBtn = document.getElementById("btnSfResetForm");
  const draftsWrap = document.getElementById("sfSavedDraftsWrap");
  const draftsList = document.getElementById("sfSavedDraftsList");
  const splitLayout = document.getElementById("sfSplitLayout");
  const printBtn = document.getElementById("btnSfPrintPdf");
  const wordBtn = document.getElementById("btnSfDownloadDoc");
  const copyBtn = document.getElementById("btnSfCopyText");
  if (!workspace || !selectEl || !fieldsContainer || !sheetEl) return;

  let currentTemplateId = "salud";
  let currentValues = {};

  const todayStr = () => new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

  const readActiveStorage = (tplId) => {
    try {
      const raw = localStorage.getItem(BT_SF_ACTIVE_PREFIX + tplId);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  };

  const writeActiveStorage = (tplId, data) => {
    try {
      localStorage.setItem(BT_SF_ACTIVE_PREFIX + tplId, JSON.stringify(data || {}));
    } catch (_) {}
  };

  const readNamedDrafts = () => {
    try {
      const raw = localStorage.getItem(BT_SF_DRAFTS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  };

  const writeNamedDrafts = (arr) => {
    try {
      localStorage.setItem(BT_SF_DRAFTS_KEY, JSON.stringify((arr || []).slice(0, 30)));
    } catch (_) {}
  };

  const getCurrentProfile = () => {
    const fromStorage = getAutofillProfile();
    const fromForm = typeof readFormProfileFn === "function" ? readFormProfileFn() : {};
    return {
      name: fromForm.name || fromStorage.name || "",
      cum: fromForm.cum || fromStorage.cum || "",
      age: fromForm.age || fromStorage.age || "",
      section: fromForm.section || fromStorage.section || "Comunidad de Caminantes",
      group: fromForm.group || fromStorage.group || "",
      province: fromForm.province || fromStorage.province || "",
      blood: fromForm.blood || fromStorage.blood || "",
      emergency: fromForm.emergency || fromStorage.emergency || "",
      scouter: fromForm.scouter || fromStorage.scouter || ""
    };
  };

  const buildInitialValues = (tplId) => {
    const tpl = SMART_FORM_TEMPLATES[tplId] || SMART_FORM_TEMPLATES.salud;
    const saved = readActiveStorage(tpl.id) || {};
    const prof = getCurrentProfile();
    const out = {};
    for (const f of tpl.fields) {
      if (saved[f.key] !== undefined && String(saved[f.key]).trim() !== "") {
        out[f.key] = String(saved[f.key]);
      } else if (f.bind && prof[f.bind]) {
        out[f.key] = String(prof[f.bind]);
      } else if (f.defaultToday) {
        out[f.key] = todayStr();
      } else if (f.defaultValue) {
        out[f.key] = f.defaultValue;
      } else if (f.type === "select" && Array.isArray(f.options) && f.options.length) {
        out[f.key] = f.options[0];
      } else {
        out[f.key] = "";
      }
    }
    return out;
  };

  const renderSheetHtml = (tpl, vals, includeOfficialPages = true) => {
    let officialPagesHtml = "";
    if (includeOfficialPages && Array.isArray(tpl.officialPages) && tpl.officialPages.length) {
      const pagesInner = tpl.officialPages
        .map((pg, idx) => {
          const overlays = (pg.boxes || [])
            .map((b) => {
              const rawVal = String(vals[b.key] || "").trim();
              if (!rawVal) return "";
              const cls = `bt-sf-overlay-field${b.multiline ? " is-multi" : ""}${b.align === "center" ? " is-center" : ""}`;
              return `<div class="${cls}" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%;">${escapeHtml(rawVal).replace(/\n/g, "<br>")}</div>`;
            })
            .join("");
          return `
            <div class="bt-sf-official-page-wrap">
              <div class="bt-sf-official-page-badge">Archivo base oficial: ${escapeHtml(tpl.baseDocName || tpl.code)} · Página ${idx + 1} de ${tpl.officialPages.length}</div>
              <div class="bt-sf-official-page" style="aspect-ratio:${pg.aspect || "1347 / 1743"};">
                <img src="${escapeHtml(pg.src)}" alt="${escapeHtml(tpl.title)} página ${idx + 1}" class="bt-sf-official-bg" loading="eager" />
                <div class="bt-sf-official-overlays">${overlays}</div>
              </div>
            </div>`;
        })
        .join("");
      officialPagesHtml = `<div class="bt-sf-official-pages-stack">${pagesInner}</div>`;
    }

    const shortFields = tpl.fields.filter((f) => !f.full && f.type !== "textarea");
    const longFields = tpl.fields.filter((f) => f.full || f.type === "textarea");
    const metaRows = shortFields
      .map((f) => {
        const v = String(vals[f.key] || "").trim() || "___________________________";
        return `<div class="bt-sf-doc-cell"><span class="bt-sf-doc-k">${escapeHtml(f.label)}</span><strong class="bt-sf-doc-v">${escapeHtml(v)}</strong></div>`;
      })
      .join("");
    const longBlocks = longFields
      .map((f) => {
        const v = String(vals[f.key] || "").trim() || "(Espacio para completar)";
        return `<div class="bt-sf-doc-block"><div class="bt-sf-doc-block-title">${escapeHtml(f.label)}</div><div class="bt-sf-doc-block-body">${escapeHtml(v).replace(/\n/g, "<br>")}</div></div>`;
      })
      .join("");
    const sigs = (tpl.signatures || [])
      .map(
        (s) =>
          `<div class="bt-sf-doc-sig"><div class="bt-sf-doc-sig-line"></div><span>${escapeHtml(s)}</span></div>`
      )
      .join("");

    return `
      ${officialPagesHtml}
      <div class="bt-sf-structured-summary">
        <div class="bt-sf-doc-header">
          <div class="bt-sf-doc-brand">
            <span class="bt-sf-doc-code">${escapeHtml(tpl.code)}</span>
            <h4>${escapeHtml(tpl.title)}</h4>
            <p>${escapeHtml(tpl.subtitle)}</p>
          </div>
          <div class="bt-sf-doc-stamp">
            <strong>BiblioTech Scout</strong>
            <span>Base: ${escapeHtml(tpl.baseDocName || tpl.code)}</span>
            <span>${escapeHtml(todayStr())}</span>
          </div>
        </div>
        <div class="bt-sf-doc-meta-grid">${metaRows}</div>
        <div class="bt-sf-doc-blocks">${longBlocks}</div>
        <div class="bt-sf-doc-sigs">${sigs}</div>
      </div>
    `;
  };

  const updatePreviewSheet = () => {
    const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
    sheetEl.innerHTML = renderSheetHtml(tpl, currentValues);
  };

  const renderFields = () => {
    const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
    fieldsContainer.innerHTML = tpl.fields
      .map((f) => {
        const val = currentValues[f.key] || "";
        const wrapCls = f.full || f.type === "textarea" ? "bt-sf-field is-full" : "bt-sf-field";
        if (f.type === "select" && Array.isArray(f.options)) {
          const opts = f.options
            .map(
              (o) =>
                `<option value="${escapeHtml(o)}"${o === val ? " selected" : ""}>${escapeHtml(o)}</option>`
            )
            .join("");
          return `<label class="${wrapCls}"><span>${escapeHtml(f.label)}</span><select data-sf-field="${escapeHtml(f.key)}">${opts}</select></label>`;
        }
        if (f.type === "textarea") {
          return `<label class="${wrapCls}"><span>${escapeHtml(f.label)}</span><textarea rows="3" data-sf-field="${escapeHtml(f.key)}" placeholder="${escapeHtml(f.placeholder || "")}">${escapeHtml(val)}</textarea></label>`;
        }
        return `<label class="${wrapCls}"><span>${escapeHtml(f.label)}</span><input type="text" data-sf-field="${escapeHtml(f.key)}" value="${escapeHtml(val)}" placeholder="${escapeHtml(f.placeholder || "")}" /></label>`;
      })
      .join("");
  };

  const renderNamedDrafts = () => {
    if (!draftsWrap || !draftsList) return;
    const list = readNamedDrafts();
    if (!list.length) {
      draftsWrap.classList.add("hidden");
      draftsList.innerHTML = "";
      return;
    }
    draftsWrap.classList.remove("hidden");
    draftsList.innerHTML = list
      .map(
        (d) => `
        <div class="bt-sf-draft-chip">
          <button type="button" class="bt-sf-draft-load" data-load-draft="${escapeHtml(d.id)}">
            <strong>${escapeHtml(d.label)}</strong>
            <span>${escapeHtml(d.date || "")}</span>
          </button>
          <button type="button" class="bt-sf-draft-del" data-del-draft="${escapeHtml(d.id)}" aria-label="Eliminar borrador" title="Eliminar borrador">×</button>
        </div>`
      )
      .join("");
  };

  const loadTemplate = (tplId, scrollWorkspace = false) => {
    const tpl = SMART_FORM_TEMPLATES[tplId] ? SMART_FORM_TEMPLATES[tplId] : SMART_FORM_TEMPLATES.salud;
    currentTemplateId = tpl.id;
    selectEl.value = tpl.id;
    document.querySelectorAll("#smartFormTemplateCards [data-template-card]").forEach((card) => {
      card.classList.toggle("is-active-template", card.getAttribute("data-template-card") === tpl.id);
    });
    currentValues = buildInitialValues(tpl.id);
    renderFields();
    updatePreviewSheet();
    if (statusEl) statusEl.textContent = "Borrador local listo";
    if (scrollWorkspace) {
      workspace.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const applyProfileToCurrent = (profOverride, notify = true) => {
    const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
    const prof = profOverride || getCurrentProfile();
    let count = 0;
    for (const f of tpl.fields) {
      if (f.bind && prof[f.bind]) {
        currentValues[f.key] = String(prof[f.bind]);
        count++;
      }
    }
    writeActiveStorage(currentTemplateId, currentValues);
    renderFields();
    updatePreviewSheet();
    if (statusEl) statusEl.textContent = "Autollenado aplicado desde tu Perfil Local";
    if (notify) {
      showWebToast(
        count
          ? `Se rellenaron ${count} campos automáticamente con tu Perfil Local.`
          : "Guarda tus datos abajo en «Mi Perfil Local» para autollenar en 1 clic."
      );
    }
  };

  window.__btSyncSmartFormFromProfile = (prof, notify) => {
    applyProfileToCurrent(prof, notify);
  };

  fieldsContainer.addEventListener("input", (e) => {
    const input = e.target.closest("[data-sf-field]");
    if (!input) return;
    const key = input.getAttribute("data-sf-field");
    currentValues[key] = input.value;
    writeActiveStorage(currentTemplateId, currentValues);
    updatePreviewSheet();
    if (statusEl) statusEl.textContent = "Guardado en este dispositivo";
  });

  selectEl.addEventListener("change", () => {
    loadTemplate(selectEl.value, false);
  });

  document.querySelectorAll("[data-open-template]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tplId = btn.getAttribute("data-open-template");
      loadTemplate(tplId, true);
    });
  });

  if (applyProfileBtn) {
    applyProfileBtn.addEventListener("click", () => applyProfileToCurrent(null, true));
  }

  if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", () => {
      const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
      const who = (currentValues.name || currentValues.eventName || currentValues.projectTitle || "Scout").trim();
      const drafts = readNamedDrafts();
      const entry = {
        id: `d_${Date.now().toString(36)}`,
        templateId: tpl.id,
        label: `${tpl.code} · ${who.slice(0, 32)}`,
        date: new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short" }),
        values: { ...currentValues }
      };
      drafts.unshift(entry);
      writeNamedDrafts(drafts);
      renderNamedDrafts();
      showWebToast("Borrador guardado en «Mis borradores guardados».");
    });
  }

  if (draftsList) {
    draftsList.addEventListener("click", (e) => {
      const loadBtn = e.target.closest("[data-load-draft]");
      if (loadBtn) {
        const id = loadBtn.getAttribute("data-load-draft");
        const found = readNamedDrafts().find((d) => d.id === id);
        if (found) {
          currentTemplateId = SMART_FORM_TEMPLATES[found.templateId] ? found.templateId : "salud";
          selectEl.value = currentTemplateId;
          currentValues = { ...(found.values || {}) };
          writeActiveStorage(currentTemplateId, currentValues);
          renderFields();
          updatePreviewSheet();
          showWebToast(`Borrador cargado: ${found.label}`);
        }
        return;
      }
      const delBtn = e.target.closest("[data-del-draft]");
      if (delBtn) {
        const id = delBtn.getAttribute("data-del-draft");
        const next = readNamedDrafts().filter((d) => d.id !== id);
        writeNamedDrafts(next);
        renderNamedDrafts();
        showWebToast("Borrador eliminado.");
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem(BT_SF_ACTIVE_PREFIX + currentTemplateId);
      } catch (_) {}
      currentValues = buildInitialValues(currentTemplateId);
      renderFields();
      updatePreviewSheet();
      showWebToast("Campos restablecidos con los datos base de tu perfil.");
    });
  }

  document.querySelectorAll("#sfMobileModeTabs [data-sf-mob-pane]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const pane = tab.getAttribute("data-sf-mob-pane") || "edit";
      if (splitLayout) splitLayout.setAttribute("data-sf-active-pane", pane);
      document.querySelectorAll("#sfMobileModeTabs [data-sf-mob-pane]").forEach((t) => {
        const act = t === tab;
        t.classList.toggle("active", act);
        t.setAttribute("aria-selected", act ? "true" : "false");
      });
    });
  });

  const buildStandaloneDocumentHtml = (forWord = false) => {
    const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
    return `<!DOCTYPE html>
<html lang="es" ${forWord ? 'xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"' : ""}>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(tpl.title)} - BiblioTech Scout</title>
<style>
  @page { size: letter; margin: 16mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 16px; font-size: 11pt; line-height: 1.45; }
  .bt-sf-doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4c1d95; padding-bottom: 10px; margin-bottom: 14px; }
  .bt-sf-doc-code { display: inline-block; background: #ede9fe; color: #4c1d95; font-weight: bold; font-size: 8.5pt; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; }
  .bt-sf-doc-brand h4 { margin: 6px 0 3px; font-size: 15pt; color: #0f172a; }
  .bt-sf-doc-brand p { margin: 0; font-size: 9.5pt; color: #475569; }
  .bt-sf-doc-stamp { text-align: right; font-size: 8.5pt; color: #475569; }
  .bt-sf-doc-stamp strong { display: block; color: #4c1d95; font-size: 10pt; }
  .bt-sf-doc-meta-grid { display: table; width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .bt-sf-doc-cell { display: inline-block; width: 47%; vertical-align: top; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 9px; margin: 0 1% 8px 0; box-sizing: border-box; }
  .bt-sf-doc-k { display: block; font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: bold; }
  .bt-sf-doc-v { display: block; font-size: 10.5pt; color: #0f172a; margin-top: 2px; }
  .bt-sf-doc-block { border: 1px solid #cbd5e1; border-radius: 6px; padding: 9px 11px; margin-bottom: 10px; page-break-inside: avoid; }
  .bt-sf-doc-block-title { font-size: 9pt; font-weight: bold; text-transform: uppercase; color: #4c1d95; margin-bottom: 5px; }
  .bt-sf-doc-block-body { font-size: 10.5pt; color: #0f172a; min-height: 28px; }
  .bt-sf-doc-sigs { display: flex; justify-content: space-between; gap: 18px; margin-top: 38px; page-break-inside: avoid; }
  .bt-sf-doc-sig { flex: 1; text-align: center; font-size: 9pt; color: #334155; }
  .bt-sf-doc-sig-line { border-bottom: 1px solid #0f172a; height: 28px; margin-bottom: 6px; }
</style>
</head>
<body>
${renderSheetHtml(tpl, currentValues, !forWord)}
</body>
</html>`;
  };

  if (printBtn) {
    printBtn.addEventListener("click", () => {
      document.body.classList.add("bt-printing-smart-form");
      const cleanup = () => document.body.classList.remove("bt-printing-smart-form");
      window.addEventListener("afterprint", cleanup, { once: true });
      try {
        window.print();
      } catch (_) {}
      setTimeout(cleanup, 1800);
    });
  }

  if (wordBtn) {
    wordBtn.addEventListener("click", () => {
      const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
      const htmlDoc = buildStandaloneDocumentHtml(true);
      const blob = new Blob(["\ufeff", htmlDoc], { type: "application/msword;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeWho = (currentValues.name || currentValues.eventName || currentValues.projectTitle || "Scout")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .slice(0, 28);
      a.href = url;
      a.download = `${tpl.code.replace(/\s+/g, "_")}_${safeWho || "BiblioTech"}.doc`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showWebToast("Formato descargado en Word (.doc) listo para editar o imprimir.");
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
      const lines = [`${tpl.title.toUpperCase()} (${tpl.code})`, "----------------------------------------"];
      for (const f of tpl.fields) {
        lines.push(`${f.label}: ${String(currentValues[f.key] || "—").trim()}`);
      }
      const txt = lines.join("\n");
      try {
        await navigator.clipboard.writeText(txt);
        showWebToast("Texto del formato copiado al portapapeles.");
      } catch (_) {
        showWebToast("No se pudo copiar automáticamente en este navegador.");
      }
    });
  }

  const pngBtn = document.getElementById("btnSfDownloadOfficialPng");
  const openBaseBtn = document.getElementById("btnSfOpenBaseDoc");

  if (openBaseBtn) {
    openBaseBtn.addEventListener("click", () => {
      const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
      if (tpl.baseDocId && typeof openDocumentModal === "function") {
        openDocumentModal(tpl.baseDocId);
      }
    });
  }

  if (pngBtn) {
    pngBtn.addEventListener("click", async () => {
      const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
      const pages = Array.isArray(tpl.officialPages) ? tpl.officialPages : [];
      if (!pages.length) return;
      try {
        const loadedImgs = await Promise.all(
          pages.map(
            (pg) =>
              new Promise((resolve, reject) => {
                const im = new Image();
                im.onload = () => resolve({ im, pg });
                im.onerror = reject;
                im.src = pg.src;
              })
          )
        );
        const maxW = Math.max(...loadedImgs.map((x) => x.im.naturalWidth || 1347));
        const gap = loadedImgs.length > 1 ? 24 : 0;
        const totalH = loadedImgs.reduce((s, x) => s + (x.im.naturalHeight || 1743), 0) + gap * (loadedImgs.length - 1);
        const canvas = document.createElement("canvas");
        canvas.width = maxW;
        canvas.height = totalH;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, maxW, totalH);

        let offsetY = 0;
        for (const { im, pg } of loadedImgs) {
          const pw = im.naturalWidth || 1347;
          const ph = im.naturalHeight || 1743;
          ctx.drawImage(im, 0, offsetY, pw, ph);
          ctx.fillStyle = "#0f172a";
          for (const b of pg.boxes || []) {
            const val = String(currentValues[b.key] || "").trim();
            if (!val) continue;
            const bx = (b.x / 100) * pw;
            const by = offsetY + (b.y / 100) * ph;
            const bw = (b.w / 100) * pw;
            const bh = (b.h / 100) * ph;
            const fontPx = b.multiline ? Math.max(15, Math.round(pw * 0.0135)) : Math.max(16, Math.round(pw * 0.0145));
            ctx.font = `700 ${fontPx}px Arial, sans-serif`;
            ctx.textBaseline = "top";
            const rawLines = val.split(/\r?\n/);
            const wrapped = [];
            for (const rl of rawLines) {
              const words = rl.split(/\s+/);
              let line = "";
              for (const w of words) {
                const test = line ? `${line} ${w}` : w;
                if (ctx.measureText(test).width > bw - 8 && line) {
                  wrapped.push(line);
                  line = w;
                } else {
                  line = test;
                }
              }
              if (line) wrapped.push(line);
            }
            const maxLines = b.multiline ? Math.max(1, Math.floor(bh / (fontPx * 1.25))) : 1;
            for (let li = 0; li < Math.min(wrapped.length, maxLines); li++) {
              const txtLine = wrapped[li];
              let tx = bx + 4;
              if (b.align === "center") {
                tx = bx + Math.max(2, (bw - ctx.measureText(txtLine).width) / 2);
              }
              ctx.fillText(txtLine, tx, by + 2 + li * (fontPx * 1.25), bw - 6);
            }
          }
          offsetY += ph + gap;
        }

        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          const safeWho = (currentValues.name || currentValues.eventName || currentValues.projectTitle || "Scout")
            .replace(/[^a-zA-Z0-9_-]+/g, "_")
            .slice(0, 28);
          a.href = url;
          a.download = `${tpl.code.replace(/[^a-zA-Z0-9]+/g, "_")}_${safeWho || "Oficial"}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1500);
          showWebToast("Formato oficial descargado con tus datos puestos en cada casilla.");
        }, "image/png");
      } catch (err) {
        console.warn("[BiblioTech] Error generando PNG oficial:", err);
        showWebToast("Usa «Imprimir / Guardar PDF» para exportar el formato oficial.");
      }
    });
  }

  renderNamedDrafts();
  loadTemplate("salud", false);
}

// ============================================================================
// FORO COMUNITARIO: LA FOGATA (#foro)
// - Canales: Todos, Entre Jóvenes, Entre Scouters y Adultos, Mis Publicaciones
// - Datos reales obligatorios para registro interno de seguridad (con opción
//   pública 100 % Anónima o solo Sección/Grupo/Provincia)
// - Respeto y Ley Scout, banderita de reporte en posts/comentarios, Likes y
//   sincronización offline <-> Cloudflare Worker
// ============================================================================

const BT_FORUM_STATE_KEY = "bt_forum_state_v1";
const BT_FORUM_AUTHOR_KEY = "bt_forum_author_id_v1";
const BT_FORUM_IDENTITY_KEY = "bt_forum_identity_v1";
const BT_FORUM_OUTBOX_KEY = "bt_forum_outbox_v1";

function getForumIdentity() {
  const auto = getAutofillProfile();
  let saved = {};
  try {
    const raw = localStorage.getItem(BT_FORUM_IDENTITY_KEY);
    if (raw) saved = JSON.parse(raw) || {};
  } catch (_) {}
  return {
    realName: String(saved.realName || auto.name || "").trim(),
    role: String(saved.role || auto.section || "Comunidad de Caminantes").trim(),
    group: String(saved.group || auto.group || "").trim(),
    province: String(saved.province || auto.province || "").trim(),
    alias: String(saved.alias || "").trim(),
    visibility: saved.visibility || "full",
    cum: String(auto.cum || "").trim()
  };
}

function saveForumIdentity(nextId) {
  try {
    const prev = getForumIdentity();
    const merged = {
      realName: String(nextId.realName ?? prev.realName ?? "").trim(),
      role: String(nextId.role ?? prev.role ?? "Comunidad de Caminantes").trim(),
      group: String(nextId.group ?? prev.group ?? "").trim(),
      province: String(nextId.province ?? prev.province ?? "").trim(),
      alias: String(nextId.alias ?? prev.alias ?? "").trim(),
      visibility: nextId.visibility || prev.visibility || "full"
    };
    localStorage.setItem(BT_FORUM_IDENTITY_KEY, JSON.stringify(merged));
    return merged;
  } catch (_) {
    return nextId;
  }
}

const FORUM_PRESET_TAGS = [
  "#campamento",
  "#imprescindibles",
  "#proyectos-smart",
  "#supervision-adulta",
  "#ambientes-seguros",
  "#insignias-y-fes",
  "#meztitla",
  "#salud-y-permisos",
  "#foros-y-red",
  "#vida-de-seccion"
];

const STARTER_FORUM_POSTS = [
  {
    id: "seed-j-1",
    channel: "jovenes",
    role: "Tropa de Scouts",
    author: "Patrulla Halcones",
    province: "Grupo 53 · TLXH",
    authorId: "seed",
    title: "Checklist imprescindible para campamento en montaña o lluvias",
    body: "Lo que nunca nos falla en Patrulla:\n1) Todo dentro de bolsa estanca o bolsas dobles dentro de la mochila (ropa, calcetines extras y sleeping).\n2) Lámpara frontal con pilas extra + bolsa impermeable para la linterna.\n3) Plástico/hule aislante debajo del piso de la casa de campaña, bien metido por debajo para que no junte agua.\n4) Muda térmica seca exclusiva para dormir y gorro de lana aunque no parezca hacer frío de tarde.",
    tags: ["#campamento", "#imprescindibles", "#vida-de-seccion"],
    docRef: "FES_CC_SYB_GESTION DE RIESGOS EN AREAS NATURALES.pdf",
    likes: 42,
    createdAt: 1794600000000,
    comments: [
      {
        id: "seed-c-1",
        author: "Mateo R.",
        role: "Comunidad de Caminantes",
        authorId: "seed",
        body: "Sumaría llevar un par extra de agujetas y cinta gris (duct tape) enrollada en la cantimplora; salva bastones, carpas y suelas.",
        likes: 18,
        createdAt: 1794610000000
      },
      {
        id: "seed-c-2",
        author: "Sofía L.",
        role: "Clan de Rovers",
        authorId: "seed",
        body: "¡Tip clave! Meter los tenis cerca de la entrada pero cubiertos en una bolsa, y nunca dormir con ropa húmeda aunque sea poco.",
        likes: 9,
        createdAt: 1794620000000
      }
    ]
  },
  {
    id: "seed-j-2",
    channel: "jovenes",
    role: "Comunidad de Caminantes",
    author: "Red TLXH Caminantes",
    province: "Provincia Tláhuac-Xochimilco",
    authorId: "seed",
    title: "Cómo armar tu proyecto SMART y registrarlo en Agentes de Cambio.MX sin trabarte",
    body: "Muchos compañeros se detienen en la Cédula porque quieren abarcar todo el mundo. Mejor define:\n- 1 problema real en tu escuela o colonia.\n- Meta medible (ej. recolectar 60 kg de tapitas o dar 4 talleres).\n- Revisa a qué Eje Temático pertenece (Salud, Habilidades, Sustentabilidad o Paz) y toma fotos y listas desde el día 1 para la bitácora y tu insignia Mundial o Jade/Obsidiana.",
    tags: ["#proyectos-smart", "#insignias-y-fes", "#foros-y-red"],
    docRef: "Catalogo_Plantillas_RECME_2026.html",
    likes: 35,
    createdAt: 1794580000000,
    comments: [
      {
        id: "seed-c-3",
        author: "Valeria M.",
        role: "Comunidad de Caminantes",
        authorId: "seed",
        body: "En BiblioTech puedes buscar los formatos P1 a P10 de RECME para no batallar con qué apartado va primero.",
        likes: 14,
        createdAt: 1794585000000
      }
    ]
  },
  {
    id: "seed-j-3",
    channel: "jovenes",
    role: "Comunidad de Caminantes",
    author: "Diego P.",
    province: "Provincia Sur CDMX",
    authorId: "seed",
    title: "Consejos si vas por primera vez al Campo Escuela Meztitla",
    body: "Aunque en Tepoztlán hace calor a mediodía, en las madrugadas baja bastante la temperatura en Meztitla. Lleva:\n- Calzado con buena suela para piedra volcánica.\n- Cantimplora de al menos 1 litro (en subidas y rallies se agradece muchísimo).\n- Bloqueador y repelente biodegradables para cuidar las áreas verdes del campo.",
    tags: ["#meztitla", "#campamento", "#imprescindibles"],
    docRef: "Carta de Meztitla.pdf",
    likes: 29,
    createdAt: 1794560000000,
    comments: [
      {
        id: "seed-c-4",
        author: "Camila T.",
        role: "Tropa de Scouts",
        authorId: "seed",
        body: "Confirmo lo del frío en la madrugada y llevar chamarra ligera impermeable por si chispea.",
        likes: 7,
        createdAt: 1794566000000
      }
    ]
  },
  {
    id: "seed-j-4",
    channel: "jovenes",
    role: "Clan de Rovers",
    author: "Área de Programa Juvenil",
    province: "Grupo 12",
    authorId: "seed",
    title: "Tips para terminar tu primera Especialidad FES sin dejarla a medias en ExplorApp",
    body: "Lee completa la ficha FES en la Biblioteca antes de empezar, acuerda con tu Scouter y Sinodal la evidencia exacta de cada reto (fotos, cuaderno o producto terminado) y fija una fecha realista de entrega. Empezar por una especialidad que ya te apasione multiplica tus ganas de seguir.",
    tags: ["#insignias-y-fes", "#vida-de-seccion"],
    docRef: "Catalogo_Especialidades_FES_Comunidad_y_Manada.html",
    likes: 24,
    createdAt: 1794540000000,
    comments: []
  },
  {
    id: "seed-a-1",
    channel: "adultos",
    role: "Scouter / Dirigente",
    author: "Jefatura de Tropa",
    province: "Consejo de Grupo",
    authorId: "seed",
    title: "Reglas de oro de supervisión segura (A Salvo del Peligro) en campamentos",
    body: "Recordatorio práctico entre Scouters y dirigentes:\n1) Mantener siempre la regla de dos adultos responsables visibles en actividades y traslados.\n2) Zonas de pernocta claramente separadas por edades/sección y sin improvisar cambios de carpa.\n3) Guardias nocturnas rotativas con linterna y protocolo claro de canal CONECTA ante cualquier incidente.\n4) Comunicación transparente con madres y padres con horario de reportes antes de salir.",
    tags: ["#ambientes-seguros", "#supervision-adulta", "#campamento"],
    docRef: "01 Política Nacional A Salvo del Peligro.pdf",
    likes: 51,
    createdAt: 1794625000000,
    comments: [
      {
        id: "seed-c-5",
        author: "Scouter Alejandro V.",
        role: "Scouter / Dirigente",
        authorId: "seed",
        body: "Excelente punto el #1. Además ayuda tener asignado un adulto específicamente como Responsable de Seguridad e Higiene durante todo el evento.",
        likes: 21,
        createdAt: 1794630000000
      },
      {
        id: "seed-c-6",
        author: "Comisionada de Grupo",
        role: "Asesor de Red / Grupo",
        authorId: "seed",
        body: "También revisar con anticipación que todos los adultos en el campo tengan vigente su certificación de A Salvo del Peligro.",
        likes: 15,
        createdAt: 1794635000000
      }
    ]
  },
  {
    id: "seed-a-2",
    channel: "adultos",
    role: "Asesor de Red / Grupo",
    author: "Asesoría Red de Caminantes",
    province: "Nacional / Provincia",
    authorId: "seed",
    title: "Cómo acompañar proyectos de Caminantes y Rovers sin quitarles el protagonismo",
    body: "La tentación más común como adultos es resolver la logística por ellos. Funciona mejor preguntar: ¿Qué recurso te falta?, ¿Cuál es tu plan B si llueve?, ¿A quién vas a rendir cuentas? Así conservan la propiedad del proyecto, aprenden de tropiezos seguros y fortalecen el Método Scout.",
    tags: ["#supervision-adulta", "#proyectos-smart", "#vida-de-seccion"],
    docRef: "010 Guia Red de Caminantes.pdf",
    likes: 38,
    createdAt: 1794590000000,
    comments: [
      {
        id: "seed-c-7",
        author: "Jefa de Comunidad",
        role: "Scouter / Dirigente",
        authorId: "seed",
        body: "Totalmente de acuerdo. Pasar de 'yo lo organizo' a 'qué necesitas para cotizarlo tú' cambia por completo su seguridad al liderar.",
        likes: 12,
        createdAt: 1794595000000
      }
    ]
  },
  {
    id: "seed-a-3",
    channel: "adultos",
    role: "Scouter / Dirigente",
    author: "Coordinación de Salud y Logística",
    province: "Grupo 28",
    authorId: "seed",
    title: "Orden práctico de Fichas Médicas y Permisos JL304 antes de abordar transporte",
    body: "Antes de subir al autobús:\n- Llevar un fólder rápido ordenado alfabéticamente por sección con Permisos JL304 firmados y Fichas de Salud.\n- Etiquetar medicamentos personales con nombre completo, dosis y horario dentro de bolsa sellada al cuidado del adulto responsable de salud.\n- Verificar altas vigentes en SISAS para cobertura de Seguro Scout.",
    tags: ["#salud-y-permisos", "#supervision-adulta", "#campamento"],
    docRef: "FICHA SALUD 2026 EDITABLE.pdf",
    likes: 33,
    createdAt: 1794550000000,
    comments: []
  },
  {
    id: "seed-a-4",
    channel: "adultos",
    role: "Padre / Madre / Tutor",
    author: "Comité de Padres",
    province: "Manada de Lobatos",
    authorId: "seed",
    title: "Guía para familias nuevas antes del primer acantonamiento de Manada",
    body: "Para papás y mamás primerizos:\n1) Marcar toda la ropa, plato, taza y sleeping con nombre y grupo.\n2) Empacar junto con tu lobato o lobezna para que sepa exactamente en qué bolsa guardó cada prenda.\n3) Transmitirle confianza y emoción; evitar mensajes que generen ansiedad la noche previa.",
    tags: ["#campamento", "#imprescindibles", "#vida-de-seccion"],
    docRef: "Guia de Scouter de Manada de Lobatos 2024.pdf",
    likes: 27,
    createdAt: 1794520000000,
    comments: []
  }
];

function setupScoutForum() {
  const grid = document.getElementById("forumPostsGrid");
  if (!grid) return;

  const channelTabs = document.getElementById("forumChannelTabs");
  const tagBar = document.getElementById("forumTagBar");
  const searchInput = document.getElementById("forumSearchInput");
  const sortSelect = document.getElementById("forumSortSelect");
  const countLabel = document.getElementById("forumCountLabel");
  const syncBadge = document.getElementById("forumSyncBadge");
  const resetBtn = document.getElementById("resetForumFiltersBtn");
  const openComposerBtn = document.getElementById("btnOpenForumComposer");

  // Modal compositor
  const composerModal = document.getElementById("forumComposerModal");
  const composerTitleEl = document.getElementById("forumComposerTitle");
  const closeComposerBtn = document.getElementById("closeForumComposerBtn");
  const cancelComposerBtn = document.getElementById("cancelForumComposerBtn");
  const postForm = document.getElementById("forumPostForm");
  const channelInput = document.getElementById("forumPostChannel");
  const realNameInput = document.getElementById("forumPostRealName");
  const roleInput = document.getElementById("forumPostRole");
  const groupInput = document.getElementById("forumPostGroup");
  const provinceInput = document.getElementById("forumPostProvince");
  const visibilityInput = document.getElementById("forumPostVisibility");
  const aliasInput = document.getElementById("forumPostAlias");
  const titleInput = document.getElementById("forumPostTitle");
  const bodyInput = document.getElementById("forumPostBody");
  const presetTagsWrap = document.getElementById("forumPresetTags");
  const customTagsInput = document.getElementById("forumCustomTags");
  const docRefInput = document.getElementById("forumPostDocRef");
  const composerStatusEl = document.getElementById("forumComposerStatus");
  const submitPostBtn = document.getElementById("submitForumPostBtn");

  const isLocalHostEnv = () => {
    const host = String((window.location && window.location.hostname) || "").toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1" || window.location.protocol === "file:";
  };

  const resolvePublicAuthorDisplay = ({ realName, alias, role, group, province, visibility }) => {
    const loc = [group, province].filter(Boolean).join(" · ");
    if (visibility === "anonymous") {
      return {
        displayAuthor: "Scout Anónimo",
        displaySub: "Comunidad Scout · Identidad protegida",
        initials: "SA"
      };
    }
    if (visibility === "group_only") {
      return {
        displayAuthor: "Scout Anónimo",
        displaySub: [role || "Miembro Scout", loc].filter(Boolean).join(" · "),
        initials: "SA"
      };
    }
    const pubName = (alias || realName || "Scout").trim();
    return {
      displayAuthor: pubName,
      displaySub: [role || "Miembro Scout", loc].filter(Boolean).join(" · "),
      initials: getInitials(pubName)
    };
  };

  const getOutbox = () => {
    try {
      const arr = JSON.parse(localStorage.getItem(BT_FORUM_OUTBOX_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  };

  const setOutbox = (arr) => {
    try {
      localStorage.setItem(BT_FORUM_OUTBOX_KEY, JSON.stringify((arr || []).slice(-60)));
    } catch (_) {}
  };

  const updateSyncBadge = (cloudOk = false) => {
    if (!syncBadge) return;
    const pending = getOutbox().length;
    const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
    syncBadge.classList.toggle("is-offline", isOffline);
    if (isOffline) {
      syncBadge.textContent = pending
        ? `Sin internet · ${pending} cambio(s) en cola local`
        : "Modo offline · Guardado en este dispositivo";
    } else if (pending) {
      syncBadge.textContent = `Respaldando ${pending} cambio(s) en comunidad...`;
    } else if (cloudOk) {
      syncBadge.textContent = "Conectado · Guardado local + nube comunitaria";
    } else {
      syncBadge.textContent = "Guardado en tu dispositivo + respaldo comunitario";
    }
  };

  const flushForumOutbox = async () => {
    const queue = getOutbox();
    if (!queue.length) {
      updateSyncBadge(false);
      return;
    }
    if (isLocalHostEnv() || (typeof navigator !== "undefined" && navigator.onLine === false)) {
      updateSyncBadge(false);
      return;
    }

    const workerEp = (BT_TELEMETRY_CONFIG.workerEndpoint || "").trim();
    const emailEp = `https://formsubmit.co/ajax/${encodeURIComponent(STATE.contactEmail || "rdc.tlxh@gmail.com")}`;
    const remaining = [];

    for (const item of queue) {
      const sendEmail = item.actionType !== "foro_like";
      const targets = workerEp ? (sendEmail ? [workerEp, emailEp] : [workerEp]) : sendEmail ? [emailEp] : [];
      if (!targets.length) continue;
      try {
        const res = await Promise.allSettled(
          targets.map((ep) =>
            fetch(ep, {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify(item.payload)
            })
          )
        );
        const ok = res.some((r) => r.status === "fulfilled" && r.value && r.value.ok);
        if (!ok) remaining.push(item);
      } catch (_) {
        remaining.push(item);
      }
    }
    setOutbox(remaining);
    updateSyncBadge(remaining.length === 0);
  };

  const sendForumSecurityRecord = (actionType, securityInfo, summaryText, publicData) => {
    const ctx = detectClientContext();
    const payload = {
      _subject: `[LA FOGATA · ${actionType.toUpperCase()}] ${publicData.title || publicData.postId || "Actividad"}`,
      _template: "table",
      _captcha: "false",
      canal_foro: "La Fogata",
      actionType,
      plataforma: `${ctx.plat} · ${ctx.vista}`,
      navegador_y_tema: `${ctx.browser} (${ctx.os}) · Tema ${ctx.tema}`,
      resumen_mas_usado: summaryText,
      // Registro privado completo para moderación / seguridad
      securityRecord: {
        realName: securityInfo.realName || "",
        role: securityInfo.role || "",
        group: securityInfo.group || "",
        province: securityInfo.province || "",
        cum: securityInfo.cum || "",
        visibility: securityInfo.visibility || "full",
        authorId: LOCAL_AUTHOR_ID
      },
      // Objeto público (el Worker nunca expone securityRecord en GET ?channel=forum)
      publicPost: publicData.publicPost || null,
      publicComment: publicData.publicComment || null,
      likeDelta: publicData.likeDelta || null,
      deleteTarget: publicData.deleteTarget || null,
      actividad_completa: [
        `EVENTO EN LA FOGATA: ${actionType}`,
        `--- REGISTRO DE SEGURIDAD INTERNO (PRIVADO SI ELIGIÓ ANÓNIMO) ---`,
        `Nombre real: ${securityInfo.realName || "No proporcionado"}`,
        `Sección / Rol: ${securityInfo.role || "No proporcionado"}`,
        `Grupo: ${securityInfo.group || "No proporcionado"}`,
        `Provincia: ${securityInfo.province || "No proporcionado"}`,
        securityInfo.cum ? `CUM guardado: ${securityInfo.cum}` : "",
        `Visibilidad pública elegida: ${securityInfo.visibility || "full"}`,
        `Author ID local: ${LOCAL_AUTHOR_ID}`,
        `--- CONTENIDO ---`,
        summaryText
      ]
        .filter(Boolean)
        .join("\n")
    };

    const q = getOutbox();
    q.push({ actionType, payload, queuedAt: Date.now() });
    setOutbox(q);
    updateSyncBadge(false);
    flushForumOutbox();
  };

  const mergeCloudForumPosts = (remotePosts) => {
    if (!Array.isArray(remotePosts) || !remotePosts.length) return;
    const byId = new Map(forumState.posts.map((p) => [p.id, p]));
    let changed = false;

    for (const rp of remotePosts) {
      if (!rp || !rp.id) continue;
      const existing = byId.get(rp.id);
      if (!existing) {
        if (!rp.title || !rp.body || rp.isSeedDelta) continue;
        byId.set(rp.id, rp);
        changed = true;
      } else {
        // Actualizar likes si el remoto tiene mayor o si hay comentarios nuevos
        if ((rp.likes || 0) > (existing.likes || 0)) {
          existing.likes = rp.likes;
          changed = true;
        }
        const existingCids = new Set((existing.comments || []).map((c) => c.id));
        for (const rc of rp.comments || []) {
          if (rc && rc.id && !existingCids.has(rc.id)) {
            if (!Array.isArray(existing.comments)) existing.comments = [];
            existing.comments.push(rc);
            existingCids.add(rc.id);
            changed = true;
          }
        }
      }
    }

    if (changed) {
      forumState.posts = Array.from(byId.values());
      persistForumState();
      renderForum();
    }
  };

  const syncForumWithCloud = async () => {
    if (isLocalHostEnv() || (typeof navigator !== "undefined" && navigator.onLine === false)) {
      updateSyncBadge(false);
      return;
    }
    const workerEp = (BT_TELEMETRY_CONFIG.workerEndpoint || "").trim();
    if (!workerEp) return;
    try {
      const url = `${workerEp}${workerEp.includes("?") ? "&" : "?"}channel=forum`;
      const res = await btFetchWithTimeout(url, { method: "GET", headers: { Accept: "application/json" } }, 7500);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.ok) {
          if (Array.isArray(data.deletedIds) && data.deletedIds.length) {
            const delSet = new Set(data.deletedIds);
            const before = forumState.posts.length;
            forumState.posts = forumState.posts.filter((p) => !delSet.has(p.id));
            if (forumState.posts.length !== before) {
              persistForumState();
              renderForum();
            }
          }
          if (Array.isArray(data.posts)) {
            mergeCloudForumPosts(data.posts);
          }
        }
        updateSyncBadge(true);
      } else {
        updateSyncBadge(false);
      }
    } catch (err) {
      console.warn("[BiblioTech] La Fogata en modo respaldo local:", err && err.message ? err.message : err);
      updateSyncBadge(false);
    }
  };

  const getLocalAuthorId = () => {
    try {
      let id = localStorage.getItem(BT_FORUM_AUTHOR_KEY);
      if (!id) {
        id = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        localStorage.setItem(BT_FORUM_AUTHOR_KEY, id);
      }
      return id;
    } catch (_) {
      return "u_local";
    }
  };
  const LOCAL_AUTHOR_ID = getLocalAuthorId();

  const cloneSeeds = () => JSON.parse(JSON.stringify(STARTER_FORUM_POSTS));

  const loadForumState = () => {
    try {
      const raw = localStorage.getItem(BT_FORUM_STATE_KEY);
      if (!raw) {
        const fresh = { posts: cloneSeeds(), likedPostIds: [], likedCommentIds: [], savedPostIds: [] };
        localStorage.setItem(BT_FORUM_STATE_KEY, JSON.stringify(fresh));
        return fresh;
      }
      const parsed = JSON.parse(raw);
      const posts = Array.isArray(parsed.posts) ? parsed.posts : cloneSeeds();
      const existingIds = new Set(posts.map((p) => p.id));
      for (const seed of STARTER_FORUM_POSTS) {
        if (!existingIds.has(seed.id)) {
          posts.push(JSON.parse(JSON.stringify(seed)));
        }
      }
      return {
        posts,
        likedPostIds: Array.isArray(parsed.likedPostIds) ? parsed.likedPostIds : [],
        likedCommentIds: Array.isArray(parsed.likedCommentIds) ? parsed.likedCommentIds : [],
        savedPostIds: Array.isArray(parsed.savedPostIds) ? parsed.savedPostIds : []
      };
    } catch (_) {
      return { posts: cloneSeeds(), likedPostIds: [], likedCommentIds: [], savedPostIds: [] };
    }
  };

  let forumState = loadForumState();
  const persistForumState = () => {
    try {
      localStorage.setItem(BT_FORUM_STATE_KEY, JSON.stringify(forumState));
    } catch (_) {}
  };

  const viewState = {
    channel: "all",
    tag: "all",
    query: "",
    sort: "likes"
  };
  const expandedPosts = new Set();
  let editingCommentKey = null; // "postId::commentId"

  const validateScoutSafeText = (txt) => {
    const raw = String(txt || "");
    if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(raw)) {
      return { ok: false, reason: "Por seguridad (A Salvo del Peligro), evita publicar correos personales en el foro." };
    }
    if (/(?:\+?52\s*)?(?:\d[\s.-]*){10,}/.test(raw)) {
      return { ok: false, reason: "Por seguridad, evita compartir números telefónicos privados en publicaciones públicas." };
    }
    const slurRe = /\b(pendej[oa]s?|put[oa]s?|chingad[oa]s?|verga|estupid[oa]s?|idiota|imbecil|culer[oa]s?|mierda)\b/i;
    if (slurRe.test(normalizeStr(raw))) {
      return { ok: false, reason: "Mantengamos el respeto de la Ley Scout: evita lenguaje ofensivo." };
    }
    return { ok: true };
  };

  const normalizeForumTag = (raw) => {
    const clean = normalizeStr(String(raw || "").trim().replace(/^#+/, ""))
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 28);
    return clean ? `#${clean}` : "";
  };

  const parsePostTags = (presetArr, customStr) => {
    const set = new Set();
    for (const t of presetArr || []) {
      const nt = normalizeForumTag(t);
      if (nt) set.add(nt);
    }
    for (const part of String(customStr || "").split(/[\s,;]+/)) {
      const nt = normalizeForumTag(part);
      if (nt) set.add(nt);
    }
    if (!set.size) set.add("#campamento");
    return Array.from(set).slice(0, 6);
  };

  const formatForumDate = (ts) => {
    try {
      return new Date(ts).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
    } catch (_) {
      return "Reciente";
    }
  };

  const getInitials = (name) => {
    const parts = String(name || "SC").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "SC";
    return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  const findBestForumDocMatch = (docRef) => {
    const q = String(docRef || "").trim();
    if (!q || !STATE.documents || !STATE.documents.length) return null;
    const direct = typeof findDocByFilename === "function" ? findDocByFilename(q) : null;
    if (direct && STATE.documents.some((d) => d.id === direct.id)) return direct;
    const normQ = normalizeStr(q);
    return (
      STATE.documents.find((d) => normalizeStr(d.title).includes(normQ) || normalizeStr(d.filename).includes(normQ)) ||
      null
    );
  };

  const updateChannelCounts = () => {
    const allCount = forumState.posts.length;
    const jovenesCount = forumState.posts.filter((p) => p.channel === "jovenes").length;
    const adultosCount = forumState.posts.filter((p) => p.channel === "adultos").length;
    const miosCount = forumState.posts.filter(
      (p) => p.authorId === LOCAL_AUTHOR_ID || forumState.savedPostIds.includes(p.id)
    ).length;

    const map = { all: allCount, jovenes: jovenesCount, adultos: adultosCount, mios: miosCount };
    Object.keys(map).forEach((k) => {
      const el = document.querySelector(`[data-count-channel="${k}"]`);
      if (el) el.textContent = String(map[k]);
    });
  };

  const renderTagBar = () => {
    if (!tagBar) return;
    const counts = new Map();
    for (const preset of FORUM_PRESET_TAGS) counts.set(preset, 0);
    for (const post of forumState.posts) {
      if (viewState.channel === "jovenes" && post.channel !== "jovenes") continue;
      if (viewState.channel === "adultos" && post.channel !== "adultos") continue;
      if (
        viewState.channel === "mios" &&
        post.authorId !== LOCAL_AUTHOR_ID &&
        !forumState.savedPostIds.includes(post.id)
      ) {
        continue;
      }
      for (const tg of post.tags || []) {
        counts.set(tg, (counts.get(tg) || 0) + 1);
      }
    }

    const sortedTags = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const allTotal = sortedTags.reduce((acc, [, c]) => acc + c, 0);
    let html = `<button type="button" class="forum-tag-pill${viewState.tag === "all" ? " active" : ""}" data-forum-tag="all">Todos los temas</button>`;
    for (const [tg, cnt] of sortedTags) {
      if (cnt === 0 && !FORUM_PRESET_TAGS.includes(tg) && viewState.tag !== tg) continue;
      html += `<button type="button" class="forum-tag-pill${viewState.tag === tg ? " active" : ""}" data-forum-tag="${escapeHtml(tg)}">${escapeHtml(tg)} <span class="forum-tag-pill-count">${cnt}</span></button>`;
    }
    if (!allTotal && viewState.tag !== "all") {
      html += `<button type="button" class="forum-tag-pill active" data-forum-tag="${escapeHtml(viewState.tag)}">${escapeHtml(viewState.tag)}</button>`;
    }
    tagBar.innerHTML = html;
  };

  const getFilteredPosts = () => {
    const qNorm = normalizeStr(viewState.query.trim());
    const list = forumState.posts.filter((p) => {
      if (viewState.channel === "jovenes" && p.channel !== "jovenes") return false;
      if (viewState.channel === "adultos" && p.channel !== "adultos") return false;
      if (
        viewState.channel === "mios" &&
        p.authorId !== LOCAL_AUTHOR_ID &&
        !forumState.savedPostIds.includes(p.id)
      ) {
        return false;
      }
      if (viewState.tag !== "all" && !(p.tags || []).includes(viewState.tag)) return false;
      if (qNorm) {
        const hay = normalizeStr(
          `${p.title} ${p.body} ${p.author} ${p.displaySub || ""} ${p.role} ${p.group || ""} ${p.province} ${(p.tags || []).join(" ")} ${p.docRef || ""}`
        );
        if (!hay.includes(qNorm)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (viewState.sort === "recent") return (b.createdAt || 0) - (a.createdAt || 0);
      if (viewState.sort === "comments") return (b.comments || []).length - (a.comments || []).length;
      const likeDiff = (b.likes || 0) - (a.likes || 0);
      return likeDiff !== 0 ? likeDiff : (b.createdAt || 0) - (a.createdAt || 0);
    });
    return list;
  };

  const ROLE_OPTIONS = [
    "Manada de Lobatos",
    "Tropa de Scouts",
    "Comunidad de Caminantes",
    "Clan de Rovers",
    "Scouter / Dirigente",
    "Asesor de Red / Grupo",
    "Padre / Madre / Tutor"
  ];

  const renderForum = () => {
    updateChannelCounts();
    renderTagBar();
    const posts = getFilteredPosts();
    const savedId = getForumIdentity();

    if (countLabel) {
      countLabel.textContent =
        posts.length === 1
          ? "Mostrando 1 publicación en La Fogata"
          : `Mostrando ${posts.length} publicaciones en La Fogata`;
    }
    if (resetBtn) {
      const hasFilters = viewState.channel !== "all" || viewState.tag !== "all" || Boolean(viewState.query.trim());
      resetBtn.classList.toggle("hidden", !hasFilters);
    }

    if (!posts.length) {
      grid.innerHTML = `
        <div class="forum-empty-state">
          <p><strong>No hay publicaciones que coincidan con ese filtro.</strong></p>
          <p>Limpia los filtros o anima La Fogata abriendo el primer consejo sobre este tema.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = posts
      .map((post) => {
        const isAdult = post.channel === "adultos";
        const isOwn = post.authorId === LOCAL_AUTHOR_ID;
        const isLiked = forumState.likedPostIds.includes(post.id);
        const isSaved = forumState.savedPostIds.includes(post.id);
        const isExpanded = expandedPosts.has(post.id);
        const comments = Array.isArray(post.comments) ? post.comments : [];
        const maxCommentLikes = comments.reduce((mx, c) => Math.max(mx, c.likes || 0), 0);
        const postSub =
          post.displaySub ||
          [post.role, post.group, post.province].filter(Boolean).join(" · ");

        const roleSelectOpts = ROLE_OPTIONS.map(
          (r) => `<option value="${escapeHtml(r)}"${savedId.role === r ? " selected" : ""}>${escapeHtml(r)}</option>`
        ).join("");

        const commentsHtml = isExpanded
          ? `
            <div class="forum-comments-drawer" data-comments-drawer="${escapeHtml(post.id)}">
              <div class="forum-comments-list">
                ${
                  comments.length
                    ? comments
                        .map((c) => {
                          const isOwnComment = c.authorId === LOCAL_AUTHOR_ID;
                          const isCommentLiked = forumState.likedCommentIds.includes(c.id);
                          const isBest = maxCommentLikes > 0 && (c.likes || 0) === maxCommentLikes;
                          const isEditingThis = editingCommentKey === `${post.id}::${c.id}`;
                          const cSub = c.displaySub || [c.role, c.group, c.province].filter(Boolean).join(" · ") || "Miembro Scout";
                          return `
                            <div class="forum-comment-item${isBest ? " forum-best-comment" : ""}" data-comment-id="${escapeHtml(c.id)}">
                              <div class="forum-comment-head">
                                <span>
                                  <strong>${escapeHtml(c.author)}</strong>
                                  <span style="opacity:0.78"> · ${escapeHtml(cSub)}</span>
                                  ${c.editedAt ? ' <span class="forum-edited-pill">Editado</span>' : ""}
                                </span>
                                ${isBest ? '<span class="forum-best-badge">Respuesta más útil</span>' : ""}
                              </div>
                              ${
                                isEditingThis
                                  ? `
                                    <form class="forum-comment-form forum-comment-inline-edit" data-save-comment-edit="${escapeHtml(post.id)}::${escapeHtml(c.id)}">
                                      <input type="text" class="forum-comment-input" maxlength="500" value="${escapeHtml(c.body)}" required aria-label="Editar comentario" />
                                      <div style="display:flex;gap:0.35rem;">
                                        <button type="submit" class="forum-comment-submit">Guardar</button>
                                        <button type="button" class="forum-action-btn" data-cancel-comment-edit="1">Cancelar</button>
                                      </div>
                                    </form>
                                  `
                                  : `<p class="forum-comment-body">${escapeHtml(c.body)}</p>`
                              }
                              <div class="forum-comment-actions">
                                <button type="button" class="forum-like-btn${isCommentLiked ? " is-liked" : ""}" data-like-comment="${escapeHtml(post.id)}::${escapeHtml(c.id)}" aria-pressed="${String(isCommentLiked)}">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                                  <span>${c.likes || 0}</span>
                                </button>
                                ${
                                  isOwnComment && !isEditingThis
                                    ? `
                                      <button type="button" class="forum-action-btn" data-edit-comment="${escapeHtml(post.id)}::${escapeHtml(c.id)}">Editar</button>
                                      <button type="button" class="forum-action-btn is-danger" data-delete-comment="${escapeHtml(post.id)}::${escapeHtml(c.id)}">Borrar</button>
                                    `
                                    : ""
                                }
                                <button type="button" class="forum-flag-btn" data-report-comment="${escapeHtml(post.id)}::${escapeHtml(c.id)}" title="Reportar este comentario">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                                  <span>Reportar</span>
                                </button>
                              </div>
                            </div>
                          `;
                        })
                        .join("")
                    : `<p class="forum-comment-body" style="opacity:0.8">Aún no hay respuestas. Comparte la primera recomendación útil.</p>`
                }
              </div>
              <form class="forum-comment-form" data-add-comment-form="${escapeHtml(post.id)}" novalidate>
                <div class="forum-comment-identity-bar" style="grid-column:1/-1;">
                  <p class="forum-comment-identity-hint">Registro obligatorio por seguridad (elige abajo si sales con tu nombre o Anónimo):</p>
                  <input type="text" class="fc-real-name" maxlength="70" placeholder="Nombre completo real *" value="${escapeHtml(savedId.realName)}" required aria-label="Nombre completo real obligatorio para responder" />
                  <select class="fc-role" aria-label="Sección o rol">${roleSelectOpts}</select>
                  <input type="text" class="fc-group" maxlength="50" placeholder="Grupo Scout *" value="${escapeHtml(savedId.group)}" required aria-label="Grupo Scout obligatorio" />
                  <input type="text" class="fc-province" maxlength="60" placeholder="Provincia Scout *" value="${escapeHtml(savedId.province)}" required aria-label="Provincia Scout obligatoria" />
                  <select class="fc-visibility" style="grid-column:1/-1;" aria-label="Cómo mostrarte en el comentario">
                    <option value="full"${savedId.visibility === "full" ? " selected" : ""}>Mostrar mi nombre, sección, grupo y provincia</option>
                    <option value="group_only"${savedId.visibility === "group_only" ? " selected" : ""}>Anónimo, mostrando solo mi sección, grupo y provincia</option>
                    <option value="anonymous"${savedId.visibility === "anonymous" ? " selected" : ""}>100 % Anónimo (ocultar nombre, grupo y provincia)</option>
                  </select>
                </div>
                <input type="text" class="forum-comment-input" maxlength="500" placeholder="Escribe un consejo o respuesta con respeto..." aria-label="Escribir respuesta en La Fogata" required />
                <button type="submit" class="forum-comment-submit">Responder</button>
              </form>
            </div>
          `
          : "";

        return `
          <article class="forum-post-card${isAdult ? " is-adult" : ""}" data-post-id="${escapeHtml(post.id)}">
            <div class="forum-post-head">
              <div class="forum-author-meta">
                <span class="forum-author-avatar" aria-hidden="true">${escapeHtml(post.initials || getInitials(post.author))}</span>
                <div>
                  <span class="forum-author-name">${escapeHtml(post.author)}</span>
                  <span class="forum-author-sub">${escapeHtml(postSub)} · ${formatForumDate(post.createdAt)}</span>
                </div>
              </div>
              <div class="forum-badges-wrap">
                <span class="forum-channel-badge">${isAdult ? "Entre Scouters y Adultos" : "Entre Jóvenes"}</span>
                ${post.editedAt ? '<span class="forum-edited-pill">Editado</span>' : ""}
              </div>
            </div>

            <h3 class="forum-post-title">${escapeHtml(post.title)}</h3>
            <p class="forum-post-body">${escapeHtml(post.body)}</p>

            ${
              post.docRef
                ? `<button type="button" class="forum-doc-ref-btn" data-forum-doc="${escapeHtml(post.docRef)}">Ver recurso relacionado: ${escapeHtml(post.docRef)} →</button>`
                : ""
            }

            <div class="forum-post-tags">
              ${(post.tags || [])
                .map(
                  (tg) =>
                    `<button type="button" class="forum-tag-chip" data-forum-tag-jump="${escapeHtml(tg)}">${escapeHtml(tg)}</button>`
                )
                .join("")}
            </div>

            <div class="forum-actions-bar">
              <div class="forum-actions-left">
                <button type="button" class="forum-like-btn${isLiked ? " is-liked" : ""}" data-like-post="${escapeHtml(post.id)}" aria-pressed="${String(isLiked)}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                  <span>Útil (${post.likes || 0})</span>
                </button>
                <button type="button" class="forum-action-btn" data-toggle-comments="${escapeHtml(post.id)}" aria-expanded="${String(isExpanded)}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  <span>Respuestas (${comments.length})</span>
                </button>
                <button type="button" class="forum-action-btn${isSaved ? " is-saved" : ""}" data-save-post="${escapeHtml(post.id)}" aria-pressed="${String(isSaved)}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                  <span>${isSaved ? "Guardado" : "Guardar"}</span>
                </button>
              </div>
              <div class="forum-owner-actions">
                ${
                  isOwn
                    ? `
                      <button type="button" class="forum-action-btn" data-edit-post="${escapeHtml(post.id)}">Editar</button>
                      <button type="button" class="forum-action-btn is-danger" data-delete-post="${escapeHtml(post.id)}">Eliminar</button>
                    `
                    : ""
                }
                <button type="button" class="forum-flag-btn" data-report-post="${escapeHtml(post.id)}" title="Reportar publicación">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                  <span>Reportar</span>
                </button>
              </div>
            </div>
            ${commentsHtml}
          </article>
        `;
      })
      .join("");
  };

  const setComposerStatus = (msg, type = "") => {
    if (!composerStatusEl) return;
    composerStatusEl.textContent = msg;
    composerStatusEl.className = "bt-bug-status" + (type ? ` is-${type}` : "");
    composerStatusEl.classList.toggle("hidden", !msg);
    if (msg && typeof composerStatusEl.scrollIntoView === "function") {
      composerStatusEl.scrollIntoView({ block: "nearest" });
    }
  };

  const openComposer = (editPost = null) => {
    if (!composerModal || !postForm) return;
    postForm.reset();
    setComposerStatus("");
    const savedId = getForumIdentity();

    if (realNameInput) realNameInput.value = savedId.realName || "";
    if (roleInput && savedId.role) roleInput.value = savedId.role;
    if (groupInput) groupInput.value = savedId.group || "";
    if (provinceInput) provinceInput.value = savedId.province || "";
    if (visibilityInput) visibilityInput.value = savedId.visibility || "full";
    if (aliasInput) aliasInput.value = savedId.alias || "";

    if (editPost) {
      postForm.dataset.editId = editPost.id;
      if (composerTitleEl) composerTitleEl.textContent = "Editar publicación en La Fogata";
      if (submitPostBtn) submitPostBtn.textContent = "Guardar cambios";
      if (channelInput) channelInput.value = editPost.channel || "jovenes";
      if (roleInput && editPost.role) roleInput.value = editPost.role;
      if (visibilityInput && editPost.visibility) visibilityInput.value = editPost.visibility;
      if (groupInput && editPost.group) groupInput.value = editPost.group;
      if (provinceInput && editPost.province) provinceInput.value = editPost.province;
      if (aliasInput && editPost.visibility === "full" && editPost.author) {
        aliasInput.value = editPost.author === (savedId.realName || "") ? "" : editPost.author;
      }
      if (titleInput) titleInput.value = editPost.title || "";
      if (bodyInput) bodyInput.value = editPost.body || "";
      if (docRefInput) docRefInput.value = editPost.docRef || "";

      const postTags = editPost.tags || [];
      const customOnes = [];
      if (presetTagsWrap) {
        presetTagsWrap.querySelectorAll('input[type="checkbox"]').forEach((chk) => {
          chk.checked = postTags.includes(chk.value);
        });
      }
      for (const tg of postTags) {
        if (!FORUM_PRESET_TAGS.includes(tg)) customOnes.push(tg);
      }
      if (customTagsInput) customTagsInput.value = customOnes.join(" ");
    } else {
      delete postForm.dataset.editId;
      if (composerTitleEl) composerTitleEl.textContent = "Nueva recomendación en La Fogata";
      if (submitPostBtn) submitPostBtn.textContent = "Publicar en La Fogata";
      if (channelInput) {
        if (viewState.channel === "adultos") channelInput.value = "adultos";
        else if (savedId.role && (savedId.role.includes("Scouter") || savedId.role.includes("Padre") || savedId.role.includes("Asesor"))) {
          channelInput.value = "adultos";
        } else {
          channelInput.value = "jovenes";
        }
      }
    }

    composerModal.classList.remove("hidden");
    const firstEmpty =
      realNameInput && !realNameInput.value.trim()
        ? "#forumPostRealName"
        : groupInput && !groupInput.value.trim()
        ? "#forumPostGroup"
        : provinceInput && !provinceInput.value.trim()
        ? "#forumPostProvince"
        : "#forumPostTitle";
    activateDialogFocusTrap(composerModal, firstEmpty);
  };

  const closeComposer = () => {
    if (!composerModal) return;
    composerModal.classList.add("hidden");
    releaseDialogFocusTrap(composerModal);
  };

  if (openComposerBtn) openComposerBtn.addEventListener("click", () => openComposer(null));
  if (closeComposerBtn) closeComposerBtn.addEventListener("click", closeComposer);
  if (cancelComposerBtn) cancelComposerBtn.addEventListener("click", closeComposer);
  if (composerModal) {
    composerModal.addEventListener("click", (e) => {
      if (e.target === composerModal) closeComposer();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !composerModal.classList.contains("hidden")) closeComposer();
    });
  }

  if (postForm) {
    postForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const realName = (realNameInput ? realNameInput.value : "").trim();
      const role = roleInput ? roleInput.value : "Comunidad de Caminantes";
      const group = (groupInput ? groupInput.value : "").trim();
      const province = (provinceInput ? provinceInput.value : "").trim();
      const visibility = visibilityInput ? visibilityInput.value : "full";
      const alias = (aliasInput ? aliasInput.value : "").trim();
      const title = (titleInput ? titleInput.value : "").trim();
      const body = (bodyInput ? bodyInput.value : "").trim();
      const channel = channelInput ? channelInput.value : "jovenes";
      const docRef = (docRefInput ? docRefInput.value : "").trim();

      if (realName.length < 3) {
        setComposerStatus("Por seguridad, escribe tu nombre completo real (no aparecerá si eliges Anónimo).", "error");
        if (realNameInput) realNameInput.focus({ preventScroll: true });
        return;
      }
      if (group.length < 2) {
        setComposerStatus("Indica tu Grupo Scout (o escribe 'Independiente') para el registro de seguridad.", "error");
        if (groupInput) groupInput.focus({ preventScroll: true });
        return;
      }
      if (province.length < 2) {
        setComposerStatus("Indica tu Provincia Scout para el registro de seguridad.", "error");
        if (provinceInput) provinceInput.focus({ preventScroll: true });
        return;
      }
      if (title.length < 6) {
        setComposerStatus("Escribe un título más claro (al menos 6 caracteres).", "error");
        if (titleInput) titleInput.focus({ preventScroll: true });
        return;
      }
      if (body.length < 15) {
        setComposerStatus("Comparte un poco más de detalle en tu consejo o duda.", "error");
        if (bodyInput) bodyInput.focus({ preventScroll: true });
        return;
      }

      const safetyCheck = validateScoutSafeText(`${realName} ${alias} ${group} ${province} ${title} ${body}`);
      if (!safetyCheck.ok) {
        setComposerStatus(safetyCheck.reason, "error");
        return;
      }

      const savedIdentity = saveForumIdentity({ realName, role, group, province, alias, visibility });
      const pubMeta = resolvePublicAuthorDisplay({ realName, alias, role, group, province, visibility });

      const checkedTags = presetTagsWrap
        ? Array.from(presetTagsWrap.querySelectorAll('input[type="checkbox"]:checked')).map((c) => c.value)
        : [];
      const tags = parsePostTags(checkedTags, customTagsInput ? customTagsInput.value : "");
      const editId = postForm.dataset.editId;

      if (editId) {
        const targetPost = forumState.posts.find((p) => p.id === editId && p.authorId === LOCAL_AUTHOR_ID);
        if (targetPost) {
          targetPost.channel = channel;
          targetPost.visibility = visibility;
          targetPost.role = visibility === "anonymous" ? "Miembro Scout" : role;
          targetPost.group = visibility === "anonymous" ? "" : group;
          targetPost.province = visibility === "anonymous" ? "" : province;
          targetPost.author = pubMeta.displayAuthor;
          targetPost.displaySub = pubMeta.displaySub;
          targetPost.initials = pubMeta.initials;
          targetPost.title = title;
          targetPost.body = body;
          targetPost.tags = tags;
          targetPost.docRef = docRef;
          targetPost.editedAt = Date.now();
          persistForumState();
          closeComposer();
          renderForum();
          showWebToast("Publicación actualizada correctamente.");
          sendForumSecurityRecord("foro_edicion", savedIdentity, `${title}\n${body}`, {
            title,
            publicPost: targetPost
          });
        }
        return;
      }

      const newPost = {
        id: `fp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        channel,
        visibility,
        role: visibility === "anonymous" ? "Miembro Scout" : role,
        group: visibility === "anonymous" ? "" : group,
        province: visibility === "anonymous" ? "" : province,
        author: pubMeta.displayAuthor,
        displaySub: pubMeta.displaySub,
        initials: pubMeta.initials,
        authorId: LOCAL_AUTHOR_ID,
        title,
        body,
        tags,
        docRef,
        likes: 1,
        createdAt: Date.now(),
        comments: []
      };
      forumState.posts.unshift(newPost);
      if (!forumState.likedPostIds.includes(newPost.id)) forumState.likedPostIds.push(newPost.id);
      persistForumState();
      viewState.channel = "all";
      viewState.tag = "all";
      if (channelTabs) {
        channelTabs.querySelectorAll(".forum-channel-tab").forEach((t) => {
          const active = t.getAttribute("data-forum-channel") === "all";
          t.classList.toggle("active", active);
          t.setAttribute("aria-selected", String(active));
        });
      }
      closeComposer();
      renderForum();
      BiblioFeel.pulse([10, 28]);
      showWebToast("¡Tu recomendación se publicó en La Fogata!");
      sendForumSecurityRecord("foro_post", savedIdentity, `${title}\n${body}\nEtiquetas: ${tags.join(" ")}`, {
        title,
        publicPost: newPost
      });
    });
  }

  if (channelTabs) {
    channelTabs.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-forum-channel]");
      if (!btn) return;
      viewState.channel = btn.getAttribute("data-forum-channel") || "all";
      channelTabs.querySelectorAll(".forum-channel-tab").forEach((t) => {
        const active = t === btn;
        t.classList.toggle("active", active);
        t.setAttribute("aria-selected", String(active));
      });
      renderForum();
    });
  }

  if (tagBar) {
    tagBar.addEventListener("click", (e) => {
      const pill = e.target.closest("[data-forum-tag]");
      if (!pill) return;
      viewState.tag = pill.getAttribute("data-forum-tag") || "all";
      renderForum();
    });
  }

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      debounce(() => {
        viewState.query = searchInput.value;
        renderForum();
      }, 120)
    );
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      viewState.sort = sortSelect.value || "likes";
      renderForum();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      viewState.channel = "all";
      viewState.tag = "all";
      viewState.query = "";
      if (searchInput) searchInput.value = "";
      if (channelTabs) {
        channelTabs.querySelectorAll(".forum-channel-tab").forEach((t) => {
          const active = t.getAttribute("data-forum-channel") === "all";
          t.classList.toggle("active", active);
          t.setAttribute("aria-selected", String(active));
        });
      }
      renderForum();
    });
  }

  grid.addEventListener("click", (e) => {
    const tagJump = e.target.closest("[data-forum-tag-jump]");
    if (tagJump) {
      viewState.tag = tagJump.getAttribute("data-forum-tag-jump") || "all";
      renderForum();
      return;
    }

    const docBtn = e.target.closest("[data-forum-doc]");
    if (docBtn) {
      const ref = docBtn.getAttribute("data-forum-doc") || "";
      const matchedDoc = findBestForumDocMatch(ref);
      if (matchedDoc && typeof openDocumentModal === "function") {
        openDocumentModal(matchedDoc.id);
      } else {
        const askInput = document.getElementById("askInput");
        if (askInput) {
          submitQuestion(ref, { syncInput: true });
        }
      }
      return;
    }

    const likePostBtn = e.target.closest("[data-like-post]");
    if (likePostBtn) {
      const pid = likePostBtn.getAttribute("data-like-post");
      const post = forumState.posts.find((p) => p.id === pid);
      if (!post) return;
      const idx = forumState.likedPostIds.indexOf(pid);
      let delta = 1;
      if (idx >= 0) {
        forumState.likedPostIds.splice(idx, 1);
        post.likes = Math.max(0, (post.likes || 0) - 1);
        delta = -1;
      } else {
        forumState.likedPostIds.push(pid);
        post.likes = (post.likes || 0) + 1;
        BiblioFeel.pulse(10);
      }
      persistForumState();
      renderForum();
      sendForumSecurityRecord("foro_like", getForumIdentity(), `Like (${delta > 0 ? "+1" : "-1"}) en publicación: ${post.title}`, {
        postId: pid,
        title: post.title,
        likeDelta: { postId: pid, delta, currentLikes: post.likes }
      });
      return;
    }

    const savePostBtn = e.target.closest("[data-save-post]");
    if (savePostBtn) {
      const pid = savePostBtn.getAttribute("data-save-post");
      const idx = forumState.savedPostIds.indexOf(pid);
      if (idx >= 0) {
        forumState.savedPostIds.splice(idx, 1);
        showWebToast("Publicación quitada de tus guardados.");
      } else {
        forumState.savedPostIds.push(pid);
        showWebToast("Publicación guardada en Mis Publicaciones.");
      }
      persistForumState();
      renderForum();
      return;
    }

    const toggleCommentsBtn = e.target.closest("[data-toggle-comments]");
    if (toggleCommentsBtn) {
      const pid = toggleCommentsBtn.getAttribute("data-toggle-comments");
      if (expandedPosts.has(pid)) expandedPosts.delete(pid);
      else expandedPosts.add(pid);
      renderForum();
      return;
    }

    const editPostBtn = e.target.closest("[data-edit-post]");
    if (editPostBtn) {
      const pid = editPostBtn.getAttribute("data-edit-post");
      const post = forumState.posts.find((p) => p.id === pid && p.authorId === LOCAL_AUTHOR_ID);
      if (post) openComposer(post);
      return;
    }

    const delPostBtn = e.target.closest("[data-delete-post]");
    if (delPostBtn) {
      const pid = delPostBtn.getAttribute("data-delete-post");
      const targetPost = forumState.posts.find((p) => p.id === pid && p.authorId === LOCAL_AUTHOR_ID);
      forumState.posts = forumState.posts.filter((p) => !(p.id === pid && p.authorId === LOCAL_AUTHOR_ID));
      forumState.savedPostIds = forumState.savedPostIds.filter((id) => id !== pid);
      persistForumState();
      renderForum();
      showWebToast("Publicación eliminada.");
      if (targetPost) {
        sendForumSecurityRecord("foro_eliminar", getForumIdentity(), `Publicación eliminada: ${targetPost.title}`, {
          postId: pid,
          title: targetPost.title,
          deleteTarget: { postId: pid, authorId: LOCAL_AUTHOR_ID }
        });
      }
      return;
    }

    const reportBtn = e.target.closest("[data-report-post]");
    if (reportBtn) {
      const pid = reportBtn.getAttribute("data-report-post");
      const post = forumState.posts.find((p) => p.id === pid);
      if (typeof window.__btOpenBugReport === "function") {
        window.__btOpenBugReport("La Fogata", `[Publicación] ${(post && post.title) || pid}`, true);
      }
      return;
    }

    const reportCommentBtn = e.target.closest("[data-report-comment]");
    if (reportCommentBtn) {
      const [pid, cid] = (reportCommentBtn.getAttribute("data-report-comment") || "").split("::");
      const post = forumState.posts.find((p) => p.id === pid);
      const comment = post && (post.comments || []).find((c) => c.id === cid);
      const excerpt = (comment && comment.body ? comment.body.slice(0, 75) : cid);
      if (typeof window.__btOpenBugReport === "function") {
        window.__btOpenBugReport(
          "La Fogata",
          `[Comentario en "${(post && post.title) || pid}"] ${excerpt}`,
          true
        );
      }
      return;
    }

    const likeCommentBtn = e.target.closest("[data-like-comment]");
    if (likeCommentBtn) {
      const [pid, cid] = (likeCommentBtn.getAttribute("data-like-comment") || "").split("::");
      const post = forumState.posts.find((p) => p.id === pid);
      const comment = post && (post.comments || []).find((c) => c.id === cid);
      if (!comment) return;
      const key = cid;
      const idx = forumState.likedCommentIds.indexOf(key);
      let delta = 1;
      if (idx >= 0) {
        forumState.likedCommentIds.splice(idx, 1);
        comment.likes = Math.max(0, (comment.likes || 0) - 1);
        delta = -1;
      } else {
        forumState.likedCommentIds.push(key);
        comment.likes = (comment.likes || 0) + 1;
        BiblioFeel.pulse(8);
      }
      persistForumState();
      renderForum();
      sendForumSecurityRecord("foro_like", getForumIdentity(), `Like (${delta > 0 ? "+1" : "-1"}) en respuesta de ${post.title}`, {
        postId: pid,
        title: post.title,
        likeDelta: { postId: pid, commentId: cid, delta, currentLikes: comment.likes }
      });
      return;
    }

    const editCommentBtn = e.target.closest("[data-edit-comment]");
    if (editCommentBtn) {
      editingCommentKey = editCommentBtn.getAttribute("data-edit-comment");
      renderForum();
      return;
    }

    if (e.target.closest("[data-cancel-comment-edit]")) {
      editingCommentKey = null;
      renderForum();
      return;
    }

    const delCommentBtn = e.target.closest("[data-delete-comment]");
    if (delCommentBtn) {
      const [pid, cid] = (delCommentBtn.getAttribute("data-delete-comment") || "").split("::");
      const post = forumState.posts.find((p) => p.id === pid);
      if (post && Array.isArray(post.comments)) {
        const targetComment = post.comments.find((c) => c.id === cid && c.authorId === LOCAL_AUTHOR_ID);
        post.comments = post.comments.filter((c) => !(c.id === cid && c.authorId === LOCAL_AUTHOR_ID));
        persistForumState();
        renderForum();
        showWebToast("Comentario eliminado.");
        if (targetComment) {
          sendForumSecurityRecord("foro_eliminar", getForumIdentity(), `Comentario eliminado en ${post.title}`, {
            postId: pid,
            title: post.title,
            deleteTarget: { postId: pid, commentId: cid, authorId: LOCAL_AUTHOR_ID }
          });
        }
      }
    }
  });

  grid.addEventListener("submit", (e) => {
    const addForm = e.target.closest("[data-add-comment-form]");
    if (addForm) {
      e.preventDefault();
      const pid = addForm.getAttribute("data-add-comment-form");
      const nameEl = addForm.querySelector(".fc-real-name");
      const roleEl = addForm.querySelector(".fc-role");
      const groupEl = addForm.querySelector(".fc-group");
      const provEl = addForm.querySelector(".fc-province");
      const visEl = addForm.querySelector(".fc-visibility");
      const input = addForm.querySelector(".forum-comment-input");

      const realName = (nameEl ? nameEl.value : "").trim();
      const role = (roleEl ? roleEl.value : "Comunidad de Caminantes").trim();
      const group = (groupEl ? groupEl.value : "").trim();
      const province = (provEl ? provEl.value : "").trim();
      const visibility = (visEl ? visEl.value : "full").trim();
      const text = (input ? input.value : "").trim();

      if (realName.length < 3) {
        showWebToast("Por seguridad, escribe tu nombre completo real antes de responder.");
        if (nameEl) nameEl.focus();
        return;
      }
      if (group.length < 2) {
        showWebToast("Indica tu Grupo Scout antes de responder (es obligatorio para registro).");
        if (groupEl) groupEl.focus();
        return;
      }
      if (province.length < 2) {
        showWebToast("Indica tu Provincia Scout antes de responder (es obligatorio para registro).");
        if (provEl) provEl.focus();
        return;
      }
      if (text.length < 3) {
        showWebToast("Escribe una respuesta de al menos 3 caracteres.");
        if (input) input.focus();
        return;
      }

      const safety = validateScoutSafeText(`${realName} ${group} ${province} ${text}`);
      if (!safety.ok) {
        showWebToast(safety.reason);
        return;
      }

      const post = forumState.posts.find((p) => p.id === pid);
      if (!post) return;

      const savedIdentity = saveForumIdentity({ realName, role, group, province, visibility });
      const pubMeta = resolvePublicAuthorDisplay({ realName, alias: "", role, group, province, visibility });
      if (!Array.isArray(post.comments)) post.comments = [];

      const newComment = {
        id: `fc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        author: pubMeta.displayAuthor,
        displaySub: pubMeta.displaySub,
        visibility,
        role: visibility === "anonymous" ? "Miembro Scout" : role,
        group: visibility === "anonymous" ? "" : group,
        province: visibility === "anonymous" ? "" : province,
        authorId: LOCAL_AUTHOR_ID,
        body: text,
        likes: 0,
        createdAt: Date.now()
      };
      post.comments.push(newComment);
      expandedPosts.add(pid);
      persistForumState();
      renderForum();
      showWebToast("Respuesta publicada en La Fogata.");
      sendForumSecurityRecord("foro_comentario", savedIdentity, `En "${post.title}": ${text}`, {
        postId: pid,
        title: post.title,
        publicComment: { postId: pid, comment: newComment }
      });
      return;
    }

    const editForm = e.target.closest("[data-save-comment-edit]");
    if (editForm) {
      e.preventDefault();
      const [pid, cid] = (editForm.getAttribute("data-save-comment-edit") || "").split("::");
      const input = editForm.querySelector(".forum-comment-input");
      const text = (input ? input.value : "").trim();
      if (text.length < 3) return;
      const safety = validateScoutSafeText(text);
      if (!safety.ok) {
        showWebToast(safety.reason);
        return;
      }
      const post = forumState.posts.find((p) => p.id === pid);
      const comment = post && (post.comments || []).find((c) => c.id === cid && c.authorId === LOCAL_AUTHOR_ID);
      if (comment) {
        comment.body = text;
        comment.editedAt = Date.now();
        editingCommentKey = null;
        persistForumState();
        renderForum();
        showWebToast("Comentario actualizado.");
        sendForumSecurityRecord("foro_comentario_edicion", getForumIdentity(), `Comentario editado en "${post.title}": ${text}`, {
          postId: pid,
          title: post.title,
          publicComment: { postId: pid, comment }
        });
      }
    }
  });

  window.addEventListener("online", () => {
    updateSyncBadge(false);
    flushForumOutbox().then(() => syncForumWithCloud());
  });
  window.addEventListener("offline", () => updateSyncBadge(false));

  renderForum();
  updateSyncBadge(false);
  flushForumOutbox();
  syncForumWithCloud();
}

document.addEventListener("DOMContentLoaded", initApp);
