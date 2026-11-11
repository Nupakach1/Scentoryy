@echo off
chcp 65001 >nul
title Scentory - dang chay web (dong cua so nay de tat web)
REM Chay backend (phuc vu luon ban build Angular) tai http://localhost:3000
cd /d "%~dp0..\backend"

if not exist .env (
  echo [LOI] Chua co tep backend\.env
  echo       Chep tep .env vao thu muc: %cd%
  goto :dung
)
if not exist node_modules (
  echo [LOI] Chua cai thu vien. Hay chay bat\1b-cai-dat-thanh-vien-khac.bat truoc.
  goto :dung
)
if not exist "..\frontend\dist\scentory\browser\index.html" (
  echo [LOI] Chua build giao dien. Hay chay bat\1b-cai-dat-thanh-vien-khac.bat truoc.
  goto :dung
)

echo Dang khoi dong Scentory... trinh duyet se tu mo sau vai giay.
echo Giu nguyen cua so nay trong luc dung web. Dong cua so = tat web.
echo.
start "" /min cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:3000"
call npm run dev
echo.
echo [!] May chu da dung. Neu co loi, xem thong bao phia tren.

:dung
echo.
pause
