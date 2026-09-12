import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {initExpediente} from '../js/expediente.app.js';
import {simulate} from '../js/expediente.simulation.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/cfe-san-luis-2026-01.json',import.meta.url)));
const pause=()=>new Promise(r=>setTimeout(r,10));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await pause();}throw Error('DOM did not reach expected state');}
test('saved receipt flow: refresh, clean status, suppressed tariff, operation, no-space battery, adjust and reopen',async()=>{
 const dom=new JSDOM('<html><head></head><body><main></main></body></html>',{url:'https://www.mexillum.com/diagnostico-universidades?rapido#exp=test-token'}),w=dom.window;
 const keys=['window','document','location','history','localStorage','navigator','Worker','fetch'],old=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 let record={id:'test',revision:1,extractionEnabled:true,extractionVersion:'test-new',data:{step:'receipts',contact:{},site:'',answers:{sector:'Institución educativa'},files:[{id:'f',name:'factura.pdf',status:'analyzed',extractionVersion:'old',attempts:3}],receipts:[{...fixture,id:'one',fileId:'f',generationPeak:null}],consent:true,roof:{area_m2:443.2}}};
 const actions=[],workerInputs=[],downloads=[],revokeTimers=[];let terminated=0;
 const nativeTimer=globalThis.setTimeout,createURL=URL.createObjectURL,revokeURL=URL.revokeObjectURL;
 URL.createObjectURL=blob=>{assert.equal(blob.type,'application/pdf');assert.ok(blob.size>1000);return 'blob:test-pdf';};URL.revokeObjectURL=()=>{};
 globalThis.setTimeout=(fn,ms,...args)=>{const id=nativeTimer(fn,ms,...args);if(ms===60000)revokeTimers.push(id);return id;};
 w.HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};
 class WorkerDouble{postMessage(data){workerInputs.push(structuredClone(data));this.timeout=setTimeout(()=>{if(!this.stopped)this.onmessage({data:{result:simulate(data)}});},0);}terminate(){this.stopped=true;clearTimeout(this.timeout);terminated++;}}
 const fetch=async(url,o)=>{assert.equal(url,'/api/expediente');const b=JSON.parse(o.body);actions.push(b.action);
  if(b.action==='save'){assert.equal(b.revision,record.revision);record.data=structuredClone(b.data);record.revision++;}
  if(b.action==='analyze'){assert.equal(b.refresh,true);record.data.receipts=[{...fixture,id:'one',fileId:'f'}];record.data.files[0].extractionVersion='test-new';record.revision++;}
  return {ok:true,json:async()=>structuredClone(record)};
 };
 for(const [k,v] of Object.entries({window:w,document:w.document,location:w.location,history:w.history,localStorage:w.localStorage,navigator:w.navigator,Worker:WorkerDouble,fetch}))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 w.scrollTo=()=>{};const append=w.document.head.append.bind(w.document.head);w.document.head.append=(...nodes)=>{append(...nodes);for(const node of nodes)if(node.tagName==='LINK')queueMicrotask(()=>node.onload?.());};
 // No Maps script is fetched; this is DOM integration, not browser automation.
 const root=w.document.querySelector('main'),get=s=>root.querySelector(s),click=async s=>{assert.ok(get(s),s);get(s).click();await until(()=>!root.hasAttribute('aria-busy'));};
 try{
  await initExpediente({root,content:{profile:{id:'universidades'}}});assert.match(root.textContent,/actualizarlas/);
  await click('[data-action=read]');assert.equal(actions.filter(a=>a==='analyze').length,1);assert.match(root.textContent,/Procesado sin alertas/);
  await click('[data-nav=operation]');assert.equal(get('[name=manualTariff]'),null);assert.equal(get('[name=manualBill]'),null);
  get('[name=loadShape]').value='1';get('[name=loadShape]').dispatchEvent(new w.Event('input',{bubbles:true}));
  await click('[data-nav=map]');assert.equal(record.data.answers.loadShape,1);
  get('[data-no-solar]').checked=true;get('[data-no-solar]').dispatchEvent(new w.Event('input',{bubbles:true}));
  await click('[data-nav=summary]');await until(()=>get('[data-sim-recalculate]'));
  assert.equal(record.data.answers.noSolarSpace,true);assert.match(root.textContent,/Batería nominal/);assert.doesNotMatch(root.textContent,/NaN|undefined/);assert.match(root.textContent,/Cargos y resultados por factura/);
  get('[data-sim=batteryKwh]').value='0';get('[data-sim=batteryKwh]').dispatchEvent(new w.Event('input',{bubbles:true}));
  await click('[data-sim-recalculate]');await until(()=>get('[data-sim-reset]'));assert.equal(record.data.simulation.manual,1);assert.equal(record.data.simulation.batteryKwh,0);
  await click('[data-sim-reset]');await until(()=>get('[data-sim-recalculate]'));assert.deepEqual(record.data.simulation,{});
  assert.match(root.textContent,/Cliente y domicilio/);assert.match(root.textContent,/Reducción estimada de la factura/);
  get('[data-sim=batteryKwh]').value='0';get('[data-sim=batteryKwh]').dispatchEvent(new w.Event('input',{bubbles:true}));
  get('[data-site]').value='Proyecto actualizado';get('[data-site]').dispatchEvent(new w.Event('input',{bubbles:true}));
  const oldInputs=workerInputs.length;await click('[data-summary-pdf]');assert.equal(workerInputs.length,oldInputs+1);assert.equal(workerInputs.at(-1).simulation.batteryKwh,0);assert.equal(workerInputs.at(-1).site,'Proyecto actualizado');assert.deepEqual(downloads,['Resumen-Mexillum-Proyecto-actualizado.pdf']);
  assert.match(root.textContent,/PDF preparado/);
  get('[data-sim=batteryKwh]').value='-1';await click('[data-summary-pdf]');assert.equal(downloads.length,1,'invalid assumptions must not be silently dropped for the PDF');
  get('[data-sim=batteryKwh]').value='0';

  await click('[data-nav=receipts]');await click('[data-action=read]');assert.equal(actions.filter(a=>a==='analyze').length,1,'current extraction must not be charged again');
  assert.ok(terminated>0);assert.ok(!actions.includes('submit'));
 }finally{for(const id of revokeTimers)clearTimeout(id);globalThis.setTimeout=nativeTimer;URL.createObjectURL=createURL;URL.revokeObjectURL=revokeURL;dom.window.close();for(const k of keys)if(old[k])Object.defineProperty(globalThis,k,old[k]);else delete globalThis[k];}
});
