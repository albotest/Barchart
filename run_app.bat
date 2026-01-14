
@echo off
echo Starting Barchart Replica Application...

:: Start Backend
echo Starting FastAPI Backend...
start "Barchart Backend" cmd /k "cd backend && call .venv\Scripts\activate 2>nul & uvicorn main:app --reload --port 8000"

:: Start Frontend
echo Starting Vite Frontend...
start "Barchart Frontend" cmd /k "cd frontend && npm run dev"

echo ===================================================
echo Application is running!
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo ===================================================

:: Wait a few seconds for servers to spin up then open browser
timeout /t 5 /nobreak >nul
start http://localhost:5173

pause
