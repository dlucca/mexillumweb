# Rediseño del funnel de diagnóstico Mexillum — v2

**Fecha:** 2026-08-08
**Estado:** aprobado (diseño) — pendiente de plan de implementación

## Contexto

Reescritura estructural del funnel de diagnóstico BESS (sitio estático HTML/CSS/JS
vanilla en Vercel, funciones serverless bajo `/api/`). La v1 tiene 6 preguntas y un
motor de 3 capas (A/B/C). La v2 tiene **8 preguntas** y un motor de **5 bloques
(A–E)** con cálculo aritmético de rango de ahorro.

**Fuente de verdad:** este documento. `PRD_Funnel_Mexillum.md` describe la v1, está
desactualizado y **no se edita** en este trabajo. Su "Apéndice A" nombra archivos
(`js/diagnostico.js`, `api/diagnostico-lead.js`, `api/diagnostico-booking.js`) que
**no existen**; la estructura real es la que se conserva abajo.

Se mantiene intacto lo que ya funciona: el design system (`css/tokens.css`,
`css/components.css`, componentes `mx-*`), la integración con Resend vía `/api/lead`,
el patrón de credenciales en variables de entorno del lado servidor, y la existencia
de un embed de agenda cal.diy en la pantalla final.

## Decisiones de diseño (resueltas con el usuario)

1. **Copy en es-MX (tuteo).** Todo el copy de la v2 (escrito en voseo en el prompt
   original) se adapta a tuteo mexicano. El test `no-voseo` existente
   (`test/diagnostico.content.test.js`) lo hace cumplir.
2. **Sin score numérico.** El motor v1 calculaba un score interno (§9.1) que hoy
   encabeza el email de lead. La v2 lo elimina. El email se encabeza con el **Perfil**
   (Bloque A) y el **rango estimado** (Bloque B). Se conservan el checklist completo
   y las 8 respuestas crudas.
3. **Gate de contacto = paso nuevo.** No existe hoy (el contacto se captura vía el
   callback de cal.diy). Se agrega un paso de gate entre la P8 y el resultado. El lead
   se envía a `/api/lead` **al enviar el gate** (captura cada diagnóstico completado,
   agende o no). Al concretarse una reserva en cal.diy se re-envía con la bandera
   `booking_agendado: true` + fecha, correlacionado por un `lead_id` estable.

## Arquitectura de módulos (se conserva el split content/engine/view)

| Archivo | Cambio |
|---|---|
| `js/diagnostico.content.js` | Reescritura como **datos puros**: 8 `pasos`, defs de campos del gate, y las tablas de reglas de los 5 bloques (A partes de perfil; B tablas 1/2/3 + plantillas de copy + casos especiales/sin-número; C listas principal/secundaria/descartada; D reglas de dato faltante; E reglas de financiamiento), checklist base + refuerzos + ítem de viabilidad. Sin lógica. |
| `js/diagnostico.engine.js` | Reescritura como **funciones puras**. Núcleo: `computeRange(resp)` → `{piso, techo, cadena, sinNumero, notas}` (cálculo separado de presentación), `plantaLabel(resp)`, `buildProfile(resp)`, `pickLevers(resp)` (principal → excluye → secundaria → descartada), `pickMissingData(resp)`, `pickFinancing(resp)`, `buildChecklist(resp)` (ítem de viabilidad, tope web ≤4), formateadores de dinero, `assembleResult(estado)` → `{bloques A–E, checklist, leadPayload, note}`. |
| `js/diagnostico.view.js` | 8 pasos (el renderer de pasos ya es genérico sobre `content.pasos`), **vista de gate nueva** (mx-field/mx-input/mx-select + `rol`), vista de resultado que arma A–E + checklist, embed cal.diy sin cambios. Envío del lead al enviar el gate. |
| `diagnostico/index.html` | Actualizar `meta description` a "8 preguntas"; `#dx-root` es genérico, sin cambios estructurales. |
| `api/lead.js` | 8 keys de preguntas + `rol`; reemplazar encabezado score/arquetipo/refuerzo por **perfil + rango**; conservar `checklist_full`. |
| `test/diagnostico.engine.test.js`, `test/diagnostico.content.test.js` | Reescritura para v2, incluyendo el fixture como aserción end-to-end fija. |

