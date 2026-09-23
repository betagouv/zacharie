// Annuaire des entreprises (API Recherche d'entreprises, data.gouv.fr).
// API publique sans clé, appelée directement depuis le navigateur.
// https://recherche-entreprises.api.gouv.fr/docs/

const SEARCH_URL = 'https://recherche-entreprises.api.gouv.fr/search';

export interface EtablissementTrouve {
  siret: string;
  raison_sociale: string;
  address_ligne_1: string;
  address_ligne_2: string;
  code_postal: string;
  ville: string;
}

interface ApiEtablissement {
  siret?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  libelle_commune?: string | null;
}

interface ApiResult {
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  matching_etablissements?: Array<ApiEtablissement> | null;
}

// l'API ne renvoie que l'adresse complète de l'établissement : on retire le code postal
// et la commune pour ne garder que le numéro et la voie
function getAddressLigne1(etablissement: ApiEtablissement): string {
  const adresse = (etablissement.adresse ?? '').trim();
  const suffixe = `${etablissement.code_postal ?? ''} ${etablissement.libelle_commune ?? ''}`.trim();
  if (suffixe && adresse.endsWith(suffixe)) {
    return adresse.slice(0, adresse.length - suffixe.length).trim();
  }
  return adresse;
}

function mapResult(result: ApiResult): EtablissementTrouve | null {
  const etablissement = result.matching_etablissements?.[0];
  const raison_sociale = result.nom_complet || result.nom_raison_sociale;
  if (!etablissement?.siret || !raison_sociale) {
    return null;
  }
  return {
    siret: etablissement.siret,
    raison_sociale,
    address_ligne_1: getAddressLigne1(etablissement),
    address_ligne_2: '',
    code_postal: etablissement.code_postal ?? '',
    ville: etablissement.libelle_commune ?? '',
  };
}

async function fetchEtablissements(query: string, signal?: AbortSignal): Promise<Array<EtablissementTrouve>> {
  const searchParams = new URLSearchParams({
    q: query,
    page: '1',
    per_page: '10',
    etat_administratif: 'A', // seulement les entreprises en activité
    minimal: 'true',
    include: 'matching_etablissements',
    limite_matching_etablissements: '1',
  });
  try {
    const response = await fetch(`${SEARCH_URL}?${searchParams.toString()}`, { signal });
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as { results?: Array<ApiResult> };
    return (data.results ?? [])
      .map(mapResult)
      .filter((etablissement): etablissement is EtablissementTrouve => etablissement !== null);
  } catch {
    // hors ligne, quota atteint ou requête annulée : la saisie manuelle reste possible
    return [];
  }
}

export function isSiret(value: string): boolean {
  return /^\d{14}$/.test(value.replace(/\s/g, ''));
}

export function searchEntreprises(query: string, signal?: AbortSignal): Promise<Array<EtablissementTrouve>> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return Promise.resolve([]);
  }
  return fetchEtablissements(trimmed, signal);
}

export async function getEtablissementBySiret(siret: string): Promise<EtablissementTrouve | null> {
  const cleaned = siret.replace(/\s/g, '');
  if (!isSiret(cleaned)) {
    return null;
  }
  const results = await fetchEtablissements(cleaned);
  return results.find((etablissement) => etablissement.siret === cleaned) ?? null;
}
