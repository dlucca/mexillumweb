import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/lead.js';
import { assembleResult } from '../js/diagnostico.engine.js';
import microred from '../js/diagnostico.microred.content.js';

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
    lead_id: 'abc',
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

// Punto 7: si Resend rechaza el correo al cliente, el handler no debe fingir éxito total.
async function enviarConClienteRechazado(payload) {
  const capturado = [];
  const fetchReal = globalThis.fetch;
  const keyReal = process.env.RESEND_API_KEY;
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    capturado.push(body);
    if (body.to === payload.correo) return { ok: false, status: 422, text: async () => 'invalid to' };
    return { ok: true, text: async () => '' };
  };
  process.env.RESEND_API_KEY = 'test-key';
  const res = fakeRes();
  try { await handler({ method: 'POST', body: payload }, res); }
  finally {
    globalThis.fetch = fetchReal;
    if (keyReal === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = keyReal;
  }
  return { res, emails: capturado };
}

test('si el correo al cliente falla, responde 200 pero avisa correo_cliente:false', async () => {
  const { res, emails } = await enviarConClienteRechazado({ ...base, correo: 'rebote@acme.mx', tipo_cierre: 'preliminar' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.correo_cliente, false);
  assert.equal(emails.length, 2, 'se intentó el correo interno y el del cliente');
});

test('si el correo al cliente sale bien, responde correo_cliente:true', async () => {
  const { res } = await enviar({ ...base, correo: 'ok1@acme.mx', tipo_cierre: 'preliminar' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.correo_cliente, true);
});

// Punto 5: el handler no debe firmar links de paths ajenos al lead_id del payload.
test('solo firma facturas cuyo path empieza con lead_id/', async () => {
  const { emails } = await enviar({
    ...base,
    lead_id: 'lead-propio-123',
    facturas: { paths: ['lead-propio-123/1-a.pdf', 'otro-lead/1-b.pdf', '../../secreto.pdf'] }
  });
  const text = emails[0].text;
  assert.match(text, /1 facturas? subidas?/);
  assert.doesNotMatch(text, /otro-lead/);
  assert.doesNotMatch(text, /secreto/);
});

test('sin lead_id no firma ninguna factura', async () => {
  const { emails } = await enviar({ ...base, facturas: { paths: ['x/1-a.pdf'] } });
  assert.doesNotMatch(emails[0].text, /facturas subidas/);
});

test('v4: correo interno muestra las cuatro salidas y el freno con segundo paso', async () => {
  const { emails } = await enviar({
    ...base,
    encaje_tecnico: 'Alto', tamano: 'Grande', confianza: { nivel: 'Media', faltantes: ['techo'] }, intencion: 'Evaluando',
    freno: 'gestion_carga_primero',
    recomendacion_solucion: { tipo: 'Gestión de carga primero', razon: 'r1', primerPaso: true, segundoPaso: { tipo: 'BESS para gestionar carga', razon: 'r2' } }
  });
  const t = emails[0].text;
  assert.match(t, /Encaje técnico:\s*Alto/);
  assert.match(t, /Tamaño:\s*Grande/);
  assert.match(t, /Confianza:\s*Media \(falta: techo\)/);
  assert.match(t, /Intención:\s*Evaluando/);
  assert.match(t, /Primer paso:\s*Gestión de carga primero/);
  assert.match(t, /Segundo paso:\s*BESS para gestionar carga/);
  assert.doesNotMatch(t, /Potencial general/);
});

test('v4: sin red, ningún correo menciona CFE, RPU ni recibos', async () => {
  // Correo único (no base.correo): las tres pruebas preliminares anteriores ya
  // agotaron el throttle de correo-cliente para 'ana@acme.mx' en este archivo
  // (Map de estado en módulo, compartido dentro del mismo proceso de test).
  const correoSinRed = 'sinred@acme.mx';
  const { emails } = await enviar({
    ...base, correo: correoSinRed, tipo_cierre: 'preliminar', conectado: false,
    email_vocabulary: {
      site: 'sitio remoto', technicalContact: 'responsable',
      documentos: { conectado: 'tus 12 recibos de CFE', aislado: 'tu consumo diario (kWh) y litros de diésel' },
      idServicio: 'Número de servicio (RPU) de tu recibo CFE.'
    },
    datos_consumo: { kwh_dia: 800, kw_pico: 120, litros_diesel_mes: 3000, horas_autonomia: 8 },
    preguntas: [{ key: 'sector', label: 'Tipo de sitio' }],
    respuestas_legibles: { sector: 'Mina' }
  });
  for (const e of emails) {
    assert.doesNotMatch(e.text, /CFE/);
    assert.doesNotMatch(e.text, /RPU/);
    assert.doesNotMatch(e.text, /recibos?/i);
  }
  assert.match(emails[0].text, /Datos de consumo/);
  assert.match(emails[0].text, /800 kWh\/día/);
  // "Ya tenemos" enumera los datos que el cliente aportó, con sus propios números.
  const cliente = emails.find((e) => e.to === correoSinRed);
  assert.match(cliente.text, /Ya tenemos[^.]*tus datos de consumo \(800 kWh\/día/);
  assert.doesNotMatch(cliente.text, /Ya tenemos[^.]*consumo diario/);
});

test('v4: las preguntas del correo salen del payload, con fallback a la lista fija', async () => {
  const conLista = await enviar({ ...base, preguntas: [{ key: 'sector', label: 'Tipo de sitio' }], respuestas_legibles: { sector: 'Mina' } });
  assert.match(conLista.emails[0].text, /1\. Tipo de sitio: Mina/);
  assert.doesNotMatch(conLista.emails[0].text, /2\. /);
  const sinLista = await enviar({ ...base, respuestas_legibles: { sector: 'Mina' } });
  assert.match(sinLista.emails[0].text, /1\. Sector \/ operación: Mina/);
});

test('v4: sin red y sin lista de preguntas, el fallback no dice CFE', async () => {
  const { emails } = await enviar({ ...base, correo: 'sinred2@acme.mx', conectado: false, respuestas_legibles: { tarifa: 'Diésel' } });
  assert.doesNotMatch(emails[0].text, /CFE/);
  assert.match(emails[0].text, /Tarifa o suministro: Diésel/);
});

test('v4: primerPaso sin tipo de recomendación no rompe el correo', async () => {
  const { res, emails } = await enviar({ ...base, correo: 'pp@acme.mx', recomendacion_solucion: { tipo: '', razon: '', primerPaso: true, segundoPaso: { tipo: 'BESS', razon: 'r' } } });
  assert.equal(res.statusCode, 200);
  assert.doesNotMatch(emails[0].text, /Primer paso/);
});

// Payload REAL del motor (no un fixture a mano): microred sin red, con diésel. Ni el
// correo al cliente ni el interno deben pedir documentos de CFE (spec v4 §2.4).
// "la red de CFE" en el copy sí está permitido; lo que no, son recibos, RPU o tarifa CFE.
test('v4: payload real sin red no pide recibos, RPU ni etiqueta la tarifa como CFE', async () => {
  const estado = {
    respuestas: {
      sector: 'mineria', disparador: ['diesel'], perfil: 'plano', generacion: 'no',
      tarifa: 'diesel', factura: 'medio', fuente: 'diesel_24h'
    },
    contacto: { nombre: 'Ana', empresa: 'Acme', correo: 'real-sinred@acme.mx', tipo_cierre: 'preliminar' },
    datos_consumo: { kwh_dia: 800, kw_pico: 120, litros_diesel_mes: 3000, horas_autonomia: 8 }
  };
  const { leadPayload } = assembleResult(estado, microred);
  assert.equal(leadPayload.conectado, false);
  const { emails } = await enviar(leadPayload);
  assert.ok(emails.find((e) => e.to === 'real-sinred@acme.mx'), 'hay correo al cliente');
  for (const e of emails) {
    assert.doesNotMatch(e.text, /recibos?/i, `pide recibos: ${e.to}`);
    assert.doesNotMatch(e.text, /RPU/, `pide RPU: ${e.to}`);
    assert.doesNotMatch(e.text, /Tarifa CFE/, `etiqueta tarifa CFE: ${e.to}`);
    assert.doesNotMatch(e.html || '', /recibos?/i, `pide recibos en HTML: ${e.to}`);
  }
});

test('datos_consumo ignora valores que no son números (true, vacío, arreglo)', async () => {
  const { emails } = await enviar({
    ...base, correo: 'consumo-basura@acme.mx',
    datos_consumo: { kwh_dia: true, kw_pico: '  ', litros_diesel_mes: [], horas_autonomia: '8' }
  });
  assert.match(emails[0].text, /Datos de consumo: 8 h de autonomía/);
  assert.doesNotMatch(emails[0].text, /1 kWh\/día|0 kW pico|0 L diésel/);
});
