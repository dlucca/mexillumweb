import content from './diagnostico.content.js';
import { assembleResult } from './diagnostico.engine.js';

const root = document.getElementById('dx-root');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const estado = {
  paso: 0,                 // 0..5 = pasos; 'gate'; 'result'
  respuestas: {},
  contacto: {}
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

// Tras navegar de vista, lleva el foco al encabezado de la vista nueva para que
// AT/teclado no pierdan el lugar (y se anuncie el contexto sin un aria-live ruidoso).
function focusMain() {
  window.scrollTo(0, 0);
  const h = root.querySelector('[data-dx-focus]');
  if (h) h.focus({ preventScroll: true });
}

function renderStep() {
  const idx = estado.paso;
  const paso = content.pasos[idx];

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

  const atras = idx > 0
    ? '<button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>'
    : '<span></span>';

  const view = el(`
    <div class="dx__view">
      <p class="dx__progress">${esc(content.progresoLabel(idx + 1, content.pasos.length))}</p>
      <h2 class="dx__question" data-dx-focus tabindex="-1">${esc(paso.pregunta)}</h2>
      <div class="dx__options" role="radiogroup" aria-label="${esc(paso.pregunta)}">${opcionesHtml}</div>
      <div class="dx__nav dx__nav--end">
        ${atras}
        <button type="button" class="mx-btn mx-btn--primary" data-act="siguiente" disabled>Siguiente</button>
      </div>
    </div>`);

  const options = [...view.querySelectorAll('.dx__option')];
  const siguiente = view.querySelector('[data-act="siguiente"]');

  // Actualiza la selección en el sitio (sin re-render): así elegir una opción no
  // reanuncia toda la pregunta ni roba el foco. Gestiona el roving tabindex del radiogroup.
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
    if (!elegido && options[0]) options[0].tabIndex = 0; // punto de entrada de tabulación
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

  view.querySelector('[data-act="atras"]')?.addEventListener('click', () => {
    estado.paso -= 1;
    render();
  });
  siguiente.addEventListener('click', () => {
    if (!estado.respuestas[paso.key]) return;
    if (estado.paso < content.pasos.length - 1) estado.paso += 1;
    else estado.paso = 'gate';
    render();
  });

  paint(); // marca la selección previa al volver y fija el tabindex inicial
  root.replaceChildren(view);
  focusMain();
}

function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }

function renderGate() {
  const campos = content.gate.campos.map((f) => `
    <div class="mx-field">
      <label class="mx-field__label" for="dx-${f.name}">${esc(f.label)}</label>
      <input class="mx-input" id="dx-${f.name}" name="${f.name}" type="${f.type}"
             autocomplete="${f.autocomplete}" ${f.required ? 'required' : ''}
             aria-describedby="err-${f.name}">
      <span class="mx-field__error" id="err-${f.name}" hidden>Revisá este dato.</span>
    </div>`).join('');

  const view = el(`
    <div class="dx__view dx__gate">
      <p class="dx__progress">${esc(content.progresoLabel(content.pasos.length, content.pasos.length))} · Casi listo</p>
      <h2 class="dx__sronly" data-dx-focus tabindex="-1">Datos de contacto</h2>
      ${content.gate.intro.map((p) => `<p>${esc(p)}</p>`).join('')}
      <form novalidate aria-label="Datos de contacto">
        <input class="dx__hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        ${campos}
        <div class="dx__nav">
          <button type="button" class="mx-btn mx-btn--ghost" data-act="atras">Atrás</button>
          <button type="submit" class="mx-btn mx-btn--primary">Ver mi diagnóstico</button>
        </div>
        <p class="dx__formerr" data-formerr hidden>Revisá los campos marcados.</p>
      </form>
    </div>`);

  const form = view.querySelector('form');
  const tests = {
    nombre: (v) => v.trim().length > 1,
    empresa: (v) => v.trim().length > 1,
    correo: (v) => isEmail(v)
  };

  function mark(name, invalid) {
    const input = form.querySelector(`#dx-${name}`);
    const err = form.querySelector(`#err-${name}`);
    input.classList.toggle('mx-input--invalid', invalid);
    input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    if (err) err.hidden = !invalid;
  }

  // Forgiving: limpia el error apenas el campo se vuelve válido.
  Object.keys(tests).forEach((name) => {
    form.querySelector(`#dx-${name}`).addEventListener('input', (e) => {
      if (e.target.classList.contains('mx-input--invalid') && tests[name](e.target.value)) mark(name, false);
    });
  });

  view.querySelector('[data-act="atras"]').addEventListener('click', () => {
    estado.paso = content.pasos.length - 1;
    render();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (form.website.value) return; // honeypot: bot → no-op

    let firstBad = null;
    Object.keys(tests).forEach((name) => {
      const input = form.querySelector(`#dx-${name}`);
      const ok = tests[name](input.value);
      mark(name, !ok);
      if (!ok && !firstBad) firstBad = input;
    });
    if (firstBad) {
      form.querySelector('[data-formerr]').hidden = false;
      firstBad.focus();
      return;
    }

    estado.contacto = {
      nombre: form.nombre.value.trim(),
      empresa: form.empresa.value.trim(),
      correo: form.correo.value.trim(),
      telefono: form.telefono.value.trim(),
      cargo: form.cargo.value.trim()
    };
    estado.paso = 'result';
    render();
  });

  root.replaceChildren(view);
  focusMain();
}

