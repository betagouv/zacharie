import dayjs from 'dayjs';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { IconStep } from '@app/utils/transmission-labels';
import { TransmissionSimpleStatus } from '@app/types/transmission-steps';
import { useGetChasseurStatusAndLabel } from '@app/utils/get-transmissions-sorted';
import { useParams } from 'react-router';
import useZustandStore from '@app/zustand/store';

const statusColors: Record<TransmissionSimpleStatus, { bg: string; text: string }> = {
  'À compléter': { bg: 'bg-[#FEE7FC]', text: 'text-[#6E445A]' },
  'En cours': { bg: 'bg-[#FFECBD]', text: 'text-[#73603F]' },
  Clôturée: { bg: 'bg-[#E8EDFF]', text: 'text-[#01008B]' },
};

export default function ChasseurHeaderFiche() {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const [simpleStatus, currentStepLabelForChasseur] = useGetChasseurStatusAndLabel(params.fei_numero!);

  const isNewFiche = !fei.date_mise_a_mort && !fei.commune_mise_a_mort;
  const title = fei.date_mise_a_mort
    ? `Fiche du ${dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY')}`
    : 'Fiche';

  return (
    <>
      {isNewFiche ? (
        <div className="fr-mb-2w px-4 md:px-8">
          <h1 className="fr-h4 fr-mb-1w">Nouvelle fiche</h1>
        </div>
      ) : (
        <div className="fr-mb-2w rounded bg-white p-4 md:p-8">
          <h1 className="fr-h5 fr-mb-1w">{title}</h1>
          {!isNewFiche && (
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
                displayLabel={currentStepLabelForChasseur}
                simpleStatus={simpleStatus}
              />
              <span className="text-sm">{currentStepLabelForChasseur}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
