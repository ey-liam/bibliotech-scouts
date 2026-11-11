/* Generador del banco ampliado V4 de preguntas de BiblioTech Scout.
   Lee data/catalog.json, data/knowledge_base.json y data/text/*.txt y escribe data/faq_v4.json.
   Todas las respuestas se construyen con texto real de los documentos oficiales; no se inventa contenido.
   Uso: node scripts/generate_faq_v4.js */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));

const catalog = readJson("catalog.json").documents;
const kb = readJson("knowledge_base.json").topics;
const base = readJson("questions_bank.json").questions;
const v3 = readJson("faq_v3.json").questions;

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const seen = new Set();
for (const it of base.concat(v3)) seen.add(norm(it.q));
const out = [];
const stats = {};

function add(item, bucket) {
  const key = norm(item.q);
  if (!key || seen.has(key)) return false;
  if (!item.ans || clean(item.ans).length < 45) return false;
  if (/\[email\s*protected\]/i.test(item.ans)) return false;
  seen.add(key);
  out.push(item);
  stats[bucket] = (stats[bucket] || 0) + 1;
  return true;
}

const clean = (s) =>
  String(s || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u00ad]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const escRe = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function cutSentence(s, max) {
  s = clean(s);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const p = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "), cut.lastIndexOf(": "));
  if (p > max * 0.45) return cut.slice(0, p + 1).trim();
  const sp = cut.lastIndexOf(" ");
  return cut.slice(0, sp > 0 ? sp : max).trim() + "…";
}

function stripPdfHeaders(s) {
  return String(s || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u00ad]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/ASMAC\/[A-Z0-9\/._-]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ ,0-9]{0,75})?\s+\d{1,3}(?=\s|\n|$)/g, "\n")
    .replace(/(?:^|\n)\s*\d{1,3}\s+(?:Dirección Nacional de [^\n]+|Dirección Ejecutiva Nacional|Asociación de Scouts de México, A\.C\.|Corte Nacional de Honor)\b[^\n]*/g, "\n")
    .replace(/(?:^|\n)\s*(?:IV|II|III|V|VI|VII|VIII|IX|X+)\s+(?:Dirección [^\n]+|Asociación de Scouts[^\n]+|Corte Nacional de Honor)\b[^\n]*/g, "\n")
    .replace(/---\s*Página\s*\d+\s*---/g, "\n");
}

const byId = {};
const bySha = {};
for (const d of catalog) {
  byId[d.id] = d;
  bySha[d.sha12] = d;
}
const textOf = (d) => {
  const p = path.join(DATA, "text", d.sha12 + ".txt");
  return d && d.sha12 && fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
};

function shortTitle(t) {
  t = clean(t).replace(/\s[-–|]\s(Scouts de México|World Scouting|ASMAC|Scout Donation Platform)$/i, "");
  if (t.length > 130) {
    const cut = t.slice(0, 130);
    t = cut.slice(0, cut.lastIndexOf(" ")) + "…";
  }
  return t;
}

const ACRONYMS = new Set([
  "SISAS", "ASMAC", "WOSM", "OMMS", "PJOS", "ENPE", "SMART", "PER", "CNH",
  "CPRC", "CNRC", "DEN", "SFH", "AMS", "CUM", "EEAS", "ODS", "RFC", "CURP",
  "JL304", "RSM", "RSDM", "MSN", "WSJ", "JSN", "MXN", "UNESCO", "ONU", "CDMX",
  "PDF", "FAQ", "NNAJ", "CDC", "PPV", "REGNAL", "CNE", "DNME", "CNPJ", "CNA",
  "RNC", "RDC", "TLXH", "OSN", "INE", "IMSS", "SAT", "CONAPRED", "DIF",
]);

function normalizeQuestionCase(q) {
  q = clean(q);
  const letters = q.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  const upperRatio = letters.length ? letters.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length / letters.length : 0;
  if (upperRatio <= 0.52) return q;
  const tokens = q.split(/\s+/);
  const res = tokens.map((tok, idx) => {
    const m = tok.match(/^([¿«"“(\[]*)([A-Za-zÁÉÍÓÚÑáéíóúñ0-9-]+)([?.,;:»"”)\]]*)$/);
    if (!m) return idx === 0 ? tok : tok.toLowerCase();
    const [, pre, core, post] = m;
    const upperCore = core.toUpperCase();
    if (ACRONYMS.has(upperCore)) return pre + (upperCore === "RSDM" ? "RSdM" : upperCore) + post;
    let lower = core.toLowerCase();
    if (idx === 0) lower = lower.charAt(0).toUpperCase() + lower.slice(1);
    return pre + lower + post;
  });
  return res.join(" ");
}

/* ---------------------------------------------------------------- 1. Curado */
const topicById = {};
for (const t of kb) topicById[t.id] = t;

function topicAnswer(id, max = 1950) {
  const t = topicById[id];
  if (!t) return null;
  const c = String(t.content || "").trim();
  if (c.length <= max) return c;
  const cut = c.slice(0, max);
  const p = cut.lastIndexOf("\n\n");
  return (p > max * 0.5 ? cut.slice(0, p) : cut.slice(0, cut.lastIndexOf("\n"))).trim();
}
function T(id, cat, qs) {
  const ans = topicAnswer(id);
  if (!ans) {
    console.warn("Tema KB faltante:", id);
    return;
  }
  for (const q of qs) add({ q, cat, topic_id: id, doc_id: "", ans }, "curadas");
}

