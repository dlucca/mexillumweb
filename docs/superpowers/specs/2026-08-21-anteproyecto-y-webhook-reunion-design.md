# Diseño — Datos de anteproyecto + aviso confiable al agendar

**Fecha:** 2026-08-21
**Estado:** Paso 1 aprobado (usar texto borrador, afinar después). Paso 2
(webhook) **diferido** — quizá el canal navegador basta.

## Contexto

El diagnóstico vive en `www.mexillum.com/diagnostico` (este repo, estático en
Vercel). Al terminar, la persona ve el resultado y un calendario Cal.com
(self-hosted en `cal.mexillum.com`) para agendar.

Hoy el equipo recibe **solo** el evento del calendario de Cal.com, sin el
detalle del diagnóstico.

**Causa raíz encontrada:** `POST /api/lead` devolvía **500** porque faltaba la
env var `RESEND_API_KEY` en Vercel. Resuelto en el Paso 0 (config de dashboards,
sin código). El correo del diagnóstico ya llega.

## Objetivo

Cuando un lead **agenda una reunión**, el equipo debe recibir:
1. El detalle del diagnóstico.
2. Una lista de **datos a solicitar** para armar un **anteproyecto** (proyecto
   preliminar), **dinámica según la solución recomendada**.

Además, el **lead** debe recibir su versión de "qué preparar para la reunión",
con **redacción distinta** (simple, orientada a beneficio), no la técnica.

## Alcance

- **Paso 0 — hecho (sin código):** `RESEND_API_KEY` en Vercel + dominio
  `mexillum.com` verificado en Resend. El correo de `/api/lead` ya entrega.
- **Paso 1 — motor:** generar "Datos para el anteproyecto" en dos voces
  (lead / interno), dinámico por familia de solución.
- **Paso 2 — webhook Cal.com:** endpoint nuevo que dispara un correo confiable
  al crear la reserva, independiente del navegador del lead.

Fuera de alcance: cambiar el motor de scoring, rediseño visual, base de datos.

## Familias de solución

El motor ya produce `recomendacion_solucion.tipo` y un `ranking` de
oportunidades (ids: `solar_puro`, `bess_solar`, `respaldo`, `off_grid`, etc.).
Los agrupamos en cuatro familias para elegir la lista de datos:

| Familia        | Cómo se detecta (borrador)                                    |
|----------------|---------------------------------------------------------------|
| `solar`        | `tipo` contiene "Solar" y no menciona BESS                     |
| `bess`         | `tipo` empieza con "BESS" sin "Solar" (respaldo/capacidad)    |
| `bess_solar`   | `tipo` contiene "BESS" y "Solar"                               |
| `off_grid`     | señal `aislado` en disparador, o top del ranking = `off_grid` |

La detección exacta se afina contra `recommendSolution()` en
`js/diagnostico.engine.js` durante la implementación.

## Contenido — "Datos para el anteproyecto" (dos voces)

Misma información, dos redacciones. `interno` = qué solicita el equipo;
`lead` = qué trae/prepara la persona.

### Base (todas las familias)
- **interno:** 12 recibos CFE (kWh, demanda kW, tarifa); curva/horario de
  operación; capacidad de transformador y tablero (unifilar); m² de techo/terreno
  disponibles; objetivo del cliente (ahorro/respaldo/capacidad) y horizonte.
- **lead:** tus últimos 12 recibos de luz de CFE; a qué horas opera tu planta;
  cuánto espacio libre tienes (techo o terreno); qué buscas resolver.

### `solar`
- **interno:** área/orientación/sombreado de techo, estado estructural; consumo
  diurno vs total; esquema tarifario disponible (net metering / net billing).
- **lead:** fotos del techo o del terreno; si sabes, cuánto consumes de día.

### `bess`
- **interno:** cargas críticas a respaldar (kW y kWh, autonomía requerida);
  demanda máxima y cargo por demanda; frecuencia/duración de cortes; espacio y
  ventilación para gabinete de baterías.
- **lead:** qué equipos NO pueden apagarse y por cuánto tiempo; cada cuánto se
  te va la luz y cuánto dura.

### `bess_solar`
- Une `solar` + `bess`.

### `off_grid`
- **interno:** distancia a la red y factibilidad; consumo diario (kWh/día) y
  pico; generación actual (diésel: consumo/horas/costo); días de autonomía sin
  sol requeridos.
- **lead:** si hoy usas planta de diésel (cuántas horas al día); qué tan lejos
  está la red eléctrica más cercana.

