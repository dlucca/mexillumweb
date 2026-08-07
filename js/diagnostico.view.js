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

function focusMain() {
  if (!reduce) root.scrollTo?.({ top: 0 });
  window.scrollTo(0, 0);
}

function renderStep() {
  const idx = estado.paso;
  const paso = content.pasos[idx];
  const elegido = estado.respuestas[paso.key];

  const opciones = paso.opciones.map((o) => {
    const on = elegido === o.codigo;
    return `
      <button type="button" class="dx__option" data-codigo="${esc(o.codigo)}" role="radio" aria-checked="${on}">
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
  const siguienteDisabled = elegido ? '' : 'disabled';

  const view = el(`
    <div class="dx__view">
      <p class="dx__progress">${esc(content.progresoLabel(idx + 1, content.pasos.length))}</p>
      <h2 class="dx__question">${esc(paso.pregunta)}</h2>
      <div class="dx__options" role="radiogroup" aria-label="${esc(paso.pregunta)}">${opciones}</div>
      <div class="dx__nav dx__nav--end">
        ${atras}
        <button type="button" class="mx-btn mx-btn--primary" data-act="siguiente" ${siguienteDisabled}>Siguiente</button>
      </div>
    </div>`);

  view.querySelectorAll('.dx__option').forEach((btn) => {
    btn.addEventListener('click', () => {
      estado.respuestas[paso.key] = btn.dataset.codigo;
      renderStep(); // re-render marca la selección y habilita "Siguiente"
    });
  });
  view.querySelector('[data-act="atras"]')?.addEventListener('click', () => {
    estado.paso -= 1;
    render();
  });
  view.querySelector('[data-act="siguiente"]').addEventListener('click', () => {
    if (!estado.respuestas[paso.key]) return;
    if (estado.paso < content.pasos.length - 1) estado.paso += 1;
    else estado.paso = 'gate';
    render();
  });

  root.replaceChildren(view);
  focusMain();
}

function renderGate() {
  root.replaceChildren(el('<p>Gate — se implementa en Task 6</p>'));
}

function renderResult() {
  root.replaceChildren(el('<p>Resultado — se implementa en Task 7</p>'));
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
