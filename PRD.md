# PRD — Diagnóstico energético adaptativo multiindustria de Mexillum

**Versión:** 1.1
**Fecha:** 31 de agosto de 2026
**Estado:** Plataforma base implementada; validación comercial y despliegue por etapas
**Responsable de producto:** Mexillum Energy
**Fuente de verdad:** Este documento sustituye como dirección futura a las especificaciones separadas del diagnóstico general y de hoteles. Las especificaciones anteriores siguen describiendo el comportamiento legado hasta completar la migración.

**Corte de implementación — 31 de agosto de 2026:** el hub, la nueva ruta general, Hoteles y los cinco perfiles están construidos sobre el core común. La publicación técnica de las rutas no sustituye las validaciones de ingeniería, copy y conversión definidas como criterios de salida de cada etapa.

---

## 1. Resumen ejecutivo

Mexillum convertirá los diagnósticos actuales en una sola plataforma adaptativa de calificación comercial y factibilidad preliminar para sistemas de generación, almacenamiento y gestión de energía.

La experiencia seguirá teniendo entradas comerciales específicas por industria, pero todas compartirán:

- Un motor común de reglas y cálculos.
- Un modelo único de resultado.
- Un flujo común de captura de contacto, enriquecimiento y agenda.
- Analítica consistente.
- Validación, accesibilidad y pruebas de extremo a extremo.

Las diferencias por industria vivirán como perfiles de configuración: vocabulario, subsegmentos, preguntas adicionales, pesos, restricciones, recomendaciones, datos para anteproyecto y copy de seguimiento.

La navegación principal quedará separada entre un hub y las experiencias de diagnóstico:

- **/diagnostico** — landing de selección; permite elegir qué diagnóstico realizar.
- **/diagnostico-industria-comercio** — diagnóstico general para industria y comercio.
- **/diagnostico-hoteles** — entrada hotelera con el perfil preseleccionado.

Se incorporarán cinco perfiles nuevos, por etapas:

1. Electromovilidad y centros de carga.
2. Cadena de frío, alimentos y bebidas.
3. Microredes y sitios remotos.
4. Bombeo de agua.
5. Centros de datos.

Cada perfil tendrá su propia URL comercial, pero no será una aplicación ni una copia independiente.

---

## 2. Problema

### 2.1 Estado actual

Mexillum cuenta con:

- Un diagnóstico general de ocho preguntas.
- Un diagnóstico hotelero construido como una copia extensa del contenido general.
- Un motor de reglas compartido para recomendar BESS, Solar, BESS + Solar, respaldo, diferimiento de capacidad, sustitución de diésel o microred.
- Pasos posteriores para dibujar techo, subir recibos, dejar contacto y agendar.

La base técnica es valiosa, pero la experiencia actual presenta problemas de producto:

1. **Duplicación por vertical.** La mayor parte del contenido general y hotelero es idéntico. Cada cambio puede generar deriva entre versiones.
2. **Fragilidad de integración.** Una diferencia de contrato entre el contenido hotelero y la vista puede bloquear el resultado completo.
3. **Captura comercial tardía.** El prospecto puede terminar el diagnóstico, ver el resultado y abandonar sin dejar señal alguna.
4. **Enriquecimiento no adaptativo.** Todos reciben la solicitud de marcar techo y subir facturas, aunque su recomendación principal no incluya Solar.
5. **Pérdida de intención.** Quien llena sus datos y abre el calendario no se registra hasta completar la reserva.
6. **Mensajes de éxito no confiables.** La interfaz puede confirmar antes de conocer la respuesta real del servidor.
7. **Falta de medición.** No existe visibilidad suficiente de inicio, abandono por pregunta, resultado, intención, enriquecimiento o reserva.
8. **Pérdida de estado.** Una recarga o interrupción reinicia el cuestionario.
9. **Resultado redundante.** La aplicación principal, las palancas y el ranking repiten parte de la misma conclusión.
10. **Encaje y tamaño mezclados.** El nivel de potencial combina facturación, ajuste técnico y disponibilidad de datos, pero se presenta como una sola señal.

### 2.2 Oportunidad

Una plataforma adaptativa permitirá que Mexillum:

- Hable el lenguaje operativo de cada prospecto.
- Califique oportunidades con mayor precisión.
- Capture el lead en el momento de máximo valor percibido.
- Solicite únicamente los datos que corresponden a la solución recomendada.
- Compare conversión y calidad de leads entre perfiles.
- Añada nuevas industrias sin duplicar la aplicación.
- Mantenga consistencia técnica y comercial en resultados, correos y agenda.

---

## 3. Objetivos

### 3.1 Objetivos de negocio

1. Aumentar la conversión de diagnóstico terminado a lead conocido.
2. Mejorar la calidad del lead mediante información técnica relevante para su caso.
3. Reducir el abandono antes de contacto o agenda.
4. Identificar qué perfiles producen más oportunidades calificadas.
5. Acelerar la preparación de un anteproyecto comercial.
6. Mantener una experiencia especializada sin multiplicar el costo de mantenimiento.

### 3.2 Objetivos del usuario

El prospecto debe poder:

- Entender en menos de dos minutos qué soluciones podrían aplicar.
- Recibir una recomendación en lenguaje propio de su industria.
- Saber qué mejora busca la solución y qué falta para confirmarla.
- Distinguir una orientación preliminar de una propuesta formal.
- Recibir el diagnóstico por correo sin entregar documentos primero.
- Elegir entre profundizar el anteproyecto o agendar una conversación.
- Retomar un diagnóstico interrumpido sin comenzar de nuevo.

### 3.3 Metas iniciales

Las metas relativas se medirán contra una línea base de 30 días:

- Cero errores bloqueantes en las rutas publicadas.
- 100% de los perfiles con una prueba completa desde inicio hasta captura de lead.
- 100% de los hitos del embudo instrumentados.
- Mediana de tiempo del cuestionario menor o igual a 2 minutos; no incluye enriquecimiento.
- Incremento mínimo de 25% en conversión de resultado mostrado a lead conocido después de ocho semanas.
- Registro de al menos 95% de los contactos que abran el calendario, aunque no reserven.
- Reducción mínima de 20% en abandono entre resultado y contacto.

---

## 4. Fuera de alcance

Esta versión no pretende:

- Sustituir un estudio de ingeniería, simulación horaria o propuesta económica.
- Dimensionar automáticamente equipos finales a partir de ocho respuestas.
- Prometer ahorro, autonomía o retorno garantizados.
- Crear una aplicación independiente por industria.
- Integrar un CRM específico mientras no se defina el destino comercial final.
- Reconocer automáticamente todos los campos de una factura mediante OCR en la primera etapa.
- Generar un contrato o propuesta técnica final sin revisión humana.
- Activar campañas masivas para los cinco perfiles sin superar primero sus criterios de validación.

---

## 5. Principios de producto

### 5.1 Valor antes de fricción

