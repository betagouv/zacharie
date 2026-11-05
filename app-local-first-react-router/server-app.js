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

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable('x-powered-by');

// Zacharie dans une iframe (embedded=true) : les origines autorisées sont réglées par clé API dans
// l'admin. On ne les lit que pour un document chargé dans une iframe : le navigateur envoie alors
// Sec-Fetch-Dest: iframe, à chaque chargement (y compris un rechargement sans embedded=true).
async function getFrameAncestors(req) {
  if (req.headers['sec-fetch-dest'] !== 'iframe' || !process.env.VITE_API_URL) return [];
  try {
    const res = await fetch(`${process.env.VITE_API_URL}/frame-ancestors`, {
      signal: AbortSignal.timeout(3000),
    });
    const json = await res.json();
    return json.data.origins;
  } catch (error) {
    console.error('frame-ancestors indisponible', error);
    return [];
  }
}

// Security headers (Mozilla Observatory recommendations)
app.use(async (req, res, next) => {
  const frameAncestors = await getFrameAncestors(req);
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://stats.beta.gouv.fr",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://developer.apple.com https://play.google.com",
      "font-src 'self' data:",
      // review app d'une PR : l'API est sur une URL cleverapps.io propre à la PR
      `connect-src 'self' https://api.zacharie.beta.gouv.fr https://*.ingest.sentry.io https://sentry.incubateur.net https://metabase.zacharie.beta.gouv.fr https://stats.beta.gouv.fr https://api.zacharie.incubateur.net https://recherche-entreprises.api.gouv.fr${process.env.REVIEW_APP === 'true' ? ` ${process.env.VITE_API_URL}` : ''}`,
      // blob: pour l'aperçu des PDF (fiche de transmission) affichés dans une iframe
      'frame-src blob: https://metabase.zacharie.beta.gouv.fr https://www.youtube.com',
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      ["frame-ancestors 'self'", ...frameAncestors].join(' '),
      'upgrade-insecure-requests',
    ].join('; ')
  );
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // X-Frame-Options ne sait pas lister d'autres origines : frame-ancestors suffit quand il y en a
  if (!frameAncestors.length) res.setHeader('X-Frame-Options', 'SAMEORIGIN');
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
  // Vite fingerprints its assets so we can cache forever.
  app.use('/assets', express.static('build/assets', { immutable: true, maxAge: '1y' }));
}

// Universal Links (iOS) & App Links (Android)
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

// index.html, the service worker and spa-manifest.json (read by the mobile app to download the web
// assets) reference the hashed assets of the current build:
// never cache them, so a deploy reaches users on the next load.
const noStoreFiles = ['index.html', 'service-worker.js', 'spa-manifest.json'];

// Serve static files from the build/client directory
app.use(
  express.static(path.join(process.cwd(), 'build'), {
    setHeaders: (res, filePath) => {
      if (noStoreFiles.includes(path.basename(filePath))) res.setHeader('Cache-Control', 'no-store');
    },
  })
);

// For any other routes, send the index.html file.
// Read once at startup: no file system access per request (in dev, Vite serves index.html).
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
