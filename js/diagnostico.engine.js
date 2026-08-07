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
