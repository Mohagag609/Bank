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
