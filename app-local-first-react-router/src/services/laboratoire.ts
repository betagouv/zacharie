import type {
  TrichineHistoriqueStatut,
  TrichineDocument,
  TrichineEchantillon,
  TrichineFTP,
  TrichinePool,
  TrichinePoolFTP,
  TrichineResultatAnalyse,
  TrichineStatutAnalyse,
  TrichineStatutLogistiqueFTP,
} from '@prisma/client';
import type { LaboResultsImportResponse, LaboResultsPreviewResponse } from '@api/src/types/responses';
import API from '@app/services/api';

/**
 * Appels API de l'espace laboratoire (LVD / LNR, cf doc/trichine.md §6.3-6.4).
 * Le backend renvoie une projection stricte des carcasses (§10.2).
 */

type ApiResponse<T> = { ok: boolean; data: T | null; error: string };

export type LaboEntity = {
  id: string;
  nom_d_usage: string | null;
  raison_sociale: string | null;
  siret: string | null;
  address_ligne_1: string | null;
  address_ligne_2: string | null;
  code_postal: string | null;
  ville: string | null;
  is_lnr: boolean;
};

export type LaboExpediteur = {
  ExpediteurUser: {
    prenom: string | null;
    nom_de_famille: string | null;
    email: string | null;
    telephone: string | null;
  };
  ExpediteurEntity: {
    nom_d_usage: string | null;
    raison_sociale: string | null;
    address_ligne_1: string | null;
    code_postal: string | null;
    ville: string | null;
  } | null;
};

export type LaboCarcasseProjection = {
  numero_bracelet: string;
  espece: string | null;
  date_mise_a_mort: string | Date | null;
  Fei: { commune_mise_a_mort: string | null };
};

export type LaboEchantillon = TrichineEchantillon & { Carcasse: LaboCarcasseProjection };

/**
 * La référence interne appartient au laboratoire qui l'a attribuée : elle est portée en base par
 * le lien pool ↔ FTP. Le backend retire celle des autres laboratoires et projette sur le pool
 * celle du laboratoire connecté.
 */
export type LaboPoolFTPLien = Omit<TrichinePoolFTP, 'reference_labo'>;

export type LaboPool = TrichinePool & {
  reference_labo: string | null;
  TrichineEchantillons: Array<LaboEchantillon>;
  Documents: Array<TrichineDocument>;
};

/**
 * Sens de la fiche pour le laboratoire connecté : reçue d'un détenteur, ou envoyée par lui
 * au LNR pour confirmation d'un pool douteux.
 */
export type LaboFTPDirection = 'recue' | 'envoyee';

export type LaboDestinataire = {
  DestinataireEntity: {
    id: string;
    is_lnr: boolean;
    nom_d_usage: string | null;
    raison_sociale: string | null;
  };
};

export type LaboFTPListItem = TrichineFTP &
  LaboExpediteur &
  LaboDestinataire & {
    direction: LaboFTPDirection;
    /** Carcasses de la fiche sur lesquelles le SVI n'a pas encore statué (pas d'IPM2) */
    carcasses_sans_ipm2: number;
    TrichinePoolFTPs: Array<LaboPoolFTPLien & { TrichinePool: TrichinePool }>;
  };

/** Fiche liée : la fiche d'origine, ou la fiche de confirmation générée vers le LNR */
export type LaboFTPLiee = { numero_fiche: string; statut_logistique: TrichineStatutLogistiqueFTP };

export type LaboFTPDetail = TrichineFTP &
  LaboExpediteur &
  LaboDestinataire & {
    // Le backend ne renvoie que les fiches liées auxquelles le laboratoire a accès
    FTPParent: LaboFTPLiee | null;
    FTPChildren: Array<LaboFTPLiee>;
    TrichinePoolFTPs: Array<LaboPoolFTPLien & { TrichinePool: LaboPool }>;
    Documents: Array<TrichineDocument>;
  };

export function getLaboMe() {
  return API.get({ path: '/laboratoire/me' }) as Promise<
    ApiResponse<{ laboratoires: Array<LaboEntity>; isLnr: boolean }>
  >;
}

export function getLaboFTPs() {
  return API.get({ path: '/laboratoire/ftp' }) as Promise<ApiResponse<{ ftps: Array<LaboFTPListItem> }>>;
}

/** Détail par référence (F-…) : le numéro lu sur la fiche papier jointe au colis. */
export function getLaboFTP(reference: string) {
  return API.get({ path: `/laboratoire/ftp/${reference}` }) as Promise<
    ApiResponse<{
      ftp: LaboFTPDetail;
      historique: Array<TrichineHistoriqueStatut>;
      direction: LaboFTPDirection;
    }>
  >;
}

/**
 * Correction d'un résultat déjà rendu. Les gardes métier (IPM2 du SVI déjà posée, DOUTEUX
 * dont la confirmation LNR est partie) sont arbitrées par le backend, qui renvoie le motif
 * du refus dans `error`.
 */
