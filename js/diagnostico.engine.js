// Motor de reglas del funnel v2. Funciones puras, sin DOM. Importable en navegador
// y en Node (tests). Lee prioridades, condiciones y copy desde content.js.

// ¿La respuesta cumple todas las igualdades de `when`?
export function matchesWhen(resp, when) {
  return Object.entries(when).every(([campo, valor]) => resp[campo] === valor);
}

// Una sola instalación siempre: fraseo fijo.
export function plantaLabel() {
  return 'tu operación';
}

// BLOQUE A — línea de perfil.
export function buildProfile(resp, content) {
  const sector = content.perfilSector[resp.sector] || resp.sector;
  const exp = content.perfilExposicion.find((r) => matchesWhen(resp, r.when));
  const exposicion = exp ? exp.text : content.perfilExposicionDefault;
  return `Perfil: ${sector} ${exposicion}.`;
}

// Códigos internos → labels visibles, para las 8 keys.
export function toReadable(resp, content) {
  const legibles = {};
  for (const paso of content.pasos) {
    const opcion = paso.opciones.find((o) => o.codigo === resp[paso.key]);
    legibles[paso.key] = opcion ? opcion.label : resp[paso.key];
  }
  return legibles;
}

// ---- BLOQUE B: cálculo y formato ----

// Redondeo medio-a-par (banker's), reproduce el fixture del spec.
export function roundHalfEven(x, decimals) {
  const f = 10 ** decimals;
  const n = x * f;
  const floor = Math.floor(n);
  const diff = n - floor;
  const EPS = 1e-9;
  let r;
  if (Math.abs(diff - 0.5) < EPS) r = (floor % 2 === 0) ? floor : floor + 1;
  else r = Math.round(n);
  return r / f;
}

function millonesStr(n) {
  return roundHalfEven(n / 1e6, 1).toFixed(1);
}

export function formatMoney(n) {
  if (n >= 1e6) return `$${millonesStr(n)} millones`;
  const miles = Math.round(n / 10000) * 10000;
  return `$${miles.toLocaleString('en-US')}`;
}

export function formatRango(piso, techo) {
  if (piso >= 1e6 && techo >= 1e6) {
    return `$${millonesStr(piso)} a $${millonesStr(techo)} millones de MXN al año`;
  }
  return `${formatMoney(piso)} a ${formatMoney(techo)} de MXN al año`;
}

// Cálculo puro del rango. privado > nolose en precedencia.
export function computeRange(resp, content) {
  if (resp.tarifa === 'privado') return { sinNumero: 'privado', piso: null, techo: null };
  if (resp.factura === 'nolose') return { sinNumero: 'nolose', piso: null, techo: null };
  const factura = content.tablaFactura[resp.factura];
  const dem = content.tablaDemanda[resp.tarifa];
  const rec = content.tablaRecorte[resp.perfil];
  if (factura == null || dem == null || rec == null) {
    return { sinNumero: 'nolose', piso: null, techo: null }; // defensivo
  }
  return {
    sinNumero: null,
    piso: factura * 12 * dem[0] * rec[0],
    techo: factura * 12 * dem[1] * rec[1]
  };
}

// Presentación del bloque B.
export function renderBlockB(resp, content) {
  const b = content.bloqueB;
  const { sinNumero, piso, techo } = computeRange(resp, content);
  const notas = [];
  if (resp.disparador === 'diesel') notas.push(b.dieselNota);

  // Salidas sin número: la `cadena` es el copy explicativo, sin rango/disclaimer/nota destacables.
  if (sinNumero === 'privado') {
    return { sinNumero, piso, techo, cadena: b.privado, rangoTexto: null, disclaimer: null, notaContinuo: null, texto: b.privado, notas };
  }
  if (sinNumero === 'nolose') {
    return { sinNumero, piso, techo, cadena: b.noloseFactura, rangoTexto: null, disclaimer: null, notaContinuo: null, texto: b.noloseFactura, notas };
  }

  const factura = content.tablaFactura[resp.factura];
  const dem = content.tablaDemanda[resp.tarifa];
  const rec = content.tablaRecorte[resp.perfil];
  const pct = (x) => Math.round(x * 100);
  const cadena = b.plantilla({
    facturaLegible: formatMoney(factura),
    tarifaLegible: content.tarifaLegible[resp.tarifa],
    pctDemandaPiso: pct(dem[0]), pctDemandaTecho: pct(dem[1]),
    montoDemandaPiso: formatMoney(factura * 12 * dem[0]),
    montoDemandaTecho: formatMoney(factura * 12 * dem[1]),
    pctRecortePiso: pct(rec[0]), pctRecorteTecho: pct(rec[1])
  });
  const rangoTexto = formatRango(piso, techo);
  const notaContinuo = resp.perfil === 'plano' ? b.continuoExtra : null;
  // `texto`: versión concatenada plana, para la nota del evento cal.diy (sin jerarquía visual).
  let texto = `${cadena}\n\n${b.rango(rangoTexto)}\n\n${b.disclaimer}`;
  if (notaContinuo) texto += `\n\n${notaContinuo}`;
  return { sinNumero: null, piso, techo, cadena, rangoTexto, disclaimer: b.disclaimer, notaContinuo, texto, notas };
}

