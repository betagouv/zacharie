import { useMemo, useRef } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { clientLoader } from "./route";
import UserNotEditable from "~/components/UserNotEditable";
import { Prisma, UserRoles } from "@prisma/client";
import InputNotEditable from "~/components/InputNotEditable";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Button } from "@codegouvfr/react-dsfr/Button";
import dayjs from "dayjs";
import InputVille from "~/components/InputVille";
import CarcassesExaminateur from "./carcasses-examinateur";
import SelectPremierDetenteur from "./select-next-premier-detenteur";
import { mergeFei } from "~/db/fei.client";

export default function FEIExaminateurInitial() {
  const { fei, user, carcasses, examinateurInitialUser } = useLoaderData<typeof clientLoader>();

  const approbationFetcher = useFetcher({ key: "approbation-mise-sur-le-marche" });

  const canEdit = useMemo(() => {
    if (fei.examinateur_initial_user_id !== user.id) {
      console.log("not examinateur");
      return false;
    }
    if (fei.examinateur_initial_approbation_mise_sur_le_marche) {
      console.log("already approved");
      return false;
    }
    return true;
  }, [fei, user]);

  const Component = canEdit ? Input : InputNotEditable;
  const VilleComponent = canEdit ? InputVille : InputNotEditable;

  const examFetcher = useFetcher({ key: "examination-fetcher" });
  const examRef = useRef<HTMLFormElement>(null);
  const handleUserFormChange = () => {
    if (!canEdit) {
      return;
    }
    const nextFei = mergeFei(fei, new FormData(examRef.current!));
    nextFei.append("route", `/api/fei/${fei.numero}`);
    console.log("submitting", nextFei);
    approbationFetcher.submit(nextFei, {
      method: "POST",
      preventScrollReset: true,
    });
  };

  const needSelectNextUser = useMemo(() => {
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

  const carcassesNotReady = useMemo(() => {
    const notReady = [];
    for (const carcasse of carcasses) {
      if (
        !carcasse.examinateur_signed_at ||
        // !carcasse.heure_evisceration ||
        // !carcasse.heure_mise_a_mort ||
        !carcasse.espece ||
        !carcasse.categorie
      ) {
        notReady.push(carcasse);
      }
    }
    return notReady;
  }, [carcasses]);

  const jobIsDone = useMemo(() => {
    if (!fei.date_mise_a_mort || !fei.commune_mise_a_mort) {
      return false;
    }
    if (carcassesNotReady.length > 0) {
      return false;
    }
    return true;
  }, [fei, carcassesNotReady]);

  return (
    <>
      <Accordion titleAs="h3" label="Données de chasse" defaultExpanded>
        <examFetcher.Form method="POST" onBlur={handleUserFormChange} ref={examRef}>
          <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
          <div className="fr-fieldset__element">
            <Component
              label="Date de mise à mort et d'éviscération"
              nativeInputProps={{
                id: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                name: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
                type: "date",
                autoComplete: "off",
                required: true,
                suppressHydrationWarning: true,
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
      <Accordion titleAs="h3" label={`Carcasses (${carcasses.length})`} defaultExpanded>
        <CarcassesExaminateur canEdit={canEdit} />
      </Accordion>
      <Accordion titleAs="h3" label={`Identité de l'Examinateur ${canEdit ? "🔒" : ""}`}>
        <UserNotEditable user={examinateurInitialUser!} withCfei />
      </Accordion>
      {examinateurInitialUser && (
        <Accordion titleAs="h3" label="Approbation de mise sur le marché" defaultExpanded>
          <approbationFetcher.Form
            method="POST"
            onSubmit={(event) => {
              event.preventDefault();
              const nextFei = mergeFei(fei, new FormData(event.currentTarget));
              nextFei.append("route", `/api/fei/${fei.numero}`);
              approbationFetcher.submit(nextFei, {
                method: "POST",
                preventScrollReset: true,
              });
            }}
          >
            <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
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
              {!fei.examinateur_initial_approbation_mise_sur_le_marche && (
                <Button type="submit" disabled={!carcasses.length}>
                  Enregistrer
                </Button>
              )}
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
                    suppressHydrationWarning: true,
                    defaultValue: dayjs(fei?.examinateur_initial_date_approbation_mise_sur_le_marche).format(
                      "YYYY-MM-DDTHH:mm",
                    ),
                  }}
                />
              </div>
            )}
          </approbationFetcher.Form>
        </Accordion>
      )}
      {needSelectNextUser && (
        <div className="z-50 mt-4 flex flex-col bg-white pt-4 md:w-auto md:items-start [&_ul]:md:min-w-96">
          <SelectPremierDetenteur />
        </div>
      )}
    </>
  );
}
