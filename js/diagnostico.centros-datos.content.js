import { createProfileContent, sharedOptions } from './diagnostico.profile.js';

export default createProfileContent({
  id: 'centros_datos', label: 'Centros de datos', route: '/diagnostico-centros-datos',
  siteLabel: 'tu centro de datos', sectorQuestion: '¿Qué tipo de instalación quieres evaluar?',
  sectors: [
    { codigo: 'enterprise_dc', label: 'Centro de datos empresarial', profileLabel: 'centro de datos empresarial' },
    { codigo: 'colo', label: 'Colocation o campus multiusuario', profileLabel: 'centro de datos de colocation' },
    { codigo: 'edge', label: 'Edge data center o instalación distribuida', profileLabel: 'infraestructura edge' },
    { codigo: 'expansion_dc', label: 'Expansión de capacidad existente', profileLabel: 'centro de datos en expansión' },
    { codigo: 'greenfield_dc', label: 'Proyecto nuevo / greenfield', profileLabel: 'nuevo centro de datos' }
  ],
  intro: {
    titulo: 'Diagnóstico energético para centros de datos',
    cuerpo: 'Ocho preguntas sobre carga, redundancia, continuidad, capacidad y tarifa. El resultado identifica qué arquitectura merece un estudio especializado; no sustituye la revisión del unifilar y los sistemas UPS.',
    pie: 'Orientación preliminar y confidencial. Sin formulario para ver el resultado.', cta: 'Empezar'
  },
  loadProfiles: [
    { codigo: 'plano', label: 'Carga IT y enfriamiento bastante estables 24/7' },
    { codigo: 'diurno', label: 'La carga crece durante el horario operativo' },
    { codigo: 'picos', label: 'Hay rampas o picos por cómputo, IA o enfriamiento' },
    { codigo: 'punta', label: 'La mayor demanda coincide con horario punta' },
    { codigo: 'nolose', label: 'Solo tenemos capacidad nominal, no curva de carga' }
  ],
  profileHint: 'Usa la carga total del sitio, incluyendo enfriamiento e infraestructura.',
  generationOptions: sharedOptions.generation.filter((o) => o.codigo !== 'estacional'),
  qualityQuestion: '¿Cuál es la principal señal de calidad o continuidad?',
  qualityOptions: [
    { codigo: 'factor', label: 'Penalización o gestión de potencia reactiva' },
    { codigo: 'variaciones', label: 'Variaciones que exigen intervención de UPS o protecciones' },
    { codigo: 'cortes', label: 'Interrupciones o transferencias frecuentes a generadores' },
    { codigo: 'no', label: 'La red es estable; el reto es capacidad, costo o sostenibilidad' },
    { codigo: 'nolose', label: 'Aún no contamos con estudio de calidad' }
  ],
  outageQuestion: 'Si falla la alimentación de red durante 30 minutos, ¿qué implica?',
  outageOptions: [
    { codigo: 'producto', label: 'Riesgo de pérdida de datos o incumplimiento crítico' },
    { codigo: 'reinicio', label: 'La recuperación operativa sería compleja y prolongada' },
    { codigo: 'servicio', label: 'Se comprometen SLA, disponibilidad o ingresos' },
    { codigo: 'nada', label: 'La arquitectura actual cubre el evento sin impacto relevante' }
  ],
  triggerOptions: [
    { codigo: 'capacidad', label: 'La capacidad de red limita expansión o entrada en operación' },
    { codigo: 'diesel', label: 'Queremos reducir pruebas u operación de generadores' },
    { codigo: 'excedente', label: 'Tenemos metas renovables o generación que queremos firmar' },
    { codigo: 'aislado', label: 'Buscamos mayor independencia o capacidad de isla' },
    { codigo: 'costo', label: 'La prioridad es costo y demanda, sin cambiar redundancia', exclusiva: true }
  ],
  exposures: [
    { when: { disparador: 'capacidad' }, text: 'con restricción de capacidad para crecer' },
    { when: { calidad: 'cortes' }, text: 'con transferencias frecuentes a respaldo' },
    { when: { sector: 'colo' }, text: 'con carga crítica continua y compromisos de disponibilidad' }
  ],
  defaultExposure: 'con carga crítica continua y exigencia de redundancia',
  sectorEmphasis: {
    arbitraje: { enterprise_dc: 8, colo: 12, edge: 7 },
    respaldo: { enterprise_dc: 16, colo: 18, edge: 14, expansion_dc: 15, greenfield_dc: 12 },
    diferimiento: { expansion_dc: 26, greenfield_dc: 20 },
    peak_shaving: { colo: 8, expansion_dc: 8 }
  },
  postResult: { label: 'Solicitar revisión especializada', skipRoof: true, servicePoint: true },
  emailVocabulary: { site: 'centro de datos', technicalContact: 'responsable de facilities o ingeniería eléctrica' },
  overrides: {
    gancho: 'La mayoría de los centros de datos no dimensiona cuánto de su costo y su riesgo vive en la arquitectura de respaldo y en el límite de capacidad de su acometida. Eso es exactamente lo primero que revisamos.',
    palancasRespaldoVariantes: {
      producto: 'Un corte pone en riesgo datos y cumplimiento crítico — el respaldo sostiene la carga en el instante en que la red falla.',
      reinicio: 'Recuperar la operación tras un evento es complejo y prolongado; el respaldo evita ese paro.',
      servicio: 'Cada minuto sin energía compromete SLA, disponibilidad e ingresos — el respaldo lo sostiene.'
    },
    recomendaciones: {
      bessRespaldo: { tipo: 'Estudio BESS de misión crítica', razon: 'La continuidad domina el caso, pero la integración depende de UPS, generadores, ATS, protecciones y redundancia. La recomendación permanece preliminar hasta revisar el unifilar y la arquitectura de respaldo.' },
      bessCapacidad: { tipo: 'BESS para capacidad crítica', razon: 'La expansión está limitada por potencia disponible. Un BESS puede evaluarse para diferir capacidad sin comprometer redundancia, sujeto a revisar carga IT, UPS, protecciones y fecha objetivo.' },
      bess: { tipo: 'Estudio BESS especializado', razon: 'Existe una oportunidad potencial en demanda o arbitraje, pero cualquier integración debe validarse contra la arquitectura UPS, generadores y criterios de misión crítica.' }
    }
  }
});
