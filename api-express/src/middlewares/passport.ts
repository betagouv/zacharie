import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import prisma from '~/prisma';
import { User } from '@prisma/client';
import type { Express, Request } from 'express';
import { SECRET } from '~/config';

interface JwtPayload {
  userId: string;
}

export default function configurePassport(app: Express) {
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

  app.use(passport.initialize());
}
