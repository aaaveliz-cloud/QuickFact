# Contrato previsto: firma electrónica de empresa

Estado: contrato de HTTP para implementación. Ya existe el lector backend `apps/api/src/certificates/read-certificate.ts`, que extrae metadatos, comprueba correspondencia con la clave y clasifica vigencia. No existe todavía un endpoint de carga ni lectura; depende de autenticación, permisos y almacenamiento privado. No equivale a integración real con el SRI.

El lector acepta contenedores PKCS#12 RSA compatibles con node-forge y limita el tamaño a 2 MiB. No acredita confianza/revocación de la cadena, correspondencia fiscal ni compatibilidad con todos los emisores ecuatorianos. Devuelve `validity` (`VALID`, `EXPIRED`, `NOT_YET_VALID`); el estado de firma activa se calculará en el servicio de empresa, distinto de la vigencia del certificado.

## Operaciones

- `POST /companies/:companyId/certificate`: carga multipart del `.p12` y contraseña; valida permiso Owner/Admin y pertenencia, contenido, contraseña y vigencia antes de reemplazar la firma activa. No confiar en extensión o empresa enviada por el navegador. Reemplazo atómico y auditado.
- `GET /companies/:companyId/certificate`: metadatos de la firma activa, sólo para usuarios autorizados. El Owner puede consultar el estado global de certificados desde su administración.

## Datos de respuesta

```json
{
  "id": "identificador-interno",
  "companyId": "empresa-autorizada",
  "status": "ACTIVA",
  "holderName": "Titular del certificado",
  "subject": [{ "oid": "2.5.4.3", "value": "Titular del certificado" }],
  "issuer": [{ "oid": "2.5.4.3", "value": "Autoridad certificadora" }],
  "serialNumber": "numero-de-serie-del-certificado",
  "fingerprintSha256": "huella-del-certificado-publico",
  "validFrom": "2026-01-01T00:00:00.000Z",
  "validUntil": "2027-01-01T00:00:00.000Z",
  "uploadedAt": "2026-09-30T00:00:00.000Z"
}
```

Valores ilustrativos; no representan un certificado real. Sin firma, devolver estado `SIN_CERTIFICADO` y metadatos null. Estados con firma: `ACTIVA`, `POR_VENCER`, `VENCIDA`; vigencia y selección activa se calculan en backend. Definir umbral de vencimiento próximo al implementar alertas.

La identidad/RUC sólo se expondrá si puede extraerse de un campo identificado y respaldado por documentación del emisor. No confundir el número de serie X.509 con RUC o cédula; no inferir identidad fiscal de un nombre o una cadena de dígitos. La validación de correspondencia con la empresa se implementará por emisor cuando exista documentación fiable.

## Datos privados

La respuesta no contiene contraseña, clave privada, archivo `.p12`, referencia interna de almacenamiento ni URL de descarga del certificado. Al cargar, el backend descifra sólo para validar/procesar y protege el material persistente mediante cifrado y almacenamiento privado. No registrar el cuerpo de carga ni secretos en logs. Los metadatos también requieren autorización de empresa.

## Verificación requerida

Pruebas con certificados sintéticos: extracción de titular/emisor/vigencia/huella; contraseña errónea; contenido inválido; archivo excesivo; certificado sin clave correspondiente; vencimiento; reemplazo; acceso entre empresas; usuario adicional sin privilegios de gestión. No usar firmas reales de clientes en pruebas del repositorio.
