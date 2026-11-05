# Instrucciones para GitHub Copilot

Este repositorio sigue el protocolo de **AGENTS.md**. Léelo antes de proponer
cambios grandes.

## Resumen

- Sitio estático de GitHub Pages: `index.html`, `styles.css`, `app.js`.
- Los archivos de `data/` se generan con scripts. **No los edites a mano.**
- No trabajes directamente sobre `main`. Usa una rama
  `agent/copilot/<tema>` y abre un pull request.
- No ejecutes `prepare_public_site.py`, `actualizar_bibliotech.bat` ni
  `PUBLICAR_WEB.bat`; esos scripts copian carpetas completas y pueden pisar
  cambios de otros agentes.
- No incluyas tokens, contraseñas ni archivos `.env`.
- Mantén o mejora la accesibilidad y el rendimiento.

## Al revisar un PR

1. Comprueba que el cambio sea pequeño y esté relacionado con el issue.
2. Busca errores de accesibilidad: textos alternativos, contraste, landmarks,
   etiquetas de formulario y navegación por teclado.
3. Busca regresiones de rendimiento: imágenes sin `loading="lazy"` fuera de la
   primera pantalla, JSON pesados cargados al inicio, animaciones costosas.
4. Verifica que no se hayan editado los JSON generados a mano.
5. Señala riesgos concretos y sugiere una corrección; no reescribas todo el PR.

## Al proponer código

- Sigue el estilo existente de `app.js` y `styles.css`.
- Usa `escapeHtml` para contenido dinámico.
- No agregues dependencias nuevas sin justificarlo.
- Prueba en local con `python -m http.server 8765 --bind 127.0.0.1`.
- Si el cambio afecta datos o publicación, deja el PR en revisión humana.
