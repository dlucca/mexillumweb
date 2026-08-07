// Motor de reglas del funnel. Funciones puras, sin DOM. Importable en navegador
// y en Node (tests). Lee prioridades y condiciones desde content.js.

// ¿La respuesta cumple todas las igualdades de `when`?
function matchesWhen(resp, when) {
  return Object.entries(when).every(([campo, valor]) => resp[campo] === valor);
}

// Capa A / base del checklist: primera regla de reglasA que matchea (prioridad = orden).
export function resolveBaseArchetype(resp, content) {
  const regla = content.reglasA.find((r) => matchesWhen(resp, r.when));
  const elegida = regla || content.reglasA[content.reglasA.length - 1]; // fallback defensivo
  return { id: elegida.id, text: elegida.text };
}

// Capa B: primera regla de reglasB que matchea, o null.
export function pickLayerB(resp, content) {
  const regla = content.reglasB.find((r) => matchesWhen(resp, r.when));
  return regla ? { id: regla.id, text: regla.text } : null;
}

// Capa C: cierre por segmento.
export function pickLayerC(resp, content) {
  const c = content.capaC[resp.tipo_instalacion];
  return { texto: c.texto, ctaText: c.ctaText };
}

// Checklist dinámico. Devuelve versión completa (print/email/nota) y versión web (≤4 + universal).
export function buildChecklist(resp, content) {
  const { id } = resolveBaseArchetype(resp, content);
  const base = content.checklistBase[id];
  const refuerzos = content.checklistRefuerzos
    .filter((r) => matchesWhen(resp, r.when))
    .map((r) => r.bullet);

  const contenido = [...base, ...refuerzos];           // base + refuerzos en orden de prioridad
  const web = contenido.slice(0, 4).concat(content.checklistUniversal);
  const full = contenido.concat(content.checklistUniversal);
  return { full, web };
}

// Score interno (§9.1). No visible al lead.
export function computeScore(resp, bookingAgendado = false) {
  let valor = 0;
  if (resp.interrupciones === 'si_medido') valor += 3;
  if (resp.interrupciones === 'si_no_medido') valor += 1;
  if (resp.diesel_red_debil === 'si') valor += 2;
  if (resp.exporta_excedente === 'si') valor += 1;
  if (resp.tipo_instalacion === 'publico') valor += 1;
  if (bookingAgendado) valor += 2;
  const nivel = valor <= 1 ? 'bajo' : valor <= 4 ? 'medio' : 'alto';
  return { valor, nivel };
}

// Códigos internos → labels visibles (§8.1).
export function toReadable(resp, content) {
  const legibles = {};
  for (const paso of content.pasos) {
    const opcion = paso.opciones.find((o) => o.codigo === resp[paso.key]);
    legibles[paso.key] = opcion ? opcion.label : resp[paso.key];
  }
  return legibles;
}

// Orquesta todo y arma el payload del lead.
export function assembleResult(estado, content) {
  const resp = estado.respuestas;
  const base = resolveBaseArchetype(resp, content);
  const b = pickLayerB(resp, content);
  const c = pickLayerC(resp, content);
  const checklist = buildChecklist(resp, content);
  const score = computeScore(resp, false);
  const legibles = toReadable(resp, content);

  const leadPayload = {
    lead_id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
    timestamp: new Date().toISOString(),
    nombre: estado.contacto.nombre,
    empresa: estado.contacto.empresa,
    correo: estado.contacto.correo,
    telefono: estado.contacto.telefono || '',
    cargo: estado.contacto.cargo || '',
    respuestas_legibles: legibles,
    respuestas_codigos: { ...resp },
    arquetipo_base: base.id,
    refuerzo_activado: b ? b.id : null,
    score,
    booking_agendado: false,
    checklist_full: checklist.full
  };

  return {
    layerA: base.text,
    layerB: b ? b.text : null,
    layerC: c,
    checklist,
    archetypeBase: base.id,
    reinforcement: b ? b.id : null,
    score,
    leadPayload
  };
}
