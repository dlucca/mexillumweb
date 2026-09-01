import { createProfileContent } from './diagnostico.profile.js';

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
    cuerpo: 'Ocho preguntas sobre vehículos, horarios, potencia disponible y tarifa. Al final ves si conviene gestionar la carga, ampliar capacidad o evaluar BESS y Solar.',
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
  qualityQuestion: '¿Qué limita hoy el despliegue de tus cargadores?',
  qualityOptions: [
    { codigo: 'factor', label: 'La demanda o factor de potencia ya genera penalizaciones' },
    { codigo: 'variaciones', label: 'La calidad de energía afecta cargadores o equipos' },
    { codigo: 'cortes', label: 'La red tiene interrupciones frecuentes' },
    { codigo: 'no', label: 'La red es estable; el reto es potencia, horario o costo' },
    { codigo: 'nolose', label: 'Aún no tenemos estudio eléctrico' }
  ],
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
    recomendaciones: {
      bessCapacidad: { tipo: 'BESS para habilitar carga', razon: 'La potencia disponible y el crecimiento de cargadores mandan en tu caso. Un BESS puede limitar el pico y diferir la ampliación; primero se valida contra potencia, simultaneidad y ventanas de carga.' },
      bess: { tipo: 'BESS para gestionar carga', razon: 'Tu oportunidad está en controlar el pico que generan los cargadores y mover consumo fuera de los periodos caros. El dimensionamiento depende de potencia, simultaneidad y tiempo conectado.' }
    }
  }
});
