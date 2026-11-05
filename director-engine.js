/**
 * DIRECTOR ENGINE PRO — BIBLIOTECH SCOUT (160 BPM)
 * Coreografia cinematografica fluida, 100% en orden descendente de inicio a fin.
 * 
 * 7 Capitulos Oficiales:
 * [1/7] Inicio: Colección Centenario 1926–2026 y Trío Hexagonal
 * [2/7] Buscador Inteligente: ExplorApp y CarpetApp en Vivo
 * [3/7] Guía Paso a Paso: Grupos, SISAS, Eventos y Comités CPRC/CNRC
 * [4/7] ¡DROP DEL CORO!: Biblioteca Oficial del Centenario (498 Docs)
 * [5/7] Agentes de Cambio CNRC: Los 4 Ejes Temáticos
 * [6/7] Las 4 Secciones del Escultismo: Manada, Tropa, Comunidad, Clan
 * [7/7] Directorio de Servicios Oficiales y Retorno a Inicio (Seamless Loop)
 *
 * BPM: 160 | 1 Beat = 0.375s | 1 Compas (4 Beats) = 1.50s | Loop = 46.50s (31 compases)
 */

(function () {
  'use strict';

  if (window.__BIBLIOTECH_DIRECTOR_ACTIVE__) {
    console.log('[Director] Ya se encuentra activo.');
    return;
  }
  window.__BIBLIOTECH_DIRECTOR_ACTIVE__ = true;

  const BPM = 160;
  const BEAT_DURATION = 60 / BPM; // 0.375s
  const BAR_DURATION = BEAT_DURATION * 4; // 1.50s
  const TOTAL_DURATION = 46.5; // 31 compases exactos de 'Happy'

  // 1. Audio
  let audio = document.getElementById('directorAudio');
  if (!audio) {
    audio = new Audio();
    audio.id = 'directorAudio';
    audio.src = 'assets/audio/promo-audio.mp3';
    audio.preload = 'auto';
    audio.loop = true;
    document.body.appendChild(audio);
  }

  // 2. Estilos cinemáticos para el sitio web real
  const style = document.createElement('style');
  style.id = 'director-cinema-styles';
  style.innerHTML = `
    /* Resaltados al ritmo de la música */
    .director-highlight {
      box-shadow: 0 0 0 3px #7c3aed, 0 0 30px rgba(124, 58, 237, 0.6) !important;
      transform: scale(1.03) !important;
      transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      z-index: 40 !important;
      position: relative !important;
    }
    .director-clap-highlight {
      box-shadow: 0 0 0 4px #f59e0b, 0 0 45px rgba(245, 158, 11, 0.85) !important;
      transform: scale(1.06) translateY(-4px) !important;
      transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      z-index: 50 !important;
      position: relative !important;
    }

    /* Píldora de Capítulo Flotante Cinemática */
    .director-chapter-banner {
      position: fixed;
      top: 76px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1.5px solid rgba(124, 58, 237, 0.5);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(124, 58, 237, 0.3);
      padding: 6px 18px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: 0.82rem;
      color: #ffffff;
      pointer-events: none;
      transition: all 0.35s cubic-bezier(0.22, 1, 0.36, 1);
      white-space: nowrap;
    }
    .director-chapter-banner .badge-pill {
      background: linear-gradient(135deg, #7c3aed, #0284c7);
      color: #ffffff;
      font-weight: 900;
      font-size: 0.72rem;
      padding: 3px 10px;
      border-radius: 999px;
      letter-spacing: 0.5px;
    }
    .director-chapter-banner .title-text {
      font-weight: 700;
      color: #e2e8f0;
    }

    /* HUD de control en vivo */
    .director-floating-hud {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border: 1.5px solid rgba(124, 58, 237, 0.6);
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.7), 0 0 25px rgba(124, 58, 237, 0.4);
      padding: 10px 18px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: #ffffff;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: 0.84rem;
      font-weight: 700;
      user-select: none;
    }
    .director-hud-led {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #334155;
      transition: transform 0.06s ease, background 0.06s ease, box-shadow 0.06s ease;
    }
    .director-hud-led.active {
      background: #22c55e;
      transform: scale(1.4);
      box-shadow: 0 0 14px #22c55e;
    }
    .director-hud-led.clap {
      background: #f59e0b;
      transform: scale(1.6);
      box-shadow: 0 0 18px #f59e0b;
    }
    .director-hud-btn {
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      font-family: inherit;
      font-size: 0.78rem;
      font-weight: 800;
      padding: 5px 12px;
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .director-hud-btn:hover {
      background: rgba(124, 58, 237, 0.5);
    }
    .director-hud-close {
      color: #fca5a5;
      cursor: pointer;
      font-weight: 900;
      margin-left: 4px;
    }
  `;
  document.head.appendChild(style);

  // 3. Crear Píldora de Capítulo Flotante
  const chapterBanner = document.createElement('div');
  chapterBanner.className = 'director-chapter-banner';
  chapterBanner.id = 'directorChapterBanner';
  chapterBanner.innerHTML = `
    <span class="badge-pill" id="dChBadge">CAPÍTULO 1/7</span>
    <span class="title-text" id="dChTitle">Inicio Oficial • Centenario 1926–2026</span>
  `;
  document.body.appendChild(chapterBanner);
  const dChBadge = document.getElementById('dChBadge');
  const dChTitle = document.getElementById('dChTitle');

  // 4. Crear HUD de control
  const hud = document.createElement('div');
  hud.className = 'director-floating-hud';
  hud.id = 'directorHud';
  hud.innerHTML = `
    <div class="director-hud-led" id="dLed"></div>
    <span id="dStatus">160 BPM • Compás 01</span>
    <button type="button" class="director-hud-btn" id="dPlayPause">⏸ Pausar</button>
    <button type="button" class="director-hud-btn" id="dReset">↺ Inicio</button>
    <span class="director-hud-close" id="dClose" title="Cerrar Modo Director">✕</span>
  `;
  document.body.appendChild(hud);

  const dLed = document.getElementById('dLed');
  const dStatus = document.getElementById('dStatus');
  const dPlayPause = document.getElementById('dPlayPause');
  const dReset = document.getElementById('dReset');
  const dClose = document.getElementById('dClose');

  let isRunning = true;
  let animId = null;
  let lastBeat = -1;
  let currentChapter = 0;

  // 5. Elementos del DOM a coreografiar (en orden físico real de arriba a abajo)
  const heroSection = document.getElementById('inicio');
  const searchSection = document.getElementById('buscador');
  const askInput = document.getElementById('askInput') || document.getElementById('searchInput');
  const answerContainer = document.getElementById('answerContainer');
  const guiaSection = document.getElementById('guia-inicio');
  const bibliotecaSection = document.getElementById('biblioteca');
  const agentesSection = document.getElementById('agentes');
  const seccionesSection = document.getElementById('secciones');
  const serviciosSection = document.getElementById('servicios');

  // 6. Función de scroll cinemático fluido y centrado
  function scrollToElement(el, extraOffset = 80) {
    if (!el) return;
    const targetY = el.getBoundingClientRect().top + window.scrollY - extraOffset;
    window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
  }

  function setChapter(num, badge, title) {
    if (currentChapter !== num) {
      currentChapter = num;
      dChBadge.textContent = badge;
      dChTitle.textContent = title;
      chapterBanner.style.transform = 'translateX(-50%) scale(1.1)';
      setTimeout(() => {
        chapterBanner.style.transform = 'translateX(-50%) scale(1.0)';
      }, 200);
    }
  }

  // 7. Bucle principal de animación anclado al reloj de audio
  function directorLoop() {
    if (!isRunning) return;

    if (!audio.paused) {
      const t = audio.currentTime;

      // Loop sin costuras a los 46.5 segundos
      if (t >= TOTAL_DURATION) {
        audio.currentTime = 0;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      const currentBeat = Math.floor(t / BEAT_DURATION);
      const currentBar = Math.floor(t / BAR_DURATION) + 1;
      const beatInBar = (currentBeat % 4) + 1;
      const isClap = (beatInBar === 2 || beatInBar === 4);

      // Pulso del LED
      const subBeat = (t % BEAT_DURATION) / BEAT_DURATION;
      if (subBeat < 0.28) {
        dLed.className = isClap ? 'director-hud-led clap' : 'director-hud-led active';
      } else {
        dLed.className = 'director-hud-led';
      }

      dStatus.textContent = `160 BPM • Compás ${String(currentBar).padStart(2, '0')} [Beat ${beatInBar}]`;

      // Ejecución exacta en cada beat musical
      if (currentBeat !== lastBeat) {
        lastBeat = currentBeat;
        onDirectorBeat(currentBeat, currentBar, beatInBar, isClap, t);
      }
    }

    animId = requestAnimationFrame(directorLoop);
  }

  // 8. Coreografía cinematográfica en estricto orden físico de arriba a abajo
  function onDirectorBeat(beat, bar, beatInBar, isClap, t) {
    // Limpiar resaltados previos
    document.querySelectorAll('.director-highlight, .director-clap-highlight').forEach(el => {
      el.classList.remove('director-highlight', 'director-clap-highlight');
    });

    // =========================================================================
    // CAPÍTULO 1: COMPASES 1–3 (0.0s – 4.5s) -> HERO & COLECCIÓN CENTENARIO
    // =========================================================================
    if (bar <= 3) {
      setChapter(1, 'CAPÍTULO 1/7', 'Hero Oficial • Colección Centenario 1926–2026');

      if (bar === 1 && beatInBar === 1) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // Trío hexagonal y contadores
      const hexTrio = document.querySelector('.hero-hex-trio');
      if (hexTrio) {
        hexTrio.classList.add(isClap ? 'director-clap-highlight' : 'director-highlight');
      }

      const stats = document.querySelectorAll('.hero-stat');
      if (stats && stats.length > 0) {
        const sIdx = (beat % stats.length);
        stats[sIdx].classList.add('director-highlight');
      }
    }

    // =========================================================================
    // CAPÍTULO 2: COMPASES 4–8 (4.5s – 12.0s) -> BUSCADOR OFICIAL INTELIGENTE
    // =========================================================================
    else if (bar >= 4 && bar <= 8) {
      setChapter(2, 'CAPÍTULO 2/7', 'Buscador Oficial • ¿Qué son ExplorApp y CarpetApp?');

      if (bar === 4 && beatInBar === 1) {
        scrollToElement(searchSection, 90);
      }

      if (askInput) {
        askInput.classList.add(isClap ? 'director-clap-highlight' : 'director-highlight');

        // Escritura progresiva en compases 4 a 6
        if (bar >= 4 && bar <= 6) {
          const query = '¿Qué son ExplorApp y CarpetApp?';
          const prog = Math.min(1, (t - 4.5) / 3.0);
          const chars = Math.floor(prog * query.length);
          askInput.value = query.substring(0, chars);
          askInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // En compás 7 (beat 1): Disparar la búsqueda oficial
        if (bar === 7 && beatInBar === 1) {
          if (typeof window.submitQuestion === 'function') {
            window.submitQuestion('¿Qué son ExplorApp y CarpetApp?');
          } else {
            const btn = document.getElementById('searchBtn') || document.querySelector('.search-btn');
            if (btn) btn.click();
          }
        }
      }

      // Si el contenedor de respuesta está visible, resaltarlo en compás 7 y 8
      if (bar >= 7 && answerContainer && !answerContainer.classList.contains('hidden')) {
        answerContainer.classList.add(isClap ? 'director-clap-highlight' : 'director-highlight');
      }
    }

    // =========================================================================
    // CAPÍTULO 3: COMPASES 9–13 (12.0s – 19.5s) -> GUÍA PASO A PASO Y PRIMEROS PASOS
    // =========================================================================
    else if (bar >= 9 && bar <= 13) {
      setChapter(3, 'CAPÍTULO 3/7', 'Guía Paso a Paso • Grupos, SISAS, Eventos y Comités');

      if (bar === 9 && beatInBar === 1) {
        scrollToElement(guiaSection, 80);
      }

      const starterCards = document.querySelectorAll('#guia-inicio .starter-3d-card');
      if (starterCards && starterCards.length > 0) {
        const cIdx = Math.min(starterCards.length - 1, bar - 9);
        starterCards[cIdx].classList.add(isClap ? 'director-clap-highlight' : 'director-highlight');
      }

      // Compás 13 (Pre-drop: HUH!): Tensión previa al coro
      if (bar === 13) {
        const titleGuia = guiaSection ? guiaSection.querySelector('.section-title') : null;
        if (titleGuia) titleGuia.classList.add('director-clap-highlight');
      }
    }

    // =========================================================================
    // CAPÍTULO 4: COMPASES 14–18 (19.5s – 27.0s) -> ¡DROP DEL CORO! BIBLIOTECA OFICIAL
    // "BECAUSE I'M HAPPY! Clap along if you feel..."
    // =========================================================================
    else if (bar >= 14 && bar <= 18) {
      setChapter(4, 'CAPÍTULO 4/7', '¡DROP DEL CORO! • Biblioteca del Centenario (498 Docs)');

      if (bar === 14 && beatInBar === 1) {
        scrollToElement(bibliotecaSection, 80);
      }

      // Los estantes y los libros saltan enérgicamente en las palmadas (beats 2 y 4)
      const shelfTabs = document.querySelectorAll('.shelf-tab');
      if (shelfTabs && shelfTabs.length > 0) {
        const sTab = shelfTabs[(beat % shelfTabs.length)];
        sTab.classList.add('director-highlight');
      }

      const bookCards = document.querySelectorAll('.doc-card, .book-card, .mini-polaroid-card');
      if (bookCards && bookCards.length > 0) {
        const bIdx = (beat % Math.min(bookCards.length, 6));
        bookCards[bIdx].classList.add(isClap ? 'director-clap-highlight' : 'director-highlight');
      }

      const centenarioBtn = document.querySelector('.btn-centenario-shelf');
      if (centenarioBtn && isClap) {
        centenarioBtn.classList.add('director-clap-highlight');
      }
    }

    // =========================================================================
    // CAPÍTULO 5: COMPASES 19–22 (27.0s – 33.0s) -> AGENTES DE CAMBIO CNRC (4 EJES)
    // =========================================================================
    else if (bar >= 19 && bar <= 22) {
      setChapter(5, 'CAPÍTULO 5/7', 'Agentes de Cambio CNRC • Los 4 Ejes Temáticos');

      if (bar === 19 && beatInBar === 1) {
        scrollToElement(agentesSection, 80);
      }

      // Rotación y pulso rítmico de los 4 Ejes
      const orbs = document.querySelectorAll('.adc-icon-orb, .adc-eje-card');
      if (orbs && orbs.length > 0) {
        const orbIndex = (beat % orbs.length);
        orbs[orbIndex].classList.add(isClap ? 'director-clap-highlight' : 'director-highlight');
      }
    }

    // =========================================================================
    // CAPÍTULO 6: COMPASES 23–27 (33.0s – 40.5s) -> LAS 4 SECCIONES SCOUTS
    // =========================================================================
    else if (bar >= 23 && bar <= 27) {
      setChapter(6, 'CAPÍTULO 6/7', 'Las 4 Secciones Scouts • Manada, Tropa, Comunidad, Clan');

      if (bar === 23 && beatInBar === 1) {
        scrollToElement(seccionesSection, 80);
      }

      const secCards = document.querySelectorAll('.scout-sec-card');
      if (secCards && secCards.length >= 4) {
        // En los claps salta la sección correspondiente
        const activeCardIndex = (beat % 4);
        secCards[activeCardIndex].classList.add(isClap ? 'director-clap-highlight' : 'director-highlight');
      }
    }

    // =========================================================================
    // CAPÍTULO 7: COMPASES 28–31 (40.5s – 46.5s) -> SERVICIOS, AUTORÍA Y RETORNO
    // =========================================================================
    else if (bar >= 28) {
      setChapter(7, 'CAPÍTULO 7/7', 'Servicios Oficiales • ey-liam.github.io/bibliotech-scouts');

      if (bar === 28 && beatInBar === 1) {
        scrollToElement(serviciosSection || heroSection, 80);
      }

      const servCards = document.querySelectorAll('.service-info-card');
      if (servCards && servCards.length > 0) {
        const sIdx = (beat % servCards.length);
        servCards[sIdx].classList.add(isClap ? 'director-clap-highlight' : 'director-highlight');
      }

      // En compás 30.5 – 31: Transición suave hacia el inicio para el loop continuo
      if (bar === 30 && beatInBar >= 3) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  // 9. Eventos de los botones del HUD
  dPlayPause.addEventListener('click', () => {
    if (audio.paused) {
      audio.play();
      dPlayPause.textContent = '⏸ Pausar';
    } else {
      audio.pause();
      dPlayPause.textContent = '▶ Reproducir';
    }
  });

  dReset.addEventListener('click', () => {
    audio.currentTime = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  dClose.addEventListener('click', () => {
    isRunning = false;
    audio.pause();
    if (animId) cancelAnimationFrame(animId);
    document.querySelectorAll('.director-highlight, .director-clap-highlight').forEach(el => {
      el.classList.remove('director-highlight', 'director-clap-highlight');
    });
    if (hud) hud.remove();
    if (chapterBanner) chapterBanner.remove();
    if (style) style.remove();
    window.__BIBLIOTECH_DIRECTOR_ACTIVE__ = false;
    console.log('[Director] Finalizado.');
  });

  // 10. Iniciar automáticamente la reproducción y sincronización
  window.scrollTo({ top: 0, behavior: 'instant' });
  audio.currentTime = 0;
  audio.play().then(() => {
    console.log('[Director] Sincronizado exitosamente a 160 BPM en 7 capítulos ordenados.');
    directorLoop();
  }).catch(() => {
    dPlayPause.textContent = '▶ Iniciar Audio';
    directorLoop();
  });

})();
