import express from 'express';
import type { User, UserRoles } from '@prisma/client';

export default function validateUser(roles: Array<UserRoles> = []) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user: User = req.user;
    let canAccess = false;
    for (const role of roles) {
      for (const userRole of user.roles) {
        if (userRole === role) {
          canAccess = true;
        }
      }
    }
    if (!canAccess) {
      const error = new Error('Unauthorized');
      res.status(403); // using response here
      return next(error);
    }
    next();
  };
}
