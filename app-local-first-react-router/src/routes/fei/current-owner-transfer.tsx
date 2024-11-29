import { UserRoles } from '@prisma/client';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Button } from '@codegouvfr/react-dsfr/Button';
import SelectNextForExaminateur from './examinateur-select-next';
import SelectNextOwnerForPremierDetenteurOrIntermediaire from './premier-detenteur-intermediaire-select-next';
// import { mergeFei } from '@app/db/fei.client';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';

export default function FeiTransfer() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const updateFei = state.updateFei;
  const fei = state.feis[params.fei_numero!];

  if (!fei.fei_current_owner_wants_to_transfer) {
    return null;
  }
  if (fei.fei_current_owner_user_id !== user.id) {
    return null;
  }

  return (
    <div className="bg-alt-blue-france pb-4">
      <CallOut title="Vous souhaitez transférer cette fiche" className="bg-white">
        <div className="flex w-full flex-col bg-white md:items-start [&_ul]:md:min-w-96">
          {fei.fei_prev_owner_role === UserRoles.EXAMINATEUR_INITIAL ? (
            <SelectNextForExaminateur />
          ) : (
            <SelectNextOwnerForPremierDetenteurOrIntermediaire />
          )}
        </div>
        <span className="text-sm">Vous avez changé d'avis&nbsp;?</span>
        <Button
          priority="tertiary no outline"
          type="submit"
          className="text-sm"
          onClick={() => {
            updateFei(fei.numero, {
              fei_current_owner_wants_to_transfer: false,
              fei_next_owner_entity_id: null,
              fei_next_owner_role: null,
              fei_next_owner_user_id: null,
            });
          }}
        >
          Je prends en charge cette fiche
        </Button>
      </CallOut>
    </div>
  );
}
