/**
 * Generador universal de preguntas básicas, cotidianas y coherentes sobre:
 * - Todos los 599 documentos accesibles (qué es, para qué sirve, cómo se llama, quién lo llena/emite, dónde checarlo)
 * - Hojas de cálculo Excel (usando data/spreadsheets.json)
 * - Documentos especiales/reparados (WOSM infografías, Hoja 2025, Medias Becas Banxico, Riesgos Eventos, Congreso Comunidad, CRCP)
 * - Portales oficiales nuevos (RECME, Mesa de Ayuda / Help Desk, Registro Familiar, CONECTA, SISAS, CDC, ExplorApp, CarpetApp, Tienda Nacional)
 * - Orientación práctica ("¿Qué necesito para un proyecto?", "¿Quién es el responsable de...?", "¿Con quién me acerco?")
 *
 * Respuestas estrictamente basadas en los documentos oficiales del catálogo. Sin alucinar datos ni usar emojis.
 */

const ROLE_PATTERNS = [
  { re: /\bJefe\s+Scout\s+Nacional\b/i, label: "Jefe Scout Nacional" },
  { re: /\bJefe\s+de\s+Grupo\b/i, label: "Jefe de Grupo (y Subjefe de Grupo Administrativo)" },
  { re: /\bPresidente\s+de\s+Provincia\b/i, label: "Presidente / Vicepresidente de Provincia" },
  { re: /\bComisi[oó]n\s+de\s+Vigilancia\b/i, label: "Comisión de Vigilancia (Nacional o Provincial)" },
  { re: /\bCorte\s+(?:Nacional\s+)?de\s+Honor\b/i, label: "Corte de Honor / Corte Nacional de Honor" },
  { re: /\bConsejo\s+Nacional\b/i, label: "Consejo Nacional de la ASMAC" },
  { re: /\bConsejo\s+de\s+Grupo\b/i, label: "Consejo de Grupo" },
  { re: /\bConsejo\s+de\s+Comunidad\b/i, label: "Consejo de Comunidad de Caminantes" },
  { re: /\bAsamblea\s+de\s+Clan\b/i, label: "Asamblea de Clan de Rovers" },
  { re: /\bComit[eé]\s+de\s+Secci[oó]n\b/i, label: "Comité de Sección (Tropa)" },
  { re: /\bCorte\s+de\s+Honor\s+(?:de\s+)?Tropa\b|\bAlta\s+Patrulla\b/i, label: "Corte de Honor de Tropa / Consejo de Patrullas" },
  { re: /\bRoca\s+de\s+Consejo\b/i, label: "Roca de Consejo (Manada)" },
  { re: /\bScouter(?:\s+de\s+Secci[oó]n)?\b|\bJefe\s+de\s+(?:Manada|Tropa|Comunidad|Clan|Secci[oó]n)\b/i, label: "Scouter / Jefe de Sección responsable" },
  { re: /\b(?:Consejero|Asesor\s+Personal|Promotor|Coordinador\s+de\s+Formaci[oó]n)\b/i, label: "Consejero, Asesor Personal o Coordinador de Formación" },
  { re: /\bCNAMS\b|Comisi[oó]n\s+Nacional\s+de\s+Adultos\b/i, label: "Comisión Nacional de Adultos en el Movimiento Scout (CNAMS)" },
  { re: /\bCNPJ\b|Comisi[oó]n\s+Nacional\s+de\s+Programa\b/i, label: "Comisión Nacional de Programa de Jóvenes (CNPJ)" },
  { re: /\bSCNCD\b|Centros\s+de\s+Documentaci[oó]n\b/i, label: "Subcomisión Nacional de Centros de Documentación (SCNCD)" },
  { re: /\bDirector\s+(?:de|del)\s+(?:Evento|Campo|Actividad|Curso|Campamento)\b/i, label: "Director del Evento / Campamento / Actividad" },
  { re: /\b(?:Padre|Madre)\s*(?:,?\s*o\s+Tutor|de\s+familia)\b|\btutor(?:a|es)?\s+legales?\b/i, label: "Madre, padre o tutor legal (en el caso de menores de edad)" },
  { re: /\b(?:Secretario|Tesorero|Administraci[oó]n|Administrador\s+de\s+Membres[ií]a)\b/i, label: "Secretario, Tesorero o Administrador Provincial/de Membresía" },
  { re: /\bMesa\s+de\s+Ayuda\b|\bHelp\s+Desk\b|\bSISAS\b/i, label: "Mesa de Ayuda ASMAC (helpdesk.scouts.org.mx) y área administrativa en SISAS" },
];

