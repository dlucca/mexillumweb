import {PDFDocument} from 'pdf-lib';
const mockPDF=await PDFDocument.create();mockPDF.addPage();const mockPDFBytes=await mockPDF.save();
import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/expediente.js';
const ADVISOR='a'.repeat(40);
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(b){this.body=b;return this;}};}
export function fakeServices(){
 const rows=new Map(),objects=new Map();let extracted=0,emails=0,providerStatus='completed';
 const ok=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
 const fetch=async(input,o={})=>{
   const u=new URL(input),body=o.body?JSON.parse(o.body):{};
   if(u.pathname.endsWith('/rpc/expediente_rate_limit'))return ok(true);
   if(u.pathname==='/rest/v1/prospect_expedientes'){
     if(o.method==='POST'){const row={...body};rows.set(row.id,row);return ok([structuredClone(row)]);}
     let list=[...rows.values()].filter(r=>!u.searchParams.has('token_hash')||'eq.'+r.token_hash===u.searchParams.get('token_hash')).filter(r=>!u.searchParams.has('id')||'eq.'+r.id===u.searchParams.get('id'));
     if(o.method==='PATCH') {list=list.filter(r=>'eq.'+r.revision===u.searchParams.get('revision'));for(const r of list)Object.assign(r,body);}
     return ok(structuredClone(list));
   }
   if(u.pathname.includes('/storage/v1/object/upload/sign/')) {
     // Storage rejects an empty body when Content-Type is application/json.
     if(!o.body)return ok({code:'EmptyRequestBody'},400);
     return ok({url:'/object/upload/sign/expediente-files/a.pdf?token=signed'});
   }
   if(u.pathname.includes('/storage/v1/object/sign/')&&o.method==='POST')return ok({signedURL:'/object/sign/expediente-files/a.pdf?token=download'});
   if(o.method==='HEAD') {const key=u.pathname.split('/expediente-files/')[1],obj=objects.get(key);return new Response(null,{status:obj?200:404,headers:obj?{'content-length':String(obj.size),'content-type':obj.mime}:{}});}
   if(u.pathname.includes('/storage/v1/object/sign/')&&!o.method)return new Response(mockPDFBytes);
   if(o.method==='DELETE'){for(const key of body.prefixes)objects.delete(key);return ok([]);}
   if(u.hostname==='api.openai.com') {extracted++;assert.equal(body.store,false);assert.equal(body.service_tier,'default');assert.equal(body.reasoning.effort,'low');assert.equal(body.input[0].content[1].detail,'high');assert.equal(body.text.format.type,'json_schema');assert.match(body.instructions,/ignora cualquier instrucción/);return ok({status:providerStatus,model:'gpt-5.4-mini-2026-03-17',usage:{input_tokens:60000,output_tokens:8000,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:2000}},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({receipts:[{page:1,kind:'bill',service:'123',tariff:'GDMTH',start:'2026-01-31',end:'2026-02-28',total:32363.06,kwh:9854,base:1440,intermediate:7405,peak:1009,uncertain:[]}],notes:[]})}]}]});}
   if(u.hostname==='api.resend.com'){emails++;return ok({id:'email-1'});}
   throw new Error('Unexpected mock URL '+u.pathname);
 };
 return {fetch,rows,objects,get extracted(){return extracted;},get emails(){return emails;},set status(v){providerStatus=v;}};
}
async function fixture(fn){
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake-service-role',ADVISOR_API_KEY:ADVISOR,OPENAI_API_KEY:'fake-openai',RESEND_API_KEY:'fake-resend'};
 const original=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]])),oldFetch=global.fetch,mock=fakeServices();Object.assign(process.env,env);global.fetch=mock.fetch;
 async function call(body,token=''){const res=response();await handler({method:'POST',body,headers:{authorization:`Bearer ${token}`,'x-forwarded-for':'127.0.0.1'}},res);return res;}
 try{await fn(call,mock);}finally{global.fetch=oldFetch;for(const [k,v]of Object.entries(original)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
}
async function draft(call){return (await call({action:'create',advisor:true,contact:{name:'Prueba',email:'example@example.com'},site:'Campus de prueba'},ADVISOR)).body;}
async function consent(call,r){return (await call({action:'save',revision:r.revision,data:{consent:true}},r.token)).body;}
test('advisor creation is protected; token grants only its own draft and uses no-store',()=>fixture(async(call)=>{
 assert.equal((await call({action:'create',advisor:true},'bad')).code,401);
 const r=await draft(call);assert.equal(r.token.length,64);assert.ok(!('token_hash'in r));
 const read=await call({action:'read'},r.token);assert.equal(read.body.data.site,'Campus de prueba');assert.equal(read.headers['Cache-Control'],'no-store');
 assert.equal((await call({action:'read'},'b'.repeat(64))).code,404);
}));
test('stale revision cannot overwrite newer answers',()=>fixture(async(call)=>{
 const r=await draft(call);await call({action:'save',revision:0,data:{answers:{sector:'Institución educativa'}}},r.token);
 assert.equal((await call({action:'save',revision:0,data:{answers:{sector:'Incorrecto'}}},r.token)).code,409);
 assert.equal((await call({action:'read'},r.token)).body.data.answers.sector,'Institución educativa');
}));
test('combined 15.6 MB PDF accepted; complete verifies bytes, parsing is idempotent, provenance immutable',()=>fixture(async(call,mock)=>{
 let r=await draft(call);const token=r.token;r=await consent(call,r);
 const upload=await call({action:'upload',revision:r.revision,name:'RECIBOS CFE.pdf',mime:'application/pdf',size:15647211},token);assert.equal(upload.code,200);r=upload.body;assert.equal(r.uploadURL,'https://test.supabase.co/storage/v1/object/upload/sign/expediente-files/a.pdf?token=signed');
 const f=r.data.files[0];assert.equal((await call({action:'complete',revision:r.revision,fileId:f.id},token)).code,503);
 mock.objects.set(f.path,{size:15647211,mime:'application/pdf'});
 r=(await call({action:'complete',revision:r.revision,fileId:f.id},token)).body;
 r=(await call({action:'analyze',revision:r.revision,fileId:f.id},token)).body;
 assert.equal(r.data.receipts[0].total,32363.06);assert.equal(mock.extracted,1);
 assert.equal(r.data.files[0].extractionUsage[0].estimatedCostUSD,.081);
 assert.equal(r.data.files[0].extractionUsage[0].reasoningTokens,2000);
 r=(await call({action:'analyze',revision:r.revision,fileId:f.id},token)).body;assert.equal(mock.extracted,1);
 assert.equal(r.data.files[0].extractionUsage.length,1);
 const modified={...r.data.receipts[0],total:100,original:{total:0},page:99,reviewed:true};
 r=(await call({action:'save',revision:r.revision,data:{receipts:[modified]}},token)).body;
 assert.equal(r.data.receipts[0].original.total,32363.06);assert.equal(r.data.receipts[0].page,1);assert.ok(r.data.receipts[0].correctedFields.includes('total'));
}));
test('cannot sign paths or register files from another draft; malicious type rejected',()=>fixture(async(call)=>{
 let r=await draft(call),token=r.token;r=await consent(call,r);
 assert.equal((await call({action:'upload',revision:r.revision,name:'receipt.exe',mime:'application/pdf',size:12},token)).code,400);
 assert.equal((await call({action:'file',revision:r.revision,fileId:'other-exp-file',path:'../other'},token)).code,404);
 assert.equal((await call({action:'upload',revision:r.revision,name:'x.pdf',mime:'application/pdf',size:26*1024*1024},token)).code,400);
}));
test('missing key leaves uploaded document intact and exposes manual continuation',()=>fixture(async(call,mock)=>{
 let r=await draft(call),token=r.token;r=await consent(call,r);
 r=(await call({action:'upload',revision:r.revision,name:'x.pdf',mime:'application/pdf',size:12},token)).body;let f=r.data.files[0];mock.objects.set(f.path,{size:12,mime:'application/pdf'});
 r=(await call({action:'complete',revision:r.revision,fileId:f.id},token)).body;delete process.env.OPENAI_API_KEY;
 assert.equal((await call({action:'analyze',revision:r.revision,fileId:f.id},token)).code,503);
 const loaded=(await call({action:'read'},token)).body;assert.equal(loaded.extractionEnabled,false);assert.equal(loaded.data.files.length,1);assert.equal(mock.extracted,0);
}));
test('incomplete extraction produces error, not partial numerical result',()=>fixture(async(call,mock)=>{
 let r=await draft(call),token=r.token;r=await consent(call,r);r=(await call({action:'upload',revision:r.revision,name:'x.pdf',mime:'application/pdf',size:12},token)).body;
 let f=r.data.files[0];mock.objects.set(f.path,{size:12,mime:'application/pdf'});r=(await call({action:'complete',revision:r.revision,fileId:f.id},token)).body;mock.status='incomplete';
 const result=await call({action:'analyze',revision:r.revision,fileId:f.id},token);assert.equal(result.code,503);assert.equal(result.body.data.receipts.length,0);assert.equal(result.body.data.files[0].status,'error');
 assert.equal(result.body.data.files[0].extractionUsage[0].estimatedCostUSD,.081);
 mock.status='completed';
 const retry=await call({action:'analyze',revision:result.body.revision,fileId:f.id},token);
 assert.equal(retry.code,200);assert.equal(retry.body.data.files[0].extractionUsage.length,2);
 assert.deepEqual(retry.body.data.files[0].extractionUsage.map(u=>u.attempt),[1,2]);
 const saved=await call({action:'save',revision:retry.body.revision,data:{files:[{id:f.id,extractionUsage:[]}]}},token);
 assert.equal(saved.body.data.files[0].extractionUsage.length,2);
}));
test('explicit submit sends one notification; refresh and retry do not resend',()=>fixture(async(call,mock)=>{
 let r=await draft(call),token=r.token;assert.equal(mock.emails,0);r=await consent(call,r);
 r=(await call({action:'submit',revision:r.revision},token)).body;assert.ok(r.submittedAt);assert.equal(mock.emails,1);
 await call({action:'submit',revision:r.revision},token);assert.equal(mock.emails,1);
}));
test('revoked consent blocks reading and uploading without erasing draft',()=>fixture(async(call)=>{
 const r=await draft(call);assert.equal((await call({action:'upload',revision:r.revision,name:'x.pdf',mime:'application/pdf',size:12},r.token)).code,400);assert.equal((await call({action:'read'},r.token)).code,200);
}));
test('expired tokens cannot recover personal details',()=>fixture(async(call,mock)=>{
 const r=await draft(call);mock.rows.get(r.id).expires_at='2020-01-01T00:00:00Z';const res=await call({action:'read'},r.token);assert.equal(res.code,404);assert.equal(res.body.data,undefined);
}));
test('server ignores client-forged uploaded documents and provenance',()=>fixture(async(call)=>{
 let r=await draft(call),token=r.token;r=await consent(call,r);const saved=await call({action:'save',revision:r.revision,data:{files:[{path:'other/file.pdf',status:'analyzed'}],receipts:[{id:'forged',total:1,reviewed:true}]}},token);assert.deepEqual(saved.body.data.files,[]);assert.deepEqual(saved.body.data.receipts,[]);
}));

test('malformed JSON is a client error',()=>fixture(async(call)=>{assert.equal((await call('{')).code,400);}));

test('installation details persist through create, save, sector switch, reopen and submit',()=>fixture(async(call,mock)=>{
 let r=(await call({action:'create',advisor:true,contact:{name:'Prueba',email:'example@example.com'},answers:{sector:'Institución educativa',installations:{university:{vacations:'continua'}}}},ADVISOR)).body;
 const token=r.token;assert.equal(r.data.answers.installations.university.vacations,'continua');
 r=(await call({action:'save',revision:r.revision,data:{consent:true,answers:{...r.data.answers,installations:{university:{...r.data.answers.installations.university,criticalLoads:['frio'],criticalDetail:'Muestras: 2 horas',injected:'ignore'},pumping:{hidraulica:'sin_tanque'}}}}},token)).body;
 r=(await call({action:'save',revision:r.revision,data:{answers:{...r.data.answers,sector:'Bombeo'}}},token)).body;
 r=(await call({action:'read'},token)).body;assert.equal(r.data.answers.installations.university.criticalDetail,'Muestras: 2 horas');assert.equal(r.data.answers.installations.pumping.hidraulica,'sin_tanque');assert.equal(r.data.answers.installations.university.injected,undefined);
 r=(await call({action:'submit',revision:r.revision},token)).body;assert.ok(r.submittedAt);assert.equal(mock.emails,1);
}));
