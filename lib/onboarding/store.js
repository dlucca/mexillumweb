import {sanitizeSimulation} from '../../js/expediente.simulation-settings.js';
import {EXTRACTION_VERSION} from './schema.js';
import { sanitizeInstallations, INSTALLATIONS } from '../../js/expediente.installations.js';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
export const fail = (status,message) => Object.assign(new Error(message),{status});
export const clean = (v,n=500) => typeof v==='string'?v.trim().slice(0,n):'';
export function bearer(req) { return String(req.headers?.authorization||'').replace(/^Bearer /,''); }
export function tokenHash(token) {
  if(!/^[a-f0-9]{64}$/.test(token)) throw fail(401,'El enlace no es válido. Pide uno nuevo a tu asesor.');
  return createHash('sha256').update(token).digest('hex');
}
export function isAdvisor(req) {
  const key=process.env.ADVISOR_API_KEY||'', actual=bearer(req);
  return key.length>=32 && actual.length===key.length && timingSafeEqual(Buffer.from(actual),Buffer.from(key));
}
export function config() {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key) throw fail(503,'El expediente aún no está disponible. Contacta a tu asesor.');
  return {url:url.replace(/\/$/,''),headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'}};
}
export async function db(path,options={}) {
  const c=config();
  const r=await fetch(`${c.url}/rest/v1/${path}`,{...options,headers:{...c.headers,...options.headers},signal:AbortSignal.timeout(15000)});
  if(!r.ok) throw fail(503,'No pudimos guardar o recuperar el expediente. Intenta de nuevo.');
  return r.status===204?null:r.json();
}
export async function read(token) {
  const rows=await db(`prospect_expedientes?token_hash=eq.${tokenHash(token)}&select=*`);
  const row=rows?.[0];
  if(!row || new Date(row.expires_at)<new Date()) throw fail(404,'Este enlace venció o no existe. Pide uno nuevo a tu asesor.');
  return row;
}
export async function write(row,data,extra={}) {
  const rows=await db(`prospect_expedientes?id=eq.${row.id}&revision=eq.${row.revision}`,{
    method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({data,revision:row.revision+1,updated_at:new Date().toISOString(),...extra})});
  if(!rows?.length) throw fail(409,'El expediente cambió en otra ventana. Recarga antes de continuar; tus cambios locales siguen visibles.');
  return rows[0];
}
export async function create(body,advisor) {
  const token=randomBytes(32).toString('hex');
  const contact=advisor?{name:clean(body.contact?.name,120),email:clean(body.contact?.email,200),company:clean(body.contact?.company,200)}:{};
  const installation=INSTALLATIONS.find(p=>p.id===body.installation);
  const data={step:'receipts',contact,site:advisor?clean(body.site,200):'',address:advisor?clean(body.address,500):'',answers:advisor?sanitizeAnswers(body.answers):(installation?{sector:installation.sector}:{}),files:[],receipts:[],service:'',roof:null,location:null,servicePoint:null,consent:false};
  const row={id:randomUUID(),token_hash:tokenHash(token),revision:0,data,created_by:advisor?'advisor':'guest',expires_at:new Date(Date.now()+30*86400000).toISOString()};
  const rows=await db('prospect_expedientes',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
  return {token,row:rows[0]};
}
export function sanitizeAnswers(a={}) {
  const out={};
  for(const k of ['region','loadShape','operationStart','operationEnd','offHoursPct','weekendPct'])if(k in sanitizeSimulation(a))out[k]=sanitizeSimulation(a)[k];
  for(const k of ['sector','schedule','scope','manualTariff','outage','growth','solar','quality']) out[k]=clean(a[k],1000);
  if(typeof a.noSolarSpace==='boolean')out.noSolarSpace=a.noSolarSpace;
  out.manualBill=typeof a.manualBill==='number' && a.manualBill>=0 && Number.isFinite(a.manualBill)?a.manualBill:null;
  out.objective=Array.isArray(a.objective)?a.objective.filter(v=>['cost','continuity','growth','unknown'].includes(v)):[];
  out.equipment=Array.isArray(a.equipment)?a.equipment.filter(v=>['solar','battery','generator','ups','none','unknown'].includes(v)):[];
  out.installations=sanitizeInstallations(a.installations);
  return out;
}
export function publicRow(row) {return {id:row.id,revision:row.revision,data:row.data,expiresAt:row.expires_at,submittedAt:row.submitted_at||null,extractionVersion:EXTRACTION_VERSION,extractionEnabled:!!process.env.OPENAI_API_KEY};}
export async function storage(path,options={}) {
  const c=config();
  const r=await fetch(`${c.url}/storage/v1/${path}`,{...options,headers:{...c.headers,...options.headers},signal:AbortSignal.timeout(20000)});
  if(!r.ok) {
    let reason='unknown';
    try {
      const body=await r.clone().json();
      const provider=String(body?.code||body?.message||body?.error||'');
      if(/NoSuchBucket|Bucket not found/i.test(provider)) reason='bucket_missing';
      else if(/EmptyRequestBody|EMPTY_JSON_BODY|empty.*body|body.*empty/i.test(provider)) reason='empty_body';
      else if(/AccessDenied|InvalidJWT|Unauthorized|permission/i.test(provider)) reason='access_denied';
    } catch {}
    // Never log provider text: it can contain object paths or signed URLs.
    console.error(`[expediente] Supabase Storage failed (${r.status}); reason=${reason}`);
    throw fail(503,'El almacenamiento de recibos no está disponible en este momento. Tu expediente permanece guardado.');
  }
  return r;
}
