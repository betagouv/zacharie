import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { PROCONNECT_CLIENT_ID, PROCONNECT_CLIENT_SECRET, PROCONNECT_ISSUER } from '~/config';

// Fournisseur OIDC factice qui imite ProConnect, monté en dev/test quand PROCONNECT_ISSUER est absent.
// La page /authorize laisse saisir l'email renvoyé, ce qui permet de tester le cas "email différent".

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'zacharie-mock-proconnect';
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, use: 'sig', alg: 'RS256' };

interface PendingCode {
  email: string;
  nonce: string;
  redirectUri: string;
  codeChallenge: string | null;
}
const codes = new Map<string, PendingCode>();
const accessTokens = new Map<string, string>(); // access_token -> email

function subFor(email: string) {
  return crypto.createHash('sha256').update(email).digest('hex').slice(0, 32);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const router: express.Router = express.Router();

router.get('/.well-known/openid-configuration', (_req, res) => {
  res.json({
    issuer: PROCONNECT_ISSUER,
    authorization_endpoint: `${PROCONNECT_ISSUER}/authorize`,
    token_endpoint: `${PROCONNECT_ISSUER}/token`,
    userinfo_endpoint: `${PROCONNECT_ISSUER}/userinfo`,
    jwks_uri: `${PROCONNECT_ISSUER}/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['openid', 'email', 'given_name', 'usual_name'],
  });
});

router.get('/jwks', (_req, res) => {
  res.json({ keys: [jwk] });
});

router.get('/authorize', (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  if (q.client_id !== PROCONNECT_CLIENT_ID || !q.redirect_uri || !q.state || !q.nonce) {
    res.status(400).send('invalid_request');
    return;
  }
  const hidden = ['redirect_uri', 'state', 'nonce', 'code_challenge']
    .filter((name) => q[name])
    .map((name) => `<input type="hidden" name="${name}" value="${escapeHtml(q[name]!)}" />`)
    .join('');
  res.type('html').send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8" /><title>ProConnect (simulateur)</title></head>
<body>
<h1>ProConnect (simulateur)</h1>
<form method="post" action="${PROCONNECT_ISSUER}/authorize">
  ${hidden}
  <label for="email">Email professionnel</label>
  <input id="email" name="email" type="email" value="${escapeHtml(q.login_hint ?? '')}" required />
  <button type="submit">S'identifier avec ProConnect</button>
</form>
</body></html>`);
});

router.post('/authorize', (req, res) => {
  const body = req.body as Record<string, string | undefined>;
  if (!body.email || !body.redirect_uri || !body.state || !body.nonce) {
    res.status(400).send('invalid_request');
    return;
  }
  const code = crypto.randomUUID();
  codes.set(code, {
    email: body.email,
    nonce: body.nonce,
    redirectUri: body.redirect_uri,
    codeChallenge: body.code_challenge ?? null,
  });
  const url = new URL(body.redirect_uri);
  url.searchParams.set('code', code);
  url.searchParams.set('state', body.state);
  res.redirect(url.href);
});

router.post('/token', (req, res) => {
  const body = req.body as Record<string, string | undefined>;
  if (body.grant_type !== 'authorization_code' || !body.code) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }
  if (body.client_id !== PROCONNECT_CLIENT_ID || body.client_secret !== PROCONNECT_CLIENT_SECRET) {
    res.status(401).json({ error: 'invalid_client' });
    return;
  }
  const pending = codes.get(body.code);
  codes.delete(body.code);
  if (!pending || pending.redirectUri !== body.redirect_uri) {
    res.status(400).json({ error: 'invalid_grant' });
    return;
  }
  if (pending.codeChallenge) {
    const challenge = crypto
      .createHash('sha256')
      .update(body.code_verifier ?? '')
      .digest('base64url');
    if (challenge !== pending.codeChallenge) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }
  }
  const accessToken = crypto.randomUUID();
  accessTokens.set(accessToken, pending.email);
  const idToken = jwt.sign(
    { sub: subFor(pending.email), nonce: pending.nonce, amr: ['pwd'], acr: 'eidas1' },
    privateKey,
    {
      algorithm: 'RS256',
      keyid: KID,
      issuer: PROCONNECT_ISSUER,
      audience: PROCONNECT_CLIENT_ID,
      expiresIn: 60,
    }
  );
  res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 60, id_token: idToken });
});

router.get('/userinfo', (req, res) => {
  const auth = req.headers.authorization ?? '';
  const email = auth.startsWith('Bearer ') ? accessTokens.get(auth.slice('Bearer '.length)) : undefined;
  if (!email) {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }
  res.json({ sub: subFor(email), email, given_name: 'Alice', usual_name: 'Admin' });
});

export default router;
