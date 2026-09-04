import { loadGoogleMaps } from './google-maps.js';

const MEXICO_CENTER = { lat: 23.6345, lng: -102.5528 };
const ROOF_COLOR = '#1a73e8';

// Monta el mapa del sitio. Puede dibujar varias áreas y ubicar un punto eléctrico
// independiente (acometida, medidor, transformador, subestación o tablero).
export function mountRoofPicker(container, { onLocation, onRoof, onServicePoint, allowRoof = true }) {
  const roofControls = allowRoof ? `
          <button type="button" class="dx-roof__add">+ Agregar otra área</button>
          <button type="button" class="dx-roof__clear">Borrar áreas</button>` : '';
  container.innerHTML = `
    <div class="dx-roof">
      <div class="dx-roof__bar">
        <input class="dx-roof__input" type="text" placeholder="Escribe tu dirección" aria-label="Dirección">
        <button type="button" class="mx-btn mx-btn--ghost dx-roof__loc">Usar mi ubicación</button>
      </div>
      <div class="dx-roof__mapwrap">
        <div class="dx-roof__map" role="application" aria-label="Mapa para ubicar el espacio y el punto eléctrico"></div>
        <div class="dx-roof__controls" hidden>
          ${roofControls}
        </div>
      </div>
      <p class="dx-roof__status dx__col-sub">Cargando mapa…</p>
      <section class="dx-roof__service" aria-labelledby="dx-service-title">
        <div class="dx-roof__service-copy">
          <p class="dx-roof__eyebrow">Punto eléctrico · opcional</p>
          <h3 id="dx-service-title">¿Dónde está la acometida?</h3>
          <p>Marca el punto aproximado del medidor, transformador, subestación o tablero principal.</p>
        </div>
        <button type="button" class="mx-btn mx-btn--ghost dx-roof__service-btn" disabled>Marcar en el mapa</button>
        <div class="dx-roof__service-fields" hidden>
          <label>Tipo de punto
            <select class="dx-roof__service-type">
              <option value="acometida">Acometida o medidor</option>
              <option value="transformador">Transformador</option>
              <option value="subestacion">Subestación</option>
              <option value="tablero_general">Tablero general</option>
              <option value="otro">Otro punto eléctrico</option>
            </select>
          </label>
          <label>Precisión
            <select class="dx-roof__service-precision">
              <option value="aproximada">Aproximada</option>
              <option value="exacta">Exacta</option>
            </select>
          </label>
          <label>Capacidad (kVA, opcional)
            <input class="dx-roof__service-capacity" type="number" min="1" step="1" inputmode="numeric" placeholder="Ej. 500">
          </label>
          <button type="button" class="dx-roof__service-clear">Quitar punto</button>
        </div>
        <p class="dx-roof__service-status" aria-live="polite">Si no lo sabes, puedes continuar sin marcarlo.</p>
      </section>
    </div>`;

  const inputEl = container.querySelector('.dx-roof__input');
  const mapEl = container.querySelector('.dx-roof__map');
  const statusEl = container.querySelector('.dx-roof__status');
  const locBtn = container.querySelector('.dx-roof__loc');
  const controlsEl = container.querySelector('.dx-roof__controls');
  const addBtn = container.querySelector('.dx-roof__add');
  const clearBtn = container.querySelector('.dx-roof__clear');
  const serviceBtn = container.querySelector('.dx-roof__service-btn');
  const serviceFields = container.querySelector('.dx-roof__service-fields');
  const serviceType = container.querySelector('.dx-roof__service-type');
  const servicePrecision = container.querySelector('.dx-roof__service-precision');
  const serviceCapacity = container.querySelector('.dx-roof__service-capacity');
  const serviceClear = container.querySelector('.dx-roof__service-clear');
  const serviceStatus = container.querySelector('.dx-roof__service-status');

  let g = null, map = null, locationMarker = null, serviceMarker = null;
  let mode = allowRoof ? 'roof' : 'idle';
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
      setStatus('Toca cada esquina de un área disponible (techo, área verde, estacionamiento…). Mínimo 3 esquinas. Marca todas las que puedas usar.');
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
      map, editable: true, clickable: false, fillColor: ROOF_COLOR, fillOpacity: 0.25,
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

  function servicePayload() {
    if (!serviceMarker) return null;
    const pos = serviceMarker.getPosition();
    const rawCapacity = Number(serviceCapacity.value);
    return {
      lat: pos.lat(),
      lng: pos.lng(),
      tipo: serviceType.value,
      precision: servicePrecision.value,
      capacidad_kva: Number.isFinite(rawCapacity) && rawCapacity > 0 ? rawCapacity : null
    };
  }

  function emitServicePoint() {
    onServicePoint?.(servicePayload());
  }

  function finishServiceMode() {
    mode = allowRoof ? 'roof' : 'idle';
    map?.setOptions({ draggableCursor: null });
  }

  function placeServicePoint(latLng) {
    if (serviceMarker) serviceMarker.setMap(null);
    serviceMarker = new g.maps.Marker({
      position: latLng,
      map,
      draggable: true,
      title: 'Punto eléctrico',
      label: { text: 'E', color: '#ffffff', fontWeight: '700' }
    });
    serviceMarker.addListener('dragend', () => {
      serviceStatus.textContent = 'Punto actualizado. Puedes ajustar el tipo y la precisión.';
      emitServicePoint();
    });
    serviceFields.hidden = false;
    serviceBtn.textContent = 'Mover punto en el mapa';
    serviceStatus.textContent = 'Punto marcado. Arrástralo para ajustar su ubicación.';
    finishServiceMode();
    emitServicePoint();
  }

  function clearServicePoint() {
    if (serviceMarker) serviceMarker.setMap(null);
    serviceMarker = null;
    serviceFields.hidden = true;
    serviceCapacity.value = '';
    serviceBtn.textContent = 'Marcar en el mapa';
    serviceStatus.textContent = 'Si no lo sabes, puedes continuar sin marcarlo.';
    finishServiceMode();
    onServicePoint?.(null);
  }

  // Empieza (o reinicia) el dibujo: un área nueva vacía y el click del mapa.
  function startDraw() {
    if (!allowRoof) return;
    clearAll();
    newCurrent();
    mapListeners.push(map.addListener('click', (e) => {
      if (!e.latLng) return;
      if (mode === 'service') placeServicePoint(e.latLng);
      else if (mode === 'roof' && current) current.getPath().push(e.latLng);
    }));
    controlsEl.hidden = false;
    recompute();
  }

  addBtn?.addEventListener('click', () => {
    if (!current || current.getPath().getLength() < 3) {
      setStatus('Marca al menos 3 esquinas antes de agregar otra área.');
      return;
    }
    polys.push(current);   // cierra la actual (queda editable)
    newCurrent();          // empieza una nueva
    recompute();
    // Feedback claro: recompute deja el total; lo sustituimos por la instrucción.
    setStatus(`Área ${polys.length} lista ✓ — ahora toca las esquinas de la siguiente.`);
  });

  clearBtn?.addEventListener('click', () => { startDraw(); });

  serviceBtn.addEventListener('click', () => {
    if (!map) return;
    mode = 'service';
    map.setOptions({ draggableCursor: 'crosshair' });
    serviceStatus.textContent = 'Toca el mapa donde está el punto eléctrico.';
  });
  [serviceType, servicePrecision].forEach((field) => field.addEventListener('change', emitServicePoint));
  serviceCapacity.addEventListener('input', emitServicePoint);
  serviceClear.addEventListener('click', clearServicePoint);

  function goTo(lat, lng, direccion) {
    map.setCenter({ lat, lng });
    map.setZoom(20);
    if (locationMarker) locationMarker.setMap(null);
    locationMarker = new g.maps.Marker({
      position: { lat, lng }, map, title: 'Ubicación buscada',
      icon: {
        path: g.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#1f7a3d', fillOpacity: 1,
        strokeColor: '#ffffff', strokeWeight: 2
      }
    });
    clearServicePoint();
    onLocation({ direccion, lat, lng });
    if (allowRoof) startDraw();
    else setStatus('Ubicación lista. Ahora puedes marcar el punto eléctrico principal.');
  }

  loadGoogleMaps().then((google) => {
    g = google;
    map = new g.maps.Map(mapEl, {
      center: MEXICO_CENTER, zoom: 5, mapTypeId: 'satellite', tilt: 0,
      streetViewControl: false, fullscreenControl: false, mapTypeControl: false
    });
    serviceBtn.disabled = false;
    if (!allowRoof) {
      mapListeners.push(map.addListener('click', (e) => {
        if (mode === 'service' && e.latLng) placeServicePoint(e.latLng);
      }));
    }
    const ac = new g.maps.places.Autocomplete(inputEl, {
      componentRestrictions: { country: 'mx' }, fields: ['formatted_address', 'geometry']
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const loc = place.geometry && place.geometry.location;
      if (!loc) return;
      goTo(loc.lat(), loc.lng(), place.formatted_address || undefined);
    });
    setStatus(allowRoof
      ? 'Busca tu dirección. Luego marca todas las áreas disponibles (techos, áreas verdes, estacionamientos…) y, si la conoces, la acometida.'
      : 'Busca tu dirección. Luego marca la acometida o el punto eléctrico principal.');
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