const BAS = "Basicas y Secciones";
T("que_son_los_scouts", BAS, [
  "¿Qué es el escultismo?", "¿Qué hace un scout?", "¿Para qué sirve el Movimiento Scout?",
  "¿Qué es la ASMAC?", "¿Qué es la WOSM?", "¿Cuál es la misión del Movimiento Scout?",
  "¿Quién puede ser scout?", "¿Qué significa ser scout?", "¿Cuál es el método educativo de los scouts?",
  "¿El Movimiento Scout es una escuela o un grupo juvenil?", "¿Qué valores promueven los scouts?",
  "¿Qué es la Organización Mundial del Movimiento Scout (OMMS)?", "¿Cómo ayuda el escultismo a los jóvenes?",
]);
T("como_iniciaron_los_scouts_historia", BAS, [
  "¿Quién fundó el Movimiento Scout?", "¿Cómo nació el escultismo?", "¿Quién fue Baden-Powell?",
  "¿Cuál es la historia de los scouts en México?", "¿Cuándo empezó el escultismo?",
  "¿Cuándo llegaron los scouts a México?", "¿Cuándo fue el primer campamento scout en el mundo?",
  "¿Por qué se celebra el Centenario Scout en México en 2026?",
]);
T("donde_encuentro_como_integrarme", BAS, [
  "¿Cómo me uno a los Scouts?", "¿Dónde encuentro un grupo scout cerca de mí?",
  "¿Cómo inscribo a mi hijo en los scouts?", "¿Cómo busco un grupo scout en mi ciudad?",
  "¿Qué necesito para inscribirme en un grupo scout?", "¿Qué hago en mi primer día de scout?",
  "¿Puedo ir a conocer un grupo scout antes de inscribirme?", "¿Cómo contacto a un grupo scout en México?",
]);
T("donde_compro_el_uniforme_tienda_scout", BAS, [
  "¿Dónde está la tienda scout?", "¿Dónde puedo comprar insignias y uniforme?",
  "¿Qué vende la tienda scout?", "¿La ASMAC tiene tienda scout en línea?",
  "¿Dónde compro mi pañoleta o manual scout oficial?",
]);
T("que_es_la_manada", "Manada de Lobatos", [
  "¿Qué es la Manada de Lobatos?", "¿De qué edades es la Manada?",
  "¿Qué hacen los lobatos?", "¿Cómo funciona la Manada?", "¿Qué es una seisena en la Manada?",
  "¿Por qué se usa El Libro de las Tierras Vírgenes en la Manada?", "¿Cuál es el lema de la Manada?",
  "¿Cómo es la Progresión en la Manada de Lobatos?",
]);
T("que_es_la_tropa", "Tropa de Scouts", [
  "¿Qué es la Tropa Scout?", "¿De qué edades es la Tropa?",
  "¿Qué hacen los scouts de la Tropa?", "¿Cómo funciona la Tropa?", "¿Qué es una patrulla scout?",
  "¿Qué es el Consejo de Roca o Corte de Honor en la Tropa?", "¿Cuál es el lema de la Tropa?",
  "¿Cómo funciona el sistema de patrullas en la Tropa?",
]);
T("que_es_la_comunidad_caminantes", "Comunidad de Caminantes", [
  "¿Qué es la Comunidad de Caminantes?", "¿De qué edades es la Comunidad?",
  "¿Qué hacen los caminantes?", "¿Cómo funciona la Comunidad de Caminantes?", "¿Qué es un equipo de caminantes?",
  "¿Qué proyectos hacen los caminantes?", "¿Cuál es el lema de los caminantes?",
]);
T("que_es_el_clan_rovers", "Clan de Rovers", [
  "¿Qué es el Clan de Rovers?", "¿De qué edades es el Clan?",
  "¿Qué hacen los rovers?", "¿Cómo funciona el Clan?", "¿Qué es un Proyecto Personal de Vida rover?",
  "¿Cuál es el lema del Clan de Rovers?", "¿Qué hacen los rovers antes de cumplir 22 años?",
]);
T("como_hago_mi_desarrollo_personal_progresion", "Progresion, Proyectos y PJOS", [
  "¿Cómo funciona la progresión personal?", "¿Qué son las etapas de progresión?",
  "¿Cómo avanzo de etapa en los scouts?", "¿Cómo registro mi progresión?",
  "¿Cómo me dan mi insignia de progresión?", "¿Quién evalúa mi progreso personal en la sección?",
]);
T("como_hago_un_proyecto_scout", "Progresion, Proyectos y PJOS", [
  "¿Cómo hago un proyecto scout?", "¿Cuáles son las fases de un proyecto scout?",
  "¿Cómo planeo un proyecto en la Comunidad de Caminantes?", "¿Cómo se evalúa un proyecto scout?",
  "¿Cuánto debe durar un proyecto scout?", "¿Cómo registro un proyecto de servicio scout?",
  "¿Cómo se documenta un proyecto scout al terminarlo?",
]);
T("que_son_los_ejes_tematicos", "Progresion, Proyectos y PJOS", [
  "¿Qué son los ejes temáticos?", "¿Cuáles son los 4 ejes temáticos?",
  "¿Qué ejes temáticos tiene el Programa de Jóvenes?", "¿Qué colores tienen los ejes temáticos?",
  "¿Qué iniciativas mundiales se vinculan con los ejes temáticos?", "¿Para qué sirven los ejes temáticos?",
  "¿A qué eje temático pertenece mi proyecto?", "¿Cómo se relacionan los ejes temáticos con el Marco Mundo Mejor?",
  "¿Qué insignias corresponden a los ejes temáticos?",
]);
T("especialidades_y_competencias_comunidad_y_secciones", "Progresion, Proyectos y PJOS", [
  "¿Qué son las especialidades scouts?", "¿Qué son las competencias scouts?",
  "¿Cómo obtengo una especialidad?", "¿Cuántas áreas tienen las especialidades scouts?",
  "¿Puedo obtener más de una especialidad scout?",
]);
T("explicacion_nuevo_esquema_pjos_2026", "Progresion, Proyectos y PJOS", [
  "¿Qué es el PJOS?", "¿Qué significa PJOS?", "¿Qué cambió con el nuevo Programa de Jóvenes?",
  "¿Qué diferencia hay entre el ENPE y el PJOS?", "¿Por qué se actualizó el Programa de Jóvenes?",
  "¿Cuáles son las novedades del PJOS frente al esquema anterior?",
]);
T("que_eventos_existen", BAS, [
  "¿Qué eventos scouts existen?", "¿Qué eventos nacionales hay para scouts?",
  "¿Qué eventos mundiales hay para scouts?", "¿A qué eventos puede asistir cada sección?",
  "¿Dónde me inscribo a un evento nacional scout?",
]);
T("falda_short_pantalon_uniforme", BAS, [
  "¿Las scouts pueden usar pantalón?", "¿Se puede usar short en el uniforme scout?",
  "¿El uniforme scout tiene falda?", "¿Es obligatorio usar falda en el uniforme femenino?",
]);
T("insignia_tribu_de_la_tierra", "Progresion, Proyectos y PJOS", [
  "¿Qué es la insignia Tribu de la Tierra?", "¿Cómo se obtiene la Tribu de la Tierra?",
  "¿Qué iniciativas integran la Tribu de la Tierra?",
]);
T("nudos_en_la_panoleta", "Promesa, Ley y Simbolos", [
  "¿Cuántos nudos lleva la pañoleta scout?", "¿Qué significan los nudos de la pañoleta?",
  "¿Cuándo se cambia de color o modelo de pañoleta?",
]);
T("que_es_el_eeas", "Progresion, Proyectos y PJOS", [
  "¿Qué es el EEAS?", "¿Para qué sirve el EEAS?",
]);
T("mensajeros_de_la_paz_e_iniciativas_mundiales", "Progresion, Proyectos y PJOS", [
  "¿Qué es Mensajeros de la Paz?", "¿Qué son las iniciativas mundiales de los scouts?",
  "¿Qué es el Marco Mundo Mejor?", "¿Qué insignias forman el Marco Mundo Mejor?",
]);
T("insignia_final_y_terminal", "Progresion, Proyectos y PJOS", [
  "¿Qué es la insignia final?", "¿Qué es la insignia terminal?",
  "¿Cuál es la máxima insignia de cada sección?", "¿Cómo se obtiene la insignia terminal en México?",
]);
T("puntas_de_flecha", "Progresion, Proyectos y PJOS", [
  "¿Qué son las puntas de flecha?", "¿Cómo se obtienen las puntas de flecha?",
  "¿Qué secciones toman el curso Punta de Flecha?",
]);
T("promesa_y_ley_scout", "Promesa, Ley y Simbolos", [
  "¿Cuál es la Promesa Scout?", "¿Cuál es la Ley Scout?", "¿Qué dice la Ley Scout?",
  "¿Qué es la Promesa y la Ley Scout?", "¿Cuál es la Promesa de la Manada?",
  "¿Cuántos artículos tiene la Ley Scout?",
]);
T("uniforme_2026", BAS, [
  "¿Cómo se usa el uniforme scout?", "¿Qué prendas tiene el uniforme scout?",
  "¿Cuál es el uniforme oficial 2026?", "¿Dónde van las insignias en la camisola scout?",
  "¿Para qué sirve el uniforme de trabajo scout?", "¿De qué color es la camisola de cada sección?",
  "¿Qué cambios trajo el Manual del Uniforme de junio 2026?",
]);
T("edades_secciones_sisas", BAS, [
  "¿De qué edades son las secciones scouts?", "¿A qué edad puedo entrar a los scouts?",
  "¿A qué sección pertenezco según mi edad?", "¿Qué pasa cuando cumplo 10, 14, 18 o 22 años en los scouts?",
  "¿Cómo aplica las edades el SISAS desde 2025?",
]);
T("cuotas_registro_2026", "Formatos, Actas y Seguro Scout", [
  "¿Cuánto cuesta el registro scout 2026?", "¿Cuál es la cuota anual scout?",
  "¿Cuánto se paga por reingreso y por nuevo ingreso?", "¿Cómo pago mi cuota de registro scout?",
  "¿Cuándo se renueva el registro anual en la ASMAC?",
]);
T("seguro_scout_salud", "Formatos, Actas y Seguro Scout", [
  "¿Qué cubre el seguro scout?", "¿Cómo uso el seguro scout?",
  "¿Qué hago si un scout se lesiona?", "¿Qué documentos pide el seguro scout por accidente?",
  "¿Cuál es el plazo para avisar de un accidente al seguro scout?",
]);
T("a_salvo_del_peligro_safe_from_harm", "Resolucion de Problemas y Reglas", [
  "¿Qué es A Salvo del Peligro?", "¿Qué es Safe from Harm?",
  "¿Cómo protegen los scouts a niñas, niños y jóvenes?", "¿El curso Safe from Harm es obligatorio para adultos?",
  "¿Dónde reporto una situación de riesgo en los scouts?",
]);
T("jamboree_internacional_wosm", BAS, [
  "¿Qué es el Jamboree Mundial?", "¿Qué es el World Scout Jamboree?",
  "¿Cada cuánto se hace un Jamboree Mundial?", "¿Dónde es el próximo World Scout Jamboree 2027?",
  "¿Quiénes pueden asistir a un Jamboree Mundial?",
]);
T("campo_escuela_meztitla", BAS, [
  "¿Qué es Meztitla?", "¿Dónde está el Campo Escuela Nacional?",
  "¿Cómo puedo visitar Meztitla con mi grupo scout?",
]);
T("cambios_ano_con_ano", BAS, [
  "¿Qué cambió este año en los scouts?", "¿Qué documentos oficiales cambiaron en 2026?",
  "¿Qué diferencia hay entre los lineamientos anteriores y los de 2026?",
]);
T("adultos_scouters_insignia_de_madera", BAS, [
  "¿Qué es la Insignia de Madera?", "¿Qué es un scouter?", "¿Cómo me formo como dirigente scout?",
  "¿Qué diferencia hay entre scouter y dirigente institucional?", "¿Los scouters reciben sueldo o son voluntarios?",
]);
T("que_es_un_grupo_scout_estructura", BAS, [
  "¿Qué es un grupo scout?", "¿Cómo se organiza un grupo scout?",
  "¿Qué es el Consejo de Grupo?", "¿Qué hace el Jefe de Grupo?",
  "¿Cuántas secciones necesita mínimo un grupo scout?",
]);
T("foros_de_jovenes_y_red_de_caminantes", "Comunidad de Caminantes", [
  "¿Qué son los Foros de Jóvenes?", "¿Qué es la Red de Caminantes?",
  "¿Quiénes pueden participar en los Foros de Jóvenes?",
]);
T("explorapp_y_carpetapp_sisas_cdc", BAS, [
  "¿Qué es el SISAS?", "¿Qué es ExplorApp?", "¿Qué es CarpetApp?",
  "¿Qué es el CDC de la ASMAC?", "¿Para qué sirve el SISAS?",
  "¿Dónde descargo mi credencial scout en el SISAS?", "¿Para qué sirve Scout Game en ExplorApp?",
  "¿Cómo inicio sesión en ExplorApp o CarpetApp?", "¿Qué es el CUM en el sistema SISAS?",
]);
T("flor_de_lis_sena_y_simbolos", "Promesa, Ley y Simbolos", [
  "¿Qué significa la flor de lis scout?", "¿Qué es la seña scout?",
  "¿Cuáles son los símbolos scouts?", "¿Cómo es el saludo scout?",
  "¿Con qué mano se da el saludo de mano izquierda en los scouts?",
]);
T("agentes_de_cambio_mx", "Comunidad de Caminantes", [
  "¿Qué es Agentes de Cambio.MX?", "¿Para qué sirve Agentes de Cambio?",
  "¿Quién puede participar en Agentes de Cambio?",
]);
T("corte_nacional_de_honor_y_conducta", "Resolucion de Problemas y Reglas", [
  "¿Qué es la Corte Nacional de Honor?", "¿Qué hace la Corte Nacional de Honor?",
  "¿Cómo se acude a la Corte Nacional de Honor?",
]);
T("campamentos_primeros_auxilios_y_emergencias", "Campismo, Nudos y Naturaleza", [
  "¿Qué hago en una emergencia durante un campamento?", "¿Qué debe llevar un botiquín scout?",
  "¿Qué son los Equipos Scouts de Emergencias?",
]);
T("coleccion_biblioteca_del_centenario", "Colección Biblioteca del Centenario", [
  "¿Qué es la Colección Biblioteca del Centenario?", "¿Qué libros incluye la Biblioteca del Centenario?",
]);
T("transicion_enpe_pjos_y_combinacion_insignias", "Progresion, Proyectos y PJOS", [
  "¿Qué es el ENPE?", "¿Se pueden combinar las insignias del ENPE con las del PJOS?",
]);
T("conteo_exacto_insignias_pjos_por_seccion", "Progresion, Proyectos y PJOS", [
  "¿Cuántas insignias hay por sección en el PJOS?",
]);
T("directorio_nacional_asmac_y_subcomisiones", BAS, [
  "¿Quiénes dirigen la ASMAC a nivel nacional?", "¿Qué son las subcomisiones de la ASMAC?",
  "¿Qué es la Dirección Ejecutiva Nacional?",
]);
T("presidentes_de_provincia_asmac", BAS, [
  "¿Quiénes son los Presidentes de Provincia de la ASMAC?", "¿Cómo contacto a la Provincia Scout de mi estado?",
]);
T("programas_servicios_y_beneficios_html_asmac", BAS, [
  "¿Qué programas y beneficios ofrece la ASMAC?", "¿Qué descuentos tiene un scout?",
]);
T("resolucion_de_problemas_y_conflictos", "Resolucion de Problemas y Reglas", [
  "¿Cómo se resuelven los conflictos en un grupo scout?", "¿Qué hago si hay un problema en mi grupo scout?",
]);
const LEY = [
  ["articulo_1_ley_scout_honor", "El scout cifra su honor en ser digno de confianza"],
  ["articulo_2_ley_scout_leal", "El scout es leal"],
  ["articulo_3_ley_scout_util", "El scout es útil y ayuda a los demás sin pensar en recompensa"],
  ["articulo_4_ley_scout_hermano", "El scout es amigo de todos y hermano de todo scout"],
  ["articulo_5_ley_scout_cortes", "El scout es cortés y actúa con nobleza"],
  ["articulo_6_ley_scout_naturaleza", "El scout ve en la naturaleza la obra de Dios"],
  ["articulo_7_ley_scout_orden", "El scout obedece con responsabilidad y hace las cosas en orden y completas"],
  ["articulo_8_ley_scout_sonrie", "El scout ríe y canta en sus dificultades"],
  ["articulo_9_ley_scout_economico", "El scout es económico, trabajador y cuidadoso del bien ajeno"],
  ["articulo_10_ley_scout_limpio", "El scout es limpio, sano y puro de pensamiento, palabras y acciones"],
];
LEY.forEach(([id, frase], i) =>
  T(id, "Promesa, Ley y Simbolos", [
    `¿Qué significa el artículo ${i + 1} de la Ley Scout?`,
    `¿Qué quiere decir «${frase}»?`,
    `¿Qué enseña el artículo ${i + 1} de la Ley Scout?`,
  ])
);
T("nudos_basicos_scouts_explicados", "Campismo, Nudos y Naturaleza", [
  "¿Cuáles son los nudos básicos scouts?", "¿Para qué sirven los nudos scouts?",
  "¿Cómo se hace el nudo as de guía?", "¿Para qué sirve el nudo ballestrinque y el rizo?",
  "¿Cómo se hace el nudo cuadrado o rizo?", "¿Para qué sirve el nudo margarita?",
]);
T("amarres_pionerismo_scout", "Campismo, Nudos y Naturaleza", [
  "¿Qué son los amarres scouts?", "¿Qué es el pionerismo scout?",
  "¿Qué diferencia hay entre el amarre cuadrado y el diagonal?",
]);
T("brujula_orientacion_y_pistas", "Campismo, Nudos y Naturaleza", [
  "¿Cómo se usa una brújula?", "¿Qué son las pistas scouts?",
]);
T("estatutos_2023_estructura_y_articulos", "Reglamentos, Estatutos y Políticas", [
  "¿Qué son los Estatutos de la ASMAC?", "¿Qué establecen los Estatutos 2023?",
]);
T("reglamento_2023_niveles_grupo_provincia_nacional", "Reglamentos, Estatutos y Políticas", [
  "¿Qué es el Reglamento de la ASMAC?", "¿Cuáles son los niveles de la ASMAC?",
  "¿Qué diferencia hay entre Grupo, Provincia y Nivel Nacional?",
]);
T("cnh_2025_condecoraciones_y_disciplina", "Reglamentos, Estatutos y Políticas", [
  "¿Qué son las condecoraciones scouts?", "¿Cómo funciona la disciplina en la ASMAC?",
]);
T("politica_a_salvo_del_peligro_sfh_bullying_acoso", "Resolucion de Problemas y Reglas", [
  "¿Qué hago ante un caso de bullying en el grupo scout?", "¿Qué hacer ante acoso o abuso dentro de los scouts?",
]);
T("manual_honores_a_la_bandera_y_escolta_scout", "Manuales Oficiales y de Operación", [
  "¿Cómo se rinden honores a la bandera?", "¿Qué es la escolta scout?",
]);
T("go_solar_plastic_tide_turners_champions_acciones_humanitarias", "Progresion, Proyectos y PJOS", [
  "¿Qué es Scouts Go Solar?", "¿Qué es Plastic Tide Turners?", "¿Qué es Champions for Nature?",
]);
T("de_foros_a_casa_y_redes_juveniles", "Comunidad de Caminantes", ["¿Qué es De Foros a Casa?"]);
T("guia_basica_padres_inscripcion_permisos_y_asistencia", BAS, [
  "¿Qué debo saber como papá o mamá de un scout?", "¿Qué permisos necesita mi hijo para un campamento?",
  "¿Cómo funciona la asistencia en un grupo scout?", "¿Qué es el formato JL304 o ficha médica?",
]);
T("sisas_explorapp_y_carpetapp_explicacion_completa", BAS, [
  "¿Cómo se conectan SISAS, ExplorApp y CarpetApp?", "¿Cuál es la diferencia entre SISAS, ExplorApp y CarpetApp?",
]);
T("centro_scout_campo_escuela_meztitla", BAS, [
  "¿Qué actividades se hacen en Meztitla?", "¿Cómo reservo en el Campo Escuela Meztitla?",
]);
T("jamboree_nacional_world_scout_jamboree_philia_y_moot", BAS, [
  "¿Qué es el Philia?", "¿Qué es el Moot?", "¿Qué es el Jamboree Nacional?",
]);
T("cprc_cnrc_foros_asesores_y_evaluacion_red_caminantes", "Comunidad de Caminantes", [
  "¿Qué es el CPRC?", "¿Qué es el CNRC?", "¿Cómo se elige al Asesor de la Red de Caminantes?",
]);
T("proyectos_caminantes_agentes_de_cambio_formatos_y_especialidades", "Comunidad de Caminantes", [
  "¿Dónde registro mi proyecto de Caminantes?", "¿Qué formatos necesito para un proyecto de Agentes de Cambio?",
]);

