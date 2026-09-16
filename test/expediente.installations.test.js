import {test} from 'node:test';
import assert from 'node:assert/strict';
import {INSTALLATIONS,installationFor,installationFields,installationSummary,sanitizeInstallations} from '../js/expediente.installations.js';
import {sanitizeAnswers} from '../lib/onboarding/store.js';
import {requiredQuestions,normalizeReceipt} from '../js/expediente.model.js';

test('each installation has distinct operational questions and no free text', () => {
 assert.equal(INSTALLATIONS.length,10);
 const expected={industry:'arranques',commerce:'climatizacion',hotel:'ocupacion',cold:'margen',pumping:'variadores',charging:'ventana',data_center:'redundancia',remote:'diesel',university:'respaldoTiempo',other:'flexibilidad'};
 for(const p of INSTALLATIONS){
  assert.ok(p.fields.some(q=>q.key===expected[p.id]),p.id);
  assert.ok(p.fields.some(q=>q.key==='perfil'),p.id);
  assert.equal(new Set(p.fields.map(q=>q.key)).size,p.fields.length,p.id);
  assert.ok(!p.fields.some(q=>['tarifa','factura','calidad','generacion'].includes(q.key)),p.id);
 }
});

test('no installation question asks the client to type', () => {
 for(const p of INSTALLATIONS)for(const q of p.fields){
  assert.ok(['select','multi'].includes(q.type),`${p.id}.${q.key}: ${q.type}`);
  assert.equal(q.options.at(-1).value,'nolose',`${p.id}.${q.key}`);
 }
});

test('industry, commerce and other no longer share one questionnaire', () => {
 const keys=id=>new Set(INSTALLATIONS.find(p=>p.id===id).fields.map(q=>q.key));
 const [a,b,c]=['industry','commerce','other'].map(keys);
 assert.notDeepEqual([...a].sort(),[...b].sort());
 assert.notDeepEqual([...b].sort(),[...c].sort());
});

test('university captures calendar, vacation operation, night activity and critical services',()=>{
 const p=installationFor('Institución educativa');assert.equal(p.id,'university');assert.match(p.scheduleLabel,/académico/);
 const a={sector:p.sector,installations:{university:{criticalLoads:['laboratorios','frio']}}};
 assert.ok(installationFields(a).some(q=>q.key==='respaldoTiempo'));
 a.installations.university.criticalLoads=['ninguna'];assert.ok(!installationFields(a).some(q=>q.key==='respaldoTiempo'));
 for(const k of ['vacations','afterhours','criticalLoads','corte'])assert.ok(p.fields.some(q=>q.key===k));
});
test('charge growth questions are conditional and old responses remain recoverable',()=>{
 const a={sector:'Carga de vehículos',objective:['growth'],installations:{charging:{crecimiento:'muchos'}}};
 assert.ok(installationSummary(a).some(q=>q.value.includes('Más de 50')));
 a.objective=['cost'];assert.ok(!installationFields(a).some(q=>q.key==='crecimiento'));
 assert.equal(sanitizeAnswers(a).installations.charging.crecimiento,'muchos');
});
test('server retains separate installations and rejects forged choices and arbitrary fields',()=>{
 const input={university:{vacations:'continua',criticalLoads:['frio','frio','fake'],afterhours:['servidores','labfrio','fake'],respaldoTiempo:'corto',invented:'x'},pumping:{variadores:'todas'},fake:{foo:'bar'}};
 const out=sanitizeInstallations(input);
 assert.deepEqual(out.university.criticalLoads,['frio']);
 assert.deepEqual(out.university.afterhours,['servidores','labfrio']);
 assert.equal(out.university.respaldoTiempo,'corto');
 assert.ok(!('invented'in out.university));assert.ok(!('fake'in out));
 assert.equal(sanitizeAnswers({sector:'Bombeo',installations:input}).installations.university.vacations,'continua');
 assert.deepEqual(sanitizeInstallations({university:{criticalLoads:['frio','ninguna']}}).university.criticalLoads,['ninguna']);
 assert.equal(sanitizeInstallations({university:{vacations:'invented'}}).university.vacations,undefined);
 assert.deepEqual(sanitizeInstallations(null),{});
});
test('summary includes only active installation in readable labels with pending data visible',()=>{
 const a={sector:'Bombeo',installations:{pumping:{hidraulica:'tanque_sin_horario'},university:{afterhours:['servidores']}}};
 const summary=installationSummary(a);
 assert.ok(summary.some(q=>q.value.includes('Hay tanque')));
 assert.ok(!JSON.stringify(summary).includes('Servidores'));
 assert.ok(summary.some(q=>q.value==='Por confirmar'));
});
test('receipts continue suppressing manual tariff while operational questions remain available',()=>{
 const receipt={...normalizeReceipt({kind:'bill',service:'123',tariff:'GDMTH',start:'2026-01-31',end:'2026-02-28',total:32363,kwh:9854},'file',0),reviewed:true};
 const d={receipts:[receipt],answers:{sector:'Institución educativa'}};assert.ok(!requiredQuestions(d).includes('manualBill'));assert.ok(installationFields(d.answers).length>=6);
 assert.ok(requiredQuestions({...d,receipts:[]}).includes('manualBill'));
});
