# Funnel de diagnóstico (front-end) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el funnel de diagnóstico de Mexillum como una página estática que califica al visitante en 6 pasos, arma un diagnóstico de 3 capas + checklist, y muestra una pantalla de resultado — todo en front-end, con el envío del lead como costura (`console.log`).

**Architecture:** Tres módulos ES: `diagnostico.content.js` (todo el copy y las reglas como datos), `diagnostico.engine.js` (funciones puras, sin DOM, testeables en Node), y `diagnostico.view.js` (único módulo que toca el DOM). El motor lee prioridades y condiciones desde los datos; las condiciones del PRD son todas de igualdad simple (`campo == valor`), así que se representan como datos `{ campo: valor }`.

**Tech Stack:** HTML + CSS + JS vanilla (ESM), sin framework ni build. Tests con `node --test` (built-in, sin dependencias nuevas). Design system existente (`css/tokens.css`, `css/components.css`, componentes `mx-*`). Hosting Vercel.

## Global Constraints

- **Sin dependencias npm nuevas.** Único runner de tests: `node --test` (built-in de Node 18+).
- **ESM en todo el código nuevo** (`export`/`import`). Se agrega `package.json` con `"type": "module"`.
- **Solo componentes `mx-*` y tokens existentes.** Sin sistema de estilos paralelo. Clases disponibles: `mx-btn`, `mx-btn--primary|secondary|ghost|lg|block`, `mx-card`, `mx-card--interactive|pad-lg|rule-top`, `mx-check`, `mx-check__box`, `mx-check__box--radio`, `mx-check__box--on`, `mx-check__dot`, `mx-field`, `mx-field__label`, `mx-field__error`, `mx-input`, `mx-input--invalid`.
- **Copy en español, verbatim del PRD/spec.** Sin jerga técnica (nada de "arbitraje horario", "peak shaving", "factor de carga") en labels, aria o placeholders.
- **Mobile-first**; respetar `prefers-reduced-motion`; completable en `<2 min`.
- **`submitLead(payload)` en v1 solo hace `console.log`.** `booking_agendado` siempre `false`, `booking_datetime` ausente.
- **Honeypot `website`** en el gate (mismo patrón que `js/main.js`).
- **Label de botón Capa C corregido** (spec §4.1): industrial/comercial/ev → "Quiero agendar mi diagnóstico"; publico → "Quiero agendar una conversación".

---

## File Structure

- `package.json` — nuevo. `"type": "module"`, script `test`.
- `diagnostico/index.html` — nueva página. Shell con `<div id="dx-root">` y los tres `<script type="module">`.
- `css/diagnostico.css` — nuevo. Estilos del funnel sobre tokens/components.
- `js/diagnostico.content.js` — nuevo. Datos: pasos, reglas A/B, capa C, checklist, textos.
- `js/diagnostico.engine.js` — nuevo. Funciones puras del motor.
- `js/diagnostico.view.js` — nuevo. Render, navegación, gate, resultado, `submitLead`.
- `test/diagnostico.content.test.js` — nuevo. Validación estructural del content.
- `test/diagnostico.engine.test.js` — nuevo. Tests del motor.

---

## Task 1: Scaffolding + módulo de contenido

**Files:**
- Create: `package.json`
- Create: `js/diagnostico.content.js`
- Test: `test/diagnostico.content.test.js`

**Interfaces:**
- Produces: `js/diagnostico.content.js` default export `content` con las claves: `pasos[]` (cada uno `{ key, pregunta, opciones:[{label,codigo}] }`), `reglasA[]` (`{id, when:{campo:valor}, text}`), `reglasB[]` (`{id, when, text}`), `capaC` (`{ [tipo]: {texto, ctaText} }`), `checklistBase` (`{ [archetypeId]: string[] }`), `checklistRefuerzos[]` (`{id, when, bullet}`), `checklistUniversal` (string), `checklistTitulo`, `checklistPie`, `gate` (`{ intro:string[], campos:[{name,label,required,type,autocomplete}] }`), `resultado` (`{ reiniciar:string }`), `progresoLabel(n,total)`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "mexillum-web",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Create `js/diagnostico.content.js`**

