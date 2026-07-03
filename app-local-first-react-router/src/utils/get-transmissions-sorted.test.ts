import { describe, it, expect } from 'vitest';
import {
  Carcasse,
  CarcasseIntermediaire,
  CarcasseStatus,
  CarcasseType,
  User,
  UserRoles,
} from '@prisma/client';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import {
  computeTransmissions,
  getWorseLabelsOfTransmissions,
  sortTransmissions,
} from './get-transmissions-sorted';
import { buildTransmissionId } from './get-transmission-id';
import type { CarcasseTransmissionWihMetadata } from '@app/types/carcasse';
import type { TransmissionSimpleStatus } from '@app/types/transmission-steps';

// ---------------------------------------------------------------------------
// Factories — only the fields computeTransmissions (and the pure helpers it
// calls) actually read. svi_carcasse_status defaults to SANS_DECISION so the
// baseline carcasse is "not done"; owners default to nobody.
// ---------------------------------------------------------------------------

function carcasse(overrides: Partial<Carcasse> = {}): Carcasse {
  return {
    zacharie_carcasse_id: 'CARC',
    fei_numero: 'FEI-1',
    deleted_at: null,
    premier_detenteur_prochain_detenteur_id_cache: null,
    type: CarcasseType.GROS_GIBIER,
    espece: 'Sanglier',
    nombre_d_animaux: 1,
    consommateur_final_usage_domestique: null,
    premier_detenteur_user_id: null,
    premier_detenteur_entity_id: null,
    svi_closed_at: null,
    svi_automatic_closed_at: null,
    svi_assigned_at: null,
    intermediaire_closed_at: null,
    intermediaire_carcasse_refus_intermediaire_id: null,
    intermediaire_carcasse_manquante: false,
    svi_carcasse_status: CarcasseStatus.SANS_DECISION,
    current_owner_user_id: null,
    current_owner_entity_id: null,
    current_owner_role: null,
    next_owner_user_id: null,
    next_owner_entity_id: null,
    next_owner_role: null,
    next_owner_sous_traite_by_entity_id: null,
    examinateur_initial_user_id: null,
    examinateur_initial_date_approbation_mise_sur_le_marche: null,
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    updated_at: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  } as unknown as Carcasse;
}

// Full CarcasseIntermediaire shape (the store's carcassesIntermediaireById value),
// not the trimmed CarcassesIntermediaire — it carries zacharie_carcasse_id + intermediaire_id.
function intermediaire(overrides: Partial<CarcasseIntermediaire> = {}): CarcasseIntermediaire {
  return {
    zacharie_carcasse_id: 'CARC',
    fei_numero: 'FEI-1',
    intermediaire_id: 'INT',
    created_at: new Date('2024-01-02T10:00:00.000Z'),
    prise_en_charge_at: null,
    deleted_at: null,
    nombre_d_animaux_acceptes: null,
    intermediaire_user_id: null,
    intermediaire_entity_id: null,
    intermediaire_role: UserRoles.ETG,
    intermediaire_depot_type: null,
    intermediaire_depot_entity_id: null,
    intermediaire_prochain_detenteur_role_cache: null,
    intermediaire_prochain_detenteur_id_cache: null,
    ...overrides,
  } as unknown as CarcasseIntermediaire;
}

function fei(overrides: Partial<FeiWithIntermediaires> = {}): FeiWithIntermediaires {
  return {
    numero: 'FEI-1',
    deleted_at: null,
    commune_mise_a_mort: 'Commune test',
    date_mise_a_mort: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  } as unknown as FeiWithIntermediaires;
}

function user(roles: UserRoles[], id = 'me'): User {
  return { id, roles } as unknown as User;
}

// A key present means "an entity I work directly for".
function working(...ids: string[]): Record<string, EntityWithUserRelation> {
  return Object.fromEntries(ids.map((id) => [id, {} as EntityWithUserRelation]));
}
const noEntities: Record<string, EntityWithUserRelation> = {};

const admin = user([UserRoles.ADMIN], 'admin'); // generic viewer → generic labels, meIsSvi=false
const svi = user([UserRoles.SVI], 'svi');
const chasseur = user([UserRoles.CHASSEUR], 'chasseur');

