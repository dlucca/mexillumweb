// Contrato entre el leadPayload del motor y el correo que arma api/lead.js.
// El handler lee campos por lista explícita: si el motor agrega uno y el handler no
// lo lee, el correo a ventas lo pierde en silencio. Estos tests cubren ese hueco.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/lead.js';
import content from '../js/diagnostico.content.js';
import { assembleResult } from '../js/diagnostico.engine.js';

function fakeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

// Corre el handler con fetch stubeado y devuelve el correo que se habría enviado.
async function enviar(payload) {
  const capturado = [];
  const fetchReal = globalThis.fetch;
  const keyReal = process.env.RESEND_API_KEY;
  globalThis.fetch = async (url, opts) => {
    capturado.push(JSON.parse(opts.body));
    return { ok: true, text: async () => '' };
  };
  process.env.RESEND_API_KEY = 'test-key';
  const res = fakeRes();
  try {
    await handler({ method: 'POST', body: payload }, res);
  } finally {
    globalThis.fetch = fetchReal;
    if (keyReal === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = keyReal;
  }
  return { res, correo: capturado[0] };
}

const estado = {
  respuestas: {
    sector: 'frio', perfil: 'diurno', generacion: 'no', calidad: 'no',
    tarifa: 'gdmth', factura: 'alto', corte: 'producto', disparador: ['diesel']
  },
  contacto: { nombre: 'Ana', empresa: 'Acme', correo: 'ana@acme.mx', telefono: '5555', rol: 'Finanzas' }
};

test('api/lead: el correo incluye la aplicación principal que calcula el motor', async () => {
  const res = assembleResult(estado, content);
  assert.equal(res.aplicacion_principal.id, 'diesel'); // precedencia comercial
  const { res: http, correo } = await enviar(res.leadPayload);
  assert.equal(http.statusCode, 200);
  assert.ok(correo.text.includes(`Aplicación principal: ${res.aplicacion_principal.nombre}`),
    'falta la aplicación principal en el texto del correo');
  assert.ok(correo.html.includes(res.aplicacion_principal.nombre),
    'falta la aplicación principal en el HTML del correo');
});

test('api/lead: el tipo de recomendación viaja completo, sin truncarse', async () => {
  const solar = { ...estado, respuestas: { ...estado.respuestas, generacion: 'solar_sitio', disparador: ['excedente'] } };
  const res = assembleResult(solar, content);
  assert.equal(res.recomendacion_solucion.tipo, 'BESS sobre solar existente');
  const { correo } = await enviar(res.leadPayload);
  assert.ok(correo.text.includes('Recomendación: BESS sobre solar existente'));
});

test('api/lead: la aplicación preliminar llega marcada al correo', async () => {
  const ciego = {
    respuestas: { sector: 'manufactura', perfil: 'nolose', generacion: 'no', calidad: 'nolose',
      tarifa: 'nolose', factura: 'nolose', corte: 'nada', disparador: ['costo'] },
    contacto: estado.contacto
  };
  const res = assembleResult(ciego, content);
  assert.equal(res.aplicacion_principal.preliminar, true);
  const { correo } = await enviar(res.leadPayload);
  assert.ok(correo.text.includes(`Aplicación principal: ${res.aplicacion_principal.nombre} (preliminar)`));
  // el caso con datos completos no lleva el matiz
  const firme = await enviar(assembleResult(estado, content).leadPayload);
  assert.ok(!firme.correo.text.includes('(preliminar)'));
});

test('api/lead: payload sin aplicación principal sigue enviando el correo', async () => {
  const { aplicacion_principal, ...sinCampo } = assembleResult(estado, content).leadPayload;
  const { res: http, correo } = await enviar(sinCampo);
  assert.equal(http.statusCode, 200);
  assert.ok(!correo.text.includes('Aplicación principal:'));
  assert.ok(correo.text.includes('Potencial general:'));
});

test('api/lead: rechaza correo inválido y no envía nada', async () => {
  const { res: http, correo } = await enviar({ nombre: 'Ana', correo: 'no-es-correo' });
  assert.equal(http.statusCode, 400);
  assert.equal(correo, undefined);
});
