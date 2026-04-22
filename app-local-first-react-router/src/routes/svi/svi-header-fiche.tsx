import dayjs from 'dayjs';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { useFeiSteps } from '@app/utils/fei-steps';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import type { FeiStepSimpleStatus } from '@app/types/fei-steps';

const statusColors: Record<FeiStepSimpleStatus, { bg: string; text: string }> = {
  'À compléter': { bg: 'bg-[#FEE7FC]', text: 'text-[#6E445A]' },
  'En cours': { bg: 'bg-[#FFECBD]', text: 'text-[#73603F]' },
  Clôturée: { bg: 'bg-[#E8EDFF]', text: 'text-[#01008B]' },
};

export default function SviHeaderFiche({ fei }: { fei: FeiWithIntermediaires }) {
  const { simpleStatus } = useFeiSteps(fei);
  const chasseTitle = `Chasse du ${dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY')}`;
  const title = fei.premier_detenteur_name_cache
    ? `${chasseTitle} | ${fei.premier_detenteur_name_cache}`
    : chasseTitle;

  return (
    <div className="fr-mb-2w rounded bg-white p-4 md:p-8">
      <h1 className="fr-h3 fr-mb-1w">{title}</h1>
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
    </div>
  );
}
