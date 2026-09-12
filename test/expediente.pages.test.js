import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {extractReceipts} from '../lib/onboarding/extraction.js';

async function pdf(count) {
  const doc=await PDFDocument.create();
  for(let i=1;i<=count;i++)doc.addPage([600+i,800]);
  return doc.save();
}
const response=(receipts)=>Response.json({status:'completed',model:'gpt-5.4-mini-2026-03-17',
  usage:{input_tokens:1000,output_tokens:200,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:50}},
  output:[{content:[{type:'output_text',text:JSON.stringify({receipts,notes:[]})}]}]});
async function run(bytes,provider,fn) {
  const previous=global.fetch;
  global.fetch=async(url,options={})=>url==='https://storage.test/file.pdf'?new Response(bytes):provider(JSON.parse(options.body));
  try{return await fn(()=>extractReceipts({id:'source',mime:'application/pdf'},'https://storage.test/file.pdf'));}
  finally{global.fetch=previous;}
}
test('every page is read alone, consecutive bills survive, source page is independent of model and completion order',async()=>{
  const seen=[];let active=0,maxActive=0;
  await run(await pdf(7),async body=>{
    active++;maxActive=Math.max(active,maxActive);
    const content=body.input[0].content[1];
    const part=await PDFDocument.load(Buffer.from(content.file_data.split(',')[1],'base64'));
    assert.equal(part.getPageCount(),1);
    const n=part.getPage(0).getWidth()-600;seen.push(n);
    await new Promise(resolve=>setTimeout(resolve,(8-n)*2));active--;
    return response([2,6].includes(n)?[]:[{kind:'bill',page:99,kwh:n,total:n*10}]);
  },async extract=>{
    const result=await extract();
    assert.deepEqual(seen.sort((a,b)=>a-b),[1,2,3,4,5,6,7]);
    assert.deepEqual(result.receipts.map(r=>r.page),[1,3,4,5,7]);
    assert.deepEqual(result.receipts.map(r=>r.original.kwh),[1,3,4,5,7]);
    assert.ok(result.receipts.every(r=>!r.reviewed));
    assert.equal(result.usage.inputTokens,7000);
    assert.equal(result.usage.outputTokens,1400);
    assert.equal(result.usage.estimatedCostUSD,.01155);
    assert.equal(result.usage.requests,7);assert.ok(maxActive<=4);
  });
});
test('a failed page discards partial receipts, stops new work and preserves costs from in-flight responses',async()=>{
  let calls=0;
  await run(await pdf(10),async()=>{
    const call=++calls;
    if(call===1)return Response.json({error:{code:'rate_limit_exceeded'}},{status:429});
    await new Promise(resolve=>setTimeout(resolve,15));return response([{kind:'bill'}]);
  },async extract=>{
    await assert.rejects(extract(),error=>{
      assert.equal(error.status,429);assert.equal(error.extractionUsage.estimatedCostUSD,null);
      assert.equal(error.extractionUsage.reportedRequests,3);
      assert.equal(error.extractionUsage.reportedEstimatedCostUSD,.00495);
      return true;
    });
    assert.equal(calls,4);
  });
});
test('invalid and overlong PDFs never call the paid provider',async()=>{
  for(const bytes of [Buffer.from('not a PDF'),await pdf(61)]) {
    let calls=0;
    await run(bytes,async()=>{calls++;return response([]);},async extract=>{
      await assert.rejects(extract(),e=>[400,422].includes(e.status)&&e.extractionUsage===null);
      assert.equal(calls,0);
    });
  }
});
test('history-only pages are omitted but their usage is retained',async()=>{
  await run(await pdf(2),async()=>response([{kind:'history'}]),async extract=>{
    await assert.rejects(extract(),e=>e.status===422&&e.extractionUsage.inputTokens===2000);
  });
});
