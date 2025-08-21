import { formatDate, monthNameAr } from './utils.js';
function aoaToSheet(aoa){
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=[{wch:48},{wch:14},{wch:16}];
  // تنسيق رؤوس الجدول
  const hdr="A1:C1";
  const range=XLSX.utils.decode_range(ws['!ref']||'A1');
  // اجعل المحاذاة RTL حيثما أمكن
  for(let R=range.s.r;R<=range.e.r;R++){
    for(let C=range.s.c;C<=range.e.c;C++){
      const cell=XLSX.utils.encode_cell({r:R,c:C});
      if(!ws[cell]) continue;
      ws[cell].s=ws[cell].s||{};
      ws[cell].s.alignment={horizontal: C===0?'right':'center', vertical:'center', readingOrder:2, wrapText:true};
      if(R===0){
        ws[cell].s.fill={fgColor:{rgb:"E8F0FE"}}; // أزرق فاتح
        ws[cell].s.font={bold:true,color:{rgb:"0F172A"}};
        ws[cell].s.border={top:{style:'thin',color:{rgb:'CBD5E1'}},bottom:{style:'thin',color:{rgb:'CBD5E1'}},left:{style:'thin',color:{rgb:'CBD5E1'}},right:{style:'thin',color:{rgb:'CBD5E1'}}};
      }
    }
  }
  return ws;
}
function saveWorkbook(wb,file){XLSX.writeFile(wb,file,{compression:true})}
export const exportExcel={
  bankSide(bankName,sideLabel,rows,month,year){
    const header=[[`البنك: ${bankName}`],[`الجانب: ${sideLabel}`]];
    const table=[["البيان","التاريخ","المبلغ"],...rows.map(r=>[r.description,formatDate(r.date),r.amount])];
    const wb=XLSX.utils.book_new();
    const ws=aoaToSheet([...header,[],...table]);
    XLSX.utils.book_append_sheet(wb,ws,sideLabel);
    const file=`${bankName} - ${String(month).padStart(2,'0')} - ${monthNameAr(month-1)} - ${year}.xlsx`;
    saveWorkbook(wb,file);
  },
  bankMonth(bank,month,year,debitRows,creditRows,totals){
    const wb=XLSX.utils.book_new();
    const summary=[["البنك",bank.name],["الشهر",`${String(month).padStart(2,'0')} - ${monthNameAr(month-1)} - ${year}`],["إجمالي مدين",totals.totalDebit],["إجمالي دائن",totals.totalCredit],["الرصيد",totals.balance]];
    const sWS=XLSX.utils.aoa_to_sheet(summary); sWS['!cols']=[{wch:20},{wch:32}];
    XLSX.utils.book_append_sheet(wb,sWS,'ملخص');
    const debit=aoaToSheet([["البيان","التاريخ","المبلغ"],...debitRows.map(r=>[r.description,formatDate(r.date),r.amount])]);
    const credit=aoaToSheet([["البيان","التاريخ","المبلغ"],...creditRows.map(r=>[r.description,formatDate(r.date),r.amount])]);
    XLSX.utils.book_append_sheet(wb,debit,'مدين');
    XLSX.utils.book_append_sheet(wb,credit,'دائن');
    const file=`${bank.name} - ${String(month).padStart(2,'0')} - ${monthNameAr(month-1)} - ${year}.xlsx`;
    saveWorkbook(wb,file);
  },
  fiscalYear(summary){
    const wb=XLSX.utils.book_new();
    const header=[[`سنة مالية ${summary.label}`]];
    const table=[["البنك","إجمالي مدين","إجمالي دائن","الرصيد","عدد القيود"],...summary.perBank.map(r=>[r.bankName,r.totalDebit,r.totalCredit,r.balance,r.count])];
    const ws=aoaToSheet([...header,[],...table]);
    XLSX.utils.book_append_sheet(wb,ws,'الملخص');
    const file=`أرصدة البنوك - سنة مالية ${summary.label}.xlsx`;
    saveWorkbook(wb,file);
  }
};
export const backup={async exportJSON(db){const database=await db.open();const dump=name=>new Promise((res,rej)=>{const r=database.transaction([name]).objectStore(name).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)});const [banks,entries,settings]=await Promise.all([dump('banks'),dump('entries'),dump('settings')]);const payload={version:1,exportedAt:new Date().toISOString(),banks,entries,settings};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`bank-ledger-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url)},async importJSON(db,file){const text=await file.text();let payload;try{payload=JSON.parse(text)}catch{throw new Error('ملف JSON غير صالح')}if(!payload||!Array.isArray(payload.banks)||!Array.isArray(payload.entries)||!Array.isArray(payload.settings)) throw new Error('هيكل النسخة الاحتياطية غير صحيح');const database=await db.open();await new Promise((res,rej)=>{const t=database.transaction(['banks','entries','settings'],'readwrite');t.objectStore('banks').clear();t.objectStore('entries').clear();t.objectStore('settings').clear();t.oncomplete=res;t.onerror=()=>rej(t.error)});await new Promise((res,rej)=>{const t=database.transaction(['banks','entries','settings'],'readwrite');payload.banks.forEach(b=>t.objectStore('banks').add(b));payload.entries.forEach(e=>t.objectStore('entries').add(e));payload.settings.forEach(s=>t.objectStore('settings').put(s));t.oncomplete=res;t.onerror=()=>rej(t.error)})}};export default {exportExcel,backup};

