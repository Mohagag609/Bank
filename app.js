import { formatMoney, parseMoney, formatDate, monthNameAr, sumBy, calculateBankBalance, fiscalRangeFor, monthRange, clamp, AR_MONTHS } from './utils.js';
import { db } from './db.js';
import { exportExcel, backup } from './export.js';
import { renderYearlyDoughnut, renderMonthlySeries } from './charts.js';

// حالة التطبيق
const state = {
	currentView: 'banks',
	banks: [],
	currentBankId: null,
	period: { mode: 'day', day: '', from: '', to: '', month: 1, year: new Date().getFullYear(), fiscalLabel: '' },
	fixedDate: null,
	debit: { page: 1, pageSize: 100, sortKey: 'date', sortDir: 'desc', search: '' },
	credit: { page: 1, pageSize: 100, sortKey: 'date', sortDir: 'desc', search: '' },
};

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

document.addEventListener('DOMContentLoaded', init);

async function init() {
	initNav();
	initPeriodControls();
	initBankActions();
	initEntryActions();
	initBackupActions();
	await loadBanks();
	await loadSettings();
	applyFixedDateToInputs();
	updatePeriodDefaults();
	await renderAll();
}

function initNav() {
	qsa('.nav-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			qsa('.nav-btn').forEach(b=>b.classList.remove('active'));
			btn.classList.add('active');
			const view = btn.dataset.view;
			state.currentView = view;
			qsa('.view').forEach(v=>v.classList.remove('active'));
			qs(`#view-${view}`).classList.add('active');
			renderAll();
		});
	});
}

function initPeriodControls() {
	// radios
	qsa('input[name="period"]').forEach(r => r.addEventListener('change', onPeriodChange));
	// inputs
	qs('#filterDay').addEventListener('change', () => { state.period.day = qs('#filterDay').value; renderAll(); });
	qs('#filterFrom').addEventListener('change', () => { state.period.from = qs('#filterFrom').value; renderAll(); });
	qs('#filterTo').addEventListener('change', () => { state.period.to = qs('#filterTo').value; renderAll(); });
	qs('#filterMonth').addEventListener('change', () => { state.period.month = Number(qs('#filterMonth').value); renderAll(); });
	qs('#filterYear').addEventListener('change', () => { state.period.year = Number(qs('#filterYear').value); renderAll(); });
	qs('#filterFiscal').addEventListener('change', () => { state.period.fiscalLabel = qs('#filterFiscal').value; renderAll(); });

	// init month/year selects
	const monthSel = qs('#filterMonth');
	monthSel.innerHTML = AR_MONTHS.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');
	const yearSel = qs('#filterYear');
	const y = new Date().getFullYear();
	const years = [y-1, y, y+1];
	yearSel.innerHTML = years.map(yy=>`<option value="${yy}">${yy}</option>`).join('');
}

async function loadSettings() {
	const s = await db.getSettings(['fixedDate','fiscalStartMonth','fiscalEndMonth']);
	state.fixedDate = s.fixedDate || null;
	qs('#toggleFixedDate').checked = !!state.fixedDate;
	qs('#fixedDateInput').value = state.fixedDate || '';
	qs('#toggleFixedDate').addEventListener('change', async (e) => {
		if (e.target.checked) {
			state.fixedDate = formatDate(qs('#fixedDateInput').value || new Date().toISOString());
			await db.setSetting('fixedDate', state.fixedDate);
		} else {
			state.fixedDate = null;
			await db.setSetting('fixedDate', null);
		}
		applyFixedDateToInputs();
	});
	qs('#fixedDateInput').addEventListener('change', async () => {
		state.fixedDate = formatDate(qs('#fixedDateInput').value);
		await db.setSetting('fixedDate', state.fixedDate);
		applyFixedDateToInputs();
	});

	// fiscal select
	const now = new Date();
	const startM = s.fiscalStartMonth || 7, endM = s.fiscalEndMonth || 6;
	const curr = fiscalRangeFor(now, startM, endM);
	const prev = fiscalRangeFor(new Date(now.getFullYear()-1, now.getMonth(), now.getDate()), startM, endM);
	const fiscalSel = qs('#filterFiscal');
	fiscalSel.innerHTML = [curr.label, prev.label].map(l=>`<option value="${l}">${l}</option>`).join('');
	state.period.fiscalLabel = curr.label;
}

