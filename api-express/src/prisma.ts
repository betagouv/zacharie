import { PrismaClient } from '@prisma/client';
import { omit } from '~/prisma-omit';

type ZacharieClient = PrismaClient<{ omit: typeof omit }>;

let prisma: ZacharieClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({ omit });
} else {
  const globalWithPrisma = global as typeof globalThis & {
    prisma: ZacharieClient;
  };
  if (!globalWithPrisma.prisma) {
    globalWithPrisma.prisma = new PrismaClient({
      omit,
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    });
  }
  prisma = globalWithPrisma.prisma;
}

export default prisma;
