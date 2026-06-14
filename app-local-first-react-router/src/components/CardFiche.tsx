import type { FeiWithIntermediaires } from '@api/src/types/fei';
import type { FeiStepSimpleStatus } from '@app/types/fei-steps';
import { useFeiSteps } from '@app/utils/fei-steps';
import dayjs from 'dayjs';
import { Link } from 'react-router';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { useMemo, useState, useRef, useEffect, type ReactNode } from 'react';
import useZustandStore from '@app/zustand/store';
import { useIsCircuitCourt } from '@app/utils/circuit-court';
import { CarcasseType } from '@prisma/client';
import { abbreviations, formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { filterCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import { useMyCarcassesForFei } from '@app/utils/filter-my-carcasses';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { CommuneIcon } from '@app/assets/svg/CommuneIcon';
import { CarcassesIcon } from '@app/assets/svg/CarcassesIcon';
import { ChasseIcon } from '@app/assets/svg/ChasseIcon';
import { RefusIcon } from '@app/assets/svg/RefusIcon';
interface CardProps {
  fei: FeiWithIntermediaires;
  onPrintSelect?: (feiNumber: string, selected: boolean) => void;
  isPrintSelected?: boolean;
  disabledBecauseOffline?: boolean;
  filter: FeiStepSimpleStatus | 'Toutes les fiches';
  linkTo: string;
  detenteurName: string | null;
  detenteurIcon?: ReactNode;
}

const statusColors: Record<FeiStepSimpleStatus, { bg: string; text: string }> = {
  'À compléter': {
    bg: 'bg-[#FEE7FC]',
    text: 'text-[#6E445A]',
  },
  'En cours': {
    bg: 'bg-[#FFECBD]',
    text: 'text-[#73603F]',
  },
  Clôturée: {
    bg: 'bg-[#E8EDFF]',
    text: 'text-[#01008B]',
  },
};

const maxDetailedLines = 2;
export default function CardFiche({
  fei,
  onPrintSelect,
  isPrintSelected = false,
  disabledBecauseOffline = false,
  filter,
  linkTo,
  detenteurName,
  detenteurIcon = <ChasseIcon />,
}: CardProps) {
  const { simpleStatus, currentStepLabelShort } = useFeiSteps(fei);
  const isCircuitCourt = useIsCircuitCourt();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dataIsSynced = useZustandStore((state) => state.dataIsSynced);
  const myCarcasses = useMyCarcassesForFei(fei.numero);
  const feiCarcasses = useCarcassesForFei(fei.numero);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [carcassesAcceptées, carcassesRefusées, _carcassesOuLotsRefusés] = useMemo(() => {
    const formatted = formatCountCarcasseByEspece(myCarcasses) as string[];
    const _carcassesAcceptées: string[] = [];
    let _carcassesRefusées = 0;
    let _carcassesOuLotsRefusés = '';
    for (const line of formatted) {
      if (line.includes('refusé')) {
        const nombreDAnimaux =
          line
            .split(' ')
            .map((w) => parseInt(w, 10))
            .filter(Boolean)
            .at(-1) || 0;
        _carcassesRefusées += nombreDAnimaux;
        _carcassesOuLotsRefusés = line.split(' (')[0];
      } else {
        _carcassesAcceptées.push(line);
      }
    }
    return [_carcassesAcceptées, _carcassesRefusées, _carcassesOuLotsRefusés];
  }, [myCarcasses]);

  // Formattage simple des lignes pour l'affichage
  const formattedCarcassesAcceptées = useMemo(() => {
    if (!carcassesAcceptées.length) return ['À renseigner'];

    const visibleLines = carcassesAcceptées.slice(0, maxDetailedLines);
    const hiddenCount = carcassesAcceptées.length - maxDetailedLines;

    // Compléter avec des lignes vides si nécessaire
    while (visibleLines.length < maxDetailedLines) {
      visibleLines.push('fin de liste');
    }

    visibleLines.push(
      hiddenCount > 0 ? `+ ${hiddenCount} espèce${hiddenCount > 1 ? 's' : ''}` : 'fin de liste'
    );

    return visibleLines;
  }, [carcassesAcceptées]);

  // Calcul des refus partiels (lots dont une partie a été refusée)
  const partialRefusals = useMemo(() => {
    const refusals: string[] = [];

    for (const carcasse of feiCarcasses) {
      if (carcasse?.type !== CarcasseType.PETIT_GIBIER) continue;

      const abbreviation = abbreviations[carcasse.espece as keyof typeof abbreviations];
      if (!abbreviation) continue;

      const intermediaires = filterCarcassesIntermediairesForCarcasse(
        carcassesIntermediaireById,
        carcasse.zacharie_carcasse_id!
      );
      const dernierAccepte = intermediaires
        .filter((ci) => !!ci.prise_en_charge_at)
        .sort(
          (a, b) => new Date(b.prise_en_charge_at!).getTime() - new Date(a.prise_en_charge_at!).getTime()
        )[0];

      if (dernierAccepte?.nombre_d_animaux_acceptes == null) continue;

      const total = carcasse.nombre_d_animaux ?? 0;
      const acceptes = dernierAccepte.nombre_d_animaux_acceptes;

      if (acceptes < total) {
        refusals.push(`${total - acceptes} ${abbreviation}`);
      }
    }

    return refusals;
  }, [feiCarcasses, carcassesIntermediaireById]);

  /* 
  {!isOnline && (
                <p className="bg-action-high-blue-france px-4 py-2 text-sm text-white">
                  Vous ne pouvez pas accéder au détail de vos fiches archivées sans connexion internet.
                </p>
              )}
  */

  if (filter !== 'Toutes les fiches' && filter !== simpleStatus) {
    return null;
  }

  return (
    <div
      className={[
        'relative rounded-sm bg-white',
        'w-full max-w-96',
        isPrintSelected ? 'border-action-high-blue-france border-2' : 'border border-gray-200',
        menuOpen ? 'bg-active-tint' : '',
        disabledBecauseOffline ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
      key={simpleStatus + currentStepLabelShort + dataIsSynced}
    >
      {/* Print selection checkbox */}
      <div className="absolute top-5 z-20 flex w-full justify-end pr-5">
        <Checkbox
          small
          className="card-checkbox"
          options={[
            {
              label: '',
              nativeInputProps: {
                checked: isPrintSelected,
                onChange: () => onPrintSelect?.(fei.numero, !isPrintSelected),
              },
            },
          ]}
        />
      </div>

      <Link
        to={linkTo}
        className={[
          'hover:bg-active-tint! flex size-full shrink-0 flex-col gap-y-2.5 bg-none p-5 no-underline! hover:no-underline!',
          carcassesRefusées > 0
            ? 'border-warning-main-525 border-l-3'
            : simpleStatus === 'Clôturée'
              ? 'border-action-high-blue-france border-l-3'
              : '',
          disabledBecauseOffline ? 'pointer-events-none' : '',
        ].join(' ')}
      >
        <div className="absolute top-0 right-0 text-transparent selection:text-gray-200">{fei.numero}</div>
        {!isCircuitCourt && (
          <div className="flex flex-row gap-x-2">
            <Tag
              small
              className={[
                'items-center rounded-[4px] font-semibold uppercase',
                statusColors[simpleStatus].bg,
                statusColors[simpleStatus].text,
              ].join(' ')}
            >
              {simpleStatus}
            </Tag>
            {currentStepLabelShort && (
              <Tag
                small
                className={[
                  'items-center rounded-[4px] font-semibold uppercase',
                  // statusColors[simpleStatus].bg,
                  // statusColors[simpleStatus].text,
                ].join(' ')}
              >
                {currentStepLabelShort}
              </Tag>
            )}
          </div>
        )}
        <div className="text-xl font-bold">
          {dayjs(fei.date_mise_a_mort || fei.created_at).format('DD/MM/YYYY')}
        </div>

        <div className="flex flex-col">
          <div className="flex flex-row gap-x-2">
            <div className="flex shrink basis-1/2 flex-col gap-y-1">
              <CommuneIcon />
              <p
                className={[
                  'line-clamp-2 text-sm',
                  fei.commune_mise_a_mort ? 'text-black' : 'text-neutral-400',
                ].join(' ')}
              >
                {fei.commune_mise_a_mort
                  ?.split(' ')
                  .slice(1)
                  .map((w) => w.toLocaleLowerCase())
                  .join(' ') || 'À renseigner'}
              </p>
            </div>
            <div className="flex shrink basis-1/2 flex-col gap-y-1">
              {detenteurIcon}
              <p
                className={['line-clamp-2 text-sm', detenteurName ? 'text-black' : 'text-neutral-400'].join(
                  ' '
                )}
              >
                {detenteurName || 'À renseigner'}
              </p>
            </div>
          </div>
        </div>
        {/* <div className="flex flex-col">
          <div className="flex flex-row gap-x-2">
            <div className="flex shrink basis-full flex-col gap-y-1">
              <TransportIcon />
              <p className="line-clamp-2 text-sm text-neutral-400">Pas encore de transport</p>
            </div>
          </div>
        </div> */}
        <div className="flex flex-col">
          <div className="flex flex-row gap-x-2">
            <div className="flex shrink basis-1/2 flex-col gap-y-1">
              <CarcassesIcon />
              <div>
                {formattedCarcassesAcceptées.map((line, index) => {
                  return (
                    <p
                      className={[
                        'm-0 line-clamp-1',
                        index >= maxDetailedLines ? 'text-sm' : 'text-xl',
                        line === 'À renseigner'
                          ? 'text-neutral-400'
                          : line === 'fin de liste'
                            ? 'text-transparent'
                            : 'text-neutral-700',
                      ].join(' ')}
                      key={line + index}
                    >
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
            {/* {simpleStatus === 'Clôturée' && !carcassesRefusées.length && (
              <div className="flex shrink basis-1/2 flex-col gap-y-1">
                <CheckIcon />
                // <p className="m-0 text-xl text-action-high-blue-france">0 carcasse refusée</p>
              </div>
            )} */}
            {/* {carcassesRefusées > 0 && (
              <div className="flex shrink basis-1/2 flex-col gap-y-1">
                <>
                  <RefusIcon />
                  <div>
                    <p className="text-warning-main-525 m-0 text-xl">
                      {carcassesRefusées} carcasse{carcassesRefusées > 1 ? 's' : ''} refusée
                      {carcassesRefusées > 1 ? 's' : ''}
                    </p>
                  </div>
                </>
              </div>
            )} */}
            {(!!_carcassesOuLotsRefusés || partialRefusals.length > 0) && (
              <div className="flex shrink basis-1/2 flex-col gap-y-1">
                <>
                  <RefusIcon />
                  <div>
                    {!!_carcassesOuLotsRefusés && (
                      <p className="text-warning-main-525 m-0 text-xl">{_carcassesOuLotsRefusés}</p>
                    )}
                    {partialRefusals.map((refusal, index) => (
                      <p
                        key={index}
                        className="text-warning-main-525 m-0 text-xl"
                      >
                        {refusal} refusé{parseInt(refusal, 10) > 1 ? 's' : ''}
                      </p>
                    ))}
                  </div>
                </>
              </div>
            )}
          </div>
        </div>

        {/* <div className="mt-2 -mb-2 flex grow flex-row items-end gap-x-2">
          <p className="text-sm text-neutral-700 italic opacity-50">{currentStepLabelShort}</p>
        </div> */}

        <div className="absolute right-0 bottom-0 text-transparent selection:text-gray-200">{fei.numero}</div>
      </Link>
      {disabledBecauseOffline && (
        <div className="bg-action-high-blue-france absolute bottom-0 left-0 flex grow flex-row items-end gap-x-2 px-2 py-1">
          <p className="text-sm text-white italic">
            Vous ne pouvez pas accéder au détail de vos fiches clôturées sans connexion internet.
          </p>
        </div>
      )}
    </div>
  );
}
