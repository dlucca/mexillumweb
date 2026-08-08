// Motor de reglas del funnel v2. Funciones puras, sin DOM. Importable en navegador
// y en Node (tests). Lee prioridades, condiciones y copy desde content.js.

// ¿La respuesta cumple todas las igualdades de `when`?
export function matchesWhen(resp, when) {
  return Object.entries(when).every(([campo, valor]) => resp[campo] === valor);
}

// Fraseo de planta: "tu operación" si hay un solo sitio, "esa planta" si hay varios.
export function plantaLabel(resp) {
  return resp.sitios === 'uno' ? 'tu operación' : 'esa planta';
}

// BLOQUE A — línea de perfil.
export function buildProfile(resp, content) {
  const sector = content.perfilSector[resp.sector] || resp.sector;
  const multi = resp.sitios !== 'uno' ? ' multi-planta' : '';
  const exp = content.perfilExposicion.find((r) => matchesWhen(resp, r.when));
  const exposicion = exp ? exp.text : content.perfilExposicionDefault;
  return `Perfil: ${sector}${multi} ${exposicion}.`;
}

// Códigos internos → labels visibles, para las 8 keys.
export function toReadable(resp, content) {
  const legibles = {};
  for (const paso of content.pasos) {
    const opcion = paso.opciones.find((o) => o.codigo === resp[paso.key]);
    legibles[paso.key] = opcion ? opcion.label : resp[paso.key];
  }
  return legibles;
}
