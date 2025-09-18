import express from 'express';
import { UserRoles } from '@prisma/client';
import { type RequestWithUser } from '~/types/request';

export async function authorizeUserOrAdmin(
  req: RequestWithUser,
  res: express.Response,
  next: express.NextFunction,
) {
  const user = req.user;
  if (!user) {
    const error = new Error('Unauthorized');
    res.status(403);
    return next(error);
  }

  const isAdmin = user.roles.includes(UserRoles.ADMIN);
  req.isAdmin = isAdmin;
  const userId = req.params.user_id;

  if (!userId) {
    // only admins can create new users this way
    if (!isAdmin) {
      const error = new Error('Unauthorized');
      res.status(403);
      return next(error);
    }
  }

  if (userId !== user.id && !isAdmin) {
    const error = new Error('Unauthorized');
    res.status(403);
    return next(error);
  }
  next();
}
