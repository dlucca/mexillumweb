import { createProfileContent } from './diagnostico.profile.js';

export default createProfileContent({
  id: 'cadena_frio', label: 'Cadena de frío y alimentos', route: '/diagnostico-cadena-frio',
  siteLabel: 'tu instalación', sectorQuestion: '¿Qué tipo de instalación quieres evaluar?',
  sectors: [
    { codigo: 'cedis_frio', label: 'Almacén refrigerado o CEDIS de cadena de frío', profileLabel: 'almacén refrigerado' },
    { codigo: 'alimentos', label: 'Planta de procesamiento de alimentos', profileLabel: 'planta de alimentos' },
    { codigo: 'bebidas', label: 'Planta de bebidas, hielo o embotellado', profileLabel: 'planta de bebidas' },
    { codigo: 'lacteos', label: 'Lácteos, congelados o producto de temperatura crítica', profileLabel: 'operación de temperatura crítica' },
    { codigo: 'supermercado', label: 'Supermercado o red de tiendas con refrigeración', profileLabel: 'comercio con refrigeración intensiva' }
  ],
  intro: {
    titulo: 'Diagnóstico energético para cadena de frío en 2 minutos',
    cuerpo: 'Ocho preguntas sobre refrigeración, compresores, continuidad, tarifa y factura. Al final ves qué combinación de ahorro y respaldo merece estudiarse primero.',
    pie: 'Sin costo y sin formulario: primero ves el diagnóstico.', cta: 'Empezar'
  },
  loadProfiles: [
    { codigo: 'plano', label: 'Refrigeración bastante pareja las 24 horas' },
    { codigo: 'diurno', label: 'Sube con producción, recibo de mercancía o temperatura exterior' },
    { codigo: 'picos', label: 'Hay arranques simultáneos, deshielos o compresores que crean picos' },
    { codigo: 'punta', label: 'El mayor consumo coincide con el horario punta de CFE' },
    { codigo: 'nolose', label: 'No tenemos separado el consumo de refrigeración' }
  ],
  profileHint: 'Considera compresores, evaporadores, condensadores y ciclos de deshielo.',
  qualityQuestion: '¿Reconoces alguno de estos problemas eléctricos?',
  qualityOptions: [
    { codigo: 'factor', label: 'Penalización por bajo factor de potencia' },
    { codigo: 'variaciones', label: 'Variaciones que disparan protecciones o dañan controles' },
    { codigo: 'cortes', label: 'Microcortes o interrupciones que ponen en riesgo temperatura' },
    { codigo: 'no', label: 'El suministro es estable' },
    { codigo: 'nolose', label: 'No lo sabemos o no está medido' }
  ],
  outageQuestion: 'Si la instalación pierde energía 30 minutos en el peor momento, ¿qué pasa?',
  outageOptions: [
    { codigo: 'producto', label: 'Se compromete temperatura, inocuidad o producto' },
    { codigo: 'reinicio', label: 'Reiniciar compresores y recuperar temperatura toma horas' },
    { codigo: 'servicio', label: 'Se frena despacho, producción o venta' },
    { codigo: 'nada', label: 'La inercia térmica permite continuar sin pérdida relevante' }
  ],
  triggerOptions: [
    { codigo: 'capacidad', label: 'Queremos ampliar cámaras o producción y falta capacidad eléctrica' },
    { codigo: 'diesel', label: 'La refrigeración depende con frecuencia de planta de emergencia' },
    { codigo: 'excedente', label: 'Tenemos Solar y no aprovechamos toda la generación' },
    { codigo: 'aislado', label: 'La instalación opera con red débil o de forma aislada' },
    { codigo: 'costo', label: 'Solo buscamos bajar el costo de energía y demanda', exclusiva: true }
  ],
  exposures: [
    { when: { corte: 'producto' }, text: 'con producto y temperatura críticos' },
    { when: { perfil: 'picos' }, text: 'con picos de compresores y deshielo' },
    { when: { disparador: 'capacidad' }, text: 'con restricción para ampliar refrigeración' }
  ],
  defaultExposure: 'con carga térmica continua y exposición a demanda',
  sectorEmphasis: {
    peak_shaving: { cedis_frio: 8, alimentos: 7, bebidas: 8, lacteos: 8, supermercado: 6 },
    arbitraje: { cedis_frio: 10, lacteos: 9 },
    respaldo: { cedis_frio: 14, alimentos: 12, lacteos: 16, supermercado: 10 },
    bess_solar: { supermercado: 8, alimentos: 6 }
  },
  postResult: { label: 'Precisar mi proyecto de frío' },
  emailVocabulary: { site: 'instalación refrigerada', technicalContact: 'responsable de refrigeración o mantenimiento' },
  overrides: {
    palancasRespaldoVariantes: {
      producto: 'Un corte pone en riesgo temperatura, inocuidad y producto; el respaldo se valora contra esa pérdida evitable.',
      reinicio: 'La continuidad evita paros de compresores y horas de recuperación térmica.',
      servicio: 'La energía sostiene producción, despacho y venta durante una interrupción.'
    }
  }
});
