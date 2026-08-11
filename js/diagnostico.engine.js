// Motor de reglas del funnel v2. Funciones puras, sin DOM. Importable en navegador
// y en Node (tests). Lee prioridades, condiciones y copy desde content.js.

// `disparador` es multi-select (array de códigos) desde v2.2. Estos helpers aceptan
// tanto el array como el string legado, para no romper llamadas ni fixtures previos.
export function asList(v) {
  return Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);
}
export function hasSignal(v, code) {
  return asList(v).includes(code);
}

// ¿La respuesta cumple todas las igualdades de `when`? Un campo con valor array
// (p. ej. disparador) cumple si el array incluye el valor buscado.
export function matchesWhen(resp, when) {
  return Object.entries(when).every(([campo, valor]) => {
    const actual = resp[campo];
    return Array.isArray(actual) ? actual.includes(valor) : actual === valor;
  });
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
  const labelDe = (paso, cod) => {
    const o = paso.opciones.find((op) => op.codigo === cod);
    return o ? o.label : cod;
  };
  for (const paso of content.pasos) {
    const val = resp[paso.key];
    if (Array.isArray(val)) {
      // Multi-select: array vacío se trata como ['costo'] (salvaguarda defensiva, v2.2).
      const codes = val.length ? val : (paso.multi ? ['costo'] : val);
      legibles[paso.key] = codes.map((cod) => labelDe(paso, cod)).join('; ');
    } else {
      legibles[paso.key] = labelDe(paso, val);
    }
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
  if (hasSignal(resp.disparador, 'diesel')) notas.push(b.dieselNota);

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
    pctRecortePiso: pct(rec[0]), pctRecorteTecho: pct(rec[1])
  });
  const rangoTexto = formatRango(piso, techo);
  const notaContinuo = resp.perfil === 'plano' ? b.continuoExtra : null;
  // `texto`: versión concatenada plana, para la nota del evento cal.diy (sin jerarquía visual).
  let texto = `${cadena}\n\n${b.rango(rangoTexto)}\n\n${b.disclaimer}`;
  if (notaContinuo) texto += `\n\n${notaContinuo}`;
  return { sinNumero: null, piso, techo, cadena, rangoTexto, disclaimer: b.disclaimer, notaContinuo, texto, notas };
}

// ---- BLOQUE C: palancas guiadas por el ranking ----
function textoPalanca(id, resp, content) {
  if (id === 'respaldo') {
    const v = content.palancasRespaldoVariantes[resp.corte];
    if (v) return v;
  }
  return content.palancasCopy[id].principal;
}

