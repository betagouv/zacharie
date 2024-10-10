import { useEffect, useRef, useState } from "react";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { clientLoader } from "./route";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Prisma, type Fei } from "@prisma/client";
import { action as nouvelleCarcasseAction } from "~/routes/api.fei-carcasse.$fei_numero.$numero_bracelet";
import { useIsOnline } from "~/components/OfflineMode";
import dayjs from "dayjs";
import { SerializeFrom } from "@remix-run/node";

function getNewDefaultNumeroBracelet(fei: SerializeFrom<Fei>) {
  console.log({
    commune: fei.commune_mise_a_mort,
    'fei.commune_mise_a_mort?.split(" ")[0]': fei.commune_mise_a_mort?.split(" ")[0],
    'fei.commune_mise_a_mort?.split(" ")[0].slice(0, -3)': fei.commune_mise_a_mort?.split(" ")[0].slice(0, -3),
    'fei.commune_mise_a_mort?.split(" ")[0].slice(0, -3).padStart(2, "0")': fei.commune_mise_a_mort
      ?.split(" ")[0]
      .slice(0, -3)
      .padStart(2, "0"),
  });
  return `ZACH-${fei.commune_mise_a_mort?.split(" ")[0].slice(0, -3).padStart(2, "0")}-${fei.examinateur_initial_user_id}-${dayjs().format("DDMMYY-HHmm")}`;
}

export default function NouvelleCarcasse() {
  const { fei } = useLoaderData<typeof clientLoader>();
  const isOnline = useIsOnline();
  const navigate = useNavigate();
  const nouvelleCarcasseFetcher = useFetcher<typeof nouvelleCarcasseAction>({ key: "nouvelle-carcasse" });
  const [numeroBracelet, setNumeroBracelet] = useState<string>("");

  const error = nouvelleCarcasseFetcher.data?.error;

  const lastNavigation = useRef<string>(nouvelleCarcasseFetcher.data?.data?.carcasse?.numero_bracelet ?? "");
  useEffect(() => {
    const nextBracelet = nouvelleCarcasseFetcher.data?.data?.carcasse?.numero_bracelet;
    if (nextBracelet && lastNavigation.current !== nextBracelet) {
      lastNavigation.current === nextBracelet;
      defaultNumeroBracelet.current = getNewDefaultNumeroBracelet(fei);
      navigate(
        `/app/tableau-de-bord/carcasse/${fei.numero}/${nouvelleCarcasseFetcher.data?.data?.carcasse?.numero_bracelet}`,
      );
    }
  }, [nouvelleCarcasseFetcher.data?.data?.carcasse?.numero_bracelet, fei, navigate]);

  useEffect(() => {
    defaultNumeroBracelet.current = getNewDefaultNumeroBracelet(fei);
  }, [fei]);

  const defaultNumeroBracelet = useRef(getNewDefaultNumeroBracelet(fei));

  return (
    <>
      <nouvelleCarcasseFetcher.Form
        method="POST"
        className="fr-fieldset__element flex w-full flex-col items-stretch gap-4 md:flex-row md:items-end"
        key={nouvelleCarcasseFetcher.data?.data?.carcasse?.numero_bracelet}
      >
        <input type="hidden" name="route" value={`/api/fei-carcasse/${fei.numero}/${numeroBracelet}`} />
        <input type="hidden" required name={Prisma.CarcasseScalarFieldEnum.fei_numero} value={fei.numero} />
        <Input
          label="Numéro de marquage (bracelet, languette)"
          className="!mb-0 grow"
          state={error ? "error" : "default"}
          stateRelatedMessage={error ?? ""}
          hintText={
            <>
              {!numeroBracelet && (
                <>
                  Votre chasse n'a pas de dispositif de marquage ?{" "}
                  <button
                    type="button"
                    className="inline text-left underline"
                    onClick={() => setNumeroBracelet(defaultNumeroBracelet.current)}
                  >
                    Cliquez ici pour utiliser {defaultNumeroBracelet.current}
                  </button>
                  .
                </>
              )}
              {isOnline
                ? null
                : " ATTENTION: en mode hors-ligne vous ne pouvez pas encore modifier ce numéro une fois renseigné"}
            </>
          }
          nativeInputProps={{
            type: "text",
            required: true,
            name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
            value: numeroBracelet,
            // replce slash and space by underscore
            onChange: (e) => setNumeroBracelet(e.target.value.replace(/\/|\s/g, "_")),
          }}
        />
        <Button type="submit">Ajouter une carcasse / un lot de carcasse</Button>
      </nouvelleCarcasseFetcher.Form>
    </>
  );
}
