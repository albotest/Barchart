import { api } from './api.js';
import { ChartManager } from './chartManager.js';
import { AVAILABLE_INDICATORS, INTERVAL_LABELS, PERIOD_LABELS, INTRADAY_INTERVALS, LONG_PERIODS } from './constants.js';
import './style.css';

const state = {
    symbol: 'NQH26', // Default
    interval: '1d',
    period: '6mo',
    activeIndicators: [],
    chartData: [],
    isLoading: false,
};

async function initChartPage() {
    console.log("Initializing Chart Page...");

    // Parse URL Params for Symbol
    const urlParams = new URLSearchParams(window.location.search);
    const symbolParam = urlParams.get('symbol');
    const nameParam = urlParams.get('name'); // Get Name

    if (symbolParam) {
        state.symbol = symbolParam;
    }

    // Update Page Context (Title & Header)
    if (nameParam) {
        document.title = `${decodeURIComponent(nameParam)} Chart | Barchart`;
        const nameDisplay = document.getElementById('market-name-display');
        if (nameDisplay) nameDisplay.innerText = decodeURIComponent(nameParam);

        // Populate Quote Header Name immediately
        const quoteName = document.getElementById('quote-name');
        if (quoteName) quoteName.innerText = decodeURIComponent(nameParam);
    } else if (symbolParam) {
        // Fallback to symbol if no name
        document.title = `${symbolParam} Chart | Barchart`;
        const nameDisplay = document.getElementById('market-name-display');
        if (nameDisplay) nameDisplay.innerText = symbolParam;

        const quoteName = document.getElementById('quote-name');
        if (quoteName) quoteName.innerText = symbolParam;
    }

    // Initialize Chart
    window.chartManager = new ChartManager('chart-container');

    // Setup UI Listeners
    setupUI();
    setupIndicatorUI();

    // Load Data
    await loadData();

    // Setup Crosshair Sync (Live Readouts)
    setupCrosshairSync();

    await loadIndicators();

    // Real-time Updates (Polling)
    setInterval(async () => {
        if (INTRADAY_INTERVALS.includes(state.interval) && !state.isLoading) {
            try {
                // Fetch latest data (small period for speed)
                const dataObj = await api.getOHLC(state.symbol, state.interval, '5d');
                if (dataObj && dataObj.data && dataObj.data.length > 0) {
                    const lastCandle = dataObj.data[dataObj.data.length - 1];
                    window.chartManager.updateLastCandle(lastCandle);
                    renderLatestHeader(); // Update header quotes
                }
            } catch (e) {
                console.warn("Real-time update failed", e);
            }
        }
    }, 5000); // 5 seconds
}

async function loadData() {
    if (state.isLoading) return;
    state.isLoading = true;

    document.body.style.cursor = 'wait';

    try {
        let dataObj = await api.getOHLC(state.symbol, state.interval, state.period);

        if (!dataObj) {
            if (state.chartData.length === 0) {
                console.warn("API unreachable. Using Mock Data for demonstration.");
                dataObj = api.getMockOHLC(state.symbol, state.interval, state.period);
            } else {
                console.error("API unreachable. Keeping previous chart data.");
                return;
            }
        }

        if (dataObj && dataObj.data) {
            state.chartData = dataObj.data;
            window.chartManager.setData(dataObj.data, state.interval);

            const headerSymbol = document.getElementById('market-name-display');
            if (headerSymbol) headerSymbol.innerText = dataObj.symbol;

            const searchInput = document.getElementById('symbol-search');
            if (searchInput) searchInput.value = dataObj.symbol;

            // Render Detailed Quote Header
            renderLatestHeader();
        }
    } catch (e) {
        console.error("Critical error in loadData:", e);
    } finally {
        state.isLoading = false;
        document.body.style.cursor = 'default';
    }
}

async function loadIndicators() {
    if (state.activeIndicators.length === 0) {
        window.chartManager.setIndicators(null);
        return;
    }

    const indicatorsList = state.activeIndicators.map(ind => ({
        name: ind.id,
        ...ind.params
    }));

    const indData = await api.getIndicators(state.symbol, indicatorsList, state.interval, state.period);
    window.chartManager.setIndicators(indData, state.activeIndicators);
}

