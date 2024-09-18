import { useFetcher, useLoaderData } from "@remix-run/react";
import { loader } from "./route";
import UserNotEditable from "~/components/UserNotEditable";
import { useMemo, useState } from "react";
import { UserRoles, Prisma } from "@prisma/client";
import SelectNextOwner from "./select-next-owner";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import { Select } from "@codegouvfr/react-dsfr/Select";
import InputNotEditable from "~/components/InputNotEditable";
import dayjs from "dayjs";
import { getUserRoleLabel } from "~/utils/get-user-roles-label";

export default function FEIDetenteurInitial() {
  const { fei, user, ccgs, etgs, collecteursPro } = useLoaderData<typeof loader>();
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

  const detenteurInitial = useMemo(() => {
    if (fei.FeiDetenteurInitialUser) {
      return fei.FeiDetenteurInitialUser;
    }
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
      if (fei.fei_current_owner_user_id === user.id) {
        return user;
      }
    }
    return null;
  }, [fei, user]);

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
  const needConfirmation = !fei.FeiDetenteurInitialUser && detenteurInitial?.id === user.id;

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
    if (needConfirmation) {
      return false;
    }
    return true;
  }, [fei, user, needConfirmation]);

  return (
    <>
      <UserNotEditable user={detenteurInitial} />

      {needConfirmation ? (
        <div className="z-50 flex w-full flex-col p-4 md:w-auto md:items-center [&_ul]:md:min-w-96">
          <div className="flex flex-col items-center">
            <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
            <Button
              type="submit"
              className="my-4"
              onClick={() => {
                const formData = new FormData();
                formData.append(Prisma.FeiScalarFieldEnum.numero, fei.numero);
                formData.append(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id, user.id);
                fetcher.submit(formData, {
                  method: "POST",
                  action: `/action/fei/${fei.numero}`,
                  preventScrollReset: true, // Prevent scroll reset on submission
                });
              }}
            >
              Je suis bien le Premier Détenteur
            </Button>
            <p className="mb-0">Vous n'êtes pas le Premier Détenteur&nbsp;?</p>
            <Button
              priority="tertiary no outline"
              type="submit"
              className="my-4"
              onClick={() => {
                const formData = new FormData();
                formData.append(Prisma.FeiScalarFieldEnum.numero, fei.numero);
                formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id, "");
                formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id, "");
                fetcher.submit(formData, {
                  method: "POST",
                  action: `/action/fei/${fei.numero}`,
                  preventScrollReset: true, // Prevent scroll reset on submission
                });
              }}
            >
              Renvoyer la FEI
            </Button>
            <Button
              priority="tertiary no outline"
              type="submit"
              className="my-4"
              onClick={() => {
                const formData = new FormData();
                formData.append(Prisma.FeiScalarFieldEnum.numero, fei.numero);
                formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id, "");
                formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id, "");
                fetcher.submit(formData, {
                  method: "POST",
                  action: `/action/fei/${fei.numero}`,
                  preventScrollReset: true, // Prevent scroll reset on submission
                });
              }}
            >
              Transférer la FEI
            </Button>
          </div>
        </div>
      ) : (
        <>
          <hr />
          <div className={["fr-fieldset__element", canEdit ? "" : "pointer-events-none"].join(" ")}>
            <RadioButtons
              legend="Dépôt des carcasses"
              hintText={canEdit ? "Étape requise pour la suite du processus" : ""}
              options={[
                {
                  label: "J'ai déposé mes carcasses chez un de mes partenaires",
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
            <depotFetcher.Form method="POST" action={`/action/fei/${fei.numero}`}>
              {depotType === Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id && (
                <div className="fr-fieldset__element">
                  {canEdit ? (
                    <Select
                      label="Sélectionnez un de vos partenaire"
                      className="!mb-0 grow"
                      nativeSelectProps={{
                        name: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id,
                        required: true,
                      }}
                    >
                      <option value="">Sélectionnez un de vos partenaires</option>
                      {[...ccgs, ...collecteursPro, ...etgs].map((entity) => {
                        return (
                          <option key={entity.id} value={entity.id}>
                            {entity.raison_sociale} - {entity.code_postal} {entity.ville} (
                            {getUserRoleLabel(entity.type)})
                          </option>
                        );
                      })}
                    </Select>
                  ) : (
                    <InputNotEditable
                      label="Emplacement du dépôt"
                      nativeInputProps={{
                        id: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage,
                        name: Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage,
                        type: "text",
                        autoComplete: "off",
                        defaultValue: `${fei.FeiDepotEntity?.raison_sociale} - ${fei.FeiDepotEntity?.code_postal} ${fei.FeiDepotEntity?.ville}`,
                      }}
                    />
                  )}
                </div>
              )}
              {depotType === Prisma.FeiScalarFieldEnum.premier_detenteur_depot_sauvage && (
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
              )}
              <div className="fr-fieldset__element">
                <Component
                  label="Date de dépôt"
                  nativeInputProps={{
                    id: Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part,
                    name: Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part,
                    type: "datetime-local",
                    autoComplete: "off",
                    defaultValue: dayjs(fei?.premier_detenteur_date_depot_quelque_part || undefined).format(
                      "YYYY-MM-DDTHH:mm",
                    ),
                  }}
                />
              </div>
              {canEdit && <Button type="submit">Enregistrer</Button>}
            </depotFetcher.Form>
          )}
        </>
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
