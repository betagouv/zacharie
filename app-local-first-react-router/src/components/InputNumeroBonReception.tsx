import { useMemo } from 'react';
import { Input } from '@codegouvfr/react-dsfr/Input';
import InputNotEditable from '@app/components/InputNotEditable';
import useZustandStore from '@app/zustand/store';
import { useEtgIds } from '@app/utils/get-entity-relations';

// Les bons de réception sont numérotés en série par l'ETG : on propose ceux déjà saisis
// pour éviter de les retaper à la main sur le terrain. La source est le store local
// (les fiches de mes ETG), donc les suggestions fonctionnent hors-ligne.
function useNumerosBonReceptionRecents(): string[] {
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const etgsIds = useEtgIds();

  return useMemo(() => {
    const parNumero = new Map<string, Date>();
    for (const carcasseIntermediaire of Object.values(carcassesIntermediaireById)) {
      const numero = carcasseIntermediaire.numero_bon_reception;
      if (!numero) continue;
      if (!etgsIds.includes(carcasseIntermediaire.intermediaire_entity_id)) continue;
      const updatedAt = new Date(carcasseIntermediaire.updated_at);
      const existant = parNumero.get(numero);
      if (!existant || updatedAt > existant) {
        parNumero.set(numero, updatedAt);
      }
    }
    return Array.from(parNumero.entries())
      .sort(([, a], [, b]) => b.getTime() - a.getTime())
      .slice(0, 10)
      .map(([numero]) => numero);
  }, [carcassesIntermediaireById, etgsIds]);
}

interface Props {
  value: string;
  onChange: (numeroBonReception: string) => void;
  canEdit: boolean;
  formId: string;
}

export default function InputNumeroBonReception({ value, onChange, canEdit, formId }: Props) {
  const numerosRecents = useNumerosBonReceptionRecents();
  const datalistId = 'numeros-bon-reception-recents';

  // Champ facultatif : en lecture seule et sans valeur, on n'affiche rien plutôt qu'un « N/A »
  // dans le parcours des ETG qui ne s'en servent pas.
  if (!canEdit) {
    if (!value) {
      return null;
    }
    return (
      <InputNotEditable
        label="N° de bon de réception"
        nativeInputProps={{
          id: 'numero_bon_reception',
          name: 'numero_bon_reception',
          value: value,
        }}
      />
    );
  }

  return (
    <>
      <Input
        label="N° de bon de réception"
        hintText="Facultatif"
        nativeInputProps={{
          id: 'numero_bon_reception',
          name: 'numero_bon_reception',
          type: 'text',
          form: formId,
          autoComplete: 'off',
          list: numerosRecents.length ? datalistId : undefined,
          value: value,
          onChange: (e) => onChange(e.target.value),
        }}
      />
      {numerosRecents.length > 0 && (
        <datalist id={datalistId}>
          {numerosRecents.map((numero) => (
            <option
              key={numero}
              value={numero}
            />
          ))}
        </datalist>
      )}
    </>
  );
}
