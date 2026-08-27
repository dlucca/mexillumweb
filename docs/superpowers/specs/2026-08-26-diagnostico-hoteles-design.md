# Diagnóstico Hoteles — Diseño

**Fecha:** 2026-08-26
**Estado:** Aprobado para plan de implementación
**Autor:** dlucca + Claude

## 1. Objetivo

Publicar una **segunda instancia** del diagnóstico energético de Mexillum,
enfocada a **hoteles de la Riviera Maya**, en una URL nueva
(`/diagnostico-hoteles`). El diagnóstico industrial actual (`/diagnostico`)
**no cambia su comportamiento**: sigue vivo y en uso.

- Mismo producto (BESS / solar / respaldo). Mismo motor de reglas.
- Marca Mexillum. Los leads llegan a Mexillum, marcados como `hoteles`.
- Una sola versión para todos los hoteles (no por cadena).

## 2. Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Reuso de código | **Compartir núcleo** (opción A). Se parte `view.js` en núcleo + arranque corto por versión. |
| URL | `/diagnostico-hoteles` (carpeta `diagnostico-hoteles/index.html`; `cleanUrls` ya activo en `vercel.json`). |
| Cita / leads | Marcados aparte: nuevo tipo de evento Cal `diagnostico/diagnostico-hoteles` + campo `origen: hoteles` en el email del lead. |
| Alcance de contenido | Set de 8 preguntas ya aprobado (sección 5) + todo el copy de resultado reescrito en lenguaje hotelero. |

## 3. Arquitectura

El motor (`js/diagnostico.engine.js`) ya es **puro**: cada función recibe
`content` como argumento y no importa el contenido. Solo `view.js` fija hoy el
archivo de contenido y el enlace de Cal. Por eso el split es limpio.

### Archivos

**Nuevos:**
- `diagnostico-hoteles/index.html` — página (clon de `diagnostico/index.html`
  con title, description, canonical y Open Graph propios de hoteles).
- `js/diagnostico.app.js` — **núcleo** de la vista. Exporta
  `initDiagnostico({ content, calLink, origen })` con toda la lógica de
  pantallas que hoy vive en `view.js`.
- `js/diagnostico.hoteles.view.js` — arranque corto:
  importa el contenido de hoteles y llama
  `initDiagnostico({ content, calLink: 'diagnostico/diagnostico-hoteles', origen: 'hoteles' })`.
- `js/diagnostico.hoteles.content.js` — contenido completo reescrito para
  hoteles (`export default`). Copia estructural del objeto `content` actual con
  copy hotelero.

**Modificados (sin cambiar el comportamiento de `/diagnostico`):**
- `js/diagnostico.view.js` — pasa a ser arranque corto de la versión
  industrial: importa `diagnostico.content.js` y llama
  `initDiagnostico({ content, calLink: 'diagnostico/diagnostico-mexillum', origen: undefined })`.
  Mismo contenido y mismo Cal que hoy → runtime idéntico.
- `api/lead.js` — lee `body.origen` (opcional). Si viene, lo agrega al asunto
  (`Diagnóstico Hoteles — …`) y al cuerpo del email. Sin `origen` el correo
  sale igual que hoy. Cambio **aditivo**.

**Sin cambios:**
- `js/diagnostico.engine.js` (ver nota `plantaLabel` abajo).
- `vercel.json` — `cleanUrls` ya resuelve la ruta por carpeta.
- Tests de engine existentes (usan fixtures del contenido industrial).

### `plantaLabel`

Hoy `plantaLabel()` en el engine devuelve la constante `'tu operación'`. Para
hoteles queremos **`'tu propiedad'`**. Solución mínima: el núcleo usa
`content.plantaLabel` si existe y cae a `plantaLabel()` del engine si no.
El contenido de hoteles define `plantaLabel: 'tu propiedad'`; el industrial no
lo define y conserva su valor actual.

### Flujo de datos

Sin cambios respecto al actual:
`content (datos) → engine (math puro) → app.js (render + DOM) → /api/lead + Cal embed`.
El núcleo agrega `origen` al payload del lead y elige el `calLink` del embed
según el arranque.

## 4. Scoring

Se **conserva el mismo set de oportunidades** (peak shaving, arbitraje, solar,
BESS+solar, respaldo, diferimiento, aislado, diésel): todas aplican a hoteles.

Ajustes dentro de `diagnostico.hoteles.content.js` (solo datos):
- **Recodificar `sector`** a códigos hoteleros: `allinclusive`, `resort`,
  `boutique`, `urbano`, `desarrollo`. Actualizar cada mapa `sector: {…}` en
  `scoring.pesos` y el objeto `perfilSector` en consecuencia.
- **Subir el peso de `respaldo`** un poco: un apagón de cara al huésped
  (reseñas, sanidad, cadena de frío) pesa más que en industria.
