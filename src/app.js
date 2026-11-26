// ============================================================================
// BiblioTech — Aplicacion Principal (Sitio Web Publico)
// Creador: Liam Duran - Provincia TLXH
// ============================================================================

const IS_LOCAL_SERVER = false;

const GITHUB_RELEASE_BASE =
  "https://github.com/ey-liam/bibliotech-scouts/releases/download/v1.0/";
const PDF_STREAM_WORKER_BASE =
  "https://bibliotech-telemetry.liamchuchundra1.workers.dev";
const PDFJS_CDN_PRIMARY =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
const PDFJS_WORKER_PRIMARY =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
const PDFJS_CDN_FALLBACK =
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js";
const PDFJS_WORKER_FALLBACK =
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

let pdfJsLoadPromise = null;

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error(`No se pudo cargar ${src}`));
    };
    document.head.appendChild(script);
  });
}

function ensurePdfJsLoaded() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfJsLoadPromise) return pdfJsLoadPromise;
  pdfJsLoadPromise = loadScriptOnce(PDFJS_CDN_PRIMARY)
    .then(() => {
      if (!window.pdfjsLib) throw new Error("pdfjsLib no disponible");
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_PRIMARY;
      return window.pdfjsLib;
    })
    .catch(() =>
      loadScriptOnce(PDFJS_CDN_FALLBACK).then(() => {
        if (!window.pdfjsLib) throw new Error("pdfjsLib fallback no disponible");
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_FALLBACK;
        return window.pdfjsLib;
      })
    )
    .catch((err) => {
      pdfJsLoadPromise = null;
      throw err;
    });
  return pdfJsLoadPromise;
}

function destroyActivePdfViewer() {
  STATE.pdfViewerToken = (STATE.pdfViewerToken || 0) + 1;
  const active = STATE.activePdfViewer;
  STATE.activePdfViewer = null;
  if (!active) return;
  if (active.onKeyDown) {
    document.removeEventListener("keydown", active.onKeyDown);
  }
  if (active.timeoutId) {
    clearTimeout(active.timeoutId);
  }
  if (active.renderTask && typeof active.renderTask.cancel === "function") {
    try {
      active.renderTask.cancel();
    } catch (_) {}
  }
  if (active.pdfDoc && typeof active.pdfDoc.destroy === "function") {
    try {
      Promise.resolve(active.pdfDoc.destroy()).catch(() => {});
    } catch (_) {}
  }
  const canvas = document.getElementById("btPdfCanvas");
  if (canvas) {
    canvas.width = 1;
    canvas.height = 1;
  }
}

function buildPdfStreamUrl(doc, absPdfUrl) {
  if (!doc) return absPdfUrl;
  if (IS_LOCAL_SERVER || doc.has_web_file === true) {
    return absPdfUrl;
  }
  if (doc.sha12 && /^[a-f0-9]{12}$/i.test(doc.sha12)) {
    return `${PDF_STREAM_WORKER_BASE}/pdf/${doc.sha12.toLowerCase()}.pdf`;
  }
  return absPdfUrl;
}

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
  libraryAxis: "all",
  librarySubcategory: "all",
  librarySubcatOpen: false,
  libraryScope: "shelf",
  libraryVisibleCount: 12,
  currentShelfDocs: [],
  currentReadingIndex: -1,

  // Catalogo general
  filteredDocs: [],
  visibleCount: 12,
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
    .then(async ([baseData, v3Data, v4Data]) => {
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
      STATE.qBankByDocId = {};
      STATE.qBankByRelatedDocId = {};
      STATE.qBankByTopicId = {};

      // Indexación incremental por bloques para evitar bloqueos del hilo principal
      const totalQ = STATE.questionBank.length;
      const SLICE_SIZE = 3500;
      for (let offset = 0; offset < totalQ; offset += SLICE_SIZE) {
        const sliceStart = typeof performance !== "undefined" ? performance.now() : 0;
        const limit = Math.min(totalQ, offset + SLICE_SIZE);
        for (let idx = offset; idx < limit; idx++) {
          const qObj = STATE.questionBank[idx];
          const nk = normalizeQuestionKey(qObj.q || "");
          if (nk) STATE.qBankByNorm[nk] = qObj;
          const did = (qObj.doc_id || "").trim();
          if (did) {
            if (!STATE.qBankByDocId[did]) STATE.qBankByDocId[did] = [];
            STATE.qBankByDocId[did].push(qObj);
          }
          if (Array.isArray(qObj.related_doc_ids) && qObj.related_doc_ids.length) {
            for (const rid of qObj.related_doc_ids) {
              if (!rid || rid === did) continue;
              if (!STATE.qBankByRelatedDocId[rid]) STATE.qBankByRelatedDocId[rid] = [];
              if (STATE.qBankByRelatedDocId[rid].length < 40) {
                STATE.qBankByRelatedDocId[rid].push(qObj);
              }
            }
          }
          const tid = (qObj.topic_id || "").trim();
          if (tid) {
            if (!STATE.qBankByTopicId[tid]) STATE.qBankByTopicId[tid] = [];
            STATE.qBankByTopicId[tid].push(qObj);
          }
        }
        if (limit < totalQ && typeof performance !== "undefined" && performance.now() - sliceStart > 12) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      const badge = document.getElementById("totalQuestionsCount");
      if (badge && STATE.questionBank.length) {
        badge.textContent = STATE.questionBank.length.toLocaleString("es-MX");
      }
      resetBankIndexWarmup();
      scheduleBankIndexWarmup();
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
// CARGA INICIAL (CATALOGO DE 883 DOCUMENTOS OFICIALES + 105 TEMAS + 21,195 PREGUNTAS)
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
  if (typeof setupWhatsNewModal === "function") setupWhatsNewModal();
  setupIosExperience();
  setupBugReportModal();
  setupAutofillVault();
  setupScoutForum();
  setupHeaderUI();
  setupWorkspaceViews();
  setupSettingsHub();
  initFontScaleSetting();
  setupProcedureWizard();
  if (typeof setupProgressionChecker === "function") setupProgressionChecker();
  if (typeof setupPjosAxesHub === "function") setupPjosAxesHub();
  if (typeof setupScoutSkillsHub === "function") setupScoutSkillsHub();
  if (typeof setupAutofillQrSharing === "function") setupAutofillQrSharing();
  setupAnswerQuickActions();
  BtSoundEngine.init();
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
    if (typeof window.__btRefreshPjosPicker === "function") window.__btRefreshPjosPicker();

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
          if (reg && (reg.active || reg.installing || reg.waiting) && typeof reg.update === "function") {
            Promise.resolve(reg.update()).catch(() => {});
          }
        })
        .catch(() => {});
    }
  } catch (err) {
    console.error("Error cargando datos de BiblioTech:", err);
  } finally {
    markAppReady();
    handleStartupDeepLinks();
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
  "ejes-pjos": { view: "ejes" },
  ejes: { view: "ejes" },
  skills: { view: "skills" },
  claves: { view: "skills", skillsTab: "claves" },
  nudos: { view: "skills", skillsTab: "nudos" },
  mochila: { view: "skills", skillsTab: "mochila" },
  pistas: { view: "skills", skillsTab: "pistas" },
  botiquin: { view: "skills", skillsTab: "botiquin" },
  fogatas: { view: "skills", skillsTab: "fogatas" },
  silbato: { view: "skills", skillsTab: "silbato" },
  "guia-inicio": { view: "guia", guideTab: "guia-inicio" },
  acerca: { view: "acerca" },
  agentes: { view: "agentes" },
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
  const validViews = new Set(["inicio", "biblioteca", "ejes", "skills", "guia", "agentes", "fogata", "formatos", "acerca"]);
  const nextView = validViews.has(viewName) ? viewName : "inicio";
  STATE.activeWorkspaceView = nextView;

  if (nextView !== "skills" && typeof window.__btStopSkillAudio === "function") {
    window.__btStopSkillAudio();
  }

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
  if (nextView === "ejes") {
    if (typeof window.__btRefreshPjosPicker === "function") window.__btRefreshPjosPicker();
    if (options.ejesTab && typeof window.__btSelectEjesTab === "function") {
      window.__btSelectEjesTab(options.ejesTab);
    }
  }
  if (nextView === "skills") {
    if (options.skillsTab) STATE.activeSkillsTab = options.skillsTab;
    const targetSkillTab = options.skillsTab || STATE.activeSkillsTab || "claves";
    if (typeof window.__btSelectSkillsTab === "function") {
      window.__btSelectSkillsTab(targetSkillTab);
    }
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
      skillsTab: options.skillsTab || mapping.skillsTab,
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
      const header = document.querySelector(".main-header");
      if (header && header.classList.contains("nav-open")) {
        header.classList.remove("nav-open");
        document.body.classList.remove("nav-open");
        const navToggle = document.getElementById("navToggle");
        const navBackdrop = document.getElementById("navBackdrop");
        if (navToggle) navToggle.setAttribute("aria-expanded", "false");
        if (navBackdrop) navBackdrop.hidden = true;
      }
      openSavedPanel();
      return;
    }

    const skillJumpBtn = e.target.closest("[data-bt-jump-skill]");
    if (skillJumpBtn) {
      e.preventDefault();
      const skillTab = skillJumpBtn.getAttribute("data-bt-jump-skill") || "claves";
      btSwitchView("skills", { skillsTab: skillTab });
      return;
    }

    const viewTrigger = e.target.closest("[data-bt-go-view]");
    if (viewTrigger) {
      e.preventDefault();
      const targetView = viewTrigger.getAttribute("data-bt-go-view");
      const libJump = viewTrigger.getAttribute("data-bt-lib-jump");
      const guideJump = viewTrigger.getAttribute("data-bt-guide-jump");
      const skillsJump = viewTrigger.getAttribute("data-bt-skills-tab");
      const href = viewTrigger.getAttribute("href") || "";
      const hashId = href.startsWith("#") ? href.slice(1) : "";

      const opts = {
        libMode: libJump || undefined,
        guideTab: guideJump !== null ? guideJump : (targetView === "guia" ? "all" : undefined),
        skillsTab: skillsJump || undefined,
        scrollToId: hashId === "buscador" ? "buscador" : ""
      };
      if (guideJump === "app" && (window.Capacitor || window.innerWidth <= 920)) {
        if (window.Capacitor && window.__btNativeBridge && typeof window.__btNativeBridge.openModal === "function") {
          window.__btNativeBridge.openModal("files");
        } else if (typeof window.__btOpenSettingsModal === "function") {
          window.__btOpenSettingsModal("offline");
        } else {
          btSwitchView(targetView, opts);
        }
      } else {
        btSwitchView(targetView, opts);
      }

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
    const skillParam = (params.get("skill") || "").toLowerCase();
    const hashId = (window.location.hash || "").replace(/^#/, "");
    if (hashId && BT_SECTION_VIEW_MAP[hashId]) {
      btNavigateToSection(hashId, { instant: true });
      initialApplied = true;
    } else if (vParam && ["inicio", "biblioteca", "ejes", "skills", "guia", "agentes", "fogata", "formatos", "acerca"].includes(vParam)) {
      btSwitchView(vParam, { instant: true, updateUrl: false, skillsTab: skillParam || undefined });
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

function buildCodeAutocompleteSuggestions(rawInput) {
  const qClean = normalizeStr(rawInput).trim();
  const compact = qClean.replace(/[^a-z0-9.]/g, "");
  if (!compact || compact.length < 2) return [];

  const isCodeLike =
    /^(?:recme|serie|p\d{1,2}|jl\d*|dnme|jsn|cnpj|sjsn|faes|fes)/.test(qClean) ||
    /\b(?:p\d{1,2}(?:\.\d+)?|jl\d+|dnme|jsn)\b/.test(qClean);
  if (!isCodeLike) return [];

  const items = [];
  const seen = new Set();
  const pushItem = (query, codeBadge, cat) => {
    const k = normalizeQuestionKey(query);
    if (!k || seen.has(k)) return;
    seen.add(k);
    items.push({ q: query, codeBadge, cat, isCodeSuggestion: true });
  };

  // 1. Coincidencias de Series RECME P1-P10
  const pSeriesMatch = qClean.match(/(?:^|\b)(?:recme\s+|serie\s+)?(p\d{1,2})(?:\.(\d+))?\b/);
  if (pSeriesMatch) {
    const seriesKey = pSeriesMatch[1].toUpperCase();
    const sInfo = BT_RECME_SERIES_INFO[seriesKey];
    if (sInfo && !pSeriesMatch[2]) {
      pushItem(`recme ${seriesKey}`, `Serie ${seriesKey}`, sInfo.name);
    }
  }

  // 2. Coincidencias en documentos oficiales con código (P8.1..P9.5, JL304, DNME, JSN, etc.)
  const needleNoSep = compact.replace(/\./g, "");
  if (Array.isArray(STATE.documents) && STATE.documents.length) {
    const matchedDocs = [];
    for (const d of STATE.documents) {
      const dCode = String(d.code || "").trim();
      const dCodeNorm = normalizeStr(dCode);
      const dCodeCompact = dCodeNorm.replace(/[^a-z0-9]/g, "");
      const hay = normalizeStr(`${dCode} ${d.filename || ""} ${d.title || ""}`);
      let sc = 0;
      if (dCodeNorm && dCodeNorm === compact) sc += 120;
      else if (dCodeNorm && dCodeNorm.startsWith(compact)) sc += 90;
      else if (dCodeCompact && dCodeCompact.startsWith(needleNoSep)) sc += 75;
      else if (hay.includes(qClean)) sc += 30;
      if (sc > 0 && dCode) {
        matchedDocs.push({ sc, d });
      }
    }
    matchedDocs.sort(
      (a, b) =>
        b.sc - a.sc ||
        String(a.d.code || "").localeCompare(String(b.d.code || ""), "es", { numeric: true })
    );
    for (const { d } of matchedDocs.slice(0, 5)) {
      pushItem(
        `${d.code} ${d.title}`.slice(0, 88),
        d.code,
        d.section_label || d.category || "Oficial RECME"
      );
    }
  }

  // 3. Caso especial: P8.6 o P5.2 si el usuario escribe justo ese folio
  if (pSeriesMatch && pSeriesMatch[2]) {
    const fullCode = `${pSeriesMatch[1].toUpperCase()}.${pSeriesMatch[2]}`;
    const exists = items.some((it) => normalizeStr(it.codeBadge || "") === normalizeStr(fullCode));
    if (!exists && BT_RECME_SERIES_INFO[pSeriesMatch[1].toUpperCase()]) {
      pushItem(
        `recme ${fullCode}`,
        fullCode,
        BT_RECME_SERIES_INFO[pSeriesMatch[1].toUpperCase()].name
      );
    }
  }

  return items.slice(0, 5);
}

function updateAutocompleteDropdown(rawInput) {
  const box = document.getElementById("askAutocomplete");
  if (!box) return;

  const qNorm = normalizeQuestionKey(rawInput);
  if (!qNorm || qNorm.length < 2 || (!STATE.questionBank.length && !STATE.documents.length)) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  const codeItems = buildCodeAutocompleteSuggestions(rawInput);

  // Se usan palabras significativas (sin artículos ni muletillas) para que al
  // escribir una pregunta completa también aparezcan temas relacionados.
  const tokens = tokenizeQuery(rawInput).filter((w) => w.length >= 2);
  if (!tokens.length && !codeItems.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  const minHits = tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.5);
  const userTypedFalda = qNorm.includes("falda");
  const matches = [];

  if (tokens.length && STATE.questionBank.length) {
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
  }

  matches.sort((a, b) => b.score - a.score);
  const seenAc = new Set(codeItems.map((it) => normalizeQuestionKey(it.q)));
  const topQuestions = [];
  for (const m of matches) {
    const k = normalizeQuestionKey(m.item.q || "");
    if (!k || seenAc.has(k)) continue;
    seenAc.add(k);
    topQuestions.push(m.item);
    if (codeItems.length + topQuestions.length >= 8) break;
  }

  const combined = [...codeItems, ...topQuestions].slice(0, 8);

  if (!combined.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  box.innerHTML = combined
    .map(
      (item) => `
      <div class="ask-ac-item${item.isCodeSuggestion ? " is-code-item" : ""}" data-ac-query="${escapeHtml(item.q)}">
        <span class="ask-ac-text">${item.codeBadge ? `<span class="ask-ac-code-badge">${escapeHtml(item.codeBadge)}</span> ` : ""}${escapeHtml(item.q)}</span>
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
    case "faes":
      return list.filter((d) => d.category === "Fichas de Acciones Educativas Scouts (FAES)");
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

const DOC_SEARCH_STOPWORDS = new Set(["de", "del", "la", "las", "los", "el", "en", "y", "e", "o", "u", "para", "por", "con", "un", "una", "al", "a"]);

function extractDocSearchTokens(rawQuery) {
  const q = normalizeStr(String(rawQuery || "").trim());
  const raw = q ? q.split(/\s+/).filter(Boolean) : [];
  const filtered = raw.filter((tk) => tk.length >= 2 && !DOC_SEARCH_STOPWORDS.has(tk));
  return { q, tokens: filtered.length ? filtered : raw };
}

function scoreDocSearchRelevance(doc, q, tokens) {
  if (!doc || !tokens.length) return 0;
  const titleN = normalizeStr(doc.title || "");
  const fileN = normalizeStr(doc.filename || "");
  const codeN = normalizeStr(doc.code || "");
  const subN = normalizeStr(`${doc.subcategory || ""} ${doc.section_label || ""} ${doc.category || ""}`);
  let score = 0;
  if (q && (titleN === q || codeN === q)) score += 160;
  else if (q && titleN.includes(q)) score += 110;
  if (q && codeN && codeN.includes(q)) score += 95;
  if (q && fileN.includes(q)) score += 75;
  let titleHits = 0;
  for (const tk of tokens) {
    if (titleN.includes(tk)) {
      score += 28;
      titleHits++;
    }
    if (codeN && codeN.includes(tk)) score += 20;
    if (fileN.includes(tk)) score += 14;
    if (subN.includes(tk)) score += 8;
  }
  if (titleHits === tokens.length) score += 45;
  if (doc.is_latest_in_family !== false) score += 4;
  return score;
}

function docMatchesPjosAxis(doc, axisKey) {
  if (!axisKey || axisKey === "all") return true;
  if (!doc) return false;
  const subN = normalizeStr(doc.subcategory || "");
  const codeN = normalizeStr(doc.code || "");
  const fileN = normalizeStr(doc.filename || "");
  const hay = normalizeStr(
    `${doc.title || ""} ${doc.subcategory || ""} ${doc.code || ""} ${doc.filename || ""} ${(doc.tags || []).join(" ")}`
  );
  if (axisKey === "salud") {
    return (
      subN.includes("salud y bienestar") ||
      /\bsyb\b|_syb_|faes-\w+-syb|fes_\w+_syb/.test(`${codeN} ${fileN}`) ||
      /(a salvo del peligro|ficha salud|ficha medica|primeros auxilios|salud mental|nutricion|riesgos en areas|deportes|higiene)/.test(hay)
    );
  }
  if (axisKey === "habilidades") {
    return (
      subN.includes("habilidades para la vida") ||
      /\bhpv\b|_hpv_|faes-\w+-hpv|fes_\w+_hpv/.test(`${codeN} ${fileN}`) ||
      /(plantillaproyecto|p6\.1|p6\.2|smart|campismo|pionerismo|orientacion|finanzas|liderazgo|ciencia|tecnologia|cocina en campamento|fotografia|musica)/.test(hay)
    );
  }
  if (axisKey === "ambiente") {
    return (
      subN.includes("medio ambiente") ||
      subN.includes("sustentabilidad") ||
      /\bmays\b|_mays_|faes-\w+-mays|fes_\w+_mays/.test(`${codeN} ${fileN}`) ||
      /(tribu de la tierra|earth tribe|champions for nature|go solar|tide turners|p8\.1|p8\.7|biodiversidad|cambio climatico|huella ecologica|reciclaje|no dejar rastro|energia solar)/.test(hay)
    );
  }
  if (axisKey === "paz") {
    return (
      subN.includes("paz y participacion") ||
      subN.includes("cultura de paz") ||
      /\bpypc\b|_pypc_|faes-\w+-pypc|fes_\w+_pypc/.test(`${codeN} ${fileN}`) ||
      /(mensajeros de la paz|messengers of peace|p8\.3|dialogo por la paz|patrimonio|diversidad e inclusion|accion humanitaria|centro de acopio|centros de acopio|derechos humanos|masc|mediacion)/.test(hay)
    );
  }
  return true;
}

function getDocsForShelf(shelf, filterText = "") {
  const { q, tokens } = extractDocSearchTokens(filterText);
  const secFilter = STATE.librarySection || "all";
  const axisFilter = STATE.libraryAxis || "all";
  const scope = STATE.libraryScope || "shelf";

  const readable = STATE.documents.filter((d) => {
    if (secFilter !== "all") {
      const secs = d.applicable_sections || [d.section];
      if (!secs.includes(secFilter)) return false;
    }
    if (axisFilter !== "all" && !docMatchesPjosAxis(d, axisFilter)) {
      return false;
    }
    if (tokens.length) {
      const tagsStr = Array.isArray(d.tags) ? d.tags.join(" ") : "";
      const odsStr = Array.isArray(d.ods) ? d.ods.join(" ") : "";
      const codeRaw = String(d.code || "");
      const codeExpanded = `${codeRaw} ${codeRaw.replace(/[\/\-\._]+/g, " ")} ${codeRaw.replace(/[^a-z0-9]/gi, "")}`;
      const hay = normalizeStr(`${d.title} ${d.filename} ${d.category} ${d.subcategory || ""} ${d.section_label} ${d.summary || ""} ${codeExpanded} ${tagsStr} ${odsStr}`);
      for (const tk of tokens) {
        if (!hay.includes(tk)) return false;
      }
    }
    return true;
  });

  let baseDocs = scope === "all" || axisFilter !== "all" ? readable : filterDocsByShelfName(readable, shelf);
  if (scope !== "all" && tokens.length && !baseDocs.length && readable.length) {
    baseDocs = readable;
  }

  if (tokens.length && baseDocs.length > 1) {
    baseDocs = baseDocs.slice().sort((a, b) => {
      const diff = scoreDocSearchRelevance(b, q, tokens) - scoreDocSearchRelevance(a, q, tokens);
      if (diff !== 0) return diff;
      return (b.year || 0) - (a.year || 0);
    });
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

function getDocSizeLabel(doc) {
  if (!doc) return "";
  if (doc.size_label) return String(doc.size_label);
  const mb = Number(doc.size_mb || 0);
  if (mb >= 0.1) return `${mb.toFixed(1)} MB`;
  const kb = Math.max(1, Math.round(Number(doc.size_kb || 50)));
  return `${kb} KB`;
}

const BT_PDF_LAST_PAGE_KEY = "bt_pdf_last_page_v1";

function getSavedPdfPage(docId, maxPages = 9999) {
  let saved = 1;
  try {
    const map = JSON.parse(localStorage.getItem(BT_PDF_LAST_PAGE_KEY) || "{}");
    const entry = map && map[docId];
    const p = Number(entry && entry.p);
    if (Number.isFinite(p) && p >= 1 && p <= maxPages) {
      saved = p;
    }
  } catch (_) {}
  if (saved <= 1) {
    try {
      const ss = parseInt(sessionStorage.getItem(`bt_pdf_page_${docId}`) || "1", 10);
      if (Number.isFinite(ss) && ss >= 1 && ss <= maxPages) saved = ss;
    } catch (_) {}
  }
  return saved;
}

function savePdfPageProgress(docId, pageNum, totalPages) {
  if (!docId || !pageNum) return;
  try {
    sessionStorage.setItem(`bt_pdf_page_${docId}`, String(pageNum));
  } catch (_) {}
  if (totalPages > 1) {
    try {
      const map = JSON.parse(localStorage.getItem(BT_PDF_LAST_PAGE_KEY) || "{}");
      const safeMap = map && typeof map === "object" ? map : {};
      safeMap[docId] = { p: Number(pageNum), t: Number(totalPages), ts: Date.now() };
      const keys = Object.keys(safeMap);
      if (keys.length > 120) {
        keys
          .sort((a, b) => Number((safeMap[a] && safeMap[a].ts) || 0) - Number((safeMap[b] && safeMap[b].ts) || 0))
          .slice(0, keys.length - 120)
          .forEach((k) => delete safeMap[k]);
      }
      localStorage.setItem(BT_PDF_LAST_PAGE_KEY, JSON.stringify(safeMap));
    } catch (_) {}
  }
}

const BT_PAGE_BOOKMARKS_KEY = "bt_page_bookmarks_v1";

function getPageBookmarks() {
  try {
    const arr = JSON.parse(localStorage.getItem(BT_PAGE_BOOKMARKS_KEY) || "[]");
    if (!Array.isArray(arr)) return [];
    return arr.filter((b) => b && b.docId && Number(b.page) >= 1);
  } catch (_) {
    return [];
  }
}

function savePageBookmarks(list) {
  try {
    localStorage.setItem(BT_PAGE_BOOKMARKS_KEY, JSON.stringify(list.slice(0, 60)));
  } catch (_) {}
}

function isPageBookmarked(docId, pageNum) {
  const p = Number(pageNum) || 1;
  return getPageBookmarks().some((b) => b.docId === docId && Number(b.page) === p);
}

function togglePageBookmark(doc, pageNum) {
  if (!doc || !doc.id) return false;
  const p = Math.max(1, Number(pageNum) || 1);
  const list = getPageBookmarks();
  const idx = list.findIndex((b) => b.docId === doc.id && Number(b.page) === p);
  let added = false;
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.unshift({
      docId: doc.id,
      page: p,
      title: String(doc.title || doc.filename || doc.id).slice(0, 120),
      ext: doc.ext || "PDF",
      ts: Date.now(),
    });
    added = true;
  }
  savePageBookmarks(list);
  return added;
}

function removePageBookmark(docId, pageNum) {
  const p = Number(pageNum) || 1;
  const next = getPageBookmarks().filter((b) => !(b.docId === docId && Number(b.page) === p));
  savePageBookmarks(next);
}

function resolveDefaultLibraryCount() {
  if (STATE.libraryQuery.trim() !== "") return 24;
  return 12;
}

function renderLibraryShelf() {
  const grid = document.getElementById("libraryBookshelfGrid");
  const moreBtn = document.getElementById("libraryShowMoreBtn");
  const countLabel = document.getElementById("libraryCountLabel");
  const resetBtn = document.getElementById("resetLibraryFiltersBtn");
  if (!grid) return;

  const docs = getDocsForShelf(STATE.activeShelf, STATE.libraryQuery);
  STATE.currentShelfDocs = docs;
  const visibleLimit = STATE.libraryVisibleCount || 12;
  const slice = docs.slice(0, visibleLimit);

  if (countLabel) {
    countLabel.textContent = docs.length
      ? `Mostrando ${slice.length} de ${docs.length} archivos oficiales`
      : "0 archivos encontrados con este filtro";
  }
  if (resetBtn) {
    const hasFilter =
      STATE.libraryQuery.trim() !== "" ||
      STATE.librarySection !== "all" ||
      STATE.libraryAxis !== "all" ||
      STATE.librarySubcategory !== "all" ||
      STATE.libraryScope !== "shelf" ||
      STATE.activeShelf !== "featured";
    resetBtn.classList.toggle("hidden", !hasFilter);
  }

  if (!slice.length) {
    const rawQ = STATE.libraryQuery.trim();
    const askBridgeHtml =
      rawQ.length >= 4
        ? `<div class="bt-empty-ask-bridge">
            <p class="bt-empty-ask-hint">¿Buscabas resolver una duda sobre <strong>«${escapeHtml(rawQ)}»</strong>?</p>
            <button type="button" class="bt-empty-ask-btn" data-ask-from-empty="${escapeHtml(rawQ)}">Preguntar esto en el Buscador Scout →</button>
          </div>`
        : "";
    grid.innerHTML = `<div class="bt-empty-filter-box" style="grid-column:1/-1;text-align:center;padding:2rem 1rem;color:#64748b;"><p>No se encontraron archivos con ese filtro en este estante.</p>${askBridgeHtml}</div>`;
    if (moreBtn) moreBtn.classList.add("hidden");
    return;
  }

  grid.innerHTML = slice
    .map((d, idx) => {
      const coverUrl = d.sha12 ? `covers/${d.sha12}.jpg` : "";
      const pagesLabel = d.page_count > 1 ? `${d.page_count} págs.` : d.ext;
      const docSize = getDocSizeLabel(d);
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
          ${d.code ? `<span class="bt-doc-code-badge" title="Nomenclatura oficial: ${escapeHtml(d.code)}">${escapeHtml(d.code)}</span>` : ""}
          <h3 class="book-title" title="${escapeHtml(d.title)}">${escapeHtml(d.title)}</h3>
          <span class="book-meta">${escapeHtml(d.section_label)}${d.subcategory ? ` · ${escapeHtml(d.subcategory)}` : ""}</span>
          ${d.summary ? `<p class="book-desc">${escapeHtml(d.summary)}</p>` : ''}
          ${
            Array.isArray(d.tags) && d.tags.length
              ? `<div class="book-tags-row" aria-label="Etiquetas RECME">${d.tags
                  .slice(0, 3)
                  .map((t) => `<span class="book-tag-pill">${escapeHtml(String(t).replace(/_/g, " "))}</span>`)
                  .join("")}</div>`
              : ""
          }
          <button type="button" class="book-read-btn">Abrir lectura (${escapeHtml(docSize)})</button>
        </article>
      `;
    })
    .join("");

  if (moreBtn) {
    if (docs.length > slice.length) {
      moreBtn.classList.remove("hidden");
      moreBtn.textContent = `Cargar más archivos (${docs.length - slice.length} restantes)`;
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

  // El catálogo y el banco de 21,195 preguntas bastan para responder al instante;
  // chunks.json (14 MB) solo bloquea si hace falta una búsqueda profunda de fragmentos.
  try {
    await Promise.all([waitForAppReady(), loadQuestionBank()]);
  } catch (_) {}

  let ans = answerLocallyInBrowser(q);
  const needsDeepChunks =
    !ans ||
    (!ans.sources?.length && /no disponible en el acervo actual/i.test(ans.answer_markdown || ""));
  if (needsDeepChunks && (!STATE.webChunks || !STATE.webChunks.length)) {
    try {
      await loadWebChunks();
      ans = answerLocallyInBrowser(q);
    } catch (_) {}
  } else {
    setTimeout(() => {
      loadWebChunks().catch(() => {});
    }, 1200);
  }
  displayAnswer(ans, q);
  renderRelatedQuestions(q);
  recordQueryTelemetry(q, ans, querySource);
  if (typeof BtSoundEngine !== "undefined" && ans && ans.sources && ans.sources.length) {
    BtSoundEngine.play("success");
  }
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildDocSpecificAnswerInBrowser(doc) {
  const siblings = doc && doc.code && /^P\d+/i.test(String(doc.code))
    ? STATE.documents
        .filter((d) => d.id !== doc.id && String(d.code || "").toUpperCase().startsWith(`${String(doc.code).toUpperCase().split(".")[0]}.`))
        .sort((a, b) => String(a.code || "").localeCompare(String(b.code || ""), "es", { numeric: true }))
        .slice(0, 5)
    : [];
  return buildExecutiveDocCard(doc, siblings);
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
  manada: ["lobatos", "lobellas", "lobeznas", "seisena", "akela", "selva"],
  tropa: ["scouts", "patrulla", "guia", "rumbos"],
  clan: ["rovers", "servicio", "horquilla", "rutas", "ppv"],
  horquilla: ["terminal", "insignia", "clan", "rover"],
  sacar: ["obtener", "acreditar", "lograr", "tramitar", "conseguir", "requisitos"],
  saco: ["obtener", "acreditar", "lograr", "tramitar", "requisitos"],
  sacan: ["obtener", "acreditar", "lograr", "tramitar", "requisitos"],
  sacarse: ["obtener", "acreditar", "lograr", "tramitar", "requisitos"],
  obtener: ["sacar", "acreditar", "lograr", "tramitar", "conseguir"],
  acreditar: ["obtener", "sacar", "lograr", "validar", "requisitos"],
  conseguir: ["obtener", "sacar", "acreditar", "requisitos"],
  especialidad: ["especialidades", "fes"],
  especialidades: ["especialidad", "fes"],
  conocimientos: ["requisitos", "temas", "habilidades", "contenidos"],
  conocimiento: ["requisitos", "temas", "habilidades", "contenidos"],
  necesario: ["requisitos", "pide", "piden"],
  necesarios: ["requisitos", "pide", "piden"],
  pedir: ["solicitar", "tramitar", "iniciar"],
  solicitar: ["pedir", "tramitar", "iniciar"],
  tiempo: ["anticipacion", "plazo", "meses"],
  anticipacion: ["tiempo", "plazo", "meses"],
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
  if (/(especialidad scout|ficha faes|cazadero |rumbo |sendero |ruta |aventura )/.test(normalized)) {
    return false;
  }
  return /^(de que trata|que informacion oficial publica|que requisitos fechas|que especifica la pagina|que informacion contiene|que dice la pagina|que requisitos, fechas)/.test(normalized) ||
    (/«/.test(question) && /(de que trata|informacion oficial|que especifica|que requisitos)/.test(normalized));
}

let bankIndexCache = [];
let bankIndexCursor = 0;
let bankIndexWarmupTimer = null;
const BANK_INDEX_CHUNK_SIZE = 2500;
const corpusVocabulary = new Map();
let corpusVocabDocsBuilt = false;

function addTextToVocabulary(text, weight = 1) {
  const words = normalizeStr(text || "").match(/[a-z]{4,}/g) || [];
  for (const w of words) {
    if (ENGINE_STOPWORDS.has(w)) continue;
    corpusVocabulary.set(w, (corpusVocabulary.get(w) || 0) + weight);
  }
}

function indexBankSlice(start, end) {
  const limit = Math.min(end, STATE.questionBank.length);
  for (let i = start; i < limit; i++) {
    const item = STATE.questionBank[i];
    if (!item) continue;
    addTextToVocabulary(item.q || "", 1);
    bankIndexCache.push({
      ...item,
      _nq: normalizeQuestionKey(item.q || ""),
      _base: baseTokenSet(item.q || ""),
      _search: expandTokenSet(item.q || ""),
      _answer: null
    });
  }
  bankIndexCursor = limit;
}

function resetBankIndexWarmup() {
  bankIndexCache = [];
  bankIndexCursor = 0;
  corpusVocabDocsBuilt = false;
  if (bankIndexWarmupTimer) {
    clearTimeout(bankIndexWarmupTimer);
    bankIndexWarmupTimer = null;
  }
}

function ensureCorpusVocabulary() {
  if (!corpusVocabDocsBuilt) {
    corpusVocabDocsBuilt = true;
    for (const d of STATE.documents || []) {
      addTextToVocabulary(`${d.title || ""} ${d.subcategory || ""}`, 2);
    }
    for (const t of STATE.topics || []) {
      addTextToVocabulary(`${t.title || ""} ${(t.keywords || []).join(" ")} ${t.content || ""}`, 3);
    }
  }
  if (bankIndexCursor < STATE.questionBank.length) {
    getBankIndex();
  }
  return corpusVocabulary;
}

function scheduleBankIndexWarmup() {
  if (bankIndexCursor >= STATE.questionBank.length) return;
  const runChunk = () => {
    bankIndexWarmupTimer = null;
    if (!STATE.questionBank.length || bankIndexCursor >= STATE.questionBank.length) return;
    indexBankSlice(bankIndexCursor, bankIndexCursor + BANK_INDEX_CHUNK_SIZE);
    if (bankIndexCursor < STATE.questionBank.length) {
      scheduleBankIndexWarmup();
    }
  };
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => runChunk(), { timeout: 600 });
  } else {
    bankIndexWarmupTimer = setTimeout(runChunk, 12);
  }
}

function getBankIndex() {
  if (bankIndexCache.length === STATE.questionBank.length && bankIndexCursor === STATE.questionBank.length) {
    return bankIndexCache;
  }
  if (bankIndexCache.length > STATE.questionBank.length || bankIndexCursor > STATE.questionBank.length) {
    resetBankIndexWarmup();
  }
  if (bankIndexCursor < STATE.questionBank.length) {
    indexBankSlice(bankIndexCursor, STATE.questionBank.length);
  }
  return bankIndexCache;
}

function editDistanceDL(a, b, maxDist = 2) {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > maxDist) return maxDist + 1;
  const prev2 = new Array(n + 1).fill(0);
  const prev1 = Array.from({ length: n + 1 }, (_, j) => j);
  const curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const bj = b.charCodeAt(j - 1);
      const cost = ai === bj ? 0 : 1;
      let val = Math.min(
        prev1[j] + 1,
        curr[j - 1] + 1,
        prev1[j - 1] + cost
      );
      if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === bj) {
        val = Math.min(val, prev2[j - 2] + 1);
      }
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
    for (let j = 0; j <= n; j++) {
      prev2[j] = prev1[j];
      prev1[j] = curr[j];
    }
  }
  return prev1[n];
}

function correctQueryTypos(rawQuery) {
  const vocab = ensureCorpusVocabulary();
  if (!vocab.size) return { correctedQuery: rawQuery, wasCorrected: false, replacements: [] };

  const tokens = String(rawQuery || "").split(/(\s+)/);
  let wasCorrected = false;
  const replacements = [];

  const outTokens = tokens.map((part) => {
    if (!part || /^\s+$/.test(part)) return part;
    const m = part.match(/^([^A-Za-zÀ-ÿ0-9]*)([A-Za-zÀ-ÿ0-9]+)([^A-Za-zÀ-ÿ0-9]*)$/);
    if (!m) return part;
    const [, lead, core, trail] = m;
    const norm = normalizeStr(core);
    if (
      norm.length < 4 ||
      /\d/.test(norm) ||
      ENGINE_STOPWORDS.has(norm) ||
      vocab.has(norm) ||
      Object.prototype.hasOwnProperty.call(SYNONYMS, norm)
    ) {
      return part;
    }
    const maxDist = norm.length >= 7 ? 2 : 1;
    let bestWord = null;
    let bestDist = maxDist + 1;
    let bestFreq = 0;
    const c0 = norm[0];
    const c1 = norm[1] || "";

    for (const [cand, freq] of vocab.entries()) {
      if (Math.abs(cand.length - norm.length) > maxDist) continue;
      if (cand[0] !== c0 && cand[0] !== c1 && cand[1] !== c0) continue;
      const dist = editDistanceDL(norm, cand, maxDist);
      if (dist > 0 && dist <= maxDist) {
        if (dist < bestDist || (dist === bestDist && freq > bestFreq)) {
          bestDist = dist;
          bestWord = cand;
          bestFreq = freq;
        }
      }
    }

    if (bestWord && bestWord !== norm) {
      wasCorrected = true;
      replacements.push({ from: core, to: bestWord });
      return `${lead}${bestWord}${trail}`;
    }
    return part;
  });

  return {
    correctedQuery: outTokens.join(""),
    wasCorrected,
    replacements
  };
}

const GENERIC_CONCEPT_TOKENS = new Set([
  "requisito", "requisitos", "insignia", "insignias", "scout", "scouts",
  "obtener", "sacar", "acreditar", "conseguir", "tramitar", "lograr",
  "conocimiento", "conocimientos", "necesario", "necesarios", "pide", "piden",
  "nuevo", "nueva", "nuevos", "nuevas", "tipo", "tipos", "diferencia", "diferencias",
  "sirve", "sirven", "tema", "temas", "general", "oficial", "seccion", "secciones",
  "formato", "formatos", "plantilla", "plantillas", "guia", "manual", "documento",
  "archivo", "final", "terminal", "solicitud", "proceso", "procedimiento", "paso", "pasos"
]);

function buildQueryConceptGroups(query) {
  const rawLower = String(query || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const all = normalizeStr(query).match(/[a-z0-9]{2,}/g) || [];
  const filtered = all.filter((w) => !ENGINE_STOPWORDS.has(w));
  const words = filtered.length ? filtered : all;
  const groups = [];
  const seenCanon = new Set();

  for (const word of words) {
    const canon = canonicalToken(word) || word;
    if (!canon || seenCanon.has(canon)) continue;
    seenCanon.add(canon);

    const baseVariants = tokenVariants(word);
    const variants = new Set(baseVariants);
    for (const v of baseVariants) {
      const direct = Object.prototype.hasOwnProperty.call(SYNONYMS, v) ? SYNONYMS[v] : [];
      for (const syn of direct) {
        for (const sv of tokenVariants(syn)) variants.add(sv);
      }
    }
    const isGeneric = GENERIC_CONCEPT_TOKENS.has(canon) || GENERIC_CONCEPT_TOKENS.has(word);
    groups.push({
      canon,
      baseVariants,
      variants: [...variants],
      isGeneric,
      weight: isGeneric ? 1.0 : 2.6
    });
  }

  const compoundCodes = rawLower.match(/\b(?:[a-z]{1,4}\s*)?\d+(?:[._-]\d+)+\b|\b[a-z]+\d+(?:[._-]\d+)+\b/g) || [];
  for (const code of compoundCodes) {
    const joined = code.replace(/[^a-z0-9]/g, "");
    if (joined.length >= 2 && !seenCanon.has(joined)) {
      seenCanon.add(joined);
      groups.push({
        canon: joined,
        baseVariants: [joined],
        variants: [joined],
        isGeneric: false,
        weight: 3.2
      });
    }
  }
  return groups;
}

function rankQuestionBank(query) {
  if (!STATE.questionBank.length) {
    return { item: null, score: 0, coverage: 0, specificCoverage: 0, bodyCoverage: 0 };
  }
  const qNorm = normalizeQuestionKey(query);
  const conceptGroups = buildQueryConceptGroups(query);
  if (!conceptGroups.length) {
    return { item: null, score: 0, coverage: 0, specificCoverage: 0, bodyCoverage: 0 };
  }
  const totalWeight = conceptGroups.reduce((acc, g) => acc + g.weight, 0) || 1;
  const specificGroups = conceptGroups.filter((g) => !g.isGeneric);
  const specificTotal = specificGroups.length;
  const bank = getBankIndex();
  let best = null;
  let bestScore = 0;
  let bestCoverage = 0;
  let bestSpecific = 0;
  let bestBody = 0;

  for (const item of bank) {
    const hasTopic = Boolean(item.topic_id && STATE.topicsById[item.topic_id]);
    if ((!item.ans && !hasTopic) || !item._nq) continue;
    if (isGenericDocQuestion(item.q)) continue;

    let hits = 0;
    let directHits = 0;
    let matchedWeight = 0;
    let specificHits = 0;

    for (const g of conceptGroups) {
      let matched = false;
      let direct = false;
      for (const bv of g.baseVariants) {
        if (item._base.has(bv)) {
          matched = true;
          direct = true;
          break;
        }
      }
      if (!matched) {
        for (const v of g.variants) {
          if (item._search.has(v)) {
            matched = true;
            break;
          }
        }
      }
      if (matched) {
        hits++;
        if (direct) directHits++;
        matchedWeight += g.weight;
        if (!g.isGeneric) specificHits++;
      }
    }
    if (!hits) continue;

    const coverage = matchedWeight / totalWeight;
    const specificCoverage = specificTotal > 0 ? specificHits / specificTotal : 1;
    const exact = item._nq === qNorm || item._nq.includes(qNorm) || qNorm.includes(item._nq);

    // Nunca empatar preguntas que no coinciden con NINGÚN término propio/específico del usuario
    if (specificTotal >= 1 && specificHits === 0) continue;
    if (specificTotal >= 2 && specificCoverage < 0.5 && !exact) continue;
    if (coverage < 0.52 && !(specificTotal >= 2 && specificCoverage >= 0.85)) continue;
    if (hits < 2 && !(conceptGroups.length === 1 && hits === 1 && exact)) continue;

    // La respuesta se tokeniza solo para los candidatos que ya coinciden con la
    // pregunta. Así el índice inicial sigue siendo ligero en el teléfono.
    const bodySource = item.ans || (hasTopic ? STATE.topicsById[item.topic_id].content : "");
    const answerTokens = item._answer || (item._answer = expandTokenSet(bodySource || ""));
    let bodyWeight = 0;
    for (const g of conceptGroups) {
      if (g.variants.some((v) => answerTokens.has(v))) bodyWeight += g.weight;
    }
    const bodyCoverage = bodyWeight / totalWeight;
    const itemCoverage = Math.min(1, hits / Math.max(1, item._base.size));

    let score =
      coverage * 58 +
      specificCoverage * 24 +
      itemCoverage * 14 +
      bodyCoverage * 20 +
      hits * 4 +
      directHits * 7;
    if (exact) score += 34;
    if (item.doc_id) score += 2;
    if (item.topic_id) score += 3;
    if (item.cat) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = item;
      bestCoverage = coverage;
      bestSpecific = specificCoverage;
      bestBody = bodyCoverage;
    }
  }
  if (best && !best.ans && best.topic_id && STATE.topicsById[best.topic_id]) {
    best = {
      ...best,
      ans: buildTopicAnswer(STATE.topicsById[best.topic_id], query, 4200)
    };
  }
  return {
    item: best,
    score: bestScore,
    coverage: bestCoverage,
    specificCoverage: bestSpecific,
    bodyCoverage: bestBody
  };
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
  const limit = maxChars >= 2000 ? maxChars + 800 : maxChars;
  if (clean.length <= limit) return clean;
  const lines = clean.split("\n");
  let out = "";
  for (const line of lines) {
    if ((out + "\n" + line).length > limit) break;
    out += (out ? "\n" : "") + line;
  }
  if (out) return out.trim();
  const cut = clean.slice(0, limit);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"), cut.lastIndexOf("; "));
  return (lastStop > limit * 0.55 ? cut.slice(0, lastStop + 1) : cut).trim() + "…";
}

function buildTopicAnswer(topic, query, maxChars = 4200) {
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
    const headNorm = normalizeQuestionKey(section.heading);
    let boost = 0;
    if (wantsDocs && /(document|autoriz|ficha|permiso|acta|curp|codigo de conducta)/.test(body)) boost += 14;
    if (wantsPrice && /(\$|cuota|precio|costo|membresia|pago)/.test(body)) boost += 10;
    if (wantsSteps && /(pasos|procedimiento|proceso|inscrip|registro)/.test(headNorm)) boost += 6;
    if (wantsWhere && /(donde|direccion|ubicacion|tienda|portal|sitio)/.test(body)) boost += 6;
    // Priorizar la subsección exacta cuando el usuario pregunta por una sección específica
    const askedSec =
      /\b(manada|lobato|lobatos|lobezna|lobeznas)\b/.test(qNorm)
        ? "manada"
        : /\b(tropa|patrulla|patrullas)\b/.test(qNorm)
          ? "tropa"
          : /\b(comunidad|caminante|caminantes)\b/.test(qNorm)
            ? "comunidad"
            : /\b(clan|rover|rovers)\b/.test(qNorm)
              ? "clan"
              : "";
    if (askedSec) {
      const headSec =
        /\b(manada|lobato|lobezna)\b/.test(headNorm)
          ? "manada"
          : /\b(tropa|patrulla)\b/.test(headNorm)
            ? "tropa"
            : /\b(comunidad|caminante)\b/.test(headNorm)
              ? "comunidad"
              : /\b(clan|rover)\b/.test(headNorm)
                ? "clan"
                : "";
      if (headSec === askedSec) boost += 22;
      else if (headSec && headSec !== askedSec) boost -= 12;
    }
    return { section, hits, score: weight + headingWeight + boost };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] && scored[0].hits > 0 ? scored[0] : null;
  const intro = topic._intro && !/^#{2,4}\s/.test(topic._intro) ? topic._intro : "";
  let out = intro;
  if (best) {
    if (out) out += "\n\n";
    out += best.section.text;
    for (let i = 1; i < Math.min(3, scored.length); i++) {
      const nxt = scored[i];
      if (!nxt || nxt.hits < 1) continue;
      if (nxt.score < best.score * 0.45) continue;
      if ((out + "\n\n" + nxt.section.text).length > maxChars) break;
      out += "\n\n" + nxt.section.text;
    }
  } else if (!out && topic._sections.length) {
    out = topic._sections[0].text;
  }
  if (!out) out = topic.content || "";
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


const ASMAC_PROVINCES_DIRECTORY = [
  { name: "Aguascalientes", president: "Isabel Cristina García Romo", email: "presidente.aguascalientes@scouts.org.mx", keys: ["aguascalientes"] },
  { name: "Álvaro Obregón", president: "Juan Carlos Franco Sánchez", email: "presidente.alvaro_obregon@scouts.org.mx", keys: ["alvaro obregon"] },
  { name: "Azcapotzalco", president: "Luis Miguel Picazo", email: "presidente.azcapotzalco@scouts.org.mx", keys: ["azcapotzalco"] },
  { name: "Baja California", president: "Claudia Margarita Delgadillo Becerra", email: "presidente.baja_california_norte@scouts.org.mx", keys: ["baja california norte", "baja california"] },
  { name: "Baja California Sur", president: "Jonathan Sánchez Guerrero", email: "presidente.baja_california_sur@scouts.org.mx", keys: ["baja california sur", "bcs"] },
  { name: "Benito Juárez", president: "Luis Enrique Palacio Rodríguez", email: "presidente.benito_juarez@scouts.org.mx", keys: ["benito juarez"] },
  { name: "Chalco Ixtapaluca", president: "Raúl Josías Albarrán Ramírez", email: "presidente.chalco_ixtapaluca@scouts.org.mx", keys: ["chalco ixtapaluca", "chalco", "ixtapaluca"] },
  { name: "Chiapas", president: "Carlos Adrián Pérez Muñoz", email: "presidente.chiapas@scouts.org.mx", keys: ["chiapas"] },
  { name: "Chihuahua Norte", president: "Adrián Emmanuel Gutiérrez Gutiérrez", email: "presidente.chihuahua_norte@scouts.org.mx", keys: ["chihuahua norte"] },
  { name: "Chihuahua Sur", president: "Alan Damián Anchondo del Villar", email: "presidente.chihuahua_sur@scouts.org.mx", keys: ["chihuahua sur"] },
  { name: "Coahuila", president: "Bertha Alicia Estrada Herrera", email: "presidente.coahuila@scouts.org.mx", keys: ["coahuila"] },
  { name: "Colima", president: "Lorena Yasmín Ceballos Méndez", email: "presidente.colima@scouts.org.mx", keys: ["colima"] },
  { name: "Coyoacán", president: "Emilia Ernestina Leticia Valladares", email: "presidente.coyoacan@scouts.org.mx", keys: ["coyoacan"] },
  { name: "Cuauhtémoc", president: "Karla Cynthia Muñoz Alcántara", email: "presidente.cuauhtemoc@scouts.org.mx", keys: ["cuauhtemoc"] },
  { name: "Cuautitlán", president: "Ulises Saúl Carreño Macías", email: "presidente.cuautitlan@scouts.org.mx", keys: ["cuautitlan"] },
  { name: "Durango", president: "Jesús Jael Leyva de la Torre", email: "presidente.durango@scouts.org.mx", keys: ["durango"] },
  { name: "Guanajuato I", president: "Wilfrido Ignacio Contreras Camarena", email: "presidente.guanajuato_1@scouts.org.mx", keys: ["guanajuato 1", "guanajuato i", "guanajuato uno"] },
  { name: "Guanajuato II", president: "Raúl Arrieta Medina", email: "presidente.guanajuato_2@scouts.org.mx", keys: ["guanajuato 2", "guanajuato ii", "guanajuato dos"] },
  { name: "Guerrero", president: "María de los Ángeles Monroy Borja", email: "presidente.guerrero@scouts.org.mx", keys: ["guerrero"] },
  { name: "Gustavo A. Madero", president: "Iván Fernando Rodríguez García", email: "presidente.gustavo_a_madero@scouts.org.mx", keys: ["gustavo a madero", "gam"] },
  { name: "Hidalgo", president: "Mariana Aurora Camejo Quiroz", email: "presidente.hidalgo@scouts.org.mx", keys: ["hidalgo"] },
  { name: "Iztacalco", president: "Esmeralda de Alfonso Gálvez", email: "presidente.iztacalco@scouts.org.mx", keys: ["iztacalco"] },
  { name: "Iztapalapa", president: "Israel Araujo Martínez", email: "presidente.iztapalapa@scouts.org.mx", keys: ["iztapalapa"] },
  { name: "Jalisco", president: "Ana Carolina Rentería García", email: "presidente.jalisco@scouts.org.mx", keys: ["jalisco"] },
  { name: "La Laguna", president: "Ulises Lugo Guerrero", email: "presidente.la_laguna@scouts.org.mx", keys: ["la laguna", "laguna"] },
  { name: "Michoacán", president: "Ana Martha Mora Ruano", email: "presidente.michoacan@scouts.org.mx", keys: ["michoacan"] },
  { name: "Miguel Hidalgo", president: "Paulette Eurídice Robles", email: "presidente.miguel_hidalgo@scouts.org.mx", keys: ["miguel hidalgo"] },
  { name: "Morelos", president: "David Cortés Chan", email: "presidente.morelos@scouts.org.mx", keys: ["morelos"] },
  { name: "Naucalpan", president: "Federico Alejandro Ortíz Baeza", email: "presidente.naucalpan@scouts.org.mx", keys: ["naucalpan"] },
  { name: "Nuevo León", president: "Adrián Garza García", email: "presidente.nuevo_leon@scouts.org.mx", keys: ["nuevo leon"] },
  { name: "Oaxaca", president: "Karina Graciela Ortiz Cervantes", email: "presidente.oaxaca@scouts.org.mx", keys: ["oaxaca"] },
  { name: "Puebla", president: "Guillermo Sabas Ramírez Luna", email: "presidente.puebla@scouts.org.mx", keys: ["puebla"] },
  { name: "Querétaro", president: "Natzielli López Ramírez", email: "presidente.queretaro@scouts.org.mx", keys: ["queretaro"] },
  { name: "Quintana Roo", president: "Gilberto Arias Pastor", email: "presidente.quintana_roo@scouts.org.mx", keys: ["quintana roo"] },
  { name: "San Luis Potosí", president: "Ana Lucía Rocha Pinot", email: "presidente.san_luis_potosi@scouts.org.mx", keys: ["san luis potosi", "slp"] },
  { name: "Sinaloa", president: "Eleazar Pacheco Félix", email: "presidente.sinaloa@scouts.org.mx", keys: ["sinaloa"] },
  { name: "Sonora", president: "Hilda Guadalupe Valenzuela Zamora", email: "presidente.sonora@scouts.org.mx", keys: ["sonora"] },
  { name: "Tabasco", president: "Mariana Jiménez Pérez", email: "presidente.tabasco@scouts.org.mx", keys: ["tabasco"] },
  { name: "Tamaulipas Norte", president: "José Ángel Cantú García", email: "presidente.tamaulipas_norte@scouts.org.mx", keys: ["tamaulipas norte"] },
  { name: "Tamaulipas Sur", president: "José Ignacio Anchondo Pérez", email: "presidente.tamaulipas_sur@scouts.org.mx", keys: ["tamaulipas sur"] },
  { name: "Tláhuac Xochimilco", president: "Alfonso Vázquez Quiroz", email: "presidente.tlahuac_xochimilco@scouts.org.mx", keys: ["tlahuac xochimilco", "tlahuac", "xochimilco", "tlxh"] },
  { name: "Tlalnepantla-Atizapán", president: "José Jaime Magallón Díaz", email: "presidente.tlalnepantla@scouts.org.mx", keys: ["tlalnepantla atizapan", "tlalnepantla", "atizapan"] },
  { name: "Tlalpan", president: "Horacio Guillermo Ponce Ullóa", email: "presidente.tlalpan@scouts.org.mx", keys: ["tlalpan"] },
  { name: "Toluca", president: "Alicia Karina Rogel Bedolla", email: "presidente.toluca@scouts.org.mx", keys: ["toluca"] },
  { name: "Valle Noreste", president: "Dannae Desirée Viveros Devars", email: "presidente.vallenoreste@scouts.org.mx", keys: ["valle noreste", "vallenoreste"] },
  { name: "Venustiano Carranza", president: "Alejandro Rivera Pozo", email: "presidente.venustiano_carranza@scouts.org.mx", keys: ["venustiano carranza"] },
  { name: "Veracruz", president: "Miguel González González", email: "presidente.veracruz@scouts.org.mx", keys: ["veracruz"] },
  { name: "Yucatán", president: "Jorge Carlos Villamil Domínguez", email: "presidente.yucatan@scouts.org.mx", keys: ["yucatan"] },
  { name: "Zacatecas", president: "María Guadalupe González Ramírez", email: "presidente.zacatecas@scouts.org.mx", keys: ["zacatecas"] }
];

function matchProvinceDirectoryAnswer(qNorm) {
  if (!qNorm) return null;
  const asksProvinceTopic = /\b(provincia|provincias|presidente|presidenta|presidentes|correo|contacto)\b/.test(qNorm);
  if (!asksProvinceTopic) return null;

  // Check if asking about one or more specific provinces (check longer keys first so "baja california sur" and "miguel hidalgo" win over shorter substrings)
  const sortedProvs = ASMAC_PROVINCES_DIRECTORY.slice().sort((a, b) => b.keys[0].length - a.keys[0].length);
  let remaining = ` ${qNorm} `;
  const matchedProvs = [];
  for (const p of sortedProvs) {
    for (const k of p.keys) {
      if (remaining.includes(` ${k} `)) {
        matchedProvs.push(p);
        remaining = remaining.split(` ${k} `).join(" ");
        break;
      }
    }
  }
  if (matchedProvs.length === 1) {
    const p = matchedProvs[0];
    return (
      `**Provincia Scout ${p.name.toUpperCase()} (ASMAC):**\n\n` +
      `- **Presidente(a) de Provincia:** **${p.president}**\n` +
      `- **Correo electrónico oficial:** \`${p.email}\`\n` +
      `- **Organización Nacional:** ${p.name} forma parte de las **49 Provincias Scouts oficiales** de la Asociación de Scouts de México, A.C. (ASMAC).\n` +
      `- **Directorio oficial:** [scouts.org.mx/presidentes-de-provincia](https://scouts.org.mx/presidentes-de-provincia/)`
    );
  }
  if (matchedProvs.length > 1) {
    return (
      matchedProvs
        .map(
          (p) =>
            `**Provincia Scout ${p.name.toUpperCase()} (ASMAC):**\n` +
            `- **Presidente(a) de Provincia:** **${p.president}** · Correo: \`${p.email}\``
        )
        .join("\n\n") +
      `\n\n- **Directorio oficial de las 49 Provincias:** [scouts.org.mx/presidentes-de-provincia](https://scouts.org.mx/presidentes-de-provincia/)`
    );
  }

  // Handle "guanajuato" (both I and II) or "chihuahua" (Norte and Sur) or "tamaulipas" (Norte and Sur)
  if (qNorm.includes("guanajuato")) {
    const g1 = ASMAC_PROVINCES_DIRECTORY.find((x) => x.name === "Guanajuato I");
    const g2 = ASMAC_PROVINCES_DIRECTORY.find((x) => x.name === "Guanajuato II");
    return (
      `**En el estado de Guanajuato existen 2 Provincias Scouts oficiales de ASMAC:**\n\n` +
      `1. **Provincia ${g1.name}:** Presidente(a): **${g1.president}** · Correo: \`${g1.email}\`\n` +
      `2. **Provincia ${g2.name}:** Presidente(a): **${g2.president}** · Correo: \`${g2.email}\``
    );
  }
  if (qNorm.includes("chihuahua")) {
    const c1 = ASMAC_PROVINCES_DIRECTORY.find((x) => x.name === "Chihuahua Norte");
    const c2 = ASMAC_PROVINCES_DIRECTORY.find((x) => x.name === "Chihuahua Sur");
    return (
      `**En el estado de Chihuahua existen 2 Provincias Scouts oficiales de ASMAC:**\n\n` +
      `1. **Provincia ${c1.name}:** Presidente(a): **${c1.president}** · Correo: \`${c1.email}\`\n` +
      `2. **Provincia ${c2.name}:** Presidente(a): **${c2.president}** · Correo: \`${c2.email}\``
    );
  }
  if (qNorm.includes("tamaulipas")) {
    const t1 = ASMAC_PROVINCES_DIRECTORY.find((x) => x.name === "Tamaulipas Norte");
    const t2 = ASMAC_PROVINCES_DIRECTORY.find((x) => x.name === "Tamaulipas Sur");
    return (
      `**En el estado de Tamaulipas existen 2 Provincias Scouts oficiales de ASMAC:**\n\n` +
      `1. **Provincia ${t1.name}:** Presidente(a): **${t1.president}** · Correo: \`${t1.email}\`\n` +
      `2. **Provincia ${t2.name}:** Presidente(a): **${t2.president}** · Correo: \`${t2.email}\``
    );
  }

  if (/\b(cuantas provincias|todas las provincias|lista de provincias|presidentes de provincia|directorio de provincias|provincias scouts)\b/.test(qNorm)) {
    const listMd = ASMAC_PROVINCES_DIRECTORY.map(
      (p, idx) => `${idx + 1}. **${p.name}** — Presidente(a): **${p.president}** · \`${p.email}\``
    ).join("\n");
    return (
      `**En la Asociación de Scouts de México, A.C. (ASMAC) existen 49 Provincias Scouts oficiales:**\n\n` +
      `${listMd}\n\n` +
      `- **Portal oficial:** [scouts.org.mx/presidentes-de-provincia](https://scouts.org.mx/presidentes-de-provincia/)`
    );
  }
  return null;
}

function buildAnswerLocally(query) {
  const qNorm = normalizeQuestionKey(query);
  const provAns = matchProvinceDirectoryAnswer(qNorm);
  if (provAns) {
    return { kind: "exact", text: provAns, item: { q: query, ans: provAns } };
  }
  const bank = getBankIndex();
  const exact = bank.find((item) => item._nq === qNorm);
  if (exact && exact.ans && !isGenericDocQuestion(exact.q)) {
    return { kind: "exact", text: exact.ans, item: exact };
  }
  if (exact && exact.topic_id && STATE.topicsById[exact.topic_id]) {
    const tObj = STATE.topicsById[exact.topic_id];
    const text = buildTopicAnswer(tObj, query, 4200);
    return { kind: "topic", text, topic: tObj, score: 95, topics: [{ topic: tObj, score: 95 }] };
  }

  const topicRank = rankTopics(query);
  const qa = rankQuestionBank(query);
  const top = topicRank[0];
  const second = topicRank[1];
  const topicScore = top ? top.score : 0;
  const qaCoverage = qa.item ? qa.coverage : 0;
  const qaSpec = qa.item ? (qa.specificCoverage || 0) : 0;

  // Pregunta específica de alta precisión en el banco vence a temas genéricos
  if (qa.item && qaCoverage >= 0.84 && qaSpec >= 0.95 && qa.score >= 68) {
    return { kind: "qa", text: qa.item.ans, item: qa.item, qa, top };
  }
  if (qa.item && qaCoverage >= 0.72 && qaSpec >= 0.95 && topicScore < 52) {
    return { kind: "qa", text: qa.item.ans, item: qa.item, qa, top };
  }
  if (qa.item && qaCoverage >= 0.92 && topicScore < 30) {
    return { kind: "qa", text: qa.item.ans, item: qa.item, qa, top };
  }
  if (qa.item && qa.bodyCoverage >= 0.55 && qaSpec >= 0.65 && topicScore < 32) {
    let text = qa.item.ans;
    let extraTopic = null;
    if (top && topicScore >= 12 && top.topic.id !== qa.item.topic_id) {
      const related = buildTopicAnswer(top.topic, query, 2400);
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
    let text = buildTopicAnswer(primary.topic, query, 4200);
    let primaryPhrase = phraseLine(text, query);
    let secondText = secondary ? buildTopicAnswer(secondary.topic, query, 2400) : "";
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
    return { kind: "topic", text: buildTopicAnswer(top.topic, query, 3600), topic: top.topic, score: topicScore, topics: topicRank.slice(0, 4) };
  }
  return { kind: "none", topicRank: topicRank.slice(0, 5), qa };
}

function appendRelatedSources(qSources, item, maxSources = 5) {
  if (!item || !Array.isArray(item.related_doc_ids) || !item.related_doc_ids.length) return;
  const seenIds = new Set(qSources.map((s) => s.doc_id));
  for (const rid of item.related_doc_ids) {
    if (qSources.length >= maxSources) break;
    if (!rid || seenIds.has(rid)) continue;
    const rdoc = STATE.docsById[rid];
    if (!rdoc) continue;
    seenIds.add(rid);
    qSources.push({
      doc_id: rdoc.id,
      title: rdoc.title,
      filename: rdoc.filename,
      ext: rdoc.ext,
      year: rdoc.year,
      page_start: 1
    });
  }
}

const BT_RECME_SERIES_INFO = {
  P1: {
    name: "Plantillas de Diagnóstico Inicial (PJOS)",
    desc: "Formatos oficiales de RECME para el diagnóstico inicial de NNAJ al ingresar o pasar de sección (Manada, Tropa, Comunidad y Clan).",
    contact: "programa.jovenes@scouts.org.mx"
  },
  P2: {
    name: "Plantillas de Evaluación Auxiliar y Seguimiento (PJOS)",
    desc: "Cédulas auxiliares para evaluar acciones educativas y dar seguimiento a la progresión personal por sección.",
    contact: "programa.jovenes@scouts.org.mx"
  },
  P3: {
    name: "Mapas, Pasaportes y Herramientas de Progresión Personal (PJOS)",
    desc: "Herramientas individuales de registro de progresión por sección (Mi Libro del Seeonee, Mapa de Exploraciones, Hoja de Caminata, Mi Pasaporte de Comunidad y Mapa de Rutas / PPV SMART).",
    contact: "programa.jovenes@scouts.org.mx"
  },
  P4: {
    name: "Plantillas de Fichas de Acciones Educativas Scouts (FAES)",
    desc: "Plantilla principal y anexos vertical/horizontal para diseñar y compartir Fichas de Acciones Educativas Scouts (FAES) en el PJOS.",
    contact: "programa.jovenes@scouts.org.mx"
  },
  P5: {
    name: "Plantillas de Fichas de Especialidades Scouts (FES)",
    desc: "Plantilla oficial editable (`P5.1`) para desarrollar y documentar Especialidades Scouts en las 4 fases (Descubro, Conozco, Aplico, Comparto y Reflexiono). Sus anexos horizontal y vertical corresponden a `P10.4` y `P10.5`.",
    contact: "programa.jovenes@scouts.org.mx"
  },
  P6: {
    name: "Plantillas de Escenarios de Aprendizaje, Actas y Ciclo de Programa",
    desc: "Formatos para Fichas de Evento (`P6.1`), Fichas de Proyecto (`P6.2`), Programa de Actividades (`P6.3`), Acta de Consejo de Nivel y Corte de Honor (`P6.4`) y Ciclo de Programa (`P6.5`).",
    contact: "programa.jovenes@scouts.org.mx"
  },
  P7: {
    name: "Plantillas Auxiliares para el Registro de Progresión Personal",
    desc: "Tablas auxiliares para que el equipo de Scouters lleve el registro de progresión de Manada (`P7.1`), Tropa (`P7.2`), Comunidad (`P7.3`) y Clan (`P7.4`).",
    contact: "programa.jovenes@scouts.org.mx"
  },
  P8: {
    name: "Formatos para Solicitud de Insignias del Marco Mundo Mejor 2026",
    desc: "Formatos digitales oficiales publicados en RECME para tramitar reconocimientos de Mundo Mejor / Tribu de la Tierra (se llenan en digital, sin imprimir, y se tramitan conforme a `ASMAC/DNME/CNPJ/26.005`).",
    contact: "mundo.mejor@scouts.org.mx"
  },
  P9: {
    name: "Formatos de Solicitud de Insignia Final / Terminal y Ciclo de Programa 2026",
    desc: "Solicitudes oficiales de Insignia Final (`P9.1` Alfa, `P9.2` Águila Real, `P9.3` Everest), Insignia Terminal (`P9.4` Baden Powell) en versiones Obsidiana/Jade (`DNME-CNPJ 26.011`) y formato de Ciclo de Programa 2026 (`P9.5`).",
    contact: "insignias.cnpj@scouts.org.mx"
  },
  P10: {
    name: "Formación de Adultos (CNAMS) y Anexos para Fichas de Especialidad",
    desc: "Documentos de formación de adultos (Ficha de Planeación Didáctica `P10.2`, Cartas de Acompañamiento Formativo `P10.6` y `P10.7`) y anexos horizontal/vertical de Especialidades (`P10.4` y `P10.5`).",
    contact: "programa.jovenes@scouts.org.mx"
  }
};

function cleanDocExcerpt(rawText, docTitle = "") {
  let t = String(rawText || "")
    .replace(/\[Pág\.\s*\d+\]\s*/g, "")
    .replace(/DOCUMENTO OFICIAL ASMAC:[^\n]*/gi, "")
    .replace(/_{4,}/g, "___")
    .replace(/\s+/g, " ")
    .trim();
  if (docTitle && t.toLowerCase().startsWith(docTitle.toLowerCase())) {
    t = t.slice(docTitle.length).replace(/^[\s:–—-]+/, "").trim();
  }
  return t;
}

function buildExecutiveDocCard(doc, siblings = []) {
  const codeTag = doc.code ? ` (\`${doc.code}\`)` : "";
  const lines = [
    `### ${doc.title}${codeTag}`,
    "",
    "**Ficha oficial en BiblioTech Scout (basada en el documento original):**",
    `- **Archivo oficial:** \`${doc.filename}\`${doc.ext ? ` (${doc.ext}` : ""}${doc.page_count > 1 ? `, ${doc.page_count} páginas` : ""}${doc.size_label ? `, ${doc.size_label}` : ""}${doc.ext ? ")" : ""}`,
    `- **Clasificación:** ${doc.category}${doc.subcategory ? ` → ${doc.subcategory}` : ""} · **Sección:** ${doc.section_label || "General"} · **Año:** ${doc.year || "Vigente"}`
  ];
  if (doc.code) {
    const pMatch = doc.code.match(/^(P\d+)/i);
    const seriesInfo = pMatch ? BT_RECME_SERIES_INFO[pMatch[1].toUpperCase()] : null;
    if (seriesInfo) {
      lines.push(`- **Serie oficial RECME:** \`${pMatch[1].toUpperCase()}\` — ${seriesInfo.name}. ${seriesInfo.desc}`);
    }
  }
  const cleanSummary = cleanDocExcerpt(doc.summary || "", doc.title);
  if (cleanSummary && cleanSummary.length > 25) {
    lines.push("", "**Qué contiene y para qué sirve (resumen documental):**", cleanSummary.slice(0, 620));
  }
  const docChunks = (STATE.webChunks || []).filter((c) => c[0] === doc.id).slice(0, 2);
  const excerptParts = [];
  for (const [, pageNum, raw] of docChunks) {
    const cleaned = cleanDocExcerpt(raw, doc.title);
    if (cleaned && cleaned.length > 40 && !cleanSummary.toLowerCase().includes(cleaned.slice(0, 60).toLowerCase())) {
      excerptParts.push(`- *(Pág. ${pageNum})* ${cleaned.slice(0, 360)}${cleaned.length > 360 ? "…" : ""}`);
    }
  }
  if (excerptParts.length) {
    lines.push("", "**Extracto literal del archivo oficial:**", ...excerptParts);
  }
  if (siblings.length) {
    lines.push("", "**Otros documentos oficiales de la misma serie:**");
    for (const s of siblings.slice(0, 6)) {
      lines.push(`- **\`${s.code || s.ext}\`** — ${s.title}`);
    }
  }
  lines.push(
    "",
    "**Cómo abrirlo o descargarlo:** Pulsa la tarjeta del documento justo debajo en **Fuentes oficiales**, o busca el código en la sección **Biblioteca** / **Catálogo**."
  );
  return lines.join("\n");
}

function matchDocumentOrCodeOverview(query) {
  const raw = String(query || "").trim();
  const qNorm = normalizeQuestionKey(raw);
  if (!qNorm) return null;
  const wordCount = qNorm.split(/\s+/).filter(Boolean).length;

  // Caso 0: RECME 23 / RECME 2.0 (fichas históricas anteriores al PJOS alojadas en /phocadownload/)
  if (/\brecme\s*23\b|\brecme\s*2\s*0\b|\bphocadownload\b/.test(qNorm)) {
    const faesTemplates = STATE.documents.filter((d) => /^P4\./i.test(String(d.code || "")));
    const sources = faesTemplates.slice(0, 5).map((d) => ({
      doc_id: d.id, title: d.title, filename: d.filename, ext: d.ext, year: d.year, page_start: 1
    }));
    const text = [
      "### ¿Qué son las fichas `RECME23` (RECME 2.0) y por qué ya no aparecen listadas en la Biblioteca Virtual?",
      "",
      "- **Origen documental:** Los archivos con nomenclatura `RECME23_AES_*` (rotulados como *«Ficha de Actividad RECME 2.0»*, 2023) pertenecen a la **versión anterior de la plataforma RECME**, previa a la migración completa al **Programa de Jóvenes Orientado a la Sustentabilidad (PJOS)**.",
      "- **Por qué parecen «ocultos»:** Al actualizar la Biblioteca Virtual de RECME (`recme.scouts.org.mx/biblioteca-virtual/`), la ASMAC retiró del listado público las fichas `RECME23` y las reemplazó por las **Fichas de Acciones Educativas Scouts (`FAES`)** y las **Fichas de Especialidades Scouts (`FES`)** organizadas por sección y eje temático; algunos PDFs antiguos permanecen únicamente como enlaces directos en `/phocadownload/`.",
      "- **Qué usar actualmente en el PJOS 2026:** En BiblioTech Scout tienes respaldadas las **220 FAES vigentes**, las **82 FES oficiales** y las plantillas **`P4.1`**, **`P4.2`** y **`P4.3`** para elaborar nuevas acciones educativas.",
      "- **Si requieres un archivo histórico específico:** Puedes solicitarlo o confirmar su vigencia ante la Comisión Nacional de Programa de Jóvenes en `programa.jovenes@scouts.org.mx` o en el **Help Desk ASMAC**."
    ].join("\n");
    return { query, answer_markdown: text, sources };
  }

  // Caso 0B: Equivalencias internacionales Scout (Eagle Scout, Merit Badges, BSA, Cub Scouts, Venturing, Queen's/King's Scout)
  if (
    /\b(?:eagle\s*scout|merit\s*badges?|cub\s*scouts?|webelos|arrow\s*of\s*light|boy\s*scouts?(?:\s+of\s+america)?|scouts?\s+bsa|scouting\s+america|venturing|sea\s*scouts?|queen\s*s?\s*scout|king\s*s?\s*scout|equivalencia.*(?:eagle|bsa|usa|estados\s+unidos))\b/i.test(
      qNorm
    )
  ) {
    const eqDocs = STATE.documents.filter((d) => /^(?:P9\.[1-4]|P5\.1|P1\.0\.1)$/i.test(String(d.code || "")));
    const sources = eqDocs.slice(0, 6).map((d) => ({
      doc_id: d.id,
      title: d.title,
      filename: d.filename,
      ext: d.ext,
      year: d.year,
      page_start: 1
    }));
    const text = [
      "### Equivalencias Internacionales en Scouts de México (`ASMAC · PJOS 2026`)",
      "",
      "Las progresiones e insignias pertenecen a cada Organización Scout Nacional miembro de la **OMMS / WOSM**, pero por rango de edad y nivel formativo corresponden en la **Asociación de Scouts de México, A.C. (ASMAC)** a:",
      "",
      "- **Cub Scouts / Webelos / Arrow of Light (`7–10` años):** Equivale a **Manada de Lobatos** (`7 a 10` años). Su máximo reconocimiento de sección es la **Insignia Alfa** (Formato **`P9.1`**).",
      "- **Scouts BSA (`11–14` años):** Equivale a **Tropa de Scouts** (`10 a 14` años). Su reconocimiento máximo de sección es la **Insignia Final Águila Real** (Formato **`P9.2`**).",
      "- **Venturing / Sea Scouts (`14–18` años):** Equivale a **Comunidad de Caminantes** (`14 a 18` años). Su reconocimiento máximo de sección es la **Insignia Everest** (Formato **`P9.3`**).",
      "- **Eagle Scout / Queen's o King's Scout (máximo grado juvenil internacional):** En México culmina el recorrido juvenil con las **Insignias Finales y Terminales**, cerrando en **Clan de Rovers** (`18 a 22` años) con la **Horquilla / Insignia Baden Powell** (Formato **`P9.4`**; y en Tropa el equivalente nominal por emblema es la **Insignia Águila Real `P9.2`**).",
      "- **Merit Badges (Insignias de Mérito):** Equivalen a las **82 Especialidades Scouts (`FES`)** del PJOS y a la serie editable **`P5.1–P5.6`**.",
      "",
      "**¿Cómo revalidar o ubicar a alguien que viene de otro país?** Se aplica el diagnóstico inicial por competencias con los formatos **`P1.0.1`** / **`P1.1–P1.4`** junto al Consejo de Sección.",
      "",
      "*Puedes abrir abajo en **Fuentes oficiales** los formatos `P9.1–P9.4`, `P5.1` y `P1.0.1` o llenarlos directamente en **Editor de Archivos**.*"
    ].join("\n");
    return { query, answer_markdown: text, sources };
  }

  // Solo activar el resolvedor directo de códigos en consultas cortas o explícitas de código/archivo (<= 7 palabras)
  if (wordCount > 7) return null;
  const isCodeQuestion =
    /^(?:que es|que significa|para que sirve|donde encuentro|donde esta|plantilla|formato|archivo|documento|comunicado|recme|serie|codigo|clave|folio)?\s*(?:el|la|de|del|en)?\s*(?:recme\s+)?(?:p\d+(?:\.\d+)*|jl\d+|(?:asmac[\s\/\-]*)?(?:dnme|jsn|cnpj|sjsn)[\s\/\-]*(?:cnpj[\s\/\-]+)?\d{2}\.\d{2,3})\b/i.test(raw) ||
    /\b(?:p\d+\.\d+(?:\.\d+)?|jl\d{3}|(?:dnme|jsn|cnpj)[\s\/\-]+(?:cnpj[\s\/\-]+)?\d{2}\.\d{2,3})\b/i.test(raw);
  if (!isCodeQuestion) return null;

  // 1) Detectar código P1..P10+ (ej. P8.6, P8.8, P9.2, P11, P12, P3.3.2, o solo serie P8)
  const pCodeMatch = raw.match(/\b(P\d{1,2}(?:\.\d+)*)\b/i);
  if (pCodeMatch) {
    const codeUpper = pCodeMatch[1].toUpperCase();
    const seriesKey = codeUpper.split(".")[0];
    const seriesDocs = STATE.documents
      .filter((d) => {
        const dc = String(d.code || "").toUpperCase();
        return dc === seriesKey || dc.startsWith(`${seriesKey}.`);
      })
      .sort((a, b) => String(a.code || "").localeCompare(String(b.code || ""), "es", { numeric: true }));

    // Coincidencia exacta de código en catálogo
    const exactDocs = seriesDocs.filter((d) => String(d.code || "").toUpperCase() === codeUpper);
    if (exactDocs.length) {
      const primary = exactDocs[0];
      const siblings = seriesDocs.filter((d) => d.id !== primary.id);
      const sources = [primary, ...siblings.slice(0, 4)].map((d) => ({
        doc_id: d.id, title: d.title, filename: d.filename, ext: d.ext, year: d.year, page_start: 1
      }));
      return { query, answer_markdown: buildExecutiveDocCard(primary, siblings), sources };
    }

    // Serie completa o folio inexistente / fuera de rango (P8.8, P9.6, P1.5, P2.5, etc.)
    const seriesInfo = BT_RECME_SERIES_INFO[seriesKey];
    if (seriesInfo) {
      const isSpecificFolio = codeUpper.includes(".");
      const activeCodes = seriesDocs.map((d) => String(d.code || "").toUpperCase()).filter(Boolean);
      const rangeNote =
        activeCodes.length > 1
          ? ` El rango oficial publicado y activo en la serie \`${seriesKey}\` abarca únicamente de **\`${activeCodes[0]}\`** a **\`${activeCodes[activeCodes.length - 1]}\`** (${activeCodes.length} documentos vigentes).`
          : "";
      const lines = [
        isSpecificFolio
          ? `### Código \`${codeUpper}\` — Fuera de rango o no publicado en la serie \`${seriesKey}\` de RECME`
          : `### Serie \`${seriesKey}\` en RECME — ${seriesInfo.name}`,
        ""
      ];
      if (isSpecificFolio) {
        lines.push(
          `**Verificación en el catálogo oficial:** En la Biblioteca Virtual oficial de **RECME** (ASMAC) al corte del **22 de noviembre de 2026**, el folio **\`${codeUpper}\`** corresponde por prefijo a la **serie \`${seriesKey}\` (${seriesInfo.name})**, pero **no existe ni aparece publicado en el acervo oficial**.${rangeNote}`
        );
      } else {
        lines.push(`En la plataforma **RECME** (ASMAC), la **serie \`${seriesKey}\`** agrupa las **${seriesInfo.name}**: ${seriesInfo.desc}`);
      }
      if (seriesDocs.length) {
        lines.push("", `**Documentos oficiales que SÍ existen y están publicados en la serie \`${seriesKey}\` (${seriesDocs.length} archivos):**`);
        for (const d of seriesDocs) {
          lines.push(`- **\`${d.code}\`** — ${d.title} (\`${d.filename}\`)`);
        }
      }
      lines.push(
        "",
        "**¿Cómo confirmar si existe o solicitar un folio faltante?**",
        `- Escribe a la comisión correspondiente (**\`${seriesInfo.contact}\`**) indicando el código exacto (\`${codeUpper}\`) y tu sección o Grupo, o levanta un ticket en el **Help Desk ASMAC** (\`soporte.scouts.org.mx\`).`,
        `- Mientras tanto, puedes abrir y descargar cualquiera de los formatos vigentes de la serie \`${seriesKey}\` directamente desde las **Fuentes oficiales** de abajo.`
      );
      const sources = seriesDocs.slice(0, 6).map((d) => ({
        doc_id: d.id, title: d.title, filename: d.filename, ext: d.ext, year: d.year, page_start: 1
      }));
      return { query, answer_markdown: lines.join("\n"), sources };
    }

    // Serie inexistente fuera del rango P1-P10 (ej. P11, P12, P15, P0)
    const seriesSummary = Object.entries(BT_RECME_SERIES_INFO)
      .map(([k, v]) => `- **\`${k}\`**: ${v.name}`)
      .join("\n");
    const sampleDocs = STATE.documents.filter((d) => /^P\d+\./i.test(String(d.code || ""))).slice(0, 6);
    const lines = [
      `### Código \`${codeUpper}\` — Serie fuera del rango oficial RECME (\`P1\` a \`P10\`)`,
      "",
      `**Verificación oficial:** La nomenclatura de plantillas PJOS en **RECME** (ASMAC) contempla únicamente **10 series oficiales numeradas de \`P1\` a \`P10\`**. El código **\`${codeUpper}\`** no forma parte de la numeración pública vigente.`,
      "",
      "**Series oficiales vigentes en RECME (`P1` a `P10`):**",
      seriesSummary,
      "",
      "*Si buscas algún formato oficial por tema (diagnóstico, evaluación, progresión, FAES, especialidades, campamento, actas o insignias), escríbelo con palabras o usa el **Asistente en 3 pasos** dentro de **Editor de Archivos**.*"
    ];
    const sources = sampleDocs.map((d) => ({
      doc_id: d.id, title: d.title, filename: d.filename, ext: d.ext, year: d.year, page_start: 1
    }));
    return { query, answer_markdown: lines.join("\n"), sources };
  }

  // 2) Detectar código JL304 o comunicados DNME / JSN / CNPJ (ej. "jl304", "dnme 26.007", "jsn 25.136")
  const otherCodeMatch = raw.match(/\b(JL\d{3}|(?:DNME|JSN|CNPJ|SJSN)[\s\/\-]+(?:CNPJ[\s\/\-]+)?\d{2}\.\d{2,3})\b/i);
  if (otherCodeMatch) {
    const needleNorm = normalizeStr(otherCodeMatch[1]).replace(/[^a-z0-9]/g, "");
    const numOnly = (otherCodeMatch[1].match(/\d{2}\.\d{2,3}/) || [""])[0];
    const matched = STATE.documents.filter((d) => {
      const codeStr = normalizeStr(`${d.code || ""} ${d.filename || ""} ${d.title || ""}`);
      const compact = codeStr.replace(/[^a-z0-9]/g, "");
      if (compact.includes(needleNorm)) return true;
      if (numOnly && codeStr.includes(numOnly) && /dnme|jsn|cnpj|sjsn/i.test(codeStr)) return true;
      return false;
    });
    if (matched.length) {
      const primary = matched[0];
      const siblings = matched.slice(1, 5);
      const sources = [primary, ...siblings].map((d) => ({
        doc_id: d.id, title: d.title, filename: d.filename, ext: d.ext, year: d.year, page_start: 1
      }));
      return { query, answer_markdown: buildExecutiveDocCard(primary, siblings), sources };
    }
    // Comunicado DNME/JSN no publicado en el acervo
    if (numOnly) {
      const prefix = (otherCodeMatch[1].match(/DNME|JSN|CNPJ|SJSN/i) || ["ASMAC"])[0].toUpperCase();
      const sameYear = STATE.documents
        .filter((d) => new RegExp(`${prefix}.*${numOnly.slice(0, 3)}`, "i").test(`${d.code || ""} ${d.filename || ""}`))
        .slice(0, 6);
      const lines = [
        `### Comunicado \`${otherCodeMatch[1].toUpperCase()}\` — No encontrado en el acervo actual`,
        "",
        `**Nota de transparencia documental:** El folio **\`${otherCodeMatch[1].toUpperCase()}\`** no se encuentra publicado en el acervo oficial respaldado de BiblioTech Scout al **22 de noviembre de 2026** (puede corresponder a un comunicado de uso interno, a una actualización aún no difundida o a un folio pendiente de incorporar).`,
        "",
        "**¿Cómo solicitarlo o confirmar su vigencia?**",
        "- Consulta en el portal oficial de Comunicados de ASMAC (`scouts.org.mx`) o escribe a `programa.jovenes@scouts.org.mx` / `oficina.nacional@scouts.org.mx`.",
        "- Si cuentas con el PDF oficial emitido por la ASMAC, puedes enviarlo a través del botón **Aportar / Reportar** para integrarlo en BiblioTech Scout."
      ];
      if (sameYear.length) {
        lines.push("", `**Comunicados vigentes de la misma serie (${prefix}) disponibles en BiblioTech:**`);
        for (const d of sameYear) {
          lines.push(`- **\`${d.code || d.year}\`** — ${d.title}`);
        }
      }
      const sources = sameYear.map((d) => ({
        doc_id: d.id, title: d.title, filename: d.filename, ext: d.ext, year: d.year, page_start: 1
      }));
      return { query, answer_markdown: lines.join("\n"), sources };
    }
  }

  return null;
}

function detectMissingFesOrMembershipQuery(query) {
  const qNorm = normalizeStr(query || "");
  if (!qNorm) return null;

  // A) Especialidades FES consultadas pero inexistentes en las 81 fichas oficiales (ej. matemáticas, números, física, robótica)
  const asksFes = /\b(ficha|especialidad|especialidades|fes|p5)\b/.test(qNorm);
  const nonExistentFesMatch = qNorm.match(
    /\b(matematicas|matematica|numeros|numero|algebra|calculo|geometria|fisica|quimica|robotica|programacion|ajedrez|astronomia|biologia)\b/
  );
  if (asksFes && nonExistentFesMatch) {
    const topicWord = nonExistentFesMatch[1];
    const hasExactDoc = (STATE.documents || []).some(
      (d) =>
        normalizeStr(d.category || "").includes("especialidades scouts") &&
        normalizeStr(d.title || "").includes(topicWord)
    );
    if (!hasExactDoc) {
      const pickIds = ["doc-0695", "doc-0775", "doc-0799", "doc-0777", "doc-0654", "doc-0751"];
      const sources = pickIds
        .map((id) => STATE.docsById[id])
        .filter(Boolean)
        .map((d) => ({
          doc_id: d.id,
          title: d.title,
          filename: d.filename,
          ext: d.ext,
          year: d.year,
          page_start: 1
        }));
      const md = [
        `### Especialidad de «${topicWord}» en el catálogo oficial FES (2026)`,
        "",
        `Entre las **81 Especialidades Scouts (\`FES\`) vigentes publicadas por la ASMAC**, **no existe actualmente una ficha específica de «${topicWord}»** ni de matemáticas puras.`,
        "",
        "**Alternativas oficiales ya publicadas que más se acercan:**",
        "- **Guardián de la Moneda** (*Manada* `doc-0775` y *Tropa* `doc-0799`): finanzas, presupuesto y cálculo aplicado.",
        "- **Organizo mi tiempo / Dueño de mi tiempo / Gestiono mi tiempo** (`doc-0779`, `doc-0801`, `doc-0654`): planeación cuantitativa y métricas.",
        "- **Meteorólogo** (*Manada* `doc-0777`): medición de clima, lluvia y temperatura.",
        "",
        "**¿Puedo cursar una Especialidad personalizada de Matemáticas?**",
        "- Sí: utiliza la **Plantilla oficial `P5.1 — Ficha de Especialidad Scout (FES Editable v1.1)`** junto con un **sinodal** calificado y preséntala a tu Consejo de Sección (puedes llenarla directamente en el **Editor de Archivos** de BiblioTech)."
      ].join("\n");
      return { query, answer_markdown: md, sources };
    }
  }

  // B) Participar sin pertenecer a un Grupo Scout teniendo vigencia activa
  const asksWithoutGroup =
    /\bsin\s+(?:pertenecer\s+a\s+un\s+|tener\s+|estar\s+en\s+un\s+)?grupo\b/.test(qNorm) &&
    /\b(participar|vigencia|activo|activa|actividad|actividades|evento|eventos|scout|membresia)\b/.test(qNorm);
  if (asksWithoutGroup) {
    const pickIds = ["doc-0438", "doc-0431", "doc-0730", "doc-0727", "doc-0225"];
    const sources = pickIds
      .map((id) => STATE.docsById[id])
      .filter(Boolean)
      .map((d) => ({
        doc_id: d.id,
        title: d.title,
        filename: d.filename,
        ext: d.ext,
        year: d.year,
        page_start: 1
      }));
    const md = [
      "### Participar con vigencia activa sin pertenecer a un Grupo Scout (`Estatutos` y `Reglamento 2023`)",
      "",
      "De acuerdo con los **Estatutos 2023 (Art. 14)** y el **Reglamento 2023 (Art. 22, 23 y 28)** de la ASMAC:",
      "",
      "1. **Derechos de registro vigente (Art. 28):** mientras tu registro anual en **SISAS** esté pagado y tu credencial aparezca vigente (sin sanción activa), conservas el derecho de ostentarte como miembro y participar en actividades y eventos cubriendo su cuota.",
      "2. **Requisito de Miembro Activo (Estatutos Art. 14):** formalmente los jóvenes participan en una sección de un **Grupo Scout** y los dirigentes con cargo en Grupo, Provincia o Nacional.",
      "3. **Qué debes hacer si ya tienes vigencia pero te quedaste sin Grupo o cambiaste de residencia:**",
      "   - Solicita un **Cambio de Grupo en SISAS** (`doc-0730`, se aprueba por 2 autoridades de tu grupo anterior y 2 del nuevo, hasta 30 días).",
      "   - Si no tienes grupo receptor aún, comunícate con tu **Provincia Scout** o con la **Oficina Scout Nacional** (`(55) 5208 7122` / `soporte.scouts.org.mx`) para orientar tu adscripción o participación en eventos nacionales.",
      "   - Para eventos en **SISAS → Mis eventos** (`doc-0727`), verifica que tu perfil esté validado al 100% y tu Ficha de Salud actualizada."
    ].join("\n");
    return { query, answer_markdown: md, sources };
  }

  const asksManadaProgressionWork =
    /\bmanada\b/.test(qNorm) &&
    /\b(progresion|progresiones|cazadero|cazaderos|etapa|etapas)\b/.test(qNorm) &&
    /\b(como|trabajo|trabajar|trabajan|inicio|empiezo|funcionan|evaluo|evaluan|pasos|guia)\b/.test(qNorm);
  if (asksManadaProgressionWork) {
    const pickIds = ["doc-0408", "doc-0295", "doc-0672", "doc-0683"];
    const sources = pickIds
      .map((id) => STATE.docsById[id])
      .filter(Boolean)
      .map((d) => ({
        doc_id: d.id,
        title: d.title,
        filename: d.filename,
        ext: d.ext,
        year: d.year,
        page_start: 1
      }));
    const md = [
      "### Cómo trabajar las progresiones en Manada de Lobatos (`PJOS`)",
      "",
      "De acuerdo con la **Guía de Scouter de Manada de Lobatos 2024** (`doc-0408`) y **Mis Rastros en la Selva** (`doc-0295` / `Manual del Uniforme 2026`), las progresiones en Manada (6 a 10 años) se trabajan por **Ciclos de Programa** llamados **Gran Cacería**:",
      "",
      "1. **Diagnóstico Inicial (`P1.0.1` y `P1.1`):** al ingresar o iniciar ciclo, el equipo de Viejos Lobos identifica las necesidades del lobato respecto a las competencias (**Presas**) y sus elementos (**Dentelladas**).",
      "2. **Etapa Inicial — Mi Primer Rastro:** insignia en el cubil mientras conoce el Marco Simbólico de la Selva del Seeonee y formula su Promesa.",
      "3. **Los 4 Cazaderos (Progresión por Eje Temático):**",
      "   - **Cazadero Raksha:** *Salud y Bienestar*.",
      "   - **Cazadero Bagheera:** *Habilidades para la Vida*.",
      "   - **Cazadero Hermano Gris:** *Medio Ambiente y Sustentabilidad*.",
      "   - **Cazadero Baloo:** *Paz y Participación Comunitaria*.",
      "4. **Seguimiento y registro:** las actividades (**Rastros**) se registran en **Mi Libro del Seeonee** (`P3`) y el Scouter evalúa los avances en la **Cédula Auxiliar `P2.1`**.",
      "5. **Complementos e Insignia Terminal:** **Especialidades** (Cuerpo de Kaa), **Aventuras en la Naturaleza** (`Mohwa`, `Dhak`, `Flor Roja`, `Tregua del agua`) y **Insignia Final Alfa (`P9.1`, Jade u Obsidiana)** antes de su enlace a Tropa."
    ].join("\n");
    return { query, answer_markdown: md, sources };
  }

  return null;
}

function answerLocallyInBrowser(query, _allowTypoRetry = true) {
  const normalizedPhraseQuery = String(query || "").replace(
    /\bcon trabajo\b(?=\s+(?:la|las|el|los|mi|mis)?\s*(?:progresion|progresiones|especialidad|especialidades|cazadero|cazaderos|rumbo|sendero|ruta|manada|tropa|comunidad|clan))/i,
    "cómo trabajo"
  );
  if (_allowTypoRetry && normalizedPhraseQuery !== String(query || "")) {
    const retry = answerLocallyInBrowser(normalizedPhraseQuery, false);
    return { ...retry, query, correctedQuery: normalizedPhraseQuery };
  }
  const qClean = normalizeQuestionKey(query);
  const missingDetector = detectMissingFesOrMembershipQuery(query);
  if (missingDetector) {
    return missingDetector;
  }
  const codeOverview = matchDocumentOrCodeOverview(query);
  if (codeOverview) {
    return codeOverview;
  }
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
    appendRelatedSources(qSources, exactQ, 5);
    return {
      query,
      answer_markdown: exactQ.ans,
      sources: qSources
    };
  }

  if (exactQ && exactQ.doc_id && STATE.docsById[exactQ.doc_id] && !exactQ.topic_id) {
    const doc = STATE.docsById[exactQ.doc_id];
    const docSources = [
      {
        doc_id: doc.id,
        title: doc.title,
        filename: doc.filename,
        ext: doc.ext,
        year: doc.year,
        page_start: exactQ.page || 1
      }
    ];
    appendRelatedSources(docSources, exactQ, 5);
    return {
      query,
      answer_markdown: buildDocSpecificAnswerInBrowser(doc),
      sources: docSources
    };
  }

  let engine = buildAnswerLocally(query);

  if (_allowTypoRetry && engine.kind !== "exact") {
    const typoFix = correctQueryTypos(query);
    if (typoFix.wasCorrected && typoFix.correctedQuery) {
      const retryAns = answerLocallyInBrowser(typoFix.correctedQuery, false);
      const retryHasStrongAnswer =
        retryAns &&
        retryAns.answer_markdown &&
        !/Información no disponible en el acervo actual/i.test(retryAns.answer_markdown);
      const needsCorrection =
        engine.kind === "none" ||
        (engine.kind === "qa" && (engine.qa?.coverage || 0) < 0.78) ||
        engine.kind === "topic";
      if (retryHasStrongAnswer && needsCorrection) {
        return {
          ...retryAns,
          query,
          correctedQuery: typoFix.correctedQuery
        };
      }
    }
  }
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
    appendRelatedSources(qSources, engine.item, 5);
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

  if (typeof BtSpeechReader !== "undefined") BtSpeechReader.stop();
  STATE.currentAnswerSnapshot = {
    query: queryText || "",
    markdown: (data && data.answer_markdown) || "",
    plainText: summarizeMarkdownPlain((data && data.answer_markdown) || "", 12000),
    sources: (data && data.sources) || []
  };

  const typoBanner =
    data && data.correctedQuery
      ? `<div class="bt-typo-banner" role="status">Mostrando resultados para <strong>«${escapeHtml(data.correctedQuery)}»</strong> <span class="bt-typo-sub">(consulta corregida automáticamente)</span></div>`
      : "";
  bodyEl.innerHTML = typoBanner + renderMarkdown((data && data.answer_markdown) || "");

  const sources = data.sources || [];
  updateAnswerFeedbackUI(queryText, data, sources.length);
  if (!sources.length) {
    sourcesEl.innerHTML = `<span style="font-size:0.82rem;color:#64748b;">Consulta directa en el índice de documentos oficiales de BiblioTech.</span>`;
    return;
  }

  sourcesEl.innerHTML = sources
    .map((s) => {
      const meta = STATE.docsById[s.doc_id];
      const codeBadge = meta && meta.code ? `<span class="source-pill-code">${escapeHtml(meta.code)}</span>` : "";
      return `
      <button type="button" class="source-bottom-pill" data-open-doc="${escapeHtml(s.doc_id)}">
        <span class="source-pill-ext">${escapeHtml(s.ext || "PDF")}</span>
        ${codeBadge}
        <strong>${escapeHtml(s.title)}</strong>
        <span class="source-pill-year">${s.year || ""}${s.page_start ? ` • Pág. ${s.page_start}` : ""}</span>
      </button>
    `;
    })
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
// CATALOGO GENERAL Y FILTROS (883 DOCUMENTOS OFICIALES DESCARGABLES)
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
  const { q, tokens } = extractDocSearchTokens(STATE.searchQuery);

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
      const tagsStr = Array.isArray(d.tags) ? d.tags.join(" ") : "";
      const odsStr = Array.isArray(d.ods) ? d.ods.join(" ") : "";
      const codeRaw = String(d.code || "");
      const codeExpanded = `${codeRaw} ${codeRaw.replace(/[\/\-\._]+/g, " ")} ${codeRaw.replace(/[^a-z0-9]/gi, "")}`;
      const hay = normalizeStr(`${d.title} ${d.filename} ${codeExpanded} ${d.category} ${d.subcategory || ""} ${d.section_label} ${d.summary || ""} ${tagsStr} ${odsStr}`);
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
    if (tokens.length && STATE.sortOrder === "recent") {
      const relDiff = scoreDocSearchRelevance(b, q, tokens) - scoreDocSearchRelevance(a, q, tokens);
      if (relDiff !== 0) return relDiff;
    }
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
  STATE.visibleCount = hasSearch ? 24 : 12;
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
  if (!slice.length) {
    const rawQ = STATE.searchQuery.trim();
    const askBridgeHtml =
      rawQ.length >= 4
        ? `<div class="bt-empty-ask-bridge">
            <p class="bt-empty-ask-hint">¿Buscabas responder una pregunta sobre <strong>«${escapeHtml(rawQ)}»</strong>?</p>
            <button type="button" class="bt-empty-ask-btn" data-ask-from-empty="${escapeHtml(rawQ)}">Preguntar esto en el Buscador Scout →</button>
          </div>`
        : "";
    grid.innerHTML = `<div class="bt-empty-filter-box" style="grid-column:1/-1;text-align:center;padding:2rem 1rem;color:#64748b;"><p>No se encontraron documentos oficiales con esos filtros.</p>${askBridgeHtml}</div>`;
    loadMoreBtn.classList.add("hidden");
    return;
  }
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
              ${d.code ? `<span class="badge badge-code" title="Nomenclatura oficial: ${escapeHtml(d.code)}">${escapeHtml(d.code)}</span>` : ""}
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
              ${
                Array.isArray(d.tags) && d.tags.length
                  ? `<div class="book-tags-row" aria-label="Etiquetas RECME">${d.tags
                      .slice(0, 4)
                      .map((t) => `<span class="book-tag-pill">${escapeHtml(String(t).replace(/_/g, " "))}</span>`)
                      .join("")}</div>`
                  : ""
              }
            </div>
          </div>
          <div class="doc-card-footer">
            <span style="font-size:0.74rem;color:#64748b;font-weight:600;">${escapeHtml(d.category)}${d.subcategory ? ` · ${escapeHtml(d.subcategory)}` : ""}</span>
            <div class="doc-actions">
              <button type="button" class="btn-doc-view" data-open-doc="${escapeHtml(d.id)}">Leer (${escapeHtml(sizeText)})</button>
              <a href="${dlUrl}" download="${escapeHtml(dlName)}" data-dl-doc="${escapeHtml(d.id)}" class="btn-doc-dl">Descargar</a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  if (total > STATE.visibleCount) {
    loadMoreBtn.classList.remove("hidden");
    loadMoreBtn.textContent = `Cargar más archivos (${total - STATE.visibleCount} restantes)`;
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

async function openDocumentModal(docId, shelfIndex = -1, targetPage = null) {
  const doc = STATE.docsById[docId];
  if (!doc) return;

  recordDocOpenTelemetry(doc);
  if (typeof window.__btRecordPaperlessImpact === "function") {
    window.__btRecordPaperlessImpact(Math.min(10, Math.max(1, Number(doc.page_count || 2))), `doc:${doc.id}`);
  }
  STATE.currentOpenDocId = docId;
  STATE.currentReadingIndex = shelfIndex;
  STATE.requestedDocPage = targetPage && Number(targetPage) > 0 ? Number(targetPage) : null;

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
  const docSizeLabel = getDocSizeLabel(doc);
  badgesEl.innerHTML = `
    <span class="badge badge-ext">${escapeHtml(doc.ext)}</span>
    <span class="badge badge-year">${doc.year}</span>
    <span class="badge badge-sec">${escapeHtml(doc.section_label)}</span>
    ${docSizeLabel ? `<span class="badge badge-size" title="Tamaño aproximado del archivo">${escapeHtml(docSizeLabel)}</span>` : ""}
    ${doc.code ? `<span class="badge badge-code" title="Nomenclatura oficial: ${escapeHtml(doc.code)}">${escapeHtml(doc.code)}</span>` : ""}
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
    const metaParts = [];
    if (doc.code) {
      metaParts.push(`<div class="modal-doc-meta-line"><strong>Nomenclatura oficial:</strong> <code class="bt-inline-code">${escapeHtml(doc.code)}</code></div>`);
    }
    if (descContent) {
      metaParts.push(`<div><strong>Contenido del documento:</strong> ${escapeHtml(descContent)}</div>`);
    }
    if (doc.recme_date) {
      metaParts.push(`<div class="modal-doc-meta-line"><strong>Fecha oficial en RECME:</strong> ${escapeHtml(doc.recme_date)}</div>`);
    }
    if (Array.isArray(doc.ods) && doc.ods.length) {
      metaParts.push(`<div class="modal-doc-meta-line"><strong>ODS a los que abona:</strong> ${escapeHtml(doc.ods.join(" · "))}</div>`);
    }
    if (Array.isArray(doc.tags) && doc.tags.length) {
      metaParts.push(
        `<div class="book-tags-row modal-doc-tags">${doc.tags
          .map((t) => `<span class="book-tag-pill">${escapeHtml(String(t).replace(/_/g, " "))}</span>`)
          .join("")}</div>`
      );
    }
    if (metaParts.length) {
      descEl.innerHTML = metaParts.join("");
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
  dlBtn.textContent = docSizeLabel ? `Descargar (${docSizeLabel})` : "Descargar";

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

  destroyActivePdfViewer();

  const isMobileUa =
    /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || "") ||
    IS_APPLE_TOUCH ||
    window.innerWidth < 860;
  const sizeMb = Number(doc.size_mb || 0);
  const sizeLabel = sizeMb >= 0.1 ? `${sizeMb.toFixed(1)} MB` : `${Math.max(1, Math.round(Number(doc.size_kb || 100)))} KB`;
  const isHeavyOrExternalPdf = !IS_LOCAL_SERVER && (doc.has_web_file !== true || sizeMb >= 12);
  const canEmbedDirectPdf = IS_LOCAL_SERVER || (doc.has_web_file === true && !isMobileUa && sizeMb < 12);

  if (doc.ext === "PDF") {
    const absPdfUrl = /^https?:\/\//i.test(viewUrl)
      ? viewUrl
      : new URL(viewUrl, window.location.href).href;
    const streamPdfUrl = buildPdfStreamUrl(doc, absPdfUrl);
    const gDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(absPdfUrl)}&embedded=true`;
    const canUseGDocs = !IS_LOCAL_SERVER && sizeMb < 24;
    const initialMode = canEmbedDirectPdf ? "direct" : "pdfjs";
    const canWebShare = typeof navigator.share === "function" && !window.Capacitor;
    const coverUrl = doc.sha12 ? `covers/${doc.sha12}.jpg` : "";

    const switchToTextTab = () => {
      document.querySelectorAll(".modal-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "text"));
      previewPane.classList.add("hidden");
      document.getElementById("modalTextPane").classList.remove("hidden");
    };

    const mountPdfMode = (mode) => {
      destroyActivePdfViewer();

      if (mode === "direct" || mode === "gdocs") {
        const targetSrc = mode === "direct" ? `${streamPdfUrl}#view=FitH` : gDocsUrl;
        const modeLabel =
          mode === "direct"
            ? `Visor PDF nativo (${sizeLabel})`
            : `Visor en la nube (${sizeLabel})`;
        previewPane.innerHTML = `
          <div class="pdf-quick-bar">
            <span class="pdf-quick-title">${escapeHtml(modeLabel)}</span>
            <div class="pdf-quick-actions">
              <button type="button" class="btn-pdf-toggle-mode" data-target-mode="pdfjs">Visor por Página (HD)</button>
              ${mode === "direct" && canUseGDocs ? `<button type="button" class="btn-pdf-toggle-mode" data-target-mode="gdocs">Google Docs</button>` : ""}
              ${mode === "gdocs" && !isMobileUa ? `<button type="button" class="btn-pdf-toggle-mode" data-target-mode="direct">Visor Nativo</button>` : ""}
              <a href="${streamPdfUrl}" target="_blank" rel="noopener">Abrir PDF en pestaña</a>
              ${canWebShare ? `<button type="button" class="btn-pdf-share">Compartir</button>` : ""}
              <button type="button" class="btn-pdf-switch-text">Cambiar a Texto</button>
            </div>
          </div>
          <iframe id="gDocsIframe" src="${targetSrc}" title="${escapeHtml(doc.title)}" class="doc-viewer-iframe" style="width:100%;height:calc(100% - 44px);min-height:540px;border:none;background:#ffffff;" allowfullscreen></iframe>
        `;
        const swBtn = previewPane.querySelector(".btn-pdf-switch-text");
        if (swBtn) swBtn.onclick = switchToTextTab;
        const shareBtn = previewPane.querySelector(".btn-pdf-share");
        if (shareBtn) {
          shareBtn.onclick = async () => {
            try {
              await navigator.share({ title: doc.title, url: absPdfUrl });
            } catch (_) {}
          };
        }
        previewPane.querySelectorAll(".btn-pdf-toggle-mode").forEach((btn) => {
          btn.onclick = () => mountPdfMode(btn.getAttribute("data-target-mode") || "pdfjs");
        });
        return;
      }

      // Modo "pdfjs": Visor interactivo por página con streaming HTTP Range (soporta archivos de 50 a 300+ MB)
      const token = (STATE.pdfViewerToken || 0) + 1;
      STATE.pdfViewerToken = token;
      const viewerState = {
        token,
        pdfDoc: null,
        loadingTask: null,
        renderTask: null,
        page: 1,
        numPages: Number(doc.page_count || 0) || 1,
        zoom: 1,
        timeoutId: null,
        onKeyDown: null,
        pageTextCache: new Map(),
        searchMatches: [],
        searchIdx: -1,
        initialRenderDone: false
      };
      STATE.activePdfViewer = viewerState;

      previewPane.innerHTML = `
        <div class="pdf-quick-bar pdf-quick-bar-interactive">
          <div class="bt-pdfjs-nav-group">
            <span class="bt-pdfjs-mode-pill">${isHeavyOrExternalPdf ? `Streaming HD · ${escapeHtml(sizeLabel)}` : `Visor por Página · ${escapeHtml(sizeLabel)}`}</span>
            <div class="bt-pdfjs-pager" role="group" aria-label="Navegación de páginas">
              <button type="button" id="btPdfPrev10Btn" class="bt-pdfjs-ctrl-btn bt-pdfjs-jump-btn" disabled aria-label="Retroceder 10 páginas" title="Retroceder 10 páginas">-10</button>
              <button type="button" id="btPdfPrevBtn" class="bt-pdfjs-ctrl-btn" disabled aria-label="Página anterior" title="Página anterior">Anterior</button>
              <label class="bt-pdfjs-page-label" for="btPdfPageInput">
                <span>Pág.</span>
                <input type="number" id="btPdfPageInput" class="bt-pdfjs-page-input" min="1" value="1" inputmode="numeric" aria-label="Ir a página" disabled />
                <span id="btPdfPageTotal">/ ${viewerState.numPages > 1 ? viewerState.numPages : "..."}</span>
              </label>
              <button type="button" id="btPdfNextBtn" class="bt-pdfjs-ctrl-btn" disabled aria-label="Página siguiente" title="Página siguiente">Siguiente</button>
              <button type="button" id="btPdfNext10Btn" class="bt-pdfjs-ctrl-btn bt-pdfjs-jump-btn" disabled aria-label="Avanzar 10 páginas" title="Avanzar 10 páginas">+10</button>
              <button type="button" id="btPdfBookmarkPageBtn" class="bt-pdfjs-ctrl-btn bt-pdfjs-bmk-btn" aria-pressed="false" title="Guardar marcador en esta página">Marcar pág.</button>
            </div>
            <div class="bt-pdfjs-zoom-group" role="group" aria-label="Zoom de página">
              <button type="button" id="btPdfZoomOutBtn" class="bt-pdfjs-ctrl-btn bt-pdfjs-icon-btn" aria-label="Alejar página" title="Alejar">−</button>
              <button type="button" id="btPdfZoomResetBtn" class="bt-pdfjs-ctrl-btn bt-pdfjs-zoom-label" title="Ajustar al 100%">100%</button>
              <button type="button" id="btPdfZoomInBtn" class="bt-pdfjs-ctrl-btn bt-pdfjs-icon-btn" aria-label="Acercar página" title="Acercar">+</button>
            </div>
            <div class="bt-pdfjs-search-group" role="search" aria-label="Buscar dentro del PDF">
              <input type="search" id="btPdfInDocSearch" class="bt-pdfjs-search-input" placeholder="Buscar en PDF..." aria-label="Buscar texto en este PDF" />
              <span id="btPdfInDocSearchCount" class="bt-pdfjs-search-count"></span>
              <button type="button" id="btPdfInDocSearchPrev" class="bt-pdfjs-ctrl-btn bt-pdfjs-icon-btn hidden" title="Coincidencia anterior" aria-label="Coincidencia anterior">↑</button>
              <button type="button" id="btPdfInDocSearchNext" class="bt-pdfjs-ctrl-btn bt-pdfjs-icon-btn hidden" title="Siguiente coincidencia" aria-label="Siguiente coincidencia">↓</button>
            </div>
            <span id="btPdfResumeBadge" class="bt-pdfjs-resume-pill hidden">
              <span id="btPdfResumeText"></span>
              <button type="button" id="btPdfJumpFirstBtn" class="bt-pdfjs-resume-reset" title="Volver a la página 1">Pág. 1</button>
            </span>
          </div>
          <div id="btPdfPageBookmarksBar" class="bt-pdfjs-bookmarks-bar hidden" aria-label="Marcadores de página en este PDF"></div>
          <div class="pdf-quick-actions">
            ${!isMobileUa ? `<button type="button" class="btn-pdf-toggle-mode" data-target-mode="direct" title="Abrir en el visor PDF integrado del navegador">Visor Nativo</button>` : ""}
            ${canUseGDocs ? `<button type="button" class="btn-pdf-toggle-mode" data-target-mode="gdocs" title="Abrir con Google Docs Viewer">Google Docs</button>` : ""}
            <a href="${streamPdfUrl}" target="_blank" rel="noopener">Abrir en pestaña</a>
            ${canWebShare ? `<button type="button" class="btn-pdf-share">Compartir</button>` : ""}
            <button type="button" class="btn-pdf-switch-text">Texto</button>
          </div>
        </div>
        <div class="bt-pdfjs-stage" id="btPdfStage">
          <div class="bt-pdfjs-status-card" id="btPdfStatusCard">
            ${coverUrl ? `<img src="${coverUrl}" alt="Portada de ${escapeHtml(doc.title)}" class="bt-pdfjs-status-cover" decoding="async" onerror="this.style.display='none'" />` : ""}
            <div class="bt-pdfjs-status-body">
              <span class="bt-pdfjs-status-kicker">VISTA PREVIA POR STREAMING · ${escapeHtml(sizeLabel)}</span>
              <h4 class="bt-pdfjs-status-title">${escapeHtml(doc.title)}</h4>
              <p class="bt-pdfjs-status-msg" id="btPdfStatusMsg">Cargando la primera página en alta definición sin descargar el archivo completo...</p>
              <div class="bt-pdfjs-progress-track" id="btPdfProgressTrack">
                <div class="bt-pdfjs-progress-fill" id="btPdfProgressFill" style="width: 18%;"></div>
              </div>
              <div class="bt-pdfjs-status-actions">
                <button type="button" class="btn-modal-secondary bt-pdfjs-instant-text">Leer Texto Completo ahora</button>
                <a href="${streamPdfUrl}" target="_blank" rel="noopener" class="btn-modal-secondary">Abrir PDF en pestaña</a>
                <a href="${dlUrl}" download="${escapeHtml(cleanDownloadFilename(doc))}" data-dl-doc="${escapeHtml(doc.id)}" class="btn-modal-primary">Descargar PDF (${escapeHtml(sizeLabel)})</a>
              </div>
            </div>
          </div>
          <div class="bt-pdfjs-canvas-wrap hidden" id="btPdfCanvasWrap">
            <canvas id="btPdfCanvas" class="bt-pdfjs-canvas"></canvas>
          </div>
        </div>
      `;

      const prev10Btn = previewPane.querySelector("#btPdfPrev10Btn");
      const prevPageBtn = previewPane.querySelector("#btPdfPrevBtn");
      const nextPageBtn = previewPane.querySelector("#btPdfNextBtn");
      const next10Btn = previewPane.querySelector("#btPdfNext10Btn");
      const bookmarkPageBtn = previewPane.querySelector("#btPdfBookmarkPageBtn");
      const bookmarksBar = previewPane.querySelector("#btPdfPageBookmarksBar");
      const pageInput = previewPane.querySelector("#btPdfPageInput");
      const pageTotalEl = previewPane.querySelector("#btPdfPageTotal");
      const zoomOutBtn = previewPane.querySelector("#btPdfZoomOutBtn");
      const zoomResetBtn = previewPane.querySelector("#btPdfZoomResetBtn");
      const zoomInBtn = previewPane.querySelector("#btPdfZoomInBtn");
      const inDocSearchInput = previewPane.querySelector("#btPdfInDocSearch");
      const inDocSearchCount = previewPane.querySelector("#btPdfInDocSearchCount");
      const inDocSearchPrev = previewPane.querySelector("#btPdfInDocSearchPrev");
      const inDocSearchNext = previewPane.querySelector("#btPdfInDocSearchNext");
      const resumeBadge = previewPane.querySelector("#btPdfResumeBadge");
      const resumeTextEl = previewPane.querySelector("#btPdfResumeText");
      const jumpFirstBtn = previewPane.querySelector("#btPdfJumpFirstBtn");
      const statusCard = previewPane.querySelector("#btPdfStatusCard");
      const statusMsg = previewPane.querySelector("#btPdfStatusMsg");
      const progressFill = previewPane.querySelector("#btPdfProgressFill");
      const progressTrack = previewPane.querySelector("#btPdfProgressTrack");
      const canvasWrap = previewPane.querySelector("#btPdfCanvasWrap");
      const canvas = previewPane.querySelector("#btPdfCanvas");
      const stageEl = previewPane.querySelector("#btPdfStage");

      previewPane.querySelectorAll(".btn-pdf-switch-text, .bt-pdfjs-instant-text").forEach((b) => {
        b.onclick = switchToTextTab;
      });
      const shareBtn = previewPane.querySelector(".btn-pdf-share");
      if (shareBtn) {
        shareBtn.onclick = async () => {
          try {
            await navigator.share({ title: doc.title, url: absPdfUrl });
          } catch (_) {}
        };
      }
      previewPane.querySelectorAll(".btn-pdf-toggle-mode").forEach((btn) => {
        btn.onclick = () => mountPdfMode(btn.getAttribute("data-target-mode") || "direct");
      });

      const showFallbackError = (reasonText) => {
        if (STATE.pdfViewerToken !== token) return;
        if (progressTrack) progressTrack.classList.add("hidden");
        if (statusCard) {
          statusCard.classList.remove("hidden");
          statusCard.classList.add("is-fallback");
        }
        if (statusMsg) {
          statusMsg.textContent =
            reasonText ||
            `Este documento pesa ${sizeLabel}. Puedes leer su texto completo aquí mismo al instante, abrir el PDF en una pestaña dedicada o descargarlo completo.`;
        }
        const actionsBox = statusCard ? statusCard.querySelector(".bt-pdfjs-status-actions") : null;
        if (actionsBox && !actionsBox.querySelector(".bt-pdfjs-retry-btn")) {
          const retryBtn = document.createElement("button");
          retryBtn.type = "button";
          retryBtn.className = "btn-modal-secondary bt-pdfjs-retry-btn";
          retryBtn.textContent = "Reintentar vista previa";
          retryBtn.onclick = () => mountPdfMode("pdfjs");
          actionsBox.prepend(retryBtn);

          if (typeof window.__btOpenBugReport === "function") {
            const repBtn = document.createElement("button");
            repBtn.type = "button";
            repBtn.className = "btn-modal-secondary bt-pdfjs-report-btn";
            repBtn.textContent = "Reportar problema";
            repBtn.onclick = () =>
              window.__btOpenBugReport({
                category: "Visor de archivos / PDF pesado",
                context: `Archivo: ${doc.title} (${doc.id}, ${sizeLabel})`,
              });
            actionsBox.appendChild(repBtn);
          }
        }
      };

      const renderPdfPageBookmarksBar = () => {
        if (!bookmarksBar) return;
        const docBmks = getPageBookmarks()
          .filter((b) => b.docId === doc.id)
          .sort((a, b) => Number(a.page) - Number(b.page));
        if (!docBmks.length) {
          bookmarksBar.classList.add("hidden");
          bookmarksBar.innerHTML = "";
          return;
        }
        bookmarksBar.classList.remove("hidden");
        bookmarksBar.innerHTML =
          `<span class="bt-pdfjs-bmk-label">${document.documentElement.dataset.btLang === "en" ? "Bookmarks:" : "Marcadores:"}</span>` +
          docBmks
            .map(
              (b) => `
              <span class="bt-pdfjs-bmk-chip${Number(b.page) === viewerState.page ? " is-current" : ""}">
                <button type="button" data-pdf-bmk-jump="${Number(b.page)}">Pág. ${Number(b.page)}</button>
                <button type="button" data-pdf-bmk-del="${Number(b.page)}" aria-label="Quitar marcador de página ${Number(b.page)}">&times;</button>
              </span>`
            )
            .join("");
      };

      const updateNavControls = () => {
        if (!viewerState.pdfDoc) return;
        if (prev10Btn) prev10Btn.disabled = viewerState.page <= 1;
        if (prevPageBtn) prevPageBtn.disabled = viewerState.page <= 1;
        if (nextPageBtn) nextPageBtn.disabled = viewerState.page >= viewerState.numPages;
        if (next10Btn) next10Btn.disabled = viewerState.page >= viewerState.numPages;
        if (bookmarkPageBtn) {
          const marked = isPageBookmarked(doc.id, viewerState.page);
          const isEn = document.documentElement.dataset.btLang === "en";
          bookmarkPageBtn.classList.toggle("is-bookmarked", marked);
          bookmarkPageBtn.setAttribute("aria-pressed", String(marked));
          bookmarkPageBtn.textContent = marked ? (isEn ? "Bookmarked" : "Marcada") : (isEn ? "Bookmark pg." : "Marcar pág.");
        }
        if (pageInput) {
          pageInput.disabled = false;
          pageInput.max = String(viewerState.numPages);
          pageInput.value = String(viewerState.page);
        }
        if (pageTotalEl) pageTotalEl.textContent = `/ ${viewerState.numPages}`;
        if (zoomResetBtn) zoomResetBtn.textContent = `${Math.round(viewerState.zoom * 100)}%`;
        renderPdfPageBookmarksBar();
      };

      const renderCurrentPage = async (pageNum, userInitiated = true) => {
        if (STATE.pdfViewerToken !== token || !viewerState.pdfDoc || !canvas) return;
        const prevPage = viewerState.page;
        const clamped = Math.max(1, Math.min(viewerState.numPages, Number(pageNum) || 1));
        viewerState.page = clamped;
        updateNavControls();
        savePdfPageProgress(doc.id, clamped, viewerState.numPages);

        if (userInitiated && viewerState.initialRenderDone && clamped !== prevPage && typeof BtSoundEngine !== "undefined") {
          BtSoundEngine.play("page");
        }
        if (resumeBadge && clamped === 1) {
          resumeBadge.classList.add("hidden");
        }

        if (viewerState.renderTask && typeof viewerState.renderTask.cancel === "function") {
          try {
            viewerState.renderTask.cancel();
          } catch (_) {}
        }

        try {
          if (statusMsg && !canvasWrap.classList.contains("hidden")) {
            // Indicador discreto al cambiar de página
          } else if (statusMsg) {
            statusMsg.textContent = `Renderizando página ${clamped} de ${viewerState.numPages}...`;
            if (progressFill) progressFill.style.width = "78%";
          }

          const pdfPage = await viewerState.pdfDoc.getPage(clamped);
          if (STATE.pdfViewerToken !== token) return;

          const baseViewport = pdfPage.getViewport({ scale: 1 });
          const availWidth = Math.max(
            280,
            Math.min(1040, (stageEl ? stageEl.clientWidth : window.innerWidth) - (window.innerWidth < 640 ? 20 : 48))
          );
          const fitScale = availWidth / Math.max(1, baseViewport.width);
          const isLite =
            document.documentElement.getAttribute("data-bt-visual") === "lite" ||
            document.documentElement.getAttribute("data-bt-perf") === "lite";
          const maxDpr = isLite ? 1.35 : Math.min(window.devicePixelRatio || 1, 2);
          const cssScale = fitScale * viewerState.zoom;
          const renderViewport = pdfPage.getViewport({ scale: cssScale * maxDpr });

          canvas.width = Math.max(1, Math.floor(renderViewport.width));
          canvas.height = Math.max(1, Math.floor(renderViewport.height));
          canvas.style.width = `${Math.floor(baseViewport.width * cssScale)}px`;
          canvas.style.height = `${Math.floor(baseViewport.height * cssScale)}px`;
          canvas.style.transform = "";

          const ctx = canvas.getContext("2d", { alpha: false });
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const task = pdfPage.render({
            canvasContext: ctx,
            viewport: renderViewport,
          });
          viewerState.renderTask = task;
          await task.promise;
          if (STATE.pdfViewerToken !== token) return;

          viewerState.initialRenderDone = true;
          if (viewerState.timeoutId) {
            clearTimeout(viewerState.timeoutId);
            viewerState.timeoutId = null;
          }
          if (statusCard) statusCard.classList.add("hidden");
          if (canvasWrap) canvasWrap.classList.remove("hidden");
          if (stageEl) stageEl.scrollTop = 0;

          // Precargar en segundo plano la página siguiente para navegación fluida
          if (clamped < viewerState.numPages) {
            setTimeout(() => {
              if (STATE.pdfViewerToken !== token || !viewerState.pdfDoc) return;
              viewerState.pdfDoc.getPage(clamped + 1).catch(() => {});
            }, 160);
          }
        } catch (err) {
          if (err && err.name === "RenderingCancelledException") return;
          if (STATE.pdfViewerToken !== token) return;
          console.warn("[BiblioTech PDF]", err);
          if (canvasWrap && canvasWrap.classList.contains("hidden")) {
            showFallbackError(
              `No se pudo renderizar la página (${sizeLabel}). Puedes leer el texto completo de inmediato o abrir el PDF en una pestaña nueva.`
            );
          }
        }
      };

      if (jumpFirstBtn) {
        jumpFirstBtn.onclick = () => {
          if (resumeBadge) resumeBadge.classList.add("hidden");
          renderCurrentPage(1, true);
        };
      }

      if (prev10Btn) {
        prev10Btn.onclick = () => {
          if (viewerState.page > 1) renderCurrentPage(Math.max(1, viewerState.page - 10), true);
        };
      }
      if (prevPageBtn) {
        prevPageBtn.onclick = () => {
          if (viewerState.page > 1) renderCurrentPage(viewerState.page - 1, true);
        };
      }
      if (nextPageBtn) {
        nextPageBtn.onclick = () => {
          if (viewerState.page < viewerState.numPages) renderCurrentPage(viewerState.page + 1, true);
        };
      }
      if (next10Btn) {
        next10Btn.onclick = () => {
          if (viewerState.page < viewerState.numPages) {
            renderCurrentPage(Math.min(viewerState.numPages, viewerState.page + 10), true);
          }
        };
      }
      if (bookmarkPageBtn) {
        bookmarkPageBtn.onclick = () => {
          const added = togglePageBookmark(doc, viewerState.page);
          updateNavControls();
          showWebToast(added ? `Página ${viewerState.page} guardada en marcadores.` : `Marcador de página ${viewerState.page} quitado.`);
        };
      }
      if (bookmarksBar) {
        bookmarksBar.addEventListener("click", (e) => {
          const jumpEl = e.target.closest("[data-pdf-bmk-jump]");
          if (jumpEl) {
            const targetP = parseInt(jumpEl.getAttribute("data-pdf-bmk-jump") || "1", 10);
            renderCurrentPage(targetP, true);
            return;
          }
          const delEl = e.target.closest("[data-pdf-bmk-del]");
          if (delEl) {
            const targetP = parseInt(delEl.getAttribute("data-pdf-bmk-del") || "1", 10);
            removePageBookmark(doc.id, targetP);
            updateNavControls();
          }
        });
      }
      if (pageInput) {
        pageInput.onchange = () => {
          const val = parseInt(pageInput.value, 10);
          if (Number.isFinite(val)) renderCurrentPage(val, true);
        };
        pageInput.onkeydown = (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const val = parseInt(pageInput.value, 10);
            if (Number.isFinite(val)) renderCurrentPage(val, true);
          }
        };
      }
      const changePdfZoom = (nextZoom) => {
        viewerState.zoom = Math.max(0.65, Math.min(2.4, Number(nextZoom.toFixed(2))));
        updateNavControls();
        renderCurrentPage(viewerState.page, false);
      };
      if (zoomOutBtn) zoomOutBtn.onclick = () => changePdfZoom(viewerState.zoom - 0.2);
      if (zoomInBtn) zoomInBtn.onclick = () => changePdfZoom(viewerState.zoom + 0.2);
      if (zoomResetBtn) zoomResetBtn.onclick = () => changePdfZoom(1);

      // Doble toque / doble clic y pellizco táctil (pinch-to-zoom) en el lienzo PDF
      if (canvasWrap) {
        let lastTapAt = 0;
        let pinchStartDist = 0;
        let pinchStartZoom = 1;
        let pinchTargetZoom = 1;

        canvasWrap.addEventListener("dblclick", (e) => {
          e.preventDefault();
          changePdfZoom(viewerState.zoom > 1.25 ? 1 : 1.75);
        });

        canvasWrap.addEventListener(
          "touchstart",
          (e) => {
            if (e.touches.length === 2) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              pinchStartDist = Math.hypot(dx, dy) || 1;
              pinchStartZoom = viewerState.zoom;
              pinchTargetZoom = viewerState.zoom;
            }
          },
          { passive: true }
        );

        canvasWrap.addEventListener(
          "touchmove",
          (e) => {
            if (e.touches.length === 2 && pinchStartDist > 0) {
              e.preventDefault();
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const dist = Math.hypot(dx, dy) || pinchStartDist;
              const ratio = dist / pinchStartDist;
              pinchTargetZoom = Math.max(0.65, Math.min(2.4, pinchStartZoom * ratio));
              if (canvas) {
                canvas.style.transformOrigin = "top center";
                canvas.style.transform = `scale(${(pinchTargetZoom / Math.max(0.5, viewerState.zoom)).toFixed(3)})`;
              }
            }
          },
          { passive: false }
        );

        canvasWrap.addEventListener(
          "touchend",
          (e) => {
            if (pinchStartDist > 0 && e.touches.length < 2) {
              pinchStartDist = 0;
              if (canvas) canvas.style.transform = "";
              if (Math.abs(pinchTargetZoom - viewerState.zoom) >= 0.08) {
                changePdfZoom(pinchTargetZoom);
              }
              return;
            }
            if (e.changedTouches.length === 1 && e.touches.length === 0) {
              const now = Date.now();
              if (now - lastTapAt < 280) {
                lastTapAt = 0;
                changePdfZoom(viewerState.zoom > 1.25 ? 1 : 1.75);
              } else {
                lastTapAt = now;
              }
            }
          },
          { passive: true }
        );
      }

      // Búsqueda de texto dentro del PDF (salto directo a página coincidente)
      const preseedPageTextsFromFullText = () => {
        if (!fullTextContent || viewerState.pageTextCache.size > 0) return;
        const pageMarkerRx = /--- Página (\d+) ---/g;
        const markers = Array.from(fullTextContent.matchAll(pageMarkerRx));
        if (!markers.length) return;
        for (let i = 0; i < markers.length; i++) {
          const pNum = parseInt(markers[i][1], 10);
          const start = (markers[i].index || 0) + markers[i][0].length;
          const end = i + 1 < markers.length ? markers[i + 1].index : fullTextContent.length;
          if (Number.isFinite(pNum) && pNum >= 1) {
            viewerState.pageTextCache.set(pNum, normalizeStr(fullTextContent.slice(start, end)));
          }
        }
      };

      const runInPdfSearch = async (jumpToFirst = true) => {
        if (!inDocSearchInput || !viewerState.pdfDoc) return;
        const rawNeedle = (inDocSearchInput.value || "").trim();
        const needle = normalizeStr(rawNeedle);
        viewerState.searchMatches = [];
        viewerState.searchIdx = -1;

        if (!needle || needle.length < 2) {
          if (inDocSearchCount) inDocSearchCount.textContent = "";
          if (inDocSearchPrev) inDocSearchPrev.classList.add("hidden");
          if (inDocSearchNext) inDocSearchNext.classList.add("hidden");
          return;
        }

        if (inDocSearchCount) inDocSearchCount.textContent = "...";
        preseedPageTextsFromFullText();

        const matches = [];
        const totalP = viewerState.numPages || 1;
        for (let p = 1; p <= totalP; p++) {
          if (STATE.pdfViewerToken !== token || normalizeStr(inDocSearchInput.value || "") !== needle) return;
          let pText = viewerState.pageTextCache.get(p);
          if (pText === undefined) {
            try {
              const pg = await viewerState.pdfDoc.getPage(p);
              const tc = await pg.getTextContent();
              pText = normalizeStr((tc && tc.items ? tc.items.map((it) => it.str).join(" ") : ""));
              viewerState.pageTextCache.set(p, pText);
            } catch (_) {
              pText = "";
              viewerState.pageTextCache.set(p, "");
            }
          }
          if (pText && pText.includes(needle)) {
            matches.push(p);
          }
        }

        if (STATE.pdfViewerToken !== token || normalizeStr(inDocSearchInput.value || "") !== needle) return;
        viewerState.searchMatches = matches;

        if (!matches.length) {
          if (inDocSearchCount) inDocSearchCount.textContent = "0 págs.";
          if (inDocSearchPrev) inDocSearchPrev.classList.add("hidden");
          if (inDocSearchNext) inDocSearchNext.classList.add("hidden");
          return;
        }

        viewerState.searchIdx = 0;
        if (inDocSearchCount) inDocSearchCount.textContent = `1/${matches.length} págs.`;
        if (inDocSearchPrev) inDocSearchPrev.classList.toggle("hidden", matches.length < 2);
        if (inDocSearchNext) inDocSearchNext.classList.toggle("hidden", matches.length < 2);
        if (jumpToFirst) {
          renderCurrentPage(matches[0], true);
        }
      };

      const stepInPdfSearch = (dir) => {
        const matches = viewerState.searchMatches;
        if (!matches || !matches.length) return;
        viewerState.searchIdx = (viewerState.searchIdx + dir + matches.length) % matches.length;
        if (inDocSearchCount) inDocSearchCount.textContent = `${viewerState.searchIdx + 1}/${matches.length} págs.`;
        renderCurrentPage(matches[viewerState.searchIdx], true);
      };

      if (inDocSearchInput) {
        inDocSearchInput.addEventListener(
          "input",
          debounce(() => {
            runInPdfSearch(true);
          }, 260)
        );
        inDocSearchInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (viewerState.searchMatches.length) stepInPdfSearch(1);
            else runInPdfSearch(true);
          }
        });
      }
      if (inDocSearchPrev) inDocSearchPrev.onclick = () => stepInPdfSearch(-1);
      if (inDocSearchNext) inDocSearchNext.onclick = () => stepInPdfSearch(1);

      viewerState.changeZoom = changePdfZoom;
      viewerState.getZoom = () => viewerState.zoom;

      viewerState.onKeyDown = (e) => {
        const modalEl = document.getElementById("docModal");
        if (!modalEl || modalEl.classList.contains("hidden")) return;
        const tag = (e.target && e.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if ((e.key === "ArrowLeft" || e.key === "[") && viewerState.page > 1) {
          e.preventDefault();
          renderCurrentPage(viewerState.page - 1);
        } else if ((e.key === "ArrowRight" || e.key === "]") && viewerState.page < viewerState.numPages) {
          e.preventDefault();
          renderCurrentPage(viewerState.page + 1);
        } else if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          changePdfZoom(viewerState.zoom + 0.2);
        } else if (e.key === "-") {
          e.preventDefault();
          changePdfZoom(viewerState.zoom - 0.2);
        }
      };
      document.addEventListener("keydown", viewerState.onKeyDown);

      if (!navigator.onLine && !doc.has_web_file && !IS_LOCAL_SERVER) {
        showFallbackError(
          `Estás sin conexión y este PDF (${sizeLabel}) se aloja en la nube. Puedes leer todo su Texto Extraído sin conexión ahora mismo.`
        );
        return;
      }

      viewerState.timeoutId = setTimeout(() => {
        if (STATE.pdfViewerToken === token && canvasWrap && canvasWrap.classList.contains("hidden")) {
          showFallbackError(
            `El documento es muy pesado (${sizeLabel}) y la conexión está tardando en responder. Puedes leer el texto completo al instante, abrir el PDF en pestaña o reintentar.`
          );
        }
      }, 18000);

      ensurePdfJsLoaded()
        .then((pdfjsLib) => {
          if (STATE.pdfViewerToken !== token) return;
          if (statusMsg) statusMsg.textContent = `Abriendo estructura del PDF (${sizeLabel}) por bloques...`;
          if (progressFill) progressFill.style.width = "45%";

          const loadingTask = pdfjsLib.getDocument({
            url: streamPdfUrl,
            disableAutoFetch: true,
            disableStream: false,
            rangeChunkSize: 262144,
            isEvalSupported: false,
          });
          viewerState.loadingTask = loadingTask;
          loadingTask.promise
            .then((loadedDoc) => {
              if (STATE.pdfViewerToken !== token && loadedDoc && typeof loadedDoc.destroy === "function") {
                Promise.resolve(loadedDoc.destroy()).catch(() => {});
              }
            })
            .catch(() => {});
          loadingTask.onProgress = (prog) => {
            if (STATE.pdfViewerToken !== token || !progressFill) return;
            if (prog && prog.loaded) {
              const kb = Math.round(prog.loaded / 1024);
              if (statusMsg && canvasWrap.classList.contains("hidden")) {
                statusMsg.textContent = `Recibiendo página 1 por streaming (${kb} KB descargados de ${sizeLabel})...`;
              }
            }
          };
          return loadingTask.promise;
        })
        .then((pdfDoc) => {
          if (!pdfDoc || STATE.pdfViewerToken !== token) return;
          viewerState.pdfDoc = pdfDoc;
          viewerState.numPages = pdfDoc.numPages || 1;
          const reqPage =
            STATE.requestedDocPage && STATE.requestedDocPage <= viewerState.numPages
              ? STATE.requestedDocPage
              : 0;
          STATE.requestedDocPage = null;
          const savedPage = reqPage || getSavedPdfPage(doc.id, viewerState.numPages);
          if (savedPage > 1 && !reqPage && resumeBadge && resumeTextEl) {
            resumeTextEl.textContent = `Continuando en pág. ${savedPage}`;
            resumeBadge.classList.remove("hidden");
          }
          return renderCurrentPage(savedPage, false);
        })
        .catch((err) => {
          if (STATE.pdfViewerToken !== token) return;
          console.warn("[BiblioTech PDF Load]", err);
          showFallbackError(
            `No se pudo iniciar la vista previa interactiva (${sizeLabel}). Usa «Leer Texto Completo ahora» o «Abrir PDF en pestaña».`
          );
        });
    };

    mountPdfMode(initialMode);
    openTabBtn.href = streamPdfUrl;
    openTabBtn.onclick = null;
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
  STATE.currentModalDoc = doc;
  STATE.modalRelatedSeen = new Set();
  renderModalRelatedQuestions(doc, false);
  modal.classList.remove("hidden");
  // Mientras el lector está abierto, la página de fondo no debe desplazarse.
  // Esto aplica también al modo normal, no solo a pantalla completa.
  document.documentElement.classList.add("reader-open");
  document.body.classList.add("reader-open");
  const modalBody = modal.querySelector(".modal-body");
  if (modalBody) modalBody.scrollTop = 0;
  activateDialogFocusTrap(modal, "#closeDocModalBtn");
}

function shuffleArrayCopy(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function getRelatedQuestionsPoolForDoc(doc) {
  if (!doc || !Array.isArray(STATE.questionBank) || !STATE.questionBank.length) {
    return { direct: [], combined: [] };
  }
  const seenNorm = new Set();
  const direct = [];
  const pushItem = (targetArr, qObj, isDirect) => {
    const qText = (qObj && qObj.q ? String(qObj.q) : "").trim();
    if (!qText) return;
    const nk = normalizeQuestionKey(qText);
    if (!nk || seenNorm.has(nk)) return;
    seenNorm.add(nk);
    targetArr.push({ q: qText, isDirect });
  };

  // 1. Coincidencias directas por doc_id
  const byDoc = (STATE.qBankByDocId && STATE.qBankByDocId[doc.id]) || [];
  for (const item of byDoc) pushItem(direct, item, true);

  // 2. Coincidencias por temas KB que citan exactamente este archivo
  const docFileLow = (doc.filename || "").trim().toLowerCase();
  const docTitleLow = (doc.title || "").trim().toLowerCase();
  const kbTopics = (STATE.knowledgeBase && STATE.knowledgeBase.topics) || [];
  if (docFileLow && kbTopics.length && STATE.qBankByTopicId) {
    for (const topic of kbTopics) {
      const sfiles = Array.isArray(topic.source_files) ? topic.source_files : [];
      const matchesTopic = sfiles.some((sf) => {
        const low = String(sf || "").trim().toLowerCase();
        return low === docFileLow || (docTitleLow.length >= 8 && low.includes(docTitleLow));
      });
      if (matchesTopic) {
        const topicQs = STATE.qBankByTopicId[topic.id] || [];
        for (const item of topicQs) pushItem(direct, item, true);
      }
    }
  }

  // 3. Preguntas de otros archivos enlazados explícitamente mediante related_doc_ids
  const extra = [];
  const crossLinked = (STATE.qBankByRelatedDocId && STATE.qBankByRelatedDocId[doc.id]) || [];
  for (const item of shuffleArrayCopy(crossLinked).slice(0, 12)) {
    pushItem(extra, item, false);
  }

  // 4. Si aún hay menos de 10 combinadas, complementar con documentos hermanos de la misma subcategoría/sección
  if (direct.length + extra.length < 10 && STATE.qBankByDocId) {
    const siblings = STATE.documents.filter((other) => {
      if (!other || other.id === doc.id) return false;
      if (doc.subcategory && other.subcategory === doc.subcategory && other.section === doc.section) return true;
      if (doc.subcategory && other.subcategory === doc.subcategory) return true;
      return other.category === doc.category && other.section === doc.section;
    });
    for (const sib of shuffleArrayCopy(siblings).slice(0, 12)) {
      const sibQs = STATE.qBankByDocId[sib.id] || [];
      for (const item of sibQs.slice(0, 3)) {
        pushItem(extra, item, false);
        if (direct.length + extra.length >= 16) break;
      }
      if (direct.length + extra.length >= 16) break;
    }
  }

  return { direct, combined: direct.concat(extra) };
}

async function renderModalRelatedQuestions(doc, isReload = false) {
  const bar = document.getElementById("modalRelatedQuestionsBar");
  const listEl = document.getElementById("modalRelatedQuestionsList");
  const countEl = document.getElementById("modalRelatedCount");
  const reloadBtn = document.getElementById("btnReloadModalRelated");
  const toggleBtn = document.getElementById("btnToggleModalRelated");
  if (!bar || !listEl || !doc) return;

  if (!STATE.questionBank || !STATE.questionBank.length) {
    bar.classList.remove("hidden");
    listEl.innerHTML = `<div class="bt-reader-related-loading">Cargando preguntas relacionadas...</div>`;
    await loadQuestionBank();
    if (STATE.currentModalDoc !== doc) return;
  }

  const { direct, combined } = getRelatedQuestionsPoolForDoc(doc);
  if (!combined.length) {
    bar.classList.add("hidden");
    listEl.innerHTML = "";
    return;
  }

  const batchSize = window.innerWidth <= 640 ? 2 : 4;
  if (!(STATE.modalRelatedSeen instanceof Set)) {
    STATE.modalRelatedSeen = new Set();
  }

  // Elegir primero preguntas no vistas (priorizando directas del documento)
  let unseenDirect = direct.filter((it) => !STATE.modalRelatedSeen.has(it.q));
  let unseenCombined = combined.filter((it) => !STATE.modalRelatedSeen.has(it.q));

  if (!unseenCombined.length) {
    STATE.modalRelatedSeen.clear();
    unseenDirect = direct.slice();
    unseenCombined = combined.slice();
  }

  let picked = [];
  if (!isReload && direct.length) {
    picked = shuffleArrayCopy(unseenDirect).slice(0, batchSize);
  } else if (unseenDirect.length >= batchSize) {
    picked = shuffleArrayCopy(unseenDirect).slice(0, batchSize);
  } else {
    picked = shuffleArrayCopy(unseenDirect);
    const needed = batchSize - picked.length;
    if (needed > 0) {
      const pickedSet = new Set(picked.map((x) => x.q));
      const rest = shuffleArrayCopy(unseenCombined.filter((x) => !pickedSet.has(x.q)));
      picked = picked.concat(rest.slice(0, needed));
    }
  }

  // Si en un ciclo casi terminado faltan para llenar el lote, completar sin repetir dentro del mismo lote
  if (picked.length < Math.min(batchSize, combined.length)) {
    const pickedSet = new Set(picked.map((x) => x.q));
    const refill = shuffleArrayCopy(combined.filter((x) => !pickedSet.has(x.q)));
    picked = picked.concat(refill.slice(0, batchSize - picked.length));
    STATE.modalRelatedSeen.clear();
  }

  picked.forEach((it) => STATE.modalRelatedSeen.add(it.q));

  if (countEl) {
    const totalLabel = direct.length >= batchSize ? `${direct.length} directas` : `${combined.length} disponibles`;
    countEl.textContent = totalLabel;
  }
  if (reloadBtn) {
    reloadBtn.classList.toggle("hidden", combined.length <= picked.length);
  }

  const collapsed = Boolean(STATE.modalRelatedCollapsed);
  bar.classList.toggle("is-collapsed", collapsed);
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-expanded", String(!collapsed));
    const span = toggleBtn.querySelector("span");
    if (span) span.textContent = collapsed ? "Mostrar" : "Ocultar";
  }

  listEl.innerHTML = picked
    .map(
      (it) => `
      <button type="button" class="bt-reader-related-btn" data-modal-related-q="${escapeHtml(it.q)}" title="Consultar respuesta oficial">
        <span class="bt-reader-related-q-text">${escapeHtml(it.q)}</span>
        <span class="bt-reader-related-arrow" aria-hidden="true">→</span>
      </button>
    `
    )
    .join("");

  bar.classList.remove("hidden");
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
    const emptyAskBtn = e.target.closest("[data-ask-from-empty]");
    if (emptyAskBtn) {
      const q = emptyAskBtn.getAttribute("data-ask-from-empty") || "";
      if (q.trim()) {
        loadQuestionBank();
        submitQuestion(q, { syncInput: true, source: "puente_biblioteca" });
        const ans = document.getElementById("answerContainer");
        if (ans) setTimeout(() => ans.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      }
      return;
    }
    const modalRelBtn = e.target.closest("[data-modal-related-q]");
    if (modalRelBtn) {
      const q = modalRelBtn.getAttribute("data-modal-related-q") || "";
      const closeBtn = document.getElementById("closeDocModalBtn");
      if (closeBtn) closeBtn.click();
      if (q.trim()) {
        loadQuestionBank();
        submitQuestion(q, { syncInput: true, source: "lector_relacionada" });
        const ans = document.getElementById("answerContainer");
        if (ans) setTimeout(() => ans.scrollIntoView({ behavior: "smooth", block: "start" }), 140);
      }
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
      STATE.librarySubcatOpen = targetShelf !== "featured";
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
      STATE.librarySubcatOpen = STATE.activeShelf !== "featured";
      STATE.libraryVisibleCount = resolveDefaultLibraryCount();
      renderLibraryShelf();
      revealLibraryResults();
    });
  });

  const resetLibBtn = document.getElementById("resetLibraryFiltersBtn");
  if (resetLibBtn) {
    resetLibBtn.addEventListener("click", () => {
      STATE.activeShelf = "featured";
      STATE.libraryQuery = "";
      STATE.librarySection = "all";
      STATE.libraryAxis = "all";
      STATE.librarySubcategory = "all";
      STATE.librarySubcatOpen = false;
      STATE.libraryScope = "shelf";
      STATE.libraryVisibleCount = 12;
      const lIn = document.getElementById("libraryFilterInput");
      const lSec = document.getElementById("librarySectionFilter");
      const lAx = document.getElementById("libraryAxisFilter");
      const lScp = document.getElementById("libraryScopeSelect");
      if (lIn) lIn.value = "";
      if (lSec) lSec.value = "all";
      if (lAx) lAx.value = "all";
      if (lScp) lScp.value = "shelf";
      document.querySelectorAll(".shelf-tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.shelf === "featured");
      });
      renderLibraryShelf();
    });
  }

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

  const libAxisSelect = document.getElementById("libraryAxisFilter");
  if (libAxisSelect) {
    libAxisSelect.addEventListener("change", () => {
      STATE.libraryAxis = libAxisSelect.value || "all";
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
      STATE.catalogSubcatOpen = val !== "all";
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
    destroyActivePdfViewer();
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

  const reloadModalRelatedBtn = document.getElementById("btnReloadModalRelated");
  if (reloadModalRelatedBtn) {
    reloadModalRelatedBtn.addEventListener("click", () => {
      if (!STATE.currentModalDoc) return;
      const icon = reloadModalRelatedBtn.querySelector(".bt-reload-icon");
      if (icon) {
        icon.classList.remove("is-spinning");
        void icon.offsetWidth;
        icon.classList.add("is-spinning");
      }
      if (STATE.modalRelatedCollapsed) {
        STATE.modalRelatedCollapsed = false;
      }
      renderModalRelatedQuestions(STATE.currentModalDoc, true);
    });
  }

  const toggleModalRelatedBtn = document.getElementById("btnToggleModalRelated");
  if (toggleModalRelatedBtn) {
    toggleModalRelatedBtn.addEventListener("click", () => {
      const bar = document.getElementById("modalRelatedQuestionsBar");
      if (!bar) return;
      STATE.modalRelatedCollapsed = !STATE.modalRelatedCollapsed;
      bar.classList.toggle("is-collapsed", STATE.modalRelatedCollapsed);
      toggleModalRelatedBtn.setAttribute("aria-expanded", String(!STATE.modalRelatedCollapsed));
      const span = toggleModalRelatedBtn.querySelector("span");
      if (span) span.textContent = STATE.modalRelatedCollapsed ? "Mostrar" : "Ocultar";
    });
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

  // Controles de Tema (Modo Claro / Modo Oscuro), Ejes y Dock
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
    const settingsDarkChk = document.getElementById("settingsCampModeToggle");
    if (settingsDarkChk) {
      settingsDarkChk.checked = Boolean(this.campMode);
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

  _tiltBound: false,
  _ambientCtrl: null,

  setVisualMode(mode, persist = true) {
    const safeMode = mode === "full" ? "full" : "lite";
    const root = document.documentElement;
    root.dataset.btVisual = safeMode;
    if (safeMode === "full") {
      root.dataset.btPerf = "standard";
    } else {
      root.dataset.btPerf = "lite";
    }
    if (persist) {
      try {
        localStorage.setItem("bt_visual_mode_v1", safeMode);
      } catch (_) {}
    }
    if (this._ambientCtrl) {
      if (safeMode === "full") this._ambientCtrl.start();
      else this._ambientCtrl.stop();
    }
    return safeMode;
  },

  init3DTilt() {
    if (this._tiltBound) return;
    this._tiltBound = true;
    const coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fullSelector = ".book-card, .doc-card, .section-card, .adc-pillar-card, .bts-card-polygon, .hero-photo-masked, .liam-depth-stage";

    if (!coarse && !reduced) {
      document.addEventListener("pointermove", (e) => {
        const isFull = document.documentElement.dataset.btVisual === "full";
        const selector = isFull ? fullSelector : ".liam-depth-stage";
        const card = e.target.closest(selector);
        if (!card) return;
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = (e.clientY - rect.top) / rect.height;
        const ampX = isFull ? 5.2 : 3.5;
        const ampY = isFull ? 6.0 : 4.0;
        card.style.setProperty("--rx", `${((0.5 - ny) * ampX).toFixed(2)}deg`);
        card.style.setProperty("--ry", `${((nx - 0.5) * ampY).toFixed(2)}deg`);
        card.classList.add("is-tilting");
      }, { passive: true });

      document.addEventListener("pointerout", (e) => {
        const card = e.target.closest(fullSelector);
        if (!card || (e.relatedTarget && card.contains(e.relatedTarget))) return;
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
        card.classList.remove("is-tilting");
      }, { passive: true });
    }
  },

  initAmbientCanvas() {
    const reducedMql = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMql && reducedMql.matches) return;
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

    const count = window.innerWidth < 768 ? 22 : 40;
    const lightPalette = ["109, 40, 217", "2, 132, 199", "219, 39, 119"];
    const darkPalette = ["56, 189, 248", "167, 139, 250", "250, 204, 21"];
    const particles = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1.5 + Math.random() * 2.3,
      vx: (Math.random() - 0.5) * 0.36,
      vy: -0.22 - Math.random() * 0.48,
      phase: Math.random() * Math.PI * 2,
      toneIdx: i % 3
    }));

    let rafId = null;
    const render = () => {
      rafId = null;
      if (document.hidden || document.documentElement.dataset.btVisual !== "full") {
        ctx.clearRect(0, 0, w, h);
        return;
      }
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

    const start = () => {
      if (reducedMql && reducedMql.matches) return;
      if (document.documentElement.dataset.btVisual !== "full") return;
      if (rafId === null && !document.hidden) {
        rafId = requestAnimationFrame(render);
      }
    };
    const stop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      ctx.clearRect(0, 0, w, h);
    };
    this._ambientCtrl = { start, stop };

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && document.documentElement.dataset.btVisual === "full") {
        start();
      } else {
        stop();
      }
    });

    if (document.documentElement.dataset.btVisual === "full") {
      start();
    }
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
  updateSavedBadge();
}

function getSavedAndNotedDocIds() {
  const pins = getSavedPins();
  const idSet = new Set(pins);
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("bt_note_")) {
        const val = (localStorage.getItem(k) || "").trim();
        if (val) idSet.add(k.slice("bt_note_".length));
      }
    }
  } catch (_) {}
  return Array.from(idSet);
}

function getSavedEditorDraftsForPanel() {
  try {
    const raw = localStorage.getItem("bt_sf_named_drafts_v2");
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

function updateSavedBadge() {
  const ids = getSavedAndNotedDocIds();
  const drafts = getSavedEditorDraftsForPanel();
  const total = ids.length + drafts.length;
  for (const elId of ["dockSavedCount", "headerSavedCount", "menuSavedCount", "libSavedCount"]) {
    const countEl = document.getElementById(elId);
    if (countEl) {
      countEl.textContent = String(total);
      countEl.classList.toggle("hidden", total === 0);
    }
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
  const allDocIds = getSavedAndNotedDocIds();
  const savedDocs = STATE.documents.filter((d) => allDocIds.includes(d.id));
  const drafts = getSavedEditorDraftsForPanel();
  const pageBmks = getPageBookmarks();

  if (savedDocs.length === 0 && drafts.length === 0 && pageBmks.length === 0) {
    list.innerHTML = `
      <div class="saved-empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
        <p><strong>Aún no tienes archivos guardados</strong></p>
        <span>Abre cualquier libro, manual, FAES o especialidad de la biblioteca y toca <strong>Guardar</strong> (o marca una página en un PDF) para tenerlo siempre a la mano en este dispositivo.</span>
      </div>
    `;
  } else {
    const docsHtml = savedDocs.map((doc) => {
      const note = getDocNote(doc.id);
      const isPinned = pins.includes(doc.id);
      return `
        <article class="saved-card" data-doc-id="${escapeHtml(doc.id)}">
          <div class="saved-card-main">
            <span class="badge badge-ext">${escapeHtml(doc.ext)}</span>
            <span class="badge badge-sec">${escapeHtml(doc.section_label || 'General')}</span>
            <span class="badge badge-year">${doc.year || '2026'}</span>
            ${!isPinned && note ? '<span class="badge badge-ext">Con nota</span>' : ''}
            <h4 class="saved-card-title">${escapeHtml(doc.title)}</h4>
            <span class="saved-card-fname">${escapeHtml(doc.filename)}</span>
            ${note ? `<div class="saved-card-note"><strong>Notas:</strong> ${escapeHtml(note)}</div>` : ''}
          </div>
          <div class="saved-card-actions">
            <button type="button" class="btn-saved-open" data-open-doc="${escapeHtml(doc.id)}">Abrir</button>
            ${
              isPinned
                ? `<button type="button" class="btn-saved-remove" data-remove-doc="${escapeHtml(doc.id)}" title="Quitar de guardados">Quitar</button>`
                : `<button type="button" class="btn-saved-remove" data-clear-note="${escapeHtml(doc.id)}" title="Borrar nota">Borrar nota</button>`
            }
          </div>
        </article>
      `;
    }).join("");

    const pageBmksHtml = pageBmks.length
      ? `
        <div class="saved-drafts-divider">Marcadores de página en PDF (${pageBmks.length})</div>
        ${pageBmks.map((b) => `
          <article class="saved-card">
            <div class="saved-card-main">
              <span class="badge badge-ext">${escapeHtml(b.ext || 'PDF')}</span>
              <span class="badge badge-sec">Pág. ${Number(b.page)}</span>
              <h4 class="saved-card-title">${escapeHtml(b.title)}</h4>
            </div>
            <div class="saved-card-actions">
              <button type="button" class="btn-saved-open" data-open-doc-page="${escapeHtml(b.docId)}:${Number(b.page)}">Ir a pág. ${Number(b.page)}</button>
              <button type="button" class="btn-saved-remove" data-remove-page-bmk="${escapeHtml(b.docId)}:${Number(b.page)}" title="Quitar marcador">Quitar</button>
            </div>
          </article>
        `).join("")}
      `
      : "";

    const draftsHtml = drafts.length
      ? `
        <div class="saved-drafts-divider">Borradores del Editor de Archivos (${drafts.length})</div>
        ${drafts.map((dr) => `
          <article class="saved-card">
            <div class="saved-card-main">
              <span class="badge badge-ext">BORRADOR</span>
              <span class="badge badge-sec">${escapeHtml(dr.templateTitle || dr.templateId || 'Archivo')}</span>
              <h4 class="saved-card-title">${escapeHtml(dr.name || 'Borrador guardado')}</h4>
              ${dr.updatedAt ? `<span class="saved-card-fname">Guardado: ${escapeHtml(dr.updatedAt)}</span>` : ''}
            </div>
            <div class="saved-card-actions">
              <button type="button" class="btn-saved-open" data-open-editor-draft="1">Ir al Editor</button>
            </div>
          </article>
        `).join("")}
      `
      : "";

    list.innerHTML = docsHtml + pageBmksHtml + draftsHtml;

    list.querySelectorAll("[data-open-doc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-open-doc");
        closeSavedPanel();
        openDocumentModal(id);
      });
    });

    list.querySelectorAll("[data-open-doc-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const raw = btn.getAttribute("data-open-doc-page") || "";
        const [id, pgStr] = raw.split(":");
        const pg = parseInt(pgStr || "1", 10);
        closeSavedPanel();
        if (id) openDocumentModal(id, -1, Number.isFinite(pg) && pg >= 1 ? pg : null);
      });
    });

    list.querySelectorAll("[data-remove-page-bmk]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const raw = btn.getAttribute("data-remove-page-bmk") || "";
        const [id, pgStr] = raw.split(":");
        if (id) removePageBookmark(id, parseInt(pgStr || "1", 10));
        openSavedPanel();
      });
    });

    list.querySelectorAll("[data-remove-doc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-remove-doc");
        toggleSavedPin(id);
        openSavedPanel();
      });
    });

    list.querySelectorAll("[data-clear-note]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-clear-note");
        setDocNote(id, "");
        openSavedPanel();
      });
    });

    list.querySelectorAll("[data-open-editor-draft]").forEach((btn) => {
      btn.addEventListener("click", () => {
        closeSavedPanel();
        btSwitchView("formatos");
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
      if (
        STATE.activePdfViewer &&
        typeof STATE.activePdfViewer.changeZoom === "function" &&
        previewPane &&
        !previewPane.classList.contains("hidden")
      ) {
        STATE.activePdfViewer.changeZoom(STATE.activePdfViewer.getZoom() - 0.2);
        BiblioFeel.pulse(8);
        return;
      }
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
      if (
        STATE.activePdfViewer &&
        typeof STATE.activePdfViewer.changeZoom === "function" &&
        previewPane &&
        !previewPane.classList.contains("hidden")
      ) {
        STATE.activePdfViewer.changeZoom(STATE.activePdfViewer.getZoom() + 0.2);
        BiblioFeel.pulse(8);
        return;
      }
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

      if (action === "settings") {
        e.preventDefault();
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

const APP_WEB_VERSION = "10.3.0";
const APP_MOBILE_VERSION = "4.3.0";
const APP_COOKIE_SCHEMA = "9.7";
const BT_SEEN_VERSION_KEY = "bt_seen_app_version_v1";
const BT_COOKIE_SCHEMA_KEY = "bt_cookie_schema_v1";
const BT_ACK_REMOTE_VER_KEY = "bt_ack_remote_version_v1";
const WEB_OFFLINE_CACHE = "bibliotech-scout-v64";
const WEB_OFFLINE_META_KEY = "bt_web_offline_meta_v1";

function setupVersionAndUpdateChecker() {
  const banner = document.getElementById("updateAvailableBanner");
  const textEl = document.getElementById("updateAvailableText");
  const applyBtn = document.getElementById("btnApplyAppUpdate");
  const dismissBtn = document.getElementById("btnDismissAppUpdate");
  if (!banner || !textEl) return;

  let pendingAction = null;
  let latestDetectedVersion = APP_WEB_VERSION;

  const showBanner = (message, onApplyFn = null, applyLabel = "Actualizar ahora", detectedVer = "") => {
    if (detectedVer) latestDetectedVersion = detectedVer;
    textEl.textContent = message;
    if (applyBtn) applyBtn.textContent = applyLabel;
    pendingAction = typeof onApplyFn === "function" ? onApplyFn : null;
    banner.classList.remove("hidden");
  };

  window.__btShowUpdateBanner = showBanner;

  const markVersionSeen = () => {
    try {
      localStorage.setItem(BT_SEEN_VERSION_KEY, latestDetectedVersion || APP_WEB_VERSION);
      localStorage.setItem(BT_COOKIE_SCHEMA_KEY, APP_COOKIE_SCHEMA);
      localStorage.setItem(BT_ACK_REMOTE_VER_KEY, latestDetectedVersion || APP_WEB_VERSION);
      sessionStorage.setItem(BT_ACK_REMOTE_VER_KEY, latestDetectedVersion || APP_WEB_VERSION);
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
      banner.classList.add("hidden");
      if (pendingAction) {
        try {
          await pendingAction();
        } catch (_) {}
      }
      if ("caches" in window && !window.Capacitor) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
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

  // Asegurar que la versión actual quede registrada para no mostrar avisos repetidos tras recargar
  try {
    const seenVersion = localStorage.getItem(BT_SEEN_VERSION_KEY);
    if (seenVersion !== APP_WEB_VERSION) {
      localStorage.setItem(BT_SEEN_VERSION_KEY, APP_WEB_VERSION);
      localStorage.setItem(BT_COOKIE_SCHEMA_KEY, APP_COOKIE_SCHEMA);
      localStorage.setItem(BT_ACK_REMOTE_VER_KEY, APP_WEB_VERSION);
    }
  } catch (_) {}

  // Comprobar contra el servidor solo si existe una versión remota distinta y aún no aceptada por el usuario
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
        let ackVer = "";
        let sessionAck = "";
        try {
          ackVer = localStorage.getItem(BT_ACK_REMOTE_VER_KEY) || "";
          sessionAck = sessionStorage.getItem(BT_ACK_REMOTE_VER_KEY) || "";
        } catch (_) {}

        if (window.Capacitor) {
          if (remoteMobile && remoteMobile !== APP_MOBILE_VERSION && ackVer !== remoteMobile && sessionAck !== remoteMobile) {
            showBanner(
              `Nueva versión ${remoteMobile} disponible para BiblioTech Scout Mobile (Web ${remoteWeb || APP_WEB_VERSION}).`,
              () => {
                window.open("https://github.com/ey-liam/bibliotech-scouts-app/releases/latest", "_blank", "noopener");
              },
              "Ver actualización",
              remoteMobile
            );
          }
        } else if (remoteWeb && remoteWeb !== APP_WEB_VERSION && ackVer !== remoteWeb && sessionAck !== remoteWeb) {
          showBanner(
            `Nueva versión disponible (${remoteWeb}) con cambios importantes en archivos y funciones. Actualiza ahora.`,
            null,
            "Actualizar ahora",
            remoteWeb
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

    // Alt + 1..6: navegación rápida de apartados en escritorio
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !isEditable) {
      const viewMap = {
        "1": "inicio",
        "2": "biblioteca",
        "3": "fogata",
        "4": "formatos",
        "5": "guardados"
      };
      if (viewMap[e.key]) {
        e.preventDefault();
        btSwitchView(viewMap[e.key]);
        return;
      }
      if (e.key === "6") {
        e.preventDefault();
        if (typeof window.__btOpenSettingsModal === "function") {
          window.__btOpenSettingsModal("apariencia");
        }
        return;
      }
    }

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
      const stBadge = document.getElementById("settingsOfflineStatusBadge");
      const stBtn = document.getElementById("btnSettingsDownloadOffline");

      if (hasBank && hasFaq4) {
        const label = hasChunks ? "Listo offline (completo)" : "Listo offline (21,195 preg.)";
        const btnTxt = meta && meta.date ? `Actualizar (${meta.date})` : "Actualizar datos offline";
        if (badge) {
          badge.classList.add("ready");
          badge.textContent = label;
        }
        if (stBadge) {
          stBadge.classList.add("ready");
          stBadge.textContent = label;
        }
        if (btnDownload) btnDownload.textContent = btnTxt;
        if (stBtn) stBtn.textContent = btnTxt;
        if (btnClear) btnClear.classList.remove("hidden");
      } else {
        if (badge) {
          badge.classList.remove("ready");
          badge.textContent = "Sin descargar";
        }
        if (stBadge) {
          stBadge.classList.remove("ready");
          stBadge.textContent = "Sin descargar";
        }
        if (btnDownload) btnDownload.textContent = "Descargar modo sin conexión";
        if (stBtn) stBtn.textContent = "Descargar modo sin conexión";
        if (btnClear) btnClear.classList.add("hidden");
      }
    } catch (_) {}
  };

  window.__btRefreshWebOfflineStatus = refreshStatus;

  if (btnDownload) {
    window.__btTriggerWebOfflineDownload = async () => {
      btnDownload.click();
    };
    btnDownload.addEventListener("click", async () => {
      if (navigator.onLine === false) {
        showWebToast("Conéctate a internet para descargar el paquete offline.");
        return;
      }
      const includeChunks = Boolean(chunksToggle && chunksToggle.checked);
      const urls = includeChunks ? [...BASE_OFFLINE_URLS, "data/chunks.json"] : [...BASE_OFFLINE_URLS];
      const stBadge = document.getElementById("settingsOfflineStatusBadge");
      const stBtn = document.getElementById("btnSettingsDownloadOffline");

      btnDownload.disabled = true;
      if (stBtn) {
        stBtn.disabled = true;
        stBtn.textContent = "Descargando...";
      }
      if (badge) {
        badge.classList.remove("ready");
        badge.textContent = "Descargando...";
      }
      if (stBadge) {
        stBadge.classList.remove("ready");
        stBadge.textContent = "Descargando...";
      }
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
          if (stBtn) stBtn.textContent = `Descargando (${pct}%)...`;
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
        if (stBtn) stBtn.disabled = false;
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
const BT_LAST_SEEN_VERSION_KEY = "bt_last_seen_version_v1";

function setupWelcomeModal() {
  const modal = document.getElementById("welcomeModal");
  if (!modal) return;

  const openMenuBtn = document.getElementById("openWelcomeMenuBtn");
  const openFooterBtn = document.getElementById("openWelcomeFooterBtn");
  const closeBtn = document.getElementById("closeWelcomeModalBtn");
  const skipBtn = document.getElementById("skipWelcomeModalBtn");
  const prevBtn = document.getElementById("prevWelcomePageBtn");
  const nextBtn = document.getElementById("nextWelcomePageBtn");
  const startBtn = document.getElementById("startWelcomeModalBtn");
  const indicatorEl = document.getElementById("welcomePageIndicator");
  const stepBtns = Array.from(modal.querySelectorAll("[data-welcome-step]"));
  const pagePanels = Array.from(modal.querySelectorAll("[data-welcome-page]"));
  const platBtns = Array.from(modal.querySelectorAll("[data-welcome-plat]"));
  const platPanes = Array.from(modal.querySelectorAll("[data-welcome-plat-pane]"));
  const shareQrBtn = document.getElementById("shareWelcomeQrBtn");
  const downloadQrBtn = document.getElementById("downloadWelcomeQrBtn");
  const openPrivacyBtn = document.getElementById("welcomeOpenPrivacyBtn");

  let currentPage = 1;

  const detectDefaultPlatform = () => {
    if (window.Capacitor) return "apk";
    if (IS_APPLE_TOUCH || /iPhone|iPad|iPod/i.test(navigator.userAgent || "")) return "ios";
    if (/Android/i.test(navigator.userAgent || "")) return "apk";
    return "desktop";
  };

  const setWelcomePlatform = (platName) => {
    const target = ["ios", "apk", "desktop"].includes(platName) ? platName : "desktop";
    platBtns.forEach((btn) => {
      const act = btn.getAttribute("data-welcome-plat") === target;
      btn.classList.toggle("is-active", act);
      btn.setAttribute("aria-selected", String(act));
    });
    platPanes.forEach((pane) => {
      pane.classList.toggle("hidden", pane.getAttribute("data-welcome-plat-pane") !== target);
    });
  };

  const setWelcomePage = (pageNum) => {
    currentPage = Math.max(1, Math.min(3, Number(pageNum) || 1));
    stepBtns.forEach((btn) => {
      const n = Number(btn.getAttribute("data-welcome-step"));
      const act = n === currentPage;
      btn.classList.toggle("is-active", act);
      btn.setAttribute("aria-selected", String(act));
    });
    pagePanels.forEach((panel) => {
      const n = Number(panel.getAttribute("data-welcome-page"));
      panel.classList.toggle("hidden", n !== currentPage);
    });
    if (indicatorEl) indicatorEl.textContent = `Página ${currentPage} de 3`;
    if (prevBtn) prevBtn.classList.toggle("hidden", currentPage <= 1);
    if (nextBtn) nextBtn.classList.toggle("hidden", currentPage >= 3);
  };

  setWelcomePlatform(detectDefaultPlatform());
  setWelcomePage(1);

  const closeMenuIfOpen = () => {
    const header = document.querySelector(".main-header");
    const navToggle = document.getElementById("navToggle");
    const navBackdrop = document.getElementById("navBackdrop");
    if (header) header.classList.remove("nav-open");
    document.body.classList.remove("nav-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    if (navBackdrop) navBackdrop.hidden = true;
  };

  const openWelcome = (initialPage = 1) => {
    closeMenuIfOpen();
    setWelcomePlatform(detectDefaultPlatform());
    setWelcomePage(initialPage);
    modal.classList.remove("hidden");
    activateDialogFocusTrap(modal, "#startWelcomeModalBtn");
  };

  window.__btOpenWelcomeModal = openWelcome;

  const dismissWelcome = (acceptConsentIfUnset = true) => {
    try {
      localStorage.setItem(BT_WELCOME_SEEN_KEY, "1");
      localStorage.setItem(BT_LAST_SEEN_VERSION_KEY, APP_WEB_VERSION);
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
    openWelcome(1);
  }

  stepBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      setWelcomePage(Number(btn.getAttribute("data-welcome-step")) || 1);
    });
  });
  platBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      setWelcomePlatform(btn.getAttribute("data-welcome-plat") || "desktop");
    });
  });
  if (prevBtn) prevBtn.addEventListener("click", () => setWelcomePage(currentPage - 1));
  if (nextBtn) nextBtn.addEventListener("click", () => setWelcomePage(currentPage + 1));

  if (openMenuBtn) openMenuBtn.addEventListener("click", () => openWelcome(1));
  if (openFooterBtn) openFooterBtn.addEventListener("click", () => openWelcome(1));
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
        text: "Explora 883 documentos oficiales (incluyendo 220 FAES y 82 FES) y 21,290+ respuestas scouts en BiblioTech Scout:",
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

function setupWhatsNewModal() {
  const modal = document.getElementById("whatsNewModal");
  if (!modal) return;

  const closeBtn = document.getElementById("closeWhatsNewModalBtn");
  const acceptBtn = document.getElementById("whatsNewAcceptBtn");
  const historyBtn = document.getElementById("whatsNewOpenHistoryBtn");
  const versionBadge = document.getElementById("whatsNewVersionBadge");
  const dateLabel = document.getElementById("whatsNewDateLabel");
  const bodyEl = document.getElementById("whatsNewBody");

  const SECTION_META = [
    { key: "added", label: "Añadido", cls: "is-added" },
    { key: "improved", label: "Mejorado", cls: "is-improved" },
    { key: "changed", label: "Cambiado", cls: "is-changed" },
    { key: "removed", label: "Eliminado", cls: "is-removed" }
  ];

  const renderLatestRelease = () => {
    const latest = Array.isArray(BT_RELEASE_NOTES) && BT_RELEASE_NOTES[0] ? BT_RELEASE_NOTES[0] : null;
    if (!latest || !bodyEl) return;
    if (versionBadge) versionBadge.textContent = window.Capacitor ? `App APK v${APP_MOBILE_VERSION}` : `Web v${APP_WEB_VERSION}`;
    if (dateLabel) dateLabel.textContent = latest.date || "";

    const sec = latest.sections || {};
    const groupsHtml = SECTION_META.map((m) => {
      const arr = Array.isArray(sec[m.key]) ? sec[m.key] : [];
      if (!arr.length) return "";
      return `
        <section class="bt-whatsnew-group">
          <div class="bt-whatsnew-group-head">
            <span class="bt-wn-badge ${m.cls}">${escapeHtml(m.label)}</span>
          </div>
          <ul class="bt-whatsnew-list">
            ${arr.map((it) => `<li>${escapeHtml(it)}</li>`).join("")}
          </ul>
        </section>
      `;
    }).join("");

    bodyEl.innerHTML =
      groupsHtml ||
      `<section class="bt-whatsnew-group"><ul class="bt-whatsnew-list">${(latest.items || []).map((it) => `<li>${escapeHtml(it)}</li>`).join("")}</ul></section>`;
  };

  const openWhatsNew = () => {
    renderLatestRelease();
    modal.classList.remove("hidden");
    document.documentElement.classList.add("modal-open");
    activateDialogFocusTrap(modal, "#whatsNewAcceptBtn");
  };

  const dismissWhatsNew = () => {
    try {
      localStorage.setItem(BT_LAST_SEEN_VERSION_KEY, APP_WEB_VERSION);
    } catch (_) {}
    modal.classList.add("hidden");
    if (!document.querySelector(".modal-overlay:not(.hidden)") && !document.querySelector("#savedPanel:not(.hidden)")) {
      document.documentElement.classList.remove("modal-open");
    }
    releaseDialogFocusTrap(modal);
  };

  window.__btOpenWhatsNewModal = openWhatsNew;

  if (closeBtn) closeBtn.addEventListener("click", dismissWhatsNew);
  if (acceptBtn) acceptBtn.addEventListener("click", dismissWhatsNew);
  if (historyBtn) {
    historyBtn.addEventListener("click", () => {
      dismissWhatsNew();
      if (typeof window.__btOpenSettingsModal === "function") {
        window.__btOpenSettingsModal("version");
      }
    });
  }
  modal.addEventListener("click", (e) => {
    if (e.target === modal) dismissWhatsNew();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) dismissWhatsNew();
  });

  // Mostrar automáticamente solo cuando alguien ya vio la bienvenida y actualizó a una versión nueva
  try {
    const welcomeSeen = localStorage.getItem(BT_WELCOME_SEEN_KEY) === "1";
    const lastVersion = localStorage.getItem(BT_LAST_SEEN_VERSION_KEY);
    if (welcomeSeen && lastVersion !== APP_WEB_VERSION) {
      setTimeout(() => {
        const welcomeEl = document.getElementById("welcomeModal");
        if (welcomeEl && !welcomeEl.classList.contains("hidden")) return;
        openWhatsNew();
      }, 450);
    }
  } catch (_) {}
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
    const devUid = getOrCreateAnonDeviceId();
    const payloadBody = JSON.stringify({
      _subject: isModeration
        ? `[MODERACIÓN LA FOGATA] ${sec} (${plat}) [${devUid}]`
        : `[REPORTE USUARIO / BUG] ${sec} (${plat}) [${devUid}]`,
      _template: "table",
      _captcha: "false",
      deviceId: devUid,
      plataforma: `${plat} · Real: ${ctx.plat} · ${ctx.vista}`,
      navegador_y_tema: `${ctx.browser} (${ctx.os}) · Tema ${ctx.tema}`,
      alertas_bugs_o_sin_coincidencia: checked.join(" | ") || "Reporte manual",
      resumen_mas_usado: `Dispositivo: ${devUid} · Apartado: ${sec}${targetDoc ? ` · Ref: ${targetDoc}` : ""}`,
      actividad_completa: [
        isModeration
          ? `REPORTE DE MODERACIÓN EN LA FOGATA (${devUid} · ${BT_SESSION_ID})`
          : `REPORTE EXPLÍCITO DEL USUARIO (${devUid} · ${BT_SESSION_ID})`,
        `Código anónimo de dispositivo: ${devUid}`,
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
      setStatus("¡Gracias! Tu reporte se envió correctamente. Estoy trabajando duro y revisando cada aviso de forma constante; quedará solucionado en aproximadamente 2 a 7 días como máximo.", "ok");
      form.reset();
      preselectPlatform();
      setTimeout(() => closeModal(), 3200);
    } else {
      setStatus("No hay conexión ahora para enviarlo. Puedes escribir a rdc.tlxh@gmail.com (revisión constante, solución en aprox. 2 a 7 días como máximo).", "error");
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
const BT_DEVICE_UID_KEY = "bt_device_uid_v1";
const BT_RECENT_QUERIES_KEY = "bt_recent_queries_v1";
const BT_ANON_QUEUE_KEY = "bt_anon_queue_v1";
const BT_ANON_STATS_KEY = "bt_anon_stats_v1";
const BT_SENT_HASHES_KEY = "bt_sent_hashes_v1";
const BT_LAST_SENT_KEY = "bt_last_telemetry_sent_v1";
const BT_SESSION_ID = "ses_" + Math.random().toString(36).slice(2, 8);

function getOrCreateAnonDeviceId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let uid = "";
  try {
    uid = String(localStorage.getItem(BT_DEVICE_UID_KEY) || "").trim().toUpperCase();
  } catch (_) {}
  if (!/^BT-[A-Z0-9]{6,10}$/.test(uid)) {
    try {
      const m = String(document.cookie || "").match(/(?:^|;\s*)bt_uid=(BT-[A-Z0-9]{6,10})/i);
      if (m && m[1]) uid = m[1].toUpperCase();
    } catch (_) {}
  }
  if (!/^BT-[A-Z0-9]{6,10}$/.test(uid)) {
    const bytes = new Uint8Array(6);
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += alphabet[bytes[i] % alphabet.length];
    }
    uid = `BT-${code}`;
  }
  try {
    localStorage.setItem(BT_DEVICE_UID_KEY, uid);
  } catch (_) {}
  try {
    document.cookie = `bt_uid=${uid}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (_) {}
  return uid;
}
const BT_DEVICE_UID = getOrCreateAnonDeviceId();
window.__btGetDeviceUid = getOrCreateAnonDeviceId;

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

let btLastLoggedQueryKey = "";
let btLastLoggedQueryAt = 0;
function recordQueryTelemetry(query, data, querySource = "manual") {
  const q = String(query || "").trim();
  if (!q) return;
  saveRecentQueryLocal(q);
  const now = Date.now();
  const qNormKey = normalizeQuestionKey(q);
  // Evitar duplicar la misma consulta consecutiva por doble toque en menos de 30s
  if (qNormKey && qNormKey === btLastLoggedQueryKey && now - btLastLoggedQueryAt < 30000) {
    return;
  }
  btLastLoggedQueryKey = qNormKey;
  btLastLoggedQueryAt = now;

  const sources = Array.isArray(data && data.sources) ? data.sources : [];
  const answerFull = summarizeMarkdownPlain(data && data.answer_markdown, 2500);
  const unmatched =
    !sources.length && /no (?:se )?encontr[eéoó]|informaci[oó]n no disponible|sin resultados|reformul|espec[ií]fica/i.test(answerFull);

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
    case "ui_accion":
      return `${head} ACCIÓN UI [${ev.accion || "interaccion"}]: ${ev.detalle || ev.valor || ev.tpl || ""}`;
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
  // En salida de app / cambio de pestaña (forceImmediate), respetar cooldown de 90s para evitar duplicados al abrir PDFs
  // En segundo plano periódico, exigir >= 5 minutos o >= 5 preguntas relevantes
  if (!criticalCount) {
    if (forceImmediate) {
      if (now - lastSent < 90000) return;
    } else {
      const cooldownOk = now - lastSent >= 300000;
      if (!cooldownOk && questionCount < 5) return;
      if (questionCount < 1 && meaningfulEvents.length < 3) return;
    }
  }

  btFlushInFlight = true;
  const batch = queue.slice(0, 25);
  const remaining = queue.slice(batch.length);
  // Reclamar el lote de forma atómica ANTES de la petición de red para evitar envíos duplicados entre visibilitychange/pagehide o pestañas
  try {
    localStorage.setItem(BT_LAST_SENT_KEY, String(now));
    localStorage.setItem(BT_ANON_QUEUE_KEY, JSON.stringify(remaining));
  } catch (_) {}

  try {
    const ctx = detectClientContext();
    const lines = batch.map((ev, i) => formatTelemetryEventLine(ev, i));
    const statsBlock = formatTopStatsBlock();
    const issueLines = batch
      .filter((ev) => isCritical(ev) || (ev.t === "pregunta" && ev.ok === "sin_coincidencia"))
      .map((ev) => `- [${ev.t}] ${ev.q || ev.msg || ""}`);

    const devUid = getOrCreateAnonDeviceId();
    const payloadBody = JSON.stringify({
      _subject: issueLines.length
        ? `[ALERTA/BUG] BiblioTech [${ctx.plat} · ${devUid}] — ${batch.length} eventos (${BT_SESSION_ID})`
        : `BiblioTech Scout [${ctx.plat} · ${devUid}] — ${questionCount} preg / ${meaningfulEvents.length} acciones`,
      _template: "table",
      _captcha: "false",
      deviceId: devUid,
      plataforma: `${ctx.plat} · ${ctx.vista}`,
      navegador_y_tema: `${ctx.browser} (${ctx.os}) · Tema ${ctx.tema}`,
      alertas_bugs_o_sin_coincidencia: issueLines.length ? issueLines.join("\n") : "Ninguna falla ni pregunta sin respuesta en este lote",
      resumen_mas_usado: `Dispositivo: ${devUid}\n${statsBlock || "Primeros eventos acumulados"}`,
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
    } else {
      // Restaurar el lote al inicio de la cola si falló la red
      try {
        const currentQ = JSON.parse(localStorage.getItem(BT_ANON_QUEUE_KEY) || "[]");
        const restored = batch.concat(Array.isArray(currentQ) ? currentQ : []).slice(-120);
        localStorage.setItem(BT_ANON_QUEUE_KEY, JSON.stringify(restored));
        localStorage.setItem(BT_LAST_SENT_KEY, String(lastSent));
      } catch (_) {}
    }
  } catch (_) {
    try {
      const currentQ = JSON.parse(localStorage.getItem(BT_ANON_QUEUE_KEY) || "[]");
      const restored = batch.concat(Array.isArray(currentQ) ? currentQ : []).slice(-120);
      localStorage.setItem(BT_ANON_QUEUE_KEY, JSON.stringify(restored));
      localStorage.setItem(BT_LAST_SENT_KEY, String(lastSent));
    } catch (_) {}
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
      libraryAxisFilter: "bib_eje",
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

  // 4. Despliegue de tarjetas/acordeones informativos (ignorando apertura inicial del DOM)
  const btAccordionReadyAt = Date.now() + 1800;
  document.addEventListener(
    "toggle",
    (e) => {
      if (Date.now() < btAccordionReadyAt) return;
      const det = e.target;
      if (det && det.matches && det.matches("details.bt-acc-card") && det.open) {
        const title = (det.querySelector("h3") || {}).textContent || "";
        bumpStatCounter("topFilters", `acordeon:${title}`, 25);
        enqueueAnonTelemetry({ t: "filtro_usado", filtro: "acordeon_abierto", valor: title.trim() }, false);
      }
    },
    true
  );

  // 5. Captura anónima de errores JS / bugs reales de ejecución (filtrando ruido benigno de ciclo de vida iOS/WebKit y Android WebView)
  const isBenignBrowserNoise = (rawMsg, rawFile = "") => {
    const m = String(rawMsg || "").trim();
    if (!m) return true;
    if (/^Script error\.?$/i.test(m) && !rawFile) return true;
    if (/ResizeObserver loop/i.test(m)) return true;
    if (/AbortError|The operation was aborted|signal is aborted|cancelled|canceled/i.test(m)) return true;
    if (/Worker was terminated|RenderingCancelledException/i.test(m)) return true;
    if (/Java object is gone|NPObject|postMessage|navigation_performance_logger|webkit\.messageHandlers/i.test(m) || /navigation_performance_logger/i.test(String(rawFile || ""))) return true;
    if ((/Load failed|Failed to fetch|NetworkError/i.test(m)) && (document.visibilityState === "hidden" || navigator.onLine === false)) return true;
    return false;
  };
  window.addEventListener("error", (ev) => {
    if (!hasTelemetryConsent() || !ev || !ev.message) return;
    if (isBenignBrowserNoise(ev.message, ev.filename)) return;
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
    if (isBenignBrowserNoise(msg, "promise_rejection")) return;
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
          ? "Reporte registrado. Estoy revisando constantemente cada aviso para mejorar las respuestas; quedará atendido en aprox. 2 a 7 días como máximo."
          : "Valoración anónima registrada. Gracias por ayudar a mejorar BiblioTech."
      );
    } else {
      if (ratingType === "issue" && typeof window.__btOpenBugReport === "function") {
        window.__btOpenBugReport("Buscador de preguntas", ctx.query || "", false);
      } else {
        showWebToast(
          ratingType === "issue"
            ? `Gracias por avisar. Puedes detallarlo en ${STATE.contactEmail} (atención en aprox. 2 a 7 días como máximo).`
            : "Gracias por tu valoración."
        );
      }
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
// BOVEDA LOCAL DE AUTOLLENADO SCOUT + EDITOR DE ARCHIVOS OFICIALES
// ============================================================================

const BT_AUTOFILL_PROFILE_KEY = "bt_autofill_profile_v1";

const OFFICIAL_PROVINCE_NAMES = ASMAC_PROVINCES_DIRECTORY.map((p) => p.name);
const OFFICIAL_PROVINCE_SELECT_OPTIONS = ["", ...OFFICIAL_PROVINCE_NAMES, "Otro"];
const OFFICIAL_SECTION_SELECT_OPTIONS = ["", "Manada", "Tropa", "Comunidad", "Clan", "Scouters o Dirigentes", "Otro"];

function ensureProvincesDatalist() {
  if (document.getElementById("officialProvincesDatalist")) return;
  const dl = document.createElement("datalist");
  dl.id = "officialProvincesDatalist";
  dl.innerHTML = OFFICIAL_PROVINCE_NAMES.map((n) => `<option value="${escapeHtml(n)}"></option>`).join("");
  document.body.appendChild(dl);
}

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
  ensureProvincesDatalist();
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
    section: (fields.section ? fields.section.value : "").trim(),
    group: (fields.group ? fields.group.value : "").trim(),
    province: (fields.province ? fields.province.value : "").trim(),
    blood: (fields.blood ? fields.blood.value : "").trim(),
    emergency: (fields.emergency ? fields.emergency.value : "").trim(),
    scouter: (fields.scouter ? fields.scouter.value : "").trim()
  });

  const hasAnySavedData = (prof) =>
    Boolean(
      prof &&
        (prof.name || prof.cum || prof.age || prof.section || prof.group || prof.province || prof.blood || prof.emergency || prof.scouter)
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
            <div class="autofill-demo-row"><span>Participante:</span><span class="autofill-demo-fill">${val("name", "(Escribe aquí tu nombre)")}</span></div>
            <div class="autofill-demo-row"><span>CUM / Nacimiento:</span><span class="autofill-demo-fill">${val("cum", "—")} · ${val("age", "—")}</span></div>
            <div class="autofill-demo-row"><span>Grupo / Prov.:</span><span class="autofill-demo-fill">${val("group", "—")} · ${val("province", "—")}</span></div>
            <div class="autofill-demo-row"><span>Autoriza:</span><span class="autofill-demo-fill">${val("emergency", "(Contacto)")}</span></div>
            <div class="autofill-demo-row"><span>Responsable:</span><span class="autofill-demo-fill">${val("scouter", "(Adulto responsable)")}</span></div>
          </div>
        </div>

        <div class="autofill-demo-doc">
          <div class="autofill-demo-doc-head">Ficha de Salud</div>
          <div class="autofill-demo-rows">
            <div class="autofill-demo-row"><span>Nombre:</span><span class="autofill-demo-fill">${val("name", "(Escribe aquí tu nombre)")}</span></div>
            <div class="autofill-demo-row"><span>Sección:</span><span class="autofill-demo-fill">${val("section", "(Selecciona tu sección)")}</span></div>
            <div class="autofill-demo-row"><span>Grupo y Rh:</span><span class="autofill-demo-fill">${val("blood", "(Sin completar)")}</span></div>
            <div class="autofill-demo-row"><span>Contacto SOS:</span><span class="autofill-demo-fill">${val("emergency", "(Contacto)")}</span></div>
          </div>
        </div>

        <div class="autofill-demo-doc">
          <div class="autofill-demo-doc-head">Proyecto / Especialidad</div>
          <div class="autofill-demo-rows">
            <div class="autofill-demo-row"><span>Participante:</span><span class="autofill-demo-fill">${val("name", "(Escribe aquí tu nombre)")}</span></div>
            <div class="autofill-demo-row"><span>Sección:</span><span class="autofill-demo-fill">${val("section", "(Selecciona tu sección)")}</span></div>
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
      if (fields.section) fields.section.value = "";
      updateBadge({});
      if (demoBox) demoBox.classList.add("hidden");
      if (previewBtn) previewBtn.textContent = "Ver demostración de autollenado";
      showWebToast("Datos locales de autollenado borrados de este dispositivo.");
    });
  }

  const exportBtn = document.getElementById("btnExportAutofillProfile");
  const importBtn = document.getElementById("btnImportAutofillProfile");
  const importInput = document.getElementById("inputImportAutofillProfile");

  const doExportProfile = () => {
    const prof = hasAnySavedData(readFormProfile()) ? readFormProfile() : getAutofillProfile();
    if (!hasAnySavedData(prof)) {
      showWebToast("Primero guarda al menos un dato en tu perfil para poder exportarlo.");
      return;
    }
    const payload = {
      schema: "bibliotech-autofill-v1",
      exportedAt: new Date().toISOString(),
      profile: prof
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bibliotech-autollenado-scout.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    showWebToast("Respaldo .json de autollenado descargado en tu dispositivo.");
    enqueueAnonTelemetry({ t: "ui_accion", label: "autofill_export_json" }, false);
  };

  const handleImportFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result || "{}"));
        const src = raw && typeof raw.profile === "object" ? raw.profile : raw;
        if (!src || typeof src !== "object") throw new Error("Formato inválido");
        const cleanProf = {
          name: String(src.name || "").trim().slice(0, 120),
          cum: String(src.cum || "").trim().toUpperCase().slice(0, 32),
          age: String(src.age || "").trim().slice(0, 40),
          section: String(src.section || "").trim().slice(0, 60),
          group: String(src.group || "").trim().slice(0, 80),
          province: String(src.province || "").trim().slice(0, 80),
          blood: String(src.blood || "").trim().slice(0, 20),
          emergency: String(src.emergency || "").trim().slice(0, 140),
          scouter: String(src.scouter || "").trim().slice(0, 120)
        };
        if (!hasAnySavedData(cleanProf)) throw new Error("Sin campos válidos");
        localStorage.setItem(BT_AUTOFILL_PROFILE_KEY, JSON.stringify(cleanProf));
        fillFormFromStorage();
        if (demoBox && !demoBox.classList.contains("hidden")) renderDemo(cleanProf);
        if (typeof window.__btSyncSmartFormFromProfile === "function") {
          window.__btSyncSmartFormFromProfile(cleanProf, false);
        }
        if (typeof window.__btRefreshSettingsDataPane === "function") {
          window.__btRefreshSettingsDataPane();
        }
        showWebToast("Datos de autollenado importados y activados correctamente.");
        enqueueAnonTelemetry({ t: "ui_accion", label: "autofill_import_json" }, false);
      } catch (_) {
        showWebToast("No se pudo leer el archivo .json de respaldo. Verifica que sea válido.");
      }
    };
    reader.readAsText(file, "utf-8");
  };

  if (exportBtn) exportBtn.addEventListener("click", doExportProfile);
  if (importBtn && importInput) {
    importBtn.addEventListener("click", () => {
      importInput.value = "";
      importInput.click();
    });
    importInput.addEventListener("change", () => {
      const f = importInput.files && importInput.files[0];
      if (f) handleImportFile(f);
    });
  }
  window.__btExportAutofillProfile = doExportProfile;
  window.__btTriggerImportAutofillProfile = () => {
    if (importInput) {
      importInput.value = "";
      importInput.click();
    }
  };

  setupSmartFormsEngine(readFormProfile);
}

// ============================================================================
// EDITOR DE ARCHIVOS SCOUT (100% OFICIALES ASMAC, PDF Y PNG)
// ============================================================================
const BT_SF_ACTIVE_PREFIX = "bt_sf_active_v2_";
const BT_SF_DRAFTS_KEY = "bt_sf_named_drafts_v2";

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const DAYS_LIST = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const YEARS_26_99 = Array.from({ length: 74 }, (_, i) => String(26 + i));

// 24 Antecedentes del Historial Médico (Página 1 de Ficha de Salud)
const HEALTH_ANTECEDENTES_LIST = [
  // Columna izquierda (x_sino = 32.6, w_sino = 7.0; x_esp = 39.8, w_esp = 13.4)
  { key: "mh_diabetes", label: "DIABETES", col: "left", y: 46.9, h: 1.1 },
  { key: "mh_hipertension", label: "HIPERTENSIÓN", col: "left", y: 48.0, h: 1.1 },
  { key: "mh_epileptico", label: "EVENTO EPILÉPTICO", col: "left", y: 49.2, h: 1.1 },
  { key: "mh_cardiaco", label: "PROBLEMA CARDÍACO", col: "left", y: 50.4, h: 1.1 },
  { key: "mh_desmayos", label: "DESMAYOS Y/O MAREOS", col: "left", y: 51.6, h: 1.1 },
  { key: "mh_asma", label: "ASMA", col: "left", y: 52.8, h: 1.1 },
  { key: "mh_toxicomanias", label: "TOXICOMANÍAS", col: "left", y: 53.9, h: 1.1 },
  { key: "mh_cirugia", label: "CIRUGÍA RECIENTE", col: "left", y: 55.1, h: 1.1 },
  { key: "mh_embarazo", label: "EMBARAZO Y/O PUERPERIO", col: "left", y: 56.3, h: 1.1 },
  { key: "mh_transfusion", label: "TRANSFUSIÓN", col: "left", y: 57.4, h: 1.1 },
  { key: "mh_musculo", label: "LESIÓN MÚSCULO ESQUELÉTICA", col: "left", y: 58.6, h: 1.1 },
  { key: "mh_ortopedicos", label: "ORTOPÉDICOS", col: "left", y: 59.8, h: 1.1 },
  // Columna derecha (x_sino = 70.9, w_sino = 6.8; x_esp = 77.9, w_esp = 16.8)
  { key: "mh_respiratorios", label: "RESPIRATORIOS", col: "right", y: 46.9, h: 1.1 },
  { key: "mh_oftalmicos", label: "OFTÁLMICOS", col: "right", y: 48.0, h: 1.1 },
  { key: "mh_nariz_oidos", label: "NARÍZ Y/U OÍDOS", col: "right", y: 49.2, h: 1.1 },
  { key: "mh_neurologicos", label: "NEUROLÓGICOS", col: "right", y: 50.4, h: 1.1 },
  { key: "mh_hematologicos", label: "HEMATOLÓGICOS", col: "right", y: 51.6, h: 1.1 },
  { key: "mh_hepaticos", label: "HEPÁTICOS", col: "right", y: 52.8, h: 1.1 },
  { key: "mh_digestivo", label: "APARATO DIGESTIVO", col: "right", y: 53.9, h: 1.1 },
  { key: "mh_tiroideo", label: "TIROIDEO", col: "right", y: 55.1, h: 1.1 },
  { key: "mh_dermatologico", label: "DERMATOLÓGICO", col: "right", y: 56.3, h: 1.1 },
  { key: "mh_inmunologicos", label: "INMUNOLÓGICOS", col: "right", y: 57.4, h: 1.1 },
  { key: "mh_urinarios", label: "URINARIOS", col: "right", y: 58.6, h: 1.1 },
  { key: "mh_covid", label: "COVID-19", col: "right", y: 59.8, h: 1.1 }
];

// 13 Antecedentes Psicológicos/Psiquiátricos (Página 1 de Ficha de Salud)
const PSYCH_ANTECEDENTES_LIST = [
  // Columna izquierda (x_sino = 33.6, w_sino = 6.4; x_esp = 40.2, w_esp = 11.3)
  { key: "ps_alimentacion", label: "CAMBIOS EN ALIMENTACIÓN", col: "left", y: 64.6, h: 1.1 },
  { key: "ps_aislamiento", label: "AISLAMIENTO PERSONAL", col: "left", y: 65.8, h: 1.2 },
  { key: "ps_vacio", label: "SENSACIÓN DE VACÍO O SIN IMPORTANCIA", col: "left", y: 67.3, h: 1.8 },
  { key: "ps_impotencia", label: "IMPOTENCIA O DESESPERANZA", col: "left", y: 69.2, h: 1.1 },
  { key: "ps_confusion", label: "CONFUSIÓN, DISTRACCIÓN O IRRITABILIDAD", col: "left", y: 70.6, h: 2.0 },
  { key: "ps_pensamientos", label: "PENSAMIENTOS Y/O RECUERDOS QUE NO SALGAN DE SU CABEZA", col: "left", y: 73.0, h: 2.1 },
  { key: "ps_lastimarse", label: "PENSAR LASTIMARSE A SÍ MISMO U OTROS", col: "left", y: 75.3, h: 2.1 },
  // Columna derecha (x_sino = 76.7, w_sino = 6.7; x_esp = 83.6, w_esp = 11.2)
  { key: "ps_sueno", label: "ALTERACIONES DEL SUEÑO", col: "right", y: 64.6, h: 1.1 },
  { key: "ps_agotamiento", label: "AGOTAMIENTO EXCESIVO / DOLORES INEXPLICABLES", col: "right", y: 65.8, h: 1.2 },
  { key: "ps_toxicomanias", label: "AUMENTO EN TOXICOMANÍAS", col: "right", y: 67.3, h: 1.8 },
  { key: "ps_humor", label: "CAMBIOS DE HUMOR", col: "right", y: 69.2, h: 1.1 },
  { key: "ps_voces", label: "ESCUCHAR VOCES O CREER COSAS QUE NO SON CIERTAS", col: "right", y: 70.6, h: 2.0 },
  { key: "ps_tareas", label: "DIFICULTAD PARA REALIZAR TAREAS DIARIAS", col: "right", y: 73.0, h: 2.1 }
];

// Filas de Inmunología (Página 2 de Ficha de Salud)
const IMMUNO_LEFT_ROWS = [
  { key: "im_tetanos", label: "TÉTANOS", y: 19.6, h: 1.2, hasPadecio: true },
  { key: "im_difteria", label: "DIFTERIA", y: 20.8, h: 1.2, hasPadecio: true },
  { key: "im_sarampion", label: "SARAMPIÓN / RUBEOLA", y: 22.3, h: 2.6, hasPadecio: true },
  { key: "im_paperas", label: "PAPERAS", y: 25.3, h: 1.2, hasPadecio: true },
  { key: "im_polio", label: "POLIOMIELITIS", y: 26.7, h: 2.0, hasPadecio: true },
  { key: "im_rotavirus", label: "ROTAVIRUS", y: 29.0, h: 1.9, hasPadecio: true },
  { key: "im_covid1", label: "COVID 1ª DOSIS", y: 31.3, h: 2.1, hasPadecio: false },
  { key: "im_covid_ref", label: "COVID REFUERZO", y: 33.8, h: 2.6, hasPadecio: false }
];

const IMMUNO_RIGHT_ROWS = [
  { key: "im_influenza", label: "INFLUENZA", y: 19.6, h: 1.2, hasPadecio: true },
  { key: "im_papiloma", label: "PAPILOMA", y: 20.8, h: 1.2, hasPadecio: true },
  { key: "im_hepatitis", label: "HEPATITIS", y: 22.3, h: 2.6, hasPadecio: true },
  { key: "im_meningitis", label: "MENINGITIS", y: 25.3, h: 1.2, hasPadecio: true }
];

function buildSaludPage1Boxes() {
  const boxes = [
    // Fecha: A __Día__ DE __Mes__ DE 20__Año__
    { key: "fechaDia", x: 71.2, y: 13.4, w: 7.8, h: 1.2, align: "center" },
    { key: "fechaMes", x: 81.3, y: 13.4, w: 8.8, h: 1.2, align: "center" },
    { key: "fechaAnio", x: 93.8, y: 13.4, w: 2.6, h: 1.2, align: "left" },
    // Datos de Identificación
    { key: "name", x: 20.2, y: 15.9, w: 40.6, h: 1.2 },
    { key: "birthDate", x: 81.4, y: 15.9, w: 13.3, h: 1.2, align: "center" },
    { key: "_provinceOut", x: 20.2, y: 17.2, w: 40.6, h: 1.2 },
    { key: "group", x: 81.4, y: 17.2, w: 13.3, h: 1.2 },
    { key: "cum", x: 20.2, y: 18.4, w: 40.6, h: 1.2 },
    { key: "_sectionOut", x: 81.4, y: 18.4, w: 13.3, h: 1.2 },
    // Alerta
    { key: "alertText", x: 8.6, y: 20.9, w: 86.0, h: 2.1, multiline: true },
    // Datos Médicos Generales
    { key: "_bloodCombined", x: 21.3, y: 24.4, w: 12.4, h: 1.2, align: "center" },
    { key: "_weightFormatted", x: 21.3, y: 25.8, w: 12.4, h: 1.9, align: "center" },
    { key: "_heightFormatted", x: 21.3, y: 27.9, w: 12.4, h: 1.1, align: "center" },
    { key: "_imcCalculated", x: 21.3, y: 29.1, w: 12.4, h: 1.1, align: "center" },
    { key: "diet", x: 21.3, y: 30.3, w: 12.4, h: 1.1, align: "center" },
    // Afiliaciones a Servicios de Salud (Checkboxes + 4 filas)
    { key: "_medTypePub", x: 55.2, y: 25.7, w: 1.4, h: 1.1, align: "center" },
    { key: "_medTypeAseg", x: 69.9, y: 26.1, w: 1.4, h: 1.1, align: "center" },
    { key: "_medTypePart", x: 84.6, y: 26.1, w: 1.4, h: 1.1, align: "center" },
    { key: "medProvider", x: 53.8, y: 27.9, w: 40.8, h: 1.1 },
    { key: "medPolicy", x: 53.8, y: 29.1, w: 40.8, h: 1.1 },
    { key: "medEntitlement", x: 53.8, y: 30.3, w: 40.8, h: 1.1 },
    { key: "medServiceNotes", x: 53.8, y: 31.4, w: 40.8, h: 1.1 },
    // Alergias y Tratamientos Actuales
    { key: "_allergiesOut", x: 8.6, y: 34.9, w: 86.0, h: 2.2, multiline: true },
    { key: "_medicationsOut", x: 8.6, y: 39.7, w: 86.0, h: 2.1, multiline: true },
    // Historial Médico (últimos 6 meses)
    { key: "_medHistory6mOut", x: 8.6, y: 44.4, w: 86.0, h: 1.1 },
    // Antecedentes Psicológicos/Psiquiátricos (últimos 6 meses)
    { key: "_psyHistory6mOut", x: 71.0, y: 62.1, w: 23.5, h: 1.1 },
    // Tratamiento médico controlado (final de página 1)
    { key: "controlledTreatment", x: 8.8, y: 81.2, w: 85.8, h: 6.0, multiline: true }
  ];

  for (const item of HEALTH_ANTECEDENTES_LIST) {
    const isLeft = item.col === "left";
    boxes.push({
      key: `_${item.key}_sino`,
      x: isLeft ? 32.6 : 70.9,
      y: item.y,
      w: isLeft ? 7.0 : 6.8,
      h: item.h,
      align: "center"
    });
    boxes.push({
      key: `${item.key}_esp`,
      x: isLeft ? 39.8 : 77.9,
      y: item.y,
      w: isLeft ? 13.4 : 16.8,
      h: item.h
    });
  }

  for (const item of PSYCH_ANTECEDENTES_LIST) {
    const isLeft = item.col === "left";
    boxes.push({
      key: `_${item.key}_sino`,
      x: isLeft ? 33.6 : 76.7,
      y: item.y,
      w: isLeft ? 6.4 : 6.7,
      h: item.h,
      align: "center"
    });
    boxes.push({
      key: `${item.key}_esp`,
      x: isLeft ? 40.2 : 83.6,
      y: item.y,
      w: isLeft ? 11.3 : 11.2,
      h: item.h
    });
  }

  return boxes;
}

function buildSaludPage2Boxes() {
  const boxes = [];
  // Inmunología tabla izquierda
  for (const r of IMMUNO_LEFT_ROWS) {
    boxes.push({ key: `${r.key}_vac`, x: 17.4, y: r.y, w: 12.4, h: r.h, align: "center" });
    boxes.push({ key: `${r.key}_fvac`, x: 30.0, y: r.y, w: 7.3, h: r.h, align: "center" });
    if (r.hasPadecio) {
      boxes.push({ key: `${r.key}_pad`, x: 37.5, y: r.y, w: 7.8, h: r.h, align: "center" });
      boxes.push({ key: `${r.key}_fpad`, x: 45.5, y: r.y, w: 7.1, h: r.h, align: "center" });
    }
  }
  // Inmunología tabla derecha
  for (const r of IMMUNO_RIGHT_ROWS) {
    boxes.push({ key: `${r.key}_vac`, x: 65.3, y: r.y, w: 7.7, h: r.h, align: "center" });
    boxes.push({ key: `${r.key}_fvac`, x: 73.2, y: r.y, w: 6.6, h: r.h, align: "center" });
    boxes.push({ key: `${r.key}_pad`, x: 80.0, y: r.y, w: 8.2, h: r.h, align: "center" });
    boxes.push({ key: `${r.key}_fpad`, x: 88.4, y: r.y, w: 6.7, h: r.h, align: "center" });
  }
  // Reacción a vacunas, Otras, Covid 2a dosis y Marcas Covid (1a a 4a dosis)
  boxes.push({ key: "im_reaccion", x: 65.3, y: 26.7, w: 29.8, h: 2.0 });
  boxes.push({ key: "im_otras", x: 65.3, y: 29.0, w: 29.8, h: 1.9 });
  boxes.push({ key: "im_covid2_vac", x: 65.3, y: 31.3, w: 7.7, h: 2.1, align: "center" });
  boxes.push({ key: "im_covid2_fvac", x: 73.2, y: 31.3, w: 6.6, h: 2.1, align: "center" });
  boxes.push({ key: "im_covid_marca1", x: 65.3, y: 34.8, w: 7.7, h: 1.8, align: "center" });
  boxes.push({ key: "im_covid_marca2", x: 73.2, y: 34.8, w: 6.6, h: 1.8, align: "center" });
  boxes.push({ key: "im_covid_marca3", x: 80.0, y: 34.8, w: 8.2, h: 1.8, align: "center" });
  boxes.push({ key: "im_covid_marca4", x: 88.4, y: 34.8, w: 6.7, h: 1.8, align: "center" });

  // Contacto de Emergencias — Contacto 1 y Contacto 2 (Observaciones y Firmas se dejan en blanco para llenar a mano)
  boxes.push({ key: "em1_name", x: 21.0, y: 39.4, w: 33.8, h: 1.1 });
  boxes.push({ key: "em1_relation", x: 68.0, y: 39.4, w: 27.0, h: 1.1 });
  boxes.push({ key: "em1_phone1", x: 21.0, y: 40.5, w: 33.8, h: 1.1 });
  boxes.push({ key: "em1_phone2", x: 68.0, y: 40.5, w: 27.0, h: 1.1 });
  boxes.push({ key: "em1_address", x: 21.0, y: 41.7, w: 33.8, h: 1.1 });
  boxes.push({ key: "em1_email", x: 68.0, y: 41.7, w: 27.0, h: 1.1 });

  boxes.push({ key: "em2_name", x: 21.0, y: 44.1, w: 33.8, h: 1.1 });
  boxes.push({ key: "em2_relation", x: 68.0, y: 44.1, w: 27.0, h: 1.1 });
  boxes.push({ key: "em2_phone1", x: 21.0, y: 45.3, w: 33.8, h: 1.1 });
  boxes.push({ key: "em2_phone2", x: 68.0, y: 45.3, w: 27.0, h: 1.1 });
  boxes.push({ key: "em2_address", x: 21.0, y: 46.4, w: 33.8, h: 1.1 });
  boxes.push({ key: "em2_email", x: 68.0, y: 46.4, w: 27.0, h: 1.1 });

  return boxes;
}

function buildJl304Page1Boxes() {
  const digitXs = [45.9, 51.2, 56.5, 61.8, 67.2, 72.5, 77.8, 83.1];
  const boxes = [];
  // 8 casillas de Fecha de autorización: (D1)(D2)(M1)(M2)(Y1)(Y2)(Y3)(Y4)
  digitXs.forEach((dx, i) => {
    boxes.push({ key: `_authD${i}`, x: dx, y: 15.7, w: 5.2, h: 1.8, align: "center" });
  });
  // Nombre(s), Primer Apellido, Segundo Apellido separados
  boxes.push({ key: "firstName", x: 11.8, y: 25.4, w: 23.6, h: 2.2, align: "center" });
  boxes.push({ key: "lastName1", x: 35.8, y: 25.4, w: 23.8, h: 2.2, align: "center" });
  boxes.push({ key: "lastName2", x: 60.0, y: 25.4, w: 28.0, h: 2.2, align: "center" });
  // 8 casillas de Fecha de nacimiento: (D1)(D2)(M1)(M2)(Y1)(Y2)(Y3)(Y4)
  digitXs.forEach((dx, i) => {
    boxes.push({ key: `_birthD${i}`, x: dx, y: 34.7, w: 5.2, h: 1.8, align: "center" });
  });
  // Líneas del permiso en Página 1
  boxes.push({ key: "destination", x: 11.8, y: 47.7, w: 55.5, h: 1.5 });
  boxes.push({ key: "eventDates", x: 22.3, y: 49.3, w: 52.0, h: 1.5 });
  boxes.push({ key: "scouter", x: 35.0, y: 53.7, w: 46.5, h: 1.5 });
  return boxes;
}

const SMART_FORM_TEMPLATES = {
  salud: {
    id: "salud",
    code: "ASMAC-SALUD",
    exportPrefix: "Ficha de Salud",
    baseDocId: "doc-0325",
    baseDocName: "FICHA MÉDICA EDITABLE.pdf",
    title: "Ficha de Salud Oficial ASMAC (2 páginas)",
    subtitle: "Documento oficial FICHA MÉDICA EDITABLE.pdf de ASMAC",
    officialPages: [
      {
        src: "img/forms/salud_p1.webp",
        aspect: "1311 / 1853",
        boxes: buildSaludPage1Boxes()
      },
      {
        src: "img/forms/salud_p2.webp",
        aspect: "1311 / 1853",
        boxes: buildSaludPage2Boxes()
      }
    ],
    fields: [
      { type: "section_heading", label: "Fecha de la Ficha (A __ Día __ De __ Mes __ de 20__26-99__)" },
      { key: "fechaDia", label: "Día", type: "select", options: DAYS_LIST, defaultTodayDay: true },
      { key: "fechaMes", label: "Mes", type: "select", options: MONTHS_ES, defaultTodayMonth: true },
      { key: "fechaAnio", label: "Año (2026 - 2099)", type: "select", options: YEARS_26_99, defaultValue: "26" },

      { type: "section_heading", label: "Datos de Identificación" },
      { key: "name", label: "Nombre completo", type: "text", bind: "name", placeholder: "Escribe aquí tu nombre completo" },
      { key: "province", label: "Provincia Scout", type: "select", options: OFFICIAL_PROVINCE_SELECT_OPTIONS, allowOther: true, bind: "province", otherPlaceholder: "Escribe aquí la Provincia o caso especial" },
      { key: "cum", label: "CUM", type: "text", bind: "cum", placeholder: "Escribe aquí tu CUM" },
      { key: "birthDate", label: "Fecha de Nacimiento (Día/Mes/Año)", type: "text", bind: "age", placeholder: "Día / Mes / Año" },
      { key: "group", label: "Grupo Scout", type: "text", bind: "group", placeholder: "Escribe aquí tu número o nombre de Grupo" },
      { key: "section", label: "Sección", type: "select", options: OFFICIAL_SECTION_SELECT_OPTIONS, allowOther: true, bind: "section", otherPlaceholder: "Escribe aquí la sección o cargo" },

      { type: "section_heading", label: "Alerta" },
      { key: "alertText", label: "Alerta médica crítica", type: "text", full: true, placeholder: "Escribe aquí cualquier alerta médica urgente (o déjalo vacío)" },

      { type: "section_heading", label: "Datos Médicos Generales" },
      { key: "bloodGroup", label: "Grupo sanguíneo (A / B / AB / O)", type: "select", options: ["", "O", "A", "B", "AB"] },
      { key: "bloodRh", label: "Factor RH (+ / -)", type: "select", options: ["", "+", "-"] },
      { key: "weightKg", label: "Peso (solo números, se agrega kg automáticamente)", type: "number", placeholder: "Escribe tu peso en kg (ej. 70)" },
      { key: "heightM", label: "Talla / Altura en metros", type: "number", step: "0.01", placeholder: "Escribe tu altura en metros (ej. 1.70)" },
      { key: "_imcPreview", label: "I.M.C. (Calculado automáticamente: Peso ÷ Altura²)", type: "readonly", placeholder: "Se calcula al escribir Peso y Talla" },
      { key: "diet", label: "Alimentación", type: "text", placeholder: "Escribe aquí tu tipo de alimentación" },

      { type: "section_heading", label: "Afiliaciones a Servicios de Salud" },
      { key: "medServiceType", label: "Tipo de institución", type: "select", options: ["", "Instituciones Públicas", "Aseguradoras", "Particular"] },
      { key: "medProvider", label: "Nombre del proveedor", type: "text", placeholder: "Escribe aquí el nombre del proveedor médico" },
      { key: "medPolicy", label: "No. de póliza / afiliación", type: "text", placeholder: "Escribe aquí el número de póliza o afiliación" },
      { key: "medEntitlement", label: "Derechohabiencia", type: "text", placeholder: "Escribe aquí la derechohabiencia" },
      { key: "medServiceNotes", label: "Observaciones de afiliación", type: "text", full: true, placeholder: "Escribe aquí observaciones del servicio médico" },

      { type: "section_heading", label: "Alergias y Tratamientos Actuales" },
      { key: "allergies", label: "Alergias — Especificar agente alérgico y reacción que provoca", type: "textarea", full: true, placeholder: "Escribe aquí tus alergias (si lo dejas vacío se pondrá «Ninguna» en el documento)" },
      { key: "medications", label: "Tratamientos actuales — Especificar medicamento, dosis y periodicidad de toma", type: "textarea", full: true, placeholder: "Escribe aquí tus medicamentos actuales (si lo dejas vacío se pondrá «Ninguno» en el documento)" },

      { type: "section_heading", label: "Historial Médico (Marca con check si es SÍ para habilitar Especifique; sin check se marca NO)" },
      { key: "medHistory6m", label: "¿En los últimos 6 meses has presentado alguno de los siguientes antecedentes?", type: "text", full: true, placeholder: "Si lo dejas vacío se pondrá «No he presentado» en el documento" },
      { type: "antecedentes_grid", groupId: "health_antecedentes", items: HEALTH_ANTECEDENTES_LIST },

      { type: "section_heading", label: "Antecedentes Psicológicos / Psiquiátricos (Marca con check si es SÍ para habilitar Especifique; sin check se marca NO)" },
      { key: "psyHistory6m", label: "¿En los últimos 6 meses ha presentado alguno de los siguientes antecedentes?", type: "text", full: true, placeholder: "Si lo dejas vacío se pondrá «No he presentado» en el documento" },
      { type: "antecedentes_grid", groupId: "psych_antecedentes", items: PSYCH_ANTECEDENTES_LIST },

      { type: "section_heading", label: "Tratamiento Médico Controlado (Página 1)" },
      { key: "controlledTreatment", label: "En caso de encontrarse bajo tratamiento médico controlado describa las dosis y procedimientos indicados", type: "textarea", full: true, placeholder: "Si no aplica, déjalo vacío y quedará en blanco en el documento" },

      { type: "section_heading", label: "Inmunología — Vacunas y Padecimientos (Página 2)" },
      { type: "immuno_grid" },

      { type: "section_heading", label: "Contacto de Emergencias — Contacto 1 (Página 2)" },
      { key: "em1_name", label: "Nombre (Contacto 1)", type: "text", bind: "emergency", placeholder: "Escribe aquí el nombre del Contacto 1" },
      { key: "em1_relation", label: "Parentesco (Contacto 1)", type: "text", placeholder: "Escribe aquí el parentesco" },
      { key: "em1_phone1", label: "Teléfono (Contacto 1)", type: "text", placeholder: "Escribe aquí el teléfono principal" },
      { key: "em1_phone2", label: "Teléfono 2 (Contacto 1)", type: "text", placeholder: "Escribe aquí el segundo teléfono" },
      { key: "em1_address", label: "Dirección (Contacto 1)", type: "text", placeholder: "Escribe aquí la dirección" },
      { key: "em1_email", label: "Correo electrónico (Contacto 1)", type: "text", placeholder: "Escribe aquí el correo electrónico" },

      { type: "section_heading", label: "Contacto de Emergencias — Contacto 2 (Página 2)" },
      { key: "em2_name", label: "Nombre (Contacto 2)", type: "text", placeholder: "Escribe aquí el nombre del Contacto 2" },
      { key: "em2_relation", label: "Parentesco (Contacto 2)", type: "text", placeholder: "Escribe aquí el parentesco" },
      { key: "em2_phone1", label: "Teléfono (Contacto 2)", type: "text", placeholder: "Escribe aquí el teléfono principal" },
      { key: "em2_phone2", label: "Teléfono 2 (Contacto 2)", type: "text", placeholder: "Escribe aquí el segundo teléfono" },
      { key: "em2_address", label: "Dirección (Contacto 2)", type: "text", placeholder: "Escribe aquí la dirección" },
      { key: "em2_email", label: "Correo electrónico (Contacto 2)", type: "text", placeholder: "Escribe aquí el correo electrónico" }
    ]
  },

  jl304: {
    id: "jl304",
    code: "ASMAC-JL304",
    exportPrefix: "Permiso de Salida",
    baseDocId: "doc-0305",
    baseDocName: "ASMAC/DNGDI/CNAR/JL306 — Autorización de eventos",
    title: "Autorización de Participación en Eventos (JL304 / JL306 · 2 páginas)",
    subtitle: "Documento oficial ASMAC/DNGDI/CNAR/JL306",
    officialPages: [
      {
        src: "img/forms/jl304_p1.webp",
        aspect: "1347 / 1743",
        boxes: buildJl304Page1Boxes()
      },
      {
        src: "img/forms/jl304_p2.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "_mediaConsentYes", x: 17.5, y: 64.5, w: 2.6, h: 2.2, align: "center", isCheck: true, checkSymbol: "X" },
          { key: "_mediaConsentNo", x: 17.5, y: 69.0, w: 2.6, h: 2.2, align: "center", isCheck: true, checkSymbol: "X" },
          { key: "_userSignature", x: 34.0, y: 76.2, w: 32.0, h: 6.5, isSignature: true }
        ]
      }
    ],
    fields: [
      { type: "section_heading", label: "Fechas en casillas separadas (Día / Mes / Año)" },
      { key: "authDate", label: "Fecha de autorización (Día/Mes/Año)", type: "text", defaultTodaySlash: true, placeholder: "DD / MM / AAAA (ej. 18/11/2026)" },
      { key: "birthDate", label: "Fecha de nacimiento del menor (Día/Mes/Año)", type: "text", bind: "age", placeholder: "DD / MM / AAAA (ej. 14/05/2010)" },

      { type: "section_heading", label: "Datos del menor (separados por casilla oficial)" },
      { key: "firstName", label: "Nombre(s)", type: "text", placeholder: "Escribe aquí solo el/los nombre(s)" },
      { key: "lastName1", label: "Primer Apellido", type: "text", placeholder: "Escribe aquí el primer apellido" },
      { key: "lastName2", label: "Segundo Apellido", type: "text", placeholder: "Escribe aquí el segundo apellido" },

      { type: "section_heading", label: "Datos del evento y acompañante autorizado (Página 1)" },
      { key: "destination", label: "Lugar del evento denominado", type: "text", full: true, placeholder: "Escribe aquí el lugar y nombre del evento o campamento" },
      { key: "eventDates", label: "Fecha(s) en que se llevará a cabo", type: "text", full: true, placeholder: "Escribe aquí las fechas del evento" },
      { key: "scouter", label: "Autorizo en este acto a (Adulto / Scouter acompañante)", type: "text", full: true, bind: "scouter", placeholder: "Escribe aquí el nombre completo del adulto o Scouter acompañante" },

      { type: "section_heading", label: "Consentimiento para medios de comunicación (Página 2 · Las firmas se llenan a mano)" },
      { key: "mediaConsent", label: "Autorizo al menor a participar con los medios de comunicación del evento", type: "single_checkbox", defaultChecked: true }
    ]
  },

  fes: {
    id: "fes",
    code: "PLANTILLA P5.1 · FES",
    exportPrefix: "Ficha de Especialidad",
    baseDocId: "doc-0695",
    baseDocName: "P5.1_PlantillaEspecialidad_v1.1.pdf",
    title: "Ficha de Especialidad Scout (Plantilla Oficial P5.1)",
    subtitle: "Documento oficial P5.1_PlantillaEspecialidad_v1.1.pdf de RECME ASMAC",
    officialPages: [
      {
        src: "img/forms/fes_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "specialtyName", x: 5.2, y: 8.4, w: 58.0, h: 3.6 },
          { key: "_sectionOut", x: 69.5, y: 8.4, w: 24.5, h: 3.6 },
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
      { key: "name", label: "Elaboró (Nombre del Scout)", type: "text", bind: "name", placeholder: "Escribe aquí tu nombre completo" },
      { key: "section", label: "Sección", type: "select", options: OFFICIAL_SECTION_SELECT_OPTIONS, allowOther: true, bind: "section", otherPlaceholder: "Escribe aquí la sección" },
      { key: "province", label: "Provincia Scout", type: "select", options: OFFICIAL_PROVINCE_SELECT_OPTIONS, allowOther: true, bind: "province", otherPlaceholder: "Escribe aquí la Provincia" },
      { key: "group", label: "Grupo Scout y Medidas de Seguridad", type: "text", bind: "group", placeholder: "Escribe aquí tu Grupo y medidas de seguridad" },
      { key: "specialtyName", label: "Nombre de mi Especialidad (FES)", type: "text", placeholder: "Escribe aquí el nombre de la especialidad" },
      { key: "fesAxis", label: "¿Qué más puedo aprender? / Eje temático", type: "text", placeholder: "Escribe aquí qué más puedes aprender" },
      { key: "odsGoal", label: "Tema relacionado", type: "text", placeholder: "Escribe aquí el tema relacionado" },
      { key: "level", label: "¿Qué más puedo hacer?", type: "text", placeholder: "Escribe aquí qué más puedes hacer" },
      { key: "learningGoals", label: "1. CONOZCO — Lo que tengo que aprender sobre la especialidad", type: "textarea", full: true, placeholder: "Escribe aquí lo que vas a investigar y conocer" },
      { key: "evidences", label: "2. APLICO — Lo que hago para demostrar los conocimientos adquiridos", type: "textarea", full: true, placeholder: "Escribe aquí las actividades prácticas realizadas" },
      { key: "scouter", label: "3. COMPARTO — La forma en que comparto mis nuevas habilidades", type: "textarea", full: true, bind: "scouter", placeholder: "Escribe aquí cómo compartes lo aprendido con los demás" }
    ]
  },

  smart: {
    id: "smart",
    code: "PLANTILLA P6.2 · PROYECTO",
    exportPrefix: "Ficha de Proyecto",
    baseDocId: "doc-0697",
    baseDocName: "P6.2_PlantillaProyecto_V1.0.pdf",
    title: "Ficha de Proyecto Scout (Plantilla Oficial P6.2 · 2 páginas)",
    subtitle: "Documento oficial P6.2_PlantillaProyecto_V1.0.pdf de RECME ASMAC",
    officialPages: [
      {
        src: "img/forms/smart_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "projectTitle", x: 41.2, y: 7.4, w: 52.5, h: 3.2 },
          { key: "startDate", x: 6.8, y: 9.0, w: 25.0, h: 2.5 },
          { key: "endDate", x: 6.8, y: 14.2, w: 25.0, h: 2.5 },
          { key: "name", x: 6.8, y: 19.3, w: 25.0, h: 2.5 },
          { key: "scouter", x: 6.8, y: 24.4, w: 25.0, h: 2.5 },
          { key: "group", x: 6.8, y: 36.8, w: 25.0, h: 2.4 },
          { key: "_provinceOut", x: 6.8, y: 46.2, w: 25.0, h: 2.4 },
          { key: "smartGoal", x: 41.0, y: 15.0, w: 25.0, h: 11.0, multiline: true },
          { key: "activities", x: 40.6, y: 30.0, w: 25.5, h: 25.5, multiline: true },
          { key: "diagnosis", x: 40.6, y: 59.8, w: 52.5, h: 5.2, multiline: true },
          { key: "impact", x: 40.6, y: 68.4, w: 52.5, h: 5.2, multiline: true },
          { key: "_sectionOut", x: 40.6, y: 76.9, w: 52.5, h: 3.2 },
          { key: "framework", x: 40.6, y: 91.5, w: 52.5, h: 2.6 }
        ]
      },
      {
        src: "img/forms/smart_p2.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "name", x: 5.2, y: 89.2, w: 42.5, h: 3.2 }
        ]
      }
    ],
    fields: [
      { key: "projectTitle", label: "Nombre del proyecto / Título", type: "text", full: true, placeholder: "Escribe aquí el título del proyecto" },
      { key: "name", label: "Nombre de quien lidera y coordina el proyecto", type: "text", bind: "name", placeholder: "Escribe aquí tu nombre completo" },
      { key: "scouter", label: "Nombre de quien me asesora", type: "text", bind: "scouter", placeholder: "Escribe aquí el nombre de quien asesora" },
      { key: "startDate", label: "Fecha de inicio (Día/Mes/Año)", type: "text", defaultTodaySlash: true, placeholder: "DD / MM / AAAA" },
      { key: "endDate", label: "Fecha proyectada de término (Día/Mes/Año)", type: "text", placeholder: "DD / MM / AAAA" },
      { key: "section", label: "Sección / Alcance del proyecto", type: "select", options: OFFICIAL_SECTION_SELECT_OPTIONS, allowOther: true, bind: "section", otherPlaceholder: "Escribe aquí el alcance o sección" },
      { key: "group", label: "Grupo Scout / Logística", type: "text", bind: "group", placeholder: "Escribe aquí tu Grupo Scout" },
      { key: "province", label: "Provincia Scout / Relaciones institucionales", type: "select", options: OFFICIAL_PROVINCE_SELECT_OPTIONS, allowOther: true, bind: "province", otherPlaceholder: "Escribe aquí la Provincia" },
      { key: "framework", label: "Palabras clave / Iniciativa", type: "text", placeholder: "Escribe aquí las palabras clave del proyecto" },
      { key: "smartGoal", label: "Objetivo General", type: "textarea", full: true, placeholder: "Escribe aquí el objetivo general del proyecto" },
      { key: "activities", label: "Objetivos Particulares", type: "textarea", full: true, placeholder: "Escribe aquí los objetivos particulares" },
      { key: "diagnosis", label: "¿Qué necesidad o problemática estoy atendiendo específicamente?", type: "textarea", full: true, placeholder: "Escribe aquí la problemática que atiende el proyecto" },
      { key: "impact", label: "¿A quién o quiénes afecta esta problemática?", type: "textarea", full: true, placeholder: "Escribe aquí la población beneficiada y el impacto" }
    ]
  },

  programa: {
    id: "programa",
    code: "PLANTILLA P6.3 · PROGRAMA",
    exportPrefix: "Programa de Actividades",
    baseDocId: "doc-0698",
    baseDocName: "P6.3_PlantillaPrograma_v1.0.pdf",
    title: "Formato Programa de Actividades (Plantilla Oficial P6.3)",
    subtitle: "Documento oficial P6.3_PlantillaPrograma_v1.0.pdf de RECME ASMAC",
    officialPages: [
      {
        src: "img/forms/programa_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "group", x: 6.8, y: 3.7, w: 25.0, h: 2.5 },
          { key: "dates", x: 6.8, y: 9.0, w: 24.0, h: 2.5 },
          { key: "_sectionOut", x: 35.4, y: 9.0, w: 13.0, h: 2.5 },
          { key: "eventName", x: 51.6, y: 9.0, w: 42.0, h: 2.5 },
          { key: "location", x: 6.8, y: 13.6, w: 24.0, h: 2.5 },
          { key: "scouter", x: 35.4, y: 13.6, w: 58.0, h: 2.5 },
          { key: "_provinceOut", x: 6.8, y: 18.4, w: 24.0, h: 2.5 },
          { key: "gearList", x: 66.6, y: 19.6, w: 27.5, h: 20.0, multiline: true },
          { key: "emergency", x: 6.8, y: 35.2, w: 49.5, h: 5.2, multiline: true },
          { key: "scheduleBlocks", x: 7.0, y: 48.2, w: 87.0, h: 27.5, multiline: true },
          { key: "educationalGoal", x: 6.8, y: 80.6, w: 87.0, h: 7.0, multiline: true }
        ]
      }
    ],
    fields: [
      { key: "eventName", label: "Nombre de la actividad o campamento", type: "text", full: true, placeholder: "Escribe aquí el nombre de la actividad" },
      { key: "section", label: "Sección", type: "select", options: OFFICIAL_SECTION_SELECT_OPTIONS, allowOther: true, bind: "section", otherPlaceholder: "Escribe aquí la sección" },
      { key: "group", label: "Grupo Scout", type: "text", bind: "group", placeholder: "Escribe aquí tu Grupo Scout" },
      { key: "province", label: "Provincia Scout / Duración", type: "select", options: OFFICIAL_PROVINCE_SELECT_OPTIONS, allowOther: true, bind: "province", otherPlaceholder: "Escribe aquí la Provincia o duración" },
      { key: "dates", label: "Fecha (Día/Mes/Año)", type: "text", defaultTodaySlash: true, placeholder: "DD / MM / AAAA" },
      { key: "location", label: "Lugar", type: "text", placeholder: "Escribe aquí el lugar de la actividad" },
      { key: "scouter", label: "Responsable de la sección", type: "text", bind: "scouter", placeholder: "Escribe aquí el nombre del responsable" },
      { key: "emergency", label: "Medidas de seguridad", type: "text", bind: "emergency", placeholder: "Escribe aquí las medidas de seguridad y contacto" },
      { key: "scheduleBlocks", label: "Programa general (Tiempo | Actividad | Responsable)", type: "textarea", full: true, placeholder: "Escribe aquí el cronograma de actividades" },
      { key: "gearList", label: "Materiales y equipo necesario", type: "textarea", full: true, placeholder: "Escribe aquí la lista de materiales" },
      { key: "educationalGoal", label: "Competencias que se busca desarrollar", type: "textarea", full: true, placeholder: "Escribe aquí las competencias a desarrollar" }
    ]
  },

  acta: {
    id: "acta",
    code: "PLANTILLA P6.4 · ACTA",
    exportPrefix: "Acta de Consejo",
    baseDocId: "doc-0699",
    baseDocName: "P6.4_PlantillaActadeConsejodeNivel_v1.0.pdf",
    title: "Acta de Consejo de Nivel (Plantilla Oficial P6.4 · 2 páginas)",
    subtitle: "Documento oficial P6.4_PlantillaActadeConsejodeNivel_v1.0.pdf de RECME ASMAC",
    officialPages: [
      {
        src: "img/forms/acta_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "attendees", x: 5.5, y: 11.2, w: 61.0, h: 35.0, multiline: true },
          { key: "group", x: 70.2, y: 8.3, w: 24.5, h: 3.8 },
          { key: "_sectionOut", x: 70.2, y: 15.4, w: 24.5, h: 3.8 },
          { key: "datePlace", x: 70.2, y: 22.8, w: 24.5, h: 3.8 },
          { key: "_provinceOut", x: 70.2, y: 37.2, w: 24.5, h: 3.8 },
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
          { key: "_userSignature", x: 5.5, y: 72.2, w: 32.0, h: 5.2, isSignature: true }
        ]
      }
    ],
    fields: [
      { key: "name", label: "Elaboró (Nombre)", type: "text", bind: "name", placeholder: "Escribe aquí quién elabora el acta" },
      { key: "scouter", label: "Revisó / Presidió", type: "text", bind: "scouter", placeholder: "Escribe aquí quién revisa o preside" },
      { key: "group", label: "Grupo Scout", type: "text", bind: "group", placeholder: "Escribe aquí el Grupo Scout" },
      { key: "section", label: "Sección", type: "select", options: OFFICIAL_SECTION_SELECT_OPTIONS, allowOther: true, bind: "section", otherPlaceholder: "Escribe aquí la sección" },
      { key: "province", label: "Provincia Scout / Lugar", type: "select", options: OFFICIAL_PROVINCE_SELECT_OPTIONS, allowOther: true, bind: "province", otherPlaceholder: "Escribe aquí la Provincia o lugar" },
      { key: "datePlace", label: "Fecha de realización (Día/Mes/Año)", type: "text", defaultTodaySlash: true, placeholder: "DD / MM / AAAA" },
      { key: "organType", label: "Fecha próxima de Consejo / Tipo de sesión", type: "text", placeholder: "Escribe aquí la próxima fecha o tipo de consejo" },
      { key: "attendees", label: "1. Lista de asistencia (Nombre | CUM)", type: "textarea", full: true, placeholder: "Escribe aquí los nombres y CUM de quienes asisten" },
      { key: "agenda", label: "2. Puntos a tratar o revisar", type: "textarea", full: true, placeholder: "Escribe aquí los puntos tratados en la sesión" },
      { key: "agreements", label: "3. Acuerdos tomados (Página 2)", type: "textarea", full: true, placeholder: "Escribe aquí los acuerdos tomados" }
    ]
  },
  p1: {
    id: "p1",
    code: "RECME P1.0.1",
    exportPrefix: "Diagnostico P1.0.1",
    baseDocId: "doc-0670",
    baseDocName: "P1.0.1_FAESDiagnosticoInicialNNAJ_v1.1.pdf",
    title: "Diagnóstico Inicial NNAJ (RECME P1.0.1)",
    subtitle: "Ficha oficial P1.0.1 para registro inicial de competencias al ingreso o cambio de Grupo",
    officialPages: [
      {
        src: "img/forms/p1_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "duration", x: 7.8, y: 7.5, w: 26.0, h: 2.6 },
          { key: "_sectionOut", x: 7.8, y: 12.1, w: 18.0, h: 2.1 },
          { key: "participants", x: 7.8, y: 17.2, w: 26.0, h: 2.1 },
          { key: "scouter", x: 40.2, y: 91.2, w: 52.0, h: 2.4 },
          { key: "apoyo_si", x: 30.6, y: 12.6, w: 2.3, h: 1.7, isCheck: true },
          { key: "eje_ambiente", x: 43.2, y: 12.6, w: 2.3, h: 1.7, isCheck: true },
          { key: "eje_habilidades", x: 49.4, y: 15.5, w: 2.3, h: 1.7, isCheck: true },
          { key: "eje_paz", x: 56.0, y: 12.6, w: 2.3, h: 1.7, isCheck: true },
          { key: "eje_salud", x: 62.5, y: 15.5, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_1", x: 15.9, y: 58.2, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_2", x: 23.2, y: 58.2, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_3", x: 30.5, y: 58.2, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_4", x: 15.9, y: 64.5, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_5", x: 23.2, y: 64.5, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_6", x: 30.5, y: 64.5, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_7", x: 15.9, y: 71.1, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_8", x: 23.2, y: 71.1, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_9", x: 30.5, y: 71.1, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_10", x: 15.9, y: 77.4, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_11", x: 23.2, y: 77.4, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_12", x: 30.5, y: 77.4, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_13", x: 15.9, y: 83.7, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_14", x: 23.2, y: 83.7, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_15", x: 30.5, y: 83.7, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_16", x: 15.9, y: 90.4, w: 2.3, h: 1.7, isCheck: true },
          { key: "ods_17", x: 23.2, y: 90.4, w: 2.3, h: 1.7, isCheck: true }
        ]
      }
    ],
    fields: [
      { key: "duration", label: "Duración estimada", type: "text", defaultValue: "2 horas", placeholder: "Ej. 2 horas o 3 juntas" },
      { key: "section", label: "Rango de edad / Sección", type: "select", options: OFFICIAL_SECTION_SELECT_OPTIONS, allowOther: true, bind: "section", otherPlaceholder: "Ej. Tropa / 10 a 14 años" },
      { key: "participants", label: "Número de participantes", type: "text", defaultValue: "1", placeholder: "Ej. 1 o Seisena" },
      { key: "scouter", label: "Elaboración / Scouter y Grupo", type: "text", bind: "scouter", placeholder: "Nombre del Scouter o fuente" },
      {
        key: "_p1_ejes",
        type: "checks_group",
        label: "Apoyo Adulto y 4 Ejes Temáticos",
        full: true,
        options: [
          { key: "apoyo_si", label: "Apoyo Adulto requerido" },
          { key: "eje_ambiente", label: "Medio Ambiente y Sustentabilidad" },
          { key: "eje_habilidades", label: "Habilidades para la Vida" },
          { key: "eje_paz", label: "Paz y Participación Comunitaria" },
          { key: "eje_salud", label: "Salud y Bienestar" }
        ]
      },
      {
        key: "_p1_ods",
        type: "checks_group",
        label: "Objetivos de Desarrollo Sostenible (17 ODS)",
        full: true,
        options: [
          { key: "ods_1", label: "1. Fin pobreza" },
          { key: "ods_2", label: "2. Hambre cero" },
          { key: "ods_3", label: "3. Salud" },
          { key: "ods_4", label: "4. Educación" },
          { key: "ods_5", label: "5. Igualdad género" },
          { key: "ods_6", label: "6. Agua limpia" },
          { key: "ods_7", label: "7. Energía asequible" },
          { key: "ods_8", label: "8. Trabajo decente" },
          { key: "ods_9", label: "9. Industria e innovación" },
          { key: "ods_10", label: "10. Reducción desigualdades" },
          { key: "ods_11", label: "11. Ciudades sostenibles" },
          { key: "ods_12", label: "12. Producción responsable" },
          { key: "ods_13", label: "13. Acción clima" },
          { key: "ods_14", label: "14. Vida submarina" },
          { key: "ods_15", label: "15. Vida terrestre" },
          { key: "ods_16", label: "16. Paz y justicia" },
          { key: "ods_17", label: "17. Alianzas" }
        ]
      }
    ]
  },

  p2: {
    id: "p2",
    code: "RECME P2.1",
    exportPrefix: "Cedula P2.1 Manada",
    baseDocId: "doc-0683",
    baseDocName: "P2.1_CedulaAuxiliarEvaluacionMLL_v1.1.pdf",
    title: "Cédula de Evaluación Manada (RECME P2.1)",
    subtitle: "Formato auxiliar oficial de evaluación y seguimiento de progresión en Manada de Lobatos",
    officialPages: [
      {
        src: "img/forms/p2_p1.webp",
        aspect: "1347 / 1905",
        boxes: [
          { key: "name", x: 18.0, y: 5.7, w: 32.5, h: 1.4 },
          { key: "manada", x: 57.5, y: 5.7, w: 20.5, h: 1.4 },
          { key: "group", x: 83.2, y: 5.7, w: 9.0, h: 1.4 },
          { key: "scouter", x: 12.6, y: 7.3, w: 38.0, h: 1.4 },
          { key: "_provinceOut", x: 57.5, y: 7.3, w: 20.5, h: 1.4 },
          { key: "date", x: 83.2, y: 7.3, w: 9.0, h: 1.4 },
          { key: "specNombre", x: 24.0, y: 54.9, w: 68.0, h: 1.4 },
          { key: "specEstatus", x: 24.0, y: 56.5, w: 68.0, h: 1.4 },
          { key: "specTerm", x: 24.0, y: 58.0, w: 68.0, h: 1.4 },
          { key: "observations", x: 7.0, y: 84.9, w: 52.5, h: 3.9, multiline: true },
          { key: "reviewDate", x: 60.2, y: 84.8, w: 17.8, h: 1.3 },
          { key: "endDate", x: 78.6, y: 84.8, w: 13.6, h: 1.3 },
          { key: "reviewer", x: 60.2, y: 87.2, w: 17.8, h: 1.3 },
          { key: "deliveryDate", x: 78.6, y: 87.2, w: 13.6, h: 1.3 },
          { key: "_userSignature", x: 60.2, y: 88.8, w: 17.8, h: 2.3, isSignature: true }
        ]
      }
    ],
    fields: [
      { key: "name", label: "Lobezna o Lobato", type: "text", bind: "name", placeholder: "Nombre completo" },
      { key: "manada", label: "Manada / Seisena", type: "text", bind: "section", placeholder: "Nombre de la Manada" },
      { key: "group", label: "Grupo", type: "text", bind: "group", placeholder: "Número de Grupo" },
      { key: "scouter", label: "Scouter responsable", type: "text", bind: "scouter", placeholder: "Nombre de Akela / Scouter" },
      { key: "province", label: "Provincia", type: "select", options: OFFICIAL_PROVINCE_SELECT_OPTIONS, allowOther: true, bind: "province", otherPlaceholder: "Provincia Scout" },
      { key: "date", label: "Fecha", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AA" },
      { key: "specNombre", label: "Especialidad(es) trabajada(s)", type: "text", placeholder: "Nombre de especialidad o proyecto" },
      { key: "specEstatus", label: "Estatus de especialidad", type: "text", placeholder: "En proceso / Concluida" },
      { key: "specTerm", label: "Fecha terminación especialidad", type: "text", placeholder: "DD/MM/AA" },
      { key: "observations", label: "Observaciones o Comentarios", type: "textarea", full: true, placeholder: "Anota competencias identificadas o seguimiento de etapa" },
      { key: "reviewDate", label: "Fecha de revisión", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AA" },
      { key: "endDate", label: "Fecha de terminación", type: "text", placeholder: "DD/MM/AA" },
      { key: "reviewer", label: "Revisó (Nombre)", type: "text", placeholder: "Nombre quien revisa" },
      { key: "deliveryDate", label: "Fecha de entrega", type: "text", placeholder: "DD/MM/AA" }
    ]
  },

  p8: {
    id: "p8",
    code: "RECME P8.1",
    exportPrefix: "Solicitud P8.1 Champions",
    baseDocId: "doc-0705",
    baseDocName: "P8.1_ChampionsForNature.pdf",
    title: "Solicitud Champions for Nature (RECME P8.1)",
    subtitle: "Formato oficial 2026 de Mundo Mejor / Tribu de la Tierra (llenado digital, sin imprimir)",
    officialPages: [
      {
        src: "img/forms/p8_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "name", x: 17.5, y: 22.4, w: 45.0, h: 2.2 },
          { key: "cum", x: 69.5, y: 22.4, w: 21.0, h: 2.2 },
          { key: "group", x: 33.2, y: 25.9, w: 29.8, h: 2.2 },
          { key: "_sectionOut", x: 71.2, y: 25.9, w: 19.2, h: 2.2 },
          { key: "_provinceOut", x: 18.0, y: 29.3, w: 44.5, h: 2.2 },
          { key: "birthDate", x: 80.6, y: 29.3, w: 11.5, h: 2.2 },
          { key: "phone", x: 26.8, y: 32.8, w: 36.0, h: 2.2 },
          { key: "email", x: 78.8, y: 32.8, w: 14.5, h: 2.2 },
          { key: "activities", x: 10.5, y: 38.2, w: 79.5, h: 2.9, multiline: true },
          { key: "sdgsUrl", x: 30.8, y: 41.3, w: 59.5, h: 2.2 },
          { key: "driveUrl", x: 43.5, y: 44.8, w: 46.8, h: 2.2 },
          { key: "p8_eje_salud", x: 13.7, y: 66.5, w: 2.9, h: 2.3, isCheck: true },
          { key: "p8_eje_ambiente", x: 28.4, y: 66.3, w: 2.9, h: 2.3, isCheck: true },
          { key: "_userSignature", x: 11.5, y: 79.5, w: 28.0, h: 4.3, isSignature: true },
          { key: "sectionDate", x: 19.6, y: 86.4, w: 18.0, h: 1.8 },
          { key: "groupDate", x: 71.0, y: 86.1, w: 18.0, h: 1.8 }
        ]
      }
    ],
    fields: [
      { key: "name", label: "Nombre completo", type: "text", bind: "name", placeholder: "Nombre del solicitante" },
      { key: "cum", label: "CUM", type: "text", bind: "cum", placeholder: "Ej. MEX123456" },
      { key: "group", label: "Nombre y número de Grupo", type: "text", bind: "group", placeholder: "Ej. Grupo 15" },
      { key: "section", label: "Sección", type: "select", options: OFFICIAL_SECTION_SELECT_OPTIONS, allowOther: true, bind: "section", otherPlaceholder: "Sección" },
      { key: "province", label: "Provincia", type: "select", options: OFFICIAL_PROVINCE_SELECT_OPTIONS, allowOther: true, bind: "province", otherPlaceholder: "Provincia Scout" },
      { key: "birthDate", label: "Fecha de nacimiento", type: "text", bind: "age", placeholder: "DD/MM/AAAA" },
      { key: "phone", label: "Teléfono de contacto", type: "text", bind: "emergency", placeholder: "Número de contacto" },
      { key: "email", label: "Correo electrónico", type: "text", placeholder: "correo@ejemplo.com" },
      { key: "activities", label: "Actividades realizadas y Voluntariado", type: "textarea", full: true, placeholder: "Describe las acciones de la canasta y voluntariado" },
      { key: "sdgsUrl", label: "Enlace(s) de sdgs.scout.org", type: "text", full: true, placeholder: "https://sdgs.scout.org/..." },
      { key: "driveUrl", label: "Enlace(s) Drive abierto de evidencias", type: "text", full: true, placeholder: "https://drive.google.com/..." },
      {
        key: "_p8_ejes",
        type: "checks_group",
        label: "Eje temático abordado",
        full: true,
        options: [
          { key: "p8_eje_salud", label: "Salud y Bienestar" },
          { key: "p8_eje_ambiente", label: "Medio Ambiente" }
        ]
      },
      { key: "sectionDate", label: "Fecha aval Consejo de Sección", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AAAA" },
      { key: "groupDate", label: "Fecha aval Consejo de Grupo", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AAAA" }
    ]
  },

  p8_mop: {
    id: "p8_mop",
    code: "RECME P8.3",
    exportPrefix: "Solicitud P8.3 Mensajeros",
    baseDocId: "doc-0707",
    baseDocName: "P8.3_MensajerosDeLaPaz.pdf",
    title: "Solicitud Mensajeros de la Paz (RECME P8.3)",
    subtitle: "Formato oficial 2026 de Mundo Mejor / Mensajeros de la Paz con horas de voluntariado",
    officialPages: [
      {
        src: "img/forms/p8_mop_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "name", x: 17.5, y: 22.4, w: 45.0, h: 2.2 },
          { key: "cum", x: 69.5, y: 22.4, w: 21.0, h: 2.2 },
          { key: "group", x: 33.2, y: 25.9, w: 29.8, h: 2.2 },
          { key: "_sectionOut", x: 71.2, y: 25.9, w: 19.2, h: 2.2 },
          { key: "_provinceOut", x: 18.0, y: 29.3, w: 44.5, h: 2.2 },
          { key: "birthDate", x: 80.6, y: 29.3, w: 11.5, h: 2.2 },
          { key: "phone", x: 26.8, y: 32.8, w: 36.0, h: 2.2 },
          { key: "email", x: 78.8, y: 32.8, w: 14.5, h: 2.2 },
          { key: "volunteerName", x: 31.8, y: 36.2, w: 31.5, h: 2.2 },
          { key: "volunteerHours", x: 87.2, y: 36.2, w: 6.5, h: 2.2 },
          { key: "sdgsUrl", x: 30.8, y: 41.3, w: 59.5, h: 2.2 },
          { key: "driveUrl", x: 43.5, y: 46.5, w: 46.8, h: 2.2 },
          { key: "p8_eje_habilidades", x: 12.8, y: 65.4, w: 2.9, h: 2.3, isCheck: true },
          { key: "p8_eje_paz", x: 29.0, y: 65.4, w: 2.9, h: 2.3, isCheck: true },
          { key: "p8_eje_salud", x: 21.2, y: 77.2, w: 2.9, h: 2.3, isCheck: true },
          { key: "_userSignature", x: 11.5, y: 79.8, w: 28.0, h: 4.1, isSignature: true },
          { key: "sectionDate", x: 19.6, y: 86.4, w: 18.0, h: 1.8 },
          { key: "groupDate", x: 71.0, y: 86.1, w: 18.0, h: 1.8 }
        ]
      }
    ],
    fields: [
      { key: "name", label: "Nombre completo", type: "text", bind: "name", placeholder: "Nombre del solicitante" },
      { key: "cum", label: "CUM", type: "text", bind: "cum", placeholder: "Ej. MEX123456" },
      { key: "group", label: "Nombre y número de Grupo", type: "text", bind: "group", placeholder: "Ej. Grupo 15" },
      { key: "section", label: "Sección", type: "select", options: OFFICIAL_SECTION_SELECT_OPTIONS, allowOther: true, bind: "section", otherPlaceholder: "Sección" },
      { key: "province", label: "Provincia", type: "select", options: OFFICIAL_PROVINCE_SELECT_OPTIONS, allowOther: true, bind: "province", otherPlaceholder: "Provincia Scout" },
      { key: "birthDate", label: "Fecha de nacimiento", type: "text", bind: "age", placeholder: "DD/MM/AAAA" },
      { key: "phone", label: "Teléfono de contacto", type: "text", bind: "emergency", placeholder: "Número de contacto" },
      { key: "email", label: "Correo electrónico", type: "text", placeholder: "correo@ejemplo.com" },
      { key: "volunteerName", label: "Nombre del Voluntariado(s)", type: "text", placeholder: "Nombre del proyecto o voluntariado" },
      { key: "volunteerHours", label: "Horas totales de Voluntariado", type: "text", placeholder: "Ej. 30 hrs" },
      { key: "sdgsUrl", label: "Enlace(s) de sdgs.scout.org", type: "text", full: true, placeholder: "https://sdgs.scout.org/..." },
      { key: "driveUrl", label: "Enlace(s) Drive abierto de evidencias", type: "text", full: true, placeholder: "https://drive.google.com/..." },
      {
        key: "_p8mop_ejes",
        type: "checks_group",
        label: "Eje temático abordado",
        full: true,
        options: [
          { key: "p8_eje_habilidades", label: "Habilidades para la Vida" },
          { key: "p8_eje_paz", label: "Paz y Participación" },
          { key: "p8_eje_salud", label: "Salud y Bienestar" }
        ]
      },
      { key: "sectionDate", label: "Fecha aval Consejo de Sección", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AAAA" },
      { key: "groupDate", label: "Fecha aval Consejo de Grupo", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AAAA" }
    ]
  },

  p8_solar: {
    id: "p8_solar",
    code: "RECME P8.7",
    exportPrefix: "Solicitud P8.7 Solar",
    baseDocId: "doc-0710",
    baseDocName: "P8.7_ScoutsGoSolar.pdf",
    title: "Solicitud Scouts Go Solar (RECME P8.7)",
    subtitle: "Formato oficial 2026 de Mundo Mejor / Scouts Go Solar (llenado digital, sin imprimir)",
    officialPages: [
      {
        src: "img/forms/p8_solar_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "name", x: 17.5, y: 22.4, w: 45.0, h: 2.2 },
          { key: "cum", x: 69.5, y: 22.4, w: 21.0, h: 2.2 },
          { key: "group", x: 33.2, y: 25.9, w: 29.8, h: 2.2 },
          { key: "_sectionOut", x: 71.2, y: 25.9, w: 19.2, h: 2.2 },
          { key: "_provinceOut", x: 18.0, y: 29.3, w: 44.5, h: 2.2 },
          { key: "birthDate", x: 80.6, y: 29.3, w: 11.5, h: 2.2 },
          { key: "phone", x: 26.8, y: 32.8, w: 36.0, h: 2.2 },
          { key: "email", x: 78.8, y: 32.8, w: 14.5, h: 2.2 },
          { key: "activities", x: 10.5, y: 38.2, w: 79.5, h: 2.9, multiline: true },
          { key: "sdgsUrl", x: 30.8, y: 41.3, w: 59.5, h: 2.2 },
          { key: "driveUrl", x: 43.5, y: 44.8, w: 46.8, h: 2.2 },
          { key: "p8_eje_habilidades", x: 13.2, y: 66.1, w: 2.9, h: 2.3, isCheck: true },
          { key: "p8_eje_ambiente", x: 28.3, y: 66.1, w: 2.9, h: 2.3, isCheck: true },
          { key: "_userSignature", x: 11.5, y: 79.5, w: 28.0, h: 4.3, isSignature: true },
          { key: "sectionDate", x: 19.6, y: 86.4, w: 18.0, h: 1.8 },
          { key: "groupDate", x: 71.0, y: 86.1, w: 18.0, h: 1.8 }
        ]
      }
    ],
    fields: [
      { key: "name", label: "Nombre completo", type: "text", bind: "name", placeholder: "Nombre del solicitante" },
      { key: "cum", label: "CUM", type: "text", bind: "cum", placeholder: "Ej. MEX123456" },
      { key: "group", label: "Nombre y número de Grupo", type: "text", bind: "group", placeholder: "Ej. Grupo 15" },
      { key: "section", label: "Sección", type: "select", options: OFFICIAL_SECTION_SELECT_OPTIONS, allowOther: true, bind: "section", otherPlaceholder: "Sección" },
      { key: "province", label: "Provincia", type: "select", options: OFFICIAL_PROVINCE_SELECT_OPTIONS, allowOther: true, bind: "province", otherPlaceholder: "Provincia Scout" },
      { key: "birthDate", label: "Fecha de nacimiento", type: "text", bind: "age", placeholder: "DD/MM/AAAA" },
      { key: "phone", label: "Teléfono de contacto", type: "text", bind: "emergency", placeholder: "Número de contacto" },
      { key: "email", label: "Correo electrónico", type: "text", placeholder: "correo@ejemplo.com" },
      { key: "activities", label: "Actividades realizadas y Voluntariado", type: "textarea", full: true, placeholder: "Describe actividades de Scouts Go Solar y voluntariado" },
      { key: "sdgsUrl", label: "Enlace(s) de sdgs.scout.org", type: "text", full: true, placeholder: "https://sdgs.scout.org/..." },
      { key: "driveUrl", label: "Enlace(s) Drive abierto de evidencias", type: "text", full: true, placeholder: "https://drive.google.com/..." },
      {
        key: "_p8sol_ejes",
        type: "checks_group",
        label: "Eje temático abordado",
        full: true,
        options: [
          { key: "p8_eje_habilidades", label: "Habilidades para la Vida" },
          { key: "p8_eje_ambiente", label: "Medio Ambiente" }
        ]
      },
      { key: "sectionDate", label: "Fecha aval Consejo de Sección", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AAAA" },
      { key: "groupDate", label: "Fecha aval Consejo de Grupo", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AAAA" }
    ]
  },

  p9_alfa: {
    id: "p9_alfa",
    code: "RECME P9.1",
    exportPrefix: "Solicitud P9.1 Alfa",
    baseDocId: "doc-0711",
    baseDocName: "P9.1_SolicitudInsigniaAlfa.pdf",
    title: "Solicitud Insignia Final Alfa (Manada P9.1 · 2 hojas)",
    subtitle: "Formato oficial PJOS de Manada ante Consejo de Roca y Consejo de Grupo",
    officialPages: [
      {
        src: "img/forms/p9_alfa_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "rockDate", x: 45.2, y: 12.2, w: 14.8, h: 1.5 },
          { key: "group", x: 73.4, y: 12.2, w: 6.9, h: 1.5 },
          { key: "_provinceOut", x: 9.8, y: 14.5, w: 36.2, h: 1.5 },
          { key: "sessionDate", x: 52.0, y: 14.5, w: 17.5, h: 1.5 },
          { key: "name", x: 33.5, y: 16.9, w: 40.5, h: 1.5 },
          { key: "cum", x: 78.2, y: 16.9, w: 11.6, h: 1.5 },
          { key: "badgeStage", x: 61.8, y: 19.2, w: 26.5, h: 1.5 },
          { key: "birthDate", x: 67.5, y: 21.6, w: 15.2, h: 1.5 },
          { key: "entryDate", x: 30.0, y: 23.9, w: 17.5, h: 1.5 },
          { key: "passDate", x: 9.8, y: 26.2, w: 27.5, h: 1.5 },
          { key: "compromisoFecha", x: 15.2, y: 40.5, w: 12.0, h: 1.4 },
          { key: "territorioFecha", x: 44.2, y: 40.5, w: 12.0, h: 1.4 },
          { key: "stage1Term", x: 16.5, y: 54.0, w: 11.5, h: 1.3 },
          { key: "stage1Ent", x: 16.5, y: 55.4, w: 11.5, h: 1.3 },
          { key: "stage2Term", x: 36.6, y: 54.0, w: 11.5, h: 1.3 },
          { key: "stage2Ent", x: 36.6, y: 55.4, w: 11.5, h: 1.3 },
          { key: "stage3Term", x: 56.8, y: 54.0, w: 11.5, h: 1.3 },
          { key: "stage3Ent", x: 56.8, y: 55.4, w: 11.5, h: 1.3 },
          { key: "stage4Term", x: 76.9, y: 54.0, w: 11.5, h: 1.3 },
          { key: "stage4Ent", x: 76.9, y: 55.4, w: 11.5, h: 1.3 }
        ]
      },
      {
        src: "img/forms/p9_alfa_p2.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "mopTerm", x: 56.8, y: 20.5, w: 11.5, h: 1.3 },
          { key: "mopEnt", x: 56.8, y: 21.9, w: 11.5, h: 1.3 },
          { key: "tribuTerm", x: 76.9, y: 20.5, w: 11.5, h: 1.3 },
          { key: "tribuEnt", x: 76.9, y: 21.9, w: 11.5, h: 1.3 },
          { key: "evento1Nombre", x: 10.5, y: 42.8, w: 33.0, h: 1.8 },
          { key: "evento1Fecha", x: 45.0, y: 42.8, w: 19.0, h: 1.8 },
          { key: "evento1Duracion", x: 65.5, y: 42.8, w: 10.0, h: 1.8 },
          { key: "evento1Eje", x: 76.5, y: 42.8, w: 13.0, h: 1.8 },
          { key: "signName", x: 16.5, y: 85.5, w: 28.0, h: 1.6 },
          { key: "groupScouter", x: 55.8, y: 85.5, w: 28.0, h: 1.6 },
          { key: "_userSignature", x: 10.5, y: 79.8, w: 32.0, h: 4.5, isSignature: true }
        ]
      }
    ],
    fields: [
      { key: "name", label: "Nombre de la Lobezna / Lobato", type: "text", bind: "name", placeholder: "Nombre completo" },
      { key: "cum", label: "CUM", type: "text", bind: "cum", placeholder: "CUM oficial" },
      { key: "group", label: "Número de Grupo", type: "text", bind: "group", placeholder: "Ej. 15" },
      { key: "province", label: "Provincia", type: "select", options: OFFICIAL_PROVINCE_SELECT_OPTIONS, allowOther: true, bind: "province", otherPlaceholder: "Provincia Scout" },
      { key: "rockDate", label: "Fecha solicitud Consejo de Roca", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AA" },
      { key: "sessionDate", label: "Fecha sesión Consejo de Grupo", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AA" },
      { key: "badgeStage", label: "Insignia / Modalidad", type: "text", defaultValue: "Alfa y Omega", placeholder: "Alfa / Alfa y Omega" },
      { key: "birthDate", label: "Fecha de nacimiento", type: "text", bind: "age", placeholder: "DD/MM/AA" },
      { key: "entryDate", label: "Fecha ingreso a Manada", type: "text", placeholder: "DD/MM/AA" },
      { key: "passDate", label: "Fecha tentativa de pase a Tropa", type: "text", placeholder: "DD/MM/AA" },
      { key: "compromisoFecha", label: "Fecha Compromiso / Promesa", type: "text", placeholder: "DD/MM/AA" },
      { key: "territorioFecha", label: "Fecha Territorio de Caza", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage1Term", label: "Pata Tierna — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage1Ent", label: "Pata Tierna — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage2Term", label: "Saltador — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage2Ent", label: "Saltador — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage3Term", label: "Rastreador — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage3Ent", label: "Rastreador — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage4Term", label: "Cazador — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage4Ent", label: "Cazador — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "mopTerm", label: "Mensajeros de la Paz — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "tribuTerm", label: "Tribu de la Tierra — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "evento1Nombre", label: "Evento significativo — Nombre", type: "text", placeholder: "Ej. Campamento de Verano" },
      { key: "evento1Fecha", label: "Evento — Fecha / Lugar", type: "text", placeholder: "Ej. Jul 2026 · Meztitla" },
      { key: "evento1Duracion", label: "Evento — Duración", type: "text", placeholder: "3 días" },
      { key: "evento1Eje", label: "Evento — Eje relacionado", type: "text", placeholder: "Ej. Naturaleza" },
      { key: "signName", label: "Scouter de Manada (Nombre)", type: "text", bind: "scouter", placeholder: "Akela / Scouter" },
      { key: "groupScouter", label: "Jefe de Grupo (Nombre)", type: "text", placeholder: "Nombre quien firma por Grupo" }
    ]
  },

  p9: {
    id: "p9",
    code: "RECME P9.2",
    exportPrefix: "Solicitud P9.2 Aguila Real",
    baseDocId: "doc-0712",
    baseDocName: "P9.2_SolicitudAguilaReal.pdf",
    title: "Solicitud Insignia Final Águila Real (RECME P9.2 · 2 hojas)",
    subtitle: "Formato oficial PJOS de Tropa ante Corte de Honor y Consejo de Grupo",
    officialPages: [
      {
        src: "img/forms/p9_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "honorDate", x: 45.4, y: 12.2, w: 14.5, h: 1.5 },
          { key: "group", x: 73.6, y: 12.2, w: 6.5, h: 1.5 },
          { key: "_provinceOut", x: 9.8, y: 14.5, w: 36.2, h: 1.5 },
          { key: "sessionDate", x: 52.0, y: 14.5, w: 17.5, h: 1.5 },
          { key: "name", x: 34.1, y: 16.9, w: 40.0, h: 1.5 },
          { key: "cum", x: 78.5, y: 16.9, w: 11.4, h: 1.5 },
          { key: "badgeStage", x: 66.5, y: 19.2, w: 23.0, h: 1.5 },
          { key: "birthDate", x: 74.3, y: 21.6, w: 12.8, h: 1.5 },
          { key: "entryDate", x: 39.3, y: 23.9, w: 12.5, h: 1.5 },
          { key: "passDate", x: 9.8, y: 26.2, w: 23.2, h: 1.5 },
          { key: "stage1Term", x: 21.4, y: 50.5, w: 9.2, h: 1.3 },
          { key: "stage1Ent", x: 21.4, y: 52.1, w: 9.2, h: 1.3 },
          { key: "stage2Term", x: 41.8, y: 50.5, w: 9.0, h: 1.3 },
          { key: "stage2Ent", x: 41.8, y: 52.1, w: 9.0, h: 1.3 },
          { key: "stage3Term", x: 61.6, y: 50.5, w: 9.2, h: 1.3 },
          { key: "stage3Ent", x: 61.6, y: 52.1, w: 9.2, h: 1.3 },
          { key: "stage4Term", x: 81.8, y: 50.5, w: 9.0, h: 1.3 },
          { key: "stage4Ent", x: 81.8, y: 52.1, w: 9.0, h: 1.3 }
        ]
      },
      {
        src: "img/forms/p9_p2.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "mopTerm", x: 61.6, y: 28.9, w: 9.2, h: 1.3 },
          { key: "mopEnt", x: 61.6, y: 30.4, w: 9.2, h: 1.3 },
          { key: "tribuTerm", x: 81.8, y: 28.9, w: 9.0, h: 1.3 },
          { key: "tribuEnt", x: 81.8, y: 30.4, w: 9.0, h: 1.3 },
          { key: "flechaFecha", x: 35.5, y: 34.3, w: 18.0, h: 1.4 },
          { key: "evento1Nombre", x: 10.5, y: 42.3, w: 33.0, h: 1.8 },
          { key: "evento1Fecha", x: 45.0, y: 42.3, w: 19.0, h: 1.8 },
          { key: "evento1Duracion", x: 65.5, y: 42.3, w: 10.0, h: 1.8 },
          { key: "evento1Eje", x: 76.5, y: 42.3, w: 13.0, h: 1.8 },
          { key: "signName", x: 16.5, y: 87.9, w: 28.0, h: 1.6 },
          { key: "groupScouter", x: 54.6, y: 87.9, w: 28.0, h: 1.6 },
          { key: "_userSignature", x: 10.5, y: 82.0, w: 32.0, h: 4.5, isSignature: true }
        ]
      }
    ],
    fields: [
      { key: "name", label: "Nombre del Scout solicitante", type: "text", bind: "name", placeholder: "Nombre completo" },
      { key: "cum", label: "CUM", type: "text", bind: "cum", placeholder: "CUM oficial" },
      { key: "group", label: "Número de Grupo", type: "text", bind: "group", placeholder: "Ej. 15" },
      { key: "province", label: "Provincia", type: "select", options: OFFICIAL_PROVINCE_SELECT_OPTIONS, allowOther: true, bind: "province", otherPlaceholder: "Provincia Scout" },
      { key: "honorDate", label: "Fecha solicitud Corte de Honor", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AA" },
      { key: "sessionDate", label: "Fecha sesión Consejo de Grupo", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AA" },
      { key: "badgeStage", label: "Nivel / Modalidad", type: "text", defaultValue: "Obsidiana / Jade", placeholder: "Obsidiana o Jade" },
      { key: "birthDate", label: "Fecha de nacimiento", type: "text", bind: "age", placeholder: "DD/MM/AA" },
      { key: "entryDate", label: "Fecha ingreso a Tropa", type: "text", placeholder: "DD/MM/AA" },
      { key: "passDate", label: "Fecha tentativa de pase", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage1Term", label: "Pistas — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage1Ent", label: "Pistas — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage2Term", label: "Sendas — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage2Ent", label: "Sendas — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage3Term", label: "Rumbos — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage3Ent", label: "Rumbos — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage4Term", label: "Travesías — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage4Ent", label: "Travesías — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "flechaFecha", label: "Flecha de Madera / Curso — Fecha", type: "text", placeholder: "DD/MM/AA" },
      { key: "mopTerm", label: "Mensajeros de la Paz — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "tribuTerm", label: "Tribu de la Tierra — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "evento1Nombre", label: "Evento significativo — Nombre", type: "text", placeholder: "Ej. Camporee Nacional" },
      { key: "evento1Fecha", label: "Evento — Fecha / Lugar", type: "text", placeholder: "Ej. Ago 2026" },
      { key: "evento1Duracion", label: "Evento — Duración", type: "text", placeholder: "5 días" },
      { key: "evento1Eje", label: "Evento — Eje relacionado", type: "text", placeholder: "Ej. Habilidades" },
      { key: "signName", label: "Scouter de Tropa (Nombre)", type: "text", bind: "scouter", placeholder: "Nombre del Scouter" },
      { key: "groupScouter", label: "Jefe de Grupo (Nombre)", type: "text", placeholder: "Nombre quien firma por Grupo" }
    ]
  },

  p9_everest: {
    id: "p9_everest",
    code: "RECME P9.3",
    exportPrefix: "Solicitud P9.3 Everest",
    baseDocId: "doc-0713",
    baseDocName: "P9.3_SolicitudEverest.pdf",
    title: "Solicitud Insignia Final Everest (Comunidad P9.3 · 2 hojas)",
    subtitle: "Formato oficial PJOS de Comunidad de Caminantes ante Comité y Consejo de Grupo",
    officialPages: [
      {
        src: "img/forms/p9_everest_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "comiteDate", x: 51.6, y: 12.2, w: 15.0, h: 1.5 },
          { key: "group", x: 80.8, y: 12.2, w: 5.7, h: 1.5 },
          { key: "_provinceOut", x: 16.5, y: 14.5, w: 28.0, h: 1.5 },
          { key: "sessionDate", x: 49.5, y: 14.5, w: 14.2, h: 1.5 },
          { key: "name", x: 22.2, y: 16.9, w: 36.2, h: 1.5 },
          { key: "cum", x: 64.8, y: 16.9, w: 11.6, h: 1.5 },
          { key: "badgeStage", x: 50.2, y: 19.2, w: 22.0, h: 1.5 },
          { key: "birthDate", x: 48.5, y: 21.6, w: 15.0, h: 1.5 },
          { key: "entryDate", x: 22.0, y: 23.9, w: 14.2, h: 1.5 },
          { key: "passDate", x: 71.0, y: 23.9, w: 18.2, h: 1.5 },
          { key: "stage1Term", x: 21.4, y: 50.1, w: 9.8, h: 1.3 },
          { key: "stage1Ent", x: 21.4, y: 51.7, w: 9.8, h: 1.3 },
          { key: "stage2Term", x: 42.2, y: 50.1, w: 8.8, h: 1.3 },
          { key: "stage2Ent", x: 42.2, y: 51.7, w: 8.8, h: 1.3 },
          { key: "stage3Term", x: 62.0, y: 50.1, w: 8.8, h: 1.3 },
          { key: "stage3Ent", x: 62.0, y: 51.7, w: 8.8, h: 1.3 },
          { key: "stage4Term", x: 81.6, y: 50.1, w: 9.0, h: 1.3 },
          { key: "stage4Ent", x: 81.6, y: 51.7, w: 9.0, h: 1.3 }
        ]
      },
      {
        src: "img/forms/p9_everest_p2.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "mopTerm", x: 63.0, y: 26.1, w: 9.2, h: 1.3 },
          { key: "mopEnt", x: 63.0, y: 27.7, w: 9.2, h: 1.3 },
          { key: "tribuTerm", x: 83.4, y: 26.1, w: 8.0, h: 1.3 },
          { key: "tribuEnt", x: 83.4, y: 27.7, w: 8.0, h: 1.3 },
          { key: "puntaFecha", x: 35.5, y: 32.2, w: 18.0, h: 1.4 },
          { key: "evento1Nombre", x: 10.5, y: 40.8, w: 33.0, h: 1.8 },
          { key: "evento1Fecha", x: 45.0, y: 40.8, w: 19.0, h: 1.8 },
          { key: "evento1Duracion", x: 65.5, y: 40.8, w: 10.0, h: 1.8 },
          { key: "evento1Eje", x: 76.5, y: 40.8, w: 13.0, h: 1.8 },
          { key: "signName", x: 16.5, y: 87.3, w: 28.0, h: 1.6 },
          { key: "groupScouter", x: 58.2, y: 87.3, w: 28.0, h: 1.6 },
          { key: "_userSignature", x: 10.5, y: 81.5, w: 32.0, h: 4.5, isSignature: true }
        ]
      }
    ],
    fields: [
      { key: "name", label: "Nombre del Caminante", type: "text", bind: "name", placeholder: "Nombre completo" },
      { key: "cum", label: "CUM", type: "text", bind: "cum", placeholder: "CUM oficial" },
      { key: "group", label: "Número de Grupo", type: "text", bind: "group", placeholder: "Ej. 15" },
      { key: "province", label: "Provincia", type: "select", options: OFFICIAL_PROVINCE_SELECT_OPTIONS, allowOther: true, bind: "province", otherPlaceholder: "Provincia Scout" },
      { key: "comiteDate", label: "Fecha solicitud Comité de Comunidad", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AA" },
      { key: "sessionDate", label: "Fecha sesión Consejo de Grupo", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AA" },
      { key: "badgeStage", label: "Insignia / Nivel", type: "text", defaultValue: "Everest", placeholder: "Insignia Everest" },
      { key: "birthDate", label: "Fecha de nacimiento", type: "text", bind: "age", placeholder: "DD/MM/AA" },
      { key: "entryDate", label: "Fecha ingreso a Comunidad", type: "text", placeholder: "DD/MM/AA" },
      { key: "passDate", label: "Fecha tentativa de pase a Clan", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage1Term", label: "Etapa 1 — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage1Ent", label: "Etapa 1 — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage2Term", label: "Etapa 2 — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage2Ent", label: "Etapa 2 — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage3Term", label: "Etapa 3 — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage3Ent", label: "Etapa 3 — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage4Term", label: "Etapa 4 — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage4Ent", label: "Etapa 4 — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "puntaFecha", label: "Punta de Flecha — Fecha", type: "text", placeholder: "DD/MM/AA" },
      { key: "mopTerm", label: "Mensajeros de la Paz — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "tribuTerm", label: "Tribu de la Tierra — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "evento1Nombre", label: "Evento significativo — Nombre", type: "text", placeholder: "Nombre del evento o expedición" },
      { key: "evento1Fecha", label: "Evento — Fecha / Lugar", type: "text", placeholder: "DD/MM/AA · Lugar" },
      { key: "evento1Duracion", label: "Evento — Duración", type: "text", placeholder: "4 días" },
      { key: "evento1Eje", label: "Evento — Eje relacionado", type: "text", placeholder: "Paz / Sustentabilidad" },
      { key: "signName", label: "Scouter de Comunidad (Nombre)", type: "text", bind: "scouter", placeholder: "Nombre del Scouter" },
      { key: "groupScouter", label: "Jefe de Grupo (Nombre)", type: "text", placeholder: "Nombre quien firma por Grupo" }
    ]
  },

  p9_bp: {
    id: "p9_bp",
    code: "RECME P9.4",
    exportPrefix: "Solicitud P9.4 Baden Powell",
    baseDocId: "doc-0714",
    baseDocName: "P9.4_SolicitudBadenPowell.pdf",
    title: "Solicitud Horquilla Baden-Powell (Clan P9.4 · 2 hojas)",
    subtitle: "Formato oficial PJOS de Clan de Rovers ante Parlamento Rover y Consejo de Grupo",
    officialPages: [
      {
        src: "img/forms/p9_bp_p1.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "parlamentoDate", x: 43.5, y: 12.2, w: 15.0, h: 1.5 },
          { key: "group", x: 72.6, y: 12.2, w: 6.9, h: 1.5 },
          { key: "_provinceOut", x: 9.8, y: 14.5, w: 36.2, h: 1.5 },
          { key: "sessionDate", x: 52.0, y: 14.5, w: 17.5, h: 1.5 },
          { key: "name", x: 31.0, y: 16.9, w: 32.3, h: 1.5 },
          { key: "cum", x: 69.8, y: 16.9, w: 11.6, h: 1.5 },
          { key: "badgeStage", x: 64.2, y: 19.2, w: 24.2, h: 1.5 },
          { key: "birthDate", x: 67.5, y: 21.6, w: 15.2, h: 1.5 },
          { key: "entryDate", x: 31.8, y: 23.9, w: 13.5, h: 1.5 },
          { key: "passDate", x: 73.3, y: 23.9, w: 16.8, h: 1.5 },
          { key: "stage1Term", x: 21.4, y: 50.1, w: 9.8, h: 1.3 },
          { key: "stage1Ent", x: 21.4, y: 51.7, w: 9.8, h: 1.3 },
          { key: "stage2Term", x: 42.2, y: 50.1, w: 9.8, h: 1.3 },
          { key: "stage2Ent", x: 42.2, y: 51.7, w: 9.8, h: 1.3 },
          { key: "stage3Term", x: 63.0, y: 50.1, w: 8.8, h: 1.3 },
          { key: "stage3Ent", x: 63.0, y: 51.7, w: 8.8, h: 1.3 },
          { key: "stage4Term", x: 82.6, y: 50.1, w: 8.8, h: 1.3 },
          { key: "stage4Ent", x: 82.6, y: 51.7, w: 8.8, h: 1.3 }
        ]
      },
      {
        src: "img/forms/p9_bp_p2.webp",
        aspect: "1347 / 1743",
        boxes: [
          { key: "mopTerm", x: 48.4, y: 23.7, w: 10.5, h: 1.3 },
          { key: "mopEnt", x: 48.4, y: 25.3, w: 10.5, h: 1.3 },
          { key: "tribuTerm", x: 64.2, y: 23.7, w: 9.8, h: 1.3 },
          { key: "tribuEnt", x: 64.2, y: 25.3, w: 9.8, h: 1.3 },
          { key: "viajeFecha", x: 52.5, y: 29.0, w: 19.0, h: 1.4 },
          { key: "evento1Nombre", x: 10.5, y: 42.8, w: 33.0, h: 1.8 },
          { key: "evento1Fecha", x: 45.0, y: 42.8, w: 19.0, h: 1.8 },
          { key: "evento1Duracion", x: 65.5, y: 42.8, w: 10.0, h: 1.8 },
          { key: "evento1Eje", x: 76.5, y: 42.8, w: 13.0, h: 1.8 },
          { key: "signName", x: 16.5, y: 89.1, w: 28.0, h: 1.6 },
          { key: "groupScouter", x: 58.2, y: 89.1, w: 28.0, h: 1.6 },
          { key: "_userSignature", x: 10.5, y: 83.8, w: 32.0, h: 4.5, isSignature: true }
        ]
      }
    ],
    fields: [
      { key: "name", label: "Nombre del Rover solicitante", type: "text", bind: "name", placeholder: "Nombre completo" },
      { key: "cum", label: "CUM", type: "text", bind: "cum", placeholder: "CUM oficial" },
      { key: "group", label: "Número de Grupo", type: "text", bind: "group", placeholder: "Ej. 15" },
      { key: "province", label: "Provincia", type: "select", options: OFFICIAL_PROVINCE_SELECT_OPTIONS, allowOther: true, bind: "province", otherPlaceholder: "Provincia Scout" },
      { key: "parlamentoDate", label: "Fecha solicitud Parlamento Rover", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AA" },
      { key: "sessionDate", label: "Fecha sesión Consejo de Grupo", type: "text", defaultTodaySlash: true, placeholder: "DD/MM/AA" },
      { key: "badgeStage", label: "Insignia / Nivel", type: "text", defaultValue: "Baden-Powell", placeholder: "Horquilla Baden-Powell" },
      { key: "birthDate", label: "Fecha de nacimiento", type: "text", bind: "age", placeholder: "DD/MM/AA" },
      { key: "entryDate", label: "Fecha ingreso a Clan de Rovers", type: "text", placeholder: "DD/MM/AA" },
      { key: "passDate", label: "Fecha tentativa de Partida Rover", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage1Term", label: "Etapa 1 — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage1Ent", label: "Etapa 1 — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage2Term", label: "Etapa 2 — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage2Ent", label: "Etapa 2 — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage3Term", label: "Etapa 3 — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage3Ent", label: "Etapa 3 — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage4Term", label: "Etapa 4 — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "stage4Ent", label: "Etapa 4 — Entrega", type: "text", placeholder: "DD/MM/AA" },
      { key: "viajeFecha", label: "Viaje Rover / Curso — Fecha", type: "text", placeholder: "DD/MM/AA" },
      { key: "mopTerm", label: "Mensajeros de la Paz — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "tribuTerm", label: "Tribu de la Tierra — Término", type: "text", placeholder: "DD/MM/AA" },
      { key: "evento1Nombre", label: "Evento significativo — Nombre", type: "text", placeholder: "Ej. Moot Nacional / Encuentro" },
      { key: "evento1Fecha", label: "Evento — Fecha / Lugar", type: "text", placeholder: "DD/MM/AA · Lugar" },
      { key: "evento1Duracion", label: "Evento — Duración", type: "text", placeholder: "5 días" },
      { key: "evento1Eje", label: "Evento — Eje relacionado", type: "text", placeholder: "Habilidades / Paz" },
      { key: "signName", label: "Consejero / Scouter de Clan (Nombre)", type: "text", bind: "scouter", placeholder: "Nombre del Consejero" },
      { key: "groupScouter", label: "Jefe de Grupo (Nombre)", type: "text", placeholder: "Nombre quien firma por Grupo" }
    ]
  },

  vales: {
    id: "vales",
    code: "ASMAC NO 3",
    exportPrefix: "Vales NO 3 Tesoreria",
    baseDocId: "doc-0356",
    baseDocName: "NO 3 VALES DE CAJA Y RECIBO.pdf",
    title: "Vales de Caja y Recibo (NO 3 Tesorería)",
    subtitle: "Lámina administrativa de Grupo: Vale Provisional de Caja y Recibo foliados listos para imprimir",
    officialPages: [
      {
        src: "img/forms/vales_p1.webp",
        aspect: "1654 / 1241",
        boxes: [
          { key: "valeFolio", x: 26.0, y: 8.5, w: 19.0, h: 2.8 },
          { key: "valeAmount", x: 6.2, y: 18.2, w: 8.0, h: 2.4 },
          { key: "valeAmountWords", x: 15.6, y: 18.2, w: 30.0, h: 2.4 },
          { key: "valeConcept", x: 4.0, y: 24.0, w: 42.0, h: 13.5, multiline: true },
          { key: "valeDate", x: 4.0, y: 40.8, w: 12.5, h: 2.4 },
          { key: "valeAuth", x: 18.5, y: 40.8, w: 13.0, h: 2.4 },
          { key: "valeReceiver", x: 33.5, y: 40.8, w: 12.5, h: 2.4 },
          { key: "_userSignature", x: 33.5, y: 36.2, w: 12.5, h: 3.8, isSignature: true },
          { key: "reciboFolio", x: 76.0, y: 8.5, w: 19.5, h: 2.8 },
          { key: "reciboAmount", x: 56.2, y: 18.2, w: 8.0, h: 2.4 },
          { key: "reciboFrom", x: 54.0, y: 24.0, w: 42.0, h: 2.4 },
          { key: "reciboConcept", x: 54.0, y: 29.5, w: 42.0, h: 9.0, multiline: true },
          { key: "reciboDate", x: 54.0, y: 40.8, w: 12.5, h: 2.4 },
          { key: "reciboAuth", x: 68.5, y: 40.8, w: 13.0, h: 2.4 }
        ]
      }
    ],
    fields: [
      { key: "valeFolio", label: "Vale — Folio", type: "text", defaultValue: "001", placeholder: "Ej. 001" },
      { key: "valeAmount", label: "Vale — Importe ($)", type: "text", placeholder: "Ej. 500.00" },
      { key: "valeAmountWords", label: "Vale — Importe en letra", type: "text", placeholder: "Quinientos pesos 00/100 M.N." },
      { key: "valeConcept", label: "Vale — Concepto del gasto o caja", type: "textarea", full: true, placeholder: "Material para actividad o adelanto de campamento" },
      { key: "valeDate", label: "Vale — Fecha", type: "text", defaultTodaySlash: true, placeholder: "DD / MM / AA" },
      { key: "valeAuth", label: "Vale — Autorizado por", type: "text", bind: "scouter", placeholder: "Tesorero / Jefe de Grupo" },
      { key: "valeReceiver", label: "Vale — Recibí (Nombre)", type: "text", bind: "name", placeholder: "Quién recibe" },
      { key: "reciboFolio", label: "Recibo — Folio", type: "text", defaultValue: "001", placeholder: "Ej. 001" },
      { key: "reciboAmount", label: "Recibo — Importe ($)", type: "text", placeholder: "Ej. 500.00" },
      { key: "reciboFrom", label: "Recibo — Recibí de", type: "text", bind: "name", placeholder: "Nombre completo" },
      { key: "reciboConcept", label: "Recibo — Por concepto de", type: "textarea", full: true, placeholder: "Cuota de campamento / reembolso" },
      { key: "reciboDate", label: "Recibo — Fecha", type: "text", defaultTodaySlash: true, placeholder: "DD / MM / AA" },
      { key: "reciboAuth", label: "Recibo — Autorizado por", type: "text", bind: "scouter", placeholder: "Tesorero / Jefe de Grupo" }
    ]
  }
};

function parseDateTo8Digits(rawStr) {
  const s = String(rawStr || "").trim();
  if (!s) return ["", "", "", "", "", "", "", ""];
  const nums = s.match(/\d+/g);
  if (nums && nums.length >= 3) {
    let d = nums[0].padStart(2, "0").slice(-2);
    let m = nums[1].padStart(2, "0").slice(-2);
    let y = nums[2];
    if (y.length === 2) y = "20" + y;
    y = y.padStart(4, "0").slice(-4);
    return [...d.split(""), ...m.split(""), ...y.split("")];
  }
  const digitsOnly = s.replace(/\D/g, "");
  if (digitsOnly.length === 8) {
    return digitsOnly.split("");
  }
  return ["", "", "", "", "", "", "", ""];
}

function extractFirstGivenName(vals) {
  const raw = String(vals.firstName || vals.name || vals.eventName || vals.projectTitle || "").trim();
  if (!raw) return "";
  const firstToken = raw.split(/\s+/)[0] || "";
  return firstToken.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9_-]/g, "");
}

function buildOfficialExportFilename(tpl, vals, ext) {
  const prefix = tpl.exportPrefix || "Formato Scout";
  const first = extractFirstGivenName(vals);
  return first ? `${prefix} ${first} BiblioTech.${ext}` : `${prefix} BiblioTech.${ext}`;
}

// Empaquetador directo de páginas Canvas (JPEG) en un archivo binario PDF-1.4 multipágina válido
function buildMultiPagePdfBlobFromJpegDataUrls(pagesData) {
  const encoder = new TextEncoder();
  const chunks = [];
  let offset = 0;
  const offsets = [0];

  const pushStr = (str) => {
    const b = encoder.encode(str);
    chunks.push(b);
    offset += b.byteLength;
  };
  const pushBytes = (uint8) => {
    chunks.push(uint8);
    offset += uint8.byteLength;
  };

  pushStr("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

  // Object 1: Catalog, Object 2: Pages
  const numPages = pagesData.length;
  const pageObjIds = [];
  for (let i = 0; i < numPages; i++) {
    pageObjIds.push(3 + i * 3); // Page=3+3i, Content=4+3i, Image=5+3i
  }

  offsets[1] = offset;
  pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  offsets[2] = offset;
  pushStr(`2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${numPages} >>\nendobj\n`);

  for (let i = 0; i < numPages; i++) {
    const pg = pagesData[i];
    const pageId = 3 + i * 3;
    const contentId = 4 + i * 3;
    const imgId = 5 + i * 3;

    // Convertir base64 JPEG a Uint8Array
    const b64 = pg.jpegDataUrl.split(",")[1] || "";
    const binStr = atob(b64);
    const imgBytes = new Uint8Array(binStr.length);
    for (let k = 0; k < binStr.length; k++) imgBytes[k] = binStr.charCodeAt(k);

    // Dimensiones en puntos PDF (ancho Carta 612pt, alto proporcional exacto)
    const pdfW = 612;
    const pdfH = Math.round((pg.height / pg.width) * pdfW);

    offsets[pageId] = offset;
    pushStr(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfW} ${pdfH}] /Resources << /XObject << /Im${i} ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );

    const streamCmd = `q\n${pdfW} 0 0 ${pdfH} 0 0 cm\n/Im${i} Do\nQ\n`;
    offsets[contentId] = offset;
    pushStr(`${contentId} 0 obj\n<< /Length ${streamCmd.length} >>\nstream\n${streamCmd}endstream\nendobj\n`);

    offsets[imgId] = offset;
    pushStr(
      `${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pg.width} /Height ${pg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.byteLength} >>\nstream\n`
    );
    pushBytes(imgBytes);
    pushStr("\nendstream\nendobj\n");
  }

  const totalObjs = 2 + numPages * 3;
  const xrefOffset = offset;
  pushStr(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjs; id++) {
    pushStr(`${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}

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
  if (!workspace || !selectEl || !fieldsContainer || !sheetEl) return;

  let currentTemplateId = "salud";
  let currentValues = {};

  const nowDate = () => new Date();
  const todaySlashStr = () => {
    const d = nowDate();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

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
    if (typeof updateSavedBadge === "function") updateSavedBadge();
  };

  const getCurrentProfile = () => {
    const fromStorage = getAutofillProfile();
    const fromForm = typeof readFormProfileFn === "function" ? readFormProfileFn() : {};
    return {
      name: fromForm.name || fromStorage.name || "",
      cum: fromForm.cum || fromStorage.cum || "",
      age: fromForm.age || fromStorage.age || "",
      section: fromForm.section || fromStorage.section || "",
      group: fromForm.group || fromStorage.group || "",
      province: fromForm.province || fromStorage.province || "",
      blood: fromForm.blood || fromStorage.blood || "",
      emergency: fromForm.emergency || fromStorage.emergency || "",
      scouter: fromForm.scouter || fromStorage.scouter || ""
    };
  };

  const computeEffectiveValues = (tpl, rawVals) => {
    const v = { ...(rawVals || {}) };

    // Regla universal para "Otro": si seleccionó "Otro", usar lo escrito a mano en _other y NUNCA escribir la palabra "Otro"
    const resolveSelectWithOther = (key) => {
      const chosen = String(v[key] || "").trim();
      if (chosen === "Otro") {
        return String(v[`${key}_other`] || "").trim();
      }
      return chosen;
    };
    v._provinceOut = resolveSelectWithOther("province");
    v._sectionOut = resolveSelectWithOther("section");

    // Grupo y RH combinados
    const bg = String(v.bloodGroup || "").trim();
    const rh = String(v.bloodRh || "").trim();
    v._bloodCombined = bg || rh ? `${bg}${rh}` : "";

    // Peso (kg automático) y Talla (m) + Cálculo automático de I.M.C. = Peso / (Altura * Altura)
    const rawW = String(v.weightKg || "").replace(/[^0-9.]/g, "");
    const rawH = String(v.heightM || "").replace(/[^0-9.]/g, "");
    const numW = parseFloat(rawW);
    let numH = parseFloat(rawH);
    // Si alguien escribió 170 en lugar de 1.70, convertir a metros automáticamente
    if (numH > 3 && numH <= 250) {
      numH = numH / 100;
    }
    v._weightFormatted = !isNaN(numW) && numW > 0 ? `${rawW} kg` : "";
    v._heightFormatted = !isNaN(numH) && numH > 0 ? `${numH.toFixed(2)} m` : "";
    if (!isNaN(numW) && numW > 0 && !isNaN(numH) && numH > 0.3) {
      const sq = numH * numH;
      v._imcCalculated = (numW / sq).toFixed(2);
    } else {
      v._imcCalculated = "";
    }

    // Checkboxes de tipo de servicio de salud
    v._medTypePub = v.medServiceType === "Instituciones Públicas" ? "X" : "";
    v._medTypeAseg = v.medServiceType === "Aseguradoras" ? "X" : "";
    v._medTypePart = v.medServiceType === "Particular" ? "X" : "";

    // Valores por defecto obligatorios cuando el usuario deja vacío en Ficha de Salud
    v._allergiesOut = String(v.allergies || "").trim() || "Ninguna";
    v._medicationsOut = String(v.medications || "").trim() || "Ninguno";
    v._medHistory6mOut = String(v.medHistory6m || "").trim() || "No he presentado";
    v._psyHistory6mOut = String(v.psyHistory6m || "").trim() || "No he presentado";

    // 24 Antecedentes Médicos + 13 Psicológicos: check marcado -> SÍ, sin marcar -> NO
    for (const item of HEALTH_ANTECEDENTES_LIST) {
      const checked = Boolean(v[`${item.key}_chk`]);
      v[`_${item.key}_sino`] = checked ? "SÍ" : "NO";
      if (!checked) v[`${item.key}_esp`] = "";
    }
    for (const item of PSYCH_ANTECEDENTES_LIST) {
      const checked = Boolean(v[`${item.key}_chk`]);
      v[`_${item.key}_sino`] = checked ? "SÍ" : "NO";
      if (!checked) v[`${item.key}_esp`] = "";
    }

    // Permiso JL304: 8 casillas de Fecha de autorización y 8 casillas de Fecha de nacimiento
    const authDigits = parseDateTo8Digits(v.authDate);
    authDigits.forEach((d, idx) => {
      v[`_authD${idx}`] = d;
    });
    const birthDigits = parseDateTo8Digits(v.birthDate);
    birthDigits.forEach((d, idx) => {
      v[`_birthD${idx}`] = d;
    });

    // Consentimiento de medios en JL304 Página 2
    const mediaOk = v.mediaConsent !== false && v.mediaConsent !== "false";
    v._mediaConsentYes = mediaOk ? "X" : "";
    v._mediaConsentNo = mediaOk ? "" : "X";

    return v;
  };

  const buildInitialValues = (tplId) => {
    const tpl = SMART_FORM_TEMPLATES[tplId] || SMART_FORM_TEMPLATES.salud;
    const saved = readActiveStorage(tpl.id) || {};
    const prof = getCurrentProfile();
    const out = { ...saved };
    const d = nowDate();

    for (const f of tpl.fields) {
      if (!f.key) continue;
      if (saved[f.key] !== undefined && String(saved[f.key]).trim() !== "") {
        out[f.key] = saved[f.key];
      } else if (f.bind && prof[f.bind]) {
        let boundVal = String(prof[f.bind]).trim();
        if (f.key === "province" && boundVal) {
          const matchProv = OFFICIAL_PROVINCE_NAMES.find((p) => normalizeStr(p) === normalizeStr(boundVal));
          if (matchProv) {
            out[f.key] = matchProv;
          } else {
            out[f.key] = "Otro";
            out.province_other = boundVal;
          }
        } else if (f.key === "section" && boundVal) {
          const matchSec = OFFICIAL_SECTION_SELECT_OPTIONS.find((s) => s && normalizeStr(s) === normalizeStr(boundVal));
          if (matchSec) {
            out[f.key] = matchSec;
          } else if (boundVal.toLowerCase().includes("manada")) out[f.key] = "Manada";
          else if (boundVal.toLowerCase().includes("tropa")) out[f.key] = "Tropa";
          else if (boundVal.toLowerCase().includes("comunidad")) out[f.key] = "Comunidad";
          else if (boundVal.toLowerCase().includes("clan")) out[f.key] = "Clan";
          else if (boundVal.toLowerCase().includes("scouter") || boundVal.toLowerCase().includes("dirigente")) out[f.key] = "Scouters o Dirigentes";
          else {
            out[f.key] = "Otro";
            out.section_other = boundVal;
          }
        } else {
          out[f.key] = boundVal;
        }
      } else if (f.defaultTodayDay) {
        out[f.key] = String(d.getDate()).padStart(2, "0");
      } else if (f.defaultTodayMonth) {
        out[f.key] = MONTHS_ES[d.getMonth()];
      } else if (f.defaultTodaySlash) {
        out[f.key] = todaySlashStr();
      } else if (f.defaultValue !== undefined) {
        out[f.key] = f.defaultValue;
      } else if (f.type === "single_checkbox") {
        out[f.key] = f.defaultChecked !== undefined ? Boolean(f.defaultChecked) : false;
      } else if (f.type === "select" && Array.isArray(f.options) && f.options.length) {
        out[f.key] = f.options[0];
      } else {
        out[f.key] = "";
      }
    }

    // Si en JL304 el usuario tiene nombre completo en Perfil Local pero aún no separó firstName/lastName1/lastName2
    if (tpl.id === "jl304" && !out.firstName && !out.lastName1 && prof.name) {
      const parts = prof.name.trim().split(/\s+/);
      if (parts.length === 1) {
        out.firstName = parts[0];
      } else if (parts.length === 2) {
        out.firstName = parts[0];
        out.lastName1 = parts[1];
      } else if (parts.length >= 3) {
        out.lastName2 = parts.pop();
        out.lastName1 = parts.pop();
        out.firstName = parts.join(" ");
      }
    }

    return out;
  };

  // Imagen caché en memoria para vista previa en vivo instantánea (<canvas> == PDF/PNG final)
  const sfImgCache = new Map();
  const BT_USER_SIGNATURE_KEY = "bt_user_signature_v1";
  const getSavedSignatureState = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(BT_USER_SIGNATURE_KEY) || "{}");
      const mode = ["blank", "draw", "upload"].includes(parsed.mode) ? parsed.mode : "blank";
      return { mode, dataUrl: typeof parsed.dataUrl === "string" ? parsed.dataUrl : "" };
    } catch (_) {
      return { mode: "blank", dataUrl: "" };
    }
  };
  const saveSignatureState = (next) => {
    try {
      localStorage.setItem(BT_USER_SIGNATURE_KEY, JSON.stringify(next || { mode: "blank", dataUrl: "" }));
    } catch (_) {}
  };
  let signatureState = getSavedSignatureState();
  const sfSigImgCache = new Map();

  const loadImageCached = (src) => {
    if (!src) return Promise.resolve(null);
    if (src.startsWith("data:") && sfSigImgCache.has(src)) return Promise.resolve(sfSigImgCache.get(src));
    if (!src.startsWith("data:") && sfImgCache.has(src)) return Promise.resolve(sfImgCache.get(src));
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => {
        if (src.startsWith("data:")) sfSigImgCache.set(src, im);
        else sfImgCache.set(src, im);
        resolve(im);
      };
      im.onerror = reject;
      im.src = src;
    });
  };

  let previewRenderSeq = 0;
  let previewDebounceTimer = null;

  // Renderiza la estructura de contenedores en vivo + áreas interactivas clicables para enfocar o alternar checks
  const renderSheetHtml = (tpl, rawVals) => {
    const vals = computeEffectiveValues(tpl, rawVals);
    if (!Array.isArray(tpl.officialPages) || !tpl.officialPages.length) return "";

    const pagesInner = tpl.officialPages
      .map((pg, idx) => {
        const hitboxes = (pg.boxes || [])
          .filter((b) => !b.isSignature)
          .map((b) => {
            const k = b.key || "";
            if (b.isCheck) {
              const checked = vals[k] === true || vals[k] === "true" || vals[k] === "X" || vals[k] === "✓";
              return `<button type="button" class="bt-sf-hitbox is-check-box${checked ? " is-checked" : ""}" data-sf-hitbox-check="${escapeHtml(k)}" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%;" title="Clic para marcar / desmarcar"></button>`;
            }
            const focusKey = k.startsWith("_") ? k.replace(/^_/, "").replace(/Out$/, "") : k;
            return `<button type="button" class="bt-sf-hitbox is-text-box" data-sf-hitbox-focus="${escapeHtml(focusKey)}" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%;" title="Clic para editar este campo"></button>`;
          })
          .join("");

        return `
          <div class="bt-sf-official-page-wrap" data-official-page-index="${idx + 1}">
            <div class="bt-sf-official-page-badge">Documento Oficial ASMAC: ${escapeHtml(tpl.baseDocName || tpl.code)} · Hoja ${idx + 1} de ${tpl.officialPages.length}</div>
            <div class="bt-sf-official-page" style="aspect-ratio:${pg.aspect || "1347 / 1743"};">
              <canvas class="bt-sf-preview-canvas" data-sf-preview-canvas="${idx}" aria-label="${escapeHtml(tpl.title)} hoja ${idx + 1}"></canvas>
              <div class="bt-sf-official-hitboxes">${hitboxes}</div>
            </div>
          </div>`;
      })
      .join("");

    return `<div class="bt-sf-official-pages-stack">${pagesInner}</div>`;
  };

  const paintLivePreviewCanvases = async (tpl, valsSnapshot) => {
    const seq = ++previewRenderSeq;
    try {
      const rendered = await renderOfficialPagesToCanvases(tpl, valsSnapshot, { forExport: false });
      if (seq !== previewRenderSeq) return;
      const canvases = Array.from(sheetEl.querySelectorAll("canvas.bt-sf-preview-canvas"));
      rendered.forEach((item, idx) => {
        const target = canvases[idx];
        if (!target || !item || !item.canvas) return;
        if (target.width !== item.width || target.height !== item.height) {
          target.width = item.width;
          target.height = item.height;
        }
        const ctx = target.getContext("2d");
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.drawImage(item.canvas, 0, 0);
      });
    } catch (err) {
      console.warn("[BiblioTech SF Preview]", err);
    }
  };

  const updatePreviewSheet = (rebuildDom = false) => {
    const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
    const eff = computeEffectiveValues(tpl, currentValues);
    const imcInput = fieldsContainer.querySelector('[data-sf-readonly="_imcPreview"]');
    if (imcInput) {
      imcInput.value = eff._imcCalculated ? `${eff._imcCalculated} kg/m²` : "";
    }
    const existingTplId = sheetEl.getAttribute("data-rendered-tpl");
    if (rebuildDom || existingTplId !== tpl.id || !sheetEl.querySelector("canvas.bt-sf-preview-canvas")) {
      sheetEl.setAttribute("data-rendered-tpl", tpl.id);
      sheetEl.innerHTML = renderSheetHtml(tpl, currentValues);
    } else {
      // Actualiza estado visual de hitboxes de checkbox sin destruir los canvas
      sheetEl.querySelectorAll("[data-sf-hitbox-check]").forEach((hb) => {
        const k = hb.getAttribute("data-sf-hitbox-check");
        const checked = eff[k] === true || eff[k] === "true" || eff[k] === "X" || eff[k] === "✓";
        hb.classList.toggle("is-checked", checked);
      });
    }
    if (previewDebounceTimer) clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => {
      paintLivePreviewCanvases(tpl, currentValues);
    }, 18);
  };

  const renderAntecedentesGridHtml = (items) => {
    const cards = items
      .map((item) => {
        const chkKey = `${item.key}_chk`;
        const espKey = `${item.key}_esp`;
        const isChecked = Boolean(currentValues[chkKey]);
        const espVal = currentValues[espKey] || "";
        return `
          <div class="bt-sf-ant-row${isChecked ? " is-checked" : ""}">
            <label class="bt-sf-ant-check-label">
              <input type="checkbox" data-sf-check="${escapeHtml(chkKey)}"${isChecked ? " checked" : ""} />
              <span class="bt-sf-ant-name">${escapeHtml(item.label)}</span>
              <span class="bt-sf-ant-state">${isChecked ? "SÍ" : "NO"}</span>
            </label>
            <input
              type="text"
              class="bt-sf-ant-esp-input${isChecked ? "" : " hidden"}"
              data-sf-field="${escapeHtml(espKey)}"
              value="${escapeHtml(espVal)}"
              placeholder="Especifique (opcional)"
              ${isChecked ? "" : "disabled"}
            />
          </div>`;
      })
      .join("");
    return `<div class="bt-sf-field is-full"><div class="bt-sf-ant-grid">${cards}</div></div>`;
  };

  const renderImmunoGridHtml = () => {
    const allRows = [...IMMUNO_LEFT_ROWS, ...IMMUNO_RIGHT_ROWS];
    const rowsHtml = allRows
      .map((r) => {
        const vacVal = currentValues[`${r.key}_vac`] || "";
        const fvacVal = currentValues[`${r.key}_fvac`] || "";
        const padVal = currentValues[`${r.key}_pad`] || "";
        const fpadVal = currentValues[`${r.key}_fpad`] || "";
        return `
          <div class="bt-sf-immuno-card">
            <div class="bt-sf-immuno-title">${escapeHtml(r.label)}</div>
            <div class="bt-sf-immuno-inputs">
              <label>
                <span>Vacuna (Sí/No)</span>
                <select data-sf-field="${escapeHtml(r.key)}_vac">
                  <option value=""${vacVal === "" ? " selected" : ""}>—</option>
                  <option value="SÍ"${vacVal === "SÍ" ? " selected" : ""}>SÍ</option>
                  <option value="NO"${vacVal === "NO" ? " selected" : ""}>NO</option>
                </select>
              </label>
              <label>
                <span>Fecha Vacuna</span>
                <input type="text" data-sf-field="${escapeHtml(r.key)}_fvac" value="${escapeHtml(fvacVal)}" placeholder="Día/Mes/Año" />
              </label>
              ${
                r.hasPadecio
                  ? `<label>
                      <span>Padeció</span>
                      <input type="text" data-sf-field="${escapeHtml(r.key)}_pad" value="${escapeHtml(padVal)}" placeholder="Sí / No" />
                    </label>
                    <label>
                      <span>Fecha Padeció</span>
                      <input type="text" data-sf-field="${escapeHtml(r.key)}_fpad" value="${escapeHtml(fpadVal)}" placeholder="Día/Mes/Año" />
                    </label>`
                  : ""
              }
            </div>
          </div>`;
      })
      .join("");

    return `
      <div class="bt-sf-field is-full">
        <div class="bt-sf-immuno-grid">${rowsHtml}</div>
        <div class="bt-sf-fields-grid" style="margin-top:0.65rem;">
          <label class="bt-sf-field">
            <span>COVID 2ª Dosis (Vacuna Sí/No)</span>
            <select data-sf-field="im_covid2_vac">
              <option value=""${(currentValues.im_covid2_vac || "") === "" ? " selected" : ""}>—</option>
              <option value="SÍ"${currentValues.im_covid2_vac === "SÍ" ? " selected" : ""}>SÍ</option>
              <option value="NO"${currentValues.im_covid2_vac === "NO" ? " selected" : ""}>NO</option>
            </select>
          </label>
          <label class="bt-sf-field">
            <span>Fecha COVID 2ª Dosis (Día/Mes/Año)</span>
            <input type="text" data-sf-field="im_covid2_fvac" value="${escapeHtml(currentValues.im_covid2_fvac || "")}" placeholder="Día/Mes/Año" />
          </label>
          <label class="bt-sf-field">
            <span>Reacción a vacunas</span>
            <input type="text" data-sf-field="im_reaccion" value="${escapeHtml(currentValues.im_reaccion || "")}" placeholder="Especificar si hubo reacción" />
          </label>
          <label class="bt-sf-field">
            <span>Otras vacunas</span>
            <input type="text" data-sf-field="im_otras" value="${escapeHtml(currentValues.im_otras || "")}" placeholder="Otras vacunas aplicadas" />
          </label>
          <label class="bt-sf-field">
            <span>Marca Vacuna COVID (1ª Dosis)</span>
            <input type="text" data-sf-field="im_covid_marca1" value="${escapeHtml(currentValues.im_covid_marca1 || "")}" placeholder="Marca 1ª dosis" />
          </label>
          <label class="bt-sf-field">
            <span>Marca Vacuna COVID (2ª Dosis)</span>
            <input type="text" data-sf-field="im_covid_marca2" value="${escapeHtml(currentValues.im_covid_marca2 || "")}" placeholder="Marca 2ª dosis" />
          </label>
          <label class="bt-sf-field">
            <span>Marca Vacuna COVID (3ª Dosis)</span>
            <input type="text" data-sf-field="im_covid_marca3" value="${escapeHtml(currentValues.im_covid_marca3 || "")}" placeholder="Marca 3ª dosis" />
          </label>
          <label class="bt-sf-field">
            <span>Marca Vacuna COVID (4ª Dosis)</span>
            <input type="text" data-sf-field="im_covid_marca4" value="${escapeHtml(currentValues.im_covid_marca4 || "")}" placeholder="Marca 4ª dosis" />
          </label>
        </div>
      </div>`;
  };

  const renderFields = () => {
    const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
    const eff = computeEffectiveValues(tpl, currentValues);

    fieldsContainer.innerHTML = tpl.fields
      .map((f) => {
        if (f.type === "section_heading") {
          return `<div class="bt-sf-section-divider">${escapeHtml(f.label)}</div>`;
        }
        if (f.type === "antecedentes_grid") {
          return renderAntecedentesGridHtml(f.items || []);
        }
        if (f.type === "immuno_grid") {
          return renderImmunoGridHtml();
        }
        const val = currentValues[f.key] ?? "";
        const wrapCls = f.full || f.type === "textarea" ? "bt-sf-field is-full" : "bt-sf-field";

        if (f.type === "readonly") {
          const disp = f.key === "_imcPreview" && eff._imcCalculated ? `${eff._imcCalculated} kg/m²` : "";
          return `<label class="${wrapCls}"><span>${escapeHtml(f.label)}</span><input type="text" data-sf-readonly="${escapeHtml(f.key)}" value="${escapeHtml(disp)}" placeholder="${escapeHtml(f.placeholder || "")}" readonly /></label>`;
        }

        if (f.type === "single_checkbox") {
          const isChecked = val !== false && val !== "false" && Boolean(val);
          return `
            <label class="bt-sf-field is-full bt-sf-single-check">
              <input type="checkbox" data-sf-check="${escapeHtml(f.key)}"${isChecked ? " checked" : ""} />
              <span>${escapeHtml(f.label)}</span>
            </label>`;
        }

        if (f.type === "checks_group" && Array.isArray(f.options)) {
          const checksHtml = f.options
            .map((opt) => {
              const checked = Boolean(currentValues[opt.key]);
              return `
                <label class="bt-sf-check-chip${checked ? " is-checked" : ""}">
                  <input type="checkbox" data-sf-check="${escapeHtml(opt.key)}"${checked ? " checked" : ""} />
                  <span>${escapeHtml(opt.label)}</span>
                </label>`;
            })
            .join("");
          return `<div class="bt-sf-field is-full"><span class="bt-sf-group-label">${escapeHtml(f.label)}</span><div class="bt-sf-checks-group">${checksHtml}</div></div>`;
        }

        if (f.type === "select" && Array.isArray(f.options)) {
          const opts = f.options
            .map((o) => {
              const label = o === "" ? "Selecciona una opción..." : o;
              return `<option value="${escapeHtml(o)}"${o === val ? " selected" : ""}>${escapeHtml(label)}</option>`;
            })
            .join("");
          const isOther = f.allowOther && val === "Otro";
          const otherVal = currentValues[`${f.key}_other`] || "";
          const otherInput = f.allowOther
            ? `<input
                type="text"
                class="bt-sf-other-input${isOther ? "" : " hidden"}"
                data-sf-field="${escapeHtml(f.key)}_other"
                data-sf-other-for="${escapeHtml(f.key)}"
                value="${escapeHtml(otherVal)}"
                placeholder="${escapeHtml(f.otherPlaceholder || "Escribe aquí tu opción...")}"
              />`
            : "";
          return `<label class="${wrapCls}"><span>${escapeHtml(f.label)}</span><select data-sf-field="${escapeHtml(f.key)}">${opts}</select>${otherInput}</label>`;
        }

        if (f.type === "textarea") {
          return `<label class="${wrapCls}"><span>${escapeHtml(f.label)}</span><textarea rows="2" data-sf-field="${escapeHtml(f.key)}" placeholder="${escapeHtml(f.placeholder || "")}">${escapeHtml(val)}</textarea></label>`;
        }

        const inputType = f.type === "number" ? "number" : "text";
        const stepAttr = f.step ? ` step="${escapeHtml(f.step)}"` : "";
        return `<label class="${wrapCls}"><span>${escapeHtml(f.label)}</span><input type="${inputType}"${stepAttr} data-sf-field="${escapeHtml(f.key)}" value="${escapeHtml(val)}" placeholder="${escapeHtml(f.placeholder || "")}" /></label>`;
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
    if (statusEl) statusEl.textContent = "Documento oficial listo para llenar";
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
        const boundVal = String(prof[f.bind]).trim();
        if (f.key === "province") {
          const matchProv = OFFICIAL_PROVINCE_NAMES.find((p) => normalizeStr(p) === normalizeStr(boundVal));
          if (matchProv) {
            currentValues.province = matchProv;
          } else {
            currentValues.province = "Otro";
            currentValues.province_other = boundVal;
          }
        } else if (f.key === "section") {
          const matchSec = OFFICIAL_SECTION_SELECT_OPTIONS.find((s) => s && normalizeStr(s) === normalizeStr(boundVal));
          if (matchSec) currentValues.section = matchSec;
          else {
            currentValues.section = "Otro";
            currentValues.section_other = boundVal;
          }
        } else {
          currentValues[f.key] = boundVal;
        }
        count++;
      }
    }
    if (tpl.id === "jl304" && prof.name) {
      const parts = prof.name.trim().split(/\s+/);
      if (parts.length === 1) currentValues.firstName = parts[0];
      else if (parts.length === 2) {
        currentValues.firstName = parts[0];
        currentValues.lastName1 = parts[1];
      } else if (parts.length >= 3) {
        const copy = parts.slice();
        currentValues.lastName2 = copy.pop();
        currentValues.lastName1 = copy.pop();
        currentValues.firstName = copy.join(" ");
      }
      count++;
    }
    if (tpl.id === "salud" && prof.blood) {
      const m = prof.blood.toUpperCase().match(/(AB|A|B|O)\s*([+-])/);
      if (m) {
        currentValues.bloodGroup = m[1];
        currentValues.bloodRh = m[2];
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

    // Si es un select que tiene opción "Otro", mostrar u ocultar su input compañero sin perder foco
    const otherInput = fieldsContainer.querySelector(`[data-sf-other-for="${key}"]`);
    if (otherInput) {
      const showOther = input.value === "Otro";
      otherInput.classList.toggle("hidden", !showOther);
    }

    writeActiveStorage(currentTemplateId, currentValues);
    updatePreviewSheet();
    if (statusEl) statusEl.textContent = "Guardado en este dispositivo";
  });

  fieldsContainer.addEventListener("change", (e) => {
    const chk = e.target.closest("[data-sf-check]");
    if (chk) {
      const key = chk.getAttribute("data-sf-check");
      currentValues[key] = Boolean(chk.checked);
      const row = chk.closest(".bt-sf-ant-row");
      if (row) {
        row.classList.toggle("is-checked", chk.checked);
        const stateBadge = row.querySelector(".bt-sf-ant-state");
        if (stateBadge) stateBadge.textContent = chk.checked ? "SÍ" : "NO";
        const espInput = row.querySelector(".bt-sf-ant-esp-input");
        if (espInput) {
          espInput.classList.toggle("hidden", !chk.checked);
          espInput.disabled = !chk.checked;
          if (chk.checked) espInput.focus();
        }
      }
      const chip = chk.closest(".bt-sf-check-chip");
      if (chip) chip.classList.toggle("is-checked", chk.checked);
      writeActiveStorage(currentTemplateId, currentValues);
      updatePreviewSheet();
      if (statusEl) statusEl.textContent = "Guardado en este dispositivo";
    }
  });

  if (sheetEl) {
    sheetEl.addEventListener("click", (e) => {
      const checkBtn = e.target.closest("[data-sf-hitbox-check]");
      if (checkBtn) {
        const key = checkBtn.getAttribute("data-sf-hitbox-check");
        if (key === "_mediaConsentYes" || key === "_mediaConsentNo") {
          const next = key === "_mediaConsentYes";
          currentValues.mediaConsent = next;
          const inp = fieldsContainer.querySelector('[data-sf-check="mediaConsent"]');
          if (inp) inp.checked = next;
        } else {
          const next = !Boolean(currentValues[key]);
          currentValues[key] = next;
          const inp = fieldsContainer.querySelector(`[data-sf-check="${key}"]`);
          if (inp) {
            inp.checked = next;
            const chip = inp.closest(".bt-sf-check-chip");
            if (chip) chip.classList.toggle("is-checked", next);
          }
        }
        writeActiveStorage(currentTemplateId, currentValues);
        updatePreviewSheet();
        if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("click");
        return;
      }
      const focusBtn = e.target.closest("[data-sf-hitbox-focus]");
      if (focusBtn) {
        const key = focusBtn.getAttribute("data-sf-hitbox-focus");
        const targetField = fieldsContainer.querySelector(`[data-sf-field="${key}"]`) ||
          fieldsContainer.querySelector(`[data-sf-field^="${key}"]`);
        if (targetField) {
          targetField.scrollIntoView({ behavior: "smooth", block: "center" });
          targetField.focus();
        }
      }
    });
  }

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
      const who = (extractFirstGivenName(currentValues) || "Scout").trim();
      const drafts = readNamedDrafts();
      const entry = {
        id: `d_${Date.now().toString(36)}`,
        templateId: tpl.id,
        label: `${tpl.exportPrefix} · ${who.slice(0, 28)}`,
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
      showWebToast("Campos restablecidos.");
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

  // Renderiza todas las páginas oficiales del formato actual en objetos Canvas independientes (vista previa == PDF/PNG)
  const renderOfficialPagesToCanvases = async (tpl, rawVals, opts = {}) => {
    const forExport = opts.forExport !== false;
    const vals = computeEffectiveValues(tpl, rawVals);
    const pages = Array.isArray(tpl.officialPages) ? tpl.officialPages : [];
    const loadedImgs = await Promise.all(
      pages.map(async (pg) => {
        const im = await loadImageCached(pg.src);
        return { im, pg };
      })
    );
    const sigImg =
      signatureState.mode !== "blank" && signatureState.dataUrl
        ? await loadImageCached(signatureState.dataUrl).catch(() => null)
        : null;

    const renderedPages = [];
    for (const { im, pg } of loadedImgs) {
      if (!im) continue;
      const pw = im.naturalWidth || 1311;
      const ph = im.naturalHeight || 1853;
      const canvas = document.createElement("canvas");
      canvas.width = pw;
      canvas.height = ph;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pw, ph);
      ctx.drawImage(im, 0, 0, pw, ph);
      ctx.fillStyle = "#0f172a";

      for (const b of pg.boxes || []) {
        const bx = (b.x / 100) * pw;
        const by = (b.y / 100) * ph;
        const bw = (b.w / 100) * pw;
        const bh = (b.h / 100) * ph;

        if (b.isSignature) {
          if (sigImg) {
            const pad = 4;
            const availW = Math.max(12, bw - pad * 2);
            const availH = Math.max(10, bh - pad * 2);
            const natW = sigImg.naturalWidth || sigImg.width || 300;
            const natH = sigImg.naturalHeight || sigImg.height || 100;
            const scale = Math.min(availW / Math.max(1, natW), availH / Math.max(1, natH));
            const dw = natW * scale;
            const dh = natH * scale;
            ctx.drawImage(sigImg, bx + (bw - dw) / 2, by + (bh - dh) / 2, dw, dh);
          }
          continue;
        }

        if (b.isCheck) {
          const isChecked =
            vals[b.key] === true || vals[b.key] === "true" || vals[b.key] === "X" || vals[b.key] === "✓";
          if (!isChecked) continue;
          ctx.save();
          if (b.checkSymbol === "X") {
            const fPx = Math.max(12, Math.min(20, Math.round(bh * 0.78)));
            ctx.font = `800 ${fPx}px Arial, Helvetica, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#1e293b";
            ctx.fillText("X", bx + bw / 2, by + bh / 2);
          } else {
            ctx.strokeStyle = b.checkColor || "#1e293b";
            ctx.lineWidth = Math.max(2.6, Math.min(4.2, bh * 0.16));
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(bx + bw * 0.2, by + bh * 0.54);
            ctx.lineTo(bx + bw * 0.43, by + bh * 0.78);
            ctx.lineTo(bx + bw * 0.82, by + bh * 0.24);
            ctx.stroke();
          }
          ctx.restore();
          continue;
        }

        const val = String(vals[b.key] ?? "").trim();
        if (!val) continue;

        if (!b.multiline) {
          let fontPx = Math.max(10, Math.min(18, Math.round(Math.min(pw * 0.0122, bh * 0.7))));
          ctx.font = `700 ${fontPx}px Arial, Helvetica, sans-serif`;
          const maxW = Math.max(10, bw - 6);
          while (fontPx > 9 && ctx.measureText(val).width > maxW) {
            fontPx -= 1;
            ctx.font = `700 ${fontPx}px Arial, Helvetica, sans-serif`;
          }
          ctx.textBaseline = "middle";
          let tx = bx + 3;
          if (b.align === "center") {
            tx = bx + Math.max(2, (bw - Math.min(bw - 4, ctx.measureText(val).width)) / 2);
          }
          ctx.fillText(val, tx, by + bh / 2, bw - 4);
        } else {
          ctx.textBaseline = "top";
          const wrapText = (fSize) => {
            ctx.font = `700 ${fSize}px Arial, Helvetica, sans-serif`;
            const lines = [];
            for (const rl of val.split(/\r?\n/)) {
              const words = rl.split(/\s+/);
              let line = "";
              for (const w of words) {
                const test = line ? `${line} ${w}` : w;
                if (ctx.measureText(test).width > bw - 8 && line) {
                  lines.push(line);
                  line = w;
                } else {
                  line = test;
                }
              }
              if (line) lines.push(line);
            }
            return lines;
          };
          let fontPx = Math.max(10, Math.min(16, Math.round(pw * 0.0112)));
          let wrapped = wrapText(fontPx);
          while (fontPx > 9 && wrapped.length * (fontPx * 1.2) > bh - 2) {
            fontPx -= 1;
            wrapped = wrapText(fontPx);
          }
          const maxLines = Math.max(1, Math.floor(bh / (fontPx * 1.2)));
          for (let li = 0; li < Math.min(wrapped.length, maxLines); li++) {
            ctx.fillText(wrapped[li], bx + 4, by + 2 + li * (fontPx * 1.2), bw - 6);
          }
        }
      }

      renderedPages.push({
        canvas,
        width: pw,
        height: ph,
        jpegDataUrl: forExport ? canvas.toDataURL("image/jpeg", 0.95) : "",
      });
    }
    return renderedPages;
  };

  // Botón principal: Descargar PDF Oficial (.pdf) con nombre exacto "Ficha de Salud <PrimerNombre> BiblioTech.pdf"
  if (printBtn) {
    printBtn.addEventListener("click", async () => {
      const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
      try {
        const renderedPages = await renderOfficialPagesToCanvases(tpl, currentValues);
        if (!renderedPages.length) return;
        const pdfBlob = buildMultiPagePdfBlobFromJpegDataUrls(renderedPages);
        const fileName = buildOfficialExportFilename(tpl, currentValues, "pdf");
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showWebToast(`Descargado: ${fileName}`);
      } catch (err) {
        console.warn("[BiblioTech] Error generando PDF oficial:", err);
        showWebToast("No se pudo generar el PDF en este navegador.");
      }
    });
  }

  // Botón Imprimir: abre las páginas oficiales ya estampadas sin márgenes ni hojas extra
  if (wordBtn) {
    wordBtn.addEventListener("click", async () => {
      const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
      try {
        const renderedPages = await renderOfficialPagesToCanvases(tpl, currentValues);
        if (!renderedPages.length) return;
        const fileName = buildOfficialExportFilename(tpl, currentValues, "pdf").replace(/\.pdf$/i, "");
        const imgsHtml = renderedPages
          .map((p) => `<div class="pg"><img src="${p.jpegDataUrl}" alt="Hoja oficial" /></div>`)
          .join("");
        const w = window.open("", "_blank");
        if (!w) {
          printBtn.click();
          return;
        }
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(fileName)}</title>
          <style>
            @page { size: letter portrait; margin: 0; }
            html, body { margin: 0; padding: 0; background: #fff; }
            .pg { width: 100vw; height: 100vh; page-break-after: always; break-after: page; display: flex; align-items: center; justify-content: center; }
            .pg:last-child { page-break-after: auto; break-after: auto; }
            img { width: 100%; height: 100%; object-fit: contain; display: block; }
          </style></head><body>${imgsHtml}
          <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };<\/script>
          </body></html>`);
        w.document.close();
      } catch (_) {}
    });
  }

  const pngBtn = document.getElementById("btnSfDownloadOfficialPng");
  const openBaseBtn = document.getElementById("btnSfOpenBaseDoc");
  const reportFormatBtn = document.getElementById("btnSfReportFormat");

  if (openBaseBtn) {
    openBaseBtn.addEventListener("click", () => {
      const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
      if (tpl.baseDocId && typeof openDocumentModal === "function") {
        openDocumentModal(tpl.baseDocId);
      }
    });
  }

  if (reportFormatBtn) {
    reportFormatBtn.addEventListener("click", () => {
      const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
      if (typeof window.__btOpenBugReport === "function") {
        window.__btOpenBugReport("Editor de Formatos", tpl ? tpl.title : "Editor de Formatos", false);
      }
    });
  }

  if (pngBtn) {
    pngBtn.addEventListener("click", async () => {
      const tpl = SMART_FORM_TEMPLATES[currentTemplateId] || SMART_FORM_TEMPLATES.salud;
      try {
        const renderedPages = await renderOfficialPagesToCanvases(tpl, currentValues);
        if (!renderedPages.length) return;
        const maxW = Math.max(...renderedPages.map((x) => x.width));
        const gap = renderedPages.length > 1 ? 28 : 0;
        const totalH = renderedPages.reduce((s, x) => s + x.height, 0) + gap * (renderedPages.length - 1);
        const outCanvas = document.createElement("canvas");
        outCanvas.width = maxW;
        outCanvas.height = totalH;
        const ctx = outCanvas.getContext("2d");
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(0, 0, maxW, totalH);
        let y = 0;
        for (const pg of renderedPages) {
          ctx.drawImage(pg.canvas, 0, y);
          y += pg.height + gap;
        }
        outCanvas.toBlob((blob) => {
          if (!blob) return;
          const fileName = buildOfficialExportFilename(tpl, currentValues, "png");
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1500);
          showWebToast(`Descargado: ${fileName}`);
        }, "image/png");
      } catch (err) {
        console.warn("[BiblioTech] Error generando PNG oficial:", err);
      }
    });
  }

  // Controlador de Firma Digital Opcional (#btSignatureControl)
  const sigControl = document.getElementById("btSignatureControl");
  if (sigControl) {
    const modeBtns = Array.from(sigControl.querySelectorAll("[data-sig-mode]"));
    const drawWrap = document.getElementById("btSigDrawWrap");
    const uploadWrap = document.getElementById("btSigUploadWrap");
    const padCanvas = document.getElementById("btSigPadCanvas");
    const padClearBtn = document.getElementById("btSigClearBtn");
    const padSaveBtn = document.getElementById("btSigSavePadBtn");
    const uploadInput = document.getElementById("btSigUploadInput");
    const uploadPreviewWrap = document.getElementById("btSigUploadPreviewWrap");
    const uploadPreviewImg = document.getElementById("btSigUploadPreviewImg");
    const uploadRemoveBtn = document.getElementById("btSigRemoveUploadBtn");
    const sigStatusEl = document.getElementById("btSigStatusText");

    const syncSigUi = () => {
      const m = signatureState.mode || "blank";
      modeBtns.forEach((b) => {
        const act = b.getAttribute("data-sig-mode") === m;
        b.classList.toggle("is-active", act);
        b.setAttribute("aria-pressed", String(act));
      });
      if (drawWrap) drawWrap.classList.toggle("hidden", m !== "draw");
      if (uploadWrap) uploadWrap.classList.toggle("hidden", m !== "upload");
      if (sigStatusEl) {
        const isEn = document.documentElement.dataset.btLang === "en";
        if (m === "blank") sigStatusEl.textContent = isEn ? "Blank for handwritten signature" : "En blanco para firmar en físico";
        else if (m === "draw") sigStatusEl.textContent = signatureState.dataUrl ? (isEn ? "Drawn signature active" : "Trazo guardado y activo en PDF") : (isEn ? "Draw below" : "Dibuja tu firma abajo");
        else sigStatusEl.textContent = signatureState.dataUrl ? (isEn ? "Uploaded signature active" : "Imagen de firma activa en PDF") : (isEn ? "Choose an image" : "Selecciona PNG/JPG/WEBP");
      }
      if (uploadPreviewWrap && uploadPreviewImg) {
        const hasUp = m === "upload" && Boolean(signatureState.dataUrl);
        uploadPreviewWrap.classList.toggle("hidden", !hasUp);
        if (hasUp) uploadPreviewImg.src = signatureState.dataUrl;
      }
    };

    modeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = btn.getAttribute("data-sig-mode") || "blank";
        signatureState = { mode: m, dataUrl: signatureState.dataUrl || "" };
        saveSignatureState(signatureState);
        syncSigUi();
        updatePreviewSheet();
        if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("click");
      });
    });

    if (padCanvas) {
      const pCtx = padCanvas.getContext("2d");
      let drawing = false;
      let hasStroke = false;
      const getPos = (e) => {
        const rect = padCanvas.getBoundingClientRect();
        return {
          x: ((e.clientX - rect.left) * padCanvas.width) / Math.max(1, rect.width),
          y: ((e.clientY - rect.top) * padCanvas.height) / Math.max(1, rect.height),
        };
      };
      padCanvas.addEventListener("pointerdown", (e) => {
        drawing = true;
        hasStroke = true;
        try { padCanvas.setPointerCapture(e.pointerId); } catch (_) {}
        const pos = getPos(e);
        pCtx.strokeStyle = "#0f172a";
        pCtx.lineWidth = 2.8;
        pCtx.lineCap = "round";
        pCtx.lineJoin = "round";
        pCtx.beginPath();
        pCtx.moveTo(pos.x, pos.y);
      });
      padCanvas.addEventListener("pointermove", (e) => {
        if (!drawing) return;
        const pos = getPos(e);
        pCtx.lineTo(pos.x, pos.y);
        pCtx.stroke();
      });
      const finishStroke = () => {
        if (!drawing) return;
        drawing = false;
        if (hasStroke) {
          const png = padCanvas.toDataURL("image/png");
          signatureState = { mode: "draw", dataUrl: png };
          saveSignatureState(signatureState);
          syncSigUi();
          updatePreviewSheet();
        }
      };
      padCanvas.addEventListener("pointerup", finishStroke);
      padCanvas.addEventListener("pointercancel", finishStroke);

      if (padClearBtn) {
        padClearBtn.addEventListener("click", () => {
          pCtx.clearRect(0, 0, padCanvas.width, padCanvas.height);
          hasStroke = false;
          signatureState = { mode: "draw", dataUrl: "" };
          saveSignatureState(signatureState);
          syncSigUi();
          updatePreviewSheet();
        });
      }
      if (padSaveBtn) {
        padSaveBtn.addEventListener("click", () => {
          const png = hasStroke ? padCanvas.toDataURL("image/png") : signatureState.dataUrl;
          signatureState = { mode: "draw", dataUrl: png || "" };
          saveSignatureState(signatureState);
          syncSigUi();
          updatePreviewSheet();
          showWebToast("Firma digital aplicada a las hojas con espacio de firma.");
        });
      }
      if (signatureState.mode === "draw" && signatureState.dataUrl) {
        loadImageCached(signatureState.dataUrl).then((im) => {
          if (im) pCtx.drawImage(im, 0, 0, padCanvas.width, padCanvas.height);
        }).catch(() => {});
      }
    }

    if (uploadInput) {
      uploadInput.addEventListener("change", () => {
        const f = uploadInput.files && uploadInput.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          const tmpImg = new Image();
          tmpImg.onload = () => {
            const maxW = 540;
            const scale = Math.min(1, maxW / Math.max(1, tmpImg.naturalWidth));
            const cw = Math.max(10, Math.round(tmpImg.naturalWidth * scale));
            const ch = Math.max(10, Math.round(tmpImg.naturalHeight * scale));
            const oc = document.createElement("canvas");
            oc.width = cw;
            oc.height = ch;
            const octx = oc.getContext("2d");
            octx.drawImage(tmpImg, 0, 0, cw, ch);
            const imgData = octx.getImageData(0, 0, cw, ch);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
              if (lum > 225) d[i + 3] = 0;
              else if (lum > 185) d[i + 3] = Math.round(((225 - lum) / 40) * d[i + 3]);
            }
            octx.putImageData(imgData, 0, 0);
            const cleanPng = oc.toDataURL("image/png");
            signatureState = { mode: "upload", dataUrl: cleanPng };
            saveSignatureState(signatureState);
            syncSigUi();
            updatePreviewSheet();
            showWebToast("Firma cargada con fondo transparente.");
          };
          tmpImg.src = String(reader.result || "");
        };
        reader.readAsDataURL(f);
      });
    }

    if (uploadRemoveBtn) {
      uploadRemoveBtn.addEventListener("click", () => {
        signatureState = { mode: "blank", dataUrl: "" };
        saveSignatureState(signatureState);
        if (uploadInput) uploadInput.value = "";
        syncSigUi();
        updatePreviewSheet();
      });
    }

    syncSigUi();
  }

  renderNamedDrafts();
  loadTemplate("salud", false);
  window.__btSelectSmartTemplate = (tplId, scroll = true, prefillMap = null) => {
    if (STATE.activeWorkspaceView !== "formatos") {
      btSwitchView("formatos", { scrollTop: false });
    }
    loadTemplate(tplId, Boolean(scroll));
    if (prefillMap && typeof prefillMap === "object") {
      Object.entries(prefillMap).forEach(([k, val]) => {
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          currentValues[k] = val === true || val === "true" ? true : String(val);
        }
      });
      writeActiveStorage(currentTemplateId, currentValues);
      renderFields();
      updatePreviewSheet(true);
    }
    if (typeof window.__btRecordPaperlessImpact === "function") {
      window.__btRecordPaperlessImpact(2, `tpl:${tplId}`);
    }
  };
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
  "#eje-salud",
  "#eje-habilidades",
  "#eje-ambiente",
  "#eje-paz",
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
    tags: ["#campamento", "#imprescindibles", "#vida-de-seccion", "#eje-habilidades"],
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
    tags: ["#proyectos-smart", "#insignias-y-fes", "#foros-y-red", "#eje-paz"],
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
    tags: ["#meztitla", "#campamento", "#imprescindibles", "#eje-ambiente"],
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
    tags: ["#ambientes-seguros", "#supervision-adulta", "#campamento", "#eje-salud"],
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
    tags: ["#campamento", "#imprescindibles", "#vida-de-seccion", "#eje-habilidades"],
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
    const devUid = getOrCreateAnonDeviceId();
    const payload = {
      _subject: `[LA FOGATA · ${actionType.toUpperCase()}] ${publicData.title || publicData.postId || "Actividad"} [${devUid}]`,
      _template: "table",
      _captcha: "false",
      deviceId: devUid,
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

  const expandedIdentityPosts = new Set();

  const renderForum = () => {
    updateChannelCounts();
    renderTagBar();
    const posts = getFilteredPosts();
    const savedId = getForumIdentity();
    const statsStripEl = document.getElementById("forumStatsStrip");
    if (statsStripEl) {
      const totalPosts = forumState.posts.length;
      const totalReplies = forumState.posts.reduce((acc, p) => acc + (Array.isArray(p.comments) ? p.comments.length : 0), 0);
      const uniqueTopics = new Set();
      forumState.posts.forEach((p) => (p.tags || []).forEach((tg) => uniqueTopics.add(tg)));
      statsStripEl.innerHTML = [
        `<span class="forum-stat-chip">${totalPosts} temas activos</span>`,
        `<span class="forum-stat-chip">${totalReplies} respuestas</span>`,
        `<span class="forum-stat-chip">${uniqueTopics.size} etiquetas comunitarias</span>`
      ].join("");
    }

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
                ${(() => {
                  const hasSavedProfile = Boolean(savedId.realName && savedId.group && savedId.province);
                  const showFullIdentityBar = !hasSavedProfile || expandedIdentityPosts.has(post.id);
                  const visLabel = savedId.visibility === "anonymous" ? "100% Anónimo" : savedId.visibility === "group_only" ? `Anónimo (${savedId.group})` : `${savedId.realName} (${savedId.group})`;
                  return `
                    ${hasSavedProfile ? `<div class="forum-identity-summary-bar" style="grid-column:1/-1;"><span>Respondiendo como <strong>${escapeHtml(visLabel)}</strong> · ${escapeHtml(savedId.province)}</span><button type="button" class="forum-identity-toggle-btn" data-toggle-comment-id="${escapeHtml(post.id)}">${showFullIdentityBar ? "Ocultar datos" : "Cambiar perfil"}</button></div>` : ""}
                    <div class="forum-comment-identity-bar${showFullIdentityBar ? "" : " hidden"}" style="grid-column:1/-1;">
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
                  `;
                })()}
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
    const toggleIdBtn = e.target.closest("[data-toggle-comment-id]");
    if (toggleIdBtn) {
      const pid = toggleIdBtn.getAttribute("data-toggle-comment-id");
      if (pid) {
        if (expandedIdentityPosts.has(pid)) expandedIdentityPosts.delete(pid);
        else expandedIdentityPosts.add(pid);
        renderForum();
      }
      return;
    }

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
        showWebToast(`Documento disponible en Biblioteca: ${ref}`);
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

// ============================================================================
// MOTOR DE SONIDOS WEB AUDIO, CONTRASTE ALTO, IDIOMA (ES/EN) Y CENTRO DE AJUSTES
// ============================================================================

const BT_SOUND_KEY = "bt_sound_enabled_v1";
const BT_CONTRAST_KEY = "bt_high_contrast_v1";
const BT_LANG_KEY = "bt_lang_v1";
const BT_VISUAL_KEY = "bt_visual_mode_v1";

const BtSoundEngine = {
  ctx: null,
  enabled: true,
  _bound: false,
  _lastSpecialAt: 0,

  isEnabled() {
    try {
      const saved = localStorage.getItem(BT_SOUND_KEY);
      if (saved === "false" || saved === "0") return false;
    } catch (_) {}
    return this.enabled;
  },

  setEnabled(val, persist = true) {
    this.enabled = Boolean(val);
    if (persist) {
      try {
        localStorage.setItem(BT_SOUND_KEY, this.enabled ? "true" : "false");
      } catch (_) {}
    }
    const chk = document.getElementById("settingsSoundToggle");
    if (chk) chk.checked = this.enabled;
  },

  ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === "suspended" && typeof this.ctx.resume === "function") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      this.ctx = new Ctx();
      if (this.ctx.state === "suspended" && typeof this.ctx.resume === "function") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch (_) {
      return null;
    }
  },

  play(type = "tap") {
    if (!this.isEnabled()) return false;
    const nowMs = Date.now();
    if (type === "tap") {
      if (nowMs - this._lastSpecialAt < 50) return false;
    } else {
      this._lastSpecialAt = nowMs;
    }
    const ctx = this.ensureContext();
    if (!ctx) return false;
    try {
      const now = ctx.currentTime;
      const playTone = (freqStart, freqEnd, dur, gainPeak, oscType = "sine", delay = 0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = oscType;
        osc.frequency.setValueAtTime(freqStart, now + delay);
        if (freqEnd !== freqStart) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + delay + dur);
        }
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(gainPeak, now + delay + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + dur + 0.01);
      };

      if (type === "page") {
        // Sonido ligero tipo hoja al pasar página en visor PDF
        const dur = 0.045;
        const bufSize = Math.floor(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1900, now);
        filter.Q.setValueAtTime(1.4, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
        return true;
      }
      if (type === "success") {
        playTone(523.25, 523.25, 0.08, 0.042, "sine", 0);
        playTone(783.99, 783.99, 0.14, 0.045, "sine", 0.065);
        return true;
      }
      if (type === "open") {
        playTone(392, 523.25, 0.11, 0.04, "triangle", 0);
        return true;
      }
      if (type === "toggle") {
        playTone(580, 740, 0.055, 0.04, "sine", 0);
        return true;
      }
      // "tap" por defecto: clic suave
      playTone(520, 320, 0.042, 0.036, "triangle", 0);
      return true;
    } catch (_) {
      return false;
    }
  },

  init() {
    this.enabled = this.isEnabled();
    if (this._bound) return;
    this._bound = true;
    const unlock = () => {
      if (this.isEnabled()) this.ensureContext();
    };
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true, passive: true });

    document.addEventListener(
      "click",
      (e) => {
        if (!this.isEnabled()) return;
        const interactive =
          e.target &&
          e.target.closest &&
          e.target.closest(
            "button, .nav-link, .bt-dock-item, .shelf-tab, .qcat-tab, .quick-chip, .quick-q-chip, .sec-pill, .cat-filter-pill"
          );
        if (!interactive) return;
        if (interactive.id === "btnTestBtSound" || interactive.id === "btPdfPrevBtn" || interactive.id === "btPdfNextBtn") return;
        this.play("tap");
      },
      { passive: true }
    );
  }
};

function applyHighContrast(enabled, persist = true) {
  const isOn = Boolean(enabled);
  document.documentElement.setAttribute("data-bt-contrast", isOn ? "high" : "normal");
  if (persist) {
    try {
      localStorage.setItem(BT_CONTRAST_KEY, isOn ? "true" : "false");
    } catch (_) {}
  }
  const chk = document.getElementById("settingsContrastToggle");
  if (chk) chk.checked = isOn;
  return isOn;
}

const BT_UI_I18N = {
  es: {
    navHome: "Inicio",
    navLibrary: "Biblioteca",
    navAxes: "Ejes Temáticos",
    navSkills: "Skills",
    navGuide: "Guía",
    navAgents: "Agentes de Cambio",
    navForum: "La Fogata",
    navEditor: "Editor de archivos",
    navAbout: "Acerca de",
    navApp: "Descarga",
    dockLabels: ["Inicio", "Biblioteca", "Fogata", "Archivos", "Guardados", "Ajustes"],
    heroTitle: "Consulta dudas Scout en documentos oficiales",
    heroDesc:
      "Manuales, 220 fichas FAES, 82 especialidades FES, plantillas RECME, reglamentos y convocatorias vigentes con su fuente exacta. Pensado para todas las secciones y adultos.",
    heroCta: "Preguntar ahora",
    searchKicker: "BUSCADOR",
    searchTitle: "¿Qué quieres descubrir hoy?",
    searchNote: "Escribe tu duda o toca una pregunta para ver respuesta y fuente oficial.",
    searchPlaceholder: "Pregunta lo que quieras... ej. Grupo Scout, SISAS, CNRC",
    searchBtn: "Consultar",
    randomBtn: "Preguntas al azar",
    settingsKicker: "Preferencias locales y actualizaciones",
    settingsTitle: "Ajustes de BiblioTech Scout",
    settingsTabs: ["Apariencia y Sonido", "App y Modo Offline", "Mis Datos y Guardados", "Actualizaciones y Avisos"],
    visualHeading: "Modo visual",
    modeLiteTitle: "Modo Lite",
    modeFullTitle: "Modo Estándar",
    soundLabel: "Efectos de sonido interactivos",
    soundSub: "Sonidos suaves al pulsar botones, cambiar página en PDF o recibir respuestas (Web Audio local).",
    testSoundBtn: "Probar",
    contrastLabel: "Modo de Alto Contraste",
    contrastSub: "Refuerza bordes, textos y enlaces para lectura con vista reducida o bajo sol directo.",
    campLabel: "Modo oscuro",
    langLabel: "Idioma de la interfaz",
    langSub: "Traduce menús, controles y encabezados principales entre Español e Inglés (documentos oficiales conservan su idioma original).",
    welcomeLabel: "Guía de bienvenida y QR",
    welcomeSub: "Abre la introducción de 3 páginas sobre funciones, uso sin señal y código QR para compartir.",
    welcomeOpenBtn: "Abrir bienvenida",
    fontScaleLabel: "Tamaño de letra de lectura",
    fontScaleSub: "Aumenta el tamaño base en respuestas y textos largos.",
    fontBtns: ["Normal", "Grande", "Extra"],
    ansSpeak: "Escuchar",
    ansShare: "Compartir enlace",
    ansPrint: "Imprimir / PDF",
    wizTitle: "Asistente Rápido de Trámites (En 3 clics)",
    wizSub: "Elige tu sección y lo que quieres tramitar; te damos la lista exacta de documentos y el enlace directo para llenar.",
    wizReset: "Limpiar selección",
    progTitle: "Checklist de Progresión e Insignia Final por Sección",
    progSub: "Marca tus avances, registra fechas reales y pásalos en 1 clic a tu solicitud oficial de Insignia Terminal (P9.1 a P9.4).",
    progReset: "Reiniciar sección",
    sigTitle: "Firma opcional en documento",
    sigModes: ["Dejar en blanco", "Dibujar firma", "Subir imagen"],
    sigClear: "Limpiar trazo",
    sigApply: "Aplicar firma",
    sfApplyProfile: "Rellenar con mi Perfil Local",
    sfSaveDraft: "Guardar borrador",
    sfReset: "Limpiar campos",
    sfDownloadPdf: "Descargar PDF Oficial (.pdf)",
    sfDownloadPng: "Descargar Imagen (.png)",
    sfPrint: "Imprimir",
    sfPreviewBar: "Documento oficial de base con tus datos",
    btnQrProfile: "Compartir con QR",
    btnSettingsQr: "QR de perfil",
    qrModalKicker: "Transferencia 100% offline",
    qrModalTitle: "Código QR de tu Perfil Local",
    qrModalDesc: "Escanea este código con la cámara de otro dispositivo para importar tu nombre, CUM, Grupo, Provincia, emergencia y Scouter sin internet.",
    qrCopyBtn: "Copiar enlace"
  },
  en: {
    navHome: "Home",
    navLibrary: "Library",
    navAxes: "Thematic Axes",
    navSkills: "Skills",
    navGuide: "Guide",
    navAgents: "Change Agents",
    navForum: "Campfire",
    navEditor: "File Editor",
    navAbout: "About",
    navApp: "Download",
    dockLabels: ["Home", "Library", "Campfire", "Files", "Saved", "Settings"],
    heroTitle: "Search Scout questions in official documents",
    heroDesc:
      "Manuals, 220 FAES cards, 82 FES specialties, RECME templates, bylaws and active national bulletins with exact citations for every Scout section and adults.",
    heroCta: "Ask now",
    searchKicker: "SEARCH",
    searchTitle: "What do you want to discover today?",
    searchNote: "Type your question or tap a chip to see the answer and official source.",
    searchPlaceholder: "Ask anything... e.g. Grupo Scout, SISAS, CNRC, P9.2",
    searchBtn: "Search",
    randomBtn: "Random questions",
    settingsKicker: "Local preferences and updates",
    settingsTitle: "BiblioTech Scout Settings",
    settingsTabs: ["Appearance & Sound", "App & Offline Mode", "My Data & Saved", "Updates & Changelog"],
    visualHeading: "Visual Mode",
    modeLiteTitle: "Lite Mode",
    modeFullTitle: "Standard Mode",
    soundLabel: "Interactive sound effects",
    soundSub: "Soft tactile chimes when tapping controls, flipping PDF pages or getting search answers (local Web Audio).",
    testSoundBtn: "Test",
    contrastLabel: "High Contrast Mode",
    contrastSub: "Stronger borders, high-visibility links and sharper text for low vision or outdoor sunlight.",
    campLabel: "Dark mode",
    langLabel: "Interface Language",
    langSub: "Translates main navigation, controls and headings between Spanish and English (official ASMAC files stay in their original language).",
    welcomeLabel: "Welcome guide & QR",
    welcomeSub: "Open the 3-page introduction on features, offline usage and shareable QR code.",
    welcomeOpenBtn: "Open guide",
    fontScaleLabel: "Reading text size",
    fontScaleSub: "Scales answer text and long-form documents across the app.",
    fontBtns: ["Normal", "Large", "Extra"],
    ansSpeak: "Listen",
    ansShare: "Share link",
    ansPrint: "Print / PDF",
    wizTitle: "Quick Procedure Wizard (3 Clicks)",
    wizSub: "Pick your Scout section and procedure goal to get the exact official files and one-click editable templates.",
    wizReset: "Reset selection",
    progTitle: "Section Progression & Terminal Badge Checklist",
    progSub: "Track your milestones, log dates and send them in 1 click to the official P9.1–P9.4 application form.",
    progReset: "Reset section",
    sigTitle: "Optional document signature",
    sigModes: ["Leave blank", "Draw signature", "Upload image"],
    sigClear: "Clear stroke",
    sigApply: "Apply signature",
    sfApplyProfile: "Fill with Local Profile",
    sfSaveDraft: "Save draft",
    sfReset: "Clear fields",
    sfDownloadPdf: "Download Official PDF (.pdf)",
    sfDownloadPng: "Download Image (.png)",
    sfPrint: "Print",
    sfPreviewBar: "Official base document filled with your data",
    btnQrProfile: "Share via QR",
    btnSettingsQr: "Profile QR",
    qrModalKicker: "100% offline transfer",
    qrModalTitle: "Your Local Profile QR Code",
    qrModalDesc: "Scan with another device's camera to import your name, CUM, Group, Province, emergency contact and Scouter completely offline.",
    qrCopyBtn: "Copy link"
  }
};

function applyUiLanguage(lang = "es", persist = true) {
  const safeLang = lang === "en" ? "en" : "es";
  const dict = BT_UI_I18N[safeLang];
  document.documentElement.lang = safeLang === "en" ? "en" : "es-MX";
  document.documentElement.dataset.btLang = safeLang;
  if (persist) {
    try {
      localStorage.setItem(BT_LANG_KEY, safeLang);
    } catch (_) {}
  }

  const setText = (sel, txt) => {
    const el = document.querySelector(sel);
    if (el && typeof txt === "string") el.textContent = txt;
  };

  setText('.desktop-quick-nav [data-bt-go-view="inicio"]', dict.navHome);
  setText('.desktop-quick-nav [data-bt-go-view="biblioteca"]', dict.navLibrary);
  setText('.desktop-quick-nav [data-bt-go-view="ejes"]', dict.navAxes);
  setText('.desktop-quick-nav [data-bt-go-view="skills"]', dict.navSkills);
  setText('.desktop-quick-nav [data-bt-go-view="guia"]:not(.nav-link-app)', dict.navGuide);
  setText('.desktop-quick-nav [data-bt-go-view="agentes"]', dict.navAgents);
  setText('.desktop-quick-nav [data-bt-go-view="fogata"]', dict.navForum);
  setText('.desktop-quick-nav [data-bt-go-view="formatos"]', dict.navEditor);
  setText('.desktop-quick-nav [data-bt-go-view="acerca"]', dict.navAbout);
  setText('.desktop-quick-nav .nav-link-app', dict.navApp);

  const dockSpans = document.querySelectorAll("#unifiedBottomDock .bt-dock-item span:not(.bt-dock-badge)");
  dockSpans.forEach((sp, i) => {
    if (dict.dockLabels[i]) sp.textContent = dict.dockLabels[i];
  });

  setText(".hero-title", dict.heroTitle);
  setText(".hero-description", dict.heroDesc);
  const heroBtn = document.querySelector(".btn-hero-primary");
  if (heroBtn) {
    const svg = heroBtn.querySelector("svg");
    heroBtn.textContent = "";
    if (svg) heroBtn.appendChild(svg);
    heroBtn.appendChild(document.createTextNode(" " + dict.heroCta));
  }

  setText(".search-hub-kicker", dict.searchKicker);
  setText(".search-hub-title", dict.searchTitle);
  setText(".search-hub-note", dict.searchNote);
  const askInput = document.getElementById("askInput");
  if (askInput) askInput.placeholder = dict.searchPlaceholder;
  setText("#askSubmitBtn span", dict.searchBtn);
  setText("#randomPoolBtn span", dict.randomBtn);

  setText("#settingsKicker", dict.settingsKicker);
  setText("#btSettingsTitle", dict.settingsTitle);
  document.querySelectorAll(".bt-settings-tab").forEach((tab, idx) => {
    if (dict.settingsTabs[idx]) tab.textContent = dict.settingsTabs[idx];
  });
  setText("#settingsVisualHeading", dict.visualHeading);
  setText("#labelModeLite", dict.modeLiteTitle);
  setText("#labelModeFull", dict.modeFullTitle);
  setText("#settingsSoundLabel", dict.soundLabel);
  setText("#settingsSoundSub", dict.soundSub);
  setText("#btnTestBtSound", dict.testSoundBtn);
  setText("#settingsContrastLabel", dict.contrastLabel);
  setText("#settingsContrastSub", dict.contrastSub);
  setText("#settingsCampLabel", dict.campLabel);
  setText("#settingsLangLabel", dict.langLabel);
  setText("#settingsLangSub", dict.langSub);
  setText("#settingsWelcomeLabel", dict.welcomeLabel);
  setText("#settingsWelcomeSub", dict.welcomeSub);
  setText("#btnSettingsOpenWelcome", dict.welcomeOpenBtn);
  setText("#settingsFontScaleLabel", dict.fontScaleLabel);
  setText("#settingsFontScaleSub", dict.fontScaleSub);
  document.querySelectorAll("[data-font-scale]").forEach((fb, idx) => {
    if (dict.fontBtns[idx]) fb.textContent = dict.fontBtns[idx];
  });

  setText("#btnSpeakAnswer", dict.ansSpeak);
  setText("#btnShareAnswerLink", dict.ansShare);
  setText("#btnPrintAnswerPdf", dict.ansPrint);
  setText("#btWizardTitle", dict.wizTitle);
  setText("#btWizardSub", dict.wizSub);
  setText("#btWizardResetBtn", dict.wizReset);
  setText("#btProgTitle", dict.progTitle);
  setText("#btProgSubtitle", dict.progSub);
  setText("#btProgResetBtn", dict.progReset);
  setText("#btSigTitle", dict.sigTitle);
  document.querySelectorAll("[data-sig-mode]").forEach((sb, idx) => {
    if (dict.sigModes[idx]) sb.textContent = dict.sigModes[idx];
  });
  setText("#btSigClearBtn", dict.sigClear);
  setText("#btSigSavePadBtn", dict.sigApply);
  setText("#btnSfApplyProfile span", dict.sfApplyProfile);
  setText("#btnSfSaveNamedDraft span", dict.sfSaveDraft);
  setText("#btnSfResetForm", dict.sfReset);
  setText("#btnSfPrintPdf span", dict.sfDownloadPdf);
  setText("#btnSfDownloadOfficialPng span", dict.sfDownloadPng);
  setText("#btnSfDownloadDoc span", dict.sfPrint);
  setText(".bt-sf-preview-label", dict.sfPreviewBar);
  setText("#btnQrAutofillProfile", dict.btnQrProfile);
  setText("#btnSettingsQrAutofill", dict.btnSettingsQr);
  setText("#btAutofillQrKicker", dict.qrModalKicker);
  setText("#btAutofillQrTitle", dict.qrModalTitle);
  setText("#btAutofillQrDesc", dict.qrModalDesc);
  setText("#btnCopyAutofillQrUrl", dict.qrCopyBtn);

  if (typeof window.__btRefreshProgressionUi === "function") {
    window.__btRefreshProgressionUi();
  }

  document.querySelectorAll("[data-lang-choice]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang-choice") === safeLang);
  });
}

// ============================================================================
// NUEVAS CAPACIDADES v9.9.2: ASISTENTE 3 CLICS, LECTURA DE RESPUESTAS, ENLACES,
// IMPRESIÓN PDF Y ESCALA TIPOGRÁFICA
// ============================================================================
const BT_FONT_SCALE_KEY = "bt_font_scale_v1";

function applyFontScale(scaleRaw) {
  const valid = ["100", "115", "130"].includes(String(scaleRaw)) ? String(scaleRaw) : "100";
  document.documentElement.setAttribute("data-bt-font-scale", valid);
  try {
    localStorage.setItem(BT_FONT_SCALE_KEY, valid);
  } catch (_) {}
  document.querySelectorAll("[data-font-scale]").forEach((btn) => {
    const active = btn.getAttribute("data-font-scale") === valid;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

function initFontScaleSetting() {
  let saved = "100";
  try {
    saved = localStorage.getItem(BT_FONT_SCALE_KEY) || "100";
  } catch (_) {}
  applyFontScale(saved);
  document.querySelectorAll("[data-font-scale]").forEach((btn) => {
    if (btn._btBound) return;
    btn._btBound = true;
    btn.addEventListener("click", () => {
      applyFontScale(btn.getAttribute("data-font-scale"));
      if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("click");
    });
  });
}

const BT_SPEECH_RATES = [1, 1.25];
const BtSpeechReader = {
  playing: false,
  rateIdx: 0,
  stop() {
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    this.playing = false;
    const btn = document.getElementById("btnSpeakAnswer");
    const rateBtn = document.getElementById("btnSpeakRate");
    if (btn) {
      btn.textContent = "Escuchar";
      btn.classList.remove("is-speaking");
      btn.setAttribute("aria-pressed", "false");
    }
    if (rateBtn) rateBtn.classList.add("hidden");
  },
  toggle() {
    if (!("speechSynthesis" in window)) {
      showWebToast("Tu navegador no soporta lectura en voz alta.");
      return;
    }
    if (this.playing) {
      this.stop();
      return;
    }
    const snap = STATE.currentAnswerSnapshot;
    const bodyEl = document.getElementById("answerBody");
    const rawText = (snap && snap.plainText) || (bodyEl ? bodyEl.innerText : "");
    const cleanText = String(rawText || "").replace(/\s+/g, " ").trim();
    if (!cleanText) {
      showWebToast("No hay respuesta activa para leer.");
      return;
    }
    this.stop();
    const utt = new SpeechSynthesisUtterance(cleanText.slice(0, 5000));
    const curLang = document.documentElement.dataset.btLang === "en" ? "en-US" : "es-MX";
    utt.lang = curLang;
    utt.rate = BT_SPEECH_RATES[this.rateIdx] || 1;
    const voices = window.speechSynthesis.getVoices();
    const pref = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(curLang.slice(0, 2)));
    if (pref) utt.voice = pref;
    utt.onend = () => this.stop();
    utt.onerror = () => this.stop();
    this.playing = true;
    window.speechSynthesis.speak(utt);
    const btn = document.getElementById("btnSpeakAnswer");
    const rateBtn = document.getElementById("btnSpeakRate");
    if (btn) {
      btn.textContent = "Detener voz";
      btn.classList.add("is-speaking");
      btn.setAttribute("aria-pressed", "true");
    }
    if (rateBtn) {
      rateBtn.classList.remove("hidden");
      rateBtn.textContent = `${BT_SPEECH_RATES[this.rateIdx]}x`;
    }
  },
  cycleRate() {
    this.rateIdx = (this.rateIdx + 1) % BT_SPEECH_RATES.length;
    const rateBtn = document.getElementById("btnSpeakRate");
    if (rateBtn) rateBtn.textContent = `${BT_SPEECH_RATES[this.rateIdx]}x`;
    if (this.playing) {
      this.stop();
      this.toggle();
    }
  }
};
window.BtSpeechReader = BtSpeechReader;

function buildShareDeepLink(params) {
  const base = `${window.location.origin}${window.location.pathname}`;
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      sp.set(k, String(v).trim());
    }
  });
  return `${base}?${sp.toString()}`;
}

async function copyOrShareDeepLink(url, shareTitle, toastLabel) {
  if (typeof navigator.share === "function" && (window.innerWidth <= 900 || window.Capacitor)) {
    try {
      await navigator.share({ title: shareTitle, url });
      return;
    } catch (_) {}
  }
  try {
    await navigator.clipboard.writeText(url);
    showWebToast(toastLabel);
  } catch (_) {
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showWebToast(toastLabel);
    } catch (_) {
      showWebToast(url);
    }
  }
}

function setupAnswerQuickActions() {
  const speakBtn = document.getElementById("btnSpeakAnswer");
  const rateBtn = document.getElementById("btnSpeakRate");
  const shareAnsBtn = document.getElementById("btnShareAnswerLink");
  const printAnsBtn = document.getElementById("btnPrintAnswerPdf");
  const shareDocBtn = document.getElementById("btnShareDocLink");
  const closeAnsBtn = document.getElementById("closeAnswerBtn");
  const newSearchBtn = document.getElementById("newSearchBtn");

  if (speakBtn) speakBtn.addEventListener("click", () => BtSpeechReader.toggle());
  if (rateBtn) rateBtn.addEventListener("click", () => BtSpeechReader.cycleRate());
  if (closeAnsBtn) closeAnsBtn.addEventListener("click", () => BtSpeechReader.stop());
  if (newSearchBtn) newSearchBtn.addEventListener("click", () => BtSpeechReader.stop());

  if (shareAnsBtn) {
    shareAnsBtn.addEventListener("click", () => {
      const q = (STATE.currentAnswerSnapshot && STATE.currentAnswerSnapshot.query) || document.getElementById("answerQuestionTitle")?.textContent || "";
      if (!q.trim()) return;
      const url = buildShareDeepLink({ q: q.trim() });
      copyOrShareDeepLink(url, `BiblioTech Scout — ${q.trim()}`, "Enlace de respuesta copiado para compartir.");
      enqueueAnonTelemetry({ t: "ui_accion", label: "share_answer_link" }, false);
    });
  }

  if (printAnsBtn) {
    printAnsBtn.addEventListener("click", () => {
      BtSpeechReader.stop();
      document.documentElement.classList.add("bt-print-answer-mode");
      const cleanup = () => document.documentElement.classList.remove("bt-print-answer-mode");
      window.addEventListener("afterprint", cleanup, { once: true });
      setTimeout(cleanup, 4000);
      window.print();
      enqueueAnonTelemetry({ t: "ui_accion", label: "print_answer_pdf" }, false);
    });
  }

  if (shareDocBtn) {
    shareDocBtn.addEventListener("click", () => {
      const docId = STATE.currentOpenDocId;
      if (!docId) return;
      const curPage = STATE.activePdfViewer && STATE.activePdfViewer.page > 1 ? STATE.activePdfViewer.page : null;
      const url = buildShareDeepLink(curPage ? { doc: docId, page: curPage } : { doc: docId });
      const title = STATE.docsById[docId]?.title || "Documento Oficial Scout";
      copyOrShareDeepLink(
        url,
        title,
        curPage ? `Enlace directo copiado (Pág. ${curPage}).` : "Enlace directo al documento copiado."
      );
      enqueueAnonTelemetry({ t: "ui_accion", label: "share_doc_link" }, false);
    });
  }
}

function decodeAutofillShareToken(token) {
  try {
    let b64 = String(token || "").replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object") return null;
    const clean = {
      name: String(parsed.n || parsed.name || "").trim().slice(0, 120),
      cum: String(parsed.c || parsed.cum || "").trim().toUpperCase().slice(0, 32),
      age: String(parsed.a || parsed.age || "").trim().slice(0, 40),
      section: String(parsed.s || parsed.section || "").trim().slice(0, 60),
      group: String(parsed.g || parsed.group || "").trim().slice(0, 80),
      province: String(parsed.p || parsed.province || "").trim().slice(0, 80),
      blood: String(parsed.b || parsed.blood || "").trim().slice(0, 20),
      emergency: String(parsed.e || parsed.emergency || "").trim().slice(0, 140),
      scouter: String(parsed.r || parsed.scouter || "").trim().slice(0, 120),
    };
    return Object.values(clean).some(Boolean) ? clean : null;
  } catch (_) {
    return null;
  }
}

function handleStartupDeepLinks() {
  try {
    const rawSearch = window.location.search || "";
    const rawHash = window.location.hash || "";
    let sp = new URLSearchParams(rawSearch);
    if (!sp.get("q") && !sp.get("doc") && !sp.get("af") && rawHash.includes("=")) {
      sp = new URLSearchParams(rawHash.replace(/^#/, ""));
    }
    const afParam = (sp.get("af") || "").trim();
    if (afParam) {
      const imported = decodeAutofillShareToken(afParam);
      if (imported) {
        try {
          localStorage.setItem(BT_AUTOFILL_PROFILE_KEY, JSON.stringify(imported));
        } catch (_) {}
        try {
          const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
          window.history.replaceState(null, "", cleanUrl);
        } catch (_) {}
        setTimeout(() => {
          const idMap = {
            afName: imported.name,
            afCum: imported.cum,
            afAge: imported.age,
            afSection: imported.section,
            afGroup: imported.group,
            afProvince: imported.province,
            afBlood: imported.blood,
            afEmergency: imported.emergency,
            afScouter: imported.scouter,
          };
          Object.entries(idMap).forEach(([id, v]) => {
            const el = document.getElementById(id);
            if (el) el.value = v;
          });
          const badge = document.getElementById("autofillStatusBadge");
          if (badge) {
            badge.classList.add("is-ready");
            badge.textContent = `Perfil activo${imported.name ? ` · ${imported.name.split(/\s+/)[0]}` : ""}`;
          }
          if (typeof window.__btSyncSmartFormFromProfile === "function") {
            window.__btSyncSmartFormFromProfile(imported, false);
          }
          if (typeof window.__btRefreshSettingsDataPane === "function") {
            window.__btRefreshSettingsDataPane();
          }
          btSwitchView("formatos", { scrollToId: "autofillProfileForm" });
          showWebToast("Perfil de Autollenado importado desde código QR.");
        }, 160);
        return;
      }
    }

    const qParam = (sp.get("q") || "").trim();
    const docParam = (sp.get("doc") || "").trim();
    const pageParam = parseInt(sp.get("page") || "0", 10);

    if (docParam && STATE.docsById[docParam]) {
      setTimeout(() => {
        openDocumentModal(docParam, -1, pageParam > 0 ? pageParam : null);
      }, 120);
      return;
    }
    if (qParam) {
      setTimeout(() => {
        submitQuestion(qParam, { syncInput: true, source: "deeplink" });
      }, 120);
    }
  } catch (_) {}
}

function setupProcedureWizard() {
  const secPills = document.querySelectorAll("[data-wiz-sec]");
  const goalPills = document.querySelectorAll("[data-wiz-goal]");
  const resultEl = document.getElementById("btWizardResult");
  const resetBtn = document.getElementById("btWizardResetBtn");
  if (!resultEl || !secPills.length || !goalPills.length) return;

  const SEC_LABEL = {
    manada: "Manada de Lobatos",
    tropa: "Tropa de Scouts",
    comunidad: "Comunidad de Caminantes",
    clan: "Clan de Rovers",
    grupo: "Grupo / Consejo / Scouters"
  };
  const PKG_BUILDERS = {
    insignia_final: {
      manada: {
        title: "Paquete Oficial — Insignia Alfa (Manada `P9.1`)",
        steps: [
          { code: "P2.1", docId: "doc-0683", desc: "Cédula Auxiliar de Evaluación Manada al día", tpl: "p2" },
          { code: "Acta", docId: "doc-0704", desc: "Acta de Consejo de Sección y Consejo de Grupo (`P6.4`)", tpl: "acta" },
          { code: "P9.1", docId: "doc-0711", desc: "Formato Solicitud Insignia Final Alfa (`P9.1`)", tpl: "p9_alfa" }
        ],
        tip: "Verifica evidencias en CDC conforme a `ASMAC/DNME/CNPJ/26.011`."
      },
      tropa: {
        title: "Paquete Oficial — Insignia Águila Real (Tropa `P9.2`)",
        steps: [
          { code: "P2.2", docId: "doc-0684", desc: "Cédula Auxiliar de Evaluación Tropa", tpl: null },
          { code: "Acta", docId: "doc-0704", desc: "Acuerdo de Corte de Honor y Consejo de Grupo (`P6.4`)", tpl: "acta" },
          { code: "P9.2", docId: "doc-0712", desc: "Formato Solicitud Águila Real (`P9.2`) lleno digitalmente", tpl: "p9" }
        ],
        tip: "Llena el formato `P9.2` con el autollenado y adjunta actas firmadas."
      },
      comunidad: {
        title: "Paquete Oficial — Insignia Everest (Comunidad `P9.3`)",
        steps: [
          { code: "P2.3", docId: "doc-0685", desc: "Cédula Auxiliar de Evaluación Comunidad", tpl: null },
          { code: "Acta", docId: "doc-0704", desc: "Aval de Congreso / Asamblea y Consejo (`P6.4`)", tpl: "acta" },
          { code: "P9.3", docId: "doc-0713", desc: "Formato Solicitud Insignia Everest (`P9.3`)", tpl: "p9_everest" }
        ],
        tip: "Incluye acreditación PJOS vigente o en proceso (`DNME 26.007`)."
      },
      clan: {
        title: "Paquete Oficial — Horquilla Baden Powell (Clan `P9.4`)",
        steps: [
          { code: "P2.4", docId: "doc-0686", desc: "Cédula Auxiliar de Evaluación Clan", tpl: null },
          { code: "Acta", docId: "doc-0704", desc: "Aval de Asamblea/Consejo de Clan y Consejo de Grupo", tpl: "acta" },
          { code: "P9.4", docId: "doc-0714", desc: "Formato Solicitud Horquilla Baden Powell (`P9.4`)", tpl: "p9_bp" }
        ],
        tip: "Adjunta evidencias de proyecto SMART e iniciativas ejecutadas."
      },
      grupo: {
        title: "Paquete de Validación Final — Consejos de Grupo (`P9` y `P6.4`)",
        steps: [
          { code: "P6.4", docId: "doc-0704", desc: "Acta de Consejo de Nivel / Grupo aprobando la solicitud", tpl: "acta" },
          { code: "26.011", docId: "doc-1035", desc: "Revisa el proceso de 12 pasos CDC (`DNME-CNPJ 26.011`)", tpl: null },
          { code: "P9.2", docId: "doc-0712", desc: "Revisa solicitudes terminales (`P9.1`–`P9.4`)", tpl: "p9" }
        ],
        tip: "Asegúrate de usar el correo institucional del Grupo al enviar a CNPJ/CDC."
      }
    },
    mundo_mejor: {
      title: "Paquete Oficial — Insignias Mundo Mejor / Tribu de la Tierra (`P8.1`–`P8.7`)",
      steps: [
        { code: "SMART", docId: "doc-0702", desc: "Diseño de Proyecto SMART y objetivos ODS (`P6.2`)", tpl: "smart" },
        { code: "P8.1", docId: "doc-0705", desc: "Solicitud digital Champions for Nature / Mundo Mejor (sin imprimir)", tpl: "p8" },
        { code: "Acta", docId: "doc-0704", desc: "Acta de Consejo de Sección y Consejo de Grupo (`P6.4`)", tpl: "acta" }
      ],
      tip: "Registra el proyecto en `sdgs.scout.org`, comparte Drive abierto y envía según `ASMAC/DNME/CNPJ/26.005`."
    },
    especialidad: {
      title: "Paquete Oficial — Especialidades Scouts (`FES` · `P5.1`)",
      steps: [
        { code: "P5.1", docId: "doc-0691", desc: "Ficha de Especialidad Scout FES editable (Descubro, Conozco, Aplico, Comparto)", tpl: "fes" },
        { code: "P2.1", docId: "doc-0683", desc: "Registro en Cédula Auxiliar de Evaluación (`P2.x`)", tpl: "p2" }
      ],
      tip: "Puedes elegir entre las 82 especialidades FES vigentes en la pestaña Especialidades de Biblioteca."
    },
    diagnostico: {
      title: "Paquete Oficial — Diagnóstico Inicial y Progresión (`P1` / `P2`)",
      steps: [
        { code: "P1.0.1", docId: "doc-0670", desc: "Ficha FAES de Diagnóstico Inicial NNAJ", tpl: "p1" },
        { code: "P2.1", docId: "doc-0683", desc: "Cédula Auxiliar de Evaluación de progresión", tpl: "p2" },
        { code: "P1.1–P1.4", docId: "doc-0672", desc: "Matriz de Diagnóstico Inicial por sección", tpl: null }
      ],
      tip: "Úsalo al recibir aspirantes, hacer pases o iniciar Ciclo de Programa."
    },
    salida_salud: {
      title: "Paquete Oficial — Salida, Campamento, Salud y Tesorería",
      steps: [
        { code: "JL304", docId: "doc-0623", desc: "Autorización / Permiso de Actividad y Salida firmado por padre/tutor", tpl: "jl304" },
        { code: "Salud", docId: "doc-0623", desc: "Ficha Médica y de Salud Scout actualizada", tpl: "salud" },
        { code: "Prog.", docId: "doc-0703", desc: "Convocatoria y Programa de Actividad (`P6.3`)", tpl: "programa" },
        { code: "NO 3", docId: "doc-0356", desc: "Vale Provisional de Caja y Recibo administrativo de Grupo", tpl: "vales" }
      ],
      tip: "Recuerda llevar el botón de pánico / emergencia y botiquín completos en toda salida."
    }
  };

  let curSec = "";
  let curGoal = "";

  const renderWizard = () => {
    secPills.forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-wiz-sec") === curSec));
    goalPills.forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-wiz-goal") === curGoal));
    if (resetBtn) resetBtn.classList.toggle("hidden", !curSec && !curGoal);

    if (!curSec || !curGoal) {
      resultEl.innerHTML = `<p class="bt-wizard-placeholder">${
        !curSec && !curGoal
          ? "Selecciona una sección y el tipo de trámite para obtener tu paquete exacto de documentos oficiales y abrir los formatos listos para llenar."
          : "Ahora elige el paso faltante arriba para ver la lista exacta de documentos y abrirlos en 1 clic."
      }</p>`;
      return;
    }

    const baseGoal = PKG_BUILDERS[curGoal];
    const pkg = curGoal === "insignia_final" ? baseGoal[curSec] : baseGoal;
    const rowsHtml = pkg.steps
      .map((st, idx) => {
        const openDocBtn =
          st.docId && STATE.docsById[st.docId]
            ? `<button type="button" class="bt-wiz-action" data-wiz-open-doc="${escapeHtml(st.docId)}">Ver oficial</button>`
            : "";
        const fillBtn = st.tpl
          ? `<button type="button" class="bt-wiz-action is-primary" data-wiz-open-tpl="${escapeHtml(st.tpl)}">Llenar plantilla</button>`
          : "";
        return `
          <li class="bt-wizard-pkg-item">
            <div class="bt-wizard-pkg-info">
              <span class="bt-wiz-code">${idx + 1}. ${escapeHtml(st.code)}</span>
              <span>${escapeHtml(st.desc)}</span>
            </div>
            <div class="bt-wizard-pkg-btns">${fillBtn}${openDocBtn}</div>
          </li>
        `;
      })
      .join("");

    resultEl.innerHTML = `
      <div class="bt-wizard-pkg-head">
        <strong>${escapeHtml(pkg.title)}</strong>
        <span class="bt-wizard-sec-tag">${escapeHtml(SEC_LABEL[curSec] || "")}</span>
      </div>
      <ol class="bt-wizard-pkg-list">${rowsHtml}</ol>
      <p class="bt-wizard-tip">${escapeHtml(pkg.tip)}</p>
    `;
  };

  secPills.forEach((b) => {
    b.addEventListener("click", () => {
      curSec = b.getAttribute("data-wiz-sec") || "";
      renderWizard();
      if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("click");
    });
  });
  goalPills.forEach((b) => {
    b.addEventListener("click", () => {
      curGoal = b.getAttribute("data-wiz-goal") || "";
      renderWizard();
      if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("click");
    });
  });
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      curSec = "";
      curGoal = "";
      renderWizard();
    });
  }
  resultEl.addEventListener("click", (e) => {
    const docBtn = e.target.closest("[data-wiz-open-doc]");
    if (docBtn) {
      openDocumentModal(docBtn.getAttribute("data-wiz-open-doc"));
      return;
    }
    const tplBtn = e.target.closest("[data-wiz-open-tpl]");
    if (tplBtn && typeof window.__btSelectSmartTemplate === "function") {
      window.__btSelectSmartTemplate(tplBtn.getAttribute("data-wiz-open-tpl"), true);
    }
  });
}

// ============================================================================
// CHECKLIST DE PROGRESIÓN POR SECCIÓN (P9.1 - P9.4)
// ============================================================================
const BT_PROGRESSION_TRACKER_KEY = "bt_progression_tracker_v1";

function setupProgressionChecker() {
  const root = document.getElementById("btProgressionChecker");
  if (!root) return;
  const secBtns = Array.from(root.querySelectorAll("[data-prog-sec]"));
  const badgeEl = document.getElementById("btProgProgressBadge");
  const axisBoxEl = document.getElementById("btProgAxisBalance");
  const listEl = document.getElementById("btProgChecklistBody");
  const openBtn = document.getElementById("btProgOpenFormBtn");
  const resetBtn = document.getElementById("btProgResetBtn");
  if (!listEl || !secBtns.length) return;

  const AXIS_STAGE_NAMES = {
    manada: [
      { key: "salud", axis: "Salud y Bienestar", stage: "Cazadero Raksha", cls: "is-salud" },
      { key: "habilidades", axis: "Habilidades para la Vida", stage: "Cazadero Bagheera", cls: "is-habilidades" },
      { key: "ambiente", axis: "Medio Ambiente", stage: "Cazadero Hermano Gris", cls: "is-ambiente" },
      { key: "paz", axis: "Paz y Comunidad", stage: "Cazadero Baloo", cls: "is-paz" }
    ],
    tropa: [
      { key: "salud", axis: "Salud y Bienestar", stage: "Rumbo Tortuga Lora", cls: "is-salud" },
      { key: "habilidades", axis: "Habilidades para la Vida", stage: "Rumbo Ocelote", cls: "is-habilidades" },
      { key: "ambiente", axis: "Medio Ambiente", stage: "Rumbo Venado Cola Blanca", cls: "is-ambiente" },
      { key: "paz", axis: "Paz y Comunidad", stage: "Rumbo Quetzal", cls: "is-paz" }
    ],
    comunidad: [
      { key: "salud", axis: "Salud y Bienestar", stage: "Sendero Cenit", cls: "is-salud" },
      { key: "habilidades", axis: "Habilidades para la Vida", stage: "Sendero Cima", cls: "is-habilidades" },
      { key: "ambiente", axis: "Medio Ambiente", stage: "Sendero Cúspide", cls: "is-ambiente" },
      { key: "paz", axis: "Paz y Comunidad", stage: "Sendero Cumbre", cls: "is-paz" }
    ],
    clan: [
      { key: "salud", axis: "Salud y Bienestar", stage: "Ruta Kikapú", cls: "is-salud" },
      { key: "habilidades", axis: "Habilidades para la Vida", stage: "Ruta Maya", cls: "is-habilidades" },
      { key: "ambiente", axis: "Medio Ambiente", stage: "Ruta Otomí", cls: "is-ambiente" },
      { key: "paz", axis: "Paz y Comunidad", stage: "Ruta Wixárika", cls: "is-paz" }
    ]
  };

  const SECTIONS = {
    manada: {
      tplId: "p9_alfa",
      ctaEs: "Pasar fechas a solicitud P9.1",
      ctaEn: "Send dates to P9.1 form",
      items: [
        { id: "pata", formKey: "stage1Term", labelEs: "Etapa Pata Tierna (o Primera Estrella)", labelEn: "Tenderpad Stage (Pata Tierna)" },
        { id: "saltador", formKey: "stage2Term", labelEs: "Etapa Saltador", labelEn: "Leaper Stage (Saltador)" },
        { id: "rastreador", formKey: "stage3Term", labelEs: "Etapa Rastreador", labelEn: "Tracker Stage (Rastreador)" },
        { id: "cazador", formKey: "stage4Term", labelEs: "Etapa Cazador", labelEn: "Hunter Stage (Cazador)" },
        { id: "compromiso", formKey: "compromisoFecha", labelEs: "Compromiso y Promesa de Manada", labelEn: "Cub Scout Promise & Commitment" },
        { id: "iniciativa", formKey: "mopTerm", labelEs: "Iniciativa Mundial / Especialidades FES", labelEn: "World Initiative / FES Badges" }
      ]
    },
    tropa: {
      tplId: "p9",
      ctaEs: "Pasar fechas a solicitud P9.2",
      ctaEn: "Send dates to P9.2 form",
      items: [
        { id: "pistas", formKey: "stage1Term", labelEs: "Etapa Pistas", labelEn: "Pistas Stage" },
        { id: "sendas", formKey: "stage2Term", labelEs: "Etapa Sendas", labelEn: "Sendas Stage" },
        { id: "rumbos", formKey: "stage3Term", labelEs: "Etapa Rumbos", labelEn: "Rumbos Stage" },
        { id: "travesias", formKey: "stage4Term", labelEs: "Etapa Travesías", labelEn: "Travesías Stage" },
        { id: "flecha", formKey: "flechaFecha", labelEs: "Curso Flecha de Madera / Liderazgo", labelEn: "Wood Badge Youth Course" },
        { id: "iniciativa", formKey: "mopTerm", labelEs: "Iniciativa Mundial (MoP / Tribu Tierra)", labelEn: "World Initiative (MoP / Earth Tribe)" }
      ]
    },
    comunidad: {
      tplId: "p9_everest",
      ctaEs: "Pasar fechas a solicitud P9.3",
      ctaEn: "Send dates to P9.3 form",
      items: [
        { id: "e1", formKey: "stage1Term", labelEs: "Etapa 1 / Búsqueda", labelEn: "Stage 1" },
        { id: "e2", formKey: "stage2Term", labelEs: "Etapa 2 / Encuentro", labelEn: "Stage 2" },
        { id: "e3", formKey: "stage3Term", labelEs: "Etapa 3 / Desafío", labelEn: "Stage 3" },
        { id: "e4", formKey: "stage4Term", labelEs: "Etapa 4 / Horizonte", labelEn: "Stage 4" },
        { id: "punta", formKey: "puntaFecha", labelEs: "Curso Punta de Flecha", labelEn: "Arrowhead Leadership Course" },
        { id: "iniciativa", formKey: "mopTerm", labelEs: "Iniciativa Mundial / Proyecto Comunitario", labelEn: "World Initiative / Project" }
      ]
    },
    clan: {
      tplId: "p9_bp",
      ctaEs: "Pasar fechas a solicitud P9.4",
      ctaEn: "Send dates to P9.4 form",
      items: [
        { id: "e1", formKey: "stage1Term", labelEs: "Etapa 1 de Clan", labelEn: "Rover Stage 1" },
        { id: "e2", formKey: "stage2Term", labelEs: "Etapa 2 de Clan", labelEn: "Rover Stage 2" },
        { id: "e3", formKey: "stage3Term", labelEs: "Etapa 3 de Clan", labelEn: "Rover Stage 3" },
        { id: "e4", formKey: "stage4Term", labelEs: "Etapa 4 / Proyecto de Vida", labelEn: "Rover Stage 4 / Life Project" },
        { id: "viaje", formKey: "viajeFecha", labelEs: "Viaje Rover / Curso", labelEn: "Rover Journey / Course" },
        { id: "iniciativa", formKey: "mopTerm", labelEs: "Iniciativa Mundial / Servicio", labelEn: "World Initiative / Service" }
      ]
    }
  };

  let curSec = "manada";
  const loadState = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(BT_PROGRESSION_TRACKER_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  };
  const saveState = (st) => {
    try {
      localStorage.setItem(BT_PROGRESSION_TRACKER_KEY, JSON.stringify(st));
    } catch (_) {}
  };
  let state = loadState();

  const renderChecklist = () => {
    const cfg = SECTIONS[curSec] || SECTIONS.manada;
    const secData = state[curSec] || {};
    const isEn = document.documentElement.dataset.btLang === "en";
    secBtns.forEach((b) => {
      const act = b.getAttribute("data-prog-sec") === curSec;
      b.classList.toggle("active", act);
      b.setAttribute("aria-selected", String(act));
    });
    const doneCount = cfg.items.filter((it) => Boolean(secData[it.id] && secData[it.id].done)).length;
    const pct = Math.round((doneCount / cfg.items.length) * 100);
    if (badgeEl) badgeEl.textContent = `${doneCount} / ${cfg.items.length} · ${pct}%`;
    if (openBtn) openBtn.textContent = isEn ? cfg.ctaEn : cfg.ctaEs;

    if (axisBoxEl) {
      const axesStages = AXIS_STAGE_NAMES[curSec] || AXIS_STAGE_NAMES.manada;
      const axesMap = (secData && secData._axes) || {};
      const coveredCount = axesStages.filter((a) => Boolean(axesMap[a.key])).length;
      const statusTxt =
        coveredCount === 4
          ? "Equilibrio completo: 4 / 4 Ejes PJOS cubiertos"
          : `${coveredCount} / 4 Ejes PJOS trabajados (toca cada etapa para marcar equilibrio)`;
      axisBoxEl.innerHTML = `
        <div class="bt-prog-axis-head">
          <strong>Equilibrio en los 4 Ejes Temáticos PJOS</strong>
          <span class="bt-prog-axis-status${coveredCount === 4 ? " is-complete" : ""}">${escapeHtml(statusTxt)}</span>
        </div>
        <div class="bt-prog-axis-grid">
          ${axesStages
            .map((a) => {
              const on = Boolean(axesMap[a.key]);
              return `<button type="button" class="bt-prog-axis-pill ${a.cls}${on ? " is-done" : ""}" data-prog-axis-toggle="${a.key}" aria-pressed="${on}">
                <span class="bt-prog-axis-stage">${escapeHtml(a.stage)}</span>
                <small>${escapeHtml(a.axis)}</small>
              </button>`;
            })
            .join("")}
        </div>
      `;
    }

    listEl.innerHTML = cfg.items
      .map((it) => {
        const entry = secData[it.id] || { done: false, date: "" };
        const lbl = isEn ? it.labelEn : it.labelEs;
        return `
          <div class="bt-prog-item${entry.done ? " is-done" : ""}">
            <label class="bt-prog-check-label">
              <input type="checkbox" data-prog-check="${escapeHtml(it.id)}"${entry.done ? " checked" : ""} />
              <span>${escapeHtml(lbl)}</span>
            </label>
            <input type="text" class="bt-prog-date-input" data-prog-date="${escapeHtml(it.id)}" value="${escapeHtml(entry.date || "")}" placeholder="DD/MM/AA" aria-label="Fecha ${escapeHtml(lbl)}" />
          </div>`;
      })
      .join("");
  };

  secBtns.forEach((b) => {
    b.addEventListener("click", () => {
      curSec = b.getAttribute("data-prog-sec") || "manada";
      renderChecklist();
      if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("click");
    });
  });

  listEl.addEventListener("change", (e) => {
    const chk = e.target.closest("[data-prog-check]");
    if (!chk) return;
    const id = chk.getAttribute("data-prog-check");
    if (!state[curSec]) state[curSec] = {};
    const prev = state[curSec][id] || { done: false, date: "" };
    const nowDone = Boolean(chk.checked);
    const today = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" });
    state[curSec][id] = { done: nowDone, date: prev.date || (nowDone ? today : "") };
    saveState(state);
    renderChecklist();
  });

  listEl.addEventListener("input", (e) => {
    const inp = e.target.closest("[data-prog-date]");
    if (!inp) return;
    const id = inp.getAttribute("data-prog-date");
    if (!state[curSec]) state[curSec] = {};
    const prev = state[curSec][id] || { done: false, date: "" };
    state[curSec][id] = { done: prev.done, date: inp.value };
    saveState(state);
  });

  if (openBtn) {
    openBtn.addEventListener("click", () => {
      const cfg = SECTIONS[curSec] || SECTIONS.manada;
      const secData = state[curSec] || {};
      const prefill = {};
      cfg.items.forEach((it) => {
        const entry = secData[it.id];
        if (entry && entry.date && it.formKey) {
          prefill[it.formKey] = entry.date;
        }
      });
      if (typeof window.__btSelectSmartTemplate === "function") {
        window.__btSelectSmartTemplate(cfg.tplId, true, prefill);
        showWebToast("Fechas de tu checklist transferidas al formato oficial P9.");
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      delete state[curSec];
      saveState(state);
      renderChecklist();
      showWebToast("Checklist de sección reiniciado.");
    });
  }

  if (axisBoxEl) {
    axisBoxEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-prog-axis-toggle]");
      if (!btn) return;
      const key = btn.getAttribute("data-prog-axis-toggle");
      if (!state[curSec]) state[curSec] = {};
      if (!state[curSec]._axes) state[curSec]._axes = {};
      state[curSec]._axes[key] = !state[curSec]._axes[key];
      saveState(state);
      renderChecklist();
      if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("toggle");
    });
  }

  window.__btRefreshProgressionUi = renderChecklist;
  renderChecklist();
}

// ============================================================================
// ESPACIO DEDICADO v10.0.0: LOS 4 EJES TEMÁTICOS DEL PJOS Y HERRAMIENTAS LOCALES
// ============================================================================
const BT_ECO_IMPACT_KEY = "bt_eco_impact_v1";
const BT_SAFE_TRIP_KEY = "bt_safe_trip_check_v1";
const BT_MOP_HOURS_KEY = "bt_mop_hours_v1";
const BT_SMART_BUILDER_KEY = "bt_smart_builder_v1";

function getEcoImpactState() {
  try {
    const raw = JSON.parse(localStorage.getItem(BT_ECO_IMPACT_KEY) || "{}");
    return {
      sheets: Math.max(0, Number(raw.sheets || 0)),
      seenKeys: Array.isArray(raw.seenKeys) ? raw.seenKeys.slice(-200) : [],
      missions: raw.missions && typeof raw.missions === "object" ? raw.missions : {}
    };
  } catch (_) {
    return { sheets: 0, seenKeys: [], missions: {} };
  }
}

function saveEcoImpactState(st) {
  try {
    localStorage.setItem(BT_ECO_IMPACT_KEY, JSON.stringify(st));
  } catch (_) {}
}

function computeEcoMetrics(sheetsCount) {
  const sheets = Math.max(0, Math.round(Number(sheetsCount || 0)));
  const waterLiters = (sheets * 0.35).toFixed(1);
  const co2Grams = Math.round(sheets * 4.8);
  const ranks = [
    { min: 0, max: 15, name: "Nivel 1 · Semilla Scout", next: "Brote Verde (15 hojas)" },
    { min: 15, max: 45, name: "Nivel 2 · Brote Verde", next: "Guardabosques (45 hojas)" },
    { min: 45, max: 100, name: "Nivel 3 · Guardabosques", next: "Tribu de la Tierra (100 hojas)" },
    { min: 100, max: 220, name: "Nivel 4 · Tribu de la Tierra", next: "Guardián Solar (220 hojas)" },
    { min: 220, max: 500, name: "Nivel 5 · Guardián Solar", next: "Rango máximo alcanzado" }
  ];
  let rank = ranks[0];
  for (const r of ranks) {
    if (sheets >= r.min) rank = r;
  }
  const span = Math.max(1, rank.max - rank.min);
  const ratio = sheets >= 220 ? 1 : Math.min(1, (sheets - rank.min) / span);
  return { sheets, waterLiters, co2Grams, rankName: rank.name, nextLabel: rank.next, ratio };
}

function setupPjosAxesHub() {
  const sectionEl = document.getElementById("ejes-pjos");
  if (!sectionEl) return;

  const PJOS_AXES_DATA = {
    salud: {
      title: "Salud y Bienestar",
      kicker: "EJE TEMÁTICO 01 · SALUD FÍSICA, EMOCIONAL Y ENTORNOS SEGUROS",
      img: "img/adc/salud.png",
      colorClass: "is-salud",
      libFilter: "salud",
      toolTab: "salud",
      toolBtnLabel: "Abrir Escudo A Salvo y Salida Segura",
      skillTab: "botiquin",
      skillLabel: "Skills: Botiquín",
      definition:
        "Promueve el autocuidado físico, la salud mental y socioemocional, la nutrición consciente, la vida activa al aire libre y la aplicación permanente de la Política Nacional A Salvo del Peligro en todas las actividades.",
      subareas: [
        "1. Salud física, activación deportiva y descanso",
        "2. Salud mental, gestión emocional y autoestima",
        "3. Alimentación saludable, hidratación e higiene en campo",
        "4. Prevención de riesgos, primeros auxilios y autocuidado",
        "5. Entornos seguros y libres de violencia (A Salvo del Peligro)"
      ],
      stages: [
        { sec: "Manada (6–9)", name: "Cazadero Raksha (Protección y cuidado)" },
        { sec: "Tropa (10–13)", name: "Rumbo Tortuga Lora" },
        { sec: "Comunidad (14–17)", name: "Sendero Cenit" },
        { sec: "Clan (18–21)", name: "Ruta Kikapú" }
      ],
      initiatives: ["Aliados de la Salud (Health Allies)", "Política A Salvo del Peligro (Safe from Harm)", "Canal Oficial CONECTA"],
      ods: ["ODS 2 · Hambre Cero", "ODS 3 · Salud y Bienestar", "ODS 6 · Agua Limpia y Saneamiento"],
      sampleQuery: "¿En qué consiste el eje temático de Salud y Bienestar en el PJOS y cuáles son sus subáreas?"
    },
    habilidades: {
      title: "Habilidades para la Vida",
      kicker: "EJE TEMÁTICO 02 · AUTONOMÍA, TÉCNICA SCOUT Y PROYECTOS SMART",
      img: "img/adc/habilidades.png",
      colorClass: "is-habilidades",
      libFilter: "habilidades",
      toolTab: "habilidades",
      toolBtnLabel: "Abrir Constructor Guiado SMART",
      skillTab: "claves",
      skillLabel: "Skills: Claves y Nudos",
      definition:
        "Desarrolla competencias prácticas, pensamiento crítico, creatividad artística, alfabetización científica y digital, educación financiera, liderazgo en equipo y diseño de proyectos con metodología SMART.",
      subareas: [
        "1. Vida al aire libre, campismo, pionerismo y orientación",
        "2. Liderazgo juvenil, trabajo en equipo y toma de decisiones",
        "3. Ciencia, tecnología, innovación y ciudadanía digital",
        "4. Expresión artística, comunicación y oficio creativo",
        "5. Educación financiera, empleabilidad y diseño de proyectos SMART"
      ],
      stages: [
        { sec: "Manada (6–9)", name: "Cazadero Bagheera (Destreza y agilidad)" },
        { sec: "Tropa (10–13)", name: "Rumbo Ocelote" },
        { sec: "Comunidad (14–17)", name: "Sendero Cima" },
        { sec: "Clan (18–21)", name: "Ruta Maya" }
      ],
      initiatives: ["Líderes para la Vida (Skills for Life)", "Agentes de Cambio.MX (Cédula P6.2 SMART)", "82 Especialidades FES"],
      ods: ["ODS 4 · Educación de Calidad", "ODS 8 · Trabajo Decente", "ODS 9 · Innovación", "ODS 11 · Ciudades Sostenibles"],
      sampleQuery: "¿Qué abarca el eje de Habilidades para la Vida en el PJOS y cómo se diseña un proyecto SMART?"
    },
    ambiente: {
      title: "Medio Ambiente y Sustentabilidad",
      kicker: "EJE TEMÁTICO 03 · ACCIÓN CLIMÁTICA Y TRIBU DE LA TIERRA",
      img: "img/adc/sustentabilidad.png",
      colorClass: "is-ambiente",
      libFilter: "ambiente",
      toolTab: "ambiente",
      toolBtnLabel: "Abrir Misión Planeta y Cero Papel",
      skillTab: "fogatas",
      skillLabel: "Skills: Fogatas",
      definition:
        "Impulsa la conexión directa con la naturaleza, la conservación de ecosistemas, la transición hacia energías limpias, el consumo responsable sin plásticos de un solo uso y los principios de No Dejar Rastro.",
      subareas: [
        "1. Biodiversidad, reforestación y protección de ecosistemas",
        "2. Acción climática y energías renovables (Scouts Go Solar)",
        "3. Reducción de plásticos y mares limpios (Tide Turners)",
        "4. Economía circular, consumo responsable y huella hídrica",
        "5. Campismo de mínimo impacto (7 Principios No Dejar Rastro)"
      ],
      stages: [
        { sec: "Manada (6–9)", name: "Cazadero Hermano Gris" },
        { sec: "Tropa (10–13)", name: "Rumbo Venado Cola Blanca" },
        { sec: "Comunidad (14–17)", name: "Sendero Cúspide" },
        { sec: "Clan (18–21)", name: "Ruta Otomí" }
      ],
      initiatives: ["Tribu de la Tierra (Earth Tribe)", "Champions for Nature (RECME P8.1)", "Scouts Go Solar (RECME P8.7)", "Plastic Tide Turners"],
      ods: ["ODS 7 · Energía Limpia", "ODS 12 · Producción Responsable", "ODS 13 · Acción por el Clima", "ODS 14 y 15 · Vida Submarina y Ecosistemas"],
      sampleQuery: "¿Qué iniciativas conforman la Tribu de la Tierra en el eje de Medio Ambiente y Sustentabilidad?"
    },
    paz: {
      title: "Paz y Participación Comunitaria",
      kicker: "EJE TEMÁTICO 04 · CULTURA DE PAZ, INCLUSIÓN Y SERVICIO",
      img: "img/adc/paz.png",
      colorClass: "is-paz",
      libFilter: "paz",
      toolTab: "paz",
      toolBtnLabel: "Abrir Bitácora Mensajeros de la Paz",
      skillTab: "silbato",
      skillLabel: "Skills: Silbato",
      definition:
        "Fomenta la construcción activa de cultura de paz, derechos humanos, inclusión y diversidad, diálogo intercultural, preservación del patrimonio, servicio comunitario y respuesta humanitaria organizada.",
      subareas: [
        "1. Cultura de paz, diálogo y resolución pacífica (MASC)",
        "2. Servicio comunitario e impacto social (Mensajeros de la Paz)",
        "3. Diversidad, equidad, inclusión y derechos humanos",
        "4. Identidad cultural y Guardianes del Patrimonio",
        "5. Acción humanitaria, reducción de desastres y Centros de Acopio"
      ],
      stages: [
        { sec: "Manada (6–9)", name: "Cazadero Baloo (Ley y convivencia)" },
        { sec: "Tropa (10–13)", name: "Rumbo Quetzal" },
        { sec: "Comunidad (14–17)", name: "Sendero Cumbre" },
        { sec: "Clan (18–21)", name: "Ruta Wixárika" }
      ],
      initiatives: ["Mensajeros de la Paz (RECME P8.3)", "Diálogo por la Paz", "Patrimonio (Patrimonito)", "HeForShe y Acción Humanitaria"],
      ods: ["ODS 1 · Fin de la Pobreza", "ODS 5 · Igualdad de Género", "ODS 10 · Reducción de Desigualdades", "ODS 16 · Paz, Justicia e Instituciones"],
      sampleQuery: "¿Qué abarca el eje de Paz y Participación Comunitaria y cómo se obtiene la insignia Mensajeros de la Paz?"
    }
  };

  // Sub-pestañas del espacio #ejes-pjos
  const tabBtns = Array.from(sectionEl.querySelectorAll("[data-ejes-tab]"));
  const panes = Array.from(sectionEl.querySelectorAll("[data-ejes-pane]"));
  const selectEjesTab = (tabId) => {
    const safe = ["explorar", "salud", "ambiente", "paz", "habilidades"].includes(tabId) ? tabId : "explorar";
    tabBtns.forEach((b) => {
      const act = b.getAttribute("data-ejes-tab") === safe;
      b.classList.toggle("active", act);
      b.setAttribute("aria-selected", String(act));
    });
    panes.forEach((p) => {
      p.classList.toggle("hidden", p.getAttribute("data-ejes-pane") !== safe);
    });
    if (safe === "ambiente") renderEcoDashboard();
  };
  window.__btSelectEjesTab = selectEjesTab;

  tabBtns.forEach((b) => {
    b.addEventListener("click", () => {
      selectEjesTab(b.getAttribute("data-ejes-tab"));
      if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("click");
    });
  });

  // Panel 1: Selector de los 4 Ejes y ficha oficial detallada
  let activeAxisKey = "salud";
  const axisDetailEl = document.getElementById("btAxisDetailPanel");
  const axisCards = Array.from(sectionEl.querySelectorAll("[data-axis-pick]"));

  const renderAxisDetail = () => {
    if (!axisDetailEl) return;
    const info = PJOS_AXES_DATA[activeAxisKey] || PJOS_AXES_DATA.salud;
    axisCards.forEach((c) => {
      const on = c.getAttribute("data-axis-pick") === activeAxisKey;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-pressed", String(on));
    });
    axisDetailEl.className = `bt-axis-detail-card ${info.colorClass}`;
    axisDetailEl.innerHTML = `
      <div class="bt-axis-detail-top">
        <div class="bt-axis-detail-head">
          <img src="${escapeHtml(info.img)}" alt="" class="bt-axis-detail-logo" loading="lazy" decoding="async" />
          <div>
            <span class="bt-wizard-kicker">${escapeHtml(info.kicker)}</span>
            <h3>${escapeHtml(info.title)}</h3>
            <p>${escapeHtml(info.definition)}</p>
          </div>
        </div>
      </div>

      <div class="bt-axis-detail-columns">
        <div class="bt-axis-subbox">
          <h4>Las 5 subáreas que trabaja este Eje</h4>
          <ul class="bt-axis-clean-list">
            ${info.subareas.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
          </ul>
        </div>
        <div class="bt-axis-subbox">
          <h4>Etapas e insignias por sección PJOS</h4>
          <div class="bt-axis-stages-mini">
            ${info.stages
              .map(
                (st) => `<div class="bt-axis-stage-row"><span>${escapeHtml(st.sec)}</span><strong>${escapeHtml(st.name)}</strong></div>`
              )
              .join("")}
          </div>
          <h4 style="margin-top:0.85rem;">Iniciativas Mundiales y ODS</h4>
          <div class="bt-axis-chips-wrap">
            ${info.initiatives.map((ini) => `<span class="bt-axis-tag-chip">${escapeHtml(ini)}</span>`).join("")}
            ${info.ods.map((o) => `<span class="bt-axis-tag-chip is-ods">${escapeHtml(o)}</span>`).join("")}
          </div>
        </div>
      </div>

      <div class="bt-ejes-inline-actions">
        <button type="button" class="bt-sf-btn is-accent" data-axis-goto-tool="${escapeHtml(info.toolTab)}">${escapeHtml(info.toolBtnLabel)} →</button>
      </div>
    `;
  };

  axisCards.forEach((c) => {
    c.addEventListener("click", () => {
      activeAxisKey = c.getAttribute("data-axis-pick") || "salud";
      const pickerAxis = document.getElementById("btPickerAxis");
      if (pickerAxis) pickerAxis.value = activeAxisKey;
      renderAxisDetail();
      renderActivitySuggestions(false);
      if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("click");
    });
  });

  // Armador Rápido de Reunión / Actividad por Eje
  const pickerSecEl = document.getElementById("btPickerSection");
  const pickerAxisEl = document.getElementById("btPickerAxis");
  const pickerTypeEl = document.getElementById("btPickerDocType");
  const suggestBtn = document.getElementById("btSuggestAxisDocsBtn");
  const pickerResultsEl = document.getElementById("btPickerResultsGrid");
  let pickerOffset = 0;

  const renderActivitySuggestions = (shuffle = false) => {
    if (!pickerResultsEl) return;
    const docs = STATE.documents || [];
    if (!docs.length) {
      pickerResultsEl.innerHTML = `<p class="bt-ejes-helper-note">Cargando catálogo oficial de fichas FAES y FES...</p>`;
      return;
    }
    const secVal = (pickerSecEl && pickerSecEl.value) || "all";
    const axVal = (pickerAxisEl && pickerAxisEl.value) || "salud";
    const typeVal = (pickerTypeEl && pickerTypeEl.value) || "both";
    if (shuffle) pickerOffset += 3;

    const pool = docs.filter((d) => {
      const catN = normalizeStr(d.category || "");
      const isFaes = catN.includes("faes");
      const isFes = catN.includes("especialidades") || catN.includes("fes");
      if (typeVal === "faes" && !isFaes) return false;
      if (typeVal === "fes" && !isFes) return false;
      if (typeVal === "both" && !isFaes && !isFes) return false;
      if (secVal !== "all") {
        const secs = d.applicable_sections || [d.section];
        if (!secs.includes(secVal)) return false;
      }
      return docMatchesPjosAxis(d, axVal);
    });

    if (!pool.length) {
      pickerResultsEl.innerHTML = `<p class="bt-ejes-helper-note">No hay fichas exactas para esta combinación; prueba cambiando el tipo de material o elige «Todas las secciones».</p>`;
      return;
    }

    const picked = [];
    const start = pickerOffset % pool.length;
    for (let i = 0; i < Math.min(3, pool.length); i++) {
      picked.push(pool[(start + i * 3) % pool.length]);
    }

    pickerResultsEl.innerHTML = picked
      .map(
        (d) => `
        <article class="bt-picker-doc-card">
          <div class="bt-picker-doc-top">
            <span class="bt-doc-code-badge">${escapeHtml(d.code || d.ext || "PDF")}</span>
            <span class="bt-picker-sec-pill">${escapeHtml(d.section_label || "General")}</span>
          </div>
          <h4>${escapeHtml(d.title)}</h4>
          <p>${escapeHtml(String(d.summary || "").slice(0, 185))}${String(d.summary || "").length > 185 ? "…" : ""}</p>
          <div class="bt-picker-doc-actions">
            <button type="button" class="bt-mini-action-btn is-primary" data-open-doc="${escapeHtml(d.id)}">Abrir ficha oficial</button>
          </div>
        </article>`
      )
      .join("");
  };

  window.__btRefreshPjosPicker = () => renderActivitySuggestions(false);
  [pickerSecEl, pickerAxisEl, pickerTypeEl].forEach((sel) => {
    if (sel) sel.addEventListener("change", () => renderActivitySuggestions(false));
  });
  if (suggestBtn) {
    suggestBtn.addEventListener("click", () => {
      renderActivitySuggestions(true);
      if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("click");
    });
  }

  // Panel 2: Salud — Escudo A Salvo del Peligro (4 pasos) + Semáforo de Salida Segura
  const SFH_STEPS = {
    reconocer: {
      title: "1. Reconocer señales de alerta o riesgo",
      body: "Identifica conductas que vulneren la dignidad, integridad física, emocional o digital de niñas, niños, adolescentes, jóvenes o adultos: acoso, burlas, exclusión, trato humillante, contacto inapropiado o incumplimiento de reglas de supervisión segura."
    },
    responder: {
      title: "2. Responder priorizando la seguridad inmediata",
      body: "Detén la actividad riesgosa de inmediato, coloca a la persona en un entorno seguro acompañada siempre por al menos dos adultos responsables visibles, escucha con calma sin juzgar ni revictimizar y brinda primeros auxilios si se requiere."
    },
    comunicar: {
      title: "3. Comunicar por el Canal Oficial CONECTA",
      body: "Registra el reporte confidencial en conecta.scouts.org.mx para activar el acompañamiento institucional de la Comisión Nacional de A Salvo del Peligro. Nunca ocultes ni minimices un incidente grave."
    },
    confiar: {
      title: "4. Confiar en la red de protección y seguimiento",
      body: "Promueve una cultura donde cualquier lobato, scout, caminante, rover o scouter sepa que puede pedir ayuda con plena confianza, manteniendo siempre vigentes los cursos de A Salvo del Peligro."
    }
  };
  const sfhDetailEl = document.getElementById("btSfhStepDetail");
  const sfhBtns = Array.from(sectionEl.querySelectorAll("[data-sfh-step]"));
  const renderSfhStep = (stepKey) => {
    const d = SFH_STEPS[stepKey] || SFH_STEPS.reconocer;
    sfhBtns.forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-sfh-step") === stepKey));
    if (sfhDetailEl) {
      sfhDetailEl.innerHTML = `<strong>${escapeHtml(d.title)}</strong><p>${escapeHtml(d.body)}</p>`;
    }
  };
  sfhBtns.forEach((b) => {
    b.addEventListener("click", () => renderSfhStep(b.getAttribute("data-sfh-step")));
  });
  renderSfhStep("reconocer");

  const SAFE_TRIP_ITEMS = [
    { id: "jl304", label: "Permisos de Salida (JL304) firmados por madre, padre o tutor de cada menor" },
    { id: "salud", label: "Fichas Médicas vigentes con alergias, tipo de sangre y teléfonos de emergencia" },
    { id: "sisas", label: "Membresía activa en SISAS para cobertura de Seguro Scout Nacional" },
    { id: "dos_adultos", label: "Regla de al menos 2 adultos responsables visibles con curso A Salvo del Peligro vigente" },
    { id: "botiquin", label: "Botiquín completo revisado y medicamentos personales etiquetados bajo resguardo adulto" },
    { id: "pernocta", label: "Pernocta y sanitarios: casas de campaña separadas por sección/edad y baños separados por género y entre jóvenes y adultos" },
    { id: "hidratacion", label: "Agua potable garantizada, protección solar e inocuidad en manejo de alimentos" },
    { id: "ruta_clima", label: "Pronóstico meteorológico consultado, contactos locales de emergencia y horarios de aviso" }
  ];
  const safeListEl = document.getElementById("btSafeTripChecklist");
  const safeBadgeEl = document.getElementById("btSafeTripBadge");
  const safeBarEl = document.getElementById("btSafeTripBar");
  const safeStatusEl = document.getElementById("btSafeTripStatusText");
  const resetSafeBtn = document.getElementById("btResetSafeTripBtn");

  const loadSafeState = () => {
    try {
      return JSON.parse(localStorage.getItem(BT_SAFE_TRIP_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  };
  let safeState = loadSafeState();

  const renderSafeChecklist = () => {
    if (!safeListEl) return;
    const done = SAFE_TRIP_ITEMS.filter((it) => Boolean(safeState[it.id])).length;
    const pct = Math.round((done / SAFE_TRIP_ITEMS.length) * 100);
    if (safeBadgeEl) safeBadgeEl.textContent = `${done} / ${SAFE_TRIP_ITEMS.length} · ${pct}%`;
    if (safeBarEl) safeBarEl.style.width = `${pct}%`;
    if (safeStatusEl) {
      safeStatusEl.textContent =
        pct === 100
          ? "Semáforo Verde: salida verificada con todos los controles preventivos listos."
          : pct >= 50
            ? "Semáforo Ámbar: avance parcial; completa los puntos pendientes antes de partir."
            : "Semáforo Preventivo: revisa y marca cada requisito esencial antes de la actividad.";
    }
    safeListEl.innerHTML = SAFE_TRIP_ITEMS.map(
      (it) => `
      <label class="bt-safe-check-item${safeState[it.id] ? " is-done" : ""}">
        <input type="checkbox" data-safe-trip-chk="${it.id}"${safeState[it.id] ? " checked" : ""} />
        <span>${escapeHtml(it.label)}</span>
      </label>`
    ).join("");
  };
  if (safeListEl) {
    safeListEl.addEventListener("change", (e) => {
      const chk = e.target.closest("[data-safe-trip-chk]");
      if (!chk) return;
      safeState[chk.getAttribute("data-safe-trip-chk")] = Boolean(chk.checked);
      try {
        localStorage.setItem(BT_SAFE_TRIP_KEY, JSON.stringify(safeState));
      } catch (_) {}
      renderSafeChecklist();
    });
  }
  if (resetSafeBtn) {
    resetSafeBtn.addEventListener("click", () => {
      safeState = {};
      try {
        localStorage.removeItem(BT_SAFE_TRIP_KEY);
      } catch (_) {}
      renderSafeChecklist();
      showWebToast("Semáforo de salida segura reiniciado.");
    });
  }
  renderSafeChecklist();

  // Panel 3: Medio Ambiente — Impacto Cero Papel + Misiones Tribu de la Tierra
  const ecoRingCircle = document.getElementById("btEcoRingCircle");
  const ecoTotalEl = document.getElementById("btEcoTotalSheets");
  const ecoWaterEl = document.getElementById("btEcoWaterSaved");
  const ecoCo2El = document.getElementById("btEcoCo2Saved");
  const ecoRankEl = document.getElementById("btEcoRankBadge");
  const ecoNextEl = document.getElementById("btEcoNextRankLabel");
  const ecoAddSessionBtn = document.getElementById("btEcoAddPaperlessSessionBtn");
  const ecoMissionTabs = Array.from(sectionEl.querySelectorAll("[data-eco-mission]"));
  const ecoMissionBody = document.getElementById("btEcoMissionBody");

  const renderEcoDashboard = () => {
    const st = getEcoImpactState();
    const m = computeEcoMetrics(st.sheets);
    if (ecoTotalEl) ecoTotalEl.textContent = String(m.sheets);
    if (ecoWaterEl) ecoWaterEl.textContent = `${m.waterLiters} L`;
    if (ecoCo2El) ecoCo2El.textContent = `${m.co2Grams} g`;
    if (ecoRankEl) ecoRankEl.textContent = m.rankName;
    if (ecoNextEl) ecoNextEl.textContent = `Siguiente: ${m.nextLabel}`;
    if (ecoRingCircle) {
      const circ = 314.16;
      ecoRingCircle.style.strokeDashoffset = String((circ * (1 - m.ratio)).toFixed(2));
    }
    if (typeof window.__btRefreshSettingsDataPane === "function") {
      window.__btRefreshSettingsDataPane();
    }
  };

  window.__btRecordPaperlessImpact = (pagesDelta = 1, uniqueKey = "") => {
    const st = getEcoImpactState();
    if (uniqueKey) {
      if (st.seenKeys.includes(uniqueKey)) return;
      st.seenKeys.push(uniqueKey);
      if (st.seenKeys.length > 200) st.seenKeys = st.seenKeys.slice(-200);
    }
    st.sheets = Math.max(0, Number(st.sheets || 0) + Math.max(1, Number(pagesDelta || 1)));
    saveEcoImpactState(st);
    renderEcoDashboard();
  };

  if (ecoAddSessionBtn) {
    ecoAddSessionBtn.addEventListener("click", () => {
      window.__btRecordPaperlessImpact(5, "");
      if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("success");
      showWebToast("+5 hojas sumadas a tu Impacto Cero Papel.");
    });
  }

  const ECO_MISSIONS = {
    solar: {
      title: "Desafío Scouts Go Solar (RECME P8.7)",
      ods: "ODS 7 · ODS 13",
      tplId: "p8_solar",
      tplBtn: "Abrir Solicitud Oficial P8.7 (Scouts Go Solar)",
      desc: "Experimenta el poder de la energía solar en tu Patrulla, Seisena, Comunidad o Clan con experimentos prácticos y acción climática.",
      tasks: [
        { id: "sol1", text: "Medir la radiación UV / sombra y aprender seguridad solar en actividades al aire libre" },
        { id: "sol2", text: "Construir un horno solar, reloj solar o deshidratador solar con materiales reutilizados" },
        { id: "sol3", text: "Auditar el consumo eléctrico de tu local scout o casa y reducir focos/vampiros energéticos" },
        { id: "sol4", text: "Compartir una demostración solar con otra sección o escuela y subir evidencia a sdgs.scout.org" }
      ]
    },
    plasticos: {
      title: "Reto Mares Limpios · Plastic Tide Turners",
      ods: "ODS 12 · ODS 14",
      tplId: "p8",
      tplBtn: "Abrir Formato Tribu de la Tierra (P8.1)",
      desc: "Supera los 3 niveles (Iniciador, Líder y Campeón) eliminando plásticos desechables de tus campamentos y comunidad.",
      tasks: [
        { id: "pla1", text: "Realizar un campamento o reunión 100% libre de platos, vasos y botellas desechables" },
        { id: "pla2", text: "Hacer una auditoría de residuos plásticos durante 7 días e identificar los 3 más frecuentes" },
        { id: "pla3", text: "Liderar una jornada de limpieza de río, playa, parque o barranca separando reciclables" },
        { id: "pla4", text: "Lograr que comercios locales, escuela o familias adopten alternativas reutilizables permanentes" }
      ]
    },
    biodiversidad: {
      title: "Guardianes de Ecosistemas · Champions for Nature (P8.1)",
      ods: "ODS 15 · ODS 6",
      tplId: "p8",
      tplBtn: "Abrir Solicitud Champions for Nature (P8.1)",
      desc: "Protege especies nativas, polinizadores y suelos aplicando los 7 principios de No Dejar Rastro.",
      tasks: [
        { id: "bio1", text: "Registrar al menos 10 especies nativas de flora o fauna de tu región sin alterar su hábitat" },
        { id: "bio2", text: "Instalar un jardín polinizador, hotel de insectos o sistema de captación pluvial" },
        { id: "bio3", text: "Aplicar los 7 principios de No Dejar Rastro en caminata y fogata responsable" },
        { id: "bio4", text: "Documentar antes/después de tu acción ambiental para tramitar tu reconocimiento P8.1" }
      ]
    }
  };
  let activeMissionKey = "solar";

  const renderEcoMission = () => {
    if (!ecoMissionBody) return;
    const st = getEcoImpactState();
    const mCfg = ECO_MISSIONS[activeMissionKey] || ECO_MISSIONS.solar;
    const mDoneMap = st.missions[activeMissionKey] || {};
    const doneCount = mCfg.tasks.filter((t) => Boolean(mDoneMap[t.id])).length;
    ecoMissionTabs.forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-eco-mission") === activeMissionKey));

    ecoMissionBody.innerHTML = `
      <div class="bt-eco-mission-head">
        <div>
          <strong>${escapeHtml(mCfg.title)}</strong>
          <p>${escapeHtml(mCfg.desc)}</p>
        </div>
        <span class="bt-prog-badge">${doneCount} / ${mCfg.tasks.length} retos · ${escapeHtml(mCfg.ods)}</span>
      </div>
      <div class="bt-safe-check-list">
        ${mCfg.tasks
          .map(
            (t) => `
          <label class="bt-safe-check-item${mDoneMap[t.id] ? " is-done" : ""}">
            <input type="checkbox" data-eco-task-chk="${t.id}"${mDoneMap[t.id] ? " checked" : ""} />
            <span>${escapeHtml(t.text)}</span>
          </label>`
          )
          .join("")}
      </div>
      <p class="bt-ejes-helper-note" style="margin:0.8rem 0 0;">Documento relacionado disponible para llenado offline en el apartado <strong>Editor de archivos</strong>.</p>
    `;
  };

  ecoMissionTabs.forEach((b) => {
    b.addEventListener("click", () => {
      activeMissionKey = b.getAttribute("data-eco-mission") || "solar";
      renderEcoMission();
    });
  });
  if (ecoMissionBody) {
    ecoMissionBody.addEventListener("change", (e) => {
      const chk = e.target.closest("[data-eco-task-chk]");
      if (!chk) return;
      const taskId = chk.getAttribute("data-eco-task-chk");
      const st = getEcoImpactState();
      if (!st.missions[activeMissionKey]) st.missions[activeMissionKey] = {};
      const wasDone = Boolean(st.missions[activeMissionKey][taskId]);
      st.missions[activeMissionKey][taskId] = Boolean(chk.checked);
      if (!wasDone && chk.checked) {
        st.sheets = Number(st.sheets || 0) + 2;
      }
      saveEcoImpactState(st);
      renderEcoMission();
      renderEcoDashboard();
    });
  }
  renderEcoDashboard();
  renderEcoMission();

  // Panel 4: Paz — Bitácora Mensajeros de la Paz -> Solicitud P8.3
  const mopForm = document.getElementById("btMopLogForm");
  const mopProjIn = document.getElementById("btMopProjectInput");
  const mopHoursIn = document.getElementById("btMopHoursInput");
  const mopDateIn = document.getElementById("btMopDateInput");
  const mopListEl = document.getElementById("btMopEntriesList");
  const mopBadgeEl = document.getElementById("btMopTotalHoursBadge");
  const mopBarEl = document.getElementById("btMopHoursBar");
  const mopCopyBtn = document.getElementById("btMopCopySummaryBtn");

  const getMopLogs = () => {
    try {
      const arr = JSON.parse(localStorage.getItem(BT_MOP_HOURS_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  };
  const saveMopLogs = (arr) => {
    try {
      localStorage.setItem(BT_MOP_HOURS_KEY, JSON.stringify(arr.slice(0, 60)));
    } catch (_) {}
  };

  const renderMopLogs = () => {
    const logs = getMopLogs();
    const total = logs.reduce((acc, x) => acc + Math.max(0, Number(x.hours || 0)), 0);
    if (mopBadgeEl) mopBadgeEl.textContent = `${total % 1 === 0 ? total : total.toFixed(1)} h registradas`;
    if (mopBarEl) mopBarEl.style.width = `${Math.min(100, Math.round((total / 40) * 100))}%`;
    if (!mopListEl) return;
    if (!logs.length) {
      mopListEl.innerHTML = `<p class="bt-ejes-helper-note">Aún no has registrado jornadas de servicio en este dispositivo. Agrega tu primera actividad arriba.</p>`;
      return;
    }
    mopListEl.innerHTML = logs
      .map(
        (it, idx) => `
        <div class="bt-mop-entry-row">
          <div>
            <strong>${escapeHtml(it.project)}</strong>
            <span>${escapeHtml(it.date || "Sin fecha")} · ${escapeHtml(String(it.hours))} h</span>
          </div>
          <button type="button" class="bt-mini-action-btn is-danger" data-mop-del="${idx}" aria-label="Eliminar registro">Quitar</button>
        </div>`
      )
      .join("");
  };

  if (mopForm) {
    mopForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const proj = String((mopProjIn && mopProjIn.value) || "").trim();
      const hrs = parseFloat((mopHoursIn && mopHoursIn.value) || "0");
      if (!proj || !Number.isFinite(hrs) || hrs <= 0) {
        showWebToast("Escribe el nombre de la actividad y las horas de servicio.");
        return;
      }
      const today = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" });
      const logs = getMopLogs();
      logs.unshift({
        project: proj,
        hours: Math.round(hrs * 10) / 10,
        date: String((mopDateIn && mopDateIn.value) || "").trim() || today
      });
      saveMopLogs(logs);
      if (mopProjIn) mopProjIn.value = "";
      if (mopHoursIn) mopHoursIn.value = "";
      renderMopLogs();
      if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("success");
    });
  }
  if (mopListEl) {
    mopListEl.addEventListener("click", (e) => {
      const del = e.target.closest("[data-mop-del]");
      if (!del) return;
      const idx = parseInt(del.getAttribute("data-mop-del") || "-1", 10);
      const logs = getMopLogs();
      if (idx >= 0 && idx < logs.length) {
        logs.splice(idx, 1);
        saveMopLogs(logs);
        renderMopLogs();
      }
    });
  }
  if (mopCopyBtn) {
    mopCopyBtn.addEventListener("click", async () => {
      const logs = getMopLogs();
      const total = logs.reduce((acc, x) => acc + Math.max(0, Number(x.hours || 0)), 0);
      const lines = logs.map((x) => `- ${x.project}: ${x.hours} h (${x.date || "sin fecha"})`);
      const summary = [`Bitácora Mensajeros de la Paz — Total: ${total} horas`, ...lines].join("\n");
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(summary);
        }
        showWebToast("Resumen de horas Mensajeros de la Paz copiado al portapapeles.");
      } catch (_) {
        showWebToast("Total acumulado: " + total + " h registradas localmente.");
      }
    });
  }
  renderMopLogs();

  // Panel 5: Habilidades — Constructor Guiado de Proyectos SMART -> Cédula Oficial P6.2
  const ODS_SHORT_NAMES = [
    "1 Fin Pobreza", "2 Hambre Cero", "3 Salud", "4 Educación", "5 Igualdad",
    "6 Agua Limpia", "7 Energía", "8 Trabajo", "9 Innovación", "10 Inclusión",
    "11 Ciudades", "12 Consumo", "13 Clima", "14 Océanos", "15 Ecosistemas",
    "16 Paz y Justicia", "17 Alianzas"
  ];
  const SMART_EXAMPLES_BY_AXIS = {
    "Habilidades para la Vida": {
      title: "Taller de Primeros Auxilios, Finanzas y Orientación Juvenil",
      s: "Impartir 4 talleres prácticos de nudos, botiquín y ahorro personal a 35 adolescentes de nuestra comunidad escolar.",
      m: "Capacitar al menos a 35 jóvenes con 85% de asistencia, entregar 35 guías digitales y evaluar destrezas prácticas.",
      a: "1) Permiso con dirección escolar; 2) Preparar estaciones por patrulla/equipo; 3) Ejecutar 4 sesiones sabatinas con material propio.",
      r: "Los jóvenes de la localidad carecen de espacios gratuitos donde aprender herramientas prácticas de emergencia y organización personal."
    },
    "Salud y Bienestar": {
      title: "Jornada Activa de Salud Emocional, Hidratación y Deporte Seguro",
      s: "Organizar un circuito deportivo y 3 charlas de gestión emocional y nutrición para 50 NNAJ del Grupo y familias vecinas.",
      m: "Lograr la participación de 50 asistentes, instalar 2 puntos de hidratación sin refrescos y aplicar encuesta de bienestar.",
      a: "1) Invitar a profesional de salud local; 2) Diseñar circuito recreativo inclusivo; 3) Difundir convocatoria y ejecutar en parque público.",
      r: "Sedentarismo y estrés escolar detectado en adolescentes de nuestra colonia tras el diagnóstico de sección."
    },
    "Medio Ambiente y Sustentabilidad": {
      title: "Jardín Polinizador y Campamento Cero Plásticos de un Solo Uso",
      s: "Rehabilitar 20 m2 de jardinera con plantas nativas para polinizadores y eliminar desechables en las actividades del Grupo Scout.",
      m: "Sembrar 40 plantas endémicas con 90% de supervivencia a 60 días y recolectar/evitar al menos 30 kg de residuos plásticos.",
      a: "1) Gestionar donación en vivero municipal; 2) Jornada de preparación de sustrato; 3) Riego por guardias y bitácora fotográfica.",
      r: "Pérdida de áreas verdes para abejas/mariposas y exceso de basura plástica en el parque donde sesionamos cada sábado."
    },
    "Paz y Participación Comunitaria": {
      title: "Brigada de Cultura de Paz, Lectura Inclusiva y Rehabilitación de Parque",
      s: "Restaurar el área infantil del parque vecinal y realizar 3 círculos de diálogo por la paz y juegos cooperativos abiertos al barrio.",
      m: "Rehabilitar 4 bancas/juegos, reunir a 40 vecinos e invertir al menos 60 horas colectivas de servicio comunitario.",
      a: "1) Acordar con comité vecinal; 2) Colecta de pintura y brochas; 3) Dos jornadas de pintura y cierre con feria de paz.",
      r: "Deterioro del espacio público y poca convivencia segura entre niñas, niños y jóvenes de la colonia."
    }
  };

  const smartTitleIn = document.getElementById("btSmartTitle");
  const smartSecIn = document.getElementById("btSmartSection");
  const smartAxisIn = document.getElementById("btSmartAxis");
  const smartOdsWrap = document.getElementById("btSmartOdsPills");
  const smartSIn = document.getElementById("btSmartS");
  const smartMIn = document.getElementById("btSmartM");
  const smartAIn = document.getElementById("btSmartA");
  const smartRIn = document.getElementById("btSmartR");
  const smartTIn = document.getElementById("btSmartT");
  const smartScoreBadge = document.getElementById("btSmartScoreBadge");
  const smartSynthEl = document.getElementById("btSmartSynthesizedText");
  const smartCopyBtn = document.getElementById("btSmartCopyTextBtn");
  const smartClearBtn = document.getElementById("btSmartClearBtn");

  const loadSmartDraft = () => {
    try {
      return JSON.parse(localStorage.getItem(BT_SMART_BUILDER_KEY) || "{}") || {};
    } catch (_) {
      return {};
    }
  };
  let smartState = loadSmartDraft();
  if (!Array.isArray(smartState.ods)) smartState.ods = ["ODS 4", "ODS 13"];

  if (smartTitleIn && smartState.title) smartTitleIn.value = smartState.title;
  if (smartSecIn && smartState.sec) smartSecIn.value = smartState.sec;
  if (smartAxisIn && smartState.axis) smartAxisIn.value = smartState.axis;
  if (smartSIn && smartState.s) smartSIn.value = smartState.s;
  if (smartMIn && smartState.m) smartMIn.value = smartState.m;
  if (smartAIn && smartState.a) smartAIn.value = smartState.a;
  if (smartRIn && smartState.r) smartRIn.value = smartState.r;
  if (smartTIn && smartState.t) smartTIn.value = smartState.t;

  const renderSmartOdsPills = () => {
    if (!smartOdsWrap) return;
    smartOdsWrap.innerHTML = ODS_SHORT_NAMES.map((lbl, i) => {
      const code = `ODS ${i + 1}`;
      const on = smartState.ods.includes(code);
      return `<button type="button" class="bt-smart-ods-pill${on ? " is-active" : ""}" data-smart-ods="${code}" aria-pressed="${on}">${escapeHtml(lbl)}</button>`;
    }).join("");
  };

  const buildSynthesizedSmartGoal = () => {
    const s = String((smartSIn && smartSIn.value) || "").trim();
    const m = String((smartMIn && smartMIn.value) || "").trim();
    const a = String((smartAIn && smartAIn.value) || "").trim();
    const r = String((smartRIn && smartRIn.value) || "").trim();
    const t = String((smartTIn && smartTIn.value) || "").trim();
    const filled = [s, m, a, r, t].filter(Boolean).length;
    if (smartScoreBadge) smartScoreBadge.textContent = `${filled} / 5 bloques SMART`;
    if (!filled) {
      return "Completa los bloques arriba para generar automáticamente la redacción clara de tu Objetivo General SMART.";
    }
    const parts = [];
    if (s) parts.push(s.replace(/\.$/, ""));
    if (m) parts.push(`midiendo el logro mediante: ${m.replace(/\.$/, "")}`);
    if (t) parts.push(`con fecha límite proyectada al ${t}`);
    if (r) parts.push(`para atender de forma directa: ${r.replace(/\.$/, "")}`);
    return parts.join(", ") + ".";
  };

  const syncSmartBuilder = () => {
    smartState = {
      title: String((smartTitleIn && smartTitleIn.value) || ""),
      sec: String((smartSecIn && smartSecIn.value) || "Comunidad"),
      axis: String((smartAxisIn && smartAxisIn.value) || "Habilidades para la Vida"),
      ods: Array.isArray(smartState.ods) ? smartState.ods : [],
      s: String((smartSIn && smartSIn.value) || ""),
      m: String((smartMIn && smartMIn.value) || ""),
      a: String((smartAIn && smartAIn.value) || ""),
      r: String((smartRIn && smartRIn.value) || ""),
      t: String((smartTIn && smartTIn.value) || "")
    };
    try {
      localStorage.setItem(BT_SMART_BUILDER_KEY, JSON.stringify(smartState));
    } catch (_) {}
    if (smartSynthEl) smartSynthEl.textContent = buildSynthesizedSmartGoal();
  };

  if (smartOdsWrap) {
    smartOdsWrap.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-smart-ods]");
      if (!btn) return;
      const code = btn.getAttribute("data-smart-ods");
      const idx = smartState.ods.indexOf(code);
      if (idx >= 0) smartState.ods.splice(idx, 1);
      else if (smartState.ods.length < 4) smartState.ods.push(code);
      else {
        smartState.ods.shift();
        smartState.ods.push(code);
      }
      renderSmartOdsPills();
      syncSmartBuilder();
    });
  }

  [smartTitleIn, smartSecIn, smartAxisIn, smartSIn, smartMIn, smartAIn, smartRIn, smartTIn].forEach((el) => {
    if (el) el.addEventListener("input", syncSmartBuilder);
    if (el) el.addEventListener("change", syncSmartBuilder);
  });

  sectionEl.querySelectorAll("[data-smart-example]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-smart-example");
      const axisName = (smartAxisIn && smartAxisIn.value) || "Habilidades para la Vida";
      const ex = SMART_EXAMPLES_BY_AXIS[axisName] || SMART_EXAMPLES_BY_AXIS["Habilidades para la Vida"];
      if (key === "t" && smartTIn) {
        const dt = new Date(Date.now() + 56 * 86400000);
        smartTIn.value = dt.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
      } else if (key === "s" && smartSIn) {
        smartSIn.value = ex.s;
        if (smartTitleIn && !smartTitleIn.value.trim()) smartTitleIn.value = ex.title;
      } else if (key === "m" && smartMIn) smartMIn.value = ex.m;
      else if (key === "a" && smartAIn) smartAIn.value = ex.a;
      else if (key === "r" && smartRIn) smartRIn.value = ex.r;
      syncSmartBuilder();
    });
  });



  if (smartCopyBtn) {
    smartCopyBtn.addEventListener("click", async () => {
      syncSmartBuilder();
      const summary = [
        `Proyecto: ${smartState.title || "Sin título"} (${smartState.sec})`,
        `Eje PJOS: ${smartState.axis} | ODS: ${(smartState.ods || []).join(", ")}`,
        `Objetivo SMART: ${buildSynthesizedSmartGoal()}`,
        smartState.a ? `Actividades clave: ${smartState.a}` : ""
      ]
        .filter(Boolean)
        .join("\n");
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(summary);
        }
        showWebToast("Resumen SMART copiado al portapapeles.");
      } catch (_) {
        showWebToast("No se pudo copiar automáticamente.");
      }
    });
  }

  if (smartClearBtn) {
    smartClearBtn.addEventListener("click", () => {
      [smartTitleIn, smartSIn, smartMIn, smartAIn, smartRIn, smartTIn].forEach((el) => {
        if (el) el.value = "";
      });
      smartState.ods = ["ODS 4"];
      renderSmartOdsPills();
      syncSmartBuilder();
      showWebToast("Constructor SMART limpio.");
    });
  }

  // Delegación de pestañas internas dentro de #ejes-pjos
  sectionEl.addEventListener("click", (e) => {
    const toolJump = e.target.closest("[data-axis-goto-tool]");
    if (toolJump) {
      selectEjesTab(toolJump.getAttribute("data-axis-goto-tool"));
      sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  renderAxisDetail();
  renderSmartOdsPills();
  syncSmartBuilder();
}

// ============================================================================
// ESPACIO OFFLINE: SKILLS v10.2.0 (20 CLAVES, NUDOS 3D SVG, TU MOCHILA, PISTAS, BOTIQUÍN, FOGATAS, SILBATO, RETO)
// ============================================================================
function setupScoutSkillsHub() {
  const sectionEl = document.getElementById("skills");
  if (!sectionEl) return;

  const SKILL_TABS = ["claves", "nudos", "mochila", "pistas", "botiquin", "fogatas", "silbato", "reto"];
  const tabBtns = Array.from(sectionEl.querySelectorAll("#btSkillsTabs [data-skills-tab]"));
  const panes = Array.from(sectionEl.querySelectorAll("[data-skills-pane]"));

  let audioTimers = [];
  let audioNodes = [];
  let activeWhistleRow = null;

  const stopSkillAudio = () => {
    audioTimers.forEach((id) => clearTimeout(id));
    audioTimers = [];
    audioNodes.forEach((node) => {
      try {
        if (typeof node.stop === "function") node.stop();
        if (typeof node.disconnect === "function") node.disconnect();
      } catch (_) {}
    });
    audioNodes = [];
    const lampEl = document.getElementById("btMorseLamp");
    if (lampEl) lampEl.classList.remove("is-lit");
    const morseBtn = document.getElementById("btMorsePlayBtn");
    if (morseBtn) {
      morseBtn.dataset.playing = "0";
      morseBtn.textContent = "Escuchar";
    }
    if (activeWhistleRow) {
      activeWhistleRow.classList.remove("is-playing");
      const btn = activeWhistleRow.querySelector(".bt-whistle-play");
      if (btn) btn.textContent = "Escuchar";
      activeWhistleRow = null;
    }
  };
  window.__btStopSkillAudio = stopSkillAudio;

  const playToneSequence = (codeStr, mode = "morse", options = {}) => {
    stopSkillAudio();
    const cleaned = String(codeStr || "").trim();
    if (!cleaned) return;

    const unit = mode === "whistle" ? 115 : (options.slow ? 160 : 90);
    const events = [];
    let cursor = 0;

    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (ch === ".") {
        events.push({ start: cursor, dur: unit });
        cursor += unit * 2;
      } else if (ch === "-") {
        events.push({ start: cursor, dur: unit * 3 });
        cursor += unit * 4;
      } else if (ch === "/") {
        cursor += unit * 4;
      } else if (ch === " ") {
        cursor += unit * 2;
      }
    }
    if (!events.length) return;

    let ctx = null;
    try {
      if (typeof BtSoundEngine !== "undefined" && typeof BtSoundEngine.ensureContext === "function") {
        ctx = BtSoundEngine.ensureContext();
      } else {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) ctx = new Ctx();
      }
      if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") {
        ctx.resume().catch(() => {});
      }
    } catch (_) {
      ctx = null;
    }

    const lampEl = mode === "morse" ? document.getElementById("btMorseLamp") : null;
    const morseBtn = mode === "morse" ? document.getElementById("btMorsePlayBtn") : null;
    if (morseBtn) {
      morseBtn.dataset.playing = "1";
      morseBtn.textContent = "Detener";
    }
    if (mode === "whistle" && options.btn) {
      const row = options.btn.closest(".bt-whistle-row");
      if (row) {
        activeWhistleRow = row;
        row.classList.add("is-playing");
      }
      options.btn.textContent = "Sonando...";
    }

    events.forEach((ev) => {
      audioTimers.push(
        setTimeout(() => {
          if (lampEl) lampEl.classList.add("is-lit");
          if (ctx) {
            try {
              const now = ctx.currentTime;
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              if (mode === "whistle") {
                osc.type = "triangle";
                osc.frequency.setValueAtTime(2620, now);
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.frequency.setValueAtTime(28, now);
                lfoGain.gain.setValueAtTime(48, now);
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                lfo.start(now);
                lfo.stop(now + ev.dur / 1000 + 0.03);
                audioNodes.push(lfo, lfoGain);
                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.14, now + 0.015);
                gain.gain.setValueAtTime(0.14, now + Math.max(0.02, ev.dur / 1000 - 0.02));
                gain.gain.exponentialRampToValueAtTime(0.001, now + ev.dur / 1000);
              } else {
                osc.type = "sine";
                osc.frequency.setValueAtTime(680, now);
                gain.gain.setValueAtTime(0.001, now);
                gain.gain.linearRampToValueAtTime(0.16, now + 0.012);
                gain.gain.setValueAtTime(0.16, now + Math.max(0.02, ev.dur / 1000 - 0.015));
                gain.gain.exponentialRampToValueAtTime(0.001, now + ev.dur / 1000);
              }
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(now);
              osc.stop(now + ev.dur / 1000 + 0.025);
              audioNodes.push(osc, gain);
            } catch (_) {}
          }
        }, ev.start)
      );
      audioTimers.push(
        setTimeout(() => {
          if (lampEl) lampEl.classList.remove("is-lit");
        }, ev.start + ev.dur)
      );
    });

    audioTimers.push(
      setTimeout(() => {
        stopSkillAudio();
      }, cursor + 80)
    );
  };

  const selectSkillsTab = (tabId) => {
    const safe = SKILL_TABS.includes(tabId) ? tabId : "claves";
    STATE.activeSkillsTab = safe;
    stopSkillAudio();
    tabBtns.forEach((b) => {
      const act = b.getAttribute("data-skills-tab") === safe;
      b.classList.toggle("active", act);
      b.setAttribute("aria-selected", String(act));
    });
    panes.forEach((p) => {
      p.classList.toggle("hidden", p.getAttribute("data-skills-pane") !== safe);
    });
  };
  window.__btSelectSkillsTab = selectSkillsTab;

  tabBtns.forEach((b) => {
    b.addEventListener("click", () => {
      selectSkillsTab(b.getAttribute("data-skills-tab"));
      if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("click");
    });
  });

  // --------------------------------------------------------------------------
  // 1. TRADUCTOR DE CLAVES SCOUT (20 CLAVES + DIAGRAMAS MAESTROS EXACTOS)
  // --------------------------------------------------------------------------
  const ALPH_27 = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
  const ALPH_26 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const upperNoAccentKeepN = (str) =>
    String(str || "")
      .toUpperCase()
      .replace(/[ÁÀÄÂ]/g, "A")
      .replace(/[ÉÈËÊ]/g, "E")
      .replace(/[ÍÌÏÎ]/g, "I")
      .replace(/[ÓÒÖÔ]/g, "O")
      .replace(/[ÚÙÜÛ]/g, "U");

  const upperNoAccent = (str) =>
    upperNoAccentKeepN(str).replace(/Ñ/g, "N");

  const SEMA_POS_NAMES = [
    "abajo (6:00)",
    "abajo-izq (7:30)",
    "izquierda (9:00)",
    "arriba-izq (10:30)",
    "arriba (12:00)",
    "arriba-der (1:30)",
    "derecha (3:00)",
    "abajo-der (4:30)"
  ];

  const SEMAPHORE_MAP = {
    A: [0, 1], B: [0, 2], C: [0, 3], D: [0, 4], E: [0, 5], F: [0, 6], G: [0, 7],
    H: [1, 2], I: [1, 3], K: [1, 4], L: [1, 5], M: [1, 6], N: [1, 7],
    O: [2, 3], P: [2, 4], Q: [2, 5], R: [2, 6], S: [2, 7],
    T: [3, 4], U: [3, 5], Y: [3, 6],
    J: [4, 6], V: [4, 7],
    W: [5, 6], X: [5, 7],
    Z: [6, 7],
    " ": [0, 0]
  };

  let semaRedWhite = true; // Estandar ASMAC (rojo/blanco) con opción náutico (rojo/amarillo)
  let selectedSemaLetter = "S";

  const semaDirVec = (pos) => {
    const rad = (pos * 45 * Math.PI) / 180;
    return { dx: -Math.sin(rad), dy: Math.cos(rad) };
  };

  const assignSemaphoreShoulders = (p1, p2) => {
    const isLeftSide = (p) => p === 1 || p === 2 || p === 3;
    const isRightSide = (p) => p === 5 || p === 6 || p === 7;
    if (p1 === p2) return [p1, p2];
    if (isLeftSide(p1) && isRightSide(p2)) return [p1, p2];
    if (isRightSide(p1) && isLeftSide(p2)) return [p2, p1];
    if (isLeftSide(p1) && !isLeftSide(p2)) return [p1, p2];
    if (isLeftSide(p2) && !isLeftSide(p1)) return [p2, p1];
    if (isRightSide(p1) && !isRightSide(p2)) return [p2, p1];
    if (isRightSide(p2) && !isRightSide(p1)) return [p1, p2];
    // D:[0,4] -> arriba en derecho, abajo en izquierdo
    if (p1 === 0 && p2 === 4) return [0, 4];
    if (p1 === 4 && p2 === 0) return [0, 4];
    return [p1, p2];
  };

  const buildSemaphoreSvg = (letter, size = 76) => {
    const ch = letter === "Ñ" ? "N" : letter;
    const pair = SEMAPHORE_MAP[ch] || [0, 0];
    const [leftPos, rightPos] = assignSemaphoreShoulders(pair[0], pair[1]);
    const colorB = semaRedWhite ? "#ffffff" : "#facc15";

    // Cuerpo centrado en (55, 52), cabeza en (55, 31) para dejar espacio limpio arriba (pos 4) y abajo (pos 0)
    const drawFlagArm = (pos, isLeftShoulder, armIdx) => {
      const shX = isLeftShoulder ? 45 : 65;
      const shY = 44;
      let { dx, dy } = semaDirVec(pos);
      // En cruce al mismo lado (ej. H, I, O, W, X, Z), dar ligera separacion al brazo que cruza
      let reachArm = 18;
      if (pos === 0) {
        reachArm = 17;
      } else if (pos === 4) {
        reachArm = 22;
      }
      const handX = shX + dx * reachArm;
      const handY = shY + dy * reachArm;
      const tipX = shX + dx * (reachArm + 15);
      const tipY = shY + dy * (reachArm + 15);
      const basePoleX = shX + dx * (reachArm + 3);
      const basePoleY = shY + dy * (reachArm + 3);
      const flagSize = 14;
      // Perpendicular hacia abajo/afuera para que la bandera cuelgue del asta con claridad
      let px = -dy * flagSize;
      let py = dx * flagSize;
      if (pos === 0 || pos === 4) {
        px = isLeftShoulder ? -flagSize : flagSize;
        py = 0;
      } else if (py < 0) {
        px = -px;
        py = -py;
      }
      const pTopX = tipX;
      const pTopY = tipY;
      const pInX = basePoleX;
      const pInY = basePoleY;
      const pOutBaseX = basePoleX + px;
      const pOutBaseY = basePoleY + py;
      const pOutTipX = tipX + px;
      const pOutTipY = tipY + py;
      const strokeArm = armIdx === 0 ? "#0284c7" : "#7c3aed";

      return `
        <line x1="${shX}" y1="${shY}" x2="${handX.toFixed(1)}" y2="${handY.toFixed(1)}" stroke="${strokeArm}" stroke-width="4.2" stroke-linecap="round"/>
        <line x1="${handX.toFixed(1)}" y1="${handY.toFixed(1)}" x2="${tipX.toFixed(1)}" y2="${tipY.toFixed(1)}" stroke="#64748b" stroke-width="2.2" stroke-linecap="round"/>
        <polygon points="${pInX.toFixed(1)},${pInY.toFixed(1)} ${pTopX.toFixed(1)},${pTopY.toFixed(1)} ${pOutTipX.toFixed(1)},${pOutTipY.toFixed(1)}" fill="#ef4444" stroke="#0f172a" stroke-width="0.9" stroke-linejoin="round"/>
        <polygon points="${pInX.toFixed(1)},${pInY.toFixed(1)} ${pOutBaseX.toFixed(1)},${pOutBaseY.toFixed(1)} ${pOutTipX.toFixed(1)},${pOutTipY.toFixed(1)}" fill="${colorB}" stroke="#0f172a" stroke-width="0.9" stroke-linejoin="round"/>
        <circle cx="${handX.toFixed(1)}" cy="${handY.toFixed(1)}" r="2.2" fill="currentColor"/>
      `;
    };

    const crossBothLeft = pair[0] >= 1 && pair[0] <= 3 && pair[1] >= 1 && pair[1] <= 3;
    const crossBothRight = pair[0] >= 5 && pair[0] <= 7 && pair[1] >= 5 && pair[1] <= 7;
    const arm1 = drawFlagArm(leftPos, !crossBothRight, 0);
    const arm2 = drawFlagArm(rightPos, crossBothLeft, 1);

    return `<svg width="${size}" height="${Math.round(size * 0.94)}" viewBox="0 0 110 104" fill="none" aria-hidden="true">
      <circle cx="55" cy="31" r="7.5" fill="currentColor" opacity="0.92"/>
      <rect x="46" y="42" width="18" height="27" rx="5" fill="currentColor" opacity="0.86"/>
      <polygon points="48,42 62,42 55,52" fill="#0ea5e9"/>
      <line x1="50" y1="69" x2="48" y2="94" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/>
      <line x1="60" y1="69" x2="62" y2="94" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/>
      ${arm1}
      ${arm2}
    </svg>`;
  };

  const MORSE_MAP = {
    A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
    I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", "Ñ": "--.--", O: "---",
    P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--",
    X: "-..-", Y: "-.--", Z: "--..",
    "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
    "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----."
  };
  const MORSE_REV = Object.fromEntries(Object.entries(MORSE_MAP).map(([k, v]) => [v, k]));

  const MURCIELAGO_EN = { M: "0", U: "1", R: "2", C: "3", I: "4", E: "5", L: "6", A: "7", G: "8", O: "9" };
  const MURCIELAGO_DE = Object.fromEntries(Object.entries(MURCIELAGO_EN).map(([k, v]) => [v, k]));

  const AGUJERITO_EN = { A: "1", G: "2", U: "3", J: "4", E: "5", R: "6", I: "7", T: "8", O: "9" };
  const AGUJERITO_DE = Object.fromEntries(Object.entries(AGUJERITO_EN).map(([k, v]) => [v, k]));

  const pairTable = (pairs) => {
    const map = {};
    for (const [a, b] of pairs) {
      map[a] = b;
      map[b] = a;
    }
    return map;
  };
  const PAIR_CIPHERS = {
    badenpowell: pairTable([["B", "P"], ["A", "O"], ["D", "W"], ["N", "L"]]),
    sufamelico: pairTable([["S", "U"], ["F", "A"], ["M", "E"], ["L", "I"], ["C", "O"]]),
    parelinofu: pairTable([["P", "A"], ["R", "E"], ["L", "I"], ["N", "O"], ["F", "U"]]),
    cenit: pairTable([["C", "P"], ["E", "O"], ["N", "L"], ["I", "A"], ["T", "R"]]),
    dametupico: pairTable([["D", "A"], ["M", "E"], ["T", "U"], ["P", "I"], ["C", "O"]])
  };
  const PAIR_CHIPS = {
    badenpowell: [["B", "P"], ["A", "O"], ["D", "W"], ["E", "E"], ["N", "L"]],
    sufamelico: [["S", "U"], ["F", "A"], ["M", "E"], ["L", "I"], ["C", "O"]],
    parelinofu: [["P", "A"], ["R", "E"], ["L", "I"], ["N", "O"], ["F", "U"]],
    cenit: [["C", "P"], ["E", "O"], ["N", "L"], ["I", "A"], ["T", "R"]],
    dametupico: [["D", "A"], ["M", "E"], ["T", "U"], ["P", "I"], ["C", "O"]]
  };

  // PIGPEN (Imagen 6 exacta: # pares AB..QR + X pares ST, UV, WX, YZ)
  const PIGPEN_MAP = {
    A: { t: "box", walls: ["B", "R"], dot: false },
    B: { t: "box", walls: ["B", "R"], dot: true },
    C: { t: "box", walls: ["L", "B", "R"], dot: false },
    D: { t: "box", walls: ["L", "B", "R"], dot: true },
    E: { t: "box", walls: ["L", "B"], dot: false },
    F: { t: "box", walls: ["L", "B"], dot: true },
    G: { t: "box", walls: ["T", "R", "B"], dot: false },
    H: { t: "box", walls: ["T", "R", "B"], dot: true },
    I: { t: "box", walls: ["T", "R", "B", "L"], dot: false },
    J: { t: "box", walls: ["T", "R", "B", "L"], dot: true },
    K: { t: "box", walls: ["T", "L", "B"], dot: false },
    L: { t: "box", walls: ["T", "L", "B"], dot: true },
    M: { t: "box", walls: ["T", "R"], dot: false },
    N: { t: "box", walls: ["T", "R"], dot: true },
    O: { t: "box", walls: ["L", "T", "R"], dot: false },
    P: { t: "box", walls: ["L", "T", "R"], dot: true },
    Q: { t: "box", walls: ["L", "T"], dot: false },
    R: { t: "box", walls: ["L", "T"], dot: true },
    S: { t: "x", dir: "T", dot: false },
    T: { t: "x", dir: "T", dot: true },
    U: { t: "x", dir: "L", dot: false },
    V: { t: "x", dir: "L", dot: true },
    W: { t: "x", dir: "R", dot: false },
    X: { t: "x", dir: "R", dot: true },
    Y: { t: "x", dir: "B", dot: false },
    Z: { t: "x", dir: "B", dot: true }
  };

  // GATO (Imagen 1: 3x3 #, 3 letras por casilla: ABC|DEF|GHI / JKL|MNÑ|OPQ / RST|UVW|XYZ)
  const GATO_CELLS = [
    ["A", "B", "C", ["B", "R"]],
    ["D", "E", "F", ["L", "B", "R"]],
    ["G", "H", "I", ["L", "B"]],
    ["J", "K", "L", ["T", "R", "B"]],
    ["M", "N", "Ñ", ["T", "R", "B", "L"]],
    ["O", "P", "Q", ["T", "L", "B"]],
    ["R", "S", "T", ["T", "R"]],
    ["U", "V", "W", ["L", "T", "R"]],
    ["X", "Y", "Z", ["L", "T"]]
  ];
  const GATO_MAP = {};
  GATO_CELLS.forEach(([l0, l1, l2, walls]) => {
    GATO_MAP[l0] = { walls, slot: 0 };
    GATO_MAP[l1] = { walls, slot: 1 };
    GATO_MAP[l2] = { walls, slot: 2 };
  });

  const drawWallsGlyph = (spec, dotCoords, size = 50) => {
    const parts = [];
    if (spec.t === "x") {
      if (spec.dir === "T") parts.push(`<polyline points="12,14 30,34 48,14"/>`);
      if (spec.dir === "B") parts.push(`<polyline points="12,46 30,26 48,46"/>`);
      if (spec.dir === "L") parts.push(`<polyline points="14,12 34,30 14,48"/>`);
      if (spec.dir === "R") parts.push(`<polyline points="46,12 26,30 46,48"/>`);
    } else {
      if (spec.walls.includes("T")) parts.push(`<line x1="12" y1="12" x2="48" y2="12"/>`);
      if (spec.walls.includes("B")) parts.push(`<line x1="12" y1="48" x2="48" y2="48"/>`);
      if (spec.walls.includes("L")) parts.push(`<line x1="12" y1="12" x2="12" y2="48"/>`);
      if (spec.walls.includes("R")) parts.push(`<line x1="48" y1="12" x2="48" y2="48"/>`);
    }
    if (dotCoords) {
      parts.push(`<circle cx="${dotCoords[0]}" cy="${dotCoords[1]}" r="3.6" fill="#0284c7" stroke="none"/>`);
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${parts.join("")}</svg>`;
  };

  const buildPigpenSvg = (ch, size = 48) => {
    const k = ch === "Ñ" ? "N" : ch;
    const sp = PIGPEN_MAP[k];
    if (!sp) return "";
    let dot = null;
    if (sp.dot) {
      if (sp.t === "box") dot = [30, 30];
      else dot = sp.dir === "T" ? [30, 20] : sp.dir === "B" ? [30, 40] : sp.dir === "L" ? [20, 30] : [40, 30];
    }
    return drawWallsGlyph(sp, dot, size);
  };

  const buildGatoSvg = (ch, size = 48) => {
    const sp = GATO_MAP[ch];
    if (!sp) return "";
    const xs = [21, 30, 39];
    return drawWallsGlyph({ t: "box", walls: sp.walls }, [xs[sp.slot], 30], size);
  };

  const buildPigpenMasterSvg = () => `
    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:1.25rem;align-items:center;">
      <svg width="165" height="165" viewBox="0 0 150 150" aria-label="Rejilla Pigpen">#
        <g stroke="currentColor" stroke-width="2.5">
          <line x1="50" y1="12" x2="50" y2="138"/><line x1="100" y1="12" x2="100" y2="138"/>
          <line x1="12" y1="50" x2="138" y2="50"/><line x1="12" y1="100" x2="138" y2="100"/>
        </g>
        <g fill="currentColor" font-size="14" font-weight="800" text-anchor="middle">
          <text x="31" y="36">A B</text><text x="75" y="36">C D</text><text x="119" y="36">E F</text>
          <text x="31" y="80">G H</text><text x="75" y="80">I J</text><text x="119" y="80">K L</text>
          <text x="31" y="124">M N</text><text x="75" y="124">O P</text><text x="119" y="124">Q R</text>
        </g>
      </svg>
      <svg width="135" height="135" viewBox="0 0 120 120" aria-label="Equis Pigpen">
        <g stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="18" x2="102" y2="102"/><line x1="102" y1="18" x2="18" y2="102"/>
        </g>
        <g fill="currentColor" font-size="13" font-weight="800" text-anchor="middle">
          <text x="60" y="34">S T</text>
          <text x="29" y="64">U V</text>
          <text x="91" y="64">W X</text>
          <text x="60" y="96">Y Z</text>
        </g>
      </svg>
    </div>
    <p class="bt-ejes-helper-note" style="margin:0;">1.ª letra de cada cuadro sin punto · 2.ª letra lleva punto al centro (Ñ se sustituye por N).</p>
  `;

  const buildGatoMasterSvg = () => `
    <svg width="180" height="165" viewBox="0 0 165 150" aria-label="Cuadrícula Clave Gato">
      <g stroke="currentColor" stroke-width="2.5">
        <line x1="55" y1="10" x2="55" y2="140"/><line x1="110" y1="10" x2="110" y2="140"/>
        <line x1="10" y1="53" x2="155" y2="53"/><line x1="10" y1="97" x2="155" y2="97"/>
      </g>
      <g fill="currentColor" font-size="13" font-weight="800" text-anchor="middle">
        <text x="32" y="36">ABC</text><text x="82" y="36">DEF</text><text x="132" y="36">GHI</text>
        <text x="32" y="80">JKL</text><text x="82" y="80">MNÑ</text><text x="132" y="80">OPQ</text>
        <text x="32" y="124">RST</text><text x="82" y="124">UVW</text><text x="132" y="124">XYZ</text>
      </g>
    </svg>
    <p class="bt-ejes-helper-note" style="margin:0;">1.ª letra: punto izquierda · 2.ª letra: punto centro · 3.ª letra: punto derecha.</p>
  `;

  // BRÚJULA (Imágenes 4 y 5 exactas: N1=A..N9=6, E1=B..E9=7, S1=C..S9=8, O1=D..O9=9)
  const BRUJULA_EN = {};
  const BRUJULA_DE = {};
  const BRUJULA_CHARS = [...ALPH_27, "1", "2", "3", "4", "5", "6", "7", "8", "9"]; // 36 chars exactos
  ["N", "E", "S", "O"].forEach((dir, dIdx) => {
    for (let num = 1; num <= 9; num++) {
      const ch = BRUJULA_CHARS[(num - 1) * 4 + dIdx];
      const code = `${dir}${num}`;
      BRUJULA_EN[ch] = code;
      BRUJULA_DE[code] = ch;
    }
  });

  const buildBrujulaMasterSvg = () => `
    <svg width="290" height="190" viewBox="0 0 320 210" aria-label="Tabla cruz Clave Brújula">
      <line x1="160" y1="26" x2="160" y2="184" stroke="currentColor" stroke-width="2.4"/>
      <line x1="74" y1="105" x2="246" y2="105" stroke="currentColor" stroke-width="2.4"/>
      <polygon points="160,18 155,28 165,28" fill="#ef4444"/>
      <polygon points="160,192 155,182 165,182" fill="currentColor"/>
      <polygon points="254,105 244,100 244,110" fill="currentColor"/>
      <polygon points="66,105 76,100 76,110" fill="currentColor"/>
      <g fill="currentColor" font-size="11" font-weight="800" text-anchor="middle">
        <text x="160" y="14" fill="#ef4444">N · 1A 2E 3I 4M 5P 6T 7X 8(2) 9(6)</text>
        <text x="160" y="205">S · 1C 2G 3K 4Ñ 5R 6V 7Z 8(4) 9(8)</text>
      </g>
      <g fill="currentColor" font-size="10.5" font-weight="800">
        <text x="10" y="88">O (1–9):</text>
        <text x="10" y="102">D H L O S W 1 5 9</text>
        <text x="242" y="88">E (1–9):</text>
        <text x="242" y="102">B F J N Q U Y 3 7</text>
      </g>
    </svg>
  `;

  const buildCriptografoWheelSvg = (shiftVal) => {
    const cx = 125;
    const cy = 125;
    const outerR = 112;
    const midR = 82;
    const innerR = 54;
    const stepDeg = 360 / ALPH_27.length;
    const rotDeg = (-shiftVal * stepDeg).toFixed(2);
    const outerLabels = ALPH_27.map((ch, i) => {
      const rad = ((i * stepDeg - 90) * Math.PI) / 180;
      const x = cx + Math.cos(rad) * ((outerR + midR) / 2);
      const y = cy + Math.sin(rad) * ((outerR + midR) / 2) + 3.5;
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="900" fill="#0f172a">${ch}</text>`;
    }).join("");
    const innerLabels = ALPH_27.map((ch, i) => {
      const idxOut = (i - shiftVal + ALPH_27.length) % ALPH_27.length;
      const rad = ((idxOut * stepDeg - 90) * Math.PI) / 180;
      const x = cx + Math.cos(rad) * ((midR + innerR) / 2);
      const y = cy + Math.sin(rad) * ((midR + innerR) / 2) + 3.5;
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="9" font-weight="800" fill="#ffffff">${ch}</text>`;
    }).join("");
    return `<svg width="240" height="240" viewBox="0 0 250 250" aria-label="Rueda Criptógrafo de 27 letras">
      <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="#fde047" stroke="#0f172a" stroke-width="2"/>
      <circle cx="${cx}" cy="${cy}" r="${midR}" fill="#16a34a" stroke="#0f172a" stroke-width="2"/>
      <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#0f172a" stroke="#ffffff" stroke-width="2"/>
      ${outerLabels}
      ${innerLabels}
      <circle cx="${cx}" cy="${cy}" r="14" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.5"/>
      <text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="9" font-weight="900" fill="#0f172a">${shiftVal}</text>
    </svg><p class="bt-ejes-helper-note" style="margin:0;">Exterior amarillo: letra normal · Interior verde (${rotDeg}°): clave (A → ${ALPH_27[shiftVal % 27]}).</p>`;
  };

  let cipherKind = "semaforo";
  let cipherDecodeMode = false;
  let morseSlow = false;
  let criptoShift = 26; // A->Z, SCOUT->RBÑTS como Imagen 7
  let keywordValue = "CLARINET"; // CLARINET como Imagen 4
  let lastCipherCopyStr = "";

  const cipherInputEl = document.getElementById("btCipherTextInput");
  const cipherOutEl = document.getElementById("btCipherOutputArea");
  const cipherMasterEl = document.getElementById("btCipherMasterDiagram");
  const cipherExtraEl = document.getElementById("btCipherExtraWrap");
  const cipherRefEl = document.getElementById("btCipherRefArea");
  const cipherDirBtn = document.getElementById("btCipherDirToggle");
  const semaStyleBtn = document.getElementById("btSemaFlagStyleBtn");
  const morsePlayBtn = document.getElementById("btMorsePlayBtn");
  const morseSpeedBtn = document.getElementById("btMorseSpeedBtn");
  const morseLampEl = document.getElementById("btMorseLamp");

  const buildKeywordAlphabet = (kw) => {
    const clean = upperNoAccentKeepN(kw).replace(/[^A-ZÑ]/g, "");
    const out = [];
    const used = new Set();
    for (const c of clean) {
      if (ALPH_27.includes(c) && !used.has(c)) {
        used.add(c);
        out.push(c);
      }
    }
    for (const c of ALPH_27) {
      if (!used.has(c)) {
        used.add(c);
        out.push(c);
      }
    }
    return out;
  };

  const buildSpiralGrid = (cleanText) => {
    const chars = Array.from(cleanText);
    const n = chars.length;
    if (!n) return { side: 1, rows: [[""]], centerR: 0, centerC: 0 };
    let side = Math.ceil(Math.sqrt(n));
    if (side % 2 === 0) side++;
    const grid = Array.from({ length: side }, () => Array(side).fill(""));
    const cr = Math.floor(side / 2);
    const cc = Math.floor(side / 2);
    let r = cr;
    let c = cc;
    let idx = 0;
    grid[r][c] = chars[idx++];
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    let d = 0;
    let stepLen = 1;
    while (idx < n) {
      for (let repStep = 0; repStep < 2 && idx < n; repStep++) {
        const [dr, dc] = dirs[d % 4];
        for (let s = 0; s < stepLen && idx < n; s++) {
          r += dr;
          c += dc;
          if (r >= 0 && r < side && c >= 0 && c < side) {
            grid[r][c] = chars[idx++];
          }
        }
        d++;
      }
      stepLen++;
    }
    return { side, rows: grid, centerR: cr, centerC: cc };
  };

  const renderMasterBox = (html) => {
    if (!cipherMasterEl) return;
    if (!html) {
      cipherMasterEl.classList.add("hidden");
      cipherMasterEl.innerHTML = "";
    } else {
      cipherMasterEl.innerHTML = html;
      cipherMasterEl.classList.remove("hidden");
    }
  };

  const renderCipher = () => {
    if (!cipherInputEl || !cipherOutEl || !cipherRefEl) return;
    const raw = cipherInputEl.value || "";
    const upperN = upperNoAccentKeepN(raw);
    const upperASCII = upperNoAccent(raw);

    const isMorse = cipherKind === "morse";
    const isSema = cipherKind === "semaforo";
    const noReverse = ["semaforo", "pigpen", "gato", "caracol"].includes(cipherKind);

    if (morsePlayBtn) morsePlayBtn.classList.toggle("hidden", !isMorse);
    if (morseSpeedBtn) morseSpeedBtn.classList.toggle("hidden", !isMorse);
    if (morseLampEl) morseLampEl.classList.toggle("hidden", !isMorse);
    if (semaStyleBtn) {
      semaStyleBtn.classList.toggle("hidden", !isSema);
      semaStyleBtn.textContent = semaRedWhite ? "Banderín: Rojo/Blanco" : "Banderín: Rojo/Amarillo";
    }
    if (cipherDirBtn) {
      cipherDirBtn.classList.toggle("hidden", noReverse);
      cipherDirBtn.textContent = cipherDecodeMode ? "Clave → Texto" : "Texto → Clave";
    }

    if (cipherExtraEl) {
      if (cipherKind === "criptografo") {
        cipherExtraEl.classList.remove("hidden");
        cipherExtraEl.innerHTML = `
          <span>Desplazamiento (A → ${ALPH_27[criptoShift % 27]}):</span>
          <button type="button" class="bt-sf-btn" id="btCriptoPrevBtn">-1</button>
          <input type="range" id="btCriptoRange" min="0" max="26" value="${criptoShift}" aria-label="Desplazamiento del criptógrafo" style="flex:1;min-width:120px;" />
          <button type="button" class="bt-sf-btn" id="btCriptoNextBtn">+1</button>
        `;
      } else if (cipherKind === "palabra_clave") {
        cipherExtraEl.classList.remove("hidden");
        cipherExtraEl.innerHTML = `
          <label for="btKeywordInput">Palabra clave:</label>
          <input type="text" id="btKeywordInput" class="bt-cipher-input" style="max-width:220px;min-height:36px;" maxlength="27" value="${escapeHtml(keywordValue)}" />
        `;
      } else {
        cipherExtraEl.classList.add("hidden");
        cipherExtraEl.innerHTML = "";
      }
    }

    if (cipherKind === "semaforo") {
      const chars = Array.from(upperASCII).filter((c) => SEMAPHORE_MAP[c]);
      if (!chars.length) {
        cipherOutEl.innerHTML = `<span class="bt-cipher-empty">Escribe letras A–Z para ver los banderines Semáforo.</span>`;
        lastCipherCopyStr = "";
      } else {
        lastCipherCopyStr = chars.join("");
        if (!SEMAPHORE_MAP[selectedSemaLetter]) {
          selectedSemaLetter = chars.find((c) => c !== " ") || "A";
        }
        cipherOutEl.innerHTML = `<div class="bt-cipher-svg-grid">${chars
          .map((ch) =>
            ch === " "
              ? `<div class="bt-cipher-space-sep" aria-hidden="true"></div>`
              : `<button type="button" class="bt-cipher-glyph-card ${ch === selectedSemaLetter ? "is-selected" : ""}" data-sema-focus="${ch}">${buildSemaphoreSvg(ch, 78)}<span>${ch}</span></button>`
          )
          .join("")}</div>`;
      }
      const pair = SEMAPHORE_MAP[selectedSemaLetter] || [0, 1];
      renderMasterBox(
        `<h4>Detalle Semáforo · Letra ${selectedSemaLetter}</h4><div style="color:inherit;">${buildSemaphoreSvg(selectedSemaLetter, 136)}</div><p class="bt-ejes-helper-note" style="margin:0;">Posiciones vista del receptor: <strong>${SEMA_POS_NAMES[pair[0]]}</strong> y <strong>${SEMA_POS_NAMES[pair[1]]}</strong>. Toca cualquier letra para inspeccionarla.</p>`
      );
      cipherRefEl.innerHTML = `<div class="bt-cipher-svg-grid">${Object.keys(SEMAPHORE_MAP)
        .filter((k) => k !== " ")
        .map((k) => `<button type="button" class="bt-cipher-glyph-card ${k === selectedSemaLetter ? "is-selected" : ""}" data-cipher-append="${k}" data-sema-focus="${k}" title="Insertar ${k}">${buildSemaphoreSvg(k, 56)}<span>${k}</span></button>`)
        .join("")}</div>`;
      return;
    }

    if (cipherKind === "pigpen") {
      const chars = Array.from(upperASCII).filter((c) => PIGPEN_MAP[c] || c === " ");
      lastCipherCopyStr = chars.join("");
      cipherOutEl.innerHTML = chars.length
        ? `<div class="bt-cipher-svg-grid">${chars
            .map((c) => (c === " " ? `<div class="bt-cipher-space-sep" aria-hidden="true"></div>` : `<div class="bt-cipher-glyph-card">${buildPigpenSvg(c)}<span>${c}</span></div>`))
            .join("")}</div>`
        : `<span class="bt-cipher-empty">Escribe letras A–Z para ver su símbolo Pigpen.</span>`;
      renderMasterBox(`<h4>Clave Pigpen (# y X)</h4>${buildPigpenMasterSvg()}`);
      cipherRefEl.innerHTML = `<div class="bt-cipher-svg-grid">${Object.keys(PIGPEN_MAP)
        .map((k) => `<button type="button" class="bt-cipher-glyph-card" data-cipher-append="${k}" title="Insertar ${k}">${buildPigpenSvg(k, 40)}<span>${k}</span></button>`)
        .join("")}</div>`;
      return;
    }

    if (cipherKind === "gato") {
      const chars = Array.from(upperN).filter((c) => GATO_MAP[c] || c === " ");
      lastCipherCopyStr = chars.join("");
      cipherOutEl.innerHTML = chars.length
        ? `<div class="bt-cipher-svg-grid">${chars
            .map((c) => (c === " " ? `<div class="bt-cipher-space-sep" aria-hidden="true"></div>` : `<div class="bt-cipher-glyph-card">${buildGatoSvg(c)}<span>${c}</span></div>`))
            .join("")}</div>`
        : `<span class="bt-cipher-empty">Escribe letras A–Z (incluye Ñ) para ver la Clave Gato.</span>`;
      renderMasterBox(`<h4>Clave Gato (3 letras por casilla)</h4>${buildGatoMasterSvg()}`);
      cipherRefEl.innerHTML = `<div class="bt-cipher-svg-grid">${ALPH_27.map(
        (k) => `<button type="button" class="bt-cipher-glyph-card" data-cipher-append="${k}" title="Insertar ${k}">${buildGatoSvg(k, 40)}<span>${k}</span></button>`
      ).join("")}</div>`;
      return;
    }

    if (cipherKind === "morse") {
      let out = "";
      let seq = "";
      if (!cipherDecodeMode) {
        out = Array.from(upperN)
          .map((c) => (c === " " ? "/" : MORSE_MAP[c] || ""))
          .filter(Boolean)
          .join(" ");
        seq = out;
      } else {
        out = String(raw || "")
          .trim()
          .split(/\s*\/\s*/)
          .map((w) => w.trim().split(/\s+/).map((m) => MORSE_REV[m] || "?").join(""))
          .join(" ");
        seq = String(raw || "");
      }
      lastCipherCopyStr = out;
      if (morsePlayBtn) morsePlayBtn.dataset.morseSeq = seq;
      renderMasterBox("");
      cipherOutEl.innerHTML = out
        ? `<div class="bt-cipher-text-result">${escapeHtml(out)}</div>`
        : `<span class="bt-cipher-empty">Escribe texto (o puntos y rayas separados por espacio).</span>`;
      cipherRefEl.innerHTML = Object.entries(MORSE_MAP)
        .map(([k, v]) => `<span class="bt-cipher-ref-chip"><strong>${k}</strong> <code>${v}</code></span>`)
        .join("");
      return;
    }

    if (cipherKind === "murcielago" || cipherKind === "agujerito") {
      const en = cipherKind === "murcielago" ? MURCIELAGO_EN : AGUJERITO_EN;
      const de = cipherKind === "murcielago" ? MURCIELAGO_DE : AGUJERITO_DE;
      const table = cipherDecodeMode ? de : en;
      const out = Array.from(upperN).map((c) => table[c] || c).join("");
      lastCipherCopyStr = out;
      renderMasterBox("");
      cipherOutEl.innerHTML = out
        ? `<div class="bt-cipher-text-result">${escapeHtml(out)}</div>`
        : `<span class="bt-cipher-empty">Escribe un mensaje para convertir.</span>`;
      cipherRefEl.innerHTML = Object.entries(en)
        .map(([k, v]) => `<span class="bt-cipher-ref-chip"><strong>${k}</strong> <code>${v}</code></span>`)
        .join("");
      return;
    }

    if (PAIR_CIPHERS[cipherKind]) {
      const table = PAIR_CIPHERS[cipherKind];
      const out = Array.from(upperN).map((c) => table[c] || c).join("");
      lastCipherCopyStr = out;
      renderMasterBox("");
      cipherOutEl.innerHTML = out
        ? `<div class="bt-cipher-text-result">${escapeHtml(out)}</div>`
        : `<span class="bt-cipher-empty">Escribe texto (clave simétrica: funciona igual de ida y vuelta).</span>`;
      cipherRefEl.innerHTML = (PAIR_CHIPS[cipherKind] || [])
        .map(([a, b]) => `<span class="bt-cipher-ref-chip"><strong>${a}</strong> <code>↔ ${b}</code></span>`)
        .join("");
      return;
    }

    if (cipherKind === "brujula") {
      let out = "";
      if (!cipherDecodeMode) {
        out = Array.from(upperN)
          .map((c) => (c === " " ? "/" : BRUJULA_EN[c] || c))
          .join(" ");
      } else {
        out = String(upperN || "")
          .trim()
          .split(/\s*\/\s*/)
          .map((w) => w.trim().split(/\s+/).map((tok) => BRUJULA_DE[tok] || tok).join(""))
          .join(" ");
      }
      lastCipherCopyStr = out;
      renderMasterBox(`<h4>Clave Brújula (N · E · S · O con números 1–9)</h4>${buildBrujulaMasterSvg()}`);
      cipherOutEl.innerHTML = out
        ? `<div class="bt-cipher-text-result">${escapeHtml(out)}</div>`
        : `<span class="bt-cipher-empty">Escribe texto o códigos como O5 S1 O4 E6 N6.</span>`;
      cipherRefEl.innerHTML = Object.entries(BRUJULA_EN)
        .map(([k, v]) => `<span class="bt-cipher-ref-chip"><strong>${k}</strong> <code>${v}</code></span>`)
        .join("");
      return;
    }

    if (cipherKind === "criptografo") {
      const dir = cipherDecodeMode ? -criptoShift : criptoShift;
      const out = Array.from(upperN)
        .map((c) => {
          const i = ALPH_27.indexOf(c);
          if (i < 0) return c;
          return ALPH_27[(i + dir + ALPH_27.length * 4) % ALPH_27.length];
        })
        .join("");
      lastCipherCopyStr = out;
      renderMasterBox(`<h4>Rueda Criptográfica Giratoria</h4>${buildCriptografoWheelSvg(criptoShift)}`);
      cipherOutEl.innerHTML = out
        ? `<div class="bt-cipher-text-result">${escapeHtml(out)}</div>`
        : `<span class="bt-cipher-empty">Escribe un mensaje para rotar sobre el alfabeto de 27 letras.</span>`;
      cipherRefEl.innerHTML = ALPH_27.map(
        (c, i) => `<span class="bt-cipher-ref-chip"><strong>${c}</strong> <code>${ALPH_27[(i + criptoShift) % 27]}</code></span>`
      ).join("");
      return;
    }

    if (cipherKind === "reverso") {
      const out = String(raw || "")
        .split(/\s+/)
        .map((w) => Array.from(w).reverse().join(""))
        .join(" ");
      lastCipherCopyStr = out;
      renderMasterBox("");
      cipherOutEl.innerHTML = out
        ? `<div class="bt-cipher-text-result">${escapeHtml(out)}</div>`
        : `<span class="bt-cipher-empty">Invierte el orden de las letras en cada palabra.</span>`;
      cipherRefEl.innerHTML = `<span class="bt-cipher-ref-chip">Ejemplo: <strong>SIEMPRE LISTO</strong> <code>ERPMEIS OTSIL</code></span>`;
      return;
    }

    if (cipherKind === "alfabeto_rev") {
      const rev27 = [...ALPH_27].reverse();
      const out = Array.from(upperN)
        .map((c) => {
          const i = ALPH_27.indexOf(c);
          return i >= 0 ? rev27[i] : c;
        })
        .join("");
      lastCipherCopyStr = out;
      renderMasterBox("");
      cipherOutEl.innerHTML = out
        ? `<div class="bt-cipher-text-result">${escapeHtml(out)}</div>`
        : `<span class="bt-cipher-empty">Alfabeto espejo A↔Z hasta N↔N y O↔M (con Ñ central).</span>`;
      cipherRefEl.innerHTML = ALPH_27.map(
        (c, i) => `<span class="bt-cipher-ref-chip"><strong>${c}</strong> <code>${rev27[i]}</code></span>`
      ).join("");
      return;
    }

    if (cipherKind === "alfabeto_med") {
      const out = Array.from(upperASCII)
        .map((c) => {
          const i = ALPH_26.indexOf(c);
          return i >= 0 ? ALPH_26[(i + 13) % 26] : c;
        })
        .join("");
      lastCipherCopyStr = out;
      renderMasterBox("");
      cipherOutEl.innerHTML = out
        ? `<div class="bt-cipher-text-result">${escapeHtml(out)}</div>`
        : `<span class="bt-cipher-empty">Divide A–M sobre N–Z (sin Ñ) de forma simétrica.</span>`;
      cipherRefEl.innerHTML = ALPH_26.slice(0, 13)
        .map((c, i) => `<span class="bt-cipher-ref-chip"><strong>${c}</strong> <code>↔ ${ALPH_26[i + 13]}</code></span>`)
        .join("");
      return;
    }

    if (cipherKind === "numeros") {
      let out = "";
      if (!cipherDecodeMode) {
        out = Array.from(upperN)
          .map((c) => {
            if (c === " ") return "/";
            const i = ALPH_27.indexOf(c);
            return i >= 0 ? String(i + 1) : c;
          })
          .join(" ");
      } else {
        out = String(raw || "")
          .trim()
          .split(/\s*\/\s*/)
          .map((w) =>
            w
              .trim()
              .split(/[\s,-]+/)
              .map((numStr) => {
                const n = Number(numStr);
                return n >= 1 && n <= 27 ? ALPH_27[n - 1] : numStr;
              })
              .join("")
          )
          .join(" ");
      }
      lastCipherCopyStr = out;
      renderMasterBox("");
      cipherOutEl.innerHTML = out
        ? `<div class="bt-cipher-text-result">${escapeHtml(out)}</div>`
        : `<span class="bt-cipher-empty">Convierte A=1 hasta Z=27 (con Ñ=15).</span>`;
      cipherRefEl.innerHTML = ALPH_27.map(
        (c, i) => `<span class="bt-cipher-ref-chip"><strong>${c}</strong> <code>${i + 1}</code></span>`
      ).join("");
      return;
    }

    if (cipherKind === "palabra_clave") {
      const codeAlph = buildKeywordAlphabet(keywordValue || "CLARINET");
      const out = Array.from(upperN)
        .map((c) => {
          if (!cipherDecodeMode) {
            const i = ALPH_27.indexOf(c);
            return i >= 0 ? codeAlph[i] : c;
          } else {
            const i = codeAlph.indexOf(c);
            return i >= 0 ? ALPH_27[i] : c;
          }
        })
        .join("");
      lastCipherCopyStr = out;
      renderMasterBox("");
      cipherOutEl.innerHTML = out
        ? `<div class="bt-cipher-text-result">${escapeHtml(out)}</div>`
        : `<span class="bt-cipher-empty">Escribe una palabra clave arriba (sin repetir) para armar el código.</span>`;
      cipherRefEl.innerHTML = ALPH_27.map(
        (c, i) => `<span class="bt-cipher-ref-chip"><strong>${c}</strong> <code>${codeAlph[i]}</code></span>`
      ).join("");
      return;
    }

    if (cipherKind === "bloque") {
      const clean = upperN.replace(/[^A-ZÑ0-9]/g, "");
      if (!clean.length) {
        lastCipherCopyStr = "";
        renderMasterBox("");
        cipherOutEl.innerHTML = `<span class="bt-cipher-empty">Escribe al menos 3 letras para formar el bloque de 3 filas.</span>`;
        cipherRefEl.innerHTML = "";
        return;
      }
      const rowsCount = 3;
      const cols = Math.ceil(clean.length / rowsCount);
      let out = "";
      let matrixRows = [];
      if (!cipherDecodeMode) {
        matrixRows = [
          clean.slice(0, cols).split(""),
          clean.slice(cols, cols * 2).split(""),
          clean.slice(cols * 2).split("")
        ];
        const colChunks = [];
        for (let c = 0; c < cols; c++) {
          let tok = "";
          for (let r = 0; r < rowsCount; r++) {
            if (matrixRows[r][c]) tok += matrixRows[r][c];
          }
          if (tok) colChunks.push(tok);
        }
        out = colChunks.join(" ");
      } else {
        matrixRows = [[], [], []];
        const rem = clean.length % rowsCount;
        const rowLens = [0, 1, 2].map((r) => Math.floor(clean.length / rowsCount) + (r < rem ? 1 : 0));
        let ptr = 0;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rowsCount; r++) {
            if (c < rowLens[r] && ptr < clean.length) matrixRows[r][c] = clean[ptr++];
          }
        }
        out = matrixRows.map((r) => r.join("")).join("");
      }
      lastCipherCopyStr = out;
      const matrixHtml = `<div class="bt-bloque-matrix" style="grid-template-columns:repeat(${cols}, 30px);">${matrixRows
        .flatMap((row) =>
          Array.from({ length: cols }, (_, ci) => `<span class="bt-spiral-cell">${escapeHtml(row[ci] || "·")}</span>`)
        )
        .join("")}</div>`;
      renderMasterBox(`<h4>Bloque rectangular (${rowsCount} filas × ${cols} columnas)</h4>${matrixHtml}`);
      cipherOutEl.innerHTML = `<div class="bt-cipher-text-result">${escapeHtml(out)}</div>`;
      cipherRefEl.innerHTML = `<span class="bt-cipher-ref-chip">Regla: <strong>escribe en 3 filas horizontales y lee en columnas verticales.</strong></span>`;
      return;
    }

    // CARACOL (Espiral desde el centro hacia afuera)
    const cleanCaracol = upperN.replace(/[^A-ZÑ0-9]/g, "");
    if (!cleanCaracol) {
      lastCipherCopyStr = "";
      renderMasterBox("");
      cipherOutEl.innerHTML = `<span class="bt-cipher-empty">Escribe un mensaje para dibujarlo en espiral Caracol desde el centro.</span>`;
      cipherRefEl.innerHTML = "";
      return;
    }
    const spiral = buildSpiralGrid(cleanCaracol);
    lastCipherCopyStr = spiral.rows.map((r) => r.map((x) => x || "·").join(" ")).join("\n");
    renderMasterBox("");
    cipherOutEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:0.45rem;">
        <div class="bt-spiral-grid" style="grid-template-columns:repeat(${spiral.side}, 30px);">
          ${spiral.rows
            .flatMap((row, r) =>
              row.map((cell, c) => {
                const isC = r === spiral.centerR && c === spiral.centerC;
                return `<span class="bt-spiral-cell ${isC ? "is-center" : ""}">${escapeHtml(cell || "·")}</span>`;
              })
            )
            .join("")}
        </div>
        <span class="bt-ejes-helper-note" style="margin:0;">Comienza en la casilla resaltada del centro y sigue en espiral de derecha a izquierda en sentido horario.</span>
      </div>`;
    cipherRefEl.innerHTML = `<span class="bt-cipher-ref-chip">Longitud: <strong>${cleanCaracol.length}</strong> caracteres en rejilla <code>${spiral.side}×${spiral.side}</code></span>`;
  };

  const cipherPillsEl = document.getElementById("btCipherTypePills");
  if (cipherPillsEl) {
    cipherPillsEl.addEventListener("click", (e) => {
      const pill = e.target.closest("[data-cipher-kind]");
      if (!pill) return;
      stopSkillAudio();
      cipherKind = pill.getAttribute("data-cipher-kind") || "semaforo";
      cipherPillsEl.querySelectorAll("[data-cipher-kind]").forEach((p) => {
        p.classList.toggle("is-active", p === pill);
      });
      renderCipher();
    });
  }
  if (cipherInputEl) cipherInputEl.addEventListener("input", renderCipher);
  if (cipherOutEl) {
    cipherOutEl.addEventListener("click", (e) => {
      const fBtn = e.target.closest("[data-sema-focus]");
      if (!fBtn) return;
      selectedSemaLetter = fBtn.getAttribute("data-sema-focus") || "S";
      renderCipher();
    });
  }
  if (cipherRefEl) {
    cipherRefEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cipher-append]");
      if (!btn || !cipherInputEl) return;
      const ch = btn.getAttribute("data-cipher-append");
      if (btn.hasAttribute("data-sema-focus")) selectedSemaLetter = btn.getAttribute("data-sema-focus");
      cipherInputEl.value = (cipherInputEl.value || "") + ch;
      renderCipher();
    });
  }
  if (cipherExtraEl) {
    cipherExtraEl.addEventListener("click", (e) => {
      if (e.target.id === "btCriptoPrevBtn") {
        criptoShift = (criptoShift + 26) % 27;
        renderCipher();
      } else if (e.target.id === "btCriptoNextBtn") {
        criptoShift = (criptoShift + 1) % 27;
        renderCipher();
      }
    });
    cipherExtraEl.addEventListener("input", (e) => {
      if (e.target.id === "btCriptoRange") {
        criptoShift = Number(e.target.value || 0);
        renderCipher();
      } else if (e.target.id === "btKeywordInput") {
        keywordValue = e.target.value || "CLARINET";
        renderCipher();
      }
    });
  }
  if (semaStyleBtn) {
    semaStyleBtn.addEventListener("click", () => {
      semaRedWhite = !semaRedWhite;
      renderCipher();
    });
  }
  if (cipherDirBtn) {
    cipherDirBtn.addEventListener("click", () => {
      cipherDecodeMode = !cipherDecodeMode;
      renderCipher();
    });
  }
  if (morsePlayBtn) {
    morsePlayBtn.addEventListener("click", () => {
      if (morsePlayBtn.dataset.playing === "1") {
        stopSkillAudio();
        return;
      }
      playToneSequence(morsePlayBtn.dataset.morseSeq || "", "morse", { slow: morseSlow });
    });
  }
  if (morseSpeedBtn) {
    morseSpeedBtn.addEventListener("click", () => {
      morseSlow = !morseSlow;
      morseSpeedBtn.textContent = morseSlow ? "Lento" : "Normal";
    });
  }
  const cipherCopyBtn = document.getElementById("btCipherCopyBtn");
  if (cipherCopyBtn) {
    cipherCopyBtn.addEventListener("click", async () => {
      if (!lastCipherCopyStr) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(lastCipherCopyStr);
          showWebToast("Resultado copiado.");
        }
      } catch (_) {
        showWebToast("No se pudo copiar.");
      }
    });
  }
  const cipherPrintBtn = document.getElementById("btCipherPrintBtn");
  if (cipherPrintBtn) {
    cipherPrintBtn.addEventListener("click", () => {
      document.documentElement.classList.add("bt-print-rally-mode");
      const cleanup = () => document.documentElement.classList.remove("bt-print-rally-mode");
      window.addEventListener("afterprint", cleanup, { once: true });
      setTimeout(cleanup, 2000);
      window.print();
    });
  }
  renderCipher();

  // --------------------------------------------------------------------------
  // 2. NUDOS Y AMARRES SVG 3D FIELES A LA CABUYERÍA SCOUT (viewBox 280x150)
  // --------------------------------------------------------------------------
  const rope = (d, col, w = 8) =>
    `<path d="${d}" stroke="var(--bt-stage-bg, #ffffff)" stroke-width="${w + 5.2}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" stroke="rgba(255,255,255,0.32)" stroke-width="${Math.max(1.8, w - 5)}" stroke-dasharray="2.2 6" fill="none" stroke-linecap="round"/>`;

  const arrowPath = (d, col = "#38bdf8") =>
    `<path d="${d}" stroke="${col}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-dasharray="4 3" marker-end="url(#btKnotArrow)"/>`;

  const timber = (x1, y1, x2, y2, w = 20) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#6c2e0c" stroke-width="${w}" stroke-linecap="round"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#a1551c" stroke-width="${w - 4}" stroke-linecap="round"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c27834" stroke-opacity="0.45" stroke-width="${Math.max(2, w - 11)}" stroke-linecap="round"/>`;

  const labelTag = (x, y, txt) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-size="10" font-weight="800" fill="currentColor" opacity="0.82">${txt}</text>`;

  const ROPE_A = "#7c3aed";
  const ROPE_B = "#f59e0b";

  const KNOTS_DATA = [
    {
      id: "rizo",
      name: "Nudo Rizo (Llano)",
      cat: "unir",
      catLabel: "Unir",
      use: "Unir dos cabos del mismo grosor y material; queda plano y se desata fácil.",
      steps: [
        {
          tip: "Cruza el cabo derecho (dorado) por encima del izquierdo (morado) y mételo por debajo para el primer medio nudo.",
          svg:
            rope("M26 50 C76 50 96 100 132 100 C166 100 184 52 246 52", ROPE_A) +
            rope("M254 100 C200 100 182 52 134 52 C98 52 80 100 32 100", ROPE_B) +
            arrowPath("M188 36 C168 24 146 24 128 38", ROPE_B) +
            labelTag(46, 36, "Izq.") +
            labelTag(234, 118, "Der.")
        },
        {
          tip: "Ahora cruza el chicote izquierdo (dorado arriba) por encima del derecho y pásalo hacia arriba por el bucle.",
          svg:
            rope("M26 102 C78 102 98 52 136 52 C172 52 190 98 250 98", ROPE_B) +
            rope("M250 48 C196 48 176 96 136 96 C100 96 76 48 26 48", ROPE_A) +
            rope("M108 42 C132 62 150 62 172 42", ROPE_B, 7.5) +
            arrowPath("M140 24 C140 34 140 52 140 66", "#38bdf8")
        },
        {
          tip: "Jala parejo: cada seno abraza al otro en espejo y las puntas salen paralelas a su propio firme.",
          svg:
            rope("M256 64 H150", ROPE_B) +
            rope("M150 86 H256", ROPE_B) +
            rope("M24 46 H154 C188 46 188 104 154 104 H24", ROPE_A) +
            rope("M152 64 C132 64 134 34 114 34 C94 34 94 116 114 116 C134 116 132 86 152 86", ROPE_B) +
            labelTag(56, 32, "Firme + punta") +
            labelTag(224, 32, "Firme + punta")
        }
      ]
    },
    {
      id: "escota",
      name: "Vuelta de Escota",
      cat: "unir",
      catLabel: "Unir",
      use: "Unir dos cuerdas de diferente grosor o cuerdas húmedas que van a soportar tensión.",
      steps: [
        {
          tip: "Haz un seno en U con la cuerda más gruesa (morada) y sube la punta delgada (dorada) desde abajo por dentro del seno.",
          svg:
            rope("M150 132 C150 112 150 88 150 72", ROPE_B, 6) +
            rope("M26 46 H154 C194 46 194 104 154 104 H26", ROPE_A, 10) +
            arrowPath("M150 66 L132 34", ROPE_B) +
            labelTag(72, 32, "Cabo grueso") +
            labelTag(196, 134, "Cabo delgado")
        },
        {
          tip: "Rodea por completo las dos ramas de la U (por arriba y por detrás hacia abajo).",
          svg:
            rope("M148 134 V74", ROPE_B, 6) +
            rope("M110 38 C98 58 98 94 112 114", ROPE_B, 6) +
            rope("M26 46 H154 C194 46 194 104 154 104 H26", ROPE_A, 10) +
            rope("M148 74 C144 40 122 26 110 38", ROPE_B, 6) +
            arrowPath("M114 118 L156 96", ROPE_B)
        },
        {
          tip: "Mete el chicote delgado por debajo de su propio cuerpo frente a la U y tensa ambos firmes.",
          svg:
            rope("M148 136 V74", ROPE_B, 6) +
            rope("M110 38 C96 58 96 92 110 114", ROPE_B, 6) +
            rope("M24 46 H154 C196 46 196 104 154 104 H24", ROPE_A, 10) +
            rope("M148 74 C144 40 122 26 110 38", ROPE_B, 6) +
            rope("M110 114 C122 122 138 112 140 88", ROPE_B, 6) +
            rope("M148 74 V136", ROPE_B, 6) +
            rope("M140 88 C134 74 96 74 58 75", ROPE_B, 6)
        }
      ]
    },
    {
      id: "pescador",
      name: "Nudo Pescador",
      cat: "unir",
      catLabel: "Unir",
      use: "Unir cabos resbaladizos o delgados con dos nudos simples corredizos que chocan entre sí.",
      steps: [
        {
          tip: "Superpone ambas puntas en sentidos opuestos paralelas entre sí.",
          svg:
            rope("M22 54 H216", ROPE_A) +
            rope("M64 96 H258", ROPE_B) +
            arrowPath("M82 114 L58 74", ROPE_B) +
            arrowPath("M198 36 L222 76", ROPE_A)
        },
        {
          tip: "Con cada punta ata un nudo simple (medio nudo) abrazando el cuerpo largo de la otra cuerda.",
          svg:
            rope("M20 56 H224", ROPE_A) +
            rope("M56 94 H260", ROPE_B) +
            rope("M100 38 C80 38 76 112 96 112 C110 112 114 48 96 42", ROPE_B, 6.5) +
            rope("M184 112 C204 112 208 38 188 38 C174 38 170 102 188 108", ROPE_A, 6.5)
        },
        {
          tip: "Jala ambos firmes hacia los lados hasta que los dos nudos simples queden juntos y bloqueados en el centro.",
          svg:
            rope("M18 75 H150", ROPE_A) +
            rope("M130 75 H262", ROPE_B) +
            rope("M126 44 C108 44 106 106 124 106 C138 106 138 56 120 48", ROPE_B, 7) +
            rope("M154 106 C172 106 174 44 156 44 C142 44 142 94 160 102", ROPE_A, 7) +
            labelTag(140, 26, "Se juntan al tensar")
        }
      ]
    },
    {
      id: "ballestrinque",
      name: "Ballestrinque",
      cat: "anclar",
      catLabel: "Anclar",
      use: "Anclar rápidamente a un bordón o tronco y para iniciar y cerrar casi todos los amarres.",
      steps: [
        {
          tip: "Da una vuelta al poste con el firme abajo, subiendo por detrás y cruzando en diagonal por encima hacia la derecha.",
          svg:
            rope("M116 54 V98", ROPE_A) +
            timber(26, 76, 254, 76, 24) +
            rope("M82 132 L116 98", ROPE_A) +
            rope("M104 98 L174 52", ROPE_A) +
            arrowPath("M176 48 C194 60 194 94 176 106", "#38bdf8")
        },
        {
          tip: "Rodea el tronco por detrás con la segunda vuelta paralela y pasa el chicote por el frente rumbo al puente diagonal.",
          svg:
            rope("M112 52 V98", ROPE_A) +
            rope("M174 52 V98", ROPE_A) +
            timber(26, 76, 254, 76, 24) +
            rope("M82 132 L112 98", ROPE_A) +
            rope("M102 98 L174 52", ROPE_A) +
            arrowPath("M172 110 C154 100 144 88 136 74", ROPE_B)
        },
        {
          tip: "Mete la punta por debajo del puente diagonal central y azoca jalando ambos extremos en sentido contrario.",
          svg:
            rope("M110 52 L118 98", ROPE_A) +
            rope("M174 52 V98", ROPE_A) +
            rope("M174 98 C162 88 144 74 142 22", ROPE_B) +
            timber(26, 76, 254, 76, 24) +
            rope("M78 130 L110 96", ROPE_A) +
            rope("M100 96 L176 54", ROPE_A) +
            labelTag(140, 128, "Dos vueltas paralelas + puente encima")
        }
      ]
    },
    {
      id: "as_guia",
      name: "As de Guía",
      cat: "tensar",
      catLabel: "Tensar",
      use: "Formar una gaza fija muy resistente (rescate o sujeción) que nunca se ahorca ni se corre.",
      steps: [
        {
          tip: "Forma un pequeño aro («el pozo») en el firme dejando que la curva superior pase por encima del tramo izquierdo.",
          svg:
            rope("M24 76 H112", ROPE_A) +
            rope("M112 76 C136 76 138 38 112 38 C88 38 88 76 116 76", ROPE_A) +
            rope("M116 76 C158 76 184 114 234 114", ROPE_B) +
            labelTag(60, 60, "El árbol (firme)") +
            labelTag(114, 24, "El pozo") +
            labelTag(224, 134, "La serpiente")
        },
        {
          tip: "Sube la punta («la serpiente») por dentro del pozo, rodea por detrás al firme y vuelve a bajar por el mismo pozo.",
          svg:
            rope("M24 76 H96", ROPE_A) +
            rope("M116 76 C138 76 138 40 114 40 C94 40 94 76 122 76 C192 76 238 118 202 126 C174 132 146 100 120 62", ROPE_A) +
            rope("M120 62 C110 42 74 42 74 76 C74 104 108 104 118 78", ROPE_B, 7) +
            arrowPath("M122 86 L146 106", ROPE_B)
        },
        {
          tip: "Sujeta punta y brazo derecho juntos y jala el firme izquierdo hasta apretar el cuello de la gaza fija.",
          svg:
            rope("M126 30 C248 30 248 122 126 122", ROPE_A) +
            rope("M24 76 H128 C148 76 148 40 126 40 C106 40 106 112 128 112 H174", ROPE_B) +
            rope("M126 30 C106 30 98 58 104 76", ROPE_A) +
            labelTag(214, 78, "Gaza fija")
        }
      ]
    },
    {
      id: "margarita",
      name: "Nudo Margarita",
      cat: "tensar",
      catLabel: "Tensar",
      use: "Acortar temporalmente una cuerda tensa sin cortarla o proteger una zona desgastada.",
      steps: [
        {
          tip: "Pliega la cuerda en tres tramos paralelos en forma de «S» alargada formando dos orejas.",
          svg:
            rope("M20 46 H204 C228 46 228 75 204 75 H76 C52 75 52 104 76 104 H260", ROPE_A) +
            labelTag(46, 80, "Oreja") +
            labelTag(234, 64, "Oreja")
        },
        {
          tip: "Con cada extremo largo forma un cote (medio nudo abierto) y mételo abrazando cada oreja sin soltar la S.",
          svg:
            rope("M76 48 H200 C226 48 226 75 200 75 H80 C54 75 54 102 80 102 H202", ROPE_A) +
            rope("M20 75 H62 C78 75 84 30 70 30 C56 30 56 120 70 120 C84 120 84 82 76 75", ROPE_B, 7) +
            rope("M260 75 H218 C202 75 196 30 210 30 C224 30 224 120 210 120 C196 120 196 82 204 75", ROPE_B, 7) +
            arrowPath("M48 36 L68 50", ROPE_B) +
            arrowPath("M232 36 L212 50", ROPE_B)
        },
        {
          tip: "Mantén tensión en ambos firmes: los cotes del propio cabo aprietan las dos orejas y el centro queda acortado.",
          svg:
            rope("M90 50 H190 M90 75 H190 M90 100 H190", ROPE_A, 7) +
            rope("M22 75 H60 C82 75 88 34 74 34 C60 34 60 116 74 116 C88 116 86 80 90 100", ROPE_A) +
            rope("M258 75 H220 C198 75 192 34 206 34 C220 34 220 116 206 116 C192 116 194 80 190 50", ROPE_A) +
            rope("M62 75 C42 75 42 50 74 50 H90 M218 75 C238 75 238 100 206 100 H190", ROPE_A)
        }
      ]
    },
    {
      id: "tensor",
      name: "Tensor de Viento",
      cat: "tensar",
      catLabel: "Tensar",
      use: "Ajustar la tensión de los vientos de la casa de campaña deslizándolo sin desatar.",
      steps: [
        {
          tip: "Rodea la estaca y regresa paralelo por debajo del cabo principal tenso.",
          svg:
            timber(226, 36, 240, 126, 14) +
            rope("M20 56 H226 C250 56 250 96 226 96 H94", ROPE_A) +
            arrowPath("M94 96 L94 42", ROPE_B)
        },
        {
          tip: "Da dos vueltas cerradas alrededor del cabo principal regresando dentro de la gaza hacia la casa de campaña.",
          svg:
            timber(226, 36, 240, 126, 14) +
            rope("M20 56 H226 C250 56 250 96 226 96 H124", ROPE_A) +
            rope("M126 42 C140 42 140 96 126 96", ROPE_B, 7) +
            rope("M106 42 C120 42 120 96 106 96", ROPE_B, 7) +
            arrowPath("M102 44 L76 44", ROPE_B)
        },
        {
          tip: "Saca la punta hacia la izquierda por fuera de las dos vueltas y cierra con un cote bloqueador.",
          svg:
            timber(226, 36, 240, 126, 14) +
            rope("M20 58 H226 C250 58 250 96 226 96 H138", ROPE_A) +
            rope("M134 44 C146 44 146 98 134 98", ROPE_B, 7) +
            rope("M116 44 C128 44 128 98 116 98", ROPE_B, 7) +
            rope("M84 44 C98 44 98 98 84 98 L64 82", ROPE_B, 7) +
            labelTag(110, 126, "2 vueltas dentro + 1 cote fuera")
        }
      ]
    },
    {
      id: "amarre_cuadrado",
      name: "Amarre Cuadrado",
      cat: "amarre",
      catLabel: "Amarres",
      use: "Unir dos troncos en cruz (90 grados) para soportar peso vertical en mesas y torres.",
      steps: [
        {
          tip: "Inicia con un ballestrinque en el tronco vertical justo por debajo del cruce.",
          svg:
            timber(140, 12, 140, 138, 22) +
            timber(30, 64, 250, 64, 20) +
            rope("M124 88 H156 M124 98 H156", ROPE_A, 6.5) +
            rope("M124 88 L156 104", ROPE_B, 6) +
            labelTag(200, 102, "Ballestrinque inicial")
        },
        {
          tip: "Pasa por delante del horizontal, por detrás del vertical y repite 3 vueltas paralelas ordenadas.",
          svg:
            timber(140, 12, 140, 138, 22) +
            rope("M108 42 H172 M108 90 H172", ROPE_A, 6) +
            timber(30, 64, 250, 64, 20) +
            rope("M110 44 V88 M118 42 V90 M170 44 V88 M162 42 V90", ROPE_A, 5.5) +
            labelTag(66, 114, "3 vueltas cuadradas")
        },
        {
          tip: "Ahorca dando 2–3 vueltas firmes entre ambos troncos apretando las amarras y cierra con ballestrinque.",
          svg:
            timber(140, 12, 140, 138, 22) +
            rope("M106 42 H174 M106 90 H174", ROPE_A, 5.5) +
            timber(30, 64, 250, 64, 20) +
            rope("M110 42 V90 M118 42 V90 M170 42 V90 M162 42 V90", ROPE_A, 5.5) +
            rope("M124 44 L124 88 M156 44 L156 88", ROPE_B, 5.5) +
            labelTag(206, 122, "Ahorcado en el centro")
        }
      ]
    },
    {
      id: "amarre_diagonal",
      name: "Amarre Diagonal",
      cat: "amarre",
      catLabel: "Amarres",
      use: "Unir dos troncos cruzados en X que trabajan bajo tensión y tienden a abrirse.",
      steps: [
        {
          tip: "Inicia con un nudo leñador abrazando ambos troncos justo en la horqueta abierta de la X.",
          svg:
            timber(48, 20, 232, 130, 20) +
            timber(232, 20, 48, 130, 20) +
            rope("M118 52 C140 36 140 114 118 98", ROPE_A, 6.5) +
            rope("M120 62 L144 88", ROPE_B, 6) +
            labelTag(206, 80, "Nudo leñador")
        },
        {
          tip: "Da 3 vueltas paralelas abrazando el eje vertical de la X y luego 3 vueltas por el eje horizontal.",
          svg:
            timber(48, 20, 232, 130, 20) +
            timber(232, 20, 48, 130, 20) +
            rope("M126 38 V112 M140 34 V116 M154 38 V112", ROPE_A, 5.5) +
            rope("M96 68 H184 M96 82 H184", ROPE_A, 5.5)
        },
        {
          tip: "Ahorca en círculo entre ambos troncos (2 vueltas apretadas) y remata con ballestrinque.",
          svg:
            timber(48, 20, 232, 130, 20) +
            timber(232, 20, 48, 130, 20) +
            rope("M126 38 V112 M140 34 V116 M154 38 V112", ROPE_A, 5.2) +
            rope("M98 68 H182 M98 82 H182", ROPE_A, 5.2) +
            rope("M114 54 H166 V96 H114 Z", ROPE_B, 6)
        }
      ]
    },
    {
      id: "amarre_tripode",
      name: "Amarre Trípode",
      cat: "amarre",
      catLabel: "Amarres",
      use: "Unir tres troncos paralelos para abrirlos luego en trípode estable (fogón, filtro o asta).",
      steps: [
        {
          tip: "Alinea los 3 troncos alternando sus extremos y amarra un ballestrinque en uno de los troncos exteriores.",
          svg:
            timber(30, 38, 250, 38, 14) +
            timber(24, 75, 244, 75, 14) +
            timber(34, 112, 254, 112, 14) +
            rope("M100 28 V48 M112 28 V48", ROPE_A, 6) +
            rope("M98 46 L116 30", ROPE_B, 5.5)
        },
        {
          tip: "Teje en forma de «8» pasando alternadamente por arriba y por debajo de cada tronco unas 5 veces sin apretar.",
          svg:
            timber(30, 38, 250, 38, 14) +
            timber(24, 75, 244, 75, 14) +
            timber(34, 112, 254, 112, 14) +
            rope("M108 26 C128 26 128 124 148 124 C168 124 168 26 188 26", ROPE_A, 6) +
            rope("M108 124 C128 124 128 26 148 26 C168 26 168 124 188 124", ROPE_B, 5.5)
        },
        {
          tip: "Ahorca entre cada par de troncos, cierra con ballestrinque en el tronco opuesto y abre las 3 patas.",
          svg:
            timber(140, 22, 62, 134, 14) +
            timber(140, 22, 140, 138, 14) +
            timber(140, 22, 218, 134, 14) +
            rope("M112 42 Q140 54 168 42", ROPE_A, 7) +
            rope("M118 32 V56 M162 32 V56", ROPE_B, 5.5) +
            labelTag(212, 54, "Abrir en 3 patas")
        }
      ]
    }
  ];

  let activeKnotCat = "all";
  const knotStepsState = {};
  const knotsGridEl = document.getElementById("btKnotsGrid");
  const knotFilterPillsEl = document.getElementById("btKnotFilterPills");

  const renderKnots = () => {
    if (!knotsGridEl) return;
    const filtered = activeKnotCat === "all" ? KNOTS_DATA : KNOTS_DATA.filter((k) => k.cat === activeKnotCat);
    knotsGridEl.innerHTML = filtered
      .map((k) => {
        const stIdx = Number(knotStepsState[k.id] || 0);
        const st = k.steps[stIdx] || k.steps[0];
        return `
          <article class="bt-knot-card" data-knot-id="${k.id}">
            <div class="bt-knot-top">
              <h4>${escapeHtml(k.name)}</h4>
              <span class="bt-knot-cat-badge">${escapeHtml(k.catLabel)}</span>
            </div>
            <div class="bt-knot-svg-stage">
              <svg viewBox="0 0 280 150" width="280" height="150" aria-hidden="true">
                <defs>
                  <marker id="btKnotArrow_${k.id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8"/>
                  </marker>
                </defs>
                ${st.svg.replaceAll("url(#btKnotArrow)", `url(#btKnotArrow_${k.id})`)}
              </svg>
            </div>
            <div class="bt-knot-steps-row" role="group" aria-label="Pasos de ${escapeHtml(k.name)}">
              ${["Paso 1", "Paso 2", "Listo"]
                .map(
                  (lbl, i) =>
                    `<button type="button" class="bt-knot-step-btn ${stIdx === i ? "is-active" : ""}" data-knot-step="${k.id}:${i}">${lbl}</button>`
                )
                .join("")}
            </div>
            <p class="bt-knot-tip"><strong>Uso:</strong> ${escapeHtml(k.use)}<br/><span>${escapeHtml(st.tip)}</span></p>
          </article>
        `;
      })
      .join("");
  };

  if (knotFilterPillsEl) {
    knotFilterPillsEl.addEventListener("click", (e) => {
      const pill = e.target.closest("[data-knot-cat]");
      if (!pill) return;
      activeKnotCat = pill.getAttribute("data-knot-cat") || "all";
      knotFilterPillsEl.querySelectorAll("[data-knot-cat]").forEach((p) => p.classList.toggle("is-active", p === pill));
      renderKnots();
    });
  }
  if (knotsGridEl) {
    knotsGridEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-knot-step]");
      if (!btn) return;
      const [id, idx] = (btn.getAttribute("data-knot-step") || "").split(":");
      knotStepsState[id] = Number(idx || 0);
      renderKnots();
    });
  }
  renderKnots();

  // --------------------------------------------------------------------------
  // 3. TU MOCHILA (Mochila anatómica SVG + Zone Pills + Peso real de ítems)
  // --------------------------------------------------------------------------
  const PACK_KEY = "bt_skills_pack_v1";
  let packState = { type: "campamento", climate: "templado", zone: "media", userKg: 55, checked: {} };
  try {
    const rawPack = localStorage.getItem(PACK_KEY);
    if (rawPack) {
      const parsed = JSON.parse(rawPack);
      if (parsed && typeof parsed === "object") packState = Object.assign(packState, parsed);
    }
  } catch (_) {}
  const savePack = () => {
    try {
      localStorage.setItem(PACK_KEY, JSON.stringify(packState));
    } catch (_) {}
  };

  const PACK_ZONES = {
    cabezal: {
      tip: "1. Cabezal (arriba): linterna frontal, mapa, silbato, bloqueador solar, pañuelos y snacks a la mano."
    },
    media: {
      tip: "2. Espalda / Peso medio: lo más pesado (agua, comida, estufa, casa) pegado a tu columna para mantener el equilibrio."
    },
    fondo: {
      tip: "3. Fondo (abajo): sleeping bag, colchoneta y pijama térmica dentro de bolsa seca hasta montar el campamento."
    },
    exterior: {
      tip: "4. Exterior y laterales: cantimplora, impermeable doblado, bastones o silbato para sacarlos sin desarmar todo."
    }
  };

  const PACK_LISTS = {
    campamento: [
      { id: "c_dormir", kg: 2.1, text: "Sleeping" },
      { id: "c_muda", kg: 1.8, text: "Cambios de ropa extra" },
      { id: "c_platos", kg: 0.4, text: "PVC (Plato, vaso y cuchara)" },
      { id: "c_cantimplora", kg: 1.0, text: "Botella de agua (1L)" },
      { id: "c_linterna", kg: 0.2, text: "Lámpara de cabeza/de mano" },
      { id: "c_higiene", kg: 0.5, text: "Kit de Higiene personal" },
      { id: "c_uniforme", kg: 0.6, text: "Uniforme completo" },
      { id: "c_bolsillo", kg: 0.3, text: "Equipo de bolsillo" }
    ],
    ataque: [
      { id: "a_agua", kg: 1.0, text: "Botella de agua (1L)" },
      { id: "a_snack", kg: 0.6, text: "Pequeño Lunch" },
      { id: "a_capa", kg: 0.5, text: "Chamarra ligera o rompevientos" },
      { id: "a_sol", kg: 0.2, text: "Gorra, bloqueador solar y lentes" },
      { id: "a_bolsillo", kg: 0.3, text: "Equipo de bolsillo completo" },
      { id: "a_bolsa", kg: 0.1, text: "Bolsa reutilizable para basura" }
    ],
    bolsillo: [
      { id: "b_equipo", kg: 0.2, text: "Equipo de bolsillo completo" },
      { id: "b_docs", kg: 0.12, text: "Agenda, credencial y ficha de salud" }
    ]
  };
  const CLIMATE_EXTRAS = {
    templado: [],
    lluvia: [
      { id: "cl_impermeable", kg: 0.45, text: "Chamarra o impermeable" }
    ],
    frio: [
      { id: "cf_manta", kg: 0.1, text: "Manta térmica" }
    ]
  };

  const packDiagEl = document.getElementById("btPackDiagramWrap");
  const packZonePillsEl = document.getElementById("btPackZonePills");
  const packZoneInfoEl = document.getElementById("btPackZoneInfo");
  const packListEl = document.getElementById("btPackChecklist");
  const packBadgeEl = document.getElementById("btPackCountBadge");
  const packWeightIn = document.getElementById("btUserWeightKg");
  const packWeightLbl = document.getElementById("btPackMaxWeightLabel");
  const packListTitleEl = document.getElementById("btPackListTitle");
  const packLoadBarEl = document.getElementById("btPackLoadBar");
  const packLoadStatusEl = document.getElementById("btPackLoadStatus");

  const renderPackDiagram = () => {
    if (!packDiagEl) return;
    const z = packState.zone || "media";
    const fCol = (id, col) => (z === id ? col : "rgba(148,163,184,0.18)");
    const sCol = (id, col) => (z === id ? col : "rgba(148,163,184,0.52)");

    packDiagEl.innerHTML = `
      <svg viewBox="0 0 280 265" width="248" height="232" role="img" aria-label="Anatomía interactiva de Tu Mochila">
        <!-- Asas superiores -->
        <path d="M112 24 C112 10 168 10 168 24" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round"/>
        <!-- Tirantes y espalda sugeridos detrás -->
        <path d="M90 36 C74 44 74 110 82 174" fill="none" stroke="currentColor" stroke-opacity="0.28" stroke-width="8" stroke-linecap="round"/>
        <path d="M190 36 C206 44 206 110 198 174" fill="none" stroke="currentColor" stroke-opacity="0.28" stroke-width="8" stroke-linecap="round"/>

        <!-- ZONA 4: BOLSILLOS EXTERIORES + CANTIMPLORA -->
        <g data-pack-zone="exterior" style="cursor:pointer;">
          <rect x="44" y="108" width="28" height="82" rx="11" fill="${fCol("exterior", "rgba(22,163,74,0.3)")}" stroke="${sCol("exterior", "#16a34a")}" stroke-width="2.6"/>
          <rect x="49" y="88" width="18" height="22" rx="5" fill="#0ea5e9" opacity="0.88"/>
          <rect x="53" y="82" width="10" height="7" rx="2" fill="#0369a1"/>
          <rect x="208" y="108" width="28" height="82" rx="11" fill="${fCol("exterior", "rgba(22,163,74,0.3)")}" stroke="${sCol("exterior", "#16a34a")}" stroke-width="2.6"/>
          <text x="58" y="152" text-anchor="middle" fill="currentColor" font-size="11" font-weight="900">4</text>
          <text x="222" y="152" text-anchor="middle" fill="currentColor" font-size="11" font-weight="900">4</text>
        </g>

        <!-- ZONA 2: ESPALDA / PESO MEDIO -->
        <g data-pack-zone="media" style="cursor:pointer;">
          <path d="M74 62 Q140 54 206 62 L206 164 Q140 172 74 164 Z" fill="${fCol("media", "rgba(109,40,217,0.32)")}" stroke="${sCol("media", "#8b5cf6")}" stroke-width="2.8"/>
          <rect x="98" y="122" width="84" height="30" rx="9" fill="rgba(148,163,184,0.14)" stroke="currentColor" stroke-opacity="0.22" stroke-width="1.5"/>
          <text x="140" y="108" text-anchor="middle" fill="currentColor" font-size="13" font-weight="900">2. Peso medio</text>
          <text x="140" y="141" text-anchor="middle" fill="currentColor" font-size="10.5" font-weight="700" opacity="0.88">Agua y comida</text>
        </g>

        <!-- ZONA 1: CABEZAL SUPERIOR CON CORREA Y HEBILLA -->
        <g data-pack-zone="cabezal" style="cursor:pointer;">
          <path d="M78 58 C78 24 202 24 202 58 L196 74 Q140 82 84 74 Z" fill="${fCol("cabezal", "rgba(14,165,233,0.3)")}" stroke="${sCol("cabezal", "#0ea5e9")}" stroke-width="2.8"/>
          <rect x="98" y="64" width="8" height="24" rx="3" fill="#475569"/>
          <rect x="174" y="64" width="8" height="24" rx="3" fill="#475569"/>
          <rect x="96" y="74" width="12" height="8" rx="2" fill="#f59e0b"/>
          <rect x="172" y="74" width="12" height="8" rx="2" fill="#f59e0b"/>
          <text x="140" y="53" text-anchor="middle" fill="currentColor" font-size="12.5" font-weight="900">1. Cabezal</text>
        </g>

        <!-- ZONA 3: FONDO + AISLANTE/SLEEPING ENROLLADO -->
        <g data-pack-zone="fondo" style="cursor:pointer;">
          <path d="M76 168 Q140 176 204 168 L200 202 C200 218 80 218 80 202 Z" fill="${fCol("fondo", "rgba(245,158,11,0.3)")}" stroke="${sCol("fondo", "#f59e0b")}" stroke-width="2.8"/>
          <text x="140" y="196" text-anchor="middle" fill="currentColor" font-size="12.5" font-weight="900">3. Fondo ligero</text>
          <!-- Sleeping / colchoneta inferior con correas -->
          <rect x="84" y="218" width="112" height="24" rx="12" fill="rgba(245,158,11,0.22)" stroke="#f59e0b" stroke-width="2"/>
          <ellipse cx="90" cy="230" rx="6" ry="12" fill="#d97706" opacity="0.55"/>
          <rect x="108" y="215" width="7" height="30" rx="2" fill="#475569"/>
          <rect x="165" y="215" width="7" height="30" rx="2" fill="#475569"/>
          <text x="140" y="234" text-anchor="middle" fill="currentColor" font-size="10.5" font-weight="800">Sleeping / Aislante</text>
        </g>
      </svg>
    `;
    if (packZoneInfoEl) {
      packZoneInfoEl.textContent = (PACK_ZONES[z] || PACK_ZONES.media).tip;
    }
    if (packZonePillsEl) {
      packZonePillsEl.querySelectorAll("[data-pack-zone-btn]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-pack-zone-btn") === z);
      });
    }
  };

  const getCurrentPackItems = () => {
    const base = PACK_LISTS[packState.type] || PACK_LISTS.campamento;
    if (packState.type === "bolsillo") return base;
    if (packState.type === "ataque") {
      return packState.climate === "lluvia" ? [...base, ...CLIMATE_EXTRAS.lluvia] : base;
    }
    return [...base, ...(CLIMATE_EXTRAS[packState.climate] || [])];
  };

  const renderPackWeight = () => {
    const kg = Math.max(15, Math.min(150, Number(packWeightIn ? packWeightIn.value : packState.userKg) || 55));
    packState.userKg = kg;
    const basePackWeight = packState.type === "campamento" ? 1.4 : packState.type === "ataque" ? 0.45 : 0;
    const checkedKg = getCurrentPackItems().reduce(
      (acc, it) => (packState.checked && packState.checked[`${packState.type}:${it.id}`] ? acc + Number(it.kg || 0) : acc),
      0
    );
    const totalLoaded = checkedKg > 0 ? checkedKg + basePackWeight : 0;
    const maxSafe = packState.type === "bolsillo" ? 0.5 : packState.type === "ataque" ? kg * 0.12 : kg * 0.2;

    if (packWeightLbl) {
      if (packState.type === "bolsillo") {
        packWeightLbl.textContent = "Ideal de bolsillo: < 0.5 kg";
      } else if (packState.type === "ataque") {
        packWeightLbl.textContent = `Carga ideal: ${(kg * 0.08).toFixed(1)} – ${maxSafe.toFixed(1)} kg (8–12%)`;
      } else {
        packWeightLbl.textContent = `Carga ideal: ${(kg * 0.15).toFixed(1)} – ${maxSafe.toFixed(1)} kg (15–20%)`;
      }
    }
    if (packLoadBarEl && packLoadStatusEl) {
      const ratio = maxSafe > 0 ? Math.min(110, Math.round((totalLoaded / maxSafe) * 100)) : 0;
      packLoadBarEl.style.width = `${Math.min(100, ratio)}%`;
      packLoadBarEl.classList.toggle("is-over", totalLoaded > maxSafe * 1.02);
      packLoadBarEl.classList.toggle("is-warn", totalLoaded >= maxSafe * 0.85 && totalLoaded <= maxSafe * 1.02);
      const tareNote = checkedKg > 0 && basePackWeight > 0 ? ` (incl. ${basePackWeight} kg mochila)` : "";
      packLoadStatusEl.textContent = `Peso empacado: ${totalLoaded.toFixed(1)} kg de ${maxSafe.toFixed(1)} kg límite${tareNote}`;
    }
  };

  const renderPackChecklist = () => {
    if (!packListEl) return;
    const items = getCurrentPackItems();
    const typeTitleMap = { campamento: "Campamento", ataque: "Ataque (1 día)", bolsillo: "De Bolsillo" };
    if (packListTitleEl) packListTitleEl.textContent = `Lista · ${typeTitleMap[packState.type] || "Tu Mochila"}`;

    let done = 0;
    const extraNoteHtml =
      packState.type === "bolsillo"
        ? `<div class="bt-whistle-meta-note" style="margin-top:0.55rem;"><strong>Referencia Equipo de Bolsillo ASMAC (Pistas de Aventura p. 36–37):</strong> 1 a 2 m de piola/cordón, navaja autorizada (según sección), gis, lápiz/pluma, libreta pequeña, pañuelo o paliacate, cambio para emergencia, curitas, seguros/imperdibles, ligas, cerillos impermeabilizados (bajo supervisión) y aguja con hilo.</div>`
        : "";
    packListEl.innerHTML =
      items
        .map((it) => {
          const key = `${packState.type}:${it.id}`;
          const on = Boolean(packState.checked && packState.checked[key]);
          if (on) done++;
          return `<label class="bt-safe-check-item ${on ? "is-checked" : ""}"><input type="checkbox" data-pack-item="${escapeHtml(key)}" ${on ? "checked" : ""}/><span>${escapeHtml(it.text)}</span></label>`;
        })
        .join("") + extraNoteHtml;
    if (packBadgeEl) packBadgeEl.textContent = `${done} / ${items.length}`;
    renderPackWeight();
    renderPackDiagram();
  };

  if (packWeightIn) {
    packWeightIn.value = String(packState.userKg || 55);
    packWeightIn.addEventListener("input", () => {
      renderPackWeight();
      savePack();
    });
  }
  const packTypePillsEl = document.getElementById("btPackTypePills");
  if (packTypePillsEl) {
    packTypePillsEl.querySelectorAll("[data-pack-type]").forEach((p) => {
      p.classList.toggle("is-active", p.getAttribute("data-pack-type") === packState.type);
    });
    packTypePillsEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pack-type]");
      if (!btn) return;
      packState.type = btn.getAttribute("data-pack-type") || "campamento";
      packTypePillsEl.querySelectorAll("[data-pack-type]").forEach((p) => p.classList.toggle("is-active", p === btn));
      savePack();
      renderPackChecklist();
    });
  }
  const packClimatePillsEl = document.getElementById("btPackClimatePills");
  if (packClimatePillsEl) {
    packClimatePillsEl.querySelectorAll("[data-pack-climate]").forEach((p) => {
      p.classList.toggle("is-active", p.getAttribute("data-pack-climate") === packState.climate);
    });
    packClimatePillsEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pack-climate]");
      if (!btn) return;
      packState.climate = btn.getAttribute("data-pack-climate") || "templado";
      packClimatePillsEl.querySelectorAll("[data-pack-climate]").forEach((p) => p.classList.toggle("is-active", p === btn));
      savePack();
      renderPackChecklist();
    });
  }
  if (packDiagEl) {
    packDiagEl.addEventListener("click", (e) => {
      const zEl = e.target.closest("[data-pack-zone]");
      if (!zEl) return;
      packState.zone = zEl.getAttribute("data-pack-zone") || "media";
      savePack();
      renderPackDiagram();
    });
  }
  if (packZonePillsEl) {
    packZonePillsEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pack-zone-btn]");
      if (!btn) return;
      packState.zone = btn.getAttribute("data-pack-zone-btn") || "media";
      savePack();
      renderPackDiagram();
    });
  }
  if (packListEl) {
    packListEl.addEventListener("change", (e) => {
      const chk = e.target.closest("[data-pack-item]");
      if (!chk) return;
      if (!packState.checked) packState.checked = {};
      packState.checked[chk.getAttribute("data-pack-item")] = chk.checked;
      savePack();
      renderPackChecklist();
    });
  }
  const packResetBtn = document.getElementById("btPackResetBtn");
  if (packResetBtn) {
    packResetBtn.addEventListener("click", () => {
      if (packState.checked) {
        Object.keys(packState.checked).forEach((k) => {
          if (k.startsWith(`${packState.type}:`)) delete packState.checked[k];
        });
      }
      savePack();
      renderPackChecklist();
    });
  }
  renderPackChecklist();

  // --------------------------------------------------------------------------
  // 4. PISTAS Y BRÚJULA (Rosa graduada + Botones cardinales + 12 Señales)
  // --------------------------------------------------------------------------
  const compassStageEl = document.getElementById("btCompassStage");
  const compassRangeEl = document.getElementById("btCompassDegRange");
  const compassPresetsEl = document.getElementById("btCompassPresets");
  const compassAzEl = document.getElementById("btCompassAzimuthText");
  const compassBackEl = document.getElementById("btCompassBackText");

  const degToCardinal = (d) => {
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
    return dirs[Math.round(((d % 360) + 360) % 360 / 22.5) % 16];
  };

  const renderCompass = (degVal = 45) => {
    const deg = Math.max(0, Math.min(359, Number(degVal) || 0));
    const back = (deg + 180) % 360;
    if (compassAzEl) compassAzEl.textContent = `Rumbo: ${deg}° (${degToCardinal(deg)})`;
    if (compassBackEl) compassBackEl.textContent = `Regreso: ${back}° (${degToCardinal(back)})`;
    if (compassRangeEl && Number(compassRangeEl.value) !== deg) compassRangeEl.value = String(deg);
    if (!compassStageEl) return;

    const ticks = [];
    for (let a = 0; a < 360; a += 15) {
      const r1 = a % 45 === 0 ? 64 : 69;
      const r2 = 76;
      const rad = ((a - 90) * Math.PI) / 180;
      ticks.push(
        `<line x1="${(95 + Math.cos(rad) * r1).toFixed(1)}" y1="${(95 + Math.sin(rad) * r1).toFixed(1)}" x2="${(95 + Math.cos(rad) * r2).toFixed(1)}" y2="${(95 + Math.sin(rad) * r2).toFixed(1)}" stroke="currentColor" stroke-opacity="${a % 45 === 0 ? "0.5" : "0.24"}" stroke-width="${a % 90 === 0 ? "2" : "1.2"}"/>`
      );
    }

    compassStageEl.innerHTML = `
      <svg viewBox="0 0 190 190" width="190" height="190" aria-hidden="true">
        <circle cx="95" cy="95" r="78" fill="none" stroke="currentColor" stroke-opacity="0.24" stroke-width="2.2"/>
        <circle cx="95" cy="95" r="56" fill="none" stroke="currentColor" stroke-opacity="0.14" stroke-width="1.2" stroke-dasharray="3 4"/>
        ${ticks.join("")}
        <text x="95" y="25" text-anchor="middle" font-size="12" font-weight="900" fill="#ef4444">N</text>
        <text x="167" y="99" text-anchor="middle" font-size="11.5" font-weight="800" fill="currentColor">E</text>
        <text x="95" y="172" text-anchor="middle" font-size="11.5" font-weight="800" fill="currentColor">S</text>
        <text x="23" y="99" text-anchor="middle" font-size="11.5" font-weight="800" fill="currentColor">O</text>
        <text x="145" y="47" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor" opacity="0.65">NE</text>
        <text x="145" y="149" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor" opacity="0.65">SE</text>
        <text x="45" y="149" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor" opacity="0.65">SO</text>
        <text x="45" y="47" text-anchor="middle" font-size="8.5" font-weight="700" fill="currentColor" opacity="0.65">NO</text>
        <g transform="rotate(${back} 95 95)">
          <line x1="95" y1="95" x2="95" y2="34" stroke="#0284c7" stroke-width="2.8" stroke-dasharray="4 3" stroke-linecap="round"/>
          <circle cx="95" cy="34" r="3.5" fill="#0284c7"/>
        </g>
        <g transform="rotate(${deg} 95 95)">
          <polygon points="95,26 103,95 87,95" fill="#ef4444"/>
          <polygon points="95,164 103,95 87,95" fill="currentColor" opacity="0.32"/>
        </g>
        <circle cx="95" cy="95" r="6.5" fill="currentColor"/>
      </svg>
    `;
  };
  if (compassRangeEl) {
    compassRangeEl.addEventListener("input", () => renderCompass(compassRangeEl.value));
    renderCompass(compassRangeEl.value);
  }
  if (compassPresetsEl) {
    compassPresetsEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-compass-deg]");
      if (!btn) return;
      renderCompass(btn.getAttribute("data-compass-deg"));
    });
  }

  const TRACKS = [
    { name: "Inicio de pista", svg: `<circle cx="24" cy="24" r="6" fill="currentColor"/><line x1="30" y1="24" x2="64" y2="24" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><polyline points="56,16 66,24 56,32" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` },
    { name: "Seguir adelante", svg: `<line x1="14" y1="24" x2="64" y2="24" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><polyline points="55,15 65,24 55,33" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` },
    { name: "Girar a la derecha", svg: `<polyline points="18,36 46,36 46,12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="38,20 46,11 54,20" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` },
    { name: "Girar a la izquierda", svg: `<polyline points="18,14 46,14 46,38" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="38,30 46,39 54,30" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` },
    { name: "Camino obstruido", svg: `<line x1="22" y1="12" x2="58" y2="36" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/><line x1="58" y1="12" x2="22" y2="36" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/>` },
    { name: "Peligro", svg: `<polygon points="40,8 62,40 18,40" fill="none" stroke="#ef4444" stroke-width="3.5" stroke-linejoin="round"/><line x1="40" y1="19" x2="40" y2="29" stroke="#ef4444" stroke-width="3.2" stroke-linecap="round"/><circle cx="40" cy="34" r="2" fill="#ef4444"/>` },
    { name: "Agua potable", svg: `<path d="M16 20 Q28 13 40 20 T64 20" fill="none" stroke="#0ea5e9" stroke-width="3.2" stroke-linecap="round"/><path d="M16 32 Q28 25 40 32 T64 32" fill="none" stroke="#0ea5e9" stroke-width="3.2" stroke-linecap="round"/>` },
    { name: "Agua no potable", svg: `<path d="M16 20 Q28 13 40 20 T64 20" fill="none" stroke="#f59e0b" stroke-width="3.2" stroke-linecap="round"/><line x1="26" y1="10" x2="54" y2="38" stroke="#ef4444" stroke-width="3.2" stroke-linecap="round"/>` },
    { name: "Mensaje a 5 pasos", svg: `<rect x="20" y="14" width="24" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="3"/><polyline points="20,14 32,25 44,14" fill="none" stroke="currentColor" stroke-width="2.6"/><text x="58" y="30" font-size="14" font-weight="900" fill="currentColor">5</text>` },
    { name: "Ir rápido", svg: `<polyline points="18,14 32,24 18,34" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="36,14 50,24 36,34" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="54,14 68,24 54,34" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` },
    { name: "Campamento cerca", svg: `<polygon points="40,10 62,38 18,38" fill="none" stroke="#16a34a" stroke-width="3.5" stroke-linejoin="round"/><line x1="40" y1="24" x2="40" y2="38" stroke="#16a34a" stroke-width="3"/>` },
    { name: "Fin de pista", svg: `<circle cx="40" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="3.4"/><circle cx="40" cy="24" r="4.5" fill="currentColor"/>` }
  ];
  const tracksGridEl = document.getElementById("btTracksGrid");
  if (tracksGridEl) {
    tracksGridEl.innerHTML = TRACKS.map(
      (t) => `<div class="bt-track-card"><svg viewBox="0 0 80 48" width="72" height="44" aria-hidden="true">${t.svg}</svg><span>${escapeHtml(t.name)}</span></div>`
    ).join("");
  }

  // --------------------------------------------------------------------------
  // 5. BOTIQUÍN Y PRIMEROS AUXILIOS
  // --------------------------------------------------------------------------
  const KIT_KEY = "bt_skills_kit_v1";
  let kitState = { kind: "personal", checked: {} };
  try {
    const rawKit = localStorage.getItem(KIT_KEY);
    if (rawKit) {
      const p = JSON.parse(rawKit);
      if (p && typeof p === "object") kitState = Object.assign(kitState, p);
    }
  } catch (_) {}
  const saveKit = () => {
    try {
      localStorage.setItem(KIT_KEY, JSON.stringify(kitState));
    } catch (_) {}
  };
  const KIT_ITEMS = {
    personal: [
      "Gasas estériles individuales (4–6 sobres)",
      "Vendas elásticas de 5 cm y curitas variadas",
      "Cinta micropore o tela adhesiva",
      "Solución antiséptica pequeña (jabón neutro o clorhexidina)",
      "2 pares de guantes de nitrilo o látex desechables",
      "Suero oral en sobre y tarjeta con teléfono de emergencia"
    ],
    patrulla: [
      "Gasas de varios tamaños + apósitos estériles",
      "Vendas de 5 cm, 10 cm y venda triangular para cabestrillo",
      "Tijeras punta roma, pinzas limpias y termómetro digital",
      "Suero fisiológico o agua estéril para lavar heridas",
      "Manta térmica aluminizada + compresa fría instantánea",
      "Guantes suficientes para todo el equipo + bitácora (sin automedicar)"
    ]
  };
  const FIRST_AID_CARDS = [
    { t: "Regla PAS (Primero siempre)", d: "1. Proteger la zona para evitar otro accidente. 2. Avisar al Scouter responsable o al 911. 3. Socorrer manteniendo la calma." },
    { t: "Cortadas y raspaduras", d: "Lava con agua limpia y jabón neutro, seca con gasa estéril dando toques suaves y cubre sin usar algodón suelto." },
    { t: "Quemaduras leves", d: "Enfría con agua fresca corriente durante 10–15 minutos. No apliques hielo directo, pasta de dientes ni pomadas caseras." },
    { t: "Golpe de calor / Insolación", d: "Lleva a la sombra, afloja ropa, refresca cuello y axilas con paños húmedos y ofrece sorbos pequeños si está consciente." },
    { t: "Esguinces y torceduras", d: "Reposo sin apoyar el pie o brazo, frío local envuelto en tela 15 minutos y elevación suave mientras revisa personal capacitado." },
    { t: "Nota de medicamentos", d: "Ningún medicamento (ni analgésicos) se administra sin autorización expresa en la Ficha Médica y por el adulto responsable." }
  ];
  const kitListEl = document.getElementById("btKitChecklist");
  const kitTabsEl = document.getElementById("btKitTabs");
  const firstAidGridEl = document.getElementById("btFirstAidGrid");

  const renderKit = () => {
    if (!kitListEl) return;
    const list = KIT_ITEMS[kitState.kind] || KIT_ITEMS.personal;
    kitListEl.innerHTML =
      list
        .map((txt, idx) => {
          const key = `${kitState.kind}:${idx}`;
          const on = Boolean(kitState.checked && kitState.checked[key]);
          return `<label class="bt-safe-check-item ${on ? "is-checked" : ""}"><input type="checkbox" data-kit-item="${key}" ${on ? "checked" : ""}/><span>${escapeHtml(txt)}</span></label>`;
        })
        .join("") +
      `<p class="bt-ejes-helper-note" style="margin-top:0.55rem;margin-bottom:0;">Los medicamentos personales solo se portan y administran conforme a tu Ficha Médica.</p>`;
  };
  if (kitTabsEl) {
    kitTabsEl.querySelectorAll("[data-kit-kind]").forEach((p) => {
      p.classList.toggle("is-active", p.getAttribute("data-kit-kind") === kitState.kind);
    });
    kitTabsEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-kit-kind]");
      if (!btn) return;
      kitState.kind = btn.getAttribute("data-kit-kind") || "personal";
      kitTabsEl.querySelectorAll("[data-kit-kind]").forEach((p) => p.classList.toggle("is-active", p === btn));
      saveKit();
      renderKit();
    });
  }
  if (kitListEl) {
    kitListEl.addEventListener("change", (e) => {
      const chk = e.target.closest("[data-kit-item]");
      if (!chk) return;
      if (!kitState.checked) kitState.checked = {};
      kitState.checked[chk.getAttribute("data-kit-item")] = chk.checked;
      saveKit();
      renderKit();
    });
  }
  renderKit();
  if (firstAidGridEl) {
    firstAidGridEl.innerHTML = FIRST_AID_CARDS.map(
      (c) => `<div class="bt-firstaid-card"><strong>${escapeHtml(c.t)}</strong><p>${escapeHtml(c.d)}</p></div>`
    ).join("");
  }

  // --------------------------------------------------------------------------
  // 6. FOGATAS DETALLADAS Y NO DEJAR RASTRO
  // --------------------------------------------------------------------------
  const stoneRing = (cx = 100, cy = 84) => `
    <ellipse cx="${cx}" cy="${cy + 4}" rx="64" ry="11" fill="rgba(148,163,184,0.16)"/>
    <circle cx="${cx - 56}" cy="${cy}" r="7" fill="#64748b"/>
    <circle cx="${cx - 34}" cy="${cy + 6}" r="7.5" fill="#94a3b8"/>
    <circle cx="${cx - 10}" cy="${cy + 8}" r="7" fill="#64748b"/>
    <circle cx="${cx + 14}" cy="${cy + 8}" r="7.5" fill="#94a3b8"/>
    <circle cx="${cx + 38}" cy="${cy + 6}" r="7" fill="#64748b"/>
    <circle cx="${cx + 58}" cy="${cy}" r="7" fill="#94a3b8"/>
  `;
  const flamePair = (cx = 100, cy = 72, h = 44) => `
    <ellipse cx="${cx}" cy="${cy + 6}" rx="20" ry="6" fill="#dc2626" opacity="0.55"/>
    <path d="M${cx} ${cy - h} C${cx - 16} ${cy - h * 0.45} ${cx - 16} ${cy} ${cx} ${cy + 4} C${cx + 16} ${cy} ${cx + 16} ${cy - h * 0.45} ${cx} ${cy - h}Z" fill="#f97316"/>
    <path d="M${cx} ${cy - h * 0.65} C${cx - 8} ${cy - h * 0.25} ${cx - 8} ${cy} ${cx} ${cy + 2} C${cx + 8} ${cy} ${cx + 8} ${cy - h * 0.25} ${cx} ${cy - h * 0.65}Z" fill="#facc15"/>
  `;

  const FIRES_DATA = [
    {
      name: "Pirámide",
      tag: "Encendido rápido",
      tip: "Ideal para prender rápido o hervir agua; varas delgadas inclinadas hacia un punto central.",
      svg: stoneRing() + flamePair(100, 74, 46) + timber(100, 22, 62, 80, 9) + timber(100, 22, 138, 80, 9) + timber(100, 20, 100, 82, 8)
    },
    {
      name: "Consejo / Pagoda",
      tag: "Velada y brasa larga",
      tip: "Acomodo cruzado en cuadro de grueso abajo a delgado arriba; genera luz y brasas estables.",
      svg: stoneRing() + flamePair(100, 62, 42) + timber(52, 74, 148, 74, 10) + timber(58, 60, 142, 60, 9) + timber(66, 48, 134, 48, 8)
    },
    {
      name: "Estrella",
      tag: "Ahorro de leña",
      tip: "5–6 troncos en círculo que se empujan hacia el centro poco a poco sin tener que cortarlos.",
      svg: `<circle cx="100" cy="54" r="44" fill="none" stroke="#64748b" stroke-width="5" stroke-dasharray="10 8"/>` + timber(100, 54, 100, 14, 10) + timber(100, 54, 142, 38, 10) + timber(100, 54, 130, 90, 10) + timber(100, 54, 70, 90, 10) + timber(100, 54, 58, 38, 10) + flamePair(100, 58, 28)
    },
    {
      name: "Corredor / Zanja",
      tag: "Cocina y viento fuerte",
      tip: "Entre dos troncos paralelos o zanja angosta orientados al viento; sostiene ollas o parrilla.",
      svg: stoneRing() + timber(44, 62, 156, 62, 12) + flamePair(82, 68, 30) + flamePair(118, 68, 30) + timber(52, 46, 148, 46, 10) + `<path d="M22 54 H38 M32 49 L38 54 L32 59" stroke="#38bdf8" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    },
    {
      name: "Reflector",
      tag: "Dirige el calor",
      tip: "Pared de troncos detrás del fuego que refleja el calor directo hacia un refugio abierto.",
      svg: stoneRing() + timber(140, 18, 140, 82, 12) + timber(126, 26, 126, 82, 11) + flamePair(86, 74, 42) + `<path d="M72 48 H42 M48 43 L42 48 L48 53" stroke="#facc15" stroke-width="2.6" stroke-dasharray="3 3" fill="none" stroke-linecap="round"/>`
    }
  ];
  const firesGridEl = document.getElementById("btFiresGrid");
  if (firesGridEl) {
    firesGridEl.innerHTML = FIRES_DATA.map(
      (f) => `
      <article class="bt-knot-card">
        <div class="bt-knot-top">
          <h4>${escapeHtml(f.name)}</h4>
          <span class="bt-knot-cat-badge">${escapeHtml(f.tag)}</span>
        </div>
        <div class="bt-knot-svg-stage"><svg viewBox="0 0 200 104" width="196" height="98" aria-hidden="true">${f.svg}</svg></div>
        <p class="bt-knot-tip">${escapeHtml(f.tip)}</p>
      </article>`
    ).join("");
  }

  const LNT_ITEMS = [
    "1. Planifica y prepárate con anticipación.",
    "2. Viaja y acampa sobre superficies resistentes.",
    "3. Dispón adecuadamente de los desperdicios (regresa tu basura).",
    "4. Deja lo que encuentres intacto (rocas, flores y objetos).",
    "5. Minimiza el impacto de las fogatas y apaga al 100%.",
    "6. Respeta la fauna y flora silvestres a distancia.",
    "7. Sé considerado con otros visitantes y comunidades locales."
  ];
  const lntListEl = document.getElementById("btLntList");
  if (lntListEl) {
    lntListEl.innerHTML =
      LNT_ITEMS.map((txt) => `<div class="bt-lnt-pill">${escapeHtml(txt)}</div>`).join("") +
      `<div class="bt-lnt-pill" style="border-color:rgba(239,68,68,0.45);"><strong>Apagado total:</strong> moja con agua, remueve cenizas, vuelve a mojar hasta sentir frío al dorso de la mano y limpia el área.</div>`;
  }

  // --------------------------------------------------------------------------
  // 7. SILBATO Y FORMACIONES OFICIALES ASMAC (CON FUENTES DIRECTAS DE MANUAL)
  // --------------------------------------------------------------------------
  const WHISTLES = [
    { name: "Atención / Alto", sec: "Todas", code: "T", morse: "-", desc: "1 toque largo", src: "Pistas de Aventura p. 66" },
    { name: "Formarse (Tropa)", sec: "Tropa", code: "CC", morse: "-.-. -.-.", desc: "Largo-corto-largo-corto (2x)", src: "Pistas de Aventura p. 66" },
    { name: "Guías de Patrulla", sec: "Tropa", code: "V", morse: "...-", desc: "3 cortos y 1 largo", src: "Pistas de Aventura p. 66" },
    { name: "Subguías de Patrulla", sec: "Tropa", code: "U", morse: "..-", desc: "2 cortos y 1 largo", src: "Pistas de Aventura p. 66" },
    { name: "Comunidad", sec: "Comunidad", code: "QQ", morse: "--.- --.-", desc: "Largo-largo-corto-largo (2x)", src: "El Desafío de ser Caminante p. 37" },
    { name: "Coordinadores de Equipo", sec: "Comunidad", code: "B", morse: "-...", desc: "1 largo y 3 cortos", src: "El Desafío de ser Caminante p. 37" },
    { name: "Clan de Rovers", sec: "Clan", code: "RR", morse: ".-. .-.", desc: "Corto-largo-corto (2x)", src: "Las Rutas Rover p. 25" },
    { name: "Scouters", sec: "Dirigentes", code: "J", morse: ".---", desc: "1 corto y 3 largos", src: "Pistas de Aventura p. 66" },
    { name: "Auxilio", sec: "Emergencia", code: "S", morse: "...", desc: "3 cortos (Tropa/Comunidad)", src: "Pistas p. 66 (Clan: Peligro)" },
    { name: "Peligro (SOS)", sec: "Emergencia", code: "SOS", morse: "... --- ...", desc: "3 cortos, 3 largos, 3 cortos", src: "Pistas p. 66 / Rutas Rover p. 25" }
  ];
  const whistlesListEl = document.getElementById("btWhistlesList");
  if (whistlesListEl) {
    whistlesListEl.innerHTML =
      WHISTLES.map(
        (w, idx) => `
      <div class="bt-whistle-row">
        <div>
          <strong>${escapeHtml(w.name)}</strong>
          <small>${escapeHtml(w.sec)} · ${escapeHtml(w.desc)} · <em>${escapeHtml(w.src)}</em></small>
        </div>
        <span class="bt-whistle-code">${escapeHtml(w.code)} (${escapeHtml(w.morse)})</span>
        <button type="button" class="bt-sf-btn bt-whistle-play" data-whistle-idx="${idx}">Escuchar</button>
      </div>`
      ).join("") +
      `<div class="bt-whistle-meta-note"><strong>Aclaración oficial ASMAC:</strong> En <strong>Manada</strong> se usa el llamado vocal <em>«¡Manada, Manada, Manada!»</em> (Carnet de Aventuras en la Naturaleza para Manada 2024, p. 27) y atención al silbato Scout. En Tropa y Comunidad, <code>S (...)</code> es Auxilio y <code>SOS (... --- ...)</code> es Peligro; en el manual de Clan (Las Rutas Rover, p. 25) aparecen listados a la inversa (<code>S = Peligro</code> y <code>SOS = Auxilio</code>).</div>`;
    whistlesListEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-whistle-idx]");
      if (!btn) return;
      const w = WHISTLES[Number(btn.getAttribute("data-whistle-idx"))];
      if (w) playToneSequence(w.morse, "whistle", { btn });
    });
  }

  const FORMATIONS = [
    { id: "herradura", name: "Herradura", desc: "Ceremonias y mensajes: las patrullas rodean en U abierta frente al Scouter.", pts: [[26, 28, "G"], [24, 46, "s"], [28, 64, "s"], [44, 78, "s"], [64, 84, "s"], [84, 84, "s"], [104, 78, "s"], [122, 64, "s"], [126, 46, "s"], [124, 28, "G"]], scouter: [75, 22] },
    { id: "rectangulo", name: "Rectángulo", desc: "Formación general de Tropa o Grupo para asambleas e izamiento de bandera.", pts: [[26, 36, "G"], [26, 54, "s"], [26, 72, "s"], [52, 82, "s"], [75, 82, "s"], [98, 82, "s"], [124, 72, "s"], [124, 54, "s"], [124, 36, "G"]], scouter: [75, 20] },
    { id: "filas", name: "Filas", desc: "Cada patrulla o equipo forma en línea horizontal una detrás de otra frente al dirigente.", pts: [[34, 46, "G"], [54, 46, "s"], [74, 46, "s"], [94, 46, "s"], [114, 46, "s"], [34, 68, "G"], [54, 68, "s"], [74, 68, "s"], [94, 68, "s"], [114, 68, "s"]], scouter: [75, 20] },
    { id: "linea", name: "Línea", desc: "Todos hombro con hombro en una sola línea para revisión rápida o conteo.", pts: [[20, 62, "G"], [38, 62, "s"], [56, 62, "s"], [74, 62, "s"], [92, 62, "s"], [110, 62, "s"], [128, 62, "G"]], scouter: [75, 24] },
    { id: "col_abiertas", name: "Columnas abiertas", desc: "Equipos en hileras paralelas con espacio amplio entre patrullas para relevos.", pts: [[36, 40, "G"], [36, 56, "s"], [36, 72, "s"], [75, 40, "G"], [75, 56, "s"], [75, 72, "s"], [114, 40, "G"], [114, 56, "s"], [114, 72, "s"]], scouter: [75, 18] },
    { id: "col_cerradas", name: "Columnas cerradas", desc: "Hileras juntas hombro con hombro para espacios reducidos o salidas.", pts: [[56, 40, "G"], [56, 56, "s"], [56, 72, "s"], [75, 40, "G"], [75, 56, "s"], [75, 72, "s"], [94, 40, "G"], [94, 56, "s"], [94, 72, "s"]], scouter: [75, 18] },
    { id: "estrella", name: "Estrella", desc: "Patrullas apuntando radialmente hacia el centro donde se ubica el dirigente.", pts: [[75, 20, "G"], [75, 32, "s"], [34, 40, "G"], [46, 46, "s"], [116, 40, "G"], [104, 46, "s"], [48, 82, "G"], [58, 72, "s"], [102, 82, "G"], [92, 72, "s"]], scouter: [75, 54] },
    { id: "semicirculo", name: "Semicírculo", desc: "Arco abierto frente al dirigente o caminantes para charlas, fogata o instrucción.", pts: [[24, 58, "G"], [34, 72, "s"], [50, 82, "s"], [75, 86, "s"], [100, 82, "s"], [116, 72, "s"], [126, 58, "G"]], scouter: [75, 26] },
    { id: "estatura", name: "Por estatura", desc: "Orden creciente o decreciente frente al dirigente para juegos y organización.", pts: [[28, 66, "s"], [44, 64, "s"], [60, 62, "s"], [76, 60, "s"], [92, 58, "s"], [108, 56, "s"], [124, 54, "G"]], scouter: [75, 24] }
  ];
  let activeFormation = "herradura";
  const formPillsEl = document.getElementById("btFormationPills");
  const formDiagEl = document.getElementById("btFormationDiagram");
  const formDescEl = document.getElementById("btFormationDesc");

  const renderFormations = () => {
    const f = FORMATIONS.find((x) => x.id === activeFormation) || FORMATIONS[0];
    if (formPillsEl) {
      formPillsEl.innerHTML = FORMATIONS.map(
        (x) => `<button type="button" class="bt-skill-pill ${x.id === f.id ? "is-active" : ""}" data-form-id="${x.id}">${escapeHtml(x.name)}</button>`
      ).join("");
    }
    if (formDiagEl) {
      formDiagEl.innerHTML = `
        <svg viewBox="0 0 150 96" width="224" height="128" aria-hidden="true">
          <circle cx="${f.scouter[0]}" cy="${f.scouter[1]}" r="8.5" fill="#7c3aed"/>
          <text x="${f.scouter[0]}" y="${f.scouter[1] + 3.5}" text-anchor="middle" font-size="9.5" font-weight="900" fill="#ffffff">S</text>
          ${f.pts
            .map(([x, y, kind]) =>
              kind === "G"
                ? `<circle cx="${x}" cy="${y}" r="6.8" fill="#f59e0b"/><text x="${x}" y="${y + 3}" text-anchor="middle" font-size="8" font-weight="900" fill="#0f172a">G</text>`
                : `<circle cx="${x}" cy="${y}" r="4.6" fill="#0ea5e9"/>`
            )
            .join("")}
        </svg>`;
    }
    if (formDescEl) formDescEl.textContent = `${f.desc} (S = Dirigente, G = Guía, azul = Scout).`;
  };
  if (formPillsEl) {
    formPillsEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-form-id]");
      if (!btn) return;
      activeFormation = btn.getAttribute("data-form-id") || "herradura";
      renderFormations();
    });
  }
  renderFormations();

  // --------------------------------------------------------------------------
  // 8. RETO SCOUT (Mini-quiz offline de 5 preguntas aleatorias)
  // --------------------------------------------------------------------------
  const QUIZ_BANK = [
    { q: "¿Cuál es el toque oficial ASMAC para formar a la Tropa?", opts: ["CC (-.-. -.-.)", "V (...-)", "QQ (--.- --.-)", "RR (.-. .-.)"], ans: 0, exp: "Pistas de Aventura 2024: CC (-.-. -.-.) llama a formación de Tropa." },
    { q: "En clave Murciélago (M-U-R-C-I-E-L-A-G-O = 0-9), ¿qué número corresponde a la letra A?", opts: ["5", "6", "7", "8"], ans: 2, exp: "M(0) U(1) R(2) C(3) I(4) E(5) L(6) A(7) G(8) O(9)." },
    { q: "¿Cómo se representa la palabra SCOUT en clave Agujerito (A=1..O=9)?", opts: ["HXLFG", "SC938", "S391T", "SB92T"], ans: 1, exp: "En Agujerito: A(1) G(2) U(3) J(4) E(5) R(6) I(7) T(8) O(9), así que SCOUT queda SC938." },
    { q: "En Tu Mochila de Ataque (1 día), ¿qué es correcto empacar según las recomendaciones?", opts: ["Sleeping bag de invierno", "Botella de agua (1L), Pequeño Lunch y Equipo de bolsillo", "Colchoneta doble para acampar", "Tres mudas completas"], ans: 1, exp: "La mochila de ataque es ligera para caminata de un día: agua, pequeño lunch, protección solar/rompevientos y equipo de bolsillo." },
    { q: "¿Qué nudo sirve para crear una gaza fija que NO se corre ni ahorca bajo tensión?", opts: ["Ballestrinque", "As de Guía", "Rizo", "Margarita"], ans: 1, exp: "El As de Guía forma una gaza segura que puede desatarse fácilmente tras recibir carga." },
    { q: "Si tu rumbo con brújula es 45° (NE), ¿cuál es tu contra-azimut de regreso?", opts: ["135° (SE)", "180° (S)", "225° (SO)", "315° (NO)"], ans: 2, exp: "Contra-azimut: cuando es menor a 180° se suman 180° (45° + 180° = 225°)." },
    { q: "¿Cuál es el peso máximo recomendado para cargar en tu mochila de campamento?", opts: ["5% de tu peso", "15% a 20% de tu peso", "35% de tu peso", "50% de tu peso"], ans: 1, exp: "Cuidar la postura exige no superar el 15–20% de tu peso corporal en campamento." },
    { q: "¿En qué zona de la mochila deben ir los artículos más pesados (agua, comida)?", opts: ["Hasta abajo", "Pegados a tu espalda en la zona media", "Colgados por fuera", "En el cabezal superior"], ans: 1, exp: "Pegados a tu espalda en la zona media mantienen tu centro de gravedad estable." },
    { q: "¿Qué indica la señal de pista de un círculo con un punto al centro?", opts: ["Peligro", "Agua potable", "Fin de pista", "Campamento cerca"], ans: 2, exp: "Un círculo con un punto en el centro indica fin de pista." },
    { q: "¿Qué significa la regla PAS en primeros auxilios?", opts: ["Parar, Atender, Salir", "Proteger, Avisar, Socorrer", "Prevenir, Actuar, Seguir", "Pulso, Aire, Sangrado"], ans: 1, exp: "Primero Protege el área, luego Avisa al responsable o 911 y finalmente Socorre." },
    { q: "¿Qué debes hacer ante una quemadura leve por fuego o sol reciente?", opts: ["Poner pasta de dientes", "Aplicar hielo directo", "Enfriar con agua fresca corriente 10–15 min", "Romper la ampolla"], ans: 2, exp: "Agua fresca limpia disminuye el daño térmico sin lastimar la piel." },
    { q: "¿Qué tipo de fogata ahorra más leña porque los troncos se empujan poco a poco al centro?", opts: ["Pagoda", "Estrella", "Pirámide", "Reflector"], ans: 1, exp: "La fogata Estrella mantiene brasas en el centro empujando solo las puntas." },
    { q: "¿Qué amarre une dos troncos en ángulo de 90 grados?", opts: ["Diagonal", "Trípode", "Cuadrado", "Pescador"], ans: 2, exp: "El amarre cuadrado sujeta dos troncos cruzados en escuadra de 90°." },
    { q: "¿Con qué nudo se une mejor una cuerda gruesa con otra más delgada o húmeda?", opts: ["Rizo", "Vuelta de Escota", "Margarita", "Corredizo"], ans: 1, exp: "La Vuelta de Escota está diseñada para distinto grosor o cuerdas mojadas." },
    { q: "¿Con qué toque se llama a la Comunidad de Caminantes?", opts: ["V", "QQ (--.- --.-)", "CC", "J"], ans: 1, exp: "En El desafío de ser Caminante 2024, QQ llama a toda la Comunidad." },
    { q: "¿Cuántas letras por casilla lleva la clave Gato tradicional (#)?", opts: ["2 letras", "3 letras (punto izq/centro/der)", "1 letra", "4 letras"], ans: 1, exp: "La clave Gato acomoda 3 letras por casilla (ABC..XYZ) usando punto izquierdo, central o derecho." },
    { q: "¿Cómo se comprueba que una fogata quedó realmente apagada al 100%?", opts: ["Solo tapándola con tierra seca", "Mojando, removiendo cenizas y probando frío al dorso de la mano", "Dejándola arder sola de noche", "Poniendo piedras encima"], ans: 1, exp: "Nunca tapes brasas sin apagarlas: agua, remover y verificar que esté frío al tacto." }
  ];

  let quizSet = [];
  let quizScore = 0;
  let quizAnswered = {};
  const quizAreaEl = document.getElementById("btQuizArea");
  const quizScoreBadge = document.getElementById("btQuizScoreBadge");
  const quizRestartBtn = document.getElementById("btQuizRestartBtn");

  const startQuiz = () => {
    const pool = [...QUIZ_BANK];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    quizSet = pool.slice(0, 5);
    quizScore = 0;
    quizAnswered = {};
    renderQuiz();
  };

  const renderQuiz = () => {
    if (!quizAreaEl) return;
    if (quizScoreBadge) quizScoreBadge.textContent = `${quizScore} / 5`;
    quizAreaEl.innerHTML = `<div class="bt-quiz-stack">${quizSet
      .map((item, qIdx) => {
        const picked = quizAnswered[qIdx];
        const done = picked !== undefined;
        return `
          <div class="bt-quiz-card">
            <h4>${qIdx + 1}. ${escapeHtml(item.q)}</h4>
            <div class="bt-quiz-opts">
              ${item.opts
                .map((opt, oIdx) => {
                  let cls = "bt-quiz-opt";
                  if (done) {
                    if (oIdx === item.ans) cls += " is-right";
                    else if (oIdx === picked) cls += " is-wrong";
                  }
                  return `<button type="button" class="${cls}" data-quiz-pick="${qIdx}:${oIdx}" ${done ? "disabled" : ""}>${escapeHtml(opt)}</button>`;
                })
                .join("")}
            </div>
            ${done ? `<p class="bt-quiz-exp">${escapeHtml(item.exp)}</p>` : ""}
          </div>`;
      })
      .join("")}</div>`;
  };

  if (quizAreaEl) {
    quizAreaEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-quiz-pick]");
      if (!btn) return;
      const [qStr, oStr] = (btn.getAttribute("data-quiz-pick") || "").split(":");
      const qIdx = Number(qStr);
      const oIdx = Number(oStr);
      if (quizAnswered[qIdx] !== undefined) return;
      quizAnswered[qIdx] = oIdx;
      if (quizSet[qIdx] && oIdx === quizSet[qIdx].ans) quizScore++;
      if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("click");
      renderQuiz();
    });
  }
  if (quizRestartBtn) quizRestartBtn.addEventListener("click", startQuiz);
  startQuiz();
  if (STATE.activeSkillsTab) selectSkillsTab(STATE.activeSkillsTab);
}

// ============================================================================
// GENERADOR DE CÓDIGO QR 100% OFFLINE (ISO/IEC 18004 BYTE MODE + RS GF256)
// ============================================================================
function generateQrSvg(text, sizePx = 220) {
  const bytes = Array.from(new TextEncoder().encode(String(text || "")));
  // [ver, totalDataCodewords_L, ecPerBlock_L, b1Count, b1Data, b2Count, b2Data]
  const SPECS = [
    null,
    [1, 19, 7, 1, 19, 0, 0],
    [2, 34, 10, 1, 34, 0, 0],
    [3, 55, 15, 1, 55, 0, 0],
    [4, 80, 20, 1, 80, 0, 0],
    [5, 108, 26, 1, 108, 0, 0],
    [6, 136, 18, 2, 68, 0, 0],
    [7, 156, 20, 2, 78, 0, 0],
    [8, 194, 24, 2, 97, 0, 0],
    [9, 232, 30, 2, 116, 0, 0],
    [10, 274, 18, 2, 68, 2, 69],
    [11, 324, 20, 4, 81, 0, 0],
    [12, 370, 24, 2, 92, 2, 93],
    [13, 428, 26, 4, 107, 0, 0],
    [14, 461, 30, 3, 115, 1, 116],
    [15, 523, 22, 5, 87, 1, 88],
    [16, 589, 24, 5, 98, 1, 99]
  ];
  const ALIGN = [
    [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
    [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74]
  ];

  let spec = null;
  for (let v = 1; v < SPECS.length; v++) {
    const ccBits = v < 10 ? 8 : 16;
    const bitLen = 4 + ccBits + bytes.length * 8;
    if (Math.ceil((bitLen + 4) / 8) <= SPECS[v][1]) {
      spec = SPECS[v];
      break;
    }
  }
  if (!spec) spec = SPECS[SPECS.length - 1];
  const ver = spec[0];
  const totalData = spec[1];
  const ecPerBlock = spec[2];
  const b1Cnt = spec[3], b1Len = spec[4], b2Cnt = spec[5], b2Len = spec[6];

  // Bitstream Byte Mode (0100)
  const bits = [];
  const pushBits = (val, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  pushBits(4, 4);
  pushBits(Math.min(bytes.length, totalData - 3), ver < 10 ? 8 : 16);
  const maxBytes = Math.min(bytes.length, totalData - (ver < 10 ? 2 : 3));
  for (let i = 0; i < maxBytes; i++) pushBits(bytes[i], 8);
  const maxBits = totalData * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    codewords.push(b);
  }
  const padBytes = [0xec, 0x11];
  let pi = 0;
  while (codewords.length < totalData) {
    codewords.push(padBytes[pi % 2]);
    pi++;
  }

  // GF(256) Reed-Solomon
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);
  const rsPoly = (deg) => {
    let g = [1];
    for (let i = 0; i < deg; i++) {
      const ng = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        ng[j] ^= g[j];
        ng[j + 1] ^= gfMul(g[j], EXP[i]);
      }
      g = ng;
    }
    return g;
  };
  const rsEncode = (data, ecLen) => {
    const gen = rsPoly(ecLen);
    const res = new Array(data.length + ecLen).fill(0);
    for (let i = 0; i < data.length; i++) res[i] = data[i];
    for (let i = 0; i < data.length; i++) {
      const c = res[i];
      if (c === 0) continue;
      for (let j = 1; j < gen.length; j++) res[i + j] ^= gfMul(gen[j], c);
    }
    return res.slice(data.length);
  };

  const blocks = [];
  const ecBlocks = [];
  let off = 0;
  for (let i = 0; i < b1Cnt; i++) {
    const sl = codewords.slice(off, off + b1Len);
    off += b1Len;
    blocks.push(sl);
    ecBlocks.push(rsEncode(sl, ecPerBlock));
  }
  for (let i = 0; i < b2Cnt; i++) {
    const sl = codewords.slice(off, off + b2Len);
    off += b2Len;
    blocks.push(sl);
    ecBlocks.push(rsEncode(sl, ecPerBlock));
  }

  const finalBytes = [];
  const maxD = Math.max(b1Len, b2Len);
  for (let i = 0; i < maxD; i++) {
    for (const bl of blocks) if (i < bl.length) finalBytes.push(bl[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const ec of ecBlocks) if (i < ec.length) finalBytes.push(ec[i]);
  }

  const N = ver * 4 + 17;
  const mat = Array.from({ length: N }, () => new Int8Array(N)); // 0 empty, 1 light, 2 dark
  const isFn = Array.from({ length: N }, () => new Uint8Array(N));

  const setFn = (r, c, dark) => {
    if (r >= 0 && r < N && c >= 0 && c < N) {
      mat[r][c] = dark ? 2 : 1;
      isFn[r][c] = 1;
    }
  };
  const drawFinder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const dark =
          dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setFn(r0 + dr, c0 + dc, dark);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, N - 7);
  drawFinder(N - 7, 0);

  for (let i = 8; i < N - 8; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }
  setFn(N - 8, 8, true);

  const centers = ALIGN[ver] || [];
  for (const cy of centers) {
    for (const cx of centers) {
      if ((cy === 6 && cx === 6) || (cy === 6 && cx === N - 7) || (cy === N - 7 && cx === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          setFn(cy + dr, cx + dc, Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
        }
      }
    }
  }

  // Reserve format & version bits
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      isFn[8][i] = 1;
      isFn[i][8] = 1;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFn[8][N - 1 - i] = 1;
    isFn[N - 1 - i][8] = 1;
  }
  if (ver >= 7) {
    let vInfo = ver << 12;
    let rem = vInfo;
    for (let b = 17; b >= 12; b--) {
      if (rem & (1 << b)) rem ^= 0x1f25 << (b - 12);
    }
    vInfo |= rem;
    for (let i = 0; i < 18; i++) {
      const bit = Boolean((vInfo >> i) & 1);
      const r = Math.floor(i / 3);
      const c = N - 11 + (i % 3);
      setFn(r, c, bit);
      setFn(c, r, bit);
    }
  }

  // Place data bits zig-zag
  const allBits = [];
  for (const by of finalBytes) {
    for (let i = 7; i >= 0; i--) allBits.push((by >> i) & 1);
  }
  let bi = 0;
  let up = true;
  for (let col = N - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < N; i++) {
      const r = up ? N - 1 - i : i;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (!isFn[r][c]) {
          const bit = bi < allBits.length ? allBits[bi++] : 0;
          mat[r][c] = bit ? 2 : 1;
        }
      }
    }
    up = !up;
  }

  const MASK_FNS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
  ];

  const writeFormat = (grid, maskIdx) => {
    const data5 = (1 << 3) | maskIdx; // ECL L = 01
    let rem = data5 << 10;
    for (let b = 14; b >= 10; b--) {
      if (rem & (1 << b)) rem ^= 0x537 << (b - 10);
    }
    const fmt = ((data5 << 10) | rem) ^ 0x5412;
    for (let i = 0; i < 6; i++) grid[8][i] = ((fmt >> (14 - i)) & 1) ? 2 : 1;
    grid[8][7] = ((fmt >> 8) & 1) ? 2 : 1;
    grid[8][8] = ((fmt >> 7) & 1) ? 2 : 1;
    grid[7][8] = ((fmt >> 6) & 1) ? 2 : 1;
    for (let i = 0; i < 6; i++) grid[5 - i][8] = ((fmt >> (5 - i)) & 1) ? 2 : 1;
    for (let i = 0; i < 7; i++) grid[N - 1 - i][8] = ((fmt >> (14 - i)) & 1) ? 2 : 1;
    for (let i = 0; i < 8; i++) grid[8][N - 8 + i] = ((fmt >> (7 - i)) & 1) ? 2 : 1;
  };

  let bestMask = 0;
  let bestScore = Infinity;
  let bestGrid = null;
  for (let m = 0; m < 8; m++) {
    const g = mat.map((row) => row.slice());
    const fn = MASK_FNS[m];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!isFn[r][c] && fn(r, c)) g[r][c] = g[r][c] === 2 ? 1 : 2;
      }
    }
    writeFormat(g, m);
    let score = 0;
    for (let r = 0; r < N; r++) {
      let runC = 1, runR = 1;
      for (let c = 1; c < N; c++) {
        runC = g[r][c] === g[r][c - 1] ? runC + 1 : 1;
        if (runC === 5) score += 3;
        else if (runC > 5) score += 1;
        runR = g[c][r] === g[c - 1][r] ? runR + 1 : 1;
        if (runR === 5) score += 3;
        else if (runR > 5) score += 1;
      }
    }
    if (score < bestScore) {
      bestScore = score;
      bestMask = m;
      bestGrid = g;
    }
  }

  const q = 4;
  const vb = N + q * 2;
  const rects = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (bestGrid[r][c] === 2) rects.push(`<rect x="${c + q}" y="${r + q}" width="1" height="1"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges" role="img" aria-label="Código QR de perfil Scout"><rect width="${vb}" height="${vb}" fill="#ffffff"/><g fill="#0f172a">${rects.join("")}</g></svg>`;
}

function setupAutofillQrSharing() {
  const btnMain = document.getElementById("btnQrAutofillProfile");
  const btnSettings = document.getElementById("btnSettingsQrAutofill");
  const modal = document.getElementById("btAutofillQrModal");
  const backdrop = document.getElementById("btAutofillQrBackdrop");
  const closeBtn = document.getElementById("btnCloseAutofillQrModal");
  const svgWrap = document.getElementById("btAutofillQrSvgWrap");
  const urlInput = document.getElementById("btAutofillQrUrlInput");
  const copyBtn = document.getElementById("btnCopyAutofillQrUrl");
  if (!modal || !svgWrap) return;

  const openQrModal = () => {
    let prof = getAutofillProfile();
    const afName = document.getElementById("afName");
    if (afName && afName.value.trim() && !prof.name) {
      prof = {
        name: afName.value.trim(),
        cum: (document.getElementById("afCum")?.value || "").trim().toUpperCase(),
        age: (document.getElementById("afAge")?.value || "").trim(),
        section: (document.getElementById("afSection")?.value || "").trim(),
        group: (document.getElementById("afGroup")?.value || "").trim(),
        province: (document.getElementById("afProvince")?.value || "").trim(),
        blood: (document.getElementById("afBlood")?.value || "").trim(),
        emergency: (document.getElementById("afEmergency")?.value || "").trim(),
        scouter: (document.getElementById("afScouter")?.value || "").trim(),
      };
    }
    if (!Object.values(prof).some(Boolean)) {
      showWebToast("Primero guarda o escribe al menos un dato en «Mi Perfil Local» para generar tu QR.");
      return;
    }
    const compact = {};
    if (prof.name) compact.n = prof.name;
    if (prof.cum) compact.c = prof.cum;
    if (prof.age) compact.a = prof.age;
    if (prof.section) compact.s = prof.section;
    if (prof.group) compact.g = prof.group;
    if (prof.province) compact.p = prof.province;
    if (prof.blood) compact.b = prof.blood;
    if (prof.emergency) compact.e = prof.emergency;
    if (prof.scouter) compact.r = prof.scouter;
    const rawBytes = new TextEncoder().encode(JSON.stringify(compact));
    let binStr = "";
    rawBytes.forEach((b) => { binStr += String.fromCharCode(b); });
    const b64url = btoa(binStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const base = window.location.protocol.startsWith("http")
      ? `${window.location.origin}${window.location.pathname}`
      : "https://ey-liam.github.io/bibliotech-scouts/";
    const shareUrl = `${base}?af=${b64url}`;
    svgWrap.innerHTML = generateQrSvg(shareUrl, 232);
    if (urlInput) urlInput.value = shareUrl;
    if (typeof window.__btCloseSettingsModal === "function") window.__btCloseSettingsModal();
    modal.classList.remove("hidden");
    document.documentElement.classList.add("modal-open");
    if (typeof BtSoundEngine !== "undefined") BtSoundEngine.play("open");
    activateDialogFocusTrap(modal, "#btnCloseAutofillQrModal");
  };

  const closeQrModal = () => {
    modal.classList.add("hidden");
    if (!document.querySelector(".modal-overlay:not(.hidden)") && !document.querySelector(".bt-settings-modal:not(.hidden)")) {
      document.documentElement.classList.remove("modal-open");
    }
    releaseDialogFocusTrap(modal);
  };

  if (btnMain) btnMain.addEventListener("click", openQrModal);
  if (btnSettings) btnSettings.addEventListener("click", openQrModal);
  if (closeBtn) closeBtn.addEventListener("click", closeQrModal);
  if (backdrop) backdrop.addEventListener("click", closeQrModal);
  if (copyBtn && urlInput) {
    copyBtn.addEventListener("click", () => {
      copyOrShareDeepLink(urlInput.value, "Perfil Scout BiblioTech", "Enlace de perfil QR copiado.");
    });
  }
  window.generateQrSvg = generateQrSvg;
}

const BT_RELEASE_NOTES = [
  {
    version: "Web v10.3.0 / APK v4.3.0",
    date: "26/11/2026",
    sections: {
      added: [
        "Modal automático de novedades al actualizar a una versión nueva, agrupado por Añadido, Mejorado, Cambiado y Eliminado.",
        "Más de 35 preguntas y respuestas nuevas sobre Claves, Nudos, Amarres, Tu Mochila, Pistas, Botiquín, Fogatas, Silbato ASMAC, Ejes Temáticos, La Fogata, Editor de archivos y Descarga.",
        "Citas oficiales de manual (Pistas de Aventura p. 66, El Desafío de ser Caminante p. 37, Las Rutas Rover p. 25 y Carnet Manada p. 27) directamente en cada toque de Silbato y referencia del Equipo de Bolsillo."
      ],
      improved: [
        "Rediseño completo de los 10 diagramas de Nudos y Amarres en formato 280x150 con flechas de dirección, cruces reales arriba/abajo y pasos fieles a la cabuyería Scout (Rizo, Vuelta de Escota, Pescador, Ballestrinque, As de Guía, Margarita, Tensor, Cuadrado, Diagonal y Trípode).",
        "Renovación visual de La Fogata con barra de estadísticas comunitarias, paleta cálida Scout y ficha de perfil plegable en comentarios ya registrados.",
        "Estandarización de márgenes, tipografía, botones, radios y tarjetas en todos los espacios, además de explicación actualizada en el modal de Bienvenida."
      ],
      changed: [
        "Corrección de colores de los 4 Ejes Temáticos al seleccionarlos: Salud en azul/cian, Habilidades en naranja, Medio Ambiente en verde y Paz en rosa/magenta.",
        "Listas renovadas de Tu Mochila (Campamento, Ataque de 1 día y De Bolsillo) con nombres claros y reglas limpias por clima.",
        "Navegación simplificada y ordenada: Guía en segundo lugar y nombres exactos (Ejes Temáticos, Agentes de Cambio, Editor de archivos y Descarga), sin botones cruzados que cambien de apartado inesperadamente."
      ],
      removed: [
        "Se quitaron de Tu Mochila: funda impermeable de mochila, pares extra repetidos de calcetines, capas térmicas pesadas de dormir en mochila de ataque y artículos redundantes fuera del equipo de bolsillo.",
        "Se eliminaron los botones de salto entre secciones en Buscador, Ejes Temáticos, Agentes de Cambio y Skills para mantener cada espacio independiente y sin confusiones."
      ]
    },
    items: [
      "Colores corregidos en los 4 Ejes Temáticos (Salud azul, Habilidades naranja, Ambiente verde, Paz rosa).",
      "Tu Mochila actualizada con listas claras en Campamento, Ataque y De Bolsillo, sin equipamiento invernal pesado en caminatas de 1 día.",
      "Rediseño completo de los 10 Nudos y Amarres SVG reales, citas oficiales ASMAC en Silbato, mejoras visuales en La Fogata, nombres/orden estandarizados y Modal automático de Novedades."
    ]
  },
  {
    version: "Web v10.2.0 / APK v4.2.0",
    date: "25/11/2026",
    items: [
      "Rediseño completo de Claves en Skills: 20 claves interactivas exactas (Semáforo corregido con anatomía real y banderines Rojo/Blanco o Rojo/Amarillo, Morse con audio, Murciélago, Agujerito, Baden Powell, Sufamelico, Parelinofu, Cenit-Polar, Dametupico, Gato, Pigpen, Brújula N/E/S/O, Criptógrafo giratorio, Reverso, Alfabeto al revés, Alfabeto medio, Letras a números, Palabra clave, El bloque y Caracol) con diagramas maestros SVG.",
      "Dibujos vectoriales 3D en Nudos y Amarres (cruces arriba/abajo reales de soga y textura en troncos), nueva silueta anatómica para Tu Mochila con selector por zonas y medidor de carga en vivo, brújula graduada cada 15°, y fogatas con anillo de piedras y brasas.",
      "Correcciones del buscador a partir de reportes reales: aviso honesto cuando una especialidad FES solicitada (ej. matemáticas o robótica) no existe en el catálogo junto con enlace a P5.1, respuesta oficial sobre participación con vigencia sin Grupo (Estatutos Art. 14 / Reglamento Art. 22 y 28 / SISAS), progresión de Manada (Cazaderos PJOS), baños separados en Salida Segura y filtrado de dispositivos del desarrollador en telemetría."
    ]
  },
  {
    version: "Web v10.1.0 / APK v4.1.0",
    date: "25/11/2026",
    items: [
      "Corrección total de contraste en Modo oscuro: tarjetas activas del Asistente en 3 pasos, 4 Ejes PJOS, listas de servicio y botones mantienen fondos oscuros legibles en todo momento.",
      "Nuevo espacio interactivo offline Skills con 8 herramientas prácticas: Claves (Semáforo visual, Morse con audio y linterna, Murciélago, Cenit-Polar, Sufamelico, Dametupico y Cajón), Nudos y amarres SVG por pasos, Tu Mochila (campamento, ataque y bolsillo con acomodo por zonas y peso), Pistas y brújula, Botiquín y guía PAS, Fogatas y No Dejar Rastro, Toques oficiales ASMAC de silbato y formaciones, más Reto rápido de 5 preguntas.",
      "Nombres cortos y directos en barra superior, apartados y enlaces directos desde las respuestas del buscador hacia la herramienta práctica correspondiente en Skills."
    ]
  },
  {
    version: "Web v10.0.0 / APK v4.0.0",
    date: "24/11/2026",
    items: [
      "Nuevo espacio interactivo Los 4 Ejes del PJOS: guía oficial por sección (Cazaderos, Rumbos, Senderos y Rutas), las 5 subáreas de cada eje, Iniciativas Mundiales, ODS y Armador Rápido de Actividades FAES/FES.",
      "4 Laboratorios locales por eje: Escudo A Salvo del Peligro y Semáforo de Salida Segura (Salud), Misión Planeta e Impacto Cero Papel en vivo (Medio Ambiente), Bitácora de Horas Mensajeros de la Paz conectada a P8.3 (Paz) y Constructor Guiado de Proyectos SMART conectado en 1 clic a la Cédula P6.2 (Habilidades).",
      "Filtro directo por Eje Temático PJOS en Biblioteca, etiquetas de los 4 Ejes en La Fogata y barra visual de equilibrio de los 4 Ejes dentro del Checklist de Progresión.",
      "Código técnico anónimo por dispositivo (BT-XXXXXX) para seguimiento sin datos personales, más 232 respuestas de Especialidades FES y etapas PJOS enriquecidas con sus fases reales (Conozco, Aplico y Comparto)."
    ]
  },
  {
    version: "Web v9.9.3 / APK v3.9.3",
    date: "22/11/2026",
    items: [
      "Cobertura documental del 100%: los 1,035 documentos oficiales ahora cuentan con texto real extraído (>= 400 caracteres en cada libro histórico, organigrama, comunicado y formato contable) más respuestas nuevas verificadas.",
      "Editor de Archivos mejorado al 100%: vista previa en vivo idéntica al PDF/PNG final con autoajuste de texto, casillas interactivas (Ejes Temáticos y 17 ODS), firma opcional (dejar en blanco, dibujar a dedo o subir imagen) y 16 plantillas oficiales completas (incluidas P8.3, P8.7, P9.1 Manada, P9.2 2 hojas, P9.3 Comunidad y P9.4 Clan).",
      "Checklist interactivo de Progresión e Insignia Terminal por sección (Manada, Tropa, Comunidad y Clan) con paso en 1 clic al formato P9, saltos -10/+10 y marcadores por página en el visor PDF.",
      "Código QR 100% offline para compartir tu perfil de Autollenado entre celulares, JSON compacto e indexación asíncrona no bloqueante y traducción completa al inglés (EN)."
    ]
  },
  {
    version: "Web v9.9.2 / APK v3.9.2",
    date: "22/11/2026",
    items: [
      "Protección anti lie-fi offline: Service Worker con timeout corto (2.6–4.5 s) que cambia al instante a caché local en iOS/Web cuando hay señal débil o sin datos reales.",
      "Acervo documental y buscador mejorados: 23 libros históricos, organigramas y formatos administrativos enriquecidos con su contenido real + equivalencias internacionales (Eagle Scout, Merit Badges, BSA) y detección exacta de folios RECME fuera de rango (P8.8, P11, etc.).",
      "Asistente guiado en 3 pasos y 5 nuevas plantillas oficiales autollenables: Diagnóstico Inicial NNAJ (P1.0.1), Cédula Manada (P2.1), Champions for Nature (P8.1), Solicitud Águila Real (P9.2) y Vales de Caja / Recibo (NO 3).",
      "Lectura en voz alta (1x / 1.25x) e impresión limpia a PDF en cada respuesta, enlaces compartibles (?q= y ?doc=&page=), tamaño de letra ajustable (Normal, Grande, Extra), atajos de teclado (Alt+1..6 y [ ] + - en PDF) y respaldo .json de autollenado."
    ]
  },
  {
    version: "Web v9.9.1 / APK v3.9.1",
    date: "22/11/2026",
    items: [
      "Menú móvil y cabecera depurados: se retiraron accesos duplicados (Ajustes, Guardados, App/Offline, Bienvenida y Aportar/Contacto) dejando la navegación limpia desde el Dock y Ajustes.",
      "Ajustes simplificados: opciones directas Modo Lite, Modo Estándar y Modo oscuro, nueva pestaña App y Modo Offline en Web/iOS, y botón directo para abrir la guía de bienvenida y código QR.",
      "App Android (.apk): menú unificado de Ajustes y Descargas Offline en un mismo panel con pestañas de Mis descargas, Descargar archivos, Ajustes y Actualizaciones.",
      "Nueva Bienvenida de 3 páginas: explica qué es BiblioTech, cómo se usan sus apartados y cómo usarla en iPhone (consejo de desactivar Wi-Fi/Datos móviles sin señal), Android APK y escritorio."
    ]
  },
  {
    version: "Web v9.9.0 / APK v3.9.0",
    date: "22/11/2026",
    items: [
      "Respuestas 100 % completas sin recortes en iPhone (iOS App Web), Android APK y escritorio, con indexación incremental para no trabar celulares básicos.",
      "Búsqueda tolerante a errores ortográficos (Damerau-Levenshtein) con corrección automática y sugerencias instantáneas de códigos oficiales (P1–P10, JL304, DNME, JSN).",
      "Visor PDF mejorado: recuerda la última página leída por archivo, precarga la siguiente página en segundo plano, añade búsqueda de texto dentro del PDF, pellizco / doble toque y tamaño visible antes de abrir.",
      "Centro de Ajustes completo: Modo Lite vs Modo Estándar, efectos de sonido Web Audio, Modo Alto Contraste, idioma Español/Inglés, datos de autollenado, archivos guardados, cookies y recarga manual."
    ]
  },
  {
    version: "Web v9.8.4",
    date: "22/11/2026",
    items: [
      "Fichas ejecutivas automáticas por código y serie RECME (P1–P10, JL304, DNME, JSN, RECME23) que explican con transparencia documental tanto los archivos vigentes como los folios no publicados (por ejemplo P8.6 o P5.2)."
    ]
  },
  {
    version: "Web v9.8.1 – v9.8.3",
    date: "20–22/11/2026",
    items: [
      "Ampliación a 21,195 preguntas verificadas: Insignias Finales/Terminales (Águila Real P9.2, Alfa P9.1, Everest P9.3, Baden Powell P9.4), Método Scout, Aventuras en la Naturaleza, No Dejar Rastro y Marcos Mundo Mejor.",
      "Ordenamiento por relevancia exacta en Biblioteca y Catálogo, deduplicación atómica de telemetría y filtrado de ruido WebView Android/iOS."
    ]
  },
  {
    version: "Web v9.8.0 / APK v3.8.0",
    date: "19/11/2026",
    items: [
      "Rediseño editorial unificado claro/oscuro, streaming por bloques HTTP Range para PDFs pesados (>25 MB) y navegación fluida entre los 7 apartados."
    ]
  }
];

function detectDetailedPlatformInfo() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  const isStandalone =
    !window.Capacitor &&
    (window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches));
  if (window.Capacitor) {
    return {
      key: "apk",
      pill: `App Android APK v${APP_MOBILE_VERSION} · Web v${APP_WEB_VERSION}`,
      desc: "Estás en la App Android nativa. Puedes comprobar actualizaciones OTA de contenido web/datos o abrir el gestor de archivos offline del APK."
    };
  }
  if (IS_APPLE_TOUCH || /iPhone|iPad|iPod/i.test(ua)) {
    return {
      key: "ios",
      pill: isStandalone ? `iOS App Web v${APP_WEB_VERSION}` : `iPhone / iPad Safari v${APP_WEB_VERSION}`,
      desc: isStandalone
        ? "Estás en iOS App Web (pantalla de inicio). Si Safari guardó una versión previa en caché, este botón fuerza la actualización y recarga al instante."
        : "Estás en Safari para iOS. Usa este botón para limpiar caché del Service Worker y cargar la versión más reciente."
    };
  }
  return {
    key: "web",
    pill: `Web PWA v${APP_WEB_VERSION}`,
    desc: "Estás en el sitio web oficial. Limpia la caché del navegador y recarga la versión más reciente aunque no haya salido el aviso automático."
  };
}

function setupSettingsHub() {
  const modal = document.getElementById("btSettingsModal");
  if (!modal) return;

  const closeBtn = document.getElementById("closeSettingsModalBtn");
  const tabBtns = Array.from(modal.querySelectorAll(".bt-settings-tab"));
  const panes = Array.from(modal.querySelectorAll(".bt-settings-pane"));
  const btnLite = document.getElementById("btnSetVisualLite");
  const btnFull = document.getElementById("btnSetVisualFull");
  const visualBadge = document.getElementById("settingsVisualActiveBadge");
  const soundChk = document.getElementById("settingsSoundToggle");
  const testSoundBtn = document.getElementById("btnTestBtSound");
  const contrastChk = document.getElementById("settingsContrastToggle");
  const campChk = document.getElementById("settingsCampModeToggle");
  const langBtns = Array.from(modal.querySelectorAll("[data-lang-choice]"));

  const autofillBox = document.getElementById("settingsAutofillSummary");
  const btnJumpAutofill = document.getElementById("btnSettingsJumpAutofill");
  const btnSettingsExportAutofill = document.getElementById("btnSettingsExportAutofill");
  const btnSettingsImportAutofill = document.getElementById("btnSettingsImportAutofill");
  const btnClearAutofill = document.getElementById("btnSettingsClearAutofill");
  const savedCountEl = document.getElementById("settingsSavedCount");
  const savedListEl = document.getElementById("settingsSavedDocsList");
  const btnClearAllSaved = document.getElementById("btnSettingsClearAllSaved");
  const consentChk = document.getElementById("settingsConsentToggle");
  const btnClearRecents = document.getElementById("btnSettingsClearRecents");
  const btnOpenCookieModal = document.getElementById("btnSettingsOpenCookieModal");

  const platPill = document.getElementById("settingsPlatformPill");
  const platDesc = document.getElementById("settingsPlatformDesc");
  const btnCheckReload = document.getElementById("btnSettingsCheckAndReload");
  const btnNativeApk = document.getElementById("btnSettingsNativeApkUpdate");
  const updateStatusEl = document.getElementById("settingsUpdateStatus");
  const changelogBox = document.getElementById("settingsChangelogContainer");
  const btnOpenWelcome = document.getElementById("btnSettingsOpenWelcome");
  const btnOpenWhatsNew = document.getElementById("btnSettingsOpenWhatsNew");
  const btnSettingsDownloadOffline = document.getElementById("btnSettingsDownloadOffline");
  const btnSettingsCopyIosUrl = document.getElementById("btnSettingsCopyIosUrl");
  const btnSettingsJumpAppSection = document.getElementById("btnSettingsJumpAppSection");

  const closeMenuIfOpen = () => {
    const header = document.querySelector(".main-header");
    const navToggle = document.getElementById("navToggle");
    const navBackdrop = document.getElementById("navBackdrop");
    if (header) header.classList.remove("nav-open");
    document.body.classList.remove("nav-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    if (navBackdrop) navBackdrop.hidden = true;
  };

  const switchSettingsTab = (tabName) => {
    tabBtns.forEach((btn) => {
      const act = btn.getAttribute("data-settings-tab") === tabName;
      btn.classList.toggle("active", act);
      btn.setAttribute("aria-selected", String(act));
    });
    panes.forEach((pane) => {
      pane.classList.toggle("hidden", pane.getAttribute("data-settings-pane") !== tabName);
    });
  };

  const renderVisualControls = () => {
    const curVis = document.documentElement.dataset.btVisual === "full" ? "full" : "lite";
    if (btnLite) {
      btnLite.classList.toggle("is-selected", curVis === "lite");
      btnLite.setAttribute("aria-pressed", String(curVis === "lite"));
    }
    if (btnFull) {
      btnFull.classList.toggle("is-selected", curVis === "full");
      btnFull.setAttribute("aria-pressed", String(curVis === "full"));
    }
    if (visualBadge) {
      visualBadge.textContent = curVis === "full" ? "Modo Estándar" : "Modo Lite";
    }
    if (soundChk) soundChk.checked = BtSoundEngine.isEnabled();
    if (contrastChk) contrastChk.checked = document.documentElement.getAttribute("data-bt-contrast") === "high";
    if (campChk) campChk.checked = Boolean(BiblioFeel.campMode);
    const curLang = document.documentElement.dataset.btLang || "es";
    langBtns.forEach((b) => b.classList.toggle("active", b.getAttribute("data-lang-choice") === curLang));
  };

  const renderDataPane = () => {
    const uidBadge = document.getElementById("settingsDeviceUidBadge");
    if (uidBadge) uidBadge.textContent = getOrCreateAnonDeviceId();
    const ecoSumEl = document.getElementById("settingsEcoSummaryBox");
    if (ecoSumEl) {
      const m = computeEcoMetrics(getEcoImpactState().sheets);
      ecoSumEl.innerHTML = `<strong>Impacto Cero Papel:</strong> ${m.sheets} hojas digitales consultadas sin imprimir (${m.waterLiters} L de agua ahorrados · ${escapeHtml(m.rankName)}).`;
    }

    const prof = getAutofillProfile();
    const entries = [
      ["Nombre", prof.name],
      ["CUM", prof.cum],
      ["Nacimiento", prof.age],
      ["Sección", prof.section],
      ["Grupo", prof.group],
      ["Provincia", prof.province],
      ["Sangre", prof.blood],
      ["Emergencia", prof.emergency],
      ["Scouter", prof.scouter]
    ].filter(([, v]) => String(v || "").trim());

    if (autofillBox) {
      if (!entries.length) {
        autofillBox.innerHTML =
          '<span style="opacity:0.8;">No hay datos de autollenado guardados todavía en este dispositivo.</span>';
      } else {
        autofillBox.innerHTML = entries
          .map(([k, v]) => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</div>`)
          .join("");
      }
    }
    if (btnClearAutofill) btnClearAutofill.disabled = !entries.length;

    const allDocIds = getSavedAndNotedDocIds();
    const savedDocs = (STATE.documents || []).filter((d) => allDocIds.includes(d.id));
    const bmkCount = getPageBookmarks().length;
    if (savedCountEl) savedCountEl.textContent = String(savedDocs.length + (bmkCount ? ` (+${bmkCount} pág.)` : ""));
    if (btnClearAllSaved) btnClearAllSaved.disabled = savedDocs.length === 0;

    if (savedListEl) {
      if (!savedDocs.length) {
        savedListEl.innerHTML =
          '<div style="font-size:0.79rem;opacity:0.75;padding:0.4rem 0;">No tienes archivos marcados ni notas guardadas.</div>';
      } else {
        savedListEl.innerHTML = savedDocs
          .map((d) => {
            const note = getDocNote(d.id);
            return `
              <div class="bt-settings-saved-row">
                <div class="bt-settings-saved-meta">
                  <strong>${escapeHtml(d.title)}</strong>
                  <span>${escapeHtml(d.ext)} · ${escapeHtml(getDocSizeLabel(d))}${note ? " · Con nota" : ""}</span>
                </div>
                <div class="bt-settings-inline-actions">
                  <button type="button" class="bt-mini-action-btn" data-st-open-doc="${escapeHtml(d.id)}">Abrir</button>
                  <button type="button" class="bt-mini-action-btn is-danger" data-st-remove-doc="${escapeHtml(d.id)}">Quitar</button>
                </div>
              </div>
            `;
          })
          .join("");
      }
    }

    if (consentChk) {
      consentChk.checked = hasTelemetryConsent();
    }
  };

  const renderVersionPane = () => {
    const plat = detectDetailedPlatformInfo();
    if (platPill) platPill.textContent = plat.pill;
    if (platDesc) platDesc.textContent = plat.desc;
    if (btnNativeApk) {
      btnNativeApk.classList.toggle("hidden", plat.key !== "apk");
    }

    if (changelogBox) {
      const platTag =
        plat.key === "apk"
          ? "Adaptado para Android APK"
          : plat.key === "ios"
            ? "Adaptado para iOS App Web"
            : "Sitio Web Oficial";
      const GROUP_LABELS = [
        ["added", "Añadido", "is-added"],
        ["improved", "Mejorado", "is-improved"],
        ["changed", "Cambiado", "is-changed"],
        ["removed", "Eliminado", "is-removed"]
      ];
      changelogBox.innerHTML = BT_RELEASE_NOTES.map((rel, idx) => {
        const sec = rel.sections || null;
        const bodyHtml = sec
          ? GROUP_LABELS.map(([k, lbl, cls]) => {
              const arr = Array.isArray(sec[k]) ? sec[k] : [];
              if (!arr.length) return "";
              return `<div style="margin-top:0.5rem;"><span class="bt-wn-badge ${cls}">${lbl}</span><ul>${arr.map((it) => `<li>${escapeHtml(it)}</li>`).join("")}</ul></div>`;
            }).join("")
          : `<ul>${(rel.items || []).map((it) => `<li>${escapeHtml(it)}</li>`).join("")}</ul>`;
        return `
          <article class="bt-changelog-item">
            <div class="bt-changelog-item-head">
              <strong>${escapeHtml(rel.version)}${idx === 0 ? ` · ${escapeHtml(platTag)}` : ""}</strong>
              <span class="bt-changelog-item-date">${escapeHtml(rel.date)}</span>
            </div>
            ${bodyHtml}
          </article>
        `;
      }).join("");
    }
  };

  const openSettingsModal = (initialTab = "visual") => {
    closeMenuIfOpen();
    if (window.Capacitor && window.__btNativeBridge && typeof window.__btNativeBridge.openModal === "function") {
      const nativeTab =
        initialTab === "offline" ? "download" : initialTab === "version" ? "app" : "settings";
      window.__btNativeBridge.openModal(nativeTab);
      return;
    }
    renderVisualControls();
    renderDataPane();
    renderVersionPane();
    if (typeof window.__btRefreshWebOfflineStatus === "function") {
      window.__btRefreshWebOfflineStatus();
    }
    switchSettingsTab(initialTab);
    modal.classList.remove("hidden");
    document.documentElement.classList.add("modal-open");
    BtSoundEngine.play("open");
    activateDialogFocusTrap(modal, "#closeSettingsModalBtn");
  };

  const closeSettingsModal = () => {
    modal.classList.add("hidden");
    if (!document.querySelector(".modal-overlay:not(.hidden)") && !document.querySelector("#savedPanel:not(.hidden)")) {
      document.documentElement.classList.remove("modal-open");
    }
    releaseDialogFocusTrap(modal);
  };

  window.__btOpenSettingsModal = openSettingsModal;
  window.__btCloseSettingsModal = closeSettingsModal;
  window.BiblioFeel = BiblioFeel;
  window.BtSoundEngine = BtSoundEngine;
  window.BT_RELEASE_NOTES = BT_RELEASE_NOTES;
  window.applyUiLanguage = applyUiLanguage;

  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-action-open-settings]");
    if (opener) {
      e.preventDefault();
      openSettingsModal(opener.getAttribute("data-settings-initial-tab") || "visual");
    }
  });

  if (closeBtn) closeBtn.addEventListener("click", closeSettingsModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeSettingsModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeSettingsModal();
  });

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-settings-tab") || "visual";
      if (targetTab === "datos") renderDataPane();
      if (targetTab === "version") renderVersionPane();
      if (targetTab === "offline" && typeof window.__btRefreshWebOfflineStatus === "function") {
        window.__btRefreshWebOfflineStatus();
      }
      switchSettingsTab(targetTab);
    });
  });

  if (btnOpenWelcome) {
    btnOpenWelcome.addEventListener("click", () => {
      closeSettingsModal();
      if (typeof window.__btOpenWelcomeModal === "function") {
        window.__btOpenWelcomeModal(1);
      }
    });
  }
  if (btnOpenWhatsNew) {
    btnOpenWhatsNew.addEventListener("click", () => {
      closeSettingsModal();
      if (typeof window.__btOpenWhatsNewModal === "function") {
        window.__btOpenWhatsNewModal();
      }
    });
  }
  if (btnSettingsDownloadOffline) {
    btnSettingsDownloadOffline.addEventListener("click", () => {
      if (typeof window.__btTriggerWebOfflineDownload === "function") {
        window.__btTriggerWebOfflineDownload();
      }
    });
  }
  if (btnSettingsCopyIosUrl) {
    btnSettingsCopyIosUrl.addEventListener("click", async () => {
      const url = "https://ey-liam.github.io/bibliotech-scouts/";
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        }
        showWebToast("Enlace copiado. Ábrelo en Safari y toca Agregar a pantalla de inicio.");
      } catch (_) {
        showWebToast(`Copia: ${url}`);
      }
    });
  }
  if (btnSettingsJumpAppSection) {
    btnSettingsJumpAppSection.addEventListener("click", () => {
      closeSettingsModal();
      btSwitchView("guia", { guideTab: "app" });
    });
  }

  if (btnLite) {
    btnLite.addEventListener("click", () => {
      BiblioFeel.setVisualMode("lite", true);
      BtSoundEngine.play("toggle");
      renderVisualControls();
      showWebToast("Modo Lite activado.");
    });
  }
  if (btnFull) {
    btnFull.addEventListener("click", () => {
      BiblioFeel.setVisualMode("full", true);
      BtSoundEngine.play("toggle");
      renderVisualControls();
      showWebToast("Modo Estándar activado.");
    });
  }

  if (soundChk) {
    soundChk.addEventListener("change", () => {
      BtSoundEngine.setEnabled(soundChk.checked, true);
      if (soundChk.checked) {
        BtSoundEngine.play("success");
        showWebToast("Sonidos interactivos activados.");
      } else {
        showWebToast("Sonidos silenciados.");
      }
    });
  }
  if (testSoundBtn) {
    testSoundBtn.addEventListener("click", () => {
      if (!BtSoundEngine.isEnabled()) {
        BtSoundEngine.setEnabled(true, true);
      }
      BtSoundEngine.play("success");
    });
  }

  if (contrastChk) {
    contrastChk.addEventListener("change", () => {
      const on = applyHighContrast(contrastChk.checked, true);
      BtSoundEngine.play("toggle");
      showWebToast(on ? "Modo de Alto Contraste activado." : "Alto Contraste desactivado.");
    });
  }

  if (campChk) {
    campChk.addEventListener("change", () => {
      BiblioFeel.toggleCampMode();
      BtSoundEngine.play("toggle");
    });
  }

  langBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const chosen = btn.getAttribute("data-lang-choice") || "es";
      applyUiLanguage(chosen, true);
      BtSoundEngine.play("toggle");
      showWebToast(chosen === "en" ? "Interface language set to English." : "Idioma de interfaz cambiado a Español.");
    });
  });

  if (btnJumpAutofill) {
    btnJumpAutofill.addEventListener("click", () => {
      closeSettingsModal();
      btSwitchView("formatos", { scrollToId: "autofillProfileForm" });
    });
  }

  const btnCopyDeviceUid = document.getElementById("btnCopyDeviceUid");
  if (btnCopyDeviceUid) {
    btnCopyDeviceUid.addEventListener("click", async () => {
      const code = getOrCreateAnonDeviceId();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(code);
        }
        showWebToast(`Código copiado: ${code}`);
      } catch (_) {
        showWebToast(`Tu código de dispositivo: ${code}`);
      }
    });
  }

  const btnJumpEjesFromSettings = document.getElementById("btnJumpEjesFromSettings");
  if (btnJumpEjesFromSettings) {
    btnJumpEjesFromSettings.addEventListener("click", () => {
      closeSettingsModal();
      btSwitchView("ejes", { ejesTab: "ambiente" });
    });
  }

  if (btnClearAutofill) {
    btnClearAutofill.addEventListener("click", () => {
      try {
        localStorage.removeItem(BT_AUTOFILL_PROFILE_KEY);
      } catch (_) {}
      const form = document.getElementById("autofillProfileForm");
      if (form) form.reset();
      const badge = document.getElementById("autofillStatusBadge");
      if (badge) {
        badge.classList.remove("is-ready");
        badge.textContent = "Sin datos guardados";
      }
      renderDataPane();
      showWebToast("Datos de autollenado borrados de este dispositivo.");
    });
  }
  window.__btRefreshSettingsDataPane = renderDataPane;
  if (btnSettingsExportAutofill) {
    btnSettingsExportAutofill.addEventListener("click", () => {
      if (typeof window.__btExportAutofillProfile === "function") window.__btExportAutofillProfile();
    });
  }
  if (btnSettingsImportAutofill) {
    btnSettingsImportAutofill.addEventListener("click", () => {
      if (typeof window.__btTriggerImportAutofillProfile === "function") window.__btTriggerImportAutofillProfile();
    });
  }

  if (savedListEl) {
    savedListEl.addEventListener("click", (e) => {
      const openBtn = e.target.closest("[data-st-open-doc]");
      if (openBtn) {
        const docId = openBtn.getAttribute("data-st-open-doc");
        closeSettingsModal();
        openDocumentModal(docId);
        return;
      }
      const remBtn = e.target.closest("[data-st-remove-doc]");
      if (remBtn) {
        const docId = remBtn.getAttribute("data-st-remove-doc");
        const pins = getSavedPins();
        if (pins.includes(docId)) toggleSavedPin(docId);
        setDocNote(docId, "");
        updateSavedBadge();
        renderDataPane();
        showWebToast("Archivo quitado de guardados.");
      }
    });
  }

  if (btnClearAllSaved) {
    btnClearAllSaved.addEventListener("click", () => {
      const ids = getSavedAndNotedDocIds();
      setSavedPins([]);
      for (const id of ids) setDocNote(id, "");
      updateSavedBadge();
      renderDataPane();
      showWebToast("Se vaciaron todos los archivos y notas guardados.");
    });
  }

  if (consentChk) {
    consentChk.addEventListener("change", () => {
      if (window.Capacitor) {
        consentChk.checked = true;
        showWebToast("En el APK Android la mejora anónima ya está integrada de forma segura.");
        return;
      }
      const accepted = consentChk.checked;
      try {
        localStorage.setItem(BT_CONSENT_KEY, accepted ? "accepted" : "declined");
        if (!accepted) {
          localStorage.removeItem(BT_ANON_QUEUE_KEY);
          localStorage.removeItem(BT_ANON_STATS_KEY);
        }
      } catch (_) {}
      renderRecentQueriesUI();
      if (accepted) setupFullActivityObservers();
      showWebToast(accepted ? "Preferencias de cookies y mejora continua activadas." : "Solo cookies esenciales activas.");
    });
  }

  if (btnClearRecents) {
    btnClearRecents.addEventListener("click", () => {
      try {
        localStorage.removeItem(BT_RECENT_QUERIES_KEY);
      } catch (_) {}
      renderRecentQueriesUI();
      showWebToast("Historial de preguntas recientes borrado.");
    });
  }

  if (btnOpenCookieModal) {
    btnOpenCookieModal.addEventListener("click", () => {
      closeSettingsModal();
      const overlay = document.getElementById("cookieConsentBanner");
      if (overlay) overlay.classList.remove("hidden");
    });
  }

  if (btnNativeApk) {
    btnNativeApk.addEventListener("click", () => {
      closeSettingsModal();
      if (window.__btNativeBridge && typeof window.__btNativeBridge.openModal === "function") {
        window.__btNativeBridge.openModal("app");
      }
    });
  }

  if (btnCheckReload) {
    btnCheckReload.addEventListener("click", async () => {
      if (updateStatusEl) {
        updateStatusEl.textContent = "Comprobando versión más reciente y limpiando caché local...";
        updateStatusEl.classList.remove("hidden");
      }
      btnCheckReload.disabled = true;

      if (window.Capacitor && window.__btNativeBridge && typeof window.__btNativeBridge.updateContent === "function") {
        closeSettingsModal();
        window.__btNativeBridge.updateContent(true, false);
        btnCheckReload.disabled = false;
        return;
      }

      try {
        const res = await btFetchWithTimeout(`version.json?t=${Date.now()}`, { cache: "no-store" }, 6000);
        const remote = res && res.ok ? await res.json().catch(() => null) : null;
        if (remote && remote.version && updateStatusEl) {
          updateStatusEl.textContent = `Versión en servidor: ${remote.version}. Aplicando recarga limpia...`;
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
          else if (reg && typeof reg.update === "function") await reg.update().catch(() => {});
        }
        setTimeout(() => window.location.reload(), 450);
      } catch (_) {
        if (updateStatusEl) {
          updateStatusEl.textContent = "No hubo conexión al servidor, recargando con la versión actual...";
        }
        setTimeout(() => window.location.reload(), 550);
      }
    });
  }
}

function initAdaptivePerfMode() {
  try {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = Boolean(navigator.connection && navigator.connection.saveData);
    const lowRam = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;
    const lowCpu = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4;
    const isLowEnd = Boolean(reduceMotion || saveData || lowRam || lowCpu);

    let visualMode = "lite";
    try {
      const savedVis = localStorage.getItem(BT_VISUAL_KEY);
      if (savedVis === "full" || savedVis === "lite") {
        visualMode = savedVis;
      } else {
        visualMode = isLowEnd ? "lite" : "full";
      }
    } catch (_) {
      visualMode = isLowEnd ? "lite" : "full";
    }
    if (reduceMotion) visualMode = "lite";

    root.dataset.btVisual = visualMode;
    root.dataset.btPerf = visualMode === "full" && !isLowEnd ? "standard" : "lite";

    let savedContrast = false;
    try {
      savedContrast = localStorage.getItem(BT_CONTRAST_KEY) === "true";
    } catch (_) {}
    root.setAttribute("data-bt-contrast", savedContrast ? "high" : "normal");

    let savedFontScale = "100";
    try {
      savedFontScale = localStorage.getItem(BT_FONT_SCALE_KEY) || "100";
    } catch (_) {}
    root.setAttribute("data-bt-font-scale", ["100", "115", "130"].includes(savedFontScale) ? savedFontScale : "100");

    let savedLang = "es";
    try {
      savedLang = localStorage.getItem(BT_LANG_KEY) === "en" ? "en" : "es";
    } catch (_) {}
    root.dataset.btLang = savedLang;
    if (savedLang === "en") {
      document.addEventListener("DOMContentLoaded", () => applyUiLanguage("en", false), { once: true });
    }
  } catch (_) {}
}
initAdaptivePerfMode();

document.addEventListener("DOMContentLoaded", initApp);
