import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';
import {
  resolveBaseArchetype, pickLayerB, pickLayerC, buildChecklist,
  computeScore, toReadable, assembleResult
} from '../js/diagnostico.engine.js';

// respuesta base "neutra" que no dispara refuerzos ni generación
const neutra = {
  tipo_instalacion: 'industrial',
  generacion_propia: 'ninguna',
  patron_operacion: 'intermitente',
  interrupciones: 'no',
  diesel_red_debil: 'no',
  exporta_excedente: 'no'
};

test('Capa A: estacional tiene prioridad sobre patron_operacion', () => {
  const r = { ...neutra, generacion_propia: 'estacional', patron_operacion: 'continuo' };
  assert.equal(resolveBaseArchetype(r, content).id, 'estacional');
});

test('Capa A: fisica tiene prioridad sobre patron_operacion', () => {
  const r = { ...neutra, generacion_propia: 'fisica', patron_operacion: 'picos' };
  assert.equal(resolveBaseArchetype(r, content).id, 'fisica');
});

test('Capa A: sin generación relevante, decide patron_operacion', () => {
  assert.equal(resolveBaseArchetype({ ...neutra, patron_operacion: 'continuo' }, content).id, 'continuo');
  assert.equal(resolveBaseArchetype({ ...neutra, patron_operacion: 'picos' }, content).id, 'picos');
  assert.equal(resolveBaseArchetype({ ...neutra, patron_operacion: 'intermitente' }, content).id, 'intermitente');
});

test('Capa A: generacion certificada cae al patron (no matchea A1/A2)', () => {
  const r = { ...neutra, generacion_propia: 'certificada', patron_operacion: 'picos' };
  assert.equal(resolveBaseArchetype(r, content).id, 'picos');
});

test('Capa B: diesel gana por prioridad sobre interrupciones', () => {
  const r = { ...neutra, diesel_red_debil: 'si', interrupciones: 'si_medido' };
  assert.equal(pickLayerB(r, content).id, 'diesel');
});

test('Capa B: sin diesel, gana interrupciones medido', () => {
  const r = { ...neutra, interrupciones: 'si_medido', exporta_excedente: 'si' };
  assert.equal(pickLayerB(r, content).id, 'int_medido');
});

test('Capa B: null cuando ninguna condición aplica', () => {
  assert.equal(pickLayerB(neutra, content), null);
});

test('Capa C: devuelve texto y ctaText por tipo', () => {
  const c = pickLayerC({ ...neutra, tipo_instalacion: 'publico' }, content);
  assert.equal(c.ctaText, 'Quiero agendar una conversación');
  assert.ok(c.texto.includes('continuidad'));
});

test('checklist full: base + refuerzos + universal, sin recorte', () => {
  const r = {
    tipo_instalacion: 'industrial', generacion_propia: 'ninguna', patron_operacion: 'continuo',
    interrupciones: 'si_medido', diesel_red_debil: 'si', exporta_excedente: 'si'
  };
  const { full } = buildChecklist(r, content);
  // base continuo (3) + diesel + int_medido + exporta (3) + universal (1) = 7
  assert.equal(full.length, 7);
  assert.equal(full[full.length - 1], content.checklistUniversal);
});

test('checklist web: recorta a 4 de contenido + universal como 5ª', () => {
  const r = {
    tipo_instalacion: 'industrial', generacion_propia: 'ninguna', patron_operacion: 'continuo',
    interrupciones: 'si_medido', diesel_red_debil: 'si', exporta_excedente: 'si'
  };
  const { web } = buildChecklist(r, content);
  assert.equal(web.length, 5); // 4 contenido + universal
  assert.equal(web[web.length - 1], content.checklistUniversal);
  // conserva la base (3) + el refuerzo de mayor prioridad (diesel), descarta el resto
  assert.ok(web.includes('Cuántas horas al año corre tu respaldo de diésel y costo aproximado'));
  assert.ok(!web.includes('Cómo vendés ese excedente hoy: contrato, tarifa y a quién'));
});

test('checklist web: sin refuerzos, solo base + universal', () => {
  const r = {
    tipo_instalacion: 'industrial', generacion_propia: 'ninguna', patron_operacion: 'intermitente',
    interrupciones: 'no', diesel_red_debil: 'no', exporta_excedente: 'no'
  };
  const { web, full } = buildChecklist(r, content);
  assert.equal(web.length, 3); // base intermitente (2) + universal
  assert.deepEqual(web, full); // sin recorte cuando no se supera el tope
});

