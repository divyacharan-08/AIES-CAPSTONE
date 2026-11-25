/**
 * app.js - Main Application Orchestrator
 * Integrates EnrolmentManager, CSPSolver, ConflictGraphVisualizer, ChartsManager, and UIController.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI
    window.uiController.init();

    // Initialize Conflict Graph Visualizer
    const GraphClass = window.ConflictGraphVisualizer || ConflictGraphVisualizer;
    window.conflictGraph = new GraphClass('conflictGraphCanvas', 'graphCanvasContainer');

    // State
    let currentComparison = null;
    let selectedGraphItem = null; // { type: 'node' | 'edge', data }

    // --- Subscription to Data Changes ---
    window.enrolmentManager.subscribe((changeType) => {
        // Invalidate stale solver outputs whenever underlying data changes
        currentComparison = null;
        window.uiController.activeComparison = null;
        window.uiController.activeSchedule = null;

        updateDashboardMetrics();
        renderEnrolmentTables();
        renderSlotsTable();
        refreshConflictGraph();
        renderTimetableEmptyState();
        renderEvaluationEmptyState();

        if (changeType !== 'preset_loaded' && changeType !== 'import_complete') {
            window.uiController.showToast('Data modified. Previous schedules and comparison results invalidated.', 'warning');
        }
    });

    // --- Dashboard Metrics & Activity ---
    function updateDashboardMetrics() {
        const courses = window.enrolmentManager.getAllCourses();
        const students = window.enrolmentManager.getAllStudents();
        const slots = window.enrolmentManager.getAllSlots();
        const graphData = window.enrolmentManager.getConflictGraph();

        window.uiController.animateCount('dashStatCourses', courses.length);
        window.uiController.animateCount('dashStatSlots', slots.length);
        window.uiController.animateCount('dashStatStudents', students.length);
        window.uiController.animateCount('dashStatConflicts', graphData.totalConflicts);

        const scheduledCount = window.uiController.activeSchedule ? window.uiController.activeSchedule.size : 0;
        window.uiController.animateCount('dashStatScheduled', scheduledCount);

        // Update Mini charts on dashboard
        if (window.chartsManager) {
            window.chartsManager.initMiniDashboardCharts(graphData, currentComparison);
        }

        // Update Solver Status Badge
        const statusBadge = document.getElementById('dashSolverStatusBadge');
        if (statusBadge) {
            if (currentComparison) {
                const isSuccess = currentComparison.mrv.success;
                statusBadge.className = isSuccess ? 'status-pill success' : 'status-pill warning';
                statusBadge.innerHTML = `<span class="dot"></span> ${isSuccess ? 'Scheduled (0 Clashes)' : 'Conflict Bottleneck'}`;
            } else {
                statusBadge.className = 'status-pill neutral';
                statusBadge.innerHTML = `<span class="dot"></span> Ready to Solve`;
            }
        }
    }

    // --- Enrolment Data Tables Rendering ---
    function renderEnrolmentTables() {
        const students = window.enrolmentManager.getAllStudents();
        const courses = window.enrolmentManager.getAllCourses();

        // 1. Students Table
        const sTbody = document.getElementById('studentsTableBody');
        if (sTbody) {
            if (students.length === 0) {
                sTbody.innerHTML = `<tr><td colspan="4" class="empty-cell">No student records found. Add students or load a preset.</td></tr>`;
            } else {
                sTbody.innerHTML = students.map(s => {
                    const enrolledTags = s.enrolledCourseIds.map(cId => {
                        const c = window.enrolmentManager.getCourse(cId);
                        const code = c ? c.code : cId;
                        return `<span class="badge badge-course">${code}</span>`;
                    }).join(' ') || '<span class="text-muted">None</span>';

                    return `
                        <tr>
                            <td><strong>${s.id}</strong></td>
                            <td>${s.name}</td>
                            <td>${enrolledTags}</td>
                            <td class="action-cell">
                                <button class="btn-icon" title="Edit Student" onclick="window.openEditStudentModal('${s.id}')">
                                    <i data-lucide="edit-3"></i>
                                </button>
                                <button class="btn-icon danger" title="Delete Student" onclick="window.deleteStudent('${s.id}')">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 2. Courses Table
        const cTbody = document.getElementById('coursesTableBody');
        if (cTbody) {
            if (courses.length === 0) {
                cTbody.innerHTML = `<tr><td colspan="5" class="empty-cell">No courses defined. Add courses or load a preset.</td></tr>`;
            } else {
                cTbody.innerHTML = courses.map(c => {
                    const enrolledCount = window.enrolmentManager.getStudentsInCourse(c.id).length;
                    return `
                        <tr>
                            <td><span class="badge badge-course-solid">${c.code}</span></td>
                            <td><strong>${c.name}</strong></td>
                            <td>${c.department}</td>
                            <td>${enrolledCount} students</td>
                            <td class="action-cell">
                                <button class="btn-icon" title="Edit Course" onclick="window.openEditCourseModal('${c.id}')">
                                    <i data-lucide="edit-3"></i>
                                </button>
                                <button class="btn-icon danger" title="Delete Course" onclick="window.deleteCourse('${c.id}')">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        window.uiController.setupIcons();
    }

    // --- Examination Slots Table Rendering ---
    function renderSlotsTable() {
        const slots = window.enrolmentManager.getAllSlots();
        const sTbody = document.getElementById('slotsTableBody');
        if (sTbody) {
            if (slots.length === 0) {
                sTbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No exam slots defined. Add slots to enable CSP allocation.</td></tr>`;
            } else {
                sTbody.innerHTML = slots.map(slot => `
                    <tr>
                        <td><strong>${slot.code}</strong></td>
                        <td>${slot.date}</td>
                        <td>${slot.startTime} - ${slot.endTime}</td>
                        <td>${slot.room}</td>
                        <td>${slot.capacity} seats</td>
                        <td class="action-cell">
                            <button class="btn-icon" title="Edit Slot" onclick="window.openEditSlotModal('${slot.id}')">
                                <i data-lucide="edit-3"></i>
                            </button>
                            <button class="btn-icon danger" title="Delete Slot" onclick="window.deleteSlot('${slot.id}')">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        }
        window.uiController.setupIcons();
    }

    // --- Refresh Conflict Graph ---
    function refreshConflictGraph() {
        const graphData = window.enrolmentManager.getConflictGraph();
        if (window.conflictGraph) {
            window.conflictGraph.setData(graphData);
        }

        // Update Conflict Graph metrics bar
        const totalNodesEl = document.getElementById('graphTotalNodes');
        const totalEdgesEl = document.getElementById('graphTotalEdges');
        const maxDegreeEl = document.getElementById('graphMaxDegree');
        const densityEl = document.getElementById('graphDensity');

        if (totalNodesEl) totalNodesEl.textContent = graphData.courses.length;
        if (totalEdgesEl) totalEdgesEl.textContent = graphData.totalConflicts;
        if (maxDegreeEl) maxDegreeEl.textContent = graphData.maxDegree;
        if (densityEl) densityEl.textContent = (graphData.density * 100).toFixed(1) + '%';
    }

    // --- Graph Interaction Callbacks ---
    window.onGraphNodeSelect = (node) => {
        selectedGraphItem = { type: 'node', data: node };
        displayGraphInspector();
    };

    window.onGraphEdgeSelect = (edge) => {
        selectedGraphItem = { type: 'edge', data: edge };
        displayGraphInspector();
    };

    window.onGraphClearSelect = () => {
        selectedGraphItem = null;
        displayGraphInspector();
    };

    window.onGraphNodeHover = (node, pos) => {
        showGraphTooltip(`
            <strong>${node.code}: ${node.name}</strong><br>
            Department: ${node.department}<br>
            Enrolled: ${window.enrolmentManager.getStudentsInCourse(node.id).length} students
        `, pos.rawX, pos.rawY);
    };

    window.onGraphEdgeHover = (edge, pos) => {
        const studentNames = edge.students.map(s => s.name).slice(0, 3).join(', ');
        const extra = edge.students.length > 3 ? ` +${edge.students.length - 3} more` : '';
        showGraphTooltip(`
            <strong>Conflict: ${edge.source.code} &harr; ${edge.target.code}</strong><br>
            Shared Students (${edge.weight}): ${studentNames}${extra}
        `, pos.rawX, pos.rawY);
    };

    window.onGraphLeaveHover = () => {
        hideGraphTooltip();
    };

    function showGraphTooltip(html, x, y) {
        const tip = document.getElementById('graphHoverTooltip');
        if (!tip) return;
        tip.innerHTML = html;
        tip.style.left = `${x + 15}px`;
        tip.style.top = `${y + 15}px`;
        tip.style.display = 'block';
    }

    function hideGraphTooltip() {
        const tip = document.getElementById('graphHoverTooltip');
        if (tip) tip.style.display = 'none';
    }

    function displayGraphInspector() {
        const panel = document.getElementById('graphInspectorPanel');
        if (!panel) return;

        if (!selectedGraphItem) {
            panel.innerHTML = `
                <div class="empty-inspector">
                    <i data-lucide="info"></i>
                    <p>Click on any course node or conflict edge to inspect detailed enrolment and clash data.</p>
                </div>
            `;
            window.uiController.setupIcons();
            return;
        }

        if (selectedGraphItem.type === 'node') {
            const course = selectedGraphItem.data;
            const students = window.enrolmentManager.getStudentsInCourse(course.id);
            const graphData = window.enrolmentManager.getConflictGraph();
            const neighbors = Array.from(graphData.conflicts.get(course.id) || []).map(id => {
                const c = window.enrolmentManager.getCourse(id);
                return `<span class="badge badge-conflict">${c?.code || id}</span>`;
            });

            panel.innerHTML = `
                <div class="inspector-card">
                    <div class="inspector-header">
                        <span class="badge badge-course-solid">${course.code}</span>
                        <h4>${course.name}</h4>
                    </div>
                    <div class="inspector-meta">
                        <div><span>Department:</span> <strong>${course.department}</strong></div>
                        <div><span>Credits:</span> <strong>${course.credits}</strong></div>
                        <div><span>Direct Conflicting Courses:</span> <strong>${neighbors.length}</strong></div>
                    </div>
                    <div class="inspector-section">
                        <h5>Conflicting Courses (${neighbors.length})</h5>
                        <div class="badges-wrap">${neighbors.length ? neighbors.join(' ') : '<em>No conflicts</em>'}</div>
                    </div>
                    <div class="inspector-section">
                        <h5>Enrolled Students (${students.length})</h5>
                        <div class="enrolled-list">
                            ${students.map(s => `<div class="enrolled-item"><i data-lucide="user"></i> ${s.name} (${s.id})</div>`).join('')}
                        </div>
                    </div>
                </div>
            `;
        } else if (selectedGraphItem.type === 'edge') {
            const edge = selectedGraphItem.data;
            panel.innerHTML = `
                <div class="inspector-card">
                    <div class="inspector-header">
                        <span class="badge badge-conflict">Clash Edge</span>
                        <h4>${edge.source.code} &harr; ${edge.target.code}</h4>
                    </div>
                    <div class="inspector-meta">
                        <div><span>Constraint Rule:</span> <strong>Mutual Exclusion (&ne; Slot)</strong></div>
                        <div><span>Total Shared Students:</span> <strong>${edge.weight}</strong></div>
                    </div>
                    <div class="inspector-section">
                        <h5>Students Enrolled in Both Courses:</h5>
                        <div class="enrolled-list">
                            ${edge.students.map(s => `<div class="enrolled-item"><i data-lucide="alert-circle"></i> <strong>${s.name}</strong> (${s.id})</div>`).join('')}
                        </div>
                    </div>
                </div>
            `;
        }
        window.uiController.setupIcons();
    }

    // --- CSP Solver Execution & Comparison ---
    function runSolverBenchmark(showTrace = false) {
        const courses = window.enrolmentManager.getAllCourses();
        const slots = window.enrolmentManager.getAllSlots();
        const graphData = window.enrolmentManager.getConflictGraph();

        if (courses.length === 0) {
            window.uiController.showToast('Please add at least one course before running solver.', 'error');
            return;
        }
        if (slots.length === 0) {
            window.uiController.showToast('No examination slots defined. Please add examination slots.', 'error');
            return;
        }

        // Show loading spinner
        const runBtn = document.getElementById('runBenchmarkBtn');
        if (runBtn) {
            runBtn.disabled = true;
            runBtn.innerHTML = `<span class="spinner"></span> Running CSP Backtracking...`;
        }

        setTimeout(() => {
            try {
                // Execute CSP solver comparison with identical parameters
                currentComparison = window.cspSolver.compareAlgorithms(courses, slots, graphData.conflicts, true);
                window.uiController.activeComparison = currentComparison;

                // Set default schedule view to MRV if successful, or FVO if MRV failed
                const activeAlgo = currentComparison.mrv.success ? 'MRV' : (currentComparison.fvo.success ? 'FVO' : 'MRV');
                window.uiController.activeAlgorithm = activeAlgo;
                window.uiController.activeSchedule = currentComparison.mrv.assignment;

                // Update UI across modules
                renderEvaluationResults(currentComparison);
                renderTimetable(currentComparison[activeAlgo.toLowerCase()].assignment, activeAlgo);
                renderTraceLog(currentComparison[activeAlgo.toLowerCase()].trace, activeAlgo);
                updateDashboardMetrics();

                if (currentComparison.mrv.success) {
                    window.uiController.showToast(`Schedule generated successfully with 0 student clashes!`, 'success');
                } else {
                    window.uiController.showToast(`No clash-free schedule possible with ${slots.length} slots. Insufficient slots detected.`, 'warning');
                }
            } catch (err) {
                console.error(err);
                window.uiController.showToast(`Error running CSP solver: ${err.message}`, 'error');
            } finally {
                if (runBtn) {
                    runBtn.disabled = false;
                    runBtn.innerHTML = `<i data-lucide="play"></i> Run CSP Benchmark & Compare`;
                    window.uiController.setupIcons();
                }
            }
        }, 150);
    }

    // --- Timetable Rendering ---
    function renderTimetable(assignment, algorithmName) {
        const container = document.getElementById('timetableGridContainer');
        const emptyState = document.getElementById('timetableEmptyState');
        const headerTitle = document.getElementById('timetableActiveAlgoLabel');
        const clashBanner = document.getElementById('timetableClashBanner');

        if (!container) return;

        if (!assignment || assignment.size === 0) {
            renderTimetableEmptyState();
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        container.style.display = 'grid';

        if (headerTitle) {
            headerTitle.textContent = `Schedule Generated by ${algorithmName}`;
        }

        // Verify schedule for clashes
        const verification = window.enrolmentManager.verifySchedule(assignment);
        if (clashBanner) {
            if (verification.isValid) {
                clashBanner.className = 'status-banner success';
                clashBanner.innerHTML = `
                    <i data-lucide="shield-check"></i>
                    <div>
                        <strong>Zero Student Clashes Verified</strong>
                        <p>All ${window.enrolmentManager.getAllStudents().length} students have unique, non-overlapping examination time slots.</p>
                    </div>
                `;
            } else {
                clashBanner.className = 'status-banner danger';
                clashBanner.innerHTML = `
                    <i data-lucide="alert-triangle"></i>
                    <div>
                        <strong>${verification.clashCount} Examination Clashes Detected!</strong>
                        <p>Some courses could not be scheduled without conflict.</p>
                    </div>
                `;
            }
        }

        // Group courses by Exam Slot
        const slots = window.enrolmentManager.getAllSlots();
        const slotMap = new Map();
        slots.forEach(s => slotMap.set(s.id, { slot: s, courses: [] }));

        assignment.forEach((slotId, courseId) => {
            const course = window.enrolmentManager.getCourse(courseId);
            if (course && slotMap.has(slotId)) {
                slotMap.get(slotId).courses.push(course);
            }
        });

        container.innerHTML = Array.from(slotMap.values()).map(item => {
            const slot = item.slot;
            const assignedCourses = item.courses;

            const courseCardsHtml = assignedCourses.length > 0
                ? assignedCourses.map(course => {
                    const students = window.enrolmentManager.getStudentsInCourse(course.id);
                    return `
                        <div class="timetable-course-card">
                            <div class="t-card-top">
                                <span class="badge badge-course-solid">${course.code}</span>
                                <span class="t-enrolled"><i data-lucide="users"></i> ${students.length} students</span>
                            </div>
                            <h5 class="t-title">${course.name}</h5>
                            <div class="t-meta">
                                <span><i data-lucide="map-pin"></i> ${slot.room}</span>
                                <span><i data-lucide="book-open"></i> ${course.department}</span>
                            </div>
                        </div>
                    `;
                }).join('')
                : `<div class="empty-slot-placeholder">No courses allocated to this slot</div>`;

            return `
                <div class="timetable-slot-column glass-card">
                    <div class="slot-column-header">
                        <div class="slot-title-wrap">
                            <h4>${slot.code}</h4>
                            <span class="slot-date">${slot.date}</span>
                        </div>
                        <div class="slot-time-pill"><i data-lucide="clock"></i> ${slot.startTime} - ${slot.endTime}</div>
                    </div>
                    <div class="slot-courses-list">
                        ${courseCardsHtml}
                    </div>
                </div>
            `;
        }).join('');

        window.uiController.setupIcons();
    }

    function renderTimetableEmptyState() {
        const container = document.getElementById('timetableGridContainer');
        const emptyState = document.getElementById('timetableEmptyState');
        const clashBanner = document.getElementById('timetableClashBanner');

        if (container) container.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        if (clashBanner) clashBanner.className = 'status-banner neutral';
    }

    // --- Schedule Evaluation Module Rendering ---
    function renderEvaluationResults(comparison) {
        const emptyState = document.getElementById('evaluationEmptyState');
        const content = document.getElementById('evaluationContent');

        if (emptyState) emptyState.style.display = 'none';
        if (content) content.style.display = 'block';

        // 1. Comparison Table
        document.getElementById('evalMrvBacktracks').textContent = comparison.mrv.backtracks;
        document.getElementById('evalFvoBacktracks').textContent = comparison.fvo.backtracks;

        document.getElementById('evalMrvTime').textContent = `${comparison.mrv.executionTimeMs.toFixed(3)} ms`;
        document.getElementById('evalFvoTime').textContent = `${comparison.fvo.executionTimeMs.toFixed(3)} ms`;

        const mrvVerification = window.enrolmentManager.verifySchedule(comparison.mrv.assignment);
        const fvoVerification = window.enrolmentManager.verifySchedule(comparison.fvo.assignment);

        document.getElementById('evalMrvClashes').innerHTML = mrvVerification.clashCount === 0
            ? `<span class="text-success"><i data-lucide="check"></i> 0 Clashes</span>`
            : `<span class="text-danger">${mrvVerification.clashCount} Clashes</span>`;

        document.getElementById('evalFvoClashes').innerHTML = fvoVerification.clashCount === 0
            ? `<span class="text-success"><i data-lucide="check"></i> 0 Clashes</span>`
            : `<span class="text-danger">${fvoVerification.clashCount} Clashes</span>`;

        document.getElementById('evalMrvStatus').innerHTML = comparison.mrv.success
            ? `<span class="badge badge-success">Optimal Schedule</span>`
            : `<span class="badge badge-danger">Unsolvable</span>`;

        document.getElementById('evalFvoStatus').innerHTML = comparison.fvo.success
            ? `<span class="badge badge-success">Optimal Schedule</span>`
            : `<span class="badge badge-danger">Unsolvable</span>`;

        // 2. Metric Highlight Cards
        const reductionEl = document.getElementById('evalBacktrackReductionBadge');
        if (reductionEl) {
            const r = comparison.backtrackReductionPercent;
            reductionEl.textContent = `${r >= 0 ? '-' : '+'}${Math.abs(r)}%`;
            reductionEl.className = r >= 0 ? 'metric-delta positive' : 'metric-delta negative';
        }

        const winnerCard = document.getElementById('evalWinnerCard');
        if (winnerCard) {
            winnerCard.innerHTML = `
                <div class="winner-badge"><i data-lucide="award"></i> Recommended Heuristic: ${comparison.winner}</div>
                <p class="winner-reason">${comparison.reason}</p>
            `;
        }

        // 3. Update Chart.js comparison charts
        if (window.chartsManager) {
            window.chartsManager.updateEvaluationCharts(comparison);
        }

        window.uiController.setupIcons();
    }

    function renderEvaluationEmptyState() {
        const emptyState = document.getElementById('evaluationEmptyState');
        const content = document.getElementById('evaluationContent');
        if (emptyState) emptyState.style.display = 'flex';
        if (content) content.style.display = 'none';
    }

    // --- Trace Log Drawer Rendering ---
    function renderTraceLog(traceSteps, algorithmName) {
        const container = document.getElementById('traceLogList');
        const titleEl = document.getElementById('traceAlgorithmTitle');
        if (!container) return;

        if (titleEl) titleEl.textContent = `${algorithmName} Decision Trace (${traceSteps.length} steps)`;

        if (!traceSteps || traceSteps.length === 0) {
            container.innerHTML = `<div class="empty-trace">No trace recorded or algorithm solved trivially.</div>`;
            return;
        }

        container.innerHTML = traceSteps.map(step => {
            let badgeClass = 'badge-assign';
            let icon = 'arrow-right';
            if (step.type === 'BACKTRACK') {
                badgeClass = 'badge-backtrack';
                icon = 'corner-up-left';
            } else if (step.type === 'DEADEND') {
                badgeClass = 'badge-deadend';
                icon = 'alert-octagon';
            } else if (step.type === 'PICK') {
                badgeClass = 'badge-pick';
                icon = 'target';
            }

            return `
                <div class="trace-item ${step.type.toLowerCase()}">
                    <span class="trace-num">#${step.step}</span>
                    <span class="badge ${badgeClass}"><i data-lucide="${icon}"></i> ${step.type}</span>
                    <strong class="trace-course">${step.courseCode}</strong>
                    <span class="trace-slot">${step.slotCode}</span>
                    <span class="trace-details">${step.details}</span>
                </div>
            `;
        }).join('');

        window.uiController.setupIcons();
    }

    // --- Modal Actions / Forms ---

    // Student Modal
    window.openAddStudentModal = () => {
        document.getElementById('studentModalTitle').textContent = 'Add Student';
        document.getElementById('studentFormId').value = '';
        document.getElementById('studentFormId').disabled = false;
        document.getElementById('studentFormName').value = '';
        populateCourseCheckboxes([]);
        window.uiController.openModal('studentModal');
    };

    window.openEditStudentModal = (studentId) => {
        const student = window.enrolmentManager.getStudent(studentId);
        if (!student) return;
        document.getElementById('studentModalTitle').textContent = 'Edit Student Enrolment';
        document.getElementById('studentFormId').value = student.id;
        document.getElementById('studentFormId').disabled = true;
        document.getElementById('studentFormName').value = student.name;
        populateCourseCheckboxes(student.enrolledCourseIds);
        window.uiController.openModal('studentModal');
    };

    function populateCourseCheckboxes(selectedIds = []) {
        const container = document.getElementById('studentCourseCheckboxes');
        if (!container) return;
        const courses = window.enrolmentManager.getAllCourses();
        if (courses.length === 0) {
            container.innerHTML = `<p class="text-muted">No courses available. Please add courses first.</p>`;
            return;
        }

        container.innerHTML = courses.map(c => `
            <label class="checkbox-pill">
                <input type="checkbox" name="enrolledCourses" value="${c.id}" ${selectedIds.includes(c.id) ? 'checked' : ''}>
                <span>${c.code} (${c.name})</span>
            </label>
        `).join('');
    }

    document.getElementById('saveStudentBtn')?.addEventListener('click', () => {
        const sId = document.getElementById('studentFormId').value.trim();
        const sName = document.getElementById('studentFormName').value.trim();
        if (!sId || !sName) {
            window.uiController.showToast('Please provide both Student ID and Name.', 'error');
            return;
        }

        const checkedBoxes = document.querySelectorAll('input[name="enrolledCourses"]:checked');
        const enrolledCourseIds = Array.from(checkedBoxes).map(cb => cb.value);

        try {
            if (window.enrolmentManager.getStudent(sId)) {
                window.enrolmentManager.updateStudent(sId, sName, enrolledCourseIds);
                window.uiController.showToast(`Updated student ${sName} (${sId})`, 'success');
            } else {
                window.enrolmentManager.addStudent(sId, sName, enrolledCourseIds);
                window.uiController.showToast(`Added student ${sName} (${sId})`, 'success');
            }
            window.uiController.closeModal('studentModal');
        } catch (err) {
            window.uiController.showToast(err.message, 'error');
        }
    });

    window.deleteStudent = (studentId) => {
        if (confirm(`Are you sure you want to delete student ${studentId}?`)) {
            window.enrolmentManager.deleteStudent(studentId);
            window.uiController.showToast(`Deleted student ${studentId}`, 'info');
        }
    };

    // Course Modal
    window.openAddCourseModal = () => {
        document.getElementById('courseModalTitle').textContent = 'Add Course';
        document.getElementById('courseFormId').value = '';
        document.getElementById('courseFormCode').value = '';
        document.getElementById('courseFormCode').disabled = false;
        document.getElementById('courseFormName').value = '';
        document.getElementById('courseFormDept').value = 'Computer Science';
        document.getElementById('courseFormCredits').value = '3';
        window.uiController.openModal('courseModal');
    };

    window.openEditCourseModal = (courseId) => {
        const c = window.enrolmentManager.getCourse(courseId);
        if (!c) return;
        document.getElementById('courseModalTitle').textContent = 'Edit Course';
        document.getElementById('courseFormId').value = c.id;
        document.getElementById('courseFormCode').value = c.code;
        document.getElementById('courseFormCode').disabled = true;
        document.getElementById('courseFormName').value = c.name;
        document.getElementById('courseFormDept').value = c.department;
        document.getElementById('courseFormCredits').value = c.credits;
        window.uiController.openModal('courseModal');
    };

    document.getElementById('saveCourseBtn')?.addEventListener('click', () => {
        const id = document.getElementById('courseFormId').value;
        const code = document.getElementById('courseFormCode').value.trim();
        const name = document.getElementById('courseFormName').value.trim();
        const dept = document.getElementById('courseFormDept').value.trim();
        const credits = parseInt(document.getElementById('courseFormCredits').value) || 3;

        if (!code || !name) {
            window.uiController.showToast('Please provide Course Code and Name.', 'error');
            return;
        }

        try {
            if (id) {
                window.enrolmentManager.updateCourse(id, code, name, dept, credits);
                window.uiController.showToast(`Updated course ${code}`, 'success');
            } else {
                window.enrolmentManager.addCourse(code, name, dept, credits);
                window.uiController.showToast(`Added course ${code}`, 'success');
            }
            window.uiController.closeModal('courseModal');
        } catch (err) {
            window.uiController.showToast(err.message, 'error');
        }
    });

    window.deleteCourse = (courseId) => {
        if (confirm(`Delete course and remove from all student enrolments?`)) {
            window.enrolmentManager.deleteCourse(courseId);
            window.uiController.showToast(`Course deleted`, 'info');
        }
    };

    // Examination Slot Modal
    window.openAddSlotModal = () => {
        document.getElementById('slotModalTitle').textContent = 'Add Examination Slot';
        document.getElementById('slotFormId').value = '';
        const nextNum = window.enrolmentManager.getAllSlots().length + 1;
        document.getElementById('slotFormCode').value = `Slot ${nextNum}`;
        document.getElementById('slotFormDate').value = '2026-12-10';
        document.getElementById('slotFormStart').value = '09:00';
        document.getElementById('slotFormEnd').value = '12:00';
        document.getElementById('slotFormRoom').value = 'Main Examination Hall';
        document.getElementById('slotFormCap').value = '120';
        window.uiController.openModal('slotModal');
    };

    window.openEditSlotModal = (slotId) => {
        const slot = window.enrolmentManager.getAllSlots().find(s => s.id === slotId);
        if (!slot) return;
        document.getElementById('slotModalTitle').textContent = 'Edit Examination Slot';
        document.getElementById('slotFormId').value = slot.id;
        document.getElementById('slotFormCode').value = slot.code;
        document.getElementById('slotFormDate').value = slot.date;
        document.getElementById('slotFormStart').value = slot.startTime;
        document.getElementById('slotFormEnd').value = slot.endTime;
        document.getElementById('slotFormRoom').value = slot.room;
        document.getElementById('slotFormCap').value = slot.capacity;
        window.uiController.openModal('slotModal');
    };

    document.getElementById('saveSlotBtn')?.addEventListener('click', () => {
        const id = document.getElementById('slotFormId').value;
        const code = document.getElementById('slotFormCode').value.trim();
        const date = document.getElementById('slotFormDate').value;
        const start = document.getElementById('slotFormStart').value;
        const end = document.getElementById('slotFormEnd').value;
        const room = document.getElementById('slotFormRoom').value.trim();
        const cap = parseInt(document.getElementById('slotFormCap').value) || 100;

        if (!code || !date || !start || !end) {
            window.uiController.showToast('Please fill all required slot fields.', 'error');
            return;
        }

        try {
            if (id) {
                window.enrolmentManager.updateSlot(id, code, date, start, end, room, cap);
                window.uiController.showToast(`Updated examination slot ${code}`, 'success');
            } else {
                window.enrolmentManager.addSlot(code, date, start, end, room, cap);
                window.uiController.showToast(`Added examination slot ${code}`, 'success');
            }
            window.uiController.closeModal('slotModal');
        } catch (err) {
            window.uiController.showToast(err.message, 'error');
        }
    });

    window.deleteSlot = (slotId) => {
        if (confirm(`Delete this examination slot?`)) {
            window.enrolmentManager.deleteSlot(slotId);
            window.uiController.showToast(`Slot deleted`, 'info');
        }
    };

    // --- CSV Import / Export Handlers ---
    document.getElementById('importCsvBtn')?.addEventListener('click', () => {
        window.uiController.openModal('csvImportModal');
    });

    document.getElementById('submitCsvImportBtn')?.addEventListener('click', () => {
        const fileInput = document.getElementById('csvFileInput');
        const textInput = document.getElementById('csvPasteArea');

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const count = window.enrolmentManager.importStudentsCSV(e.target.result);
                    window.uiController.showToast(`Imported ${count} student records from CSV.`, 'success');
                    window.uiController.closeModal('csvImportModal');
                } catch (err) {
                    window.uiController.showToast(`CSV Import Error: ${err.message}`, 'error');
                }
            };
            reader.readAsText(file);
        } else if (textInput.value.trim()) {
            try {
                const count = window.enrolmentManager.importStudentsCSV(textInput.value);
                window.uiController.showToast(`Imported ${count} student records from CSV text.`, 'success');
                window.uiController.closeModal('csvImportModal');
            } catch (err) {
                window.uiController.showToast(`CSV Import Error: ${err.message}`, 'error');
            }
        } else {
            window.uiController.showToast('Please choose a CSV file or paste CSV content.', 'error');
        }
    });

    document.getElementById('exportStudentsCsvBtn')?.addEventListener('click', () => {
        const csv = window.enrolmentManager.exportStudentsCSV();
        window.uiController.downloadFile('students_enrolment.csv', csv);
        window.uiController.showToast('Downloaded student enrolment CSV.', 'info');
    });

    document.getElementById('exportTimetableCsvBtn')?.addEventListener('click', () => {
        if (!window.uiController.activeSchedule) {
            window.uiController.showToast('No active schedule to export. Run CSP solver first.', 'warning');
            return;
        }
        const csv = window.enrolmentManager.exportTimetableCSV(window.uiController.activeSchedule);
        window.uiController.downloadFile('examination_timetable.csv', csv);
        window.uiController.showToast('Downloaded examination timetable CSV.', 'info');
    });

    // Print Timetable
    document.getElementById('printTimetableBtn')?.addEventListener('click', () => {
        window.print();
    });

    // Toggle Schedule View between MRV and FVO
    document.getElementById('viewMrvScheduleBtn')?.addEventListener('click', () => {
        if (!currentComparison) return;
        window.uiController.activeAlgorithm = 'MRV';
        window.uiController.activeSchedule = currentComparison.mrv.assignment;
        renderTimetable(currentComparison.mrv.assignment, 'MRV (Minimum Remaining Values)');
        renderTraceLog(currentComparison.mrv.trace, 'MRV');
        document.getElementById('viewMrvScheduleBtn')?.classList.add('active');
        document.getElementById('viewFvoScheduleBtn')?.classList.remove('active');
    });

    document.getElementById('viewFvoScheduleBtn')?.addEventListener('click', () => {
        if (!currentComparison) return;
        window.uiController.activeAlgorithm = 'FVO';
        window.uiController.activeSchedule = currentComparison.fvo.assignment;
        renderTimetable(currentComparison.fvo.assignment, 'FVO (Fixed Variable Ordering)');
        renderTraceLog(currentComparison.fvo.trace, 'FVO');
        document.getElementById('viewFvoScheduleBtn')?.classList.add('active');
        document.getElementById('viewMrvScheduleBtn')?.classList.remove('active');
    });

    // Quick Action & Solver Buttons
    document.getElementById('runBenchmarkBtn')?.addEventListener('click', () => runSolverBenchmark(true));
    document.getElementById('dashRunSolverBtn')?.addEventListener('click', () => {
        window.uiController.switchTab('csp-solver');
        runSolverBenchmark(true);
    });

    document.getElementById('runSingleMrvBtn')?.addEventListener('click', () => {
        const courses = window.enrolmentManager.getAllCourses();
        const slots = window.enrolmentManager.getAllSlots();
        const graphData = window.enrolmentManager.getConflictGraph();
        const res = window.cspSolver.solveMRV(courses, slots, graphData.conflicts, true);
        window.uiController.activeAlgorithm = 'MRV';
        window.uiController.activeSchedule = res.assignment;
        renderTimetable(res.assignment, 'MRV');
        renderTraceLog(res.trace, 'MRV');
        window.uiController.showToast(`MRV solved with ${res.backtracks} backtracks in ${res.executionTimeMs.toFixed(3)} ms`, 'info');
    });

    document.getElementById('runSingleFvoBtn')?.addEventListener('click', () => {
        const courses = window.enrolmentManager.getAllCourses();
        const slots = window.enrolmentManager.getAllSlots();
        const graphData = window.enrolmentManager.getConflictGraph();
        const res = window.cspSolver.solveFVO(courses, slots, graphData.conflicts, true);
        window.uiController.activeAlgorithm = 'FVO';
        window.uiController.activeSchedule = res.assignment;
        renderTimetable(res.assignment, 'FVO');
        renderTraceLog(res.trace, 'FVO');
        window.uiController.showToast(`Fixed Ordering solved with ${res.backtracks} backtracks in ${res.executionTimeMs.toFixed(3)} ms`, 'info');
    });

    // Graph Controls
    document.getElementById('graphTogglePhysicsBtn')?.addEventListener('click', (e) => {
        const isEnabled = window.conflictGraph.togglePhysics();
        e.currentTarget.classList.toggle('active', isEnabled);
        window.uiController.showToast(isEnabled ? 'Graph physics enabled' : 'Graph physics paused', 'info');
    });

    document.getElementById('graphResetViewBtn')?.addEventListener('click', () => {
        window.conflictGraph.resetView();
    });

    // Initial populate
    updateDashboardMetrics();
    renderEnrolmentTables();
    renderSlotsTable();
    refreshConflictGraph();
    displayGraphInspector();

    // Auto run benchmark on load so initial graphs and timetable are immediately populated!
    runSolverBenchmark(true);
});

