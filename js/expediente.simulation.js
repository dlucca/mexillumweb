import {sanitizeSimulation} from './expediente.simulation-settings.js?v=20260912-11';
export {sanitizeSimulation} from './expediente.simulation-settings.js?v=20260912-11';
import {date,receiptIssues,serviceResolver,ALL_SERVICES,usableReading} from './expediente.model.js?v=20260912-11';
import {billEconomics,billSaving} from './expediente.billing.js?v=20260912-11';
import {periodProfile,BANDS} from './expediente.profile.js?v=20260912-11';
import {dispatchDay} from './expediente.dispatch.js?v=20260912-11';
export const SIMULATION_VERSION='calendar-billing-v3';
const DAY=86400000,sum=(rows,k)=>rows.reduce((n,r)=>n+(r[k]||0),0);
const unique=a=>[...new Set(a)];

export function simulationSource(data) {
 const all=(data.receipts||[]).filter(r=>r.kind==='bill'),identity=serviceResolver(all);
 const services=unique(all.filter(r=>!r.excluded).map(r=>identity(r.service)).filter(Boolean));
 const service=data.service&&data.service!==ALL_SERVICES?identity(data.service):services.length===1?services[0]:'';
 if(!service)return {ready:false,services,reason:services.length>1?'Selecciona un servicio o Todos los servicios.':'Falta identificar el servicio en los recibos.'};
 const decisions=all.filter(r=>identity(r.service)===service).map(r=>({id:r.id,fileId:r.fileId,page:r.page,start:r.start,end:r.end,service,included:false,reason:r.excluded?'Excluido por el usuario':r.refreshUnmatched?'La nueva lectura no encontró una coincidencia segura; revisa este registro':!usableReading(r,['service','start','end','kwh'])||!date(r.start)||!date(r.end)||r.start>=r.end||r.kwh<=0?'Revisar servicio, fechas o consumo':null}));
 const byId=new Map(all.map(r=>[r.id,r]));const usable=decisions.filter(d=>!d.reason).map(d=>byId.get(d.id));
 const quality=r=>(r.reviewed?100:0)+Object.values(r).filter(v=>typeof v==='number'&&Number.isFinite(v)).length;
 const periods=new Map();for(const r of usable){const key=r.start+':'+r.end;if(!periods.has(key)||quality(r)>quality(periods.get(key)))periods.set(key,r);}
 for(const r of usable)if(periods.get(r.start+':'+r.end)!==r)decisions.find(d=>d.id===r.id).reason='Duplicado del mismo servicio y periodo';
 const candidates=[...periods.values()].sort((a,b)=>a.end.localeCompare(b.end));
 for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){const a=candidates[i],b=candidates[j];if(a.start<b.end&&b.start<a.end)for(const r of [a,b])decisions.find(d=>d.id===r.id).reason='Periodo superpuesto: elegir la factura vigente';}
 const ready=candidates.filter(r=>!decisions.find(d=>d.id===r.id).reason),rows=ready.slice(-12);
 for(const r of ready)if(!rows.includes(r))decisions.find(d=>d.id===r.id).reason='Fuera de los 12 periodos más recientes';
 for(const r of rows){const d=decisions.find(d=>d.id===r.id);d.included=true;d.reason='Incluido';}
 const days=rows.reduce((n,r)=>n+(date(r.end)-date(r.start))/DAY,0),gaps=rows.slice(1).filter((r,i)=>r.start!==rows[i].end).length;
 return {ready:!!rows.length,reason:rows.length?'':'No hay periodos utilizables; consulta las causas por recibo.',service,services,rows,decisions,days,gaps,start:rows[0]?.start,end:rows.at(-1)?.end,
  unconfirmed:rows.filter(r=>!r.reviewed).length,omitted:decisions.filter(d=>!d.included).length,duplicates:decisions.filter(d=>d.reason.startsWith('Duplicado')).length,overlaps:decisions.filter(d=>d.reason.startsWith('Periodo superpuesto')).length,
  annualObserved:days>=360&&days<=370&&!gaps,annualKwh:days?sum(rows,'kwh')/days*365:null,annualSubtotal:rows.every(r=>Number.isFinite(r.subtotal))?sum(rows,'subtotal')/days*365:null};
}