for (const t of kb) {
  if (!/^libro_centenario_doc_/.test(t.id)) continue;
  const titleClean = clean(t.title || "").replace(/^Libro del Centenario:\s*/i, "");
  if (!titleClean) continue;
  T(t.id, "Colección Biblioteca del Centenario", [
    `¿De qué trata el libro «${titleClean}» de la Biblioteca del Centenario?`,
    `¿Qué enseña el volumen «${titleClean}» del Centenario Scout?`,
  ]);
}

const ansSmart = `**SMART es una metodología para formular objetivos claros** al planear un proyecto o actividad scout. Es un acrónimo en inglés y cada letra describe una característica del objetivo (\`Las Rutas del Rover\`, págs. 72–74):

- **S — Específico (*Specific*):** claro e identificable; cualquiera que lo lea entiende cuál es la finalidad del proyecto.
- **M — Medible (*Measurable*):** tiene una referencia para conocer el impacto, por ejemplo fecha límite, número de participantes o beneficiarios, horas de servicio comunitario, alcance en redes, elementos recolectados o un cambio porcentual.
- **A — Alcanzable (*Achievable*):** posible con las capacidades actuales o con la planeación del equipo; no se trata de objetivos fáciles, sino reales dentro del contexto, los recursos y el tiempo.
- **R — Realista (*Realistic*):** acorde con los recursos y con el Ciclo de Programa. Algunas guías (como la \`Guía RSM 42\`) lo expresan como **Relevante**.
- **T — Tiempo limitado (*Time-bound*):** con un plazo definido.

**¿Cuándo se usa?** En la etapa de *planeación* del proyecto, junto con el ciclo **PER** (Planeo, Ejecuto, Reviso). En \`Las Rutas del Rover\` se recomienda acotar objetivos y alcance para que el proyecto pueda ejecutarse durante 2 o 3 Ciclos de Programa y evaluarse al final.`;
for (const q of [
  "¿Qué es un proyecto SMART?",
  "¿Qué significa SMART en los scouts?",
  "¿Qué es un objetivo SMART?",
  "¿Qué significan las letras de SMART?",
  "¿Qué es la metodología SMART?",
  "¿Para qué sirve la metodología SMART en un proyecto scout?",
  "¿Cómo se plantea un objetivo en un proyecto scout?",
  "¿Cómo hago objetivos SMART para mi proyecto de Caminantes?",
  "¿Cuáles son las características de un buen objetivo en un proyecto scout?",
  "¿Cómo se aplica SMART junto con el ciclo PER?",
])
  add({ q, cat: "Progresion, Proyectos y PJOS", topic_id: "como_hago_un_proyecto_scout", doc_id: "", ans: ansSmart }, "curadas");

