// أدوات مساعدة للتواريخ والأرقام والسنة المالية

export const AR_MONTHS = [
	"يناير","فبراير","مارس","أبريل","مايو","يونيو",
	"يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"
];

export function monthNameAr(mIndex) {
	return AR_MONTHS[mIndex] || "";
}

export function formatMoney(value) {
	if (value === null || value === undefined || Number.isNaN(value)) return "0.00";
	try {
		return Number(value).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 });
	} catch {
		return `${Number(value).toFixed(2)} ج.م`;
	}
}

export function parseMoney(input) {
	if (typeof input === 'number') return input;
	if (!input) return 0;
	const cleaned = String(input).replace(/[^\d.\-]/g, '');
	const n = Number.parseFloat(cleaned);
	return Number.isNaN(n) ? 0 : n;
}

export function formatDate(iso) {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function isValidDateISO(iso) {
	const d = new Date(iso);
	return !Number.isNaN(d.getTime());
}

export function startOfDayISO(date) {
	const d = new Date(date);
	d.setHours(0,0,0,0);
	return formatDate(d.toISOString());
}

export function endOfDayISO(date) {
	const d = new Date(date);
	d.setHours(23,59,59,999);
	return formatDate(d.toISOString());
}

export function fiscalRangeFor(dateNow, startMonth = 7, endMonth = 6) {
	// startMonth: 1-12, default 7 (يوليو)
	const d = new Date(dateNow);
	const year = d.getFullYear();
	const currentMonth = d.getMonth() + 1;
	let startYear, endYear;
	if (currentMonth >= startMonth) {
		startYear = year;
		endYear = year + 1;
	} else {
		startYear = year - 1;
		endYear = year;
	}
	const start = new Date(startYear, startMonth - 1, 1);
	const end = new Date(endYear, endMonth - 1, 30, 23, 59, 59, 999);
	return { startISO: formatDate(start.toISOString()), endISO: formatDate(end.toISOString()), label: `${startYear}/${endYear}` };
}

export function monthRange(year, monthIndexZeroBased) {
	const start = new Date(year, monthIndexZeroBased, 1);
	const end = new Date(year, monthIndexZeroBased + 1, 0, 23,59,59,999);
	return { startISO: formatDate(start.toISOString()), endISO: formatDate(end.toISOString()) };
}

export function sumBy(items, selector) {
	return items.reduce((acc, it) => acc + (selector(it) || 0), 0);
}

export function groupBy(items, keyFn) {
	return items.reduce((map, it) => {
		const k = keyFn(it);
		(map[k] ||= []).push(it);
		return map;
	}, {});
}

export function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

// حاسبة الرصيد للبنك ضمن نطاق
export function calculateBankBalance(openingBalance, entries) {
	const totalDebit = sumBy(entries.filter(e => e.type === 'debit'), e => e.amount);
	const totalCredit = sumBy(entries.filter(e => e.type === 'credit'), e => e.amount);
	return { totalDebit, totalCredit, balance: Number(openingBalance || 0) + totalDebit - totalCredit };
}

// Utility functions (date, number formatting) will go here.
console.log("utils.js loaded");

export function formatMoney(amount) {
    // More robust formatter
    const options = { style: 'currency', currency: 'EGP', minimumFractionDigits: 2 };
    return new Intl.NumberFormat('ar-EG', options).format(amount || 0);
}

export function formatDate(isoString) {
    if (!isoString) return '---';
    // Returns date in YYYY-MM-DD format for input fields
    return isoString.split('T')[0];
}

export function displayDate(isoString) {
    if (!isoString) return '---';
    // Returns date in a user-friendly format
    return new Date(isoString).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

const ARABIC_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/**
 * Returns the Arabic name of a month.
 * @param {number} monthNumber - The month number (1-12).
 * @returns {string} The Arabic month name.
 */
export function getArabicMonthName(monthNumber) {
    if (monthNumber < 1 || monthNumber > 12) {
        return '';
    }
    return ARABIC_MONTHS[monthNumber - 1];
}

/**
 * Calculates the fiscal year range for a given date.
 * The default fiscal year starts in July (month 7).
 * @param {Date} [date=new Date()] The date to get the fiscal year for.
 * @param {number} [startMonth=7] The starting month of the fiscal year (1-12).
 * @returns {{start: Date, end: Date, label: string}} An object with start date, end date, and a label like "2023/2024".
 */
export function getFiscalYearRange(date = new Date(), startMonth = 7) {
    let startYear = date.getFullYear();
    const currentMonth = date.getMonth() + 1; // 1-12

    if (currentMonth < startMonth) {
        startYear -= 1;
    }

    const fiscalStart = new Date(startYear, startMonth - 1, 1);
    // The end of the fiscal year is the day before the start of the next one.
    const fiscalEnd = new Date(startYear + 1, startMonth - 1, 0);

    const label = `${fiscalStart.getFullYear()}/${fiscalEnd.getFullYear()}`;

    return {
        start: fiscalStart,
        end: fiscalEnd,
        label: label
    };
}

/**
 * Returns the ISO date string for the day before the given date.
 * @param {string} isoDateString - The date in "YYYY-MM-DD" format.
 * @returns {string} The previous day's date in "YYYY-MM-DD" format.
 */
export function getPreviousDayISO(isoDateString) {
    const date = new Date(isoDateString);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
}
