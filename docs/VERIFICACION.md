# Verificación de la base inicial

Resultados locales de la sesión del 29 de septiembre de 2026 (America/Guayaquil):

- Instalación de dependencias completada con pnpm 11.19.0; lockfile generado.
- `pnpm build`: frontend y backend compilan correctamente.
- `pnpm typecheck`: sin errores en ambos proyectos.
- `pnpm lint`: sin errores en ambos proyectos.
- `pnpm test`: once pruebas HTTP/configuración de la API y lectura PKCS#12 aprobadas.
- `pnpm db:validate`: esquema Prisma válido.
- `pnpm audit --prod`: sin vulnerabilidades conocidas reportadas en esta verificación.
- Comprobadas las exclusiones Git de `.env`, `.env.local`, `.p12` y `.key`.

## Correcciones

Configuración de scripts de instalación adaptada a pnpm 11; navegación inicial con el componente Link de Next.js. Dos overrides acotados corrigen los tres avisos detectados en dependencias indirectas de Prisma: `@prisma/config>deepmerge-ts` 8.0.0 y `prisma>mysql2` 3.23.1. La generación de cliente, validación del esquema y compilación se verificaron después del cambio. Revisar y retirar estos overrides cuando Prisma incorpore las versiones corregidas.

Avisos consultados: [deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [mysql2: autenticación](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), [mysql2: compresión](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3).

## Límites de esta verificación

No se conectó PostgreSQL ni se ejecutaron migraciones. El lector de certificados es un servicio backend sin ruta HTTP ni persistencia; limitado a RSA compatible con node-forge, sin validación de cadena, revocación ni identidad fiscal. No hay endpoints de negocio, login, permisos operativos, pruebas de aislamiento entre empresas, SRI, correo, almacenamiento persistente ni despliegue. El health check sólo comprueba el proceso. Estas comprobaciones no acreditan todavía la seguridad o funcionalidad del SaaS completo.
