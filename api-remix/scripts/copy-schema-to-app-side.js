import fs from "fs-extra";
import path from "path";

const copyPrismaToApp = async () => {
  const sourcePath = path.resolve("./prisma");
  const destinationPath = path.resolve("../app/prisma");

  try {
    await fs.copy(sourcePath, destinationPath, {
      overwrite: true,
      errorOnExist: false,
    });
    console.log("Prisma folder successfully copied to app folder");
  } catch (err) {
    console.error("Error copying Prisma folder:", err);
  }
};

copyPrismaToApp();
