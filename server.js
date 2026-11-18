const http = require('node:http');

const GREETINGS = {
  en: { name: 'English', message: 'Hello World' },
  de: { name: 'Deutsch', message: 'Hallo Welt' },
  fr: { name: 'Français', message: 'Bonjour le monde' },
  es: { name: 'Español', message: 'Hola Mundo' },
  it: { name: 'Italiano', message: 'Ciao Mondo' },
};

// OpenAPI description of this API, served at /openapi.json and shown by Swagger UI at /docs.
function openapi(version) {
  const text = { 'text/plain': { schema: { type: 'string' } } };
  return {
    openapi: '3.0.3',
    info: {
      title: 'btp-gcp-test-backend',
      version,
      description: 'Backend for the btp-demo app. The frontend (btp-gcp-test-frontend) calls /greeting and /languages.',
    },
    servers: [{ url: '/' }],
    paths: {
      '/greeting': {
        get: {
          summary: 'A greeting in the requested language',
          parameters: [{
            name: 'lang', in: 'query', required: false,
            schema: { type: 'string', enum: Object.keys(GREETINGS), default: 'en' },
          }],
          responses: {
            200: { description: 'The greeting', content: { 'application/json': { schema: { $ref: '#/components/schemas/Greeting' } } } },
            400: { description: 'Unsupported language', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/languages': {
        get: {
          summary: 'Supported languages',
          responses: {
            200: {
              description: 'Language codes and names',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Language' } } } },
            },
          },
        },
      },
      '/version': { get: { summary: 'The deployed commit', responses: { 200: { description: 'Commit SHA', content: text } } } },
      '/healthz': { get: { summary: 'Health check', responses: { 200: { description: 'OK', content: text } } } },
    },
    components: {
      schemas: {
        Greeting: {
          type: 'object',
          required: ['message', 'lang', 'version'],
          properties: {
            message: { type: 'string', example: 'Hello World' },
            lang: { type: 'string', example: 'en' },
            version: { type: 'string', description: 'The backend commit that answered' },
          },
        },
        Language: {
          type: 'object',
          properties: { code: { type: 'string', example: 'de' }, name: { type: 'string', example: 'Deutsch' } },
        },
        Error: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  };
}

const DOCS = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>btp-gcp-test-backend API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger-ui', supportedSubmitMethods: ['get'] });</script>
</body>
</html>
`;

function send(response, status, type, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, ...headers });
  response.end(body);
}

function json(response, status, data) {
  send(response, status, 'application/json', JSON.stringify(data));
}

function greeting(response, lang, version) {
  const entry = GREETINGS[lang];
  if (!entry) return json(response, 400, { error: `unsupported language: ${lang}` });
  return json(response, 200, { message: entry.message, lang, version });
}

function createServer() {
  return http.createServer((request, response) => {
    const version = process.env.APP_VERSION || 'unknown';
    if (request.method !== 'GET') return send(response, 405, 'text/plain', 'Method Not Allowed');

    const url = new URL(request.url, 'http://localhost');
    switch (url.pathname) {
      case '/':
        return send(response, 302, 'text/plain', 'See /docs', { Location: '/docs' });
      case '/greeting':
        return greeting(response, url.searchParams.get('lang') || 'en', version);
      case '/languages':
        return json(response, 200, Object.entries(GREETINGS).map(([code, { name }]) => ({ code, name })));
      case '/openapi.json':
        return json(response, 200, openapi(version));
      case '/docs':
        return send(response, 200, 'text/html', DOCS);
      case '/version':
        return send(response, 200, 'text/plain', version);
      case '/healthz':
        return send(response, 200, 'text/plain', 'OK');
      default:
        return send(response, 404, 'text/plain', 'Not Found');
    }
  });
}

if (require.main === module) {
  const server = createServer().listen(process.env.PORT || 3000);
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

module.exports = { createServer };
