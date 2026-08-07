// Vercel serverless function — receives the diagnóstico funnel payload and emails
// the lead via Resend. Fired from js/diagnostico.view.js on cal.diy bookingSuccessful,
// so every lead that reaches here already has a call on the calendar.
// Requires env var RESEND_API_KEY. Optional: LEAD_TO, LEAD_FROM.
// No npm deps: calls the Resend REST API with the built-in fetch (Node 18+).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

// Clamp anything that lands in the email: the payload is client-supplied.
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// Etiquetas visibles de cada paso del funnel, en el orden en que se preguntan.
const PREGUNTAS = [
  ['tipo_instalacion', 'Tipo de instalación'],
  ['generacion_propia', 'Generación propia'],
  ['patron_operacion', 'Patrón de operación'],
  ['interrupciones', 'Interrupciones'],
  ['diesel_red_debil', 'Diésel / red débil'],
  ['exporta_excedente', 'Exporta excedente'],
];

const NIVEL_COLOR = { alto: '#1F7A3D', medio: '#8A6A16', bajo: '#6F796E' };

function formatDatetime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return clean(iso, 60);
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  }).format(d) + ' (CDMX)';
}

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

  // Honeypot: real users never fill this. If present, pretend success and drop it.
  if (body.website) return res.status(200).json({ ok: true });

  const nombre = clean(body.nombre, 120);
  const correo = clean(body.correo, 160);
  const empresa = clean(body.empresa, 120);   // cal.diy no siempre lo pide
  const telefono = clean(body.telefono, 40);
  const cargo = clean(body.cargo, 120);

  // Solo nombre y correo son obligatorios: es lo que cal.diy garantiza en el booking.
  if (!nombre || !EMAIL_RE.test(correo)) {
    return res.status(400).json({ error: 'Datos incompletos o inválidos.' });
  }

  const legibles = (body.respuestas_legibles && typeof body.respuestas_legibles === 'object')
    ? body.respuestas_legibles
    : {};
  const codigos = (body.respuestas_codigos && typeof body.respuestas_codigos === 'object')
    ? body.respuestas_codigos
    : {};
  const score = (body.score && typeof body.score === 'object') ? body.score : {};
  const nivel = clean(score.nivel, 10) || 'n/d';
  const valor = Number.isFinite(Number(score.valor)) ? Number(score.valor) : '—';
  const arquetipo = clean(body.arquetipo_base, 40) || '—';
  const refuerzo = clean(body.refuerzo_activado, 40) || 'ninguno';
  const leadId = clean(body.lead_id, 64);
  const agendado = body.booking_agendado === true;
  const cuando = formatDatetime(body.booking_datetime);

  const checklist = Array.isArray(body.checklist_full)
    ? body.checklist_full.slice(0, 12).map((b) => clean(b, 240)).filter(Boolean)
    : [];

  const respuestas = PREGUNTAS.map(([key, label]) => {
    const visible = clean(legibles[key], 240);
    const codigo = clean(codigos[key], 40);
    return { label, visible: visible || codigo || '—', codigo };
  });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO || 'info@mexillum.com';
  const from = process.env.LEAD_FROM || 'Mexillum Web <notificaciones@mexillum.com>';
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'Config del servidor incompleta.' });
  }

  const quien = empresa ? `${nombre} — ${empresa}` : nombre;
  const subject = `Diagnóstico${agendado ? ' + llamada agendada' : ''} — ${quien} · score ${nivel}`;

  const text = [
    agendado ? 'Nuevo lead con llamada agendada' : 'Nuevo diagnóstico completado',
    '',
    `Nombre:   ${nombre}`,
    `Empresa:  ${empresa || '—'}`,
    `Correo:   ${correo}`,
    `Teléfono: ${telefono || '—'}`,
    `Cargo:    ${cargo || '—'}`,
    cuando ? `Llamada:  ${cuando}` : null,
    '',
    `Score: ${valor} (${nivel})  ·  Arquetipo: ${arquetipo}  ·  Refuerzo: ${refuerzo}`,
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
    `<h2 style="margin:0 0 4px;font-size:18px;color:#080A08">` +
    `${agendado ? 'Nuevo lead con llamada agendada' : 'Nuevo diagnóstico completado'}</h2>` +
    `<p style="margin:0 0 16px;font-size:13px;color:${NIVEL_COLOR[nivel] || '#6F796E'}">` +
    `<strong>Score ${esc(String(valor))} — ${esc(nivel)}</strong> · arquetipo <strong>${esc(arquetipo)}</strong> · refuerzo <strong>${esc(refuerzo)}</strong></p>` +

    `<table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">` +
    fila('Nombre', nombre) +
    fila('Empresa', empresa || '—') +
    `<tr><td style="padding:6px 16px 6px 0;color:#6F796E">Correo</td>` +
    `<td style="padding:6px 0"><a href="mailto:${esc(correo)}">${esc(correo)}</a></td></tr>` +
    (telefono ? fila('Teléfono', telefono) : '') +
    (cargo ? fila('Cargo', cargo) : '') +
    (cuando ? fila('Llamada', cuando) : '') +
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
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
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
