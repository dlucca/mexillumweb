# Paso 3 «Operación»: cuestionario de opción múltiple por perfil

Fecha: 2026-09-15
Estado: aprobado para plan de implementación

## Problema

El paso 3 del expediente pide **16 campos**, de los cuales **6 son de texto libre**. Las
cajas de texto llegan vacías o con una línea inútil, así que el asesor termina preguntando
todo por teléfono de cualquier manera.

Además el cuestionario no distingue al cliente:

- `industry`, `commerce` y `other` comparten el mismo contenido (`diagnostico.content.js`),
  así que reciben preguntas idénticas.
- Hotel no pregunta **ocupación**, que es su variable dominante.
- Centro de datos no pregunta **redundancia** (N, N+1, 2N).
- La causa raíz: `createProfileContent` admite **una sola** pregunta propia por perfil
  (`definition.propia`, `js/diagnostico.profile.js:118`). No hay dónde poner más.

Y hay preguntas redundantes: la caja «días, horarios y temporadas», el select «actividad
habitual» y los 4 campos numéricos piden lo mismo tres veces.

## Objetivo

El paso 3 queda **100 % de opción múltiple**, específico por tipo de cliente, sin ningún
campo donde el usuario escriba. Longitud: **8 preguntas comunes + 6 o 7 del perfil**.

## Fuera de alcance

- El diagnóstico público (`/diagnostico-*`) y su motor de puntaje: no se tocan.
- Los pasos 1, 2, 4 y 5 del expediente.
- Los campos numéricos del resumen por servicio (`js/expediente.simulation-view.js:17`),
  donde el asesor ajusta a mano. Se quedan como están.
- **Enlaces con permiso por paso**: es un segundo proyecto, con su propio spec. Ver
  «Proyecto siguiente» al final.

## Decisiones tomadas

| Decisión | Elegido | Razón |
|---|---|---|
| ¿Cambiar también el diagnóstico público? | Sí, la fuente compartida | Una sola definición por perfil |
| ¿Las preguntas nuevas salen en el diagnóstico público? | No, solo en el paso 3 | El público es el gancho: su trabajo es que la persona llegue al resultado |
| Longitud del paso 3 | 10-12 objetivo, 14-15 real | Solo lo que mueve la recomendación; el resto lo pregunta el asesor |
| Maquetación | Un `<form>` con 4 secciones plegables | Conserva la arquitectura de un `collect()`; riesgo bajo |

## Arquitectura

### Dónde vive cada pregunta

| Archivo | Contenido |
|---|---|
| `js/diagnostico.profile.js` | La fábrica acepta `profundas: []` y las publica en `content.profundas`, **fuera de `pasos`** |
| `js/diagnostico.hoteles.content.js` | `profundas` de hotel |
| `js/diagnostico.cadena-frio.content.js` | `profundas` de cadena de frío |
| `js/diagnostico.bombeo.content.js` | `profundas` de bombeo |
| `js/diagnostico.electromovilidad.content.js` | `profundas` de carga de vehículos |
| `js/diagnostico.centros-datos.content.js` | `profundas` de centro de datos |
| `js/diagnostico.microred.content.js` | `profundas` de sitio remoto |
| `js/expediente.operation.js` **(nuevo)** | Las 8 preguntas comunes, las 7 condicionales, el mapeo opción → número, y las `profundas` de `industry`, `commerce`, `other` y `university` |
| `js/expediente.installations.js` | Solo compone: `legacy(content) + profundas`. Se elimina el ayudante `text()` |
| `js/expediente.app.js` | El paso 3 se arma en 4 secciones. Se eliminan `operationInputs()`, `scheduleField()` y los `textarea()` del paso 3 |
| `lib/onboarding/store.js` | `sanitizeAnswers` valida contra la lista de opciones y **deduce** los números |

`profundas` va fuera de `pasos` por una razón concreta: el motor recorre `content.pasos`
(`js/diagnostico.engine.js:81`) y el flujo público dibuja esa misma lista. Dejarlas fuera
significa cero riesgo para el embudo público y cero cambios en el motor.