- `off_grid` se mantiene (eco-resorts / propiedades remotas), con peso menor.

Los umbrales, boosts, caps y tablas (`tablaFactura`, `tablaDemanda`,
`tablaRecorte`) se revisan y se reusan salvo que el lenguaje hotelero exija
retocar un texto. La lógica del engine no cambia.

## 5. Las 8 preguntas (aprobadas)

1. **Perfil de la propiedad** (`sector`) — gran all-inclusive (500+ llaves) ·
   resort de playa (150–500) · boutique/lifestyle (<150) · urbano/negocios ·
   en desarrollo/expansión.
2. **Perfil de carga** (`perfil`) — climatización 24/7 (chillers/manejadoras) ·
   sube de día y en check-in/out · picos al mediodía + cocina · concentrado en
   punta de CFE (tarde-noche) · no lo sé.
3. **Generación propia** (`generacion`) — solar en techos (detrás del medidor) ·
   contrato renovable/calificado · no · evaluando (RFP de solar).
4. **Calidad / confiabilidad** (`calidad`) — factor de potencia penalizado ·
   variaciones que dañan equipo (elevadores, cómputo, cocina, domótica) ·
   microcortes/huracanes · estable · no sé.
5. **Tarifa CFE** (`tarifa`) — igual (GDMTH, DIST/DIT, GDMTO, GDBT, PDBT,
   sin recibo, suministrador privado). Texto: recibo de **tu propiedad**.
6. **Factura mensual** (`factura`) — mismos rangos MXN.
7. **Impacto de un apagón de 30 min en alta ocupación** (`corte`) — cocina y
   cadena de frío (merma/sanidad) `producto` · operación se detiene y recuperar
   toma tiempo (bombeo, PMS) `reinicio` · ingresos + experiencia del huésped por
   hora (clima, elevadores, eventos, reseñas) `servicio` · incomoda pero no
   cuesta `nada`.
8. **Disparador** (`disparador`, multi) — crecer llaves/torres y CFE no da
   capacidad `capacidad` · diésel de emergencia frecuente `diesel` · excedente
   solar desperdiciado `excedente` · operar aislados `aislado` · solo bajar
   costo `costo` (exclusiva).

Guiños de operación incluidos: llaves, chillers/manejadoras, cuartos fríos,
lavandería, cadena de frío, PMS, factor de potencia, huracanes, punta de CFE,
RFP de solar, ocupación por temporada.

## 6. Copy de resultado

Todo el copy posterior a las preguntas se reescribe en lenguaje hotelero dentro
del nuevo content: `intro`, `perfilSector`, `perfilExposicion`, `bloqueB`
(plantillas y notas), `palancasCopy`, checklist y datos de anteproyecto,
`financiamiento` (si aplica), `resumen`, `gate` (incluida la glosa BESS). El
diagnóstico debe seguir apareciendo **completo antes del gate** (misma promesa
de "sin formulario") — comportamiento heredado del núcleo, no se toca.

## 7. Cal.com

El arranque de hoteles usa `calLink: 'diagnostico/diagnostico-hoteles'`.
**Acción del usuario (fuera de este código):** crear ese tipo de evento en
`cal.mexillum.com`. Si el evento no existe, el embed no cargará la agenda; el
resto del diagnóstico funciona igual. Recordar la nota de memoria
[[cal-note-corta]]: la nota del evento debe ser corta.

## 8. Riesgos y mitigación

- **Refactor de `view.js`:** el riesgo es romper `/diagnostico`. Mitigación: la
  extracción es mecánica y el arranque industrial llama al núcleo con el mismo
  contenido y el mismo Cal → runtime idéntico. Verificar `/diagnostico` a mano
  tras el refactor.
- **Deriva de contenido:** el content de hoteles es una copia estructural; si el
  engine gana un campo nuevo, ambos contents deben ganarlo. Aceptable: un solo
  motor, dos datos.

## 9. Pruebas

- Tests de engine actuales: siguen pasando sin cambios.
- **Nuevo test ligero** (`test/`): cargar `diagnostico.hoteles.content.js` y
  correr `assembleResult` con 2–3 respuestas tipo (resort all-inclusive GDMTH
  factura alta; boutique diurno evaluando solar) → no lanza y devuelve
  estructura esperada. Cubre que el content nuevo respeta el contrato del engine.
- Verificación manual: `/diagnostico` intacto y `/diagnostico-hoteles` completo
  de punta a punta (intro → 8 pasos → resultado → gate → Cal).

## 10. Fuera de alcance

- Versiones por cadena hotelera.
- Cambios de marca (sigue Mexillum).
- Nuevo diseño visual (reusa `css/` actual).
- Traducción a inglés.
