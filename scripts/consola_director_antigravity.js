// ========================================================
// COPIAR Y PEGAR EN LA CONSOLA (F12) DE GOOGLE CHROME / EDGE
// En https://ey-liam.github.io/bibliotech-scouts/ o localhost
// ========================================================

(function () {
  const BPM = 160;
  const BEAT_DURATION = 60 / BPM; // 0.375s
  const BAR_DURATION = BEAT_DURATION * 4; // 1.5s
  const TOTAL_DURATION = 46.5;

  // 1. Audio a 160 BPM
  const audio = new Audio('assets/audio/promo-audio.mp3');
  audio.loop = true;

  // 2. Estilos 3D Antigravity
  const style = document.createElement('style');
  style.innerHTML = `
    body {
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
  `;
  document.head.appendChild(style);

  const uiCards = document.querySelectorAll('article, .starter-card, .scout-sec-card, .book-card, button, input, .stat-pill, .adc-icon-orb');
  uiCards.forEach(el => el.classList.add('antigravity-float'));

  let lastBeat = -1;

  function renderLoop() {
    if (!audio.paused) {
      const t = audio.currentTime;
      if (t >= TOTAL_DURATION) {
        audio.currentTime = 0;
        window.scrollTo({ top: 0, behavior: 'instant' });
      }

      const beat = Math.floor(t / BEAT_DURATION);
      const bar = Math.floor(t / BAR_DURATION) + 1;
      const beatInBar = (beat % 4) + 1;

      if (beat !== lastBeat) {
        lastBeat = beat;

        // Escena 1: Intro
        if (bar <= 2) {
          document.body.style.transform = `perspective(1200px) rotateX(12deg) rotateY(${beat % 2 === 0 ? -8 : 8}deg) scale(0.94)`;
        }
        // Escena 2: Buscador
        else if (bar >= 3 && bar <= 8) {
          const input = document.getElementById('searchInput') || document.querySelector('input');
          if (input && beat === 12) input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (input && bar >= 4 && bar <= 6) {
            const txt = '¿Qué son ExplorApp y CarpetApp?';
            const prog = Math.min(1, (t - 4.5) / 3.0);
            input.value = txt.substring(0, Math.floor(prog * txt.length));
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          const tiltY = (beat % 2 === 0) ? -4 : 4;
          document.body.style.transform = `perspective(1200px) rotateX(4deg) rotateY(${tiltY}deg) scale(1.18)`;
        }
        // Escena 3: Estantes
        else if (bar >= 9 && bar <= 16) {
          if (beatInBar === 1) window.scrollBy({ top: 260, behavior: 'smooth' });
          const tiltX = (beat % 2 === 0) ? 7 : 2;
          document.body.style.transform = `perspective(1200px) rotateX(${tiltX}deg) rotateY(-7deg) scale(0.98)`;
        }
        // Escena 4: Pre-drop
        else if (bar === 17) {
          document.body.style.transform = `perspective(1200px) rotateX(0deg) rotateY(0deg) scale(0.84)`;
        }
        // Escena 5: Drop / Coro
        else if (bar >= 18) {
          const angleY = (bar % 2 === 0) ? 10 : -10;
          const isClap = (beatInBar === 2 || beatInBar === 4);
          document.body.style.transform = `perspective(1200px) rotateX(8deg) rotateY(${angleY}deg) scale(${isClap ? 1.07 : 0.96})`;

          uiCards.forEach((c, idx) => {
            if ((idx + beat) % 3 === 0) {
              const cls = isClap ? 'clap-pulse' : 'beat-pulse';
              c.classList.add(cls);
              setTimeout(() => c.classList.remove(cls), BEAT_DURATION * 850);
            }
          });
        }
      }
    }
    requestAnimationFrame(renderLoop);
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
  audio.currentTime = 0;
  audio.play().then(() => {
    console.log('¡Modo Promo Antigravity 160 BPM Activo en tu sitio web!');
    renderLoop();
  }).catch(() => {
    console.log('Haz clic en cualquier parte de la página para iniciar el audio.');
    window.addEventListener('click', () => {
      audio.play();
      renderLoop();
    }, { once: true });
  });
})();