const TOPIC_HINTS_FOR_FILENAME = [
  { re: /\bP1\.1\b/i, need: "registrar o dar seguimiento a la ruta del Lobato/Lobezna (Manada)" },
  { re: /\bP1\.2\b/i, need: "elaborar el mapa o matriz de diagnóstico inicial en Tropa Scout" },
  { re: /\bP1\.3\b/i, need: "elaborar la matriz de diagnóstico inicial en Comunidad de Caminantes" },
  { re: /\bP1\.4\b/i, need: "elaborar la matriz de diagnóstico inicial en Clan de Rovers" },
  { re: /\bP2\.1\b/i, need: "construir objetivos y seguimiento de los cazaderos en Manada" },
  { re: /\bP2\.2\b/i, need: "definir metas por ámbitos de desarrollo en Tropa Scout" },
  { re: /\bP2\.3\b/i, need: "definir objetivos de desarrollo personal en Comunidad de Caminantes" },
  { re: /\bP2\.4\b/i, need: "definir objetivos y proyecto personal en Clan de Rovers" },
  { re: /\bP3\.1\b/i, need: "ver el esquema visual de ruta de los cazaderos en Manada" },
  { re: /\bP3\.2\b/i, need: "ver el esquema visual de rumbos e insignias de Tropa Scout" },
  { re: /\bP3\.3\b/i, need: "ver el esquema de senderos en Comunidad de Caminantes" },
  { re: /\bP3\.4\b/i, need: "guiar el Mapa de Rutas y proyecto PPV SMART en Clan de Rovers" },
  { re: /\bP4\.1\b|\bP4\.2\b|\bP4\.3\b|\bP4\.4\b/i, need: "evaluar la progresión personal al cierre del ciclo de programa" },
  { re: /\bP6\.1\b/i, need: "planear un campamento o excursión en la naturaleza" },
  { re: /\bP6\.2\b/i, need: "estructurar un proyecto scout oficial en formato RECME" },
  { re: /\bP6\.3\b/i, need: "organizar y solicitar autorización de un evento scout" },
  { re: /\bP6\.4\b/i, need: "gestionar un acantonamiento o reunión nocturna de sección" },
  { re: /\bP6\.5\b/i, need: "elaborar el informe de actividades después de un evento o proyecto" },
  { re: /Formato.*Proyecto/i, need: "armar la ficha oficial de planeación y cierre de un Proyecto Scout" },
  { re: /\bP7\.\d\b/i, need: "registrar el seguimiento auxiliar de progresión o insignias de sección" },
  { re: /\bP8\.2\b|\bP8\.3\b|\bP8\.4\b/i, need: "redactar el acta o plan de Consejo de Grupo/Sección y Ciclo de Programa" },
  { re: /\bP9\.1\b/i, need: "solicitar la Insignia Final de Manada (Alfa)" },
  { re: /\bP9\.2\b/i, need: "solicitar la Insignia Terminal de Tropa (Águila Real)" },
  { re: /\bP9\.3\b/i, need: "solicitar la Insignia Terminal de Comunidad (Everest)" },
  { re: /\bP9\.4\b/i, need: "solicitar la Insignia Terminal de Clan (Baden-Powell)" },
  { re: /\bP9\.5\b/i, need: "registrar observaciones o dictamen técnico de insignias finales/terminales" },
  { re: /\bP10\.\d\b/i, need: "gestionar procesos de formación o Insignia de Madera en adultos (CNAMS)" },
  { re: /Uso-de-imagen-menor/i, need: "autorizar el uso de imagen, foto y video de menores de edad" },
  { re: /Uso-de-imagen-mayor/i, need: "autorizar el uso de imagen, foto y video de mayores de edad" },
  { re: /Dialogo-Directo/i, need: "levantar el acta oficial de Diálogo Directo (MASC)" },
  { re: /Mediacion/i, need: "levantar el acta oficial de Mediación (MASC)" },
  { re: /Arbitraje/i, need: "levantar el acta oficial de Arbitraje ante Corte de Honor (MASC)" },
  { re: /Aviso.*Accidente/i, need: "reportar un accidente ocurrido en actividad scout ante la aseguradora" },
  { re: /Informe.*M[eé]dico/i, need: "entregar el informe médico del seguro contra accidentes" },
  { re: /Ficha.*Salud|Salud|M[eé]dic/i, need: "llenar la ficha de salud o datos médicos de un participante" },
  { re: /Solicitud.*Grupo nuevo|AltaGrupo/i, need: "solicitar la apertura o alta de un Grupo Scout nuevo" },
  { re: /Consejo-de-Grupo/i, need: "redactar el acta oficial de sesión del Consejo de Grupo" },
  { re: /acta CEP/i, need: "redactar el acta de Comité Ejecutivo Provincial (CEP)" },
  { re: /acta COP/i, need: "redactar el acta de Consejo Provincial (COP)" },
  { re: /CONGRESO DE COMUNIDAD/i, need: "registrar el orden del día y acuerdos de un Congreso de Comunidad" },
  { re: /Ruta a la Excelencia Grupo/i, need: "evaluar los indicadores y Plan de Acción de la Ruta a la Excelencia de Grupo" },
  { re: /Ruta a la Excelencia Provincia/i, need: "evaluar los indicadores y Plan de Acción de la Ruta a la Excelencia de Provincia" },
  { re: /PRESUPUESTO/i, need: "armar el presupuesto anual de ingresos por cuotas y gastos" },
  { re: /REPORTE FINANCIERO/i, need: "entregar el reporte financiero oficial de evento o administración" },
  { re: /GASTOS DE VIAJE/i, need: "solicitar y comprobar gastos de viaje o viáticos oficiales" },
  { re: /COTIZACION/i, need: "registrar el cuadro comparativo o formato oficial de cotización" },
  { re: /RELACION DE BIENES/i, need: "llevar el inventario y relación de bienes del grupo o provincia" },
  { re: /SALVAGUARDA DE FONDO FIJO/i, need: "firmar la carta de salvaguarda y resguardo del fondo fijo de caja" },
  { re: /Anexo 8.*Captaci[oó]n/i, need: "llevar la lista de verificación del procedimiento de Captación y Selección de Adultos" },
  { re: /FES_CC_/i, need: "cursar y acreditar una especialidad de Comunidad de Caminantes (FES)" },
];

