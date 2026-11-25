/**
 * models.js - Data Models and Management for Examination CSP Scheduler
 * Handles Courses, Students, Examination Slots, Conflict Matrix, Presets, and LocalStorage.
 */

class Course {
    constructor(id, code, name, department = 'General', credits = 3) {
        this.id = id;
        this.code = code.trim().toUpperCase();
        this.name = name.trim();
        this.department = department;
        this.credits = credits;
    }
}

class Student {
    constructor(id, name, enrolledCourseIds = []) {
        this.id = id.trim().toUpperCase();
        this.name = name.trim();
        this.enrolledCourseIds = Array.from(new Set(enrolledCourseIds));
    }
}

class ExamSlot {
    constructor(id, code, date, startTime, endTime, room = 'Main Exam Hall', capacity = 100) {
        this.id = id;
        this.code = code; // e.g. "Slot 1 (Day 1 Morning)"
        this.date = date; // e.g. "2026-12-01"
        this.startTime = startTime; // e.g. "09:00"
        this.endTime = endTime; // e.g. "12:00"
        this.room = room;
        this.capacity = capacity;
    }

    get label() {
        return `${this.code} • ${this.date} (${this.startTime} - ${this.endTime})`;
    }
}

class EnrolmentManager {
    constructor() {
        this.courses = new Map(); // id -> Course
        this.students = new Map(); // id -> Student
        this.slots = []; // Array of ExamSlot
        this.listeners = [];
        this.loadFromStorage();
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    notify(changeType = 'update') {
        this.saveToStorage();
        this.listeners.forEach(fn => fn(changeType));
    }

    // --- Courses Management ---
    addCourse(code, name, department = 'General', credits = 3) {
        const id = 'C_' + code.toUpperCase().replace(/\s+/g, '_');
        if (this.courses.has(id)) {
            throw new Error(`Course with code "${code}" already exists.`);
        }
        const course = new Course(id, code, name, department, credits);
        this.courses.set(id, course);
        this.notify('course_add');
        return course;
    }

    updateCourse(id, code, name, department, credits) {
        if (!this.courses.has(id)) throw new Error(`Course not found.`);
        const course = this.courses.get(id);
        course.code = code.trim().toUpperCase();
        course.name = name.trim();
        course.department = department;
        course.credits = credits;
        this.notify('course_update');
    }

    deleteCourse(id) {
        if (!this.courses.has(id)) return;
        this.courses.delete(id);
        // Remove course from all student enrolments
        this.students.forEach(student => {
            student.enrolledCourseIds = student.enrolledCourseIds.filter(cId => cId !== id);
        });
        this.notify('course_delete');
    }

    getCourse(id) {
        return this.courses.get(id);
    }

    getCourseByCode(code) {
        const clean = code.trim().toUpperCase();
        for (const c of this.courses.values()) {
            if (c.code === clean) return c;
        }
        return null;
    }

    getAllCourses() {
        return Array.from(this.courses.values());
    }

    // --- Students Management ---
    addStudent(id, name, enrolledCodesOrIds = []) {
        const cleanId = id.trim().toUpperCase();
        if (this.students.has(cleanId)) {
            throw new Error(`Student with ID "${id}" already exists.`);
        }

        const validCourseIds = [];
        for (const item of enrolledCodesOrIds) {
            const course = this.getCourse(item) || this.getCourseByCode(item);
            if (course) {
                validCourseIds.push(course.id);
            }
        }

        const student = new Student(cleanId, name, validCourseIds);
        this.students.set(cleanId, student);
        this.notify('student_add');
        return student;
    }

    updateStudent(id, name, enrolledCodesOrIds = []) {
        const cleanId = id.trim().toUpperCase();
        if (!this.students.has(cleanId)) throw new Error(`Student not found.`);

        const validCourseIds = [];
        for (const item of enrolledCodesOrIds) {
            const course = this.getCourse(item) || this.getCourseByCode(item);
            if (course) {
                validCourseIds.push(course.id);
            }
        }

        const student = this.students.get(cleanId);
        student.name = name.trim();
        student.enrolledCourseIds = Array.from(new Set(validCourseIds));
        this.notify('student_update');
    }

    deleteStudent(id) {
        const cleanId = id.trim().toUpperCase();
        if (!this.students.has(cleanId)) return;
        this.students.delete(cleanId);
        this.notify('student_delete');
    }

    getStudent(id) {
        return this.students.get(id.trim().toUpperCase());
    }

    getAllStudents() {
        return Array.from(this.students.values());
    }

    getStudentsInCourse(courseId) {
        return this.getAllStudents().filter(s => s.enrolledCourseIds.includes(courseId));
    }

    // --- Examination Slots Management ---
    addSlot(code, date, startTime, endTime, room = 'Hall A', capacity = 100) {
        const id = 'S_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const slot = new ExamSlot(id, code, date, startTime, endTime, room, capacity);
        this.slots.push(slot);
        this.notify('slot_add');
        return slot;
    }

    updateSlot(id, code, date, startTime, endTime, room, capacity) {
        const slot = this.slots.find(s => s.id === id);
        if (!slot) throw new Error('Slot not found');
        slot.code = code;
        slot.date = date;
        slot.startTime = startTime;
        slot.endTime = endTime;
        slot.room = room;
        slot.capacity = capacity;
        this.notify('slot_update');
    }

    deleteSlot(id) {
        this.slots = this.slots.filter(s => s.id !== id);
        this.notify('slot_delete');
    }

    getAllSlots() {
        return [...this.slots];
    }

    // --- Conflict Analysis & Graph Construction ---
    /**
     * Builds the conflict map and edge list.
     * Two courses conflict if at least one student is enrolled in both.
     * Edge weight = count of shared students.
     */
    getConflictGraph() {
        const courses = this.getAllCourses();
        const conflicts = new Map(); // courseId -> Set of conflicting courseIds
        const edgeList = []; // { source, target, weight, students: [Student] }
        const edgeMap = new Map(); // key "id1--id2" -> { weight, students }

        courses.forEach(c => conflicts.set(c.id, new Set()));

        const studentList = this.getAllStudents();
        studentList.forEach(student => {
            const cIds = student.enrolledCourseIds.filter(id => this.courses.has(id));
            for (let i = 0; i < cIds.length; i++) {
                for (let j = i + 1; j < cIds.length; j++) {
                    const c1 = cIds[i];
                    const c2 = cIds[j];
                    conflicts.get(c1).add(c2);
                    conflicts.get(c2).add(c1);

                    const pairKey = [c1, c2].sort().join('--');
                    if (!edgeMap.has(pairKey)) {
                        edgeMap.set(pairKey, {
                            source: c1 < c2 ? c1 : c2,
                            target: c1 < c2 ? c2 : c1,
                            weight: 0,
                            students: []
                        });
                    }
                    const edgeObj = edgeMap.get(pairKey);
                    edgeObj.weight += 1;
                    edgeObj.students.push(student);
                }
            }
        });

        edgeMap.forEach(edge => edgeList.push(edge));

        // Calculate graph metrics
        let totalConflicts = edgeList.length;
        let maxDegree = 0;
        conflicts.forEach(set => {
            if (set.size > maxDegree) maxDegree = set.size;
        });

        return {
            courses,
            conflicts, // Map of courseId -> Set of courseId
            edges: edgeList,
            totalConflicts,
            maxDegree,
            density: courses.length > 1 ? (2 * totalConflicts) / (courses.length * (courses.length - 1)) : 0
        };
    }

    /**
     * Verifies whether a schedule has any student clashes.
     * Returns { isValid: boolean, clashCount: number, clashes: Array<{student, slot, courses}> }
     */
    verifySchedule(assignmentMap) {
        // assignmentMap: Map(courseId -> slotId)
        const clashes = [];
        const students = this.getAllStudents();

        students.forEach(student => {
            const slotToCourses = new Map();
            student.enrolledCourseIds.forEach(cId => {
                const slotId = assignmentMap.get(cId);
                if (slotId) {
                    if (!slotToCourses.has(slotId)) slotToCourses.set(slotId, []);
                    slotToCourses.get(slotId).push(cId);
                }
            });

            slotToCourses.forEach((courseIds, slotId) => {
                if (courseIds.length > 1) {
                    const slot = this.slots.find(s => s.id === slotId);
                    const courseNames = courseIds.map(id => this.courses.get(id)?.code || id);
                    clashes.push({
                        student: student.name,
                        studentId: student.id,
                        slot: slot?.code || slotId,
                        courses: courseNames
                    });
                }
            });
        });

        return {
            isValid: clashes.length === 0,
            clashCount: clashes.length,
            clashes
        };
    }

    // --- Presets ---
    loadDefaultSample() {
        this.courses.clear();
        this.students.clear();
        this.slots = [];

        // 4 Courses from user request: C101, C102, C103, C104
        this.addCourse('C101', 'Data Structures & Algorithms', 'Computer Science', 4);
        this.addCourse('C102', 'Database Management Systems', 'Computer Science', 3);
        this.addCourse('C103', 'Operating Systems', 'Computer Science', 4);
        this.addCourse('C104', 'Computer Networks', 'Computer Science', 3);

        // 5 Students from user request
        this.addStudent('S001', 'Arun', ['C101', 'C102']);
        this.addStudent('S002', 'Bala', ['C101', 'C103']);
        this.addStudent('S003', 'Charan', ['C102', 'C104']);
        this.addStudent('S004', 'Deepak', ['C101', 'C104']);
        this.addStudent('S005', 'Elan', ['C103', 'C104']);

        // Default 4 Examination Slots
        this.addSlot('Slot 1', '2026-12-10', '09:00', '12:00', 'Hall Alpha', 120);
        this.addSlot('Slot 2', '2026-12-10', '14:00', '17:00', 'Hall Beta', 120);
        this.addSlot('Slot 3', '2026-12-11', '09:00', '12:00', 'Hall Alpha', 120);
        this.addSlot('Slot 4', '2026-12-11', '14:00', '17:00', 'Hall Beta', 120);

        this.notify('preset_loaded');
    }

    loadUniversityBenchmark() {
        // High-backtrack benchmark showing dramatic reduction: FVO 43 backtracks vs MRV 0 backtracks
        this.courses.clear();
        this.students.clear();
        this.slots = [];

        const courses = [
            ['CS101', 'Data Structures', 'CSE'],
            ['CS102', 'Algorithms', 'CSE'],
            ['CS103', 'Operating Systems', 'CSE'],
            ['CS104', 'Computer Networks', 'CSE'],
            ['CS105', 'Database Systems', 'CSE'],
            ['CS106', 'Computer Architecture', 'CSE'],
            ['CS107', 'Theory of Computation', 'CSE'],
            ['CS108', 'Software Engineering', 'CSE'],
            ['CS109', 'Artificial Intelligence', 'AI'],
            ['CS110', 'Machine Learning', 'AI']
        ];

        const students = [
            ['S001', 'Aditi Rao', ['CS107', 'CS110']],
            ['S002', 'Bharat Nair', ['CS102', 'CS103']],
            ['S003', 'Chetan Sharma', ['CS104', 'CS109']],
            ['S004', 'Divya Patel', ['CS107', 'CS109', 'CS106']],
            ['S005', 'Eshwar Reddy', ['CS103', 'CS105']],
            ['S006', 'Farhan Ali', ['CS106', 'CS103', 'CS102']],
            ['S007', 'Gautam Menon', ['CS108', 'CS101']],
            ['S008', 'Harini Iyer', ['CS105', 'CS106', 'CS107']],
            ['S009', 'Ishaan Gupta', ['CS108', 'CS104', 'CS101']],
            ['S010', 'Jayant Verma', ['CS101', 'CS105']],
            ['S011', 'Kavya Pillai', ['CS108', 'CS107', 'CS104']],
            ['S012', 'Lakshman K', ['CS108', 'CS107', 'CS104']],
            ['S013', 'Meera Joshi', ['CS109', 'CS108', 'CS107']],
            ['S014', 'Naveen Kumar', ['CS105', 'CS108']],
            ['S015', 'Oviya Raj', ['CS103', 'CS106']],
            ['S016', 'Pranav Roy', ['CS104', 'CS106', 'CS105']],
            ['S017', 'Qasim Zaid', ['CS102', 'CS107', 'CS110']],
            ['S018', 'Rhea Sen', ['CS101', 'CS108']],
            ['S019', 'Siddharth M', ['CS104', 'CS109']],
            ['S020', 'Tanvi Desai', ['CS101', 'CS105', 'CS106']],
            ['S021', 'Umar Farooq', ['CS101', 'CS104', 'CS105']],
            ['S022', 'Varun Kapoor', ['CS107', 'CS105']],
            ['S023', 'Wendy Dsouza', ['CS106', 'CS105', 'CS101']],
            ['S024', 'Xavier Lobo', ['CS109', 'CS108', 'CS101']]
        ];

        courses.forEach(c => this.addCourse(c[0], c[1], c[2]));
        students.forEach(s => this.addStudent(s[0], s[1], s[2]));

        // 4 Examination Slots
        this.addSlot('Slot 1', '2026-12-15', '09:00', '12:00', 'Main Auditorium', 150);
        this.addSlot('Slot 2', '2026-12-15', '14:00', '17:00', 'Hall 101', 150);
        this.addSlot('Slot 3', '2026-12-16', '09:00', '12:00', 'Main Auditorium', 150);
        this.addSlot('Slot 4', '2026-12-16', '14:00', '17:00', 'Hall 102', 150);

        this.notify('preset_loaded');
    }

    loadDenseStressBenchmark() {
        this.courses.clear();
        this.students.clear();
        this.slots = [];

        const courseList = [
            ['CS201', 'Object Oriented Programming', 'CSE'],
            ['CS202', 'Discrete Mathematics', 'CSE'],
            ['CS203', 'Computer Architecture', 'CSE'],
            ['CS204', 'Theory of Computation', 'CSE'],
            ['CS205', 'Design & Analysis of Algorithms', 'CSE'],
            ['CS206', 'Software Engineering', 'CSE'],
            ['AI301', 'Artificial Intelligence', 'AI & Data'],
            ['AI302', 'Machine Learning Foundations', 'AI & Data'],
            ['AI303', 'Deep Learning & Neural Nets', 'AI & Data'],
            ['MA201', 'Linear Algebra & Probability', 'Mathematics'],
            ['MA202', 'Optimization Techniques', 'Mathematics'],
            ['EC201', 'Digital Logic & Microprocessors', 'ECE']
        ];

        courseList.forEach(c => this.addCourse(c[0], c[1], c[2]));

        const studentEnrollments = [
            ['S101', 'Aditi Rao', ['CS201', 'CS202', 'MA201']],
            ['S102', 'Bharat Nair', ['CS201', 'CS203', 'EC201']],
            ['S103', 'Chetan Sharma', ['CS202', 'CS204', 'MA201']],
            ['S104', 'Divya Patel', ['CS203', 'CS205', 'AI301']],
            ['S105', 'Eshwar Reddy', ['CS204', 'CS206', 'AI302']],
            ['S106', 'Farhan Ali', ['CS205', 'AI301', 'AI303']],
            ['S107', 'Gautam Menon', ['CS206', 'AI302', 'MA202']],
            ['S108', 'Harini Iyer', ['AI301', 'AI302', 'MA201']],
            ['S109', 'Ishaan Gupta', ['AI302', 'AI303', 'MA202']],
            ['S110', 'Jayant Verma', ['MA201', 'MA202', 'CS201']],
            ['S111', 'Kavya Pillai', ['EC201', 'CS203', 'CS205']],
            ['S112', 'Lakshman K', ['EC201', 'CS201', 'MA201']],
            ['S113', 'Meera Joshi', ['CS202', 'CS205', 'AI301']],
            ['S114', 'Naveen Kumar', ['CS204', 'AI303', 'EC201']],
            ['S115', 'Oviya Raj', ['CS206', 'CS201', 'AI302']],
            ['S116', 'Pranav Roy', ['AI301', 'CS203', 'MA202']],
            ['S117', 'Qasim Zaid', ['MA202', 'EC201', 'CS204']],
            ['S118', 'Rhea Sen', ['CS202', 'AI303', 'CS206']],
            ['S119', 'Siddharth M', ['CS205', 'MA201', 'EC201']],
            ['S120', 'Tanvi Desai', ['AI303', 'CS201', 'MA202']]
        ];

        studentEnrollments.forEach(s => this.addStudent(s[0], s[1], s[2]));

        // 5 Examination Slots
        this.addSlot('Slot 1', '2026-12-15', '09:00', '12:00', 'Hall 101', 150);
        this.addSlot('Slot 2', '2026-12-15', '14:00', '17:00', 'Hall 102', 150);
        this.addSlot('Slot 3', '2026-12-16', '09:00', '12:00', 'Hall 101', 150);
        this.addSlot('Slot 4', '2026-12-16', '14:00', '17:00', 'Hall 102', 150);
        this.addSlot('Slot 5', '2026-12-17', '09:00', '12:00', 'Hall 103', 150);

        this.notify('preset_loaded');
    }

    loadPigeonholeUnsolvable() {
        // 4 mutually conflicting courses (K4 clique) with only 3 slots available
        this.courses.clear();
        this.students.clear();
        this.slots = [];

        this.addCourse('MATH101', 'Calculus I', 'Mathematics');
        this.addCourse('PHYS101', 'Classical Physics', 'Physics');
        this.addCourse('CHEM101', 'General Chemistry', 'Chemistry');
        this.addCourse('BIO101', 'Introductory Biology', 'Biology');

        // All 4 courses share students pairwise, forming a complete graph K4
        this.addStudent('ST_A', 'Student A', ['MATH101', 'PHYS101', 'CHEM101', 'BIO101']);
        this.addStudent('ST_B', 'Student B', ['MATH101', 'PHYS101']);
        this.addStudent('ST_C', 'Student C', ['PHYS101', 'CHEM101']);
        this.addStudent('ST_D', 'Student D', ['CHEM101', 'BIO101']);
        this.addStudent('ST_E', 'Student E', ['BIO101', 'MATH101']);
        this.addStudent('ST_F', 'Student F', ['MATH101', 'CHEM101']);
        this.addStudent('ST_G', 'Student G', ['PHYS101', 'BIO101']);

        // Only 3 slots provided for a 4-clique! (Mathematically impossible)
        this.addSlot('Slot 1', '2026-12-10', '09:00', '12:00', 'Hall A', 100);
        this.addSlot('Slot 2', '2026-12-10', '14:00', '17:00', 'Hall B', 100);
        this.addSlot('Slot 3', '2026-12-11', '09:00', '12:00', 'Hall C', 100);

        this.notify('preset_loaded');
    }

    // --- CSV Import / Export ---
    exportStudentsCSV() {
        const rows = [['Student ID', 'Student Name', 'Enrolled Courses']];
        this.getAllStudents().forEach(s => {
            const courseCodes = s.enrolledCourseIds
                .map(id => this.courses.get(id)?.code || id)
                .join(', ');
            rows.push([`"${s.id}"`, `"${s.name}"`, `"${courseCodes}"`]);
        });
        return rows.map(r => r.join(',')).join('\n');
    }

    exportCoursesCSV() {
        const rows = [['Course Code', 'Course Name', 'Department', 'Credits']];
        this.getAllCourses().forEach(c => {
            rows.push([`"${c.code}"`, `"${c.name}"`, `"${c.department}"`, c.credits]);
        });
        return rows.map(r => r.join(',')).join('\n');
    }

    exportSlotsCSV() {
        const rows = [['Slot Code', 'Date', 'Start Time', 'End Time', 'Room', 'Capacity']];
        this.getAllSlots().forEach(s => {
            rows.push([`"${s.code}"`, `"${s.date}"`, `"${s.startTime}"`, `"${s.endTime}"`, `"${s.room}"`, s.capacity]);
        });
        return rows.map(r => r.join(',')).join('\n');
    }

    exportTimetableCSV(assignmentMap) {
        const rows = [['Course Code', 'Course Name', 'Slot Code', 'Date', 'Start Time', 'End Time', 'Room', 'Enrolled Students']];
        this.getAllCourses().forEach(course => {
            const slotId = assignmentMap.get(course.id);
            const slot = this.slots.find(s => s.id === slotId);
            const enrolled = this.getStudentsInCourse(course.id).length;
            rows.push([
                `"${course.code}"`,
                `"${course.name}"`,
                `"${slot ? slot.code : 'UNASSIGNED'}"`,
                `"${slot ? slot.date : '-'}"`,
                `"${slot ? slot.startTime : '-'}"`,
                `"${slot ? slot.endTime : '-'}"`,
                `"${slot ? slot.room : '-'}"`,
                enrolled
            ]);
        });
        return rows.map(r => r.join(',')).join('\n');
    }

    importStudentsCSV(csvText) {
        const lines = csvText.trim().split(/\r?\n/);
        if (lines.length < 2) throw new Error('CSV file is empty or missing headers.');

        let addedCount = 0;
        // Parse CSV handling quoted values
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = this._parseCSVLine(line);
            if (cols.length >= 2) {
                const sId = cols[0].trim();
                const sName = cols[1].trim();
                const courseStr = cols[2] ? cols[2].trim() : '';
                const courseCodes = courseStr
                    ? courseStr.split(/[,;|]/).map(c => c.trim()).filter(Boolean)
                    : [];

                // Auto create courses if not yet present
                courseCodes.forEach(code => {
                    if (!this.getCourseByCode(code)) {
                        this.addCourse(code, `${code} Exam`);
                    }
                });

                if (this.students.has(sId.toUpperCase())) {
                    this.updateStudent(sId, sName, courseCodes);
                } else {
                    this.addStudent(sId, sName, courseCodes);
                }
                addedCount++;
            }
        }
        this.notify('import_complete');
        return addedCount;
    }

