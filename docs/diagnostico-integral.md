# Diagnóstico de consumo: criterio y alcance

El objetivo inicial es maximizar cobertura solar útil y ahorro operativo. Inversión, recuperación y selección comercial de equipos quedan para la propuesta técnica. Cada servicio se calcula independientemente; el resumen agrega sus resultados sin compartir energía ni duplicar superficies.

## Lectura y datos

- La IA extrae hechos, no ahorros. Tarifa, servicio, periodos, kWh por franja, demandas, cargos, IVA y saldos tienen campos separados.
- Cuando no hay total de kWh impreso y están las tres franjas, el servidor hace la suma exacta. Se registra la derivación. Un total impreso contradictorio permanece en revisión.
- Los precios se reconstruyen por factura: generación de cada franja / kWh de esa franja + transmisión, CENACE y SCnMEM / kWh total. No se convierten cargos de capacidad o distribución en precios de energía evitables.
- Se concilian componentes, subtotal, IVA, facturación del periodo y saldo final. Los desconocidos permanecen nulos, nunca son precios cero.
- Los campos legibles marcados como dudosos activan como máximo una segunda lectura independiente por página. Solo se despejan dudas cuando los valores coinciden y la segunda lectura los identifica con claridad; los consumos por franja ausentes pueden recuperarse en esa segunda lectura si son legibles. El cotejo, las recuperaciones y ambos consumos de API quedan registrados.
- Procesado sin alertas y confirmado por el usuario son estados distintos. La estimación puede usar datos automáticos provisionales; las inconsistencias relevantes bloquean el periodo y explican su causa.
- Las lecturas anteriores pueden actualizarse desde el archivo guardado, con intentos limitados por versión. Se conservan correcciones, originales y hasta tres lecturas anteriores. Las coincidencias ambiguas requieren resolución explícita.
- Los archivos nuevos tienen huella SHA-256 calculada en el servidor. Una segunda subida de los mismos bytes no crea otra lectura.

## Operación y simulación

- Se omiten preguntas de tarifa e importe si ya hay lecturas utilizables. El cuestionario pide actividad, equipos existentes y datos de instalación.
- Las respuestas estructuradas de horario y reducción de actividad afectan el perfil. Los comentarios libres son contexto para el asesor, no se interpretan como medición.
- El calendario GDMTH incluye reglas verificadas para 2025–2026 de SIN, BC y BCS, temporadas, fines de semana y festivos. Una tarifa o año sin regla verificada queda pendiente.
- El perfil conserva los kWh por franja y respeta las demandas máximas disponibles. No reemplaza una curva de 15 minutos. Usa días civiles de 24 horas y no resuelve intervalos de cambio de reloj.
- PVGIS 5.2 / NSRDB aporta una serie mensual cuando hay ubicación. Ante indisponibilidad se identifica el rendimiento supuesto. La forma horaria solar sigue siendo una aproximación, sin clima diario medido.
- El espacio se asigna por servicio. Vacío significa pendiente; cero significa sin solar. Las asignaciones no pueden exceder el área marcada.
- Se dimensionan solar, batería y combinación por separado. La búsqueda compara cobertura útil, después ahorro, y reduce tamaño dentro de una tolerancia de 0.1%. No garantiza un óptimo global ni de inversión.
- El despacho conserva inventario de batería entre días y facturas contiguas con previsión ideal de 48 horas. Cada tramo documental empieza y termina vacío; no se transporta energía por huecos de datos.
- La carga de red solo ocurre en base. Se respetan capacidad utilizable, potencia, pérdidas y holgura de compra de red. Se descarga en periodos más caros cuando el diferencial cubre las pérdidas.
- Capacidad, distribución y cargos fijos permanecen. El ajuste observado de factor de potencia se aplica proporcionalmente a la diferencia de energía solo con factura conciliada.
- No se atribuye ahorro por demanda, respaldo, compensación de excedentes, inversión, mantenimiento ni degradación. Los sistemas existentes requieren datos de generación y operación para distinguir consumo bruto de compras netas.

## Resultado y mantenimiento

El resumen muestra tamaños, m², origen del recurso solar, escenarios, precios y cálculo por factura y causa de cada exclusión. Los equivalentes anuales de muestras incompletas se identifican como extrapolaciones. Si los servicios no tienen periodos comparables, el resumen es parcial.

La simulación corre en un worker para mantener la interfaz disponible. Se cancela al cambiar de pantalla. Al cambiar módulos, actualizar coherentemente las versiones del importador, worker y dependencias; comprobar el enlace con reglas de URL de navegador.

Pruebas: `npm test`; las de expediente cubren API, extracción y costes, derivaciones, calendario, balance energético, relectura, servicios, superficies, formularios y enlaces de módulos. La factura de enero de 2026 se usa como regresión aritmética con identificadores anonimizados. No incluir claves, enlaces de acceso ni PDFs reales en el repositorio.
