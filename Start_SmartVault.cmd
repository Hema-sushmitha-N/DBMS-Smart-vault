@echo off
cd /d "%~dp0"
"C:\Users\sushm\AppData\Local\Python\pythoncore-3.14-64\python.exe" "%~dp0.local\launcher.py"
if errorlevel 1 pause
