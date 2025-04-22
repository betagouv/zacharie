import { FeiDone } from '@api/src/types/fei';
import type { FeiStepSimpleStatus } from '@app/types/fei-steps';
import { useFeiSteps } from '@app/utils/fei-steps';
import dayjs from 'dayjs';
import { Link } from 'react-router';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { useMemo, useState, useRef, useEffect } from 'react';

interface CardProps {
  fei: FeiDone;
  onPrintSelect?: (feiNumber: string, selected: boolean) => void;
  isPrintSelected?: boolean;
}

const statusColors: Record<FeiStepSimpleStatus, { bg: string; text: string }> = {
  'À compléter': {
    bg: 'bg-[#FEE7FC]',
    text: 'text-[#6E445A]',
  },
  'En cours': {
    bg: 'bg-[#E8EDFF]',
    text: 'text-[#3558A2]',
  },
  Clôturée: {
    bg: 'bg-[#E3FDEB]',
    text: 'text-[#297254]',
  },
};

export default function Card({ fei, onPrintSelect, isPrintSelected = false }: CardProps) {
  const { simpleStatus } = useFeiSteps(fei);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const [carcassesAcceptées, carcassesRefusées] = useMemo(() => {
    const _carcassesAcceptées = [];
    const _carcassesRefusées = [];
    for (const carcasse of fei.resume_nombre_de_carcasses?.split('\n') || []) {
      if (carcasse.includes('refusé')) {
        _carcassesRefusées.push(carcasse);
      } else {
        _carcassesAcceptées.push(carcasse);
      }
    }
    return [_carcassesAcceptées, _carcassesRefusées];
  }, [fei.resume_nombre_de_carcasses]);

  return (
    <div
      className={[
        'relative rounded bg-white',
        'w-full max-w-96',
        isPrintSelected ? 'border-2 border-action-high-blue-france' : 'border border-gray-200',
        menuOpen ? 'bg-active-tint' : '',
      ].join(' ')}
    >
      {/* Print selection checkbox */}
      {isPrintSelected && (
        <div className="absolute left-2 top-2 z-10">
          <Checkbox
            classes={{ root: 'mt-0' }}
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
      )}

      {/* Custom dropdown menu */}
      <div className="absolute right-2 top-2 z-20" ref={menuRef}>
        <Button
          iconId="fr-icon-more-line"
          priority="tertiary no outline"
          title="Menu"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
        />
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              onClick={(e) => {
                e.preventDefault();
                onPrintSelect?.(fei.numero, !isPrintSelected);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-[var(--text-title-grey)] hover:bg-[var(--background-action-low-blue-france)]"
            >
              <i className="fr-icon-printer-line" aria-hidden="true" />
              <span>
                {isPrintSelected ? 'Désélectionner pour impression' : 'Sélectionner pour impression'}
              </span>
            </button>
          </div>
        )}
      </div>
      <Link
        to={`/app/tableau-de-bord/fei/${fei.numero}`}
        className="flex size-full shrink-0 flex-col gap-3 bg-none p-6 !no-underline hover:!bg-active-tint hover:!no-underline"
      >
        <div className="absolute right-0 top-0 text-transparent selection:text-gray-200">{fei.numero}</div>
        <Tag
          small
          className={[
            'items-center font-semibold uppercase',
            statusColors[simpleStatus].bg,
            statusColors[simpleStatus].text,
          ].join(' ')}
        >
          {simpleStatus}
        </Tag>
        <div className="text-2xl font-bold">
          {dayjs(fei.date_mise_a_mort || fei.created_at).format('DD/MM/YYYY')}
        </div>

        <div className="flex flex-col">
          <div className="flex flex-row gap-x-2">
            <div className="flex shrink basis-1/2 flex-col gap-y-1">
              <CommuneIcon />
              <p className="text-gray-600">{fei.commune_mise_a_mort?.split(' ').slice(1).join(' ')}</p>
            </div>
            <div className="flex shrink basis-1/2 flex-col gap-y-1">
              <ChasseIcon />
              <p className="text-gray-600">{fei.premier_detenteur_name_cache}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex flex-row gap-x-2">
            <div className="flex shrink basis-1/2 flex-col gap-y-1">
              <CarcassesIcon />
              <div>
                {carcassesAcceptées.map((line) => {
                  return (
                    <p className={line.includes('refus') ? 'm-0 font-semibold' : 'm-0'} key={line}>
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
            {carcassesRefusées.length > 0 && (
              <div className="flex shrink basis-1/2 flex-col gap-y-1">
                <>
                  <RefusIcon />
                  <div>
                    {carcassesRefusées.map((line) => {
                      return (
                        <p className="text-error-main-525 m-0 font-semibold" key={line}>
                          {line}
                        </p>
                      );
                    })}
                  </div>
                </>
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-0 right-0 text-transparent selection:text-gray-200">{fei.numero}</div>
      </Link>
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
    <svg width="19" height="16" viewBox="0 0 19 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13.3704 9.00701L15.1297 10.7391C9.14812 16.6283 4.22223 16.6283 0 15.2426L15.4815 0L19 3.46422L13.3704 9.00701ZM10.5556 9.00701L16.1852 3.46422L15.4815 2.77138L4.03912 14.0372C6.75754 14.1424 9.37104 13.1491 12.2657 10.6907L10.5556 9.00701Z"
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
        className="fill-error-main-525"
      />
    </svg>
  );
}
