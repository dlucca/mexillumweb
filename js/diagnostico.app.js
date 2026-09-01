import { assembleResult, plantaLabel, bookingContact } from './diagnostico.engine.js?v=10';
import { mountRoofPicker } from './diagnostico.roof.js?v=10';
import { mountFacturasUploader } from './diagnostico.facturas.js';
import { trackDx } from './diagnostico.analytics.js';
import { clearDxState, loadDxState, saveDxState } from './diagnostico.state.js';

// Instancia self-hosted de cal.diy. El origen es común a todas las versiones.
const CAL_ORIGIN = 'https://cal.mexillum.com';

// Núcleo de la vista del diagnóstico. Cada versión (industrial, hoteles) lo arranca
// con su propio `content`, su `calLink` de Cal.com y un `origen` opcional para marcar
// el lead. Toda la lógica de pantallas vive aquí; los archivos *.view.js solo arrancan.
export function initDiagnostico({ content, calLink, origen }) {
  const root = document.getElementById('dx-root');
  const profileId = content.profile?.id || origen || 'industria_comercio';
  const stateId = `${profileId}:${content.profile?.version || '1.0'}`;

  // Modo rápido: el link `?rapido` es para pasarle a un prospecto directo. Salta
  // el cuestionario y arranca en el mapa: marcar espacio → facturas → formulario.
  const query = new URLSearchParams(globalThis.location?.search || '');
  const rapido = query.has('rapido');
  const attribution = {
    utm_source: query.get('utm_source') || '',
    utm_medium: query.get('utm_medium') || '',
    utm_campaign: query.get('utm_campaign') || '',
    source: query.get('source') || '',
    referrer: document.referrer || ''
  };
  // Etiqueta el lead para que ventas sepa que vino del link corto (sin cuestionario).
  const origenEfectivo = rapido ? (origen ? `${origen}-rapido` : 'rapido') : origen;

  const saved = rapido ? null : loadDxState(stateId);
  const estado = {
    paso: rapido
      ? (content.postResult?.servicePoint ? 'techo' : (content.postResult?.skipRoof ? 'facturas' : 'techo'))
      : (saved?.paso ?? 'intro'),
    respuestas: {},
    contacto: {},
    resultado: null,          // cache del assembleResult
    lead_id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
    ubicacion: null,
    techo: null,
    acometida: null,
    facturas: null,
    ...(saved || {}),
  };
  let resultTracked = false;
  trackDx('viewed', { profile_id: profileId, rapido });

  function enrichmentStep(res = estado.resultado) {
    if (content.postResult?.servicePoint) return 'techo';
    if (content.postResult?.skipRoof) return 'facturas';
    if (content.postResult?.alwaysRoof) return 'techo';
    const family = res?.recomendacion_solucion?.familia || '';
    return ['solar', 'bess_solar', 'off_grid'].includes(family) ? 'techo' : 'facturas';
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Sustituye {planta} en un prompt. Valor constante: instalación única, siempre 'tu operación'.
  function withPlanta(texto) {
    return texto.replace('{planta}', content.plantaLabel || plantaLabel(estado.respuestas));
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
      trackDx('started', { profile_id: profileId });
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
    if (paso.multi) return renderStepMulti(idx, paso, pregunta);

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
        <div class="dx__progress">
          <span class="dx__progress-label">${esc(content.progresoLabel(idx + 1, content.pasos.length))}</span>
          <span class="dx__progress-track" aria-hidden="true"><span class="dx__progress-fill" style="width:${Math.round((idx + 1) / content.pasos.length * 100)}%"></span></span>
        </div>
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
      trackDx('step_completed', { profile_id: profileId, step: paso.key, step_number: idx + 1 });
      if (estado.paso < content.pasos.length - 1) estado.paso += 1;
      else estado.paso = 'result';
      render();
    });

    paint();
    root.replaceChildren(view);
    focusMain();
  }

  // ---- Paso multi-select (disparador, v2.2) ------------------------------------
  // Checkboxes para las señales operativas + una opción excluyente ("Ninguna").
  // Marcar la excluyente limpia el resto; marcar cualquier señal limpia la excluyente.
  function renderStepMulti(idx, paso, pregunta) {
    if (!Array.isArray(estado.respuestas[paso.key])) estado.respuestas[paso.key] = [];
    const exclusivas = paso.opciones.filter((o) => o.exclusiva).map((o) => o.codigo);
    const esExclusiva = (cod) => exclusivas.includes(cod);

    const opcionesHtml = paso.opciones.map((o) => {
      const on = estado.respuestas[paso.key].includes(o.codigo);
      const box = o.exclusiva
        ? `<span class="mx-check__box mx-check__box--radio ${on ? 'mx-check__box--on' : ''}">${on ? '<span class="mx-check__dot"></span>' : ''}</span>`
        : `<span class="mx-check__box ${on ? 'mx-check__box--on' : ''}">${on ? tickSvg() : ''}</span>`;
      return `
        <button type="button" class="dx__option" data-codigo="${esc(o.codigo)}" role="checkbox" aria-checked="${on}" tabindex="-1">
          <span class="mx-check">
            ${box}
            <span>${esc(o.label)}</span>
          </span>
        </button>`;
    }).join('');

    const hintHtml = paso.hint ? `<p class="dx__col-sub">${esc(paso.hint)}</p>` : '';
    const atras = '<button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>';

    const view = el(`
      <div class="dx__view">
        <div class="dx__progress">
          <span class="dx__progress-label">${esc(content.progresoLabel(idx + 1, content.pasos.length))}</span>
          <span class="dx__progress-track" aria-hidden="true"><span class="dx__progress-fill" style="width:${Math.round((idx + 1) / content.pasos.length * 100)}%"></span></span>
        </div>
        <h2 class="dx__question" data-dx-focus tabindex="-1">${esc(pregunta)}</h2>
        ${hintHtml}
        <div class="dx__options" role="group" aria-label="${esc(pregunta)}">${opcionesHtml}</div>
        <div class="dx__nav dx__nav--end">
          ${atras}
          <button type="button" class="mx-btn mx-btn--primary" data-act="siguiente" disabled>Siguiente</button>
        </div>
      </div>`);

    const options = [...view.querySelectorAll('.dx__option')];
    const siguiente = view.querySelector('[data-act="siguiente"]');

    function paint() {
      const sel = estado.respuestas[paso.key];
      options.forEach((btn, i) => {
        const cod = btn.dataset.codigo;
        const on = sel.includes(cod);
        btn.setAttribute('aria-checked', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
        const box = btn.querySelector('.mx-check__box');
        box.classList.toggle('mx-check__box--on', on);
        const radio = esExclusiva(cod);
        const marca = box.querySelector(radio ? '.mx-check__dot' : '.mx-check__tick');
        // el() parsea HTML estático de confianza (mismo patrón que el resto de la vista).
        if (on && !marca) box.appendChild(el(radio ? '<span class="mx-check__dot"></span>' : tickSvg()));
        else if (!on && marca) marca.remove();
      });
      if (!sel.length && options[0]) options[0].tabIndex = 0;
      siguiente.disabled = sel.length === 0;
    }

    function toggle(btn) {
      const cod = btn.dataset.codigo;
      let sel = estado.respuestas[paso.key];
      if (esExclusiva(cod)) {
        sel = sel.includes(cod) ? [] : [cod];              // excluyente: reemplaza / limpia
      } else if (sel.includes(cod)) {
        sel = sel.filter((c) => c !== cod);
      } else {
        sel = [...sel.filter((c) => !esExclusiva(c)), cod]; // añade señal, quita excluyente
      }
      estado.respuestas[paso.key] = sel;
      paint();
      btn.focus();
    }

    options.forEach((btn, i) => {
      btn.addEventListener('click', () => toggle(btn));
      btn.addEventListener('keydown', (e) => {
        let next = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % options.length;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + options.length) % options.length;
        if (next !== null) { e.preventDefault(); options[next].tabIndex = 0; btn.tabIndex = -1; options[next].focus(); }
      });
    });

    view.querySelector('[data-act="atras"]').addEventListener('click', () => {
      estado.paso -= 1;
      render();
    });
    siguiente.addEventListener('click', () => {
      if (!estado.respuestas[paso.key].length) return;
      trackDx('step_completed', { profile_id: profileId, step: paso.key, step_number: idx + 1 });
      if (estado.paso < content.pasos.length - 1) estado.paso += 1;
      else estado.paso = 'result';
      render();
    });

    paint();
    root.replaceChildren(view);
    focusMain();
  }

  function tickSvg() {
    return '<svg class="mx-check__tick" viewBox="0 0 12 12" fill="none" aria-hidden="true">'
      + '<path d="M2.5 6.3l2.4 2.4 4.6-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
    registerBookingListener();
    window.Cal('inline', {
      elementOrSelector: selector,
      calLink,
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

  // Si la persona agenda sin haber llenado el formulario, tomamos su nombre/email
  // de la reserva y registramos el lead igual (submitLead se de-duplica solo).
  let bookingListenerReady = false;
  function registerBookingListener() {
    if (bookingListenerReady) return;
    bookingListenerReady = true;
    window.Cal('on', {
      action: 'bookingSuccessful',
      callback: (e) => {
        const c = bookingContact(e?.detail?.data);
        estado.contacto = {
          nombre: estado.contacto.nombre || c.nombre,
          empresa: estado.contacto.empresa || c.empresa,
          correo: estado.contacto.correo || c.correo,
          telefono: estado.contacto.telefono || c.telefono,
          rol: estado.contacto.rol || c.rol,
          presupuesto: estado.contacto.presupuesto || c.presupuesto,
          tipo_cierre: estado.contacto.tipo_cierre || 'llamada'
        };
        estado.resultado = assembleResult(estado, content);
        const payload = origenEfectivo ? { ...estado.resultado.leadPayload, origen: origenEfectivo } : estado.resultado.leadPayload;
        submitLead(payload, 'calendar_booked');
        trackDx('calendar_booked', { profile_id: profileId });
      }
    });
  }

  // ---- Paso: dibujar techo (opcional) -----------------------------------------
  function renderTecho() {
    const allowRoof = !content.postResult?.skipRoof;
    // En modo rápido la persona llega en frío: copy que orienta y engancha.
    // En el flujo normal ya vio su resultado, así que el copy es más breve.
    const titulo = allowRoof
      ? (rapido ? '¿Dónde podría instalarse el sistema?' : 'Marca el espacio y el punto eléctrico')
      : 'Ubica tu punto eléctrico principal';
    const sub = allowRoof
      ? 'Dibuja el techo o terreno disponible y, si la conoces, marca la acometida, medidor, transformador o tablero principal.'
      : 'Marca en el mapa la acometida, medidor, transformador, subestación o tablero principal. Puede ser una ubicación aproximada.';
    const botonAtras = rapido
      ? ''
      : '<button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>';

    const view = el(`
      <div class="dx__view">
        <h2 class="dx__question" data-dx-focus tabindex="-1">${esc(titulo)}</h2>
        <p class="dx__col-sub">${esc(sub)}</p>
        <div class="dx-roof-mount"></div>
        <div class="dx__nav dx__nav--end">
          ${botonAtras}
          <span class="dx__skiprow">
            <button type="button" class="dx__skip" data-act="saltar">Saltar por ahora</button>
            <button type="button" class="mx-btn mx-btn--primary" data-act="siguiente">Continuar</button>
          </span>
        </div>
      </div>`);

    mountRoofPicker(view.querySelector('.dx-roof-mount'), {
      onLocation: (u) => { estado.ubicacion = u; },
      onRoof: (r) => { estado.techo = r; },
      onServicePoint: (point) => {
        const isFirst = !estado.acometida && point;
        estado.acometida = point;
        if (isFirst) trackDx('service_point_marked', { profile_id: profileId, type: point.tipo });
      },
      allowRoof
    });
    view.querySelector('[data-act="atras"]')?.addEventListener('click', () => { estado.paso = 'cierre'; render(); });
    view.querySelector('[data-act="saltar"]').addEventListener('click', () => { estado.paso = 'facturas'; render(); });
    view.querySelector('[data-act="siguiente"]').addEventListener('click', () => { estado.paso = 'facturas'; render(); });

    root.replaceChildren(view);
    focusMain();
  }

  // ---- Paso: subir facturas (opcional) ----------------------------------------
  function renderFacturas() {
    const botonAtras = rapido && content.postResult?.skipRoof
      ? ''
      : '<button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>';
    const view = el(`
      <div class="dx__view">
        <h2 class="dx__question" data-dx-focus tabindex="-1">Sube tus últimas 12 facturas de energía</h2>
        <p class="dx__col-sub">Con tus facturas de CFE o de tu suministrador calculamos tu ahorro real. Es opcional, pero mejora mucho tu anteproyecto.</p>
        <p class="dx__col-sub">Tus recibos son confidenciales. Solo los usamos para tu diagnóstico y no los compartimos.</p>
        <div class="dx-fac-mount"></div>
        <div class="dx__nav dx__nav--end">
          ${botonAtras}
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
    view.querySelector('[data-act="atras"]')?.addEventListener('click', () => {
      estado.paso = rapido
        ? (content.postResult?.servicePoint ? 'techo' : (content.postResult?.skipRoof ? 'facturas' : 'techo'))
        : (enrichmentStep() === 'techo' ? 'techo' : 'cierre');
      render();
    });
    const finishEnrichment = () => {
      estado.paso = estado.contacto.nombre ? 'agenda' : 'cierre';
      render();
    };
    view.querySelector('[data-act="saltar"]').addEventListener('click', finishEnrichment);
    view.querySelector('[data-act="siguiente"]').addEventListener('click', finishEnrichment);

    root.replaceChildren(view);
    focusMain();
  }

  // ---- Paso: contacto + siguiente paso (dos caminos) --------------------------
  function renderCierre() {
    const res = estado.resultado || assembleResult(estado, content);
    estado.resultado = res;

    const view = el(`
      <div class="dx__view">
        <h2 class="dx__question" data-dx-focus tabindex="-1">¿Cómo quieres continuar?</h2>
        <div class="dx-cierre">
          <label class="dx-cierre__field">Nombre
            <input type="text" data-f="nombre" autocomplete="name" required value="${esc(estado.contacto.nombre || '')}">
          </label>
          <label class="dx-cierre__field">Empresa (opcional)
            <input type="text" data-f="empresa" autocomplete="organization" value="${esc(estado.contacto.empresa || '')}">
          </label>
          <label class="dx-cierre__field">Correo
            <input type="email" data-f="correo" autocomplete="email" required value="${esc(estado.contacto.correo || '')}">
          </label>
          <label class="dx-cierre__field">Teléfono (opcional)
            <input type="tel" data-f="telefono" autocomplete="tel" value="${esc(estado.contacto.telefono || '')}">
          </label>
          <p class="dx-cierre__err" role="alert" hidden></p>
          <p class="dx-cierre__privacy">Al continuar, autorizas a Mexillum a usar estos datos para dar seguimiento a tu diagnóstico. <a href="/aviso-de-privacidad" target="_blank" rel="noopener">Aviso de privacidad</a>.</p>
        </div>

        <div class="dx-cierre__paths">
          <div class="dx-cierre__path">
            <h3>Propuesta preliminar por correo</h3>
            <p class="dx__col-sub">Déjanos tu nombre y correo y te contactamos con tu propuesta preliminar.</p>
            <button type="button" class="mx-btn mx-btn--primary" data-act="preliminar">Recibir propuesta preliminar</button>
            <p class="dx-cierre__ok" data-slot="okA" hidden>¡Listo! Pronto te contactaremos.</p>
          </div>
          <div class="dx-cierre__path">
            <h3>Afinar mi anteproyecto</h3>
            <p class="dx__col-sub">Agrega facturas y, cuando aplique, espacio disponible. Puedes saltar cualquier dato.</p>
            <button type="button" class="mx-btn mx-btn--primary" data-act="afinar">Afinar mi anteproyecto</button>
          </div>
        </div>
        <div class="dx__nav">
          <button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>
        </div>
      </div>`);

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const getField = (f) => view.querySelector(`[data-f="${f}"]`).value.trim();
    const errEl = view.querySelector('.dx-cierre__err');

    function capturarContacto(tipo) {
      const nombre = getField('nombre');
      const empresa = getField('empresa');
      const correo = getField('correo');
      if (!nombre || !EMAIL_RE.test(correo)) {
        errEl.textContent = 'Escribe tu nombre y un correo válido.';
        errEl.hidden = false;
        return false;
      }
      if (tipo === 'llamada' && !empresa) {
        errEl.textContent = 'Para agendar, agrega también el nombre de tu empresa.';
        errEl.hidden = false;
        return false;
      }
      errEl.hidden = true;
      estado.contacto = {
        ...estado.contacto,
        nombre,
        empresa,
        correo,
        telefono: getField('telefono')
      };
      return true;
    }

    view.querySelector('[data-act="atras"]').addEventListener('click', () => { estado.paso = 'result'; render(); });

    view.querySelector('[data-act="preliminar"]').addEventListener('click', async (event) => {
      if (!capturarContacto('preliminar')) return;
      const button = event.currentTarget;
      button.disabled = true;
      const previousText = button.textContent;
      button.textContent = 'Enviando…';
      estado.contacto.tipo_cierre = 'preliminar';
      estado.resultado = assembleResult(estado, content);
      const payload = origenEfectivo ? { ...estado.resultado.leadPayload, origen: origenEfectivo } : estado.resultado.leadPayload;
      const ok = await submitLead(payload, 'proposal_requested');
      button.textContent = previousText;
      button.disabled = ok;
      if (ok) {
        view.querySelector('[data-slot="okA"]').hidden = false;
        trackDx('proposal_requested', { profile_id: profileId });
      } else {
        errEl.textContent = 'No pudimos enviar tu solicitud. Intenta de nuevo en un momento.';
        errEl.hidden = false;
      }
    });

    view.querySelector('[data-act="afinar"]').addEventListener('click', async (event) => {
      if (!capturarContacto('anteproyecto')) return;
      const button = event.currentTarget;
      button.disabled = true;
      const previousText = button.textContent;
      button.textContent = 'Guardando…';
      estado.contacto.tipo_cierre = 'anteproyecto';
      estado.resultado = assembleResult(estado, content);
      const payload = origenEfectivo ? { ...estado.resultado.leadPayload, origen: origenEfectivo } : estado.resultado.leadPayload;
      const ok = await submitLead(payload, 'enrichment_started');
      button.textContent = previousText;
      button.disabled = false;
      if (!ok) {
        errEl.textContent = 'No pudimos guardar tus datos. Intenta de nuevo en un momento.';
        errEl.hidden = false;
        return;
      }
      trackDx('enrichment_started', { profile_id: profileId });
      estado.paso = enrichmentStep(res);
      render();
    });

    root.replaceChildren(view);
    focusMain();
  }

  // ---- Handoff después de aportar datos técnicos ------------------------------
  function renderAgenda() {
    const res = assembleResult(estado, content);
    estado.resultado = res;
    const view = el(`
      <div class="dx__view">
        <p class="dx__diag-kicker">Información recibida</p>
        <h2 class="dx__question" data-dx-focus tabindex="-1">Elige el siguiente paso</h2>
        <p class="dx__col-sub">Ya guardamos lo que compartiste. Puedes pedir la revisión por correo o reservar una llamada.</p>
        <div class="dx-cierre">
          <label class="dx-cierre__field">Empresa (necesaria para agendar)
            <input type="text" data-f="empresa" autocomplete="organization" value="${esc(estado.contacto.empresa || '')}">
          </label>
          <p class="dx-cierre__err" role="alert" hidden></p>
        </div>
        <div class="dx-cierre__paths">
          <div class="dx-cierre__path">
            <h3>Recibir revisión por correo</h3>
            <p class="dx__col-sub">Un asesor revisará tu diagnóstico y la información aportada.</p>
            <button type="button" class="mx-btn mx-btn--primary" data-act="enviar">Enviar para revisión</button>
            <p class="dx-cierre__ok" data-slot="ok" hidden>¡Listo! Recibirás el seguimiento en tu correo.</p>
          </div>
          <div class="dx-cierre__path">
            <h3>Agendar una llamada</h3>
            <p class="dx__col-sub">Revisa el caso directamente con un especialista.</p>
            <button type="button" class="mx-btn mx-btn--ghost" data-act="agendar">Agendar llamada</button>
            <div class="dx__cal" id="agenda" hidden></div>
            <aside class="dx__checklist" data-slot="checklist" hidden>
              <h3>${esc(content.anteproyectoTituloLead)}</h3>
              <ul>${res.anteproyecto.lead.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
              <p class="dx__checklist__foot">${esc(content.checklistPie)}</p>
            </aside>
          </div>
        </div>
        <div class="dx__nav"><button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button></div>
      </div>`);
    const errEl = view.querySelector('.dx-cierre__err');
    const payload = (stage) => {
      estado.contacto.empresa = view.querySelector('[data-f="empresa"]').value.trim();
      estado.resultado = assembleResult(estado, content);
      const base = origenEfectivo ? { ...estado.resultado.leadPayload, origen: origenEfectivo } : estado.resultado.leadPayload;
      return submitLead(base, stage);
    };
    view.querySelector('[data-act="atras"]').addEventListener('click', () => { estado.paso = 'facturas'; render(); });
    view.querySelector('[data-act="enviar"]').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Enviando…';
      estado.contacto.tipo_cierre = 'preliminar';
      const ok = await payload('proposal_requested');
      button.textContent = 'Enviar para revisión';
      button.disabled = ok;
      if (ok) {
        view.querySelector('[data-slot="ok"]').hidden = false;
        trackDx('proposal_requested', { profile_id: profileId, enriched: true });
      } else {
        errEl.textContent = 'No pudimos enviar la información. Intenta de nuevo.';
        errEl.hidden = false;
      }
    });
    view.querySelector('[data-act="agendar"]').addEventListener('click', async (event) => {
      const empresa = view.querySelector('[data-f="empresa"]').value.trim();
      if (!empresa) {
        errEl.textContent = 'Agrega el nombre de tu empresa para abrir la agenda.';
        errEl.hidden = false;
        return;
      }
      errEl.hidden = true;
      estado.contacto.tipo_cierre = 'llamada';
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Preparando agenda…';
      const ok = await payload('calendar_opened');
      button.textContent = 'Agendar llamada';
      button.disabled = ok;
      if (!ok) {
        errEl.textContent = 'No pudimos preparar la agenda. Intenta de nuevo.';
        errEl.hidden = false;
        return;
      }
      view.querySelector('#agenda').hidden = false;
      view.querySelector('[data-slot="checklist"]').hidden = false;
      mountCal('#agenda', estado.resultado);
      trackDx('calendar_opened', { profile_id: profileId });
    });
    root.replaceChildren(view);
    focusMain();
  }

  // ---- Pantalla final: diagnóstico (A–E) + agenda ------------------------------
  function renderResult() {
    const res = estado.resultado || assembleResult(estado, content);
    if (!resultTracked) {
      resultTracked = true;
      trackDx('result_viewed', {
        profile_id: profileId,
        potential: res.potencial_general,
        recommendation: res.recomendacion_solucion?.familia
      });
    }
    const c = res.calculo;
    const p = res.palancas;

    // Bloque B: cadena como cuerpo; el rango de ahorro destacado tipográficamente; disclaimer
    // y matices como texto secundario. El único número que debe grabarse es el rango.
    const rangoHtml = c.sin_numero ? '' : `
          <figure class="dx__rango">
            <figcaption class="dx__rango-label">Orden de magnitud (referencia)</figcaption>
            <p class="dx__rango-figure">${esc(c.rango_texto)}</p>
          </figure>`;
    const bloqueBHtml = [
      `<p>${esc(c.cadena)}</p>`,
      rangoHtml,
      c.disclaimer ? `<p class="dx__disclaimer">${esc(c.disclaimer)}</p>` : '',
      c.nota_continuo ? `<p>${esc(c.nota_continuo)}</p>` : '',
      ...c.notas.map((n) => `<p>${esc(n)}</p>`)
    ].join('');

    // Una palanca principal y, como máximo, una secundaria: evita repetir el ranking.
    const ganchoHtml = res.gancho ? `<p class="dx__gancho"><em>${esc(res.gancho)}</em></p>` : '';
    const secundaria = p.secundaria || p.factorPotencia;
    const palancaLi = (tag, tagMod, nombre, text) =>
      `<li><span class="dx__palanca-tag${tagMod}">${esc(tag)}</span> <strong>${esc(nombre)}.</strong> ${esc(text)}</li>`;
    const palancasHtml = `
          ${ganchoHtml}
          <ul class="dx__palancas">
            ${palancaLi('Principal', '', p.principal.nombre, p.principal.text)}
            ${secundaria ? palancaLi('Secundaria', '', secundaria.nombre, secundaria.text) : ''}
          </ul>`;

    // Configuración y confianza se presentan como conclusiones; el ranking queda interno.
    const rz = content.resumen;
    const limCriticas = res.limitaciones.slice(0, 2);
    const limHtml = limCriticas.length
      ? `<p class="dx__resumen-k">${esc(rz.limitacionesLabel)}:</p>
         <ul class="dx__resumen-lim">${limCriticas.map((l) => `<li>${esc(l.dato)}</li>`).join('')}</ul>`
      : '';
    const tipoRec = res.recomendacion_solucion.tipo;
    const aplicaFrase = rz.aplicaFrase?.[res.potencial_general] || 'podría aplicar a tu operación';
    const unknowns = ['perfil', 'tarifa', 'factura'].filter((key) => estado.respuestas[key] === 'nolose').length;
    const confianza = unknowns >= 2 || limCriticas.length >= 2 ? 'Preliminar' : (unknowns || limCriticas.length ? 'Media' : 'Alta');
    const tamano = c.sin_numero ? 'Sin cuantificar' : c.rango_texto;
    const nextCopy = 'Elige si quieres recibir este diagnóstico por correo o aportar datos para afinar el anteproyecto.';
    const configuracionHtml = `
          <aside class="dx__resumen" aria-label="Configuración a evaluar">
            <p class="dx__resumen-k">Configuración a evaluar</p>
            <p class="dx__resumen-frase">Por lo que nos contaste, <strong>${esc(tipoRec)}</strong> ${esc(aplicaFrase)}.</p>
            ${/BESS/.test(res.recomendacion_solucion.tipo) ? `<p class="dx__resumen-glosa">${esc(rz.bessGlosa)}</p>` : ''}
            <p class="dx__resumen-razon">${esc(res.recomendacion_solucion.razon)}</p>
          </aside>`;
    const confianzaHtml = `
          <aside class="dx__resumen" aria-label="Firmeza de la conclusión">
            <p class="dx__resumen-k">Qué tan firme es esta conclusión</p>
            <div class="dx__resumen-heads">
              <p class="dx__resumen-line"><span class="dx__resumen-k">Encaje técnico</span><strong>${esc(res.potencial_general)}</strong></p>
              <p class="dx__resumen-line"><span class="dx__resumen-k">Tamaño</span><strong>${esc(tamano)}</strong></p>
              <p class="dx__resumen-line"><span class="dx__resumen-k">Confianza</span><strong>${esc(confianza)}</strong></p>
            </div>
            ${limHtml}
          </aside>`;

    const itemsFull = res.checklist.full.map((b) => `<li>${esc(b)}</li>`).join('');

    const view = el(`
      <div class="dx__view dx__final">
        <section class="dx__diag" aria-labelledby="dx-diag-h">
          <p class="dx__diag-kicker">Diagnóstico listo</p>
          <h2 class="dx__col-title" id="dx-diag-h" data-dx-focus tabindex="-1">${esc(res.perfil)}</h2>
          ${configuracionHtml}
          <p class="dx__resumen-k">Qué puede mejorar</p>
          ${bloqueBHtml}
          ${palancasHtml}
          ${confianzaHtml}
          <p class="dx__fin">${esc(res.financiamiento)}</p>
          <div class="dx__cta">
            <p class="dx__cta-p">${esc(nextCopy)}</p>
          </div>
          <div class="dx__actions">
            <button type="button" class="mx-btn mx-btn--primary" data-act="continuar">${esc(content.postResult?.label || 'Precisar mi proyecto')}</button>
            <button type="button" class="mx-btn mx-btn--ghost" data-act="reiniciar">${esc(content.resultado.reiniciar)}</button>
          </div>
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
      estado.ubicacion = null;
      estado.techo = null;
      estado.acometida = null;
      estado.facturas = null;
      estado.lead_id = (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
      submittedStages.clear();
      resultTracked = false;
      clearDxState(stateId);
      trackDx('restarted', { profile_id: profileId });
      render();
    });

    view.querySelector('[data-act="continuar"]').addEventListener('click', () => {
      estado.paso = 'cierre';
      trackDx('result_cta_clicked', { profile_id: profileId, next_step: 'contact' });
      render();
    });

    root.replaceChildren(view);
    focusMain();
  }

  function render() {
    saveDxState(stateId, estado);
    if (estado.paso === 'intro') return renderIntro();
    if (estado.paso === 'result') return renderResult();
    if (estado.paso === 'techo') return renderTecho();
    if (estado.paso === 'facturas') return renderFacturas();
    if (estado.paso === 'cierre') return renderCierre();
    if (estado.paso === 'agenda') return renderAgenda();
    return renderStep();
  }

  const submittedStages = new Set();
  function submitLead(payload, stage) {
    if (submittedStages.has(stage)) return Promise.resolve(true);
    submittedStages.add(stage);
    return fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, lead_stage: stage, attribution }),
      keepalive: true
    })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return true; })
      .catch((err) => {
        submittedStages.delete(stage);
        console.error('[diagnostico] no se pudo registrar el lead', err);
        return false;
      });
  }

  render();
}
