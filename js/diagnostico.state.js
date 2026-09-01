const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function key(profileId) {
  return `mexillum:diagnostico:${profileId}:v1`;
}

export function loadDxState(profileId) {
  try {
    const saved = JSON.parse(localStorage.getItem(key(profileId)) || 'null');
    if (!saved || Date.now() - saved.savedAt > TTL_MS) return null;
    return saved.state;
  } catch {
    return null;
  }
}

export function saveDxState(profileId, state) {
  try {
    const privateSteps = ['cierre', 'techo', 'facturas', 'agenda'];
    const safeStep = privateSteps.includes(state.paso) ? 'result' : state.paso;
    // No se guardan datos personales, ubicación, techo ni archivos.
    localStorage.setItem(key(profileId), JSON.stringify({
      savedAt: Date.now(),
      state: {
        paso: safeStep,
        respuestas: state.respuestas,
        lead_id: state.lead_id
      }
    }));
  } catch {
    // El almacenamiento puede estar deshabilitado; el funnel debe seguir.
  }
}

export function clearDxState(profileId) {
  try { localStorage.removeItem(key(profileId)); } catch { /* no-op */ }
}
