import type { FeiWithIntermediaires } from '@api/src/types/fei';
import type { FeiStepSimpleStatus } from '@app/types/fei-steps';
import { useFeiSteps } from '@app/utils/fei-steps';
import dayjs from 'dayjs';
import { Link } from 'react-router';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { useMemo, useState, useRef, useEffect } from 'react';
import useZustandStore from '@app/zustand/store';
import { useIsCircuitCourt } from '@app/utils/circuit-court';
import { CarcasseType } from '@prisma/client';
import { abbreviations } from '@app/utils/count-carcasses';

interface CardProps {
  fei: FeiWithIntermediaires;
  onPrintSelect?: (feiNumber: string, selected: boolean) => void;
  isPrintSelected?: boolean;
  disabledBecauseOffline?: boolean;
  filter: FeiStepSimpleStatus | 'Toutes les fiches';
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
}: CardProps) {
  const { simpleStatus, currentStepLabelShort } = useFeiSteps(fei);
  const isCircuitCourt = useIsCircuitCourt();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dataIsSynced = useZustandStore((state) => state.dataIsSynced);
  const carcasses = useZustandStore((state) => state.carcasses);
  const carcassesIdsByFei = useZustandStore((state) => state.carcassesIdsByFei);
  const getCarcassesIntermediairesForCarcasse = useZustandStore(
    (state) => state.getCarcassesIntermediairesForCarcasse,
  );

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
    if (!fei.resume_nombre_de_carcasses) {
      return [[], 0, ''];
    }
    const _carcassesAcceptées = [];
    let _carcassesRefusées = 0;
    let _carcassesOuLotsRefusés = '';
    for (const carcasse of fei.resume_nombre_de_carcasses?.split('\n') || []) {
      if (carcasse.includes('refusé')) {
        // soit "10 carcasses refusées" soit "3 lots refusés (23 carcasses)"
        // on veut récupérer 10 et 23, soit le dernier numéro de la phrase
        // et faire la somme de toutes les carcasses refusées
        const nombreDAnimaux =
          carcasse
            .split(' ')
            .map((w) => parseInt(w, 10))
            .filter(Boolean)
            .at(-1) || 0;
        _carcassesRefusées += nombreDAnimaux;
        _carcassesOuLotsRefusés = carcasse.split(' (')[0];
      } else if (carcasse) {
        _carcassesAcceptées.push(carcasse);
      }
    }
    return [_carcassesAcceptées, _carcassesRefusées, _carcassesOuLotsRefusés];
  }, [fei.resume_nombre_de_carcasses]);

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
      hiddenCount > 0 ? `+ ${hiddenCount} espèce${hiddenCount > 1 ? 's' : ''}` : 'fin de liste',
    );

    return visibleLines;
  }, [carcassesAcceptées]);

  // Calcul des refus partiels (lots dont une partie a été refusée)
  const partialRefusals = useMemo(() => {
    const feiCarcasses = (carcassesIdsByFei[fei.numero] || []).map((id) => carcasses[id]);
    const refusals: string[] = [];

    for (const carcasse of feiCarcasses) {
      if (carcasse?.type !== CarcasseType.PETIT_GIBIER) continue;

      const abbreviation = abbreviations[carcasse.espece as keyof typeof abbreviations];
      if (!abbreviation) continue;

      const intermediaires = getCarcassesIntermediairesForCarcasse(carcasse.zacharie_carcasse_id!);
      const dernierAccepte = intermediaires
        .filter((ci) => !!ci.prise_en_charge_at)
        .sort(
          (a, b) => new Date(b.prise_en_charge_at!).getTime() - new Date(a.prise_en_charge_at!).getTime(),
        )[0];

      if (dernierAccepte?.nombre_d_animaux_acceptes == null) continue;

      const total = carcasse.nombre_d_animaux ?? 0;
      const acceptes = dernierAccepte.nombre_d_animaux_acceptes;

      if (acceptes < total) {
        refusals.push(`${total - acceptes} ${abbreviation}`);
      }
    }

    return refusals;
  }, [carcasses, carcassesIdsByFei, fei.numero, getCarcassesIntermediairesForCarcasse]);

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
        to={`/app/tableau-de-bord/fei/${fei.numero}`}
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
              <ChasseIcon />
              <p
                className={[
                  'line-clamp-2 text-sm',
                  fei.premier_detenteur_name_cache ? 'text-black' : 'text-neutral-400',
                ].join(' ')}
              >
                {/* {user?.roles.includes(UserRoles.SVI) ? (
                  <>{fei.latest_intermediaire_name_cache || 'À renseigner'}</>
                ) : (
                  <>{fei.premier_detenteur_name_cache || 'À renseigner'}</>
                )} */}
                <>{fei.premier_detenteur_name_cache || 'À renseigner'}</>
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
                      <p key={index} className="text-warning-main-525 m-0 text-xl">
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

function CommuneIcon() {
  return (
    <svg width="13" height="15" viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.49999 15L1.9038 10.6066C-0.634601 8.18017 -0.634601 4.24622 1.9038 1.81981C4.44221 -0.606603 8.55774 -0.606603 11.0962 1.81981C13.6346 4.24622 13.6346 8.18017 11.0962 10.6066L6.49999 15ZM10.0748 9.63027C12.0491 7.74311 12.0491 4.68332 10.0748 2.79612C8.10051 0.90891 4.89949 0.90891 2.92518 2.79612C0.950862 4.68332 0.950862 7.74311 2.92518 9.63027L6.49999 13.0474L10.0748 9.63027ZM6.49999 7.59392C5.70223 7.59392 5.05555 6.97578 5.05555 6.21321C5.05555 5.45066 5.70223 4.8325 6.49999 4.8325C7.29776 4.8325 7.94443 5.45066 7.94443 6.21321C7.94443 6.97578 7.29776 7.59392 6.49999 7.59392Z"
        fill="black"
      />
    </svg>
  );
}

function ChasseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 15C0 11.8441 2.55837 9.28571 5.71429 9.28571C8.87021 9.28571 11.4286 11.8441 11.4286 15H10C10 12.6331 8.08121 10.7143 5.71429 10.7143C3.34735 10.7143 1.42857 12.6331 1.42857 15H0ZM5.71429 8.57143C3.34643 8.57143 1.42857 6.65357 1.42857 4.28571C1.42857 1.91786 3.34643 0 5.71429 0C8.08214 0 10 1.91786 10 4.28571C10 6.65357 8.08214 8.57143 5.71429 8.57143ZM5.71429 7.14286C7.29286 7.14286 8.57143 5.86429 8.57143 4.28571C8.57143 2.70714 7.29286 1.42857 5.71429 1.42857C4.13571 1.42857 2.85714 2.70714 2.85714 4.28571C2.85714 5.86429 4.13571 7.14286 5.71429 7.14286ZM11.6312 9.78771C13.6174 10.6829 15 12.68 15 15H13.5714C13.5714 13.26 12.5345 11.7622 11.0449 11.0908L11.6312 9.78771ZM11.1401 1.72372C12.5674 2.31216 13.5714 3.71686 13.5714 5.35714C13.5714 7.40729 12.003 9.08943 10 9.26971V7.83186C11.2119 7.65871 12.1429 6.61714 12.1429 5.35714C12.1429 4.37096 11.5726 3.51859 10.7436 3.11168L11.1401 1.72372Z"
        fill="black"
      />
    </svg>
  );
}

function CarcassesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7.27273 2.96065C5.04313 3.27956 3.27956 5.04313 2.96065 7.27273H4.36364V8.72727H2.96065C3.27956 10.9569 5.04313 12.7204 7.27273 13.0393V11.6364H8.72727V13.0393C10.9569 12.7204 12.7204 10.9569 13.0393 8.72727H11.6364V7.27273H13.0393C12.7204 5.04313 10.9569 3.27956 8.72727 2.96065V4.36364H7.27273V2.96065ZM1.49449 7.27273C1.82988 4.23882 4.23882 1.82988 7.27273 1.49449V0H8.72727V1.49449C11.7612 1.82988 14.1701 4.23882 14.5055 7.27273H16V8.72727H14.5055C14.1701 11.7612 11.7612 14.1701 8.72727 14.5055V16H7.27273V14.5055C4.23882 14.1701 1.82988 11.7612 1.49449 8.72727H0V7.27273H1.49449ZM9.45455 8C9.45455 8.80335 8.80335 9.45455 8 9.45455C7.19665 9.45455 6.54545 8.80335 6.54545 8C6.54545 7.19665 7.19665 6.54545 8 6.54545C8.80335 6.54545 9.45455 7.19665 9.45455 8Z"
        fill="black"
      />
    </svg>
  );
}

function RefusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 16C3.58172 16 0 12.4182 0 8C0 3.58172 3.58172 0 8 0C12.4182 0 16 3.58172 16 8C16 12.4182 12.4182 16 8 16ZM8 6.86864L5.73726 4.60589L4.60589 5.73726L6.86864 8L4.60589 10.2627L5.73726 11.3941L8 9.13136L10.2627 11.3941L11.3941 10.2627L9.13136 8L11.3941 5.73726L10.2627 4.60589L8 6.86864Z"
        className="fill-warning-main-525"
      />
    </svg>
  );
}

// function TransportIcon() {
//   return (
//     <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
//       <path d="M8.96456 18C8.72194 19.6961 7.26324 21 5.5 21C3.73676 21 2.27806 19.6961 2.03544 18H1V6C1 5.44772 1.44772 5 2 5H16C16.5523 5 17 5.44772 17 6V8H20L23 12.0557V18H20.9646C20.7219 19.6961 19.2632 21 17.5 21C15.7368 21 14.2781 19.6961 14.0354 18H8.96456ZM15 7H3V15.0505C3.63526 14.4022 4.52066 14 5.5 14C6.8962 14 8.10145 14.8175 8.66318 16H14.3368C14.5045 15.647 14.7296 15.3264 15 15.0505V7ZM17 13H21V12.715L18.9917 10H17V13ZM17.5 19C18.1531 19 18.7087 18.5826 18.9146 18C18.9699 17.8436 19 17.6753 19 17.5C19 16.6716 18.3284 16 17.5 16C16.6716 16 16 16.6716 16 17.5C16 17.6753 16.0301 17.8436 16.0854 18C16.2913 18.5826 16.8469 19 17.5 19ZM7 17.5C7 16.6716 6.32843 16 5.5 16C4.67157 16 4 16.6716 4 17.5C4 17.6753 4.03008 17.8436 4.08535 18C4.29127 18.5826 4.84689 19 5.5 19C6.15311 19 6.70873 18.5826 6.91465 18C6.96992 17.8436 7 17.6753 7 17.5Z"></path>
//     </svg>
//   );
// }