// Thin wrapper: arrays in, record out. Intermediaire keys are arbitrary (function only
// does Object.values), so we index by position to preserve input order.
function run({
  carcasses = [],
  intermediaires = [],
  feis = [fei()],
  user: viewer,
  entities = noEntities,
}: {
  carcasses?: Carcasse[];
  intermediaires?: CarcasseIntermediaire[];
  feis?: FeiWithIntermediaires[];
  user: User;
  entities?: Record<string, EntityWithUserRelation>;
}) {
  return computeTransmissions({
    carcasses: Object.fromEntries(carcasses.map((c) => [c.zacharie_carcasse_id, c])),
    carcassesIntermediaireById: Object.fromEntries(intermediaires.map((ci, idx) => [`key_${idx}`, ci])),
    feis: Object.fromEntries(feis.map((f) => [f.numero, f])),
    user: viewer,
    entitiesWorkingDirectlyFor: entities,
  });
}

const TID = buildTransmissionId('FEI-1'); // 'FEI-1__'

// ---------------------------------------------------------------------------
// A. Status sorting — one assertion per terminal / label branch
// ---------------------------------------------------------------------------

describe('computeTransmissions — Clôturée (carcasse done)', () => {
  it.each([
    ['svi_closed_at', { svi_closed_at: new Date() }],
    ['svi_automatic_closed_at', { svi_automatic_closed_at: new Date() }],
    ['intermediaire_closed_at', { intermediaire_closed_at: new Date() }],
    ['refused by intermediaire', { intermediaire_carcasse_refus_intermediaire_id: 'refus-id' }],
    ['marked missing', { intermediaire_carcasse_manquante: true }],
    ['terminal svi status', { svi_carcasse_status: CarcasseStatus.ACCEPTE }],
  ])('Clôturée when done via %s', (_label, ov) => {
    const t = run({ carcasses: [carcasse(ov as Partial<Carcasse>)], user: admin });
    expect(t[TID].labels.simpleStatus).toBe('Clôturée');
    expect(t[TID].labels.currentStepLabel).toBe('Clôturée');
  });

  it('Clôturée via domestic final-consumer usage (premier détenteur)', () => {
    const t = run({
      carcasses: [
        carcasse({ consommateur_final_usage_domestique: new Date(), premier_detenteur_user_id: 'pd' }),
      ],
      user: admin,
    });
    expect(t[TID].labels.simpleStatus).toBe('Clôturée');
    expect(t[TID].labels.currentStepLabel).toBe('Clôturée');
  });
});

describe('computeTransmissions — À compléter', () => {
  it('under my responsibility (I am current owner, no next owner)', () => {
    const t = run({ carcasses: [carcasse({ current_owner_user_id: 'admin' })], user: admin });
    expect(t[TID].labels.simpleStatus).toBe('À compléter');
    expect(t[TID].labels.currentStepLabel).toBe('En cours');
  });

  it('to take (I am the next owner) — only when I am not SVI', () => {
    const t = run({
      carcasses: [carcasse({ current_owner_user_id: 'other', next_owner_user_id: 'admin' })],
      user: admin,
    });
    expect(t[TID].labels.simpleStatus).toBe('À compléter');
    expect(t[TID].labels.currentStepLabel).toBe('En cours');
  });

  it('SVI: assigned and not yet closed', () => {
    const t = run({
      carcasses: [
        carcasse({
          svi_assigned_at: new Date(),
          current_owner_user_id: 'other',
          next_owner_user_id: 'other2',
        }),
      ],
      user: svi,
    });
    expect(t[TID].labels.simpleStatus).toBe('À compléter');
    expect(t[TID].labels.currentStepLabel).toBe('En cours');
  });
});

