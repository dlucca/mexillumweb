import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {periodProfile} from '../js/expediente.profile.js';
import {holiday,tariffBand,invoiceDays} from '../js/expediente.calendar.js';
import {mergeReadings} from '../lib/onboarding/refresh.js';
import {receiptStatus,requiredQuestions} from '../js/expediente.model.js';
import {dispatchDay} from '../js/expediente.dispatch.js';
const bill=JSON.parse(readFileSync(new URL('./fixtures/cfe-san-luis-2026-01.json',import.meta.url)));
const date=s=>new Date(s+'T00:00:00Z');
test('calendar honors local holidays, weekends, seasons and unsupported years',()=>{
 assert.equal(holiday(date('2026-01-01')),true);assert.equal(holiday(date('2026-02-02')),true);assert.equal(holiday(date('2026-03-16')),true);
 assert.equal(tariffBand(date('2026-01-01'),12),'base');assert.equal(tariffBand(date('2026-01-02'),19),'peak');
 assert.equal(tariffBand(date('2026-01-03'),19),'peak');assert.equal(tariffBand(date('2026-07-04'),19),'intermediate');
 assert.equal(tariffBand(date('2026-07-06'),19),'intermediate');assert.equal(tariffBand(date('2026-07-06'),20),'peak');
 assert.equal(tariffBand(date('2026-07-06'),15,'BC'),'peak');assert.equal(tariffBand(date('2026-07-06'),13,'BCS'),'peak');
 assert.equal(tariffBand(date('2027-01-01'),19),null);assert.equal(invoiceDays(bill).length,31);
});
test('profile preserves each billed band, respects measured maxima and responds to operation',()=>{
 const uniform=periodProfile(bill),day=periodProfile(bill,{loadShape:1,operationStart:8,operationEnd:18,offHoursPct:30,weekendPct:50});assert.equal(day.ready,true);assert.equal(uniform.ready,true);
 for(const b of ['base','intermediate','peak']){const hs=day.hours.filter(h=>h.band===b);assert.ok(Math.abs(hs.reduce((n,h)=>n+h.load,0)-bill[b])<1e-5);assert.ok(hs.every(h=>h.load<=h.cap+1e-6));}
 assert.notDeepEqual(day.hours.map(h=>h.load),uniform.hours.map(h=>h.load));
 assert.equal(periodProfile({...bill,demand:1}).ready,false);assert.equal(periodProfile({...bill,base:0}).ready,false);
 assert.equal(periodProfile({...bill,uncertain:['tariff']}).ready,false);assert.equal(periodProfile(bill,{loadShape:1,operationStart:18,operationEnd:8}).ready,false);
});
test('refresh preserves corrections, adds previously absent fields, retains unmatched originals and unique IDs',()=>{
 const old={...bill,id:'f:0',fileId:'f',page:1,reviewed:false,original:{...bill},correctedFields:['kwh'],kwh:180000,extractionVersion:'old'};
 const incoming={...bill,id:'f:0',fileId:'f',page:1,original:{...bill}};
 const merged=mergeReadings([old],[incoming],'new');assert.equal(merged[0].kwh,180000);assert.deepEqual(merged[0].original,old.original);assert.equal(merged[0].latestOriginal.kwh,bill.kwh);assert.equal(merged[0].readingVersions.length,1);
 const prior={...old,reviewed:true,generationPeak:null,correctedFields:[]};const refreshed=mergeReadings([prior],[incoming],'new')[0];assert.equal(refreshed.generationPeak,bill.generationPeak);assert.equal(refreshed.reviewed,false);
 const unmatched=mergeReadings([old],[{...incoming,page:3,start:'2026-03-01',end:'2026-04-01'}],'new');assert.equal(unmatched.length,2);assert.notEqual(unmatched[0].id,unmatched[1].id);assert.equal(unmatched[1].refreshUnmatched,true);
});
test('clean processing does not require human confirmation and tariff/payment questions suppress independently',()=>{
 assert.equal(receiptStatus(bill).label,'Procesado sin alertas');assert.equal(receiptStatus({...bill,uncertain:['kwh']}).needsReview,true);
 assert.equal(requiredQuestions({receipts:[bill]}).includes('manualTariff'),false);assert.equal(requiredQuestions({receipts:[bill]}).includes('manualBill'),false);
 assert.equal(requiredQuestions({receipts:[{...bill,total:null}]}).includes('manualBill'),true);assert.equal(requiredQuestions({receipts:[{...bill,total:null}]}).includes('manualTariff'),false);
});
test('chronological storage conserves given inventory, crosses midnight and empties at end',()=>{
 const load=Array(48).fill(10),bands=Array.from({length:48},(_,h)=>h%24<6?'base':h%24>=18?'peak':'intermediate');
 const p={load,solar:Array(48).fill(0),bands,prices:bands.map(b=>b==='base'?1:4),limits:Array(48).fill(30)};
 const r=dispatchDay(p,{solarKw:0,batteryKwh:150,batteryKw:25,efficiencyPct:90,usablePct:90,initialSOC:{solar:20,grid:0},terminalZero:true});
 assert.ok(Math.abs(r.grid+20-r.hours.reduce((n,h)=>n+h.load,0)-r.losses)<1e-4);
 assert.equal(r.hours.at(-1).socSolar+r.hours.at(-1).socGrid,0);
 for(const h of r.hours){assert.ok(h.grid<=30+1e-6);assert.ok(h.socSolar+h.socGrid<=135+1e-6);if(h.band!=='base')assert.equal(h.gridCharge,0);}
});

test('band-only invoice arithmetic is deterministic, preserves provenance and does not override conflicting printed totals',async()=>{
 const {normalizeExtractedReceipt}=await import('../lib/onboarding/extraction.js');
 const r=normalizeExtractedReceipt({...bill,kwh:185802,kwhSource:'sum_of_bands'},'f',0);
 assert.equal(r.kwh,175802);assert.deepEqual(r.derivedFields,['kwh']);assert.equal(r.derivations.kwh.providerValue,185802);assert.equal(r.original.kwh,175802);
 const printed=normalizeExtractedReceipt({...bill,kwh:185802,kwhSource:'printed'},'f',0);assert.equal(printed.kwh,185802);assert.equal(receiptStatus(printed).needsReview,true);
 const uncertain=normalizeExtractedReceipt({...bill,kwh:null,kwhSource:'sum_of_bands',uncertain:['base']},'f',0);assert.equal(uncertain.kwh,null);
});
