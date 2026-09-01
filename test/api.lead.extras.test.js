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

test('correo interno incluye ubicación, techo, acometida y facturas cuando vienen', async () => {
  const { emails } = await enviar({
    ...base,
    ubicacion: { direccion: 'Calle 1', lat: 19.4, lng: -99.1 },
    techo: { area_m2: 250, poligono: [] },
    acometida: { lat: 19.4002, lng: -99.1003, tipo: 'transformador', precision: 'aproximada', capacidad_kva: 500 },
    facturas: { paths: ['abc/1-a.pdf', 'abc/2-b.pdf'], count: 2 }
  });
  const interno = emails.find((e) => e.to && e.to.includes('mexillum.com'));
  assert.ok(interno, 'hay correo interno');
  assert.match(interno.text, /Calle 1/);
  assert.match(interno.text, /250/);
  assert.match(interno.text, /Punto eléctrico: Transformador/);
  assert.match(interno.text, /500 kVA/);
  assert.match(interno.text, /2 factura/i);
});

test('sin extras el correo interno se envía igual (no regresión)', async () => {
  const { res, emails } = await enviar(base);
  assert.equal(res.statusCode, 200);
  assert.ok(emails.length >= 1);
});

test('tipo_cierre preliminar dispara correo con el diagnóstico al cliente', async () => {
  const { emails } = await enviar({ ...base, tipo_cierre: 'preliminar' });
  const alCliente = emails.find((e) => e.to === 'ana@acme.mx');
  assert.ok(alCliente, 'hay correo al cliente');
  assert.match(alCliente.subject, /diagnóstico energético/i);
  assert.match(alCliente.text, /Perfil X/);
  assert.match(alCliente.text, /determinar tu proyecto con mayor precisión/i);
});

test('tipo_cierre llamada NO manda correo al cliente', async () => {
  const { emails } = await enviar({ ...base, tipo_cierre: 'llamada' });
  assert.equal(emails.find((e) => e.to === 'ana@acme.mx'), undefined);
});

test('propuesta preliminar acepta empresa vacía', async () => {
  const { res } = await enviar({ ...base, empresa: '', tipo_cierre: 'preliminar' });
  assert.equal(res.statusCode, 200);
});

test('agenda requiere empresa para calificar el lead', async () => {
  const { res, emails } = await enviar({ ...base, empresa: '', tipo_cierre: 'llamada' });
  assert.equal(res.statusCode, 400);
  assert.equal(emails.length, 0);
});

test('un proyecto BESS con acometida no pide superficie solar en el correo', async () => {
  const { emails } = await enviar({
    ...base,
    tipo_cierre: 'preliminar',
    recomendacion_solucion: { tipo: 'BESS para capacidad', razon: 'Capacidad limitada.' },
    acometida: { lat: 19.4, lng: -99.1, tipo: 'subestacion', precision: 'exacta' }
  });
  const alCliente = emails.find((e) => e.to === 'ana@acme.mx');
  assert.ok(alCliente);
  assert.doesNotMatch(alCliente.text, /Superficie disponible en m²/);
  assert.match(alCliente.text, /ubicación de tu punto eléctrico principal/);
});

// Envía el lead con fetch stubeado (Resend + DocuSeal), capturando por URL.
async function enviarConDocuseal(payload, { docuseal = true } = {}) {
  const capturado = [];
  const fetchReal = globalThis.fetch;
  const envs = {
    r: process.env.RESEND_API_KEY,
    du: process.env.DOCUSEAL_URL, dt: process.env.DOCUSEAL_API_TOKEN, dtpl: process.env.DOCUSEAL_TEMPLATE_ID
  };
  globalThis.fetch = async (url, opts) => {
    capturado.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
    return { ok: true, json: async () => ({}), text: async () => '' };
  };
  process.env.RESEND_API_KEY = 'test-key';
  if (docuseal) {
    process.env.DOCUSEAL_URL = 'https://docuseal.example.com';
    process.env.DOCUSEAL_API_TOKEN = 'ds-token';
    process.env.DOCUSEAL_TEMPLATE_ID = '2';
  } else {
    delete process.env.DOCUSEAL_URL; delete process.env.DOCUSEAL_API_TOKEN; delete process.env.DOCUSEAL_TEMPLATE_ID;
  }
  const res = fakeRes();
  try { await handler({ method: 'POST', body: payload }, res); }
  finally {
    globalThis.fetch = fetchReal;
    process.env.RESEND_API_KEY = envs.r;
    if (envs.du === undefined) delete process.env.DOCUSEAL_URL; else process.env.DOCUSEAL_URL = envs.du;
    if (envs.dt === undefined) delete process.env.DOCUSEAL_API_TOKEN; else process.env.DOCUSEAL_API_TOKEN = envs.dt;
    if (envs.dtpl === undefined) delete process.env.DOCUSEAL_TEMPLATE_ID; else process.env.DOCUSEAL_TEMPLATE_ID = envs.dtpl;
  }
  return { res, requests: capturado };
}

test('preliminar con DocuSeal configurado dispara el envío del NDA', async () => {
  const { res, requests } = await enviarConDocuseal({
    ...base, correo: 'nda-preliminar@acme.mx', empresa: 'Acme', tipo_cierre: 'preliminar'
  });
  assert.equal(res.statusCode, 200);
  const ndaCall = requests.find((r) => r.url.includes('/api/submissions'));
  assert.ok(ndaCall, 'debió llamar a DocuSeal para el NDA');
});

test('tipo_cierre llamada NO dispara el NDA desde lead.js', async () => {
  const { res, requests } = await enviarConDocuseal({
    ...base, correo: 'nda-llamada@acme.mx', empresa: 'Acme', tipo_cierre: 'llamada'
  });
  assert.equal(res.statusCode, 200);
  const ndaCall = requests.find((r) => r.url.includes('/api/submissions'));
  assert.equal(ndaCall, undefined);
});

test('preliminar sin env de DocuSeal sigue devolviendo 200 y no revienta', async () => {
  const { res, requests } = await enviarConDocuseal({
    ...base, correo: 'nda-sin-config@acme.mx', empresa: 'Acme', tipo_cierre: 'preliminar'
  }, { docuseal: false });
  assert.equal(res.statusCode, 200);
  const ndaCall = requests.find((r) => r.url.includes('/api/submissions'));
  assert.equal(ndaCall, undefined);
});
