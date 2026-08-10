# Motor de diagnóstico energético v3 — Diseño

Fecha: 2026-08-10
Estado: aprobado (diseño), pendiente de plan de implementación.

## Objetivo

Evolucionar el motor de diagnóstico (no reescribirlo) para que deje de clasificar
principalmente por **industria** y pase a identificar oportunidades por el
**comportamiento eléctrico** de una única instalación. Se conserva la arquitectura
actual: separación `engine.js` (funciones puras) / `content.js` (copy y reglas como
datos), el flujo de 8 preguntas y el estilo de copy es-MX (tuteo, sin voseo).

El diagnóstico sigue siendo una herramienta de generación y calificación de leads,
respondible en < 2 minutos por personal no técnico. **No** es una auditoría.

## Principio de una sola ubicación

El diagnóstico evalúa **siempre una única instalación**. Aunque la empresa tenga
varias plantas, el objetivo es identificar la mejor oportunidad para un primer
proyecto BESS o BESS+Solar en un solo sitio. Todas las preguntas, cálculos y
estimaciones se refieren exclusivamente a esa instalación. No se consolidan ni se
agregan consumos de varias plantas.

Consecuencia de diseño: se elimina la pregunta `sitios`. `plantaLabel()` deja de
depender de ella y devuelve una constante ("tu operación"). El discurso de "empezar
por un sitio piloto" se conserva de forma **genérica** en el copy de financiamiento
(default), sin necesitar la pregunta.

---

## A. Set final de 8 preguntas

Se mantiene el orden general y el estilo. Sale `demanda` (bajo poder predictivo: hoy
solo elige una frase-gancho). Sale `sitios` (cero valor predictivo). Entran dos
preguntas de comportamiento eléctrico.

| # | key | Estado | Rol en el motor |
|---|-----|--------|-----------------|
| 1 | `sector` | Se mantiene | Solo lenguaje + algunos casos de copy. Ya no determina la recomendación. |
| 2 | `perfil` | NUEVA (reemplaza `demanda`) | Perfil de carga + horario. Motor de Peak Shaving / Arbitraje / match Solar. |
| 3 | `generacion` | Se mantiene | Solar / BESS+Solar. |
| 4 | `tarifa` | Se mantiene | Economía + elegibilidad de arbitraje. |
| 5 | `factura` | Se mantiene | Economía (magnitud). |
| 6 | `corte` | Se mantiene | Respaldo. |
| 7 | `calidad` | NUEVA (reemplaza `sitios`) | Calidad eléctrica. |
| 8 | `disparador` | Se mantiene | Crecimiento/capacidad · diésel · excedente · costo. |

### Pregunta 2 — `perfil` (notaLabel: "Perfil de carga / horario")

Prompt: *"Pensando en un día típico de tu operación, ¿cómo se comporta el consumo
eléctrico?"*

| código | label (resumen) | Señal |
|--------|-----------------|-------|
| `plano` | Parejo las 24 h, no para (proceso continuo) | Arbitraje↑↑, Peak Shaving↓ |
| `diurno` | Sube de día y baja de noche (turno diurno) | Peak Shaving↑, Solar↑↑ |
| `picos` | Picos cortos e intensos (arranques de motores, cargas puntuales) | Peak Shaving↑↑ |
| `punta` | Se concentra en la tarde-noche (~6–10 pm, horario punta CFE) | Arbitraje↑↑, Solar↓ (favorece BESS+Solar) |
| `nolose` | No lo tengo claro | Marca limitación; defaults moderados |

### Pregunta 7 — `calidad` (notaLabel: "Calidad eléctrica")

Prompt: *"¿Reconoces problemas de calidad o confiabilidad eléctrica en tu operación?"*

| código | label (resumen) | Señal |
|--------|-----------------|-------|
| `factor` | Penalización por bajo factor de potencia en el recibo | Factor de potencia (palanca cualitativa) + Peak Shaving leve |
| `variaciones` | Variaciones de voltaje, parpadeos o daño a equipos | Respaldo↑ (acondicionamiento) |
| `cortes` | Microcortes o interrupciones frecuentes de CFE | Respaldo↑↑ |
| `no` | El suministro es estable | — |
| `nolose` | No lo sé | Marca limitación |

