import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { loader } from "./route";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useMemo } from "react";
import { getUserRoleLabel } from "~/utils/get-user-roles-label";
import { Prisma } from "@prisma/client";

export default function ConfirmCurrentOwner() {
  const { user, entitiesUserIsWorkingFor, fei } = useLoaderData<typeof loader>();

  const fetcher = useFetcher({ key: "confirm-current-owner" });
  const nextEntity = useMemo(
    () => entitiesUserIsWorkingFor.find((entity) => entity.id === fei.fei_next_owner_entity_id),
    [entitiesUserIsWorkingFor, fei]
  );

  const canConfirmCurrentOwner = useMemo(() => {
    if (fei.fei_next_owner_user_id === user.id) {
      return true;
    }
    if (nextEntity) {
      return true;
    }
    return false;
  }, [fei, user, nextEntity]);

  if (!fei.fei_next_owner_role) {
    return null;
  }
  if (!canConfirmCurrentOwner) {
    return null;
  }

  return (
    <div className="bg-alt-blue-france pb-8">
      <CallOut title="🫵 Cette FEI vous a été attribuée" className="bg-white m-0">
        En tant que <b>{getUserRoleLabel(fei.fei_next_owner_role)}</b>, vous pouvez prendre en charge cette FEI.
        <br />
        <Button
          type="submit"
          className="my-4 block"
          onClick={() => {
            const formData = new FormData();
            formData.append(Prisma.FeiScalarFieldEnum.numero, fei.numero);
            formData.append(Prisma.FeiScalarFieldEnum.fei_current_owner_role, fei.fei_next_owner_role as string);
            formData.append(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id, fei.fei_next_owner_entity_id ?? "");
            formData.append(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id, fei.fei_next_owner_user_id ?? user.id);
            formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_role, "");
            formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id, "");
            formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id, "");
            formData.append(Prisma.FeiScalarFieldEnum.fei_prev_owner_role, fei.fei_current_owner_role ?? "");
            formData.append(Prisma.FeiScalarFieldEnum.fei_prev_owner_user_id, fei.fei_current_owner_user_id ?? "");
            formData.append(Prisma.FeiScalarFieldEnum.fei_prev_owner_entity_id, fei.fei_current_owner_entity_id ?? "");
            fetcher.submit(formData, {
              method: "POST",
              action: `/action/fei/${fei.numero}`,
              preventScrollReset: true, // Prevent scroll reset on submission
            });
          }}
        >
          Je prends en charge cette FEI
        </Button>
        <span>
          Cette FEI ne devrait pas vous être attribuée&nbsp;? Où vous ne pouvez/souhaitez pas la prendre en
          charge&nbsp;?
        </span>
        <Button
          priority="tertiary"
          type="submit"
          className="!mt-2 block"
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
      </CallOut>
    </div>
  );
}
