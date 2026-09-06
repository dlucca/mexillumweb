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
