import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { Carcasse, TrichineResultatAnalyse, TrichineSitePrelevement, UserRoles } from '@prisma/client';
import useUser from '@app/zustand/user';
import { useTrichineBasePath } from '@app/utils/trichine-hooks';
import {
  createTrichineEchantillon,
  getTrichineCarcasse,
  type TrichineCarcasseView,
} from '@app/services/trichine';
import type { TrichineHistoriqueStatut } from '@prisma/client';
import {
  actionRequiseLabels,
  isResultatDefavorable,
  resultatAnalyseLabels,
  resultatBadgeSeverity,
  sitePrelevementLabels,
  statutAnalyseBadgeSeverity,
  statutAnalyseLabels,
  TRICHINE_ESPECE_CONCERNEE,
} from '@app/utils/trichine';

const echantillonModal = createModal({ isOpenedByDefault: false, id: 'trichine-echantillon-modal' });

/**
 * Section trichine de la carte carcasse (sangliers uniquement, cf doc/trichine.md §6.1 et §6.2).
 * Données chargées directement depuis le serveur (pas de local-first : les
 * résultats viennent des laboratoires, le flux nécessite d'être en ligne).
 *
 * Écran SVI (circuit agréé) : la décision sur un résultat défavorable passe par l'IPM (SAISIE_TOTALE).
 */
