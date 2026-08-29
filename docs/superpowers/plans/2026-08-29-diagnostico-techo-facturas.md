# Pasos post-diagnóstico (techo, facturas, contacto) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la pantalla final de `/diagnostico` en 4 pasos (diagnóstico → dibuja techo → sube 12 facturas → contacto con dos caminos: propuesta preliminar por correo o agendar llamada), capturando ubicación, área de techo y facturas en el lead.

**Architecture:** El sitio es estático + funciones serverless de Vercel, sin deps npm (fetch nativo). No se integra la app Next del estimador; solo se porta a JS plano su lógica de Google Maps. Los archivos suben directo del navegador a Supabase Storage vía signed URLs firmadas por una función nueva. Toda la lógica de pantallas vive en `js/diagnostico.app.js`.

**Tech Stack:** HTML/CSS/JS ES modules (vanilla), Google Maps JS API (places+geometry), Supabase Storage REST, Resend REST, funciones serverless de Vercel, pruebas con `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-29-diagnostico-techo-facturas-design.md`

## Global Constraints

- **Sin dependencias npm** en `mexillumweb`: usar `fetch` nativo (Node 18+ en funciones, navegador en cliente). No agregar `@supabase/supabase-js` ni otras.
- **Solo `/diagnostico` (industrial).** No tocar `js/diagnostico.hoteles.*`, `diagnostico-hoteles/`, ni el flujo de hoteles.
- **ES modules** (`import`/`export`), igual que los `js/diagnostico.*.js` actuales.
- **Escape de HTML:** todo texto de usuario que entre a HTML pasa por la función `esc` (patrón ya usado en `app.js` y `api/lead.js`).
- **Llave de Google Maps** vive en `js/diagnostico.config.js` (commit); es de navegador, restringida por referrer. Placeholder vacío hasta que el usuario la pegue.
- **Bucket Supabase:** `facturas`, privado. Carpeta por `lead_id`.
- **Límites de facturas:** máx 12 archivos, máx 10 MB c/u, tipos `image/*` y `application/pdf`.
- **No romper el envío actual del lead:** `submitLead` se de-duplica con `leadEnviado`; el correo interno actual debe seguir funcionando sin techo/facturas/ubicación.
- **Pruebas** en `test/*.test.js`, estilo `node:test` + `node:assert/strict`, fetch stubeado (ver `test/api.lead.test.js`).
- Correr toda la suite con: `npm test` (equivale a `node --test test/*.test.js`).

---

## File Structure

- `js/diagnostico.config.js` — **crear**. Exporta `GOOGLE_MAPS_KEY` y `SUPABASE_UPLOAD` (endpoint). Config de cliente.
- `js/google-maps.js` — **crear**. `loadGoogleMaps()` memoizado.
- `js/diagnostico.roof.js` — **crear**. `mountRoofPicker(container, { onLocation, onRoof })`.
- `js/diagnostico.facturas.js` — **crear**. `mountFacturasUploader(container, { leadId, onChange })`.
- `api/upload-url.js` — **crear**. Función Vercel: firma URLs de subida a Supabase Storage.
- `js/diagnostico.engine.js` — **modificar**. `assembleResult` agrega `lead_id` reusable + `tipo_cierre`, `ubicacion`, `techo`, `facturas` al `leadPayload`.
- `js/diagnostico.app.js` — **modificar**. Nuevos pasos `'techo' | 'facturas' | 'cierre'`; `renderResult` sin calendario; `renderCierre` con dos caminos.
- `api/lead.js` — **modificar**. Correo interno extendido (ubicación/techo/facturas + links firmados) + correo breve al cliente en camino A.
- `css/diagnostico.css` — **modificar**. Estilos de mapa, subidor y pasos.
- `vercel.json` — **modificar**. `Permissions-Policy: geolocation=(self)`.
- Tests nuevos: `test/api.upload-url.test.js`, `test/api.lead.extras.test.js`, `test/diagnostico.engine.extras.test.js`.

---

## Task 1: Payload del motor — lead_id reusable + campos nuevos

**Files:**
- Modify: `js/diagnostico.engine.js:574-623`
- Test: `test/diagnostico.engine.extras.test.js` (crear)

**Interfaces:**
- Consumes: `assembleResult(estado, content)` existente.
- Produces: `leadPayload` con campos adicionales `tipo_cierre: string`, `ubicacion: {direccion,lat,lng}|null`, `techo: {area_m2,poligono}|null`, `facturas: {paths:string[],count:number}|null`, y `lead_id` que respeta `estado.lead_id` si ya existe.

- [ ] **Step 1: Escribir el test que falla**

Crear `test/diagnostico.engine.extras.test.js`:

```javascript
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
```

- [ ] **Step 2: Correr el test para ver que falla**

Run: `node --test test/diagnostico.engine.extras.test.js`
Expected: FAIL (los campos nuevos son `undefined`, no `null`; `lead_id` no respeta `estado.lead_id`).