function renderResult() {
  const res = assembleResult(estado, content);
  // v1: console.log. Sub-proyecto 2 conecta un endpoint real acá — cuando lo haga,
  // agregar un guard (p. ej. hasSubmitted) porque renderResult puede re-ejecutarse.
  submitLead(res.leadPayload);

  const layerB = res.layerB ? `<p>${esc(res.layerB)}</p>` : '';
  const items = res.checklist.web.map((b) => `<li>${esc(b)}</li>`).join('');
  const itemsFull = res.checklist.full.map((b) => `<li>${esc(b)}</li>`).join('');

  const view = el(`
    <div class="dx__view dx__result">
      <section class="dx__diag">
        <h2 class="dx__sronly" data-dx-focus tabindex="-1">Tu diagnóstico</h2>
        <p>${esc(res.layerA)}</p>
        ${layerB}
        <p class="dx__close">${esc(res.layerC.texto)}</p>
        <div class="dx__cta">
          <button type="button" class="mx-btn mx-btn--primary mx-btn--lg" data-act="cta">${esc(res.layerC.ctaText)}</button>
        </div>
        <div class="dx__agenda" id="agenda">
          <p>Aquí vas a poder agendar tu llamada. (Agendamiento disponible próximamente.)</p>
        </div>
        <div class="dx__actions">
          <button type="button" class="mx-btn mx-btn--secondary" data-act="print">Imprimir / Guardar PDF</button>
          <button type="button" class="mx-btn mx-btn--ghost" data-act="reiniciar">${esc(content.resultado.reiniciar)}</button>
        </div>
      </section>
      <aside class="dx__checklist" aria-label="Preparación para la llamada">
        <h3>${esc(content.checklistTitulo)}</h3>
        <ul>${items}</ul>
        <p class="dx__checklist__foot">${esc(content.checklistPie)}</p>
      </aside>
      <section class="dx__print-only dx__checklist">
        <h3>${esc(content.checklistTitulo)}</h3>
        <ul>${itemsFull}</ul>
      </section>
      <footer class="dx__print-only dx__printfoot">
        <p>mexillum — diagnóstico energético · mexillum.com · info@mexillum.com</p>
      </footer>
    </div>`);

  view.querySelector('[data-act="cta"]').addEventListener('click', () => {
    view.querySelector('#agenda').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  });
  view.querySelector('[data-act="print"]').addEventListener('click', () => window.print());
  view.querySelector('[data-act="reiniciar"]').addEventListener('click', () => {
    estado.paso = 0;
    estado.respuestas = {};
    estado.contacto = {};
    render();
  });

  root.replaceChildren(view);
  focusMain();
}

function render() {
  if (estado.paso === 'gate') return renderGate();
  if (estado.paso === 'result') return renderResult();
  return renderStep();
}

render();

// Exportado para tests futuros / integraciones. En v1 solo loguea.
export function submitLead(payload) {
  console.log('[diagnostico] leadPayload', payload);
}
