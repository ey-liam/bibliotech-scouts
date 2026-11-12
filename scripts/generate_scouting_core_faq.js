/**
 * Banco curado profundo y 100 % documentado sobre pilares esenciales del Movimiento Scout:
 * - Qué es el Movimiento Scout, cómo se originó (Brownsea 1907 / México 1926) y por quién (Robert Baden-Powell)
 * - Quién puede formar parte del Movimiento Scout y requisitos para jóvenes y adultos (Estatutos y Reglamento 2023)
 * - Igualdad de género, Diversidad, Equidad e Inclusión (Política DEI 2024, JSN 21.007, Manual DEN SCNEG)
 * - Canal CONECTA, Denuncias Scouts y MASC (conecta.scouts.org.mx, ID de Denuncia, CNH 2025)
 * - Reglamentos y Manual del Uniforme (Junio 2026)
 * - Especialidades Scouts (FES), Páginas oficiales de la Asociación y Cómo hacer proyectos paso a paso
 *
 * Todas las respuestas citan los documentos reales del catálogo. Cero emojis y cero datos inventados.
 */

function generateScoutingCoreFaq(ctx) {
  const { add } = ctx;

  const CORE_QA = [
    // -----------------------------------------------------------------------
    // 1. QUÉ ES EL MOVIMIENTO SCOUT, ORIGEN Y FUNDADOR
    // -----------------------------------------------------------------------
    {
      q: "¿Qué es el Movimiento Scout y cuál es su propósito?",
      cat: "Reglamentos, Estatutos y Políticas",
      doc_id: "doc-0438",
      page: 1,
      ans: "De acuerdo con los **Estatutos 2023** (Artículos 1.1 y 3) y la **Política Nacional de Programa de Jóvenes 2025**, el Movimiento Scout (representado en México de forma única ante World Scouting por la Asociación de Scouts de México, A.C.) es una **institución educativa no formal, voluntaria y sin fines políticos partidistas** dedicada a formar el carácter de niñas, niños, adolescentes y jóvenes mediante el **Método Scout** y el **Programa de Jóvenes**, ayudándoles a ser personas responsables y útiles a su comunidad.\n\n*Fuente oficial: Estatutos 2023 (`doc-0438`) y Política Nacional de Programa de Jóvenes 2025 (`doc-0256`).*",
    },
    {
      q: "¿Quién originó el Movimiento Scout a nivel mundial?",
      cat: "Colección Biblioteca del Centenario",
      doc_id: "doc-0228",
      page: 20,
      ans: "El Movimiento Scout fue fundado por **Robert Baden-Powell** (B-P). Su primer campamento experimental tuvo lugar en la **Isla de Brownsea, en 1907**, donde probó el método educativo al aire libre y utilizó el histórico cuerno de kudú que después se volvió símbolo mundial.\n\n*Fuente oficial: Revista Foro Joven 127 (`doc-0228`, pág. 20) y colección Los inicios 1 (`doc-0164`).*",
    },
    {
      q: "¿Cómo y cuándo se originó el Movimiento Scout en el mundo (Campamento de Brownsea)?",
      cat: "Colección Biblioteca del Centenario",
      doc_id: "doc-0228",
      page: 20,
      ans: "El Escultismo nació en el verano de **1907** con el **campamento experimental en la Isla de Brownsea** encabezado por **Baden-Powell**; tras su éxito se expandió internacionalmente, celebrándose en **1920 el 1.er Jamboree Scout Mundial** y conmemorando en 2007 su primer centenario mundial en la misma isla.\n\n*Fuente oficial: Revista Foro Joven 127 (`doc-0228`, pág. 20) y obra gráfica Brownsea (`doc-0520`).*",
    },
    {
      q: "¿Cómo y cuándo se originó el Escultismo en México (Centenario 1926–2026)?",
      cat: "Colección Biblioteca del Centenario",
      doc_id: "doc-0164",
      page: 8,
      ans: "Los **Exploradores Nacionales de la República Mexicana** fueron reconocidos oficialmente como organización scout nacional del **22 al 28 de agosto de 1926** durante la **IV Conferencia Scout Internacional** celebrada en **Kandersteg, Suiza**. Entre los precursores e impulsores iniciales recopilados en *Los inicios 1 y 2* figuran **Federico Clark, Andrés Gómez Oreján, Jorge Núñez Prida, Juan Lainé Roiz y Francisco Macías Valadez Salgado**. En **2026** la ASMAC conmemora el **Centenario Scout en México (1926–2026)**.\n\n*Fuente oficial: Los inicios 1 (`doc-0164`, págs. 8–10) y Política DEI 2024 (`doc-0272`).*",
    },
    {
      q: "¿Por quién fue reconocida la Asociación de Scouts de México a nivel mundial?",
      cat: "Reglamentos, Estatutos y Políticas",
      doc_id: "doc-0438",
      page: 5,
      ans: "Según el **Artículo 10 de los Estatutos 2023**, la Asociación de Scouts de México, A.C. (ASMAC) es la **única agrupación en México miembro de la Organización Mundial del Movimiento Scout (World Scouting / WOSM)**, tras su reconocimiento internacional en la IV Conferencia Scout Internacional de Kandersteg en agosto de **1926**.\n\n*Fuente oficial: Estatutos 2023 (`doc-0438`, Art. 10) y Los inicios 1 (`doc-0164`).*",
    },

    // -----------------------------------------------------------------------
    // 2. QUIÉN PUEDE FORMAR PARTE DEL MOVIMIENTO Y REQUISITOS
    // -----------------------------------------------------------------------
    {
      q: "¿Quién puede formar parte del Movimiento Scout en México?",
      cat: "Reglamentos, Estatutos y Políticas",
      doc_id: "doc-0438",
      page: 10,
      ans: "De acuerdo con el **Artículo 3 y Artículo 11 de los Estatutos 2023**, el Movimiento Scout está abierto a **niñas, niños, adolescentes, jóvenes y adultos voluntarios que ingresen voluntariamente, sin distinción de credo, raza o nacionalidad**. Los únicos requisitos estatutarios básicos son:\n1. Ingresar voluntariamente.\n2. Profesar alguna religión o espiritualidad.\n3. Registrarse conforme a los términos reglamentarios vigentes.\n\n*Fuente oficial: Estatutos 2023 (`doc-0438`, Art. 3 y Art. 11).*",
    },
    {
      q: "¿De qué edades pueden entrar niñas, niños y jóvenes a las secciones Scouts en 2026?",
      cat: "Manuales Oficiales y de Operación",
      doc_id: "doc-0431",
      page: 9,
      ans: "Desde el 1.° de julio de 2025 (`JSN 25.051`), el sistema **SISAS** aplica estrictamente los rangos del **Reglamento 2023**:\n- **Manada de Lobeznas y Lobatos:** de **6 a menores de 10 años**.\n- **Tropa de Scouts:** de **10 a menores de 14 años**.\n- **Comunidad de Caminantes:** de **14 a menores de 18 años**.\n- **Clan de Rovers:** de **18 a menores de 22 años**.\nA partir de los 18 o 22 años (según el cargo), las personas pueden colaborar como **Scouters o Dirigentes adultos**.\n\n*Fuente oficial: Reglamento 2023 (`doc-0431`) y Comunicado JSN 25.051.*",
    },
    {
      q: "¿Qué requisitos pide el Reglamento para ser adulto Scouter o Dirigente en un Grupo Scout?",
      cat: "Reglamentos, Estatutos y Políticas",
      doc_id: "doc-0431",
      page: 20,
      ans: "El **Artículo 13 del Reglamento 2023** establece entre otros requisitos para ser Scouter o Dirigente:\n- Cumplir con la Promesa Scout y edad mínima del cargo (**18 años** para Subjefe de Manada o Tropa; **20 años** para Jefe de Manada, Jefe de Tropa o Subjefe de Comunidad; **22 años** para Jefe de Comunidad o colaborador Provincia/Nacional; **23 a 25 años** para Consejero de Clan, Jefe de Grupo o Presidente de Provincia).\n- Conocer los Ordenamientos de la ASMAC, los libros básicos de la sección, los Derechos de Niñas, Niños y Adolescentes y los derechos humanos.\n- Cumplir con su **Plan Personal de Formación** y contraer el **Acuerdo y Compromiso Mutuo**.\n- Estar estudiando, desarrollando ocupación/oficio o jubilado, y respetar el interés superior de la niñez.\n\n*Fuente oficial: Reglamento 2023 (`doc-0431`, Art. 13, págs. 20–21).*",
    },

    // -----------------------------------------------------------------------
    // 3. IGUALDAD DE GÉNERO, DIVERSIDAD, EQUIDAD E INCLUSIÓN (DEI)
    // -----------------------------------------------------------------------
    {
      q: "¿Qué establece la ASMAC sobre igualdad de género e inclusión (Política DEI 2024)?",
      cat: "Reglamentos, Estatutos y Políticas",
      doc_id: "doc-0272",
      page: 1,
      ans: "La **Política Nacional de Diversidad, Equidad e Inclusión (DEI)**, aprobada por el Consejo Nacional el **19 de octubre de 2024** con revisión de la **ENTS-UNAM**, define:\n- **Igualdad de género:** situación en la que mujeres y hombres acceden con las mismas posibilidades y oportunidades al uso, control y beneficio de bienes, servicios y recursos, así como a la toma de decisiones.\n- **Perspectiva de género:** visión analítica orientada a eliminar causas de desigualdad, opresión o jerarquización basada en género, garantizando el mismo valor y derechos.\n- **Igualdad sustantiva e Inclusión:** garantizar el mismo trato y oportunidades sin discriminación ni prejuicios en todas las secciones y cargos.\n\n*Fuente oficial: Política Nacional de Diversidad, Equidad e Inclusión 2024 (`doc-0272`).*",
    },
    {
      q: "¿Qué órganos o personas atienden la igualdad y equidad de género en la ASMAC y en cada Provincia?",
      cat: "Reglamentos, Estatutos y Políticas",
      doc_id: "doc-0514",
      page: 1,
      ans: "A nivel nacional participan la **Comisión Nacional de Igualdad Sustantiva / Igualdad y Equidad de Género** (dentro de la Dirección Nacional de Protección a la Membresía y en articulación con la Dirección de Métodos Educativos, donde existió la **SCNEG** según el Manual DEN) y, en cada Provincia, la figura de **Colaboradora de Provincia para la Igualdad y Equidad de Género** (`ASMAC/JSN/21.007`), mujer mayor de 22 años que reporta al Vicepresidente de Métodos Educativos para impulsar estrategias de igualdad sustantiva y prevención de violencias.\n\n*Fuente oficial: Comunicado JSN 21.007 (`doc-0514`), Manual de Operación DEN (`doc-0255`, pág. 96) y Organigrama Protección a la Membresía (`doc-0320`).*",
    },
    {
      q: "¿Cómo maneja el Reglamento la participación y jefatura de secciones femeninas, masculinas o mixtas?",
      cat: "Reglamentos, Estatutos y Políticas",
      doc_id: "doc-0431",
      page: 20,
      ans: "Según el **Artículo 13 incisos c) y d) del Reglamento 2023**: en Tropa, Comunidad o Clan de modalidad femenina o masculina el cargo de Jefe/Subjefe corresponde al género respectivo de la sección; en **Manada**, sin importar su modalidad, las y los Scouters pueden ser de **cualquier género**. En **secciones mixtas** debe contarse con Scouters de **ambos géneros** y la jefatura puede desempeñarla cualquiera de ellos.\n\n*Fuente oficial: Reglamento 2023 (`doc-0431`, Art. 13 incisos c y d).*",
    },

    // -----------------------------------------------------------------------
    // 4. CANAL CONECTA, DENUNCIAS SCOUTS Y RESOLUCIÓN DE CONTROVERSIAS
    // -----------------------------------------------------------------------
    {
      q: "¿Qué datos me pide el portal CONECTA para levantar una denuncia o incidente Scout?",
      cat: "Guías SISAS, CONECTA y Soporte Digital",
      doc_id: "doc-0023",
      page: 1,
      ans: "Al entrar a **https://conecta.scouts.org.mx** → **Denunciar incidente**, el formulario confidencial (regido por Políticas de Privacidad y Protección de Datos Personales) solicita:\n1. **Datos de contacto de quien denuncia:** nombre completo, edad, **CUM** de la persona afectada (visible al frente de la credencial), correo electrónico para notificaciones y Provincia.\n2. **Datos del hecho a denunciar** y descripción de lo sucedido.\nAl enviarlo recibes un **ID de Denuncia** numérico para dar seguimiento en la sección *Consulta tu reporte*.\n\n*Fuente oficial: Denuncia CONECTA (`doc-0023`), Consulta tu reporte (`doc-0018`) y Portada CONECTA (`doc-0366`).*",
    },
    {
      q: "¿Cómo consulto el estado de una denuncia que ya metí en CONECTA?",
      cat: "Guías SISAS, CONECTA y Soporte Digital",
      doc_id: "doc-0018",
      page: 1,
      ans: "Ingresa a **https://conecta.scouts.org.mx** y entra al apartado **Consulta incidente / Consulta tu reporte** usando únicamente tu **ID de Denuncia** (solo números). El sistema muestra el seguimiento y también envía actualizaciones al correo electrónico que diste de alta al levantar el reporte.\n\n*Fuente oficial: Consulta tu reporte — CONECTA (`doc-0018`) y ¿Qué es CONECTA? (`doc-0740`).*",
    },
    {
      q: "¿Qué diferencia hay entre Diálogo Directo, Mediación, Arbitraje y una denuncia en CONECTA?",
      cat: "Formatos, Actas y Seguro Scout",
      doc_id: "doc-0145",
      page: 1,
      ans: "Los **Mecanismos Alternativos de Solución de Controversias (MASC)** buscan resolver diferencias entre integrantes mediante actas oficiales: **Diálogo Directo** (`DD.prov.2026.01`, plática directa acordada), **Mediación** (`MED.prov.2026.01`, con mediador neutral) y **Arbitraje / Corte de Honor** (`AR.2026.PROV.01`, conforme al Reglamento CNH 2025).\nEn cambio, **CONECTA** (`conecta.scouts.org.mx`, *A Salvo del Peligro*) se usa para reportar situaciones graves o vulneraciones a derechos humanos, bullying, acoso, hostigamiento o riesgo hacia niñas, niños, jóvenes y adultos, con atención especializada y confidencial.\n\n*Fuente oficial: Actas MASC (`doc-0145`, `doc-0152`, `doc-0153`), Reglamento CNH 2025 (`doc-0268`) y Guía CONECTA (`doc-0740`).*",
    },

    // -----------------------------------------------------------------------
    // 5. MANUAL DEL UNIFORME (JUNIO 2026) Y REGLAMENTOS
    // -----------------------------------------------------------------------
    {
      q: "¿Qué cambios trajo el Manual del Uniforme Scout actualizado el 10 de junio de 2026?",
      cat: "Manuales Oficiales y de Operación",
      doc_id: "doc-0128",
      page: 1,
      ans: "El **Manual del Uniforme Scout aprobado el 10 de junio de 2026** (107 páginas, +27 respecto a la edición de marzo de 2019) incorpora:\n- El uso oficial de **camisolas por color de sección** (Amarilla para Lobatos, Verde para Scouts, Azul para Caminantes, Roja para Rovers) con manga corta o larga y presilla lateral izquierda para distintivo de sección o cinta de liderazgo.\n- Nuevas prendas reconocidas: **camisola tipo polo, camisola outdoor, uniforme de trabajo** y **uniforme de gala**.\n- Colocación exacta de progresiones PJOS (**Cazaderos, Rumbos, Senderos y Rutas**), **Insignia de Compromiso Ciudadano** y las 4 insignias del **Marco Mundo Mejor**.\n- Autorización expresa para seguir portando insignias obtenidas del anterior ENPE junto con las nuevas (págs. 44, 56 y 67).\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026 (`doc-0128`).*",
    },
    {
      q: "¿Qué colores de camisola oficial usa cada sección según el Manual del Uniforme 2026?",
      cat: "Manuales Oficiales y de Operación",
      doc_id: "doc-0128",
      page: 14,
      ans: "Según el **Artículo 1 del Manual del Uniforme (Junio 2026, pág. 14)**, los colores oficiales de camisola son:\n- **Amarilla:** Lobatos y Lobeznas (Manada) y Scouters/equipo de Manada.\n- **Verde:** Scouts (Tropa) y Scouters/equipo de Tropa.\n- **Azul:** Caminantes (Comunidad) y Scouters/equipo de Comunidad.\n- **Roja:** Rovers (Clan) y Consejeros/equipo de Clan.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026 (`doc-0128`, Art. 1, pág. 14).*",
    },
    {
      q: "¿Para qué sirve el Reglamento 2023 y quién debe cumplirlo?",
      cat: "Reglamentos, Estatutos y Políticas",
      doc_id: "doc-0431",
      page: 1,
      ans: "El **Reglamento 2023** desarrolla y detalla la organización interna de la Asociación en sus tres niveles (**Grupo Scout, Provincia Scout y Nivel Nacional**), la estructura y funciones de cada sección, las asambleas y consejos, la membresía, requisitos para Scouters y Dirigentes, registros, distintivos y disciplina. Es **obligatorio para todos los miembros activos y órganos de la ASMAC**.\n\n*Fuente oficial: Reglamento 2023 (`doc-0431`, Art. 1–13).*",
    },

    // -----------------------------------------------------------------------
    // 6. ESPECIALIDADES SCOUTS (FES) Y FAES
    // -----------------------------------------------------------------------
    {
      q: "¿Cómo funcionan las nuevas Fichas de Especialidades Scout (FES) y cuáles son sus etapas?",
      cat: "Especialidades Scouts (FES)",
      doc_id: "doc-0745",
      page: 1,
      ans: "Las **Fichas de Especialidades Scout (FES)** publicadas en **recme.scouts.org.mx/especialidades** están organizadas alrededor de **4 Ejes Temáticos** (*Salud y Bienestar, Habilidades para la Vida, Paz y Participación Comunitaria, Medio Ambiente y Sustentabilidad*) y vinculadas a los **17 ODS**. Cada ficha guía al participante en una ruta práctica uniforme:\n1. **Descubro** (qué exploro)\n2. **1. Conozco** (investigación básica)\n3. **2. Aplico** (actividad práctica)\n4. **3. Comparto** (compartir aprendizaje con otros)\n5. **Medidas de Seguridad**, **ODS** relacionados y **Reflexiono**.\n\n*Fuente oficial: Catálogo Oficial FES (`doc-0745`), Instructivos FES (`doc-0742` y `doc-0743`) y fichas FES de Comunidad (`doc-0651` a `doc-0668`).*",
    },
    {
      q: "¿Qué secciones tienen ya Fichas de Especialidades (FES) disponibles en la base de datos?",
      cat: "Especialidades Scouts (FES)",
      doc_id: "doc-0745",
      page: 1,
      ans: "Actualmente la base de datos contiene las **18 fichas completas de Comunidad de Caminantes** (8 en *Habilidades para la Vida*, 7 en *Salud y Bienestar*, 2 en *Paz y Participación Comunitaria* y 1 en *Medio Ambiente y Sustentabilidad*), además del **instructivo de ejemplo de Manada (*Primer Respondiente Junior*)**, la guía oficial de Comunidad (*Masterchefsito*), la guía general **FAES** y las plantillas **P10.4 / P10.5** para diseñar nuevas especialidades. Las fichas individuales de **Manada, Tropa y Clan** se irán integrando en futuras actualizaciones.\n\n*Fuente oficial: Categoría Especialidades Scouts FES (`doc-0651` a `doc-0668`, `doc-0742`, `doc-0743`, `doc-0745`).*",
    },

    // -----------------------------------------------------------------------
    // 7. RESUMEN RÁPIDO DE TODAS LAS PÁGINAS DE LA ASOCIACIÓN Y CÓMO HACER PROYECTOS
    // -----------------------------------------------------------------------
    {
      q: "¿Cuáles son todas las páginas oficiales de los Scouts de México (ASMAC) y para qué sirve cada una?",
      cat: "Guías SISAS, CONECTA y Soporte Digital",
      doc_id: "doc-0741",
      page: 1,
      ans: "El ecosistema web oficial de la ASMAC y WOSM incluye:\n- **scouts.org.mx:** sitio institucional principal, comunicados y noticias.\n- **sisas.scouts.org.mx:** perfil de miembro, credencial digital QR, ficha médica, cambios de grupo, reinscripción e inscripción a eventos.\n- **familiar.scouts.org.mx:** portal exclusivo para inscribir de 3 a 5 familiares nucleares juntos con 25 % / 30 % / 35 % de descuento sobre cuota nacional.\n- **recme.scouts.org.mx:** descarga oficial de formatos `P1`–`P10`, guía `FAES`, esquemas `P3` y Fichas de Especialidades (`FES`).\n- **helpdesk.scouts.org.mx:** 25 guías paso a paso y sistema de tickets atendido por 11 departamentos nacionales.\n- **conecta.scouts.org.mx:** canal confidencial *A Salvo del Peligro* para denuncias e incidentes.\n- **cdc.scouts.org.mx:** cursos autogestivos en línea (*Comunidad Digital de Conocimiento*) y carga de portafolios terminales.\n- **tiendaenlinea.scouts.org.mx:** Tienda Scout Nacional para uniformes, nuevas insignias y escudos.\n- **ExplorApp y CarpetApp:** apps oficiales de progresión PJOS (2026).\n- **scout.org y donate.scout.org:** portales mundiales de World Scouting y Scout Donation Platform.\n\n*Fuente oficial: Portales y Guías Oficiales ASMAC/WOSM integrados en BiblioTech Scout (`11/11/2026`).*",
    },
    {
      q: "Paso a paso: ¿cómo hago un proyecto scout completo desde cero con los formatos oficiales?",
      cat: "Plantillas PJOS, FAES y RECME",
      doc_id: "doc-0669",
      page: 1,
      ans: "Sigue estos 5 pasos respaldados por los documentos oficiales RECME:\n1. **Detecta una necesidad real y define metas SMART:** usa objetivos Específicos, Medibles, Alcanzables, Relevantes y con Temporalidad (ver `P3.4 Mapa de Rutas PPV SMART`, `doc-0679`), eligiendo qué **ODS** y Eje Temático impacta.\n2. **Llena la ficha de planeación oficial:** utiliza el **Formato Oficial de Proyecto Scout v1.1** (`doc-0669`) o la **Plantilla P6.2** (`doc-0687`), integrando título, objetivos, participantes, cronograma, presupuesto/cotización (`NO 9 Cotización` o `NO 1`) y carta descriptiva.\n3. **Consigue validación de tu sección y Scouter:** preséntalo ante tu Scouter/Consejero y tu Consejo de Comunidad, Asamblea de Clan o Corte de Honor (o Director de Evento si requiere `P6.3` / permiso de campamento `P6.1`).\n4. **Ejecuta y documenta con seguridad:** cuida medidas de riesgo (`JSN/19.073`), consentimiento de imagen (`Uso-de-imagen`) y, si quieres financiarlo o difundirlo mundialmente, sigue las 7 preguntas de `donate.scout.org` (`doc-0381`).\n5. **Evalúa y cierra:** entrega el **Informe de Actividades `P6.5`** (`doc-0690`) y actualiza tu seguimiento `P7.1–P7.4` si suma a tu progresión o Insignia Terminal.\n\n*Fuente oficial: Formato de Proyecto v1.1 (`doc-0669`), P6.2 (`doc-0687`), P6.5 (`doc-0690`) y P3.4 (`doc-0679`).*",
    },
  ];

  for (const item of CORE_QA) {
    add({ q: item.q, cat: item.cat, doc_id: item.doc_id, page: item.page, ans: item.ans }, "nucleo_scout");
  }
}

module.exports = { generateScoutingCoreFaq };
