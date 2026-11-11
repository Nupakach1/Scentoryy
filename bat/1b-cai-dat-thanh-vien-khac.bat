@echo off
chcp 65001 >nul
REM ===== DÀNH CHO THÀNH VIÊN KHÁC TRONG NHÓM =====
REM Chỉ cài thư viện và build giao diện. KHÔNG seed để không ghi đè CSDL dùng chung.
cd /d "%~dp0..\backend"
if not exist .env ( echo [LOI] Chua co backend\.env - xin tep .env tu truong nhom. & pause & exit /b 1 )
call npm install || goto :loi
cd /d "%~dp0..\frontend"
call npm install || goto :loi
call npx ng build || goto :loi
echo Hoan tat. Chay bat\2-chay-web.bat.
pause & exit /b 0
:loi
echo [LOI] Cai dat that bai.
pause & exit /b 1
