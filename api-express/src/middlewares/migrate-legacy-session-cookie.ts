import type { NextFunction, Request, Response } from 'express';
import { IS_PRODUCTION, IS_REVIEW_APP, IS_STAGING } from '~/config';
import { cookieOptions, logoutCookieOptions, SESSION_COOKIE_NAME } from '~/utils/cookie';

// TEMPORAIRE — à supprimer en mars 2027, quand les anciens cookies (90 jours) auront tous expiré.
// L'ancien cookie de session `zacharie_express_jwt` était posé sur tout le domaine (`.zacharie.beta.gouv.fr`),
// donc envoyé à chaque sous-domaine. On recopie sa valeur dans le cookie host-only de l'API puis on l'efface :
// l'utilisateur reste connecté et ne perd pas ses données locales non synchronisées.
const LEGACY_COOKIE_NAME = 'zacharie_express_jwt';
// Le cookie d'état ProConnect garde son nom mais devient host-only : une ancienne copie posée sur tout
// le domaine serait lue avant la nouvelle au retour de ProConnect et ferait échouer la connexion admin.
const LEGACY_PROCONNECT_STATE_COOKIE = 'zacharie_proconnect';

function legacyCookieDomain() {
  if (IS_PRODUCTION) return '.zacharie.beta.gouv.fr';
  if (IS_STAGING && !IS_REVIEW_APP) return '.zacharie.incubateur.net';
  return null;
}

export function migrateLegacySessionCookie(req: Request, res: Response, next: NextFunction) {
  const domain = legacyCookieDomain();
  if (!domain) {
    next();
    return;
  }
  if (req.cookies?.[LEGACY_PROCONNECT_STATE_COOKIE]) {
    res.clearCookie(LEGACY_PROCONNECT_STATE_COOKIE, { ...logoutCookieOptions(req), domain });
  }
  const legacyToken = req.cookies?.[LEGACY_COOKIE_NAME];
  if (!legacyToken) {
    next();
    return;
  }
  res.clearCookie(LEGACY_COOKIE_NAME, { ...logoutCookieOptions(req), domain });
  if (!req.cookies[SESSION_COOKIE_NAME]) {
    // le jeton garde sa propre expiration (claim `exp`), vérifiée par passport
    req.cookies[SESSION_COOKIE_NAME] = legacyToken;
    res.cookie(SESSION_COOKIE_NAME, legacyToken, cookieOptions(req));
  }
  next();
}
