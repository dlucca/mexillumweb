import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';
import {
  plantaLabel, buildProfile, toReadable,
  roundHalfEven, formatMoney, formatRango, computeRange, renderBlockB, pickLevers, pickMissingData,
  pickFinancing, ofreceServicio, buildChecklist, assembleResult, buildEventNote,
  scoreOpportunities, rankOpportunities, potencialGeneral, recommendSolution, detectLimitations,
  primaryApplication, normalizeResponses, buildAnteproyecto,
  asList, hasSignal, matchesWhen, matchesRule
} from '../js/diagnostico.engine.js';

// Fixture canónico del spec §5.
const fx = {
  sector: 'manufactura', perfil: 'diurno', generacion: 'no', calidad: 'no',
  tarifa: 'gdmth', factura: 'alto', corte: 'reinicio', disparador: 'costo'
};

test('plantaLabel: una sola instalación siempre → "tu operación"', () => {
  assert.equal(plantaLabel(), 'tu operación');
});

test('buildProfile: fixture arma el perfil esperado', () => {
  assert.equal(buildProfile(fx, content), 'Perfil: manufactura con exposición a cargo por demanda.');
});

test('buildProfile: exposición estacional tiene máxima prioridad', () => {
  const r = { sector: 'continuo', generacion: 'estacional', disparador: 'diesel' };
  assert.equal(buildProfile(r, content), 'Perfil: proceso continuo con generación estacional y hueco fuera de temporada.');
});

test('buildProfile: continuo sin estacional usa la exposición de proceso continuo', () => {
  const r = { sector: 'continuo', generacion: 'no', disparador: 'costo' };
  assert.equal(buildProfile(r, content), 'Perfil: proceso continuo con exposición estructural a horario punta.');
});

test('buildProfile: capacidad y diesel como exposición cuando no hay estacional ni continuo', () => {
  const rc = { sector: 'manufactura', generacion: 'no', disparador: 'capacidad' };
  assert.equal(buildProfile(rc, content), 'Perfil: manufactura con restricción de capacidad eléctrica.');
  const rd = { sector: 'frio', generacion: 'no', disparador: 'diesel' };
  assert.equal(buildProfile(rd, content), 'Perfil: frío y logística con dependencia de diésel.');
});

test('toReadable: mapea códigos a labels visibles', () => {
  const leg = toReadable(fx, content);
  assert.equal(leg.sector, 'Manufactura por turnos o por lotes');
  assert.equal(leg.tarifa, 'GDMTH (Gran Demanda Media Tensión Horaria)');
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
  const fixture = { sector: 'manufactura', perfil: 'diurno', tarifa: 'gdmth', factura: 'alto', disparador: 'costo' };
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
  const fixture = { sector: 'manufactura', perfil: 'diurno', tarifa: 'gdmth', factura: 'alto', disparador: 'costo' };
  const b = renderBlockB(fixture, content);
  assert.ok(b.texto.includes('$2.5 millones'));
  assert.ok(b.texto.includes('30% y 40%'));
  assert.ok(b.texto.includes('25% a 35%'));
  assert.ok(b.texto.includes('Orden de magnitud: $2.2 a $4.2 millones de MXN al año.'));
  assert.ok(b.texto.includes('No es una estimación precisa'));
  assert.deepEqual(b.notas, []); // disparador=costo → sin nota de diésel
});

test('renderBlockB: perfil plano (24/7) agrega el extra de arbitraje', () => {
  const r = { sector: 'continuo', perfil: 'plano', tarifa: 'gdmth', factura: 'alto', disparador: 'costo' };
  // Contra content.bloqueB.continuoExtra y no contra un fragmento literal: lo que
  // se prueba es que el extra se anexa, no cómo está redactado.
  assert.ok(renderBlockB(r, content).texto.includes(content.bloqueB.continuoExtra));
});

test('renderBlockB: nolose y privado devuelven copy sin número; diésel se suma como nota', () => {
  const nolose = renderBlockB({ sector: 'manufactura', tarifa: 'gdmth', factura: 'nolose', disparador: 'diesel' }, content);
  assert.equal(nolose.sinNumero, 'nolose');
  assert.ok(nolose.texto.startsWith('Para dar un orden de magnitud'));
  assert.equal(nolose.notas.length, 1); // nota de diésel se suma
  const privado = renderBlockB({ sector: 'manufactura', tarifa: 'privado', factura: 'alto', disparador: 'costo' }, content);
  assert.equal(privado.sinNumero, 'privado');
  assert.ok(privado.texto.startsWith('Como compras a un suministrador privado'));
});

// ---- BLOQUE C: palancas guiadas por el ranking ----

test('pickLevers: principal = tope del ranking; descarte = fondo del ranking', () => {
  const resp = { ...fx, perfil: 'picos', tarifa: 'gdmth', factura: 'alto', disparador: 'costo' };
  const ranking = rankOpportunities(scoreOpportunities(resp, content), content);
  const l = pickLevers(resp, ranking, content);
  assert.equal(l.principal.nombre, content.palancasCopy[ranking[0].id].nombre);
  assert.equal(l.descartada.nombre, content.palancasCopy[ranking[ranking.length - 1].id].nombre);
  assert.ok(l.descartada.text.length > 0);
});

test('pickLevers: respaldo usa la variante de copy según el tipo de corte', () => {
  const resp = { ...fx, corte: 'producto', calidad: 'cortes', disparador: 'costo', perfil: 'plano', generacion: 'no' };
  const ranking = rankOpportunities(scoreOpportunities(resp, content), content);
  const l = pickLevers(resp, ranking, content);
  // respaldo debería quedar arriba; si es principal o secundaria, su texto es la variante de producto
  const usaVariante = [l.principal, l.secundaria].some((p) => p && p.text === content.palancasRespaldoVariantes.producto);
  assert.ok(usaVariante, 'debe usar la variante de respaldo por producto');
});

test('pickLevers: secundaria null cuando la 2a oportunidad no supera el umbral', () => {
  const resp = { sector: 'manufactura', perfil: 'plano', generacion: 'no', calidad: 'no', tarifa: 'pdbt', factura: 'bajo', corte: 'nada', disparador: 'costo' };
  const ranking = rankOpportunities(scoreOpportunities(resp, content), content);
  const l = pickLevers(resp, ranking, content);
  assert.ok(ranking[1].score < content.scoring.umbralSecundaria, 'fixture debe mantener la 2a oportunidad bajo el umbral');
  assert.equal(l.secundaria, null);
});

test('pickLevers: gancho solo en salidas sin número', () => {
  const rk = (r) => rankOpportunities(scoreOpportunities(r, content), content);
  assert.equal(pickLevers({ ...fx }, rk(fx), content).gancho, null);
  const nolose = { ...fx, factura: 'nolose' };
  assert.equal(pickLevers(nolose, rk(nolose), content).gancho, content.gancho);
});

test('pickLevers: factor de potencia aditivo solo con calidad=factor', () => {
  const con = { ...fx, calidad: 'factor' };
  assert.ok(pickLevers(con, rankOpportunities(scoreOpportunities(con, content), content), content).factorPotencia);
  const sin = { ...fx, calidad: 'no' };
  assert.equal(pickLevers(sin, rankOpportunities(scoreOpportunities(sin, content), content), content).factorPotencia, null);
});

