@echo off
cd /d "%~dp0"
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    python server.py
) else (
    "C:\Users\DELL.COM\AppData\Local\Microsoft\WindowsApps\python3.13.exe" server.py
)
pause
