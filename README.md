# QuickFact

SaaS de facturación electrónica para Ecuador. Proyecto iniciado desde cero porque no existía código previo.

La especificación funcional original está conservada en `docs/REQUISITOS-ORIGINALES.txt`. La aclaración posterior del propietario reemplaza su premisa de continuar un repositorio existente. El resto de los requisitos se conserva como objetivo, no como funcionalidades implementadas.

Repositorio: https://github.com/aaaveliz-cloud/QuickFact. Se conservan también los documentos previos de arquitectura y datos. No contenían código de aplicación. Las decisiones actuales se aclaran en `docs/DECISIONES.md`.

## Estado real

Base inicial: frontend Next.js, API Express con health check, TypeScript estricto y esquema Prisma preliminar (empresas, usuarios y períodos). Incluye un lector backend de metadatos `.p12` RSA probado con certificados sintéticos; aún no tiene ruta HTTP ni almacenamiento. No hay login, emisión, conexión SRI ni despliegue de producción. El esquema no garantiza todavía el aislamiento multiempresa: se completará con autorización backend, restricciones SQL y pruebas de acceso cruzado antes de exponer datos.

QuickFact será una aplicación web alojada en la nube, accesible desde navegador. Los comandos siguientes son para desarrollo; los clientes no instalan ningún programa.

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

El repositorio local está enlazado con `aaaveliz-cloud/QuickFact`. Los cambios se preparan en ramas `codex/` y se revisan mediante Pull Request a `main`. No subir `.env`, certificados ni contraseñas.

Cuando el backend y la base de datos estén listos, configurar Vercel con raíz `apps/web` y Render desde la raíz del repositorio, con build `pnpm install --frozen-lockfile && pnpm --filter @quickfact/api build` y start `pnpm --filter @quickfact/api start`. Configurar `WEB_ORIGIN` con el origen HTTPS del frontend y `NEXT_PUBLIC_API_URL` con la URL pública de la API. Secretos sólo en el backend. No desplegar producción en esta fase.

Certificados, XML, RIDE y soportes necesitarán almacenamiento persistente privado. No usar el filesystem efímero de Render. La integración SRI requerirá verificar documentación oficial vigente.
