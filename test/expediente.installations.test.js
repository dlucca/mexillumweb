import {test} from 'node:test';
import assert from 'node:assert/strict';
import {INSTALLATIONS,installationFor,installationFields,installationSummary,sanitizeInstallations} from '../js/expediente.installations.js';
import {sanitizeAnswers} from '../lib/onboarding/store.js';
import {requiredQuestions,normalizeReceipt} from '../js/expediente.model.js';

test('each installation has distinct operational questions and no tariff or bill duplicates',()=>{
 assert.equal(INSTALLATIONS.length,10);
 const expected={industry:'processLoads',commerce:'majorLoads',hotel:'hotelLoads',cold:'compresores',pumping:'hidraulica',charging:'gestion_carga',data_center:'backupArchitecture',remote:'fuente',university:'vacations',other:'description'};
 for(const p of INSTALLATIONS){assert.ok(p.fields.some(q=>q.key===expected[p.id]),p.id);assert.ok(p.fields.some(q=>q.key==='perfil'));assert.equal(new Set(p.fields.map(q=>q.key)).size,p.fields.length);assert.ok(!p.fields.some(q=>['tarifa','factura','calidad','generacion'].includes(q.key)));}
});
test('university captures calendar, vacation operation, night activity and critical services',()=>{
 const p=installationFor('Institución educativa');assert.equal(p.id,'university');assert.match(p.scheduleLabel,/académico/);
 const a={sector:p.sector,installations:{university:{criticalLoads:['laboratorios','frio']}}};
 assert.ok(installationFields(a).some(q=>q.key==='criticalDetail'));
 a.installations.university.criticalLoads=['ninguna'];assert.ok(!installationFields(a).some(q=>q.key==='criticalDetail'));
 for(const k of ['vacations','afterhours','criticalLoads','corte'])assert.ok(p.fields.some(q=>q.key===k));
});
test('charge growth questions are conditional and old responses remain recoverable',()=>{
 const a={sector:'Carga de vehículos',objective:['growth'],installations:{charging:{crecimiento:'muchos'}}};
 assert.ok(installationSummary(a).some(q=>q.value.includes('Más de 50')));
 a.objective=['cost'];assert.ok(!installationFields(a).some(q=>q.key==='crecimiento'));
 assert.equal(sanitizeAnswers(a).installations.charging.crecimiento,'muchos');
});
test('server retains separate installations and rejects forged choices and arbitrary fields',()=>{
 const input={university:{vacations:'continua',criticalLoads:['frio','frio','fake'],criticalDetail:'  Muestras, 2 horas  ',invented:'x'},pumping:{hidraulica:'sin_tanque'},fake:{foo:'bar'}};
 const out=sanitizeInstallations(input);assert.deepEqual(out.university.criticalLoads,['frio']);assert.equal(out.university.criticalDetail,'Muestras, 2 horas');assert.ok(!('invented'in out.university));assert.ok(!('fake'in out));
 assert.equal(sanitizeAnswers({sector:'Bombeo',installations:input}).installations.university.vacations,'continua');
 assert.deepEqual(sanitizeInstallations({university:{criticalLoads:['frio','ninguna']}}).university.criticalLoads,['ninguna']);
 assert.equal(sanitizeInstallations({university:{vacations:'invented'}}).university.vacations,undefined);
 assert.deepEqual(sanitizeInstallations(null),{});
});
test('summary includes only active installation in readable labels with pending data visible',()=>{
 const a={sector:'Bombeo',installations:{pumping:{hidraulica:'tanque_sin_horario'},university:{afterhours:'Private campus note'}}};
 const summary=installationSummary(a);assert.ok(summary.some(q=>q.value.includes('Hay tanque')));assert.ok(!JSON.stringify(summary).includes('Private campus'));assert.ok(summary.some(q=>q.value==='Por confirmar'));
});
test('receipts continue suppressing manual tariff while operational questions remain available',()=>{
 const receipt={...normalizeReceipt({kind:'bill',service:'123',tariff:'GDMTH',start:'2026-01-31',end:'2026-02-28',total:32363,kwh:9854},'file',0),reviewed:true};
 const d={receipts:[receipt],answers:{sector:'Institución educativa'}};assert.ok(!requiredQuestions(d).includes('manualBill'));assert.ok(installationFields(d.answers).length>=6);
 assert.ok(requiredQuestions({...d,receipts:[]}).includes('manualBill'));
});