export function pickLevers(resp, ranking, content) {
  const copy = content.palancasCopy;
  const palancaDe = (o) => ({ nombre: copy[o.id].nombre, text: textoPalanca(o.id, resp, content) });

  const principal = palancaDe(ranking[0]);
  const segundo = ranking.find((o, i) => i > 0 && o.score >= content.scoring.umbralSecundaria);
  const secundaria = segundo ? palancaDe(segundo) : null;
  const factorPotencia = resp.calidad === 'factor'
    ? { nombre: content.palancaFactorPotencia.nombre, text: content.palancaFactorPotencia.text }
    : null;
  const ultimo = ranking[ranking.length - 1];
  const descartada = { nombre: copy[ultimo.id].nombre, text: copy[ultimo.id].descarte };
  const gancho = (resp.factura === 'nolose' || resp.tarifa === 'privado') ? content.gancho : null;

  return { gancho, principal, secundaria, factorPotencia, descartada };
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

// ---- LIMITACIONES: datos faltantes que impiden conclusiones firmes ----
export function detectLimitations(resp, scores, content) {
  const L = content.limitaciones;
  const out = [];
  if (resp.factura === 'nolose') out.push(L.factura);
  if (resp.tarifa === 'nolose') out.push(L.tarifa);
  else if (resp.tarifa === 'privado') out.push(L.contrato);
  if (resp.perfil === 'nolose') out.push(L.perfil);
  const sinGeneracion = resp.generacion === 'no' || resp.generacion === 'evaluando';
  if (sinGeneracion && scores.bess_solar >= content.scoring.umbralFuerte) out.push(L.techo);
  if (hasSignal(resp.disparador, 'diesel')) out.push(L.diesel);
  if (resp.calidad === 'nolose') out.push(L.calidad);
  return out;
}

// ---- CHECKLIST ----
export function buildChecklist(resp, content) {
  const ref = content.checklistRefuerzos;
  const tecnicos = [...content.checklistBase];
  if (hasSignal(resp.disparador, 'diesel')) tecnicos.push(ref.diesel);
  if (resp.corte !== 'nada') tecnicos.push(ref.paros);
  if (resp.sector === 'continuo') tecnicos.push(ref.horario);
  if (resp.tarifa === 'privado') tecnicos.push(ref.contrato);
  if (resp.generacion === 'estacional') tecnicos.push(ref.techo);
  if (resp.perfil === 'plano' || resp.perfil === 'punta' || resp.perfil === 'nolose') {
    if (!tecnicos.includes(ref.horario)) tecnicos.push(ref.horario);
  }
  if (resp.generacion === 'evaluando' && !tecnicos.includes(ref.techo)) tecnicos.push(ref.techo);
  if (resp.calidad === 'factor') tecnicos.push(ref.factorPotencia);

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
  const priorizacion = [
    '',
    `Potencial general: ${res.potencial_general}`,
    `Recomendación de solución: ${res.recomendacion_solucion.tipo}`,
    res.recomendacion_solucion.razon,
    '',
    'Ranking de oportunidades:',
    ...res.ranking.map((o, i) => `${i + 1}. ${o.nombre} — ${o.score}`),
    ...(res.limitaciones.length
      ? ['', 'Datos que faltan para cerrar el número:',
         ...res.limitaciones.map((l) => `• ${l.dato}: ${l.no_se_puede}`)]
      : [])
  ];
  return [
    'Diagnóstico Mexillum',
    '',
    res.perfil,
    '',
    bloqueBTexto,
    ...res.calculo.notas.map((n) => `\n${n}`),
    '',
    ...palancasLines,
    ...priorizacion,
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

// ---- SCORING de oportunidades ----
export function scoreOpportunities(resp, content) {
  const { oportunidades, pesos } = content.scoring;
  const out = {};
  for (const { id } of oportunidades) {
    let total = 0;
    const tabla = pesos[id] || {};
    for (const [campo, mapa] of Object.entries(tabla)) {
      // Campo multi-select (disparador): suma los puntos de cada señal presente.
      // Cada mapa de disparador tiene a lo sumo una clave relevante por oportunidad,
      // así que no hay doble conteo dentro de una misma oportunidad.
      for (const cod of asList(resp[campo])) {
        const pts = mapa[cod];
        if (typeof pts === 'number') total += pts;
      }
    }
    out[id] = Math.max(0, Math.min(100, total));
  }
  return out;
}

export function rankOpportunities(scores, content) {
  const orden = content.scoring.oportunidades;
  const prioridad = new Map(orden.map((o, i) => [o.id, i]));
  return orden
    .map((o) => ({ id: o.id, nombre: o.nombre, score: scores[o.id] }))
    .sort((a, b) => (b.score - a.score) || (prioridad.get(a.id) - prioridad.get(b.id)));
}

export function potencialGeneral(scores, resp, content) {
  const u = content.scoring.umbralPotencial;
  const valores = Object.values(scores);
  const s1 = Math.max(...valores);
  const niveles = ['Bajo', 'Medio', 'Alto', 'Muy Alto'];
  let idx = s1 >= u.muyAlto ? 3 : s1 >= u.alto ? 2 : s1 >= u.medio ? 1 : 0;
  const fuertes = valores.filter((v) => v >= content.scoring.umbralFuerte).length;
  if (fuertes >= content.scoring.minFuertesParaSubir) idx = Math.min(3, idx + 1);
  if (resp.factura === 'nolose' && (resp.tarifa === 'nolose' || resp.tarifa === 'privado')) {
    idx = Math.min(idx, 1);
  }
  return niveles[idx];
}

// ---- RECOMENDACIÓN de solución (BESS vs Solar) ----
export function recommendSolution(resp, scores, content) {
  const rec = content.recomendaciones;
  const bs = scores.bess_solar;
  const sinGeneracion = resp.generacion === 'no' || resp.generacion === 'evaluando';
  const tarifaCiega = resp.tarifa === 'nolose' || resp.tarifa === 'privado';
  let key;
  if (resp.generacion === 'fisica' && !hasSignal(resp.disparador, 'excedente')) key = 'noSolar';
  else if (resp.generacion === 'estacional') key = 'estacional';
  // Solar primero va ANTES que BESS+Solar: sin datos de tarifa no comprometemos la combinación.
  else if (resp.perfil === 'diurno' && sinGeneracion && tarifaCiega) key = 'solarPrimero';
  else if (bs >= 60 && sinGeneracion && resp.perfil === 'diurno') key = 'bessSolarDiurno';
  else key = 'bess';
  return { tipo: rec[key].tipo, razon: rec[key].razon };
}

// ---- Orquestador ----
export function assembleResult(estado, content) {
  const resp = estado.respuestas;
  const contacto = estado.contacto || {};
  const scores = scoreOpportunities(resp, content);
  const ranking = rankOpportunities(scores, content);
  const potencial_general = potencialGeneral(scores, resp, content);
  const recomendacion_solucion = recommendSolution(resp, scores, content);
  const perfil = buildProfile(resp, content);
  const bloqueB = renderBlockB(resp, content);
  const palancas = pickLevers(resp, ranking, content);
  const datoFaltante = pickMissingData(resp, content);
  const financiamiento = pickFinancing(resp, content);
  const checklist = buildChecklist(resp, content);
  const legibles = toReadable(resp, content);
  const limitaciones = detectLimitations(resp, scores, content);

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
    checklist_full: checklist.full,
    scores,
    ranking,
    potencial_general,
    recomendacion_solucion,
    limitaciones
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
    scores,                                  // scoring 0-100 por oportunidad
    ranking,                                 // oportunidades ordenadas desc
    potencial_general,                       // 'Muy Alto'|'Alto'|'Medio'|'Bajo'
    recomendacion_solucion,                  // { tipo, razon } BESS vs Solar
    limitaciones,                            // datos faltantes que impiden conclusiones firmes
    leadPayload
  };
  res.note = buildEventNote(res, resp, content, bloqueB.texto);
  return res;
}
