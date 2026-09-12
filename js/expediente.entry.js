const installations={industria_comercio:'industry',hoteles:'hotel',electromovilidad:'charging',cadena_frio:'cold',microred:'remote',bombeo:'pumping',centros_datos:'data_center',universidades:'university'};
export function expedienteEntry({search='',hash='',storedToken='',profileId=''}) {
  const explicitToken=new URLSearchParams(hash.slice(1)).get('exp')||'';
  const fresh=new URLSearchParams(search).get('inicio')==='1';
  return {token:explicitToken||(fresh?'':storedToken),installation:installations[profileId]||''};
}
