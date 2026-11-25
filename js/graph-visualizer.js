/**
 * graph-visualizer.js - Interactive Force-Directed Conflict Graph
 * Implements physics simulation, high-DPI canvas rendering, node dragging,
 * edge weight visualization, common student inspector, and macOS glassmorphism styling.
 */

class ConflictGraphVisualizer {
    constructor(canvasId, containerId) {
        this.canvas = document.getElementById(canvasId);
        this.container = document.getElementById(containerId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.edges = [];
        this.animFrameId = null;
        this.isRunning = true;
        this.physicsEnabled = true;

        // Viewport transform
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.dpr = window.devicePixelRatio || 1;

        // Interaction state
        this.draggedNode = null;
        this.hoveredNode = null;
        this.hoveredEdge = null;
        this.selectedNode = null;
        this.selectedEdge = null;
        this.isPanning = false;
        this.startPan = { x: 0, y: 0 };

        // Color palette (macOS / Apple system vibrant colors)
        this.colors = [
            '#0A84FF', // Blue
            '#BF5AF2', // Purple
            '#30D158', // Green
            '#FF9F0A', // Orange
            '#FF453A', // Red
            '#64D2FF', // Cyan
            '#FFD60A', // Yellow
            '#FF375F', // Pink
            '#5E5CE6', // Indigo
            '#40C8E0'  // Teal
        ];

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Mouse & Touch events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.onMouseLeave());
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

        // Touch support for mobile/tablets
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', () => this.onMouseUp());
    }

    resize() {
        if (!this.canvas || !this.container) return;
        const rect = this.container.getBoundingClientRect();
        this.width = rect.width;
        this.height = Math.max(rect.height, 420);

        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        this.ctx.scale(this.dpr, this.dpr);
        this.requestRender();
    }

    setData(conflictData) {
        // conflictData: { courses, edges, conflicts, totalConflicts, maxDegree, density }
        const { courses, edges } = conflictData;
        const oldPositions = new Map();
        this.nodes.forEach(n => oldPositions.set(n.id, { x: n.x, y: n.y }));

        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const radius = Math.min(this.width, this.height) * 0.35;

        // Create or preserve node positions
        this.nodes = courses.map((course, idx) => {
            const old = oldPositions.get(course.id);
            const angle = (idx / courses.length) * Math.PI * 2;
            const x = old ? old.x : centerX + Math.cos(angle) * (radius + (Math.random() * 20 - 10));
            const y = old ? old.y : centerY + Math.sin(angle) * (radius + (Math.random() * 20 - 10));

            return {
                id: course.id,
                code: course.code,
                name: course.name,
                department: course.department,
                credits: course.credits,
                x,
                y,
                vx: 0,
                vy: 0,
                radius: 28,
                color: this.colors[idx % this.colors.length]
            };
        });

        // Map edges to node references
        const nodeMap = new Map();
        this.nodes.forEach(n => nodeMap.set(n.id, n));

        this.edges = edges.map(edge => {
            return {
                source: nodeMap.get(edge.source),
                target: nodeMap.get(edge.target),
                weight: edge.weight,
                students: edge.students
            };
        }).filter(e => e.source && e.target);

        this.restartSimulation();
    }

