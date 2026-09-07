// Arranque de la versión industrial del diagnóstico. Contenido y Cal actuales,
// sin `origen`: runtime idéntico al histórico. Toda la lógica vive en app.js.
import content from './diagnostico.content.js?v=17';
import { initDiagnostico } from './diagnostico.app.js?v=17';

initDiagnostico({ content, calLink: 'diagnostico/diagnostico-mexillum', origen: 'industria-comercio' });