```js
// Todo el copy y las reglas del funnel, como datos. Cambiar contenido o reordenar
// prioridades = editar este archivo. Sin lógica: engine.js lee de acá.
// Copy cerrado del PRD v1.0 (§4–§7), con el label de Capa C corregido (spec §4.1).

const content = {
  pasos: [
    {
      key: 'tipo_instalacion',
      pregunta: '¿Cómo describirías tu operación?',
      opciones: [
        { label: 'Planta industrial o manufactura', codigo: 'industrial' },
        { label: 'Comercial, institucional o edificio corporativo', codigo: 'comercial' },
        { label: 'Entidad pública (transporte, agua, municipio)', codigo: 'publico' },
        { label: 'Estación de carga para flotas eléctricas', codigo: 'ev' }
      ]
    },
    {
      key: 'generacion_propia',
      pregunta: '¿Ya generan o contratan energía renovable hoy?',
      opciones: [
        { label: 'No, todo nuestro suministro es de CFE', codigo: 'ninguna' },
        { label: 'Sí, tenemos paneles solares o generación propia en sitio', codigo: 'fisica' },
        { label: 'Sí, pero es un contrato o certificado con un proveedor (no generamos físicamente)', codigo: 'certificada' },
        { label: 'Depende de la temporada (ej. generamos con biomasa o cogeneración parte del año)', codigo: 'estacional' }
      ]
    },
    {
      key: 'patron_operacion',
      pregunta: '¿Tu operación se detiene en algún momento, o corre todo el día, todos los días?',
      opciones: [
        { label: 'Corre 24/7, sin pausas', codigo: 'continuo' },
        { label: 'Tiene picos marcados por turno, proceso o temporada', codigo: 'picos' },
        { label: 'Es intermitente — varía mucho según el día o la hora', codigo: 'intermitente' }
      ]
    },
    {
      key: 'interrupciones',
      pregunta: 'En el último año, ¿un corte o falla eléctrica les afectó producción, producto o servicio?',
      opciones: [
        { label: 'Sí, y sabemos cuánto nos costó', codigo: 'si_medido' },
        { label: 'Sí, pero nunca lo medimos', codigo: 'si_no_medido' },
        { label: 'No que sepamos', codigo: 'no' },
        { label: 'No aplica a nuestra operación', codigo: 'no_aplica' }
      ]
    },
    {
      key: 'diesel_red_debil',
      pregunta: '¿Alguna parte de tu operación depende de diésel, o está en una zona con suministro eléctrico poco confiable?',
      opciones: [
        { label: 'Sí', codigo: 'si' },
        { label: 'No', codigo: 'no' },
        { label: 'No estoy seguro', codigo: 'no_seguro' }
      ]
    },
    {
      key: 'exporta_excedente',
      pregunta: '¿Generan energía propia y les sobra — la venden o la exportan a la red?',
      opciones: [
        { label: 'Sí', codigo: 'si' },
        { label: 'No', codigo: 'no' },
        { label: 'No aplica', codigo: 'no_aplica' }
      ]
    }
  ],

  // Capa A — prioridad = orden del array. Primera que matchea gana. (§6.1)
  reglasA: [
    { id: 'estacional', when: { generacion_propia: 'estacional' }, text: 'Tu generación cubre parte del año. Te ayudamos a cubrir el resto — con la ventaja de que ese periodo suele coincidir con mayor disponibilidad de sol.' },
    { id: 'fisica', when: { generacion_propia: 'fisica' }, text: 'Ya generás tu propia energía. Te ayudamos a aprovechar cada kWh — en vez de perder lo que generás cuando no coincide con lo que necesitás.' },
    { id: 'continuo', when: { patron_operacion: 'continuo' }, text: 'Tu operación no se detiene, así que compra energía en el horario más caro todos los días sin poder evitarlo. Podemos cambiar eso.' },
    { id: 'picos', when: { patron_operacion: 'picos' }, text: 'La mayoría de las operaciones paga de más por unos minutos al mes — su momento de mayor consumo. Vale la pena revisar si ese es tu caso.' },
    { id: 'intermitente', when: { patron_operacion: 'intermitente' }, text: 'Tu consumo es variable, lo que suele esconder picos que encarecen toda tu factura sin que se note en el día a día.' }
  ],

  // Capa B — refuerzo, máximo 1. Prioridad = orden. (§6.2)
  reglasB: [
    { id: 'diesel', when: { diesel_red_debil: 'si' }, text: 'Además, sustituir diésel por almacenamiento no solo es más limpio — suele ser bastante más barato por hora operada.' },
    { id: 'int_medido', when: { interrupciones: 'si_medido' }, text: 'Y ya tenés el dato más difícil de conseguir: cuánto te cuesta cuando falla la energía. Ese número es el que arma el proyecto.' },
    { id: 'int_no_medido', when: { interrupciones: 'si_no_medido' }, text: 'Ese tipo de interrupciones casi nunca se mide — y suele ser más caro de lo que parece. Es de las primeras cosas que podemos ayudarte a cuantificar.' },
    { id: 'exporta', when: { exporta_excedente: 'si' }, text: 'Y si ya exportás excedente, hay margen para que valga más según a qué hora lo vendés.' }
  ],

  // Capa C — cierre por segmento. ctaText ya corregido (spec §4.1). (§6.3)
  capaC: {
    industrial: { texto: 'Protegé tu margen operativo y reducí tu exposición eléctrica — sin inversión de capital inicial.', ctaText: 'Quiero agendar mi diagnóstico' },
    comercial: { texto: 'Reducí tu costo energético y la exposición de tu operación a fallas eléctricas — sin desembolso inicial.', ctaText: 'Quiero agendar mi diagnóstico' },
    publico: { texto: 'Cero inversión, cero deuda, cero riesgo — protegé la continuidad de tu servicio sin comprometer presupuesto.', ctaText: 'Quiero agendar una conversación' },
    ev: { texto: 'Evitá esperar meses (o años) para ampliar tu capacidad eléctrica — y controlá el costo de tus picos de carga rápida.', ctaText: 'Quiero agendar mi diagnóstico' }
  },

  // Checklist base — keyed por id de reglasA (mismo selector de prioridad). (§7.1)
  checklistBase: {
    estacional: [
      'Fechas de tu temporada alta y temporada baja',
      'Recibos de CFE de la temporada baja (si los tenés a mano)'
    ],
    fisica: [
      'Capacidad instalada y fecha en que empezó a operar',
      'Una idea de cuánta energía generada no se está aprovechando (aunque sea aproximada)'
    ],
    continuo: [
      'Recibos de CFE con desglose por horario, si tu factura lo muestra',
      'Tu tarifa aplicable, si la conocés (por ejemplo GDMTH o DIST)',
      'Si hay algo de tu consumo que sí podrías mover de horario'
    ],
    picos: [
      'Tus últimos recibos de CFE (6–12 meses)',
      'Algún registro de consumo por intervalos de 15 minutos, si lo tenés (aunque sea de un mes)',
      'A qué hora o en qué proceso ocurre tu momento de mayor consumo'
    ],
    intermitente: [
      'Tus últimos recibos de CFE (6–12 meses)',
      'Qué días o meses tienden a ser los de mayor consumo'
    ]
  },

  // Refuerzos del checklist — prioridad = orden. Mismas condiciones que Capa B. (§7.2)
  checklistRefuerzos: [
    { id: 'diesel', when: { diesel_red_debil: 'si' }, bullet: 'Cuántas horas al año corre tu respaldo de diésel y costo aproximado' },
    { id: 'int_medido', when: { interrupciones: 'si_medido' }, bullet: 'El registro que ya tenés de esos eventos: cuántos y qué costaron' },
    { id: 'int_no_medido', when: { interrupciones: 'si_no_medido' }, bullet: 'Una estimación aproximada — no hace falta precisión, con "más o menos X veces el año pasado" alcanza' },
    { id: 'exporta', when: { exporta_excedente: 'si' }, bullet: 'Cómo vendés ese excedente hoy: contrato, tarifa y a quién' }
  ],

  checklistUniversal: 'Quién en tu organización tomaría la decisión de un proyecto así', // §7.3
  checklistTitulo: 'Antes de tu llamada, te sirve tener a mano:', // §7.5
  checklistPie: 'No hace falta tenerlo todo listo — con lo que tengas alcanza para empezar.', // §7.5

  gate: {
    intro: [
      'Con base en tus respuestas, identificamos una oportunidad relevante para proteger tu operación y reducir tu exposición eléctrica — sin inversión de capital inicial.',
      'Déjanos tus datos y te enviamos el diagnóstico completo.'
    ],
    campos: [
      { name: 'nombre', label: 'Nombre', required: true, type: 'text', autocomplete: 'name' },
      { name: 'empresa', label: 'Empresa', required: true, type: 'text', autocomplete: 'organization' },
      { name: 'correo', label: 'Correo', required: true, type: 'email', autocomplete: 'email' },
      { name: 'telefono', label: 'Teléfono (opcional)', required: false, type: 'tel', autocomplete: 'tel' },
      { name: 'cargo', label: 'Cargo (opcional)', required: false, type: 'text', autocomplete: 'organization-title' }
    ]
  },

  resultado: { reiniciar: 'Reiniciar diagnóstico' },
  progresoLabel: (n, total) => `Paso ${n} de ${total}`
};

export default content;
```

- [ ] **Step 3: Write structural test `test/diagnostico.content.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';

test('hay 6 pasos con keys esperadas', () => {
  const keys = content.pasos.map((p) => p.key);
  assert.deepEqual(keys, [
    'tipo_instalacion', 'generacion_propia', 'patron_operacion',
    'interrupciones', 'diesel_red_debil', 'exporta_excedente'
  ]);
});

test('los códigos de opción son únicos dentro de cada paso', () => {
  for (const p of content.pasos) {
    const codigos = p.opciones.map((o) => o.codigo);
    assert.equal(new Set(codigos).size, codigos.length, `duplicado en ${p.key}`);
  }
});

test('cada id de reglasA tiene su bloque en checklistBase', () => {
  for (const r of content.reglasA) {
    assert.ok(content.checklistBase[r.id], `falta checklistBase para ${r.id}`);
  }
});

test('capaC cubre los 4 tipos de instalación', () => {
  for (const t of ['industrial', 'comercial', 'publico', 'ev']) {
    assert.ok(content.capaC[t]?.texto, `falta capaC.${t}.texto`);
    assert.ok(content.capaC[t]?.ctaText, `falta capaC.${t}.ctaText`);
  }
});

test('los ctaText de industrial/comercial/ev usan el copy corregido', () => {
  for (const t of ['industrial', 'comercial', 'ev']) {
    assert.equal(content.capaC[t].ctaText, 'Quiero agendar mi diagnóstico');
  }
  assert.equal(content.capaC.publico.ctaText, 'Quiero agendar una conversación');
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/diagnostico.content.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add package.json js/diagnostico.content.js test/diagnostico.content.test.js
git commit -m "feat(diagnostico): content config module + structural tests"
```

---

## Task 2: Motor — selección de capas A/B/C

**Files:**
- Create: `js/diagnostico.engine.js`
- Test: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: `content` (Task 1).
- Produces: named exports en `js/diagnostico.engine.js`:
  - `resolveBaseArchetype(resp, content) → { id, text }` — primera regla de `reglasA` que matchea (prioridad = orden). Base compartida por Capa A y checklist.
  - `pickLayerB(resp, content) → { id, text } | null` — primera regla de `reglasB` que matchea, o `null`.
  - `pickLayerC(resp, content) → { texto, ctaText }` — por `resp.tipo_instalacion`.

**Nota de diseño (§6.1):** los conjuntos de condiciones de Capa A (`generacion_propia`, `patron_operacion`) y Capa B (`diesel_red_debil`, `interrupciones`, `exporta_excedente`) son **disjuntos**. Por eso, cuando `generacion_propia` dispara la Capa A, la insight de `patron_operacion` simplemente no vuelve a aparecer en B (la tabla B no tiene reglas de `patron_operacion`). No hace falta "excluir lo usado en A": no hay solape posible.

- [ ] **Step 1: Write failing tests `test/diagnostico.engine.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';
import {
  resolveBaseArchetype, pickLayerB, pickLayerC
} from '../js/diagnostico.engine.js';

// respuesta base "neutra" que no dispara refuerzos ni generación
const neutra = {
  tipo_instalacion: 'industrial',
  generacion_propia: 'ninguna',
  patron_operacion: 'intermitente',
  interrupciones: 'no',
  diesel_red_debil: 'no',
  exporta_excedente: 'no'
};

test('Capa A: estacional tiene prioridad sobre patron_operacion', () => {
  const r = { ...neutra, generacion_propia: 'estacional', patron_operacion: 'continuo' };
  assert.equal(resolveBaseArchetype(r, content).id, 'estacional');
});

test('Capa A: fisica tiene prioridad sobre patron_operacion', () => {
  const r = { ...neutra, generacion_propia: 'fisica', patron_operacion: 'picos' };
  assert.equal(resolveBaseArchetype(r, content).id, 'fisica');
});

test('Capa A: sin generación relevante, decide patron_operacion', () => {
  assert.equal(resolveBaseArchetype({ ...neutra, patron_operacion: 'continuo' }, content).id, 'continuo');
  assert.equal(resolveBaseArchetype({ ...neutra, patron_operacion: 'picos' }, content).id, 'picos');
  assert.equal(resolveBaseArchetype({ ...neutra, patron_operacion: 'intermitente' }, content).id, 'intermitente');
});

test('Capa A: generacion certificada cae al patron (no matchea A1/A2)', () => {
  const r = { ...neutra, generacion_propia: 'certificada', patron_operacion: 'picos' };
  assert.equal(resolveBaseArchetype(r, content).id, 'picos');
});

test('Capa B: diesel gana por prioridad sobre interrupciones', () => {
  const r = { ...neutra, diesel_red_debil: 'si', interrupciones: 'si_medido' };
  assert.equal(pickLayerB(r, content).id, 'diesel');
});

test('Capa B: sin diesel, gana interrupciones medido', () => {
  const r = { ...neutra, interrupciones: 'si_medido', exporta_excedente: 'si' };
  assert.equal(pickLayerB(r, content).id, 'int_medido');
});

test('Capa B: null cuando ninguna condición aplica', () => {
  assert.equal(pickLayerB(neutra, content), null);
});

test('Capa C: devuelve texto y ctaText por tipo', () => {
  const c = pickLayerC({ ...neutra, tipo_instalacion: 'publico' }, content);
  assert.equal(c.ctaText, 'Quiero agendar una conversación');
  assert.ok(c.texto.includes('continuidad'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/diagnostico.engine.test.js`
Expected: FAIL — `Cannot find module '../js/diagnostico.engine.js'` / exports undefined.

- [ ] **Step 3: Write `js/diagnostico.engine.js`**

```js
// Motor de reglas del funnel. Funciones puras, sin DOM. Importable en navegador
// y en Node (tests). Lee prioridades y condiciones desde content.js.

// ¿La respuesta cumple todas las igualdades de `when`?
function matchesWhen(resp, when) {
  return Object.entries(when).every(([campo, valor]) => resp[campo] === valor);
}

// Capa A / base del checklist: primera regla de reglasA que matchea (prioridad = orden).
export function resolveBaseArchetype(resp, content) {
  const regla = content.reglasA.find((r) => matchesWhen(resp, r.when));
  const elegida = regla || content.reglasA[content.reglasA.length - 1]; // fallback defensivo
  return { id: elegida.id, text: elegida.text };
}

// Capa B: primera regla de reglasB que matchea, o null.
export function pickLayerB(resp, content) {
  const regla = content.reglasB.find((r) => matchesWhen(resp, r.when));
  return regla ? { id: regla.id, text: regla.text } : null;
}

// Capa C: cierre por segmento.
export function pickLayerC(resp, content) {
  const c = content.capaC[resp.tipo_instalacion];
  return { texto: c.texto, ctaText: c.ctaText };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/diagnostico.engine.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add js/diagnostico.engine.js test/diagnostico.engine.test.js
git commit -m "feat(diagnostico): engine — layer A/B/C selection"
```

---

## Task 3: Motor — checklist (full + web con recorte a 4)

**Files:**
- Modify: `js/diagnostico.engine.js`
- Test: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: `resolveBaseArchetype`, `matchesWhen` (Task 2).
- Produces: `buildChecklist(resp, content) → { full: string[], web: string[] }`.
  - `full` = base + refuerzos aplicables (orden de prioridad) + universal al final. Sin recorte.
  - `web` = primeros 4 bullets de contenido (base + refuerzos, ya en orden de prioridad) + universal al final. El universal no cuenta contra el tope de 4.

**Nota:** los refuerzos van tras la base en orden de prioridad descendente, así que `slice(0, 4)` conserva la base + los refuerzos de mayor prioridad y descarta los de menor — exactamente la regla de recorte de §7.4 (la base nunca supera 3 bullets).

- [ ] **Step 1: Add failing tests to `test/diagnostico.engine.test.js`**

```js
// (agregar estos imports al bloque de imports existente)
import { buildChecklist } from '../js/diagnostico.engine.js';

test('checklist full: base + refuerzos + universal, sin recorte', () => {
  const r = {
    tipo_instalacion: 'industrial', generacion_propia: 'ninguna', patron_operacion: 'continuo',
    interrupciones: 'si_medido', diesel_red_debil: 'si', exporta_excedente: 'si'
  };
  const { full } = buildChecklist(r, content);
  // base continuo (3) + diesel + int_medido + exporta (3) + universal (1) = 7
  assert.equal(full.length, 7);
  assert.equal(full[full.length - 1], content.checklistUniversal);
});

test('checklist web: recorta a 4 de contenido + universal como 5ª', () => {
  const r = {
    tipo_instalacion: 'industrial', generacion_propia: 'ninguna', patron_operacion: 'continuo',
    interrupciones: 'si_medido', diesel_red_debil: 'si', exporta_excedente: 'si'
  };
  const { web } = buildChecklist(r, content);
  assert.equal(web.length, 5); // 4 contenido + universal
  assert.equal(web[web.length - 1], content.checklistUniversal);
  // conserva la base (3) + el refuerzo de mayor prioridad (diesel), descarta el resto
  assert.ok(web.includes('Cuántas horas al año corre tu respaldo de diésel y costo aproximado'));
  assert.ok(!web.includes('Cómo vendés ese excedente hoy: contrato, tarifa y a quién'));
});

test('checklist web: sin refuerzos, solo base + universal', () => {
  const r = {
    tipo_instalacion: 'industrial', generacion_propia: 'ninguna', patron_operacion: 'intermitente',
    interrupciones: 'no', diesel_red_debil: 'no', exporta_excedente: 'no'
  };
  const { web, full } = buildChecklist(r, content);
  assert.equal(web.length, 3); // base intermitente (2) + universal
  assert.deepEqual(web, full); // sin recorte cuando no se supera el tope
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/diagnostico.engine.test.js`
Expected: FAIL — `buildChecklist is not a function`.

- [ ] **Step 3: Add `buildChecklist` to `js/diagnostico.engine.js`**

```js
// Checklist dinámico. Devuelve versión completa (print/email/nota) y versión web (≤4 + universal).
export function buildChecklist(resp, content) {
  const { id } = resolveBaseArchetype(resp, content);
  const base = content.checklistBase[id];
  const refuerzos = content.checklistRefuerzos
    .filter((r) => matchesWhen(resp, r.when))
    .map((r) => r.bullet);

  const contenido = [...base, ...refuerzos];           // base + refuerzos en orden de prioridad
  const web = contenido.slice(0, 4).concat(content.checklistUniversal);
  const full = contenido.concat(content.checklistUniversal);
  return { full, web };
}
```

Nota: `matchesWhen` ya existe en el archivo (Task 2) pero es privada. Exportála para reuso o mantené `buildChecklist` en el mismo archivo (recomendado — misma unidad). No dupliques la función.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/diagnostico.engine.test.js`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add js/diagnostico.engine.js test/diagnostico.engine.test.js
git commit -m "feat(diagnostico): engine — dynamic checklist (full + web trim)"
```

---

## Task 4: Motor — score, legibles y ensamblado del resultado

**Files:**
- Modify: `js/diagnostico.engine.js`
- Test: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: `resolveBaseArchetype`, `pickLayerB`, `pickLayerC`, `buildChecklist` (Tasks 2–3).
- Produces:
  - `computeScore(resp, bookingAgendado = false) → { valor: number, nivel: 'bajo'|'medio'|'alto' }` (§9.1).
  - `toReadable(resp, content) → { [campo]: string }` — cada código → label visible (§8.1).
  - `assembleResult(estado, content) → { layerA, layerB, layerC, checklist, archetypeBase, reinforcement, score, leadPayload }` (spec §2.3, §3.1).

- [ ] **Step 1: Add failing tests to `test/diagnostico.engine.test.js`**

