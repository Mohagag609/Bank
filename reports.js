// Logic for generating report data structures will go here.
console.log("reports.js loaded");

/**
 * Generates data for the annual fiscal year report.
 * @param {Array<object>} banks - All bank objects.
 * @param {Array<object>} allEntries - All entries for the selected fiscal year.
 * @returns {object} - { perBank: [], grandTotals: {} }
 */
export function generateYearlyReportData(banks, allEntries) {
    const perBank = banks.map(bank => {
        const entriesForBank = allEntries.filter(e => e.bankId === bank.id);
        const totalDebit = entriesForBank.filter(e => e.type === 'debit').reduce((sum, e) => sum + e.amount, 0);
        const totalCredit = entriesForBank.filter(e => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0);
        const finalBalance = bank.openingBalance + totalDebit - totalCredit;

        return {
            bankId: bank.id,
            bankName: bank.name,
            openingBalance: bank.openingBalance,
            totalDebit,
            totalCredit,
            finalBalance,
            entryCount: entriesForBank.length,
        };
    });

    const grandTotals = {
        openingBalance: perBank.reduce((sum, b) => sum + b.openingBalance, 0),
        totalDebit: perBank.reduce((sum, b) => sum + b.totalDebit, 0),
        totalCredit: perBank.reduce((sum, b) => sum + b.totalCredit, 0),
        finalBalance: perBank.reduce((sum, b) => sum + b.finalBalance, 0),
    };

    return { perBank, grandTotals };
}

/**
 * Generates data for the monthly comparative report for a single bank.
 * @param {Array<object>} entries - All entries for the selected bank in the fiscal year.
 * @param {object} bank - The selected bank object.
 * @param {{start: Date, end: Date}} fiscalYearRange - The fiscal year range.
 * @returns {object} - { perMonth: [], totals: {} }
 */
export function generateMonthlyComparativeReportData(entries, bank, fiscalYearRange) {
    const months = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(fiscalYearRange.start);
        date.setMonth(date.getMonth() + i);
        return {
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            debit: 0,
            credit: 0,
            balance: 0
        };
    });

    let runningBalance = bank.openingBalance;

    // First, calculate totals for each month
    for (const entry of entries) {
        const entryMonth = new Date(entry.date).getMonth() + 1;
        const entryYear = new Date(entry.date).getFullYear();
        const monthData = months.find(m => m.month === entryMonth && m.year === entryYear);
        if (monthData) {
            if (entry.type === 'debit') {
                monthData.debit += entry.amount;
            } else {
                monthData.credit += entry.amount;
            }
        }
    }

    // Now, calculate running balance for each month
    months.forEach(monthData => {
        runningBalance += monthData.debit - monthData.credit;
        monthData.balance = runningBalance;
    });

    const totals = {
        debit: months.reduce((sum, m) => sum + m.debit, 0),
        credit: months.reduce((sum, m) => sum + m.credit, 0),
        finalBalance: runningBalance
    };

    return { perMonth: months, totals };
}
