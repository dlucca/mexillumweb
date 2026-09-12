import { redirectToCanonicalHost } from './expediente.origin.js';

if (!redirectToCanonicalHost()) {
 const form=document.querySelector('#advisor'),status=document.querySelector('#status');
 form.addEventListener('submit',async e=>{
 e.preventDefault();const values=Object.fromEntries(new FormData(form));const button=form.querySelector('button');button.disabled=true;status.textContent='Preparando expediente…';
 try{
 const r=await fetch('/api/expediente',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${values.key}`},body:JSON.stringify({action:'create',advisor:true,contact:{name:values.name,email:values.email,company:values.company},site:values.site,address:values.address,answers:{sector:values.sector,schedule:values.schedule,objective:values.objective?[values.objective]:[]}})});
 const result=await r.json();if(!r.ok)throw new Error(result.error||'No pudimos preparar el expediente.');
 const link=new URL('/diagnostico-industria-comercio?rapido',location.origin);link.hash=`exp=${result.token}`;
 const a=document.querySelector('#link');a.textContent=link.href;a.href=link.href;document.querySelector('#result').hidden=false;status.textContent='Enlace listo. Válido durante 30 días.';
 document.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(link.href);status.textContent='Enlace copiado.';}catch{status.textContent='Selecciona y copia el enlace.';}};
 }catch(err){status.textContent=err.message;}finally{button.disabled=false;}
 });
}
