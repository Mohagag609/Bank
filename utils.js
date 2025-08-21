export const AR_MONTHS=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
export function monthNameAr(i){return AR_MONTHS[i]||""}
export function formatMoney(v){if(v==null||Number.isNaN(v))return"0.00";try{return Number(v).toLocaleString('ar-EG',{style:'currency',currency:'EGP',maximumFractionDigits:2});}catch{return `${Number(v).toFixed(2)} ج.م`;}}
export function parseMoney(s){if(typeof s==='number')return s;const n=parseFloat(String(s||'').replace(/[^\d.\-\.]/g,''));return Number.isNaN(n)?0:n}
export function formatDate(iso){if(!iso)return'';const d=new Date(iso);if(Number.isNaN(d.getTime()))return'';const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
export function fiscalRangeFor(dateNow,startMonth=7,endMonth=6){const d=new Date(dateNow),year=d.getFullYear(),m=d.getMonth()+1;let sy,ey;if(m>=startMonth){sy=year;ey=year+1}else{sy=year-1;ey=year}const s=new Date(sy,startMonth-1,1),e=new Date(ey,endMonth-1,30,23,59,59,999);return{startISO:formatDate(s.toISOString()),endISO:formatDate(e.toISOString()),label:`${sy}/${ey}`}}
export function monthRange(y,mi){const s=new Date(y,mi,1),e=new Date(y,mi+1,0,23,59,59,999);return{startISO:formatDate(s.toISOString()),endISO:formatDate(e.toISOString())}}
export function sumBy(arr,sel){return arr.reduce((a,x)=>a+(sel(x)||0),0)}
export function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
export function calculateBankBalance(opening,entries){const td=sumBy(entries.filter(e=>e.type==='debit'),e=>e.amount),tc=sumBy(entries.filter(e=>e.type==='credit'),e=>e.amount);return{totalDebit:td,totalCredit:tc,balance:Number(opening||0)+td-tc}}

