# Motor de diagnóstico v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolucionar el motor de diagnóstico para clasificar oportunidades BESS por comportamiento eléctrico (no por industria), con scoring 0–100 de 6 oportunidades, ranking, potencial general, recomendación BESS vs Solar y detección de limitaciones.

**Architecture:** Se conserva la separación `js/diagnostico.engine.js` (funciones puras) / `js/diagnostico.content.js` (copy y reglas como datos). Se reemplazan 2 preguntas (`demanda`→`perfil`, `sitios`→`calidad`), se agregan funciones puras de scoring que alimentan `assembleResult`, y el payload del lead solo suma claves nuevas (retrocompatible).

**Tech Stack:** JavaScript ES modules (`import`/`export`), Node 20, tests con `node --test`. Sin dependencias npm. Copy es-MX (tuteo, sin voseo).

## Global Constraints

- Exactamente **8 preguntas**. No agregar una 9ª.
- Copy es-MX con **tuteo, sin voseo** (existe un test que lo verifica: `test/diagnostico.content.test.js` → "el copy no tiene voseo").
- **No romper** claves existentes del payload del lead ni del objeto `res` de `assembleResult`; solo **agregar** claves nuevas.
- Diagnóstico de **una sola instalación**: nunca agregar/consolidar consumos de varias plantas.
- Funciones de `engine.js` **puras** (sin DOM), importables en Node.
- Correr `npm test` al final de cada task; debe quedar en verde.
- Ids internos de oportunidades: `peak_shaving`, `arbitraje`, `bess_solar`, `respaldo`, `diferimiento`, `diesel`.
- Comando de test de un archivo: `node --test test/diagnostico.engine.test.js` (o `.content.test.js`).

---

## File Structure

- `js/diagnostico.content.js` — datos: preguntas, pesos de scoring (`content.scoring`), copy de recomendaciones/limitaciones/palancas, tablas económicas.
- `js/diagnostico.engine.js` — funciones puras nuevas + `assembleResult`/`buildEventNote` extendidos.
- `js/diagnostico.view.js` — `plantaLabel` constante; retítulo del bloque económico. Sin dependencia de `sitios`.
- `api/lead.js` — etiquetas `PREGUNTAS` + sección de email con potencial/ranking/recomendación.
- `test/diagnostico.engine.test.js`, `test/diagnostico.content.test.js` — actualización de fixtures + tests nuevos.

---

### Task 1: Migración del cuestionario (perfil/calidad in, demanda/sitios out)

**Files:**
- Modify: `js/diagnostico.content.js` (pasos, `perfilExposicion`, `palancasDescartada`, `financiamiento`, `pickLevers` triggers via content)
- Modify: `js/diagnostico.engine.js` (`plantaLabel`, `buildProfile`, `pickLevers`)
- Modify: `api/lead.js` (`PREGUNTAS`)
- Test: `test/diagnostico.content.test.js`, `test/diagnostico.engine.test.js`

**Interfaces:**
- Produces: `plantaLabel()` → `'tu operación'` (ignora argumentos). `resp` ahora tiene keys `perfil` (`plano|diurno|picos|punta|nolose`) y `calidad` (`factor|variaciones|cortes|no|nolose`); ya **no** tiene `demanda` ni `sitios`.

- [ ] **Step 1: Actualizar los tests de `content` a las nuevas keys (fallará)**

En `test/diagnostico.content.test.js`, reemplazar el test de keys:

```js
test('hay 8 pasos con las keys esperadas', () => {
  assert.deepEqual(content.pasos.map((p) => p.key), [
    'sector', 'perfil', 'generacion', 'calidad', 'tarifa', 'factura', 'corte', 'disparador'
  ]);
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `node --test test/diagnostico.content.test.js`
Expected: FAIL (los pasos aún tienen `sitios`/`demanda`).

- [ ] **Step 3: Reemplazar los pasos `sitios` y `demanda` en `content.pasos`**

En `js/diagnostico.content.js`, dentro de `pasos`, **eliminar** el objeto `{ key: 'sitios', ... }` y el objeto `{ key: 'demanda', ... }`, y dejar el arreglo en este orden con estos dos nuevos objetos:

```js
    {
      key: 'perfil', notaLabel: 'Perfil de carga / horario',
      pregunta: 'Pensando en un día típico de tu operación, ¿cómo se comporta el consumo eléctrico?',
      hint: 'No necesitas números — elige la opción que mejor lo describa.',
      opciones: [
        { label: 'Bastante parejo las 24 horas — la operación no para (proceso continuo)', codigo: 'plano' },
        { label: 'Sube durante el día y baja de noche (turno diurno u horario de oficina)', codigo: 'diurno' },
        { label: 'Tiene picos cortos e intensos (arranques de motores, cargas puntuales)', codigo: 'picos' },
        { label: 'Se concentra en la tarde-noche, entre las 6 y las 10 pm', codigo: 'punta' },
        { label: 'No lo tengo claro', codigo: 'nolose' }
      ]
    },
```

```js
    {
      key: 'calidad', notaLabel: 'Calidad eléctrica',
      pregunta: '¿Reconoces problemas de calidad o confiabilidad eléctrica en tu operación?',
      opciones: [
        { label: 'Sí — nos penalizan por bajo factor de potencia en el recibo', codigo: 'factor' },
        { label: 'Sí — variaciones de voltaje, parpadeos o daño a equipos sensibles', codigo: 'variaciones' },
        { label: 'Sí — microcortes o interrupciones frecuentes de CFE', codigo: 'cortes' },
        { label: 'No, el suministro es estable', codigo: 'no' },
        { label: 'No lo sé', codigo: 'nolose' }
      ]
    },
```

El orden final de `pasos` debe ser: `sector`, `perfil`, `generacion`, `calidad`, `tarifa`, `factura`, `corte`, `disparador`. (`perfil` ocupa la posición donde estaba `sitios`; `calidad` donde estaba `demanda`.)

- [ ] **Step 4: Quitar de `content.js` las reglas que dependían de `sitios` y repuntar factor de potencia**

En `js/diagnostico.content.js`:

1. En `palancasDescartada`, **eliminar** la entrada `{ id: 'megaproyecto', when: { sitios: 'muchos' }, ... }`.
2. En `financiamiento`, **eliminar** las dos entradas `{ when: { sitios: 'pocos' }, ... }` y `{ when: { sitios: 'muchos' }, ... }`.
3. Reemplazar `financiamientoDefault` por (incorpora el discurso de piloto de forma genérica):

```js
  financiamientoDefault: 'Nuestros proyectos pueden estructurarse de dos formas: adquisición directa evaluada por retorno, o esquema de servicio sin inversión inicial, sujeto a un análisis de viabilidad del proyecto. Lo natural es empezar por un proyecto piloto medido en esta instalación y replicar solo si el número se cumple. En la llamada vemos cuál se ajusta mejor a tu caso.',
