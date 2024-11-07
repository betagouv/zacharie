import { useMemo, useRef } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { clientLoader } from "./route";
import UserNotEditable from "@app/components/UserNotEditable";
import { CarcasseType, Prisma, UserRoles } from "@prisma/client";
import InputNotEditable from "@app/components/InputNotEditable";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Button } from "@codegouvfr/react-dsfr/Button";
import dayjs from "dayjs";
import InputVille from "@app/components/InputVille";
import CarcassesExaminateur from "./carcasses-examinateur";
import SelectNextForExaminateur from "./select-next-for-examinateur";
import { mergeFei } from "@app/db/fei.client";
import FeiPremierDetenteur from "./premier-detenteur";
import EntityNotEditable from "@app/components/EntityNotEditable";

export default function FEIExaminateurInitial() {
  const { fei, user, carcasses, examinateurInitialUser, premierDetenteurUser, premierDetenteurEntity } =
    useLoaderData<typeof clientLoader>();

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

  const examinateurIsAlsoPremierDetenteur = useMemo(() => {
    if (fei.fei_current_owner_role !== UserRoles.PREMIER_DETENTEUR) {
      return false;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (fei.premier_detenteur_user_id !== user.id) {
      return false;
    }
    if (fei.examinateur_initial_user_id !== user.id) {
      return false;
    }
    return true;
  }, [fei, user]);

  const [carcassesNotReady, atLeastOneCarcasseWithAnomalie] = useMemo(() => {
    const notReady = [];
    let _atLeastOneCarcasseWithAnomalie = false;
    for (const carcasse of carcasses.filter((c) => c !== null)) {
      if (
        !carcasse.examinateur_signed_at ||
        // !carcasse.heure_evisceration ||
        // !carcasse.heure_mise_a_mort ||
        // !carcasse.categorie ||
        !carcasse.espece
      ) {
        notReady.push(carcasse);
      }
      if (carcasse.examinateur_anomalies_abats?.length || carcasse.examinateur_anomalies_carcasse?.length) {
        _atLeastOneCarcasseWithAnomalie = true;
      }
    }
    return [notReady, _atLeastOneCarcasseWithAnomalie];
  }, [carcasses]);

  const onlyPetitGibier = useMemo(() => {
    for (const carcasse of carcasses) {
      if (carcasse?.type !== CarcasseType.PETIT_GIBIER) {
        return false;
      }
    }
    return true;
  }, [carcasses]);

  const jobIsDone = useMemo(() => {
    if (!fei.date_mise_a_mort || !fei.commune_mise_a_mort || !fei.heure_mise_a_mort_premiere_carcasse) {
      return false;
    }
    if (!onlyPetitGibier) {
      if (!fei.heure_evisceration_derniere_carcasse) {
        return false;
      }
    }
    if (carcasses.length === 0) {
      return false;
    }
    if (carcassesNotReady.length > 0) {
      return false;
    }
    return true;
  }, [fei, carcassesNotReady, carcasses, onlyPetitGibier]);

  const checkboxLabel = useMemo(() => {
    let label = fei.examinateur_initial_approbation_mise_sur_le_marche ? "J'ai certifié" : "Je certifie";
    if (!atLeastOneCarcasseWithAnomalie) {
      label += " qu'aucune anomalie n'a été observée lors de l'examen initial et";
      label += " que les carcasses en peau examinées ce jour peuvent être mises sur le marché.";
      return label;
    } else {
      return (label +=
        "que les carcasses en peau examinées ce jour présentent au moins une anomalie. Toutefois, elles peuvent être mises sur le marché.");
    }
  }, [fei.examinateur_initial_approbation_mise_sur_le_marche, atLeastOneCarcasseWithAnomalie]);

  return (
    <>
      <Accordion titleAs="h3" label="Données de chasse" defaultExpanded>
        <examFetcher.Form method="POST" onBlur={handleUserFormChange} ref={examRef}>
          <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
          <div className="fr-fieldset__element">
            <Component
              label="Date de mise à mort (et d'éviscération) *"
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
              label="Commune de mise à mort *"
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
          <div className="fr-fieldset__element">
            <Component
              label="Heure de mise à mort de la première carcasse *"
              nativeInputProps={{
                id: Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse,
                name: Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse,
                type: "time",
                required: true,
                autoComplete: "off",
                defaultValue: fei?.heure_mise_a_mort_premiere_carcasse ?? "",
              }}
            />
          </div>
        </examFetcher.Form>
      </Accordion>
      <Accordion titleAs="h3" label={`Carcasses/Lots de carcasses (${carcasses.length})`} defaultExpanded>
        <CarcassesExaminateur canEdit={canEdit} />
      </Accordion>
      <Accordion titleAs="h3" label="Identité de l'Examinateur 🔒">
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
            {!onlyPetitGibier && (
              <div className="fr-fieldset__element">
                <Component
                  label="Heure d'éviscération de la dernière carcasse"
                  nativeInputProps={{
                    id: Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse,
                    name: Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse,
                    type: "time",
                    required: true,
                    autoComplete: "off",
                    onBlur: (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget.form as HTMLFormElement);
                      formData.append(Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse, e.target.value);
                      const nextFei = mergeFei(fei, formData);
                      nextFei.append("route", `/api/fei/${fei.numero}`);
                      approbationFetcher.submit(nextFei, {
                        method: "POST",
                        preventScrollReset: true,
                      });
                    },
                    defaultValue: fei?.heure_evisceration_derniere_carcasse ?? "",
                  }}
                />
              </div>
            )}
            <div
              className={[
                "fr-fieldset__element",
                fei.examinateur_initial_approbation_mise_sur_le_marche ? "pointer-events-none" : "",
              ].join(" ")}
            >
              <Checkbox
                options={[
                  {
                    label: checkboxLabel,
                    hintText: jobIsDone
                      ? ""
                      : "Veuillez remplir au préalable la date et la commune de mise à mort, les heures de mise à mort et d'éviscération des carcasses",
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
            </div>
            <div className="fr-fieldset__element">
              <Component
                label="Date d'approbation de mise sur le marché"
                nativeInputProps={{
                  id: Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche,
                  name: Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche,
                  type: "datetime-local",
                  autoComplete: "off",
                  suppressHydrationWarning: true,
                  defaultValue: dayjs(fei?.examinateur_initial_date_approbation_mise_sur_le_marche || undefined).format(
                    "YYYY-MM-DDTHH:mm",
                  ),
                }}
              />
            </div>
            <div className="fr-fieldset__element">
              {!fei.examinateur_initial_approbation_mise_sur_le_marche && (
                <Button type="submit" disabled={!carcasses.length}>
                  Enregistrer
                </Button>
              )}
            </div>
          </approbationFetcher.Form>
        </Accordion>
      )}
      {needSelectNextUser && (
        <div className="z-50 mt-4 flex flex-col bg-white pt-4 md:w-auto md:items-start [&_ul]:md:min-w-96">
          <SelectNextForExaminateur />
        </div>
      )}
      {examinateurIsAlsoPremierDetenteur && (
        <>
          <Accordion titleAs="h3" label="Identité du Premier détenteur 🔒" defaultExpanded={false}>
            {premierDetenteurEntity ? (
              <EntityNotEditable hideType entity={premierDetenteurEntity} user={premierDetenteurUser!} />
            ) : (
              <UserNotEditable user={premierDetenteurUser!} />
            )}
          </Accordion>
          <Accordion titleAs="h3" label="Action du Premier détenteur" defaultExpanded>
            <FeiPremierDetenteur showIdentity={false} />
          </Accordion>
        </>
      )}
    </>
  );
}
