/**
 * DIRECTOR ENGINE — BIBLIOTECH SCOUT (160 BPM)
 * Controla la página real de forma cinemática sin romper estilos ni layouts.
 * 1 Beat = 0.375s | 1 Compás = 1.50s | Loop = 46.5s (31 compases)
 */

(function () {
  'use strict';

  if (window.__BIBLIOTECH_DIRECTOR_ACTIVE__) {
    console.log('El Director ya se encuentra activo.');
    return;
  }
  window.__BIBLIOTECH_DIRECTOR_ACTIVE__ = true;

  const BPM = 160;
  const BEAT_DURATION = 60 / BPM; // 0.375s
  const BAR_DURATION = BEAT_DURATION * 4; // 1.50s
  const TOTAL_DURATION = 46.5; // Loop perfecto a 31 compases

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

  // 2. Estilos de iluminación cinemática y enfoque (sin transformar el body para no romper position: fixed)
  const style = document.createElement('style');
  style.id = 'director-cinema-styles';
  style.innerHTML = `
    /* Enfoque cinemático con destello */
    .director-highlight {
      box-shadow: 0 0 0 4px #7c3aed, 0 0 35px rgba(124, 58, 237, 0.6) !important;
      transform: scale(1.04) !important;
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      z-index: 50 !important;
    }
    .director-clap-highlight {
      box-shadow: 0 0 0 4px #f59e0b, 0 0 45px rgba(245, 158, 11, 0.8) !important;
      transform: scale(1.08) translateY(-6px) !important;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      z-index: 55 !important;
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

  // 3. Crear HUD de control
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

  // 4. Elementos del DOM a coreografiar
  const searchInput = document.getElementById('searchInput');
  const searchSection = document.getElementById('buscador');
  const heroSection = document.getElementById('inicio');
  const seccionesSection = document.getElementById('secciones');
  const agentesSection = document.getElementById('agentes');
  const bibliotecaSection = document.getElementById('biblioteca');
  const propositoSection = document.getElementById('acerca');

  // Tarjetas de secciones (Manada, Tropa, Comunidad, Clan)
  const secCards = document.querySelectorAll('.scout-sec-card');

  // 5. Función de scroll cinemático suave
  function scrollToElement(el, offset = 0) {
    if (!el) return;
    const targetY = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
  }

  // 6. Bucle principal de animación anclado al reloj de audio
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

      // Se ejecuta exactamente en cada beat
      if (currentBeat !== lastBeat) {
        lastBeat = currentBeat;
        onDirectorBeat(currentBeat, currentBar, beatInBar, isClap, t);
      }
    }

    animId = requestAnimationFrame(directorLoop);
  }

  // 7. Coreografía cinematográfica de la web real
  function onDirectorBeat(beat, bar, beatInBar, isClap, t) {
    // Limpiar resaltados previos
    document.querySelectorAll('.director-highlight, .director-clap-highlight').forEach(el => {
      el.classList.remove('director-highlight', 'director-clap-highlight');
    });

    // ----------------------------------------------------
    // COMPASES 1–2 (0.0s – 3.0s): HERO & TRÍO DE FOTOS
    // ----------------------------------------------------
    if (bar <= 2) {
      if (bar === 1 && beatInBar === 1) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      const centerHex = document.querySelector('.hero-hex-center, .hero-showcase-grid');
      if (centerHex) {
        centerHex.classList.add(isClap ? 'director-clap-highlight' : 'director-highlight');
      }
    }

    // ----------------------------------------------------
    // COMPASES 3–8 (3.0s – 12.0s): ZOOM AL BUSCADOR & ESCRITURA
    // ----------------------------------------------------
    else if (bar >= 3 && bar <= 8) {
      if (bar === 3 && beatInBar === 1) {
        scrollToElement(searchSection, 80);
      }

      if (searchInput) {
        searchInput.classList.add(isClap ? 'director-clap-highlight' : 'director-highlight');

        // Escritura progresiva en compases 4 a 6
        if (bar >= 4 && bar <= 6) {
          const query = '¿Qué son ExplorApp y CarpetApp?';
          const prog = Math.min(1, (t - 4.5) / 3.0);
          const chars = Math.floor(prog * query.length);
          searchInput.value = query.substring(0, chars);
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // En compás 7 dispara búsqueda si está la función disponible
        if (bar === 7 && beatInBar === 1) {
          if (typeof window.executeSearch === 'function') {
            window.executeSearch(searchInput.value);
          }
        }
      }
    }

    // ----------------------------------------------------
    // COMPASES 9–13 (12.0s – 19.5s): SECCIONES SCOUTS
    // ----------------------------------------------------
    else if (bar >= 9 && bar <= 13) {
      if (bar === 9 && beatInBar === 1) {
        scrollToElement(seccionesSection, 90);
      }

      // En el pre-drop (Compás 13: HUH!)
      if (bar === 13) {
        const titleSec = seccionesSection ? seccionesSection.querySelector('h2') : null;
        if (titleSec) titleSec.classList.add('director-clap-highlight');
      }
    }

    // ----------------------------------------------------
    // COMPASES 14–17 (19.5s – 25.5s): ¡DROP DEL CORO!
    // "BECAUSE I'M HAPPY! Clap along..."
    // Las 4 Secciones saltan en cada palmada (beats 2 y 4)
    // ----------------------------------------------------
    else if (bar >= 14 && bar <= 17) {
      if (bar === 14 && beatInBar === 1) {
        scrollToElement(seccionesSection, 90);
      }

      if (secCards && secCards.length >= 4) {
        // En los claps (beats 2 y 4), se ilumina una sección scout
        const activeCardIndex = (beat % 4);
        const card = secCards[activeCardIndex];
        if (card) {
          card.classList.add('director-clap-highlight');
        }
      }
    }

    // ----------------------------------------------------
    // COMPASES 18–22 (25.5s – 33.0s): AGENTES DE CAMBIO.MX
    // ----------------------------------------------------
    else if (bar >= 18 && bar <= 22) {
      if (bar === 18 && beatInBar === 1) {
        scrollToElement(agentesSection, 80);
      }

      // Resaltar los 4 Ejes Temáticos en rotación
      const orbs = document.querySelectorAll('.adc-icon-orb');
      if (orbs && orbs.length > 0) {
        const orbIndex = (beat % orbs.length);
        orbs[orbIndex].classList.add(isClap ? 'director-clap-highlight' : 'director-highlight');
      }
    }

    // ----------------------------------------------------
    // COMPASES 23–27 (33.0s – 40.5s): BIBLIOTECA DEL CENTENARIO
    // ----------------------------------------------------
    else if (bar >= 23 && bar <= 27) {
      if (bar === 23 && beatInBar === 1) {
        scrollToElement(bibliotecaSection, 80);
      }

      const bookCards = document.querySelectorAll('.doc-card, .book-card, .centenario-book-pill');
      if (bookCards && bookCards.length > 0) {
        const bIdx = (beat % Math.min(bookCards.length, 6));
        bookCards[bIdx].classList.add(isClap ? 'director-clap-highlight' : 'director-highlight');
      }
    }

    // ----------------------------------------------------
    // COMPASES 28–31 (40.5s – 46.5s): CIERRE Y REGRESO A INICIO
    // ----------------------------------------------------
    else if (bar >= 28) {
      if (bar === 28 && beatInBar === 1) {
        scrollToElement(propositoSection || heroSection, 80);
      }

      if (bar === 30) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  // 8. Eventos de los botones del HUD
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
    hud.remove();
    style.remove();
    window.__BIBLIOTECH_DIRECTOR_ACTIVE__ = false;
    console.log('Modo Director finalizado.');
  });

  // 9. Iniciar automáticamente la reproducción
  window.scrollTo({ top: 0, behavior: 'instant' });
  audio.currentTime = 0;
  audio.play().then(() => {
    console.log('Director iniciado exitosamente a 160 BPM.');
    directorLoop();
  }).catch(() => {
    dPlayPause.textContent = '▶ Iniciar Audio';
    directorLoop();
  });

})();
