// التصدير إلى Excel + نسخ احتياطي/استعادة JSON
import { formatDate, monthNameAr } from './utils.js';

function aoaToSheet(aoa) {
	const ws = XLSX.utils.aoa_to_sheet(aoa);
	ws['!cols'] = [ { wch: 40 }, { wch: 14 }, { wch: 16 } ];
	return ws;
}

function saveWorkbook(wb, fileName) {
	XLSX.writeFile(wb, fileName, { compression: true });
}

export const exportExcel = {
	bankSide(bankName, sideLabel, rows, month, year) {
		const header = [[`البنك: ${bankName}`],[`الجانب: ${sideLabel}`]];
		const table = [["البيان","التاريخ","المبلغ"]];
		for (const r of rows) table.push([r.description, formatDate(r.date), r.amount]);
		const wb = XLSX.utils.book_new();
		const ws = aoaToSheet([...header, [], ...table]);
		XLSX.utils.book_append_sheet(wb, ws, sideLabel);
		const fileName = `${bankName} - ${String(month).padStart(2,'0')} - ${monthNameAr(month-1)} - ${year}.xlsx`;
		saveWorkbook(wb, fileName);
	},
	bankMonth(bank, month, year, debitRows, creditRows, totals) {
		const wb = XLSX.utils.book_new();
		const summary = [
			["البنك", bank.name],
			["الشهر", `${String(month).padStart(2,'0')} - ${monthNameAr(month-1)} - ${year}`],
			["إجمالي مدين", totals.totalDebit],
			["إجمالي دائن", totals.totalCredit],
			["الرصيد", totals.balance]
		];
		XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'ملخص');
		const debitSheet = aoaToSheet([["البيان","التاريخ","المبلغ"], ...debitRows.map(r=>[r.description, formatDate(r.date), r.amount])]);
		const creditSheet = aoaToSheet([["البيان","التاريخ","المبلغ"], ...creditRows.map(r=>[r.description, formatDate(r.date), r.amount])]);
		XLSX.utils.book_append_sheet(wb, debitSheet, 'مدين');
		XLSX.utils.book_append_sheet(wb, creditSheet, 'دائن');
		const fileName = `${bank.name} - ${String(month).padStart(2,'0')} - ${monthNameAr(month-1)} - ${year}.xlsx`;
		saveWorkbook(wb, fileName);
	},
	fiscalYear(summary) {
		const wb = XLSX.utils.book_new();
		const header = [[`سنة مالية ${summary.label}`]];
		const table = [["البنك","إجمالي مدين","إجمالي دائن","الرصيد","عدد القيود"]];
		for (const row of summary.perBank) table.push([row.bankName, row.totalDebit, row.totalCredit, row.balance, row.count]);
		XLSX.utils.book_append_sheet(wb, aoaToSheet([...header, [], ...table]), 'الملخص');
		const fileName = `أرصدة البنوك - سنة مالية ${summary.label}.xlsx`;
		saveWorkbook(wb, fileName);
	}
};

