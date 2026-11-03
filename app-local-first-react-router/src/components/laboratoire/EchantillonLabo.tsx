import { useEffect, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import type { LaboEchantillon } from '@app/services/laboratoire';
import {
  aliasAnalysesFige,
  formatAliases,
  monAlias,
  poserAlias,
  retirerAlias,
  TRICHINE_ALIAS_MAX_LENGTH,
} from '@app/services/trichine-alias';
import { sitePrelevementLabels } from '@app/utils/trichine';

/**
 * Un échantillon d'un pool reçu au laboratoire : sa projection carcasse, la référence interne
 * que le laboratoire lui donne (modifiable tant que les analyses ne sont pas terminées) et, tant
 * que le résultat n'est pas rendu, son retrait du pool.
 */
export default function EchantillonLabo({
  echantillon,
  mesEntites,
  onRetirer,
  onAliasChange,
}: {
  echantillon: LaboEchantillon;
  mesEntites: Array<string>;
  onRetirer: (() => void) | null;
  onAliasChange: () => void;
}) {
  const mien = monAlias(echantillon.Aliases, mesEntites);
  const autres = echantillon.Aliases.filter((alias) => alias.id !== mien?.id);
  const [reference, setReference] = useState(mien?.reference ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setReference(mien?.reference ?? '');
  }, [mien?.reference]);

  const peutSaisir = mesEntites.length > 0 && !aliasAnalysesFige(echantillon);
  const saisie = reference.trim();

  const enregistrer = (action: () => Promise<{ ok: boolean; error: string }>, succes: string) => {
    setIsSubmitting(true);
    action()
      .then((response) => {
        if (response.ok) {
          toast.success(succes);
          onAliasChange();
        } else {
          toast.error(response.error || 'Une erreur est survenue');
        }
      })
      .catch(() => toast.error('Une erreur est survenue'))
      .finally(() => setIsSubmitting(false));
  };

  return (
    <li className="rounded border border-gray-200 p-2">
      <span className="font-semibold">{echantillon.reference_echantillon}</span>
      {autres.length > 0 && ` (${formatAliases(autres)})`} —{' '}
      {sitePrelevementLabels[echantillon.site_prelevement]} — au moins {echantillon.masse_grammes} g
      <br />
      Carcasse {echantillon.Carcasse.numero_bracelet} ({echantillon.Carcasse.espece ?? '—'}) — mise à mort le{' '}
      {echantillon.Carcasse.date_mise_a_mort
        ? dayjs(echantillon.Carcasse.date_mise_a_mort).format('DD/MM/YYYY')
        : '—'}{' '}
      à {echantillon.Carcasse.Fei.commune_mise_a_mort ?? '—'}
      {peutSaisir ? (
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!saisie || saisie === mien?.reference) return;
            enregistrer(() => poserAlias('echantillon', echantillon.id, saisie), 'Référence enregistrée');
          }}
        >
          <Input
            label="Ma référence"
            className="fr-mb-0 min-w-40 flex-1"
            nativeInputProps={{
              value: reference,
              maxLength: TRICHINE_ALIAS_MAX_LENGTH,
              onChange: (event) => setReference(event.target.value),
            }}
          />
          <Button
            type="submit"
            size="small"
            priority="secondary"
            disabled={isSubmitting || !saisie || saisie === mien?.reference}
          >
            Enregistrer
          </Button>
          {!!mien && (
            <Button
              type="button"
              size="small"
              priority="tertiary"
              disabled={isSubmitting}
              onClick={() =>
                enregistrer(() => retirerAlias('echantillon', echantillon.id), 'Référence retirée')
              }
            >
              Effacer
            </Button>
          )}
          {onRetirer && (
            <Button
              type="button"
              size="small"
              priority="tertiary"
              iconId="fr-icon-close-circle-line"
              onClick={onRetirer}
            >
              Retirer du pool
            </Button>
          )}
        </form>
      ) : (
        <>
          {!!mien && (
            <>
              <br />
              Ma référence : {mien.reference}
            </>
          )}
          {onRetirer && (
            <div className="mt-2">
              <Button
                type="button"
                size="small"
                priority="tertiary"
                iconId="fr-icon-close-circle-line"
                onClick={onRetirer}
              >
                Retirer du pool
              </Button>
            </div>
          )}
        </>
      )}
    </li>
  );
}

/** Échantillon sorti du pool par le laboratoire : en lecture seule, avec le motif. */
export function EchantillonRetireLabo({ echantillon }: { echantillon: LaboEchantillon }) {
  return (
    <li className="rounded border border-dashed border-gray-300 p-2 text-gray-600">
      <span className="font-semibold line-through">{echantillon.reference_echantillon}</span> — carcasse{' '}
      {echantillon.Carcasse.numero_bracelet}
      {echantillon.Aliases.length > 0 && ` (${formatAliases(echantillon.Aliases)})`}
      <br />
      Retiré le{' '}
      {echantillon.retire_par_labo_at ? dayjs(echantillon.retire_par_labo_at).format('DD/MM/YYYY') : '—'} —
      motif : {echantillon.retire_par_labo_motif ?? '—'}
    </li>
  );
}
