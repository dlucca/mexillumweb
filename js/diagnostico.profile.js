import baseContent from './diagnostico.content.js';

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
}

function merge(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (isObject(value) && isObject(target[key])) merge(target[key], value);
    else target[key] = clone(value);
  }
  return target;
}

const COMMON_GENERATION = [
  { label: 'Sí — tenemos Solar en sitio (detrás del medidor)', codigo: 'solar_sitio' },
  { label: 'Tenemos contrato renovable o suministro privado', codigo: 'contrato' },
  { label: 'Generamos parte del año o de forma estacional', codigo: 'estacional' },
  { label: 'No, compramos toda la energía', codigo: 'no' },
  { label: 'Lo estamos evaluando', codigo: 'evaluando' }
];

const COMMON_TARIFF = [
  { label: 'GDMTH (Gran Demanda Media Tensión Horaria)', codigo: 'gdmth' },
  { label: 'GDMTO (Gran Demanda Media Tensión Ordinaria)', codigo: 'gdmto' },
  { label: 'DIST o DIT (Subtransmisión / Transmisión)', codigo: 'dist' },
  { label: 'GDBT (Gran Demanda Baja Tensión)', codigo: 'gdbt' },
  { label: 'PDBT (Pequeña Demanda Baja Tensión)', codigo: 'pdbt' },
  { label: 'No tengo el recibo a la mano', codigo: 'nolose' },
  { label: 'No compramos a CFE (suministrador privado / calificado)', codigo: 'privado' }
];

const COMMON_BILL = [
  { label: 'Menos de $200,000 MXN', codigo: 'bajo' },
  { label: '$200,000 – $1,000,000 MXN', codigo: 'medio' },
  { label: '$1,000,000 – $5,000,000 MXN', codigo: 'alto' },
  { label: 'Más de $5,000,000 MXN', codigo: 'muyalto' },
  { label: 'No lo tengo a la mano', codigo: 'nolose' }
];

function sectorScoring(sectors, emphasis = {}) {
  const ids = sectors.map((s) => s.codigo);
  const map = (defaultValue, overrides = {}) => Object.fromEntries(
    ids.map((id) => [id, overrides[id] ?? defaultValue])
  );
  return {
    peak_shaving: { sector: map(3, emphasis.peak_shaving) },
    arbitraje: { sector: map(3, emphasis.arbitraje) },
    solar_puro: { sector: map(2, emphasis.solar_puro) },
    bess_solar: { sector: map(3, emphasis.bess_solar) },
    respaldo: { sector: map(4, emphasis.respaldo) },
    diferimiento: { sector: map(0, emphasis.diferimiento) }
  };
}

export function createProfileContent(definition) {
  const content = clone(baseContent);
  const site = definition.siteLabel;
  const sectorLabels = Object.fromEntries(definition.sectors.map((s) => [s.codigo, s.profileLabel || s.label]));
  const commonSteps = {
    sector: {
      key: 'sector', notaLabel: definition.sectorNote || 'Tipo de operación',
      pregunta: definition.sectorQuestion,
      opciones: definition.sectors.map(({ label, codigo }) => ({ label, codigo }))
    },
    perfil: {
      key: 'perfil', notaLabel: 'Perfil de carga / horario',
      pregunta: definition.profileQuestion || `Pensando en un día típico de ${site}, ¿cómo se comporta el consumo eléctrico?`,
      hint: definition.profileHint || 'No necesitas números — elige la opción que mejor lo describa.',
      opciones: definition.loadProfiles
    },
    generacion: {
      key: 'generacion', notaLabel: 'Generación propia',
      pregunta: definition.generationQuestion || `¿${definition.generationVerb || 'Generan'} parte de su propia energía?`,
      opciones: definition.generationOptions || COMMON_GENERATION
    },
    calidad: {
      key: 'calidad', notaLabel: 'Calidad y confiabilidad',
      pregunta: definition.qualityQuestion || `¿Reconoces problemas de calidad o confiabilidad eléctrica en ${site}?`,
      opciones: definition.qualityOptions
    },
    tarifa: {
      key: 'tarifa', notaLabel: 'Tarifa o suministro',
      pregunta: definition.tariffQuestion || `Busca el recibo de energía de ${site}. ¿Qué tarifa o suministro tiene?`,
      hint: definition.tariffHint || 'Si es CFE, el código aparece en la carátula del recibo.',
      opciones: definition.tariffOptions || COMMON_TARIFF
    },
    factura: {
      key: 'factura', notaLabel: definition.billNote || 'Factura mensual',
      pregunta: definition.billQuestion || `¿Cuánto paga ${site} de electricidad al mes?`,
      hint: definition.billHint || 'Solo lo usamos para estimar el orden de magnitud.',
      opciones: definition.billOptions || COMMON_BILL
    },
    corte: {
      key: 'corte', notaLabel: 'Impacto de una interrupción',
      pregunta: definition.outageQuestion,
      opciones: definition.outageOptions
    },
    disparador: {
      key: 'disparador', notaLabel: 'Objetivo principal', multi: true,
      pregunta: definition.triggerQuestion || 'Además del costo, ¿algo de esto te suena familiar?',
      hint: definition.triggerHint || 'Puedes marcar más de una.',
      opciones: definition.triggerOptions
    }
  };

  merge(content, {
    profile: {
      id: definition.id,
      label: definition.label,
      route: definition.route,
      version: definition.version || '1.0'
    },
    intro: definition.intro,
    plantaLabel: site,
    pasos: ['sector', 'perfil', 'generacion', 'calidad', 'tarifa', 'factura', 'corte', 'disparador']
      .map((key) => commonSteps[key]),
    perfilSector: sectorLabels,
    perfilExposicion: definition.exposures || [],
    perfilExposicionDefault: definition.defaultExposure,
    scoring: { pesos: sectorScoring(definition.sectors, definition.sectorEmphasis) },
    resumen: {
      aplicaFrase: {
        'Muy Alto': `tiene un encaje preliminar muy alto para ${site}`,
        'Alto': `tiene buen encaje preliminar para ${site}`,
        'Medio': `podría aplicar en ${site}`,
        'Bajo': `requiere más datos antes de recomendarlo para ${site}`
      }
    },
    postResult: definition.postResult || {},
    emailVocabulary: definition.emailVocabulary || {}
  });

  merge(content, definition.overrides || {});
  return content;
}

export const sharedOptions = {
  generation: COMMON_GENERATION,
  tariff: COMMON_TARIFF,
  bill: COMMON_BILL
};
