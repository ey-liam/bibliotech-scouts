#!/usr/bin/env python3
"""
Ingesta integral RECME + Help Desk SISAS/CONECTA + Especialidades FES + Plantillas PJOS (Corte 11/11/2026).

Lee los 65 PDFs canónicos (sin duplicados tipo (1)/(2) ni archivos ajenos),
genera portadas JPG en covers/, textos normalizados en data/text/,
guías HTML autónomas y limpias (con capturas embebidas) en files/,
activos gráficos oficiales clave, e indexa todo en data/catalog.json y data/chunks.json
con categorías y subcategorías estructuradas.
"""

import base64
import hashlib
import html
import json
import os
import re
import shutil
from collections import Counter
from pathlib import Path

from PIL import Image
import pypdfium2 as pdfium

REPO = Path(r"C:\Users\liamc\bibliotech-scouts")
DATA_DIR = REPO / "data"
TEXT_DIR = DATA_DIR / "text"
COVERS_DIR = REPO / "covers"
FILES_DIR = REPO / "files"

SCRATCH = Path(
    r"C:\Users\liamc\.gemini\antigravity\brain\dc865d9a-effc-4438-a5e0-8b8b7edae51e\scratch"
)
DOWNLOADS_RECME = Path(r"C:\Users\liamc\Downloads\recme.scouts.org.mx")
RELEASE_STAGE_DIR = SCRATCH / "release_v1_upload"

MAX_WEB_BYTES = int(2.5 * 1024 * 1024)
CUTOFF_DATE = "2026-11-11"
CUTOFF_DISPLAY = "11 de noviembre de 2026"

MONTHS_ES = {
    "enero": 1,
    "febrero": 2,
    "feb": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "may": 5,
    "junio": 6,
    "jun": 6,
    "julio": 7,
    "jul": 7,
    "agosto": 8,
    "septiembre": 9,
    "sep": 9,
    "octubre": 10,
    "oct": 10,
    "noviembre": 11,
    "dic": 12,
    "diciembre": 12,
}

