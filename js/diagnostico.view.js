// Arranque de la versión industrial del diagnóstico. Contenido y Cal actuales,
// sin `origen`: runtime idéntico al histórico. Toda la lógica vive en app.js.
import content from './diagnostico.content.js?v=16';
import { initDiagnostico } from './diagnostico.app.js?v=16';

initDiagnostico({ content, calLink: 'diagnostico/diagnostico-mexillum', origen: 'industria-comercio' });