// ---- BLOQUE D: datos que faltan ----

test('pickMissingData: fixture (corte=reinicio, sin señales de igualdad) → regla corte!=nada', () => {
  const d = pickMissingData(fx, content);
  assert.equal(d.dato, content.datoFaltanteCorte);
  assert.equal(d.cierre, content.cierreComun);
});

test('pickMissingData: hard-gaps (factura/tarifa) tienen prioridad sobre el ranking', () => {
  const rk = (r) => rankOpportunities(scoreOpportunities(r, content), content);
  const nolose = { ...fx, factura: 'nolose' };
  const priv = { ...fx, tarifa: 'privado' };
  assert.equal(pickMissingData(nolose, content, rk(nolose)).dato, content.datoFaltante[0].text);
  assert.equal(pickMissingData(priv, content, rk(priv)).dato, content.datoFaltante[1].text);
});

test('pickMissingData: dato principal guiado por la oportunidad mejor rankeada (mejora #5)', () => {
  const porOp = content.datoFaltantePorOportunidad;
  // diésel domina el ranking (perfil plano no favorece peak shaving) → dato de horas de diésel
  const diesel = { sector: 'manufactura', perfil: 'plano', generacion: 'no', calidad: 'no', tarifa: 'pdbt', factura: 'bajo', corte: 'nada', disparador: ['diesel'] };
  const rkD = rankOpportunities(scoreOpportunities(diesel, content), content);
  assert.equal(rkD[0].id, 'diesel');
  assert.equal(pickMissingData(diesel, content, rkD).dato, porOp.diesel);
  // sin ranking → fallbacks legados (corte / default)
  assert.equal(pickMissingData({ ...fx, corte: 'nada', disparador: 'costo' }, content).dato, content.datoFaltanteDefault);
});

test('pickMissingData: señal diésel gana al ranking aunque respaldo quede arriba (mejora #5)', () => {
  const porOp = content.datoFaltantePorOportunidad;
  const resp = { ...fx, perfil: 'plano', disparador: ['diesel'], corte: 'producto', calidad: 'cortes' };
  const rk = rankOpportunities(scoreOpportunities(resp, content), content);
  assert.equal(rk[0].id, 'respaldo'); // el ranking pone respaldo arriba
  assert.equal(pickMissingData(resp, content, rk).dato, porOp.diesel);
});

test('pickMissingData: señal capacidad prioriza el dato de diferimiento', () => {
  const porOp = content.datoFaltantePorOportunidad;
  const resp = { ...fx, perfil: 'picos', disparador: ['capacidad'] };
  const rk = rankOpportunities(scoreOpportunities(resp, content), content);
  assert.notEqual(rk[0].id, 'diferimiento'); // peak shaving domina el ranking
  assert.equal(pickMissingData(resp, content, rk).dato, porOp.diferimiento);
});

test('pickMissingData: recomendación Solar primero / BESS + Solar pide dato de techo-excedente', () => {
  const porOp = content.datoFaltantePorOportunidad;
  // Solar primero con factura conocida (tarifa nolose no es hard-gap)
  const sp = { ...fx, perfil: 'diurno', generacion: 'no', tarifa: 'nolose', factura: 'alto' };
  const recSp = recommendSolution(sp, scoreOpportunities(sp, content), content);
  assert.equal(recSp.tipo, 'Solar fotovoltaico on-grid');
  assert.equal(pickMissingData(sp, content, rankOpportunities(scoreOpportunities(sp, content), content), recSp).dato, porOp.bess_solar);
  // BESS + Solar (estacional) también, salvo diésel/capacidad
  const bs = { ...fx, generacion: 'estacional' };
  const recBs = recommendSolution(bs, scoreOpportunities(bs, content), content);
  assert.equal(recBs.tipo, 'BESS + Solar');
  assert.equal(pickMissingData(bs, content, rankOpportunities(scoreOpportunities(bs, content), content), recBs).dato, porOp.bess_solar);
  // ...pero diésel sigue ganando sobre la recomendación solar
  const bsDiesel = { ...bs, disparador: ['diesel'] };
  assert.equal(pickMissingData(bsDiesel, content, null, recBs).dato, porOp.diesel);
});

test('pickMissingData: factura/tarifa desconocidas conservan prioridad máxima sobre diésel', () => {
  const resp = { ...fx, factura: 'nolose', disparador: ['diesel'] };
  const rk = rankOpportunities(scoreOpportunities(resp, content), content);
  assert.equal(pickMissingData(resp, content, rk).dato, content.datoFaltante[0].text);
  const priv = { ...fx, tarifa: 'privado', disparador: ['diesel'] };
  assert.equal(pickMissingData(priv, content, rk).dato, content.datoFaltante[1].text);
});

// ---- BLOQUE E: financiamiento (opción sujeta a evaluación) ----

test('ofreceServicio: true salvo factura=muyalto', () => {
  assert.equal(ofreceServicio({ factura: 'alto' }), true);
  assert.equal(ofreceServicio({ factura: 'muyalto' }), false);
});

test('pickFinancing: fixture (un solo sitio, sin segmento especial) → default con piloto', () => {
  assert.equal(pickFinancing(fx, content), content.financiamientoDefault);
  assert.ok(content.financiamientoDefault.includes('proyecto piloto'));
});

test('pickFinancing: precedencia publico > ev > muyalto', () => {
  assert.ok(pickFinancing({ ...fx, sector: 'publico' }, content).startsWith('Para entidades públicas'));
  assert.ok(pickFinancing({ ...fx, sector: 'ev' }, content).startsWith('Nuestros proyectos pueden estructurarse sin inversión inicial'));
  assert.ok(pickFinancing({ ...fx, sector: 'manufactura', factura: 'muyalto' }, content).startsWith('A tu escala'));
});

test('pickFinancing: todas las variantes del Bloque E arrancan apropiadas por Mexillum o por escala (Cambio 3)', () => {
  const arranques = /^(Nuestros proyectos|Para entidades públicas|A tu escala)/;
  const todos = [...content.financiamiento.map((r) => r.text), content.financiamientoDefault];
  for (const t of todos) assert.match(t, arranques, `arranque impersonal: ${t}`);
});

test('pickFinancing: nunca usa lenguaje de promesa prohibido', () => {
  const prohibido = /cero riesgo|el ahorro empieza el primer mes/i;
  const todos = [...content.financiamiento.map((r) => r.text), content.financiamientoDefault];
  for (const t of todos) assert.ok(!prohibido.test(t), `promesa prohibida: ${t}`);
});

// ---- CHECKLIST ----

test('buildChecklist: fixture → CFE + carga + paros + viabilidad(privado) + universal', () => {
  const { web, full } = buildChecklist(fx, content);
  assert.deepEqual(web, [
    content.checklistBase[0],
    content.checklistBase[1],
    content.checklistRefuerzos.paros,
    content.checklistViabilidad.privado,
    content.checklistUniversal
  ]);
  assert.deepEqual(full, web); // 3 técnicos + viabilidad + universal, sin recorte
});

