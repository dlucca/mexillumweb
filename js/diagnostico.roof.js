import { loadGoogleMaps } from './google-maps.js';

const MEXICO_CENTER = { lat: 23.6345, lng: -102.5528 };
const ROOF_COLOR = '#1a73e8';

// Monta el mapa y el flujo de dibujo dentro de `container`.
// Permite marcar VARIAS áreas (una por techo/nave). Llama onLocation al fijar
// dirección/ubicación y onRoof con el total y todos los polígonos.
export function mountRoofPicker(container, { onLocation, onRoof }) {
  container.innerHTML = `
    <div class="dx-roof">
      <div class="dx-roof__bar">
        <input class="dx-roof__input" type="text" placeholder="Escribe tu dirección" aria-label="Dirección">
        <button type="button" class="mx-btn mx-btn--ghost dx-roof__loc">Usar mi ubicación</button>
      </div>
      <div class="dx-roof__map" role="application" aria-label="Mapa para dibujar el techo"></div>
      <p class="dx-roof__status dx__col-sub">Cargando mapa…</p>
      <div class="dx-roof__controls" hidden>
        <button type="button" class="mx-btn mx-btn--ghost dx-roof__add">+ Agregar otra área</button>
        <button type="button" class="dx__skip dx-roof__clear">Borrar todo</button>
      </div>
    </div>`;

  const inputEl = container.querySelector('.dx-roof__input');
  const mapEl = container.querySelector('.dx-roof__map');
  const statusEl = container.querySelector('.dx-roof__status');
  const locBtn = container.querySelector('.dx-roof__loc');
  const controlsEl = container.querySelector('.dx-roof__controls');
  const addBtn = container.querySelector('.dx-roof__add');
  const clearBtn = container.querySelector('.dx-roof__clear');

  let g = null, map = null, marker = null;
  let polys = [];        // áreas ya cerradas (editables)
  let current = null;    // área que se está dibujando
  const mapListeners = []; // listeners a nivel mapa (click)

  function setStatus(msg) { statusEl.textContent = msg; }

  const puntos = (p) => p.getPath().getArray().map((pt) => ({ lat: pt.lat(), lng: pt.lng() }));
  const areaDe = (p) => p.getPath().getLength() >= 3
    ? g.maps.geometry.spherical.computeArea(p.getPath())
    : 0;

  // Recalcula el total sobre todas las áreas con 3+ esquinas y avisa a onRoof.
  function recompute() {
    const todas = current ? [...polys, current] : [...polys];
    const validas = todas.filter((p) => p.getPath().getLength() >= 3);
    const total = validas.reduce((s, p) => s + areaDe(p), 0);
    const poligonos = validas.map(puntos);
    const n = validas.length;
    if (n === 0) {
      setStatus('Toca cada esquina de tu techo en el mapa (mínimo 3).');
    } else {
      const m2 = Math.round(total).toLocaleString('es-MX');
      setStatus(`${n} ${n === 1 ? 'área' : 'áreas'} · Total ~${m2} m². Arrastra los puntos para ajustar, o agrega otra área.`);
    }
    onRoof({ area_m2: total, poligonos });
  }

  // Cada polígono recalcula el total al editar sus vértices.
  function attachPoly(p) {
    const path = p.getPath();
    path.addListener('insert_at', recompute);
    path.addListener('set_at', recompute);
    path.addListener('remove_at', recompute);
  }

  function newCurrent() {
    current = new g.maps.Polygon({
      map, editable: true, fillColor: ROOF_COLOR, fillOpacity: 0.25,
      strokeColor: ROOF_COLOR, strokeWeight: 2
    });
    attachPoly(current);
  }

  function clearAll() {
    polys.forEach((p) => p.setMap(null));
    polys = [];
    if (current) { current.setMap(null); current = null; }
    mapListeners.forEach((l) => l.remove());
    mapListeners.length = 0;
  }

  // Empieza (o reinicia) el dibujo: un área nueva vacía y el click del mapa.
  function startDraw() {
    clearAll();
    newCurrent();
    mapListeners.push(map.addListener('click', (e) => {
      if (e.latLng && current) current.getPath().push(e.latLng);
    }));
    controlsEl.hidden = false;
    recompute();
  }

  addBtn.addEventListener('click', () => {
    if (!current || current.getPath().getLength() < 3) {
      setStatus('Marca al menos 3 esquinas antes de agregar otra área.');
      return;
    }
    polys.push(current);   // cierra la actual (queda editable)
    newCurrent();          // empieza una nueva
    recompute();
  });

  clearBtn.addEventListener('click', () => { startDraw(); });

  function goTo(lat, lng, direccion) {
    map.setCenter({ lat, lng });
    map.setZoom(20);
    if (marker) marker.setMap(null);
    marker = new g.maps.Marker({ position: { lat, lng }, map });
    onLocation({ direccion, lat, lng });
    startDraw();
  }

  loadGoogleMaps().then((google) => {
    g = google;
    map = new g.maps.Map(mapEl, {
      center: MEXICO_CENTER, zoom: 5, mapTypeId: 'satellite', tilt: 0,
      streetViewControl: false, fullscreenControl: false, mapTypeControl: false
    });
    const ac = new g.maps.places.Autocomplete(inputEl, {
      componentRestrictions: { country: 'mx' }, fields: ['formatted_address', 'geometry']
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const loc = place.geometry && place.geometry.location;
      if (!loc) return;
      goTo(loc.lat(), loc.lng(), place.formatted_address || undefined);
    });
    setStatus('Busca tu dirección o usa tu ubicación. Luego dibujas tu techo.');
  }).catch(() => setStatus('No pudimos cargar el mapa. Revisa tu conexión e intenta de nuevo.'));

  locBtn.addEventListener('click', () => {
    if (!navigator.geolocation) return;
    setStatus('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (pos) => goTo(pos.coords.latitude, pos.coords.longitude),
      () => setStatus('No pudimos obtener tu ubicación. Escribe tu dirección.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
