import {randomUUID} from 'node:crypto';
import {RECEIPT_FIELDS,serviceResolver} from '../../js/expediente.model.js';
export function mergeReadings(previous,incoming,version) {
  const used=new Set(),identity=serviceResolver([...previous,...incoming]);
  const merged=incoming.map(next=>{
    const exact=previous.filter(r=>!used.has(r.id)&&identity(r.service)===identity(next.service)&&r.start===next.start&&r.end===next.end);
    const samePage=previous.filter(r=>!used.has(r.id)&&r.page===next.page);
    const old=exact.length===1?exact[0]:samePage.length===1?samePage[0]:null;
    if(!old)return {...next,id:previous.some(r=>r.id===next.id)?`${next.fileId}:${randomUUID()}`:next.id,extractionVersion:version};
    used.add(old.id);const result={...next,id:old.id,original:old.original,latestOriginal:next.original,excluded:old.excluded,
      correctedFields:[...(old.correctedFields||[])],extractionVersion:version};
    for(const k of Object.keys(RECEIPT_FIELDS))if(old.correctedFields?.includes(k)||(old.reviewed&&old[k]!=null&&old[k]!==''))result[k]=old[k];
    result.reviewed=old.reviewed===true&&Object.keys(RECEIPT_FIELDS).every(k=>result[k]===old[k]);
    result.readingVersions=[...(old.readingVersions||[]),{version:old.extractionVersion||'legacy',values:old.latestOriginal||old.original}].slice(-3);
    return result;
  });
  // Ambiguous/unmatched records remain in the draft, flagged for explicit resolution.
  return [...merged,...previous.filter(r=>!used.has(r.id)).map(r=>({...r,refreshUnmatched:true}))];
}
