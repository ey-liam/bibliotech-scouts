@echo off
set FFMPEG="C:\Users\liamc\Downloads\JD Modding\Liam Tools\Liam Converter Video2Webm\ffmpeg.exe"
set INPUT="%USERPROFILE%\Downloads\bibliotech-scout-promo-1080x1920.webm"
set OUTPUT="%~dp0bibliotech-scout-promo-1080x1920.mp4"

echo ========================================================
echo    CONVERTIDOR A MP4 TIKTOK / REELS / SHORTS (60 FPS)
echo ========================================================
echo.

if not exist %INPUT% (
  echo [!] No se encontro el archivo en Descargas:
  echo     %INPUT%
  echo.
  echo Por favor abre promo.html, haz clic en "Grabar Video",
  echo espera a que termine la cancion y se descargue el archivo WebM.
  echo Luego vuelve a ejecutar este script.
  echo.
  pause
  exit /b 1
)

echo Convirtiendo a MP4 de alta definicion (H.264 / AAC 60 FPS)...
%FFMPEG% -y -i %INPUT% -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k %OUTPUT%

echo.
echo ========================================================
echo Video exportado exitosamente a:
echo %OUTPUT%
echo ========================================================
echo Listo para subir a TikTok, Instagram Reels, YouTube Shorts o WhatsApp!
pause
