// Todo el copy y las reglas del funnel v2, como datos. Cambiar contenido o reordenar
// prioridades = editar este archivo. Sin lógica: engine.js lee de acá. Copy es-MX (tuteo).

const content = {
  intro: {
    titulo: 'Diagnóstico energético en 2 minutos',
    cuerpo: 'Ocho preguntas sobre tu operación. Al final vas a ver qué palancas de ahorro aplican a tu caso, un rango estimado de lo que hay en juego, y qué datos preparar para volverlo un número exacto.',
    pie: 'Sin costo. Sin compromiso.',
    cta: 'Empezar'
  },

  pasos: [
    {
      key: 'sector', notaLabel: 'Sector / operación',
      pregunta: '¿Cómo describirías tu operación?',
      opciones: [
        { label: 'Proceso continuo 24/7 (alimentos, minería, química, papel, agua)', codigo: 'continuo' },
        { label: 'Manufactura por turnos o por lotes', codigo: 'manufactura' },
        { label: 'Frío y logística (cadena de frío, CEDIS, hielo)', codigo: 'frio' },
        { label: 'Infraestructura pública o servicios (transporte, agua, edificios)', codigo: 'publico' },
        { label: 'Carga de vehículos eléctricos', codigo: 'ev' }
      ]
    },
    {
      key: 'perfil', notaLabel: 'Perfil de carga / horario',
      pregunta: 'Pensando en un día típico de tu operación, ¿cómo se comporta el consumo eléctrico?',
      hint: 'No necesitas números — elige la opción que mejor lo describa.',
      opciones: [
        { label: 'Bastante parejo las 24 horas — la operación no para (proceso continuo)', codigo: 'plano' },
        { label: 'Sube durante el día y baja de noche (turno diurno u horario de oficina)', codigo: 'diurno' },
        { label: 'Tiene picos cortos e intensos (arranques de motores, cargas puntuales)', codigo: 'picos' },
        { label: 'Se concentra en la tarde-noche, entre las 6 y las 10 pm', codigo: 'punta' },
        { label: 'No lo tengo claro', codigo: 'nolose' }
      ]
    },
    {
      key: 'generacion', notaLabel: 'Generación propia',
      pregunta: '¿Generan parte de su propia energía?',
      opciones: [
        { label: 'No, compramos todo de CFE o de un suministrador', codigo: 'no' },
        { label: 'Sí — solar o contrato renovable vigente', codigo: 'fisica' },
        { label: 'Generamos parte del año (cogeneración, zafra, estacional)', codigo: 'estacional' },
        { label: 'Lo estamos evaluando', codigo: 'evaluando' }
      ]
    },
    {
      key: 'calidad', notaLabel: 'Calidad eléctrica',
      pregunta: '¿Reconoces problemas de calidad o confiabilidad eléctrica en tu operación?',
      opciones: [
        { label: 'Sí — nos penalizan por bajo factor de potencia en el recibo', codigo: 'factor' },
        { label: 'Sí — variaciones de voltaje, parpadeos o daño a equipos sensibles', codigo: 'variaciones' },
        { label: 'Sí — microcortes o interrupciones frecuentes de CFE', codigo: 'cortes' },
        { label: 'No, el suministro es estable', codigo: 'no' },
        { label: 'No lo sé', codigo: 'nolose' }
      ]
    },
    {
      key: 'tarifa', notaLabel: 'Tarifa CFE',
      pregunta: 'Busca el recibo de CFE de {planta}. Arriba a la derecha hay un código de tarifa — ¿cuál es?',
      opciones: [
        { label: 'GDMTH', codigo: 'gdmth' },
        { label: 'DIST o DIT', codigo: 'dist' },
        { label: 'Otra / PDBT', codigo: 'otra' },
        { label: 'No tengo el recibo a la mano', codigo: 'nolose' },
        { label: 'No compramos a CFE (suministrador privado)', codigo: 'privado' }
      ]
    },
    {
      key: 'factura', notaLabel: 'Factura mensual',
      pregunta: 'De {planta}: ¿cuánto paga de electricidad al mes?',
      hint: 'Solo lo usamos para estimar el rango — nada se comparte.',
      opciones: [
        { label: 'Menos de $200,000 MXN', codigo: 'bajo' },
        { label: '$200,000 – $1,000,000', codigo: 'medio' },
        { label: '$1,000,000 – $5,000,000', codigo: 'alto' },
        { label: 'Más de $5,000,000', codigo: 'muyalto' },
        { label: 'No lo tengo a la mano', codigo: 'nolose' }
      ]
    },
    {
      key: 'corte', notaLabel: 'Impacto de un corte',
      pregunta: 'Si a {planta} se le corta la energía 30 minutos en su peor momento del día, ¿qué pasa?',
      opciones: [
        { label: 'Se pierde producto o un lote completo', codigo: 'producto' },
        { label: 'Se detiene producción y reiniciar toma horas', codigo: 'reinicio' },
        { label: 'Perdemos servicio o ingresos por hora', codigo: 'servicio' },
        { label: 'Incomoda, pero no cuesta dinero relevante', codigo: 'nada' }
      ]
    },
    {
      key: 'disparador', notaLabel: 'Disparador',
      pregunta: '¿Reconoces alguna de estas situaciones?',
      opciones: [
        { label: 'Queremos crecer o ampliar carga, y CFE no da capacidad (o tarda)', codigo: 'capacidad' },
        { label: 'Usamos diésel o planta de emergencia con frecuencia', codigo: 'diesel' },
        { label: 'Generamos excedente que exportamos o se desperdicia', codigo: 'excedente' },
        { label: 'Ninguna — nuestro tema es puramente el costo', codigo: 'costo' }
      ]
    }
  ],

  gate: {
    titulo: 'Tu diagnóstico está listo.',
    cuerpo: 'Déjanos tus datos y elige un horario. Coordinamos una llamada para revisar tu diagnóstico a fondo y lo adjuntamos automáticamente a la reunión.',
    cta: 'Enviar mis datos',
    okMsg: '¡Listo! Recibimos tus datos. Elige un horario abajo para agendar la llamada.',
    campos: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true, autocomplete: 'name' },
      { key: 'empresa', label: 'Empresa', type: 'text', required: false, autocomplete: 'organization' },
      { key: 'correo', label: 'Email', type: 'email', required: true, autocomplete: 'email' },
      { key: 'telefono', label: 'Teléfono', type: 'tel', required: false, autocomplete: 'tel' },
      { key: 'rol', label: 'Rol', type: 'select', required: false,
        opciones: ['Dirección general', 'Finanzas', 'Operaciones-Planta', 'Energía-Mantenimiento', 'Otro'] }
    ]
  },

  // ---- BLOQUE A ----
  perfilSector: {
    continuo: 'proceso continuo', manufactura: 'manufactura', frio: 'frío y logística',
    publico: 'infraestructura pública', ev: 'carga de vehículos eléctricos'
  },
  perfilExposicion: [
    { when: { generacion: 'estacional' }, text: 'con generación estacional y hueco fuera de temporada' },
    { when: { sector: 'continuo' }, text: 'de proceso continuo con exposición estructural a horario punta' },
    { when: { disparador: 'capacidad' }, text: 'con restricción de capacidad eléctrica' },
    { when: { disparador: 'diesel' }, text: 'con dependencia de diésel' }
  ],
  perfilExposicionDefault: 'con exposición a cargo por demanda',

  // ---- BLOQUE B ----
  tablaFactura: { bajo: 120000, medio: 500000, alto: 2500000, muyalto: 7000000, nolose: null },
  tablaDemanda: { gdmth: [0.30, 0.40], dist: [0.35, 0.45], otra: [0.20, 0.35], nolose: [0.20, 0.35], privado: null },
  // %recorte del cargo por demanda según el PERFIL de carga (comportamiento), no el sector.
  tablaRecorte: {
    picos: [0.28, 0.42],
    diurno: [0.25, 0.35],
    punta: [0.20, 0.32],
    plano: [0.10, 0.18],
    nolose: [0.15, 0.30]
  },
  tarifaLegible: { gdmth: 'GDMTH', dist: 'DIST/DIT', otra: 'tu tarifa actual', nolose: 'tu tarifa actual' },
  bloqueB: {
    plantilla: (v) => `Con una factura de ~${v.facturaLegible} al mes en tarifa ${v.tarifaLegible}, el cargo por demanda suele pesar entre ${v.pctDemandaPiso}% y ${v.pctDemandaTecho}% del recibo. En operaciones con un perfil de carga como el tuyo, un sistema de almacenamiento bien dimensionado suele recortar del orden de ${v.pctRecortePiso}% a ${v.pctRecorteTecho}% de ese cargo.`,
    rango: (rangoTexto) => `Orden de magnitud: ${rangoTexto}.`,
    disclaimer: 'No es una estimación precisa ni una propuesta: en empresas con un perfil similar solemos encontrar oportunidades económicas de este orden de magnitud. El número real se calcula con tus recibos de los últimos 12 meses.',
    continuoExtra: 'Y en una operación que no para como la tuya, el recorte de pico no suele ser la palanca más fuerte — el arbitraje horario lo es, porque compras en punta todos los días. Eso se suma y se calcula con tu desglose horario.',
    noloseFactura: 'Para dar un orden de magnitud necesitamos la escala de tu factura — es el primer dato del checklist. Lo que sí podemos adelantarte es qué palancas aplican a tu perfil:',
    privado: 'Como compras a un suministrador privado, tu ahorro depende de la estructura de tu contrato — si tienes exposición a precios horarios del mercado, hay arbitraje; si es precio fijo, el margen se lo queda tu suministrador. Es la primera pregunta que resolvemos en la llamada.',
    dieselNota: 'Y ojo: la sustitución de diésel ahorra por peso desplazado, no por porcentaje de factura — suele ser el de mayor margen del análisis, y lo dimensionamos con tus horas de operación.'
  },

  // ---- BLOQUE C ----
  gancho: 'La mayoría de las empresas no sabe que una parte grande de su recibo no es energía que consumió, sino un cargo por su pico de demanda. Eso es exactamente lo primero que revisamos.',
  palancasPrincipal: [
    { id: 'estacional', when: { generacion: 'estacional' }, nombre: 'Cobertura fuera de temporada', text: 'Tu generación cubre parte del año; el resto pagas tarifa completa. Ahí está tu mayor hueco, y coincide con la temporada de más sol.' },
    { id: 'diesel', when: { disparador: 'diesel' }, nombre: 'Sustitución de diésel', text: 'Cada hora de diésel cuesta un múltiplo de la red. Desplazarlo es tu palanca de mayor margen.' },
    { id: 'capacidad', when: { disparador: 'capacidad' }, nombre: 'Diferimiento de capacidad', text: 'Ampliar tu acometida con CFE puede tomar meses o años. El almacenamiento te deja crecer sin esperar esa ampliación.' },
    { id: 'continuo', when: { sector: 'continuo' }, nombre: 'Arbitraje horario', text: 'Tu operación no para, así que compras en horario punta todos los días sin alternativa. Trasladar ese consumo a horas baratas es tu palanca más fuerte.' },
    { id: 'ev', when: { sector: 'ev' }, nombre: 'Diferimiento + pico de carga', text: 'Un cargador rápido dispara un pico de demanda brutal frente a lo que factura. Recortarlo y evitar ampliar acometida es donde está el dinero.' },
    { id: 'excedente', when: { disparador: 'excedente' }, nombre: 'Arbitraje de excedente', text: 'El excedente que hoy exportas a precio de valle puede venderse en las horas de mayor precio. Es una palanca de ingreso, no de ahorro.' }
  ],
  palancaPrincipalDefault: { id: 'demanda', nombre: 'Recorte de demanda', text: 'Tu momento de mayor consumo fija un cargo que pesa sobre toda la factura, aunque dure minutos. Es de lo más fácil y directo de recortar.' },
  palancasSecundaria: [
    { id: 'producto', when: { corte: 'producto' }, nombre: 'Respaldo de producto', text: 'Además, un corte te cuesta producto perdido — el respaldo protege ese inventario.' },
    { id: 'reinicio', when: { corte: 'reinicio' }, nombre: 'Continuidad de proceso', text: 'Además, cada paro te cuesta horas de reinicio; el respaldo evita esa pérdida.' },
    // Variante frío/logística: va ANTES de la genérica para que .find() la tome primero (Cambio 2).
    { id: 'servicio_frio', when: { sector: 'frio', corte: 'servicio' }, nombre: 'Continuidad de servicio', text: 'En frío el costo de un corte no es la hora parada, es la excursión de temperatura y la ventana de embarque que no se cumple. El respaldo protege el producto y el despacho del día.' },
    { id: 'servicio', when: { corte: 'servicio' }, nombre: 'Continuidad de servicio', text: 'Además, cada hora sin energía es ingreso perdido — el respaldo lo sostiene.' },
    { id: 'continuo', when: { sector: 'continuo' }, nombre: 'Arbitraje horario', text: 'Y como corres 24/7, el arbitraje horario suma sobre el recorte de pico.' },
    { id: 'capacidad', when: { disparador: 'capacidad' }, nombre: 'Diferimiento de capacidad', text: 'Y te permite crecer sin esperar la ampliación de CFE.' }
  ],
  palancasDescartada: [
    { id: 'fisica', when: { generacion: 'fisica' }, nombre: 'Solar', text: 'Ya tienes generación resuelta; tu cuello de botella es cómo aprovecharla y qué te cuesta la demanda, no generar más.' },
    { id: 'estacional', when: { generacion: 'estacional' }, nombre: 'Tu cogeneración', text: 'No te proponemos tocarla. Ya generas durante la temporada; el foco es el hueco de los otros meses.' },
    { id: 'continuo', when: { sector: 'continuo' }, nombre: 'Peak shaving como caso principal', text: 'No te lo vendemos como el gran ahorro: en una operación 24/7 rinde poco. Tu palanca real es el arbitraje.' },
    { id: 'costo_nada', when: { disparador: 'costo', corte: 'nada' }, nombre: 'Respaldo/continuidad', text: 'Si un corte no te cuesta dinero, pagar por continuidad no tiene sentido — tu caso es puramente de costo.' }
  ],
  // Default de descarte: prioridad más baja, solo si ninguna regla 1–5 aplicó. Garantiza
  // que todo perfil cierre con una línea "No aplica —". `arbitraje` para no-continuo/no-ev;
  // `solar` para el caso residual ev.
  palancaDescartadaDefault: {
    arbitraje: { id: 'default_arbitraje', nombre: 'Arbitraje horario como caso principal', text: 'Salvo que tu consumo esté fuertemente concentrado en horario punta, trasladar consumo entre horarios rinde menos que atacar tu pico directo. Lo verificamos con tu desglose horario; no te lo vendemos como el gran ahorro.' },
    solar: { id: 'default_solar', nombre: 'Generación solar como prioridad', text: 'Tu cuello de botella es el pico de carga y la capacidad de acometida, no generar energía. Ahí es donde ponemos el foco.' }
  },
  // Palanca secundaria adicional, solo perfil frío/logística (carga dominada por compresores).
  // Cualitativa: NO entra al rango numérico del bloque B (Cambio 3).
  palancaFactorPotencia: { id: 'factor_potencia', nombre: 'Corrección de factor de potencia', text: 'El inversor del sistema aporta reactiva. Si tu recibo trae penalización por bajo factor de potencia, es ahorro que no requiere capacidad de batería adicional. Se lee directo de la factura.' },

  // ---- BLOQUE D ----
  datoFaltante: [
    { when: { factura: 'nolose' }, text: 'Para volver esto un número exacto, el dato clave es tu recibo de CFE — con 12 meses vemos tu cargo por demanda real y tu perfil horario.' },
    { when: { tarifa: 'privado' }, text: 'El dato que define tu caso es la estructura de tu contrato de suministro — si tienes exposición a precios horarios del mercado, hay arbitraje; si es precio fijo, el margen se lo queda tu suministrador. Es la primera pregunta que resolvemos en la llamada.' },
    { when: { disparador: 'diesel' }, text: 'El dato que dimensiona tu ahorro son las horas al año que corre tu diésel — ahí está el mayor margen del análisis.' },
    { when: { sector: 'continuo' }, text: 'El dato que define tu arbitraje es tu desglose de consumo por horario (base, intermedia, punta) — se lee de tu recibo GDMTH.' }
  ],
  datoFaltanteCorte: 'El dato que cierra el caso de respaldo es cuántos paros por causa eléctrica tuviste y qué costó cada uno — casi nadie lo mide, y suele ser mayor de lo esperado.',
  datoFaltanteDefault: 'El dato que vuelve esto exacto son tus recibos de CFE de los últimos 12 meses — sobre tus propios números, no estimaciones.',
  cierreComun: 'Ese es exactamente el diagnóstico gratuito que hacemos en la llamada: sobre tus datos reales, sin costo y sin compromiso.',

  // ---- BLOQUE E ----
  financiamiento: [
    { when: { sector: 'publico' }, text: 'Para entidades públicas, nuestros proyectos suelen poder estructurarse como contrato de servicio en lugar de inversión directa — lo que permite tratarlo como gasto corriente. La viabilidad de ese esquema depende de un análisis de tu caso, y es parte de lo que evaluamos juntos en la llamada.' },
    { when: { sector: 'ev' }, text: 'Nuestros proyectos pueden estructurarse sin inversión inicial, con el activo de nuestro lado — sujeto a una evaluación de viabilidad. También puedes adquirirlo directamente si prefieres evaluarlo por retorno. Vemos cuál te conviene según tus números.' },
    { when: { factura: 'muyalto' }, text: 'A tu escala, la pregunta no suele ser si hay capital, sino dónde rinde mejor. Nuestros proyectos pueden estructurarse como inversión propia o como esquema de servicio que mantiene el activo fuera de tu balance —esto último sujeto a evaluación de viabilidad. Definimos cuál encaja con tu política de capital.' }
  ],
  financiamientoDefault: 'Nuestros proyectos pueden estructurarse de dos formas: adquisición directa evaluada por retorno, o esquema de servicio sin inversión inicial, sujeto a un análisis de viabilidad del proyecto. Lo natural es empezar por un proyecto piloto medido en esta instalación y replicar solo si el número se cumple. En la llamada vemos cuál se ajusta mejor a tu caso.',

  // ---- CHECKLIST ----
  checklistBase: [
    'Recibos de CFE de los últimos 12 meses (de la planta que elegiste)',
    'Perfil de carga en intervalos de 15 minutos, si lo tienes'
  ],
  checklistRefuerzos: {
    diesel: 'Horas al año que corre tu respaldo de diésel y su costo aproximado',
    paros: 'Historial de paros por causa eléctrica: cuántos y qué costó cada uno',
    horario: 'Desglose de consumo por horario (base, intermedia, punta) de tu recibo GDMTH',
    contrato: 'Estructura de tu contrato de suministro (precio fijo o exposición a precios horarios)',
    techo: 'Superficie de techo o terreno disponible para generación'
  },
  checklistViabilidad: {
    publico: 'Marco de contratación aplicable — si te interesa la estructura de contrato de servicio, conviene identificar bajo qué figura de adquisición puede la entidad contratarlo. Lo revisamos juntos.',
    privado: 'Perfil de la empresa para evaluar el esquema sin inversión — antigüedad y facturación aproximada, solo si te interesa explorar esa vía. Nos permite ver si es viable para tu caso.'
  },
  checklistUniversal: 'Quién decide y umbral de autorización.',
  checklistTitulo: 'Antes de tu llamada, te sirve tener a mano:',
  checklistPie: 'No hace falta tenerlo todo listo — con lo que tengas alcanza para empezar.',

  resultado: { reiniciar: 'Reiniciar diagnóstico' },
  progresoLabel: (n, total) => `Paso ${n} de ${total}`
};

export default content;
