import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dailyProfile,dispatchDay} from '../js/expediente.dispatch.js';
const near=(a,b,tol=1e-5)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const inputs={solarKw:20,batteryKwh:60,batteryKw:15,efficiencyPct:90,usablePct:90,powerLimitKw:30,basePrice:1,intermediatePrice:2,peakPrice:4,baseEnd:6,peakStart:18,peakEnd:22,yieldKwh:1500};
const profile=dailyProfile({kwh:240,base:60,intermediate:140,peak:40},1,inputs);
test('hourly profile conserves invoice consumption and annual solar yield',()=>{
 for(const b of ['base','intermediate','peak'])near(profile.load.reduce((s,x,h)=>s+(profile.bands[h]===b?x:0),0),{base:60,intermediate:140,peak:40}[b]);
 near(profile.solar.reduce((s,x)=>s+x,0)*365,1500);
});
test('dispatch conserves energy, source inventories, cyclic SOC and physical limits across regimes',()=>{
 for(const solarKw of [0,20,100])for(const batteryKwh of [0,15,100,1000])for(const efficiencyPct of [50,90,100])for(const basePrice of [0,1,4]){
  const p={...inputs,solarKw,batteryKwh,efficiencyPct,basePrice};const r=dispatchDay(profile,p),eta=efficiencyPct/100;
  near(r.generation+r.grid,240+r.unused+r.losses);
  near(r.solarCharge*eta,r.solarDischarge);near(r.gridCharge*eta,r.gridDischarge);
  assert.ok(r.cost<=r.baselineCost+1e-5);
  for(const h of r.hours){
   const prev=r.hours[(h.h+23)%24];
   near(h.socSolar,prev.socSolar+h.solarCharge-h.solarDischarge/eta);
   near(h.socGrid,prev.socGrid+h.gridCharge-h.gridDischarge/eta);
   assert.ok(h.socSolar+h.socGrid<=batteryKwh*.9+1e-5);
   assert.ok(h.solarCharge+h.gridCharge<=p.batteryKw+1e-5);
   assert.ok(h.solarDischarge+h.gridDischarge<=p.batteryKw+1e-5);
   assert.ok(h.grid>=-1e-5&&h.unused>=-1e-5);
   assert.ok(Math.min(h.solarCharge+h.gridCharge,h.solarDischarge+h.gridDischarge)<1e-5,'no simultaneous charge/discharge');
   if(h.band!=='base')near(h.gridCharge,0);
   if(h.gridCharge>0)assert.ok(h.grid<=p.powerLimitKw+1e-5);
  }
 }
});
test('no space still supports base-to-peak arbitrage, reserving limited storage for punta',()=>{
 const r=dispatchDay(profile,{...inputs,solarKw:0,batteryKwh:20});
 assert.ok(r.gridCharge>0);assert.ok(r.gridDischarge>0);assert.ok(r.cost<r.baselineCost);
 near(r.gridByBand.intermediate,140);assert.ok(r.gridByBand.peak<40);
});
test('loss-adjusted spread must be positive and grid charging needs headroom',()=>{
 for(const p of [{basePrice:1,intermediatePrice:1,peakPrice:1},{basePrice:1,intermediatePrice:1.05,peakPrice:1.1},{powerLimitKw:10},{batteryKw:0},{batteryKwh:0}]){
  const r=dispatchDay(profile,{...inputs,solarKw:0,...p});near(r.gridCharge,0);near(r.cost,r.baselineCost);
 }
});
test('abundant solar supplies demand with cyclic storage and without grid charging',()=>{
 const r=dispatchDay(profile,{...inputs,solarKw:150,batteryKwh:400,batteryKw:80});
 near(r.gridCharge,0);near(r.grid,0);assert.ok(r.unused>0);assert.ok(r.solarDischarge>0);
});
