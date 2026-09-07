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

const COMUNES = ['sector', 'disparador', 'perfil', 'generacion', 'tarifa', 'factura'];

test('todos los perfiles cumplen el contrato 6 comunes + 1 propia + 0/1 condicional', () => {
  for (const content of profiles) {
    const id = content.profile?.id;
    assert.ok(id, 'falta profile.id');
    const comunes = content.pasos.filter((p) => p.rol === 'comun');
    const propias = content.pasos.filter((p) => p.rol === 'propia');
    const condicionales = content.pasos.filter((p) => p.rol === 'condicional');
    assert.deepEqual(comunes.map((p) => p.key), COMUNES, `${id}: comunes`);
    assert.equal(propias.length, 1, `${id}: una propia`);
    assert.ok(condicionales.length <= 1, `${id}: máximo una condicional`);
    assert.ok(content.pasos.length >= 7 && content.pasos.length <= 8, `${id}: 7 u 8 pasos`);
    if (condicionales.length) {
      assert.equal(content.pasos[content.pasos.length - 1].rol, 'condicional', `${id}: condicional al final`);
      assert.equal(typeof condicionales[0].when, 'object', `${id}: condicional con when`);
    }
    const keys = content.pasos.map((p) => p.key);
    assert.equal(new Set(keys).size, keys.length, `${id}: keys únicas`);
    for (const p of content.pasos) {
      const codigos = p.opciones.map((o) => o.codigo);
      assert.equal(new Set(codigos).size, codigos.length, `${id}/${p.key}: códigos únicos`);
      if (!p.multi && !['sector', 'generacion', 'corte'].includes(p.key)) {
        assert.ok(codigos.includes('nolose'), `${id}/${p.key}: falta nolose`);
      }
    }
    const disparador = content.pasos.find((p) => p.key === 'disparador');
    assert.ok(disparador.opciones.some((o) => o.codigo === 'continuidad'), `${id}: disparador sin continuidad`);
    assert.equal(typeof content.resumen?.aplicaFrase?.Alto, 'string', id);
    assert.equal(typeof content.progresoLabel, 'function', id);
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

// Bombeo: el mapa de áreas sale siempre, aunque el motor empuje peak shaving o
// diferimiento. Un lead con espacio para generación no debe quedarse sin marcarlo.
test('bombeo: el mapa de áreas se fuerza en el enriquecimiento', async () => {
  const { pasosEnriquecimiento } = await import('../js/diagnostico.flujo.js');
  const res = { recomendacion_solucion: { tipo: 'BESS', familia: 'bess' } };
  const pasos = pasosEnriquecimiento(res, bombeo, { conectado: true });
  assert.equal(pasos[0], 'techo');
});