function applyFixedDateToInputs() {
	if (state.fixedDate) {
		qs('#entryDate').value = state.fixedDate;
		qs('#reconcileDate').value = state.fixedDate;
	} else {
		const today = formatDate(new Date().toISOString());
		qs('#entryDate').value = today;
		qs('#reconcileDate').value = today;
	}
}

function onPeriodChange() {
	const mode = qsa('input[name="period"]').find(r=>r.checked).value;
	state.period.mode = mode;
	qsa('.filter').forEach(f=>f.classList.add('hidden'));
	qs(`.filter-${mode}`).classList.remove('hidden');
	renderAll();
}

async function loadBanks() {
	state.banks = await db.listBanks();
	const sel = qs('#currentBank');
	const last = localStorage.getItem('currentBankId');
	sel.innerHTML = state.banks.map(b=>`<option value="${b.id}">${b.name}</option>`).join('');
	if (last && state.banks.some(b=>String(b.id)===String(last))) {
		sel.value = String(last);
		state.currentBankId = Number(last);
	} else if (state.banks[0]) {
		state.currentBankId = state.banks[0].id;
		sel.value = String(state.currentBankId);
	}
	sel.addEventListener('change', () => {
		state.currentBankId = Number(sel.value);
		localStorage.setItem('currentBankId', String(state.currentBankId));
		renderAll();
	});
}

function initBankActions() {
	qs('#btnAddBank').addEventListener('click', () => openBankModal());
	qs('#btnEditBank').addEventListener('click', () => {
		const b = state.banks.find(b=>b.id===state.currentBankId);
		if (b) openBankModal(b);
	});
	qs('#btnDeleteBank').addEventListener('click', () => confirmDelete('bank', state.currentBankId));
	qs('#saveBank').addEventListener('click', onSaveBank);
	qsa('[data-close]').forEach(btn => btn.addEventListener('click', (e)=>closeModal(btn.dataset.close)));
}

function openBankModal(bank) {
	qs('#bankModalTitle').textContent = bank ? 'تعديل بنك' : 'بنك جديد';
	qs('#bankName').value = bank?.name || '';
	qs('#bankIban').value = bank?.iban || '';
	qs('#bankOpening').value = bank?.openingBalance != null ? bank.openingBalance : '';
	qs('#saveBank').dataset.id = bank?.id || '';
	openModal('#bankModal');
}

async function onSaveBank() {
	const id = Number(this.dataset.id || 0);
	const name = qs('#bankName').value.trim();
	if (!name) { alert('يرجى إدخال اسم البنك'); return; }
	const iban = qs('#bankIban').value.trim();
	const openingBalance = parseMoney(qs('#bankOpening').value);
	try {
		if (id) {
			await db.updateBank({ id, name, iban, openingBalance, createdAt: new Date().toISOString() });
		} else {
			const newBank = await db.addBank({ name, iban, openingBalance });
			state.currentBankId = newBank.id;
			localStorage.setItem('currentBankId', String(state.currentBankId));
		}
		await loadBanks();
		await renderAll();
		closeModal('#bankModal');
	} catch (e) { alert(e.message || 'خطأ أثناء الحفظ'); }
}

function confirmDelete(kind, id) {
	if (!id) return;
	qs('#confirmDeleteText').textContent = kind === 'bank' ? 'سيتم حذف البنك. لا يمكن الاسترجاع. هل أنت متأكد؟' : 'سيتم حذف القيد. متابعة؟';
	qs('#confirmDeleteYes').onclick = async () => {
		try {
			if (kind === 'bank') {
				await db.deleteBank(id);
				await loadBanks();
				await renderAll();
			} else if (kind === 'entry') {
				await db.deleteEntry(id);
				await renderEntries();
			}
			closeModal('#confirmDeleteModal');
		} catch (e) { alert(e.message || 'تعذر الحذف'); }
	};
	openModal('#confirmDeleteModal');
}

