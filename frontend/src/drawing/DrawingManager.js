export class DrawingManager {
    constructor(chartManager) {
        this.cm = chartManager;

        // State
        this.drawings = [];
        this.currentDrawing = null;
        this.drawingMode = null;
        this.drawingState = 'idle'; // idle, armed, creating

        this.magnetMode = false;
        this.isLocked = false;

        // History
        this.history = [];
        this.redoStack = [];

        // Interaction State
        this.selectedDrawingIndex = -1;
        this.hoveredState = { index: -1, handle: null, edge: null };
        this.isDraggingDrawing = false;
        this.dragStartPoint = null;
        this.activeHandle = null;
        this.activeEdge = null;
        this.dragDrawingSnapshot = null;
        this.dragIndex = -1;

        // Bindings
        this.globalMouseMoveHandler = this.onGlobalMouseMove.bind(this);
        this.globalMouseUpHandler = this.onGlobalMouseUp.bind(this);

        this.loadDrawings();
    }

    setDrawingMode(mode) {
        console.log(`Drawing Mode set to: ${mode}`);
        this.drawingMode = mode;
        this.drawingState = mode ? 'armed' : 'idle';
        this.cm.container.style.cursor = mode ? 'crosshair' : 'default';

        if (this.cm.canvas) {
            this.cm.canvas.style.pointerEvents = mode ? 'auto' : 'none';
            this.cm.canvas.style.zIndex = mode ? '1000' : '50';
        }

        if (mode === 'Text') this.cm.container.style.cursor = 'text';

        if (!mode) {
            this.currentDrawing = null;
            this.isDrawing = false; // Legacy flag compatibility
        }

        this.selectedDrawingIndex = -1;

        if (!mode) {
            this.cm.requestDraw();
        }
    }

    toggleMagnet(active) {
        this.magnetMode = active;
    }

    toggleLock(active) {
        this.isLocked = active;
        this.cm.container.style.cursor = active ? 'default' : (this.drawingMode ? 'crosshair' : 'default');
        if (active) {
            this.selectedDrawingIndex = -1;
            this.cm.requestDraw();
        }
    }

    // --- Interaction Delegation ---

    onHoverMove(e) {
        if (this.drawingMode || this.isDraggingDrawing) return;

        const point = this.getPointFromEvent(e);
        const hit = this.getHitInfo(point);

        const prevHover = this.hoveredState;
        const newHover = { index: hit.index, handle: hit.handle };

        // Optimization: Only update/redraw if changed
        if (prevHover.index !== newHover.index || prevHover.handle !== newHover.handle) {
            this.hoveredState = newHover;
            this.cm.requestDraw();
        }

        // Cursor Logic
        const container = this.cm.container;
        if (hit.index !== -1) {
            const isSelected = (hit.index === this.selectedDrawingIndex);

            if (isSelected && hit.handle) {
                // Diagonal Resize Cursors
                if (hit.handle === 'p1' || hit.handle === 'p2') {
                    container.style.cursor = 'nwse-resize';
                } else {
                    container.style.cursor = 'nesw-resize';
                }
            } else {
                // Edge/Body Hover -> Move
                container.style.cursor = 'move';
            }
        } else {
            container.style.cursor = 'default';
        }
    }


    onMouseDown(e) {
        // 1. Get Point
        let point = this.getPointFromEvent(e);
        if (!point.time || !point.price) return;

        // Apply Magnet
        if (this.drawingMode || this.isDraggingDrawing) {
            point = this.applyMagnet(point);
        }

        // 2. Interaction Mode (Selecting/Dragging)
        if (!this.drawingMode) {
            const hit = this.getHitInfo(point);
            if (hit.index !== -1) {
                // Prevent chart interaction (panning)
                e.preventDefault();
                e.stopPropagation();

                this.selectedDrawingIndex = hit.index;
                this.startDrawingDrag(hit, point, e);
            } else {
                this.selectedDrawingIndex = -1;
            }
            this.cm.requestDraw();
            return;
        }

        // 3. Drawing Creation Mode

        // Multi-Step Continuation
        if (this.drawingState === 'creating' && this.currentDrawing) {
            if ((this.currentDrawing.type === 'FibExtension' || this.currentDrawing.type === 'FibChannel') && this.currentDrawing.step === 2) {
                this.currentDrawing.p3 = { time: point.time, price: point.price };
                this.drawings.push(this.currentDrawing);
                this.finalizeDrawing();
                return;
            }
        }

        // One-Click Tools
        if (this.drawingMode === 'Text') {
            const text = prompt("Enter text:", "My Annotation");
            if (text) {
                this.drawings.push({ type: 'text', time: point.time, price: point.price, text: text });
                this.finalizeDrawing();
            }
            return;
        }
        if (this.drawingMode === 'HorizontalLine') {
            this.drawings.push({ type: 'horizontal', price: point.price });
            this.finalizeDrawing();
            return;
        }
        if (this.drawingMode === 'VerticalLine') {
            this.drawings.push({ type: 'vertical', time: point.time });
            this.finalizeDrawing();
            return;
        }

        // Drag-to-Draw Start
        this.drawingState = 'creating';
        const startP = { time: point.time, price: point.price };
        const endP = { ...startP };

        // Initialize Shape
        // Simplified Logic for brevity/robustness
        // Initialize Shape
        // Simplified Logic for brevity/robustness
        const type = this.drawingMode.toLowerCase(); // Normalized 

        if (type === 'rectangle') {
            this.currentDrawing = { type: 'rectangle', p1: startP, p2: endP };
        } else if (type === 'ray') {
            this.currentDrawing = { type: 'ray', start: startP, direction: endP };
        } else if (type === 'FibRetracement' || type === 'FibFan') {
            this.currentDrawing = { type: type, start: startP, end: endP };
        } else if (type === 'FibExtension' || type === 'FibChannel') {
            this.currentDrawing = { type: type, step: 1, p1: startP, p2: endP, p3: endP };
        } else {
            // Generic 2-point
            this.currentDrawing = { type: type, start: startP, end: endP };
        }
    }

    onMouseMove(e) {
        if (this.drawingState !== 'creating' || !this.currentDrawing) return;

        let point = this.getPointFromEvent(e);
        if (!point.time || !point.price) return;

        if (this.magnetMode) point = this.applyMagnet(point);

        // Update End Point
        const d = this.currentDrawing;
        if (d.type === 'rectangle') {
            d.p2 = { time: point.time, price: point.price };
        } else if (d.type === 'ray') {
            d.direction = { time: point.time, price: point.price };
        } else if (d.type === 'FibExtension' && d.step === 2) {
            d.p3 = { time: point.time, price: point.price };
        } else if (d.step === 1) { // Fib Ext Step 1
            d.p2 = { time: point.time, price: point.price };
            d.p3 = { ...d.p2 };
        } else {
            d.end = { time: point.time, price: point.price };
        }

        this.cm.requestDraw();
    }

    onMouseUp(e) {
        if (this.drawingState !== 'creating' || !this.currentDrawing) return;

        // Check Multi-step
        if (this.currentDrawing.type === 'FibExtension' && this.currentDrawing.step === 1) {
            this.currentDrawing.step = 2; // Wait for next click
            return;
        }

        this.finalizeDrawing();
    }

    finalizeDrawing() {
        if (this.currentDrawing && !this.drawings.includes(this.currentDrawing)) {
            // Only push if not already pushed (some paths push early)
            this.drawings.push(this.currentDrawing);
        }
        this.saveDrawings();
        this.currentDrawing = null;

        if (!this.isLocked) {
            this.setDrawingMode(null);
        } else {
            this.drawingState = 'armed';
            this.currentDrawing = null;
        }
        this.cm.requestDraw();
    }

    // --- Dragging ---

    startDrawingDrag(hit, startPoint, event) {
        if (this.isLocked) return;

        this.isDraggingDrawing = true;
        this.dragStartPoint = startPoint;
        this.activeHandle = hit.handle;
        this.activeEdge = hit.edge;

        const d = this.drawings[hit.index];
        this.dragDrawingSnapshot = JSON.parse(JSON.stringify(d));
        this.dragIndex = hit.index;

        this.cm.chart.applyOptions({ handleScroll: false, handleScale: false });

        window.addEventListener('mousemove', this.globalMouseMoveHandler);
        window.addEventListener('mouseup', this.globalMouseUpHandler);

        // Store pixel start for accurate delta calc
        const rect = this.cm.canvas.getBoundingClientRect();
        this.dragStartPixel = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    onGlobalMouseMove(e) {
        if (!this.isDraggingDrawing) return;

        // Prevent default text selection during drag
        e.preventDefault();

        let point = this.getPointFromEvent(e);
        if (!point.time || !point.price) return;
        if (this.magnetMode) point = this.applyMagnet(point);

        const d = this.drawings[this.dragIndex];
        const snapshot = this.dragDrawingSnapshot;

        const rect = this.cm.canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const dx = currentX - this.dragStartPixel.x;
        const dy = currentY - this.dragStartPixel.y;

        // Logic for Rectangle Resizing (Simplified)
        if (d.type === 'rectangle' && this.activeHandle) {
            const handle = this.activeHandle;
            // Update the anchor corresponding to the handle
            if (handle === 'p1') {
                d.p1.time = point.time;
                d.p1.price = point.price;
            } else if (handle === 'p2') {
                d.p2.time = point.time;
                d.p2.price = point.price;
            } else if (handle === 'mix1') { // p2.x, p1.y (Top-Right relative to p1 being bottom-left)
                // Actually depends on positions, but simplistically:
                // We want to control the dimension formed by X of this point and Y of this point
                // Wait, anchors are absolute. "mix1" implies we grabbed the corner formed by (d.p2.time, d.p1.price)
                d.p2.time = point.time;
                d.p1.price = point.price;
            } else if (handle === 'mix2') { // p1.x, p2.y
                d.p1.time = point.time;
                d.p2.price = point.price;
            }
        }

        // Generalized Move (Pixel Delta based)
        else if (d.p1 && d.p2) {
            const map = (p) => this.mapPointToPixel(p);
            const unmap = (x, y) => {
                const time = this.cm.chart.timeScale().coordinateToTime(x);
                const price = this.cm.candleSeries.coordinateToPrice(y);
                return { time, price };
            };

            const p1Pix = map(snapshot.p1);
            const p2Pix = map(snapshot.p2);

            if (p1Pix && p2Pix) {
                const newP1 = unmap(p1Pix.x + dx, p1Pix.y + dy);
                const newP2 = unmap(p2Pix.x + dx, p2Pix.y + dy);

                if (newP1.time && newP1.price && newP2.time && newP2.price) {
                    d.p1 = newP1;
                    d.p2 = newP2;
                }
            }
        } else if (d.start && d.end) {
            // This block still uses time/price delta, but the instruction was to refactor for pixel-based.
            // For now, keeping it as is, but ideally this would also be converted to pixel-based delta.
            const timeDelta = point.time - this.dragStartPoint.time;
            const priceDelta = point.price - this.dragStartPoint.price;
            d.start.time = snapshot.start.time + timeDelta;
            d.start.price = snapshot.start.price + priceDelta;
            d.end.time = snapshot.end.time + timeDelta;
            d.end.price = snapshot.end.price + priceDelta;
        }

        this.cm.requestDraw();
    }

    onGlobalMouseUp(e) {
        this.isDraggingDrawing = false;
        this.cm.chart.applyOptions({
            handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
            handleScale: { axisPressedMouseMove: { time: true, price: false }, mouseWheel: true, pinch: true }
        });
        window.removeEventListener('mousemove', this.globalMouseMoveHandler);
        window.removeEventListener('mouseup', this.globalMouseUpHandler);
        this.saveDrawings();
    }

    // --- Hit Testing ---

    getHitInfo(point) {
        const threshold = 5;
        let bestHit = { index: -1, distance: Infinity, handle: null };

        this.drawings.forEach((d, i) => {
            if (d.type === 'rectangle') {
                const p1 = this.mapPointToPixel(d.p1);
                const p2 = this.mapPointToPixel(d.p2);

                if (!p1 || !p2) return;

                const x1 = Math.min(p1.x, p2.x);
                const x2 = Math.max(p1.x, p2.x);
                const y1 = Math.min(p1.y, p2.y);
                const y2 = Math.max(p1.y, p2.y);

                // Handle Detection (Priority over edges)
                const handles = [
                    { name: 'p1', x: p1.x, y: p1.y },
                    { name: 'p2', x: p2.x, y: p2.y },
                    { name: 'mix1', x: p2.x, y: p1.y },
                    { name: 'mix2', x: p1.x, y: p2.y }
                ];

                for (const h of handles) {
                    const dist = Math.sqrt(Math.pow(point.x - h.x, 2) + Math.pow(point.y - h.y, 2));
                    if (dist <= threshold) {
                        // Return immediately if handle hit (priority)
                        bestHit = { index: i, distance: dist, handle: h.name };
                        return; // Exit forEach for this drawing, as a handle is hit
                    }
                }

                let dist = Infinity;

                // Vertical Edges
                if (point.y >= y1 - threshold && point.y <= y2 + threshold) {
                    dist = Math.min(dist, Math.abs(point.x - x1), Math.abs(point.x - x2));
                }

                // Horizontal Edges
                if (point.x >= x1 - threshold && point.x <= x2 + threshold) {
                    dist = Math.min(dist, Math.abs(point.y - y1), Math.abs(point.y - y2));
                }

                if (dist <= threshold && dist < bestHit.distance) {
                    bestHit = { index: i, distance: dist, handle: null };
                }
            }
        });

        return bestHit;
    }

    // --- Utils ---

    getPointFromEvent(e) {
        const rect = this.cm.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const time = this.cm.chart.timeScale().coordinateToTime(x);
        const price = this.cm.candleSeries.coordinateToPrice(y);
        return { x, y, time, price };
    }

    mapPointToPixel(point) {
        if (!point || !point.time) return null;
        try {
            const x = this.cm.chart.timeScale().timeToCoordinate(point.time);
            const y = this.cm.candleSeries.priceToCoordinate(point.price);
            if (x === null || y === null) return null;
            return { x, y };
        } catch (e) {
            return null;
        }
    }

    applyMagnet(point) {
        if (!this.cm.data || this.cm.data.length === 0) return point;

        // binary search for nearest candle by time
        const data = this.cm.data;
        // Assuming data is sorted by time
        // Lightweight charts usually parses dates to timestamps, but let's assume 'time' is comparable string or num

        // Simple linear search if small, but binary is better. Or just look for nearest index.
        // Actually, we can just iterate if we don't have a helper.
        // Let's rely on time scale coordinate if we could, but here we have data.

        // Find closest candle based on time difference
        // We need to convert point.time to timestamp to compare if they are strings
        // But point.time from chart is business day string usually "2023-01-01"
        // Let's assume point.time matches format of d.time in data.

        // Actually, improved approach:
        // Use the chart's timeScale to find the logical index, then get data item.
        // But we don't have direct index access API exposed here easily.

        // Let's do a simple find for now (optimization later if needed)
        // Convert input time to timestamp for distance check

        let bestCandle = null;
        let minTimeDist = Infinity;

        const targetTime = new Date(point.time).getTime();
        if (isNaN(targetTime)) return point; // Can't snap if invalid date

        // Heuristic: Search only visible range if possible, but full search is safer for correctness
        // optimize: Iterate backwards/forwards? 
        // Let's just iterate.
        for (const candle of data) {
            const candleTime = new Date(candle.time).getTime();
            const diff = Math.abs(candleTime - targetTime);
            if (diff < minTimeDist) {
                minTimeDist = diff;
                bestCandle = candle;
            }
        }

        if (bestCandle) {
            // Snap Time
            const snappedTime = bestCandle.time;

            // Snap Price (Closest of O, H, L, C)
            const p = point.price;
            const prices = [bestCandle.open, bestCandle.high, bestCandle.low, bestCandle.close];

            let bestPrice = p;
            let minPriceDist = Infinity;

            for (const val of prices) {
                const diff = Math.abs(val - p);
                if (diff < minPriceDist) {
                    minPriceDist = diff;
                    bestPrice = val;
                }
            }

            return { time: snappedTime, price: bestPrice };
        }

        return point;
    }

    saveDrawings() {
        localStorage.setItem('chart_drawings', JSON.stringify(this.drawings));
    }

    loadDrawings() {
        const s = localStorage.getItem('chart_drawings');
        if (s) { try { this.drawings = JSON.parse(s); } catch (e) { } }
    }

    // --- RENDER ---
    drawDrawings() {
        const ctx = this.cm.ctx;
        const canvas = this.cm.canvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const all = [...this.drawings];
        if (this.currentDrawing) all.push(this.currentDrawing);

        all.forEach((d, i) => {
            const isSelected = (i === this.selectedDrawingIndex) || (d === this.currentDrawing);

            ctx.strokeStyle = isSelected ? '#FF6D00' : '#2962FF';
            ctx.lineWidth = 2;

            if (d.type === 'rectangle' || d.type === 'Rectangle') {
                const p1 = this.mapPointToPixel(d.p1);
                const p2 = this.mapPointToPixel(d.p2);

                if (p1 && p2) {
                    const x = Math.min(p1.x, p2.x);
                    const y = Math.min(p1.y, p2.y);
                    const w = Math.abs(p2.x - p1.x);
                    const h = Math.abs(p2.y - p1.y);

                    ctx.beginPath();
                    ctx.strokeRect(x, y, w, h);
                    ctx.fillStyle = 'rgba(41, 98, 255, 0.1)';
                    ctx.fillRect(x, y, w, h);

                    // Render Handles if Selected
                    if (isSelected) {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.strokeStyle = '#2962FF';
                        const hw = 4; // handle width
                        const handles = [
                            { name: 'p1', x: p1.x, y: p1.y },
                            { name: 'p2', x: p2.x, y: p2.y },
                            { name: 'mix1', x: p2.x, y: p1.y }, // Top-Right (relative)
                            { name: 'mix2', x: p1.x, y: p2.y }  // Bottom-Left (relative)
                        ];

                        handles.forEach(h => {
                            ctx.beginPath();
                            // Hover Highlight for Handle
                            const isHandleHovered = (this.hoveredState.index === i && this.hoveredState.handle === h.name);
                            if (isHandleHovered) {
                                ctx.fillStyle = '#FF6D00'; // Orange fill on hover
                                ctx.fillRect(h.x - hw - 1, h.y - hw - 1, (hw * 2) + 2, (hw * 2) + 2);
                            } else {
                                ctx.fillStyle = '#FFFFFF';
                                ctx.fillRect(h.x - hw, h.y - hw, hw * 2, hw * 2);
                            }
                            ctx.strokeRect(h.x - hw, h.y - hw, hw * 2, hw * 2);
                        });
                    }

                    // Hover Highlight for Edge (if not handling)
                    if (this.hoveredState.index === i && !this.hoveredState.handle) {
                        ctx.strokeStyle = '#2962FF';
                        ctx.lineWidth = 4; // Thicker border
                        ctx.strokeRect(x, y, w, h);
                        ctx.lineWidth = 2; // Reset
                    }
                }
            } else if (d.type === 'ray') {
                const start = this.mapPointToPixel(d.start);
                const dir = this.mapPointToPixel(d.direction);
                if (start && dir) {
                    ctx.beginPath();
                    ctx.moveTo(start.x, start.y);

                    // Ray extension logic
                    const dx = dir.x - start.x;
                    const dy = dir.y - start.y;
                    const len = Math.sqrt(dx * dx + dy * dy);

                    if (len > 0) {
                        // Extrapolate to canvas bounds (simplified large distance)
                        const scale = 10000;
                        ctx.lineTo(start.x + dx / len * scale, start.y + dy / len * scale);
                    } else {
                        ctx.lineTo(dir.x, dir.y);
                    }
                    ctx.stroke();
                } else if (d.start && !d.direction) {
                    // Initial click preview (dot)
                    const start = this.mapPointToPixel(d.start);
                    if (start) {
                        ctx.beginPath();
                        ctx.arc(start.x, start.y, 4, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            } else if (d.type === 'horizontal') {
                const y = this.cm.candleSeries.priceToCoordinate(d.price);
                if (y !== null) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(canvas.width, y);
                    ctx.stroke();
                }
            } else if (d.type === 'vertical') {
                const x = this.cm.chart.timeScale().timeToCoordinate(d.time);
                if (x !== null) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, canvas.height);
                    ctx.stroke();
                }
            }
            // Add other shapes
        });
    }
}
