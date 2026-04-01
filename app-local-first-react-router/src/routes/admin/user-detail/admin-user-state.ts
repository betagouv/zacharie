import type { AdminUserDataResponse } from '@api/src/types/responses';
import { UserNotifications, UserEtgRoles } from '@prisma/client';
import API from '@app/services/api';

export const loadAdminUserData = (userId: string): Promise<AdminUserDataResponse> =>
  API.get({ path: `admin/user/${userId}` }).then((res) => res as AdminUserDataResponse);

export type AdminUserDetailState = NonNullable<AdminUserDataResponse['data']>;

export const adminUserDetailInitialState: AdminUserDetailState = {
  user: {
    id: '',
    email: '',
    nom_de_famille: '',
    prenom: '',
    telephone: '',
    addresse_ligne_1: '',
    checked_has_asso_de_chasse: null,
    checked_has_ccg: null,
    checked_has_partenaires: null,
    addresse_ligne_2: '',
    code_postal: '',
    ville: '',
    activated: true,
    roles: [],
    role: null,
    isZacharieAdmin: false,
    etg_role: UserEtgRoles.RECEPTION,
    est_forme_a_l_examen_initial: false,
    numero_cfei: '',
    at_least_one_fei_treated: null,
    user_entities_vivible_checkbox: false,
    prochain_bracelet_a_utiliser: 1,
    created_at: new Date(),
    updated_at: new Date(),
    activated_at: null,
    last_login_at: null,
    last_seen_at: null,
    deleted_at: null,
    onboarded_at: null,
    notifications: [UserNotifications.EMAIL, UserNotifications.PUSH],
    web_push_tokens: [],
    native_push_tokens: [],
    brevo_contact_id: null,
    prefilled: false,
    is_synced: true,
    onboarding_chasse_info_done_at: null,
  },
  identityDone: false,
  examinateurDone: false,
  allEntities: [],
  userEntitiesRelations: [],
  officialCfei: null,
};

export function formatAdminUserDate(d: Date | string | null | undefined): string {
  if (d == null) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}
