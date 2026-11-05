/**
 * BIBLIOTECH SCOUT — MOTION GRAPHICS STUDIO JS
 * Formato: 1080x1920 (9:16 Vertical)
 * Audio: "Happy" (FL Studio 2025 Cut) • 160 BPM • 4/4
 * Duración total: 49.50 segundos (132 beats, 33 compases)
 */

(function () {
  'use strict';

  // ========================================================
  // 1. CONFIGURACIÓN MUSICAL Y TEMPORAL (160 BPM, 4/4)
  // ========================================================
  const BPM = 160;
  const SECONDS_PER_BEAT = 60 / BPM; // 0.375 s (375 ms)
  const SECONDS_PER_BAR = SECONDS_PER_BEAT * 4; // 1.50 s
  const TOTAL_DURATION = 49.50; // segundos
  const TOTAL_BEATS = 132;
  const TOTAL_BARS = 33;

  // Elementos del DOM
  const canvas = document.getElementById('promoCanvas');
  const ctx = canvas.getContext('2d');
  const audio = document.getElementById('promoAudio');
  const stageScaler = document.getElementById('stageScaler');
  const stageOverlay = document.getElementById('stageOverlay');
  const timecodeDisplay = document.getElementById('timecodeDisplay');
  const beatDisplay = document.getElementById('beatDisplay');
  const beatLed = document.getElementById('beatLed');
  const timelineProgress = document.getElementById('timelineProgress');
  const timelineThumb = document.getElementById('timelineThumb');
  const timelineTrack = document.getElementById('timelineTrack');
  const sceneNameDisplay = document.getElementById('sceneNameDisplay');

  // Botones
  const btnPlay = document.getElementById('btnPlay');
  const btnReset = document.getElementById('btnReset');
  const btnRecord = document.getElementById('btnRecord');
  const btnBigStart = document.getElementById('btnBigStart');

  // Estado de la animación
  let isPlaying = false;
  let isRecording = false;
  let mediaRecorder = null;
  let recordedChunks = [];
  let audioContext = null;
  let audioSourceNode = null;
  let audioDestNode = null;
  let animationFrameId = null;

  // ========================================================
  // 2. PRECARGA DE ASSETS GRÁFICOS
  // ========================================================
  const assets = {};
  const imageSources = {
    flor: 'img/logo-flor.png',
    asmac: 'img/logo-asmac.png',
    wosm: 'img/logo-wosm.png',
    adcLogo: 'img/adc/logo.png',
    paz: 'img/adc/paz.png',
    salud: 'img/adc/salud.png',
    habilidades: 'img/adc/habilidades.png',
    sustentabilidad: 'img/adc/sustentabilidad.png',
    liam: 'assets/Liam.webp',
    p01: 'img/photos/p01.jpg',
    p02: 'img/photos/p02.jpg',
    caminantes: 'img/photos/caminantes.jpg',
  };

  let loadedImagesCount = 0;
  const totalImages = Object.keys(imageSources).length;

  for (const [key, src] of Object.entries(imageSources)) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      loadedImagesCount++;
      assets[key] = img;
    };
    img.onerror = () => {
      loadedImagesCount++;
      console.warn('No se pudo cargar la imagen:', src);
    };
  }

  // ========================================================
  // 3. ESCALADO RESPONSIVO DEL ESCENARIO 1080x1920
  // ========================================================
  function fitStageToWindow() {
    const stageWrap = document.querySelector('.studio-stage-wrap');
    if (!stageWrap) return;
    const availWidth = stageWrap.clientWidth - 40;
    const availHeight = stageWrap.clientHeight - 40;

    const scaleX = availWidth / 1080;
    const scaleY = availHeight / 1920;
    const scale = Math.min(scaleX, scaleY, 0.95);

    stageScaler.style.transform = `scale(${scale})`;
  }

  window.addEventListener('resize', fitStageToWindow);
  fitStageToWindow();

  // ========================================================
  // 4. MATEMÁTICAS DEL RITMO Y BEAT MAPPING
  // ========================================================
  function getBeatInfo(time) {
    const clampedTime = Math.max(0, Math.min(time, TOTAL_DURATION));
    const currentBeat = clampedTime / SECONDS_PER_BEAT;
    const bar = Math.floor(currentBeat / 4);
    const beatInBar = Math.floor(currentBeat % 4);
    const subBeat = currentBeat % 1; // 0.0 a 1.0 dentro del beat actual
    const isClap = beatInBar === 1 || beatInBar === 3; // compases 2 y 4 (palmadas en 4/4)
    const isKick = beatInBar === 0 || beatInBar === 2;

    return {
      time: clampedTime,
      beat: currentBeat,
      bar: bar + 1,
      beatInBar: beatInBar + 1,
      subBeat,
      isClap,
      isKick,
    };
  }

  // Curvas de animación (Easings)
  const easeOutBack = (x) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  };

  const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
  const easeInOutQuad = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

  // Partículas y efectos de fondo
  const particles = [];
  for (let i = 0; i < 45; i++) {
    particles.push({
      x: Math.random() * 1080,
      y: Math.random() * 1920,
      size: 4 + Math.random() * 12,
      speedY: 0.8 + Math.random() * 2.2,
      speedX: (Math.random() - 0.5) * 1.2,
      color: ['#7c3aed', '#0284c7', '#06b6d4', '#f59e0b', '#10b981'][Math.floor(Math.random() * 5)],
      alpha: 0.2 + Math.random() * 0.6,
      rot: Math.random() * Math.PI * 2,
    });
  }

  // ========================================================
  // 5. MOTOR DE RENDERIZADO VISUAL EN CANVAS (1080x1920)
  // ========================================================
  function renderFrame(time) {
    const b = getBeatInfo(time);

    // Actualizar HUD
    const minutes = Math.floor(b.time / 60);
    const seconds = Math.floor(b.time % 60);
    const millis = Math.floor((b.time % 1) * 100);
    const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
    timecodeDisplay.textContent = `${timeFormatted} / 00:49.50`;
    beatDisplay.textContent = `Compás ${String(b.bar).padStart(2, '0')} • Beat ${b.beatInBar}`;

    // Pulso LED
    if (b.subBeat < 0.22) {
      beatLed.className = b.isClap ? 'beat-led clap' : 'beat-led active';
    } else {
      beatLed.className = 'beat-led';
    }

    // Timeline bar
    const progressPercent = (b.time / TOTAL_DURATION) * 100;
    timelineProgress.style.width = `${progressPercent}%`;
    timelineThumb.style.left = `${progressPercent}%`;

    // Limpiar Canvas
    ctx.clearRect(0, 0, 1080, 1920);

    // ========================================================
    // FONDO: AURORA DINÁMICA DE BIBLIOTECH + ONDAS DE BEAT
    // ========================================================
    drawDynamicAurora(b);

    // Partículas de fondo
    drawParticles(b);

    // ========================================================
    // COREOGRAFÍA POR ACTOS Y COMPASES (160 BPM)
    // ========================================================
    if (b.time < 6.0) {
      sceneNameDisplay.textContent = 'Acto 1: Despertar, Logo Oficial y Estadísticas';
      drawScene1_Intro(b);
    } else if (b.time < 18.0) {
      sceneNameDisplay.textContent = 'Acto 2: Buscador Inteligente en Vivo y Respuestas';
      drawScene2_Search(b);
    } else if (b.time < 19.5) {
      sceneNameDisplay.textContent = 'Acto 3: Tensión y Compás Previo al Coro (HUH!)';
      drawScene3_Buildup(b);
    } else if (b.time < 22.5) {
      sceneNameDisplay.textContent = 'Acto 4: ¡DROP DEL CORO! Las 4 Secciones Scouts al Ritmo';
      drawScene4_ChorusSections(b);
    } else if (b.time < 27.0) {
      sceneNameDisplay.textContent = 'Acto 5: Biblioteca y Libros del Centenario en 3D';
      drawScene5_Books(b);
    } else if (b.time < 31.5) {
      sceneNameDisplay.textContent = 'Acto 6: Agentes de Cambio.MX y sus 4 Ejes Temáticos';
      drawScene6_Agentes(b);
    } else if (b.time < 37.5) {
      sceneNameDisplay.textContent = 'Acto 7: Lector Móvil y Beneficios Oficiales';
      drawScene7_ReaderAndFeatures(b);
    } else if (b.time < 43.5) {
      sceneNameDisplay.textContent = 'Acto 8: Experiencia Completa Móvil en Perspectiva';
      drawScene8_MobileHero(b);
    } else {
      sceneNameDisplay.textContent = 'Acto 9: Gran Cierre y Llamado a la Acción (ey-liam.github.io)';
      drawScene9_Outro(b);
    }

    // Ondas expansivas de choque en los beats fuertes
    drawBeatShockwaves(b);
  }

  // ========================================================
  // SUB-RUTINAS DE DIBUJO CINEMATOGRÁFICO
  // ========================================================

  function drawDynamicAurora(b) {
    // Fondo base azul noche profundo
    const baseGrad = ctx.createLinearGradient(0, 0, 0, 1920);
    baseGrad.addColorStop(0, '#060814');
    baseGrad.addColorStop(0.5, '#0b0e24');
    baseGrad.addColorStop(1, '#050711');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Orbe 1: Violeta Scout
    const beatPulse = Math.sin(b.beat * Math.PI) * 20;
    const orb1Grad = ctx.createRadialGradient(
      340 + Math.sin(b.time * 0.8) * 90,
      480 + Math.cos(b.time * 0.9) * 80,
      10,
      340,
      480,
      600 + beatPulse
    );
    orb1Grad.addColorStop(0, 'rgba(124, 58, 237, 0.45)');
    orb1Grad.addColorStop(0.5, 'rgba(91, 33, 182, 0.2)');
    orb1Grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = orb1Grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Orbe 2: Cian / Azul Eléctrico
    const orb2Grad = ctx.createRadialGradient(
      740 + Math.cos(b.time * 0.7) * 90,
      1300 + Math.sin(b.time * 0.8) * 80,
      10,
      740,
      1300,
      650 + beatPulse
    );
    orb2Grad.addColorStop(0, 'rgba(2, 132, 199, 0.4)');
    orb2Grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.18)');
    orb2Grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = orb2Grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Destellos dorados en el drop
    if (b.time >= 19.5 && b.time < 31.5) {
      const goldGrad = ctx.createRadialGradient(540, 960, 20, 540, 960, 700 + beatPulse * 1.5);
      goldGrad.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
      goldGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = goldGrad;
      ctx.fillRect(0, 0, 1080, 1920);
    }
  }

  function drawParticles(b) {
    ctx.save();
    for (const p of particles) {
      p.y -= p.speedY;
      p.x += p.speedX;
      if (p.y < -20) p.y = 1940;
      if (p.x < -20) p.x = 1100;
      if (p.x > 1100) p.x = -20;

      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(b.beat * Math.PI));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + (b.subBeat < 0.2 ? 0.3 : 0)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBeatShockwaves(b) {
    if (b.subBeat < 0.35) {
      const waveRadius = 300 + b.subBeat * 1600;
      const alpha = Math.max(0, 0.45 - b.subBeat * 1.2);
      ctx.save();
      ctx.strokeStyle = b.isClap ? 'rgba(245, 158, 11, ' + alpha + ')' : 'rgba(6, 182, 212, ' + alpha + ')';
      ctx.lineWidth = 4 + (1 - b.subBeat) * 6;
      ctx.beginPath();
      ctx.arc(540, 960, waveRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ========================================================
  // DIBUJO DEL MOCKUP DEL CELULAR
  // ========================================================
  function drawPhoneMockup(x, y, w, h, radius, drawContentCallback) {
    ctx.save();
    ctx.translate(x, y);

    // Sombra del teléfono
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 25;

    // Borde exterior de titanio
    roundRect(ctx, -w / 2, -h / 2, w, h, radius);
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Borde iluminado
    ctx.lineWidth = 5;
    const borderGrad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    borderGrad.addColorStop(0.5, 'rgba(124, 58, 237, 0.4)');
    borderGrad.addColorStop(1, 'rgba(2, 132, 199, 0.3)');
    ctx.strokeStyle = borderGrad;
    ctx.stroke();

    // Pantalla interna recortada
    ctx.save();
    const screenMargin = 12;
    const sw = w - screenMargin * 2;
    const sh = h - screenMargin * 2;
    roundRect(ctx, -sw / 2, -sh / 2, sw, sh, radius - 6);
    ctx.clip();

    // Fondo de pantalla del celular
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-sw / 2, -sh / 2, sw, sh);

    // Contenido dinámico del teléfono
    if (drawContentCallback) {
      drawContentCallback(sw, sh);
    }

    // Barra de estado móvil superior
    drawMobileStatusBar(sw, sh);

    // Barra inferior de inicio
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    roundRect(ctx, -80, sh / 2 - 20, 160, 6, 3);
    ctx.fill();

    ctx.restore(); // fin del clip de la pantalla

    ctx.restore(); // fin de la transformación del teléfono
  }

  function drawMobileStatusBar(sw, sh) {
    ctx.save();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('9:41', -sw / 2 + 36, -sh / 2 + 52);

    // Indicador 5G y Batería
    ctx.textAlign = 'right';
    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillText('SCOUT 5G  100%', sw / 2 - 36, -sh / 2 + 50);

    // Dynamic Island / Speaker
    ctx.fillStyle = '#020617';
    roundRect(ctx, -90, -sh / 2 + 18, 180, 36, 18);
    ctx.fill();
    ctx.restore();
  }

  // ========================================================
  // ACTO 1: INTRODUCCIÓN Y ESTADÍSTICAS (0.00s – 6.00s)
  // ========================================================
  function drawScene1_Intro(b) {
    const t = b.time;

    // Título inicial flotante de gran impacto
    const titleAlpha = t < 1.5 ? Math.min(1, t / 0.5) : Math.max(0, 1 - (t - 4.5) / 1.0);
    ctx.save();
    ctx.globalAlpha = titleAlpha;
    ctx.textAlign = 'center';

    const beatBounce = 1 + Math.sin(b.subBeat * Math.PI) * 0.08;

    // Encabezado cinético
    ctx.font = '900 68px "Outfit", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(124, 58, 237, 0.8)';
    ctx.shadowBlur = 24;
    ctx.fillText('¿DUDAS SCOUTS?', 540, 340);

    ctx.font = '700 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.shadowBlur = 0;
    ctx.fillText('Todo el Escultismo en tu Celular', 540, 410);
    ctx.restore();

    // Teléfono entrando con perspectiva suave
    const phoneY = 1060 + (1 - Math.min(1, t / 1.6)) * 400;
    const phoneScale = 0.88 + Math.min(0.08, (t / 6.0) * 0.08);

    drawPhoneMockup(540, phoneY, 780 * phoneScale, 1540 * phoneScale, 44, (sw, sh) => {
      // Navbar móvil de BiblioTech Scout
      drawPhoneHeader(sw, sh);

      // Hero Centenario y contadores que suben en vivo
      const progressCount = Math.min(1, Math.max(0, (t - 2.5) / 2.5));
      const countQuestions = Math.floor(progressCount * 5412);
      const countDocs = Math.floor(progressCount * 498);
      const countTopics = Math.floor(progressCount * 104);

      // Tarjeta de estadísticas
      ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
      roundRect(ctx, -sw / 2 + 30, -sh / 2 + 280, sw - 60, 260, 24);
      ctx.fill();

      // Gradiente de borde
      ctx.strokeStyle = 'rgba(124, 58, 237, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = '900 52px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(countQuestions.toLocaleString() + '+', -sw / 2 + 130, -sh / 2 + 400);
      ctx.fillText(countDocs.toString(), 0, -sh / 2 + 400);
      ctx.fillText(countTopics.toString(), sw / 2 - 130, -sh / 2 + 400);

      ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Preguntas', -sw / 2 + 130, -sh / 2 + 440);
      ctx.fillText('Documentos', 0, -sh / 2 + 440);
      ctx.fillText('Temas', sw / 2 - 130, -sh / 2 + 440);

      // Banner del Centenario
      ctx.fillStyle = 'linear-gradient(90deg, #7c3aed, #0284c7)';
      roundRect(ctx, -sw / 2 + 30, -sh / 2 + 580, sw - 60, 110, 20);
      ctx.fillStyle = 'rgba(124, 58, 237, 0.35)';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.font = '800 24px "Outfit", sans-serif';
      ctx.fillText('100 AÑOS DE ESCULTISMO EN MÉXICO', 0, -sh / 2 + 630);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('1926 — 2026 • Colección Biblioteca del Centenario', 0, -sh / 2 + 665);
    });
  }

  function drawPhoneHeader(sw, sh) {
    ctx.save();
    // Header bar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(-sw / 2, -sh / 2 + 90, sw, 140);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-sw / 2, -sh / 2 + 230);
    ctx.lineTo(sw / 2, -sh / 2 + 230);
    ctx.stroke();

    // Logo Flor de Lis
    if (assets.flor) {
      ctx.drawImage(assets.flor, -sw / 2 + 35, -sh / 2 + 115, 80, 80);
    }

    // Texto marca
    ctx.textAlign = 'left';
    ctx.font = '900 38px "Outfit", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BiblioTech', -sw / 2 + 130, -sh / 2 + 155);

    ctx.font = '800 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#c084fc';
    ctx.fillText('By Liam • Provincia TLXH', -sw / 2 + 130, -sh / 2 + 190);
    ctx.restore();
  }

  // ========================================================
  // ACTO 2: BUSCADOR EN VIVO Y RESPUESTAS (6.00s – 18.00s)
  // ========================================================
  function drawScene2_Search(b) {
    const t = b.time;

    // Teléfono centrado y con zoom hacia el buscador
    drawPhoneMockup(540, 960, 840, 1620, 44, (sw, sh) => {
      drawPhoneHeader(sw, sh);

      // Query y Respuesta 1: Inscripción (6.0s - 10.5s)
      if (t < 10.5) {
        const queryText = '¿Cómo inscribo a mi hijo en un Grupo Scout?';
        const typeProgress = Math.min(1, (t - 6.0) / 2.0);
        const charsToShow = Math.floor(typeProgress * queryText.length);
        const typedQuery = queryText.substring(0, charsToShow);

        drawSearchBar(sw, sh, typedQuery, true);

        if (t >= 8.2) {
          const cardBounce = easeOutBack(Math.min(1, (t - 8.2) / 0.6));
          drawResponseCard(
            sw,
            sh,
            cardBounce,
            'Inscripción Oficial en Grupos Scouts',
            '1. Ubica tu Grupo Scout y Provincia.\n2. Contacta al Jefe de Grupo o Subjefe de Registro.\n3. Llena la Cédula de Registro SISAS y Ficha Médica.\n4. Obtén tu Credencial y Seguro Scout Nacional.',
            'Reglamento ASMAC • Sección Familias'
          );
        }
      }
      // Query y Respuesta 2: ExplorApp y CarpetApp (10.5s - 15.0s)
      else if (t < 15.0) {
        const queryText = '¿Qué son ExplorApp y CarpetApp?';
        const typeProgress = Math.min(1, (t - 10.5) / 1.8);
        const charsToShow = Math.floor(typeProgress * queryText.length);
        const typedQuery = queryText.substring(0, charsToShow);

        drawSearchBar(sw, sh, typedQuery, true);

        if (t >= 12.0) {
          const cardBounce = easeOutBack(Math.min(1, (t - 12.0) / 0.6));
          drawResponseCard(
            sw,
            sh,
            cardBounce,
            'ExplorApp y CarpetApp Oficiales',
            '• ExplorApp: Registro digital de proyectos comunitarios de Caminantes y Rovers.\n• CarpetApp: Carpeta digital de progresión personal, insignias terminales y adelanto scout.',
            'Red de Caminantes • Plataformas ASMAC'
          );
        }
      }
      // Query y Respuesta 3: Meztitla (15.0s - 18.0s)
      else {
        const queryText = '¿Qué es el Centro Scout Meztitla?';
        const typeProgress = Math.min(1, (t - 15.0) / 1.5);
        const charsToShow = Math.floor(typeProgress * queryText.length);
        const typedQuery = queryText.substring(0, charsToShow);

        drawSearchBar(sw, sh, typedQuery, true);

        if (t >= 16.2) {
          const cardBounce = easeOutBack(Math.min(1, (t - 16.2) / 0.5));
          drawResponseCard(
            sw,
            sh,
            cardBounce,
            'Centro Scout Meztitla (Tepoztlán)',
            'Campo Escuela Nacional de ASMAC fundado en 1956.\nSede emblemática de Jamborees, campamentos nacionales, cursos de Insignia de Madera y aventura al aire libre.',
            'Lugares Emblemáticos • ASMAC'
          );
        }
      }
    });
  }

  function drawSearchBar(sw, sh, text, showCursor) {
    ctx.save();
    // Input box
    const boxY = -sh / 2 + 270;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    roundRect(ctx, -sw / 2 + 35, boxY, sw - 70, 95, 26);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Ícono lupa
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 32px "Outfit", sans-serif';
    ctx.fillText('🔍', -sw / 2 + 65, boxY + 60);

    // Texto escrito
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 25px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(text, -sw / 2 + 125, boxY + 58);

    // Cursor parpadeante
    if (showCursor && Math.floor(Date.now() / 250) % 2 === 0) {
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-sw / 2 + 130 + textWidth, boxY + 28, 4, 38);
    }
    ctx.restore();
  }

  function drawResponseCard(sw, sh, scaleAnim, title, content, badge) {
    ctx.save();
    ctx.translate(0, -sh / 2 + 720);
    ctx.scale(scaleAnim, scaleAnim);

    // Tarjeta de respuesta
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    roundRect(ctx, -sw / 2 + 35, -310, sw - 70, 620, 28);
    ctx.fill();

    ctx.strokeStyle = 'rgba(124, 58, 237, 0.7)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Badge de categoría
    ctx.fillStyle = 'rgba(124, 58, 237, 0.25)';
    roundRect(ctx, -sw / 2 + 65, -280, 400, 44, 14);
    ctx.fill();
    ctx.fillStyle = '#c084fc';
    ctx.font = '800 18px "Outfit", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(badge, -sw / 2 + 85, -252);

    // Título
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px "Outfit", sans-serif';
    ctx.fillText(title, -sw / 2 + 65, -195);

    // Línea separadora
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(-sw / 2 + 65, -170);
    ctx.lineTo(sw / 2 - 65, -170);
    ctx.stroke();

    // Contenido multilínea
    ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#e2e8f0';
    const lines = content.split('\n');
    let yPos = -120;
    for (const line of lines) {
      ctx.fillText(line, -sw / 2 + 65, yPos);
      yPos += 46;
    }

    // Botón "Ver Documento Oficial"
    ctx.fillStyle = 'linear-gradient(90deg, #7c3aed, #0284c7)';
    roundRect(ctx, -sw / 2 + 65, 190, sw - 130, 75, 20);
    ctx.fillStyle = '#7c3aed';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 24px "Outfit", sans-serif';
    ctx.fillText('📖 Leer Documento y Normativa Completa →', 0, 238);

    ctx.restore();
  }

  // ========================================================
  // ACTO 3: BUILDUP ANTES DEL CORO (18.00s – 19.50s) "HUH!"
  // ========================================================
  function drawScene3_Buildup(b) {
    const t = b.time;
    const progress = (t - 18.0) / 1.5;

    // Efecto de tensión y temblor
    const shake = Math.sin(t * 80) * 8 * progress;

    ctx.save();
    ctx.translate(540 + shake, 960);

    // Destello de energía púrpura
    const glowRad = 150 + progress * 500;
    const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, glowRad);
    glow.addColorStop(0, 'rgba(124, 58, 237, 0.8)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
    ctx.fill();

    // Texto de cuenta regresiva
    ctx.textAlign = 'center';
    ctx.font = '900 130px "Outfit", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 30;
    ctx.fillText('¡LISTOS!', 0, -40);

    ctx.font = '800 48px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText('HUH! 🥁', 0, 80);

    ctx.restore();
  }

  // ========================================================
  // ACTO 4: EL CORO DROP — 4 SECCIONES SCOUTS (19.50s – 22.50s)
  // ========================================================
  function drawScene4_ChorusSections(b) {
    const t = b.time;
    ctx.save();
    ctx.textAlign = 'center';

    // Gran texto cinético superior al ritmo de "BECAUSE I'M HAPPY!"
    const beatBounce = 1 + Math.sin(b.subBeat * Math.PI) * 0.12;
    ctx.font = '900 80px "Outfit", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 35;
    ctx.fillText('¡PORQUE SOY SCOUT!', 540, 320);

    ctx.font = '700 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.shadowBlur = 0;
    ctx.fillText('Para Todas las Secciones y Familias', 540, 390);

    // Cuadrícula de 4 Secciones saltando en cada palmada
    const sections = [
      { name: 'MANADA', sub: 'Lobatos y Lobeznas', lsm: '¡Siempre lo Mejor!', color: '#eab308', beatIdx: 0 },
      { name: 'TROPA', sub: 'Scouts', lsm: '¡Siempre Listos!', color: '#10b981', beatIdx: 1 },
      { name: 'COMUNIDAD', sub: 'Caminantes', lsm: '¡Siempre Adelante!', color: '#0284c7', beatIdx: 2 },
      { name: 'CLAN', sub: 'Rovers', lsm: '¡Servir!', color: '#ef4444', beatIdx: 3 },
    ];

    const gridY = 520;
    sections.forEach((sec, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = col === 0 ? 320 : 760;
      const cy = gridY + row * 430;

      // El salto ocurre en sincronía con el beat asignado
      const isSecActive = b.beatInBar === sec.beatIdx + 1;
      const scale = isSecActive ? 1.15 : 1.0;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      // Tarjeta de sección
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      roundRect(ctx, -190, -180, 380, 360, 32);
      ctx.fill();

      ctx.strokeStyle = sec.color;
      ctx.lineWidth = isSecActive ? 6 : 2;
      ctx.stroke();

      // Círculo de color
      ctx.fillStyle = sec.color;
      ctx.beginPath();
      ctx.arc(0, -60, 55, 0, Math.PI * 2);
      ctx.fill();

      // Nombre de sección
      ctx.font = '900 38px "Outfit", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(sec.name, 0, 45);

      ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(sec.sub, 0, 80);

      ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = sec.color;
      ctx.fillText(sec.lsm, 0, 125);

      ctx.restore();
    });

    ctx.restore();
  }

  // ========================================================
  // ACTO 5: BIBLIOTECA DEL CENTENARIO EN 3D (22.50s – 27.00s)
  // ========================================================
  function drawScene5_Books(b) {
    ctx.save();
    ctx.textAlign = 'center';

    ctx.font = '900 68px "Outfit", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BIBLIOTECA SCOUT', 540, 320);

    ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText('498 Documentos y Libros Oficiales', 540, 385);

    // Carrusel giratorio de 4 portadas clave
    const books = [
      { title: 'Colección Centenario', sub: '39 Libros Históricos', color: '#7c3aed' },
      { title: 'Manual de Supervivencia', sub: 'Técnicas de Campismo', color: '#10b981' },
      { title: 'El Desafío Caminante', sub: 'Progresión y Aventura', color: '#0284c7' },
      { title: 'Manual del Uniforme', sub: 'Insignias y Normativa', color: '#f59e0b' },
    ];

    const timeRot = b.time * 1.5;
    books.forEach((book, i) => {
      const angle = (i / books.length) * Math.PI * 2 + timeRot;
      const x = 540 + Math.sin(angle) * 320;
      const y = 920 + Math.cos(angle) * 90;
      const scale = 0.75 + (Math.cos(angle) + 1) * 0.25;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);

      // Portada de libro
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 30;
      ctx.fillStyle = book.color;
      roundRect(ctx, -140, -200, 280, 400, 18);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Detalle del lomo
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(-140, -200, 30, 400);

      // Título en la portada
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 28px "Outfit", sans-serif';
      ctx.fillText(book.title, 0, -30);

      ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(book.sub, 0, 30);

      ctx.restore();
    });

    ctx.restore();
  }

  // ========================================================
  // ACTO 6: AGENTES DE CAMBIO.MX (27.00s – 31.50s)
  // ========================================================
  function drawScene6_Agentes(b) {
    ctx.save();
    ctx.textAlign = 'center';

    // Logo y Título
    if (assets.adcLogo) {
      ctx.drawImage(assets.adcLogo, 540 - 100, 220, 200, 100);
    }

    ctx.font = '900 64px "Outfit", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('AGENTES DE CAMBIO.MX', 540, 380);

    ctx.font = '700 30px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Los 4 Ejes Temáticos del CNRC', 540, 435);

    // Los 4 Ejes en órbita 3D con sus logos reales
    const axes = [
      { name: 'Paz y Acción Comunitaria', key: 'paz', color: '#ec4899', angleOffset: 0 },
      { name: 'Salud y Bienestar', key: 'salud', color: '#06b6d4', angleOffset: Math.PI / 2 },
      { name: 'Habilidades para la Vida', key: 'habilidades', color: '#f59e0b', angleOffset: Math.PI },
      { name: 'Medio Ambiente y Sustentabilidad', key: 'sustentabilidad', color: '#84cc16', angleOffset: (3 * Math.PI) / 2 },
    ];

    const orbitTime = b.time * 1.8;
    axes.forEach((axis) => {
      const ang = axis.angleOffset + orbitTime;
      const x = 540 + Math.cos(ang) * 340;
      const y = 980 + Math.sin(ang) * 280;

      ctx.save();
      ctx.translate(x, y);

      // Círculo / Orbe
      ctx.shadowColor = axis.color;
      ctx.shadowBlur = 35;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.beginPath();
      ctx.arc(0, 0, 95, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = axis.color;
      ctx.lineWidth = 5;
      ctx.stroke();

      // Ícono oficial del eje
      if (assets[axis.key]) {
        ctx.drawImage(assets[axis.key], -65, -65, 130, 130);
      }

      // Nombre del eje
      ctx.shadowColor = 'transparent';
      ctx.font = '800 22px "Outfit", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(axis.name, 0, 135);

      ctx.restore();
    });

    ctx.restore();
  }

  // ========================================================
  // ACTO 7: LECTOR MÓVIL Y BENEFICIOS (31.50s – 37.50s)
  // ========================================================
  function drawScene7_ReaderAndFeatures(b) {
    ctx.save();
    ctx.textAlign = 'center';

    ctx.font = '900 62px "Outfit", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('LECTOR INTEGRADO', 540, 290);

    ctx.font = '700 30px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Lee en Línea o Descarga al Instante', 540, 350);

    // 4 Píldoras de beneficios a toda velocidad con el beat
    const features = [
      '⚡ 100% Gratuito y de Código Abierto',
      '⚡ Sin Registros Obligatorios',
      '⚡ Ultrarrápido en Cualquier Celular',
      '⚡ Documentación Oficial ASMAC y WOSM',
    ];

    features.forEach((feat, i) => {
      const y = 470 + i * 160;
      ctx.save();
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      roundRect(ctx, 120, y, 840, 115, 28);
      ctx.fill();

      ctx.strokeStyle = 'rgba(124, 58, 237, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '800 32px "Outfit", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.fillText(feat, 170, y + 70);
      ctx.restore();
    });

    ctx.restore();
  }

  // ========================================================
  // ACTO 8: MÓVIL HERO EN PERSPECTIVA (37.50s – 43.50s)
  // ========================================================
  function drawScene8_MobileHero(b) {
    const t = b.time;
    // Teléfono flotante con rotación suave y trío de fotos
    drawPhoneMockup(540, 960, 840, 1600, 44, (sw, sh) => {
      drawPhoneHeader(sw, sh);

      // Hero banner
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 46px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BiblioTech Scout', 0, -sh / 2 + 330);

      ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('La biblioteca scout más completa de México', 0, -sh / 2 + 380);

      // Foto de scouts destacada
      if (assets.p01) {
        ctx.save();
        roundRect(ctx, -sw / 2 + 40, -sh / 2 + 440, sw - 80, 440, 24);
        ctx.clip();
        ctx.drawImage(assets.p01, -sw / 2 + 40, -sh / 2 + 440, sw - 80, 440);
        ctx.restore();
      }

      // Botón principal "Empezar a Buscar"
      ctx.fillStyle = 'linear-gradient(90deg, #7c3aed, #0284c7)';
      roundRect(ctx, -sw / 2 + 40, -sh / 2 + 940, sw - 80, 95, 24);
      ctx.fillStyle = '#7c3aed';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 28px "Outfit", sans-serif';
      ctx.fillText('Explorar 5,412 Preguntas Verificadas →', 0, -sh / 2 + 1000);
    });
  }

  // ========================================================
  // ACTO 9: GRAND FINALE Y CALL TO ACTION (43.50s – 49.50s)
  // ========================================================
  function drawScene9_Outro(b) {
    const t = b.time;
    ctx.save();
    ctx.textAlign = 'center';

    // Logo Flor de Lis en grande y flotando
    if (assets.flor) {
      const floatY = 480 + Math.sin(b.beat * Math.PI) * 15;
      ctx.drawImage(assets.flor, 540 - 110, floatY - 110, 220, 220);
    }

    ctx.font = '900 78px "Outfit", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00b4d8';
    ctx.shadowBlur = 35;
    ctx.fillText('BiblioTech Scout', 540, 740);

    ctx.font = '800 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#c084fc';
    ctx.shadowBlur = 0;
    ctx.fillText('Creador: Liam Durán • Provincia TLXH', 540, 810);

    // Enlace destacado en cápsula gigante
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    roundRect(ctx, 80, 940, 920, 160, 40);
    ctx.fill();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.font = '900 48px "JetBrains Mono", monospace';
    ctx.fillStyle = '#fde047';
    ctx.fillText('ey-liam.github.io/bibliotech-scouts', 540, 1040);

    // Lema de cierre
    ctx.font = '800 38px "Outfit", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Construir un Mundo Mejor', 540, 1220);

    // Logos ASMAC y WOSM
    if (assets.asmac) {
      ctx.drawImage(assets.asmac, 540 - 240, 1340, 200, 90);
    }
    if (assets.wosm) {
      ctx.drawImage(assets.wosm, 540 + 40, 1340, 200, 90);
    }

    ctx.restore();
  }

  // ========================================================
  // UTILIDAD: ROUNDED RECTANGLE EN CANVAS
  // ========================================================
  function roundRect(c, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    c.beginPath();
    c.moveTo(x + radius, y);
    c.arcTo(x + width, y, x + width, y + height, radius);
    c.arcTo(x + width, y + height, x, y + height, radius);
    c.arcTo(x, y + height, x, y, radius);
    c.arcTo(x, y, x + width, y, radius);
    c.closePath();
  }

  // ========================================================
  // 6. MOTOR DE REPRODUCCIÓN Y CONTROL DE AUDIO
  // ========================================================
  function initAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioCtx();
      audioSourceNode = audioContext.createMediaElementSource(audio);
      audioDestNode = audioContext.createMediaStreamDestination();

      audioSourceNode.connect(audioContext.destination);
      audioSourceNode.connect(audioDestNode);
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }

  function startPlayback() {
    initAudioContext();
    stageOverlay.classList.add('hidden');
    audio.play().then(() => {
      isPlaying = true;
      btnPlay.textContent = '⏸ Pausar';
      loop();
    }).catch((err) => {
      console.error('Error al reproducir audio:', err);
    });
  }

  function pausePlayback() {
    audio.pause();
    isPlaying = false;
    btnPlay.textContent = '▶ Reproducir';
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  }

  function togglePlay() {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  function resetPlayback() {
    pausePlayback();
    audio.currentTime = 0;
    renderFrame(0);
  }

  function loop() {
    if (!isPlaying) return;
    renderFrame(audio.currentTime);

    if (audio.currentTime >= TOTAL_DURATION || audio.ended) {
      pausePlayback();
      if (isRecording) {
        stopRecording();
      }
      return;
    }

    animationFrameId = requestAnimationFrame(loop);
  }

  // ========================================================
  // 7. EXPORTADOR DE VIDEO MP4/WEBM DIRECTO DESDE NAVEGADOR
  // ========================================================
  function startRecording() {
    initAudioContext();
    recordedChunks = [];

    // Combinar track de video del canvas a 60 FPS con track de audio
    const canvasStream = canvas.captureStream(60);
    const audioStream = audioDestNode.stream;

    const combinedStream = new MediaStream([
      canvasStream.getVideoTracks()[0],
      audioStream.getAudioTracks()[0],
    ]);

    // Opciones de códec
    let options = { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 12000000 };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 8000000 };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }
    }

    try {
      mediaRecorder = new MediaRecorder(combinedStream, options);
    } catch (e) {
      alert('Tu navegador no soporta MediaRecorder en este formato: ' + e.message);
      return;
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bibliotech-scout-promo-1080x1920.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      btnRecord.classList.remove('recording');
      btnRecord.textContent = '⏺ Grabar Video';
      isRecording = false;

      alert('¡Video exportado exitosamente! Lo encontrarás en tus Descargas como bibliotech-scout-promo-1080x1920.webm');
    };

    isRecording = true;
    btnRecord.classList.add('recording');
    btnRecord.textContent = '⏹ Grabando...';

    // Iniciar desde el segundo 0
    audio.currentTime = 0;
    mediaRecorder.start();
    startPlayback();
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
  }

  // ========================================================
  // 8. EVENTOS DE INTERFAZ Y TECLADO
  // ========================================================
  btnPlay.addEventListener('click', togglePlay);
  btnReset.addEventListener('click', resetPlayback);
  btnBigStart.addEventListener('click', startPlayback);

  btnRecord.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
      pausePlayback();
    } else {
      startRecording();
    }
  });

  // Atajos de teclado: Espacio = Play/Pausa, R = Reiniciar
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'KeyR') {
      resetPlayback();
    }
  });

  // Scrubbing en la barra de tiempo
  timelineTrack.addEventListener('click', (e) => {
    const rect = timelineTrack.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * TOTAL_DURATION;

    audio.currentTime = targetTime;
    renderFrame(targetTime);
  });

  // Render inicial al cargar
  setTimeout(() => {
    renderFrame(0);
  }, 300);

})();
