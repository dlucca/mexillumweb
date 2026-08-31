import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';
import { assembleResult } from '../js/diagnostico.engine.js';

const respuestas = {
  sector: 'frio', perfil: 'diurno', generacion: 'no', calidad: 'no',
  tarifa: 'gdmth', factura: 'alto', corte: 'producto', disparador: ['diesel']
};

test('assembleResult reusa estado.lead_id si viene', () => {
  const estado = { respuestas, lead_id: 'fijo-123' };
  const { leadPayload } = assembleResult(estado, content);
  assert.equal(leadPayload.lead_id, 'fijo-123');
});

test('assembleResult adjunta ubicacion, techo, facturas y tipo_cierre', () => {
  const estado = {
    respuestas,
    contacto: { nombre: 'Ana', correo: 'ana@acme.mx', tipo_cierre: 'preliminar' },
    ubicacion: { direccion: 'Calle 1', lat: 19.4, lng: -99.1 },
    techo: { area_m2: 250, poligono: [{ lat: 19.4, lng: -99.1 }] },
    facturas: { paths: ['abc/1-a.pdf'], count: 1 }
  };
  const { leadPayload } = assembleResult(estado, content);
  assert.equal(leadPayload.tipo_cierre, 'preliminar');
  assert.deepEqual(leadPayload.ubicacion, estado.ubicacion);
  assert.equal(leadPayload.techo.area_m2, 250);
  assert.equal(leadPayload.facturas.count, 1);
});

test('assembleResult sin extras deja los campos en null', () => {
  const { leadPayload } = assembleResult({ respuestas }, content);
  assert.equal(leadPayload.ubicacion, null);
  assert.equal(leadPayload.techo, null);
  assert.equal(leadPayload.facturas, null);
  assert.equal(leadPayload.tipo_cierre, '');
});

// Link rápido (?rapido): la persona salta el cuestionario. El motor debe armar
// un lead válido solo con techo + facturas + contacto, sin respuestas.
test('assembleResult sin respuestas (link rápido) arma un lead válido', () => {
  const estado = {
    respuestas: {},
    contacto: { empresa: 'Acme', correo: 'a@acme.mx', tipo_cierre: 'preliminar' },
    techo: { area_m2: 200, poligono: [{ lat: 19.4, lng: -99.1 }] },
    facturas: { paths: ['acme/1-a.pdf'], count: 1 }
  };
  const { leadPayload } = assembleResult(estado, content);
  assert.equal(leadPayload.empresa, 'Acme');
  assert.equal(leadPayload.techo.area_m2, 200);
  assert.equal(leadPayload.facturas.count, 1);
  assert.ok(typeof leadPayload.rango_texto === 'string' && leadPayload.rango_texto);
});
