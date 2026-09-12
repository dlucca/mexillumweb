import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
import {billImpact,impactView,customerSummary,customerView} from '../js/expediente.summary.js';
import {createSummaryPdf} from '../js/expediente.pdf.js';
import {simulate} from '../js/expediente.simulation.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/cfe-san-luis-2026-01.json',import.meta.url)));
const shown={scenarios:[{id:'baseline',bill:310196},{id:'hybrid',bill:112096}],extraBatterySaving:86146};
test('total bill saving includes battery contribution and is distinct from energy coverage',()=>{
 const x=billImpact(shown);assert.equal(x.saving,198100);assert.equal(x.batteryContribution,86146);assert.equal(x.reductionPct.toFixed(1),'63.9');
 const html=impactView(shown);assert.match(html,/198,100/);assert.match(html,/63\.9/);assert.match(html,/112,096/);assert.doesNotMatch(html,/284,246/);
 assert.equal(billImpact({}),null);assert.equal(billImpact({...shown,project:true,evaluated:0}),null);
 assert.match(impactView({...shown,project:true,evaluated:1,comparable:false}),/Resultado parcial/);
 assert.match(impactView({scenarios:[{id:'baseline',bill:0},{id:'hybrid',bill:1}]}),/Sobrecosto anual estimado/);
 assert.match(impactView({scenarios:[{id:'baseline',bill:0},{id:'hybrid',bill:1}]}),/No aplica/);
});
test('CFE identity uses latest available fields per service with provenance, escaping and no contact replacement',()=>{
 const d={service:'__all__',contact:{name:'Contacto'},receipts:[
 {kind:'bill',service:'111111111111',end:'2026-01-31',holder:'Cliente anterior',address:'Calle antigua'},
 {kind:'bill',service:'No. de servicio:111111111111',end:'2026-02-28',holder:'José <script>',address:'Av. México 23',uncertain:['address']},
 {kind:'bill',service:'222222222222',end:'2026-02-28',holder:'Otra empresa',address:'Otro domicilio'},
 {kind:'bill',service:'111111111111',end:'2026-03-31',holder:'Excluido',excluded:true}]};
 const before=JSON.stringify(d),rows=customerSummary(d);assert.equal(rows.length,2);assert.equal(rows[0].holder.value,'José <script>');assert.equal(rows[0].address.uncertain,true);assert.equal(rows[0].address.end,'2026-02-28');assert.ok(rows[0].conflicting.includes('holder'));
 assert.doesNotMatch(customerView(d),/<script>/);assert.match(customerView(d),/&lt;script&gt;/);assert.equal(JSON.stringify(d),before);
 d.service='222222222222';assert.equal(customerSummary(d).length,1);assert.doesNotMatch(customerView(d),/José/);
 assert.match(customerView({receipts:[]}),/cuando estén disponibles/);
});
test('downloadable PDF supports Spanish, long identity, partial projects and pending services',async()=>{
 const data={site:'Universidad de Prueba',contact:{name:'María Pérez',email:'prueba@example.com'},receipts:[{...fixture,id:'one',holder:'Institución Académica de México',address:'Avenida de la Educación '.repeat(12)+'123, San Luis Potosí'}],roof:{area_m2:443.2},answers:{}};
 const r=simulate(data),bytes=await createSummaryPdf(data,r,{createdAt:new Date('2026-09-12T12:00:00Z')});
 const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>=2);assert.equal(pdf.getTitle(),'Resumen Mexillum - Universidad de Prueba');assert.equal(pdf.getPages()[0].getWidth(),595.28);
 const pending={source:{ready:false,service:'other'},status:'pending',reason:'Faltan precios por horario.'};
 const project={project:true,results:[{service:fixture.service,result:r},{service:'other',result:pending}],evaluated:1,comparable:false,scenarios:r.scenarios};
 const multi=await PDFDocument.load(await createSummaryPdf(data,project));assert.ok(multi.getPageCount()>pdf.getPageCount());
 assert.ok((await createSummaryPdf({receipts:[]},pending)).length>1000);
});
