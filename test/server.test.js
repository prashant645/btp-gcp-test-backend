const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');

let server;
let baseUrl;

before(async () => {
  server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise(resolve => server.close(resolve)));

test('GET /greeting returns the English message and version as JSON', async () => {
  process.env.APP_VERSION = 'abc123';
  const response = await fetch(`${baseUrl}/greeting`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await response.json(), { message: 'Hello World', lang: 'en', version: 'abc123' });
});

test('GET /greeting?lang=de returns the German message', async () => {
  process.env.APP_VERSION = 'abc123';
  const response = await fetch(`${baseUrl}/greeting?lang=de`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: 'Hallo Welt', lang: 'de', version: 'abc123' });
});

test('GET /greeting with an unsupported language returns 400', async () => {
  const response = await fetch(`${baseUrl}/greeting?lang=xx`);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'unsupported language: xx' });
});

test('GET /languages lists the supported languages', async () => {
  const response = await fetch(`${baseUrl}/languages`);
  assert.equal(response.status, 200);
  const languages = await response.json();
  assert.deepEqual(languages.map(l => l.code), ['en', 'de', 'fr', 'es', 'it']);
  assert.deepEqual(languages[1], { code: 'de', name: 'Deutsch' });
});

test('GET /openapi.json describes the API', async () => {
  process.env.APP_VERSION = 'abc123';
  const response = await fetch(`${baseUrl}/openapi.json`);
  assert.equal(response.status, 200);
  const spec = await response.json();
  assert.equal(spec.openapi, '3.0.3');
  assert.equal(spec.info.version, 'abc123');
  assert.deepEqual(Object.keys(spec.paths), ['/greeting', '/languages', '/version', '/healthz']);
});

test('GET /docs serves Swagger UI for /openapi.json', async () => {
  const response = await fetch(`${baseUrl}/docs`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  const page = await response.text();
  assert.match(page, /swagger-ui-bundle\.js/);
  assert.match(page, /url: '\/openapi\.json'/);
});

test('GET / redirects to /docs', async () => {
  const response = await fetch(`${baseUrl}/`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/docs');
});

test('GET /version returns APP_VERSION', async () => {
  process.env.APP_VERSION = 'abc123';
  const response = await fetch(`${baseUrl}/version`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'abc123');
});

test('GET /version falls back to unknown', async () => {
  delete process.env.APP_VERSION;
  const response = await fetch(`${baseUrl}/version`);
  assert.equal(await response.text(), 'unknown');
});

test('GET /healthz returns OK', async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'OK');
});

test('unknown path returns 404', async () => {
  const response = await fetch(`${baseUrl}/missing`);
  assert.equal(response.status, 404);
});

test('POST is rejected', async () => {
  const response = await fetch(`${baseUrl}/greeting`, { method: 'POST' });
  assert.equal(response.status, 405);
});
