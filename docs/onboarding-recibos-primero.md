# Expediente de prospectos: recibos primero

Implementación del recorrido acordado para prospectos enviados por un asesor. El flujo público de cuestionario se mantiene; `?rapido` abre el expediente nuevo.

## Recorrido

1. El asesor entra en `/asesor`, se autentica con la clave interna y registra contacto, sitio y datos conocidos. Crear el enlace **no envía correos**.
2. El enlace individual abre `?rapido#exp=...` directamente en recibos. El token viaja en el fragmento, no en consultas de URLs del servidor. Permite leer y editar ese único expediente durante 30 días: es confidencial.
3. Recibos PDF combinados y JPG/PNG/WebP: hasta 25 MiB y 60 páginas por PDF, 36 archivos y 250 MiB por expediente; hasta 150 lecturas extraídas. HEIC requiere conversión a JPG en esta versión. La cantidad de archivos no se confunde con meses.
4. Lectura automática con OpenAI Responses, GPT-5.4 mini, razonamiento bajo, detalle visual alto, procesamiento estándar, salida estructurada y `store:false`. Cada intento procesa todas las páginas por separado, con hasta cuatro llamadas simultáneas y tres intentos máximos por archivo. El servidor divide el PDF en memoria y fija la página de origen; el modelo nunca decide esa referencia. Los reversos e históricos se omiten. Si falla una página, no se guardan recibos parciales. Importe del periodo con IVA separado del subtotal y de los cargos individuales. Los textos del documento se tratan como datos no confiables.
5. La revisión permite corregir campos y conservar el original y la página. Los datos dudosos, duplicados, servicios distintos y superposiciones se señalan. Solo las lecturas confirmadas y consistentes alimentan las sumas. Cobertura documental y validación económica son indicadores distintos.
6. El formulario solicita objetivo, calendario, equipos, alcance del medidor y síntomas de calidad. No pide tarifa ni importe si hay recibos confirmados utilizables. Pide valores manuales explícitos si faltan. Preguntas de continuidad, ampliación y solar aparecen según las respuestas.
7. El mapa recupera ubicación, polígonos y punto eléctrico. Propone la dirección del recibo, pendiente de confirmación; se puede omitir. Tipos por área: techo, estacionamiento, terreno u otro.
8. El resumen presenta importes confirmados, consumo, cobertura, pendientes y alternativas **para evaluar**. Solicitar revisión envía un único aviso al correo comercial configurado. No se generan porcentajes de ahorro, autonomía, cotizaciones ni tamaños de batería.

## Preguntas específicas por instalación

El paso Operación conserva una base común (objetivo, horarios, equipos y alcance del medidor) y cambia sus preguntas al seleccionar el tipo de instalación. Reutiliza las preguntas operativas de los diagnósticos públicos, sin importar sus reglas de cálculo económico. No repite tarifa ni importe si los recibos ya están confirmados.

| Instalación | Información específica |
|---|---|
| Universidad o institución educativa | Tipo de campus, calendario académico, perfil diario, actividad en vacaciones y fuera de horario, laboratorios y servicios críticos, impacto de un corte y tiempo de respaldo requerido |
| Industria y manufactura | Tipo de proceso, perfil de carga, impacto de un corte, equipos principales y flexibilidad de horarios |
| Comercio y oficinas | Tipo de inmueble, cargas principales, actividad fuera de horario e impacto de interrupciones |
| Hotel | Tipo de propiedad, perfil de carga, temporadas de ocupación, amenidades y efecto de cortes |
| Cadena de frío | Tipo de operación, compresores y control, deshielos, margen térmico e impacto en producto |
| Bombeo | Tipo de sistema, almacenamiento hidráulico, programación, bombas, variadores, caudal e impacto de paros |
| Carga de vehículos | Tipo de operación, simultaneidad, gestión de carga, cargadores, ventanas operativas y crecimiento cuando se busca ampliar capacidad |
| Centro de datos | Tipo de sitio, carga y continuidad, integración y pruebas del respaldo, potencia crítica y transferencia admisible; los equipos se marcan una sola vez en el bloque común |
| Sitio remoto | Tipo de sitio, fuente de energía, perfil de carga, consumo, combustible y autonomía |
| Otro | Tipo de operación, comportamiento de carga, impacto de cortes y descripción de equipos y restricciones |

Las respuestas se guardan en `answers.installations`, separadas por perfil. Al cambiar de tipo y volver se recuperan las respuestas, incluidas las preguntas condicionales temporalmente ocultas. El resumen y el aviso al asesor muestran únicamente las preguntas vigentes del tipo seleccionado, con etiquetas legibles y pendientes explícitos. No se trasladan respuestas de un sector a otro ni se inventan respuestas a partir del tipo de instalación.

La etiqueta “Universidad o institución educativa” conserva el valor existente “Institución educativa”, por lo que los enlaces previamente preparados siguen seleccionando el módulo correcto. Los expedientes previos sin respuestas específicas se abren con esos datos por confirmar. No se requiere una nueva migración de base de datos para esta ampliación.

## Activación en el proyecto Vercel existente