test('score: suma aditiva y nivel', () => {
  // si_medido (+3) + diesel (+2) + exporta (+1) = 6 → alto
  const r = {
    tipo_instalacion: 'industrial', generacion_propia: 'ninguna', patron_operacion: 'continuo',
    interrupciones: 'si_medido', diesel_red_debil: 'si', exporta_excedente: 'si'
  };
  assert.deepEqual(computeScore(r), { valor: 6, nivel: 'alto' });
});

test('score: booking suma +2', () => {
  const r = {
    tipo_instalacion: 'comercial', generacion_propia: 'ninguna', patron_operacion: 'picos',
    interrupciones: 'no', diesel_red_debil: 'no', exporta_excedente: 'no'
  };
  assert.equal(computeScore(r, false).valor, 0);
  assert.equal(computeScore(r, true).valor, 2);
});

test('score: publico suma +1 y niveles de corte', () => {
  const r = {
    tipo_instalacion: 'publico', generacion_propia: 'ninguna', patron_operacion: 'intermitente',
    interrupciones: 'si_no_medido', diesel_red_debil: 'no', exporta_excedente: 'no'
  };
  // publico (+1) + si_no_medido (+1) = 2 → medio
  assert.deepEqual(computeScore(r), { valor: 2, nivel: 'medio' });
});

test('score: cortes de nivel en las fronteras (1=bajo, 4=medio, 5=alto)', () => {
  const base = {
    tipo_instalacion: 'comercial', generacion_propia: 'ninguna', patron_operacion: 'intermitente',
    interrupciones: 'no', diesel_red_debil: 'no', exporta_excedente: 'no'
  };
  // valor 1 → bajo (frontera 1/2)
  assert.deepEqual(computeScore({ ...base, interrupciones: 'si_no_medido' }), { valor: 1, nivel: 'bajo' });
  // valor 4 → medio (frontera 4/5): diesel (+2) + si_no_medido (+1) + publico (+1)
  assert.deepEqual(
    computeScore({ ...base, tipo_instalacion: 'publico', diesel_red_debil: 'si', interrupciones: 'si_no_medido' }),
    { valor: 4, nivel: 'medio' }
  );
  // valor 5 → alto (frontera 4/5): si_medido (+3) + diesel (+2)
  assert.deepEqual(
    computeScore({ ...base, interrupciones: 'si_medido', diesel_red_debil: 'si' }),
    { valor: 5, nivel: 'alto' }
  );
});

test('toReadable: códigos → labels visibles', () => {
  const r = {
    tipo_instalacion: 'industrial', generacion_propia: 'estacional', patron_operacion: 'continuo',
    interrupciones: 'si_medido', diesel_red_debil: 'si', exporta_excedente: 'no_aplica'
  };
  const leg = toReadable(r, content);
  assert.equal(leg.tipo_instalacion, 'Planta industrial o manufactura');
  assert.equal(leg.interrupciones, 'Sí, y sabemos cuánto nos costó');
  assert.equal(leg.exporta_excedente, 'No aplica');
});

test('assembleResult: arma resultado completo y leadPayload', () => {
  const estado = {
    respuestas: {
      tipo_instalacion: 'industrial', generacion_propia: 'estacional', patron_operacion: 'continuo',
      interrupciones: 'si_medido', diesel_red_debil: 'si', exporta_excedente: 'no'
    },
    contacto: { nombre: 'Ana', empresa: 'Acme', correo: 'ana@acme.mx', telefono: '', cargo: '' }
  };
  const res = assembleResult(estado, content);
  assert.equal(res.archetypeBase, 'estacional');
  assert.equal(res.reinforcement, 'diesel');       // diesel gana en B
  assert.ok(res.layerA.startsWith('Tu generación cubre'));
  assert.ok(res.layerB.includes('diésel'));
  assert.equal(res.layerC.ctaText, 'Quiero ver el diagnóstico');
  assert.equal(res.checklist.web[res.checklist.web.length - 1], content.checklistUniversal);
  assert.equal(res.leadPayload.booking_agendado, false);
  assert.equal(res.leadPayload.empresa, 'Acme');
  assert.equal(res.leadPayload.respuestas_legibles.generacion_propia, 'Depende de la temporada (ej. generamos con biomasa o cogeneración parte del año)');
  assert.equal(res.leadPayload.arquetipo_base, 'estacional');
  assert.equal(typeof res.leadPayload.lead_id, 'string');
  assert.ok(Array.isArray(res.leadPayload.checklist_full));
});

// ---- Contrato de copy: pin del texto exacto de cada capa (v actualizada) ----

