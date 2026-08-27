// Arranque de la versión de hoteles. Reusa el núcleo con contenido hotelero,
// su propio evento de Cal y el marcador de lead `hoteles`.
import content from './diagnostico.hoteles.content.js';
import { initDiagnostico } from './diagnostico.app.js';

initDiagnostico({ content, calLink: 'diagnostico/diagnostico-hoteles', origen: 'hoteles' });
