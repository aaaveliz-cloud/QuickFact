# QUICKFACT — Estructura GitHub (Fase 3)

Estado: propuesta operativa para el futuro repositorio remoto.
No se creó un remoto ni se publicaron archivos: todavía no existe un repositorio GitHub seleccionado.

## Repositorio

- Un repositorio privado llamado `quickfact` para el monorepo.
- El código de web, API, worker, paquetes compartidos, migraciones y documentación vive en el mismo historial.
- No se suben archivos `.env`, certificados, credenciales, bases locales ni archivos de clientes.
- No se añade infraestructura productiva ni configuración con secretos al repositorio.

## Ramas y cambios

- `main` representa el código integrado y revisable.
- Cada cambio se trabaja en ramas cortas con nombres descriptivos: `feat/...`, `fix/...`, `docs/...` o `chore/...`.
- Los cambios se integran mediante Pull Request a `main`.
- No se trabaja directamente sobre `main` una vez configuradas las protecciones.
- Los commits describen el cambio en términos concretos; se recomienda el formato Conventional Commits para facilitar el historial.

## Protección de `main`

Cuando se cree el repositorio remoto, configurar:

- Pull Request obligatorio antes de integrar cambios.
- Verificaciones automáticas obligatorias cuando existan los flujos CI.
- Bloqueo de force-push y eliminación de `main`.
- Revisión de cambios de dependencias, migraciones y configuración de despliegue.

En la etapa inicial, si solo hay un mantenedor, la revisión puede ser una auto-revisión del Pull Request; los checks siguen siendo útiles para evitar integrar código que no construye.

## CI y despliegue

- GitHub Actions validará instalación reproducible, lint, tipos y build de los paquetes afectados.
- Los checks deben ser reproducibles en local y no requerir secretos de producción.
- Vercel y Render se conectarán al repositorio cuando existan cuentas/proyectos elegidos.
- Pull Requests pueden generar previews; `main` puede desplegar a staging una vez configurado.
- Producción requerirá una promoción deliberada en su fase; no se habilita automáticamente durante el arranque del proyecto.
- Migraciones se revisan como código y se aplican mediante un único paso de despliegue controlado.

## Archivos iniciales del repositorio
