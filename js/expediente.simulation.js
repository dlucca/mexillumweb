import {BANDS,dailyProfile,dispatchDay} from './expediente.dispatch.js?v=20260912-5';
import {date,receiptIssues} from './expediente.model.js';

export const SIMULATION_VERSION='hourly-dispatch-v2';
const DAY=86400000;
const bounds={solarKw:[0,10000],yieldKwh:[500,2500],selfUsePct:[0,100],batteryKwh:[0,100000],batteryKw:[0,10000],efficiencyPct:[50,100],usablePct:[50,100],energyPrice:[0,30],basePrice:[0,30],intermediatePrice:[0,30],peakPrice:[0,30],baseEnd:[1,10],peakStart:[12,22],peakEnd:[13,24],powerLimitKw:[0,10000],areaUsePct:[0,100],manual:[0,1],tariffSet:[0,1]};
export function sanitizeSimulation(input={}) {
  const clean=Object.fromEntries(Object.entries(bounds).filter(([k,[lo,hi]])=>typeof input?.[k]==='number'&&Number.isFinite(input[k])&&input[k]>=lo&&input[k]<=hi).map(([k])=>[k,input[k]]));
  for(const k of ['baseEnd','peakStart','peakEnd','manual','tariffSet'])if(k in clean&&!Number.isInteger(clean[k]))delete clean[k];
  if(typeof input?.priceSource==='string')clean.priceSource=input.priceSource.slice(0,160);
  return clean;
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

const options=(values,max)=>[...new Set(values.map(v=>Math.max(0,Math.min(max,v))))].sort((a,b)=>a-b);
let lastKey,lastResult;
export function simulate(data,overrides=data.simulation) {
  const source=simulationSource(data);
  if(!source.ready)return {version:SIMULATION_VERSION,source};
  const clean=sanitizeSimulation(overrides);
  const area=Number.isFinite(data.roof?.area_m2)&&data.roof.area_m2>=0?data.roof.area_m2:null;
  const key=JSON.stringify([source,area,clean]);if(key===lastKey)return lastResult;
  const pricesProvided=clean.tariffSet!==0&&['basePrice','intermediatePrice','peakPrice'].every(k=>k in clean);
  const flat=Math.min(30,Math.max(0,source.referencePrice));
  const inputs={yieldKwh:1500,efficiencyPct:90,usablePct:90,areaUsePct:70,baseEnd:6,peakStart:18,peakEnd:22,
    basePrice:flat,intermediatePrice:flat,peakPrice:flat,manual:0,...clean};
  if(!pricesProvided){for(const k of ['basePrice','intermediatePrice','peakPrice'])inputs[k]=flat;delete inputs.priceSource;}
  const scheduleAdjusted=inputs.peakEnd<=inputs.peakStart;
  if(scheduleAdjusted){inputs.peakStart=18;inputs.peakEnd=22;}
  const usableAreaM2=area==null?null:area*inputs.areaUsePct/100;
  const maxSolarKw=area==null?null:usableAreaM2/5.5;
  const profiles=source.rows.map(r=>{const days=(date(r.end)-date(r.start))/DAY;return {r,days,profile:dailyProfile(r,days,inputs)};});
  const maxLoad=Math.max(...profiles.flatMap(p=>p.profile.load));
  const demandValues=source.rows.map(r=>r.demand).filter(v=>Number.isFinite(v)&&v>0);
  // Never infer new demand-charge savings; extra grid charging needs unused connection headroom.
  inputs.powerLimitKw??=Math.min(10000,demandValues.length?Math.max(...demandValues):maxLoad);
  const maxDaily=Math.max(...profiles.map(p=>p.r.kwh/p.days));
  const maxBattery=Math.min(100000,maxDaily/(inputs.usablePct/100)/(inputs.efficiencyPct/100));
  const solarMatch=source.annualKwh/inputs.yieldKwh;
  const cap=Math.min(10000,maxSolarKw??0); // Missing surface is not permission to assume a roof.
  const solarOptions=options([0,solarMatch*.5,solarMatch*.75,solarMatch,solarMatch*1.25,solarMatch*1.5,cap],cap);
  const batteryOptions=options([0,maxBattery*.25,maxBattery*.5,maxBattery*.75,maxBattery],maxBattery);
  const powerFor=kwh=>Math.min(10000,kwh,Math.max(maxLoad,inputs.powerLimitKw));
  function evaluate(solarKw,batteryKwh,batteryKw) {
    const monthly=profiles.map(({r,days,profile})=>{
      const flow=dispatchDay(profile,{...inputs,powerLimitKw:Math.min(inputs.powerLimitKw,Number.isFinite(r.demand)&&r.demand>0?r.demand:Math.max(...profile.load)),solarKw,batteryKwh,batteryKw});
      // Keep non-energy charges/adjustments unchanged. A cap protects the subtotal if supplied prices are inconsistent.
      const rawSaving=(flow.baselineCost-flow.cost)*days;
      const budget=r.subtotal-r.capacity-r.distribution;
      const saving=Math.max(0,Math.min(budget,rawSaving));
      return {id:r.id,start:r.start,end:r.end,days,kwh:r.kwh,subtotal:r.subtotal,flow,
        generation:flow.generation*days,direct:flow.direct*days,shifted:flow.solarDischarge*days,
        gridCharge:flow.gridCharge*days,gridDischarge:flow.gridDischarge*days,solarCharge:flow.solarCharge*days,
        losses:flow.losses*days,unused:flow.unused*days,hybridImport:flow.grid*days,hybridSaving:saving,hybridBill:r.subtotal-saving,
        capped:rawSaving>budget+.01};
    });
    const annual=k=>sum(monthly,k)/source.days*365;
    const gridByBand=Object.fromEntries(BANDS.map(b=>[b,monthly.reduce((s,m)=>s+m.flow.gridByBand[b]*m.days,0)/source.days*365]));
    return {solarKw,batteryKwh,batteryKw,monthly,gridByBand,importKwh:annual('hybridImport'),bill:annual('hybridBill'),saving:annual('hybridSaving'),
      generation:annual('generation'),direct:annual('direct'),shifted:annual('shifted'),solarCharge:annual('solarCharge'),gridCharge:annual('gridCharge'),gridDischarge:annual('gridDischarge'),
      losses:annual('losses'),unused:annual('unused'),usefulSolar:annual('direct')+annual('shifted'),requiredKw:Math.max(...monthly.map(m=>m.flow.requiredKw))};
  }
  const candidates=[];
  for(const solar of solarOptions)for(const battery of batteryOptions)candidates.push(evaluate(solar,battery,powerFor(battery)));
  // Service objective: first maximize useful solar; among near-equal coverage, minimize grid energy cost.
  // At near-equal results prefer smaller systems. This is not investment/ROI optimization.
  const bestCoverage=Math.max(...candidates.map(c=>c.usefulSolar));
  const covered=candidates.filter(c=>c.usefulSolar>=bestCoverage-source.annualKwh*.001);
  const bestSaving=Math.max(...covered.map(c=>c.saving));
  const economic=covered.filter(c=>c.saving>=bestSaving-Math.max(1,bestSaving*.001));
  let recommended=economic.sort((a,b)=>(a.solarKw/(cap||1)+a.batteryKwh/(maxBattery||1))-(b.solarKw/(cap||1)+b.batteryKwh/(maxBattery||1)))[0];
  const acceptable=c=>c.usefulSolar>=bestCoverage-source.annualKwh*.001&&c.saving>=bestSaving-Math.max(1,bestSaving*.001);
  // Refine between coarse candidates to avoid filling unused roof area or oversizing storage.
  for(const dimension of ['solarKw','batteryKwh','batteryKw','solarKw']) {
    let lo=0,hi=recommended[dimension];
    for(let i=0;i<10&&hi-lo>.01;i++){
      const mid=(lo+hi)/2,trial={...recommended,[dimension]:mid};
      const c=evaluate(trial.solarKw,trial.batteryKwh,trial.batteryKw);candidates.push(c);
      if(acceptable(c)){hi=mid;recommended=c;}else lo=mid;
    }
  }
  const selected=inputs.manual===1?evaluate(Math.min(clean.solarKw??recommended.solarKw,cap),clean.batteryKwh??recommended.batteryKwh,clean.batteryKw??recommended.batteryKw):recommended;
  inputs.solarKw=selected.solarKw;inputs.batteryKwh=selected.batteryKwh;inputs.batteryKw=selected.batteryKw;
  const baseline=evaluate(0,0,0),solar=evaluate(selected.solarKw,0,0),battery=evaluate(0,selected.batteryKwh,selected.batteryKw);
  const scenarios=[{...baseline,id:'baseline',label:'Situación actual'},...(selected.solarKw>0?[{...solar,id:'solar',label:'Solo solar'}]:[]),
    ...(selected.solarKw>0?[{...battery,id:'battery',label:'Solo batería'}]:[]),{...selected,id:'hybrid',label:selected.solarKw>0?'Solar + batería':'Batería con carga de red'}];
  const result={version:SIMULATION_VERSION,source,inputs,pricesProvided,scheduleAdjusted,area,maxSolarKw,usableAreaM2,solarAreaM2:selected.solarKw*5.5,...selected,
    scenarios,recommended:{solarKw:recommended.solarKw,batteryKwh:recommended.batteryKwh,batteryKw:recommended.batteryKw},
    candidateCount:candidates.length,extraBatterySaving:selected.saving-solar.saving,
    roofLimited:inputs.manual===1&&(clean.solarKw??0)>cap,missingBands:profiles.filter(p=>!p.profile.hasBands).length,
    capped:selected.monthly.some(m=>m.capped)};
  lastKey=key;lastResult=result;return result;
}
