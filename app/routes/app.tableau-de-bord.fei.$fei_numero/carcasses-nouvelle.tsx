import { useEffect, useRef, useState } from "react";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { clientLoader } from "./route";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Prisma } from "@prisma/client";
import { action as nouvelleCarcasseAction } from "~/routes/api.action.carcasse.$numero_bracelet";
import { useIsOnline } from "~/components/OfflineMode";

export default function NouvelleCarcasse() {
  const { fei } = useLoaderData<typeof clientLoader>();
  const isOnline = useIsOnline();
  const navigate = useNavigate();
  const nouvelleCarcasseFetcher = useFetcher<typeof nouvelleCarcasseAction>({ key: "nouvelle-carcasse" });
  const [numeroBracelet, setNumeroBracelet] = useState<string>("");

  const error = nouvelleCarcasseFetcher.data?.error;

  const lastNavigation = useRef<string>(nouvelleCarcasseFetcher.data?.data?.numero_bracelet ?? "");
  useEffect(() => {
    const nextBracelet = nouvelleCarcasseFetcher.data?.data?.numero_bracelet;
    if (nextBracelet && lastNavigation.current !== nextBracelet) {
      lastNavigation.current === nextBracelet;
      navigate(`/app/tableau-de-bord/carcasse/${fei.numero}/${nouvelleCarcasseFetcher.data?.data?.numero_bracelet}`);
    }
  }, [nouvelleCarcasseFetcher.data?.data?.numero_bracelet, fei.numero, navigate]);

  return (
    <>
      <nouvelleCarcasseFetcher.Form
        method="POST"
        className="fr-fieldset__element flex w-full flex-col items-stretch gap-4 md:flex-row md:items-end"
        key={nouvelleCarcasseFetcher.data?.data?.numero_bracelet}
      >
        <input type="hidden" name="route" value={`/api/action/carcasse/${numeroBracelet}`} />
        <input type="hidden" required name={Prisma.CarcasseScalarFieldEnum.fei_numero} value={fei.numero} />
        <Input
          label="Numéro de bracelet"
          className="!mb-0 grow"
          state={error ? "error" : "default"}
          stateRelatedMessage={error ?? ""}
          hintText={
            isOnline
              ? null
              : "ATTENTION: en mode hors-ligne vous ne pouvez pas encore modifier ce numéro une fois renseigné"
          }
          nativeInputProps={{
            type: "text",
            required: true,
            name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
            value: numeroBracelet,
            onChange: (e) => setNumeroBracelet(e.target.value),
          }}
        />
        <Button type="submit">Ajouter une carcasse</Button>
      </nouvelleCarcasseFetcher.Form>
    </>
  );
}
