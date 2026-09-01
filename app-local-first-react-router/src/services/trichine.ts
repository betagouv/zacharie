import type {
  Carcasse,
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

/**
 * Appels API trichine (cf doc/trichine.md §10.3).
 * Pas de local-first ici : les analyses trichine nécessitent d'être en ligne
 * (les résultats viennent des laboratoires), on interroge le serveur directement.
 */

type ApiResponse<T> = { ok: boolean; data: T | null; error: string };

export type TrichineCarcasseProjection = Pick<
  Carcasse,
  'zacharie_carcasse_id' | 'numero_bracelet' | 'espece' | 'date_mise_a_mort'
> & { fei_numero?: string; Fei?: { commune_mise_a_mort: string | null } };

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

export type TrichineFTPLight = TrichineFTP & {
  DestinataireEntity: Pick<TrichineLaboratoire, 'id' | 'nom_d_usage' | 'raison_sociale'> & {
    is_lnr: boolean;
  };
};

export type TrichineEchantillonAvecCarcasse = TrichineEchantillon & {
  Carcasse: TrichineCarcasseProjection;
};

export type TrichineFTPDetail = TrichineFTP & {
  DestinataireEntity: TrichineLaboratoire & { is_lnr: boolean };
  FTPParent: { numero_fiche: string } | null;
  FTPChildren: Array<{ numero_fiche: string; statut_logistique: TrichineStatutLogistiqueFTP }>;
  TrichinePoolFTPs: Array<
    TrichinePoolFTP & {
      TrichinePool: TrichinePool & {
        TrichineEchantillons: Array<TrichineEchantillonAvecCarcasse>;
        Documents: Array<TrichineDocument>;
      };
    }
  >;
  Documents: Array<TrichineDocument>;
};

export type TrichineEchantillonDetail = TrichineEchantillonAvecCarcasse & {
  TrichinePool:
    | (TrichinePool & { TrichinePoolFTPs: Array<TrichinePoolFTP & { TrichineFTP: TrichineFTPLight }> })
    | null;
};

export type TrichinePoolDetail = TrichinePool & {
  TrichineEchantillons: Array<TrichineEchantillonAvecCarcasse>;
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

/**
 * Prélèvement en lot (assistant SVI) : tout ou rien côté serveur, un échantillon par carcasse.
 */
export function createTrichineEchantillonsBulk(body: {
  echantillons: Array<{
    zacharie_carcasse_id: string;
    site_prelevement: TrichineSitePrelevement;
    masse_grammes?: number;
    date_prelevement?: string;
  }>;
  /** INITIAL au prélèvement, COMPLEMENTAIRE / CONFIRMATION en 2e intention */
  type?: TrichineType;
  preleve_par_entity_id?: string;
  commentaire?: string;
}) {
  return API.post({ path: '/trichine/echantillons', body }) as Promise<
    ApiResponse<{ echantillons: Array<TrichineEchantillon> }>
  >;
}

/**
 * Édition / annulation : possible tant que l'objet n'est pas parti au laboratoire.
 * Le point de non-retour est l'envoi de la FTP — c'est le backend qui l'arbitre.
 */
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
  /** Renseigné pour un pool de 2e intention : fille du pool douteux, ou petite-fille */
  pool_parent_id?: string;
  commentaire?: string;
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

/** Fiche déjà envoyée : elle reste tracée, le laboratoire est prévenu, les pools se libèrent. */
export function annulerTrichineFTP(ftpId: string, raisonAnnulation: string) {
  return API.post({
    path: `/trichine/ftp/${ftpId}/annuler`,
    body: { raison_annulation: raisonAnnulation },
  }) as Promise<ApiResponse<{ ftp: TrichineFTP }>>;
}

export function getTrichineFTPs() {
  return API.get({ path: '/trichine/ftps' }) as Promise<ApiResponse<{ ftps: Array<TrichineFTPPopulated> }>>;
}

/**
 * Détails : adressés par la référence métier (E-/P-/F-…), pas par un uuid — l'URL de l'app
 * est ainsi copiable et correspond à ce que les laboratoires citent au téléphone.
 */
export function getTrichineFTP(reference: string) {
  return API.get({ path: `/trichine/ftp/${reference}` }) as Promise<
    ApiResponse<{ ftp: TrichineFTPDetail; historique: Array<TrichineHistoriqueStatut> }>
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
