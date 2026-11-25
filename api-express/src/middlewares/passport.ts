import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import prisma from '~/prisma';
import { ApiKey, User } from '@prisma/client';
import type { Request } from 'express';
import { SECRET, PROCONNECT_ADMIN_DISABLED } from '~/config';
import { SESSION_COOKIE_NAME } from '~/utils/cookie';
import {
  hasValidProConnect,
  isTokenRevokedByPasswordChange,
  type SessionTokenPayload,
} from '~/utils/session-token';

type JwtPayload = SessionTokenPayload & { iat?: number };

export const PROCONNECT_REQUIRED = 'PROCONNECT_REQUIRED';

const cookieExtractor = (req: Request): string | null => {
  const token = req && req.cookies ? req.cookies[SESSION_COOKIE_NAME] : null;
  return token;
};

const bearerExtractor = (req: Request): string | null => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.substring('Bearer '.length);
  }
  return null;
};

const jwtOptions: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor, bearerExtractor]),
  secretOrKey: SECRET,
};

passport.use(
  'user',
  new JwtStrategy(
    jwtOptions,
    async (jwt_payload: JwtPayload, done: (error: Error | null, user: User | null) => void) => {
      try {
        if (!jwt_payload || typeof jwt_payload !== 'object') {
          return done(null, null);
        }

        if (!jwt_payload.userId) {
          return done(null, null);
        }

        const user = await prisma.user.findUnique({
          where: { id: jwt_payload.userId },
          include: { Password: { select: { password_changed_at: true } } },
        });

        if (user) {
          if (user.deleted_at) {
            return done(null, null);
          }
          const { Password, ...userWithoutPassword } = user;
          if (isTokenRevokedByPasswordChange(jwt_payload, Password?.password_changed_at)) {
            return done(null, null);
          }
          return done(null, userWithoutPassword);
        } else {
          return done(null, null);
        }
      } catch (error) {
        return done(error as Error, null);
      }
    }
  )
);

passport.use(
  'admin',
  new JwtStrategy(
    jwtOptions,
    async (
      jwt_payload: JwtPayload,
      done: (error: Error | null, user: User | null | false, info?: { code: string }) => void
    ) => {
      try {
        if (!jwt_payload || typeof jwt_payload !== 'object') {
          return done(null, null);
        }

        if (!jwt_payload.userId) {
          return done(null, null);
        }

        const user = await prisma.user.findUnique({
          where: { id: jwt_payload.userId, isZacharieAdmin: true, deleted_at: null },
          include: { Password: { select: { password_changed_at: true } } },
        });

        if (!user) {
          return done(null, null);
        }

        const { Password, ...userWithoutPassword } = user;
        if (isTokenRevokedByPasswordChange(jwt_payload, Password?.password_changed_at)) {
          return done(null, null);
        }

        if (!PROCONNECT_ADMIN_DISABLED && !hasValidProConnect(jwt_payload)) {
          return done(null, false, { code: PROCONNECT_REQUIRED });
        }

        return done(null, userWithoutPassword);
      } catch (error) {
        return done(error as Error, null);
      }
    }
  )
);

passport.use(
  'apiKey',
  new HeaderAPIKeyStrategy(
    { header: 'Authorization', prefix: 'Bearer ' },
    true,
    async (
      apiKey: string,
      done: (error: Error | null, apiKey?: ApiKey, info?: any) => void,
      req: Request
    ) => {
      try {
        const key = await prisma.apiKey.findFirst({
          where: {
            private_key: apiKey,
            active: true,
            deleted_at: null,
            OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
          },
        });

        if (!key) {
          return done(null, undefined);
        }

        await prisma.apiKey.update({
          where: { id: key.id },
          data: { last_used_at: new Date() },
        });

        await prisma.apiKeyLog.create({
          data: {
            api_key_id: key.id,
            action: 'USED',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            endpoint: req.originalUrl,
          },
        });

        return done(null, key);
      } catch (error) {
        console.error('Error in Passport strategy:', error);
        return done(error as Error);
      }
    }
  )
);
