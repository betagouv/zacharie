import * as client from 'openid-client';
import {
  PROCONNECT_CLIENT_ID,
  PROCONNECT_CLIENT_SECRET,
  PROCONNECT_ISSUER,
  PROCONNECT_MOCK_ENABLED,
  PROCONNECT_REDIRECT_URI,
} from '~/config';

// Scopes ProConnect : https://partenaires.proconnect.gouv.fr/docs/fournisseur-service/scope-claims
export const PROCONNECT_SCOPE = 'openid email given_name usual_name';

export function isProConnectConfigured() {
  return Boolean(PROCONNECT_ISSUER && PROCONNECT_CLIENT_ID && PROCONNECT_CLIENT_SECRET);
}

let configPromise: Promise<client.Configuration> | null = null;

// La discovery OIDC est faite une fois puis mise en cache ; en cas d'échec on retente à l'appel suivant.
export function getProConnectConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    configPromise = client
      .discovery(
        new URL(PROCONNECT_ISSUER),
        PROCONNECT_CLIENT_ID,
        { client_secret: PROCONNECT_CLIENT_SECRET, redirect_uris: [PROCONNECT_REDIRECT_URI] },
        client.ClientSecretPost(PROCONNECT_CLIENT_SECRET),
        // le mock tourne en http sur localhost, openid-client refuse le http par défaut
        PROCONNECT_MOCK_ENABLED ? { execute: [client.allowInsecureRequests] } : undefined
      )
      .catch((error) => {
        configPromise = null;
        throw error;
      });
  }
  return configPromise;
}

export interface ProConnectAuthorization {
  url: string;
  state: string;
  nonce: string;
  codeVerifier: string | null;
}

export async function buildProConnectAuthorization(loginHint?: string): Promise<ProConnectAuthorization> {
  const config = await getProConnectConfig();
  const state = client.randomState();
  const nonce = client.randomNonce();
  const parameters: Record<string, string> = {
    redirect_uri: PROCONNECT_REDIRECT_URI,
    scope: PROCONNECT_SCOPE,
    state,
    nonce,
  };
  if (loginHint) parameters.login_hint = loginHint;
  let codeVerifier: string | null = null;
  if (config.serverMetadata().supportsPKCE()) {
    codeVerifier = client.randomPKCECodeVerifier();
    parameters.code_challenge = await client.calculatePKCECodeChallenge(codeVerifier);
    parameters.code_challenge_method = 'S256';
  }
  return { url: client.buildAuthorizationUrl(config, parameters).href, state, nonce, codeVerifier };
}

export interface ProConnectIdentity {
  sub: string;
  email: string;
}

export async function exchangeProConnectCallback(
  currentUrl: URL,
  checks: { state: string; nonce: string; codeVerifier: string | null }
): Promise<ProConnectIdentity> {
  const config = await getProConnectConfig();
  const tokens = await client.authorizationCodeGrant(config, currentUrl, {
    expectedState: checks.state,
    expectedNonce: checks.nonce,
    pkceCodeVerifier: checks.codeVerifier ?? undefined,
    idTokenExpected: true,
  });
  const idTokenClaims = tokens.claims();
  if (!idTokenClaims?.sub) {
    throw new Error('ProConnect: id_token sans sub');
  }
  // l'email n'est pas dans l'id_token ProConnect, il faut appeler userinfo (réponse JSON ou JWT signé)
  const userInfo = await client.fetchUserInfo(config, tokens.access_token, idTokenClaims.sub);
  const email = typeof userInfo.email === 'string' ? userInfo.email.toLowerCase().trim() : '';
  if (!email) {
    throw new Error('ProConnect: userinfo sans email');
  }
  return { sub: idTokenClaims.sub, email };
}