describe('computeTransmissions — En cours (in transit, I have a stake)', () => {
  // Base carcasse that reaches the "En cours" block: not done, not mine to act on
  // (current owner someone else, next owner someone else), not at SVI, not closed.
  const inTransit = (ov: Partial<Carcasse> = {}) =>
    carcasse({
      current_owner_user_id: 'other',
      next_owner_user_id: 'other2',
      examinateur_initial_user_id: 'other',
      premier_detenteur_user_id: 'other',
      ...ov,
    });

  it('I am the examinateur initial', () => {
    const t = run({ carcasses: [inTransit({ examinateur_initial_user_id: 'admin' })], user: admin });
    expect(t[TID].labels.simpleStatus).toBe('En cours');
    expect(t[TID].labels.currentStepLabel).toBe('En cours');
  });

  it('I am the premier détenteur (user)', () => {
    const t = run({ carcasses: [inTransit({ premier_detenteur_user_id: 'admin' })], user: admin });
    expect(t[TID].labels.simpleStatus).toBe('En cours');
  });

  it('premier détenteur entity is one I work directly for', () => {
    const t = run({
      carcasses: [inTransit({ premier_detenteur_entity_id: 'my-entity' })],
      user: admin,
      entities: working('my-entity'),
    });
    expect(t[TID].labels.simpleStatus).toBe('En cours');
  });

  it('the carcasse is sous-traitée by an entity I work directly for', () => {
    const t = run({
      carcasses: [inTransit({ next_owner_sous_traite_by_entity_id: 'st-entity' })],
      user: admin,
      entities: working('st-entity'),
    });
    expect(t[TID].labels.simpleStatus).toBe('En cours');
  });

  it('I am one of the intermédiaires (by user id)', () => {
    const t = run({
      carcasses: [inTransit()],
      intermediaires: [intermediaire({ intermediaire_user_id: 'admin' })],
      user: admin,
    });
    expect(t[TID].labels.simpleStatus).toBe('En cours');
  });

  it('an intermédiaire entity is one I work directly for', () => {
    const t = run({
      carcasses: [inTransit()],
      intermediaires: [intermediaire({ intermediaire_entity_id: 'my-entity' })],
      user: admin,
      entities: working('my-entity'),
    });
    expect(t[TID].labels.simpleStatus).toBe('En cours');
  });

  it('SVI-assigned but I am NOT the SVI', () => {
    const t = run({ carcasses: [inTransit({ svi_assigned_at: new Date() })], user: admin });
    expect(t[TID].labels.simpleStatus).toBe('En cours');
  });
});

// ---------------------------------------------------------------------------
// B. Intermédiaire shapes — ordering and the decision-field merge
// ---------------------------------------------------------------------------