**Antes de publicar este cambio**, aplicar `supabase/migrations/20260912_prospect_expedientes.sql` al proyecto Supabase actual. Crea una tabla con RLS sin permisos para clientes públicos, una función de cuotas persistentes y un bucket privado separado del legado. No modifica recibos existentes.

Configurar en el entorno destino:

| Variable | Uso |
|---|---|
| `SUPABASE_URL` | Proyecto Supabase existente |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor: expediente, cuotas y firmas de objetos |
| `OPENAI_API_KEY` | Lectura de recibos; si falta, el usuario puede subir y continuar con revisión humana |
| `CFE_EXTRACTION_MODEL` | Opcional; predeterminado `gpt-5.4-mini`, ajustable tras evaluar precisión |
| `ADVISOR_API_KEY` | Clave interna aleatoria de al menos 32 caracteres para crear enlaces con datos prellenados |
| `RESEND_API_KEY` | Aviso al asesor al solicitar revisión |
| `LEAD_TO` / `LEAD_FROM` | Reutiliza remitente y destinatario existentes |
| `PUBLIC_SITE_URL` | Origen del sitio para el enlace del aviso; predeterminado `https://www.mexillum.com` |

No colocar claves en código, URLs, capturas ni mensajes. La clave de asesor se introduce en la pantalla interna y no se persiste en el navegador. Esta primera versión usa una credencial compartida del equipo; para atribución individual se debe integrar el proveedor de identidad de Mexillum.

La función dispone de 300 segundos en `vercel.json`; verificar compatibilidad del plan. La llamada de extracción tiene un límite de 230 segundos, deja margen para guardar errores y no ejecuta trabajo sin esperar tras responder. Cada archivo conserva el estado; si la pestaña se cierra durante la lectura, al volver se recupera del servidor. Para cargas largas, el siguiente paso es una cola de procesamiento.

### Activación y consumo de OpenAI

Guardar `OPENAI_API_KEY` directamente en Vercel para Production y volver a desplegar. La cuenta API necesita saldo/cuota y acceso al modelo. `CFE_EXTRACTION_MODEL=gpt-5.4-mini` puede fijarse explícitamente; ese es también el valor predeterminado del código. No se necesita otra migración de Supabase.

Los tokens y costos se suman entre todas las páginas del intento. También se registra la cantidad de llamadas. Cuando alguna respuesta no trae consumo, el total queda desconocido y `reportedEstimatedCostUSD` conserva solo el subtotal que sí fue reportado. Cada archivo conserva `extractionUsage`, un registro por intento con los tokens de entrada, caché, salida y razonamiento reportados por OpenAI, el modelo efectivo y el costo estimado en USD. El razonamiento ya está incluido en los tokens de salida y no se cobra dos veces en la estimación. Tarifas estándar verificadas el 2026-09-12 para GPT-5.4 mini: USD 0.75 / millón de tokens de entrada sin caché, USD 0.075 con caché y USD 4.50 de salida. La estimación excluye impuestos e infraestructura; no sustituye la factura del proveedor. Otros modelos conservan tokens, pero su costo queda en null hasta configurar tarifas verificadas.

Los intentos incompletos conservan el consumo cuando OpenAI lo devuelve. Si la conexión se corta sin recibir el reporte, el consumo es desconocido, no cero; cotejar con OpenAI. Reabrir o volver a analizar un archivo terminado no repite la llamada ni duplica su registro. Los datos del registro son del servidor y no pueden reemplazarse desde el formulario.

Los errores distinguen credenciales/acceso, saldo/cuota, saturación y lectura incompleta sin exponer respuestas del proveedor, claves ni URLs firmadas. Si no hay recibos identificados, se conserva la opción de reintentar. Si todos fallan, la pantalla permanece en Recibos y muestra el motivo.

## Privacidad y operación

- En el navegador solo se recuerda el token del último expediente; datos personales y documentos permanecen en el almacenamiento privado del servidor.
- El enlace es una credencial de acceso al expediente. No publicarlo ni incorporarlo a analítica. Los eventos nuevos no incluyen token, contacto, RPU ni documentos.
- Las firmas de descarga duran 5 minutos. Las de subida son las temporales de Supabase y no permiten sobreescribir objetos. Se verifica MIME y tamaño del objeto recibido antes de leerlo.
- El control de revisión evita sobrescribir cambios de otra ventana (HTTP 409). El usuario ve un mensaje para recargar antes de continuar; no se ocultan conflictos.
- Un aviso comercial por expediente, con idempotencia del proveedor y marca de envío en la base. Las actualizaciones posteriores quedan disponibles en el mismo enlace, sin generar avisos repetidos.
- Programar `node scripts/cleanup-expedientes.mjs --apply` con las variables del servidor. Por defecto solo informa cuántos expedientes vencieron. La eliminación usa la API de Storage antes de borrar el registro; ejecutar repetidamente si hay más de 100. Los enlaces expiran a los 30 días aunque la limpieza aún no se haya ejecutado. La política de conservación comercial definitiva puede requerir ampliar ese plazo.
- Revisar cuotas de OpenAI, gasto, errores de lectura y recibos que excedan el contexto. Si el proveedor devuelve respuesta incompleta, se conserva el archivo y no se usan datos parciales.

