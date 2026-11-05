@echo off
echo ========================================================
echo    BIBLIOTECH SCOUT - MOTION GRAPHICS STUDIO (60 FPS)
echo ========================================================
echo.
echo Iniciando servidor local en http://127.0.0.1:8765/promo.html ...
echo.
start "" python -m http.server 8765 --directory "%~dp0."
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8765/promo.html"
echo Estudio abierto en tu navegador.
echo Puedes presionar la Barra Espaciadora para reproducir o pulsar 'Grabar Video'.
echo.
pause
