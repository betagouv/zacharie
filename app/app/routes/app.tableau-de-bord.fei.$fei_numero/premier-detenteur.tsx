import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { clientLoader } from "./route";
import UserNotEditable from "@app/components/UserNotEditable";
import { useMemo, useState } from "react";
import { UserRoles, Prisma } from "@prisma/client";
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
      return Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id;
    }
    if (fei.premier_detenteur_depot_sauvage) {
      return Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage;
    }
    return "";
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
          legend="Dépôt des carcasses"
          hintText={canEdit ? "Étape requise pour la suite du processus" : ""}
          options={[
            {
              label:
                "J'ai déposé mes carcasses dans un Centre de Collecte du Gibier sauvage ou chez un de mes partenaires",
              nativeInputProps: {
                checked: depotType === Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id,
                readOnly: !canEdit,
                onChange: () => setDepotType(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id),
              },
            },
            {
              label: "J'ai déposé mes carcasses ailleurs",
              nativeInputProps: {
                checked: depotType === Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage,
                readOnly: !canEdit,
                onChange: () => setDepotType(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage),
              },
            },
          ]}
        />
      </div>
      {depotType && (
        <depotFetcher.Form
          method="POST"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const nextFei = mergeFei(fei, formData);
            nextFei.append("route", `/api/fei/${fei.numero}`);
            fetcher.submit(nextFei, {
              method: "POST",
              preventScrollReset: true, // Prevent scroll reset on submission
            });
          }}
        >
          <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
          {depotType === Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id && (
            <div className="fr-fieldset__element">
              {canEdit ? (
                <Select
                  label="Sélectionnez un de vos partenaires"
                  hint={
                    <>
                      Vous n'avez pas encore renseigné votre CCG ? Vous pouvez le faire en{" "}
                      <Link
                        to={`/app/tableau-de-bord/mon-profil/mes-ccgs?redirect=/app/tableau-de-bord/fei/${fei.numero}`}
                      >
                        cliquant ici
                      </Link>
                    </>
                  }
                  className="!mb-0 grow"
                  nativeSelectProps={{
                    name: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id,
                    required: true,
                  }}
                >
                  <option value="">Sélectionnez un de vos partenaires</option>
                  <hr />
                  <optgroup label="Centres de Collecte du Gibier sauvage (CCG)">
                    {ccgs.map((entity) => {
                      return (
                        <option key={entity.id} value={entity.id}>
                          {entity.raison_sociale} - {entity.code_postal} {entity.ville} ({getUserRoleLabel(entity.type)}
                          )
                        </option>
                      );
                    })}
                  </optgroup>
                  <hr />
                  <optgroup label="Collecteurs professionnels">
                    {collecteursPro.map((entity) => {
                      return (
                        <option key={entity.id} value={entity.id}>
                          {entity.raison_sociale} - {entity.code_postal} {entity.ville} ({getUserRoleLabel(entity.type)}
                          )
                        </option>
                      );
                    })}
                  </optgroup>
                  <optgroup label="Établissements de Transformation du Gibier sauvage (ETG)">
                    <hr />
                    {etgs.map((entity) => {
                      return (
                        <option key={entity.id} value={entity.id}>
                          {entity.raison_sociale} - {entity.code_postal} {entity.ville} ({getUserRoleLabel(entity.type)}
                          )
                        </option>
                      );
                    })}
                  </optgroup>
                </Select>
              ) : (
                <InputNotEditable
                  label="Emplacement du dépôt"
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
          )}
          {depotType === Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage && (
            <>
              <div className="fr-fieldset__element">
                <Component
                  label="Emplacement du dépôt"
                  nativeInputProps={{
                    id: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage,
                    name: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage,
                    type: "text",
                    autoComplete: "off",
                    defaultValue: fei?.premier_detenteur_depot_sauvage || "",
                  }}
                />
              </div>
            </>
          )}
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
          {canEdit && <Button type="submit">Enregistrer</Button>}
        </depotFetcher.Form>
      )}
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
