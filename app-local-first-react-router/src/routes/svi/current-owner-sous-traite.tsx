import { UserRoles } from '@prisma/client';
import { CallOut } from '@codegouvfr/react-dsfr/CallOut';
import { Button } from '@codegouvfr/react-dsfr/Button';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import { createHistoryInput } from '@app/utils/create-history-entry';
import DestinataireSelectSousTraite from './destinataire-select-sous-traite';
import { getFeiAndIntermediaireIdsFromFeiIntermediaire } from '@app/utils/get-carcasse-intermediaire-id';
import { useGetTransmissionFromURLParams } from '@app/utils/get-transmissions-sorted';

export default function FeiSousTraite() {
  const user = useUser((state) => state.user)!;
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const addLog = useZustandStore((state) => state.addLog);
  const transmissionMetadata = useGetTransmissionFromURLParams();
  const fei_numero = transmissionMetadata.fei.numero;
  const feiCarcasses = transmissionMetadata.carcasses;
  const transmission = transmissionMetadata.content;
  const carcasseIds = feiCarcasses.map((c) => c.zacharie_carcasse_id);
  const intermediaires = transmissionMetadata.intermediaires;
  const latestIntermediaire = intermediaires[0];
  const feiAndIntermediaireIds = latestIntermediaire
    ? getFeiAndIntermediaireIdsFromFeiIntermediaire(latestIntermediaire)
    : undefined;

  if (!transmission.next_owner_wants_to_sous_traite) {
    return null;
  }
  if (transmission.next_owner_sous_traite_by_user_id !== user.id) {
    return null;
  }

  return (
    <div className="bg-alt-blue-france pb-4">
      <CallOut
        title="Vous souhaitez sous-traiter le transport des carcasses"
        className="bg-white"
      >
        <div className="flex w-full flex-col bg-white md:items-start md:[&_ul]:min-w-96">
          <DestinataireSelectSousTraite
            feiAndIntermediaireIds={feiAndIntermediaireIds}
            intermediaire={latestIntermediaire}
          />
        </div>
        <span className="text-sm">Vous avez changé d'avis&nbsp;?</span>
        <Button
          priority="tertiary no outline"
          type="submit"
          className="text-sm"
          onClick={() => {
            const nextTransmission = {
              next_owner_wants_to_sous_traite: false,
              next_owner_sous_traite_by_user_id: null,
            };
            updateCarcassesTransmission(carcasseIds, nextTransmission);
            addLog({
              user_id: user.id,
              user_role: transmission.next_owner_role || (user.roles[0] as UserRoles),
              fei_numero: fei_numero,
              action: 'current-owner-sous-traite-change-mind',
              entity_id: transmission.next_owner_entity_id,
              zacharie_carcasse_id: null,
              intermediaire_id: null,
              carcasse_intermediaire_id: null,
              history: createHistoryInput(transmission, nextTransmission),
            });
            syncData('current-owner-sous-traite-change-mind');
          }}
        >
          Annuler
        </Button>
      </CallOut>
    </div>
  );
}
