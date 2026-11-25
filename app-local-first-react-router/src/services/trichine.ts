import type {
  Carcasse,
  EntityTypes,
  TrichineDocument,
  TrichineEchantillon,
  TrichineFTP,
  TrichineHistoriqueStatut,
  TrichineNotification,
  TrichinePool,
  TrichinePoolFTP,
  TrichineSitePrelevement,
  TrichineStatutLogistiqueFTP,
  TrichineType,
} from '@prisma/client';
import API from '@app/services/api';
import type { AvecAliases } from '@app/services/trichine-alias';

type ApiResponse<T> = { ok: boolean; data: T | null; error: string };

export type TrichineCarcasseProjection = Pick<
  Carcasse,
  'zacharie_carcasse_id' | 'numero_bracelet' | 'espece' | 'date_mise_a_mort' | 'trichine_retire_de_fei_at'
> & { fei_numero?: string; Fei?: { commune_mise_a_mort: string | null } };

export type TrichineEchantillonWithCarcasse = TrichineEchantillon &
  AvecAliases & {
    Carcasse: TrichineCarcasseProjection;
    TrichinePool: { reference_pool: string } | null;
  };

export type TrichinePoolFTPWithFTP = TrichinePoolFTP & { TrichineFTP: TrichineFTP };

export type TrichinePoolPopulated = TrichinePool &
  AvecAliases & {
    TrichineEchantillons: Array<TrichineEchantillon>;
    TrichinePoolFTPs: Array<TrichinePoolFTPWithFTP>;
    PoolsFilles: Array<TrichinePool>;
  };

export type TrichineFTPPopulated = TrichineFTP &
  AvecAliases & {
    DestinataireEntity: TrichineLaboratoire & { is_lnr: boolean };
    TrichinePoolFTPs: Array<TrichinePoolFTP & { TrichinePool: TrichinePool }>;
  };

export type TrichineFTPLight = TrichineFTP & {
  DestinataireEntity: Pick<TrichineLaboratoire, 'id' | 'nom_d_usage' | 'raison_sociale'> & {
    is_lnr: boolean;
  };
};

export type TrichineEchantillonAvecCarcasse = TrichineEchantillon &
  AvecAliases & {
    Carcasse: TrichineCarcasseProjection;
  };

export type TrichineFTPDetail = TrichineFTP &
  AvecAliases & {
    DestinataireEntity: TrichineLaboratoire & { is_lnr: boolean };
    ExpediteurEntity: {
      id: string;
      type: EntityTypes | null;
      nom_d_usage: string | null;
      raison_sociale: string | null;
    } | null;
    FTPParent: { numero_fiche: string } | null;
    FTPChildren: Array<{ numero_fiche: string; statut_logistique: TrichineStatutLogistiqueFTP }>;
    TrichinePoolFTPs: Array<
      TrichinePoolFTP & {
        TrichinePool: TrichinePool &
          AvecAliases & {
            TrichineEchantillons: Array<TrichineEchantillonAvecCarcasse>;
            Documents: Array<TrichineDocument>;
          };
      }
    >;
    Documents: Array<TrichineDocument>;
  };

export type TrichinePartieConcernee = { id: string; nom: string };

export type TrichineEchantillonDetail = TrichineEchantillonAvecCarcasse & {
  RetireDuPool: { reference_pool: string } | null;
  TrichinePool:
    | (TrichinePool & { TrichinePoolFTPs: Array<TrichinePoolFTP & { TrichineFTP: TrichineFTPLight }> })
    | null;
};

export type TrichinePoolDetail = TrichinePool &
  AvecAliases & {
    TrichineEchantillons: Array<TrichineEchantillonAvecCarcasse>;
    EchantillonsRetires: Array<
      Pick<
        TrichineEchantillon,
        'id' | 'reference_echantillon' | 'retire_par_labo_at' | 'retire_par_labo_motif'
      > & {
        Carcasse: { numero_bracelet: string };
      }
    >;
    TrichinePoolFTPs: Array<TrichinePoolFTP & { TrichineFTP: TrichineFTPLight }>;
    PoolParent: { reference_pool: string } | null;
    PoolsFilles: Array<Pick<TrichinePool, 'reference_pool' | 'statut' | 'resultat_analyse'>>;
    Documents: Array<TrichineDocument>;
  };

export type TrichineCarcasseView = Pick<
  Carcasse,
  | 'zacharie_carcasse_id'
  | 'premier_detenteur_user_id'
  | 'examinateur_initial_user_id'
  | 'trichine_action_requise'
  | 'trichine_retire_de_fei_at'
  | 'trichine_retire_de_fei_motif'
> & {
  TrichineEchantillons: Array<
    TrichineEchantillon & {
      TrichinePool: (TrichinePool & { TrichinePoolFTPs: Array<TrichinePoolFTPWithFTP> }) | null;
    }
  >;
};

export type TrichineLaboratoire = {
  id: string;
  nom_d_usage: string | null;
  raison_sociale: string | null;
  address_ligne_1: string | null;
  code_postal: string | null;
  ville: string | null;
};

export function getTrichineCarcasse(zacharieCarcasseId: string) {
  return API.get({
    path: `/trichine/carcasse/${zacharieCarcasseId}`,
  }) as Promise<ApiResponse<{ carcasse: TrichineCarcasseView; historique: Array<TrichineHistoriqueStatut> }>>;
}

export function createTrichineEchantillon(body: {
  zacharie_carcasse_id: string;
  site_prelevement: TrichineSitePrelevement;
  masse_grammes?: number;
  date_prelevement?: string;
  commentaire?: string;
}) {
  return API.post({ path: '/trichine/echantillon', body }) as Promise<
    ApiResponse<{ echantillon: TrichineEchantillon }>
  >;
}

