/**
 * MOTOR PROMO ANTIGRAVITY 160 BPM — BIBLIOTECH SCOUT
 * Basado en las especificaciones de coreografía rítmica a 160 BPM (Happy)
 * 1 Beat = 0.375s (375ms) | 1 Compás (4 beats) = 1.50s (1500ms)
 * Compatible con inyección directa en consola F12 o mediante etiqueta script.
 */

(function () {
  'use strict';

  // Evitar inyecciones duplicadas
  if (window.__ANTIGRAVITY_PROMO_RUNNING__) {
    console.log('El modo promo Antigravity ya se encuentra activo.');
    return;
  }
  window.__ANTIGRAVITY_PROMO_RUNNING__ = true;

  const BPM = 160;
  const BEAT_DURATION = 60 / BPM; // 0.375 s exactos
  const BAR_DURATION = BEAT_DURATION * 4; // 1.50 s por compás
  const TOTAL_DURATION = 46.5; // Loop perfecto para TikTok / Reels

  // 1. Localizar o crear el elemento de audio
  let audio = document.getElementById('antigravityAudio');
  if (!audio) {
    audio = new Audio();
    audio.id = 'antigravityAudio';
    // Múltiples rutas de respaldo para que funcione local y en GitHub Pages
    const sources = [
      'assets/audio/promo-audio.mp3',
      'assets/audio/promo-audio.wav',
      'happy-160bpm.mp3',
      'Happy 160 Bpm Loop.wav'
    ];
    audio.src = sources[0];
    audio.loop = true;
    document.body.appendChild(audio);
  }

  // 2. Inyectar estilos de física "Antigravity" + Motion Graphics en el DOM real
  const styleId = 'antigravity-promo-styles';
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      body.antigravity-active {
        perspective: 1400px !important;
        transform-style: preserve-3d !important;
        overflow-x: hidden !important;
        transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1) !important;
        transform-origin: center top !important;
      }
      .antigravity-float {
        transition: transform 0.375s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.375s ease !important;
        will-change: transform;
      }
      .beat-pulse {
        transform: translateY(-12px) scale(1.06) rotateZ(1.2deg) !important;
        box-shadow: 0 20px 40px rgba(124, 58, 237, 0.4) !important;
      }
      .clap-pulse {
        transform: translateY(-18px) scale(1.09) rotateZ(-1.5deg) !important;
        box-shadow: 0 25px 50px rgba(245, 158, 11, 0.5) !important;
      }
      /* Barra flotante de control de la promo */
      .antigravity-hud {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 12px;
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        padding: 8px 18px;
        border-radius: 999px;
        border: 1.5px solid rgba(124, 58, 237, 0.5);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 25px rgba(124, 58, 237, 0.3);
        color: #f8fafc;
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        font-size: 0.85rem;
        font-weight: 700;
      }
      .antigravity-hud-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #334155;
        transition: all 0.08s ease;
      }
      .antigravity-hud-dot.active {
        background: #22c55e;
        transform: scale(1.4);
        box-shadow: 0 0 12px #22c55e;
      }
      .antigravity-hud-dot.clap {
        background: #f59e0b;
        transform: scale(1.6);
        box-shadow: 0 0 16px #f59e0b;
      }
      .antigravity-hud-btn {
        background: rgba(255, 255, 255, 0.12);
        border: none;
        color: #fff;
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 800;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .antigravity-hud-btn:hover {
        background: rgba(255, 255, 255, 0.25);
      }
      .antigravity-hud-close {
        color: #f87171;
        cursor: pointer;
        font-weight: 900;
        padding: 0 4px;
      }
    `;
    document.head.appendChild(style);
  }

  // Elementos clave del sitio para aplicarles flotación rítmica
  const uiCards = document.querySelectorAll('article, .starter-card, .scout-sec-card, .book-card, button, input, .stat-pill, .adc-icon-orb');
  uiCards.forEach((el) => el.classList.add('antigravity-float'));

  // 3. Crear el HUD indicador en pantalla
  const hud = document.createElement('div');
  hud.className = 'antigravity-hud';
  hud.innerHTML = `
    <div class="antigravity-hud-dot" id="agDot"></div>
    <span id="agStatus">160 BPM • Compás 01 [Beat 1]</span>
    <button type="button" class="antigravity-hud-btn" id="agPlayPause">⏸ Pausar</button>
    <span class="antigravity-hud-close" id="agClose" title="Cerrar modo promo">✕</span>
  `;
  document.body.appendChild(hud);

  const agDot = document.getElementById('agDot');
  const agStatus = document.getElementById('agStatus');
  const agPlayPause = document.getElementById('agPlayPause');
  const agClose = document.getElementById('agClose');

  let lastBeat = -1;
  let isRunning = true;
  let animId = null;

  // Activar estilos en body
  document.body.classList.add('antigravity-active');

  // 4. Reloj maestro de animación anclado a audio.currentTime
  function renderLoop() {
    if (!isRunning) return;

    if (!audio.paused) {
      const currentTime = audio.currentTime;

      // Loop automático a los 46.5 segundos para TikTok / Reels
      if (currentTime >= TOTAL_DURATION) {
        audio.currentTime = 0;
        window.scrollTo({ top: 0, behavior: 'instant' });
      }

      const currentBeat = Math.floor(currentTime / BEAT_DURATION);
      const currentBar = Math.floor(currentTime / BAR_DURATION) + 1;
      const beatInBar = (currentBeat % 4) + 1;

      // Pulso visual del LED en cada tiempo
      const subBeat = (currentTime % BEAT_DURATION) / BEAT_DURATION;
      if (subBeat < 0.28) {
        const isClap = beatInBar === 2 || beatInBar === 4;
        agDot.className = isClap ? 'antigravity-hud-dot clap' : 'antigravity-hud-dot active';
      } else {
        agDot.className = 'antigravity-hud-dot';
      }

      agStatus.textContent = `160 BPM • Compás ${String(currentBar).padStart(2, '0')} [Beat ${beatInBar}]`;

      // Se ejecuta exactamente en cada Beat (0.375s)
      if (currentBeat !== lastBeat) {
        lastBeat = currentBeat;
        onBeat(currentBeat, currentBar, currentTime);
      }
    }

    animId = requestAnimationFrame(renderLoop);
  }

  // 5. Coreografía exacta por Beats y Compases
  function onBeat(beat, bar, time) {
    const beatInBar = (beat % 4) + 1;

    // Pulso general de cámara en los tiempos de tarola/clap (2 y 4)
    if (beatInBar === 2 || beatInBar === 4) {
      document.body.style.transform += ' scale(1.02)';
    }

    // --- ESCENA 1: INTRO (0:00 - 0:03 | Compases 1-2) ---
    if (bar <= 2) {
      const tiltX = 12;
      const tiltY = (beat % 2 === 0) ? -8 : 8;
      document.body.style.transform = `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(0.94)`;
    }

    // --- ESCENA 2: VERSO - BUSCADOR Y CONTADORES (0:03 - 0:12 | Compases 3-8) ---
    else if (bar >= 3 && bar <= 8) {
      const input = document.getElementById('searchInput') || document.querySelector('input[type="text"], input[type="search"]');
      if (input && beat === 12) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Escritura progresiva en el buscador real
      if (input && bar >= 4 && bar <= 6) {
        const fullText = '¿Qué son ExplorApp y CarpetApp?';
        const progress = Math.min(1, (time - 4.5) / 3.0);
        const chars = Math.floor(progress * fullText.length);
        input.value = fullText.substring(0, chars);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const tiltY = (beat % 2 === 0) ? -4 : 4;
      document.body.style.transform = `perspective(1200px) rotateX(4deg) rotateY(${tiltY}deg) scale(1.18)`;
    }

    // --- ESCENA 3: EXPLORACIÓN DE ESTANTES Y SECCIONES (0:12 - 0:24 | Compases 9-16) ---
    else if (bar >= 9 && bar <= 16) {
      if (beatInBar === 1) {
        window.scrollBy({ top: 260, behavior: 'smooth' });
      }
      const tiltX = (beat % 2 === 0) ? 7 : 2;
      document.body.style.transform = `perspective(1200px) rotateX(${tiltX}deg) rotateY(-7deg) scale(0.98)`;
    }

    // --- ESCENA 4: PRE-DROP "BECAUSE I'M HAPPY" (0:24 - 0:25.5 | Compás 17) ---
    else if (bar === 17) {
      // Contracción dramática preparatoria para el drop
      document.body.style.transform = `perspective(1200px) rotateX(0deg) rotateY(0deg) scale(0.84)`;
    }

    // --- ESCENA 5: EL CORO "CLAP ALONG" - ANTIGRAVITY TOTAL (0:25.5 - 0:46.5 | Compás 18+) ---
    else if (bar >= 18) {
      const angleY = (bar % 2 === 0) ? 10 : -10;
      const isClap = (beatInBar === 2 || beatInBar === 4);
      const scaleKick = isClap ? 1.07 : 0.96;
      document.body.style.transform = `perspective(1200px) rotateX(8deg) rotateY(${angleY}deg) scale(${scaleKick})`;

      // Flotación y pulso en las tarjetas al ritmo de las palmas
      uiCards.forEach((card, index) => {
        if ((index + beat) % 3 === 0) {
          const cls = isClap ? 'clap-pulse' : 'beat-pulse';
          card.classList.add(cls);
          setTimeout(() => card.classList.remove(cls), BEAT_DURATION * 850);
        }
      });
    }
  }

  // 6. Controles de usuario
  agPlayPause.addEventListener('click', () => {
    if (audio.paused) {
      audio.play();
      agPlayPause.textContent = '⏸ Pausar';
    } else {
      audio.pause();
      agPlayPause.textContent = '▶ Continuar';
    }
  });

  agClose.addEventListener('click', () => {
    isRunning = false;
    audio.pause();
    if (animId) cancelAnimationFrame(animId);
    document.body.classList.remove('antigravity-active');
    document.body.style.transform = '';
    hud.remove();
    window.__ANTIGRAVITY_PROMO_RUNNING__ = false;
    console.log('Modo promo Antigravity finalizado.');
  });

  // Iniciar automáticamente la reproducción
  window.scrollTo({ top: 0, behavior: 'instant' });
  audio.currentTime = 0;
  audio.play().then(() => {
    console.log('Modo Promo Antigravity 160 BPM iniciado exitosamente.');
    renderLoop();
  }).catch((err) => {
    console.log('Autoplay bloqueado. Haz clic en el botón para iniciar.');
    agPlayPause.textContent = '▶ Iniciar Audio';
    renderLoop();
  });

})();
