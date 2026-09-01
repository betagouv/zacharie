import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { TrichineResultatAnalyse, type TrichineHistoriqueStatut } from '@prisma/client';
import Chargement from '@app/components/Chargement';
import TrichineIntrouvable from '@app/components/trichine/TrichineIntrouvable';
import TrichineChaine, { type ChaineEtape } from '@app/components/trichine/TrichineChaine';
import TrichineChronologie from '@app/components/trichine/TrichineChronologie';
import TrichineDetailPage, {
  TrichineCard,
  TrichineFields,
} from '@app/components/trichine/TrichineDetailPage';
import TrichineResultatCard from '@app/components/trichine/TrichineResultatCard';
import {
  useTrichineBasePath,
  useTrichineCarcasseLink,
  useTrichinePrelevementEnLot,
} from '@app/utils/trichine-hooks';
import {
  getTrichinePool,
  modifierTrichinePool,
  renoncerDeuxiemeIntention,
  retirerEchantillonDuPool,
  supprimerTrichinePool,
  type TrichinePoolDetail,
} from '@app/services/trichine';
import {
  poolEstFige,
  sitePrelevementLabels,
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
  statutUtilisateurBadgeSeverity,
  statutUtilisateurPool,
  trichineTypeLabels,
} from '@app/utils/trichine';

const modifierModal = createModal({ isOpenedByDefault: false, id: 'trichine-pool-modifier' });
const supprimerModal = createModal({ isOpenedByDefault: false, id: 'trichine-pool-supprimer' });