## Validación

`npm test` incluye los casos legados y pruebas nuevas de separación de servicios, duplicados, periodos superpuestos, fechas inválidas, sumas, campos nulos, números reales, preguntas condicionales, autorización, revisión concurrente, subida de 15.6 MB, lectura incompleta e idempotencia.

Vista local explícitamente simulada: `node scripts/dev-expediente.mjs --demo`. No envía correos, no llama a OpenAI y no almacena archivos reales. Abre `/asesor`; clave de prueba: `demo-advisor-key-for-local-tests-only`. Los recibos que se carguen en esa vista devuelven un ejemplo fijo de dos meses, marcado como demostración. Nunca desplegar este servidor como servicio productivo.

Prueba de navegador reproducible: con el servidor demo activo, ejecutar `node scripts/check-expediente-ui.mjs` con Playwright disponible (o `PLAYWRIGHT_MODULE` apuntando a su módulo). Verifica escritorio, móvil, reanudación y envío simulado.

La aceptación en vivo requiere un recibo real con las credenciales del entorno: verificar extracción, fuente de cada campo, descarga privada, reapertura en otro dispositivo y recepción del aviso. Las pruebas con servicios simulados no sustituyen esa validación.

## Alcance económico

El motor de cuestionario legado conserva sus tablas para visitantes públicos. El expediente nuevo no utiliza la cifra representativa de $120,000 para el rango inferior a $200,000. Presenta importes del periodo confirmado y oportunidades basadas en evidencia. Falta implementar y validar el motor de refacturación y despacho antes de ofrecer rangos económicos de baterías/solar. Doce recibos aportan un historial mensual; nunca se describen como una curva intradiaria.

Referencias de integración: [OpenAI: archivos de entrada](https://developers.openai.com/api/docs/guides/file-inputs), [salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs), [Supabase: firmas de subida](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl), [Vercel: duración de funciones](https://vercel.com/docs/functions/configuring-functions/duration).


### Simulación preliminar en Resumen (12 septiembre 2026)

El resumen calcula automáticamente tres escenarios: situación actual, solar y solar con batería. `js/expediente.simulation.js` contiene fórmulas deterministas; no hace llamadas a OpenAI ni modifica la confirmación de recibos. Se muestran supuestos y valores provisionales incluso con cero recibos confirmados. La lectura crítica incierta no revisada ni corregida, las inconsistencias numéricas y los periodos superpuestos se excluyen. Se usa un servicio a la vez y hasta sus doce recibos válidos más recientes.

El balance opera por días facturados: generación uniforme, autoconsumo limitado por consumo y coincidencia supuesta, batería cargada solo con excedentes, un ciclo diario, cuatro horas máximas de descarga, potencia/capacidad utilizables y eficiencia de ida y vuelta. Conserva la energía entre uso directo, batería, pérdidas y excedentes. No remunera exportación. Los resultados anuales son equivalentes a 365 días; la interfaz identifica las series discontinuas y no las presenta como un año medido.

El precio de referencia inicial es (subtotal − capacidad − distribución) / kWh; puede incluir otros cargos fijos y ajustes, por lo que se identifica como una aproximación editable, no una tarifa marginal validada. El ahorro está limitado por el importe residual de cada recibo y mantiene los cargos de capacidad y distribución. Los importes no incluyen IVA, inversión, O&M, degradación ni financiamiento. No se estiman retorno de inversión, arbitraje de red, recorte de picos ni continuidad.

Supuestos iniciales visibles: 1,500 kWh/kWp/año; 70% de coincidencia solar; potencia para generar 60% del consumo anual equivalente, limitada por 70% del área marcada a razón de 5.5 m²/kWp; batería nominal equivalente a 20% del consumo diario y potencia equivalente a 10% de esa energía por hora; 90% de capacidad utilizable y 90% de eficiencia. Son hipótesis para explorar, no mediciones locales ni una selección de equipos. No se atribuyen a PVWatts; para una predicción climática se requiere integrar un recurso meteorológico del sitio.

`data.simulation` guarda solamente los parámetros numéricos permitidos, validados también en el servidor. Los resultados se recalculan al abrir con los recibos actuales; no se aceptan resultados económicos enviados por el cliente. Cambiar parámetros y pulsar Recalcular actualiza la comparación. Restablecer devuelve los supuestos iniciales. No se reenvían avisos a asesores al simular.


El resumen distingue área total marcada, área aprovechable supuesta (70%) y superficie estimada del sistema realmente simulado (potencia solar limitada × 5.5 m²/kWp). La generación sigue calculándose por potencia y rendimiento; no por toda el área candidata. Al recalcular, la superficie del escenario se actualiza. Las hojas de estilo del expediente y resumen usan una URL versionada y se espera su carga antes de presentar los resultados. La comparación usa columnas numéricas alineadas en escritorio y filas con etiquetas por dato en pantallas pequeñas.
