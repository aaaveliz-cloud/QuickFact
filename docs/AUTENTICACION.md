# Autenticación y base multiempresa

Implementación backend inicial. Requiere PostgreSQL migrado y un rol runtime limitado; no se ha conectado Render ni creado un Owner real. No incluye aún interfaz de login, permisos granulares ni gestión de usuarios.

## Endpoints

- `POST /auth/login`: username y password exclusivamente; normaliza username. Credenciales inválidas, cuenta desactivada y empresa desactivada no permiten sesión.
- `GET /auth/me`: usuario de la sesión, sin hashes ni tokens en JSON.
- `POST /auth/logout`: revoca la sesión en PostgreSQL y elimina la cookie.
- `GET /companies/:companyId`: perfil mínimo de la empresa propia; Owner puede consultar otras empresas. No acepta un rol/tenant proporcionado por el cliente como autoridad.
- `/health`: proceso disponible. `/ready`: PostgreSQL, migración y privilegios runtime correctos; 503 si falta configuración.

## Sesiones y navegador

Contraseñas con scrypt (`N=131072`, `r=8`, `p=1`), salt aleatorio y comparación constante. Tokens de sesión aleatorios de 256 bits; sólo se guarda SHA-256 del token. Vigencia fija de 8 horas. Se vuelven a validar estado del usuario/empresa y versión de autenticación en cada petición.

Cookie HttpOnly, SameSite=Lax, host-only; Secure y prefijo `__Host-` en producción. El navegador llama a `/api/auth/...` y `/api/companies/...` en el mismo dominio de Vercel; Next.js los reenvía al origen `API_URL` de Render. Las mutaciones requieren `Origin` exactamente igual a `WEB_ORIGIN`. No usar fetch directo a un dominio Render diferente para mantener este esquema de cookies.

Login: 10 intentos por 15 minutos/IP; el hash admite una operación concurrente por instancia para acotar consumo de memoria, devolviendo 429 al excederlo. Revisar proxies antes de fijar `TRUST_PROXY_HOPS` en Render y verificar límites compartidos al escalar instancias.

## Migración y roles PostgreSQL

La migración inicial crea Company, User, AnnualPeriod y Session. Garantiza relación rol/empresa, formato de hash, username normalizado, límites y fechas válidos, períodos sin solapamiento y RLS forzada en las cuatro tablas. Los cambios de contraseña, rol, empresa o estado de usuario incrementan `authVersion`, invalidando sesiones previas.

El contexto autorizado (`quickfact.company_id`, `quickfact.user_id`, `quickfact.is_owner`) es local a la transacción. Las funciones de login y resolución de sesión son excepciones acotadas de identidad de plataforma, SECURITY DEFINER, con búsqueda fija y permisos revocados a PUBLIC. No retornan información directamente al navegador: la API valida y filtra la respuesta. El rol runtime no es propietario, superusuario ni BYPASSRLS; `/ready` rechaza esas credenciales.

En una base nueva exclusivamente para QuickFact, el rol administrador aplica `pnpm --filter @quickfact/api db:deploy` usando `MIGRATION_DATABASE_URL`. Después se crea el rol runtime con una contraseña configurada privadamente y estos privilegios mínimos (el secreto del rol no forma parte del ejemplo):

```sql
-- Crear quickfact_runtime mediante el administrador y configurar su contraseña fuera de Git.
GRANT USAGE ON SCHEMA public TO quickfact_runtime;
GRANT SELECT ON "Company", "User", "AnnualPeriod" TO quickfact_runtime;
GRANT SELECT, INSERT, DELETE ON "Session" TO quickfact_runtime;
GRANT EXECUTE ON FUNCTION public.quickfact_login_user(text), public.quickfact_session(text)
  TO quickfact_runtime;
```

`DATABASE_URL` del backend utiliza ese rol; `MIGRATION_DATABASE_URL` queda en herramientas administrativas, separado de la ejecución del servidor. Los permisos de escritura de nuevos módulos se añadirán con sus fases y pruebas correspondientes.

## Owner inicial

Después de migrar una base de desarrollo, preparar privadamente `MIGRATION_DATABASE_URL`, `OWNER_USERNAME`, `OWNER_PASSWORD` (12 a 256 caracteres), `OWNER_FIRST_NAME`, `OWNER_LAST_NAME`. Ejecutar `pnpm --filter @quickfact/api db:bootstrap-owner` después de compilar. El script serializa la operación, crea sólo el primer Owner y no reemplaza usuarios ni resetea contraseñas existentes. No hay cuenta o contraseña predeterminada. Retirar la variable OWNER_PASSWORD después.

## Verificación

21 pruebas locales de HTTP, autenticación y lectura de firmas aprobadas después del ajuste de proxy. GitHub Actions crea PostgreSQL 16 temporal, aplica la migración y ejecuta `test:db` con dos empresas y un Owner. Comprueba RLS, recuperación de contexto del pool, rechazos de escritura cruzada, restricciones de datos, sesiones, cambios de rol y acceso global autorizado. El job no despliega ni requiere secretos de producción.

Las pruebas de base exigen `TEST_DATABASE_URL` con nombre `quickfact_test` en loopback y un entorno desechable, como el servicio CI. No se ejecutan contra una base real de clientes. No confundir una prueba HTTP con verificación de políticas PostgreSQL.

Resultado real: [job aprobado del commit 92204d2](https://github.com/aaaveliz-cloud/QuickFact/actions/runs/36746586871). La migración se aplicó y las siete subpruebas de integración PostgreSQL 16 pasaron. La base de desarrollo de Render y el Owner real siguen pendientes; tampoco se ha verificado todavía el proxy/cookie en un despliegue Vercel–Render con navegador.

Referencias: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Node.js crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html), [Prisma PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql), [Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites).
