# Motor de diagnóstico v4 — cuestionario adaptativo, frenos y salidas separadas

Fecha: 2026-09-06
Estado: aprobado en chat (3 secciones), pendiente de plan de implementación.

## Objetivo

Los siete perfiles del diagnóstico (industria y comercio, hoteles, electromovilidad,
bombeo, cadena de frío, microred, centros de datos) hoy comparten las mismas ocho
preguntas y las mismas conclusiones de BESS/Solar. Prometen cosas que el motor no
puede concluir ("gestionar la carga", "optimizar operación") porque no tienen el dato.

v4 cambia tres cosas, sobre la arquitectura actual (reglas como datos en `content`,
funciones puras en `engine`, `app.js` como única vista):

1. **Cuestionario:** 6 preguntas comunes + 1 propia del perfil + 1 condicional.
2. **Motor:** frenos ("primer paso" antes de BESS), cuatro salidas independientes,
   limitaciones y vocabulario por perfil hasta el correo.
3. **Después del resultado:** los pasos de mapa, facturas y datos se arman según el caso.

Decisiones ya tomadas por el usuario:

- Cuando BESS no es el primer paso, el diagnóstico lo dice y frena BESS. BESS queda
  como segundo paso visible, no oculto.
- Entran los 7 perfiles. Un solo motor.
- Máximo 8 preguntas, mínimo 7.

Fuera de alcance: nuevos perfiles (hospitales, campus, portafolios), accesibilidad del
mapa, migración de Google Maps, retención/escaneo de archivos.

---

## 1. Cuestionario

### 1.1 Contrato de pasos

`content.pasos` es un arreglo de 7 u 8 pasos. Cada paso tiene `key`, `pregunta`,
`opciones[]` y opcionalmente `multi`, `hint`, `notaLabel`, `rol` y `when`.

| Orden | key | rol | Común a todos | Notas |
|---|---|---|---|---|
| 1 | `sector` | `comun` | sí | Igual que hoy. |
| 2 | `disparador` | `comun` | sí | Multi. Se agrega la opción `continuidad` en todos los perfiles. Sube al 2º lugar. |
| 3 | `perfil` | `comun` | sí | Igual que hoy. |
| 4 | `generacion` | `comun` | sí | Igual que hoy. |
| 5 | `tarifa` | `comun` | sí | Microred usa opciones de suministro (ver 1.4). |
| 6 | `factura` | `comun` | sí | Microred pregunta gasto en energía + combustible (ya lo hace). |
| 7 | `propia` | `propia` | no | Una por perfil. Su `key` real es la del dato (p. ej. `calidad`, `gestion_carga`). |
| 8 | condicional | `condicional` | no | Opcional. Tiene `when` (regla del motor, mismo formato que `matchesWhen`). Solo se muestra si `when` matchea las respuestas previas. |

Reglas del contrato (las verifica `test/diagnostico.profiles.test.js`):

- Exactamente 6 pasos con `rol: 'comun'`, en ese orden y con esas keys.
- Exactamente 1 paso con `rol: 'propia'`.
- 0 o 1 paso con `rol: 'condicional'`, siempre el último, siempre con `when`.
- Ningún `key` repetido. Ningún `codigo` repetido dentro de un paso.
- Toda pregunta de opción única incluye una opción `nolose` (o equivalente marcado
  `esNoLoSe: true`) salvo `sector`.

### 1.2 Salen de las comunes

- `calidad` deja de ser común. Industria y hoteles la conservan como su pregunta
  propia, sin cambios de copy. Los demás perfiles la reemplazan por su propia.
- `corte` deja de ser común. Pasa a ser la condicional por defecto. Se muestra cuando
  `disparador` incluye `continuidad`, o cuando el perfil declara continuidad crítica
  (`content.continuidadCritica: true`, hoy: cadena de frío, centros de datos, microred).

### 1.3 Pregunta propia por perfil

