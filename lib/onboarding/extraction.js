import { PDFDocument } from 'pdf-lib';
import { receiptSchema, extractionInstructions, EXTRACTION_VERSION } from './schema.js';
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

const MAX_PDF_BYTES=25*1024*1024, MAX_PAGES=60, CONCURRENCY=4;

async function pdfPages(fileURL,signal) {
  const response=await fetch(fileURL,{signal});
  if(!response.ok)throw fail(503,'No pudimos recuperar el PDF guardado. Intenta de nuevo.');
  const chunks=[];let size=0;
  for await(const chunk of response.body) {
    size+=chunk.length;
    if(size>MAX_PDF_BYTES)throw fail(400,'El PDF supera el límite de 25 MB.');
    chunks.push(chunk);
  }
  let pdf;
  try{pdf=await PDFDocument.load(Buffer.concat(chunks),{updateMetadata:false});}
  catch{throw fail(422,'No pudimos abrir el PDF. Revisa que sea válido y no tenga contraseña.');}
  const pages=pdf.getPageCount();
  if(!pages || pages>MAX_PAGES)throw fail(400,'Divide el PDF en archivos de hasta 60 páginas.');
  return {pages,async content(index) {
    const part=await PDFDocument.create();
    const [page]=await part.copyPages(pdf,[index]);part.addPage(page);
    const bytes=await part.save();
    return {type:'input_file',filename:`pagina-${index+1}.pdf`,file_data:`data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`,detail:'high'};
  }};
}

// Null means unknown, including a request that failed without usage information.
function combinedUsage(records,model) {
  const known=records.filter(Boolean);
  if(!known.length)return null;
  const sum=key=>records.every(r=>r?.[key]!=null)?Number(records.reduce((n,r)=>n+r[key],0).toFixed(8)):null;
  return {...known[0],model:[...new Set(known.map(r=>r.model))].join(','),requestedModel:model,
    ...Object.fromEntries(['inputTokens','outputTokens','cachedInputTokens','reasoningTokens','estimatedCostUSD'].map(k=>[k,sum(k)])),
    requests:records.length,reportedRequests:known.length,
    reportedEstimatedCostUSD:known.every(r=>r.estimatedCostUSD!=null)?Number(known.reduce((n,r)=>n+r.estimatedCostUSD,0).toFixed(8)):null};
}

export function normalizeExtractedReceipt(raw,fileId,index){
  const derived=raw.kwhSource==='sum_of_bands'&&['base','intermediate','peak'].every(k=>typeof raw[k]==='number'&&Number.isFinite(raw[k])&&raw[k]>=0&&!(raw.uncertain||[]).includes(k));
  const r=normalizeReceipt(derived?{...raw,kwh:raw.base+raw.intermediate+raw.peak,uncertain:(raw.uncertain||[]).filter(k=>k!=='kwh')}:raw,fileId,index);
  if(raw._crossChecks?.length)r.automaticChecks=raw._crossChecks;
  if(derived){r.derivedFields=['kwh'];r.derivations={kwh:{method:'sum_of_bands',fields:['base','intermediate','peak'],providerValue:raw.kwh}};}
  return r;
}

