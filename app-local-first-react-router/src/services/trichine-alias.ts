import { useEffect, useState } from 'react';
import type { EntityTypes } from '@prisma/client';
import {
  TrichineStatutAnalyse,
  TrichineStatutLogistiqueFTP,
  type TrichineEchantillon,
  type TrichineFTP,
  type TrichinePool,
} from '@prisma/client';
import API from '@app/services/api';

/**
 * Références internes (alias) des échantillons, pools et FTP : chaque entité qui manipule
 * l'objet (SVI, LVD, LNR) peut lui donner la sienne, et tous les acteurs les voient.
 * Le backend arbitre les droits et le gel (cf api-express/src/controllers/trichine-alias.ts).
 */

type ApiResponse<T> = { ok: boolean; data: T | null; error: string };

export type TrichineAlias = {
  id: string;
  reference: string;
  entity_id: string;
  Entity: {
    id: string;
    type: EntityTypes | null;
    nom_d_usage: string | null;
    raison_sociale: string | null;
  };
};

export type AvecAliases = { Aliases: Array<TrichineAlias> };

export type TrichineAliasObjet = 'echantillon' | 'pool' | 'ftp';

export const TRICHINE_ALIAS_MAX_LENGTH = 50;

export function poserAlias(objet: TrichineAliasObjet, objetId: string, reference: string) {
  return API.put({ path: `/trichine-alias/${objet}/${objetId}`, body: { reference } }) as Promise<
    ApiResponse<{ alias: TrichineAlias }>
  >;
}

export function retirerAlias(objet: TrichineAliasObjet, objetId: string) {
  return API.delete({ path: `/trichine-alias/${objet}/${objetId}` }) as Promise<
    ApiResponse<Record<string, never>>
  >;
}

/**
 * Entités au nom desquelles l'utilisateur pose ses alias (son SVI ou son laboratoire).
 * Pas de cache module : il survivrait à une déconnexion (navigation sans rechargement).
 */
export function useMesEntitesAlias(): Array<string> {
  const [entityIds, setEntityIds] = useState<Array<string>>([]);
  useEffect(() => {
    let actif = true;
    (API.get({ path: '/trichine-alias/mes-entites' }) as Promise<ApiResponse<{ entity_ids: Array<string> }>>)
      .then((response) => {
        if (actif) setEntityIds(response.data?.entity_ids ?? []);
      })
      .catch(console.error);
    return () => {
      actif = false;
    };
  }, []);
  return entityIds;
}

export function monAlias(aliases: Array<TrichineAlias> | undefined, mesEntites: Array<string>) {
  return aliases?.find((alias) => mesEntites.includes(alias.entity_id)) ?? null;
}

export function nomEntiteAlias(alias: TrichineAlias): string {
  return alias.Entity.nom_d_usage || alias.Entity.raison_sociale || '—';
}

// « SVI 35 : A-12 · LVD 35 : 2026-87 »
export function formatAliases(aliases: Array<TrichineAlias> | undefined): string {
  return (aliases ?? []).map((alias) => `${nomEntiteAlias(alias)} : ${alias.reference}`).join(' · ');
}

/** Toutes les références d'un objet, pour la recherche libre des listes. */
export function aliasesRecherche(aliases: Array<TrichineAlias> | undefined): string {
  return (aliases ?? []).map((alias) => alias.reference).join(' ');
}

// Mêmes règles que le backend : figé une fois les analyses terminées, ou la FTP clôturée
export function aliasAnalysesFige(objet: Pick<TrichinePool | TrichineEchantillon, 'statut'>): boolean {
  return objet.statut === TrichineStatutAnalyse.ANALYSES_TERMINEES;
}

export function aliasFtpFige(ftp: Pick<TrichineFTP, 'statut_logistique' | 'statut_analytique'>): boolean {
  return (
    ftp.statut_logistique === TrichineStatutLogistiqueFTP.TRAITEE ||
    ftp.statut_logistique === TrichineStatutLogistiqueFTP.ANNULEE ||
    ftp.statut_analytique === TrichineStatutAnalyse.ANALYSES_TERMINEES
  );
}
