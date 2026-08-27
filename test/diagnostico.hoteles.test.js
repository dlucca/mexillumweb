import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.hoteles.content.js';
import { assembleResult } from '../js/diagnostico.engine.js';

const CODES = {
  sector: ['allinclusive', 'resort', 'boutique', 'urbano', 'desarrollo'],
  perfil: ['plano', 'diurno', 'picos', 'punta', 'nolose'],
  generacion: ['solar_sitio', 'contrato', 'no', 'evaluando'],
  calidad: ['factor', 'variaciones', 'cortes', 'no', 'nolose'],
  tarifa: ['gdmth', 'gdmto', 'dist', 'gdbt', 'pdbt', 'nolose', 'privado'],
  factura: ['bajo', 'medio', 'alto', 'muyalto', 'nolose'],
  corte: ['producto', 'reinicio', 'servicio', 'nada']
};

// El content de hoteles respeta el contrato del engine: los códigos de cada paso
// existen y assembleResult corre sin lanzar para personas tipo.
test('los códigos de las opciones coinciden con el set esperado', () => {
  const byKey = Object.fromEntries(content.pasos.map((p) => [p.key, p.opciones.map((o) => o.codigo)]));
  for (const [key, esperados] of Object.entries(CODES)) {
    assert.deepEqual(byKey[key].sort(), [...esperados].sort(), `códigos de ${key}`);
  }
  assert.equal(content.plantaLabel, 'tu propiedad');
});

test('assembleResult corre para un gran resort all-inclusive', () => {
  const estado = { respuestas: { sector: 'allinclusive', perfil: 'plano', generacion: 'no', calidad: 'cortes', tarifa: 'gdmth', factura: 'muyalto', corte: 'servicio', disparador: ['costo'] }, contacto: {} };
  const res = assembleResult(estado, content);
  assert.ok(res.perfil && res.recomendacion_solucion?.tipo);
  assert.ok(res.checklist.full.length > 0);
  assert.ok(Array.isArray(res.leadPayload?.checklist_full));
});

test('assembleResult corre para un boutique evaluando solar', () => {
  const estado = { respuestas: { sector: 'boutique', perfil: 'diurno', generacion: 'evaluando', calidad: 'no', tarifa: 'gdmto', factura: 'medio', corte: 'nada', disparador: ['costo'] }, contacto: {} };
  const res = assembleResult(estado, content);
  assert.ok(res.recomendacion_solucion?.tipo);
  assert.ok(res.palancas?.principal?.nombre);
});

// v2.3: cuando el arbitraje lidera y hay tarifa horaria + factura, se muestra un rango
// (antes solo peak shaving daba número). Ancla de mercado en tablaArbitraje.
test('arbitraje líder con GDMTH + factura muestra un rango (no queda sin número)', () => {
  const estado = { respuestas: { sector: 'allinclusive', perfil: 'punta', generacion: 'no', calidad: 'no', tarifa: 'gdmth', factura: 'alto', corte: 'nada', disparador: ['costo'] }, contacto: {} };
  const res = assembleResult(estado, content);
  assert.equal(res.aplicacion_principal.id, 'arbitraje');
  assert.equal(res.calculo.sin_numero, false);
  assert.ok(res.calculo.rango_texto && /MXN/.test(res.calculo.rango_texto));
});

test('tablaArbitraje conserva los % de mercado esperados', () => {
  assert.deepEqual(content.tablaArbitraje.punta, [0.05, 0.10]);
  assert.deepEqual(content.tablaArbitraje.plano, [0.015, 0.03]);
  assert.deepEqual(content.tablaArbitraje.diurno, [0.03, 0.06]);
  assert.deepEqual(content.tablaArbitraje.picos, [0.015, 0.03]);
  assert.deepEqual(content.tablaArbitraje.nolose, [0.02, 0.05]);
});
