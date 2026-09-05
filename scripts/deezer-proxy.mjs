import http from 'node:http';

const PORT = Number(process.env.DEEZER_PROXY_PORT || 3002);
const HOST = process.env.DEEZER_PROXY_HOST || '127.0.0.1';
const DEEZER_SEARCH_URL = 'https://api.deezer.com/search';
const REQUEST_TIMEOUT_MS = 7000;
const MAX_QUERY_LENGTH = 100;
const ALLOWED_ORIGINS = new Set([
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://localhost:8087',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
  'http://127.0.0.1:8083',
  'http://127.0.0.1:8087',
]);

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin;
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : undefined;

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {}, allowedOrigin);
    return;
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${HOST}:${PORT}`}`);
  if (request.method !== 'GET' || url.pathname !== '/api/music/search') {
    sendJson(response, 404, { error: 'Not found' }, allowedOrigin);
    return;
  }

  const query = url.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) {
    sendJson(response, 400, { error: 'Query must contain at least 2 characters.' }, allowedOrigin);
    return;
  }
  if (query.length > MAX_QUERY_LENGTH) {
    sendJson(response, 400, { error: 'Query is too long.' }, allowedOrigin);
    return;
  }

  const deezerUrl = new URL(DEEZER_SEARCH_URL);
  deezerUrl.searchParams.set('q', query);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const deezerResponse = await fetch(deezerUrl, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!deezerResponse.ok) {
      sendJson(response, deezerResponse.status === 429 ? 429 : 502, { error: `Deezer search failed (${deezerResponse.status})` }, allowedOrigin);
      return;
    }

    const payload = await deezerResponse.json();
    if (!payload || !Array.isArray(payload.data)) {
      sendJson(response, 502, { error: 'Deezer returned an invalid response.' }, allowedOrigin);
      return;
    }

    sendJson(response, 200, { data: payload.data }, allowedOrigin);
  } catch (error) {
    const status = error instanceof Error && error.name === 'AbortError' ? 504 : 502;
    const message = status === 504 ? 'Deezer search timed out.' : 'Deezer search is unavailable.';
    sendJson(response, status, { error: message }, allowedOrigin);
  } finally {
    clearTimeout(timeout);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Deezer local proxy listening at http://${HOST}:${PORT}`);
});

function sendJson(response, status, payload, origin) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    ...(origin ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Content-Type',
      Vary: 'Origin',
    } : {}),
  });
  response.end(status === 204 ? undefined : JSON.stringify(payload));
}
