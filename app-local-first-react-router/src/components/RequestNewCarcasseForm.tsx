import { useMemo, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';
import { CarcasseType } from '@prisma/client';
import { requestNewCarcasse } from '@app/utils/carcasse-modification-request';

const gibierSelect = {
  grand: grandGibier.especes,
  petit: petitGibier.especes,
};

// ----------------------------------------------------------------------------
// RequestNewCarcasseButton
// Ouvre une modal pour pré-remplir une carcasse manquante.
// L'intermédiaire renseigne les champs physiques ; l'examinateur initial
// signera l'examen une fois la demande approuvée.
// ----------------------------------------------------------------------------
export default function RequestNewCarcasseButton({
  feiNumero,
  requestedByEntityId,
  className,
}: {
  feiNumero: string;
  requestedByEntityId: string;
  className?: string;
}) {
  const modal = useRef(
    createModal({
      isOpenedByDefault: false,
      id: `mod-req-new-carcasse-${feiNumero}`,
    })
  ).current;
  const isOpen = useIsModalOpen(modal);

  const [numeroBracelet, setNumeroBracelet] = useState('');
  const [espece, setEspece] = useState('');
  const [nombreAnimaux, setNombreAnimaux] = useState('1');
  const [heureMort, setHeureMort] = useState('');
  const [heureEvisc, setHeureEvisc] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPetitGibier = useMemo(() => petitGibier.especes.includes(espece), [espece]);
  const carcasseType = isPetitGibier ? CarcasseType.PETIT_GIBIER : CarcasseType.GROS_GIBIER;
  const zacharieCarcasseId = `${feiNumero}_${numeroBracelet}`;

  const onSubmit = async () => {
    setError(null);
    if (!numeroBracelet.trim()) {
      setError('Veuillez saisir un numéro de bracelet.');
      return;
    }
    if (!espece) {
      setError("Veuillez sélectionner l'espèce.");
      return;
    }
    setSubmitting(true);
    const result = await requestNewCarcasse({
      fei_numero: feiNumero,
      zacharie_carcasse_id: zacharieCarcasseId,
      carcasse: {
        numero_bracelet: numeroBracelet.trim(),
        espece,
        type: carcasseType,
        nombre_d_animaux: nombreAnimaux ? Number(nombreAnimaux) : 1,
        heure_mise_a_mort: heureMort || null,
        heure_evisceration: heureEvisc || null,
      },
      comment_intermediaire: comment.trim() || undefined,
      requested_by_entity_id: requestedByEntityId,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // reset + close
    setNumeroBracelet('');
    setEspece('');
    setNombreAnimaux('1');
    setHeureMort('');
    setHeureEvisc('');
    setComment('');
    modal.close();
  };

  return (
    <>
      <Button
        priority="secondary"
        size="small"
        onClick={() => modal.open()}
        className={className}
        type="button"
      >
        Ajouter une carcasse manquante
      </Button>
      <modal.Component title="Ajouter une carcasse manquante de la fiche">
        {isOpen && (
          <div>
            <p className="text-sm">
              Vous avez physiquement une carcasse qui ne figure pas dans cette fiche d'examen initial. Pré-remplissez ses
              informations : l'examinateur initial recevra une demande à signer pour valider son examen et la mettre sur
              le marché.
            </p>
            <Input
              label="Numéro de bracelet *"
              nativeInputProps={{
                value: numeroBracelet,
                onChange: (e) => setNumeroBracelet(e.currentTarget.value),
              }}
            />
            <Select
              label="Espèce *"
              nativeSelectProps={{
                value: espece,
                onChange: (e) => setEspece(e.currentTarget.value),
              }}
            >
              <option value="">Sélectionnez l'espèce</option>
              {Object.entries(gibierSelect).map(([typeGibier, especes]) => (
                <optgroup
                  label={typeGibier}
                  key={typeGibier}
                >
                  {especes.map((e) => (
                    <option
                      key={e}
                      value={e}
                    >
                      {e}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            {isPetitGibier && (
              <Input
                label="Nombre d'animaux dans le lot *"
                nativeInputProps={{
                  type: 'number',
                  min: 1,
                  value: nombreAnimaux,
                  onChange: (e) => setNombreAnimaux(e.currentTarget.value),
                }}
              />
            )}
            <Input
              label="Heure de mise à mort (optionnel)"
              nativeInputProps={{
                type: 'time',
                value: heureMort,
                onChange: (e) => setHeureMort(e.currentTarget.value),
              }}
            />
            <Input
              label="Heure d'éviscération (optionnel)"
              nativeInputProps={{
                type: 'time',
                value: heureEvisc,
                onChange: (e) => setHeureEvisc(e.currentTarget.value),
              }}
            />
            <Input
              label="Commentaire pour l'examinateur (optionnel)"
              textArea
              nativeTextAreaProps={{
                value: comment,
                onChange: (e) => setComment(e.currentTarget.value),
                rows: 3,
              }}
            />
            {error && <p className="text-action-high-red-marianne mt-1 text-sm">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button
                priority="primary"
                onClick={onSubmit}
                disabled={submitting}
                type="button"
              >
                Envoyer la demande
              </Button>
              <Button
                priority="secondary"
                onClick={() => modal.close()}
                type="button"
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </modal.Component>
    </>
  );
}