`corte` (costo de un apagón) y `calidad=cortes` (frecuencia de interrupciones) son
complementarias: frecuencia × impacto = señal fuerte de respaldo.

`disparador` conserva sus 4 opciones: `capacidad` (crecer y CFE no da → captura
"potencial de crecimiento"), `diesel`, `excedente`, `costo`.

---

## B. Sistema de scoring (0–100 por oportunidad)

Nueva función pura `scoreOpportunities(resp, content)`. Los pesos viven como **datos
en `content.js`** (`content.scoring`), aditivos, con `clamp(0, 100)`. Devuelve un
objeto con las 6 oportunidades.

Ids internos: `peak_shaving`, `arbitraje`, `bess_solar`, `respaldo`, `diferimiento`,
`diesel`.

Nota sobre `sector`: contribuye solo como **nudge menor** (≤ 14 pts) en algunas
oportunidades, nunca como determinante dominante. El comportamiento (`perfil`,
`tarifa`, `generacion`, `corte`, `calidad`, `disparador`) siempre pesa más. Esto es
coherente con "sector solo para lenguaje y algunos casos específicos".

Pesos propuestos (afinables). Cada tabla mapea `campo → { código: puntos }`.

### Peak Shaving
- `perfil`: picos +50, diurno +38, punta +32, plano +8, nolose +18
- `tarifa`: gdmth +25, dist +25, otra +12, nolose +8, privado +0
- `factura`: muyalto +18, alto +14, medio +9, bajo +4, nolose +6
- `sector`: frio +7, ev +7, manufactura +4, continuo +0, publico +0
- `calidad`: factor +5 (el bajo FP infla el cargo por demanda)

### Arbitraje
- `tarifa`: gdmth +38, dist +18, privado +12, otra +6, nolose +8
- `perfil`: plano +34, punta +34, diurno +14, picos +8, nolose +14
- `sector`: continuo +14
- `disparador`: excedente +14
- `factura`: muyalto +10, alto +7, medio +4, bajo +0, nolose +0

### BESS + Solar
- `generacion`: no +26, evaluando +26, estacional +34, fisica +6
- `perfil`: diurno +34, plano +16, picos +10, punta +8, nolose +14
- `disparador`: excedente +16
- `sector`: publico +6, ev +6, frio +6
- (La disponibilidad de techo/terreno **no** entra al score; si BESS+Solar es alto y
  `generacion∈{no,evaluando}`, se emite una limitación por dato faltante.)

### Respaldo
- `corte`: producto +52, reinicio +42, servicio +40, nada +0
- `calidad`: cortes +20, variaciones +14, factor +0
- `sector`: frio +12, continuo +10
- `disparador`: diesel +8

### Diferimiento de capacidad
- `disparador`: capacidad +62
- `sector`: ev +26
- `perfil`: picos +12, punta +6
- `factura`: muyalto +8, alto +4
- (Si `disparador≠capacidad`, el score se mantiene bajo por diseño.)

### Sustitución de diésel
- `disparador`: diesel +72
- `corte`: producto +8, reinicio +8
- `calidad`: cortes +8
- (Sin diésel el score ≈ 0, correcto: no hay diésel que sustituir.)

### Ranking y potencial general

- `ranking`: las 6 oportunidades ordenadas por score desc → `[{ id, nombre, score }]`.
  Desempate estable por un orden de prioridad fijo declarado en `content`.
- `potencial_general` a partir del score líder `S1`:
  - `S1 ≥ 75` → **Muy Alto**
  - `60 ≤ S1 < 75` → **Alto**
  - `40 ≤ S1 < 60` → **Medio**
  - `S1 < 40` → **Bajo**
  - Orden de ajustes (se aplican en esta secuencia sobre el nivel base):
    1. Nivel base por `S1` (tabla anterior).
    2. Si ≥ 3 oportunidades tienen score ≥ 60, sube un nivel (tope Muy Alto).
    3. Tope por incertidumbre: si `factura=nolose` **y** `tarifa∈{nolose,privado}`,
       se limita a **Medio** como máximo (el tope se aplica al final y gana sobre el
       bump anterior).