export const backup = {
	async exportJSON(db) {
		const database = await db.open();
		const dumpStore = (name) => new Promise((resolve, reject) => {
			const t = database.transaction([name]);
			const req = t.objectStore(name).getAll();
			req.onsuccess = () => resolve(req.result || []);
			req.onerror = () => reject(req.error);
		});
		const [banks, entries, settings] = await Promise.all([
			dumpStore('banks'), dumpStore('entries'), dumpStore('settings')
		]);
		const payload = { version: 1, exportedAt: new Date().toISOString(), banks, entries, settings };
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `bank-ledger-backup-${new Date().toISOString().slice(0,10)}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	},
	async importJSON(db, file) {
		const text = await file.text();
		let payload;
		try { payload = JSON.parse(text); } catch { throw new Error('ملف JSON غير صالح'); }
		if (!payload || !Array.isArray(payload.banks) || !Array.isArray(payload.entries) || !Array.isArray(payload.settings)) {
			throw new Error('هيكل النسخة الاحتياطية غير صحيح');
		}
		const database = await db.open();
		await new Promise((resolve, reject) => {
			const t = database.transaction(['banks','entries','settings'], 'readwrite');
			const sb = t.objectStore('banks');
			const se = t.objectStore('entries');
			const ss = t.objectStore('settings');
			// مسح
			sb.clear(); se.clear(); ss.clear();
			t.oncomplete = resolve; t.onerror = () => reject(t.error);
		});
		// إدخال
		await new Promise((resolve, reject) => {
			const t = database.transaction(['banks','entries','settings'], 'readwrite');
			const sb = t.objectStore('banks');
			const se = t.objectStore('entries');
			const ss = t.objectStore('settings');
			payload.banks.forEach(b => sb.add(b));
			payload.entries.forEach(e => se.add(e));
			payload.settings.forEach(s => ss.put(s));
			t.oncomplete = resolve; t.onerror = () => reject(t.error);
		});
	}
};

export default { exportExcel, backup };

// SheetJS (Excel export) logic will go here.
import { getArabicMonthName } from './utils.js';

console.log("export.js loaded");

/**
 * Exports the yearly summary report to an Excel file.
 * @param {object} reportData - The data from generateYearlyReportData.
 * @param {string} fiscalYearLabel - The label for the fiscal year, e.g., "2023/2024".
 */
export function exportYearlyReportToExcel(reportData, fiscalYearLabel) {
    const { perBank, grandTotals } = reportData;

    // Map data to have Arabic headers
    const mappedData = perBank.map(b => ({
        'البنك': b.bankName,
        'الرصيد الافتتاحي': b.openingBalance,
        'إجمالي المدين': b.totalDebit,
        'إجمالي الدائن': b.totalCredit,
        'الرصيد الختامي': b.finalBalance,
    }));

    // Add the totals row
    mappedData.push({}); // Spacer
    mappedData.push({
        'البنك': 'الإجمالي العام',
        'الرصيد الافتتاحي': grandTotals.openingBalance,
        'إجمالي المدين': grandTotals.totalDebit,
        'إجمالي الدائن': grandTotals.totalCredit,
        'الرصيد الختامي': grandTotals.finalBalance,
    });

    const worksheet = XLSX.utils.json_to_sheet(mappedData, {
        // To format numbers correctly, skip header and format manually
        skipHeader: true
    });

    // Manually add headers to apply styling
    XLSX.utils.sheet_add_aoa(worksheet, [['البنك', 'الرصيد الافتتاحي', 'إجمالي المدين', 'إجمالي الدائن', 'الرصيد الختامي']], { origin: 'A1' });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ملخص السنة المالية');

    // Auto-size columns
    worksheet['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];

    const fileName = `أرصدة البنوك - سنة مالية ${fiscalYearLabel.replace('/', '-')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
}

/**
 * Exports a bank's debit and credit entries to a multi-sheet Excel file.
 * @param {string} bankName
 * @param {Array<object>} debitEntries
 * @param {Array<object>} creditEntries
 * @param {string} fileName - The desired file name (without .xlsx extension).
 */
export function exportBankEntriesToExcel(debitEntries, creditEntries, fileName) {
    const mapEntry = e => ({
        'البيان': e.description,
        'التاريخ': new Date(e.date).toLocaleDateString('fr-CA'), // YYYY-MM-DD
        'المبلغ': e.amount
    });

    const debitData = debitEntries.map(mapEntry);
    const creditData = creditEntries.map(mapEntry);

    const debitWorksheet = XLSX.utils.json_to_sheet(debitData);
    const creditWorksheet = XLSX.utils.json_to_sheet(creditData);

    debitWorksheet['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }];
    creditWorksheet['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, debitWorksheet, 'القيود المدينة');
    XLSX.utils.book_append_sheet(workbook, creditWorksheet, 'القيود الدائنة');

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