**Sin estilos nuevos.** El gate reusa `.mx-field`, `.mx-field__label`,
`.mx-field__error`, `.mx-input`, `.mx-select`, `.mx-btn`. El resultado reusa el grid
`.dx__final` existente (agenda/cal.diy en la columna izquierda, diagnóstico A–E en la
derecha, checklist como aside dentro de esa columna; versiones print/email con el
checklist completo).

## 1. Las 8 preguntas (single-select)

Variable de plantilla `planta`: `plantaLabel(resp)` devuelve `"tu operación"` si
`sitios === "uno"`, y `"esa planta"` en otro caso. Se sustituye `{planta}` en los
prompts de los pasos 5, 6 y 7 (y en cualquier copy de bloque que la referencie).

### Intro (pantalla 0)
- Título: **Diagnóstico energético en 2 minutos**
- Cuerpo: "Ocho preguntas sobre tu operación. Al final vas a ver qué palancas de
  ahorro aplican a tu caso, un rango estimado de lo que hay en juego, y qué datos
  preparar para volverlo un número exacto."
- Pie: *Sin costo. Sin compromiso.*
- Botón: `Empezar`

### P1 — `sector`  ·  "¿Cómo describirías tu operación?"
| Opción visible | valor |
|---|---|
| Proceso continuo 24/7 (alimentos, minería, química, papel, agua) | `continuo` |
| Manufactura por turnos o por lotes | `manufactura` |
| Frío y logística (cadena de frío, CEDIS, hielo) | `frio` |
| Infraestructura pública o servicios (transporte, agua, edificios) | `publico` |
| Carga de vehículos eléctricos | `ev` |

### P2 — `sitios`
Prompt: "Antes de empezar: si operas varias plantas, vamos a enfocar este diagnóstico
en una sola — la que quieras mejorar primero. ¿Cuántas instalaciones opera tu empresa
en total?"
| Opción visible | valor |
|---|---|
| Una sola | `uno` |
| 2 a 5 | `pocos` |
| Más de 5 | `muchos` |

### P3 — `generacion`  ·  "¿Generan parte de su propia energía?"
| Opción visible | valor |
|---|---|
| No, compramos todo de CFE o de un suministrador | `no` |
| Sí — solar o contrato renovable vigente | `fisica` |
| Generamos parte del año (cogeneración, zafra, estacional) | `estacional` |
| Lo estamos evaluando | `evaluando` |

### P4 — `demanda`
Prompt: "¿Sabes qué parte de tu factura es cargo por demanda, y no la energía que
consumiste?" Hint: "Es un cargo aparte, por tu momento de mayor consumo del mes — a
veces solo 15 minutos."
| Opción visible | valor |
|---|---|
| Sí, lo tenemos identificado y medido | `mide` |
| Lo he visto en la factura, pero no lo analizamos | `visto` |
| No sabía que se facturaba por separado | `desconoce` |

### P5 — `tarifa`
Prompt: "Busca el recibo de CFE de {planta}. Arriba a la derecha hay un código de
tarifa — ¿cuál es?"
| Opción visible | valor |
|---|---|
| GDMTH | `gdmth` |
| DIST o DIT | `dist` |
| Otra / PDBT | `otra` |
| No tengo el recibo a la mano | `nolose` |
| No compramos a CFE (suministrador privado) | `privado` |

### P6 — `factura`
Prompt: "De {planta}: ¿cuánto paga de electricidad al mes?" Hint: "Solo lo usamos
para estimar el rango — nada se comparte."
| Opción visible | valor |
|---|---|
| Menos de $200,000 MXN | `bajo` |
| $200,000 – $1,000,000 | `medio` |
| $1,000,000 – $5,000,000 | `alto` |
| Más de $5,000,000 | `muyalto` |
| No lo tengo a la mano | `nolose` |

### P7 — `corte`
Prompt: "Si a {planta} se le corta la energía 30 minutos en su peor momento del día,
¿qué pasa?"
| Opción visible | valor |
|---|---|
| Se pierde producto o un lote completo | `producto` |
| Se detiene producción y reiniciar toma horas | `reinicio` |
| Perdemos servicio o ingresos por hora | `servicio` |
| Incomoda, pero no cuesta dinero relevante | `nada` |

