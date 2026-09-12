import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulate,simulationSource,sanitizeSimulation} from '../js/expediente.simulation.js';
import {simulationView} from '../js/expediente.simulation-view.js';
import {billEconomics} from '../js/expediente.billing.js';
const golden=JSON.parse(readFileSync(new URL('./fixtures/cfe-san-luis-2026-01.json',import.meta.url)));
const bill=(extra={})=>({...golden,id:'one',fileId:'file',reviewed:false,...extra});
const draft=(receipts=[bill()])=>({receipts,roof:{area_m2:443.2},answers:{}});
test('January bill reconstructs invoice-specific prices, subtotal, VAT and prior balance independently',()=>{
 const e=billEconomics(bill());assert.equal(e.reconciled,true);assert.equal(e.reconstructed,412762.49);
 for(const [b,v] of Object.entries({base:1.0012,intermediate:1.6932,peak:1.9621}))assert.ok(Math.abs(e.prices[b]-v)<1e-6);
 assert.equal(billEconomics(bill({generationPeak:999999})).prices,null);
 assert.equal(billEconomics(bill({uncertain:['generationPeak']})).prices,null);
 assert.ok(billEconomics(bill({uncertain:['generationPeak'],correctedFields:['generationPeak']})).prices);
});
test('processed January bill produces solar and battery without manual confirmation or manual tariffs',()=>{
 const d=draft(),before=JSON.stringify(d),r=simulate(d);assert.equal(JSON.stringify(d),before);
 assert.equal(r.status,'estimated');assert.equal(r.pricesProvided,false);assert.ok(r.batteryKwh>0);assert.ok(r.solarKw>0);assert.ok(r.gridCharge>0);assert.ok(r.saving>0);assert.equal(r.demandSaving,null);
 assert.match(simulationView(r),/datos provisionales/);assert.equal(r.modeledDays,31);assert.equal(r.source.annualObserved,false);
 for(const c of r.scenarios){assert.ok(Math.abs(c.generation+c.importKwh-r.annualKwh-c.losses-c.unused)<1e-3);assert.ok(c.bill>=0);}
 assert.ok(r.solarAreaM2<=443.2*.7+.01);assert.equal(r.monthly[0].prices.base,billEconomics(bill()).prices.base);
});
test('no space supports tariff arbitrage; flat prices choose no storage; missing prices stay pending',()=>{
 const d={...draft(),roof:{area_m2:0}},r=simulate(d);assert.equal(r.solarKw,0);assert.ok(r.batteryKwh>0);assert.ok(r.saving>0);
 const flat=simulate(d,{tariffSet:1,basePrice:1,intermediatePrice:1,peakPrice:1});assert.equal(flat.batteryKwh,0);assert.equal(flat.saving,0);
 const missing=simulate(draft([bill({generationPeak:null})]));assert.equal(missing.status,'pending');assert.equal(missing.batteryKwh,undefined);assert.match(simulationView(missing),/permanecen pendientes/);
});
test('manual zero battery adds no battery saving and solar size cannot exceed assigned roof',()=>{
 const r=simulate(draft(),{manual:1,solarKw:1000,batteryKwh:0,batteryKw:0});assert.equal(r.extraBatterySaving,0);assert.equal(r.solarKw,r.maxSolarKw);assert.equal(r.solarAreaM2,r.usableAreaM2);
});
test('duplicates, overlaps, critical uncertainty and exclusions have per-receipt reasons',()=>{
 const r=simulationSource(draft([bill(),bill({id:'duplicate',reviewed:true}),bill({id:'excluded',excluded:true,kwh:999999})]));
 assert.equal(r.rows.length,1);assert.equal(r.rows[0].id,'duplicate');assert.equal(r.duplicates,1);assert.equal(r.decisions.length,3);
 assert.equal(simulationSource(draft([bill(),bill({id:'two',start:'2026-01-15',end:'2026-02-15'})])).ready,false);
 assert.equal(simulationSource(draft([bill({uncertain:['kwh']})])).ready,false);
 assert.equal(simulationSource(draft([bill({uncertain:['kwh'],correctedFields:['kwh']})])).ready,true);
 assert.equal(simulationSource(draft([bill({uncertain:['address']})])).ready,true);
});
test('latest twelve periods selected; a gap is never presented as a complete year',()=>{
 const rows=Array.from({length:14},(_,i)=>{const a=new Date(Date.UTC(2025,i,1)),b=new Date(Date.UTC(2025,i+1,1));return bill({id:String(i),start:a.toISOString().slice(0,10),end:b.toISOString().slice(0,10)});});
 const s=simulationSource(draft(rows));assert.equal(s.rows.length,12);assert.equal(s.rows[0].id,'2');assert.equal(s.annualObserved,true);
 rows.splice(10,1);const g=simulationSource(draft(rows));assert.equal(g.annualObserved,false);assert.equal(g.gaps,1);
});
test('services have independent equipment, totals sum only calculated meters, roof is not duplicated',()=>{
 const d=draft([bill({service:'111111111111'}),bill({id:'two',service:'222222222222'})]);d.service='__all__';d.serviceSettings={'111111111111':{areaM2:443.2},'222222222222':{areaM2:0}};
 const r=simulate(d);assert.equal(r.project,true);assert.equal(r.comparable,true);assert.equal(r.results[1].result.solarKw,0);
 assert.equal(r.scenarios[3].saving,r.results.reduce((n,x)=>n+x.result.saving,0));
 d.service='222222222222';assert.equal(simulate(d).solarKw,0);
 d.service='__all__';d.serviceSettings['222222222222'].areaM2=443.2;const invalid=simulate(d);assert.equal(invalid.allocationError,true);assert.ok(invalid.results.every(x=>x.result.areaPending));
 d.receipts[1].generationPeak=null;const partial=simulate(d);assert.equal(partial.evaluated,1);assert.equal(partial.comparable,false);assert.match(simulationView(partial),/Resumen parcial/);
});
test('unknown roof, unsupported tariff, missing location region and installed generation are explicit states',()=>{
 assert.equal(simulate({...draft(),roof:null}).areaPending,true);
 assert.equal(simulate(draft([bill({tariff:'DIST'})])).status,'pending');
 assert.equal(simulate(draft([bill({state:null,address:null})])).status,'pending');
 assert.equal(simulate({...draft(),answers:{equipment:['solar']}}).status,'pending');
});
test('assumptions are bounded, optional blanks survive, and source text is escaped',()=>{
 assert.deepEqual(sanitizeSimulation({solarKw:-1,yieldKwh:Infinity,energyPrice:'2',saving:99999,batteryKw:0}),{batteryKw:0});
 const r=simulate(draft());r.source.decisions[0].start='<img src=x onerror=alert(1)>';assert.ok(!simulationView(r).includes('<img'));assert.match(simulationView(r),/&lt;img/);
});
test('stale location or orientation never reuse a solar resource from another site',()=>{
 const d={...draft(),location:{lat:22,lng:-100},solarResource:{key:'22.000,-100.000:20:0',monthly:Array(12).fill(150),source:'Fixture'}};
 assert.equal(simulate(d).inputs.yieldKwh,1800);d.location.lat=23;assert.equal(simulate(d).resource,null);
});
