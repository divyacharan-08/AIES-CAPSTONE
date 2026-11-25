/**
 * csp-solver.js - Rigorous CSP Solver for Exam Timetabling
 * Implements:
 * 1. Minimum Remaining Values (MRV) Variable Ordering with deterministic Degree & Lexicographical tie-breaking
 * 2. Fixed Variable Ordering (FVO)
 * Both using IDENTICAL value ordering, constraint checks, and backtracking counting rules.
 */

class CSPSolver {
    constructor() {
        this.maxTraceSteps = 1000; // Limit trace logging to prevent memory bloat on large runs
    }

    /**
     * Common method to get valid slots for a course given current partial assignment.
     * Identical for both algorithms to guarantee absolute fairness.
     */
    getValidSlots(courseId, assignment, allSlots, conflicts) {
        const conflictingCourseIds = conflicts.get(courseId) || new Set();
        const occupiedSlotIds = new Set();

        conflictingCourseIds.forEach(neighborId => {
            if (assignment.has(neighborId)) {
                occupiedSlotIds.add(assignment.get(neighborId));
            }
        });

        // Retain IDENTICAL value ordering (order in which allSlots array is provided)
        return allSlots.filter(slot => !occupiedSlotIds.has(slot.id));
    }

    /**
     * Solves exam scheduling using Algorithm A: Minimum Remaining Values (MRV)
     * At each step:
     * - Finds all unassigned courses
     * - Evaluates remaining legal domain size for each
     * - If any unassigned course has 0 valid slots, triggers immediate fail-first backtrack
     * - Selects course with smallest remaining domain
     * - Breaks ties deterministically via Degree Heuristic, then Course Code
     * - Tries values in the shared value ordering
     */
    solveMRV(courses, slots, conflicts, recordTrace = false) {
        const stats = {
            algorithm: 'Minimum Remaining Values (MRV)',
            algorithmShort: 'MRV',
            backtracks: 0,
            nodesExplored: 0,
            executionTimeMs: 0,
            success: false,
            assignment: new Map(), // courseId -> slotId
            trace: [],
            unassignedRemaining: courses.length,
            message: ''
        };

        const startTime = performance.now();
        const assignment = new Map();

        const stepLog = (type, courseId, slotId, details = '') => {
            if (!recordTrace || stats.trace.length >= this.maxTraceSteps) return;
            stats.trace.push({
                step: stats.trace.length + 1,
                type, // 'PICK', 'ASSIGN', 'BACKTRACK', 'DEADEND'
                courseId,
                courseCode: courses.find(c => c.id === courseId)?.code || courseId,
                slotId,
                slotCode: slots.find(s => s.id === slotId)?.code || (slotId || '-'),
                details
            });
        };

        const backtrack = () => {
            stats.nodesExplored++;

            // Base case: All courses assigned
            if (assignment.size === courses.length) {
                return true;
            }

            // 1. Identify unassigned courses
            const unassigned = courses.filter(c => !assignment.has(c.id));

            // 2. Compute legal domain for each unassigned course
            let minDomainSize = Infinity;
            let candidates = [];

            for (const course of unassigned) {
                const validSlots = this.getValidSlots(course.id, assignment, slots, conflicts);
                const domainSize = validSlots.length;

                // Fail-First / Forward-Checking dead end: domain wiped out
                if (domainSize === 0) {
                    stepLog('DEADEND', course.id, null, `Domain wiped out (0 valid slots left)`);
                    stats.backtracks++;
                    return false;
                }

                if (domainSize < minDomainSize) {
                    minDomainSize = domainSize;
                    candidates = [{ course, validSlots, domainSize }];
                } else if (domainSize === minDomainSize) {
                    candidates.push({ course, validSlots, domainSize });
                }
            }

            // 3. Deterministic Tie-breaking:
            // Primary tie-breaker: Degree Heuristic (most unassigned conflicting neighbors)
            // Secondary tie-breaker: Lexicographical order by Course Code
            candidates.sort((a, b) => {
                const degA = this._countUnassignedNeighbors(a.course.id, assignment, conflicts);
                const degB = this._countUnassignedNeighbors(b.course.id, assignment, conflicts);
                if (degB !== degA) return degB - degA; // Higher degree first
                return a.course.code.localeCompare(b.course.code); // Deterministic alphabetical
            });

            const chosen = candidates[0];
            const chosenCourse = chosen.course;
            const validSlots = chosen.validSlots; // Already in identical value ordering

            stepLog('PICK', chosenCourse.id, null, `MRV selected (legal domain size: ${chosen.domainSize})`);

            // 4. Try valid slots in identical value ordering
            for (const slot of validSlots) {
                assignment.set(chosenCourse.id, slot.id);
                stepLog('ASSIGN', chosenCourse.id, slot.id, `Assigned ${slot.code}`);

                if (backtrack()) {
                    return true;
                }

                // If recursive path failed, backtrack
                stats.backtracks++;
                assignment.delete(chosenCourse.id);
                stepLog('BACKTRACK', chosenCourse.id, slot.id, `Unassigned ${chosenCourse.code} from ${slot.code}`);
            }

            return false;
        };

        const success = backtrack();
        const endTime = performance.now();

        stats.executionTimeMs = Math.round((endTime - startTime) * 1000) / 1000;
        stats.success = success;
        stats.assignment = new Map(assignment);
        stats.unassignedRemaining = courses.length - assignment.size;
        stats.message = success
            ? `Successfully scheduled all ${courses.length} courses.`
            : `Failed to find a clash-free schedule. Insufficient slots or dense conflict bottleneck.`;

        return stats;
    }