# ---------------------------------------------------------------------------
# Transcripciones visuales verificadas de PDFs vectoriales / de imagen y tablas
# ---------------------------------------------------------------------------
VISUAL_SUPPLEMENTS = {
    "P3.1_MLLMiLibroSeeonee_v1.1.pdf": """[CONTENIDO VISUAL COMPLETO DEL CUADERNILLO RECORTABLE (6 PÁGINAS)]
Título: Mi Libro del Seeonee (Manada de Lobeznas y Lobatos — ASMAC PJOS).

Página 1 (Portada, contraportada y Oración):
- Mensaje de bienvenida: "Hola, Lobato/Lobezna. Te damos la bienvenida a tu Libro del Seeonee. En este libro vas a compartir y atesorar tus rastros por la selva. Esta página son tu portada y contraportada. Ponle tu nombre de selva y dibújate, para que todos sepan identificarlo. Descubre el resto de las instrucciones para terminar de armarlo en compañía de tus Viejos Lobos te acompañan en esta cacería."
- Etiqueta de pertenencia: "Este Libro del Seeonee pertenece a:" y "Fecha en que aprendí la oración: [recuadro]".
- ORACIÓN DE LA MANADA: "Dulce y buen señor mío, enséñame a ser humilde y bondadoso, a imitar tu ejemplo, a amarte con todo mi corazón y a seguir el camino que me ha de llevar junto a ti. Así sea."
- Portada ilustrada con cabeza de lobo y espacios silueteados de huellas/insignias para pegar.

Página 2 (Instrucciones de armado y hojas 1–4):
- "¡Ojos y oídos bien abiertos! Durante tu cacería, lee con atención estas instrucciones y sigue las indicaciones de tu Viejo Lobo para hacer ¡Siempre lo mejor!"
- Instructivo paso a paso:
  1. Imprime las páginas 2, 3 y 4 en papel opalina tamaño carta o papel normal tamaño carta.
  2. Pega sobre cartón delgado (como el de la caja del cereal).
  3. El resto de las páginas puedes imprimirlas y usarlas en papel normal tamaño carta.
- Convención de trazos: Líneas punteadas = se recortan. Líneas corridas = se doblan. Zonas sombreadas ("Doblar y pegar 5", "Doblar y pegar 6") = se pegan con su número gemelo.
- Ilustración de la Roca del Consejo con lobatos de colores y selva tropical.

Página 3 (Cazaderos Bagheera y Hermano Gris — "Mis dentelladas"):
- Cazadero Bagheera (Medio Ambiente y Sustentabilidad) — "Usa las huellas para marcar tu rastro" (Columnas: Quiero Aprender / lo estoy aprendiendo | Ya lo aprendí):
  1. "Sé que la naturaleza es muy importante porque me da lo que necesito para vivir, y por eso debo cuidarla."
  2. "Reconozco las cosas valiosas de la naturaleza, como los animales, las plantas y los lugares donde viven, porque todos forman parte de la vida del planeta y debemos cuidarlos."
  3. "Sé qué hacer para cuidar la naturaleza y cómo tratar bien el lugar donde vivimos."
- Cazadero Hermano Gris (Paz y Participación Comunitaria) — "Usa las huellas para marcar tu rastro":
  1. "Sé que es importante llevarme bien con los demás y siempre trato de ser una persona amable."
  2. "Aprendo a trabajar con mis amigas y amigos y a ayudar para que todo salga bien."
  3. "Aprendo a conocer y respetar a las personas y las tradiciones de mi comunidad."

Página 4 (Pliego interior Pega 7 / Pega 8 y logos de Iniciativas):
- Secciones 5, 7, 8 y 9 con insignias de Scouts Go Solar, Plastic Tide Turners, Mensajeros de la Paz, Campeones por la Naturaleza y el hexágono de Compromiso Ciudadano.

Página 5 (Cazaderos Baloo y Raksha — "Mis dentelladas"):
- Cazadero Baloo (Habilidades para la Vida) — "Usa las huellas para marcar tu rastro":
  1. "Me doy cuenta de en qué soy buena o bueno y qué cosas me gusta hacer."
  2. "Puedo tomar decisiones por mí siendo responsable."
  3. "Aprendo a guiar un grupo de amigas y amigos y me esfuerzo por hacerlo cada vez mejor."
- Cazadero Raksha (Salud y Bienestar) — "Usa las huellas para marcar tu rastro":
  1. "Sé que acciones debo realizar y qué alimentos debo comer para mantenerme saludable."
  2. "Sé que moverme, jugar y hacer ejercicio, me ayuda a estar sana o sano, fuerte y sentirme bien."
  3. "Sé cómo me siento y lo digo; también estoy aprendiendo a hacer cosas que me ayudan a estar tranquila/tranquilo y contenta/contento."

Página 6 (Planilla de stickers e insignias recortables):
- Contiene emblemas de los 4 Cazaderos (Raksha, Baloo, Bagheera, Hermano Gris), insignias de progreso en los 4 ejes temáticos, 20 huellas de lobato, Compromiso Ciudadano, Mensajeros de la Paz, Scouts Go Solar, Plastic Tide Turners, Campeones por la Naturaleza y Tribu de la Tierra.""",

    "P3.2TS_MapaExploraciones_V1.2.pdf": """[CONTENIDO VISUAL COMPLETO DEL MAPA PLEGABLE (6 PÁGINAS)]
Título: Mi Mapa de Exploraciones (Tropa de Scouts — ASMAC PJOS).

Página 1 (Portada, Oración de la Tropa y patrulla):
- Portada: "Mi mapa de exploraciones" | "Mi nombre es: [recuadro]".
- Espacios superiores: "Mis cintas de patrulla" y "Mi firma de patrulla".
- Espacio inferior: "Mi banderín de patrulla", rodeado por la ORACIÓN DE LA TROPA SCOUT: "Enséñame a ser generos__, a servirte como lo mereces, a dar sin medida, a combatir sin temor a que me hieran, a trabajar sin descanso y a no buscar más recompensa que saber que hago tu voluntad."
- Secciones gráficas del mapa: Rumbo Quetzal, Rumbo Tortuga Lora, Rumbo Ocelote, Rumbo Venado Cola Blanca y pestaña A.

Página 2 (Mapa central):
- Ilustración central de la insignia terminal Águila Real, acompañada de Mensajeros de la Paz, Tribu de la Tierra, tres flores de lis de progresión ("Siempre Listos"), Punta de Flecha y emblemas de vida al aire libre/montaña, con pestañas C, D, E, F.

Página 3 (Pliego derecho de ejes e iniciativas):
- Emblemas de Campeones por la Naturaleza, Scouts Go Solar, Plastic Tide Turners, Flor de Lis Mundial rodeada por los 4 animales guía de los Rumbos (Quetzal, Tortuga Lora, Venado Cola Blanca, Ocelote) y pestaña B.

Página 4 (Instrucciones generales de armado y uso):
- Mensaje de bienvenida: "Te damos la bienvenida, Scout, a tu Mapa de exploraciones. En este espacio vas a poder darle seguimiento al Rumbo que decidas tomar. Cada paso podrás registrarlo de forma individual y según tus propios objetivos, sueños y metas. Este mapa está diseñado para que te acompañe durante toda tu aventura en la Tropa Scout. Asegúrate de seguir las instrucciones para que tenga el tamaño perfecto, te acompañe en tu equipo de bolsillo y lo lleves siempre contigo. Esta aventura comienza armando tu mapa en compañía de tu Tropa y Scouter(s) y recuerda estar ¡Siempre Listo!"
- Convenciones de armado: Líneas punteadas se recortan; líneas corridas se doblan; zonas sombreadas pegan letras gemelas (A–F).
- Instrucciones de uso en 6 pasos:
  1. Elige la Exploración que quieres desarrollar.
  2. Escríbelo en tu Lista de Exploraciones con la fecha de inicio.
  3. Pide a tu guía/subguía de Patrulla que lo firme.
  4. Desarrolla tu Exploración, concluye, escribe la fecha y pide nuevamente a tu guía/subguía de Patrulla que lo firme.
  5. Solicita a la Corte de Honor la insignia correspondiente a tu Exploración.
  6. Celebra recibiendo tu Insignia y la marca correspondiente para integrar en tu Mapa de Exploraciones. ¡Éxito en todas tus Exploraciones!

Página 5 (Lista de Exploraciones — reverso del Mapa central):
- Tabla recortable para pegar al reverso del Mapa central ("Elige tu siguiente Exploración y sigue el ejemplo para llenar tu Lista"):
  Columnas: Exploración | Fecha de inicio / Fecha de término | Firma al inicio de tu guía/subguía de Patrulla | Firma al término de tu guía/subguía de Patrulla.
- Pie: "Imprime y pega aquí otra hoja para continuar tu Lista de Exploraciones".

Página 6 (Planilla de stickers e insignias recortables):
- Insignia Águila Real, Punta de Flecha, Compromiso Ciudadano, Tribu de la Tierra, Mensajeros de la Paz, Scouts Go Solar, Plastic Tide Turners, Campeones por la Naturaleza, Flor de Lis Mundial y emblemas de exploraciones en los 4 ejes temáticos.""",

    "P3.3.1_Hoja_Caminata_v1.1.pdf": """[CONTENIDO VISUAL COMPLETO DE LA HOJA DE CAMINATA (1 PÁGINA — DOBLE TARJETA)]
Título: Sendero — Hoja de Caminata (Comunidad de Caminantes — ASMAC PJOS).
Diseñada con dos columnas simétricas separadas por línea punteada para recorte. Cada tarjeta de Sendero contiene los siguientes campos:
- Encabezado: "Sendero:"
- "Camino que elegí:" [recuadro]
- "¿Qué me inspira a tomar este camino?" [recuadro]
- "Fecha en la que inicié:" y "Fecha en la que terminé:" [recuadros]
- "Firma de Coordinador/subcoordinador de equipo al concluir:"
- "Acciones a realizar:" [cuadro amplio]
- "¿Cómo me siento al terminar esta aventura?" [recuadro]
- "¿Qué fue lo más retador?" [recuadro]
- "¿Qué podría mejorar?" [recuadro]""",

    "P3.3.2_PasaporteComunidad_v1.1.pdf": """[CONTENIDO VISUAL COMPLETO DEL PASAPORTE DE COMUNIDAD (5 PÁGINAS)]
Título: Mi Pasaporte de Comunidad (Comunidad de Caminantes — ASMAC PJOS).

Página 1 (Portada, Promesa de Equipo, Oración del Caminante y Sellos):
- Campos superiores: NOMBRE:, EQUIPO:, espacios circulares para sellos CNCC y SCNCC, e insignias de progresión/Everest.
- Portada inferior: "MI PASAPORTE DE COMUNIDAD" con estrella de los vientos y logo "Caminantes México", espacios para "MI ESTANDARTE", "MI EMBLEMA DE EQUIPO" y "MI COMUNIDAD".
- PROMESA DE EQUIPO: "Yo prometo ser leal a mi equipo, conducirme con la verdad, enfrentar los retos con alegría, aceptar cualquier desafío y nunca desfallecer."
- ORACIÓN DEL CAMINANTE: "Señor, ayúdame a encontrar la fortaleza del viejo roble, para que ningún triunfo me envanezca; la alegría de la naturaleza, para que ninguna soledad me abata; la libertad del ave, para elegir mi camino; y la voluntad del caminante, para seguir siempre adelante y servir."

Página 2 (Los 4 Senderos y todos sus Caminos):
- SENDERO CENIT (Salud y Bienestar — Caminos):
  * Reconozco que mi bienestar emocional es importante y que está bien expresar lo que siento, pedir ayuda y darme tiempo para mí.
  * Aprendo a cuidarme mejor con una buena alimentación, teniendo actividad física, buen descanso y tiempo para mí.
  * Aprendo a manejar mis emociones y a expresarlas de forma saludable para convivir mejor con los demás.
  * Identifico qué cosas me ayudan a sentirme en paz conmigo mismo y hago pequeñas acciones que me ayudan a comprenderme mejor y a encontrar mi propio equilibrio.
- SENDERO CÚSPIDE (Habilidades para la Vida — Caminos):
  * Estoy aprendiendo a ser líder, no para mandar, sino para escuchar, apoyar y tomar decisiones junto con mi equipo.
  * Trabajo en equipo, escucho ideas y tomo decisiones responsables buscando lo mejor para todos.
  * Resuelvo problemas dialogando y escuchando a los demás, y enfrento retos con buena actitud y buscando soluciones en equipo.
  * Estoy aprendiendo a tomar decisiones informadas y responsables, buscando hacer lo correcto y sentirme bien con mis elecciones.
- SENDERO CUMBRE (Paz y Participación Comunitaria — Caminos):
  * Reconozco que todas y todos somos diferentes, y que esas diferencias nos enriquecen como comunidad. Me gusta ser parte de un entorno donde se respeta, se escucha y se incluye a cada persona, sin importar sus características o circunstancias.
  * Me gusta participar en proyectos que benefician a mi comunidad. Trabajando en equipo, puedo lograr cambios reales y construir un lugar donde todas y todos podamos vivir en paz. Disfruto colaborar con otras personas para promover el respeto, el diálogo y el bienestar común.
  * Me gusta tomar acción y liderar iniciativas que ayuden a que mi comunidad sea más justa y equitativa para todas y todos. Creo que, con pequeñas acciones y el compromiso de cada persona, es posible lograr grandes cambios que mejoren nuestro entorno.
- SENDERO CIMA (Medio Ambiente y Sustentabilidad — Caminos):
  * Me doy cuenta de los problemas que existen en el mundo y en mi comunidad, como la contaminación y el cambio climático y sé que debo actuar para cuidar el planeta.
  * Cuido el planeta con pequeñas acciones y comparto la importancia de proteger la naturaleza y los recursos para vivir mejor.
  * Participo, diseño y pongo en marcha proyectos que ayudan a cuidar el medio ambiente, porque sé que todos podemos hacer la diferencia para proteger nuestro planeta.

Páginas 3 y 5 (Cubiertas/separadores visuales de los 4 Ejes Temáticos):
- Láminas gráficas de Paz y Participación Comunitaria, Salud y Bienestar, Habilidades para la Vida, y Medio Ambiente y Sustentabilidad.

Página 4 (Sellos y Bitácora de Punta de Flecha):
- Sección "ESPACIO DE SELLOS DE OTRAS COMUNIDADES" y dos apartados de "BITÁCORA DE MI PUNTA DE FLECHA" con emblemas de Punta de Flecha Comunidad de Caminantes.""",

    "P3.4_MapaRutas_v1.1.pdf": """[CONTENIDO VISUAL COMPLETO DEL MAPA DE RUTAS (9 PÁGINAS)]
Título: Mapa de Rutas (Clan de Rovers — ASMAC PJOS).

Hoja 1 (Página 9 — Bienvenida):
- "te damos la bienvenida al Mapa de rutas"
- Texto: "Llegar a la adultez implica mucho más que poder votar o pagar impuestos. Es saber que eres parte activa de la sociedad y entender que lo que haces es un reflejo de quien eres. Conocerte es un proceso vivo. Aunque tu personalidad y carácter sean constantes, cambiar de hábitos, actividades, conocimientos y oportunidades, también es una constante. Todo esto hace que tu personaje evolucione. Descubrir quién eres puede no ser tan simple siempre; recuerda que la aventura recién comienza, pero no tiene porqué ser abrumador o aburrido. Súbete a tu canoa para comenzar este viaje, y no olvides siempre: ¡Servir! (pega aquí la canoa que armaste en tu viaje de la Comunidad al Clan) Rema tu propia canoa..."
- Sección: "Y... ¿quién soy? Este es un mapa para documentar tu aventura y donde vas a darle forma y seguimiento a ese personaje. Primero, lo primero, ¿cómo se ve tu personaje?"

Hoja 2 (Página 8 — Autoevaluación del personaje y mochila):
- "Ahora intentemos identificar las características que conforman quién eres. Estas características representan tu estado físico, emocional y mental. Rellena los círculos según el nivel en el que piensas que te ubicas o encuentras:"
- Escala (– a +) con 5 círculos para 10 características: Cuerpo, Mente, Adaptabilidad, Inteligencia, Sensatez, Carisma, Supervivencia, Curiosidad, Espiritualidad, Vínculo con la Naturaleza (más 3 renglones adicionales).
- Recuadros: "Lo que me gusta", "Lo que NO me gusta", "Lo que puedo mejorar".
- La Mochila: "¿Y qué llevas contigo? Un curso de repostería, los idiomas que dominas, tu habilidad para programar, la medalla de un maratón, tu facilidad para ilustrar... Todo eso va en tu mochila. Esta mochila es especial porque nunca se llena, así que tú decides cuánto y qué llevar en ella. Ármala y desármala las veces que necesites."

Hoja 3 (Página 7 — Progresiones y stickers de Rutas):
- "Pega las Progresiones que obtengas:" organizadas bajo los 4 Ejes Temáticos (Salud y Bienestar, Paz y Participación Comunitaria, Habilidades para la Vida, Medio Ambiente y Sustentabilidad), con las 4 horquillas de Ruta (Kikapú, Otomí, Wixárica, Maya), emblemas de progresión, Punta de Flecha roja, Cubo Compromiso Ciudadano, Tribu de la Tierra, Mensajeros de la Paz, Scouts Go Solar, Plastic Tide Turners, Campeones por la Naturaleza y Reconocimiento Scouts del Mundo (Scouts of the World Award).
- Página 6 repite planilla de stickers recortables.

Hoja 4 (Página 5 — Proyecto Personal de Vida PPV y Metodología SMART):
- "PPV: Qué es y cómo hacerlo": "Un PPV es un Proyecto Personal de Vida y abarca todo lo que tú decides; lo que pasa en tu vida dentro y fuera del Movimiento Scout, tus actividades, tus proyectos de la escuela, trabajo, familiares..."
- Autoevaluación del PPV con 6 preguntas guía: "¿Cómo es mi vida actualmente? ¿Cuál es mi situación social, familiar, personal? ¿Cuáles son mis objetivos, mis metas y mis sueños actuales? ¿A dónde quiero llegar? ¿Para qué quiero llegar ahí? ¿Qué edad tengo y cuánto tiempo me queda en el Clan de Rovers?"
- Pro tips para tu PPV: "Es una herramienta de seguimiento a lo que haces. Es un track de tu proceso, NO es una lista definitiva. Sé flexible. No compites contra alguien más, ve a tu propio ritmo y no compares tu PPV con el de las demás personas. Prioriza lo importante e identifica lo que es reemplazable. Cada tanto tiempo, pausa y vuelve a hacerte estas preguntas, así podrás reajustar, acomodar y definir tus siguientes pasos."
- Metodología SMART (recuadro rojo con iconos): "SMART es el acrónimo en inglés para: Specific, Measurable, Achieveable, Relevant/Realistic y Timely [en español: Específico, Medible, Alcanzable, Relevante, Temporal]. Cuando tengas dudas sobre a dónde encaminar tus objetivos, piensa en SMART."
- Línea de tiempo de 4 años: indica que puedes hacer tu PPV en hoja extra, atrás del mapa o en digital, y si entraste después de los 18 años ubicas la marca del año correspondiente sin necesidad de fechas exactas.

Hojas A y B (Páginas 1 a 4 — Línea de Tiempo 1° a 4° año y Enlace a la vida):
- Eje temporal de "1 año en el Clan", "2 año en el Clan", "3 año en el Clan", "4 año en el Clan", espacio para "Pega el sticker de tu enlace a la vida", retratos de Baden-Powell al final del trayecto y mensaje: "Hasta este punto, termina tu vida en el Clan, pero, aquí tienes espacio para lo que sigue...".""",

    "P4.2_PlantillaFAESAnexoVertical_v1.1.pdf": """[CONTENIDO VISUAL COMPLETO — PLANTILLA FAES ANEXO VERTICAL v1.1]
Documento oficial de la Asociación de Scouts de México, A.C., Comisión Nacional de Programa de Jóvenes.
Encabezado: FICHA DE ACCIONES EDUCATIVAS SCOUTS — ANEXO (orientación vertical).
Campos editables/imprimibles:
- EJE TEMÁTICO (casillas para marcar: Medio Ambiente y Sustentabilidad, Habilidades para la Vida, Paz y Participación Comunitaria, Salud y Bienestar)
- TÍTULO
- HOJA [ ___ DE ___ ]
- INFORMACIÓN ADICIONAL (espacio amplio de hoja anexa para ampliar desarrollo, diagramas, anexos o tablas de una Ficha de Acción Educativa Scout).""",

    "P4.3_PlantillaFAESAnexoHorizontal_v1.1.pdf": """[CONTENIDO VISUAL COMPLETO — PLANTILLA FAES ANEXO HORIZONTAL v1.1]
Documento oficial de la Asociación de Scouts de México, A.C., Comisión Nacional de Programa de Jóvenes.
Encabezado: FICHA DE ACCIONES EDUCATIVAS SCOUTS — ANEXO (orientación horizontal).
Campos editables/imprimibles:
- EJE TEMÁTICO (casillas para marcar: Medio Ambiente y Sustentabilidad, Habilidades para la Vida, Paz y Participación Comunitaria, Salud y Bienestar)
- TÍTULO
- HOJA [ ___ DE ___ ]
- INFORMACIÓN ADICIONAL (espacio amplio en formato apaisado/horizontal para mapas, matrices, croquis o instrucciones extensas anexas a una FAES).""",

    "P9.1_Formato_de_solicitud _de IF_MLyL_v3.pdf": """[TABLA VISUAL PÁGINA 2 — REQUISITOS MÍNIMOS INSIGNIA FINAL ALFA (OBSIDIANA vs JADE)]
Comparativo oficial de Requisitos Mínimos de la Insignia Final Alfa (Manada de Lobeznas y Lobatos):
- CAZADEROS (Raksha, Baloo, Bagheera, Hermano Gris):
  * Versión Obsidiana: 3 Cazaderos (1 año 6 meses mínimo de permanencia).
  * Versión Jade: 4 Cazaderos (2 años mínimo de permanencia).
- ESPECIALIDADES (Fichas de Especialidades Scout):
  * Versión Obsidiana: Mínimo 4 Especialidades (de ejes temáticos distintos).
  * Versión Jade: Mínimo 6 Especialidades (al menos 4 de ejes temáticos distintos).
- AVENTURAS (Campamentos y Aventura en la Naturaleza):
  * Versión Obsidiana: Técnica Inicial + Mínimo otra Aventura más.
  * Versión Jade: Técnica Inicial + Mínimo 2 Aventuras más.
- INICIATIVAS MUNDIALES (HealthAllies, LifeLeaders, Mensajeros de la Paz, Tribu de la Tierra):
  * Versión Obsidiana: Mínimo 1 Iniciativa Mundial.
  * Versión Jade: Mínimo 2 Iniciativas Mundiales.
- EVENTOS (Provinciales, Regionales o Nacionales):
  * Versión Obsidiana: Mínimo 2 Eventos.
  * Versión Jade: Mínimo 3 Eventos.""",

    "P9.2_Formato_de_solicitud_de_IF_TS_v2.pdf": """[TABLA VISUAL PÁGINA 2 — REQUISITOS MÍNIMOS INSIGNIA FINAL ÁGUILA REAL (OBSIDIANA vs JADE)]
Comparativo oficial de Requisitos Mínimos de la Insignia Final Águila Real (Tropa de Scouts):
- RUMBOS (Tortuga Lora, Venado Cola Blanca, Quetzal, Ocelote):
  * Versión Obsidiana: 3 Rumbos (1 año 6 meses mínimo).
  * Versión Jade: 4 Rumbos (2 años mínimo).
- ESPECIALIDADES:
  * Versión Obsidiana: Mínimo 4 Especialidades / 4 de eje temático distinto.
  * Versión Jade: Mínimo 6 Especialidades / 4 de eje temático distinto.
- AVENTURAS:
  * Versión Obsidiana: Técnica Inicial + Mínimo otra Aventura más.
  * Versión Jade: Técnica Inicial + Mínimo 2 Aventuras más.
- INICIATIVAS MUNDIALES:
  * Versión Obsidiana: 1 mínimo.
  * Versión Jade: 2 mínimo.
- EVENTOS:
  * Versión Obsidiana: 2 mínimo.
  * Versión Jade: 3 mínimo.
- PUNTA DE FLECHA:
  * Versión Obsidiana: Asistencia.
  * Versión Jade: Certificado.""",

    "P9.3_Formato_de_solicitud_de_IF_CC_v2.pdf": """[TABLA VISUAL PÁGINA 2 — REQUISITOS MÍNIMOS INSIGNIA FINAL EVEREST (OBSIDIANA vs JADE)]
Comparativo oficial de Requisitos Mínimos de la Insignia Final Everest (Comunidad de Caminantes):
- SENDEROS (Cenit, Cúspide, Cumbre, Cima):
  * Versión Obsidiana: 3 Senderos (1 año 6 meses mínimo).
  * Versión Jade: 4 Senderos (2 años mínimo).
- ESPECIALIDADES:
  * Versión Obsidiana: Mínimo 3 Especialidades / de eje temático distinto.
  * Versión Jade: Mínimo 4 Especialidades / de eje temático distinto.
- AVENTURAS:
  * Versión Obsidiana: Técnica Inicial + Mínimo otra Aventura más.
  * Versión Jade: Técnica Inicial + Mínimo 2 Aventuras más.
- INICIATIVAS MUNDIALES:
  * Versión Obsidiana: Mínimo 1 Iniciativa Mundial.
  * Versión Jade: Mínimo 2 Iniciativas Mundiales.
- EVENTOS:
  * Versión Obsidiana: Mínimo 2 Eventos.
  * Versión Jade: Mínimo 3 Eventos.
- PUNTA DE FLECHA:
  * Versión Obsidiana: Asistencia.
  * Versión Jade: Certificado.""",

    "P9.4_Formato_de_solicitud_de_IT_CR_v2.pdf": """[TABLA VISUAL PÁGINA 2 — REQUISITOS MÍNIMOS INSIGNIA TERMINAL BADEN POWELL (OBSIDIANA vs JADE)]
Comparativo oficial de Requisitos Mínimos de la Insignia Terminal Baden Powell (Clan de Rovers):
- RUTAS (Kikapú, Otomí, Wixárica, Maya):
  * Versión Obsidiana: 3 Rutas (1 año 6 meses mínimo).
  * Versión Jade: 4 Rutas (2 años mínimo).
- ESPECIALIDADES:
  * Versión Obsidiana: Mínimo 3 Especialidades / de eje temático distinto.
  * Versión Jade: Mínimo 4 Especialidades / Deseable 4 de eje distinto.
- AVENTURAS:
  * Versión Obsidiana: Técnica Inicial + Mínimo otra Aventura más.
  * Versión Jade: Técnica Inicial + Mínimo 2 Aventuras más.
- INICIATIVAS MUNDIALES (incluye Reconocimiento Scouts del Mundo / SWA, HealthAllies, LifeLeaders, Mensajeros de la Paz, Tribu de la Tierra):
  * Versión Obsidiana: Mínimo 1 Iniciativa Mundial.
  * Versión Jade: Mínimo 2 Iniciativas Mundiales.
- EVENTOS:
  * Versión Obsidiana: Mínimo 2 Eventos.
  * Versión Jade: Mínimo 3 Eventos.
- PUNTA DE FLECHA:
  * Versión Obsidiana: Asistencia.
  * Versión Jade: Certificado.
- VIAJE ROVER:
  * Versión Obsidiana: Deseable.
  * Versión Jade: Gran Aventura 1 (requerida).
- PROYECTO PERSONAL DE VIDA (PPV):
  * Versión Obsidiana: Requerido (PPV).
  * Versión Jade: Requerido (PPV).""",
}


