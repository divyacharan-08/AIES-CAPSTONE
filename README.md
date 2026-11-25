# Examination Time Slot Allocation Using CSP: MRV vs Fixed Variable Ordering

An interactive web application designed with macOS Sonoma glassmorphic aesthetics that models university examination scheduling as a **Constraint Satisfaction Problem (CSP)** and quantitatively demonstrates how the **Minimum Remaining Values (MRV)** variable-ordering heuristic minimizes backtracking operations compared to **Fixed Variable Ordering (FVO)**.

---

## 1. Project Overview & CSP Formulation

University examination timetabling is an NP-complete combinatorial problem modeled as a binary CSP:
- **Variables ($X$)**: The set of academic courses $C = \{c_1, c_2, \dots, c_n\}$.
- **Domains ($D$)**: The available examination time slots $S = \{s_1, s_2, \dots, s_k\}$.
- **Binary Constraints ($R$)**: For any pair of distinct courses $(c_i, c_j)$, if at least one student is enrolled in both courses ($\text{Enrolled}(c_i) \cap \text{Enrolled}(c_j) \neq \emptyset$), they cannot be scheduled in the same time slot:
  $$\text{slot}(c_i) \neq \text{slot}(c_j)$$

### Heuristic Comparison
To guarantee absolute algorithmic fairness, both algorithms receive:
- Identical courses, enrolments, and slot lists.
- Identical value ordering ($s_1 \to s_2 \to \dots \to s_k$).
- Identical constraint checks and backtrack-counting rules.

| Strategy | Heuristic Principle | Selection Mechanism |
| :--- | :--- | :--- |
| **Minimum Remaining Values (MRV)** | *Fail-First* / Most Constrained Variable | Selects the unassigned course with the smallest legal remaining slot domain. Ties broken deterministically by Degree Heuristic (most conflicting neighbors), then lexicographical order. |
| **Fixed Variable Ordering (FVO)** | *Static Declaration Order* | Evaluates courses sequentially in their predefined fixed order without domain awareness. |

---

## 2. Application Architecture & Modules

The application is built completely client-side (no backend required):

- **Module 1: Dashboard (`#section-dashboard`)**: Glassmorphism statistic cards (Total Courses, Available Slots, Total Students, Detected Conflicts, Scheduled Courses), solver status indicator, quick action shortcuts, and constraint degree chart.
- **Module 2: Enrolment Data (`#section-enrolment`)**: Full management of students, courses, and examination slots. Add/edit/delete modals, CSV import, and CSV export.
- **Module 3: Conflict Graph (`#section-conflict-graph`)**: High-DPI HTML5 Canvas force-directed graph with physics simulation, interactive node dragging, edge weights (shared student count), hover cards, and detailed conflict inspector.
- **Module 4: CSP Solver (`#section-csp-solver`)**: Genuine backtracking engine executing MRV and FVO, with real-time decision trace logging displaying each variable pick, domain size, slot assignment, and backtrack step.
- **Module 5: Schedule Generation (`#section-timetable`)**: Calendar-style examination timetable organized by time slot, with student counts, room allocations, zero-clash verification banner, CSV download, and print-ready stylesheet.
- **Module 6: Schedule Evaluation (`#section-evaluation`)**: Empirical comparison table, percentage reduction in backtracking, winner badge, execution time (in ms via `performance.now()`), and Chart.js comparison bar charts.

---

## 3. Technology Stack & Design System

- **HTML5 & CSS3**: macOS Sonoma glassmorphic design system (`backdrop-filter: blur(24px)`), soft multi-layered shadows, 18–24px border radii, SF Pro system typography, ambient animated background lighting.
- **JavaScript (ES6+)**: Pure algorithmic backtracking CSP engine, force-directed graph physics, state management.
- **Chart.js**: Comparative visualizations for backtracking operations and execution times.
- **Lucide Icons**: Monochromatic Apple-style interface iconography.
- **LocalStorage**: Persistent storage for theme preference and user modifications.

---

## 4. How to Run

Simply open `index.html` in any modern web browser (Google Chrome, Apple Safari, Mozilla Firefox, or Microsoft Edge):

```bash
# Double-click or open directly:
open index.html        # macOS
start index.html       # Windows
```

Or serve locally with any standard static HTTP server:
```bash
python -m http.server 8080
# Visit http://localhost:8080
```

---

## 5. Benchmark Datasets Included

1. **Default Sample (Prompt Baseline)**: 4 courses ($C101, C102, C103, C104$), 5 students (Arun, Bala, Charan, Deepak, Elan), and 4 examination slots.
2. **University Benchmark (10 Courses, 24 Students, 4 Slots)**: Highly constrained curriculum where Fixed Ordering performs **43 backtracks**, while MRV solves it with **0 backtracks** (100% reduction in backtracking).
3. **Dense Challenge (12 Courses, 20 Students, 5 Slots)**: Complex multi-department overlap scenario.
4. **Pigeonhole Unsolvable Test (K4 Clique, 3 Slots)**: Tests exact detection of impossible scheduling when chromatic number exceeds available examination slots.

