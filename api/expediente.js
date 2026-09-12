import { sanitizeSimulation } from '../js/expediente.simulation-settings.js';
import { installationSummary } from '../js/expediente.installations.js';
import { createHash, randomUUID } from 'node:crypto';
import { bearer, tokenHash, isAdvisor, clean, fail, read, write, create, publicRow, db, storage, config, sanitizeAnswers } from '../lib/onboarding/store.js';
import { extractReceipts } from '../lib/onboarding/extraction.js';
import { RECEIPT_FIELDS, TEXT_FIELDS, number, summarize, recommendations } from '../js/expediente.model.js';
const MIME={'application/pdf':['pdf'],'image/jpeg':['jpg','jpeg'],'image/png':['png'],'image/webp':['webp']};
const MAX_BYTES=25*1024*1024, MAX_FILES=36, MAX_TOTAL=250*1024*1024, MAX_RECEIPTS=150;
const steps=['receipts','review','operation','map','summary'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function quota(req,action,limit,seconds) {
  const ip=String(req.headers?.['x-forwarded-for']||req.headers?.['x-real-ip']||'local').split(',')[0].trim();
  const key=createHash('sha256').update(`${process.env.SUPABASE_SERVICE_ROLE_KEY}:${action}:${ip}`).digest('hex');
  if(!await db('rpc/expediente_rate_limit',{method:'POST',body:JSON.stringify({p_key:key,p_limit:limit,p_seconds:seconds})})) throw fail(429,'Se alcanzó el límite de solicitudes. Intenta más tarde.');
}
function coordinates(v) {
  return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Math.abs(v.lat)<=90 && Math.abs(v.lng)<=180 ? {lat:v.lat,lng:v.lng}:null;
}
function saveData(previous,patch) {
  const d={...previous};
  if(steps.includes(patch.step)) d.step=patch.step;
  if('simulation' in patch)d.simulation=sanitizeSimulation(patch.simulation);
  if(patch.contact) d.contact={name:clean(patch.contact.name,120),email:clean(patch.contact.email,200),company:clean(patch.contact.company,200)};
  for(const k of ['site','address','service']) if(k in patch) d[k]=clean(patch[k],500);
  if(patch.answers) d.answers=sanitizeAnswers(patch.answers);
  if(typeof patch.consent==='boolean') d.consent=patch.consent;
  if(Array.isArray(patch.receipts)) {
    // Keep immutable model values, page references and provenance on the server.
    const changes=new Map(patch.receipts.slice(0,MAX_RECEIPTS).map(r=>[r.id,r]));
    d.receipts=previous.receipts.map(old=>{
      const change=changes.get(old.id); if(!change)return old;
      const next={...old,reviewed:change.reviewed===true,excluded:change.excluded===true};
      for(const key of Object.keys(RECEIPT_FIELDS)) if(key in change) next[key]=TEXT_FIELDS.includes(key)?clean(change[key],500):number(change[key]);
      next.tariff=next.tariff.toUpperCase();next.service=next.service.replace(/\s/g,'');
      next.correctedFields=Object.keys(RECEIPT_FIELDS).filter(k=>next[k]!==old.original[k]);
      return next;
    });
  }
  if('location' in patch) d.location=coordinates(patch.location)?{...coordinates(patch.location),direccion:clean(patch.location.direccion,500)}:null;
  if('servicePoint' in patch) d.servicePoint=coordinates(patch.servicePoint)?{...coordinates(patch.servicePoint),tipo:clean(patch.servicePoint.tipo,60),precision:clean(patch.servicePoint.precision,30),capacidad_kva:number(patch.servicePoint.capacidad_kva)}:null;
  if('roof' in patch) {
    const polys=Array.isArray(patch.roof?.poligonos)?patch.roof.poligonos.slice(0,30).map(p=>Array.isArray(p)?p.slice(0,150).map(coordinates).filter(Boolean):[]).filter(p=>p.length>=3):[];
    d.roof=polys.length?{area_m2:Math.max(0,Math.min(number(patch.roof?.area_m2)||0,1e7)),poligonos:polys,types:Array.isArray(patch.roof.types)?patch.roof.types.slice(0,30).map(v=>['techo','estacionamiento','terreno','otro'].includes(v)?v:'otro'):[]}:null;
  }
  return d;
}
async function signedFile(file) {
  const r=await storage(`object/sign/expediente-files/${file.path}`,{method:'POST',body:JSON.stringify({expiresIn:300})});
  const body=await r.json();
  const u=body.signedURL||body.signedUrl;
  if(!u)throw fail(502,'No pudimos abrir el archivo.');
  return u.startsWith('http')?u:`${config().url}${u.startsWith('/storage/v1/')?'':'/storage/v1'}${u}`;
}
async function verifyUpload(file) {
  const r=await storage(`object/expediente-files/${file.path}`,{method:'HEAD'});
  const size=Number(r.headers.get('content-length'));
  const mime=(r.headers.get('content-type')||'').split(';')[0];
  if(!Number.isFinite(size)||size<=0||size>MAX_BYTES||size!==file.size||mime!==file.mime) throw fail(400,'El archivo recibido no coincide con el elegido. Elimínalo y vuelve a subirlo.');
}
async function extract(file) {
  return extractReceipts(file,await signedFile(file));
}
async function submit(row,token) {
  const d=row.data;
  if(!d.contact?.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contact?.email||''))throw fail(400,'Agrega tu nombre y un correo válido para solicitar la revisión.');
  if(!d.consent)throw fail(400,'Confirma el uso de tus datos para esta evaluación.');
  if(!process.env.RESEND_API_KEY)throw fail(503,'Tu expediente está guardado; el aviso al asesor aún no está disponible.');
  if(row.submitted_at)return row;
  const s=summarize(d.receipts,d.service);
  const money=n=>n==null?'Pendiente':`$${n.toLocaleString('es-MX',{maximumFractionDigits:2})} MXN`;
  const origin=process.env.PUBLIC_SITE_URL||'https://www.mexillum.com';
  const link=`${origin.replace(/\/$/,'')}/diagnostico-industria-comercio?rapido#exp=${token}`;
  const text=[`Expediente para revisión: ${d.site||d.contact.company||'Instalación'}`,`Contacto: ${d.contact.name} <${d.contact.email}>`,
    `Archivos recibidos: ${d.files.filter(f=>f.status!=='pending').length}; recibos identificados: ${d.receipts.filter(r=>r.kind==='bill').length}; recibos confirmados utilizables: ${s.usable.length}`,
    `Servicio: ${s.selected||'Por confirmar'}`,`Periodo disponible: ${s.start||'?'} a ${s.end||'?'}`,`Importe confirmado del periodo (con IVA): ${money(s.total)}`,
    `Duplicados: ${s.duplicates.length}; solapamientos: ${s.overlaps.length}; pendientes de revisión: ${s.pending.length}`,
    `Operación: ${JSON.stringify({...d.answers,installations:undefined})}`, ...installationSummary(d.answers).map(item=>`${item.label}: ${item.value}`),`Áreas candidatas: ${d.roof?.area_m2?Math.round(d.roof.area_m2)+' m²':'Pendiente'}`,
    ...recommendations(d).map(r=>`${r.name}: ${r.status}. ${r.reason}`),
    'Ahorro y tamaño de equipos pendientes de simulación. No se ha generado una cotización.',`Abrir expediente confidencial: ${link}`].join('\n');
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`expediente-${row.id}`},body:JSON.stringify({
    from:process.env.LEAD_FROM||'Mexillum Web <notificaciones@mexillum.com>',to:process.env.LEAD_TO||'info@mexillum.com',reply_to:d.contact.email,subject:`Expediente para revisión — ${d.site||d.contact.company||d.contact.name}`,text,html:`<pre style="white-space:pre-wrap;font-family:sans-serif">${esc(text)}</pre>`}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw fail(502,'Tu avance está guardado, pero no pudimos avisar al asesor. Intenta enviar de nuevo.');
  return write(row,d,{submitted_at:new Date().toISOString()});
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método no permitido.'});}
  try {
    let b=req.body; if(typeof b==='string'){if(b.length>600000)throw fail(413,'El expediente es demasiado grande.');try{b=JSON.parse(b);}catch{throw fail(400,'Solicitud inválida.');}}
    if(!b||typeof b!=='object'||Array.isArray(b))throw fail(400,'Solicitud inválida.');
    if(JSON.stringify(b).length>600000)throw fail(413,'El expediente es demasiado grande.');
    const action=b.action;
    if(action==='create') {
      const advisor=isAdvisor(req);
      if(b.advisor&&!advisor)throw fail(401,'La clave de asesor no es válida.');
      await quota(req,'create',advisor?60:6,3600);
      const made=await create(b,advisor);
      return res.status(201).json({...publicRow(made.row),token:made.token});
    }
    const token=bearer(req); tokenHash(token);
    let row=await read(token);
    if(action==='read')return res.status(200).json(publicRow(row));
    if(b.revision!==row.revision)throw fail(409,'El expediente cambió en otra ventana. Recarga antes de continuar; tus cambios locales siguen visibles.');
    const d=structuredClone(row.data);
    if(action==='save') {
      row=await write(row,saveData(d,b.data||{}));
    } else if(action==='upload') {
      if(!d.consent)throw fail(400,'Confirma el uso de los documentos antes de subirlos.');
      const mime=clean(b.mime,80), name=clean(b.name,160), size=Number(b.size), ext=name.split('.').at(-1)?.toLowerCase();
      if(!MIME[mime]?.includes(ext))throw fail(400,'Usa PDF, JPG, PNG o WebP. Convierte HEIC a JPG antes de subirlo.');
      if(!Number.isFinite(size)||size<=0||size>MAX_BYTES)throw fail(400,'Cada archivo puede pesar hasta 25 MB.');
      if(d.files.length>=MAX_FILES || d.files.reduce((n,f)=>n+f.size,0)+size>MAX_TOTAL)throw fail(400,'Se alcanzó el límite del expediente (36 archivos o 250 MB).');
      const id=randomUUID(),path=`${row.id}/${id}.${ext}`;
      const signed=await (await storage(`object/upload/sign/expediente-files/${path}`,{method:'POST',body:'{}'})).json();
      const raw=signed.url||signed.signedURL;
      if(!raw)throw fail(502,'No pudimos preparar la subida.');
      const uploadURL=raw.startsWith('http')?raw:`${config().url}${raw.startsWith('/storage/v1/')?'':'/storage/v1'}${raw}`;
      d.files.push({id,path,name,mime,size,status:'pending',attempts:0,createdAt:new Date().toISOString()});
      row=await write(row,d);
      return res.status(200).json({...publicRow(row),fileId:id,uploadURL});
    } else if(['complete','remove','file','analyze'].includes(action)) {
      const file=d.files.find(f=>f.id===b.fileId); if(!file)throw fail(404,'Archivo no encontrado.');
      if(action==='file')return res.status(200).json({url:await signedFile(file)});
      if(action==='complete') {await verifyUpload(file);if(file.status==='pending')file.status='ready';row=await write(row,d);}
      if(action==='remove') {
        if(file.status==='processing' && Date.now()-Date.parse(file.startedAt)<260000)throw fail(409,'Espera a que termine la lectura antes de eliminar el archivo.');
        await storage('object/expediente-files',{method:'DELETE',body:JSON.stringify({prefixes:[file.path]})});
        d.files=d.files.filter(f=>f.id!==file.id);d.receipts=d.receipts.filter(r=>r.fileId!==file.id);row=await write(row,d);
      }
      if(action==='analyze') {
        if(!d.consent)throw fail(400,'Confirma el uso de tus documentos para la lectura.');
        if(!process.env.OPENAI_API_KEY)throw fail(503,'La lectura automática todavía no está habilitada. Tus documentos están guardados y puedes continuar.');
        if(file.status==='analyzed')return res.status(200).json(publicRow(row));
        if(file.status==='pending')throw fail(400,'Termina la subida del archivo primero.');
        if(file.status==='processing'&&Date.now()-Date.parse(file.startedAt)<260000)throw fail(409,'La lectura sigue en curso. Espera y actualiza el expediente.');
        if(file.attempts>=3)throw fail(429,'Este archivo necesita revisión del asesor. Ya se intentó leer tres veces.');
        await quota(req,'analyze',40,3600);await verifyUpload(file);
        file.status='processing';file.startedAt=new Date().toISOString();file.attempts++;
        row=await write(row,d);
        let result,error;try{result=await extract(file);}catch(e){error=e;}
        const usage=result?.usage||error?.extractionUsage;
        const usageRecord=usage?{...usage,attempt:file.attempts,completedAt:new Date().toISOString()}:null;
        // Merge against fresh state; concurrent form edits must not disappear.
        for(let attempt=0;attempt<3;attempt++) {
          const latest=await read(token),current=latest.data.files.find(f=>f.id===file.id);
          if(!current)throw fail(409,'El archivo ya no está en el expediente.');
          if(result && latest.data.receipts.filter(r=>r.fileId!==file.id).length+result.receipts.length>MAX_RECEIPTS){error=fail(400,'Se alcanzó el límite de 150 lecturas del expediente. Tu asesor puede revisar los documentos restantes.');result=null;}
          current.status=error?'error':'analyzed';current.error=error?error.message:'';
          if(usageRecord)current.extractionUsage=[...(current.extractionUsage||[]).filter(u=>u.attempt!==usageRecord.attempt),usageRecord];
          if(result){latest.data.receipts=[...latest.data.receipts.filter(r=>r.fileId!==file.id),...result.receipts];current.notes=result.notes;}
          try{row=await write(latest,latest.data);break;}catch(e){if(e.status!==409||attempt===2)throw e;}
        }
        if(error)return res.status(error.status||502).json({error:error.message,...publicRow(row)});
      }
    } else if(action==='submit') {row=await submit(row,token);}
    else throw fail(400,'Acción no válida.');
    return res.status(200).json(publicRow(row));
  } catch(e) {
    // No source documents, signed URLs, tokens or provider responses in logs.
    return res.status(e.status||500).json({error:e.status?e.message:'No pudimos completar esta acción. Tu avance anterior sigue guardado.'});
  }
}
