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
	if (qs('#filterDay')) qs('#filterDay').addEventListener('change', () => { state.period.day = qs('#filterDay').value; renderAll(); });
	if (qs('#filterFrom')) qs('#filterFrom').addEventListener('change', () => { state.period.from = qs('#filterFrom').value; renderAll(); });
	if (qs('#filterTo')) qs('#filterTo').addEventListener('change', () => { state.period.to = qs('#filterTo').value; renderAll(); });
	if (qs('#filterMonth')) qs('#filterMonth').addEventListener('change', () => { state.period.month = Number(qs('#filterMonth').value); renderAll(); });
	if (qs('#filterYear')) qs('#filterYear').addEventListener('change', () => { state.period.year = Number(qs('#filterYear').value); renderAll(); });
	if (qs('#filterFiscal')) qs('#filterFiscal').addEventListener('change', () => { state.period.fiscalLabel = qs('#filterFiscal').value; renderAll(); });

	// init month/year selects
	if (qs('#filterMonth')) qs('#filterMonth').innerHTML = AR_MONTHS.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');
	if (qs('#filterYear')) {
		const y = new Date().getFullYear();
		const years = [y-1, y, y+1];
		qs('#filterYear').innerHTML = years.map(yy=>`<option value="${yy}">${yy}</option>`).join('');
	}
}

async function loadSettings() {
	const s = await db.getSettings(['fixedDate','fiscalStartMonth','fiscalEndMonth']);
	state.fixedDate = s.fixedDate || null;
	if (qs('#toggleFixedDate')) qs('#toggleFixedDate').checked = !!state.fixedDate;
	if (qs('#fixedDateInput')) qs('#fixedDateInput').value = state.fixedDate || '';
	if (qs('#toggleFixedDate')) qs('#toggleFixedDate').addEventListener('change', async (e) => {
		if (e.target.checked) {
			state.fixedDate = formatDate(qs('#fixedDateInput').value || new Date().toISOString());
			await db.setSetting('fixedDate', state.fixedDate);
		} else {
			state.fixedDate = null;
			await db.setSetting('fixedDate', null);
		}
		applyFixedDateToInputs();
	});
	if (qs('#fixedDateInput')) qs('#fixedDateInput').addEventListener('change', async () => {
		state.fixedDate = formatDate(qs('#fixedDateInput').value);
		await db.setSetting('fixedDate', state.fixedDate);
		applyFixedDateToInputs();
	});

	// fiscal select
	const now = new Date();
	const startM = s.fiscalStartMonth || 7, endM = s.fiscalEndMonth || 6;
	const curr = fiscalRangeFor(now, startM, endM);
	const prev = fiscalRangeFor(new Date(now.getFullYear()-1, now.getMonth(), now.getDate()), startM, endM);
	if (qs('#filterFiscal')) {
		qs('#filterFiscal').innerHTML = [curr.label, prev.label].map(l=>`<option value="${l}">${l}</option>`).join('');
		state.period.fiscalLabel = curr.label;
	}
}

function applyFixedDateToInputs() {
	const setIf = (sel, val) => { const el = qs(sel); if (el) el.value = val; };
	const today = state.fixedDate || formatDate(new Date().toISOString());
	setIf('#entryDate', today);
	setIf('#reconcileDate', today);
	setIf('#debitDate', today);
	setIf('#creditDate', today);
}

function onPeriodChange() {
	const mode = qsa('input[name="period"]').find(r=>r.checked)?.value || 'day';
	state.period.mode = mode;
	qsa('.filter').forEach(f=>f.classList.add('hidden'));
	const el = qs(`.filter-${mode}`); if (el) el.classList.remove('hidden');
	renderAll();
}

async function loadBanks() {
	state.banks = await db.listBanks();
	const sel = qs('#currentBank');
	const last = localStorage.getItem('currentBankId');
	if (sel) sel.innerHTML = state.banks.map(b=>`<option value="${b.id}">${b.name}</option>`).join('');
	if (last && state.banks.some(b=>String(b.id)===String(last))) {
		if (sel) sel.value = String(last);
		state.currentBankId = Number(last);
	} else if (state.banks[0]) {
		state.currentBankId = state.banks[0].id;
		if (sel) sel.value = String(state.currentBankId);
	}
	if (sel) sel.addEventListener('change', () => {
		state.currentBankId = Number(sel.value);
		localStorage.setItem('currentBankId', String(state.currentBankId));
		renderAll();
	});
}

