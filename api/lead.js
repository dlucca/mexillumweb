// Vercel serverless function — recibe el payload del funnel de diagnóstico v2 y envía
// el lead por email vía Resend. Se dispara una sola vez desde js/diagnostico.view.js
// al enviar el gate de contacto (antes de cualquier reserva).
// Requiere env var RESEND_API_KEY. Opcional: LEAD_TO, LEAD_FROM.
// Sin deps npm: usa fetch nativo (Node 18+).

import { sendNda } from '../lib/nda.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// Restringe un path de storage a chars seguros (defensa adicional contra "../", igual que upload-url.js).
const safePath = (p) => String(p ?? '').replace(/[^a-zA-Z0-9._/-]+/g, '');

// Throttle best-effort del correo de cliente (propuesta preliminar), por email destinatario.
// Nota: es best-effort porque las instancias serverless son efímeras (el Map se pierde entre
// invocaciones/instancias); si se necesita un límite duro, reemplazar por un store durable
// (Redis, Supabase, etc.).
const CLIENT_EMAIL_WINDOW_MS = 10 * 60 * 1000;
const CLIENT_EMAIL_MAX = 3;
const clientEmailSends = new Map(); // email -> timestamps[]
function clientEmailAllowed(email) {
  const now = Date.now();
  const prev = clientEmailSends.get(email) || [];
  const fresh = prev.filter((t) => now - t < CLIENT_EMAIL_WINDOW_MS);
  if (fresh.length >= CLIENT_EMAIL_MAX) {
    clientEmailSends.set(email, fresh);
    return false;
  }
  fresh.push(now);
  clientEmailSends.set(email, fresh);
  return true;
}

// Etiquetas visibles de cada paso del funnel v2, en orden.
const PREGUNTAS = [
  ['sector', 'Sector / operación'],
  ['perfil', 'Perfil de carga / horario'],
  ['generacion', 'Generación propia'],
  ['calidad', 'Calidad eléctrica'],
  ['tarifa', 'Tarifa CFE'],
  ['factura', 'Factura mensual'],
  ['corte', 'Impacto de un corte'],
  ['disparador', 'Disparador'],
];

