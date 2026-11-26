import compression from 'compression';
import express from 'express';
import fs from 'fs';
import path from 'path';

const viteDevServer =
  process.env.NODE_ENV === 'production'
    ? undefined
    : await import('vite').then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        })
      );

const app = express();

app.use(compression());

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://stats.beta.gouv.fr",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://developer.apple.com https://play.google.com",
      "font-src 'self' data:",
      `connect-src 'self' https://api.zacharie.beta.gouv.fr https://*.ingest.sentry.io https://sentry.incubateur.net https://metabase.zacharie.beta.gouv.fr https://stats.beta.gouv.fr https://api.zacharie.incubateur.net https://recherche-entreprises.api.gouv.fr${process.env.REVIEW_APP === 'true' ? ` ${process.env.VITE_API_URL}` : ''}`,
      'frame-src blob: https://metabase.zacharie.beta.gouv.fr https://www.youtube.com',
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      'upgrade-insecure-requests',
    ].join('; ')
  );
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
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
  app.use('/assets', express.static('build/assets', { immutable: true, maxAge: '1y' }));
  app.use('/assets', (req, res) => res.status(404).end());
}

app.get('/.well-known/apple-app-site-association', (req, res) => {
  res.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: `${process.env.APPLE_TEAM_ID}.fr.gouv.zacharie.v1`,
          paths: ['/app/*'],
        },
      ],
    },
  });
});

app.get('/.well-known/assetlinks.json', (req, res) => {
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds'],
      target: {
        namespace: 'android_app',
        package_name: 'fr.gouv.zacharie.v1',
        sha256_cert_fingerprints: (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      },
    },
  ]);
});

const noStoreFiles = ['index.html', 'service-worker.js', 'spa-manifest.json'];

app.use(
  express.static(path.join(process.cwd(), 'build'), {
    setHeaders: (res, filePath) => {
      if (noStoreFiles.includes(path.basename(filePath))) res.setHeader('Cache-Control', 'no-store');
    },
  })
);

const indexHtml = viteDevServer
  ? null
  : fs.readFileSync(path.join(process.cwd(), 'build', 'index.html'), 'utf8');
app.get('*', (req, res, next) => {
  if (!indexHtml) return next();
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(indexHtml);
});

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => console.log(`Express server listening at http://localhost:${port}`));
