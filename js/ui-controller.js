/**
 * ui-controller.js - User Interface Controller for Examination CSP Scheduler
 * Handles navigation, theme switching, animated counters, modal dialogs,
 * toasts, preset loading, and file import/export.
 */

class UIController {
    constructor() {
        this.currentTab = 'dashboard';
        this.theme = localStorage.getItem('aies_theme') || 'dark';
        this.activeComparison = null;
        this.activeSchedule = null; // Map(courseId -> slotId)
        this.activeAlgorithm = 'MRV'; // 'MRV' or 'FVO'
    }

    init() {
        this.applyTheme(this.theme);
        this.bindEvents();
        this.setupIcons();
    }

    setupIcons() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    bindEvents() {
        // Theme toggle
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => this.toggleTheme());
        }

        // Navigation links
        const navLinks = document.querySelectorAll('[data-nav-target]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('data-nav-target');
                this.switchTab(target);
            });
        });

        // Preset selector
        const presetSelect = document.getElementById('presetSelector');
        if (presetSelect) {
            presetSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                if (val === 'default') window.enrolmentManager.loadDefaultSample();
                else if (val === 'university') window.enrolmentManager.loadUniversityBenchmark();
                else if (val === 'dense') window.enrolmentManager.loadDenseStressBenchmark();
                else if (val === 'pigeonhole') window.enrolmentManager.loadPigeonholeUnsolvable();
                this.showToast('Loaded preset: ' + e.target.options[e.target.selectedIndex].text, 'info');
            });
        }
    }

    applyTheme(theme) {
        this.theme = theme;
        localStorage.setItem('aies_theme', theme);
        const root = document.documentElement;

        if (theme === 'dark') {
            root.classList.add('dark-theme');
            root.classList.remove('light-theme');
        } else {
            root.classList.remove('dark-theme');
            root.classList.add('light-theme');
        }

        const iconSpan = document.getElementById('themeIcon');
        if (iconSpan) {
            iconSpan.innerHTML = theme === 'dark' 
                ? '<i data-lucide="sun"></i>' 
                : '<i data-lucide="moon"></i>';
            this.setupIcons();
        }

        if (window.chartsManager) {
            window.chartsManager.refreshTheme();
        }
        if (window.conflictGraph) {
            window.conflictGraph.requestRender();
        }
    }

    toggleTheme() {
        this.applyTheme(this.theme === 'dark' ? 'light' : 'dark');
    }

    switchTab(tabId) {
        if (this.currentTab === tabId) return;

        // Hide old section
        const oldSection = document.getElementById(`section-${this.currentTab}`);
        const newSection = document.getElementById(`section-${tabId}`);

        if (oldSection) {
            oldSection.classList.remove('active');
        }

        if (newSection) {
            newSection.classList.add('active');
            // Animate card entrances
            const cards = newSection.querySelectorAll('.glass-card');
            cards.forEach((card, idx) => {
                card.style.animation = 'none';
                card.offsetHeight; /* trigger reflow */
                card.style.animation = `cardSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.05}s forwards`;
            });
        }

        // Update nav active state
        document.querySelectorAll('[data-nav-target]').forEach(link => {
            if (link.getAttribute('data-nav-target') === tabId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        this.currentTab = tabId;

        // Resize / render specific components
        if (tabId === 'conflict-graph' && window.conflictGraph) {
            setTimeout(() => {
                window.conflictGraph.resize();
                window.conflictGraph.restartSimulation();
            }, 60);
        }

        this.setupIcons();
    }

    // Number counting animation for statistic cards
    animateCount(elementId, targetValue, duration = 650) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const start = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
        const end = parseInt(targetValue) || 0;
        if (start === end) {
            el.textContent = end.toLocaleString();
            return;
        }

        const startTime = performance.now();
        const update = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out quart
            const ease = 1 - Math.pow(1 - progress, 4);
            const current = Math.round(start + (end - start) * ease);
            el.textContent = current.toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                el.textContent = end.toLocaleString();
            }
        };
        requestAnimationFrame(update);
    }

    showToast(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `glass-toast toast-${type}`;
        
        let iconName = 'info';
        if (type === 'success') iconName = 'check-circle';
        if (type === 'warning') iconName = 'alert-triangle';
        if (type === 'error') iconName = 'alert-circle';

        toast.innerHTML = `
            <div class="toast-icon"><i data-lucide="${iconName}"></i></div>
            <div class="toast-body">${message}</div>
            <button class="toast-close" onclick="this.parentElement.remove()"><i data-lucide="x"></i></button>
        `;

        container.appendChild(toast);
        this.setupIcons();

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (typeof toast.remove === 'function') toast.remove();
                else if (toast.parentElement) toast.parentElement.removeChild(toast);
            }, 300);
        }, duration);
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            this.setupIcons();
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    downloadFile(filename, content, mimeType = 'text/csv;charset=utf-8;') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

window.uiController = new UIController();