| Perfil | key | Pregunta | Opciones (código: sentido) |
|---|---|---|---|
| industria_comercio | `calidad` | La de hoy. | Las de hoy. |
| hoteles | `calidad` | La de hoy. | Las de hoy. |
| electromovilidad | `gestion_carga` | ¿Puedes mover o escalonar la carga de los vehículos? | `sistema`: ya tenemos gestión de carga con software · `manual`: podríamos reprogramar pero no tenemos sistema · `fija`: las ventanas de carga no se pueden mover · `nolose` |
| bombeo | `hidraulica` | ¿Tienes tanque o almacenamiento de agua, y bombeas con horario? | `tanque_sin_horario`: hay tanque, bombeamos sin programar · `tanque_programado`: hay tanque y ya bombeamos en horario barato · `sin_tanque`: no hay almacenamiento · `nolose` |
| cadena_frio | `compresores` | ¿Cómo están tus compresores y su control? | `viejos_sin_control`: más de 15 años o sin control de capacidad · `modernos_con_control`: recientes, con variadores o control · `mixto` · `nolose` |
| microred | `fuente` | ¿Cuál es hoy tu fuente principal y cuántas horas necesitas operar sin ella? | `diesel_24h`: diésel todo el día · `diesel_parcial`: diésel algunas horas · `red_debil`: red con cortes frecuentes · `sin_energia`: hoy no hay suministro · `nolose` |
| centros_datos | `respaldo_actual` | ¿Qué respaldo tienes hoy? | `ups_gen`: UPS y generador probados · `ups`: solo UPS · `gen`: solo generador · `nada` · `nolose` |

El copy final de labels se escribe en cada `*.content.js`; esta tabla fija códigos y sentido.

### 1.4 Ajustes de comunes en microred

- `tarifa` → opciones: `cfe_gdmth`, `cfe_gdmto`, `cfe_gdbt`, `cfe_pdbt` (mapean a los
  códigos actuales `gdmth`, `gdmto`, `gdbt`, `pdbt` vía `normalizeResponses`), `diesel`
  (solo combustible), `mixto` (CFE + diésel), `sin_suministro`, `nolose`.
- El motor deriva `resp.conectado = true|false|null`: `true` si la tarifa es CFE o
  `mixto` o `privado`; `false` si `diesel` o `sin_suministro`; `null` si `nolose`.
  Los demás perfiles: `conectado = true` salvo `disparador` con `aislado`, que lo pone
  en `false`.

### 1.5 Condicional por perfil

| Perfil | Condicional | `when` |
|---|---|---|
| Por defecto | `corte` (la de hoy) | `disparador` incluye `continuidad`, o `continuidadCritica` |
| electromovilidad | `crecimiento`: ¿cuántos vehículos o kW nuevos vienen en 12 meses? (`pocos` <10 veh / <100 kW · `medios` · `muchos` >50 veh / >500 kW · `nolose`) | `disparador` incluye `capacidad` |
| centros_datos | `corte` | siempre (continuidad crítica) |

Si `when` no matchea, el paso no se muestra y la respuesta queda `null`. El motor
trata `null` como "no aplica": no suma puntos, no cuenta como "no lo sé", no dispara
refuerzos de checklist. `nolose` sí cuenta como dato faltante.

### 1.6 Vista (`app.js`)

- Navegación: `siguientePaso(idx)` y `pasoAnterior(idx)` saltan pasos cuyo `when` no
  matchea. Al cambiar una respuesta común, la condicional se reevalúa; si deja de
  aplicar, su respuesta se borra (`null`).
- Progreso: "Paso n de N" donde N es el número de pasos visibles con las respuestas
  actuales (7 u 8). Puede cambiar de 7 a 8 al responder `disparador`; es aceptable.
- Modo rápido (`?rapido`): sin cambios.

---

## 2. Motor

### 2.1 Frenos ("primer paso")

`content.frenos` es una lista de reglas, evaluadas en orden, la primera que matchea
gana:

```js
frenos: [
  { id: 'gestion_carga_primero',
    when: { gestion_carga: 'manual', anyOf: [{ disparador: 'capacidad' }, { perfil: 'picos' }] },
    tipo: 'Gestión de carga primero',
    razon: '…',
    despues: 'bess' }   // familia del segundo paso
]
```

`engine.applyBrakes(resp, content)` devuelve el freno o `null`. `recommendSolution`
recibe el freno: si existe, la recomendación es

```js
{ tipo, razon, familia: 'primer_paso', primerPaso: true, segundoPaso: { tipo, razon, familia } }
```

donde `segundoPaso` es lo que hoy devolvería `recommendSolution` sin freno. Si no
hay freno, la salida es la de hoy más `primerPaso: false`.

