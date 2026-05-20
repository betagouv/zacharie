import dayjs from 'dayjs';
import type { Carcasse } from '@prisma/client';
import { CarcasseType } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import { ModalStatusBadge } from './_helpers';
import type { CardDisplay } from '@app/utils/get-carcasse-card-display';

interface CarcasseModalHeaderProps {
  carcasse: Carcasse;
  feiNumero: string;
  cardDisplay: CardDisplay;
  isEcarteePourInspection: boolean;
}

export default function CarcasseModalHeader({
  carcasse,
  feiNumero,
  cardDisplay,
  isEcarteePourInspection,
}: CarcasseModalHeaderProps) {
  const fei = useZustandStore((state) => state.feis[feiNumero]);

  const statusLabel = isEcarteePourInspection
    ? 'Écarté pour inspection'
    : (cardDisplay.statusLabel ?? 'En cours');
  const statusIconId = isEcarteePourInspection ? 'fr-icon-alert-line' : (cardDisplay.iconId ?? null);
  const accentColor = isEcarteePourInspection ? 'red' : (cardDisplay.accentColor ?? 'gray');

  const nombreDAnimaux = carcasse.nombre_d_animaux ?? 0;
  const nombreDisplay =
    carcasse.type === CarcasseType.PETIT_GIBIER && nombreDAnimaux > 1 ? ` (${nombreDAnimaux})` : '';

  return (
    <div className="border-b border-gray-200 pb-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="fr-h4 mb-0">
          {carcasse.espece}
          {nombreDisplay}
        </h2>
        {carcasse.numero_bracelet && (
          <span className="text-base font-semibold text-gray-600">N° {carcasse.numero_bracelet}</span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
        {fei?.date_mise_a_mort && <span>Chasse du {dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY')}</span>}
        <span>Fiche n° {feiNumero}</span>
      </div>
      <div className="mt-3">
        <ModalStatusBadge
          statusLabel={statusLabel}
          statusIconId={statusIconId}
          accentColor={accentColor}
        />
      </div>
    </div>
  );
}
