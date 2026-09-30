import assert from 'node:assert/strict';
import { test } from 'node:test';
import forge from 'node-forge';
import { CertificateReadError, MAX_CERTIFICATE_BYTES, readCertificate } from '../src/certificates/read-certificate.js';

// Only synthetic material generated in memory. No real customer certificate or file.
const keys = forge.pki.rsa.generateKeyPair(2048);
const certificate = forge.pki.createCertificate();
certificate.publicKey = keys.publicKey;
certificate.serialNumber = '01';
certificate.validity.notBefore = new Date('2026-01-01T00:00:00Z');
certificate.validity.notAfter = new Date('2027-01-01T00:00:00Z');
certificate.setSubject([{ name: 'commonName', value: 'Synthetic QuickFact Test' }]);
certificate.setIssuer([{ name: 'commonName', value: 'Synthetic QuickFact Test CA' }]);
certificate.sign(keys.privateKey, forge.md.sha256.create());
const password = 'synthetic-test-only';
const file = Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(
  keys.privateKey, [certificate], password, { algorithm: 'aes256' },
)).getBytes(), 'binary');

function expectCode(fn: () => unknown, code: CertificateReadError['code']) {
  assert.throws(fn, (error) => error instanceof CertificateReadError && error.code === code);
}

test('extracts only certificate metadata from a password-protected P12', () => {
  const data = readCertificate(file, password, new Date('2026-09-29T00:00:00Z'));
  assert.equal(data.holderName, 'Synthetic QuickFact Test');
  assert.equal(data.issuer[0]?.value, 'Synthetic QuickFact Test CA');
  assert.equal(data.serialNumber, '01');
  assert.equal(data.validity, 'VALID');
  assert.equal(data.validFrom, '2026-01-01T00:00:00.000Z');
  assert.equal(data.validUntil, '2027-01-01T00:00:00.000Z');
  assert.match(data.fingerprintSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(data).sort(), [
    'fingerprintSha256', 'holderName', 'issuer', 'serialNumber', 'subject', 'validFrom', 'validUntil', 'validity',
  ]);
  assert.ok(!JSON.stringify(data).includes(password));
});

test('reports certificate validity relative to the supplied time', () => {
  assert.equal(readCertificate(file, password, new Date('2025-12-31')).validity, 'NOT_YET_VALID');
  assert.equal(readCertificate(file, password, new Date('2027-01-02')).validity, 'EXPIRED');
});

test('rejects wrong password or invalid content using safe error codes', () => {
  expectCode(() => readCertificate(file, 'wrong-password'), 'INVALID_CONTAINER_OR_PASSWORD');
  expectCode(() => readCertificate(Buffer.from('invalid'), password), 'INVALID_CONTAINER_OR_PASSWORD');
});

test('rejects empty or oversized files before parsing', () => {
  expectCode(() => readCertificate(Buffer.alloc(0), password), 'EMPTY_FILE');
  expectCode(() => readCertificate(Buffer.alloc(MAX_CERTIFICATE_BYTES + 1), password), 'FILE_TOO_LARGE');
});

test('rejects a certificate without its private signing key', () => {
  const publicOnly = Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(
    null, [certificate], password, { algorithm: 'aes256' },
  )).getBytes(), 'binary');
  expectCode(() => readCertificate(publicOnly, password), 'NO_MATCHING_PRIVATE_KEY');
});