const ansPer = `**PER significa Planeo, Ejecuto, Reviso** y es el ciclo con el que las secciones aplican el Método Scout cuando realizan proyectos y actividades (aparece en las guías de aplicación del Método Scout para Tropa y Clan, junto con los objetivos **SMART**).

1. **Planeo:** se piensa y organiza la actividad o proyecto; en este momento se definen los objetivos que se quieren alcanzar, y se sugiere plantearlos con la metodología **SMART**.
2. **Ejecuto:** se lleva a cabo; implica la logística previa, compras, montaje, entrega, recolección y toda acción necesaria para cumplir el fin.
3. **Reviso:** se evalúan los logros, los aprendizajes y las fallas, y se documenta el proyecto para compartirlo e inspirar a otros (\`Las Rutas del Rover\`, pág. 71).`;
for (const q of [
  "¿Qué es PER en los scouts?",
  "¿Qué significa Planeo, Ejecuto, Reviso?",
  "¿Qué significa PER en el Método Scout?",
  "¿Cómo se planea una actividad scout?",
  "¿Cuáles son las etapas de un proyecto en el Programa de Jóvenes?",
])
  add({ q, cat: "Progresion, Proyectos y PJOS", topic_id: "como_hago_un_proyecto_scout", doc_id: "", ans: ansPer }, "curadas");

const ejes = topicById["que_son_los_ejes_tematicos"];
if (ejes) {
  const lines = ejes.content.split("\n");
  const grab = (n) => {
    const i = lines.findIndex((l) => new RegExp("^\\s*" + n + "\\.\\s+\\*\\*").test(l));
    if (i < 0) return null;
    const buf = [lines[i].replace(/^\s*\d\.\s*/, "")];
    for (let j = i + 1; j < lines.length && !/^\s*\d\.\s+\*\*/.test(lines[j]) && lines[j].trim() !== ""; j++) buf.push(lines[j].trim());
    return buf.join(" ");
  };
  const defs = [
    [1, "Paz y Participación Comunitaria", ["¿Qué es el eje temático de Paz y Participación Comunitaria?", "¿De qué trata el eje de Paz y Acción Comunitaria?"]],
    [2, "Salud y Bienestar", ["¿Qué es el eje temático de Salud y Bienestar?", "¿Qué proyectos entran en el eje de Salud y Bienestar?"]],
    [3, "Habilidades para la Vida", ["¿Qué es el eje temático de Habilidades para la Vida?", "¿Qué proyectos entran en el eje de Habilidades para la Vida?"]],
    [4, "Medio Ambiente y Sustentabilidad", ["¿Qué es el eje temático de Medio Ambiente y Sustentabilidad?", "¿Qué proyectos entran en el eje de Medio Ambiente y Sustentabilidad?"]],
  ];
  for (const [n, name, qs] of defs) {
    const body = grab(n);
    if (!body) continue;
    const ans = `**Eje temático: ${name}** — uno de los 4 Ejes Temáticos del Programa de Jóvenes de la ASMAC.\n\n${body}\n\nLos otros ejes son: ${defs.filter((x) => x[0] !== n).map((x) => x[1]).join(", ")}.`;
    for (const q of qs) add({ q, cat: "Progresion, Proyectos y PJOS", topic_id: "que_son_los_ejes_tematicos", doc_id: "", ans }, "curadas");
  }
}

