# Diseño — Pasos post-diagnóstico: techo, facturas y captura de contacto

Fecha: 2026-08-29
Alcance: **solo `/diagnostico` (industrial)**. `/diagnostico-hoteles` queda igual por ahora.

## 1. Objetivo

Hoy, al terminar la última pregunta, el diagnóstico muestra una sola pantalla
con el resultado **y** el calendario Cal.com juntos, y el lead se registra solo
cuando la persona agenda.

Queremos convertir esa pantalla final en una secuencia de pasos que capture más
información antes de agendar, sin perder al que no agenda:

1. **Diagnóstico gratis** — el resultado de siempre (perfil, rango, palancas,
   recomendación). Botón "Continuar" que invita al siguiente paso.
2. **Dibuja tu techo** — mapa satelital de Google; el usuario marca el polígono
   de su techo. Se captura **dirección + coordenadas + área (m²) + polígono**.
   Paso opcional (link "Saltar por ahora"), con copy que incentiva completarlo.
3. **Sube tus últimas 12 facturas** — el usuario carga fotos o PDFs. Suben
   directo a Supabase Storage (bucket privado). Paso opcional, incentivado.
4. **Contacto + siguiente paso** — dos caminos que el usuario elige:
   - **Propuesta preliminar por correo:** deja nombre + correo → se registra el
     lead y recibe por email su diagnóstico ya calculado.
   - **Agendar llamada:** abre el calendario Cal.com, **pre-llenado** con el
     nombre + correo capturados (no se le vuelve a pedir nombre/empresa en Cal).

Cualquiera de los dos caminos registra el lead **con techo + facturas +
ubicación adjuntos**. Así ningún lead con contacto se pierde.

## 2. Decisiones tomadas

- **Techo:** solo capturar (dibujar). No se muestra estimación de kWp/ahorro al
  usuario. No se usa el motor de dimensionamiento del estimador.
- **Facturas:** a Supabase Storage (bucket privado). El correo interno lleva
  links firmados temporales.
- **Opcionalidad:** techo y facturas son opcionales pero con copy que incentiva.
- **Contacto:** capturado una sola vez en el paso 4; sirve para ambos caminos.
- **No se toca `/diagnostico-hoteles`** en esta iteración.

## 3. Arquitectura

El sitio (`mexillumweb`) es estático + funciones serverless de Vercel, **sin
dependencias npm** (fetch nativo). El estimador solar es Next.js; **no** se
integra como app. Solo se **porta a JS plano** la lógica de Google Maps del
componente `MapPicker` del estimador. Todo vive dentro del diagnóstico actual.

### 3.1 Máquina de pantallas (`js/diagnostico.app.js`)

Estado actual: `paso: 'intro' | 0..7 | 'result'`.

Estado nuevo: `paso: 'intro' | 0..7 | 'result' | 'techo' | 'facturas' | 'cierre'`.

- Al responder la última pregunta → `estado.paso = 'result'` (igual que hoy),
  pero `renderResult` **ya no monta el calendario**; solo muestra el diagnóstico
  y un botón "Continuar" → `'techo'`.
- Al entrar al bloque post-diagnóstico se genera **una vez** `estado.lead_id`
  (`crypto.randomUUID()`), usado para nombrar la carpeta de Supabase y para
  correlacionar. `assembleResult` usará `estado.lead_id` si existe.
- `renderTecho` (`'techo'`) — monta el selector de techo. Botones: "Saltar por
  ahora" (→ `'facturas'`) y "Continuar" (→ `'facturas'`). Guarda en
  `estado.ubicacion` = `{ direccion, lat, lng }` y `estado.techo` =
  `{ area_m2, poligono }`.
- `renderFacturas` (`'facturas'`) — monta el subidor. Botones: "Saltar por
  ahora" (→ `'cierre'`) y "Continuar" (→ `'cierre'`). Guarda en
  `estado.facturas` = `{ paths: string[], count }`.
- `renderCierre` (`'cierre'`) — formulario nombre+correo (correo requerido) +
  los dos caminos. Ver §3.4.

Cada paso tiene "Atrás" que respeta el orden.

### 3.2 Selector de techo (`js/diagnostico.roof.js` + `js/google-maps.js`)

