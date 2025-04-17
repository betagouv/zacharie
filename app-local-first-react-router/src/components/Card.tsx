import { FeiDone } from '@api/src/types/fei';
import type { FeiStep } from '@app/types/fei-steps';
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

const statusColors: Record<FeiStep, { bg: string; text: string }> = {
  'Examen initial': {
    bg: 'bg-[#FCF5E4]',
    text: 'text-[#716043]',
  },
  'Validation par le premier détenteur': {
    bg: 'bg-[#E9F7EF]',
    text: 'text-[#1F8D49]',
  },
  "Transport vers l'établissement de traitement": {
    bg: 'bg-[#E9F7EF]',
    text: 'text-[#1F8D49]',
  },
  'Fiche envoyée, pas encore traitée': {
    bg: 'bg-[#E9F7EF]',
    text: 'text-[#1F8D49]',
  },
  "Réception par l'établissement de traitement": {
    bg: 'bg-[#E9F7EF]',
    text: 'text-[#1F8D49]',
  },
  'Inspection par le SVI': {
    bg: 'bg-[#E9F7EF]',
    text: 'text-[#1F8D49]',
  },
  Clôturée: {
    bg: 'bg-[#E9F7EF]',
    text: 'text-[#1F8D49]',
  },
};

export default function Card({ fei, onPrintSelect, isPrintSelected = false }: CardProps) {
  const { currentStepLabel } = useFeiSteps(fei);
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
        className="hover:!bg-active-tint flex size-full shrink-0 flex-col gap-3 bg-none p-6 !no-underline hover:!no-underline"
      >
        <div className="absolute right-0 top-0 text-transparent selection:text-gray-200">{fei.numero}</div>
        <Tag
          className={[
            'items-center rounded-full px-3 py-1 text-xs',
            statusColors[currentStepLabel].bg,
            statusColors[currentStepLabel].text,
          ].join(' ')}
        >
          {currentStepLabel}
        </Tag>
        <div className="text-2xl font-bold">
          {fei.date_mise_a_mort
            ? dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY')
            : 'Date de chasse non renseignée'}
        </div>

        <div className="flex flex-col">
          <div className="text-gray-600">
            {fei.premier_detenteur_name_cache || 'Nom du premier détenteur non renseigné'}
          </div>
          <div className="text-gray-600">{fei.commune_mise_a_mort || 'Commune de chasse non renseignée'}</div>
        </div>

        <div>
          {carcassesAcceptées.map((line) => {
            return (
              <p className={line.includes('refus') ? 'm-0 font-semibold' : 'm-0'} key={line}>
                {line}
              </p>
            );
          })}
        </div>
        <div>
          {carcassesRefusées.length > 0 && (
            <div className="flex flex-row gap-x-2">
              <p className="m-0 font-semibold text-red-700">↳</p>
              <div>
                {carcassesRefusées.map((line) => {
                  return (
                    <p className="m-0 font-semibold text-red-700" key={line}>
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="absolute bottom-0 right-0 text-transparent selection:text-gray-200">{fei.numero}</div>
      </Link>
    </div>
  );
}
