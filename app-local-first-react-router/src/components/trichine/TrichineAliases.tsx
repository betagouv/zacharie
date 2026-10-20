import { useEffect, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { toast } from 'react-toastify';
import { TrichineCard, TrichineFields } from '@app/components/trichine/TrichineDetailPage';
import {
  monAlias,
  nomEntiteAlias,
  poserAlias,
  retirerAlias,
  TRICHINE_ALIAS_MAX_LENGTH,
  useMesEntitesAlias,
  type TrichineAlias,
  type TrichineAliasObjet,
} from '@app/services/trichine-alias';

/**
 * Bloc « Références internes » des pages de détail : la référence de l'entité de l'utilisateur,
 * modifiable tant que l'objet n'est pas figé, et celles posées par les autres acteurs.
 * Le gel dépend de qui regarde : le SVI dès l'envoi de la FTP (sa référence est imprimée dessus),
 * le laboratoire une fois les analyses terminées ou la fiche clôturée.
 */
export default function TrichineAliasesCard({
  objet,
  objetId,
  aliases,
  fige,
  onChange,
}: {
  objet: TrichineAliasObjet;
  objetId: string;
  aliases: Array<TrichineAlias>;
  fige: boolean;
  onChange: () => void;
}) {
  const mesEntites = useMesEntitesAlias();
  const mien = monAlias(aliases, mesEntites);
  const autres = aliases.filter((alias) => alias.id !== mien?.id);
  const [reference, setReference] = useState(mien?.reference ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setReference(mien?.reference ?? '');
  }, [mien?.reference]);

  const enregistrer = (action: () => Promise<{ ok: boolean; error: string }>, succes: string) => {
    setIsSubmitting(true);
    action()
      .then((response) => {
        if (response.ok) {
          toast.success(succes);
          onChange();
        } else {
          toast.error(response.error || 'Une erreur est survenue');
        }
      })
      .catch(() => toast.error('Une erreur est survenue'))
      .finally(() => setIsSubmitting(false));
  };

  const peutSaisir = mesEntites.length > 0 && !fige;
  const saisie = reference.trim();

  return (
    <TrichineCard
      titre="Références internes"
      hint={
        fige
          ? 'Votre référence ne peut plus être modifiée.'
          : 'La référence que chaque service ou laboratoire donne à cet objet dans ses propres outils.'
      }
    >
      {peutSaisir ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!saisie || saisie === mien?.reference) return;
            enregistrer(() => poserAlias(objet, objetId, saisie), 'Référence enregistrée');
          }}
        >
          <Input
            label="Ma référence"
            className="fr-mb-0 min-w-48 flex-1"
            nativeInputProps={{
              value: reference,
              maxLength: TRICHINE_ALIAS_MAX_LENGTH,
              onChange: (event) => setReference(event.target.value),
            }}
          />
          <Button
            type="submit"
            size="small"
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
              onClick={() => enregistrer(() => retirerAlias(objet, objetId), 'Référence retirée')}
            >
              Retirer
            </Button>
          )}
        </form>
      ) : (
        <TrichineFields
          disposition="lignes"
          fields={[{ label: 'Ma référence', value: mien?.reference ?? '—' }]}
        />
      )}
      {autres.length > 0 && (
        <div className="fr-mt-2w">
          <TrichineFields
            disposition="lignes"
            fields={autres.map((alias) => ({ label: nomEntiteAlias(alias), value: alias.reference }))}
          />
        </div>
      )}
    </TrichineCard>
  );
}
