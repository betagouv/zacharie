import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { loader } from "./route";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useMemo } from "react";
import getUserRoleLabel from "~/utils/get-user-roles-label";

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

  if (!fei.fei_next_owner_role || !canConfirmCurrentOwner) {
    return null;
  }

  return (
    <fetcher.Form
      id="confirm-current-owner"
      preventScrollReset
      method="POST"
      action={`/action/fei/${fei.numero}`}
      onChange={(event) => {
        const formData = new FormData(event.currentTarget);
        console.log("formData", Object.fromEntries(formData));
        fetcher.submit(formData, {
          method: "POST",
          action: `/action/fei/${fei.numero}`,
          preventScrollReset: true, // Prevent scroll reset on submission
        });
      }}
    >
      <input type="hidden" name="fei_numero" value={fei.numero} />
      <input type="hidden" name="fei_current_owner_role" value={fei.fei_next_owner_role} />
      <input type="hidden" name="fei_current_owner_entity_id" value={fei.fei_next_owner_entity_id ?? ""} />
      <input type="hidden" name="fei_current_owner_user_id" value={fei.fei_next_owner_user_id ?? user.id} />
      <input type="hidden" name="fei_next_owner_role" value="" />
      <input type="hidden" name="fei_next_owner_user_id" value="" />
      <input type="hidden" name="fei_next_owner_entity_id" value="" />
      <input type="hidden" name="fei_prev_owner_role" value={fei.fei_current_owner_role ?? ""} />
      <input type="hidden" name="fei_prev_owner_user_id" value={fei.fei_current_owner_user_id ?? ""} />
      <input type="hidden" name="fei_prev_owner_entity_id" value={fei.fei_current_owner_entity_id ?? ""} />
      <CallOut title="🫵 Cette FEI vous a été attribuée" className="bg-white">
        En tant que <b>{getUserRoleLabel(fei.fei_next_owner_role)}</b>, vous pouvez prendre en charge cette FEI.
        <br />
        <Button type="submit" className="mt-4">
          Je prends en charge cette FEI
        </Button>
      </CallOut>
    </fetcher.Form>
  );
}
