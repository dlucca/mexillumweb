// Preview by default. --apply deletes only expired drafts and their registered objects.
import {db,storage} from '../lib/onboarding/store.js';
const apply=process.argv.includes('--apply');
const rows=await db(`prospect_expedientes?expires_at=lt.${encodeURIComponent(new Date().toISOString())}&select=id,data&limit=100`);
console.log(`${rows.length} expedientes vencidos. ${apply?'Eliminando…':'Vista previa; usa --apply para eliminar.'}`);
if(apply)for(const row of rows){
 const paths=(row.data.files||[]).map(f=>f.path).filter(p=>p.startsWith(row.id+'/'));
 if(paths.length)await storage('object/expediente-files',{method:'DELETE',body:JSON.stringify({prefixes:paths})});
 await db(`prospect_expedientes?id=eq.${row.id}`,{method:'DELETE'});
}
if(apply)await db(`expediente_rate_limits?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`,{method:'DELETE'});
