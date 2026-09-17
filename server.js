import http from 'node:http';
import worker from './worker.js';

const port = Number(process.env.PORT || 8080);

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || `localhost:${port}`;
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const url = `${proto}://${host}${req.url || '/'}`;
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
      duplex: 'half'
    });
    const response = await worker.fetch(request);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    if (req.method === 'HEAD') return res.end();
    const body = Buffer.from(await response.arrayBuffer());
    res.end(body);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'server_error' }));
  }
});

server.listen(port, () => {
  console.log(`electricity-price-dryer listening on ${port}`);
});