El resultado preliminar se muestra antes de solicitar documentos. La captura de contacto ocurre inmediatamente después del resultado y antes del enriquecimiento pesado.

### 5.2 Especialización comercial, plataforma común

Cada industria puede tener URL, campaña, ejemplos, subsegmentos y resultado propios. El flujo, estado, validación, analítica, motor y componentes permanecen unificados.

### 5.3 Preguntas adaptativas

No todos los prospectos deben responder todo. Las preguntas condicionales aparecen solo cuando una respuesta puede cambiar la recomendación o el siguiente paso.

### 5.4 Honestidad técnica

Cuando faltan datos, el resultado debe decir qué se puede concluir y qué no. El sistema puede recomendar “primero eficiencia o control” o “evidencia insuficiente”; no está obligado a recomendar un producto Mexillum.

### 5.5 Separación de señales

El resultado distingue:

- Encaje técnico.
- Tamaño de oportunidad.
- Confianza de la conclusión.
- Intención comercial.

### 5.6 Enriquecimiento pertinente

Techo, facturas, diagrama unifilar, cargadores, bombas, UPS o consumo de diésel se solicitan según el resultado, no como una lista universal.

### 5.7 Estado confiable

Los éxitos se muestran únicamente después de una respuesta exitosa del servidor. Los reintentos conservan la información del usuario.

### 5.8 Privacidad visible

Antes de solicitar ubicación, recibos o documentos técnicos se explica para qué se usarán, quién tendrá acceso y cómo consultar el aviso de privacidad.

---

## 6. Audiencias

### 6.1 Usuario principal

Responsable o participante en una decisión energética:

- Dirección general.
- Finanzas.
- Operaciones.
- Mantenimiento o ingeniería.
- Energía o sostenibilidad.
- Desarrollo de infraestructura.

### 6.2 Usuario asistido

Prospecto que recibió un enlace directo de un vendedor y ya conoce a Mexillum. Puede utilizar una ruta de captura abreviada, pero esa ruta no debe producir un “diagnóstico” con respuestas vacías.

### 6.3 Equipo interno

Ventas e ingeniería necesitan recibir:

- Perfil e industria.
- Respuestas legibles y códigos.
- Recomendación y aplicación principal.
- Encaje, tamaño, confianza e intención.
- Datos faltantes.
- Documentos y ubicación cuando existan.
- Estado comercial: capturado, solicitó correo, abrió agenda o reservó.

---

## 7. Arquitectura de experiencia

### 7.1 Rutas

| Ruta | Perfil inicial | Comportamiento |
|---|---|---|
| /diagnostico | Ninguno | Landing de selección; no ejecuta el cuestionario ni calcula resultados |
| /diagnostico-industria-comercio | Industria y comercio | Comienza con el tipo de operación o instalación |
| /diagnostico-hoteles | Hoteles | Omite selección de industria y comienza con subtipo de propiedad |
| /diagnostico-electromovilidad | Electromovilidad | Comienza con tipo de operación de carga |
| /diagnostico-cadena-frio | Cadena de frío | Comienza con tipo de instalación refrigerada o alimentaria |
| /diagnostico-microred | Microred remota | Comienza con estado de conexión a red y tipo de sitio |
| /diagnostico-bombeo | Bombeo de agua | Comienza con tipo de sistema de bombeo |
| /diagnostico-centros-datos | Centros de datos | Comienza con tipo y etapa de la instalación |

Las rutas de diagnóstico son aliases comerciales y arrancan el mismo inicializador con un profile_id diferente. /diagnostico es la única excepción: renderiza el hub y no carga el motor de diagnóstico hasta que el usuario elige una ruta.

### 7.2 Landing de selección en /diagnostico

La ruta /diagnostico funciona como catálogo y enrutador de diagnósticos, no como un paso adicional dentro del cuestionario.

#### Objetivo

- Ayudar a un prospecto que llega sin contexto a encontrar el diagnóstico correcto.
- Dar a Mexillum una URL única para compartir cuando todavía no conoce la industria del prospecto.
- Mantener URLs específicas para campañas, alianzas y vendedores que sí conocen el perfil.

#### Contenido mínimo

- Título: **¿Qué tipo de operación quieres evaluar?**
- Introducción breve: cada diagnóstico tarda aproximadamente dos minutos y entrega una orientación preliminar.
- Una opción por perfil con nombre, ejemplo de usuario y beneficio principal.
- Acción secundaria: **No sé cuál elegir**.
- Nota clara de que el resultado es preliminar y no sustituye un estudio de ingeniería.

#### Opciones

| Opción visible | Ruta | Descripción corta |
|---|---|---|
| Industria y comercio | /diagnostico-industria-comercio | Plantas, manufactura, comercios, edificios y operaciones generales |
| Hoteles | /diagnostico-hoteles | Resorts, hoteles urbanos, boutique y propiedades en expansión |
| Electromovilidad | /diagnostico-electromovilidad | Flotillas, patios logísticos y centros de carga |
| Cadena de frío y alimentos | /diagnostico-cadena-frio | Refrigeración, CEDIS, alimentos, bebidas y supermercados |
| Microredes y sitios remotos | /diagnostico-microred | Operaciones con diésel, red débil o sin conexión |
| Bombeo de agua | /diagnostico-bombeo | Pozos, rebombeo, tratamiento, riego y bombeo industrial |
| Centros de datos | /diagnostico-centros-datos | Infraestructura digital existente, expansión y misión crítica |

#### “No sé cuál elegir”

Esta acción abre un selector corto de una sola pregunta basada en el problema:

- Mi operación es industrial o comercial.
- Mi principal carga es refrigeración.
- Necesito cargar vehículos.
- Tengo red débil, diésel o no tengo conexión.
- Mi consumo principal es bombeo.
- Opero infraestructura digital crítica.
- Ninguna de las anteriores.

La última opción dirige a Industria y comercio. El selector no calcula ni guarda un diagnóstico parcial.

#### Estados de publicación

Cada opción tiene uno de tres estados:

- **Disponible:** abre su diagnóstico.
- **Piloto:** abre el diagnóstico e identifica el lead como piloto.
- **Próximamente:** no abre una experiencia incompleta; permite dejar nombre, correo, empresa y perfil de interés.

Los perfiles no publicados pueden ocultarse de campañas generales, pero deben ser accesibles como “Próximamente” si Mexillum desea captar demanda anticipada.

#### Requisitos de navegación

- Conservar parámetros UTM y origen al abrir la ruta seleccionada.
- Registrar la selección antes de navegar.
- Permitir abrir el diagnóstico con teclado y tecnologías de asistencia.
- No añadir la selección al conteo de preguntas ni al tiempo prometido de dos minutos.
- Las rutas específicas evitan el hub y comienzan directamente el diagnóstico.
- La navegación Atrás desde la primera pregunta de una ruta específica vuelve a su introducción, no obliga a pasar por el hub.

#### SEO y enlaces existentes