### P8 — `disparador`  ·  "¿Reconoces alguna de estas situaciones?"
| Opción visible | valor |
|---|---|
| Queremos crecer o ampliar carga, y CFE no da capacidad (o tarda) | `capacidad` |
| Usamos diésel o planta de emergencia con frecuencia | `diesel` |
| Generamos excedente que exportamos o se desperdicia | `excedente` |
| Ninguna — nuestro tema es puramente el costo | `costo` |

### Gate de contacto (paso nuevo, antes del resultado)
Campos: `nombre`, `empresa`, `email` (→ `correo` en el payload), `telefono`, `rol`
(select: Dirección general / Finanzas / Operaciones-Planta / Energía-Mantenimiento /
Otro). Obligatorios: nombre + email válido; el resto opcional.
- Título: **Tu diagnóstico está listo.**
- Cuerpo: "Déjanos dónde enviártelo con el rango estimado y el checklist de datos."
- Botón: `Ver mi diagnóstico` → valida, envía el lead a `/api/lead`, muestra el
  resultado.

## 2. Motor de resultado — 5 bloques

Se ensambla en orden A → B → C → D → E. Cada bloque evalúa sus reglas de arriba hacia
abajo y usa la primera que aplique. Ningún bloque repite contenido de otro.

### BLOQUE A — Nombre del perfil (una línea)
Patrón: `"Perfil: " + [sector legible] + [" multi-planta" si sitios != "uno"] + " " + [exposición dominante] + "."`

Exposición dominante (primera que aplique):
- `generacion == "estacional"` → "con generación estacional y hueco fuera de temporada"
- `sector == "continuo"` → "de proceso continuo con exposición estructural a horario punta"
- `disparador == "capacidad"` → "con restricción de capacidad eléctrica"
- `disparador == "diesel"` → "con dependencia de diésel"
- default → "con exposición a cargo por demanda"

Sector legible: `continuo`→"proceso continuo", `manufactura`→"manufactura",
`frio`→"frío y logística", `publico`→"infraestructura pública", `ev`→"carga de
vehículos eléctricos".

### BLOQUE B — El número, con aritmética visible
**La aritmética SIEMPRE va a la vista. Nunca un número sin la cadena que lo produce.**

Fórmula:
```
Ahorro_anual_piso  = factura_mensual × 12 × pct_demanda_piso  × pct_recorte_piso
Ahorro_anual_techo = factura_mensual × 12 × pct_demanda_techo × pct_recorte_techo
```

**Tabla 1 — factura mensual (MXN), de `factura`:**
`bajo`→120000, `medio`→500000, `alto`→2500000, `muyalto`→7000000, `nolose`→null
(salida sin número).

**Tabla 2 — % cargo por demanda [piso, techo], de `tarifa`:**
`gdmth`→[0.30, 0.40], `dist`→[0.35, 0.45], `otra`→[0.20, 0.35], `nolose`→[0.20, 0.35],
`privado`→null (salida especial).

**Tabla 3 — % de recorte del cargo por demanda [piso, techo], de `sector`:**
`manufactura`→[0.25, 0.35], `frio`→[0.25, 0.35], `ev`→[0.30, 0.45],
`continuo`→[0.12, 0.20], `publico`→[0.20, 0.30].

`tarifa_legible`: `gdmth`→"GDMTH", `dist`→"DIST/DIT", `otra`/`nolose`→"tu tarifa actual".

