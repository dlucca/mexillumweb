// Configuración de cliente del diagnóstico.
// GOOGLE_MAPS_KEY es una llave de NAVEGADOR: es pública por diseño y se protege
// restringiéndola por referrer (HTTP referrer) a mexillum.com en Google Cloud.
// Pega aquí la llave restringida antes de desplegar.
export const GOOGLE_MAPS_KEY = 'AIzaSyC5s4M9YvG00c3X083jfDNaHFIxIM-irpE';

// Endpoint que firma las subidas de facturas a Supabase Storage.
export const UPLOAD_URL_ENDPOINT = '/api/upload-url';
