import dayjs from 'dayjs';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { useFeiSteps, IconStep } from '@app/utils/fei-steps';
import type { FeiStepSimpleStatus } from '@app/types/fei-steps';
import { useParams } from 'react-router';
import useZustandStore from '@app/zustand/store';

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

export default function EtgHeaderFiche() {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const { simpleStatus, currentStepLabelForEtg } = useFeiSteps(fei);

  const chasseTitle = `Fiche du ${dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY')}`;
  const title = fei.premier_detenteur_name_cache
    ? `${chasseTitle} | ${fei.premier_detenteur_name_cache}`
    : chasseTitle;

  return (
    <div className="fr-mb-2w rounded bg-white p-4 md:p-8">
      <h1 className="fr-h5 fr-mb-1w">{title}</h1>
      <div className="flex items-center gap-2">
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
        <IconStep
          displayLabel={currentStepLabelForEtg}
          simpleStatus={simpleStatus}
        />
        <span className="text-sm">{currentStepLabelForEtg}</span>
      </div>
    </div>
  );
}
