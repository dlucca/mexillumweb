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

  const continuidadOpcion = {
    label: definition.continuityLabel || 'Los cortes de energía nos cuestan dinero o servicio',
    codigo: 'continuidad'
  };
  const triggerOptions = definition.triggerOptions.some((o) => o.codigo === 'continuidad')
    ? definition.triggerOptions
    : (() => {
        const idx = definition.triggerOptions.findIndex((o) => o.exclusiva);
        const copia = [...definition.triggerOptions];
        copia.splice(idx < 0 ? copia.length : idx, 0, continuidadOpcion);
        return copia;
      })();

  const comunes = [
    {
      key: 'sector', rol: 'comun', notaLabel: definition.sectorNote || 'Tipo de operación',
      pregunta: definition.sectorQuestion,
      opciones: definition.sectors.map(({ label, codigo }) => ({ label, codigo }))
    },
    {
      key: 'disparador', rol: 'comun', notaLabel: 'Objetivo principal', multi: true,
      pregunta: definition.triggerQuestion || 'Además del costo, ¿algo de esto te suena familiar?',
      hint: definition.triggerHint || 'Puedes marcar más de una.',
      opciones: triggerOptions
    },
    {
      key: 'perfil', rol: 'comun', notaLabel: 'Perfil de carga / horario',
      pregunta: definition.profileQuestion || `Pensando en un día típico de ${site}, ¿cómo se comporta el consumo eléctrico?`,
      hint: definition.profileHint || 'No necesitas números — elige la opción que mejor lo describa.',
      opciones: definition.loadProfiles
    },
    {
      key: 'generacion', rol: 'comun', notaLabel: 'Generación propia',
      pregunta: definition.generationQuestion || `¿${definition.generationVerb || 'Generan'} parte de su propia energía?`,
      opciones: definition.generationOptions || COMMON_GENERATION
    },
    {
      key: 'tarifa', rol: 'comun', notaLabel: 'Tarifa o suministro',
      pregunta: definition.tariffQuestion || `Busca el recibo de energía de ${site}. ¿Qué tarifa o suministro tiene?`,
      hint: definition.tariffHint || 'Si es CFE, el código aparece en la carátula del recibo.',
      opciones: definition.tariffOptions || COMMON_TARIFF
    },
    {
      key: 'factura', rol: 'comun', notaLabel: definition.billNote || 'Factura mensual',
      pregunta: definition.billQuestion || `¿Cuánto paga ${site} de electricidad al mes?`,
      hint: definition.billHint || 'Solo lo usamos para estimar el orden de magnitud.',
      opciones: definition.billOptions || COMMON_BILL
    }
  ];

  // Pregunta propia: si la definición no trae una, se usa `calidad` (compatibilidad).
  const propia = definition.propia
    ? { ...clone(definition.propia), rol: 'propia' }
    : {
        key: 'calidad', rol: 'propia', notaLabel: 'Calidad y confiabilidad',
        pregunta: definition.qualityQuestion || `¿Reconoces problemas de calidad o confiabilidad eléctrica en ${site}?`,
        opciones: definition.qualityOptions
      };

  // Condicional: por defecto `corte`, visible con continuidad o si el perfil es de continuidad crítica.
  const condicional = definition.condicional === null
    ? null
    : definition.condicional
      ? { ...clone(definition.condicional), rol: 'condicional' }
      : {
          key: 'corte', rol: 'condicional', notaLabel: 'Impacto de una interrupción',
          when: definition.continuidadCritica ? {} : { disparador: 'continuidad' },
          pregunta: definition.outageQuestion,
          opciones: definition.outageOptions
        };

  const pasos = [...comunes, propia, ...(condicional ? [condicional] : [])];

  merge(content, {
    profile: {
      id: definition.id,
      label: definition.label,
      route: definition.route,
      version: definition.version || '2.0'
    },
    intro: definition.intro,
    plantaLabel: site,
    pasos,
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
    emailVocabulary: definition.emailVocabulary || {},
    continuidadCritica: !!definition.continuidadCritica
  });

  merge(content, definition.overrides || {});
  return content;
}

export const sharedOptions = {
  generation: COMMON_GENERATION,
  tariff: COMMON_TARIFF,
  bill: COMMON_BILL
};