```

- [ ] **Step 5: Ajustar `plantaLabel`, `buildProfile` y `pickLevers` en `engine.js`**

En `js/diagnostico.engine.js`, reemplazar `plantaLabel`:

```js
// Una sola instalación siempre: fraseo fijo.
export function plantaLabel() {
  return 'tu operación';
}
```

Reemplazar `buildProfile` (quita el sufijo multi-planta):

```js
export function buildProfile(resp, content) {
  const sector = content.perfilSector[resp.sector] || resp.sector;
  const exp = content.perfilExposicion.find((r) => matchesWhen(resp, r.when));
  const exposicion = exp ? exp.text : content.perfilExposicionDefault;
  return `Perfil: ${sector} ${exposicion}.`;
}
```

En `pickLevers`, reemplazar el cálculo de `gancho` y de `factorPotencia`:

```js
  // Gancho educativo solo cuando el bloque B no calculó número.
  const gancho = (resp.factura === 'nolose' || resp.tarifa === 'privado') ? content.gancho : null;
```

```js
  // Factor de potencia: aditiva, disparada por la señal de calidad correcta.
  const factorPotencia = resp.calidad === 'factor' ? content.palancaFactorPotencia : null;
```

(Eliminar la línea `const demandaCiega = ...` y la `const sinNumeroB = ...` previas, ya reemplazadas por la condición inline del gancho.)

- [ ] **Step 6: Actualizar `PREGUNTAS` en `api/lead.js`**

Reemplazar el arreglo `PREGUNTAS`:

```js
const PREGUNTAS = [
  ['sector', 'Sector / operación'],
  ['perfil', 'Perfil de carga / horario'],
  ['generacion', 'Generación propia'],
  ['calidad', 'Calidad eléctrica'],
  ['tarifa', 'Tarifa CFE'],
  ['factura', 'Factura mensual'],
  ['corte', 'Impacto de un corte'],
  ['disparador', 'Disparador'],
];
```

- [ ] **Step 7: Actualizar fixtures y assertions afectadas en `engine.test.js`**

En `test/diagnostico.engine.test.js`:

1. Reemplazar el fixture `fx`:

```js
const fx = {
  sector: 'manufactura', perfil: 'diurno', generacion: 'fisica', calidad: 'no',
  tarifa: 'gdmth', factura: 'alto', corte: 'reinicio', disparador: 'costo'
};
```

2. Reemplazar el test `plantaLabel`:

```js
test('plantaLabel: una sola instalación siempre → "tu operación"', () => {
  assert.equal(plantaLabel(), 'tu operación');
});
```

3. En `buildProfile`, ajustar las cadenas esperadas (quitar " multi-planta"):

```js
test('buildProfile: fixture arma el perfil esperado', () => {
  assert.equal(buildProfile(fx, content), 'Perfil: manufactura con exposición a cargo por demanda.');
});
```

Y en el test de capacidad/diesel:

```js
  const rd = { sector: 'frio', generacion: 'no', disparador: 'diesel' };
  assert.equal(buildProfile(rd, content), 'Perfil: frío y logística con dependencia de diésel.');
```

4. Reemplazar íntegro el test `pickLevers: gancho solo en salidas sin número`:

```js
test('pickLevers: gancho solo en salidas sin número', () => {
  assert.equal(pickLevers({ ...fx, factura: 'alto', tarifa: 'gdmth' }, content).gancho, null);
  assert.equal(pickLevers({ ...fx, factura: 'nolose' }, content).gancho, content.gancho);
  assert.equal(pickLevers({ ...fx, tarifa: 'privado' }, content).gancho, content.gancho);
});
```

5. En el test `pickLevers: factor de potencia como secundaria adicional...`, cambiar el disparo de `sector: 'frio'` a `calidad: 'factor'`:

```js
test('pickLevers: factor de potencia como secundaria adicional solo con calidad=factor', () => {
  const conFactor = pickLevers({ ...fx, calidad: 'factor' }, content);
  assert.ok(conFactor.factorPotencia, 'calidad=factor debe traer factor de potencia');
  assert.equal(conFactor.factorPotencia.nombre, 'Corrección de factor de potencia');
  assert.equal(pickLevers({ ...fx, calidad: 'no' }, content).factorPotencia, null);
  assert.equal(pickLevers({ ...fx, calidad: 'cortes' }, content).factorPotencia, null);
});
```

6. En `pickLevers: continuidad de servicio usa variante frío...`, quitar dependencia de `demanda`; usar `{ ...fx, sector: 'frio', corte: 'servicio', calidad: 'no' }` y `{ ...fx, sector: 'manufactura', corte: 'servicio' }` (ya no hay `demanda`, así que no se toca).

7. En `pickFinancing`, reemplazar los tests que dependen de `sitios`:

```js
test('pickFinancing: fixture (un solo sitio, sin segmento especial) → default con piloto', () => {
  assert.equal(pickFinancing(fx, content), content.financiamientoDefault);
  assert.ok(content.financiamientoDefault.includes('proyecto piloto'));
});
```

Y borrar el test `pickFinancing: default cuando un solo sitio y sin segmento especial` (queda cubierto por el anterior) y el test `pickFinancing: precedencia publico > ev > muyalto > sitios` cambiarlo a:

```js
test('pickFinancing: precedencia publico > ev > muyalto', () => {
  assert.ok(pickFinancing({ ...fx, sector: 'publico' }, content).startsWith('Para entidades públicas'));
  assert.ok(pickFinancing({ ...fx, sector: 'ev' }, content).startsWith('Nuestros proyectos pueden estructurarse sin inversión inicial'));
  assert.ok(pickFinancing({ ...fx, sector: 'manufactura', factura: 'muyalto' }, content).startsWith('A tu escala'));
});
```

8. En `estadoFx`, el spread `{ ...fx }` ya toma las nuevas keys. En `assembleResult: fixture end-to-end`, ajustar cualquier assertion de perfil a la cadena sin "multi-planta":

```js
  assert.equal(res.perfil, 'Perfil: manufactura con exposición a cargo por demanda.');
```

- [ ] **Step 8: Correr toda la suite y ajustar cadenas restantes**

Run: `node --test test/`
Expected: PASS. Si alguna assertion de copy sigue roja, actualizar la cadena esperada al nuevo texto (no cambiar la lógica).

- [ ] **Step 9: Commit**

```bash
git add js/diagnostico.content.js js/diagnostico.engine.js api/lead.js test/
git commit -m "Diagnostico v3: migra cuestionario a perfil de carga y calidad electrica

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Rango económico por perfil de carga + lenguaje conservador

**Files:**
- Modify: `js/diagnostico.content.js` (`tablaRecorte`, `bloqueB`)
- Modify: `js/diagnostico.engine.js` (`computeRange`, `renderBlockB`)
- Modify: `js/diagnostico.view.js` (figcaption del rango)
- Test: `test/diagnostico.engine.test.js`, `test/diagnostico.content.test.js`

