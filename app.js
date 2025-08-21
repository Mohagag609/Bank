import * as db from './db.js';
import * as utils from './utils.js';
import * as reports from './reports.js';
import * as charts from './charts.js';
import * as exports from './export.js';
import * as backup from './backup.js';

console.log("app.js loaded");

// --- 1. State Management ---
const state = {
    banks: [],
    entries: [],
    currentBankId: null,
    editingEntryId: null,
    lastReportData: null,
};

// --- 2. DOM Elements ---
let mainContent, navLinks, views, bankSelector, addBankBtn, bankModal, bankModalTitle, bankForm, bankIdInput, bankNameInput, bankIbanInput, bankOpeningBalanceInput, cancelBankFormBtn, banksTableBody, closeModalBtn, entryForm, entryFormTitle, entryIdInput, entryDescriptionInput, entryAmountInput, entryDateInput, entryTypeInput, cancelEntryFormBtn, debitTableBody, creditTableBody, debitTotalEl, creditTotalEl, bankSummaryContent, reportTypeSelector, reportBankSelectorGroup, reportBankSelector, reportFiscalYearSelector, generateReportBtn, exportReportBtn, reportContent, reportTitle, reportTableContainer, exportEntriesBtn, exportBackupBtn, importBackupBtn, importBackupInput, recoDateInput, recoBankBalanceInput, recoResults, fixedDateToggle, fixedDateInput;

// --- 3. Main Entry Point ---
document.addEventListener('DOMContentLoaded', async () => {
    queryDOMElements();
    setupEventListeners();

    try {
        await db.openDB();
        console.log("Database connection established.");
        await initializeApp();
    } catch (error) {
        console.error("Failed to open database:", error);
        mainContent.innerHTML = `<p style="color: red; text-align: center;">فشل الاتصال بقاعدة البيانات. لا يمكن تشغيل التطبيق.</p>`;
        return;
    }

    navigateTo('entries-view');
});


// --- 4. Initialization & Setup ---
function queryDOMElements() {
    mainContent = document.getElementById('app-main');
    navLinks = document.querySelectorAll('.nav-link');
    views = document.querySelectorAll('.view');
    bankSelector = document.getElementById('bank-selector');
    addBankBtn = document.getElementById('add-bank-btn');
    bankModal = document.getElementById('add-bank-modal');
    bankModalTitle = document.getElementById('bank-modal-title');
    bankForm = document.getElementById('bank-form');
    bankIdInput = document.getElementById('bank-id-input');
    bankNameInput = document.getElementById('bank-name-input');
    bankIbanInput = document.getElementById('bank-iban-input');
    bankOpeningBalanceInput = document.getElementById('bank-opening-balance-input');
    cancelBankFormBtn = document.getElementById('cancel-bank-form');
    banksTableBody = document.getElementById('banks-table-body');
    closeModalBtn = bankModal.querySelector('.close-btn');
    entryForm = document.getElementById('entry-form');
    entryFormTitle = document.getElementById('entry-form-title');
    entryIdInput = document.getElementById('entry-id-input');
    entryDescriptionInput = document.getElementById('entry-description');
    entryAmountInput = document.getElementById('entry-amount');
    entryDateInput = document.getElementById('entry-date');
    entryTypeInput = document.getElementById('entry-type');
    cancelEntryFormBtn = document.getElementById('cancel-entry-form');
    debitTableBody = document.getElementById('debit-entries-body');
    creditTableBody = document.getElementById('credit-entries-body');
    debitTotalEl = document.getElementById('debit-total');
    creditTotalEl = document.getElementById('credit-total');
    bankSummaryContent = document.getElementById('bank-summary-content');
    reportFiscalYearSelector = document.getElementById('report-fiscal-year-selector');
    generateReportBtn = document.getElementById('generate-report-btn');
    reportContent = document.getElementById('report-content');
    reportTitle = document.getElementById('report-title');
    reportTableContainer = document.getElementById('report-table-container');
    exportReportBtn = document.getElementById('export-report-btn');
    reportTypeSelector = document.getElementById('report-type-selector');
    reportBankSelectorGroup = document.getElementById('report-bank-selector-group');
    reportBankSelector = document.getElementById('report-bank-selector');
    exportEntriesBtn = document.getElementById('export-entries-btn');
    // Backup elements
    exportBackupBtn = document.getElementById('export-backup-btn');
    importBackupBtn = document.getElementById('import-backup-btn');
    importBackupInput = document.getElementById('import-backup-input');
    // Reconciliation elements
    recoDateInput = document.getElementById('reco-date');
    recoBankBalanceInput = document.getElementById('reco-bank-balance');
    recoResults = document.getElementById('reco-results');
    // Fixed Date elements
    fixedDateToggle = document.getElementById('fixed-date-toggle');
    fixedDateInput = document.getElementById('fixed-date-input');
}