- [ ] **Step 3: Implementar el cambio mínimo**

En `js/diagnostico.engine.js`, dentro de `assembleResult`, cambiar la construcción de `leadPayload` (líneas ~602-623). Sustituir la línea del `lead_id` y agregar los 4 campos:

```javascript
  const leadPayload = {
    lead_id: estado.lead_id || (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
    timestamp: new Date().toISOString(),
    nombre: contacto.nombre || '',
    empresa: contacto.empresa || '',
    correo: contacto.correo || '',
    telefono: contacto.telefono || '',
    rol: contacto.rol || '',
    presupuesto: contacto.presupuesto || '',
    tipo_cierre: contacto.tipo_cierre || '',
    ubicacion: estado.ubicacion || null,
    techo: estado.techo || null,
    facturas: estado.facturas || null,
    respuestas_legibles: legibles,
    respuestas_codigos: { ...resp },
    perfil,
    rango_texto,
    checklist_full: checklist.full,
    anteproyecto_interno: anteproyecto.interno,
    scores,
    ranking,
    potencial_general,
    recomendacion_solucion,
    aplicacion_principal,
    limitaciones
  };
```

- [ ] **Step 4: Correr el test para ver que pasa**

Run: `node --test test/diagnostico.engine.extras.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Correr la suite completa (no regresión)**

Run: `npm test`
Expected: PASS todo.

- [ ] **Step 6: Commit**

```bash
git add js/diagnostico.engine.js test/diagnostico.engine.extras.test.js
git commit -m "feat(engine): lead_id reusable + ubicacion/techo/facturas en leadPayload"
```

---

## Task 2: Función upload-url — firma URLs de subida a Supabase

**Files:**
- Create: `api/upload-url.js`
- Test: `test/api.upload-url.test.js` (crear)

**Interfaces:**
- Consumes: env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Produces: función `handler(req, res)` (default export). POST con body `{ lead_id, filename, contentType }` → 200 `{ url, path, token }`; rechaza método, tipo inválido, o config faltante.

- [ ] **Step 1: Escribir el test que falla**

Crear `test/api.upload-url.test.js`:

```javascript
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
```

- [ ] **Step 2: Correr el test para ver que falla**

Run: `node --test test/api.upload-url.test.js`
Expected: FAIL ("Cannot find module '../api/upload-url.js'").

- [ ] **Step 3: Implementar la función**

Crear `api/upload-url.js`:

```javascript
// Vercel serverless — firma una URL de subida a Supabase Storage para que el
// navegador suba una factura directo (evita el límite de body de Vercel).
// Requiere env SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Sin deps npm.

