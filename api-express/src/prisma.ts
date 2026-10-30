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
    // globalWithPrisma.prisma.$on('query', (e) => {
    //   console.log(formatSQLQueryWithParams(e));
    // });
    // function formatSQLQueryWithParams(queryOutput: any) {
    //   const { query, params } = queryOutput;

    //   let formattedParams = JSON.parse(params);
    //   let finalQuery = query;

    //   for (let i = 0; i < formattedParams.length; i++) {
    //     finalQuery = finalQuery.replace(`$${i + 1}`, `'${formattedParams[i]}'`);
    //   }

    //   return finalQuery;
    // }
  }
  prisma = globalWithPrisma.prisma;
}

export default prisma;