---

## C. Recomendación explícita BESS vs Solar

Nueva función `recommendSolution(resp, scores)` → `{ tipo, razon }`.
`tipo ∈ { 'BESS', 'BESS + Solar', 'Solar primero', 'No recomendar Solar' }`.

Reglas, primera que aplica:
1. `generacion=fisica` y `disparador≠excedente` → **No recomendar Solar** (ya tienen
   generación resuelta; el foco BESS es demanda/arbitraje).
2. `generacion=estacional` → **BESS + Solar** (llenar el hueco fuera de temporada).
3. `bess_solar ≥ 60`, `generacion∈{no,evaluando}` y `perfil=diurno` → **BESS + Solar**.
4. `perfil=diurno`, `generacion∈{no,evaluando}` y `tarifa∈{nolose,privado}` →
   **Solar primero** (lo más robusto sin datos de tarifa/demanda).
5. Líder del ranking es `peak_shaving` o `arbitraje` y `bess_solar < 50` →
   **BESS** (solo).
6. Default → **BESS** (la `razon` menciona Solar como fase 2 a evaluar).

Cada regla produce una `razon` en el estilo de copy actual, es-MX.

---

## D. Potencial económico — mismo método, lenguaje conservador

Se conserva la cadena: factura → %demanda (por `tarifa`) → %recorte → anual, con el
mismo redondeo (`roundHalfEven`) y formato (`formatMoney`/`formatRango`). Dos cambios:

1. **%recorte por `perfil`, no por `sector`.** `content.tablaRecorte` pasa a estar
   keyeada por `perfil` (comportamiento), que es lo que determina cuánto recorta una
   batería. Rangos propuestos:
   - `picos`: [0.25, 0.40]
   - `diurno`: [0.22, 0.35]
   - `punta`: [0.18, 0.30]
   - `plano`: [0.10, 0.18]  (proceso continuo: el recorte de pico rinde poco)
   - `nolose`: [0.15, 0.30] (rango ancho + limitación)
   `sector` deja de intervenir en el cálculo del número.

2. **Lenguaje conservador.** El bloque deja de titularse "Rango estimado de ahorro".
   Copy tipo: *"En empresas con un perfil similar solemos encontrar oportunidades
   económicas de este orden de magnitud."* Disclaimer reforzado: **no es una
   propuesta ni un ahorro garantizado**; se vuelve un número real con los recibos de
   12 meses. Se evita todo lenguaje que sugiera precisión o compromiso comercial.

Las salidas sin número (`tarifa=privado`, `factura=nolose`) se conservan como hoy.

---

## E. Detección de limitaciones

Nueva función `detectLimitations(resp, scores)` → `[{ dato, porque, no_se_puede }]`.
No inventa conclusiones cuando falta información. Casos:

- `factura=nolose` → dato: orden de magnitud de la factura; porque: sin ella no hay
  base para estimar el rango económico; no_se_puede: cuantificar el ahorro (solo
  priorizar palancas).
- `tarifa=nolose` → dato: tarifa CFE; porque: define cuánto pesa el cargo por demanda
  y si hay diferenciación horaria; no_se_puede: separar peak shaving de arbitraje ni
  confirmar elegibilidad de arbitraje.
- `tarifa=privado` → dato: estructura del contrato de suministro; porque: el arbitraje
  depende de exposición a precios horarios; no_se_puede: confirmar si el margen es
  tuyo o del suministrador.
- `perfil=nolose` → dato: perfil horario de consumo; porque: sin saber cuándo consumes
  no se distingue recortar pico vs arbitrar; no_se_puede: fijar la palanca principal
  con confianza.
- `generacion∈{no,evaluando}` y `bess_solar` alto → dato: superficie de techo/terreno
  disponible; porque: define si Solar es viable; no_se_puede: dimensionar BESS+Solar.
- `disparador=diesel` → dato: horas/año de diésel y su costo; porque: dimensiona el
  mayor margen del análisis; no_se_puede: cuantificar la sustitución.
