import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { TrichineSitePrelevement, type TrichineHistoriqueStatut } from '@prisma/client';
import Chargement from '@app/components/Chargement';
import TrichineIntrouvable from '@app/components/trichine/TrichineIntrouvable';
import TrichineChaine, { type ChaineEtape } from '@app/components/trichine/TrichineChaine';
import TrichineChronologie from '@app/components/trichine/TrichineChronologie';
import TrichineDetailPage, {
  TrichineCard,
  TrichineFields,
} from '@app/components/trichine/TrichineDetailPage';
import { useTrichineBasePath, useTrichineCarcasseLink } from '@app/utils/trichine-hooks';
import {
  getTrichineEchantillon,
  modifierTrichineEchantillon,
  retirerEchantillonDuPool,
  supprimerTrichineEchantillon,
  type TrichineEchantillonDetail,
} from '@app/services/trichine';
import {
  poolEstFige,
  resultatAnalyseLabels,
  resultatBadgeSeverity,
  sitePrelevementLabels,
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
  trichineTypeLabels,
} from '@app/utils/trichine';

const modifierModal = createModal({ isOpenedByDefault: false, id: 'trichine-echantillon-modifier' });
const supprimerModal = createModal({ isOpenedByDefault: false, id: 'trichine-echantillon-supprimer' });

