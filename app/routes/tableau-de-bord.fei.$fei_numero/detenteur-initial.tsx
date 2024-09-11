import { useFetcher, useLoaderData } from "@remix-run/react";
import { loader } from "./route";
import UserNotEditable from "~/components/UserNotEditable";
import { useMemo } from "react";
import { UserRoles, Prisma } from "@prisma/client";
import SelectNextOwner from "./select-next-owner";
import { Button } from "@codegouvfr/react-dsfr/Button";

export default function FEIDetenteurInitial() {
  const { fei, user } = useLoaderData<typeof loader>();
  const fetcher = useFetcher({ key: "confirm-detenteur-initial" });

  const userNotEditable = useMemo(() => {
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

  const needConfirmation = !fei.FeiDetenteurInitialUser && userNotEditable?.id === user.id;

  const needSelecteNextUser = useMemo(() => {
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.DETENTEUR_INITIAL) {
      return false;
    }
    return needConfirmation ? false : true;
  }, [fei, user, needConfirmation]);

  return (
    <>
      <div className="fr-fieldset__element">
        {/* <Select
          label="Éxaminateur Initial"
          hint="Sélectionnez l'Examinateur Initial de pour cette FEI"
          key={`${feiInitRoles.includes(UserRoles.DETENTEUR_INITIAL)}`}
          className="!mb-0 grow"
          nativeSelectProps={{
            name: "entity_id",
            defaultValue:
              fei_owners?.detenteur_initial_id ?? feiInitRoles.includes(UserRoles.DETENTEUR_INITIAL) ? user.id : "",
          }}
        >
          <option value="">Sélectionnez l'Examinateur Initial de pour cette FEI</option>
          {examinateursInitiaux.map((examinateur) => {
            let label = `${examinateur.prenom} ${examinateur.nom_de_famille} - ${examinateur.code_postal} ${examinateur.ville}`;
            if (examinateur.id === user.id) {
              label = `Vous (${label})`;
            }
            return (
              <option key={examinateur.id} value={examinateur.id}>
                {label}
              </option>
            );
          })}
        </Select> */}
      </div>
      <UserNotEditable user={userNotEditable} />
      {needConfirmation && (
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
            <Button type="button" priority="tertiary no outline">
              Renvoyer la FEI
            </Button>
          </div>
        </div>
      )}
      {needSelecteNextUser && <SelectNextOwner />}
    </>
  );
}
