/**
 * charts-manager.js - Chart.js Visualizations for CSP Evaluation & Dashboard
 * Implements Apple-styled glassmorphic charts with dark/light theme awareness.
 */

class ChartsManager {
    constructor() {
        this.backtracksChart = null;
        this.runtimeChart = null;
        this.miniConflictChart = null;
        this.miniBacktracksChart = null;
    }

    getThemeColors() {
        const isDark = document.documentElement.classList.contains('dark-theme') ||
                       document.body.classList.contains('dark-theme');
        return {
            textColor: isDark ? '#E5E5EA' : '#1C1C1E',
            mutedColor: isDark ? '#8E8E93' : '#8E8E93',
            gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            tooltipBg: isDark ? 'rgba(28, 28, 30, 0.92)' : 'rgba(255, 255, 255, 0.92)',
            tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
        };
    }

    initMiniDashboardCharts(conflictData, comparisonResult = null) {
        if (typeof Chart === 'undefined') return;
        const theme = this.getThemeColors();

        // Mini Conflict Degree Distribution
        const conflictCanvas = document.getElementById('dashConflictMiniChart');
        if (conflictCanvas) {
            if (this.miniConflictChart) this.miniConflictChart.destroy();

            const courseLabels = conflictData.courses.map(c => c.code);
            const conflictDegrees = conflictData.courses.map(c => (conflictData.conflicts.get(c.id) || new Set()).size);

            this.miniConflictChart = new Chart(conflictCanvas, {
                type: 'bar',
                data: {
                    labels: courseLabels,
                    datasets: [{
                        label: 'Conflicting Courses',
                        data: conflictDegrees,
                        backgroundColor: 'rgba(255, 69, 58, 0.65)',
                        borderColor: '#FF453A',
                        borderWidth: 1.5,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 600 },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: theme.tooltipBg,
                            titleColor: theme.textColor,
                            bodyColor: theme.textColor,
                            borderColor: theme.tooltipBorder,
                            borderWidth: 1,
                            cornerRadius: 8
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: theme.mutedColor, font: { size: 10 } }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: theme.gridColor },
                            ticks: { color: theme.mutedColor, font: { size: 10 }, stepSize: 1 }
                        }
                    }
                }
            });
        }
    }

    updateEvaluationCharts(comparison) {
        if (typeof Chart === 'undefined' || !comparison) return;
        const theme = this.getThemeColors();

        const labels = ['MRV (Min Remaining Values)', 'FVO (Fixed Ordering)'];
        const backtrackData = [comparison.mrv.backtracks, comparison.fvo.backtracks];
        const runtimeData = [comparison.mrv.executionTimeMs, comparison.fvo.executionTimeMs];

        // 1. Backtracking Operations Chart
        const btCanvas = document.getElementById('backtracksComparisonChart');
        if (btCanvas) {
            if (this.backtracksChart) this.backtracksChart.destroy();

            this.backtracksChart = new Chart(btCanvas, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Backtracking Operations',
                        data: backtrackData,
                        backgroundColor: [
                            'rgba(10, 132, 255, 0.75)', // Apple Blue for MRV
                            'rgba(255, 159, 10, 0.75)'  // Amber for Fixed Ordering
                        ],
                        borderColor: ['#0A84FF', '#FF9F0A'],
                        borderWidth: 1.5,
                        borderRadius: 8,
                        barPercentage: 0.55
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 800, easing: 'easeOutQuart' },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: theme.tooltipBg,
                            titleColor: theme.textColor,
                            bodyColor: theme.textColor,
                            borderColor: theme.tooltipBorder,
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 10,
                            callbacks: {
                                label: (ctx) => ` Backtracks: ${ctx.parsed.y} operations`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: theme.textColor, font: { family: '-apple-system', weight: '600', size: 12 } }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: theme.gridColor },
                            ticks: { color: theme.mutedColor, font: { family: '-apple-system', size: 11 }, precision: 0 }
                        }
                    }
                }
            });
        }

        // 2. Execution Time Chart (ms)
        const timeCanvas = document.getElementById('executionTimeChart');
        if (timeCanvas) {
            if (this.runtimeChart) this.runtimeChart.destroy();

            this.runtimeChart = new Chart(timeCanvas, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Execution Time (ms)',
                        data: runtimeData,
                        backgroundColor: [
                            'rgba(48, 209, 88, 0.75)', // Mint Green for MRV
                            'rgba(191, 90, 242, 0.75)' // Soft Violet for Fixed Ordering
                        ],
                        borderColor: ['#30D158', '#BF5AF2'],
                        borderWidth: 1.5,
                        borderRadius: 8,
                        barPercentage: 0.55
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 800, easing: 'easeOutQuart' },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: theme.tooltipBg,
                            titleColor: theme.textColor,
                            bodyColor: theme.textColor,
                            borderColor: theme.tooltipBorder,
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 10,
                            callbacks: {
                                label: (ctx) => ` Runtime: ${ctx.parsed.y.toFixed(3)} ms`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: theme.textColor, font: { family: '-apple-system', weight: '600', size: 12 } }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: theme.gridColor },
                            ticks: { color: theme.mutedColor, font: { family: '-apple-system', size: 11 } }
                        }
                    }
                }
            });
        }
    }

    refreshTheme() {
        const theme = this.getThemeColors();
        const updateInstance = (chart) => {
            if (!chart) return;
            if (chart.options.scales.x) {
                chart.options.scales.x.ticks.color = theme.textColor;
            }
            if (chart.options.scales.y) {
                chart.options.scales.y.grid.color = theme.gridColor;
                chart.options.scales.y.ticks.color = theme.mutedColor;
            }
            if (chart.options.plugins.tooltip) {
                chart.options.plugins.tooltip.backgroundColor = theme.tooltipBg;
                chart.options.plugins.tooltip.titleColor = theme.textColor;
                chart.options.plugins.tooltip.bodyColor = theme.textColor;
                chart.options.plugins.tooltip.borderColor = theme.tooltipBorder;
            }
            chart.update();
        };

        updateInstance(this.backtracksChart);
        updateInstance(this.runtimeChart);
        updateInstance(this.miniConflictChart);
        updateInstance(this.miniBacktracksChart);
    }
}

window.chartsManager = new ChartsManager();