**Interfaces:**
- Consumes: `resp.perfil`.
- Produces: `computeRange` usa `content.tablaRecorte[resp.perfil]`. Números canónicos del fixture (perfil `diurno`): piso `2250000`, techo `4200000`.

- [ ] **Step 1: Actualizar tests de tablas y de renderBlockB (fallará)**

En `test/diagnostico.content.test.js`, reemplazar las assertions de `tablaRecorte`:

```js
  assert.deepEqual(content.tablaRecorte.diurno, [0.25, 0.35]);
  assert.deepEqual(content.tablaRecorte.plano, [0.10, 0.18]);
```

En `test/diagnostico.engine.test.js`, el test `computeRange: fixture ...` y `renderBlockB: caso con número ...` deben incluir `perfil: 'diurno'` en su fixture local:

```js
  const fixture = { sector: 'manufactura', perfil: 'diurno', tarifa: 'gdmth', factura: 'alto', disparador: 'costo' };
```

y el test `renderBlockB: sector continuo agrega el extra` cambia a perfil `plano`:

```js
test('renderBlockB: perfil plano (24/7) agrega el extra de arbitraje', () => {
  const r = { sector: 'continuo', perfil: 'plano', tarifa: 'gdmth', factura: 'alto', disparador: 'costo' };
  assert.ok(renderBlockB(r, content).texto.includes('el arbitraje horario lo es'));
});
```

En `renderBlockB: caso con número...` cambiar la assertion del rango:

```js
  assert.ok(b.texto.includes('Orden de magnitud: $2.2 a $4.2 millones de MXN al año.'));
  assert.ok(b.texto.includes('No es una estimación precisa'));
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `node --test test/`
Expected: FAIL (tablaRecorte aún keyeada por sector; copy viejo).

- [ ] **Step 3: Reemplazar `tablaRecorte` y `bloqueB` en content.js**

```js
  // %recorte del cargo por demanda según el PERFIL de carga (comportamiento), no el sector.
  tablaRecorte: {
    picos: [0.28, 0.42],
    diurno: [0.25, 0.35],
    punta: [0.20, 0.32],
    plano: [0.10, 0.18],
    nolose: [0.15, 0.30]
  },
```

```js
  bloqueB: {
    plantilla: (v) => `Con una factura de ~${v.facturaLegible} al mes en tarifa ${v.tarifaLegible}, el cargo por demanda suele pesar entre ${v.pctDemandaPiso}% y ${v.pctDemandaTecho}% del recibo. En operaciones con un perfil de carga como el tuyo, un sistema de almacenamiento bien dimensionado suele recortar del orden de ${v.pctRecortePiso}% a ${v.pctRecorteTecho}% de ese cargo.`,
    rango: (rangoTexto) => `Orden de magnitud: ${rangoTexto}.`,
    disclaimer: 'No es una estimación precisa ni una propuesta: en empresas con un perfil similar solemos encontrar oportunidades económicas de este orden de magnitud. El número real se calcula con tus recibos de los últimos 12 meses.',
    continuoExtra: 'Y en una operación que no para como la tuya, el recorte de pico no suele ser la palanca más fuerte — el arbitraje horario lo es, porque compras en punta todos los días. Eso se suma y se calcula con tu desglose horario.',
    noloseFactura: 'Para dar un orden de magnitud necesitamos la escala de tu factura — es el primer dato del checklist. Lo que sí podemos adelantarte es qué palancas aplican a tu perfil:',
    privado: 'Como compras a un suministrador privado, tu ahorro depende de la estructura de tu contrato — si tienes exposición a precios horarios del mercado, hay arbitraje; si es precio fijo, el margen se lo queda tu suministrador. Es la primera pregunta que resolvemos en la llamada.',
    dieselNota: 'Y ojo: la sustitución de diésel ahorra por peso desplazado, no por porcentaje de factura — suele ser el de mayor margen del análisis, y lo dimensionamos con tus horas de operación.'
  },
```

- [ ] **Step 4: Usar `resp.perfil` en `computeRange` y `renderBlockB`**

En `js/diagnostico.engine.js`, en `computeRange` reemplazar la línea del recorte:

```js
  const rec = content.tablaRecorte[resp.perfil];
```

En `renderBlockB` reemplazar la línea análoga:

```js
  const rec = content.tablaRecorte[resp.perfil];
```

Y reemplazar la línea de `notaContinuo`:

```js
  const notaContinuo = resp.perfil === 'plano' ? b.continuoExtra : null;
```

- [ ] **Step 5: Retítulo del bloque económico en la vista**

En `js/diagnostico.view.js`, en `renderResult`, reemplazar el `figcaption`:

```js
          <figcaption class="dx__rango-label">Orden de magnitud (referencia)</figcaption>
```

- [ ] **Step 6: Correr tests**

Run: `node --test test/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/ test/
git commit -m "Diagnostico v3: rango por perfil de carga y lenguaje conservador

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Scoring de oportunidades + ranking + potencial general

**Files:**
- Modify: `js/diagnostico.content.js` (agregar `content.scoring`)
- Modify: `js/diagnostico.engine.js` (agregar `scoreOpportunities`, `rankOpportunities`, `potencialGeneral`; wire en `assembleResult` + `leadPayload`)
- Test: `test/diagnostico.engine.test.js`

**Interfaces:**
- Produces:
  - `scoreOpportunities(resp, content)` → `{ peak_shaving, arbitraje, bess_solar, respaldo, diferimiento, diesel }` (enteros 0–100).
  - `rankOpportunities(scores, content)` → `[{ id, nombre, score }]` desc.
  - `potencialGeneral(scores, resp, content)` → `'Muy Alto'|'Alto'|'Medio'|'Bajo'`.
  - `assembleResult(...).scores`, `.ranking`, `.potencial_general`; y en `leadPayload`.

- [ ] **Step 1: Escribir tests de scoring (fallará)**

Agregar a `test/diagnostico.engine.test.js` (importar además `scoreOpportunities, rankOpportunities, potencialGeneral` en el `import`):