Frenos iniciales (uno por perfil, como datos en su `*.content.js`):

| id | Perfil | Condición |
|---|---|---|
| `gestion_carga_primero` | electromovilidad | `gestion_carga: manual` y (`disparador` capacidad o `perfil` picos) |
| `optimizacion_hidraulica_primero` | bombeo | `hidraulica: tanque_sin_horario` y `perfil` en {picos, punta} |
| `eficiencia_primero` | cadena_frio | `compresores: viejos_sin_control` y `perfil` en {picos, diurno, plano} |
| `respaldo_basico_primero` | centros_datos | `respaldo_actual: nada` |

Un freno nunca aplica con `disparador` `aislado` (la microred manda) ni cuando el
encaje técnico es Bajo (no hay segundo paso que frenar; se usa `insuficiente`).

Vista: en el resultado, el bloque de recomendación muestra "Primer paso: {tipo}" con
su razón y debajo "Segundo paso: {segundoPaso.tipo}" con el puntaje de su
oportunidad. El anteproyecto se arma con la familia del segundo paso más
`content.anteproyecto.primer_paso` (datos propios del freno, p. ej. horarios de
flotilla, curva de tanque).

### 2.2 Cuatro salidas

Reemplazan a `potencial_general`, que desaparece del resultado y del payload
(`api/lead.js` deja de leerlo; el correo muestra las cuatro).

| Salida | Función | Entrada | Valores |
|---|---|---|---|
| Encaje técnico | `encajeTecnico(scores, content)` | solo `scores` | Bajo (<medio), Medio (<fuerte), Alto (<muyAlto o 1 fuerte), Muy Alto (≥muyAlto y ≥2 fuertes). Umbrales: los actuales de `scoring.umbralPotencial`. |
| Tamaño | `tamanoOportunidad(resp, content)` | `factura`, `tarifa`, `conectado` | Sin cuantificar (factura `nolose`, tarifa no cuantificable, o `conectado === false`), Chico (`bajo`), Medio (`medio`), Grande (`alto`, `muyalto`). |
| Confianza | `confianza(resp, recomendacion, content)` | requisitos de la recomendación | Alta (0 faltantes), Media (1), Baja (≥2). |
| Intención comercial | `intencionComercial(resp, estado)` | `disparador`, `corte`, enriquecimiento, agenda | Explorando (solo `costo`), Evaluando (capacidad/diésel/continuidad/aislado), Activo (agregó mapa/facturas/datos o agendó). |

Requisitos por recomendación: `content.requisitos[familiaOFreno] = ['perfil', 'tarifa', …]`.
Un requisito "falta" si la respuesta es `nolose`, `null` por no aplicar cuando la
familia lo exige, o el dato de enriquecimiento no existe (p. ej. `techo` para
`solar`). Tabla inicial:

| familia | requisitos |
|---|---|
| `bess` | perfil, tarifa, factura |
| `solar` | perfil, generacion, techo |
| `bess_solar` | perfil, tarifa, factura, techo |
| `off_grid` | fuente, factura (gasto), consumo |
| `primer_paso` | los del freno (p. ej. `gestion_carga_primero`: gestion_carga, perfil) |
| `base` / `insuficiente` | perfil, tarifa, factura |

El cliente ve Encaje, Tamaño y Confianza. Intención solo va al correo interno.
La frase `resumen.aplicaFrase` pasa a indexarse por Encaje.

### 2.3 Limitaciones por perfil

`detectLimitations` evalúa primero `conectado`. Si es `false`, las limitaciones de
factura y tarifa no se agregan; en su lugar van `L.consumo` y `L.combustible` (nuevas
entradas de `content.limitaciones`, con texto por perfil). El resto sigue igual.
`L.techo` sigue aplicando a microred (necesita superficie).

### 2.4 Vocabulario por perfil hasta el correo

`content.emailVocabulary` crece:

```js
emailVocabulary: {
  site, technicalContact,
  documentos: { conectado: 'tus 12 recibos de CFE (kWh, demanda y tarifa)', aislado: 'tu consumo diario (kWh), potencia pico (kW), litros y costo de diésel al mes, fuente actual y horas de autonomía' },
  idServicio: 'Número de servicio (RPU) de tu recibo CFE.'   // omitido si conectado === false
}
```