function setupUI() {
    // Back Button -> Redirect to Index
    const backBtn = document.getElementById('back-to-home-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    const searchInput = document.getElementById('symbol-search');
    if (searchInput) {
        searchInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const newSymbol = e.target.value.trim().toUpperCase();
                if (!newSymbol || newSymbol === state.symbol) return;

                e.target.disabled = true;
                const originalPlaceholder = e.target.placeholder;
                e.target.value = '';
                e.target.placeholder = 'Loading...';

                try {
                    const dataObj = await api.getOHLC(newSymbol, state.interval, state.period);

                    if (dataObj && dataObj.data && dataObj.data.length > 0) {
                        state.symbol = newSymbol;

                        // Reset Chart
                        window.chartManager.setIndicators(null);
                        window.chartManager.createMainSeries(window.chartManager.chartType || 'Candlestick');
                        window.chartManager.setData(dataObj.data, state.interval);

                        const headerSymbol = document.getElementById('market-name-display');
                        if (headerSymbol) headerSymbol.innerText = dataObj.symbol;
                        renderLatestHeader();

                        await loadIndicators();
                    } else {
                        throw new Error('Invalid symbol or no data returned');
                    }
                } catch (err) {
                    console.error("Symbol Search Failed:", err);
                    alert(`Failed to load symbol: ${newSymbol}`);
                } finally {
                    e.target.disabled = false;
                    e.target.placeholder = originalPlaceholder;
                    e.target.value = state.symbol;
                    e.target.focus();
                }
            }
        });
    }

    window.setParams = async (params) => {
        if (state.isLoading) return;

        if (params.interval) {
            state.interval = params.interval;
            if (INTRADAY_INTERVALS.includes(state.interval) && LONG_PERIODS.includes(state.period)) {
                state.period = '1mo';
                document.getElementById('period-display').innerText = '1-Month';
            }
            document.getElementById('timeframe-display').innerText = INTERVAL_LABELS[state.interval] || state.interval;
        }

        if (params.period) {
            state.period = params.period;
            document.getElementById('period-display').innerText = PERIOD_LABELS[state.period] || state.period;
        }

        await loadData();
    };

    window.setChartType = (type) => {
        window.chartManager.createMainSeries(type);
        document.getElementById('chart-type-display').innerText = type.charAt(0);
    };

    const indBtn = document.getElementById('indicators-btn');
    if (indBtn) {
        indBtn.addEventListener('click', () => {
            document.getElementById('indicator-modal').classList.remove('hidden');
            renderActiveIndicators();
        });
    }

    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('indicator-modal').classList.add('hidden');
        });
    }

    const applyBtn = document.getElementById('apply-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            document.getElementById('indicator-modal').classList.add('hidden');
        });
    }

    // Sidebar interactions are now handled via inline onclick in HTML or specific dropdown logic
    // We can add specific listeners here if needed for active state management
    // But for now, let's just ensure we clean up the old conflicting logic

    // Inject Flyout Toolbar
    injectFlyoutToolbar();
}