- /diagnostico tendrá título y descripción orientados a elegir una herramienta.
- Cada diagnóstico tendrá metadatos, canonical y Open Graph propios.
- Enlaces históricos a /diagnostico llegarán al hub; campañas que requieran entrada directa deberán actualizarse a /diagnostico-industria-comercio.
- No se redirige automáticamente /diagnostico a Industria y comercio porque eso impediría utilizarlo como selector.

### 7.3 Flujo objetivo

1. **Promesa e inicio.** Explica el valor, duración y alcance preliminar.
2. **Subtipo.** Pregunta propia del perfil.
3. **Objetivo o disparador.** Se adelanta al inicio para conocer la intención y ramificar.
4. **Núcleo técnico común.** Perfil de consumo, generación, tarifa y factura.
5. **Preguntas condicionales.** Máximo dos o tres según señales.
6. **Resultado.** Recomendación, mejora, magnitud, confianza y dato faltante.
7. **Checkpoint de conversión.** Enviar diagnóstico, afinar anteproyecto o hablar con especialista.
8. **Enriquecimiento condicional.** Documentos o datos específicos.
9. **Handoff.** Correo, agenda o contacto comercial.

El hub de /diagnostico ocurre antes de este flujo y no forma parte del cuestionario.

### 7.4 Número de preguntas

- Ruta especializada: entre 6 y 8 preguntas visibles.
- Ruta Industria y comercio: entre 6 y 8 preguntas visibles, incluida su clasificación de operación.
- Máximo absoluto: 9 preguntas antes del resultado.
- Una decisión por pantalla.
- Máximo recomendado de 4 opciones visibles; cuando haya más se agrupan o se usa divulgación progresiva.

---

## 8. Núcleo común de preguntas

El texto visible se adapta al perfil, pero los conceptos permanecen estables.

### Q1 — Subtipo de sitio

Define el contexto operativo dentro del perfil. No debe mezclar tipo de instalación con etapa del proyecto si ambos pueden coexistir.

### Q2 — Objetivo o disparador

Multiselección con una opción exclusiva “solo reducir costo”. Señales base:

- Reducir costo de energía.
- Resolver capacidad insuficiente.
- Mejorar continuidad o calidad.
- Sustituir diésel.
- Aprovechar generación o excedentes.
- Operar aislado.
- Cumplir una fecha de expansión o entrada en operación.

El perfil puede cambiar el vocabulario y ocultar opciones irrelevantes.

### Q3 — Perfil de consumo

Opciones base:

- Parejo 24/7.
- Mayor durante el día.
- Picos breves e intensos.
- Concentrado en horario punta.
- Programable o desplazable.
- No se conoce.

### Q4 — Generación existente

- Solar detrás del medidor.
- Contrato renovable o suministro calificado.
- Generación estacional.
- Sin generación.
- En evaluación.

### Q5 — Tarifa o suministro

- GDMTH.
- GDMTO.
- DIST/DIT.
- GDBT.
- PDBT.
- Suministro privado.
- No se conoce.

Debe incluir ayuda visual para localizar la tarifa y permitir continuar sin recibo.

### Q6 — Escala económica

La factura mensual conserva rangos preliminares. Cada perfil puede complementar con una unidad más natural, pero no sustituir la factura sin una razón técnica.

### Preguntas condicionales comunes

#### Continuidad y calidad

Si el objetivo o una señal apunta a respaldo:

- Tipo de problema: factor de potencia, variaciones, microcortes o apagones; permite multiselección.
- Impacto de 30 minutos.
- Frecuencia y duración aproximada.

#### Capacidad

Si existe expansión o restricción:

- Capacidad adicional requerida, aunque sea por rango.
- Fecha objetivo.
- Estado de solicitud o ampliación con CFE.

#### Diésel

Si se utiliza combustible:

- Horas por mes o año.
- Consumo o gasto aproximado.
- Uso principal o emergencia.

---

## 9. Modelo de resultado

### 9.1 Resultado visible

El resultado se reduce a cuatro bloques:

1. **Qué configuración evaluar.** Una recomendación principal, no una lista de productos.
2. **Qué puede mejorar.** Beneficio económico u operativo y una palanca secundaria cuando sea relevante.
3. **Qué tan firme es la conclusión.** Nivel de confianza, supuestos y máximo dos datos que faltan.
4. **Siguiente paso recomendado.** Acción adaptada al perfil y la solución.

### 9.2 Dimensiones internas

#### Encaje técnico

Evalúa si la configuración responde al perfil de consumo, tarifa, generación, continuidad y disparadores.

Valores visibles: Alto, Medio, Bajo o No concluyente.

#### Tamaño de oportunidad

Se basa en escala económica, capacidad, diésel, costo de interrupción u otra unidad pertinente.

Valores visibles: Alto, Medio, Bajo o Sin cuantificar.

#### Confianza

Depende de datos conocidos y consistencia de las respuestas.

Valores visibles: Alta, Media o Preliminar.

#### Intención comercial

Se usa internamente y no se presenta como score al prospecto. Considera urgencia, expansión, documentos compartidos, solicitud de correo, apertura de agenda y reserva.

### 9.3 Rangos económicos

- Peak shaving y arbitraje pueden conservar cálculos por tarifa, factura y perfil.
- Si la aplicación principal es respaldo, capacidad, diésel o microred, se puede mostrar un ahorro tarifario secundario cuando sea calculable.
- Nunca se deriva el valor de continuidad, capacidad evitada o diésel como porcentaje genérico de la factura.
- Todo número muestra supuestos y la leyenda de orientación preliminar.
- Cuando no existe base responsable, el resultado presenta el dato necesario sin inventar una cifra.

### 9.4 Configuraciones posibles

- Solar fotovoltaico on-grid.
- BESS.
- BESS sobre solar existente.
- BESS + Solar.
- BESS para respaldo con capacidad de isla.
- BESS para diferir capacidad.
- BESS para sustitución de diésel.
- Microred Solar + BESS + respaldo.
- Gestión de carga o control antes que BESS.
- Eficiencia operativa antes que generación o almacenamiento.
- Evidencia insuficiente.

---

## 10. Conversión y handoff

### 10.1 Acciones después del resultado

#### Enviarme el diagnóstico

- Requiere nombre y correo.
- Empresa es opcional en este camino.
- Envía el resumen completo y registra el lead.
- El botón muestra éxito solo después de respuesta exitosa.

#### Afinar mi anteproyecto

- Captura primero nombre y correo.
- Después solicita datos específicos del perfil y recomendación.
- Permite saltar cualquier enriquecimiento y volver después.

#### Hablar con un especialista

- Requiere nombre, correo y empresa.
- Registra el lead antes de abrir el calendario con estado calendar_opened.
- Prefill de nombre y correo.
- La reserva actualiza el mismo lead a booked usando lead_id.

### 10.2 Idempotencia

lead_id identifica todo el recorrido. Las acciones posteriores actualizan el mismo registro; no aplica “el primer envío gana”.

