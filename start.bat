@echo off
echo ╔══════════════════════════════════════╗
echo ║        Magic QC — Starting...        ║
echo ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo [1/3] Checking Python...
python --version
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.9+
    pause
    exit /b 1
)

echo.
echo [2/3] Installing backend dependencies...
pip install -r backend\requirements.txt --quiet

echo.
echo [3/3] Installing Node.js dependencies...
call npm install

echo.
echo ✓ Setup complete. Starting Magic QC...
echo.
call npm run dev