function injectSidebarTools() {
    const aside = document.querySelector('aside');
    if (!aside) return;

    // Create Group Container
    const groupDiv = document.createElement('div');
    groupDiv.className = "relative group w-full flex justify-center";
    groupDiv.innerHTML = `
        <button class="text-gray-500 hover:text-blue-500 p-2 rounded hover:bg-gray-50 transition" title="Arrows & Icons">
            <i class="fa-solid fa-arrow-up-long"></i>
        </button>
        <!-- Popover -->
        <div class="absolute left-full top-0 ml-1 bg-white border border-gray-200 shadow-lg rounded hidden group-hover:block z-50 w-48 p-1">
            <div class="text-xs font-semibold text-gray-400 mb-1 px-2">ARROWS</div>
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('ArrowUp')">
                <i class="fa-solid fa-arrow-up w-4"></i> Arrow Up
            </button>
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('ArrowDown')">
                <i class="fa-solid fa-arrow-down w-4"></i> Arrow Down
            </button>
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('ArrowLeft')">
                <i class="fa-solid fa-arrow-left w-4"></i> Arrow Left
            </button>
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('ArrowRight')">
                <i class="fa-solid fa-arrow-right w-4"></i> Arrow Right
            </button>
             <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('ArrowHorizontal')">
                <i class="fa-solid fa-arrows-left-right w-4"></i> Horizontal
            </button>
             <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('ArrowVertical')">
                <i class="fa-solid fa-arrows-up-down w-4"></i> Vertical
            </button>

            <div class="border-t my-1"></div>
            <div class="text-xs font-semibold text-gray-400 mb-1 px-2">ICONS</div>
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('IconFishHook')">
                <i class="fa-solid fa-dharmachakra w-4"></i> Fish Hook
            </button>
             <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('IconThumbsUp')">
                <i class="fa-solid fa-thumbs-up w-4"></i> Thumbs Up
            </button>
             <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('IconThumbsDown')">
                <i class="fa-solid fa-thumbs-down w-4"></i> Thumbs Down
            </button>
        </div>
    `;

    // Append a separator and the new group before the last filler or just at the end of tool list
    const separator = document.createElement('div');
    separator.className = "w-8 border-t";

    // Insert before the last item or just append to the list of tools
    // The aside has tools then a spacer then utilities?
    // Let's just append to aside, likely fine.
    // Ideally we want it near the other shapes.
    // There are spacers <div class="w-8 border-t"></div> in HTML.

    aside.appendChild(separator);
    aside.appendChild(groupDiv);

    // 2. Measurement & Position Group
    const measureGroup = document.createElement('div');
    measureGroup.className = "relative group w-full flex justify-center";
    measureGroup.innerHTML = `
        <button class="text-gray-500 hover:text-blue-500 p-2 rounded hover:bg-gray-50 transition" title="Measure & Position">
            <i class="fa-solid fa-ruler-combined"></i>
        </button>
        <!-- Popover -->
        <div class="absolute left-full top-0 ml-1 bg-white border border-gray-200 shadow-lg rounded hidden group-hover:block z-50 w-48 p-1">
            <div class="text-xs font-semibold text-gray-400 mb-1 px-2">MEASURE</div>
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('DateRange')">
                <i class="fa-solid fa-calendar-range w-4"></i> Date Range
            </button>
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('PriceRange')">
                <i class="fa-solid fa-arrows-up-down-left-right w-4"></i> Price Range
            </button>
             <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('DatePriceRange')">
                <i class="fa-regular fa-square w-4"></i> Date & Price Range
            </button>

            <div class="border-t my-1"></div>
            <div class="text-xs font-semibold text-gray-400 mb-1 px-2">POSITION</div>
             <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('LongPosition')">
                <i class="fa-solid fa-arrow-trend-up w-4 text-green-500"></i> Long Position
            </button>
             <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('ShortPosition')">
                <i class="fa-solid fa-arrow-trend-down w-4 text-red-500"></i> Short Position
            </button>
             <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('FiftyPercent')">
                <i class="fa-solid fa-percent w-4"></i> 50% Line
            </button>
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('ProfitLoss')">
                <i class="fa-solid fa-money-bill-wave w-4"></i> Profit / Loss
            </button>
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('RewardRisk')">
                <i class="fa-solid fa-scale-balanced w-4"></i> Reward / Risk
            </button>
        </div>
    `;

    const sep2 = document.createElement('div');
    sep2.className = "w-8 border-t";

    aside.appendChild(sep2);
    aside.appendChild(measureGroup);

    // 3. Fibonacci Group
    const fibGroup = document.createElement('div');
    fibGroup.className = "relative group w-full flex justify-center";
    fibGroup.innerHTML = `
        <button class="text-gray-500 hover:text-blue-500 p-2 rounded hover:bg-gray-50 transition" title="Fibonacci Tools">
            <i class="fa-solid fa-bars-staggered"></i>
        </button>
        <!-- Popover -->
        <div class="absolute left-full top-0 ml-1 bg-white border border-gray-200 shadow-lg rounded hidden group-hover:block z-50 w-48 p-1">
            <div class="text-xs font-semibold text-gray-400 mb-1 px-2">FIBONACCI</div>
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('FibRetracement')">
                <i class="fa-solid fa-list w-4"></i> Fib Retracement
            </button>
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('FibExtension')">
                <i class="fa-solid fa-chart-line w-4"></i> Fib Extension
            </button>
             <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('FibFan')">
                <i class="fa-solid fa-fan w-4"></i> Fib Fan
            </button>
             <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.setDrawingMode('FibChannel')">
                <i class="fa-solid fa-grip-lines w-4"></i> Fib Channel
            </button>
        </div>
    `;

    const sep3 = document.createElement('div');
    sep3.className = "w-8 border-t";

    aside.appendChild(sep3);
    aside.appendChild(fibGroup);

    // 4. System Tools Group
    const sysGroup = document.createElement('div');
    sysGroup.className = "relative group w-full flex justify-center";
    sysGroup.innerHTML = `
        <button class="text-gray-500 hover:text-blue-500 p-2 rounded hover:bg-gray-50 transition" title="System Tools">
            <i class="fa-solid fa-gear"></i>
        </button>
        <!-- Popover -->
        <div class="absolute left-full top-0 ml-1 bg-white border border-gray-200 shadow-lg rounded hidden group-hover:block z-50 w-48 p-1">
            <div class="text-xs font-semibold text-gray-400 mb-1 px-2">SYSTEM</div>
            
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" 
                onclick="this.classList.toggle('text-blue-600'); window.chartManager.toggleMagnet(this.classList.contains('text-blue-600'))">
                <i class="fa-solid fa-magnet w-4"></i> Magnet Mode
            </button>
             <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" 
                onclick="this.classList.toggle('text-red-500'); window.chartManager.toggleLock(this.classList.contains('text-red-500'))">
                <i class="fa-solid fa-lock w-4"></i> Lock Drawings
            </button>
            <div class="border-t my-1"></div>
            
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.undo()">
                <i class="fa-solid fa-rotate-left w-4"></i> Undo
            </button>
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.redo()">
                <i class="fa-solid fa-rotate-right w-4"></i> Redo
            </button>
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.clearDrawings()">
                <i class="fa-solid fa-trash w-4 text-red-500"></i> Clear All
            </button>
            
            <div class="border-t my-1"></div>
            
            <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.zoomIn()">
                <i class="fa-solid fa-magnifying-glass-plus w-4"></i> Zoom In
            </button>
             <button class="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2" onclick="window.chartManager.zoomOut()">
                <i class="fa-solid fa-magnifying-glass-minus w-4"></i> Zoom Out
            </button>
        </div>
    `;

    const sep4 = document.createElement('div');
    sep4.className = "w-8 border-t";

    aside.appendChild(sep4);
    aside.appendChild(sysGroup);

    // 5. Collapse Button
    const collapseDiv = document.createElement('div');
    collapseDiv.className = "mt-auto w-full flex justify-center pb-2";
    collapseDiv.innerHTML = `
        <button class="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition" title="Collapse Toolbar">
             <i class="fa-solid fa-chevron-left"></i>
        </button>
    `;
    aside.appendChild(collapseDiv);

    // Create Floating Expand Button (initially hidden)
    const expandBtn = document.createElement('button');
    expandBtn.className = "fixed left-0 top-1/2 transform -translate-y-1/2 bg-white shadow-md border border-gray-200 p-1 rounded-r cursor-pointer z-50 text-gray-500 hover:text-blue-500 hidden";
    expandBtn.title = "Show Toolbar";
    expandBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    document.body.appendChild(expandBtn);

    // Logic
    const toggleBtn = collapseDiv.querySelector('button');

    toggleBtn.onclick = () => {
        aside.style.display = 'none';
        expandBtn.classList.remove('hidden');
        // Trigger resize so chart fills space
        window.dispatchEvent(new Event('resize'));
    };

    expandBtn.onclick = () => {
        aside.style.display = 'flex'; // Assuming flex sidebar
        expandBtn.classList.add('hidden');
        window.dispatchEvent(new Event('resize'));
    };
}

