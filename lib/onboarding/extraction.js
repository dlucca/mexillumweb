import { receiptSchema, extractionInstructions } from './schema.js';
import { normalizeReceipt } from '../../js/expediente.model.js';
import { clean, fail } from './store.js';

export const DEFAULT_EXTRACTION_MODEL = 'gpt-5.4-mini';
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

export function extractionUsage(response, requestedModel) {
  const usage=response?.usage;
  if(!usage)return null;
  const inputTokens=count(usage.input_tokens), outputTokens=count(usage.output_tokens);
  const cachedInputTokens=count(usage.input_tokens_details?.cached_tokens);
  const reasoningTokens=count(usage.output_tokens_details?.reasoning_tokens);
  // Output tokens already include reasoning. Never charge reasoning twice.
  const priced=['gpt-5.4-mini','gpt-5.4-mini-2026-03-17'].includes(requestedModel);
  const valid=inputTokens!==null && outputTokens!==null && cachedInputTokens!==null && cachedInputTokens<=inputTokens;
  const estimatedCostUSD=priced && valid ? Number(((inputTokens-cachedInputTokens)*.75/1e6+cachedInputTokens*.075/1e6+outputTokens*4.5/1e6).toFixed(8)) : null;
  return {model:clean(response.model||requestedModel,100),requestedModel,inputTokens,outputTokens,cachedInputTokens,reasoningTokens,
    estimatedCostUSD,pricingDate:estimatedCostUSD===null?null:'2026-09-12',serviceTier:'default'};
}

function providerFailure(status,body) {
  const code=body?.error?.code;
  if(status===401 || status===403 || code==='model_not_found')return fail(503,'La lectura automática necesita que Mexillum revise la clave o el acceso al modelo. Tus documentos están guardados.');
  if(code==='insufficient_quota')return fail(503,'La lectura automática está pendiente de saldo o cuota de OpenAI. Tus documentos están guardados; avisa a tu asesor.');
  if(status===429)return fail(429,'El lector está ocupado. Espera unos minutos antes de reintentar. Tus documentos están guardados.');
  return fail(503,'No pudimos leer este archivo automáticamente. Puedes reintentar o continuar con tu asesor.');
}

export async function extractReceipts(file,fileURL) {
  const model=process.env.CFE_EXTRACTION_MODEL||DEFAULT_EXTRACTION_MODEL;
  let usage=null;
  try {
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({model,store:false,service_tier:'default',reasoning:{effort:'low'},instructions:extractionInstructions,
        input:[{role:'user',content:[{type:'input_text',text:'Extrae todos los recibos de este archivo. Respeta valores ilegibles y referencias de página.'},file.mime==='application/pdf'?{type:'input_file',file_url:fileURL,detail:'high'}:{type:'input_image',image_url:fileURL,detail:'high'}]}],
        text:{format:{type:'json_schema',name:'cfe_receipts',strict:true,schema:receiptSchema}},max_output_tokens:24000}),signal:AbortSignal.timeout(230000)});
    const response=await r.json().catch(()=>null);
    if(!r.ok)throw providerFailure(r.status,response);
    usage=extractionUsage(response,model);
    if(response?.status!=='completed')throw fail(503,'La lectura no terminó. Intenta separar el PDF en archivos más pequeños o continúa con tu asesor.');
    const output=response.output?.flatMap(i=>i.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');
    let parsed;try{parsed=JSON.parse(output);}catch{throw fail(503,'La lectura requiere revisión. Intenta de nuevo o continúa con tu asesor.');}
    if(!Array.isArray(parsed?.receipts)||parsed.receipts.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw fail(503,'La lectura requiere revisión. Intenta de nuevo o continúa con tu asesor.');
    if(parsed.receipts.length>100)throw fail(400,'Divide el PDF en grupos de hasta 100 recibos.');
    if(!parsed.receipts.some(r=>r.kind==='bill'))throw fail(422,'No identificamos recibos completos en este archivo. Revisa que las páginas sean legibles y correspondan a recibos de CFE.');
    return {receipts:parsed.receipts.map((r,i)=>normalizeReceipt(r,file.id,i)),notes:Array.isArray(parsed.notes)?parsed.notes.slice(0,15).map(n=>clean(n,500)):[],usage};
  }catch(e) {
    // Provider responses and transport errors may contain signed URLs: never expose them.
    const error=e.status?e:fail(503,'La conexión con el lector no terminó. Tus documentos siguen guardados. Intenta de nuevo.');
    error.extractionUsage=usage;
    throw error;
  }
}