const BUCKET = 'facturas';
const ALLOWED = new Set(['application/pdf']);
const isImage = (t) => typeof t === 'string' && t.startsWith('image/');
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// Solo caracteres seguros para un nombre de objeto; el resto se colapsa a '-'.
function safeName(name) {
  const base = clean(name, 120).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return base || 'archivo';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const leadId = clean(body.lead_id, 64).replace(/[^a-zA-Z0-9-]/g, '');
  const filename = safeName(body.filename);
  const contentType = clean(body.contentType, 100);

  if (!leadId) return res.status(400).json({ error: 'lead_id requerido' });
  if (!(ALLOWED.has(contentType) || isImage(contentType))) {
    return res.status(400).json({ error: 'Tipo de archivo no permitido' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Supabase env vars ausentes');
    return res.status(500).json({ error: 'Config del servidor incompleta.' });
  }

  const path = `${leadId}/${Date.now()}-${filename}`;
  const signUrl = `${url}/storage/v1/object/upload/sign/${BUCKET}/${path}`;
  try {
    const r = await fetch(signUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('Supabase sign error', r.status, detail);
      return res.status(502).json({ error: 'No se pudo preparar la subida.' });
    }
    const data = await r.json();
    // Supabase devuelve una url relativa tipo /storage/v1/... ; la volvemos absoluta.
    const absolute = data.url && data.url.startsWith('http') ? data.url : `${url}${data.url}`;
    return res.status(200).json({ url: absolute, path, token: data.token });
  } catch (err) {
    console.error('upload-url handler error', err);
    return res.status(502).json({ error: 'No se pudo preparar la subida.' });
  }
}
```

- [ ] **Step 4: Correr el test para ver que pasa**

Run: `node --test test/api.upload-url.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/upload-url.js test/api.upload-url.test.js
git commit -m "feat(api): upload-url firma subidas a Supabase Storage"
```

---

## Task 3: Correo interno extendido + correo al cliente (camino A)

**Files:**
- Modify: `api/lead.js`
- Test: `test/api.lead.extras.test.js` (crear)

**Interfaces:**
- Consumes: `leadPayload` con `ubicacion`, `techo`, `facturas`, `tipo_cierre` (Task 1); env `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` para links firmados; env Resend.
- Produces: el correo interno incluye ubicación/techo/facturas cuando existen; si `tipo_cierre === 'preliminar'`, se envía además un correo breve al cliente (`reply_to`/`to` = correo del lead).

- [ ] **Step 1: Escribir el test que falla**

Crear `test/api.lead.extras.test.js`:

```javascript
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
```

- [ ] **Step 2: Correr el test para ver que falla**

Run: `node --test test/api.lead.extras.test.js`
Expected: FAIL (el correo interno no menciona ubicación/techo/facturas; no hay correo al cliente).

- [ ] **Step 3: Implementar en `api/lead.js`**

3a. Después de leer los campos existentes (tras `const leadId = clean(body.lead_id, 64);`, ~línea 64), leer y normalizar los nuevos:

```javascript
  const tipoCierre = clean(body.tipo_cierre, 20);
  const ubic = (body.ubicacion && typeof body.ubicacion === 'object' && !Array.isArray(body.ubicacion))
    ? {
        direccion: clean(body.ubicacion.direccion, 200),
        lat: Number(body.ubicacion.lat),
        lng: Number(body.ubicacion.lng)
      }
    : null;
  const techoArea = (body.techo && Number.isFinite(Number(body.techo.area_m2)))
    ? Math.round(Number(body.techo.area_m2))
    : null;
  const facturaPaths = (body.facturas && Array.isArray(body.facturas.paths))
    ? body.facturas.paths.slice(0, 12).map((p) => clean(p, 300)).filter(Boolean)
    : [];
```

3b. Antes de armar el `text`/`html` del correo interno, generar links firmados de Supabase para las facturas (helper con fetch, sin dep):

```javascript
  // Links firmados temporales (30 días) para que ventas abra las facturas privadas.
  async function firmarFacturas(paths) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || !paths.length) return [];
    const out = [];
    for (const p of paths) {
      try {
        const r = await fetch(`${url}/storage/v1/object/sign/facturas/${p}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 30 })
        });
        if (!r.ok) { out.push(`${p} (link no disponible)`); continue; }
        const data = await r.json();
        const rel = data.signedURL || data.signedUrl || '';
        out.push(rel ? `${url}${rel}` : `${p} (link no disponible)`);
      } catch { out.push(`${p} (link no disponible)`); }
    }
    return out;
  }
  const facturaLinks = await firmarFacturas(facturaPaths);
```

3c. Insertar en el arreglo `text` (después del bloque de contacto, antes de `'Respuestas:'`) las líneas condicionales:

```javascript
    ubic ? `Ubicación: ${ubic.direccion || '—'} (${ubic.lat}, ${ubic.lng})` : null,
    techoArea != null ? `Techo dibujado: ~${techoArea} m²` : null,
    facturaLinks.length ? `${facturaLinks.length} facturas subidas:` : null,
    ...facturaLinks.map((l) => `  - ${l}`),
```

3d. En el `html`, después de la tabla de contacto, agregar un bloque condicional:

```javascript
    (ubic || techoArea != null || facturaLinks.length
      ? `<table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">` +
        (ubic ? fila('Ubicación', `${ubic.direccion || '—'} (${ubic.lat}, ${ubic.lng})`) : '') +
        (techoArea != null ? fila('Techo dibujado', `~${techoArea} m²`) : '') +
        (facturaLinks.length
          ? `<tr><td style="padding:6px 16px 6px 0;color:#6F796E;vertical-align:top">Facturas</td>` +
            `<td style="padding:6px 0">` +
            facturaLinks.map((l, i) => `<a href="${esc(l)}">Factura ${i + 1}</a>`).join('<br>') +
            `</td></tr>`
          : '') +
        `</table>`
      : '') +
```

3e. Tras enviar con éxito el correo interno (justo antes de `return res.status(200).json({ ok: true });`), enviar el correo breve al cliente si aplica:

```javascript
    if (tipoCierre === 'preliminar' && EMAIL_RE.test(correo)) {
      const textoCliente =
        `Hola ${nombre || ''},\n\n` +
        `Recibimos tus datos. Pronto te contactaremos con tu propuesta preliminar.\n\n` +
        `— Equipo Mexillum`;
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from, to: correo, subject: 'Recibimos tus datos — Mexillum', text: textoCliente
          })
        });
      } catch (err) { console.error('correo cliente falló', err); }
    }
```

- [ ] **Step 4: Correr el test para ver que pasa**

Run: `node --test test/api.lead.extras.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Correr la suite completa (no regresión)**

Run: `npm test`
Expected: PASS (incluye `test/api.lead.test.js` sin cambios).

- [ ] **Step 6: Commit**

```bash
git add api/lead.js test/api.lead.extras.test.js
git commit -m "feat(api): correo interno con ubicacion/techo/facturas + correo al cliente (preliminar)"
```

