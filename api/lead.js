// Vercel serverless function — receives the contact form and emails the lead via Resend.
// Requires env var RESEND_API_KEY. Optional: LEAD_TO, LEAD_FROM.
// No npm deps: calls the Resend REST API with the built-in fetch (Node 18+).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

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

  const nombre = (body.nombre || '').toString().trim();
  const empresa = (body.empresa || '').toString().trim();
  const sector = (body.sector || '').toString().trim();
  const correo = (body.correo || '').toString().trim();

  if (!nombre || !empresa || !sector || !EMAIL_RE.test(correo)) {
    return res.status(400).json({ error: 'Datos incompletos o inválidos.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO || 'info@mexillum.com';
  const from = process.env.LEAD_FROM || 'Mexillum Web <notificaciones@mexillum.com>';
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'Config del servidor incompleta.' });
  }

  const subject = `Nuevo diagnóstico — ${empresa} (${sector})`;
  const text =
    `Nueva solicitud de diagnóstico\n\n` +
    `Nombre:  ${nombre}\n` +
    `Empresa: ${empresa}\n` +
    `Sector:  ${sector}\n` +
    `Correo:  ${correo}\n`;
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#16221A;max-width:520px">` +
    `<h2 style="margin:0 0 16px;font-size:18px;color:#080A08">Nueva solicitud de diagnóstico</h2>` +
    `<table style="border-collapse:collapse;font-size:14px">` +
    `<tr><td style="padding:6px 16px 6px 0;color:#6F796E">Nombre</td><td style="padding:6px 0"><strong>${esc(nombre)}</strong></td></tr>` +
    `<tr><td style="padding:6px 16px 6px 0;color:#6F796E">Empresa</td><td style="padding:6px 0"><strong>${esc(empresa)}</strong></td></tr>` +
    `<tr><td style="padding:6px 16px 6px 0;color:#6F796E">Sector</td><td style="padding:6px 0"><strong>${esc(sector)}</strong></td></tr>` +
    `<tr><td style="padding:6px 16px 6px 0;color:#6F796E">Correo</td><td style="padding:6px 0"><a href="mailto:${esc(correo)}">${esc(correo)}</a></td></tr>` +
    `</table>` +
    `<p style="margin:20px 0 0;font-size:12px;color:#9AA398">Enviado desde el formulario de mexillum.com</p>` +
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
