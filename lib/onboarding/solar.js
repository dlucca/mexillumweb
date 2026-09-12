export function solarKey(location,settings={}){return `${Number(location?.lat).toFixed(3)},${Number(location?.lng).toFixed(3)}:${settings.tilt??20}:${settings.azimuth??0}`;}
export async function solarResource(location,settings={}){
 if(!location||!Number.isFinite(location.lat)||!Number.isFinite(location.lng))throw Error('Confirma la ubicación para obtener el recurso solar.');
 const tilt=settings.tilt??20,azimuth=settings.azimuth??0;
 const u=new URL('https://re.jrc.ec.europa.eu/api/v5_2/PVcalc');
 for(const [k,v] of Object.entries({lat:location.lat.toFixed(3),lon:location.lng.toFixed(3),peakpower:1,loss:14,angle:tilt,aspect:azimuth,raddatabase:'PVGIS-NSRDB',outputformat:'json'}))u.searchParams.set(k,v);
 const response=await fetch(u,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('El servicio de radiación solar no respondió. Puedes reintentar o usar un rendimiento supuesto.');
 const data=await response.json(),monthly=data.outputs?.monthly?.fixed;
 if(!Array.isArray(monthly)||monthly.length!==12||monthly.some(m=>!Number.isFinite(m.E_m)||m.E_m<=0))throw Error('No se recibió una serie solar válida para el sitio.');
 return {key:solarKey(location,settings),source:'PVGIS 5.2 · NSRDB · JRC',url:'https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en',monthly:[...monthly].sort((a,b)=>a.month-b.month).map(m=>m.E_m),tilt,azimuth,lossPct:14,obtainedAt:new Date().toISOString()};
}
