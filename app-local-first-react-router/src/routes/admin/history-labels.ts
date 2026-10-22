import type { AdminHistoryKind, AdminHistorySubjectType } from '@api/src/types/admin-history';

export const HISTORY_KINDS: Array<{ value: AdminHistoryKind; label: string; className: string }> = [
  { value: 'modification', label: 'Modification', className: 'bg-blue-100 text-blue-800' },
  { value: 'suppression', label: 'Suppression', className: 'bg-red-100 text-red-800' },
  { value: 'action', label: 'Action', className: 'bg-green-100 text-green-800' },
  { value: 'notification', label: 'Notification', className: 'bg-yellow-100 text-yellow-800' },
  { value: 'admin', label: 'Action admin', className: 'bg-purple-100 text-purple-800' },
];

export const HISTORY_SUBJECT_TYPES: Array<{ value: AdminHistorySubjectType; label: string }> = [
  { value: 'fei', label: 'Fiche' },
  { value: 'carcasse', label: 'Carcasse' },
  { value: 'carcasse_intermediaire', label: 'Ligne intermédiaire' },
  { value: 'user', label: 'Utilisateur' },
  { value: 'entity', label: 'Entité' },
  { value: 'user_entity', label: 'Rattachement' },
];