`api/lead.js` arma "Ya tenemos" y "Nos ayudaría" con `payload.email_vocabulary` y
`payload.conectado`. Regla: si `conectado === false`, el correo al cliente y el
interno no mencionan CFE, RPU ni recibos. `renderFacturas` en `app.js` toma título y
subtítulo de `content.postResult.facturas` (por perfil) en lugar del texto fijo.

### 2.5 Payload del lead

Se agregan: `encaje_tecnico`, `tamano`, `confianza: { nivel, faltantes[] }`,
`intencion`, `conectado`, `freno` (id o null), `recomendacion_solucion.primerPaso`,
`recomendacion_solucion.segundoPaso`, `datos_consumo` (ver 3). Se quita
`potencial_general`. `normalizeResponses` mapea payloads viejos: `potencial_general`
se ignora; respuestas sin `gestion_carga`/`hidraulica`/… quedan `null`.

---

## 3. Después del resultado

### 3.1 Pasos

`engine.pasosEnriquecimiento(res, content)` devuelve una lista ordenada de pasos
entre `['techo', 'punto', 'facturas', 'consumo']`:

| Paso | Se incluye si |
|---|---|
| `techo` (mapa con áreas) | la familia efectiva (segundo paso si hay freno) incluye solar: `solar`, `bess_solar`, `off_grid`. |
| `punto` (mapa solo punto eléctrico) | familia `bess`, `bess_solar`, `off_grid`, o `disparador` capacidad, o `postResult.servicePoint`. Si ya está `techo`, se fusiona en la misma pantalla de mapa (como hoy). |
| `facturas` | `conectado !== false`. |
| `consumo` | `conectado === false`. |

`postResult.forzar: ['punto']` permite a un perfil forzar pasos. Si la lista queda
vacía, "Afinar mi anteproyecto" lleva directo a contacto. `app.js` reemplaza el
`enrichmentStep()` constante por esta lista y navega con índice.

### 3.2 Paso `consumo`

Pantalla nueva `renderConsumo` con cuatro campos numéricos opcionales:
`kwh_dia`, `kw_pico`, `litros_diesel_mes`, `horas_autonomia`. Se guardan en
`estado.datos_consumo` y viajan en el payload. Validación: números ≥ 0; vacío = null.
Cuenta como dato presente para el requisito `consumo` si al menos `kwh_dia` o
`litros_diesel_mes` tiene valor.

### 3.3 Correo interno

Muestra "Datos de consumo" cuando existen, con los cuatro campos.

---

## 4. Pruebas

- `diagnostico.profiles.test.js`: contrato de 1.1 para los 7 perfiles. Ya no exige
  8 pasos iguales.
- `diagnostico.exhaustive.test.js`: corre por los 7 perfiles. Para cada perfil itera
  todas las opciones de sus pasos, con la condicional en ambos estados (respondida y
  `null`) y con `disparador` incluyendo combinaciones con `aislado` y `continuidad`.
  Invariantes:
  - Si un freno aplica, `recomendacion.primerPaso === true` y `segundoPaso` existe.
  - Nunca hay freno con `aislado` ni con encaje Bajo.
  - Confianza nunca es Alta si un requisito está en `nolose`.
  - Encaje no cambia al variar solo `factura`.
  - Tamaño no cambia al variar solo `perfil`.
  - Con `conectado === false`, `limitaciones[0]` es consumo o combustible, nunca factura.
- `api.lead.extras.test.js`: con `conectado: false`, ni el correo interno ni el del
  cliente contienen "CFE", "RPU" ni "recibos". Con `freno`, el correo muestra
  "Primer paso" y "Segundo paso".
- `diagnostico.engine.test.js`: casos unitarios de `applyBrakes`, `encajeTecnico`,
  `tamanoOportunidad`, `confianza`, `pasosEnriquecimiento`.

---

## 5. Migración y compatibilidad

- `profile_version` sube a `2.0` en los 7 perfiles. El estado guardado en
  `localStorage` usa `profileId:version`, así que un estado v1 no se restaura.
- `api/lead.js` acepta payloads v1 (sin las salidas nuevas): muestra `—` donde falte.
- Cache-bust `?v=` sube al publicar.
- `docs/superpowers/specs/2026-08-10-motor-diagnostico-v3-design.md` queda como
  historia; este documento lo reemplaza en lo que contradiga.
