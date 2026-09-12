import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReceipt,summarize,receiptIssues,requiredQuestions,recommendations,number} from '../js/expediente.model.js';
const bill=(overrides={},id='a')=>({...normalizeReceipt({service:'123',tariff:'GDMTH',start:'2026-01-31',end:'2026-02-28',total:32363.06,subtotal:27899.19,kwh:9854,base:1440,intermediate:7405,peak:1009,demand:47,peakDemand:21,capacity:8442.21,distribution:1759.68,kind:'bill',...overrides},id,0),reviewed:true});
test('missing values stay null, zero consumption remains zero',()=>{assert.equal(number(''),null);assert.equal(number(null),null);assert.equal(number(0),0);assert.equal(number('$32,363.06'),32363.06);});
test('uses actual bill rather than category representative; no annualization of a lone bill',()=>{
 const s=summarize([bill()]);assert.equal(s.total,32363.06);assert.equal(s.kwh,9854);assert.equal(s.days,28);assert.equal(s.annualReady,false);assert.equal(s.monthCoverage.at(-1).month,'2026-02');assert.equal(s.monthCoverage.at(-1).complete,true);
});
test('history, duplicates and excluded corrections never double count',()=>{
 const s=summarize([bill(),bill({},'copy'),bill({kind:'history'},'hist'),{...bill({},'excluded'),excluded:true}]);assert.equal(s.total,32363.06);assert.equal(s.duplicates.length,1);assert.equal(s.rows.length,2);
});
test('different services cannot silently merge',()=>{
 const list=[bill(),bill({service:'456'},'b')];assert.equal(summarize(list).total,null);assert.equal(summarize(list,'456').total,32363.06);
});
test('all overlapping periods are withheld, including nested intervals',()=>{
 const s=summarize([bill({start:'2026-01-01',end:'2026-03-01'}),bill({start:'2026-01-05',end:'2026-01-10'},'b'),bill({start:'2026-02-01',end:'2026-02-20'},'c')]);assert.equal(s.overlaps.length,3);assert.equal(s.total,null);
});
test('invalid dates, consumption mismatches and impossible demands remain review issues',()=>{
 assert.ok(receiptIssues(bill({start:'2026-02-30'})).length);assert.ok(receiptIssues(bill({kwh:99999})).some(i=>i.includes('suma')));assert.ok(receiptIssues(bill({peakDemand:60})).length);assert.ok(receiptIssues(bill({powerFactor:110})).length);
});
test('unreviewed readings do not feed economics',()=>{assert.equal(summarize([{...bill(),reviewed:false}]).total,null);});
test('question suppression is driven by confirmed data and operational answers',()=>{
 const d={receipts:[bill()],answers:{objective:['cost'],equipment:[]}};assert.ok(!requiredQuestions(d).includes('manualBill'));assert.ok(!requiredQuestions(d).includes('outage'));
 assert.ok(requiredQuestions({...d,receipts:[]}).includes('manualBill'));
 assert.ok(requiredQuestions({...d,answers:{objective:['continuity'],equipment:['solar']}}).includes('solar'));
});
test('recommendations are opportunities, not numerical savings or backup assumptions',()=>{
 const r=recommendations({receipts:[bill()],answers:{objective:['cost']}});assert.ok(r.some(x=>x.name==='Arbitraje horario'));assert.ok(!r.some(x=>x.name==='Continuidad operativa'));assert.ok(!JSON.stringify(r).includes('120000'));
});
test('a year of monthly bills has continuous coverage; missing month is visible',()=>{
 const list=Array.from({length:12},(_,i)=>{const start=new Date(Date.UTC(2025,i,0)).toISOString().slice(0,10),end=new Date(Date.UTC(2025,i+1,0)).toISOString().slice(0,10);return bill({start,end},String(i));});
 assert.equal(summarize(list).annualReady,true);assert.equal(summarize(list).monthCoverage.filter(m=>m.complete).length,12);assert.equal(summarize(list.filter((_,i)=>i!==5)).annualReady,false);assert.equal(summarize(list.filter((_,i)=>i!==5)).gaps.length,1);
});