test('buildChecklist: recorta viabilidad de la web cuando ya hay 4 técnicos', () => {
  // diesel + paros + horario + contrato + techo = 5 técnicos (con base son 7)
  const r = { sector: 'continuo', generacion: 'estacional', tarifa: 'privado', corte: 'reinicio', disparador: 'diesel', factura: 'alto' };
  const { web, full } = buildChecklist(r, content);
  assert.equal(web.length, 5); // 4 técnicos + universal (viabilidad recortada)
  assert.equal(web[web.length - 1], content.checklistUniversal);
  assert.ok(!web.includes(content.checklistViabilidad.privado));
  assert.ok(full.includes(content.checklistViabilidad.privado)); // full la conserva
  assert.equal(full[full.length - 1], content.checklistUniversal);
});

test('buildChecklist: sin viabilidad cuando factura=muyalto', () => {
  const r = { sector: 'manufactura', generacion: 'no', tarifa: 'gdmth', corte: 'nada', disparador: 'costo', factura: 'muyalto' };
  const { full } = buildChecklist(r, content);
  assert.ok(!full.includes(content.checklistViabilidad.privado));
  assert.ok(!full.includes(content.checklistViabilidad.publico));
  assert.equal(full[full.length - 1], content.checklistUniversal);
});

test('buildChecklist: viabilidad publico para sector publico', () => {
  const r = { sector: 'publico', generacion: 'no', tarifa: 'gdmth', corte: 'nada', disparador: 'costo', factura: 'alto' };
  assert.ok(buildChecklist(r, content).full.includes(content.checklistViabilidad.publico));
});

// ---- LIMITACIONES ----

test('detectLimitations: factura nolose marca la limitación económica', () => {
  const resp = { ...fx, factura: 'nolose' };
  const lim = detectLimitations(resp, scoreOpportunities(resp, content), content);
  assert.ok(lim.some((l) => /factura/i.test(l.dato)));
  assert.ok(lim.every((l) => l.dato && l.porque && l.no_se_puede));
});

test('detectLimitations: sin datos faltantes → arreglo vacío', () => {
  const resp = { sector: 'manufactura', perfil: 'diurno', generacion: 'no', calidad: 'no', tarifa: 'gdmth', factura: 'alto', corte: 'reinicio', disparador: 'costo' };
  assert.deepEqual(detectLimitations(resp, scoreOpportunities(resp, content), content), []);
});

test('detectLimitations: tarifa privado usa la limitación de contrato, no la de tarifa', () => {
  const resp = { ...fx, tarifa: 'privado' };
  const lim = detectLimitations(resp, scoreOpportunities(resp, content), content);
  assert.ok(lim.some((l) => /contrato/i.test(l.dato)));
});

test('detectLimitations + buildChecklist: "Solar primero" agrega techo/terreno sin duplicar (mejora #4)', () => {
  const resp = { ...fx, perfil: 'diurno', generacion: 'no', tarifa: 'nolose', factura: 'nolose' };
  const scores = scoreOpportunities(resp, content);
  const rec = recommendSolution(resp, scores, content);
  assert.equal(rec.tipo, 'Solar fotovoltaico on-grid');
  assert.ok(scores.bess_solar < content.scoring.umbralFuerte, 'bess_solar no llega al umbral fuerte');
  const lim = detectLimitations(resp, scores, content, rec);
  assert.equal(lim.filter((l) => l === content.limitaciones.techo).length, 1);
  // sin recomendación, el techo no aparece (compatibilidad hacia atrás)
  assert.ok(!detectLimitations(resp, scores, content).includes(content.limitaciones.techo));
  const { full } = buildChecklist(resp, content, rec);
  assert.equal(full.filter((b) => b === content.checklistRefuerzos.techo).length, 1);
});

test('buildChecklist: evaluando + "Solar primero" no duplica el refuerzo de techo', () => {
  const resp = { ...fx, perfil: 'diurno', generacion: 'evaluando', tarifa: 'nolose', factura: 'nolose' };
  const scores = scoreOpportunities(resp, content);
  const rec = recommendSolution(resp, scores, content);
  assert.equal(rec.tipo, 'Solar fotovoltaico on-grid');
  const { full } = buildChecklist(resp, content, rec);
  assert.equal(full.filter((b) => b === content.checklistRefuerzos.techo).length, 1);
  const lim = detectLimitations(resp, scores, content, rec);
  assert.equal(lim.filter((l) => l === content.limitaciones.techo).length, 1);
});

// ---- ASSEMBLER + NOTA DEL EVENTO ----

const estadoFx = {
  respuestas: { ...fx },
  contacto: { nombre: 'Ana', empresa: 'Acme', correo: 'ana@acme.mx', telefono: '5555', rol: 'Finanzas' }
};

test('assembleResult: fixture end-to-end (spec §5, salida estructurada)', () => {
  const res = assembleResult(estadoFx, content);
  assert.equal(res.perfil, 'Perfil: manufactura con exposición a cargo por demanda.');
  // Motor v3: fx (diurno, sin generación, foco en costo) hace liderar solar_puro, cuya
  // aplicación no es peak_shaving → bloque B sin rango numérico, con copy de solar.
  assert.equal(res.ranking[0].id, 'solar_puro');
  assert.equal(res.calculo.sin_numero, true);
  assert.equal(res.calculo.rango_texto, null);
  assert.equal(res.calculo.cadena, content.bloqueB.sinRangoPorAplicacion.solar_puro);
  assert.equal(res.gancho, null); // Cambio 2: factura/tarifa conocidas → sin gancho
  assert.equal(res.palancas.principal.nombre, content.palancasCopy[res.ranking[0].id].nombre);
  assert.equal(res.palancas.secundaria.nombre, content.palancasCopy[res.ranking[1].id].nombre);
  assert.equal(res.palancas.descarte.nombre, content.palancasCopy[res.ranking[res.ranking.length - 1].id].nombre);
  assert.equal(res.dato_faltante, content.datoFaltantePorOportunidad.bess_solar); // recomendación solar → dato de techo/excedente
  assert.equal(res.cierre_llamada, content.cierreComun);
  assert.ok(res.financiamiento.startsWith('Nuestros proyectos pueden estructurarse de dos formas'));
  assert.equal(res.checklist.web[res.checklist.web.length - 1], content.checklistUniversal);
});

// Fixture del parche §Verificación: frío/diurno/no/gdmth/alto/reinicio/costo.
// Antes del parche: dos palancas (sin descarte) y frase-gancho redundante.
// Tras el parche: tres palancas (con descarte default) y gancho null.
test('assembleResult: fixture del parche → descarte presente y gancho null', () => {
  const estado = {
    respuestas: { sector: 'frio', perfil: 'diurno', generacion: 'no', tarifa: 'gdmth', factura: 'alto', corte: 'reinicio', disparador: 'costo' },
    contacto: {}
  };
  const res = assembleResult(estado, content);
  assert.equal(res.perfil, 'Perfil: frío y logística con exposición a cargo por demanda.');
  // Motor v3: perfil diurno + costo → lidera solar_puro → bloque B sin rango numérico.
  assert.equal(res.ranking[0].id, 'solar_puro');
  assert.equal(res.calculo.rango_texto, null);
  assert.equal(res.gancho, null); // Cambio 2: gancho depende solo de factura==='nolose' || tarifa==='privado'; aquí ninguna aplica
  assert.equal(res.palancas.principal.nombre, content.palancasCopy[res.ranking[0].id].nombre);
  assert.equal(res.palancas.secundaria.nombre, content.palancasCopy[res.ranking[1].id].nombre);
  assert.ok(res.palancas.descarte, 'descarte debe estar presente'); // Cambio 1
  assert.equal(res.palancas.descarte.nombre, content.palancasCopy[res.ranking[res.ranking.length - 1].id].nombre);
  assert.equal(res.dato_faltante, content.datoFaltantePorOportunidad.bess_solar); // recomendación solar → dato de techo/excedente
  assert.ok(res.financiamiento.startsWith('Nuestros proyectos pueden estructurarse de dos formas'));
});

