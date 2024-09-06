import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from "passport-jwt";
import { prisma } from "~/db/prisma.server";
import { User } from "@prisma/client";
import type { Express, Request } from "express";

const SECRET_KEY = process.env.SECRET ?? "not-so-secret";

interface JwtPayload {
  userId: string;
}

export default function configurePassport(app: Express) {
  const cookieExtractor = (req: Request): string | null => {
    console.log("Cookies extractor called");
    const token = req && req.cookies ? req.cookies["Zacharie_session"] : null;
    console.log("Extracted token:", token);
    return token;
  };

  const jwtOptions: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
    secretOrKey: SECRET_KEY,
  };

  passport.use(
    "jwt",
    new JwtStrategy(
      jwtOptions,
      async (jwt_payload: JwtPayload, done: (error: Error | null, user?: User | false) => void) => {
        console.log("JWT Strategy called");
        console.log("JWT payload:", jwt_payload);

        try {
          if (!jwt_payload || typeof jwt_payload !== "object") {
            console.log("Invalid JWT payload");
            return done(null, false);
          }

          if (!jwt_payload.userId) {
            console.log("No userId in JWT payload");
            return done(null, false);
          }

          console.log("Attempting to find user with ID:", jwt_payload.userId);
          const user = await prisma.user.findUnique({
            where: { id: jwt_payload.userId },
          });

          if (user) {
            console.log("User found:", user.id);
            if (user.deleted_at) {
              console.log("User has been deleted");
              return done(null, false);
            }
            console.log("Authentication successful");
            return done(null, user);
          } else {
            console.log("User not found in database");
            return done(null, false);
          }
        } catch (error) {
          console.error("Error in Passport strategy:", error);
          return done(error as Error, false);
        }
      }
    )
  );

  app.use(passport.initialize());
  console.log("Passport strategy configured with options:", JSON.stringify(jwtOptions, null, 2));
}
