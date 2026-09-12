import {serviceResolver,ALL_SERVICES,unresolvedFields} from './expediente.model.js?v=20260912-11';
export const fmtNumber=(v,d=0)=>Number.isFinite(v)?new Intl.NumberFormat('es-MX',{maximumFractionDigits:d}).format(v):'Pendiente';
export const fmtMoney=v=>Number.isFinite(v)?new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(v):'Pendiente';
export function billImpact(result){
 const current=result.scenarios?.find(r=>r.id==='baseline'),combined=result.scenarios?.find(r=>r.id==='hybrid');
 if(!Number.isFinite(current?.bill)||!Number.isFinite(combined?.bill)||(result.project&&!result.evaluated))return null;
 const saving=current.bill-combined.bill;
 return {current:current.bill,withSystem:combined.bill,saving,reductionPct:current.bill>0?saving/current.bill*100:null,
  partial:result.project?!result.comparable:result.status==='partial',batteryContribution:Number.isFinite(result.extraBatterySaving)?result.extraBatterySaving:null};
}
export const COVERAGE_EXPLANATION='La cobertura solar mide energía (kWh); la reducción de la factura mide dinero. El cálculo conserva los cargos de capacidad, distribución y otros conceptos fijos, por lo que ambos porcentajes pueden ser distintos.';
export const SAVINGS_EXPLANATION='El ahorro de solar + batería es el ahorro total del sistema combinado. Los ahorros de las filas son alternativas: no se suman entre sí.';
export const BATTERY_EXPLANATION='El aporte de la batería ya está incluido en el ahorro total. Se compara el sistema combinado con la misma potencia solar sin batería; la alternativa Solo solar puede tener otro tamaño.';
export function customerSummary(data){
 const rows=(data.receipts||[]).filter(r=>r.kind==='bill'&&!r.excluded),identity=serviceResolver(rows);
 const selected=data.service&&data.service!==ALL_SERVICES?identity(data.service):null;
 const ids=[...new Set(rows.map(r=>identity(r.service)).filter(Boolean))].filter(id=>!selected||selected===id);
 const normalized=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
 return ids.map(service=>{
  const bills=rows.filter(r=>identity(r.service)===service).sort((a,b)=>(b.end||'').localeCompare(a.end||'')||(b.start||'').localeCompare(a.start||''));
  const fields=Object.fromEntries(['holder','address','tariff'].map(key=>{const r=bills.find(r=>String(r[key]||'').trim());return [key,{value:r?.[key]||'',end:r?.end||'',uncertain:r?unresolvedFields(r).includes(key):false}];}));
  const conflicting=['holder','address'].filter(k=>new Set(bills.map(r=>normalized(r[k])).filter(Boolean)).size>1);
  return {service,...fields,conflicting};
 });
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function customerView(data){const clients=customerSummary(data);return `<section class="exp-customer" aria-label="Datos del cliente según CFE"><h3>Cliente y domicilio del servicio</h3><p class="exp-note">Datos obtenidos de los recibos CFE. El contacto para el seguimiento se indica por separado.</p>${clients.length?clients.map(c=>`<article><h4>Servicio ${esc(c.service)} · ${esc(c.tariff.value||'Tarifa pendiente')}</h4><dl class="exp-list"><dt>Titular del recibo</dt><dd>${esc(c.holder.value||'Pendiente de lectura')}${c.holder.uncertain?' · lectura por revisar':''}</dd><dt>Domicilio del servicio</dt><dd>${esc(c.address.value||'Pendiente de lectura')}${c.address.uncertain?' · lectura por revisar':''}</dd></dl><p class="exp-note">Titular: recibo con fin ${esc(c.holder.end||'pendiente')}. Domicilio: recibo con fin ${esc(c.address.end||'pendiente')}.${c.conflicting.length?' Hay otros titulares o domicilios en recibos anteriores; verifica cuál corresponde.':''}</p></article>`).join(''):'<p>El titular y el domicilio aparecerán cuando estén disponibles en la lectura de los recibos.</p>'}</section>`;}
export function impactView(result){const x=billImpact(result);if(!x)return '';return `<section class="exp-bill-impact" aria-label="Reducción estimada de la factura"><h4>${x.partial?'Ahorro estimado del alcance calculado':'Resultado económico del sistema combinado'}</h4><dl class="exp-sim-area"><div><dt>${x.saving<0?'Sobrecosto anual estimado':'Ahorro total estimado'}</dt><dd>${fmtMoney(Math.abs(x.saving))} <span>MXN/año</span></dd></div><div><dt>${x.saving<0?'Aumento estimado de la factura':'Reducción estimada de la factura'}</dt><dd>${x.reductionPct==null?'No aplica':fmtNumber(Math.abs(x.reductionPct),1)}${x.reductionPct==null?'':' <span>%</span>'}</dd></div><div><dt>Factura anual con el sistema</dt><dd>${fmtMoney(x.withSystem)} <span>MXN/año</span></dd></div></dl><p>Factura anual actual: <strong>${fmtMoney(x.current)}</strong> → con el sistema: <strong>${fmtMoney(x.withSystem)}</strong>. Importes sin IVA.</p>${x.partial?'<p class="exp-note">Resultado parcial: considera únicamente los periodos y servicios calculados. No representa el ahorro de todo el expediente.</p>':''}</section>`;}
