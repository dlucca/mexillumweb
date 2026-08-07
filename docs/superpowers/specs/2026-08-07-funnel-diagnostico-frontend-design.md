# Diseño — Funnel de diagnóstico (Sub-proyecto 1: front-end)

**Fecha:** 2026-08-07
**Estado:** Aprobado para plan de implementación
**Fuente de verdad de contenido:** PRD "Funnel de calificación BESS / BESS+Solar (Mexillum)" v1.0
**Alcance de este documento:** solo el front-end del funnel. Twenty CRM y cal.diy son sub-proyectos posteriores con su propia spec.

---

## 1. Alcance

Este sub-proyecto entrega el **funnel completo funcionando en el navegador, sin backend**:

- Los 6 pasos de opción única con navegación hacia atrás (§4 del PRD).
- El gate de contacto con validación en cliente (§5).
- El motor de reglas de 3 capas que arma el diagnóstico (§6).
- El checklist dinámico con recorte a 4 líneas (vista web) y versión completa (§7).
- La pantalla de resultado de 2 columnas + checklist sticky (§3).
- La hoja de impresión `@media print` con checklist completo (§10.2).
- El ensamblado del `leadPayload` (respuestas legibles + arquetipo + score, §8.1 / §9).

El envío del lead queda como **costura** (`submitLead(payload)`): en v1 solo hace `console.log`. Los sub-proyectos siguientes la conectan a destinos reales.

### 1.1 Fuera de alcance (con costura marcada)

| Diferido | Sub-proyecto | Costura dejada en v1 |
|---|---|---|
| Escritura a Twenty CRM (§9.2) | 2 | `submitLead(payload)` recibe el payload completo y legible |
| Email a Cris + botón "enviarme el diagnóstico" (§10.1) | 2 | mismo `submitLead`; botón de email oculto/deshabilitado |
| Embed real de cal.diy + detección de booking (§8) | 3 | slot `#agenda` con placeholder; botón CTA hace scroll a ese slot |
| Analítica de abandono por paso | v2 | — |

`booking_agendado` es siempre `false` y `booking_datetime` ausente en el payload de v1 (no hay booking todavía).

---

## 2. Arquitectura

Corte central: **lógica pura separada del DOM**. El motor de reglas es la parte que debe ser correcta y es lo que se testea aislado.

```
diagnostico/
  index.html              # una sola página; pasos + gate + resultado son vistas JS
css/
  diagnostico.css         # sobre tokens.css + components.css; sin sistema de estilos paralelo
js/
  diagnostico.content.js  # TODO el copy y las reglas, como datos (config, §11)
  diagnostico.engine.js   # funciones puras: reglas A/B/C, checklist, score, ensamblado
  diagnostico.view.js     # único módulo que toca el DOM: render, navegación, gate, print
test/
  diagnostico.engine.test.js  # node --test, sin dependencias nuevas
```

**Reglas del corte:**

- `engine.js` no toca el DOM ni importa nada del navegador → importable por `<script type="module">` y por Node (tests). ESM puro.
- `content.js` es solo datos, cero lógica. El motor lee prioridades **desde los datos**.
- `view.js` es el único que toca el DOM y el único que llama a `submitLead`.

### 2.1 Flujo de datos

```
estado = { respuestas: {tipo_instalacion, generacion_propia, patron_operacion,
                         interrupciones, diesel_red_debil, exporta_excedente},
           contacto:   {nombre, empresa, correo, telefono?, cargo?} }
   │  pasos 1–6 (back-nav libre)
   ▼
gate de contacto (validación cliente, patrón de main.js)  → respuestas quedan bloqueadas
   ▼
engine.assembleResult(estado, content) → resultado (§2.3)
   ▼
view: pantalla de resultado (2 col) + checklist sticky (web ≤4) + print (full)
   ▼
submitLead(resultado.leadPayload)   ← v1: console.log
```

### 2.2 Modelo de estado y navegación

- SPA en `diagnostico/index.html`; `view.js` renderiza una vista a la vez desde el objeto `estado`.
- Back-nav libre entre pasos 1–6. Una respuesta previa seleccionada se muestra marcada al volver.
- Tras pasar el gate: respuestas **bloqueadas**; única salida para cambiarlas es "Reiniciar" (vuelve al paso 1, limpia `estado`). Evita inconsistencias entre lo mostrado y lo enviado (§3 del PRD).
- Sin routing de URL en v1 (una sola página, estado en memoria). Recargar reinicia.

### 2.3 Forma de `assembleResult`

