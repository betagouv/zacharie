import { UserRoles } from '@prisma/client';
import { VITE_APP_URL } from '../config';

// URL de la fiche côté app, selon le rôle du destinataire. Le chasseur consulte la fiche entière ;
// les autres rôles consultent une transmission (fiche + prochain détenteur du premier détenteur).
export function getFeiUrlForRole(
  role: UserRoles | undefined,
  feiNumero: string,
  prochainDetenteurIdCache: string | null
): string {
  let url = VITE_APP_URL + '/';
  if (role === UserRoles.CHASSEUR) url += 'chasseur/';
  else if (role === UserRoles.SVI) url += 'svi/';
  else if (role === UserRoles.ETG) url += 'etg/';
  else if (role === UserRoles.COLLECTEUR_PRO) url += 'collecteur-pro/';
  else {
    throw new Error(`Unknown role in building fei url: ${role}`);
  }
  url += `fei/${feiNumero}`;
  if (role !== UserRoles.CHASSEUR) url += `/${prochainDetenteurIdCache}`;
  return url;
}
