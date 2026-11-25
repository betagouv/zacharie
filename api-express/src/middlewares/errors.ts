import { type CustomError } from '~/types/error';
import { capture, pickSafeHeaders } from '../third-parties/sentry.js';
import type express from 'express';
import type { RequestWithUser } from '~/types/request';
type MiddlewareFn<T extends express.Request> = (
  req: T,
  res: express.Response,
  next: express.NextFunction
) => Promise<void> | void;

function catchErrors<T extends express.Request>(fn: MiddlewareFn<T>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
}

const notFound = (
  req: express.Request | RequestWithUser,
  _res: express.Response,
  next: express.NextFunction
) => {
  const url = req.protocol + '://' + req.get('host') + req.originalUrl;
  const customError = new Error(`Url not Found : ${url}`) as CustomError;
  customError.status = 404;
  next(customError);
};

const sendError = (
  err: CustomError,
  req: express.Request | RequestWithUser,
  res: express.Response,
  _next: express.NextFunction
) => {
  const { body, query, params, route, method, originalUrl, headers } = req;
  const { appversion, appbuild, appdevice } = headers;
  const status = (err as { status?: number }).status ?? (res.statusCode >= 400 ? res.statusCode : 500);
  const clientError =
    status < 500 ||
    ['request.aborted', 'entity.parse.failed', 'entity.too.large'].includes(
      (err as { type?: string }).type ?? ''
    );
  if (status === 401) {
    console.log(status, 'Unauthorized');
  } else if (process.env.NODE_ENV === 'test') {
    console.log(err);
  } else if (clientError) {
    console.log(status, (err as { type?: string }).type ?? '', method, originalUrl, err.message);
  } else {
    capture(err, {
      extra: {
        statusCode: status,
        body,
        query,
        params,
        route,
        method,
        originalUrl,
        appversion,
        appbuild,
        appdevice,
        headers: pickSafeHeaders(headers),
      },
      user: (req as RequestWithUser).user,
    });
  }

  if (err.message.includes("Can't reach database server") || status === 406 || status >= 500) {
    return res.status(status).send({
      ok: false,
      code: 'SERVER_ERROR',
      error: "Désolé, une erreur est survenue, l'équipe technique est prévenue.",
    });
  }
  return res.status(status).send({
    ok: false,
    code: 'APPLICATION_ERROR',
    error: err.message || err || "Désolé, une erreur est survenue, l'équipe technique est prévenue.",
  });
};

const errorHandlers = [sendError];

export { catchErrors, notFound, sendError, errorHandlers };
