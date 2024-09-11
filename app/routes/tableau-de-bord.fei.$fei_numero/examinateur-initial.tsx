import { useMemo } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { loader } from "./route";
import UserNotEditable from "~/components/UserNotEditable";
import { Prisma } from "@prisma/client";
import InputNotEditable from "~/components/InputNotEditable";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Button } from "@codegouvfr/react-dsfr/Button";
import dayjs from "dayjs";

export default function FEIExaminateurInitial() {
  const { fei, user } = useLoaderData<typeof loader>();

  const approbationFetcher = useFetcher({ key: "approbation-mise-sur-le-marche" });
  const canEdit = useMemo(() => {
    if (fei.examinateur_initial_user_id !== user.id) {
      return false;
    }
    if (fei.examinateur_initial_approbation_mise_sur_le_marche) {
      return false;
    }
    return true;
  }, [fei, user]);

  const Component = canEdit ? Input : InputNotEditable;

  return (
    <>
      <Accordion titleAs="h3" label="Données de chasse" defaultExpanded>
        <div className="fr-fieldset__element">
          <Component
            label="Date de mise à mort et d'éviscération"
            nativeInputProps={{
              id: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
              name: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
              type: "date",
              autoComplete: "off",
              defaultValue: new Date(fei?.date_mise_a_mort ?? "").toISOString().split("T")[0],
            }}
          />
        </div>
        <div className="fr-fieldset__element">
          <Component
            label="Commune de mise à mort"
            nativeInputProps={{
              id: Prisma.FeiScalarFieldEnum.commune_mise_a_mort,
              name: Prisma.FeiScalarFieldEnum.commune_mise_a_mort,
              type: "text",
              autoComplete: "off",
              defaultValue: fei?.commune_mise_a_mort ?? "",
            }}
          />
        </div>
      </Accordion>
      <Accordion titleAs="h3" label="Identité de l'Examinateur">
        <UserNotEditable user={fei.FeiExaminateurInitialUser} withCfei />
      </Accordion>
      <Accordion titleAs="h3" label="Approbation de mise sur le marché" defaultExpanded>
        <approbationFetcher.Form method="POST" action={`/action/fei/${fei.numero}`}>
          <div
            className={[
              "fr-fieldset__element",
              fei.examinateur_initial_approbation_mise_sur_le_marche ? "pointer-events-none" : "",
            ].join(" ")}
          >
            <Checkbox
              options={[
                {
                  label: `${
                    fei.examinateur_initial_approbation_mise_sur_le_marche ? "J'ai certifié" : "Je certifie"
                  } que les carcasses en peau examinées ce jour peuvent être mises sur le marché`,
                  nativeInputProps: {
                    required: true,
                    name: Prisma.FeiScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche,
                    value: "true",
                    readOnly: !!fei.examinateur_initial_approbation_mise_sur_le_marche,
                    defaultChecked: fei.examinateur_initial_approbation_mise_sur_le_marche ? true : false,
                  },
                },
              ]}
            />
            {!fei.examinateur_initial_approbation_mise_sur_le_marche && <Button type="submit">Enregistrer</Button>}
          </div>
          {fei.examinateur_initial_date_approbation_mise_sur_le_marche && (
            <div className="fr-fieldset__element">
              <InputNotEditable
                label="Date d'approbation de mise sur le marché"
                nativeInputProps={{
                  id: Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche,
                  name: Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche,
                  type: "datetime-local",
                  autoComplete: "off",
                  defaultValue: dayjs(fei?.examinateur_initial_date_approbation_mise_sur_le_marche).format(
                    "YYYY-MM-DDTHH:mm"
                  ),
                }}
              />
            </div>
          )}
        </approbationFetcher.Form>
      </Accordion>
    </>
  );
}