// ---- BLOQUE C: palancas jerarquizadas ----
const pick = (r) => (r ? { nombre: r.nombre, text: r.text } : null);

export function pickLevers(resp, content) {
  // Gancho educativo solo cuando el bloque B no calculó número.
  const gancho = (resp.factura === 'nolose' || resp.tarifa === 'privado') ? content.gancho : null;
  const principalRule = content.palancasPrincipal.find((r) => matchesWhen(resp, r.when)) || content.palancaPrincipalDefault;
  const secundariaRule = content.palancasSecundaria.find((r) => matchesWhen(resp, r.when) && r.id !== principalRule.id) || null;
  // Cambio 1: 6º nivel de precedencia — default de descarte, solo si ninguna regla 1–5 aplicó.
  // Así ningún resultado queda sin línea "No aplica —".
  const descartadaRule = content.palancasDescartada.find((r) => matchesWhen(resp, r.when))
    || (resp.sector === 'ev' ? content.palancaDescartadaDefault.solar : content.palancaDescartadaDefault.arbitraje);
  // Factor de potencia: aditiva, disparada por la señal de calidad correcta.
  const factorPotencia = resp.calidad === 'factor' ? content.palancaFactorPotencia : null;
  return {
    gancho,
    principal: pick(principalRule),
    secundaria: pick(secundariaRule),
    factorPotencia: pick(factorPotencia),
    descartada: pick(descartadaRule)
  };
}

// ---- BLOQUE D: el dato que falta ----
export function pickMissingData(resp, content) {
  const eq = content.datoFaltante.find((r) => matchesWhen(resp, r.when));
  let dato;
  if (eq) dato = eq.text;
  else if (resp.corte !== 'nada') dato = content.datoFaltanteCorte;
  else dato = content.datoFaltanteDefault;
  return { dato, cierre: content.cierreComun };
}

// ---- BLOQUE E: financiamiento (opción sujeta a evaluación) ----
export function ofreceServicio(resp) {
  return resp.factura !== 'muyalto';
}

export function pickFinancing(resp, content) {
  const regla = content.financiamiento.find((r) => matchesWhen(resp, r.when));
  return regla ? regla.text : content.financiamientoDefault;
}

// ---- CHECKLIST ----
export function buildChecklist(resp, content) {
  const ref = content.checklistRefuerzos;
  const tecnicos = [...content.checklistBase];
  if (resp.disparador === 'diesel') tecnicos.push(ref.diesel);
  if (resp.corte !== 'nada') tecnicos.push(ref.paros);
  if (resp.sector === 'continuo') tecnicos.push(ref.horario);
  if (resp.tarifa === 'privado') tecnicos.push(ref.contrato);
  if (resp.generacion === 'estacional') tecnicos.push(ref.techo);

  const viabilidad = ofreceServicio(resp)
    ? (resp.sector === 'publico' ? content.checklistViabilidad.publico : content.checklistViabilidad.privado)
    : null;

  const full = [...tecnicos, ...(viabilidad ? [viabilidad] : []), content.checklistUniversal];

  const webContent = tecnicos.slice(0, 4);
  if (viabilidad && webContent.length < 4) webContent.push(viabilidad);
  const web = [...webContent, content.checklistUniversal];

  return { web, full };
}

