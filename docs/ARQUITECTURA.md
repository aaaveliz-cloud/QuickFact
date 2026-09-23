# QuickFact

Plataforma web de facturación electrónica para Ecuador.

## Objetivo

QuickFact será una plataforma multiempresa que permitirá a diferentes contribuyentes gestionar comprobantes electrónicos mediante una única plataforma.

## Arquitectura inicial

- Frontend: Vercel
- Backend: FastAPI
- Hosting backend: Render
- Base de datos: PostgreSQL
- Repositorio: GitHub
- Integración: Web Services del SRI
- Firma electrónica: certificados PKCS#12 (.p12)

## Principio fundamental

Cada empresa tendrá sus propios:

- Datos tributarios
- Certificado electrónico
- Clientes
- Productos
- Comprobantes
- Secuenciales

La información de una empresa no podrá ser visualizada por otra empresa.

## Ambientes

1. Desarrollo
2. SRI Pruebas
3. Producción

## Importante

Nunca almacenar en este repositorio:

- Certificados .p12
- Contraseñas
- Claves privadas
- Tokens
- Credenciales
- Información real de clientes