```js
test('scoreOpportunities: diésel es prácticamente binario en disparador=diesel', () => {
  const conDiesel = scoreOpportunities({ ...fx, disparador: 'diesel', corte: 'reinicio', calidad: 'no' }, content);
  const sinDiesel = scoreOpportunities({ ...fx, disparador: 'costo' }, content);
  assert.ok(conDiesel.diesel >= 72);
  assert.equal(sinDiesel.diesel, 0);
});

test('scoreOpportunities: perfil punta favorece arbitraje sobre peak shaving', () => {
  const s = scoreOpportunities({ ...fx, perfil: 'punta', tarifa: 'gdmth' }, content);
  assert.ok(s.arbitraje > s.peak_shaving);
  assert.ok(s.arbitraje <= 100 && s.peak_shaving >= 0);
});

test('scoreOpportunities: perfil picos favorece peak shaving', () => {
  const s = scoreOpportunities({ ...fx, perfil: 'picos', tarifa: 'gdmth', factura: 'alto' }, content);
  assert.ok(s.peak_shaving >= 80);
});

test('scoreOpportunities: todo score queda en [0,100]', () => {
  const s = scoreOpportunities({ sector: 'ev', perfil: 'picos', generacion: 'estacional', calidad: 'cortes', tarifa: 'gdmth', factura: 'muyalto', corte: 'producto', disparador: 'capacidad' }, content);
  for (const v of Object.values(s)) assert.ok(v >= 0 && v <= 100, `fuera de rango: ${v}`);
});

test('rankOpportunities: devuelve 6 ordenadas desc con nombre', () => {
  const r = rankOpportunities(scoreOpportunities(fx, content), content);
  assert.equal(r.length, 6);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score);
  assert.ok(typeof r[0].nombre === 'string');
});

test('potencialGeneral: tope Medio cuando faltan factura y tarifa', () => {
  const resp = { ...fx, factura: 'nolose', tarifa: 'nolose', corte: 'producto', calidad: 'cortes' };
  const scores = scoreOpportunities(resp, content);
  assert.equal(potencialGeneral(scores, resp, content), 'Medio');
});

test('potencialGeneral: Muy Alto con score líder >=75', () => {
  const resp = { sector: 'manufactura', perfil: 'picos', generacion: 'no', calidad: 'factor', tarifa: 'gdmth', factura: 'muyalto', corte: 'producto', disparador: 'costo' };
  const scores = scoreOpportunities(resp, content);
  assert.equal(potencialGeneral(scores, resp, content), 'Muy Alto');
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `node --test test/diagnostico.engine.test.js`
Expected: FAIL ("scoreOpportunities is not a function").

- [ ] **Step 3: Agregar `content.scoring` a content.js**

Insertar en el objeto `content` (por ejemplo después de `perfilExposicionDefault`):

```js
  // ---- SCORING (datos; engine.js sólo suma) ----
  scoring: {
    oportunidades: [
      { id: 'peak_shaving', nombre: 'Peak Shaving' },
      { id: 'arbitraje', nombre: 'Arbitraje tarifario' },
      { id: 'bess_solar', nombre: 'BESS + Solar' },
      { id: 'respaldo', nombre: 'Respaldo' },
      { id: 'diferimiento', nombre: 'Diferimiento de capacidad' },
      { id: 'diesel', nombre: 'Sustitución de diésel' }
    ],
    pesos: {
      peak_shaving: {
        perfil: { picos: 50, diurno: 38, punta: 32, plano: 8, nolose: 18 },
        tarifa: { gdmth: 25, dist: 25, otra: 12, nolose: 8, privado: 0 },
        factura: { muyalto: 18, alto: 14, medio: 9, bajo: 4, nolose: 6 },
        sector: { frio: 7, ev: 7, manufactura: 4, continuo: 0, publico: 0 },
        calidad: { factor: 5 }
      },
      arbitraje: {
        tarifa: { gdmth: 38, dist: 18, privado: 12, otra: 6, nolose: 8 },
        perfil: { plano: 34, punta: 34, diurno: 14, picos: 8, nolose: 14 },
        sector: { continuo: 14 },
        disparador: { excedente: 14 },
        factura: { muyalto: 10, alto: 7, medio: 4 }
      },
      bess_solar: {
        generacion: { no: 26, evaluando: 26, estacional: 34, fisica: 6 },
        perfil: { diurno: 34, plano: 16, picos: 10, punta: 8, nolose: 14 },
        disparador: { excedente: 16 },
        sector: { publico: 6, ev: 6, frio: 6 }
      },
      respaldo: {
        corte: { producto: 52, reinicio: 42, servicio: 40, nada: 0 },
        calidad: { cortes: 20, variaciones: 14 },
        sector: { frio: 12, continuo: 10 },
        disparador: { diesel: 8 }
      },
      diferimiento: {
        disparador: { capacidad: 62 },
        sector: { ev: 26 },
        perfil: { picos: 12, punta: 6 },
        factura: { muyalto: 8, alto: 4 }
      },
      diesel: {
        disparador: { diesel: 72 },
        corte: { producto: 8, reinicio: 8 },
        calidad: { cortes: 8 }
      }
    },
    umbralPotencial: { muyAlto: 75, alto: 60, medio: 40 },
    umbralFuerte: 60,
    minFuertesParaSubir: 3,
    umbralSecundaria: 40
  },
```

- [ ] **Step 4: Implementar las tres funciones puras en engine.js**

Agregar en `js/diagnostico.engine.js` (antes de `assembleResult`):

```js
// ---- SCORING de oportunidades ----
export function scoreOpportunities(resp, content) {
  const { oportunidades, pesos } = content.scoring;
  const out = {};
  for (const { id } of oportunidades) {
    let total = 0;
    const tabla = pesos[id] || {};
    for (const [campo, mapa] of Object.entries(tabla)) {
      const pts = mapa[resp[campo]];
      if (typeof pts === 'number') total += pts;
    }
    out[id] = Math.max(0, Math.min(100, total));
  }
  return out;
}

export function rankOpportunities(scores, content) {
  const orden = content.scoring.oportunidades;
  const prioridad = new Map(orden.map((o, i) => [o.id, i]));
  return orden
    .map((o) => ({ id: o.id, nombre: o.nombre, score: scores[o.id] }))
    .sort((a, b) => (b.score - a.score) || (prioridad.get(a.id) - prioridad.get(b.id)));
}

export function potencialGeneral(scores, resp, content) {
  const u = content.scoring.umbralPotencial;
  const valores = Object.values(scores);
  const s1 = Math.max(...valores);
  const niveles = ['Bajo', 'Medio', 'Alto', 'Muy Alto'];
  let idx = s1 >= u.muyAlto ? 3 : s1 >= u.alto ? 2 : s1 >= u.medio ? 1 : 0;
  const fuertes = valores.filter((v) => v >= content.scoring.umbralFuerte).length;
  if (fuertes >= content.scoring.minFuertesParaSubir) idx = Math.min(3, idx + 1);
  if (resp.factura === 'nolose' && (resp.tarifa === 'nolose' || resp.tarifa === 'privado')) {
    idx = Math.min(idx, 1);
  }
  return niveles[idx];
}
```

- [ ] **Step 5: Wire en `assembleResult` + `leadPayload`**

En `assembleResult`, después de `const resp = estado.respuestas;` calcular:

```js
  const scores = scoreOpportunities(resp, content);
  const ranking = rankOpportunities(scores, content);
  const potencial_general = potencialGeneral(scores, resp, content);
```

Agregar a `leadPayload` (junto a las claves existentes):

```js
    scores,
    ranking,
    potencial_general,
```

Agregar al objeto `res` (junto a `perfil`, `calculo`, ...):

```js
    scores,
    ranking,
    potencial_general,
