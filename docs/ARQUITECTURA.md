# QUICKFACT — Arquitectura (Fase 2)

Estado: propuesta base para iniciar la implementación por fases.
Alcance: arquitectura lógica y decisiones técnicas. No incluye módulos de negocio ni integración real con el SRI.

## 1. Decisión de arquitectura

QUICKFACT se organizará como un monorepo TypeScript con tres aplicaciones desplegables por separado:

- `apps/web`: interfaz web con Next.js y TypeScript; desplegada en Vercel.
- `apps/api`: API HTTP con NestJS y TypeScript; desplegada en Render.
- `apps/worker`: procesos asíncronos para tareas largas y programadas; desplegados como worker en Render.

PostgreSQL será la fuente de verdad para datos, usuarios, empresas, permisos, documentos y auditoría. Redis compatible se reservará para la cola de trabajos cuando se construya esa fase. Los archivos privados irán a almacenamiento de objetos compatible con S3; la base guardará sus metadatos y referencias.

La interfaz web no se conecta directamente a PostgreSQL ni ejecuta trabajos sensibles. Las reglas de negocio y controles de autorización viven en la API o en procesos backend autenticados.

## 2. Límites entre componentes

### Web

- Presenta las pantallas y recopila datos.
- Mantiene la sesión de usuario de manera segura.
- Llama a la API por HTTPS.
- No contiene secretos de infraestructura ni decide permisos por sí sola.

### API

- Autentica usuarios mediante username y contraseña.
- Obtiene la empresa asociada a la identidad autenticada.
- Verifica rol y permisos en cada operación.
- Aplica validaciones, límites, transiciones de estado y auditoría.
- Es el único componente web que accede a la base de datos y al almacenamiento privado.

### Worker

- Ejecuta tareas que no deben depender de una petición abierta del navegador.
- Lee trabajos de una cola y usa los mismos servicios de dominio y controles de empresa que la API.
- Hace los trabajos reintentables e idempotentes y registra resultado, error y correlación.
- No ofrece acceso público de usuario.

### PostgreSQL

- Guarda los datos estructurados y las migraciones versionadas.
- Todas las tablas propiedad de una empresa incluyen `company_id` cuando corresponde.
- Se usará defensa en profundidad: filtros de tenant obligatorios en backend y políticas RLS en tablas tenant cuando se implemente el modelo.
- La conexión de aplicación utilizará un rol limitado, sin permisos de superusuario ni `BYPASSRLS`.

## 3. Aislamiento multiempresa

El tenant activo no se acepta como autoridad desde el navegador. Se resuelve a partir de la identidad autenticada y la membresía del usuario. En cada operación de datos:

1. La API autentica la sesión.
2. Resuelve empresa y permisos del usuario.
3. Ejecuta la operación dentro de ese ámbito de empresa.
4. PostgreSQL RLS ofrece una segunda barrera para las tablas tenant.

Las transacciones que configuren contexto de empresa deben establecerlo localmente a la transacción y limpiarlo al terminar. Las tareas en segundo plano deben transportar un identificador de empresa validado y revalidar el ámbito al procesarse. Las pruebas de seguridad comprobarán lecturas, escrituras, relaciones y rutas de archivos entre dos empresas.

El Owner de QUICKFACT es un rol de plataforma, separado de los usuarios de empresa; no se modelará como una empresa ficticia ni se confiará en un campo enviado por el cliente para conceder acceso global.

## 4. Autenticación y autorización

- Inicio de sesión con `username` y contraseña; no se usa email como nombre de acceso.
- Contraseñas almacenadas con hash moderno dedicado a contraseñas (Argon2id o bcrypt con parámetros vigentes), nunca reversibles ni en texto plano.
- Sesiones con cookies `HttpOnly`, `Secure` en producción y protección frente a CSRF según el mecanismo elegido.
- Roles base: Owner de plataforma, Administrador de empresa y Usuario adicional.
- Permisos granulares para el Usuario adicional. La API es la autoridad final y deniega por defecto.
- Cambios sensibles y cambios de permisos se registran en auditoría.
- Límites de intentos de acceso, validación de entrada, mensajes de error que no revelen si un username existe y rotación de secretos.

## 5. Organización del código