test('assembleResult: limitaciones vacías cuando hay datos completos', () => {
  // Perfil picos: lidera peak_shaving (no solar), así no se agrega la limitación de techo;
  // con factura y tarifa conocidas, no queda ningún dato faltante.
  const estado = { respuestas: { sector: 'manufactura', perfil: 'picos', generacion: 'no', calidad: 'no', tarifa: 'gdmth', factura: 'alto', corte: 'reinicio', disparador: 'costo' }, contacto: {} };
  assert.deepEqual(assembleResult(estado, content).limitaciones, []);
});

test('assembleResult: leadPayload expone las keys que consume /api/lead', () => {
  const p = assembleResult(estadoFx, content).leadPayload;
  const esperadas = ['lead_id', 'timestamp', 'nombre', 'empresa', 'correo', 'telefono', 'rol',
    'respuestas_legibles', 'respuestas_codigos', 'perfil', 'rango_texto', 'checklist_full'];
  for (const k of esperadas) assert.ok(k in p, `falta ${k}`);
  assert.equal(p.nombre, 'Ana');
  assert.equal(p.rol, 'Finanzas');
  // fx lidera solar_puro → sin rango numérico; el payload lleva el mensaje legible.
  assert.equal(p.rango_texto, 'Aplicación prioritaria sin datos suficientes para un rango');
  assert.equal(p.respuestas_legibles.sector, 'Manufactura por turnos o por lotes');
  for (const paso of content.pasos) {
    assert.equal(typeof p.respuestas_legibles[paso.key], 'string', `falta legible ${paso.key}`);
  }
  assert.ok(Array.isArray(p.checklist_full));
  assert.ok(JSON.stringify(p).length < 8000, 'payload demasiado grande');
});

test('leadPayload.rango_texto: mensajes sin número para privado y nolose', () => {
  const priv = assembleResult({ respuestas: { ...fx, tarifa: 'privado' }, contacto: {} }, content).leadPayload;
  assert.match(priv.rango_texto, /privado/i);
  const nol = assembleResult({ respuestas: { ...fx, factura: 'nolose' }, contacto: {} }, content).leadPayload;
  assert.match(nol.rango_texto, /sin/i);
});

test('buildEventNote: incluye perfil, checklist completo y las 8 respuestas', () => {
  const res = assembleResult(estadoFx, content);
  const note = res.note;
  assert.ok(note.includes(res.perfil));
  assert.ok(note.includes(content.checklistUniversal));
  assert.ok(note.includes(content.checklistViabilidad.privado)); // full, sin recorte
  // 8 respuestas crudas (una por notaLabel)
  for (const paso of content.pasos) assert.ok(note.includes(paso.notaLabel), `falta ${paso.notaLabel} en la nota`);
});

test('buildEventNote: incluye "qué preparar" (voz lead) del anteproyecto', () => {
  const res = assembleResult(estadoFx, content);
  assert.ok(res.note.includes(content.anteproyectoTituloLead), 'falta el título lead del anteproyecto');
  for (const item of res.anteproyecto.lead) assert.ok(res.note.includes(item), `falta item lead: ${item}`);
});

// ---- SCORING de oportunidades ----

test('scoreOpportunities: diésel es prácticamente binario en disparador=diesel', () => {
  const conDiesel = scoreOpportunities({ ...fx, disparador: 'diesel', corte: 'reinicio', calidad: 'no' }, content);
  const sinDiesel = scoreOpportunities({ ...fx, disparador: 'costo' }, content);
  assert.ok(conDiesel.diesel >= 72);
  assert.equal(sinDiesel.diesel, 0);
});

test('scoreOpportunities: perfil punta favorece arbitraje sobre peak shaving', () => {
  const s = scoreOpportunities({ ...fx, perfil: 'punta', tarifa: 'gdmth' }, content);
  assert.ok(s.arbitraje > s.peak_shaving);
  assert.ok(s.arbitraje <= 100 && s.peak_shaving >= 0);
});

test('scoreOpportunities: perfil picos favorece peak shaving', () => {
  const s = scoreOpportunities({ ...fx, perfil: 'picos', tarifa: 'gdmth', factura: 'alto' }, content);
  assert.ok(s.peak_shaving >= 80);
});

test('scoreOpportunities: todo score queda en [0,100]', () => {
  const s = scoreOpportunities({ sector: 'ev', perfil: 'picos', generacion: 'estacional', calidad: 'cortes', tarifa: 'gdmth', factura: 'muyalto', corte: 'producto', disparador: 'capacidad' }, content);
  for (const v of Object.values(s)) assert.ok(v >= 0 && v <= 100, `fuera de rango: ${v}`);
});

test('rankOpportunities: devuelve 8 ordenadas desc con nombre', () => {
  const r = rankOpportunities(scoreOpportunities(fx, content), content);
  assert.equal(r.length, 8);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score);
  assert.ok(typeof r[0].nombre === 'string');
});

test('potencialGeneral: tope Medio cuando faltan factura y tarifa', () => {
  const resp = { ...fx, factura: 'nolose', tarifa: 'nolose', corte: 'producto', calidad: 'cortes' };
  const scores = scoreOpportunities(resp, content);
  assert.equal(potencialGeneral(scores, resp, content), 'Medio');
});

test('potencialGeneral: Muy Alto con score líder >=75', () => {
  // Muy Alto (motor v3) exige 2+ palancas fuertes además de factura grande y tarifa
  // cuantificable: picos+GDMTH dispara peak_shaving y corte producto+cortes dispara respaldo.
  const resp = { sector: 'frio', perfil: 'picos', generacion: 'no', calidad: 'cortes', tarifa: 'gdmth', factura: 'muyalto', corte: 'producto', disparador: 'costo' };
  const scores = scoreOpportunities(resp, content);
  assert.equal(potencialGeneral(scores, resp, content), 'Muy Alto');
});

test('assembleResult: expone scores, ranking y potencial_general', () => {
  const res = assembleResult(estadoFx, content);
  assert.equal(typeof res.scores.peak_shaving, 'number');
  assert.equal(res.ranking.length, 8);
  assert.ok(['Muy Alto', 'Alto', 'Medio', 'Bajo'].includes(res.potencial_general));
  assert.equal(res.leadPayload.potencial_general, res.potencial_general);
});

// ---- RECOMENDACIÓN de solución (BESS vs Solar) ----

test('recommendSolution: solar en sitio + excedente → BESS sobre solar existente con razón de excedentes (mejora #1)', () => {
  const con = { ...fx, generacion: 'solar_sitio', disparador: ['excedente'] };
  const rec = recommendSolution(con, scoreOpportunities(con, content), content);
  assert.equal(rec.tipo, 'BESS sobre solar existente');
  assert.match(rec.razon, /excedente/i);
  assert.match(rec.razon, /no es sumar más paneles/i); // aclara que no se recomienda más solar
});

