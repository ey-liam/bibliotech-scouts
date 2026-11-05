@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo    METODO 1: MODO DIRECTOR EN EL SITIO WEB REAL
echo    BIBLIOTECH SCOUT - 160 BPM EN VIVO
echo ========================================================
echo.

:: Iniciar servidor HTTP en segundo plano si no esta activo
netstat -ano | findstr :8765 >nul
if %errorlevel% neq 0 (
  echo [+] Iniciando servidor local en puerto 8765...
  start /min python -m http.server 8765 --directory "%~dp0."
  timeout /t 2 /nobreak >nul
) else (
  echo [*] El servidor local ya esta activo en el puerto 8765.
)

echo [+] Abriendo el sitio web real con el Modo Director activo...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://127.0.0.1:8765/index.html?director=1" --window-size=440,940

echo.
echo ========================================================
echo ¡Sitio web real en ejecucion!
echo El audio iniciara a 160 BPM y la camara virtual hara:
echo - Scroll suave por cada seccion al ritmo del compas.
echo - Escritura automatica en el buscador real.
echo - Resaltado rítmico en las 4 secciones scouts y libros.
echo - Puedes usar el HUD flotante inferior para pausar o reiniciar.
echo ========================================================
echo.
pause
