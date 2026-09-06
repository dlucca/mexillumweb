import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';
import microred from '../js/diagnostico.microred.content.js';
import {
  derivarConectado, encajeTecnico, tamanoOportunidad, confianza, intencionComercial
} from '../js/diagnostico.salidas.js';

test('derivarConectado: CFE → true; aislado o diésel/sin suministro → false', () => {
  assert.equal(derivarConectado({ tarifa: 'gdmth', disparador: ['costo'] }, content), true);
  assert.equal(derivarConectado({ tarifa: 'gdmth', disparador: ['aislado'] }, content), false);
  assert.equal(derivarConectado({ tarifa: 'diesel', disparador: ['costo'] }, microred), false);
  assert.equal(derivarConectado({ tarifa: 'sin_suministro', disparador: ['costo'] }, microred), false);
  assert.equal(derivarConectado({ tarifa: 'mixto', disparador: ['costo'] }, microred), true);
});

test('derivarConectado: tarifa nolose es null solo donde la red es incierta (microred)', () => {
  assert.equal(derivarConectado({ tarifa: 'nolose', disparador: ['costo'] }, content), true);
  assert.equal(derivarConectado({ tarifa: 'nolose', disparador: ['costo'] }, microred), null);
});

test('encajeTecnico depende solo de los scores', () => {
  const u = content.scoring;
  assert.equal(encajeTecnico({ a: u.umbralPotencial.medio - 1 }, content), 'Bajo');
  assert.equal(encajeTecnico({ a: u.umbralPotencial.medio }, content), 'Medio');
  assert.equal(encajeTecnico({ a: u.umbralFuerte }, content), 'Alto');
  assert.equal(encajeTecnico({ a: u.umbralPotencial.muyAlto, b: 10 }, content), 'Alto');
  assert.equal(encajeTecnico({ a: u.umbralPotencial.muyAlto, b: u.umbralFuerte }, content), 'Muy Alto');
});

test('tamanoOportunidad depende solo de factura, tarifa y conectado', () => {
  assert.equal(tamanoOportunidad({ factura: 'alto', tarifa: 'gdmth', conectado: true }, content), 'Grande');
  assert.equal(tamanoOportunidad({ factura: 'muyalto', tarifa: 'gdmto', conectado: true }, content), 'Grande');
  assert.equal(tamanoOportunidad({ factura: 'medio', tarifa: 'gdbt', conectado: true }, content), 'Medio');
  assert.equal(tamanoOportunidad({ factura: 'bajo', tarifa: 'dist', conectado: true }, content), 'Chico');
  assert.equal(tamanoOportunidad({ factura: 'alto', tarifa: 'nolose', conectado: true }, content), 'Sin cuantificar');
  assert.equal(tamanoOportunidad({ factura: 'alto', tarifa: 'privado', conectado: true }, content), 'Sin cuantificar');
  assert.equal(tamanoOportunidad({ factura: 'nolose', tarifa: 'gdmth', conectado: true }, content), 'Sin cuantificar');
  assert.equal(tamanoOportunidad({ factura: 'alto', tarifa: 'gdmth', conectado: false }, content), 'Sin cuantificar');
});

test('confianza: cuenta faltantes según los requisitos de la familia', () => {
  const rec = { familia: 'bess_solar', primerPaso: false };
  const ok = confianza({ perfil: 'diurno', tarifa: 'gdmth', factura: 'alto' }, rec, { techo: true }, content);
  assert.equal(ok.nivel, 'Alta');
  assert.deepEqual(ok.faltantes, []);
  const uno = confianza({ perfil: 'diurno', tarifa: 'gdmth', factura: 'alto' }, rec, { techo: false }, content);
  assert.equal(uno.nivel, 'Media');
  assert.deepEqual(uno.faltantes, ['techo']);
  const dos = confianza({ perfil: 'nolose', tarifa: 'gdmth', factura: 'nolose' }, rec, { techo: true }, content);
  assert.equal(dos.nivel, 'Baja');
  assert.deepEqual(dos.faltantes, ['perfil', 'factura']);
});

test('confianza: con freno usa los requisitos del freno', () => {
  const rec = { familia: 'primer_paso', primerPaso: true, requisitos: ['gestion_carga', 'perfil'] };
  assert.equal(confianza({ gestion_carga: 'manual', perfil: 'picos' }, rec, {}, content).nivel, 'Alta');
  assert.equal(confianza({ gestion_carga: 'manual', perfil: 'nolose' }, rec, {}, content).nivel, 'Media');
});

test('confianza: off_grid exige consumo', () => {
  const rec = { familia: 'off_grid', primerPaso: false };
  const r = confianza({ fuente: 'diesel_24h', factura: 'medio' }, rec, { consumo: false }, content);
  assert.deepEqual(r.faltantes, ['consumo']);
});

test('intencionComercial', () => {
  assert.equal(intencionComercial({ disparador: ['costo'] }, {}), 'Explorando');
  assert.equal(intencionComercial({ disparador: ['capacidad'] }, {}), 'Evaluando');
  assert.equal(intencionComercial({ disparador: ['costo'] }, { contacto: { tipo_cierre: 'llamada' } }), 'Activo');
});

test('intencionComercial: Activo exige un dato aportado, no solo terminar el enriquecimiento', () => {
  assert.equal(intencionComercial({ disparador: ['costo'] }, { enrichmentDone: true }), 'Explorando');
  assert.equal(intencionComercial({ disparador: ['capacidad'] }, { enrichmentDone: true }), 'Evaluando');
  assert.equal(intencionComercial({ disparador: ['costo'] }, { enrichmentDone: true, techo: { area_m2: 250 } }), 'Activo');
  assert.equal(intencionComercial({ disparador: ['costo'] }, { enrichmentDone: true, acometida: { lat: 1, lng: 2 } }), 'Activo');
  assert.equal(intencionComercial({ disparador: ['costo'] }, { enrichmentDone: true, facturas: { count: 2 } }), 'Activo');
  assert.equal(intencionComercial({ disparador: ['costo'] }, { enrichmentDone: true, datos_consumo: { kwh_dia: 800 } }), 'Activo');
  // Techo dibujado en 0 m² o cero facturas no cuentan como dato.
  assert.equal(intencionComercial({ disparador: ['costo'] }, { enrichmentDone: true, techo: { area_m2: 0 }, facturas: { count: 0 } }), 'Explorando');
});
