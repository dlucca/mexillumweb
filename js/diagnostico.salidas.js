// Las cuatro salidas independientes del diagnóstico (spec v4 §2.2) y `conectado`.
// Funciones puras. Ninguna mezcla las entradas de otra.
import { hasSignal } from './diagnostico.engine.js';

const SIN_RED = ['diesel', 'sin_suministro'];

// true: hay CFE o suministrador. false: sitio sin red. null: no se sabe (solo microred con tarifa nolose).
export function derivarConectado(resp, content) {
  if (hasSignal(resp.disparador, 'aislado')) return false;
  if (SIN_RED.includes(resp.tarifa)) return false;
  if (resp.tarifa === 'nolose' && content?.sinRedPosible) return null;
  return true;
}

export function encajeTecnico(scores, content) {
  const u = content.scoring.umbralPotencial;
  const valores = Object.values(scores);
  const s1 = valores.length ? Math.max(...valores) : 0;
  const fuertes = valores.filter((v) => v >= content.scoring.umbralFuerte).length;
  if (s1 < u.medio) return 'Bajo';
  if (s1 < content.scoring.umbralFuerte) return 'Medio';
  if (s1 >= u.muyAlto && fuertes >= 2) return 'Muy Alto';
  return 'Alto';
}

export function tamanoOportunidad(resp, content) {
  const cuantificable = (content.scoring.tarifasCuantificables || []).includes(resp.tarifa);
  if (resp.conectado === false || resp.factura === 'nolose' || !cuantificable) return 'Sin cuantificar';
  if (resp.factura === 'bajo') return 'Chico';
  if (resp.factura === 'medio') return 'Medio';
  return 'Grande';
}

// `extras`: { techo: boolean, consumo: boolean } — datos de enriquecimiento presentes.
export function confianza(resp, recomendacion, extras, content) {
  const ext = extras || {};
  const requisitos = recomendacion?.primerPaso
    ? (recomendacion.requisitos || [])
    : (content.requisitos?.[recomendacion?.familia] || content.requisitos?.base || []);
  const faltantes = requisitos.filter((req) => {
    if (req === 'techo') return !ext.techo;
    if (req === 'consumo') return !ext.consumo;
    const v = resp[req];
    return v == null || v === '' || v === 'nolose';
  });
  const nivel = faltantes.length === 0 ? 'Alta' : (faltantes.length === 1 ? 'Media' : 'Baja');
  return { nivel, faltantes };
}

const SENALES_EVALUANDO = ['capacidad', 'diesel', 'continuidad', 'aislado'];

// Activo = agendó llamada, o pasó por el enriquecimiento Y dejó al menos un dato.
// Terminar el enriquecimiento sin aportar nada no es señal comercial.
export function intencionComercial(resp, estado) {
  const e = estado || {};
  const aporto = Number(e.techo?.area_m2) > 0 || !!e.acometida
    || Number(e.facturas?.count) > 0 || !!e.datos_consumo;
  if (e.contacto?.tipo_cierre === 'llamada' || (e.enrichmentDone && aporto)) return 'Activo';
  if (SENALES_EVALUANDO.some((s) => hasSignal(resp.disparador, s))) return 'Evaluando';
  return 'Explorando';
}