describe('computeTransmissions — intermédiaires', () => {
  it('a carcasse with no intermédiaires yields an empty intermediaires list', () => {
    const t = run({ carcasses: [carcasse({ current_owner_user_id: 'admin' })], user: admin });
    expect(t[TID].intermediaires).toEqual([]);
  });

  it('3 distinct intermédiaires are listed most-recent first', () => {
    const t = run({
      carcasses: [carcasse({ current_owner_user_id: 'admin' })],
      // fed out of order on purpose
      intermediaires: [
        intermediaire({ intermediaire_id: 'b', created_at: new Date('2024-02-02T00:00:00Z') }),
        intermediaire({ intermediaire_id: 'a', created_at: new Date('2024-02-01T00:00:00Z') }),
        intermediaire({ intermediaire_id: 'c', created_at: new Date('2024-02-03T00:00:00Z') }),
      ],
      user: admin,
    });
    expect(t[TID].intermediaires.map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });

  it('a repeating intermédiaire (ETG1 → ETG2 → ETG1) keeps both ETG1 passes (distinct ids)', () => {
    const t = run({
      carcasses: [carcasse({ current_owner_user_id: 'admin' })],
      intermediaires: [
        intermediaire({
          intermediaire_id: 'etg1_100000',
          intermediaire_user_id: 'etg1',
          created_at: new Date('2024-03-01T00:00:00Z'),
        }),
        intermediaire({
          intermediaire_id: 'etg2_100001',
          intermediaire_user_id: 'etg2',
          created_at: new Date('2024-03-02T00:00:00Z'),
        }),
        intermediaire({
          intermediaire_id: 'etg1_100002',
          intermediaire_user_id: 'etg1',
          created_at: new Date('2024-03-03T00:00:00Z'),
        }),
      ],
      user: admin,
    });
    const ids = t[TID].intermediaires.map((i) => i.id);
    expect(ids).toEqual(['etg1_100002', 'etg2_100001', 'etg1_100000']);
    expect(t[TID].intermediaires.filter((i) => i.intermediaire_user_id === 'etg1')).toHaveLength(2);
  });

  it('merges decision fields across carcasses: a refused carcasse does not mask the real next détenteur', () => {
    // Two carcasses, same transmission, sharing intermédiaire id INT1.
    // Oldest carcasse (CARC_A, listed first) has a refused intermédiaire: no decision.
    // Sibling CARC_B carries the real prochain détenteur + dépôt on the same INT1.
    const t = run({
      carcasses: [carcasse({ zacharie_carcasse_id: 'CARC_A' }), carcasse({ zacharie_carcasse_id: 'CARC_B' })],
      intermediaires: [
        intermediaire({
          zacharie_carcasse_id: 'CARC_A',
          intermediaire_id: 'INT1',
          intermediaire_prochain_detenteur_id_cache: null,
          intermediaire_prochain_detenteur_role_cache: null,
          intermediaire_depot_type: null,
          intermediaire_depot_entity_id: null,
        }),
        intermediaire({
          zacharie_carcasse_id: 'CARC_B',
          intermediaire_id: 'INT1',
          intermediaire_prochain_detenteur_id_cache: 'dest-1',
          intermediaire_prochain_detenteur_role_cache: UserRoles.ETG,
          intermediaire_depot_type: UserRoles.ETG,
          intermediaire_depot_entity_id: 'depot-1',
        }),
      ],
      user: admin,
    });
    const merged = t[TID].intermediaires.find((i) => i.id === 'INT1')!;
    expect(merged.intermediaire_prochain_detenteur_id_cache).toBe('dest-1');
    expect(merged.intermediaire_prochain_detenteur_role_cache).toBe(UserRoles.ETG);
    expect(merged.intermediaire_depot_type).toBe(UserRoles.ETG);
    expect(merged.intermediaire_depot_entity_id).toBe('depot-1');
  });

  it('merge ignores intermédiaire ids that are not on the transmission', () => {
    // CARC_B carries a decision on INT2, which CARC_A's transmission never had → no crash, no graft.
    const t = run({
      carcasses: [carcasse({ zacharie_carcasse_id: 'CARC_A' }), carcasse({ zacharie_carcasse_id: 'CARC_B' })],
      intermediaires: [
        intermediaire({ zacharie_carcasse_id: 'CARC_A', intermediaire_id: 'INT1' }),
        intermediaire({
          zacharie_carcasse_id: 'CARC_B',
          intermediaire_id: 'INT2',
          intermediaire_prochain_detenteur_id_cache: 'dest-2',
        }),
      ],
      user: admin,
    });
    expect(t[TID].intermediaires.map((i) => i.id)).toEqual(['INT1']);
  });
});

// ---------------------------------------------------------------------------
// B bis. Carcasse de référence : une carcasse écartée du circuit (refus/manquante amont)
// ne doit jamais dicter le propriétaire courant ni la liste d'intermédiaires du groupe,
// même si elle est itérée en premier (ordre de synchro non déterministe).
// ---------------------------------------------------------------------------

describe('computeTransmissions — reference carcasse ne suit pas une carcasse écartée', () => {
  it('carcasse manquante en tête : le content reflète le propriétaire de la carcasse vivante (ETG)', () => {
    // CARC_A (manquante chez le collecteur, itérée en 1er) a un current_owner figé sur le collecteur.
    // CARC_B (vivante) est chez l'ETG « me », avec son intermédiaire ETG.
    const t = run({
      carcasses: [
        carcasse({
          zacharie_carcasse_id: 'CARC_A',
          intermediaire_carcasse_manquante: true,
          current_owner_user_id: 'collecteur',
          current_owner_role: UserRoles.COLLECTEUR_PRO,
        }),
        carcasse({
          zacharie_carcasse_id: 'CARC_B',
          current_owner_user_id: 'me',
          current_owner_role: UserRoles.ETG,
        }),
      ],
      intermediaires: [
        intermediaire({ zacharie_carcasse_id: 'CARC_B', intermediaire_id: 'INT_ETG', intermediaire_user_id: 'me' }),
      ],
      user: user([UserRoles.ETG], 'me'),
    });
    expect(t[TID].content.current_owner_user_id).toBe('me');
    expect(t[TID].content.current_owner_role).toBe(UserRoles.ETG);
    // l'intermédiaire ETG (celui qui autorise l'édition côté ETG) est bien présent
    expect(t[TID].intermediaires.map((i) => i.id)).toContain('INT_ETG');
    // toutes les carcasses du groupe restent listées
    expect(t[TID].carcasses.map((c) => c.zacharie_carcasse_id).sort()).toEqual(['CARC_A', 'CARC_B']);
  });

  it('toutes les carcasses écartées : on garde la première (comportement inchangé)', () => {
    const t = run({
      carcasses: [
        carcasse({ zacharie_carcasse_id: 'CARC_A', intermediaire_carcasse_manquante: true, current_owner_user_id: 'collecteur' }),
        carcasse({ zacharie_carcasse_id: 'CARC_B', intermediaire_carcasse_refus_intermediaire_id: 'refus', current_owner_user_id: 'collecteur' }),
      ],
      user: admin,
    });
    expect(t[TID].content.current_owner_user_id).toBe('collecteur');
  });
});

// ---------------------------------------------------------------------------
// C. Many carcasses — all / some / none in a terminal state
// ---------------------------------------------------------------------------

describe('computeTransmissions — terminal mixes within one transmission', () => {
  const actionable = (id: string) => carcasse({ zacharie_carcasse_id: id, current_owner_user_id: 'admin' });
  const missing = (id: string) =>
    carcasse({ zacharie_carcasse_id: id, intermediaire_carcasse_manquante: true });
  const refused = (id: string) =>
    carcasse({ zacharie_carcasse_id: id, intermediaire_carcasse_refus_intermediaire_id: 'refus-id' });

  it('one missing, the rest actionable → still À compléter', () => {
    const t = run({ carcasses: [missing('C1'), actionable('C2'), actionable('C3')], user: admin });
    expect(t[TID].labels.simpleStatus).toBe('À compléter');
  });

  it('all but one missing → À compléter (the live one drives it)', () => {
    const t = run({ carcasses: [missing('C1'), missing('C2'), actionable('C3')], user: admin });
    expect(t[TID].labels.simpleStatus).toBe('À compléter');
  });

  it('all missing → Clôturée', () => {
    const t = run({ carcasses: [missing('C1'), missing('C2'), missing('C3')], user: admin });
    expect(t[TID].labels.simpleStatus).toBe('Clôturée');
  });

  it('one refused, the rest actionable → still À compléter', () => {
    const t = run({ carcasses: [refused('C1'), actionable('C2'), actionable('C3')], user: admin });
    expect(t[TID].labels.simpleStatus).toBe('À compléter');
  });

  it('all refused → Clôturée', () => {
    const t = run({ carcasses: [refused('C1'), refused('C2'), refused('C3')], user: admin });
    expect(t[TID].labels.simpleStatus).toBe('Clôturée');
  });
});

// ---------------------------------------------------------------------------
// Partial refusal (getCarcassePartialRefusal) — petit gibier lots
// ---------------------------------------------------------------------------

describe('computeTransmissions — partial refusal of a petit gibier lot', () => {
  const perdrix = (ov: Partial<Carcasse> = {}) =>
    carcasse({ type: CarcasseType.PETIT_GIBIER, espece: 'Perdrix', nombre_d_animaux: 5, ...ov });
  const accepted = (acceptes: number | null, ov: Partial<CarcasseIntermediaire> = {}) =>
    intermediaire({
      prise_en_charge_at: new Date('2024-04-02T00:00:00Z'),
      nombre_d_animaux_acceptes: acceptes,
      ...ov,
    });

  it('reports "<n> <abbr>" when fewer animals were accepted than the lot total', () => {
    const t = run({ carcasses: [perdrix()], intermediaires: [accepted(3)], user: admin });
    expect(t[TID].partialRefusals).toEqual(['2 perdrix']);
  });

  it('keeps the most recent prise en charge when several accepted (older one ignored)', () => {
    const t = run({
      carcasses: [perdrix()],
      // most recent first (accepts 3), then an older one (accepts 5) that must NOT win
      intermediaires: [
        accepted(3, { prise_en_charge_at: new Date('2024-04-03T00:00:00Z') }),
        accepted(5, { prise_en_charge_at: new Date('2024-04-02T00:00:00Z') }),
      ],
      user: admin,
    });
    expect(t[TID].partialRefusals).toEqual(['2 perdrix']);
  });

  it('no entry when everything was accepted', () => {
    const t = run({ carcasses: [perdrix()], intermediaires: [accepted(5)], user: admin });
    expect(t[TID].partialRefusals).toEqual([]);
  });

  it('no entry for gros gibier', () => {
    const t = run({
      carcasses: [carcasse({ type: CarcasseType.GROS_GIBIER, espece: 'Sanglier' })],
      intermediaires: [accepted(0)],
      user: admin,
    });
    expect(t[TID].partialRefusals).toEqual([]);
  });

  it('no entry for an unknown espèce', () => {
    const t = run({
      carcasses: [perdrix({ espece: 'Espèce inconnue' })],
      intermediaires: [accepted(1)],
      user: admin,
    });
    expect(t[TID].partialRefusals).toEqual([]);
  });

  it('no entry when the accepted count is unknown (null)', () => {
    const t = run({ carcasses: [perdrix()], intermediaires: [accepted(null)], user: admin });
    expect(t[TID].partialRefusals).toEqual([]);
  });

  it('no entry when no intermédiaire has taken charge', () => {
    const t = run({ carcasses: [perdrix()], intermediaires: [intermediaire()], user: admin });
    expect(t[TID].partialRefusals).toEqual([]);
  });

  it('no entry when the lot total is unknown (nombre_d_animaux null)', () => {
    const t = run({
      carcasses: [perdrix({ nombre_d_animaux: null })],
      intermediaires: [accepted(3)],
      user: admin,
    });
    expect(t[TID].partialRefusals).toEqual([]);
  });

  it('a deleted (or not-taken-charge) intermédiaire does not count as the last accepted', () => {
    const t = run({
      carcasses: [perdrix()],
      intermediaires: [accepted(3, { deleted_at: new Date('2024-04-04T00:00:00Z') })],
      user: admin,
    });
    expect(t[TID].partialRefusals).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// D. Dispatch (one FEI → several transmissions) and the chasseur fresh-FEI loop
// ---------------------------------------------------------------------------

describe('computeTransmissions — dispatch', () => {
  it('one FEI split across two prochains détenteurs makes two transmissions, each counting 2', () => {
    const t = run({
      carcasses: [
        carcasse({ zacharie_carcasse_id: 'C1', premier_detenteur_prochain_detenteur_id_cache: 'A' }),
        carcasse({ zacharie_carcasse_id: 'C2', premier_detenteur_prochain_detenteur_id_cache: 'B' }),
      ],
      user: admin,
    });
    const idA = buildTransmissionId('FEI-1', 'A');
    const idB = buildTransmissionId('FEI-1', 'B');
    expect(Object.keys(t).sort()).toEqual([idA, idB].sort());
    expect(t[idA].fei.numberOfPremierDetenteurProchainDetenteur).toBe(2);
    expect(t[idB].fei.numberOfPremierDetenteurProchainDetenteur).toBe(2);
  });
});

describe('computeTransmissions — chasseur fresh FEI (no carcasses yet)', () => {
  it('creates a temp À compléter transmission keyed by the FEI numéro', () => {
    const t = run({ carcasses: [], feis: [fei({ numero: 'FEI-FRESH' })], user: chasseur });
    const tr = t[buildTransmissionId('FEI-FRESH')];
    expect(tr).toBeDefined();
    expect(tr.labels.simpleStatus).toBe('À compléter');
    expect(tr.labels.currentStepLabel).toBe('Traitement des carcasses');
    expect(tr.carcasses).toEqual([]);
  });

  it('does NOT duplicate a FEI that already has a carcasse-backed transmission', () => {
    const t = run({
      carcasses: [
        carcasse({ zacharie_carcasse_id: 'C1', fei_numero: 'FEI-1', current_owner_user_id: 'chasseur' }),
      ],
      feis: [fei({ numero: 'FEI-1' }), fei({ numero: 'FEI-FRESH' })],
      user: chasseur,
    });
    expect(t[TID].carcasses).toHaveLength(1); // real transmission kept
    expect(t[buildTransmissionId('FEI-FRESH')].carcasses).toEqual([]); // only the empty FEI gets a temp one
  });

  it('a non-chasseur never gets temp transmissions for empty FEIs', () => {
    const t = run({ carcasses: [], feis: [fei({ numero: 'FEI-FRESH' })], user: admin });
    expect(t).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// E. Skips / guards
// ---------------------------------------------------------------------------

describe('computeTransmissions — skips', () => {
  it('excludes deleted carcasses', () => {
    const t = run({ carcasses: [carcasse({ deleted_at: new Date() })], user: admin });
    expect(t).toEqual({});
  });

  it('excludes carcasses whose FEI is missing from the store', () => {
    const t = run({
      carcasses: [carcasse({ fei_numero: 'UNKNOWN' })],
      feis: [fei({ numero: 'FEI-1' })],
      user: admin,
    });
    expect(t).toEqual({});
  });

  it('excludes carcasses whose FEI is deleted', () => {
    const t = run({ carcasses: [carcasse()], feis: [fei({ deleted_at: new Date() })], user: admin });
    expect(t).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Pure sibling helpers (the hooks need a React renderer and are left out)
// ---------------------------------------------------------------------------

function meta(
  simpleStatus: TransmissionSimpleStatus,
  extra: Partial<CarcasseTransmissionWihMetadata> = {}
): CarcasseTransmissionWihMetadata {
  return {
    labels: { simpleStatus, currentStepLabel: `step-${simpleStatus}` },
    content: {},
    ...extra,
  } as unknown as CarcasseTransmissionWihMetadata;
}

describe('getWorseLabelsOfTransmissions — chasseur sees the worst status of a dispatched fiche', () => {
  it('defaults to Clôturée for an empty list', () => {
    expect(getWorseLabelsOfTransmissions([])).toEqual(['Clôturée', '']);
  });

  it('À compléter wins over everything (and short-circuits)', () => {
    const [status, label] = getWorseLabelsOfTransmissions([
      meta('En cours'),
      meta('À compléter'),
      meta('Clôturée'),
    ]);
    expect(status).toBe('À compléter');
    expect(label).toBe('step-À compléter');
  });

  it('En cours wins over Clôturée', () => {
    expect(getWorseLabelsOfTransmissions([meta('Clôturée'), meta('En cours')])[0]).toBe('En cours');
  });

  it('a later Clôturée does not override an earlier En cours', () => {
    expect(getWorseLabelsOfTransmissions([meta('En cours'), meta('Clôturée')])[0]).toBe('En cours');
  });

  it('all Clôturée stays Clôturée', () => {
    expect(getWorseLabelsOfTransmissions([meta('Clôturée'), meta('Clôturée')])[0]).toBe('Clôturée');
  });
});

describe('sortTransmissions — most recent approbation/creation first', () => {
  const withDates = (approbation: string | null, created: string) =>
    meta('En cours', {
      content: {
        examinateur_initial_date_approbation_mise_sur_le_marche: approbation ? new Date(approbation) : null,
        created_at: new Date(created),
      },
    } as unknown as Partial<CarcasseTransmissionWihMetadata>);

  it('orders by approbation date descending (both comparator directions)', () => {
    const older = withDates('2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z');
    const newer = withDates('2024-06-01T00:00:00Z', '2024-06-01T00:00:00Z');
    expect(sortTransmissions(newer, older)).toBe(-1); // newer before older
    expect(sortTransmissions(older, newer)).toBe(1);
    expect([older, newer].sort(sortTransmissions)).toEqual([newer, older]);
  });

  it('falls back to created_at when there is no approbation date', () => {
    const older = withDates(null, '2024-01-01T00:00:00Z');
    const newer = withDates(null, '2024-06-01T00:00:00Z');
    expect([older, newer].sort(sortTransmissions)).toEqual([newer, older]);
  });
});
