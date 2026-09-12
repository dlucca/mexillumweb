import {solve} from './vendor/yalps-0.6.3.bundle.js';

export const BANDS=['base','intermediate','peak'];
const total=a=>a.reduce((s,n)=>s+n,0);
const clean=n=>Math.abs(n)<1e-7?0:n;
export function dailyProfile(receipt,days,inputs) {
  const bands=Array.from({length:24},(_,h)=>h<inputs.baseEnd?'base':h>=inputs.peakStart&&h<inputs.peakEnd?'peak':'intermediate');
  const counts=Object.fromEntries(BANDS.map(b=>[b,bands.filter(x=>x===b).length]));
  const hasBands=!(!receipt.reviewed&&(receipt.uncertain||[]).some(k=>BANDS.includes(k)&&!(receipt.correctedFields||[]).includes(k)))&&BANDS.every(b=>Number.isFinite(receipt[b])&&receipt[b]>=0)&&Math.abs(total(BANDS.map(b=>receipt[b]))-receipt.kwh)<=Math.max(2,receipt.kwh*.005);
  // Preserve invoice band totals; distribute them uniformly inside each assumed band.
  const load=bands.map(b=>hasBands?receipt[b]/days/counts[b]*receipt.kwh/total(BANDS.map(b=>receipt[b])):receipt.kwh/days/24);
  const weights=Array.from({length:24},(_,h)=>h>=6&&h<18?Math.sin(Math.PI*(h-6+.5)/12):0);
  const solar=weights.map(w=>w/total(weights)*inputs.yieldKwh/365);
  return {bands,load,solar,hasBands};
}

/** Cyclic representative day. Separate inventories account for solar and grid energy.
 * All battery flows are AC kWh for a one-hour step; losses occur on discharge.
 * No exports, only base grid charging, and no increase above the input import ceiling.
 */
export function dispatchDay(profile,{solarKw,batteryKwh,batteryKw,efficiencyPct,usablePct,powerLimitKw,basePrice,intermediatePrice,peakPrice}) {
  const eta=efficiencyPct/100,capacity=batteryKwh*usablePct/100;
  const prices={base:basePrice,intermediate:intermediatePrice,peak:peakPrice};
  const constraints={},variables={};
  const add=(name,c)=>variables[name]=c;
  const initial=profile.load.map((load,h)=>{
    const generation=profile.solar[h]*solarKw,direct=Math.min(load,generation);
    return {h,band:profile.bands[h],price:prices[profile.bands[h]],load,generation,direct,surplus:generation-direct,residual:load-direct};
  });
  if(capacity>0&&batteryKw>0) {
    for(const r of initial){
      const h=r.h,next=(h+1)%24;
      constraints[`solar${h}`]={max:r.surplus};
      constraints[`load${h}`]={max:r.residual};
      constraints[`charge${h}`]={max:batteryKw};
      constraints[`discharge${h}`]={max:batteryKw};
      constraints[`capacity${h}`]={max:capacity};
      constraints[`grid${h}`]={max:r.band==='base'?Math.max(0,powerLimitKw-r.residual):0};
      constraints[`s${h}`]={equal:0};constraints[`g${h}`]={equal:0};
      // Small tie-break prevents pointless cycling at zero/equal prices.
      add(`cs${h}`,{cost:1e-6,[`solar${h}`]:1,[`charge${h}`]:1,[`s${h}`]:-1});
      add(`cg${h}`,{cost:r.price+1e-6,[`grid${h}`]:1,[`charge${h}`]:1,[`g${h}`]:-1});
      add(`ds${h}`,{cost:-r.price+1e-6,[`load${h}`]:1,[`discharge${h}`]:1,[`s${h}`]:1/eta});
      add(`dg${h}`,{cost:-r.price+1e-6,[`load${h}`]:1,[`discharge${h}`]:1,[`g${h}`]:1/eta});
      add(`ss${h}`,{cost:1e-9,[`capacity${h}`]:1,[`s${h}`]:1,[`s${next}`]:-1});
      add(`sg${h}`,{cost:1e-9,[`capacity${h}`]:1,[`g${h}`]:1,[`g${next}`]:-1});
    }
  }
  const solution=Object.keys(variables).length?solve({direction:'minimize',objective:'cost',constraints,variables},{precision:1e-8}):{status:'optimal',variables:[]};
  if(solution.status!=='optimal')throw new Error('No se pudo resolver el balance de energía con estos supuestos.');
  const values=Object.fromEntries(solution.variables),v=k=>clean(values[k]||0);
  const hours=initial.map(r=>{
    const solarCharge=v(`cs${r.h}`),gridCharge=v(`cg${r.h}`),solarDischarge=v(`ds${r.h}`),gridDischarge=v(`dg${r.h}`);
    return {...r,solarCharge,gridCharge,solarDischarge,gridDischarge,socSolar:v(`ss${r.h}`),socGrid:v(`sg${r.h}`),
      grid:clean(r.residual-solarDischarge-gridDischarge+gridCharge),unused:clean(r.surplus-solarCharge),
      losses:(solarDischarge+gridDischarge)*(1/eta-1)};
  });
  const sum=k=>clean(total(hours.map(r=>r[k])));
  return {hours,generation:sum('generation'),direct:sum('direct'),solarCharge:sum('solarCharge'),gridCharge:sum('gridCharge'),
    solarDischarge:sum('solarDischarge'),gridDischarge:sum('gridDischarge'),losses:sum('losses'),unused:sum('unused'),grid:sum('grid'),
    cost:total(hours.map(r=>r.grid*r.price)),baselineCost:total(hours.map(r=>r.load*r.price)),
    gridByBand:Object.fromEntries(BANDS.map(b=>[b,total(hours.filter(r=>r.band===b).map(r=>r.grid))])),
    baselineByBand:Object.fromEntries(BANDS.map(b=>[b,total(hours.filter(r=>r.band===b).map(r=>r.load))])),
    requiredKw:Math.max(0,...hours.map(r=>Math.max(r.solarCharge+r.gridCharge,r.solarDischarge+r.gridDischarge)))};
}
