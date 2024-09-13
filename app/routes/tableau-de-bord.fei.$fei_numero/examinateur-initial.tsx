import { useCallback, useMemo } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { loader } from "./route";
import UserNotEditable from "~/components/UserNotEditable";
import { Prisma, UserRoles } from "@prisma/client";
import InputNotEditable from "~/components/InputNotEditable";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Button } from "@codegouvfr/react-dsfr/Button";
import dayjs from "dayjs";
import SelectNextOwner from "./select-next-owner";
import InputVille from "~/components/InputVille";

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
  const VilleComponent = canEdit ? InputVille : InputNotEditable;

  const examFetcher = useFetcher({ key: "examination-fetcher" });
  const handleUserFormChange = useCallback(
    (event: React.FocusEvent<HTMLFormElement>) => {
      if (!canEdit) {
        return;
      }
      const formData = new FormData(event.currentTarget);
      examFetcher.submit(formData, {
        method: "POST",
        action: `/action/fei/${fei.numero}`,
        preventScrollReset: true, // Prevent scroll reset on submission
      });
    },
    [examFetcher, fei.numero, canEdit]
  );

  const needSelecteNextUser = useMemo(() => {
    if (fei.examinateur_initial_user_id !== user.id) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.EXAMINATEUR_INITIAL) {
      return false;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (!fei.examinateur_initial_approbation_mise_sur_le_marche) {
      return false;
    }
    return true;
  }, [fei, user]);

  const jobIsDone = useMemo(() => {
    if (!fei.date_mise_a_mort || !fei.commune_mise_a_mort) {
      return false;
    }
    // if (!fei.Carcasses?.length) {
    //   return false;
    // }
    return true;
  }, [fei]);

  return (
    <>
      <Accordion titleAs="h3" label="Données de chasse" defaultExpanded>
        <examFetcher.Form method="POST" action={`/action/fei/${fei.numero}`} onBlur={handleUserFormChange}>
          <div className="fr-fieldset__element">
            <Component
              label="Date de mise à mort et d'éviscération"
              nativeInputProps={{
                id: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                name: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                type: "date",
                autoComplete: "off",
                required: true,
                defaultValue: fei?.date_mise_a_mort ? new Date(fei?.date_mise_a_mort).toISOString().split("T")[0] : "",
              }}
            />
          </div>
          <div className="fr-fieldset__element">
            <VilleComponent
              label="Commune de mise à mort"
              nativeInputProps={{
                id: Prisma.FeiScalarFieldEnum.commune_mise_a_mort,
                name: Prisma.FeiScalarFieldEnum.commune_mise_a_mort,
                type: "text",
                required: true,
                autoComplete: "off",
                defaultValue: fei?.commune_mise_a_mort ?? "",
              }}
            />
          </div>
        </examFetcher.Form>
      </Accordion>
      <Accordion titleAs="h3" label="Identité de l'Examinateur">
        <UserNotEditable user={fei.FeiExaminateurInitialUser} withCfei />
      </Accordion>
      <Accordion titleAs="h3" label={`Carcasses (${fei.Carcasses.length})`}>
        <p>TODO</p>
      </Accordion>
      {fei.FeiExaminateurInitialUser && (
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
                    hintText: jobIsDone
                      ? ""
                      : "Veuillez remplir les données de chasse et examiner des carcasses au préalable",
                    nativeInputProps: {
                      required: true,
                      name: Prisma.FeiScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche,
                      value: "true",
                      disabled: !jobIsDone,
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
      )}
      {needSelecteNextUser && (
        <div className="md:w-auto mt-8 pt-4 z-50 flex flex-col md:items-start [&_ul]:md:min-w-96 bg-white">
          <SelectNextOwner />
        </div>
      )}
    </>
  );
}