**Por qué `industry`, `commerce`, `other` y `university` no van en un archivo de contenido:**
los tres primeros leen el mismo `diagnostico.content.js`; poner sus `profundas` ahí les daría
preguntas idénticas, que es el problema original. `university` no tiene diagnóstico público
(`js/diagnostico.universidades.view.js` va directo al expediente), así que no tiene archivo
de contenido donde ponerlas.

### Forma de una pregunta

```js
{ key, label, type: 'select' | 'multi', options: [{value, label}], when?, exclusive? }
```

`type: 'text'` **deja de existir**. Una prueba lo garantiza (ver «Pruebas», nº 1).

Toda pregunta termina con la opción `nolose` («No lo sé»), como hoy. `multi` puede declarar
opciones exclusivas (`ninguna`, `nolose`) que al marcarse desmarcan el resto; esa lógica ya
existe en `js/expediente.app.js:214`.

## Contenido: las 8 preguntas comunes

Siempre visibles, en este orden.

| # | `key` | Pregunta | Opciones (`value` → label) |
|---|---|---|---|
| 1 | `sector` | Tipo de instalación | los 10 perfiles (sin cambio) |
| 2 | `objective` | ¿Qué quieres mejorar? *(multi)* | `cost` reducir el costo · `continuity` evitar interrupciones · `growth` ampliar capacidad · `unknown` quiero orientación |
| 3 | `days` | ¿Qué días opera? | `lv` lunes a viernes · `ls` lunes a sábado · `todos` los 7 días · `nolose` no lo sé |
| 4 | `hours` | ¿Cuándo hay actividad? | `matutino` un turno de mañana, 7 a 16 h · `extendido` horario extendido, 8 a 20 h · `dos_turnos` dos turnos, 6 a 22 h · `continuo` 24 horas · `nocturno` sobre todo de noche · `nolose` no lo sé |
| 5 | `off` | ¿Cuánto baja el consumo fuera de ese horario? | `apaga` casi todo se apaga · `basico` queda lo básico · `mitad` baja a la mitad · `poco` baja poco · `igual` igual que en horario · `nolose` no lo sé |
| 6 | `equipment` | ¿Qué equipos tienen hoy? *(multi)* | `solar` · `battery` · `generator` · `ups` · `none` ninguno *(exclusiva)* · `unknown` no lo sé *(exclusiva)* |
| 7 | `scope` | ¿Este medidor abastece toda la instalación? | `todo` sí, toda · `parte` solo una parte, hay otros medidores · `nolose` no lo sé |
| 8 | `power` | ¿Han tenido problemas de energía este año? *(multi)* | `apagones` apagones que detienen la operación · `micro` microcortes o parpadeos · `voltaje` variaciones de voltaje o equipos dañados · `ninguno` ninguno *(exclusiva)* · `nolose` no lo sé *(exclusiva)* |

`days`, `hours`, `off` y `power` son nuevas. `power` sustituye la caja de texto `quality`.

### Las 7 condicionales

| `key` | Aparece cuando | Pregunta | Opciones |
|---|---|---|---|
| `powerFreq` | `power` tiene algo distinto de `ninguno`/`nolose` | ¿Cada cuándo? | `semanal` varias veces al mes · `mensual` una vez al mes · `algunas` algunas veces al año · `raro` una o dos al año · `nolose` |
| `manualTariff` | `requiredQuestions` lo pide | Tarifa o suministro | igual que hoy |
| `manualBill` | `requiredQuestions` lo pide | Pago mensual | `sharedOptions.bill` de `js/diagnostico.profile.js:171` |
| `backupTime` | `objective` incluye `continuity` | ¿Cuánto debe aguantar sin red? | `minutos` 15 min · `corto` 1 a 2 h · `medio` 4 a 8 h · `largo` más de 8 h · `nolose` |
| `growthSize` | `objective` incluye `growth` | ¿Cuánta capacidad nueva en 12 meses? | `poco` menos de 10 % · `medio` 10-25 % · `alto` 25-50 % · `muyalto` más de 50 % · `nolose` |
| `solarSize` | `equipment` incluye `solar` | ¿De qué tamaño es el solar? | `chico` menos de 50 kWp · `medio` 50-250 · `grande` 250-1000 · `muygrande` más de 1000 · `nolose` |
| `solarExport` | `equipment` incluye `solar` | ¿Qué pasa con los excedentes? | `inyecta` se inyectan a CFE · `consume` se consumen en sitio · `nolose` |

