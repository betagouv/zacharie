/**
 * Fabrique un jeu de test trichine pour les laboratoires, en tapant l'API HTTP comme le ferait
 * l'application : connexion SVI, prélèvement en lot sur les sangliers arrivés chez l'ETG,
 * constitution des pools, création puis envoi des FTP. Aucune écriture directe en base — les
 * références E/P/F, les statuts, l'historique et les notifications sont ceux du backend.
 *
 * Usage (depuis api-express/) :
 *   API_URL=https://<api-preprod> SVI_PASSWORD='...' tsx ./scripts/seed-trichine-jeu-de-test-labos.ts --dry-run
 *   API_URL=https://<api-preprod> SVI_PASSWORD='...' tsx ./scripts/seed-trichine-jeu-de-test-labos.ts
 *
 * --dry-run affiche le plan et les carcasses disponibles sans rien créer.
 *
 * Variables :
 *   API_URL        (requis)  racine de l'API visée
 *   SVI_PASSWORD   (requis)  mot de passe du compte SVI
 *   SVI_EMAIL      (défaut svi@zacharie.beta.gouv.fr)
 *   MAX_CARCASSES  (option)  plafond de carcasses à prélever
 *
 * L'envoi d'une FTP notifie les utilisateurs du laboratoire destinataire par email, avec le PDF
 * de la fiche en pièce jointe : les comptes labo doivent avoir une adresse qui reçoit vraiment.
 */
import { TrichineSitePrelevement } from '@prisma/client';

const API_URL = process.env.API_URL;
const SVI_EMAIL = process.env.SVI_EMAIL;
const SVI_PASSWORD = process.env.SVI_PASSWORD;
const MAX_CARCASSES = process.env.MAX_CARCASSES ? Number(process.env.MAX_CARCASSES) : Infinity;
const DRY_RUN = process.argv.includes('--dry-run');

// Une FTP par ligne, avec la taille de chacun de ses pools. Le plan couvre ce que les labos
// doivent pouvoir rencontrer : un pool plein (19 carcasses, 95 g), des pools d'une seule
// carcasse, et une fiche à dix pools pour que l'import de résultats en CSV ait du sens.
const PLAN = [
  {
    labo: 'Labo 001',
    pools: [19, 19, 12, 7, 3, 1],
    mode_transport: 'Coursier',
    site: TrichineSitePrelevement.PILIER_DIAPHRAGME,
    commentaire: 'Arrivage du matin',
  },
  {
    labo: 'Labo 002',
    pools: [15, 9, 5, 2],
    mode_transport: 'Coursier',
    site: TrichineSitePrelevement.PILIER_DIAPHRAGME,
    commentaire: 'Arrivage du matin',
  },
  {
    labo: 'Labo 001',
    pools: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    mode_transport: 'Transporteur',
    site: TrichineSitePrelevement.LANGUE,
    commentaire: 'Lot destiné au test import CSV',
  },
  {
    labo: 'Labo 002',
    pools: [19, 8],
    mode_transport: 'Transporteur',
    site: TrichineSitePrelevement.MEMBRE_ANTERIEUR,
    commentaire: 'Arrivage de l’après-midi',
  },
];

type ApiResponse<T> = { ok: boolean; data: T; error?: string };

let token = '';