export default function TrichinePoolDetailPage() {
  const { reference } = useParams();
  const basePath = useTrichineBasePath();
  const carcasseLink = useTrichineCarcasseLink();
  // Le renoncement appartient au circuit court : en circuit agréé, la décision passe par l'IPM
  const circuitAgree = useTrichinePrelevementEnLot();
  const [pool, setPool] = useState<TrichinePoolDetail | null>(null);
  const [historique, setHistorique] = useState<Array<TrichineHistoriqueStatut>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(() => {
    if (!reference) return;
    getTrichinePool(reference)
      .then((response) => {
        if (response.ok && response.data) {
          setPool(response.data.pool);
          setHistorique(response.data.historique);
        } else {
          setPool(null);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [reference]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    refresh();
  }, [refresh]);

  if (isLoading) return <Chargement />;
  if (!pool) {
    return (
      <TrichineIntrouvable
        objet="Pool"
        reference={reference}
        retour={{ to: `${basePath}/pools`, label: 'Voir tous les pools' }}
        basePath={basePath}
      />
    );
  }

  const ftpLinks = pool.TrichinePoolFTPs.filter((link) => !link.TrichineFTP.deleted_at);
  const dernierLien = ftpLinks[ftpLinks.length - 1];
  const derniereFtp = dernierLien?.TrichineFTP;
  const laboratoire = derniereFtp
    ? derniereFtp.DestinataireEntity.nom_d_usage || derniereFtp.DestinataireEntity.raison_sociale
    : null;
  const carcasses = pool.TrichineEchantillons.map((echantillon) => echantillon.Carcasse);
  const masseTotale = pool.TrichineEchantillons.reduce(
    (total, echantillon) => total + echantillon.masse_grammes,
    0
  );
  const statutUtilisateur = statutUtilisateurPool(pool);
  // Renoncer aux analyses de 2e intention : circuit court, sur un pool douteux non encore tranché
  const peutRenoncer = pool.resultat_analyse === TrichineResultatAnalyse.DOUTEUX;
  // Une fois le colis parti, la fiche papier fait foi : la composition ne bouge plus
  const fige = poolEstFige(pool);

  const etapes: Array<ChaineEtape> = [
    {
      label: carcasses.length > 1 ? 'Carcasses' : 'Carcasse',
      value: carcasses.length === 1 ? (carcasses[0].numero_bracelet ?? '—') : `${carcasses.length} carcasses`,
      to: carcasses.length === 1 ? (carcasseLink(carcasses[0]) ?? undefined) : undefined,
    },
    {
      label: pool.TrichineEchantillons.length > 1 ? 'Échantillons' : 'Échantillon',
      value:
        pool.TrichineEchantillons.length === 1
          ? pool.TrichineEchantillons[0].reference_echantillon
          : `${pool.TrichineEchantillons.length} échantillons`,
      to:
        pool.TrichineEchantillons.length === 1
          ? `${basePath}/echantillons/${pool.TrichineEchantillons[0].reference_echantillon}`
          : `${basePath}/echantillons`,
    },
    { label: 'Pool', value: pool.reference_pool, current: true },
    derniereFtp
      ? { label: 'FTP', value: derniereFtp.numero_fiche, to: `${basePath}/ftp/${derniereFtp.numero_fiche}` }
      : { label: 'FTP', value: 'Pas encore envoyé', absent: true },
    laboratoire
      ? { label: 'Laboratoire', value: laboratoire }
      : { label: 'Laboratoire', value: 'À désigner', absent: true },
  ];

  return (
    <TrichineDetailPage
      surtitre="Pool d'analyse"
      titre={pool.reference_pool}
      retour={{ to: `${basePath}/pools`, label: 'Tous les pools' }}
      badges={
        <>
          <Badge severity={statutUtilisateurBadgeSeverity(statutUtilisateur)}>{statutUtilisateur}</Badge>
          <Badge severity={statutAnalyseBadgeSeverity(pool.statut)}>{statutAnalyseLabels[pool.statut]}</Badge>
          <Badge severity="info">{trichineTypeLabels[pool.type]}</Badge>
        </>
      }
      actions={
        <>
          {!fige && (
            <>
              <Button
                type="button"
                priority="secondary"
                onClick={() => modifierModal.open()}
              >
                Modifier
              </Button>
              <Button
                type="button"
                priority="secondary"
                onClick={() => supprimerModal.open()}
              >
                Supprimer
              </Button>
            </>
          )}
          {peutRenoncer && (
            <>
              <Button linkProps={{ to: `${basePath}/pools/${pool.reference_pool}/2e-intention` }}>
                Analyses de 2e intention
              </Button>
              {!circuitAgree && (
                <Button
                  type="button"
                  priority="secondary"
                  disabled={isSubmitting}
                  onClick={() => {
                    setIsSubmitting(true);
                    renoncerDeuxiemeIntention(pool.id)
                      .then((response) => {
                        if (response.ok) {
                          toast.success('Carcasses retirées de leur fiche');
                          refresh();
                        } else {
                          toast.error(response.error || 'Une erreur est survenue');
                        }
                      })
                      .catch(() => toast.error('Une erreur est survenue'))
                      .finally(() => setIsSubmitting(false));
                  }}
                >
                  Renoncer à la 2e intention
                </Button>
              )}
            </>
          )}
        </>
      }
      chaine={<TrichineChaine etapes={etapes} />}
      aside={
        <>
          <TrichineCard titre="Informations">
            <TrichineFields
              disposition="lignes"
              fields={[
                { label: 'Type', value: trichineTypeLabels[pool.type] },
                {
                  label: 'Constitué le',
                  value: dayjs(pool.date_constitution).format('DD/MM/YYYY'),
                },
                { label: 'Masse totale', value: `${masseTotale} g` },
                !!pool.PoolParent && {
                  label: 'Pool parent',
                  value: (
                    <Link
                      to={`${basePath}/pools/${pool.PoolParent.reference_pool}`}
                      className="fr-link"
                    >
                      {pool.PoolParent.reference_pool}
                    </Link>
                  ),
                },
              ]}
            />
          </TrichineCard>
          <TrichineChronologie historique={historique} />
        </>
      }
    >
      <TrichineResultatCard
        pool={pool}
        laboratoire={laboratoire}
        referenceLabo={dernierLien?.reference_labo}
      />

      <TrichineCard
        titre="Composition"
        hint={`${pool.TrichineEchantillons.length} échantillon${pool.TrichineEchantillons.length > 1 ? 's' : ''} — ${masseTotale} g`}
      >
        <ul className="m-0 list-none space-y-3 p-0">
          {pool.TrichineEchantillons.map((echantillon) => {
            const lienCarcasse = carcasseLink(echantillon.Carcasse);
            return (
              <li
                key={echantillon.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <Link
                    to={`${basePath}/echantillons/${echantillon.reference_echantillon}`}
                    className="fr-link"
                  >
                    {echantillon.reference_echantillon}
                  </Link>
                  <p className="fr-text--sm fr-mb-0 text-gray-600">
                    {lienCarcasse ? (
                      <Link
                        to={lienCarcasse}
                        className="fr-link fr-link--sm"
                      >
                        {echantillon.Carcasse.numero_bracelet}
                      </Link>
                    ) : (
                      echantillon.Carcasse.numero_bracelet
                    )}
                    {echantillon.Carcasse.Fei?.commune_mise_a_mort
                      ? ` — ${echantillon.Carcasse.Fei.commune_mise_a_mort}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="fr-text--sm fr-mb-0 text-gray-600">
                    {sitePrelevementLabels[echantillon.site_prelevement]} — {echantillon.masse_grammes} g —
                    prélevé le {dayjs(echantillon.date_prelevement).format('DD/MM/YYYY')}
                  </p>
                  {!fige && pool.TrichineEchantillons.length > 1 && (
                    <button
                      type="button"
                      className="fr-link fr-text--sm"
                      disabled={isSubmitting}
                      onClick={() => {
                        setIsSubmitting(true);
                        retirerEchantillonDuPool(echantillon.id)
                          .then((response) => {
                            if (response.ok) {
                              toast.success(`${echantillon.reference_echantillon} retiré du pool`);
                              refresh();
                            } else {
                              toast.error(response.error || 'Une erreur est survenue');
                            }
                          })
                          .catch(() => toast.error('Une erreur est survenue'))
                          .finally(() => setIsSubmitting(false));
                      }}
                    >
                      Retirer
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </TrichineCard>

      {pool.PoolsFilles.length > 0 && (
        <TrichineCard
          titre="Analyses de 2e intention"
          hint="Pools issus de ce pool pour affiner le résultat"
        >
          <ul className="m-0 list-none space-y-2 p-0">
            {pool.PoolsFilles.map((fille) => (
              <li
                key={fille.reference_pool}
                className="flex flex-wrap items-center gap-2"
              >
                <Link
                  to={`${basePath}/pools/${fille.reference_pool}`}
                  className="fr-link"
                >
                  {fille.reference_pool}
                </Link>
                <Badge
                  small
                  severity={statutAnalyseBadgeSeverity(fille.statut)}
                >
                  {statutAnalyseLabels[fille.statut]}
                </Badge>
              </li>
            ))}
          </ul>
        </TrichineCard>
      )}

      {ftpLinks.length > 0 && (
        <TrichineCard
          titre="Transmissions"
          hint="Fiches de transmission qui ont porté ce pool"
        >
          <ul className="m-0 list-none space-y-2 p-0">
            {ftpLinks.map((link) => (
              <li
                key={link.TrichineFTP.id}
                className="flex flex-wrap items-baseline gap-2"
              >
                <Link
                  to={`${basePath}/ftp/${link.TrichineFTP.numero_fiche}`}
                  className="fr-link"
                >
                  {link.TrichineFTP.numero_fiche}
                </Link>
                <span className="fr-text--sm m-0 text-gray-600">
                  {link.TrichineFTP.DestinataireEntity.nom_d_usage ||
                    link.TrichineFTP.DestinataireEntity.raison_sociale}
                  {link.TrichineFTP.date_envoi
                    ? ` — envoyée le ${dayjs(link.TrichineFTP.date_envoi).format('DD/MM/YYYY')}`
                    : ' — brouillon'}
                </span>
              </li>
            ))}
          </ul>
        </TrichineCard>
      )}

      <ModifierModalContent
        pool={pool}
        onDone={refresh}
      />

      <supprimerModal.Component title={`Supprimer le pool ${pool.reference_pool}`}>
        <p className="fr-text--sm">
          Le pool disparaîtra de vos listes. Ses {pool.TrichineEchantillons.length} échantillon
          {pool.TrichineEchantillons.length > 1 ? 's' : ''} ne sont pas supprimés : ils redeviennent
          disponibles pour un autre pool.
        </p>
        <Button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            setIsSubmitting(true);
            supprimerTrichinePool(pool.id)
              .then((response) => {
                if (response.ok) {
                  toast.success(`Pool ${pool.reference_pool} supprimé`);
                  supprimerModal.close();
                  navigate(`${basePath}/pools`);
                } else {
                  toast.error(response.error || 'Une erreur est survenue');
                }
              })
              .catch(() => toast.error('Une erreur est survenue'))
              .finally(() => setIsSubmitting(false));
          }}
        >
          Confirmer la suppression
        </Button>
      </supprimerModal.Component>
    </TrichineDetailPage>
  );
}

function ModifierModalContent({ pool, onDone }: { pool: TrichinePoolDetail; onDone: () => void }) {
  const [dateConstitution, setDateConstitution] = useState(
    dayjs(pool.date_constitution).format('YYYY-MM-DD')
  );
  const [commentaire, setCommentaire] = useState(pool.commentaire ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Réaligne le formulaire sur le pool rechargé après un enregistrement
  useEffect(() => {
    setDateConstitution(dayjs(pool.date_constitution).format('YYYY-MM-DD'));
    setCommentaire(pool.commentaire ?? '');
  }, [pool]);

  return (
    <modifierModal.Component title={`Modifier le pool ${pool.reference_pool}`}>
      <p className="fr-text--sm">La composition se modifie depuis la liste des échantillons ci-dessous.</p>
      <Input
        label="Date de constitution"
        nativeInputProps={{
          type: 'date',
          value: dateConstitution,
          onChange: (event) => setDateConstitution(event.target.value),
        }}
      />
      <Input
        label="Commentaire (optionnel)"
        textArea
        nativeTextAreaProps={{
          value: commentaire,
          onChange: (event) => setCommentaire(event.target.value),
        }}
      />
      <Button
        type="button"
        disabled={isSubmitting}
        onClick={() => {
          setIsSubmitting(true);
          modifierTrichinePool(pool.id, { date_constitution: dateConstitution, commentaire })
            .then((response) => {
              if (response.ok) {
                toast.success('Pool modifié');
                modifierModal.close();
                onDone();
              } else {
                toast.error(response.error || 'Une erreur est survenue');
              }
            })
            .catch(() => toast.error('Une erreur est survenue'))
            .finally(() => setIsSubmitting(false));
        }}
      >
        Enregistrer
      </Button>
    </modifierModal.Component>
  );
}
