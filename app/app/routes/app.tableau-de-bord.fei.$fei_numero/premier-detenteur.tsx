import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { clientLoader } from "./route";
import UserNotEditable from "@app/components/UserNotEditable";
import { useMemo, useState } from "react";
import { UserRoles, Prisma, EntityTypes } from "@prisma/client";
import SelectNextOwner from "./select-next-owner";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import { Select } from "@codegouvfr/react-dsfr/Select";
import InputNotEditable from "@app/components/InputNotEditable";
import dayjs from "dayjs";
import { getUserRoleLabel } from "@app/utils/get-user-roles-label";
import { mergeFei } from "@app/db/fei.client";
import EntityNotEditable from "@app/components/EntityNotEditable";

export default function FeiPremierDetenteur({ showIdentity }: { showIdentity: boolean }) {
  const {
    fei,
    user,
    premierDetenteurUser,
    premierDetenteurEntity,
    premierDetenteurDepotEntity,
    relationsCatalog: { ccgs, etgs, collecteursPro },
  } = useLoaderData<typeof clientLoader>();
  const fetcher = useFetcher({ key: "confirm-detenteur-initial" });
  const depotFetcher = useFetcher({ key: "detenteur-initial-depot" });
  const [depotType, setDepotType] = useState(() => {
    if (fei.premier_detenteur_depot_entity_id) {
      return [...ccgs, ...etgs].find((entity) => entity.id === fei.premier_detenteur_depot_entity_id)?.type;
    }
    return EntityTypes.ETG;
  });

  const canEdit = useMemo(() => {
    if (fei.fei_current_owner_role !== UserRoles.PREMIER_DETENTEUR) {
      return false;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (fei.premier_detenteur_date_depot_quelque_part) {
      return false;
    }
    return true;
  }, [fei, user]);

  const Component = canEdit ? Input : InputNotEditable;

  const needSelectNextUser = useMemo(() => {
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.PREMIER_DETENTEUR) {
      return false;
    }
    if (!fei.premier_detenteur_date_depot_quelque_part) {
      return false;
    }
    return true;
  }, [fei, user]);

  return (
    <>
      {showIdentity && (
        <>
          {premierDetenteurEntity ? (
            <EntityNotEditable hideType entity={premierDetenteurEntity} user={premierDetenteurUser!} />
          ) : (
            <UserNotEditable user={premierDetenteurUser!} />
          )}
          <hr />
        </>
      )}

      <div className={["fr-fieldset__element", canEdit ? "" : "pointer-events-none"].join(" ")}>
        <RadioButtons
          legend="Qui prend en charge mes carcasses ?"
          hintText={canEdit ? "Étape requise pour la suite du processus" : ""}
          options={[
            {
              label: (
                <span className="inline-block">
                  Je transporte <b>le jour-même</b> mes carcasses à un Établissement de Traitement du Gibier sauvage
                </span>
              ),
              nativeInputProps: {
                checked: depotType === EntityTypes.ETG,
                readOnly: !canEdit,
                onChange: () => setDepotType(EntityTypes.ETG),
              },
            },
            {
              label: "J’ai déposé mes carcasses dans un centre de collecte du gibier sauvage (chambre froide)",
              nativeInputProps: {
                checked: depotType === EntityTypes.CCG,
                readOnly: !canEdit,
                onChange: () => setDepotType(EntityTypes.CCG),
              },
            },
          ]}
        />
      </div>
      <depotFetcher.Form
        method="POST"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          if (depotType === EntityTypes.ETG) {
            formData.set(
              Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id,
              formData.get(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id) as string,
            );
            formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_role, EntityTypes.ETG);
          }
          const nextFei = mergeFei(fei, formData);
          nextFei.append("route", `/api/fei/${fei.numero}`);
          fetcher.submit(nextFei, {
            method: "POST",
            preventScrollReset: true, // Prevent scroll reset on submission
          });
        }}
      >
        <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
        <div className="fr-fieldset__element">
          {canEdit && depotType === EntityTypes.ETG && (
            <>
              <Select
                label="Sélectionnez un Établissements de Transformation du Gibier sauvage"
                hint="La fiche lui sera transmise"
                className="!mb-0 grow"
                nativeSelectProps={{
                  name: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id,
                  required: true,
                  defaultValue: etgs.length === 1 ? etgs[0].id : (fei.premier_detenteur_depot_entity_id ?? ""),
                }}
              >
                <option value="">Sélectionnez un Établissements de Transformation du Gibier sauvage</option>
                <hr />
                {etgs.map((entity) => {
                  return (
                    <option key={entity.id} value={entity.id}>
                      {entity.raison_sociale} - {entity.code_postal} {entity.ville} ({getUserRoleLabel(entity.type)})
                    </option>
                  );
                })}
              </Select>
            </>
          )}
          {canEdit && depotType === EntityTypes.CCG && (
            <Select
              label="Centre de collecte"
              hint={
                <>
                  Vous n'avez pas encore renseigné votre centre de collecte ? Vous pouvez le faire en{" "}
                  <Link to={`/app/tableau-de-bord/mon-profil/mes-ccgs?redirect=/app/tableau-de-bord/fei/${fei.numero}`}>
                    cliquant ici
                  </Link>
                </>
              }
              className="!mb-0 grow"
              nativeSelectProps={{
                name: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id,
                required: true,
                defaultValue: ccgs.length === 1 ? ccgs[0].id : (fei.premier_detenteur_depot_entity_id ?? ""),
              }}
            >
              <option value="">Sélectionnez un centre de collecte</option>
              <hr />
              {ccgs.map((entity) => {
                return (
                  <option key={entity.id} value={entity.id}>
                    {entity.raison_sociale} - {entity.code_postal} {entity.ville} ({getUserRoleLabel(entity.type)})
                  </option>
                );
              })}
            </Select>
          )}
          {!canEdit && (
            <InputNotEditable
              label="Centre de collecte"
              nativeInputProps={{
                id: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage,
                name: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage,
                type: "text",
                autoComplete: "off",
                defaultValue: `${premierDetenteurDepotEntity?.raison_sociale} - ${premierDetenteurDepotEntity?.code_postal} ${premierDetenteurDepotEntity?.ville}`,
              }}
            />
          )}
        </div>
        <div className="fr-fieldset__element">
          <Component
            label="Date de dépôt"
            nativeInputProps={{
              id: Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part,
              name: Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part,
              type: "datetime-local",
              autoComplete: "off",
              suppressHydrationWarning: true,
              defaultValue: dayjs(fei?.premier_detenteur_date_depot_quelque_part || undefined).format(
                "YYYY-MM-DDTHH:mm",
              ),
            }}
          />
        </div>
        {canEdit && (
          <Button type="submit">
            {depotType === EntityTypes.CCG ? "Enregistrer" : "Enregistrer et envoyer la fiche"}
          </Button>
        )}
      </depotFetcher.Form>
      {needSelectNextUser && (
        <>
          <hr className="mt-8" />
          <div className="z-50 flex flex-col bg-white pt-4 md:w-auto md:items-start [&_ul]:md:min-w-96">
            <SelectNextOwner />
          </div>
        </>
      )}
    </>
  );
}