export function createTrichineEchantillonsBulk(body: {
  echantillons: Array<{
    zacharie_carcasse_id: string;
    site_prelevement: TrichineSitePrelevement;
    masse_grammes?: number;
    date_prelevement?: string;
    alias?: string;
  }>;
  type?: TrichineType;
  preleve_par_entity_id?: string;
  commentaire?: string;
}) {
  return API.post({ path: '/trichine/echantillons', body }) as Promise<
    ApiResponse<{ echantillons: Array<TrichineEchantillon> }>
  >;
}

export function modifierTrichineEchantillon(
  echantillonId: string,
  body: {
    site_prelevement?: TrichineSitePrelevement;
    masse_grammes?: number;
    date_prelevement?: string;
    commentaire?: string;
  }
) {
  return API.put({ path: `/trichine/echantillon/${echantillonId}`, body }) as Promise<
    ApiResponse<{ echantillon: TrichineEchantillon }>
  >;
}

export function supprimerTrichineEchantillon(echantillonId: string) {
  return API.delete({ path: `/trichine/echantillon/${echantillonId}` }) as Promise<
    ApiResponse<Record<string, never>>
  >;
}

export function retirerEchantillonDuPool(echantillonId: string) {
  return API.post({
    path: `/trichine/echantillon/${echantillonId}/retirer-du-pool`,
    body: {},
  }) as Promise<ApiResponse<Record<string, never>>>;
}

export function getTrichineEchantillons({ sansPool = false }: { sansPool?: boolean } = {}) {
  return API.get({
    path: '/trichine/echantillons',
    query: sansPool ? { sans_pool: 'true' } : {},
  }) as Promise<ApiResponse<{ echantillons: Array<TrichineEchantillonWithCarcasse> }>>;
}

export function createTrichinePool(body: {
  echantillon_ids: Array<string>;
  pool_parent_id?: string;
  commentaire?: string;
  alias?: string;
}) {
  return API.post({ path: '/trichine/pool', body }) as Promise<ApiResponse<{ pool: TrichinePool }>>;
}

export function modifierTrichinePool(
  poolId: string,
  body: { echantillon_ids?: Array<string>; date_constitution?: string; commentaire?: string }
) {
  return API.put({ path: `/trichine/pool/${poolId}`, body }) as Promise<ApiResponse<{ pool: TrichinePool }>>;
}

export function supprimerTrichinePool(poolId: string) {
  return API.delete({ path: `/trichine/pool/${poolId}` }) as Promise<ApiResponse<Record<string, never>>>;
}

export function getTrichinePools() {
  return API.get({ path: '/trichine/pools' }) as Promise<
    ApiResponse<{ pools: Array<TrichinePoolPopulated> }>
  >;
}

export function createTrichineFTP(body: {
  pool_ids: Array<string>;
  destinataire_entity_id: string;
  expediteur_entity_id?: string;
  mode_transport?: string;
  commentaire?: string;
  alias?: string;
}) {
  return API.post({ path: '/trichine/ftp', body }) as Promise<ApiResponse<{ ftp: TrichineFTP }>>;
}

export function envoyerTrichineFTP(ftpId: string) {
  return API.post({ path: `/trichine/ftp/${ftpId}/envoyer`, body: {} }) as Promise<
    ApiResponse<{ ftp: TrichineFTP }>
  >;
}

export function modifierTrichineFTP(
  ftpId: string,
  body: {
    destinataire_entity_id?: string;
    pool_ids?: Array<string>;
    mode_transport?: string;
    commentaire?: string;
  }
) {
  return API.put({ path: `/trichine/ftp/${ftpId}`, body }) as Promise<ApiResponse<{ ftp: TrichineFTP }>>;
}

export function supprimerTrichineFTP(ftpId: string) {
  return API.delete({ path: `/trichine/ftp/${ftpId}` }) as Promise<ApiResponse<Record<string, never>>>;
}

export function annulerTrichineFTP(ftpId: string, raisonAnnulation: string) {
  return API.post({
    path: `/trichine/ftp/${ftpId}/annuler`,
    body: { raison_annulation: raisonAnnulation },
  }) as Promise<ApiResponse<{ ftp: TrichineFTP }>>;
}

export function getTrichineFTPs() {
  return API.get({ path: '/trichine/ftps' }) as Promise<ApiResponse<{ ftps: Array<TrichineFTPPopulated> }>>;
}

export function getTrichineFTP(reference: string) {
  return API.get({ path: `/trichine/ftp/${reference}` }) as Promise<
    ApiResponse<{
      ftp: TrichineFTPDetail;
      historique: Array<TrichineHistoriqueStatut>;
      etgs: Array<TrichinePartieConcernee>;
    }>
  >;
}

export function getTrichineEchantillon(reference: string) {
  return API.get({ path: `/trichine/echantillon/${reference}` }) as Promise<
    ApiResponse<{ echantillon: TrichineEchantillonDetail; historique: Array<TrichineHistoriqueStatut> }>
  >;
}

export function getTrichinePool(reference: string) {
  return API.get({ path: `/trichine/pool/${reference}` }) as Promise<
    ApiResponse<{ pool: TrichinePoolDetail; historique: Array<TrichineHistoriqueStatut> }>
  >;
}

export function getTrichineLaboratoires() {
  return API.get({ path: '/trichine/laboratoires' }) as Promise<
    ApiResponse<{ laboratoires: Array<TrichineLaboratoire> }>
  >;
}

export function getTrichineNotifications() {
  return API.get({ path: '/trichine/notifications' }) as Promise<
    ApiResponse<{ notifications: Array<TrichineNotification> }>
  >;
}