export default function TrichineSection({ carcasse }: { carcasse: Carcasse }) {
  const user = useUser((state) => state.user)!;
  const trichineBasePath = useTrichineBasePath();
  const [view, setView] = useState<TrichineCarcasseView | null>(null);
  const [historique, setHistorique] = useState<Array<TrichineHistoriqueStatut>>([]);
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

  const refresh = useCallback(() => {
    getTrichineCarcasse(carcasse.zacharie_carcasse_id)
      .then((response) => {
        if (response.ok && response.data) {
          setView(response.data.carcasse);
          setHistorique(response.data.historique);
        }
      })
      .catch(console.error)
      .finally(() => setHasTriedLoading(true));
  }, [carcasse.zacharie_carcasse_id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const echantillons = useMemo(() => view?.TrichineEchantillons ?? [], [view]);
  const pools = useMemo(() => {
    const byId = new Map<string, NonNullable<(typeof echantillons)[number]['TrichinePool']>>();
    for (const echantillon of echantillons) {
      if (echantillon.TrichinePool && !echantillon.TrichinePool.deleted_at) {
        byId.set(echantillon.TrichinePool.id, echantillon.TrichinePool);
      }
    }
    return [...byId.values()];
  }, [echantillons]);

  const resultatDefavorable = useMemo(
    () => pools.map((pool) => pool.resultat_analyse).find((resultat) => isResultatDefavorable(resultat)),
    [pools]
  );
  const poolDouteux = useMemo(
    () =>
      pools.find(
        (pool) =>
          pool.resultat_analyse === TrichineResultatAnalyse.DOUTEUX && pool.cree_par_user_id === user.id
      ),
    [pools, user.id]
  );

  if (carcasse.espece !== TRICHINE_ESPECE_CONCERNEE) {
    return null;
  }

  // SVI : prélève sur les carcasses assignées à son service (vérifié côté backend)
  const canAct = user.roles.includes(UserRoles.SVI);
  const actionRequise = view?.trichine_action_requise ?? carcasse.trichine_action_requise;

  return (
    <div className="fr-mb-2w rounded bg-white p-4 md:p-8 md:shadow-sm">
      <h2 className="fr-h4 fr-mb-2w">Recherche de trichine</h2>

      {resultatDefavorable && (
        <Alert
          severity="error"
          className="fr-mb-2w"
          title="Carcasse impropre à la consommation"
          description={`Résultat d'analyse : ${resultatAnalyseLabels[resultatDefavorable]}. Prononcez la décision IPM correspondante (saisie totale).`}
        />
      )}
      {!resultatDefavorable && actionRequise && actionRequise !== 'AUCUNE' && (
        <Alert
          severity="info"
          className="fr-mb-2w"
          small
          description={actionRequiseLabels[actionRequise] ?? actionRequise}
        />
      )}

      {!hasTriedLoading && <p className="fr-text--sm">Chargement des analyses…</p>}

      {hasTriedLoading && !echantillons.length && (
        <p className="fr-text--sm fr-mb-2w">Aucun échantillon prélevé.</p>
      )}

      {echantillons.length > 0 && (
        <ul className="fr-mb-2w list-none space-y-3 p-0">
          {echantillons.map((echantillon) => (
            <li
              key={echantillon.id}
              className="rounded border border-gray-200 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{echantillon.reference_echantillon}</span>
                <Badge
                  small
                  severity={statutAnalyseBadgeSeverity(echantillon.statut)}
                >
                  {statutAnalyseLabels[echantillon.statut]}
                </Badge>
                {echantillon.resultat_analyse && (
                  <Badge
                    small
                    severity={resultatBadgeSeverity(echantillon.resultat_analyse)}
                  >
                    {resultatAnalyseLabels[echantillon.resultat_analyse]}
                  </Badge>
                )}
              </div>
              <p className="fr-text--sm fr-mb-0 mt-1">
                {sitePrelevementLabels[echantillon.site_prelevement]} — au moins {echantillon.masse_grammes} g
                — prélevé le {dayjs(echantillon.date_prelevement).format('DD/MM/YYYY')}
              </p>
              {echantillon.TrichinePool && (
                <p className="fr-text--sm fr-mb-0 mt-1">
                  Pool {echantillon.TrichinePool.reference_pool}
                  {echantillon.TrichinePool.TrichinePoolFTPs.filter((link) => !link.TrichineFTP.deleted_at)
                    .map((link) => ` — FTP ${link.TrichineFTP.numero_fiche}`)
                    .join('')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {canAct && (
        <div className="flex flex-wrap gap-2">
          {/* Après un résultat douteux, le prélèvement doit être rattaché au pool douteux :
              il passe par l'assistant de 2e intention, pas par un échantillon isolé. */}
          {poolDouteux && !resultatDefavorable ? (
            <Button
              linkProps={{
                to: `${trichineBasePath}/pools/${poolDouteux.reference_pool}/2e-intention`,
              }}
            >
              Prélèvements de 2e intention
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => echantillonModal.open()}
            >
              Réaliser un échantillon
            </Button>
          )}
        </div>
      )}

      {echantillons.length > 0 && (
        <p className="fr-text--sm fr-mt-2w fr-mb-0">
          <Link
            to={trichineBasePath}
            className="fr-link"
          >
            Gérer mes pools et mes FTP →
          </Link>
        </p>
      )}

      {historique.length > 0 && (
        <details className="fr-mt-2w">
          <summary className="fr-text--sm cursor-pointer">Chronologie</summary>
          <ul className="fr-text--sm mt-2 list-none space-y-1 p-0">
            {historique.map((event) => (
              <li key={event.id}>
                {dayjs(event.date_changement).format('DD/MM/YYYY HH:mm')} —{' '}
                {event.ancien_statut ? `${event.ancien_statut} → ` : ''}
                {event.nouveau_statut}
                {event.commentaire ? ` (${event.commentaire})` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}

      <EchantillonModalContent
        carcasse={carcasse}
        onCreated={refresh}
      />
    </div>
  );
}

function EchantillonModalContent({ carcasse, onCreated }: { carcasse: Carcasse; onCreated: () => void }) {
  const [sitePrelevement, setSitePrelevement] = useState<TrichineSitePrelevement>(
    TrichineSitePrelevement.PILIER_DIAPHRAGME
  );
  const [masse, setMasse] = useState('5');
  const [datePrelevement, setDatePrelevement] = useState(dayjs().format('YYYY-MM-DD'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <echantillonModal.Component title="Réaliser un échantillon">
      <p className="fr-text--sm">
        Prélevez un morceau de muscle de 5 g minimum sur la carcasse {carcasse.numero_bracelet}.
      </p>
      <Select
        label="Site de prélèvement"
        nativeSelectProps={{
          value: sitePrelevement,
          onChange: (event) => setSitePrelevement(event.target.value as TrichineSitePrelevement),
        }}
      >
        {Object.values(TrichineSitePrelevement).map((site) => (
          <option
            key={site}
            value={site}
          >
            {sitePrelevementLabels[site]}
          </option>
        ))}
      </Select>
      <Input
        label="Masse (en grammes)"
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
      <Button
        type="button"
        disabled={isSubmitting}
        onClick={() => {
          setIsSubmitting(true);
          createTrichineEchantillon({
            zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
            site_prelevement: sitePrelevement,
            masse_grammes: Number(masse) || undefined,
            date_prelevement: datePrelevement,
          })
            .then((response) => {
              if (response.ok && response.data) {
                toast.success(`Échantillon ${response.data.echantillon.reference_echantillon} créé`);
                echantillonModal.close();
                onCreated();
              } else {
                toast.error(response.error || 'Une erreur est survenue');
              }
            })
            .catch(() => toast.error('Une erreur est survenue'))
            .finally(() => setIsSubmitting(false));
        }}
      >
        Valider l'échantillon
      </Button>
    </echantillonModal.Component>
  );
}
