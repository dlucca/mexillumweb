import {SourceTextModule,createContext} from 'node:vm';
import {readFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
// Parse/link ESM with browser URL rules: no node_modules fallback or import map.
// No browser automation, DOM, network requests or production writes are performed.
const root=resolve(process.argv[2]||'.'),context=createContext({console,self:{}}),cache=new Map();
async function load(url){
 const id=url.href;if(cache.has(id))return cache.get(id);
 const path=fileURLToPath(url),rel=relative(root,path);
 if(rel.startsWith('..'))throw Error('Import escaped project root');
 const pending=readFile(path,'utf8').then(code=>new SourceTextModule(code,{context,identifier:id}));
 cache.set(id,pending);return pending;
}
for(const name of ['js/expediente.app.js','js/expediente.simulation-worker.js','js/expediente.pdf.js']){
const entry=await load(pathToFileURL(resolve(root,name)));
await entry.link((specifier,parent)=>{
 if(!specifier.startsWith('./')&&!specifier.startsWith('../'))throw Error(`Browser cannot resolve package import: ${specifier}`);
 return load(new URL(specifier,parent.identifier));
});
await entry.evaluate();
}
console.log(`Linked ${cache.size} browser modules without package resolution`);
