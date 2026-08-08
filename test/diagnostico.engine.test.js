import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';
import {
  plantaLabel, buildProfile, toReadable,
  roundHalfEven, formatMoney, formatRango, computeRange, renderBlockB
} from '../js/diagnostico.engine.js';

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

test('roundHalfEven: medio-a-par en las fronteras', () => {
  assert.equal(roundHalfEven(2.25, 1), 2.2);   // 2 es par
  assert.equal(roundHalfEven(2.35, 1), 2.4);   // 4 es par
  assert.equal(roundHalfEven(2.18745, 1), 2.2); // no es medio → redondeo normal
  assert.equal(roundHalfEven(4.2, 1), 4.2);
});

test('formatMoney: millones con un decimal; <1M a la decena de miles', () => {
  assert.equal(formatMoney(2500000), '$2.5 millones');
  assert.equal(formatMoney(7000000), '$7.0 millones');
  assert.equal(formatMoney(2250000), '$2.2 millones');
  assert.equal(formatMoney(640000), '$640,000');
  assert.equal(formatMoney(120000), '$120,000');
});

test('formatRango: sufijo "millones" compartido cuando ambos ≥1M', () => {
  assert.equal(formatRango(2250000, 4200000), '$2.2 a $4.2 millones de MXN al año');
  assert.equal(formatRango(640000, 980000), '$640,000 a $980,000 de MXN al año');
});

test('computeRange: fixture da piso 2,250,000 y techo 4,200,000', () => {
  const fixture = { sector: 'manufactura', tarifa: 'gdmth', factura: 'alto', disparador: 'costo' };
  const r = computeRange(fixture, content);
  assert.equal(r.sinNumero, null);
  assert.equal(r.piso, 2250000);
  assert.equal(r.techo, 4200000);
});

test('computeRange: privado tiene precedencia sobre nolose', () => {
  assert.equal(computeRange({ tarifa: 'privado', factura: 'nolose', sector: 'manufactura' }, content).sinNumero, 'privado');
  assert.equal(computeRange({ tarifa: 'gdmth', factura: 'nolose', sector: 'manufactura' }, content).sinNumero, 'nolose');
});

test('renderBlockB: caso con número incluye cadena, rango exacto y disclaimer', () => {
  const fixture = { sector: 'manufactura', tarifa: 'gdmth', factura: 'alto', disparador: 'costo' };
  const b = renderBlockB(fixture, content);
  assert.ok(b.texto.includes('$2.5 millones'));
  assert.ok(b.texto.includes('30% y 40%'));
  assert.ok(b.texto.includes('25% y 35%'));
  assert.ok(b.texto.includes('Rango estimado: $2.2 a $4.2 millones de MXN al año.'));
  assert.ok(b.texto.includes('no es una propuesta') || b.texto.includes('no una propuesta'));
  assert.deepEqual(b.notas, []); // disparador=costo → sin nota de diésel
});

test('renderBlockB: sector continuo agrega el extra de arbitraje', () => {
  const r = { sector: 'continuo', tarifa: 'gdmth', factura: 'alto', disparador: 'costo' };
  assert.ok(renderBlockB(r, content).texto.includes('el arbitraje horario suele serlo'));
});

test('renderBlockB: nolose y privado devuelven copy sin número; diésel se suma como nota', () => {
  const nolose = renderBlockB({ sector: 'manufactura', tarifa: 'gdmth', factura: 'nolose', disparador: 'diesel' }, content);
  assert.equal(nolose.sinNumero, 'nolose');
  assert.ok(nolose.texto.startsWith('Para estimar tu ahorro'));
  assert.equal(nolose.notas.length, 1); // nota de diésel se suma
  const privado = renderBlockB({ sector: 'manufactura', tarifa: 'privado', factura: 'alto', disparador: 'costo' }, content);
  assert.equal(privado.sinNumero, 'privado');
  assert.ok(privado.texto.startsWith('Como compras a un suministrador privado'));
});