Estados comerciales mínimos:

- result_viewed.
- contact_captured.
- diagnosis_emailed.
- enrichment_started.
- enrichment_completed.
- calendar_opened.
- booked.

### 10.3 Ruta asistida

El modo rápido se redefine como captura asistida, no como diagnóstico vacío.

Requisitos:

- Debe recibir profile_id explícito o preguntar el perfil.
- No genera recomendación técnica si no hay respuestas suficientes.
- El correo interno utiliza “Solicitud de anteproyecto” en lugar de “Diagnóstico completado”.
- Nunca produce perfiles con valores indefinidos.

---

## 11. Contrato de un perfil vertical

Cada perfil define únicamente diferencias sobre la base común.

| Campo | Responsabilidad |
|---|---|
| id | Identificador estable para rutas, analítica y leads |
| version | Versión de reglas y copy usada para reproducibilidad |
| route | Entrada comercial principal |
| origin | Etiqueta de origen enviada al lead |
| label | Nombre visible de la industria |
| siteLabel | Operación, propiedad, sitio, estación, campus, sistema, etc. |
| introOverrides | Promesa y ejemplos de la industria |
| subtypeQuestion | Opciones del subtipo de instalación |
| questionOverrides | Copy o unidades específicas |
| conditionalQuestions | Preguntas exclusivas y sus condiciones |
| scoringDeltas | Pesos, boosts, caps y precedencias adicionales |
| resultCopy | Recomendaciones y beneficios específicos |
| enrichmentPlan | Datos y documentos según familia de solución |
| emailVocabulary | Vocabulario del correo para prospecto y ventas |
| calLink | Tipo de evento de agenda |

### 11.1 Composición

La aplicación construye el contenido efectivo mediante:

**base común + arquetipo energético + perfil comercial**

Ejemplo:

- Hotel urbano: base + carga crítica 24/7 + perfil hotelero.
- Mina remota: base + microred diésel + perfil remoto.
- Centro de distribución refrigerado: base + carga térmica crítica + perfil cadena de frío.

### 11.2 Validación de contrato

Antes de publicar un perfil, una prueba automática debe verificar:

- Campos obligatorios.
- Códigos únicos.
- Cobertura de opciones en scoring y copy.
- Existencia de todos los textos consumidos por la vista.
- Recomendaciones válidas para cada combinación.
- Ausencia de referencias al vocabulario de otra industria.

---

## 12. Perfil existente — Hoteles

El perfil hotelero se migra primero para validar la arquitectura.

### 12.1 Subtipos

- All-inclusive.
- Resort de playa.
- Boutique o lifestyle.
- Urbano o de negocios.

La expansión deja de ser subtipo y se captura como disparador independiente.

### 12.2 Señales propias

- Climatización y bombeo 24/7.
- Ocupación y estacionalidad.
- Cocina, lavandería y cadena de frío.
- Experiencia del huésped.
- Huracanes y continuidad.
- Nuevas llaves, torres o amenidades.

### 12.3 Datos posteriores

- Recibos y perfil de carga.
- Ocupación mensual cuando sea relevante.
- Cargas críticas: chillers, bombeo, PMS, elevadores y refrigeración.
- Superficie disponible solo para soluciones con Solar.
- Horas y costo de diésel cuando aplique.

### 12.4 Criterio de migración

La nueva versión debe producir conclusiones equivalentes o más conservadoras que la actual para los fixtures aprobados y completar el recorrido sin errores.

---

## 13. Perfil nuevo 1 — Electromovilidad y centros de carga

### 13.1 Alcance

- Flotillas privadas.
- Patios logísticos.
- Autobuses y transporte pesado.
- Centros públicos de carga.
- Carga en centros comerciales, oficinas o vivienda multifamiliar.

### 13.2 Compradores principales

- Operaciones de flota.
- Infraestructura y desarrollo.
- Finanzas.
- Energía o sostenibilidad.
- Operadores de estaciones de carga.

### 13.3 Preguntas específicas

1. Tipo de operación: flotilla propia, transporte pesado, carga pública o carga para usuarios de un inmueble.
2. Número de vehículos actuales y previstos a 24 meses.
3. Potencia y cantidad de cargadores existentes o planeados.
4. Simultaneidad esperada.
5. Ventana disponible de carga: nocturna, durante turnos, oportunidad o continua.
6. Capacidad eléctrica disponible y estado de ampliación con CFE.
7. Fecha objetivo de entrada en operación.
8. Disponibilidad de techo, estacionamiento o marquesina para Solar, solo si Solar es viable.

No todas aparecen: cantidad, potencia y ventana pueden agruparse en dos pasos adaptativos.

### 13.4 Aplicaciones y lógica

- Diferimiento de capacidad lidera cuando la potencia requerida supera la disponible o la ampliación no llega a tiempo.
- Gestión de carga puede recomendarse antes que BESS cuando la ventana operativa permite secuenciar cargadores.
- Peak shaving aplica a simultaneidad alta y cargos por demanda.
- BESS + Solar aplica con carga diurna, marquesina o metas renovables.
- Respaldo solo aplica si la operación exige continuidad de carga; no se asume por defecto.

### 13.5 Datos para anteproyecto

- Inventario de cargadores y fichas técnicas.
- Calendario de rutas, llegadas y salidas.
- Potencia disponible y diagrama unifilar.
- Solicitud o respuesta de CFE.
- Curva de carga existente.
- Plano de estacionamiento o marquesinas.

### 13.6 Resultados posibles

- Gestión inteligente de carga primero.
- BESS para habilitar potencia de carga.
- BESS para peak shaving.
- Solar + carga gestionada.
- BESS + Solar para centro de carga.
- Evidencia insuficiente hasta conocer potencia y ventana.

---

## 14. Perfil nuevo 2 — Cadena de frío, alimentos y bebidas

### 14.1 Alcance

- Almacenes refrigerados.
- CEDIS y logística de frío.
- Plantas de alimentos y bebidas.
- Lácteos, hielo y congelados.
- Supermercados con carga significativa de refrigeración.

### 14.2 Compradores principales

- Operaciones.
- Refrigeración y mantenimiento.
- Calidad o inocuidad.
- Finanzas.
- Dirección de planta.

### 14.3 Preguntas específicas

1. Tipo de instalación y rango de temperatura: ambiente controlado, refrigerado o congelado.
2. Porcentaje aproximado de carga asociado a refrigeración o si se desconoce.
3. Operación: continua, por turnos o estacional.
4. Patrón de compresores, deshielos y arranques simultáneos.
5. Consecuencia de perder temperatura durante 30 minutos, 2 horas y 4 horas.
6. Generación y respaldo existentes.
7. Estacionalidad de producción o inventario.
8. Superficie disponible, únicamente para rutas solares.

### 14.4 Aplicaciones y lógica