/* ------------------------------------------- 2. Artículos de normativas (SIN TOC ni refs cruzadas) */
const NORMAS = [
  ["doc-0431", "Reglamento 2023", "Reglamento de la ASMAC"],
  ["doc-0438", "Estatutos 2023", "Estatutos de la ASMAC"],
  ["doc-0128", "Manual del Uniforme 2026", "Manual del Uniforme (junio 2026)"],
  ["doc-0268", "Reglamento Interno CNH 2025", "Reglamento de la Corte Nacional de Honor"],
  ["doc-0437", "Manual Apertura y Cierre de Grupo 2023", "Manual de Apertura y Cierre de Grupo"],
  ["doc-0633", "Manual Honores a la Bandera", "Manual Scout de Honores a la Bandera Nacional"],
  ["doc-0529", "Declaración de Principios 2023", "Declaración de Principios"],
];

for (const [id, nombre, corto] of NORMAS) {
  const d = byId[id];
  if (!d) continue;
  const raw = textOf(d);
  if (!raw) continue;
  const cleanedPagesRaw = raw
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u00ad]/g, "")
    .replace(/ASMAC\/[A-Z0-9\/._-]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ ,0-9]{0,75})?\s+\d{1,3}(?=\s|$)/g, " ")
    .replace(/\b(?:[IVX]+\s+|\d{1,3}\s+)(?:Asociación de Scouts de México, A\.C\.|Dirección Nacional de [A-ZÁÉÍÓÚÑa-záéíóúñ ]+|Dirección Ejecutiva Nacional|Corte Nacional de Honor)\b/g, " ");

  const pMarks = [...cleanedPagesRaw.matchAll(/---\s*Página\s*(\d+)\s*---/g)];
  const pageBlocks = [];
  for (let i = 0; i < pMarks.length; i++) {
    const pNum = Number(pMarks[i][1]);
    const st = pMarks[i].index + pMarks[i][0].length;
    const en = i + 1 < pMarks.length ? pMarks[i + 1].index : cleanedPagesRaw.length;
    pageBlocks.push({ pNum, text: cleanedPagesRaw.slice(st, en) });
  }

  let full = "";
  const titles = {};
  const tocRe = /Art[íi]culo\s+(\d+(?:\.\d+)?)\.\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9 ,.“”"()/-]{3,95}?)\s+(\d{1,3})(?=\s)/g;

  for (const pb of pageBlocks) {
    const line = clean(pb.text);
    let m;
    tocRe.lastIndex = 0;
    while ((m = tocRe.exec(line))) {
      if (!titles[m[1]]) titles[m[1]] = clean(m[2]);
    }
    const tocHits = (line.match(/Art[íi]culo\s+\d+(?:\.\d+)?\.[^.]{3,85}\s+\d{1,3}\b/g) || []).length;
    const looksLikeToc =
      pb.pNum <= 10 &&
      (tocHits >= 3 ||
        /\b[ÍI]NDICE\b/.test(line) ||
        (pb.pNum <= 8 && (line.match(/\s\d{1,3}\s+[A-ZÁÉÍÓÚÑ]/g) || []).length >= 6));
    if (looksLikeToc) continue;
    full += ` ⟦P${pb.pNum}⟧ ` + line;
  }

  const artRe = /\bArt[íi]culo\s+(\d+(?:\.\d+)?(?:\s*[“"]?BIS[”"]?)?)(?:\.|\s+(?=[A-ZÁÉÍÓÚÑ¿¡"“]))/gi;
  const hits = [];
  let m;
  while ((m = artRe.exec(full))) {
    const before = full.slice(Math.max(0, m.index - 35), m.index);
    if (/(?:\b(?:al|del|el|los|las|un|en|por|de|con|según|y|o|,|;)\s+)$/i.test(before)) continue;
    const after = full.slice(m.index + m[0].length, m.index + m[0].length + 140);
    if (/^(?:de(?:l)?\s+(?:este|la|presente|Reglamento|Estatuto|Manual)|bis\s+de)/i.test(after.trim())) continue;
    hits.push({ n: clean(m[1]), i: m.index });
  }

  const seenN = new Set();
  const bodyHits = [];
  for (const h of hits) {
    if (seenN.has(h.n)) continue;
    seenN.add(h.n);
    bodyHits.push(h);
  }

  for (let k = 0; k < bodyHits.length; k++) {
    const { n, i } = bodyHits[k];
    const end = k + 1 < bodyHits.length ? bodyHits[k + 1].i : i + 2500;
    let body = full.slice(i, Math.min(end, i + 3200)).replace(/⟦P\d+⟧/g, "");
    body = body.replace(/^Art[íi]culo\s+\d+(?:\.\d+)?(?:\s*[“"]?BIS[”"]?)?[.:]?\s*/i, "").trim();
    const title = titles[n] || "";
    if (title) {
      const mTitle = body.match(new RegExp(`^${escRe(title)}(?=\\s|[.:]|$)`, "i"));
      if (mTitle) body = body.slice(mTitle[0].length).trim();
    }
    body = clean(body).replace(/^(?:[.:-]+\s+)/, "");
    if (body.length < 100) continue;
    if (/^\d{1,3}\s+(?:Art[íi]culo|SECCI[ÓO]N|CAP[ÍI]TULO)/i.test(body)) continue;

    const pm = full.slice(0, i).match(/⟦P(\d+)⟧(?!.*⟦P)/);
    const page = pm ? Number(pm[1]) : 1;
    const resumenArt = cutSentence(body, 1000);
    const heading = title ? `Artículo ${n}. ${title}` : `Artículo ${n}`;
    const ans = `**${corto}, ${heading}** (\`${nombre}\`, pág. ${page}):\n\n${resumenArt}\n\n*Fuente oficial: ${shortTitle(d.title)}.*`;
    const baseItem = { cat: d.category, doc_id: d.id, page };
    if (title && !/^glosario$/i.test(title)) {
      add({ ...baseItem, q: `¿Qué establece el Artículo ${n} del ${corto} (${title})?`, ans }, "articulos");
      add({ ...baseItem, q: `¿Qué dice el ${corto} sobre «${title}»?`, ans }, "articulos");
    } else if (!/^glosario$/i.test(title)) {
      add({ ...baseItem, q: `¿Qué establece el Artículo ${n} del ${corto}?`, ans }, "articulos");
      add({ ...baseItem, q: `¿Qué dispone el ${corto} en su Artículo ${n}?`, ans }, "articulos");
    }
  }
}

/* ------------------------------------------- 3. Glosarios oficiales (todos los formatos) */
const GLOS_DOCS = [
  ["doc-0431", "Reglamento 2023 (Art. 2)", "Reglamento de la ASMAC"],
  ["doc-0256", "Política Nacional del Programa de Jóvenes 2025", "Política Nacional del Programa de Jóvenes"],
  ["doc-0272", "Política de Diversidad, Equidad e Inclusión 2024", "Política de Diversidad, Equidad e Inclusión"],
  ["doc-0273", "Política Nacional AMS 2024", "Política Nacional AMS"],
  ["doc-0224", "Política Nacional de Niñeces, Adolescencias y Juventudes", "Política Nacional NNAJ"],
  ["doc-0232", "Modelo de Formación 2025", "Modelo de Formación 2025"],
  ["doc-0254", "Modelo de Gestión de Adultos 2025", "Modelo de Gestión de Adultos"],
  ["doc-0595", "Manual Operativo para los Centros de Acopio", "Manual Operativo para los Centros de Acopio"],
  ["doc-0633", "Manual Scout de Honores a la Bandera Nacional", "Manual Scout de Honores a la Bandera"],
  ["doc-0470", "Guía Formador en línea", "Guía Formador en línea"],
  ["doc-0582", "Manual de Redes Sociales", "Manual de Redes Sociales"],
  ["doc-0599", "Plan Nacional para el Crecimiento", "Plan Nacional para el Crecimiento"],
];

const seenGlosTerm = new Set();
const BAD_GLOS_TERM = /^(Para fines|Nota|Definiciones|Glosario|El siguiente|La presente|En caso de|Se considera|Artículo|CAPÍTULO|BIBLIOGRAFÍA|Fuente)/i;

for (const [id, nombre, corto] of GLOS_DOCS) {
  const d = byId[id];
  if (!d) continue;
  const raw = textOf(d);
  if (!raw) continue;
  const cleanedRaw = raw
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u00ad]/g, "")
    .replace(/\r\n/g, "\n");
  const gMatches = [...cleanedRaw.matchAll(/(?:Artículo\s+2\.\s+Glosario|GLOSARIO(?:\s+DE\s+T[ÉE]RMINOS)?)/gi)];
  let bestStart = -1;
  for (const gm of gMatches) {
    const ahead = cleanedRaw.slice(gm.index, gm.index + 80).trim();
    if (/^GLOSARIO\s+\d{1,3}\b/.test(ahead)) continue;
    bestStart = gm.index;
  }
  if (bestStart < 0) continue;

  const pmStart = cleanedRaw.slice(0, bestStart).match(/---\s*Página\s*(\d+)\s*---(?!.*---\s*Página)/);
  const page = pmStart ? Number(pmStart[1]) : 1;

  let slice = cleanedRaw.slice(bestStart, bestStart + 32000);
  const cutEnd = slice.slice(250).search(/\n(?:BIBLIOGRAF[ÍI]A|REFERENCIAS|ANEXOS?|CAP[ÍI]TULO\s+11|Art[íi]culo\s+3\.)\b/i);
  if (cutEnd > 0) slice = slice.slice(0, 250 + cutEnd);

  slice = stripPdfHeaders(slice)
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(?:Artículo\s+2\.\s+Glosario|GLOSARIO(?:\s+DE\s+T[ÉE]RMINOS)?)\s*(?:CAP[ÍI]TULO\s+\d+)?\s*(?:Para [^.:]+[:.])?\s*/i, "")
    .trim();

  const entries = [];
  if (/•/.test(slice)) {
    const reA = /•\s*([A-ZÁÉÍÓÚÑ][^.:•]{2,65}?)[.:]\s+([^•]{40,750}?)(?=\s*•|\s*$)/g;
    let m;
    while ((m = reA.exec(slice))) entries.push([clean(m[1]), clean(m[2])]);
  }
  const reB = /(?:^|\.\s+)([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ0-9/(),."' -]{2,62}?):\s+([A-ZÁÉÍÓÚÑa-záéíóúñ][^•]{45,650}?\.)(?=\s+[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ0-9/(),."' -]{2,62}?:|\s*$)/g;
  let m;
  while ((m = reB.exec(slice))) entries.push([clean(m[1]), clean(m[2])]);

  const reC = /(?:^|\.\s+)([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ0-9/()"-]*(?:\s+(?:[A-ZÁÉÍÓÚÑa-záéíóúñ0-9/()"-]+)){0,6})\.\s+([A-ZÁÉÍÓÚÑ][^.]{40,420}\.(?:\s+[A-ZÁÉÍÓÚÑ][^.]{20,260}\.)*)/g;
  while ((m = reC.exec(slice))) {
    const t = clean(m[1]);
    const def = clean(m[2]);
    if (t.length < 3 || t.length > 62 || /[,]/.test(t) || /\b(son|están|deben|puede|pueden|será|implica|durante|mediante)\b/i.test(t)) continue;
    entries.push([t, def]);
  }

  for (const [termRaw, defRaw] of entries) {
    const term = termRaw.replace(/^(?:DE LA|DEL)\s+/i, "").trim();
    if (!term || BAD_GLOS_TERM.test(term)) continue;
    const def = cutSentence(defRaw, 650);
    if (def.length < 45) continue;
    const tk = norm(term);
    if (!tk || seenGlosTerm.has(tk)) continue;
    seenGlosTerm.add(tk);
    const ans = `**${term}** *(Glosario de \`${nombre}\`)*:\n\n${def}\n\n*Fuente oficial: ${shortTitle(d.title)}.*`;
    add({ q: `¿Qué significa «${term}» según el ${corto}?`, cat: d.category, doc_id: d.id, page, ans }, "glosario");
    add({ q: `¿Cómo se define «${term}» en los documentos scouts?`, cat: d.category, doc_id: d.id, page, ans }, "glosario");
  }
}