test('recommendSolution: solar en sitio sin excedente → BESS sobre solar existente, copy no contradictorio', () => {
  const sin = { ...fx, generacion: 'solar_sitio', disparador: 'costo' };
  const rec = recommendSolution(sin, scoreOpportunities(sin, content), content);
  assert.equal(rec.tipo, 'BESS sobre solar existente');
  assert.ok(!/no recomendar/i.test(rec.tipo));
  assert.match(rec.razon, /no es tu cuello de botella/i);
});

test('recommendSolution: contrato renovable se trata como sin generación detrás del medidor (mejora #3)', () => {
  // diurno + contrato + tarifa ciega → Solar primero (elegible para solar nueva)
  const resp = { ...fx, generacion: 'contrato', perfil: 'diurno', tarifa: 'nolose', factura: 'nolose' };
  assert.equal(recommendSolution(resp, scoreOpportunities(resp, content), content).tipo, 'Solar fotovoltaico on-grid');
});

test('recommendSolution: estacional → BESS + Solar', () => {
  const resp = { ...fx, generacion: 'estacional' };
  assert.equal(recommendSolution(resp, scoreOpportunities(resp, content), content).tipo, 'BESS + Solar');
});

test('recommendSolution: consumo diurno sin generación NO fuerza BESS + Solar (mejora #2)', () => {
  // El cap de bess_solar por falta de señal solar evita BESS + Solar; con perfil diurno,
  // sin generación y foco en costo, lidera solar_puro → Solar fotovoltaico on-grid (no BESS + Solar).
  const resp = { ...fx, generacion: 'no', perfil: 'diurno' };
  assert.equal(recommendSolution(resp, scoreOpportunities(resp, content), content).tipo, 'Solar fotovoltaico on-grid');
});

test('recommendSolution: solar en evaluación + diurno → Solar fotovoltaico on-grid', () => {
  // Motor v3: solar_puro lidera el ranking (diurno) y "evaluando" cuenta como sin generación
  // detrás del medidor, así que la recomendación es solar nueva antes que la combinación con BESS.
  const resp = { ...fx, generacion: 'evaluando', perfil: 'diurno', disparador: ['excedente'] };
  assert.equal(recommendSolution(resp, scoreOpportunities(resp, content), content).tipo, 'Solar fotovoltaico on-grid');
});

test('recommendSolution: diurno sin generación y tarifa desconocida → Solar fotovoltaico on-grid', () => {
  const resp = { ...fx, generacion: 'no', perfil: 'diurno', tarifa: 'nolose', factura: 'nolose' };
  assert.equal(recommendSolution(resp, scoreOpportunities(resp, content), content).tipo, 'Solar fotovoltaico on-grid');
});

test('recommendSolution: perfil y recibo desconocidos, sin generación → Solar fotovoltaico on-grid', () => {
  // Motor v3: solar_puro puntúa alto incluso con perfil/recibo desconocidos (sin generación,
  // foco en costo), así que encabeza el ranking y la recomendación es solar nueva.
  const ciego = { ...fx, perfil: 'nolose', generacion: 'no', tarifa: 'nolose', factura: 'nolose' };
  const rec = recommendSolution(ciego, scoreOpportunities(ciego, content), content);
  assert.equal(rec.tipo, 'Solar fotovoltaico on-grid');
  assert.equal(rec.razon, content.recomendaciones.solarPrimero.razon);
  // con recibo y tarifa a la mano el resultado se mantiene solar (solar_puro sigue liderando)
  const conDatos = { ...fx, perfil: 'nolose', generacion: 'no', tarifa: 'gdmth', factura: 'alto' };
  assert.equal(recommendSolution(conDatos, scoreOpportunities(conDatos, content), content).razon,
    content.recomendaciones.solarPrimero.razon);
});

test('recommendSolution: default → BESS', () => {
  const resp = { ...fx, generacion: 'no', perfil: 'plano', tarifa: 'gdmth' };
  assert.equal(recommendSolution(resp, scoreOpportunities(resp, content), content).tipo, 'BESS');
});

test('assembleResult: expone recomendacion_solucion con tipo válido', () => {
  const res = assembleResult(estadoFx, content);
  assert.ok(Object.values(content.recomendaciones).some((r) => r.tipo === res.recomendacion_solucion.tipo));
  assert.equal(typeof res.recomendacion_solucion.razon, 'string');
});

// ---- APLICACIÓN principal (subtipo comercial) ----

test('primaryApplication: caso normal usa el top del ranking', () => {
  const scores = scoreOpportunities(fx, content);
  const ranking = rankOpportunities(scores, content);
  const ap = primaryApplication(fx, ranking, scores, content);
  assert.equal(ap.id, ranking[0].id);
  assert.equal(ap.nombre, ranking[0].nombre);
});

test('primaryApplication: disparador diesel tiene precedencia sobre el ranking', () => {
  const resp = { ...fx, perfil: 'picos', disparador: ['diesel'] };
  const scores = scoreOpportunities(resp, content);
  const ranking = rankOpportunities(scores, content);
  assert.notEqual(ranking[0].id, 'diesel'); // peak shaving domina el ranking
  assert.equal(primaryApplication(resp, ranking, scores, content).id, 'diesel');
});

test('primaryApplication: capacidad prioriza diferimiento cuando su score es fuerte', () => {
  const resp = { ...fx, perfil: 'picos', disparador: ['capacidad'] };
  const scores = scoreOpportunities(resp, content);
  const ranking = rankOpportunities(scores, content);
  assert.ok(scores.diferimiento >= content.scoring.umbralFuerte);
  assert.equal(primaryApplication(resp, ranking, scores, content).id, 'diferimiento');
});

test('primaryApplication: respaldo fuerte con corte costoso gana aunque no sea el top', () => {
  // Perfil plano evita que solar_puro domine; arbitraje lidera pero respaldo (fuerte y dentro
  // del margen) lo desplaza como aplicación principal.
  const resp = { ...fx, perfil: 'plano', corte: 'producto', calidad: 'cortes' };
  const scores = scoreOpportunities(resp, content);
  const ranking = rankOpportunities(scores, content);
  assert.ok(scores.respaldo >= content.scoring.umbralFuerte);
  assert.notEqual(ranking[0].id, 'respaldo');
  assert.equal(primaryApplication(resp, ranking, scores, content).id, 'respaldo');
});

test('primaryApplication: respaldo NO desplaza al líder cuando queda muy por debajo (margenTop)', () => {
  // corte=servicio + calidad=cortes deja respaldo justo en el umbral fuerte (60),
  // pero picos+GDMTH dispara peak shaving muy por encima: manda el caso económico.
  const resp = { ...fx, perfil: 'picos', corte: 'servicio', calidad: 'cortes' };
  const scores = scoreOpportunities(resp, content);
  const ranking = rankOpportunities(scores, content);
  assert.ok(scores.respaldo >= content.scoring.umbralFuerte, 'respaldo es fuerte');
  assert.ok(ranking[0].score - scores.respaldo > 20, 'el líder le saca más del margen');
  assert.equal(primaryApplication(resp, ranking, scores, content).id, ranking[0].id);
});

