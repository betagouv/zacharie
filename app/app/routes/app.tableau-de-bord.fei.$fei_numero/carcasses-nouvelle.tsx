import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { clientLoader } from "./route";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { CarcasseType, Prisma, type Fei } from "@prisma/client";
import { action as nouvelleCarcasseAction } from "@api/routes/api.fei-carcasse.$fei_numero.$numero_bracelet";
import { useIsOnline } from "@app/components/OfflineMode";
import dayjs from "dayjs";
import { SerializeFrom } from "@remix-run/node";
import { Select } from "@codegouvfr/react-dsfr/Select";
import grandGibier from "@app/data/grand-gibier.json";
import petitGibier from "@app/data/petit-gibier.json";
const gibierSelect = {
  grand: grandGibier.especes,
  petit: petitGibier.especes,
};

function getNewDefaultNumeroBracelet(fei: SerializeFrom<Fei>) {
  if (!fei.commune_mise_a_mort) {
    return "";
  }
  return `ZACH-${fei.commune_mise_a_mort?.split(" ")[0].slice(0, -3).padStart(2, "0")}-${fei.examinateur_initial_user_id}-${dayjs().format("DDMMYY-HHmmss")}`;
}

export default function NouvelleCarcasse() {
  const { fei } = useLoaderData<typeof clientLoader>();
  const isOnline = useIsOnline();
  const nouvelleCarcasseFetcher = useFetcher<typeof nouvelleCarcasseAction>({ key: "nouvelle-carcasse" });
  const [defaultNumeroBracelet, setDefaultNumeroBracelet] = useState<string>(getNewDefaultNumeroBracelet(fei));
  const [numeroBracelet, setNumeroBracelet] = useState<string>("");
  const [nombreDAnimaux, setNombreDAnimaux] = useState<string>("1");
  const [espece, setEspece] = useState<string>("");
  const error = nouvelleCarcasseFetcher.data?.error;

  useEffect(() => {
    const nextBracelet = nouvelleCarcasseFetcher.data?.data?.carcasse?.numero_bracelet;
    if (nextBracelet) {
      setDefaultNumeroBracelet(getNewDefaultNumeroBracelet(fei));
      setNumeroBracelet("");
    }
  }, [nouvelleCarcasseFetcher.data?.data?.carcasse?.numero_bracelet, fei]);

  const isPetitGibier = useMemo(() => {
    return petitGibier.especes.includes(espece);
  }, [espece]);

  return (
    <>
      <nouvelleCarcasseFetcher.Form
        method="POST"
        className="flex w-full flex-col items-stretch"
        key={nouvelleCarcasseFetcher.data?.data?.carcasse?.numero_bracelet}
      >
        <input type="hidden" name="route" value={`/api/fei-carcasse/${fei.numero}/${numeroBracelet}`} />
        <input type="hidden" required name={Prisma.CarcasseScalarFieldEnum.fei_numero} value={fei.numero} />
        <input
          type="hidden"
          required
          name={Prisma.CarcasseScalarFieldEnum.examinateur_signed_at}
          value={dayjs().toISOString()}
        />
        <input
          type="hidden"
          required
          name={Prisma.CarcasseScalarFieldEnum.type}
          value={isPetitGibier ? CarcasseType.PETIT_GIBIER : CarcasseType.GROS_GIBIER}
        />
        <div className="fr-fieldset__element">
          <Select
            label="Sélectionnez l'espèce du gibier"
            className="group !mb-0 grow"
            nativeSelectProps={{
              name: Prisma.CarcasseScalarFieldEnum.espece,
              value: espece,
              onChange: (e) => {
                const newEspece = e.currentTarget.value;
                setEspece(newEspece);
              },
            }}
          >
            <option value="">Sélectionnez l'espèce du gibier</option>
            <hr />
            {Object.entries(gibierSelect).map(([typeGibier, _especes]) => {
              return (
                <optgroup label={typeGibier} key={typeGibier}>
                  {_especes.map((_espece: string) => {
                    return (
                      <option value={_espece} key={_espece}>
                        {_espece}
                      </option>
                    );
                  })}
                </optgroup>
              );
            })}
          </Select>
        </div>
        {espece && isPetitGibier && (
          <div className="fr-fieldset__element">
            <Input
              label="Nombre de carcasses dans le lot"
              className="!mb-0 grow"
              hintText="Optionel, seulement pour le petit gibier"
              nativeInputProps={{
                type: "number",
                name: Prisma.CarcasseScalarFieldEnum.nombre_d_animaux,
                value: nombreDAnimaux,
                onChange: (e) => setNombreDAnimaux(e.target.value),
              }}
            />
          </div>
        )}
        {espece && (
          <div className="fr-fieldset__element">
            <Input
              label="Numéro de marquage (bracelet, languette)"
              className="!mb-0 grow"
              state={error ? "error" : "default"}
              stateRelatedMessage={error ?? ""}
              hintText={
                <>
                  {defaultNumeroBracelet ? (
                    <button
                      type="button"
                      className={["inline text-left", numeroBracelet ? "pointer-events-none opacity-20" : ""].join(" ")}
                      onClick={() => setNumeroBracelet(defaultNumeroBracelet)}
                    >
                      Votre chasse n'a pas de dispositif de marquage ?{" "}
                      <u className="inline">Cliquez ici pour utiliser {defaultNumeroBracelet}</u>.
                    </button>
                  ) : (
                    <>Veuillez renseigner la commune de mise à mort avant de rajouter une carcasse</>
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
          </div>
        )}
        {espece && (
          <div className="fr-fieldset__element">
            <Button type="submit" disabled={!fei.commune_mise_a_mort || !numeroBracelet}>
              {isPetitGibier ? "Enregistrer un lot de carcasses" : "Enregistrer une carcasse"}
            </Button>
          </div>
        )}
      </nouvelleCarcasseFetcher.Form>
    </>
  );
}
