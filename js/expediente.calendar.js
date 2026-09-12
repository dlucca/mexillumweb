export const CALENDAR_SOURCES={2025:'https://sidof.segob.gob.mx/notas/docFuente/5747760',2026:'https://sidof.segob.gob.mx/notas/docFuente/5783862'};
const day=86400000;
const nthMonday=(y,m,n)=>{const d=new Date(Date.UTC(y,m,1));return 1+(8-d.getUTCDay())%7+(n-1)*7;};
const sunday=(y,m,last=false)=>{const d=new Date(Date.UTC(y,m,last?31:1));return last?31-d.getUTCDay():1+(7-d.getUTCDay())%7;};
export function holiday(d){const y=d.getUTCFullYear(),m=d.getUTCMonth(),n=d.getUTCDate();return (m===0&&n===1)||(m===1&&n===nthMonday(y,1,1))||(m===2&&n===nthMonday(y,2,3))||(m===4&&n===1)||(m===8&&n===16)||(m===10&&n===nthMonday(y,10,3))||(m===11&&n===25)||(y>=2024&&(y-2024)%6===0&&m===9&&n===1);}
export function regionFor(r,override){
 if([1,2,3].includes(override))return ['','SIN','BC','BCS'][override];
 const text=`${r.state||''} ${r.address||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 if(/BAJA CALIFORNIA SUR|\bBCS\b/.test(text))return 'BCS';
 if(/BAJA CALIFORNIA|\bTIJUANA\b|\bMEXICALI\b/.test(text))return 'BC';
 if(/SAN LUIS|\bSLP\b|OAXACA|CDMX|CIUDAD DE MEXICO|AGUASCALIENTES|CAMPECHE|COAHUILA|COLIMA|CHIAPAS|CHIHUAHUA|DURANGO|GUANAJUATO|GUERRERO|HIDALGO|JALISCO|MEXICO|MICHOACAN|MORELOS|NAYARIT|NUEVO LEON|PUEBLA|QUERETARO|QUINTANA ROO|SINALOA|SONORA|TABASCO|TAMAULIPAS|TLAXCALA|VERACRUZ|YUCATAN|ZACATECAS/.test(text))return 'SIN';
 return null;
}
export function tariffBand(d,h,region='SIN'){
 const y=d.getUTCFullYear();if(!CALENDAR_SOURCES[y])return null;
 const summer=d>=new Date(Date.UTC(y,region==='BC'?4:3,region==='BC'?1:sunday(y,3)))&&d<new Date(Date.UTC(y,9,sunday(y,9,true)));
 const dow=holiday(d)?0:d.getUTCDay();
 if(region==='SIN'){
  if(summer){if(dow===0)return h<19?'base':'intermediate';if(dow===6)return h<7?'base':'intermediate';return h<6?'base':h>=20&&h<22?'peak':'intermediate';}
  if(dow===0)return h<18?'base':'intermediate';if(dow===6)return h<8?'base':h>=19&&h<21?'peak':'intermediate';return h<6?'base':h>=18&&h<22?'peak':'intermediate';
 }
 if(region==='BC'){
  if(summer)return dow>0&&dow<6&&h>=14&&h<18?'peak':'intermediate';
  if(dow===0)return 'base';return dow===6?(h>=18&&h<21?'intermediate':'base'):(h>=17&&h<22?'intermediate':'base');
 }
 if(region==='BCS'){
  if(summer)return dow===0?'intermediate':dow===6?(h>=19&&h<22?'peak':'intermediate'):(h>=12&&h<22?'peak':'intermediate');
  if(dow===0)return h>=19&&h<21?'intermediate':'base';if(dow===6)return h>=18&&h<21?'intermediate':'base';return h>=18&&h<22?'intermediate':'base';
 }
 return null;
}
// Receipt meter readings define (start, end]; represent each local civil day with 24 hours.
// This model does not claim sub-hourly metering or resolve DST transition intervals.
export function invoiceDays(r){const out=[];for(let t=Date.parse(r.start)+day;t<=Date.parse(r.end);t+=day){out.push(new Date(t));if(out.length>370)return [];}return out;}