```js
import { computeScore, toReadable, assembleResult } from '../js/diagnostico.engine.js';

test('score: suma aditiva y nivel', () => {
  // si_medido (+3) + diesel (+2) + exporta (+1) = 6 → alto
  const r = {
    tipo_instalacion: 'industrial', generacion_propia: 'ninguna', patron_operacion: 'continuo',
    interrupciones: 'si_medido', diesel_red_debil: 'si', exporta_excedente: 'si'
  };
  assert.deepEqual(computeScore(r), { valor: 6, nivel: 'alto' });
});

test('score: booking suma +2', () => {
  const r = {
    tipo_instalacion: 'comercial', generacion_propia: 'ninguna', patron_operacion: 'picos',
    interrupciones: 'no', diesel_red_debil: 'no', exporta_excedente: 'no'
  };
  assert.equal(computeScore(r, false).valor, 0);
  assert.equal(computeScore(r, true).valor, 2);
});

test('score: publico suma +1 y niveles de corte', () => {
  const r = {
    tipo_instalacion: 'publico', generacion_propia: 'ninguna', patron_operacion: 'intermitente',
    interrupciones: 'si_no_medido', diesel_red_debil: 'no', exporta_excedente: 'no'
  };
  // publico (+1) + si_no_medido (+1) = 2 → medio
  assert.deepEqual(computeScore(r), { valor: 2, nivel: 'medio' });
});

test('toReadable: códigos → labels visibles', () => {
  const r = {
    tipo_instalacion: 'industrial', generacion_propia: 'estacional', patron_operacion: 'continuo',
    interrupciones: 'si_medido', diesel_red_debil: 'si', exporta_excedente: 'no_aplica'
  };
  const leg = toReadable(r, content);
  assert.equal(leg.tipo_instalacion, 'Planta industrial o manufactura');
  assert.equal(leg.interrupciones, 'Sí, y sabemos cuánto nos costó');
  assert.equal(leg.exporta_excedente, 'No aplica');
});

test('assembleResult: arma resultado completo y leadPayload', () => {
  const estado = {
    respuestas: {
      tipo_instalacion: 'industrial', generacion_propia: 'estacional', patron_operacion: 'continuo',
      interrupciones: 'si_medido', diesel_red_debil: 'si', exporta_excedente: 'no'
    },
    contacto: { nombre: 'Ana', empresa: 'Acme', correo: 'ana@acme.mx', telefono: '', cargo: '' }
  };
  const res = assembleResult(estado, content);
  assert.equal(res.archetypeBase, 'estacional');
  assert.equal(res.reinforcement, 'diesel');       // diesel gana en B
  assert.ok(res.layerA.startsWith('Tu generación cubre'));
  assert.ok(res.layerB.includes('diésel'));
  assert.equal(res.layerC.ctaText, 'Quiero agendar mi diagnóstico');
  assert.equal(res.checklist.web[res.checklist.web.length - 1], content.checklistUniversal);
  assert.equal(res.leadPayload.booking_agendado, false);
  assert.equal(res.leadPayload.empresa, 'Acme');
  assert.equal(res.leadPayload.respuestas_legibles.generacion_propia, 'Depende de la temporada (ej. generamos con biomasa o cogeneración parte del año)');
  assert.equal(res.leadPayload.arquetipo_base, 'estacional');
  assert.equal(typeof res.leadPayload.lead_id, 'string');
  assert.ok(Array.isArray(res.leadPayload.checklist_full));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/diagnostico.engine.test.js`
Expected: FAIL — `computeScore is not a function`.

- [ ] **Step 3: Add functions to `js/diagnostico.engine.js`**

```js
// Score interno (§9.1). No visible al lead.
export function computeScore(resp, bookingAgendado = false) {
  let valor = 0;
  if (resp.interrupciones === 'si_medido') valor += 3;
  if (resp.interrupciones === 'si_no_medido') valor += 1;
  if (resp.diesel_red_debil === 'si') valor += 2;
  if (resp.exporta_excedente === 'si') valor += 1;
  if (resp.tipo_instalacion === 'publico') valor += 1;
  if (bookingAgendado) valor += 2;
  const nivel = valor <= 1 ? 'bajo' : valor <= 4 ? 'medio' : 'alto';
  return { valor, nivel };
}

// Códigos internos → labels visibles (§8.1).
export function toReadable(resp, content) {
  const legibles = {};
  for (const paso of content.pasos) {
    const opcion = paso.opciones.find((o) => o.codigo === resp[paso.key]);
    legibles[paso.key] = opcion ? opcion.label : resp[paso.key];
  }
  return legibles;
}

// Orquesta todo y arma el payload del lead.
export function assembleResult(estado, content) {
  const resp = estado.respuestas;
  const base = resolveBaseArchetype(resp, content);
  const b = pickLayerB(resp, content);
  const c = pickLayerC(resp, content);
  const checklist = buildChecklist(resp, content);
  const score = computeScore(resp, false);
  const legibles = toReadable(resp, content);

  const leadPayload = {
    lead_id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
    timestamp: new Date().toISOString(),
    nombre: estado.contacto.nombre,
    empresa: estado.contacto.empresa,
    correo: estado.contacto.correo,
    telefono: estado.contacto.telefono || '',
    cargo: estado.contacto.cargo || '',
    respuestas_legibles: legibles,
    respuestas_codigos: { ...resp },
    arquetipo_base: base.id,
    refuerzo_activado: b ? b.id : null,
    score,
    booking_agendado: false,
    checklist_full: checklist.full
  };

  return {
    layerA: base.text,
    layerB: b ? b.text : null,
    layerC: c,
    checklist,
    archetypeBase: base.id,
    reinforcement: b ? b.id : null,
    score,
    leadPayload
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/diagnostico.engine.test.js`
Expected: PASS (16 tests).

- [ ] **Step 5: Commit**

```bash
git add js/diagnostico.engine.js test/diagnostico.engine.test.js
git commit -m "feat(diagnostico): engine — score, readable labels, assembleResult"
```

---

## Task 5: Shell HTML + CSS base + navegación de pasos

**Files:**
- Create: `diagnostico/index.html`
- Create: `css/diagnostico.css`
- Create: `js/diagnostico.view.js`

**Interfaces:**
- Consumes: `content` (Task 1), `assembleResult` (Task 4).
- Produces: `js/diagnostico.view.js` con estado interno `{ paso, respuestas, contacto }` y las vistas `renderStep`, `renderGate`, `renderResult` (esta última se completa en Task 7). En esta tarea solo `renderStep` + navegación funcionan.

**Verificación:** manual en navegador (sitio estático sin DOM test runner). Servir con `python3 -m http.server 8000` desde la raíz del repo y abrir `http://localhost:8000/diagnostico/`.

- [ ] **Step 1: Create `diagnostico/index.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diagnóstico energético — Mexillum</title>
<meta name="description" content="En 6 preguntas, un diagnóstico de tu perfil energético y los datos que conviene preparar para tu llamada con Mexillum.">
<meta name="theme-color" content="#080A08">
<link rel="stylesheet" href="../css/tokens.css">
<link rel="stylesheet" href="../css/components.css">
<link rel="stylesheet" href="../css/diagnostico.css">
</head>
<body>
<main class="dx" id="dx-root" aria-live="polite"></main>
<script type="module" src="../js/diagnostico.view.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `css/diagnostico.css` (estructura base)**

```css
/* Funnel de diagnóstico — sobre tokens.css + components.css. Solo layout/espaciado. */
.dx{max-width:var(--max-content);margin:0 auto;padding:var(--section-y-sm) var(--gutter-inline)}
.dx__progress{font:var(--type-label);letter-spacing:var(--track-label);text-transform:uppercase;color:var(--text-muted);margin-bottom:var(--space-5)}
.dx__question{font:var(--type-h2);color:var(--text-strong);margin:0 0 var(--space-8);max-width:var(--measure-narrow)}
.dx__options{display:flex;flex-direction:column;gap:var(--space-4);max-width:var(--measure-prose)}
.dx__option{width:100%;text-align:left}
.dx__option .mx-check{width:100%}
.dx__nav{display:flex;gap:var(--space-4);margin-top:var(--space-9)}
.dx__nav--end{justify-content:space-between}
```

- [ ] **Step 3: Create `js/diagnostico.view.js` (estado + renderStep + navegación)**

```js
import content from './diagnostico.content.js';
import { assembleResult } from './diagnostico.engine.js';

