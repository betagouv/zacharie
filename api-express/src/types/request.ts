import type express from 'express';
import type { ApiKey, User } from '@prisma/client';

export interface RequestWithUser extends express.Request {
  user?: User;
  isAdmin?: boolean;
}

export interface RequestWithApiKey extends express.Request {
  apiKey?: ApiKey;
}