function setupEventListeners() {
    // Navigation
    navLinks.forEach(link => link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.getAttribute('data-view'));
    }));
    // Bank listeners
    bankSelector.addEventListener('change', handleBankSelectionChange);
    addBankBtn.addEventListener('click', handleAddBankClick);
    closeModalBtn.addEventListener('click', closeBankModal);
    cancelBankFormBtn.addEventListener('click', closeBankModal);
    bankForm.addEventListener('submit', handleBankFormSubmit);
    banksTableBody.addEventListener('click', handleBankTableActions);
    // Entry listeners
    entryForm.addEventListener('submit', handleEntryFormSubmit);
    cancelEntryFormBtn.addEventListener('click', () => {
        entryForm.reset();
        state.editingEntryId = null;
        entryFormTitle.textContent = 'إضافة قيد جديد';
    });
    debitTableBody.addEventListener('click', handleEntryTableActions);
    creditTableBody.addEventListener('click', handleEntryTableActions);
    // Report listeners
    reportTypeSelector.addEventListener('change', handleReportTypeChange);
    generateReportBtn.addEventListener('click', handleGenerateReport);
    exportReportBtn.addEventListener('click', handleExportReport);
    exportEntriesBtn.addEventListener('click', handleExportEntries);
    // Backup listeners
    exportBackupBtn.addEventListener('click', backup.exportBackup);
    importBackupInput.addEventListener('change', () => {
        importBackupBtn.disabled = !importBackupInput.files.length;
    });
    importBackupBtn.addEventListener('click', handleImportBackup);
    // Reconciliation listeners
    recoDateInput.addEventListener('input', handleReconciliation);
    recoBankBalanceInput.addEventListener('input', handleReconciliation);
    // Fixed Date listeners
    fixedDateToggle.addEventListener('change', handleFixedDateToggle);
    fixedDateInput.addEventListener('change', handleFixedDateToggle);
}

async function initializeApp() {
    await refreshBanks();
    setupReportView(); // Populate fiscal year selector
    await loadFixedDateSetting();
    if (state.banks.length > 0) {
        state.currentBankId = state.banks[0].id;
        bankSelector.value = state.currentBankId;
        await refreshEntries();
    } else {
        renderBankSummary();
        renderEntriesTables();
    }
    const today = utils.formatDate(new Date().toISOString());
    entryDateInput.value = today;
    recoDateInput.value = today;
}

// --- 5. Data Refresh & Rendering ---
async function refreshBanks() {
    try {
        state.banks = await db.getBanks();
        renderBankTable();
        renderBankSelector();
    } catch (error) {
        console.error("Could not refresh banks:", error);
    }
}

async function refreshEntries() {
    if (!state.currentBankId) {
        state.entries = [];
    } else {
        try {
            // For now, entries view shows all entries, not filtered by date
            state.entries = await db.getEntriesForBank({ bankId: state.currentBankId });
        } catch (error) {
            console.error("Could not refresh entries:", error);
            state.entries = [];
        }
    }
    renderEntriesTables();
    renderBankSummary();
}

