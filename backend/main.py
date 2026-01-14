from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import pandas_ta as ta
from typing import List, Optional
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Barchart Clone API is running"}

class IndicatorRequest(BaseModel):
    symbol: str
    interval: str = "1d"
    period: str = "6mo"
    indicators: List[dict] 

@app.get("/api/ohlc/{symbol}")
def get_ohlc(symbol: str, interval: str = "1d", period: str = "6mo"):
    ticker = symbol
    if symbol == "NQH26":
        ticker = "NQ=F" 
    
    try:
        df = yf.download(ticker, period=period, interval=interval, progress=False)
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Flatten multi-index columns if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        df.reset_index(inplace=True)
        
        # Ensure we have a proper Date/Datetime column
        date_col = 'Date' if 'Date' in df.columns else 'Datetime'
        if date_col not in df.columns:
             # Fallback if neither exists, look for index name or rename first col
             df.rename(columns={df.columns[0]: 'Date'}, inplace=True)
             date_col = 'Date'

        result = []
        for _, row in df.iterrows():
            time_val = row[date_col]
            if interval in ['1m', '5m', '15m', '30m', '1h']:
                 t = int(time_val.timestamp())
            else:
                 t = time_val.strftime('%Y-%m-%d')
            
            result.append({
                "time": t,
                "open": row['Open'],
                "high": row['High'],
                "low": row['Low'],
                "close": row['Close'],
                "volume": int(row['Volume'])
            })
            
        return {"symbol": symbol, "data": result}
    except Exception as e:
        print(f"Error in OHLC: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/indicators")
