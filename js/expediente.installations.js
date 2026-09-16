// Reuse the operational questions of the public diagnosis. No tariff/scoring engine here.
import industry from './diagnostico.content.js';
import hotels from './diagnostico.hoteles.content.js';
import cold from './diagnostico.cadena-frio.content.js';
import pumping from './diagnostico.bombeo.content.js';
import charging from './diagnostico.electromovilidad.content.js';
import dataCenters from './diagnostico.centros-datos.content.js';
import remote from './diagnostico.microred.content.js';
import { select, multi, DEEP } from './expediente.operation.js';
const unknown={value:'nolose',label:'No lo sé / por confirmar'};
function legacy(content){
  const fields=content.pasos.filter(q=>['sector','perfil','corte'].includes(q.key) || (q.rol==='propia'&&!['calidad','respaldo_actual'].includes(q.key)) || q.key==='crecimiento').map(q=>({
    key:q.key==='sector'?'subtype':q.key,label:q.pregunta.replaceAll('{planta}','la instalación'),hint:q.hint||'',type:'select',
    options:[...q.opciones.filter(o=>o.codigo!=='nolose').map(o=>({value:o.codigo,label:o.label})),unknown],
    ...(q.key==='crecimiento'?{when:'growth'}:{})
  }));
  const constraints=content.pasos.find(q=>q.key==='disparador').opciones.filter(o=>['diesel','excedente','aislado'].includes(o.codigo)).map(o=>[o.codigo,o.label]);
  fields.push(multi('condiciones','¿Hay alguna otra condición que debamos considerar?', [...constraints,['ninguna','Ninguna de estas']],{exclusive:['ninguna','nolose']}));
  return fields;
}
const university={id:'university',sector:'Institución educativa',label:'Universidad o institución educativa',title:'Actividad y servicios del campus',
 scheduleLabel:'Calendario académico y horarios de clases',scheduleHint:'Días y turnos de clases, fechas de vacaciones y cursos de verano. Puedes usar el calendario aproximado.',fields:[
 select('subtype','¿Qué tipo de institución o campus es?',[['universidad','Universidad o campus universitario'],['tecnologico','Instituto tecnológico o politécnico'],['investigacion','Centro de investigación'],['escuela','Escuela u otra institución educativa']]),
 select('perfil','¿Cómo cambia el consumo durante un día de clases?',[['diurno','Se concentra durante clases y baja de noche'],['nocturno','Hay actividad importante en el turno nocturno'],['plano','Hay una carga importante las 24 horas'],['picos','Talleres, laboratorios o climatización generan picos']]),
 select('vacations','¿Qué ocurre con la operación durante vacaciones?',[['minima','Se reduce a vigilancia y servicios mínimos'],['parcial','Continúan cursos, administración o algunos edificios'],['continua','Laboratorios u otros servicios mantienen una actividad importante']]),
 multi('criticalLoads','¿Qué equipos o servicios requieren continuidad?',[['laboratorios','Laboratorios, experimentos o talleres'],['frio','Refrigeración de muestras o reactivos'],['servidores','Servidores, redes o centro de datos'],['salud','Clínica o servicios de salud'],['seguridad','Seguridad, iluminación o comunicaciones'],['bombeo','Bombeo u otros servicios esenciales'],['ninguna','No identificamos cargas críticas']],{exclusive:['ninguna','nolose']}),
 select('corte','Si el campus pierde energía 30 minutos, ¿qué ocurre?',[['producto','Se comprometen experimentos, muestras o reactivos'],['reinicio','Recuperar laboratorios o sistemas toma tiempo'],['servicio','Se interrumpen clases, servicios o conectividad'],['nada','El respaldo o la operación permiten cubrir el evento']])
]};
const make=(id,sector,title,content,extra=[])=>({id,sector,label:sector,title,fields:[...legacy(content),...(content.profundas||[]),...extra]});
export const INSTALLATIONS=[
 {...university,fields:[...university.fields,...DEEP.university]},
 make('industry','Industria y manufactura','Proceso y cargas de producción',industry,DEEP.industry),
 make('commerce','Comercio y oficinas','Operación del inmueble',industry,DEEP.commerce),
 {...make('hotel','Hotel','Operación y ocupación del hotel',hotels),scheduleLabel:'Horarios y temporadas de ocupación del hotel',scheduleHint:'Temporadas altas y bajas, eventos, ocupación aproximada y horarios de servicios.'},
 make('cold','Cadena de frío','Refrigeración y conservación del producto',cold),
 make('pumping','Bombeo','Bombas y almacenamiento de agua',pumping),
 make('charging','Carga de vehículos','Vehículos, cargadores y ventanas de carga',charging),
 make('data_center','Centro de datos','Carga crítica y arquitectura de respaldo',dataCenters),
 make('remote','Sitio remoto','Suministro y autonomía del sitio',remote),
 make('other','Otro','Características de la instalación',industry,DEEP.other)
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
  for(const q of p.fields){const v=source[q.key];
   if(q.type==='multi'){if(Array.isArray(v)){const valid=[...new Set(v.filter(x=>q.options.some(o=>o.value===x)))];const solo=valid.find(x=>(q.exclusive||['ninguna','nolose']).includes(x));result[q.key]=solo?[solo]:valid;}}
   else if(typeof v==='string' && (v===''||q.options.some(o=>o.value===v)))result[q.key]=v;
  }out[p.id]=result;
 }return out;
}
export function installationSummary(answers={}){
 const v=installationValues(answers);
 return installationFields(answers).map(q=>({label:q.label,value:q.type==='multi'?(v[q.key]||[]).map(k=>q.options.find(o=>o.value===k)?.label).filter(Boolean).join('; ')||'Por confirmar':q.options.find(o=>o.value===v[q.key])?.label||'Por confirmar'}));
}
