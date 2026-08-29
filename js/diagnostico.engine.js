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

// ¿La respuesta satisface un `requiere` de cap? Cada campo debe tener al menos uno
// de los valores admisibles (campo array como disparador: basta una coincidencia).
function satisfiesRequire(resp, requiere) {
  return Object.entries(requiere).every(([campo, permitidos]) =>
    asList(resp[campo]).some((v) => permitidos.includes(v)));
}

// ¿La respuesta cumple todas las igualdades de `when`? Un campo con valor array
// (p. ej. disparador) cumple si el array incluye el valor buscado.
export function matchesWhen(resp, when) {
  return Object.entries(when).every(([campo, valor]) => {
    const actual = resp[campo];
    return Array.isArray(actual) ? actual.includes(valor) : actual === valor;
  });
}

// ¿La respuesta cumple una condición? Como matchesWhen, pero el valor esperado puede
// ser un array de admisibles: { perfil: ['punta', 'plano'] } cumple con cualquiera.
function condMatches(resp, cond) {
  return Object.entries(cond).every(([campo, esperado]) => {
    const admisibles = Array.isArray(esperado) ? esperado : [esperado];
    const actual = resp[campo];
    return Array.isArray(actual)
      ? actual.some((v) => admisibles.includes(v))
      : admisibles.includes(actual);
  });
}

// Una condición suelta ({ tarifa: 'gdmth' }) se acepta donde se espera una regla.
function asRule(r) {
  return ('when' in r || 'allOf' in r || 'anyOf' in r) ? r : { when: r };
}

