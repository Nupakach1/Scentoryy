@echo off
chcp 65001 >nul
title Scentory - ban gia lap (khong can CSDL)
REM Chay may chu GIA LAP (khong can MongoDB, du lieu trong bo nho) tai http://localhost:3100
cd /d "%~dp0..\backend"
if not exist node_modules (
  echo [LOI] Chua cai thu vien. Hay chay bat\1b-cai-dat-thanh-vien-khac.bat truoc.
  goto :dung
)
cd /d "%~dp0..\frontend"
if not exist dist\scentory\browser\index.html call npx ng build
cd /d "%~dp0..\backend"
echo Dang khoi dong ban gia lap... trinh duyet se tu mo sau vai giay.
start "" /min cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:3100"
call npm run gia-lap
echo.
echo [!] May chu da dung. Neu co loi, xem thong bao phia tren.
:dung
echo.
pause