function openModal(sel) { qs(sel).setAttribute('aria-hidden', 'false'); }
function closeModal(sel) { qs(sel).setAttribute('aria-hidden', 'true'); }

function initEntryActions() {
	qs('#btnAddEntry').addEventListener('click', onAddEntry);
	qs('#btnClearEntry').addEventListener('click', () => {
		qs('#entryAmount').value = '';
		qs('#entryDesc').value = '';
	});
	// search
	qs('#searchDebit').addEventListener('input', () => { state.debit.search = qs('#searchDebit').value; state.debit.page=1; renderEntries(); });
	qs('#searchCredit').addEventListener('input', () => { state.credit.search = qs('#searchCredit').value; state.credit.page=1; renderEntries(); });
	// export side
	qs('#exportDebit').addEventListener('click', () => exportSide('debit'));
	qs('#exportCredit').addEventListener('click', () => exportSide('credit'));
	// yearly export/print
	qs('#btnExportYearExcel').addEventListener('click', onExportYearExcel);
	qs('#btnPrintYear').addEventListener('click', () => window.print());
	// reconcile
	qs('#reconcileDate').addEventListener('change', onReconcileChange);
	qs('#bankStatementBalance').addEventListener('input', onReconcileChange);
	qs('#btnSaveReconcile').addEventListener('click', () => alert('تم الحفظ (صوري).'));
}

function initBackupActions() {
	qs('#btnExportJSON').addEventListener('click', () => backup.exportJSON(db));
	qs('#importJSONInput').addEventListener('change', async (e) => {
		const file = e.target.files[0]; if (!file) return;
		if (!confirm('سيتم استبدال البيانات الحالية. متابعة؟')) return;
		try { await backup.importJSON(db, file); await loadBanks(); await renderAll(); alert('تم الاستيراد بنجاح'); }
		catch (err) { alert(err.message || 'فشل الاستيراد'); }
	});
}

async function onAddEntry() {
	const bankId = state.currentBankId;
	if (!bankId) { alert('اختر بنكاً أولاً'); return; }
	const type = qs('#entryType').value;
	const date = formatDate(state.fixedDate || qs('#entryDate').value);
	const amount = parseMoney(qs('#entryAmount').value);
	const description = qs('#entryDesc').value.trim();
	if (!description) { alert('البيان مطلوب'); return; }
	if (!date) { alert('تاريخ غير صالح'); return; }
	if (!(amount > 0)) { alert('المبلغ يجب أن يكون أكبر من صفر'); return; }
	await db.addEntry({ bankId, type, description, date, amount });
	qs('#entryAmount').value = '';
	qs('#entryDesc').value = '';
	await renderEntries();
}

function getDateRangeForPeriod() {
	const s = state.period;
	if (s.mode === 'day') {
		const day = formatDate(qs('#filterDay').value || new Date().toISOString());
		return { from: day, to: day, label: day };
	}
	if (s.mode === 'range') { return { from: s.from || '', to: s.to || '', label: `${s.from||''} – ${s.to||''}` }; }
	if (s.mode === 'month') {
		const r = monthRange(s.year, s.month - 1);
		return { ...r, label: `${s.year}-${String(s.month).padStart(2,'0')}` };
	}
	if (s.mode === 'fiscal') {
		const [startYear, endYear] = s.fiscalLabel.split('/').map(Number);
		const startISO = formatDate(new Date(startYear, 6, 1).toISOString()); // 1 July
		const endISO = formatDate(new Date(endYear, 5, 30, 23,59,59,999).toISOString()); // 30 June
		return { from: startISO, to: endISO, label: s.fiscalLabel };
	}
	return { from: '', to: '', label: '' };
}

async function renderAll() {
	await renderBankCards();
	await renderEntries();
	await renderReports();
}

