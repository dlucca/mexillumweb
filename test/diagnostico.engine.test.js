import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';
import { plantaLabel, buildProfile, toReadable } from '../js/diagnostico.engine.js';

// Fixture canónico del spec §5.
const fx = {
  sector: 'manufactura', sitios: 'pocos', generacion: 'fisica', demanda: 'desconoce',
  tarifa: 'gdmth', factura: 'alto', corte: 'reinicio', disparador: 'costo'
};

test('plantaLabel: "tu operación" para un solo sitio, "esa planta" para varios', () => {
  assert.equal(plantaLabel({ sitios: 'uno' }), 'tu operación');
  assert.equal(plantaLabel({ sitios: 'pocos' }), 'esa planta');
  assert.equal(plantaLabel({ sitios: 'muchos' }), 'esa planta');
});

test('buildProfile: fixture arma el perfil esperado', () => {
  assert.equal(buildProfile(fx, content), 'Perfil: manufactura multi-planta con exposición a cargo por demanda.');
});

test('buildProfile: exposición estacional tiene máxima prioridad', () => {
  const r = { sector: 'continuo', sitios: 'uno', generacion: 'estacional', disparador: 'diesel' };
  assert.equal(buildProfile(r, content), 'Perfil: proceso continuo con generación estacional y hueco fuera de temporada.');
});

test('buildProfile: continuo sin estacional usa la exposición de proceso continuo', () => {
  const r = { sector: 'continuo', sitios: 'uno', generacion: 'no', disparador: 'costo' };
  assert.equal(buildProfile(r, content), 'Perfil: proceso continuo de proceso continuo con exposición estructural a horario punta.');
});

test('buildProfile: capacidad y diesel como exposición cuando no hay estacional ni continuo', () => {
  const rc = { sector: 'manufactura', sitios: 'uno', generacion: 'no', disparador: 'capacidad' };
  assert.equal(buildProfile(rc, content), 'Perfil: manufactura con restricción de capacidad eléctrica.');
  const rd = { sector: 'frio', sitios: 'muchos', generacion: 'no', disparador: 'diesel' };
  assert.equal(buildProfile(rd, content), 'Perfil: frío y logística multi-planta con dependencia de diésel.');
});

test('toReadable: mapea códigos a labels visibles', () => {
  const leg = toReadable(fx, content);
  assert.equal(leg.sector, 'Manufactura por turnos o por lotes');
  assert.equal(leg.tarifa, 'GDMTH');
  assert.equal(leg.corte, 'Se detiene producción y reiniciar toma horas');
});
