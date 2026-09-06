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
