@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo    METODO 2: EXPORTADOR DE VIDEO MP4 (60 FPS)
echo    BIBLIOTECH SCOUT - 160 BPM VERTICAL 1080x1920
echo ========================================================
echo.

set FFMPEG="C:\Users\liamc\Downloads\JD Modding\Liam Tools\Liam Converter Video2Webm\ffmpeg.exe"
set DOWNLOADS=%USERPROFILE%\Downloads

:: 1. Verificar FFmpeg local
if not exist %FFMPEG% (
  echo [ERROR] No se encontro ffmpeg.exe en:
  echo %FFMPEG%
  pause
  exit /b 1
)

:: 2. Iniciar servidor HTTP en segundo plano si no esta activo
netstat -ano | findstr :8765 >nul
if %errorlevel% neq 0 (
  echo [+] Iniciando servidor local en puerto 8765...
  start /min python -m http.server 8765 --directory "%~dp0."
  timeout /t 2 /nobreak >nul
) else (
  echo [*] El servidor local ya esta activo en el puerto 8765.
)

:: 3. Abrir la aplicacion de grabacion vertical en Google Chrome
echo [+] Abriendo Estudio de Grabacion 1080x1920 en Google Chrome...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://127.0.0.1:8765/promo-app.html" --window-size=500,980

echo.
echo ========================================================
echo                 INSTRUCCIONES DE GRABACION:
echo ========================================================
echo 1. En la ventana de Chrome que se acaba de abrir, pulsa
echo    el boton rojo "Grabar Video (60 FPS)".
echo 2. Selecciona la pestana "BiblioTech Scout" y dale Compartir.
echo 3. La animacion correra durante 49.5 segundos exactos (33 compases) con la musica.
echo 4. Al terminar, el archivo se descargara automaticamente en:
echo    %DOWNLOADS%\bibliotech-scout-promo-1080x1920.webm
echo.
echo Presiona cualquier tecla una vez que termine la grabacion
echo para convertirlo automaticamente a MP4 de alta definicion...
pause >nul

:: 4. Buscar el archivo descargado
set WEBM_FILE=%DOWNLOADS%\bibliotech-scout-promo-1080x1920.webm
if not exist "%WEBM_FILE%" (
  set WEBM_FILE=%DOWNLOADS%\bibliotech-scout-promo-mobile.webm
)

if not exist "%WEBM_FILE%" (
  echo.
  echo [!] No se encontro el archivo descargado en:
  echo     %DOWNLOADS%
  echo Asegurate de haber completado la grabacion y vuelve a ejecutar.
  pause
  exit /b 1
)

set OUTPUT_MP4="%~dp0bibliotech-scout-promo-1080x1920.mp4"

echo.
echo [+] Procesando y convirtiendo a MP4 (H.264 / AAC 60 FPS)...
%FFMPEG% -y -i "%WEBM_FILE%" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k %OUTPUT_MP4%

echo.
echo ========================================================
echo ¡VIDEO MP4 FINAL GENERADO EXITOSAMENTE!
echo Archivo: %OUTPUT_MP4%
echo ========================================================
echo Listo para compartir en TikTok, Reels, Shorts y WhatsApp!
echo.
pause
