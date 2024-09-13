import { useFetcher, useLoaderData } from "@remix-run/react";
import { Prisma } from "@prisma/client";
import SelectNextOwner from "./select-next-owner";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { loader } from "./route";

export default function FeiTransfer() {
  const { user, fei } = useLoaderData<typeof loader>();
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
        <div className="w-full flex flex-col md:items-start [&_ul]:md:min-w-96 bg-white">
          <SelectNextOwner />
        </div>
        <span className="text-sm">Vous avez changé d'avis&nbsp;?</span>
        <Button
          priority="tertiary no outline"
          type="submit"
          className="text-sm"
          onClick={() => {
            const formData = new FormData();
            formData.append(Prisma.FeiScalarFieldEnum.fei_current_owner_wants_to_transfer, "false");
            fetcher.submit(formData, {
              method: "POST",
              action: `/action/fei/${fei.numero}`,
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
