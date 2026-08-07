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
