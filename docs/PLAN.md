# Plan de continuidad

## Decisiones confirmadas

- Se inicia desde cero; no hay código anterior que recuperar.
- Next.js + TypeScript en Vercel; Express + TypeScript en Render; PostgreSQL y Prisma.
- Autenticación por username y contraseña.
- Una empresa por usuario operativo; Owner global como excepción.
- Implementación gradual según `REQUISITOS-ORIGINALES.txt`.
- Sin integración SRI real ni despliegue de producción en la fase inicial.

## Base inicial

Estructura del monorepositorio, página de preparación, API sin endpoints de negocio, health check, validación de configuración, esquema preliminar, ejemplos de entorno y pruebas HTTP. La existencia de estos archivos no demuestra que los módulos de negocio estén implementados.

## Siguiente etapa

1. Verificar el job CI con PostgreSQL temporal y la migración inicial.
2. Crear PostgreSQL de desarrollo en Render, configurar rol runtime limitado separado del administrador y crear el Owner por bootstrap privado.
3. Verificar login/sesiones contra esa base y construir la interfaz de acceso.
4. Continuar gestión de empresas, usuarios, permisos y auditoría; después configuración y firma.

Ya preparados: migración de identidad/períodos/sesiones, RLS en cuatro tablas, conexión PostgreSQL, readiness, login/logout/me y consulta de perfil de empresa con autorización backend. El resultado de CI debe acreditar la ejecución real de migraciones y aislamiento en PostgreSQL; la base de Render aún no está conectada.

No presentar el esquema preliminar como garantía de aislamiento. La seguridad debe comprobarse en backend y base de datos con pruebas reales.

## Accesos pendientes

- Repositorio GitHub identificado: `aaaveliz-cloud/QuickFact`; historial previo revisado e integrado con la base local.
- Identificación de proyectos o servicios existentes en Vercel y Render.
- PostgreSQL de desarrollo; credenciales configuradas localmente o en las plataformas, nunca en el chat ni en Git.
- Almacenamiento persistente privado y correo, cuando se implementen esos módulos.

Crear recursos de pago requiere la decisión del propietario. La vinculación de cuentas con GitHub no demuestra que el servicio o la base de datos ya existan.