```
assembleResult(estado, content) → {
  layerA:        string,            // §6.1
  layerB:        string | null,     // §6.2 (máx 1)
  layerC: { texto: string, ctaText: string },  // §6.3 (label ya corregido, ver §4)
  checklist: { web: string[], full: string[] },// §7 (universal al final en ambos)
  archetypeBase:  string,           // id de la regla A activada (§9)
  reinforcement:  string | null,    // id de la regla B activada (§9)
  score: { valor: number, nivel: 'bajo'|'medio'|'alto' },  // §9.1
  leadPayload:    object            // §5 (respuestas legibles + meta), listo para submitLead
}
```

---

## 3. Motor de reglas (`engine.js`)

Funciones puras, una responsabilidad cada una:

- **`resolveBaseArchetype(resp)`** — selector de prioridad base compartido:
  `generacion_propia==estacional` → `generacion_propia==fisica` → `patron_operacion==continuo` → `patron_operacion==picos` → `patron_operacion==intermitente` (fallback).
  Devuelve el id del arquetipo base. **`pickLayerA` y `buildChecklist` lo consumen ambos**, para que mensaje y checklist nunca se desincronicen.
- **`pickLayerA(resp)`** — texto de la Capa A según `resolveBaseArchetype`. Registra `archetypeBase`. Nota de implementación (§6.1): si el arquetipo base salió de `generacion_propia` (estacional/física), la regla de `patron_operacion` **no** se usa en A y queda como candidata de B.
- **`pickLayerB(resp, usedA)`** — primera regla B que aplica por prioridad (§6.2): `diesel_red_debil==si` → `interrupciones==si_medido` → `interrupciones==si_no_medido` → `exporta_excedente==si`. Máximo 1. `null` si ninguna aplica.
- **`pickLayerC(resp)`** — cierre + `ctaText` por `tipo_instalacion` (§6.3, con label corregido §4).
- **`buildChecklist(resp)`** → `{ full, web }`:
  - `full`: bloque base (por `resolveBaseArchetype`) + refuerzos aplicables en orden de prioridad (§7.2) + ítem universal al final (§7.3). Sin recorte.
  - `web`: máx **4 bullets de contenido** (base + refuerzos); si excede, se recortan refuerzos de menor prioridad hacia arriba (§7.4). El ítem universal se agrega al final y **no** cuenta contra el tope (queda como 5ª línea si ya hay 4).
- **`computeScore(resp, bookingAgendado=false)`** → `{ valor, nivel }` (§9.1): `interrupciones==si_medido` +3, `si_no_medido` +1, `diesel_red_debil==si` +2, `exporta_excedente==si` +1, `tipo_instalacion==publico` +1, `bookingAgendado` +2. Nivel: 0–1 bajo, 2–4 medio, 5+ alto. En v1 `bookingAgendado` siempre `false`.
- **`toReadable(resp)`** — mapea cada código interno → label visible (§8.1 punto 4), leyendo los labels de `content.js`.
- **`assembleResult(estado, content)`** — orquesta lo anterior y arma `leadPayload`.

### 3.1 `leadPayload` (v1)

```
{
  lead_id,          // uuid generado en cliente (crypto.randomUUID)
  timestamp,        // ISO
  nombre, empresa, correo, telefono, cargo,
  respuestas_legibles: { tipo_instalacion, generacion_propia, patron_operacion,
                         interrupciones, diesel_red_debil, exporta_excedente }, // labels visibles
  respuestas_codigos:  { ...mismos campos con códigos internos... },
  arquetipo_base, refuerzo_activado,
  score: { valor, nivel },
  booking_agendado: false,
  checklist_full: string[]        // para la futura nota de cal.diy / email
}
```

---

## 4. Contenido y config (`content.js`, §11)

Un único módulo de datos (no CMS — overkill para sitio estático sin build). Exporta un objeto con: los 6 pasos (pregunta + opciones como `{label, codigo}`), las tablas de reglas A/B/C con su prioridad, los bloques de checklist, el ítem universal, y todos los textos de gate/encabezados/pies. Cambiar copy o reordenar prioridades = editar este archivo, sin tocar `engine.js` ni `view.js`.

Todo el copy cerrado del PRD (§4, §5, §6.1–6.3, §7) se transcribe aquí **verbatim**, con una única corrección aprobada:

### 4.1 Corrección de copy aprobada (Capa C, texto de botón)

| `tipo_instalacion` | Texto de botón |
|---|---|
| `industrial` | **"Quiero agendar mi diagnóstico"** (antes "Quiero ver el diagnóstico") |
| `comercial` | **"Quiero agendar mi diagnóstico"** (antes "Quiero ver el diagnóstico") |
| `ev` | **"Quiero agendar mi diagnóstico"** (antes "Quiero ver el diagnóstico") |
| `publico` | "Quiero agendar una conversación" (sin cambio) |

