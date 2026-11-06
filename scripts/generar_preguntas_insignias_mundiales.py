# -*- coding: utf-8 -*-
"""
Script generador de preguntas y respuestas oficiales sobre Insignias Mundiales,
Marco Mundo Mejor (Better World Framework) y condecoraciones de la OMMS / WOSM.
Basado estrictamente en:
- Manual del Uniforme Actualizado Junio 2026 (doc-0128, Arts. 65-71, 86)
- Manual de Implementación Insignia de Madera (doc-0577)
- Las Rutas del Rover (doc-0410)
- Páginas oficiales WOSM / World Scouting (World Scouting Awards, Bronze Wolf, Wood Badge,
  Messengers of Peace, Earth Tribe, Champions for Nature, Plastic Tide Turners, Scouts Go Solar,
  JOTA-JOTI, 26th World Scout Jamboree Polonia 2027, 17th World Scout Moot Taiwán 2029, BP Fellowship).
"""

import json
import os

FAQ_PATH = r"C:\Users\liamc\bibliotech-scouts\data\faq_v3.json"

NUEVAS_PREGUNTAS = [
    # -------------------------------------------------------------------------
    # 1. VISIÓN GENERAL Y MARCO MUNDO MEJOR (BETTER WORLD FRAMEWORK)
    # -------------------------------------------------------------------------
    {
        "q": "¿Qué son las Insignias Mundiales y cómo funciona el Marco Mundo Mejor (Better World Framework) de la OMMS?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 71,
        "ans": "**Las Iniciativas Mundiales son programas educativos internacionales de la Organización Mundial del Movimiento Scout (OMMS / WOSM) que promueven la educación integral y el compromiso activo de niños, niñas, adolescentes y jóvenes frente a los principales desafíos globales.**\n\n- **Marco Mundo Mejor (Better World Framework):** es la estrategia global que conecta las actividades scouts con los 17 Objetivos de Desarrollo Sostenible (ODS) de la Agenda 2030 de la ONU.\n- **Adaptación nacional:** en la ASMAC se integran dentro del **Programa de Jóvenes Orientado a la Sustentabilidad (PJOS)** a través de sus seis Ejes Temáticos.\n- **Propósito:** inspirar a la juventud a investigar problemáticas en sus comunidades, diseñar proyectos sostenibles de impacto medible y registrar sus acciones en la red scout global (`scout.org`).\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Capítulo 03, Sexta Sección, Art. 65 y lineamientos mundiales de World Scouting.*"
    },
    {
        "q": "¿Cuáles son las 4 grandes áreas temáticas del Marco Mundo Mejor y cómo se alinean a los 17 ODS de la ONU?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 71,
        "ans": "**El Marco Mundo Mejor (Better World Framework) de World Scouting agrupa sus desafíos e insignias en cuatro grandes áreas temáticas alineadas con los 17 Objetivos de Desarrollo Sostenible (ODS):**\n\n1. **Medio Ambiente y Sostenibilidad:** incluye la iniciativa *Earth Tribe (Tribu de la Tierra)* con sus retos *Champions for Nature* (ODS 12, 14 y 15), *Plastic Tide Turners* (ODS 14) y *Scouts Go Solar* (ODS 7 y 13).\n2. **Paz y Participación Comunitaria:** integra *Mensajeros de la Paz (Messengers of Peace)*, *Diálogo por la Paz* (con KAICIID), *Diálogo Interreligioso* y *Patrimonito / Patrimonio Mundial* (con UNESCO) (ODS 16).\n3. **Habilidades para la Vida (Life Skills):** incluye la iniciativa *Life Leaders* con los retos *Impact Innovators* y *EQ in Action* (liderazgo, alfabetización digital, STEAM y emprendimiento) (ODS 4, 8 y 9).\n4. **Salud y Bienestar (Health & Well-being):** comprende la iniciativa *Health Allies* con los retos *Challenge Nutrition* y *Mind Builders* (resiliencia emocional, salud mental y estilos de vida saludables) (ODS 3).\n\n*Fuente oficial: World Scouting Brand & Framework y Manual del Uniforme 2026, Arts. 65–71.*"
    },
    {
        "q": "¿En qué parte del uniforme oficial se colocan las Insignias Mundiales según el Manual del Uniforme Junio 2026?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 71,
        "ans": "**El Manual del Uniforme 2026 de la ASMAC (Capítulo 03, Sexta Sección) establece las siguientes ubicaciones exactas para las Insignias Mundiales:**\n\n- **Flor de Lis Mundial (Insignia de Compromiso):** en el centro de la bolsa izquierda de la camisola.\n- **Mensajeros de la Paz (Anilla):** en la bolsa izquierda de la camisola, colocada alrededor de la Insignia de Compromiso.\n- **Pin de la Tribu de la Tierra (Earth Tribe):** en la solapa de la bolsa derecha de la camisola, del lado derecho de la solapa.\n- **Insignias de Desafíos Mundiales (Champions for Nature, Plastic Tide Turners, Scouts Go Solar, Diálogo por la Paz, Diálogo Interreligioso, Patrimonito, Life Leaders, Health Allies y Scouts del Mundo):** se colocan **arriba de la bolsa derecha de la camisola**, por encima del escudo oficial de *Scouts de México*. El orden entre ellas es indistinto siempre y cuando no salgan de esa zona.\n- **Pin de Scouts del Mundo:** en la solapa de la bolsa derecha, del lado derecho.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Arts. 65 a 71.*"
    },

    # -------------------------------------------------------------------------
    # 2. FLOR DE LIS MUNDIAL (INSIGNIA DE COMPROMISO)
    # -------------------------------------------------------------------------
    {
        "q": "¿Qué es la Flor de Lis Mundial, cuál es su historia y por qué es la Insignia de Compromiso en la ASMAC?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 11,
        "ans": "**La Flor de Lis Mundial (World Scout Crest) es el emblema oficial y protegido de la Organización Mundial del Movimiento Scout (OMMS / WOSM), adoptado por Baden-Powell desde 1907 como símbolo universal de orientación.**\n\n- **Insignia de Compromiso:** en la ASMAC se denomina oficialmente *Insignia de Compromiso* porque certifica que quien la porta ha formulado de manera libre y voluntaria su **Promesa Scout**.\n- **Diseño renovado Egipto 2024:** la ASMAC adoptó el diseño modernizado de la Flor de Lis Mundial aprobado por la **43° Conferencia Scout Mundial de Egipto 2024**, con trazos limpios, proporciones vectoriales estilizadas y color morado institucional.\n- **Composición:** círculo de tela morada con la Flor de Lis en color blanco, rodeada por una cuerda blanca cerrada con un nudo llano (rizo) en la parte inferior.\n- **Ubicación:** centrada sobre la bolsa izquierda de la camisola.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Capítulo 02, Artículo 15.*"
    },
    {
        "q": "¿Qué simbolizan los tres pétalos, la línea central, las dos estrellas de cinco puntas, la cuerda y el nudo llano de la Flor de Lis Mundial?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 11,
        "ans": "**Cada elemento de la Flor de Lis Mundial encierra un profundo significado educativo e histórico definido por Baden-Powell:**\n\n- **Los tres pétalos:** representan los **tres deberes y principios scouts**: 1) Deberes para con Dios / principios espirituales; 2) Deberes para con los demás (patria, sociedad y paz); 3) Deberes para consigo mismo (autoformación y desarrollo personal).\n- **La línea central recta:** simboliza la brújula y la aguja que marca el norte, recordando que el scout avanza recto por el camino del honor.\n- **Las dos estrellas de cinco puntas:** sus 10 puntas en total representan los **10 artículos de la Ley Scout**, además de ser los ojos abiertos y la luz del discernimiento en la noche.\n- **La cuerda circular:** simboliza la **unidad y la hermandad scout mundial** que abraza a millones de miembros en más de 174 países sin distinción de origen, lengua o creencia.\n- **El nudo llano (rizo):** une los dos extremos de la cuerda recordando la firmeza del lazo fraternal, la vocación de servicio y el deber cotidiano de realizar la **Buena Acción diaria**.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026 y estatutos oficiales de WOSM.*"
    },
    {
        "q": "¿Qué cambios tuvo el diseño oficial de la Flor de Lis Mundial en la 43° Conferencia Scout Mundial de Egipto 2024?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 11,
        "ans": "**Durante la 43° Conferencia Scout Mundial celebrada en El Cairo, Egipto (agosto de 2024), la OMMS aprobó una actualización integral de la identidad visual de World Scouting:**\n\n- **Optimización digital y física:** los trazos de la flor de lis se refinaron para asegurar una reproducción nítida tanto en bordados físicos como en pantallas y aplicaciones móviles.\n- **Curvatura de pétalos y cuerda:** se armonizaron las proporciones del pétalo central y las hojas laterales, y se definió un trazo limpio para el nudo llano y la cuerda circundante.\n- **Tono morado estandarizado:** se fijó el tono de morado scout mundial oficial (*World Scout Purple*), garantizando consistencia en todas las Organizaciones Scouts Nacionales.\n- **Adopción ASMAC:** el Manual del Uniforme Junio 2026 de la ASMAC oficializó esta versión para la Insignia de Compromiso en camisolas de todas las secciones.\n\n*Fuente oficial: Resoluciones de la 43° Conferencia Scout Mundial (Egipto 2024) y Manual del Uniforme ASMAC 2026.*"
    },

    # -------------------------------------------------------------------------
    # 3. MENSAJEROS DE LA PAZ (MESSENGERS OF PEACE - MoP)
    # -------------------------------------------------------------------------
    {
        "q": "¿Qué es la iniciativa Mensajeros de la Paz (Messengers of Peace) de la Organización Mundial Scout?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 71,
        "ans": "**Mensajeros de la Paz (Messengers of Peace - MoP) es una iniciativa insignia de World Scouting lanzada en 2011 con el propósito de inspirar a jóvenes scouts a diseñar e implementar proyectos que promuevan la paz, la resolución de conflictos y el bienestar comunitario.**\n\n- **Impacto global:** los scouts registran sus horas de servicio comunitario y proyectos en la plataforma mundial (`scout.org/messengers-of-peace`), sumando cientos de millones de horas de impacto verificable en todo el planeta.\n- **Pilares:** promueve la cultura de paz en tres niveles: paz personal (armonía interior y salud), paz comunitaria (inclusión social y diálogo) y paz ambiental (cuidado del entorno común).\n- **Vigencia en ASMAC:** está alineada al Eje Temático de *Paz y Participación Comunitaria* del PJOS.\n\n*Fuente oficial: Manual del Uniforme 2026, Art. 65 y plataforma WOSM Messengers of Peace.*"
    },
    {
        "q": "¿Cuáles son las dimensiones, diseño y simbolismo de la anilla de Mensajeros de la Paz?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 71,
        "ans": "**De acuerdo con el Artículo 65 del Manual del Uniforme Junio 2026, la insignia de Mensajeros de la Paz presenta las siguientes características técnicas oficiales:**\n\n- **Dimensiones:** anilla de **60 mm de ancho x 80 mm de alto**, con un suajado circular central de **40 mm de diámetro** para alojar la Flor de Lis Mundial (Insignia de Compromiso de 40 x 40 mm).\n- **Diseño:** anilla bordada en color blanco con la leyenda *MESSENGERS OF PEACE* y hojas de olivo en color verde.\n- **Iconografía:** silueta bordada de una paloma en color morado sosteniendo con el pico una rama de olivo en color verde, acompañada de la Flor de Lis Mundial en uno de sus costados.\n- **Orilla:** borde exterior festoneado en color morado.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Capítulo 03, Art. 65.*"
    },
    {
        "q": "¿Dónde se porta la anilla de Mensajeros de la Paz y qué sucede con la Insignia de Compromiso al ganarla?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 71,
        "ans": "**La anilla de Mensajeros de la Paz se coloca en la bolsa izquierda de la camisola, rodeando la Insignia de Compromiso:**\n\n- **Sustitución de la flor de lis:** al obtener esta insignia, la Flor de Lis tradicional se sustituye por la flor de lis de 40 mm que viene incluida con el kit de la anilla, embonando con precisión en el suajado central.\n- **Permanencia vitalicia:** la o el NNAJ, **incluso después de cumplir los 22 años y pasar a ser Scouter o adulto**, tiene derecho a seguir portando la anilla durante el resto de su vida scout conforme a los criterios de la guía vigente.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Art. 65.*"
    },
    {
        "q": "¿Qué es el premio internacional Messengers of Peace Heroes Award y quiénes pueden ser postulados?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 71,
        "ans": "**El Messengers of Peace Heroes Award es el máximo galardón juvenil internacional otorgado anualmente por la OMMS a voluntarios scouts que generan transformaciones excepcionales y duraderas en sus comunidades.**\n\n- **Elegibilidad:** scouts de **11 a 26 años** que hayan liderado proyectos individuales o en equipo con contribuciones directas a uno o más de los 17 Objetivos de Desarrollo Sostenible (ODS).\n- **Áreas de impacto reconocidas:** 1) *Medio Ambiente y Sostenibilidad*; 2) *Salud y Bienestar*; 3) *Paz y Participación Comunitaria*; 4) *Habilidades para la Vida*.\n- **Convocatoria:** la Oficina Scout Mundial abre anualmente una convocatoria global de nominaciones evaluadas por un comité internacional, con una ceremonia de reconocimiento de alto nivel.\n\n*Fuente oficial: World Scouting Awards y WOSM Messengers of Peace Awards Guidelines.*"
    },

    # -------------------------------------------------------------------------
    # 4. INICIATIVA EARTH TRIBE (TRIBU DE LA TIERRA) Y SUS TRES DESAFÍOS
    # -------------------------------------------------------------------------
    {
        "q": "¿Qué es la iniciativa Tribu de la Tierra (Earth Tribe) y cuál es su objetivo dentro de la OMMS y ASMAC?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 73,
        "ans": "**Earth Tribe (Tribu de la Tierra) es la plataforma de educación ambiental global de World Scouting diseñada para que niños, niñas, jóvenes y adultos enfrenten de manera decidida la crisis climática y la pérdida de biodiversidad.**\n\n- **Objetivos centrales:** 1) Frenar y revertir la pérdida de hábitats naturales; 2) Promover estilos de vida sostenibles y consumo responsable; 3) Fortalecer la adopción de energías limpias y la economía circular.\n- **Alineación en México:** se ubica en el Eje Temático de **Medio Ambiente y Sustentabilidad** del PJOS.\n- **Estructura:** comprende tres grandes desafíos mundiales (*Champions for Nature*, *Plastic Tide Turners* y *Scouts Go Solar*), unificados por el **Pin distintivo de la Tribu de la Tierra**.\n\n*Fuente oficial: Manual del Uniforme 2026, Art. 68 y guía Earth Tribe WOSM.*"
    },
    {
        "q": "¿Qué es el Pin de la Tribu de la Tierra, cómo se obtiene, dónde se coloca y cuánto tiempo se puede portar?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 73,
        "ans": "**De acuerdo con el Artículo 68 del Manual del Uniforme Junio 2026:**\n\n- **Dimensiones y diseño:** pin metálico circular de **35 mm de diámetro**, con el emblema de *Earth Tribe* en color blanco dentro de un círculo verde, y la Flor de Lis Mundial en blanco sobre fondo morado en la parte inferior.\n- **Criterio de obtención:** se entrega por **primera y única ocasión** cuando un scout completa con éxito cualquiera de las rutas de los tres programas: *Champions for Nature*, *Plastic Tide Turners* o *Scouts Go Solar*.\n- **Ubicación:** se coloca en la **solapa de la bolsa derecha de la camisola, del lado derecho de la solapa**.\n- **Permanencia vitalicia:** la o el scout puede portar este pin **durante el resto de su vida scout, incluso después de los 22 años y como Scouter o dirigente**, como testimonio permanente de su compromiso con la conservación del planeta.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Capítulo 03, Art. 68.*"
    },
    {
        "q": "¿Qué es el desafío Campeones por la Naturaleza (Champions for Nature) y quién es el socio global de WOSM (WWF)?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 73,
        "ans": "**Champions for Nature (Campeones por la Naturaleza) es un desafío ambiental mundial desarrollado en alianza estratégica entre World Scouting y el Fondo Mundial para la Naturaleza (WWF - World Wide Fund for Nature).**\n\n- **Propósito:** conectar a los jóvenes con el mundo natural, entender las complejas cadenas de biodiversidad y transformar sus hábitos personales de consumo para reducir la huella ecológica humana.\n- **Socio global:** WWF colaboró en el diseño pedagógico y científico de los contenidos, retos de campamento y proyectos comunitarios de conservación de especies y restauración de ecosistemas.\n- **Insignia:** presenta el perfil de un elefante que arroja agua, motivos vegetales en verde y azul que representan la vida y la flor de lis mundial en la parte inferior.\n\n*Fuente oficial: Manual del Uniforme 2026, Art. 68 y plataforma Champions for Nature WOSM/WWF.*"
    },
    {
        "q": "¿Cuáles son los dos retos de Campeones por la Naturaleza (Defensor de mejores decisiones y Líder de biodiversidad)?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 73,
        "ans": "**El programa Champions for Nature comprende dos retos complementarios (Manual del Uniforme 2026, Art. 68):**\n\n1. **Defensor de Mejores Decisiones (Better Choices Defender):** se enfoca en el consumo responsable, la alimentación sostenible, la reducción del desperdicio de alimentos y la compra ética de productos que no dañen ecosistemas vulnerables.\n2. **Líder de Naturaleza y Biodiversidad (Nature & Biodiversity Leader):** implica acciones directas de restauración ecológica, reforestación con flora nativa, protección de polinizadores, conservación de fauna silvestre y erradicación de especies invasoras.\n\n- **Obtención progresiva:** ambos retos se trabajan de manera secuencial o coordinada a través de un proyecto comunitario evaluado por el Consejo de Sección.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Art. 68.*"
    },
    {
        "q": "¿Qué significan los colores de borde por sección en Champions for Nature y qué representa el festón turquesa?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 74,
        "ans": "**El Manual del Uniforme 2026 (Art. 68) define un sistema de bordes para identificar la sección en la que se cumplió el reto:**\n\n- **Borde amarillo:** Manada de Lobatos.\n- **Borde verde:** Tropa de Scouts.\n- **Borde morado:** Rama Mayor (Comunidad de Caminantes y Clan de Rovers).\n- **Festón turquesa (doble logro):** cuando un scout completa **las dos rutas del programa** (*Defensor de mejores decisiones* y *Líder de biodiversidad*), la segunda insignia que recibe viene con un **borde exterior festoneado en color turquesa**, la cual sustituye a la anterior y certifica de manera visible que ha culminado con éxito ambos retos mundiales.\n- **Independencia de secciones:** el trabajo de estas insignias es formativo e independiente por sección; si se obtuvo en Comunidad, no se traspasa en automático al Clan, debiendo renovarse con el nivel de complejidad propio de la nueva sección.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Capítulo 03, Art. 68.*"
    },
    {
        "q": "¿En qué consiste el Desafío Marea de Plásticos (Plastic Tide Turners Challenge) en alianza con ONU Medio Ambiente (UNEP)?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 74,
        "ans": "**Plastic Tide Turners (Marea de Plásticos) es un movimiento juvenil y desafío mundial creado por el Programa de las Naciones Unidas para el Medio Ambiente (PNUMA / UNEP) en alianza con World Scouting.**\n\n- **Misión:** movilizar a la juventud mundial para frenar la marea de contaminación por plásticos de un solo uso en ríos, lagos, costas y océanos.\n- **Diseño de la insignia:** parche circular blanco de 40 mm con una ola azul que arrastra residuos plásticos en blanco, sostenida por dos manos blancas que simbolizan la acción colectiva para limpiar los ecosistemas acuáticos, rodeado por tres estrellas azules.\n- **Ubicación:** se coloca arriba de la bolsa derecha de la camisola, sobre el escudo de *Scouts de México*.\n\n*Fuente oficial: Manual del Uniforme 2026, Art. 68 y plataforma UNEP Tide Turners Challenge.*"
    },
    {
        "q": "¿Cuáles son los tres niveles del Desafío Marea de Plásticos (Entrada, Líder y Campeón) y qué actividades implican?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 74,
        "ans": "**El desafío Plastic Tide Turners se estructura en tres niveles pedagógicos progresivos:**\n\n1. **Nivel de Entrada (Entry Level):** el scout realiza una auditoría personal y doméstica de plásticos durante al menos 2 semanas, identifica plásticos innecesarios (bolsas, botellas, pajillas/popotes) y adopta alternativas reutilizables.\n2. **Nivel Líder (Leader Level):** organiza a su patrulla, equipo o comunidad escolar para llevar a cabo una campaña educativa, auditoría de residuos en el local de grupo o una jornada comunitaria de recolección y reciclaje.\n3. **Nivel Campeón (Champion Level):** promueve un cambio sistémico incidiendo ante autoridades locales, comercios o centros comunitarios para eliminar plásticos desechables, o crea alianzas con centros de reciclaje formal.\n\n*Fuente oficial: Guía Pedagógica Plastic Tide Turners Challenge (UNEP / WOSM) y Manual del Uniforme 2026.*"
    },
    {
        "q": "¿En qué consiste el desafío Scouts Go Solar, con qué organización se desarrolló (Solafrica) y qué enseña sobre cocina y hornos solares?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 74,
        "ans": "**Scouts Go Solar es una iniciativa ambiental de World Scouting desarrollada en alianza con la ONG suiza Solafrica y el Centro Scout Internacional de Kandersteg (KISC).**\n\n- **Objetivo:** empoderar a los scouts en el conocimiento práctico y aprovechamiento de la energía solar como fuente renovable y limpia para combatir el cambio climático.\n- **Aprendizajes prácticos:**\n  - Construcción de **cocinas solares parabólicas y cajas térmicas solares** para cocinar alimentos en campamento sin quemar leña ni combustibles fósiles.\n  - Fabricación de calentadores solares de agua con botellas PET recicladas.\n  - Manejo de paneles solares fotovoltaicos para iluminación y carga de dispositivos en campismo de baja huella ecológica.\n- **Insignia oficial:** parche circular morado de 40 mm con una tienda de campaña scout equipada con paneles solares, un horizonte amarillo que simboliza el sol y la flor de lis mundial en blanco.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Art. 68 y manual Scouts Go Solar (Solafrica / WOSM).*"
    },

    # -------------------------------------------------------------------------
    # 5. RECONOCIMIENTO SCOUTS DEL MUNDO (SCOUTS OF THE WORLD AWARD - SWA)
    # -------------------------------------------------------------------------
    {
        "q": "¿Qué es el Reconocimiento Scouts del Mundo (Scouts of the World Award - SWA) y quiénes pueden aspirar a él?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 77,
        "ans": "**El Reconocimiento Scouts del Mundo (Scouts of the World Award - SWA / RSDM) es el máximo galardón internacional del Programa de Jóvenes de la OMMS para las secciones mayores.**\n\n- **Población elegible:** jóvenes de **15 a 26 años**, abarcando en México a la **Comunidad de Caminantes y al Clan de Rovers**, así como a jóvenes no scouts que participen en los talleres avalados por una Base Scouts del Mundo.\n- **Origen:** creado formalmente en 2004 en alianza con las Naciones Unidas para movilizar a la juventud en torno a los Objetivos de Desarrollo del Milenio (hoy ODS).\n- **Trascendencia:** prepara a los jóvenes para convertirse en ciudadanos del mundo capaces de analizar problemas globales complejos y ejecutar proyectos de alto impacto social.\n\n*Fuente oficial: Manual del Uniforme 2026, Art. 71 y World Scouting SWA Guidelines.*"
    },
    {
        "q": "¿Cuáles son los tres campos de acción del Reconocimiento Scouts del Mundo (Desarrollo, Paz y Medio Ambiente)?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 77,
        "ans": "**Todo proyecto del Reconocimiento Scouts del Mundo debe enmarcarse en uno o varios de los tres campos de acción definidos por la OMMS:**\n\n1. **Desarrollo:** proyectos orientados a erradicar la pobreza, mejorar la educación, fomentar el empleo juvenil digno, fortalecer infraestructuras comunitarias y reducir desigualdades sociales (alineado a los ODS 1, 2, 4, 8 y 10).\n2. **Paz:** iniciativas para prevenir la violencia, mediar en conflictos juveniles, promover el diálogo intercultural o interreligioso, defender derechos humanos y acoger a comunidades vulnerables (ODS 16).\n3. **Medio Ambiente:** acciones directas sobre conservación de biodiversidad, agua potable, saneamiento, transición hacia energías limpias y mitigación del cambio climático (ODS 6, 7, 13, 14 y 15).\n\n*Fuente oficial: Manual del Uniforme 2026, Art. 71 y WOSM SWA Guidelines.*"
    },
    {
        "q": "¿Cuáles son las tres etapas obligatorias para obtener el Reconocimiento Scouts del Mundo (Descubrimiento, Servicio Voluntario y Red)?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 77,
        "ans": "**El proceso para obtener el Reconocimiento Scouts del Mundo comprende tres fases indispensables:**\n\n1. **Descubrimiento Scouts del Mundo (SWA Discovery):** experiencia formativa intensiva de **mínimo 21 horas laborables** organizada en una Base Scouts del Mundo o evento avalado, donde los jóvenes exploran problemáticas locales, visitan instituciones y formulan un plan de proyecto comunitario viable.\n2. **Servicio Voluntario Scouts del Mundo (SWA Voluntary Service):** ejecución individual o en equipo de un proyecto comunitario planificado con una dedicación de **al menos 80 horas de trabajo efectivo**, enfocado en Desarrollo, Paz o Medio Ambiente.\n3. **Red Scouts del Mundo (SWA Network):** presentación de reportes formales a la Organización Scout Nacional y a la OMMS. Tras ser validado, el joven recibe su insignia, pin y diploma oficial, integrándose a la red mundial de líderes juveniles de World Scouting.\n\n*Fuente oficial: Manual del Uniforme 2026, Art. 71 y plataforma WOSM SWA.*"
    },
    {
        "q": "¿Cuáles son las dimensiones, diseño oficial y ubicación en el uniforme de la insignia y el pin de Scouts del Mundo?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 77,
        "ans": "**El Artículo 71 del Manual del Uniforme Junio 2026 detalla las características oficiales de ambos distintivos:**\n\n- **Insignia de tela bordada (60 mm de diámetro):** circular, con fondo morado y borde rojo con puntos blancos. En letras mayúsculas se lee *«SCOUTS OF THE WORLD AWARD»* (arriba) y *«RECONOCIMIENTO SCOUTS DEL MUNDO»* (abajo). Al interior, sobre un mapa mundial blanco, contiene cuatro símbolos: paloma blanca en círculo rojo (Paz), rombo rojo en cuatro partes (Desarrollo), brote blanco en círculo rojo (Medio Ambiente) y la Flor de Lis Mundial blanca al centro. Se coloca **arriba de la bolsa derecha de la camisola**.\n- **Pin metálico distintivo (35 mm de diámetro):** fabricado en acero con el mismo diseño gráfico. Se coloca en la **solapa derecha de la camisola, del lado derecho**.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Capítulo 03, Art. 71.*"
    },

    # -------------------------------------------------------------------------
    # 6. DIÁLOGO POR LA PAZ, DIÁLOGO INTERRELIGIOSO Y PATRIMONITO
    # -------------------------------------------------------------------------
    {
        "q": "¿Qué es la insignia de Diálogo por la Paz, con qué institución se creó (KAICIID) y qué simbolizan sus tres figuras humanas?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 72,
        "ans": "**Diálogo por la Paz (Dialogue for Peace) es un programa internacional creado en alianza entre World Scouting y el Centro Internacional de Diálogo (KAICIID).**\n\n- **Objetivo:** brindar a los scouts herramientas metodológicas para la escucha activa, comprensión intercultural y facilitación de círculos de diálogo frente a divergencias culturales o comunitarias.\n- **Diseño de la insignia (Art. 65):** ovoide de 40 x 30 mm en verde claro con un bocadillo/cuadro de diálogo blanco que contiene **tres figuras humanas tomadas de las manos en color verde, amarillo y morado**, con la Flor de Lis Mundial al costado derecho.\n- **Significado de las figuras:** representa la convivencia pacífica, la solidaridad entre diferentes culturas y la convicción de que el diálogo supera cualquier prejuicio.\n- **Ubicación:** arriba de la bolsa derecha de la camisola.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Capítulo 03, Art. 65.*"
    },
    {
        "q": "¿En qué consiste la insignia de Diálogo Interreligioso y qué simboliza el faro morado en su diseño?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 72,
        "ans": "**El programa de Diálogo Interreligioso de la OMMS promueve el respeto recíproco, la libertad espiritual y el entendimiento fraternal entre personas de diversas confesiones religiosas dentro de la gran hermandad scout.**\n\n- **Diseño técnico (Art. 66):** parche ovoide de **40 mm de ancho x 30 mm de alto**, fondo blanco, borde con el color correspondiente a la sección y un **faro en color morado** en el centro.\n- **Simbología del faro:** simboliza la luz de la espiritualidad, la guía de la conciencia moral y la fraternidad que ilumina el camino en medio de la diversidad de credos.\n- **Ubicación:** se coloca arriba de la bolsa derecha de la camisola, sobre el emblema de *Scouts de México*.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Art. 66.*"
    },
    {
        "q": "¿Qué es la insignia de Patrimonito, qué representa este personaje y cuál es la alianza entre WOSM y la UNESCO?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 72,
        "ans": "**Patrimonito es el guardián infantil y juvenil del patrimonio mundial, concebido en 1995 por jóvenes durante un taller de la UNESCO y adoptado por World Scouting en el marco de su alianza internacional.**\n\n- **Objetivo:** sensibilizar a las y los scouts sobre la preservación activa de los monumentos históricos, sitios arqueológicos y reservas ecológicas inscritas en la Lista del Patrimonio Mundial de la UNESCO.\n- **Diseño oficial (Art. 67):** parche en forma de **rombo de 40 x 40 mm**. Muestra al personaje Patrimonito en trazos redondeados, integrando los logotipos y colores de la UNESCO (azul) y de la OMMS (morado), con un atardecer en tonos naranja, rojo y verde que representa la vitalidad y energía de la juventud.\n- **Bordes por sección:** amarillo para Manada, verde para Tropa y morado para Rama Mayor.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Art. 67.*"
    },

    # -------------------------------------------------------------------------
    # 7. INICIATIVAS LIFE LEADERS Y HEALTH ALLIES
    # -------------------------------------------------------------------------
    {
        "q": "¿Qué es la iniciativa Life Leaders (Habilidades para la Vida) y qué significan el timón y la brújula en su diseño?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 75,
        "ans": "**Life Leaders es una iniciativa mundial de la OMMS alineada al área de Habilidades para la Vida (*Skills for Life*), desarrollada para preparar a los jóvenes ante los desafíos laborales, tecnológicos y sociales del siglo XXI.**\n\n- **Diseño y simbología (Art. 69):** insignia circular de 40 mm con iconografía roja que combina un **timón de barco y una brújula**, simbolizando la capacidad de orientar el propio rumbo vital y ejercer un liderazgo ético con autodeterminación.\n- **Desafíos que comprende:**\n  - *Impact Innovators Challenge:* emprendimiento social, creatividad digital y soluciones innovadoras ante problemáticas locales.\n  - *EQ in Action Challenge:* desarrollo de inteligencia emocional, empatía, resiliencia y trabajo colaborativo.\n- **Ubicación:** arriba de la bolsa derecha de la camisola.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Art. 69.*"
    },
    {
        "q": "¿Qué es la iniciativa Health Allies (Salud y Bienestar) y cuáles son sus desafíos (Challenge Nutrition y Mind Builders)?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 76,
        "ans": "**Health Allies es la iniciativa global de World Scouting enfocada en el bienestar físico, mental y emocional de niños, niñas, jóvenes y líderes adultos (ODS 3).**\n\n- **Diseño distintivo (Art. 70):** círculo de 40 mm en color naranja que muestra una figura humana que a la vez florece a partir de un corazón latiendo.\n- **Desafíos oficiales:**\n  - **Challenge Nutrition:** educación alimentaria, hábitos nutricionales saludables, hidratación correcta y erradicación del sobrepeso o la desnutrición en comunidades scouts.\n  - **Mind Builders Challenge:** bienestar mental, prevención del estrés y la ansiedad, fortalecimiento de la autoestima y construcción de redes de apoyo emocional entre pares.\n- **Ubicación:** colocación arriba de la bolsa derecha de la camisola.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Art. 70.*"
    },

    # -------------------------------------------------------------------------
    # 8. INSIGNIA DE MADERA (WOOD BADGE)
    # -------------------------------------------------------------------------
    {
        "q": "¿Qué es la Insignia de Madera (Wood Badge), cuándo fue creada por Baden-Powell y cuál es su significado mundial?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 91,
        "ans": "**La Insignia de Madera (Wood Badge) es el estándar y reconocimiento de formación más prestigioso y emblemático del Movimiento Scout para adultos, creado por Robert Baden-Powell en septiembre de 1919 en Gilwell Park, Inglaterra.**\n\n- **Propósito:** acreditar la culminación exitosa de la capacitación formal en liderazgo educativo, método scout y gestión de grupos, facultando a Scouters y Dirigentes para acompañar a las secciones infantiles y juveniles con calidad pedagógica.\n- **Tradición centenaria:** celebrados sus 100 años en 2019, la Insignia de Madera hermana a los líderes scouts de todos los países bajo una misma mística y estándar común.\n- **Pertenencia a Gilwell:** quien obtiene la Insignia de Madera ingresa automáticamente como miembro de por vida del **1st Gilwell Park Scout Group**.\n\n*Fuente oficial: Manual del Uniforme 2026, Art. 86 y manuales oficiales de formación de la OMMS.*"
    },
    {
        "q": "¿De dónde provienen históricamente los maderos de la Insignia de Madera y qué papel tuvo el collar del jefe zulú Dinizulu?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 91,
        "ans": "**El origen material de los maderos se remonta a la estancia de Baden-Powell en el sur de África a finales del siglo XIX:**\n\n- **El collar de Dinizulu:** durante la campaña en Zululandia (1888), B-P halló el collar ceremonial de cuentas de madera de acacia tallada perteneciente al rey zulú Dinizulu.\n- **Las primeras insignias de 1919:** en el primer curso para dirigentes en Gilwell Park (1919), B-P tomó dos cuentas del collar original ensartadas en un cordón de cuero de zapato para entregarlas a cada graduado.\n- **Acto de restitución histórica (1987):** en 1987, cuatro cuentas originales de la Insignia de Madera fueron entregadas solemnemente al nieto de Dinizulu en Sudáfrica como acto de devolución y reconciliación histórica.\n- **Maderos actuales:** hoy en día se tallan en madera de acacia respetando la forma y medidas tradicionales.\n\n*Fuente oficial: WOSM Scouting's History y Manual del Uniforme 2026, Art. 86.*"
    },
    {
        "q": "¿Qué significan los dos, tres y cuatro maderos en la Insignia de Madera según el Esquema de Adultos en el Movimiento Scout?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 91,
        "ans": "**El número de cuentas de madera ensartadas en el cordón de cuero sobre la pañoleta distingue el grado y nombramiento de adiestramiento de cada adulto (Manual del Uniforme 2026, Art. 86):**\n\n- **Dos maderos (2 beads):** otorgados a todo Scouter o Dirigente debidamente certificado que completó satisfactoriamente su esquema de formación en su rama. **Su derecho de uso es permanente y vitalicio**.\n- **Tres maderos (3 beads):** corresponden a los **Formadores** de adultos en el Movimiento Scout, siempre y cuando mantengan su certificación vigente conforme al Esquema Nacional de Adultos en el Movimiento Scout (AMS).\n- **Cuatro maderos (4 beads):** corresponden a los **Directores de Formación**, con nombramiento y certificación vigente otorgada por la Comisión Nacional de Adultos en el Movimiento Scout.\n- *(Histórico: 6 maderos fueron portados únicamente por Baden-Powell y por el Jefe de Campo de Gilwell Park / Director de Formación Mundial).* \n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Capítulo 04, Art. 86.*"
    },
    {
        "q": "¿Qué es la Pañoleta de Gilwell, por qué lleva el tartán MacLaren y cuándo tienen derecho a usarla los Scouters?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 91,
        "ans": "**La Pañoleta de Gilwell (Gilwell Scarf) es la pañoleta distintiva universal de los poseedores de la Insignia de Madera:**\n\n- **Color y confección:** pañoleta triangular de color **rosa pálido / gris rosáceo en el exterior y naranja ladrillo en su cara interior** (simbolizando la humildad y la ceniza de fogata).\n- **Tartán MacLaren:** lleva cosido en la punta trasera un trozo de tela con el tartán escocés del Clan MacLaren, en homenaje de gratitud a **W.F. de Bois MacLaren**, filántropo escocés que en 1919 donó los fondos para adquirir la finca de Gilwell Park para el adiestramiento scout.\n- **Reglas de uso:** se porta **sin anudar las puntas**, sujeta exclusivamente con el Nudo de Gilwell. Solo se utiliza durante actividades específicas de formación de adultos a nivel provincia o nacional, o reuniones del Grupo Scout 1 de Gilwell.\n\n*Fuente oficial: Manual del Uniforme Actualizado Junio 2026, Art. 86.*"
    },
    {
        "q": "¿Qué es el Nudo de Gilwell (cabeza de turco) y cómo debe elaborarlo el Scouter que obtiene la Insignia de Madera?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 91,
        "ans": "**El Nudo de Gilwell (Gilwell Woggle) es el pasador oficial que sujeta la Pañoleta de Gilwell:**\n\n- **Elaboración tradicional:** confeccionado con una tira circular de **cuero natural trenzada en forma de nudo cabeza de turco de dos vueltas**.\n- **Principio de autosuficiencia:** la tradición mundial marca que **el propio Scouter debe tejerlo con sus propias manos** en el momento en que cumple los requisitos de su etapa de adiestramiento.\n- **Simbología:** al ser un nudo sin principio ni fin visible, simboliza la continuidad del servicio voluntario y el compromiso ininterrumpido con la formación de la juventud.\n\n*Fuente oficial: Manual del Uniforme 2026, Art. 86 y tradiciones de Gilwell Park.*"
    },

    # -------------------------------------------------------------------------
    # 9. EL LOBO DE BRONCE (BRONZE WOLF AWARD)
    # -------------------------------------------------------------------------
    {
        "q": "¿Qué es el Lobo de Bronce (Bronze Wolf Award) y por qué es la máxima y única condecoración del Comité Scout Mundial?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 92,
        "ans": "**El Lobo de Bronce (Bronze Wolf Award) es el más alto honor y la única condecoración oficial otorgada por el Comité Scout Mundial (World Scout Committee).**\n\n- **Naturaleza del premio:** reconoce los servicios y contribuciones extraordinarias, desinteresadas y de impacto internacional brindadas al Movimiento Scout Mundial.\n- **Exclusividad mundial:** desde su institución en 1935 y en casi 90 años de historia, **solo cerca de 400 personas en todo el mundo** han sido condecoradas con el Lobo de Bronce, lo que refleja su rigor y prestigio supremo.\n- **Presea física:** figura de un lobo fundido en bronce sostenido por una cinta verde con dos franjas amarillas cerca de los bordes, portée al cuello en actos solemnes internacionales.\n\n*Fuente oficial: WOSM Bronze Wolf Award Registry y Manual del Uniforme 2026, Art. 86.*"
    },
    {
        "q": "¿Cuál es la historia del Lobo de Bronce, en qué año fue instituido por Baden-Powell y a cuántas personas se ha otorgado?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 92,
        "ans": "**La historia del Lobo de Bronce se remonta a los primeros años de expansión internacional del Escultismo:**\n\n- **Del Lobo de Plata al Lobo de Bronce:** en los inicios, Baden-Powell entregaba el *Lobo de Plata* (Silver Wolf) a dirigentes destacados. Sin embargo, al ser el Lobo de Plata una condecoración nacional de la asociación británica, B-P solicitó crear un reconocimiento estrictamente universal.\n- **Institución en 1935:** en la 8° Conferencia Scout Mundial celebrada en Estocolmo (Suecia) en 1935, el Comité Scout Mundial aprobó unánimemente instituir el **Lobo de Bronce**. El primer ejemplar le fue otorgado al propio Robert Baden-Powell.\n- **Registro histórico:** la condecoración se concede de manera muy estricta (apenas un promedio de 4 a 5 condecoraciones por trienio), habiéndose entregado a unas 400 personalidades globales que han dedicado su vida a los ideales de hermandad de World Scouting.\n\n*Fuente oficial: WOSM Archives y Bronze Wolf Award History.*"
    },

    # -------------------------------------------------------------------------
    # 10. EVENTOS Y REDES MUNDIALES (JOTA-JOTI, JAMBOREE, MOOT, BP FELLOWSHIP)
    # -------------------------------------------------------------------------
    {
        "q": "¿Qué es el JOTA-JOTI (Jamboree on the Air & Jamboree on the Internet) y cómo se obtiene su insignia anual oficial?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 71,
        "ans": "**El JOTA-JOTI (Jamboree en el Aire y Jamboree en Internet) es el evento scout digital y de radioafición más grande del planeta, celebrado anualmente durante el tercer fin de semana completo de octubre.**\n\n- **Participación:** reúne a más de 700,000 scouts de 170 países a través de frecuencias de radioafición, salas de chat, plataformas seguras de videojuegos educativos y talleres virtuales.\n- **Obtención de la insignia anual:** cada año la OMMS emite un diseño conmemorativo oficial único. Para obtenerla, los scouts se registran en `jotajoti.info`, completan su carnet de actividades de ciudadanía global, participan en el programa *Hike the Planet* y acreditan el módulo de seguridad en línea *A Salvo del Peligro (Safe from Harm)*.\n- **Uso en el uniforme:** se porta como insignia de evento en la camisola durante el periodo que autorice la normativa nacional.\n\n*Fuente oficial: World Scouting JOTA-JOTI Reports y Manual del Uniforme ASMAC.*"
    },
    {
        "q": "¿Cuáles fueron los resultados e impacto global del JOTA-JOTI 2026 según el reporte oficial de la OMMS?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 71,
        "ans": "**El JOTA-JOTI 2026 se celebró del 16 al 18 de octubre de 2026 bajo el lema mundial «A Peaceful and Inclusive World» (Un Mundo Pacífico e Inclusivo):**\n\n- **Cifras oficiales de participación:** más de **720,000 scouts registrados** pertenecientes a **170 Organizaciones Scouts Nacionales**.\n- **Hito Hike the Planet:** en el reto global al aire libre *Hike the Planet*, los scouts superaron la meta de dar la vuelta completa a la circunferencia de la Tierra, acumulando colectivamente **más de 47,100 kilómetros** registrados en caminatas y servicios comunitarios.\n- **Espacio Seguro:** se consolidó el Centro de Seguridad Digital con moderación 24/7 y la insignia digital de embajador de la paz.\n\n*Fuente oficial: Comunicado oficial WOSM: «Scouts around the world connect, explore, and take action at JOTA-JOTI 2026» (21 de octubre de 2026).*"
    },
    {
        "q": "¿Qué es la insignia de contingente del Jamboree Scout Mundial y qué se sabe del 26° Jamboree en Polonia 2027 (Gdańsk)?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 71,
        "ans": "**El 26° Jamboree Scout Mundial (26th World Scout Jamboree) se celebrará en la isla de Sobieszewo, Gdańsk (Pomorskie, Polonia), del 30 de julio al 10 de agosto de 2027.**\n\n- **Lema oficial:** *«Bravely»* («Con valentía / Valientemente»).\n- **Participantes:** reunirá a más de 50,000 jóvenes scouts de 14 a 17 años de todo el mundo, junto con el Equipo Internacional de Servicio (EIS / IST) de adultos y Rovers.\n- **Insignia oficial de contingente:** cada contingente nacional (como el de México) diseña una insignia conmemorativa oficial de delegación aprobada por la Dirección Internacional, que se porta en el uniforme durante el periodo previo, durante el evento y hasta un año después de concluido.\n\n*Fuente oficial: 26th World Scout Jamboree Poland 2027 Official Bulletin y WOSM Jamboree Guidelines.*"
    },
    {
        "q": "¿Qué es el World Scout Moot y cuál es la sede y lema del 17° World Scout Moot Taiwán 2029?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 71,
        "ans": "**El World Scout Moot es el campamento mundial oficial de la OMMS para jóvenes adultos de 18 a 25 años (Rama Rover).**\n\n- **17° World Scout Moot:** se llevará a cabo en **Taiwán en el año 2029**, organizado por *The General Association of Scouts of China (TGASC)* tras 25 años desde que albergaron el 12° Moot en 2004.\n- **Lema oficial:** *«Bare Necessities»* (Lo más elemental / Lo estrictamente necesario), orientado a la sustentabilidad radical, el desapego material, la comunión con la naturaleza y la implementación directa de los 17 ODS.\n- **Estructura del evento:** patrullas internacionales donde rovers de diferentes países conviven y exploran senderos culturales antes de reunirse en el campamento base central.\n\n*Fuente oficial: 17th World Scout Moot Taiwan 2029 Official Portal.*"
    },
    {
        "q": "¿Qué es la Baden-Powell Fellowship (BP Fellowship) de la Fundación Scout Mundial y qué representa su insignia?",
        "cat": "Insignias Mundiales (WOSM)",
        "doc_id": "doc-0128",
        "doc": "01 Manual del Uniforme Actualizado Junio 2026.pdf",
        "page": 71,
        "ans": "**La Baden-Powell Fellowship (World BP Fellowship) es la fraternidad benefactora de la Fundación Scout Mundial (World Scout Foundation - WSF):**\n\n- **Misión:** proveer financiamiento permanente y becas a proyectos de desarrollo comunitario scout en países vulnerables. La Fundación es presidida con carácter honorífico por el Rey Carlos XVI Gustavo de Suecia.\n- **Membresía:** reúne a miles de benefactores y *Young BP Fellows* de más de 86 países y territorios comprometidos con impulsar el crecimiento del Escultismo en comunidades de escasos recursos.\n- **Insignia oficial:** distintivo con el histórico apretón scout de mano izquierda entrelazado con la Flor de Lis Mundial en metal dorado.\n\n*Fuente oficial: World Scout Foundation (WSF) y BP Fellowship Documentation.*"
    }
]

def main():
    if not os.path.exists(FAQ_PATH):
        print(f"Error: no existe {FAQ_PATH}")
        return

    with open(FAQ_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    existing_questions = data.get("questions", [])
    seen_qs = set()
    for q in existing_questions:
        seen_qs.add(q["q"].strip().lower())

    added_count = 0
    for nq in NUEVAS_PREGUNTAS:
        q_text = nq["q"].strip().lower()
        if q_text not in seen_qs:
            existing_questions.append(nq)
            seen_qs.add(q_text)
            added_count += 1
        else:
            # Actualizar respuesta existente si ya estaba
            for idx, eq in enumerate(existing_questions):
                if eq["q"].strip().lower() == q_text:
                    existing_questions[idx] = nq
                    break

    data["questions"] = existing_questions
    data["total_questions"] = len(existing_questions)
    data["version"] = "4.0"

    with open(FAQ_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Listo: Se agregaron/actualizaron {added_count} preguntas sobre Insignias Mundiales.")
    print(f"Total de preguntas en faq_v3.json: {len(existing_questions)}")

if __name__ == "__main__":
    main()
