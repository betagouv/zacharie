import { UserRoles } from '@prisma/client';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Button } from '@codegouvfr/react-dsfr/Button';
import SelectNextForExaminateur from './examinateur-select-next';
// import { mergeFei } from '@app/db/fei.client';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { createHistoryInput } from '@app/utils/create-history-entry';
import DestinataireSelect from './destinataire-select';

export default function FeiTransfer() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateFei = useZustandStore((state) => state.updateFei);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];

  if (!fei.fei_current_owner_wants_to_transfer) {
    return null;
  }
  if (fei.fei_current_owner_user_id !== user.id) {
    return null;
  }

  return (
    <div className="bg-alt-blue-france pb-4">
      <CallOut title="Vous souhaitez transférer cette fiche" className="bg-white">
        <div className="flex w-full flex-col bg-white md:items-start md:[&_ul]:min-w-96">
          {fei.fei_prev_owner_role === UserRoles.EXAMINATEUR_INITIAL ? (
            <SelectNextForExaminateur />
          ) : (
            <DestinataireSelect canEdit transfer calledFrom="current-owner-transfer" />
          )}
        </div>
        <span className="text-sm">Vous avez changé d'avis&nbsp;?</span>
        <Button
          priority="tertiary no outline"
          type="submit"
          className="text-sm"
          onClick={() => {
            const nextFei = {
              fei_current_owner_wants_to_transfer: false,
              fei_next_owner_entity_id: null,
              fei_next_owner_role: null,
              fei_next_owner_user_id: null,
            };
            updateFei(fei.numero, nextFei);
            addLog({
              user_id: user.id,
              user_role: fei.fei_next_owner_role!,
              fei_numero: fei.numero,
              action: 'current-owner-transfer',
              entity_id: fei.fei_next_owner_entity_id,
              zacharie_carcasse_id: null,
              intermediaire_id: null,
              carcasse_intermediaire_id: null,
              history: createHistoryInput(fei, nextFei),
            });
          }}
        >
          Je prends en charge cette fiche
        </Button>
      </CallOut>
    </div>
  );
}
