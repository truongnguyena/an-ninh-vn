@echo off
setlocal
echo ==============================================
echo [ TU DONG DAY CODE LEN GITHUB ]
echo ==============================================
echo.

cd /d "%~dp0"

:: Check if git is initialized
if not exist .git (
    echo [*] Dang khoi tao Git...
    "C:\Program Files\Git\cmd\git.exe" init
)

echo [*] Dang chuan bi tep tin...
"C:\Program Files\Git\cmd\git.exe" add .

echo [*] Dang tao commit...
"C:\Program Files\Git\cmd\git.exe" commit -m "Auto deployment setup"

:: Check branch name
"C:\Program Files\Git\cmd\git.exe" branch -M main

:: Check remote
"C:\Program Files\Git\cmd\git.exe" remote remove origin 2>nul
"C:\Program Files\Git\cmd\git.exe" remote add origin https://github.com/truongnguyena/an-ninh-vn.git

echo.
echo [!] LUU Y: Khi hien cua so Github, hay dang nhap de hoan tat.
echo [*] Dang day code len GitHub...
echo.

"C:\Program Files\Git\cmd\git.exe" push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [!] LOI: Khong the day code. Hay kiem tra ket noi mang hoac quyen kieu GitHub.
) else (
    echo.
    echo [OK] DA DAY CODE THANH CONG!
    echo.
    echo Bay gio ban hay truc cap: https://github.com/truongnguyena/an-ninh-vn
    echo Va click nut "Deploy to Render" trong file README de choi game tren web!
)

pause
