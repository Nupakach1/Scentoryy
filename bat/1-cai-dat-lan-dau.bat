@echo off
chcp 65001 >nul
REM ===== CHỈ CHẠY 1 LẦN, TRÊN MÁY NGƯỜI QUẢN LÝ CSDL =====
REM Cài thư viện, nạp danh mục (upsert, an toàn chạy lại) và dữ liệu minh họa.
REM CẢNH BÁO: seed:demo XÓA đơn hàng/tin nhắn/đổi trả hiện có trên CSDL dùng chung.
cd /d "%~dp0..\backend"
if not exist .env ( echo [LOI] Chua co backend\.env - sao chep tu .env.example va dien chuoi Atlas. & pause & exit /b 1 )
call npm install || goto :loi
call npm run seed || goto :loi
set /p OK=Nap du lieu minh hoa (XOA don hang cu)? Go "co" de dong y: 
if /i "%OK%"=="co" call npm run seed:demo -- --xac-nhan
cd /d "%~dp0..\frontend"
call npm install || goto :loi
call npx ng build || goto :loi
echo.
echo Hoan tat. Chay bat\2-chay-web.bat de mo website.
pause & exit /b 0
:loi
echo [LOI] Cai dat that bai. Xem thong bao phia tren.
pause & exit /b 1