async function renderBankCards() {
	const container = qs('#bankSummaryCards');
	container.innerHTML = '';
	for (const bank of state.banks) {
		const range = getDateRangeForPeriod();
		const entries = await db.getEntries({ bankId: bank.id, from: range.from, to: range.to });
		const { totalDebit, totalCredit, balance } = calculateBankBalance(bank.openingBalance, entries);
		const lastDate = entries.length ? entries.map(e=>e.date).sort().at(-1) : '';
		const el = document.createElement('div');
		el.className = 'card';
		el.innerHTML = `
			<div class="card-title" style="display:flex;justify-content:space-between;align-items:center;">
				<strong>${bank.name}</strong>
				<small>${bank.iban ? bank.iban : ''}</small>
			</div>
			<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
				<div><small>رصيد افتتاحي</small><div>${formatMoney(bank.openingBalance)}</div></div>
				<div><small>آخر تاريخ</small><div>${lastDate || '-'}</div></div>
				<div><small>إجمالي مدين</small><div class="ok">${formatMoney(totalDebit)}</div></div>
				<div><small>إجمالي دائن</small><div class="bad">${formatMoney(totalCredit)}</div></div>
				<div style="grid-column:1 / -1"><small>الرصيد الحالي</small><div><strong>${formatMoney(balance)}</strong></div></div>
			</div>
		`;
		container.appendChild(el);
	}
}

async function renderEntries() {
	const range = getDateRangeForPeriod();
	const bankId = state.currentBankId;
	if (!bankId) return;
	const all = await db.getEntries({ bankId, from: range.from, to: range.to });
	const debitList = all.filter(e=>e.type==='debit');
	const creditList = all.filter(e=>e.type==='credit');
	updateTable('debit', debitList);
	updateTable('credit', creditList);
	await updateReconcile(range);
}

function sortAndFilter(list, side) {
	const cfg = state[side];
	let filtered = list;
	if (cfg.search) {
		const s = cfg.search.trim();
		filtered = filtered.filter(r => r.description.includes(s));
	}
	filtered = filtered.sort((a,b)=>{
		const key = cfg.sortKey;
		const dir = cfg.sortDir === 'asc' ? 1 : -1;
		if (a[key] < b[key]) return -1*dir; if (a[key] > b[key]) return 1*dir; return 0;
	});
	return filtered;
}

function updateTable(side, list) {
	const cfg = state[side];
	const table = qs(`#table${side==='debit'?'Debit':'Credit'} tbody`);
	const head = qs(`#table${side==='debit'?'Debit':'Credit'} thead`);
	// sorting handlers
	qsa(`#table${side==='debit'?'Debit':'Credit'} thead th[data-sort]`).forEach(th=>{
		th.onclick = () => {
			const key = th.dataset.sort;
			if (cfg.sortKey === key) cfg.sortDir = cfg.sortDir === 'asc' ? 'desc' : 'asc';
			else { cfg.sortKey = key; cfg.sortDir = 'asc'; }
			renderEntries();
		};
	});
	const filtered = sortAndFilter(list, side);
	const total = sumBy(filtered, r=>r.amount);
	qs(`#${side}Summary`).textContent = `الإجمالي: ${formatMoney(total)}`;
	const totalPages = Math.max(1, Math.ceil(filtered.length / cfg.pageSize));
	cfg.page = clamp(cfg.page, 1, totalPages);
	const start = (cfg.page - 1) * cfg.pageSize;
	const pageRows = filtered.slice(start, start + cfg.pageSize);
	table.innerHTML = pageRows.map(r=>`
		<tr>
			<td>${escapeHtml(r.description)}</td>
			<td>${r.date}</td>
			<td>${formatMoney(r.amount)}</td>
			<td>
				<button class="btn" data-edit="${r.id}">تعديل</button>
				<button class="btn danger" data-del="${r.id}">حذف</button>
			</td>
		</tr>
	`).join('');
	// actions
	qsa(`[data-edit]`).forEach(btn => btn.onclick = () => openEditEntry(Number(btn.dataset.edit)));
	qsa(`[data-del]`).forEach(btn => btn.onclick = () => confirmDelete('entry', Number(btn.dataset.del)));
	// pagination
	const pag = qs(`#${side}Pagination`);
	pag.innerHTML = '';
	for (let i=1;i<=totalPages;i++) {
		const b = document.createElement('button'); b.textContent = i; if (i===cfg.page) b.classList.add('active'); b.onclick=()=>{cfg.page=i; updateTable(side, list);}; pag.appendChild(b);
	}
}

