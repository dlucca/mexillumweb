// Todo el copy y las reglas del funnel v2, como datos — versión hoteles. Cambiar contenido o
// reordenar prioridades = editar este archivo. Sin lógica: engine.js lee de acá. Copy es-MX (tuteo).

const content = {
  profile: {
    id: 'hoteles',
    label: 'Hoteles',
    route: '/diagnostico-hoteles',
    version: '2.0'
  },
  intro: {
    titulo: 'Diagnóstico energético para tu hotel en 2 minutos',
    cuerpo: 'Ocho preguntas sobre tu propiedad —climatización, ocupación, tarifa CFE—. Al final ves qué oportunidades de ahorro aplican a tu hotel, cuál atacar primero y, cuando tu tarifa lo permite, un orden de magnitud de lo que hay en juego, además de qué datos preparar para volverlo un número exacto.',
    // El resultado se renderiza completo antes del gate (ver renderResult en view.js):
    // el pie lo dice explícitamente porque es la objeción principal del tráfico frío.
    pie: 'Sin costo y sin formulario: el diagnóstico aparece completo al terminar. Tus datos solo si quieres recibirlo por correo o avanzar con el anteproyecto.',
    cta: 'Empezar'
  },

  plantaLabel: 'tu propiedad',

  pasos: [
    {
      key: 'sector', notaLabel: 'Tipo de propiedad',
      pregunta: '¿Cómo describirías tu propiedad?',
      opciones: [
        { label: 'Gran resort all-inclusive — 500+ llaves, F&B, spa y amenidades todo el día', codigo: 'allinclusive' },
        { label: 'Resort de playa — 150–500 llaves, ocupación marcada por temporada', codigo: 'resort' },
        { label: 'Hotel boutique / lifestyle — menos de 150 llaves, alto servicio por llave', codigo: 'boutique' },
        { label: 'Hotel urbano o de negocios — ocupación entre semana, salones y eventos', codigo: 'urbano' },
        { label: 'Propiedad en desarrollo o expansión — nuevas torres o llaves por venir', codigo: 'desarrollo' }
      ]
    },
    {
      key: 'perfil', notaLabel: 'Perfil de carga / horario',
      pregunta: 'Pensando en un día típico de tu propiedad, ¿cómo se comporta el consumo eléctrico?',
      hint: 'Piensa en climatización, cuartos fríos y lavandería — no necesitas números.',
      opciones: [
        { label: 'Climatización pareja 24/7: chillers y manejadoras nunca paran', codigo: 'plano' },
        { label: 'Sube de día y en check-in/check-out, baja de madrugada', codigo: 'diurno' },
        { label: 'Picos fuertes al mediodía y en el servicio de cocina (calor + F&B juntos)', codigo: 'picos' },
        { label: 'Se concentra en el horario punta de CFE (tarde-noche: alberca climatizada, cena, iluminación)', codigo: 'punta' },
        { label: 'No lo tengo claro', codigo: 'nolose' }
      ]
    },
    {
      key: 'generacion', notaLabel: 'Generación propia',
      pregunta: '¿Generan parte de su propia energía?',
      opciones: [
        { label: 'Sí — paneles solares en techos o áreas comunes (detrás del medidor)', codigo: 'solar_sitio' },
        { label: 'Tenemos contrato de suministro renovable / calificado', codigo: 'contrato' },
        { label: 'No, compramos todo a CFE o a un suministrador', codigo: 'no' },
        { label: 'Lo estamos evaluando (RFP de solar en curso)', codigo: 'evaluando' }
      ]
    },
    {
      key: 'calidad', notaLabel: 'Calidad eléctrica',
      pregunta: '¿Reconoces problemas de calidad o confiabilidad eléctrica en tu propiedad?',
      opciones: [
        { label: 'Sí — CFE nos penaliza por bajo factor de potencia en el recibo', codigo: 'factor' },
        { label: 'Sí — variaciones de voltaje que dañan equipo sensible (elevadores, cómputo, cocina, domótica)', codigo: 'variaciones' },
        { label: 'Sí — microcortes o interrupciones de CFE (y temporada de huracanes)', codigo: 'cortes' },
        { label: 'No, el suministro es estable', codigo: 'no' },
        { label: 'No lo sé', codigo: 'nolose' }
      ]
    },
    {
      key: 'tarifa', notaLabel: 'Tarifa CFE',
      pregunta: 'Busca el recibo de CFE de {planta}. Arriba a la derecha hay un código de tarifa — ¿cuál es?',
      hint: 'Aparece en la carátula frontal de tu recibo CFE en el recuadro superior derecho.',
      opciones: [
        { label: 'GDMTH (Gran Demanda Media Tensión Horaria)', codigo: 'gdmth' },
        { label: 'GDMTO (Gran Demanda Media Tensión Ordinaria)', codigo: 'gdmto' },
        { label: 'DIST o DIT (Subtransmisión / Transmisión)', codigo: 'dist' },
        { label: 'GDBT (Gran Demanda Baja Tensión)', codigo: 'gdbt' },
        { label: 'PDBT (Pequeña Demanda Baja Tensión <25 kW)', codigo: 'pdbt' },
        { label: 'No tengo el recibo a la mano', codigo: 'nolose' },
        { label: 'No compramos a CFE (suministrador privado / calificado)', codigo: 'privado' }
      ]
    },
    {
      key: 'factura', notaLabel: 'Factura mensual',
      pregunta: 'De {planta}: ¿cuánto paga de electricidad al mes?',
      hint: 'Solo lo usamos para estimar el rango — nada se comparte.',
      opciones: [
        { label: 'Menos de $200,000 MXN', codigo: 'bajo' },
        { label: '$200,000 – $1,000,000 MXN', codigo: 'medio' },
        { label: '$1,000,000 – $5,000,000 MXN', codigo: 'alto' },
        { label: 'Más de $5,000,000 MXN', codigo: 'muyalto' },
        { label: 'No lo tengo a la mano', codigo: 'nolose' }
      ]
    },
    {
      key: 'corte', notaLabel: 'Impacto de un corte',
      pregunta: 'Si {planta} pierde energía 30 minutos en alta ocupación, ¿qué pasa?',
      opciones: [
        { label: 'Cocina y cadena de frío en riesgo: merma y tema de sanidad', codigo: 'producto' },
        { label: 'Se detiene la operación y recuperarla toma tiempo (bombeo, PMS, sistemas)', codigo: 'reinicio' },
        { label: 'Perdemos ingresos y experiencia del huésped por hora (clima, elevadores, eventos, reseñas)', codigo: 'servicio' },
        { label: 'Incomoda, pero no cuesta dinero relevante', codigo: 'nada' }
      ]
    },
    {
      key: 'disparador', notaLabel: 'Disparador', multi: true,
      pregunta: 'Además de la factura, ¿algo de esto te suena familiar?',
      hint: 'Cada una señala una oportunidad de ahorro distinta — puedes marcar más de una.',
      opciones: [
        { label: 'Queremos sumar llaves, torres o amenidades y CFE no da capacidad (o tarda)', codigo: 'capacidad' },
        { label: 'Usamos planta de diésel de emergencia con frecuencia', codigo: 'diesel' },
        { label: 'Tenemos (o tendremos) solar y desperdiciamos excedente', codigo: 'excedente' },
        { label: 'Operamos aislados de CFE, o queremos hacerlo (propiedad remota / eco-resort)', codigo: 'aislado' },
        { label: 'Ninguna: nuestro tema es puramente bajar el costo de energía', codigo: 'costo', exclusiva: true }
      ]
    }
  ],

  gate: {
    titulo: 'Tu diagnóstico está listo.',
    cuerpo: 'Cuando gustes podemos agendar una llamada para revisar contigo las posibilidades que muestra tu diagnóstico, resolver dudas y definir qué datos de tu propiedad afinan el anteproyecto. Sin costo ni compromiso.',
    cta: 'Agendar mi llamada',
    okMsg: '¡Listo! Recibimos tus datos. Elige un horario abajo para agendar la llamada.',
    confidencialidad: 'Tus datos son confidenciales y solo los usamos para tu diagnóstico. Consulta nuestro',
    ndaAviso: 'Al agendar te enviamos, sin costo, un Acuerdo de Confidencialidad firmado por Mexillum, para que compartas tu información con tranquilidad. El acuerdo se emite a favor de tu empresa; por eso te pedimos su nombre al reservar.',
    campos: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true, autocomplete: 'name' },
      { key: 'empresa', label: 'Empresa', type: 'text', required: false, autocomplete: 'organization' },
      { key: 'correo', label: 'Email', type: 'email', required: true, autocomplete: 'email' },
      { key: 'telefono', label: 'Teléfono', type: 'tel', required: false, autocomplete: 'tel' },
      { key: 'rol', label: 'Rol', type: 'select', required: false,
        opciones: ['Dirección general', 'Finanzas', 'Operaciones/Ingeniería', 'Sostenibilidad/Energía', 'Otro'] },
      // Calificación comercial opcional: da a ventas una idea del tamaño del proyecto sin
      // sumar fricción al diagnóstico (solo lo ve quien ya decidió agendar). Rangos en MXN
      // para no mezclar moneda con la factura, que también es MXN.
      { key: 'presupuesto', label: 'Rango de inversión que contemplas (opcional)', type: 'select', required: false,
        opciones: ['Menos de $500,000 MXN', '$500,000 – $2,000,000 MXN', '$2,000,000 – $10,000,000 MXN', 'Más de $10,000,000 MXN', 'Aún no lo tenemos definido'] }
    ]
  },

  // ---- BLOQUE A ----
  perfilSector: {
    allinclusive: 'gran resort all-inclusive', resort: 'resort de playa',
    boutique: 'hotel boutique', urbano: 'hotel urbano', desarrollo: 'propiedad en expansión'
  },
  perfilExposicion: [
    { when: { sector: 'allinclusive' }, text: 'con climatización 24/7 y exposición estructural a horario punta' },
    { when: { disparador: 'capacidad' }, text: 'con restricción de capacidad para crecer' },
    { when: { disparador: 'diesel' }, text: 'con dependencia de diésel de respaldo' }
  ],
  perfilExposicionDefault: 'con exposición a cargo por demanda',

  // ---- SCORING (datos; engine.js sólo suma) ----
  scoring: {
    oportunidades: [
      { id: 'peak_shaving', nombre: 'Peak Shaving' },
      { id: 'arbitraje', nombre: 'Arbitraje tarifario' },
      { id: 'solar_puro', nombre: 'Solar fotovoltaico on-grid' },
      { id: 'bess_solar', nombre: 'BESS + Solar' },
      { id: 'respaldo', nombre: 'Respaldo' },
      { id: 'diferimiento', nombre: 'Diferimiento de capacidad' },
      { id: 'off_grid', nombre: 'Sistema aislado (microred)' },
      { id: 'diesel', nombre: 'Sustitución de diésel' }
    ],
    pesos: {
      peak_shaving: {
        perfil: { picos: 50, diurno: 38, punta: 32, plano: 8, nolose: 18 },
        tarifa: { gdmth: 25, dist: 25, gdmto: 20, gdbt: 10, pdbt: 0, nolose: 0, privado: 0 },
        factura: { muyalto: 18, alto: 14, medio: 9, bajo: 4, nolose: 6 },
        sector: { allinclusive: 7, resort: 5, urbano: 4, boutique: 2, desarrollo: 0 },
        calidad: { factor: 5 }
      },
      arbitraje: {
        // En GDMTO y GDBT la tarifa es monomia (sin horario punta/base), por lo que arbitraje es 0.
        tarifa: { gdmth: 38, dist: 28, privado: 14, gdmto: 0, gdbt: 0, pdbt: 0, nolose: 0 },
        perfil: { plano: 34, punta: 34, diurno: 14, picos: 8, nolose: 14 },
        sector: { allinclusive: 14, resort: 8 },
        disparador: { excedente: 14 },
        factura: { muyalto: 10, alto: 7, medio: 4 }
      },
      solar_puro: {
        // Solar on-grid puro brilla cuando el consumo es diurno, no se cuenta con generación previa,
        // no hay dolor crítico de cortes y el foco es reducción pura de costo de kWh.
        perfil: { diurno: 44, plano: 22, picos: 14, punta: 6, nolose: 14 },
        generacion: { no: 28, evaluando: 32, estacional: 10, contrato: 8, solar_sitio: 0 },
        disparador: { costo: 22 },
        tarifa: { gdmto: 20, gdbt: 18, gdmth: 16, dist: 12, pdbt: 14, privado: 10, nolose: 8 },
        corte: { nada: 14, servicio: 4, reinicio: 2, producto: 0 },
        calidad: { no: 10, nolose: 6 }
      },
      bess_solar: {
        generacion: { solar_sitio: 22, contrato: 6, estacional: 34, evaluando: 24, no: 10 },
        perfil: { diurno: 34, plano: 16, picos: 10, punta: 8, nolose: 14 },
        disparador: { excedente: 18 },
        sector: { resort: 6, allinclusive: 6, urbano: 4, desarrollo: 6 }
      },
      respaldo: {
        corte: { producto: 52, reinicio: 42, servicio: 46, nada: 0 },
        calidad: { cortes: 24, variaciones: 14 },
        sector: { allinclusive: 12, boutique: 10, resort: 8, urbano: 6 },
        disparador: { diesel: 8 }
      },
      diferimiento: {
        disparador: { capacidad: 62 },
        sector: { desarrollo: 26 },
        perfil: { picos: 12, punta: 6 },
        factura: { muyalto: 8, alto: 4 }
      },
      diesel: {
        disparador: { diesel: 72 }
      },
      off_grid: {
        // Intención explícita: operar sin la red. La señal 'aislado' la define; el diésel
        // suma porque un sitio aislado casi siempre corre combustible que la microred desplaza.
        disparador: { aislado: 72, diesel: 8 }
      }
    },
    // Capa declarativa: puntos extra por combinaciones y techos por condición crítica ausente.
    boosts: [
      { id: 'peak_shaving', when: { perfil: 'picos', tarifa: 'gdmth' }, pts: 8 },
      { id: 'peak_shaving', when: { perfil: 'picos', tarifa: 'gdmto' }, pts: 6 },
      { id: 'arbitraje', when: { perfil: 'punta', tarifa: 'gdmth' }, pts: 8 },
      { id: 'solar_puro', when: { perfil: 'diurno', disparador: 'costo' }, pts: 12 },
      { id: 'solar_puro', when: { perfil: 'diurno', tarifa: 'gdmto' }, pts: 10 },
      { id: 'bess_solar', when: { generacion: 'solar_sitio', disparador: 'excedente' }, pts: 14 }
    ],
    caps: [
      // PDBT no factura demanda con estructura $/kW relevante para BESS.
      { id: 'peak_shaving', max: 0, unless: { tarifa: ['gdmth', 'dist', 'gdmto', 'gdbt', 'privado', 'nolose'] } },
      // Arbitraje requiere tarifas horarias (GDMTH, DIST, o contrato privado indexado a horario).
      // En GDMTO, GDBT y PDBT no existe diferenciación horaria de precios; el arbitraje es nulo.
      { id: 'arbitraje', max: 0, unless: { tarifa: ['gdmth', 'dist', 'privado', 'nolose'] } },
      // Solar puro: si ya tienen solar en sitio, no se recomienda solar nuevo sino BESS sobre lo existente.
      { id: 'solar_puro', max: 20, when: { generacion: 'solar_sitio' } },
      // Solar puro no puede liderar donde el sol no llega al dolor: operación 24/7 (plano),
      // consumo concentrado en punta nocturna, o picos instantáneos de demanda (arranques de
      // motor, que el sol no rasura). Ahí mandan arbitraje/peak shaving. Solar solo lidera con
      // perfil diurno. Es un techo (sigue siendo palanca secundaria), no una exclusión.
      { id: 'solar_puro', max: 40, when: { perfil: ['plano', 'punta', 'picos'] } },
      // BESS + Solar necesita señal real de generación/solar; sin solar en sitio o evaluación previa, se limita.
      { id: 'bess_solar', max: 45, requiere: { generacion: ['solar_sitio', 'estacional', 'evaluando'] } },
      // Arbitraje depende de conocer la tarifa horaria.
      { id: 'arbitraje', max: 40, requiere: { tarifa: ['gdmth', 'dist', 'privado'] } },
      // Sustitución de diésel: sin la señal de diésel no hay combustible que desplazar.
      { id: 'diesel', max: 0, requiere: { disparador: ['diesel'] } },
      // Sistema aislado: sin la intención explícita de operar sin red, no aplica.
      { id: 'off_grid', max: 0, requiere: { disparador: ['aislado'] } }
    ],
    umbralPotencial: { muyAlto: 75, alto: 60, medio: 40 },
    umbralFuerte: 60,
    umbralSecundaria: 40,
    // Potencial general = tamaño del prize (escala de factura), recortado por fit y datos.
    // Índice de nivel candidato por factura: 3=Muy Alto, 2=Alto, 1=Medio (techo, luego se recorta).
    escalaPotencial: { muyalto: 3, alto: 3, medio: 2, bajo: 1, nolose: 1 },
    // Tarifas con estructura de demanda clara: habilitan un rango cuantificable y, con ello,
    // niveles de potencial altos. PDBT/privado/nolose no cuantifican -> techo Alto.
    tarifasCuantificables: ['gdmth', 'gdmto', 'dist', 'gdbt'],
    // Aplicación principal: orden de prioridad comercial.
    aplicacionPrincipal: [
      // 0. Operar aislado de la red reencuadra todo el proyecto como microred: manda sobre el resto.
      { id: 'off_grid', when: { disparador: 'aislado' }, fuerte: true },
      // 1. Diésel declarado siempre lidera por costo unitario de combustible.
      { id: 'diesel', when: { disparador: 'diesel' } },
      // 2. Restricción de capacidad lidera si tiene peso técnico propio.
      { id: 'diferimiento', when: { disparador: 'capacidad' }, fuerte: true },
      // 3. Respaldo por costo de corte manda sobre arbitraje/peak shaving salvo que el ranking lo supere por mucho.
      { id: 'respaldo',
        anyOf: [{ corte: ['producto', 'reinicio', 'servicio'] }, { calidad: 'cortes' }],
        fuerte: true, margenTop: 20 },
      // 4. Si el consumo es diurno, no hay dolores de corte y no generan, Solar Puro lidera por payback.
      { id: 'solar_puro',
        when: { perfil: 'diurno', generacion: 'no', corte: 'nada' },
        fuerte: true }
    ]
  },

  // ---- BLOQUE B ----
  tablaFactura: { bajo: 120000, medio: 500000, alto: 2500000, muyalto: 7000000, nolose: null },
  // Porcentaje que representa el cargo por demanda sobre la factura total según tarifa de CFE
  tablaDemanda: {
    gdmth: [0.30, 0.40],
    dist: [0.35, 0.45],
    gdmto: [0.25, 0.35],
    gdbt: [0.15, 0.25],
    pdbt: null,
    nolose: null,
    privado: null
  },
  // % de recorte del cargo por demanda según el PERFIL de carga
  tablaRecorte: {
    picos: [0.28, 0.42],
    diurno: [0.25, 0.35],
    punta: [0.20, 0.32],
    plano: [0.10, 0.18],
    nolose: [0.15, 0.30]
  },
  // % del recibo ANUAL que rinde el arbitraje horario, según el PERFIL de carga.
  // Anclado a GDMTH: punta ~2-2.5x base, energía ~60% del recibo, y la fracción de
  // consumo que cae en punta por perfil. Conservador (tráfico frío). Aplica solo
  // cuando el arbitraje lidera y la tarifa es horaria (GDMTH/DIST).
  tablaArbitraje: {
    punta: [0.05, 0.10],
    diurno: [0.03, 0.06],
    plano: [0.015, 0.03],
    picos: [0.015, 0.03],
    nolose: [0.02, 0.05]
  },
  tarifaLegible: {
    gdmth: 'GDMTH',
    dist: 'DIST/DIT',
    gdmto: 'GDMTO',
    gdbt: 'GDBT',
    pdbt: 'PDBT',
    privado: 'Suministrador Privado'
  },
  bloqueB: {
    plantilla: (v) => `Con una factura de ~${v.facturaLegible} al mes en tarifa ${v.tarifaLegible}, el cargo por demanda suele pesar entre ${v.pctDemandaPiso}% y ${v.pctDemandaTecho}% del recibo. En propiedades con un perfil de carga como el tuyo, un sistema de almacenamiento bien dimensionado suele recortar del orden de ${v.pctRecortePiso}% a ${v.pctRecorteTecho}% de ese cargo.`,
    rango: (rangoTexto) => `Orden de magnitud: ${rangoTexto}.`,
    arbitrajePlantilla: (v) => `Con una factura de ~${v.facturaLegible} al mes en tarifa ${v.tarifaLegible}, una parte de tu consumo cae en el horario punta de CFE —el más caro del día—. Trasladar ese consumo a horas baratas con la batería (arbitraje) suele valer del orden de ${v.pctPiso}% a ${v.pctTecho}% de tu factura anual.`,
    disclaimer: 'No es una estimación precisa ni una propuesta: en hoteles con un perfil similar solemos encontrar oportunidades económicas de este orden de magnitud. El número real se calcula con tus recibos de los últimos 12 meses.',
    continuoExtra: 'Y con climatización 24/7 como la tuya, el recorte de pico no suele ser lo que más rinde — el arbitraje horario sí, porque compras en punta todos los días. Eso se suma y se calcula con tu desglose horario.',
    noloseFactura: 'Para dar un orden de magnitud necesitamos la escala de tu factura — es el primer dato del checklist. Lo que sí podemos adelantarte es qué oportunidades aplican a tu perfil:',
    noloseTarifa: 'Sin conocer tu tarifa no podemos calcular un rango económico responsable. La tarifa define si existe cargo por demanda y cómo se cobran los periodos horarios; por ahora solo podemos priorizar qué revisar.',
    pdbt: 'La tarifa PDBT no cobra la demanda máxima con la misma estructura que GDMTH, DIST/DIT o GDMTO. Por eso no aplicamos aquí una estimación de peak shaving; primero verificamos si existe otra oportunidad o si corresponde migrar de categoría tarifaria.',
    privado: 'Como compras a un suministrador privado, tu ahorro depende de la estructura de tu contrato — si tienes exposición a precios horarios del mercado, hay arbitraje; si es precio fijo, el margen se lo queda tu suministrador. Es la primera pregunta que resolvemos en la llamada.',
    sinRangoPorAplicacion: {
      solar_puro: 'Tu caso prioritario es la generación solar fotovoltaica en sitio para autoconsumo. Para estimar el ahorro con exactitud necesitamos la superficie disponible (techo o terreno en m²), tu consumo anual en kWh y la radiación de tu localidad; la factura mensual sola no basta para dimensionar la potencia óptima.',
      arbitraje: 'Tu caso prioritario es el arbitraje horario. Para estimarlo necesitamos el consumo desglosado por periodos base, intermedio y punta; una factura mensual total no alcanza para convertirlo en un rango responsable.',
      bess_solar: 'Tu caso prioritario combina almacenamiento y generación. Para estimarlo necesitamos la capacidad solar existente o la superficie disponible, el perfil horario y los excedentes; la factura mensual por sí sola no alcanza.',
      respaldo: 'Tu caso prioritario es la continuidad de la operación hotelera. Su valor depende de la frecuencia de los cortes, las cargas críticas y el costo real de cada interrupción para el huésped; no se puede derivar como porcentaje de la factura.',
      diferimiento: 'Tu caso prioritario es diferir una ampliación de capacidad. Para estimarlo necesitamos la capacidad contratada, las nuevas llaves o torres y el costo y plazo de la obra evitada; no se puede derivar como porcentaje de la factura.',
      diesel: 'Tu caso prioritario es sustituir operación con diésel. Para estimarlo necesitamos horas de uso, consumo y costo de combustible; no se puede derivar como porcentaje de la factura eléctrica.',
      off_grid: 'Tu caso prioritario es una microred aislada. Su tamaño y costo dependen de tu consumo total (kWh/día), tu perfil horario y las horas de autonomía que necesites sin sol ni red; no se deriva como porcentaje de una factura de CFE —puede que ni tengas una.'
    },
    dieselNota: 'Y ojo: la sustitución de diésel ahorra por peso desplazado, no por porcentaje de factura — suele ser el de mayor margen del análisis, y lo dimensionamos con tus horas de operación.'
  },

  // ---- BLOQUE C ----
  gancho: 'La mayoría de los hoteles no sabe que una parte grande de su recibo no es energía que consumió, sino un cargo por su pico de demanda. Eso es exactamente lo primero que revisamos.',
  palancasCopy: {
    peak_shaving: {
      nombre: 'Recorte de demanda (peak shaving)',
      principal: 'Tu momento de mayor consumo fija un cargo que pesa sobre toda la factura, aunque dure minutos. Recortarlo con batería es de lo más directo en tu perfil.',
      menor: 'Puede haber margen para recortar demanda, pero las demás señales de tu propiedad tienen más peso y conviene dimensionarlas primero.',
      descarte: 'En tu perfil el recorte de pico rinde poco: tu consumo no está concentrado en picos marcados. No te lo vendemos como el gran ahorro.'
    },
    arbitraje: {
      nombre: 'Arbitraje tarifario',
      principal: 'Compras energía en horario punta de CFE de forma recurrente. Trasladar ese consumo a horas baratas con la batería es tu mayor oportunidad.',
      menor: 'El arbitraje puede sumar valor, pero con estas respuestas no es la palanca que debería ordenar el proyecto.',
      descarte: 'En tarifas sin discriminación horaria (como GDMTO o GDBT) o sin consumo en punta, arbitrar entre horarios no aplica. El foco está en demanda o generación en sitio.'
    },
    solar_puro: {
      nombre: 'Generación solar fotovoltaica (autoconsumo)',
      principal: 'Tu propiedad se concentra durante el día y tu objetivo es reducir el costo de la energía. La energía solar en sitio suele ser la inversión de retorno más rápido para tu perfil.',
      menor: 'La generación solar puede reducir tu consumo de red, pero otras señales de tu tarifa o calidad eléctrica hacen prioritario evaluar almacenamiento primero.',
      descarte: 'Tu consumo no es principalmente diurno o ya cuentas con capacidad solar instalada; el foco está en optimizar demanda o almacenar.'
    },
    bess_solar: {
      nombre: 'BESS + Solar',
      principal: 'Tu consumo y tu perfil dan espacio para generar y almacenar: la batería aprovecha la generación, cubre el pico y traslada excedentes. Ahí está el mayor valor combinado.',
      menor: 'La combinación con Solar merece revisión, pero primero conviene resolver la señal operativa o tarifaria que hoy domina el caso.',
      descarte: 'Generar energía no es tu cuello de botella hoy; el foco está en la demanda y el pico, no en sumar generación.'
    },
    respaldo: {
      nombre: 'Respaldo',
      principal: 'Un corte te cuesta caro. La batería sostiene la operación en los momentos críticos y protege la experiencia del huésped que un apagón se lleva.',
      menor: 'La continuidad puede aportar valor, pero otra señal pesa más en la decisión económica inicial.',
      descarte: 'Si un corte no te cuesta dinero relevante, pagar por continuidad no tiene sentido — tu caso es de costo, no de respaldo.'
    },
    diferimiento: {
      nombre: 'Diferimiento de capacidad',
      principal: 'Ampliar tu acometida con CFE puede tomar meses o años. El almacenamiento te deja sumar llaves o torres sin esperar esa ampliación.',
      menor: 'La restricción de capacidad existe, pero otra oportunidad tiene mayor peso inmediato; ambas deben dimensionarse juntas para no duplicar inversión.',
      descarte: 'No hay una restricción de capacidad que resolver hoy; el diferimiento no aplica en tu caso.'
    },
    diesel: {
      nombre: 'Sustitución de diésel',
      principal: 'Cada hora de diésel cuesta un múltiplo de la red. Desplazarlo con almacenamiento suele ser la oportunidad de mayor margen.',
      menor: 'El uso de diésel merece análisis, aunque otra señal técnica resulte prioritaria en esta primera lectura.',
      descarte: 'No dependes de diésel, así que no hay consumo de combustible que desplazar.'
    },
    off_grid: {
      nombre: 'Sistema aislado (microred)',
      principal: 'Quieres operar sin depender de la red de CFE. Una microred de Solar + BESS (con respaldo mínimo) sostiene tu propiedad por sí sola. Ese es el eje de tu proyecto.',
      menor: 'Operar aislado es posible, pero en esta lectura otra señal manda primero; la microred se dimensiona junto con el resto.',
      descarte: 'No buscas operar aislado de la red, así que una microred autónoma no es tu caso.'
    }
  },
  palancasRespaldoVariantes: {
    producto: 'Un corte pone en riesgo tu cocina y tu cadena de frío — la batería protege ese servicio en el momento crítico.',
    reinicio: 'Cada paro te cuesta tiempo de recuperación en bombeo, PMS y sistemas; la batería evita esa pérdida.',
    servicio: 'Cada hora sin energía es ingreso y experiencia del huésped perdidos — la batería lo sostiene.'
  },
  palancaFactorPotencia: {
    id: 'factor_potencia',
    nombre: 'Corrección de factor de potencia',
    text: 'El inversor del sistema aporta potencia reactiva (kVAR). Si tu recibo trae penalización por bajo factor de potencia o buscas cumplir con Código de Red 2.0, es un ahorro que no consume capacidad de batería adicional. Se lee directo de la factura.'
  },

  // ---- BLOQUE D ----
  datoFaltante: [
    { when: { factura: 'nolose' }, text: 'Para volver esto un número exacto, el dato clave es tu recibo de CFE — con 12 meses vemos tu cargo por demanda real y tu perfil horario.' },
    { when: { tarifa: 'privado' }, text: 'El dato que define tu caso es la estructura de tu contrato de suministro — si tienes exposición a precios horarios del mercado, hay arbitraje; si es precio fijo, el margen se lo queda tu suministrador. Es la primera pregunta que resolvemos en la llamada.' }
  ],
  datoFaltantePorOportunidad: {
    peak_shaving: 'El dato que dimensiona tu ahorro es tu demanda máxima y cuánto pesa el cargo por demanda en tu recibo — se lee de tus últimos 12 meses de CFE.',
    arbitraje: 'El dato que define tu arbitraje es tu desglose de consumo por horario (base, intermedia, punta) — se lee de tu recibo GDMTH o DIST.',
    solar_puro: 'El dato que dimensiona tu proyecto solar es tu consumo anual en kWh y la superficie disponible en techo o terreno (m²) — con eso calculamos la potencia óptima y el porcentaje de cobertura.',
    bess_solar: 'El dato que dimensiona un proyecto BESS + Solar es tu superficie de techo o terreno disponible y el excedente que hoy inyectas o desperdicias — con eso vemos cuánto puedes generar y almacenar.',
    respaldo: 'El dato que cierra el caso de respaldo es cuántos cortes por causa eléctrica tuviste y qué costó cada uno en ingreso y experiencia del huésped — casi nadie lo mide, y suele ser mayor de lo esperado.',
    diferimiento: 'El dato que define tu diferimiento es cuánta capacidad tienes contratada, cuánta necesitas para las nuevas llaves o torres y si ya hay una solicitud de aumento con CFE.',
    diesel: 'El dato que dimensiona tu ahorro son las horas al año que corre tu diésel y su costo — ahí está el mayor margen del análisis.',
    off_grid: 'El dato que dimensiona una microred aislada es tu consumo total (kWh/día), tu perfil horario y cuántas horas de autonomía necesitas sin sol ni red.'
  },
  datoFaltanteCorte: 'El dato que cierra el caso de respaldo es cuántos cortes por causa eléctrica tuviste y qué costó cada uno en ingreso y experiencia del huésped — casi nadie lo mide, y suele ser mayor de lo esperado.',
  datoFaltanteDefault: 'El dato que vuelve esto exacto son tus recibos de CFE de los últimos 12 meses — sobre tus propios números, no estimaciones.',
  cierreComun: 'Ese es exactamente el diagnóstico gratuito que hacemos en la llamada: sobre tus datos reales, sin costo y sin compromiso.',

  // ---- BLOQUE E ----
  financiamiento: [
    { when: { sector: 'desarrollo' }, text: 'En una propiedad en desarrollo, el sistema puede entrar como parte del CAPEX de obra o como esquema de servicio sin inversión inicial (PPA / Energy Storage as a Service), sujeto a evaluación de viabilidad. Vemos cuál encaja con tu plan de obra en la llamada.' },
    { when: { factura: 'muyalto' }, text: 'A tu escala, la pregunta no suele ser si hay capital, sino dónde rinde mejor. Nuestros proyectos pueden estructurarse como inversión propia o como esquema de servicio que mantiene el activo fuera de tu balance —esto último sujeto a evaluación de viabilidad. Definimos cuál encaja con tu política de capital.' }
  ],
  financiamientoDefault: 'Nuestros proyectos pueden estructurarse de dos formas: adquisición directa (CAPEX) evaluada por retorno de inversión, o esquema de servicio sin inversión inicial (PPA / SaaS), sujeto a un análisis de viabilidad técnica y crediticia. Lo natural es empezar por un proyecto piloto medido en esta propiedad y replicar solo si el número se cumple. En la llamada vemos cuál se ajusta mejor a tu caso.',

  // ---- CHECKLIST ----
  checklistBase: [
    'Recibos de CFE de los últimos 12 meses (de la propiedad o medidor evaluado)',
    'Perfil de carga en intervalos de 15 minutos (archivo de lecturas cuarto-horarias), si lo tienes'
  ],
  checklistRefuerzos: {
    diesel: 'Horas al año que corre tu respaldo de diésel y su costo aproximado de combustible',
    paros: 'Historial de cortes por causa eléctrica: cuántos al año y qué costó cada interrupción',
    horario: 'Desglose de consumo por horario (base, intermedia, punta) de tu recibo GDMTH o DIST',
    contrato: 'Estructura de tu contrato de suministro privado (precio fijo o indexado a precios de mercado PML)',
    techo: 'Superficie de techo o terreno disponible para paneles solares (m² aproximados)',
    solar: 'Capacidad de tu sistema solar en sitio y cuánto excedente inyectas o se desperdicia',
    factorPotencia: 'Recibo con el detalle de penalización por bajo factor de potencia, si aplica',
    aislado: 'Consumo total (kWh/día), tu perfil horario y las horas de autonomía que necesitas sin sol ni red'
  },
  checklistViabilidad: {
    publico: 'Marco de contratación aplicable — si te interesa la estructura de contrato de servicio, conviene identificar bajo qué figura de adquisición puede la entidad contratarlo. Lo revisamos juntos.',
    privado: 'Perfil de tu propiedad o grupo hotelero para evaluar el esquema sin inversión — antigüedad y facturación aproximada, solo si te interesa explorar esa vía. Nos permite ver si es viable para tu caso.'
  },
  checklistUniversal: 'Quién decide y umbral de autorización de inversiones.',
  checklistTitulo: 'Antes de tu llamada, te sirve tener a mano:',
  checklistPie: 'No hace falta tenerlo todo listo — con lo que tengas alcanza para empezar.',

  // ---- RECOMENDACIÓN de solución ----
  recomendaciones: {
    insuficiente: { tipo: 'Evidencia insuficiente', razon: 'Las respuestas no alcanzan el umbral mínimo para recomendar una configuración. Antes de hablar de BESS o Solar necesitamos revisar tu tarifa, tu perfil de carga y al menos un recibo reciente.' },
    solarPrimero: { tipo: 'Solar fotovoltaico on-grid', razon: 'Tu consumo diurno y tu objetivo de costo hacen de la energía solar en sitio la opción de menor inversión y más rápido retorno. El almacenamiento (BESS) puede integrarse como fase 2 si más adelante buscas recortar picos de demanda o requieres respaldo.' },
    offGrid: { tipo: 'Microred aislada (Solar + BESS)', razon: 'Tu prioridad es operar sin depender de la red de CFE. La configuración es una microred: Solar para generar, BESS para firmar esa energía y sostener la operación de noche, y —si aplica— un respaldo mínimo de diésel. El tamaño depende de tu consumo, tu perfil horario y las horas de autonomía.' },
    bessDiesel: { tipo: 'BESS para sustituir diésel', razon: 'La señal dominante es el uso frecuente de diésel. La prioridad es dimensionar un BESS contra sus horas de operación, potencia y costo de combustible; Solar se evalúa después como fuente de recarga limpia.' },
    bessDieselSolar: { tipo: 'BESS sobre solar existente', razon: 'Ya tienes Solar y además usas diésel con frecuencia. La prioridad es un BESS que aproveche esa generación y reduzca las horas de combustible; el dimensionamiento depende de las cargas críticas y la duración de los eventos.' },
    bessCapacidad: { tipo: 'BESS para diferir capacidad', razon: 'Tu restricción para sumar llaves, torres o amenidades manda sobre las demás señales. La prioridad es dimensionar un BESS contra la nueva carga y la capacidad disponible de CFE; Solar solo se agrega si mejora ese caso sin retrasar la entrada en operación.' },
    bessRespaldo: { tipo: 'BESS para respaldo', razon: 'El costo de una interrupción domina tu caso. La prioridad es definir cargas críticas, potencia y autonomía requerida, con una arquitectura capaz de operar en isla (microred); los ahorros tarifarios quedan como beneficio secundario.' },
    bessSolarGeneral: { tipo: 'BESS + Solar', razon: 'Las señales de generación y almacenamiento lideran el diagnóstico. La combinación debe validarse con superficie disponible, perfil horario y excedentes antes de convertirla en un rango económico.' },
    bessSobreSolarExcedente: { tipo: 'BESS sobre solar existente', razon: 'Ya generas, y una parte se te va en excedente exportado o desperdiciado. La prioridad no es sumar más paneles: es un BESS que capture ese excedente, lo mueva a tus horas caras y suba el valor de la generación que ya instalaste.' },
    bessSobreSolar: { tipo: 'BESS sobre solar existente', razon: 'Ya tienes generación en sitio, así que sumar más Solar no es tu cuello de botella. La prioridad es un BESS que aproveche mejor lo que ya generas: cubrir el pico de demanda y mover energía a las horas caras.' },
    estacional: { tipo: 'BESS + Solar', razon: 'Generas parte del año y el resto pagas tarifa completa. La Solar llena ese hueco —coincide con la temporada de más sol— y la batería firma esa generación y ataca el pico.' },
    bessSolarDiurno: { tipo: 'BESS + Solar', razon: 'Tu consumo de día encaja con la generación solar, y la batería te cubre el pico de demanda y el horario punta nocturno. La combinación rinde más que cualquiera de las dos por separado.' },
    bess: { tipo: 'BESS', razon: 'Tu mayor oportunidad está en el pico de demanda y el arbitraje horario, no en generar energía. El BESS ataca eso directo; Solar queda como una fase 2 a evaluar sobre tus números.' },
    bessPreliminar: { tipo: 'BESS', razon: 'Con lo que sabemos hoy el BESS es el camino más probable, porque el pico de demanda y el arbitraje horario suelen ser donde está el dinero. Cuál de los dos manda en tu caso no lo podemos fijar sin tu perfil de consumo y tu recibo: es lo primero que revisamos en la llamada.' }
  },

  // ---- LIMITACIONES del diagnóstico ----
  limitaciones: {
    factura: { dato: 'Orden de magnitud de tu factura mensual', porque: 'Sin la escala del recibo no hay base para estimar el rango económico.', no_se_puede: 'Cuantificar el ahorro; sólo priorizar qué oportunidades aplican.' },
    tarifa: { dato: 'Tu tarifa de CFE', porque: 'Define cuánto pesa el cargo por demanda y si hay diferenciación horaria.', no_se_puede: 'Separar peak shaving de arbitraje ni confirmar elegibilidad de arbitraje.' },
    contrato: { dato: 'Estructura de tu contrato de suministro', porque: 'El arbitraje depende de si hay exposición a precios horarios del mercado.', no_se_puede: 'Confirmar si el margen es tuyo o de tu suministrador.' },
    perfil: { dato: 'Tu perfil horario de consumo', porque: 'Sin saber cuándo consumes no se distingue recortar pico de arbitrar.', no_se_puede: 'Fijar la oportunidad principal con confianza.' },
    techo: { dato: 'Superficie de techo o terreno disponible', porque: 'Define si la generación solar es viable en el sitio.', no_se_puede: 'Dimensionar un proyecto BESS o Solar.' },
    diesel: { dato: 'Horas al año que corre tu diésel y su costo', porque: 'Es lo que dimensiona el mayor margen del análisis.', no_se_puede: 'Cuantificar la sustitución de diésel.' },
    calidad: { dato: 'Comportamiento de tu calidad eléctrica', porque: 'Define si hay penalización por factor de potencia o riesgo a equipos.', no_se_puede: 'Valorar la oportunidad de calidad/factor de potencia.' },
    aislado: { dato: 'Consumo total (kWh/día), perfil horario y horas de autonomía requeridas', porque: 'Una microred aislada se dimensiona sobre el consumo y la autonomía, no sobre la factura.', no_se_puede: 'Dimensionar la microred ni su respaldo.' }
  },

  // ---- DATOS PARA EL ANTEPROYECTO (dos voces: interno = qué solicita el equipo;
  //      lead = qué prepara la persona). Se compone por familia en buildAnteproyecto:
  //      base siempre; + solar / + bess / (bess_solar = solar+bess) / + off_grid.
  //      Texto BORRADOR — pendiente de afinar. ----
  anteproyectoTitulo: 'Datos para el anteproyecto',
  anteproyectoTituloLead: 'Qué tener a mano para la llamada',
  anteproyecto: {
    base: {
      interno: [
        '12 recibos de CFE (kWh, demanda máxima en kW y tarifa).',
        'Perfil de carga u horario de operación de la propiedad.',
        'Capacidad del transformador y del tablero principal (diagrama unifilar).',
        'Superficie disponible en m² (techo o terreno).',
        'Objetivo prioritario (ahorro, respaldo o capacidad) y horizonte de decisión.'
      ],
      lead: [
        'Tus últimos 12 recibos de luz de CFE.',
        'A qué horas del día opera tu propiedad.',
        'Cuánto espacio libre tienes (techo o terreno).',
        'Qué es lo que más te urge resolver.',
        'Quién autoriza una inversión así y hasta qué monto.'
      ]
    },
    solar: {
      interno: [
        'Área, orientación y sombreado del techo o terreno; estado estructural.',
        'Consumo diurno frente al consumo total.',
        'Esquema tarifario disponible (net metering / net billing).'
      ],
      lead: [
        'Fotos del techo o del terreno donde irían los paneles.',
        'Si lo sabes, cuánta luz consumes durante el día.'
      ]
    },
    bess: {
      interno: [
        'Cargas críticas a respaldar (kW y kWh) y autonomía requerida.',
        'Demanda máxima y cargo por demanda del recibo.',
        'Frecuencia y duración de los cortes de energía.',
        'Espacio y ventilación para el gabinete de baterías.'
      ],
      lead: [
        'Qué equipos NO pueden apagarse y por cuánto tiempo.',
        'Cada cuánto se va la luz y cuánto dura.'
      ]
    },
    off_grid: {
      interno: [
        'Distancia a la red de CFE más cercana y factibilidad de conexión.',
        'Consumo diario (kWh/día) y pico de demanda.',
        'Generación actual (diésel: consumo, horas de uso y costo).',
        'Días de autonomía requeridos sin sol.'
      ],
      lead: [
        'Si hoy usas planta de diésel y cuántas horas al día.',
        'Qué tan lejos está la red eléctrica más cercana.'
      ]
    }
  },

  // ---- Resumen comercial en el resultado ----
  resumen: {
    potencialLabel: 'Encaje preliminar',
    recomendacionLabel: 'Configuración a evaluar',
    rankingLabel: 'Prioridad técnica',
    limitacionesLabel: 'Para cerrar el número, todavía falta',
    bessGlosa: 'BESS son las siglas de Battery Energy Storage System: un banco de baterías de grado industrial que almacena energía para usarla cuando más te conviene —recortar tu pico de demanda, mover consumo a horas baratas o sostener la operación ante un corte.',
    aplicaFrase: {
      'Muy Alto': 'tiene un encaje preliminar muy alto para tu hotel',
      'Alto': 'tiene buen encaje preliminar para tu hotel',
      'Medio': 'podría aplicar en tu hotel',
      'Bajo': 'requiere más datos antes de recomendarlo para tu hotel'
    }
  },

  postResult: {
    label: 'Precisar mi hotel'
  },

  emailVocabulary: {
    site: 'hotel',
    technicalContact: 'responsable de mantenimiento o ingeniería'
  },

  resultado: { reiniciar: 'Reiniciar diagnóstico' },
  progresoLabel: (n, total) => `Paso ${n} de ${total}`
};

export default content;
