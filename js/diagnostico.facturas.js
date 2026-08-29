import { UPLOAD_URL_ENDPOINT } from './diagnostico.config.js';

const MAX_FILES = 12;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const okType = (t) => t === 'application/pdf' || (typeof t === 'string' && t.startsWith('image/'));

export function mountFacturasUploader(container, { leadId, onChange }) {
  container.innerHTML = `
    <div class="dx-fac">
      <label class="dx-fac__drop">
        <input class="dx-fac__input" type="file" multiple accept="image/*,application/pdf" hidden>
        <span>Arrastra tus facturas aquí o <strong>toca para elegir</strong> (foto o PDF, hasta ${MAX_FILES}).</span>
      </label>
      <ul class="dx-fac__list"></ul>
    </div>`;

  const input = container.querySelector('.dx-fac__input');
  const drop = container.querySelector('.dx-fac__drop');
  const list = container.querySelector('.dx-fac__list');
  const done = []; // { path }

  function emit() { onChange({ paths: done.map((d) => d.path), count: done.length }); }

  function row(name, estado) {
    const li = document.createElement('li');
    li.className = 'dx-fac__row';
    li.innerHTML = `<span class="dx-fac__name"></span> <span class="dx-fac__state"></span>`;
    li.querySelector('.dx-fac__name').textContent = name;
    li.querySelector('.dx-fac__state').textContent = estado;
    list.appendChild(li);
    return li;
  }

  async function subirUno(file) {
    if (done.length >= MAX_FILES) return;
    if (!okType(file.type)) { row(file.name, 'tipo no permitido'); return; }
    if (file.size > MAX_BYTES) { row(file.name, 'muy pesada (máx 10 MB)'); return; }
    const li = row(file.name, 'subiendo…');
    const estadoEl = li.querySelector('.dx-fac__state');
    try {
      const r = await fetch(UPLOAD_URL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, filename: file.name, contentType: file.type })
      });
      if (!r.ok) throw new Error('sign falló');
      const { url, path } = await r.json();
      const put = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error('upload falló');
      done.push({ path });
      estadoEl.textContent = 'listo ✓';
      emit();
    } catch {
      estadoEl.textContent = 'error, intenta de nuevo';
    }
  }

  function manejar(files) {
    [...files].slice(0, MAX_FILES).forEach(subirUno);
  }

  input.addEventListener('change', () => manejar(input.files));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dx-fac__drop--over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dx-fac__drop--over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dx-fac__drop--over');
    if (e.dataTransfer && e.dataTransfer.files) manejar(e.dataTransfer.files);
  });
}
