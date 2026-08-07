import content from './diagnostico.content.js';
import { assembleResult } from './diagnostico.engine.js';

const root = document.getElementById('dx-root');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Instancia de cal.diy (self-hosted en Railway, dominio propio) y el event type para la llamada.
const CAL_ORIGIN = 'https://cal.mexillum.com';
const CAL_LINK = 'dlucca/30min';

const estado = {
  paso: 0,                 // 0..5 = pasos; 'result' (diagnóstico + agenda, sin gate previo)
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
    else estado.paso = 'result'; // tras la última pregunta, directo al diagnóstico + agenda
    render();
  });

  paint(); // marca la selección previa al volver y fija el tabindex inicial
  root.replaceChildren(view);
  focusMain();
}

// ---- Integración cal.diy (embed inline) --------------------------------------

// Carga el loader oficial de Cal una sola vez.
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

// Nota que viaja adjunta al evento agendado, para que Mexillum reciba el contexto.
function buildNote(res, resp) {
  const legibles = res.leadPayload.respuestas_legibles;
  const preguntas = [
    ['Tipo de instalación', legibles.tipo_instalacion],
    ['Generación propia', legibles.generacion_propia],
    ['Patrón de operación', legibles.patron_operacion],
    ['Interrupciones', legibles.interrupciones],
    ['Diésel/red débil', legibles.diesel_red_debil],
    ['Exporta excedente', legibles.exporta_excedente]
  ];
  return [
    'Diagnóstico Mexillum',
    '',
    res.layerB ? `${res.layerA} ${res.layerB}` : res.layerA,
    res.layerC.texto,
    '',
    'Preparar para la llamada:',
    ...res.checklist.full.map((b) => `• ${b}`),
    '',
    'Respuestas del formulario:',
    ...preguntas.map(([k, v], i) => `${i + 1}. ${k}: ${v}`)
  ].join('\n');
}

let calBookingHooked = false;
function mountCal(selector, res) {
  loadCal();
  window.Cal('inline', {
    elementOrSelector: selector,
    calLink: CAL_LINK,
    layout: 'month_view',
    config: { notes: buildNote(res, estado.respuestas), theme: 'light' }
  });
  window.Cal('ui', { layout: 'month_view', hideEventTypeDetails: false });

  // Costura: cuando la reserva se concreta, registrar el lead (contacto desde cal.diy).
  if (!calBookingHooked) {
    calBookingHooked = true;
    window.Cal('on', {
      action: 'bookingSuccessful',
      callback: (e) => {
        try {
          const data = e && e.detail && e.detail.data;
          const booking = data && (data.booking || data.confirmed || data);
          const at = booking && booking.attendees && booking.attendees[0];
          if (at) estado.contacto = { ...estado.contacto, nombre: at.name || '', correo: at.email || '' };
          if (booking && booking.startTime) estado.bookingDatetime = booking.startTime;
        } catch (_) { /* el formato del evento puede variar entre versiones */ }
        submitLead(assembleResult(estado, content).leadPayload);
      }
    });
  }
}

// Pantalla final: diagnóstico a la derecha; agenda (calendario cal.diy + checklist) a la izquierda.
function renderResult() {
  const res = assembleResult(estado, content);

  // Ensamblado (§6.4): Capa A + Capa B (si aplica) en un párrafo, luego el cierre de Capa C.
  const cuerpo = res.layerB ? `${esc(res.layerA)} ${esc(res.layerB)}` : esc(res.layerA);
  const items = res.checklist.web.map((b) => `<li>${esc(b)}</li>`).join('');
  const itemsFull = res.checklist.full.map((b) => `<li>${esc(b)}</li>`).join('');

  const view = el(`
    <div class="dx__view dx__final">
      <section class="dx__diag" aria-labelledby="dx-diag-h">
        <h2 class="dx__sronly" id="dx-diag-h" data-dx-focus tabindex="-1">Tu diagnóstico</h2>
        <p>${cuerpo}</p>
        <p class="dx__close">${esc(res.layerC.texto)}</p>
        <div class="dx__actions">
          <button type="button" class="mx-btn mx-btn--secondary" data-act="print">Imprimir / Guardar PDF</button>
          <button type="button" class="mx-btn mx-btn--ghost" data-act="reiniciar">${esc(content.resultado.reiniciar)}</button>
        </div>
      </section>

      <section class="dx__book" aria-labelledby="dx-book-h">
        <h2 class="dx__col-title" id="dx-book-h">Agenda una conversación</h2>
        <p class="dx__col-sub">Elegí un horario y coordinamos una llamada para revisar tu diagnóstico a fondo. Adjuntamos automáticamente tu diagnóstico a la reunión.</p>
        <div class="dx__cal" id="agenda"></div>

        <aside class="dx__checklist" aria-label="Preparación para la llamada">
          <h3>${esc(content.checklistTitulo)}</h3>
          <ul>${items}</ul>
          <p class="dx__checklist__foot">${esc(content.checklistPie)}</p>
        </aside>
      </section>

      <section class="dx__print-only dx__checklist">
        <h3>${esc(content.checklistTitulo)}</h3>
        <ul>${itemsFull}</ul>
      </section>
      <footer class="dx__print-only dx__printfoot">
        <p>mexillum — diagnóstico energético · mexillum.com · info@mexillum.com</p>
      </footer>
    </div>`);

  view.querySelector('[data-act="print"]').addEventListener('click', () => window.print());
  view.querySelector('[data-act="reiniciar"]').addEventListener('click', () => {
    estado.paso = 0;
    estado.respuestas = {};
    estado.contacto = {};
    render();
  });

  root.replaceChildren(view);
  focusMain();
  mountCal('#agenda', res); // el elemento #agenda ya está en el DOM
}

function render() {
  if (estado.paso === 'result') return renderResult();
  return renderStep();
}

render();

// Exportado para tests futuros / integraciones. En v1 solo loguea.
export function submitLead(payload) {
  console.log('[diagnostico] leadPayload', payload);
}
