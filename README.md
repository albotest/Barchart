# Barchart - Financial Charting Platform

A modern, real-time financial charting application inspired by Barchart.com, built with a clean architecture and professional-grade features.

## 🚀 Features

- **Interactive Charts**: Real-time candlestick, OHLC, line, area, and Heikin Ashi charts
- **Technical Indicators**: Bollinger Bands, SMA, EMA, RSI, MACD
- **Drawing Tools**: Trendlines, rectangles, ellipses, channels
- **Multiple Timeframes**: 5m, 15m, 30m, 1h, Daily, Weekly
- **Period Selection**: 1D, 5D, 1M, 3M, 6M, 1Y, 5Y
- **Market Overview**: Home page with market cards
- **Dynamic Quote Header**: Live price updates with hover functionality
- **Magnet Mode**: Snap drawings to OHLC values
- **Responsive Design**: Modern UI with Tailwind CSS

## 🛠️ Tech Stack

### Frontend
- **Framework**: Vanilla JavaScript + Vite
- **Charting**: TradingView Lightweight Charts
- **Styling**: Tailwind CSS
- **Icons**: Font Awesome

### Backend
- **Framework**: FastAPI (Python)
- **Data Source**: yfinance
- **Technical Analysis**: pandas-ta

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **npm** or **yarn**

## 🔧 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd antig
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # On Windows
# source .venv/bin/activate  # On macOS/Linux
pip install -r requirements.txt
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

## ▶️ Running the Application

### Option 1: Using the Batch Script (Windows)
```bash
# From the root directory
run_app.bat
```
This will:
- Start the FastAPI backend on `http://localhost:8000`
- Start the Vite frontend on `http://localhost:5173`
- Automatically open the browser

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
.venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Then open your browser to `http://localhost:5173`

## 📁 Project Structure

```
antig/
├── frontend/
│   ├── src/
│   │   ├── api.js              # API client
│   │   ├── chartManager.js     # Chart management
│   │   ├── chart-page.js       # Chart page logic
│   │   ├── home.js             # Home page logic
│   │   ├── constants.js        # Shared constants
│   │   ├── drawing/            # Drawing tools
│   │   └── style.css           # Global styles
│   ├── index.html              # Home page
│   ├── chart.html              # Chart page
│   └── package.json
├── backend/
│   ├── main.py                 # FastAPI server
│   └── requirements.txt
└── README.md
```

## 🎯 Usage

1. **Home Page**: Browse market overview cards
2. **Click a Market**: Opens the chart page for that symbol
3. **Change Timeframe**: Use dropdown to select interval (5m, 1h, Daily, etc.)
4. **Change Period**: Select time range (1D, 1M, 6M, etc.)
5. **Add Indicators**: Click "Indicators" button to add technical indicators
6. **Draw on Chart**: Use drawing tools from the left sidebar
7. **Hover for Details**: Move cursor over chart to see candle details

## 🔨 Development

### Frontend Development
```bash
cd frontend
npm run dev
```

### Backend Development
```bash
cd backend
uvicorn main:app --reload
```

### Build for Production
```bash
cd frontend
npm run build
```

## 📊 API Endpoints

- `GET /api/ohlc/{symbol}` - Get OHLC data
- `GET /api/market-overview` - Get market overview
- `POST /api/indicators` - Get technical indicators

## 🎨 Customization

- **Add Indicators**: Edit `src/constants.js` → `AVAILABLE_INDICATORS`
- **Modify Timeframes**: Edit `src/constants.js` → `INTERVAL_LABELS`
- **Styling**: Edit `src/style.css` or Tailwind classes

## 📝 License

This project is for educational purposes.

## 🙏 Acknowledgments

- TradingView Lightweight Charts
- Barchart.com (inspiration)
- yfinance for market data
