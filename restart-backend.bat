@echo off
echo Dung backend Thay Chien Math (chi tien trinh dang dung cong 5100)...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5100" ^| findstr "LISTENING"') do taskkill /F /PID %%p 2>nul
timeout /t 2 /nobreak > nul
echo Khoi dong lai backend...
cd backend
node src/server.js
