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
  ['sitios', 'Instalaciones'],
  ['generacion', 'Generación propia'],
  ['demanda', 'Conoce el cargo por demanda'],
  ['tarifa', 'Tarifa CFE'],
  ['factura', 'Factura mensual'],
  ['corte', 'Impacto de un corte'],
  ['disparador', 'Disparador'],
];

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

  if (!nombre || !EMAIL_RE.test(correo)) {
    return res.status(400).json({ error: 'Datos incompletos o inválidos.' });
  }

  const legibles = (body.respuestas_legibles && typeof body.respuestas_legibles === 'object') ? body.respuestas_legibles : {};
  const codigos = (body.respuestas_codigos && typeof body.respuestas_codigos === 'object') ? body.respuestas_codigos : {};
  const perfil = clean(body.perfil, 200) || '—';
  const rangoTexto = clean(body.rango_texto, 120) || '—';
  const leadId = clean(body.lead_id, 64);

  const checklist = Array.isArray(body.checklist_full)
    ? body.checklist_full.slice(0, 12).map((b) => clean(b, 240)).filter(Boolean)
    : [];

  const respuestas = PREGUNTAS.map(([key, label]) => {
    const visible = clean(legibles[key], 240);
    const codigo = clean(codigos[key], 40);
    return { label, visible: visible || codigo || '—' };
  });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO || 'info@mexillum.com';
  const from = process.env.LEAD_FROM || 'Mexillum Web <notificaciones@mexillum.com>';
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'Config del servidor incompleta.' });
  }

  const quien = empresa ? `${nombre} — ${empresa}` : nombre;
  const subject = `Diagnóstico — ${quien}`;

  const text = [
    'Nuevo diagnóstico completado',
    '',
    `Nombre:   ${nombre}`,
    `Empresa:  ${empresa || '—'}`,
    `Correo:   ${correo}`,
    `Teléfono: ${telefono || '—'}`,
    `Rol:      ${rol || '—'}`,
    '',
    perfil,
    `Rango estimado: ${rangoTexto}`,
    '',
    'Respuestas:',
    ...respuestas.map((r, i) => `${i + 1}. ${r.label}: ${r.visible}`),
    checklist.length ? '' : null,
    checklist.length ? 'Checklist para la llamada:' : null,
    ...checklist.map((b) => `• ${b}`),
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

    `<table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">` +
    fila('Nombre', nombre) +
    fila('Empresa', empresa || '—') +
    `<tr><td style="padding:6px 16px 6px 0;color:#6F796E">Correo</td>` +
    `<td style="padding:6px 0"><a href="mailto:${esc(correo)}">${esc(correo)}</a></td></tr>` +
    (telefono ? fila('Teléfono', telefono) : '') +
    (rol ? fila('Rol', rol) : '') +
    `</table>` +

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
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('lead handler error', err);
    return res.status(502).json({ error: 'No se pudo enviar la solicitud.' });
  }
}
