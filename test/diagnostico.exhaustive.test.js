// Regresión exhaustiva v4: recorre los 7 perfiles con todas las combinaciones de sus
// pasos (condicional en ambos estados) y verifica invariantes del spec v4 §4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import industria from '../js/diagnostico.content.js';
import hoteles from '../js/diagnostico.hoteles.content.js';
import electromovilidad from '../js/diagnostico.electromovilidad.content.js';
import cadenaFrio from '../js/diagnostico.cadena-frio.content.js';
import microred from '../js/diagnostico.microred.content.js';
import bombeo from '../js/diagnostico.bombeo.content.js';
import centrosDatos from '../js/diagnostico.centros-datos.content.js';
import { assembleResult, hasSignal } from '../js/diagnostico.engine.js';
import { pasoVisible } from '../js/diagnostico.flujo.js';

const profiles = [industria, hoteles, electromovilidad, cadenaFrio, microred, bombeo, centrosDatos];

const disparadores = [
  ['costo'], ['capacidad'], ['diesel'], ['excedente'], ['continuidad'], ['aislado'],
  ['capacidad', 'continuidad'], ['diesel', 'aislado'], ['capacidad', 'diesel', 'excedente', 'continuidad']
];

function* combinaciones(content) {
  const fijos = content.pasos.filter((p) => !p.when && !p.multi);
  const condicional = content.pasos.find((p) => p.rol === 'condicional');
  const rec = (i, acc) => (i === fijos.length ? [acc] : fijos[i].opciones.flatMap((o) => rec(i + 1, { ...acc, [fijos[i].key]: o.codigo })));
  for (const base of rec(0, {})) {
    for (const disparador of disparadores) {
      const resp = { ...base, disparador };
      if (condicional && pasoVisible(condicional, resp)) {
        for (const o of condicional.opciones) yield { ...resp, [condicional.key]: o.codigo };
        // El condicional es visible (posiblemente siempre, con `when: {}`); se agrega además
        // el caso `null` para simular un payload parcial/legacy y ejercitar ambos estados.
        yield { ...resp, [condicional.key]: null };
      } else if (condicional) {
        yield { ...resp, [condicional.key]: null };
      } else {
        yield resp;
      }
    }
  }
}

// El generador cubre entre ~250k y ~900k combinaciones por perfil (7 pasos fijos con hasta
// 8 opciones cada uno, x 9 listas de disparador, x hasta 5 opciones condicionales). Las dos
// invariantes cruzadas (factura/perfil) piden dos assembleResult() adicionales por caso; para
// no exceder el timeout se muestrean cada 5 combinaciones en vez de en todas — las invariantes
// principales (encaje/tamaño/confianza/freno/limitaciones) sí corren sobre el 100% de los casos.
const MUESTREO_CRUZADO = 5;

for (const content of profiles) {
  test(`exhaustiva v4: ${content.profile.id}`, { timeout: 120_000 }, () => {
    let total = 0;
    let frenos = 0;
    const requisitosBase = content.requisitos?.base || [];
    for (const respuestas of combinaciones(content)) {
      total += 1;
      const res = assembleResult({ respuestas }, content);
      const rec = res.recomendacion_solucion;
      const ctx = `${content.profile.id} ${JSON.stringify(respuestas)}`;

      assert.ok(['Bajo', 'Medio', 'Alto', 'Muy Alto'].includes(res.encaje_tecnico), ctx);
      assert.ok(['Sin cuantificar', 'Chico', 'Medio', 'Grande'].includes(res.tamano), ctx);
      assert.ok(['Alta', 'Media', 'Baja'].includes(res.confianza.nivel), ctx);
      assert.ok(typeof rec.tipo === 'string' && rec.tipo, ctx);

      if (rec.primerPaso) {
        frenos += 1;
        assert.ok(rec.segundoPaso && rec.segundoPaso.tipo, `sin segundo paso: ${ctx}`);
        assert.ok(!hasSignal(respuestas.disparador, 'aislado'), `freno con aislado: ${ctx}`);
        assert.notEqual(res.encaje_tecnico, 'Bajo', `freno con encaje Bajo: ${ctx}`);
      }
      if (res.conectado === false) {
        assert.equal(res.limitaciones[0]?.dato, content.limitaciones.consumo.dato, `limitación sin red: ${ctx}`);
        assert.equal(res.tamano, 'Sin cuantificar', ctx);
      }
      const reqs = rec.primerPaso ? (rec.requisitos || []) : (content.requisitos?.[rec.familia] || requisitosBase);
      const hayNolose = reqs.some((r) => respuestas[r] === 'nolose');
      if (hayNolose) assert.notEqual(res.confianza.nivel, 'Alta', `confianza Alta con nolose: ${ctx}`);

      // Encaje no depende de la factura; tamaño no depende del perfil. Muestreado (ver nota arriba).
      if (total % MUESTREO_CRUZADO === 0) {
        const otraFactura = respuestas.factura === 'bajo' ? 'alto' : 'bajo';
        const resF = assembleResult({ respuestas: { ...respuestas, factura: otraFactura } }, content);
        assert.equal(resF.encaje_tecnico, res.encaje_tecnico, `encaje cambió con factura: ${ctx}`);
        const otroPerfil = respuestas.perfil === 'plano' ? 'picos' : 'plano';
        const resP = assembleResult({ respuestas: { ...respuestas, perfil: otroPerfil } }, content);
        assert.equal(resP.tamano, res.tamano, `tamaño cambió con perfil: ${ctx}`);
      }
    }
    assert.ok(total > 0, 'sin combinaciones');
    if (content.frenos?.length) assert.ok(frenos > 0, `${content.profile.id}: ningún freno se activó`);
  });
}