---

## Task 4: Config de cliente + loader de Google Maps

**Files:**
- Create: `js/diagnostico.config.js`
- Create: `js/google-maps.js`

**Interfaces:**
- Produces: `GOOGLE_MAPS_KEY: string` (config), `loadGoogleMaps(): Promise<typeof google>`.

- [ ] **Step 1: Crear la config**

Crear `js/diagnostico.config.js`:

```javascript
// Configuración de cliente del diagnóstico.
// GOOGLE_MAPS_KEY es una llave de NAVEGADOR: es pública por diseño y se protege
// restringiéndola por referrer (HTTP referrer) a mexillum.com en Google Cloud.
// Pega aquí la llave restringida antes de desplegar.
export const GOOGLE_MAPS_KEY = '';

// Endpoint que firma las subidas de facturas a Supabase Storage.
export const UPLOAD_URL_ENDPOINT = '/api/upload-url';
```

- [ ] **Step 2: Crear el loader**

Crear `js/google-maps.js` (puerto de `src/lib/google/maps.ts` del estimador):

```javascript
import { GOOGLE_MAPS_KEY } from './diagnostico.config.js';

let promise = null;

// Carga el SDK de Google Maps una sola vez (places + geometry, español/MX).
export function loadGoogleMaps() {
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve(window.google);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}`
      + '&libraries=places,geometry&language=es-419&region=MX';
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error('Google Maps no cargó'));
    document.head.appendChild(s);
  });
  return promise;
}
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check js/diagnostico.config.js && node --check js/google-maps.js`
Expected: sin salida (OK).

- [ ] **Step 4: Commit**

```bash
git add js/diagnostico.config.js js/google-maps.js
git commit -m "feat(diagnostico): config de cliente + loader de Google Maps"
```

---

## Task 5: Selector de techo (mountRoofPicker)

**Files:**
- Create: `js/diagnostico.roof.js`

**Interfaces:**
- Consumes: `loadGoogleMaps()` (Task 4).
- Produces: `mountRoofPicker(container, { onLocation, onRoof }): void`. `onLocation({ direccion, lat, lng })` al elegir dirección/ubicación; `onRoof({ area_m2, poligono })` al dibujar ≥3 puntos. `poligono` = `Array<{lat,lng}>`.

- [ ] **Step 1: Crear el módulo**

Crear `js/diagnostico.roof.js` (puerto en JS plano de `MapPicker.tsx`; sin React):

```javascript
import { loadGoogleMaps } from './google-maps.js';

const MEXICO_CENTER = { lat: 23.6345, lng: -102.5528 };
const ROOF_COLOR = '#1a73e8';

