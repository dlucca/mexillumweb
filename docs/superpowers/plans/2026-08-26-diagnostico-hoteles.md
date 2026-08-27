# Diagnóstico Hoteles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a hotel-focused copy of the Mexillum energy diagnostic at `/diagnostico-hoteles`, reusing the pure engine and sharing the view core, without changing the behavior of the existing `/diagnostico`.

**Architecture:** The engine (`js/diagnostico.engine.js`) is already pure — every function takes `content` as an argument. We extract the DOM/view logic from `js/diagnostico.view.js` into a reusable core `js/diagnostico.app.js` exposing `initDiagnostico({ content, calLink, origen })`. The industrial page and the new hotel page each become a 3-line entry that calls the core with their own content + Cal link. A new `js/diagnostico.hoteles.content.js` holds the hotel copy and scoring tweaks. `api/lead.js` gains an additive `origen` marker.

**Tech Stack:** Vanilla ES modules, no build step. Static hosting on Vercel (`cleanUrls`). Tests: `node --test` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-08-26-diagnostico-hoteles-design.md`

## Global Constraints

- Copy is es-MX, tuteo (informal "tú"). Verbatim from spec.
- Brand stays **Mexillum**. Leads go to Mexillum, marked `origen: hoteles`.
- The existing `/diagnostico` runtime must stay **identical**: same content, same Cal link `diagnostico/diagnostico-mexillum`, no `origen`.
- The diagnostic result must render **complete before the gate** (no form to see it) — inherited from the core, do not change.
- Engine (`js/diagnostico.engine.js`) is **not** modified.
- `CAL_ORIGIN` stays `https://cal.mexillum.com` for both versions.
- Hotel Cal link: `diagnostico/diagnostico-hoteles` (the Cal event is created by the user, outside this code).
- No new dependencies. No new CSS files (reuse `css/`).

---

### Task 1: Extract the view core (`diagnostico.app.js`) and rewire the industrial entry

Mechanical refactor: move everything currently in `js/diagnostico.view.js` into a core function `initDiagnostico({ content, calLink, origen })` in a new file `js/diagnostico.app.js`, then make `js/diagnostico.view.js` a thin entry that calls it with the industrial content. Runtime for `/diagnostico` must be byte-for-byte equivalent.

**Files:**
- Create: `js/diagnostico.app.js`
- Modify: `js/diagnostico.view.js` (replace whole file with thin entry)

**Interfaces:**
- Produces: `export function initDiagnostico({ content, calLink, origen })` — mounts the diagnostic into `#dx-root`, wires Cal embed to `calLink`, and (if `origen` is truthy) stamps it onto the lead payload. Returns nothing.

- [ ] **Step 1: Create `js/diagnostico.app.js` by moving the current view body into a function**

Take the entire current contents of `js/diagnostico.view.js` and wrap it. Concretely, `js/diagnostico.app.js` is:

```js
import { assembleResult, plantaLabel, bookingContact } from './diagnostico.engine.js';

// Instancia self-hosted de cal.diy. El origen es común a todas las versiones.
const CAL_ORIGIN = 'https://cal.mexillum.com';

// Núcleo de la vista del diagnóstico. Cada versión (industrial, hoteles) lo arranca
// con su propio `content`, su `calLink` de Cal.com y un `origen` opcional para marcar
// el lead. Toda la lógica de pantallas vive aquí; los archivos *.view.js solo arrancan.
export function initDiagnostico({ content, calLink, origen }) {
  const root = document.getElementById('dx-root');

  const estado = {
    paso: 'intro',            // 'intro' | 0..7 | 'result'
    respuestas: {},
    contacto: {},
    resultado: null           // cache del assembleResult
  };

  // ... EVERYTHING from the current view.js that lived between `const estado = {...}`
  //     and the final `render();` call goes here, UNCHANGED, except the four edits below.

  render();
}
```

Move all helper functions (`el`, `esc`, `withPlanta`, `focusMain`, `renderIntro`, `renderStep`, `renderStepMulti`, `tickSvg`, `loadCal`, `mountCal`, `registerBookingListener`, `renderResult`, `render`, `submitLead`) and the mutable flags (`leadEnviado`, `bookingListenerReady`) **inside** `initDiagnostico`, so they close over `content`, `calLink`, `origen`, `root`, `estado`. Apply exactly these four edits while moving:

