import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assembleResult } from '../js/diagnostico.engine.js';
import industria from '../js/diagnostico.content.js';
import hoteles from '../js/diagnostico.hoteles.content.js';
import electromovilidad from '../js/diagnostico.electromovilidad.content.js';
import cadenaFrio from '../js/diagnostico.cadena-frio.content.js';
import microred from '../js/diagnostico.microred.content.js';
import bombeo from '../js/diagnostico.bombeo.content.js';
import centrosDatos from '../js/diagnostico.centros-datos.content.js';

const profiles = [industria, hoteles, electromovilidad, cadenaFrio, microred, bombeo, centrosDatos];
const expectedKeys = ['sector', 'perfil', 'generacion', 'calidad', 'tarifa', 'factura', 'corte', 'disparador'];

test('todos los perfiles cumplen el mismo contrato de ocho pasos', () => {
  for (const content of profiles) {
    assert.ok(content.profile?.id, 'falta profile.id');
    assert.deepEqual(content.pasos.map((step) => step.key), expectedKeys, content.profile.id);
    assert.equal(typeof content.resumen?.aplicaFrase?.Alto, 'string', content.profile.id);
    assert.equal(typeof content.progresoLabel, 'function', content.profile.id);
  }
});

test('todos los perfiles producen un resultado y payload identificable', () => {
  for (const content of profiles) {
    const respuestas = Object.fromEntries(content.pasos.map((step) => [
      step.key,
      step.multi ? [step.opciones[0].codigo] : step.opciones[0].codigo
    ]));
    const result = assembleResult({ respuestas, contacto: {} }, content);
    assert.equal(result.leadPayload.profile_id, content.profile.id);
    assert.equal(result.leadPayload.profile_version, content.profile.version);
    assert.ok(result.recomendacion_solucion.tipo);
    assert.doesNotMatch(result.perfil, /undefined/);
  }
});

test('el hub enlaza las siete rutas y cada ruta carga su vista', async () => {
  const hub = await readFile(new URL('../diagnostico/index.html', import.meta.url), 'utf8');
  for (const content of profiles) {
    assert.match(hub, new RegExp(`href="${content.profile.route}"`), content.profile.id);
    const html = await readFile(new URL(`..${content.profile.route}/index.html`, import.meta.url), 'utf8');
    assert.match(html, /diagnostico\..+view\.js|diagnostico\.view\.js/);
  }
});