    /**
     * Solves exam scheduling using Algorithm B: Fixed Variable Ordering (FVO)
     * Courses are iterated in a predetermined fixed sequence (order of declaration).
     * Value ordering and backtrack increment logic are 100% IDENTICAL to MRV.
     */
    solveFVO(courses, slots, conflicts, recordTrace = false) {
        const stats = {
            algorithm: 'Fixed Variable Ordering (FVO)',
            algorithmShort: 'Fixed Ordering',
            backtracks: 0,
            nodesExplored: 0,
            executionTimeMs: 0,
            success: false,
            assignment: new Map(), // courseId -> slotId
            trace: [],
            unassignedRemaining: courses.length,
            message: ''
        };

        const startTime = performance.now();
        const assignment = new Map();

        // Predefined fixed ordering: sequence of courses as given
        const fixedOrder = [...courses];

        const stepLog = (type, courseId, slotId, details = '') => {
            if (!recordTrace || stats.trace.length >= this.maxTraceSteps) return;
            stats.trace.push({
                step: stats.trace.length + 1,
                type,
                courseId,
                courseCode: courses.find(c => c.id === courseId)?.code || courseId,
                slotId,
                slotCode: slots.find(s => s.id === slotId)?.code || (slotId || '-'),
                details
            });
        };

        const backtrack = (index) => {
            stats.nodesExplored++;

            // Base case: All courses assigned
            if (index === fixedOrder.length) {
                return true;
            }

            const currentCourse = fixedOrder[index];
            stepLog('PICK', currentCourse.id, null, `Fixed sequence index ${index + 1}/${fixedOrder.length}`);

            // Get valid slots using the exact same constraints and identical value ordering
            const validSlots = this.getValidSlots(currentCourse.id, assignment, slots, conflicts);

            if (validSlots.length === 0) {
                stepLog('DEADEND', currentCourse.id, null, `No valid slots available for ${currentCourse.code}`);
                stats.backtracks++;
                return false;
            }

            for (const slot of validSlots) {
                assignment.set(currentCourse.id, slot.id);
                stepLog('ASSIGN', currentCourse.id, slot.id, `Assigned ${slot.code}`);

                if (backtrack(index + 1)) {
                    return true;
                }

                // If recursive path failed, backtrack
                stats.backtracks++;
                assignment.delete(currentCourse.id);
                stepLog('BACKTRACK', currentCourse.id, slot.id, `Unassigned ${currentCourse.code} from ${slot.code}`);
            }

            return false;
        };

        const success = backtrack(0);
        const endTime = performance.now();

        stats.executionTimeMs = Math.round((endTime - startTime) * 1000) / 1000;
        stats.success = success;
        stats.assignment = new Map(assignment);
        stats.unassignedRemaining = courses.length - assignment.size;
        stats.message = success
            ? `Successfully scheduled all ${courses.length} courses.`
            : `Failed to find a clash-free schedule. Insufficient slots or dense conflict bottleneck.`;

        return stats;
    }

    /**
     * Executes both algorithms with identical inputs and computes comparison metrics.
     */
    compareAlgorithms(courses, slots, conflicts, recordTrace = false) {
        if (!courses || courses.length === 0) {
            throw new Error('No courses provided for CSP solver.');
        }
        if (!slots || slots.length === 0) {
            throw new Error('No examination slots available. Please add examination slots.');
        }

        // Run MRV
        const mrvResult = this.solveMRV(courses, slots, conflicts, recordTrace);

        // Run Fixed Variable Ordering with identical inputs and identical slot sequence
        const fvoResult = this.solveFVO(courses, slots, conflicts, recordTrace);

        // Calculate comparison metrics
        const fvoBacktracks = fvoResult.backtracks;
        const mrvBacktracks = mrvResult.backtracks;

        let backtrackReductionPercent = 0;
        if (fvoBacktracks === 0 && mrvBacktracks === 0) {
            backtrackReductionPercent = 0; // Both 0 backtracks (trivial case)
        } else if (fvoBacktracks === 0 && mrvBacktracks > 0) {
            backtrackReductionPercent = -100;
        } else {
            backtrackReductionPercent = Math.round(((fvoBacktracks - mrvBacktracks) / fvoBacktracks) * 1000) / 10;
        }

        let timeSpeedupPercent = 0;
        if (fvoResult.executionTimeMs > 0) {
            timeSpeedupPercent = Math.round(((fvoResult.executionTimeMs - mrvResult.executionTimeMs) / fvoResult.executionTimeMs) * 1000) / 10;
        }

        // Determine winner
        let winner = 'Equal';
        let reason = 'Both algorithms achieved the optimal schedule with identical operations.';

        if (mrvBacktracks < fvoBacktracks) {
            winner = 'MRV';
            const diff = fvoBacktracks - mrvBacktracks;
            reason = `MRV prevented ${diff} unnecessary backtracking operations by prioritizing variables with tightest domains first.`;
        } else if (fvoBacktracks < mrvBacktracks) {
            winner = 'FVO';
            reason = `Fixed ordering happened to find a lucky branch on this specific configuration.`;
        } else if (mrvResult.executionTimeMs < fvoResult.executionTimeMs) {
            winner = 'MRV';
            reason = `Both had equal backtracks, but MRV executed faster.`;
        }

        return {
            timestamp: new Date().toISOString(),
            courseCount: courses.length,
            slotCount: slots.length,
            mrv: mrvResult,
            fvo: fvoResult,
            backtrackReductionPercent,
            timeSpeedupPercent,
            winner,
            reason
        };
    }

    _countUnassignedNeighbors(courseId, assignment, conflicts) {
        const neighbors = conflicts.get(courseId) || new Set();
        let count = 0;
        neighbors.forEach(nId => {
            if (!assignment.has(nId)) count++;
        });
        return count;
    }
}

// Global solver instance
window.cspSolver = new CSPSolver();

