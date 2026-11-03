import compression from 'compression';
import express from 'express';
import path from 'path';
import { Readable } from 'stream';
import server from './dist/server/server.js';

const app = express();
app.use(compression());
app.disable('x-powered-by');

// Vite fingerprints its assets so we can cache forever.
app.use(
  '/assets',
  express.static(path.join(process.cwd(), 'dist/client/assets'), { immutable: true, maxAge: '1y' })
);
app.use(express.static(path.join(process.cwd(), 'dist/client')));

// le reste (pages, fonctions serveur, /api/webhook) est servi par TanStack Start, qui prend une Request web
app.use(async (req, res, next) => {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
      else if (value !== undefined) headers.set(key, value);
    }
    const protocol = req.headers['x-forwarded-proto'] ?? 'http';
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const response = await server.fetch(
      new Request(`${protocol}://${req.headers.host}${req.originalUrl}`, {
        method: req.method,
        headers,
        body: hasBody ? Readable.toWeb(req) : undefined,
        duplex: 'half',
      })
    );
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key !== 'set-cookie') res.setHeader(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader('set-cookie', cookies);
    if (response.body) Readable.fromWeb(response.body).pipe(res);
    else res.end();
  } catch (error) {
    next(error);
  }
});

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => console.log(`Bac à sable API Zacharie : http://localhost:${port}`));
