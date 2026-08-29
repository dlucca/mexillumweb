import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/lead.js';

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

// Captura todos los emails enviados y las peticiones de firma a Supabase.
async function enviar(payload) {
  const capturado = [];
  const fetchReal = globalThis.fetch;
  const envs = {
    r: process.env.RESEND_API_KEY, u: process.env.SUPABASE_URL, k: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/storage/v1/object/sign/')) {
      return { ok: true, json: async () => ({ signedURL: '/storage/v1/object/sign/facturas/x?token=t' }) };
    }
    capturado.push(JSON.parse(opts.body));
    return { ok: true, text: async () => '' };
  };
  process.env.RESEND_API_KEY = 'test-key';
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv';
  const res = fakeRes();
  try { await handler({ method: 'POST', body: payload }, res); }
  finally {
    globalThis.fetch = fetchReal;
    process.env.RESEND_API_KEY = envs.r;
    process.env.SUPABASE_URL = envs.u; process.env.SUPABASE_SERVICE_ROLE_KEY = envs.k;
  }
  return { res, emails: capturado };
}

const base = {
  nombre: 'Ana', correo: 'ana@acme.mx', empresa: 'Acme',
  perfil: 'Perfil X', rango_texto: '100–200',
  respuestas_legibles: {}, respuestas_codigos: {}
};

test('correo interno incluye ubicacion, techo y facturas cuando vienen', async () => {
  const { emails } = await enviar({
    ...base,
    ubicacion: { direccion: 'Calle 1', lat: 19.4, lng: -99.1 },
    techo: { area_m2: 250, poligono: [] },
    facturas: { paths: ['abc/1-a.pdf', 'abc/2-b.pdf'], count: 2 }
  });
  const interno = emails.find((e) => e.to && e.to.includes('mexillum.com'));
  assert.ok(interno, 'hay correo interno');
  assert.match(interno.text, /Calle 1/);
  assert.match(interno.text, /250/);
  assert.match(interno.text, /2 factura/i);
});

test('sin extras el correo interno se envía igual (no regresión)', async () => {
  const { res, emails } = await enviar(base);
  assert.equal(res.statusCode, 200);
  assert.ok(emails.length >= 1);
});

test('tipo_cierre preliminar dispara correo breve al cliente', async () => {
  const { emails } = await enviar({ ...base, tipo_cierre: 'preliminar' });
  const alCliente = emails.find((e) => e.to === 'ana@acme.mx');
  assert.ok(alCliente, 'hay correo al cliente');
  assert.match(alCliente.text, /pronto te contactaremos/i);
});

test('tipo_cierre llamada NO manda correo al cliente', async () => {
  const { emails } = await enviar({ ...base, tipo_cierre: 'llamada' });
  assert.equal(emails.find((e) => e.to === 'ana@acme.mx'), undefined);
});
