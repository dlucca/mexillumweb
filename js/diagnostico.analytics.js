// Capa de medición neutral: funciona con GTM/dataLayer cuando existe y también
// deja un CustomEvent observable en desarrollo, sin bloquear el diagnóstico.
export function trackDx(event, detail = {}) {
  const payload = { event: `diagnostico_${event}`, ...detail };
  if (Array.isArray(globalThis.dataLayer)) globalThis.dataLayer.push(payload);
  globalThis.dispatchEvent?.(new CustomEvent('mexillum:diagnostico', { detail: payload }));
}
