import { useFetcher, useLoaderData } from "@remix-run/react";
import { Prisma, UserRoles } from "@prisma/client";
import SelectNextOwner from "./select-next-owner";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { clientLoader } from "./route";
import SelectPremierDetenteur from "./select-next-premier-detenteur";

export default function FeiTransfer() {
  const { user, fei } = useLoaderData<typeof clientLoader>();
  const fetcher = useFetcher({ key: "cancle-transfer-current-owner" });

  if (!fei.fei_current_owner_wants_to_transfer) {
    return null;
  }
  if (fei.fei_current_owner_user_id !== user.id) {
    return null;
  }

  return (
    <div className="bg-alt-blue-france pb-4">
      <CallOut title="Vous souhaitez transférer cette FEI" className="bg-white">
        <div className="flex w-full flex-col bg-white md:items-start [&_ul]:md:min-w-96">
          {fei.fei_prev_owner_role === UserRoles.EXAMINATEUR_INITIAL ? <SelectPremierDetenteur /> : <SelectNextOwner />}
        </div>
        <span className="text-sm">Vous avez changé d'avis&nbsp;?</span>
        <Button
          priority="tertiary no outline"
          type="submit"
          className="text-sm"
          onClick={() => {
            const formData = new FormData();
            formData.append(Prisma.FeiScalarFieldEnum.fei_current_owner_wants_to_transfer, "false");
            formData.append("route", `/api/action/fei/${fei.numero}`);
            fetcher.submit(formData, {
              method: "POST",
              preventScrollReset: true, // Prevent scroll reset on submission
            });
          }}
        >
          Je prends en charge cette FEI
        </Button>
      </CallOut>
    </div>
  );
}
