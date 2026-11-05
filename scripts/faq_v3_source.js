// Fuente editorial del banco ampliado de preguntas frecuentes V3.
// Cada respuesta se fundamenta en documentos del catálogo oficial.
// El script scripts/build_faq_v3.js valida el documento y genera data/faq_v3.json.
module.exports = [
  // ============================================================
  // PRIMEROS AUXILIOS Y SEGURIDAD
  // ============================================================
  {
    q: "¿Qué debe hacer un scout como primer respondiente ante una emergencia?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "01 Manual Scout de Primeros Auxilios.pdf",
    page: 6,
    ans: `**El primer respondiente es la persona que llega primero al lugar y brinda cuidados inmediatos sin sustituir a los servicios médicos.** El Manual Scout de Primeros Auxilios marca una secuencia clara:

- **No asumir riesgos:** primero protege tu propia vida y la de testigos; no atiendas si el lugar es inseguro.
- **Controlar la situación** para poder acceder sin peligro.
- **Atender a la persona lesionada** y actuar por etapas.
- **Tener el primer contacto**, pedir ayuda y **no intentar resolverlo todo solo**.
- **Identificarte** (nombre y Asociación) y dar la ubicación exacta al 911, con número de lesionados y tipo de ayuda necesaria.

El manual insiste en **no mover al accidentado** hasta conocer su estado, salvo tres casos: para darle primeros auxilios, para evitar que sus heridas se agraven o para ponerlo a salvo de un peligro mayor. Tampoco se deben dar remedios caseros ni medicamentos.

**Regla de oro:** en una emergencia real, activa el 911 y sigue las indicaciones de los profesionales.`,
  },
  {
    q: "¿Qué significan la evaluación AVDI y el ABC en primeros auxilios?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "01 Manual Scout de Primeros Auxilios.pdf",
    page: 9,
    ans: `La valoración inicial del paciente se hace en dos pasos complementarios.

**1. Nivel de conciencia (método AVDI):**
- **A:** alerta.
- **V:** responde a estímulos verbales.
- **D:** responde solo al dolor.
- **I:** inconsciente.

**2. Prioridades vitales (ABC):**
- **A (Airway):** abrir la vía aérea. En sospecha de lesión cervical se usa tracción mandibular; si no es posible, inclinación de cabeza y elevación del mentón.
- **B (Breathing):** comprobar que respira con la técnica **VOS** (ver, oír y sentir) durante **al menos 10 segundos**.
- **C (Circulation):** revisar pulso y controlar hemorragias. El pulso se busca con los dedos índice y medio a un lado del cuello; **nunca con el pulgar**, porque se confunde con el pulso propio.

Si la persona está **inconsciente**, el manual indica aplicar el protocolo **CAB**: empezar por circulación/compresiones antes que por ventilaciones.`,
  },
  {
    q: "¿Cómo se realiza la reanimación cardiopulmonar (RCP) según el manual scout?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "01 Manual Scout de Primeros Auxilios.pdf",
    page: 12,
    ans: `La **RCP** se aplica cuando hay paro cardiorrespiratorio: la circulación y la respiración se interrumpen de forma brusca.

**Pasos que describe el manual:**
1. Verificar que el lugar sea seguro y **activar el 911**.
2. Comprobar consciencia, respiración y pulso.
3. Abrir la vía aérea y comenzar compresiones en el centro del pecho.
4. **Si estás solo:** dar **100 compresiones por minuto** hasta que llegue personal especializado.
5. **Si son dos personas:** hacer ciclos de **30 compresiones por 2 ventilaciones**, sin detenerse.

**Se puede suspender solo si:**
- La persona muestra mejoría notoria.
- Llega personal médico y toma el relevo.
- Existe un peligro que obligue a movilizar a la persona.
- Hay agotamiento extremo del reanimador.
- Un médico presente lo indica.

No se debe interrumpir por curiosidad ni para buscar objetos; el objetivo es mantener oxigenado el cerebro.`,
  },
  {
    q: "¿Cómo se atiende a una persona que se está atragantando?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "01 Manual Scout de Primeros Auxilios.pdf",
    page: 10,
    ans: `El signo universal de atragantamiento es **llevarse las manos al cuello**. La conducta cambia según si la persona puede toser o no.

**Si aún tose o puede hablar:**
- Anímala a **toser con fuerza**; la tos puede expulsar el objeto.
- **No des golpes en la espalda** ni metas los dedos a ciegas: puedes empujar el objeto más adentro.

**Si no puede toser, hablar ni respirar:**
- Aplica la **maniobra de Heimlich**: colócate detrás, rodea el abdomen con los brazos y haz compresiones rápidas hacia adentro y hacia arriba.
- Repite hasta que el objeto salga, la persona tosa o respire, o pierda el conocimiento.
- Si queda inconsciente, **inicia RCP** y llama al 911.

**Embarazadas o personas obesas:** las manos van al **centro del pecho, sobre el esternón**, no al abdomen, para no lesionar al bebé.

**Prevención:** no dar a niños pequeños botones, semillas, globos, monedas, alimentos con cáscara o hueso; no dejarlos comer jugando ni dormidos.`,
  },
  {
    q: "¿Cómo se controla una hemorragia externa y qué es el estado de choque?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "01 Manual Scout de Primeros Auxilios.pdf",
    page: 13,
    ans: `**Control de hemorragias externas:**
1. Usa **guantes, lentes y cubrebocas**; si no tienes, usa gasas, apósitos o tela limpia para evitar contacto con sangre.
2. Haz **presión directa** sobre la herida con una gasa seca y limpia.
3. Si la gasa se moja, **coloca otra encima sin retirar la primera**: quitarla puede arrastrar el coágulo.
4. Si no cede, suma **presión indirecta** sobre la arteria más cercana y **eleva la extremidad** por arriba del corazón.
5. Mantén a la persona en calma y en reposo; eso baja el ritmo cardíaco y ayuda a coagular.

**Estado de choque:** piel pálida y fría, sudoración profusa, pulso rápido y débil, respiración rápida y superficial, baja de temperatura, pupilas dilatadas y disminución de la presión.

**Qué hacer:** llamar al 911, evaluar ABC, controlar hemorragias, **elevar los pies 30 cm** (posición de Trendelenburg), cubrir a la persona y trasladarla cuanto antes.`,
  },
  {
    q: "¿Cómo se limpia y cubre una herida correctamente?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "01 Manual Scout de Primeros Auxilios.pdf",
    page: 15,
    ans: `**Limpieza de una herida:**
1. Lávate las manos y usa guantes.
2. Retira la ropa que cubre la herida.
3. Lava con **agua y jabón** o suero fisiológico a chorro, **de adentro hacia fuera**, dos o tres veces.
4. Aplica desinfectante en una gasa estéril (povidona yodada, clorhexidina, agua oxigenada) y limpia de adentro hacia fuera.
5. Cubre con gasa estéril y sujeta con venda o esparadrapo.

**Lo que NO se debe hacer:**
- Aplicar remedios caseros, alcohol o algodón.
- Poner antibióticos o medicamentos sin indicación.
- **Extraer un objeto grande clavado**: puede estar haciendo de tapón. Inmovilízalo y busca atención médica.

En lugares remotos, si no hay material, lava con abundante agua potable, cubre y traslada lo antes posible.`,
  },
  {
    q: "¿Cómo se clasifican las quemaduras y cómo se atienden?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "01 Manual Scout de Primeros Auxilios.pdf",
    page: 15,
    ans: `Una quemadura puede ser por **calor, frío o químicos**, no solo por fuego.

**Clasificación:**
- **1.º grado (epidérmica):** solo la capa superficial de la piel; hay enrojecimiento y dolor, sin romper la piel.
- **2.º grado:** afecta capas más profundas; hay ampollas y dolor intenso.
- **3.º grado:** destruye tejido; puede no haber dolor por daño a los nervios y requiere atención urgente.

**Atención de 2.º grado:**
1. Lavar manos y usar guantes.
2. Retirar anillos, relojes y cinturones.
3. Poner la zona bajo **agua corriente 15 minutos o más** si sigue el dolor.
4. Cubrir con apósito estéril o lienzo limpio.
5. Trasladar a atención médica.

**3.º grado:** activar el 911, detener el proceso de la quemadura, revisar ABC, no retirar tejidos y cubrir con material poco adherente. Si la zona es menor al 15 %, hidratar con solución fisiológica o agua potable.

**Nunca** revientes ampollas ni apliques pasta dental, manteca o remedios caseros.`,
  },
  {
    q: "¿Qué es la hipotermia y cómo se atiende en campamento?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "01 Manual Scout de Primeros Auxilios.pdf",
    page: 16,
    ans: `La **hipotermia** es la baja de la temperatura interna del cuerpo **por debajo de 35 °C**. Ocurre por exposición prolongada al frío, ropa mojada, viento o inmersión en agua.

**Señales:** temblor, piel fría, confusión, somnolencia, respiración y pulso lentos. En casos graves la persona puede perder la conciencia.

**Atención:**
- Llevarla a un lugar tibio y cubrirla con mantas.
- Evaluar si respira y tiene pulso; si no, **iniciar RCP**.
- Retirar la ropa mojada y moverla con cuidado.
- No dar bebidas alcohólicas ni frotar la piel con fuerza.
- Trasladar a atención médica.

**Prevención:** vestir por capas, llevar impermeable, cambiar ropa mojada, comer e hidratarse, y revisar el pronóstico antes de salir.`,
  },
  {
    q: "¿Cómo se reconoce y atiende un golpe de calor o insolación?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 83,
    ans: `El **golpe de calor** ocurre por exposición prolongada al sol y actividad física intensa, con pérdida rápida de agua y sales.

**Síntomas:** piel roja y caliente, sudoración, ansiedad, dolor de cabeza, convulsiones, temperatura corporal alta y, en casos graves, pérdida del conocimiento.

**Atención:**
1. Retirar a la persona del sol y del calor.
2. Enfriarla con compresas de agua tibia o fría.
3. Dar líquidos por vía oral si está consciente.
4. Trasladarla para atención médica.
5. Si pierde la conciencia, revisar respiración y pulso y activar el 911.

**Prevención:** hidratarse con frecuencia, usar sombrero y ropa clara, buscar sombra, evitar las horas de mayor calor y vigilar a los más pequeños.`,
  },
  {
    q: "¿Qué hacer ante un esguince, una luxación o una fractura?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "01 Manual Scout de Primeros Auxilios.pdf",
    page: 17,
    ans: `**Esguince:** lesión de ligamentos por estiramiento o torsión; hay inflamación, moretón y dolor al mover.

**Luxación:** un hueso sale de su articulación; hay dolor intenso, deformidad e incapacidad de movimiento.

**Fractura:** ruptura total o parcial del hueso; dolor intenso, inflamación, deformidad y, a veces, imposibilidad de mover la zona.

**Manejo general:**
- Activar el 911 si hay deformidad, dolor extremo o incapacidad de movimiento.
- **No intentar regresar la articulación a su lugar.**
- Inmovilizar incluyendo las articulaciones cercanas.
- Revisar pulsos y sensibilidad antes y después de inmovilizar.
- No mover a la persona salvo que esté en peligro mayor.
- Trasladar a atención médica.

El manual advierte que **minimizar una lesión** puede convertir una recuperación de días en un problema de semanas o requerir cirugía.`,
  },
  {
    q: "¿Cómo se improvisan vendajes y férulas con el equipo scout?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "01 Manual Scout de Primeros Auxilios.pdf",
    page: 19,
    ans: `El manual recuerda que el uniforme y el equipo pueden servir para improvisar atención:

- La **pañoleta** puede convertirse en **cabestrillo**.
- La **piola** puede formar parte de una **férula**.
- Los **bordones** pueden usarse para improvisar una **camilla**.

**Reglas para vendar:**
1. Coloca el rollo de la venda hacia fuera de la zona.
2. Da **dos vueltas de seguridad** al inicio para que no se corra.
3. Venda de la parte **distal** (lejos del corazón) hacia la proximal, para favorecer el retorno sanguíneo.
4. Para inmovilizar, incluye las articulaciones cercanas.
5. Evita vendar dedos de manos y pies si no es necesario.
6. Verifica que no quede demasiado apretado: revisa color, temperatura y sensibilidad.

**Tipos:** circular o espiral (fijar apósitos), en espiga (presión) y en ocho o tortuga (articulaciones).`,
  },
  {
    q: "¿Qué debe llevar el botiquín de un equipo scout?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 86,
    ans: `El **botiquín** debe ser resistente, identificable, fácil de transportar y revisado antes de cada salida.

**Contenido básico recomendado:**
- Equipo de protección personal (guantes de látex, cubrebocas).
- Vendas adhesivas.
- Rollos de venda elástica en varias medidas.
- Torundas de algodón.
- Tela adhesiva.
- Gasas estériles.
- Tintura de yodo.
- Termómetro **sin mercurio**.
- Agua estéril.

**Recomendaciones:**
- Revisar caducidades y reposiciones después de cada actividad.
- Adaptar el botiquín al número de participantes, clima y tipo de actividad.
- Mantenerlo a cargo de una persona responsable (el **socorrista** del equipo).
- No automedicar: los medicamentos solo se administran con indicación y autorización correspondiente.`,
  },
  {
    q: "¿Qué hacer si alguien se desmaya o pierde el conocimiento?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "01 Manual Scout de Primeros Auxilios.pdf",
    page: 26,
    ans: `El **desmayo o síncope** es la pérdida brusca y temporal de la conciencia y del tono postural; suele durar poco y recuperarse solo, pero puede indicar un problema de fondo.

**Atención inicial:**
1. Verificar que el lugar sea seguro.
2. Comprobar respiración y pulso.
3. Si está **pálido**, acostarlo y **elevar los pies**; abrigarlo.
4. Si está **enrojecido**, mantenerlo sentado con la cabeza alta y refrescar la cabeza.
5. No darle de oler alcohol ni sustancias.
6. Si no recupera la conciencia, activar el 911.
7. Investigar causas: calor, deshidratación, ayuno, esfuerzo, problemas cardíacos o medicamentos.

**No** se debe incorporar a la persona de golpe ni darle comida o bebida mientras esté inconsciente.`,
  },
  {
    q: "¿Qué hacer ante picaduras de insectos o mordeduras de animales?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 84,
    ans: `En actividades al aire libre podemos encontrar abejas, arañas, escorpiones, serpientes o animales con rabia.

**Medidas iniciales:**
1. Anotar la **hora** del incidente y delimitar la zona.
2. Distinguir si fue **picadura** (aguijón, colmillos pequeños) o **mordedura**.
3. Identificar, si es posible, la especie y si es venenosa en la región.
4. Lavar la zona con agua limpia y jabón.
5. Retirar el aguijón con cuidado, sin exprimirlo.
6. No chupar el veneno ni hacer cortes.
7. Buscar atención médica de inmediato si hay dificultad para respirar, hinchazón de cara o cuello, vómito, convulsiones o pérdida de conciencia.

El manual histórico de Segunda Clase recomienda, para mordedura de víbora, inmovilizar y colocar un vendaje compresivo **10 cm arriba y 10 cm debajo** de la mordedura, y acudir urgentemente al médico. **No** se debe aplicar hielo directo ni torniquete.`,
  },
  {
    q: "¿Qué es el mal agudo de montaña y cómo se previene?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "Carnet Aventuras en la Naturaleza para Rovers 2024.pdf",
    page: 86,
    ans: `El **mal agudo de montaña** aparece al ascender a más de **2,500 m** sin aclimatación. La presión atmosférica baja y el oxígeno disponible disminuyen, lo que puede provocar **hipoxia**.

**Síntomas frecuentes:** dolor de cabeza, mareo, náusea, fatiga, falta de aire, sueño y pérdida de apetito. En casos graves puede haber confusión, descoordinación y dificultad para respirar en reposo.

**Prevención:**
- Ascender de forma gradual y descansar.
- Hidratarse y alimentarse bien.
- Evitar alcohol y esfuerzos excesivos el primer día.
- Conocer la altura de la ruta y el pronóstico.

**Atención:** si los síntomas empeoran, **descender** es la medida más importante; buscar atención médica oportuna. El descenso y la valoración profesional no deben retrasarse.`,
  },
  {
    q: "¿Qué hacer si se declara un incendio forestal durante un campamento?",
    cat: "Primeros Auxilios y Seguridad",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 91,
    ans: `**Prevención:**
- El fuego debe usarse de forma responsable y con un **responsable designado** para encenderlo y apagarlo.
- Limpiar un radio de **1.50 m** alrededor de la fogata.
- Apagar todo el material combustible con abundante agua y **vigilar 30 minutos** para confirmar que no quedan brasas.
- No encender fuego si hay viento fuerte, sequía o prohibición del lugar.

**Si hay un incendio forestal:**
1. Activar los servicios de emergencia llamando al **911**.
2. Notificar, si es posible, la ubicación exacta del incendio.
3. Salir de la zona por una ruta segura y en sentido contrario al viento.
4. No intentar combatir un incendio grande sin equipo ni formación.
5. Seguir las indicaciones de Protección Civil y de los cuerpos de emergencia.`,
  },

  // ============================================================
  // CAMPISMO, NATURALEZA Y ORIENTACIÓN
  // ============================================================
  {
    q: "¿Cómo se elige y prepara el lugar para acampar sin dañar la naturaleza?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 43,
    ans: `**Criterios para elegir el lugar:**
- Respeta las **regulaciones del área** y coloca la tienda donde indiquen.
- Si no hay regulación, usa **zonas ya impactadas**; el daño de volver a usar un sitio conocido es menor que abrir uno nuevo.
- Evita acampar **cerca de cuerpos de agua**.
- En zonas remotas, **no acampes más de una noche** en el mismo lugar.
- Usa esterilla o bajo sleeping para aislar tu calor del suelo y proteger la vegetación.

**Antes de irte:**
- Devuelve hojas, ramitas y piedras a su lugar.
- No hagas zanjas alrededor de la tienda.
- Revisa que no queden residuos, ni siquiera orgánicos.
- Deja el sitio como lo encontraste, para que otras personas también lo disfruten.

El principio es simple: **que tu paso no se note**.`,
  },
  {
    q: "¿Cuáles son los 7 principios para No Dejar Rastro?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 41,
    ans: `Los **7 Principios para No Dejar Rastro** son un código de ética para cualquier actividad al aire libre, adaptado también a parques urbanos y a la vida diaria:

1. **Planea con anticipación y prepárate.**
2. **Viaja y acampa por superficies estables.**
3. **Desecha los residuos apropiadamente.**
4. **Deja lo que encuentras** (no te lleves objetos naturales).
5. **Minimiza el impacto de las fogatas.**
6. **Respeta la vida silvestre.**
7. **Sé considerado con los demás.**

El carnet explica que estos principios fortalecen nuestra relación con la naturaleza y son un reflejo del compromiso scout de ser **Mejores Ciudadanos del Mundo**. Se aplican desde áreas silvestres remotas hasta el parque de tu colonia y tu propia casa.`,
  },
  {
    q: "¿Cómo se desechan los residuos humanos en campamento (agujero de gato)?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 45,
    ans: `El **agujero de gato** es el método más aceptado para desechos humanos cuando no hay letrinas.

**Cómo hacerlo:**
- Ubícalo a **60 metros** de fuentes de agua, caminos y zona de acampado (unos 70–75 pasos de una persona de 1.75 m).
- Elige un sitio discreto, alto y con exposición al sol.
- Cava un hoyo de **15 a 25 cm de profundidad** y **10 a 15 cm de diámetro**.
- Después de usarlo, cúbrelo y disimúlalo con materiales naturales.
- Si el grupo es grande o te quedas varias noches, dispersa los hoyos.

**Papel higiénico:** usa poco, sin perfume y de color claro; entiérralo en el agujero o guárdalo en una bolsa y llévalo contigo. **No se recomienda quemarlo.**

**Letrinas:** evítalas si es posible; si son indispensables, ubícalas a **200 metros** de agua y zonas de acampado, y cubre cada uso con tierra.`,
  },
  {
    q: "¿Qué hacer con la basura y las aguas grises en un campamento?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 47,
    ans: `**Basura:** la regla es **“empácalo”**. Todo residuo que generes debe salir del área natural, incluso si el lugar no tiene buen manejo de basura. Lleva bolsas o costales y revisa el sitio antes de irte; también recoge residuos que encuentres.

**Aguas grises:** son las de lavar trastes, manos o bañarse. Deben manejarse **a por lo menos 200 metros** de cuerpos de agua. Filtra los restos de comida y dispersa el agua en el suelo, nunca en un río, lago o arroyo.

**Residuos orgánicos:** no se deben dejar tirados ni enterrar sin control, porque pueden atraer fauna y alterar su alimentación. Si no hay sistema de composta, llévalos contigo.

**Restos de comida:** escúrrelos, guárdalos en bolsa cerrada y retíralos. La basura y los restos atraen animales y pueden provocar accidentes.`,
  },
  {
    q: "¿Cómo se purifica el agua en campamento?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Tropa 2024.pdf",
    page: 58,
    ans: `No toda el agua de un río, laguna o manantial es potable. El carnet de Tropa describe tres métodos:

**1. Hervir:**
- Hierve el agua **de 10 a 20 minutos**.
- Neutraliza bacterias e impurezas.

**2. Cloro o pastillas cloradas:**
- Usa hipoclorito de sodio doméstico al **6 %**.
- Agrega **2 gotas por cada litro** de agua.
- Déjala reposar en un recipiente de plástico o vidrio **30 minutos** antes de usarla.

**3. Filtro de carbón:**
- Úsalo cuando el agua esté muy turbia, para eliminar impurezas.
- **Después de filtrar, hiérvela o clórala**; el filtro solo no garantiza que sea potable.

**Consejo:** lleva agua potable suficiente y, si compras un filtro portátil, verifica que esté certificado para retener microorganismos.`,
  },
  {
    q: "¿Cómo se previene un incendio y cómo se apaga correctamente una fogata?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 49,
    ans: `**Antes de encender:**
- Pregúntate si el fuego es realmente necesario; una estufeta puede ser suficiente.
- Verifica si el lugar permite fogatas y si hay leña disponible.
- Usa una **zona de sacrificio** existente (anillo de fuego o área marcada); si no hay, construye un terraplén de al menos **10 cm** y retíralo al terminar.
- Limpia un radio de **1.50 m** alrededor del fuego.
- Nunca dejes el fuego sin vigilancia.

**Para apagar:**
1. Deja de alimentar el fuego.
2. Rocía **abundante agua**, no solo tierra.
3. Remueve las cenizas y vuelve a mojar.
4. Verifica que no haya brasas calientes.
5. **Vigila 30 minutos** antes de abandonar el lugar.

**Importante:** el responsable de la fogata debe ser una persona designada, tanto para encenderla como para apagarla.`,
  },
  {
    q: "¿Cómo se cocina sin utensilios en campamento?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Tropa 2024.pdf",
    page: 59,
    ans: `Cocinar sin utensilios significa usar el mínimo de objetos industrializados y aprovechar lo que ofrece la naturaleza.

**Materiales que menciona el carnet:**
- **Corteza de árbol** para hacer platos.
- **Piedras lisas** como sartén.
- **Ramas** para tallar cucharas o tenedores.
- **Cáscaras** de naranja, piña, coco, pepino o calabaza como recipientes.
- **Piedras planas o cóncavas** como parrilla.
- Un **hoyo** en el suelo como horno.

**Recomendaciones:**
- Calcula porciones para **5 personas** (una patrulla tiene entre 4 y 8 integrantes).
- Busca una comida balanceada: plato fuerte, agua y postre.
- Lleva ingredientes frescos, con poco empaque y mínimo desperdicio.
- Usa la navaja con cuidado y solo si tienes autorización.
- Respeta la naturaleza: no cortes árboles vivos ni dejes restos.

**Tipos de fogata para cocinar:** corredor, cruz, estrella y polinesia.`,
  },
  {
    q: "¿Cómo se conservan y preparan los alimentos de forma segura en campamento?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Tropa 2024.pdf",
    page: 96,
    ans: `**Conservación:**
- Lleva la carne **preelaborada** para evitar alimentos crudos o semicrudos.
- Si el campamento dura más de tres días, lleva crudos ya preparados, empacados al vacío o congelados.
- Guarda los alimentos en **hieleras**.
- **No almacenes juntos** carne cruda con frutas y verduras.
- Consume primero los alimentos que se descomponen más rápido.

**Higiene:**
- Lávate las manos o usa gel desinfectante antes de cocinar.
- Revisa que los utensilios estén limpios y en buen estado.
- Lava los trastes lejos de fuentes de agua y maneja las aguas grises a 200 m.
- No consumas alimentos con olor, sabor o color extraño.

**Cocción:**
- Cocina completamente carnes y huevos.
- Mantén la comida caliente hasta servirla y refrigera pronto lo que sobre.
- Si hay dudas sobre el estado de un alimento, **no lo consumas**.`,
  },
  {
    q: "¿Cómo se acomoda la mochila de campamento y qué debe llevar?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 25,
    ans: `La mochila es una de las herramientas más importantes; debe ser cómoda y adecuada a tu cuerpo.

**Antes de empacar:**
- Haz una lista de las actividades y del clima.
- Extiende todo lo que llevarás para verlo y evitar duplicados.
- Revisa el pronóstico para elegir ropa y calzado.
- Ajusta la mochila según las recomendaciones del fabricante; hay modelos para cuerpo de hombre y de mujer.

**Distribución recomendada:**
- Lo **pesado** cerca de la espalda y a la altura de la cintura.
- Lo **ligero** abajo y arriba.
- Lo que necesitas durante la caminata (agua, botiquín, impermeable, lunch) en bolsillos accesibles.
- El sleeping y la ropa de abrigo en la parte inferior.

**No saques cosas que no vayas a usar**: es fácil olvidarlas. Lleva solo lo necesario y revisa el peso antes de salir.`,
  },
  {
    q: "¿Qué roles o cargos se organizan en un campamento scout?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 28,
    ans: `El carnet de Comunidad describe cargos específicos que hacen funcionar al equipo:

- **Constructor:** diseña el campamento, distribuye espacios y coordina construcciones.
- **Intendente:** aprovisiona materiales (cuerdas, toldos, tiendas, utensilios, gas).
- **Leñador:** consigue leña e iniciadores de fuego.
- **Animador:** mantiene el buen humor, coordina cantos e historias.
- **Fogonero:** enciende y mantiene la fogata, cuida el impacto en el suelo y la quema innecesaria.
- **Cocinero:** diseña el menú, calcula ingredientes y supervisa la preparación.
- **Socorrista:** mantiene el botiquín y da la primera respuesta ante incidentes.

Cada cargo es importante: si una persona falla, el equipo entero se resiente. Los roles pueden rotar para que todos aprendan.`,
  },
  {
    q: "¿Cómo se orienta un scout con mapa y brújula?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 34,
    ans: `**Materiales:**
- **Carta topográfica** (el INEGI las ofrece gratuitamente, incluso a escala 1:20,000).
- **Brújula de regleta**, la más adecuada para trabajar con mapas.
- Fotografía satelital o aplicación de mapas como apoyo.

**Pasos básicos:**
1. Orienta el mapa con el norte.
2. Identifica puntos de referencia: cerros, ríos, caminos, edificios.
3. Localiza tu posición por intersección de referencias.
4. Traza el rumbo y mide el azimut.
5. Sigue el rumbo y verifica con el terreno.

**Sin brújula:** usa los puntos cardinales, el movimiento del sol y los objetos celestes. De noche, la **estrella Polar** indica el norte; la **Cruz del Sur** no señala el sur, solo ayuda a ubicarlo.

No dependas solo del GPS: hay zonas sin cobertura.`,
  },
  {
    q: "¿Cómo se orienta uno de noche por las estrellas?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 36,
    ans: `La orientación nocturna es útil cuando no hay sol ni brújula.

**En el hemisferio norte:**
- Localiza la **Osa Mayor** y prolonga la línea de las dos estrellas del borde de la “cacerola” cinco veces para encontrar la **estrella Polar**, que marca el **norte**.
- La Polar se mantiene casi fija mientras las demás estrellas giran.

**En el hemisferio sur:**
- La **Cruz del Sur** ayuda a ubicar el sur, pero **no lo señala directamente**: hay que prolongar el eje largo de la cruz y proyectarlo.
- No es visible desde las latitudes del hemisferio norte.

**Con la Luna:** también puedes orientarte si conoces su posición y fase, pero cambia con el tiempo.

**Consejo:** practica en un lugar conocido y usa una app de astronomía solo como apoyo; con el tiempo aprenderás a reconocer las constelaciones sin ella.`,
  },
  {
    q: "¿Cómo se interpreta el pronóstico del tiempo para una actividad al aire libre?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 90,
    ans: `Antes de salir, revisa **temperaturas máximas y mínimas, viento y probabilidad de lluvia**.

**Fuentes recomendadas por el carnet:**
- **Windy:** https://www.windy.com/
- **Servicio Meteorológico Nacional (CONAGUA):** https://smn.conagua.gob.mx/es/

**Qué observar:**
- Lluvia, tormentas, granizo o nieve.
- Velocidad y dirección del viento.
- Cambios bruscos de temperatura.
- Avisos oficiales de Protección Civil.

**Nubes:**
- **Cirros:** altas, finas y plumosas; indican cambios.
- **Cúmulos:** algodonosas; si son grandes y oscuras, presagian lluvia.
- **Estratos:** bajas y grises; pueden formar niebla.
- **Nimbos:** producen precipitación.

**Consejo:** lleva ropa por capas, impermeable y un plan alternativo. Si el pronóstico es severo, reprograma.`,
  },
  {
    q: "¿Qué tipos de refugio se pueden usar en campamento?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 31,
    ans: `El carnet distingue varias modalidades:

- **A nivel de suelo:** tienda o refugio apoyado directamente en el terreno.
- **Elevado:** plataforma o estructura separada del piso (por ejemplo, 20 cm), útil contra humedad o fauna.
- **Flotante o suspendido:** hamaca o estructura colgada, para terrenos inclinados, húmedos o con animales.

**Refugios improvisados:** se construyen con materiales del entorno, pero sin dañar árboles vivos. Deben proteger del viento, la lluvia y el frío, y permitir dormir con seguridad.

**Recomendaciones:**
- Revisa el clima y la fauna del lugar antes de elegir.
- En zonas de temperaturas bajo cero se requiere equipo técnico y experiencia.
- No acampes en cauces secos, laderas inestables ni zonas de riesgo de inundación.
- Al desmontar, devuelve el terreno a su estado original.`,
  },
  {
    q: "¿Cómo se cuidan las cuerdas y los materiales de campamento?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 58,
    ans: `Una cuerda en mal estado puede ser la diferencia entre un juego seguro y un accidente.

**Cuidados básicos:**
- Sigue las indicaciones del fabricante.
- Revisa la cuerda antes y después de cada uso: busca cortes, desgaste, quemaduras o rigidez.
- No la arrastres por el suelo ni la dejes en contacto con químicos.
- Guárdala seca, en un lugar fresco y ventilado.
- No la uses para arrastrar objetos pesados ni para usos para los que no está diseñada.
- Sustituye cualquier cuerda dañada; no la repares con nudos.

**Herramientas:** mantén el filo, usa funda, no cortes hacia tu cuerpo y presta atención a quien está cerca. La navaja es una herramienta, no un juguete.

**Construcciones:** revisa amarres y tensión antes de usarlas; nunca permitas que alguien se suba a una estructura que no ha sido verificada.`,
  },
  {
    q: "¿Cómo se respeta a la fauna silvestre en una excursión?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Comunidad 2024.pdf",
    page: 50,
    ans: `El principio **“Respeta la vida silvestre”** busca que los animales no cambien su comportamiento por nuestra presencia.

**Reglas prácticas:**
- **Observa a distancia**; no persigas, acorrales ni toques animales.
- **No alimentes** a la fauna: cambia su dieta, los acostumbra y puede provocar ataques.
- Guarda la comida en bolsas cerradas o colgada, lejos de la tienda.
- No dejes restos orgánicos que atraigan animales.
- No destruyas madrigueras, nidos ni huevos.
- Controla el ruido y las luces durante la noche.
- Si encuentras un animal herido, avisa a las autoridades ambientales; no intentes manipularlo.

**Si aparece un animal:** mantén la calma, no corras, retrocede despacio y no lo rodees. En caso de riesgo, llama al 911 o a Protección Civil.`,
  },
  {
    q: "¿Qué permisos y autorizaciones necesita una excursión scout?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Carnet Aventuras en la Naturaleza para Tropa 2024.pdf",
    page: 95,
    ans: `Toda salida debe estar **avalada por el Consejo de Grupo** y por la **Comisión de Administración de Riesgos** a nivel de Provincia.

**Antes de la actividad:**
- Definir tipo, fecha, lugar, duración y participantes.
- Contar con autorización de padres o tutores para menores.
- Revisar el lugar y los riesgos (clima, fauna, accesos, servicios).
- Designar responsables y un plan de emergencia.
- Verificar seguros, fichas médicas y contactos.
- Informar a la Provincia y, si aplica, al municipio o área natural protegida.

**Tipos de salida:**
- **Excursión:** actividad de un día (museo, paseo ciclista, velada, rally).
- **Campamento:** pernocta, con equipo y logística mayores.
- **Actividad nacional o internacional:** requiere convocatoria, registro y documentación específica.

**Recuerda:** ninguna salida debe realizarse sin autorización. La seguridad no es un trámite.`,
  },
  {
    q: "¿Qué es el TOHAN y qué pruebas se realizan?",
    cat: "Campismo, Nudos y Naturaleza",
    doc: "Informe anual 2025.pdf",
    page: 53,
    ans: `El **TOHAN (Torneo de Habilidades de Aventuras en la Naturaleza)** es una competencia nacional que pone a prueba las competencias de los carnets.

**Escenarios principales:**
- **Olimpiada Scout:** pruebas de orientación, meteorología, primeros auxilios, supervivencia, navegación, cabuyería y uso de herramientas.
- **Campamento Pow Wow:** habilidades de campismo, pionerismo y vida al aire libre.
- **Trivia Scout:** conocimientos del programa y de la sección.

**Competencias evaluadas:** técnica, aplicación correcta, dominio, resolución de problemas, trabajo en equipo y comunicación. La vivencia de la Promesa y la Ley Scout también se valora, aunque no suma puntos.

**Etapas:** provincia y nacional. Los equipos ganadores conforman la Selección Representativa de Provincia. Participan caminantes, rovers y scouters jóvenes menores de 30 años, según la convocatoria.`,
  },

  // ============================================================
  // CEREMONIAL, PROMESA Y SÍMBOLOS
  // ============================================================
  {
    q: "¿Cómo se integra una escolta scout y cuántos elementos la forman?",
    cat: "Promesa, Ley y Simbolos",
    doc: "03 Manual Scout de Honores a la Bandera Nacional.pdf",
    page: 27,
    ans: `La escolta scout se integra con **seis elementos** y una formación precisa:

- **Abanderado:** va en la vanguardia, entre el primer y el segundo scout. Debe ser la persona de mayor jerarquía, grado, cargo o importancia.
- **Comandante de escolta:** va en la extrema derecha. Se elige por su voz firme y su capacidad de dirigir; toda orden que dé empieza con la palabra “Escolta”.
- **Primer scout:** a la izquierda del abanderado.
- **Segundo scout:** a la derecha del abanderado.
- **Tercer scout:** tres pasos detrás del primer scout.
- **Cuarto scout:** tres pasos detrás del segundo scout.

La distancia entre vanguardia y retaguardia es de **tres pasos**. La separación lateral se calcula colocando el brazo derecho con la mano empuñada en el hombro del compañero de al lado. El comandante marcha en **hilera hueca**.

La escolta debe llevar el uniforme completo y uniforme entre todos sus miembros: mismo color de pantalón, misma manga y sin insignias adicionales que no estén previstas en el manual.`,
  },
  {
    q: "¿Cómo se realiza el saludo a la Bandera Nacional cuando se porta uniforme scout?",
    cat: "Promesa, Ley y Simbolos",
    doc: "03 Manual Scout de Honores a la Bandera Nacional.pdf",
    page: 9,
    ans: `El saludo civil a la Bandera se hace **en posición de firmes**, con la **mano derecha extendida sobre el pecho**, la **palma hacia abajo** y a la **altura del corazón**. Los varones, además, se descubren la cabeza.

Reglas que marca el manual:

- El saludo se ejecuta al **divisar la Bandera** y durante los honores.
- Al entonar el **Himno Nacional** todos permanecen firmes y con la cabeza descubierta; solo la escolta puede conservar el tocado que forme parte de su uniforme.
- La Bandera y su escolta deben colocarse al **centro o a la extrema derecha** de la formación, en un lugar visible para todos.
- Si hay banda de guerra, el maestro de ceremonias ordena **“Atención, firmes… ya”** y luego **“Saludar… ya”**. Sin banda, las órdenes se dan a viva voz.
- La escolta saluda con su Bandera a otra Bandera cuando se cruzan.

El manual recuerda que estos protocolos tienen origen militar y deben seguirse con precisión para no incurrir en una falta de respeto.`,
  },
  {
    q: "¿Cuál es el protocolo para izar la Bandera Nacional en una ceremonia scout?",
    cat: "Promesa, Ley y Simbolos",
    doc: "03 Manual Scout de Honores a la Bandera Nacional.pdf",
    page: 20,
    ans: `**Antes del izamiento:**

1. La escolta se integra a la **extrema derecha** de la formación y es abanderada.
2. Un scouter o dirigente lleva la Bandera doblada a la escolta; todos saludan y el abanderado la recibe.
3. La escolta marcha al asta y se coloca a unos **tres metros** de distancia, en formación de escolta o en columna por uno si la Bandera es muy amplia.

**Al izar:**

- El abanderado y el encargado despliegan la Bandera poco a poco, cuidando que el **águila quede hacia arriba y mirando a la izquierda**.
- La Bandera **nunca debe arrastrarse ni tocar el suelo**.
- Se sujeta el primer gancho y se inicia el izamiento mientras se interpreta el **toque de Bandera**.
- Al terminar el izamiento se ordena **“Atención, firmes… ya”** y se entona el **Himno Nacional**.
- El abanderado y quien izó la Bandera hacen el saludo una vez que sueltan el lienzo.

Si no hay banda de guerra, corneta ni grabación, los toques se sustituyen por órdenes a viva voz y el recorrido e izamiento se hacen en absoluto silencio.`,
  },
  {
    q: "¿Cómo se arria y se dobla correctamente la Bandera Nacional?",
    cat: "Promesa, Ley y Simbolos",
    doc: "03 Manual Scout de Honores a la Bandera Nacional.pdf",
    page: 23,
    ans: `El **arrío** se realiza a las **18:00 horas** y sigue este orden:

1. Todos adoptan la posición de firmes y se entona el Himno Nacional.
2. Al terminar, se arria la Bandera mientras los presentes permanecen firmes y saludando.
3. El abanderado o un dirigente toma el lienzo por el **extremo rojo** y cuida que no se arrastre.
4. Al concluir, un scouter o dirigente la pliega de modo que quede el **verde arriba**, el **blanco al centro** y el **rojo abajo**.
5. La Bandera se entrega al abanderado y la escolta regresa en formación.

**Puntos clave:**

- La Bandera **jamás debe tocar el suelo**.
- Si es de dimensiones amplias, se ordena **“columna por uno”** y **“flancos al centro”** antes de plegarla.
- El arrío puede hacerse solo con una comisión de scouters y dirigentes, sin banda ni escolta completa.
- Al guardarla, se lleva sobre los brazos extendidos, con los codos pegados al cuerpo, marchando a paso redoblado.

El manual también prohíbe colocar objetos o emblemas sobre la Bandera, usarla como adorno o estamparla en artículos que puedan denigrarla.`,
  },
  {
    q: "¿Qué es el Ceremonial Scout y para qué sirve?",
    cat: "Promesa, Ley y Simbolos",
    doc: "03 Manual Scout de Honores a la Bandera Nacional.pdf",
    page: 10,
    ans: `El **Ceremonial Scout** es el conjunto de normas, procedimientos y formalidades que dan **homogeneidad y solemnidad** a los acontecimientos de la vida scout.

**Su finalidad** es que los momentos importantes del Movimiento —ceremonias nacionales, de provincia, de grupo y de formación de escolta— se vivan con respeto y con un lenguaje común en todo el país. El manual lo considera parte esencial de los conceptos de la **Promesa** y la **Ley Scout**, a las que el scout se compromete a cumplir.

**Reglas generales:**

- Se debe portar el **uniforme scout correcto**, conforme al Manual del Uniforme.
- Para ceremonias destacadas se recomienda contar con **banda de guerra**, que se solicita al Ejército, Fuerza Aérea, Marina, Policía, ayuntamientos o escuelas cercanas.
- El protocolo se ajusta a la **Ley sobre el Escudo, la Bandera y el Himno Nacionales**.
- La escolta que porta la Bandera debe recorrer la formación para que todos puedan saludar.

En pocas palabras: el ceremonial no es un adorno, sino la forma en que el Movimiento expresa respeto, identidad y pertenencia.`,
  },
  {
    q: "¿Cómo se realiza la Ceremonia de Promesa en la Tropa de Scouts?",
    cat: "Promesa, Ley y Simbolos",
    doc: "Guia de Scouter de Tropa de Scouts 2024.pdf",
    page: 33,
    ans: `La **Promesa** es un momento muy importante en la vida del scout. La Guía de Scouter de Tropa pide:

- Dar a la petición del niño, niña o adolescente **la importancia que merece**.
- Crear un **momento especial**, en un lugar apropiado, con tiempo suficiente para prepararlo.
- Organizar una ceremonia **sencilla y a la vez solemne**, que festeje el hecho de que el scout asume libremente un compromiso.

**Antes de la ceremonia:**

- El scout debe conocer y comprender la **Ley Scout**, la **Promesa** y el significado de los símbolos.
- Se recomienda que los **elementos de identidad** (distintivo de Sección, motas, pañoleta, escudo y sector) se entreguen antes o de forma independiente, pues no deben condicionarse a la Promesa ni usarse como premio o castigo.

**Durante la ceremonia:**

- Se acompaña con elementos del **Marco Simbólico** de la Tropa o del Grupo.
- Se realiza con respeto y protección a los NNAJ, aplicando el **Código de Ética**, el **Código de Conducta** y la **Política Nacional A Salvo del Peligro**.
- La ceremonia de **Compromiso de Patrulla** es distinta de la Promesa personal.

La Guía insiste en que la Promesa es una **elección personal y voluntaria**, no un requisito impuesto.`,
  },
  {
    q: "¿Cómo es la Ceremonia de Compromiso en la Manada y qué es el Gran Aullido?",
    cat: "Promesa, Ley y Simbolos",
    doc: "Guia de Scouter de Manada de Lobatos 2024.pdf",
    page: 24,
    ans: `En la Manada, la **ceremonia de compromiso** es el momento en que el Lobato o Lobezna hace su **Promesa** y acepta la **Ley de la Manada**.

**Preparación:**

- El Viejo Lobo invita al Lobato a reflexionar sobre el compromiso que va a asumir.
- Se le explican las frases de la Promesa y se respeta su decisión personal.
- La Promesa es un compromiso con los valores scout y cumple la doble función de unir a los miembros del Movimiento.
- Al contraerla, el joven acepta libremente la Ley de la Manada y se compromete a **“Hacer Siempre Lo Mejor”**.

**El Gran Aullido:**

- Es un saludo y, a la vez, una **renovación del compromiso** frente a la Manada y a Akela.
- Solo pueden realizarlo los Lobatos y Lobeznas que **ya hicieron su compromiso**.
- La primera vez que lo hacen es precisamente en su ceremonia de compromiso.
- Akela, el líder de la Manada, es el único que puede dirigirlo.
- Se elige a un Lobato o Lobezna distinto en cada sesión para iniciarlo.

El Gran Aullido se usa al inicio y al final de cada sesión, y refuerza la pertenencia y la mística de la Manada.`,
  },
  {
    q: "¿Qué es el Compromiso Rover y en qué consisten la vigilia y la investidura?",
    cat: "Promesa, Ley y Simbolos",
    doc: "Guia de Scouter de Clan de Rovers 2024.pdf",
    page: 36,
    ans: `En el Clan de Rovers existen **dos ceremonias** a lo largo de la vida del rover:

1. **Compromiso Rover**, dividido en dos tiempos: **vigilia** e **investidura**.
2. **Partida Rover**, al final de su paso por la Sección.

**El Compromiso Rover:**

- Se realiza al concluir el **período de inducción**, que dura como máximo **cuatro meses**.
- Es un acto **voluntario**: el joven acepta la Promesa y la Ley Scout, y también la **Carta del Clan**.
- Si al terminar la inducción el joven no desea comprometerse, conversa con el Consejero Responsable; no se le expulsa del Movimiento, pero debe salir del Clan y se asientan los motivos en el acta del Parlamento.

**La vigilia** es el tiempo previo de reflexión personal. **La investidura** es la ceremonia formal en la que el rover recibe su **escudo de Clan** y asume sus dos compromisos: con el Movimiento Scout y con la Carta del Clan.

Los **orientadores** acompañan al joven en este proceso y uno de ellos participa en la ceremonia. La realización concreta se detalla en la *Guía de Ceremonias y Celebraciones en el Clan de Rovers*.`,
  },
  {
    q: "¿Qué ceremonias y celebraciones se viven en la Comunidad de Caminantes?",
    cat: "Promesa, Ley y Simbolos",
    doc: "Guia de Scouter de Comunidad 2024.pdf",
    page: 123,
    ans: `En la Comunidad de Caminantes la vida simbólica se organiza en **ceremonias** y **celebraciones**:

**Ceremonias:**

- La **Ceremonia de Promesa** de un Caminante es el momento en que realiza su compromiso con la Promesa y la Ley Scout.
- Se recomienda que, aunque es voluntaria, la Promesa se lleve a cabo durante la **primera etapa de progresión**, es decir, en los primeros dos Ciclos de Programa del caminante en la Sección.

**Celebraciones:**

- Son los momentos para festejar los avances en la progresión personal, la integración al Equipo y la obtención de reconocimientos.
- Refuerzan la unidad del Equipo y el sentido de pertenencia.

**Elementos que acompañan:**

- El **Estandarte** es opcional y lo determina el Congreso de Comunidad; se usa en juntas ordinarias, ceremonias, celebraciones y desfiles, y puede montarse en un bordón.
- El **emblema de Equipo** representa al grupo y lo porta cada integrante.
- La **pañoleta** y el **escudo** forman parte de la identidad del Caminante.

La Guía subraya que toda ceremonia debe respetar la dignidad, la inclusión y la seguridad de los participantes.`,
  },
  {
    q: "¿Qué elementos forman el Marco Simbólico de la Tropa de Scouts?",
    cat: "Promesa, Ley y Simbolos",
    doc: "Guia de Scouter de Tropa de Scouts 2024.pdf",
    page: 79,
    ans: `El Marco Simbólico de la Tropa se organiza en tres dimensiones:

**1. Elementos de presentación:**
- **Uniforme:** insignias, compromiso y elementos de identidad.
- **Bandera de Sección.**
- **Bordones:** incluye los **banderines** de Patrulla.

**2. Elementos de acción:**
- **Ceremonias:** el **Compromiso Scout** y el **Compromiso de Patrulla**.
- **Celebraciones:** todo lo demás (avances, nombramientos, aniversarios, etc.).

**3. Elementos de espíritu:**
- **Cantos.**
- **Bailes.**
- **Mística de Tropa.**
- **Mística de Patrulla.**
- **Saludo, seña, apretón de mano izquierda y lema “Siempre Listos”.**

**El banderín** es un elemento de gran valor para la Patrulla: la identifica ante todos, la acompaña en cada aventura y es testigo de sus logros. Puede elaborarse en piel o tela y se monta en un bordón.

Estos elementos no son decorativos: dan cohesión, identidad y continuidad a la vida de la Tropa.`,
  },

  // ============================================================
  // HISTORIA DEL ESCULTISMO MEXICANO
  // ============================================================
  {
    q: "¿Cuándo y cómo se reconoció mundialmente al escultismo mexicano?",
    cat: "Basicas y Secciones",
    doc: "Los inicios 1.pdf",
    page: 10,
    ans: `El reconocimiento mundial llegó en **1926**. Del **22 al 28 de agosto** de ese año se realizó en **Kandersteg**, al pie de los Alpes suizos, la **IV Conferencia Scout Internacional** —hoy Conferencia Scout Mundial—.

Ahí fueron reconocidos los **Exploradores Nacionales de la República Mexicana** como organización scout oficial. La noticia se comunicó a México por telegrama: **Hubert S. Martin**, director de la Oficina Internacional de los Boy Scouts con sede en Londres, se la envió al **Club Rotario de la Ciudad de México**, instancia que había promovido la integración de la agrupación mexicana a la hermandad scout mundial.

Ese reconocimiento es el hecho que da origen a la conmemoración del **Centenario Scout de México en 2026**. La obra *Los inicios 1*, publicada en el marco del centenario, recoge testimonios de la fundación de la Asociación y recuerda que el escultismo mexicano tuvo que sobrevivir a guerras, crisis y cambios sociales para llegar a su primer siglo.`,
  },
  {
    q: "¿Cuáles fueron los nombres de la Asociación de Scouts de México y cuándo hizo su primera Promesa?",
    cat: "Basicas y Secciones",
    doc: "Los inicios 1.pdf",
    page: 12,
    ans: `La Asociación tuvo varios nombres antes de llamarse como hoy:

- **Exploradores de México:** nombre original de la agrupación.
- **Scouts de México:** adoptado en **mayo de 1932**.
- **Asociación de Scouts de México:** desde el **29 de mayo de 1934**, al fusionarse con los **Exploradores Mexicanos de la República Mexicana** y recibir el reconocimiento mundial otorgado desde 1926.

**La primera Promesa:** los integrantes de los **seis primeros grupos** de Exploradores de México la realizaron el **1 de noviembre de 1931**, en una finca de **San Ángel**, entonces un pueblo aledaño a la Ciudad de México.

El reconocimiento mundial de 1926 había quedado en manos de los Exploradores Nacionales de la República Mexicana. Al fusionarse en 1934, la nueva Asociación de Scouts de México asumió ese reconocimiento, que sigue vigente y es la base del Centenario de 2026.`,
  },
  {
    q: "¿Cómo surgió el escultismo en Yucatán y qué relación tiene con el henequén?",
    cat: "Basicas y Secciones",
    doc: "La flor de lis y el henequén.pdf",
    page: 11,
    ans: `A comienzos del siglo XX, **Yucatán** vivía una era de prosperidad sin precedente gracias a la **industria henequenera**. La fibra del agave alcanzaba altos precios en los mercados internacionales y esa bonanza impulsó también la cultura, las artes y la educación.

Yucatán estaba geográficamente aislado del resto de México y tenía una vida propia, con mucho contacto con Europa y Norteamérica. Muchos jóvenes yucatecos estudiaban en el extranjero, sobre todo en Estados Unidos e Inglaterra. Ese contacto con el exterior facilitó que conocieran el escultismo y lo trajeran a la península.

El libro *La flor de lis y el henequén*, de **Juan Francisco Peón Ancona**, recoge los primeros años del escultismo yucateco. El título resume esa unión: la **flor de lis** scout y el **henequén** que sostuvo la economía de la región.

La obra forma parte de la **Colección Biblioteca del Centenario** y ayuda a entender que el escultismo mexicano no nació solo en la capital, sino también en las regiones con sus propias historias y liderazgos.`,
  },
  {
    q: "¿Qué es el Encuentro de Expresión y Arte Scout (EEAS) y cuándo nació?",
    cat: "Basicas y Secciones",
    doc: "40 Años de Expresión y Arte Scout.pdf",
    page: 7,
    ans: `El **Encuentro de Expresión y Arte Scout (EEAS)** es el evento nacional donde se reúnen las distintas manifestaciones artísticas del Movimiento: **banderines, tótems de Manada, cuadros de adelanto, música scout, relatos, cuentos, dibujo, pintura, fotografía, escultura y diseño**.

**Su origen:** nació en **1980** como un proyecto surgido en un curso de adiestradores. A dos jóvenes dirigentes se les encargó una idea para ayudar a que **Meztitla** recuperara algo de dinero. La clave fue el “arte scout”, que nunca antes había reunido en un mismo espacio las obras creadas en los diferentes marcos simbólicos.

**Primera edición:** se programó del **13 al 16 de septiembre de 1980**, en Meztitla, junto con el **Festival de la Canción Scout**.

Con los años se sumaron talleres, concursos, exposiciones y sedes en distintas ciudades del país. En **2019** se celebró la **cuadragésima edición**, y el libro *40 Años de Expresión y Arte Scout* recoge memorias y anécdotas de ganadores, creadores y organizadores.`,
  },
  {
    q: "¿Cómo llegó el escultismo a México antes de la fundación de la Asociación?",
    cat: "Basicas y Secciones",
    doc: "Los inicios 1.pdf",
    page: 16,
    ans: `Antes de la fundación formal de la Asociación, el escultismo llegó a México por varias rutas:

- **Federico Clarck**, maestro del **Colegio Alemán**, formó una tropa de **Pfadfinders** —scouts alemanes— por encargo de la dirección escolar. Circulaba desde 1909 el *Das Pfadfinderbuch*, adaptación de *Escultismo para muchachos* hecha por Alexander Lion y Maximilian Bayer.
- **Andrés Gómez Oreján** encabezaba a los **Exploradores Nacionales de la República Mexicana**, reconocidos internacionalmente desde 1926, aunque hacia 1931 la agrupación había quedado reducida a una pequeña tropa en la Ciudad de México.
- **Jorge Núñez Prida**, **Edelmiro Traslosheros** y otros dirigentes impulsaron la creación de los **Exploradores de México**, con apoyo del **Club Rotario** y de los **Caballeros de Colón**.
- El manual *El explorador mexicano*, de Clarck, fue la obra más accesible en español para formar a los primeros maestros scouts.

La primera reunión entre Traslosheros, Núñez Prida y Gómez Oreján se realizó a principios de **1931**. De ese encuentro y del trabajo de los primeros grupos surgiría la organización que hoy conocemos.`,
  },

  // ============================================================
  // UNIFORME
  // ============================================================
  {
    q: "¿Qué piezas componen el uniforme scout y qué características debe cumplir cada una?",
    cat: "Manuales Oficiales y de Operación",
    doc: "01 Manual del Uniforme Actualizado Junio 2026.pdf",
    page: 16,
    ans: `El **Manual del Uniforme 2026** describe las piezas básicas:

- **Camisola:** del color de la Sección, en manga corta, larga, tipo polo u outdoor. Lleva bordado el emblema oficial con la flor de lis Nacional y las palabras “SCOUTS MÉXICO” en el lado superior derecho.
- **Pantalón, short o falda:** azul marino oficial. El pantalón puede ser corto, largo o desmontable. Se permite otro diseño siempre que sea recto, sin aplicaciones y azul marino uniforme; la mezclilla solo si no está rota ni deslavada.
- **Cinturón:** liso, negro, con hebilla de máximo **45 mm** de diámetro.
- **Calcetas o tines:** azul marino, lisos y de tejido cerrado. Las calcetas se usan con las **motas** del color de la Sección; los tines van sin motas.
- **Motas:** rectángulo tejido de **30 a 60 mm** de ancho, doblado por la mitad, que sobresale **25 mm** del doblez de la calceta.
- **Pañoleta:** triangular, de unos **80 cm por cateto**, se enrolla y se coloca sobre el cuello de la camisola.

**Uniforme de gala:** traje sastre azul marino, camisa blanca de manga larga, corbata azul marino, morada o roja, y calzado de vestir negro. Se usa solo en ceremonias oficiales.

El manual busca que el uniforme sea **incluyente, adaptable al clima y al presupuesto**, sin perder la identidad scout.`,
  },
  {
    q: "¿De qué color es la camisola de cada sección scout?",
    cat: "Manuales Oficiales y de Operación",
    doc: "01 Manual del Uniforme Actualizado Junio 2026.pdf",
    page: 14,
    ans: `El color de la camisola identifica a cada Sección:

- **Amarilla:** Manada de Lobatos.
- **Verde:** Tropa de Scouts.
- **Azul:** Comunidad de Caminantes.
- **Roja:** Clan de Rovers.
- **Azul oxford:** exclusivo de Dirigentes y Scouters de Grupo.
- **Morada:** personal de Centros Scouts.

**Reglas adicionales:**

- Los Scouters usan la camisola del color de su Sección; el azul oxford es solo para Dirigentes.
- Los equipos de Provincia y Nacional pueden usar la camisola de la Sección en eventos de esa Sección o la oxford en actividades generales.
- Quienes colaboran en un evento de una Sección específica pueden usar el color correspondiente.
- Los formadores que imparten curso en una Sección usan el color de esa Sección.

El color no es un adorno: permite reconocer de inmediato a qué etapa del Movimiento pertenece cada persona y refuerza el sentido de pertenencia.`,
  },
  {
    q: "¿Dónde se colocan las insignias básicas en la camisola scout?",
    cat: "Manuales Oficiales y de Operación",
    doc: "01 Manual del Uniforme Actualizado Junio 2026.pdf",
    page: 23,
    ans: `El Manual del Uniforme 2026 fija la ubicación exacta de las insignias básicas:

- **Insignia de Compromiso (flor de lis):** al **centro de la bolsa izquierda** de la camisola. Es un círculo de tela morada con la flor de lis mundial bordada en blanco y el nudo rizo en la parte inferior.
- **Insignia de la ASMAC:** en la **parte superior derecha** de la camisola, a la altura del pecho.
- **Cinta de registro:** en la **solapa de la bolsa izquierda**, centrada y arriba del ojal; indica registro vigente en la ASMAC por el año en curso.
- **Sector de Provincia:** centrado en la **manga derecha**, aproximadamente **25 mm** bajo la costura del hombro.
- **Escudo de Grupo:** centrado en la **manga derecha**, unos **20 mm** abajo de la Cinta de Provincia; mide como máximo **85 mm** por lado.
- **Escudo de evento:** en la **bolsa derecha**; solo se porta uno a la vez, el del último evento al que se asistió, y por un máximo de **tres meses**.
- **Cintas de liderazgo y especialidades:** en la **presilla de la manga izquierda** o en la manga izquierda, según la Sección.

La regla general es que las insignias se colocan **planchadas, completas y en el lugar indicado**; no se deben acumular ni usar en prendas distintas a las previstas.`,
  },
  {
    q: "¿Cómo se porta la pañoleta scout y qué significa?",
    cat: "Manuales Oficiales y de Operación",
    doc: "01 Manual del Uniforme Actualizado Junio 2026.pdf",
    page: 28,
    ans: `La **pañoleta de Grupo** es una pieza triangular de aproximadamente **80 cm por cateto**, confeccionada con tela resistente para soportar el uso rudo de las actividades.

**Cómo se porta:**

- Se enrolla y se coloca alrededor del cuello **a manera de corbata**.
- Va **sobre el cuello de la camisola**.
- Se sujeta por delante con un **nudo elaborado con materiales resistentes y seguros**, o con un anillo.
- Su diseño y colores son propios de cada Grupo Scout y deben reforzar sus valores, apegándose al Manual de Identidad Institucional.
- Los extremos se anudan para **recordar la buena acción cotidiana**.

**La pañoleta nacional** es distinta: mide **1.60 por 0.71 m**, es de popelina y tiene fondo negro con una cintilla tricolor. Representa el respeto a la historia y a los antepasados, y en su diseño aparecen los **32 símbolos de las entidades federativas** y grecas de culturas originarias.

La pañoleta no es solo uniforme: es **identidad**. Por eso se cuida, se porta limpia y se respeta como símbolo de pertenencia al Grupo y al Movimiento.`,
  },

  // ============================================================
  // PROTECCIÓN Y SEGURIDAD
  // ============================================================
  {
    q: "¿Qué es la Política Nacional A Salvo del Peligro?",
    cat: "Reglamentos, Estatutos y Políticas",
    doc: "01 Política Nacional A Salvo del Peligro.pdf",
    page: 7,
    ans: `La **Política Nacional A Salvo del Peligro, Seguridad y Protección Juvenil** es el marco de la ASMAC para garantizar que niños, niñas, adolescentes y jóvenes estén **seguros y protegidos** durante su paso por el Movimiento Scout.

**Su enunciado:**

- La seguridad y la protección de la juventud son una **prioridad** para la Asociación.
- Se busca un ambiente **seguro, no discriminatorio y respetuoso**.
- La protección es una **actividad en la que todos participamos**: jóvenes, adultos, familias y comunidades.

**Objetivos:**

- Potenciar las actividades scouts como un **“ambiente seguro”**.
- Ejecutar actividades **DURAS**: Desafiantes, Útiles, Recompensantes, Atractivas y Seguras.
- Que la seguridad sea el **primer filtro** al diseñar y ejecutar actividades.
- Fomentar en los jóvenes una **cultura de prevención**.

**Dimensiones que abarca:**

- Seguridad en las actividades y en el transporte.
- Planificación y monitoreo.
- Prevención de violencia emocional, física y sexual, descuido y negligencia.
- Control de alcohol, tabaco y estupefacientes.
- Seguridad emocional y psicosocial.
- Ambientes digitales seguros.

La política se aprobó el **15 de mayo de 2019** y forma parte del compendio **A Salvo del Peligro** de la ASMAC.`,
  },
  {
    q: "¿Qué es el bullying y cómo se previene en un grupo scout?",
    cat: "Reglamentos, Estatutos y Políticas",
    doc: "04 Política Nacional sobre Bullying 2020.pdf",
    page: 6,
    ans: `La **Política Nacional sobre Bullying, violencia escolar o violencia entre iguales** define el bullying como una forma de **violencia física, psicológica o verbal entre iguales**, en la que uno o varios individuos molestan y agreden constantemente a compañeros que no pueden defenderse, a quienes consideran más vulnerables.

**Tipos de violencia:**

- **Física:** ataques directos, a veces precedidos por agresiones psicológicas.
- **Gestual:** gestos o expresiones para intimidar, burlarse o causar miedo.
- **Social:** aislamiento de la víctima del grupo.
- **Ciberbullying:** amenazas o humillaciones por internet o medios digitales.
- **Humillación:** ridiculizar el físico, las capacidades, la familia o las dificultades escolares.

**¿Quiénes participan?** Agresores, víctimas y espectadores o testigos.

**Prevención en el grupo:**

- Mantener una **comunicación asertiva** y de confianza con los menores.
- Ayudarles a identificar **cinco personas de confianza** a quienes acudir.
- Enseñarles a reconocer y nombrar la violencia.
- Poner un alto **desde el primer indicio**, para que la agresión no se normalice.
- Fortalecer la autoestima, los valores y el respeto.
- Incluir actividades que favorezcan la sana convivencia.
- Supervisar el uso de tecnología y hablar de los riesgos de compartir datos personales.

La política recuerda que **nadie debe maltratar ni ser maltratado**, y que la mejor prevención es una red de apoyo familiar y comunitaria sólida.`,
  },
  {
    q: "¿Dónde se denuncia un caso de bullying en Scouts de México?",
    cat: "Reglamentos, Estatutos y Políticas",
    doc: "04 Política Nacional sobre Bullying 2020.pdf",
    page: 17,
    ans: `La Política Nacional sobre Bullying establece una ruta clara:

1. **Primera instancia:** externar la situación con el **Dirigente del Grupo**.
2. **Si la acción sobrepasa al Grupo:** acudir a la **Comisión Nacional de Gestión Institucional**:
   - Teléfono: **(55) 5208 7122, extensión 135**.
   - Correo: **comision.gestion_institucional@scouts.org.mx**.
3. **Si la situación sigue sin resolverse:** acudir a la **Secretaría de Educación Pública (SEP)**:
   - Teléfono: **01 800 11 22676**.
   - Sitios: **www.acosoescolar.sep.gob.mx** y **https://www.gob.mx/escuelalibredeacoso**.

**Qué debe hacer el adulto que recibe el caso:**

- Escuchar con atención, sin juzgar, reclamar ni interrumpir.
- Hacerle saber a la víctima que **no es culpable**.
- Mantener la calma y no evadir el problema.
- No recomendar venganza.
- Buscar apoyo psicológico.
- Involucrar a la familia y a las autoridades correspondientes.
- Documentar lo ocurrido y resguardar la evidencia.

**Si el caso es de ciberbullying:** no responder los mensajes, guardar copia o impresión de la evidencia y acudir de inmediato a un adulto de confianza.`,
  },
];
