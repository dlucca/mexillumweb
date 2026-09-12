import { simulate, sanitizeSimulation } from './expediente.simulation.js?v=20260912-5';
import { simulationView } from './expediente.simulation-view.js?v=20260912-5';
import { INSTALLATIONS, installationFor, installationValues, installationFields, installationSummary } from './expediente.installations.js';
import { redirectToCanonicalHost } from './expediente.origin.js';
import { RECEIPT_FIELDS, TEXT_FIELDS, number, receiptIssues, summarize, requiredQuestions, recommendations } from './expediente.model.js';
import { mountRoofPicker } from './diagnostico.roof.js';
import { trackDx } from './diagnostico.analytics.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n==null?'Por confirmar':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(n);
const num=n=>n==null?'Por confirmar':new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(n);
const labels=['Recibos','Revisión','Operación','Espacios','Resumen'];
const steps=['receipts','review','operation','map','summary'];
export async function initExpediente({root,content}) {
  if (redirectToCanonicalHost()) return;
  const stylesReady=Promise.all(['/css/expediente.css?v=20260912-5','/css/expediente-summary.css?v=20260912-5'].map(href=>new Promise((resolve,reject)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href=href;css.onload=resolve;css.onerror=()=>reject(new Error('No pudimos cargar el diseño. Recarga la página para intentar de nuevo.'));document.head.append(css);
  })));
  let token=new URLSearchParams(location.hash.slice(1)).get('exp')||'',record=null,busy=false,dirty=false,timer=null,saveChain=Promise.resolve();
  let fileMessages=[],collect=()=>{}, mapCleanup=null;
  if(!token){try{token=localStorage.getItem('mexillum:expediente:token')||'';}catch{}}
  const data=()=>record.data;
  function storeToken(){history.replaceState(null,'',`${location.pathname}${location.search}#exp=${token}`);try{localStorage.setItem('mexillum:expediente:token',token);}catch{}}
  async function call(action,body={}) {
    const r=await fetch('/api/expediente',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({action,revision:record?.revision,...body})});
    const json=await r.json().catch(()=>({error:'No pudimos conectar con tu expediente.'}));
    if(!r.ok){if(json.data)record=json;throw new Error(json.error||'Intenta de nuevo.');}
    if(json.data) {
      if(action==='save' && dirty) { collect(); json.data=record.data; }
      record=json;
    }
    if(json.token){token=json.token;storeToken();}
    return json;
  }
  function message(text,error=false) {
    const node=root.querySelector('[data-message]');if(!node)return;node.textContent=text;node.hidden=!text;node.classList.toggle('exp-error',error);
  }
  function markDirty(){dirty=true;const n=root.querySelector('[data-save]');if(n)n.textContent='Cambios pendientes';clearTimeout(timer);timer=setTimeout(()=>{if(!busy)save().catch(e=>message(e.message,true));},1200);}
  async function save() {
    clearTimeout(timer);collect();
    if(!dirty)return;
    // Capture current state at execution time; all writes in this tab are serialized.
    const task=async()=>{collect();if(!dirty)return;const snapshot=structuredClone(data());dirty=false;try{await call('save',{data:snapshot});const n=root.querySelector('[data-save]');if(n)n.textContent=dirty?'Cambios pendientes':'Avance guardado';}catch(e){dirty=true;throw e;}};
    saveChain=saveChain.catch(()=>{}).then(task);await saveChain;
  }
  async function action(fn) {
    if(busy)return;
    busy=true;root.setAttribute('aria-busy','true');
    const locked=[...root.querySelectorAll('button,input,select,textarea')].filter(n=>!n.disabled);
    locked.forEach(n=>n.disabled=true);message('');
    try{await fn();}catch(e){message(e.message,true);}
    finally{busy=false;root.removeAttribute('aria-busy');locked.filter(n=>n.isConnected).forEach(n=>n.disabled=false);}
  }
  function frame(title,subtitle,body,nav='') {
    mapCleanup?.();mapCleanup=null;collect=()=>{};
    const i=steps.indexOf(data().step);
    root.innerHTML=`<div class="dx__view exp"><div class="exp-topline"><span class="dx__diag-kicker">Tu proyecto con Mexillum</span><span data-save role="status">${dirty?'Cambios pendientes':'Avance guardado'}</span></div>
      <ol class="exp-steps" aria-label="Progreso">${labels.map((l,k)=>`<li ${k===i?'aria-current="step"':''}><span>${k+1}</span>${l}</li>`).join('')}</ol>
      ${data().site?`<p class="exp-site">${esc(data().site)}</p>`:''}<h2 class="dx__question" tabindex="-1" data-focus>${title}</h2><p class="dx__col-sub">${subtitle}</p>
      <p data-message role="status" hidden></p>${body}<nav class="dx__nav exp-nav" aria-label="Pasos del expediente">${nav}</nav>
      <div class="exp-resume"><button type="button" class="dx__skip" data-save-link>Copiar enlace para continuar después</button><p>El enlace permite acceder a tus datos. Compártelo solo con quienes participen en este proyecto.</p></div></div>`;
    root.querySelector('[data-focus]')?.focus({preventScroll:true});window.scrollTo(0,0);
    root.querySelector('[data-save-link]').onclick=()=>action(async()=>{await save();try{await navigator.clipboard.writeText(location.href);message('Enlace copiado. Puedes continuar desde otro dispositivo.');}catch{message('Guarda la dirección de esta página para continuar después.');}});
    root.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>action(async()=>{await save();data().step=b.dataset.nav;dirty=true;await save();render();}));
    root.querySelectorAll('input:not([type=file]),textarea,select').forEach(el=>el.addEventListener('input',markDirty));
  }
  const btn=(step,label,primary=false)=>`<button type="button" class="mx-btn mx-btn--${primary?'primary':'ghost'}" data-nav="${step}">${label}</button>`;
  function receiptStep() {
    frame('Empecemos por tus recibos','Comparte los que tengas. Un solo PDF puede contener varios meses; también puedes subir fotos. Completar 12 meses nos ayuda a ver la estacionalidad.',`
      <div class="exp-consent"><label><input type="checkbox" data-consent ${data().consent?'checked':''}> Autorizo el uso de mis datos y recibos para esta evaluación, incluida su lectura automática con proveedores de procesamiento. <a href="/aviso-de-privacidad" target="_blank" rel="noopener">Aviso de privacidad</a>.</label></div>
      <label class="exp-drop"> <strong>Selecciona o arrastra tus recibos</strong><span>PDF, JPG, PNG o WebP · hasta 25 MB por archivo</span><span class="mx-btn mx-btn--ghost">Elegir archivos</span><input data-file aria-label="Seleccionar recibos" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp"></label>
      <ul class="exp-files">${data().files.map(f=>`<li><div><strong>${esc(f.name)}</strong><span>${esc(({pending:'Subida pendiente',ready:'Recibido · listo para leer',processing:'Lectura en curso',analyzed:'Lectura terminada · revisa los datos',error:'Lectura pendiente de revisión'})[f.status])}</span></div><button class="dx__skip" data-remove="${f.id}" type="button">Quitar</button></li>`).join('')}</ul>
      <p class="exp-note">${data().files.length} archivo(s) en tu expediente. El número de meses se obtiene al leerlos.</p>
      ${!record.extractionEnabled?'<p class="exp-note">La lectura automática aún no está disponible. Puedes compartir tus documentos y continuar; tu asesor los revisará.</p>':''}
      ${fileMessages.map(m=>`<p class="exp-note">${esc(m)}</p>`).join('')}
      <div class="exp-upload-progress" data-upload-progress role="status"></div>
      <button type="button" class="mx-btn mx-btn--primary" data-action="read">${record.extractionEnabled?'Leer recibos y continuar':'Continuar con mis documentos'}</button>`,btn('operation','Los compartiré después'));
    collect=()=>{data().consent=root.querySelector('[data-consent]').checked;};
    async function upload(files) {
      await action(async()=>{
        collect();if(!data().consent)throw new Error('Confirma el uso de los documentos antes de subirlos.');
        dirty=true;await save();fileMessages=[];
        for(const file of files) {
          const progress=root.querySelector('[data-upload-progress]');if(progress)progress.textContent=`Subiendo ${file.name}…`;
          let fileId;
          try {
            const result=await call('upload',{name:file.name,mime:file.type,size:file.size});fileId=result.fileId;
            const r=await fetch(result.uploadURL,{method:'PUT',headers:{'Content-Type':file.type},body:file});if(!r.ok)throw new Error('No se pudo subir el archivo.');
            await call('complete',{fileId});trackDx('receipt_uploaded',{profile_id:content.profile?.id});
          }catch(e){fileMessages.push(`${file.name}: ${e.message}`);if(fileId)try{await call('remove',{fileId});}catch{}}
        }
        render();
      });
    }
    root.querySelector('[data-file]').onchange=e=>upload([...e.target.files]);
    const drop=root.querySelector('.exp-drop');drop.ondragover=e=>e.preventDefault();drop.ondrop=e=>{e.preventDefault();if(!busy)upload([...e.dataTransfer.files]);};
    root.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>action(async()=>{await save();await call('remove',{fileId:b.dataset.remove});render();}));
    root.querySelector('[data-action=read]').onclick=()=>action(async()=>{
      await save();
      if(record.extractionEnabled) {
        const ids=data().files.filter(f=>['ready','error','processing'].includes(f.status)&&f.attempts<3).map(f=>f.id);
        for(let i=0;i<ids.length;i++) {
          message(`Leyendo archivo ${i+1} de ${ids.length}. Un PDF con varios recibos puede tardar unos minutos.`);
          try{await call('analyze',{fileId:ids[i]});}catch(e){fileMessages.push(e.message);}
        }
      }
      data().step=data().receipts.length?'review':fileMessages.length?'receipts':'operation';dirty=true;await save();render();
      if(fileMessages.length)message(fileMessages.join(' '),true);
    });
  }
  function reviewStep() {
    const s=summarize(data().receipts,data().service);
    frame('Esto encontramos en tus recibos','Revisa los datos antes de utilizarlos. Los importes corresponden a los periodos disponibles; todavía no son una estimación de ahorro.',`
      ${s.services.length>1?`<label class="exp-field">Hay varios servicios. Elige el que vamos a evaluar<select data-service><option value="">Seleccionar servicio</option>${s.services.map(v=>`<option ${v===data().service?'selected':''}>${esc(v)}</option>`).join('')}</select></label><p class="exp-note">Los otros recibos se conservan, pero sus consumos no se sumarán a este servicio.</p>`:''}
      <div class="exp-facts"><div><span>Recibos identificados</span><strong>${s.rows.length}</strong></div><div><span>Confirmados y utilizables</span><strong>${s.usable.length}</strong></div><div><span>Total confirmado · con IVA</span><strong>${money(s.total)}</strong></div></div>
      <p class="exp-note">Periodo disponible: ${esc(s.start||'Pendiente')} → ${esc(s.end||'Pendiente')}. ${s.days?`${num(s.days)} días en recibos confirmados.`:''}</p>
      ${s.monthCoverage.length?`<div class="exp-months" aria-label="Cobertura documental por mes">${s.monthCoverage.map(m=>`<span class="${m.complete?'is-covered':''}">${m.month} · ${m.complete?'cubierto':'incompleto'}</span>`).join('')}</div>`:''}
      ${s.duplicates.length?'<p class="exp-error">Hay recibos duplicados. Excluye una copia para evitar contar el mismo consumo dos veces.</p>':''}
      ${s.overlaps.length?'<p class="exp-error">Hay periodos que se superponen. Confirma si se trata de una corrección y excluye el que no corresponda.</p>':''}
      ${s.tariffs.length>1?'<p class="exp-note">Encontramos cambios de tarifa. Se conservará la tarifa de cada periodo.</p>':''}
      ${s.rows.some(r=>!r.reviewed&&!receiptIssues(r).length&&!r.uncertain?.length)?'<button type="button" class="mx-btn mx-btn--ghost" data-confirm-clean>Confirmar lecturas sin alertas</button>':''}
      <div class="exp-receipts">${data().receipts.filter(r=>r.kind==='bill'&&(!s.selected||r.service===s.selected)).map(r=>receiptCard(r)).join('')||'<p>No hay recibos identificados para este servicio. Puedes continuar y completar los datos con tu asesor.</p>'}</div>`,btn('receipts','Atrás')+btn('operation','Continuar con mi operación',true));
    collect=()=>{
      if(root.querySelector('[data-service]'))data().service=root.querySelector('[data-service]').value;
      root.querySelectorAll('[data-receipt]').forEach(card=>{
        const r=data().receipts.find(r=>r.id===card.dataset.receipt);
        card.querySelectorAll('[data-field]').forEach(el=>{r[el.dataset.field]=TEXT_FIELDS.includes(el.dataset.field)?el.value:number(el.value);});
        r.reviewed=card.querySelector('[data-reviewed]').checked;r.excluded=card.querySelector('[data-excluded]').checked;
      });
    };
    root.querySelector('[data-service]')?.addEventListener('change',()=>action(async()=>{dirty=true;await save();render();}));
    root.querySelector('[data-confirm-clean]')?.addEventListener('click',()=>action(async()=>{
      collect(); for(const r of summarize(data().receipts,data().service).rows) if(!receiptIssues(r).length&&!r.uncertain?.length)r.reviewed=true;
      dirty=true; collect=()=>{}; await save(); render();
    }));
    root.querySelectorAll('[data-confirm]').forEach(b=>b.onclick=()=>action(async()=>{collect();dirty=true;await save();render();}));
    root.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>action(async()=>{
      await save();const result=await call('file',{fileId:b.dataset.open});const a=document.createElement('a');a.href=result.url;a.target='_blank';a.rel='noopener noreferrer';a.click();
    }));
  }
  function receiptCard(r) {
    const issues=receiptIssues(r),file=data().files.find(f=>f.id===r.fileId);
    return `<details class="exp-receipt" data-receipt="${esc(r.id)}"><summary><span>${esc(r.start||'Fecha pendiente')} → ${esc(r.end||'Fecha pendiente')}</span><strong>${money(r.total)} · ${num(r.kwh)} kWh</strong><span>${r.excluded?'Excluido':r.reviewed&&!issues.length?'Confirmado':'Por revisar'}</span></summary>
      <p class="exp-source">${esc(file?.name||'Documento')} · página ${r.page||'?'} <button type="button" class="dx__skip" data-open="${r.fileId}">Ver original</button></p>
      ${issues.map(v=>`<p class="exp-error">${esc(v)}</p>`).join('')}
      <p class="exp-note">${esc(r.tariff||'Tarifa pendiente')} · ${num(r.kwh)} kWh · Servicio ${esc(r.service||'pendiente')}. ${r.uncertain?.length?`${r.uncertain.length} campo(s) de lectura dudosa.`:''}</p>
      <details class="exp-edit"><summary>Ver o corregir datos del recibo</summary><div class="exp-fields">${Object.entries(RECEIPT_FIELDS).map(([k,label])=>`<label class="exp-field">${label}${r.uncertain?.includes(k)?' · revisar lectura':''}<input data-field="${k}" ${['start','end'].includes(k)?'type="date"':!TEXT_FIELDS.includes(k)?'type="number" step="any"':'type="text"'} value="${esc(r[k]??'')}"></label>`).join('')}</div></details>
      <div class="exp-checks"><label><input type="checkbox" data-reviewed ${r.reviewed?'checked':''}> Revisé estos datos con el recibo.</label><label><input type="checkbox" data-excluded ${r.excluded?'checked':''}> Excluir este recibo del análisis.</label></div>
      <button class="mx-btn mx-btn--ghost" type="button" data-confirm>Guardar revisión</button></details>`;
  }
  const field=(key,label,type='text',placeholder='')=>`<label class="exp-field">${label}<input name="${key}" type="${type}" ${type==='number'?'min="0" step="any"':''} value="${esc(data().answers[key]??'')}" placeholder="${esc(placeholder)}"></label>`;
  const textarea=(key,label,placeholder)=>`<label class="exp-field">${label}<textarea name="${key}" rows="3" placeholder="${esc(placeholder)}">${esc(data().answers[key]||'')}</textarea></label>`;
  function checks(key,legend,options) {return `<fieldset><legend>${legend}</legend><div class="exp-choices">${options.map(([value,label])=>`<label><input type="checkbox" name="${key}" value="${value}" ${data().answers[key]?.includes(value)?'checked':''}>${label}</label>`).join('')}</div></fieldset>`;}
  function installationField(q) {
    const value=installationValues(data().answers)[q.key];
    if(q.type==='multi')return `<fieldset><legend>${esc(q.label)}</legend><div class="exp-choices">${q.options.map(o=>`<label><input type="checkbox" data-install-field="${q.key}" name="installation_${q.key}" value="${o.value}" ${value?.includes(o.value)?'checked':''}>${esc(o.label)}</label>`).join('')}</div></fieldset>`;
    return `<label class="exp-field">${esc(q.label)}${q.hint?`<span class="exp-note">${esc(q.hint)}</span>`:''}${q.type==='text'?`<textarea data-install-field="${q.key}" rows="3" maxlength="1500">${esc(value||'')}</textarea>`:`<select data-install-field="${q.key}"><option value="">Por confirmar</option>${q.options.map(o=>`<option value="${o.value}" ${value===o.value?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`}</label>`;
  }
  function installationSection() {
    const p=installationFor(data().answers.sector),fields=installationFields(data().answers);
    return p?`<section class="exp-installation" aria-labelledby="installation-heading"><h3 id="installation-heading">${esc(p.title)}</h3><p class="exp-note">Estos datos no aparecen en los recibos. Completa lo que conoces; lo demás puede revisarse con mantenimiento.</p>${fields.filter(q=>!q.when).map(installationField).join('')}<div data-install-dependent>${fields.filter(q=>q.when).map(installationField).join('')}</div></section>`:'<p class="exp-note">Selecciona el tipo de instalación para ver sus preguntas específicas.</p>';
  }
  function scheduleField() {
    const p=installationFor(data().answers.sector);
    return textarea('schedule',p?.scheduleLabel||'Días, horarios y temporadas de actividad',p?.scheduleHint||'Días y horas de operación, turnos y temporadas de menor actividad. Si no lo sabes, déjalo pendiente.');
  }
  function operationStep() {
    const questions=requiredQuestions(data()),a=data().answers;
    frame('Completemos cómo funciona tu instalación','Solo necesitamos lo que no aparece en los recibos. Puedes dejar pendiente cualquier dato que tengas que consultar.',`
      <form class="exp-operation" onsubmit="return false">
      <label class="exp-field">Tipo de instalación<select name="sector"><option value="">Seleccionar</option>${INSTALLATIONS.map(p=>`<option value="${p.sector}" ${a.sector===p.sector?'selected':''}>${p.label}</option>`).join('')}</select></label>
      ${checks('objective','¿Qué quieres mejorar?',[['cost','Reducir el costo de energía'],['continuity','Evitar interrupciones'],['growth','Ampliar capacidad'],['unknown','Quiero orientación']])}
      <div data-schedule>${scheduleField()}</div>
      ${checks('equipment','¿Qué equipos tienen hoy?',[['solar','Paneles solares'],['battery','Baterías'],['generator','Planta de emergencia'],['ups','UPS'],['none','Ninguno'],['unknown','No lo sé']])}
      <label class="exp-field">¿Este servicio abastece toda la instalación?<select name="scope"><option value="">Por confirmar</option>${['Sí, toda la instalación','Solo una parte; hay otros medidores','No lo sé'].map(v=>`<option ${a.scope===v?'selected':''}>${v}</option>`).join('')}</select></label>
      ${questions.includes('manualTariff')?`<div class="exp-manual"><p>Mientras revisamos tus recibos, puedes completar estos datos si los conoces.</p><label class="exp-field">Tarifa o suministro<select name="manualTariff"><option value="">No lo sé</option>${['GDMTH','GDMTO','GDBT','PDBT','DIST','DIT','Suministrador privado','Sin conexión a la red'].map(v=>`<option ${a.manualTariff===v?'selected':''}>${v}</option>`).join('')}</select></label>${field('manualBill','Pago mensual aproximado (MXN)','number','Monto, no un rango')}</div>`:''}
      <div data-installation>${installationSection()}</div>
      ${textarea('quality','Cortes o variaciones de voltaje que debamos conocer','Si ocurren, describe qué equipos o actividades afectan. Si no lo sabes, puedes dejarlo pendiente.')}
      <div data-conditional>${conditionalFields(questions)}</div>
      </form>`,btn(data().receipts.length?'review':'receipts','Atrás')+btn('map','Continuar a espacios',true));
    // Keep separate answers for each installation; switching never relabels prior answers.
    let displayedProfile=installationFor(a.sector)?.id;
    collect=()=>{
      const f=root.querySelector('form');if(!f)return;
      if(displayedProfile){data().answers.installations||={};const values=data().answers.installations[displayedProfile]||={};
        const fields=f.querySelectorAll('[data-install-field]');const multiKeys=new Set();
        fields.forEach(el=>{const key=el.dataset.installField;if(el.type==='checkbox')multiKeys.add(key);else values[key]=el.value;});
        for(const key of multiKeys)values[key]=[...f.querySelectorAll(`[data-install-field="${key}"]:checked`)].map(el=>el.value);
      }
      f.querySelectorAll('input[name]:not([type=checkbox]):not([data-install-field]),select[name],textarea[name]').forEach(el=>data().answers[el.name]=el.name==='manualBill'?number(el.value):el.value);
      for(const k of ['objective','equipment'])data().answers[k]=[...f.querySelectorAll(`input[name=${k}]:checked`)].map(el=>el.value);
    };
    const form=root.querySelector('form');
    form.addEventListener('input',markDirty);
    form.addEventListener('change',e=>{
      const el=e.target;
      if(el.type==='checkbox'){
        const exclusive=el.dataset.installField?['ninguna','nolose']:el.name==='equipment'?['none','unknown']:['unknown'];
        if(el.checked)form.querySelectorAll(`input[name="${el.name}"]`).forEach(other=>{if(other!==el&&(exclusive.includes(el.value)||exclusive.includes(other.value)))other.checked=false;});
      }
      collect();
      if(el.name==='sector'){
        displayedProfile=installationFor(data().answers.sector)?.id;
        root.querySelector('[data-installation]').innerHTML=installationSection();
        root.querySelector('[data-schedule]').innerHTML=scheduleField();
      }
      if(['objective','equipment'].includes(el.name))root.querySelector('[data-conditional]').innerHTML=conditionalFields(requiredQuestions(data()));
      if(['objective','equipment'].includes(el.name)||el.dataset.installField==='criticalLoads'){
        const dependent=root.querySelector('[data-install-dependent]');
        if(dependent)dependent.innerHTML=installationFields(data().answers).filter(q=>q.when).map(installationField).join('');
      }
      markDirty();
    });
  }
  function conditionalFields(q) {return `${q.includes('outage')?textarea('outage','Qué debe seguir funcionando durante un corte','Indica equipos o servicios críticos y cuánto tiempo deben operar. Puedes describir un corte reciente.'):''}${q.includes('growth')?textarea('growth','Qué planean ampliar','Nuevos equipos, edificios, cargadores o capacidad prevista.'):''}${q.includes('solar')?textarea('solar','Qué conoces del sistema solar actual','Capacidad instalada, generación del inversor o si hay excedentes. Puedes completarlo después.'):''}`;}
  function mapStep() {
    const hasCost=data().answers.objective?.includes('cost'), allowRoof=hasCost || data().answers.objective?.includes('unknown') || data().answers.equipment?.includes('solar') || !data().answers.objective?.length;
    frame('Ubica tu instalación y los espacios disponibles',allowRoof?'Confirma la dirección y marca las áreas donde podríamos evaluar paneles. No necesitas medidas exactas; puedes completarlo con mantenimiento después.':'Confirma la ubicación de tu instalación. Si lo conoces, también puedes marcar el medidor o punto eléctrico.',`
      <div data-map></div><div data-area-types></div>
      <p class="exp-note">La superficie marcada es candidata. Su disponibilidad, estructura y sombras se revisan antes de diseñar el sistema.</p>`,btn('operation','Atrás')+btn('summary','Ver simulación',true));
    const types=()=>{
      const n=data().roof?.poligonos?.length||0;
      root.querySelector('[data-area-types]').innerHTML=Array.from({length:n},(_,i)=>`<label class="exp-field">Área ${i+1}<select data-area="${i}">${[['otro','Tipo por confirmar'],['techo','Techo'],['estacionamiento','Estacionamiento'],['terreno','Terreno']].map(([v,l])=>`<option value="${v}" ${(data().roof?.types?.[i]||'otro')===v?'selected':''}>${l}</option>`).join('')}</select></label>`).join('');
      root.querySelectorAll('[data-area]').forEach(el=>el.onchange=()=>{data().roof.types||=[];data().roof.types[Number(el.dataset.area)]=el.value;markDirty();});
    };
    mapCleanup=mountRoofPicker(root.querySelector('[data-map]'),{
      allowRoof,initial:{location:data().location,roof:data().roof,servicePoint:data().servicePoint,address:data().address||summarize(data().receipts,data().service).usable[0]?.address||''},
      onLocation:location=>{data().location=location;markDirty();},onRoof:roof=>{data().roof={...roof,types:data().roof?.types||[]};types();markDirty();},onServicePoint:p=>{data().servicePoint=p;markDirty();}
    });types();
  }
  function summaryStep() {
    const s=summarize(data().receipts,data().service),d=data(),simulation=simulate(d);
    const pendingEvaluations=recommendations(d).filter(r=>!simulation.source.ready||!['Solar y autoconsumo','Revisión con tu asesor'].includes(r.name));
    frame('Tu consumo y las opciones de ahorro','Explora una simulación preliminar con tus recibos y ajusta los supuestos antes de revisarla con tu asesor.',`
      ${simulationView(simulation)}
      <details class="exp-dossier"><summary>Estado del expediente <span>${s.pending.length} recibos por revisar</span></summary>
      ${record.submittedAt?'<p class="exp-success">Solicitud enviada. Tu asesor ya recibió el aviso para revisar este expediente.</p>':''}
      <div class="exp-facts"><div><span>Periodo disponible</span><strong class="exp-small">${esc(s.start||'Pendiente')} → ${esc(s.end||'Pendiente')}</strong></div><div><span>Importe confirmado · con IVA</span><strong>${money(s.total)}</strong></div><div><span>Consumo confirmado</span><strong>${num(s.kwh)}${s.kwh!=null?' kWh':''}</strong></div></div>
      <dl class="exp-list"><dt>Documentos</dt><dd>${d.files.filter(f=>f.status!=='pending').length} archivos · ${s.usable.length} recibos confirmados</dd><dt>Tarifa confirmada</dt><dd>${esc(s.tariffs.join(', ')||'Pendiente')}</dd><dt>Datos por revisar</dt><dd>${s.pending.length} recibos · ${s.duplicates.length} duplicados · ${s.overlaps.length} periodos superpuestos</dd><dt>Espacios candidatos</dt><dd>${d.roof?.area_m2?`~${num(d.roof.area_m2)} m²`:'Pendientes'}</dd><dt>Certeza del ahorro</dt><dd>${simulation.source.ready?'Escenario preliminar disponible arriba. La validación técnica requiere revisar los recibos y la curva de demanda.':'Completa los datos indicados arriba para calcular un escenario.'}</dd></dl>
      </details>${pendingEvaluations.length?`<details class="exp-operation-summary"><summary>Otras evaluaciones pendientes</summary><p class="exp-note">Estos temas requieren datos adicionales y no están calculados en los escenarios de arriba.</p><div class="exp-recommendations">${pendingEvaluations.map(r=>`<article><h4>${esc(r.name)}</h4><span>${esc(r.status)}</span><p>${esc(r.reason)}</p></article>`).join('')}</div></details>`:''}
      ${installationFor(d.answers.sector)?`<details class="exp-operation-summary"><summary>Datos de ${esc(installationFor(d.answers.sector).label.toLowerCase())}</summary><dl class="exp-list"><dt>${esc(installationFor(d.answers.sector).scheduleLabel||'Horarios y temporadas')}</dt><dd>${esc(d.answers.schedule||'Por confirmar')}</dd>${installationSummary(d.answers).map(item=>`<dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd>`).join('')}</dl></details>`:''}
      <h3>Contacto para la revisión</h3><div class="exp-fields"><label class="exp-field">Nombre<input data-contact="name" autocomplete="name" value="${esc(d.contact.name||'')}"></label><label class="exp-field">Correo<input type="email" data-contact="email" autocomplete="email" value="${esc(d.contact.email||'')}"></label><label class="exp-field">Empresa o institución<input data-contact="company" autocomplete="organization" value="${esc(d.contact.company||'')}"></label><label class="exp-field">Nombre de la instalación<input data-site value="${esc(d.site||'')}"></label></div>
      <label class="exp-consent"><input data-consent type="checkbox" ${d.consent?'checked':''}> Autorizo a Mexillum a utilizar estos datos para evaluar y dar seguimiento a mi proyecto. <a href="/aviso-de-privacidad" target="_blank" rel="noopener">Aviso de privacidad</a>.</label>
      <button class="mx-btn mx-btn--primary" type="button" data-action="submit">${record.submittedAt?'Guardar actualización':'Solicitar revisión del asesor'}</button>`,btn('map','Atrás')+btn('receipts','Agregar más recibos'));
    collect=()=>{const settings={priceSource:data().simulation?.priceSource};root.querySelectorAll('[data-sim]').forEach(el=>{if(el.value!==''&&el.checkValidity())settings[el.dataset.sim]=Number(el.value);});if(root.querySelector('[data-sim]'))data().simulation=sanitizeSimulation(settings);root.querySelectorAll('[data-contact]').forEach(el=>data().contact[el.dataset.contact]=el.value.trim());data().site=root.querySelector('[data-site]').value.trim();data().consent=root.querySelector('[data-consent]').checked;};
    root.querySelector('[data-sim-recalculate]')?.addEventListener('click',()=>{
      const end=root.querySelector('[data-sim=peakEnd]'),start=root.querySelector('[data-sim=peakStart]');end.setCustomValidity(Number(end.value)<=Number(start.value)?'La hora final debe ser posterior a la inicial.':'');
      const invalid=[...root.querySelectorAll('[data-sim]')].find(el=>!el.checkValidity());if(invalid){invalid.reportValidity();return;}
      return action(async()=>{dirty=true;await save();render();root.querySelector('#simulation-title')?.scrollIntoView({block:'start'});});
    });
    root.querySelector('[data-sim-reset]')?.addEventListener('click',()=>action(async()=>{collect();data().simulation={...data().simulation,manual:0};delete data().simulation.solarKw;delete data().simulation.batteryKwh;delete data().simulation.batteryKw;collect=()=>{};dirty=true;await save();render();}));
    root.querySelectorAll('[data-sim]').forEach(el=>el.addEventListener('input',()=>{if(['solarKw','batteryKwh','batteryKw'].includes(el.dataset.sim))root.querySelector('[data-sim=manual]').value='1';if(['basePrice','intermediatePrice','peakPrice'].includes(el.dataset.sim)){delete data().simulation?.priceSource;root.querySelector('[data-sim=tariffSet]').value='1';}root.querySelector('[data-sim=peakEnd]')?.setCustomValidity('');root.querySelector('[data-sim-dirty]').textContent='Supuestos cambiados. Pulsa Recalcular simulación para actualizar los resultados.';}));
    root.querySelector('[data-action=submit]').onclick=()=>action(async()=>{dirty=true;await save();if(!record.submittedAt){await call('submit');trackDx('expediente_submitted',{profile_id:content.profile?.id,receipts:s.usable.length});}render();message('Tu expediente quedó guardado para revisión.');});
  }
  function render(){({receipts:receiptStep,review:reviewStep,operation:operationStep,map:mapStep,summary:summaryStep}[data().step]||receiptStep)();}
  window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
  root.innerHTML='<p class="dx__col-sub" role="status">Abriendo tu expediente…</p>';
  try {
    await stylesReady;
    if(token){await call('read');storeToken();}
    else await call('create');
    trackDx('expediente_opened',{profile_id:content.profile?.id});render();
  }catch(e){root.innerHTML=`<div class="dx__view"><h2 class="dx__question">No pudimos abrir el expediente</h2><p role="alert">${esc(e.message)}</p><p>Tu asesor puede ayudarte a recuperar el acceso.</p><button class="mx-btn mx-btn--ghost" data-retry>Intentar de nuevo</button></div>`;root.querySelector('[data-retry]').onclick=()=>location.reload();}
}
