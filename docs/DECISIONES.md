# Decisiones de continuidad

## Aplicación en la nube

El propietario confirma que QuickFact se usa desde el navegador y se aloja en la nube: Vercel, Render y PostgreSQL administrado. No se entregará un programa instalable ni se exigirá instalar Node.js, PostgreSQL o QuickFact en los equipos de los clientes. La carpeta local es exclusivamente el espacio de desarrollo/verificación; el código versionado en GitHub será la fuente de los despliegues.

## Repositorio

El propietario proporcionó https://github.com/aaaveliz-cloud/QuickFact. El historial remoto contenía documentación y configuración, sin frontend, backend ni esquema implementados. Se integra ese historial con la base local conservando ambos. Se mantienen `ARQUITECTURA.md`, `MODELO-DATOS.md`, `FLUJO-GITHUB.md`, el ejemplo raíz de variables y `tsconfig.base.json`.

## Backend

El documento previo de arquitectura proponía NestJS. La especificación maestra entregada en esta conversación establece Express + TypeScript, utilizado por la base inicial. Esa instrucción actual prevalece. Worker, cola, RLS y almacenamiento privado continúan como objetivos de sus fases, no como servicios ya implementados.

## Datos de la firma

La API debe leer el archivo `.p12` con la contraseña proporcionada al cargarlo y extraer los metadatos necesarios para configuración y estado de la firma. El material privado se utiliza por servicios backend para la firma, sin enviarlo al navegador. Se detalla el contrato en `API-FIRMA.md`.
