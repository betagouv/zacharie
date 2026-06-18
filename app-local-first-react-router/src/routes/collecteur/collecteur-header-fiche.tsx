import dayjs from 'dayjs';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { IconStep } from '@app/utils/transmission-labels';
import type { TransmissionSimpleStatus } from '@app/types/transmission-steps';
import { useParams } from 'react-router';
import { useTransmissionWithMetadata } from '@app/utils/get-transmissions-sorted';

const statusColors: Record<TransmissionSimpleStatus, { bg: string; text: string }> = {
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

export default function CollecteurHeaderFiche() {
  const params = useParams();
  const transmission = useTransmissionWithMetadata(params.fei_numero!);
  const fei = transmission.fei;
  const simpleStatus = transmission.labels.simpleStatus;
  const currentStepLabel = transmission.labels.currentStepLabel;

  const chasseTitle = `Fiche du ${dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY')}`;
  const title = transmission.content.premier_detenteur_name_cache
    ? `${chasseTitle} | ${transmission.content.premier_detenteur_name_cache}`
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
          displayLabel={currentStepLabel}
          simpleStatus={simpleStatus}
        />
        <span className="text-sm">{currentStepLabel}</span>
      </div>
    </div>
  );
}
