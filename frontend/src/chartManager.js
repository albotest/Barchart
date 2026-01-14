import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';
import { DrawingManager } from './drawing/DrawingManager.js';

export class ChartManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.chart = null;
        this.candleSeries = null;
        this.volumeSeries = null;
        this.indicatorSeries = [];
        this.avgVolumeSeries = null;
        this.bbSeries = { upper: null, lower: null, middle: null };

        // Data
        this.data = [];
        this.chartType = 'Candlestick';

        // Managers
        this.drawingManager = new DrawingManager(this);

        // Canvas
        this.canvas = null;
        this.ctx = null;

        // Interaction
        this.resizeTimeout = null;
        this.rafaId = null;
        this.crosshairRafId = null;
        this.crosshairCallback = null;

        this.init();
    }

    init() {
        this.container.style.position = 'relative';

        this.chart = createChart(this.container, {
            layout: {
                background: { type: ColorType.Solid, color: 'white' },
                textColor: '#000000',
                fontSize: 11,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
            },
            grid: {
                vertLines: { color: '#efefef', style: LineStyle.Solid },
                horzLines: { color: '#efefef', style: LineStyle.Solid },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    labelBackgroundColor: '#1e222d',
                    color: '#758696',
                    width: 1,
                    style: LineStyle.Dashed,
                },
                horzLine: {
                    labelBackgroundColor: '#1e222d',
                    color: '#758696',
                    width: 1,
                    style: LineStyle.Dashed,
                },
            },
            rightPriceScale: {
                borderColor: '#d1d4dc',
                visible: true,
                autoScale: true,
                scaleMargins: { top: 0.1, bottom: 0.1 },
                alignLabels: true,
                borderVisible: true,
            },
            timeScale: {
                borderColor: '#d1d4dc',
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 5,
                barSpacing: 6,
                minBarSpacing: 0.5,
                fixLeftEdge: true,
                fixRightEdge: true,
                lockVisibleTimeRangeOnResize: true,
                rightBarStaysOnScroll: true,
                shiftVisibleRangeOnNewBar: true,
                borderVisible: true,
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: false,
            },
            handleScale: {
                axisPressedMouseMove: { time: true, price: false },
                axisDoubleClickReset: { time: true, price: true },
                mouseWheel: true,
                pinch: true,
            },
        });

        // Volume Series
        this.volumeSeries = this.chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        this.avgVolumeSeries = this.chart.addLineSeries({
            color: '#8e44ad',
            lineWidth: 2,
            priceScaleId: 'volume',
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
        });

        this.chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
            visible: true,
            autoScale: true,
            alignLabels: false,
            borderVisible: false,
        });

        this.createMainSeries(this.chartType);
        this.setupCanvas();

        // Listeners
        window.addEventListener('resize', this.handleResize.bind(this));

        // Interaction (Delegated)
        // Use Capture phase for mousedown to intercept events before Chart sees them (if hitting a drawing)
        this.container.addEventListener('mousedown', (e) => this.drawingManager.onMouseDown(e), true);

        this.container.addEventListener('mousemove', (e) => {
            this.drawingManager.onMouseMove(e);
            this.drawingManager.onHoverMove(e);
        });
        window.addEventListener('mouseup', (e) => this.drawingManager.onMouseUp(e));

        this.chart.subscribeCrosshairMove(this.handleCrosshairMove.bind(this));

        this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => this.requestDraw());

        // Wheel Zoom
        this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    }

    createMainSeries(type) {
        if (this.candleSeries) this.chart.removeSeries(this.candleSeries);

        const options = {
            upColor: '#ffffff',
            downColor: '#000000',
            borderVisible: true,
            wickVisible: true,
            borderColor: '#000000',
            borderUpColor: '#000000',
            borderDownColor: '#000000',
            wickColor: '#000000',
            wickUpColor: '#000000',
            wickDownColor: '#000000',
        };

        if (type === 'Candlestick') {
            this.candleSeries = this.chart.addCandlestickSeries(options);
        } else if (type === 'Bar') {
            this.candleSeries = this.chart.addBarSeries({
                upColor: '#000000',
                downColor: '#000000',
                thinBars: false,
            });
        } else if (type === 'Line') {
            this.candleSeries = this.chart.addLineSeries({
                color: '#2962FF',
                lineWidth: 2,
                crosshairMarkerVisible: true,
            });
        } else if (type === 'Area') {
            this.candleSeries = this.chart.addAreaSeries({
                topColor: 'rgba(41, 98, 255, 0.4)',
                bottomColor: 'rgba(41, 98, 255, 0.0)',
                lineColor: '#2962FF',
                lineWidth: 2
            });
        }
        else {
            this.candleSeries = this.chart.addCandlestickSeries(options);
        }
        this.chartType = type;
        if (this.data.length > 0) this.candleSeries.setData(this.data);
    }

    setupCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.zIndex = '50';
        this.canvas.style.pointerEvents = 'none';
        this.container.style.position = 'relative';
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // Minimal Overlay Canvas
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.style.position = 'absolute';
        this.overlayCanvas.style.top = '0';
        this.overlayCanvas.style.left = '0';
        this.overlayCanvas.style.zIndex = '60'; // Higher than DM canvas
        this.overlayCanvas.style.pointerEvents = 'none'; // START DISABLED for freeze
        this.container.appendChild(this.overlayCanvas);
        this.overlayCtx = this.overlayCanvas.getContext('2d');

        // Forward Interaction to Chart/DM manually if needed, 
        // but typically overlay is for temporary visuals.
        // The MAIN canvas (this.canvas) is what DrawingManager uses.
        // Let's ensure MAIN canvas is also correct.

        // Wait, DrawingManager uses this.canvas.
        // this.canvas needs pointer-events: none by default too.

        this.canvas.style.pointerEvents = 'none';

        // No debug listener needed. Interaction is handled by delegates on container/window
        // or by toggling pointerEvents in setDrawingMode.

        this.resizeCanvas();
    }

    resizeCanvas() {
        if (this.canvas && this.container) {
            this.canvas.width = this.container.clientWidth;
            this.canvas.height = this.container.clientHeight;
        }
        if (this.overlayCanvas && this.container) {
            this.overlayCanvas.width = this.container.clientWidth;
            this.overlayCanvas.height = this.container.clientHeight;
        }
        this.requestDraw();
    }

    requestDraw() {
        if (this.rafaId) cancelAnimationFrame(this.rafaId);
        this.rafaId = requestAnimationFrame(() => this.drawingManager.drawDrawings());
    }

    handleResize() {
        if (this.container) this.chart.resize(this.container.clientWidth, this.container.clientHeight);
        this.resizeCanvas();
    }

    handleCrosshairMove(param) {
        if (param.seriesData && param.seriesData.get(this.candleSeries)) {
            this.currentCandle = param.seriesData.get(this.candleSeries);
        } else {
            this.currentCandle = null;
        }
        if (this.crosshairCallback) {
            // Implement crosshair emission or remove strict dependency for now
        }
    }

    handleWheel(event) {
        if (!this.candleSeries || !this.data || this.data.length === 0) return;
        event.preventDefault();
        event.stopPropagation();

        const delta = -event.deltaY;
        const zoomSpeed = 0.1;
        const zoomFactor = delta > 0 ? (1 + zoomSpeed) : (1 - zoomSpeed);

        const timeScale = this.chart.timeScale();
        const visibleRange = timeScale.getVisibleRange();
        if (!visibleRange) return;

        const currentBarSpacing = timeScale.options().barSpacing;
        const containerWidth = this.container.clientWidth;
        const minSpacing = containerWidth / (this.data.length + 5);

        let newBarSpacing = currentBarSpacing * zoomFactor;
        if (newBarSpacing < minSpacing) newBarSpacing = minSpacing;
        if (newBarSpacing > 100) newBarSpacing = 100;

        const rect = this.container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const cursorTime = timeScale.coordinateToTime(x);

        if (cursorTime) {
            timeScale.applyOptions({ barSpacing: newBarSpacing });
            const effectiveFactor = newBarSpacing / currentBarSpacing;
            const currentWidth = visibleRange.to - visibleRange.from;
            const newWidth = currentWidth / effectiveFactor;

            const cursorRatio = (cursorTime - visibleRange.from) / currentWidth;
            const newFrom = cursorTime - newWidth * cursorRatio;
            const newTo = cursorTime + newWidth * (1 - cursorRatio);

            timeScale.setVisibleRange({ from: newFrom, to: newTo });
        } else {
            timeScale.applyOptions({ barSpacing: newBarSpacing });
        }
        this.requestDraw();
    }

    setData(data, interval) {
        if (!data || data.length === 0) return;

        // Normalize date format - convert string dates to BusinessDay objects or timestamps
        const normalizedData = data.map(candle => {
            let normalizedTime = candle.time;

            // If time is a string (e.g., "2025-09-10"), convert it
            if (typeof candle.time === 'string') {
                // Check if it's a date string (YYYY-MM-DD format)
                if (/^\d{4}-\d{2}-\d{2}$/.test(candle.time)) {
                    // Convert to BusinessDay object for daily data
                    const parts = candle.time.split('-');
                    normalizedTime = {
                        year: parseInt(parts[0]),
                        month: parseInt(parts[1]),
                        day: parseInt(parts[2])
                    };
                } else {
                    // Try to parse as timestamp
                    const timestamp = Date.parse(candle.time);
                    if (!isNaN(timestamp)) {
                        normalizedTime = Math.floor(timestamp / 1000); // Convert to seconds
                    }
                }
            }

            return {
                ...candle,
                time: normalizedTime
            };
        });

        // Simple gap filler if needed (omitted for brevity in split, can re-add)
        this.data = normalizedData;
        if (this.candleSeries) this.candleSeries.setData(normalizedData);
        if (this.volumeSeries) {
            this.volumeSeries.setData(normalizedData.map(d => ({
                time: d.time,
                value: d.volume,
                color: (d.close >= d.open) ? '#26a69a' : '#ef5350'
            })));
        }
    }

    updateLastCandle(candle) {
        if (!this.candleSeries) return;
        this.candleSeries.update(candle);

        if (this.volumeSeries) {
            this.volumeSeries.update({
                time: candle.time,
                value: candle.volume,
                color: (candle.close >= candle.open) ? '#26a69a' : '#ef5350'
            });
        }

        // Update local data
        if (this.data.length > 0) {
            const last = this.data[this.data.length - 1];
            if (last.time === candle.time) {
                this.data[this.data.length - 1] = candle;
            } else if (candle.time > last.time) {
                this.data.push(candle);
            }
        }
    }

    // Proxies
    setDrawingMode(mode) { this.drawingManager.setDrawingMode(mode); }
    toggleMagnet(active) { this.drawingManager.toggleMagnet(active); }
    toggleLock(active) { this.drawingManager.toggleLock(active); }
    undo() { this.drawingManager.undo(); }
    redo() { this.drawingManager.redo(); }
    clearDrawings() { this.drawingManager.drawings = []; this.drawingManager.saveDrawings(); this.requestDraw(); }

    handleCrosshairMove(param) {
        if (!this.crosshairCallback) return;

        // Build callback parameter with chart data
        const callbackParam = {
            type: param.point ? 'move' : 'leave',
            time: param.time,
            point: param.point,
            data: null,
            indicators: []
        };

        // Get candle data if hovering over a point
        if (param.time && this.candleSeries) {
            const data = param.seriesData.get(this.candleSeries);
            if (data) {
                callbackParam.data = data;
            }
        }

        // Get indicator data
        this.indicatorSeries.forEach(series => {
            const indData = param.seriesData.get(series.series);
            if (indData) {
                callbackParam.indicators.push({
                    label: series.name,
                    values: indData
                });
            }
        });

        this.crosshairCallback(callbackParam);
    }

    setCrosshairCallback(cb) { this.crosshairCallback = cb; }

    destroy() {
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
        }
        // cleanup listeners
    }
}
