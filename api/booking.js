// Vercel serverless function — webhook de Cal.com (self-hosted en cal.mexillum.com).
// Al crear una reserva, pide a DocuSeal que genere el NDA unilateral (firmado por
// Mexillum en la plantilla) con el nombre del lead pre-llenado y se lo mande por correo.
//
// Autenticación: Cal debe apuntar a /api/booking?token=<CAL_WEBHOOK_SECRET>.
// Env vars: CAL_WEBHOOK_SECRET, DOCUSEAL_URL, DOCUSEAL_API_TOKEN, DOCUSEAL_TEMPLATE_ID.
// Opcional: DOCUSEAL_ROLE (nombre del rol/parte en la plantilla; default 'First Party').

import { sendNda } from '../lib/nda.js';

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// Lee un campo de las respuestas de la reserva de Cal (string o { value }).
const respVal = (responses, key) => {
  const r = responses && responses[key];
  if (r == null) return '';
  return String(typeof r === 'object' ? (r.value ?? '') : r).trim();
};

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
    console.warn('[booking] token no coincide');
    return res.status(401).json({ error: 'No autorizado.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const payload = body.payload || body;
  const attendee = (Array.isArray(payload.attendees) && payload.attendees[0]) || {};
  const nombre = clean(attendee.name, 120);
  const correo = clean(attendee.email, 160);

  // Solo actuamos cuando se crea una reserva; los demás eventos se ignoran.
  if (body.triggerEvent && body.triggerEvent !== 'BOOKING_CREATED') {
    return res.status(200).json({ ok: true, ignored: body.triggerEvent });
  }

  if (!correo) {
    return res.status(400).json({ error: 'Reserva sin correo del asistente.' });
  }

  const responses = payload.responses || payload.userFieldsResponses || {};
  const empresa = clean(respVal(responses, 'empresa'), 160);
  const resultado = await sendNda({ nombre, correo, empresa });
  if (resultado.ok) return res.status(200).json({ ok: true });
  if (resultado.skipped) {
    console.error('NDA no enviado (config incompleta o sin correo):', resultado.skipped);
    return res.status(500).json({ error: 'Config del servidor incompleta.' });
  }
  return res.status(502).json({ error: 'No se pudo generar el NDA.' });
}
