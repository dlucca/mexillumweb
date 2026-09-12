import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simulate,simulationSource,sanitizeSimulation} from '../js/expediente.simulation.js';
import {simulationView} from '../js/expediente.simulation-view.js';
const bill=(extra={})=>({id:'one',kind:'bill',service:'123',tariff:'GDMTH',start:'2026-01-01',end:'2026-02-01',total:11600,subtotal:10000,kwh:4000,capacity:2000,distribution:1000,reviewed:false,uncertain:[],...extra});
const draft=(receipts=[bill()])=>({receipts,roof:{area_m2:1000},answers:{}});
test('unconfirmed consistent readings produce an explicitly provisional scenario without mutating review state',()=>{
 const data=draft(),before=JSON.stringify(data),result=simulate(data);
 assert.equal(result.source.unconfirmed,1);assert.equal(JSON.stringify(data),before);
 assert.match(simulationView(result),/Con datos provisionales/);
 assert.equal(result.source.annualObserved,false);
});
test('sizing maximizes useful solar, preserves demand charges, and keeps annual balances',()=>{
 const d=draft([bill({base:700,intermediate:2900,peak:400,demand:25})]);
 const r=simulate(d,{basePrice:1,intermediatePrice:2,peakPrice:4});
 assert.ok(r.solarKw>r.source.annualKwh*.6/1500);assert.ok(r.solarKw<=r.maxSolarKw);
 assert.ok(r.usefulSolar/r.source.annualKwh>.99);assert.ok(r.candidateCount>20);
 for(const m of r.monthly){
  assert.ok(Math.abs(m.generation+m.hybridImport-m.kwh-m.losses-m.unused)<1e-4);
  assert.ok(m.hybridBill>=3000);assert.ok(m.hybridSaving>=0);
 }
});
test('without solar space battery arbitrage works, but flat prices suggest no battery',()=>{
 const d={...draft([bill({base:700,intermediate:2900,peak:400,demand:25})]),roof:{area_m2:0}};
 const r=simulate(d,{basePrice:1,intermediatePrice:2,peakPrice:4});
 assert.equal(r.solarKw,0);assert.ok(r.batteryKwh>0);assert.ok(r.gridCharge>0);assert.ok(r.saving>0);
 assert.equal(simulate(d).batteryKwh,0);assert.equal(simulate(d).pricesProvided,false);
});
test('manual zero battery adds no savings and period demand limits extra grid charging',()=>{
 const d=draft([bill({base:700,intermediate:2900,peak:400,demand:10})]);
 const r=simulate(d,{manual:1,solarKw:0,batteryKwh:1000,batteryKw:100,powerLimitKw:100,basePrice:1,intermediatePrice:2,peakPrice:4});
 for(const m of r.monthly)for(const h of m.flow.hours)if(h.gridCharge>0)assert.ok(h.grid<=10+1e-5);
 assert.equal(simulate(d,{manual:1,batteryKwh:0}).extraBatterySaving,0);
});
test('excluded and duplicate bills never increase the baseline',()=>{
 const r=simulate(draft([bill(),bill({id:'duplicate',reviewed:true}),bill({id:'excluded',excluded:true,kwh:999999})]));
 assert.equal(r.source.rows.length,1);assert.equal(r.source.rows[0].id,'duplicate');assert.equal(r.source.duplicates,1);
 assert.equal(r.source.annualKwh,4000/31*365);
});
test('overlap and critical uncertainty block use until explicitly corrected or reviewed',()=>{
 assert.equal(simulationSource(draft([bill(),bill({id:'two',start:'2026-01-15',end:'2026-02-15'})])).ready,false);
 assert.equal(simulationSource(draft([bill({uncertain:['kwh']})])).ready,false);
 assert.equal(simulationSource(draft([bill({uncertain:['kwh'],correctedFields:['kwh']})])).ready,true);
 assert.equal(simulationSource(draft([bill({uncertain:['address']})])).ready,true);
});
test('multiple services require selection and selected source is isolated',()=>{
 const d=draft([bill(),bill({id:'two',service:'456',kwh:8000})]);
 assert.equal(simulate(d).source.ready,false);d.service='123';assert.equal(simulate(d).source.rows.length,1);
});
test('latest twelve periods are selected without pretending a gap is continuous',()=>{
 const rows=Array.from({length:14},(_,i)=>{const a=new Date(Date.UTC(2024,i,1)),b=new Date(Date.UTC(2024,i+1,1));return bill({id:String(i),start:a.toISOString().slice(0,10),end:b.toISOString().slice(0,10)});});
 const s=simulationSource(draft(rows));assert.equal(s.rows.length,12);assert.equal(s.rows[0].id,'2');assert.equal(s.annualObserved,true);
 rows.splice(10,1);const g=simulationSource(draft(rows));assert.equal(g.annualObserved,false);assert.equal(g.gaps,1);
});
test('roof limits generation; missing roof is disclosed without assuming zero area',()=>{
 const r=simulate({...draft(),roof:{area_m2:55}},{manual:1,solarKw:50});assert.equal(r.solarKw,7);assert.equal(r.roofLimited,true);
 assert.equal(r.solarAreaM2,38.5);assert.equal(r.usableAreaM2,38.5);
 const actual=simulate({...draft(),roof:{area_m2:1788.6}},{manual:1,solarKw:46.2});
 assert.ok(Math.abs(actual.solarAreaM2-254.1)<1e-8);
 assert.match(simulationView(actual),/254.1/);
 assert.match(simulationView(actual),/Área total marcada/);
 const missing=simulate({...draft(),roof:null});assert.equal(missing.maxSolarKw,null);assert.equal(missing.solarKw,0);assert.match(simulationView(missing),/Falta marcar/);
});
test('invalid assumptions and forged results cannot persist, and input text is escaped',()=>{
 assert.deepEqual(sanitizeSimulation({solarKw:-1,yieldKwh:Infinity,energyPrice:'2',saving:99999,batteryKw:0}),{batteryKw:0});
 const r=simulate(draft());r.source.start='<img src=x onerror=alert(1)>';
 assert.ok(!simulationView(r).includes('<img'));assert.match(simulationView(r),/&lt;img/);
});
test('flat fallback remains unverified after saving and invalid schedules remain repairable',()=>{
 const r=simulate(draft(),{basePrice:1,intermediatePrice:1,peakPrice:1,tariffSet:0,peakStart:22,peakEnd:13});
 assert.equal(r.pricesProvided,false);assert.equal(r.scheduleAdjusted,true);assert.match(simulationView(r),/data-sim="peakEnd"/);
 const sourced=simulate(draft(),{basePrice:1,intermediatePrice:2,peakPrice:3,priceSource:'<script>alert(1)</script>'});
 assert.equal(sourced.pricesProvided,true);assert.ok(!simulationView(sourced).includes('<script>'));
});

test('partial prices cannot silently enable arbitrage behind a flat-price warning',()=>{
 const d={...draft(),roof:{area_m2:0}};const r=simulate(d,{basePrice:0});
 assert.equal(r.pricesProvided,false);assert.equal(r.inputs.basePrice,r.inputs.peakPrice);assert.equal(r.gridCharge,0);
});
test('all-service selection simulates aliases of one meter but never shares energy across distinct meters',()=>{
 const d=draft([bill({service:'961020200049'}),bill({id:'two',service:'No.deservicio:961020200049',start:'2026-02-01',end:'2026-03-01'})]);d.service='__all__';
 assert.equal(simulationSource(d).ready,true);assert.equal(simulationSource(d).rows.length,2);
 d.receipts[1].service='961020200050';assert.equal(simulationSource(d).ready,false);
});