1. Delete the old module-level `import content from './diagnostico.content.js';` and the module-level `const CAL_LINK = ...` (both replaced by the params / the CAL_ORIGIN const above).
2. In `withPlanta`, use the content-provided label with fallback to the engine constant:

```js
function withPlanta(texto) {
  return texto.replace('{planta}', content.plantaLabel || plantaLabel(estado.respuestas));
}
```

3. In `mountCal`, use `calLink` instead of the removed `CAL_LINK`:

```js
window.Cal('inline', {
  elementOrSelector: selector,
  calLink,
  layout: 'month_view',
  config: { notes: res.note, name: estado.contacto.nombre || '', email: estado.contacto.correo || '', theme: 'light' }
});
```

4. In `registerBookingListener`'s `bookingSuccessful` callback, stamp `origen` onto the payload:

```js
estado.resultado = assembleResult(estado, content);
submitLead(origen ? { ...estado.resultado.leadPayload, origen } : estado.resultado.leadPayload);
```

`submitLead` stays defined inside the closure (it was `export`ed before; it is now a local function). Remove the `export` keyword from it.

- [ ] **Step 2: Replace `js/diagnostico.view.js` with the thin industrial entry**

```js
// Arranque de la versión industrial del diagnóstico. Contenido y Cal actuales,
// sin `origen`: runtime idéntico al histórico. Toda la lógica vive en app.js.
import content from './diagnostico.content.js';
import { initDiagnostico } from './diagnostico.app.js';

initDiagnostico({ content, calLink: 'diagnostico/diagnostico-mexillum', origen: undefined });
```

- [ ] **Step 3: Run the full test suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS (same count as before). The engine/content/api/exhaustive tests do not import the view, so they must stay green. If any fail, the move was not faithful — diff against the original view body.

- [ ] **Step 4: Manual smoke check of the existing page**

Run: `python3 -m http.server 4173` then open `http://localhost:4173/diagnostico/`.
Expected: intro → 8 steps → full result renders (Cal area shows the calendar loader). Confirm no console errors at load. (Local note: `/api/lead` won't run under `http.server`; that's expected.)

- [ ] **Step 5: Commit**

```bash
git add js/diagnostico.app.js js/diagnostico.view.js
git commit -m "refactor: extract diagnostic view core into initDiagnostico"
```

---

### Task 2: Add the `origen` marker to `api/lead.js`

Additive change: read `body.origen`, and when present, tag the email subject and body so sales can tell hotel leads apart. Without `origen`, the email is unchanged.

**Files:**
- Modify: `api/lead.js`
- Test: `test/api.lead.test.js`

**Interfaces:**
- Consumes: `body.origen` (string, optional) on the `/api/lead` POST payload.
- Produces: when `origen === 'hoteles'`, the email subject is prefixed `Diagnóstico Hoteles — …` and the body carries an `Origen:` line.

- [ ] **Step 1: Write the failing test**

