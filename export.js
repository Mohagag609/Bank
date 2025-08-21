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
