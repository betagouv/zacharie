import ShortUniqueId from "short-unique-id";
import { prisma } from "~/db/prisma.server";

export default async function createUserId() {
  const newId = new ShortUniqueId({ length: 5, dictionary: "alphanum_upper" }).randomUUID();
  const existingUser = await prisma.user.findUnique({ where: { id: newId } });
  if (existingUser) {
    return createUserId();
  }
  return newId;
}
