import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractionUsage,extractReceipts} from '../lib/onboarding/extraction.js';
const usage={input_tokens:60000,output_tokens:8000,input_tokens_details:{cached_tokens:10000},output_tokens_details:{reasoning_tokens:2000}};
const result=(overrides={})=>({status:'completed',model:'gpt-5.4-mini-2026-03-17',usage,output:[{content:[{type:'output_text',text:JSON.stringify({receipts:[{kind:'bill',page:1,service:'123',kwh:200,total:500}],notes:[]})}]}],...overrides});
async function withProvider(fetcher,fn) {
  const previous=global.fetch;
  global.fetch=fetcher;
  try{return await fn();}finally{global.fetch=previous;}
}
const extract=()=>extractReceipts({id:'file1',mime:'image/png'},'https://example.supabase.co/private.pdf?token=never-log');
test('usage subtracts cache hits and includes reasoning only once',()=>{
  const u=extractionUsage(result(),'gpt-5.4-mini');
  assert.equal(u.estimatedCostUSD,.07425);assert.equal(u.reasoningTokens,2000);
  assert.equal(u.pricingDate,'2026-09-12');assert.equal(u.model,'gpt-5.4-mini-2026-03-17');
});
test('unknown models or incomplete usage never invent a cost',()=>{
  assert.equal(extractionUsage(result(),'another-model').estimatedCostUSD,null);
  assert.equal(extractionUsage(result({usage:{input_tokens:60000}}),'gpt-5.4-mini').estimatedCostUSD,null);
  assert.equal(extractionUsage(result({usage:{...usage,input_tokens_details:{cached_tokens:90000}}}),'gpt-5.4-mini').estimatedCostUSD,null);
  assert.equal(extractionUsage(result({usage:undefined}),'gpt-5.4-mini'),null);
});
test('valid extraction keeps source page and requires human review',()=>withProvider(async()=>Response.json(result()),async()=>{
  const r=await extract();assert.equal(r.receipts[0].page,1);assert.equal(r.receipts[0].reviewed,false);assert.equal(r.receipts[0].original.kwh,200);assert.equal(r.usage.inputTokens,60000);
}));
test('provider errors distinguish credentials, quota and rate limits without leaking provider text',async()=>{
  for(const [status,code,expectedStatus,phrase] of [[401,'invalid_api_key',503,/clave/],[429,'insufficient_quota',503,/saldo/],[429,'rate_limit_exceeded',429,/ocupado/],[404,'model_not_found',503,/modelo/]]) {
    await withProvider(async()=>Response.json({error:{code,message:'SECRET never-log'}},{status}),()=>assert.rejects(extract(),e=>e.status===expectedStatus&&phrase.test(e.message)&&!e.message.includes('SECRET')));
  }
});
test('incomplete responses and invalid JSON preserve billed usage but never return receipts',async()=>{
  for(const r of [result({status:'incomplete'}),result({output:[{content:[{type:'output_text',text:'invalid JSON'}]}]})]) {
    await withProvider(async()=>Response.json(r),()=>assert.rejects(extract(),e=>e.status===503&&e.extractionUsage.inputTokens===60000));
  }
});
test('empty or history-only extraction remains retryable and preserves usage',async()=>{
  for(const receipts of [[],[{kind:'history'}]]) {
    await withProvider(async()=>Response.json(result({output:[{content:[{type:'output_text',text:JSON.stringify({receipts})}]}]})),()=>assert.rejects(extract(),e=>e.status===422&&e.extractionUsage.outputTokens===8000));
  }
});
test('network failures do not expose signed URLs or claim known usage',()=>withProvider(async()=>{throw Error('https://example.supabase.co/private.pdf?token=never-log');},()=>assert.rejects(extract(),e=>e.status===503&&!e.message.includes('never-log')&&e.extractionUsage===null)));

test('a bounded second reading clears only matching confident fields, preserves disagreements and counts both requests',async()=>{
 for(const disagree of [false,true]){
  let calls=0;await withProvider(async(_url,o)=>{calls++;const body=JSON.parse(o.body);assert.equal(body.reasoning.effort,'medium');const raw={kind:'bill',page:1,service:'123',kwh:calls===2&&disagree?201:200,total:500,uncertain:calls===1?['kwh']:[]};return Response.json(result({output:[{content:[{type:'output_text',text:JSON.stringify({receipts:[raw],notes:[]})}]}]}));},async()=>{
   const r=await extract();assert.equal(calls,2);assert.equal(r.usage.requests,2);assert.equal(r.usage.inputTokens,120000);assert.equal(r.receipts[0].kwh,200);assert.equal(r.receipts[0].uncertain.includes('kwh'),disagree);assert.equal(!!r.receipts[0].automaticChecks,!disagree);assert.equal(r.receipts[0].reviewed,false);
  });
 }
});
