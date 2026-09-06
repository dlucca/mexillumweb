import { createProfileContent } from './diagnostico.profile.js';

export default createProfileContent({
  id: 'bombeo', label: 'Bombeo de agua', route: '/diagnostico-bombeo',
  siteLabel: 'tu sistema de bombeo', sectorQuestion: '¿Qué tipo de sistema de bombeo quieres evaluar?',
  sectors: [
    { codigo: 'pozo', label: 'Pozo profundo o captación', profileLabel: 'sistema de captación por pozo' },
    { codigo: 'rebombeo', label: 'Conducción, distribución o rebombeo', profileLabel: 'sistema de rebombeo' },
    { codigo: 'tratamiento', label: 'Planta de tratamiento de agua o aguas residuales', profileLabel: 'planta de tratamiento' },
    { codigo: 'riego', label: 'Riego agrícola', profileLabel: 'sistema de riego' },
    { codigo: 'bombeo_ind', label: 'Bombeo dentro de una instalación industrial', profileLabel: 'bombeo industrial' }
  ],
  intro: {
    titulo: 'Diagnóstico energético para bombeo en 2 minutos',
    cuerpo: 'Siete u ocho preguntas sobre bombas, horarios, almacenamiento de agua, tarifa y continuidad. Al final ves si conviene optimizar operación, integrar Solar o evaluar almacenamiento eléctrico.',
    pie: 'Sin costo y sin formulario: primero ves el diagnóstico.', cta: 'Empezar'
  },
  loadProfiles: [
    { codigo: 'plano', label: 'Las bombas operan casi continuamente' },
    { codigo: 'diurno', label: 'El bombeo ocurre principalmente durante el día' },
    { codigo: 'picos', label: 'Varias bombas arrancan juntas y crean picos' },
    { codigo: 'punta', label: 'Se bombea en horarios caros por necesidad operativa' },
    { codigo: 'nolose', label: 'No tenemos horarios o medición claros' }
  ],
  profileHint: 'Considera pozos, conducción, rebombeo, tratamiento y distribución.',
  propia: {
    key: 'hidraulica', notaLabel: 'Almacenamiento hidráulico',
    pregunta: '¿Tienes tanque o almacenamiento de agua, y bombeas con horario?',
    opciones: [
      { codigo: 'tanque_sin_horario', label: 'Hay tanque, pero bombeamos cuando hace falta, sin programar' },
      { codigo: 'tanque_programado', label: 'Hay tanque y ya bombeamos en horario barato' },
      { codigo: 'sin_tanque', label: 'No hay almacenamiento; bombeamos directo a la demanda' },
      { codigo: 'nolose', label: 'No lo sé' }
    ]
  },
  continuityLabel: 'Un paro del bombeo nos cuesta servicio, cultivo o proceso',
  outageQuestion: 'Si el bombeo se detiene 30 minutos en el peor momento, ¿qué pasa?',
  outageOptions: [
    { codigo: 'producto', label: 'Se compromete proceso, cultivo o calidad del agua' },
    { codigo: 'reinicio', label: 'Recuperar niveles, presión o proceso toma horas' },
    { codigo: 'servicio', label: 'Se interrumpe el servicio a usuarios o producción' },
    { codigo: 'nada', label: 'Los tanques permiten esperar sin impacto relevante' }
  ],
  triggerOptions: [
    { codigo: 'capacidad', label: 'Necesitamos más caudal o bombas y falta capacidad eléctrica' },
    { codigo: 'diesel', label: 'Operamos bombas con diésel o planta de emergencia' },
    { codigo: 'excedente', label: 'Tenemos Solar o potencial solar para bombear' },
    { codigo: 'aislado', label: 'El bombeo está en un sitio aislado o con red débil' },
    { codigo: 'costo', label: 'Solo queremos reducir costo y demanda', exclusiva: true }
  ],
  exposures: [
    { when: { perfil: 'picos' }, text: 'con arranques y picos de motores' },
    { when: { perfil: 'punta' }, text: 'con bombeo concentrado en horario caro' },
    { when: { disparador: 'capacidad' }, text: 'con restricción para aumentar caudal' }
  ],
  defaultExposure: 'con oportunidad de programar bombeo y reducir demanda',
  sectorEmphasis: {
    peak_shaving: { pozo: 7, rebombeo: 9, tratamiento: 8, riego: 5, bombeo_ind: 8 },
    arbitraje: { pozo: 7, rebombeo: 8, riego: 9 },
    solar_puro: { riego: 12, pozo: 8 },
    diferimiento: { rebombeo: 8, tratamiento: 8 }
  },
  postResult: { label: 'Precisar mi sistema de bombeo' },
  emailVocabulary: { site: 'sistema de bombeo', technicalContact: 'responsable hidráulico o electromecánico' },
  overrides: {
    palancasRespaldoVariantes: {
      producto: 'Un corte compromete el proceso, el cultivo o la calidad del agua — la batería sostiene el bombeo en el momento crítico.',
      reinicio: 'Cada paro obliga a recuperar niveles y presión durante horas; la batería evita esa pérdida.',
      servicio: 'Cada hora sin bombeo interrumpe el servicio a usuarios o la producción — la batería lo sostiene.'
    },
    frenos: [
      {
        id: 'optimizacion_hidraulica_primero',
        when: { hidraulica: 'tanque_sin_horario', perfil: ['picos', 'punta'] },
        tipo: 'Optimización hidráulica primero',
        razon: 'Tienes tanque y bombeas sin horario. Programar el bombeo para llenar en horas baratas y usar variadores para escalonar arranques suele mover el consumo fuera del pico sin baterías. Primero se valida eso; el BESS entra después, si el pico que queda sigue siendo caro.',
        despues: 'bess',
        requisitos: ['hidraulica', 'perfil'],
        anteproyecto: {
          interno: ['Volumen del tanque, niveles mínimo y máximo, y caudal de las bombas.', 'Horario de demanda de agua y si hay variadores instalados.'],
          lead: ['Cuánta agua guarda tu tanque y cuánto tarda en llenarse.', 'A qué horas se necesita más agua.']
        }
      }
    ]
  }
});
