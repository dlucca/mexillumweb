// Todo el copy y las reglas del funnel, como datos. Cambiar contenido o reordenar
// prioridades = editar este archivo. Sin lógica: engine.js lee de acá.
// Copy cerrado del PRD v1.0 (§4–§7), con el label de Capa C corregido (spec §4.1).

const content = {
  pasos: [
    {
      key: 'tipo_instalacion',
      pregunta: '¿Cómo describirías tu operación?',
      opciones: [
        { label: 'Planta industrial o manufactura', codigo: 'industrial' },
        { label: 'Comercial, institucional o edificio corporativo', codigo: 'comercial' },
        { label: 'Entidad pública (transporte, agua, municipio)', codigo: 'publico' },
        { label: 'Estación de carga para flotas eléctricas', codigo: 'ev' }
      ]
    },
    {
      key: 'generacion_propia',
      pregunta: '¿Ya generan o contratan energía renovable hoy?',
      opciones: [
        { label: 'No, todo nuestro suministro es de CFE', codigo: 'ninguna' },
        { label: 'Sí, tenemos paneles solares o generación propia en sitio', codigo: 'fisica' },
        { label: 'Sí, pero es un contrato o certificado con un proveedor (no generamos físicamente)', codigo: 'certificada' },
        { label: 'Depende de la temporada (ej. generamos con biomasa o cogeneración parte del año)', codigo: 'estacional' }
      ]
    },
    {
      key: 'patron_operacion',
      pregunta: '¿Tu operación se detiene en algún momento, o corre todo el día, todos los días?',
      opciones: [
        { label: 'Corre 24/7, sin pausas', codigo: 'continuo' },
        { label: 'Tiene picos marcados por turno, proceso o temporada', codigo: 'picos' },
        { label: 'Es intermitente — varía mucho según el día o la hora', codigo: 'intermitente' }
      ]
    },
    {
      key: 'interrupciones',
      pregunta: 'En el último año, ¿un corte o falla eléctrica les afectó producción, producto o servicio?',
      opciones: [
        { label: 'Sí, y sabemos cuánto nos costó', codigo: 'si_medido' },
        { label: 'Sí, pero nunca lo medimos', codigo: 'si_no_medido' },
        { label: 'No que sepamos', codigo: 'no' },
        { label: 'No aplica a nuestra operación', codigo: 'no_aplica' }
      ]
    },
    {
      key: 'diesel_red_debil',
      pregunta: '¿Alguna parte de tu operación depende de diésel, o está en una zona con suministro eléctrico poco confiable?',
      opciones: [
        { label: 'Sí', codigo: 'si' },
        { label: 'No', codigo: 'no' },
        { label: 'No estoy seguro', codigo: 'no_seguro' }
      ]
    },
    {
      key: 'exporta_excedente',
      pregunta: '¿Generan energía propia y les sobra — la venden o la exportan a la red?',
      opciones: [
        { label: 'Sí', codigo: 'si' },
        { label: 'No', codigo: 'no' },
        { label: 'No aplica', codigo: 'no_aplica' }
      ]
    }
  ],

  // Capa A — prioridad = orden del array. Primera que matchea gana. (§6.1)
  reglasA: [
    { id: 'estacional', when: { generacion_propia: 'estacional' }, text: 'Tu generación cubre parte del año. Te ayudamos a cubrir el resto — con la ventaja de que ese periodo suele coincidir con mayor disponibilidad de sol.' },
    { id: 'fisica', when: { generacion_propia: 'fisica' }, text: 'Ya generás tu propia energía. Te ayudamos a aprovechar cada kWh — en vez de perder lo que generás cuando no coincide con lo que necesitás.' },
    { id: 'continuo', when: { patron_operacion: 'continuo' }, text: 'Tu operación no se detiene, así que compra energía en el horario más caro todos los días sin poder evitarlo. Podemos cambiar eso.' },
    { id: 'picos', when: { patron_operacion: 'picos' }, text: 'La mayoría de las operaciones paga de más por unos minutos al mes — su momento de mayor consumo. Vale la pena revisar si ese es tu caso.' },
    { id: 'intermitente', when: { patron_operacion: 'intermitente' }, text: 'Tu consumo es variable, lo que suele esconder picos que encarecen toda tu factura sin que se note en el día a día.' }
  ],

  // Capa B — refuerzo, máximo 1. Prioridad = orden. (§6.2)
  reglasB: [
    { id: 'diesel', when: { diesel_red_debil: 'si' }, text: 'Además, sustituir diésel por almacenamiento no solo es más limpio — suele ser bastante más barato por hora operada.' },
    { id: 'int_medido', when: { interrupciones: 'si_medido' }, text: 'Y ya tenés el dato más difícil de conseguir: cuánto te cuesta cuando falla la energía. Ese número es el que arma el proyecto.' },
    { id: 'int_no_medido', when: { interrupciones: 'si_no_medido' }, text: 'Ese tipo de interrupciones casi nunca se mide — y suele ser más caro de lo que parece. Es de las primeras cosas que podemos ayudarte a cuantificar.' },
    { id: 'exporta', when: { exporta_excedente: 'si' }, text: 'Y si ya exportás excedente, hay margen para que valga más según a qué hora lo vendés.' }
  ],

  // Capa C — cierre por segmento. ctaText ya corregido (spec §4.1). (§6.3)
  capaC: {
    industrial: { texto: 'Protegé tu margen operativo y reducí tu exposición eléctrica — sin inversión de capital inicial.', ctaText: 'Quiero agendar mi diagnóstico' },
    comercial: { texto: 'Reducí tu costo energético y la exposición de tu operación a fallas eléctricas — sin desembolso inicial.', ctaText: 'Quiero agendar mi diagnóstico' },
    publico: { texto: 'Cero inversión, cero deuda, cero riesgo — protegé la continuidad de tu servicio sin comprometer presupuesto.', ctaText: 'Quiero agendar una conversación' },
    ev: { texto: 'Evitá esperar meses (o años) para ampliar tu capacidad eléctrica — y controlá el costo de tus picos de carga rápida.', ctaText: 'Quiero agendar mi diagnóstico' }
  },

  // Checklist base — keyed por id de reglasA (mismo selector de prioridad). (§7.1)
  checklistBase: {
    estacional: [
      'Fechas de tu temporada alta y temporada baja',
      'Recibos de CFE de la temporada baja (si los tenés a mano)'
    ],
    fisica: [
      'Capacidad instalada y fecha en que empezó a operar',
      'Una idea de cuánta energía generada no se está aprovechando (aunque sea aproximada)'
    ],
    continuo: [
      'Recibos de CFE con desglose por horario, si tu factura lo muestra',
      'Tu tarifa aplicable, si la conocés (por ejemplo GDMTH o DIST)',
      'Si hay algo de tu consumo que sí podrías mover de horario'
    ],
    picos: [
      'Tus últimos recibos de CFE (6–12 meses)',
      'Algún registro de consumo por intervalos de 15 minutos, si lo tenés (aunque sea de un mes)',
      'A qué hora o en qué proceso ocurre tu momento de mayor consumo'
    ],
    intermitente: [
      'Tus últimos recibos de CFE (6–12 meses)',
      'Qué días o meses tienden a ser los de mayor consumo'
    ]
  },

  // Refuerzos del checklist — prioridad = orden. Mismas condiciones que Capa B. (§7.2)
  checklistRefuerzos: [
    { id: 'diesel', when: { diesel_red_debil: 'si' }, bullet: 'Cuántas horas al año corre tu respaldo de diésel y costo aproximado' },
    { id: 'int_medido', when: { interrupciones: 'si_medido' }, bullet: 'El registro que ya tenés de esos eventos: cuántos y qué costaron' },
    { id: 'int_no_medido', when: { interrupciones: 'si_no_medido' }, bullet: 'Una estimación aproximada — no hace falta precisión, con "más o menos X veces el año pasado" alcanza' },
    { id: 'exporta', when: { exporta_excedente: 'si' }, bullet: 'Cómo vendés ese excedente hoy: contrato, tarifa y a quién' }
  ],

  checklistUniversal: 'Quién en tu organización tomaría la decisión de un proyecto así', // §7.3
  checklistTitulo: 'Antes de tu llamada, te sirve tener a mano:', // §7.5
  checklistPie: 'No hace falta tenerlo todo listo — con lo que tengas alcanza para empezar.', // §7.5

  gate: {
    intro: [
      'Con base en tus respuestas, identificamos una oportunidad relevante para proteger tu operación y reducir tu exposición eléctrica — sin inversión de capital inicial.',
      'Déjanos tus datos y te enviamos el diagnóstico completo.'
    ],
    campos: [
      { name: 'nombre', label: 'Nombre', required: true, type: 'text', autocomplete: 'name' },
      { name: 'empresa', label: 'Empresa', required: true, type: 'text', autocomplete: 'organization' },
      { name: 'correo', label: 'Correo', required: true, type: 'email', autocomplete: 'email' },
      { name: 'telefono', label: 'Teléfono (opcional)', required: false, type: 'tel', autocomplete: 'tel' },
      { name: 'cargo', label: 'Cargo (opcional)', required: false, type: 'text', autocomplete: 'organization-title' }
    ]
  },

  resultado: { reiniciar: 'Reiniciar diagnóstico' },
  progresoLabel: (n, total) => `Paso ${n} de ${total}`
};

export default content;