async function openEditEntry(id) {
	// fetch entry by scanning current range
	const range = getDateRangeForPeriod();
	const items = await db.getEntries({ bankId: state.currentBankId, from: range.from, to: range.to });
	const e = items.find(x=>x.id===id);
	if (!e) return;
	qs('#editEntryId').value = e.id;
	qs('#editEntryType').value = e.type;
	qs('#editEntryDate').value = e.date;
	qs('#editEntryAmount').value = e.amount;
	qs('#editEntryDesc').value = e.description;
	qs('#updateEntry').onclick = async () => {
		const updated = {
			id: e.id,
			bankId: e.bankId,
			type: qs('#editEntryType').value,
			date: formatDate(qs('#editEntryDate').value),
			amount: parseMoney(qs('#editEntryAmount').value),
			description: qs('#editEntryDesc').value.trim()
		};
		if (!(updated.amount>0)) { alert('المبلغ يجب أن يكون أكبر من صفر'); return; }
		await db.updateEntry(updated);
		closeModal('#entryModal');
		await renderEntries();
	};
	openModal('#entryModal');
}

function exportSide(side) {
	const bank = state.banks.find(b=>b.id===state.currentBankId);
	if (!bank) return;
	const range = getDateRangeForPeriod();
	db.getEntries({ bankId: bank.id, from: range.from, to: range.to, type: side }).then(rows => {
		const s = state[side];
		const filtered = sortAndFilter(rows, side);
		// choose month/year when in month mode
		let month = new Date().getMonth()+1, year = new Date().getFullYear();
		if (state.period.mode === 'month') { month = state.period.month; year = state.period.year; }
		exportExcel.bankSide(bank.name, side==='debit'?'مدين':'دائن', filtered, month, year);
	});
}

async function updateReconcile(range) {
	const bankId = state.currentBankId; if (!bankId) return;
	const day = formatDate(qs('#reconcileDate').value || range.from);
	const dayEntries = await db.getEntries({ bankId, from: day, to: day });
	const net = sumBy(dayEntries.filter(e=>e.type==='debit'), e=>e.amount) - sumBy(dayEntries.filter(e=>e.type==='credit'), e=>e.amount);
	qs('#systemComputedBalance').value = net.toFixed(2);
	const input = parseMoney(qs('#bankStatementBalance').value);
	const diff = Number((input - net).toFixed(2));
	const res = qs('#reconcileResult');
	if (input === 0) { res.textContent = ''; return; }
	res.innerHTML = diff === 0 ? `<span class="ok">متطابق ✅</span>` : `<span class="bad">غير متطابق ❌</span> فرق: ${formatMoney(Math.abs(diff))}`;
}

function onReconcileChange() {
	const range = getDateRangeForPeriod();
	updateReconcile(range);
}

async function renderReports() {
	await renderMonthlyGrid();
	await renderYearlySummary();
}

async function renderMonthlyGrid() {
	const grid = qs('#monthlyGrid');
	grid.innerHTML = '';
	const bank = state.banks.find(b=>b.id===state.currentBankId);
	if (!bank) { grid.innerHTML = '<div class="muted">لا توجد بنوك</div>'; return; }
	// Determine fiscal year
	const [startYear, endYear] = state.period.fiscalLabel.split('/').map(Number);
	// months July..June
	const months = [7,8,9,10,11,12,1,2,3,4,5,6];
	for (const m of months) {
		const year = m >= 7 ? startYear : endYear;
		const r = monthRange(year, m-1);
		const entries = await db.getEntries({ bankId: bank.id, from: r.startISO, to: r.endISO });
		const totalDebit = sumBy(entries.filter(e=>e.type==='debit'), e=>e.amount);
		const totalCredit = sumBy(entries.filter(e=>e.type==='credit'), e=>e.amount);
		const balance = bank.openingBalance + totalDebit - totalCredit; // للعرض الشهري
		const card = document.createElement('div');
		card.className = 'month-card';
		card.innerHTML = `
			<div><strong>${monthNameAr(m-1)} ${year}</strong></div>
			<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;">
				<div><small>مدين</small><div class="ok">${formatMoney(totalDebit)}</div></div>
				<div><small>دائن</small><div class="bad">${formatMoney(totalCredit)}</div></div>
				<div style="grid-column:1/-1"><small>الرصيد</small><div><strong>${formatMoney(balance)}</strong></div></div>
			</div>
		`;
		card.onclick = () => openMonthDetail(bank, m, year);
		grid.appendChild(card);
	}
}