- `calidad=nolose` → dato: comportamiento de calidad eléctrica; porque: define si hay
  penalización por factor de potencia o riesgo a equipos; no_se_puede: valorar esa
  palanca.

Las limitaciones se **trasladan al checklist** (reutilizando/ampliando los refuerzos
existentes: recibos, desglose horario, contrato, techo, diésel) y a la **nota de la
llamada**.

---

## F. Integración con las palancas existentes (evolución, no reemplazo)

Las reglas de palancas actuales (`palancasPrincipal`, `palancasSecundaria`,
`palancasDescartada`, `palancaFactorPotencia`) **se conservan como copy**. El cambio:
la selección de la palanca **principal/secundaria pasa a guiarse por el `ranking` de
scores** en lugar de la precedencia por sector/disparador. Cada oportunidad del
ranking tiene asociado su bloque de copy. La palanca "No aplica —" (descarte) sigue
presente siempre, ahora derivada de la oportunidad peor rankeada relevante.

`palancaFactorPotencia` pasa a dispararse por `calidad=factor` (antes por
`sector=frio`), que es la señal correcta.

---

## G. Compatibilidad

No se rompe: separación `engine.js`/`content.js`, estilo de copy, checklist,
integración Cal.com, ni las claves actuales del payload del lead.

El payload **solo agrega** claves nuevas (todo lo actual se mantiene):
`scores`, `ranking`, `potencial_general`, `recomendacion_solucion`, `limitaciones`.
Lo mismo el objeto `res` de `assembleResult`, para que el frontend pueda renderizar
ranking/recomendación/limitaciones más adelante (en esta entrega no se renderizan en
la vista; los datos quedan disponibles).

### Archivos afectados
- `js/diagnostico.content.js` — nuevas preguntas (`perfil`, `calidad`), quita
  `demanda`/`sitios`; `content.scoring` (pesos + nombres + orden de desempate);
  copy de recomendación y limitaciones; `tablaRecorte` por `perfil`; lenguaje
  conservador del bloque económico; ajustes de financiamiento/descarte por quitar
  `sitios`; `palancaFactorPotencia` por `calidad=factor`.
- `js/diagnostico.engine.js` — nuevas funciones puras `scoreOpportunities`,
  `rankOpportunities`, `potencialGeneral`, `recommendSolution`, `detectLimitations`;
  `computeRange` usa `perfil`; `pickLevers` guiado por ranking; `plantaLabel`
  constante; `buildChecklist` alimentado por limitaciones; `assembleResult` y
  `buildEventNote` extendidos con las claves nuevas.
- `js/diagnostico.view.js` — `plantaLabel` constante (o `{planta}` fijo); sin
  dependencia de `sitios`. Render del ranking/recomendación se pospone (datos
  disponibles).
- `api/lead.js` — actualizar etiquetas `PREGUNTAS` (demanda→perfil, sitios→calidad);
  sumar al email `potencial_general` + `ranking` + `recomendacion_solucion`.
- Tests — actualizar fixtures (usan `demanda`/`sitios`) y **agregar** tests de
  scoring, ranking, potencial, recomendación y limitaciones. Conservar los tests de
  formato/redondeo/copy que siguen siendo válidos. Mantener el test de "sin voseo".

## No-objetivos (YAGNI)
- No se renderiza el ranking/recomendación en la vista todavía (solo datos en payload).
- No se agrega una 9ª pregunta.
- No se cambia el proveedor de email ni el flujo de Cal.com.
- No se hace refactor no relacionado.

## Criterios de éxito
- Exactamente 8 preguntas; < 2 min; entendible sin conocimiento técnico.
- Las 6 oportunidades reciben score 0–100 independiente; hay ranking y
  `potencial_general`.
- La recomendación BESS/BESS+Solar/Solar primero/No Solar es explícita en el resultado.
- Cuando faltan datos críticos, el motor lo dice (limitaciones) y no inventa números.
- Lenguaje económico conservador, sin promesas de ahorro garantizado.
- Payload retrocompatible: todas las claves actuales siguen presentes.
- `npm test` (o `node --test`) en verde.
