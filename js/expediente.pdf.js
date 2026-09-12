import {PDFDocument,StandardFonts,rgb} from './vendor/pdf-lib-1.17.1.bundle.js';
import {billImpact,customerSummary,fmtNumber as n,fmtMoney as money,COVERAGE_EXPLANATION,SAVINGS_EXPLANATION,BATTERY_EXPLANATION} from './expediente.summary.js?v=20260912-11';
// The downloadable report uses structured data, never page HTML, access links or file tokens.
export async function createSummaryPdf(data,result,{createdAt=new Date()}={}){
 const pdf=await PDFDocument.create();pdf.setTitle(`Resumen Mexillum - ${data.site||'Proyecto energético'}`);pdf.setAuthor('Mexillum');pdf.setCreationDate(createdAt);
 const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const green=rgb(.08,.43,.19),ink=rgb(.12,.17,.14),muted=rgb(.34,.39,.36),line=rgb(.79,.82,.79),pale=rgb(.9,.97,.91);
 const W=595.28,H=841.89,M=44,CW=W-2*M;let page,y;
 const safe=value=>Array.from(String(value??'').replace(/\s+/g,' ').replace(/[→]/g,' a ').replace(/[−–—]/g,'-').replace(/\u202f|\u00a0/g,' ')).map(c=>{try{regular.encodeText(c);return c;}catch{return '?';}}).join('');
 function wrap(value,width,size=10,font=regular){const out=[];let current='';for(const word of safe(value).split(' ')){
  if(font.widthOfTextAtSize(word,size)>width){if(current){out.push(current);current='';}let part='';for(const c of word){if(font.widthOfTextAtSize(part+c,size)>width){out.push(part);part='';}part+=c;}current=part;}
  else if(current&&font.widthOfTextAtSize(current+' '+word,size)>width){out.push(current);current=word;}else current=current?current+' '+word:word;
 }if(current)out.push(current);return out.length?out:[''];}
 function draw(text,x,top,size=10,font=regular,color=ink){page.drawText(safe(text),{x,y:top-size,size,font,color});}
 function newPage(){page=pdf.addPage([W,H]);y=H-94;draw('mexillum',M,H-35,22,bold,ink);draw('RESUMEN DE CONSUMO Y AHORRO',M,H-65,9,bold,green);page.drawLine({start:{x:M,y:H-78},end:{x:W-M,y:H-78},color:line,thickness:.7});}
 function ensure(height){if(y-height<58)newPage();}
 function paragraph(text,{size=10,color=ink,font=regular,gap=9}={}){const lines=wrap(text,CW,size,font);for(const l of lines){ensure(size+4);draw(l,M,y,size,font,color);y-=size+4;}y-=gap;}
 function heading(text){ensure(65);y-=7;paragraph(text,{size:14,font:bold,color:green,gap:10});}
 function table(headers,rows,widths,{numeric=true}={}){const sizes=widths.map(v=>v*CW),pad=8,size=9;
  function row(cells,header=false,highlight=false){const texts=cells.map((t,i)=>wrap(t,sizes[i]-pad*2,size,header||i===0||highlight?bold:regular));const height=Math.max(...texts.map(a=>a.length))*13+16;
   if(y-height<58){newPage();if(!header)row(headers,true);}
   if(header||highlight)page.drawRectangle({x:M,y:y-height,width:CW,height,color:highlight?pale:rgb(.93,.94,.92)});
   let x=M;for(let i=0;i<texts.length;i++){const font=header||i===0||highlight?bold:regular;texts[i].forEach((t,j)=>{const tx=numeric&&i>0&&!header?x+sizes[i]-pad-font.widthOfTextAtSize(t,size):x+pad;draw(t,tx,y-pad-j*13,size,font,highlight&&i===cells.length-1?green:ink);});x+=sizes[i];}
   page.drawLine({start:{x:M,y:y-height},end:{x:W-M,y:y-height},color:line,thickness:.5});y-=height;
  }
  ensure(82);row(headers,true);for(const r of rows)row(r.cells||r,false,r.highlight);y-=14;
 }
 const clients=customerSummary(data);
 function identity(service){const c=clients.find(c=>c.service===service);if(!c){paragraph('Titular y domicilio del servicio: pendientes de lectura.',{color:muted});return;}
  paragraph(`Titular CFE: ${c.holder.value||'Pendiente de lectura'}${c.holder.uncertain?' (lectura por revisar)':''}`,{font:bold,gap:3});
  paragraph(`Domicilio del servicio: ${c.address.value||'Pendiente de lectura'}${c.address.uncertain?' (lectura por revisar)':''}`,{gap:3});
  paragraph(`Servicio: ${c.service}  |  Tarifa: ${c.tariff.value||'Pendiente'}`,{gap:4});
  paragraph(`Fuente del titular: recibo con fin ${c.holder.end||'pendiente'}. Fuente del domicilio: recibo con fin ${c.address.end||'pendiente'}.`,{size:8,color:muted,gap:9});
  if(c.conflicting.length)paragraph('Hay otros titulares o domicilios en recibos anteriores; verificar cuál corresponde.',{color:muted});
 }
 function impact(r){const x=billImpact(r);if(!x){paragraph('Ahorro y reducción de factura: pendientes de datos suficientes.');return;}
  heading(x.partial?'Ahorro del alcance calculado':'Resultado económico del sistema combinado');
  paragraph(`${x.saving<0?'Sobrecosto':'Ahorro total estimado'}: ${money(Math.abs(x.saving))} MXN/año`,{size:19,font:bold,color:green,gap:8});
  paragraph(`${x.saving<0?'Aumento':'Reducción'} estimada de la factura: ${x.reductionPct==null?'No aplica':n(Math.abs(x.reductionPct),1)+'%'}  |  Importes sin IVA.`,{font:bold});
  paragraph(`Factura anual actual: ${money(x.current)}. Con el sistema: ${money(x.withSystem)}.`,{gap:7});
  if(x.partial)paragraph('RESULTADO PARCIAL: solo considera periodos y servicios calculados; no es el ahorro de todo el expediente.',{font:bold,color:muted});
 }
 function comparison(r){table(['Escenario','Red (kWh/año)','Factura (MXN/año)','Ahorro total (MXN/año)'],r.scenarios.map(c=>({highlight:c.id==='hybrid',cells:[c.label,n(c.importKwh),money(c.bill),c.id==='baseline'?'-':money(c.saving)]})),[.26,.22,.26,.26]);paragraph(SAVINGS_EXPLANATION,{size:9,color:muted});}
 function service(r,id){heading(`Servicio ${id||r.source?.service||'por identificar'}`);identity(id||r.source?.service);
  if(!r.scenarios){heading('Evaluación pendiente');paragraph(r.reason||r.source?.reason||'Faltan datos para calcular.');}
  else{
   impact(r);const s=r.source;paragraph(`Base calculada: ${r.modeledReceipts} recibos, ${n(r.modeledDays)} días. Periodo documental: ${s.start} a ${s.end}. ${s.annualObserved&&r.status!=='partial'?'Serie anual continua.':'Valores extrapolados a 365 días; no representan un año completo observado.'}`,{size:9,color:muted});
   comparison(r);
   heading('Energía cubierta y aportación de la batería');
   paragraph(`Energía cubierta con solar, directa o almacenada: ${r.annualKwh?n(r.usefulSolar/r.annualKwh*100,1)+'%':'Pendiente'}.`,{font:bold});
   paragraph(COVERAGE_EXPLANATION,{size:9,color:muted});const base=r.scenarios.find(c=>c.id==='baseline'),combined=r.scenarios.find(c=>c.id==='hybrid');paragraph(`Generación solar anual: ${n(r.generation)} kWh. Energía de red evitada en horario punta: ${base.gridByBand?.peak?n(Math.max(0,1-combined.gridByBand.peak/base.gridByBand.peak)*100,1)+'%':'No aplica; no hay consumo en punta en la base calculada'}.`,{size:9});paragraph(`Aporte de la batería incluido en el ahorro total: ${money(r.extraBatterySaving)} MXN/año.`,{font:bold});paragraph(BATTERY_EXPLANATION,{size:9,color:muted});
   heading('Equipos y superficie del sistema combinado');
   table(['Concepto','Valor'],[['Potencia solar',`${n(r.solarKw,1)} kWp`],['Batería nominal / potencia',`${n(r.batteryKwh,1)} kWh / ${n(r.batteryKw,1)} kW`],['Superficie estimada del sistema',`${n(r.solarAreaM2,1)} m²`],['Superficie asignada o marcada',r.area==null?'Pendiente':`${n(r.area,1)} m²`],['Superficie aprovechable',r.usableAreaM2==null?'Pendiente':`${n(r.usableAreaM2,1)} m² (${n(r.inputs.areaUsePct)}%)`]], [.65,.35]);
   if(r.areaPending)paragraph('Falta marcar o asignar superficie; la cobertura solar sigue pendiente.');
   paragraph(`Recurso solar: ${r.resource?`${r.resource.source}; inclinación ${n(r.resource.tilt)}°, orientación ${n(r.resource.azimuth)}°, pérdidas ${n(r.resource.lossPct)}%.`:`rendimiento supuesto de ${n(r.inputs.yieldKwh)} kWh/kWp/año.`} Se consideran 5.5 m² por kWp.`,{size:9,color:muted});
   paragraph(`Batería: ${n(r.inputs.usablePct)}% de capacidad utilizable y ${n(r.inputs.efficiencyPct)}% de eficiencia.`,{size:9,color:muted});
   paragraph(`Precios: ${r.pricesProvided?'manuales, iguales en todos los periodos':'derivados de los cargos y consumos de cada factura'}. ${r.baselineReconciled?'Las facturas utilizadas concilian.':'La conciliación completa tiene datos pendientes.'}`,{size:9,color:muted});
   heading('Alcance de la estimación');
   paragraph('Se conservan capacidad, distribución y cargos fijos. El ajuste por factor de potencia solo cambia proporcionalmente cuando la factura concilia. El ahorro por reducir picos de demanda y el respaldo ante cortes siguen pendientes de medición y revisión técnica.',{size:9});
   paragraph(`${r.scheduleAssumed?'Perfil uniforme supuesto dentro de cada franja.':'Perfil ajustado con la operación declarada.'} Se conservan los consumos por franja del recibo. Calendario GDMTH 2025-2026; generación horaria estimada y batería con previsión ideal de 48 horas.`,{size:9});
   paragraph('Se priorizan cobertura solar útil y ahorro operativo. Inversión y retorno se evaluarán después. No incluye mantenimiento, degradación ni compensación de excedentes. No es una cotización ni una garantía de ahorro.',{size:9});
  }
  const decisions=r.source?.decisions||[];
  if(decisions.length){heading('Recibos y alcance documental');table(['Periodo del recibo','Uso en la estimación'],decisions.map(d=>[`${d.start||'?'} a ${d.end||'?'}`,d.simulated?'Incluido':d.simulationReason||d.reason||'Pendiente']),[.38,.62],{numeric:false});}
 }
 newPage();paragraph(data.site||'Proyecto energético',{size:19,font:bold});paragraph(`Emitido: ${createdAt.toISOString().slice(0,10)} | Estimación preliminar | MXN sin IVA`,{size:9,color:muted});
 const contact=[data.contact?.name,data.contact?.company,data.contact?.email].filter(Boolean);if(contact.length)paragraph('Contacto del proyecto: '+contact.join(' | '),{size:9,color:muted});
 if(result.project){heading('Resumen del proyecto');paragraph(`${result.evaluated} de ${result.results.length} servicios calculados. Cada servicio tiene su propio sistema; no se comparte energía ni se duplica superficie.`);impact(result);if(result.evaluated)comparison(result);for(const row of result.results){newPage();service(row.result,row.service);}}
 else service(result,result.source?.service);
 const pages=pdf.getPages();pages.forEach((p,i)=>{page=p;page.drawLine({start:{x:M,y:43},end:{x:W-M,y:43},color:line,thickness:.5});draw('Mexillum | Estimación preliminar | MXN sin IVA',M,32,8,regular,muted);draw(`${i+1} / ${pages.length}`,W-M-30,32,8,regular,muted);});
 return pdf.save();
}
export async function downloadSummaryPdf(data,result){const bytes=await createSummaryPdf(data,result);const blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;const name=String(data.site||'proyecto').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]+/gi,'-').slice(0,70);a.download=`Resumen-Mexillum-${name}.pdf`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
