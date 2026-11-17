const http = require('node:http');

function send(response, status, type, body) {
  response.writeHead(status, { 'Content-Type': `${type}; charset=utf-8` });
  response.end(body);
}

function createServer() {
  return http.createServer((request, response) => {
    const version = process.env.APP_VERSION || 'unknown';
    if (request.method !== 'GET') return send(response, 405, 'text/plain', 'Method Not Allowed');

    switch (request.url) {
      case '/greeting':
        return send(response, 200, 'application/json', JSON.stringify({ message: 'Hello World', version }));
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