`backupTime` sustituye la caja `outage`. `growthSize` sustituye `growth`. `solarSize` y
`solarExport` sustituyen `solar`. `manualBill` pasa de campo numérico a rangos.

## Contenido: las `profundas` por perfil

Todas son nuevas. Las que ya existen (`subtype`, `perfil`, `corte`, `condiciones`, y la
`propia` de cada perfil) se conservan sin cambio.

### `industry` — Industria y manufactura
Sustituye `processLoads`.

| `key` | Pregunta | Opciones |
|---|---|---|
| `cargas` *(multi)* | ¿Qué concentra el consumo? | `motores` motores y bombas · `aire` compresores de aire · `hornos` hornos o fundición · `frio` frío de proceso · `clima` climatización · `luz` iluminación · `nolose` |
| `flexibilidad` | ¿Se puede mover algún proceso a otro horario? | `varios` sí, varios · `alguno` sí, uno o dos · `no` no, el proceso es continuo · `nolose` |
| `arranques` | ¿Cómo arrancan los motores grandes? | `directo` arranque directo, se siente el golpe · `suave` con arrancador suave o variador · `sinmotores` no hay motores grandes · `nolose` |

### `commerce` — Comercio y oficinas
Sustituye `majorLoads`.

| `key` | Pregunta | Opciones |
|---|---|---|
| `cargas` *(multi)* | ¿Qué concentra el consumo? | `clima` climatización · `frio` refrigeración comercial · `cocina` cocinas · `elevadores` elevadores · `luz` iluminación de sala · `servidores` servidores · `nolose` |
| `horarioLocales` | ¿Hay locales o áreas con horario propio? | `varios` sí, varios · `no` no, todo igual · `nolose` |
| `climatizacion` | ¿Cómo se enfría el inmueble? | `chillers` chillers centrales · `splits` minisplits o paquetes · `mixto` mixto · `nolose` |

### `hotel` — Hotel
Sustituye `hotelLoads` y tapa el hueco de ocupación.

| `key` | Pregunta | Opciones |
|---|---|---|
| `ocupacion` | ¿Ocupación promedio al año? | `baja` menos de 40 % · `media` 40-60 % · `alta` 60-80 % · `muyalta` más de 80 % · `nolose` |
| `temporada` | ¿Cómo cambia entre temporada alta y baja? | `marcada` muy marcada, se vacía · `moderada` moderada · `parejo` casi parejo · `nolose` |
| `amenidades` *(multi)* | ¿Qué amenidades tiene? | `alberca` alberca climatizada · `spa` spa o gimnasio · `lavanderia` lavandería propia · `restaurante` restaurantes · `eventos` salones de eventos · `clima` climatización central · `nolose` |

### `cold` — Cadena de frío
Sustituye `thermalMargin`.

| `key` | Pregunta | Opciones |
|---|---|---|
| `margen` | ¿Cuánto aguanta el producto sin frío? | `minutos` menos de 30 min · `corto` 1 a 2 h · `medio` 4 a 8 h · `largo` más de 8 h · `nolose` |
| `temperatura` | ¿A qué temperatura trabajan? | `congelado` congelado, −18 °C o menos · `refrigerado` refrigerado, 0 a 8 °C · `ambas` las dos · `nolose` |

### `pumping` — Bombeo
Sustituye `pumpDetails`.

| `key` | Pregunta | Opciones |
|---|---|---|
| `potencia` | ¿Qué potencia tiene la bomba más grande? | `chica` menos de 20 HP · `media` 20-75 HP · `grande` 75-250 HP · `muygrande` más de 250 HP · `nolose` |
| `variadores` | ¿Tienen variadores de frecuencia? | `todas` sí, en todas · `algunas` en algunas · `no` no · `nolose` |