test('primaryApplication: la precedencia se lee de content (regla nueva sin tocar el motor)', () => {
  const regla = { id: 'arbitraje', when: { tarifa: 'gdmth' } };
  const c2 = { ...content, scoring: { ...content.scoring, aplicacionPrincipal: [regla] } };
  const scores = scoreOpportunities(fx, content);
  const ranking = rankOpportunities(scores, content);
  assert.notEqual(ranking[0].id, 'arbitraje');
  assert.equal(primaryApplication(fx, ranking, scores, c2).id, 'arbitraje');
  // sin reglas declaradas, manda el top del ranking
  const c3 = { ...content, scoring: { ...content.scoring, aplicacionPrincipal: [] } };
  assert.equal(primaryApplication(fx, ranking, scores, c3).id, ranking[0].id);
});

test('primaryApplication: marca preliminar cuando el líder no llega al umbral de potencial medio', () => {
  // Motor v3: el líder queda bajo el umbral medio solo cuando ya hay solar en sitio (que
  // anula solar_puro) y el resto de señales es débil; ahí la aplicación no se puede fijar.
  const ciego = { sector: 'continuo', perfil: 'plano', generacion: 'solar_sitio', calidad: 'factor',
    tarifa: 'gdmto', factura: 'bajo', corte: 'nada', disparador: ['costo'] };
  const scores = scoreOpportunities(ciego, content);
  const ranking = rankOpportunities(scores, content);
  const ap = primaryApplication(ciego, ranking, scores, content);
  assert.ok(ranking[0].score < content.scoring.umbralPotencial.medio);
  assert.equal(ap.preliminar, true);
  // caso con datos: la aplicación se afirma sin matiz
  const firme = primaryApplication(fx, rankOpportunities(scoreOpportunities(fx, content), content),
    scoreOpportunities(fx, content), content);
  assert.equal(firme.preliminar, false);
});

test('buildEventNote: la aplicación preliminar se marca como tal en la nota', () => {
  const ciego = { sector: 'continuo', perfil: 'plano', generacion: 'solar_sitio', calidad: 'factor',
    tarifa: 'gdmto', factura: 'bajo', corte: 'nada', disparador: ['costo'] };
  const res = assembleResult({ respuestas: ciego, contacto: {} }, content);
  assert.equal(res.aplicacion_principal.preliminar, true);
  assert.ok(res.note.includes(`Aplicación principal: ${res.aplicacion_principal.nombre} (preliminar)`));
  // el caso con datos no arrastra el matiz
  assert.ok(!assembleResult(estadoFx, content).note.includes('(preliminar)'));
});

test('assembleResult: expone aplicacion_principal en el resultado, el payload y la nota', () => {
  const res = assembleResult(estadoFx, content);
  assert.ok(res.aplicacion_principal.id && res.aplicacion_principal.nombre);
  assert.equal(res.aplicacion_principal.id, res.ranking[0].id); // fx sin señales críticas fuertes
  assert.deepEqual(res.leadPayload.aplicacion_principal, res.aplicacion_principal);
  assert.ok(res.note.includes(`Aplicación principal: ${res.aplicacion_principal.nombre}`));
});

test('buildEventNote: incluye potencial, ranking y recomendación', () => {
  const res = assembleResult(estadoFx, content);
  assert.ok(res.note.includes('Potencial general'));
  assert.ok(res.note.includes(res.potencial_general));
  assert.ok(res.note.includes(res.recomendacion_solucion.tipo));
  assert.ok(res.note.includes(res.ranking[0].nombre));
});

// ---- v2.2: disparador multi-select (array de señales) ----

test('asList / hasSignal: aceptan array y string legado', () => {
  assert.deepEqual(asList(['diesel', 'capacidad']), ['diesel', 'capacidad']);
  assert.deepEqual(asList('diesel'), ['diesel']);
  assert.deepEqual(asList(undefined), []);
  assert.deepEqual(asList(''), []);
  assert.equal(hasSignal(['diesel', 'capacidad'], 'capacidad'), true);
  assert.equal(hasSignal(['costo'], 'diesel'), false);
  assert.equal(hasSignal('diesel', 'diesel'), true); // compat string
});

test('matchesWhen: campo array cumple por inclusión', () => {
  assert.equal(matchesWhen({ disparador: ['diesel', 'capacidad'] }, { disparador: 'capacidad' }), true);
  assert.equal(matchesWhen({ disparador: ['costo'] }, { disparador: 'diesel' }), false);
  assert.equal(matchesWhen({ disparador: 'diesel' }, { disparador: 'diesel' }), true); // compat string
});

test('scoreOpportunities: array suma cada señal y respeta la precedencia diesel>capacidad>excedente', () => {
  const base = { sector: 'manufactura', perfil: 'diurno', generacion: 'no', calidad: 'no', tarifa: 'gdmth', factura: 'medio', corte: 'nada' };
  const s = scoreOpportunities({ ...base, disparador: ['diesel', 'capacidad'] }, content);
  assert.equal(s.diesel, 72);        // señal diesel
  assert.equal(s.diferimiento, 62);  // señal capacidad
  assert.ok(s.diesel > s.diferimiento, 'diesel gana entre las palancas de disparador');
  // excedente alimenta arbitraje y bess_solar, no diesel/diferimiento
  const soloExc = scoreOpportunities({ ...base, disparador: ['excedente'] }, content);
  assert.equal(soloExc.diesel, 0);
  assert.equal(soloExc.diferimiento, 0);
  const conExc = scoreOpportunities({ ...base, disparador: ['costo'] }, content);
  assert.ok(soloExc.bess_solar > conExc.bess_solar, 'excedente sube bess_solar');
});

test('renderBlockB / detectLimitations / buildChecklist: reconocen diesel dentro del array', () => {
  const r = { sector: 'frio', perfil: 'diurno', generacion: 'no', calidad: 'no', tarifa: 'gdmth', factura: 'alto', corte: 'nada', disparador: ['diesel', 'capacidad'] };
  assert.equal(renderBlockB(r, content).notas.length, 1); // nota de diésel
  assert.ok(detectLimitations(r, scoreOpportunities(r, content), content).some((l) => /diésel/i.test(l.dato)));
  assert.ok(buildChecklist(r, content).full.includes(content.checklistRefuerzos.diesel));
});

test('recommendSolution: diésel gana sobre excedente dentro de un array multi-señal', () => {
  const resp = { ...fx, generacion: 'solar_sitio', disparador: ['excedente', 'diesel'] };
  const rec = recommendSolution(resp, scoreOpportunities(resp, content), content);
  assert.equal(rec.tipo, 'BESS sobre solar existente');
  assert.equal(rec.razon, content.recomendaciones.bessDieselSolar.razon);
});

test('toReadable: array une labels; vacío → "Ninguna"', () => {
  const leg = toReadable({ ...fx, disparador: ['diesel', 'capacidad'] }, content);
  assert.ok(leg.disparador.includes('diésel'));
  assert.ok(leg.disparador.includes('crecer'));
  assert.ok(leg.disparador.includes(';'));
  assert.equal(toReadable({ ...fx, disparador: [] }, content).disparador, 'Ninguna, nuestro tema es puramente reducir el costo de la energía');
});

