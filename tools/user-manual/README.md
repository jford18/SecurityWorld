# Generador de capturas para el manual de usuario

Este utilitario automatiza la navegación del portal para capturar pantallas en PNG usando Playwright.

## Configuración

1. Copia el archivo de ejemplo y ajusta tus credenciales (no se versionan):

   ```bash
   cp tools/user-manual/manual.env.example tools/user-manual/manual.env
   ```

2. Edita `tools/user-manual/manual.env` y completa las variables:

   - `MANUAL_BASE_URL`: URL del portal (ej. `http://172.16.9.253:5173`).
   - `MANUAL_USER`: usuario con permisos para navegar las pantallas.
   - `MANUAL_PASS`: contraseña del usuario.
   - `MANUAL_OUT`: ruta donde se guardarán las capturas (por defecto `./tools/user-manual/out`).

3. Asegúrate de tener disponibles las dependencias de desarrollo `playwright` y `dotenv` (incluidas en `package.json`). Playwright requiere que el navegador Chromium esté instalado en el entorno.

El script carga las variables desde `tools/user-manual/manual.env` (basado en `manual.env.example`).

## Uso

Ejecuta el script con Node. No requiere pasos adicionales:

```bash
node tools/user-manual/capture.screenshots.mjs
```

El script:

- Lee y ordena las rutas desde `manual.pages.json`.
- Ingresa al portal usando las credenciales del archivo de entorno.
- Recorre cada ruta y genera capturas de pantalla completas en `MANUAL_OUT` con nombres numerados (`NN-titulo-normalizado.png`).
- Muestra en consola un log `OK: <title> => <filename>` por cada captura generada.

## Salida

Las imágenes se guardan en la carpeta definida en `MANUAL_OUT` (por defecto `tools/user-manual/out`).
