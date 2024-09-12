import { useFetcher, useLoaderData } from "@remix-run/react";
import { loader } from "./route";
import UserNotEditable from "~/components/UserNotEditable";
import { useMemo, useState } from "react";
import { UserRoles, Prisma } from "@prisma/client";
import SelectNextOwner from "./select-next-owner";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Input } from "@codegouvfr/react-dsfr/Input";
import InputNotEditable from "~/components/InputNotEditable";
import dayjs from "dayjs";

export default function FEIDetenteurInitial() {
  const { fei, user } = useLoaderData<typeof loader>();
  const fetcher = useFetcher({ key: "confirm-detenteur-initial" });
  const depotFetcher = useFetcher({ key: "detenteur-initial-depot" });
  const [showDateDepotCentreCollecte, setShowDateDepotCentreCollecte] = useState(
    fei.detenteur_initial_date_depot_centre_collecte ? true : false
  );

  const detenteurInitial = useMemo(() => {
    if (fei.FeiDetenteurInitialUser) {
      return fei.FeiDetenteurInitialUser;
    }
    if (fei.fei_current_owner_role === UserRoles.DETENTEUR_INITIAL) {
      if (fei.fei_current_owner_user_id === user.id) {
        return user;
      }
    }
    return null;
  }, [fei, user]);

  const canEdit = useMemo(() => {
    if (fei.fei_current_owner_role !== UserRoles.DETENTEUR_INITIAL) {
      return false;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (fei.detenteur_initial_date_depot_centre_collecte) {
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
    if (fei.fei_current_owner_role !== UserRoles.DETENTEUR_INITIAL) {
      return false;
    }
    if (!fei.detenteur_initial_date_depot_centre_collecte) {
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
        <div className="w-full md:w-auto p-4 z-50 flex flex-col md:items-center [&_ul]:md:min-w-96 ">
          <div className="flex flex-col items-center">
            <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
            <Button
              type="submit"
              className="my-4"
              onClick={() => {
                const formData = new FormData();
                formData.append(Prisma.FeiScalarFieldEnum.numero, fei.numero);
                formData.append(Prisma.FeiScalarFieldEnum.detenteur_initial_user_id, user.id);
                fetcher.submit(formData, {
                  method: "POST",
                  action: `/action/fei/${fei.numero}`,
                  preventScrollReset: true, // Prevent scroll reset on submission
                });
              }}
            >
              Je suis bien le Détenteur Initial
            </Button>
            <p className="mb-0">Vous n'êtes pas le Détenteur Initial&nbsp;?</p>
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
          </div>
        </div>
      ) : (
        <>
          <hr />
          <div
            className={[
              "fr-fieldset__element",
              fei.detenteur_initial_date_depot_centre_collecte ? "pointer-events-none" : "",
            ].join(" ")}
          >
            <Checkbox
              options={[
                {
                  label: "J'ai déposé les carcasses dans le Centre de Collecte",
                  hintText: "Étape requise pour la suite du processus",
                  nativeInputProps: {
                    required: true,
                    onChange: (e) => {
                      setShowDateDepotCentreCollecte(e.target.checked);
                    },
                    readOnly: !canEdit,
                    defaultChecked: fei.detenteur_initial_date_depot_centre_collecte ? true : false,
                  },
                },
              ]}
            />
          </div>
          {showDateDepotCentreCollecte && (
            <depotFetcher.Form method="POST" action={`/action/fei/${fei.numero}`}>
              <div className="fr-fieldset__element">
                <Component
                  label="Date de dépôt au Centre de Collecte"
                  nativeInputProps={{
                    id: Prisma.FeiScalarFieldEnum.detenteur_initial_date_depot_centre_collecte,
                    name: Prisma.FeiScalarFieldEnum.detenteur_initial_date_depot_centre_collecte,
                    type: "datetime-local",
                    autoComplete: "off",
                    defaultValue: dayjs(fei?.detenteur_initial_date_depot_centre_collecte || undefined).format(
                      "YYYY-MM-DDTHH:mm"
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
          <hr className="mt-8 -mb-8" />
          <SelectNextOwner />
        </>
      )}
    </>
  );
}
