// Run against the explicitly simulated local server; never a production URL.
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
await mkdir('.codex_tmp/onboarding-ui',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://maps.googleapis.com/**',r=>r.abort());
 await page.goto('http://127.0.0.1:4173/asesor/');
 await page.locator('[name=key]').fill('demo-advisor-key-for-local-tests-only');await page.locator('[name=name]').fill('Contacto de prueba');await page.locator('[name=email]').fill('example@example.com');await page.locator('[name=company]').fill('Instituto de demostración');await page.locator('[name=site]').fill('Campus de demostración');await page.locator('[name=sector]').selectOption('Institución educativa');await page.getByRole('button',{name:'Crear enlace'}).click();await page.locator('#link').waitFor();const link=await page.locator('#link').getAttribute('href');
 if(!link)throw Error(await page.locator('#status').innerText());
 await page.goto(link);await page.getByRole('heading',{name:'Empecemos por tus recibos'}).waitFor();await page.screenshot({path:'.codex_tmp/onboarding-ui/01-receipts.png',fullPage:true});
 await page.locator('[data-consent]').check();await page.locator('[data-file]').setInputFiles({name:'recibos-demo.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF demo test only')});
 await page.getByText('Recibido · listo para leer',{exact:true}).waitFor();await page.locator('[data-action=read]').click();await page.getByRole('heading',{name:'Esto encontramos en tus recibos'}).waitFor();
 await page.locator('[data-confirm-clean]').click();await page.getByText('$64,726',{exact:true}).waitFor();await page.screenshot({path:'.codex_tmp/onboarding-ui/02-review.png',fullPage:true});
 await page.locator('[data-nav=operation]').click();await page.getByRole('heading',{name:'Completemos cómo funciona tu instalación'}).waitFor();
 if(await page.locator('[name=manualTariff]').count())throw Error('Asked tariff already extracted');
 if(await page.locator('[name=sector]').inputValue()!=='Institución educativa')throw Error('Lost advisor sector');
 await page.locator('[name=objective][value=cost]').check();await page.locator('[name=schedule]').fill('Lunes a viernes, 7 a 20 h; baja actividad en vacaciones.');await page.locator('[name=equipment][value=none]').check();await page.locator('[name=scope]').selectOption('Sí, toda la instalación');
 const sectors=[['Industria y manufactura','processLoads'],['Comercio y oficinas','majorLoads'],['Hotel','hotelLoads'],['Cadena de frío','compresores'],['Bombeo','hidraulica'],['Carga de vehículos','gestion_carga'],['Centro de datos','backupArchitecture'],['Sitio remoto','fuente'],['Otro','description'],['Institución educativa','vacations']];
 for(const [sector,key] of sectors){await page.locator('[name=sector]').selectOption(sector);await page.locator(`[data-install-field="${key}"]`).waitFor();}
 await page.locator('[data-install-field=vacations]').selectOption('continua');await page.locator('[data-install-field=afterhours]').fill('Servidores y refrigeración de muestras');
 await page.locator('[data-install-field=criticalLoads][value=frio]').check();await page.locator('[data-install-field=criticalDetail]').fill('Conservar muestras durante 2 horas');
 await page.locator('[name=sector]').selectOption('Bombeo');await page.locator('[data-install-field=hidraulica]').selectOption('tanque_sin_horario');
 await page.locator('[name=sector]').selectOption('Institución educativa');
 if(await page.locator('[data-install-field=criticalDetail]').inputValue()!=='Conservar muestras durante 2 horas')throw Error('Sector switch lost university details');
 if(await page.locator('[name=schedule]').inputValue()!=='Lunes a viernes, 7 a 20 h; baja actividad en vacaciones.')throw Error('Sector switch lost schedule');
 await page.screenshot({path:'.codex_tmp/onboarding-ui/03-operation.png',fullPage:true});
 await page.locator('[data-nav=map]').click();await page.getByRole('heading',{name:'Ubica tu instalación y los espacios disponibles'}).waitFor();await page.locator('[data-nav=summary]').click();await page.getByRole('heading',{name:'Tu expediente, en un solo lugar'}).waitFor();
 await page.locator('.exp-operation-summary summary').click();await page.getByText('Conservar muestras durante 2 horas',{exact:true}).waitFor();
 if(await page.locator('[data-contact=name]').inputValue()!=='Contacto de prueba')throw Error('Lost contact');
 await page.screenshot({path:'.codex_tmp/onboarding-ui/04-summary.png',fullPage:true});
 await page.reload();await page.getByRole('heading',{name:'Tu expediente, en un solo lugar'}).waitFor();
 await page.locator('[data-action=submit]').click();await page.getByText('Solicitud enviada.',{exact:false}).waitFor();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.route('https://maps.googleapis.com/**',r=>r.abort());await mobile.goto(link);await mobile.getByRole('heading',{name:'Tu expediente, en un solo lugar'}).waitFor();await mobile.screenshot({path:'.codex_tmp/onboarding-ui/05-mobile.png',fullPage:true});
 await mobile.locator('[data-nav=receipts]').click();await mobile.getByRole('heading',{name:'Empecemos por tus recibos'}).waitFor();await mobile.screenshot({path:'.codex_tmp/onboarding-ui/06-mobile-receipts.png',fullPage:true});
 await mobile.locator('[data-nav=operation]').click();await mobile.locator('[data-install-field=vacations]').waitFor();
 if(await mobile.locator('[data-install-field=vacations]').inputValue()!=='continua')throw Error('Mobile reopen lost university answers');
 await mobile.locator('[data-install-field=criticalLoads][value=ninguna]').check();if(await mobile.locator('[data-install-field=criticalDetail]').count())throw Error('Exclusive critical-load option did not hide followup');
 await mobile.locator('[data-install-field=criticalLoads][value=frio]').check();if(await mobile.locator('[data-install-field=criticalDetail]').inputValue()!=='Conservar muestras durante 2 horas')throw Error('Conditional field erased on hide');
 await mobile.locator('[data-installation]').screenshot({path:'.codex_tmp/onboarding-ui/07-mobile-university.png'});
 const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('Mobile horizontal overflow');
 // Exercise missing-document questions without relying on extraction.
 const manual=await browser.newPage();await manual.goto('http://127.0.0.1:4173/diagnostico-industria-comercio?rapido');
 await manual.getByRole('heading',{name:'Empecemos por tus recibos'}).waitFor();await manual.locator('[data-nav=operation]').click();
 await manual.locator('[name=manualTariff]').waitFor();await manual.locator('[name=manualBill]').fill('90000');
 await manual.locator('[name=objective][value=continuity]').check();await manual.locator('[name=outage]').waitFor();
 await manual.locator('[name=equipment][value=solar]').check();await manual.locator('[name=solar]').waitFor();
 // A small Maps SDK double verifies persisted geometry independently of Google availability.
 const mapPage=await browser.newPage();await mapPage.goto('http://127.0.0.1:4173/asesor/');
 const mapResult=await mapPage.evaluate(async()=>{
   const latLng=p=>typeof p.lat==='function'?p:{lat:()=>p.lat,lng:()=>p.lng};
   class Events { constructor(){this.listeners={};} addListener(k,fn){(this.listeners[k]||=[]).push(fn);return {remove:()=>{this.listeners[k]=this.listeners[k].filter(x=>x!==fn);}};} emit(k,v){for(const fn of this.listeners[k]||[])fn(v);} }
   class Path extends Events {constructor(v=[]){super();this.v=v.map(latLng);}getArray(){return this.v;}getLength(){return this.v.length;}push(p){this.v.push(latLng(p));this.emit('insert_at');}}
   class MapDouble extends Events {constructor(){super();window.testMap=this;}setCenter(){}setZoom(){}setOptions(){}}
   class Polygon {constructor(o){this.path=new Path(o.paths);}getPath(){return this.path;}setMap(){}}
   class Marker extends Events {constructor(o){super();this.position=latLng(o.position);}getPosition(){return this.position;}setMap(){}}
   window.google={maps:{Map:MapDouble,Polygon,Marker,SymbolPath:{CIRCLE:0},places:{Autocomplete:Events},geometry:{spherical:{computeArea:path=>path.getLength()*100}},event:{clearInstanceListeners:()=>{}}}};
   const {mountRoofPicker}=await import('/js/diagnostico.roof.js');
   const container=document.createElement('div');document.body.append(container);
   const triangle=[{lat:19.4,lng:-99.2},{lat:19.401,lng:-99.2},{lat:19.4,lng:-99.201}];let roof,point,emissions=0;
   const cleanup=mountRoofPicker(container,{initial:{location:{lat:19.4,lng:-99.2},roof:{poligonos:[triangle,triangle]},servicePoint:{lat:19.4,lng:-99.2,tipo:'transformador',capacidad_kva:500}},onLocation:()=>{},onRoof:v=>{roof=v;emissions++;},onServicePoint:v=>point=v});
   await new Promise(resolve=>setTimeout(resolve,20));
   if(roof.poligonos.length!==2||point.capacidad_kva!==500)throw Error('Map restore lost saved geometry or electrical point');
   container.querySelector('.dx-roof__add').click();for(const p of triangle)window.testMap.emit('click',{latLng:latLng(p)});
   if(roof.poligonos.length!==3)throw Error('Cannot extend restored map');
   const count=emissions;cleanup();if(emissions!==count)throw Error('Map cleanup mutated saved roof');return true;
 });
 console.log(JSON.stringify({errors,desktop:true,mobile:true,restoration:true,submission:true,withoutReceipts:true,mapRestoration:mapResult,installationModules:10,universityPersistence:true}));await browser.close();if(errors.length)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
