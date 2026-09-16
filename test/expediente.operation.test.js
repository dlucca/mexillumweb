import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMON, CONDITIONAL, SCHEDULE, derivedSchedule, operationQuestions, operationSummary } from '../js/expediente.operation.js';
import { sanitizeSimulation } from '../js/expediente.simulation-settings.js';
import { sanitizeAnswers } from '../lib/onboarding/store.js';

test('ninguna pregunta común o condicional pide texto y todas cierran con nolose', () => {
  for (const q of [...COMMON, ...CONDITIONAL]) {
    assert.ok(['select', 'multi'].includes(q.type), `${q.key}: tipo ${q.type}`);
    assert.equal(q.options.at(-1).value, 'nolose', `${q.key}: última opción`);
    assert.equal(new Set(q.options.map((o) => o.value)).size, q.options.length, `${q.key}: opciones repetidas`);
  }
});

test('cada horario produce números que el motor horario acepta', () => {
  for (const [code, expected] of Object.entries(SCHEDULE.hours)) {
    const out = derivedSchedule({ hours: code });
    assert.deepEqual(out, expected, code);
    assert.ok(Number.isInteger(out.loadShape) && out.loadShape >= 0 && out.loadShape <= 2, `${code}: loadShape`);
    if (out.loadShape !== 0) assert.ok(out.operationStart < out.operationEnd, `${code}: start < end`);
    // sanitizeSimulation conserva solo los valores dentro de los límites del motor.
    assert.deepEqual(sanitizeSimulation(out), out, `${code}: fuera de límites`);
  }
});

test('los días y la caída fuera de horario producen porcentajes válidos', () => {
  assert.equal(derivedSchedule({ days: 'lv' }).weekendPct, 15);
  assert.equal(derivedSchedule({ days: 'ls' }).weekendPct, 55);
  assert.equal(derivedSchedule({ days: 'todos' }).weekendPct, 100);
  assert.equal(derivedSchedule({ off: 'apaga' }).offHoursPct, 10);
  assert.equal(derivedSchedule({ off: 'igual' }).offHoursPct, 100);
  for (const k of ['weekendPct', 'offHoursPct']) {
    for (const code of Object.keys(k === 'weekendPct' ? SCHEDULE.days : SCHEDULE.off)) {
      const v = derivedSchedule(k === 'weekendPct' ? { days: code } : { off: code })[k];
      assert.ok(v >= 1 && v <= 100, `${code}: ${k}=${v}`);
    }
  }
});

test('no lo sé y los códigos inventados no escriben ningún número', () => {
  assert.deepEqual(derivedSchedule({ days: 'nolose', hours: 'nolose', off: 'nolose' }), {});
  assert.deepEqual(derivedSchedule({ hours: 'inventado' }), {});
  assert.deepEqual(derivedSchedule({}), {});
  // Sin loadShape, la simulación revela que el horario no está confirmado.
  assert.ok(!('loadShape' in derivedSchedule({ days: 'lv' })));
});

test('las condicionales aparecen solo cuando su respuesta previa lo pide', () => {
  const keys = (a, req = []) => operationQuestions(a, req).map((q) => q.key);
  assert.ok(!keys({}).includes('backupTime'));
  assert.ok(keys({ objective: ['continuity'] }).includes('backupTime'));
  assert.ok(keys({ objective: ['growth'] }).includes('growthSize'));
  assert.ok(keys({ equipment: ['solar'] }).includes('solarSize'));
  assert.ok(keys({ equipment: ['solar'] }).includes('solarExport'));
  assert.ok(keys({ power: ['apagones'] }).includes('powerFreq'));
  assert.ok(!keys({ power: ['ninguno'] }).includes('powerFreq'));
  assert.ok(!keys({ power: ['nolose'] }).includes('powerFreq'));
  assert.ok(keys({}, ['manualBill']).includes('manualBill'));
  assert.ok(!keys({}).includes('manualBill'));
});

test('el resumen devuelve etiquetas visibles y omite lo no contestado', () => {
  const summary = operationSummary({ days: 'lv', hours: 'dos_turnos', equipment: ['solar', 'battery'] });
  const flat = JSON.stringify(summary);
  assert.ok(flat.includes('Lunes a viernes'));
  assert.ok(flat.includes('Dos turnos'));
  assert.ok(flat.includes('Paneles solares'));
  assert.ok(flat.includes('Baterías'));
  // Ningún código interno debe filtrarse al asesor.
  for (const code of ['dos_turnos', 'nolose', '"lv"', 'battery']) assert.ok(!flat.includes(code), code);
  assert.ok(!flat.includes('Por confirmar'), 'no debe listar preguntas sin respuesta');
  assert.deepEqual(operationSummary({}), []);
});

test('el servidor descarta códigos inventados y campos eliminados', () => {
  const out = sanitizeAnswers({
    sector: 'Hotel', days: 'lv', hours: 'inventado', off: 'mitad', scope: 'parte',
    objective: ['cost', 'fake'], equipment: ['solar', 'fake'], power: ['apagones'],
    schedule: 'Lunes a viernes de 7 a 20', quality: 'Se va la luz seguido',
    outage: 'x', growth: 'y', solar: 'z'
  });
  assert.equal(out.days, 'lv');
  assert.equal(out.scope, 'parte');
  assert.equal(out.hours, undefined, 'código inventado');
  assert.deepEqual(out.objective, ['cost']);
  assert.deepEqual(out.equipment, ['solar']);
  for (const k of ['schedule', 'quality', 'outage', 'growth', 'solar']) {
    assert.ok(!(k in out), `${k} debe desaparecer`);
  }
});

test('el servidor deriva los números y nunca los acepta del cuerpo', () => {
  const out = sanitizeAnswers({ days: 'todos', hours: 'nocturno', off: 'apaga' });
  assert.equal(out.weekendPct, 100);
  assert.equal(out.loadShape, 2);
  assert.equal(out.operationStart, 6);
  assert.equal(out.operationEnd, 20);
  assert.equal(out.offHoursPct, 10);
  // Un cuerpo falsificado no puede inyectar números.
  const forged = sanitizeAnswers({ hours: 'matutino', loadShape: 0, operationStart: 23, operationEnd: 1, offHoursPct: 99, weekendPct: 1 });
  assert.equal(forged.loadShape, 1);
  assert.equal(forged.operationStart, 7);
  assert.equal(forged.operationEnd, 16);
  assert.equal(forged.offHoursPct, undefined);
  assert.equal(forged.weekendPct, undefined);
});

test('manualTariff deja de ser texto libre', () => {
  assert.equal(sanitizeAnswers({ manualTariff: 'gdmth' }).manualTariff, 'gdmth');
  assert.equal(sanitizeAnswers({ manualTariff: 'lo que sea' }).manualTariff, undefined);
});
