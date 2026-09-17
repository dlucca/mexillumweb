import { redirectToCanonicalHost } from './expediente.origin.js?v=20260916-1';
import { expedienteLinks } from './expediente.entry.js?v=20260916-1';

if (!redirectToCanonicalHost()) {
 const form=document.querySelector('#advisor'),status=document.querySelector('#status');
 form.addEventListener('submit',async e=>{
 e.preventDefault();const values=Object.fromEntries(new FormData(form));const button=form.querySelector('button');button.disabled=true;status.textContent='Preparando expediente…';
 try{
 const r=await fetch('/api/expediente',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${values.key}`},body:JSON.stringify({action:'create',advisor:true,contact:{name:values.name,email:values.email,company:values.company},site:values.site,address:values.address,answers:{sector:values.sector,objective:values.objective?[values.objective]:[]}})});
 const result=await r.json();if(!r.ok)throw new Error(result.error||'No pudimos preparar el expediente.');
 const links=expedienteLinks(location.origin,result.token);
 for(const [kind,href] of Object.entries(links)){const a=document.querySelector(`[data-link="${kind}"]`);a.textContent=href;a.href=href;
  document.querySelector(`[data-copy="${kind}"]`).onclick=async()=>{try{await navigator.clipboard.writeText(href);status.textContent='Enlace copiado.';}catch{status.textContent='Selecciona y copia el enlace.';}};}
 document.querySelector('#result').hidden=false;status.textContent='Enlaces listos. Válidos durante 30 días.';
 }catch(err){status.textContent=err.message;}finally{button.disabled=false;}
 });
}