Racional: en la pantalla de resultado el diagnóstico ya está a la vista; el botón lleva al widget de agenda, así que el verbo real es "agendar". Los párrafos de cierre de la Capa C **no cambian**, solo el label del botón. Esta corrección debe reflejarse también en el PRD como fuente única de verdad.

---

## 5. Vista y flujo (`view.js`)

- **Pasos 1–6:** una pregunta por vista. Opciones como `mx-check__box--radio` dentro de `mx-card--interactive`. Indicador "Paso N de 6". Back-nav libre. **Sin auto-avance**: elegir una opción habilita el botón "Siguiente"; el usuario puede cambiar su selección antes de avanzar (evita que un misclick salte de paso sin poder corregir). Botón "Atrás" visible desde el paso 2. Si vuelve a un paso, la opción elegida aparece marcada.
- **Gate:** `mx-field` + `mx-input`, validación *forgiving* (limpia el error al volverse válido) igual que `main.js`. Obligatorios: nombre, empresa, correo (regex de `main.js`). Opcionales: teléfono, cargo. Honeypot `website` oculto. Copy de transición de §5.
- **Resultado (desktop, 2 columnas):**
  - Izquierda: bloque de diagnóstico (Capa A + B si aplica + Capa C texto) + botón CTA (§4.1) + slot `#agenda` (placeholder cal.diy) + botón "Imprimir / Guardar PDF". Botón de email presente pero oculto/deshabilitado en v1.
  - Derecha (sticky mientras se agenda): checklist versión **web** (≤4 + universal), con título "Antes de tu llamada, te sirve tener a mano:" y pie "No hace falta tenerlo todo listo — con lo que tengas alcanza para empezar." (§7.5).
- **Mobile:** las 2 columnas se apilan: resultado → checklist → agenda (§3).
- **Botón CTA:** hace scroll/foco al slot `#agenda`.
- **Print (`@media print`):** oculta nav, slot de agenda e interactivos; muestra diagnóstico completo + checklist **full** (no el recorte); marca Mexillum + datos de contacto en el pie (§10.2).
- **Accesibilidad:** radios con roles correctos; foco gestionado al cambiar de paso; `aria-invalid` en el gate como `main.js`; respeta `prefers-reduced-motion` (patrón existente).

---

## 6. Testing (`test/diagnostico.engine.test.js`)

`node --test` (built-in, sin dependencias nuevas, no afecta al sitio estático). El motor es lógica de ramas pura y las tablas del PRD son la tabla de verdad. Cobertura mínima:

- Cada regla de Capa A por prioridad, incluida la nota "generación consume A" (estacional/física desplazan `patron_operacion` a candidata de B).
- Selección de Capa B (prioridad, exclusión de lo usado en A, caso `null`).
- Capa C por los 4 `tipo_instalacion`, con los labels de botón corregidos (§4.1).
- Checklist: versión `full` (sin recorte, universal al final) y `web` (recorte a 4, universal como 5ª sin contar contra el tope).
- `computeScore`: cada sumando y los cortes de nivel (bajo/medio/alto).
- `toReadable`: códigos → labels visibles.

---

## 7. Requisitos no funcionales

- **Mobile-first** (probable mayoría del tráfico C-suite).
- **`<2 min`**: single-select con "Siguiente" explícito, sin tipeo hasta el gate.
- **Sin jerga técnica**: el copy cerrado ya lo garantiza; no se reintroduce en labels/aria/placeholders.
- **`prefers-reduced-motion`**: respetado (patrón de `main.js`).
- **Sobre el design system existente**: solo componentes `mx-*` y tokens; sin estilos paralelos.

---

## 8. Handoff a sub-proyectos siguientes

- **Sub-proyecto 2 (Twenty + email):** implementa `submitLead(payload)` como `fetch` a `api/diagnostico-lead.js`; esa función escribe en Twenty (Company/Person + custom fields) y dispara email a Cris vía Resend. Requiere resolver antes: REST vs GraphQL, custom fields a crear en el workspace, criterio de dedup de Company (§9.2 del PRD). Habilita el botón "enviarme el diagnóstico" (§10.1).
- **Sub-proyecto 3 (cal.diy):** rellena el slot `#agenda` con el embed; define cómo se detecta el booking confirmado (postMessage del widget vs webhook), cómo se adjunta la nota del evento (§8.1) y cómo eso actualiza `booking_agendado`/`booking_datetime` y re-dispara el score (+2). Ojo con `X-Frame-Options: SAMEORIGIN` en `vercel.json` frente al embed de un dominio distinto.
```