### `charging` — Carga de vehículos
Sustituye `chargers`.

| `key` | Pregunta | Opciones |
|---|---|---|
| `cargadores` | ¿Cuántos cargadores tienen o planean? | `pocos` 1 a 3 · `medios` 4 a 10 · `muchos` 11 a 30 · `flota` más de 30 · `nolose` |
| `potenciaCargador` | ¿De qué potencia por cargador? | `lento` hasta 7 kW · `semi` 11 a 22 kW · `rapido` 50 a 150 kW · `ultra` más de 150 kW · `mezcla` mezcla · `nolose` |
| `ventana` | ¿Cuánto tiempo están conectados los vehículos? | `corta` menos de 1 h · `media` 2 a 4 h · `noche` toda la noche · `dia` todo el día · `nolose` |

### `data_center` — Centro de datos
Sustituye `backupArchitecture` y `criticalPower`, y tapa el hueco de redundancia.

| `key` | Pregunta | Opciones |
|---|---|---|
| `cargaCritica` | ¿Qué carga crítica tiene? | `chica` menos de 100 kW · `media` 100-500 kW · `grande` 500 kW a 2 MW · `muygrande` más de 2 MW · `nolose` |
| `redundancia` | ¿Qué redundancia tiene hoy? | `n` N, sin redundancia · `n1` N+1 · `2n` 2N · `nolose` |
| `autonomiaActual` | ¿Cuánta autonomía dan UPS y planta? | `ups` solo minutos de UPS · `planta8` UPS + planta para 8 h · `planta24` planta para más de 24 h · `nolose` |

### `remote` — Sitio remoto
Sustituye `energyUse` y `fuel`. **No** sustituye `autonomy`: la pregunta propia `fuente`
ya cubre las horas sin la fuente principal, y duplicarla confundiría.

| `key` | Pregunta | Opciones |
|---|---|---|
| `consumoDia` | ¿Cuánta energía usa al día? | `chico` menos de 20 kWh · `medio` 20-100 kWh · `grande` 100-500 kWh · `muygrande` más de 500 kWh · `nolose` |
| `diesel` | ¿Cuánto diésel consume al mes? | `ninguno` no usamos combustible · `poco` menos de 500 L · `medio` 500-2000 L · `mucho` más de 2000 L · `nolose` |

### `university` — Universidad
Sustituye `afterhours` y `criticalDetail`.

| `key` | Pregunta | Opciones |
|---|---|---|
| `afterhours` *(multi)* | ¿Qué queda encendido de noche y en fin de semana? | `residencias` · `servidores` · `labfrio` refrigeradores de laboratorio · `bibliotecas` · `seguridad` seguridad e iluminación · `bombeo` · `nada` nada, todo se apaga *(exclusiva)* · `nolose` *(exclusiva)* |
| `respaldoTiempo` | ¿Cuánto deben aguantar las cargas críticas? *(solo si `criticalLoads` tiene algo distinto de `ninguna`/`nolose`)* | `minutos` minutos, solo para apagar bien · `corto` 1 a 4 h · `medio` 8 a 24 h · `largo` más de 24 h · `nolose` |

`afterhours` conserva su `key` pero cambia de `text` a `multi`. `respaldoTiempo` hereda la
condición `when: 'criticalLoads'` que hoy tiene `criticalDetail`, para no preguntar el tiempo
de respaldo a quien declaró que no tiene cargas críticas.

### `other` — Otro
Sustituye `description`.

| `key` | Pregunta | Opciones |
|---|---|---|
| `cargas` *(multi)* | ¿Qué concentra el consumo? | `motores` motores o bombas · `clima` climatización · `frio` refrigeración · `hornos` hornos o calentamiento · `luz` iluminación · `servidores` servidores · `nolose` |
| `flexibilidad` | ¿Se puede mover consumo a otro horario? | `mucho` sí, buena parte · `algo` algo · `no` no · `nolose` |