const root = document.getElementById('dx-root');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const estado = {
  paso: 0,                 // 0..5 = pasos; 'gate'; 'result'
  respuestas: {},
  contacto: {}
};

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function focusMain() {
  if (!reduce) root.scrollTo?.({ top: 0 });
  window.scrollTo(0, 0);
}

function renderStep() {
  const idx = estado.paso;
  const paso = content.pasos[idx];
  const elegido = estado.respuestas[paso.key];

  const opciones = paso.opciones.map((o) => {
    const on = elegido === o.codigo;
    return `
      <button type="button" class="dx__option" data-codigo="${esc(o.codigo)}" role="radio" aria-checked="${on}">
        <span class="mx-check">
          <span class="mx-check__box mx-check__box--radio ${on ? 'mx-check__box--on' : ''}">
            ${on ? '<span class="mx-check__dot"></span>' : ''}
          </span>
          <span>${esc(o.label)}</span>
        </span>
      </button>`;
  }).join('');

  const atras = idx > 0
    ? '<button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>'
    : '<span></span>';
  const siguienteDisabled = elegido ? '' : 'disabled';

  const view = el(`
    <div class="dx__view">
      <p class="dx__progress">${esc(content.progresoLabel(idx + 1, content.pasos.length))}</p>
      <h2 class="dx__question">${esc(paso.pregunta)}</h2>
      <div class="dx__options" role="radiogroup" aria-label="${esc(paso.pregunta)}">${opciones}</div>
      <div class="dx__nav dx__nav--end">
        ${atras}
        <button type="button" class="mx-btn mx-btn--primary" data-act="siguiente" ${siguienteDisabled}>Siguiente</button>
      </div>
    </div>`);

  view.querySelectorAll('.dx__option').forEach((btn) => {
    btn.addEventListener('click', () => {
      estado.respuestas[paso.key] = btn.dataset.codigo;
      renderStep(); // re-render marca la selección y habilita "Siguiente"
    });
  });
  view.querySelector('[data-act="atras"]')?.addEventListener('click', () => {
    estado.paso -= 1;
    render();
  });
  view.querySelector('[data-act="siguiente"]').addEventListener('click', () => {
    if (!estado.respuestas[paso.key]) return;
    if (estado.paso < content.pasos.length - 1) estado.paso += 1;
    else estado.paso = 'gate';
    render();
  });

  root.replaceChildren(view);
  focusMain();
}

function renderGate() {
  root.replaceChildren(el('<p>Gate — se implementa en Task 6</p>'));
}

function renderResult() {
  root.replaceChildren(el('<p>Resultado — se implementa en Task 7</p>'));
}

function render() {
  if (estado.paso === 'gate') return renderGate();
  if (estado.paso === 'result') return renderResult();
  return renderStep();
}

render();

// Exportado para tests futuros / integraciones. En v1 solo loguea.
export function submitLead(payload) {
  console.log('[diagnostico] leadPayload', payload);
}
```

- [ ] **Step 4: Verify in browser**

Run: `python3 -m http.server 8000` (desde la raíz del repo), abrir `http://localhost:8000/diagnostico/`.
Expected:
- Se ve "Paso 1 de 6" y la pregunta 1 con 4 opciones tipo radio.
- "Siguiente" está deshabilitado hasta elegir una opción; al elegir, se marca el radio y se habilita.
- "Siguiente" avanza; "Atrás" aparece desde el paso 2 y vuelve conservando la selección marcada.
- Tras el paso 6, "Siguiente" muestra el placeholder "Gate — se implementa en Task 6".

- [ ] **Step 5: Commit**

```bash
git add diagnostico/index.html css/diagnostico.css js/diagnostico.view.js
git commit -m "feat(diagnostico): page shell, base styles, step navigation"
```

---

## Task 6: Gate de contacto

**Files:**
- Modify: `js/diagnostico.view.js` (reemplazar `renderGate`)
- Modify: `css/diagnostico.css` (estilos del gate)

**Interfaces:**
- Consumes: `content.gate`, estado (Task 5).
- Produces: `renderGate` funcional que valida, guarda `estado.contacto` y avanza a `estado.paso = 'result'`.

**Regla:** obligatorios nombre/empresa/correo; teléfono y cargo opcionales; honeypot `website`; validación *forgiving* (limpia el error al volverse válido), igual patrón que `js/main.js`. Post-gate, no se puede editar respuestas salvo "Reiniciar" (que aparece en el resultado).

- [ ] **Step 1: Add gate styles to `css/diagnostico.css`**

```css
.dx__gate{max-width:var(--measure-narrow)}
.dx__gate p{color:var(--text-body)}
.dx__gate .mx-field{margin-bottom:var(--space-5)}
.dx__hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.dx__formerr{color:var(--signal-alert);font-size:var(--size-body-sm);margin-top:var(--space-4)}
```

- [ ] **Step 2: Replace `renderGate` in `js/diagnostico.view.js`**

```js
function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }

function renderGate() {
  const campos = content.gate.campos.map((f) => `
    <div class="mx-field">
      <label class="mx-field__label" for="dx-${f.name}">${esc(f.label)}</label>
      <input class="mx-input" id="dx-${f.name}" name="${f.name}" type="${f.type}"
             autocomplete="${f.autocomplete}" ${f.required ? 'required' : ''}
             aria-describedby="err-${f.name}">
      <span class="mx-field__error" id="err-${f.name}" hidden>Revisá este dato.</span>
    </div>`).join('');

  const view = el(`
    <div class="dx__view dx__gate">
      <p class="dx__progress">${esc(content.progresoLabel(content.pasos.length, content.pasos.length))} · Casi listo</p>
      ${content.gate.intro.map((p) => `<p>${esc(p)}</p>`).join('')}
      <form novalidate aria-label="Datos de contacto">
        <input class="dx__hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        ${campos}
        <div class="dx__nav">
          <button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>
          <button type="submit" class="mx-btn mx-btn--primary">Ver mi diagnóstico</button>
        </div>
        <p class="dx__formerr" data-formerr hidden>Revisá los campos marcados.</p>
      </form>
    </div>`);

  const form = view.querySelector('form');
  const tests = {
    nombre: (v) => v.trim().length > 1,
    empresa: (v) => v.trim().length > 1,
    correo: (v) => isEmail(v)
  };

  function mark(name, invalid) {
    const input = form.querySelector(`#dx-${name}`);
    const err = form.querySelector(`#err-${name}`);
    input.classList.toggle('mx-input--invalid', invalid);
    input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    if (err) err.hidden = !invalid;
  }

  // Forgiving: limpia el error apenas el campo se vuelve válido.
  Object.keys(tests).forEach((name) => {
    form.querySelector(`#dx-${name}`).addEventListener('input', (e) => {
      if (e.target.classList.contains('mx-input--invalid') && tests[name](e.target.value)) mark(name, false);
    });
  });

  view.querySelector('[data-act="atras"]').addEventListener('click', () => {
    estado.paso = content.pasos.length - 1;
    render();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (form.website.value) return; // honeypot: bot → no-op

    let firstBad = null;
    Object.keys(tests).forEach((name) => {
      const input = form.querySelector(`#dx-${name}`);
      const ok = tests[name](input.value);
      mark(name, !ok);
      if (!ok && !firstBad) firstBad = input;
    });
    if (firstBad) {
      form.querySelector('[data-formerr]').hidden = false;
      firstBad.focus();
      return;
    }

    estado.contacto = {
      nombre: form.nombre.value.trim(),
      empresa: form.empresa.value.trim(),
      correo: form.correo.value.trim(),
      telefono: form.telefono.value.trim(),
      cargo: form.cargo.value.trim()
    };
    estado.paso = 'result';
    render();
  });

  root.replaceChildren(view);
  focusMain();
}
```

- [ ] **Step 3: Verify in browser**

Run: `python3 -m http.server 8000`, abrir `http://localhost:8000/diagnostico/`, completar los 6 pasos.
Expected:
- El gate muestra el copy de intro (2 párrafos) y 5 campos (nombre, empresa, correo, teléfono opcional, cargo opcional).
- "Ver mi diagnóstico" con campos vacíos marca en rojo nombre/empresa/correo y enfoca el primero; teléfono/cargo no bloquean.
- Un correo mal formado marca error; corregirlo limpia el error al tipear.
- "Atrás" vuelve al paso 6 con la selección marcada.
- Con datos válidos, muestra el placeholder "Resultado — se implementa en Task 7".

