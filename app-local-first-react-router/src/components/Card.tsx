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
      className={`relative ${isPrintSelected ? 'border-2 border-action-high-blue-france' : 'border border-gray-200'} rounded bg-white`}
    >
      <Link
        to={`/app/tableau-de-bord/fei/${fei.numero}`}
        className="p-6 relative rounded !no-underline hover:!no-underline max-w-96 flex flex-col gap-3 bg-none shrink-0"
      >
        {/* Print selection checkbox */}
        {isPrintSelected && (
          <div className="absolute top-2 left-2 z-10">
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
        <div className="absolute top-2 right-2 z-20" ref={menuRef}>
          <Button
            iconId="fr-icon-more-line"
            priority="tertiary no outline"
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen(!menuOpen);
            }}
            className="!p-2"
          />
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onPrintSelect?.(fei.numero, !isPrintSelected);
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-[var(--background-action-low-blue-france)] flex items-center gap-2 text-[var(--text-title-grey)]"
              >
                <i className="fr-icon-printer-line" aria-hidden="true" />
                <span>
                  {isPrintSelected ? 'Désélectionner pour impression' : 'Sélectionner pour impression'}
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="absolute text-transparent selection:text-gray-200 top-0 right-0">{fei.numero}</div>
        <Tag
          className={[
            'px-3 py-1 rounded-full text-xs items-center',
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
              <p className={line.includes('refus') ? 'font-semibold m-0' : 'm-0'} key={line}>
                {line}
              </p>
            );
          })}
        </div>
        <div>
          {carcassesRefusées.length > 0 && (
            <div className="flex flex-row gap-x-2">
              <p className="font-semibold m-0 text-red-700">↳</p>
              <div>
                {carcassesRefusées.map((line) => {
                  return (
                    <p className="font-semibold m-0 text-red-700" key={line}>
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="absolute text-transparent selection:text-gray-200 bottom-0 right-0">{fei.numero}</div>
      </Link>
    </div>
  );
}