// ---- Nota del evento cal.diy (texto plano, sin recorte) ----
// Consume el resultado estructurado + el texto plano concatenado del bloque B.
export function buildEventNote(res, resp, content, bloqueBTexto) {
  const p = res.palancas;
  const palancasLines = [
    'Palancas:',
    ...(res.gancho ? [res.gancho] : []),
    `Principal — ${p.principal.nombre}: ${p.principal.text}`,
    ...(p.secundaria ? [`Secundaria — ${p.secundaria.nombre}: ${p.secundaria.text}`] : []),
    ...(p.factorPotencia ? [`Secundaria — ${p.factorPotencia.nombre}: ${p.factorPotencia.text}`] : []),
    // descarte: siempre presente tras el Cambio 1.
    ...(p.descarte ? [`No aplica — ${p.descarte.nombre}: ${p.descarte.text}`] : [])
  ];
  const legibles = res.leadPayload.respuestas_legibles;
  return [
    'Diagnóstico Mexillum',
    '',
    res.perfil,
    '',
    bloqueBTexto,
    ...res.calculo.notas.map((n) => `\n${n}`),
    '',
    ...palancasLines,
    '',
    res.dato_faltante,
    res.cierre_llamada,
    '',
    res.financiamiento,
    '',
    'Preparar para la llamada:',
    ...res.checklist.full.map((b) => `• ${b}`),
    '',
    'Respuestas del formulario:',
    ...content.pasos.map((paso, i) => `${i + 1}. ${paso.notaLabel}: ${legibles[paso.key]}`)
  ].join('\n');
}

// ---- Orquestador ----
export function assembleResult(estado, content) {
  const resp = estado.respuestas;
  const contacto = estado.contacto || {};
  const perfil = buildProfile(resp, content);
  const bloqueB = renderBlockB(resp, content);
  const palancas = pickLevers(resp, content);
  const datoFaltante = pickMissingData(resp, content);
  const financiamiento = pickFinancing(resp, content);
  const checklist = buildChecklist(resp, content);
  const legibles = toReadable(resp, content);

  // rango_texto del lead: mensaje legible incluso sin número (mail a ventas).
  const rango_texto = bloqueB.sinNumero
    ? (bloqueB.sinNumero === 'privado'
        ? 'Suministrador privado — sin rango numérico'
        : 'Factura sin especificar — sin rango numérico')
    : bloqueB.rangoTexto;

  const leadPayload = {
    lead_id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
    timestamp: new Date().toISOString(),
    nombre: contacto.nombre || '',
    empresa: contacto.empresa || '',
    correo: contacto.correo || '',
    telefono: contacto.telefono || '',
    rol: contacto.rol || '',
    respuestas_legibles: legibles,
    respuestas_codigos: { ...resp },
    perfil,
    rango_texto,
    checklist_full: checklist.full
  };

  // Cambio 4: salida como objeto estructurado para que el HTML jerarquice cada parte.
  const res = {
    perfil,                                  // Bloque A
    calculo: {                               // Bloque B, desglosado
      cadena: bloqueB.cadena,                // explicación con aritmética (monto de demanda subordinado)
      rango_texto: bloqueB.rangoTexto,       // el número a destacar (null si sin número)
      disclaimer: bloqueB.disclaimer,
      nota_continuo: bloqueB.notaContinuo,   // matiz 24/7, si aplica
      sin_numero: bloqueB.sinNumero != null,
      notas: bloqueB.notas                   // p. ej. nota de diésel
    },
    gancho: palancas.gancho,                 // frase-gancho del Bloque C (casi siempre null, Cambio 2)
    palancas: {                              // Bloque C
      principal: palancas.principal,
      secundaria: palancas.secundaria,
      factorPotencia: palancas.factorPotencia, // secundaria adicional, solo frío (Cambio 3)
      descarte: palancas.descartada          // SIEMPRE presente (Cambio 1)
    },
    dato_faltante: datoFaltante.dato,        // Bloque D
    cierre_llamada: datoFaltante.cierre,     // Bloque D cierre común
    financiamiento,                          // Bloque E
    checklist,                               // interno: consumo por vista/nota/lead
    leadPayload
  };
  res.note = buildEventNote(res, resp, content, bloqueB.texto);
  return res;
}
