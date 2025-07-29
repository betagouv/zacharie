import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import prisma from '~/prisma';
import { ApiKeyLog, User } from '@prisma/client';
import type { Request } from 'express';
import { SECRET } from '~/config';

interface JwtPayload {
  userId: string;
}

const cookieExtractor = (req: Request): string | null => {
  // console.log('Cookies extractor called', req.cookies);
  const token = req && req.cookies ? req.cookies['zacharie_express_jwt'] : null;
  // console.log('Extracted token:', token);
  // console.log('Secret key', SECRET);
  return token;
};

const jwtOptions: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
  secretOrKey: SECRET,
};

passport.use(
  'user',
  new JwtStrategy(
    jwtOptions,
    async (jwt_payload: JwtPayload, done: (error: Error | null, user: User | null) => void) => {
      // console.log('JWT Strategy called');
      // console.log('JWT payload:', jwt_payload);

      try {
        if (!jwt_payload || typeof jwt_payload !== 'object') {
          // console.log('Invalid JWT payload');
          return done(null, null);
        }

        if (!jwt_payload.userId) {
          // console.log('No userId in JWT payload');
          return done(null, null);
        }

        // console.log('Attempting to find user with ID:', jwt_payload.userId);
        const user = await prisma.user.findUnique({
          where: { id: jwt_payload.userId },
        });

        if (user) {
          // console.log('User found:', user.email);
          // console.log('User found:', user.id);
          if (user.deleted_at) {
            // console.log('User has been deleted');
            return done(null, null);
          }
          // console.log('Authentication successful');
          return done(null, user);
        } else {
          // console.log('User not found in database');
          return done(null, null);
        }
      } catch (error) {
        // console.error('Error in Passport strategy:', error);
        return done(error as Error, null);
      }
    },
  ),
);

passport.use(
  'apiKeyLog',
  new HeaderAPIKeyStrategy(
    { header: 'Authorization', prefix: 'Api-Key ' },
    true,
    async (
      apiKey: string,
      done: (error: Error | null, apiKeyLog?: ApiKeyLog, info?: any) => void,
      req: Request,
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

        const log = await prisma.apiKeyLog.create({
          data: {
            api_key_id: key.id,
            action: 'USED',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            endpoint: req.originalUrl,
          },
        });

        // Pass the log as the second parameter
        return done(null, log);
      } catch (error) {
        return done(error as Error);
      }
    },
  ),
);
