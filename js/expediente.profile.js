import {invoiceDays,tariffBand,regionFor} from './expediente.calendar.js?v=20260912-10';
import {usableReading} from './expediente.model.js?v=20260912-10';
export const BANDS=['base','intermediate','peak'];
// Weighted water filling preserves exact bill kWh while respecting measured maxima.
export function allocateEnergy(hours,target){
 const cap=hours.reduce((s,h)=>s+h.cap,0);if(target>cap+Math.max(2,target*.005))return false;
 let lo=0,hi=Math.max(1,target);for(let i=0;i<60;i++){const mid=(lo+hi)/2,v=hours.reduce((s,h)=>s+Math.min(h.cap,mid*h.weight),0);if(v<target)lo=mid;else hi=mid;}
 for(const h of hours)h.load=Math.min(h.cap,hi*h.weight);
 return Math.abs(hours.reduce((s,h)=>s+h.load,0)-target)<Math.max(.01,target*1e-6);
}
export function periodProfile(r,inputs={},resource=null){
 const issues=[],region=regionFor({state:usableReading(r,['state'])?r.state:'',address:usableReading(r,['address'])?r.address:''},inputs.region),days=invoiceDays(r);
 if(!days.length)return {ready:false,issues:['El periodo no tiene una duración válida.']};
 if(Math.abs(r.base+r.intermediate+r.peak-r.kwh)>Math.max(2,r.kwh*.005))return {ready:false,issues:['La suma de consumos por horario no coincide con el consumo total.']};
 if(!usableReading(r,['tariff'])||r.tariff!=='GDMTH')return {ready:false,issues:[`La simulación horaria de ${r.tariff||'tarifa desconocida'} requiere una regla específica; no se aplica GDMTH automáticamente.`]};
 if(!region)return {ready:false,issues:['Falta identificar el sistema tarifario mediante el estado o la región de la instalación.']};
 if(!usableReading(r,['base','intermediate','peak']))return {ready:false,issues:['Faltan consumos legibles por franja horaria.']};
 const hours=[];let shape=inputs.loadShape??0,start=inputs.operationStart??8,end=inputs.operationEnd??18;
 const scheduleKnown=inputs.loadShape!=null;
 if(shape!==0&&start>=end)return {ready:false,issues:['El inicio de actividad diurna debe ser anterior al fin; el perfil nocturno utiliza las horas restantes.']};
 for(const d of days)for(let h=0;h<24;h++){
  const band=tariffBand(d,h,region);if(!band)return {ready:false,issues:['Falta una regla tarifaria verificada para el año de este recibo.']};
  const active=shape===0|| (shape===1?(h>=start&&h<end):(h>=end||h<start));
  const weekend=d.getUTCDay()===0||d.getUTCDay()===6;
  const low=(inputs.offHoursPct??50)/100;
  let weight=active?1:Math.max(.01,low);if(weekend)weight*=Math.max(.01,(inputs.weekendPct??100)/100);
  const field={base:'baseDemand',intermediate:'intermediateDemand',peak:'peakDemand'}[band];
  const limits=[r[field],r.demand].filter(v=>Number.isFinite(v)&&v>0);
  const cap=limits.length?Math.min(...limits):Infinity;
  const month=d.getUTCMonth(),daysInMonth=new Date(Date.UTC(d.getUTCFullYear(),month+1,0)).getUTCDate();
  const yieldDay=resource?.monthly?.[month]!=null?resource.monthly[month]/daysInMonth:(inputs.yieldKwh??1500)/365;
  const daylight=Math.max(10,Math.min(14,12+2*Math.sin((month-2)/12*2*Math.PI))),sunrise=12-daylight/2;
  const sun=Math.max(0,Math.sin(Math.PI*(h+.5-sunrise)/daylight));
  const weights=Array.from({length:24},(_,j)=>j+.5>=sunrise&&j+.5<=sunrise+daylight?Math.max(0,Math.sin(Math.PI*(j+.5-sunrise)/daylight)):0);
  hours.push({date:d.toISOString().slice(0,10),h,band,cap,weight,load:0,solar:weights[h]/weights.reduce((s,v)=>s+v,0)*yieldDay});
 }
 for(const b of BANDS){const subset=hours.filter(h=>h.band===b);if(!subset.length){if(r[b]>0)issues.push(`El calendario no tiene horas ${b}, pero el recibo sí declara consumo.`);continue;}
   // Unknown maxima constrain no synthetic peaks; disclose rather than infer a connection limit.
   for(const h of subset)if(!Number.isFinite(h.cap))h.cap=r[b]||0;
   if(!allocateEnergy(subset,r[b]))issues.push(`El consumo ${b} no cabe en sus horas y demandas máximas: revisar lectura o calendario.`);
 }
 return {ready:!issues.length,issues,hours,days:days.length,region,scheduleKnown,loadAssumption:scheduleKnown?'Horario y reducción fuera de operación ingresados':'Distribución uniforme dentro de cada franja, sin horario operativo confirmado'};
}
