// Contrato del webhook de Cal.com → DocuSeal. Al agendar, el endpoint pide a
// DocuSeal (POST /api/submissions) que genere el NDA pre-llenado y lo mande al lead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/booking.js';

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

// Corre el handler con fetch stubeado y env de DocuSeal. Devuelve lo enviado a DocuSeal.
async function correr(req, { token = 'sekret', docuseal = true, dsFail = null } = {}) {
  const capt = [];
  const fetchReal = globalThis.fetch;
  const env = { ...process.env };
  globalThis.fetch = async (url, opts) => {
    capt.push({ url, opts, body: JSON.parse(opts.body) });
    if (dsFail) {
      return { ok: false, status: dsFail.status, json: async () => ({}), text: async () => dsFail.detail };
    }
    return { ok: true, status: 200, json: async () => ({ id: 1, submitters: [{ slug: 'x' }] }), text: async () => '' };
  };
  process.env.CAL_WEBHOOK_SECRET = token;
  if (docuseal) {
    process.env.DOCUSEAL_URL = 'https://docuseal.example.com';
    process.env.DOCUSEAL_API_TOKEN = 'ds-token';
    process.env.DOCUSEAL_TEMPLATE_ID = '2';
  } else {
    delete process.env.DOCUSEAL_URL; delete process.env.DOCUSEAL_API_TOKEN; delete process.env.DOCUSEAL_TEMPLATE_ID;
  }
  const res = fakeRes();
  try {
    await handler(req, res);
  } finally {
    globalThis.fetch = fetchReal;
    process.env = env;
  }
  return { res, docusealCall: capt[0] };
}

const bookingBody = {
  triggerEvent: 'BOOKING_CREATED',
  payload: {
    attendees: [{ name: 'Cristian Dlucca', email: 'cristian@novapatch.mx' }],
    responses: { empresa: { value: 'Novapatch S.A. de C.V.' } },
    startTime: '2026-09-03T19:30:00Z'
  }
};

const reqBase = (over = {}) => ({
  method: 'POST',
  query: { token: 'sekret' },
  headers: {},
  body: bookingBody,
  ...over
});

test('api/booking: rechaza métodos que no son POST', async () => {
  const { res } = await correr(reqBase({ method: 'GET' }));
  assert.equal(res.statusCode, 405);
});

test('api/booking: sin token válido responde 401 y no llama a DocuSeal', async () => {
  const { res, docusealCall } = await correr(reqBase({ query: { token: 'malo' } }));
  assert.equal(res.statusCode, 401);
  assert.equal(docusealCall, undefined);
});

test('api/booking: config de DocuSeal ausente responde 500', async () => {
  const { res } = await correr(reqBase(), { docuseal: false });
  assert.equal(res.statusCode, 500);
});

test('api/booking: booking válido crea submission con prospecto y fecha pre-llenados', async () => {
  const { res, docusealCall } = await correr(reqBase());
  assert.equal(res.statusCode, 200);
  assert.ok(docusealCall, 'debió llamar a DocuSeal');
  assert.match(docusealCall.url, /\/api\/submissions$/);
  assert.equal(docusealCall.opts.headers['X-Auth-Token'], 'ds-token');
  const b = docusealCall.body;
  assert.equal(b.template_id, 2);
  assert.equal(b.send_email, true);
  const sub = b.submitters[0];
  assert.equal(sub.email, 'cristian@novapatch.mx');
  assert.equal(sub.role, 'Primera Parte'); // debe coincidir con el rol de la plantilla
  assert.equal(sub.completed, true);
  const prospecto = sub.fields.find((f) => f.name === 'prospecto');
  const fecha = sub.fields.find((f) => f.name === 'fecha');
  assert.equal(prospecto.default_value, 'Novapatch S.A. de C.V.'); // usa la empresa, no el nombre
  assert.ok(fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha.default_value));
});

test('api/booking: sin empresa, el prospecto cae al nombre del asistente', async () => {
  const body = { triggerEvent: 'BOOKING_CREATED', payload: { attendees: [{ name: 'Cristian Dlucca', email: 'c@x.mx' }] } };
  const { docusealCall } = await correr(reqBase({ body }));
  const prospecto = docusealCall.body.submitters[0].fields.find((f) => f.name === 'prospecto');
  assert.equal(prospecto.default_value, 'Cristian Dlucca');
});

test('api/booking: evento que no es BOOKING_CREATED se ignora (200 sin llamar DocuSeal)', async () => {
  const { res, docusealCall } = await correr(reqBase({ body: { ...bookingBody, triggerEvent: 'BOOKING_CANCELLED' } }));
  assert.equal(res.statusCode, 200);
  assert.equal(docusealCall, undefined);
});

test('api/booking: error de DocuSeal responde 502 con el detalle para depurar', async () => {
  const { res } = await correr(reqBase(), { dsFail: { status: 422, detail: '{"error":"role \\"First Party\\" not found"}' } });
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.docuseal_status, 422);
  assert.match(res.body.docuseal_detail, /role/);
});

test('api/booking: sin correo del asistente responde 400', async () => {
  const { res } = await correr(reqBase({ body: { triggerEvent: 'BOOKING_CREATED', payload: { attendees: [] } } }));
  assert.equal(res.statusCode, 400);
});