// Reuse Indicator UI Logic
function setupIndicatorUI() {
    const overlayList = document.getElementById('overlay-studies-list');
    const standaloneList = document.getElementById('standalone-studies-list');
    const searchInput = document.getElementById('indicator-search');
    const tabs = document.querySelectorAll('[data-tab]');

    function renderList(target, items) {
        target.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = "flex justify-between items-center p-2 hover:bg-gray-100 cursor-pointer rounded text-sm";
            li.innerHTML = `<span>${item.name}</span> <i class="fa-solid fa-plus text-gray-400 hover:text-blue-600"></i>`;
            li.addEventListener('click', () => addIndicator(item));
            target.appendChild(li);
        });
    }

    renderList(overlayList, AVAILABLE_INDICATORS.overlay);
    renderList(standaloneList, AVAILABLE_INDICATORS.standalone);

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('text-blue-600', 'border-blue-600');
                t.classList.add('text-gray-600', 'border-transparent');
            });
            tab.classList.add('text-blue-600', 'border-blue-600');
            tab.classList.remove('text-gray-600', 'border-transparent');

            const type = tab.getAttribute('data-tab');
            if (type === 'overlay') {
                overlayList.classList.remove('hidden');
                standaloneList.classList.add('hidden');
            } else {
                overlayList.classList.add('hidden');
                standaloneList.classList.remove('hidden');
            }
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filterItems = (items) => items.filter(i => i.name.toLowerCase().includes(query));
            renderList(overlayList, filterItems(AVAILABLE_INDICATORS.overlay));
            renderList(standaloneList, filterItems(AVAILABLE_INDICATORS.standalone));
        });
    }
}

// Config Modal State
let currentConfigItem = null;

async function addIndicator(item) {
    currentConfigItem = item;
    openConfigModal(item);
}

function openConfigModal(item) {
    const modal = document.getElementById('indicator-config-modal');
    const title = document.getElementById('config-modal-title');
    const container = document.getElementById('config-inputs-container');

    title.innerText = item.name;
    container.innerHTML = '';
    modal.classList.remove('hidden');

    Object.keys(item.params).forEach(key => {
        const val = item.params[key];
        const wrapper = document.createElement('div');
        wrapper.className = "flex flex-col space-y-1";

        const label = document.createElement('label');
        label.className = "text-sm text-gray-600 capitalize";
        label.innerText = key;
        wrapper.appendChild(label);

        const input = document.createElement('input');
        input.className = "border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none";
        input.type = typeof val === 'number' ? 'number' : 'text';
        input.value = val;
        input.id = `param-${key}`;
        wrapper.appendChild(input);

        container.appendChild(wrapper);
    });

    const applyBtn = document.getElementById('apply-config-btn');
    if (applyBtn) applyBtn.onclick = () => applyConfig(item);

    const cancelBtn = document.getElementById('cancel-config-btn');
    if (cancelBtn) cancelBtn.onclick = () => closeConfigModal();

    const closeBtn = document.getElementById('close-config-modal-btn');
    if (closeBtn) closeBtn.onclick = () => closeConfigModal();
}

function closeConfigModal() {
    document.getElementById('indicator-config-modal').classList.add('hidden');
    currentConfigItem = null;
}

async function applyConfig(item) {
    const container = document.getElementById('config-inputs-container');
    const inputs = container.querySelectorAll('input');

    const newParams = { ...item.params };
    inputs.forEach(input => {
        const key = input.id.replace('param-', '');
        newParams[key] = input.type === 'number' ? parseFloat(input.value) : input.value;
    });

    state.activeIndicators.push({
        id: item.id,
        name: item.name,
        params: newParams
    });

    closeConfigModal();
    renderActiveIndicators();
    await loadIndicators();
}