/* ------------------------------------------- 4. Capítulos reales de Manuales, Políticas y Guías */
const CHAP_DOCS = [
  "doc-0102", "doc-0103", "doc-0256", "doc-0272", "doc-0273", "doc-0274",
  "doc-0225", "doc-0224", "doc-0232", "doc-0254", "doc-0255", "doc-0633",
  "doc-0406", "doc-0407", "doc-0408", "doc-0409", "doc-0410", "doc-0411",
  "doc-0412", "doc-0405", "doc-0556", "doc-0576", "doc-0599", "doc-0616",
  "doc-0623", "doc-0508", "doc-0582", "doc-0487", "doc-0594", "doc-0598",
  "doc-0481", "doc-0471", "doc-0472", "doc-0612", "doc-0539", "doc-0540",
  "doc-0239", "doc-0252", "doc-0253", "doc-0129", "doc-0130",
];
for (const id of CHAP_DOCS) {
  const d = byId[id];
  if (!d) continue;
  const raw = textOf(d);
  if (!raw) continue;
  const tDoc = shortTitle(d.title);
  const rawClean = raw
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u00ad]/g, "")
    .replace(/---\s*Página\s*(\d+)\s*---/g, " ⟦P$1⟧ ")
    .replace(/\s+/g, " ");

  const re = /(?:CAP[ÍI]TULO\s+(0?\d+|[IVX]+)\s+([A-ZÁÉÍÓÚÑ0-9 ,./()-]{4,60}?)|([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 ,./()-]{3,55}?)\s+CAP[ÍI]TULO\s+(0?\d+|[IVX]+))\s+(?=[A-ZÁÉÍÓÚÑa-záéíóúñ¿])/g;
  const seenCap = new Set();
  let m;
  while ((m = re.exec(rawClean))) {
    const capNum = clean(m[1] || m[4]);
    let capTitle = clean(m[2] || m[3]);
    capTitle = capTitle.replace(/^(?:Dirección Nacional[^A-Z]*|ASMAC\/\S+\s+)/i, "").trim();
    if (!capTitle || capTitle.length < 4 || /^\d+$/.test(capTitle)) continue;
    if (/^(ÍNDICE|GLOSARIO|BIBLIOGRAFÍA|REFERENCIAS|CAPÍTULO|PRINCIPAL)$/i.test(capTitle)) continue;
    if (/CAP[ÍI]TULO/.test(capTitle)) continue;

    let after = rawClean.slice(m.index + m[0].length, m.index + m[0].length + 1400).replace(/⟦P\d+⟧/g, "");
    after = after.replace(/^(?:\d+\s+|Dirección Nacional de [^.]+\s*|Dirección Ejecutiva Nacional\s*)+/i, "").trim();
    if (/^\d{1,3}\s+(?:[A-ZÁÉÍÓÚÑ]|CAP[ÍI]TULO)/i.test(after)) continue;
    if (/CAP[ÍI]TULO\s+\d+/.test(after.slice(0, 80))) continue;
    const body = cutSentence(after, 720);
    if (body.length < 150 || (body.match(/\d/g) || []).length / body.length > 0.16) continue;

    const key = `${capNum}:${norm(capTitle)}`;
    if (seenCap.has(key)) continue;
    seenCap.add(key);

    const pm = rawClean.slice(0, m.index).match(/⟦P(\d+)⟧(?!.*⟦P)/);
    const page = pm ? Number(pm[1]) : 1;
    const capHuman = capTitle.toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
    const ans = `**«${tDoc}» — Capítulo ${capNum}: ${capHuman}** (pág. ${page}):\n\n${body}\n\n*Fuente oficial: ${tDoc}.*`;
    add({ q: `¿Qué explica «${tDoc}» en el tema «${capHuman}»?`, cat: d.category, doc_id: d.id, page, ans }, "capitulos");
  }
}

/* ------------------------------------------- 5. Documentos, Páginas, Imágenes + Extractos múltiples */
const TIPO = {
  PDF: "documento PDF",
  DOCX: "documento de Word",
  XLSX: "hoja de cálculo",
  PPTX: "presentación",
  HTML: "página web oficial",
  PNG: "imagen",
  JPG: "imagen",
  JPEG: "imagen",
  WEBP: "imagen",
  AVIF: "imagen",
};
const IMG = new Set(["PNG", "JPG", "JPEG", "WEBP", "AVIF"]);