- `js/google-maps.js` exporta `loadGoogleMaps()` — carga el script de Google
  Maps una sola vez (memoizado con una promesa), con `libraries=places,geometry`.
  La llave se lee de una constante en `js/diagnostico.config.js`
  (`GOOGLE_MAPS_KEY`), pública por diseño (llave de navegador restringida por
  referrer en Google Cloud). Copiado del patrón `src/lib/google/maps.ts` del
  estimador.
- `js/diagnostico.roof.js` exporta `mountRoofPicker(container, { onLocation,
  onRoof })`. Puerto en JS plano de `MapPicker.tsx`:
  - Autocompletado de direcciones (Places), restringido a `country: 'mx'`.
  - Botón "Usar mi ubicación" (geolocalización del navegador).
  - Al elegir dirección/ubicación → `onLocation({ direccion, lat, lng })` y
    arranca el modo dibujo.
  - Dibujo manual: cada click agrega un vértice a un `Polygon` editable; el área
    se recalcula con `geometry.spherical.computeArea` cuando hay ≥3 puntos →
    `onRoof({ area_m2, poligono })`. Botón "Borrar puntos".
- **Requisito de cabecera:** `vercel.json` tiene `Permissions-Policy:
  geolocation=()`, que bloquea la geolocalización. Se cambia a
  `geolocation=(self)` para que funcione "Usar mi ubicación".

### 3.3 Subidor de facturas (`js/diagnostico.facturas.js` + `api/upload-url.js`)

Los archivos suben **directo del navegador a Supabase Storage** para evitar el
límite de tamaño del body de las funciones de Vercel (~4.5 MB).

- `api/upload-url.js` (función Vercel nueva): recibe `{ lead_id, filename,
  contentType }`, valida (tipo imagen/PDF, extensión, límite de nº de archivos
  por lead), y devuelve una **signed upload URL** de Supabase Storage vía REST
  (`POST ${SUPABASE_URL}/storage/v1/object/upload/sign/facturas/{lead_id}/{n}-{filename}`
  con `Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY`). Devuelve `{ url, path,
  token }`. Sin deps npm (fetch nativo).
- `js/diagnostico.facturas.js` exporta `mountFacturasUploader(container, {
  leadId, onChange })`:
  - `<input type="file" multiple accept="image/*,application/pdf">` + zona de
    arrastrar/soltar.
  - Por cada archivo: pide su signed URL a `/api/upload-url`, sube el archivo con
    `PUT`/`POST` a Supabase, muestra progreso/estado (subiendo / listo / error) y
    permite quitar un archivo.
  - Límites en cliente: máx 12 archivos, máx ~10 MB c/u, tipos permitidos.
  - Al cambiar la lista → `onChange({ paths, count })`.
- **Bucket:** `facturas`, privado. Carpeta por `lead_id`.

### 3.4 Paso de cierre (`js/diagnostico.app.js` → `renderCierre`)

- Encabezado: "Elige cómo quieres tu anteproyecto".
- Campos: **Nombre** y **Correo** (correo requerido y validado); Teléfono
  opcional. Al llenarse, se guardan en `estado.contacto`.
- Camino A — botón **"Recibir propuesta preliminar"**:
  - Valida nombre + correo.
  - `estado.resultado = assembleResult(estado, content)` (ya incluye techo,
    facturas, ubicación — ver §3.5).
  - `submitLead(payload con { ...leadPayload, origen, tipo_cierre: 'preliminar' })`.
  - Pantalla de confirmación: "Listo, te llega a tu correo".
- Camino B — botón **"Agendar llamada"**:
  - Revela el calendario Cal.com en un contenedor, **pre-llenado** con
    `estado.contacto.nombre` y `estado.contacto.correo` (config de Cal, igual que
    hoy). Se marca `tipo_cierre: 'llamada'` en el payload.
  - Al agendar, el listener `bookingSuccessful` existente registra el lead
    (dedup con `leadEnviado`). Si ya se envió por el camino A, no se duplica.
- Nota Cal: como el nombre/correo van pre-llenados, no se pide nombre/empresa
  aparte; Cal solo confirma horario. (Cal muestra sus campos pre-llenados; el
  prefill reduce la fricción — no se eliminan campos del lado de Cal.)

