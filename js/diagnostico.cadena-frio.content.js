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
    cuerpo: 'Siete u ocho preguntas sobre refrigeración, compresores, continuidad, tarifa y factura. Al final ves qué combinación de ahorro y respaldo merece estudiarse primero.',
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
  propia: {
    key: 'compresores', notaLabel: 'Compresores y control',
    pregunta: '¿Cómo están tus compresores y su control?',
    opciones: [
      { codigo: 'viejos_sin_control', label: 'Más de 15 años o sin control de capacidad (arrancan y paran a tope)' },
      { codigo: 'modernos_con_control', label: 'Recientes, con variadores o control de capacidad' },
      { codigo: 'mixto', label: 'Una mezcla de equipos viejos y nuevos' },
      { codigo: 'nolose', label: 'No lo sé' }
    ]
  },
  continuityLabel: 'Un corte pone en riesgo temperatura o producto',
  continuidadCritica: true,
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
    },
    frenos: [
      {
        id: 'eficiencia_primero',
        when: { compresores: 'viejos_sin_control', perfil: ['picos', 'diurno', 'plano'] },
        tipo: 'Eficiencia en refrigeración primero',
        razon: 'Tus compresores son viejos o no tienen control de capacidad. Modernizar el control (variadores, secuenciación, deshielo programado) suele bajar el consumo y el pico más barato que almacenar energía. Primero se valida eso; el BESS entra después, sobre el pico que quede.',
        despues: 'bess',
        requisitos: ['compresores', 'perfil'],
        anteproyecto: {
          interno: ['Inventario de compresores: capacidad, edad y tipo de control.', 'Registro de temperatura y ciclos de deshielo.'],
          lead: ['Cuántos compresores tienes y qué edad tienen.', 'Si sabes cuándo hacen deshielo las cámaras.']
        }
      }
    ]
  }
});