async function api<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !json?.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${json?.error ?? response.statusText}`);
  }
  return json.data;
}

type CarcasseAVenir = { zacharie_carcasse_id: string; numero_bracelet: string; espece: string | null };
type CarcasseRegistre = {
  zacharie_carcasse_id: string;
  numero_bracelet: string;
  espece: string | null;
  svi_entity_id: string | null;
  date_mise_a_mort: string | null;
  deleted_at: string | null;
  trichine_retire_de_fei_at: string | null;
};
type Candidate = { zacharie_carcasse_id: string; numero_bracelet: string };
type Echantillon = { id: string; zacharie_carcasse_id: string; reference_echantillon: string };

/**
 * Prélèvement d'un lot. La route en lot est tout ou rien : si une carcasse est refusée
 * (déjà prélevée par un collègue, analyse en cours), on reprend carcasse par carcasse pour
 * garder le reste du lot plutôt que de perdre la fiche entière.
 */
async function prelever(
  lot: Array<Candidate>,
  site: TrichineSitePrelevement,
  entityId: string,
  commentaire: string
): Promise<Array<string>> {
  const body = {
    echantillons: lot.map((carcasse) => ({
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      site_prelevement: site,
    })),
    preleve_par_entity_id: entityId,
    commentaire,
  };
  try {
    const { echantillons } = await api<{ echantillons: Array<Echantillon> }>(
      'POST',
      '/trichine/echantillons',
      body
    );
    return echantillons.map((echantillon) => echantillon.id);
  } catch (error) {
    console.log(`  lot refusé (${error instanceof Error ? error.message : error}) → reprise une par une`);
  }
  const ids: Array<string> = [];
  for (const carcasse of lot) {
    try {
      const { echantillon } = await api<{ echantillon: Echantillon }>('POST', '/trichine/echantillon', {
        zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
        site_prelevement: site,
        preleve_par_entity_id: entityId,
        commentaire,
      });
      ids.push(echantillon.id);
    } catch {
      console.log(`  carcasse ${carcasse.numero_bracelet} écartée`);
    }
  }
  return ids;
}

async function main() {
  if (!API_URL) throw new Error('API_URL est requis');
  if (!SVI_PASSWORD) throw new Error('SVI_PASSWORD est requis');

  const connexion = await api<{ token: string; user: { id: string; roles: Array<string> } }>(
    'POST',
    '/user/login',
    { email: SVI_EMAIL, passwordUser: SVI_PASSWORD }
  );
  token = connexion.token;
  if (!connexion.user.roles.includes('SVI')) {
    throw new Error(`${SVI_EMAIL} n'a pas le rôle SVI`);
  }
  console.log(`Connecté : ${SVI_EMAIL}`);

  // Entité SVI de l'utilisateur : elle porte le code établissement des références E/P/F
  const entites = await api<{
    userEntitiesByTypeAndId: Record<string, Record<string, { id: string; nom_d_usage: string | null }>>;
  }>('GET', '/entite/working-for');
  const sviEntities = Object.values(entites.userEntitiesByTypeAndId.SVI ?? {});
  if (sviEntities.length !== 1) {
    throw new Error(`Attendu 1 entité SVI pour ce compte, trouvé ${sviEntities.length}`);
  }
  const sviEntity = sviEntities[0];
  console.log(`Service d'inspection : ${sviEntity.nom_d_usage} (${sviEntity.id})`);

  // Annuaire des LVD : la route ne renvoie que les laboratoires non-LNR, ceux à qui on peut
  // adresser une FTP directement
  const { laboratoires } = await api<{
    laboratoires: Array<{ id: string; nom_d_usage: string | null; raison_sociale: string | null }>;
  }>('GET', '/trichine/laboratoires');
  const laboIdParNom = new Map<string, string>();
  for (const labo of laboratoires) {
    if (labo.nom_d_usage) laboIdParNom.set(labo.nom_d_usage, labo.id);
    if (labo.raison_sociale) laboIdParNom.set(labo.raison_sociale, labo.id);
  }
  for (const nom of new Set(PLAN.map((ftp) => ftp.labo))) {
    if (!laboIdParNom.has(nom)) {
      throw new Error(
        `Laboratoire « ${nom} » absent de l'annuaire. Laboratoires disponibles : ${
          laboratoires.map((l) => l.nom_d_usage || l.raison_sociale).join(', ') || 'aucun'
        }`
      );
    }
  }

  // Le SVI prélève sur deux gisements, comme l'assistant de prélèvement : les sangliers déjà
  // transmis (son registre) et ceux arrivés chez un ETG rattaché, pas encore transmis — il
  // partage les locaux de l'ETG et prélève dès l'arrivage.
  const { carcasses: aVenir } = await api<{ carcasses: Array<CarcasseAVenir> }>(
    'GET',
    '/svi/carcasses-a-venir'
  );
  const sangliersAVenir = aVenir.filter((carcasse) => carcasse.espece === 'Sanglier');

  const registre: Array<CarcasseRegistre> = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const data = await api<{ carcasses: Array<CarcasseRegistre>; hasMore: boolean }>(
      'GET',
      `/carcasse?after=0&withDeleted=false&page=${page}&limit=5000`
    );
    registre.push(...data.carcasses);
    hasMore = data.hasMore;
    page += 1;
  }
  // Le registre SVI contient aussi les carcasses seulement annoncées (next_owner) : le
  // prélèvement n'est ouvert que sur celles réellement assignées au service.
  const sangliersTransmis = registre.filter(
    (carcasse) =>
      carcasse.espece === 'Sanglier' &&
      !carcasse.deleted_at &&
      !carcasse.trichine_retire_de_fei_at &&
      !!carcasse.svi_entity_id &&
      carcasse.svi_entity_id === sviEntity.id
  );

  // Une carcasse déjà prélevée serait refusée
  const { echantillons: dejaPreleves } = await api<{ echantillons: Array<Echantillon> }>(
    'GET',
    '/trichine/echantillons'
  );
  const dejaPrelevees = new Set(dejaPreleves.map((echantillon) => echantillon.zacharie_carcasse_id));

  // Les carcasses encore chez l'ETG d'abord : c'est le cas réel du prélèvement à l'arrivage.
  // Les transmises ensuite, de la plus récente à la plus ancienne.
  const vues = new Set<string>();
  const candidats: Array<Candidate> = [];
  for (const carcasse of sangliersAVenir) {
    vues.add(carcasse.zacharie_carcasse_id);
    candidats.push(carcasse);
  }
  const parDateDecroissante = (a: CarcasseRegistre, b: CarcasseRegistre) =>
    new Date(b.date_mise_a_mort ?? 0).getTime() - new Date(a.date_mise_a_mort ?? 0).getTime();
  for (const carcasse of [...sangliersTransmis].sort(parDateDecroissante)) {
    if (vues.has(carcasse.zacharie_carcasse_id)) continue;
    vues.add(carcasse.zacharie_carcasse_id);
    candidats.push(carcasse);
  }
  const disponibles = candidats
    .filter((carcasse) => !dejaPrelevees.has(carcasse.zacharie_carcasse_id))
    .slice(0, MAX_CARCASSES);

  console.log(
    `Sangliers : ${sangliersAVenir.length} chez l'ETG + ${sangliersTransmis.length} dans le registre SVI ` +
      `→ ${disponibles.length} disponibles (${candidats.length - disponibles.length} déjà prélevés ou hors plafond)`
  );

  // Le plan est rogné à ce qui est disponible : on remplit les FTP dans l'ordre, un pool
  // entamé mais non rempli reste utile, un pool vide fait arrêter là
  let restantes = disponibles.length;
  const planEffectif = [];
  for (const ftp of PLAN) {
    const pools = [];
    for (const taille of ftp.pools) {
      if (restantes === 0) break;
      const effective = Math.min(taille, restantes);
      pools.push(effective);
      restantes -= effective;
    }
    if (pools.length) planEffectif.push({ ...ftp, pools });
    if (restantes === 0) break;
  }
  const totalPrevu = planEffectif.reduce((sum, ftp) => sum + ftp.pools.reduce((a, b) => a + b, 0), 0);

  console.log('\nPlan :');
  for (const ftp of planEffectif) {
    console.log(
      `  FTP → ${ftp.labo} : ${ftp.pools.length} pool(s) de [${ftp.pools.join(', ')}] carcasses (${ftp.site})`
    );
  }
  console.log(
    `  Total : ${totalPrevu} carcasses, ${planEffectif.reduce((s, f) => s + f.pools.length, 0)} pools\n`
  );

  if (!planEffectif.length) {
    throw new Error('Aucun sanglier disponible chez les ETG rattachés : rien à créer');
  }
  if (DRY_RUN) {
    console.log('--dry-run : rien n’a été créé.');
    return;
  }

  let curseur = 0;
  for (const ftp of planEffectif) {
    const nombre = ftp.pools.reduce((a, b) => a + b, 0);
    const lot = disponibles.slice(curseur, curseur + nombre);
    curseur += nombre;

    const echantillonIds = await prelever(lot, ftp.site, sviEntity.id, ftp.commentaire);
    if (!echantillonIds.length) {
      console.log(`✗ FTP → ${ftp.labo} : aucun prélèvement possible sur ce lot, fiche non créée`);
      continue;
    }

    const poolIds = [];
    let index = 0;
    for (const taille of ftp.pools) {
      const duPool = echantillonIds.slice(index, index + taille);
      index += taille;
      if (!duPool.length) break;
      const { pool } = await api<{ pool: { id: string; reference_pool: string } }>('POST', '/trichine/pool', {
        echantillon_ids: duPool,
        cree_par_entity_id: sviEntity.id,
      });
      poolIds.push(pool.id);
    }

    const { ftp: fiche } = await api<{ ftp: { id: string; numero_fiche: string } }>('POST', '/trichine/ftp', {
      pool_ids: poolIds,
      destinataire_entity_id: laboIdParNom.get(ftp.labo)!,
      expediteur_entity_id: sviEntity.id,
      mode_transport: ftp.mode_transport,
      commentaire: ftp.commentaire,
    });
    await api('POST', `/trichine/ftp/${fiche.id}/envoyer`, {});

    console.log(
      `✓ ${fiche.numero_fiche} → ${ftp.labo} : ${poolIds.length} pool(s), ${echantillonIds.length} carcasses, envoyée`
    );
  }

  console.log('\nLes FTP sont ENVOYEE : les labos peuvent les réceptionner puis saisir les résultats.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
