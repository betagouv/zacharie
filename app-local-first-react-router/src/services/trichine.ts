import type {
  Carcasse,
  TrichineEchantillon,
  TrichineFTP,
  TrichineHistoriqueStatut,
  TrichineNotification,
  TrichinePool,
  TrichinePoolFTP,
  TrichineSitePrelevement,
} from '@prisma/client';
import API from '@app/services/api';

/**
 * Appels API trichine (cf doc/trichine.md §10.3).
 * Pas de local-first ici : les analyses trichine nécessitent d'être en ligne
 * (les résultats viennent des laboratoires), on interroge le serveur directement.
 */

type ApiResponse<T> = { ok: boolean; data: T | null; error: string };

export type TrichineCarcasseProjection = Pick<
  Carcasse,
  'zacharie_carcasse_id' | 'numero_bracelet' | 'espece' | 'date_mise_a_mort'
> & { Fei?: { commune_mise_a_mort: string | null } };

export type TrichineEchantillonWithCarcasse = TrichineEchantillon & {
  Carcasse: TrichineCarcasseProjection;
  TrichinePool: { reference_pool: string } | null;
};

export type TrichinePoolFTPWithFTP = TrichinePoolFTP & { TrichineFTP: TrichineFTP };

export type TrichinePoolPopulated = TrichinePool & {
  TrichineEchantillons: Array<TrichineEchantillon>;
  TrichinePoolFTPs: Array<TrichinePoolFTPWithFTP>;
  PoolsFilles: Array<TrichinePool>;
};

export type TrichineFTPPopulated = TrichineFTP & {
  DestinataireEntity: TrichineLaboratoire & { is_lnr: boolean };
  TrichinePoolFTPs: Array<TrichinePoolFTP & { TrichinePool: TrichinePool }>;
};

export type TrichineFTPDetail = TrichineFTP & {
  DestinataireEntity: TrichineLaboratoire & { is_lnr: boolean };
  TrichinePoolFTPs: Array<
    TrichinePoolFTP & { TrichinePool: TrichinePool & { TrichineEchantillons: Array<TrichineEchantillon> } }
  >;
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

export function getTrichineEchantillons({ sansPool = false }: { sansPool?: boolean } = {}) {
  return API.get({
    path: '/trichine/echantillons',
    query: sansPool ? { sans_pool: 'true' } : {},
  }) as Promise<ApiResponse<{ echantillons: Array<TrichineEchantillonWithCarcasse> }>>;
}

export function createTrichinePool(body: { echantillon_ids: Array<string>; commentaire?: string }) {
  return API.post({ path: '/trichine/pool', body }) as Promise<ApiResponse<{ pool: TrichinePool }>>;
}

export function getTrichinePools() {
  return API.get({ path: '/trichine/pools' }) as Promise<
    ApiResponse<{ pools: Array<TrichinePoolPopulated> }>
  >;
}

export function renoncerDeuxiemeIntention(poolId: string) {
  return API.post({ path: `/trichine/pool/${poolId}/renoncer-2e-intention`, body: {} }) as Promise<
    ApiResponse<{ retirees: number }>
  >;
}

export function createTrichineFTP(body: {
  pool_ids: Array<string>;
  destinataire_entity_id: string;
  mode_transport?: string;
  commentaire?: string;
}) {
  return API.post({ path: '/trichine/ftp', body }) as Promise<ApiResponse<{ ftp: TrichineFTP }>>;
}

export function envoyerTrichineFTP(ftpId: string) {
  return API.post({ path: `/trichine/ftp/${ftpId}/envoyer`, body: {} }) as Promise<
    ApiResponse<{ ftp: TrichineFTP }>
  >;
}

export function getTrichineFTPs() {
  return API.get({ path: '/trichine/ftps' }) as Promise<ApiResponse<{ ftps: Array<TrichineFTPPopulated> }>>;
}

export function getTrichineFTP(ftpId: string) {
  return API.get({ path: `/trichine/ftp/${ftpId}` }) as Promise<ApiResponse<{ ftp: TrichineFTPDetail }>>;
}

export function getTrichineLaboratoires() {
  return API.get({ path: '/trichine/laboratoires' }) as Promise<
    ApiResponse<{ laboratoires: Array<TrichineLaboratoire> }>
  >;
}

export function retirerCarcasseDeFei(zacharieCarcasseId: string, motif: string) {
  return API.post({ path: `/carcasse/${zacharieCarcasseId}/retirer-de-fei`, body: { motif } }) as Promise<
    ApiResponse<{ carcasse: Carcasse }>
  >;
}

export function getTrichineNotifications() {
  return API.get({ path: '/trichine/notifications' }) as Promise<
    ApiResponse<{ notifications: Array<TrichineNotification> }>
  >;
}