    _parseCSVLine(line) {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' || char === "'") {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(cur);
                cur = '';
            } else {
                cur += char;
            }
        }
        result.push(cur);
        return result;
    }

    // --- LocalStorage persistence ---
    saveToStorage() {
        try {
            const data = {
                courses: Array.from(this.courses.values()),
                students: Array.from(this.students.values()),
                slots: this.slots
            };
            localStorage.setItem('aies_exam_scheduler_data', JSON.stringify(data));
        } catch (e) {
            console.warn('LocalStorage save failed:', e);
        }
    }

    loadFromStorage() {
        try {
            const raw = localStorage.getItem('aies_exam_scheduler_data');
            if (raw) {
                const data = JSON.parse(raw);
                if (data.courses && data.students && data.slots && data.courses.length > 0) {
                    this.courses.clear();
                    data.courses.forEach(c => this.courses.set(c.id, new Course(c.id, c.code, c.name, c.department, c.credits)));
                    this.students.clear();
                    data.students.forEach(s => this.students.set(s.id, new Student(s.id, s.name, s.enrolledCourseIds)));
                    this.slots = data.slots.map(s => new ExamSlot(s.id, s.code, s.date, s.startTime, s.endTime, s.room, s.capacity));
                    return;
                }
            }
        } catch (e) {
            console.warn('LocalStorage load failed, loading default sample:', e);
        }
        this.loadDefaultSample();
    }
}

// Global instance
window.enrolmentManager = new EnrolmentManager();
