// Motor de reglas del funnel v2. Funciones puras, sin DOM. Importable en navegador
// y en Node (tests). Lee prioridades, condiciones y copy desde content.js.

// ¿La respuesta cumple todas las igualdades de `when`?
export function matchesWhen(resp, when) {
  return Object.entries(when).every(([campo, valor]) => resp[campo] === valor);
}

// Fraseo de planta: "tu operación" si hay un solo sitio, "esa planta" si hay varios.
export function plantaLabel(resp) {
  return resp.sitios === 'uno' ? 'tu operación' : 'esa planta';
}

// BLOQUE A — línea de perfil.
export function buildProfile(resp, content) {
  const sector = content.perfilSector[resp.sector] || resp.sector;
  const multi = resp.sitios !== 'uno' ? ' multi-planta' : '';
  const exp = content.perfilExposicion.find((r) => matchesWhen(resp, r.when));
  const exposicion = exp ? exp.text : content.perfilExposicionDefault;
  return `Perfil: ${sector}${multi} ${exposicion}.`;
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
  const rec = content.tablaRecorte[resp.sector];
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

  if (sinNumero === 'privado') return { sinNumero, piso, techo, texto: b.privado, notas };
  if (sinNumero === 'nolose') return { sinNumero, piso, techo, texto: b.noloseFactura, notas };

  const factura = content.tablaFactura[resp.factura];
  const dem = content.tablaDemanda[resp.tarifa];
  const rec = content.tablaRecorte[resp.sector];
  const pct = (x) => Math.round(x * 100);
  const cadena = b.plantilla({
    facturaLegible: formatMoney(factura),
    tarifaLegible: content.tarifaLegible[resp.tarifa],
    pctDemandaPiso: pct(dem[0]), pctDemandaTecho: pct(dem[1]),
    montoDemandaPiso: formatMoney(factura * 12 * dem[0]),
    montoDemandaTecho: formatMoney(factura * 12 * dem[1]),
    pctRecortePiso: pct(rec[0]), pctRecorteTecho: pct(rec[1])
  });
  let texto = `${cadena}\n\n${b.rango(formatRango(piso, techo))}\n\n${b.disclaimer}`;
  if (resp.sector === 'continuo') texto += `\n\n${b.continuoExtra}`;
  return { sinNumero: null, piso, techo, texto, notas };
}

// ---- BLOQUE C: palancas jerarquizadas ----
const pick = (r) => (r ? { nombre: r.nombre, text: r.text } : null);

export function pickLevers(resp, content) {
  const gancho = (resp.demanda === 'desconoce' || resp.demanda === 'visto') ? content.gancho : null;
  const principalRule = content.palancasPrincipal.find((r) => matchesWhen(resp, r.when)) || content.palancaPrincipalDefault;
  const secundariaRule = content.palancasSecundaria.find((r) => matchesWhen(resp, r.when) && r.id !== principalRule.id) || null;
  const descartadaRule = content.palancasDescartada.find((r) => matchesWhen(resp, r.when)) || null;
  return {
    gancho,
    principal: pick(principalRule),
    secundaria: pick(secundariaRule),
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
