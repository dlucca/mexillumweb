// Shared, deterministic receipt validation. Missing data stays null; never becomes zero.
export const RECEIPT_FIELDS = {
  service: 'Número de servicio', holder: 'Titular', address: 'Dirección', tariff: 'Tarifa',
  start: 'Inicio del periodo', end: 'Fin del periodo', total: 'Total facturado con IVA (MXN)',
  subtotal: 'Subtotal sin IVA (MXN)', kwh: 'Consumo total (kWh)', base: 'Consumo base (kWh)',
  intermediate: 'Consumo intermedio (kWh)', peak: 'Consumo punta (kWh)',
  demand: 'Demanda máxima (kW)', peakDemand: 'Demanda en punta (kW)',
  contractedDemand: 'Demanda contratada (kW)', capacity: 'Cargo por capacidad (MXN)',
  distribution: 'Cargo por distribución (MXN)', powerFactor: 'Factor de potencia (%)',
  powerFactorAdjustment: 'Ajuste por factor de potencia (MXN)'
};
export const TEXT_FIELDS = ['service', 'holder', 'address', 'tariff', 'start', 'end'];
export function number(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}
export function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return !isNaN(d) && d.toISOString().slice(0, 10) === value ? d : null;
}
export function receiptIssues(r) {
  const issues = [];
  if (!r.service) issues.push('Falta identificar el servicio.');
  if (!r.tariff) issues.push('Falta confirmar la tarifa.');
  if (!date(r.start) || !date(r.end) || r.start >= r.end) issues.push('Revisa las fechas del periodo.');
  if (r.total == null || r.kwh == null) issues.push('Falta importe o consumo total.');
  for (const k of Object.keys(RECEIPT_FIELDS).filter(k => !TEXT_FIELDS.includes(k))) {
    if (r[k] != null && (!Number.isFinite(r[k]) || (k !== 'powerFactorAdjustment' && r[k] < 0))) issues.push(`Revisa ${RECEIPT_FIELDS[k].toLowerCase()}.`);
  }
  if (r.powerFactor != null && r.powerFactor > 100) issues.push('El factor de potencia supera 100%.');
  if ([r.base,r.intermediate,r.peak,r.kwh].every(v => v != null) && Math.abs(r.base+r.intermediate+r.peak-r.kwh) > Math.max(2,r.kwh*.005)) issues.push('La suma de los horarios no coincide con el consumo total.');
  if (r.demand != null && r.peakDemand != null && r.peakDemand > r.demand) issues.push('La demanda en punta supera el máximo mensual.');
  if (r.subtotal != null && r.total != null && r.subtotal > r.total) issues.push('El subtotal supera al total. Revisa si hay ajustes.');
  return issues;
}
export function normalizeReceipt(raw, fileId, index) {
  const r = { id: `${fileId}:${index}`, fileId, page: Number.isInteger(raw.page) && raw.page > 0 ? raw.page : null, kind: raw.kind === 'history' ? 'history' : 'bill', reviewed: false, excluded: false };
  for (const k of Object.keys(RECEIPT_FIELDS)) r[k] = TEXT_FIELDS.includes(k) ? (typeof raw[k] === 'string' ? raw[k].trim().slice(0,500) : '') : number(raw[k]);
  r.tariff = r.tariff.toUpperCase();
  r.service = r.service.replace(/\s/g,'');
  r.uncertain = Array.isArray(raw.uncertain) ? raw.uncertain.filter(k => k in RECEIPT_FIELDS) : [];
  r.original = Object.fromEntries(Object.keys(RECEIPT_FIELDS).map(k => [k,r[k]]));
  return r;
}
export const ALL_SERVICES='__all__';
// Only explicit 12-digit service numbers are canonicalized. RMU-only readings
// join a service only when another receipt explicitly pairs that same RMU with
// exactly one service. Preserve the source text and review/provenance state.
export function serviceResolver(receipts=[]) {
  const compact=v=>String(v||'').trim().replace(/\s/g,'').toUpperCase();
  const number=v=>{const x=compact(v);return /^\d{12}$/.test(x)?x:x.match(/(?:NO\.?DESERVICIO|N[ÚU]MERODESERVICIO|SERVICIO)[:#.]?(\d{12})(?!\d)/)?.[1]||'';};
  const rmu=v=>compact(v).match(/(?:RMU:?)?(\d{7}-\d{2}-\d{2}[A-Z0-9-]+CFE)/)?.[1]||'';
  const pairs=new Map();
  for(const r of receipts){const n=number(r.service),m=rmu(r.service);if(n&&m){if(!pairs.has(m))pairs.set(m,new Set());pairs.get(m).add(n);}}
  return value=>{const n=number(value);if(n)return n;const m=rmu(value),matches=pairs.get(m);return matches?.size===1?[...matches][0]:compact(value);};
}
export function summarize(receipts = [], service = '') {
  const source = receipts.filter(r => r.kind !== 'history' && !r.excluded);
  const identity=serviceResolver(receipts);
  const services = [...new Set(source.map(r=>identity(r.service)).filter(Boolean))];
  if(service===ALL_SERVICES){
    const groups=services.map(id=>summarize(receipts,id));
    const usable=groups.flatMap(g=>g.usable),totals=k=>usable.length&&usable.every(r=>r[k]!=null)?usable.reduce((n,r)=>n+r[k],0):null;
    const months=[...new Set(groups.flatMap(g=>g.monthCoverage.map(m=>m.month)))].sort().slice(-12);
    return {services,selected:ALL_SERVICES,rows:source,usable,duplicates:groups.flatMap(g=>g.duplicates),overlaps:groups.flatMap(g=>g.overlaps),
      pending:source.filter(r=>!r.reviewed||receiptIssues(r).length),gaps:groups.flatMap(g=>g.gaps),
      monthCoverage:months.map(month=>({month,complete:groups.every(g=>g.monthCoverage.some(m=>m.month===month&&m.complete))})),
      days:groups.reduce((n,g)=>n+g.days,0),start:groups.map(g=>g.start).filter(Boolean).sort()[0]||null,end:groups.map(g=>g.end).filter(Boolean).sort().at(-1)||null,
      tariffs:[...new Set(usable.map(r=>r.tariff))],total:totals('total'),kwh:totals('kwh'),capacity:totals('capacity'),distribution:totals('distribution'),
      monthlyEquivalent:groups.length&&groups.every(g=>g.monthlyEquivalent!=null)?groups.reduce((n,g)=>n+g.monthlyEquivalent,0):null,
      annualReady:groups.length>0&&groups.every(g=>g.annualReady)&&source.every(r=>identity(r.service))};
  }
  const selected = identity(service) || (services.length === 1 ? services[0] : '');
  const rows = source.filter(r => selected && identity(r.service) === selected);
  const sorted = [...rows].sort((a,b)=>(a.start||'').localeCompare(b.start||''));
  const duplicates = [], overlaps = [], seen = new Map();
  for (const r of sorted) {
    const key = `${identity(r.service)}:${r.start}:${r.end}`;
    if (seen.has(key)) duplicates.push(r.id); else seen.set(key,r.id);
  }
  const unique = sorted.filter(r=>!duplicates.includes(r.id));
  for (let i=0;i<unique.length;i++) for(let j=i+1;j<unique.length;j++) {
    if(date(unique[i].start)&&date(unique[i].end)&&date(unique[j].start)&&date(unique[j].end)&&unique[i].start<unique[j].end&&unique[j].start<unique[i].end) overlaps.push(unique[i].id,unique[j].id);
  }
  const overlapIds=[...new Set(overlaps)];
  const pending = rows.filter(r=>!r.reviewed || receiptIssues(r).length);
  // Calculations only use explicitly confirmed, arithmetically consistent primary bills.
  const usable = unique.filter(r=>r.reviewed && !receiptIssues(r).length && !overlapIds.includes(r.id));
  const days = usable.reduce((s,r)=>s+(date(r.end)-date(r.start))/86400000,0);
  const totals = key => usable.length && usable.every(r=>r[key]!=null) ? usable.reduce((s,r)=>s+r[key],0) : null;
  const spans = unique.filter(r=>date(r.start)&&date(r.end)&&r.start<r.end);
  const gaps = [];
  for(let i=1;i<spans.length;i++) if(spans[i].start>spans[i-1].end) gaps.push({start:spans[i-1].end,end:spans[i].start});
  const end = spans.at(-1)?.end || null;
  const monthCoverage = [];
  if(end) {
    const cursor = date(end); cursor.setUTCDate(cursor.getUTCDate()+1); cursor.setUTCDate(1);
    // Last 12 complete calendar months up to the latest billing end boundary.
    for(let i=12;i>=1;i--) {
      const s = new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()-i,1));
      const e = new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()-i+1,1));
      let coveredTo = s.getTime();
      for(const r of spans) {
        const a=date(r.start).getTime()+86400000, b=date(r.end).getTime()+86400000;
        if(a<=coveredTo && b>coveredTo) coveredTo=Math.min(b,e.getTime());
      }
      monthCoverage.push({month:s.toISOString().slice(0,7),complete:coveredTo>=e.getTime()});
    }
  }
  return {services,selected,rows,usable,duplicates,overlaps:overlapIds,pending,gaps,monthCoverage,days,
    start:spans[0]?.start||null,end,tariffs:[...new Set(usable.map(r=>r.tariff))],
    total:totals('total'),kwh:totals('kwh'),capacity:totals('capacity'),distribution:totals('distribution'),
    monthlyEquivalent:days>0 && totals('total')!=null ? totals('total')/days*(365.25/12) : null,
    annualReady:days>=365 && !pending.length && !duplicates.length && !overlaps.length && !gaps.length};
}
export function requiredQuestions(data) {
  const s=summarize(data.receipts,data.service);
  const questions=['sector','objective','schedule','equipment','scope'];
  if(!s.usable.length) questions.push('manualTariff','manualBill');
  if(data.answers?.objective?.includes('continuity')) questions.push('outage');
  if(data.answers?.objective?.includes('growth')) questions.push('growth');
  if(data.answers?.equipment?.includes('solar')) questions.push('solar');
  return questions;
}
export function recommendations(data) {
  const a=data.answers||{}, s=summarize(data.receipts,data.service), list=[];
  if(a.objective?.includes('cost')) {
    list.push({name:'Solar y autoconsumo',status:'Evaluar',reason:'Comparar generación con horarios, calendario y espacios disponibles; confirmar excedentes y equipos existentes.'});
    if(s.usable.some(r=>(r.capacity||0)>0 || (r.distribution||0)>0)) list.push({name:'Reducción de demanda',status:'Falta curva de demanda',reason:'Hay cargos de capacidad o distribución. Medir duración y repetición de picos antes de dimensionar baterías.'});
    if(s.tariffs.some(t=>['GDMTH','DIST','DIT'].includes(t))) list.push({name:'Arbitraje horario',status:'Simulación pendiente',reason:'La tarifa tiene periodos horarios. Comparar precios, pérdidas y carga de batería; los recibos no contienen la curva intradiaria.'});
  }
  if(a.objective?.includes('continuity')) list.push({name:'Continuidad operativa',status:'Definir cargas críticas',reason:'Evaluar autonomía, transferencia y equipos existentes. El beneficio por cortes se calcula separado del ahorro en CFE.'});
  if(a.objective?.includes('growth')) list.push({name:'Capacidad para crecimiento',status:'Revisión técnica',reason:'Cuantificar las cargas nuevas y verificar la acometida antes de elegir una solución.'});
  if(!list.length) list.push({name:'Revisión con tu asesor',status:'Datos pendientes',reason:'Completa tu objetivo o comparte recibos para orientar la evaluación.'});
  return list;
}
