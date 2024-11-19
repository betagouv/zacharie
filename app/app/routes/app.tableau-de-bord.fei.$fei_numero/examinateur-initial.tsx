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
import { formatCountCarcasseByEspece } from "@app/utils/count-carcasses-by-espece";

export default function FEIExaminateurInitial() {
  const { fei, user, carcasses, examinateurInitialUser, premierDetenteurUser, premierDetenteurEntity } =
    useLoaderData<typeof clientLoader>();

  const approbationFetcher = useFetcher({ key: "approbation-mise-sur-le-marche" });

  const countCarcassesByEspece = useMemo(() => formatCountCarcasseByEspece(carcasses), [carcasses]);

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

  console.log("fei.heure_evisceration_derniere_carcasse", fei.heure_evisceration_derniere_carcasse);

  const canEdit = useMemo(() => {
    if (fei.examinateur_initial_user_id !== user.id) {
      // seul l'examinateur initial peut modifier
      return false;
    }
    if (!carcasses.length) {
      // il faut au moins une carcasse
      return true;
    }
    if (!onlyPetitGibier && !fei.heure_evisceration_derniere_carcasse) {
      // il faut l'heure d'éviscération de la dernière carcasse le cas échéant
      return true;
    }
    if (!fei.commune_mise_a_mort) {
      return true;
    }
    if (!fei.date_mise_a_mort) {
      return true;
    }
    if (!fei.heure_mise_a_mort_premiere_carcasse) {
      return true;
    }
    if (needSelectNextUser) {
      // on garde la possibilité de modifier tout jusqu'à ce que le prochain utilisateur de la fiche soit en sa possession
      // pour palier à un oubli potentiel de l'examinatuer initial mêms après avoir validé la mise sur le marché
      return true;
    }
    if (fei.examinateur_initial_approbation_mise_sur_le_marche) {
      return false;
    }
    return true;
  }, [fei, user, carcasses, onlyPetitGibier, needSelectNextUser]);

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

  const jobIsMissing = useMemo(() => {
    if (!fei.date_mise_a_mort) {
      return "Il manque la date de mise à mort";
    }
    if (!fei.commune_mise_a_mort) {
      return "Il manque la commune de mise à mort";
    }
    if (!fei.heure_mise_a_mort_premiere_carcasse) {
      return "Il manque l'heure de mise à mort de la première carcasse";
    }
    if (!onlyPetitGibier) {
      if (!fei.heure_evisceration_derniere_carcasse) {
        return "Il manque l'heure d'éviscération de la dernière carcasse";
      }
    }
    if (carcasses.length === 0) {
      return "Il n'y a pas de carcasses";
    }
    if (carcassesNotReady.length > 0) {
      return "Il manque des informations sur certaines carcasses";
    }
    return null;
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
      <Accordion titleAs="h3" label="Identité de l'Examinateur 🔒" defaultExpanded={!canEdit}>
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
                    hintText: !jobIsMissing
                      ? ""
                      : "Veuillez remplir au préalable la date et la commune de mise à mort, les heures de mise à mort et d'éviscération des carcasses",
                    nativeInputProps: {
                      required: true,
                      name: Prisma.FeiScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche,
                      value: "true",
                      // disabled: !jobIsDone,

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
            <input
              type="hidden"
              name={Prisma.FeiScalarFieldEnum.resume_nombre_de_carcasses}
              value={countCarcassesByEspece.join("\n")}
            />
            <div className="fr-fieldset__element">
              {canEdit && (
                <Button
                  type="submit"
                  disabled={!carcasses.length}
                  onClick={(e) => {
                    if (jobIsMissing) {
                      e.preventDefault();
                      alert(jobIsMissing);
                    }
                  }}
                >
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
