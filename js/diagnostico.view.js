import content from './diagnostico.content.js';
import { assembleResult, plantaLabel } from './diagnostico.engine.js';

const root = document.getElementById('dx-root');

// Instancia self-hosted de cal.diy y el event type para la llamada.
const CAL_ORIGIN = 'https://cal.mexillum.com';
const CAL_LINK = 'diagnostico/diagnostico-mexillum';

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
  const c = res.calculo;
  const p = res.palancas;

  // Bloque B: cadena como cuerpo; el rango de ahorro destacado tipográficamente; disclaimer
  // y matices como texto secundario. El único número que debe grabarse es el rango.
  const rangoHtml = c.sin_numero ? '' : `
        <figure class="dx__rango">
          <figcaption class="dx__rango-label">Rango estimado de ahorro</figcaption>
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
          ${palancaLi('No aplica', ' dx__palanca-tag--off', p.descarte.nombre, p.descarte.text)}
        </ul>`;

  const items = res.checklist.web.map((b) => `<li>${esc(b)}</li>`).join('');
  const itemsFull = res.checklist.full.map((b) => `<li>${esc(b)}</li>`).join('');

  const view = el(`
    <div class="dx__view dx__final">
      <section class="dx__diag" aria-labelledby="dx-diag-h">
        <p class="dx__diag-kicker">Diagnóstico listo</p>
        <h2 class="dx__col-title" id="dx-diag-h" data-dx-focus tabindex="-1">${esc(res.perfil)}</h2>
        ${bloqueBHtml}
        ${palancasHtml}
        <p>${esc(res.dato_faltante)}</p>
        <p class="dx__close">${esc(res.cierre_llamada)}</p>
        <p class="dx__fin">${esc(res.financiamiento)}</p>
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