```

- [ ] **Step 6: Test de wiring end-to-end**

Agregar:

```js
test('assembleResult: expone scores, ranking y potencial_general', () => {
  const res = assembleResult(estadoFx, content);
  assert.equal(typeof res.scores.peak_shaving, 'number');
  assert.equal(res.ranking.length, 6);
  assert.ok(['Muy Alto', 'Alto', 'Medio', 'Bajo'].includes(res.potencial_general));
  assert.equal(res.leadPayload.potencial_general, res.potencial_general);
});
```

- [ ] **Step 7: Correr tests**

Run: `node --test test/`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add js/ test/
git commit -m "Diagnostico v3: scoring 0-100, ranking y potencial general

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Recomendación BESS vs Solar

**Files:**
- Modify: `js/diagnostico.content.js` (agregar `content.recomendaciones`)
- Modify: `js/diagnostico.engine.js` (`recommendSolution`; wire en `assembleResult` + `leadPayload`)
- Test: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: `scores` (Task 3), `rankOpportunities` (Task 3).
- Produces: `recommendSolution(resp, scores, content)` → `{ tipo, razon }`, `tipo ∈ {'BESS','BESS + Solar','Solar primero','No recomendar Solar'}`. `assembleResult(...).recomendacion_solucion` y en `leadPayload`.

- [ ] **Step 1: Tests de recomendación (fallará)**

```js
test('recommendSolution: generacion fisica sin excedente → No recomendar Solar', () => {
  const resp = { ...fx, generacion: 'fisica', disparador: 'costo' };
  const rec = recommendSolution(resp, scoreOpportunities(resp, content), content);
  assert.equal(rec.tipo, 'No recomendar Solar');
});

test('recommendSolution: estacional → BESS + Solar', () => {
  const resp = { ...fx, generacion: 'estacional' };
  assert.equal(recommendSolution(resp, scoreOpportunities(resp, content), content).tipo, 'BESS + Solar');
});

test('recommendSolution: consumo diurno sin generación y bess_solar alto → BESS + Solar', () => {
  const resp = { ...fx, generacion: 'no', perfil: 'diurno' };
  assert.equal(recommendSolution(resp, scoreOpportunities(resp, content), content).tipo, 'BESS + Solar');
});

test('recommendSolution: diurno sin generación y tarifa desconocida → Solar primero', () => {
  const resp = { ...fx, generacion: 'no', perfil: 'diurno', tarifa: 'nolose', factura: 'nolose' };
  assert.equal(recommendSolution(resp, scoreOpportunities(resp, content), content).tipo, 'Solar primero');
});

