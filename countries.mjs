// Country choices are local data; setup never detects location from an IP address.
const codes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const names=new Intl.DisplayNames(['en'],{type:'region'});
export const countries=codes.map(code=>({code,name:code==='TR'?'Türkiye':names.of(code)})).sort((a,b)=>a.name.localeCompare(b.name));
const presets={
 UM:{aliases:['United States Minor Outlying Islands']},GS:{aliases:['South Georgia and the South Sandwich Islands']},
 CY:{cities:['Nicosia','Limassol','Larnaca','Paphos','Famagusta'],aliases:['Pafos','Lefkosia','Κύπρος'],zones:[2]},
 GR:{cities:['Athens','Thessaloniki','Patras','Heraklion'],aliases:['Greece','Ελλάδα'],zones:[2]},
 GB:{cities:['London','Manchester','Birmingham','Edinburgh','Bristol','Leeds'],aliases:['UK','U.K.','Great Britain','England','Scotland','Wales','Northern Ireland'],zones:[0]},
 US:{cities:['New York','San Francisco','Seattle','Boston','Austin','Chicago','Los Angeles'],aliases:['USA','U.S.','U.S.A.','United States of America'],zones:[-10,-9,-8,-7,-6,-5]},
 CA:{cities:['Toronto','Vancouver','Montreal','Ottawa','Calgary'],zones:[-8,-7,-6,-5,-4,-3.5]},
 DE:{cities:['Berlin','Munich','Hamburg','Frankfurt','Cologne'],aliases:['Deutschland','München'],zones:[1]},
 FR:{cities:['Paris','Lyon','Marseille','Toulouse'],zones:[1]},IE:{cities:['Dublin','Cork','Galway'],zones:[0]},
 NL:{cities:['Amsterdam','Rotterdam','Utrecht','Eindhoven'],zones:[1]},ES:{cities:['Madrid','Barcelona','Valencia','Malaga'],zones:[0,1]},
 PT:{cities:['Lisbon','Porto'],zones:[-1,0]},IT:{cities:['Rome','Milan','Turin'],zones:[1]},PL:{cities:['Warsaw','Krakow','Wroclaw'],zones:[1]},
 AU:{cities:['Sydney','Melbourne','Brisbane','Perth','Adelaide','Canberra'],zones:[8,8.75,9.5,10,10.5,11]},NZ:{cities:['Auckland','Wellington','Christchurch'],zones:[12,12.75]},
 IN:{cities:['Bengaluru','Bangalore','Mumbai','Hyderabad','Pune','New Delhi'],zones:[5.5]},SG:{cities:['Singapore'],zones:[8]},
 AE:{cities:['Dubai','Abu Dhabi'],aliases:['UAE'],zones:[4]},ZA:{cities:['Cape Town','Johannesburg','Pretoria'],zones:[2]},
 BR:{cities:['São Paulo','Rio de Janeiro'],zones:[-5,-4,-3,-2]},MX:{cities:['Mexico City','Guadalajara','Monterrey'],zones:[-8,-7,-6]},
 SE:{cities:['Stockholm','Gothenburg'],zones:[1]},NO:{cities:['Oslo','Bergen'],zones:[1]},DK:{cities:['Copenhagen','Aarhus'],zones:[1]},FI:{cities:['Helsinki','Espoo'],zones:[2]},
 CH:{cities:['Zurich','Zürich','Geneva','Basel'],zones:[1]},AT:{cities:['Vienna','Graz'],zones:[1]},BE:{cities:['Brussels','Antwerp'],zones:[1]},
 RO:{cities:['Bucharest','Cluj-Napoca'],zones:[2]},BG:{cities:['Sofia','Plovdiv'],zones:[2]},CZ:{cities:['Prague','Brno'],aliases:['Czech Republic'],zones:[1]},
 MT:{cities:['Valletta','Sliema'],zones:[1]},TR:{cities:['Istanbul','Ankara'],aliases:['Turkey'],zones:[3]},JP:{cities:['Tokyo','Osaka'],zones:[9]},
 KR:{cities:['Seoul'],aliases:['Republic of Korea'],zones:[9]},PH:{cities:['Manila','Cebu'],zones:[8]},PK:{cities:['Karachi','Lahore','Islamabad'],zones:[5]}
};
const groups={
 Europe:'AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA',
 EU:'AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK',
 'North America':'CA US MX',
 'Latin America':'AR BO BR BZ CL CO CR CU DO EC GT GY HN HT MX NI PA PE PY SR SV UY VE',
 Asia:'AF AM AZ BD BN BT CN GE HK ID IN JP KG KH KP KR KZ LA LK MM MN MO MV MY NP PH PK SG TH TJ TL TM TW UZ VN',
 'Middle East':'AE BH CY IL IQ IR JO KW LB OM PS QA SA SY TR YE',
 Africa:'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW',
 Oceania:'AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS'
};
export const countryCode=value=>codes.includes(String(value||'').toUpperCase())?String(value).toUpperCase():'CY';
export function countryInfo(value){const code=countryCode(value),base=countries.find(c=>c.code===code),preset=presets[code]||{};return {...base,cities:[],aliases:[],zones:[],...preset,regions:Object.entries(groups).filter(([,members])=>members.split(' ').includes(code)).map(([name])=>name)};}
const escaped=s=>s.replace(/[.*+?^{}$()|[\]\\]/g,'\\$&');
const patterns=new Map();
const countryTerms=countries.flatMap(c=>[c.name,...(presets[c.code]?.aliases||[])].map(name=>({code:c.code,name}))).sort((a,b)=>b.name.length-a.name.length);
const contains=(text,term)=>{if(!patterns.has(term))patterns.set(term,new RegExp('(^|[^\\p{L}\\p{N}])'+escaped(term)+'(?=$|[^\\p{L}\\p{N}])','iu'));return patterns.get(term).test(text);};
export function explicitCountries(location){
 const text=String(location||''),explicit=[];let remaining=text;
 for(const term of countryTerms)if(contains(remaining,term.name)){explicit.push(term);remaining=remaining.replace(new RegExp(escaped(term.name),'giu'),match=>'#'.repeat(match.length));}
 return [...new Set(explicit.map(term=>term.code))];
}
export function countryListed(location,code='CY'){
 const c=countryInfo(code),text=String(location||'');
 // Prefer explicit country names over a city shared by countries (e.g. London, Canada).
 const explicit=explicitCountries(text);
 if(explicit.length)return explicit.includes(c.code);
 const parts=text.split(/[,;/|()]/).map(s=>s.trim());
 if(parts.includes(c.code))return true;
 return [c.name,...c.aliases,...c.cities].some(term=>contains(text,term));
}
export function regionListed(location,code='CY'){
 const regions=countryInfo(code).regions,text=String(location||'');
 return regions.some(r=>contains(text,r))||regions.includes('EU')&&contains(text,'European Union')||regions.some(r=>['Europe','Middle East','Africa'].includes(r))&&contains(text,'EMEA')||regions.some(r=>['Asia','Oceania'].includes(r))&&contains(text,'APAC')||regions.includes('Latin America')&&contains(text,'LATAM')||regions.some(r=>['North America','Latin America'].includes(r))&&contains(text,'Americas');
}
export const normalizeArea=area=>['local','Cyprus'].includes(area)?'local':['remote','Remote'].includes(area)?'remote':'local_remote';
export function normalizeCountryPreferences(p={}){return {...p,country:countryCode(p.country),area:normalizeArea(p.area),model:typeof p.model==='string'?p.model:''};}
export function countryCoverage(code){const c=countryInfo(code);return c.code==='CY'?'Cyprus employer feeds + international remote feeds. Local coverage is partial.':'International remote feeds filtered for '+c.name+'. Local employer coverage is limited; add careers links to your watchlist.';}