def get_indicators(request: IndicatorRequest):
    ticker = request.symbol
    if request.symbol == "NQH26":
        ticker = "NQ=F"
        
    try:
        df = yf.download(ticker, period=request.period, interval=request.interval, progress=False)
        if df.empty:
             raise HTTPException(status_code=404, detail="No data found")
        
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        
        # pandas_ta requires a Datetime index usually, or we can just specify open, high, low, close
        # yfinance returns Datetime index by default.
        
        response_data = {}
        
        # Prepare time mapping
        times = []
        df.reset_index(inplace=True)
        date_col = 'Date' if 'Date' in df.columns else 'Datetime'
        if date_col not in df.columns:
             df.rename(columns={df.columns[0]: 'Date'}, inplace=True)
             date_col = 'Date'

        for _, row in df.iterrows():
            time_val = row[date_col]
            if request.interval in ['1m', '5m', '15m', '30m', '1h']:
                 times.append(int(time_val.timestamp()))
            else:
                 times.append(time_val.strftime('%Y-%m-%d'))

        for ind in request.indicators:
            name = ind.get("name")
            try:
                if name == "bbands":
                    length = int(ind.get("length", 20))
                    std = float(ind.get("std", 2.0))
                    bb = df.ta.bbands(length=length, std=std)
                    if bb is not None:
                        # Columns: BBL_length_std, BBM_length_std, BBU_length_std
                        lower_col = f"BBL_{length}_{std}"
                        mid_col = f"BBM_{length}_{std}"
                        upper_col = f"BBU_{length}_{std}"
                        
                        # Handle case where pandas_ta appends .0 or not depending on version/float
                        # We'll just search for columns starting with BBL, BBM, BBU if exact match fails
                        cols = bb.columns
                        l = next((c for c in cols if c.startswith("BBL")), lower_col)
                        m = next((c for c in cols if c.startswith("BBM")), mid_col)
                        u = next((c for c in cols if c.startswith("BBU")), upper_col)

                        response_data[f"{name}_{length}_{std}"] = {
                            "type": "overlay",
                            "lines": {
                                "lower": [{"time": t, "value": val} for t, val in zip(times, bb[l]) if pd.notna(val)],
                                "middle": [{"time": t, "value": val} for t, val in zip(times, bb[m]) if pd.notna(val)],
                                "upper": [{"time": t, "value": val} for t, val in zip(times, bb[u]) if pd.notna(val)]
                            }
                        }

                elif name == "sma":
                    length = int(ind.get("length", 50))
                    sma = df.ta.sma(length=length)
                    if sma is not None:
                         response_data[f"{name}_{length}"] = {
                            "type": "overlay",
                            "lines": {
                                "sma": [{"time": t, "value": val} for t, val in zip(times, sma) if pd.notna(val)]
                            }
                        }

                elif name == "ema":
                    length = int(ind.get("length", 20))
                    ema = df.ta.ema(length=length)
                    if ema is not None:
                         response_data[f"{name}_{length}"] = {
                            "type": "overlay",
                            "lines": {
                                "ema": [{"time": t, "value": val} for t, val in zip(times, ema) if pd.notna(val)]
                            }
                        }
                
                elif name == "rsi":
                    length = int(ind.get("length", 14))
                    rsi = df.ta.rsi(length=length)
                    if rsi is not None:
                         response_data[f"{name}_{length}"] = {
                            "type": "standalone",
                            "lines": {
                                "rsi": [{"time": t, "value": val} for t, val in zip(times, rsi) if pd.notna(val)]
                            }
                        }
                
                elif name == "macd":
                    fast = int(ind.get("fast", 12))
                    slow = int(ind.get("slow", 26))
                    signal = int(ind.get("signal", 9))
                    macd = df.ta.macd(fast=fast, slow=slow, signal=signal)
                    if macd is not None:
                        # Columns: MACD_12_26_9, MACDh_12_26_9, MACDs_12_26_9
                        cols = macd.columns
                        macd_col = next((c for c in cols if c.startswith("MACD_")), None)
                        hist_col = next((c for c in cols if c.startswith("MACDh_")), None)
                        sig_col = next((c for c in cols if c.startswith("MACDs_")), None)
                        
                        if macd_col and hist_col and sig_col:
                            response_data[f"{name}_{fast}_{slow}_{signal}"] = {
                                "type": "standalone",
                                "lines": {
                                    "macd": [{"time": t, "value": val} for t, val in zip(times, macd[macd_col]) if pd.notna(val)],
                                    "signal": [{"time": t, "value": val} for t, val in zip(times, macd[sig_col]) if pd.notna(val)],
                                    "histogram": [{"time": t, "value": val} for t, val in zip(times, macd[hist_col]) if pd.notna(val)]
                                }
                            }

            except Exception as ind_err:
                print(f"Error calculating {name}: {ind_err}")
                continue

    except Exception as e:
        print(f"Error in indicators: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    return response_data

@app.get("/api/market-overview")
def get_market_overview():
    # Symbols: NIFTY50, NIFTY100, Crude Oil, Gold, Silver
    # Yahoo Tickers: ^NSEI, ^CNX100, CL=F, GC=F, SI=F
    symbols = [
        {"symbol": "^NSEI", "name": "NIFTY 50"},
        {"symbol": "^CNX100", "name": "NIFTY 100"},
        {"symbol": "CL=F", "name": "Crude Oil"},
        {"symbol": "GC=F", "name": "Gold"},
        {"symbol": "SI=F", "name": "Silver"}
    ]
    
    results = []
    
    for item in symbols:
        try:
            # Get 5 days history for sparkline and current data
            ticker = yf.Ticker(item["symbol"])
            hist = ticker.history(period="5d", interval="1h")
            
            if hist.empty:
                # Fallback if no data (e.g. market holiday or error)
                results.append({
                    "symbol": item["symbol"],
                    "name": item["name"],
                    "price": 0.0,
                    "change": 0.0,
                    "percent": 0.0,
                    "history": []
                })
                continue

            current_price = hist['Close'].iloc[-1]
            prev_close = hist['Close'].iloc[-2] if len(hist) > 1 else current_price
            change = current_price - prev_close
            percent = (change / prev_close) * 100 if prev_close != 0 else 0
            
            # Simple sparkline data (normalized 0-1 or just raw price list)
            # We'll return raw prices, frontend can normalize
            history_data = hist['Close'].values.tolist()
            
            results.append({
                "symbol": item["symbol"],
                "name": item["name"],
                "price": float(current_price),
                "change": float(change),
                "percent": float(percent),
                "history": [float(x) for x in history_data if pd.notna(x)]
            })
            
        except Exception as e:
            print(f"Error fetching {item['symbol']}: {e}")
            results.append({
                "symbol": item["symbol"],
                "name": item["name"],
                "price": 0.0,
                "change": 0.0,
                "percent": 0.0,
                "history": []
            })
            
    return {"indices": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