function renderActiveIndicators() {
    const container = document.getElementById('active-indicators-list');
    container.innerHTML = '';

    state.activeIndicators.forEach((ind, index) => {
        const chip = document.createElement('div');
        chip.className = "bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs flex items-center shadow-sm border border-orange-200 cursor-pointer hover:bg-orange-200";
        const shortName = ind.name.split('(')[0].trim().substring(0, 15);

        const colorDot = document.createElement('div');
        colorDot.className = "w-2 h-2 rounded-full bg-orange-500 mr-2";
        chip.appendChild(colorDot);

        const text = document.createElement('span');
        text.className = "mr-2";
        text.innerText = shortName;
        chip.appendChild(text);

        const removeBtn = document.createElement('button');
        removeBtn.className = "hover:text-red-600";
        removeBtn.innerHTML = `<i class="fa-solid fa-times"></i>`;
        removeBtn.onclick = async (e) => {
            e.stopPropagation();
            state.activeIndicators.splice(index, 1);
            renderActiveIndicators();
            await loadIndicators();
        };
        chip.appendChild(removeBtn);
        container.appendChild(chip);
    });
}

function setupCrosshairSync() {
    window.chartManager.setCrosshairCallback((param) => {
        // 1. Update Indicators
        renderIndicatorReadouts(param.indicators);

        // 2. Update Quote Header based on cursor position
        if (param.type === 'leave') {
            // Cursor left chart - restore latest price
            renderLatestHeader();
        } else if (param.type === 'move') {
            // Cursor moving over chart
            if (param.data) {
                // Show hovered candle price
                // Calculate change relative to previous candle
                const hoveredCandle = param.data;

                // Find index using a comparison function that handles both object and number times
                const hoveredIndex = state.chartData.findIndex(c => {
                    // Handle BusinessDay objects (daily data)
                    if (typeof c.time === 'object' && typeof hoveredCandle.time === 'object') {
                        return c.time.year === hoveredCandle.time.year &&
                            c.time.month === hoveredCandle.time.month &&
                            c.time.day === hoveredCandle.time.day;
                    }
                    // Handle timestamps (intraday data)
                    return c.time === hoveredCandle.time;
                });

                let referencePrice = hoveredCandle.open; // Default to open
                if (hoveredIndex > 0) {
                    // Use previous candle's close as reference
                    referencePrice = state.chartData[hoveredIndex - 1].close;
                }

                updateHeaderDisplay(hoveredCandle, referencePrice);
            } else {
                // No data under cursor - restore latest
                renderLatestHeader();
            }
        }
    });
}

function renderLatestHeader() {
    if (!state.chartData || state.chartData.length === 0) return;
    const latest = state.chartData[state.chartData.length - 1];
    const prev = state.chartData[state.chartData.length - 2] || latest;
    // Live Rule: Change vs Previous Close
    updateHeaderDisplay(latest, prev.close);

    // Mock Bid/Ask Updates (keep existing logic)
    const price = latest.close;
    const spread = 0.05 + Math.random() * 0.1;
    const bid = (price - spread / 2).toFixed(1);
    const ask = (price + spread / 2).toFixed(1);
    const bidEl = document.getElementById('quote-bid');
    const askEl = document.getElementById('quote-ask');
    if (bidEl) bidEl.innerText = `${bid} x ${Math.floor(Math.random() * 5) + 1}`;
    if (askEl) askEl.innerText = `${ask} x ${Math.floor(Math.random() * 5) + 1}`;
}

function updateHeaderDisplay(candle, referencePrice) {
    if (!candle) return;

    const price = candle.close;
    const change = price - referencePrice;
    const percent = referencePrice !== 0 ? (change / referencePrice) * 100 : 0;

    // Elements
    const priceEl = document.getElementById('quote-price');
    const changeEl = document.getElementById('quote-change');
    const percentEl = document.getElementById('quote-percent');
    const changeContainer = document.getElementById('quote-change-container');
    const timeEl = document.getElementById('quote-time');
    const dateEl = document.getElementById('quote-date');

    // Format Values
    // Use fallback if price is NaN (though candle.close should be number)
    if (priceEl) priceEl.innerText = (typeof price === 'number' && !isNaN(price)) ? price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") : '--';

    const safeChange = isNaN(change) ? 0 : change;
    const safePercent = isNaN(percent) ? 0 : percent;

    const sign = safeChange >= 0 ? '+' : '';
    const colorClass = safeChange >= 0 ? 'text-green-700' : 'text-red-700';
    const bgClass = safeChange >= 0 ? 'bg-green-100' : 'bg-red-100';

    if (changeEl) {
        changeEl.innerText = `${sign}${safeChange.toFixed(2)}`;
        changeEl.className = colorClass;
    }

    if (percentEl) {
        percentEl.innerText = `(${sign}${safePercent.toFixed(2)}%)`;
        percentEl.className = `ml-1 ${colorClass}`;
    }

    if (changeContainer) {
        changeContainer.className = `flex items-center px-2 py-0.5 rounded text-lg font-bold ${bgClass}`;
    }

    // Time & Date Parsing
    if (timeEl || dateEl) {
        let dateObj;

        // Handle Lightweight Charts Date Formats
        if (typeof candle.time === 'object') {
            // Business Day object: { year, month, day }
            // Note: month is 1-based in some LW versions, but usually 1-12. JS Date is 0-11.
            dateObj = new Date(candle.time.year, candle.time.month - 1, candle.time.day);
        } else if (typeof candle.time === 'number') {
            // Timestamp (seconds)
            dateObj = new Date(candle.time * 1000);
        } else if (typeof candle.time === 'string') {
            dateObj = new Date(candle.time);
        }

        if (dateObj && !isNaN(dateObj.getTime())) {
            if (timeEl) {
                // Only show time if strictly intraday (timestamp) or explicit request
                // If it's a daily candle (object), time is 00:00 implying date only.
                const isIntraday = typeof candle.time === 'number';
                if (isIntraday) {
                    const timeStr = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
                    timeEl.innerText = `${timeStr} CT [COMEX]`;
                } else {
                    timeEl.innerText = ''; // Clear time for daily
                }
            }

            if (dateEl) {
                const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
                dateEl.innerText = dateObj.toLocaleDateString('en-US', options);
            }
        } else {
            // Fallback
            if (timeEl) timeEl.innerText = '';
            if (dateEl) dateEl.innerText = '';
        }
    }
}

