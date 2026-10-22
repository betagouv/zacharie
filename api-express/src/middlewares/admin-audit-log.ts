import express from 'express';
import { Prisma, type User } from '@prisma/client';
import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import { CLES_SECRETES } from '~/utils/scrub-sensitive';

export type AdminAuditTargetType = 'user' | 'entity' | 'fei' | 'carcasse' | 'api_key' | 'bug_investigation';

type AdminAuditLocals = {
  adminAuditTarget?: { type: AdminAuditTargetType; id: string };
  adminAuditChanges?: { before: Record<string, unknown>; after: Record<string, unknown> };
};

const METHODES_JOURNALISEES = ['POST', 'PUT', 'PATCH', 'DELETE'];
// Routes en POST qui n'écrivent rien
const ROUTES_NON_JOURNALISEES = ['/ccg/preview'];

// Les captures d'écran en base64 et les gros imports ne sont pas recopiés en entier
const LONGUEUR_MAX_TEXTE = 1000;
const LONGUEUR_MAX_LISTE = 100;
const VALEUR_MASQUEE = '[masqué]';

// Cible déduite des paramètres de la route, quand la route ne l'a pas posée elle-même
const CIBLE_PAR_PARAMETRE: Record<string, AdminAuditTargetType> = {
  user_id: 'user',
  entity_id: 'entity',
  fei_numero: 'fei',
  zacharie_carcasse_id: 'carcasse',
};
const CIBLE_PAR_ROUTE: Record<string, AdminAuditTargetType> = {
  '/api-key/new-access-token/:id': 'api_key',
  '/bug-resolution/:id/message': 'bug_investigation',
};

export function setAdminAuditTarget(res: express.Response, type: AdminAuditTargetType, id: string) {
  (res.locals as AdminAuditLocals).adminAuditTarget = { type, id };
}

// Ne garde que les champs dont la valeur a changé
export function setAdminAuditChanges(
  res: express.Response,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: Array<string>
) {
  const changes: AdminAuditLocals['adminAuditChanges'] = { before: {}, after: {} };
  for (const key of keys) {
    if (JSON.stringify(before[key] ?? null) === JSON.stringify(after[key] ?? null)) continue;
    changes.before[key] = before[key] ?? null;
    changes.after[key] = after[key] ?? null;
  }
  (res.locals as AdminAuditLocals).adminAuditChanges = changes;
}

export function redactAdminAuditBody(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > LONGUEUR_MAX_TEXTE ? `[${value.length} caractères]` : value;
  }
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if (Array.isArray(value)) {
    const items = value.slice(0, LONGUEUR_MAX_LISTE).map(redactAdminAuditBody);
    if (value.length > LONGUEUR_MAX_LISTE)
      items.push(`[${value.length - LONGUEUR_MAX_LISTE} éléments de plus]`);
    return items;
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    redacted[key] = CLES_SECRETES.test(key) && item != null ? VALEUR_MASQUEE : redactAdminAuditBody(item);
  }
  return redacted;
}

function getTarget(routePath: string | null, params: Record<string, string>, locals: AdminAuditLocals) {
  if (locals.adminAuditTarget) return locals.adminAuditTarget;
  if (routePath && CIBLE_PAR_ROUTE[routePath] && params.id) {
    return { type: CIBLE_PAR_ROUTE[routePath], id: params.id };
  }
  for (const [param, type] of Object.entries(CIBLE_PAR_PARAMETRE)) {
    if (params[param]) return { type, id: params[param] };
  }
  return null;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  if (typeof value === 'object' && !Object.keys(value).length) return undefined;
  return value as Prisma.InputJsonValue;
}

// Journalise chaque écriture faite depuis /admin, une fois la réponse envoyée, qu'elle ait réussi ou
// non. Monté après l'authentification admin : req.user est l'admin.
export function adminAuditLog(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!METHODES_JOURNALISEES.includes(req.method)) return next();
  const admin = req.user as User | undefined;
  if (!admin) return next();

  // La route et ses paramètres ne sont lisibles que pendant que la route répond : une erreur passée à
  // next() remonte hors du sous-routeur, qui remet req.params à zéro. On les lit donc au premier
  // res.status() ou res.send() de la route.
  let routePath: string | null = null;
  let params: Record<string, string> = {};
  const captureRoute = () => {
    if (routePath || !req.route?.path) return;
    routePath = req.route.path as string;
    params = { ...req.params };
  };
  const status = res.status.bind(res);
  res.status = (code) => {
    captureRoute();
    return status(code);
  };
  const send = res.send.bind(res);
  res.send = (body) => {
    captureRoute();
    return send(body);
  };

  res.on('finish', () => {
    const path = routePath ?? req.route?.path ?? null;
    if (path && ROUTES_NON_JOURNALISEES.includes(path)) return;
    const locals = res.locals as AdminAuditLocals;
    const target = getTarget(path, params, locals);
    prisma.adminAuditLog
      .create({
        data: {
          admin_user_id: admin.id,
          action: `${req.method} ${path ?? req.originalUrl.replace(/^\/admin/, '').split('?')[0]}`,
          target_type: target?.type ?? null,
          target_id: target?.id ?? null,
          params: toJson(params),
          body: toJson(redactAdminAuditBody(req.body)),
          before: toJson(locals.adminAuditChanges?.before),
          after: toJson(locals.adminAuditChanges?.after),
          status_code: res.statusCode,
          ip: req.ip ?? null,
          user_agent: req.headers['user-agent'] ?? null,
        },
      })
      .catch((error) => capture(error, { extra: { action: path, admin_user_id: admin.id } }));
  });

  next();
}