// Monta el mapa y el flujo de dibujo dentro de `container`.
// Llama onLocation al fijar dirección/ubicación y onRoof al cambiar el polígono.
export function mountRoofPicker(container, { onLocation, onRoof }) {
  container.innerHTML = `
    <div class="dx-roof">
      <div class="dx-roof__bar">
        <input class="dx-roof__input" type="text" placeholder="Escribe tu dirección" aria-label="Dirección">
        <button type="button" class="mx-btn mx-btn--ghost dx-roof__loc">Usar mi ubicación</button>
      </div>
      <div class="dx-roof__map" role="application" aria-label="Mapa para dibujar el techo"></div>
      <p class="dx-roof__status dx__col-sub">Cargando mapa…</p>
    </div>`;

  const inputEl = container.querySelector('.dx-roof__input');
  const mapEl = container.querySelector('.dx-roof__map');
  const statusEl = container.querySelector('.dx-roof__status');
  const locBtn = container.querySelector('.dx-roof__loc');

  let g = null, map = null, marker = null, poly = null;
  const listeners = [];

  function setStatus(msg) { statusEl.textContent = msg; }

  function clearDraw() {
    listeners.forEach((l) => l.remove());
    listeners.length = 0;
    if (poly) { poly.setMap(null); poly = null; }
  }

  function startDraw() {
    clearDraw();
    poly = new g.maps.Polygon({
      map, editable: true, fillColor: ROOF_COLOR, fillOpacity: 0.25,
      strokeColor: ROOF_COLOR, strokeWeight: 2
    });
    const recompute = () => {
      const path = poly.getPath();
      if (path.getLength() < 3) return;
      const area = g.maps.geometry.spherical.computeArea(path);
      const poligono = path.getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }));
      setStatus(`Área marcada: ~${Math.round(area).toLocaleString('es-MX')} m². Arrastra los puntos para ajustar.`);
      onRoof({ area_m2: area, poligono });
    };
    listeners.push(map.addListener('click', (e) => { if (e.latLng) poly.getPath().push(e.latLng); }));
    const path = poly.getPath();
    listeners.push(path.addListener('insert_at', recompute));
    listeners.push(path.addListener('set_at', recompute));
    listeners.push(path.addListener('remove_at', recompute));
    setStatus('Toca cada esquina de tu techo en el mapa (mínimo 3).');
  }

  function goTo(lat, lng, direccion) {
    map.setCenter({ lat, lng });
    map.setZoom(20);
    if (marker) marker.setMap(null);
    marker = new g.maps.Marker({ position: { lat, lng }, map });
    onLocation({ direccion, lat, lng });
    startDraw();
  }

  loadGoogleMaps().then((google) => {
    g = google;
    map = new g.maps.Map(mapEl, {
      center: MEXICO_CENTER, zoom: 5, mapTypeId: 'satellite', tilt: 0,
      streetViewControl: false, fullscreenControl: false, mapTypeControl: false
    });
    const ac = new g.maps.places.Autocomplete(inputEl, {
      componentRestrictions: { country: 'mx' }, fields: ['formatted_address', 'geometry']
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const loc = place.geometry && place.geometry.location;
      if (!loc) return;
      goTo(loc.lat(), loc.lng(), place.formatted_address || undefined);
    });
    setStatus('Busca tu dirección o usa tu ubicación. Luego dibujas tu techo.');
  }).catch(() => setStatus('No pudimos cargar el mapa. Revisa tu conexión e intenta de nuevo.'));

  locBtn.addEventListener('click', () => {
    if (!navigator.geolocation) return;
    setStatus('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (pos) => goTo(pos.coords.latitude, pos.coords.longitude),
      () => setStatus('No pudimos obtener tu ubicación. Escribe tu dirección.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check js/diagnostico.roof.js`
Expected: sin salida (OK).

- [ ] **Step 3: Commit**

```bash
git add js/diagnostico.roof.js
git commit -m "feat(diagnostico): selector de techo (puerto vanilla de MapPicker)"
```

---

## Task 6: Subidor de facturas (mountFacturasUploader)

**Files:**
- Create: `js/diagnostico.facturas.js`

**Interfaces:**
- Consumes: `UPLOAD_URL_ENDPOINT` (Task 4), API `/api/upload-url` (Task 2).
- Produces: `mountFacturasUploader(container, { leadId, onChange }): void`. `onChange({ paths, count })` cada vez que cambia la lista de subidas exitosas.

- [ ] **Step 1: Crear el módulo**

Crear `js/diagnostico.facturas.js`:

```javascript
import { UPLOAD_URL_ENDPOINT } from './diagnostico.config.js';

const MAX_FILES = 12;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const okType = (t) => t === 'application/pdf' || (typeof t === 'string' && t.startsWith('image/'));

export function mountFacturasUploader(container, { leadId, onChange }) {
  container.innerHTML = `
    <div class="dx-fac">
      <label class="dx-fac__drop">
        <input class="dx-fac__input" type="file" multiple accept="image/*,application/pdf" hidden>
        <span>Arrastra tus facturas aquí o <strong>toca para elegir</strong> (foto o PDF, hasta ${MAX_FILES}).</span>
      </label>
      <ul class="dx-fac__list"></ul>
    </div>`;

  const input = container.querySelector('.dx-fac__input');
  const drop = container.querySelector('.dx-fac__drop');
  const list = container.querySelector('.dx-fac__list');
  const done = []; // { path }

  function emit() { onChange({ paths: done.map((d) => d.path), count: done.length }); }

  function row(name, estado) {
    const li = document.createElement('li');
    li.className = 'dx-fac__row';
    li.innerHTML = `<span class="dx-fac__name"></span> <span class="dx-fac__state"></span>`;
    li.querySelector('.dx-fac__name').textContent = name;
    li.querySelector('.dx-fac__state').textContent = estado;
    list.appendChild(li);
    return li;
  }

  async function subirUno(file) {
    if (done.length >= MAX_FILES) return;
    if (!okType(file.type)) { row(file.name, 'tipo no permitido'); return; }
    if (file.size > MAX_BYTES) { row(file.name, 'muy pesada (máx 10 MB)'); return; }
    const li = row(file.name, 'subiendo…');
    const estadoEl = li.querySelector('.dx-fac__state');
    try {
      const r = await fetch(UPLOAD_URL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, filename: file.name, contentType: file.type })
      });
      if (!r.ok) throw new Error('sign falló');
      const { url, path } = await r.json();
      const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error('upload falló');
      done.push({ path });
      estadoEl.textContent = 'listo ✓';
      emit();
    } catch {
      estadoEl.textContent = 'error, intenta de nuevo';
    }
  }

  function manejar(files) {
    [...files].slice(0, MAX_FILES).forEach(subirUno);
  }

  input.addEventListener('change', () => manejar(input.files));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dx-fac__drop--over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dx-fac__drop--over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dx-fac__drop--over');
    if (e.dataTransfer && e.dataTransfer.files) manejar(e.dataTransfer.files);
  });
}
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check js/diagnostico.facturas.js`
Expected: sin salida (OK).

- [ ] **Step 3: Commit**

```bash
git add js/diagnostico.facturas.js
git commit -m "feat(diagnostico): subidor de facturas a Supabase (directo del navegador)"
```

---

## Task 7: Máquina de pantallas — pasos techo, facturas, cierre

**Files:**
- Modify: `js/diagnostico.app.js`
- Modify: `css/diagnostico.css`

**Interfaces:**
- Consumes: `mountRoofPicker` (Task 5), `mountFacturasUploader` (Task 6), `assembleResult` extendido (Task 1), `mountCal`/`submitLead` existentes.
- Produces: flujo `result → techo → facturas → cierre`; `renderResult` sin calendario; `renderCierre` con dos caminos.

- [ ] **Step 1: Imports y lead_id**

En `js/diagnostico.app.js`, arriba, agregar imports:

```javascript
import { mountRoofPicker } from './diagnostico.roof.js';
import { mountFacturasUploader } from './diagnostico.facturas.js';
```

En el objeto `estado` (donde hoy está `paso`, `respuestas`, `contacto`, `resultado`), agregar:

```javascript
    lead_id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
    ubicacion: null,
    techo: null,
    facturas: null,
```

- [ ] **Step 2: `renderResult` sin calendario, con "Continuar"**

En `renderResult`, quitar la sección `<section class="dx__book">…</section>` (el bloque del calendario `#agenda`) y la llamada `mountCal('#agenda', res)` al final. Reemplazar el bloque `dx__actions` para que además avance:

```javascript
          <div class="dx__actions">
            <button type="button" class="mx-btn mx-btn--primary" data-act="continuar">Continuar</button>
            <button type="button" class="mx-btn mx-btn--ghost" data-act="reiniciar">${esc(content.resultado.reiniciar)}</button>
          </div>
```

Y en los listeners de `renderResult`, después del de `reiniciar`, agregar:

```javascript
    view.querySelector('[data-act="continuar"]').addEventListener('click', () => {
      estado.paso = 'techo';
      render();
    });
```

Quitar la línea final `mountCal('#agenda', res);` de `renderResult` (el calendario se monta ahora en `renderCierre`).

- [ ] **Step 3: `renderTecho` y `renderFacturas`**

Agregar dos funciones nuevas (por ejemplo, antes de `renderResult`):

```javascript
  // ---- Paso: dibujar techo (opcional) -----------------------------------------
  function renderTecho() {
    const view = el(`
      <div class="dx__view">
        <h2 class="dx__question" data-dx-focus tabindex="-1">Dibuja tu techo</h2>
        <p class="dx__col-sub">Marca las esquinas de tu techo en el mapa. Con esto tu anteproyecto sale más rápido y preciso.</p>
        <div class="dx-roof-mount"></div>
        <div class="dx__nav dx__nav--end">
          <button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>
          <span class="dx__skiprow">
            <button type="button" class="dx__skip" data-act="saltar">Saltar por ahora</button>
            <button type="button" class="mx-btn mx-btn--primary" data-act="siguiente">Continuar</button>
          </span>
        </div>
      </div>`);

    mountRoofPicker(view.querySelector('.dx-roof-mount'), {
      onLocation: (u) => { estado.ubicacion = u; },
      onRoof: (r) => { estado.techo = r; }
    });
    view.querySelector('[data-act="atras"]').addEventListener('click', () => { estado.paso = 'result'; render(); });
    view.querySelector('[data-act="saltar"]').addEventListener('click', () => { estado.paso = 'facturas'; render(); });
    view.querySelector('[data-act="siguiente"]').addEventListener('click', () => { estado.paso = 'facturas'; render(); });

    root.replaceChildren(view);
    focusMain();
  }

  // ---- Paso: subir facturas (opcional) ----------------------------------------
  function renderFacturas() {
    const view = el(`
      <div class="dx__view">
        <h2 class="dx__question" data-dx-focus tabindex="-1">Sube tus últimas 12 facturas</h2>
        <p class="dx__col-sub">Con tus facturas de CFE calculamos tu ahorro real. Es opcional, pero mejora mucho tu anteproyecto.</p>
        <div class="dx-fac-mount"></div>
        <div class="dx__nav dx__nav--end">
          <button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>
          <span class="dx__skiprow">
            <button type="button" class="dx__skip" data-act="saltar">Saltar por ahora</button>
            <button type="button" class="mx-btn mx-btn--primary" data-act="siguiente">Continuar</button>
          </span>
        </div>
      </div>`);

    mountFacturasUploader(view.querySelector('.dx-fac-mount'), {
      leadId: estado.lead_id,
      onChange: (f) => { estado.facturas = f; }
    });
    view.querySelector('[data-act="atras"]').addEventListener('click', () => { estado.paso = 'techo'; render(); });
    view.querySelector('[data-act="saltar"]').addEventListener('click', () => { estado.paso = 'cierre'; render(); });
    view.querySelector('[data-act="siguiente"]').addEventListener('click', () => { estado.paso = 'cierre'; render(); });

    root.replaceChildren(view);
    focusMain();
  }
```

- [ ] **Step 4: `renderCierre` con dos caminos**

Agregar `renderCierre`. El camino A registra el lead; el camino B revela el calendario (reusa `mountCal` y `estado.resultado`).

```javascript
  // ---- Paso: contacto + siguiente paso (dos caminos) --------------------------
  function renderCierre() {
    const res = estado.resultado || assembleResult(estado, content);
    estado.resultado = res;

    const view = el(`
      <div class="dx__view">
        <h2 class="dx__question" data-dx-focus tabindex="-1">Elige cómo quieres tu anteproyecto</h2>
        <div class="dx-cierre">
          <label class="dx-cierre__field">Nombre
            <input type="text" data-f="nombre" autocomplete="name">
          </label>
          <label class="dx-cierre__field">Correo
            <input type="email" data-f="correo" autocomplete="email" required>
          </label>
          <label class="dx-cierre__field">Teléfono (opcional)
            <input type="tel" data-f="telefono" autocomplete="tel">
          </label>
          <p class="dx-cierre__err" role="alert" hidden>Escribe un correo válido.</p>
        </div>

        <div class="dx-cierre__paths">
          <div class="dx-cierre__path">
            <h3>Propuesta preliminar por correo</h3>
            <p class="dx__col-sub">Déjanos tu correo y te contactamos con tu propuesta preliminar.</p>
            <button type="button" class="mx-btn mx-btn--primary" data-act="preliminar">Recibir propuesta preliminar</button>
            <p class="dx-cierre__ok" data-slot="okA" hidden>¡Listo! Pronto te contactaremos.</p>
          </div>
          <div class="dx-cierre__path">
            <h3>Agendar una llamada</h3>
            <p class="dx__col-sub">Para un aproximado con más detalle, agenda una llamada.</p>
            <button type="button" class="mx-btn mx-btn--ghost" data-act="agendar">Agendar llamada</button>
            <div class="dx__cal" id="agenda" hidden></div>
          </div>
        </div>
        <div class="dx__nav">
          <button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>
        </div>
      </div>`);

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const getField = (f) => view.querySelector(`[data-f="${f}"]`).value.trim();
    const errEl = view.querySelector('.dx-cierre__err');

    function capturarContacto() {
      const correo = getField('correo');
      if (!EMAIL_RE.test(correo)) { errEl.hidden = false; return false; }
      errEl.hidden = true;
      estado.contacto = {
        ...estado.contacto,
        nombre: getField('nombre'),
        correo,
        telefono: getField('telefono')
      };
      return true;
    }

    view.querySelector('[data-act="atras"]').addEventListener('click', () => { estado.paso = 'facturas'; render(); });

    view.querySelector('[data-act="preliminar"]').addEventListener('click', () => {
      if (!capturarContacto()) return;
      estado.contacto.tipo_cierre = 'preliminar';
      estado.resultado = assembleResult(estado, content);
      const payload = origen ? { ...estado.resultado.leadPayload, origen } : estado.resultado.leadPayload;
      submitLead(payload);
      view.querySelector('[data-slot="okA"]').hidden = false;
    });

    view.querySelector('[data-act="agendar"]').addEventListener('click', () => {
      if (!capturarContacto()) return;
      estado.contacto.tipo_cierre = 'llamada';
      estado.resultado = assembleResult(estado, content);
      const calEl = view.querySelector('#agenda');
      calEl.hidden = false;
      mountCal('#agenda', estado.resultado);
    });

    root.replaceChildren(view);
    focusMain();
  }
```

- [ ] **Step 5: Enrutar los pasos nuevos en `render`**

En la función `render`, agregar las ramas:

```javascript
  function render() {
    if (estado.paso === 'intro') return renderIntro();
    if (estado.paso === 'result') return renderResult();
    if (estado.paso === 'techo') return renderTecho();
    if (estado.paso === 'facturas') return renderFacturas();
    if (estado.paso === 'cierre') return renderCierre();
    return renderStep();
  }
```

En el listener de `reiniciar` (dentro de `renderResult`), resetear también los campos nuevos:

```javascript
      estado.paso = 'intro';
      estado.respuestas = {};
      estado.contacto = {};
      estado.resultado = null;
      estado.ubicacion = null;
      estado.techo = null;
      estado.facturas = null;
      estado.lead_id = (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
      leadEnviado = false;
      render();
```

- [ ] **Step 6: CSS de los pasos nuevos**

Agregar al final de `css/diagnostico.css`:

```css
/* ---- Pasos post-diagnóstico: techo, facturas, cierre ---- */
.dx-roof__bar{display:flex;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-3)}
.dx-roof__input{flex:1 1 220px;padding:var(--space-3);border:1px solid var(--border-hairline);border-radius:8px;font-size:var(--size-body)}
.dx-roof__map{width:100%;height:60vh;min-height:320px;border-radius:8px;background:var(--bg-subtle)}
.dx-roof__status{margin-top:var(--space-3)}

.dx-fac__drop{display:block;border:2px dashed var(--border-hairline);border-radius:10px;padding:var(--space-6);text-align:center;cursor:pointer}
.dx-fac__drop--over{border-color:var(--text-strong);background:var(--bg-subtle)}
.dx-fac__list{list-style:none;margin:var(--space-4) 0 0;padding:0}
.dx-fac__row{display:flex;justify-content:space-between;gap:var(--space-3);padding:var(--space-2) 0;font-size:var(--size-body-sm)}
.dx-fac__state{color:var(--text-body)}

.dx__skiprow{display:flex;gap:var(--space-4);align-items:center}
.dx__skip{background:none;border:none;color:var(--text-body);text-decoration:underline;cursor:pointer;font:inherit}

.dx-cierre{display:grid;gap:var(--space-3);max-width:420px;margin-bottom:var(--space-6)}
.dx-cierre__field{display:grid;gap:6px;font-size:var(--size-body-sm);color:var(--text-body)}
.dx-cierre__field input{padding:var(--space-3);border:1px solid var(--border-hairline);border-radius:8px;font-size:var(--size-body)}
.dx-cierre__err{color:#b00020;font-size:var(--size-body-sm)}
.dx-cierre__paths{display:grid;gap:var(--space-5);grid-template-columns:1fr}
.dx-cierre__path{border:1px solid var(--border-hairline);border-radius:10px;padding:var(--space-5)}
.dx-cierre__ok{color:var(--text-strong);font-weight:var(--weight-semibold);margin-top:var(--space-3)}
@media (min-width:720px){.dx-cierre__paths{grid-template-columns:1fr 1fr}}
```

- [ ] **Step 7: Verificar sintaxis del JS**

Run: `node --check js/diagnostico.app.js`
Expected: sin salida (OK).

- [ ] **Step 8: Correr la suite completa**

Run: `npm test`
Expected: PASS todo (los tests de app no cambian; los de engine/lead ya cubren el payload).

- [ ] **Step 9: Commit**

```bash
git add js/diagnostico.app.js css/diagnostico.css
git commit -m "feat(diagnostico): pasos techo, facturas y cierre con dos caminos"
```

---

## Task 8: Header de geolocalización

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Permitir geolocalización propia**

En `vercel.json`, cambiar el valor de `Permissions-Policy`:

De: `"geolocation=(), microphone=(), camera=()"`
A: `"geolocation=(self), microphone=(), camera=()"`

- [ ] **Step 2: Verificar JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "chore: permitir geolocalización propia para el mapa del diagnóstico"
```

---

## Task 9: Verificación manual en navegador

**Files:** ninguno (verificación).

- [ ] **Step 1:** Pegar una llave real restringida en `js/diagnostico.config.js` (local, no commitear la real si es de prod; usar una de dev).
- [ ] **Step 2:** Servir el sitio local (`npx serve` o el método habitual) y abrir `/diagnostico`.
- [ ] **Step 3:** Completar las 8 preguntas → ver el diagnóstico → "Continuar".
- [ ] **Step 4:** Buscar una dirección, dibujar un techo (≥3 puntos), ver el área → "Continuar".
- [ ] **Step 5:** Elegir 1-2 archivos de prueba (imagen/pdf), ver "listo ✓" → "Continuar". (Requiere `SUPABASE_URL`/`KEY` y bucket `facturas` para que la subida real funcione; si no, se ve el estado de error, que es esperado sin backend.)
- [ ] **Step 6:** En cierre: dejar correo, "Recibir propuesta preliminar" → ver "Pronto te contactaremos".
- [ ] **Step 7:** Recargar, repetir hasta cierre, "Agendar llamada" → ver el calendario pre-llenado.
- [ ] **Step 8:** Confirmar que saltar techo y facturas también llega a cierre y funciona.

---

## Self-Review (cobertura del spec)

- §3.1 Máquina de pantallas → Task 7. ✔
- §3.2 Selector de techo + loader + header geolocalización → Tasks 4, 5, 8. ✔
- §3.3 Subidor + upload-url → Tasks 6, 2. ✔
- §3.4 Cierre con dos caminos → Task 7 (renderCierre). ✔
- §3.5 Payload del lead → Task 1. ✔
- §3.6 Correos (interno extendido + cliente breve) → Task 3. ✔
- §4 Prerrequisitos → Task 9 (nota) + Global Constraints. ✔
- §6 Pruebas → Tasks 1, 2, 3 (unit) + Task 9 (manual). ✔
- Fuera de alcance (hoteles, estimación visible) → respetado. ✔