function flowSummary(hours){
 const by=k=>sum(hours,k);
 return {generation:by('generation'),direct:by('direct'),solarCharge:by('solarCharge'),gridCharge:by('gridCharge'),shifted:by('solarDischarge'),gridDischarge:by('gridDischarge'),losses:by('losses'),unused:by('unused'),importKwh:by('grid'),
  usefulSolar:by('direct')+by('solarDischarge'),energyCost:hours.reduce((n,h)=>n+h.grid*h.price,0),baselineEnergy:hours.reduce((n,h)=>n+h.load*h.price,0),
  gridByBand:Object.fromEntries(BANDS.map(b=>[b,byBand(hours,b,'grid')])),baselineByBand:Object.fromEntries(BANDS.map(b=>[b,byBand(hours,b,'load')]))};
}
const byBand=(hours,b,k)=>sum(hours.filter(h=>h.band===b),k);
const profileSlice=hours=>({load:hours.map(h=>h.load),solar:hours.map(h=>h.solar),bands:hours.map(h=>h.band),prices:hours.map(h=>h.price),limits:hours.map(h=>h.limit)});
function simulateService(data,overrides={}){
 const source=simulationSource(data);if(!source.ready)return {version:SIMULATION_VERSION,source,status:'pending'};
 const settings=sanitizeSimulation(overrides),inputs={yieldKwh:1500,efficiencyPct:90,usablePct:90,areaUsePct:70,manual:0,tilt:20,azimuth:0,...sanitizeSimulation(data.answers),...settings};
 const equipment=data.answers?.equipment||[];
 const existing=equipment.includes('solar')||equipment.includes('battery');
 const area=data.answers?.noSolarSpace===true?0:data.roof?.area_m2==null?null:Math.max(0,data.roof.area_m2),usableAreaM2=area==null?null:area*inputs.areaUsePct/100,maxSolarKw=usableAreaM2==null?0:Math.min(10000,usableAreaM2/5.5);
 const resourceKey=data.location?`${data.location.lat.toFixed(3)},${data.location.lng.toFixed(3)}:${inputs.tilt}:${inputs.azimuth}`:null;
 const resource=data.solarResource?.monthly?.length===12&&data.solarResource.key===resourceKey?data.solarResource:null;
 if(resource)inputs.yieldKwh=resource.monthly.reduce((n,v)=>n+v,0);
 const manualPrices=settings.tariffSet===1&&['basePrice','intermediatePrice','peakPrice'].every(k=>Number.isFinite(settings[k]));
 const periods=[],issues=[];
 for(const r of source.rows){
  const economics=billEconomics(r),p=periodProfile(r,inputs,resource),reasons=[];
  const prices=manualPrices?{base:settings.basePrice,intermediate:settings.intermediatePrice,peak:settings.peakPrice}:economics.prices;
  if(!prices)reasons.push(...economics.issues.length?economics.issues:['Faltan cargos y consumos para reconstruir precios horarios; actualizar lectura']);
  if(!usableReading(r,['subtotal','capacity','distribution']))reasons.push('Faltan subtotal o cargos de demanda para comparar costos');
  if(!p.ready)reasons.push(...p.issues);
  if(p.ready&&prices){if(p.hours.some(h=>!Number.isFinite(prices[h.band])))reasons.push('Falta precio de una franja presente en el calendario; un consumo nulo no implica energía gratis.');
   const energy=p.hours.reduce((n,h)=>n+h.load*(prices[h.band]||0),0),available=r.subtotal-(r.capacity||0)-(r.distribution||0)-(r.supply||0)-(r.powerFactorAdjustment||0)-(r.otherAdjustment||0);
   if(manualPrices&&energy>available+Math.max(2,r.subtotal*.005))reasons.push('Los precios manuales superan los cargos de energía disponibles en la factura; verifica su fuente y vigencia.');}
  if(economics.issues.length&&!manualPrices)reasons.push(...economics.issues);
  const decision=source.decisions.find(d=>d.id===r.id);
  if(reasons.length){decision.simulated=false;decision.simulationReason=unique(reasons).join('. ');issues.push({id:r.id,reasons:unique(reasons)});continue;}
  const monthLimit=[settings.powerLimitKw,r.demand,r.contractedDemand,r.connectedLoad].filter(v=>Number.isFinite(v)&&v>0);
  const limit=monthLimit.length?Math.min(...monthLimit):Math.max(...p.hours.map(h=>h.load));
  const hours=p.hours.map(h=>({...h,price:prices[h.band]??0,limit,receiptId:r.id}));
  decision.simulated=true;decision.simulationReason='Calculado';periods.push({r,p,economics,prices,hours,limit});
 }
 const shared={version:SIMULATION_VERSION,source,inputs,settings,area,usableAreaM2,maxSolarKw,issues,resource,pricesProvided:manualPrices,areaPending:area==null,demandStatus:'pending',existingEquipment:existing};
 if(existing)return {...shared,status:'pending',reason:'Hay solar o baterías existentes. Se requiere integrar su generación y operación medidas para distinguir consumo total de compras de red; el recibo por sí solo no permite dimensionar la ampliación.'};
 if(!periods.length)return {...shared,status:'pending',reason:'No hay periodos con precios y perfil horario suficientes para evaluar el sistema. Completa las causas indicadas por recibo.'};
 const days=periods.reduce((n,p)=>n+p.p.days,0),annualFactor=365/days;
 const allHours=periods.flatMap(p=>p.hours),maxDaily=Math.max(...periods.flatMap(p=>Array.from({length:p.p.days},(_,i)=>sum(p.hours.slice(i*24,i*24+24),'load'))));
 const maxLoad=Math.max(...allHours.map(h=>h.load)),maxBattery=Math.min(100000,maxDaily/(inputs.efficiencyPct/100)/(inputs.usablePct/100));
 inputs.powerLimitKw=settings.powerLimitKw??Math.max(...periods.map(p=>p.limit));
 const powerFor=cap=>Math.min(10000,cap,Math.max(maxLoad,inputs.powerLimitKw));
 const dayGroups=[];for(const p of periods){const groups=new Map();for(let d=0;d<p.p.days;d++){const hs=p.hours.slice(d*24,d*24+24),key=JSON.stringify(hs.map(h=>[h.band,h.load,h.solar,h.price]));if(!groups.has(key))groups.set(key,{hours:hs,count:0});groups.get(key).count++;}dayGroups.push({period:p,groups:[...groups.values()]});}
 function evaluate(solarKw,batteryKwh,batteryKw,chronological=false){
  const sizes={...inputs,solarKw,batteryKwh,batteryKw};const monthly=[];
  if(chronological){
   // Receding 48-hour perfect-forecast dispatch, carried inventory across adjacent
   // days and invoice boundaries. Start/end of each observed contiguous run is zero.
   let inventory={solar:0,grid:0};const output=new Map(periods.map(p=>[p.r.id,[]]));
   for(let offset=0;offset<allHours.length;offset+=24){let length=Math.min(48,allHours.length-offset);const today=allHours.slice(offset,offset+24);
    const next=allHours[offset+24];if(next&&Date.parse(next.date)-Date.parse(today[0].date)!==DAY)length=24;
    const horizon=allHours.slice(offset,offset+length);
    const dispatch=dispatchDay(profileSlice(horizon),{...sizes,initialSOC:inventory,terminalZero:true});
    const taken=dispatch.hours.slice(0,24).map((h,i)=>({...h,date:today[i].date,receiptId:today[i].receiptId}));
    const end=taken.at(-1);inventory={solar:end.socSolar,grid:end.socGrid};
    for(const h of taken)output.get(h.receiptId).push(h);
   }
   for(const p of periods)monthly.push({period:p,flow:flowSummary(output.get(p.r.id))});
  }else{
   for(const {period,groups} of dayGroups){const expanded=[];for(const group of groups){const flow=dispatchDay(profileSlice(group.hours),sizes);for(let n=0;n<group.count;n++)expanded.push(...flow.hours);}monthly.push({period,flow:flowSummary(expanded)});}
  }
  const rows=monthly.map(({period:p,flow:f})=>{const savings=billSaving(p.r,f.baselineEnergy,f.energyCost);return {id:p.r.id,start:p.r.start,end:p.r.end,days:p.p.days,kwh:p.r.kwh,subtotal:p.r.subtotal,prices:p.prices,...f,...savings,hybridImport:f.importKwh,hybridSaving:savings.saving,hybridBill:savings.bill};});
  const annual=k=>sum(rows,k)*annualFactor;
  return {solarKw,batteryKwh,batteryKw,monthly:rows,days,importKwh:annual('importKwh'),bill:annual('bill'),saving:annual('saving'),generation:annual('generation'),direct:annual('direct'),shifted:annual('shifted'),solarCharge:annual('solarCharge'),gridCharge:annual('gridCharge'),gridDischarge:annual('gridDischarge'),losses:annual('losses'),unused:annual('unused'),usefulSolar:annual('usefulSolar'),energySaving:annual('energySaving'),pfDelta:annual('pfDelta'),demandSaving:null,
   gridByBand:Object.fromEntries(BANDS.map(b=>[b,rows.reduce((n,r)=>n+r.gridByBand[b],0)*annualFactor])),baselineByBand:Object.fromEntries(BANDS.map(b=>[b,rows.reduce((n,r)=>n+r.baselineByBand[b],0)*annualFactor]))};
 }
 const annualKwh=sum(periods.map(p=>p.r),'kwh')*annualFactor,solarMatch=annualKwh/inputs.yieldKwh;
 const solarOptions=unique([0,.5,.75,1,1.25,1.5].map(k=>Math.min(maxSolarKw,k*solarMatch)).concat(maxSolarKw)),batteryOptions=[0,.25,.5,.75,1].map(k=>k*maxBattery);
 const candidates=[];for(const solar of solarOptions)for(const battery of batteryOptions)candidates.push(evaluate(solar,battery,powerFor(battery)));
 const rank=list=>{const coverage=Math.max(...list.map(c=>c.usefulSolar)),covered=list.filter(c=>c.usefulSolar>=coverage-annualKwh*.001),best=Math.max(...covered.map(c=>c.saving));return covered.filter(c=>c.saving>=best-Math.max(1,best*.001)).sort((a,b)=>(a.solarKw/(maxSolarKw||1)+a.batteryKwh/(maxBattery||1))-(b.solarKw/(maxSolarKw||1)+b.batteryKwh/(maxBattery||1)))[0];};
 let recommended=rank(candidates);const target={coverage:recommended.usefulSolar,saving:recommended.saving};
 for(const dimension of ['solarKw','batteryKwh','batteryKw']){let lo=0,hi=recommended[dimension];for(let i=0;i<7&&hi-lo>.1;i++){const mid=(lo+hi)/2,t={...recommended,[dimension]:mid},c=evaluate(t.solarKw,t.batteryKwh,t.batteryKw);candidates.push(c);if(c.usefulSolar>=target.coverage-annualKwh*.001&&c.saving>=target.saving-Math.max(1,target.saving*.001)){hi=mid;recommended=c;}else lo=mid;}}
 const soloSolar=rank(candidates.filter(c=>c.batteryKwh===0)),soloBattery=candidates.filter(c=>c.solarKw===0).sort((a,b)=>b.saving-a.saving||a.batteryKwh-b.batteryKwh)[0];
 const full=c=>evaluate(c.solarKw,c.batteryKwh,c.batteryKw,true);
 // Compare neighboring and refined candidates again with actual chronological dispatch.
 const finalists=unique([recommended,...candidates.filter(c=>c.usefulSolar>=target.coverage-annualKwh*.002).sort((a,b)=>b.saving-a.saving).slice(0,2)]).map(full);
 recommended=rank(finalists);
 const selected=inputs.manual===1?full({solarKw:Math.min(settings.solarKw??recommended.solarKw,maxSolarKw),batteryKwh:settings.batteryKwh??recommended.batteryKwh,batteryKw:settings.batteryKw??recommended.batteryKw}):recommended;
 const baseline=full({solarKw:0,batteryKwh:0,batteryKw:0}),solar=full(soloSolar),battery=full(soloBattery);
 const scenarios=[{...baseline,id:'baseline',label:'Situación actual'},{...solar,id:'solar',label:'Solo solar'},{...battery,id:'battery',label:'Solo batería'},{...selected,id:'hybrid',label:'Solar + batería'}];
 Object.assign(inputs,{solarKw:selected.solarKw,batteryKwh:selected.batteryKwh,batteryKw:selected.batteryKw});
 return {...shared,...selected,inputs,scenarios,status:issues.length?'partial':'estimated',reason:issues.length?'El resultado solo incluye los periodos con datos suficientes.':'',candidateCount:candidates.length+finalists.length,solarAreaM2:selected.solarKw*5.5,annualKwh,modeledDays:days,modeledReceipts:periods.length,recommended:{solarKw:recommended.solarKw,batteryKwh:recommended.batteryKwh,batteryKw:recommended.batteryKw},extraBatterySaving:selected.saving-evaluate(selected.solarKw,0,0,true).saving,omissions:source.decisions.filter(d=>!d.simulated),scheduleAssumed:!periods.every(p=>p.p.scheduleKnown),baselineReconciled:periods.every(p=>p.economics.reconciled),calendarRegions:unique(periods.map(p=>p.p.region))};
}

