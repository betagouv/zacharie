import { User } from "@prisma/client";
import type { SerializeFrom } from "@remix-run/node";

export function displayUserIdentity(user: SerializeFrom<User>, options?: { withCfei: boolean }): string {
  let display = `${user.prenom} ${user.nom_de_famille}
${user.addresse_ligne_1}${user.addresse_ligne_2 ? `\n${user.addresse_ligne_2}` : ""}
${user.code_postal} ${user.ville}
＠: ${user.email}
📞: ${user.telephone}`;

  if (options?.withCfei && user.numero_cfei) {
    display += `\nCFEI: ${user.numero_cfei}`;
  }
  return display;
}