### 3.5 Payload del lead (`js/diagnostico.engine.js`)

`assembleResult` agrega al `leadPayload` (§602–623 actual):

```
lead_id: estado.lead_id || crypto.randomUUID(),
tipo_cierre: contacto.tipo_cierre || '',       // 'preliminar' | 'llamada'
ubicacion: estado.ubicacion || null,           // { direccion, lat, lng }
techo: estado.techo || null,                   // { area_m2, poligono }
facturas: estado.facturas || null,             // { paths, count }
```

### 3.6 Correos (`api/lead.js`)

- **Correo interno (a ventas):** se extiende para incluir, si vienen:
  - Ubicación (dirección + lat/lng).
  - Techo (área m²).
  - Facturas: nº de archivos + **links firmados temporales** (se generan en la
    función vía REST de Supabase Storage, `POST .../object/sign/facturas/{path}`
    con expiración ~30 días).
  - `tipo_cierre` (preliminar / llamada).
- **Correo al cliente (camino A, "propuesta preliminar"):** nuevo, breve.
  Confirmación tipo "Recibimos tus datos, pronto te contactaremos con tu
  propuesta preliminar." Sin incluir el diagnóstico calculado. Se envía vía
  Resend a `estado.contacto.correo`.
  - En camino B no se manda correo al cliente (Cal envía su propia confirmación).

## 4. Prerrequisitos de despliegue (los pone el usuario en Vercel)

1. **Google Maps** — llave de navegador **restringida por referrer** a
   `mexillum.com` / `www.mexillum.com` (en el estimador es
   `NEXT_PUBLIC_GOOGLE_MAPS_KEY`). Como el sitio no tiene build, esta llave va en
   `js/diagnostico.config.js` (commit), **no** en variables de entorno. La
   restricción por referrer es lo que la protege. El usuario debe crear/restringir
   la llave y pegarla en ese archivo.
2. **Variables de entorno en Vercel** (`mexillumweb`): `SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY` — para `api/upload-url.js` y los links firmados en
   `api/lead.js`.
3. **Bucket `facturas`** (privado) creado en Supabase.

## 5. Unidades y responsabilidades

| Unidad | Qué hace | Depende de |
|---|---|---|
| `js/google-maps.js` | Carga el SDK de Google Maps una vez | `diagnostico.config.js` |
| `js/diagnostico.roof.js` | Dibujo de techo, emite ubicación + área + polígono | google-maps.js |
| `js/diagnostico.facturas.js` | Sube archivos a Supabase, emite paths | `/api/upload-url` |
| `api/upload-url.js` | Firma URLs de subida a Supabase Storage | env Supabase |
| `js/diagnostico.app.js` | Máquina de pantallas: mete techo/facturas/cierre | roof, facturas, engine |
| `js/diagnostico.engine.js` | Agrega ubicación/techo/facturas al leadPayload | — |
| `api/lead.js` | Correo interno extendido + correo al cliente | env Resend/Supabase |
| `css/diagnostico.css` | Estilos de mapa, subidor, pasos | — |

## 6. Pruebas

- `api/upload-url.js`: prueba unitaria con `node --test` y `fetch` mockeado —
  valida tipos/límites y forma de la respuesta.
- `api/lead.js`: prueba unitaria de que, con `techo`/`facturas`/`ubicacion`
  presentes, el correo interno los incluye y se solicitan links firmados
  (fetch mockeado). Verificar que sin ellos el correo sigue igual (no regresión).
- `js/diagnostico.roof.js`: prueba ligera del cálculo/plomería con
  `loadGoogleMaps` mockeado (el mapa real no se prueba en unitario).
- Flujo completo (techo → facturas → cierre → ambos caminos): verificación
  manual en navegador.

## 7. Fuera de alcance (v1)

- `/diagnostico-hoteles`.
- Mostrar estimación de kWp/ahorro al usuario (motor del estimador).
- Generar una propuesta PDF automática; el "preliminar" es el diagnóstico ya
  calculado + seguimiento humano.
- Detección automática del techo por imagen; solo dibujo manual.
- Reintentos/actualización de lead si el usuario hace camino A y luego B (el
  primer envío gana; el evento de Cal queda registrado en Cal de todos modos).
