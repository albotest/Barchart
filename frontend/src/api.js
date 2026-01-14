const API_BASE_URL = 'http://localhost:8000/api';

export const api = {
    async getOHLC(symbol, interval = '1d', period = '6mo') {
        try {
            const response = await fetch(`${API_BASE_URL}/ohlc/${symbol}?interval=${interval}&period=${period}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch OHLC:", error);
            return null;
        }
    },
    async getMarketOverview() {
        try {
            const response = await fetch(`${API_BASE_URL}/market-overview`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch Market Overview, using mock data:", error);
            // Return mock data so UI is not empty
            return {
                indices: [
                    { name: 'NIFTY 50', symbol: '^NSEI', price: 21544.85, change: 124.50, percent: 0.58, history: [21400, 21450, 21500, 21480, 21520, 21544] },
                    { name: 'NIFTY 100', symbol: '^CNX100', price: 19850.20, change: 95.10, percent: 0.48, history: [19700, 19750, 19800, 19780, 19820, 19850] },
                    { name: 'Gold', symbol: 'GC=F', price: 2045.30, change: -12.40, percent: -0.60, history: [2060, 2055, 2048, 2050, 2042, 2045] },
                    { name: 'Silver', symbol: 'SI=F', price: 23.15, change: 0.12, percent: 0.52, history: [22.9, 23.0, 23.1, 23.05, 23.12, 23.15] }
                ]
            };
        }
    },
    async getIndicators(symbol, indicators, interval = '1d', period = '6mo') {
        try {
            const response = await fetch(`${API_BASE_URL}/indicators`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, interval, period, indicators })
            });
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch Indicators:", error);
            return {};
        }
    },
    getMockOHLC(symbol, interval = '1d', period = '6mo') {
        return createMockData(symbol, interval, period);
    }
};

function createMockData(symbol, interval, period) {
    const data = [];
    let price = 6921.50;
    const now = Math.floor(Date.now() / 1000);

    // 1. Determine Time Step (seconds)
    let step = 86400; // default 1d
    if (interval === '1m') step = 60;
    else if (interval === '5m') step = 300;
    else if (interval === '15m') step = 900;
    else if (interval === '30m') step = 1800;
    else if (interval === '1h') step = 3600;
    else if (interval === '1d') step = 86400;
    else if (interval === '1wk') step = 86400 * 7;
    else if (interval === '1mo') step = 86400 * 30;

    // 2. Determine Number of Points (Count)
    // Map period to duration in seconds
    let duration = 86400 * 180; // default 6mo
    const map = {
        '1d': 86400,
        '5d': 86400 * 5,
        '1mo': 86400 * 30,
        '3mo': 86400 * 90,
        '6mo': 86400 * 180,
        '1y': 86400 * 365,
        '5y': 86400 * 365 * 5,
        'max': 86400 * 365 * 10
    };
    if (map[period]) duration = map[period];

    // Calculate count
    let count = Math.floor(duration / step);
    // Clamp for performance
    if (count > 2000) count = 2000;
    if (count < 50) count = 50;

    // 3. Generate Data
    // Adjust starting price slightly random so switching views doesn't look identical
    price = price * (1 + (Math.random() - 0.5) * 0.1);

    for (let i = count; i > 0; i--) {
        const time = now - (i * step);
        const volatility = (step / 86400) * 50; // volatility scales with time step
        const change = (Math.random() - 0.5) * volatility;
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * (volatility * 0.5);
        const low = Math.min(open, close) - Math.random() * (volatility * 0.5);
        const volume = Math.floor(Math.random() * 1000000);

        data.push({ time, open, high, low, close, volume });
        price = close;
    }
    return { symbol, data };
}