export function corrigerResultatPool(
  poolId: string,
  body: {
    resultat_analyse: TrichineResultatAnalyse;
    parasite_identifie?: string;
    date_debut_analyse?: string;
    date_fin_analyse?: string;
    reference_labo?: string;
    commentaire?: string;
    raison: string;
  }
) {
  return API.post({ path: `/laboratoire/pool/${poolId}/corriger-resultat`, body }) as Promise<
    ApiResponse<{ pool: TrichinePool }>
  >;
}

export type LaboPoolDetail = LaboPool & {
  PoolParent: { reference_pool: string } | null;
  TrichinePoolFTPs: Array<{
    TrichineFTP: TrichineFTP &
      LaboExpediteur & {
        DestinataireEntity: {
          id: string;
          is_lnr: boolean;
          nom_d_usage: string | null;
          raison_sociale: string | null;
        };
      };
  }>;
};

/** Détail d'un pool reçu, par sa référence (celle imprimée sur la fiche du colis). */
export function getLaboPool(reference: string) {
  return API.get({ path: `/laboratoire/pool/${reference}` }) as Promise<
    ApiResponse<{
      pool: LaboPoolDetail;
      ftp: TrichineFTP & LaboExpediteur;
      historique: Array<TrichineHistoriqueStatut>;
    }>
  >;
}

export function receptionnerFTP(ftpId: string, dateReception?: string) {
  return API.post({
    path: `/laboratoire/ftp/${ftpId}/reception`,
    body: dateReception ? { date_reception: dateReception } : {},
  }) as Promise<ApiResponse<{ ftp: TrichineFTP }>>;
}

export function saisirResultatPool(
  poolId: string,
  body: {
    resultat_analyse: TrichineResultatAnalyse;
    parasite_identifie?: string;
    date_debut_analyse?: string;
    date_fin_analyse?: string;
    reference_labo?: string;
    commentaire?: string;
  }
) {
  return API.post({ path: `/laboratoire/pool/${poolId}/resultat`, body }) as Promise<
    ApiResponse<{ pool: TrichinePool }>
  >;
}

export function refuserPool(poolId: string, raisonRefus: string) {
  return API.post({
    path: `/laboratoire/pool/${poolId}/refuser`,
    body: { raison_refus: raisonRefus },
  }) as Promise<ApiResponse<{ pool: TrichinePool }>>;
}

/* -------------------------------------------------------------------------- */
/* Documents du pool (rapport d'analyse)                                        */
/* -------------------------------------------------------------------------- */

/** Formats acceptés par le stockage (cf api-express/src/utils/trichine-document-upload.ts) */
export const DOCUMENT_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_MAX_BYTES = 3.5 * 1024 * 1024;

/** Le serveur calcule la clé de stockage : on n'envoie que le contenu et son type. */
export function deposerDocumentPool(
  poolId: string,
  file: { content_type: string; content: string },
  type?: string
) {
  return API.post({ path: `/laboratoire/pool/${poolId}/documents`, body: { type, file } }) as Promise<
    ApiResponse<{ document: TrichineDocument }>
  >;
}

export function documentPoolPath(poolId: string, documentId: string) {
  return `/laboratoire/pool/${poolId}/document/${documentId}`;
}

// Import de résultats depuis un export LIMS (cf doc/trichine-import-lims.md)
export type LimsImportRow = {
  reference_pool: string;
  resultat_analyse: TrichineResultatAnalyse;
  parasite_identifie?: string;
  date_debut_analyse?: string;
  date_fin_analyse?: string;
  reference_labo?: string;
  commentaire?: string;
};

// content = fichier encodé en base64 (parsing + mapping côté serveur)
export function previewResultatsImport(body: { filename?: string; content: string }) {
  return API.post({ path: '/laboratoire/results/preview', body }) as Promise<LaboResultsPreviewResponse>;
}

export function importResultats(rows: Array<LimsImportRow>) {
  return API.post({
    path: '/laboratoire/results/import',
    body: { rows },
  }) as Promise<LaboResultsImportResponse>;
}

/* -------------------------------------------------------------------------- */
/* Registre : listes plates des échantillons / pools reçus par le labo          */
/* -------------------------------------------------------------------------- */

export type LaboEchantillonRegistre = LaboEchantillon & {
  TrichinePool: {
    reference_pool: string;
    statut: TrichineStatutAnalyse;
    resultat_analyse: TrichineResultatAnalyse | null;
  } | null;
};

export type LaboPoolRegistre = TrichinePool & {
  reference_labo: string | null;
  TrichineEchantillons: Array<LaboEchantillon>;
  PoolParent: { reference_pool: string } | null;
  TrichinePoolFTPs: Array<{ TrichineFTP: Pick<TrichineFTP, 'numero_fiche' | 'statut_logistique'> }>;
};

export function getLaboEchantillons() {
  return API.get({ path: '/laboratoire/echantillons' }) as Promise<
    ApiResponse<{ echantillons: Array<LaboEchantillonRegistre> }>
  >;
}

export function getLaboPools() {
  return API.get({ path: '/laboratoire/pools' }) as Promise<ApiResponse<{ pools: Array<LaboPoolRegistre> }>>;
}