- Peak shaving gana peso con arranques, compresores simultáneos o deshielos concentrados.
- Arbitraje gana peso con operación continua y tarifa horaria.
- Respaldo se evalúa con tiempo térmico, pérdida de producto y frecuencia de cortes.
- BESS + Solar aplica cuando existe carga diurna y superficie.
- Corrección de factor de potencia puede ser palanca adicional.
- Eficiencia de refrigeración puede ser recomendación previa cuando el problema principal es equipo ineficiente, no suministro.

### 14.5 Datos para anteproyecto

- Perfil de carga de 15 minutos.
- Lista y potencia de compresores.
- Horarios de deshielo.
- Temperaturas objetivo y tolerancias.
- Tiempo de conservación sin energía.
- Historial de producto perdido.
- Recibos y penalización de factor de potencia.
- Plano o techo solo si se recomienda Solar.

### 14.6 Resultados posibles

- Peak shaving para refrigeración.
- Arbitraje con carga térmica continua.
- Respaldo de cadena de frío.
- BESS + Solar.
- Eficiencia o control de refrigeración primero.
- Combinación de continuidad y ahorro tarifario.

---

## 15. Perfil nuevo 3 — Microredes y sitios remotos

### 15.1 Alcance

- Minería.
- Agroindustria remota.
- Telecomunicaciones.
- Comunidades o servicios aislados.
- Eco-resorts o instalaciones sin red confiable.
- Operaciones conectadas con uso intensivo de diésel.

### 15.2 Compradores principales

- Dirección de proyecto.
- Operaciones.
- Mantenimiento.
- Abastecimiento de combustible.
- Finanzas.

### 15.3 Preguntas específicas

1. Estado de conexión: sin red, red débil, red confiable o conexión futura.
2. Consumo diario aproximado en kWh y pico en kW, con opción “no lo sé”.
3. Horas de operación por día y estacionalidad.
4. Generadores: potencia, combustible y uso principal o emergencia.
5. Horas anuales, litros o gasto de combustible.
6. Autonomía requerida sin sol ni red.
7. Cargas que no pueden interrumpirse.
8. Espacio y condiciones del sitio para Solar y BESS.

### 15.4 Aplicaciones y lógica

- La intención de operar aislado cambia la recomendación a arquitectura de microred.
- Diésel frecuente permite estimar desplazamiento únicamente con horas y consumo.
- Solar + BESS + generador se presenta como sistema híbrido; no se promete eliminar el generador sin simulación.
- En red débil se separan ahorro y resiliencia.
- La logística y costo de combustible pueden pesar más que la factura eléctrica.

### 15.5 Datos para anteproyecto

- Curva de carga o consumo diario.
- Potencia y fichas de generadores.
- Historial de combustible.
- Requerimiento de autonomía.
- Ubicación y condiciones ambientales.
- Área disponible.
- Distancia y factibilidad de conexión a red.

### 15.6 Resultados posibles

- Microred Solar + BESS + respaldo.
- BESS para sustitución parcial de diésel.
- BESS para estabilizar red débil.
- Sistema híbrido conectado.
- Medición temporal antes de dimensionar.

---

## 16. Perfil nuevo 4 — Bombeo de agua

### 16.1 Alcance

- Agua potable municipal.
- Pozos y rebombeo.
- Tratamiento de aguas residuales.
- Riego agrícola.
- Bombeo industrial.

### 16.2 Compradores principales

- Organismos operadores.
- Municipios.
- Operaciones agrícolas.
- Ingeniería y mantenimiento.
- Finanzas o administración pública.

### 16.3 Preguntas específicas

1. Tipo de sistema: pozo, captación, conducción, rebombeo, tratamiento o riego.
2. Número y potencia aproximada de bombas.
3. Horario actual de operación.
4. Posibilidad de mover bombeo fuera de punta.
5. Existencia y capacidad de tanques o almacenamiento hidráulico.
6. Profundidad, carga dinámica o desnivel, cuando se conozca.
7. Variadores de frecuencia y estado de motores.
8. Criticidad del suministro y autonomía hidráulica.

### 16.4 Aplicaciones y lógica

- La programación operativa y el almacenamiento hidráulico se evalúan antes que BESS.
- Arbitraje puede lograrse trasladando bombeo sin batería cuando existe capacidad de almacenamiento de agua.
- Peak shaving aplica con arranques simultáneos o demanda máxima elevada.
- Solar directo puede liderar en bombeo diurno o riego.
- BESS se recomienda cuando la restricción de horario, continuidad o capacidad no se resuelve operativamente.
- Eficiencia de motores, bombas o variadores puede ser la primera recomendación.

### 16.5 Datos para anteproyecto

- Inventario de bombas y motores.
- Curva de operación y caudal.
- Niveles, presión y altura dinámica.
- Horarios y secuencia de arranque.
- Capacidad de tanques.
- Recibos y demanda máxima.
- Diagrama eléctrico y control existente.

### 16.6 Resultados posibles

- Optimización operativa sin BESS.
- Eficiencia de bombeo primero.
- Solar para bombeo.
- BESS para peak shaving.
- BESS para continuidad.
- Sistema combinado Solar + BESS.

---

## 17. Perfil nuevo 5 — Centros de datos

### 17.1 Alcance

- Centros de datos empresariales.
- Colocation.
- Edge data centers.
- Campus nuevos o en expansión.

El perfil no se publicará hasta contar con validación de ingeniería especializada y una propuesta comercial capaz de atender el nivel de exigencia del sector.

### 17.2 Compradores principales

- Facilities.
- Ingeniería eléctrica.
- Operaciones de misión crítica.
- Finanzas.
- Sostenibilidad.
- Desarrollo de capacidad.

### 17.3 Preguntas específicas

1. Tipo y etapa: existente, expansión o greenfield.
2. Carga IT actual y proyectada.
3. Nivel de redundancia: N, N+1, 2N u otro.
4. UPS existente: tecnología, potencia, edad y autonomía.
5. Generadores: potencia, combustible y régimen de pruebas.
6. Restricción de capacidad de red y fecha de expansión.
7. Perfil de enfriamiento o PUE, cuando se conozca.
8. Objetivo: capacidad, resiliencia, diésel, renovables o costo.

### 17.4 Aplicaciones y lógica

- No se recomienda reemplazar UPS ni generadores a partir del cuestionario.
- BESS puede evaluarse para capacidad, soporte a UPS, peak shaving, arbitraje o reducción de diésel según la arquitectura.
- La compatibilidad con redundancia, protecciones, transferencia y operación en isla es obligatoria antes de recomendar.
- Solar se presenta como fuente complementaria, no como garantía de continuidad.
- Las conclusiones permanecen “preliminares” hasta recibir diagrama unifilar, arquitectura de UPS y perfil de carga.

### 17.5 Datos para anteproyecto

- Diagrama unifilar.
- Carga IT y carga total.
- Curva de carga.
- Arquitectura y fichas de UPS.
- Generadores, ATS y esquema de redundancia.
- Historial de calidad y continuidad.
- Plan de crecimiento.
- Restricciones de interconexión.

