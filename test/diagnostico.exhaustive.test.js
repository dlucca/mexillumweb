import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';
import {
  scoreOpportunities, rankOpportunities, potencialGeneral, primaryApplication,
  recommendSolution, renderBlockB, pickLevers
} from '../js/diagnostico.engine.js';

const codes = Object.fromEntries(content.pasos.map((p) => [p.key, p.opciones.map((o) => o.codigo)]));
const disparadores = [
  ['costo'],
  ['capacidad'], ['diesel'], ['excedente'],
  ['capacidad', 'diesel'], ['capacidad', 'excedente'], ['diesel', 'excedente'],
  ['capacidad', 'diesel', 'excedente']
];

test('regresión exhaustiva: todas las combinaciones mantienen conclusiones coherentes', { timeout: 30_000 }, () => {
  let total = 0;
  for (const sector of codes.sector)
  for (const perfil of codes.perfil)
  for (const generacion of codes.generacion)
  for (const calidad of codes.calidad)
  for (const tarifa of codes.tarifa)
  for (const factura of codes.factura)
  for (const corte of codes.corte)
  for (const disparador of disparadores) {
    const resp = { sector, perfil, generacion, calidad, tarifa, factura, corte, disparador };
    const scores = scoreOpportunities(resp, content);
    const ranking = rankOpportunities(scores, content);
    const aplicacion = primaryApplication(resp, ranking, scores, content);
    const recomendacion = recommendSolution(resp, scores, content, aplicacion);
    const calculo = renderBlockB(resp, content, aplicacion);
    const palancas = pickLevers(resp, ranking, content, aplicacion);
    const principalEsperada = content.palancasCopy[aplicacion.id].nombre;
    const ultimo = [...ranking].reverse().find((o) => o.id !== aplicacion.id);
    const maxScore = ranking[0].score;

    assert.equal(palancas.principal.nombre, principalEsperada, `principal divergente: ${JSON.stringify(resp)}`);
    assert.notEqual(palancas.descartada.nombre, palancas.principal.nombre);
    assert.equal(palancas.descartada.tag, ultimo.score === 0 ? 'No aplica' : 'Menor prioridad');
    if (ultimo.score > 0) assert.equal(palancas.descartada.text, content.palancasCopy[ultimo.id].menor);

    if (!calculo.sinNumero) {
      // El rango se da para peak shaving o, desde v2.3, para arbitraje (que exige tarifa horaria).
      assert.ok(['peak_shaving', 'arbitraje'].includes(aplicacion.id), `rango con aplicación inesperada: ${JSON.stringify(resp)}`);
      if (aplicacion.id === 'arbitraje') assert.ok(['gdmth', 'dist'].includes(tarifa), `arbitraje con rango en tarifa no horaria: ${JSON.stringify(resp)}`);
      assert.ok(['gdmth', 'dist', 'gdmto', 'gdbt'].includes(tarifa));
      assert.notEqual(factura, 'nolose');
    }
    if (tarifa === 'pdbt' || tarifa === 'nolose' || tarifa === 'privado') assert.ok(calculo.sinNumero);

    if (disparador.includes('diesel')) assert.notEqual(recomendacion.tipo, 'Solar fotovoltaico on-grid');
    if (disparador.includes('capacidad')) assert.notEqual(recomendacion.tipo, 'Solar fotovoltaico on-grid');
    if (maxScore < content.scoring.umbralPotencial.medio) {
      assert.equal(recomendacion.tipo, 'Evidencia insuficiente', `recomendación excesiva: ${JSON.stringify(resp)}`);
      assert.equal(aplicacion.preliminar, true);
    }
    for (const score of Object.values(scores)) assert.ok(score >= 0 && score <= 100);
    assert.ok(['Bajo', 'Medio', 'Alto', 'Muy Alto'].includes(potencialGeneral(scores, resp, content)));
    total++;
  }

  assert.equal(total, 700_000);
});

test('tarifas: PDBT queda separada y no comparte cálculo de demanda', () => {
  const tarifa = content.pasos.find((p) => p.key === 'tarifa');
  assert.deepEqual(tarifa.opciones.map((o) => o.codigo), ['gdmth', 'gdmto', 'dist', 'gdbt', 'pdbt', 'nolose', 'privado']);
  assert.equal(content.tablaDemanda.pdbt, null);
  assert.equal(content.tablaDemanda.nolose, null);
  const scores = scoreOpportunities({
    sector: 'frio', perfil: 'picos', generacion: 'no', calidad: 'factor', tarifa: 'pdbt',
    factura: 'muyalto', corte: 'nada', disparador: ['excedente']
  }, content);
  assert.equal(scores.peak_shaving, 0);
  assert.equal(scores.arbitraje, 0);
});
