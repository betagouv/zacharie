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

  const needConfirmation = !fei.FeiDetenteurInitialUser && detenteurInitial?.id === user.id;

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
      <div className="fr-fieldset__element"></div>
      <UserNotEditable user={detenteurInitial} />
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
      )}
      {needSelecteNextUser && <SelectNextOwner />}
    </>
  );
}
