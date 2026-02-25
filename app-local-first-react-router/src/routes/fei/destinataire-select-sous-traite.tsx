import { useParams } from 'react-router';
import { useMemo, useState } from 'react';
import {
  UserRoles,
  Prisma,
  EntityTypes,
  EntityRelationType,
  FeiOwnerRole,
} from '@prisma/client';
import dayjs from 'dayjs';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore, { syncData } from '@app/zustand/store';
import { updateFei } from '@app/zustand/actions/update-fei';
import { updateCarcassesTransmission } from '@app/zustand/actions/update-carcasses-transmission';
import { updateAllCarcasseIntermediaire } from '@app/zustand/actions/update-all-carcasse-intermediaire';
import { addLog } from '@app/zustand/actions/add-log';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import { useEtgIds, useSviIds, useCollecteursProIds, useCircuitCourtIds } from '@app/utils/get-entity-relations';
import SelectCustom from '@app/components/SelectCustom';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import { getEntityDisplay } from '@app/utils/get-entity-display';
import Button from '@codegouvfr/react-dsfr/Button';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { useIsOnline } from '@app/utils-offline/use-is-offline';
import type { FeiIntermediaire, FeiAndIntermediaireIds } from '@app/types/fei-intermediaire';
import { CarcasseIntermediaire } from '@prisma/client';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import PartenaireNouveau from '@app/components/PartenaireNouveau';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';

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
  intermediaire?: FeiIntermediaire;
}) {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const isOnline = useIsOnline();
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const etgsIds = useEtgIds();
  const svisIds = useSviIds();
  const collecteursProIds = useCollecteursProIds();
  const circuitCourtIds = useCircuitCourtIds();

  const isPartenaireModalOpen = useIsModalOpen(partenaireModal);

  const fei = feis[params.fei_numero!];

  const carcasses = useCarcassesForFei(params.fei_numero);
  const carcasseIds = carcasses.map((c) => c.zacharie_carcasse_id);

  const etgs = etgsIds.map((id) => entities[id]);
  const collecteursPros = collecteursProIds.map((id) => entities[id]);
  const circuitCourt = circuitCourtIds.map((id) => entities[id]);
  const svis = svisIds.map((id) => entities[id]);

  const prochainsDetenteurs = useMemo(() => {
    if (fei.fei_current_owner_role === FeiOwnerRole.ETG) {
      return [
        ...svis.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
        ...etgs.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
        ...collecteursPros.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
        ...circuitCourt.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
      ];
    }
    return [
      ...circuitCourt.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
      ...etgs.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
      ...collecteursPros.sort((a, b) => a.nom_d_usage!.localeCompare(b.nom_d_usage!)),
    ];
  }, [etgs, collecteursPros, svis, fei.fei_current_owner_role, circuitCourt]);

  const canTransmitCarcassesToEntities = useMemo(() => {
    return prochainsDetenteurs.filter(
      (entity) =>
        entity.relation === EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY
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
    if (prochainDetenteurEntityId !== fei.fei_next_owner_entity_id) {
      return true;
    }
    if (prochainDetenteurType === EntityTypes.SVI) {
      return false;
    }
    return false;
  }, [
    prochainDetenteurEntityId,
    prochainDetenteurType,
    fei.fei_next_owner_entity_id,
  ]);

  const [tryToSubmitAtLeastOnce, setTryTOSubmitAtLeastOnce] = useState(false);

  const handleSubmit = () => {
    if (!prochainDetenteurEntityId) return;
    updateCarcassesTransmission(carcasseIds, {
      next_owner_entity_id: prochainDetenteurEntityId,
      next_owner_role: prochainDetenteurType as FeiOwnerRole,
      next_owner_wants_to_sous_traite: false,
      next_owner_sous_traite_at: dayjs().toDate(),
      next_owner_sous_traite_by_user_id: user.id,
      next_owner_sous_traite_by_entity_id: fei.fei_next_owner_entity_id ?? null,
      current_owner_entity_id: fei.fei_prev_owner_entity_id ?? null,
      current_owner_role: fei.fei_prev_owner_role ?? null,
      current_owner_user_id: fei.fei_prev_owner_user_id ?? null,
    });
    let nextFei: Partial<typeof fei> = {
      fei_next_owner_entity_id: prochainDetenteurEntityId,
      fei_next_owner_role: prochainDetenteurType as FeiOwnerRole,
      fei_next_owner_wants_to_sous_traite: false,
      fei_next_owner_sous_traite_at: dayjs().toDate(),
      fei_next_owner_sous_traite_by_user_id: user.id,
      fei_next_owner_sous_traite_by_entity_id: fei.fei_next_owner_entity_id,
      fei_current_owner_entity_id: fei.fei_prev_owner_entity_id,
      fei_current_owner_role: fei.fei_prev_owner_role,
      fei_current_owner_user_id: fei.fei_prev_owner_user_id,
      svi_assigned_at: prochainDetenteurType === EntityTypes.SVI ? dayjs().toDate() : null,
      svi_entity_id: prochainDetenteurType === EntityTypes.SVI ? prochainDetenteurEntityId : null,
    };
    if (feiAndIntermediaireIds && intermediaire) {
      let nextCarcasseIntermediaire: Partial<CarcasseIntermediaire> = {
        intermediaire_prochain_detenteur_id_cache: prochainDetenteurEntityId,
        intermediaire_prochain_detenteur_role_cache: entities[prochainDetenteurEntityId]
          ?.type as FeiOwnerRole,
        intermediaire_depot_type: null,
        intermediaire_depot_entity_id: null,
      };
      updateAllCarcasseIntermediaire(fei.numero, feiAndIntermediaireIds!, nextCarcasseIntermediaire);
    }
    updateFei(fei.numero, nextFei);
    addLog({
      user_id: user.id,
      user_role:
        fei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR ||
        fei.fei_current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL
          ? UserRoles.CHASSEUR
          : fei.fei_current_owner_role!,
      action: 'current-owner-sous-traite-select-destinataire-sous-traite',
      fei_numero: fei.numero,
      history: createHistoryInput(fei, nextFei),
      entity_id: fei.premier_detenteur_entity_id,
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
    if (fei.fei_next_owner_wants_to_sous_traite) {
      if (prochainDetenteurType === EntityTypes.SVI) {
        if (intermediaire?.intermediaire_role !== FeiOwnerRole.ETG) {
          return 'Attention, devez cliquer sur "Je prends en charge cette fiche" avant de transmettre la fiche au Service Vétérinaire';
        }
      }
    }
    return null;
  }, [
    prochainDetenteurEntityId,
    fei.fei_next_owner_wants_to_sous_traite,
    prochainDetenteurType,
    intermediaire?.intermediaire_role,
  ]);

  if (!fei.premier_detenteur_user_id) {
    return "Il n'y a pas encore de premier détenteur pour cette fiche";
  }

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
          <Alert title="Attention" className="mt-4" severity="error" description={jobIsMissing} />
        )}
        {!needToSubmit && fei.fei_next_owner_entity_id && (
          <>
            <Alert
              className="mt-6"
              severity="success"
              description={`${entities[fei.fei_next_owner_entity_id]?.nom_d_usage} ${fei.is_synced ? 'a été notifié' : !isOnline ? 'sera notifié dès que vous aurez retrouvé du réseau' : 'va être notifié'}.`}
              title="Attribution effectuée"
            />
          </>
        )}
      </div>
      <partenaireModal.Component title="Ajouter un partenaire">
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
