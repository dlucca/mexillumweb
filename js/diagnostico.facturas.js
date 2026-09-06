import { UPLOAD_URL_ENDPOINT } from './diagnostico.config.js';

const MAX_FILES = 12;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
// Misma lista blanca que api/upload-url.js: el servidor es quien manda, esto solo
// evita un viaje inútil y da un mensaje claro.
const OK_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']);
const okType = (t) => OK_TYPES.has(String(t || '').toLowerCase());

// Cargador de facturas. Mantiene tres estados por archivo (subiendo / listo / error),
// permite quitar y reintentar, y puede arrancar con archivos ya subidos (`initial`)
// para que volver a esta pantalla no pierda la lista.
// onChange recibe { paths, count, items: [{ name, path }], pending }.
export function mountFacturasUploader(container, { leadId, onChange, initial = [] }) {
  container.innerHTML = `
    <div class="dx-fac">
      <label class="dx-fac__drop" tabindex="0" role="button" aria-label="Elegir facturas para subir">
        <input class="dx-fac__input" type="file" multiple accept="image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf" hidden>
        <span>Arrastra tus facturas aquí o <strong>toca para elegir</strong> (foto o PDF, hasta ${MAX_FILES}).</span>
      </label>
      <ul class="dx-fac__list"></ul>
    </div>`;

  const input = container.querySelector('.dx-fac__input');
  const drop = container.querySelector('.dx-fac__drop');
  const list = container.querySelector('.dx-fac__list');
  const done = (Array.isArray(initial) ? initial : []).filter((d) => d && d.path).map((d) => ({ name: d.name || d.path, path: d.path }));
  let pending = 0;

  function emit() {
    onChange({ paths: done.map((d) => d.path), count: done.length, items: done.map((d) => ({ ...d })), pending });
  }

  function row(name, estado) {
    const li = document.createElement('li');
    li.className = 'dx-fac__row';
    li.innerHTML = `<span class="dx-fac__name"></span> <span class="dx-fac__state" aria-live="polite"></span> <button type="button" class="dx-fac__act" hidden></button>`;
    li.querySelector('.dx-fac__name').textContent = name;
    setState(li, estado);
    list.appendChild(li);
    return li;
  }

  function setState(li, estado) {
    li.querySelector('.dx-fac__state').textContent = estado;
    li.dataset.estado = estado;
  }

  function action(li, label, handler) {
    const btn = li.querySelector('.dx-fac__act');
    btn.textContent = label;
    btn.hidden = false;
    btn.onclick = handler;
  }

  function markDone(li, file) {
    setState(li, 'listo ✓');
    action(li, 'Quitar', () => {
      const i = done.findIndex((d) => d.path === file.path);
      if (i >= 0) done.splice(i, 1);
      li.remove();
      emit();
    });
  }

  function markError(li, file, mensaje) {
    setState(li, mensaje);
    action(li, 'Reintentar', () => { li.remove(); subirUno(file); });
  }

  async function subirUno(file) {
    if (done.length + pending >= MAX_FILES) { row(file.name, `máximo ${MAX_FILES} archivos`); return; }
    if (!okType(file.type)) { row(file.name, 'tipo no permitido (PDF, JPG, PNG, HEIC)'); return; }
    if (file.size > MAX_BYTES) { row(file.name, 'muy pesada (máx 10 MB)'); return; }
    const li = row(file.name, 'subiendo…');
    pending += 1;
    emit();
    try {
      const r = await fetch(UPLOAD_URL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, filename: file.name, contentType: file.type, size: file.size })
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || 'sign falló');
      }
      const { url, path } = await r.json();
      const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error('upload falló');
      const item = { name: file.name, path };
      done.push(item);
      markDone(li, item);
    } catch (err) {
      const msg = err && err.message && !/falló$/.test(err.message) ? err.message : 'error, intenta de nuevo';
      markError(li, file, msg);
    } finally {
      pending -= 1;
      emit();
    }
  }

  function manejar(files) {
    [...files].slice(0, MAX_FILES).forEach(subirUno);
    input.value = '';
  }

  // Archivos ya subidos en una visita anterior a esta pantalla.
  done.forEach((d) => markDone(row(d.name, 'listo ✓'), d));

  input.addEventListener('change', () => manejar(input.files));
  // Teclado: el <input> está oculto, así que el label recibe el foco y abre el selector.
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dx-fac__drop--over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dx-fac__drop--over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dx-fac__drop--over');
    if (e.dataTransfer && e.dataTransfer.files) manejar(e.dataTransfer.files);
  });
  emit();
}
