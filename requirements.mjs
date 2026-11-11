import {jobBlocks} from './description.mjs';
// Surface evidence for review. These mentions never establish candidate eligibility.
export function applicationRequirements(job){
 const sentences=jobBlocks(job).flatMap(block=>block.items||[block.text||'']).flatMap(text=>text.split(/(?<=[.!?])\s+|\n+/)).map(text=>text.trim()).filter(Boolean);
 const groups=[
  {id:'authorization',label:'Work authorization',pattern:/\bright to work\b|\bwork (?:authori[sz]ation|permit|visa)s?\b|\blegally (?:eligible|authori[sz]ed) to work\b/i},
  {id:'sponsorship',label:'Visa sponsorship',pattern:/\b(?:visa|immigration) sponsorship\b|\bsponsor(?:ship|ing)?\b[^.!?]{0,40}\b(?:visa|immigration)\b/i},
  {id:'language',label:'Language expectations',pattern:/\b(?:fluent|fluency|proficien(?:t|cy)|native[- ](?:level|speaker)|(?:written|spoken|business)\s+(?:English|Greek|German|French|Spanish|Russian|Italian|Arabic|Portuguese|Dutch|Polish)|(?:English|Greek|German|French|Spanish|Russian|Italian|Arabic|Portuguese|Dutch|Polish)\s+(?:language|(?:is\s+)?(?:required|preferred|essential)))\b/i}
 ];
 return groups.map(group=>({...group,evidence:[...new Set(sentences.filter(text=>group.pattern.test(text)&& (group.id!=='language'||/\b(?:English|Greek|German|French|Spanish|Russian|Italian|Arabic|Portuguese|Dutch|Polish|languages?)\b/i.test(text))))].slice(0,3)})).filter(group=>group.evidence.length).map(({id,label,evidence})=>({id,label,evidence}));
}
