import { loadGoogleMaps } from './google-maps.js';

const MEXICO_CENTER = { lat: 23.6345, lng: -102.5528 };
const ROOF_COLOR = '#1a73e8';

// Monta el mapa y el flujo de dibujo dentro de `container`.
// Llama onLocation al fijar dirección/ubicación y onRoof al cambiar el polígono.
export function mountRoofPicker(container, { onLocation, onRoof }) {
  container.innerHTML = `
    <div class="dx-roof">
      <div class="dx-roof__bar">
        <input class="dx-roof__input" type="text" placeholder="Escribe tu dirección" aria-label="Dirección">
        <button type="button" class="mx-btn mx-btn--ghost dx-roof__loc">Usar mi ubicación</button>
      </div>
      <div class="dx-roof__map" role="application" aria-label="Mapa para dibujar el techo"></div>
      <p class="dx-roof__status dx__col-sub">Cargando mapa…</p>
    </div>`;

  const inputEl = container.querySelector('.dx-roof__input');
  const mapEl = container.querySelector('.dx-roof__map');
  const statusEl = container.querySelector('.dx-roof__status');
  const locBtn = container.querySelector('.dx-roof__loc');

  let g = null, map = null, marker = null, poly = null;
  const listeners = [];

  function setStatus(msg) { statusEl.textContent = msg; }

  function clearDraw() {
    listeners.forEach((l) => l.remove());
    listeners.length = 0;
    if (poly) { poly.setMap(null); poly = null; }
  }

  function startDraw() {
    clearDraw();
    poly = new g.maps.Polygon({
      map, editable: true, fillColor: ROOF_COLOR, fillOpacity: 0.25,
      strokeColor: ROOF_COLOR, strokeWeight: 2
    });
    const recompute = () => {
      const path = poly.getPath();
      if (path.getLength() < 3) return;
      const area = g.maps.geometry.spherical.computeArea(path);
      const poligono = path.getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }));
      setStatus(`Área marcada: ~${Math.round(area).toLocaleString('es-MX')} m². Arrastra los puntos para ajustar.`);
      onRoof({ area_m2: area, poligono });
    };
    listeners.push(map.addListener('click', (e) => { if (e.latLng) poly.getPath().push(e.latLng); }));
    const path = poly.getPath();
    listeners.push(path.addListener('insert_at', recompute));
    listeners.push(path.addListener('set_at', recompute));
    listeners.push(path.addListener('remove_at', recompute));
    setStatus('Toca cada esquina de tu techo en el mapa (mínimo 3).');
  }

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