function stripDocPreamble(raw) {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/---\s*P[aá]gina\s*\d+\s*---/gi, "\n")
    .replace(/^DOCUMENTO OFICIAL ASMAC:[^\n]*\n?/im, "")
    .replace(/^GU[ÍI]A OFICIAL HELP DESK ASMAC:[^\n]*\n?/im, "")
    .replace(/^INFOGRAF[ÍI]A OFICIAL[^\n]*\n?/im, "")
    .replace(/^HOJA DE C[ÁA]LCULO OFICIAL[^\n]*\n?/im, "")
    .replace(/^Archivo:[^\n]*\n?/im, "")
    .replace(/^Fecha de publicaci[oó]n[^\n]*\n?/im, "")
    .replace(/^Categor[ií]a[^\n]*\n?/im, "")
    .replace(/^Etiqueta tem[aá]tica[^\n]*\n?/im, "")
    .replace(/^Fuente:\s*https?:\/\/[^\n]*\n?/im, "")
    .replace(/Help Desk de la Asociacion de Scouts de Mexico[\s\S]{0,220}?Base de Conocimientos \(KB\)\s*/i, "")
    .replace(/Powered by\s+Help Desk Software[\s\S]*$/i, "")
    .trim();
}

function detectRolesAndContacts(raw) {
  const roles = [];
  for (const r of ROLE_PATTERNS) {
    if (r.re.test(raw) && !roles.includes(r.label)) {
      roles.push(r.label);
      if (roles.length >= 4) break;
    }
  }
  const emails = [...new Set(String(raw || "").match(/[a-z0-9._%+-]+@scouts\.org\.mx/gi) || [])].slice(0, 3);
  const phones = [...new Set(String(raw || "").match(/\(?55\)?\s*5208[\s-]*7122(?:\s*(?:ext\.?|extension)\s*[\d\sy,o]+)?/gi) || [])].slice(0, 2);
  return { roles, emails, phones };
}

function buildCoherentSummary(d, raw, cutSentence, clean) {
  const sumClean = clean(d.summary || "");
  if (
    sumClean &&
    sumClean.length >= 65 &&
    !/Disponible para visualizaci[oó]n y descarga directa/i.test(sumClean) &&
    !/Iniciar Sesi[oó]n CUM Contrase[nñ]a/i.test(sumClean) &&
    !/Recurso visual oficial \/ infograf[ií]a/i.test(sumClean)
  ) {
    return cutSentence(sumClean, 460);
  }
  const body = stripDocPreamble(raw);
  const cleaned = clean(body)
    .replace(/^[A-ZÁÉÍÓÚÑ0-9 ,.\-]{0,60}?(?:Ciudad de M[ée]xico|M[ée]xico)\s*,?\s*a?\s*\d{1,2}\s+de\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+\s+(?:de|del)\s+\d{4}\.?\s*/i, "")
    .replace(/^ASMAC\s*\/?\s*[A-Z0-9\/._\- ]{2,60}\s*/i, "")
    .trim();
  if (cleaned.length >= 50) return cutSentence(cleaned, 460);
  return cutSentence(
    `Material oficial en formato ${d.ext} correspondiente a la categoría ${d.category}${d.subcategory ? ` (${d.subcategory})` : ""}, dirigido a ${d.section_label || "toda la membresía scout"}.`,
    320
  );
}