test('Copy Capa A: las 5 combinaciones arman el texto correcto', () => {
  const esperado = {
    estacional: 'Tu generación cubre parte del año, pero el resto pagás la tarifa completa de CFE. Podemos ayudarte a cerrar ese hueco y bajar esa factura — justo en la época de mayor sol.',
    fisica: 'Ya generás tu propia energía, pero parte se pierde cuando no coincide con lo que necesitás. Esa energía perdida es ahorro que hoy se está quedando sobre la mesa.',
    continuo: 'Tu operación no se detiene, así que hoy comprás en el horario más caro todos los días, sin alternativa. Ese gasto se puede optimizar y reducir de forma constante, mes a mes.',
    picos: 'La mayoría de las operaciones paga de más por apenas unos minutos al mes — su momento de mayor consumo. Ese pico suele pesar más de lo que parece en la factura, y es de lo más fácil de recortar.',
    intermitente: 'Tu consumo varía mucho, lo que casi siempre esconde picos que encarecen toda la factura sin que se note en el día a día. Identificarlos es el primer paso para bajarla.'
  };
  const fixtures = {
    estacional: { ...neutra, generacion_propia: 'estacional' },
    fisica: { ...neutra, generacion_propia: 'fisica' },
    continuo: { ...neutra, patron_operacion: 'continuo' },
    picos: { ...neutra, patron_operacion: 'picos' },
    intermitente: { ...neutra, patron_operacion: 'intermitente' }
  };
  for (const id of Object.keys(esperado)) {
    const a = resolveBaseArchetype(fixtures[id], content);
    assert.equal(a.id, id);
    assert.equal(a.text, esperado[id]);
  }
});

test('Copy Capa B: las 4 combinaciones arman el texto correcto', () => {
  const esperado = {
    diesel: 'Además, sustituir diésel por almacenamiento no solo es más limpio — reduce el costo por hora operada de forma significativa.',
    int_medido: 'Y ya tenés el dato más valioso: cuánto te cuesta cada falla. Ese número es justo el que dimensiona el ahorro real del proyecto.',
    int_no_medido: 'Ese tipo de interrupciones casi nunca se mide, y suele costar más de lo que parece. Cuantificarlo es el primer paso para convertirlo en ahorro.',
    exporta: 'Y si ya exportás excedente, hay margen para que ese mismo kWh valga más según a qué hora lo vendés — ingreso adicional sin cambiar tu operación.'
  };
  const fixtures = {
    diesel: { ...neutra, diesel_red_debil: 'si' },
    int_medido: { ...neutra, interrupciones: 'si_medido' },
    int_no_medido: { ...neutra, interrupciones: 'si_no_medido' },
    exporta: { ...neutra, exporta_excedente: 'si' }
  };
  for (const id of Object.keys(esperado)) {
    const b = pickLayerB(fixtures[id], content);
    assert.equal(b.id, id);
    assert.equal(b.text, esperado[id]);
  }
});

test('Copy Capa C: las 4 combinaciones arman texto y botón correctos', () => {
  const esperado = {
    industrial: { texto: 'La solución puede ser 100% financiada: el ahorro empieza desde el primer mes y el riesgo del activo queda de nuestro lado.', ctaText: 'Quiero ver el diagnóstico' },
    comercial: { texto: 'Todo esto sin desembolso inicial: el ahorro arranca desde el primer mes.', ctaText: 'Quiero ver el diagnóstico' },
    publico: { texto: 'Cero inversión, cero deuda, cero riesgo — protegé la continuidad de tu servicio sin comprometer presupuesto.', ctaText: 'Quiero agendar una conversación' },
    ev: { texto: 'Sin esperar años de trámite ni poner capital — la optimización de tus costos empieza de inmediato.', ctaText: 'Quiero ver el diagnóstico' }
  };
  for (const t of Object.keys(esperado)) {
    const c = pickLayerC({ ...neutra, tipo_instalacion: t }, content);
    assert.deepEqual(c, esperado[t]);
  }
});

test('Ensamblado final: continuo + diesel + industrial coincide con el ejemplo', () => {
  const resp = { ...neutra, patron_operacion: 'continuo', diesel_red_debil: 'si', tipo_instalacion: 'industrial' };
  const a = resolveBaseArchetype(resp, content);
  const b = pickLayerB(resp, content);
  const c = pickLayerC(resp, content);
  const armado = `${a.text} ${b.text}\n\n${c.texto}`;
  const esperado =
    'Tu operación no se detiene, así que hoy comprás en el horario más caro todos los días, sin alternativa. Ese gasto se puede optimizar y reducir de forma constante, mes a mes. ' +
    'Además, sustituir diésel por almacenamiento no solo es más limpio — reduce el costo por hora operada de forma significativa.\n\n' +
    'La solución puede ser 100% financiada: el ahorro empieza desde el primer mes y el riesgo del activo queda de nuestro lado.';
  assert.equal(armado, esperado);
});
