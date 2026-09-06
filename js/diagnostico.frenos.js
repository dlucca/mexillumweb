// Frenos: un "primer paso" que va antes de BESS/Solar cuando la respuesta propia del
// perfil lo indica (spec v4 §2.1). Las reglas viven en content.frenos; aquí solo se evalúan.
import { matchesRule, hasSignal } from './diagnostico.engine.js';
import { encajeTecnico } from './diagnostico.salidas.js';

export function applyBrakes(resp, scores, content) {
  const frenos = content.frenos || [];
  if (!frenos.length) return null;
  if (hasSignal(resp.disparador, 'aislado') || resp.conectado === false) return null;
  if (encajeTecnico(scores, content) === 'Bajo') return null;
  const f = frenos.find((r) => matchesRule(resp, r));
  if (!f) return null;
  return {
    id: f.id, tipo: f.tipo, razon: f.razon, despues: f.despues || 'bess',
    requisitos: f.requisitos || [],
    anteproyecto: { interno: f.anteproyecto?.interno || [], lead: f.anteproyecto?.lead || [] }
  };
}
