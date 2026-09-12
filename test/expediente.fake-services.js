// Local development fixture; never imported by production code. All data is synthetic.
export function fakeServices(){
 const rows=new Map(),objects=new Map();
 const ok=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
 const fetch=async(input,o={})=>{
  const u=new URL(input),body=o.body?JSON.parse(o.body):{};
  if(u.pathname.endsWith('/rpc/expediente_rate_limit'))return ok(true);
  if(u.pathname==='/rest/v1/prospect_expedientes'){
   if(o.method==='POST'){rows.set(body.id,body);return ok([structuredClone(body)]);}
   let list=[...rows.values()].filter(r=>!u.searchParams.has('token_hash')||'eq.'+r.token_hash===u.searchParams.get('token_hash')).filter(r=>!u.searchParams.has('id')||'eq.'+r.id===u.searchParams.get('id'));
   if(o.method==='PATCH'){list=list.filter(r=>'eq.'+r.revision===u.searchParams.get('revision'));list.forEach(r=>Object.assign(r,body));}return ok(structuredClone(list));
  }
  if(u.pathname.includes('/object/upload/sign/')) return ok({url:'http://127.0.0.1:4173/demo-upload/'+u.pathname.split('/expediente-files/')[1]});
  if(u.pathname.includes('/object/sign/'))return ok({signedURL:'/object/sign/expediente-files/demo.pdf'});
  if(o.method==='HEAD'){const obj=objects.get(u.pathname.split('/expediente-files/')[1]);return new Response(null,{status:obj?200:404,headers:obj?{'content-length':String(obj.size),'content-type':obj.mime}:{}});}
  if(o.method==='DELETE'){body.prefixes.forEach(k=>objects.delete(k));return ok([]);}
  if(u.hostname==='api.openai.com'){
   const base={kind:'bill',service:'DEMO-001',holder:'Campus de demostración',address:'Dirección de demostración',tariff:'GDMTH',subtotal:27899.19,total:32363.06,kwh:9854,base:1440,intermediate:7405,peak:1009,demand:47,peakDemand:21,capacity:8442.21,distribution:1759.68,uncertain:[]};
   const receipts=[{...base,page:1,start:'2026-01-31',end:'2026-02-28'},{...base,page:3,start:'2026-02-28',end:'2026-03-31'}];
   return ok({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({receipts,notes:['Datos de demostración.']})}]}]});
  }
  if(u.hostname==='api.resend.com')return ok({id:'demo-not-sent'});
  throw Error('Demo blocked outgoing request: '+u.hostname);
 };
 return {fetch,rows,objects};
}