test('recommendSolution: default → BESS', () => {
  const resp = { ...fx, generacion: 'no', perfil: 'plano', tarifa: 'gdmth' };
  assert.equal(recommendSolution(resp, scoreOpportunities(resp, content), content).tipo, 'BESS');
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `node --test test/diagnostico.engine.test.js`
Expected: FAIL ("recommendSolution is not a function").

- [ ] **Step 3: Agregar `content.recomendaciones`**

```js
  // ---- RECOMENDACIÓN de solución ----
  recomendaciones: {
    noSolar: { tipo: 'No recomendar Solar', razon: 'Ya tienes generación resuelta; sumar más Solar no es tu cuello de botella. El foco es cuánto te cuesta la demanda y cómo aprovechas mejor lo que ya generas — ahí entra el BESS.' },
    estacional: { tipo: 'BESS + Solar', razon: 'Generas parte del año y el resto pagas tarifa completa. La Solar llena ese hueco —coincide con la temporada de más sol— y la batería firma esa generación y ataca el pico.' },
    bessSolarDiurno: { tipo: 'BESS + Solar', razon: 'Tu consumo de día encaja con la generación solar, y la batería te cubre el pico y la tarde-noche. La combinación rinde más que cualquiera de las dos por separado.' },
    solarPrimero: { tipo: 'Solar primero', razon: 'Con consumo diurno y sin datos de tarifa todavía, Solar es la apuesta más robusta para empezar a bajar el recibo; el BESS se dimensiona después con tu perfil real.' },
    bess: { tipo: 'BESS', razon: 'Tu mayor oportunidad está en el pico de demanda y el arbitraje horario, no en generar energía. El BESS ataca eso directo; Solar queda como una fase 2 a evaluar sobre tus números.' }
  },
```

- [ ] **Step 4: Implementar `recommendSolution`**

```js
export function recommendSolution(resp, scores, content) {
  const rec = content.recomendaciones;
  const bs = scores.bess_solar;
  const sinGeneracion = resp.generacion === 'no' || resp.generacion === 'evaluando';
  const tarifaCiega = resp.tarifa === 'nolose' || resp.tarifa === 'privado';
  let key;
  if (resp.generacion === 'fisica' && resp.disparador !== 'excedente') key = 'noSolar';
  else if (resp.generacion === 'estacional') key = 'estacional';
  // Solar primero va ANTES que BESS+Solar: sin datos de tarifa no comprometemos la combinación.
  else if (resp.perfil === 'diurno' && sinGeneracion && tarifaCiega) key = 'solarPrimero';
  else if (bs >= 60 && sinGeneracion && resp.perfil === 'diurno') key = 'bessSolarDiurno';
  else key = 'bess';
  return { tipo: rec[key].tipo, razon: rec[key].razon };
}
```

- [ ] **Step 5: Wire en `assembleResult` + `leadPayload`**

Después de calcular `ranking`/`potencial_general`:

```js
  const recomendacion_solucion = recommendSolution(resp, scores, content);
```

Agregar `recomendacion_solucion,` a `leadPayload` y a `res`.

- [ ] **Step 6: Test de wiring**

```js
test('assembleResult: expone recomendacion_solucion con tipo válido', () => {
  const res = assembleResult(estadoFx, content);
  assert.ok(['BESS', 'BESS + Solar', 'Solar primero', 'No recomendar Solar'].includes(res.recomendacion_solucion.tipo));
  assert.equal(typeof res.recomendacion_solucion.razon, 'string');
});
```

- [ ] **Step 7: Correr tests**

Run: `node --test test/`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add js/ test/
git commit -m "Diagnostico v3: recomendacion explicita BESS vs Solar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Detección de limitaciones + integración al checklist

**Files:**
- Modify: `js/diagnostico.content.js` (`content.limitaciones`, `checklistRefuerzos.factorPotencia`)
- Modify: `js/diagnostico.engine.js` (`detectLimitations`, `buildChecklist`; wire en `assembleResult` + `leadPayload`)
- Test: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: `scores` (Task 3).
- Produces: `detectLimitations(resp, scores, content)` → `[{ dato, porque, no_se_puede }]`. `assembleResult(...).limitaciones` y en `leadPayload`.

- [ ] **Step 1: Tests de limitaciones (fallará)**

```js
test('detectLimitations: factura nolose marca la limitación económica', () => {
  const resp = { ...fx, factura: 'nolose' };
  const lim = detectLimitations(resp, scoreOpportunities(resp, content), content);
  assert.ok(lim.some((l) => /factura/i.test(l.dato)));
  assert.ok(lim.every((l) => l.dato && l.porque && l.no_se_puede));
});

test('detectLimitations: sin datos faltantes → arreglo vacío', () => {
  const resp = { sector: 'manufactura', perfil: 'diurno', generacion: 'fisica', calidad: 'no', tarifa: 'gdmth', factura: 'alto', corte: 'reinicio', disparador: 'costo' };
  assert.deepEqual(detectLimitations(resp, scoreOpportunities(resp, content), content), []);
});

test('detectLimitations: tarifa privado usa la limitación de contrato, no la de tarifa', () => {
  const resp = { ...fx, tarifa: 'privado' };
  const lim = detectLimitations(resp, scoreOpportunities(resp, content), content);
  assert.ok(lim.some((l) => /contrato/i.test(l.dato)));
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `node --test test/diagnostico.engine.test.js`
Expected: FAIL ("detectLimitations is not a function").

- [ ] **Step 3: Agregar `content.limitaciones` y el refuerzo de checklist**

```js
  // ---- LIMITACIONES del diagnóstico ----
  limitaciones: {
    factura: { dato: 'Orden de magnitud de tu factura mensual', porque: 'Sin la escala del recibo no hay base para estimar el rango económico.', no_se_puede: 'Cuantificar el ahorro; sólo priorizar qué palancas aplican.' },
    tarifa: { dato: 'Tu tarifa de CFE', porque: 'Define cuánto pesa el cargo por demanda y si hay diferenciación horaria.', no_se_puede: 'Separar peak shaving de arbitraje ni confirmar elegibilidad de arbitraje.' },
    contrato: { dato: 'Estructura de tu contrato de suministro', porque: 'El arbitraje depende de si hay exposición a precios horarios del mercado.', no_se_puede: 'Confirmar si el margen es tuyo o de tu suministrador.' },
    perfil: { dato: 'Tu perfil horario de consumo', porque: 'Sin saber cuándo consumes no se distingue recortar pico de arbitrar.', no_se_puede: 'Fijar la palanca principal con confianza.' },
    techo: { dato: 'Superficie de techo o terreno disponible', porque: 'Define si la generación solar es viable en el sitio.', no_se_puede: 'Dimensionar un proyecto BESS + Solar.' },
    diesel: { dato: 'Horas al año que corre tu diésel y su costo', porque: 'Es lo que dimensiona el mayor margen del análisis.', no_se_puede: 'Cuantificar la sustitución de diésel.' },
    calidad: { dato: 'Comportamiento de tu calidad eléctrica', porque: 'Define si hay penalización por factor de potencia o riesgo a equipos.', no_se_puede: 'Valorar la palanca de calidad/factor de potencia.' }
  },
```

En `checklistRefuerzos`, agregar la clave `factorPotencia`:

```js
    factorPotencia: 'Recibo con el detalle de penalización por bajo factor de potencia, si aplica',
```

- [ ] **Step 4: Implementar `detectLimitations` y ampliar `buildChecklist`**

```js
export function detectLimitations(resp, scores, content) {
  const L = content.limitaciones;
  const out = [];
  if (resp.factura === 'nolose') out.push(L.factura);
  if (resp.tarifa === 'nolose') out.push(L.tarifa);
  else if (resp.tarifa === 'privado') out.push(L.contrato);
  if (resp.perfil === 'nolose') out.push(L.perfil);
  const sinGeneracion = resp.generacion === 'no' || resp.generacion === 'evaluando';
  if (sinGeneracion && scores.bess_solar >= content.scoring.umbralFuerte) out.push(L.techo);
  if (resp.disparador === 'diesel') out.push(L.diesel);
  if (resp.calidad === 'nolose') out.push(L.calidad);
  return out;
}
```

En `buildChecklist`, dentro del bloque de refuerzos técnicos, **agregar** (sin quitar los existentes):

```js
  if (resp.perfil === 'plano' || resp.perfil === 'punta' || resp.perfil === 'nolose') {
    if (!tecnicos.includes(ref.horario)) tecnicos.push(ref.horario);
  }
  if (resp.generacion === 'evaluando' && !tecnicos.includes(ref.techo)) tecnicos.push(ref.techo);
  if (resp.calidad === 'factor') tecnicos.push(ref.factorPotencia);
```

(Nota: la regla existente `if (resp.sector === 'continuo') tecnicos.push(ref.horario);` puede quedar; el guard `includes` evita duplicar.)

- [ ] **Step 5: Wire en `assembleResult` + `leadPayload`**

```js
  const limitaciones = detectLimitations(resp, scores, content);
```

Agregar `limitaciones,` a `leadPayload` y a `res`.

- [ ] **Step 6: Test de wiring**

```js
test('assembleResult: limitaciones vacías cuando hay datos completos', () => {
  const estado = { respuestas: { sector: 'manufactura', perfil: 'diurno', generacion: 'fisica', calidad: 'no', tarifa: 'gdmth', factura: 'alto', corte: 'reinicio', disparador: 'costo' }, contacto: {} };
  assert.deepEqual(assembleResult(estado, content).limitaciones, []);
});
```

- [ ] **Step 7: Correr tests**

Run: `node --test test/`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add js/ test/
git commit -m "Diagnostico v3: deteccion de limitaciones y refuerzo de checklist

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Palancas guiadas por el ranking

**Files:**
- Modify: `js/diagnostico.content.js` (agregar `content.palancasCopy`, `content.palancasRespaldoVariantes`; eliminar `palancasPrincipal`, `palancaPrincipalDefault`, `palancasSecundaria`, `palancasDescartada`, `palancaDescartadaDefault`)
- Modify: `js/diagnostico.engine.js` (`pickLevers(resp, ranking, content)`; `assembleResult` pasa `ranking`)
- Test: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: `ranking` (Task 3).
- Produces: `pickLevers(resp, ranking, content)` → `{ gancho, principal, secundaria, factorPotencia, descartada }`, cada palanca `{ nombre, text }`.

- [ ] **Step 1: Reescribir los tests de `pickLevers` (fallará)**

Reemplazar **todos** los tests de la sección "BLOQUE C: palancas jerarquizadas" por:

```js
test('pickLevers: principal = tope del ranking; descarte = fondo del ranking', () => {
  const resp = { ...fx, perfil: 'picos', tarifa: 'gdmth', factura: 'alto', disparador: 'costo' };
  const ranking = rankOpportunities(scoreOpportunities(resp, content), content);
  const l = pickLevers(resp, ranking, content);
  assert.equal(l.principal.nombre, content.palancasCopy[ranking[0].id].nombre);
  assert.equal(l.descartada.nombre, content.palancasCopy[ranking[ranking.length - 1].id].nombre);
  assert.ok(l.descartada.text.length > 0);
});

test('pickLevers: respaldo usa la variante de copy según el tipo de corte', () => {
  const resp = { ...fx, corte: 'producto', calidad: 'cortes', disparador: 'costo', perfil: 'plano', generacion: 'fisica' };
  const ranking = rankOpportunities(scoreOpportunities(resp, content), content);
  const l = pickLevers(resp, ranking, content);
  // respaldo debería quedar arriba; si es principal o secundaria, su texto es la variante de producto
  const usaVariante = [l.principal, l.secundaria].some((p) => p && p.text === content.palancasRespaldoVariantes.producto);
  assert.ok(usaVariante, 'debe usar la variante de respaldo por producto');
});

test('pickLevers: secundaria null cuando la 2a oportunidad no supera el umbral', () => {
  const resp = { sector: 'manufactura', perfil: 'plano', generacion: 'fisica', calidad: 'no', tarifa: 'otra', factura: 'bajo', corte: 'nada', disparador: 'costo' };
  const ranking = rankOpportunities(scoreOpportunities(resp, content), content);
  const l = pickLevers(resp, ranking, content);
  if (ranking[1].score < content.scoring.umbralSecundaria) assert.equal(l.secundaria, null);
});

test('pickLevers: gancho solo en salidas sin número', () => {
  const rk = (r) => rankOpportunities(scoreOpportunities(r, content), content);
  assert.equal(pickLevers({ ...fx }, rk(fx), content).gancho, null);
  const nolose = { ...fx, factura: 'nolose' };
  assert.equal(pickLevers(nolose, rk(nolose), content).gancho, content.gancho);
});

test('pickLevers: factor de potencia aditivo solo con calidad=factor', () => {
  const con = { ...fx, calidad: 'factor' };
  assert.ok(pickLevers(con, rankOpportunities(scoreOpportunities(con, content), content), content).factorPotencia);
  const sin = { ...fx, calidad: 'no' };
  assert.equal(pickLevers(sin, rankOpportunities(scoreOpportunities(sin, content), content), content).factorPotencia, null);
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `node --test test/diagnostico.engine.test.js`
Expected: FAIL (`pickLevers` con vieja firma / `palancasCopy` undefined).

- [ ] **Step 3: Agregar `palancasCopy` y `palancasRespaldoVariantes`; eliminar arreglos viejos**

En `js/diagnostico.content.js`, **eliminar** `palancasPrincipal`, `palancaPrincipalDefault`, `palancasSecundaria`, `palancasDescartada`, `palancaDescartadaDefault`. Conservar `gancho` y `palancaFactorPotencia`. Agregar:

```js
  palancasCopy: {
    peak_shaving: {
      nombre: 'Recorte de demanda (peak shaving)',
      principal: 'Tu momento de mayor consumo fija un cargo que pesa sobre toda la factura, aunque dure minutos. Recortarlo con batería es de lo más directo en tu perfil.',
      descarte: 'En tu perfil el recorte de pico rinde poco: tu consumo no está concentrado en picos marcados. No te lo vendemos como el gran ahorro.'
    },
    arbitraje: {
      nombre: 'Arbitraje horario',
      principal: 'Compras energía en horario punta de forma recurrente. Trasladar ese consumo a horas baratas con la batería es tu palanca más fuerte.',
      descarte: 'Salvo que tu consumo esté concentrado en punta, arbitrar entre horarios rinde menos que atacar el pico directo. Lo verificamos con tu desglose horario.'
    },
    bess_solar: {
      nombre: 'BESS + Solar',
      principal: 'Tu consumo y tu perfil dan espacio para generar y almacenar: la batería aprovecha la generación y cubre el pico. Ahí está el mayor valor combinado.',
      descarte: 'Generar energía no es tu cuello de botella hoy; el foco está en la demanda y el pico, no en sumar generación.'
    },
    respaldo: {
      nombre: 'Respaldo',
      principal: 'Un corte te cuesta caro. La batería sostiene la operación en los momentos críticos y protege lo que un apagón se lleva.',
      descarte: 'Si un corte no te cuesta dinero relevante, pagar por continuidad no tiene sentido — tu caso es de costo, no de respaldo.'
    },
    diferimiento: {
      nombre: 'Diferimiento de capacidad',
      principal: 'Ampliar tu acometida con CFE puede tomar meses o años. El almacenamiento te deja crecer sin esperar esa ampliación.',
      descarte: 'No hay una restricción de capacidad que resolver hoy; el diferimiento no es tu palanca.'
    },
    diesel: {
      nombre: 'Sustitución de diésel',
      principal: 'Cada hora de diésel cuesta un múltiplo de la red. Desplazarlo con almacenamiento suele ser la palanca de mayor margen.',
      descarte: 'No dependes de diésel, así que no hay consumo de combustible que desplazar.'
    }
  },
  palancasRespaldoVariantes: {
    producto: 'Un corte te cuesta producto perdido — la batería protege ese inventario en el momento crítico.',
    reinicio: 'Cada paro te cuesta horas de reinicio; la batería evita esa pérdida.',
    servicio: 'Cada hora sin energía es ingreso perdido — la batería lo sostiene.'
  },
```

- [ ] **Step 4: Reescribir `pickLevers` con firma `(resp, ranking, content)`**

Reemplazar la función `pickLevers` completa (y su helper `pick`) por:

```js
function textoPalanca(id, resp, content) {
  if (id === 'respaldo') {
    const v = content.palancasRespaldoVariantes[resp.corte];
    if (v) return v;
  }
  return content.palancasCopy[id].principal;
}

export function pickLevers(resp, ranking, content) {
  const copy = content.palancasCopy;
  const palancaDe = (o) => ({ nombre: copy[o.id].nombre, text: textoPalanca(o.id, resp, content) });

  const principal = palancaDe(ranking[0]);
  const segundo = ranking.find((o, i) => i > 0 && o.score >= content.scoring.umbralSecundaria);
  const secundaria = segundo ? palancaDe(segundo) : null;
  const factorPotencia = resp.calidad === 'factor'
    ? { nombre: content.palancaFactorPotencia.nombre, text: content.palancaFactorPotencia.text }
    : null;
  const ultimo = ranking[ranking.length - 1];
  const descartada = { nombre: copy[ultimo.id].nombre, text: copy[ultimo.id].descarte };
  const gancho = (resp.factura === 'nolose' || resp.tarifa === 'privado') ? content.gancho : null;

  return { gancho, principal, secundaria, factorPotencia, descartada };
}
```

- [ ] **Step 5: `assembleResult` pasa el `ranking` a `pickLevers`**

En `assembleResult`, cambiar la llamada:

```js
  const palancas = pickLevers(resp, ranking, content);
```

(`ranking` ya se calcula en Task 3 antes de esta línea; verificar el orden — mover el cálculo de `scores`/`ranking` arriba de `pickLevers` si hiciera falta.)

- [ ] **Step 6: Correr tests**

Run: `node --test test/`
Expected: PASS. Si el test `assembleResult: fixture end-to-end` asserta nombres de palanca viejos (`'Recorte de demanda'`, `'Continuidad de proceso'`, `'Solar'`), actualizarlos a los del ranking: leer `res.ranking` y asertar contra `content.palancasCopy[res.ranking[0].id].nombre`, p. ej.:

```js
  assert.equal(res.palancas.principal.nombre, content.palancasCopy[res.ranking[0].id].nombre);
  assert.equal(res.palancas.descarte.nombre, content.palancasCopy[res.ranking[res.ranking.length - 1].id].nombre);
```

- [ ] **Step 7: Commit**

```bash
git add js/ test/
git commit -m "Diagnostico v3: palancas guiadas por el ranking de oportunidades

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Presentación de los datos nuevos (nota de la llamada + email a ventas)

**Files:**
- Modify: `js/diagnostico.engine.js` (`buildEventNote`)
- Modify: `api/lead.js` (email: potencial + ranking + recomendación)
- Test: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: `res.ranking`, `res.potencial_general`, `res.recomendacion_solucion`, `res.limitaciones`.
- Produces: la nota del evento cal.diy incluye una sección de priorización; el email del lead incluye potencial/ranking/recomendación.

- [ ] **Step 1: Test de la nota (fallará)**

```js
test('buildEventNote: incluye potencial, ranking y recomendación', () => {
  const res = assembleResult(estadoFx, content);
  assert.ok(res.note.includes('Potencial general'));
  assert.ok(res.note.includes(res.potencial_general));
  assert.ok(res.note.includes(res.recomendacion_solucion.tipo));
  assert.ok(res.note.includes(res.ranking[0].nombre));
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `node --test test/diagnostico.engine.test.js`
Expected: FAIL.

- [ ] **Step 3: Extender `buildEventNote`**

En `js/diagnostico.engine.js`, dentro de `buildEventNote`, insertar una sección de priorización antes de `res.dato_faltante`. Construir estas líneas y agregarlas al arreglo que se une con `\n`:

```js
  const priorizacion = [
    '',
    `Potencial general: ${res.potencial_general}`,
    `Recomendación de solución: ${res.recomendacion_solucion.tipo}`,
    res.recomendacion_solucion.razon,
    '',
    'Ranking de oportunidades:',
    ...res.ranking.map((o, i) => `${i + 1}. ${o.nombre} — ${o.score}`),
    ...(res.limitaciones.length
      ? ['', 'Datos que faltan para cerrar el número:',
         ...res.limitaciones.map((l) => `• ${l.dato}: ${l.no_se_puede}`)]
      : [])
  ];
```

Insertar `...priorizacion,` en el arreglo de retorno de `buildEventNote`, justo antes de la línea `'',` que precede a `res.dato_faltante`.

- [ ] **Step 4: Test del email en api/lead.js (manual/opcional) + extender el email**

En `api/lead.js`, tras leer el body, extraer los nuevos campos:

```js
  const potencial = clean(body.potencial_general, 20);
  const recomendacion = (body.recomendacion_solucion && typeof body.recomendacion_solucion === 'object')
    ? { tipo: clean(body.recomendacion_solucion.tipo, 40), razon: clean(body.recomendacion_solucion.razon, 300) }
    : null;
  const ranking = Array.isArray(body.ranking)
    ? body.ranking.slice(0, 6).map((o) => ({ nombre: clean(o?.nombre, 40), score: Number(o?.score) || 0 }))
    : [];
```

En el bloque `text`, tras la línea del rango estimado, agregar:

```js
    potencial ? `Potencial general: ${potencial}` : null,
    recomendacion ? `Recomendación: ${recomendacion.tipo}` : null,
    ranking.length ? 'Ranking: ' + ranking.map((o) => `${o.nombre} ${o.score}`).join(' · ') : null,
```

En el bloque `html`, tras el `<p>` del perfil/rango, agregar (si hay datos):

```js
    (potencial || recomendacion || ranking.length
      ? `<p style="margin:0 0 16px;font-size:13px;color:#16221A">` +
        (potencial ? `Potencial general: <strong>${esc(potencial)}</strong><br>` : '') +
        (recomendacion ? `Recomendación: <strong>${esc(recomendacion.tipo)}</strong><br>` : '') +
        (ranking.length ? `Ranking: ${esc(ranking.map((o) => `${o.nombre} ${o.score}`).join(' · '))}` : '') +
        `</p>`
      : '') +
```

(Insertarlo concatenado en la construcción de `html`, después del `<p>` existente del perfil.)

- [ ] **Step 5: Correr tests**

Run: `node --test test/`
Expected: PASS.

- [ ] **Step 6: Verificación manual del payload del email**

Run: `node -e "import('./js/diagnostico.engine.js').then(async(e)=>{const c=(await import('./js/diagnostico.content.js')).default;const r=e.assembleResult({respuestas:{sector:'frio',perfil:'punta',generacion:'no',calidad:'cortes',tarifa:'gdmth',factura:'alto',corte:'producto',disparador:'diesel'},contacto:{nombre:'Ana',correo:'a@b.mx'}},c);console.log(JSON.stringify(r.leadPayload,null,2))})"`
Expected: JSON con `scores`, `ranking`, `potencial_general`, `recomendacion_solucion`, `limitaciones` presentes, además de las claves originales (`lead_id`, `perfil`, `rango_texto`, `checklist_full`, ...).

- [ ] **Step 7: Commit**

```bash
git add js/ api/ test/
git commit -m "Diagnostico v3: nota de llamada y email con ranking y recomendacion

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (autor del plan)

**Cobertura del spec:**
- §A set de 8 preguntas → Task 1. ✓
- §B scoring/ranking/potencial → Task 3. ✓
- §C recomendación BESS/Solar → Task 4. ✓
- §D rango por perfil + lenguaje conservador → Task 2. ✓
- §E limitaciones + checklist → Task 5. ✓
- §F palancas por ranking → Task 6. ✓
- §G payload retrocompatible + email → Tasks 3–7 (claves agregadas, nunca quitadas). ✓
- Test "sin voseo" se mantiene; todo el copy nuevo usa tuteo. ✓

**Consistencia de tipos:** `scoreOpportunities`→objeto por id; `rankOpportunities` consume ese objeto; `pickLevers(resp, ranking, content)` consume `ranking`; `recommendSolution(resp, scores, content)` consume `scores` y usa `rankOpportunities` internamente. `assembleResult` calcula `scores`→`ranking`→`potencial_general`→`recomendacion_solucion`→`limitaciones`→`palancas` en ese orden. ✓

**Placeholders:** ninguno; todo el código y las cadenas están completas.

## Notas de ejecución
- `estadoFx` en los tests usa `{ ...fx }`; al cambiar `fx` en Task 1, se propaga solo.
- Si al correr un task una assertion de copy no listada aquí queda roja, actualizar la cadena esperada al nuevo texto (nunca cambiar la lógica para pasar el test).
