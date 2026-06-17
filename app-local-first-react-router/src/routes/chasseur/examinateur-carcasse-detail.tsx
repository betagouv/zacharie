import { Carcasse, CarcasseType, Fei, FeiOwnerRole, Prisma, UserRoles } from '@prisma/client';
import type { CarcasseIntermediaire } from '@prisma/client';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';
import { useMemo, useRef, useState } from 'react';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import NotFound from '@app/components/NotFound';
import Chargement from '@app/components/Chargement';
import { Link, useNavigate, useParams } from 'react-router';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { isCarcasseDone } from '@app/utils/is-carcasse-done';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';
import AnomaliesTreeNavigator from '@app/components/AnomaliesTreeNavigator';
import { buildCarcasseNavSections } from '@app/utils/build-carcasse-nav-sections';
import { useCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import {
  getCarcasseCardDisplay,
  type CardAccent,
  type CardViewRole,
} from '@app/utils/get-carcasse-card-display';
import type { UserForFei } from '@api/src/types/user';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import { loadData, useLoaderEffect } from '@app/utils/load-data';
import TrichineSection from '@app/components/TrichineSection';
import { TRICHINE_FEATURE_ENABLED } from '@app/utils/trichine';
import { useGetTransmissionFromCarcasse } from '@app/utils/get-transmissions-sorted';
import { CarcasseTransmissionWihMetadata } from '@app/types/carcasse';

const gibierSelect = {
  grand: grandGibier.especes,
  petit: petitGibier.especes,
};

type DecisionColor = {
  cardText: string;
  cardBg: string;
  badgeBg: string;
  badgeText: string;
};

function getAccentColorClasses(accent: CardAccent): DecisionColor {
  switch (accent) {
    case 'red':
      return {
        cardText: 'text-red-700',
        cardBg: 'bg-red-50',
        badgeBg: 'bg-red-100',
        badgeText: 'text-red-800',
      };
    case 'blue':
      return {
        cardText: 'text-blue-700',
        cardBg: 'bg-blue-50',
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-800',
      };
    case 'orange':
      return {
        cardText: 'text-orange-700',
        cardBg: 'bg-orange-50',
        badgeBg: 'bg-orange-100',
        badgeText: 'text-orange-800',
      };
    case 'gray':
    default:
      return {
        cardText: 'text-gray-700',
        cardBg: 'bg-gray-50',
        badgeBg: 'bg-gray-100',
        badgeText: 'text-gray-800',
      };
  }
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return dayjs(d).format('DD/MM/YY');
}

function getUserDisplayName(
  userId: string | null | undefined,
  users: Record<string, UserForFei>,
  fallback?: string | null
): string {
  if (userId && users[userId]) {
    const u = users[userId];
    return [u.prenom, u.nom_de_famille].filter(Boolean).join(' ').trim() || (fallback ?? '—');
  }
  return fallback ?? '—';
}

function getEntityDisplayName(
  entityId: string | null | undefined,
  entities: Record<string, EntityWithUserRelation>,
  fallback?: string | null
): string {
  if (entityId && entities[entityId]) {
    return entities[entityId].nom_d_usage || entities[entityId].raison_sociale || (fallback ?? '—');
  }
  return fallback ?? '—';
}

function getExaminateurDisplayName(fei: Fei, users: Record<string, UserForFei>): string {
  return getUserDisplayName(fei.examinateur_initial_user_id, users);
}

function getPremierDetenteurDisplayName(
  fei: Fei,
  users: Record<string, UserForFei>,
  entities: Record<string, EntityWithUserRelation>
): string {
  if (fei.premier_detenteur_entity_id && entities[fei.premier_detenteur_entity_id]) {
    return getEntityDisplayName(fei.premier_detenteur_entity_id, entities);
  }
  if (fei.premier_detenteur_user_id && users[fei.premier_detenteur_user_id]) {
    return getUserDisplayName(fei.premier_detenteur_user_id, users);
  }
  return fei.premier_detenteur_name_cache || '—';
}

type TimelineEvent = { date: Date; label: string };

function buildChasseurTimeline(
  fei: Fei,
  transmission: CarcasseTransmissionWihMetadata,
  carcasse: Carcasse,
  intermediaires: Array<CarcasseIntermediaire>,
  users: Record<string, UserForFei>,
  entities: Record<string, EntityWithUserRelation>
): Array<TimelineEvent> {
  const events: Array<TimelineEvent> = [];

  if (fei.date_mise_a_mort) {
    events.push({ date: new Date(fei.date_mise_a_mort), label: 'Mise à mort' });
  }

  if (
    fei.examinateur_initial_date_approbation_mise_sur_le_marche &&
    transmission.content.current_owner_role !== FeiOwnerRole.EXAMINATEUR_INITIAL
  ) {
    const premierDetenteur = getPremierDetenteurDisplayName(fei, users, entities);
    events.push({
      date: new Date(fei.examinateur_initial_date_approbation_mise_sur_le_marche),
      label: `Fiche transmise à ${premierDetenteur}`,
    });
  }

  if (transmission.content.premier_detenteur_depot_ccg_at) {
    const ccgName = getEntityDisplayName(
      transmission.content.premier_detenteur_depot_entity_id,
      entities,
      transmission.content.premier_detenteur_depot_entity_name_cache
    );
    events.push({
      date: new Date(transmission.content.premier_detenteur_depot_ccg_at),
      label: `Dépôt des carcasses ${ccgName}`,
    });
  }

  for (const ci of intermediaires) {
    if (!ci.prise_en_charge_at) continue;
    const entityName = getEntityDisplayName(ci.intermediaire_entity_id, entities);
    const isEtg = ci.intermediaire_role === 'ETG';
    events.push({
      date: new Date(ci.prise_en_charge_at),
      label: isEtg ? `Prise en charge par ETG ${entityName}` : `Carcasses prise en charge par ${entityName}`,
    });
  }

  if (carcasse.svi_carcasse_status_set_at) {
    events.push({
      date: new Date(carcasse.svi_carcasse_status_set_at),
      label: 'Contrôle par service vétérinaire',
    });
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export default function ExaminateurCarcasseDetail() {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const carcasse = state.carcasses[params.zacharie_carcasse_id!];
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

  useLoaderEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    loadData('carcasse')
      .then(() => {
        setHasTriedLoading(true);
      })
      .catch((error) => {
        setHasTriedLoading(true);
        console.error(error);
      });
  }, []);

  if (!fei || !carcasse) {
    return hasTriedLoading ? <NotFound /> : <Chargement />;
  }
  return <ExaminateurCarcasseDetailLoaded />;
}

function CarcasseHeaderCard({
  carcasse,
  statusLabel,
  statusIconId,
  accentColor,
}: {
  carcasse: Carcasse;
  statusLabel: string;
  statusIconId: string | null;
  accentColor: CardAccent;
}) {
  const isClosed = isCarcasseDone(carcasse);
  const colors = getAccentColorClasses(accentColor);

  return (
    <div className="fr-mb-2w rounded bg-white p-4 md:p-8 md:shadow-sm">
      <h1 className="fr-h5 fr-mb-2w">
        {carcasse.espece || 'Espèce —'} N°{carcasse.numero_bracelet}
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        {isClosed && (
          <Tag
            small
            className="items-center rounded-[4px] bg-[#E8EDFF] font-semibold text-[#01008B] uppercase"
          >
            Clôturée
          </Tag>
        )}
        <Tag
          small
          className={['items-center rounded-[4px] font-semibold', colors.badgeBg, colors.badgeText].join(' ')}
        >
          {statusIconId && (
            <span
              className={[statusIconId, 'fr-icon--sm mr-1'].join(' ')}
              aria-hidden="true"
            />
          )}
          {statusLabel}
        </Tag>
      </div>
    </div>
  );
}

function InfosChasseCard({
  fei,
  carcasse,
  examinateurName,
}: {
  fei: Fei;
  carcasse: Carcasse;
  examinateurName: string;
}) {
  return (
    <div className="fr-mb-2w rounded bg-white p-4 md:p-8 md:shadow-sm">
      <h2 className="fr-h4 fr-mb-2w">Informations de chasse</h2>
      <ul className="space-y-1">
        <li>Chasse du {formatDate(fei.date_mise_a_mort)}</li>
        <li>{carcasse.espece || '—'}</li>
        <li>Prélevé à {fei.commune_mise_a_mort || '—'}</li>
        <li>Examiné par {examinateurName}</li>
      </ul>
      <div className="fr-mt-3w">
        <Link
          to={`/app/chasseur/fei/${fei.numero}`}
          className="fr-link"
        >
          Voir la fiche {fei.numero} →
        </Link>
      </div>
    </div>
  );
}

function InfosSanitairesCard({
  carcasse,
  decisionLabel,
  accentColor,
}: {
  carcasse: Carcasse;
  decisionLabel: string;
  accentColor: CardAccent;
}) {
  if (!carcasse.svi_carcasse_status_set_at) return null;
  const colors = getAccentColorClasses(accentColor);
  const motifs = (carcasse.svi_ipm2_lesions_ou_motifs ?? []).filter(Boolean);
  const commentaire = carcasse.svi_ipm2_commentaire || carcasse.svi_carcasse_commentaire || '';

  return (
    <div className={['fr-mb-2w rounded p-4 md:p-8 md:shadow-sm', colors.cardBg].join(' ')}>
      <h2 className={['fr-h4 fr-mb-2w', colors.cardText].join(' ')}>Informations sanitaires</h2>
      <div className={colors.cardText}>
        <p className="font-semibold">Décision du vétérinaire</p>
        <p>
          {decisionLabel}
          {motifs.length > 0 && <> : {motifs.join(', ')}</>}
          {motifs.length > 0 && '.'}
        </p>
        {commentaire && (
          <>
            <p className="fr-mt-2w font-semibold">Commentaire</p>
            <p>{commentaire}</p>
          </>
        )}
      </div>
    </div>
  );
}

function TraceabiliteTimeline({ events }: { events: Array<TimelineEvent> }) {
  if (events.length === 0) return null;
  return (
    <div className="fr-mb-2w rounded bg-white p-4 md:p-8 md:shadow-sm">
      <h2 className="fr-h4 fr-mb-2w">Traçabilité</h2>
      <div className="relative border-l-2 border-gray-300 pl-4">
        {events.map((event, i) => (
          <div
            key={`${event.date.toISOString()}-${i}`}
            className="relative mb-4 last:mb-0"
          >
            <div className="absolute top-1 -left-[21px] h-2.5 w-2.5 rounded-full border-2 border-blue-600 bg-white" />
            <div className="text-sm">
              <span className="text-gray-500">{formatDate(event.date)}</span>{' '}
              <span className="font-semibold">{event.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExaminateurCarcasseDetailLoaded() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcasse = carcasses[params.zacharie_carcasse_id!];
  const transmission = useGetTransmissionFromCarcasse(carcasse);
  const users = useZustandStore((state) => state.users);
  const entities = useZustandStore((state) => state.entities);
  const updateStateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const addLog = useZustandStore((state) => state.addLog);
  const updateCarcasse = (
    zacharie_carcasse_id: Parameters<typeof updateStateCarcasse>[0],
    partialCarcasse: Parameters<typeof updateStateCarcasse>[1]
  ) => {
    updateStateCarcasse(zacharie_carcasse_id, partialCarcasse);
    addLog({
      user_id: user.id,
      user_role: UserRoles.CHASSEUR,
      fei_numero: fei.numero,
      action: 'examinateur-carcasse-edit',
      history: createHistoryInput(carcasse, partialCarcasse),
      entity_id: null,
      zacharie_carcasse_id,
      intermediaire_id: null,
      carcasse_intermediaire_id: null,
    });
  };

  const feiCarcasses = useCarcassesForFei(fei.numero);
  const existingsNumeroBracelet = feiCarcasses.map((c) => c.numero_bracelet);
  const [numeroError, setNumeroError] = useState<string | null>(null);

  const intermediaires = useCarcassesIntermediairesForCarcasse(carcasse.zacharie_carcasse_id);

  const navigate = useNavigate();
  const canEdit = useMemo(() => {
    if (fei.examinateur_initial_user_id !== user.id) {
      return false;
    }
    return true;
  }, [fei, user]);

  const examinateurName = useMemo(() => getExaminateurDisplayName(fei, users), [fei, users]);

  const timelineEvents = useMemo(
    () => buildChasseurTimeline(fei, transmission, carcasse, intermediaires, users, entities),
    [fei, carcasse, intermediaires, users, entities, transmission]
  );

  const viewRole: CardViewRole = 'chasseur';
  const cardDisplay = useMemo(
    () =>
      getCarcasseCardDisplay({
        carcasse,
        latestIntermediaire: intermediaires[0],
        entities,
        viewRole,
      }),
    [carcasse, intermediaires, entities]
  );
  const headerStatusLabel = cardDisplay.statusLabel ?? 'En cours de création';
  const headerAccentColor: CardAccent = cardDisplay.accentColor ?? 'gray';
  const headerStatusIconId = cardDisplay.iconId ?? null;

  const [espece, setEspece] = useState(carcasse.espece || '');

  const numeroFormRef = useRef<HTMLFormElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <title>{`Carcasse ${carcasse.numero_bracelet} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
            <Breadcrumb
              className="[&_a]:text-base!"
              currentPageLabel={`Carcasse ${carcasse.numero_bracelet}`}
              segments={[
                {
                  label: 'Mes fiches',
                  linkProps: {
                    to: '/app/chasseur/fiches',
                    href: '#',
                  },
                },
                {
                  label: fei.numero,
                  linkProps: {
                    to: `/app/chasseur/fei/${fei.numero}`,
                    href: '#',
                  },
                },
              ]}
            />

            <CarcasseHeaderCard
              carcasse={carcasse}
              statusLabel={headerStatusLabel}
              statusIconId={headerStatusIconId}
              accentColor={headerAccentColor}
            />

            <InfosChasseCard
              fei={fei}
              carcasse={carcasse}
              examinateurName={examinateurName}
            />

            {canEdit && (
              <div className="fr-mb-2w rounded bg-white p-4 md:p-8 md:shadow-sm">
                <h2 className="fr-h4 fr-mb-2w">Examen initial</h2>
                <form
                  id="carcasse-edit-form"
                  method="POST"
                  ref={numeroFormRef}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(numeroFormRef.current!);
                    const nextNumeroBracelet = formData.get(
                      Prisma.CarcasseScalarFieldEnum.numero_bracelet
                    ) as string;
                    if (existingsNumeroBracelet.includes(nextNumeroBracelet)) {
                      setNumeroError('Le numéro de marquage est déjà utilisé pour cette fiche');
                      return;
                    }
                    setNumeroError(null);
                    updateCarcasse(carcasse.zacharie_carcasse_id, {
                      numero_bracelet: formData.get(Prisma.CarcasseScalarFieldEnum.numero_bracelet) as string,
                      examinateur_signed_at: dayjs().toDate(),
                    });
                  }}
                >
                  <Input
                    label={
                      carcasse.type === CarcasseType.PETIT_GIBIER
                        ? "Numéro d'identification"
                        : 'Numéro de marquage'
                    }
                    state={numeroError ? 'error' : 'default'}
                    stateRelatedMessage={numeroError ?? ''}
                    nativeInputProps={{
                      type: 'text',
                      name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
                      defaultValue: carcasse.numero_bracelet,
                    }}
                  />
                  <div className="flex justify-end">
                    <Button type="submit">Modifier</Button>
                  </div>
                </form>

                <form
                  id="carcasse-metadata-form"
                  method="POST"
                  ref={formRef}
                  className="fr-mt-3w"
                >
                  <Select
                    label="Sélectionnez l'espèce du gibier"
                    className="group mb-0! grow"
                    nativeSelectProps={{
                      name: Prisma.CarcasseScalarFieldEnum.espece,
                      value: espece,
                      disabled: !canEdit,
                      onChange: (e) => {
                        const newEspece = e.currentTarget.value;
                        setEspece(newEspece);
                        updateCarcasse(carcasse.zacharie_carcasse_id, {
                          espece: newEspece,
                          type: petitGibier.especes.includes(espece)
                            ? CarcasseType.PETIT_GIBIER
                            : CarcasseType.GROS_GIBIER,
                          examinateur_signed_at: dayjs().toDate(),
                        });
                      },
                    }}
                  >
                    <option value="">Sélectionnez l'espèce du gibier</option>
                    <hr />
                    {Object.entries(gibierSelect).map(([typeGibier, _especes]) => {
                      return (
                        <optgroup
                          label={typeGibier}
                          key={typeGibier}
                        >
                          {_especes.map((_espece: string) => {
                            return (
                              <option
                                value={_espece}
                                key={_espece}
                              >
                                {_espece}
                              </option>
                            );
                          })}
                        </optgroup>
                      );
                    })}
                  </Select>
                  <Input
                    label="Nombre de carcasses"
                    className={[
                      'mb-0! grow',
                      carcasse.type === CarcasseType.GROS_GIBIER ? 'hidden' : '',
                    ].join(' ')}
                    hintText="Optionel"
                    nativeInputProps={{
                      type: 'number',
                      min: 0,
                      name: Prisma.CarcasseScalarFieldEnum.nombre_d_animaux,
                      defaultValue:
                        carcasse.type === CarcasseType.GROS_GIBIER ? '1' : (carcasse.nombre_d_animaux ?? ''),
                      disabled: carcasse.type === CarcasseType.GROS_GIBIER,
                      onChange: (e) => {
                        updateCarcasse(carcasse.zacharie_carcasse_id, {
                          nombre_d_animaux: Number(e.currentTarget.value),
                          examinateur_signed_at: dayjs().toDate(),
                        });
                      },
                    }}
                  />
                </form>

                {espece && (
                  <>
                    <div className="fr-mt-3w">
                      <h3 className="fr-h5 fr-mb-2w">Anomalies</h3>
                      <AnomaliesTreeNavigator
                        key={carcasse.zacharie_carcasse_id}
                        sections={buildCarcasseNavSections(carcasse)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <InfosSanitairesCard
              carcasse={carcasse}
              decisionLabel={cardDisplay.statusLabel ?? 'Décision rendue'}
              accentColor={cardDisplay.accentColor}
            />

            {TRICHINE_FEATURE_ENABLED && carcasse.espece === 'Sanglier' && (
              <TrichineSection carcasse={carcasse} />
            )}

            <TraceabiliteTimeline events={timelineEvents} />

            <div className="z-50 flex w-full flex-col justify-between gap-2 md:flex-row">
              <Button
                priority="secondary"
                type="button"
                onClick={() => navigate(-1)}
              >
                Retour
              </Button>
              {canEdit && (
                <Button
                  priority="primary"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    updateCarcasse(carcasse.zacharie_carcasse_id, {
                      examinateur_signed_at: dayjs().toDate(),
                      examinateur_carcasse_sans_anomalie:
                        (carcasse.examinateur_anomalies_abats?.length ?? 0) === 0 &&
                        (carcasse.examinateur_anomalies_carcasse?.length ?? 0) === 0,
                    });
                    navigate(-1);
                  }}
                >
                  Enregistrer
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