// Fixture Caso A del parche (adaptado a esquema v3): dos señales, sin corte.
test('parche Caso A: ["diesel","capacidad"] → nota diésel, diesel>diferimiento, secundaria presente', () => {
  const estado = {
    respuestas: { sector: 'manufactura', perfil: 'diurno', generacion: 'no', calidad: 'no', tarifa: 'gdmth', factura: 'medio', corte: 'nada', disparador: ['diesel', 'capacidad'] },
    contacto: {}
  };
  const res = assembleResult(estado, content);
  assert.equal(res.scores.diesel, 72);
  assert.equal(res.scores.diferimiento, 62);
  assert.ok(res.calculo.notas.length >= 1); // nota de diésel presente
  assert.ok(res.palancas.secundaria, 'secundaria presente (2a del ranking sobre umbral)');
  assert.ok(res.leadPayload.respuestas_codigos.disparador.length === 2, 'CRM conserva el array completo');
});

// Fixture Caso C del parche: solo "Ninguna" (["costo"]) == string legado 'costo'.
test('parche Caso C: ["costo"] equivale al string legado "costo"', () => {
  const arr = assembleResult({ respuestas: { ...fx, disparador: ['costo'] }, contacto: {} }, content);
  const str = assembleResult({ respuestas: { ...fx, disparador: 'costo' }, contacto: {} }, content);
  assert.equal(arr.perfil, str.perfil);
  assert.deepEqual(arr.scores, str.scores);
  assert.equal(arr.palancas.principal.nombre, str.palancas.principal.nombre);
  assert.equal(arr.calculo.rango_texto, str.calculo.rango_texto);
});

// ---- Mejora #4: boosts y caps declarativos ----

test('boosts: picos+GDMTH suma exactamente 8 a peak shaving', () => {
  // dist y gdmth pesan igual (25) en peak_shaving, pero el boost solo aplica con gdmth.
  const base = { sector: 'manufactura', perfil: 'picos', generacion: 'no', calidad: 'no', factura: 'bajo', corte: 'nada', disparador: 'costo' };
  const conBoost = scoreOpportunities({ ...base, tarifa: 'gdmth' }, content).peak_shaving;
  const sinBoost = scoreOpportunities({ ...base, tarifa: 'dist' }, content).peak_shaving;
  assert.equal(conBoost - sinBoost, 8);
  assert.ok(content.scoring.boosts.some((b) => b.id === 'arbitraje')); // boost de arbitraje declarado
});

test('caps: bess_solar se limita sin señal de solar; no se limita con solar/estacional/evaluando', () => {
  const base = { sector: 'frio', perfil: 'diurno', calidad: 'no', tarifa: 'gdmth', factura: 'alto', corte: 'nada', disparador: 'costo' };
  const noGen = scoreOpportunities({ ...base, generacion: 'no' }, content).bess_solar;
  const evalu = scoreOpportunities({ ...base, generacion: 'evaluando' }, content).bess_solar;
  assert.ok(noGen <= 45, `bess_solar sin solar debe estar capado a 45, fue ${noGen}`);
  assert.ok(evalu > 45, `bess_solar con evaluación no se capa, fue ${evalu}`);
});

test('caps: arbitraje se limita con tarifa desconocida', () => {
  const base = { sector: 'continuo', perfil: 'punta', generacion: 'no', calidad: 'no', factura: 'alto', corte: 'nada', disparador: 'costo' };
  const ciega = scoreOpportunities({ ...base, tarifa: 'nolose' }, content).arbitraje;
  const conocida = scoreOpportunities({ ...base, tarifa: 'gdmth' }, content).arbitraje;
  assert.ok(ciega <= 40, `arbitraje con tarifa desconocida capado a 40, fue ${ciega}`);
  assert.ok(conocida > 40, `arbitraje con tarifa conocida no se capa, fue ${conocida}`);
});

// ---- Mejora #6: reglas declarativas (matchesRule, anyOf/allOf/arrays, unless) ----

test('matchesRule: when mantiene la semántica actual; anyOf/allOf y valores array', () => {
  const resp = { perfil: 'plano', tarifa: 'gdmth', disparador: ['diesel', 'capacidad'] };
  assert.equal(matchesRule(resp, { when: { tarifa: 'gdmth' } }), true);
  assert.equal(matchesRule(resp, { when: { tarifa: 'dist' } }), false);
  assert.equal(matchesRule(resp, { when: { disparador: 'diesel' } }), true); // campo array por inclusión
  assert.equal(matchesRule(resp, { anyOf: [{ perfil: 'punta' }, { perfil: 'plano' }] }), true);
  assert.equal(matchesRule(resp, { anyOf: [{ perfil: 'punta' }, { perfil: 'diurno' }] }), false);
  assert.equal(matchesRule(resp, { allOf: [{ perfil: 'plano' }, { tarifa: 'gdmth' }] }), true);
  assert.equal(matchesRule(resp, { allOf: [{ perfil: 'plano' }, { tarifa: 'dist' }] }), false);
  assert.equal(matchesRule(resp, { when: { perfil: ['punta', 'plano'] } }), true); // valor array
  // anyOf + when se combinan con AND (ejemplo del spec)
  const regla = { anyOf: [{ perfil: 'punta' }, { perfil: 'plano' }], when: { tarifa: 'gdmth' } };
  assert.equal(matchesRule(resp, regla), true);
  assert.equal(matchesRule({ ...resp, tarifa: 'gdmto' }, regla), false);
});

test('boosts: una regla con anyOf aplica correctamente', () => {
  const boost = { id: 'arbitraje', anyOf: [{ perfil: 'punta' }, { perfil: 'plano' }], when: { tarifa: 'gdmth' }, pts: 6 };
  const c2 = { ...content, scoring: { ...content.scoring, boosts: [...content.scoring.boosts, boost] } };
  const base = { sector: 'manufactura', generacion: 'no', calidad: 'no', factura: 'bajo', corte: 'nada', disparador: 'costo', tarifa: 'gdmth' };
  const plano = { ...base, perfil: 'plano' };
  assert.equal(scoreOpportunities(plano, c2).arbitraje - scoreOpportunities(plano, content).arbitraje, 6);
  const diurno = { ...base, perfil: 'diurno' };
  assert.equal(scoreOpportunities(diurno, c2).arbitraje, scoreOpportunities(diurno, content).arbitraje);
});

test('boosts: una regla con valor array en when aplica correctamente', () => {
  const boost = { id: 'peak_shaving', when: { perfil: ['picos', 'diurno'] }, pts: 5 };
  const c2 = { ...content, scoring: { ...content.scoring, boosts: [...content.scoring.boosts, boost] } };
  const base = { sector: 'manufactura', generacion: 'no', calidad: 'no', factura: 'bajo', corte: 'nada', disparador: 'costo', tarifa: 'dist' };
  assert.equal(scoreOpportunities({ ...base, perfil: 'diurno' }, c2).peak_shaving
    - scoreOpportunities({ ...base, perfil: 'diurno' }, content).peak_shaving, 5);
  assert.equal(scoreOpportunities({ ...base, perfil: 'plano' }, c2).peak_shaving,
    scoreOpportunities({ ...base, perfil: 'plano' }, content).peak_shaving);
});

test('caps: unless acepta una regla completa (anyOf), no solo una condición plana', () => {
  const cap = { id: 'arbitraje', max: 10, unless: { anyOf: [{ perfil: 'punta' }, { perfil: 'plano' }] } };
  const c2 = { ...content, scoring: { ...content.scoring, caps: [...content.scoring.caps, cap] } };
  const base = { sector: 'continuo', generacion: 'no', calidad: 'no', tarifa: 'gdmth', factura: 'alto', corte: 'nada', disparador: 'costo' };
  assert.equal(scoreOpportunities({ ...base, perfil: 'diurno' }, c2).arbitraje, 10);
  assert.ok(scoreOpportunities({ ...base, perfil: 'punta' }, c2).arbitraje > 10);
  assert.ok(scoreOpportunities({ ...base, perfil: 'plano' }, c2).arbitraje > 10);
});

