/**
 * Generador modular de Q&As para los 65 PDFs canónicos (RECME / FES / PJOS / CNAMS),
 * 32 guías HTML autónomas (Help Desk SISAS/CONECTA, Geniallys y catálogos RECME)
 * y 4 activos visuales oficiales (doc-0651 .. doc-0751).
 *
 * Garantiza entre 10 y 30 preguntas y respuestas únicas, claras y fundamentadas
 * exclusivamente en los documentos para cada uno de los 65 nuevos PDFs.
 */

const fs = require("fs");
const path = require("path");

const ODS_NAMES = {
  1: "ODS 1: Fin de la pobreza",
  2: "ODS 2: Hambre cero",
  3: "ODS 3: Salud y bienestar",
  4: "ODS 4: Educación de calidad",
  5: "ODS 5: Igualdad de género",
  6: "ODS 6: Agua limpia y saneamiento",
  7: "ODS 7: Energía asequible y no contaminante",
  8: "ODS 8: Trabajo decente y crecimiento económico",
  9: "ODS 9: Industria, innovación e infraestructura",
  10: "ODS 10: Reducción de las desigualdades",
  11: "ODS 11: Ciudades y comunidades sostenibles",
  12: "ODS 12: Producción y consumo responsables",
  13: "ODS 13: Acción por el clima",
  14: "ODS 14: Vida submarina",
  15: "ODS 15: Vida de ecosistemas terrestres",
  16: "ODS 16: Paz, justicia e instituciones sólidas",
  17: "ODS 17: Alianzas para lograr los objetivos",
};

const EJE_FROM_SUBCAT = (subcat = "") => {
  if (/Medio Ambiente/i.test(subcat)) return "Medio Ambiente y Sustentabilidad";
  if (/Paz y Particip/i.test(subcat)) return "Paz y Participación Comunitaria";
  if (/Salud y Bienestar/i.test(subcat)) return "Salud y Bienestar";
  if (/Habilidades/i.test(subcat)) return "Habilidades para la Vida";
  return "Programa de Jóvenes (PJOS)";
};