    restartSimulation() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.tick();
        }
    }

    tick() {
        if (!this.isRunning) return;

        if (this.physicsEnabled) {
            this.updatePhysics();
        }

        this.render();
        this.animFrameId = requestAnimationFrame(() => this.tick());
    }

    updatePhysics() {
        const k = 140; // ideal spring length
        const repulsiveForce = 12000;
        const damping = 0.84;
        const centerGravity = 0.035;
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        // 1. Repulsion between all node pairs
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const n1 = this.nodes[i];
                const n2 = this.nodes[j];
                const dx = n2.x - n1.x;
                const dy = n2.y - n1.y;
                let dist = Math.sqrt(dx * dx + dy * dy) || 1;

                if (dist < 350) {
                    const force = repulsiveForce / (dist * dist);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    if (n1 !== this.draggedNode) {
                        n1.vx -= fx;
                        n1.vy -= fy;
                    }
                    if (n2 !== this.draggedNode) {
                        n2.vx += fx;
                        n2.vy += fy;
                    }
                }
            }
        }

        // 2. Spring attraction along conflict edges
        this.edges.forEach(edge => {
            const dx = edge.target.x - edge.source.x;
            const dy = edge.target.y - edge.source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const displacement = dist - k;
            // Higher weight (more common students) pulls slightly closer
            const springStrength = 0.045 + (edge.weight * 0.015);
            const fx = (dx / dist) * displacement * springStrength;
            const fy = (dy / dist) * displacement * springStrength;

            if (edge.source !== this.draggedNode) {
                edge.source.vx += fx;
                edge.source.vy += fy;
            }
            if (edge.target !== this.draggedNode) {
                edge.target.vx -= fx;
                edge.target.vy -= fy;
            }
        });

        // 3. Center gravity & velocity dampening
        this.nodes.forEach(node => {
            if (node === this.draggedNode) return;

            const cdx = centerX - node.x;
            const cdy = centerY - node.y;
            node.vx += cdx * centerGravity;
            node.vy += cdy * centerGravity;

            node.vx *= damping;
            node.vy *= damping;

            node.x += node.vx;
            node.y += node.vy;

            // Boundary constraints
            const pad = node.radius + 10;
            node.x = Math.max(pad, Math.min(this.width - pad, node.x));
            node.y = Math.max(pad, Math.min(this.height - pad, node.y));
        });
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        ctx.save();
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.zoom, this.zoom);

        const isDarkMode = document.documentElement.classList.contains('dark-theme') || 
                           document.body.classList.contains('dark-theme');

        // Draw Edges
        this.edges.forEach(edge => {
            const isHighlighted = (this.hoveredNode && (edge.source === this.hoveredNode || edge.target === this.hoveredNode)) ||
                                  (this.selectedNode && (edge.source === this.selectedNode || edge.target === this.selectedNode)) ||
                                  (this.hoveredEdge === edge) ||
                                  (this.selectedEdge === edge);

            ctx.beginPath();
            ctx.moveTo(edge.source.x, edge.source.y);
            ctx.lineTo(edge.target.x, edge.target.y);

            if (isHighlighted) {
                ctx.strokeStyle = '#FF3B30'; // Highlight conflict in Apple Coral Red
                ctx.lineWidth = Math.min(2 + edge.weight * 1.5, 7);
                ctx.shadowColor = 'rgba(255, 69, 58, 0.6)';
                ctx.shadowBlur = 8;
            } else {
                ctx.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.14)';
                ctx.lineWidth = Math.min(1 + edge.weight * 0.8, 5);
                ctx.shadowBlur = 0;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Draw edge weight badge (number of shared students)
            const midX = (edge.source.x + edge.target.x) / 2;
            const midY = (edge.source.y + edge.target.y) / 2;

            if (isHighlighted || edge.weight > 1 || this.nodes.length <= 8) {
                ctx.beginPath();
                ctx.arc(midX, midY, 10, 0, Math.PI * 2);
                ctx.fillStyle = isHighlighted ? '#FF3B30' : (isDarkMode ? '#2C2C2E' : '#E5E5EA');
                ctx.fill();
                ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = isHighlighted ? '#FFFFFF' : (isDarkMode ? '#E5E5EA' : '#1C1C1E');
                ctx.fillText(edge.weight, midX, midY);
            }
        });

        // Draw Nodes
        this.nodes.forEach(node => {
            const isHovered = (this.hoveredNode === node);
            const isSelected = (this.selectedNode === node);
            const isConnectedToHovered = this.hoveredNode && this.edges.some(e => 
                (e.source === this.hoveredNode && e.target === node) || 
                (e.target === this.hoveredNode && e.source === node)
            );

            // Node outer halo for hovered / selected
            if (isHovered || isSelected) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
                ctx.fillStyle = isSelected ? 'rgba(10, 132, 255, 0.28)' : 'rgba(255, 69, 58, 0.2)';
                ctx.fill();
            }

            // Node Circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

            // Subtle gradient
            const grad = ctx.createRadialGradient(node.x - 6, node.y - 6, 2, node.x, node.y, node.radius);
            grad.addColorStop(0, '#FFFFFF');
            grad.addColorStop(0.3, node.color);
            grad.addColorStop(1, this._shadeColor(node.color, -20));

            ctx.fillStyle = grad;
            ctx.shadowColor = isDarkMode ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.16)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 4;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            // Border
            ctx.lineWidth = 2;
            ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)';
            ctx.stroke();

            // Label (Course Code)
            ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#FFFFFF';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 3;
            ctx.fillText(node.code, node.x, node.y);
            ctx.shadowBlur = 0;
        });

        ctx.restore();
    }

    _shadeColor(color, percent) {
        let R = parseInt(color.substring(1, 3), 16);
        let G = parseInt(color.substring(3, 5), 16);
        let B = parseInt(color.substring(5, 7), 16);
        R = parseInt(R * (100 + percent) / 100);
        G = parseInt(G * (100 + percent) / 100);
        B = parseInt(B * (100 + percent) / 100);
        R = (R < 255) ? R : 255;
        G = (G < 255) ? G : 255;
        B = (B < 255) ? B : 255;
        const RR = ((R.toString(16).length === 1) ? '0' + R.toString(16) : R.toString(16));
        const GG = ((G.toString(16).length === 1) ? '0' + G.toString(16) : G.toString(16));
        const BB = ((B.toString(16).length === 1) ? '0' + B.toString(16) : B.toString(16));
        return '#' + RR + GG + BB;
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;
        // Invert pan and zoom
        const x = (canvasX - this.panX) / this.zoom;
        const y = (canvasY - this.panY) / this.zoom;
        return { x, y, rawX: canvasX, rawY: canvasY };
    }

    findNodeAt(x, y) {
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const n = this.nodes[i];
            const dist = Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2);
            if (dist <= n.radius + 6) return n;
        }
        return null;
    }

    findEdgeAt(x, y) {
        const threshold = 8;
        for (const edge of this.edges) {
            const d = this._distToSegment({ x, y }, edge.source, edge.target);
            if (d <= threshold) return edge;
        }
        return null;
    }

    _distToSegment(p, v, w) {
        const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
        if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = v.x + t * (w.x - v.x);
        const projY = v.y + t * (w.y - v.y);
        return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
    }

    onMouseDown(e) {
        const pos = this.getMousePos(e);
        const node = this.findNodeAt(pos.x, pos.y);
        const edge = this.findEdgeAt(pos.x, pos.y);

        if (node) {
            this.draggedNode = node;
            this.selectedNode = node;
            this.selectedEdge = null;
            if (window.onGraphNodeSelect) window.onGraphNodeSelect(node);
        } else if (edge) {
            this.selectedEdge = edge;
            this.selectedNode = null;
            if (window.onGraphEdgeSelect) window.onGraphEdgeSelect(edge);
        } else {
            this.selectedNode = null;
            this.selectedEdge = null;
            this.isPanning = true;
            this.startPan = { x: pos.rawX - this.panX, y: pos.rawY - this.panY };
            if (window.onGraphClearSelect) window.onGraphClearSelect();
        }
        this.requestRender();
    }

    onMouseMove(e) {
        const pos = this.getMousePos(e);

        if (this.draggedNode) {
            this.draggedNode.x = pos.x;
            this.draggedNode.y = pos.y;
            this.draggedNode.vx = 0;
            this.draggedNode.vy = 0;
            this.requestRender();
            return;
        }

        if (this.isPanning) {
            this.panX = pos.rawX - this.startPan.x;
            this.panY = pos.rawY - this.startPan.y;
            this.requestRender();
            return;
        }

        // Hover detection
        const prevHoveredNode = this.hoveredNode;
        const prevHoveredEdge = this.hoveredEdge;
        this.hoveredNode = this.findNodeAt(pos.x, pos.y);
        this.hoveredEdge = this.hoveredNode ? null : this.findEdgeAt(pos.x, pos.y);

        if (this.hoveredNode !== prevHoveredNode || this.hoveredEdge !== prevHoveredEdge) {
            this.canvas.style.cursor = (this.hoveredNode || this.hoveredEdge) ? 'pointer' : 'default';
            if (this.hoveredNode && window.onGraphNodeHover) {
                window.onGraphNodeHover(this.hoveredNode, pos);
            } else if (this.hoveredEdge && window.onGraphEdgeHover) {
                window.onGraphEdgeHover(this.hoveredEdge, pos);
            } else if (window.onGraphLeaveHover) {
                window.onGraphLeaveHover();
            }
            this.requestRender();
        }
    }

    onMouseUp() {
        this.draggedNode = null;
        this.isPanning = false;
    }

    onMouseLeave() {
        this.draggedNode = null;
        this.isPanning = false;
        this.hoveredNode = null;
        this.hoveredEdge = null;
        if (window.onGraphLeaveHover) window.onGraphLeaveHover();
        this.requestRender();
    }

    onWheel(e) {
        e.preventDefault();
        const pos = this.getMousePos(e);
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(0.4, Math.min(3.0, this.zoom * zoomFactor));

        // Zoom towards mouse
        this.panX = pos.rawX - (pos.rawX - this.panX) * (newZoom / this.zoom);
        this.panY = pos.rawY - (pos.rawY - this.panY) * (newZoom / this.zoom);
        this.zoom = newZoom;
        this.requestRender();
    }

    onTouchStart(e) {
        if (e.touches.length === 1) {
            e.preventDefault();
            this.onMouseDown(e.touches[0]);
        }
    }

    onTouchMove(e) {
        if (e.touches.length === 1) {
            e.preventDefault();
            this.onMouseMove(e.touches[0]);
        }
    }

    togglePhysics() {
        this.physicsEnabled = !this.physicsEnabled;
        return this.physicsEnabled;
    }

    resetView() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.physicsEnabled = true;

        // Arrange in clean circle
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const radius = Math.min(this.width, this.height) * 0.35;
        this.nodes.forEach((n, idx) => {
            const angle = (idx / this.nodes.length) * Math.PI * 2;
            n.x = centerX + Math.cos(angle) * radius;
            n.y = centerY + Math.sin(angle) * radius;
            n.vx = 0;
            n.vy = 0;
        });

        this.restartSimulation();
    }

    requestRender() {
        if (!this.isRunning) {
            this.render();
        }
    }
}

window.ConflictGraphVisualizer = ConflictGraphVisualizer;