## Opción → número: quién calcula

Los 5 números de la simulación **dejan de ser respuesta del usuario**. En `answers` se guarda
solo el código de la opción; el **servidor** deriva los números dentro de `sanitizeAnswers`.
Una sola fuente de verdad, y un cuerpo de petición falsificado no puede inyectar números.

| Respuesta | Derivado |
|---|---|
| `days=lv` | `weekendPct=15` |
| `days=ls` | `weekendPct=55` |
| `days=todos` | `weekendPct=100` |
| `days=nolose` | *(se omite; el motor asume 100)* |
| `hours=matutino` | `loadShape=1, operationStart=7, operationEnd=16` |
| `hours=extendido` | `loadShape=1, operationStart=8, operationEnd=20` |
| `hours=dos_turnos` | `loadShape=1, operationStart=6, operationEnd=22` |
| `hours=continuo` | `loadShape=0, operationStart=8, operationEnd=18` |
| `hours=nocturno` | `loadShape=2, operationStart=6, operationEnd=20` |
| `hours=nolose` | *(se omite; `scheduleKnown` queda falso)* |
| `off=apaga` | `offHoursPct=10` |
| `off=basico` | `offHoursPct=25` |
| `off=mitad` | `offHoursPct=50` |
| `off=poco` | `offHoursPct=75` |
| `off=igual` | `offHoursPct=100` |
| `off=nolose` | *(se omite; el motor asume 50)* |

Invariantes que respeta el mapeo, tomados de `js/expediente.profile.js:18-26`:

- `loadShape` ∈ {0,1,2} entero. 0 = parejo (ignora la ventana), 1 = activo dentro de
  `[start, end)`, 2 = activo fuera de ella.
- Cuando `loadShape !== 0`, **`operationStart < operationEnd`**, o `periodProfile` devuelve
  `ready:false`. `nocturno` cumple con `start=6, end=20`: el motor invierte la ventana solo.
- `scheduleKnown` es `loadShape != null`. Con `hours=nolose` no se escribe `loadShape`, y la
  simulación revela «distribución uniforme, sin horario operativo confirmado».

Los límites de `sanitizeSimulation` (`js/expediente.simulation-settings.js:2`) se cumplen por
construcción: `operationStart` ∈ [0,23], `operationEnd` ∈ [1,24], `offHoursPct` y
`weekendPct` ∈ [1,100].

## Validación en el servidor

`sanitizeAnswers` (`lib/onboarding/store.js:48`) cambia así:

- Se elimina `clean(a[k],1000)` para `schedule`, `outage`, `growth`, `solar` y `quality`.
  Esas llaves dejan de existir.
- Cada respuesta de opción se acepta **solo** si su código está en la lista de opciones de
  esa pregunta; si no, se descarta. Es la regla que ya aplica `sanitizeInstallations`
  (`js/expediente.installations.js:61`), extendida a las comunes.
- `manualTariff` pasa a validarse contra su lista. Hoy es texto libre.
- `scope` pasa de guardar la frase completa («Sí, toda la instalación») a guardar un código
  (`todo`/`parte`/`nolose`). Ningún cálculo compara esa cadena hoy, así que el cambio es
  seguro; lo único que la leía para mostrarla es el correo, que ahora usa
  `operationSummary`.
- `loadShape`, `operationStart`, `operationEnd`, `offHoursPct` y `weekendPct` **ya no se leen
  del cuerpo**: se derivan de `days`, `hours` y `off`.
- `sanitizeInstallations` pierde la rama `q.type==='text'`.

Efecto secundario deseado: hoy el servidor acepta 1000 caracteres arbitrarios en 5 campos.
Después de esto, la única entrada de texto libre que queda en el expediente es el contacto
(nombre, correo, empresa), que ya está acotado.

## Consumidores que hay que actualizar

Encontrados al revisar el spec. Ninguno es opcional.

### `requiredQuestions` pierde `schedule`

`js/expediente.model.js:124` arranca con `['sector','objective','schedule','equipment','scope']`.
La llave `schedule` desaparece. La lista pasa a
`['sector','objective','days','hours','off','equipment','scope','power']`.