**Reglas de presentación (obligatorias):**
1. **Redondeo legible con round-half-to-even (banker's rounding).**
   - ≥ 1,000,000: millones con un decimal, redondeo medio-a-par. Ej: `2,250,000` →
     "2.2" (2 es par); `2,187,450` → "2.2"; `4,200,000` → "4.2".
   - < 1,000,000: redondear a la decena de miles más cercana y mostrar
     "$XXX,XXX". Ej: `640,000` → "$640,000".
   - Este redondeo es el que reproduce el fixture (§5); es una regla dura, no un ajuste
     estético.
2. Mostrar SIEMPRE la cadena de cálculo antes del rango.
3. Incluir SIEMPRE el disclaimer de cierre.

**Formato del rango final** (`formatRango(piso, techo)`):
- ambos ≥ 1M: `"$A a $B millones de MXN al año"` (sufijo "millones" compartido). Ej:
  "$2.2 a $4.2 millones de MXN al año".
- si algún extremo < 1M: formatear cada extremo por su escala y unir con "a", cerrando
  con "de MXN al año".

**Copy plantilla (caso con número, tarifa CFE):**
> Con una factura de ~${factura_legible} al mes en tarifa {tarifa_legible}, el cargo
> por demanda suele pesar entre {pct_demanda_piso}% y {pct_demanda_techo}% de tu
> recibo — unos ${monto_demanda_anual_piso} a ${monto_demanda_anual_techo} al año,
> solo por tu momento pico. Un sistema de almacenamiento bien dimensionado recorta
> típicamente entre {pct_recorte_piso}% y {pct_recorte_techo}% de ese cargo.
>
> **Rango estimado: ${ahorro_piso} a ${ahorro_techo} de MXN al año.**
>
> *Es un rango de industria sobre los datos que diste, no una propuesta. Con tus
> recibos de 12 meses se vuelve un número exacto.*

Donde `factura_legible` = punto de cálculo formateado (`alto` → "$2.5 millones"),
`monto_demanda_anual = factura_mensual × 12 × pct_demanda`, y los `%` se muestran como
enteros (0.30 → "30").

**Caso especial `sector == "continuo"`** — después del rango, agregar:
> Pero en una operación 24/7 como la tuya, el recorte de pico no es tu palanca más
> fuerte — el arbitraje horario suele serlo, porque compras en punta obligadamente
> todos los días. Eso se suma a este rango y lo calculamos con tu desglose horario.

**Salidas SIN número (no calcular fórmula):**
- `factura == "nolose"`:
  > Para estimar tu ahorro necesitamos el orden de magnitud de tu factura — es el
  > primer dato del checklist. Lo que sí podemos decirte desde ya es qué palancas
  > aplican a tu perfil:
- `tarifa == "privado"`:
  > Como compras a un suministrador privado, tu ahorro depende de la estructura de tu
  > contrato — si tienes exposición a precios horarios del mercado, hay arbitraje; si
  > es precio fijo, el margen se lo queda tu suministrador. Es la primera pregunta que
  > resolvemos en la llamada.
- Nota `disparador == "diesel"` (se **suma**, no reemplaza):
  > Y ojo: la sustitución de diésel ahorra por peso desplazado, no por porcentaje de
  > factura — suele ser el de mayor margen del análisis, y lo dimensionamos con tus
  > horas de operación.

**Precedencia sin número:** `factura == "nolose"` y `tarifa == "privado"` reemplazan
el cálculo; si aplican ambos, mostrar el de `privado` (más informativo). La nota de
`diesel` se suma en cualquier caso (con o sin número).

### BLOQUE C — Palancas jerarquizadas
Tres líneas en orden: principal, secundaria, descartada. Si `demanda` es `desconoce`
o `visto`, anteponer la frase-gancho:
> La mayoría de las empresas no sabe que una parte grande de su recibo no es energía
> que consumió, sino un cargo por su pico de demanda. Eso es exactamente lo primero
> que revisamos.

**PRINCIPAL (primera que aplique, prefijo "Principal — [nombre]. "):**
1. `generacion == "estacional"` → Cobertura fuera de temporada — "Tu generación cubre
   parte del año; el resto pagas tarifa completa. Ahí está tu mayor hueco, y coincide
   con la temporada de más sol."
2. `disparador == "diesel"` → Sustitución de diésel — "Cada hora de diésel cuesta un
   múltiplo de la red. Desplazarlo es tu palanca de mayor margen."
3. `disparador == "capacidad"` → Diferimiento de capacidad — "Ampliar tu acometida con
   CFE puede tomar meses o años. El almacenamiento te deja crecer sin esperar esa
   ampliación."
4. `sector == "continuo"` → Arbitraje horario — "Tu operación no para, así que compras
   en horario punta todos los días sin alternativa. Trasladar ese consumo a horas
   baratas es tu palanca más fuerte."
5. `sector == "ev"` → Diferimiento + pico de carga — "Un cargador rápido dispara un
   pico de demanda brutal frente a lo que factura. Recortarlo y evitar ampliar
   acometida es donde está el dinero."
6. `disparador == "excedente"` → Arbitraje de excedente — "El excedente que hoy
   exportas a precio de valle puede venderse en las horas de mayor precio. Es una
   palanca de ingreso, no de ahorro."
7. default → Recorte de demanda — "Tu momento de mayor consumo fija un cargo que pesa
   sobre toda la factura, aunque dure minutos. Es de lo más fácil y directo de
   recortar."

**SECUNDARIA (primera que aplique, EXCLUYENDO la que ganó como principal; si ninguna,
no mostrar; prefijo "Secundaria — [nombre]. "):**
- `corte == "producto"` → Respaldo de producto — "Además, un corte te cuesta producto
  perdido — el respaldo protege ese inventario."
- `corte == "reinicio"` → Continuidad de proceso — "Además, cada paro te cuesta horas
  de reinicio; el respaldo evita esa pérdida."
- `corte == "servicio"` → Continuidad de servicio — "Además, cada hora sin energía es
  ingreso perdido — el respaldo lo sostiene."
- `sector == "continuo"` (si no fue principal) → Arbitraje horario — "Y como corres
  24/7, el arbitraje horario suma sobre el recorte de pico."
- `disparador == "capacidad"` (si no fue principal) → Diferimiento de capacidad — "Y
  te permite crecer sin esperar la ampliación de CFE."

**DESCARTADA (una sola, primera que aplique; si ninguna, no mostrar; prefijo
"No aplica — [nombre]. "):**
1. `generacion == "fisica"` → Solar — "Ya tienes generación resuelta; tu cuello de
   botella es cómo aprovecharla y qué te cuesta la demanda, no generar más."
2. `generacion == "estacional"` → Tu cogeneración — "No te proponemos tocarla. Ya
   generas durante la temporada; el foco es el hueco de los otros meses."
3. `sector == "continuo"` → Peak shaving como caso principal — "No te lo vendemos como
   el gran ahorro: en una operación 24/7 rinde poco. Tu palanca real es el arbitraje."
4. `disparador == "costo"` AND `corte == "nada"` → Respaldo/continuidad — "Si un corte
   no te cuesta dinero, pagar por continuidad no tiene sentido — tu caso es puramente
   de costo."
5. `sitios == "muchos"` → El megaproyecto — "No te proponemos un megaproyecto
   multi-planta. Se empieza por un sitio piloto medido y se replica solo si el número
   se cumple."

### BLOQUE D — El dato que falta (una línea + cierre común)
Primera que aplique:
- `factura == "nolose"` → "Para volver esto un número exacto, el dato clave es tu
  recibo de CFE — con 12 meses vemos tu cargo por demanda real y tu perfil horario."
- `tarifa == "privado"` → "El dato que define tu caso es la estructura de tu contrato
  de suministro — si tienes exposición a precios horarios o es precio fijo. Eso decide
  cuánto arbitraje hay para ti."
- `disparador == "diesel"` → "El dato que dimensiona tu ahorro son las horas al año que
  corre tu diésel — ahí está el mayor margen del análisis."
- `sector == "continuo"` → "El dato que define tu arbitraje es tu desglose de consumo
  por horario (base, intermedia, punta) — se lee de tu recibo GDMTH."
- `corte != "nada"` → "El dato que cierra el caso de respaldo es cuántos paros por
  causa eléctrica tuviste y qué costó cada uno — casi nadie lo mide, y suele ser mayor
  de lo esperado."
- default → "El dato que vuelve esto exacto son tus recibos de CFE de los últimos 12
  meses — sobre tus propios números, no estimaciones."

**Cierre común (siempre después):**
> Ese es exactamente el diagnóstico gratuito que hacemos en la llamada: sobre tus
> datos reales, sin costo y sin compromiso.

### BLOQUE E — Financiamiento como OPCIÓN SUJETA A EVALUACIÓN
**Regla crítica:** el esquema sin inversión (PPA/servicio) NO se presenta como
aprobado ni garantizado. Registro de posibilidad ("puede estructurarse", "existe la
opción", "sujeto a análisis"), nunca de promesa. Prohibido "cero riesgo", "el ahorro
empieza el primer mes", o afirmaciones cerradas sobre el resultado. No repite lenguaje
de ahorro (ya se dijo en B y C).

Primera que aplique:
- `sector == "publico"` → "Para entidades públicas, este tipo de proyecto suele poder
  estructurarse como contrato de servicio en lugar de inversión directa — lo que
  permite tratarlo como gasto corriente. La viabilidad de ese esquema depende de un
  análisis de tu caso, y es parte de lo que evaluamos juntos en la llamada."
- `sector == "ev"` → "Existe la opción de estructurarlo sin inversión inicial, con el
  activo de nuestro lado — sujeto a una evaluación de viabilidad del proyecto. También
  puedes adquirirlo directamente si prefieres evaluarlo por retorno. Vemos cuál te
  conviene según tus números."
- `factura == "muyalto"` → "A tu escala, la pregunta no suele ser si hay capital, sino
  dónde rinde mejor. Se puede estructurar como inversión propia o como esquema de
  servicio que mantiene el activo fuera de tu balance —esto último sujeto a evaluación
  de viabilidad. Definimos cuál encaja con tu política de capital."
- `sitios == "pocos"` OR `sitios == "muchos"` → "Hay dos caminos: adquirir el sistema
  y evaluarlo por retorno sobre tu capital, o un esquema de servicio sin inversión
  inicial —sujeto a análisis de viabilidad— donde ponemos el activo. Con varias
  plantas, lo natural es probar uno primero y definir el modelo con datos reales antes
  de replicar."
- default → "Puede estructurarse de dos formas: adquisición directa evaluada por
  retorno, o esquema de servicio sin inversión inicial, sujeto a un análisis de
  viabilidad del proyecto. En la llamada vemos cuál se ajusta mejor a tu caso."

**Bandera `ofreceServicio`:** el Bloque E ofrece la vía de esquema de servicio en
todos los casos EXCEPTO `factura == "muyalto"` (donde también existe, pero se subordina
a "inversión propia"). Para el checklist (§3), `ofreceServicio = (factura != "muyalto")`.

## 3. Checklist de datos

Precedencia por arquetipo (mismo criterio que el Bloque C principal). Estructura:

1. **Ítems técnicos** (orden = prioridad):
   - Base, siempre: "Recibos de CFE de los últimos 12 meses (de la planta que
     elegiste)" y "Perfil de carga en intervalos de 15 minutos, si lo tienes".
   - Condicionales: "Horas al año que corre tu respaldo de diésel y su costo
     aproximado" (`disparador == "diesel"`); "Historial de paros por causa eléctrica:
     cuántos y qué costó cada uno" (`corte != "nada"`); "Desglose de consumo por
     horario (base, intermedia, punta) de tu recibo GDMTH" (`sector == "continuo"`);
     "Estructura de tu contrato de suministro (precio fijo o exposición a precios
     horarios)" (`tarifa == "privado"`); "Superficie de techo o terreno disponible
     para generación" (`generacion == "estacional"`).
