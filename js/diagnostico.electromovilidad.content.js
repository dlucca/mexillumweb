import { createProfileContent, sharedOptions } from './diagnostico.profile.js';

export default createProfileContent({
  id: 'electromovilidad', label: 'Electromovilidad', route: '/diagnostico-electromovilidad',
  siteLabel: 'tu operación de carga', sectorQuestion: '¿Qué tipo de operación de carga quieres evaluar?',
  sectors: [
    { codigo: 'flotilla', label: 'Flotilla propia — vehículos que regresan a un patio o base', profileLabel: 'flotilla con carga centralizada' },
    { codigo: 'pesado', label: 'Camiones, autobuses o transporte pesado', profileLabel: 'transporte pesado electrificado' },
    { codigo: 'publica', label: 'Centro o estación pública de carga', profileLabel: 'centro público de carga' },
    { codigo: 'inmueble', label: 'Carga para usuarios de un edificio, comercio o estacionamiento', profileLabel: 'carga integrada a un inmueble' },
    { codigo: 'expansion_ev', label: 'Proyecto nuevo o expansión importante de cargadores', profileLabel: 'proyecto de carga en expansión' }
  ],
  intro: {
    titulo: 'Diagnóstico para infraestructura de carga en 2 minutos',
    cuerpo: 'Siete u ocho preguntas sobre vehículos, horarios, potencia disponible y tarifa. Al final ves si conviene gestionar la carga, ampliar capacidad o evaluar BESS y Solar.',
    pie: 'Sin costo y sin formulario: primero ves el diagnóstico.', cta: 'Empezar'
  },
  loadProfiles: [
    { codigo: 'plano', label: 'Carga repartida durante casi todo el día' },
    { codigo: 'diurno', label: 'Principalmente durante el día o entre rutas' },
    { codigo: 'picos', label: 'Muchos vehículos cargan al mismo tiempo al regresar' },
    { codigo: 'punta', label: 'La carga coincide con el horario punta de CFE' },
    { codigo: 'nolose', label: 'Todavía no definimos horarios ni simultaneidad' }
  ],
  profileHint: 'Piensa cuándo llegan los vehículos y cuánto tiempo permanecen conectados.',
  generationOptions: sharedOptions.generation.filter((o) => o.codigo !== 'estacional'),
  propia: {
    key: 'gestion_carga', notaLabel: 'Gestión de la carga',
    pregunta: '¿Puedes mover o escalonar la carga de los vehículos?',
    hint: 'Piensa si los vehículos podrían cargar en otro horario o por turnos.',
    opciones: [
      { codigo: 'sistema', label: 'Sí, ya tenemos un sistema de gestión de carga (software)' },
      { codigo: 'manual', label: 'Podríamos reprogramar horarios, pero no tenemos sistema' },
      { codigo: 'fija', label: 'No, las ventanas de carga no se pueden mover' },
      { codigo: 'nolose', label: 'No lo sabemos todavía' }
    ]
  },
  condicional: {
    key: 'crecimiento', notaLabel: 'Crecimiento previsto',
    when: { disparador: 'capacidad' },
    pregunta: '¿Cuántos vehículos o kW de carga nuevos vienen en los próximos 12 meses?',
    opciones: [
      { codigo: 'pocos', label: 'Menos de 10 vehículos o menos de 100 kW' },
      { codigo: 'medios', label: 'Entre 10 y 50 vehículos, o 100 a 500 kW' },
      { codigo: 'muchos', label: 'Más de 50 vehículos o más de 500 kW' },
      { codigo: 'nolose', label: 'Aún no lo definimos' }
    ]
  },
  continuityLabel: 'Una interrupción de la carga nos cuesta rutas o servicio',
  outageQuestion: 'Si la carga programada se interrumpe 30 minutos, ¿qué ocurre?',
  outageOptions: [
    { codigo: 'producto', label: 'Vehículos críticos no completan ruta o servicio' },
    { codigo: 'reinicio', label: 'Se acumula carga y recuperar el programa toma horas' },
    { codigo: 'servicio', label: 'Perdemos ventas, disponibilidad o nivel de servicio' },
    { codigo: 'nada', label: 'Podemos reprogramar sin costo relevante' }
  ],
  triggerOptions: [
    { codigo: 'capacidad', label: 'La potencia disponible no alcanza o CFE tarda en ampliarla' },
    { codigo: 'diesel', label: 'Queremos evitar respaldo o generación con diésel' },
    { codigo: 'excedente', label: 'Tenemos Solar o marquesinas y queremos aprovechar excedentes' },
    { codigo: 'aislado', label: 'La carga estará en un sitio con red débil o sin red' },
    { codigo: 'costo', label: 'Solo queremos reducir demanda y costo de carga', exclusiva: true }
  ],
  exposures: [
    { when: { disparador: 'capacidad' }, text: 'con restricción de potencia para desplegar cargadores' },
    { when: { sector: 'pesado' }, text: 'con ventanas operativas exigentes' },
    { when: { perfil: 'picos' }, text: 'con alta simultaneidad de carga' }
  ],
  defaultExposure: 'con oportunidad de gestionar demanda y horarios',
  sectorEmphasis: {
    peak_shaving: { flotilla: 8, pesado: 10, publica: 9, expansion_ev: 7 },
    diferimiento: { flotilla: 12, pesado: 18, publica: 16, expansion_ev: 26 },
    bess_solar: { publica: 7, inmueble: 7 }, respaldo: { pesado: 7 }
  },
  postResult: { label: 'Precisar mi infraestructura de carga' },
  emailVocabulary: { site: 'operación de carga', technicalContact: 'responsable eléctrico o de infraestructura' },
  overrides: {
    palancasRespaldoVariantes: {
      producto: 'Un corte deja vehículos críticos sin completar ruta o servicio — el respaldo mantiene la carga en el momento clave.',
      reinicio: 'Cada interrupción acumula carga y recuperar el programa toma horas; el respaldo lo evita.',
      servicio: 'Cada hora sin carga es venta, disponibilidad o nivel de servicio perdido — el respaldo lo sostiene.'
    },
    frenos: [
      {
        id: 'gestion_carga_primero',
        when: { gestion_carga: 'manual' },
        anyOf: [{ disparador: 'capacidad' }, { perfil: 'picos' }],
        tipo: 'Gestión de carga primero',
        razon: 'Tus vehículos podrían cargar en otro horario o por turnos y hoy no hay un sistema que lo haga. Escalonar y limitar la carga con software suele bajar el pico sin comprar baterías. Primero se valida eso; el BESS entra después, si el pico que queda sigue siendo caro o falta potencia.',
        despues: 'bess',
        requisitos: ['gestion_carga', 'perfil'],
        anteproyecto: {
          interno: ['Ventanas de llegada y salida de los vehículos, y tiempo mínimo conectado.', 'Potencia de cada cargador y simultaneidad real observada.'],
          lead: ['A qué horas llegan y salen los vehículos.', 'Cuántos cargadores tienes y de qué potencia.']
        }
      }
    ],
    recomendaciones: {
      bessCapacidad: { tipo: 'BESS para habilitar carga', razon: 'La potencia disponible y el crecimiento de cargadores mandan en tu caso. Un BESS puede limitar el pico y diferir la ampliación; primero se valida contra potencia, simultaneidad y ventanas de carga.' },
      bess: { tipo: 'BESS para gestionar carga', razon: 'Tu oportunidad está en controlar el pico que generan los cargadores y mover consumo fuera de los periodos caros. El dimensionamiento depende de potencia, simultaneidad y tiempo conectado.' }
    }
  }
});