> Nota: listas borrador; el usuario ajusta el texto final en implementación.

## Arquitectura

### Paso 1 — motor (`js/diagnostico.engine.js` + `js/diagnostico.content.js`)

- Nueva función `buildAnteproyecto(resp, recomendacion_solucion, content)` →
  `{ familia, interno: string[], lead: string[] }`.
- Listas viven en `content` (como el resto del copy), no hardcodeadas en la
  lógica.
- Se agregan al resultado:
  - `res.anteproyecto` (para vista y payloads).
  - `res.leadPayload.anteproyecto_interno` — para el correo del equipo.
- Se inyecta:
  - En `buildEventNote()` → la versión **lead** entra en la nota de Cal.com (la
    ve el lead en su confirmación).
  - En `api/lead.js` (correo del equipo) → sección nueva **"Datos para el
    anteproyecto"**, versión **interna**, **aparte** del checklist actual (no lo
    reemplaza).
  - En la pantalla de resultado (`js/diagnostico.view.js`) → versión **lead**,
    como bloque "Qué preparar para la reunión".
- Tests nuevos en `test/diagnostico.engine.test.js` (una familia por caso) y
  actualización de `test/api.lead.test.js`.

### Paso 2 — webhook Cal.com (`api/booking.js` nuevo)

- Cal.com (self-hosted) → webhook **"Booking created"** → `POST
  https://www.mexillum.com/api/booking`.
- El endpoint:
  1. Valida la firma `X-Cal-Signature-256` (HMAC-SHA256 con un secreto
     compartido en env `CAL_WEBHOOK_SECRET`). Si no valida → 401.
  2. Extrae asistente (nombre, email), fecha/hora de inicio, y el detalle.
  3. Envía por Resend a `info@mexillum.com` el correo **"Reunión agendada —
     {nombre}"** con: diagnóstico + **datos internos del anteproyecto** +
     fecha/hora.
- Reutiliza los helpers de correo de `api/lead.js` (extraer a un módulo
  compartido `api/_email.js` para no duplicar).

**Decisión técnica abierta (spike en implementación):** cómo llega el detalle
**interno** al webhook.
- **Opción recomendada:** pasar un payload compacto como **metadata** de la
  reserva desde el embed (`config.metadata` en `mountCal`), que Cal.com incluye
  en el webhook. El webhook reconstruye el correo interno. La metadata **no** la
  ve el lead.
- **Verificar primero:** que el Cal.com self-hosted (a) acepte `config.metadata`
  desde el embed y (b) lo incluya en el payload del webhook. Límite de tamaño de
  metadata puede obligar a enviar solo `lead_id` + familia + respuestas y
  regenerar el texto en el servidor.
- **Fallback si metadata no viaja:** el correo del equipo **ya** llega por el
  canal navegador (`/api/lead`, ya arreglado); el webhook queda como aviso
  confiable de "reunión agendada" con la nota (versión lead) + fecha/hora.

## Flujo de datos (resumen)

```
Lead termina diagnóstico
  ├─ pantalla: diagnóstico + "qué preparar" (voz lead)
  ├─ POST /api/lead  ──► correo equipo: diagnóstico + anteproyecto INTERNO   [ya funciona]
  └─ agenda en Cal.com (nota = voz lead; metadata = payload interno)
        └─ webhook ──► POST /api/booking ──► correo equipo:
              "Reunión agendada" + diagnóstico + anteproyecto INTERNO + fecha/hora
```

## Errores y bordes

- `/api/booking` sin firma válida o secreto ausente → 401, no envía.
- Resend caído → log + 502; Cal reintenta según su config.
- De-duplicación: `/api/lead` (navegador) y `/api/booking` (webhook) pueden
  ambos disparar. Aceptable recibir dos correos con asunto distinto
  ("Diagnóstico…" vs "Reunión agendada…"); si molesta, se de-duplica luego por
  `lead_id`.

## Config que hace el usuario (fuera de código)

- **Paso 0 (hecho):** `RESEND_API_KEY` en Vercel + dominio verificado.
- **Paso 2:** en `cal.mexillum.com` → webhook "Booking created" a
  `https://www.mexillum.com/api/booking`; generar secreto y ponerlo en Vercel
  como `CAL_WEBHOOK_SECRET`.

## Orden de entrega

1. Paso 1 (motor + correo + pantalla + tests). Entregable y probable end-to-end
   solo (el correo del equipo ya lleva el anteproyecto interno).
2. Paso 2 (webhook), con spike de metadata al inicio.

Se puede parar tras el Paso 1 si el canal navegador basta.