Las condicionales `outage`, `growth` y `solar` se renombran a `backupTime`, `growthSize` y
`solarSize` + `solarExport`. `powerFreq` se agrega cuando `power` trae algo distinto de
`ninguno`/`nolose`.

Pruebas que dependen de esta lista y hay que actualizar: `test/expediente.model.test.js:23`
y `test/expediente.integral.test.js:35`.

### El correo al asesor dejaría de ser legible

`api/expediente.js:82` manda la operación así:

```js
`Operación: ${JSON.stringify({...d.answers,installations:undefined})}`
```

Hoy eso es medio legible porque `schedule` y `quality` son texto humano. Con códigos, el
asesor recibiría `{"scope":"parte","hours":"dos_turnos"}`, que no se puede leer.

**Se agrega `operationSummary(answers)`** en `js/expediente.operation.js`, que devuelve
`[{label, value}]` con las etiquetas visibles de las preguntas comunes y condicionales
contestadas — exactamente lo que `installationSummary` ya hace con las del perfil
(`js/expediente.installations.js:65`). El correo usa esa lista en lugar del `JSON.stringify`.

El resumen en pantalla (`js/expediente.app.js:264`) y el PDF también la usan, así que la
traducción de código a etiqueta vive en un solo lugar.

### Una frase del método queda falsa

`js/expediente.simulation-view.js:45` dice: «El texto libre de operación es información para
el asesor; no se interpreta como medición». Ya no habrá texto libre de operación. Se
reemplaza por una frase que diga que las respuestas de operación son rangos declarados, no
medición.

### El formulario del asesor

`js/expediente.advisor.js:8` manda `answers.schedule` como texto libre. Ese campo se
**elimina** del formulario de `/asesor/`: el horario lo contesta el cliente en el paso 3, con
las preguntas 3, 4 y 5. El asesor sigue precargando `sector`, `objective`, contacto, sitio y
dirección.

## Maquetación

Un `<form>` con 4 secciones (`<details>` con `<summary>`, el patrón que ya usa
`.exp-dossier` en `css/expediente-summary.css:40`):

1. **Tu operación** — preguntas 3, 4, 5
2. **Qué buscas** — preguntas 2, 6, 7, 8 y `powerFreq`
3. **Nombre del perfil** — `subtype`, `perfil`, `propia`, las `profundas`, `corte`, `condiciones`
4. **Datos extra** — solo si hay condicionales activas: tarifa, pago, `backupTime`, `growthSize`, `solarSize`, `solarExport`

La pregunta 1 (tipo de instalación) va arriba, fuera de las secciones: cambiarla redibuja
la sección 3.

Cada `<summary>` muestra «n de m contestadas». Las opciones usan `.exp-choices`, que ya da
tarjetas de 48 px de alto y una columna en móvil (`css/expediente.css:1`).

Se conserva el modelo actual: un solo `collect()`, respuestas separadas por perfil
(`answers.installations[id]`), y cambiar de perfil nunca reetiqueta respuestas previas.

## Pruebas

### Se actualizan

- `test/expediente.installations.test.js:9` — el mapa `expected` espera llaves de texto
  (`processLoads`, `majorLoads`, `hotelLoads`, `backupArchitecture`, `description`). Se
  reemplazan por las nuevas.
- `test/expediente.installations.test.js:15,27,34` — usan `criticalDetail` y `afterhours`
  como texto.
- `scripts/check-expediente-ui.mjs:21,25,26` — llena `[name=schedule]`, `afterhours` y
  `criticalDetail` con `fill()`. Pasan a `selectOption` y `check`.

### Se agregan

1. **Ningún campo de texto.** Recorre los 10 perfiles más las comunes y las condicionales;
   falla si alguna pregunta tiene `type` distinto de `select` o `multi`. Es la prueba que
   evita que el texto libre regrese.