2. **Ítem de viabilidad financiera** (condicional): se agrega solo si
   `ofreceServicio == true` (todos EXCEPTO `factura == "muyalto"`). Va **después** de
   los ítems técnicos y **antes** del universal. Fraseo por segmento:
   - `sector == "publico"`: "Marco de contratación aplicable — si te interesa la
     estructura de contrato de servicio, conviene identificar bajo qué figura de
     adquisición puede la entidad contratarlo. Lo revisamos juntos."
   - resto (privado): "Perfil de la empresa para evaluar el esquema sin inversión —
     antigüedad y facturación aproximada, solo si te interesa explorar esa vía. Nos
     permite ver si es viable para tu caso."
3. **Ítem universal, siempre al final:** "Quién decide y umbral de autorización."

**Tope de la columna web: 4 ítems de contenido (técnicos).** El ítem de viabilidad es
de prioridad baja en la vista web: se muestra sólo si hay menos de 4 técnicos; si ya
hay 4 técnicos, se recorta de la vista web PERO se incluye completo en la nota del
evento cal.diy y en las versiones email/print. El universal no cuenta contra el tope de
4 y siempre aparece.

- `web` = `tecnicos.slice(0,4)`; si `viabilidad` existe y `tecnicos.length < 4`,
  agregar `viabilidad`; luego `universal`.
