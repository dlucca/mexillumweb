const installations={industria_comercio:'industry',hoteles:'hotel',electromovilidad:'charging',cadena_frio:'cold',microred:'remote',bombeo:'pumping',centros_datos:'data_center',universidades:'university'};
// A focused link opens a single step. It is a convenience, not a permission: it uses the same key.
const focused={operacion:'operation',mapa:'map'};
export function expedienteEntry({search='',hash='',storedToken='',profileId=''}) {
  const params=new URLSearchParams(hash.slice(1));
  const explicitToken=params.get('exp')||'';
  const fresh=new URLSearchParams(search).get('inicio')==='1';
  return {token:explicitToken||(fresh?'':storedToken),installation:installations[profileId]||'',focus:explicitToken?focused[params.get('paso')]||'':''};
}
export function expedienteLinks(origin,token) {
  const base=new URL('/diagnostico-industria-comercio?rapido',origin);base.hash=`exp=${encodeURIComponent(token)}`;
  return {full:base.href,operacion:`${base.href}&paso=operacion`,mapa:`${base.href}&paso=mapa`};
}