2. **Opción → número.** Para cada valor de `days`, `hours` y `off`, el número derivado es el
   de la tabla, cae dentro de los límites de `sanitizeSimulation`, y cumple
   `operationStart < operationEnd` cuando `loadShape !== 0`. Incluye `nolose`: no escribe
   nada y `scheduleKnown` queda falso.
3. **El servidor rechaza lo falsificado.** `sanitizeAnswers` descarta códigos inventados,
   ignora `loadShape`/`operationStart`/`offHoursPct` enviados crudos en el cuerpo, y no deja
   pasar texto en las llaves eliminadas.
4. **Las 4 secciones.** Se dibujan; la sección 4 no aparece si no hay condicionales; marcar
   `objective=continuity` la hace aparecer con `backupTime`; desmarcar la esconde sin borrar
   la respuesta guardada.
5. **El correo lleva etiquetas, no códigos.** `operationSummary` devuelve la etiqueta
   visible de cada respuesta contestada, omite las no contestadas, y el cuerpo del correo
   no contiene ningún código interno (`dos_turnos`, `parte`, `nolose`).
6. **Cada perfil tiene preguntas distintas.** `industry`, `commerce` y `other` ya no
   comparten el mismo conjunto de llaves, que es el defecto que originó este trabajo.

## Caché

El JS se sirve con `?v=20260912-11`, en **29 apariciones** (`js/*.js`). Sin subir la versión,
un cliente con caché sigue recibiendo el paso 3 viejo. Se sube a `?v=20260915-1` en todas.

## Sin migración de datos

La base de Supabase del proyecto anterior se eliminó y `prospect_expedientes` se recreó
vacía el 2026-09-15 en el proyecto «Mexillum CRM» (`nukiwlaxxmghyzxwzant`). Hay **0
expedientes**. Ningún dato viejo con texto libre que convertir ni conservar.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Se pierde detalle que hoy captura el texto («3 chillers de 200 TR») | Decisión explícita: datos completos en rangos valen más que cajas vacías. El asesor pide el detalle en la llamada |
| El mapeo de horario rompe la simulación con `nocturno` | Prueba nº 2 fija los invariantes de `periodProfile`, incluido `start < end` |
| La sección 3 se redibuja al cambiar de perfil y pierde respuestas | El modelo actual ya guarda por perfil (`answers.installations[id]`); la prueba de cambio de perfil ya existe en `check-expediente-ui.mjs:28` |
| 14-15 preguntas se sienten largas | Secciones plegables con avance visible; todas de un toque |

## Proyecto siguiente: enlaces con permiso

Aprobado como proyecto aparte, **después** de este. Necesita su propio spec. Decisiones ya
tomadas y hallazgos que no se deben perder:

- **4 permisos más el completo**: `operacion`, `espacio`, `recibos`, `resumen` (solo
  lectura), `full`.
- **Cada enlace ve solo su parte.** El de espacio no debe ver importes de factura.
- **Solo el asesor crea enlaces**, desde `/asesor/`, con la clave de asesor.
- Hallazgos de la exploración:
  - El token es hoy una columna con restricción de único en `prospect_expedientes`
    (`lib/onboarding/store.js:44`). Varios tokens por expediente necesitan tabla aparte. Con
    0 filas, la migración es gratis ahora.
  - `requiredQuestions` depende de los recibos (`js/expediente.model.js:126`). El permiso
    `operacion` no puede ver importes pero necesita saber **si** existen tarifa e importe:
    se le mandan dos booleanos, no los valores.
  - El paso del mapa usa la dirección del recibo como respaldo
    (`js/expediente.app.js:239`). El permiso `espacio` necesita la dirección sola.
  - `write` rechaza el guardado si cambió la revisión (`lib/onboarding/store.js:36`). Con
    enlaces separados, dos personas guardando a la vez chocarán seguido. Se resuelve con el
    patrón que ya usa la lectura de archivos: leer de nuevo, mezclar solo los campos del
    permiso, reintentar (`api/expediente.js:161`).
  - `/asesor/` manda `answers.schedule` como texto libre
    (`js/expediente.advisor.js:8`). Ese campo desaparece con este spec; el formulario del
    asesor debe actualizarse aquí, no allá.
