import type express from 'express';
import type { ApiKey, User } from '@prisma/client';
// import type { MatomoEvent } from './matomo-event';

export interface RequestWithUser extends express.Request {
  user?: User;
  isAdmin?: boolean;
}

export interface RequestWithApiKey extends express.Request {
  apiKey?: ApiKey;
}

// export interface RequestWithMatomoEvent extends express.Request {
//   body: {
//     event: MatomoEvent;
//     userId: User['matomo_id'];
//     dimensions?: string;
//   };
// }
