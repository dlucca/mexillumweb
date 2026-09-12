// Shared validation only; the server does not load the browser dispatch solver.
const bounds={solarKw:[0,10000],yieldKwh:[500,2500],selfUsePct:[0,100],batteryKwh:[0,100000],batteryKw:[0,10000],efficiencyPct:[50,100],usablePct:[50,100],energyPrice:[0,30],basePrice:[0,30],intermediatePrice:[0,30],peakPrice:[0,30],baseEnd:[1,10],peakStart:[12,22],peakEnd:[13,24],powerLimitKw:[0,10000],areaUsePct:[0,100],manual:[0,1],tariffSet:[0,1],region:[1,3],loadShape:[0,2],operationStart:[0,23],operationEnd:[1,24],offHoursPct:[1,100],weekendPct:[1,100],tilt:[0,90],azimuth:[-180,180],areaM2:[0,10000000]};
export function sanitizeSimulation(input={}) {
  const clean=Object.fromEntries(Object.entries(bounds).filter(([k,[lo,hi]])=>typeof input?.[k]==='number'&&Number.isFinite(input[k])&&input[k]>=lo&&input[k]<=hi).map(([k])=>[k,input[k]]));
  for(const k of ['baseEnd','peakStart','peakEnd','manual','tariffSet','region','loadShape','operationStart','operationEnd'])if(k in clean&&!Number.isInteger(clean[k]))delete clean[k];
  if(typeof input?.priceSource==='string')clean.priceSource=input.priceSource.slice(0,160);
  return clean;
}
