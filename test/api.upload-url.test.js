import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/upload-url.js';

const LEAD = '2f1c9a4e-1b2d-4c3e-9f8a-7b6c5d4e3f2a';

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

async function call(body, { existentes = [], headers = {} } = {}) {
  const fetchReal = globalThis.fetch;
  const env = { u: process.env.SUPABASE_URL, k: process.env.SUPABASE_SERVICE_ROLE_KEY };
  globalThis.fetch = async (url) => {
    if (String(url).includes('/storage/v1/object/list/')) {
      return { ok: true, json: async () => existentes.map((n) => ({ name: n })) };
    }
    return {
      ok: true,
      json: async () => ({ url: '/storage/v1/upload/sign/facturas/x?token=tok', token: 'tok' })
    };
  };
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv-key';
  const res = fakeRes();
  try {
    await handler({ method: 'POST', body, headers }, res);
  } finally {
    globalThis.fetch = fetchReal;
    process.env.SUPABASE_URL = env.u; process.env.SUPABASE_SERVICE_ROLE_KEY = env.k;
  }
  return res;
}

test('rechaza método que no es POST', async () => {
  const res = fakeRes();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 405);
});

test('rechaza tipo de archivo no permitido', async () => {
  const res = await call({ lead_id: LEAD, filename: 'x.exe', contentType: 'application/x-msdownload' });
  assert.equal(res.statusCode, 400);
});

test('devuelve url absoluta, path y token para un pdf', async () => {
  const res = await call({ lead_id: LEAD, filename: 'recibo.pdf', contentType: 'application/pdf' });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.path.startsWith(LEAD + '/'));
  assert.ok(res.body.url.startsWith('https://proj.supabase.co/'));
  assert.equal(res.body.token, 'tok');
});

test('rechaza lead_id corto o con caracteres raros', async () => {
  const a = await call({ lead_id: 'abc', filename: 'r.pdf', contentType: 'application/pdf' });
  assert.equal(a.statusCode, 400);
  const b = await call({ lead_id: '../' + LEAD, filename: 'r.pdf', contentType: 'application/pdf' });
  assert.equal(b.statusCode, 400);
});

test('solo acepta pdf, jpeg, png, heic y webp (no svg ni gif)', async () => {
  const svg = await call({ lead_id: LEAD, filename: 'r.svg', contentType: 'image/svg+xml' });
  assert.equal(svg.statusCode, 400);
  const gif = await call({ lead_id: LEAD, filename: 'r.gif', contentType: 'image/gif' });
  assert.equal(gif.statusCode, 400);
  const jpg = await call({ lead_id: LEAD, filename: 'foto.jpg', contentType: 'image/jpeg' });
  assert.equal(jpg.statusCode, 200);
  const heic = await call({ lead_id: LEAD, filename: 'foto.HEIC', contentType: 'image/heic' });
  assert.equal(heic.statusCode, 200);
});

test('la extensión debe coincidir con el tipo declarado', async () => {
  const res = await call({ lead_id: LEAD, filename: 'recibo.exe', contentType: 'application/pdf' });
  assert.equal(res.statusCode, 400);
});

test('rechaza archivos declarados mayores a 10 MB', async () => {
  const res = await call({ lead_id: LEAD, filename: 'r.pdf', contentType: 'application/pdf', size: 10 * 1024 * 1024 + 1 });
  assert.equal(res.statusCode, 400);
  const ok = await call({ lead_id: LEAD, filename: 'r.pdf', contentType: 'application/pdf', size: 5 * 1024 * 1024 });
  assert.equal(ok.statusCode, 200);
});

test('no firma más de 12 archivos por lead (cupo durable en storage)', async () => {
  const doce = Array.from({ length: 12 }, (_, i) => `${i}-r.pdf`);
  const res = await call({ lead_id: LEAD, filename: 'r.pdf', contentType: 'application/pdf' }, { existentes: doce });
  assert.equal(res.statusCode, 429);
  const once = doce.slice(0, 11);
  const ok = await call({ lead_id: LEAD, filename: 'r.pdf', contentType: 'application/pdf' }, { existentes: once });
  assert.equal(ok.statusCode, 200);
});