function initBankActions() {
	if (qs('#btnAddBank')) qs('#btnAddBank').addEventListener('click', () => openBankModal());
	if (qs('#btnEditBank')) qs('#btnEditBank').addEventListener('click', () => {
		const b = state.banks.find(b=>b.id===state.currentBankId);
		if (b) openBankModal(b);
	});
	if (qs('#btnDeleteBank')) qs('#btnDeleteBank').addEventListener('click', () => confirmDelete('bank', state.currentBankId));
	if (qs('#saveBank')) qs('#saveBank').addEventListener('click', onSaveBank);
	qsa('[data-close]').forEach(btn => btn.addEventListener('click', ()=>closeModal(btn.dataset.close)));
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

function openModal(sel) { const el = qs(sel); if (el) el.setAttribute('aria-hidden', 'false'); }
function closeModal(sel) { const el = qs(sel); if (el) el.setAttribute('aria-hidden', 'true'); }

function initEntryActions() {
	// debit/credit add-clear
	const btnAddDebit = qs('#btnAddDebit');
	if (btnAddDebit) btnAddDebit.addEventListener('click', onAddDebit);
	const btnClearDebit = qs('#btnClearDebit');
	if (btnClearDebit) btnClearDebit.addEventListener('click', () => { const a=qs('#debitAmount'); if(a) a.value=''; const d=qs('#debitDesc'); if(d) d.value=''; });
	const btnAddCredit = qs('#btnAddCredit');
	if (btnAddCredit) btnAddCredit.addEventListener('click', onAddCredit);
	const btnClearCredit = qs('#btnClearCredit');
	if (btnClearCredit) btnClearCredit.addEventListener('click', () => { const a=qs('#creditAmount'); if(a) a.value=''; const d=qs('#creditDesc'); if(d) d.value=''; });
	// search
	if (qs('#searchDebit')) qs('#searchDebit').addEventListener('input', () => { state.debit.search = qs('#searchDebit').value; state.debit.page=1; renderEntries(); });
	if (qs('#searchCredit')) qs('#searchCredit').addEventListener('input', () => { state.credit.search = qs('#searchCredit').value; state.credit.page=1; renderEntries(); });
	// export side
	if (qs('#exportDebit')) qs('#exportDebit').addEventListener('click', () => exportSide('debit'));
	if (qs('#exportCredit')) qs('#exportCredit').addEventListener('click', () => exportSide('credit'));
	// yearly export/print
	if (qs('#btnExportYearExcel')) qs('#btnExportYearExcel').addEventListener('click', onExportYearExcel);
	if (qs('#btnPrintYear')) qs('#btnPrintYear').addEventListener('click', () => window.print());
	// reconcile (optional)
	if (qs('#reconcileDate')) qs('#reconcileDate').addEventListener('change', onReconcileChange);
	if (qs('#bankStatementBalance')) qs('#bankStatementBalance').addEventListener('input', onReconcileChange);
	if (qs('#btnSaveReconcile')) qs('#btnSaveReconcile').addEventListener('click', () => alert('تم الحفظ (صوري).'));
}

function initBackupActions() {
	if (qs('#btnExportJSON')) qs('#btnExportJSON').addEventListener('click', () => backup.exportJSON(db));
	if (qs('#importJSONInput')) qs('#importJSONInput').addEventListener('change', async (e) => {
		const file = e.target.files[0]; if (!file) return;
		if (!confirm('سيتم استبدال البيانات الحالية. متابعة؟')) return;
		try { await backup.importJSON(db, file); await loadBanks(); await renderAll(); alert('تم الاستيراد بنجاح'); }
		catch (err) { alert(err.message || 'فشل الاستيراد'); }
	});
}

async function onAddDebit() {
	const bankId = state.currentBankId; if (!bankId) { alert('اختر بنكاً أولاً'); return; }
	const date = formatDate(state.fixedDate || (qs('#debitDate')?.value || new Date().toISOString()));
	const amount = parseMoney(qs('#debitAmount')?.value);
	const description = (qs('#debitDesc')?.value || '').trim();
	if (!description) { alert('البيان مطلوب'); return; }
	if (!(amount > 0)) { alert('المبلغ يجب أن يكون أكبر من صفر'); return; }
	await db.addEntry({ bankId, type: 'debit', description, date, amount });
	if (qs('#debitAmount')) qs('#debitAmount').value = '';
	if (qs('#debitDesc')) qs('#debitDesc').value = '';
	await renderEntries();
}

async function onAddCredit() {
	const bankId = state.currentBankId; if (!bankId) { alert('اختر بنكاً أولاً'); return; }
	const date = formatDate(state.fixedDate || (qs('#creditDate')?.value || new Date().toISOString()));
	const amount = parseMoney(qs('#creditAmount')?.value);
	const description = (qs('#creditDesc')?.value || '').trim();
	if (!description) { alert('البيان مطلوب'); return; }
	if (!(amount > 0)) { alert('المبلغ يجب أن يكون أكبر من صفر'); return; }
	await db.addEntry({ bankId, type: 'credit', description, date, amount });
	if (qs('#creditAmount')) qs('#creditAmount').value = '';
	if (qs('#creditDesc')) qs('#creditDesc').value = '';
	await renderEntries();
}

function getDateRangeForPeriod() {
	const s = state.period;
	if (s.mode === 'day') {
		const day = formatDate(qs('#filterDay')?.value || new Date().toISOString());
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
	const container = qs('#bankSummaryCards'); if (!container) return;
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
	if (qs('#reconcileDate')) await updateReconcile(range);
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
	const summaryEl = qs(`#${side}Summary`);
	if (summaryEl) summaryEl.textContent = `الإجمالي: ${formatMoney(total)}`;
	const totalPages = Math.max(1, Math.ceil(filtered.length / cfg.pageSize));
	cfg.page = clamp(cfg.page, 1, totalPages);
	const start = (cfg.page - 1) * cfg.pageSize;
	const pageRows = filtered.slice(start, start + cfg.pageSize);
	if (table) table.innerHTML = pageRows.map(r=>`
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
	if (pag) {
		pag.innerHTML = '';
		for (let i=1;i<=totalPages;i++) {
			const b = document.createElement('button'); b.textContent = i; if (i===cfg.page) b.classList.add('active'); b.onclick=()=>{cfg.page=i; updateTable(side, list);}; pag.appendChild(b);
		}
	}
}

async function openEditEntry(id) {
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
		const filtered = sortAndFilter(rows, side);
		let month = new Date().getMonth()+1, year = new Date().getFullYear();
		if (state.period.mode === 'month') { month = state.period.month; year = state.period.year; }
		exportExcel.bankSide(bank.name, side==='debit'?'مدين':'دائن', filtered, month, year);
	});
}

async function updateReconcile(range) {
	const bankId = state.currentBankId; if (!bankId) return;
	const day = formatDate(qs('#reconcileDate')?.value || range.from);
	const dayEntries = await db.getEntries({ bankId, from: day, to: day });
	const net = sumBy(dayEntries.filter(e=>e.type==='debit'), e=>e.amount) - sumBy(dayEntries.filter(e=>e.type==='credit'), e=>e.amount);
	if (qs('#systemComputedBalance')) qs('#systemComputedBalance').value = net.toFixed(2);
	const input = parseMoney(qs('#bankStatementBalance')?.value);
	const diff = Number((input - net).toFixed(2));
	const res = qs('#reconcileResult');
	if (!res) return;
	if (!qs('#bankStatementBalance')?.value) { res.textContent = ''; return; }
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
	const grid = qs('#monthlyGrid'); if (!grid) return;
	grid.innerHTML = '';
	const bank = state.banks.find(b=>b.id===state.currentBankId);
	if (!bank) { grid.innerHTML = '<div class="muted">لا توجد بنوك</div>'; return; }
	const [startYear, endYear] = (state.period.fiscalLabel || '').split('/').map(Number);
	const months = [7,8,9,10,11,12,1,2,3,4,5,6];
	for (const m of months) {
		const year = startYear && endYear ? (m >= 7 ? startYear : endYear) : new Date().getFullYear();
		const r = monthRange(year, m-1);
		const entries = await db.getEntries({ bankId: bank.id, from: r.startISO, to: r.endISO });
		const totalDebit = sumBy(entries.filter(e=>e.type==='debit'), e=>e.amount);
		const totalCredit = sumBy(entries.filter(e=>e.type==='credit'), e=>e.amount);
		const balance = bank.openingBalance + totalDebit - totalCredit;
		const card = document.createElement('div');
		card.className = 'month-card';
		card.innerHTML = `
			<div><strong>${monthNameAr(m-1)} ${year}</strong></div>
			<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;">
				<div><small>مدين</small><div class="ok">${formatMoney(totalDebit)}</div></div>
				<div><small>دائن</small><div class="bad">${formatMoney(totalCredit)}</div></div>
				<div style=\"grid-column:1/-1\"><small>الرصيد</small><div><strong>${formatMoney(balance)}</strong></div></div>
			</div>`;
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
	const [startYear, endYear] = (state.period.fiscalLabel || '').split('/').map(Number);
	if (!startYear || !endYear) return;
	const range = { from: formatDate(new Date(startYear, 6, 1).toISOString()), to: formatDate(new Date(endYear, 5, 30, 23,59,59,999).toISOString()), label: `${startYear}/${endYear}` };
	const tbody = qs('#yearlyTable tbody'); if (!tbody) return;
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
	if (qs('#grandDebit')) qs('#grandDebit').textContent = formatMoney(grandDebit);
	if (qs('#grandCredit')) qs('#grandCredit').textContent = formatMoney(grandCredit);
	if (qs('#grandBalance')) qs('#grandBalance').textContent = formatMoney(grandDebit - grandCredit);
	if (qs('#grandCount')) qs('#grandCount').textContent = String(grandCount);
	const canvas = qs('#yearlyDoughnut'); if (canvas) {
		const ctx = canvas.getContext('2d');
		renderYearlyDoughnut(ctx, labels, balances);
	}
}

async function onExportYearExcel() {
	const [startYear, endYear] = (state.period.fiscalLabel || '').split('/').map(Number);
	if (!startYear || !endYear) return;
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
	if (qs('#filterDay')) qs('#filterDay').value = today;
	if (qs('#filterFrom')) qs('#filterFrom').value = today;
	if (qs('#filterTo')) qs('#filterTo').value = today;
	if (qs('#filterMonth')) qs('#filterMonth').value = String(new Date().getMonth()+1);
	if (qs('#filterYear')) qs('#filterYear').value = String(new Date().getFullYear());
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }