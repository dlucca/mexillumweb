// Todo el copy y las reglas del funnel v2, como datos. Cambiar contenido o reordenar
// prioridades = editar este archivo. Sin lógica: engine.js lee de acá. Copy es-MX (tuteo).

const content = {
  intro: {
    titulo: 'Diagnóstico energético en 2 minutos',
    cuerpo: 'Ocho preguntas de opción múltiple sobre tu operación. Al final ves qué oportunidades de ahorro aplican a tu planta, cuál atacar primero, un orden de magnitud de lo que hay en juego, y qué datos preparar para volverlo un número exacto.',
    // El resultado se renderiza completo antes del gate (ver renderResult en view.js):
    // el pie lo dice explícitamente porque es la objeción principal del tráfico frío.
    pie: 'Sin costo y sin formulario: el diagnóstico aparece completo al terminar. Tus datos solo si quieres agendar la llamada.',
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
        { label: 'Sí — tenemos solar en sitio (detrás del medidor)', codigo: 'solar_sitio' },
        { label: 'Tenemos contrato renovable o suministro privado', codigo: 'contrato' },
        { label: 'Generamos parte del año (cogeneración, zafra, estacional)', codigo: 'estacional' },
        { label: 'No, compramos todo de CFE o de un suministrador', codigo: 'no' },
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
      key: 'disparador', notaLabel: 'Disparador', multi: true,
      pregunta: 'Además de la factura, ¿algo de esto te suena familiar?',
      hint: 'Cada una señala una oportunidad de ahorro distinta — puedes marcar más de una.',
      opciones: [
        { label: 'Queremos crecer o ampliar carga, y CFE no da capacidad (o tarda)', codigo: 'capacidad' },
        { label: 'Usamos diésel o planta de emergencia con frecuencia', codigo: 'diesel' },
        { label: 'Generamos excedente que exportamos o se desperdicia', codigo: 'excedente' },
        { label: 'Ninguna, nuestro tema es puramente el costo', codigo: 'costo', exclusiva: true }
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
    // Sin repetir "proceso continuo": perfilSector.continuo ya lo dice (mejora #2).
    { when: { sector: 'continuo' }, text: 'con exposición estructural a horario punta' },
    { when: { disparador: 'capacidad' }, text: 'con restricción de capacidad eléctrica' },
    { when: { disparador: 'diesel' }, text: 'con dependencia de diésel' }
  ],
  perfilExposicionDefault: 'con exposición a cargo por demanda',

  // ---- SCORING (datos; engine.js sólo suma) ----
  scoring: {
    oportunidades: [
      { id: 'peak_shaving', nombre: 'Peak Shaving' },
      { id: 'arbitraje', nombre: 'Arbitraje tarifario' },
      { id: 'bess_solar', nombre: 'BESS + Solar' },
      { id: 'respaldo', nombre: 'Respaldo' },
      { id: 'diferimiento', nombre: 'Diferimiento de capacidad' },
      { id: 'diesel', nombre: 'Sustitución de diésel' }
    ],
    pesos: {
      peak_shaving: {
        perfil: { picos: 50, diurno: 38, punta: 32, plano: 8, nolose: 18 },
        tarifa: { gdmth: 25, dist: 25, otra: 12, nolose: 8, privado: 0 },
        factura: { muyalto: 18, alto: 14, medio: 9, bajo: 4, nolose: 6 },
        sector: { frio: 7, ev: 7, manufactura: 4, continuo: 0, publico: 0 },
        calidad: { factor: 5 }
      },
      arbitraje: {
        tarifa: { gdmth: 38, dist: 18, privado: 12, otra: 6, nolose: 8 },
        perfil: { plano: 34, punta: 34, diurno: 14, picos: 8, nolose: 14 },
        sector: { continuo: 14 },
        disparador: { excedente: 14 },
        factura: { muyalto: 10, alto: 7, medio: 4 }
      },
      bess_solar: {
        // Recalibrado (mejora #2): sube por señales explícitas de generación/solar,
        // baja por "no generamos". Evita recomendar BESS+Solar solo por consumo diurno
        // (el cap de más abajo se encarga de eso).
        generacion: { solar_sitio: 22, contrato: 6, estacional: 34, evaluando: 24, no: 10 },
        perfil: { diurno: 34, plano: 16, picos: 10, punta: 8, nolose: 14 },
        disparador: { excedente: 16 },
        sector: { publico: 6, ev: 6, frio: 6 }
      },
      respaldo: {
        corte: { producto: 52, reinicio: 42, servicio: 40, nada: 0 },
        calidad: { cortes: 20, variaciones: 14 },
        sector: { frio: 12, continuo: 10 },
        disparador: { diesel: 8 }
      },
      diferimiento: {
        disparador: { capacidad: 62 },
        sector: { ev: 26 },
        perfil: { picos: 12, punta: 6 },
        factura: { muyalto: 8, alto: 4 }
      },
      diesel: {
        // Puro: sin diésel no hay nada que sustituir, así que el score depende sólo
        // de disparador==='diesel'. Cualquier entrada corte/calidad filtraría puntos
        // a plantas sin diésel (ver test "prácticamente binario").
        disparador: { diesel: 72 }
      }
    },
    // Capa declarativa (mejora #4): puntos extra por combinaciones y techos por
    // condición crítica ausente. El engine las aplica sobre la suma base.
    // boosts: puntos extra si la respuesta cumple TODAS las igualdades de `when`.
    boosts: [
      { id: 'peak_shaving', when: { perfil: 'picos', tarifa: 'gdmth' }, pts: 8 },
      { id: 'arbitraje', when: { perfil: 'punta', tarifa: 'gdmth' }, pts: 8 },
      { id: 'bess_solar', when: { generacion: 'solar_sitio', disparador: 'excedente' }, pts: 14 }
    ],
    // caps: si `requiere` NO se cumple (falta la condición crítica), el score de esa
    // oportunidad se limita a `max`. `requiere` lista los valores admisibles por campo.
    caps: [
      // BESS + Solar necesita señal real de solar/generación; sin solar en sitio, sin
      // evaluación de solar y sin estacionalidad, se limita (el funnel no captura techo/terreno).
      { id: 'bess_solar', max: 45, requiere: { generacion: ['solar_sitio', 'estacional', 'evaluando'] } },
      // Arbitraje depende de conocer la tarifa (diferenciación horaria).
      { id: 'arbitraje', max: 40, requiere: { tarifa: ['gdmth', 'dist', 'otra', 'privado'] } },
      // Sustitución de diésel: sin la señal de diésel no hay combustible que desplazar.
      { id: 'diesel', max: 0, requiere: { disparador: ['diesel'] } }
    ],
    umbralPotencial: { muyAlto: 75, alto: 60, medio: 40 },
    umbralFuerte: 60,
    minFuertesParaSubir: 3,
    umbralSecundaria: 40,
    // Aplicación principal: qué lidera comercialmente cuando el ranking por score no
    // lo captura. Se evalúan en orden (primera que aplica gana); si ninguna aplica,
    // manda el top del ranking. Usan la misma gramática de reglas que boosts/caps.
    //   fuerte: la oportunidad debe llegar a umbralFuerte.
    //   margenTop: además, no puede quedar más de N puntos debajo del líder del ranking.
    aplicacionPrincipal: [
      // Diésel declarado siempre lidera: ahorra por peso desplazado, no por score.
      { id: 'diesel', when: { disparador: 'diesel' } },
      // Restricción de capacidad: lidera si el diferimiento tiene peso propio.
      { id: 'diferimiento', when: { disparador: 'capacidad' }, fuerte: true },
      // Respaldo: un corte caro manda, pero no cuando el ranking lo supera por mucho
      // (ahí el caso económico sigue siendo el pico/arbitraje y el respaldo es requisito).
      { id: 'respaldo',
        anyOf: [{ corte: ['producto', 'reinicio', 'servicio'] }, { calidad: 'cortes' }],
        fuerte: true, margenTop: 20 }
    ]
  },

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
    continuoExtra: 'Y en una operación que no para como la tuya, el recorte de pico no suele ser lo que más rinde — el arbitraje horario sí, porque compras en punta todos los días. Eso se suma y se calcula con tu desglose horario.',
    noloseFactura: 'Para dar un orden de magnitud necesitamos la escala de tu factura — es el primer dato del checklist. Lo que sí podemos adelantarte es qué oportunidades aplican a tu perfil:',
    privado: 'Como compras a un suministrador privado, tu ahorro depende de la estructura de tu contrato — si tienes exposición a precios horarios del mercado, hay arbitraje; si es precio fijo, el margen se lo queda tu suministrador. Es la primera pregunta que resolvemos en la llamada.',
    dieselNota: 'Y ojo: la sustitución de diésel ahorra por peso desplazado, no por porcentaje de factura — suele ser el de mayor margen del análisis, y lo dimensionamos con tus horas de operación.'
  },

  // ---- BLOQUE C ----
  gancho: 'La mayoría de las empresas no sabe que una parte grande de su recibo no es energía que consumió, sino un cargo por su pico de demanda. Eso es exactamente lo primero que revisamos.',
  palancasCopy: {
    peak_shaving: {
      nombre: 'Recorte de demanda (peak shaving)',
      principal: 'Tu momento de mayor consumo fija un cargo que pesa sobre toda la factura, aunque dure minutos. Recortarlo con batería es de lo más directo en tu perfil.',
      descarte: 'En tu perfil el recorte de pico rinde poco: tu consumo no está concentrado en picos marcados. No te lo vendemos como el gran ahorro.'
    },
    arbitraje: {
      nombre: 'Arbitraje horario',
      principal: 'Compras energía en horario punta de forma recurrente. Trasladar ese consumo a horas baratas con la batería es tu mayor oportunidad.',
      descarte: 'Salvo que tu consumo esté concentrado en punta, arbitrar entre horarios rinde menos que atacar el pico directo. Lo verificamos con tu desglose horario.'
    },
    bess_solar: {
      nombre: 'BESS + Solar',
      principal: 'Tu consumo y tu perfil dan espacio para generar y almacenar: la batería aprovecha la generación y cubre el pico. Ahí está el mayor valor combinado.',
      descarte: 'Generar energía no es tu cuello de botella hoy; el foco está en la demanda y el pico, no en sumar generación.'
    },
    respaldo: {
      nombre: 'Respaldo',
      principal: 'Un corte te cuesta caro. La batería sostiene la operación en los momentos críticos y protege lo que un apagón se lleva.',
      descarte: 'Si un corte no te cuesta dinero relevante, pagar por continuidad no tiene sentido — tu caso es de costo, no de respaldo.'
    },
    diferimiento: {
      nombre: 'Diferimiento de capacidad',
      principal: 'Ampliar tu acometida con CFE puede tomar meses o años. El almacenamiento te deja crecer sin esperar esa ampliación.',
      descarte: 'No hay una restricción de capacidad que resolver hoy; el diferimiento no aplica en tu caso.'
    },
    diesel: {
      nombre: 'Sustitución de diésel',
      principal: 'Cada hora de diésel cuesta un múltiplo de la red. Desplazarlo con almacenamiento suele ser la oportunidad de mayor margen.',
      descarte: 'No dependes de diésel, así que no hay consumo de combustible que desplazar.'
    }
  },
  palancasRespaldoVariantes: {
    producto: 'Un corte te cuesta producto perdido — la batería protege ese inventario en el momento crítico.',
    reinicio: 'Cada paro te cuesta horas de reinicio; la batería evita esa pérdida.',
    servicio: 'Cada hora sin energía es ingreso perdido — la batería lo sostiene.'
  },
  // Palanca secundaria adicional, solo perfil frío/logística (carga dominada por compresores).
  // Cualitativa: NO entra al rango numérico del bloque B (Cambio 3).
  palancaFactorPotencia: { id: 'factor_potencia', nombre: 'Corrección de factor de potencia', text: 'El inversor del sistema aporta reactiva. Si tu recibo trae penalización por bajo factor de potencia, es ahorro que no requiere capacidad de batería adicional. Se lee directo de la factura.' },

  // ---- BLOQUE D ----
  // Hard-gaps: datos que bloquean cualquier número; tienen prioridad sobre el ranking.
  datoFaltante: [
    { when: { factura: 'nolose' }, text: 'Para volver esto un número exacto, el dato clave es tu recibo de CFE — con 12 meses vemos tu cargo por demanda real y tu perfil horario.' },
    { when: { tarifa: 'privado' }, text: 'El dato que define tu caso es la estructura de tu contrato de suministro — si tienes exposición a precios horarios del mercado, hay arbitraje; si es precio fijo, el margen se lo queda tu suministrador. Es la primera pregunta que resolvemos en la llamada.' }
  ],
  // Dato faltante principal según la oportunidad mejor rankeada (mejora #5).
  datoFaltantePorOportunidad: {
    peak_shaving: 'El dato que dimensiona tu ahorro es tu demanda máxima y cuánto pesa el cargo por demanda en tu recibo — se lee de tus últimos 12 meses de CFE.',
    arbitraje: 'El dato que define tu arbitraje es tu desglose de consumo por horario (base, intermedia, punta) — se lee de tu recibo GDMTH.',
    bess_solar: 'El dato que dimensiona un proyecto BESS + Solar es tu superficie de techo o terreno disponible y el excedente que hoy inyectas o desperdicias — con eso vemos cuánto puedes generar y almacenar.',
    respaldo: 'El dato que cierra el caso de respaldo es cuántos paros por causa eléctrica tuviste y qué costó cada uno — casi nadie lo mide, y suele ser mayor de lo esperado.',
    diferimiento: 'El dato que define tu diferimiento es cuánta capacidad tienes contratada, cuánta necesitas para crecer y si ya hay una solicitud de aumento con CFE.',
    diesel: 'El dato que dimensiona tu ahorro son las horas al año que corre tu diésel y su costo — ahí está el mayor margen del análisis.'
  },
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
    techo: 'Superficie de techo o terreno disponible para generación',
    solar: 'Capacidad de tu sistema solar en sitio y cuánto excedente inyectas o se desperdicia',
    factorPotencia: 'Recibo con el detalle de penalización por bajo factor de potencia, si aplica'
  },
  checklistViabilidad: {
    publico: 'Marco de contratación aplicable — si te interesa la estructura de contrato de servicio, conviene identificar bajo qué figura de adquisición puede la entidad contratarlo. Lo revisamos juntos.',
    privado: 'Perfil de la empresa para evaluar el esquema sin inversión — antigüedad y facturación aproximada, solo si te interesa explorar esa vía. Nos permite ver si es viable para tu caso.'
  },
  checklistUniversal: 'Quién decide y umbral de autorización.',
  checklistTitulo: 'Antes de tu llamada, te sirve tener a mano:',
  checklistPie: 'No hace falta tenerlo todo listo — con lo que tengas alcanza para empezar.',

  // ---- RECOMENDACIÓN de solución ----
  recomendaciones: {
    bessSobreSolarExcedente: { tipo: 'BESS sobre solar existente', razon: 'Ya generas, y una parte se te va en excedente exportado o desperdiciado. La prioridad no es sumar más Solar: es un BESS que capture ese excedente, lo mueva a tus horas caras y suba el valor de la generación que ya instalaste.' },
    bessSobreSolar: { tipo: 'BESS sobre solar existente', razon: 'Ya tienes generación en sitio, así que sumar más Solar no es tu cuello de botella. La prioridad es un BESS que aproveche mejor lo que ya generas: cubrir el pico de demanda y mover energía a las horas caras.' },
    estacional: { tipo: 'BESS + Solar', razon: 'Generas parte del año y el resto pagas tarifa completa. La Solar llena ese hueco —coincide con la temporada de más sol— y la batería firma esa generación y ataca el pico.' },
    bessSolarDiurno: { tipo: 'BESS + Solar', razon: 'Tu consumo de día encaja con la generación solar, y la batería te cubre el pico y la tarde-noche. La combinación rinde más que cualquiera de las dos por separado.' },
    solarPrimero: { tipo: 'Solar primero', razon: 'Con consumo diurno y sin datos de tarifa todavía, Solar es la apuesta más robusta para empezar a bajar el recibo; el BESS se dimensiona después con tu perfil real.' },
    bess: { tipo: 'BESS', razon: 'Tu mayor oportunidad está en el pico de demanda y el arbitraje horario, no en generar energía. El BESS ataca eso directo; Solar queda como una fase 2 a evaluar sobre tus números.' },
    // Mismo tipo que `bess`, razón conservadora: sin perfil horario ni recibo no hay
    // base para afirmar cuál palanca manda (evita sobreafirmar en el caso ciego).
    bessPreliminar: { tipo: 'BESS', razon: 'Con lo que sabemos hoy el BESS es el camino más probable, porque el pico de demanda y el arbitraje horario suelen ser donde está el dinero. Cuál de los dos manda en tu caso no lo podemos fijar sin tu perfil de consumo y tu recibo: es lo primero que revisamos en la llamada.' }
  },

  // ---- LIMITACIONES del diagnóstico ----
  limitaciones: {
    factura: { dato: 'Orden de magnitud de tu factura mensual', porque: 'Sin la escala del recibo no hay base para estimar el rango económico.', no_se_puede: 'Cuantificar el ahorro; sólo priorizar qué oportunidades aplican.' },
    tarifa: { dato: 'Tu tarifa de CFE', porque: 'Define cuánto pesa el cargo por demanda y si hay diferenciación horaria.', no_se_puede: 'Separar peak shaving de arbitraje ni confirmar elegibilidad de arbitraje.' },
    contrato: { dato: 'Estructura de tu contrato de suministro', porque: 'El arbitraje depende de si hay exposición a precios horarios del mercado.', no_se_puede: 'Confirmar si el margen es tuyo o de tu suministrador.' },
    perfil: { dato: 'Tu perfil horario de consumo', porque: 'Sin saber cuándo consumes no se distingue recortar pico de arbitrar.', no_se_puede: 'Fijar la oportunidad principal con confianza.' },
    techo: { dato: 'Superficie de techo o terreno disponible', porque: 'Define si la generación solar es viable en el sitio.', no_se_puede: 'Dimensionar un proyecto BESS + Solar.' },
    diesel: { dato: 'Horas al año que corre tu diésel y su costo', porque: 'Es lo que dimensiona el mayor margen del análisis.', no_se_puede: 'Cuantificar la sustitución de diésel.' },
    calidad: { dato: 'Comportamiento de tu calidad eléctrica', porque: 'Define si hay penalización por factor de potencia o riesgo a equipos.', no_se_puede: 'Valorar la oportunidad de calidad/factor de potencia.' }
  },

  // ---- Resumen comercial en el resultado (mejora #1) ----
  resumen: {
    potencialLabel: 'Potencial de ahorro',
    recomendacionLabel: 'Recomendación',
    rankingLabel: 'Dónde está tu mayor oportunidad',
    limitacionesLabel: 'Para cerrar el número, todavía falta'
  },

  resultado: { reiniciar: 'Reiniciar diagnóstico' },
  progresoLabel: (n, total) => `Paso ${n} de ${total}`
};

export default content;
