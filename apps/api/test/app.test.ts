import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { readConfig } from '../src/config.js';

test('health reports process availability without exposing configuration', async () => {
  const response = await request(createApp('http://localhost:3000')).get('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok', service: 'quickfact-api' });
  assert.equal(response.headers['x-powered-by'], undefined);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
});

test('unknown business routes do not expose tenant information', async () => {
  const response = await request(createApp('http://localhost:3000')).get('/companies');
  assert.equal(response.status, 404);
});

test('malformed JSON returns a safe response', async () => {
  const response = await request(createApp('http://localhost:3000'))
    .post('/documents').set('Content-Type', 'application/json').send('{');
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'INVALID_JSON' });
});

test('production requires an HTTPS frontend origin', () => {
  assert.throws(() => readConfig({ NODE_ENV: 'production', WEB_ORIGIN: 'http://example.com' }));
  assert.throws(() => readConfig({ WEB_ORIGIN: 'https://example.com/path' }));
});

test('CORS only authorizes the configured frontend origin', async () => {
  const response = await request(createApp('https://quickfact.example'))
    .get('/health').set('Origin', 'https://untrusted.example');
  assert.equal(response.headers['access-control-allow-origin'], 'https://quickfact.example');
  assert.notEqual(response.headers['access-control-allow-origin'], '*');
});

test('oversized JSON is rejected without echoing the request', async () => {
  const response = await request(createApp('http://localhost:3000'))
    .post('/documents').send({ value: 'x'.repeat(110_000) });
  assert.equal(response.status, 413);
  assert.deepEqual(response.body, { error: 'PAYLOAD_TOO_LARGE' });
});
