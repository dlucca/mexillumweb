// Explicit offline demo for UI testing. No real storage, document processing or email.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import handler from '../api/expediente.js';
import {fakeServices} from '../test/expediente.fake-services.js';
if(!process.argv.includes('--demo'))throw Error('Use --demo. This server uses synthetic data only.');
const mock=fakeServices();globalThis.fetch=mock.fetch;
Object.assign(process.env,{SUPABASE_URL:'https://demo.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'demo-service',OPENAI_API_KEY:'demo-not-real',RESEND_API_KEY:'demo-not-real',ADVISOR_API_KEY:'demo-advisor-key-for-local-tests-only'});
const cwd=resolve(new URL('..',import.meta.url).pathname);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg'};
http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/expediente'){
  const chunks=[];for await(const c of req)chunks.push(c);req.body=JSON.parse(Buffer.concat(chunks).toString()||'{}');
  res.status=c=>{res.statusCode=c;return res;};res.json=b=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(b));};await handler(req,res);return;
 }
 if(url.pathname.startsWith('/demo-upload/')){
  let size=0;for await(const chunk of req)size+=chunk.length;mock.objects.set(url.pathname.slice('/demo-upload/'.length),{size,mime:req.headers['content-type']});res.end('{}');return;
 }
 let path=resolve(cwd,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(cwd+'/')){res.statusCode=403;res.end();return;}
 try{if((await stat(path)).isDirectory())path+='/index.html';}catch{if(!extname(path))path+='.html';}
 let body=await readFile(path);if(extname(path)==='.html')body=Buffer.from(body.toString().replace('<body>','<body><div style="background:#e9c76b;color:#252514;padding:8px;text-align:center;font:14px sans-serif">DEMO LOCAL · datos simulados · no se envían correos</div>'));
 res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.end(body);
 }catch{res.statusCode=404;res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Offline demo at http://127.0.0.1:4173/diagnostico-industria-comercio?rapido'));
