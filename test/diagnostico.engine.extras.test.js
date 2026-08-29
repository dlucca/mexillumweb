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
