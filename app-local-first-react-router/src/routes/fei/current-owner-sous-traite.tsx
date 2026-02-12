import { FeiOwnerRole, UserRoles } from '@prisma/client';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Button } from '@codegouvfr/react-dsfr/Button';
import SelectNextForExaminateur from './examinateur-select-next';
// import { mergeFei } from '@app/db/fei.client';
import { useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { createHistoryInput } from '@app/utils/create-history-entry';
import DestinataireSelect from './destinataire-select';
import { getFeiAndIntermediaireIdsFromFeiIntermediaire } from '@app/utils/get-carcasse-intermediaire-id';
import { useFeiIntermediaires } from '@app/utils/get-carcasses-intermediaires';

export default function FeiSousTraite() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateFei = useZustandStore((state) => state.updateFei);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const intermediaires = useFeiIntermediaires(fei.numero);
  const latestIntermediaire = intermediaires[0];
  const feiAndIntermediaireIds = latestIntermediaire
    ? getFeiAndIntermediaireIdsFromFeiIntermediaire(latestIntermediaire)
    : undefined;

  if (!fei.fei_next_owner_wants_to_sous_traite) {
    return null;
  }
  if (fei.fei_next_owner_sous_traite_by_user_id !== user.id) {
    return null;
  }

  return (
    <div className="bg-alt-blue-france pb-4">
      <CallOut title="Vous souhaitez sous-traiter le transport des carcasses" className="bg-white">
        <div className="flex w-full flex-col bg-white md:items-start md:[&_ul]:min-w-96">
          {fei.fei_prev_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL ? (
            <SelectNextForExaminateur />
          ) : (
            <DestinataireSelect
              canEdit
              sousTraite
              calledFrom="current-owner-sous-traite"
              feiAndIntermediaireIds={feiAndIntermediaireIds}
              intermediaire={latestIntermediaire}
            />
          )}
        </div>
        <span className="text-sm">Vous avez changé d'avis&nbsp;?</span>
        <Button
          priority="tertiary no outline"
          type="submit"
          className="text-sm"
          onClick={() => {
            const nextFei = {
              fei_next_owner_wants_to_sous_traite: false,
              fei_next_owner_sous_traite_by_user_id: null,
            };
            updateFei(fei.numero, nextFei);
            addLog({
              user_id: user.id,
              user_role: fei.fei_next_owner_role || (user.roles[0] as UserRoles),
              fei_numero: fei.numero,
              action: 'current-owner-sous-traite-change-mind',
              entity_id: fei.fei_next_owner_entity_id,
              zacharie_carcasse_id: null,
              intermediaire_id: null,
              carcasse_intermediaire_id: null,
              history: createHistoryInput(fei, nextFei),
            });
          }}
        >
          Annuler
        </Button>
      </CallOut>
    </div>
  );
}
