// Vercel serverless function — recibe el payload del funnel de diagnóstico v2 y envía
// el lead por email vía Resend. Se dispara una sola vez desde js/diagnostico.view.js
// al enviar el gate de contacto (antes de cualquier reserva).
// Requiere env var RESEND_API_KEY. Opcional: LEAD_TO, LEAD_FROM.
// Sin deps npm: usa fetch nativo (Node 18+).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

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

  if (!nombre || !EMAIL_RE.test(correo)) {
    return res.status(400).json({ error: 'Datos incompletos o inválidos.' });
  }

  const legibles = (body.respuestas_legibles && typeof body.respuestas_legibles === 'object') ? body.respuestas_legibles : {};
  const codigos = (body.respuestas_codigos && typeof body.respuestas_codigos === 'object') ? body.respuestas_codigos : {};
  const perfil = clean(body.perfil, 200) || '—';
  const rangoTexto = clean(body.rango_texto, 120) || '—';
  const leadId = clean(body.lead_id, 64);

  const tipoCierre = clean(body.tipo_cierre, 20);
  const ubic = (body.ubicacion && typeof body.ubicacion === 'object' && !Array.isArray(body.ubicacion))
    ? {
        direccion: clean(body.ubicacion.direccion, 200),
        lat: Number(body.ubicacion.lat),
        lng: Number(body.ubicacion.lng)
      }
    : null;
  const techoArea = (body.techo && Number.isFinite(Number(body.techo.area_m2)))
    ? Math.round(Number(body.techo.area_m2))
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

  const respuestas = PREGUNTAS.map(([key, label]) => {
    const etiqueta = (origen === 'hoteles' && PREGUNTAS_HOTELES[key]) ? PREGUNTAS_HOTELES[key] : label;
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
  const subject = origen === 'hoteles'
    ? `Diagnóstico Hoteles — ${quien}`
    : `Diagnóstico — ${quien}`;

  // Links firmados temporales (30 días) para que ventas abra las facturas privadas.
  async function firmarFacturas(paths) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || !paths.length) return [];
    const out = [];
    for (const p of paths) {
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
    '',
    perfil,
    `Rango estimado: ${rangoTexto}`,
    potencial ? `Potencial general: ${potencial}` : null,
    recomendacion ? `Recomendación: ${recomendacion.tipo}` : null,
    aplicacion ? `Aplicación principal: ${aplicacion}` : null,
    ranking.length ? 'Ranking: ' + ranking.map((o) => `${o.nombre} ${o.score}`).join(' · ') : null,
    '',
    ubic ? `Ubicación: ${ubic.direccion || '—'} (${ubic.lat}, ${ubic.lng})` : null,
    techoArea != null ? `Techo dibujado: ~${techoArea} m²` : null,
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
    `</table>` +

    (ubic || techoArea != null || facturaLinks.length
      ? `<table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">` +
        (ubic ? fila('Ubicación', `${ubic.direccion || '—'} (${ubic.lat}, ${ubic.lng})`) : '') +
        (techoArea != null ? fila('Techo dibujado', `~${techoArea} m²`) : '') +
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

    if (tipoCierre === 'preliminar' && EMAIL_RE.test(correo)) {
      const textoCliente =
        `Hola ${nombre || ''},\n\n` +
        `Recibimos tus datos. Pronto te contactaremos con tu propuesta preliminar.\n\n` +
        `— Equipo Mexillum`;
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from, to: correo, subject: 'Recibimos tus datos — Mexillum', text: textoCliente
          })
        });
      } catch (err) { console.error('correo cliente falló', err); }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('lead handler error', err);
    return res.status(502).json({ error: 'No se pudo enviar la solicitud.' });
  }
}
