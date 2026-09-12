// Vercel serverless — firma una URL de subida a Supabase Storage para que el
// navegador suba una factura directo (evita el límite de body de Vercel).
// Requiere env SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Sin deps npm.
//
// Controles del lado servidor (el navegador también valida, pero no es confiable):
//  - lead_id con forma válida (8–64 chars, solo [a-zA-Z0-9-]).
//  - MIME en lista blanca y extensión coherente con el MIME.
//  - Tamaño declarado ≤ 10 MB (el límite duro lo pone el bucket: file_size_limit).
//  - Cupo de 12 objetos por lead, contado en Storage (durable entre instancias).
//  - Throttle por IP best-effort en memoria (las instancias son efímeras).

const BUCKET = 'facturas';
const MAX_FILES = 12;
const MAX_BYTES = 10 * 1024 * 1024;
const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_MAX = 40;

// MIME permitido -> extensiones aceptadas para ese MIME.
const ALLOWED = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/heic': ['heic'],
  'image/heif': ['heif', 'heic'],
  'image/webp': ['webp']
};

const LEAD_RE = /^[a-zA-Z0-9-]{8,64}$/;
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// Solo caracteres seguros para un nombre de objeto; el resto se colapsa a '-'.
function safeName(name) {
  const base = clean(name, 120).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return base || 'archivo';
}

const ipHits = new Map(); // ip -> timestamps[]
function ipAllowed(ip) {
  if (!ip) return true;
  const now = Date.now();
  const fresh = (ipHits.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  if (fresh.length >= IP_MAX) { ipHits.set(ip, fresh); return false; }
  fresh.push(now);
  ipHits.set(ip, fresh);
  return true;
}

function clientIp(req) {
  const h = req.headers || {};
  const fwd = h['x-forwarded-for'] || h['X-Forwarded-For'] || '';
  return String(fwd).split(',')[0].trim() || h['x-real-ip'] || '';
}

// Cuenta cuántos objetos ya tiene el lead en el bucket. Si Storage no responde,
// devolvemos null y dejamos pasar: mejor perder el cupo que bloquear una subida real.
async function objetosDelLead(url, key, leadId) {
  try {
    const r = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: leadId, limit: MAX_FILES + 1, offset: 0 })
    });
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data) ? data.length : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ipAllowed(clientIp(req))) {
    return res.status(429).json({ error: 'Demasiadas subidas. Intenta en unos minutos.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const leadId = clean(body.lead_id, 64);
  const filename = safeName(body.filename);
  const contentType = clean(body.contentType, 100).toLowerCase();
  const size = Number(body.size);

  if (!LEAD_RE.test(leadId)) return res.status(400).json({ error: 'lead_id inválido' });
  const exts = ALLOWED[contentType];
  if (!exts) return res.status(400).json({ error: 'Tipo de archivo no permitido' });
  const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
  if (!exts.includes(ext)) return res.status(400).json({ error: 'La extensión no coincide con el tipo de archivo' });
  if (Number.isFinite(size) && size > MAX_BYTES) return res.status(400).json({ error: 'Archivo mayor a 10 MB' });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Supabase env vars ausentes');
    return res.status(500).json({ error: 'Config del servidor incompleta.' });
  }

  const existentes = await objetosDelLead(url, key, leadId);
  if (existentes !== null && existentes >= MAX_FILES) {
    return res.status(429).json({ error: `Máximo ${MAX_FILES} archivos por diagnóstico.` });
  }

  const path = `${leadId}/${Date.now()}-${filename}`;
  const signUrl = `${url}/storage/v1/object/upload/sign/${BUCKET}/${path}`;
  try {
    const r = await fetch(signUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
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