test('caps: unless exime el cap cuando la condición se cumple', () => {
  const cap = { id: 'peak_shaving', max: 12, unless: { tarifa: ['gdmth', 'dist'] } };
  const c2 = { ...content, scoring: { ...content.scoring, caps: [...content.scoring.caps, cap] } };
  const base = { sector: 'manufactura', perfil: 'picos', generacion: 'no', calidad: 'no', factura: 'alto', corte: 'nada', disparador: 'costo' };
  // gdbt sí factura demanda (no lo capa la regla base) pero no está en unless → aplica el cap de prueba.
  const capado = scoreOpportunities({ ...base, tarifa: 'gdbt' }, c2).peak_shaving;
  assert.equal(capado, 12);
  const exento = scoreOpportunities({ ...base, tarifa: 'gdmth' }, c2).peak_shaving;
  assert.ok(exento > 12, `con gdmth el cap no aplica, fue ${exento}`);
});

// ---- Mejora #3: separación solar en sitio / contrato renovable ----

test('generacion split: solar_sitio agrega refuerzo de solar al checklist; contrato agrega contrato', () => {
  const solar = buildChecklist({ ...fx, generacion: 'solar_sitio' }, content).full;
  assert.ok(solar.includes(content.checklistRefuerzos.solar));
  const contrato = buildChecklist({ ...fx, generacion: 'contrato', tarifa: 'gdmth' }, content).full;
  assert.ok(contrato.includes(content.checklistRefuerzos.contrato));
});

test('content: generacion tiene las 5 opciones separadas (mejora #3)', () => {
  const gen = content.pasos.find((p) => p.key === 'generacion');
  assert.deepEqual(gen.opciones.map((o) => o.codigo), ['solar_sitio', 'contrato', 'estacional', 'no', 'evaluando']);
});

// ---- Mejora #7: normalización de valores legacy ----

test('normalizeResponses: mapea generacion fisica → solar_sitio y disparador string → array', () => {
  const n = normalizeResponses({ ...fx, generacion: 'fisica', disparador: 'diesel' });
  assert.equal(n.generacion, 'solar_sitio');
  assert.deepEqual(n.disparador, ['diesel']);
  // valores vigentes pasan intactos
  const ok = normalizeResponses({ ...fx, generacion: 'evaluando', disparador: ['capacidad'] });
  assert.equal(ok.generacion, 'evaluando');
  assert.deepEqual(ok.disparador, ['capacidad']);
});

test('assembleResult: generacion legacy "fisica" se comporta como solar_sitio', () => {
  const legacy = assembleResult({ respuestas: { ...fx, generacion: 'fisica' }, contacto: {} }, content);
  const actual = assembleResult({ respuestas: { ...fx, generacion: 'solar_sitio' }, contacto: {} }, content);
  assert.deepEqual(legacy.scores, actual.scores);
  assert.equal(legacy.recomendacion_solucion.tipo, 'BESS sobre solar existente');
  // respuestas_codigos lleva el valor normalizado al CRM
  assert.equal(legacy.leadPayload.respuestas_codigos.generacion, 'solar_sitio');
  // toReadable encuentra el label nuevo (no cae al código crudo)
  assert.equal(legacy.leadPayload.respuestas_legibles.generacion,
    'Sí — tenemos solar en sitio (detrás del medidor)');
});

test('assembleResult: disparador string legado queda normalizado a array en el payload', () => {
  const p = assembleResult({ respuestas: { ...fx, disparador: 'diesel' }, contacto: {} }, content).leadPayload;
  assert.deepEqual(p.respuestas_codigos.disparador, ['diesel']);
  assert.ok(p.respuestas_legibles.disparador.includes('diésel'));
});

// ---- Mejora #1: el payload sigue exponiendo ranking/recomendación/limitaciones ----

test('leadPayload: conserva scores, ranking, potencial, recomendación y limitaciones', () => {
  const p = assembleResult(estadoFx, content).leadPayload;
  for (const k of ['scores', 'ranking', 'potencial_general', 'recomendacion_solucion', 'limitaciones']) {
    assert.ok(k in p, `falta ${k} en el payload`);
  }
  assert.ok(Array.isArray(p.ranking) && p.ranking.length === 8);
});

// ---- Paso 1: datos para el anteproyecto (dos voces, dinámico por familia) ----

const FAMILIAS = ['base', 'solar', 'bess', 'bess_solar', 'off_grid'];

test('recommendSolution: expone una familia de anteproyecto válida', () => {
  const scores = scoreOpportunities(fx, content);
  const ranking = rankOpportunities(scores, content);
  const ap = primaryApplication(fx, ranking, scores, content);
  const rec = recommendSolution(fx, scores, content, ap);
  assert.ok(FAMILIAS.includes(rec.familia), `familia inesperada: ${rec.familia}`);
});

test('buildAnteproyecto: solar suma datos solares sobre la base, en dos voces', () => {
  const a = buildAnteproyecto({ tipo: 'Solar fotovoltaico on-grid', familia: 'solar' }, content);
  assert.equal(a.familia, 'solar');
  assert.ok(Array.isArray(a.interno) && a.interno.length > 0);
  assert.ok(Array.isArray(a.lead) && a.lead.length > 0);
  // base presente (recibos CFE) + dato solar (techo)
  assert.ok(a.interno.some((s) => /recibo/i.test(s)), 'falta base (recibos) en interno');
  assert.ok(a.interno.some((s) => /techo|orientaci/i.test(s)), 'falta dato solar en interno');
  // dos voces: el texto para el lead no es idéntico al interno
  assert.notEqual(a.lead.join(' '), a.interno.join(' '));
});

test('buildAnteproyecto: bess pide cargas críticas y NO el dato estructural de techo solar', () => {
  const a = buildAnteproyecto({ tipo: 'BESS para respaldo', familia: 'bess' }, content);
  assert.equal(a.familia, 'bess');
  assert.ok(a.interno.some((s) => /crítica|autonom/i.test(s)), 'falta dato bess en interno');
  assert.ok(!a.interno.some((s) => /orientaci/i.test(s)), 'no debería pedir orientación de techo');
});

test('buildAnteproyecto: off_grid pide autonomía y generación actual', () => {
  const a = buildAnteproyecto({ tipo: 'Microred aislada (Solar + BESS)', familia: 'off_grid' }, content);
  assert.equal(a.familia, 'off_grid');
  assert.ok(a.interno.some((s) => /autonom|diésel|diesel/i.test(s)));
});

test('assembleResult: expone anteproyecto en el resultado y en el payload interno', () => {
  const res = assembleResult(estadoFx, content);
  assert.ok(res.anteproyecto && Array.isArray(res.anteproyecto.interno) && Array.isArray(res.anteproyecto.lead));
  assert.ok(FAMILIAS.includes(res.anteproyecto.familia));
  assert.ok(Array.isArray(res.leadPayload.anteproyecto_interno) && res.leadPayload.anteproyecto_interno.length > 0);
});
