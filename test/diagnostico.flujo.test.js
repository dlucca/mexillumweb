import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pasoVisible, pasosVisibles, siguienteIndice, anteriorIndice, pasosEnriquecimiento
} from '../js/diagnostico.flujo.js';

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

// ---- pasosEnriquecimiento (spec v4 §3.1) ----
const resFam = (familia) => ({ recomendacion_solucion: { familia, primerPaso: false } });
const respDe = (extra) => ({ disparador: [], ...extra });

test('pasosEnriquecimiento: familia × conectado, sin postResult', () => {
  const casos = [
    ['solar', true, ['techo', 'facturas']],
    ['solar', false, ['techo', 'consumo']],
    ['solar', null, ['techo', 'facturas']],
    ['bess', true, ['punto', 'facturas']],
    ['bess', false, ['punto', 'consumo']],
    ['bess', null, ['punto', 'facturas']],
    ['bess_solar', true, ['techo', 'facturas']],
    ['bess_solar', false, ['techo', 'consumo']],
    ['bess_solar', null, ['techo', 'facturas']],
    ['off_grid', true, ['techo', 'facturas']],
    ['off_grid', false, ['techo', 'consumo']],
    ['off_grid', null, ['techo', 'facturas']],
    ['base', true, ['facturas']],
    ['base', false, ['consumo']],
    ['base', null, ['facturas']]
  ];
  for (const [familia, conectado, esperado] of casos) {
    assert.deepEqual(
      pasosEnriquecimiento(resFam(familia), {}, respDe({ conectado })),
      esperado,
      `${familia} con conectado=${String(conectado)}`
    );
  }
});

test('pasosEnriquecimiento: skipRoof degrada el mapa de áreas a punto', () => {
  const post = { postResult: { skipRoof: true } };
  assert.deepEqual(pasosEnriquecimiento(resFam('solar'), post, respDe({ conectado: true })), ['punto', 'facturas']);
  assert.deepEqual(pasosEnriquecimiento(resFam('bess_solar'), post, respDe({ conectado: false })), ['punto', 'consumo']);
});

test('pasosEnriquecimiento: servicePoint pide el punto aunque la familia no lo pida', () => {
  assert.deepEqual(
    pasosEnriquecimiento(resFam('base'), { postResult: { servicePoint: true } }, respDe({ conectado: true })),
    ['punto', 'facturas']
  );
});

test('pasosEnriquecimiento: disparador capacidad pide el punto', () => {
  assert.deepEqual(
    pasosEnriquecimiento(resFam('base'), {}, respDe({ conectado: true, disparador: ['capacidad'] })),
    ['punto', 'facturas']
  );
});

test('pasosEnriquecimiento: forzar techo asciende el punto a mapa de áreas', () => {
  assert.deepEqual(
    pasosEnriquecimiento(resFam('bess'), { postResult: { forzar: ['techo'] } }, respDe({ conectado: true })),
    ['techo', 'facturas']
  );
  // Si no había mapa, techo se agrega al frente.
  assert.deepEqual(
    pasosEnriquecimiento(resFam('base'), { postResult: { forzar: ['techo'] } }, respDe({ conectado: true })),
    ['techo', 'facturas']
  );
  // Si ya había techo, no se duplica.
  assert.deepEqual(
    pasosEnriquecimiento(resFam('solar'), { postResult: { forzar: ['techo'] } }, respDe({ conectado: true })),
    ['techo', 'facturas']
  );
});

test('pasosEnriquecimiento: forzar punto no degrada un mapa de áreas ni duplica', () => {
  assert.deepEqual(
    pasosEnriquecimiento(resFam('solar'), { postResult: { forzar: ['punto'] } }, respDe({ conectado: true })),
    ['techo', 'facturas']
  );
  assert.deepEqual(
    pasosEnriquecimiento(resFam('bess'), { postResult: { forzar: ['punto'] } }, respDe({ conectado: true })),
    ['punto', 'facturas']
  );
  assert.deepEqual(
    pasosEnriquecimiento(resFam('base'), { postResult: { forzar: ['punto'] } }, respDe({ conectado: true })),
    ['punto', 'facturas']
  );
});

test('pasosEnriquecimiento: forzar consumo lo agrega al final, con red', () => {
  assert.deepEqual(
    pasosEnriquecimiento(resFam('bess'), { postResult: { forzar: ['consumo'] } }, respDe({ conectado: true })),
    ['punto', 'facturas', 'consumo']
  );
});

test('pasosEnriquecimiento: con freno manda la familia del segundo paso', () => {
  const res = { recomendacion_solucion: { familia: 'primer_paso', primerPaso: true, segundoPaso: { familia: 'solar' } } };
  assert.deepEqual(pasosEnriquecimiento(res, {}, respDe({ conectado: true })), ['techo', 'facturas']);
  const resBess = { recomendacion_solucion: { familia: 'primer_paso', primerPaso: true, segundoPaso: { familia: 'bess' } } };
  assert.deepEqual(pasosEnriquecimiento(resBess, {}, respDe({ conectado: false })), ['punto', 'consumo']);
});
