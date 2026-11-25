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
import type { AvecAliases } from '@app/services/trichine-alias';

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

export type LaboEchantillon = TrichineEchantillon & AvecAliases & { Carcasse: LaboCarcasseProjection };

export type LaboEchantillonDuPool = LaboEchantillon & { Documents: Array<TrichineDocument> };

export type LaboPool = TrichinePool &
  AvecAliases & {
    TrichineEchantillons: Array<LaboEchantillonDuPool>;
    EchantillonsRetires: Array<LaboEchantillonDuPool>;
    Documents: Array<TrichineDocument>;
  };

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
  LaboDestinataire &
  AvecAliases & {
    direction: LaboFTPDirection;
    carcasses_sans_ipm2: number;
    TrichinePoolFTPs: Array<TrichinePoolFTP & { TrichinePool: TrichinePool & AvecAliases }>;
  };

export type LaboFTPLiee = { numero_fiche: string; statut_logistique: TrichineStatutLogistiqueFTP };

export type LaboFTPConfirmation = LaboFTPLiee & { id: string; pool_ids: Array<string> };

export type FtpConfirmationCreee = { id: string; numero_fiche: string };

export type LaboFTPDetail = TrichineFTP &
  LaboExpediteur &
  LaboDestinataire &
  AvecAliases & {
    FTPParent: LaboFTPLiee | null;
    FTPChildren: Array<LaboFTPConfirmation>;
    TrichinePoolFTPs: Array<TrichinePoolFTP & { TrichinePool: LaboPool }>;
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

export function getLaboFTP(reference: string) {
  return API.get({ path: `/laboratoire/ftp/${reference}` }) as Promise<
    ApiResponse<{
      ftp: LaboFTPDetail;
      historique: Array<TrichineHistoriqueStatut>;
      direction: LaboFTPDirection;
    }>
  >;
}

export function corrigerResultatPool(
  poolId: string,
  body: {
    resultat_analyse: TrichineResultatAnalyse;
    parasite_identifie?: string;
    nombre_larves?: number;
    date_debut_analyse?: string;
    date_fin_analyse?: string;
    reference_labo?: string;
    commentaire?: string;
    date_envoi_lnr?: string;
    mode_transport_lnr?: string;
    conditions_conservation_lnr?: string;
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
    nombre_larves?: number;
    date_debut_analyse?: string;
    date_fin_analyse?: string;
    reference_labo?: string;
    commentaire?: string;
    date_envoi_lnr?: string;
    mode_transport_lnr?: string;
    conditions_conservation_lnr?: string;
  }
) {
  return API.post({ path: `/laboratoire/pool/${poolId}/resultat`, body }) as Promise<
    ApiResponse<{ pool: TrichinePool; ftp_confirmation: FtpConfirmationCreee | null }>
  >;
}

export function refuserPool(poolId: string, raisonRefus: string) {
  return API.post({
    path: `/laboratoire/pool/${poolId}/refuser`,
    body: { raison_refus: raisonRefus },
  }) as Promise<ApiResponse<{ pool: TrichinePool }>>;
}

export function retirerEchantillonDuPoolLabo(echantillonId: string, motif: string) {
  return API.post({
    path: `/laboratoire/echantillon/${echantillonId}/retirer-du-pool`,
    body: { motif },
  }) as Promise<ApiResponse<Record<string, never>>>;
}

export const DOCUMENT_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_MAX_BYTES = 3.5 * 1024 * 1024;

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

export function deposerDocumentEchantillon(
  echantillonId: string,
  file: { content_type: string; content: string }
) {
  return API.post({ path: `/laboratoire/echantillon/${echantillonId}/documents`, body: { file } }) as Promise<
    ApiResponse<{ document: TrichineDocument }>
  >;
}

export function documentEchantillonPath(echantillonId: string, documentId: string) {
  return `/laboratoire/echantillon/${echantillonId}/document/${documentId}`;
}

export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function deposerPhotosLarveFTP(
  ftpId: string,
  files: Array<{ content_type: string; content: string }>
) {
  return API.post({ path: `/laboratoire/ftp/${ftpId}/photos`, body: { files } }) as Promise<
    ApiResponse<{ documents: Array<TrichineDocument> }>
  >;
}

export function documentFtpPath(ftpId: string, documentId: string) {
  return `/laboratoire/ftp/${ftpId}/document/${documentId}`;
}

export type LimsImportRow = {
  reference_pool: string;
  resultat_analyse: TrichineResultatAnalyse;
  parasite_identifie?: string;
  nombre_larves?: number;
  date_debut_analyse?: string;
  date_fin_analyse?: string;
  reference_labo?: string;
  commentaire?: string;
};

export function previewResultatsImport(body: { filename?: string; content: string }) {
  return API.post({ path: '/laboratoire/results/preview', body }) as Promise<LaboResultsPreviewResponse>;
}

export function importResultats(rows: Array<LimsImportRow>) {
  return API.post({
    path: '/laboratoire/results/import',
    body: { rows },
  }) as Promise<LaboResultsImportResponse>;
}

export type LaboEchantillonRegistre = LaboEchantillon & {
  TrichinePool: {
    reference_pool: string;
    statut: TrichineStatutAnalyse;
    resultat_analyse: TrichineResultatAnalyse | null;
  } | null;
};

export type LaboPoolRegistre = TrichinePool &
  AvecAliases & {
    TrichineEchantillons: Array<Omit<LaboEchantillon, 'Aliases'>>;
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
