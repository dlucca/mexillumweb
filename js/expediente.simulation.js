import {date,receiptIssues} from './expediente.model.js';

export const SIMULATION_VERSION='monthly-balance-v1';
const DAY=86400000;
const bounds={solarKw:[0,10000],yieldKwh:[500,2500],selfUsePct:[0,100],batteryKwh:[0,100000],batteryKw:[0,10000],efficiencyPct:[50,100],usablePct:[50,100],energyPrice:[0,30]};
export function sanitizeSimulation(input={}) {
  return Object.fromEntries(Object.entries(bounds).filter(([k,[lo,hi]])=>typeof input?.[k]==='number'&&Number.isFinite(input[k])&&input[k]>=lo&&input[k]<=hi).map(([k])=>[k,input[k]]));
}
const sum=(rows,k)=>rows.reduce((n,r)=>n+r[k],0);
const critical=['service','tariff','start','end','kwh','subtotal','capacity','distribution'];

export function simulationSource(data) {
  const all=(data.receipts||[]).filter(r=>r.kind==='bill'&&!r.excluded);
  const services=[...new Set(all.map(r=>r.service).filter(Boolean))];
  const service=data.service||(services.length===1?services[0]:'');
  if(!service)return {ready:false,reason:services.length>1?'Selecciona un servicio en Revisión para simularlo por separado.':'Necesitamos al menos un recibo con consumo, periodo y número de servicio legibles.'};
  const selected=all.filter(r=>r.service===service);
  const valid=selected.filter(r=>!receiptIssues(r).length&&r.kwh>0&&r.subtotal>0&&r.capacity!=null&&r.distribution!=null&&r.subtotal>=r.capacity+r.distribution &&
    !(!r.reviewed&&(r.uncertain||[]).some(k=>critical.includes(k)&&!(r.correctedFields||[]).includes(k))));
  // Exact duplicates use one copy, preferring an explicitly reviewed one.
  const unique=new Map();
  for(const r of valid){const key=`${r.start}:${r.end}`;if(!unique.has(key)||r.reviewed)unique.set(key,r);}
  const rows=[...unique.values()].sort((a,b)=>a.end.localeCompare(b.end));
  const overlap=new Set();
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(rows[i].start<rows[j].end&&rows[j].start<rows[i].end){overlap.add(rows[i]);overlap.add(rows[j]);}
  const chosen=rows.filter(r=>!overlap.has(r)).slice(-12);
  if(!chosen.length)return {ready:false,reason:'Revisa los consumos, cargos y periodos señalados en Revisión. No hay recibos consistentes para calcular el escenario.'};
  const days=chosen.reduce((n,r)=>n+(date(r.end)-date(r.start))/DAY,0);
  const gaps=chosen.slice(1).filter((r,i)=>r.start>chosen[i].end).length;
  const residual=sum(chosen,'subtotal')-sum(chosen,'capacity')-sum(chosen,'distribution');
  return {ready:true,service,rows:chosen,days,start:chosen[0].start,end:chosen.at(-1).end,
    unconfirmed:chosen.filter(r=>!r.reviewed).length,omitted:selected.length-chosen.length,
    gaps,duplicates:valid.length-unique.size,overlaps:overlap.size,
    annualObserved:days>=360&&days<=370&&!gaps,
    annualKwh:sum(chosen,'kwh')/days*365,annualSubtotal:sum(chosen,'subtotal')/days*365,
    annualDemandCharges:(sum(chosen,'capacity')+sum(chosen,'distribution'))/days*365,
    referencePrice:residual/sum(chosen,'kwh')};
}

export function simulate(data,overrides=data.simulation) {
  const source=simulationSource(data);
  if(!source.ready)return {version:SIMULATION_VERSION,source};
  const area=Number.isFinite(data.roof?.area_m2)&&data.roof.area_m2>0?data.roof.area_m2:null;
  // Scenario assumptions, not a roof survey or a weather-service prediction.
  const maxSolarKw=area==null?null:area*.7/5.5;
  const defaultSolar=Math.min(source.annualKwh*.6/1500,maxSolarKw??Infinity);
  const defaults={solarKw:Number(defaultSolar.toFixed(1)),yieldKwh:1500,selfUsePct:70,
    batteryKwh:Number((source.annualKwh/365*.2).toFixed(1)),batteryKw:Number((source.annualKwh/365*.1).toFixed(1)),
    efficiencyPct:90,usablePct:90,energyPrice:Number(source.referencePrice.toFixed(3))};
  for(const [key,[lo,hi]] of Object.entries(bounds))defaults[key]=Math.max(lo,Math.min(hi,defaults[key]));
  const inputs={...defaults,...sanitizeSimulation(overrides)};
  const solarKw=Math.min(inputs.solarKw,maxSolarKw??Infinity);
  const efficiency=inputs.efficiencyPct/100;
  const monthly=source.rows.map(r=>{
    const days=(date(r.end)-date(r.start))/DAY;
    const generation=solarKw*inputs.yieldKwh*days/365;
    const direct=Math.min(r.kwh,generation*inputs.selfUsePct/100);
    const surplus=generation-direct;
    // One cycle/day, at most four discharge hours/day; energy never appears for free.
    const shifted=Math.min(surplus*efficiency,r.kwh-direct,inputs.batteryKwh*inputs.usablePct/100*efficiency*days,inputs.batteryKw*4*days);
    const charged=shifted/efficiency;
    const energyBudget=r.subtotal-r.capacity-r.distribution;
    const solarSaving=Math.min(energyBudget,direct*inputs.energyPrice);
    const hybridSaving=Math.min(energyBudget,(direct+shifted)*inputs.energyPrice);
    return {id:r.id,start:r.start,end:r.end,days,kwh:r.kwh,subtotal:r.subtotal,generation,direct,
      shifted,charged,losses:charged-shifted,unused:surplus-charged,
      solarImport:r.kwh-direct,hybridImport:r.kwh-direct-shifted,
      solarSaving,hybridSaving,solarBill:r.subtotal-solarSaving,hybridBill:r.subtotal-hybridSaving};
  });
  const annual=k=>sum(monthly,k)/source.days*365;
  const baseline={id:'baseline',label:'Situación actual',importKwh:source.annualKwh,bill:source.annualSubtotal,saving:0};
  const solar={id:'solar',label:'Con solar',importKwh:annual('solarImport'),bill:annual('solarBill'),saving:annual('solarSaving')};
  const hybrid={id:'hybrid',label:'Solar + batería',importKwh:annual('hybridImport'),bill:annual('hybridBill'),saving:annual('hybridSaving')};
  return {version:SIMULATION_VERSION,source,inputs,maxSolarKw,solarKw,area,usableAreaM2:area==null?null:area*.7,solarAreaM2:solarKw*5.5,monthly,
    scenarios:[baseline,solar,hybrid],generation:annual('generation'),direct:annual('direct'),shifted:annual('shifted'),
    losses:annual('losses'),unused:annual('unused'),extraBatterySaving:hybrid.saving-solar.saving,
    roofLimited:solarKw<inputs.solarKw};
}
