import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';

test('hay 8 pasos con las keys esperadas', () => {
  assert.deepEqual(content.pasos.map((p) => p.key), [
    'sector', 'perfil', 'generacion', 'calidad', 'tarifa', 'factura', 'corte', 'disparador'
  ]);
});

test('los códigos de opción son únicos dentro de cada paso', () => {
  for (const p of content.pasos) {
    const codigos = p.opciones.map((o) => o.codigo);
    assert.equal(new Set(codigos).size, codigos.length, `duplicado en ${p.key}`);
  }
});

test('cada paso tiene notaLabel y opciones no vacías', () => {
  for (const p of content.pasos) {
    assert.ok(typeof p.notaLabel === 'string' && p.notaLabel, `falta notaLabel en ${p.key}`);
    assert.ok(p.opciones.length >= 2, `pocas opciones en ${p.key}`);
  }
});

test('el gate tiene los 5 campos, con rol como select', () => {
  assert.deepEqual(content.gate.campos.map((c) => c.key), ['nombre', 'empresa', 'correo', 'telefono', 'rol']);
  const rol = content.gate.campos.find((c) => c.key === 'rol');
  assert.equal(rol.type, 'select');
  assert.deepEqual(rol.opciones, ['Dirección general', 'Finanzas', 'Operaciones-Planta', 'Energía-Mantenimiento', 'Otro']);
});

test('las tablas del bloque B cubren todos los códigos', () => {
  assert.deepEqual(Object.keys(content.tablaFactura).sort(), ['alto', 'bajo', 'medio', 'muyalto', 'nolose']);
  assert.equal(content.tablaFactura.alto, 2500000);
  assert.equal(content.tablaFactura.nolose, null);
  assert.deepEqual(content.tablaDemanda.gdmth, [0.30, 0.40]);
  assert.equal(content.tablaDemanda.privado, null);
  assert.deepEqual(content.tablaRecorte.diurno, [0.25, 0.35]);
  assert.deepEqual(content.tablaRecorte.plano, [0.10, 0.18]);
});

test('perfilSector cubre los 5 sectores', () => {
  for (const s of ['continuo', 'manufactura', 'frio', 'publico', 'ev']) {
    assert.ok(content.perfilSector[s], `falta perfilSector.${s}`);
  }
});

// api/lead.js sanea con clean(tipo, 40) y clean(razon, 300): pasarse trunca el correo
// que lee ventas a media frase, sin error visible.
test('recomendaciones: tipo y razón caben en los límites que sanea /api/lead', () => {
  for (const [k, r] of Object.entries(content.recomendaciones)) {
    assert.ok(r.tipo && r.tipo.length <= 40, `tipo fuera del límite en ${k}: ${r.tipo.length}`);
    assert.ok(r.razon && r.razon.length <= 300, `razón fuera del límite en ${k}: ${r.razon.length}`);
  }
});

test('recomendaciones: ningún tipo se enuncia en negativo (contradice al ranking)', () => {
  for (const [k, r] of Object.entries(content.recomendaciones)) {
    assert.ok(!/^no\b/i.test(r.tipo), `tipo en negativo en ${k}: ${r.tipo}`);
  }
});

test('aplicacionPrincipal: cada regla apunta a una oportunidad declarada', () => {
  const ids = new Set(content.scoring.oportunidades.map((o) => o.id));
  for (const r of content.scoring.aplicacionPrincipal) {
    assert.ok(ids.has(r.id), `regla con id desconocido: ${r.id}`);
  }
});

test('boosts y caps apuntan a oportunidades declaradas', () => {
  const ids = new Set(content.scoring.oportunidades.map((o) => o.id));
  for (const b of content.scoring.boosts) assert.ok(ids.has(b.id), `boost con id desconocido: ${b.id}`);
  for (const c of content.scoring.caps) assert.ok(ids.has(c.id), `cap con id desconocido: ${c.id}`);
});

test('el copy no tiene voseo — es-MX en todas las cadenas', () => {
  const VOSEO = /\b(?:pagás|generás|comprás|tenés|exportás|vendés|necesitás|protegé|querés|podés|sabés|hacés|ponés|elegí|mirá|fijate|contá|revisá|agendá|escribí|dejá|sumá|bajá|corrés|reconocés|buscá|dejanos)\b/i;
  const cadenas = [];
  const recorrer = (v) => {
    if (typeof v === 'string') cadenas.push(v);
    else if (Array.isArray(v)) v.forEach(recorrer);
    else if (v && typeof v === 'object') Object.values(v).forEach(recorrer);
  };
  recorrer(content);
  // el template del bloque B es una función: renderizarlo con valores dummy para escanearlo
  cadenas.push(content.bloqueB.plantilla({
    facturaLegible: '$1', tarifaLegible: 'x', pctDemandaPiso: 1, pctDemandaTecho: 1,
    montoDemandaPiso: '$1', montoDemandaTecho: '$1', pctRecortePiso: 1, pctRecorteTecho: 1
  }));
  const infractoras = cadenas.filter((s) => VOSEO.test(s));
  assert.deepEqual(infractoras, [], `voseo detectado:\n${infractoras.join('\n')}`);
});
