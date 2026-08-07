import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';
import {
  resolveBaseArchetype, pickLayerB, pickLayerC, buildChecklist,
  computeScore, toReadable, assembleResult
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
