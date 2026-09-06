import { createProfileContent, sharedOptions } from './diagnostico.profile.js';

export default createProfileContent({
  id: 'microred', label: 'Microredes y sitios remotos', route: '/diagnostico-microred',
  siteLabel: 'tu sitio', sectorQuestion: '¿Qué tipo de sitio remoto quieres evaluar?',
  sectors: [
    { codigo: 'mineria', label: 'Mina, cantera o campamento industrial', profileLabel: 'operación minera remota' },
    { codigo: 'agro', label: 'Agroindustria, rancho o instalación productiva remota', profileLabel: 'agroindustria remota' },
    { codigo: 'telecom', label: 'Telecomunicaciones o infraestructura distribuida', profileLabel: 'infraestructura remota distribuida' },
    { codigo: 'turismo_remoto', label: 'Eco-resort, alojamiento o servicio remoto', profileLabel: 'operación turística remota' },
    { codigo: 'comunidad', label: 'Comunidad, servicio público o proyecto aislado', profileLabel: 'servicio aislado' }
  ],
  intro: {
    titulo: 'Diagnóstico de microred y diésel en 2 minutos',
    cuerpo: 'Siete u ocho preguntas sobre red, consumo, combustible, continuidad y generación. Al final ves qué arquitectura híbrida conviene estudiar y qué datos faltan para dimensionarla.',
    pie: 'Sin costo y sin formulario: primero ves el diagnóstico.', cta: 'Empezar'
  },
  loadProfiles: [
    { codigo: 'plano', label: 'Carga esencial bastante pareja las 24 horas' },
    { codigo: 'diurno', label: 'La mayor actividad ocurre durante el día' },
    { codigo: 'picos', label: 'Motores o procesos crean picos intensos' },
    { codigo: 'punta', label: 'La carga se concentra por turnos o ventanas específicas' },
    { codigo: 'nolose', label: 'No contamos con medición del perfil' }
  ],
  generationQuestion: '¿Cómo se genera o compra hoy la energía del sitio?',
  generationOptions: sharedOptions.generation.map((o) => o.codigo === 'estacional'
    ? { ...o, label: 'Generamos de forma estacional o con una fuente local variable' }
    : o),
  propia: {
    key: 'fuente', notaLabel: 'Fuente actual y autonomía',
    pregunta: '¿Cuál es hoy tu fuente principal de energía y cuántas horas necesitas operar sin ella?',
    opciones: [
      { codigo: 'diesel_24h', label: 'Diésel o gas todo el día; necesitamos operar 24 horas' },
      { codigo: 'diesel_parcial', label: 'Diésel o gas algunas horas al día' },
      { codigo: 'red_debil', label: 'Red de CFE con cortes frecuentes' },
      { codigo: 'sin_energia', label: 'Hoy no hay suministro; es un sitio nuevo' },
      { codigo: 'nolose', label: 'No lo tengo claro' }
    ]
  },
  continuityLabel: 'Quedarnos sin energía nos cuesta producción o servicio',
  continuidadCritica: true,
  tariffQuestion: '¿Cómo se paga hoy la energía de tu sitio?',
  tariffHint: 'Si hay recibo de CFE, el código aparece en la carátula.',
  tariffOptions: [
    { label: 'CFE en media tensión horaria (GDMTH)', codigo: 'gdmth' },
    { label: 'CFE en media tensión ordinaria (GDMTO)', codigo: 'gdmto' },
    { label: 'CFE en baja tensión (GDBT o PDBT)', codigo: 'gdbt' },
    { label: 'Solo generamos con diésel o gas (sin CFE)', codigo: 'diesel' },
    { label: 'CFE y diésel combinados', codigo: 'mixto' },
    { label: 'Hoy no hay suministro eléctrico', codigo: 'sin_suministro' },
    { label: 'Suministrador privado o calificado', codigo: 'privado' },
    { label: 'No lo sé o no tengo recibo', codigo: 'nolose' }
  ],
  billQuestion: '¿Cuánto se gasta al mes en electricidad y combustible para generar?',
  billHint: 'Usa el total aproximado de energía; después separaremos diésel y red.',
  outageQuestion: 'Si el sitio pierde energía 30 minutos, ¿qué pasa?',
  outageOptions: [
    { codigo: 'producto', label: 'Se pierde producción, producto o material' },
    { codigo: 'reinicio', label: 'La operación se detiene y reiniciar toma horas' },
    { codigo: 'servicio', label: 'Se pierde comunicación, servicio o ingreso' },
    { codigo: 'nada', label: 'Las cargas pueden esperar sin costo relevante' }
  ],
  triggerOptions: [
    { codigo: 'capacidad', label: 'Necesitamos crecer y la red o generadores no alcanzan' },
    { codigo: 'diesel', label: 'Usamos diésel muchas horas y el combustible es costoso' },
    { codigo: 'excedente', label: 'Tenemos generación renovable que no aprovechamos' },
    { codigo: 'aislado', label: 'Operamos sin CFE o queremos independizarnos de la red' },
    { codigo: 'costo', label: 'La red es suficiente; solo queremos bajar costo', exclusiva: true }
  ],
  exposures: [
    { when: { disparador: 'aislado' }, text: 'que requiere autonomía sin red' },
    { when: { disparador: 'diesel' }, text: 'con dependencia económica de diésel' },
    { when: { calidad: 'variaciones' }, text: 'con red débil e inestable' }
  ],
  defaultExposure: 'con oportunidad de hibridar generación y almacenamiento',
  sectorEmphasis: {
    diesel: {}, off_grid: {}, respaldo: { mineria: 12, telecom: 14, comunidad: 12 },
    bess_solar: { agro: 10, turismo_remoto: 10, comunidad: 8 }
  },
  postResult: {
    label: 'Precisar mi microred', alwaysRoof: true,
    facturas: { titulo: 'Sube tus recibos o registros de energía', sub: 'Si tienes recibos de CFE o registros de consumo de combustible, súbelos. Es opcional.' }
  },
  emailVocabulary: {
    site: 'sitio remoto', technicalContact: 'responsable de generación o mantenimiento',
    documentos: {
      conectado: 'tus recibos de CFE de los últimos 12 meses y tus horas y costo de diésel',
      aislado: 'tu consumo diario (kWh), potencia pico (kW), litros y costo de diésel al mes, fuente actual y horas de autonomía'
    }
  },
  overrides: {
    sinRedPosible: true,
    financiamientoDefault: 'Una microred puede estructurarse como inversión propia o servicio, sujeto a viabilidad técnica, logística y crediticia. Primero se valida consumo, combustible, recurso renovable y autonomía requerida.',
    palancasRespaldoVariantes: {
      producto: 'Un corte se lleva producción, producto o material — el almacenamiento sostiene la carga esencial cuando la red o el generador fallan.',
      reinicio: 'Cada paro detiene la operación y reiniciar toma horas; el almacenamiento lo evita.',
      servicio: 'Cada hora sin energía es comunicación, servicio o ingreso perdido — el almacenamiento lo sostiene.'
    },
    // Sitios remotos pueden no tener CFE ni recibo: el andamiaje de datos habla de
    // consumo, combustible y autonomía, no de recibos de CFE.
    checklistBase: [
      'Consumo del sitio: kWh al día o al mes; y si hay red, tus recibos de los últimos 12 meses',
      'Horas de operación del diésel o generador y su costo aproximado de combustible'
    ],
    checklistRefuerzos: {
      horario: 'Ventanas y turnos de operación del sitio y, si hay medición, tu curva de carga por horario'
    },
    datoFaltante: [
      { when: { factura: 'nolose' }, text: 'Para volver esto un número exacto, el dato clave es el consumo de tu sitio (kWh al día o al mes) y, si usas diésel, sus horas y costo de combustible. Con eso dimensionamos la microred.' },
      { when: { tarifa: 'privado' }, text: 'El dato que define tu caso es la estructura de tu contrato de suministro — si tienes exposición a precios horarios del mercado, hay arbitraje; si es precio fijo, el margen se lo queda tu suministrador. Es la primera pregunta que resolvemos en la llamada.' }
    ],
    datoFaltanteDefault: 'El dato que vuelve esto exacto son tu consumo (kWh al día o al mes), tus horas y costo de diésel, y el recurso solar del sitio.',
    anteproyecto: {
      base: {
        interno: [
          'Consumo del sitio (kWh/día o mes) y, si hay red o recibo, tus últimos 12 meses.',
          'Perfil de carga u horario de operación del sitio.',
          'Generación actual: diésel (horas, consumo y costo) y/o solar en sitio.',
          'Superficie disponible en m² (techo o terreno) y horas de autonomía requeridas.',
          'Objetivo prioritario (autonomía, respaldo, costo o capacidad) y horizonte de decisión.'
        ],
        lead: [
          'Cuánta energía consume tu sitio (kWh al día o al mes), o tus recibos si tienes red.',
          'Si hoy usas diésel: cuántas horas al día y su costo aproximado.',
          'Cuánto espacio libre tienes (techo o terreno).',
          'Cuántas horas necesitas operar sin sol ni red.',
          'Quién autoriza una inversión así y hasta qué monto.'
        ]
      }
    }
  }
});