function renderBankTable() {
    banksTableBody.innerHTML = '';
    if (state.banks.length === 0) {
        banksTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">لم يتم إضافة أي بنوك بعد.</td></tr>`;
        return;
    }
    state.banks.forEach(bank => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${bank.name}</td><td>${bank.iban || '---'}</td><td>${utils.formatMoney(bank.openingBalance)}</td><td>${utils.displayDate(bank.createdAt)}</td><td><button class="button-secondary edit-btn" data-id="${bank.id}">تعديل</button> <button class="button-danger delete-btn" data-id="${bank.id}">حذف</button></td>`;
        banksTableBody.appendChild(row);
    });
}

function renderBankSelector() {
    const lastSelected = bankSelector.value;
    bankSelector.innerHTML = '';
    if (state.banks.length === 0) {
        bankSelector.innerHTML = `<option>لا توجد بنوك</option>`;
    } else {
        state.banks.forEach(bank => {
            const option = document.createElement('option');
            option.value = bank.id;
            option.textContent = bank.name;
            bankSelector.appendChild(option);
        });
        bankSelector.value = lastSelected && state.banks.some(b => b.id == lastSelected) ? lastSelected : state.banks[0]?.id;
    }
}

function renderEntriesTables() {
    debitTableBody.innerHTML = creditTableBody.innerHTML = '';
    let debitTotal = 0, creditTotal = 0;
    const sortedEntries = state.entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedEntries.forEach(entry => {
        const rowHTML = `<td>${entry.description}</td><td>${utils.displayDate(entry.date)}</td><td>${utils.formatMoney(entry.amount)}</td><td><button class="button-secondary edit-btn" data-id="${entry.id}">تعديل</button> <button class="button-danger delete-btn" data-id="${entry.id}">حذف</button></td>`;
        if (entry.type === 'debit') {
            debitTableBody.innerHTML += `<tr>${rowHTML}</tr>`;
            debitTotal += entry.amount;
        } else {
            creditTableBody.innerHTML += `<tr>${rowHTML}</tr>`;
            creditTotal += entry.amount;
        }
    });
    debitTotalEl.textContent = utils.formatMoney(debitTotal);
    creditTotalEl.textContent = utils.formatMoney(creditTotal);
}

function renderBankSummary() {
    const bank = state.banks.find(b => b.id === state.currentBankId);
    if (!bank) {
        bankSummaryContent.innerHTML = `<p>الرجاء اختيار بنك لعرض الملخص.</p>`;
        return;
    }
    const totalDebit = state.entries.filter(e => e.type === 'debit').reduce((sum, e) => sum + e.amount, 0);
    const totalCredit = state.entries.filter(e => e.type === 'credit').reduce((sum, e) => sum + e.amount, 0);
    const currentBalance = bank.openingBalance + totalDebit - totalCredit;
    bankSummaryContent.innerHTML = `<p><span>الرصيد الافتتاحي:</span> <strong>${utils.formatMoney(bank.openingBalance)}</strong></p><p><span>إجمالي المدين:</span> <strong style="color: var(--success-color);">${utils.formatMoney(totalDebit)}</strong></p><p><span>إجمالي الدائن:</span> <strong style="color: var(--danger-color);">${utils.formatMoney(totalCredit)}</strong></p><div class="summary-balance"><p><span>الرصيد الحالي:</span> <strong>${utils.formatMoney(currentBalance)}</strong></p></div>`;
}


// --- 6. Event Handlers ---
function navigateTo(viewId) {
    navLinks.forEach(navLink => navLink.classList.toggle('active', navLink.getAttribute('data-view') === viewId));
    views.forEach(view => view.classList.toggle('active-view', view.id === viewId));
    if (viewId === 'reports-view') {
        setupReportView();
    }
}

async function handleBankSelectionChange(e) {
    state.currentBankId = parseInt(e.target.value);
    await refreshEntries();
    handleReconciliation();
}

function handleAddBankClick() {
    bankForm.reset();
    bankIdInput.value = '';
    bankModalTitle.textContent = 'إضافة بنك جديد';
    bankModal.style.display = 'block';
}

function closeBankModal() {
    bankModal.style.display = 'none';
}

async function handleBankFormSubmit(e) {
    e.preventDefault();
    const bankData = { name: bankNameInput.value.trim(), iban: bankIbanInput.value.trim(), openingBalance: parseFloat(bankOpeningBalanceInput.value) || 0 };
    if (!bankData.name) return alert('اسم البنك مطلوب.');
    const id = bankIdInput.value ? parseInt(bankIdInput.value) : null;
    try {
        if (id) {
            const originalBank = state.banks.find(b => b.id === id);
            bankData.id = id;
            bankData.createdAt = originalBank.createdAt;
            await db.updateBank(bankData);
        } else {
            bankData.createdAt = new Date().toISOString();
            await db.addBank(bankData);
        }
        closeBankModal();
        await refreshBanks();
        if (!id) {
            const newBank = state.banks.find(b => b.name === bankData.name);
            if (newBank) {
                bankSelector.value = newBank.id;
                await handleBankSelectionChange({ target: { value: newBank.id } });
            }
        } else {
             await refreshEntries();
        }
    } catch (error) {
        console.error("Failed to save bank:", error);
        alert('حدث خطأ أثناء حفظ البنك. قد يكون الاسم مكررًا.');
    }
}

async function handleBankTableActions(e) {
    const id = parseInt(e.target.getAttribute('data-id'));
    if (e.target.classList.contains('edit-btn')) {
        const bank = state.banks.find(b => b.id === id);
        if (bank) {
            bankModalTitle.textContent = 'تعديل بيانات البنك';
            bankIdInput.value = bank.id;
            bankNameInput.value = bank.name;
            bankIbanInput.value = bank.iban;
            bankOpeningBalanceInput.value = bank.openingBalance;
            bankModal.style.display = 'block';
        }
    }
    if (e.target.classList.contains('delete-btn')) {
        if (confirm('هل أنت متأكد من حذف هذا البنك؟ سيتم حذف جميع القيود المرتبطة به أيضًا.')) {
            await handleDeleteBank(id);
        }
    }
}

async function handleDeleteBank(id) {
    try {
        await db.deleteBank(id);
        await db.deleteEntriesForBank(id);
        await refreshBanks();
        const newBankId = state.banks.length > 0 ? state.banks[0].id : null;
        bankSelector.value = newBankId;
        await handleBankSelectionChange({ target: { value: newBankId } });
    } catch (error) {
        console.error('Failed to delete bank:', error);
        alert('حدث خطأ أثناء حذف البنك.');
    }
}

async function handleEntryFormSubmit(e) {
    e.preventDefault();
    const entryData = { bankId: state.currentBankId, description: entryDescriptionInput.value.trim(), amount: parseFloat(entryAmountInput.value), date: entryDateInput.value, type: entryTypeInput.value };
    if (!entryData.description || !entryData.amount || !entryData.date) return alert('الرجاء ملء جميع حقول القيد.');
    if (entryData.amount <= 0) return alert('المبلغ يجب أن يكون أكبر من صفر.');
    try {
        if (state.editingEntryId) {
            entryData.id = state.editingEntryId;
            await db.updateEntry(entryData);
        } else {
            await db.addEntry(entryData);
        }
        entryForm.reset();
        entryDateInput.value = utils.formatDate(new Date().toISOString());
        state.editingEntryId = null;
        entryFormTitle.textContent = 'إضافة قيد جديد';
        await refreshEntries();
    } catch (error) {
        console.error('Failed to save entry:', error);
        alert('حدث خطأ أثناء حفظ القيد.');
    }
}

function handleEntryTableActions(e) {
    const id = parseInt(e.target.getAttribute('data-id'));
    if (!id) return;
    if (e.target.classList.contains('edit-btn')) {
        const entry = state.entries.find(en => en.id === id);
        if (entry) {
            entryFormTitle.textContent = 'تعديل القيد';
            state.editingEntryId = entry.id;
            entryIdInput.value = entry.id;
            entryDescriptionInput.value = entry.description;
            entryAmountInput.value = entry.amount;
            entryDateInput.value = utils.formatDate(entry.date);
            entryTypeInput.value = entry.type;
            entryDescriptionInput.focus();
        }
    }
    if (e.target.classList.contains('delete-btn')) {
        if (confirm('هل أنت متأكد من حذف هذا القيد؟')) {
            handleDeleteEntry(id);
        }
    }
}

async function handleDeleteEntry(id) {
    try {
        await db.deleteEntry(id);
        await refreshEntries();
    } catch (error) {
        console.error('Failed to delete entry:', error);
        alert('حدث خطأ أثناء حذف القيد.');
    }
}

// --- 7. Reporting Functions ---
function setupReportView() {
    // Populate fiscal year selector
    reportFiscalYearSelector.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setFullYear(date.getFullYear() - i);
        const fiscalYear = utils.getFiscalYearRange(date);
        const option = document.createElement('option');
        option.value = JSON.stringify({ start: fiscalYear.start, end: fiscalYear.end });
        option.textContent = fiscalYear.label;
        reportFiscalYearSelector.appendChild(option);
    }

    // Populate bank selector for monthly report
    reportBankSelector.innerHTML = '';
    state.banks.forEach(bank => {
        const option = document.createElement('option');
        option.value = bank.id;
        option.textContent = bank.name;
        reportBankSelector.appendChild(option);
    });

    reportContent.style.display = 'none';
    exportReportBtn.style.display = 'none';
    handleReportTypeChange(); // Set initial visibility
}

function handleReportTypeChange() {
    const reportType = reportTypeSelector.value;
    if (reportType === 'monthly') {
        reportBankSelectorGroup.style.display = 'block';
    } else {
        reportBankSelectorGroup.style.display = 'none';
    }
}

async function handleGenerateReport() {
    const reportType = reportTypeSelector.value;
    const selectedYear = JSON.parse(reportFiscalYearSelector.value);
    const range = { from: utils.formatDate(new Date(selectedYear.start).toISOString()), to: utils.formatDate(new Date(selectedYear.end).toISOString()) };
    const fiscalYearLabel = utils.getFiscalYearRange(new Date(selectedYear.start)).label;

    try {
        if (reportType === 'yearly') {
            const allEntries = await db.getAllEntries(range);
            const reportData = reports.generateYearlyReportData(state.banks, allEntries);
            state.lastReportData = reportData;
            renderYearlyReportTable(reportData);
            charts.createBankDistributionChart('report-chart-canvas', reportData);
            reportTitle.textContent = `ملخص السنة المالية ${fiscalYearLabel}`;
        } else if (reportType === 'monthly') {
            const bankId = parseInt(reportBankSelector.value);
            if (!bankId) {
                alert("الرجاء اختيار بنك لعرض التقرير الشهري.");
                return;
            }
            const bank = state.banks.find(b => b.id === bankId);
            const entries = await db.getEntriesForBank({ bankId, from: range.from, to: range.to });
            const reportData = reports.generateMonthlyComparativeReportData(entries, bank, selectedYear);
            state.lastReportData = reportData;
            renderMonthlyComparativeTable(reportData, bank);
            charts.createMonthlyBalanceChart('report-chart-canvas', reportData, utils);
            reportTitle.textContent = `التقرير الشهري للبنك: ${bank.name} - سنة ${fiscalYearLabel}`;
        }

        reportContent.style.display = 'block';
        exportReportBtn.style.display = 'inline-block';
    } catch (error) {
        console.error("Failed to generate report:", error);
        alert("حدث خطأ أثناء إنشاء التقرير.");
    }
}

function renderYearlyReportTable(reportData) {
    const { perBank, grandTotals } = reportData;
    reportTableContainer.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'table';
    table.innerHTML = `<thead><tr><th>البنك</th><th>رصيد افتتاحي</th><th>إجمالي المدين</th><th>إجمالي الدائن</th><th>الرصيد الختامي</th></tr></thead><tbody>${perBank.map(b => `<tr><td>${b.bankName}</td><td>${utils.formatMoney(b.openingBalance)}</td><td>${utils.formatMoney(b.totalDebit)}</td><td>${utils.formatMoney(b.totalCredit)}</td><td><strong>${utils.formatMoney(b.finalBalance)}</strong></td></tr>`).join('')}</tbody><tfoot><tr><td>الإجمالي العام</td><td>${utils.formatMoney(grandTotals.openingBalance)}</td><td>${utils.formatMoney(grandTotals.totalDebit)}</td><td>${utils.formatMoney(grandTotals.totalCredit)}</td><td><strong>${utils.formatMoney(grandTotals.finalBalance)}</strong></td></tr></tfoot>`;
    reportTableContainer.appendChild(table);
}

function renderMonthlyComparativeTable(reportData, bank) {
    const { perMonth, totals } = reportData;
    reportTableContainer.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'table';
    let tableHTML = `
        <thead>
            <tr>
                <th>الشهر</th>
                <th>إجمالي المدين</th>
                <th>إجمالي الدائن</th>
                <th>الرصيد في نهاية الشهر</th>
            </tr>
        </thead>
        <tbody>
            <tr><td colspan="4"><strong>الرصيد الافتتاحي للسنة: ${utils.formatMoney(bank.openingBalance)}</strong></td></tr>
            ${perMonth.map(m => `
                <tr>
                    <td>${utils.getArabicMonthName(m.month)} ${m.year}</td>
                    <td>${utils.formatMoney(m.debit)}</td>
                    <td>${utils.formatMoney(m.credit)}</td>
                    <td><strong>${utils.formatMoney(m.balance)}</strong></td>
                </tr>
            `).join('')}
        </tbody>
        <tfoot>
            <tr>
                <td>الإجمالي</td>
                <td>${utils.formatMoney(totals.debit)}</td>
                <td>${utils.formatMoney(totals.credit)}</td>
                <td><strong>${utils.formatMoney(totals.finalBalance)}</strong></td>
            </tr>
        </tfoot>`;
    table.innerHTML = tableHTML;
    reportTableContainer.appendChild(table);
}


// --- 8. Export Handlers ---
function handleExportReport() {
    if (!state.lastReportData) {
        alert("الرجاء إنشاء تقرير أولاً.");
        return;
    }
    const fiscalYearLabel = utils.getFiscalYearRange(new Date(JSON.parse(reportFiscalYearSelector.value).start)).label;
    exports.exportYearlyReportToExcel(state.lastReportData, fiscalYearLabel);
}

function handleExportEntries() {
    if (!state.currentBankId) {
        alert("الرجاء اختيار بنك أولاً.");
        return;
    }
    const bank = state.banks.find(b => b.id === state.currentBankId);
    const debitEntries = state.entries.filter(e => e.type === 'debit');
    const creditEntries = state.entries.filter(e => e.type === 'credit');

    const exportDate = new Date().toLocaleDateString('fr-CA');
    const fileName = `${bank.name} - جميع القيود - ${exportDate}`;

    exports.exportBankEntriesToExcel(debitEntries, creditEntries, fileName);
}


// --- 9. Backup Handlers ---
async function handleImportBackup() {
    const file = importBackupInput.files[0];
    if (!file) {
        alert("الرجاء اختيار ملف أولاً.");
        return;
    }

    const confirmation = prompt("تحذير: هذه العملية ستحذف جميع البيانات الحالية. هل أنت متأكد؟\nللتأكيد، اكتب 'تأكيد' في المربع أدناه:");
    if (confirmation !== 'تأكيد') {
        alert("تم إلغاء عملية الاستيراد.");
        return;
    }

    try {
        await backup.importBackup(file);
        alert("تم استيراد البيانات بنجاح! سيتم إعادة تحميل التطبيق الآن.");
        location.reload();
    } catch (error) {
        alert(`فشل استيراد البيانات: ${error.message}`);
    }
}

// --- 10. Reconciliation Handler ---
async function handleReconciliation() {
    if (!state.currentBankId || !recoDateInput.value) {
        recoResults.innerHTML = '';
        return;
    }

    const bank = state.banks.find(b => b.id === state.currentBankId);
    if (!bank) return;

    const recoDate = recoDateInput.value;
    const dayBefore = utils.getPreviousDayISO(recoDate);

    // 1. Get all entries up to the day before to calculate opening balance for the day
    const priorEntries = await db.getEntriesForBank({
        bankId: state.currentBankId,
        to: dayBefore
    });
    const openingBalanceForDay = priorEntries.reduce((acc, entry) => {
        return acc + (entry.type === 'debit' ? entry.amount : -entry.amount);
    }, bank.openingBalance);

    // 2. Get entries for the selected day to calculate net change
    const entriesForDay = await db.getEntriesForBank({
        bankId: state.currentBankId,
        from: recoDate,
        to: recoDate
    });
    const netChangeForDay = entriesForDay.reduce((acc, entry) => {
        return acc + (entry.type === 'debit' ? entry.amount : -entry.amount);
    }, 0);

    // 3. Calculate the expected system balance at the end of the day
    const systemBalance = openingBalanceForDay + netChangeForDay;

    // 4. Compare with the actual bank balance provided by the user
    const bankBalance = parseFloat(recoBankBalanceInput.value) || 0;
    const difference = bankBalance - systemBalance;

    let status = '';
    if (recoBankBalanceInput.value.trim() !== '') {
        if (Math.abs(difference) < 0.01) {
            status = `<strong style="color: var(--success-color);">متطابق ✅</strong>`;
        } else {
            status = `<strong style="color: var(--danger-color);">غير متطابق ❌</strong>`;
        }
    }

    recoResults.innerHTML = `
        <p><span>رصيد النظام المحسوب:</span> <strong>${utils.formatMoney(systemBalance)}</strong></p>
        <p><span>الفرق:</span> <strong>${utils.formatMoney(difference)}</strong></p>
        <div class="summary-balance">${status}</div>
    `;
}


// --- 11. Fixed Date Handlers ---
async function loadFixedDateSetting() {
    const setting = await db.getSetting('fixedDate');
    if (setting && setting.enabled) {
        fixedDateToggle.checked = true;
        fixedDateInput.value = setting.date;
        fixedDateInput.disabled = false;
        entryDateInput.disabled = true;
        entryDateInput.value = setting.date;
    } else {
        fixedDateInput.value = utils.formatDate(new Date().toISOString());
    }
}

async function handleFixedDateToggle() {
    const enabled = fixedDateToggle.checked;
    const date = fixedDateInput.value;
    await db.setSetting('fixedDate', { enabled, date });

    fixedDateInput.disabled = !enabled;
    entryDateInput.disabled = enabled;
    if (enabled) {
        entryDateInput.value = date;
    }
}

// --- 12. Dynamic Styles ---
const style = document.createElement('style');
style.innerHTML = `.button-danger { background-color: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); padding: 0.5rem 1rem; border-radius: 6px; font-family: inherit; cursor: pointer; transition: all 0.2s ease; } .button-danger:hover { background-color: var(--danger-color); color: var(--white); } td .button-secondary, td .button-danger { padding: 0.3rem 0.6rem; font-size: 0.8rem; }`;
document.head.appendChild(style);