### 17.6 Resultados posibles

- Estudio de capacidad y resiliencia requerido.
- BESS para diferimiento de capacidad.
- BESS integrado a la arquitectura de respaldo.
- BESS para ahorro tarifario como beneficio secundario.
- Estrategia renovable con almacenamiento.
- Evidencia insuficiente; revisión de ingeniería obligatoria.

---

## 18. Enriquecimiento condicional

El sistema selecciona módulos según la familia de recomendación.

| Módulo | Se solicita cuando | Datos principales |
|---|---|---|
| Recibos | Existe suministro eléctrico y oportunidad tarifaria | Hasta 12 recibos, tarifa, RPU |
| Techo o terreno | Solar forma parte de la configuración | Ubicación, polígonos, área, fotos |
| Punto eléctrico | Existe mapa del sitio o la distancia eléctrica puede cambiar el anteproyecto | Pin de acometida, medidor, transformador, subestación o tablero; precisión y kVA opcionales |
| Perfil de carga | Peak shaving, arbitraje o capacidad | Archivo de 15 minutos o medición |
| Continuidad | Respaldo o red débil | Cargas críticas, frecuencia, duración, costo |
| Capacidad | Expansión o interconexión limitada | kW actuales/adicionales, fecha, solicitud CFE |
| Diésel | Uso frecuente o microred | Potencia, horas, litros, costo |
| Electromovilidad | Carga de vehículos | Cargadores, horarios, flota, simultaneidad |
| Refrigeración | Cadena de frío | Compresores, deshielo, temperatura, inercia térmica |
| Bombeo | Agua | Bombas, caudal, niveles, tanques, horarios |
| Misión crítica | Centros de datos | UPS, generadores, redundancia, unifilar |

Los módulos son opcionales para enviar el diagnóstico y obligatorios únicamente cuando el usuario solicita un anteproyecto con mayor precisión.

---

## 19. Arquitectura técnica propuesta

### 19.1 Componentes

- **Core de aplicación:** máquina de estados, render, navegación, persistencia, validación y eventos.
- **Motor:** reglas puras y cálculos comunes.
- **Perfil:** diferencias declarativas por vertical.
- **Arquetipos:** módulos reutilizables para carga 24/7, capacidad, continuidad, Solar, diésel, microred, bombeo y misión crítica.
- **Resultado:** compositor único de encaje, tamaño, confianza y siguiente paso.
- **Enriquecimiento:** registro de módulos condicionales.
- **Lead API:** upsert idempotente por lead_id.
- **Booking:** actualiza el mismo lead mediante evento de cliente y webhook servidor.
- **Analítica:** eventos sin información personal.

### 19.2 Estructura orientativa

La implementación puede adaptar nombres, pero debe conservar la separación:

- js/diagnostico.app.js — flujo común.
- js/diagnostico.engine.js — motor puro.
- js/diagnostico.base.content.js — preguntas y copy universales.
- js/diagnostico.profiles/ — overrides por perfil.
- js/diagnostico.archetypes/ — reglas compartidas por tipo de problema.
- js/diagnostico.enrichment.js — selección de módulos posteriores.
- js/diagnostico.analytics.js — contrato de eventos.
- js/diagnostico.state.js — persistencia y migración de estado.

El cambio de rutas requiere además:

- diagnostico/index.html — nuevo hub de selección.
- diagnostico-industria-comercio/index.html — entrada del diagnóstico general actual, migrada al nuevo core.
- Una configuración de hub con perfiles, estado de publicación, ruta y descripción; no se duplican las tarjetas directamente en HTML.
- Canonical y Open Graph propios para el hub y para Industria y comercio.

### 19.3 Compatibilidad

- Las URLs actuales se conservan.
- leadPayload mantiene campos actuales durante la migración y agrega `acometida` como objeto opcional con coordenadas, tipo, precisión y capacidad_kva.
- Se agregan profile_id, profile_version, session_id, lead_stage, fit, opportunity_size, confidence y commercial_intent.
- respuestas_codigos conserva valores estables cuando el significado no cambia.
- Los correos anteriores siguen funcionando con payloads sin los campos nuevos.

---

## 20. Estado y persistencia

### 20.1 Estado mínimo

- session_id.
- lead_id.
- profile_id y profile_version.
- route y origen.
- paso actual.
- respuestas.
- resultado calculado.
- módulos de enriquecimiento completados.
- estado comercial.

### 20.2 Persistencia local

- Se guardan progreso y respuestas no personales durante siete días.
- No se guardan archivos, tokens firmados, contacto, dirección precisa, polígonos ni coordenadas de acometida en almacenamiento local persistente.
- El usuario puede reiniciar y borrar el estado.
- Una versión de esquema permite migrar o descartar estados incompatibles.

---

## 21. API y modelo de lead

### 21.1 Operación

/api/lead debe aceptar creación y actualización idempotente por lead_id.

El servidor valida exactamente los mismos requisitos que la interfaz:

- Envío por correo: nombre y correo.
- Agenda: nombre, correo y empresa.
- Teléfono siempre opcional.

### 21.2 Campos nuevos

- profile_id.
- profile_version.
- session_id.
- lead_stage.
- route.
- origin.
- fit.
- opportunity_size.
- confidence.
- commercial_intent.
- primary_application.
- secondary_application.
- recommended_configuration.
- missing_data.
- enrichment_modules.

### 21.3 Respuesta al cliente

- Éxito: confirma acción concreta y siguiente paso.
- Error validable: identifica el campo y conserva el formulario.
- Error de servidor: no muestra éxito, permite reintentar y ofrece contacto alternativo.
- El correo usa vocabulario del perfil; nunca menciona “planta” a un hotel, “propiedad” a una mina ni “factura CFE” a un sitio aislado sin red.

---

## 22. Analítica del embudo

### 22.1 Eventos

- dx_hub_viewed.
- dx_diagnostic_selected.
- dx_profile_interest_submitted.
- dx_viewed.
- dx_started.
- dx_profile_selected.
- dx_step_viewed.
- dx_step_answered.
- dx_back_used.
- dx_resumed.
- dx_result_viewed.
- dx_result_configuration.
- dx_cta_selected.
- dx_contact_submitted.
- dx_contact_success.
- dx_contact_error.
- dx_enrichment_started.
- dx_enrichment_skipped.
- dx_enrichment_completed.
- dx_calendar_opened.
- dx_booking_success.

### 22.2 Propiedades comunes

- session_id anónimo.
- profile_id y version.
- route y origin.
- campaign/UTM cuando existan.
- step_key.
- elapsed_seconds.
- recommended_configuration.
- fit, opportunity_size y confidence.
- enrichment_module.

### 22.3 Privacidad analítica

No se envían a analítica:

- Nombre, correo, teléfono o empresa.
- Dirección o coordenadas.
- Archivos o nombres de archivos.
- Texto libre.
- Datos técnicos detallados que puedan identificar una instalación.

