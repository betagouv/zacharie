import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { EntityTypes, TrichineStatutLogistiqueFTP, type TrichineHistoriqueStatut } from '@prisma/client';
import Chargement from '@app/components/Chargement';
import TrichineIntrouvable from '@app/components/trichine/TrichineIntrouvable';
import TrichineChaine, { type ChaineEtape } from '@app/components/trichine/TrichineChaine';
import TrichineChronologie from '@app/components/trichine/TrichineChronologie';
import TrichineFTPPdfActions from '@app/components/trichine/TrichineFTPPdfActions';
import TrichineDetailPage, {
  TrichineCard,
  TrichineFields,
} from '@app/components/trichine/TrichineDetailPage';
import {
  annulerTrichineFTP,
  envoyerTrichineFTP,
  getTrichineFTP,
  getTrichineLaboratoires,
  getTrichinePools,
  modifierTrichineFTP,
  supprimerTrichineFTP,
  type TrichineFTPDetail as TrichineFTPDetailType,
  type TrichineLaboratoire,
  type TrichinePartieConcernee,
  type TrichinePoolPopulated,
} from '@app/services/trichine';
import { useTrichineBasePath } from '@app/utils/trichine-hooks';
import {
  etapeFTP,
  poolSansFTP,
  resultatAnalyseLabels,
  resultatBadgeSeverity,
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
  statutLogistiqueLabels,
} from '@app/utils/trichine';

const modifierModal = createModal({ isOpenedByDefault: false, id: 'trichine-ftp-modifier' });
const supprimerModal = createModal({ isOpenedByDefault: false, id: 'trichine-ftp-supprimer' });
const annulerModal = createModal({ isOpenedByDefault: false, id: 'trichine-ftp-annuler' });
const ajouterPoolModal = createModal({ isOpenedByDefault: false, id: 'trichine-ftp-ajouter-pool' });

/** Nombre de carcasses représentées par un pool : une carcasse peut porter plusieurs échantillons. */
function carcassesDuPool(pool: { TrichineEchantillons: Array<{ zacharie_carcasse_id: string }> }) {
  return new Set(pool.TrichineEchantillons.map((echantillon) => echantillon.zacharie_carcasse_id)).size;
}

