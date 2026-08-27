import content from './diagnostico.content.js';
import { assembleResult, plantaLabel, bookingContact } from './diagnostico.engine.js';

const root = document.getElementById('dx-root');

// Instancia self-hosted de cal.diy y el event type para la llamada.
const CAL_ORIGIN = 'https://cal.mexillum.com';
const CAL_LINK = 'diagnostico/diagnostico-mexillum';

const estado = {
  paso: 'intro',            // 'intro' | 0..7 | 'result'
  respuestas: {},
  contacto: {},
  resultado: null           // cache del assembleResult
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

// Sustituye {planta} en un prompt. Valor constante: instalación única, siempre 'tu operación'.
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

// Si la persona agenda sin haber llenado el formulario, tomamos su nombre/email
// de la reserva y registramos el lead igual (submitLead se de-duplica solo).
let bookingListenerReady = false;
function registerBookingListener() {
  if (bookingListenerReady) return;
  bookingListenerReady = true;
  window.Cal('on', {
    action: 'bookingSuccessful',
    callback: (e) => {
      if (leadEnviado) return;
      const c = bookingContact(e?.detail?.data);
      estado.contacto = {
        nombre: estado.contacto.nombre || c.nombre,
        empresa: estado.contacto.empresa || c.empresa,
        correo: estado.contacto.correo || c.correo,
        telefono: estado.contacto.telefono || c.telefono,
        rol: estado.contacto.rol || c.rol,
        presupuesto: estado.contacto.presupuesto || c.presupuesto
      };
      estado.resultado = assembleResult(estado, content);
      submitLead(estado.resultado.leadPayload);
    }
  });
}

// ---- Pantalla final: diagnóstico (A–E) + agenda ------------------------------
function renderResult() {
  const res = estado.resultado || assembleResult(estado, content);
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

  // Bloque C: gancho (casi siempre ausente) + palancas como lista de tres jerárquica.
  const ganchoHtml = res.gancho ? `<p class="dx__gancho"><em>${esc(res.gancho)}</em></p>` : '';
  const palancaLi = (tag, tagMod, nombre, text) =>
    `<li><span class="dx__palanca-tag${tagMod}">${esc(tag)}</span> <strong>${esc(nombre)}.</strong> ${esc(text)}</li>`;
  const palancasHtml = `
        ${ganchoHtml}
        <ul class="dx__palancas">
          ${palancaLi('Principal', '', p.principal.nombre, p.principal.text)}
          ${p.secundaria ? palancaLi('Secundaria', '', p.secundaria.nombre, p.secundaria.text) : ''}
          ${p.factorPotencia ? palancaLi('Secundaria', '', p.factorPotencia.nombre, p.factorPotencia.text) : ''}
          ${palancaLi(p.descarte.tag, ' dx__palanca-tag--off', p.descarte.nombre, p.descarte.text)}
        </ul>`;

  // Resumen comercial discreto (mejora #1): potencial + recomendación + top 3 del
  // ranking + hasta 2 limitaciones críticas. Parte del diagnóstico, no un dashboard.
  const rz = content.resumen;
  const aplicacionRank = res.ranking.find((o) => o.id === res.aplicacion_principal.id);
  const top3 = [aplicacionRank, ...res.ranking.filter((o) => o.id !== res.aplicacion_principal.id)]
    .filter(Boolean)
    .slice(0, 3);
  const rankingLis = top3.map((o) =>
    `<li><span class="dx__rank-name">${esc(o.nombre)}</span></li>`).join('');
  const limCriticas = res.limitaciones.slice(0, 2);
  const limHtml = limCriticas.length
    ? `<p class="dx__resumen-k">${esc(rz.limitacionesLabel)}:</p>
       <ul class="dx__resumen-lim">${limCriticas.map((l) => `<li>${esc(l.dato)}</li>`).join('')}</ul>`
    : '';
  const resumenHtml = `
        <aside class="dx__resumen" aria-label="Resumen del diagnóstico">
          <div class="dx__resumen-heads">
            <p class="dx__resumen-line"><span class="dx__resumen-k">${esc(rz.potencialLabel)}</span><strong>${esc(res.potencial_general)}</strong></p>
            <p class="dx__resumen-line"><span class="dx__resumen-k">${esc(rz.recomendacionLabel)}</span><strong>${esc(res.recomendacion_solucion.tipo)}</strong></p>
          </div>
          ${/BESS/.test(res.recomendacion_solucion.tipo) ? `<p class="dx__resumen-glosa">${esc(rz.bessGlosa)}</p>` : ''}
          <p class="dx__resumen-razon">${esc(res.recomendacion_solucion.razon)}</p>
          <p class="dx__resumen-k">${esc(rz.rankingLabel)}</p>
          <ol class="dx__ranking">${rankingLis}</ol>
          ${limHtml}
        </aside>`;

  const items = res.checklist.web.map((b) => `<li>${esc(b)}</li>`).join('');
  const itemsFull = res.checklist.full.map((b) => `<li>${esc(b)}</li>`).join('');

  const view = el(`
    <div class="dx__view dx__final">
      <section class="dx__diag" aria-labelledby="dx-diag-h">
        <p class="dx__diag-kicker">Diagnóstico listo</p>
        <h2 class="dx__col-title" id="dx-diag-h" data-dx-focus tabindex="-1">${esc(res.perfil)}</h2>
        ${bloqueBHtml}
        ${palancasHtml}
        ${resumenHtml}
        <p>${esc(res.dato_faltante)}</p>
        <p class="dx__close">${esc(res.cierre_llamada)}</p>
        <p class="dx__fin">${esc(res.financiamiento)}</p>
        <aside class="dx__checklist" aria-label="Qué tener a mano para la llamada">
          <h3>${esc(content.anteproyectoTituloLead)}</h3>
          <ul>${res.anteproyecto.lead.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
          <p class="dx__checklist__foot">${esc(content.checklistPie)}</p>
        </aside>
        <div class="dx__actions">
          <button type="button" class="mx-btn mx-btn--ghost" data-act="reiniciar">${esc(content.resultado.reiniciar)}</button>
        </div>
      </section>

      <section class="dx__book" aria-labelledby="dx-book-h">
        <h2 class="dx__col-title" id="dx-book-h">El siguiente paso: tu anteproyecto</h2>
        <p class="dx__col-sub">${esc(content.gate.cuerpo)}</p>
        <p class="dx__nda-aviso">${esc(content.gate.ndaAviso)}</p>
        <div class="dx__cal" id="agenda"></div>
        <p class="dx__col-sub" style="font-size:12px;margin-top:var(--space-3)">
          ${esc(content.gate.confidencialidad)}
          <a href="/aviso-de-privacidad" target="_blank" rel="noopener">Aviso de Privacidad</a>.
        </p>
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

  // Ya no hay formulario propio: el único paso es agendar en Cal. Al agendar,
  // registerBookingListener toma nombre/correo + campos extra de la reserva y
  // registra el lead (submitLead). El calendario es la única acción.

  root.replaceChildren(view);
  focusMain();
  mountCal('#agenda', res);
}

function render() {
  if (estado.paso === 'intro') return renderIntro();
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
