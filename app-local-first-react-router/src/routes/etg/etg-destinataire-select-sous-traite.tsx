import { useMemo, useState } from 'react';
import { Prisma, EntityTypes, EntityRelationType, FeiOwnerRole } from '@prisma/client';
import dayjs from 'dayjs';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import { useEtgIds, useSviIds, useCollecteursProIds } from '@app/utils/get-entity-relations';
import SelectCustom from '@app/components/SelectCustom';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { getEntityDisplay } from '@app/utils/get-entity-display';
import Button from '@codegouvfr/react-dsfr/Button';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import type { CarcassesIntermediaire, FeiAndIntermediaireIds } from '@app/types/carcasses-intermediaire';
import { CarcasseIntermediaire } from '@prisma/client';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import PartenaireNouveau from '@app/components/PartenaireNouveau';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import { CarcasseTransmission } from '@app/types/carcasse';
import { useGetTransmissionFromURLParams } from '@app/utils/get-transmissions-sorted';

const partenaireModal = createModal({
  isOpenedByDefault: false,
  id: 'partenaire-modal-st',
});

export default function DestinataireSousTraite({
  className = '',
  feiAndIntermediaireIds,
  intermediaire,
}: {
  className?: string;
  feiAndIntermediaireIds?: FeiAndIntermediaireIds;
  intermediaire?: CarcassesIntermediaire;
}) {
  const user = useUser((state) => state.user)!;
  const isOnline = useIsOnline();
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const updateAllCarcasseIntermediaire = useZustandStore((state) => state.updateAllCarcasseIntermediaire);
  const addLog = useZustandStore((state) => state.addLog);
  const entities = useZustandStore((state) => state.entities);
  const etgsIds = useEtgIds();
  const svisIds = useSviIds();
  const collecteursProIds = useCollecteursProIds();

  const isPartenaireModalOpen = useIsModalOpen(partenaireModal);

  const transmissionMetadata = useGetTransmissionFromURLParams();
  const fei_numero = transmissionMetadata.fei.numero;
  const carcasses = transmissionMetadata.carcasses;
  const transmission = transmissionMetadata.content;
  const carcasseIds = carcasses.map((c) => c.zacharie_carcasse_id);

  const etgs = etgsIds.map((id) => entities[id]);
  const collecteursPros = collecteursProIds.map((id) => entities[id]);
  const svis = svisIds.map((id) => entities[id]);

  const prochainsDetenteurs = useMemo(() => {
    if (transmission.current_owner_role === FeiOwnerRole.ETG) {
      return [
        ...svis.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
        ...etgs.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
        ...collecteursPros.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
      ];
    }
    return [
      ...etgs.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
      ...collecteursPros.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
    ];
  }, [etgs, collecteursPros, svis, transmission.current_owner_role]);

  const canTransmitCarcassesToEntities = useMemo(() => {
    return prochainsDetenteurs.filter(
      (entity) => entity.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY
    );
  }, [prochainsDetenteurs]);

  const prochainsDetenteursOptions = useMemo(() => {
    return prochainsDetenteurs.map((entity) => ({
      label: getEntityDisplay(entity),
      value: entity.id,
    }));
  }, [prochainsDetenteurs]);

  const [prochainDetenteurEntityId, setProchainDetenteurEntityId] = useState(() => {
    if (intermediaire?.intermediaire_prochain_detenteur_id_cache) {
      return intermediaire.intermediaire_prochain_detenteur_id_cache;
    }
    return null;
  });
  const [newEntityNomDUsage, setNewEntityNomDUsage] = useState<string | null>(null);

  const prochainDetenteur = prochainDetenteurEntityId ? entities[prochainDetenteurEntityId] : null;
  const prochainDetenteurType = prochainDetenteur?.type;

  const needToSubmit = useMemo(() => {
    if (!prochainDetenteurEntityId) {
      return true;
    }
    if (prochainDetenteurEntityId !== transmission.next_owner_entity_id) {
      return true;
    }
    if (prochainDetenteurType === EntityTypes.SVI) {
      return false;
    }
    return false;
  }, [prochainDetenteurEntityId, prochainDetenteurType, transmission.next_owner_entity_id]);

  const [tryToSubmitAtLeastOnce, setTryTOSubmitAtLeastOnce] = useState(false);

  const handleSubmit = () => {
    if (!prochainDetenteurEntityId) return;
    const nextTransmission: CarcasseTransmission = {
      next_owner_entity_id: prochainDetenteurEntityId,
      next_owner_role: prochainDetenteurType as FeiOwnerRole,
      next_owner_wants_to_sous_traite: false,
      next_owner_sous_traite_at: dayjs().toDate(),
      next_owner_sous_traite_by_user_id: user.id,
      next_owner_sous_traite_by_entity_id: transmission.next_owner_entity_id ?? null,
      current_owner_entity_id: transmission.prev_owner_entity_id ?? null,
      current_owner_role: transmission.prev_owner_role ?? null,
      current_owner_user_id: transmission.prev_owner_user_id ?? null,
      svi_assigned_at: prochainDetenteurType === EntityTypes.SVI ? dayjs().toDate() : null,
      svi_assigned_to_fei_at: prochainDetenteurType === EntityTypes.SVI ? dayjs().toDate() : null,
      svi_entity_id: prochainDetenteurType === EntityTypes.SVI ? prochainDetenteurEntityId : null,
    };
    updateCarcassesTransmission(carcasseIds, nextTransmission);
    if (feiAndIntermediaireIds && intermediaire) {
      let nextCarcasseIntermediaire: Partial<CarcasseIntermediaire> = {
        intermediaire_prochain_detenteur_id_cache: prochainDetenteurEntityId,
        intermediaire_prochain_detenteur_role_cache: entities[prochainDetenteurEntityId]
          ?.type as FeiOwnerRole,
        intermediaire_depot_type: null,
        intermediaire_depot_entity_id: null,
      };
      updateAllCarcasseIntermediaire(fei_numero, feiAndIntermediaireIds!, nextCarcasseIntermediaire);
    }
    addLog({
      user_id: user.id,
      user_role: transmission.current_owner_role!,
      action: 'current-owner-sous-traite-select-destinataire-sous-traite',
      fei_numero: fei_numero,
      history: createHistoryInput(transmission, nextTransmission),
      entity_id: transmission.current_owner_entity_id,
      zacharie_carcasse_id: null,
      carcasse_intermediaire_id: null,
      intermediaire_id: null,
    });
    syncData('current-owner-sous-traite-select-destinataire-sous-traite');
  };

  const jobIsMissing = useMemo(() => {
    if (!prochainDetenteurEntityId) {
      return 'Il manque le prochain détenteur des carcasses';
    }
    if (transmission.next_owner_wants_to_sous_traite) {
      if (prochainDetenteurType === EntityTypes.SVI) {
        if (intermediaire?.intermediaire_role !== FeiOwnerRole.ETG) {
          return 'Attention, cliquer sur "Prendre en charge cette fiche" avant de transmettre la fiche au Service Vétérinaire';
        }
      }
    }
    return null;
  }, [
    prochainDetenteurEntityId,
    transmission.next_owner_wants_to_sous_traite,
    prochainDetenteurType,
    intermediaire?.intermediaire_role,
  ]);

  return (
    <>
      <div
        className={[className, 'space-y-6'].join(' ')}
        key={prochainDetenteurEntityId}
      >
        <SelectCustom
          label="Prochain détenteur des carcasses *"
          hint={
            <>
              <span>
                Indiquez ici la personne ou la structure avec qui vous êtes en contact pour prendre en charge
                le gibier.
              </span>
              {!prochainDetenteurEntityId && (
                <div>
                  {canTransmitCarcassesToEntities.map((entity) => {
                    return (
                      <Tag
                        key={entity.id}
                        iconId="fr-icon-checkbox-circle-line"
                        className="mr-2"
                        nativeButtonProps={{
                          onClick: () => setProchainDetenteurEntityId(entity.id),
                        }}
                      >
                        {entity.nom_d_usage}
                      </Tag>
                    );
                  })}
                </div>
              )}
            </>
          }
          options={prochainsDetenteursOptions}
          placeholder="Sélectionnez le prochain détenteur des carcasses"
          value={
            prochainsDetenteursOptions.find((option) => option.value === prochainDetenteurEntityId) ?? null
          }
          getOptionLabel={(f) => f.label!}
          getOptionValue={(f) => f.value}
          onChange={(f) => (f ? setProchainDetenteurEntityId(f.value) : setProchainDetenteurEntityId(null))}
          isClearable={!!prochainDetenteurEntityId}
          inputId={Prisma.FeiScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}
          classNamePrefix={`select-prochain-detenteur`}
          required
          creatable
          // @ts-expect-error - onCreateOption is not typed
          onCreateOption={(newOption) => {
            setNewEntityNomDUsage(newOption);
            partenaireModal.open();
          }}
          isReadOnly={false}
          name={Prisma.FeiScalarFieldEnum.premier_detenteur_prochain_detenteur_id_cache}
        />
        {!!prochainDetenteur && !prochainDetenteur?.zacharie_compatible && (
          <Alert
            severity="warning"
            title="Attention"
            description={`${prochainDetenteur?.nom_d_usage} n'est pas prêt pour Zacharie. Vous pouvez contacter un représentant avant de leur envoyer leur première fiche.`}
          />
        )}
        <Button
          className="mt-4"
          type="submit"
          disabled={!needToSubmit}
          nativeButtonProps={{
            onClick: async (event) => {
              event.preventDefault();
              if (!tryToSubmitAtLeastOnce) {
                setTryTOSubmitAtLeastOnce(true);
              }
              if (jobIsMissing) {
                alert(jobIsMissing);
                return;
              }
              handleSubmit();
            },
          }}
        >
          Transmettre la fiche
        </Button>
        {!!jobIsMissing?.length && (
          <Alert
            title="Attention"
            className="mt-4"
            severity="error"
            description={jobIsMissing}
          />
        )}
        {!needToSubmit && transmission.next_owner_entity_id && (
          <>
            <Alert
              className="mt-6"
              severity="success"
              description={`${entities[transmission.next_owner_entity_id]?.nom_d_usage} ${transmission.is_synced ? 'a été notifié' : !isOnline ? 'sera notifié dès que vous aurez retrouvé du réseau' : 'va être notifié'}.`}
              title="Attribution effectuée"
            />
          </>
        )}
      </div>
      <partenaireModal.Component title="Ajouter un destinataire">
        {isPartenaireModalOpen && (
          <PartenaireNouveau
            key={newEntityNomDUsage ?? ''}
            newEntityNomDUsageProps={newEntityNomDUsage ?? undefined}
            onFinish={(newEntity) => {
              partenaireModal.close();
              if (newEntity) setProchainDetenteurEntityId(newEntity.id);
            }}
          />
        )}
      </partenaireModal.Component>
    </>
  );
}
