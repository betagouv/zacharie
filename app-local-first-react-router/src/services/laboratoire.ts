import type {
  TrichineDocument,
  TrichineEchantillon,
  TrichineFTP,
  TrichinePool,
  TrichinePoolFTP,
  TrichineResultatAnalyse,
} from '@prisma/client';
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

export type LaboPool = TrichinePool & {
  TrichineEchantillons: Array<LaboEchantillon>;
  Documents: Array<TrichineDocument>;
};

export type LaboFTPListItem = TrichineFTP &
  LaboExpediteur & {
    TrichinePoolFTPs: Array<TrichinePoolFTP & { TrichinePool: TrichinePool }>;
  };

export type LaboFTPDetail = TrichineFTP &
  LaboExpediteur & {
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

export function getLaboFTP(ftpId: string) {
  return API.get({ path: `/laboratoire/ftp/${ftpId}` }) as Promise<ApiResponse<{ ftp: LaboFTPDetail }>>;
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