function renderIndicatorReadouts(indicators) {
    let container = document.getElementById('indicator-readout-container');
    if (!container) {
        // Create container if missing (Inject into Header)
        const header = document.querySelector('#chart-wrapper .border-b'); // The quote header div
        if (header) {
            container = document.createElement('div');
            container.id = 'indicator-readout-container';
            container.className = "flex flex-wrap gap-x-6 gap-y-1 text-xs font-mono text-gray-600 mt-2 pt-2 border-t border-gray-100";
            header.appendChild(container);
        } else {
            return;
        }
    }

    container.innerHTML = '';

    if (!indicators || indicators.length === 0) return;

    indicators.forEach(ind => {
        const item = document.createElement('div');
        item.className = "flex items-center gap-2";

        const label = document.createElement('span');
        label.className = "font-bold text-gray-800";
        label.innerText = ind.label;

        // Format values
        const valStrings = [];
        Object.keys(ind.values).forEach(key => {
            const v = ind.values[key];
            const displayV = (v !== undefined && v !== null) ? v.toFixed(2) : '--';
            if (key.toUpperCase() === ind.label.split(' ')[0].toUpperCase()) {
                valStrings.push(displayV);
            } else {
                valStrings.push(`${key}: ${displayV}`);
            }
        });

        const valuesSpan = document.createElement('span');
        valuesSpan.innerText = valStrings.join('  ');

        item.appendChild(label);
        item.appendChild(valuesSpan);
        container.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', initChartPage);

// --- FLYOUT TOOLBAR IMPLEMENTATION ---

const toolsConfig = [
    {
        id: 'lines',
        icon: 'fa-solid fa-pen-nib',
        name: 'Lines',
        items: [
            { id: 'Trendline', icon: 'fa-solid fa-slash', name: 'Trendline', mode: 'Trendline' },
            { id: 'Ray', icon: 'fa-solid fa-arrow-right', name: 'Ray', mode: 'Ray' },
            { id: 'HorizontalLine', icon: 'fa-solid fa-minus', name: 'Horizontal Line', mode: 'HorizontalLine' },
            { id: 'VerticalLine', icon: 'fa-solid fa-arrows-up-down', name: 'Vertical Line', mode: 'VerticalLine' },
            { id: 'Text', icon: 'fa-solid fa-font', name: 'Text', mode: 'Text' }
        ]
    },
    {
        id: 'shapes',
        icon: 'fa-regular fa-square',
        name: 'Shapes',
        items: [
            { id: 'Rectangle', icon: 'fa-regular fa-square', name: 'Rectangle', mode: 'Rectangle' },
            { id: 'Ellipse', icon: 'fa-regular fa-circle', name: 'Ellipse', mode: 'Ellipse' },
        ]
    },
    {
        id: 'arrows',
        icon: 'fa-solid fa-arrow-up-long',
        name: 'Arrows',
        items: [
            { id: 'ArrowUp', icon: 'fa-solid fa-arrow-up', name: 'Arrow Up', mode: 'ArrowUp' },
            { id: 'ArrowDown', icon: 'fa-solid fa-arrow-down', name: 'Arrow Down', mode: 'ArrowDown' },
            { id: 'ArrowLeft', icon: 'fa-solid fa-arrow-left', name: 'Arrow Left', mode: 'ArrowLeft' },
            { id: 'ArrowRight', icon: 'fa-solid fa-arrow-right', name: 'Arrow Right', mode: 'ArrowRight' },
            { id: 'ArrowHorizontal', icon: 'fa-solid fa-arrows-left-right', name: 'Horizontal', mode: 'ArrowHorizontal' },
            { id: 'ArrowVertical', icon: 'fa-solid fa-arrows-up-down', name: 'Vertical', mode: 'ArrowVertical' },
            { id: 'IconFishHook', icon: 'fa-solid fa-dharmachakra', name: 'Fish Hook', mode: 'IconFishHook' },
            { id: 'IconThumbsUp', icon: 'fa-solid fa-thumbs-up', name: 'Thumbs Up', mode: 'IconThumbsUp' },
            { id: 'IconThumbsDown', icon: 'fa-solid fa-thumbs-down', name: 'Thumbs Down', mode: 'IconThumbsDown' }
        ]
    },
    {
        id: 'measure',
        icon: 'fa-solid fa-ruler-combined',
        name: 'Measure',
        items: [
            { id: 'DateRange', icon: 'fa-solid fa-calendar-range', name: 'Date Range', mode: 'DateRange' },
            { id: 'PriceRange', icon: 'fa-solid fa-arrows-up-down-left-right', name: 'Price Range', mode: 'PriceRange' },
            { id: 'DatePriceRange', icon: 'fa-regular fa-square', name: 'Date & Price Range', mode: 'DatePriceRange' },
            { id: 'LongPosition', icon: 'fa-solid fa-arrow-trend-up', name: 'Long Position', mode: 'LongPosition' },
            { id: 'ShortPosition', icon: 'fa-solid fa-arrow-trend-down', name: 'Short Position', mode: 'ShortPosition' },
            { id: 'FiftyPercent', icon: 'fa-solid fa-percent', name: '50% Line', mode: 'FiftyPercent' },
            { id: 'ProfitLoss', icon: 'fa-solid fa-money-bill-wave', name: 'Profit / Loss', mode: 'ProfitLoss' },
            { id: 'RewardRisk', icon: 'fa-solid fa-scale-balanced', name: 'Reward / Risk', mode: 'RewardRisk' }
        ]
    },
    {
        id: 'fib',
        icon: 'fa-solid fa-bars-staggered',
        name: 'Fibonacci',
        items: [
            { id: 'FibRetracement', icon: 'fa-solid fa-list', name: 'Fib Retracement', mode: 'FibRetracement' },
            { id: 'FibExtension', icon: 'fa-solid fa-chart-line', name: 'Fib Extension', mode: 'FibExtension' },
            { id: 'FibFan', icon: 'fa-solid fa-fan', name: 'Fib Fan', mode: 'FibFan' },
            { id: 'FibChannel', icon: 'fa-solid fa-grip-lines', name: 'Fib Channel', mode: 'FibChannel' }
        ]
    }
];

const activeTools = window.activeTools = window.activeTools || {};
let activeTray = null;

function injectFlyoutToolbar() {
    const aside = document.querySelector('aside');
    if (!aside) return;

    // Clear existing content to avoid duplication
    aside.innerHTML = '';

    // 1. Render Tool Groups
    toolsConfig.forEach(group => {
        if (!activeTools[group.id]) activeTools[group.id] = group.items[0];
        const currentTool = activeTools[group.id];

        const container = document.createElement('div');
        container.className = "relative group w-full flex justify-center mb-1 select-none";

        const btnGroup = document.createElement('div');
        btnGroup.className = "flex bg-transparent rounded border border-transparent hover:border-gray-200";

        // Main Button
        const mainBtn = document.createElement('button');
        mainBtn.className = "text-gray-500 hover:text-blue-500 p-2 rounded-l hover:bg-gray-50 transition flex items-center justify-center w-8";
        mainBtn.title = currentTool.name;
        mainBtn.innerHTML = `<i class="${currentTool.icon}"></i>`;
        mainBtn.onclick = (e) => {
            e.stopPropagation();
            window.chartManager.setDrawingMode(currentTool.mode);
            closeAllTrays();
        };

        // Arrow Button
        const arrowBtn = document.createElement('button');
        arrowBtn.className = "text-gray-400 hover:text-blue-500 p-1 pr-1 rounded-r hover:bg-gray-50 transition text-[9px] w-3 flex items-center justify-center cursor-pointer";
        arrowBtn.innerHTML = '<i class="fa-solid fa-caret-right"></i>';
        arrowBtn.onclick = (e) => {
            e.stopPropagation();
            toggleTray(group.id, tray);
        };

        btnGroup.appendChild(mainBtn);
        btnGroup.appendChild(arrowBtn);
        container.appendChild(btnGroup);

        // Tray
        const tray = document.createElement('div');
        tray.id = `tray-${group.id}`;
        tray.className = "absolute left-full top-0 ml-1 bg-white border border-gray-200 shadow-lg rounded z-50 w-48 p-1 hidden flex-col gap-1";

        group.items.forEach(item => {
            const itemBtn = document.createElement('button');
            itemBtn.className = "w-full text-left px-2 py-1.5 hover:bg-gray-100 text-sm text-gray-700 rounded flex items-center gap-2";
            itemBtn.innerHTML = `<i class="${item.icon} w-5 text-center"></i> ${item.name}`;
            itemBtn.onclick = (e) => {
                e.stopPropagation();
                activeTools[group.id] = item;
                window.chartManager.setDrawingMode(item.mode);
                mainBtn.innerHTML = `<i class="${item.icon}"></i>`;
                mainBtn.title = item.name;
                closeAllTrays();
            };
            tray.appendChild(itemBtn);
        });

        container.appendChild(tray);
        aside.appendChild(container);
    });

    // Separator
    const sep = document.createElement('div');
    sep.className = "w-8 border-t my-2 mx-auto";
    aside.appendChild(sep);

    // System Tools (Direct Buttons)
    // 6. Magnet
    const magnetBtn = document.createElement('button');
    magnetBtn.className = "text-gray-500 hover:text-blue-500 p-2 rounded hover:bg-gray-50 transition w-full flex justify-center mb-1";
    magnetBtn.title = "Magnet Mode";
    magnetBtn.innerHTML = '<i class="fa-solid fa-magnet"></i>';
    magnetBtn.onclick = () => {
        const active = !window.chartManager.magnetMode;
        window.chartManager.toggleMagnet(active);
        magnetBtn.classList.toggle('text-blue-600', active);
        magnetBtn.classList.toggle('bg-blue-50', active);
    };
    if (window.chartManager && window.chartManager.magnetMode) {
        magnetBtn.classList.add('text-blue-600', 'bg-blue-50');
    }
    aside.appendChild(magnetBtn);

    // 7. Lock
    const lockBtn = document.createElement('button');
    lockBtn.className = "text-gray-500 hover:text-blue-500 p-2 rounded hover:bg-gray-50 transition w-full flex justify-center mb-1";
    lockBtn.title = "Lock Drawings";
    lockBtn.innerHTML = '<i class="fa-solid fa-lock"></i>';
    lockBtn.onclick = () => {
        const active = !window.chartManager.isLocked;
        window.chartManager.toggleLock(active);
        lockBtn.classList.toggle('text-red-500', active);
        lockBtn.classList.toggle('bg-red-50', active);
    };
    if (window.chartManager && window.chartManager.isLocked) {
        lockBtn.classList.add('text-red-500', 'bg-red-50');
    }
    aside.appendChild(lockBtn);

    // Separator
    const sepSys = document.createElement('div');
    sepSys.className = "w-6 border-t my-1 mx-auto";
    aside.appendChild(sepSys);

    // 8. Undo / Redo (Grouped Horizontal)
    const undoRedoDiv = document.createElement('div');
    undoRedoDiv.className = "flex justify-center gap-1 mb-1";
    undoRedoDiv.innerHTML = `
        <button class="text-gray-500 hover:text-blue-500 p-1 rounded hover:bg-gray-50 transition" title="Undo" onclick="window.chartManager.undo()">
            <i class="fa-solid fa-rotate-left"></i>
        </button>
        <button class="text-gray-500 hover:text-blue-500 p-1 rounded hover:bg-gray-50 transition" title="Redo" onclick="window.chartManager.redo()">
            <i class="fa-solid fa-rotate-right"></i>
        </button>
    `;
    aside.appendChild(undoRedoDiv);

    // 9. Clear
    const clearBtn = document.createElement('button');
    clearBtn.className = "text-gray-500 hover:text-red-500 p-2 rounded hover:bg-red-50 transition w-full flex justify-center mb-1";
    clearBtn.title = "Clear All Drawings";
    clearBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    clearBtn.onclick = () => window.chartManager.clearDrawings();
    aside.appendChild(clearBtn);

    // 10. Zoom (Grouped Horizontal)
    const zoomDiv = document.createElement('div');
    zoomDiv.className = "flex justify-center gap-1 mb-1";
    zoomDiv.innerHTML = `
        <button class="text-gray-500 hover:text-blue-500 p-1 rounded hover:bg-gray-50 transition" title="Zoom In" onclick="window.chartManager.zoomIn()">
            <i class="fa-solid fa-magnifying-glass-plus"></i>
        </button>
        <button class="text-gray-500 hover:text-blue-500 p-1 rounded hover:bg-gray-50 transition" title="Zoom Out" onclick="window.chartManager.zoomOut()">
            <i class="fa-solid fa-magnifying-glass-minus"></i>
        </button>
    `;
    aside.appendChild(zoomDiv);

    // END NEW SYSTEM TOOLS


    // Collapse & Expand
    const collapseDiv = document.createElement('div');
    collapseDiv.className = "mt-auto w-full flex justify-center pb-2";
    collapseDiv.innerHTML = `<button class="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition"><i class="fa-solid fa-chevron-left"></i></button>`;
    aside.appendChild(collapseDiv);

    let expandBtn = document.getElementById('sidebar-expand-btn');
    if (!expandBtn) {
        expandBtn = document.createElement('button');
        expandBtn.id = 'sidebar-expand-btn';
        expandBtn.className = "fixed left-0 top-1/2 transform -translate-y-1/2 bg-white shadow-md border border-gray-200 p-1 rounded-r cursor-pointer z-50 text-gray-500 hover:text-blue-500 hidden";
        expandBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        document.body.appendChild(expandBtn);
    }

    collapseDiv.querySelector('button').onclick = () => { aside.style.display = 'none'; expandBtn.classList.remove('hidden'); window.dispatchEvent(new Event('resize')); };
    expandBtn.onclick = () => { aside.style.display = 'flex'; expandBtn.classList.add('hidden'); window.dispatchEvent(new Event('resize')); };

    // Helpers
    function toggleTray(id, trayEl) {
        if (activeTray && activeTray !== trayEl) activeTray.classList.add('hidden');
        if (trayEl.classList.contains('hidden')) { trayEl.classList.remove('hidden'); activeTray = trayEl; }
        else { trayEl.classList.add('hidden'); activeTray = null; }
    }
    function closeAllTrays() { if (activeTray) { activeTray.classList.add('hidden'); activeTray = null; } }

    if (!window._trayListenerAdded) {
        window.addEventListener('click', () => closeAllTrays());
        window._trayListenerAdded = true;
    }
}
