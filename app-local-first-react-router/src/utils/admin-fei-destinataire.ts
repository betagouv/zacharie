import type { FeiOwnerRole } from '@prisma/client';
import type { AdminFeiDestinataire } from '@api/src/types/responses';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
import { isRoleCircuitCourt } from '@app/utils/circuit-court';

export function formatOwner(label: string | null, role: FeiOwnerRole | null): string {
  if (!label && !role) return '—';
  if (!role) return label!;
  return `${label ?? '—'} (${getUserRoleLabel(role)})`;
}

// Un destinataire en circuit court ne prend jamais en charge dans Zacharie : la fiche lui est envoyée
// et le reste. Sinon, tant que next_owner est renseigné, la prise en charge est attendue.
export function getNextOwnerStatus(role: FeiOwnerRole): string {
  return isRoleCircuitCourt(role) ? 'envoyée' : 'en attente de prise en charge';
}

export function formatDestinataire(destinataire: AdminFeiDestinataire): string {
  if (destinataire.next_owner_role) {
    const nextOwner = formatOwner(destinataire.next_owner_label, destinataire.next_owner_role);
    return `${nextOwner} · ${getNextOwnerStatus(destinataire.next_owner_role)}`;
  }
  if (!destinataire.current_owner_label && !destinataire.current_owner_role) return '—';
  return `${formatOwner(destinataire.current_owner_label, destinataire.current_owner_role)} · détenteur actuel`;
}