export async function extractReceipts(file,fileURL) {
  const model=process.env.CFE_EXTRACTION_MODEL||DEFAULT_EXTRACTION_MODEL;
  const signal=AbortSignal.timeout(230000),usages=[];
  try {
    const pdf=file.mime==='application/pdf'?await pdfPages(fileURL,signal):null;
    const pageCount=pdf?.pages||1,results=new Array(pageCount);
    let next=0,firstError=null;
    async function readPage(content,confirmation=false){
          const slot=usages.length;usages.push(null);
          const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
            body:JSON.stringify({model,store:false,service_tier:'default',reasoning:{effort:'medium'},
              instructions:extractionInstructions+(confirmation?'\nRealiza una segunda lectura independiente, verificando cuidadosamente cada cifra y etiqueta de la imagen.':'')+'\nRecibes UNA SOLA página aislada. Extrae únicamente las carátulas visibles en ella. Si es reverso, histórico o desglose de subperiodos, devuelve receipts: []. No reconstruyas carátulas de otras páginas ni periodos vecinos. Verifica cada fecha e importe contra esta imagen antes de responder.',
              input:[{role:'user',content:[{type:'input_text',text:'Lee esta página. No completes valores usando secuencias supuestas; marca como incierto cualquier dato ilegible.'},content]}],
              text:{format:{type:'json_schema',name:'cfe_receipts',strict:true,schema:receiptSchema}},max_output_tokens:6000}),signal});
          const body=await response.json().catch(()=>null);
          if(!response.ok)throw providerFailure(response.status,body);
          usages[slot]=extractionUsage(body,model);
          if(body?.status!=='completed')throw fail(503,'La lectura no terminó. Intenta separar el PDF en archivos más pequeños o continúa con tu asesor.');
          const output=body.output?.flatMap(i=>i.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');
          let parsed;try{parsed=JSON.parse(output);}catch{throw fail(503,'La lectura requiere revisión. Intenta de nuevo o continúa con tu asesor.');}
          if(!Array.isArray(parsed?.receipts)||parsed.receipts.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw fail(503,'La lectura requiere revisión. Intenta de nuevo o continúa con tu asesor.');
      return parsed;
    }
    async function worker() {
      while(!firstError && next<pageCount) {
        const index=next++;
        try {
          signal.throwIfAborted();
          const content=pdf?await pdf.content(index):{type:'input_image',image_url:fileURL,detail:'high'};
          let parsed=await readPage(content);
          if(parsed.receipts.some(r=>(r.uncertain||[]).some(k=>r[k]!=null&&r[k]!=='')||(r.kind==='bill'&&r.tariff==='GDMTH'&&['base','intermediate','peak'].some(k=>r[k]==null)))){
            const second=await readPage(content,true);
            parsed.receipts=parsed.receipts.map((raw,i)=>{
              const matches=second.receipts.filter(r=>r.service===raw.service&&r.start===raw.start&&r.end===raw.end);
              const other=matches.length===1?matches[0]:parsed.receipts.length===1&&second.receipts.length===1?second.receipts[0]:null;
              if(!other)return raw;
              const a=normalizeExtractedReceipt(raw,file.id,i),b=normalizeExtractedReceipt(other,file.id,i);
              const confirmed=(raw.uncertain||[]).filter(k=>a[k]!=null&&a[k]!==''&&a[k]===b[k]&&!(b.uncertain||[]).includes(k));
              const recovered=['base','intermediate','peak'].filter(k=>raw[k]==null&&typeof other[k]==='number'&&other[k]>=0&&!(other.uncertain||[]).includes(k));
              const out={...raw,...Object.fromEntries(recovered.map(k=>[k,other[k]])),uncertain:(raw.uncertain||[]).filter(k=>!confirmed.includes(k)&&!recovered.includes(k)),_crossChecks:[...(confirmed.length?[{method:'independent_second_read',fields:confirmed}]:[]),...(recovered.length?[{method:'recovered_in_second_read',fields:recovered}]:[])]};
              if(recovered.length&&raw.kwh==null&&other.kwhSource==='sum_of_bands')out.kwhSource='sum_of_bands';
              return out;
            });
          }
          results[index]={receipts:parsed.receipts.filter(r=>r.kind==='bill').map(r=>({...r,page:index+1})),
            notes:Array.isArray(parsed.notes)?parsed.notes.map(n=>`Página ${index+1}: ${clean(n,450)}`):[]};
        }catch(error){firstError ||= error;}
      }
    }
    // Let already-started requests settle so their costs are recorded on failure too.
    await Promise.all(Array.from({length:Math.min(CONCURRENCY,pageCount)},worker));
    if(firstError)throw firstError;
    const receipts=results.flatMap(r=>r.receipts);
    if(receipts.length>100)throw fail(400,'Divide el PDF en grupos de hasta 100 recibos.');
    if(!receipts.length)throw fail(422,'No identificamos recibos completos en este archivo. Revisa que las páginas sean legibles y correspondan a recibos de CFE.');
    return {version:EXTRACTION_VERSION,receipts:receipts.map((r,i)=>normalizeExtractedReceipt(r,file.id,i)),notes:results.flatMap(r=>r.notes).slice(0,15),usage:combinedUsage(usages,model)};
  }catch(e) {
    const error=e.status?e:fail(503,'La conexión con el lector no terminó. Tus documentos siguen guardados. Intenta de nuevo.');
    error.extractionUsage=combinedUsage(usages,model);
    throw error;
  }
}
