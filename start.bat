@echo off
chcp 65001 > nul
echo ========================================
echo   THAY CHIEN MATH
echo ========================================
echo.
echo Dang khoi dong backend (cong 5100)...
start "ThayChienMath - Backend" cmd /k "cd backend && node src/server.js"
timeout /t 2 /nobreak > nul
echo Dang khoi dong giao dien (cong 5174)...
start "ThayChienMath - Frontend" cmd /k "cd frontend && npm run dev"
echo.
echo  Backend : http://localhost:5100
echo  Web     : http://localhost:5174
echo.
echo Mo http://localhost:5174 tren trinh duyet
echo Tai khoan mac dinh: admin / admin123
echo.
pause