- `full` = `tecnicos` + (`viabilidad` si existe) + `universal`.

## 4. Integración de datos (lead + nota)

- **Lead a `/api/lead` (Resend):** se envía al enviar el gate, con `booking_agendado:
  false`. `leadPayload` incluye: `lead_id` (estable), `timestamp`, contacto (`nombre`,
  `empresa`, `correo`, `telefono`, `rol`), `respuestas_legibles` (8), `respuestas_codigos`
  (8), `perfil` (string del Bloque A), `rango` (`{piso, techo, texto}` o `{sinNumero}`),
  `checklist_full`, `booking_agendado`, `booking_datetime`.
- **Booking cal.diy:** el embed inline lleva adjunta la **nota del evento** con el
  diagnóstico completo (perfil, rango, palancas, dato faltante, financiamiento),
  **checklist completo (sin recorte)** y las **8 respuestas crudas**. Al concretarse la
  reserva (`bookingSuccessful`), se re-envía el lead con `booking_agendado: true` +
  `booking_datetime`, correlacionado por el mismo `lead_id`. Contacto del gate tiene
  prioridad sobre el de cal.diy.
- **`api/lead.js`:** actualizar `PREGUNTAS` a las 8 keys + `rol`; encabezar el email
  con Perfil + rango (en vez de score/arquetipo/refuerzo); conservar el bloque de
  checklist. Solo `nombre` + `correo` obligatorios; honeypot `website` intacto.

