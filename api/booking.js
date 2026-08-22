// Vercel serverless function — webhook de Cal.com (self-hosted en cal.mexillum.com).
// Al crear una reserva, pide a DocuSeal que genere el NDA unilateral (firmado por
// Mexillum en la plantilla) con el nombre del lead pre-llenado y se lo mande por correo.
//
// Autenticación: Cal debe apuntar a /api/booking?token=<CAL_WEBHOOK_SECRET>.
// Env vars: CAL_WEBHOOK_SECRET, DOCUSEAL_URL, DOCUSEAL_API_TOKEN, DOCUSEAL_TEMPLATE_ID.
// Opcional: DOCUSEAL_ROLE (nombre del rol/parte en la plantilla; default 'First Party').

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret) {
    console.error('CAL_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'Config del servidor incompleta.' });
  }
  const token = (req.query && req.query.token) || '';
  if (token !== secret) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const url = process.env.DOCUSEAL_URL;
  const apiToken = process.env.DOCUSEAL_API_TOKEN;
  const templateId = Number(process.env.DOCUSEAL_TEMPLATE_ID);
  if (!url || !apiToken || !templateId) {
    console.error('DocuSeal config incompleta (DOCUSEAL_URL / DOCUSEAL_API_TOKEN / DOCUSEAL_TEMPLATE_ID)');
    return res.status(500).json({ error: 'Config del servidor incompleta.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Solo actuamos cuando se crea una reserva; los demás eventos se ignoran.
  if (body.triggerEvent && body.triggerEvent !== 'BOOKING_CREATED') {
    return res.status(200).json({ ok: true, ignored: body.triggerEvent });
  }

  const payload = body.payload || body;
  const attendee = (Array.isArray(payload.attendees) && payload.attendees[0]) || {};
  const nombre = clean(attendee.name, 120);
  const correo = clean(attendee.email, 160);
  if (!correo) {
    return res.status(400).json({ error: 'Reserva sin correo del asistente.' });
  }

  const fecha = new Date().toISOString().slice(0, 10);
  const role = process.env.DOCUSEAL_ROLE || 'First Party';

  const submission = {
    template_id: templateId,
    send_email: true,
    submitters: [
      {
        role,
        email: correo,
        name: nombre || undefined,
        completed: true, // auto-firmado vía API: el lead recibe el NDA ya listo, sin firmar
        fields: [
          { name: 'prospecto', default_value: nombre || correo, readonly: true },
          { name: 'fecha', default_value: fecha, readonly: true }
        ]
      }
    ]
  };

  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/api/submissions`, {
      method: 'POST',
      headers: { 'X-Auth-Token': apiToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(submission)
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('DocuSeal error', r.status, detail);
      return res.status(502).json({
        error: 'No se pudo generar el NDA.',
        docuseal_status: r.status,
        docuseal_detail: String(detail).slice(0, 500)
      });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('booking handler error', err);
    return res.status(502).json({ error: 'No se pudo generar el NDA.' });
  }
}