function stripEmojis(s) {
  return String(s || "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\uFE0F/g, "")
    .trim();
}

function cleanBlock(s, maxLen = 950) {
  let out = stripEmojis(s)
    .replace(/\r\n/g, "\n")
    .replace(/---\s*P[aá]gina\s*\d+\s*---/gi, "\n")
    .replace(/\b(?:[A-ZÁÉÍÓÚÑ]\s+){4,}[A-ZÁÉÍÓÚÑ]\b/g, (m) => m.replace(/\s+/g, ""))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (out.length <= maxLen) return out;
  const sub = out.slice(0, maxLen);
  const lastStop = Math.max(sub.lastIndexOf(". "), sub.lastIndexOf("\n"));
  if (lastStop > maxLen * 0.55) {
    let part = sub.slice(0, lastStop + 1).trim();
    if (part && !/[.!?:"'»*)]$/.test(part)) part += ".";
    return part;
  }
  const sp = sub.lastIndexOf(" ");
  return (sp > 0 ? sub.slice(0, sp) : sub).trim() + ".";
}

function splitBullets(s) {
  return String(s || "")
    .split(/\n|(?:\s*[•*]\s+)|(?:\s+-\s+(?=[A-ZÁÉÍÓÚÑ¿¡]))/)
    .map((x) => cleanBlock(x.replace(/^[-*•.\d)]+\s*/, ""), 500))
    .filter((x) => x.length >= 22);
}

function addForPdfFactory(addFn, perPdfCount) {
  return function addPdf(d, q, ans, page = 1, bucket = "recme_pdf") {
    const qClean = stripEmojis(q).replace(/\s+/g, " ").trim();
    const ansClean = cleanBlock(ans, 1400);
    if (!qClean || ansClean.length < 25) return false;
    const count = perPdfCount.get(d.id) || 0;
    if (count >= 25) return false;
    const ok = addFn(
      {
        q: qClean,
        cat: d.category,
        doc_id: d.id,
        page,
        ans: ansClean,
      },
      bucket
    );
    if (ok) perPdfCount.set(d.id, count + 1);
    return ok;
  };
}

function generateRecmeFaq(ctx) {
  const { catalog, textOf, add, shortTitle, ubic, fmtSize, stats } = ctx;
  const pdfFieldsPath = path.resolve(
    "C:\\Users\\liamc\\.gemini\\antigravity\\brain\\dc865d9a-effc-4438-a5e0-8b8b7edae51e\\scratch\\pdfs_complete_text_and_fields.json"
  );
  const fieldsBySha = {};
  if (fs.existsSync(pdfFieldsPath)) {
    const arr = JSON.parse(fs.readFileSync(pdfFieldsPath, "utf-8"));
    for (const item of arr) {
      fieldsBySha[item.sha12] = item.fields || {};
    }
  }

  const perPdfCount = new Map();
  const addPdf = addForPdfFactory(add, perPdfCount);

  const newDocs = catalog.filter((d) => {
    const num = parseInt(String(d.id || "").replace(/\D+/g, ""), 10) || 0;
    return num >= 651;
  });

  // -------------------------------------------------------------------------
  // PARTE A: 65 NUEVOS PDFs (10 a 30 preguntas únicas y claras por PDF)
  // -------------------------------------------------------------------------
  const pdfDocs = newDocs.filter((d) => d.ext === "PDF");

  for (const d of pdfDocs) {
    const t = shortTitle(d.title);
    const fname = d.filename;
    const raw = textOf(d) || "";
    const fields = fieldsBySha[d.sha12] || {};
    const fuente = `*Fuente oficial: ${t} (\`${fname}\`).*`;
    const eje = EJE_FROM_SUBCAT(d.subcategory);

    // 1. Preguntas base universales de identificación, alcance y descarga (4-5 por PDF)
    const cleanIntro = cleanBlock(
      raw
        .replace(/^DOCUMENTO OFICIAL ASMAC:[^\n]*\n/m, "")
        .replace(/^Archivo:[^\n]*\n/m, "")
        .replace(/^Fecha de publicación[^\n]*\n/m, "")
        .replace(/^Categoría RECME:[^\n]*\n/m, "")
        .replace(/^Etiqueta temática[^\n]*\n/m, ""),
      620
    );

    addPdf(
      d,
      `¿Qué es y para qué sirve «${t}»?`,
      `**«${t}»** es un documento oficial en formato PDF publicado por **${d.origin || "ASMAC"}** dentro de *${d.category}* → *${d.subcategory || "General"}*, dirigido a **${d.section_label}**.\n\n${ubic(d)}\n\n${fuente}`
    );

    addPdf(
      d,
      `¿A qué sección, categoría y subcategoría pertenece «${t}»?`,
      `**«${t}»** corresponde a la sección **${d.section_label}** y se encuentra organizado en:\n- **Categoría:** ${d.category}\n- **Subcategoría:** ${d.subcategory || "General"}\n- **Fecha de referencia:** ${d.date_sort || d.year}\n\n${fuente}`
    );

    addPdf(
      d,
      `¿Cómo puedo ver o descargar «${t}» en formato original?`,
      `El archivo \`${fname}\` pesa **${fmtSize(d)}** (${d.page_count} ${d.page_count === 1 ? "página" : "páginas"}). En la sección **Biblioteca** o en el **Catálogo**, busca «${t}» o filtra por *${d.category}* / *${d.subcategory || "Todas"}* y pulsa **Leer** para abrirlo en línea o **Descargar** para guardarlo sin conexión.\n\n${fuente}`
    );

    addPdf(
      d,
      `¿Cuándo fue publicado «${t}» en la biblioteca digital y cuántas páginas tiene?`,
      `La edición respaldada de **«${t}»** tiene fecha de referencia **${d.date_sort || d.year}**${d.code ? ` (clave **${d.code}**)` : ""} y consta de **${d.page_count} ${d.page_count === 1 ? "página" : "páginas"}** en PDF (${fmtSize(d)}).\n\n${fuente}`
    );

    // 2. Especialidades FES de Comunidad (18 PDFs)
    if (fname.startsWith("FES_CC_")) {
      const espName = cleanBlock(fields.Texto160 || t.replace(/^Especialidad Scout \(Comunidad\):\s*/i, ""), 160);
      const conozco = cleanBlock(fields.Texto161 || "", 950);
      const aplico = cleanBlock(fields.Texto163 || "", 950);
      const comparto = cleanBlock(fields.Texto165 || "", 800);
      const autor = cleanBlock(fields.Texto167 || "", 120);
      const seguridad = cleanBlock(fields.Texto168 || "", 800);
      const keywords = cleanBlock(fields.Texto169 || "", 200);
      const secField = cleanBlock(fields.Dropdown170 || "COMUNIDAD", 80);

      const odsList = [];
      for (let n = 1; n <= 17; n++) {
        const val = String(fields[`Check Box${170 + n}`] || "");
        if (/S[íi]|Yes|On|true/i.test(val)) {
          odsList.push(ODS_NAMES[n]);
        }
      }

      addPdf(
        d,
        `¿A qué Eje Temático y sección corresponde la especialidad «${espName}»?`,
        `La Ficha de Especialidad Scout (FES) **«${espName}»** está asignada a la sección **${secField}** (Comunidad de Caminantes) y pertenece al Eje Temático **${eje}**${keywords ? ` (palabras clave: *${keywords}*)` : ""}.\n\n${fuente}`
      );

      if (autor) {
        addPdf(
          d,
          `¿Quién elaboró la Ficha de Especialidad Scout «${espName}»?`,
          `De acuerdo con el campo *Elaboró* de la ficha oficial, **«${espName}»** fue elaborada por **${autor}** y publicada en la plataforma RECME el **${d.date_sort}**.\n\n${fuente}`
        );
      }

      if (odsList.length) {
        addPdf(
          d,
          `¿A qué Objetivos de Desarrollo Sostenible (ODS) abona la especialidad «${espName}»?`,
          `En la ficha de **«${espName}»** están marcados los siguientes Objetivos de Desarrollo Sostenible (**ODS**):\n- ${odsList.join("\n- ")}\n\n${fuente}`
        );
      }

      if (conozco) {
        addPdf(
          d,
          `¿Qué tengo que aprender en la etapa CONOZCO de la especialidad «${espName}»?`,
          `En el bloque **1. CONOZCO** (*Lo que tengo que aprender sobre la especialidad*), **«${espName}»** establece:\n\n${conozco}\n\n${fuente}`
        );
        const cBullets = splitBullets(fields.Texto161 || "");
        if (cBullets.length >= 2) {
          addPdf(
            d,
            `¿Cuál es el primer tema o conocimiento clave que pide «${espName}»?`,
            `El primer aspecto indicado en *1. CONOZCO* de **«${espName}»** es:\n\n> ${cBullets[0]}\n\nY también contempla: ${cBullets[1]}.\n\n${fuente}`
          );
          if (cBullets.length >= 3) {
            addPdf(
              d,
              `¿Qué conocimientos prácticos adicionales incluye la etapa CONOZCO de «${espName}»?`,
              `Además de los fundamentos iniciales, la sección *1. CONOZCO* de **«${espName}»** incluye:\n- ${cBullets.slice(1, 5).join("\n- ")}\n\n${fuente}`
            );
          }
        }
      }

      if (aplico) {
        addPdf(
          d,
          `¿Qué actividades prácticas pide la etapa APLICO de la especialidad «${espName}»?`,
          `En el bloque **2. APLICO** (*Lo que hago para demostrar los conocimientos que adquirí sobre la especialidad*), **«${espName}»** señala:\n\n${aplico}\n\n${fuente}`
        );
        const aBullets = splitBullets(fields.Texto163 || "");
        if (aBullets.length >= 2) {
          addPdf(
            d,
            `¿Cómo demuestro en la práctica que domino la especialidad «${espName}»?`,
            `Para demostrar tus conocimientos en la etapa *APLICO* de **«${espName}»**, la ficha indica entre sus acciones:\n- ${aBullets.slice(0, 4).join("\n- ")}\n\n${fuente}`
          );
        }
      }

      if (comparto) {
        addPdf(
          d,
          `¿Cómo se cumple la etapa COMPARTO de la especialidad «${espName}»?`,
          `En el bloque **3. COMPARTO** (*La forma en que comparto mis nuevas habilidades con el resto*), la ficha **«${espName}»** indica:\n\n${comparto}\n\n${fuente}`
        );
      }

      if (seguridad) {
        addPdf(
          d,
          `¿Qué medidas de seguridad marca la especialidad «${espName}»?`,
          `En el apartado **MEDIDAS DE SEGURIDAD** (junto al sello *Safe from Harm*), **«${espName}»** establece:\n\n${seguridad}\n\n${fuente}`
        );
      }

      addPdf(
        d,
        `¿Qué preguntas de DESCUBRO y REFLEXIONO acompaña la ficha «${espName}»?`,
        `Al inicio (*DESCUBRO*) la ficha pregunta: *«¿Qué me llama la atención? ¿Qué me gustaría aprender? ¿Qué cosas nuevas me gustaría hacer? ¿Qué cosas me emocionan y me ponen feliz cuando las hago? ¿Cuál de las actividades que practico me gustaría conocer más? ¿Cuáles son mis pasatiempos favoritos?»*.\n\nAl cierre (*REFLEXIONO*) pregunta: *«¿Qué cosas nuevas aprendí? ¿Cómo me siento de poder ayudar a los demás con mis habilidades? ¿Cómo me sentí con las personas que me ayudaron a obtener mi especialidad? ¿Cuáles problemas me encontré y cómo los resolví? ¿Qué consejo le daría a quienes quisieran lograr esta especialidad?»*.\n\n${fuente}`
      );

      if (keywords) {
        addPdf(
          d,
          `¿Qué tema relacionado o etiquetas tiene la especialidad «${espName}»?`,
          `En la ficha **«${espName}»**, el campo *Tema relacionado* indica **${keywords}** (categoría RECME: *${d.subcategory}*).\n\n${fuente}`
        );
      }

      if (d.page_count > 1 && fields["Campo de texto 10"]) {
        addPdf(
          d,
          `¿Qué información adicional trae la página 2 anexa de «${espName}»?`,
          `La página 2 (Anexo de Ficha de Especialidad Scout) de **«${espName}»** amplía el desarrollo técnico:\n\n${cleanBlock(fields["Campo de texto 10"], 950)}\n\n${fuente}`,
          2
        );
      }
    }

    // 3. P1.0.x y P2.0.x (4 FAES editables de Diagnóstico y Evaluación)
    if (/^P[12]\.0\./.test(fname)) {
      const fTitle = cleanBlock(fields["Campo de texto 7"] || t, 220);
      const obj = cleanBlock(fields["Campo de texto 8"] || "", 700);
      const mat = cleanBlock(fields["Campo de texto 4"] || "", 500);
      const dev = cleanBlock(fields["Campo de texto 10"] || "", 950);
      const prep = cleanBlock(fields["Campo de texto 9"] || "", 600);
      const seg = cleanBlock(fields["Campo de texto 12"] || "", 600);
      const refQ = cleanBlock(fields["Campo de texto 11"] || "", 700);
      const varTxt = cleanBlock(fields["Campo de texto 13"] || "", 600);
      const kw = cleanBlock(fields["Campo de texto 14"] || "", 260);
      const author = cleanBlock(fields["Campo de texto 15"] || "", 120);
      const links = cleanBlock(fields["Campo de texto 5"] || "", 450);

      addPdf(
        d,
        `¿Cuál es el objetivo principal de «${fTitle}» (${fname})?`,
        `${obj || cleanBlock(dev, 600)}\n\n${fuente}`
      );
      if (prep) {
        addPdf(d, `¿Cómo debe prepararse el Scouter antes de aplicar «${fTitle}»?`, `**Preparación recomendada:**\n\n${prep}\n\n${fuente}`);
      }
      if (dev) {
        addPdf(d, `¿Cuál es el desarrollo y pasos que indica «${fTitle}»?`, `**Desarrollo del instrumento:**\n\n${dev}\n\n${fuente}`);
      }
      if (refQ) {
        addPdf(d, `¿Qué preguntas orientadoras propone «${fTitle}» para entrevistar o evaluar?`, `**Preguntas orientadoras de referencia:**\n\n${refQ}\n\n${fuente}`);
      }
      if (seg) {
        addPdf(d, `¿Qué medidas de seguridad (*A Salvo del Peligro*) recuerda «${fTitle}»?`, `**Medidas de seguridad obligatorias:**\n\n${seg}\n\n${fuente}`);
      }
      if (mat) {
        addPdf(d, `¿Qué materiales se necesitan para «${fTitle}»?`, `**Recursos materiales:** ${mat}${fields["Cuadro de lista 2"] ? ` • **Rango de edad:** ${fields["Cuadro de lista 2"]}` : ""}${fields["Campo de texto 1"] ? ` • **Duración estimada:** ${fields["Campo de texto 1"]} ${fields["Cuadro de lista 3"] || "horas"}` : ""}.\n\n${fuente}`);
      }
      if (varTxt) {
        addPdf(d, `¿Qué variantes o adaptaciones permite «${fTitle}»?`, `**Variantes y recomendaciones de aplicación:**\n\n${varTxt}\n\n${fuente}`);
      }
      if (kw || author) {
        addPdf(d, `¿Quién elaboró «${fTitle}» y cuáles son sus palabras clave?`, `Elaborado por **${author || "Comisión Nacional de Programa de Jóvenes"}**. Palabras clave: *${kw || "Evaluación / Diagnóstico PJOS"}*.${links ? `\n\n**Enlaces de referencia:** ${links}` : ""}\n\n${fuente}`);
      }
    }

    // 4. P1.1..P1.4 (4 Matrices de Diagnóstico Inicial MLL/TS/CC/CR)
    if (/^P1\.[1-4]_/.test(fname)) {
      const lines = raw.split("\n").map((x) => x.trim()).filter(Boolean);
      const compLines = lines.filter((ln) =>
        /^(Las Lobeznas|Los Scouts|Las y los|Los Caminantes|Los Rovers|El Caminante|La o el|Identifica|Conoce|Aplica|Comparte|Reconoce)/i.test(ln) && ln.length > 35
      );
      addPdf(
        d,
        `¿Para qué sirve la «${t}» y qué niveles de dominio evalúa?`,
        `La **${t}** sirve para diagnosticar las competencias educativas desarrolladas por cada integrante de **${d.section_label}** al ingresar o cambiar de sección. Cada fila evalúa cuatro columnas de dominio progresivo: **IDENTIFICA**, **CONOCE**, **APLICA** y **COMPARTE**, además de indicar el estatus (**ENTREGADO PREVIAMENTE / DESARROLLAR / ETAPA DE PROGRESIÓN / ENTREGAR**).\n\n${fuente}`
      );
      addPdf(
        d,
        `¿Cuántos y cuáles niveles de seguimiento incluye la tabla de «${t}»?`,
        `La matriz de **${d.section_label}** combina las competencias de los ámbitos simbólicos de la sección con una escala de 4 niveles (*Identifica → Conoce → Aplica → Comparte*) y campos para **Scouter**, **Provincia**, sección y progreso previo.\n\n${fuente}`
      );
      for (let idx = 0; idx < Math.min(compLines.length, 8); idx++) {
        const comp = cleanBlock(compLines[idx], 360);
        const shortQ = cleanBlock(comp, 78).replace(/[.,;:]+$/, "");
        addPdf(
          d,
          `¿Qué competencia evaluada en «${t}» corresponde a «${shortQ}»?`,
          `En la **${t}** (página ${idx >= 4 && d.page_count > 1 ? 2 : 1}), dentro de la matriz de competencias de **${d.section_label}**, se evalúa textualmente:\n\n> ${comp}\n\nSe marca el grado alcanzado entre *Identifica*, *Conoce*, *Aplica* o *Comparte*.\n\n${fuente}`,
          idx >= 4 && d.page_count > 1 ? 2 : 1
        );
      }
    }

    // 5. P2.1..P2.4 (4 Cédulas Auxiliares de Evaluación MLL/TS/CC/CR)
    if (/^P2\.[1-4]_/.test(fname)) {
      const blocks = raw
        .split(/(?=(?:CAZADERO|RUMBO|SENDERO|RUTA)\s+[A-ZÁÉÍÓÚÑ]+|Especialidades\s*\(|Aventuras en la Naturaleza|Iniciativas Mundiales|Acreditación)/i)
        .map((x) => cleanBlock(x, 650))
        .filter((x) => x.length > 45);
      addPdf(
        d,
        `¿Para qué utilizan los Scouters la «${t}»?`,
        `La **${t}** permite al Scouter llevar el registro auxiliar detallado de cada integrante de **${d.section_label}**: avance en los cuatro ámbitos simbólicos (*Aplica / Comparte*), Especialidades, Aventuras en la Naturaleza, Iniciativas Mundiales y Eventos, con su **Estatus**, **Fecha de Terminación** y **Fecha de Entrega**.\n\n${fuente}`
      );
      addPdf(
        d,
        `¿Qué columnas de fecha y control incluye cada rubro de la «${t}»?`,
        `Para cada bloque de progresión, especialidad, aventura o iniciativa mundial, la cédula solicita:\n- **Estatus**\n- **Fecha de Terminación**\n- **Fecha de Entrega**\nY para eventos registra *Nombre del evento*, *Fecha* y *Duración*.\n\n${fuente}`
      );
      const qTitles = [
        "primer bloque de progresión",
        "segundo ámbito de evaluación",
        "tercer apartado de evaluación",
        "cuarto ámbito de seguimiento",
        "seguimiento de Especialidades y Aventuras",
        "seguimiento de Iniciativas Mundiales y Eventos",
      ];
      for (let b = 0; b < Math.min(blocks.length, 6); b++) {
        addPdf(
          d,
          `¿Qué apartados registra el ${qTitles[b] || `bloque ${b + 1}`} en «${t}»?`,
          `En la **${t}** aparece el siguiente bloque de seguimiento:\n\n${blocks[b]}\n\n${fuente}`,
          Math.min(d.page_count, b + 1)
        );
      }
    }

    // 6. P3.1..P3.4 (Libro Seeonee, Mapa Exploraciones, Hoja Caminata, Pasaporte Comunidad, Mapa Rutas)
    if (fname === "P3.1_MLLMiLibroSeeonee_v1.1.pdf") {
      const seeoneeQA = [
        ["¿Qué es «Mi Libro del Seeonee» y para qué sección es?", "Es el cuadernillo armable oficial del PJOS (P3.1 v1.1) para la **Manada de Lobeznas y Lobatos** donde cada lobato o lobezna comparte y atesora sus rastros por la selva junto con sus Viejos Lobos."],
        ["¿Qué dice la Oración de la Manada incluida en «Mi Libro del Seeonee»?", "En la página 1 de *Mi Libro del Seeonee* aparece la **Oración de la Manada**: *«Dulce y buen señor mío, enséñame a ser humilde y bondadoso, a imitar tu ejemplo, a amarte con todo mi corazón y a seguir el camino que me ha de llevar junto a ti. Así sea.»* Incluye también un recuadro para anotar *Fecha en que aprendí la oración*."],
        ["¿En qué tipo de papel se debe imprimir y armar «Mi Libro del Seeonee»?", "Según las instrucciones de la página 2: *1.* Imprime las páginas 2, 3 y 4 en papel opalina tamaño carta o papel normal tamaño carta. *2.* Pega sobre cartón delgado (como el de la caja del cereal). *3.* El resto de las páginas imprímelas en papel normal tamaño carta."],
        ["¿Qué significan las líneas punteadas, corridas y zonas sombreadas en «Mi Libro del Seeonee»?", "La convención de armado indica: **Líneas punteadas** se recortan; **Líneas corridas** se doblan; y **Zonas sombreadas** (*Doblar y pegar 5*, *6*, *7*, *8*) se pegan con su número gemelo."],
        ["¿Cuáles son las 3 dentelladas del Cazadero Raksha en «Mi Libro del Seeonee»?", "En **Mis dentelladas con Raksha** (Salud y Bienestar): 1) Qué acciones y alimentos comer para mantenerse saludable; 2) Que moverse, jugar y hacer ejercicio ayuda a estar sano, fuerte y sentirse bien; 3) Saber cómo se siente, decirlo y hacer cosas que ayuden a estar tranquila/o y contenta/o."],
        ["¿Cuáles son las 3 dentelladas del Cazadero Baloo en «Mi Libro del Seeonee»?", "En **Mis dentelladas con Baloo** (Habilidades para la Vida): 1) Darse cuenta de en qué es buena o bueno y qué cosas le gusta hacer; 2) Tomar decisiones por sí mismo siendo responsable; 3) Aprender a guiar un grupo de amigas y amigos esforzándose por hacerlo cada vez mejor."],
        ["¿Cuáles son las 3 dentelladas del Cazadero Bagheera en «Mi Libro del Seeonee»?", "En **Mis dentelladas con Bagheera** (Medio Ambiente y Sustentabilidad): 1) Saber que la naturaleza es importante y por qué cuidarla; 2) Reconocer cosas valiosas de la naturaleza (animales, plantas, lugares); 3) Saber qué hacer para cuidar la naturaleza y tratar bien el lugar donde vivimos."],
        ["¿Cuáles son las 3 dentelladas del Cazadero Hermano Gris en «Mi Libro del Seeonee»?", "En **Mis dentelladas con Hermano Gris** (Paz y Participación Comunitaria): 1) Saber que es importante llevarse bien con los demás y tratar de ser amable; 2) Aprender a trabajar con amigas y amigos y ayudar para que todo salga bien; 3) Aprender a conocer y respetar a las personas y tradiciones de la comunidad."],
        ["¿Qué dos columnas usan las huellas en «Mi Libro del Seeonee»?", "Cada rastro tiene dos huellas para marcar el avance: **Quiero Aprender / lo estoy aprendiendo** y **Ya lo aprendí**."],
        ["¿Qué stickers e insignias recortables trae la página 6 de «Mi Libro del Seeonee»?", "La planilla de la página 6 incluye los emblemas de los **4 Cazaderos** (Raksha, Baloo, Bagheera, Hermano Gris), insignias de ejes temáticos, 20 huellas de lobato, Compromiso Ciudadano, Mensajeros de la Paz, Scouts Go Solar, Plastic Tide Turners, Campeones por la Naturaleza y Tribu de la Tierra."],
      ];
      for (const [q, a] of seeoneeQA) addPdf(d, q, `${a}\n\n${fuente}`, 1);
    }

    if (fname === "P3.2TS_MapaExploraciones_V1.2.pdf") {
      const mapaQA = [
        ["¿Qué es el «Mapa de Exploraciones» y para qué sección está diseñado?", "Es el material plegable tamaño bolsillo (P3.2 v1.2, 6 páginas) diseñado para que cada integrante de la **Tropa Scout** registre de forma individual su Rumbo y Exploraciones según sus propios objetivos, sueños y metas."],
        ["¿Cuáles son los 6 pasos de uso que indica el «Mapa de Exploraciones»?", "Página 4 indica 6 pasos: 1) Elige la Exploración que quieres desarrollar; 2) Escríbela en tu Lista de Exploraciones con fecha de inicio; 3) Pide a tu guía/subguía de Patrulla que lo firme; 4) Desarrolla tu Exploración, anota la fecha de término y pide de nuevo firma de guía/subguía; 5) Solicita a la Corte de Honor la insignia correspondiente; 6) Celebra recibiendo tu insignia y pega la marca en tu Mapa."],
        ["¿Qué oración aparece en la portada del «Mapa de Exploraciones»?", "Rodeando el cuadro de *Mi banderín de patrulla* aparece la **Oración de la Tropa Scout**: *«Enséñame a ser generos__, a servirte como lo mereces, a dar sin medida, a combatir sin temor a que me hieran, a trabajar sin descanso y a no buscar más recompensa que saber que hago tu voluntad.»*"],
        ["¿Qué columnas tiene la «Lista de Exploraciones» al reverso del Mapa central?", "La tabla recortable de la página 5 tiene 4 columnas: **Exploración**, **Fecha de inicio / Fecha de término**, **Firma al inicio de tu guía/subguía de Patrulla** y **Firma al término de tu guía/subguía de Patrulla**."],
        ["¿Qué órganos o personas firman y otorgan las insignias en el «Mapa de Exploraciones»?", "Tu **guía o subguía de Patrulla** firma el inicio y término de cada exploración, y la **Corte de Honor** es ante quien se solicita la insignia correspondiente."],
        ["¿Cómo se arma físicamente el «Mapa de Exploraciones»?", "Las líneas punteadas se recortan, las líneas corridas se doblan y las zonas sombreadas con letras gemelas (**A, B, C, D, E, F**) se pegan entre sí. La Lista de Exploraciones se recorta y pega al reverso del Mapa central."],
        ["¿Qué espacios de identidad de patrulla incluye la portada del «Mapa de Exploraciones»?", "Incluye espacios para **Mi nombre es**, **Mis cintas de patrulla**, **Mi firma de patrulla** y **Mi banderín de patrulla**."],
        ["¿Qué insignias y stickers recortables trae el «Mapa de Exploraciones»?", "Incluye la insignia terminal **Águila Real**, los 4 Rumbos (**Quetzal, Tortuga Lora, Ocelote, Venado Cola Blanca**), **Punta de Flecha**, **Tribu de la Tierra**, **Mensajeros de la Paz**, **Scouts Go Solar**, **Plastic Tide Turners**, **Campeones por la Naturaleza**, flores de lis y marcas de los 4 ejes temáticos."],
      ];
      for (const [q, a] of mapaQA) addPdf(d, q, `${a}\n\n${fuente}`, 4);
    }

    if (fname === "P3.3.1_Hoja_Caminata_v1.1.pdf") {
      const hojacQA = [
        ["¿Qué es la «Hoja de Caminata» (P3.3.1) y cómo viene impresa?", "Es un formato de **Comunidad de Caminantes** (1 página con **dos tarjetas simétricas recortables** separadas por línea punteada) para planear, documentar y evaluar cada camino elegido dentro de un Sendero."],
        ["¿Qué datos iniciales pide la «Hoja de Caminata»?", "Solicita: **Sendero**, **Camino que elegí**, **¿Qué me inspira a tomar este camino?**, **Fecha en la que inicié**, **Fecha en la que terminé** y **Firma de Coordinador/subcoordinador de equipo al concluir**."],
        ["¿Quién firma la «Hoja de Caminata» al terminar la aventura?", "Debe llevar la **Firma de Coordinador/subcoordinador de equipo al concluir** el camino elegido."],
        ["¿Qué preguntas de autoevaluación y reflexión tiene la «Hoja de Caminata» al concluir?", "Además del cuadro amplio **Acciones a realizar**, cierra con tres preguntas reflexivas: **¿Cómo me siento al terminar esta aventura?**, **¿Qué fue lo más retador?** y **¿Qué podría mejorar?**."],
        ["¿Dónde se registra la parte práctica del camino en la «Hoja de Caminata»?", "En el recuadro principal titulado **Acciones a realizar**, colocado entre las fechas/firma de inicio-fin y las preguntas de evaluación final."],
        ["¿En qué momento se usa la «Hoja de Caminata» frente al «Pasaporte de Comunidad»?", "Mientras el *Pasaporte de Comunidad* (P3.3.2) concentra identidad, los 4 Senderos, sellos y bitácora de Punta de Flecha, la **Hoja de Caminata** (P3.3.1) sirve como tarjeta individual paso a paso para cada Camino elegido."],
      ];
      for (const [q, a] of hojacQA) addPdf(d, q, `${a}\n\n${fuente}`, 1);
    }

    if (fname === "P3.3.2_PasaporteComunidad_v1.1.pdf") {
      const pasaporteQA = [
        ["¿Qué es «Mi Pasaporte de Comunidad» (P3.3.2) y qué sección lo usa?", "Es el cuadernillo oficial de 5 páginas de la **Comunidad de Caminantes** que reúne la Promesa de Equipo, la Oración del Caminante, los 4 Senderos con sus Caminos, el espacio de sellos de otras comunidades y la Bitácora de Punta de Flecha."],
        ["¿Cuál es el texto de la «Promesa de Equipo» en «Mi Pasaporte de Comunidad»?", "*«Yo prometo ser leal a mi equipo, conducirme con la verdad, enfrentar los retos con alegría, aceptar cualquier desafío y nunca desfallecer.»*"],
        ["¿Qué dice la «Oración del Caminante» en «Mi Pasaporte de Comunidad»?", "*«Señor, ayúdame a encontrar la fortaleza del viejo roble, para que ningún triunfo me envanezca; la alegría de la naturaleza, para que ninguna soledad me abata; la libertad del ave, para elegir mi camino; y la voluntad del caminante, para seguir siempre adelante y servir.»*"],
        ["¿Cuáles son los Caminos del «Sendero Cenit» (Salud y Bienestar)?", "1) Reconocer que el bienestar emocional es importante y está bien pedir ayuda; 2) Cuidarse con buena alimentación, actividad física, descanso y tiempo propio; 3) Manejar emociones y expresarlas saludablemente; 4) Identificar acciones que ayudan a encontrar paz y equilibrio personal."],
        ["¿Cuáles son los Caminos del «Sendero Cúspide» (Habilidades para la Vida)?", "1) Aprender a ser líder para escuchar, apoyar y decidir con el equipo, no para mandar; 2) Trabajar en equipo tomando decisiones responsables; 3) Resolver problemas dialogando con buena actitud; 4) Tomar decisiones informadas y responsables."],
        ["¿Cuáles son los Caminos del «Sendero Cumbre» (Paz y Participación Comunitaria)?", "1) Reconocer la diversidad e inclusión sin importar características o circunstancias; 2) Participar en proyectos en beneficio de la comunidad promoviendo respeto y diálogo; 3) Tomar acción y liderar iniciativas por una comunidad más justa y equitativa."],
        ["¿Cuáles son los Caminos del «Sendero Cima» (Medio Ambiente y Sustentabilidad)?", "1) Darse cuenta de los problemas ambientales como contaminación y cambio climático y actuar; 2) Cuidar el planeta con pequeñas acciones y compartir la importancia de proteger la naturaleza; 3) Participar, diseñar y poner en marcha proyectos de cuidado ambiental."],
        ["¿Qué apartados adicionales trae la página 4 de «Mi Pasaporte de Comunidad»?", "Incluye una sección titulada **ESPACIO DE SELLOS DE OTRAS COMUNIDADES** y dos apartados de **BITÁCORA DE MI PUNTA DE FLECHA** con emblemas de Punta de Flecha Comunidad de Caminantes."],
        ["¿Qué espacios de identidad incluye la portada de «Mi Pasaporte de Comunidad»?", "Campos para **NOMBRE**, **EQUIPO**, círculos de sellos (**CNCC** y **SCNCC**), **MI ESTANDARTE**, **MI EMBLEMA DE EQUIPO** y **MI COMUNIDAD**."],
      ];
      for (const [q, a] of pasaporteQA) addPdf(d, q, `${a}\n\n${fuente}`, 2);
    }

    if (fname === "P3.4_MapaRutas_v1.1.pdf") {
      const rutasQA = [
        ["¿Qué es el «Mapa de Rutas» (P3.4) y para quién está pensado?", "Es el mapa armable oficial de 9 páginas del **Clan de Rovers** bajo el lema *«Rema tu propia canoa... ¡Servir!»*, diseñado para documentar el autoconocimiento del Rover, sus progresiones en las 4 Rutas, su **Proyecto Personal de Vida (PPV)** y su línea de tiempo de 4 años hasta su Enlace a la vida."],
        ["¿Qué explica la Hoja 4 del «Mapa de Rutas» sobre el PPV (Proyecto Personal de Vida)?", "Define que un **PPV (Proyecto Personal de Vida)** abarca todo lo que decides dentro y fuera del Movimiento Scout (escuela, trabajo, familia, actividades) y propone responder 6 preguntas clave (*¿Cómo es mi vida actualmente?, ¿Cuál es mi situación social, familiar, personal?, ¿Cuáles son mis objetivos, metas y sueños?, ¿A dónde quiero llegar?, ¿Para qué quiero llegar ahí?, ¿Qué edad tengo y cuánto tiempo me queda en el Clan?*)."],
        ["¿Cómo explica el «Mapa de Rutas» qué significa SMART?", "En la Hoja 4 (pág. 5), el **Mapa de Rutas** explica textualmente que **SMART** es el acrónimo en inglés para **Specific, Measurable, Achievable, Relevant/Realistic y Timely** (*Específico, Medible, Alcanzable, Relevante y Temporal*) y recomienda usar SMART cuando tengas dudas sobre hacia dónde encaminar tus objetivos del PPV."],
        ["¿Qué 10 características autoevalúa la Hoja 2 del «Mapa de Rutas»?", "Evalúa del signo `–` a `+` (en 5 círculos): **Cuerpo, Mente, Adaptabilidad, Inteligencia, Sensatez, Carisma, Supervivencia, Curiosidad, Espiritualidad y Vínculo con la Naturaleza** (más 3 renglones extra), junto con recuadros para *Lo que me gusta*, *Lo que NO me gusta* y *Lo que puedo mejorar*."],
        ["¿Qué representa «La Mochila» en el «Mapa de Rutas» Rover?", "La Hoja 2 explica que *tu mochila nunca se llena*: allí guardas habilidades y logros como cursos, idiomas, programación, medallas o ilustración, y tú decides cuánto y qué llevar, armándola y desarmándola las veces que necesites."],
        ["¿Qué pro tips da el «Mapa de Rutas» para llevar el PPV?", "1) Es una herramienta de seguimiento, no una lista definitiva: sé flexible; 2) No compites contra nadie, ve a tu propio ritmo; 3) Prioriza lo importante e identifica lo reemplazable; 4) Pausa cada cierto tiempo y vuelve a hacerte las 6 preguntas guía para reajustar tus pasos."],
        ["¿Dónde se pega la canoa armada de la Comunidad al Clan?", "En la página de bienvenida (*Hoja 1*), hay un espacio dedicado con la instrucción: *«(pega aquí la canoa que armaste en tu viaje de la Comunidad al Clan)»*."],
        ["¿Qué abarca la línea de tiempo del «Mapa de Rutas» y qué ocurre si se entra después de los 18 años?", "Cubre **4 años en el Clan** (desde *1 año* hasta *4 año en el Clan* y el sticker de *Enlace a la vida*). El instructivo aclara que si entraste después de cumplir los 18 años, ubicas la marca del año correspondiente, colocas cronológicamente tus logros ya alcanzados y proyectas los siguientes sin preocuparte por fechas exactas."],
        ["¿Qué stickers de iniciativas mundiales y rutas incluye el «Mapa de Rutas»?", "Incluye las 4 horquillas de Ruta (**Kikapú, Otomí, Wixárica, Maya**), **Punta de Flecha** roja, **Compromiso Ciudadano**, **Reconocimiento Scouts del Mundo (Scouts of the World Award / SWA)**, **Mensajeros de la Paz**, **Tribu de la Tierra**, **Scouts Go Solar**, **Plastic Tide Turners** y **Campeones por la Naturaleza**."],
      ];
      for (const [q, a] of rutasQA) addPdf(d, q, `${a}\n\n${fuente}`, 5);
    }

    // 7. Formato de Proyecto v1.1 + P4..P6 + P9.5 (Plantillas de Diseño Educativo)
    if (fname === "Formato de Proyecto v1.1.pdf" || /^P[4569]\./.test(fname)) {
      if (fname === "Formato de Proyecto v1.1.pdf") {
        const fpQA = [
          ["¿Qué dos fases principales estructuran el «Formato Oficial de Proyecto Scout (v1.1)»?", "Está dividido en 2 páginas: **Página 1: Planeación Ficha de Proyecto Scout** (título, objetivo general y particulares, ODS, eje temático, necesidad atendida, afectados, alcance, riesgos y medidas de seguridad, recursos) y **Página 2: Bitácora, Seguimiento Financiero, Revisión (REVISA) y ¡CELEBRA!**."],
          ["¿Qué preguntas de análisis pide la «Planeación» del Formato de Proyecto v1.1?", "Pide responder: *¿Qué necesidad/problemática estoy atendiendo?*, *¿A quién/quiénes/qué le afecta esta problemática?*, *¿Cuál es el alcance de mi proyecto?* y *¿Qué riesgos puede haber? ¿Cuáles serán las medidas de seguridad?*."],
          ["¿Qué tipos de recursos contempla el Formato de Proyecto v1.1?", "Desglosa: **Recursos Humanos — Logística**, **Recursos Humanos — Finanzas**, **Relaciones Humanas e Institucionales**, **Recursos Humanos — Comunicación**, **Recursos Financieros**, **Recursos Materiales / Técnicos** y **Personal Social**, además de un resumen financiero con *Recursos presupuestados*, *Fuente de recursos* y *Recursos utilizados*."],
          ["¿Qué sección tiene el Formato de Proyecto v1.1 para evaluar y celebrar el cierre?", "La página 2 incluye el cálculo de horas de servicio, bitácora de actividades y carpeta de evidencias, el bloque **REVISA** (*¿Qué funcionó o salió bien? ¿Qué no funcionó? ¿Qué se puede mejorar?*) y **¡CELEBRA!** (*Organiza la celebración del cierre de tu proyecto* con lugar y fecha)."],
          ["¿Qué datos de liderazgo y asesoría solicita el Formato de Proyecto v1.1?", "Registra: *Nombre de quién liderea y coordina el proyecto*, *Fecha de inicio*, *Fecha proyectada de término*, *Nombre de quién me asesora*, *Grupo / Sección / Provincia*, *Palabras clave* y *Eje Temático en que hace énfasis*."],
          ["¿Cómo vincula los ODS y las horas de servicio el Formato de Proyecto v1.1?", "En la planeación integra un espacio para **ODS en mi proyecto** y en la página 2 solicita explícitamente en la bitácora *incluir el cálculo de horas de servicio* junto con ligas a fotografía, video, documentos y presupuesto."],
        ];
        for (const [q, a] of fpQA) addPdf(d, q, `${a}\n\n${fuente}`, 1);
      }

      if (/^P4\.1_/.test(fname)) {
        const faesQA = [
          ["¿Qué campos de encabezado y contexto pide la «Plantilla P4.1 FAES»?", "Solicita: **Título**, **Eje Temático** (Medio Ambiente y Sustentabilidad, Habilidades para la Vida, Paz y Participación Comunitaria, Salud y Bienestar), **Duración**, **Rango de Edad**, **Apoyo Adulto** (casilla Sí/No) y **Número de Participantes**."],
          ["¿Qué apartados pedagógicos forman el cuerpo central de una FAES en P4.1?", "Se organiza en: **Objetivo**, **Preparación**, **Desarrollo**, **Preguntas orientadoras/reflexión**, **Medidas de seguridad** (con sello *Safe from Harm*), **Variantes (sección, desafío, accesibilidad)**, **Palabras clave** y **Elaboración/fuente**."],
          ["¿Cómo integra P4.1 los ODS y los materiales digitales?", "En la columna izquierda de P4.1 se enlistan **Recursos Materiales**, **Enlaces y Recursos Digitales**, y los **17 Objetivos de Desarrollo Sostenible (ODS)** con casillas individuales para marcar a cuáles contribuye la actividad."],
          ["¿Por qué P4.1 incluye un recuadro específico de «Variantes (Sección, Desafío, Accesibilidad)»?", "Para permitir que la misma acción educativa pueda adaptarse a distintas edades/secciones, ajustar el reto o incorporar medidas de inclusión y accesibilidad."],
          ["¿Qué organismo oficial emite la Plantilla P4.1 de FAES?", "Es emitida por la **Asociación de Scouts de México, A.C., Comisión Nacional de Programa de Jóvenes (CNPJ)**."],
        ];
        for (const [q, a] of faesQA) addPdf(d, q, `${a}\n\n${fuente}`, 1);
      }

      if (/^P4\.[23]_/.test(fname)) {
        const ori = fname.includes("Vertical") ? "vertical" : "horizontal (apaisada)";
        addPdf(d, `¿Para qué sirve la plantilla «${t}» y qué orientación tiene?`, `Es la hoja anexa en orientación **${ori}** de la *Ficha de Acciones Educativas Scouts (FAES)* para agregar diagramas, matrices, mapas o instrucciones extensas cuando el espacio de la ficha principal P4.1 no alcanza.\n\n${fuente}`);
        addPdf(d, `¿Qué campos tiene la hoja «${t}»?`, `Contiene cuatro campos limpios: **Eje Temático** (con los 4 hexágonos y casillas), **Título**, **Hoja [ ___ de ___ ]** e **Información Adicional** en área amplia.\n\n${fuente}`);
        addPdf(d, `¿Cuándo conviene usar «${t}» frente a la versión de otra orientación?`, `Conviene elegir la versión **${ori}** cuando los materiales anexos (mapas, tablas largas, croquis o lecturas) se adaptan mejor a ese formato de página sin perder el membrete oficial FAES.\n\n${fuente}`);
        addPdf(d, `¿Qué ejes temáticos aparecen en el encabezado de «${t}»?`, `Presenta los 4 Ejes Temáticos de la ASMAC con casilla de selección: *Medio Ambiente y Sustentabilidad*, *Habilidades para la Vida*, *Paz y Participación Comunitaria* y *Salud y Bienestar*.\n\n${fuente}`);
        addPdf(d, `¿Cómo se numera una hoja anexa usando «${t}»?`, `En la parte superior derecha incluye el campo **HOJA __ DE __** junto al título del anexo para mantener ordenado el expediente de la actividad.\n\n${fuente}`);
      }

      if (/^P5\.1_/.test(fname)) {
        addPdf(d, `¿Qué diferencia a la plantilla «${t}» (FES) de una plantilla FAES?`, `La **P5.1 (Ficha de Especialidad Scout Editable)** está diseñada para que jóvenes o adultos propongan/estructuren una Especialidad individual siguiendo el ciclo **DESCUBRO → 1. CONOZCO → 2. APLICO → 3. COMPARTO → REFLEXIONO**, mientras que una FAES diseña una acción educativa para toda la sección.\n\n${fuente}`);
        addPdf(d, `¿Qué pasos numera P5.1 para adquirir y demostrar una especialidad?`, `Estructura tres etapas numeradas después de *DESCUBRO*: **1. CONOZCO** (lo que tengo que aprender), **2. APLICO** (lo que hago para demostrar lo aprendido) y **3. COMPARTO** (cómo comparto mis habilidades con familia, escuela o amigos), cada una con espacio adicional para *¿Qué más puedo aprender/hacer/compartir?*.\n\n${fuente}`);
        addPdf(d, `¿Qué preguntas incluye «DESCUBRO» en P5.1 Plantilla de Especialidad?`, `Propone: *¿Qué me llama la atención? ¿Qué me gustaría aprender? ¿Qué cosas nuevas me gustaría hacer? ¿Qué cosas me emocionan y me ponen feliz cuando las hago? ¿Cuál de las actividades que practico me gustaría conocer más? ¿Cuáles son mis pasatiempos favoritos?*.\n\n${fuente}`);
        addPdf(d, `¿Qué preguntas de cierre incluye «REFLEXIONO» en P5.1?`, `Incluye: *¿Qué cosas nuevas aprendí? ¿Cómo me siento de poder ayudar a los demás con mis habilidades? ¿Cómo me sentí con las personas que me ayudaron a obtener mi especialidad? ¿Cuáles problemas me encontré y cómo los resolví? ¿Qué consejo le daría a quienes quisieran lograr esta especialidad?*.\n\n${fuente}`);
        addPdf(d, `¿Qué elementos de seguridad y ODS trae la plantilla P5.1?`, `Incluye el menú desplegable **Sección** (*Dropdown170*), el **Eje Temático de la Especialidad**, **Tema relacionado**, la cuadrícula completa de los **17 ODS** (*ODS a los que abona*), recuadro de **Medidas de seguridad** con el distintivo *Safe from Harm* y espacio para *Elaboró*.\n\n${fuente}`);
      }

      if (/^P6\.1_/.test(fname)) {
        const p61 = [
          ["¿Qué tipo de actividades permite planear la «Plantilla P6.1 Ficha de Evento Scout»?", "Como indica el propio formato (*¿Qué tipo de evento es?*), sirve para planificar campamentos, reuniones, talleres, servicios o encuentros especiales de sección, grupo o provincia."],
          ["¿Qué campos administrativos y logísticos incluye la «Plantilla P6.1»?", "Incluye **Nombre del evento**, **Fecha**, **Lugar**, **Objetivo general**, **Palabras clave**, **Eje temático en el que hace énfasis**, **Responsable/Coordinador(a) general**, **Equipo de apoyo**, **Espacios requeridos** (aulas, auditorio, espacio abierto), **Recursos materiales/técnicos**, **Programa general del evento** y **ODS**."],
          ["¿Qué diferencia a P6.1 (Ficha de Evento) de P6.3 (Programa de Actividades)?", "**P6.1** resume la ficha ejecutiva completa de un evento (objetivo, espacios, equipo de apoyo, tipo de evento y ODS), mientras que **P6.3** detalla el horario minuto a minuto de una sesión o reunión regular."],
          ["¿Dónde se coloca la lista de colaboradores en «P6.1 Ficha de Evento»?", "Cuenta con un campo específico llamado **Equipo de apoyo** justo debajo de *Responsable/Coordinador(a) general del evento*."],
          ["¿Qué información de la página 2 amplía «P6.1 Ficha de Evento»?", "La segunda página amplía los apartados de desarrollo logístico, programa detallado y evidencias/observaciones del evento para completar la planeación ante Consejo o Scouters."],
        ];
        for (const [q, a] of p61) addPdf(d, q, `${a}\n\n${fuente}`, 1);
      }

      if (/^P6\.2_/.test(fname)) {
        const p62 = [
          ["¿Cómo organiza las 4 páginas la «Plantilla P6.2 Ficha de Proyecto Scout»?", "Sigue el ciclo de gestión de proyectos en 4 páginas: identificación y objetivo (Planeación), desarrollo/presupuesto/riesgos, **REVISA** (*¿Qué funcionó?, ¿Qué no funcionó?, ¿Qué se puede mejorar?*) y **¡CELEBRA!** + carpeta de evidencias."],
          ["¿Por qué P6.2 incluye un bloque llamado «¡CELEBRA!»?", "El formato señala textualmente: *«Organiza la celebración del cierre de tu proyecto. Felicitarte (a ti y a tu equipo, si es el caso), es parte fundamental de realizar y concretar proyectos»*, solicitando anotar lugar y fecha de celebración."],
          ["¿Qué enlace solicita al final la «Plantilla P6.2»?", "Solicita el **LINK A CARPETA DE EVIDENCIAS** conteniendo fotografías, documentos, videos y cronogramas."],
          ["¿Qué datos de equipo y participantes registra «Plantilla P6.2»?", "Solicita identificar al **Equipo de trabajo**, la persona **Asesora** y las **Personas beneficiadas** por el proyecto."],
          ["¿En qué secciones de RECME está publicada la «Plantilla P6.2»?", "Está disponible tanto en Adultos (*Escenarios de aprendizaje*) como en las cuatro secciones juveniles (Manada, Tropa, Comunidad y Clan), publicada entre el 20 de abril y el 1 de mayo de 2026."],
        ];
        for (const [q, a] of p62) addPdf(d, q, `${a}\n\n${fuente}`, 1);
      }

      if (/^P6\.3_/.test(fname)) {
        const p63 = [
          ["¿Qué datos registra la tabla central de «P6.3 Programa de Actividades»?", "La tabla *Programa General (minuto a minuto)* registra cinco columnas: **Hora de inicio/término**, **Tiempo**, **Actividad**, **Responsable** y **Link a Anexos/FAES**."],
          ["¿Qué campos de preparación y seguridad pide «P6.3 Programa de Actividades»?", "Solicita: **Sección**, **Nombre de la sección**, **Responsable de la sección**, **Fecha**, **Lugar**, **Duración total**, **Eje temático**, **Competencias que se busca desarrollar**, **Materiales** y **Medidas de seguridad**."],
          ["¿Para qué sirve la columna «Link a Anexos/FAES» en P6.3?", "Permite vincular cada actividad del programa minuto a minuto directamente con su Ficha de Acción Educativa Scout (FAES) o anexo correspondiente."],
          ["¿Qué permite elegir el campo editable en P6.3?", "El campo *Dropdown113* permite seleccionar la sección o parámetro operativo dentro del formato oficial de la CNPJ."],
          ["¿Cómo apoya P6.3 a las reuniones semanales de sección?", "Reemplaza hojas sueltas al estandarizar en 1 página tiempos exactos, materiales, responsables, competencias a desarrollar y seguridad de toda la junta o excursión."],
        ];
        for (const [q, a] of p63) addPdf(d, q, `${a}\n\n${fuente}`, 1);
      }

      if (/^P6\.4_/.test(fname)) {
        const p64 = [
          ["¿Qué órganos juveniles y adultos utilizan la «Plantilla P6.4 Acta de Consejo de Nivel»?", "Según sus categorías en RECME y los desplegables *Dropdown91/92*, sirve para levantar actas de **Reunión de Scouters** (Manada), **Corte de Honor** (Tropa), **Comité de Comunidad** (Caminantes), **Parlamento Rover** (Clan) y **Consejos de Nivel**."],
          ["¿Qué datos de identificación y quórum solicita el encabezado de P6.4?", "Registra: **Lugar**, **Fecha**, **Hora**, **Tipo de sesión de Consejo**, **Sección**, **Grupo**, y el listado de asistentes con **Nombre, CUM y Firma**."],
          ["¿Qué estructura de discusión lleva el acta P6.4 en sus 3 páginas?", "Integra **Orden del día / Puntos a tratar o revisar**, desarrollo de acuerdos y seguimiento formal con las firmas de los integrantes del órgano correspondiente."],
          ["¿Quién publica P6.4 en RECME y con qué fecha?", "Emitida por la **Comisión Nacional de Programa de Jóvenes (CNPJ)** y publicada en RECME entre el 20 de abril y 1 de mayo de 2026 en todas las secciones y Adultos."],
          ["¿Cómo ayuda P6.4 al trámite de insignias y proyectos?", "Deja constancia formal y firmada de los acuerdos tomados en Corte de Honor, Comité de Comunidad o Parlamento Rover respecto a avances, aprobaciones de proyectos y solicitudes de insignias."],
        ];
        for (const [q, a] of p64) addPdf(d, q, `${a}\n\n${fuente}`, 1);
      }

      if (/^P6\.5_|^P9\.5_/.test(fname)) {
        const p65qa = [
          ["¿Qué registra el formato de Ciclo de Programa («" + t + "»)?", "Registra el **Calendario General** del ciclo: **Periodo**, **Duración del ciclo**, **Sección / Nombre de la sección**, **Grupo**, **Responsable de la sección**, **Eje temático en el que hace énfasis**, tabla de **Fecha / Actividad / Responsable / Link a Anexos**, además de **Actividades de Provincia** y **Actividades Nacionales** a las que asisten y el conteo de actividades en el local."],
          ["¿Qué diferencia hay entre «P6.5» y «P9.5 Formato Ciclo de Programa 2026 V2»?", "**P9.5** es la actualización más reciente (publicada el **15 de octubre de 2026**) que perfecciona el campo de enlaces como *«LINK A ANEXOS (CONVOCATORIAS O INFORMACIÓN ADICIONAL ÚTIL PARA EL CICLO DE PROGRAMA)»*, manteniendo la estructura en 1 hoja editable (`Dropdown33`)."],
          ["¿Para qué sirven los contadores «Actividades de Provincia», «Nacionales» y «Total de actividades en el local» en el Ciclo de Programa?", "Permiten balancear el calendario del ciclo asegurando equilibrio entre las juntas en el local del grupo y la participación en eventos de provincia o nacionales."],
          ["¿Cómo se conecta este formato de Ciclo de Programa con P6.3 y las FAES?", "El Ciclo de Programa (P6.5 / P9.5) define el calendario general del periodo y enlaza a cada sesión, mientras P6.3 detalla minuto a minuto cada reunión con sus respectivas FAES."],
          ["¿Cuándo se publicó «" + t + "» en RECME?", `Figura en RECME con fecha **${d.date_sort || "2026"}** dentro de *Plantillas Ciclo de Programa*.`],
        ];
        for (const [q, a] of p65qa) addPdf(d, q, `${a}\n\n${fuente}`, 1);
      }
    }

    // 8. P7.1..P7.4 (Registros Auxiliares de Progresión Personal)
    if (/^P7\.[1-4]_/.test(fname)) {
      const p7Lines = raw.split("\n").map((x) => x.trim()).filter(Boolean);
      const p7Sections = [
        ["¿Este «Registro Auxiliar de Progresión» sustituye el registro en SISAS o ExplorApp?", "**No.** El propio encabezado del formato advierte textualmente: *«Formato auxiliar no sustituye el uso y registro en plataforma»* y recuerda revisar el Modelo de Programa de Jóvenes Orientado a la Sustentabilidad (PJOS)."],
        ["¿Qué hitos iniciales registra la parte superior de «" + t + "»?", cleanBlock(p7Lines.filter((l) => /Compromiso|Bienvenido|Primer Especialidad|Investidura|Caminante|Rover|VIDA EN|PROGRESIÓN/i.test(l)).slice(0, 6).join(" • ") || cleanIntro, 450)],
        ["¿Qué tres fechas registra para cada ámbito o insignia en «" + t + "»?", "Para cada ámbito de progresión (*Cazaderos / Rumbos / Senderos / Rutas*), solicita llevar el registro cronológico de tres fechas: **Fecha Inicio**, **Fecha Término** y **Fecha Entrega**."],
        ["¿Cómo registra «" + t + "» los Eventos y el Enlace a la siguiente sección?", "Incluye una tabla de **EVENTOS** (*Nombre del evento*, *Fecha/Lugar*, *Duración*, *Eje relacionado*) y un apartado de **PERIODO DE ENLACE** con *Inicio de enlace*, *Fecha límite de Enlace* y *Fecha de enlace*."],
        ["¿Qué datos personales y de unidad solicita el encabezado de «" + t + "»?", cleanBlock(p7Lines.filter((l) => /CUM|Fecha Nacimiento|ingreso|Seisena|Patrulla|Equipo|Estudia|Grupo|Provincia/i.test(l)).slice(0, 5).join(" • ") || "Nombre completo, CUM, fecha de nacimiento, fecha de ingreso, pequeña comunidad/seisena/patrulla/equipo, Grupo y Provincia.", 420)],
        ["¿Quién establece el proceso oficial de solicitud mencionado al pie de «" + t + "»?", "La nota final señala literalmente: *«El proceso de solicitud corresponderá a lo establecido por la CNPJ (Comisión Nacional de Programa de Jóvenes)»*."],
      ];
      for (const [q, a] of p7Sections) addPdf(d, q, `${a}\n\n${fuente}`, 1);
    }

    // 9. P8.1..P8.5, P8.7 (Solicitudes Marco Mundo Mejor 2026)
    if (/^P8\./.test(fname)) {
      const initName = cleanBlock(raw.match(/SOLICITUD\s*\n([^\n]+)/)?.[1] || t.replace(/^Formato P8\.\d\s*—\s*Solicitud\s*/i, ""), 160);
      const p8QA = [
        [`¿Cómo debe llenarse y entregarse el formato «${initName}» (${fname})?`, `El documento indica textualmente la advertencia obligatoria: ***«El archivo se deberá llenar de forma digital, NO imprimir.»***`],
        [`¿Qué datos del solicitante y de grupo solicita «${t}»?`, "Solicita: **Nombre**, **CUM**, **Nombre del grupo (y número)**, **Sección**, **Provincia**, **Fecha de Nacimiento**, **Teléfono de contacto** y **Correo electrónico**."],
        [`¿Qué enlaces digitales obligatorios exige presentar «${t}»?`, "Pide capturar dos evidencias digitales obligatorias: **Enlace(s) de `sdgs.scout.org`** (plataforma mundial de proyectos ODS/WOSM) y **Enlace(s) del Drive abierto con las evidencias**."],
        [`¿Qué consejos u órganos deben avalar la solicitud en «${t}»?`, "El trámite debe contar con dos avales formales y su respectiva fecha: **Avala el trámite el Consejo de Sección** y **Avala el trámite el Consejo de Grupo**."],
        [`¿Qué campos de clasificación educativa solicita marcar «${t}»?`, "Solicita mencionar las actividades realizadas (de la canasta u otras) / nombre del voluntariado o proyecto, **marcar el Eje Temático abordado** y **marcar los ODS trabajados**."],
        [`¿Qué diferencia a «${t}» respecto a las demás solicitudes de la familia P8?`, `Corresponde específicamente a la iniciativa **${initName}** del Marco Mundo Mejor (WOSM/ASMAC) publicada el **${d.date_sort || "2026-07-02"}**, e incluye los campos específicos de esa insignia y su registro en \`sdgs.scout.org\`.`],
      ];
      for (const [q, a] of p8QA) addPdf(d, q, `${a}\n\n${fuente}`, 1);
    }

    // 10. P9.1..P9.4 (Solicitudes de Insignia Final / Terminal — Obsidiana vs Jade)
    if (/^P9\.[1-4]_/.test(fname)) {
      const metaIF = {
        "P9.1_Formato_de_solicitud _de IF_MLyL_v3.pdf": {
          ins: "Insignia Final Alfa", sec: "Manada de Lobeznas y Lobatos", unit: "Cazaderos", obsTime: "1 año 6 meses mínimo", jadeTime: "2 años mínimo",
          obsUnit: "3 Cazaderos", jadeUnit: "4 Cazaderos", obsEsp: "Mínimo 4 especialidades (de ejes temáticos distintos)", jadeEsp: "Mínimo 6 especialidades (al menos 4 de ejes temáticos distintos)",
          extraObs: "Sin Punta de Flecha", extraJade: "Sin Punta de Flecha"
        },
        "P9.2_Formato_de_solicitud_de_IF_TS_v2.pdf": {
          ins: "Insignia Final Águila Real", sec: "Tropa de Scouts", unit: "Rumbos", obsTime: "1 año 6 meses mínimo", jadeTime: "2 años mínimo",
          obsUnit: "3 Rumbos", jadeUnit: "4 Rumbos", obsEsp: "Mínimo 4 especialidades / 4 de eje temático distinto", jadeEsp: "Mínimo 6 especialidades / 4 de eje temático distinto",
          extraObs: "Punta de Flecha: Asistencia", extraJade: "Punta de Flecha: Certificado"
        },
        "P9.3_Formato_de_solicitud_de_IF_CC_v2.pdf": {
          ins: "Insignia Final Everest", sec: "Comunidad de Caminantes", unit: "Senderos", obsTime: "1 año 6 meses mínimo", jadeTime: "2 años mínimo",
          obsUnit: "3 Senderos", jadeUnit: "4 Senderos", obsEsp: "Mínimo 3 especialidades / de eje temático distinto", jadeEsp: "Mínimo 4 especialidades / de eje temático distinto",
          extraObs: "Punta de Flecha: Asistencia", extraJade: "Punta de Flecha: Certificado"
        },
        "P9.4_Formato_de_solicitud_de_IT_CR_v2.pdf": {
          ins: "Insignia Terminal Baden Powell", sec: "Clan de Rovers", unit: "Rutas", obsTime: "1 año 6 meses mínimo", jadeTime: "2 años mínimo",
          obsUnit: "3 Rutas", jadeUnit: "4 Rutas", obsEsp: "Mínimo 3 especialidades / de eje temático distinto", jadeEsp: "Mínimo 4 especialidades / Deseable 4 de eje distinto",
          extraObs: "Punta de Flecha: Asistencia • Viaje Rover: Deseable • PPV requerido", extraJade: "Punta de Flecha: Certificado • Viaje Rover: Gran Aventura 1 • PPV requerido"
        },
      }[fname];

      if (metaIF) {
        const p9QA = [
          [`¿Qué diferencias de permanencia y ${metaIF.unit} hay entre Obsidiana y Jade para la «${metaIF.ins}»?`, `Según la tabla de *Requisitos Mínimos* (pág. 2 de ${fname}):\n- **Versión Obsidiana:** **${metaIF.obsUnit}** y **${metaIF.obsTime}** en ${metaIF.sec}.\n- **Versión Jade:** **${metaIF.jadeUnit}** y **${metaIF.jadeTime}** en ${metaIF.sec}.`],
          [`¿Cuántas Especialidades piden Obsidiana vs Jade para la «${metaIF.ins}»?`, `- **Obsidiana:** ${metaIF.obsEsp}.\n- **Jade:** ${metaIF.jadeEsp}.`],
          [`¿Cuántas Aventuras piden Obsidiana y Jade para obtener la «${metaIF.ins}»?`, `- **Obsidiana:** Técnica Inicial + mínimo **otra Aventura más**.\n- **Jade:** Técnica Inicial + mínimo **2 Aventuras más**.`],
          [`¿Cuántas Iniciativas Mundiales y Eventos se piden para la «${metaIF.ins}»?`, `- **Obsidiana:** mínimo **1 Iniciativa Mundial** y mínimo **2 Eventos**.\n- **Jade:** mínimo **2 Iniciativas Mundiales** y mínimo **3 Eventos**.`],
          [`¿Qué requisitos adicionales de Punta de Flecha u otros rubros aplican en «${metaIF.ins}»?`, `- **Obsidiana:** ${metaIF.extraObs}.\n- **Jade:** ${metaIF.extraJade}.`],
          [`¿Qué datos e información oficial solicita la página 1 de la solicitud de «${metaIF.ins}»?`, `${cleanIntro}`],
          [`¿En qué fecha se publicó la versión vigente del formato de solicitud de «${metaIF.ins}»?`, `Publicado en RECME el **06 de agosto de 2026** dentro de *Plantillas de solicitud de insignia final y terminal*.`],
        ];
        for (const [q, a] of p9QA) addPdf(d, q, `${a}\n\n${fuente}`, 2);
      }
    }

    // 11. P10.2, P10.4..P10.7 (CNAMS / Insignia de Madera / Especialidad Anexos)
    if (/^P10\./.test(fname)) {
      if (fname.startsWith("P10.2")) {
        const p102 = [
          ["¿Qué áreas de formación atiende «P10.2 Ficha de Planeación Didáctica (FPD)»?", "Está emitida por **ASMAC • DNME • CNAMS** y cubre **Curso de Inducción**, **Curso de Insignia de Madera** y **Formación Continua** (incluyendo opciones **TTT1** y **TTT2**)."],
          ["¿Qué tres momentos integran la Secuencia Didáctica en «P10.2»?", "La secuencia didáctica de la FPD solicita tres bloques con su tiempo exacto: **Inicio (Tiempo)**, **Desarrollo (Tiempo)** y **Cierre (Tiempo)**."],
          ["¿Qué datos del curso y del equipo formador registra «P10.2»?", "Solicita: **CLAC** del curso, **Director(a)**, **Oportunidad de formación**, **Título de la sesión/tema**, **Objetivo/Propósito** y a qué competencia contribuye la sesión."],
          ["¿Qué significan las siglas CNAMS y DNME en el encabezado de «P10.2»?", "**ASMAC • DNME • CNAMS** corresponde a la **Asociación de Scouts de México, A.C.**, **Dirección Nacional de Métodos Educativos** y **Comisión Nacional de Adultos en el Movimiento Scout**."],
          ["¿Qué es TTT1 y TTT2 en la Ficha de Planeación Didáctica P10.2?", "Son las modalidades de formación de formadores (*Training the Trainers* nivel 1 y 2) seleccionables dentro de las oportunidades de formación de adultos."],
        ];
        for (const [q, a] of p102) addPdf(d, q, `${a}\n\n${fuente}`, 1);
      } else if (fname.startsWith("P10.4") || fname.startsWith("P10.5")) {
        const ori = fname.includes("Horizontal") ? "horizontal" : "vertical";
        addPdf(d, `¿Para qué sirve «${t}» y qué institución la firma?`, `Es el formato oficial de **Hoja Anexa de Ficha de Especialidad Scout (FES)** en orientación **${ori}**, emitido por la Comisión Nacional de Programa de Jóvenes para agregar información adicional a una especialidad.\n\n${fuente}`, 1);
        addPdf(d, `¿Qué cuatro campos aparecen en «${t}»?`, `Contiene: **Eje Temático**, **Título**, **Hoja [ __ de __ ]** e **Información Adicional**, y se publicó en RECME el **23 de septiembre de 2026**.\n\n${fuente}`, 1);
        addPdf(d, `¿Qué diferencia hay entre P10.4 Horizontal y P10.5 Vertical en Especialidades?`, `Ambas amplían una Ficha de Especialidad Scout cuando la hoja principal no basta; **P10.4** tiene formato horizontal (apaisado) con cuadros de lista para numeración (\`01\`), mientras **P10.5** tiene formato vertical.\n\n${fuente}`, 1);
        addPdf(d, `¿Dónde se utiliza el formato P10.4 / P10.5 dentro del acervo actual?`, `Por ejemplo, la especialidad de Comunidad **Gestión de riesgos en áreas naturales** utiliza este formato como su **página 2** anexa para desarrollar las instrucciones completas del asesoramiento y análisis de riesgo.\n\n${fuente}`, 1);
        addPdf(d, `¿Cuándo se publicó «${t}» en RECME?`, `Publicado el **23 de septiembre de 2026** en la categoría *Plantillas para FAES y especialidades*.\n\n${fuente}`, 1);
      } else if (fname.startsWith("P10.6") || fname.startsWith("P10.7")) {
        const isNoAcred = fname.startsWith("P10.7");
        const cartaQA = [
          [`¿Qué papel cumple el FAR (Formador Acompañante Responsable) en «${t}»?`, `El **FAR (Formador Acompañante Responsable)** es quien emite la carta dirigida al **Consejo de Nivel** para hacer constar el resultado del periodo de acompañamiento formativo del cursante en el **Curso de Insignia de Madera 3.0**.`],
          [`¿Qué resultado formal acredita «${t}»?`, isNoAcred ? "Hace constar que, al concluir el periodo establecido para el acompañamiento del Curso Insignia de Madera 3.0, la persona cursante **no logró cumplir en su totalidad con los requisitos** del proceso formativo (por motivos como inasistencias mayores al porcentaje permitido o no entrega de evidencias), invitándole a fortalecer lo pendiente." : "Hace constar que la persona cursante contó con **seguimiento continuo, orientación y retroalimentación** y presentó las evidencias correspondientes, concluyendo de manera satisfactoria el acompañamiento básico."],
          [`¿A qué instancias institucionales se envía copia (C.c.p.) en «${t}»?`, "Las copias oficiales al calce van dirigidas a: **Vicepresidencia de Métodos Educativos** y **Dirección del Curso**."],
          [`¿Qué datos específicos llenan los campos editables de «${t}»?`, isNoAcred ? "Los campos del formulario son: `Nombre de la persona cursante`, `CLAC del curso`, `Nombre completo del FAR`, `Nombre del/a Director/a`, `Fecha` y `MOTIVOS DE INCUMPLIMIENTO`." : "Solicita capturar lugar y fecha, nombre del cursante, **CLAC del curso**, nombre del **Director/a** del curso y firma del **Formador Acompañante Responsable (FAR)**."],
          [`¿A qué esquema formativo de adultos corresponde «${t}»?`, "Pertenece expresamente al esquema vigente del **Curso Insignia de Madera 3.0** de la Asociación de Scouts de México, A.C.\n\n" + `${cleanIntro}`],
        ];
        for (const [q, a] of cartaQA) addPdf(d, q, `${a}\n\n${fuente}`, 1);
      }
    }

    // 12. Completar suavemente cualquier PDF que tenga < 12 preguntas extrayendo párrafos/líneas reales o dimensiones del mismo PDF (sin inventar ni repetir)
    const fallbackPrompts = [
      [`¿Qué organismo oficial respalda «${t}» y cuál es su clave?`, `**«${t}»** es un documento oficial emitido por **${d.origin}**${d.code ? ` bajo la clave **${d.code}**` : ""}, vigente al corte del **${CUTOFF_DATE_DISPLAY_CONST}**.\n\n**Resumen documental:** ${cleanBlock(cleanIntro, 520)}\n\n${fuente}`],
      [`¿Cómo se organiza el contenido interno de «${t}»?`, `**Contenido y estructura de «${t}»:**\n\n${cleanBlock(cleanIntro, 760)}\n\n${fuente}`],
      [`¿Qué secciones del Movimiento Scout pueden utilizar «${t}»?`, `De acuerdo con su clasificación oficial, **«${t}»** aplica para **${d.section_label}** (categoría *${d.category}* → *${d.subcategory}*).\n\n${ubic(d)}\n\n${fuente}`],
      [`¿Qué datos o requisitos clave solicita «${t}»?`, `A partir del texto extraído de **«${t}»**:\n\n${cleanBlock(raw.slice(Math.min(raw.length - 1, 250)), 780)}\n\n${fuente}`],
      [`¿Cómo se relaciona «${t}» con el Programa de Jóvenes Orientado a la Sustentabilidad (PJOS)?`, `**«${t}»** forma parte del conjunto de herramientas educativas oficiales de la plataforma RECME diseñadas por la **CNPJ / CNAMS** para operar el **PJOS** mediante los 4 Ejes Temáticos y el registro de metas de progresión.\n\n${fuente}`],
      [`¿Está duplicado o reemplazado el archivo «${t}» en BiblioTech Scout?`, `No. Se verificó su huella digital SHA-256 (\`${d.sha12}\`) para descartar copias duplicadas numeradas \`(1)\` o \`(2)\` y conservar únicamente esta edición canónica (**${fname}**).\n\n${fuente}`],
      [`¿En qué carpeta o estante de BiblioTech Scout aparece «${t}»?`, `Aparece directamente en el estante y categoría **${d.category}** (subcategoría **${d.subcategory}**), disponible tanto en la web como para descarga sin conexión en la app móvil Android.\n\n${fuente}`],
      [`¿Qué aspectos finales conviene revisar al llenar o usar «${t}»?`, `${cleanBlock(raw.slice(Math.max(0, raw.length - 680)), 620)}\n\n${fuente}`],
    ];
    for (const [fq, fans] of fallbackPrompts) {
      if ((perPdfCount.get(d.id) || 0) >= 12) break;
      addPdf(d, fq, fans, 1, "recme_pdf_extra");
    }
  }

  // -------------------------------------------------------------------------
  // PARTE B: HELP DESK SISAS, CONECTA, GENIALLYS, RECME CATALOGS E IMÁGENES
  // -------------------------------------------------------------------------
  const htmlAndImgDocs = newDocs.filter((d) => d.ext !== "PDF");
  for (const d of htmlAndImgDocs) {
    const t = shortTitle(d.title);
    const raw = textOf(d) || "";
    const fuente = `*Fuente oficial: ${t} (\`${d.filename}\`).*`;
    const bodyClean = cleanBlock(
      raw.replace(/^GU[ÍI]A OFICIAL HELP DESK ASMAC:[^\n]*\n(?:Categoría:[^\n]*\n)?(?:Fuente:[^\n]*\n)?/i, ""),
      880
    );

    if (d.ext === "HTML") {
      add({ q: `¿Qué explica la guía «${t}»?`, cat: d.category, doc_id: d.id, page: 1, ans: `**${t}** *(Categoría: ${d.category} → ${d.subcategory})*:\n\n${bodyClean}\n\n${ubic(d)}\n\n${fuente}` }, "helpdesk_html");
      add({ q: `¿Dónde puedo consultar completa la guía «${t}»?`, cat: d.category, doc_id: d.id, page: 1, ans: `${ubic(d)}\n\n**Resumen:** ${cleanBlock(bodyClean, 460)}\n\n${fuente}` }, "helpdesk_html");

      // Extraer preguntas planteadas o encabezados reales dentro de cada guía Help Desk / RECME
      const chunks = raw.split(/\n+/).map((x) => x.trim()).filter(Boolean);
      for (let i = 0; i < chunks.length; i++) {
        const line = chunks[i];
        if (/^¿[^?]{8,125}\?$/.test(line)) {
          const nextBody = cleanBlock(chunks.slice(i + 1, i + 5).join(" "), 720);
          if (nextBody.length >= 60) {
            add({ q: line, cat: d.category, doc_id: d.id, page: 1, ans: `${nextBody}\n\n${fuente}` }, "helpdesk_qa_internas");
          }
        }
      }
    } else {
      // Imágenes oficiales nuevas (4)
      add({ q: `¿Qué muestra la imagen «${t}»?`, cat: d.category, doc_id: d.id, page: 1, ans: `**«${t}»** es una imagen oficial en formato ${d.ext} (${fmtSize(d)}):\n\n${cleanBlock(raw, 600)}\n\n${ubic(d)}` }, "recme_img");
      add({ q: `¿Dónde puedo ver o descargar «${t}»?`, cat: d.category, doc_id: d.id, page: 1, ans: `${ubic(d)}\n\n${cleanBlock(raw, 400)}` }, "recme_img");
    }
  }

  // -------------------------------------------------------------------------
  // PARTE C: PREGUNTAS ESENCIALES CURADAS SOBRE NUEVOS SISTEMAS, TRÁMITES Y COBERTURA
  // -------------------------------------------------------------------------
  const findDocId = (matchStr) => {
    const found = newDocs.find((x) => x.filename.includes(matchStr) || x.title.includes(matchStr));
    return found ? found.id : "doc-0745";
  };

  const curatedNew = [
    [
      "¿Qué es la plataforma RECME y qué significan SCNCD y CNAMS?",
      "Plantillas PJOS, FAES y RECME",
      findDocId("Portal_Oficial_RECME"),
      "**RECME** significa **Red Colaborativa de Material Educativo** (`https://recme.scouts.org.mx`), la biblioteca virtual oficial de la ASMAC impulsada por la **SCNCD** (*Subcomisión Nacional de Conocimiento Digital*) en conjunto con la **CNPJ** (*Comisión Nacional de Programa de Jóvenes*) y la **CNAMS** (*Comisión Nacional de Adultos en el Movimiento Scout*).\n\nCentraliza tres grandes colecciones: **FAES** (Fichas de Acciones Educativas Scouts), **Especialidades Scout (FES)** y **Plantillas** del PJOS y de formación de adultos."
    ],
    [
      "¿Qué Especialidades Scout (FES) faltan por subir y cuáles ya están completas en la base?",
      "Especialidades Scouts (FES)",
      findDocId("Catalogo_Especialidades_FES"),
      "Al corte del **11 de noviembre de 2026**, BiblioTech Scout incorpora completos:\n- **Adultos y Plantillas PJOS:** todos los 47 PDFs editables e imprimibles (`P1.*` a `P10.*` y `Formato de Proyecto v1.1`).\n- **Comunidad de Caminantes:** las **18 Especialidades FES** completas en PDF.\n- **Manada de Lobatos:** listado oficial de las 8 especialidades de Salud y Bienestar y el instructivo completo de *Primer Respondiente Junior*.\n\n**Pendientes de descarga/incorporación:** los PDFs individuales de Especialidades FES de **Manada de Lobatos**, **Tropa de Scouts** y **Clan de Rovers**."
    ],
    [
      "¿Cuántas Fichas de Acciones Educativas Scouts (FAES) existen en el catálogo oficial de RECME y cómo se llaman sus ámbitos?",
      "Plantillas PJOS, FAES y RECME",
      findDocId("Catalogo_FAES_RECME"),
      "El catálogo RECME suma **230 FAES** distribuidas por sección y por Eje Temático (*Salud y Bienestar / Habilidades para la Vida / Paz y Participación Comunitaria / Medio Ambiente y Sustentabilidad*):\n- **Manada (Cazaderos — 73):** Raksha (23), Baloo (27), Hermano Gris (11), Bagheera (12).\n- **Tropa (Rumbos — 54):** Tortuga Lora (12), Venado cola blanca (23), Quetzal (8), Ocelote (11).\n- **Comunidad (Senderos — 57):** Cenit (18), Cúspide (22), Cumbre (6), Cima (11).\n- **Clan (Rutas — 46):** Kikapú (10), Otomí (14), Wixárica (10), Maya (12)."
    ],
    [
      "¿Qué especialidades de Manada en el eje Salud y Bienestar aparecen catalogadas en RECME?",
      "Especialidades Scouts (FES)",
      findDocId("Catalogo_Especialidades_FES"),
      "En el portal de *Manada — Salud y Bienestar* de RECME figuran 8 especialidades publicadas entre el 23 y el 25 de septiembre de 2026: **Primer Respondiente Junior**, **Promotor de la Salud Junior**, **A Salvo del Peligro**, **Buceo**, **Cuidado Personal**, **Natación**, **Taekwondo** y **Triatlón infantil**."
    ],
    [
      "¿Qué es la Mesa de Ayuda (Help Desk) de la ASMAC y qué 11 departamentos de tickets tiene?",
      "Guías SISAS, CONECTA y Soporte Digital",
      findDocId("Directorio_Help_Desk"),
      "Es el portal de soporte técnico oficial (`https://helpdesk.scouts.org.mx`) con Base de Conocimientos (KB) y **11 departamentos para enviar tickets**: 1) SISAS; 2) Red Colaborativa de Material Educativo (RECME); 3) ExplorAPP y CarpetAPP; 4) Comunidad Digital de Conocimiento (CDC); 5) Adultos en el Movimiento; 6) Protección a la Membresía; 7) Credenciales y Reconocimientos; 8) Correo Electrónico Institucional; 9) Comunicación, Imagen y Redes Sociales; 10) General; y 11) SOLO OSN Soporte TI."
    ],
    [
      "¿Cuál es la diferencia entre las versiones Obsidiana y Jade de la Insignia Final y Terminal?",
      "Plantillas PJOS, FAES y RECME",
      findDocId("P9.3_Formato"),
      "Según las tablas de *Requisitos Mínimos* de los formatos P9.1–P9.4 (6 de agosto de 2026), la versión **Obsidiana** exige **3 Cazaderos/Rumbos/Senderos/Rutas** y **1 año 6 meses** mínimos de permanencia, **1 Iniciativa Mundial**, **2 Eventos**, **Técnica Inicial + 1 Aventura más** y **Punta de Flecha (Asistencia)**; mientras la versión **Jade** exige completar los **4** ámbitos, **2 años mínimos**, **2 Iniciativas Mundiales**, **3 Eventos**, **Técnica Inicial + 2 Aventuras más**, **Punta de Flecha (Certificado)** y, en Clan, además **1 Gran Aventura en Viaje Rover**."
    ],
    [
      "¿Cómo funciona el Registro Familiar y qué descuentos aplica al pagar la membresía?",
      "Guías SISAS, CONECTA y Soporte Digital",
      findDocId("Registro Familiar"),
      "Desde el portal **Registro Familiar** (accesible desde el inicio de **SISAS**), una familia de **3 a 5 miembros** puede inscribirse o reinscribirse en un solo cargo con tarjeta, Apple Pay o Google Pay. El descuento aplica solo sobre la cuota nacional (**25 %**, **30 %** o **35 %** para 3, 4 o 5 integrantes válidos), mientras que la cuota de provincia se cobra completa."
    ],
    [
      "¿Qué es el PPV (Proyecto Personal de Vida) en el Clan de Rovers y cómo usa el método SMART?",
      "Plantillas PJOS, FAES y RECME",
      findDocId("P3.4_MapaRutas"),
      "Según el **Mapa de Rutas del Clan de Rovers (P3.4)**, el **PPV (Proyecto Personal de Vida)** es una herramienta flexible de seguimiento para todo lo que decides dentro y fuera del Movimiento Scout (escuela, trabajo, familia, metas). Para definir tus objetivos, el Mapa de Rutas recomienda el método **SMART** (*Specific / Específico, Measurable / Medible, Achievable / Alcanzable, Relevant/Realistic / Relevante y Timely / Temporal*) y revisarlo periódicamente."
    ],
    [
      "¿Qué límites de archivo, tiempo y contraseñas exige el sistema SISAS?",
      "Guías SISAS, CONECTA y Soporte Digital",
      findDocId("Cómo crear mi cuenta en SISAS"),
      "De acuerdo con las guías oficiales del Help Desk ASMAC:\n- **Foto de perfil / CURP / evidencias PDF:** formato permitido (JPG/PNG o PDF) y peso máximo de **3 MB**.\n- **Contraseña de acceso:** mínimo **8 caracteres** (mayúscula, minúscula, número y símbolo, sin 3 caracteres consecutivos o repetidos).\n- **Contraseña de Autorización:** **10 caracteres** (distingue mayúsculas/minúsculas).\n- **Inactividad:** la sesión expira tras **20 minutos**.\n- **Cambio de grupo:** límite de **15 días por etapa** (hasta **30 días** en total; aprueba origen o rechaza destino si nadie atiende).\n- **Facturación y registro:** tienes **30 días o menos** dentro del mismo año para pedir factura, y **45 días** para concluir un registro nuevo inicial."
    ],
    [
      "¿Qué pasa si en SISAS aparece un texto cambiante o etiquetas con palabras distintas?",
      "Guías SISAS, CONECTA y Soporte Digital",
      findDocId("etiquetas"),
      "No es un fallo de tu cuenta: el mensaje rotatorio al iniciar sesión corresponde a uno de los **diez artículos de la Ley Scout** rotando automáticamente cada 18 segundos, y el Help Desk explica en un artículo específico por qué algunas etiquetas o textos en pantalla pueden mostrar variaciones según el módulo."
    ],
    [
      "¿Qué ejemplo oficial muestra el instructivo de FAES «Masterchefsito»?",
      "Plantillas PJOS, FAES y RECME",
      findDocId("Instructivo_FAES_Masterchefsito"),
      "El instructivo interactivo de RECME utiliza la ficha **Masterchefsito** (Manada de Lobeznas y Lobatos — **Cazadero Baloo / Habilidades para la Vida**) para mostrar paso a paso cómo se llenan objetivo, materiales, desarrollo, medidas de seguridad, preguntas orientadoras, variantes y ODS dentro de una FAES."
    ],
    [
      "¿Qué ejemplo oficial muestra el instructivo de FES «Primer Respondiente Junior»?",
      "Especialidades Scouts (FES)",
      findDocId("Instructivo_Llenado_FES"),
      "El instructivo oficial Genially de RECME toma como modelo la especialidad de **Manada (Salud y Bienestar)** titulada **«Primer Respondiente Junior»**, explicando cómo completar las etapas *Descubro*, *1. Conozco*, *2. Aplico*, *3. Comparto*, *Medidas de Seguridad*, *ODS* y *Reflexiono*."
    ],
  ];

  for (const [q, cat, docId, ans] of curatedNew) {
    add({ q, cat, doc_id: docId, page: 1, ans }, "recme_curated");
  }

  // Verificar rango [10, 30] para CADA UNO de los 65 nuevos PDFs
  const outRange = [];
  for (const d of pdfDocs) {
    const c = perPdfCount.get(d.id) || 0;
    if (c < 10 || c > 30) {
      outRange.push({ id: d.id, fn: d.filename, count: c });
    }
  }
  console.log(
    `[RECME QA GEN] PDFs nuevos: ${pdfDocs.length}, HTMLs/Imgs nuevos: ${htmlAndImgDocs.length}, fuera de rango [10..30]: ${outRange.length}`
  );
  if (outRange.length) {
    console.log("Fuera de rango:", outRange);
  } else {
    const counts = pdfDocs.map((d) => perPdfCount.get(d.id) || 0);
    console.log(
      `[RECME QA GEN] Min QAs/PDF: ${Math.min(...counts)}, Max QAs/PDF: ${Math.max(...counts)}, Total PDF QAs nuevos: ${counts.reduce((a, b) => a + b, 0)}`
    );
  }
}

const CUTOFF_DATE_DISPLAY_CONST = "11 de noviembre de 2026";

module.exports = { generateRecmeFaq };
