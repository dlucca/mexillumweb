import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReceipt,summarize,receiptIssues,requiredQuestions,recommendations,number,serviceResolver} from '../js/expediente.model.js';
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
test('all services includes every bill without treating different meters as duplicate or overlapping',()=>{
 const a=bill(),b=bill({service:'456'},'b');const s=summarize([a,b],'__all__');
 assert.equal(s.rows.length,2);assert.equal(s.total,a.total+b.total);assert.equal(s.kwh,a.kwh+b.kwh);assert.equal(s.duplicates.length,0);assert.equal(s.overlaps.length,0);
 const duplicate=summarize([a,b,bill({},'copy')],'__all__');assert.equal(duplicate.duplicates.length,1);assert.equal(duplicate.total,s.total);
});
test('service labels and an explicitly paired RMU resolve to one service without changing original readings',()=>{
 const values=['961020200049','No.deservicio:961020200049','7839502-01-15ATP9-61018001CFE','NO.DESERVICIO:961020200049/RMU:7839502-01-15ATP9-61018001CFE'];
 const rows=values.map((service,i)=>bill({service,start:`2026-0${i+1}-01`,end:`2026-0${i+2}-01`},String(i))),before=JSON.stringify(rows);
 const s=summarize(rows,'__all__');assert.deepEqual(s.services,['961020200049']);assert.equal(s.usable.length,4);assert.equal(s.duplicates.length,0);assert.equal(JSON.stringify(rows),before);
 assert.equal(summarize(rows,values[1]).rows.length,4);
 s.rows[0].reviewed=false;assert.equal(rows[0].reviewed,false,'review action still reaches the original receipt');
});
test('RMU is not inferred without an explicit unique pairing',()=>{
 const rmu='7839502-01-15ATP9-61018001CFE';
 assert.equal(summarize([bill({service:rmu}),bill({service:'961020200049'},'b')],'__all__').services.length,2);
 const rows=[bill({service:rmu}),bill({service:'NO.DESERVICIO:961020200049/RMU:'+rmu},'b'),bill({service:'NO.DESERVICIO:961020200050/RMU:'+rmu},'c')];assert.equal(summarize(rows,'__all__').services.length,3);
});

test('a separately extracted RMU pairs legacy labels only when its RPU is explicit and unique',()=>{
 const rows=[{service:'961020200049',rmu:'78395 02-01-15 ATP9-61018 001 CFE'},{service:'7839502-01-15ATP9-61018001CFE'}];
 const resolve=serviceResolver(rows);assert.equal(resolve(rows[1].service),'961020200049');
 const ambiguous=serviceResolver([...rows,{service:'961020200050',rmu:rows[0].rmu}]);assert.notEqual(ambiguous(rows[1].service),'961020200049');
});
