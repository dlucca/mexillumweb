// Qué pasos se muestran (antes del resultado) y qué pasos de enriquecimiento
// aplican (después). Funciones puras; engine.js y app.js las consumen.
import { matchesRule, hasSignal, asRule } from './diagnostico.engine.js';

// Un paso sin `when` siempre se muestra. `when: {}` también (regla vacía = siempre).
// `paso.when` es una condición suelta (p. ej. { disparador: 'continuidad' }); se envuelve
// como regla de matchesRule (asRule) porque matchesRule solo reconoce las claves
// when/allOf/anyOf, no una condición suelta directamente.
export function pasoVisible(paso, resp) {
  if (!paso.when) return true;
  return matchesRule(resp || {}, asRule(paso.when));
}

export function pasosVisibles(content, resp) {
  return content.pasos.filter((p) => pasoVisible(p, resp));
}

// Índice (en content.pasos) del siguiente paso visible después de idx, o null.
export function siguienteIndice(content, resp, idx) {
  for (let i = idx + 1; i < content.pasos.length; i += 1) {
    if (pasoVisible(content.pasos[i], resp)) return i;
  }
  return null;
}

// Índice del paso visible anterior a idx, o null si idx es el primero.
export function anteriorIndice(content, resp, idx) {
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (pasoVisible(content.pasos[i], resp)) return i;
  }
  return null;
}

// Familia de anteproyecto efectiva: con freno, la del segundo paso.
export function familiaEfectiva(recomendacion) {
  if (!recomendacion) return 'base';
  if (recomendacion.primerPaso && recomendacion.segundoPaso) return recomendacion.segundoPaso.familia || 'base';
  return recomendacion.familia || 'base';
}

// Pasos después del resultado, en orden. Valores: 'techo' | 'punto' | 'facturas' | 'consumo'.
// `techo` es el mapa con dibujo de áreas (+ punto eléctrico); `punto` es el mapa solo punto.
export function pasosEnriquecimiento(res, content, resp) {
  const fam = familiaEfectiva(res.recomendacion_solucion);
  const post = content.postResult || {};
  const out = [];
  const quiereSolar = ['solar', 'bess_solar', 'off_grid'].includes(fam);
  const quierePunto = ['bess', 'bess_solar', 'off_grid'].includes(fam)
    || hasSignal(resp.disparador, 'capacidad') || !!post.servicePoint;
  if (quiereSolar && !post.skipRoof) out.push('techo');
  else if (quierePunto) out.push('punto');
  if (resp.conectado === false) out.push('consumo');
  else out.push('facturas');
  for (const f of post.forzar || []) {
    if (out.includes(f)) continue;
    if (f === 'punto' && out.includes('techo')) continue;
    if (f === 'techo' && out.includes('punto')) { out[out.indexOf('punto')] = 'techo'; continue; }
    out.unshift(f);
  }
  return out;
}
