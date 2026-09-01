// Arranque de la versión de hoteles. Reusa el núcleo con contenido hotelero,
// su propio evento de Cal y el marcador de lead `hoteles`.
import content from './diagnostico.hoteles.content.js?v=11';
import { initDiagnostico } from './diagnostico.app.js?v=11';

initDiagnostico({ content, calLink: 'diagnostico/diagnostico-hoteles', origen: 'hoteles' });
