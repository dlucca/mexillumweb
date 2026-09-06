# Motor de diagnóstico v4 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuestionario de 6 comunes + 1 propia + 1 condicional por perfil, frenos que ponen un "primer paso" antes de BESS, cuatro salidas independientes (encaje, tamaño, confianza, intención), y pasos posteriores al resultado armados según el caso.

**Architecture:** Se conserva la separación actual: reglas y copy como datos en `js/diagnostico*.content.js`, funciones puras en `js/diagnostico.engine.js`, una sola vista en `js/diagnostico.app.js`, correo en `api/lead.js`. La lógica nueva va en tres módulos chicos que `engine.js` importa y orquesta: `diagnostico.flujo.js` (qué pasos se muestran, antes y después del resultado), `diagnostico.frenos.js` (primer paso) y `diagnostico.salidas.js` (encaje, tamaño, confianza, intención, conectado). Los 5 perfiles de fábrica se definen vía `diagnostico.profile.js`; industria y hoteles son archivos completos y se editan a mano.

**Tech Stack:** JavaScript ES modules sin dependencias, `node --test` (Node 18+), Vercel serverless para `api/`, HTML estático.

**Spec:** `docs/superpowers/specs/2026-09-06-motor-diagnostico-v4-design.md`

## Global Constraints

- Máximo 8 preguntas, mínimo 7, por perfil.
- Copy es-MX, tuteo, sin voseo. Sin emojis en copy.
- Sin dependencias npm nuevas. Todo corre con `npm test` (`node --test test/*.test.js`).
- Cada tarea termina con `npm test` en verde y un commit.
- No tocar `js/diagnostico.roof.js`, `js/diagnostico.facturas.js` ni `api/upload-url.js`.
- Un `null` en una respuesta significa "no aplica" (paso no mostrado). `nolose` significa "no lo sé". Excepción: `corte` en `null` se normaliza a `nada` (no marcar continuidad = un corte no cuesta), ver Tarea 1.
- Microred conserva los códigos de tarifa actuales (`gdmth`, `gdmto`, `gdbt`, `pdbt`, `nolose`, `privado`) y suma `diesel`, `mixto`, `sin_suministro`. No hay mapeo `cfe_*` (simplificación sobre el spec §1.4; el spec se actualiza en la Tarea 2).
- Versiones: industria y hoteles pasan de `2.0` a `3.0`; el default de fábrica pasa de `1.0` a `2.0`.
- Commits terminan con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `js/diagnostico.flujo.js` (nuevo) | `pasoVisible`, `pasosVisibles`, `siguienteIndice`, `anteriorIndice`, `pasosEnriquecimiento`, `familiaEfectiva`. |
| `js/diagnostico.frenos.js` (nuevo) | `applyBrakes(resp, scores, content)`. |
| `js/diagnostico.salidas.js` (nuevo) | `derivarConectado`, `encajeTecnico`, `tamanoOportunidad`, `confianza`, `intencionComercial`. |
| `js/diagnostico.engine.js` | Orquesta. Cambian `normalizeResponses`, `toReadable`, `computeRange`, `recommendSolution`, `buildAnteproyecto`, `detectLimitations`, `assembleResult`. Se quita `potencialGeneral`. |
| `js/diagnostico.profile.js` | Arma 6 comunes + propia + condicional desde la definición. Inserta `continuidad` en `disparador`. |
| `js/diagnostico.content.js`, `js/diagnostico.hoteles.content.js` | Reordenan pasos, agregan `rol`, `when`, `continuidad`, `requisitos`, `limitaciones.consumo/combustible`, `postResult.facturas`, `emailVocabulary.documentos`. |
| `js/diagnostico.{electromovilidad,bombeo,cadena-frio,microred,centros-datos}.content.js` | Pregunta propia, condicional, frenos, vocabulario. |
| `js/diagnostico.app.js` | Navegación condicional, progreso, resultado con primer/segundo paso y 3 salidas, pasos de enriquecimiento por lista, pantalla `consumo`, copy de facturas por perfil. |
| `api/lead.js` | Lee las 4 salidas, freno, `conectado`, `datos_consumo`, `preguntas`. Vocabulario sin CFE cuando no hay CFE. |
| `test/diagnostico.flujo.test.js`, `test/diagnostico.frenos.test.js`, `test/diagnostico.salidas.test.js` (nuevos) | Unitarias de los módulos nuevos. |
| `test/diagnostico.profiles.test.js`, `test/diagnostico.exhaustive.test.js`, `test/diagnostico.engine.test.js`, `test/api.lead*.test.js` | Se adaptan. |

---

### Task 1: Contrato de pasos, `flujo.js` y normalización

**Files:**
- Create: `js/diagnostico.flujo.js`
- Create: `test/diagnostico.flujo.test.js`
- Modify: `js/diagnostico.engine.js` (`normalizeResponses` línea ~541, `toReadable` línea ~71)
- Modify: `js/diagnostico.content.js` (`pasos`, líneas 20-118)
- Modify: `js/diagnostico.hoteles.content.js` (`pasos`, líneas 22-115)
- Modify: `js/diagnostico.profile.js`
- Modify: `test/diagnostico.profiles.test.js`

**Interfaces:**
- Produces: `pasoVisible(paso, resp) -> boolean`, `pasosVisibles(content, resp) -> paso[]`, `siguienteIndice(content, resp, idx) -> number|null`, `anteriorIndice(content, resp, idx) -> number|null`. Cada paso lleva `rol: 'comun'|'propia'|'condicional'` y la condicional lleva `when` (regla de `matchesRule`; `{}` = siempre).
- Produces: `normalizeResponses(resp)` deja `corte = 'nada'` si venía `null`/`undefined`.
- Produces: en `createProfileContent(definition)` los campos nuevos `definition.propia` (paso completo con `key`, `notaLabel`, `pregunta`, `opciones`), `definition.condicional` (paso completo con `when`, opcional), `definition.continuidadCritica` (boolean), `definition.continuityLabel` (string).

- [ ] **Step 1: Escribir la prueba de `flujo.js`**

Crear `test/diagnostico.flujo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pasoVisible, pasosVisibles, siguienteIndice, anteriorIndice } from '../js/diagnostico.flujo.js';

const content = {
  pasos: [
    { key: 'sector', rol: 'comun', opciones: [] },
    { key: 'disparador', rol: 'comun', multi: true, opciones: [] },
    { key: 'calidad', rol: 'propia', opciones: [] },
    { key: 'corte', rol: 'condicional', when: { disparador: 'continuidad' }, opciones: [] }
  ]
};

test('pasoVisible: sin when siempre es visible; when {} también', () => {
  assert.equal(pasoVisible({ key: 'x' }, {}), true);
  assert.equal(pasoVisible({ key: 'x', when: {} }, {}), true);
});

test('pasoVisible: la condicional aparece solo si la regla matchea', () => {
  const corte = content.pasos[3];
  assert.equal(pasoVisible(corte, { disparador: ['costo'] }), false);
  assert.equal(pasoVisible(corte, { disparador: ['continuidad', 'capacidad'] }), true);
});

test('pasosVisibles: 3 sin continuidad, 4 con continuidad', () => {
  assert.equal(pasosVisibles(content, { disparador: ['costo'] }).length, 3);
  assert.equal(pasosVisibles(content, { disparador: ['continuidad'] }).length, 4);
});

test('siguienteIndice salta la condicional oculta y devuelve null al final', () => {
  assert.equal(siguienteIndice(content, { disparador: ['costo'] }, 1), 2);
  assert.equal(siguienteIndice(content, { disparador: ['costo'] }, 2), null);
  assert.equal(siguienteIndice(content, { disparador: ['continuidad'] }, 2), 3);
});

test('anteriorIndice salta la condicional oculta y devuelve null al inicio', () => {
  assert.equal(anteriorIndice(content, { disparador: ['costo'] }, 2), 1);
  assert.equal(anteriorIndice(content, {}, 0), null);
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test test/diagnostico.flujo.test.js`
Expected: FAIL, `Cannot find module '../js/diagnostico.flujo.js'`.

- [ ] **Step 3: Crear `js/diagnostico.flujo.js`**

```js
// Qué pasos se muestran (antes del resultado) y qué pasos de enriquecimiento
// aplican (después). Funciones puras; engine.js y app.js las consumen.
import { matchesRule, hasSignal } from './diagnostico.engine.js';

// Un paso sin `when` siempre se muestra. `when: {}` también (regla vacía = siempre).
export function pasoVisible(paso, resp) {
  if (!paso.when) return true;
  return matchesRule(resp || {}, paso.when);
}

export function pasosVisibles(content, resp) {
  return content.pasos.filter((p) => pasoVisible(p, resp));
}

// Índice (en content.pasos) del siguiente paso visible después de idx, o null.
export function siguienteIndice(content, resp, idx) {
  for (let i = idx + 1; i < content.pasos.length; i += 1) {
    if (pasoVisible(content.pasos[i], resp)) return i;
  }
  return null;
}

// Índice del paso visible anterior a idx, o null si idx es el primero.
export function anteriorIndice(content, resp, idx) {
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (pasoVisible(content.pasos[i], resp)) return i;
  }
  return null;
}

// Familia de anteproyecto efectiva: con freno, la del segundo paso.
export function familiaEfectiva(recomendacion) {
  if (!recomendacion) return 'base';
  if (recomendacion.primerPaso && recomendacion.segundoPaso) return recomendacion.segundoPaso.familia || 'base';
  return recomendacion.familia || 'base';
}

// Pasos después del resultado, en orden. Valores: 'techo' | 'punto' | 'facturas' | 'consumo'.
// `techo` es el mapa con dibujo de áreas (+ punto eléctrico); `punto` es el mapa solo punto.
export function pasosEnriquecimiento(res, content, resp) {
  const fam = familiaEfectiva(res.recomendacion_solucion);
  const post = content.postResult || {};
  const out = [];
  const quiereSolar = ['solar', 'bess_solar', 'off_grid'].includes(fam);
  const quierePunto = ['bess', 'bess_solar', 'off_grid'].includes(fam)
    || hasSignal(resp.disparador, 'capacidad') || !!post.servicePoint;
  if (quiereSolar && !post.skipRoof) out.push('techo');
  else if (quierePunto) out.push('punto');
  if (resp.conectado === false) out.push('consumo');
  else out.push('facturas');
  for (const f of post.forzar || []) {
    if (out.includes(f)) continue;
    if (f === 'punto' && out.includes('techo')) continue;
    if (f === 'techo' && out.includes('punto')) { out[out.indexOf('punto')] = 'techo'; continue; }
    out.unshift(f);
  }
  return out;
}
```

Nota: `engine.js` importará `familiaEfectiva` de aquí en la Tarea 3; la importación circular es segura porque ambos módulos solo exportan funciones (no se ejecutan en carga).

- [ ] **Step 4: Correr la prueba**

Run: `node --test test/diagnostico.flujo.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Escribir el contrato nuevo en `test/diagnostico.profiles.test.js`**

Reemplazar el primer test (líneas 14-23) por:

```js
const COMUNES = ['sector', 'disparador', 'perfil', 'generacion', 'tarifa', 'factura'];

