# Manual técnico · SecurityWorld

## Visión general

SecurityWorld centraliza información de seguridad y operación, integrando módulos de backend, frontend y automatizaciones RPA para HikCentral.

- **Ruta raíz del proyecto (Windows):** `C:\portal-sw\SecurityWorld\`
- **Ruta raíz observada en este entorno:** `/workspace/SecurityWorld`

## Arquitectura (alto nivel)

- **Frontend web:** aplicación React/Vite para visualización y operación.
- **Backend API:** servicios Node.js/Express en `server/`.
- **Integración RPA:** scripts Python en `hikcentral_rpa/` para exportaciones/procesamiento desde HikCentral.
- **Datos de soporte:** catálogos y datos mock en carpetas `data/` y `src/data/`.

## Stack tecnológico

- **Frontend:** React + TypeScript (estructura en `src/`, con componentes adicionales en `components/`).
- **Backend:** Node.js + Express (rutas/controladores/servicios en `server/`).
- **RPA:** Python (Selenium/Pandas, basado en scripts existentes de HikCentral).
- **BD:** PostgreSQL (consultas SQL y patrones `LIMIT/OFFSET` observados en backend).

## Estructura real del repositorio (raíz)

La raíz actual contiene, entre otras, las siguientes carpetas:

- `axios/`
- `components/`
- `data/`
- `hikcentral_rpa/`
- `server/`
- `src/`
- `tools/`
- `react-router-dom/`

> Nota: la carpeta `logs/` no fue encontrada en esta copia del repositorio. Si se usa en despliegue, se recomienda crearla en el entorno operativo para trazas de backend/RPA.

## Guía de lectura recomendada

1. [Backend](backend.md)
2. [Frontend](frontend.md)
3. [RPA HikCentral](rpa-hikcentral.md)
4. [Operación Windows Server](operacion-windows.md)
5. [Troubleshooting](troubleshooting.md)
