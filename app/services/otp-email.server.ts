// import fs from "fs";
// import path from "path";
import type { User } from "@prisma/client";
// import { fileURLToPath } from "url";
// import { dirname } from "path";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

export const createOtpEmail = (user: User, otp: string) => {
  const emailAddress = user.email;
  if (!emailAddress) {
    throw new Error("No email provided for magic link");
  }
  const userExists = Boolean(user.firstName);

  const text = `
Voici votre code de confirmation pour Zacharie:

${otp}

${userExists ? `Heureux de vous voir de retour ${user.firstName} !` : `Bienvenue !`.trim()}

L'équipe de Zacharie

P.S. Si vous n'avez pas demandé à recevoir cet email, vous pouvez l'ignorer.
  `.trim();

  return {
    emails: [emailAddress],
    subject: `Code de connexion Zacharie 🐗 : ${otp}`,
    text,
    html: text,
  };
};
