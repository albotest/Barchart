// Shared constants for the charting application

export const AVAILABLE_INDICATORS = {
    overlay: [
        { id: 'bbands', name: 'Bollinger Bands', params: { length: 20, std: 2 } },
        { id: 'sma', name: 'Simple Moving Average (SMA)', params: { length: 50 } },
        { id: 'ema', name: 'Exponential Moving Average (EMA)', params: { length: 20 } },
    ],
    standalone: [
        { id: 'rsi', name: 'Relative Strength Index (RSI)', params: { length: 14 } },
        { id: 'macd', name: 'MACD', params: { fast: 12, slow: 26, signal: 9 } },
    ]
};

export const INTERVAL_LABELS = {
    '1m': '1 Min',
    '5m': '5 Min',
    '15m': '15 Min',
    '30m': '30 Min',
    '1h': '1 Hour',
    '1d': 'Daily',
    '1wk': 'Weekly',
    '1mo': 'Monthly'
};

export const PERIOD_LABELS = {
    '1d': '1-Day',
    '5d': '5-Day',
    '1mo': '1-Month',
    '3mo': '3-Month',
    '6mo': '6-Month',
    '1y': '1-Year',
    '5y': '5-Year',
    'max': 'Max'
};

export const INTRADAY_INTERVALS = ['1m', '5m', '15m', '30m', '1h'];
export const LONG_PERIODS = ['6mo', '1y', '5y', 'max'];