Add to `test/api.lead.test.js` (it already imports `handler`, `content`, `assembleResult`, and has a `fakeRes()` helper and a way to stub `fetch` — follow the existing test's pattern for building a valid payload and capturing the Resend call body):

```js
test('origen hoteles marca el asunto y el cuerpo del correo', async () => {
  // Reusa el patrón del test existente para armar un payload válido y stubear fetch.
  const { sent } = await runLead({ origen: 'hoteles' }); // helper local del archivo
  assert.match(sent.subject, /^Diagnóstico Hoteles —/);
  assert.match(sent.text, /Origen:\s*hoteles/);
});

test('sin origen el asunto queda como hoy', async () => {
  const { sent } = await runLead({});
  assert.match(sent.subject, /^Diagnóstico —/);
  assert.doesNotMatch(sent.text, /Origen:/);
});
```

If the file has no reusable `runLead` helper, first factor the existing test's setup (build payload, stub `fetch`, call `handler`, parse the captured Resend JSON body into `{ subject, text }`) into one, then write the two asserts above against it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/api.lead.test.js`
Expected: FAIL — subject is `Diagnóstico — …` and no `Origen:` line yet.

- [ ] **Step 3: Implement the marker in `api/lead.js`**

Near the other `clean(...)` reads (after `const rol = clean(body.rol, 60);`):

```js
const origen = clean(body.origen, 40);
```

Change the subject line (currently `const subject = \`Diagnóstico — ${quien}\`;`) to:

```js
const subject = origen === 'hoteles'
  ? `Diagnóstico Hoteles — ${quien}`
  : `Diagnóstico — ${quien}`;
```

In the `text` array (the block that starts `'Nuevo diagnóstico completado'`), add an `Origen` line right after the `Rol:` line:

```js
`Rol:      ${rol || '—'}`,
origen ? `Origen:   ${origen}` : null,
```

(The array is later filtered for falsy entries — confirm it is; the existing code already includes `null` entries like `potencial ? ... : null`, so the filter exists.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/api.lead.test.js`
Expected: PASS (both new tests and all pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add api/lead.js test/api.lead.test.js
git commit -m "feat(lead): mark hotel leads with origen in the email"
```

---

### Task 3: Create the hotel content (`js/diagnostico.hoteles.content.js`)

Author a full hotel-reframed copy of the content object. Same structure and same keys as `js/diagnostico.content.js` (the engine reads a fixed set of fields — see the field list below), hotel copy, and the scoring/sector adjustments specified here.

**Files:**
- Create: `js/diagnostico.hoteles.content.js`
- Test: `test/diagnostico.hoteles.test.js`

**Interfaces:**
- Produces: `export default content` — an object exposing every field the engine reads: `intro, pasos, gate, perfilSector, perfilExposicion, perfilExposicionDefault, scoring, tablaFactura, tablaDemanda, tablaRecorte, tarifaLegible, bloqueB, gancho, palancasCopy, palancasRespaldoVariantes, palancaFactorPotencia, datoFaltante, datoFaltantePorOportunidad, datoFaltanteCorte, datoFaltanteDefault, cierreComun, financiamiento, financiamientoDefault, checklistBase, checklistRefuerzos, checklistViabilidad, checklistUniversal, checklistTitulo, checklistPie, recomendaciones, limitaciones, anteproyectoTitulo, anteproyectoTituloLead, anteproyecto, resumen, resultado, progresoLabel`. Plus a new `plantaLabel: 'tu propiedad'` string.

**Authoring rules (apply to every text field):**
- Keep **all keys** exactly as in the industrial content. The engine indexes them by name.
- Reword values into hotel-operator language. Preferred terms: llaves, ocupación, temporada alta/baja, climatización, chillers/manejadoras, cuartos fríos, cadena de frío, lavandería, cocina/F&B, alberca climatizada, spa, PMS, elevadores, áreas comunes, factor de potencia, huracanes, punta de CFE, RFP de solar, huésped/reseñas.
- Replace industrial words: "planta"→"propiedad/hotel", "operación industrial"→"operación hotelera", "producción/lote"→"servicio/cadena de frío", "empresas"→"hoteles/propiedades".

- [ ] **Step 1: Write the failing smoke test**

Create `test/diagnostico.hoteles.test.js`. It imports only the node-safe modules (content + engine — never the view, which touches `document`):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.hoteles.content.js';
import { assembleResult } from '../js/diagnostico.engine.js';

const CODES = {
  sector: ['allinclusive', 'resort', 'boutique', 'urbano', 'desarrollo'],
  perfil: ['plano', 'diurno', 'picos', 'punta', 'nolose'],
  generacion: ['solar_sitio', 'contrato', 'no', 'evaluando'],
  calidad: ['factor', 'variaciones', 'cortes', 'no', 'nolose'],
  tarifa: ['gdmth', 'gdmto', 'dist', 'gdbt', 'pdbt', 'nolose', 'privado'],
  factura: ['bajo', 'medio', 'alto', 'muyalto', 'nolose'],
  corte: ['producto', 'reinicio', 'servicio', 'nada']
};

// El content de hoteles respeta el contrato del engine: los códigos de cada paso
// existen y assembleResult corre sin lanzar para personas tipo.
test('los códigos de las opciones coinciden con el set esperado', () => {
  const byKey = Object.fromEntries(content.pasos.map((p) => [p.key, p.opciones.map((o) => o.codigo)]));
  for (const [key, esperados] of Object.entries(CODES)) {
    assert.deepEqual(byKey[key].sort(), [...esperados].sort(), `códigos de ${key}`);
  }
  assert.equal(content.plantaLabel, 'tu propiedad');
});

test('assembleResult corre para un gran resort all-inclusive', () => {
  const estado = { respuestas: { sector: 'allinclusive', perfil: 'plano', generacion: 'no', calidad: 'cortes', tarifa: 'gdmth', factura: 'muyalto', corte: 'servicio', disparador: ['costo'] }, contacto: {} };
  const res = assembleResult(estado, content);
  assert.ok(res.perfil && res.recomendacion_solucion?.tipo);
  assert.ok(res.checklist.full.length > 0);
  assert.ok(Array.isArray(res.leadPayload?.checklist_full));
});

test('assembleResult corre para un boutique evaluando solar', () => {
  const estado = { respuestas: { sector: 'boutique', perfil: 'diurno', generacion: 'evaluando', calidad: 'no', tarifa: 'gdmto', factura: 'medio', corte: 'nada', disparador: ['costo'] }, contacto: {} };
  const res = assembleResult(estado, content);
  assert.ok(res.recomendacion_solucion?.tipo);
  assert.ok(res.palancas?.principal?.nombre);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/diagnostico.hoteles.test.js`
Expected: FAIL — `Cannot find module '../js/diagnostico.hoteles.content.js'`.

- [ ] **Step 3: Create the content file — start from a copy, then apply the changes below**

Copy `js/diagnostico.content.js` to `js/diagnostico.hoteles.content.js` as the starting point, then make these concrete changes. Everything not listed is a same-key reword per the Authoring rules.

**3a. `intro`** — hotel framing, keep keys `titulo, cuerpo, pie, cta`. Example:
```js
intro: {
  titulo: 'Diagnóstico energético para tu hotel en 2 minutos',
  cuerpo: 'Ocho preguntas sobre tu propiedad —climatización, ocupación, tarifa CFE—. Al final ves qué oportunidades de ahorro aplican a tu hotel, cuál atacar primero y, cuando tu tarifa lo permite, un orden de magnitud de lo que hay en juego, además de qué datos preparar para volverlo un número exacto.',
  pie: 'Sin costo y sin formulario: el diagnóstico aparece completo al terminar. Tus datos solo si quieres agendar la llamada.',
  cta: 'Empezar'
},
```

**3b. Add `plantaLabel`** (new key, anywhere top-level): `plantaLabel: 'tu propiedad',`

**3c. `pasos`** — the 8 approved questions. Keep each `key` and `notaLabel` structure; `disparador` keeps `multi: true` and the exclusive `costo`. Use these exact codes (they must match the smoke test):
- `sector` codes: `allinclusive, resort, boutique, urbano, desarrollo` — labels:
  - allinclusive: `Gran resort all-inclusive — 500+ llaves, F&B, spa y amenidades todo el día`
  - resort: `Resort de playa — 150–500 llaves, ocupación marcada por temporada`
  - boutique: `Hotel boutique / lifestyle — menos de 150 llaves, alto servicio por llave`
  - urbano: `Hotel urbano o de negocios — ocupación entre semana, salones y eventos`
  - desarrollo: `Propiedad en desarrollo o expansión — nuevas torres o llaves por venir`
- `perfil` codes `plano, diurno, picos, punta, nolose` — labels:
  - plano: `Climatización pareja 24/7: chillers y manejadoras nunca paran`
  - diurno: `Sube de día y en check-in/check-out, baja de madrugada`
  - picos: `Picos fuertes al mediodía y en el servicio de cocina (calor + F&B juntos)`
  - punta: `Se concentra en el horario punta de CFE (tarde-noche: alberca climatizada, cena, iluminación)`
  - nolose: `No lo tengo claro`
  - keep `hint: 'Piensa en climatización, cuartos fríos y lavandería — no necesitas números.'`
- `generacion` codes `solar_sitio, contrato, no, evaluando` (drop the industrial `estacional` option):
  - solar_sitio: `Sí — paneles solares en techos o áreas comunes (detrás del medidor)`
  - contrato: `Tenemos contrato de suministro renovable / calificado`
  - no: `No, compramos todo a CFE o a un suministrador`
  - evaluando: `Lo estamos evaluando (RFP de solar en curso)`
- `calidad` codes `factor, variaciones, cortes, no, nolose`:
  - factor: `Sí — CFE nos penaliza por bajo factor de potencia en el recibo`
  - variaciones: `Sí — variaciones de voltaje que dañan equipo sensible (elevadores, cómputo, cocina, domótica)`
  - cortes: `Sí — microcortes o interrupciones de CFE (y temporada de huracanes)`
  - no: `No, el suministro es estable`
  - nolose: `No lo sé`
- `tarifa` — unchanged codes/labels (`gdmth, gdmto, dist, gdbt, pdbt, nolose, privado`). Reword the prompt to use `{planta}`: `Busca el recibo de CFE de {planta}. Arriba a la derecha hay un código de tarifa — ¿cuál es?`
- `factura` — unchanged codes/ranges (`bajo, medio, alto, muyalto, nolose`). Prompt: `De {planta}: ¿cuánto paga de electricidad al mes?`
- `corte` codes `producto, reinicio, servicio, nada`. Prompt: `Si {planta} pierde energía 30 minutos en alta ocupación, ¿qué pasa?`
  - producto: `Cocina y cadena de frío en riesgo: merma y tema de sanidad`
  - reinicio: `Se detiene la operación y recuperarla toma tiempo (bombeo, PMS, sistemas)`
  - servicio: `Perdemos ingresos y experiencia del huésped por hora (clima, elevadores, eventos, reseñas)`
  - nada: `Incomoda, pero no cuesta dinero relevante`
- `disparador` (multi) codes `capacidad, diesel, excedente, aislado, costo` (costo exclusiva):
  - capacidad: `Queremos sumar llaves, torres o amenidades y CFE no da capacidad (o tarda)`
  - diesel: `Usamos planta de diésel de emergencia con frecuencia`
  - excedente: `Tenemos (o tendremos) solar y desperdiciamos excedente`
  - aislado: `Operamos aislados de CFE, o queremos hacerlo (propiedad remota / eco-resort)`
  - costo: `Ninguna: nuestro tema es puramente bajar el costo de energía` (keep `exclusiva: true`)

**3d. `perfilSector`** — remap to hotel codes:
```js
perfilSector: {
  allinclusive: 'gran resort all-inclusive', resort: 'resort de playa',
  boutique: 'hotel boutique', urbano: 'hotel urbano', desarrollo: 'propiedad en expansión'
},
```

**3e. `perfilExposicion`** — replace industrial sector/estacional rules:
```js
perfilExposicion: [
  { when: { sector: 'allinclusive' }, text: 'con climatización 24/7 y exposición estructural a horario punta' },
  { when: { disparador: 'capacidad' }, text: 'con restricción de capacidad para crecer' },
  { when: { disparador: 'diesel' }, text: 'con dependencia de diésel de respaldo' }
],
perfilExposicionDefault: 'con exposición a cargo por demanda',
```

**3f. `scoring.pesos` — replace every `sector: {...}` map with hotel codes** (all other sub-keys of `pesos` stay as in the industrial file):
```js
peak_shaving.sector: { allinclusive: 7, resort: 5, urbano: 4, boutique: 2, desarrollo: 0 }
arbitraje.sector:    { allinclusive: 14, resort: 8 }
bess_solar.sector:   { resort: 6, allinclusive: 6, urbano: 4, desarrollo: 6 }
respaldo.sector:     { allinclusive: 12, boutique: 10, resort: 8, urbano: 6 }
diferimiento.sector: { desarrollo: 26 }
```

**3g. Respaldo bump** (guest-facing outage weighs more) — in `scoring.pesos.respaldo`, change:
```js
corte: { producto: 52, reinicio: 42, servicio: 46, nada: 0 },   // servicio 40 → 46
calidad: { cortes: 24, variaciones: 14 },                       // cortes 20 → 24
```
Leave `boosts`, `caps`, `umbral*`, `escalaPotencial`, `tarifasCuantificables`, and `aplicacionPrincipal` **unchanged** (they reference perfil/tarifa/disparador/corte codes that are all preserved; the `sector: 'ev'`/`'publico'` references disappear only from `pesos`, which we rewrote).

**3h. `financiamiento`** — replace industrial sector rules (`publico`, `ev`) with hotel ones; keep the `factura: 'muyalto'` rule and the default:
```js
financiamiento: [
  { when: { sector: 'desarrollo' }, text: 'En una propiedad en desarrollo, el sistema puede entrar como parte del CAPEX de obra o como esquema de servicio sin inversión inicial (PPA / Energy Storage as a Service), sujeto a evaluación de viabilidad. Vemos cuál encaja con tu plan de obra en la llamada.' },
  { when: { factura: 'muyalto' }, text: 'A tu escala, la pregunta no suele ser si hay capital, sino dónde rinde mejor. Nuestros proyectos pueden estructurarse como inversión propia o como esquema de servicio que mantiene el activo fuera de tu balance —esto último sujeto a evaluación de viabilidad. Definimos cuál encaja con tu política de capital.' }
],
```
Keep `financiamientoDefault` (reword lightly: "instalación"→"propiedad").

**3i. `checklistViabilidad`** — keep both keys `publico` and `privado` (the engine defaults to `privado` for non-`publico` sectors, so hotels always get `privado`). Reword `privado` for hotels (perfil de la propiedad/grupo hotelero para el esquema sin inversión). `publico` can stay hotel-neutral (it will not be reached).

**3j. Reword remaining text fields** per Authoring rules, keeping keys: `bloqueB` (all sub-keys, incl. `sinRangoPorAplicacion.*`, `continuoExtra`→hotel 24/7 wording), `gancho`, `palancasCopy.*` (every opportunity's `nombre/principal/menor/descarte`), `palancasRespaldoVariantes`, `palancaFactorPotencia`, `datoFaltante*`, `cierreComun`, `checklistBase`, `checklistRefuerzos`, `checklistUniversal`, `checklistTitulo`, `checklistPie`, `recomendaciones.*`, `limitaciones.*`, `anteproyecto.*` (base/solar/bess/off_grid, both `interno` and `lead`), `anteproyectoTitulo`, `anteproyectoTituloLead`, `resumen.*` (keep `bessGlosa`), `resultado.reiniciar`, `progresoLabel`. Keep `tablaFactura`, `tablaDemanda`, `tablaRecorte`, `tarifaLegible` numeric/label values **unchanged**.

- [ ] **Step 4: Run the smoke test to verify it passes**

Run: `node --test test/diagnostico.hoteles.test.js`
Expected: PASS. If the codes test fails, align the `pasos` codes with `CODES`. If `assembleResult` throws, a referenced key is missing — cross-check against the Interfaces field list.

- [ ] **Step 5: Run the full suite (guard the industrial content)**

Run: `npm test`
Expected: PASS — the industrial `test/diagnostico.*` tests still pass (they import `diagnostico.content.js`, untouched).

- [ ] **Step 6: Commit**

```bash
git add js/diagnostico.hoteles.content.js test/diagnostico.hoteles.test.js
git commit -m "feat(hoteles): hotel-reframed diagnostic content + scoring"
```

---

### Task 4: Create the hotel page and entry (`/diagnostico-hoteles`)

Add the hotel entry module and the page that loads it. Reuses the existing CSS and the shared core.

**Files:**
- Create: `js/diagnostico.hoteles.view.js`
- Create: `diagnostico-hoteles/index.html`

**Interfaces:**
- Consumes: `initDiagnostico` (Task 1) and the hotel content (Task 3).

- [ ] **Step 1: Create the hotel entry `js/diagnostico.hoteles.view.js`**

```js
// Arranque de la versión de hoteles. Reusa el núcleo con contenido hotelero,
// su propio evento de Cal y el marcador de lead `hoteles`.
import content from './diagnostico.hoteles.content.js';
import { initDiagnostico } from './diagnostico.app.js';

initDiagnostico({ content, calLink: 'diagnostico/diagnostico-hoteles', origen: 'hoteles' });
```

- [ ] **Step 2: Create `diagnostico-hoteles/index.html`**

Copy `diagnostico/index.html` and change only: the `<title>`, `<meta name="description">`, `<link rel="canonical">`, the `og:url`/`og:title`/`og:description`/`og:image:alt`, the `twitter:*` equivalents, and the script `src`. Keep the same header/footer, CSS links (`../css/...`), and `#dx-root`.

- `<title>`: `Diagnóstico energético para hoteles — Mexillum`
- `<meta name="description">`: `Ocho preguntas sobre tu hotel: qué oportunidades de ahorro de energía aplican a tu propiedad, cuál atacar primero y un orden de magnitud. Sin costo y sin formulario.`
- `<link rel="canonical" href="https://www.mexillum.com/diagnostico-hoteles">`
- `og:url`: `https://www.mexillum.com/diagnostico-hoteles`
- `og:title` / `twitter:title`: `¿Cuánto de la factura de CFE de tu hotel es evitable?`
- `og:description` / `twitter:description`: `Diagnóstico energético para hoteles en 2 minutos. Ocho preguntas y ves qué oportunidades de ahorro aplican a tu propiedad. Sin costo y sin formulario.`
- `og:image` / `twitter:image`: keep `https://www.mexillum.com/assets/og-diagnostico.png` (reuse existing image; a hotel-specific OG image is out of scope).
- `og:image:alt`: `Mexillum — Diagnóstico energético para hoteles de la Riviera Maya.`
- Script tag: `<script type="module" src="../js/diagnostico.hoteles.view.js"></script>`

- [ ] **Step 3: Manual end-to-end check**

Run: `python3 -m http.server 4173` then open `http://localhost:4173/diagnostico-hoteles/`.
Expected: intro shows hotel copy → all 8 hotel questions render (incl. multi-select on step 8) → full result renders with hotel wording → Cal area attempts to load `diagnostico/diagnostico-hoteles`. No console errors at load. (Cal will only show the calendar once the user creates that event in `cal.mexillum.com`; the loader/empty state is expected until then.)

- [ ] **Step 4: Confirm the existing page is still intact**

Open `http://localhost:4173/diagnostico/`.
Expected: unchanged industrial diagnostic, industrial Cal link.

- [ ] **Step 5: Commit**

```bash
git add js/diagnostico.hoteles.view.js diagnostico-hoteles/index.html
git commit -m "feat(hoteles): /diagnostico-hoteles page + entry"
```

---

## Self-Review

**Spec coverage:**
- New URL `/diagnostico-hoteles` → Task 4 (`cleanUrls` already serves the folder; no `vercel.json` change, per spec §3).
- Shared core (option A) → Task 1.
- `origen: hoteles` + hotel Cal event → Task 1 (payload + calLink) and Task 2 (email).
- Hotel questions + result copy + scoring tweaks → Task 3.
- `plantaLabel: 'tu propiedad'` → Task 1 (fallback) + Task 3 (value).
- Engine unchanged → honored (Task 3 works within the fixed field contract; the `sector==='continuo'/'publico'` couplings in `buildChecklist` are covered by fallbacks — noted in Task 3 §3i).
- Light hotel smoke test → Task 3.
- Manual verification of both pages → Tasks 1 and 4.

**Placeholder scan:** No "TBD"/"handle edge cases" left. The content-copy fields in Task 3 §3j are a bounded reword-in-place list (keys enumerated, terms given, examples in §3a/§3c), not open-ended work.

**Type consistency:** `initDiagnostico({ content, calLink, origen })` is defined in Task 1 and consumed identically in Task 1 (industrial) and Task 4 (hotel). `origen` string flows Task 4 → payload (Task 1) → `body.origen` (Task 2). Sector codes `allinclusive/resort/boutique/urbano/desarrollo` are consistent across Task 3 §3c/§3d/§3e/§3f and the Task 3 smoke test `CODES`.

## Out of Scope
- Per-chain versions, rebrand, new visual design, English translation, hotel-specific OG image (spec §10).
- Creating the Cal event `diagnostico/diagnostico-hoteles` (user action, spec §7).