- [ ] **Step 4: Commit**

```bash
git add js/diagnostico.view.js css/diagnostico.css
git commit -m "feat(diagnostico): contact gate with forgiving validation + honeypot"
```

---

## Task 7: Pantalla de resultado (2 columnas + checklist + submitLead)

**Files:**
- Modify: `js/diagnostico.view.js` (reemplazar `renderResult`)
- Modify: `css/diagnostico.css` (layout de resultado)

**Interfaces:**
- Consumes: `assembleResult` (Task 4), `submitLead` (Task 5), estado.
- Produces: `renderResult` funcional. Llama `assembleResult(estado, content)` una vez, renderiza diagnóstico + checklist web + CTA + slot `#agenda` (placeholder) + botón imprimir + botón "Reiniciar", y llama `submitLead(res.leadPayload)`.

- [ ] **Step 1: Add result styles to `css/diagnostico.css`**

```css
.dx__result{display:grid;grid-template-columns:1fr;gap:var(--space-9)}
@media (min-width:900px){.dx__result{grid-template-columns:1.4fr 1fr;align-items:start}}
.dx__diag p{font:var(--type-body-lg);color:var(--text-body)}
.dx__diag .dx__close{color:var(--text-strong);font-weight:var(--weight-semibold)}
.dx__cta{margin:var(--space-7) 0}
.dx__agenda{margin-top:var(--space-8);padding:var(--space-8);border:1px dashed var(--border-default);border-radius:var(--radius-panel);color:var(--text-muted);text-align:center}
.dx__actions{display:flex;flex-wrap:wrap;gap:var(--space-4);margin-top:var(--space-7)}
@media (min-width:900px){.dx__checklist{position:sticky;top:var(--space-9)}}
.dx__checklist ul{list-style:none;margin:var(--space-5) 0;padding:0;display:flex;flex-direction:column;gap:var(--space-4)}
.dx__checklist li{position:relative;padding-left:var(--space-6);color:var(--text-body)}
.dx__checklist li::before{content:'';position:absolute;left:0;top:9px;width:6px;height:6px;border-radius:var(--radius-full);background:var(--accent)}
.dx__checklist__foot{font-size:var(--size-body-sm);color:var(--text-muted);margin-top:var(--space-5)}
```

- [ ] **Step 2: Replace `renderResult` in `js/diagnostico.view.js`**

```js
function renderResult() {
  const res = assembleResult(estado, content);
  submitLead(res.leadPayload); // v1: console.log; sub-proyecto 2 lo conecta

  const layerB = res.layerB ? `<p>${esc(res.layerB)}</p>` : '';
  const items = res.checklist.web.map((b) => `<li>${esc(b)}</li>`).join('');

  const view = el(`
    <div class="dx__view dx__result">
      <section class="dx__diag">
        <p>${esc(res.layerA)}</p>
        ${layerB}
        <p class="dx__close">${esc(res.layerC.texto)}</p>
        <div class="dx__cta">
          <button type="button" class="mx-btn mx-btn--primary mx-btn--lg" data-act="cta">${esc(res.layerC.ctaText)}</button>
        </div>
        <div class="dx__agenda" id="agenda">
          <p>Aquí vas a poder agendar tu llamada. (Agendamiento disponible próximamente.)</p>
        </div>
        <div class="dx__actions">
          <button type="button" class="mx-btn mx-btn--secondary" data-act="print">Imprimir / Guardar PDF</button>
          <button type="button" class="mx-btn mx-btn--ghost" data-act="reiniciar">${esc(content.resultado.reiniciar)}</button>
        </div>
      </section>
      <aside class="dx__checklist" aria-label="Preparación para la llamada">
        <h3>${esc(content.checklistTitulo)}</h3>
        <ul>${items}</ul>
        <p class="dx__checklist__foot">${esc(content.checklistPie)}</p>
      </aside>
    </div>`);

  view.querySelector('[data-act="cta"]').addEventListener('click', () => {
    view.querySelector('#agenda').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  });
  view.querySelector('[data-act="print"]').addEventListener('click', () => window.print());
  view.querySelector('[data-act="reiniciar"]').addEventListener('click', () => {
    estado.paso = 0;
    estado.respuestas = {};
    estado.contacto = {};
    render();
  });

  root.replaceChildren(view);
  focusMain();
}
```

- [ ] **Step 3: Verify in browser**

Run: `python3 -m http.server 8000`, completar el funnel con: industrial / estacional / continuo / si_medido (Sí, y sabemos) / diésel Sí / exporta No.
Expected:
- Diagnóstico: Capa A "Tu generación cubre parte del año…", Capa B de diésel, cierre industrial, botón "Quiero agendar mi diagnóstico".
- Checklist (derecha en desktop, sticky): base estacional (2) + refuerzo diésel + universal — con título y pie correctos.
- Botón CTA hace scroll al bloque `#agenda` (placeholder punteado).
- Consola: `[diagnostico] leadPayload {…}` con `arquetipo_base:'estacional'`, `refuerzo_activado:'diesel'`, `score`, `booking_agendado:false`, `checklist_full` (más largo que el web).
- "Reiniciar" vuelve al paso 1 limpio. En viewport angosto (<900px) las columnas se apilan resultado → checklist.