### 22.4 Tablero mínimo

- Visitas al hub → selección de diagnóstico.
- Selección por perfil y porcentaje de “No sé cuál elegir”.
- Interés registrado en perfiles todavía no publicados.
- Visitas → inicios.
- Inicio → resultado.
- Abandono por pregunta.
- Resultado → contacto.
- Contacto → enriquecimiento.
- Contacto → calendario abierto.
- Calendario abierto → reserva.
- Conversión y configuración por perfil, ruta y campaña.

---

## 23. Accesibilidad y experiencia

- Navegación completa por teclado.
- Roles correctos para radio, checkbox y grupos.
- Estado de selección anunciado.
- Foco al encabezado en cada cambio de paso.
- Mensajes de error asociados al campo.
- Estados asíncronos anunciados mediante live regions.
- Contraste WCAG AA.
- Objetivos táctiles mínimos de 44 × 44 px.
- Soporte para 200% de zoom.
- Respeto a prefers-reduced-motion.
- El botón principal permanece accesible sin cubrir opciones.
- El calendario no debe ser la única forma de contacto.

---

## 24. Seguridad y privacidad

- Recibos y documentos permanecen en almacenamiento privado.
- URLs firmadas expiran.
- Tipos, extensiones, tamaño y cantidad se validan en cliente y servidor.
- La llave de Google Maps se restringe por referrer.
- Se aplica rate limiting durable a envíos de correo y firmas de upload.
- El aviso de privacidad es visible antes de contacto, ubicación o archivos.
- La política de retención de documentos debe definirse antes del lanzamiento de perfiles nuevos.
- El prospecto recibe una explicación clara del uso de sus datos.

---

## 25. Plan de implementación por etapas

### Resumen de secuencia

| Etapa | Alcance principal | Dependencia |
|---|---|---|
| 0 | Estabilizar General y Hoteles | Ninguna |
| 1 | Crear plataforma común y migrar General + Hoteles | Etapa 0 |
| 2 | Publicar Electromovilidad | Etapa 1 |
| 3 | Publicar Cadena de frío | Etapa 1; puede avanzar en paralelo con Etapa 2 cuando el core sea estable |
| 4 | Publicar Microredes y sitios remotos | Etapa 1 y validación de reglas de diésel |
| 5 | Publicar Bombeo de agua | Etapa 1 y validación hidráulica |
| 6 | Publicar Centros de datos | Etapa 1 y aprobación de ingeniería de misión crítica |
| 7 | Optimizar con datos de conversión y proyectos reales | Perfiles publicados con volumen suficiente |

Las etapas 2 a 5 comparten plataforma y pueden solaparse parcialmente, pero cada perfil debe superar sus propios criterios de salida antes de publicarse. Centros de datos permanece deliberadamente al final por su mayor exigencia técnica y reputacional.

### Etapa 0 — Estabilización inmediata

**Objetivo:** eliminar pérdida de leads y errores bloqueantes antes de ampliar el producto.

Entregables:

- Corregir resultado de hoteles.
- Alinear validación de nombre, empresa y correo entre cliente y servidor.
- Esperar respuesta real antes de mostrar éxito.
- Registrar contacto al abrir calendario.
- Evitar perfiles indefinidos en modo rápido.
- Añadir prueba E2E general y hotelera.
- Instrumentar errores de runtime.

**Criterio de salida:** ambos diagnósticos completan resultado, correo y agenda sin errores; no existe confirmación falsa.

### Etapa 1 — Plataforma común y migración de General + Hoteles

**Objetivo:** construir la arquitectura de perfiles y demostrarla con las dos experiencias existentes.

Entregables:

- Contenido base y contrato de perfil.
- Landing de selección en /diagnostico construida desde configuración.
- Nueva ruta /diagnostico-industria-comercio con la experiencia general.
- Conservación de UTM y origen entre el hub y la ruta elegida.
- Actualización de enlaces y metadatos que actualmente apuntan al diagnóstico general.
- Configuración hotelera como override, no copia completa.
- Preguntas adaptativas.
- Nuevo resultado de cuatro bloques.
- Separación de encaje, tamaño y confianza.
- Checkpoint de contacto antes del enriquecimiento.
- Enriquecimiento condicional.
- Persistencia y analítica completa.
- Correos con vocabulario por perfil.

**Criterio de salida:** /diagnostico permite seleccionar una experiencia publicada; /diagnostico-industria-comercio y Hoteles usan el mismo core, no duplican bloques completos y conservan las conclusiones aprobadas.

### Etapa 2 — Electromovilidad

**Objetivo:** publicar la primera vertical nueva con preguntas sustancialmente diferentes.

Entregables:

- Perfil, scoring y copy.
- Módulo de cargadores y flota.
- Recomendación “gestión de carga primero”.
- Enriquecimiento de potencia, ventanas y capacidad CFE.
- Evento de agenda propio.
- Fixtures de flotilla, carga pública y transporte pesado.

**Criterio de salida:** el sistema distingue gestión de carga, diferimiento, peak shaving y BESS + Solar sin forzar almacenamiento.

### Etapa 3 — Cadena de frío, alimentos y bebidas

**Objetivo:** atender cargas térmicas críticas con lenguaje y datos propios.

Entregables:

- Perfil y subtipos.
- Preguntas de refrigeración, deshielo, continuidad y estacionalidad.
- Módulo de datos de refrigeración.
- Resultados separados para eficiencia, costo y respaldo.
- Fixtures de almacén refrigerado, CEDIS y planta alimentaria.

**Criterio de salida:** el sistema puede recomendar eficiencia de refrigeración antes que BESS y separar ahorro tarifario de pérdida de producto.

### Etapa 4 — Microredes y sitios remotos

**Objetivo:** calificar proyectos donde combustible, autonomía y red débil pesan más que la factura.

Entregables:

- Perfil remoto.
- Preguntas y cálculos de diésel.
- Módulo de autonomía y cargas críticas.
- Resultado híbrido Solar + BESS + generador.
- Fixtures de mina, agroindustria y sitio sin red.

**Criterio de salida:** ningún resultado aislado depende de una factura CFE inexistente y no se promete eliminar el generador sin simulación.

### Etapa 5 — Bombeo de agua

**Objetivo:** distinguir optimización hidráulica, traslado operativo, Solar y BESS.

Entregables:

- Perfil de bombeo.
- Preguntas de bombas, caudal, horarios, niveles y tanques.
- Recomendación de eficiencia o programación antes que almacenamiento.
- Adaptación para comprador público y privado.
- Fixtures de pozo, rebombeo, tratamiento y riego.

**Criterio de salida:** el motor detecta cuándo el almacenamiento hidráulico o la operación programada resuelven el problema sin batería.

### Etapa 6 — Centros de datos

**Objetivo:** publicar una experiencia de misión crítica validada por ingeniería.

