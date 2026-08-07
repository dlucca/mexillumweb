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
