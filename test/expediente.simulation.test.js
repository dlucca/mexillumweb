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
test('monthly energy is conserved and financial savings preserve demand charges',()=>{
 for(const solarKw of [0,5,100,10000])for(const selfUsePct of [0,30,100])for(const batteryKwh of [0,1,1000]){
  const r=simulate(draft(),{solarKw,selfUsePct,batteryKwh,batteryKw:20,energyPrice:30});
  for(const m of r.monthly){
   assert.ok(Math.abs(m.generation-m.direct-m.shifted-m.losses-m.unused)<1e-7);
   assert.ok(Math.abs(m.kwh-m.direct-m.shifted-m.hybridImport)<1e-7);
   assert.ok(m.hybridImport>=0&&m.losses>=0&&m.unused>=-1e-7);
   assert.ok(m.hybridBill>=3000&&m.hybridSaving>=m.solarSaving);
  }
 }
});
test('zero solar or zero price gives no savings; zero battery or power adds no savings',()=>{
 for(const patch of [{solarKw:0},{energyPrice:0}])assert.equal(simulate(draft(),patch).scenarios[2].saving,0);
 for(const patch of [{batteryKwh:0},{batteryKw:0}])assert.equal(simulate(draft(),patch).extraBatterySaving,0);
});
test('battery respects usable capacity, efficiency and four daily discharge hours',()=>{
 const r=simulate(draft(),{solarKw:100,selfUsePct:0,batteryKwh:10,batteryKw:1,efficiencyPct:80,usablePct:50});
 const m=r.monthly[0];assert.equal(m.shifted,124);assert.equal(m.charged,155);assert.equal(m.losses,31);
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
 const r=simulate({...draft(),roof:{area_m2:55}},{solarKw:50});assert.equal(r.solarKw,7);assert.equal(r.roofLimited,true);
 assert.equal(simulate({...draft(),roof:null}).maxSolarKw,null);
});
test('invalid assumptions and forged results cannot persist, and input text is escaped',()=>{
 assert.deepEqual(sanitizeSimulation({solarKw:-1,yieldKwh:Infinity,energyPrice:'2',saving:99999,batteryKw:0}),{batteryKw:0});
 const r=simulate(draft());r.source.start='<img src=x onerror=alert(1)>';
 assert.ok(!simulationView(r).includes('<img'));assert.match(simulationView(r),/&lt;img/);
});