Entregables:

- Revisión técnica formal de preguntas, reglas y copy.
- Perfil de centros de datos.
- Módulo de UPS, redundancia, generadores y expansión.
- Confianza forzada a preliminar sin unifilar y arquitectura.
- Fixtures enterprise, colocation, edge y expansión.
- Revisión de seguridad, continuidad y promesas comerciales.

**Criterio de salida:** aprobación escrita de ingeniería especializada y ausencia de recomendaciones que contradigan redundancia o arquitectura de misión crítica.

### Etapa 7 — Optimización comercial

**Objetivo:** utilizar datos reales para decidir nuevas capas, simplificaciones y campañas.

Entregables:

- Tablero de conversión por perfil.
- Análisis de abandono por pregunta.
- Experimentos de CTA y longitud.
- Revisión trimestral de reglas contra proyectos reales.
- Decisión sobre perfiles adicionales.

---

## 26. Pruebas

### 26.1 Unitarias

- Motor común.
- Reglas, boosts y caps por arquetipo.
- Normalización de respuestas.
- Cálculos de rango.
- Selección de módulos de enriquecimiento.
- Scoring de encaje, tamaño y confianza.
- Migración de payload legado.

### 26.2 Contrato de perfil

- Campos requeridos.
- Opciones y códigos únicos.
- Cobertura de copy.
- Vocabulario correcto.
- Reglas que referencian opciones existentes.
- Resultados y emails sin valores indefinidos.

### 26.3 Exhaustivas

Para perfiles con espacio combinatorio razonable:

- Ninguna recomendación contradictoria.
- Scores dentro de rango.
- Caps respetados.
- Datos faltantes coherentes.
- Ausencia de rangos económicos sin base.

### 26.4 Extremo a extremo

Al menos un recorrido completo por ruta:

- Hub → selección de cada diagnóstico disponible.
- Hub → “No sé cuál elegir” → ruta recomendada.
- Hub → perfil Próximamente → registro de interés.
- Conservación de UTM y origen después de seleccionar una ruta.
- Inicio → resultado.
- Resultado → correo.
- Resultado → enriquecimiento → contacto.
- Resultado → agenda abierta → reserva.
- Error de API y reintento.
- Atrás, recarga y reanudación.
- Mobile y teclado.

### 26.5 Fixtures mínimos por perfil

- General: Solar, peak shaving, capacidad, respaldo y evidencia insuficiente.
- Hoteles: all-inclusive, boutique y expansión.
- Electromovilidad: flotilla nocturna, carga rápida restringida y carga pública.
- Cadena de frío: almacén 24/7, picos de compresor y alto costo de interrupción.
- Microred: diésel dominante, red débil y sitio aislado.
- Bombeo: operación desplazable, sin tanque y equipo ineficiente.
- Centros de datos: expansión, respaldo y datos insuficientes.

---

## 27. Criterios de aceptación globales

1. Todas las rutas publicadas completan el flujo sin errores de JavaScript.
2. /diagnostico muestra el hub y no inicia automáticamente Industria y comercio.
3. /diagnostico-industria-comercio abre directamente el diagnóstico general.
4. Los parámetros de campaña se conservan al pasar del hub a un diagnóstico.
5. Los perfiles no publicados no llevan a recorridos incompletos.
6. Un cambio en contenido común se refleja en todos los perfiles sin copiar archivos completos.
7. Cada perfil declara únicamente overrides y reglas propias.
8. Ningún usuario responde más de nueve preguntas antes del resultado.
9. El resultado aparece antes de solicitar documentos.
10. El contacto puede capturarse inmediatamente después del resultado.
11. Techo solo se solicita cuando Solar forma parte de la ruta recomendada.
12. Recibos solo se solicitan cuando aportan al cálculo o anteproyecto.
13. El lead se registra al abrir calendario y se actualiza al reservar.
14. La interfaz nunca muestra éxito ante una respuesta fallida.
15. El sistema conserva progreso no sensible ante una interrupción.
16. Encaje, tamaño y confianza se calculan y presentan por separado.
17. Los rangos muestran supuestos y no se usan para continuidad, capacidad o diésel sin datos propios.
18. Los correos utilizan el vocabulario correcto del perfil.
19. Analítica no contiene información personal ni documentos.
20. Cada perfil cuenta con prueba de contrato, fixtures y un recorrido E2E.

---

## 28. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Scoring basado en supuestos no validados | Revisión con ingeniería y comparación trimestral contra proyectos reales |
| Demasiadas ramas difíciles de mantener | Arquetipos reutilizables, contrato declarativo y límite de preguntas |
| Copy especializado se desactualiza | Base común, tokens de vocabulario y pruebas de contaminación entre perfiles |
| Mayor conversión pero leads de baja calidad | Separar contacto, intención y enriquecimiento; medir booking y avance real |
| Prospectos interpretan el resultado como propuesta | Disclaimer visible, confianza y dato faltante explícitos |
| Solicitud de documentos genera desconfianza | Valor primero, privacidad visible, módulos opcionales y NDA cuando corresponda |
| Perfil de centros de datos reduce credibilidad | Lanzamiento condicionado a validación técnica y comercial |
| Integración de calendario pierde actualizaciones | Upsert por lead_id y webhook servidor como fuente final de reserva |

---

## 29. Decisiones pendientes

Antes de iniciar cada etapa se debe cerrar:

1. Destino definitivo de leads: correo, CRM o ambos.
2. Proveedor y esquema de analítica.
3. Política de retención y eliminación de recibos y documentos.
4. Requisitos exactos de nombre, empresa y correo por CTA.
5. Eventos de Cal para cada perfil.
6. Responsable técnico que aprobará reglas de cada vertical.
7. Rangos y unidades que ventas utiliza actualmente para calificar proyectos.
8. Nombres comerciales finales de rutas y perfiles.
9. Si el diagnóstico general redirige visualmente al perfil o permanece en la misma URL.
10. Qué datos del resultado deben persistirse en un CRM y cuáles solo en el correo técnico.

---

## 30. Referencias de contexto

- CONUEE — Catálogo de medidas de eficiencia energética para la industria de alimentos y bebidas: https://www.conuee.gob.mx/transparencia/boletines/manuales/Catalogo_EE_Alimentos_Bebidas_Mexico_Conuee_02-03-2021.pdf
- Instituto Mexicano del Transporte — Infraestructura de recarga para vehículos eléctricos pesados: https://www.gob.mx/imt/articulos/infraestructura-de-recarga-para-vehiculos-electricos-pesados
- CONUEE — Consumo energético del suministro de agua potable: https://www.gob.mx/conuee/acciones-y-programas/consumo-energetico-del-suministro-de-agua-potable-sistemas-de-agua-potable-bombeo-de-agua-potable-municipal-estados-y-municipios

Estas referencias justifican la existencia de perfiles distintos; no sustituyen la validación de reglas y supuestos con especialistas y proyectos reales de Mexillum.