function generateUniversalBasicsFaq(ctx) {
  const { fs, path, DATA, catalog, textOf, add, norm, clean, cutSentence, shortTitle, ubic, fmtSize } = ctx;

  // Cargar datos completos de libros Excel extraídos
  const sheetsPath = path.join(DATA, "spreadsheets.json");
  const spreadsheets = fs.existsSync(sheetsPath) ? JSON.parse(fs.readFileSync(sheetsPath, "utf8")) : {};

  // -------------------------------------------------------------------------
  // 1. PREGUNTAS SUPER BÁSICAS PARA CADA UNO DE LOS 599 DOCUMENTOS ACTIVOS
  // -------------------------------------------------------------------------
  for (const d of catalog) {
    const ext = String(d.ext || "").toUpperCase();
    if (ext === "HTML" && d.is_readable_html !== true) continue;
    if (d.is_duplicate || !d.title) continue;

    const t = shortTitle(d.title);
    const fname = d.filename || `${d.sha12}.${ext.toLowerCase()}`;
    const raw = textOf(d) || "";
    const sum = buildCoherentSummary(d, raw, cutSentence, clean);
    const dirA = d.section_label || "toda la membresía scout";
    const emisor = d.origin || "Asociación de Scouts de México, A.C. (ASMAC)";
    const subcat = d.subcategory ? ` → *${d.subcategory}*` : "";
    const metaDoc = `*Fuente oficial: ${t} (\`${fname}\`, ${ext}, ${d.year || "vigente"}).*`;

    // Q1: Qué es y para qué sirve (si dos archivos comparten título, distinguir por formato)
    const addedQ1 = add(
      {
        q: `¿Qué es «${t}» y para qué sirve?`,
        cat: d.category,
        doc_id: d.id,
        page: 1,
        ans: `**«${t}»** es un archivo oficial en formato **${ext}** emitido por **${emisor}** (${d.year || "vigente"}), clasificado en *${d.category}*${subcat} y pensado para **${dirA}**.\n\n**Para qué sirve:** ${sum}\n\n${ubic(d)}\n\n${metaDoc}`,
      },
      "basicas_que_es"
    );
    if (!addedQ1) {
      add(
        {
          q: `¿Qué es el archivo «${t}» en formato ${ext} y para qué sirve?`,
          cat: d.category,
          doc_id: d.id,
          page: 1,
          ans: `**«${t}» (${ext})** es la versión en formato **${ext}** (\`${fname}\`) emitida por **${emisor}** (${d.year || "vigente"}) dentro de *${d.category}*${subcat}.\n\n**Para qué sirve:** ${sum}\n\n${ubic(d)}\n\n${metaDoc}`,
        },
        "basicas_que_es"
      );
    }

    // Q2: Nombre de archivo exacto y dónde descargarlo / consultarlo
    add(
      {
        q: `¿Cómo se llama el archivo de «${t}» y dónde puedo checarlo o descargarlo?`,
        cat: d.category,
        doc_id: d.id,
        page: 1,
        ans: `El archivo oficial se llama **\`${fname}\`** (${ext}, ${fmtSize(d)}${d.page_count > 1 ? `, ${d.page_count} páginas` : ""}) y lo encuentras dentro de *${d.category}*${subcat}.\n\n${ubic(d)}\n\n${metaDoc}`,
      },
      "basicas_donde"
    );

    // Q3: Quién lo llena / quién lo emite / quién es responsable o con quién acercarse
    const { roles, emails, phones } = detectRolesAndContacts(raw);
    const isFormOrSheet =
      ext === "XLSX" ||
      ext === "DOCX" ||
      /formato|plantilla|acta|ficha|solicitud|anexo|matriz|registro|planilla|p\d+\.\d|di[aá]logo|mediaci[oó]n|arbitraje/i.test(
        `${t} ${fname}`
      );
    let respText = "";
    if (roles.length) {
      respText = isFormOrSheet
        ? `Según el propio documento, los roles responsables vinculados con el llenado, firma, revisión o trámite de **«${t}»** son: **${roles.join(", ")}**.`
        : `El documento **«${t}»** fue emitido por **${emisor}**, está dirigido a **${dirA}** y menciona dentro de su contenido o instancias responsables a: **${roles.join(", ")}**.`;
    } else {
      respText = isFormOrSheet
        ? `**«${t}»** es una plantilla/formato emitido por **${emisor}** dirigido a **${dirA}**. Si tienes dudas sobre cómo llenarlo o dónde entregarlo, acércate primero con tu **Scouter de Sección** o **Jefe de Grupo**.`
        : `**«${t}»** es un documento de consulta emitido por **${emisor}** y dirigido a **${dirA}**. Si necesitas orientación adicional sobre su aplicación en tu grupo, acércate con tu **Scouter** o **Jefe de Grupo**.`;
    }
    if (emails.length || phones.length) {
      respText += `\n\n**Contactos oficiales citados en el documento:** ${[...emails, ...phones].join(" · ")}.`;
    }

    add(
      {
        q: `¿Quién llena, emite o es responsable de «${t}»?`,
        cat: d.category,
        doc_id: d.id,
        page: 1,
        ans: `${respText}\n\n${sum}\n\n${metaDoc}`,
      },
      "basicas_responsable"
    );

    // Q4: Necesidad práctica según tipo de formato ("¿Cómo se llama el formato para...")
    for (const hint of TOPIC_HINTS_FOR_FILENAME) {
      if (hint.re.test(fname) || hint.re.test(t)) {
        add(
          {
            q: `¿Cómo se llama el archivo o formato oficial para ${hint.need}?`,
            cat: d.category,
            doc_id: d.id,
            page: 1,
            ans: `El documento oficial correspondiente es **«${t}»** (archivo **\`${fname}\`**, formato **${ext}**), ubicado en *${d.category}*${subcat}.\n\n**Uso:** ${sum}\n\n${metaDoc}`,
          },
          "basicas_nombre_formato"
        );
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. PREGUNTAS ESPECÍFICAS PARA TODOS LOS 17 ARCHIVOS EXCEL (.XLSX)
  // -------------------------------------------------------------------------
  for (const d of catalog) {
    if (String(d.ext || "").toUpperCase() !== "XLSX") continue;
    const t = shortTitle(d.title);
    const pkg = spreadsheets[d.sha12];
    if (!pkg || !Array.isArray(pkg.sheets) || !pkg.sheets.length) continue;

    const sheetList = pkg.sheets.map((s) => `**${s.name}** (${s.total_rows} filas)`).join(", ");
    const firstSheet = pkg.sheets[0];
    const headerRow = (firstSheet.rows || []).find((r) => r.filter(Boolean).length >= 2) || [];
    const headerPreview = headerRow.filter(Boolean).slice(0, 7).join(" · ");

    add(
      {
        q: `¿Qué pestañas o columnas contiene la hoja de cálculo Excel «${t}»?`,
        cat: d.category,
        doc_id: d.id,
        page: 1,
        ans: `El archivo Excel **«${t}»** (\`${d.filename}\`) cuenta con **${pkg.sheet_count} ${pkg.sheet_count === 1 ? "hoja" : "hojas"}**: ${sheetList}.${headerPreview ? `\n\n**Columnas o encabezados principales detectados en «${firstSheet.name}»:** ${clean(headerPreview)}.` : ""}\n\nPuedes consultarla directamente en tabla interactiva dentro del lector de BiblioTech Scout o descargar el archivo \`.xlsx\`.`,
      },
      "basicas_excel"
    );

    add(
      {
        q: `¿Puedo abrir el archivo Excel «${t}» en el celular sin descargar Office?`,
        cat: d.category,
        doc_id: d.id,
        page: 1,
        ans: `Sí. Tanto en la versión Web como en la App Android de BiblioTech Scout, al pulsar **Leer** o **Abrir** sobre **«${t}»** se despliega un **visor interactivo de hojas de cálculo** con todas sus pestañas, buscador por fila y columnas sin necesidad de apps externas, además de permitir descargar el archivo original **\`${d.filename}\`**.`,
      },
      "basicas_excel"
    );
  }

  // -------------------------------------------------------------------------
  // 3. BANCO CURADO DE PREGUNTAS SÚPER BÁSICAS: PORTALES, PROYECTOS Y CONTACTO
  // -------------------------------------------------------------------------
  const CURATED_BASICS = [
    {
      q: "¿Qué es la página RECME (recme.scouts.org.mx) y para qué sirve?",
      cat: "Plantillas PJOS, FAES y RECME",
      doc_id: "doc-0744",
      ans: "**RECME** (*Recursos del Método Educativo*, disponible en **https://recme.scouts.org.mx**) es el repositorio educativo oficial de la ASMAC respaldado por la **Subcomisión Nacional de Centros de Documentación (SCNCD)** y la **Comisión Nacional de Programa de Jóvenes (CNPJ)**.\n\n**Para qué sirve:** consultar y descargar sin costo los esquemas de progresión (`P3`), formatos de proyectos y eventos (`P6`), seguimiento (`P7`), solicitudes de Insignias Finales y Terminales (`P9`), planillas de adultos `CNAMS` (`P10`), la guía `FAES` y las **Fichas de Especialidades Scout (FES)** por sección.\n\n*Fuente oficial: Catálogo General RECME (doc-0744) y Catálogo de Plantillas PJOS (doc-0747).*",
    },
    {
      q: "¿Dónde puedo checar o descargar las Fichas de Especialidades Scout (FES) y formatos P1 a P10?",
      cat: "Especialidades Scouts (FES)",
      doc_id: "doc-0745",
      ans: "Puedes consultarlas en la plataforma oficial **https://recme.scouts.org.mx** (secciones `/especialidades` y `/bibleoteca-virtual`) o directamente aquí en BiblioTech Scout dentro de las categorías **Especialidades Scouts (FES)** y **Plantillas PJOS, FAES y RECME**.\n\n*Fuente oficial: Catálogo Oficial de Especialidades FES (doc-0745) y Catálogo de Plantillas RECME (doc-0747).*",
    },
    {
      q: "¿Qué es la Mesa de Ayuda o Help Desk ASMAC (helpdesk.scouts.org.mx) y para qué sirve?",
      cat: "Guías SISAS, CONECTA y Soporte Digital",
      doc_id: "doc-0741",
      ans: "La **Mesa de Ayuda oficial de la Oficina Scout Nacional** (**https://helpdesk.scouts.org.mx**) es el centro de soporte técnico y administrativo donde puedes consultar **25 guías paso a paso** (acceso a SISAS, cambio de grupo, registro familiar, pagos, facturas y reportes para Jefes de Grupo) o levantar un **ticket directo** hacia alguno de sus **11 departamentos especializados**.\n\n*Fuente oficial: Directorio Help Desk ASMAC: Categorías KB y 11 Departamentos de Tickets (doc-0741).*",
    },
    {
      q: "¿Con quién me puedo acercar si tengo un problema en SISAS, pagos, facturas o cambio de grupo?",
      cat: "Guías SISAS, CONECTA y Soporte Digital",
      doc_id: "doc-0741",
      ans: "Sigue este orden práctico indicado en las guías oficiales:\n1. **Primero acércate con tu Jefe de Grupo** (o Subjefe de Grupo Administrativo), quien aprueba cambios de grupo, alta de cursos/cargos y descarga reportes en SISAS.\n2. Si es un fallo técnico, de vigencia o pago, abre un **ticket en la Mesa de Ayuda** (**https://helpdesk.scouts.org.mx**) eligiendo el departamento exacto (**Sistemas/SISAS**, **Membresía**, **Seguros**, **Eventos**, **Tienda Nacional**, etc.).\n3. También puedes contactar a **Soporte SISAS Nacional**: Tel. `(55) 5208-7122 Exts. 100 y 150`, correos `servicios4@scouts.org.mx` y `servicios6@scouts.org.mx`.\n\n*Fuente oficial: Directorio Help Desk ASMAC (doc-0741) y Guías SISAS (doc-0718 a doc-0739).*",
    },
    {
      q: "¿Cuáles son los 11 departamentos de tickets de la Mesa de Ayuda (helpdesk.scouts.org.mx)?",
      cat: "Guías SISAS, CONECTA y Soporte Digital",
      doc_id: "doc-0741",
      ans: "En la Mesa de Ayuda oficial (**https://helpdesk.scouts.org.mx**) atienden tickets los siguientes **11 departamentos nacionales**: Sistemas (SISAS), Membresía, Seguros, Eventos Nacionales/Internacionales, Comunicación, Medios Alternativos de Solución de Controversias (MASC), Tienda Scout Nacional, Métodos Educativos, Formación / Adultos (ADMS), Campo Escuela Meztitla y Control de Bienes.\n\n*Fuente oficial: Directorio Help Desk ASMAC (doc-0741).*",
    },
    {
      q: "¿Qué es el portal de Registro Familiar (familiar.scouts.org.mx) y para qué sirve?",
      cat: "Guías SISAS, CONECTA y Soporte Digital",
      doc_id: "doc-0726",
      ans: "**Registro Familiar** (**https://familiar.scouts.org.mx**) es un portal independiente al menú principal de SISAS diseñado para que una familia nuclear (**papá, mamá e hijos**, de **3 a 5 miembros** con CUM y ficha médica completa en SISAS) pague su inscripción o reinscripción en un solo cargo vía Conekta.\n\n**Descuentos aplicados sobre la cuota nacional:** **25 %** (3 miembros), **30 %** (4 miembros) y **35 %** (5 miembros) en reingreso (y 35 % para nuevo ingreso según el Comunicado `JSN 25.009`). La cuota de Provincia se cobra completa y las vigencias se reflejan en SISAS dentro de **48 horas hábiles**.\n\n*Fuente oficial: Guía Help Desk Art. 30 Registro Familiar (doc-0726) y Comunicado JSN 25.009 (doc-0261).*",
    },
    {
      q: "¿Qué necesito tener listo antes de hacer el Registro Familiar en familiar.scouts.org.mx?",
      cat: "Guías SISAS, CONECTA y Soporte Digital",
      doc_id: "doc-0726",
      ans: "Antes de iniciar (tienes un temporizador de **20 minutos** por sesión), necesitas:\n1. La **cuenta CUM y contraseña de SISAS** de uno de los miembros (si papá o mamá no es miembro, entra con la cuenta de uno de sus hijos).\n2. Los **CUMs de los 3 a 5 integrantes nucleares** con cuenta activa y ficha de salud completa en SISAS.\n3. Una **tarjeta de crédito o débito** (también acepta Apple Pay o Google Pay en una sola exhibición; no acepta OXXO ni transferencia).\n\n*Fuente oficial: Guía Help Desk Art. 30 Registro Familiar (doc-0726).*",
    },
    {
      q: "¿Qué es CONECTA (conecta.scouts.org.mx) y para qué sirve?",
      cat: "Guías SISAS, CONECTA y Soporte Digital",
      doc_id: "doc-0740",
      ans: "**CONECTA** (**https://conecta.scouts.org.mx**) es el canal institucional oficial del programa *A Salvo del Peligro* de la ASMAC, creado para que niñas, niños, adolescentes, jóvenes, adultos y familiares puedan levantar de manera **confidencial, directa y oportuna** quejas, incidentes o denuncias ante situaciones de acoso, hostigamiento, bullying o riesgo a la integridad personal, además de consultar el seguimiento con su ID de denuncia.\n\n*Fuente oficial: Guía Help Desk ¿Qué es CONECTA? (doc-0740) y Conecta — Atención de Incidentes (doc-0017 / doc-0023).*",
    },
    {
      q: "¿Con quién me puedo acercar o dónde denuncio si sufro o veo un caso de acoso, maltrato o bullying en los Scouts?",
      cat: "Guías SISAS, CONECTA y Soporte Digital",
      doc_id: "doc-0740",
      ans: "Puedes reportarlo de inmediato de forma confidencial en el portal **CONECTA** (**https://conecta.scouts.org.mx**) indicando los datos del incidente para recibir un folio de seguimiento; también puedes acudir a la **Corte de Honor** correspondiente, a tu **Jefe de Grupo / Presidente de Provincia** o a la **Comisión de Vigilancia** conforme a la Política *A Salvo del Peligro* y el Código de Conducta 2025.\n\n*Fuente oficial: Guía Help Desk ¿Qué es CONECTA? (doc-0740) y Denuncia CONECTA (doc-0023).*",
    },
    {
      q: "¿Qué necesito para hacer y presentar un Proyecto Scout oficial (y qué archivos se usan)?",
      cat: "Plantillas PJOS, FAES y RECME",
      doc_id: "doc-0669",
      ans: "Para diseñar y presentar un Proyecto Scout según los formatos RECME 2026 necesitas:\n1. Definir el objetivo general, objetivos particulares (recomendado bajo metodología **SMART**: Específico, Medible, Alcanzable, Relevante y con Temporalidad), problemática que atiende y relación con los **ODS**.\n2. Llenar la plantilla **Formato Oficial de Proyecto Scout (v1.1)** (`doc-0669`) o la **Plantilla P6.2 — Proyecto** (`doc-0687`), detallando equipo/participantes, cronograma, recursos/presupuesto, plan de acción, evaluación y carta descriptiva.\n3. Presentar y validar el proyecto ante tu **Scouter/Consejero**, tu **Corte de Honor / Consejo de Comunidad / Asamblea de Clan** según tu sección.\n4. Al concluir, documentar logros y seguimiento con **`P6.5` (Informe de Actividades)** y **`P7.1–P7.4`** si contribuye a tu progresión o Insignia Terminal.\n\n*Fuente oficial: Formato Oficial de Proyecto Scout v1.1 (doc-0669), Plantilla P6.2 (doc-0687) y Mapa de Rutas P3.4 PPV SMART (doc-0679).*",
    },
    {
      q: "¿Qué formatos necesito para organizar un campamento o evento scout (salidas y permisos)?",
      cat: "Plantillas PJOS, FAES y RECME",
      doc_id: "doc-0686",
      ans: "De acuerdo con las plantillas RECME (`P6`) y los **Lineamientos de Riesgos en Eventos (JSN 19.073)**:\n- **Plan de campamento o excursión:** `P6.1` (`doc-0686`).\n- **Organización general de evento:** `P6.3` (`doc-0688`), o **`P6.4`** si es acantonamiento (`doc-0689`).\n- **Requisitos de seguridad y administración:** ficha de salud vigente, autorización/consentimiento de madre, padre o tutor para menores, permiso de **Uso de Imagen** (`Use-de-imagen-menor/mayor`), presupuesto/reporte financiero (formatos `NO 1` / `NO 6`) y aprobación del Consejo correspondiente.\n- **Al cierre:** informe de evento con **`P6.5`** (`doc-0690`).\n\n*Fuente oficial: Plantillas P6.1–P6.5 (doc-0686 a doc-0690) y JSN 19.073 Lineamientos de Riesgos (doc-0590).*",
    },
    {
      q: "¿Qué hago y qué formatos se llenan si ocurre un accidente en un campamento o junta scout?",
      cat: "Formatos, Actas y Seguro Scout",
      doc_id: "doc-0590",
      ans: "Atiende primero la emergencia médica del integrante y da aviso inmediato al **Scouter / Jefe de Grupo** y a sus familiares. Para hacer válido el **Seguro Scout contra Accidentes**, debes reunir y entregar los formatos oficiales disponibles aquí en *Formatos, Actas y Seguro Scout*: **Documento de Aviso de Accidente**, **Documento Informe Médico** y seguir el **Documento Informativo sobre Seguro contra Accidentes** (o abrir un ticket en **Seguros** de `helpdesk.scouts.org.mx`).\n\n*Fuente oficial: Catálogo de Formatos de Seguro Scout y JSN 19.073 (doc-0590).*",
    },
    {
      q: "¿Cómo cambio de Grupo Scout en SISAS y quién tiene que aprobarlo?",
      cat: "Guías SISAS, CONECTA y Soporte Digital",
      doc_id: "doc-0723",
      ans: "Tu cuenta debe solicitar el **Cambio de Grupo** dentro de **SISAS** (`sisas.scouts.org.mx`). Una vez enviada la solicitud, se requiere la aprobación tanto de tu **Jefe de Grupo de origen** como de tu **Jefe de Grupo receptor**; cada etapa tiene un límite de **15 días naturales** antes de expirar.\n\n*Fuente oficial: Guías Help Desk Cómo solicitar cambio de grupo y Jefe de Grupo aprobar/rechazar cambio de grupo (doc-0723 / doc-0738).*",
    },
    {
      q: "¿Qué es SISAS (sisas.scouts.org.mx) y para qué sirve?",
      cat: "Guías SISAS, CONECTA y Soporte Digital",
      doc_id: "doc-0073",
      ans: "**SISAS** (*Sistema de Administración Scout*, **https://sisas.scouts.org.mx**) es la plataforma nacional oficial de administración y membresía de la ASMAC que sustituyó a RegNal. Sirve para actualizar tu perfil y ficha médica, descargar tu **credencial digital con QR**, reinscribirte, inscribirte a eventos nacionales, consultar historial y, para Jefes de Grupo, aprobar trámites y descargar reportes en Excel.\n\n*Fuente oficial: Guías SISAS (doc-0073 y doc-0716 a doc-0739).*",
    },
    {
      q: "¿Qué es la plataforma CDC (cdc.scouts.org.mx) y para qué sirve?",
      cat: "Guías, Carnets y Programa de Jóvenes (PJOS)",
      doc_id: "doc-0005",
      ans: "**CDC** (*Comunidad Digital de Conocimiento*, **https://cdc.scouts.org.mx**) es la plataforma educativa en línea oficial de la ASMAC donde tanto adultos como jóvenes cursan capacitaciones autogestivas (como *A Salvo del Peligro*), cursos especializados del PJOS, módulos propedéuticos de Punta de Flecha y cargan el Portafolio de Experiencia para Insignias Finales y Terminales.\n\n*Fuente oficial: Portal ASMAC - CDC (doc-0005 / doc-0175 / doc-0180).*",
    },
    {
      q: "¿Qué son ExplorApp y CarpetApp y para qué sirven?",
      cat: "Guías, Carnets y Programa de Jóvenes (PJOS)",
      doc_id: "doc-0138",
      ans: "**ExplorApp** (para niñas, niños y jóvenes) y **CarpetApp** (para Scouters y dirigentes de sección) son las aplicaciones oficiales del Programa de Jóvenes (**PJOS**) lanzadas en febrero de 2026 (`DNME-CNPJ 26.014`) para registrar avances de progresión personal, retos, Cazaderos, Rumbos, Senderos y Rutas.\n\n*Fuente oficial: Comunicado DNME-CNPJ 26.014 y guía ASMAC - CDC ExplorApp (doc-0138).*",
    },
    {
      q: "¿Qué es la plataforma Scout Donation Platform (donate.scout.org) que aparece en las infografías de WOSM?",
      cat: "Identidad Gráfica y Recursos Visuales",
      doc_id: "doc-0381",
      ans: "**Scout Donation Platform** (**https://donate.scout.org**) es la plataforma global de World Scouting (WOSM) donde Grupos y equipos Scouts comparten proyectos comunitarios verificados para recibir donativos y alianzas internacionales, siguiendo las buenas prácticas de historia en 7 preguntas (*How to Get Attention For Your Story*) y grabación audiovisual segura (*Lights, Camera, Action!*).\n\n*Fuente oficial: Infografías WOSM doc-0367 y doc-0381.*",
    },
    {
      q: "¿Dónde puedo checar la fecha límite o plazos de registro inicial y reinscripción anual?",
      cat: "Guías SISAS, CONECTA y Soporte Digital",
      doc_id: "doc-0725",
      ans: "De acuerdo con las guías oficiales de **Help Desk / SISAS**: el **registro inicial** tiene un plazo de **45 días** y la **reinscripción anticipada** puede realizarse hasta **60 días** antes del vencimiento, generando comprobantes de pago y factura fiscal (cuya solicitud de factura aplica dentro de los **30 días** correspondientes conforme a las reglas vigentes en `helpdesk.scouts.org.mx`).\n\n*Fuente oficial: Guías Help Desk de Reinscripción y Facturación (doc-0725 / doc-0728).*",
    },
    {
      q: "¿Qué diferencia hay entre la Insignia Terminal Jade y Obsidiana en los formatos P9.1 a P9.4?",
      cat: "Plantillas PJOS, FAES y RECME",
      doc_id: "doc-0702",
      ans: "Los formatos **P9.1 a P9.4** (solicitudes de Insignia Final de Manada *Alfa* y Terminales de Tropa *Águila Real*, Comunidad *Everest* y Clan *Baden-Powell*) contemplan la modalidad ordinaria (**Jade**) y la versión por reconocimiento o categoría complementaria (**Obsidiana**) según los requisitos de edad, progresión y proyectos concluidos definidos en cada planilla oficial.\n\n*Fuente oficial: Plantillas RECME P9.1 a P9.4 (doc-0702 a doc-0705).*",
    },
    {
      q: "¿Para qué sirven las Hojas Membretadas 2025 (doc-0229 DOCX y doc-0230 PDF) y quién las usa?",
      cat: "Identidad Gráfica y Recursos Visuales",
      doc_id: "doc-0229",
      ans: "Las **Hojas Membretadas Oficiales 2025** (`doc-0229` en editable Word y `doc-0230` en PDF) muestran la identidad institucional *Listos 2025 Para La Vida · #ScoutsEnMovimiento*. Sirven para redactar oficios, cartas, convocatorias, actas o avisos oficiales de **Grupos Scouts, Provincias y órganos nacionales** manteniendo la imagen gráfica autorizada.\n\n*Fuente oficial: Hoja 2025 (`Hoja 2025.docx` y `Hoja 2025.pdf`).*",
    },
    {
      q: "¿De qué trata el Comunicado JSN/24.013 sobre Medias Becas Banxico y a quién se dirige?",
      cat: "Convocatorias y Comunicados Nacionales",
      doc_id: "doc-0424",
      ans: "El comunicado **ASMAC/JSN/24.013** (*Medias Becas Banxico*), emitido el **31 de enero de 2024** y dirigido a **Presidentes de Provincia**, informa el apoyo del programa *«BANXICO da la mano»* con **50 medias becas** en la cuota de registro nacional (para reingresos y nuevos ingresos señalados en la convocatoria), destinadas a niñas, niños y jóvenes de bajos recursos.\n\n*Fuente oficial: Medias Becas Banxico (`doc-0424`).*",
    },
    {
      q: "¿Qué establecen los Lineamientos de Administración de Riesgos para la Organización de Eventos (JSN/19.073)?",
      cat: "Reglamentos, Estatutos y Políticas",
      doc_id: "doc-0590",
      ans: "Emitidos el **30 de mayo de 2019** y dirigidos a **Presidentes de Provincia y Jefes de Grupo**, disponen que toda actividad fuera de local o masiva debe contar con programa aprobado en calendario o plan anual validado por su respectivo Consejo, cumplir los reportes financieros del Manual de Tesorería, presentar resultados financieros finales, conclusiones y evaluación del programa.\n\n*Fuente oficial: Lineamientos de Administración de Riesgos JSN/19.073 (`doc-0590`).*",
    },
    {
      q: "¿Qué contiene y quién firma el Acta de Congreso de Comunidad de Caminantes?",
      cat: "Formatos, Actas y Seguro Scout",
      doc_id: "doc-0143",
      ans: "El formato **Congreso de Comunidad** (`doc-0143` PDF / `doc-0142` DOCX) registra Provincia, Grupo, fecha, número de sesión, orden del día (oración, asistencia, lectura de acta anterior, puntos por tratar, generales y cierre), lista de asistentes con **CUM, cargo, nombre y firma**, acuerdos numerados y firmas finales del **Secretario de la Comunidad** y **Jefe de Comunidad**.\n\n*Fuente oficial: CONGRESO DE COMUNIDAD (`doc-0142`, `doc-0143`).*",
    },
    {
      q: "¿Para qué sirve el Plan Anual de Trabajo del Comité de la Red de Caminantes (CRCP)?",
      cat: "Plantillas PJOS, FAES y RECME",
      doc_id: "doc-0371",
      ans: "El formato **Plan Anual de Trabajo CRCP** (`doc-0371` PDF / `doc-0370` DOCX) permite al **Comité de la Red de Caminantes de Provincia** y su **Asesor** planificar metas internas (entre miembros del Comité) y externas (con los caminantes de la provincia), desglosando **Objetivos, Indicadores cuantificables y Acciones específicas**.\n\n*Fuente oficial: PLAN ANUAL DE TRABAJO CRCP (`doc-0370`, `doc-0371`).*",
    },
    {
      q: "¿Qué principios y estándares humanitarios muestra la infografía oficial de World Scouting (WOSM)?",
      cat: "Identidad Gráfica y Recursos Visuales",
      doc_id: "doc-0335",
      ans: "La lámina oficial **4 Principios Clave y Estándares de Acción Humanitaria** (`doc-0335` / `doc-0337`) destaca cuatro principios: **Neutralidad** (*Neutrality*), **Imparcialidad** (*Impartiality*), **Independencia** (*Independence*) y **Humanidad** (*Humanity*), junto con tres estándares vinculados al Escultismo: **Participación Comunitaria**, **Cuidado y Dignidad** y **Diálogo**.\n\n*Fuente oficial: Infografía WOSM Acción Humanitaria (`doc-0335`, `doc-0337`).*",
    },
    {
      q: "¿Qué consejos da la guía visual «Lights, Camera, Action!» de WOSM para grabar un proyecto Scout?",
      cat: "Identidad Gráfica y Recursos Visuales",
      doc_id: "doc-0367",
      ans: "La infografía oficial **Lights, Camera, Action!** (`doc-0367` / `doc-0369`, Scout Donation Platform) resume 5 recomendaciones clave: **Luz y Sonido** (luz natural evitando contraluz y usar manos libres en sitios sin viento), **Enfoque y Fondo**, **Estabilidad** (horizontal para YouTube / vertical para Instagram, TikTok y Facebook), **Acción** (evitar poses rígidas) y **Consentimiento explícito** (incluyendo permiso de padres para menores).\n\n*Fuente oficial: Infografía WOSM Lights, Camera, Action! (`doc-0367`).*",
    },
  ];

  for (const item of CURATED_BASICS) {
    add({ q: item.q, cat: item.cat, doc_id: item.doc_id, page: 1, ans: item.ans }, "basicas_curadas");
  }
}

module.exports = { generateUniversalBasicsFaq };
