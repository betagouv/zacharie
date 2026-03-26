import compression from 'compression';
import express from 'express';
import path from 'path';

const viteDevServer =
  process.env.NODE_ENV === 'production'
    ? undefined
    : await import('vite').then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        }),
      );

const app = express();

app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable('x-powered-by');

// Security headers (Mozilla Observatory recommendations)
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://stats.beta.gouv.fr",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://developer.apple.com https://play.google.com",
      "font-src 'self' data:",
      "connect-src 'self' https://api.zacharie.beta.gouv.fr https://*.ingest.sentry.io https://sentry.incubateur.net https://metabase.zacharie.beta.gouv.fr https://stats.beta.gouv.fr",
      "frame-src https://metabase.zacharie.beta.gouv.fr https://www.youtube.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      'upgrade-insecure-requests',
    ].join('; '),
  );
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

if (viteDevServer) {
  app.use(viteDevServer.middlewares);
  app.use((req, res, next) => {
    res.setHeader('Service-Worker-Allowed', '/');
    console.log('Set Service-Worker-Allowed header');
    next();
  });
} else {
  // Vite fingerprints its assets so we can cache forever.
  app.use('/assets', express.static('build/assets', { immutable: true, maxAge: '1y' }));
}

// Serve static files from the build/client directory
app.use(express.static(path.join(process.cwd(), 'build')));

// For any other routes, send the index.html file
app.get('*', (req, res, next) => {
  res.sendFile(path.join(process.cwd(), 'build', 'index.html'), next);
});

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => console.log(`Express server listening at http://localhost:${port}`));