## 5. Caso de prueba (fixture — aserción fija en el test del engine)

Entrada: `sector=manufactura, sitios=pocos, generacion=fisica, demanda=desconoce,
tarifa=gdmth, factura=alto, corte=reinicio, disparador=costo`.

Salida esperada:
- **A:** "Perfil: manufactura multi-planta con exposición a cargo por demanda."
- **B:** cadena visible con factura ~$2.5 millones/mes, GDMTH 30–40%, recorte 25–35%,
  y **rango "$2.2 a $4.2 millones de MXN al año"** + disclaimer.
  Verificación: piso = 2,500,000×12×0.30×0.25 = **2,250,000**; techo =
  2,500,000×12×0.40×0.35 = **4,200,000**. (2,250,000 → "$2.2" por redondeo medio-a-par.)
- **C:** frase-gancho (por `demanda=desconoce`) + Principal: Recorte de demanda +
  Secundaria: Continuidad de proceso + No aplica: Solar.
- **D:** dato faltante = recibos 12 meses (default) + cierre común.
- **E:** copy multi-planta (dos caminos, sujeto a análisis de viabilidad).
- **Checklist web:** recibos CFE 12 meses + perfil de carga + historial de paros +
  [viabilidad: perfil de empresa] + quién decide (universal al final) → 4 contenido +
  universal.

## 6. Testing (TDD)

El engine son funciones puras con el fixture como salida exacta → se maneja con tests
primero. Cobertura:
- Fixture §5 como aserción end-to-end fija.
- Precedencia por bloque (A exposición; B tablas + redondeo medio-a-par en las
  fronteras; C principal/secundaria con exclusión/descartada; D; E).
- Casos sin número: `factura=nolose`, `tarifa=privado` (y precedencia entre ambos), y
  la nota `disparador=diesel` que se suma.
- Checklist: recorte web a 4 técnicos, viabilidad de prioridad baja, universal al
  final; `full` sin recorte.
- Contenido: 8 pasos con keys esperadas, códigos únicos por paso, cobertura de tablas,
  y el guard `no-voseo` extendido a todo el copy v2.
- `leadPayload`: expone las keys que consume `api/lead.js`.

## 7. Fuera de alcance

- `index.html` (landing) y `js/main.js`: sin cambios.
- `PRD_Funnel_Mexillum.md`: no se edita.
- Sin estilos CSS nuevos.