async function openMonthDetail(bank, month, year) {
	const r = monthRange(year, month-1);
	const entries = await db.getEntries({ bankId: bank.id, from: r.startISO, to: r.endISO });
	const deb = entries.filter(e=>e.type==='debit');
	const cre = entries.filter(e=>e.type==='credit');
	const totals = { totalDebit: sumBy(deb, e=>e.amount), totalCredit: sumBy(cre, e=>e.amount) };
	totals.balance = bank.openingBalance + totals.totalDebit - totals.totalCredit;
	if (!confirm(`تصدير ${bank.name} لشهر ${monthNameAr(month-1)} ${year}؟`)) return;
	exportExcel.bankMonth(bank, month, year, deb, cre, totals);
}

async function renderYearlySummary() {
	const [startYear, endYear] = state.period.fiscalLabel.split('/').map(Number);
	const range = { from: formatDate(new Date(startYear, 6, 1).toISOString()), to: formatDate(new Date(endYear, 5, 30, 23,59,59,999).toISOString()), label: `${startYear}/${endYear}` };
	const tbody = qs('#yearlyTable tbody');
	tbody.innerHTML = '';
	let grandDebit = 0, grandCredit = 0, grandCount = 0;
	const labels = [], balances = [];
	for (const bank of state.banks) {
		const entries = await db.getEntries({ bankId: bank.id, from: range.from, to: range.to });
		const totalDebit = sumBy(entries.filter(e=>e.type==='debit'), e=>e.amount);
		const totalCredit = sumBy(entries.filter(e=>e.type==='credit'), e=>e.amount);
		const balance = bank.openingBalance + totalDebit - totalCredit;
		grandDebit += totalDebit; grandCredit += totalCredit; grandCount += entries.length;
		labels.push(bank.name); balances.push(Number(balance.toFixed(2)));
		const tr = document.createElement('tr');
		tr.innerHTML = `<td>${bank.name}</td><td>${formatMoney(totalDebit)}</td><td>${formatMoney(totalCredit)}</td><td>${formatMoney(balance)}</td><td>${entries.length}</td>`;
		tbody.appendChild(tr);
	}
	qs('#grandDebit').textContent = formatMoney(grandDebit);
	qs('#grandCredit').textContent = formatMoney(grandCredit);
	qs('#grandBalance').textContent = formatMoney(grandDebit - grandCredit);
	qs('#grandCount').textContent = String(grandCount);
	const ctx = qs('#yearlyDoughnut').getContext('2d');
	renderYearlyDoughnut(ctx, labels, balances);
}

async function onExportYearExcel() {
	const [startYear, endYear] = state.period.fiscalLabel.split('/').map(Number);
	const range = { from: formatDate(new Date(startYear, 6, 1).toISOString()), to: formatDate(new Date(endYear, 5, 30, 23,59,59,999).toISOString()), label: `${startYear}/${endYear}` };
	const perBank = [];
	for (const bank of state.banks) {
		const entries = await db.getEntries({ bankId: bank.id, from: range.from, to: range.to });
		const totalDebit = sumBy(entries.filter(e=>e.type==='debit'), e=>e.amount);
		const totalCredit = sumBy(entries.filter(e=>e.type==='credit'), e=>e.amount);
		perBank.push({ bankName: bank.name, totalDebit, totalCredit, balance: totalDebit - totalCredit, count: entries.length });
	}
	const summary = { label: range.label, perBank };
	exportExcel.fiscalYear(summary);
}

function updatePeriodDefaults() {
	const today = formatDate(new Date().toISOString());
	qs('#filterDay').value = today;
	qs('#filterFrom').value = today;
	qs('#filterTo').value = today;
	qs('#filterMonth').value = String(new Date().getMonth()+1);
	qs('#filterYear').value = String(new Date().getFullYear());
}

function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

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