/** Détail d'une fiche de transmission des prélèvements : composition, envoi, suivi. */
export default function TrichineFTPDetail() {
  const { reference } = useParams();
  const basePath = useTrichineBasePath();
  const [ftp, setFtp] = useState<TrichineFTPDetailType | null>(null);
  const [historique, setHistorique] = useState<Array<TrichineHistoriqueStatut>>([]);
  const [etgs, setEtgs] = useState<Array<TrichinePartieConcernee>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(() => {
    if (!reference) return;
    getTrichineFTP(reference)
      .then((response) => {
        if (response.ok && response.data) {
          setFtp(response.data.ftp);
          setHistorique(response.data.historique);
          setEtgs(response.data.etgs);
        } else {
          setFtp(null);
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
  if (!ftp) {
    return (
      <TrichineIntrouvable
        objet="Transmission"
        reference={reference}
        retour={{ to: `${basePath}/ftp`, label: 'Voir toutes les transmissions' }}
        basePath={basePath}
      />
    );
  }

  const isBrouillon = ftp.statut_logistique === TrichineStatutLogistiqueFTP.BROUILLON;
  // Le colis est parti mais le laboratoire ne l'a pas réceptionné : l'annulation reste possible
  const isAnnulable = ftp.statut_logistique === TrichineStatutLogistiqueFTP.ENVOYEE;
  const isAnnulee = ftp.statut_logistique === TrichineStatutLogistiqueFTP.ANNULEE;
  const laboratoire = ftp.DestinataireEntity.nom_d_usage || ftp.DestinataireEntity.raison_sociale;
  const pools = ftp.TrichinePoolFTPs.map((link) => link.TrichinePool);
  const echantillons = pools.flatMap((pool) => pool.TrichineEchantillons);
  const carcasses = new Set(echantillons.map((echantillon) => echantillon.Carcasse.zacharie_carcasse_id));
  const etape = etapeFTP(ftp);
  const isExpediteurSvi = ftp.ExpediteurEntity?.type === EntityTypes.SVI;

  const etapes: Array<ChaineEtape> = [
    { label: carcasses.size > 1 ? 'Carcasses' : 'Carcasse', value: `${carcasses.size}` },
    {
      label: 'Échantillons',
      value: `${echantillons.length}`,
      to: `${basePath}/echantillons`,
    },
    {
      label: pools.length > 1 ? 'Pools' : 'Pool',
      value: pools.length === 1 ? pools[0].reference_pool : `${pools.length} pools`,
      to: pools.length === 1 ? `${basePath}/pools/${pools[0].reference_pool}` : `${basePath}/pools`,
    },
    { label: 'FTP', value: ftp.numero_fiche, current: true },
    { label: 'Laboratoire', value: laboratoire ?? '—' },
  ];

  return (
    <TrichineDetailPage
      surtitre={`Fiche de transmission des prélèvements${ftp.DestinataireEntity.is_lnr ? ' — confirmation LNR' : ''}`}
      titre={ftp.numero_fiche}
      retour={{ to: `${basePath}/ftp`, label: 'Toutes les transmissions' }}
      badges={
        <>
          <Badge severity={etape.severity}>{etape.label}</Badge>
          <p className="fr-text--sm fr-mb-0 max-w-prose basis-full text-gray-600">{etape.explication}</p>
        </>
      }
      actions={
        <>
          <TrichineFTPPdfActions
            space="trichine"
            ftpId={ftp.id}
            numeroFiche={ftp.numero_fiche}
          />
          {isBrouillon && (
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
          {isAnnulable && (
            <Button
              type="button"
              priority="secondary"
              onClick={() => annulerModal.open()}
            >
              Annuler la fiche
            </Button>
          )}
          {isBrouillon && (
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setIsSubmitting(true);
                envoyerTrichineFTP(ftp.id)
                  .then((response) => {
                    if (response.ok) {
                      toast.success(`FTP ${ftp.numero_fiche} envoyée au laboratoire`);
                      refresh();
                    } else {
                      toast.error(response.error || 'Une erreur est survenue');
                    }
                  })
                  .catch(() => toast.error('Une erreur est survenue'))
                  .finally(() => setIsSubmitting(false));
              }}
            >
              Envoyer au laboratoire
            </Button>
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
                { label: 'Créée le', value: dayjs(ftp.date_creation).format('DD/MM/YYYY') },
                {
                  label: 'Envoyée le',
                  value: ftp.date_envoi ? dayjs(ftp.date_envoi).format('DD/MM/YYYY') : 'Pas encore',
                },
                !!ftp.mode_transport && { label: 'Transport', value: ftp.mode_transport },
                !!ftp.FTPParent && {
                  label: 'FTP d’origine',
                  value: (
                    <Link
                      to={`${basePath}/ftp/${ftp.FTPParent.numero_fiche}`}
                      className="fr-link"
                    >
                      {ftp.FTPParent.numero_fiche}
                    </Link>
                  ),
                },
              ]}
            />
            {!!ftp.commentaire && <p className="fr-text--sm fr-mt-2w fr-mb-0">{ftp.commentaire}</p>}
          </TrichineCard>
          <TrichineChronologie historique={historique} />
        </>
      }
    >
      {isAnnulee && (
        <Alert
          severity="warning"
          small
          title="Fiche annulée"
          description={`${ftp.date_annulation ? `Annulée le ${dayjs(ftp.date_annulation).format('DD/MM/YYYY')}. ` : ''}${ftp.raison_annulation ?? ''} Le laboratoire a été prévenu.`}
        />
      )}

      {!!ftp.ExpediteurEntity && (
        <TrichineCard titre="Expéditeur">
          <TrichineFields
            fields={[
              {
                label: isExpediteurSvi ? "Service d'inspection" : 'Établissement',
                value: ftp.ExpediteurEntity.nom_d_usage || ftp.ExpediteurEntity.raison_sociale,
              },
              etgs.length > 0 && {
                label: 'Opère chez',
                value: etgs.map((etg) => etg.nom).join(', '),
              },
            ]}
          />
        </TrichineCard>
      )}

      <TrichineCard titre="Laboratoire destinataire">
        <TrichineFields
          fields={[
            { label: 'Laboratoire', value: laboratoire },
            {
              label: 'Type',
              value: ftp.DestinataireEntity.is_lnr
                ? 'Laboratoire national de référence'
                : 'Laboratoire vétérinaire départemental agréé',
            },
            !!ftp.DestinataireEntity.address_ligne_1 && {
              label: 'Adresse',
              value: [
                ftp.DestinataireEntity.address_ligne_1,
                ftp.DestinataireEntity.code_postal,
                ftp.DestinataireEntity.ville,
              ]
                .filter(Boolean)
                .join(', '),
            },
          ]}
        />
      </TrichineCard>

      <TrichineCard
        titre="Pools transmis"
        hint={`${pools.length} pool${pools.length > 1 ? 's' : ''} — ${echantillons.length} échantillon${echantillons.length > 1 ? 's' : ''}`}
        actions={
          isBrouillon && (
            <Button
              type="button"
              size="small"
              priority="secondary"
              onClick={() => ajouterPoolModal.open()}
            >
              Ajouter un pool
            </Button>
          )
        }
      >
        <ul className="m-0 list-none divide-y divide-gray-100 p-0">
          {pools.map((pool) => (
            <li
              key={pool.id}
              className="flex items-center gap-x-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`${basePath}/pools/${pool.reference_pool}`}
                    className="fr-link font-semibold"
                  >
                    {pool.reference_pool}
                  </Link>
                  <Badge
                    small
                    severity={statutAnalyseBadgeSeverity(pool.statut)}
                  >
                    {statutAnalyseLabels[pool.statut]}
                  </Badge>
                  {!!pool.resultat_analyse && (
                    <Badge
                      small
                      severity={resultatBadgeSeverity(pool.resultat_analyse)}
                    >
                      {resultatAnalyseLabels[pool.resultat_analyse]}
                    </Badge>
                  )}
                </div>
                <p className="fr-text--xs fr-mb-0 text-gray-600">
                  {pool.TrichineEchantillons.map((echantillon) => echantillon.Carcasse.numero_bracelet)
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {!!pool.raison_refus && (
                  <p className="fr-text--xs fr-mb-0 text-red-700">Refus : {pool.raison_refus}</p>
                )}
              </div>
              {/* Ce que le colis contient pour ce pool : le décompte prime, le détail est dans le pool */}
              <div className="shrink-0 text-right">
                <p className="fr-text--sm fr-mb-0 font-medium whitespace-nowrap text-gray-900">
                  {pool.TrichineEchantillons.length} échantillon
                  {pool.TrichineEchantillons.length > 1 ? 's' : ''}
                </p>
                <p className="fr-text--xs fr-mb-0 whitespace-nowrap text-gray-600">
                  {carcassesDuPool(pool)} carcasse{carcassesDuPool(pool) > 1 ? 's' : ''}
                </p>
              </div>
              {isBrouillon && pools.length > 1 && (
                <Button
                  type="button"
                  iconId="fr-icon-close-circle-line"
                  priority="tertiary no outline"
                  title={`Retirer ${pool.reference_pool} de la fiche`}
                  disabled={isSubmitting}
                  onClick={() => {
                    setIsSubmitting(true);
                    modifierTrichineFTP(ftp.id, {
                      pool_ids: pools.filter((autre) => autre.id !== pool.id).map((autre) => autre.id),
                    })
                      .then((response) => {
                        if (response.ok) {
                          toast.success(`${pool.reference_pool} retiré de la fiche`);
                          refresh();
                        } else {
                          toast.error(response.error || 'Une erreur est survenue');
                        }
                      })
                      .catch(() => toast.error('Une erreur est survenue'))
                      .finally(() => setIsSubmitting(false));
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </TrichineCard>

      {ftp.FTPChildren.length > 0 && (
        <TrichineCard
          titre="Transmissions de confirmation"
          hint="Fiches générées vers le laboratoire national de référence"
        >
          <ul className="m-0 list-none space-y-2 p-0">
            {ftp.FTPChildren.map((enfant) => (
              <li
                key={enfant.numero_fiche}
                className="flex flex-wrap items-center gap-2"
              >
                <Link
                  to={`${basePath}/ftp/${enfant.numero_fiche}`}
                  className="fr-link"
                >
                  {enfant.numero_fiche}
                </Link>
                <Badge
                  small
                  severity="info"
                >
                  {statutLogistiqueLabels[enfant.statut_logistique]}
                </Badge>
              </li>
            ))}
          </ul>
        </TrichineCard>
      )}

      <ModifierModalContent
        ftp={ftp}
        onDone={refresh}
      />

      {isBrouillon && (
        <AjouterPoolModalContent
          ftp={ftp}
          poolIdsDeLaFiche={pools.map((pool) => pool.id)}
          onDone={refresh}
        />
      )}

      <supprimerModal.Component title={`Supprimer le brouillon ${ftp.numero_fiche}`}>
        <p className="fr-text--sm">
          La fiche disparaîtra de vos listes. Ses {pools.length} pool{pools.length > 1 ? 's' : ''} ne sont pas
          supprimés : ils redeviennent disponibles pour une autre fiche.
        </p>
        <Button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            setIsSubmitting(true);
            supprimerTrichineFTP(ftp.id)
              .then((response) => {
                if (response.ok) {
                  toast.success(`Brouillon ${ftp.numero_fiche} supprimé`);
                  supprimerModal.close();
                  navigate(`${basePath}/ftp`);
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

      <AnnulerModalContent
        ftp={ftp}
        onDone={refresh}
      />
    </TrichineDetailPage>
  );
}

function ModifierModalContent({ ftp, onDone }: { ftp: TrichineFTPDetailType; onDone: () => void }) {
  const [laboratoires, setLaboratoires] = useState<Array<TrichineLaboratoire>>([]);
  const [destinataire, setDestinataire] = useState(ftp.destinataire_entity_id);
  const [modeTransport, setModeTransport] = useState(ftp.mode_transport ?? '');
  const [commentaire, setCommentaire] = useState(ftp.commentaire ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getTrichineLaboratoires()
      .then((response) => {
        if (response.ok && response.data) setLaboratoires(response.data.laboratoires);
      })
      .catch(console.error);
  }, []);

  // Réaligne le formulaire sur la fiche rechargée après un enregistrement
  useEffect(() => {
    setDestinataire(ftp.destinataire_entity_id);
    setModeTransport(ftp.mode_transport ?? '');
    setCommentaire(ftp.commentaire ?? '');
  }, [ftp]);

  return (
    <modifierModal.Component title={`Modifier la fiche ${ftp.numero_fiche}`}>
      <Select
        label="Laboratoire destinataire"
        nativeSelectProps={{
          value: destinataire,
          onChange: (event) => setDestinataire(event.target.value),
        }}
      >
        {laboratoires.map((laboratoire) => (
          <option
            key={laboratoire.id}
            value={laboratoire.id}
          >
            {laboratoire.nom_d_usage || laboratoire.raison_sociale}
          </option>
        ))}
      </Select>
      <Input
        label="Mode de transport (optionnel)"
        nativeInputProps={{
          type: 'text',
          value: modeTransport,
          onChange: (event) => setModeTransport(event.target.value),
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
        disabled={isSubmitting || !destinataire}
        onClick={() => {
          setIsSubmitting(true);
          modifierTrichineFTP(ftp.id, {
            destinataire_entity_id: destinataire,
            mode_transport: modeTransport,
            commentaire,
          })
            .then((response) => {
              if (response.ok) {
                toast.success('Fiche modifiée');
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

function AnnulerModalContent({ ftp, onDone }: { ftp: TrichineFTPDetailType; onDone: () => void }) {
  const [raison, setRaison] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <annulerModal.Component title={`Annuler la fiche ${ftp.numero_fiche}`}>
      <p className="fr-text--sm">
        Le laboratoire sera prévenu de ne pas analyser le colis s'il lui parvient. Les pools de la fiche
        redeviendront disponibles pour une nouvelle transmission. L'annulation n'est plus possible une fois le
        colis réceptionné.
      </p>
      <Input
        label="Raison de l'annulation (obligatoire)"
        textArea
        nativeTextAreaProps={{
          value: raison,
          onChange: (event) => setRaison(event.target.value),
        }}
      />
      <Button
        type="button"
        disabled={isSubmitting || !raison.trim()}
        onClick={() => {
          setIsSubmitting(true);
          annulerTrichineFTP(ftp.id, raison.trim())
            .then((response) => {
              if (response.ok) {
                toast.success(`Fiche ${ftp.numero_fiche} annulée, le laboratoire a été prévenu`);
                annulerModal.close();
                setRaison('');
                onDone();
              } else {
                toast.error(response.error || 'Une erreur est survenue');
              }
            })
            .catch(() => toast.error('Une erreur est survenue'))
            .finally(() => setIsSubmitting(false));
        }}
      >
        Confirmer l'annulation
      </Button>
    </annulerModal.Component>
  );
}

/**
 * Ajout de pools à une fiche encore au brouillon : une fois le colis parti, la fiche papier fait
 * foi et la composition ne bouge plus. Ne sont proposés que les pools qu'aucune fiche vivante
 * n'emporte déjà.
 */
function AjouterPoolModalContent({
  ftp,
  poolIdsDeLaFiche,
  onDone,
}: {
  ftp: TrichineFTPDetailType;
  poolIdsDeLaFiche: Array<string>;
  onDone: () => void;
}) {
  const isOpen = useIsModalOpen(ajouterPoolModal);
  const [chargement, setChargement] = useState(true);
  const [pools, setPools] = useState<Array<TrichinePoolPopulated>>([]);
  const [recherche, setRecherche] = useState('');
  const [selectedIds, setSelectedIds] = useState<Array<string>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Les pools libres bougent vite : on repart des données du serveur à chaque ouverture
  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds([]);
    setRecherche('');
    setChargement(true);
    getTrichinePools()
      .then((response) => setPools(response.ok ? (response.data?.pools ?? []) : []))
      .catch(console.error)
      .finally(() => setChargement(false));
  }, [isOpen]);

  const disponibles = pools.filter(poolSansFTP);
  const terme = recherche.trim().toLowerCase();
  const visibles = !terme
    ? disponibles
    : disponibles.filter((pool) => pool.reference_pool.toLowerCase().includes(terme));
  const selected = disponibles.filter((pool) => selectedIds.includes(pool.id));

  return (
    <ajouterPoolModal.Component title={`Ajouter un pool à la fiche ${ftp.numero_fiche}`}>
      {chargement ? (
        <p className="fr-text--sm fr-mb-0 py-8 text-center text-gray-600">Chargement…</p>
      ) : disponibles.length === 0 ? (
        <p className="fr-text--sm fr-mb-0 py-8 text-center text-gray-600">
          Aucun pool disponible : tous vos pools sont déjà rattachés à une fiche.
        </p>
      ) : (
        <>
          <Input
            label="Rechercher"
            hintText="Référence de pool"
            nativeInputProps={{
              type: 'search',
              value: recherche,
              placeholder: 'Référence…',
              onChange: (event) => setRecherche(event.target.value),
            }}
          />
          {visibles.length === 0 ? (
            <p className="fr-text--sm fr-mb-2w py-4 text-center text-gray-500">
              Aucun pool ne correspond à votre recherche.
            </p>
          ) : (
            <ul className="fr-mb-2w m-0 max-h-80 list-none overflow-y-auto p-0">
              {visibles.map((pool) => {
                const retenu = selectedIds.includes(pool.id);
                return (
                  <li
                    key={pool.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <button
                      type="button"
                      aria-pressed={retenu}
                      className={`flex w-full items-center justify-between gap-2 px-2 py-2 text-left hover:bg-gray-50 ${retenu ? 'bg-gray-50' : ''}`}
                      onClick={() =>
                        setSelectedIds((previous) =>
                          retenu ? previous.filter((id) => id !== pool.id) : [...previous, pool.id]
                        )
                      }
                    >
                      <span className="min-w-0 text-sm">
                        <span className="block font-semibold text-gray-900">{pool.reference_pool}</span>
                        <span className="block text-gray-600">
                          {pool.TrichineEchantillons.length} échantillon
                          {pool.TrichineEchantillons.length > 1 ? 's' : ''} · {carcassesDuPool(pool)} carcasse
                          {carcassesDuPool(pool) > 1 ? 's' : ''} · constitué le{' '}
                          {dayjs(pool.date_constitution).format('DD/MM/YYYY')}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`text-lg leading-none font-bold ${retenu ? 'text-action-high-blue-france' : 'text-gray-600'}`}
                      >
                        {retenu ? '✓' : '+'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="fr-text--sm fr-mb-2w text-gray-700">
            Fiche après ajout : <strong>{poolIdsDeLaFiche.length + selected.length}</strong> pool
            {poolIdsDeLaFiche.length + selected.length > 1 ? 's' : ''}
          </p>

          <Button
            type="button"
            disabled={!selected.length || isSubmitting}
            onClick={() => {
              setIsSubmitting(true);
              modifierTrichineFTP(ftp.id, {
                pool_ids: [...poolIdsDeLaFiche, ...selected.map((pool) => pool.id)],
              })
                .then((response) => {
                  if (response.ok) {
                    toast.success(
                      selected.length > 1
                        ? `${selected.length} pools ajoutés à la fiche`
                        : `${selected[0].reference_pool} ajouté à la fiche`
                    );
                    ajouterPoolModal.close();
                    onDone();
                  } else {
                    toast.error(response.error || 'Une erreur est survenue');
                  }
                })
                .catch(() => toast.error('Une erreur est survenue'))
                .finally(() => setIsSubmitting(false));
            }}
          >
            {selected.length > 1 ? `Ajouter ${selected.length} pools` : 'Ajouter à la fiche'}
          </Button>
        </>
      )}
    </ajouterPoolModal.Component>
  );
}