function resumen(d) {
  const s = clean(d.full_excerpt || d.summary || "").replace(/\.\.\.$/, "");
  return cutSentence(s, 450);
}
function ubic(d) {
  return `En BiblioTech Scout abre **Biblioteca**, busca «${shortTitle(d.title)}» en el buscador de documentos o filtra por la categoría *${d.category}*, y pulsa **Leer** para verlo o **Descargar** para guardarlo.`;
}
function fmtSize(d) {
  return d.size_mb >= 1 ? `${d.size_mb} MB` : `${Math.round(d.size_kb)} KB`;
}

function extractCleanBodyPages(d) {
  const raw = textOf(d);
  if (!raw) return "";
  const cleaned = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u00ad]/g, "").replace(/\r\n/g, "\n");
  if (d.ext === "HTML") {
    let txt = cleaned.trim();
    if (d.title && txt.startsWith(d.title.trim())) txt = txt.slice(d.title.trim().length).trim();
    txt = txt.replace(/\bSearch\s+Nov\s+\d+[\s\S]{0,250}$/i, "");
    return clean(txt);
  }
  const pages = cleaned.split(/---\s*Página\s*\d+\s*---/);
  const kept = [];
  for (let i = 0; i < pages.length; i++) {
    let pg = stripPdfHeaders(pages[i]);
    pg = clean(pg);
    if (!pg || pg.length < 80) continue;
    if (
      i <= 12 &&
      /Derechos Reservados|sin el consentimiento por escrito|Elaborado y revisado por:|Subcomisión Nacional de|Edición y Diseño|Material [Ss]cout amigable con el ambiente/i.test(pg)
    ) {
      continue;
    }
    if (/^(?:\d{1,3}\s+)?(?:CAP[ÍI]TULO\s+\d+\s+)*[ÍI]NDICE\b/i.test(pg)) continue;
    if (i <= 14 && (pg.match(/•/g) || []).length >= 5 && /\bCAP[ÍI]TULO\s+\d/i.test(pg)) continue;
    const tocNums = (pg.match(/\s+\d{1,3}(?=\s+[A-ZÁÉÍÓÚÑ])/g) || []).length;
    if (i <= 14 && tocNums >= 6 && pg.length / tocNums < 95) continue;
    kept.push(pg);
  }
  return kept.join(" ");
}

