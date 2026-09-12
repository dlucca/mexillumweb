import {usableReading,unresolvedFields} from './expediente.model.js?v=20260912-11';
export const PRICE_FIELDS=['generationBase','generationIntermediate','generationPeak','transmission','cenace','scnmem'];
export function billEconomics(r) {
  const issues=[],missing=PRICE_FIELDS.filter(k=>!usableReading(r,[k]));
  const energyReady=!missing.length&&usableReading(r,['kwh','base','intermediate','peak'])&&r.kwh>0;
  let prices=null;
  if(energyReady){
    const common=(r.transmission+r.cenace+r.scnmem)/r.kwh;prices={};
    for(const [band,field] of [['base','generationBase'],['intermediate','generationIntermediate'],['peak','generationPeak']]){
      if(r[band]>0)prices[band]=r[field]/r[band]+common;
      else if(r[field]===0)prices[band]=null;
      else issues.push(`Hay cargos de ${band} sin consumo en esa franja.`);
    }
  }
  const parts=[...PRICE_FIELDS,'capacity','distribution','supply','powerFactorAdjustment','otherAdjustment'];
  const reconciled=parts.every(k=>usableReading(r,[k]))&&usableReading(r,['subtotal']);
  const reconstructed=reconciled?parts.reduce((n,k)=>n+r[k],0):null;
  if(reconciled&&Math.abs(reconstructed-r.subtotal)>Math.max(2,r.subtotal*.0001))issues.push('El desglose de cargos no concilia con el subtotal.');
  if(usableReading(r,['subtotal','vat','total'])&&Math.abs(r.subtotal+r.vat-r.total)>2)issues.push('Subtotal más IVA no coincide con la facturación del periodo.');
  if(usableReading(r,['total','priorBalance','priorPayment','payable'])&&Math.abs(r.total+r.priorBalance+r.priorPayment-r.payable)>2)issues.push('El total con saldos anteriores no concilia.');
  if(prices&&Object.values(prices).some(v=>v!=null&&(!Number.isFinite(v)||v<0||v>30)))issues.push('Los precios derivados requieren revisión.');
  return {prices:issues.length?null:prices,missing,issues,reconciled:reconciled&&!issues.length,reconstructed,
    status:issues.length?'review':prices?'derived':'missing',source:'Cargos y consumos del mismo recibo',uncertain:unresolvedFields(r)};
}
export function billSaving(r,baselineEnergy,newEnergy) {
  const raw=baselineEnergy-newEnergy;
  // Preserve demand/fixed charges. Apply the observed PF adjustment rate to the
  // energy delta only when the pre-adjustment base can be reconstructed.
  const econ=billEconomics(r),beforePF=r.subtotal-(r.powerFactorAdjustment||0);
  const pf=econ.reconciled&&beforePF>0?(r.powerFactorAdjustment||0)/beforePF:0;
  const saving=raw*(1+pf);
  return {saving,bill:r.subtotal-saving,energySaving:raw,pfDelta:raw*pf,demandSaving:null};
}
