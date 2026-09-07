import { useMemo } from 'react';
import dayjs from 'dayjs';
import { Input } from '@codegouvfr/react-dsfr/Input';
import useZustandStore from '@app/zustand/store';
import { useEtgIds } from '@app/utils/get-entity-relations';

// Les bons de réception sont numérotés en série par l'ETG : on rappelle ceux du jour et de la veille
// pour éviter de les retaper à la main sur le terrain. La source est le store local
// (les fiches de mes ETG), donc les rappels fonctionnent hors-ligne.
function useNumerosBonReceptionRecents(): { aujourdhui: string[]; hier: string[] } {
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const etgsIds = useEtgIds();

  return useMemo(() => {
    const parNumero = new Map<string, dayjs.Dayjs>();
    for (const carcasseIntermediaire of Object.values(carcassesIntermediaireById)) {
      const numero = carcasseIntermediaire.numero_bon_reception;
      if (!numero) continue;
      if (!etgsIds.includes(carcasseIntermediaire.intermediaire_entity_id)) continue;
      const priseEnChargeAt = dayjs(
        carcasseIntermediaire.prise_en_charge_at ?? carcasseIntermediaire.created_at
      );
      const existant = parNumero.get(numero);
      if (!existant || priseEnChargeAt.isAfter(existant)) {
        parNumero.set(numero, priseEnChargeAt);
      }
    }
    const aujourdhui: string[] = [];
    const hier: string[] = [];
    const numerosTriesParDatePlusRecente = Array.from(parNumero.entries()).sort(
      ([, a], [, b]) => b.valueOf() - a.valueOf()
    );
    for (const [numero, date] of numerosTriesParDatePlusRecente) {
      if (date.isSame(dayjs(), 'day')) {
        aujourdhui.push(numero);
      } else if (date.isSame(dayjs().subtract(1, 'day'), 'day')) {
        hier.push(numero);
      }
    }
    return { aujourdhui, hier };
  }, [carcassesIntermediaireById, etgsIds]);
}

interface Props {
  value: string;
  onChange: (numeroBonReception: string) => void;
  className?: string;
}

export default function InputNumeroBonReception({ value, onChange, className }: Props) {
  const numerosRecents = useNumerosBonReceptionRecents();
  const rappels = [
    { label: "Aujourd'hui", numeros: numerosRecents.aujourdhui },
    { label: 'Hier', numeros: numerosRecents.hier },
  ].filter((rappel) => rappel.numeros.length > 0);

  return (
    <Input
      // champ secondaire : le CTA de la page reste « Prendre en charge »
      className={['max-w-xs [&_.fr-input]:text-sm [&_.fr-label]:text-sm', className]
        .filter(Boolean)
        .join(' ')}
      label="N° de bon de réception (optionnel)"
      hintText={
        <>
          {rappels.map((rappel) => (
            <span
              className="mt-1 flex flex-wrap items-center gap-y-1"
              key={rappel.label}
            >
              <span className="mr-2">{rappel.label}&nbsp;:</span>
              {rappel.numeros.map((numero) => (
                <button
                  key={numero}
                  className="mr-2 rounded-full bg-[#E8EDFF] px-3 py-1 text-sm text-[#000091]"
                  type="button"
                  onClick={() => onChange(numero)}
                >
                  {numero}
                </button>
              ))}
            </span>
          ))}
        </>
      }
      nativeInputProps={{
        id: 'numero_bon_reception',
        name: 'numero_bon_reception',
        type: 'text',
        autoComplete: 'off',
        value: value,
        onChange: (e) => onChange(e.target.value),
      }}
    />
  );
}
