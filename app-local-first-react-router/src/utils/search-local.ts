import dayjs from 'dayjs';
import { UserRoles, type User, type Carcasse, type CarcasseIntermediaire } from '@prisma/client';
import type { SearchResponse } from '@api/src/types/responses';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import type { FeiAndCarcasseAndIntermediaireIds } from '@app/types/carcasses-intermediaire';
import { isRoleCircuitCourt } from './circuit-court';
import { getTransmissionId, getTransmissionLinkFromCarcasse } from './get-transmission-id';

// All the data we need is already downloaded and scoped to the current user
// (load-carcasses returns only the carcasses/feis this user can read), so search
// runs entirely locally — no backend round-trip.

type RolePrefix = 'chasseur' | 'etg' | 'collecteur' | 'svi' | 'circuit-court';

function getRolePrefix(user: User): RolePrefix {
  const role = user.roles[0];
  if (role === UserRoles.ETG) return 'etg';
  if (role === UserRoles.COLLECTEUR_PRO) return 'collecteur';
  if (role === UserRoles.SVI) return 'svi';
  if (isRoleCircuitCourt(role)) return 'circuit-court';
  return 'chasseur';
}

function carcasseRedirectUrl(prefix: RolePrefix, carcasse: Carcasse): string {
  if (prefix === 'svi') {
    return `/app/svi/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`;
  }
  // ETG, collecteur et circuit-court naviguent vers une transmission (fiche + prochain détenteur), pas vers la fiche seule
  if (prefix === 'etg' || prefix === 'collecteur' || prefix === 'circuit-court') {
    return `/app/${prefix}/fei/${getTransmissionLinkFromCarcasse(carcasse)}`;
  }
  return `/app/${prefix}/fei/${carcasse.fei_numero}`;
}

function feiRedirectUrl(prefix: RolePrefix, numero: string): string {
  return `/app/${prefix}/fei/${numero}`;
}

function carcasseToResultItem(
  searchQuery: string,
  prefix: RolePrefix,
  carcasse: Carcasse,
  feis: Record<string, FeiWithIntermediaires>
): SearchResponse['data'][number] {
  const fei = feis[carcasse.fei_numero];
  return {
    searchQuery,
    redirectUrl: carcasseRedirectUrl(prefix, carcasse),
    carcasse_numero_bracelet: carcasse.numero_bracelet,
    carcasse_espece: carcasse.espece || '',
    carcasse_type: carcasse.type ?? '',
    fei_numero: carcasse.fei_numero,
    fei_date_mise_a_mort: fei?.date_mise_a_mort ? dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY') : '',
    fei_svi_assigned_at: fei?.svi_assigned_at ? dayjs(fei.svi_assigned_at).format('DD/MM/YYYY') : '',
    fei_commune_mise_a_mort: fei?.commune_mise_a_mort || '',
  };
}

// A carcasse is searchable unless it's deleted, refused or declared missing by an intermediaire.
function isCarcasseSearchable(carcasse: Carcasse): boolean {
  if (carcasse.deleted_at) return false;
  if (carcasse.intermediaire_carcasse_refus_intermediaire_id) return false;
  if (carcasse.intermediaire_carcasse_manquante) return false;
  return true;
}

export function searchLocally(
  searchQuery: string,
  user: User,
  carcasses: Record<string, Carcasse>,
  feis: Record<string, FeiWithIntermediaires>,
  carcassesIntermediaireById: Record<FeiAndCarcasseAndIntermediaireIds, CarcasseIntermediaire>
): SearchResponse {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return { ok: false, data: [], error: '' };
  }

  const prefix = getRolePrefix(user);
  const allCarcasses = Object.values(carcasses);

  // 1. Search by carcasse numero_bracelet
  const byBracelet = allCarcasses
    .filter(isCarcasseSearchable)
    .filter((carcasse) => carcasse.numero_bracelet?.toLowerCase().includes(query));

  if (byBracelet.length) {
    return {
      ok: true,
      data: byBracelet.map((carcasse) => carcasseToResultItem(searchQuery, prefix, carcasse, feis)),
      error: '',
    };
  }

  // 2. Search by carcasseIntermediaire commentaire, resolved to its carcasse
  const matchingZacharieIds = new Set(
    Object.values(carcassesIntermediaireById)
      .filter((ci) => ci.commentaire?.toLowerCase().includes(query))
      .map((ci) => ci.zacharie_carcasse_id)
  );

  if (matchingZacharieIds.size) {
    const byCommentaire = allCarcasses
      .filter(isCarcasseSearchable)
      .filter((carcasse) => matchingZacharieIds.has(carcasse.zacharie_carcasse_id));
    if (byCommentaire.length) {
      return {
        ok: true,
        data: byCommentaire.map((carcasse) => carcasseToResultItem(searchQuery, prefix, carcasse, feis)),
        error: '',
      };
    }
  }

  // 3. Search by FEI numero
  const byNumero = Object.values(feis).filter(
    (fei) => !fei.deleted_at && fei.numero?.toLowerCase().includes(query)
  );

  if (byNumero.length) {
    // ETG, collecteur, SVI et circuit-court naviguent vers une transmission : une même fiche peut se
    // diviser en plusieurs transmissions (Premier Détenteur dispatchant à plusieurs Prochains
    // Détenteurs), on émet donc un résultat par transmission, dérivé des carcasses.
    if (prefix === 'etg' || prefix === 'collecteur' || prefix === 'svi' || prefix === 'circuit-court') {
      const matchedNumeros = new Set(byNumero.map((fei) => fei.numero));
      const carcasseByTransmissionId: Record<string, Carcasse> = {};
      for (const carcasse of allCarcasses) {
        if (!matchedNumeros.has(carcasse.fei_numero)) continue;
        const transmissionId = getTransmissionId(carcasse);
        if (!carcasseByTransmissionId[transmissionId]) {
          carcasseByTransmissionId[transmissionId] = carcasse;
        }
      }
      return {
        ok: true,
        data: Object.values(carcasseByTransmissionId).map((carcasse) => {
          const fei = feis[carcasse.fei_numero];
          return {
            searchQuery,
            redirectUrl: `/app/${prefix}/fei/${getTransmissionLinkFromCarcasse(carcasse)}`,
            carcasse_numero_bracelet: '',
            carcasse_espece: '',
            carcasse_type: '' as const,
            fei_numero: carcasse.fei_numero,
            fei_date_mise_a_mort: fei?.date_mise_a_mort
              ? dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY')
              : '',
            fei_svi_assigned_at: fei?.svi_assigned_at ? dayjs(fei.svi_assigned_at).format('DD/MM/YYYY') : '',
            fei_commune_mise_a_mort: fei?.commune_mise_a_mort || '',
          };
        }),
        error: '',
      };
    }
    return {
      ok: true,
      data: byNumero.map((fei) => ({
        searchQuery,
        redirectUrl: feiRedirectUrl(prefix, fei.numero),
        carcasse_numero_bracelet: '',
        carcasse_espece: '',
        carcasse_type: '' as const,
        fei_numero: fei.numero,
        fei_date_mise_a_mort: fei.date_mise_a_mort ? dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY') : '',
        fei_svi_assigned_at: fei.svi_assigned_at ? dayjs(fei.svi_assigned_at).format('DD/MM/YYYY') : '',
        fei_commune_mise_a_mort: fei.commune_mise_a_mort || '',
      })),
      error: '',
    };
  }

  return {
    ok: true,
    data: [],
    error: 'Aucun élément ne correspond à votre recherche',
  };
}
