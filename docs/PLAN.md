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

1. Completar el esquema según los flujos y restricciones de la especificación.
2. Configurar PostgreSQL de desarrollo independiente de producción.
3. Generar y revisar la migración inicial: restricciones de rol/empresa, límites positivos y fechas válidas; claves compuestas para referencias entre entidades de una misma empresa.
4. Implementar conexión y readiness de base de datos, autenticación, sesiones, autorización y permisos backend.
5. Probar accesos cruzados entre dos empresas y las capacidades del Owner antes de exponer información.

No presentar el esquema preliminar como garantía de aislamiento. La seguridad debe comprobarse en backend y base de datos con pruebas reales.

## Accesos pendientes

- Enlace del repositorio GitHub existente; revisar su historial antes de enlazarlo o publicar cambios.
- Identificación de proyectos o servicios existentes en Vercel y Render.
- PostgreSQL de desarrollo; credenciales configuradas localmente o en las plataformas, nunca en el chat ni en Git.
- Almacenamiento persistente privado y correo, cuando se implementen esos módulos.

Crear recursos de pago requiere la decisión del propietario. La vinculación de cuentas con GitHub no demuestra que el servicio o la base de datos ya existan.
