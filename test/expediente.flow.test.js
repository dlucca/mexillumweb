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
  const operationSection=[...root.querySelectorAll('.exp-section')].find(s=>s.querySelector('summary').textContent.includes('Tu operación'));
  assert.match(operationSection.querySelector('summary span').textContent,/^0 de 3/,'counter starts at zero');
  const daysSelect=get('[name=days]');
  daysSelect.value='lv';daysSelect.dispatchEvent(new w.Event('input',{bubbles:true}));daysSelect.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(get('[name=days]'),daysSelect,'answering must update the counter in place, not re-render the section (which would drop focus)');
  assert.match(operationSection.querySelector('summary span').textContent,/^1 de 3/,'counter must reflect the just-answered question immediately, even though days/hours/off never trigger a section re-render');
  // Unlike days/hours/off, a change to objective/equipment/power DOES rebuild the whole
  // "Qué buscas" section (dependent conditional fields can appear or disappear), and a
  // change to objective/sector/criticalLoads rebuilds the installation section too. That
  // rebuild must not steal focus off the checkbox just tapped, nor reopen a section the
  // client had collapsed.
  const goalsContainer=get('[data-goals]');
  goalsContainer.querySelector('details').open=false;
  const growthBefore=get('[name=objective][value=growth]');
  growthBefore.focus();growthBefore.checked=true;
  growthBefore.dispatchEvent(new w.Event('input',{bubbles:true}));
  growthBefore.dispatchEvent(new w.Event('change',{bubbles:true}));
  const growthAfter=get('[name=objective][value=growth]');
  assert.notEqual(growthAfter,growthBefore,'sanity check: the checkbox really was rebuilt by the section redraw');
  assert.equal(w.document.activeElement,growthAfter,'focus must return to the toggled checkbox, not fall to <body>');
  assert.equal(goalsContainer.querySelector('details').open,false,'a section the client collapsed must stay collapsed across the redraw');
  assert.match(goalsContainer.querySelector('details summary span').textContent,/^1 de /,'the "Qué buscas" counter must reflect the newly answered objective checkbox');
  await click('[data-nav=map]');assert.equal(record.data.answers.days,'lv');
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

// Regression: `multi()` appends a `nolose` option to every multi-choice question,
// including `objective`. Answering "No lo sé" there must be at least as permissive
// for roof marking as answering nothing at all — never worse.
test('objective:[nolose] still allows roof marking, same as answering nothing',async()=>{
 const dom=new JSDOM('<html><head></head><body><main></main></body></html>',{url:'https://www.mexillum.com/diagnostico-industria-comercio?rapido#exp=nolose-token'}),w=dom.window;
 const keys=['window','document','location','history','localStorage','navigator','Worker','fetch'],old=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 let record={id:'nolose-test',revision:1,extractionEnabled:true,extractionVersion:'test-new',data:{step:'map',contact:{},site:'',answers:{sector:'Institución educativa',objective:['nolose']},files:[],receipts:[],consent:true,roof:null}};
 const fetch=async(url,o)=>{const b=JSON.parse(o.body);if(b.action==='save'){record.data=structuredClone(b.data);record.revision++;}return {ok:true,json:async()=>structuredClone(record)};};
 for(const [k,v] of Object.entries({window:w,document:w.document,location:w.location,history:w.history,localStorage:w.localStorage,navigator:w.navigator,Worker:class{},fetch}))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 w.scrollTo=()=>{};const append=w.document.head.append.bind(w.document.head);w.document.head.append=(...nodes)=>{append(...nodes);for(const node of nodes)if(node.tagName==='LINK')queueMicrotask(()=>node.onload?.());};
 const root=w.document.querySelector('main');
 try{
  await initExpediente({root,content:{profile:{id:'test'}}});
  await until(()=>root.querySelector('.dx-roof__bar'));
  assert.ok(root.querySelector('.dx-roof__add'),'objective:["nolose"] must not be worse than answering nothing: roof marking (the "+ Agregar otra área" control) must still be offered');
 }finally{dom.window.close();for(const k of keys)if(old[k])Object.defineProperty(globalThis,k,old[k]);else delete globalThis[k];}
});
for(const [paso,step,marker] of [['mapa','map','.dx-roof__bar'],['operacion','operation','form.exp-operation']])test(`focused ${paso} link shows only its part and never moves the client's step`,async()=>{
 const dom=new JSDOM('<html><head></head><body><main></main></body></html>',{url:`https://www.mexillum.com/diagnostico-industria-comercio?rapido#exp=focus-token&paso=${paso}`}),w=dom.window;
 const keys=['window','document','location','history','localStorage','navigator','Worker','fetch'],old=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 let record={id:'focus-test',revision:1,extractionEnabled:true,extractionVersion:'test-new',data:{step:'summary',contact:{},site:'Planta',answers:{sector:'Hotel'},files:[],receipts:[],consent:true,roof:null,location:{lat:21,lng:-101}}};
 const actions=[];
 const fetch=async(url,o)=>{const b=JSON.parse(o.body);actions.push(b.action);if(b.action==='save'){record.data=structuredClone(b.data);record.revision++;}return {ok:true,json:async()=>structuredClone(record)};};
 for(const [k,v] of Object.entries({window:w,document:w.document,location:w.location,history:w.history,localStorage:w.localStorage,navigator:w.navigator,Worker:class{},fetch}))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
 w.scrollTo=()=>{};const append=w.document.head.append.bind(w.document.head);w.document.head.append=(...nodes)=>{append(...nodes);for(const node of nodes)if(node.tagName==='LINK')queueMicrotask(()=>node.onload?.());};
 const root=w.document.querySelector('main');
 try{
  await initExpediente({root,content:{profile:{id:'test'}}});
  await until(()=>root.querySelector(marker));
  assert.equal(root.querySelector('.exp-steps'),null,'the progress bar would reveal the other steps');
  assert.equal(root.querySelectorAll('[data-nav]').length,0,'no button may lead to another step');
  assert.equal(w.location.hash,`#exp=focus-token&paso=${paso}`,'reloading must keep the page focused');
  assert.equal(w.localStorage.getItem('mexillum:expediente:token'),null,'a focused visitor must not inherit the full expediente on this device');
  assert.deepEqual(actions,['read'],'opening a focused link must not trigger other writes');
  root.querySelector('[data-focus-save]').click();
  await until(()=>root.querySelector('[data-message]:not([hidden])')?.textContent.includes('guardad'));
  assert.equal(record.data.step,'summary','the client keeps the step they were on');
  assert.ok(actions.includes('save'));
 }finally{dom.window.close();for(const k of keys)if(old[k])Object.defineProperty(globalThis,k,old[k]);else delete globalThis[k];}
});
