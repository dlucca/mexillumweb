# Funnel de diagnóstico v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescribir el funnel de diagnóstico BESS de Mexillum a v2: 8 preguntas, motor de 5 bloques (A–E) con cálculo aritmético de rango de ahorro, gate de contacto con `rol`, y lead sin score (perfil + rango).

**Architecture:** Se conserva el split de tres archivos: `content.js` (datos/copy puros), `engine.js` (funciones puras, sin DOM, importables en Node para tests), `view.js` (render/DOM). El engine se construye por bloques con TDD contra el fixture del spec. `api/lead.js` (Resend) se actualiza a las 8 keys. El resultado y el gate reusan componentes `mx-*` sin CSS nuevo.

**Tech Stack:** JS vanilla ESM (Node 18+ / navegador), `node --test` (test runner nativo), Vercel serverless (`api/`), cal.diy embed, Resend REST.

**Spec:** `docs/superpowers/specs/2026-08-08-funnel-diagnostico-v2-design.md`

## Global Constraints

- Copy en **es-MX (tuteo)**. Prohibido voseo; el test `no-voseo` en `test/diagnostico.content.test.js` lo hace cumplir sobre todo el copy.
- **Sin estilos CSS nuevos.** Reusar `.mx-field`, `.mx-field__label`, `.mx-field__error`, `.mx-input`, `.mx-select`, `.mx-btn`, `.mx-check`, y las clases `dx__*` existentes.
- **No editar** `PRD_Funnel_Mexillum.md`, `index.html` (landing) ni `js/main.js`.
- Motor: reglas evaluadas de arriba hacia abajo, primera que aplique (precedencia = orden). `engine.js` sin DOM; `content.js` sin lógica.
- Redondeo de dinero ≥1M: millones con un decimal, **round-half-to-even** (banker's). `2,250,000`→"2.2", `2,187,450`→"2.2", `4,200,000`→"4.2". <1M: a la decena de miles, "$XXX,XXX".
- Lead a `/api/lead` **una sola vez** al enviar el gate. La reserva cal.diy no re-envía lead (solo adjunta la nota del evento).
- Bloque E: financiamiento como opción **sujeta a evaluación**; prohibido "cero riesgo" / "el ahorro empieza el primer mes" / promesas cerradas.
- Fixture canónico (§5 del spec): `sector=manufactura, sitios=pocos, generacion=fisica, demanda=desconoce, tarifa=gdmth, factura=alto, corte=reinicio, disparador=costo` → piso `2250000`, techo `4200000`, rango "$2.2 a $4.2 millones de MXN al año".
- Comandos: correr tests con `npm test`. Terminar cada tarea con commit.

---

### Task 1: `content.js` v2 (datos) + content tests

**Files:**
- Modify (rewrite): `js/diagnostico.content.js`
- Modify (rewrite): `test/diagnostico.content.test.js`

**Interfaces:**
- Produces: `content` (default export) con: `intro`, `pasos[]` (keys `sector, sitios, generacion, demanda, tarifa, factura, corte, disparador`; cada opción `{label, codigo}`; `hint?`, `notaLabel`), `gate`, `perfilSector`, `perfilExposicion[]`, `perfilExposicionDefault`, `tablaFactura`, `tablaDemanda`, `tablaRecorte`, `tarifaLegible`, `bloqueB` (con `plantilla(v)` función), `gancho`, `palancasPrincipal[]`, `palancaPrincipalDefault`, `palancasSecundaria[]`, `palancasDescartada[]`, `datoFaltante[]`, `datoFaltanteCorte`, `datoFaltanteDefault`, `cierreComun`, `financiamiento[]`, `financiamientoDefault`, `checklistBase[]`, `checklistRefuerzos{}`, `checklistViabilidad{}`, `checklistUniversal`, `checklistTitulo`, `checklistPie`, `resultado`, `progresoLabel(n,total)`.

- [ ] **Step 1: Write the failing tests** — replace the entire contents of `test/diagnostico.content.test.js` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';

test('hay 8 pasos con las keys esperadas', () => {
  assert.deepEqual(content.pasos.map((p) => p.key), [
    'sector', 'sitios', 'generacion', 'demanda', 'tarifa', 'factura', 'corte', 'disparador'
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
  assert.deepEqual(content.tablaRecorte.manufactura, [0.25, 0.35]);
  assert.deepEqual(content.tablaRecorte.continuo, [0.12, 0.20]);
});

test('perfilSector cubre los 5 sectores', () => {
  for (const s of ['continuo', 'manufactura', 'frio', 'publico', 'ev']) {
    assert.ok(content.perfilSector[s], `falta perfilSector.${s}`);
  }
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL (content aún es v1: no hay 8 pasos, no hay `gate`, `tablaFactura`, etc.)

- [ ] **Step 3: Write the implementation** — replace the entire contents of `js/diagnostico.content.js` with:

```js
// Todo el copy y las reglas del funnel v2, como datos. Cambiar contenido o reordenar
// prioridades = editar este archivo. Sin lógica: engine.js lee de acá. Copy es-MX (tuteo).

const content = {
  intro: {
    titulo: 'Diagnóstico energético en 2 minutos',
    cuerpo: 'Ocho preguntas sobre tu operación. Al final vas a ver qué palancas de ahorro aplican a tu caso, un rango estimado de lo que hay en juego, y qué datos preparar para volverlo un número exacto.',
    pie: 'Sin costo. Sin compromiso.',
    cta: 'Empezar'
  },

  pasos: [
    {
      key: 'sector', notaLabel: 'Sector / operación',
      pregunta: '¿Cómo describirías tu operación?',
      opciones: [
        { label: 'Proceso continuo 24/7 (alimentos, minería, química, papel, agua)', codigo: 'continuo' },
        { label: 'Manufactura por turnos o por lotes', codigo: 'manufactura' },
        { label: 'Frío y logística (cadena de frío, CEDIS, hielo)', codigo: 'frio' },
        { label: 'Infraestructura pública o servicios (transporte, agua, edificios)', codigo: 'publico' },
        { label: 'Carga de vehículos eléctricos', codigo: 'ev' }
      ]
    },
    {
      key: 'sitios', notaLabel: 'Instalaciones',
      pregunta: 'Antes de empezar: si operas varias plantas, vamos a enfocar este diagnóstico en una sola — la que quieras mejorar primero. ¿Cuántas instalaciones opera tu empresa en total?',
      opciones: [
        { label: 'Una sola', codigo: 'uno' },
        { label: '2 a 5', codigo: 'pocos' },
        { label: 'Más de 5', codigo: 'muchos' }
      ]
    },
    {
      key: 'generacion', notaLabel: 'Generación propia',
      pregunta: '¿Generan parte de su propia energía?',
      opciones: [
        { label: 'No, compramos todo de CFE o de un suministrador', codigo: 'no' },
        { label: 'Sí — solar o contrato renovable vigente', codigo: 'fisica' },
        { label: 'Generamos parte del año (cogeneración, zafra, estacional)', codigo: 'estacional' },
        { label: 'Lo estamos evaluando', codigo: 'evaluando' }
      ]
    },
    {
      key: 'demanda', notaLabel: 'Conoce el cargo por demanda',
      pregunta: '¿Sabes qué parte de tu factura es cargo por demanda, y no la energía que consumiste?',
      hint: 'Es un cargo aparte, por tu momento de mayor consumo del mes — a veces solo 15 minutos.',
      opciones: [
        { label: 'Sí, lo tenemos identificado y medido', codigo: 'mide' },
        { label: 'Lo he visto en la factura, pero no lo analizamos', codigo: 'visto' },
        { label: 'No sabía que se facturaba por separado', codigo: 'desconoce' }
      ]
    },
    {
      key: 'tarifa', notaLabel: 'Tarifa CFE',
      pregunta: 'Busca el recibo de CFE de {planta}. Arriba a la derecha hay un código de tarifa — ¿cuál es?',
      opciones: [
        { label: 'GDMTH', codigo: 'gdmth' },
        { label: 'DIST o DIT', codigo: 'dist' },
        { label: 'Otra / PDBT', codigo: 'otra' },
        { label: 'No tengo el recibo a la mano', codigo: 'nolose' },
        { label: 'No compramos a CFE (suministrador privado)', codigo: 'privado' }
      ]
    },
    {
      key: 'factura', notaLabel: 'Factura mensual',
      pregunta: 'De {planta}: ¿cuánto paga de electricidad al mes?',
      hint: 'Solo lo usamos para estimar el rango — nada se comparte.',
      opciones: [
        { label: 'Menos de $200,000 MXN', codigo: 'bajo' },
        { label: '$200,000 – $1,000,000', codigo: 'medio' },
        { label: '$1,000,000 – $5,000,000', codigo: 'alto' },
        { label: 'Más de $5,000,000', codigo: 'muyalto' },
        { label: 'No lo tengo a la mano', codigo: 'nolose' }
      ]
    },
    {
      key: 'corte', notaLabel: 'Impacto de un corte',
      pregunta: 'Si a {planta} se le corta la energía 30 minutos en su peor momento del día, ¿qué pasa?',
      opciones: [
        { label: 'Se pierde producto o un lote completo', codigo: 'producto' },
        { label: 'Se detiene producción y reiniciar toma horas', codigo: 'reinicio' },
        { label: 'Perdemos servicio o ingresos por hora', codigo: 'servicio' },
        { label: 'Incomoda, pero no cuesta dinero relevante', codigo: 'nada' }
      ]
    },
    {
      key: 'disparador', notaLabel: 'Disparador',
      pregunta: '¿Reconoces alguna de estas situaciones?',
      opciones: [
        { label: 'Queremos crecer o ampliar carga, y CFE no da capacidad (o tarda)', codigo: 'capacidad' },
        { label: 'Usamos diésel o planta de emergencia con frecuencia', codigo: 'diesel' },
        { label: 'Generamos excedente que exportamos o se desperdicia', codigo: 'excedente' },
        { label: 'Ninguna — nuestro tema es puramente el costo', codigo: 'costo' }
      ]
    }
  ],

  gate: {
    titulo: 'Tu diagnóstico está listo.',
    cuerpo: 'Déjanos dónde enviártelo con el rango estimado y el checklist de datos.',
    cta: 'Ver mi diagnóstico',
    campos: [
      { key: 'nombre', label: 'Nombre', type: 'text', required: true, autocomplete: 'name' },
      { key: 'empresa', label: 'Empresa', type: 'text', required: false, autocomplete: 'organization' },
      { key: 'correo', label: 'Email', type: 'email', required: true, autocomplete: 'email' },
      { key: 'telefono', label: 'Teléfono', type: 'tel', required: false, autocomplete: 'tel' },
      { key: 'rol', label: 'Rol', type: 'select', required: false,
        opciones: ['Dirección general', 'Finanzas', 'Operaciones-Planta', 'Energía-Mantenimiento', 'Otro'] }
    ]
  },

  // ---- BLOQUE A ----
  perfilSector: {
    continuo: 'proceso continuo', manufactura: 'manufactura', frio: 'frío y logística',
    publico: 'infraestructura pública', ev: 'carga de vehículos eléctricos'
  },
  perfilExposicion: [
    { when: { generacion: 'estacional' }, text: 'con generación estacional y hueco fuera de temporada' },
    { when: { sector: 'continuo' }, text: 'de proceso continuo con exposición estructural a horario punta' },
    { when: { disparador: 'capacidad' }, text: 'con restricción de capacidad eléctrica' },
    { when: { disparador: 'diesel' }, text: 'con dependencia de diésel' }
  ],
  perfilExposicionDefault: 'con exposición a cargo por demanda',

  // ---- BLOQUE B ----
  tablaFactura: { bajo: 120000, medio: 500000, alto: 2500000, muyalto: 7000000, nolose: null },
  tablaDemanda: { gdmth: [0.30, 0.40], dist: [0.35, 0.45], otra: [0.20, 0.35], nolose: [0.20, 0.35], privado: null },
  tablaRecorte: { manufactura: [0.25, 0.35], frio: [0.25, 0.35], ev: [0.30, 0.45], continuo: [0.12, 0.20], publico: [0.20, 0.30] },
  tarifaLegible: { gdmth: 'GDMTH', dist: 'DIST/DIT', otra: 'tu tarifa actual', nolose: 'tu tarifa actual' },
  bloqueB: {
    plantilla: (v) => `Con una factura de ~${v.facturaLegible} al mes en tarifa ${v.tarifaLegible}, el cargo por demanda suele pesar entre ${v.pctDemandaPiso}% y ${v.pctDemandaTecho}% de tu recibo — unos ${v.montoDemandaPiso} a ${v.montoDemandaTecho} al año, solo por tu momento pico. Un sistema de almacenamiento bien dimensionado recorta típicamente entre ${v.pctRecortePiso}% y ${v.pctRecorteTecho}% de ese cargo.`,
    rango: (rangoTexto) => `Rango estimado: ${rangoTexto}.`,
    disclaimer: 'Es un rango de industria sobre los datos que diste, no una propuesta. Con tus recibos de 12 meses se vuelve un número exacto.',
    continuoExtra: 'Pero en una operación 24/7 como la tuya, el recorte de pico no es tu palanca más fuerte — el arbitraje horario suele serlo, porque compras en punta obligadamente todos los días. Eso se suma a este rango y lo calculamos con tu desglose horario.',
    noloseFactura: 'Para estimar tu ahorro necesitamos el orden de magnitud de tu factura — es el primer dato del checklist. Lo que sí podemos decirte desde ya es qué palancas aplican a tu perfil:',
    privado: 'Como compras a un suministrador privado, tu ahorro depende de la estructura de tu contrato — si tienes exposición a precios horarios del mercado, hay arbitraje; si es precio fijo, el margen se lo queda tu suministrador. Es la primera pregunta que resolvemos en la llamada.',
    dieselNota: 'Y ojo: la sustitución de diésel ahorra por peso desplazado, no por porcentaje de factura — suele ser el de mayor margen del análisis, y lo dimensionamos con tus horas de operación.'
  },

  // ---- BLOQUE C ----
  gancho: 'La mayoría de las empresas no sabe que una parte grande de su recibo no es energía que consumió, sino un cargo por su pico de demanda. Eso es exactamente lo primero que revisamos.',
  palancasPrincipal: [
    { id: 'estacional', when: { generacion: 'estacional' }, nombre: 'Cobertura fuera de temporada', text: 'Tu generación cubre parte del año; el resto pagas tarifa completa. Ahí está tu mayor hueco, y coincide con la temporada de más sol.' },
    { id: 'diesel', when: { disparador: 'diesel' }, nombre: 'Sustitución de diésel', text: 'Cada hora de diésel cuesta un múltiplo de la red. Desplazarlo es tu palanca de mayor margen.' },
    { id: 'capacidad', when: { disparador: 'capacidad' }, nombre: 'Diferimiento de capacidad', text: 'Ampliar tu acometida con CFE puede tomar meses o años. El almacenamiento te deja crecer sin esperar esa ampliación.' },
    { id: 'continuo', when: { sector: 'continuo' }, nombre: 'Arbitraje horario', text: 'Tu operación no para, así que compras en horario punta todos los días sin alternativa. Trasladar ese consumo a horas baratas es tu palanca más fuerte.' },
    { id: 'ev', when: { sector: 'ev' }, nombre: 'Diferimiento + pico de carga', text: 'Un cargador rápido dispara un pico de demanda brutal frente a lo que factura. Recortarlo y evitar ampliar acometida es donde está el dinero.' },
    { id: 'excedente', when: { disparador: 'excedente' }, nombre: 'Arbitraje de excedente', text: 'El excedente que hoy exportas a precio de valle puede venderse en las horas de mayor precio. Es una palanca de ingreso, no de ahorro.' }
  ],
  palancaPrincipalDefault: { id: 'demanda', nombre: 'Recorte de demanda', text: 'Tu momento de mayor consumo fija un cargo que pesa sobre toda la factura, aunque dure minutos. Es de lo más fácil y directo de recortar.' },
  palancasSecundaria: [
    { id: 'producto', when: { corte: 'producto' }, nombre: 'Respaldo de producto', text: 'Además, un corte te cuesta producto perdido — el respaldo protege ese inventario.' },
    { id: 'reinicio', when: { corte: 'reinicio' }, nombre: 'Continuidad de proceso', text: 'Además, cada paro te cuesta horas de reinicio; el respaldo evita esa pérdida.' },
    { id: 'servicio', when: { corte: 'servicio' }, nombre: 'Continuidad de servicio', text: 'Además, cada hora sin energía es ingreso perdido — el respaldo lo sostiene.' },
    { id: 'continuo', when: { sector: 'continuo' }, nombre: 'Arbitraje horario', text: 'Y como corres 24/7, el arbitraje horario suma sobre el recorte de pico.' },
    { id: 'capacidad', when: { disparador: 'capacidad' }, nombre: 'Diferimiento de capacidad', text: 'Y te permite crecer sin esperar la ampliación de CFE.' }
  ],
  palancasDescartada: [
    { id: 'fisica', when: { generacion: 'fisica' }, nombre: 'Solar', text: 'Ya tienes generación resuelta; tu cuello de botella es cómo aprovecharla y qué te cuesta la demanda, no generar más.' },
    { id: 'estacional', when: { generacion: 'estacional' }, nombre: 'Tu cogeneración', text: 'No te proponemos tocarla. Ya generas durante la temporada; el foco es el hueco de los otros meses.' },
    { id: 'continuo', when: { sector: 'continuo' }, nombre: 'Peak shaving como caso principal', text: 'No te lo vendemos como el gran ahorro: en una operación 24/7 rinde poco. Tu palanca real es el arbitraje.' },
    { id: 'costo_nada', when: { disparador: 'costo', corte: 'nada' }, nombre: 'Respaldo/continuidad', text: 'Si un corte no te cuesta dinero, pagar por continuidad no tiene sentido — tu caso es puramente de costo.' },
    { id: 'megaproyecto', when: { sitios: 'muchos' }, nombre: 'El megaproyecto', text: 'No te proponemos un megaproyecto multi-planta. Se empieza por un sitio piloto medido y se replica solo si el número se cumple.' }
  ],

  // ---- BLOQUE D ----
  datoFaltante: [
    { when: { factura: 'nolose' }, text: 'Para volver esto un número exacto, el dato clave es tu recibo de CFE — con 12 meses vemos tu cargo por demanda real y tu perfil horario.' },
    { when: { tarifa: 'privado' }, text: 'El dato que define tu caso es la estructura de tu contrato de suministro — si tienes exposición a precios horarios o es precio fijo. Eso decide cuánto arbitraje hay para ti.' },
    { when: { disparador: 'diesel' }, text: 'El dato que dimensiona tu ahorro son las horas al año que corre tu diésel — ahí está el mayor margen del análisis.' },
    { when: { sector: 'continuo' }, text: 'El dato que define tu arbitraje es tu desglose de consumo por horario (base, intermedia, punta) — se lee de tu recibo GDMTH.' }
  ],
  datoFaltanteCorte: 'El dato que cierra el caso de respaldo es cuántos paros por causa eléctrica tuviste y qué costó cada uno — casi nadie lo mide, y suele ser mayor de lo esperado.',
  datoFaltanteDefault: 'El dato que vuelve esto exacto son tus recibos de CFE de los últimos 12 meses — sobre tus propios números, no estimaciones.',
  cierreComun: 'Ese es exactamente el diagnóstico gratuito que hacemos en la llamada: sobre tus datos reales, sin costo y sin compromiso.',

  // ---- BLOQUE E ----
  financiamiento: [
    { when: { sector: 'publico' }, text: 'Para entidades públicas, este tipo de proyecto suele poder estructurarse como contrato de servicio en lugar de inversión directa — lo que permite tratarlo como gasto corriente. La viabilidad de ese esquema depende de un análisis de tu caso, y es parte de lo que evaluamos juntos en la llamada.' },
    { when: { sector: 'ev' }, text: 'Existe la opción de estructurarlo sin inversión inicial, con el activo de nuestro lado — sujeto a una evaluación de viabilidad del proyecto. También puedes adquirirlo directamente si prefieres evaluarlo por retorno. Vemos cuál te conviene según tus números.' },
    { when: { factura: 'muyalto' }, text: 'A tu escala, la pregunta no suele ser si hay capital, sino dónde rinde mejor. Se puede estructurar como inversión propia o como esquema de servicio que mantiene el activo fuera de tu balance —esto último sujeto a evaluación de viabilidad. Definimos cuál encaja con tu política de capital.' },
    { when: { sitios: 'pocos' }, text: 'Hay dos caminos: adquirir el sistema y evaluarlo por retorno sobre tu capital, o un esquema de servicio sin inversión inicial —sujeto a análisis de viabilidad— donde ponemos el activo. Con varias plantas, lo natural es probar uno primero y definir el modelo con datos reales antes de replicar.' },
    { when: { sitios: 'muchos' }, text: 'Hay dos caminos: adquirir el sistema y evaluarlo por retorno sobre tu capital, o un esquema de servicio sin inversión inicial —sujeto a análisis de viabilidad— donde ponemos el activo. Con varias plantas, lo natural es probar uno primero y definir el modelo con datos reales antes de replicar.' }
  ],
  financiamientoDefault: 'Puede estructurarse de dos formas: adquisición directa evaluada por retorno, o esquema de servicio sin inversión inicial, sujeto a un análisis de viabilidad del proyecto. En la llamada vemos cuál se ajusta mejor a tu caso.',

  // ---- CHECKLIST ----
  checklistBase: [
    'Recibos de CFE de los últimos 12 meses (de la planta que elegiste)',
    'Perfil de carga en intervalos de 15 minutos, si lo tienes'
  ],
  checklistRefuerzos: {
    diesel: 'Horas al año que corre tu respaldo de diésel y su costo aproximado',
    paros: 'Historial de paros por causa eléctrica: cuántos y qué costó cada uno',
    horario: 'Desglose de consumo por horario (base, intermedia, punta) de tu recibo GDMTH',
    contrato: 'Estructura de tu contrato de suministro (precio fijo o exposición a precios horarios)',
    techo: 'Superficie de techo o terreno disponible para generación'
  },
  checklistViabilidad: {
    publico: 'Marco de contratación aplicable — si te interesa la estructura de contrato de servicio, conviene identificar bajo qué figura de adquisición puede la entidad contratarlo. Lo revisamos juntos.',
    privado: 'Perfil de la empresa para evaluar el esquema sin inversión — antigüedad y facturación aproximada, solo si te interesa explorar esa vía. Nos permite ver si es viable para tu caso.'
  },
  checklistUniversal: 'Quién decide y umbral de autorización.',
  checklistTitulo: 'Antes de tu llamada, te sirve tener a mano:',
  checklistPie: 'No hace falta tenerlo todo listo — con lo que tengas alcanza para empezar.',

  resultado: { reiniciar: 'Reiniciar diagnóstico' },
  progresoLabel: (n, total) => `Paso ${n} de ${total}`
};

export default content;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS (los tests de contenido pasan; los de engine v1 seguirán fallando hasta Task 2 — está bien, los reescribimos ahí).

Nota: `test/diagnostico.engine.test.js` (v1) queda temporalmente roto porque `content` ya no tiene `reglasA`/`capaC`. Se reescribe en Task 2. Para que este commit no deje el suite rojo, borrar su contenido en este mismo paso y dejar un placeholder:

Replace the entire contents of `test/diagnostico.engine.test.js` with:

```js
import { test } from 'node:test';
// Reescrito en Task 2 (motor v2). Placeholder para mantener el suite verde.
test('placeholder engine v2', () => {});
```

Then run `npm test` again — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/diagnostico.content.js test/diagnostico.content.test.js test/diagnostico.engine.test.js
git commit -m "Diagnostico v2: content (8 pasos, gate, tablas de bloques) + content tests"
```

---

### Task 2: Engine — helpers, `plantaLabel`, Bloque A (`buildProfile`), `toReadable`

**Files:**
- Modify (rewrite): `js/diagnostico.engine.js`
- Modify: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: `content` from Task 1.
- Produces:
  - `matchesWhen(resp, when)` → boolean (helper interno, no exportado obligatoriamente pero usado por todos los blocks).
  - `plantaLabel(resp)` → `'tu operación'` si `resp.sitios === 'uno'`, si no `'esa planta'`.
  - `buildProfile(resp, content)` → string tipo `"Perfil: <sector> [multi-planta] <exposición>."`.
  - `toReadable(resp, content)` → `{ [key]: label }` para las 8 keys.

- [ ] **Step 1: Write the failing tests** — replace the entire contents of `test/diagnostico.engine.test.js` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import content from '../js/diagnostico.content.js';
import { plantaLabel, buildProfile, toReadable } from '../js/diagnostico.engine.js';

// Fixture canónico del spec §5.
const fx = {
  sector: 'manufactura', sitios: 'pocos', generacion: 'fisica', demanda: 'desconoce',
  tarifa: 'gdmth', factura: 'alto', corte: 'reinicio', disparador: 'costo'
};

test('plantaLabel: "tu operación" para un solo sitio, "esa planta" para varios', () => {
  assert.equal(plantaLabel({ sitios: 'uno' }), 'tu operación');
  assert.equal(plantaLabel({ sitios: 'pocos' }), 'esa planta');
  assert.equal(plantaLabel({ sitios: 'muchos' }), 'esa planta');
});

test('buildProfile: fixture arma el perfil esperado', () => {
  assert.equal(buildProfile(fx, content), 'Perfil: manufactura multi-planta con exposición a cargo por demanda.');
});

test('buildProfile: exposición estacional tiene máxima prioridad', () => {
  const r = { sector: 'continuo', sitios: 'uno', generacion: 'estacional', disparador: 'diesel' };
  assert.equal(buildProfile(r, content), 'Perfil: proceso continuo con generación estacional y hueco fuera de temporada.');
});

test('buildProfile: continuo sin estacional usa la exposición de proceso continuo', () => {
  const r = { sector: 'continuo', sitios: 'uno', generacion: 'no', disparador: 'costo' };
  assert.equal(buildProfile(r, content), 'Perfil: proceso continuo de proceso continuo con exposición estructural a horario punta.');
});

test('buildProfile: capacidad y diesel como exposición cuando no hay estacional ni continuo', () => {
  const rc = { sector: 'manufactura', sitios: 'uno', generacion: 'no', disparador: 'capacidad' };
  assert.equal(buildProfile(rc, content), 'Perfil: manufactura con restricción de capacidad eléctrica.');
  const rd = { sector: 'frio', sitios: 'muchos', generacion: 'no', disparador: 'diesel' };
  assert.equal(buildProfile(rd, content), 'Perfil: frío y logística multi-planta con dependencia de diésel.');
});

test('toReadable: mapea códigos a labels visibles', () => {
  const leg = toReadable(fx, content);
  assert.equal(leg.sector, 'Manufactura por turnos o por lotes');
  assert.equal(leg.tarifa, 'GDMTH');
  assert.equal(leg.corte, 'Se detiene producción y reiniciar toma horas');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL ("plantaLabel is not a function" / import inexistente).

- [ ] **Step 3: Write the implementation** — replace the entire contents of `js/diagnostico.engine.js` with:

```js
// Motor de reglas del funnel v2. Funciones puras, sin DOM. Importable en navegador
// y en Node (tests). Lee prioridades, condiciones y copy desde content.js.

// ¿La respuesta cumple todas las igualdades de `when`?
export function matchesWhen(resp, when) {
  return Object.entries(when).every(([campo, valor]) => resp[campo] === valor);
}

// Fraseo de planta: "tu operación" si hay un solo sitio, "esa planta" si hay varios.
export function plantaLabel(resp) {
  return resp.sitios === 'uno' ? 'tu operación' : 'esa planta';
}

// BLOQUE A — línea de perfil.
export function buildProfile(resp, content) {
  const sector = content.perfilSector[resp.sector] || resp.sector;
  const multi = resp.sitios !== 'uno' ? ' multi-planta' : '';
  const exp = content.perfilExposicion.find((r) => matchesWhen(resp, r.when));
  const exposicion = exp ? exp.text : content.perfilExposicionDefault;
  return `Perfil: ${sector}${multi} ${exposicion}.`;
}

// Códigos internos → labels visibles, para las 8 keys.
export function toReadable(resp, content) {
  const legibles = {};
  for (const paso of content.pasos) {
    const opcion = paso.opciones.find((o) => o.codigo === resp[paso.key]);
    legibles[paso.key] = opcion ? opcion.label : resp[paso.key];
  }
  return legibles;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/diagnostico.engine.js test/diagnostico.engine.test.js
git commit -m "Diagnostico v2: engine helpers, plantaLabel, Bloque A (perfil), toReadable"
```

---

### Task 3: Engine — formateadores de dinero + Bloque B (`computeRange`, `renderBlockB`)

**Files:**
- Modify: `js/diagnostico.engine.js`
- Modify: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: `content`, `matchesWhen` from earlier tasks.
- Produces:
  - `roundHalfEven(x, decimals)` → number (redondeo medio-a-par).
  - `formatMoney(n)` → string: `n≥1e6` → `"$X.X millones"`; `n<1e6` → `"$XXX,XXX"` (a la decena de miles).
  - `formatRango(piso, techo)` → string: ambos ≥1M → `"$A a $B millones de MXN al año"`; si no, `"<money> a <money> de MXN al año"`.
  - `computeRange(resp, content)` → `{ sinNumero: null|'nolose'|'privado', piso: number|null, techo: number|null }` (cálculo puro).
  - `renderBlockB(resp, content)` → `{ sinNumero, piso, techo, texto: string, notas: string[] }` (presentación).

- [ ] **Step 1: Write the failing tests** — append to `test/diagnostico.engine.test.js`:

```js
import {
  roundHalfEven, formatMoney, formatRango, computeRange, renderBlockB
} from '../js/diagnostico.engine.js';

test('roundHalfEven: medio-a-par en las fronteras', () => {
  assert.equal(roundHalfEven(2.25, 1), 2.2);   // 2 es par
  assert.equal(roundHalfEven(2.35, 1), 2.4);   // 4 es par
  assert.equal(roundHalfEven(2.18745, 1), 2.2); // no es medio → redondeo normal
  assert.equal(roundHalfEven(4.2, 1), 4.2);
});

test('formatMoney: millones con un decimal; <1M a la decena de miles', () => {
  assert.equal(formatMoney(2500000), '$2.5 millones');
  assert.equal(formatMoney(7000000), '$7.0 millones');
  assert.equal(formatMoney(2250000), '$2.2 millones');
  assert.equal(formatMoney(640000), '$640,000');
  assert.equal(formatMoney(120000), '$120,000');
});

test('formatRango: sufijo "millones" compartido cuando ambos ≥1M', () => {
  assert.equal(formatRango(2250000, 4200000), '$2.2 a $4.2 millones de MXN al año');
  assert.equal(formatRango(640000, 980000), '$640,000 a $980,000 de MXN al año');
});

test('computeRange: fixture da piso 2,250,000 y techo 4,200,000', () => {
  const fx = { sector: 'manufactura', tarifa: 'gdmth', factura: 'alto', disparador: 'costo' };
  const r = computeRange(fx, content);
  assert.equal(r.sinNumero, null);
  assert.equal(r.piso, 2250000);
  assert.equal(r.techo, 4200000);
});

test('computeRange: privado tiene precedencia sobre nolose', () => {
  assert.equal(computeRange({ tarifa: 'privado', factura: 'nolose', sector: 'manufactura' }, content).sinNumero, 'privado');
  assert.equal(computeRange({ tarifa: 'gdmth', factura: 'nolose', sector: 'manufactura' }, content).sinNumero, 'nolose');
});

test('renderBlockB: caso con número incluye cadena, rango exacto y disclaimer', () => {
  const fx = { sector: 'manufactura', tarifa: 'gdmth', factura: 'alto', disparador: 'costo' };
  const b = renderBlockB(fx, content);
  assert.ok(b.texto.includes('$2.5 millones'));
  assert.ok(b.texto.includes('30% y 40%'));
  assert.ok(b.texto.includes('25% y 35%'));
  assert.ok(b.texto.includes('Rango estimado: $2.2 a $4.2 millones de MXN al año.'));
  assert.ok(b.texto.includes('no es una propuesta') || b.texto.includes('no una propuesta'));
  assert.deepEqual(b.notas, []); // disparador=costo → sin nota de diésel
});

test('renderBlockB: sector continuo agrega el extra de arbitraje', () => {
  const r = { sector: 'continuo', tarifa: 'gdmth', factura: 'alto', disparador: 'costo' };
  assert.ok(renderBlockB(r, content).texto.includes('el arbitraje horario suele serlo'));
});

test('renderBlockB: nolose y privado devuelven copy sin número; diésel se suma como nota', () => {
  const nolose = renderBlockB({ sector: 'manufactura', tarifa: 'gdmth', factura: 'nolose', disparador: 'diesel' }, content);
  assert.equal(nolose.sinNumero, 'nolose');
  assert.ok(nolose.texto.startsWith('Para estimar tu ahorro'));
  assert.equal(nolose.notas.length, 1); // nota de diésel se suma
  const privado = renderBlockB({ sector: 'manufactura', tarifa: 'privado', factura: 'alto', disparador: 'costo' }, content);
  assert.equal(privado.sinNumero, 'privado');
  assert.ok(privado.texto.startsWith('Como compras a un suministrador privado'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL ("roundHalfEven is not a function").

- [ ] **Step 3: Write the implementation** — append to `js/diagnostico.engine.js`:

```js
// ---- BLOQUE B: cálculo y formato ----

// Redondeo medio-a-par (banker's), reproduce el fixture del spec.
export function roundHalfEven(x, decimals) {
  const f = 10 ** decimals;
  const n = x * f;
  const floor = Math.floor(n);
  const diff = n - floor;
  const EPS = 1e-9;
  let r;
  if (Math.abs(diff - 0.5) < EPS) r = (floor % 2 === 0) ? floor : floor + 1;
  else r = Math.round(n);
  return r / f;
}

function millonesStr(n) {
  return roundHalfEven(n / 1e6, 1).toFixed(1);
}

export function formatMoney(n) {
  if (n >= 1e6) return `$${millonesStr(n)} millones`;
  const miles = Math.round(n / 10000) * 10000;
  return `$${miles.toLocaleString('en-US')}`;
}

export function formatRango(piso, techo) {
  if (piso >= 1e6 && techo >= 1e6) {
    return `$${millonesStr(piso)} a $${millonesStr(techo)} millones de MXN al año`;
  }
  return `${formatMoney(piso)} a ${formatMoney(techo)} de MXN al año`;
}

// Cálculo puro del rango. privado > nolose en precedencia.
export function computeRange(resp, content) {
  if (resp.tarifa === 'privado') return { sinNumero: 'privado', piso: null, techo: null };
  if (resp.factura === 'nolose') return { sinNumero: 'nolose', piso: null, techo: null };
  const factura = content.tablaFactura[resp.factura];
  const dem = content.tablaDemanda[resp.tarifa];
  const rec = content.tablaRecorte[resp.sector];
  if (factura == null || dem == null || rec == null) {
    return { sinNumero: 'nolose', piso: null, techo: null }; // defensivo
  }
  return {
    sinNumero: null,
    piso: factura * 12 * dem[0] * rec[0],
    techo: factura * 12 * dem[1] * rec[1]
  };
}

// Presentación del bloque B.
export function renderBlockB(resp, content) {
  const b = content.bloqueB;
  const { sinNumero, piso, techo } = computeRange(resp, content);
  const notas = [];
  if (resp.disparador === 'diesel') notas.push(b.dieselNota);

  if (sinNumero === 'privado') return { sinNumero, piso, techo, texto: b.privado, notas };
  if (sinNumero === 'nolose') return { sinNumero, piso, techo, texto: b.noloseFactura, notas };

  const factura = content.tablaFactura[resp.factura];
  const dem = content.tablaDemanda[resp.tarifa];
  const rec = content.tablaRecorte[resp.sector];
  const pct = (x) => Math.round(x * 100);
  const cadena = b.plantilla({
    facturaLegible: formatMoney(factura),
    tarifaLegible: content.tarifaLegible[resp.tarifa],
    pctDemandaPiso: pct(dem[0]), pctDemandaTecho: pct(dem[1]),
    montoDemandaPiso: formatMoney(factura * 12 * dem[0]),
    montoDemandaTecho: formatMoney(factura * 12 * dem[1]),
    pctRecortePiso: pct(rec[0]), pctRecorteTecho: pct(rec[1])
  });
  let texto = `${cadena}\n\n${b.rango(formatRango(piso, techo))}\n\n${b.disclaimer}`;
  if (resp.sector === 'continuo') texto += `\n\n${b.continuoExtra}`;
  return { sinNumero: null, piso, techo, texto, notas };
}
```

Note: el test de disclaimer chequea la subcadena "no una propuesta" (presente en el disclaimer del content: "...no una propuesta.").

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/diagnostico.engine.js test/diagnostico.engine.test.js
git commit -m "Diagnostico v2: Bloque B (rango con aritmética visible, redondeo medio-a-par)"
```

---

### Task 4: Engine — Bloque C (`pickLevers`)

**Files:**
- Modify: `js/diagnostico.engine.js`
- Modify: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: `content`, `matchesWhen`.
- Produces: `pickLevers(resp, content)` → `{ gancho: string|null, principal: {nombre, text}, secundaria: {nombre, text}|null, descartada: {nombre, text}|null }`. Secundaria excluye la palanca que ganó como principal (por `id`).

- [ ] **Step 1: Write the failing tests** — append to `test/diagnostico.engine.test.js`:

```js
import { pickLevers } from '../js/diagnostico.engine.js';

test('pickLevers: fixture → gancho + Recorte de demanda + Continuidad de proceso + Solar', () => {
  const l = pickLevers(fx, content);
  assert.equal(l.gancho, content.gancho); // demanda=desconoce
  assert.equal(l.principal.nombre, 'Recorte de demanda');
  assert.equal(l.secundaria.nombre, 'Continuidad de proceso');
  assert.equal(l.descartada.nombre, 'Solar');
});

test('pickLevers: sin gancho cuando demanda=mide', () => {
  assert.equal(pickLevers({ ...fx, demanda: 'mide' }, content).gancho, null);
});

test('pickLevers: principal por precedencia (estacional > diesel > capacidad > continuo)', () => {
  assert.equal(pickLevers({ ...fx, generacion: 'estacional', disparador: 'diesel' }, content).principal.nombre, 'Cobertura fuera de temporada');
  assert.equal(pickLevers({ ...fx, generacion: 'no', disparador: 'diesel' }, content).principal.nombre, 'Sustitución de diésel');
  assert.equal(pickLevers({ ...fx, generacion: 'no', disparador: 'capacidad' }, content).principal.nombre, 'Diferimiento de capacidad');
  assert.equal(pickLevers({ ...fx, sector: 'continuo', generacion: 'no', disparador: 'costo' }, content).principal.nombre, 'Arbitraje horario');
});

test('pickLevers: secundaria excluye la que ganó como principal', () => {
  // continuo gana principal (Arbitraje horario); la secundaria continuo NO debe repetirse.
  const r = { ...fx, sector: 'continuo', generacion: 'no', corte: 'nada', disparador: 'costo' };
  const l = pickLevers(r, content);
  assert.equal(l.principal.nombre, 'Arbitraje horario');
  assert.equal(l.secundaria, null); // no hay corte útil y continuo ya fue principal
});

test('pickLevers: sin secundaria ni descartada aplicables → null', () => {
  const r = { sector: 'manufactura', sitios: 'uno', generacion: 'no', demanda: 'mide', tarifa: 'gdmth', factura: 'alto', corte: 'nada', disparador: 'excedente' };
  const l = pickLevers(r, content);
  assert.equal(l.principal.nombre, 'Arbitraje de excedente');
  assert.equal(l.secundaria, null);
  assert.equal(l.descartada, null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL ("pickLevers is not a function").

- [ ] **Step 3: Write the implementation** — append to `js/diagnostico.engine.js`:

```js
// ---- BLOQUE C: palancas jerarquizadas ----
const pick = (r) => (r ? { nombre: r.nombre, text: r.text } : null);

export function pickLevers(resp, content) {
  const gancho = (resp.demanda === 'desconoce' || resp.demanda === 'visto') ? content.gancho : null;
  const principalRule = content.palancasPrincipal.find((r) => matchesWhen(resp, r.when)) || content.palancaPrincipalDefault;
  const secundariaRule = content.palancasSecundaria.find((r) => matchesWhen(resp, r.when) && r.id !== principalRule.id) || null;
  const descartadaRule = content.palancasDescartada.find((r) => matchesWhen(resp, r.when)) || null;
  return {
    gancho,
    principal: pick(principalRule),
    secundaria: pick(secundariaRule),
    descartada: pick(descartadaRule)
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/diagnostico.engine.js test/diagnostico.engine.test.js
git commit -m "Diagnostico v2: Bloque C (palancas principal/secundaria/descartada)"
```

---

### Task 5: Engine — Bloque D (`pickMissingData`)

**Files:**
- Modify: `js/diagnostico.engine.js`
- Modify: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: `content`, `matchesWhen`.
- Produces: `pickMissingData(resp, content)` → `{ dato: string, cierre: string }`. Precedencia: reglas de igualdad de `content.datoFaltante` (en orden) → si ninguna y `corte != 'nada'` → `datoFaltanteCorte` → default.

- [ ] **Step 1: Write the failing tests** — append to `test/diagnostico.engine.test.js`:

```js
import { pickMissingData } from '../js/diagnostico.engine.js';

test('pickMissingData: fixture (corte=reinicio, sin señales de igualdad) → regla corte!=nada', () => {
  const d = pickMissingData(fx, content);
  assert.equal(d.dato, content.datoFaltanteCorte);
  assert.equal(d.cierre, content.cierreComun);
});

test('pickMissingData: precedencia de igualdad sobre corte!=nada', () => {
  assert.equal(pickMissingData({ ...fx, factura: 'nolose' }, content).dato, content.datoFaltante[0].text);
  assert.equal(pickMissingData({ ...fx, tarifa: 'privado' }, content).dato, content.datoFaltante[1].text);
  assert.equal(pickMissingData({ ...fx, disparador: 'diesel' }, content).dato, content.datoFaltante[2].text);
  assert.equal(pickMissingData({ ...fx, sector: 'continuo' }, content).dato, content.datoFaltante[3].text);
});

test('pickMissingData: default cuando corte=nada y sin señales', () => {
  const r = { sector: 'manufactura', tarifa: 'gdmth', factura: 'alto', disparador: 'costo', corte: 'nada' };
  assert.equal(pickMissingData(r, content).dato, content.datoFaltanteDefault);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL ("pickMissingData is not a function").

- [ ] **Step 3: Write the implementation** — append to `js/diagnostico.engine.js`:

```js
// ---- BLOQUE D: el dato que falta ----
export function pickMissingData(resp, content) {
  const eq = content.datoFaltante.find((r) => matchesWhen(resp, r.when));
  let dato;
  if (eq) dato = eq.text;
  else if (resp.corte !== 'nada') dato = content.datoFaltanteCorte;
  else dato = content.datoFaltanteDefault;
  return { dato, cierre: content.cierreComun };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/diagnostico.engine.js test/diagnostico.engine.test.js
git commit -m "Diagnostico v2: Bloque D (dato faltante, corte!=nada > default)"
```

---

### Task 6: Engine — Bloque E (`pickFinancing`, `ofreceServicio`)

**Files:**
- Modify: `js/diagnostico.engine.js`
- Modify: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: `content`, `matchesWhen`.
- Produces:
  - `ofreceServicio(resp)` → boolean = `resp.factura !== 'muyalto'`.
  - `pickFinancing(resp, content)` → string (copy del bloque E; primera regla que aplique, o default).

- [ ] **Step 1: Write the failing tests** — append to `test/diagnostico.engine.test.js`:

```js
import { pickFinancing, ofreceServicio } from '../js/diagnostico.engine.js';

test('ofreceServicio: true salvo factura=muyalto', () => {
  assert.equal(ofreceServicio({ factura: 'alto' }), true);
  assert.equal(ofreceServicio({ factura: 'muyalto' }), false);
});

test('pickFinancing: fixture (sitios=pocos) → copy multi-planta (dos caminos)', () => {
  const t = pickFinancing(fx, content);
  assert.ok(t.startsWith('Hay dos caminos'));
  assert.ok(t.includes('sujeto a análisis de viabilidad'));
});

test('pickFinancing: precedencia publico > ev > muyalto > sitios', () => {
  assert.ok(pickFinancing({ ...fx, sector: 'publico' }, content).startsWith('Para entidades públicas'));
  assert.ok(pickFinancing({ ...fx, sector: 'ev' }, content).startsWith('Existe la opción'));
  assert.ok(pickFinancing({ ...fx, sector: 'manufactura', sitios: 'uno', factura: 'muyalto' }, content).startsWith('A tu escala'));
});

test('pickFinancing: default cuando un solo sitio y sin segmento especial', () => {
  const r = { sector: 'manufactura', sitios: 'uno', factura: 'alto' };
  assert.equal(pickFinancing(r, content), content.financiamientoDefault);
});

test('pickFinancing: nunca usa lenguaje de promesa prohibido', () => {
  const prohibido = /cero riesgo|el ahorro empieza el primer mes/i;
  const todos = [...content.financiamiento.map((r) => r.text), content.financiamientoDefault];
  for (const t of todos) assert.ok(!prohibido.test(t), `promesa prohibida: ${t}`);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL ("pickFinancing is not a function").

- [ ] **Step 3: Write the implementation** — append to `js/diagnostico.engine.js`:

```js
// ---- BLOQUE E: financiamiento (opción sujeta a evaluación) ----
export function ofreceServicio(resp) {
  return resp.factura !== 'muyalto';
}

export function pickFinancing(resp, content) {
  const regla = content.financiamiento.find((r) => matchesWhen(resp, r.when));
  return regla ? regla.text : content.financiamientoDefault;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/diagnostico.engine.js test/diagnostico.engine.test.js
git commit -m "Diagnostico v2: Bloque E (financiamiento sujeto a evaluación)"
```

---

### Task 7: Engine — `buildChecklist`

**Files:**
- Modify: `js/diagnostico.engine.js`
- Modify: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: `content`, `ofreceServicio`.
- Produces: `buildChecklist(resp, content)` → `{ web: string[], full: string[] }`.
  - Técnicos (orden = prioridad): base (2) + diesel? + paros(`corte!='nada'`)? + horario(`sector='continuo'`)? + contrato(`tarifa='privado'`)? + techo(`generacion='estacional'`)?
  - Viabilidad (solo si `ofreceServicio`): `publico` si `sector='publico'`, si no `privado`.
  - `full` = técnicos + [viabilidad?] + universal.
  - `web` = `técnicos.slice(0,4)`; si viabilidad y `técnicos.length<4` → push viabilidad; + universal.

- [ ] **Step 1: Write the failing tests** — append to `test/diagnostico.engine.test.js`:

```js
import { buildChecklist } from '../js/diagnostico.engine.js';

test('buildChecklist: fixture → CFE + carga + paros + viabilidad(privado) + universal', () => {
  const { web, full } = buildChecklist(fx, content);
  assert.deepEqual(web, [
    content.checklistBase[0],
    content.checklistBase[1],
    content.checklistRefuerzos.paros,
    content.checklistViabilidad.privado,
    content.checklistUniversal
  ]);
  assert.deepEqual(full, web); // 3 técnicos + viabilidad + universal, sin recorte
});

test('buildChecklist: recorta viabilidad de la web cuando ya hay 4 técnicos', () => {
  // diesel + paros + horario + contrato + techo = 5 técnicos (con base son 7)
  const r = { sector: 'continuo', generacion: 'estacional', tarifa: 'privado', corte: 'reinicio', disparador: 'diesel', factura: 'alto' };
  const { web, full } = buildChecklist(r, content);
  assert.equal(web.length, 5); // 4 técnicos + universal (viabilidad recortada)
  assert.equal(web[web.length - 1], content.checklistUniversal);
  assert.ok(!web.includes(content.checklistViabilidad.privado));
  assert.ok(full.includes(content.checklistViabilidad.privado)); // full la conserva
  assert.equal(full[full.length - 1], content.checklistUniversal);
});

test('buildChecklist: sin viabilidad cuando factura=muyalto', () => {
  const r = { sector: 'manufactura', generacion: 'no', tarifa: 'gdmth', corte: 'nada', disparador: 'costo', factura: 'muyalto' };
  const { full } = buildChecklist(r, content);
  assert.ok(!full.includes(content.checklistViabilidad.privado));
  assert.ok(!full.includes(content.checklistViabilidad.publico));
  assert.equal(full[full.length - 1], content.checklistUniversal);
});

test('buildChecklist: viabilidad publico para sector publico', () => {
  const r = { sector: 'publico', generacion: 'no', tarifa: 'gdmth', corte: 'nada', disparador: 'costo', factura: 'alto' };
  assert.ok(buildChecklist(r, content).full.includes(content.checklistViabilidad.publico));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL ("buildChecklist is not a function").

- [ ] **Step 3: Write the implementation** — append to `js/diagnostico.engine.js`:

```js
// ---- CHECKLIST ----
export function buildChecklist(resp, content) {
  const ref = content.checklistRefuerzos;
  const tecnicos = [...content.checklistBase];
  if (resp.disparador === 'diesel') tecnicos.push(ref.diesel);
  if (resp.corte !== 'nada') tecnicos.push(ref.paros);
  if (resp.sector === 'continuo') tecnicos.push(ref.horario);
  if (resp.tarifa === 'privado') tecnicos.push(ref.contrato);
  if (resp.generacion === 'estacional') tecnicos.push(ref.techo);

  const viabilidad = ofreceServicio(resp)
    ? (resp.sector === 'publico' ? content.checklistViabilidad.publico : content.checklistViabilidad.privado)
    : null;

  const full = [...tecnicos, ...(viabilidad ? [viabilidad] : []), content.checklistUniversal];

  const webContent = tecnicos.slice(0, 4);
  if (viabilidad && webContent.length < 4) webContent.push(viabilidad);
  const web = [...webContent, content.checklistUniversal];

  return { web, full };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/diagnostico.engine.js test/diagnostico.engine.test.js
git commit -m "Diagnostico v2: buildChecklist (viabilidad low-priority, tope web 4)"
```

---

### Task 8: Engine — `buildEventNote`, `assembleResult`, fixture end-to-end + contrato del lead

**Files:**
- Modify: `js/diagnostico.engine.js`
- Modify: `test/diagnostico.engine.test.js`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - `buildEventNote(res, resp, content)` → string (nota del evento cal.diy: perfil, bloque B + notas, palancas, dato faltante + cierre, financiamiento, checklist **full**, 8 respuestas crudas).
  - `assembleResult(estado, content)` → `{ perfil, bloqueB, palancas, datoFaltante, financiamiento, checklist, note, leadPayload }` donde `estado = { respuestas, contacto: {nombre, empresa, correo, telefono, rol} }`.
  - `leadPayload` keys: `lead_id, timestamp, nombre, empresa, correo, telefono, rol, respuestas_legibles, respuestas_codigos, perfil, rango_texto, checklist_full`.

- [ ] **Step 1: Write the failing tests** — append to `test/diagnostico.engine.test.js`:

```js
import { assembleResult, buildEventNote } from '../js/diagnostico.engine.js';

const estadoFx = {
  respuestas: { ...fx },
  contacto: { nombre: 'Ana', empresa: 'Acme', correo: 'ana@acme.mx', telefono: '5555', rol: 'Finanzas' }
};

test('assembleResult: fixture end-to-end (spec §5)', () => {
  const res = assembleResult(estadoFx, content);
  assert.equal(res.perfil, 'Perfil: manufactura multi-planta con exposición a cargo por demanda.');
  assert.equal(res.bloqueB.piso, 2250000);
  assert.equal(res.bloqueB.techo, 4200000);
  assert.ok(res.bloqueB.texto.includes('Rango estimado: $2.2 a $4.2 millones de MXN al año.'));
  assert.equal(res.palancas.principal.nombre, 'Recorte de demanda');
  assert.equal(res.palancas.secundaria.nombre, 'Continuidad de proceso');
  assert.equal(res.palancas.descartada.nombre, 'Solar');
  assert.equal(res.datoFaltante.dato, content.datoFaltanteCorte);
  assert.ok(res.financiamiento.startsWith('Hay dos caminos'));
  assert.equal(res.checklist.web[res.checklist.web.length - 1], content.checklistUniversal);
});

test('assembleResult: leadPayload expone las keys que consume /api/lead', () => {
  const p = assembleResult(estadoFx, content).leadPayload;
  const esperadas = ['lead_id', 'timestamp', 'nombre', 'empresa', 'correo', 'telefono', 'rol',
    'respuestas_legibles', 'respuestas_codigos', 'perfil', 'rango_texto', 'checklist_full'];
  for (const k of esperadas) assert.ok(k in p, `falta ${k}`);
  assert.equal(p.nombre, 'Ana');
  assert.equal(p.rol, 'Finanzas');
  assert.equal(p.rango_texto, '$2.2 a $4.2 millones de MXN al año');
  assert.equal(p.respuestas_legibles.sector, 'Manufactura por turnos o por lotes');
  for (const paso of content.pasos) {
    assert.equal(typeof p.respuestas_legibles[paso.key], 'string', `falta legible ${paso.key}`);
  }
  assert.ok(Array.isArray(p.checklist_full));
  assert.ok(JSON.stringify(p).length < 8000, 'payload demasiado grande');
});

test('leadPayload.rango_texto: mensajes sin número para privado y nolose', () => {
  const priv = assembleResult({ respuestas: { ...fx, tarifa: 'privado' }, contacto: {} }, content).leadPayload;
  assert.match(priv.rango_texto, /privado/i);
  const nol = assembleResult({ respuestas: { ...fx, factura: 'nolose' }, contacto: {} }, content).leadPayload;
  assert.match(nol.rango_texto, /sin/i);
});

test('buildEventNote: incluye perfil, checklist completo y las 8 respuestas', () => {
  const res = assembleResult(estadoFx, content);
  const note = res.note;
  assert.ok(note.includes(res.perfil));
  assert.ok(note.includes(content.checklistUniversal));
  assert.ok(note.includes(content.checklistViabilidad.privado)); // full, sin recorte
  // 8 respuestas crudas (una por notaLabel)
  for (const paso of content.pasos) assert.ok(note.includes(paso.notaLabel), `falta ${paso.notaLabel} en la nota`);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL ("assembleResult is not a function").

- [ ] **Step 3: Write the implementation** — append to `js/diagnostico.engine.js`:

```js
// ---- Nota del evento cal.diy (texto plano, sin recorte) ----
export function buildEventNote(res, resp, content) {
  const p = res.palancas;
  const palancasLines = [
    'Palancas:',
    ...(p.gancho ? [p.gancho] : []),
    `Principal — ${p.principal.nombre}: ${p.principal.text}`,
    ...(p.secundaria ? [`Secundaria — ${p.secundaria.nombre}: ${p.secundaria.text}`] : []),
    ...(p.descartada ? [`No aplica — ${p.descartada.nombre}: ${p.descartada.text}`] : [])
  ];
  const legibles = res.leadPayload.respuestas_legibles;
  return [
    'Diagnóstico Mexillum',
    '',
    res.perfil,
    '',
    res.bloqueB.texto,
    ...res.bloqueB.notas.map((n) => `\n${n}`),
    '',
    ...palancasLines,
    '',
    res.datoFaltante.dato,
    res.datoFaltante.cierre,
    '',
    res.financiamiento,
    '',
    'Preparar para la llamada:',
    ...res.checklist.full.map((b) => `• ${b}`),
    '',
    'Respuestas del formulario:',
    ...content.pasos.map((paso, i) => `${i + 1}. ${paso.notaLabel}: ${legibles[paso.key]}`)
  ].join('\n');
}

// ---- Orquestador ----
export function assembleResult(estado, content) {
  const resp = estado.respuestas;
  const contacto = estado.contacto || {};
  const perfil = buildProfile(resp, content);
  const bloqueB = renderBlockB(resp, content);
  const palancas = pickLevers(resp, content);
  const datoFaltante = pickMissingData(resp, content);
  const financiamiento = pickFinancing(resp, content);
  const checklist = buildChecklist(resp, content);
  const legibles = toReadable(resp, content);

  const rango_texto = bloqueB.sinNumero
    ? (bloqueB.sinNumero === 'privado'
        ? 'Suministrador privado — sin rango numérico'
        : 'Factura sin especificar — sin rango numérico')
    : formatRango(bloqueB.piso, bloqueB.techo);

  const leadPayload = {
    lead_id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
    timestamp: new Date().toISOString(),
    nombre: contacto.nombre || '',
    empresa: contacto.empresa || '',
    correo: contacto.correo || '',
    telefono: contacto.telefono || '',
    rol: contacto.rol || '',
    respuestas_legibles: legibles,
    respuestas_codigos: { ...resp },
    perfil,
    rango_texto,
    checklist_full: checklist.full
  };

  const res = { perfil, bloqueB, palancas, datoFaltante, financiamiento, checklist, leadPayload };
  res.note = buildEventNote(res, resp, content);
  return res;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS (todo el suite verde).

- [ ] **Step 5: Commit**

```bash
git add js/diagnostico.engine.js test/diagnostico.engine.test.js
git commit -m "Diagnostico v2: assembleResult + nota del evento + fixture end-to-end"
```

---

### Task 9: `api/lead.js` — 8 keys + rol, encabezado perfil + rango (sin score/booking)

**Files:**
- Modify (rewrite): `api/lead.js`

**Interfaces:**
- Consumes (del body POST): `nombre, correo, empresa, telefono, rol, respuestas_legibles` (8 keys), `respuestas_codigos`, `perfil`, `rango_texto`, `checklist_full`, `lead_id`, honeypot `website`.

- [ ] **Step 1: Verify current behavior** — read `api/lead.js` to confirm structure (Resend REST, honeypot `website`, `EMAIL_RE`, `clean`, `esc`). No hay tests para este archivo (hace red network); la verificación es `node --check` + revisión contra el contrato del payload.

- [ ] **Step 2: Write the implementation** — replace the entire contents of `api/lead.js` with:

```js
// Vercel serverless function — recibe el payload del funnel de diagnóstico v2 y envía
// el lead por email vía Resend. Se dispara una sola vez desde js/diagnostico.view.js
// al enviar el gate de contacto (antes de cualquier reserva).
// Requiere env var RESEND_API_KEY. Opcional: LEAD_TO, LEAD_FROM.
// Sin deps npm: usa fetch nativo (Node 18+).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// Etiquetas visibles de cada paso del funnel v2, en orden.
const PREGUNTAS = [
  ['sector', 'Sector / operación'],
  ['sitios', 'Instalaciones'],
  ['generacion', 'Generación propia'],
  ['demanda', 'Conoce el cargo por demanda'],
  ['tarifa', 'Tarifa CFE'],
  ['factura', 'Factura mensual'],
  ['corte', 'Impacto de un corte'],
  ['disparador', 'Disparador'],
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot: usuarios reales nunca lo llenan.
  if (body.website) return res.status(200).json({ ok: true });

  const nombre = clean(body.nombre, 120);
  const correo = clean(body.correo, 160);
  const empresa = clean(body.empresa, 120);
  const telefono = clean(body.telefono, 40);
  const rol = clean(body.rol, 60);

  if (!nombre || !EMAIL_RE.test(correo)) {
    return res.status(400).json({ error: 'Datos incompletos o inválidos.' });
  }

  const legibles = (body.respuestas_legibles && typeof body.respuestas_legibles === 'object') ? body.respuestas_legibles : {};
  const codigos = (body.respuestas_codigos && typeof body.respuestas_codigos === 'object') ? body.respuestas_codigos : {};
  const perfil = clean(body.perfil, 200) || '—';
  const rangoTexto = clean(body.rango_texto, 120) || '—';
  const leadId = clean(body.lead_id, 64);

  const checklist = Array.isArray(body.checklist_full)
    ? body.checklist_full.slice(0, 12).map((b) => clean(b, 240)).filter(Boolean)
    : [];

  const respuestas = PREGUNTAS.map(([key, label]) => {
    const visible = clean(legibles[key], 240);
    const codigo = clean(codigos[key], 40);
    return { label, visible: visible || codigo || '—' };
  });

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO || 'info@mexillum.com';
  const from = process.env.LEAD_FROM || 'Mexillum Web <notificaciones@mexillum.com>';
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'Config del servidor incompleta.' });
  }

  const quien = empresa ? `${nombre} — ${empresa}` : nombre;
  const subject = `Diagnóstico — ${quien}`;

  const text = [
    'Nuevo diagnóstico completado',
    '',
    `Nombre:   ${nombre}`,
    `Empresa:  ${empresa || '—'}`,
    `Correo:   ${correo}`,
    `Teléfono: ${telefono || '—'}`,
    `Rol:      ${rol || '—'}`,
    '',
    perfil,
    `Rango estimado: ${rangoTexto}`,
    '',
    'Respuestas:',
    ...respuestas.map((r, i) => `${i + 1}. ${r.label}: ${r.visible}`),
    checklist.length ? '' : null,
    checklist.length ? 'Checklist para la llamada:' : null,
    ...checklist.map((b) => `• ${b}`),
    '',
    leadId ? `lead_id: ${leadId}` : null,
  ].filter((l) => l !== null).join('\n');

  const fila = (k, v) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#6F796E;vertical-align:top">${esc(k)}</td>` +
    `<td style="padding:6px 0"><strong>${esc(v)}</strong></td></tr>`;

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#16221A;max-width:560px">` +
    `<h2 style="margin:0 0 4px;font-size:18px;color:#080A08">Nuevo diagnóstico completado</h2>` +
    `<p style="margin:0 0 16px;font-size:13px;color:#1F7A3D"><strong>${esc(perfil)}</strong><br>` +
    `Rango estimado: <strong>${esc(rangoTexto)}</strong></p>` +

    `<table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">` +
    fila('Nombre', nombre) +
    fila('Empresa', empresa || '—') +
    `<tr><td style="padding:6px 16px 6px 0;color:#6F796E">Correo</td>` +
    `<td style="padding:6px 0"><a href="mailto:${esc(correo)}">${esc(correo)}</a></td></tr>` +
    (telefono ? fila('Teléfono', telefono) : '') +
    (rol ? fila('Rol', rol) : '') +
    `</table>` +

    `<h3 style="margin:0 0 8px;font-size:14px;color:#080A08">Respuestas del diagnóstico</h3>` +
    `<table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">` +
    respuestas.map((r) =>
      `<tr><td style="padding:6px 16px 6px 0;color:#6F796E;vertical-align:top">${esc(r.label)}</td>` +
      `<td style="padding:6px 0">${esc(r.visible)}</td></tr>`
    ).join('') +
    `</table>` +

    (checklist.length
      ? `<h3 style="margin:0 0 8px;font-size:14px;color:#080A08">Checklist para la llamada</h3>` +
        `<ul style="margin:0 0 20px;padding-left:18px;font-size:14px">` +
        checklist.map((b) => `<li style="margin-bottom:4px">${esc(b)}</li>`).join('') +
        `</ul>`
      : '') +

    `<p style="margin:20px 0 0;font-size:12px;color:#9AA398">` +
    `Enviado desde el diagnóstico de mexillum.com${leadId ? ` · lead_id ${esc(leadId)}` : ''}</p>` +
    `</div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, reply_to: correo, subject, text, html }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('Resend error', r.status, detail);
      return res.status(502).json({ error: 'No se pudo enviar la solicitud.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('lead handler error', err);
    return res.status(502).json({ error: 'No se pudo enviar la solicitud.' });
  }
}
```

- [ ] **Step 3: Verify syntax**

Run: `node --check api/lead.js`
Expected: sin salida (exit 0).

- [ ] **Step 4: Commit**

```bash
git add api/lead.js
git commit -m "Diagnostico v2: api/lead con 8 keys + rol, encabezado perfil + rango (sin score)"
```

---

### Task 10: `view.js` — intro, 8 pasos con {planta}, gate, resultado A–E; + `index.html` meta

**Files:**
- Modify (rewrite): `js/diagnostico.view.js`
- Modify: `diagnostico/index.html` (solo `meta description`)

**Interfaces:**
- Consumes: `content`, `assembleResult` (que expone `.note` y `.leadPayload`).
- Estados de `estado.paso`: `'intro'` → `0..7` (pasos) → `'gate'` → `'result'`.

- [ ] **Step 1: Update `index.html` meta description**

En `diagnostico/index.html`, reemplazar la línea:

```html
<meta name="description" content="En 6 preguntas, un diagnóstico de tu perfil energético y los datos que conviene preparar para tu llamada con Mexillum.">
```

por:

```html
<meta name="description" content="En 8 preguntas, un diagnóstico de tu perfil energético, un rango estimado de ahorro y los datos que conviene preparar para tu llamada con Mexillum.">
```

- [ ] **Step 2: Write the implementation** — replace the entire contents of `js/diagnostico.view.js` with:

```js
import content from './diagnostico.content.js';
import { assembleResult, plantaLabel } from './diagnostico.engine.js';

const root = document.getElementById('dx-root');

// Instancia self-hosted de cal.diy y el event type para la llamada.
const CAL_ORIGIN = 'https://cal.mexillum.com';
const CAL_LINK = 'dlucca/30min';

const estado = {
  paso: 'intro',            // 'intro' | 0..7 | 'gate' | 'result'
  respuestas: {},
  contacto: {},
  resultado: null           // cache del assembleResult tras el gate
};

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Sustituye {planta} en un prompt según el número de sitios.
function withPlanta(texto) {
  return texto.replace('{planta}', plantaLabel(estado.respuestas));
}

// Lleva el foco al encabezado de la vista nueva.
function focusMain() {
  window.scrollTo(0, 0);
  const h = root.querySelector('[data-dx-focus]');
  if (h) h.focus({ preventScroll: true });
}

// ---- Pantalla 0: intro --------------------------------------------------------
function renderIntro() {
  const view = el(`
    <div class="dx__view">
      <h2 class="dx__question" data-dx-focus tabindex="-1">${esc(content.intro.titulo)}</h2>
      <p>${esc(content.intro.cuerpo)}</p>
      <p class="dx__close">${esc(content.intro.pie)}</p>
      <div class="dx__nav">
        <button type="button" class="mx-btn mx-btn--primary" data-act="empezar">${esc(content.intro.cta)}</button>
      </div>
    </div>`);
  view.querySelector('[data-act="empezar"]').addEventListener('click', () => {
    estado.paso = 0;
    render();
  });
  root.replaceChildren(view);
  focusMain();
}

// ---- Pasos --------------------------------------------------------------------
function renderStep() {
  const idx = estado.paso;
  const paso = content.pasos[idx];
  const pregunta = withPlanta(paso.pregunta);

  const opcionesHtml = paso.opciones.map((o) => {
    const on = estado.respuestas[paso.key] === o.codigo;
    return `
      <button type="button" class="dx__option" data-codigo="${esc(o.codigo)}" role="radio" aria-checked="${on}" tabindex="-1">
        <span class="mx-check">
          <span class="mx-check__box mx-check__box--radio ${on ? 'mx-check__box--on' : ''}">
            ${on ? '<span class="mx-check__dot"></span>' : ''}
          </span>
          <span>${esc(o.label)}</span>
        </span>
      </button>`;
  }).join('');

  const hintHtml = paso.hint ? `<p class="dx__col-sub">${esc(paso.hint)}</p>` : '';
  const atras = '<button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>';

  const view = el(`
    <div class="dx__view">
      <p class="dx__progress">${esc(content.progresoLabel(idx + 1, content.pasos.length))}</p>
      <h2 class="dx__question" data-dx-focus tabindex="-1">${esc(pregunta)}</h2>
      ${hintHtml}
      <div class="dx__options" role="radiogroup" aria-label="${esc(pregunta)}">${opcionesHtml}</div>
      <div class="dx__nav dx__nav--end">
        ${atras}
        <button type="button" class="mx-btn mx-btn--primary" data-act="siguiente" disabled>Siguiente</button>
      </div>
    </div>`);

  const options = [...view.querySelectorAll('.dx__option')];
  const siguiente = view.querySelector('[data-act="siguiente"]');

  function paint() {
    const elegido = estado.respuestas[paso.key];
    options.forEach((btn) => {
      const on = elegido === btn.dataset.codigo;
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
      const box = btn.querySelector('.mx-check__box');
      box.classList.toggle('mx-check__box--on', on);
      let dot = box.querySelector('.mx-check__dot');
      if (on && !dot) { dot = document.createElement('span'); dot.className = 'mx-check__dot'; box.appendChild(dot); }
      else if (!on && dot) { dot.remove(); }
    });
    if (!elegido && options[0]) options[0].tabIndex = 0;
    siguiente.disabled = !elegido;
  }

  function select(btn) {
    estado.respuestas[paso.key] = btn.dataset.codigo;
    paint();
    btn.focus();
  }

  options.forEach((btn, i) => {
    btn.addEventListener('click', () => select(btn));
    btn.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % options.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + options.length) % options.length;
      if (next !== null) { e.preventDefault(); select(options[next]); }
    });
  });

  view.querySelector('[data-act="atras"]').addEventListener('click', () => {
    if (estado.paso === 0) estado.paso = 'intro';
    else estado.paso -= 1;
    render();
  });
  siguiente.addEventListener('click', () => {
    if (!estado.respuestas[paso.key]) return;
    if (estado.paso < content.pasos.length - 1) estado.paso += 1;
    else estado.paso = 'gate';
    render();
  });

  paint();
  root.replaceChildren(view);
  focusMain();
}

// ---- Gate de contacto ---------------------------------------------------------
function renderGate() {
  const camposHtml = content.gate.campos.map((c) => {
    const req = c.required ? ' <span aria-hidden="true">*</span>' : '';
    const control = c.type === 'select'
      ? `<select class="mx-select" id="gate-${c.key}" name="${c.key}">
           <option value="">—</option>
           ${c.opciones.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
         </select>`
      : `<input class="mx-input" id="gate-${c.key}" name="${c.key}" type="${c.type}"
           autocomplete="${c.autocomplete}" ${c.required ? 'required' : ''}>`;
    return `
      <div class="mx-field">
        <label class="mx-field__label" for="gate-${c.key}">${esc(c.label)}${req}</label>
        ${control}
      </div>`;
  }).join('');

  const view = el(`
    <div class="dx__view">
      <h2 class="dx__question" data-dx-focus tabindex="-1">${esc(content.gate.titulo)}</h2>
      <p>${esc(content.gate.cuerpo)}</p>
      <form class="dx__options" novalidate>
        ${camposHtml}
        <input type="text" name="website" tabindex="-1" autocomplete="off"
          style="position:absolute;left:-9999px" aria-hidden="true">
        <p class="mx-field__error" data-gate-error hidden></p>
        <div class="dx__nav dx__nav--end">
          <button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>
          <button type="submit" class="mx-btn mx-btn--primary">${esc(content.gate.cta)}</button>
        </div>
      </form>
    </div>`);

  const form = view.querySelector('form');
  const error = view.querySelector('[data-gate-error]');

  view.querySelector('[data-act="atras"]').addEventListener('click', () => {
    estado.paso = content.pasos.length - 1;
    render();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (form.website.value) return; // honeypot
    const nombre = form.nombre.value.trim();
    const correo = form.correo.value.trim();
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!nombre || !EMAIL_RE.test(correo)) {
      error.textContent = 'Necesitamos tu nombre y un email válido.';
      error.hidden = false;
      return;
    }
    estado.contacto = {
      nombre,
      empresa: form.empresa.value.trim(),
      correo,
      telefono: form.telefono.value.trim(),
      rol: form.rol.value
    };
    estado.resultado = assembleResult(estado, content);
    submitLead(estado.resultado.leadPayload); // único envío del lead
    estado.paso = 'result';
    render();
  });

  root.replaceChildren(view);
  focusMain();
}

// ---- Integración cal.diy (embed inline) --------------------------------------
function loadCal() {
  if (window.Cal) return;
  (function (C, A, L) {
    let p = function (a, ar) { a.q.push(ar); };
    let d = C.document;
    C.Cal = C.Cal || function () {
      let cal = C.Cal; let ar = arguments;
      if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; }
      if (ar[0] === L) {
        const api = function () { p(api, arguments); };
        const namespace = ar[1];
        api.q = api.q || [];
        if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); } else p(cal, ar);
        return;
      }
      p(cal, ar);
    };
  })(window, CAL_ORIGIN + '/embed/embed.js', 'init');
  window.Cal('init', { origin: CAL_ORIGIN });
}

function mountCal(selector, res) {
  loadCal();
  window.Cal('inline', {
    elementOrSelector: selector,
    calLink: CAL_LINK,
    layout: 'month_view',
    config: {
      notes: res.note,
      name: estado.contacto.nombre || '',
      email: estado.contacto.correo || '',
      theme: 'light'
    }
  });
  window.Cal('ui', { layout: 'month_view', hideEventTypeDetails: false });
}

// ---- Pantalla final: diagnóstico (A–E) + agenda ------------------------------
function renderResult() {
  const res = estado.resultado || assembleResult(estado, content);
  const p = res.palancas;

  const bloqueBHtml = [res.bloqueB.texto, ...res.bloqueB.notas]
    .map((t) => `<p>${esc(t).replace(/\n\n/g, '</p><p>')}</p>`).join('');

  const palancasHtml = [
    p.gancho ? `<p><em>${esc(p.gancho)}</em></p>` : '',
    `<p><strong>Principal — ${esc(p.principal.nombre)}.</strong> ${esc(p.principal.text)}</p>`,
    p.secundaria ? `<p><strong>Secundaria — ${esc(p.secundaria.nombre)}.</strong> ${esc(p.secundaria.text)}</p>` : '',
    p.descartada ? `<p><strong>No aplica — ${esc(p.descartada.nombre)}.</strong> ${esc(p.descartada.text)}</p>` : ''
  ].join('');

  const items = res.checklist.web.map((b) => `<li>${esc(b)}</li>`).join('');
  const itemsFull = res.checklist.full.map((b) => `<li>${esc(b)}</li>`).join('');

  const view = el(`
    <div class="dx__view dx__final">
      <section class="dx__diag" aria-labelledby="dx-diag-h">
        <p class="dx__diag-kicker">Diagnóstico listo</p>
        <h2 class="dx__col-title" id="dx-diag-h" data-dx-focus tabindex="-1">${esc(res.perfil)}</h2>
        ${bloqueBHtml}
        ${palancasHtml}
        <p>${esc(res.datoFaltante.dato)}</p>
        <p class="dx__close">${esc(res.datoFaltante.cierre)}</p>
        <p>${esc(res.financiamiento)}</p>
        <aside class="dx__checklist" aria-label="Preparación para la llamada">
          <h3>${esc(content.checklistTitulo)}</h3>
          <ul>${items}</ul>
          <p class="dx__checklist__foot">${esc(content.checklistPie)}</p>
        </aside>
        <div class="dx__actions">
          <button type="button" class="mx-btn mx-btn--ghost" data-act="reiniciar">${esc(content.resultado.reiniciar)}</button>
        </div>
      </section>

      <section class="dx__book" aria-labelledby="dx-book-h">
        <h2 class="dx__col-title" id="dx-book-h">Agenda una conversación</h2>
        <p class="dx__col-sub">Elige un horario y coordinamos una llamada para revisar tu diagnóstico a fondo. Adjuntamos automáticamente tu diagnóstico a la reunión.</p>
        <div class="dx__cal" id="agenda"></div>
      </section>

      <section class="dx__print-only dx__checklist">
        <h3>${esc(content.checklistTitulo)}</h3>
        <ul>${itemsFull}</ul>
      </section>
      <footer class="dx__print-only dx__printfoot">
        <p>mexillum — diagnóstico energético · mexillum.com · info@mexillum.com</p>
      </footer>
    </div>`);

  view.querySelector('[data-act="reiniciar"]').addEventListener('click', () => {
    estado.paso = 'intro';
    estado.respuestas = {};
    estado.contacto = {};
    estado.resultado = null;
    leadEnviado = false;
    render();
  });

  root.replaceChildren(view);
  focusMain();
  mountCal('#agenda', res);
}

function render() {
  if (estado.paso === 'intro') return renderIntro();
  if (estado.paso === 'gate') return renderGate();
  if (estado.paso === 'result') return renderResult();
  return renderStep();
}

render();

// Envía el lead a /api/lead (Resend). Fire-and-forget: un fallo no rompe la pantalla.
let leadEnviado = false;
export function submitLead(payload) {
  if (leadEnviado) return Promise.resolve(false);
  leadEnviado = true;
  return fetch('/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true
  })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return true; })
    .catch((err) => {
      leadEnviado = false;
      console.error('[diagnostico] no se pudo registrar el lead', err);
      return false;
    });
}
```

- [ ] **Step 3: Verify syntax**

Run: `node --check js/diagnostico.view.js`
Expected: sin salida (exit 0).

- [ ] **Step 4: Commit**

```bash
git add js/diagnostico.view.js diagnostico/index.html
git commit -m "Diagnostico v2: view con intro, 8 pasos con {planta}, gate y resultado A-E"
```

---

### Task 11: Verificación end-to-end (suite + navegador) y cierre

**Files:** ninguno (solo verificación); posibles fixes menores.

- [ ] **Step 1: Correr el suite completo**

Run: `npm test`
Expected: PASS, todos los tests de `test/diagnostico.content.test.js` y `test/diagnostico.engine.test.js`.

- [ ] **Step 2: Verificar sintaxis de los serverless/JS**

Run: `node --check api/lead.js && node --check js/diagnostico.view.js && node --check js/diagnostico.engine.js && node --check js/diagnostico.content.js`
Expected: sin salida (exit 0).

- [ ] **Step 3: Smoke en navegador**

Servir el sitio estático (por ejemplo `npx serve .` o el preview del entorno) y abrir `/diagnostico/`. Recorrer: intro → 8 pasos (verificar que P5/P6/P7 muestran "esa planta" con `sitios=pocos/muchos` y "tu operación" con `sitios=uno`) → gate → resultado.
Verificar visualmente:
- El resultado muestra el perfil como título, el bloque B con la cadena y el rango, las 3 líneas de palancas, el dato faltante + cierre, el párrafo de financiamiento, el checklist (≤4 + universal) y el calendario cal.diy.
- El gate exige nombre + email; con datos válidos, se dispara el POST a `/api/lead` (verificar en la pestaña Network; sin `RESEND_API_KEY` responderá 500, pero el POST debe salir con el payload v2: `perfil`, `rango_texto`, `rol`, `respuestas_legibles` con 8 keys, `checklist_full`).
- Correr el fixture manualmente (`manufactura/pocos/fisica/desconoce/gdmth/alto/reinicio/costo`) y confirmar el rango "$2.2 a $4.2 millones de MXN al año".

- [ ] **Step 4: Finalizar la rama**

Usar la skill `superpowers:finishing-a-development-branch` para decidir merge/PR/cleanup de la rama `funnel-diagnostico-v2`.

---

## Self-Review

**1. Spec coverage:**
- 8 preguntas + intro + `{planta}` → Task 1 (data) + Task 10 (render/substitución). ✓
- Gate con `rol` → Task 1 (defs) + Task 10 (form) + Task 9 (email). ✓
- Bloque A → Task 2. Bloque B (aritmética visible, redondeo, sin-número, notas) → Task 3. Bloque C (gancho/principal/secundaria/descartada + exclusión) → Task 4. Bloque D (corte!=nada > default, corrección de la contradicción) → Task 5. Bloque E (sujeto a evaluación, sin promesas) → Task 6. ✓
- Checklist (base+refuerzos+viabilidad, tope web 4, viabilidad low-priority, full sin recorte) → Task 7. ✓
- Lead sin score, perfil+rango, un solo envío al gate → Task 8 (payload) + Task 9 (email) + Task 10 (envío). ✓
- Nota del evento cal.diy con checklist full + 8 respuestas → Task 8 + Task 10 (mountCal usa `res.note`). ✓
- Fixture §5 como aserción fija → Task 8. ✓
- Sin CSS nuevo / no tocar PRD, landing, main.js → Global Constraints. ✓

**2. Placeholder scan:** sin "TBD"/"TODO"/pseudo-código; cada step de código trae el código completo. ✓

**3. Type consistency:** `assembleResult` devuelve `{perfil, bloqueB, palancas, datoFaltante, financiamiento, checklist, note, leadPayload}`; `pickLevers` → `{gancho, principal, secundaria, descartada}` consumido igual en Task 8 y Task 10; `renderBlockB` → `{sinNumero, piso, techo, texto, notas}` consumido en Task 8/10; `buildChecklist` → `{web, full}` consumido en Task 8/10; `leadPayload` keys consumidas por `api/lead.js` (Task 9) coinciden con las producidas (Task 8): `perfil`, `rango_texto`, `rol`, `respuestas_legibles`, `respuestas_codigos`, `checklist_full`. ✓