- [ ] **Step 4: Commit**

```bash
git add js/diagnostico.view.js css/diagnostico.css
git commit -m "feat(diagnostico): result screen — diagnosis, checklist, CTA, submitLead seam"
```

---

## Task 8: Impresión, responsive y accesibilidad

**Files:**
- Modify: `css/diagnostico.css` (bloque `@media print` + ajustes mobile)
- Modify: `js/diagnostico.view.js` (checklist full oculto para print + foco a11y)

**Interfaces:**
- Consumes: `res.checklist.full` (Task 4/7).
- Produces: versión imprimible que muestra el checklist **completo** (no el recorte web) + marca/contacto Mexillum en el pie; navegación/agenda ocultas en papel (§10.2).

- [ ] **Step 1: Add hidden full-checklist + print footer to result view**

En `renderResult` (Task 7), agregar dentro de `.dx__result`, después del `<aside>`, un bloque solo-print con el checklist completo y el pie de marca:

```js
// dentro del template de renderResult, tras </aside> y antes de </div>:
const itemsFull = res.checklist.full.map((b) => `<li>${esc(b)}</li>`).join('');
```

Insertar en el HTML del `view` (agregar estas dos secciones antes del cierre `</div>` del `.dx__result`):

```html
      <section class="dx__print-only dx__checklist">
        <h3>${esc(content.checklistTitulo)}</h3>
        <ul>${itemsFull}</ul>
      </section>
      <footer class="dx__print-only dx__printfoot">
        <p>mexillum — diagnóstico energético · mexillum.com · info@mexillum.com</p>
      </footer>
```

(Definí `itemsFull` junto a `items` al inicio de la función.)

- [ ] **Step 2: Add print + responsive styles to `css/diagnostico.css`**

```css
/* solo-print: oculto en pantalla, visible al imprimir */
.dx__print-only{display:none}

@media print{
  .dx__nav, .dx__cta, .dx__agenda, .dx__actions, .dx__checklist:not(.dx__print-only){display:none !important}
  .dx__print-only{display:block}
  .dx{max-width:none;padding:0}
  .dx__result{grid-template-columns:1fr;gap:var(--space-7)}
  .dx__diag p{font-size:12pt;color:#000}
  .dx__printfoot{margin-top:var(--space-8);border-top:1px solid #999;padding-top:var(--space-4);font-size:9pt;color:#333}
  a[href]::after{content:''}
}

/* mobile: apila y quita sticky */
@media (max-width:899px){
  .dx__question{font:var(--type-h3);color:var(--text-strong)}
}
```

- [ ] **Step 3: Verify print + mobile in browser**

Run: `python3 -m http.server 8000`, completar el funnel, abrir el diálogo de impresión (Cmd+P) o "print preview".
Expected:
- En la vista de impresión: se ve el diagnóstico completo + checklist **completo** (todos los bullets, no el recorte de 4) + pie con marca/contacto Mexillum.
- Nav, CTA, bloque de agenda y el checklist sticky de pantalla NO aparecen en papel.
- En pantalla, el bloque `dx__print-only` permanece oculto.
- Redimensionar a ~375px: pasos y resultado se ven bien, columnas apiladas, sin scroll horizontal.

- [ ] **Step 4: Full test suite + commit**

Run: `node --test`
Expected: PASS (todos los tests de content + engine).

```bash
git add js/diagnostico.view.js css/diagnostico.css
git commit -m "feat(diagnostico): print stylesheet (full checklist) + responsive polish"
```

---

## Task 9: Enlace desde la landing + verificación final

**Files:**
- Modify: `index.html` (agregar acceso al funnel)

**Interfaces:**
- Consumes: la página `diagnostico/` completa.
- Produces: un enlace visible a `/diagnostico` desde la landing.

- [ ] **Step 1: Add link to the funnel from the landing nav/CTA**

En `index.html`, agregar (junto a los CTAs existentes que apuntan a `#contacto`, líneas ~26 y ~41) un enlace al funnel. Ejemplo para el CTA del nav:

```html
<a class="mx-btn mx-btn--secondary mx-btn--sm" href="/diagnostico">Diagnóstico en 2 minutos</a>
```

Colocarlo junto al `<a ... href="#contacto">Agenda un diagnóstico</a>` existente sin quitarlo. Usar `href="/diagnostico"` (Vercel `cleanUrls` resuelve a `diagnostico/index.html`).

- [ ] **Step 2: Verify end-to-end**

Run: `python3 -m http.server 8000`, abrir `http://localhost:8000/` y hacer clic en "Diagnóstico en 2 minutos".
Expected: navega a `/diagnostico/`, se completa el funnel de punta a punta, y el resultado + checklist + print funcionan. (Nota: con `python3 -m http.server`, usar `http://localhost:8000/diagnostico/` si el clean URL sin barra no resuelve localmente; en Vercel `/diagnostico` funciona por `cleanUrls`.)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(diagnostico): link funnel from landing"
```

---

## Self-Review (completado)

**Cobertura de la spec:**
- §2 arquitectura 3 módulos + config → Tasks 1–4 (engine/content), 5–8 (view). ✔
- §2.1 flujo de datos / §2.3 assembleResult → Task 4. ✔
- §2.2 navegación (back-nav, bloqueo post-gate, reiniciar) → Tasks 5–7. ✔
- §3 motor (resolveBaseArchetype compartido, A/B/C, checklist, score, toReadable) → Tasks 2–4. ✔
- §3.1 leadPayload → Task 4. ✔
- §4 content parametrizable + §4.1 label corregido → Task 1 (+ test del label). ✔
- §5 vista (pasos, gate, resultado 2-col, print, mobile, a11y) → Tasks 5–8. ✔
- §6 tests node:test → Tasks 1–4. ✔
- §7 no-funcionales (mobile, <2min, sin jerga, reduced-motion, solo mx-*) → Global Constraints + Tasks 5–8. ✔
- §8 handoff (submitLead, #agenda, botón email diferido) → costuras en Tasks 5–7; botón email no se agrega en v1 (correcto, diferido). ✔

**Placeholder scan:** el único `id="agenda"` es un placeholder *de producto* intencional (cal.diy diferido), no un placeholder de plan. Sin TODO/TBD en código.

**Consistencia de tipos:** `resolveBaseArchetype`→`{id,text}`, `pickLayerB`→`{id,text}|null`, `pickLayerC`→`{texto,ctaText}`, `buildChecklist`→`{full,web}`, `computeScore`→`{valor,nivel}`, `assembleResult`→objeto §2.3. Usados consistentemente en `assembleResult` y en `renderResult`. ✔