function sliceSentenceAligned(body, startIdx, maxLen = 700) {
  let chunk = body.slice(startIdx);
  if (startIdx > 0) {
    const dot = chunk.search(/[.!?]\s+[A-ZÁÉÍÓÚÑ¿¡«"]/);
    if (dot >= 0 && dot < 360) chunk = chunk.slice(dot + 2);
    else return "";
  }
  chunk = chunk.trim();
  if (chunk.length < 180) return "";
  if (/\[email\s*protected\]/i.test(chunk)) return "";
  if ((chunk.match(/\d/g) || []).length / chunk.length > 0.22) return "";
  return cutSentence(chunk, maxLen);
}

for (const d of catalog) {
  if (d.is_duplicate || !d.title) continue;
  const t = shortTitle(d.title);
  const tipo = TIPO[d.ext] || "documento";
  const baseDoc = { cat: d.category, doc_id: d.id, page: 1 };
  const r = resumen(d);
  if (!r) continue;
  const head = `**«${t}»** es ${tipo === "imagen" ? "una imagen oficial" : "un " + tipo} de la categoría *${d.category}*${d.year ? ` (${d.year})` : ""}.`;
  const dirigido = d.section_label ? `**Dirigido a:** ${d.section_label}.` : "";

  if (d.ext === "HTML") {
    add({ ...baseDoc, q: `¿Qué es la página «${t}»?`, ans: `${head}\n\n**Qué contiene:** ${r}\n\n${ubic(d)}` }, "paginas");
    add({ ...baseDoc, q: `¿Qué información ofrece la página «${t}»?`, ans: `${head}\n\n${r}\n\n${dirigido}` }, "paginas");
    add({ ...baseDoc, q: `¿Para quién es la página «${t}»?`, ans: `${dirigido || "Es de interés general para toda la membresía scout."}\n\n**Sobre la página:** ${r}` }, "paginas");
    add({ ...baseDoc, q: `¿Dónde puedo consultar el contenido de «${t}»?`, ans: `${ubic(d)}\n\n**Resumen:** ${r}` }, "paginas");
  } else if (IMG.has(d.ext)) {
    add({ ...baseDoc, q: `¿Qué muestra la imagen «${t}»?`, ans: `${head}\n\n**Qué muestra:** ${r}\n\n${ubic(d)}` }, "imagenes");
    add({ ...baseDoc, q: `¿De qué año es la imagen «${t}» y quién la publicó?`, ans: `**«${t}»** fue publicada por **${d.origin || "ASMAC (Scouts de México)"}**${d.year ? ` y corresponde al año **${d.year}**` : ""}. ${dirigido}\n\n${r}` }, "imagenes");
    add({ ...baseDoc, q: `¿Dónde puedo ver o descargar la imagen «${t}»?`, ans: `${ubic(d)}\n\n**Formato:** ${d.ext} (${fmtSize(d)}).` }, "imagenes");
    add({ ...baseDoc, q: `¿Para qué sirve la imagen «${t}»?`, ans: `${head}\n\n${r}\n\n${dirigido}` }, "imagenes");
    add({ ...baseDoc, q: `¿A qué categoría o tema corresponde la imagen «${t}»?`, ans: `La imagen **«${t}»** pertenece a *${d.category}*${d.section_label ? ` y está pensada para **${d.section_label}**` : ""}.\n\n${r}` }, "imagenes");
    continue;
  } else {
    add({ ...baseDoc, q: `¿De qué trata el documento «${t}»?`, ans: `${head}\n\n**De qué trata:** ${r}\n\n${dirigido}` }, "documentos");
    add({ ...baseDoc, q: `¿Para quién es y qué incluye «${t}»?`, ans: `${dirigido || "Es de interés para toda la membresía scout."}\n\n**Qué incluye:** ${r}\n\n${ubic(d)}` }, "documentos");
    add({ ...baseDoc, q: `¿Quién emitió «${t}» y de qué año es?`, ans: `**«${t}»** fue emitido por **${d.origin || "ASMAC (Scouts de México)"}**${d.year ? ` y corresponde al año **${d.year}**` : ""}${d.date_sort ? ` (fecha de referencia: ${d.date_sort})` : ""}.${d.code ? ` Clave oficial: **${d.code}**.` : ""}\n\n${dirigido}` }, "documentos");
    add({ ...baseDoc, q: `¿Dónde puedo leer o descargar «${t}»?`, ans: `${ubic(d)}\n\n**Formato:** ${d.ext} (${fmtSize(d)}${d.page_count > 1 ? `, ${d.page_count} páginas` : ""}).` }, "documentos");
    if (d.page_count > 1)
      add({ ...baseDoc, q: `¿Cuántas páginas tiene «${t}»?`, ans: `**«${t}»** tiene **${d.page_count} páginas** y pesa ${fmtSize(d)} en formato ${d.ext}.\n\n**Contenido:** ${r}` }, "documentos");
  }

  if (/donation|Every Drop|Choose your/i.test(d.title)) continue;
  const body = extractCleanBodyPages(d);
  if (body.length < 480) continue;

  const firstSlice = sliceSentenceAligned(body, 0, 720);
  if (firstSlice && firstSlice.length >= 160 && norm(firstSlice.slice(0, 120)) !== norm(r.slice(0, 120))) {
    add({ ...baseDoc, q: `¿Qué puntos clave explica el contenido de «${t}»?`, ans: `**Extracto principal de «${t}»:**\n\n${firstSlice}\n\n${ubic(d)}` }, d.ext === "HTML" ? "paginas_detalle" : "documentos_detalle");
  }

  if (body.length >= 2200) {
    const midSlice = sliceSentenceAligned(body, Math.floor(body.length * 0.42), 720);
    if (midSlice) {
      add({ ...baseDoc, q: `¿Qué detalles o lineamientos adicionales incluye «${t}»?`, ans: `**Desarrollo en «${t}»:**\n\n${midSlice}\n\n*Fuente oficial: ${t}.*` }, d.ext === "HTML" ? "paginas_detalle" : "documentos_detalle");
    }
  }

  if (body.length >= 6500) {
    const lateSlice = sliceSentenceAligned(body, Math.floor(body.length * 0.72), 720);
    if (lateSlice) {
      add({ ...baseDoc, q: `¿Qué criterios o disposiciones complementarias aborda «${t}»?`, ans: `**Criterios complementarios en «${t}»:**\n\n${lateSlice}\n\n*Fuente oficial: ${t}.*` }, d.ext === "HTML" ? "paginas_detalle" : "documentos_detalle");
    }
  }

  if (body.length >= 12000) {
    const s20 = sliceSentenceAligned(body, Math.floor(body.length * 0.2), 720);
    if (s20) {
      add({ ...baseDoc, q: `¿Cómo se introducen y estructuran los temas iniciales de «${t}»?`, ans: `**Primera parte de «${t}»:**\n\n${s20}\n\n*Fuente oficial: ${t}.*` }, "documentos_detalle");
    }
  }

  if (body.length >= 22000) {
    const s58 = sliceSentenceAligned(body, Math.floor(body.length * 0.58), 720);
    if (s58) {
      add({ ...baseDoc, q: `¿Qué herramientas, procesos o ejemplos prácticos desarrolla «${t}»?`, ans: `**Desarrollo práctico en «${t}»:**\n\n${s58}\n\n*Fuente oficial: ${t}.*` }, "documentos_detalle");
    }
  }

  if (body.length >= 36000) {
    const s86 = sliceSentenceAligned(body, Math.floor(body.length * 0.86), 720);
    if (s86) {
      add({ ...baseDoc, q: `¿Qué acuerdos finales, evaluaciones o anexos incluye «${t}»?`, ans: `**Apartado final de «${t}»:**\n\n${s86}\n\n*Fuente oficial: ${t}.*` }, "documentos_detalle");
    }
  }
}

/* ------------------------------------------- 6. Preguntas planteadas en los documentos */
const BAD_START = /^¿(?:tienes|quieres|puedes|has|eres|sabes|necesitas|olvidaste|esperas|prefieres|ya |est[aá]s|buscas|te |no |listo|qu[eé] esperas|c[oó]mo puedes)/i;
const GOOD_START = /^¿(?:qu[eé]|cu[aá]l|cu[aá]les|c[oó]mo|qui[eé]n|qui[eé]nes|por qu[eé]|para qu[eé]|cu[aá]ndo|d[oó]nde|cu[aá]nt|en qu[eé]|de qu[eé]|a qui[eé]n|es |son |se |debe|deben|puede|pueden|tiene|tienen|hay )/i;
const EXCLUDE_CAT = new Set(["Colección Biblioteca del Centenario", "Revistas Foro Joven y Boletines", "Historia, Libros y Revista Foro Joven"]);
const inline = new Map();

for (const d of catalog) {
  if (d.is_duplicate || EXCLUDE_CAT.has(d.category) || /donation|Every Drop|Choose your/i.test(d.title)) continue;
  const raw = textOf(d);
  if (!raw) continue;
  const text = raw
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u00ad]/g, "")
    .replace(/---\s*Página\s*(\d+)\s*---/g, " ⟦P$1⟧ ")
    .replace(/\s+/g, " ");
  const re = /¿([^?¿⟦]{12,135})\?/g;
  let m;
  while ((m = re.exec(text))) {
    const q = normalizeQuestionCase("¿" + clean(m[1]) + "?");
    if (BAD_START.test(q) || !GOOD_START.test(q)) continue;
    if (/\b(tu|tus|tienes|quieres|puedes|has|eres|sabes|necesitas|olvidaste|esperas|prefieres|ti|contigo)\b/i.test(q)) continue;
    const words = q.split(/\s+/);
    const hasProper = words.slice(1).some((w) => /^[A-ZÁÉÍÓÚÑ]/.test(w.replace(/^[¿«"“]+/, "")));
    if (words.length < 4 && !hasProper) continue;
    const after = text.slice(m.index + m[0].length);
    const stop = after.search(/¿|⟦P/);
    let ans = clean(stop > 0 ? after.slice(0, Math.min(stop, 1300)) : after.slice(0, 1300));
    if (ans.length < 110) continue;
    if (/^[A-ZÁÉÍÓÚÑ\s,.:;¿?]{55,}/.test(ans.slice(0, 70))) continue;
    ans = cutSentence(ans, 780);
    if (ans.length < 100 || (ans.match(/\d/g) || []).length / ans.length > 0.18) continue;
    const pm = text.slice(0, m.index).match(/⟦P(\d+)⟧(?!.*⟦P)/);
    const page = pm ? Number(pm[1]) : 1;
    const key = norm(q);
    const prev = inline.get(key);
    const score = ans.length + (d.year || 0) / 10 + (d.ext === "HTML" ? 60 : 0);
    if (!prev || score > prev.score) inline.set(key, { q, ans, d, page, score });
  }
}
for (const { q, ans, d, page } of inline.values()) {
  const fuente = `*Fuente oficial: ${shortTitle(d.title)}${d.ext === "HTML" ? "" : `, pág. ${page}`}.*`;
  add({ q, cat: d.category, doc_id: d.id, page, ans: `${ans}\n\n${fuente}` }, "planteadas");
}

/* ------------------------------------------------------------ 7. Definiciones limpias en guías y manuales */
const ALLOWED_DEF_CAT = new Set([
  "Reglamentos, Estatutos y Políticas",
  "Manuales Oficiales y de Operación",
  "Guías, Carnets y Programa de Jóvenes (PJOS)",
]);
const defRe = /(?:^|[.!?]\s+)((?:El|La|Los|Las)\s+[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñÁÉÍÓÚÑ-]+(?:\s+(?:de|del|de la|y|en|para|a)?\s*[A-ZÁÉÍÓÚÑa-záéíóúñ-]+){0,4})\s+(es|son)\s+((?:el\s+(?:conjunto|proceso|m[eé]todo|sistema|motor|[oó]rgano|espacio|documento)|la\s+(?:herramienta|[uú]ltima|primera|instancia|unidad|organizaci[oó]n|estructura)|un\s+(?:conjunto|sistema|espacio|proceso|m[eé]todo|[oó]rgano|programa|marco)|una\s+(?:organizaci[oó]n|herramienta|instancia|unidad|red|secci[oó]n))[^.]{40,280}\.)/g;
const defs = {};
for (const d of catalog) {
  if (d.ext === "HTML" || d.is_duplicate || !ALLOWED_DEF_CAT.has(d.category)) continue;
  const text = clean(stripPdfHeaders(textOf(d)));
  if (!text) continue;
  let m;
  defRe.lastIndex = 0;
  while ((m = defRe.exec(text))) {
    const term = clean(m[1]);
    const words = term.split(/\s+/);
    if (words.length < 2 || words.length > 6) continue;
    if (!/^[A-ZÁÉÍÓÚÑ]/.test(words[1])) continue;
    if (/\b(?:no|presente|siguiente|primera?|segunda?|tercera?|misma?|otra?|anterior|responsable)\b/i.test(term)) continue;
    if (/\d{2,}|Derechos Reservados|Asociación de Scouts de México/i.test(term)) continue;
    const def = clean(m[3]);
    const k = norm(term);
    if (!defs[k]) defs[k] = { term, verb: m[2], def, d };
  }
}
for (const x of Object.values(defs)) {
  const baseDef = { cat: x.d.category, doc_id: x.d.id, page: 1 };
  const ans = `**${x.term}** ${x.verb} ${x.def}\n\n*Fuente oficial: ${shortTitle(x.d.title)}.*`;
  add({ ...baseDef, q: `¿Qué ${x.verb === "es" ? "es" : "son"} ${x.term.replace(/^(El|La|Los|Las)\s/, (s) => s.toLowerCase())}?`, ans }, "definiciones");
}

/* -------------------------------------------------------------------- Salida */
const result = {
  version: "1.2",
  generated_from: "scripts/generate_faq_v4.js",
  total_questions: out.length,
  questions: out,
};
fs.writeFileSync(path.join(DATA, "faq_v4.json"), JSON.stringify(result));
console.log("Preguntas nuevas V4:", out.length, stats);
console.log("Banco previo:", base.length + v3.length, "-> Total:", base.length + v3.length + out.length);
