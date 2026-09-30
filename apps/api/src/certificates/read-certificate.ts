import { createPrivateKey, X509Certificate } from 'node:crypto';
import forge from 'node-forge';

export const MAX_CERTIFICATE_BYTES = 2 * 1024 * 1024;

export class CertificateReadError extends Error {
  constructor(public readonly code: 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'INVALID_CONTAINER_OR_PASSWORD'
    | 'NO_MATCHING_PRIVATE_KEY' | 'AMBIGUOUS_SIGNING_CERTIFICATE') {
    super(code);
    this.name = 'CertificateReadError';
  }
}

function attributes(values: forge.pki.CertificateField[]) {
  return values.flatMap((attribute) =>
    typeof attribute.type === 'string' && typeof attribute.value === 'string'
      ? [{ oid: attribute.type, value: attribute.value }] : [],
  );
}

/** Backend-only helper. Call after authentication, tenant authorization and upload limits.
 * Does not persist material, expose a route, validate the issuer chain, or sign SRI XML.
 * Forge's PKCS#12 reader supports RSA signing keys; unsupported containers are rejected.
 */
export function readCertificate(file: Buffer, password: string, now = new Date()) {
  if (file.length === 0) throw new CertificateReadError('EMPTY_FILE');
  if (file.length > MAX_CERTIFICATE_BYTES) throw new CertificateReadError('FILE_TOO_LARGE');

  try {
    const asn1 = forge.asn1.fromDer(file.toString('binary'), true);
    const container = forge.pkcs12.pkcs12FromAsn1(asn1, true, password);
    const certificateOid = forge.pki.oids.certBag!;
    const certificates = container.getBags({ bagType: certificateOid })[certificateOid] ?? [];
    const keys = [forge.pki.oids.pkcs8ShroudedKeyBag!, forge.pki.oids.keyBag!]
      .flatMap((oid) => container.getBags({ bagType: oid })[oid] ?? [])
      .flatMap((bag) => bag.key ? [createPrivateKey(forge.pki.privateKeyToPem(bag.key))] : []);

    const matches = certificates.flatMap((bag) => {
      if (!bag.cert) return [];
      const x509 = new X509Certificate(forge.pki.certificateToPem(bag.cert));
      return keys.some((key) => x509.checkPrivateKey(key)) ? [{ cert: bag.cert, x509 }] : [];
    });
    const uniqueMatches = [...new Map(matches.map((match) => [match.x509.fingerprint256, match])).values()];
    if (uniqueMatches.length === 0) throw new CertificateReadError('NO_MATCHING_PRIVATE_KEY');
    if (uniqueMatches.length !== 1) throw new CertificateReadError('AMBIGUOUS_SIGNING_CERTIFICATE');
    const { cert, x509 } = uniqueMatches[0]!;
    const validFrom = new Date(x509.validFrom);
    const validUntil = new Date(x509.validTo);

    // Explicit allowlist: never return keys, password, container or storage references.
    return {
      holderName: attributes(cert.subject.attributes).find((attribute) => attribute.oid === '2.5.4.3')?.value ?? null,
      subject: attributes(cert.subject.attributes),
      issuer: attributes(cert.issuer.attributes),
      serialNumber: x509.serialNumber,
      fingerprintSha256: x509.fingerprint256.replaceAll(':', '').toLowerCase(),
      validFrom: validFrom.toISOString(),
      validUntil: validUntil.toISOString(),
      validity: now < validFrom ? 'NOT_YET_VALID' as const
        : now > validUntil ? 'EXPIRED' as const : 'VALID' as const,
    };
  } catch (error) {
    if (error instanceof CertificateReadError) throw error;
    // Do not expose provider errors, ASN.1 input or password in an error response/log.
    throw new CertificateReadError('INVALID_CONTAINER_OR_PASSWORD');
  }
}
