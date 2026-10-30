// Historique admin (voir utils/admin-history.ts)

export type AdminHistorySubjectType =
  | 'fei'
  | 'carcasse'
  | 'carcasse_intermediaire'
  | 'user'
  | 'entity'
  | 'user_entity';

// Pages de détail de l'admin vers lesquelles un événement peut renvoyer
export type AdminHistoryLinkType = 'fei' | 'carcasse' | 'user' | 'entity';

export type AdminHistoryKind = 'modification' | 'suppression' | 'action' | 'notification' | 'admin';

export type AdminHistoryChange = {
  field: string;
  before: unknown;
  after: unknown;
};

export type AdminHistoryEvent = {
  id: string;
  date: string;
  kind: AdminHistoryKind;
  title: string;
  author_id: string | null;
  author_email: string | null;
  subject: {
    type: AdminHistorySubjectType;
    id: string;
    label: string | null;
    link_type: AdminHistoryLinkType | null;
    link_id: string | null;
  };
  changes: Array<AdminHistoryChange>;
  details: unknown;
};

export interface AdminHistoryTimelineResponse {
  ok: boolean;
  data: { events: Array<AdminHistoryEvent>; truncated: boolean } | null;
  error: string;
}

export interface AdminHistoryPageResponse {
  ok: boolean;
  data: { events: Array<AdminHistoryEvent>; total: number } | null;
  error: string;
}