def normalize_spaced_letters(raw_text: str) -> str:
    """Corrige saltos de línea artificiales tras la primera letra (ej. 'F\\nORMATO' -> 'FORMATO')."""
    if not raw_text:
        return ""
    s = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"\n([A-ZÁÉÍÓÚÑ¿¡0-9])\n([A-ZÁÉÍÓÚÑa-záéíóúñ])", r"\n\1\2", s)
    # También casos donde la línea empieza con letra sola seguida de newline y el resto en mayúsculas/minúsculas
    s = re.sub(r"(?m)^([A-ZÁÉÍÓÚÑ¿¡])\n([A-ZÁÉÍÓÚÑa-záéíóúñ])", r"\1\2", s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def parse_all_65_readable() -> dict:
    """Parsea scratch/all_65_pdfs_readable.txt devolviendo dict name -> texto limpio."""
    p = SCRATCH / "all_65_pdfs_readable.txt"
    raw = p.read_text(encoding="utf-8")
    parts = re.split(
        r"^###\s+(.+?)\s+\(([a-f0-9]{12}),\s*(\d+)p,\s*(\d+)\s*B\)\s*$",
        raw,
        flags=re.M,
    )
    res = {}
    for i in range(1, len(parts), 5):
        name, sha12, pages, b, body = parts[i : i + 5]
        body_clean = normalize_spaced_letters(body)
        # Reemplazar encabezados [PAGE X TEXT (... chars)]: por --- Página X ---
        body_clean = re.sub(
            r"\[PAGE (\d+) TEXT[^\]]*\]\s*:",
            r"\n--- Página \1 ---\n",
            body_clean,
        )
        body_clean = re.sub(r"\[PAGE (\d+) TEXT:\s*0 chars \(image/vector\)\]", r"\n--- Página \1 ---\n", body_clean)
        body_clean = re.sub(r"\[ACROFORM FIELDS\]\s*:", "\n[CAMPOS EDITABLES DEL FORMULARIO]\n", body_clean)
        res[name] = body_clean.strip()
    return res


def spanish_date_to_iso(date_str: str) -> str:
    """Convierte '25 Septiembre 2026' a '2026-09-25'."""
    if not date_str:
        return CUTOFF_DATE
    m = re.match(r"(\d{1,2})\s+([A-Za-záéíóúñ]+)\s+(\d{4})", date_str.strip())
    if not m:
        return CUTOFF_DATE
    day = int(m.group(1))
    mon_name = m.group(2).lower()
    year = int(m.group(3))
    mon = MONTHS_ES.get(mon_name, 11)
    return f"{year:04d}-{mon:02d}-{day:02d}"


def human_pdf_title(filename: str, dedup_info: dict | None, fields: dict) -> str:
    """Genera título legible en español para cada PDF oficial."""
    name = filename
    if name == "Formato de Proyecto v1.1.pdf":
        return "Formato Oficial de Proyecto Scout (v1.1)"
    if name.startswith("FES_CC_"):
        if dedup_info and dedup_info.get("titles"):
            base_t = dedup_info["titles"][0]
        else:
            raw = re.sub(r"^FES_CC_(?:HPV|PPC|SYB)_", "", name).replace(".pdf", "")
            base_t = raw.title()
        return f"Especialidad Scout (Comunidad): {base_t}"

    explicit = {
        "P1.0.1_ FAESDiagnosticoInicialNNAJ_v1.1.pdf": "Plantilla P1.0.1 — Diagnóstico Inicial NNAJ (Editable)",
        "P1.0.2_ANEXOFAESDiagnosticoIniciaNNAJAnexo_V1.1.pdf": "Plantilla P1.0.2 — Anexo Diagnóstico Inicial NNAJ",
        "P1.1_MatrizDiagnosticoInicialMlL_v1.3.pdf": "Plantilla P1.1 — Matriz de Diagnóstico Inicial Manada (v1.3)",
        "P1.2_MatrizDiagnosticoInicialTS_v1.3.pdf": "Plantilla P1.2 — Matriz de Diagnóstico Inicial Tropa (v1.3)",
        "P1.3_MatrizDiagnosticoInicialCC_v1.3.pdf": "Plantilla P1.3 — Matriz de Diagnóstico Inicial Comunidad (v1.3)",
        "P1.4_MatrizDiagnosticoInicialCR_v1.3.pdf": "Plantilla P1.4 — Matriz de Diagnóstico Inicial Clan de Rovers (v1.3)",
        "P2.0.1_FAES_EvaluaciónAuxiliarAccionesEducativas_v1.1.pdf": "Plantilla P2.0.1 — Evaluación Auxiliar de Acciones Educativas",
        "P2.0.1_AnexoFAESEvaluaciónAuxiliarAccionesEducativas_v1.1.pdf": "Plantilla P2.0.1 — Anexo Evaluación Auxiliar de Acciones Educativas",
        "P2.1_CedulaAuxiliarEvaluacionMLL_v1.1.pdf": "Plantilla P2.1 — Cédula Auxiliar de Evaluación Manada (v1.1)",
        "P2.2_CedulaAuxiliarEvaluacionTS_v1.1.pdf": "Plantilla P2.2 — Cédula Auxiliar de Evaluación Tropa (v1.1)",
        "P2.3_CedulaAuxiliarEvaluacionCC_v1.1.pdf": "Plantilla P2.3 — Cédula Auxiliar de Evaluación Comunidad (v1.1)",
        "P2.4_FESCedulaAuxiliarEvaluacionCR_v1.1.pdf": "Plantilla P2.4 — Cédula Auxiliar de Evaluación Clan de Rovers (v1.1)",
        "P3.1_MLLMiLibroSeeonee_v1.1.pdf": "Mi Libro del Seeonee — Mapa de Progresión Manada (P3.1 v1.1)",
        "P3.2TS_MapaExploraciones_V1.2.pdf": "Mapa de Exploraciones — Progresión Tropa Scout (P3.2 v1.2)",
        "P3.3.1_Hoja_Caminata_v1.1.pdf": "Hoja de Caminata — Comunidad de Caminantes (P3.3.1 v1.1)",
        "P3.3.2_PasaporteComunidad_v1.1.pdf": "Mi Pasaporte de Comunidad — Caminantes (P3.3.2 v1.1)",
        "P3.4_MapaRutas_v1.1.pdf": "Mapa de Rutas y PPV SMART — Clan de Rovers (P3.4 v1.1)",
        "P4.1_PlantillasFAES_v1.1.pdf": "Plantilla P4.1 — Ficha de Acciones Educativas Scouts (FAES v1.1)",
        "P4.2_PlantillaFAESAnexoVertical_v1.1.pdf": "Plantilla P4.2 — Anexo Vertical para FAES (v1.1)",
        "P4.3_PlantillaFAESAnexoHorizontal_v1.1.pdf": "Plantilla P4.3 — Anexo Horizontal para FAES (v1.1)",
        "P5.1_PlantillaEspecialidad_v1.1.pdf": "Plantilla P5.1 — Ficha de Especialidad Scout (FES Editable v1.1)",
        "P6.1_PlantillaEvento_v1.0.pdf": "Plantilla P6.1 — Ficha de Evento Scout (v1.0)",
        "P6.2_PlantillaProyecto_V1.0.pdf": "Plantilla P6.2 — Ficha de Proyecto Scout (v1.0)",
        "P6.3_PlantillaPrograma_v1.0.pdf": "Plantilla P6.3 — Programa de Actividades (v1.0)",
        "P6.4_PlantillaActadeConsejodeNivel_v1.0.pdf": "Plantilla P6.4 — Acta de Consejo de Nivel y Corte de Honor (v1.0)",
        "P6.5_PlantillaiclodePrograma_v1.0.pdf": "Plantilla P6.5 — Ciclo de Programa de Actividades Scouts (v1.0)",
        "P7.1_Plantilla_Formato registro auxiliar progresion MLL.pdf": "Plantilla P7.1 — Registro Auxiliar de Progresión Manada",
        "P7.2_ Formato registro auxiliar progresion TS.pdf": "Plantilla P7.2 — Registro Auxiliar de Progresión Tropa Scout",
        "P7.3_ Formato registro auxiliar progresion CC.pdf": "Plantilla P7.3 — Registro Auxiliar de Progresión Comunidad",
        "P7.4_Formato registro auxiliar progresion CR.pdf": "Plantilla P7.4 — Registro Auxiliar de Progresión Clan de Rovers",
        "P8.1_SOLICITUD_CHFN-MD.pdf": "Formato P8.1 — Solicitud Champions for Nature: Mejores Decisiones",
        "P8.2_SOLICITUD_CHFN-NB_2026.pdf": "Formato P8.2 — Solicitud Champions for Nature: Naturaleza y Biodiversidad 2026",
        "P8.3_SOLICITUD_MOP_2026.pdf": "Formato P8.3 — Solicitud Mensajeros de la Paz 2026",
        "P8.4_SOLICITUD_PTT_2026.pdf": "Formato P8.4 — Solicitud Plastic Tide Turners 2026",
        "P8.5_SOLICITUD_RSDM-2026.pdf": "Formato P8.5 — Solicitud Reconocimiento Scouts del Mundo (RSDM 2026)",
        "P8.7_SOLICITUD_SGS_2026.pdf": "Formato P8.7 — Solicitud Scouts Go Solar 2026",
        "P9.1_Formato_de_solicitud _de IF_MLyL_v3.pdf": "Formato P9.1 — Solicitud Insignia Final Alfa (Manada v3, Obsidiana/Jade)",
        "P9.2_Formato_de_solicitud_de_IF_TS_v2.pdf": "Formato P9.2 — Solicitud Insignia Final Águila Real (Tropa v2, Obsidiana/Jade)",
        "P9.3_Formato_de_solicitud_de_IF_CC_v2.pdf": "Formato P9.3 — Solicitud Insignia Final Everest (Comunidad v2, Obsidiana/Jade)",
        "P9.4_Formato_de_solicitud_de_IT_CR_v2.pdf": "Formato P9.4 — Solicitud Insignia Terminal Baden Powell (Clan v2, Obsidiana/Jade)",
        "P9.5_Plantilla_Formato_CiclodePrograma_2026V2.pdf": "Plantilla P9.5 — Formato Ciclo de Programa 2026 (v2)",
        "P10.2_Ficha_de_Planeacion_Didactica_FPD.pdf": "Formato P10.2 — Ficha de Planeación Didáctica CNAMS (FPD)",
        "P10.4_ESPECIALIDAD_Anexo_Horizontal.pdf": "Plantilla P10.4 — Anexo Horizontal para Ficha de Especialidad",
        "P10.5_ESPECIALIDAD_Anexo_Vertical.pdf": "Plantilla P10.5 — Anexo Vertical para Ficha de Especialidad",
        "P10.6_Carta_de_conclusion_de_acompanamiento_formativo_ Curso_de_Insignia_de_Madera.pdf": "Carta P10.6 — Conclusión de Acompañamiento Formativo Insignia de Madera",
        "P10.7_Carta_de_Conclusion_de_acompanamiento_formativo_ No_acreditado.pdf": "Carta P10.7 — Conclusión de Acompañamiento Formativo (No Acreditado)",
    }
    if name in explicit:
        return explicit[name]
    return name.replace(".pdf", "")


def pdf_category_and_section(filename: str, dedup_info: dict | None):
    """Devuelve (category, subcategory, section, section_label, applicable_sections, code)."""
    if filename.startswith("FES_CC_"):
        sub_list = (dedup_info or {}).get("subcategories", [])
        if any("Medio Ambiente" in s for s in sub_list):
            subcat = "Medio Ambiente y Sustentabilidad (Comunidad)"
        elif "_HPV_" in filename:
            subcat = "Habilidades para la Vida (Comunidad)"
        elif "_PPC_" in filename:
            subcat = "Paz y Participación Comunitaria (Comunidad)"
        else:
            subcat = "Salud y Bienestar (Comunidad)"
        code_m = re.match(r"^(FES_CC_[A-Z]+)", filename)
        return (
            "Especialidades Scouts (FES)",
            subcat,
            "comunidad",
            "Comunidad de Caminantes",
            ["comunidad", "adultos"],
            code_m.group(1) if code_m else "FES_CC",
        )

    cat = "Plantillas PJOS, FAES y RECME"
    code_m = re.match(r"^(P\d+(?:\.\d+)*)", filename)
    code = code_m.group(1) if code_m else ("PROY-V1.1" if "Proyecto" in filename else None)

    if filename.startswith(("P1.", "P2.")):
        subcat = "Diagnóstico y Evaluación (P1–P2)"
    elif filename.startswith("P3."):
        subcat = "Mapas, Pasaportes y Libro Seeonee (P3)"
    elif filename.startswith(("P4.", "P5.")):
        subcat = "Plantillas FAES y Especialidades (P4–P5)"
    elif filename.startswith(("P6.", "P9.5", "Formato de Proyecto")):
        subcat = "Proyectos, Eventos, Consejos y Ciclo (P6 y P9.5)"
    elif filename.startswith("P7."):
        subcat = "Seguimiento Auxiliar de Progresión (P7)"
    elif filename.startswith("P8."):
        subcat = "Solicitudes Mundo Mejor 2026 (P8)"
    elif filename.startswith("P9."):
        subcat = "Solicitudes de Insignia Final / Terminal (P9)"
    else:
        subcat = "Formación de Adultos CNAMS y Anexos FES (P10)"

    fn_low = filename.lower()
    if any(x in fn_low for x in ("mll", "mlyl", "seeonee")):
        sec, seclabel, app = "manada", "Manada de Lobatos", ["manada", "adultos"]
    elif "ts" in fn_low or "exploraciones" in fn_low:
        sec, seclabel, app = "tropa", "Tropa de Scouts", ["tropa", "adultos"]
    elif "cc" in fn_low or "caminata" in fn_low or "pasaportecomunidad" in fn_low:
        sec, seclabel, app = "comunidad", "Comunidad de Caminantes", ["comunidad", "adultos"]
    elif "cr" in fn_low or "maparutas" in fn_low or "rsdm" in fn_low:
        sec, seclabel, app = "clan", "Clan de Rovers", ["clan", "adultos"]
    elif filename.startswith("P10."):
        sec, seclabel, app = "adultos", "Adultos y Dirigentes", ["adultos", "general"]
    else:
        sec, seclabel, app = "general", "General / Todas las Secciones", [
            "general",
            "manada",
            "tropa",
            "comunidad",
            "clan",
            "adultos",
        ]
    return cat, subcat, sec, seclabel, app, code


def infer_existing_subcategory(doc: dict) -> str:
    """Asigna una subcategoría limpia a los 650 documentos preexistentes."""
    if doc.get("subcategory"):
        return doc["subcategory"]
    cat = doc.get("category") or ""
    title = (doc.get("title") or "").lower()
    fn = (doc.get("filename") or "").lower()
    blob = f"{title} {fn}"

    if cat == "Colección Biblioteca del Centenario":
        if "baden-powell" in blob or any(
            k in blob
            for k in (
                "escultismo para muchachos",
                "lobatos",
                "roverismo",
                "jefe de tropa",
                "tropiezos",
                "caminos hacia",
                "escolta",
                "mensajes",
                "mafenking",
            )
        ):
            return "Obras de Baden-Powell y Fundadores"
        if any(k in blob for k in ("gilcraft", "knavesdale", "juegos", "cabaña", "pioner", "cocina")):
            return "Clásicos de Técnica y Método"
        if any(k in blob for k in ("historia", "macazaga", "cabrera", "centenario", "aniversario", "cronica")):
            return "Historia del Escultismo Mexicano"
        return "Literatura, Ficción y Lecturas Scouts"

    if cat == "Guías, Carnets y Programa de Jóvenes (PJOS)":
        if any(
            k in blob
            for k in (
                "tribu",
                "solar",
                "plastic",
                "champions",
                "mensajeros",
                "mundo mejor",
                "ods",
                "dialogue",
                "patience",
                "earth",
            )
        ):
            return "Iniciativas Mundiales y Marco Mundo Mejor"
        if any(k in blob for k in ("foro", "casa", "agentes", "red", "caminantes")):
            return "Foros Juveniles, Agentes y Redes"
        if "punta de flecha" in blob or "carnet" in blob:
            return "Carnets de Aventuras y Punta de Flecha"
        return "Guías de Progresión por Sección"

    if cat == "Manuales Oficiales y de Operación":
        if any(k in blob for k in ("uniforme", "honores", "bandera", "escolta", "ceremonial", "cortes")):
            return "Uniforme y Ceremonial Scout"
        if any(k in blob for k in ("explorapp", "carpetapp", "sisas", "cdc", "digital", "plataforma")):
            return "Sistemas Digitales (ExplorApp / SISAS / CDC)"
        if any(k in blob for k in ("primeros auxilios", "emergencia", "acopio", "pie tierno", "campamento", "riesgo")):
            return "Campismo, Primeros Auxilios y Emergencias"
        return "Operación de Grupo, Provincia y Adultos"

    if cat == "Reglamentos, Estatutos y Políticas":
        if any(k in blob for k in ("estatuto", "reglamento 202", "reglamento.pdf", "reglamento de")):
            return "Estatutos y Reglamento General"
        if any(k in blob for k in ("salvo del peligro", "safe from harm", "bullying", "violencia", "acoso")):
            return "Protección Juvenil (A Salvo del Peligro)"
        if any(k in blob for k in ("conducta", "cnh", "corte nacional", "disciplina", "honor", "ética")):
            return "Corte de Honor, Ética y Conducta"
        return "Políticas Nacionales Institucionales"

    if cat == "Convocatorias y Comunicados Nacionales":
        if any(k in blob for k in ("jamboree", "moot", "eeas", "philia", "campamento", "rally", "encuentro", "foro")):
            return "Eventos Nacionales e Internacionales"
        if "dnme" in blob or "cnpj" in blob:
            return "Comunicados DNME / Programa Educativo"
        if (doc.get("year") or 0) <= 2023:
            return "Comunicados Históricos (2016–2023)"
        return "Comunicados JSN / Dirección Ejecutiva"

    if cat == "Revistas Foro Joven y Boletines":
        if "bolet" in blob or "prensa" in blob:
            return "Boletines y Comunicados de Prensa"
        if (doc.get("year") or 0) >= 2024:
            return "Revista Foro Joven (2024–2026)"
        return "Revista Foro Joven (Ediciones 2019–2023)"

    if cat == "Formatos, Actas y Seguro Scout":
        if any(k in blob for k in ("diálogo", "dialogo", "mediaci", "arbitraje", "dd.", "med.", "ar.")):
            return "Actas CNH (Diálogo, Mediación y Arbitraje)"
        if any(k in blob for k in ("seguro", "accidente", "reembolso", "poliza", "póliza")):
            return "Seguro Scout y Avisos de Accidente"
        if any(k in blob for k in ("ficha", "salud", "médic", "medic", "consentimiento", "permiso", "jl304")):
            return "Fichas Médicas y Consentimientos"
        return "Formatos Administrativos y Registro"

    if cat == "Identidad Gráfica y Recursos Visuales":
        if "manual" in blob or "identidad" in blob or "redes" in blob:
            return "Manuales de Identidad y Marca"
        if "top 10" in blob or "membres" in blob or "reporte" in blob or "whatsapp" in blob:
            return "Infografías y Estadísticas de Membresía"
        return "Recursos Visuales por Sección"

    return "Páginas Institucionales ASMAC / WOSM"


def chunk_text_by_pages(doc_id: str, full_text: str, chunk_size: int = 1350) -> list:
    """Divide texto normalizado por página en fragmentos buscables [doc_id, page, text]."""
    chunks = []
    markers = list(re.finditer(r"---\s*Página\s*(\d+)\s*---", full_text))
    if not markers:
        pages = [(1, full_text)]
    else:
        pages = []
        pre = full_text[: markers[0].start()].strip()
        if pre:
            pages.append((1, pre))
        for idx, m in enumerate(markers):
            pnum = int(m.group(1))
            start = m.end()
            end = markers[idx + 1].start() if idx + 1 < len(markers) else len(full_text)
            body = full_text[start:end].strip()
            if body:
                pages.append((pnum, body))

    for pnum, body in pages:
        txt = re.sub(r"\s+", " ", body).strip()
        if len(txt) < 25:
            continue
        pos = 0
        while pos < len(txt):
            piece = txt[pos : pos + chunk_size]
            if len(piece) > 30:
                chunks.append([doc_id, pnum, piece])
            pos += chunk_size
    return chunks


def render_pdf_cover(pdf_path: Path, out_jpg: Path):
    """Renderiza primera página del PDF a portada JPG <=360px de ancho."""
    if out_jpg.exists() and out_jpg.stat().st_size > 1000:
        return
    doc = pdfium.PdfDocument(str(pdf_path))
    page = doc[0]
    bmp = page.render(scale=1.5)
    img = bmp.to_pil()
    w, h = img.size
    if w > 360:
        nh = int(h * 360 / w)
        img = img.resize((360, nh), Image.Resampling.LANCZOS)
    img.convert("RGB").save(out_jpg, "JPEG", quality=84, optimize=True)
    doc.close()


def render_standalone_html(
    title: str,
    category: str,
    subcategory: str,
    badge: str,
    source_url: str,
    sections_html: str,
) -> str:
    """Construye HTML UTF-8 autónomo, limpio y responsivo (modo claro y oscuro)."""
    src_line = (
        f'<p class="src">Fuente oficial de referencia: <code>{html.escape(source_url)}</code></p>'
        if source_url
        else ""
    )
    return f"""<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{html.escape(title)} — BiblioTech Scout</title>
  <style>
    :root {{
      --bg: #f8fafc;
      --card: #ffffff;
      --ink: #0f172a;
      --muted: #475569;
      --accent: #6d28d9;
      --accent-soft: #ede9fe;
      --border: #dbeafe;
      --warn-bg: #fff7ed;
      --warn-border: #fdba74;
    }}
    @media (prefers-color-scheme: dark) {{
      :root {{
        --bg: #080414;
        --card: #120b26;
        --ink: #f8fafc;
        --muted: #cbd5e1;
        --accent: #a855f7;
        --accent-soft: rgba(168, 85, 247, 0.18);
        --border: rgba(139, 92, 246, 0.35);
        --warn-bg: rgba(245, 158, 11, 0.12);
        --warn-border: rgba(251, 191, 36, 0.45);
      }}
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      padding: 24px 16px 48px;
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, Segoe UI, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.7;
    }}
    .wrap {{
      max-width: 860px;
      margin: 0 auto;
    }}
    .hero-card {{
      background: var(--card);
      border: 1.5px solid var(--border);
      border-radius: 20px;
      padding: 24px 26px;
      margin-bottom: 18px;
    }}
    .crumbs {{
      font-size: 0.78rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--accent);
      margin-bottom: 8px;
    }}
    h1 {{
      margin: 0 0 10px;
      font-size: 1.55rem;
      line-height: 1.28;
    }}
    .meta {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 0.8rem;
      color: var(--muted);
    }}
    .pill {{
      background: var(--accent-soft);
      color: var(--accent);
      padding: 3px 10px;
      border-radius: 999px;
      font-weight: 700;
    }}
    .src {{
      margin: 10px 0 0;
      font-size: 0.8rem;
      color: var(--muted);
      word-break: break-all;
    }}
    .card {{
      background: var(--card);
      border: 1.5px solid var(--border);
      border-radius: 18px;
      padding: 22px 26px;
      margin-bottom: 16px;
    }}
    h2 {{
      margin: 0 0 10px;
      font-size: 1.12rem;
      color: var(--accent);
    }}
    h3 {{
      margin: 16px 0 6px;
      font-size: 1rem;
    }}
    p, li {{
      font-size: 0.96rem;
    }}
    ul, ol {{
      padding-left: 20px;
      margin: 8px 0;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 0.9rem;
    }}
    th, td {{
      border: 1px solid var(--border);
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }}
    th {{
      background: var(--accent-soft);
      font-weight: 800;
    }}
    .note {{
      background: var(--warn-bg);
      border: 1px solid var(--warn-border);
      border-radius: 12px;
      padding: 12px 14px;
      margin: 12px 0;
      font-size: 0.9rem;
    }}
    figure {{
      margin: 16px 0;
      padding: 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      text-align: center;
    }}
    figure img {{
      max-width: 100%;
      height: auto;
      border-radius: 10px;
      display: block;
      margin: 0 auto 8px;
    }}
    figcaption {{
      font-size: 0.8rem;
      color: var(--muted);
    }}
    code {{
      background: var(--accent-soft);
      padding: 1px 5px;
      border-radius: 5px;
      font-size: 0.88em;
    }}
  </style>
</head>
<body>
  <main class="wrap">
    <header class="hero-card">
      <div class="crumbs">{html.escape(category)} • {html.escape(subcategory)}</div>
      <h1>{html.escape(title)}</h1>
      <div class="meta">
        <span class="pill">{html.escape(badge)}</span>
        <span>Corte documental: {CUTOFF_DISPLAY}</span>
      </div>
      {src_line}
    </header>
    {sections_html}
  </main>
</body>
</html>
"""


def inline_image_figure(rel_img_src: str, alt: str) -> str:
    """Incrusta imagen tutorial local como data URI base64 para 100% portabilidad offline/online."""
    clean_rel = rel_img_src.lstrip("./").replace("/", os.sep)
    candidate = DOWNLOADS_RECME / clean_rel
    if not candidate.exists():
        # Buscar por nombre base dentro de recme.scouts.org.mx
        basename = Path(clean_rel).name
        matches = list(DOWNLOADS_RECME.rglob(basename))
        if matches:
            candidate = matches[0]
        else:
            return ""
    data = candidate.read_bytes()
    ext = candidate.suffix.lower().lstrip(".")
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        mime = "image/webp"
    elif data[:8] == b"\x89PNG\r\n\x1a\n":
        mime = "image/png"
    b64 = base64.b64encode(data).decode("ascii")
    return (
        f'<figure><img src="data:{mime};base64,{b64}" alt="{html.escape(alt)}" />'
        f"<figcaption>{html.escape(alt)}</figcaption></figure>"
    )


def build_helpdesk_paragraphs_html(raw_text: str, images: list) -> str:
    """Convierte el texto de artículo Help Desk en HTML legible intercalando capturas cuando aplica."""
    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    # Filtrar encabezados repetidos del breadcrumb / navegación Help Desk
    skip_exact = {
        "Helpdesk Oficina Scout Nacional",
        "Base de Conocimientos",
        "Inicio",
        "¿Te resultó útil este artículo?",
        "Si / No",
        "Sí",
        "No",
    }
    clean_lines = []
    for ln in lines:
        if ln in skip_exact:
            continue
        if ln.startswith("Categoría:") or ln.startswith("Artículo ID:"):
            continue
        clean_lines.append(ln)

    body_parts = ['<section class="card">']
    for ln in clean_lines:
        if re.match(r"^(Paso\s+\d+|¿.+\?|\d+[.)]\s+[A-ZÁÉÍÓÚÑ])", ln) and len(ln) < 110:
            body_parts.append(f"<h3>{html.escape(ln)}</h3>")
        elif ln.startswith(("Nota", "Importante", "Atención", "Tip")):
            body_parts.append(f'<div class="note">{html.escape(ln)}</div>')
        else:
            body_parts.append(f"<p>{html.escape(ln)}</p>")
    body_parts.append("</section>")

    if images:
        figs = []
        seen_src = set()
        for im in images:
            src = im.get("src") or ""
            alt = im.get("alt") or Path(src).name
            if not src or src in seen_src:
                continue
            seen_src.add(src)
            fig_html = inline_image_figure(src, alt)
            if fig_html:
                figs.append(fig_html)
        if figs:
            body_parts.append('<section class="card"><h2>Capturas Oficiales del Procedimiento en SISAS</h2>')
            body_parts.extend(figs)
            body_parts.append("</section>")
    return "\n".join(body_parts)


def parse_helpdesk_all_text() -> dict:
    """Lee scratch/helpdesk_all_readable.txt para cubrir los 45 archivos aunque alguno falte en parsed_data."""
    raw = (SCRATCH / "helpdesk_all_readable.txt").read_text(encoding="utf-8")
    parts = re.split(
        r"^=== \[(\d+)\] (.+?) \(([a-f0-9]{12})\) \[([^\]]+)\] ===$",
        raw,
        flags=re.M,
    )
    out = {}
    for i in range(1, len(parts), 5):
        idx, title, sha12, fname, body = parts[i : i + 5]
        out[fname] = {"title": title.strip(), "sha12": sha12, "file": fname, "text": body.strip()}
    return out


def helpdesk_subcategory(title: str, fname: str) -> tuple[str, str, list]:
    """Devuelve (subcategory, section, applicable_sections) para un artículo Help Desk."""
    blob = f"{title} {fname}".lower()
    if any(k in blob for k in ("jefe de grupo", "scouter", "validar progresi", "fecha de inicio")):
        return (
            "Guía para Jefes de Grupo y Scouters (SISAS)",
            "adultos",
            ["adultos", "general"],
        )
    if any(k in blob for k in ("pago", "beca", "evento", "reinscrib", "registro familiar", "factura")):
        return (
            "Pagos, Reinscripción, Becas y Eventos",
            "general",
            ["general", "manada", "tropa", "comunidad", "clan", "adultos"],
        )
    if any(k in blob for k in ("avances", "progresi", "curriculum")):
        return (
            "Progresión y Currículum en SISAS",
            "general",
            ["general", "manada", "tropa", "comunidad", "clan", "adultos"],
        )
    if "conecta" in blob or "directorio" in blob or "ticket" in blob:
        return (
            "Mesa de Ayuda (Help Desk) y CONECTA",
            "general",
            ["general", "manada", "tropa", "comunidad", "clan", "adultos"],
        )
    return (
        "Acceso, Cuenta y Credencial SISAS",
        "general",
        ["general", "manada", "tropa", "comunidad", "clan", "adultos"],
    )


def register_new_doc(
    new_docs: list,
    new_chunks: list,
    idx_num: int,
    filename: str,
    rel_path: str,
    title: str,
    ext: str,
    raw_bytes: bytes,
    full_text: str,
    category: str,
    subcategory: str,
    section: str,
    section_label: str,
    applicable_sections: list,
    origin: str,
    year: int,
    date_sort: str,
    page_count: int,
    code: str | None = None,
    has_web_file: bool = True,
    is_readable_html: bool = False,
):
    sha256 = hashlib.sha256(raw_bytes).hexdigest()
    sha12 = sha256[:12]
    text_clean = normalize_spaced_letters(full_text)
    if not text_clean:
        text_clean = title
    (TEXT_DIR / f"{sha12}.txt").write_text(text_clean, encoding="utf-8")

    # Escribir en files/ o preparar staging Release v1.0
    ext_low = ext.lower()
    if has_web_file:
        FILES_DIR.mkdir(parents=True, exist_ok=True)
        (FILES_DIR / f"{sha12}.{ext_low}").write_bytes(raw_bytes)
    else:
        RELEASE_STAGE_DIR.mkdir(parents=True, exist_ok=True)
        (RELEASE_STAGE_DIR / f"{sha12}.{ext_low}").write_bytes(raw_bytes)

    doc_id = f"doc-{idx_num:04d}"
    norm_key = re.sub(r"[^a-z0-9]", "", filename.lower())
    summary = re.sub(r"\s+", " ", text_clean).strip()[:280]
    if len(re.sub(r"\s+", " ", text_clean).strip()) > 280:
        summary += "..."
    full_excerpt = re.sub(r"\s+", " ", text_clean).strip()[:2400]

    entry = {
        "filename": filename,
        "rel_path": rel_path,
        "title": title,
        "ext": ext.upper(),
        "size_bytes": len(raw_bytes),
        "size_mb": round(len(raw_bytes) / (1024 * 1024), 2),
        "size_kb": round(len(raw_bytes) / 1024, 1),
        "sha256": sha256,
        "sha12": sha12,
        "text_hash": hashlib.sha1(text_clean.encode("utf-8")).hexdigest(),
        "code": code,
        "pii_flag": False,
        "norm_key": norm_key,
        "year": year,
        "date_sort": date_sort,
        "page_count": page_count,
        "origin": origin,
        "section": section,
        "section_label": section_label,
        "category": category,
        "subcategory": subcategory,
        "summary": summary,
        "full_excerpt": full_excerpt,
        "is_duplicate": False,
        "duplicate_of": None,
        "id": doc_id,
        "is_latest_in_family": True,
        "superseded_by": None,
        "applicable_sections": applicable_sections,
        "is_centenario_book": False,
        "has_web_file": has_web_file,
    }
    if is_readable_html:
        entry["is_readable_html"] = True
    new_docs.append(entry)
    new_chunks.extend(chunk_text_by_pages(doc_id, text_clean))
    return entry


def main():
    catalog_path = DATA_DIR / "catalog.json"
    chunks_path = DATA_DIR / "chunks.json"

    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    chunks = json.loads(chunks_path.read_text(encoding="utf-8"))

    # Preservar únicamente base original doc-0001..doc-0650 para idempotencia
    base_docs = [d for d in catalog["documents"] if int(d["id"].split("-")[1]) <= 650]
    base_ids = {d["id"] for d in base_docs}
    for d in base_docs:
        d["subcategory"] = infer_existing_subcategory(d)
    base_chunks = [c for c in chunks if c[0] in base_ids]

    pdfs_json = json.loads((SCRATCH / "pdfs_complete_text_and_fields.json").read_text(encoding="utf-8"))
    dedup_list = json.loads((SCRATCH / "recme_files_dedup.json").read_text(encoding="utf-8"))
    dedup_by_name = {x["filename"]: x for x in dedup_list}
    readable_65 = parse_all_65_readable()

    rp = json.loads((SCRATCH / "recme_parsed_data.json").read_text(encoding="utf-8"))
    rh = json.loads((SCRATCH / "recme_html_texts_clean.json").read_text(encoding="utf-8"))
    hd_by_file_parsed = {x["file"]: x for x in rp.get("helpdesk_articles", [])}
    hd_all_txt = parse_helpdesk_all_text()

    if RELEASE_STAGE_DIR.exists():
        shutil.rmtree(RELEASE_STAGE_DIR)
    RELEASE_STAGE_DIR.mkdir(parents=True, exist_ok=True)
    TEXT_DIR.mkdir(parents=True, exist_ok=True)
    COVERS_DIR.mkdir(parents=True, exist_ok=True)
    FILES_DIR.mkdir(parents=True, exist_ok=True)

    new_docs = []
    new_chunks = []
    next_id = 651

    # ------------------------------------------------------------------
    # 1. Procesar los 65 PDFs canónicos (64 en RECME + Formato de Proyecto v1.1)
    # ------------------------------------------------------------------
    for pinfo in pdfs_json:
        fname = pinfo["name"]
        src_path = Path(pinfo["canonical_path"])
        assert src_path.exists(), f"Missing canonical PDF: {src_path}"
        dedup = dedup_by_name.get(fname)
        fields = pinfo.get("fields") or {}

        title = human_pdf_title(fname, dedup, fields)
        cat, subcat, sec, seclabel, app_secs, code = pdf_category_and_section(fname, dedup)
        raw_bytes = src_path.read_bytes()
        sha12 = hashlib.sha256(raw_bytes).hexdigest()[:12]

        # Portada JPG en covers/
        render_pdf_cover(src_path, COVERS_DIR / f"{sha12}.jpg")

        # Construir texto enriquecido: metadata + texto completo normalizado + transcripción visual si aplica
        meta_hdr = [f"DOCUMENTO OFICIAL ASMAC: {title}", f"Archivo: {fname}"]
        if dedup:
            if dedup.get("dates"):
                meta_hdr.append(f"Fecha de publicación en RECME: {', '.join(dedup['dates'])}")
            if dedup.get("subcategories"):
                meta_hdr.append(f"Categoría RECME: {', '.join(dedup['subcategories'])}")
            if dedup.get("tags"):
                meta_hdr.append(f"Etiqueta temática RECME: {', '.join(dedup['tags'])}")
        body_txt = readable_65.get(fname, "")
        sup = VISUAL_SUPPLEMENTS.get(fname, "")
        full_txt = "\n".join(meta_hdr) + "\n\n" + body_txt
        if sup:
            full_txt += "\n\n" + sup

        date_iso = CUTOFF_DATE
        if dedup and dedup.get("dates"):
            date_iso = max(spanish_date_to_iso(d) for d in dedup["dates"])
        year = int(date_iso[:4])
        has_web = len(raw_bytes) <= MAX_WEB_BYTES

        register_new_doc(
            new_docs=new_docs,
            new_chunks=new_chunks,
            idx_num=next_id,
            filename=fname,
            rel_path=f"RECME/{fname}",
            title=title,
            ext="PDF",
            raw_bytes=raw_bytes,
            full_text=full_txt,
            category=cat,
            subcategory=subcat,
            section=sec,
            section_label=seclabel,
            applicable_sections=app_secs,
            origin="ASMAC — RECME / CNAMS / CNPJ" if "Adulto" in subcat or fname.startswith("P10.") else "ASMAC — RECME (Programa de Jóvenes)",
            year=year,
            date_sort=date_iso,
            page_count=pinfo.get("pages", 1),
            code=code,
            has_web_file=has_web,
        )
        next_id += 1

    # ------------------------------------------------------------------
    # 2. Construir los 25 artículos Help Desk únicos + 1 Directorio Mesa de Ayuda
    # ------------------------------------------------------------------
    selected_hd_files = [
        "Cómo crear mi cuenta en SISAS (y qué hacer si no llega el correo de confirmación).html",
        "Cómo entrar a SISAS (y qué ves al entrar).html",
        "Cómo cambiar mi contraseña.html",
        "Olvidé mi contraseña o mi cuenta está bloqueada.html",
        "Que pasa si no recuerdo la contraseña de Autorizacion_.html",
        "Cómo completar o corregir mis datos (mi ficha al 100 %).html",
        "Mi perfil está en validación_ qué significa y qué puedo hacer.html",
        "Mi credencial_ cómo descargar la digital y seguir la física.html",
        "¿Que sucede cuando los textos de las etiquetas o los campos en SISAS tienen palabras diferentes_.html",
        "Cómo reinscribirme (renovar mi membresía).html",
        "Registro Familiar_ inscribir a toda la familia con descuento.html",
        "Cómo inscribirme y pagar un evento.html",
        "Mis pagos_ ver lo que he pagado, comprobantes y facturas.html",
        "Becas y descuentos_ cómo se asignan y cómo se aplican al pagar.html",
        "Cómo solicitar un cambio de grupo.html",
        "Cómo registrar mis avances_ progresión, especialidades e insignias.html",
        "Scouter y Jefe de Grupo_ validar progresión, especialidades e insignias de mis jóvenes.html",
        "Jefe de Grupo_ cargos y permisos — por qué no veo a mi grupo.html",
        "Jefe de Grupo_ consultar a mis miembros y descargar reportes.html",
        "Jefe de Grupo_ dar de alta miembros nuevos (Reg. Express y carga masiva).html",
        "Jefe de Grupo_ aprobar o rechazar un cambio de grupo.html",
        "Jefe de Grupo_ cambiar de sección a un miembro.html",
        "Jefe de Grupo_ inscribir y pagar un evento por varios miembros.html",
        "Como cambiar en SISAS la fecha de inicio a un grupo Scout.html",
        "¿Qué es CONECTA_.html",
    ]

    for fname in selected_hd_files:
        parsed = hd_by_file_parsed.get(fname) or {}
        fallback = hd_all_txt.get(fname) or {}
        title = parsed.get("title") or fallback.get("title") or fname.replace(".html", "")
        raw_txt = (parsed.get("text") or fallback.get("text") or "").strip()
        src_url = parsed.get("url") or "https://helpdesk.scouts.org.mx/knowledgebase.php"
        imgs = parsed.get("images") or []
        subcat, sec, app_secs = helpdesk_subcategory(title, fname)

        # Algunos artículos clave tienen captura especial aunque no aparezca en parsed.images
        if fname == "Que pasa si no recuerdo la contraseña de Autorizacion_.html" and not imgs:
            imgs = [
                {
                    "src": "./Que pasa si no recuerdo la contraseña de Autorizacion__files/bK40dfPWm-.png",
                    "alt": "Pantalla SISAS de Autorización y recuperación de Contraseña de Autorización",
                }
            ]

        sections_html = build_helpdesk_paragraphs_html(raw_txt, imgs)
        doc_html = render_standalone_html(
            title=title,
            category="Guías SISAS, CONECTA y Soporte Digital",
            subcategory=subcat,
            badge="Guía Oficial Help Desk ASMAC",
            source_url=src_url,
            sections_html=sections_html,
        )
        full_txt = (
            f"GUÍA OFICIAL HELP DESK ASMAC: {title}\n"
            f"Categoría: {subcat}\nFuente: {src_url}\n\n"
            + raw_txt
        )
        register_new_doc(
            new_docs=new_docs,
            new_chunks=new_chunks,
            idx_num=next_id,
            filename=fname,
            rel_path=f"HelpDesk/{fname}",
            title=f"Guía SISAS/Help Desk: {title}",
            ext="HTML",
            raw_bytes=doc_html.encode("utf-8"),
            full_text=full_txt,
            category="Guías SISAS, CONECTA y Soporte Digital",
            subcategory=subcat,
            section=sec,
            section_label="Adultos y Dirigentes" if sec == "adultos" else "General / Todas las Secciones",
            applicable_sections=app_secs,
            origin="ASMAC — Help Desk / Mesa de Ayuda",
            year=2026,
            date_sort=CUTOFF_DATE,
            page_count=1,
            has_web_file=True,
            is_readable_html=True,
        )
        next_id += 1

    # Guía 26: Directorio de Mesa de Ayuda (Help Desk ASMAC) — Categorías KB y 11 Departamentos de Tickets
    hd_dir_sections = """
    <section class="card">
      <h2>¿Qué es la Mesa de Ayuda (Help Desk) de la ASMAC?</h2>
      <p>El portal <code>https://helpdesk.scouts.org.mx</code> es la Mesa de Ayuda y Base de Conocimientos (KB) oficial de la Oficina Scout Nacional de la Asociación de Scouts de México, A.C. (ASMAC). Reúne guías paso a paso sobre SISAS, CONECTA, credenciales, pagos y recepción de tickets de soporte.</p>
    </section>
    <section class="card">
      <h2>4 Categorías de la Base de Conocimientos (KB)</h2>
      <ul>
        <li><strong>Acceso y cuenta:</strong> Creación de cuenta en SISAS, inicio de sesión, cambio y recuperación de contraseña, contraseña de autorización, perfil en validación, completar ficha al 100 %, credencial digital/física y etiquetas de SISAS.</li>
        <li><strong>Eventos y pagos:</strong> Reinscripción anual, Registro Familiar (3 a 5 miembros: 25 %, 30 % o 35 % sobre cuota nacional), inscripción y pago a eventos, comprobantes y facturas (plazo de 30 días dentro del mismo año), becas y descuentos, y cambio de grupo (15 días por etapa; hasta 30 días en total).</li>
        <li><strong>Progresión, Especialidades y CONECTA:</strong> Registro de avances en Mi Currículum, validación por Scouter/Jefe de Grupo y uso de la línea/canal CONECTA.</li>
        <li><strong>Para Jefes de Grupo:</strong> Cargos y permisos, consulta y descarga de reportes (Reporte Scouter, Estado de cuenta de miembros), Reg. Express y carga masiva (.xlsx), aprobación o rechazo de cambios de grupo, cambio de sección e inscripción masiva a eventos.</li>
      </ul>
    </section>
    <section class="card">
      <h2>11 Departamentos Oficiales para Enviar un Ticket de Soporte</h2>
      <table>
        <thead><tr><th>Departamento / Área en Help Desk</th><th>Cuándo elegirlo</th></tr></thead>
        <tbody>
          <tr><td><strong>SISAS</strong></td><td>Errores de acceso, CURP duplicado, validación de ficha, reinscripción, pagos, facturación o reportes de grupo.</td></tr>
          <tr><td><strong>Red Colaborativa de Material Educativo (RECME)</strong></td><td>Dudas, incidencias o aportes sobre FAES, Especialidades FES, Plantillas PJOS y archivos educativos.</td></tr>
          <tr><td><strong>ExplorAPP y CarpetAPP</strong></td><td>Acceso, sincronización de progresión o incidencias técnicas en las aplicaciones móviles de progresión.</td></tr>
          <tr><td><strong>Comunidad Digital de Conocimiento (CDC)</strong></td><td>Acceso a cursos autogestivos, matrículas de Insignia de Madera / Punta de Flecha o descarga de constancias.</td></tr>
          <tr><td><strong>Adultos en el Movimiento</strong></td><td>Procesos de formación de adultos, acreditación, esquema IM 3.0 y acompañamiento CNAMS.</td></tr>
          <tr><td><strong>Protección a la Membresía</strong></td><td>Consultas o reportes vinculados con A Salvo del Peligro (Safe from Harm) y bienestar de la membresía.</td></tr>
          <tr><td><strong>Credenciales y Reconocimientos</strong></td><td>Emisión o envío físico de credenciales y registro de condecoraciones/reconocimientos.</td></tr>
          <tr><td><strong>Correo Electrónico Institucional</strong></td><td>Cuentas institucionales de Microsoft 365 / correo @scouts.org.mx para dirigentes y órganos.</td></tr>
          <tr><td><strong>Comunicación, Imagen y Redes Sociales</strong></td><td>Identidad gráfica, uso de marca oficial y canales de comunicación institucional.</td></tr>
          <tr><td><strong>General</strong></td><td>Orientación general cuando tu consulta no encaja en un sistema específico.</td></tr>
          <tr><td><strong>SOLO OSN Soporte TI</strong></td><td>Canal interno de soporte técnico para personal y estructura de la Oficina Scout Nacional.</td></tr>
        </tbody>
      </table>
    </section>
    """
    hd_dir_html = render_standalone_html(
        title="Directorio Oficial Help Desk ASMAC — Categorías KB y 11 Departamentos de Tickets",
        category="Guías SISAS, CONECTA y Soporte Digital",
        subcategory="Mesa de Ayuda (Help Desk) y CONECTA",
        badge="Directorio Oficial Help Desk",
        source_url="https://helpdesk.scouts.org.mx",
        sections_html=hd_dir_sections,
    )
    hd_dir_txt = (
        "DIRECTORIO OFICIAL HELP DESK ASMAC (helpdesk.scouts.org.mx)\n"
        "Reúne la Base de Conocimientos (Acceso y cuenta, Eventos y pagos, Para Jefes de Grupo, CONECTA) "
        "y los 11 departamentos oficiales para levantar un ticket: "
        "1. SISAS; 2. Red Colaborativa de Material Educativo (RECME); 3. ExplorAPP y CarpetAPP; "
        "4. Comunidad Digital de Conocimiento (CDC); 5. Adultos en el Movimiento; "
        "6. Protección a la Membresía; 7. Credenciales y Reconocimientos; "
        "8. Correo Electrónico Institucional; 9. Comunicación, Imagen y Redes Sociales; "
        "10. General; 11. SOLO OSN Soporte TI."
    )
    register_new_doc(
        new_docs=new_docs,
        new_chunks=new_chunks,
        idx_num=next_id,
        filename="Directorio_Help_Desk_ASMAC_Tickets_y_KB.html",
        rel_path="HelpDesk/Directorio_Help_Desk_ASMAC_Tickets_y_KB.html",
        title="Directorio Help Desk ASMAC: Categorías KB y 11 Departamentos de Tickets",
        ext="HTML",
        raw_bytes=hd_dir_html.encode("utf-8"),
        full_text=hd_dir_txt,
        category="Guías SISAS, CONECTA y Soporte Digital",
        subcategory="Mesa de Ayuda (Help Desk) y CONECTA",
        section="general",
        section_label="General / Todas las Secciones",
        applicable_sections=["general", "manada", "tropa", "comunidad", "clan", "adultos"],
        origin="ASMAC — Help Desk / Mesa de Ayuda",
        year=2026,
        date_sort=CUTOFF_DATE,
        page_count=1,
        has_web_file=True,
        is_readable_html=True,
    )
    next_id += 1

    # ------------------------------------------------------------------
    # 3. Construir 2 Guías HTML desde los Geniallys extraídos (FES y FAES)
    # ------------------------------------------------------------------
    geniallys = {g.get("title", ""): g for g in rh.get("genially", [])}
    g_fes = geniallys.get("Instructivo llenado FES | Genially") or {}
    g_faes = geniallys.get("Instructivo FAES | Genially") or {}

    g_fes_txt = g_fes.get("text", "")
    g_fes_sections = f"""
    <section class="card">
      <h2>Ejemplo Oficial de Llenado de Ficha de Especialidad Scout (FES)</h2>
      <p>Instructivo oficial publicado por RECME para llenar correctamente una <strong>Ficha de Especialidad Scout (FES)</strong> tomando como ejemplo la ficha de Manada <em>Primer Respondiente Junior</em> (Eje Temático: Salud y Bienestar).</p>
    </section>
    <section class="card">
      <h2>Contenido Completo del Instructivo Genially</h2>
      <p style="white-space:pre-wrap;">{html.escape(g_fes_txt)}</p>
    </section>
    """
    g_fes_html = render_standalone_html(
        title="Instructivo Oficial de Llenado FES — Ejemplo: Primer Respondiente Junior (Manada)",
        category="Especialidades Scouts (FES)",
        subcategory="Salud y Bienestar (Manada — Guía Ejemplo)",
        badge="Instructivo Genially RECME",
        source_url=g_fes.get("url", "https://view.genially.com"),
        sections_html=g_fes_sections,
    )
    register_new_doc(
        new_docs=new_docs,
        new_chunks=new_chunks,
        idx_num=next_id,
        filename="Instructivo_Llenado_FES_Primer_Respondiente_Junior.html",
        rel_path="RECME/Instructivo_Llenado_FES_Primer_Respondiente_Junior.html",
        title="Instructivo Llenado FES (Genially) — Ejemplo: Primer Respondiente Junior (Manada)",
        ext="HTML",
        raw_bytes=g_fes_html.encode("utf-8"),
        full_text=f"INSTRUCTIVO OFICIAL LLENADO FES — PRIMER RESPONDIENTE JUNIOR (MANADA)\n\n{g_fes_txt}",
        category="Especialidades Scouts (FES)",
        subcategory="Salud y Bienestar (Manada — Guía Ejemplo)",
        section="manada",
        section_label="Manada de Lobatos",
        applicable_sections=["manada", "adultos"],
        origin="ASMAC — RECME / Genially",
        year=2026,
        date_sort=CUTOFF_DATE,
        page_count=1,
        has_web_file=True,
        is_readable_html=True,
    )
    next_id += 1

    g_faes_txt = g_faes.get("text", "")
    g_faes_sections = f"""
    <section class="card">
      <h2>Ejemplo Oficial de Llenado de Ficha de Acción Educativa Scout (FAES)</h2>
      <p>Instructivo interactivo publicado por RECME que muestra paso a paso cómo llenar una FAES usando la ficha <em>Masterchefsito</em> (Manada de Lobatos — Cazadero Baloo / Habilidades para la Vida).</p>
    </section>
    <section class="card">
      <h2>Contenido Completo del Instructivo Genially</h2>
      <p style="white-space:pre-wrap;">{html.escape(g_faes_txt)}</p>
    </section>
    """
    g_faes_html = render_standalone_html(
        title="Instructivo Oficial FAES (Genially) — Ejemplo: Masterchefsito (Manada Baloo)",
        category="Plantillas PJOS, FAES y RECME",
        subcategory="Plantillas FAES y Especialidades (P4–P5)",
        badge="Instructivo Genially RECME",
        source_url=g_faes.get("url", "https://view.genially.com"),
        sections_html=g_faes_sections,
    )
    register_new_doc(
        new_docs=new_docs,
        new_chunks=new_chunks,
        idx_num=next_id,
        filename="Instructivo_FAES_Masterchefsito.html",
        rel_path="RECME/Instructivo_FAES_Masterchefsito.html",
        title="Instructivo FAES (Genially) — Ejemplo: Masterchefsito (Manada Baloo)",
        ext="HTML",
        raw_bytes=g_faes_html.encode("utf-8"),
        full_text=f"INSTRUCTIVO OFICIAL FAES — MASTERCHEFSITO (MANADA BALOO)\n\n{g_faes_txt}",
        category="Plantillas PJOS, FAES y RECME",
        subcategory="Plantillas FAES y Especialidades (P4–P5)",
        section="manada",
        section_label="Manada de Lobatos",
        applicable_sections=["manada", "adultos", "general"],
        origin="ASMAC — RECME / Genially",
        year=2026,
        date_sort=CUTOFF_DATE,
        page_count=1,
        has_web_file=True,
        is_readable_html=True,
    )
    next_id += 1

    # ------------------------------------------------------------------
    # 4. Construir 4 Guías HTML de Referencia del Portal RECME (INICIO, FAES 230, FES MLL/CC, Plantillas)
    # ------------------------------------------------------------------
    recme_logo_fig = inline_image_figure(
        "./BIBLIOTECA VIRTUAL 1_files/RECME-SCNCD.png",
        "Emblema oficial RECME — Red Colaborativa de Material Educativo y SCNCD (Subcomisión Nacional de Conocimiento Digital)",
    )
    fes_logo_fig = inline_image_figure(
        "./ESPECIALIDADES_files/WhatsApp Image 2026-09-22 at 20.03.06.jpeg",
        "Emblema oficial FES — Fichas de Especialidades Scout y los 4 Ejes Temáticos",
    )

    portal_sections = f"""
    <section class="card">
      <h2>¿Qué es RECME y qué significan SCNCD y CNAMS?</h2>
      <p><strong>RECME</strong> es la <em>Red Colaborativa de Material Educativo</em> de la Asociación de Scouts de México, A.C. (<code>https://recme.scouts.org.mx</code>), impulsada por la <strong>SCNCD</strong> (<em>Subcomisión Nacional de Conocimiento Digital</em>) en coordinación con la <strong>CNPJ</strong> (<em>Comisión Nacional de Programa de Jóvenes</em>) y la <strong>CNAMS</strong> (<em>Comisión Nacional de Adultos en el Movimiento Scout</em>).</p>
      <p>La plataforma centraliza en su Biblioteca Virtual: <strong>FAES</strong> (Fichas de Acciones Educativas Scouts), <strong>Especialidades Scout (FES)</strong>, <strong>Plantillas editables del PJOS</strong> y formatos para evaluación y formación de adultos.</p>
      {recme_logo_fig}
    </section>
    <section class="card">
      <h2>Estructura del Acervo RECME y Estado de Descarga (11/11/2026)</h2>
      <ul>
        <li><strong>Descargado completo en BiblioTech:</strong> todas las 46 plantillas PJOS y de Adultos/CNAMS (<code>P1.*</code> a <code>P10.*</code>), Formato de Proyecto v1.1, las <strong>18 Especialidades FES de Comunidad de Caminantes</strong> y todos los portales HTML/Genially de consulta.</li>
        <li><strong>Pendiente por incorporar (archivos individuales):</strong> los PDFs individuales de Especialidades FES de <strong>Manada</strong> (aunque aquí se documenta el índice oficial de las 8 fichas de Salud y Bienestar y el ejemplo completo de <em>Primer Respondiente Junior</em>), <strong>Tropa de Scouts</strong> y <strong>Clan de Rovers</strong>, así como las 230 FAES individuales.</li>
      </ul>
    </section>
    """
    portal_html = render_standalone_html(
        title="Portal Oficial RECME — Red Colaborativa de Material Educativo (SCNCD / ASMAC)",
        category="Plantillas PJOS, FAES y RECME",
        subcategory="Formación de Adultos CNAMS y Anexos FES (P10)",
        badge="Portal Oficial RECME",
        source_url="https://recme.scouts.org.mx",
        sections_html=portal_sections,
    )
    portal_txt = (
        "PORTAL OFICIAL RECME (recme.scouts.org.mx) — Red Colaborativa de Material Educativo de la ASMAC. "
        "Impulsada por la SCNCD (Subcomisión Nacional de Conocimiento Digital), CNPJ (Comisión Nacional de Programa de Jóvenes) y CNAMS (Comisión Nacional de Adultos en el Movimiento Scout). "
        "Organiza la Biblioteca Virtual en FAES, Especialidades Scout (FES) y Plantillas por sección y para Adultos. "
        "Corte al 11/11/2026: se incorporaron íntegros los 47 documentos de Adultos y Plantillas PJOS, las 18 FES de Comunidad de Caminantes y todas las páginas HTML/Genially; quedan pendientes los PDFs individuales de FES para Manada, Tropa y Clan."
    )
    register_new_doc(
        new_docs=new_docs,
        new_chunks=new_chunks,
        idx_num=next_id,
        filename="Portal_Oficial_RECME_SCNCD_ASMAC.html",
        rel_path="RECME/Portal_Oficial_RECME_SCNCD_ASMAC.html",
        title="Portal Oficial RECME — Red Colaborativa de Material Educativo (SCNCD)",
        ext="HTML",
        raw_bytes=portal_html.encode("utf-8"),
        full_text=portal_txt,
        category="Plantillas PJOS, FAES y RECME",
        subcategory="Formación de Adultos CNAMS y Anexos FES (P10)",
        section="general",
        section_label="General / Todas las Secciones",
        applicable_sections=["general", "manada", "tropa", "comunidad", "clan", "adultos"],
        origin="ASMAC — RECME / SCNCD",
        year=2026,
        date_sort=CUTOFF_DATE,
        page_count=1,
        has_web_file=True,
        is_readable_html=True,
    )
    next_id += 1

    # Catálogo FAES 230
    faes_sections = """
    <section class="card">
      <h2>Estructura del Catálogo FAES en RECME (230 Fichas Totales)</h2>
      <p>Las <strong>Fichas de Acciones Educativas Scouts (FAES)</strong> se organizan por sección y por sus cuatro ámbitos simbólicos vinculados a los 4 Ejes Temáticos:</p>
      <table>
        <thead><tr><th>Sección</th><th>Salud y Bienestar</th><th>Habilidades para la Vida</th><th>Paz y Participación Comunitaria</th><th>Medio Ambiente y Sustentabilidad</th><th>Total</th></tr></thead>
        <tbody>
          <tr><td><strong>Manada de Lobatos (Cazaderos)</strong></td><td>Raksha (23)</td><td>Baloo (27)</td><td>Hermano Gris (11)</td><td>Bagheera (12)</td><td><strong>73</strong></td></tr>
          <tr><td><strong>Tropa de Scouts (Rumbos)</strong></td><td>Tortuga Lora (12)</td><td>Venado cola blanca (23)</td><td>Quetzal (8)</td><td>Ocelote (11)</td><td><strong>54</strong></td></tr>
          <tr><td><strong>Comunidad de Caminantes (Senderos)</strong></td><td>Cenit (18)</td><td>Cúspide (22)</td><td>Cumbre (6)</td><td>Cima (11)</td><td><strong>57</strong></td></tr>
          <tr><td><strong>Clan de Rovers (Rutas)</strong></td><td>Kikapú (10)</td><td>Otomí (14)</td><td>Wixárica (10)</td><td>Maya (12)</td><td><strong>46</strong></td></tr>
        </tbody>
      </table>
      <div class="note"><strong>Alcance del respaldo:</strong> En esta base se incluyen las plantillas oficiales P4.1, P4.2 y P4.3 para redactar FAES, el instructivo interactivo <em>Masterchefsito</em> y la taxonomía completa de las 230 fichas por Cazadero, Rumbo, Sendero y Ruta.</div>
    </section>
    """
    faes_html = render_standalone_html(
        title="Catálogo Oficial FAES RECME — 230 Fichas por Cazaderos, Rumbos, Senderos y Rutas",
        category="Plantillas PJOS, FAES y RECME",
        subcategory="Plantillas FAES y Especialidades (P4–P5)",
        badge="Catálogo Oficial RECME FAES",
        source_url="https://recme.scouts.org.mx/index.php/faes",
        sections_html=faes_sections,
    )
    faes_txt = (
        "CATÁLOGO OFICIAL FAES EN RECME (230 FICHAS TOTALES POR SECCIÓN Y ÁMBITO SIMBÓLICO):\n"
        "- Manada de Lobeznas y Lobatos (73 fichas en Cazaderos): Raksha / Salud y Bienestar (23), Baloo / Habilidades para la Vida (27), Bagheera / Medio Ambiente y Sustentabilidad (12), Hermano Gris / Paz y Participación Comunitaria (11).\n"
        "- Tropa de Scouts (54 fichas en Rumbos): Tortuga Lora / Salud y Bienestar (12), Venado cola blanca / Habilidades para la Vida (23), Quetzal / Paz y Participación Comunitaria (8), Ocelote / Medio Ambiente y Sustentabilidad (11).\n"
        "- Comunidad de Caminantes (57 fichas en Senderos): Cenit / Salud y Bienestar (18), Cúspide / Habilidades para la Vida (22), Cumbre / Paz y Participación Comunitaria (6), Cima / Medio Ambiente y Sustentabilidad (11).\n"
        "- Clan de Rovers (46 fichas en Rutas): Kikapú / Salud y Bienestar (10), Otomí / Habilidades para la Vida (14), Wixárica / Paz y Participación Comunitaria (10), Maya / Medio Ambiente y Sustentabilidad (12)."
    )
    register_new_doc(
        new_docs=new_docs,
        new_chunks=new_chunks,
        idx_num=next_id,
        filename="Catalogo_FAES_RECME_230_Fichas.html",
        rel_path="RECME/Catalogo_FAES_RECME_230_Fichas.html",
        title="Catálogo FAES RECME — 230 Fichas (Cazaderos, Rumbos, Senderos y Rutas)",
        ext="HTML",
        raw_bytes=faes_html.encode("utf-8"),
        full_text=faes_txt,
        category="Plantillas PJOS, FAES y RECME",
        subcategory="Plantillas FAES y Especialidades (P4–P5)",
        section="general",
        section_label="General / Todas las Secciones",
        applicable_sections=["general", "manada", "tropa", "comunidad", "clan", "adultos"],
        origin="ASMAC — RECME",
        year=2026,
        date_sort=CUTOFF_DATE,
        page_count=1,
        has_web_file=True,
        is_readable_html=True,
    )
    next_id += 1

    # Catálogo Especialidades FES (Manada Salud y Bienestar + Comunidad 18)
    fes_cat_sections = f"""
    <section class="card">
      <h2>Fichas de Especialidades Scout (FES) — Inventario RECME al 11/11/2026</h2>
      {fes_logo_fig}
      <p>Cada Especialidad Scout desarrolla competencias específicas en 4 etapas graduales (<strong>Identifico → Conozco → Aplico → Comparto</strong>) vinculadas a uno de los cuatro Ejes Temáticos y a los Objetivos de Desarrollo Sostenible (ODS).</p>
      <h3>18 Especialidades FES de Comunidad de Caminantes (Descargables Íntegras en PDF)</h3>
      <ul>
        <li><strong>Salud y Bienestar (7):</strong> Autocuidado e higiene, Gestión de riesgos en áreas naturales (2 págs.), Primer Respondiente Juvenil Avanzado, Primeros Auxilios Agrestes, Promotor de la Salud Juvenil Avanzado, Taekwondo, Triatlón Junior B.</li>
        <li><strong>Habilidades para la Vida (8):</strong> Cocina en campamento, Debate Colegial, Diseño, Patronaje y confección de textilería escénica, Gestiono mi tiempo, Idiomas, Mantenimiento Preventivo Automotriz, Técnico en caracterización escénica, visagismo y maquillaje de danza folclórica, Traductor.</li>
        <li><strong>Medio Ambiente y Sustentabilidad (1):</strong> Guardianes del arbolado (etiqueta Naturaleza y biodiversidad).</li>
        <li><strong>Paz y Participación Comunitaria (2):</strong> La Palabra como guía Litúrgica, Servidor Litúrgico.</li>
      </ul>
      <h3>8 Especialidades FES de Manada — Salud y Bienestar (Listadas en RECME)</h3>
      <table>
        <thead><tr><th>Nombre de Especialidad (Manada)</th><th>Archivo en RECME</th><th>Fecha RECME</th><th>Etiqueta temática</th></tr></thead>
        <tbody>
          <tr><td>Primer Respondiente Junior</td><td><code>FES_MLL_SYB_PRIMER RESPONDIENTE JUNIOR.pdf</code></td><td>23 Septiembre 2026</td><td>A salvo del peligro (disponible ejemplo Genially completo)</td></tr>
          <tr><td>Promotor de la Salud Junior</td><td><code>FES_MLL_SYB_PROMOTOR DE LA SALUD JUNIOR.pdf</code></td><td>23 Septiembre 2026</td><td>Salud</td></tr>
          <tr><td>A Salvo del Peligro</td><td><code>FES_MLL_SYB_A SALVO DEL PELIGRO.pdf</code></td><td>24 Septiembre 2026</td><td>A salvo del peligro</td></tr>
          <tr><td>Buceo</td><td><code>FES_MLL_SYB_BUCEO.pdf</code></td><td>24 Septiembre 2026</td><td>Salud y Bienestar</td></tr>
          <tr><td>Cuidado Personal</td><td><code>FES_MLL_SYB_CUIDADO PERSONAL.pdf</code></td><td>24 Septiembre 2026</td><td>Salud</td></tr>
          <tr><td>Natación</td><td><code>FES_MLL_SYB_NATACION.pdf</code></td><td>25 Septiembre 2026</td><td>Deportes y cultura física</td></tr>
          <tr><td>Taekwondo</td><td><code>FES_MLL_SYB_TAEKWONDO.pdf</code></td><td>25 Septiembre 2026</td><td>Deportes y cultura física</td></tr>
          <tr><td>Triatlón infantil</td><td><code>FES_MLL_SYB_TRIATLON INFANTIL.pdf</code></td><td>25 Septiembre 2026</td><td>Deportes y cultura física</td></tr>
        </tbody>
      </table>
      <div class="note"><strong>Nota de cobertura transparente:</strong> Al corte del 11/11/2026 están cargados los 18 PDFs completos de Comunidad de Caminantes y el instructivo completo de <em>Primer Respondiente Junior</em> (Manada). Los PDFs individuales de especialidades de Manada, Tropa de Scouts y Clan de Rovers están pendientes de incorporación en próximas entregas.</div>
    </section>
    """
    fes_cat_html = render_standalone_html(
        title="Catálogo Oficial de Especialidades Scout (FES) — Comunidad y Manada (RECME)",
        category="Especialidades Scouts (FES)",
        subcategory="Catálogo y Guía del Sistema FES",
        badge="Catálogo Oficial FES RECME",
        source_url="https://recme.scouts.org.mx/index.php/especialidades",
        sections_html=fes_cat_sections,
    )
    fes_cat_txt = (
        "CATÁLOGO OFICIAL DE ESPECIALIDADES SCOUT (FES) EN RECME (CORTE 11/11/2026):\n"
        "Criterios universales de toda FES: Identifico, Conozco, Aplico y Comparto, con Eje Temático, Enfoque, Tiempo aproximado y ODS vinculados.\n"
        "Comunidad de Caminantes (18 PDFs completos incorporados): Cocina en campamento, Debate Colegial, Diseño Patronaje y confección de textilería escénica, Gestiono mi tiempo, Idiomas, Mantenimiento Preventivo Automotriz, Técnico en caracterización escénica/visagismo/danza folclórica, Traductor, Guardianes del arbolado, La Palabra como guía Litúrgica, Servidor Litúrgico, Autocuidado e higiene, Gestión de riesgos en áreas naturales, Primer Respondiente Juvenil Avanzado, Primeros Auxilios Agrestes, Promotor de la Salud Juvenil Avanzado, Taekwondo, Triatlón Junior B.\n"
        "Manada Salud y Bienestar (8 fichas catalogadas en HTML RECME, publicadas entre 23 y 25 de septiembre de 2026): Primer Respondiente Junior (con instructivo Genially completo), Promotor de la Salud Junior, A Salvo del Peligro, Buceo, Cuidado Personal, Natación, Taekwondo, Triatlón infantil.\n"
        "Pendiente de descarga: archivos PDF individuales de especialidades de Manada, Tropa de Scouts y Clan de Rovers."
    )
    register_new_doc(
        new_docs=new_docs,
        new_chunks=new_chunks,
        idx_num=next_id,
        filename="Catalogo_Especialidades_FES_Comunidad_y_Manada.html",
        rel_path="RECME/Catalogo_Especialidades_FES_Comunidad_y_Manada.html",
        title="Catálogo de Especialidades Scout (FES) — Comunidad (18) y Manada (8)",
        ext="HTML",
        raw_bytes=fes_cat_html.encode("utf-8"),
        full_text=fes_cat_txt,
        category="Especialidades Scouts (FES)",
        subcategory="Catálogo y Guía del Sistema FES",
        section="general",
        section_label="General / Todas las Secciones",
        applicable_sections=["general", "comunidad", "manada", "tropa", "clan", "adultos"],
        origin="ASMAC — RECME",
        year=2026,
        date_sort=CUTOFF_DATE,
        page_count=1,
        has_web_file=True,
        is_readable_html=True,
    )
    next_id += 1

    # Catálogo Oficial Plantillas RECME (Adultos & Secciones)
    plantillas_sections = """
    <section class="card">
      <h2>Estructura de Categorías de Plantillas en RECME (Biblioteca Virtual)</h2>
      <p>En la Biblioteca Virtual de Plantillas de RECME se agrupan por destinatario:</p>
      <ul>
        <li><strong>Plantillas de Adultos en el Movimiento Scout (familias P1–P10):</strong> Diagnóstico (6), Evaluación (6), Herramientas de seguimiento de la progresión personal (4), Plantillas para FAES y especialidades (6), Ciclo de Programa (2), Acta de Consejo de Nivel (1), Auxiliares de registro de progresión (4), Escenarios de aprendizaje (2), Solicitudes Mundo Mejor (6) y Solicitud de Insignia Final / Terminal (4).</li>
        <li><strong>Por Sección Juvenil:</strong> Plantillas de Lobeznas y Lobatos (5), Plantillas de Scouts (6), Plantillas de Caminantes (12), Plantillas de Clan de Rovers (13), Plantillas de Formación Directores y Formadores (3).</li>
      </ul>
      <h3>Fechas Oficiales de Publicación en RECME (2026)</h3>
      <ul>
        <li><strong>19 de abril de 2026:</strong> Matrices de Diagnóstico Inicial P1.0.x / P1.1–P1.4 y Cédulas Auxiliares de Evaluación P2.0.x / P2.1–P2.4.</li>
        <li><strong>20 de abril y 1 de mayo de 2026:</strong> Libro Seeonee P3.1, Mapa de Exploraciones P3.2TS, Hoja de Caminata P3.3.1, Pasaporte Comunidad P3.3.2, Mapa de Rutas P3.4, Plantillas FAES/FES P4–P5, Proyecto P6.2, Acta P6.4, Ciclo P6.5, Auxiliares de Progresión P7.1–P7.4.</li>
        <li><strong>3 de junio de 2026:</strong> Plantilla Evento P6.1 y Plantilla Programa P6.3.</li>
        <li><strong>2 de julio de 2026:</strong> Solicitudes Mundo Mejor P8.1–P8.5 y P8.7.</li>
        <li><strong>6 de agosto de 2026:</strong> Formatos de Solicitud de Insignia Final y Terminal P9.1–P9.4 (Alfa, Águila Real, Everest, Baden Powell — versiones Obsidiana y Jade).</li>
        <li><strong>23 de septiembre de 2026:</strong> Anexos de Especialidad P10.4 Horizontal y P10.5 Vertical.</li>
        <li><strong>15 de octubre de 2026:</strong> Plantilla Formato Ciclo de Programa P9.5 2026V2.</li>
      </ul>
    </section>
    """
    plantillas_html = render_standalone_html(
        title="Catálogo Oficial de Plantillas PJOS, Evaluación y Formación (RECME)",
        category="Plantillas PJOS, FAES y RECME",
        subcategory="Formación de Adultos CNAMS y Anexos FES (P10)",
        badge="Catálogo Oficial Plantillas RECME",
        source_url="https://recme.scouts.org.mx/index.php/plantillas",
        sections_html=plantillas_sections,
    )
    plantillas_txt = (
        "CATÁLOGO OFICIAL DE PLANTILLAS RECME (CATEGORÍAS Y FECHAS 2026):\n"
        "Incluye las 46 plantillas numeradas P1–P10 más Formato de Proyecto v1.1 publicadas entre el 19 de abril y el 15 de octubre de 2026 para Manada, Tropa, Comunidad, Clan, Adultos y Formación de Directores/Formadores."
    )
    register_new_doc(
        new_docs=new_docs,
        new_chunks=new_chunks,
        idx_num=next_id,
        filename="Catalogo_Plantillas_RECME_2026.html",
        rel_path="RECME/Catalogo_Plantillas_RECME_2026.html",
        title="Catálogo de Plantillas PJOS, Evaluación y Formación RECME (2026)",
        ext="HTML",
        raw_bytes=plantillas_html.encode("utf-8"),
        full_text=plantillas_txt,
        category="Plantillas PJOS, FAES y RECME",
        subcategory="Formación de Adultos CNAMS y Anexos FES (P10)",
        section="adultos",
        section_label="Adultos y Dirigentes",
        applicable_sections=["adultos", "general", "manada", "tropa", "comunidad", "clan"],
        origin="ASMAC — RECME",
        year=2026,
        date_sort="2026-10-15",
        page_count=1,
        has_web_file=True,
        is_readable_html=True,
    )
    next_id += 1

    # ------------------------------------------------------------------
    # 5. Incluir 4 Imágenes Oficiales RECME / FES / CNPJ / Help Desk
    # ------------------------------------------------------------------
    official_images = [
        (
            DOWNLOADS_RECME / "BIBLIOTECA VIRTUAL 1_files" / "RECME-SCNCD.png",
            "RECME-SCNCD.png",
            "PNG",
            "Emblema Oficial RECME — Red Colaborativa de Material Educativo (SCNCD)",
            "Emblema oficial circular de la Red Colaborativa de Material Educativo (RECME) junto con las siglas de la Subcomisión Nacional de Conocimiento Digital (SCNCD) y elementos educativos y digitales de la ASMAC.",
            "general",
            "General / Todas las Secciones",
            ["general", "adultos", "manada", "tropa", "comunidad", "clan"],
        ),
        (
            DOWNLOADS_RECME / "ESPECIALIDADES_files" / "WhatsApp Image 2026-09-22 at 20.03.06.jpeg",
            "Emblema-FES-Fichas-Especialidades-Scout.webp",
            "WEBP",
            "Emblema Oficial FES — Fichas de Especialidades Scout (4 Ejes Temáticos)",
            "Emblema oficial circular con el texto 'Fichas de Especialidades Scout', la Flor de Lis Mundial y los cuatro círculos de los Ejes Temáticos: Salud y Bienestar (azul), Paz y Participación Comunitaria (rosa), Habilidades para la Vida (naranja) y Medio Ambiente y Sustentabilidad (verde).",
            "general",
            "General / Todas las Secciones",
            ["general", "manada", "tropa", "comunidad", "clan", "adultos"],
        ),
        (
            DOWNLOADS_RECME / "BIBLIOTECA VIRTUAL 1_files" / "Logo-CNPJ-2022-01.png",
            "Logo-Oficial-CNPJ-ASMAC.png",
            "PNG",
            "Logotipo Oficial CNPJ — Comisión Nacional de Programa de Jóvenes",
            "Logotipo oficial de la Comisión Nacional de Programa de Jóvenes (CNPJ) de la Asociación de Scouts de México, A.C., presente en los documentos PJOS, FAES y Especialidades FES.",
            "general",
            "General / Todas las Secciones",
            ["general", "manada", "tropa", "comunidad", "clan", "adultos"],
        ),
        (
            DOWNLOADS_RECME / "Que pasa si no recuerdo la contraseña de Autorizacion__files" / "bK40dfPWm-.png",
            "SISAS-Recuperar-Contrasena-Autorizacion.png",
            "PNG",
            "Diagrama SISAS — Recuperar Contraseña de Autorización (Help Desk)",
            "Captura oficial del menú 'Autorización' en SISAS que muestra el recuadro de ingreso de Contraseña de Autorización y el botón morado 'Recuperar contraseña' para restablecerla vía correo electrónico registrado.",
            "general",
            "General / Todas las Secciones",
            ["general", "adultos", "manada", "tropa", "comunidad", "clan"],
        ),
    ]

    for img_path, fname, ext, title, desc, sec, seclabel, app_secs in official_images:
        raw_bytes = img_path.read_bytes()
        register_new_doc(
            new_docs=new_docs,
            new_chunks=new_chunks,
            idx_num=next_id,
            filename=fname,
            rel_path=f"RECME/Imagenes/{fname}",
            title=title,
            ext=ext,
            raw_bytes=raw_bytes,
            full_text=f"{title}\n\n{desc}",
            category="Identidad Gráfica y Recursos Visuales",
            subcategory="Emblemas RECME, FES y Soporte SISAS",
            section=sec,
            section_label=seclabel,
            applicable_sections=app_secs,
            origin="ASMAC — RECME / Help Desk",
            year=2026,
            date_sort=CUTOFF_DATE,
            page_count=1,
            has_web_file=True,
        )
        next_id += 1

    all_docs = base_docs + new_docs
    all_chunks = base_chunks + new_chunks

    # Actualizar estadísticas exactas de catalog.json
    by_section = Counter(d.get("section") for d in all_docs if d.get("section"))
    by_category = Counter(d.get("category") for d in all_docs if d.get("category"))
    by_ext = Counter(d.get("ext") for d in all_docs if d.get("ext"))
    by_year = Counter(str(d.get("year")) for d in all_docs if d.get("year"))

    catalog["documents"] = all_docs
    catalog["stats"] = {
        **catalog.get("stats", {}),
        "backup_cutoff_date": CUTOFF_DATE,
        "backup_cutoff_display": CUTOFF_DISPLAY,
        "unique_documents": len(all_docs),
        "total_scanned_files": len(all_docs) + len(catalog.get("duplicates_report", [])),
        "total_searchable_chunks": len(all_chunks),
        "by_section": dict(by_section),
        "by_category": dict(by_category),
        "by_ext": dict(by_ext),
        "by_year": dict(sorted(by_year.items(), reverse=True)),
    }

    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")
    chunks_path.write_text(json.dumps(all_chunks, ensure_ascii=False), encoding="utf-8")

    readable_count = sum(
        1 for d in all_docs if d.get("ext") != "HTML" or d.get("is_readable_html") is True
    )
    print(f"Base docs preserved: {len(base_docs)}")
    print(f"New docs added: {len(new_docs)} (total catalog: {len(all_docs)}, readable/downloadable UI docs: {readable_count})")
    print(f"New chunks added: {len(new_chunks)} (total chunks: {len(all_chunks)})")
    print(f"Release v1.0 staged files: {len(list(RELEASE_STAGE_DIR.glob('*')))}")
    print("Categories count (active UI docs):", Counter(d["category"] for d in all_docs if d.get("ext") != "HTML" or d.get("is_readable_html") is True))


if __name__ == "__main__":
    main()
