// وظائف الرسم باستخدام Chart.js

let yearlyDoughnutChart = null;

export function renderYearlyDoughnut(ctx, labels, values) {
	if (yearlyDoughnutChart) {
		yearlyDoughnutChart.destroy();
	}
	yearlyDoughnutChart = new Chart(ctx, {
		type: 'doughnut',
		data: {
			labels,
			datasets: [{
				data: values,
				backgroundColor: [
					'#2563eb','#16a34a','#eab308','#ef4444','#8b5cf6','#06b6d4','#f97316','#22c55e'
				]
			}]
		},
		options: {
			plugins: { legend: { position: 'bottom' } }
		}
	});
}

export function renderMonthlySeries(ctx, labels, debitSeries, creditSeries, balanceSeries) {
	return new Chart(ctx, {
		type: 'bar',
		data: {
			labels,
			datasets: [
				{ type: 'bar', label: 'مدين', data: debitSeries, backgroundColor: '#22c55e' },
				{ type: 'bar', label: 'دائن', data: creditSeries, backgroundColor: '#ef4444' },
				{ type: 'line', label: 'الرصيد', data: balanceSeries, borderColor: '#2563eb', backgroundColor: 'transparent' }
			]
		},
		options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
	});
}

// Chart.js integration logic.
console.log("charts.js loaded");

let currentChart = null;

/**
 * Destroys the existing chart instance on a canvas if it exists.
 * @param {HTMLCanvasElement} canvasElement The canvas element.
 */
function destroyChart(canvasElement) {
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
}

/**
 * Creates a doughnut chart showing the distribution of final balances among banks.
 * @param {string} canvasId - The ID of the canvas element.
 * @param {object} reportData - The data from generateYearlyReportData.
 */
export function createBankDistributionChart(canvasId, reportData) {
    const canvasElement = document.getElementById(canvasId);
    if (!canvasElement) return;

    destroyChart(canvasElement);

    const labels = reportData.perBank.map(b => b.bankName);
    const data = reportData.perBank.map(b => b.finalBalance);

    // Using a predefined color palette for better visuals
    const backgroundColors = [
        '#3b82f6', '#16a34a', '#ef4444', '#f97316', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'
    ];

    currentChart = new Chart(canvasElement, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'الرصيد النهائي',
                data: data,
                backgroundColor: backgroundColors,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            family: "'Cairo', sans-serif",
                            size: 14
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'توزيع الأرصدة النهائية بين البنوك',
                    font: {
                        family: "'Cairo', sans-serif",
                        size: 18,
                        weight: '600'
                    }
                }
            }
        }
    });
}

/**
 * Creates a line chart showing the monthly balance trend.
 * @param {string} canvasId - The ID of the canvas element.
 * @param {object} reportData - The data from generateMonthlyComparativeReportData.
 * @param {object} utils - The utils module for getting month names.
 */
export function createMonthlyBalanceChart(canvasId, reportData, utils) {
    const canvasElement = document.getElementById(canvasId);
    if (!canvasElement) return;

    destroyChart(canvasElement);

    const labels = reportData.perMonth.map(m => utils.getArabicMonthName(m.month));
    const data = reportData.perMonth.map(m => m.balance);

    currentChart = new Chart(canvasElement, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'الرصيد في نهاية الشهر',
                data: data,
                fill: false,
                borderColor: 'var(--primary-color)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'تطور الرصيد الشهري',
                    font: {
                        family: "'Cairo', sans-serif",
                        size: 18,
                        weight: '600'
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: function(value, index, values) {
                            return utils.formatMoney(value);
                        }
                    }
                }
            }
        }
    });
}
