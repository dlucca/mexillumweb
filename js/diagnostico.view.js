// Arranque de la versión industrial del diagnóstico. Contenido y Cal actuales,
// sin `origen`: runtime idéntico al histórico. Toda la lógica vive en app.js.
import content from './diagnostico.content.js';
import { initDiagnostico } from './diagnostico.app.js';

initDiagnostico({ content, calLink: 'diagnostico/diagnostico-mexillum', origen: undefined });
