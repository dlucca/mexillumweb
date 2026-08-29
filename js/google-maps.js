import { GOOGLE_MAPS_KEY } from './diagnostico.config.js';

let promise = null;

// Carga el SDK de Google Maps una sola vez (places + geometry, español/MX).
export function loadGoogleMaps() {
  if (promise) return promise;
  promise = new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve(window.google);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}`
      + '&libraries=places,geometry&language=es-419&region=MX';
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error('Google Maps no cargó'));
    document.head.appendChild(s);
  });
  return promise;
}
