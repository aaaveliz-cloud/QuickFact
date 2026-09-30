# QuickFact

SaaS de facturación electrónica para Ecuador. Proyecto iniciado desde cero porque no existía código previo.

La especificación funcional original está conservada en `docs/REQUISITOS-ORIGINALES.txt`. La aclaración posterior del propietario reemplaza su premisa de continuar un repositorio existente. El resto de los requisitos se conserva como objetivo, no como funcionalidades implementadas.

## Estado real

Base inicial: frontend Next.js, API Express con health check, TypeScript estricto y esquema Prisma preliminar (empresas, usuarios y períodos). No hay login, emisión, conexión SRI ni despliegue de producción. El esquema no garantiza todavía el aislamiento multiempresa: se completará con autorización backend, restricciones SQL y pruebas de acceso cruzado antes de exponer datos.

## Requisitos y ejecución

Node.js 24 y pnpm 11.19.0.

```sh
pnpm install
pnpm dev:web
# En otra terminal:
pnpm dev:api
```

Frontend: http://localhost:3000. API: http://localhost:4000/health. Este health check indica disponibilidad del proceso, no de PostgreSQL.

Copiar `apps/api/.env.example` a `apps/api/.env` y `apps/web/.env.example` a `apps/web/.env.local` cuando se configuren servicios. Los ejemplos no contienen credenciales reales. PostgreSQL no es necesario para compilar esta primera base.

## Verificación

```sh
pnpm db:validate
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

## Próxima fase

Completar modelo de datos, migración inicial con restricciones multiempresa, conexión PostgreSQL de desarrollo, autenticación por username/contraseña y permisos backend. No aplicar migraciones a producción desde una máquina de desarrollo. No hay migraciones todavía: el esquema es preliminar.

## GitHub, Vercel y Render

El repositorio local debe publicarse en GitHub Desktop mediante **Add local repository** y **Publish repository**, como privado. Revisar los archivos antes de publicar. No subir `.env`, certificados ni contraseñas.

Cuando el backend y la base de datos estén listos, configurar Vercel con raíz `apps/web` y Render desde la raíz del repositorio, con build `pnpm install --frozen-lockfile && pnpm --filter @quickfact/api build` y start `pnpm --filter @quickfact/api start`. Configurar `WEB_ORIGIN` con el origen HTTPS del frontend y `NEXT_PUBLIC_API_URL` con la URL pública de la API. Secretos sólo en el backend. No desplegar producción en esta fase.

Certificados, XML, RIDE y soportes necesitarán almacenamiento persistente privado. No usar el filesystem efímero de Render. La integración SRI requerirá verificar documentación oficial vigente.