export function simulate(data,overrides=data.simulation){
 const identity=serviceResolver(data.receipts),services=unique((data.receipts||[]).filter(r=>r.kind==='bill'&&!r.excluded).map(r=>identity(r.service)).filter(Boolean));
 const all=data.service===ALL_SERVICES||(!data.service&&services.length>1);
 const common=services.length>1?Object.fromEntries(Object.entries(sanitizeSimulation(overrides)).filter(([k])=>!['manual','solarKw','batteryKwh','batteryKw','basePrice','intermediatePrice','peakPrice','tariffSet','priceSource','region','powerLimitKw'].includes(k))):overrides;
 if(!all||services.length<2){const id=services.length===1?services[0]:identity(data.service),local=data.serviceSettings?.[id]||{},overallocated=services.reduce((n,id)=>n+(data.serviceSettings?.[id]?.areaM2||0),0)>(data.roof?.area_m2??0)+.1;
  const r=simulateService({...data,roof:services.length>1?(overallocated||local.areaM2==null?null:{area_m2:local.areaM2}):data.roof},{...common,...local});return {...r,settingsScope:services.length>1||data.serviceSettings?.[id]?id:''};}
 const assigned=services.reduce((n,id)=>n+(data.serviceSettings?.[id]?.areaM2||0),0),roofArea=data.roof?.area_m2;
 const allocationError=roofArea!=null&&assigned>roofArea+.1;
 const results=services.map(id=>{const local=data.serviceSettings?.[id]||{},area=allocationError?null:local.areaM2??null;return {service:id,result:simulateService({...data,service:id,roof:area==null?null:{area_m2:area}},{...common,...local})};});
 const valid=results.filter(r=>r.result.scenarios),comparable=valid.length===services.length&&valid.every(r=>r.result.status!=='partial'&&!r.result.areaPending)&&new Set(valid.map(r=>`${r.result.source.start}:${r.result.source.end}:${r.result.modeledDays}`)).size===1;
 const scenarios=['baseline','solar','battery','hybrid'].map(id=>({id,label:{baseline:'Situación actual',solar:'Solo solar',battery:'Solo batería',hybrid:'Solar + batería'}[id],importKwh:valid.reduce((n,r)=>n+r.result.scenarios.find(c=>c.id===id).importKwh,0),bill:valid.reduce((n,r)=>n+r.result.scenarios.find(c=>c.id===id).bill,0),saving:valid.reduce((n,r)=>n+r.result.scenarios.find(c=>c.id===id).saving,0)}));
 return {version:SIMULATION_VERSION,project:true,source:{ready:true,services},results,scenarios,comparable,allocationError,assigned,roofArea,status:comparable?'estimated':'partial',evaluated:valid.length};
}