export default function TrichineEchantillonDetailPage() {
  const { reference } = useParams();
  const basePath = useTrichineBasePath();
  const carcasseLink = useTrichineCarcasseLink();
  const [echantillon, setEchantillon] = useState<TrichineEchantillonDetail | null>(null);
  const [historique, setHistorique] = useState<Array<TrichineHistoriqueStatut>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(() => {
    if (!reference) return;
    getTrichineEchantillon(reference)
      .then((response) => {
        if (response.ok && response.data) {
          setEchantillon(response.data.echantillon);
          setHistorique(response.data.historique);
        } else {
          setEchantillon(null);
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
  if (!echantillon) {
    return (
      <TrichineIntrouvable
        objet="Échantillon"
        reference={reference}
        retour={{ to: `${basePath}/echantillons`, label: 'Voir tous les échantillons' }}
        basePath={basePath}
      />
    );
  }

  const pool = echantillon.TrichinePool;
  const ftpLinks = pool?.TrichinePoolFTPs.filter((link) => !link.TrichineFTP.deleted_at) ?? [];
  const derniereFtp = ftpLinks[ftpLinks.length - 1]?.TrichineFTP;
  const laboratoire = derniereFtp
    ? derniereFtp.DestinataireEntity.nom_d_usage || derniereFtp.DestinataireEntity.raison_sociale
    : null;
  const lienCarcasse = carcasseLink(echantillon.Carcasse);
  // Une fois le colis parti, la fiche papier fait foi : plus rien n'est modifiable
  const fige = !!pool && poolEstFige(pool);

  const etapes: Array<ChaineEtape> = [
    {
      label: 'Carcasse',
      value: echantillon.Carcasse.numero_bracelet ?? '—',
      to: lienCarcasse ?? undefined,
    },
    { label: 'Échantillon', value: echantillon.reference_echantillon, current: true },
    pool
      ? { label: 'Pool', value: pool.reference_pool, to: `${basePath}/pools/${pool.reference_pool}` }
      : { label: 'Pool', value: 'À regrouper', absent: true },
    derniereFtp
      ? { label: 'FTP', value: derniereFtp.numero_fiche, to: `${basePath}/ftp/${derniereFtp.numero_fiche}` }
      : { label: 'FTP', value: 'Pas encore envoyé', absent: true },
    laboratoire
      ? { label: 'Laboratoire', value: laboratoire }
      : { label: 'Laboratoire', value: 'À désigner', absent: true },
  ];

  return (
    <TrichineDetailPage
      surtitre="Échantillon"
      titre={echantillon.reference_echantillon}
      retour={{ to: `${basePath}/echantillons`, label: 'Tous les échantillons' }}
      badges={
        <>
          <Badge severity={statutAnalyseBadgeSeverity(echantillon.statut)}>
            {statutAnalyseLabels[echantillon.statut]}
          </Badge>
          {!!echantillon.resultat_analyse && (
            <Badge severity={resultatBadgeSeverity(echantillon.resultat_analyse)}>
              {resultatAnalyseLabels[echantillon.resultat_analyse]}
            </Badge>
          )}
        </>
      }
      actions={
        fige ? undefined : (
          <>
            <Button
              type="button"
              priority="secondary"
              onClick={() => modifierModal.open()}
            >
              Modifier
            </Button>
            {pool ? (
              <Button
                type="button"
                priority="secondary"
                disabled={isSubmitting}
                onClick={() => {
                  setIsSubmitting(true);
                  retirerEchantillonDuPool(echantillon.id)
                    .then((response) => {
                      if (response.ok) {
                        toast.success(`Échantillon retiré du pool ${pool.reference_pool}`);
                        refresh();
                      } else {
                        toast.error(response.error || 'Une erreur est survenue');
                      }
                    })
                    .catch(() => toast.error('Une erreur est survenue'))
                    .finally(() => setIsSubmitting(false));
                }}
              >
                Retirer du pool
              </Button>
            ) : (
              <Button
                type="button"
                priority="secondary"
                onClick={() => supprimerModal.open()}
              >
                Supprimer
              </Button>
            )}
          </>
        )
      }
      chaine={<TrichineChaine etapes={etapes} />}
      aside={
        <>
          <TrichineCard titre="Prélèvement">
            <TrichineFields
              disposition="lignes"
              fields={[
                { label: 'Type', value: trichineTypeLabels[echantillon.type] },
                {
                  label: 'Site de prélèvement',
                  value: sitePrelevementLabels[echantillon.site_prelevement],
                },
                { label: 'Masse', value: `${echantillon.masse_grammes} g` },
                {
                  label: 'Prélevé le',
                  value: dayjs(echantillon.date_prelevement).format('DD/MM/YYYY'),
                },
              ]}
            />
          </TrichineCard>
          <TrichineChronologie historique={historique} />
        </>
      }
    >
      <TrichineCard
        titre="Carcasse prélevée"
        actions={
          lienCarcasse ? (
            <Link
              to={lienCarcasse}
              className="fr-link"
            >
              Voir la fiche carcasse
            </Link>
          ) : undefined
        }
      >
        <TrichineFields
          fields={[
            { label: 'N° de marquage', value: echantillon.Carcasse.numero_bracelet },
            { label: 'Espèce', value: echantillon.Carcasse.espece },
            !!echantillon.Carcasse.date_mise_a_mort && {
              label: 'Mise à mort',
              value: dayjs(echantillon.Carcasse.date_mise_a_mort).format('DD/MM/YYYY'),
            },
            !!echantillon.Carcasse.Fei?.commune_mise_a_mort && {
              label: 'Commune',
              value: echantillon.Carcasse.Fei.commune_mise_a_mort,
            },
            !!echantillon.Carcasse.fei_numero && {
              label: 'Fiche',
              value: echantillon.Carcasse.fei_numero,
            },
          ]}
        />
      </TrichineCard>

      <TrichineCard
        titre="Analyse"
        hint="Le résultat est porté par le pool : un échantillon n'est jamais analysé seul."
      >
        {pool ? (
          <TrichineFields
            fields={[
              {
                label: 'Pool',
                value: (
                  <Link
                    to={`${basePath}/pools/${pool.reference_pool}`}
                    className="fr-link"
                  >
                    {pool.reference_pool}
                  </Link>
                ),
              },
              { label: 'Statut du pool', value: statutAnalyseLabels[pool.statut] },
              {
                label: 'Résultat',
                value: pool.resultat_analyse ? resultatAnalyseLabels[pool.resultat_analyse] : 'En attente',
              },
              !!laboratoire && { label: 'Laboratoire', value: laboratoire },
            ]}
          />
        ) : (
          <p className="fr-text--sm fr-mb-0 text-gray-600">
            Cet échantillon n'est rattaché à aucun pool. Regroupez-le avec d'autres échantillons pour
            l'envoyer au laboratoire.
          </p>
        )}
      </TrichineCard>

      {!!echantillon.commentaire && (
        <TrichineCard titre="Commentaire">
          <p className="fr-text--sm fr-mb-0">{echantillon.commentaire}</p>
        </TrichineCard>
      )}

      <ModifierModalContent
        echantillon={echantillon}
        onDone={refresh}
      />

      <supprimerModal.Component title={`Supprimer l'échantillon ${echantillon.reference_echantillon}`}>
        <p className="fr-text--sm">
          L'échantillon disparaîtra de vos listes et la carcasse {echantillon.Carcasse.numero_bracelet}{' '}
          repassera à prélever. Cette action reste tracée dans l'historique.
        </p>
        <Button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            setIsSubmitting(true);
            supprimerTrichineEchantillon(echantillon.id)
              .then((response) => {
                if (response.ok) {
                  toast.success(`Échantillon ${echantillon.reference_echantillon} supprimé`);
                  supprimerModal.close();
                  navigate(`${basePath}/echantillons`);
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

function ModifierModalContent({
  echantillon,
  onDone,
}: {
  echantillon: TrichineEchantillonDetail;
  onDone: () => void;
}) {
  const [site, setSite] = useState<TrichineSitePrelevement>(echantillon.site_prelevement);
  const [masse, setMasse] = useState(String(echantillon.masse_grammes));
  const [datePrelevement, setDatePrelevement] = useState(
    dayjs(echantillon.date_prelevement).format('YYYY-MM-DD')
  );
  const [commentaire, setCommentaire] = useState(echantillon.commentaire ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Réaligne le formulaire sur l'échantillon rechargé après un enregistrement
  useEffect(() => {
    setSite(echantillon.site_prelevement);
    setMasse(String(echantillon.masse_grammes));
    setDatePrelevement(dayjs(echantillon.date_prelevement).format('YYYY-MM-DD'));
    setCommentaire(echantillon.commentaire ?? '');
  }, [echantillon]);

  return (
    <modifierModal.Component title={`Modifier l'échantillon ${echantillon.reference_echantillon}`}>
      <Select
        label="Site de prélèvement"
        nativeSelectProps={{
          value: site,
          onChange: (event) => setSite(event.target.value as TrichineSitePrelevement),
        }}
      >
        {Object.values(TrichineSitePrelevement).map((option) => (
          <option
            key={option}
            value={option}
          >
            {sitePrelevementLabels[option]}
          </option>
        ))}
      </Select>
      <Input
        label="Masse (g)"
        nativeInputProps={{
          type: 'number',
          min: 1,
          value: masse,
          onChange: (event) => setMasse(event.target.value),
        }}
      />
      <Input
        label="Date de prélèvement"
        nativeInputProps={{
          type: 'date',
          value: datePrelevement,
          onChange: (event) => setDatePrelevement(event.target.value),
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
        disabled={isSubmitting || !Number(masse)}
        onClick={() => {
          setIsSubmitting(true);
          modifierTrichineEchantillon(echantillon.id, {
            site_prelevement: site,
            masse_grammes: Number(masse),
            date_prelevement: datePrelevement,
            commentaire,
          })
            .then((response) => {
              if (response.ok) {
                toast.success('Échantillon modifié');
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
