import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';
import {
  plantaLabel, buildProfile, toReadable,
  roundHalfEven, formatMoney, formatRango, computeRange, renderBlockB, pickLevers, pickMissingData,
  pickFinancing, ofreceServicio, buildChecklist, assembleResult, buildEventNote,
  scoreOpportunities, rankOpportunities, potencialGeneral
} from '../js/diagnostico.engine.js';

// Fixture canónico del spec §5.
const fx = {
  sector: 'manufactura', perfil: 'diurno', generacion: 'fisica', calidad: 'no',
  tarifa: 'gdmth', factura: 'alto', corte: 'reinicio', disparador: 'costo'
};

test('plantaLabel: una sola instalación siempre → "tu operación"', () => {
  assert.equal(plantaLabel(), 'tu operación');
});

test('buildProfile: fixture arma el perfil esperado', () => {
  assert.equal(buildProfile(fx, content), 'Perfil: manufactura con exposición a cargo por demanda.');
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
  const rd = { sector: 'frio', generacion: 'no', disparador: 'diesel' };
  assert.equal(buildProfile(rd, content), 'Perfil: frío y logística con dependencia de diésel.');
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
  assert.ok(renderBlockB(r, content).texto.includes('el arbitraje horario lo es'));
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

// ---- BLOQUE C: palancas jerarquizadas ----

test('pickLevers: fixture → Recorte de demanda + Continuidad de proceso + Solar (sin gancho: hubo número)', () => {
  const l = pickLevers(fx, content);
  assert.equal(l.gancho, null); // Cambio 2: demanda=desconoce pero factura=alto → hubo número, sin gancho
  assert.equal(l.principal.nombre, 'Recorte de demanda');
  assert.equal(l.secundaria.nombre, 'Continuidad de proceso');
  assert.equal(l.descartada.nombre, 'Solar');
});

test('pickLevers: gancho solo en salidas sin número', () => {
  assert.equal(pickLevers({ ...fx, factura: 'alto', tarifa: 'gdmth' }, content).gancho, null);
  assert.equal(pickLevers({ ...fx, factura: 'nolose' }, content).gancho, content.gancho);
  assert.equal(pickLevers({ ...fx, tarifa: 'privado' }, content).gancho, content.gancho);
});

test('pickLevers: principal por precedencia (estacional > diesel > capacidad > continuo)', () => {
  assert.equal(pickLevers({ ...fx, generacion: 'estacional', disparador: 'diesel' }, content).principal.nombre, 'Cobertura fuera de temporada');
  assert.equal(pickLevers({ ...fx, generacion: 'no', disparador: 'diesel' }, content).principal.nombre, 'Sustitución de diésel');
  assert.equal(pickLevers({ ...fx, generacion: 'no', disparador: 'capacidad' }, content).principal.nombre, 'Diferimiento de capacidad');
  assert.equal(pickLevers({ ...fx, sector: 'continuo', generacion: 'no', disparador: 'costo' }, content).principal.nombre, 'Arbitraje horario');
});

test('pickLevers: secundaria excluye la que ganó como principal', () => {
  // continuo gana principal (Arbitraje horario); la secundaria continuo NO debe repetirse.
  const r = { ...fx, sector: 'continuo', generacion: 'no', corte: 'nada', disparador: 'costo' };
  const l = pickLevers(r, content);
  assert.equal(l.principal.nombre, 'Arbitraje horario');
  assert.equal(l.secundaria, null); // no hay corte útil y continuo ya fue principal
});

test('pickLevers: descarte SIEMPRE presente vía default cuando ninguna regla 1–5 aplica (Cambio 1)', () => {
  // manufactura sin señales → default arbitraje; secundaria sí sigue pudiendo ser null
  const r = { sector: 'manufactura', sitios: 'uno', generacion: 'no', demanda: 'mide', tarifa: 'gdmth', factura: 'alto', corte: 'nada', disparador: 'excedente' };
  const l = pickLevers(r, content);
  assert.equal(l.principal.nombre, 'Arbitraje de excedente');
  assert.equal(l.secundaria, null);
  assert.equal(l.descartada.nombre, 'Arbitraje horario como caso principal');
  // ev residual (ninguna regla 1–5 aplica) → default solar
  const rev = { sector: 'ev', sitios: 'uno', generacion: 'no', demanda: 'mide', tarifa: 'gdmth', factura: 'alto', corte: 'reinicio', disparador: 'costo' };
  assert.equal(pickLevers(rev, content).descartada.nombre, 'Generación solar como prioridad');
});

test('pickLevers: continuidad de servicio usa variante frío solo en perfil frío (Cambio 2)', () => {
  const frio = pickLevers({ ...fx, sector: 'frio', corte: 'servicio', calidad: 'no' }, content);
  assert.equal(frio.secundaria.nombre, 'Continuidad de servicio');
  assert.ok(frio.secundaria.text.startsWith('En frío el costo de un corte'));
  // Otros perfiles conservan el string genérico.
  const otro = pickLevers({ ...fx, sector: 'manufactura', corte: 'servicio' }, content);
  assert.equal(otro.secundaria.nombre, 'Continuidad de servicio');
  assert.ok(otro.secundaria.text.startsWith('Además, cada hora sin energía'));
});

test('pickLevers: factor de potencia como secundaria adicional solo con calidad=factor', () => {
  const conFactor = pickLevers({ ...fx, calidad: 'factor' }, content);
  assert.ok(conFactor.factorPotencia, 'calidad=factor debe traer factor de potencia');
  assert.equal(conFactor.factorPotencia.nombre, 'Corrección de factor de potencia');
  assert.equal(pickLevers({ ...fx, calidad: 'no' }, content).factorPotencia, null);
  assert.equal(pickLevers({ ...fx, calidad: 'cortes' }, content).factorPotencia, null);
});

// ---- BLOQUE D: datos que faltan ----

test('pickMissingData: fixture (corte=reinicio, sin señales de igualdad) → regla corte!=nada', () => {
  const d = pickMissingData(fx, content);
  assert.equal(d.dato, content.datoFaltanteCorte);
  assert.equal(d.cierre, content.cierreComun);
});

test('pickMissingData: precedencia de igualdad sobre corte!=nada', () => {
  assert.equal(pickMissingData({ ...fx, factura: 'nolose' }, content).dato, content.datoFaltante[0].text);
  assert.equal(pickMissingData({ ...fx, tarifa: 'privado' }, content).dato, content.datoFaltante[1].text);
  assert.equal(pickMissingData({ ...fx, disparador: 'diesel' }, content).dato, content.datoFaltante[2].text);
  assert.equal(pickMissingData({ ...fx, sector: 'continuo' }, content).dato, content.datoFaltante[3].text);
});

test('pickMissingData: default cuando corte=nada y sin señales', () => {
  const r = { sector: 'manufactura', tarifa: 'gdmth', factura: 'alto', disparador: 'costo', corte: 'nada' };
  assert.equal(pickMissingData(r, content).dato, content.datoFaltanteDefault);
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

// ---- ASSEMBLER + NOTA DEL EVENTO ----

const estadoFx = {
  respuestas: { ...fx },
  contacto: { nombre: 'Ana', empresa: 'Acme', correo: 'ana@acme.mx', telefono: '5555', rol: 'Finanzas' }
};

test('assembleResult: fixture end-to-end (spec §5, salida estructurada)', () => {
  const res = assembleResult(estadoFx, content);
  assert.equal(res.perfil, 'Perfil: manufactura con exposición a cargo por demanda.');
  assert.equal(res.calculo.sin_numero, false);
  assert.equal(res.calculo.rango_texto, '$2.2 a $4.2 millones de MXN al año');
  assert.ok(res.calculo.cadena.includes('$2.5 millones'));
  assert.equal(res.gancho, null); // Cambio 2: hubo número
  assert.equal(res.palancas.principal.nombre, 'Recorte de demanda');
  assert.equal(res.palancas.secundaria.nombre, 'Continuidad de proceso');
  assert.equal(res.palancas.descarte.nombre, 'Solar');
  assert.equal(res.dato_faltante, content.datoFaltanteCorte);
  assert.equal(res.cierre_llamada, content.cierreComun);
  assert.ok(res.financiamiento.startsWith('Nuestros proyectos pueden estructurarse de dos formas'));
  assert.equal(res.checklist.web[res.checklist.web.length - 1], content.checklistUniversal);
});

// Fixture del parche §Verificación: frío/uno/no/desconoce/gdmth/alto/reinicio/costo.
// Antes del parche: dos palancas (sin descarte) y frase-gancho redundante.
// Tras el parche: tres palancas (con descarte default) y gancho null.
test('assembleResult: fixture del parche → descarte presente y gancho null', () => {
  const estado = {
    respuestas: { sector: 'frio', perfil: 'diurno', sitios: 'uno', generacion: 'no', demanda: 'desconoce', tarifa: 'gdmth', factura: 'alto', corte: 'reinicio', disparador: 'costo' },
    contacto: {}
  };
  const res = assembleResult(estado, content);
  assert.equal(res.perfil, 'Perfil: frío y logística con exposición a cargo por demanda.');
  assert.equal(res.calculo.rango_texto, '$2.2 a $4.2 millones de MXN al año');
  assert.equal(res.gancho, null); // Cambio 2: demanda=desconoce pero hubo número
  assert.equal(res.palancas.principal.nombre, 'Recorte de demanda');
  assert.equal(res.palancas.secundaria.nombre, 'Continuidad de proceso'); // corte=reinicio
  assert.ok(res.palancas.descarte, 'descarte debe estar presente'); // Cambio 1
  assert.equal(res.palancas.descarte.nombre, 'Arbitraje horario como caso principal');
  assert.ok(res.palancas.descarte.text.startsWith('Salvo que tu consumo esté fuertemente concentrado'));
  assert.equal(res.dato_faltante, content.datoFaltanteCorte); // corte=reinicio
  assert.ok(res.financiamiento.startsWith('Nuestros proyectos pueden estructurarse de dos formas'));
});

test('assembleResult: leadPayload expone las keys que consume /api/lead', () => {
  const p = assembleResult(estadoFx, content).leadPayload;
  const esperadas = ['lead_id', 'timestamp', 'nombre', 'empresa', 'correo', 'telefono', 'rol',
    'respuestas_legibles', 'respuestas_codigos', 'perfil', 'rango_texto', 'checklist_full'];
  for (const k of esperadas) assert.ok(k in p, `falta ${k}`);
  assert.equal(p.nombre, 'Ana');
  assert.equal(p.rol, 'Finanzas');
  assert.equal(p.rango_texto, '$2.2 a $4.2 millones de MXN al año');
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

test('rankOpportunities: devuelve 6 ordenadas desc con nombre', () => {
  const r = rankOpportunities(scoreOpportunities(fx, content), content);
  assert.equal(r.length, 6);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score);
  assert.ok(typeof r[0].nombre === 'string');
});

test('potencialGeneral: tope Medio cuando faltan factura y tarifa', () => {
  const resp = { ...fx, factura: 'nolose', tarifa: 'nolose', corte: 'producto', calidad: 'cortes' };
  const scores = scoreOpportunities(resp, content);
  assert.equal(potencialGeneral(scores, resp, content), 'Medio');
});

test('potencialGeneral: Muy Alto con score líder >=75', () => {
  const resp = { sector: 'manufactura', perfil: 'picos', generacion: 'no', calidad: 'factor', tarifa: 'gdmth', factura: 'muyalto', corte: 'producto', disparador: 'costo' };
  const scores = scoreOpportunities(resp, content);
  assert.equal(potencialGeneral(scores, resp, content), 'Muy Alto');
});

test('assembleResult: expone scores, ranking y potencial_general', () => {
  const res = assembleResult(estadoFx, content);
  assert.equal(typeof res.scores.peak_shaving, 'number');
  assert.equal(res.ranking.length, 6);
  assert.ok(['Muy Alto', 'Alto', 'Medio', 'Bajo'].includes(res.potencial_general));
  assert.equal(res.leadPayload.potencial_general, res.potencial_general);
});
