import { PrismaClient } from "@prisma/client";
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient;
}
if (!global.__prisma) {
  global.__prisma = new PrismaClient();
}
global.__prisma
  .$connect()
  .then(() => {
    console.log("Connected to DB");
  })
  .then(async () => {
    // data migrations
  })
  .catch((e: Error) => {
    console.log("error connecting to DB");
    console.log(e);
  });

const prisma = global.__prisma;

export { prisma };
