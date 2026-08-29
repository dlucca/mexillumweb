// Vercel serverless — firma una URL de subida a Supabase Storage para que el
// navegador suba una factura directo (evita el límite de body de Vercel).
// Requiere env SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Sin deps npm.

const BUCKET = 'facturas';
const ALLOWED = new Set(['application/pdf']);
const isImage = (t) => typeof t === 'string' && t.startsWith('image/');
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// Solo caracteres seguros para un nombre de objeto; el resto se colapsa a '-'.
function safeName(name) {
  const base = clean(name, 120).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return base || 'archivo';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const leadId = clean(body.lead_id, 64).replace(/[^a-zA-Z0-9-]/g, '');
  const filename = safeName(body.filename);
  const contentType = clean(body.contentType, 100);

  if (!leadId) return res.status(400).json({ error: 'lead_id requerido' });
  if (!(ALLOWED.has(contentType) || isImage(contentType))) {
    return res.status(400).json({ error: 'Tipo de archivo no permitido' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Supabase env vars ausentes');
    return res.status(500).json({ error: 'Config del servidor incompleta.' });
  }

  const path = `${leadId}/${Date.now()}-${filename}`;
  const signUrl = `${url}/storage/v1/object/upload/sign/${BUCKET}/${path}`;
  try {
    const r = await fetch(signUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('Supabase sign error', r.status, detail);
      return res.status(502).json({ error: 'No se pudo preparar la subida.' });
    }
    const data = await r.json();
    // Supabase devuelve una url relativa tipo /storage/v1/... ; la volvemos absoluta.
    const absolute = data.url && data.url.startsWith('http') ? data.url : `${url}${data.url}`;
    return res.status(200).json({ url: absolute, path, token: data.token });
  } catch (err) {
    console.error('upload-url handler error', err);
    return res.status(502).json({ error: 'No se pudo preparar la subida.' });
  }
}