// Para leads de hoteles algunas etiquetas cambian de voz; el resto se reusa.
const PREGUNTAS_HOTELES = {
  sector: 'Tipo de propiedad',
  corte: 'Impacto de un apagón',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot: usuarios reales nunca lo llenan.
  if (body.website) return res.status(200).json({ ok: true });

  const nombre = clean(body.nombre, 120);
  const correo = clean(body.correo, 160);
  const empresa = clean(body.empresa, 120);
  const telefono = clean(body.telefono, 40);
  const rol = clean(body.rol, 60);
  const origen = clean(body.origen, 40);
  const profileId = clean(body.profile_id, 60);
  const profileLabel = clean(body.profile_label, 80);
  const profileVersion = clean(body.profile_version, 20);
  const leadStage = clean(body.lead_stage, 40);
  const vocabulary = (body.email_vocabulary && typeof body.email_vocabulary === 'object' && !Array.isArray(body.email_vocabulary))
    ? body.email_vocabulary : {};
  const attribution = (body.attribution && typeof body.attribution === 'object' && !Array.isArray(body.attribution))
    ? body.attribution : {};
  const sourceDetail = [
    clean(attribution.utm_source, 80), clean(attribution.utm_medium, 80),
    clean(attribution.utm_campaign, 120), clean(attribution.source, 80)
  ].filter(Boolean).join(' · ');
  const referrer = clean(attribution.referrer, 300);
  const siteWord = clean(vocabulary.site, 80) || 'operación';
  const technicalContact = clean(vocabulary.technicalContact, 100) || 'responsable de energía o mantenimiento';
  const tipoCierre = clean(body.tipo_cierre, 20);

  if (!nombre || !EMAIL_RE.test(correo) || (tipoCierre === 'llamada' && !empresa)) {
    return res.status(400).json({ error: 'Datos incompletos o inválidos.' });
  }

  const legibles = (body.respuestas_legibles && typeof body.respuestas_legibles === 'object') ? body.respuestas_legibles : {};
  const codigos = (body.respuestas_codigos && typeof body.respuestas_codigos === 'object') ? body.respuestas_codigos : {};
  const perfil = clean(body.perfil, 200) || '—';
  const rangoTexto = clean(body.rango_texto, 120) || '—';
  const leadId = clean(body.lead_id, 64);
  const financiamiento = clean(body.financiamiento, 400);
  const palancasLead = (body.palancas && typeof body.palancas === 'object' && !Array.isArray(body.palancas))
    ? body.palancas : null;
  const palP = palancasLead && palancasLead.principal && typeof palancasLead.principal === 'object'
    ? { nombre: clean(palancasLead.principal.nombre, 60), text: clean(palancasLead.principal.text, 300) } : null;
  const palS = palancasLead && palancasLead.secundaria && typeof palancasLead.secundaria === 'object'
    ? { nombre: clean(palancasLead.secundaria.nombre, 60), text: clean(palancasLead.secundaria.text, 300) } : null;

  const ubic = (body.ubicacion && typeof body.ubicacion === 'object' && !Array.isArray(body.ubicacion))
    ? {
        direccion: clean(body.ubicacion.direccion, 200),
        lat: Number(body.ubicacion.lat),
        lng: Number(body.ubicacion.lng)
      }
    : null;
  const techoArea = (body.techo && Number.isFinite(Number(body.techo.area_m2)) && Number(body.techo.area_m2) > 0)
    ? Math.round(Number(body.techo.area_m2))
    : null;
  // Nº de áreas dibujadas: soporta el shape nuevo (poligonos[]) y el viejo (poligono).
  const techoN = (body.techo && Array.isArray(body.techo.poligonos))
    ? body.techo.poligonos.length
    : (body.techo && body.techo.poligono ? 1 : 0);
  const techoTxt = techoArea != null
    ? `~${techoArea} m²${techoN > 1 ? ` en ${techoN} áreas` : ''}`
    : null;
  const acometidaRaw = (body.acometida && typeof body.acometida === 'object' && !Array.isArray(body.acometida))
    ? body.acometida : null;
  const acometidaLat = acometidaRaw ? Number(acometidaRaw.lat) : NaN;
  const acometidaLng = acometidaRaw ? Number(acometidaRaw.lng) : NaN;
  const acometida = acometidaRaw
    && String(acometidaRaw.lat ?? '').trim() && String(acometidaRaw.lng ?? '').trim()
    && Number.isFinite(acometidaLat) && Number.isFinite(acometidaLng)
    && Math.abs(acometidaLat) <= 90 && Math.abs(acometidaLng) <= 180
    ? {
        lat: acometidaLat,
        lng: acometidaLng,
        tipo: clean(acometidaRaw.tipo, 40) || 'acometida',
        precision: clean(acometidaRaw.precision, 20) || 'aproximada',
        capacidad_kva: Number(acometidaRaw.capacidad_kva) > 0 ? Number(acometidaRaw.capacidad_kva) : null
      }
    : null;
  const acometidaLabels = {
    acometida: 'Acometida o medidor', transformador: 'Transformador', subestacion: 'Subestación',
    tablero_general: 'Tablero general', otro: 'Otro punto eléctrico'
  };
  const acometidaTxt = acometida
    ? `${acometidaLabels[acometida.tipo] || acometida.tipo} · ${acometida.precision} · ${acometida.lat.toFixed(6)}, ${acometida.lng.toFixed(6)}`
      + (acometida.capacidad_kva ? ` · ${acometida.capacidad_kva} kVA` : '')
    : null;
  const facturaPaths = (body.facturas && Array.isArray(body.facturas.paths))
    ? body.facturas.paths.slice(0, 12).map((p) => clean(p, 300)).filter(Boolean)
    : [];

  const checklist = Array.isArray(body.checklist_full)
    ? body.checklist_full.slice(0, 12).map((b) => clean(b, 240)).filter(Boolean)
    : [];

  // Datos internos para armar el anteproyecto (sección aparte del checklist).
  const anteproyecto = Array.isArray(body.anteproyecto_interno)
    ? body.anteproyecto_interno.slice(0, 20).map((b) => clean(b, 240)).filter(Boolean)
    : [];

  const potencial = clean(body.potencial_general, 20);
  const recomendacionRaw = (body.recomendacion_solucion && typeof body.recomendacion_solucion === 'object'
    && !Array.isArray(body.recomendacion_solucion))
    ? { tipo: clean(body.recomendacion_solucion.tipo, 40), razon: clean(body.recomendacion_solucion.razon, 300) }
    : null;
  const recomendacion = (recomendacionRaw && recomendacionRaw.tipo) ? recomendacionRaw : null;
  const aplicacionRaw = (body.aplicacion_principal && typeof body.aplicacion_principal === 'object'
    && !Array.isArray(body.aplicacion_principal))
    ? body.aplicacion_principal
    : null;
  const aplicacionNombre = aplicacionRaw ? clean(aplicacionRaw.nombre, 40) : '';
  // El motor la marca preliminar cuando las respuestas no alcanzan para fijarla.
  const aplicacion = (aplicacionNombre && aplicacionRaw.preliminar === true)
    ? `${aplicacionNombre} (preliminar)`
    : aplicacionNombre;
  const ranking = Array.isArray(body.ranking)
    ? body.ranking
        .filter((o) => o && typeof o === 'object' && !Array.isArray(o))
        .map((o) => ({ nombre: clean(o.nombre, 40), score: Number(o.score) || 0 }))
        .filter((o) => o.nombre)
        .slice(0, 6)
    : [];

  // Texto de ubicación: solo agrega las coords entre paréntesis si ambas son números finitos.
  const ubicTexto = ubic
    ? (Number.isFinite(ubic.lat) && Number.isFinite(ubic.lng)
        ? `${ubic.direccion || '—'} (${ubic.lat}, ${ubic.lng})`
        : `${ubic.direccion || '—'}`)
    : '';

  const respuestas = PREGUNTAS.map(([key, label]) => {
    const etiqueta = (origen.startsWith('hoteles') && PREGUNTAS_HOTELES[key]) ? PREGUNTAS_HOTELES[key] : label;
    const visible = clean(legibles[key], 240);
    const codigo = clean(codigos[key], 40);
    return { label: etiqueta, visible: visible || codigo || '—' };
  });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO || 'info@mexillum.com';
  const from = process.env.LEAD_FROM || 'Mexillum Web <notificaciones@mexillum.com>';
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'Config del servidor incompleta.' });
  }

  const quien = empresa ? `${nombre} — ${empresa}` : nombre;
  const subject = origen.startsWith('hoteles')
    ? `Diagnóstico Hoteles — ${quien}`
    : (profileId && profileId !== 'industria_comercio' && profileLabel
        ? `Diagnóstico ${profileLabel} — ${quien}`
        : `Diagnóstico — ${quien}`);

  // Links firmados temporales (30 días) para que ventas abra las facturas privadas.
  async function firmarFacturas(paths) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || !paths.length) return [];
    const out = [];
    for (const raw of paths) {
      const p = safePath(raw);
      if (!p) { out.push(`${raw} (link no disponible)`); continue; }
      try {
        const r = await fetch(`${url}/storage/v1/object/sign/facturas/${p}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 30 })
        });
        if (!r.ok) { out.push(`${p} (link no disponible)`); continue; }
        const data = await r.json();
        const rel = data.signedURL || data.signedUrl || '';
        out.push(rel ? `${url}${rel}` : `${p} (link no disponible)`);
      } catch { out.push(`${p} (link no disponible)`); }
    }
    return out;
  }
  const facturaLinks = await firmarFacturas(facturaPaths);

  const text = [
    'Nuevo diagnóstico completado',
    '',
    `Nombre:   ${nombre}`,
    `Empresa:  ${empresa || '—'}`,
    `Correo:   ${correo}`,
    `Teléfono: ${telefono || '—'}`,
    `Rol:      ${rol || '—'}`,
    origen ? `Origen:   ${origen}` : null,
    profileLabel ? `Diagnóstico: ${profileLabel}${profileVersion ? ` · v${profileVersion}` : ''}` : null,
    leadStage ? `Etapa:    ${leadStage}` : null,
    sourceDetail ? `Campaña:  ${sourceDetail}` : null,
    referrer ? `Referente: ${referrer}` : null,
    '',
    perfil,
    `Rango estimado: ${rangoTexto}`,
    potencial ? `Potencial general: ${potencial}` : null,
    recomendacion ? `Recomendación: ${recomendacion.tipo}` : null,
    aplicacion ? `Aplicación principal: ${aplicacion}` : null,
    ranking.length ? 'Ranking: ' + ranking.map((o) => `${o.nombre} ${o.score}`).join(' · ') : null,
    '',
    ubic ? `Ubicación: ${ubicTexto}` : null,
    techoArea != null ? `Techo dibujado: ${techoTxt}` : null,
    acometida ? `Punto eléctrico: ${acometidaTxt}` : null,
    facturaLinks.length ? `${facturaLinks.length} facturas subidas:` : null,
    ...facturaLinks.map((l) => `  - ${l}`),
    'Respuestas:',
    ...respuestas.map((r, i) => `${i + 1}. ${r.label}: ${r.visible}`),
    checklist.length ? '' : null,
    checklist.length ? 'Checklist para la llamada:' : null,
    ...checklist.map((b) => `• ${b}`),
    anteproyecto.length ? '' : null,
    anteproyecto.length ? 'Datos para el anteproyecto:' : null,
    ...anteproyecto.map((b) => `• ${b}`),
    '',
    leadId ? `lead_id: ${leadId}` : null,
  ].filter((l) => l !== null).join('\n');

  const fila = (k, v) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#6F796E;vertical-align:top">${esc(k)}</td>` +
    `<td style="padding:6px 0"><strong>${esc(v)}</strong></td></tr>`;

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#16221A;max-width:560px">` +
    `<h2 style="margin:0 0 4px;font-size:18px;color:#080A08">Nuevo diagnóstico completado</h2>` +
    `<p style="margin:0 0 16px;font-size:13px;color:#1F7A3D"><strong>${esc(perfil)}</strong><br>` +
    `Rango estimado: <strong>${esc(rangoTexto)}</strong></p>` +

    (potencial || recomendacion || aplicacion || ranking.length
      ? `<p style="margin:0 0 16px;font-size:13px;color:#16221A">` +
        (potencial ? `Potencial general: <strong>${esc(potencial)}</strong><br>` : '') +
        (recomendacion ? `Recomendación: <strong>${esc(recomendacion.tipo)}</strong><br>` : '') +
        (aplicacion ? `Aplicación principal: <strong>${esc(aplicacion)}</strong><br>` : '') +
        (ranking.length ? `Ranking: ${esc(ranking.map((o) => `${o.nombre} ${o.score}`).join(' · '))}` : '') +
        `</p>`
      : '') +

    `<table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">` +
    fila('Nombre', nombre) +
    fila('Empresa', empresa || '—') +
    `<tr><td style="padding:6px 16px 6px 0;color:#6F796E">Correo</td>` +
    `<td style="padding:6px 0"><a href="mailto:${esc(correo)}">${esc(correo)}</a></td></tr>` +
    (telefono ? fila('Teléfono', telefono) : '') +
    (rol ? fila('Rol', rol) : '') +
    (origen ? fila('Origen', origen) : '') +
    (profileLabel ? fila('Diagnóstico', `${profileLabel}${profileVersion ? ` · v${profileVersion}` : ''}`) : '') +
    (leadStage ? fila('Etapa', leadStage) : '') +
    (sourceDetail ? fila('Campaña', sourceDetail) : '') +
    (referrer ? fila('Referente', referrer) : '') +
    `</table>` +

    (ubic || techoArea != null || acometida || facturaLinks.length
      ? `<table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">` +
        (ubic ? fila('Ubicación', ubicTexto) : '') +
        (techoArea != null ? fila('Techo dibujado', techoTxt) : '') +
        (acometida ? fila('Punto eléctrico', acometidaTxt) : '') +
        (facturaLinks.length
          ? `<tr><td style="padding:6px 16px 6px 0;color:#6F796E;vertical-align:top">Facturas</td>` +
            `<td style="padding:6px 0">` +
            facturaLinks.map((l, i) => `<a href="${esc(l)}">Factura ${i + 1}</a>`).join('<br>') +
            `</td></tr>`
          : '') +
        `</table>`
      : '') +

    `<h3 style="margin:0 0 8px;font-size:14px;color:#080A08">Respuestas del diagnóstico</h3>` +
    `<table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">` +
    respuestas.map((r) =>
      `<tr><td style="padding:6px 16px 6px 0;color:#6F796E;vertical-align:top">${esc(r.label)}</td>` +
      `<td style="padding:6px 0">${esc(r.visible)}</td></tr>`
    ).join('') +
    `</table>` +

    (checklist.length
      ? `<h3 style="margin:0 0 8px;font-size:14px;color:#080A08">Checklist para la llamada</h3>` +
        `<ul style="margin:0 0 20px;padding-left:18px;font-size:14px">` +
        checklist.map((b) => `<li style="margin-bottom:4px">${esc(b)}</li>`).join('') +
        `</ul>`
      : '') +

    (anteproyecto.length
      ? `<h3 style="margin:0 0 8px;font-size:14px;color:#080A08">Datos para el anteproyecto</h3>` +
        `<ul style="margin:0 0 20px;padding-left:18px;font-size:14px">` +
        anteproyecto.map((b) => `<li style="margin-bottom:4px">${esc(b)}</li>`).join('') +
        `</ul>`
      : '') +

    `<p style="margin:20px 0 0;font-size:12px;color:#9AA398">` +
    `Enviado desde el diagnóstico de mexillum.com${leadId ? ` · lead_id ${esc(leadId)}` : ''}</p>` +
    `</div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, reply_to: correo, subject, text, html }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('Resend error', r.status, detail);
      return res.status(502).json({ error: 'No se pudo enviar la solicitud.' });
    }

    if (tipoCierre === 'preliminar' && EMAIL_RE.test(correo) && clientEmailAllowed(correo)) {
      // Solo mostramos el rango si es un número real (no los mensajes "sin rango...").
      const rangoReal = rangoTexto && !/sin\s+(rango|n[uú]mero|especificar)/i.test(rangoTexto) ? rangoTexto : '';

      // "Datos para el anteproyecto" a la medida: no repetimos lo que ya nos dio,
      // y solo pedimos lo específico de baterías/solar cuando aplica.
      const tieneTecho = techoArea != null;
      const tieneRecibos = facturaPaths.length > 0;
      const recTipo = recomendacion ? recomendacion.tipo : '';
      const esBaterias = /bess|respaldo|bater/i.test(recTipo);
      const esSolar = /solar|fotovolt/i.test(recTipo) || tieneTecho;
      const unir = (arr) => arr.length <= 1
        ? (arr[0] || '')
        : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];

      const yaPartes = ['tus respuestas del diagnóstico y tu tarifa CFE'];
      if (tieneTecho) yaPartes.push(`la medida de tu techo (${techoTxt})`);
      if (acometida) yaPartes.push('la ubicación de tu punto eléctrico principal');
      if (tieneRecibos) yaPartes.push(`tus ${facturaPaths.length} recibo${facturaPaths.length === 1 ? '' : 's'} de CFE`);
      const yaTenemos = 'Ya tenemos ' + unir(yaPartes) + '.';

      const faltan = [
        `Horario u operación detallada de tu ${siteWord}.`,
        'Capacidad del transformador y tablero principal (diagrama unifilar).',
        'Objetivo prioritario (ahorro, respaldo o capacidad) y horizonte de decisión.',
        'Frecuencia y duración de los cortes de energía.',
        'Número de servicio (RPU) de tu recibo CFE.',
        `Contacto del ${technicalContact}.`,
        'Rango de inversión y forma preferida (compra directa o servicio/PPA).'
      ];
      if (!tieneRecibos) faltan.push('Tus 12 recibos de CFE (kWh, demanda máxima en kW y tarifa).');
      if (!tieneTecho && esSolar) faltan.push('Superficie disponible en m² (techo o terreno).');
      if (esSolar) faltan.push('Tipo y estado de la cubierta del techo (peso que soporta).');
      if (esBaterias) {
        faltan.push('Cargas críticas a respaldar (kW y kWh) y autonomía requerida.');
        faltan.push('Espacio y ventilación para el gabinete de baterías.');
      }

      const lineasCliente = [
        `Hola ${nombre || ''},`,
        '',
        `Gracias por completar tu diagnóstico. Esto es lo que vemos para tu ${siteWord}:`,
        '',
        'Tu perfil',
        perfil || '—',
        rangoReal ? '' : null,
        rangoReal ? 'Ahorro estimado (referencia)' : null,
        rangoReal ? rangoReal : null,
        '',
        'Lo que más te conviene',
        recomendacion ? `${recomendacion.tipo}${recomendacion.razon ? ' — ' + recomendacion.razon : ''}` : null,
        palP ? `• Principal: ${palP.nombre} — ${palP.text}` : null,
        palS ? `• Secundaria: ${palS.nombre} — ${palS.text}` : null,
        financiamiento ? '' : null,
        financiamiento ? 'Cómo se puede estructurar' : null,
        financiamiento || null,
        '',
        'Datos para el anteproyecto',
        'No necesitas tener todo listo — con lo que reúnas, avanzamos.',
        yaTenemos,
        'Nos ayudaría también:',
        ...faltan.map((d) => `• ${d}`),
        '',
        'Un asesor te va a contactar para determinar tu proyecto con mayor precisión. Tus datos son confidenciales: solo los usamos para tu diagnóstico.',
        '',
        '— Equipo Mexillum'
      ].filter((l) => l !== null);
      const textoCliente = lineasCliente.join('\n');

      const seccion = (titulo, cuerpoHtml) =>
        `<h3 style="margin:16px 0 4px;font-size:14px;color:#080A08">${esc(titulo)}</h3>${cuerpoHtml}`;
      const htmlCliente =
        `<div style="font-family:Arial,Helvetica,sans-serif;color:#16221A;max-width:560px;font-size:14px;line-height:1.5">` +
        `<p style="margin:0 0 12px">Hola ${esc(nombre || '')},</p>` +
        `<p style="margin:0 0 12px">Gracias por completar tu diagnóstico. Esto es lo que vemos para tu ${esc(siteWord)}:</p>` +
        seccion('Tu perfil', `<p style="margin:0 0 8px">${esc(perfil || '—')}</p>`) +
        (rangoReal ? seccion('Ahorro estimado (referencia)', `<p style="margin:0 0 8px;font-weight:bold">${esc(rangoReal)}</p>`) : '') +
        seccion('Lo que más te conviene',
          (recomendacion ? `<p style="margin:0 0 8px">${esc(recomendacion.tipo)}${recomendacion.razon ? ' — ' + esc(recomendacion.razon) : ''}</p>` : '') +
          ((palP || palS) ? `<ul style="margin:0 0 8px;padding-left:18px">` +
            (palP ? `<li><strong>${esc(palP.nombre)}.</strong> ${esc(palP.text)}</li>` : '') +
            (palS ? `<li><strong>${esc(palS.nombre)}.</strong> ${esc(palS.text)}</li>` : '') +
            `</ul>` : '')
        ) +
        (financiamiento ? seccion('Cómo se puede estructurar', `<p style="margin:0 0 8px;color:#6F796E">${esc(financiamiento)}</p>`) : '') +
        seccion('Datos para el anteproyecto',
          `<p style="margin:0 0 6px">No necesitas tener todo listo — con lo que reúnas, avanzamos.</p>` +
          `<p style="margin:0 0 6px">${esc(yaTenemos)}</p>` +
          `<p style="margin:0 0 4px">Nos ayudaría también:</p>` +
          `<ul style="margin:0 0 8px;padding-left:18px">${faltan.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`
        ) +
        `<p style="margin:16px 0 0">Un asesor te va a contactar para determinar tu proyecto con mayor precisión. Tus datos son confidenciales: solo los usamos para tu diagnóstico.</p>` +
        `<p style="margin:16px 0 0">— Equipo Mexillum</p>` +
        `</div>`;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from, to: correo, subject: 'Tu diagnóstico energético — Mexillum', text: textoCliente, html: htmlCliente
          })
        });
      } catch (err) { console.error('correo cliente falló', err); }

      // NDA en segundo plano para que suba sus recibos con confianza (Opción A).
      try {
        await sendNda({ nombre, correo, empresa });
      } catch (err) { console.error('NDA (preliminar) falló', err); }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('lead handler error', err);
    return res.status(502).json({ error: 'No se pudo enviar la solicitud.' });
  }
}