test('todos los perfiles cumplen el contrato 6 comunes + 1 propia + 0/1 condicional', () => {
  for (const content of profiles) {
    const id = content.profile?.id;
    assert.ok(id, 'falta profile.id');
    const comunes = content.pasos.filter((p) => p.rol === 'comun');
    const propias = content.pasos.filter((p) => p.rol === 'propia');
    const condicionales = content.pasos.filter((p) => p.rol === 'condicional');
    assert.deepEqual(comunes.map((p) => p.key), COMUNES, `${id}: comunes`);
    assert.equal(propias.length, 1, `${id}: una propia`);
    assert.ok(condicionales.length <= 1, `${id}: máximo una condicional`);
    assert.ok(content.pasos.length >= 7 && content.pasos.length <= 8, `${id}: 7 u 8 pasos`);
    if (condicionales.length) {
      assert.equal(content.pasos[content.pasos.length - 1].rol, 'condicional', `${id}: condicional al final`);
      assert.equal(typeof condicionales[0].when, 'object', `${id}: condicional con when`);
    }
    const keys = content.pasos.map((p) => p.key);
    assert.equal(new Set(keys).size, keys.length, `${id}: keys únicas`);
    for (const p of content.pasos) {
      const codigos = p.opciones.map((o) => o.codigo);
      assert.equal(new Set(codigos).size, codigos.length, `${id}/${p.key}: códigos únicos`);
      if (!p.multi && p.key !== 'sector') {
        assert.ok(codigos.includes('nolose') || p.opciones.some((o) => o.esNoLoSe), `${id}/${p.key}: falta nolose`);
      }
    }
    const disparador = content.pasos.find((p) => p.key === 'disparador');
    assert.ok(disparador.opciones.some((o) => o.codigo === 'continuidad'), `${id}: disparador sin continuidad`);
    assert.equal(typeof content.resumen?.aplicaFrase?.Alto, 'string', id);
    assert.equal(typeof content.progresoLabel, 'function', id);
  }
});
```

- [ ] **Step 6: Correr y ver que falla**

Run: `node --test test/diagnostico.profiles.test.js`
Expected: FAIL en `comunes` (el orden actual no tiene `disparador` en 2º lugar y no hay `rol`).

- [ ] **Step 7: Reordenar y anotar los pasos en `js/diagnostico.content.js`**

En `pasos` (líneas 20-118) dejar este orden y agregar `rol`/`when`. Los objetos de cada paso no cambian salvo lo indicado:

1. `sector` → agregar `rol: 'comun'`.
2. `disparador` (mover desde el final) → agregar `rol: 'comun'` y, antes de la opción `costo`, la opción:
   `{ label: 'Los cortes o microcortes de energía nos cuestan dinero o servicio', codigo: 'continuidad' }`.
3. `perfil` → `rol: 'comun'`.
4. `generacion` → `rol: 'comun'`.
5. `tarifa` → `rol: 'comun'`.
6. `factura` → `rol: 'comun'`.
7. `calidad` → `rol: 'propia'`.
8. `corte` → `rol: 'condicional', when: { disparador: 'continuidad' }`.

Cambiar `intro.cuerpo`: reemplazar `Ocho preguntas de opción múltiple` por `Siete u ocho preguntas de opción múltiple`.

- [ ] **Step 8: Lo mismo en `js/diagnostico.hoteles.content.js`**

Mismo orden, mismos `rol`/`when`. En `disparador` insertar antes de `costo`:
`{ label: 'Los apagones o microcortes nos cuestan ingresos o experiencia del huésped', codigo: 'continuidad' }`.

- [ ] **Step 9: Sumar peso a `continuidad` en el scoring de respaldo (ambos archivos)**

En `scoring.pesos.respaldo` de `js/diagnostico.content.js` (alrededor de la línea 196) y de `js/diagnostico.hoteles.content.js` (alrededor de la línea 196), dentro del mapa `disparador` (crearlo si no existe) agregar `continuidad: 18`. Ejemplo resultante:

```js
respaldo: {
  corte: { producto: 52, reinicio: 42, servicio: 40, nada: 0 },
  calidad: { cortes: 20, variaciones: 14 },
  disparador: { diesel: 10, continuidad: 18 },   // conservar las claves que ya existan
  // ...resto sin cambios
}
```

- [ ] **Step 10: Reescribir el armado de pasos en `js/diagnostico.profile.js`**

Reemplazar el bloque que empieza en `const commonSteps = {` y termina antes de `merge(content, {` por:

```js
  const continuidadOpcion = {
    label: definition.continuityLabel || 'Los cortes de energía nos cuestan dinero o servicio',
    codigo: 'continuidad'
  };
  const triggerOptions = definition.triggerOptions.some((o) => o.codigo === 'continuidad')
    ? definition.triggerOptions
    : (() => {
        const idx = definition.triggerOptions.findIndex((o) => o.exclusiva);
        const copia = [...definition.triggerOptions];
        copia.splice(idx < 0 ? copia.length : idx, 0, continuidadOpcion);
        return copia;
      })();

  const comunes = [
    {
      key: 'sector', rol: 'comun', notaLabel: definition.sectorNote || 'Tipo de operación',
      pregunta: definition.sectorQuestion,
      opciones: definition.sectors.map(({ label, codigo }) => ({ label, codigo }))
    },
    {
      key: 'disparador', rol: 'comun', notaLabel: 'Objetivo principal', multi: true,
      pregunta: definition.triggerQuestion || 'Además del costo, ¿algo de esto te suena familiar?',
      hint: definition.triggerHint || 'Puedes marcar más de una.',
      opciones: triggerOptions
    },
    {
      key: 'perfil', rol: 'comun', notaLabel: 'Perfil de carga / horario',
      pregunta: definition.profileQuestion || `Pensando en un día típico de ${site}, ¿cómo se comporta el consumo eléctrico?`,
      hint: definition.profileHint || 'No necesitas números — elige la opción que mejor lo describa.',
      opciones: definition.loadProfiles
    },
    {
      key: 'generacion', rol: 'comun', notaLabel: 'Generación propia',
      pregunta: definition.generationQuestion || `¿${definition.generationVerb || 'Generan'} parte de su propia energía?`,
      opciones: definition.generationOptions || COMMON_GENERATION
    },
    {
      key: 'tarifa', rol: 'comun', notaLabel: 'Tarifa o suministro',
      pregunta: definition.tariffQuestion || `Busca el recibo de energía de ${site}. ¿Qué tarifa o suministro tiene?`,
      hint: definition.tariffHint || 'Si es CFE, el código aparece en la carátula del recibo.',
      opciones: definition.tariffOptions || COMMON_TARIFF
    },
    {
      key: 'factura', rol: 'comun', notaLabel: definition.billNote || 'Factura mensual',
      pregunta: definition.billQuestion || `¿Cuánto paga ${site} de electricidad al mes?`,
      hint: definition.billHint || 'Solo lo usamos para estimar el orden de magnitud.',
      opciones: definition.billOptions || COMMON_BILL
    }
  ];

  // Pregunta propia: si la definición no trae una, se usa `calidad` (compatibilidad).
  const propia = definition.propia
    ? { ...clone(definition.propia), rol: 'propia' }
    : {
        key: 'calidad', rol: 'propia', notaLabel: 'Calidad y confiabilidad',
        pregunta: definition.qualityQuestion || `¿Reconoces problemas de calidad o confiabilidad eléctrica en ${site}?`,
        opciones: definition.qualityOptions
      };

  // Condicional: por defecto `corte`, visible con continuidad o si el perfil es de continuidad crítica.
  const condicional = definition.condicional === null
    ? null
    : definition.condicional
      ? { ...clone(definition.condicional), rol: 'condicional' }
      : {
          key: 'corte', rol: 'condicional', notaLabel: 'Impacto de una interrupción',
          when: definition.continuidadCritica ? {} : { disparador: 'continuidad' },
          pregunta: definition.outageQuestion,
          opciones: definition.outageOptions
        };

  const pasos = [...comunes, propia, ...(condicional ? [condicional] : [])];
```

Y en el `merge(content, {...})` reemplazar la línea `pasos: [...].map((key) => commonSteps[key]),` por `pasos,`. Agregar dentro del mismo merge: `continuidadCritica: !!definition.continuidadCritica,`. Cambiar `version: definition.version || '1.0'` por `version: definition.version || '2.0'`.

En `intro` de los 5 perfiles de fábrica (cada `*.content.js`), reemplazar `Ocho preguntas` por `Siete u ocho preguntas`.

- [ ] **Step 11: Normalizar `corte` y hacer `toReadable` consciente de visibilidad en `engine.js`**

En `normalizeResponses` (línea ~541) dejar:

```js
export function normalizeResponses(resp) {
  const out = { ...resp };
  if (out.generacion === 'fisica') out.generacion = 'solar_sitio';
  out.disparador = asList(out.disparador);
  // Condicional `corte` no mostrada: no marcar continuidad significa que un corte no cuesta.
  if (out.corte == null) out.corte = 'nada';
  return out;
}
```

En `toReadable` cambiar `for (const paso of content.pasos) {` por:

```js
  for (const paso of content.pasos) {
    if (paso.when && !matchesRule(resp, paso.when)) continue; // condicional no mostrada
```

(`matchesRule` ya está definida arriba en el mismo archivo.)

- [ ] **Step 12: Correr todas las pruebas**

Run: `npm test`
Expected: PASS salvo `diagnostico.exhaustive.test.js` y quizá `diagnostico.engine.test.js` (fixtures con `corte` explícito siguen funcionando). Si `toReadable` rompe un test del engine que espera `legibles.corte` con `disparador: 'costo'`, cambiar ese fixture a `disparador: ['continuidad']`, no la función. `exhaustive` se reescribe en la Tarea 7; si falla aquí, marcarlo `{ skip: true }` temporalmente con un comentario `// se reescribe en v4 Tarea 7`.

- [ ] **Step 13: Commit**

```bash
git add js/diagnostico.flujo.js js/diagnostico.engine.js js/diagnostico.profile.js js/diagnostico.content.js js/diagnostico.hoteles.content.js js/diagnostico.*.content.js test/diagnostico.flujo.test.js test/diagnostico.profiles.test.js test/diagnostico.exhaustive.test.js
git commit -m "feat(diagnostico): contrato 6 comunes + propia + condicional; flujo.js

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `conectado`, microred sin CFE y `salidas.js`

**Files:**
- Create: `js/diagnostico.salidas.js`
- Create: `test/diagnostico.salidas.test.js`
- Modify: `js/diagnostico.engine.js` (`normalizeResponses`, `computeRange` línea ~125, `detectLimitations` línea ~288, `recommendSolution` rama `offGrid`, `assembleResult` `rango_texto`)
- Modify: `js/diagnostico.microred.content.js` (`tariffOptions`, `sinRedPosible`)
- Modify: `js/diagnostico.content.js` y `js/diagnostico.hoteles.content.js` (`limitaciones.consumo`, `limitaciones.combustible`, `requisitos`)
- Modify: `docs/superpowers/specs/2026-09-06-motor-diagnostico-v4-design.md` §1.4 (nota sobre códigos)

**Interfaces:**
- Produces: `derivarConectado(resp, content) -> true|false|null`; `normalizeResponses(resp, content)` (segundo parámetro nuevo, opcional) deja `out.conectado`.
- Produces: `encajeTecnico(scores, content) -> 'Bajo'|'Medio'|'Alto'|'Muy Alto'`, `tamanoOportunidad(resp, content) -> 'Sin cuantificar'|'Chico'|'Medio'|'Grande'`, `confianza(resp, recomendacion, extras, content) -> { nivel, faltantes }` con `extras = { techo, consumo }` booleanos, `intencionComercial(resp, estado) -> 'Explorando'|'Evaluando'|'Activo'`.
- Produces: `content.requisitos` con claves `base`, `bess`, `solar`, `bess_solar`, `off_grid`.

- [ ] **Step 1: Escribir `test/diagnostico.salidas.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';
import microred from '../js/diagnostico.microred.content.js';
import {
  derivarConectado, encajeTecnico, tamanoOportunidad, confianza, intencionComercial
} from '../js/diagnostico.salidas.js';

test('derivarConectado: CFE → true; aislado o diésel/sin suministro → false', () => {
  assert.equal(derivarConectado({ tarifa: 'gdmth', disparador: ['costo'] }, content), true);
  assert.equal(derivarConectado({ tarifa: 'gdmth', disparador: ['aislado'] }, content), false);
  assert.equal(derivarConectado({ tarifa: 'diesel', disparador: ['costo'] }, microred), false);
  assert.equal(derivarConectado({ tarifa: 'sin_suministro', disparador: ['costo'] }, microred), false);
  assert.equal(derivarConectado({ tarifa: 'mixto', disparador: ['costo'] }, microred), true);
});

test('derivarConectado: tarifa nolose es null solo donde la red es incierta (microred)', () => {
  assert.equal(derivarConectado({ tarifa: 'nolose', disparador: ['costo'] }, content), true);
  assert.equal(derivarConectado({ tarifa: 'nolose', disparador: ['costo'] }, microred), null);
});

test('encajeTecnico depende solo de los scores', () => {
  const u = content.scoring;
  assert.equal(encajeTecnico({ a: u.umbralPotencial.medio - 1 }, content), 'Bajo');
  assert.equal(encajeTecnico({ a: u.umbralPotencial.medio }, content), 'Medio');
  assert.equal(encajeTecnico({ a: u.umbralFuerte }, content), 'Alto');
  assert.equal(encajeTecnico({ a: u.umbralPotencial.muyAlto, b: 10 }, content), 'Alto');
  assert.equal(encajeTecnico({ a: u.umbralPotencial.muyAlto, b: u.umbralFuerte }, content), 'Muy Alto');
});

test('tamanoOportunidad depende solo de factura, tarifa y conectado', () => {
  assert.equal(tamanoOportunidad({ factura: 'alto', tarifa: 'gdmth', conectado: true }, content), 'Grande');
  assert.equal(tamanoOportunidad({ factura: 'muyalto', tarifa: 'gdmto', conectado: true }, content), 'Grande');
  assert.equal(tamanoOportunidad({ factura: 'medio', tarifa: 'gdbt', conectado: true }, content), 'Medio');
  assert.equal(tamanoOportunidad({ factura: 'bajo', tarifa: 'dist', conectado: true }, content), 'Chico');
  assert.equal(tamanoOportunidad({ factura: 'alto', tarifa: 'nolose', conectado: true }, content), 'Sin cuantificar');
  assert.equal(tamanoOportunidad({ factura: 'alto', tarifa: 'privado', conectado: true }, content), 'Sin cuantificar');
  assert.equal(tamanoOportunidad({ factura: 'nolose', tarifa: 'gdmth', conectado: true }, content), 'Sin cuantificar');
  assert.equal(tamanoOportunidad({ factura: 'alto', tarifa: 'gdmth', conectado: false }, content), 'Sin cuantificar');
});

test('confianza: cuenta faltantes según los requisitos de la familia', () => {
  const rec = { familia: 'bess_solar', primerPaso: false };
  const ok = confianza({ perfil: 'diurno', tarifa: 'gdmth', factura: 'alto' }, rec, { techo: true }, content);
  assert.equal(ok.nivel, 'Alta');
  assert.deepEqual(ok.faltantes, []);
  const uno = confianza({ perfil: 'diurno', tarifa: 'gdmth', factura: 'alto' }, rec, { techo: false }, content);
  assert.equal(uno.nivel, 'Media');
  assert.deepEqual(uno.faltantes, ['techo']);
  const dos = confianza({ perfil: 'nolose', tarifa: 'gdmth', factura: 'nolose' }, rec, { techo: true }, content);
  assert.equal(dos.nivel, 'Baja');
  assert.deepEqual(dos.faltantes, ['perfil', 'factura']);
});

test('confianza: con freno usa los requisitos del freno', () => {
  const rec = { familia: 'primer_paso', primerPaso: true, requisitos: ['gestion_carga', 'perfil'] };
  assert.equal(confianza({ gestion_carga: 'manual', perfil: 'picos' }, rec, {}, content).nivel, 'Alta');
  assert.equal(confianza({ gestion_carga: 'manual', perfil: 'nolose' }, rec, {}, content).nivel, 'Media');
});

test('confianza: off_grid exige consumo', () => {
  const rec = { familia: 'off_grid', primerPaso: false };
  const r = confianza({ fuente: 'diesel_24h', factura: 'medio' }, rec, { consumo: false }, content);
  assert.deepEqual(r.faltantes, ['consumo']);
});

test('intencionComercial', () => {
  assert.equal(intencionComercial({ disparador: ['costo'] }, {}), 'Explorando');
  assert.equal(intencionComercial({ disparador: ['capacidad'] }, {}), 'Evaluando');
  assert.equal(intencionComercial({ disparador: ['costo'] }, { enrichmentDone: true }), 'Activo');
  assert.equal(intencionComercial({ disparador: ['costo'] }, { contacto: { tipo_cierre: 'llamada' } }), 'Activo');
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test test/diagnostico.salidas.test.js`
Expected: FAIL, módulo no existe.

- [ ] **Step 3: Crear `js/diagnostico.salidas.js`**

```js
// Las cuatro salidas independientes del diagnóstico (spec v4 §2.2) y `conectado`.
// Funciones puras. Ninguna mezcla las entradas de otra.
import { hasSignal } from './diagnostico.engine.js';

const SIN_RED = ['diesel', 'sin_suministro'];

// true: hay CFE o suministrador. false: sitio sin red. null: no se sabe (solo microred con tarifa nolose).
export function derivarConectado(resp, content) {
  if (hasSignal(resp.disparador, 'aislado')) return false;
  if (SIN_RED.includes(resp.tarifa)) return false;
  if (resp.tarifa === 'nolose' && content?.sinRedPosible) return null;
  return true;
}

export function encajeTecnico(scores, content) {
  const u = content.scoring.umbralPotencial;
  const valores = Object.values(scores);
  const s1 = valores.length ? Math.max(...valores) : 0;
  const fuertes = valores.filter((v) => v >= content.scoring.umbralFuerte).length;
  if (s1 < u.medio) return 'Bajo';
  if (s1 < content.scoring.umbralFuerte) return 'Medio';
  if (s1 >= u.muyAlto && fuertes >= 2) return 'Muy Alto';
  return 'Alto';
}

export function tamanoOportunidad(resp, content) {
  const cuantificable = (content.scoring.tarifasCuantificables || []).includes(resp.tarifa);
  if (resp.conectado === false || resp.factura === 'nolose' || !cuantificable) return 'Sin cuantificar';
  if (resp.factura === 'bajo') return 'Chico';
  if (resp.factura === 'medio') return 'Medio';
  return 'Grande';
}

// `extras`: { techo: boolean, consumo: boolean } — datos de enriquecimiento presentes.
export function confianza(resp, recomendacion, extras, content) {
  const ext = extras || {};
  const requisitos = recomendacion?.primerPaso
    ? (recomendacion.requisitos || [])
    : (content.requisitos?.[recomendacion?.familia] || content.requisitos?.base || []);
  const faltantes = requisitos.filter((req) => {
    if (req === 'techo') return !ext.techo;
    if (req === 'consumo') return !ext.consumo;
    const v = resp[req];
    return v == null || v === '' || v === 'nolose';
  });
  const nivel = faltantes.length === 0 ? 'Alta' : (faltantes.length === 1 ? 'Media' : 'Baja');
  return { nivel, faltantes };
}

const SENALES_EVALUANDO = ['capacidad', 'diesel', 'continuidad', 'aislado'];

export function intencionComercial(resp, estado) {
  const e = estado || {};
  if (e.enrichmentDone || e.contacto?.tipo_cierre === 'llamada') return 'Activo';
  if (SENALES_EVALUANDO.some((s) => hasSignal(resp.disparador, s))) return 'Evaluando';
  return 'Explorando';
}
```

- [ ] **Step 4: Agregar `requisitos` y limitaciones nuevas a `content.js` y `hoteles.content.js`**

En ambos archivos, después de `limitaciones: { ... }` agregar dentro del objeto `limitaciones` dos entradas:

```js
    consumo: { dato: 'Consumo del sitio (kWh al día o al mes) y potencia pico', porque: 'Un sitio sin red se dimensiona sobre el consumo, no sobre la factura.', no_se_puede: 'Dimensionar la generación ni el almacenamiento.' },
    combustible: { dato: 'Litros y costo de diésel al mes, y horas de operación del generador', porque: 'Es lo que define el ahorro de sustituir combustible.', no_se_puede: 'Cuantificar la sustitución de diésel.' },
```

Y como nueva clave de nivel superior del `content` (junto a `resumen`):

```js
  // Qué respuestas o datos necesita cada recomendación para que la confianza sea Alta (spec v4 §2.2).
  requisitos: {
    base: ['perfil', 'tarifa', 'factura'],
    bess: ['perfil', 'tarifa', 'factura'],
    solar: ['perfil', 'generacion', 'techo'],
    bess_solar: ['perfil', 'tarifa', 'factura', 'techo'],
    off_grid: ['fuente', 'factura', 'consumo']
  },
```

- [ ] **Step 5: Microred: opciones de suministro y `sinRedPosible`**

En `js/diagnostico.microred.content.js` reemplazar `tariffOptions: sharedOptions.tariff.map(...)` por:

```js
  tariffQuestion: '¿Cómo se paga hoy la energía de tu sitio?',
  tariffHint: 'Si hay recibo de CFE, el código aparece en la carátula.',
  tariffOptions: [
    { label: 'CFE en media tensión horaria (GDMTH)', codigo: 'gdmth' },
    { label: 'CFE en media tensión ordinaria (GDMTO)', codigo: 'gdmto' },
    { label: 'CFE en baja tensión (GDBT o PDBT)', codigo: 'gdbt' },
    { label: 'Solo generamos con diésel o gas (sin CFE)', codigo: 'diesel' },
    { label: 'CFE y diésel combinados', codigo: 'mixto' },
    { label: 'Hoy no hay suministro eléctrico', codigo: 'sin_suministro' },
    { label: 'Suministrador privado o calificado', codigo: 'privado' },
    { label: 'No lo sé o no tengo recibo', codigo: 'nolose' }
  ],
```

(La línea `tariffQuestion` ya existe; dejar una sola.) Y en `overrides` agregar `sinRedPosible: true,` como primera línea.

En `engine.js`, `computeRange` (línea ~125): agregar como primera línea del cuerpo
`if (resp.conectado === false || resp.tarifa === 'diesel' || resp.tarifa === 'mixto' || resp.tarifa === 'sin_suministro') return { sinNumero: 'aislado', piso: null, techo: null };`.
En `renderBlockB` la rama `sinNumero` ya devuelve texto por clave; agregar en el mapa de mensajes de `content.bloqueB` (buscar la clave `privado:` dentro de `bloqueB.sinNumero` o equivalente en los dos content completos) la entrada
`aislado: 'Tu sitio se dimensiona por consumo y combustible, no por factura de CFE. Con tus kWh al día y tus litros de diésel podemos poner número.'`.
Si `renderBlockB` indexa los mensajes por otro nombre, usar ese nombre; el requisito es que `sinNumero: 'aislado'` produzca ese texto y no lance.
En `assembleResult`, en el mapa de `rango_texto`, agregar `aislado: 'Sitio sin red — se dimensiona por consumo, sin rango de factura'`.

- [ ] **Step 6: `normalizeResponses(resp, content)` deriva `conectado`; `recommendSolution` y `detectLimitations` lo usan**

En `engine.js` importar arriba: `import { derivarConectado } from './diagnostico.salidas.js';`.

`normalizeResponses`:

```js
export function normalizeResponses(resp, content) {
  const out = { ...resp };
  if (out.generacion === 'fisica') out.generacion = 'solar_sitio';
  out.disparador = asList(out.disparador);
  if (out.corte == null) out.corte = 'nada';
  out.conectado = derivarConectado(out, content);
  return out;
}
```

En `recommendSolution` cambiar `else if (hasSignal(resp.disparador, 'aislado')) key = 'offGrid';` por
`else if (hasSignal(resp.disparador, 'aislado') || resp.conectado === false) key = 'offGrid';`.

`detectLimitations` completa:

```js
export function detectLimitations(resp, scores, content, recomendacion) {
  const L = content.limitaciones;
  const out = [];
  const sinRed = resp.conectado === false;
  // Sitio sin red: lo primero es consumo y combustible; la factura de CFE no aplica.
  if (sinRed) {
    out.push(L.consumo || L.aislado);
    if (L.combustible && (hasSignal(resp.disparador, 'diesel') || ['diesel', 'mixto', 'diesel_24h', 'diesel_parcial'].includes(resp.tarifa) || ['diesel_24h', 'diesel_parcial'].includes(resp.fuente))) out.push(L.combustible);
  } else {
    if (resp.factura === 'nolose') out.push(L.factura);
    if (resp.tarifa === 'nolose') out.push(L.tarifa);
    else if (resp.tarifa === 'privado') out.push(L.contrato);
  }
  if (resp.perfil === 'nolose') out.push(L.perfil);
  const sinGeneracion = resp.generacion === 'no' || resp.generacion === 'evaluando' || resp.generacion === 'contrato';
  const solarPrimero = ['Solar primero', 'Solar fotovoltaico on-grid'].includes(recomendacion?.tipo);
  if (sinGeneracion && (scores.bess_solar >= content.scoring.umbralFuerte || solarPrimero)) out.push(L.techo);
  if (!sinRed && hasSignal(resp.disparador, 'diesel')) out.push(L.diesel);
  if (sinRed && !out.includes(L.techo)) out.push(L.techo); // una microred necesita superficie para generar
  if (resp.calidad === 'nolose') out.push(L.calidad);
  return out;
}
```

En `assembleResult` cambiar `const resp = normalizeResponses(estado.respuestas);` por `const resp = normalizeResponses(estado.respuestas, content);`.

- [ ] **Step 7: Actualizar el spec §1.4**

En `docs/superpowers/specs/2026-09-06-motor-diagnostico-v4-design.md`, en §1.4 reemplazar el primer bullet por:
"`tarifa` → opciones: `gdmth`, `gdmto`, `gdbt` (CFE, códigos actuales), `diesel`, `mixto`, `sin_suministro`, `privado`, `nolose`. No hay mapeo `cfe_*`. `content.sinRedPosible: true` marca que `nolose` puede significar 'sin red'."

- [ ] **Step 8: Correr todo**

Run: `npm test`
Expected: PASS (salvo exhaustive si quedó en skip). Si `detectLimitations` rompe un test del engine con `disparador: 'aislado'` que esperaba `L.aislado` primero: ajustar la expectativa a `L.consumo` (ese es el cambio de spec §2.3).

- [ ] **Step 9: Commit**

```bash
git add js/diagnostico.salidas.js js/diagnostico.engine.js js/diagnostico.content.js js/diagnostico.hoteles.content.js js/diagnostico.microred.content.js test/diagnostico.salidas.test.js test/diagnostico.engine.test.js docs/superpowers/specs/2026-09-06-motor-diagnostico-v4-design.md
git commit -m "feat(diagnostico): conectado, microred sin CFE y salidas.js (encaje, tamaño, confianza, intención)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Preguntas propias, frenos y `recommendSolution` con primer paso

**Files:**
- Create: `js/diagnostico.frenos.js`
- Create: `test/diagnostico.frenos.test.js`
- Modify: `js/diagnostico.electromovilidad.content.js`, `js/diagnostico.bombeo.content.js`, `js/diagnostico.cadena-frio.content.js`, `js/diagnostico.microred.content.js`, `js/diagnostico.centros-datos.content.js`
- Modify: `js/diagnostico.engine.js` (`recommendSolution`, `buildAnteproyecto`, `assembleResult`)

**Interfaces:**
- Consumes: `encajeTecnico` (Tarea 2), `familiaEfectiva` (Tarea 1).
- Produces: `applyBrakes(resp, scores, content) -> freno|null` donde `freno = { id, tipo, razon, despues, requisitos[], anteproyecto: { interno[], lead[] } }`.
- Produces: `recommendSolution(resp, scores, content, aplicacion, freno)` devuelve `{ tipo, razon, familia, primerPaso: boolean, freno: id|null, requisitos?, segundoPaso?: { tipo, razon, familia } }`.
- Produces: `content.frenos[]` en cada perfil de fábrica.

- [ ] **Step 1: Escribir `test/diagnostico.frenos.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ev from '../js/diagnostico.electromovilidad.content.js';
import bombeo from '../js/diagnostico.bombeo.content.js';
import frio from '../js/diagnostico.cadena-frio.content.js';
import cd from '../js/diagnostico.centros-datos.content.js';
import { applyBrakes } from '../js/diagnostico.frenos.js';
import { recommendSolution, scoreOpportunities, normalizeResponses, assembleResult } from '../js/diagnostico.engine.js';

const fuerte = (content) => {
  const s = {};
  for (const o of content.scoring.oportunidades) s[o.id] = 0;
  s.peak_shaving = content.scoring.umbralFuerte + 5;
  return s;
};

test('EV: reprogramable sin sistema + capacidad → gestión de carga primero', () => {
  const resp = normalizeResponses({ sector: 'flotilla', disparador: ['capacidad'], perfil: 'diurno', generacion: 'no', tarifa: 'gdmth', factura: 'medio', gestion_carga: 'manual' }, ev);
  const f = applyBrakes(resp, fuerte(ev), ev);
  assert.equal(f?.id, 'gestion_carga_primero');
});

test('EV: con sistema de gestión no hay freno', () => {
  const resp = normalizeResponses({ sector: 'flotilla', disparador: ['capacidad'], perfil: 'picos', generacion: 'no', tarifa: 'gdmth', factura: 'medio', gestion_carga: 'sistema' }, ev);
  assert.equal(applyBrakes(resp, fuerte(ev), ev), null);
});

test('nunca hay freno con aislado ni con encaje Bajo', () => {
  const resp = normalizeResponses({ sector: 'flotilla', disparador: ['capacidad', 'aislado'], perfil: 'picos', gestion_carga: 'manual', tarifa: 'gdmth', factura: 'medio' }, ev);
  assert.equal(applyBrakes(resp, fuerte(ev), ev), null);
  const bajo = normalizeResponses({ sector: 'flotilla', disparador: ['capacidad'], perfil: 'picos', gestion_carga: 'manual', tarifa: 'gdmth', factura: 'medio' }, ev);
  const scoresBajos = Object.fromEntries(ev.scoring.oportunidades.map((o) => [o.id, 5]));
  assert.equal(applyBrakes(bajo, scoresBajos, ev), null);
});

test('bombeo, frío y centros de datos tienen su freno', () => {
  const b = normalizeResponses({ sector: 'pozo', disparador: ['costo'], perfil: 'punta', hidraulica: 'tanque_sin_horario', tarifa: 'gdmth', factura: 'medio' }, bombeo);
  assert.equal(applyBrakes(b, fuerte(bombeo), bombeo)?.id, 'optimizacion_hidraulica_primero');
  const f = normalizeResponses({ sector: 'alimentos', disparador: ['costo'], perfil: 'picos', compresores: 'viejos_sin_control', tarifa: 'gdmth', factura: 'medio' }, frio);
  assert.equal(applyBrakes(f, fuerte(frio), frio)?.id, 'eficiencia_primero');
  const c = normalizeResponses({ sector: 'edge', disparador: ['costo'], perfil: 'plano', respaldo_actual: 'nada', tarifa: 'gdmth', factura: 'medio' }, cd);
  assert.equal(applyBrakes(c, fuerte(cd), cd)?.id, 'respaldo_basico_primero');
});

test('recommendSolution con freno: primer paso + segundo paso', () => {
  const estado = { respuestas: { sector: 'flotilla', disparador: ['capacidad'], perfil: 'picos', generacion: 'no', tarifa: 'gdmth', factura: 'alto', gestion_carga: 'manual' } };
  const res = assembleResult(estado, ev);
  const rec = res.recomendacion_solucion;
  assert.equal(rec.primerPaso, true);
  assert.equal(rec.freno, 'gestion_carga_primero');
  assert.equal(rec.familia, 'primer_paso');
  assert.ok(rec.segundoPaso?.tipo, 'hay segundo paso');
  assert.ok(/BESS/.test(rec.segundoPaso.tipo));
  assert.ok(res.anteproyecto.interno.some((l) => /horario|ventana/i.test(l)), 'anteproyecto incluye datos del freno');
});

test('recommendSolution sin freno conserva la salida de hoy', () => {
  const estado = { respuestas: { sector: 'flotilla', disparador: ['capacidad'], perfil: 'picos', generacion: 'no', tarifa: 'gdmth', factura: 'alto', gestion_carga: 'sistema' } };
  const rec = assembleResult(estado, ev).recomendacion_solucion;
  assert.equal(rec.primerPaso, false);
  assert.equal(rec.freno, null);
  assert.equal(rec.segundoPaso, undefined);
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test test/diagnostico.frenos.test.js`
Expected: FAIL, módulo no existe.

- [ ] **Step 3: Crear `js/diagnostico.frenos.js`**

```js
// Frenos: un "primer paso" que va antes de BESS/Solar cuando la respuesta propia del
// perfil lo indica (spec v4 §2.1). Las reglas viven en content.frenos; aquí solo se evalúan.
import { matchesRule, hasSignal } from './diagnostico.engine.js';
import { encajeTecnico } from './diagnostico.salidas.js';

export function applyBrakes(resp, scores, content) {
  const frenos = content.frenos || [];
  if (!frenos.length) return null;
  if (hasSignal(resp.disparador, 'aislado') || resp.conectado === false) return null;
  if (encajeTecnico(scores, content) === 'Bajo') return null;
  const f = frenos.find((r) => matchesRule(resp, r));
  if (!f) return null;
  return {
    id: f.id, tipo: f.tipo, razon: f.razon, despues: f.despues || 'bess',
    requisitos: f.requisitos || [],
    anteproyecto: { interno: f.anteproyecto?.interno || [], lead: f.anteproyecto?.lead || [] }
  };
}
```

- [ ] **Step 4: Electromovilidad: propia, condicional y freno**

En `js/diagnostico.electromovilidad.content.js`, dentro de `createProfileContent({ ... })`:

- Quitar `qualityQuestion` y `qualityOptions`.
- Agregar:

```js
  propia: {
    key: 'gestion_carga', notaLabel: 'Gestión de la carga',
    pregunta: '¿Puedes mover o escalonar la carga de los vehículos?',
    hint: 'Piensa si los vehículos podrían cargar en otro horario o por turnos.',
    opciones: [
      { codigo: 'sistema', label: 'Sí, ya tenemos un sistema de gestión de carga (software)' },
      { codigo: 'manual', label: 'Podríamos reprogramar horarios, pero no tenemos sistema' },
      { codigo: 'fija', label: 'No, las ventanas de carga no se pueden mover' },
      { codigo: 'nolose', label: 'No lo sabemos todavía' }
    ]
  },
  condicional: {
    key: 'crecimiento', notaLabel: 'Crecimiento previsto',
    when: { disparador: 'capacidad' },
    pregunta: '¿Cuántos vehículos o kW de carga nuevos vienen en los próximos 12 meses?',
    opciones: [
      { codigo: 'pocos', label: 'Menos de 10 vehículos o menos de 100 kW' },
      { codigo: 'medios', label: 'Entre 10 y 50 vehículos, o 100 a 500 kW' },
      { codigo: 'muchos', label: 'Más de 50 vehículos o más de 500 kW' },
      { codigo: 'nolose', label: 'Aún no lo definimos' }
    ]
  },
  continuityLabel: 'Una interrupción de la carga nos cuesta rutas o servicio',
```

- En `overrides` agregar:

```js
    frenos: [
      {
        id: 'gestion_carga_primero',
        when: { gestion_carga: 'manual' },
        anyOf: [{ disparador: 'capacidad' }, { perfil: 'picos' }],
        tipo: 'Gestión de carga primero',
        razon: 'Tus vehículos podrían cargar en otro horario o por turnos y hoy no hay un sistema que lo haga. Escalonar y limitar la carga con software suele bajar el pico sin comprar baterías. Primero se valida eso; el BESS entra después, si el pico que queda sigue siendo caro o falta potencia.',
        despues: 'bess',
        requisitos: ['gestion_carga', 'perfil'],
        anteproyecto: {
          interno: ['Ventanas de llegada y salida de los vehículos, y tiempo mínimo conectado.', 'Potencia de cada cargador y simultaneidad real observada.'],
          lead: ['A qué horas llegan y salen los vehículos.', 'Cuántos cargadores tienes y de qué potencia.']
        }
      }
    ],
```

- [ ] **Step 5: Bombeo**

En `js/diagnostico.bombeo.content.js`: quitar `qualityQuestion`/`qualityOptions`; agregar:

```js
  propia: {
    key: 'hidraulica', notaLabel: 'Almacenamiento hidráulico',
    pregunta: '¿Tienes tanque o almacenamiento de agua, y bombeas con horario?',
    opciones: [
      { codigo: 'tanque_sin_horario', label: 'Hay tanque, pero bombeamos cuando hace falta, sin programar' },
      { codigo: 'tanque_programado', label: 'Hay tanque y ya bombeamos en horario barato' },
      { codigo: 'sin_tanque', label: 'No hay almacenamiento; bombeamos directo a la demanda' },
      { codigo: 'nolose', label: 'No lo sé' }
    ]
  },
  continuityLabel: 'Un paro del bombeo nos cuesta servicio, cultivo o proceso',
```

y en `overrides`:

```js
    frenos: [
      {
        id: 'optimizacion_hidraulica_primero',
        when: { hidraulica: 'tanque_sin_horario', perfil: ['picos', 'punta'] },
        tipo: 'Optimización hidráulica primero',
        razon: 'Tienes tanque y bombeas sin horario. Programar el bombeo para llenar en horas baratas y usar variadores para escalonar arranques suele mover el consumo fuera del pico sin baterías. Primero se valida eso; el BESS entra después, si el pico que queda sigue siendo caro.',
        despues: 'bess',
        requisitos: ['hidraulica', 'perfil'],
        anteproyecto: {
          interno: ['Volumen del tanque, niveles mínimo y máximo, y caudal de las bombas.', 'Horario de demanda de agua y si hay variadores instalados.'],
          lead: ['Cuánta agua guarda tu tanque y cuánto tarda en llenarse.', 'A qué horas se necesita más agua.']
        }
      }
    ],
```

- [ ] **Step 6: Cadena de frío**

En `js/diagnostico.cadena-frio.content.js`: quitar `qualityQuestion`/`qualityOptions`; agregar `continuidadCritica: true,` y:

```js
  propia: {
    key: 'compresores', notaLabel: 'Compresores y control',
    pregunta: '¿Cómo están tus compresores y su control?',
    opciones: [
      { codigo: 'viejos_sin_control', label: 'Más de 15 años o sin control de capacidad (arrancan y paran a tope)' },
      { codigo: 'modernos_con_control', label: 'Recientes, con variadores o control de capacidad' },
      { codigo: 'mixto', label: 'Una mezcla de equipos viejos y nuevos' },
      { codigo: 'nolose', label: 'No lo sé' }
    ]
  },
  continuityLabel: 'Un corte pone en riesgo temperatura o producto',
```

y en `overrides`:

```js
    frenos: [
      {
        id: 'eficiencia_primero',
        when: { compresores: 'viejos_sin_control', perfil: ['picos', 'diurno', 'plano'] },
        tipo: 'Eficiencia en refrigeración primero',
        razon: 'Tus compresores son viejos o no tienen control de capacidad. Modernizar el control (variadores, secuenciación, deshielo programado) suele bajar el consumo y el pico más barato que almacenar energía. Primero se valida eso; el BESS entra después, sobre el pico que quede.',
        despues: 'bess',
        requisitos: ['compresores', 'perfil'],
        anteproyecto: {
          interno: ['Inventario de compresores: capacidad, edad y tipo de control.', 'Registro de temperatura y ciclos de deshielo.'],
          lead: ['Cuántos compresores tienes y qué edad tienen.', 'Si sabes cuándo hacen deshielo las cámaras.']
        }
      }
    ],
```

- [ ] **Step 7: Microred**

En `js/diagnostico.microred.content.js`: quitar `qualityQuestion`/`qualityOptions`; agregar `continuidadCritica: true,` y:

```js
  propia: {
    key: 'fuente', notaLabel: 'Fuente actual y autonomía',
    pregunta: '¿Cuál es hoy tu fuente principal de energía y cuántas horas necesitas operar sin ella?',
    opciones: [
      { codigo: 'diesel_24h', label: 'Diésel o gas todo el día; necesitamos operar 24 horas' },
      { codigo: 'diesel_parcial', label: 'Diésel o gas algunas horas al día' },
      { codigo: 'red_debil', label: 'Red de CFE con cortes frecuentes' },
      { codigo: 'sin_energia', label: 'Hoy no hay suministro; es un sitio nuevo' },
      { codigo: 'nolose', label: 'No lo tengo claro' }
    ]
  },
  continuityLabel: 'Quedarnos sin energía nos cuesta producción o servicio',
```

Microred no tiene freno (la microred manda). No agregar `frenos`.

- [ ] **Step 8: Centros de datos**

En `js/diagnostico.centros-datos.content.js`: quitar `qualityQuestion`/`qualityOptions`; agregar `continuidadCritica: true,` y:

```js
  propia: {
    key: 'respaldo_actual', notaLabel: 'Respaldo actual',
    pregunta: '¿Qué respaldo eléctrico tienes hoy?',
    opciones: [
      { codigo: 'ups_gen', label: 'UPS y generador, probados con regularidad' },
      { codigo: 'ups', label: 'Solo UPS' },
      { codigo: 'gen', label: 'Solo generador' },
      { codigo: 'nada', label: 'Sin respaldo formal' },
      { codigo: 'nolose', label: 'No lo sé' }
    ]
  },
  continuityLabel: 'Una interrupción compromete SLA o datos',
```

y en `overrides`:

```js
    frenos: [
      {
        id: 'respaldo_basico_primero',
        when: { respaldo_actual: 'nada' },
        tipo: 'Respaldo básico primero',
        razon: 'Hoy no tienes UPS ni generador. Antes de hablar de baterías para ahorrar, el sitio necesita un respaldo mínimo que sostenga la carga crítica. Un BESS puede cubrir ese papel y además recortar demanda, pero se dimensiona primero como respaldo.',
        despues: 'bess',
        requisitos: ['respaldo_actual', 'perfil'],
        anteproyecto: {
          interno: ['Carga crítica IT y de enfriamiento (kW) y tiempo de transferencia tolerable.', 'Topología eléctrica actual (unifilar).'],
          lead: ['Cuántos kW no pueden apagarse nunca.', 'Si tienes un diagrama eléctrico del sitio.']
        }
      }
    ],
```

- [ ] **Step 9: Integrar el freno en `engine.js`**

Importar arriba: `import { applyBrakes } from './diagnostico.frenos.js';` e `import { familiaEfectiva } from './diagnostico.flujo.js';`.

`recommendSolution`: cambiar la firma a `export function recommendSolution(resp, scores, content, aplicacion, freno = null)` y reemplazar la última línea `return { tipo: rec[key].tipo, razon: rec[key].razon, familia: FAMILIA_ANTEPROYECTO[key] || 'base' };` por:

```js
  const base = { tipo: rec[key].tipo, razon: rec[key].razon, familia: FAMILIA_ANTEPROYECTO[key] || 'base' };
  if (freno) {
    return {
      tipo: freno.tipo, razon: freno.razon, familia: 'primer_paso',
      primerPaso: true, freno: freno.id, requisitos: freno.requisitos, segundoPaso: base
    };
  }
  return { ...base, primerPaso: false, freno: null };
```

`buildAnteproyecto`:

```js
export function buildAnteproyecto(recomendacion, content, freno = null) {
  const a = content.anteproyecto;
  const familia = familiaEfectiva(recomendacion);
  const extras = ANTEPROYECTO_EXTRAS[familia] || [];
  const interno = [...a.base.interno, ...extras.flatMap((k) => a[k].interno), ...(freno?.anteproyecto?.interno || [])];
  const lead = [...a.base.lead, ...extras.flatMap((k) => a[k].lead), ...(freno?.anteproyecto?.lead || [])];
  return { familia, interno, lead };
}
```

`assembleResult`: después de `const aplicacion_principal = ...` agregar `const scoresNeutros = scoreOpportunities({ ...resp, factura: 'medio' }, content);` (scores sin el efecto de la factura; el encaje y el freno los usan) y `const freno = applyBrakes(resp, scoresNeutros, content);`; cambiar la llamada a `recommendSolution(resp, scores, content, aplicacion_principal, freno)` y `buildAnteproyecto(recomendacion_solucion, content, freno)`. Las llamadas a `pickMissingData`, `buildChecklist` y `detectLimitations` que reciben `recomendacion_solucion` deben recibir `recomendacion_solucion.primerPaso ? recomendacion_solucion.segundoPaso : recomendacion_solucion` (así las reglas que miran `tipo` siguen viendo BESS/Solar). Agregar `freno: freno ? freno.id : null` al `leadPayload`.

- [ ] **Step 10: Correr todo**

Run: `npm test`
Expected: PASS. Si `test/diagnostico.exhaustive.test.js` sigue activo y falla por `content.palancasCopy[aplicacion.id]`, dejarlo en skip hasta la Tarea 7.

- [ ] **Step 11: Commit**

```bash
git add js/diagnostico.frenos.js js/diagnostico.engine.js js/diagnostico.*.content.js test/diagnostico.frenos.test.js
git commit -m "feat(diagnostico): preguntas propias por perfil y frenos (primer paso antes de BESS)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Cuatro salidas en `assembleResult`, payload y vocabulario

**Files:**
- Modify: `js/diagnostico.engine.js` (`assembleResult`, quitar `potencialGeneral`)
- Modify: `js/diagnostico.content.js`, `js/diagnostico.hoteles.content.js` (`resumen.aplicaFrase` sin cambios de claves; `postResult.facturas`; `emailVocabulary.documentos`)
- Modify: `js/diagnostico.profile.js` (`emailVocabulary` con `documentos` por defecto; `postResult.facturas`)
- Modify: `js/diagnostico.microred.content.js` (`emailVocabulary`, `postResult.facturas`)
- Modify: `test/diagnostico.engine.test.js`

**Interfaces:**
- Produces en `res` y `leadPayload`: `encaje_tecnico`, `tamano`, `confianza: { nivel, faltantes }`, `intencion`, `conectado`, `freno`, `datos_consumo`, `preguntas: [{ key, label }]`. Se elimina `potencial_general`.
- Consumes de `estado`: `estado.datos_consumo` (`{ kwh_dia, kw_pico, litros_diesel_mes, horas_autonomia }` o `null`), `estado.enrichmentDone`, `estado.techo`.

- [ ] **Step 1: Escribir la prueba de integración en `test/diagnostico.engine.test.js`**

Agregar al final:

```js
test('assembleResult v4: expone las cuatro salidas y ya no potencial_general', () => {
  const estado = {
    respuestas: { sector: 'manufactura', disparador: ['capacidad'], perfil: 'diurno', generacion: 'no', calidad: 'no', tarifa: 'gdmth', factura: 'alto' },
    contacto: {}, techo: null, datos_consumo: null
  };
  const res = assembleResult(estado, content);
  assert.ok(['Bajo', 'Medio', 'Alto', 'Muy Alto'].includes(res.encaje_tecnico));
  assert.equal(res.tamano, 'Grande');
  assert.ok(['Alta', 'Media', 'Baja'].includes(res.confianza.nivel));
  assert.equal(res.intencion, 'Evaluando');
  assert.equal(res.conectado, true);
  assert.equal(res.potencial_general, undefined);
  assert.equal(res.leadPayload.potencial_general, undefined);
  assert.equal(res.leadPayload.encaje_tecnico, res.encaje_tecnico);
  assert.deepEqual(res.leadPayload.preguntas.map((p) => p.key), ['sector', 'disparador', 'perfil', 'generacion', 'tarifa', 'factura', 'calidad']);
});

test('assembleResult v4: encaje no cambia al variar solo la factura; tamaño no cambia al variar solo el perfil', () => {
  const base = { sector: 'manufactura', disparador: ['costo'], perfil: 'picos', generacion: 'no', calidad: 'no', tarifa: 'gdmth', factura: 'alto' };
  const a = assembleResult({ respuestas: base }, content);
  const b = assembleResult({ respuestas: { ...base, factura: 'bajo' } }, content);
  assert.equal(a.encaje_tecnico, b.encaje_tecnico);
  const c = assembleResult({ respuestas: { ...base, perfil: 'plano' } }, content);
  assert.equal(a.tamano, c.tamano);
});

test('assembleResult v4: aislado pone consumo como primera limitación y conectado=false', () => {
  const res = assembleResult({ respuestas: { sector: 'manufactura', disparador: ['aislado'], perfil: 'diurno', generacion: 'no', calidad: 'no', tarifa: 'gdmth', factura: 'nolose' } }, content);
  assert.equal(res.conectado, false);
  assert.equal(res.limitaciones[0].dato, content.limitaciones.consumo.dato);
  assert.equal(res.tamano, 'Sin cuantificar');
});
```

Y en el `import { ... } from '../js/diagnostico.engine.js'` quitar `potencialGeneral`. Borrar los tests existentes que llamen `potencialGeneral` (buscar con `grep -n potencialGeneral test/`).

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test test/diagnostico.engine.test.js`
Expected: FAIL (`encaje_tecnico` undefined).

- [ ] **Step 3: Cablear `assembleResult` y quitar `potencialGeneral`**

En `engine.js` importar: `import { encajeTecnico, tamanoOportunidad, confianza as calcConfianza, intencionComercial } from './diagnostico.salidas.js';` e `import { pasosVisibles } from './diagnostico.flujo.js';`.

Borrar la función `potencialGeneral` completa (líneas ~406-432).

En `assembleResult`:
- Reemplazar `const potencial_general = potencialGeneral(scores, resp, content);` por:

```js
  // Encaje técnico: solo comportamiento eléctrico. Los pesos de scoring incluyen `factura`,
  // así que el encaje usa `scoresNeutros` (factura fija en 'medio'; spec v4 §2.2: el encaje
  // no cambia si solo cambia la factura). `applyBrakes` usa los mismos scores neutros.
  const encaje_tecnico = encajeTecnico(scoresNeutros, content);   // scoresNeutros se calculó en la Tarea 3 Step 9
  const tamano = tamanoOportunidad(resp, content);
  const intencion = intencionComercial(resp, estado);
  const datos_consumo = estado.datos_consumo || null;
  const extras = {
    techo: Number(estado.techo?.area_m2) > 0,
    consumo: !!(datos_consumo && (Number(datos_consumo.kwh_dia) > 0 || Number(datos_consumo.litros_diesel_mes) > 0))
  };
```

- Después de calcular `recomendacion_solucion`: `const confianza = calcConfianza(resp, recomendacion_solucion, extras, content);`
- En `leadPayload` quitar `potencial_general,` y agregar:

```js
    encaje_tecnico,
    tamano,
    confianza,
    intencion,
    conectado: resp.conectado,
    datos_consumo,
    preguntas: pasosVisibles(content, resp).map((p) => ({ key: p.key, label: p.notaLabel || p.key })),
```

- En `res` quitar `potencial_general,` y agregar `encaje_tecnico, tamano, confianza, intencion, conectado: resp.conectado,`.

- [ ] **Step 4: Vocabulario y copy de facturas por perfil**

En `js/diagnostico.content.js` y `js/diagnostico.hoteles.content.js`, `emailVocabulary` queda:

```js
  emailVocabulary: {
    site: 'operación',            // hoteles: 'propiedad' (conservar el valor actual)
    technicalContact: 'responsable de energía o mantenimiento',
    documentos: {
      conectado: 'tus 12 recibos de CFE (kWh, demanda máxima en kW y tarifa)',
      aislado: 'tu consumo diario (kWh), potencia pico (kW), litros y costo de diésel al mes, fuente actual y horas de autonomía'
    },
    idServicio: 'Número de servicio (RPU) de tu recibo CFE.'
  },
```

y `postResult` gana:

```js
  postResult: {
    label: 'Precisar mi proyecto',
    facturas: {
      titulo: 'Sube tus últimas 12 facturas de energía',
      sub: 'Con tus facturas de CFE o de tu suministrador calculamos tu ahorro real. Es opcional, pero mejora mucho tu anteproyecto.'
    }
  },
```

En `js/diagnostico.profile.js`, en el `merge(content, {...})`:
- `emailVocabulary: { ...baseContent.emailVocabulary, ...(definition.emailVocabulary || {}) }` (así `documentos` e `idServicio` heredan del base).
- `postResult: { ...baseContent.postResult, ...(definition.postResult || {}) }`.

En `js/diagnostico.microred.content.js`, `emailVocabulary` queda:

```js
  emailVocabulary: {
    site: 'sitio remoto', technicalContact: 'responsable de generación o mantenimiento',
    documentos: {
      conectado: 'tus recibos de CFE de los últimos 12 meses y tus horas y costo de diésel',
      aislado: 'tu consumo diario (kWh), potencia pico (kW), litros y costo de diésel al mes, fuente actual y horas de autonomía'
    }
  },
  postResult: {
    label: 'Precisar mi microred', alwaysRoof: true,
    facturas: { titulo: 'Sube tus recibos o registros de energía', sub: 'Si tienes recibos de CFE o registros de consumo de combustible, súbelos. Es opcional.' }
  },
```

- [ ] **Step 5: Correr todo**

Run: `npm test`
Expected: PASS (exhaustive en skip).

- [ ] **Step 6: Commit**

```bash
git add js/diagnostico.engine.js js/diagnostico.content.js js/diagnostico.hoteles.content.js js/diagnostico.profile.js js/diagnostico.microred.content.js test/diagnostico.engine.test.js
git commit -m "feat(diagnostico): cuatro salidas independientes en el resultado y el payload; vocabulario por perfil

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Vista — navegación condicional, resultado v4, enriquecimiento por lista y pantalla `consumo`

**Files:**
- Modify: `js/diagnostico.app.js` (todo el archivo; secciones citadas por función)
- Modify: `css/diagnostico.css` (estilos de `.dx-consumo`)
- Modify: `js/diagnostico.state.js` (nada de lógica nueva; verificar que `datos_consumo` no se persista)

**Interfaces:**
- Consumes: `siguienteIndice`, `anteriorIndice`, `pasosVisibles`, `pasosEnriquecimiento` (Tarea 1); `res.encaje_tecnico`, `res.tamano`, `res.confianza`, `res.recomendacion_solucion.primerPaso/segundoPaso` (Tareas 3-4).
- Produces: `estado.datos_consumo`, `estado.enriquecimiento` (lista de pasos), pasos `'punto'` y `'consumo'`.

No hay pruebas en Node para la vista. La verificación es manual en navegador (Step 9) y se registra en el commit.

- [ ] **Step 1: Importar `flujo.js` y ajustar el estado inicial**

Arriba de `app.js`:

```js
import { siguienteIndice, anteriorIndice, pasosVisibles, pasosEnriquecimiento } from './diagnostico.flujo.js?v=15';
```

(Los `?v=` se unifican en la Tarea 8; usar el mismo número que el resto de imports del archivo en ese momento.)

En `const estado = {` agregar `datos_consumo: null,` y `enriquecimiento: null,`. En modo rápido, el paso inicial pasa a:

```js
    paso: rapido
      ? (content.postResult?.skipRoof ? 'punto' : 'techo')
      : (saved?.paso ?? 'intro'),
```

Borrar la función `enrichmentStep()`. Agregar:

```js
  // Lista de pasos de enriquecimiento para este caso. En modo rápido no hay respuestas:
  // mapa (o solo punto si el perfil no dibuja áreas) y facturas.
  function listaEnriquecimiento() {
    if (rapido) return [content.postResult?.skipRoof ? 'punto' : 'techo', 'facturas'];
    const res = estado.resultado || assembleResult(estado, content);
    estado.resultado = res;
    return pasosEnriquecimiento(res, content, res.leadPayload.respuestas_codigos);
  }
  function irAEnriquecimiento(desde) {
    if (!estado.enriquecimiento) estado.enriquecimiento = listaEnriquecimiento();
    const lista = estado.enriquecimiento;
    const i = desde == null ? -1 : lista.indexOf(desde);
    const siguiente = lista[i + 1];
    if (siguiente) { estado.paso = siguiente; render(); return; }
    finishEnrichment();
  }
  function retrocederEnriquecimiento(desde) {
    const lista = estado.enriquecimiento || listaEnriquecimiento();
    const i = lista.indexOf(desde);
    if (i > 0) { estado.paso = lista[i - 1]; render(); return; }
    estado.paso = rapido ? desde : 'cierre';
    render();
  }
```

Nota: `res.leadPayload.respuestas_codigos` ya viene normalizado (incluye `conectado`).

- [ ] **Step 2: Navegación condicional en `renderStep` y `renderStepMulti`**

En ambas funciones:

- Progreso: reemplazar las dos líneas de `dx__progress-label` y `dx__progress-fill` usando:

```js
    const visibles = pasosVisibles(content, estado.respuestas);
    const posicion = visibles.findIndex((p) => p.key === paso.key) + 1;
    const totalVisibles = visibles.length;
```

y en el HTML `content.progresoLabel(posicion, totalVisibles)` y `width:${Math.round(posicion / totalVisibles * 100)}%`.

- Botón Atrás (en `renderStep`):

```js
    view.querySelector('[data-act="atras"]').addEventListener('click', () => {
      const prev = anteriorIndice(content, estado.respuestas, estado.paso);
      estado.paso = prev == null ? 'intro' : prev;
      render();
    });
```

(En `renderStepMulti` igual pero sin el caso `'intro'`: `estado.paso = prev == null ? 'intro' : prev;` también sirve.)

- Botón Siguiente (ambas): reemplazar `if (estado.paso < content.pasos.length - 1) estado.paso += 1; else estado.paso = 'result';` por:

```js
      // Si una respuesta común cambió, una condicional ya contestada puede dejar de aplicar.
      for (const p of content.pasos) {
        if (p.when && estado.respuestas[p.key] != null && !pasosVisibles(content, estado.respuestas).includes(p)) {
          estado.respuestas[p.key] = null;
        }
      }
      const next = siguienteIndice(content, estado.respuestas, estado.paso);
      estado.paso = next == null ? 'result' : next;
```

- [ ] **Step 3: Resultado: primer/segundo paso y tres salidas**

En `renderResult`:

- En `trackDx('result_viewed', {...})` cambiar `potential: res.potencial_general` por `encaje: res.encaje_tecnico, freno: res.recomendacion_solucion?.freno || null`.
- Reemplazar el bloque desde `const tipoRec = ...` hasta el cierre de `const confianzaHtml = \`...\`;` por:

```js
    const rec = res.recomendacion_solucion;
    const aplicaFrase = rz.aplicaFrase?.[res.encaje_tecnico] || 'podría aplicar a tu operación';
    const nextCopy = 'Elige si quieres recibir este diagnóstico por correo o aportar datos para afinar el anteproyecto.';
    const segundo = rec.primerPaso ? rec.segundoPaso : null;
    const scoreSegundo = segundo ? (res.ranking[0]?.score ?? null) : null;
    const configuracionHtml = rec.primerPaso
      ? `
          <aside class="dx__resumen" aria-label="Primer paso recomendado">
            <p class="dx__resumen-k">Primer paso</p>
            <p class="dx__resumen-frase">Antes de baterías o paneles, <strong>${esc(rec.tipo)}</strong>.</p>
            <p class="dx__resumen-razon">${esc(rec.razon)}</p>
            <p class="dx__resumen-k">Segundo paso</p>
            <p class="dx__resumen-frase"><strong>${esc(segundo.tipo)}</strong> ${esc(aplicaFrase)}${scoreSegundo != null ? ` (puntaje ${esc(String(scoreSegundo))} de 100)` : ''}.</p>
            ${/BESS/.test(segundo.tipo) ? `<p class="dx__resumen-glosa">${esc(rz.bessGlosa)}</p>` : ''}
            <p class="dx__resumen-razon">${esc(segundo.razon)}</p>
          </aside>`
      : `
          <aside class="dx__resumen" aria-label="Configuración a evaluar">
            <p class="dx__resumen-k">Configuración a evaluar</p>
            <p class="dx__resumen-frase">Por lo que nos contaste, <strong>${esc(rec.tipo)}</strong> ${esc(aplicaFrase)}.</p>
            ${/BESS/.test(rec.tipo) ? `<p class="dx__resumen-glosa">${esc(rz.bessGlosa)}</p>` : ''}
            <p class="dx__resumen-razon">${esc(rec.razon)}</p>
          </aside>`;
    const confianzaHtml = `
          <aside class="dx__resumen" aria-label="Firmeza de la conclusión">
            <p class="dx__resumen-k">Qué tan firme es esta conclusión</p>
            <div class="dx__resumen-heads">
              <p class="dx__resumen-line"><span class="dx__resumen-k">Encaje técnico</span><strong>${esc(res.encaje_tecnico)}</strong></p>
              <p class="dx__resumen-line"><span class="dx__resumen-k">Tamaño</span><strong>${esc(res.tamano)}</strong></p>
              <p class="dx__resumen-line"><span class="dx__resumen-k">Confianza</span><strong>${esc(res.confianza.nivel)}</strong></p>
            </div>
            ${limHtml}
          </aside>`;
```

Borrar las variables `unknowns`, `confianza` y `tamano` locales que quedaban antes.

- En el `reiniciar` agregar `estado.datos_consumo = null; estado.enriquecimiento = null;`.

- [ ] **Step 4: `renderTecho` con paso `'punto'`**

Al inicio de `renderTecho`: `const allowRoof = estado.paso === 'techo' && !content.postResult?.skipRoof;`. Cambiar los tres listeners de navegación:

```js
    view.querySelector('[data-act="atras"]')?.addEventListener('click', () => retrocederEnriquecimiento(estado.paso));
    view.querySelector('[data-act="saltar"]').addEventListener('click', () => irAEnriquecimiento(estado.paso));
    view.querySelector('[data-act="siguiente"]').addEventListener('click', () => irAEnriquecimiento(estado.paso));
```

En `render()` agregar `if (estado.paso === 'punto') return renderTecho();` y `if (estado.paso === 'consumo') return renderConsumo();`.

- [ ] **Step 5: `renderFacturas` con copy por perfil y navegación por lista**

Título y subtítulo:

```js
    const copyFac = content.postResult?.facturas || { titulo: 'Sube tus últimas 12 facturas de energía', sub: 'Con tus facturas calculamos tu ahorro real. Es opcional, pero mejora mucho tu anteproyecto.' };
```

y usar `${esc(copyFac.titulo)}` / `${esc(copyFac.sub)}` en el HTML. Botón Atrás: `btnAtras?.addEventListener('click', () => retrocederEnriquecimiento('facturas'));`. Mover la función `finishEnrichment` fuera de `renderFacturas` (a nivel de `initDiagnostico`), con esta forma:

```js
  async function finishEnrichment() {
    if (estado.facturas?.pending > 0) return;
    estado.enrichmentDone = true;
    if (!estado.contacto.nombre) { estado.paso = 'cierre'; render(); return; }
    await guardarEnriquecimiento();
    estado.paso = 'agenda';
    render();
  }
```

y en `renderFacturas` los botones Continuar/Saltar llaman `() => irAEnriquecimiento('facturas')` (que a su vez llama `finishEnrichment` si es el último). El bloqueo de botones mientras suben (`syncNav`) se conserva; `irAEnriquecimiento` no avanza si `estado.facturas?.pending > 0`: agregar esa comprobación al inicio de `irAEnriquecimiento` cuando `desde === 'facturas'`.

- [ ] **Step 6: Pantalla `renderConsumo`**

```js
  // ---- Paso: datos de consumo (sitios sin red) --------------------------------
  function renderConsumo() {
    const d = estado.datos_consumo || {};
    const campo = (key, label, hint) => `
        <label class="dx-cierre__field">${esc(label)}
          <input type="number" min="0" step="any" inputmode="decimal" data-f="${key}" value="${d[key] ?? ''}" placeholder="${esc(hint)}">
        </label>`;
    const view = el(`
      <div class="dx__view">
        <h2 class="dx__question" data-dx-focus tabindex="-1">Cuéntanos cuánta energía usa tu sitio</h2>
        <p class="dx__col-sub">Todo es opcional y aproximado. Con uno o dos datos ya podemos dimensionar.</p>
        <div class="dx-cierre dx-consumo">
          ${campo('kwh_dia', 'Consumo al día (kWh)', 'p. ej. 800')}
          ${campo('kw_pico', 'Potencia pico (kW)', 'p. ej. 120')}
          ${campo('litros_diesel_mes', 'Diésel al mes (litros)', 'p. ej. 3000')}
          ${campo('horas_autonomia', 'Horas que necesitas operar sin sol ni generador', 'p. ej. 8')}
        </div>
        <div class="dx__nav dx__nav--end">
          <button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>
          <span class="dx__skiprow">
            <button type="button" class="dx__skip" data-act="saltar">Saltar por ahora</button>
            <button type="button" class="mx-btn mx-btn--primary" data-act="siguiente">Continuar</button>
          </span>
        </div>
      </div>`);
    const leer = () => {
      const out = {};
      for (const key of ['kwh_dia', 'kw_pico', 'litros_diesel_mes', 'horas_autonomia']) {
        const v = view.querySelector(`[data-f="${key}"]`).value.trim();
        const n = Number(v);
        out[key] = v !== '' && Number.isFinite(n) && n >= 0 ? n : null;
      }
      const alguno = Object.values(out).some((v) => v != null);
      estado.datos_consumo = alguno ? out : null;
    };
    view.querySelector('[data-act="atras"]').addEventListener('click', () => { leer(); retrocederEnriquecimiento('consumo'); });
    view.querySelector('[data-act="saltar"]').addEventListener('click', () => irAEnriquecimiento('consumo'));
    view.querySelector('[data-act="siguiente"]').addEventListener('click', () => { leer(); trackDx('consumo_entered', { profile_id: profileId }); irAEnriquecimiento('consumo'); });
    root.replaceChildren(view);
    focusMain();
  }
```

En `css/diagnostico.css` agregar: `.dx-consumo{display:grid;gap:var(--space-3);grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}`.

- [ ] **Step 7: "Afinar" en `renderCierre` y "Atrás" en `renderAgenda`**

En el listener de `afinar`, reemplazar el bloque `if (estado.enrichmentDone) {...} else { estado.paso = enrichmentStep(res); } render();` por:

```js
      if (estado.enrichmentDone) {
        await guardarEnriquecimiento();
        estado.paso = 'agenda';
        render();
      } else {
        estado.enriquecimiento = listaEnriquecimiento();
        irAEnriquecimiento(null);
      }
```

Si la lista está vacía, `irAEnriquecimiento(null)` llama `finishEnrichment`, que con contacto capturado guarda y va a `agenda`.

En `renderAgenda`, el botón Atrás: `estado.paso = (estado.enriquecimiento || ['facturas']).slice(-1)[0]; render();`.

`guardarEnriquecimiento`: en la `firma` agregar `c: estado.datos_consumo`.

- [ ] **Step 8: Persistencia**

En `js/diagnostico.state.js`, `privateSteps` incluye ahora `'punto'` y `'consumo'`. No se persiste `datos_consumo` (dato personal de operación; misma regla que techo y facturas).

- [ ] **Step 9: Verificación manual en navegador**

Servir estático: `python3 -m http.server 8765 --bind 127.0.0.1` (o `.claude/launch.json` equivalente). Abrir `http://localhost:8765/diagnostico-electromovilidad/`. Comprobar:

1. La barra dice "Paso 1 de 7". Al marcar `capacidad` en disparador, pasa a "de 8" y aparece la pregunta de crecimiento al final.
2. Contestar `gestion_carga: manual`, `perfil: picos`. El resultado muestra "Primer paso: Gestión de carga primero" y "Segundo paso: BESS…".
3. "Qué tan firme" muestra Encaje, Tamaño y Confianza con valores de la lista.
4. "Afinar mi anteproyecto" con contacto lleva al mapa (Solar no está, así que el título es "Ubica tu punto eléctrico principal") y luego a facturas.
5. En `/diagnostico-microred/` con tarifa `diesel`: la lista de pasos es punto → consumo (no facturas); la pantalla de consumo guarda números y "Atrás" los conserva.
6. Reiniciar limpia todo.

Anotar en el commit qué se verificó.

- [ ] **Step 10: Commit**

```bash
git add js/diagnostico.app.js js/diagnostico.state.js css/diagnostico.css
git commit -m "feat(diagnostico): vista v4 — pasos condicionales, primer/segundo paso, enriquecimiento por lista y datos de consumo

Verificado en navegador: EV (7→8 pasos, freno, salidas), microred diésel (punto → consumo), reinicio.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `api/lead.js` — cuatro salidas, freno, vocabulario sin CFE, datos de consumo

**Files:**
- Modify: `api/lead.js`
- Modify: `test/api.lead.extras.test.js`, `test/api.lead.test.js`

**Interfaces:**
- Consumes del payload: `encaje_tecnico`, `tamano`, `confianza`, `intencion`, `conectado`, `freno`, `datos_consumo`, `preguntas`, `recomendacion_solucion.segundoPaso`, `email_vocabulary.documentos`, `email_vocabulary.idServicio`.

- [ ] **Step 1: Escribir las pruebas en `test/api.lead.extras.test.js`**

Agregar al final:

```js
test('v4: correo interno muestra las cuatro salidas y el freno con segundo paso', async () => {
  const { emails } = await enviar({
    ...base,
    encaje_tecnico: 'Alto', tamano: 'Grande', confianza: { nivel: 'Media', faltantes: ['techo'] }, intencion: 'Evaluando',
    freno: 'gestion_carga_primero',
    recomendacion_solucion: { tipo: 'Gestión de carga primero', razon: 'r1', primerPaso: true, segundoPaso: { tipo: 'BESS para gestionar carga', razon: 'r2' } }
  });
  const t = emails[0].text;
  assert.match(t, /Encaje técnico:\s*Alto/);
  assert.match(t, /Tamaño:\s*Grande/);
  assert.match(t, /Confianza:\s*Media \(falta: techo\)/);
  assert.match(t, /Intención:\s*Evaluando/);
  assert.match(t, /Primer paso:\s*Gestión de carga primero/);
  assert.match(t, /Segundo paso:\s*BESS para gestionar carga/);
  assert.doesNotMatch(t, /Potencial general/);
});

test('v4: sin red, ningún correo menciona CFE, RPU ni recibos', async () => {
  const { emails } = await enviar({
    ...base, tipo_cierre: 'preliminar', conectado: false,
    email_vocabulary: {
      site: 'sitio remoto', technicalContact: 'responsable',
      documentos: { conectado: 'tus 12 recibos de CFE', aislado: 'tu consumo diario (kWh) y litros de diésel' },
      idServicio: 'Número de servicio (RPU) de tu recibo CFE.'
    },
    datos_consumo: { kwh_dia: 800, kw_pico: 120, litros_diesel_mes: 3000, horas_autonomia: 8 },
    preguntas: [{ key: 'sector', label: 'Tipo de sitio' }],
    respuestas_legibles: { sector: 'Mina' }
  });
  for (const e of emails) {
    assert.doesNotMatch(e.text, /CFE/);
    assert.doesNotMatch(e.text, /RPU/);
    assert.doesNotMatch(e.text, /recibos?/i);
  }
  assert.match(emails[0].text, /Datos de consumo/);
  assert.match(emails[0].text, /800 kWh\/día/);
  const cliente = emails.find((e) => e.to === base.correo);
  assert.match(cliente.text, /consumo diario/);
});

test('v4: las preguntas del correo salen del payload, con fallback a la lista fija', async () => {
  const conLista = await enviar({ ...base, preguntas: [{ key: 'sector', label: 'Tipo de sitio' }], respuestas_legibles: { sector: 'Mina' } });
  assert.match(conLista.emails[0].text, /1\. Tipo de sitio: Mina/);
  assert.doesNotMatch(conLista.emails[0].text, /2\. /);
  const sinLista = await enviar({ ...base, respuestas_legibles: { sector: 'Mina' } });
  assert.match(sinLista.emails[0].text, /1\. Sector \/ operación: Mina/);
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test test/api.lead.extras.test.js`
Expected: FAIL en los tres tests nuevos.

- [ ] **Step 3: Implementar en `api/lead.js`**

a) Lectura de campos nuevos, después de `const potencial = clean(body.potencial_general, 20);` (borrar esa línea):

```js
  const encaje = clean(body.encaje_tecnico, 20);
  const tamano = clean(body.tamano, 20);
  const confianzaRaw = (body.confianza && typeof body.confianza === 'object' && !Array.isArray(body.confianza)) ? body.confianza : null;
  const confianzaTxt = confianzaRaw && confianzaRaw.nivel
    ? `${clean(confianzaRaw.nivel, 10)}${Array.isArray(confianzaRaw.faltantes) && confianzaRaw.faltantes.length ? ` (falta: ${confianzaRaw.faltantes.slice(0, 6).map((f) => clean(f, 30)).join(', ')})` : ''}`
    : '';
  const intencion = clean(body.intencion, 20);
  const conectado = body.conectado === false ? false : (body.conectado === true ? true : null);
  const freno = clean(body.freno, 60);
  const consumoRaw = (body.datos_consumo && typeof body.datos_consumo === 'object' && !Array.isArray(body.datos_consumo)) ? body.datos_consumo : null;
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 && v !== null && v !== '' ? Number(v) : null);
  const consumo = consumoRaw ? {
    kwh_dia: num(consumoRaw.kwh_dia), kw_pico: num(consumoRaw.kw_pico),
    litros_diesel_mes: num(consumoRaw.litros_diesel_mes), horas_autonomia: num(consumoRaw.horas_autonomia)
  } : null;
  const consumoLineas = consumo ? [
    consumo.kwh_dia != null ? `${consumo.kwh_dia} kWh/día` : null,
    consumo.kw_pico != null ? `${consumo.kw_pico} kW pico` : null,
    consumo.litros_diesel_mes != null ? `${consumo.litros_diesel_mes} L diésel/mes` : null,
    consumo.horas_autonomia != null ? `${consumo.horas_autonomia} h de autonomía` : null
  ].filter(Boolean) : [];
  const preguntasPayload = Array.isArray(body.preguntas)
    ? body.preguntas.filter((p) => p && typeof p === 'object').map((p) => [clean(p.key, 40), clean(p.label, 80)]).filter(([k, l]) => k && l)
    : [];
  const documentos = (vocabulary.documentos && typeof vocabulary.documentos === 'object') ? vocabulary.documentos : {};
  const docConectado = clean(documentos.conectado, 200) || 'tus 12 recibos de CFE (kWh, demanda máxima en kW y tarifa)';
  const docAislado = clean(documentos.aislado, 300) || 'tu consumo diario (kWh), potencia pico (kW), litros y costo de diésel al mes y horas de autonomía';
  const idServicio = clean(vocabulary.idServicio, 120) || 'Número de servicio (RPU) de tu recibo CFE.';
```

b) `recomendacion` gana segundo paso: después de `const recomendacion = ...` agregar:

```js
  const segundoPasoRaw = body.recomendacion_solucion && typeof body.recomendacion_solucion.segundoPaso === 'object' && body.recomendacion_solucion.segundoPaso
    ? body.recomendacion_solucion.segundoPaso : null;
  const segundoPaso = segundoPasoRaw && clean(segundoPasoRaw.tipo, 40)
    ? { tipo: clean(segundoPasoRaw.tipo, 40), razon: clean(segundoPasoRaw.razon, 300) } : null;
  const esPrimerPaso = body.recomendacion_solucion?.primerPaso === true && !!segundoPaso;
```

c) Preguntas: reemplazar `const respuestas = PREGUNTAS.map(([key, label]) => {` por `const respuestas = (preguntasPayload.length ? preguntasPayload : PREGUNTAS).map(([key, label]) => {`.

d) Texto interno: reemplazar la línea `potencial ? \`Potencial general: ${potencial}\` : null,` y la línea `recomendacion ? \`Recomendación: ...\` : null,` por:

```js
    encaje ? `Encaje técnico: ${encaje}` : null,
    tamano ? `Tamaño: ${tamano}` : null,
    confianzaTxt ? `Confianza: ${confianzaTxt}` : null,
    intencion ? `Intención: ${intencion}` : null,
    conectado === false ? 'Sitio sin red (conectado: no)' : null,
    esPrimerPaso ? `Primer paso: ${recomendacion.tipo}` : (recomendacion ? `Recomendación: ${recomendacion.tipo}` : null),
    esPrimerPaso ? `Segundo paso: ${segundoPaso.tipo}` : null,
```

y después de las líneas de `facturaLinks` agregar:

```js
    consumoLineas.length ? 'Datos de consumo: ' + consumoLineas.join(' · ') : null,
```

En el HTML interno, en el `<p>` que hoy muestra `Potencial general` / `Recomendación`, reemplazar por las mismas líneas con `esc(...)` y `<br>`; agregar una fila `fila('Datos de consumo', consumoLineas.join(' · '))` en la tabla de ubicación cuando `consumoLineas.length`. La condición de esa tabla pasa a `(ubic || techoArea != null || acometida || facturaLinks.length || consumoLineas.length)`.

e) Correo al cliente: reemplazar el armado de `yaPartes` y `faltan` por:

```js
      const sinRed = conectado === false;
      const yaPartes = [sinRed ? 'tus respuestas del diagnóstico' : 'tus respuestas del diagnóstico y tu tarifa'];
      if (tieneTecho) yaPartes.push(`la medida de tu techo (${techoTxt})`);
      if (acometida) yaPartes.push('la ubicación de tu punto eléctrico principal');
      if (tieneRecibos && !sinRed) yaPartes.push(`tus ${facturaPaths.length} recibo${facturaPaths.length === 1 ? '' : 's'}`);
      if (consumoLineas.length) yaPartes.push(`tus datos de consumo (${consumoLineas.join(', ')})`);
      const yaTenemos = 'Ya tenemos ' + unir(yaPartes) + '.';

      const faltan = [
        `Horario u operación detallada de tu ${siteWord}.`,
        'Capacidad del transformador y tablero principal (diagrama unifilar).',
        'Horizonte de decisión (¿para cuándo lo necesitas?).',
        ...(sinRed ? [] : [idServicio]),
        `Contacto del ${technicalContact}.`,
        'Rango de inversión y forma preferida (compra directa o servicio/PPA).'
      ];
      if (corteImporta || esBaterias) faltan.push('Frecuencia y duración de los cortes de energía.');
      if (sinRed && !consumoLineas.length) faltan.push(`${docAislado.charAt(0).toUpperCase()}${docAislado.slice(1)}.`);
      if (!sinRed && !tieneRecibos) faltan.push(`${docConectado.charAt(0).toUpperCase()}${docConectado.slice(1)}.`);
      if (esPrimerPaso) faltan.unshift(`Lo que define tu primer paso (${recomendacion.tipo.toLowerCase()}): ${clean(recomendacion.razon, 200)}`);
```

Y en `lineasCliente` / `htmlCliente`, en la sección "Lo que más te conviene", cuando `esPrimerPaso` mostrar primero `Primer paso: ${recomendacion.tipo} — ${recomendacion.razon}` y después `Segundo paso: ${segundoPaso.tipo} — ${segundoPaso.razon}`; si no, lo de hoy. La palabra "tarifa CFE" en `yaPartes` desaparece (arriba ya dice "tu tarifa").

f) Borrar cualquier otro uso de `potencial`.

- [ ] **Step 4: Correr todo**

Run: `npm test`
Expected: PASS. Si `test/api.lead.test.js` tenía un test de `Potencial general`, cambiarlo a `Encaje técnico`.

- [ ] **Step 5: Commit**

```bash
git add api/lead.js test/api.lead.extras.test.js test/api.lead.test.js
git commit -m "feat(lead): correo con cuatro salidas, primer/segundo paso, datos de consumo y vocabulario sin CFE

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Prueba exhaustiva sobre los 7 perfiles

**Files:**
- Modify: `test/diagnostico.exhaustive.test.js` (reescribir completo)

**Interfaces:**
- Consumes: todo lo anterior vía `assembleResult`.

- [ ] **Step 1: Reescribir el archivo**

```js
// Regresión exhaustiva v4: recorre los 7 perfiles con todas las combinaciones de sus
// pasos (condicional en ambos estados) y verifica invariantes del spec v4 §4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import industria from '../js/diagnostico.content.js';
import hoteles from '../js/diagnostico.hoteles.content.js';
import electromovilidad from '../js/diagnostico.electromovilidad.content.js';
import cadenaFrio from '../js/diagnostico.cadena-frio.content.js';
import microred from '../js/diagnostico.microred.content.js';
import bombeo from '../js/diagnostico.bombeo.content.js';
import centrosDatos from '../js/diagnostico.centros-datos.content.js';
import { assembleResult, hasSignal } from '../js/diagnostico.engine.js';
import { pasoVisible } from '../js/diagnostico.flujo.js';

const profiles = [industria, hoteles, electromovilidad, cadenaFrio, microred, bombeo, centrosDatos];

const disparadores = [
  ['costo'], ['capacidad'], ['diesel'], ['excedente'], ['continuidad'], ['aislado'],
  ['capacidad', 'continuidad'], ['diesel', 'aislado'], ['capacidad', 'diesel', 'excedente', 'continuidad']
];

function* combinaciones(content) {
  const fijos = content.pasos.filter((p) => !p.when && !p.multi);
  const condicional = content.pasos.find((p) => p.rol === 'condicional');
  const rec = (i, acc) => (i === fijos.length ? [acc] : fijos[i].opciones.flatMap((o) => rec(i + 1, { ...acc, [fijos[i].key]: o.codigo })));
  for (const base of rec(0, {})) {
    for (const disparador of disparadores) {
      const resp = { ...base, disparador };
      if (condicional && pasoVisible(condicional, resp)) {
        for (const o of condicional.opciones) yield { ...resp, [condicional.key]: o.codigo };
      } else if (condicional) {
        yield { ...resp, [condicional.key]: null };
      } else {
        yield resp;
      }
    }
  }
}

for (const content of profiles) {
  test(`exhaustiva v4: ${content.profile.id}`, { timeout: 120_000 }, () => {
    let total = 0;
    let frenos = 0;
    const requisitosBase = content.requisitos?.base || [];
    for (const respuestas of combinaciones(content)) {
      total += 1;
      const res = assembleResult({ respuestas }, content);
      const rec = res.recomendacion_solucion;
      const ctx = `${content.profile.id} ${JSON.stringify(respuestas)}`;

      assert.ok(['Bajo', 'Medio', 'Alto', 'Muy Alto'].includes(res.encaje_tecnico), ctx);
      assert.ok(['Sin cuantificar', 'Chico', 'Medio', 'Grande'].includes(res.tamano), ctx);
      assert.ok(['Alta', 'Media', 'Baja'].includes(res.confianza.nivel), ctx);
      assert.ok(typeof rec.tipo === 'string' && rec.tipo, ctx);

      if (rec.primerPaso) {
        frenos += 1;
        assert.ok(rec.segundoPaso && rec.segundoPaso.tipo, `sin segundo paso: ${ctx}`);
        assert.ok(!hasSignal(respuestas.disparador, 'aislado'), `freno con aislado: ${ctx}`);
        assert.notEqual(res.encaje_tecnico, 'Bajo', `freno con encaje Bajo: ${ctx}`);
      }
      if (res.conectado === false) {
        assert.equal(res.limitaciones[0]?.dato, content.limitaciones.consumo.dato, `limitación sin red: ${ctx}`);
        assert.equal(res.tamano, 'Sin cuantificar', ctx);
      }
      const reqs = rec.primerPaso ? (rec.requisitos || []) : (content.requisitos?.[rec.familia] || requisitosBase);
      const hayNolose = reqs.some((r) => respuestas[r] === 'nolose');
      if (hayNolose) assert.notEqual(res.confianza.nivel, 'Alta', `confianza Alta con nolose: ${ctx}`);

      // Encaje no depende de la factura; tamaño no depende del perfil.
      const otraFactura = respuestas.factura === 'bajo' ? 'alto' : 'bajo';
      const resF = assembleResult({ respuestas: { ...respuestas, factura: otraFactura } }, content);
      assert.equal(resF.encaje_tecnico, res.encaje_tecnico, `encaje cambió con factura: ${ctx}`);
      const otroPerfil = respuestas.perfil === 'plano' ? 'picos' : 'plano';
      const resP = assembleResult({ respuestas: { ...respuestas, perfil: otroPerfil } }, content);
      assert.equal(resP.tamano, res.tamano, `tamaño cambió con perfil: ${ctx}`);
    }
    assert.ok(total > 0, 'sin combinaciones');
    if (content.frenos?.length) assert.ok(frenos > 0, `${content.profile.id}: ningún freno se activó`);
  });
}
```

- [ ] **Step 2: Correr**

Run: `node --test test/diagnostico.exhaustive.test.js`
Expected: PASS en los 7 perfiles. Si alguna invariante falla, es un bug del motor o del contenido: arreglar la causa (no la invariante). El encaje ya se calcula con la factura neutralizada (Tarea 4 Step 3), así que `encaje cambió con factura` no debe ocurrir; si ocurre, revisar que `assembleResult` use `scoresNeutros` para el encaje y para `applyBrakes`.

- [ ] **Step 3: Correr todo y commit**

Run: `npm test`
Expected: PASS.

```bash
git add test/diagnostico.exhaustive.test.js js/diagnostico.engine.js
git commit -m "test(diagnostico): regresión exhaustiva v4 sobre los 7 perfiles

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Versiones, cache-bust y limpieza

**Files:**
- Modify: `js/diagnostico.content.js`, `js/diagnostico.hoteles.content.js` (`profile.version`)
- Modify: todos los archivos con `?v=14` (js, html, css)
- Modify: `docs/superpowers/specs/2026-09-06-motor-diagnostico-v4-design.md` (estado)

- [ ] **Step 1: Versiones**

En `js/diagnostico.content.js` y `js/diagnostico.hoteles.content.js` cambiar `version: '2.0'` por `version: '3.0'`. (El default de fábrica ya quedó en `2.0` en la Tarea 1.)

- [ ] **Step 2: Cache-bust**

```bash
git ls-files -z | xargs -0 grep -l "v=14" | grep -v "\.md$" | while read f; do sed -i '' 's/v=14/v=15/g' "$f"; done
grep -rn "v=14" --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.codex_tmp . | grep -v "\.md:"
```

La segunda línea no debe imprimir nada. Verificar que el import de `diagnostico.flujo.js` en `app.js` también diga `?v=15`.

- [ ] **Step 3: Estado del spec**

En el spec cambiar `Estado: aprobado en chat (3 secciones), pendiente de plan de implementación.` por `Estado: implementado (ver plan 2026-09-06-motor-diagnostico-v4.md).`

- [ ] **Step 4: Correr todo, verificar en navegador un perfil de cada tipo**

Run: `npm test` → PASS.
Navegador: `/diagnostico-industria-comercio/` (7 pasos, sin continuidad; 8 con continuidad), `/diagnostico-hoteles/` (igual), `/diagnostico-bombeo/` (freno hidráulico con tanque sin horario + perfil punta).

- [ ] **Step 5: Commit**

```bash
git add -A js css api diagnostico*/index.html docs/superpowers/specs/2026-09-06-motor-diagnostico-v4-design.md
git commit -m "chore(diagnostico): versiones de perfil 3.0/2.0 y cache-bust v14 -> v15 para publicar el motor v4

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review (hecho al escribir el plan)

- **Cobertura del spec:** §1.1-1.6 → Tareas 1, 2 (tarifa microred), 3 (propias/condicionales), 5 (vista). §2.1 → Tarea 3. §2.2 → Tareas 2 y 4. §2.3 → Tarea 2. §2.4 → Tareas 4 y 6. §2.5 → Tareas 3, 4, 6. §3.1-3.3 → Tareas 1 (`pasosEnriquecimiento`), 5, 6. §4 → Tareas 1, 2, 3, 4, 6, 7. §5 → Tarea 8 y compatibilidad en Tarea 6 (fallback `PREGUNTAS`).
- **Desviaciones del spec, documentadas:** códigos de tarifa de microred sin prefijo `cfe_*` (Tarea 2 Step 7 actualiza el spec); `corte` no mostrada se normaliza a `nada` (Global Constraints); el spec pedía `profile_version` `2.0` para todos, aquí industria/hoteles van a `3.0` porque ya estaban en `2.0`.
- **Consistencia de nombres:** `applyBrakes`, `encajeTecnico`, `tamanoOportunidad`, `confianza`, `intencionComercial`, `derivarConectado`, `pasoVisible`, `pasosVisibles`, `siguienteIndice`, `anteriorIndice`, `pasosEnriquecimiento`, `familiaEfectiva`, `listaEnriquecimiento`, `irAEnriquecimiento`, `retrocederEnriquecimiento`, `finishEnrichment`, `guardarEnriquecimiento` se usan con la misma firma en todas las tareas.
