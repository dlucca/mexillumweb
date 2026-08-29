import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/upload-url.js';

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

async function call(body) {
  const fetchReal = globalThis.fetch;
  const env = { u: process.env.SUPABASE_URL, k: process.env.SUPABASE_SERVICE_ROLE_KEY };
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ url: '/storage/v1/upload/sign/facturas/x?token=tok', token: 'tok' })
  });
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv-key';
  const res = fakeRes();
  try {
    await handler({ method: 'POST', body }, res);
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
  const res = await call({ lead_id: 'abc', filename: 'x.exe', contentType: 'application/x-msdownload' });
  assert.equal(res.statusCode, 400);
});

test('devuelve url absoluta, path y token para un pdf', async () => {
  const res = await call({ lead_id: 'abc', filename: 'recibo.pdf', contentType: 'application/pdf' });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.path.startsWith('abc/'));
  assert.ok(res.body.url.startsWith('https://proj.supabase.co/'));
  assert.equal(res.body.token, 'tok');
});
