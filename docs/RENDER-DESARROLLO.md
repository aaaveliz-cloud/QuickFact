# Base de desarrollo de Render

Base autorizada por el propietario: [quickfact-dev](https://dashboard.render.com/d/dpg-dauk5u49v7es739sqo20-a), plan Free temporal para pruebas. El propietario confirmó guardar la conexión externa en el secreto de repositorio `MIGRATION_DATABASE_URL` de GitHub Actions. No registrar su valor en Git ni en el chat.

El workflow `render-dev-database.yml` instala dependencias y aplica únicamente migraciones existentes con `prisma migrate deploy`. Se ejecuta al cambiar su archivo en `codex/base-quickfact`; no se ejecuta en cada cambio de código. No despliega servicios, crea usuarios ni borra datos. El script restringe el destino al identificador de la base autorizada, exige TLS con validación de certificado y suprime errores de conexión y salida administrativa que podrían contener secretos. Comprueba cuatro tablas con RLS forzada y dos funciones de identidad.

La finalización del workflow debe comprobarse en GitHub Actions antes de afirmar que la base está migrada. Después faltan el rol runtime limitado, el Owner inicial y la conexión de la API. La conexión administrativa no debe usarse como `DATABASE_URL` del servidor.