```text
quickfact/
├── apps/
│   ├── web/                 # Next.js
│   ├── api/                 # NestJS
│   └── worker/              # consumidor de trabajos
├── packages/
│   ├── shared/              # esquemas y tipos compartidos sin lógica sensible
│   └── config/              # configuración compartida de TypeScript/lint
├── prisma/                  # esquema y migraciones PostgreSQL
├── docs/                    # arquitectura, modelo y decisiones
├── .env.example             # nombres/documentación; nunca valores secretos
├── package.json             # scripts del monorepo
└── README.md
```

Las reglas de negocio se mantendrán en servicios backend, no en componentes de interfaz. Los paquetes compartidos no reemplazan validación ni autorización del servidor.

## 6. Despliegue previsto

- GitHub será el origen del código y del historial de cambios.
- Vercel construirá `apps/web` y publicará previews para cambios antes de producción.
- Render ejecutará `apps/api`, `apps/worker` y PostgreSQL administrado.
- Las migraciones se ejecutarán como paso controlado del despliegue antes de servir la nueva versión de API; no en paralelo desde cada instancia.
- Desarrollo, preview/staging y producción tendrán bases, almacenamiento y secretos independientes.
- Ningún despliegue de producción se realizará durante esta fase.

## 7. Archivos y certificados

- Los documentos y logos se guardarán en almacenamiento privado de objetos, con claves aleatorias y referencias en PostgreSQL.
- La API verificará acceso y, cuando corresponda, emitirá URLs firmadas de duración corta.
- Los certificados de firma electrónica y sus contraseñas se tratarán como secretos de alto impacto: cifrado con clave gestionada fuera de la base, acceso backend mínimo y auditoría. No se incluirán en logs, repositorio, variables públicas ni respuestas al navegador.
- En desarrollo se usarán datos y certificados de prueba autorizados, nunca certificados reales de clientes.

## 8. Trabajos y comprobantes programados

- Una cola Redis compatible desacoplará las solicitudes de los trabajos largos.
- El worker realizará los trabajos; cron se limitará a disparar tareas periódicas definidas.
- Cada trabajo tendrá clave de idempotencia, estado, reintentos limitados, backoff, fecha y causa de fallo.
- El estado del dominio se conservará en PostgreSQL; la cola no será la fuente de verdad.
- Límites de consumo y transiciones de estados se verificarán en backend dentro de transacciones para evitar dobles consumos.
- La programación de comprobantes y el flujo tributario se implementarán en fases posteriores, después de definir sus reglas y verificar fuentes oficiales vigentes.

## 9. Configuración y secretos

Se mantendrá un `.env.example` con nombres y descripciones, sin secretos. La configuración se validará al iniciar cada aplicación.

Variables previstas por categoría:

- General: `APP_ENV`, `LOG_LEVEL`, `WEB_ORIGIN`.
- API: `DATABASE_URL`, secreto de sesión, configuración de cookies y URL pública de API.
- Web: `NEXT_PUBLIC_API_URL` solamente para el endpoint público.
- Cola: `QUEUE_URL` o parámetros equivalentes, solo API/worker.
- Archivos: endpoint, bucket y credenciales privadas de almacenamiento, solo backend.
- Cifrado: referencia/clave de gestión para secretos almacenados, solo backend.

Los nombres concretos se fijarán al crear el proyecto base y elegir el mecanismo de sesión/gestión de secretos. No se guardarán valores reales en Git.

## 10. Observabilidad y recuperación

- Logs estructurados sin contraseñas, tokens, XML sensibles ni claves privadas.
- Identificadores de solicitud y trabajo para rastrear operaciones.
- Auditoría de acciones de usuarios separada de logs técnicos.
- Copias de seguridad de PostgreSQL y política de retención por definir al configurar producción; se documentará y verificará una restauración antes de operar con datos reales.
- Alertas para fallos repetidos de jobs, errores de API y capacidad de almacenamiento/base.

## 11. Decisiones que quedan para sus fases

- Esquema inicial de tablas, claves, índices y políticas RLS: fase de base de datos.
- Mecanismo final de sesión y parámetros de hash: fase de autenticación.
- Proveedor concreto y región de almacenamiento: al configurar infraestructura.
- Reglas, esquemas, endpoints y firma del SRI: verificar documentación oficial vigente antes de implementar esa integración.
- Dominio, secretos reales y despliegue productivo: fase de despliegue.

## 12. Fuera de alcance en esta fase

No se crean módulos funcionales, tablas, cuentas de proveedor ni despliegues. No se integra el SRI y no se cargan certificados reales.
