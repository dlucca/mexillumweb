// Reuse the operational questions of the public diagnosis. No tariff/scoring engine here.
import industry from './diagnostico.content.js';
import hotels from './diagnostico.hoteles.content.js';
import cold from './diagnostico.cadena-frio.content.js';
import pumping from './diagnostico.bombeo.content.js';
import charging from './diagnostico.electromovilidad.content.js';
import dataCenters from './diagnostico.centros-datos.content.js';
import remote from './diagnostico.microred.content.js';
const unknown={value:'nolose',label:'No lo sé / por confirmar'};
const options=items=>items.map(([value,label])=>({value,label}));
const select=(key,label,items,extra={})=>({key,label,type:'select',options:[...options(items),unknown],...extra});
const text=(key,label,hint,extra={})=>({key,label,hint,type:'text',...extra});
const multi=(key,label,items,extra={})=>({key,label,type:'multi',options:[...options(items),unknown],...extra});
function legacy(content){
  const fields=content.pasos.filter(q=>['sector','perfil','corte'].includes(q.key) || (q.rol==='propia'&&!['calidad','respaldo_actual'].includes(q.key)) || q.key==='crecimiento').map(q=>({
    key:q.key==='sector'?'subtype':q.key,label:q.pregunta.replaceAll('{planta}','la instalación'),hint:q.hint||'',type:'select',
    options:[...q.opciones.filter(o=>o.codigo!=='nolose').map(o=>({value:o.codigo,label:o.label})),unknown],
    ...(q.key==='crecimiento'?{when:'growth'}:{})
  }));
  const constraints=content.pasos.find(q=>q.key==='disparador').opciones.filter(o=>['diesel','excedente','aislado'].includes(o.codigo)).map(o=>[o.codigo,o.label]);
  fields.push(multi('condiciones','¿Hay alguna otra condición que debamos considerar?', [...constraints,['ninguna','Ninguna de estas']]));
  return fields;
}
const university={id:'university',sector:'Institución educativa',label:'Universidad o institución educativa',title:'Actividad y servicios del campus',
 scheduleLabel:'Calendario académico y horarios de clases',scheduleHint:'Días y turnos de clases, fechas de vacaciones y cursos de verano. Puedes usar el calendario aproximado.',fields:[
 select('subtype','¿Qué tipo de institución o campus es?',[['universidad','Universidad o campus universitario'],['tecnologico','Instituto tecnológico o politécnico'],['investigacion','Centro de investigación'],['escuela','Escuela u otra institución educativa']]),
 select('perfil','¿Cómo cambia el consumo durante un día de clases?',[['diurno','Se concentra durante clases y baja de noche'],['nocturno','Hay actividad importante en el turno nocturno'],['plano','Hay una carga importante las 24 horas'],['picos','Talleres, laboratorios o climatización generan picos']]),
 select('vacations','¿Qué ocurre con la operación durante vacaciones?',[['minima','Se reduce a vigilancia y servicios mínimos'],['parcial','Continúan cursos, administración o algunos edificios'],['continua','Laboratorios u otros servicios mantienen una actividad importante']]),
 text('afterhours','¿Qué permanece activo por la noche o en fines de semana?','Residencias, servidores, refrigeradores de laboratorio, bibliotecas, iluminación o bombeo. Si todo se apaga, indícalo.'),
 multi('criticalLoads','¿Qué equipos o servicios requieren continuidad?',[['laboratorios','Laboratorios, experimentos o talleres'],['frio','Refrigeración de muestras o reactivos'],['servidores','Servidores, redes o centro de datos'],['salud','Clínica o servicios de salud'],['seguridad','Seguridad, iluminación o comunicaciones'],['bombeo','Bombeo u otros servicios esenciales'],['ninguna','No identificamos cargas críticas']]),
 text('criticalDetail','Describe las cargas críticas y cuánto tiempo deben seguir funcionando','Equipos, edificios y tiempo de respaldo requerido; potencia si la conoces. Indica si toleran una interrupción breve.',{when:'criticalLoads'}),
 select('corte','Si el campus pierde energía 30 minutos, ¿qué ocurre?',[['producto','Se comprometen experimentos, muestras o reactivos'],['reinicio','Recuperar laboratorios o sistemas toma tiempo'],['servicio','Se interrumpen clases, servicios o conectividad'],['nada','El respaldo o la operación permiten cubrir el evento']])
]};
const make=(id,sector,title,content,extra=[])=>({id,sector,label:sector,title,fields:[...legacy(content),...extra]});
export const INSTALLATIONS=[
 university,
 make('industry','Industria y manufactura','Proceso y cargas de producción',industry,[text('processLoads','¿Qué equipos concentran el consumo y cuáles podrían cambiar de horario?','Motores, hornos, compresores, líneas de producción; indica si hay arranques simultáneos o procesos que no pueden detenerse.')]),
 make('commerce','Comercio y oficinas','Operación del inmueble',industry,[text('majorLoads','¿Qué servicios concentran el consumo y cuáles funcionan fuera del horario de atención?','Climatización, elevadores, cocinas, refrigeración, iluminación o locales con horarios propios.')]),
 {...make('hotel','Hotel','Operación y ocupación del hotel',hotels,[text('hotelLoads','¿Qué equipos o amenidades concentran el consumo?','Chillers, cocinas, lavandería, albercas, bombeo; indica si pueden programarse.')]),scheduleLabel:'Horarios y temporadas de ocupación del hotel',scheduleHint:'Temporadas altas y bajas, eventos, ocupación aproximada y horarios de servicios.'},
 make('cold','Cadena de frío','Refrigeración y conservación del producto',cold,[text('thermalMargin','¿Cuánto tiempo puede esperar el producto sin refrigeración y cómo programan los deshielos?','Rangos de temperatura, margen de espera y horarios; puedes dejarlo por confirmar.')]),
 make('pumping','Bombeo','Bombas y almacenamiento de agua',pumping,[text('pumpDetails','¿Qué conoces de las bombas y del almacenamiento?','Número de bombas, potencia, variadores, volumen de tanque, caudal y horarios de demanda, si los conoces.')]),
 make('charging','Carga de vehículos','Vehículos, cargadores y ventanas de carga',charging,[text('chargers','¿Cuántos cargadores tienen y cuándo llegan y salen los vehículos?','Potencia por cargador, vehículos conectados a la vez y tiempo mínimo disponible para cargar.')]),
 make('data_center','Centro de datos','Carga crítica y arquitectura de respaldo',dataCenters,[text('backupArchitecture','¿Cómo se integran y prueban los equipos de respaldo?','Con los equipos que marcaste arriba: redundancia, transferencia, autonomía actual y fecha de la última prueba.'),text('criticalPower','¿Qué carga debe mantenerse y qué interrupción tolera?','Carga de cómputo y enfriamiento en kW, si se conoce; tiempo de transferencia admisible y compromisos de disponibilidad.')]),
 make('remote','Sitio remoto','Suministro y autonomía del sitio',remote,[text('energyUse','¿Cuánta energía necesita el sitio?','kWh al día o al mes y potencia máxima en kW, si se conocen. Para sitios nuevos, indica equipos y horas de uso.'),text('fuel','¿Cuánto combustible se utiliza para generar electricidad?','Tipo de combustible, horas de generación, litros y costo mensual. Si no usan combustible, indícalo.'),text('autonomy','¿Cuántas horas necesitan operar sin red ni generación solar?','Indica las cargas esenciales y la autonomía requerida, incluyendo la noche.')]),
 make('other','Otro','Características de la instalación',industry,[text('description','Describe la instalación y sus cargas principales','Actividad, equipos importantes y restricciones que debamos considerar.')])
];
// Narrow broad legacy classifications to the selected installation family.
INSTALLATIONS.find(p=>p.id==='industry').fields[0].options=industry.pasos[0].opciones.filter(o=>['continuo','manufactura','publico'].includes(o.codigo)).map(o=>({value:o.codigo,label:o.label})).concat(unknown);
INSTALLATIONS.find(p=>p.id==='commerce').fields[0]=select('subtype','¿Qué tipo de inmueble es?',[['oficinas','Oficinas o corporativo'],['retail','Tienda o centro comercial'],['entretenimiento','Cine, entretenimiento o recinto de eventos'],['servicios','Edificio de servicios']]);
export function installationFor(sector){return INSTALLATIONS.find(p=>p.sector===sector)||null;}
export function installationValues(answers={}){const p=installationFor(answers.sector);return p?answers.installations?.[p.id]||{}:{};}
export function installationFields(answers={}){
 const p=installationFor(answers.sector),v=installationValues(answers);
 return (p?.fields||[]).filter(q=>!q.when || (q.when==='growth'&&answers.objective?.includes('growth')) || (q.when==='criticalLoads'&&v.criticalLoads?.some(k=>!['ninguna','nolose'].includes(k))));
}
export function sanitizeInstallations(value){
 const out={};if(!value||typeof value!=='object'||Array.isArray(value))return out;
 for(const p of INSTALLATIONS){const source=value[p.id];if(!source||typeof source!=='object'||Array.isArray(source))continue;const result={};
  for(const q of p.fields){const v=source[q.key];if(q.type==='text'){if(typeof v==='string')result[q.key]=v.trim().slice(0,1500);}
   else if(q.type==='multi'){if(Array.isArray(v)){const valid=[...new Set(v.filter(x=>q.options.some(o=>o.value===x)))];result[q.key]=valid.some(x=>['ninguna','nolose'].includes(x))?[valid.find(x=>['ninguna','nolose'].includes(x))]:valid;}}
   else if(typeof v==='string' && (v===''||q.options.some(o=>o.value===v)))result[q.key]=v;
  }out[p.id]=result;
 }return out;
}
export function installationSummary(answers={}){
 const v=installationValues(answers);
 return installationFields(answers).map(q=>({label:q.label,value:q.type==='text'?v[q.key]||'Por confirmar':q.type==='multi'?(v[q.key]||[]).map(k=>q.options.find(o=>o.value===k)?.label).filter(Boolean).join('; ')||'Por confirmar':q.options.find(o=>o.value===v[q.key])?.label||'Por confirmar'}));
}
