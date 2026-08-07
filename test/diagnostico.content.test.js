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

test('los ctaText de Capa C por segmento', () => {
  for (const t of ['industrial', 'comercial', 'ev']) {
    assert.equal(content.capaC[t].ctaText, 'Quiero ver el diagnóstico');
  }
  assert.equal(content.capaC.publico.ctaText, 'Quiero agendar una conversación');
});
