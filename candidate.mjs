import {skillMention} from './lib.mjs';
const catalog=['JavaScript','TypeScript','Python','Java','C#','C++','Go','Rust','PHP','Kotlin','Swift','Dart','React','Angular','Vue','Node.js','Next.js','.NET','Django','Flask','FastAPI','Spring','Laravel','SQL','PostgreSQL','MySQL','MongoDB','Redis','AWS','Azure','GCP','Docker','Kubernetes','Terraform','Git','Linux','GraphQL','REST','HTML','CSS','Tailwind','Playwright','Cypress','Selenium','Jest','Pytest','CI/CD'];
export function cvSkills(value){const raw=String(value||'');return catalog.filter(skill=>skill==='Go'?/\bGo\b/.test(raw)||/\bgolang\b/i.test(raw):skillMention(raw.toLowerCase(),skill.toLowerCase()));}
export function compareCv(job,cv){
 const mentioned=cvSkills(cv?.text),raw=[job.title,job.description,...(job.tags||[])].join(' '),hay=raw.toLowerCase();
 const shared=mentioned.filter(s=>s==='Go'?/\bGo\b/.test(raw)||/\bgolang\b/i.test(raw):skillMention(hay,s.toLowerCase()));
 return {mentioned,shared,count:shared.length,total:mentioned.length,score:mentioned.length?Math.round(shared.length/mentioned.length*100):null};
}