// Regla declarativa (mejora #6): combina `when` (igualdades, compat con reglas
// existentes), `allOf` (todas las condiciones) y `anyOf` (al menos una). Las tres son
// opcionales y se combinan con AND; una regla sin condiciones aplica siempre.
export function matchesRule(resp, rule) {
  if (rule.when && !condMatches(resp, rule.when)) return false;
  if (rule.allOf && !rule.allOf.every((c) => condMatches(resp, c))) return false;
  if (rule.anyOf && !rule.anyOf.some((c) => condMatches(resp, c))) return false;
  return true;
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

// Cálculo puro del rango. Las tarifas sin estructura compatible se detienen antes
// de aplicar porcentajes genéricos de cargo por demanda.
export function computeRange(resp, content) {
  if (resp.tarifa === 'privado') return { sinNumero: 'privado', piso: null, techo: null };
  if (resp.tarifa === 'pdbt') return { sinNumero: 'pdbt', piso: null, techo: null };
  if (resp.tarifa === 'nolose') return { sinNumero: 'tarifa', piso: null, techo: null };
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
export function renderBlockB(resp, content, aplicacion) {
  const b = content.bloqueB;
  const { sinNumero, piso, techo } = computeRange(resp, content);
  const notas = [];
  if (hasSignal(resp.disparador, 'diesel')) notas.push(b.dieselNota);

  const salidaSinNumero = (motivo, cadena) => ({
    sinNumero: motivo, piso: null, techo: null, cadena, rangoTexto: null,
    disclaimer: null, notaContinuo: null, texto: cadena, notas
  });

  // Salidas sin número: la `cadena` es el copy explicativo, sin rango/disclaimer/nota destacables.
  if (sinNumero === 'privado') {
    return salidaSinNumero(sinNumero, b.privado);
  }
  if (sinNumero === 'pdbt') {
    return salidaSinNumero(sinNumero, b.pdbt);
  }
  if (sinNumero === 'tarifa') {
    return salidaSinNumero(sinNumero, b.noloseTarifa);
  }
  if (sinNumero === 'nolose') {
    return salidaSinNumero(sinNumero, b.noloseFactura);
  }

  const aplicacionId = aplicacion?.id || 'peak_shaving';

  // Arbitraje: cuando lidera y hay tarifa horaria (GDMTH/DIST) + factura, sí damos un
  // rango. El ahorro se estima como % del recibo anual según el perfil de carga
  // (tablaArbitraje). Los % están anclados a la estructura GDMTH: punta ~2-2.5x base,
  // energía ~60% del recibo, y la porción de consumo que cae en punta según el perfil.
  if (aplicacionId === 'arbitraje' && content.tablaArbitraje) {
    const arb = content.tablaArbitraje[resp.tarifa] ? content.tablaArbitraje[resp.tarifa][resp.perfil] : content.tablaArbitraje[resp.perfil];
    const facturaArb = content.tablaFactura[resp.factura];
    if (arb && facturaArb != null) {
      const cadena = b.arbitrajePlantilla({
        facturaLegible: formatMoney(facturaArb),
        tarifaLegible: content.tarifaLegible[resp.tarifa],
        pctPiso: Math.round(arb[0] * 100), pctTecho: Math.round(arb[1] * 100)
      });
      const pisoArb = facturaArb * 12 * arb[0];
      const techoArb = facturaArb * 12 * arb[1];
      const rangoTexto = formatRango(pisoArb, techoArb);
      const texto = `${cadena}\n\n${b.rango(rangoTexto)}\n\n${b.disclaimer}`;
      return { sinNumero: null, piso: pisoArb, techo: techoArb, cadena, rangoTexto, disclaimer: b.disclaimer, notaContinuo: null, texto, notas };
    }
  }

  if (aplicacionId !== 'peak_shaving') {
    const cadena = b.sinRangoPorAplicacion[aplicacionId] || b.noloseFactura;
    return salidaSinNumero(`aplicacion:${aplicacionId}`, cadena);
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

export function pickLevers(resp, ranking, content, aplicacion) {
  const copy = content.palancasCopy;
  const palancaDe = (o) => ({ nombre: copy[o.id].nombre, text: textoPalanca(o.id, resp, content) });

  const principalRank = ranking.find((o) => o.id === aplicacion?.id) || ranking[0];
  const principal = palancaDe(principalRank);
  const segundo = ranking.find((o) => o.id !== principalRank.id && o.score >= content.scoring.umbralSecundaria);
  const secundaria = segundo ? palancaDe(segundo) : null;
  const factorPotencia = resp.calidad === 'factor'
    ? { nombre: content.palancaFactorPotencia.nombre, text: content.palancaFactorPotencia.text }
    : null;
  // Una regla comercial puede elevar una aplicación que no lidera el score. Nunca
  // debe reaparecer esa misma aplicación como "menor prioridad" al pie de la lista.
  const ultimo = [...ranking].reverse().find((o) => o.id !== principalRank.id);
  const ultimoNoAplica = ultimo.score === 0;
  const descartada = {
    nombre: copy[ultimo.id].nombre,
    text: ultimoNoAplica ? copy[ultimo.id].descarte : copy[ultimo.id].menor,
    tag: ultimoNoAplica ? 'No aplica' : 'Menor prioridad'
  };
  const gancho = (resp.factura === 'nolose' && !['privado', 'pdbt'].includes(resp.tarifa))
    ? content.gancho
    : null;

  return { gancho, principal, secundaria, factorPotencia, descartada };
}

// ---- BLOQUE D: el dato que falta ----
// Precedencia: hard-gaps (factura/tarifa privada, bloquean cualquier número) →
// señales críticas comerciales (diésel, capacidad) → recomendación solar →
// oportunidad mejor rankeada → corte → default. `ranking` y `recomendacion` son
// opcionales: sin ellos, caen los fallbacks legados.
export function pickMissingData(resp, content, ranking, recomendacion) {
  const hardGap = content.datoFaltante.find((r) => matchesWhen(resp, r.when));
  const porOp = content.datoFaltantePorOportunidad || {};
  const top = ranking && ranking[0] ? ranking[0].id : null;
  const recSolar = ['Solar primero', 'Solar fotovoltaico on-grid', 'BESS + Solar'].includes(recomendacion?.tipo);
  let dato;
  // Aislado reencuadra todo como microred: el dato clave es consumo/autonomía, no el recibo
  // de CFE. Va antes que los hard-gaps, que están centrados en la factura de la red.
  if (hasSignal(resp.disparador, 'aislado') && porOp.off_grid) dato = porOp.off_grid;
  else if (hardGap) dato = hardGap.text;
  else if (hasSignal(resp.disparador, 'diesel') && porOp.diesel) dato = porOp.diesel;
  else if (hasSignal(resp.disparador, 'capacidad') && porOp.diferimiento) dato = porOp.diferimiento;
  else if (recSolar && porOp.bess_solar) dato = porOp.bess_solar;
  else if (top && porOp[top]) dato = porOp[top];
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
// `recomendacion` es opcional: si la solución recomendada es solar ("Solar fotovoltaico on-grid"), falta el
// dato de techo/terreno aunque bess_solar no llegue al umbral fuerte (mejora #4).
export function detectLimitations(resp, scores, content, recomendacion) {
  const L = content.limitaciones;
  const out = [];
  if (resp.factura === 'nolose') out.push(L.factura);
  if (resp.tarifa === 'nolose') out.push(L.tarifa);
  else if (resp.tarifa === 'privado') out.push(L.contrato);
  if (resp.perfil === 'nolose') out.push(L.perfil);
  const sinGeneracion = resp.generacion === 'no' || resp.generacion === 'evaluando' || resp.generacion === 'contrato';
  const solarPrimero = ['Solar primero', 'Solar fotovoltaico on-grid'].includes(recomendacion?.tipo);
  if (sinGeneracion && (scores.bess_solar >= content.scoring.umbralFuerte || solarPrimero)) out.push(L.techo);
  if (hasSignal(resp.disparador, 'diesel')) out.push(L.diesel);
  if (hasSignal(resp.disparador, 'aislado')) {
    out.push(L.aislado);
    if (!out.includes(L.techo)) out.push(L.techo); // una microred necesita superficie para generar
  }
  if (resp.calidad === 'nolose') out.push(L.calidad);
  return out;
}

// ---- CHECKLIST ----
// `recomendacion` opcional (mejora #4): recomendación solar refuerza el dato de techo/terreno.
export function buildChecklist(resp, content, recomendacion) {
  const ref = content.checklistRefuerzos;
  const tecnicos = [...content.checklistBase];
  if (hasSignal(resp.disparador, 'aislado')) tecnicos.push(ref.aislado);
  if (hasSignal(resp.disparador, 'diesel')) tecnicos.push(ref.diesel);
  if (resp.corte !== 'nada') tecnicos.push(ref.paros);
  if (resp.sector === 'continuo') tecnicos.push(ref.horario);
  if (resp.tarifa === 'privado') tecnicos.push(ref.contrato);
  if (resp.generacion === 'estacional') tecnicos.push(ref.techo);
  if (resp.generacion === 'solar_sitio') tecnicos.push(ref.solar);
  if (resp.generacion === 'contrato' && !tecnicos.includes(ref.contrato)) tecnicos.push(ref.contrato);
  if (resp.perfil === 'plano' || resp.perfil === 'punta' || resp.perfil === 'nolose') {
    if (!tecnicos.includes(ref.horario)) tecnicos.push(ref.horario);
  }
  if (resp.generacion === 'evaluando' && !tecnicos.includes(ref.techo)) tecnicos.push(ref.techo);
  if (['Solar primero', 'Solar fotovoltaico on-grid'].includes(recomendacion?.tipo) && !tecnicos.includes(ref.techo)) tecnicos.push(ref.techo);

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

// ---- Nota del evento de Cal.com (texto plano, de cara al cliente) ----
// Resumen breve que SÍ cabe en el mail de confirmación del calendario: perfil,
// configuración a evaluar, orden de magnitud y qué preparar (voz lead). El
// detalle técnico completo va al equipo por /api/lead, no aquí.
export function buildEventNote(res, content) {
  return [
    'Diagnóstico Mexillum — resumen',
    '',
    res.perfil,
    `Configuración a evaluar: ${res.recomendacion_solucion.tipo}`,
    res.calculo.sin_numero
      ? res.leadPayload.rango_texto
      : `Orden de magnitud: ${res.leadPayload.rango_texto}`,
    '',
    `${content.anteproyectoTituloLead}:`,
    ...res.anteproyecto.lead.map((b) => `• ${b}`)
  ].join('\n');
}

// ---- SCORING de oportunidades ----
export function scoreOpportunities(resp, content) {
  const { oportunidades, pesos, boosts = [], caps = [] } = content.scoring;
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
    // Boosts: combinaciones que suman puntos extra (when/allOf/anyOf, mejora #6).
    for (const b of boosts) {
      if (b.id === id && matchesRule(resp, b)) total += b.pts;
    }
    total = Math.min(100, total);
    // Caps: techo cuando falta la condición crítica. El cap queda exento si se cumple
    // `requiere` (valores admisibles por campo) o `unless` (condición, mejora #6).
    // `when` es lo contrario de `unless`: el techo SOLO aplica cuando la condición matchea,
    // así que queda exento cuando NO matchea (p. ej. topar solar_puro únicamente si ya hay
    // solar en sitio). Sin esta rama, un cap con `when` se aplicaba siempre.
    for (const c of caps) {
      if (c.id !== id) continue;
      const exento = (c.requiere && satisfiesRequire(resp, c.requiere))
        || (c.unless && matchesRule(resp, asRule(c.unless)))
        || (c.when && !matchesRule(resp, asRule(c.when)));
      if (!exento) total = Math.min(total, c.max);
    }
    out[id] = Math.max(0, total);
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
  // Sin ninguna oportunidad que llegue al umbral medio, el caso es Bajo.
  if (s1 < u.medio) return niveles[0];
  const fuertes = valores.filter((v) => v >= content.scoring.umbralFuerte).length;
  const cuantificable = (content.scoring.tarifasCuantificables || []).includes(resp.tarifa);

  // El potencial ancla en la ESCALA de la factura (cuánto hay en juego), no solo en el fit
  // del scoring: casi todo perfil industrial tiene alguna palanca fuerte, así que el puntaje
  // máximo por sí solo no discrimina. La escala se recorta por fit débil y por datos faltantes.
  let idx = content.scoring.escalaPotencial[resp.factura] ?? 1;
  if (resp.factura === 'bajo' && s1 < content.scoring.umbralFuerte) idx = 0; // factura chica + fit flojo
  if (s1 < content.scoring.umbralFuerte) idx = Math.min(idx, 1);             // sin palanca fuerte -> tope Medio
  else if (s1 < u.muyAlto || fuertes < 2) idx = Math.min(idx, 2);            // fuerte pero no sobresaliente -> tope Alto
  if (!cuantificable) idx = Math.min(idx, 2);                                // tarifa sin estructura clara
  if (resp.factura === 'nolose') idx = Math.min(idx, 2);
  if (resp.factura === 'nolose' && (resp.tarifa === 'nolose' || resp.tarifa === 'privado')) idx = Math.min(idx, 1);
  // Muy Alto se reserva a casos grandes, cuantificables y con fit sobresaliente (2+ palancas).
  if (idx === 3 && !(['alto', 'muyalto'].includes(resp.factura) && cuantificable && s1 >= u.muyAlto && fuertes >= 2)) {
    idx = 2;
  }
  return niveles[idx];
}

// ---- RECOMENDACIÓN de solución (BESS vs Solar) ----
export function recommendSolution(resp, scores, content, aplicacion) {
  const rec = content.recomendaciones;
  const bs = scores.bess_solar;
  const scoreMax = Math.max(...Object.values(scores));
  const topId = aplicacion?.id || Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0];
  // Contrato renovable/privado NO implica generación detrás del medidor: elegible para
  // solar nueva, igual que "no generamos" o "evaluando". Solar en sitio sí tiene generación.
  const sinGeneracion = resp.generacion === 'no' || resp.generacion === 'evaluando' || resp.generacion === 'contrato';
  const tarifaCiega = resp.tarifa === 'nolose' || resp.tarifa === 'privado';
  let key;
  if (scoreMax < content.scoring.umbralPotencial.medio) key = 'insuficiente';
  // Operar aislado reencuadra el proyecto como microred; manda sobre diésel/capacidad/etc.
  else if (hasSignal(resp.disparador, 'aislado')) key = 'offGrid';
  else if (hasSignal(resp.disparador, 'diesel')) {
    key = resp.generacion === 'solar_sitio' ? 'bessDieselSolar' : 'bessDiesel';
  }
  else if (hasSignal(resp.disparador, 'capacidad')) key = 'bessCapacidad';
  else if (topId === 'respaldo') key = 'bessRespaldo';
  // Solar en sitio: ya hay generación → el foco es BESS sobre lo instalado (mejora #1:
  // con excedente, el copy explica que la batería captura esa energía; sin más solar).
  else if (resp.generacion === 'solar_sitio') {
    key = hasSignal(resp.disparador, 'excedente') ? 'bessSobreSolarExcedente' : 'bessSobreSolar';
  }
  else if (resp.generacion === 'estacional') key = 'estacional';
  // Solar puro lidera cuando encabeza el ranking y no hay generación previa (consumo
  // diurno, foco en costo, sin dolor crítico —esos casos ya se resolvieron arriba). Antes
  // solo se recomendaba sin tarifa conocida (tarifaCiega), lo que dejaba a clientes
  // claramente solares con una recomendación de BESS pese a que el ranking decía Solar.
  else if (topId === 'solar_puro' && sinGeneracion) key = 'solarPrimero';
  // Solar primero también va ANTES que BESS+Solar: sin datos de tarifa no comprometemos la combinación.
  else if (resp.perfil === 'diurno' && sinGeneracion && tarifaCiega) key = 'solarPrimero';
  else if (bs >= 60 && sinGeneracion && resp.perfil === 'diurno') key = 'bessSolarDiurno';
  else if (topId === 'bess_solar' && bs >= content.scoring.umbralFuerte) key = 'bessSolarGeneral';
  // Sin perfil horario y sin recibo/tarifa: mismo tipo (BESS) con razón conservadora.
  else if (resp.perfil === 'nolose' && (tarifaCiega || resp.factura === 'nolose')) key = 'bessPreliminar';
  else key = 'bess';
  return { tipo: rec[key].tipo, razon: rec[key].razon, familia: FAMILIA_ANTEPROYECTO[key] || 'base' };
}

// Familia de datos para el anteproyecto según la recomendación (mapea la key interna
// de recommendSolution a la lista de datos a solicitar). bess_solar = solar + bess.
const FAMILIA_ANTEPROYECTO = {
  insuficiente: 'base',
  solarPrimero: 'solar',
  offGrid: 'off_grid',
  bessDiesel: 'bess',
  bessDieselSolar: 'bess_solar',
  bessCapacidad: 'bess',
  bessRespaldo: 'bess',
  bessSolarGeneral: 'bess_solar',
  bessSobreSolarExcedente: 'bess_solar',
  bessSobreSolar: 'bess_solar',
  estacional: 'bess_solar',
  bessSolarDiurno: 'bess_solar',
  bess: 'bess',
  bessPreliminar: 'bess'
};

// Qué familias de contenido se suman sobre la base para cada familia de solución.
const ANTEPROYECTO_EXTRAS = {
  base: [],
  solar: ['solar'],
  bess: ['bess'],
  bess_solar: ['solar', 'bess'],
  off_grid: ['off_grid']
};

// ---- DATOS PARA EL ANTEPROYECTO (dos voces) ----
// Compone la lista a partir de la familia de la recomendación: base + extras.
export function buildAnteproyecto(recomendacion, content) {
  const a = content.anteproyecto;
  const familia = recomendacion?.familia || 'base';
  const extras = ANTEPROYECTO_EXTRAS[familia] || [];
  const interno = [...a.base.interno, ...extras.flatMap((k) => a[k].interno)];
  const lead = [...a.base.lead, ...extras.flatMap((k) => a[k].lead)];
  return { familia, interno, lead };
}

// ---- APLICACIÓN principal (mejora #3: subtipo comercial) ----
// Qué aplicación del BESS/proyecto lidera el caso. Por defecto el top del ranking; las
// reglas de `scoring.aplicacionPrincipal` (datos, en orden) lo sobreescriben cuando una
// señal pesa más de lo que el score refleja. Cada regla puede exigir score fuerte
// (`fuerte`) y cercanía al líder (`margenTop`).
export function primaryApplication(resp, ranking, scores, content) {
  const reglas = content.scoring.aplicacionPrincipal || [];
  const top = ranking[0];
  let id = top.id;
  for (const r of reglas) {
    if (!matchesRule(resp, r)) continue;
    const score = scores[r.id] ?? 0;
    if (r.fuerte && score < content.scoring.umbralFuerte) continue;
    if (r.margenTop != null && (top.score - score) > r.margenTop) continue;
    id = r.id;
    break;
  }
  const op = content.scoring.oportunidades.find((o) => o.id === id);
  // Lectura provisional: si la aplicación elegida ni siquiera llega al umbral de
  // potencial medio, las respuestas no alcanzan para fijarla y hay que decirlo.
  const preliminar = (scores[id] ?? 0) < content.scoring.umbralPotencial.medio;
  return { id, nombre: op ? op.nombre : id, preliminar };
}

// ---- NORMALIZACIÓN de respuestas legadas (mejora #7) ----
// Un payload viejo o estado persistido puede traer códigos previos al esquema actual.
// Se mapean aquí para que el resto del motor (y toReadable) vea solo códigos vigentes:
// generacion 'fisica' (pre-split solar/contrato) → 'solar_sitio'; disparador string
// legado → array (equivalencia probada por el caso C del parche v2.2).
export function normalizeResponses(resp) {
  const out = { ...resp };
  if (out.generacion === 'fisica') out.generacion = 'solar_sitio';
  out.disparador = asList(out.disparador);
  return out;
}

// ---- Contacto desde la reserva de Cal.com ----
// Lee nombre/correo del asistente y los campos extra (empresa, teléfono, rol,
// presupuesto) de las respuestas de la reserva. Tolera varias formas del payload:
// `data.booking.responses[key]` puede ser un string o `{ value }`, y algunos
// campos vienen en la raíz. Devuelve siempre cadenas (nunca undefined).
function respValue(responses, key) {
  const r = responses && responses[key];
  if (r == null) return '';
  if (typeof r === 'object') return String(r.value ?? '').trim();
  return String(r).trim();
}

export function bookingContact(data) {
  const d = data || {};
  const booking = d.booking || d;
  const attendee = (Array.isArray(booking.attendees) && booking.attendees[0]) || {};
  const responses = booking.responses || d.responses || {};
  return {
    nombre: String(attendee.name || respValue(responses, 'name') || '').trim(),
    correo: String(attendee.email || respValue(responses, 'email') || '').trim(),
    empresa: respValue(responses, 'empresa'),
    telefono: respValue(responses, 'telefono') || respValue(responses, 'phone') || String(attendee.phoneNumber || '').trim(),
    rol: respValue(responses, 'rol'),
    presupuesto: respValue(responses, 'presupuesto')
  };
}

// ---- Orquestador ----
export function assembleResult(estado, content) {
  const resp = normalizeResponses(estado.respuestas);
  const contacto = estado.contacto || {};
  const scores = scoreOpportunities(resp, content);
  const ranking = rankOpportunities(scores, content);
  const potencial_general = potencialGeneral(scores, resp, content);
  const aplicacion_principal = primaryApplication(resp, ranking, scores, content);
  const recomendacion_solucion = recommendSolution(resp, scores, content, aplicacion_principal);
  const perfil = buildProfile(resp, content);
  const bloqueB = renderBlockB(resp, content, aplicacion_principal);
  const palancas = pickLevers(resp, ranking, content, aplicacion_principal);
  const datoFaltante = pickMissingData(resp, content, ranking, recomendacion_solucion);
  const financiamiento = pickFinancing(resp, content);
  const checklist = buildChecklist(resp, content, recomendacion_solucion);
  const anteproyecto = buildAnteproyecto(recomendacion_solucion, content);
  const legibles = toReadable(resp, content);
  const limitaciones = detectLimitations(resp, scores, content, recomendacion_solucion);

  // rango_texto del lead: mensaje legible incluso sin número (mail a ventas).
  const rango_texto = bloqueB.sinNumero
    ? ({
        privado: 'Suministrador privado — sin rango numérico',
        pdbt: 'Tarifa PDBT — peak shaving no cuantificado',
        tarifa: 'Tarifa sin especificar — sin rango numérico',
        nolose: 'Factura sin especificar — sin rango numérico'
      }[bloqueB.sinNumero] || 'Aplicación prioritaria sin datos suficientes para un rango')
    : bloqueB.rangoTexto;

  const leadPayload = {
    lead_id: estado.lead_id || (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
    timestamp: new Date().toISOString(),
    nombre: contacto.nombre || '',
    empresa: contacto.empresa || '',
    correo: contacto.correo || '',
    telefono: contacto.telefono || '',
    rol: contacto.rol || '',
    presupuesto: contacto.presupuesto || '',
    tipo_cierre: contacto.tipo_cierre || '',
    ubicacion: estado.ubicacion || null,
    techo: estado.techo || null,
    facturas: estado.facturas || null,
    respuestas_legibles: legibles,
    respuestas_codigos: { ...resp },
    perfil,
    rango_texto,
    checklist_full: checklist.full,
    anteproyecto_interno: anteproyecto.interno,
    scores,
    ranking,
    potencial_general,
    recomendacion_solucion,
    aplicacion_principal,
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
    anteproyecto,                            // { familia, interno[], lead[] } datos a solicitar
    scores,                                  // scoring 0-100 por oportunidad
    ranking,                                 // oportunidades ordenadas desc
    potencial_general,                       // 'Muy Alto'|'Alto'|'Medio'|'Bajo'
    recomendacion_solucion,                  // { tipo, razon } BESS vs Solar
    aplicacion_principal,                    // { id, nombre } aplicación comercial líder
    limitaciones,                            // datos faltantes que impiden conclusiones firmes
    leadPayload
  };
  res.note = buildEventNote(res, content);
  return res;
}
