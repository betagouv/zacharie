import { useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { clientLoader } from "./route";
import UserNotEditable from "~/components/UserNotEditable";
import { Prisma, UserRoles, Entity, User } from "@prisma/client";
import InputNotEditable from "~/components/InputNotEditable";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Button } from "@codegouvfr/react-dsfr/Button";
import dayjs from "dayjs";
import InputVille from "~/components/InputVille";
import CarcassesExaminateur from "./carcasses-examinateur";

export default function FEIExaminateurInitial() {
  const { fei, user } = useLoaderData<typeof clientLoader>();

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
  const handleUserFormChange = (event: React.FocusEvent<HTMLFormElement>) => {
    if (!canEdit) {
      return;
    }
    approbationFetcher.submit(new FormData(event.currentTarget), {
      method: "POST",
      preventScrollReset: true,
    });
  };

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

  const carcassesNotReady = useMemo(() => {
    const notReady = [];
    for (const carcasse of fei.Carcasses) {
      if (
        !carcasse.examinateur_signed_at ||
        !carcasse.heure_evisceration ||
        !carcasse.heure_mise_a_mort ||
        !carcasse.espece ||
        !carcasse.categorie
      ) {
        notReady.push(carcasse);
      }
    }
    return notReady;
  }, [fei]);

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
        <examFetcher.Form method="POST" onBlur={handleUserFormChange}>
          <input type="hidden" name="route" value={`/action/fei/${fei.numero}`} />
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
      <Accordion titleAs="h3" label={`Carcasses (${fei.Carcasses.length})`} defaultExpanded>
        <CarcassesExaminateur canEdit={canEdit} />
      </Accordion>
      <Accordion titleAs="h3" label={`Identité de l'Examinateur ${canEdit ? "🔒" : ""}`}>
        <UserNotEditable user={fei.FeiExaminateurInitialUser} withCfei />
      </Accordion>
      {fei.FeiExaminateurInitialUser && (
        <Accordion titleAs="h3" label="Approbation de mise sur le marché" defaultExpanded>
          <approbationFetcher.Form method="POST">
            <input type="hidden" name="route" value={`/action/fei/${fei.numero}`} />
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
                <Button type="submit" disabled={!fei.Carcasses.length}>
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
      {needSelecteNextUser && (
        <div className="z-50 mt-4 flex flex-col bg-white pt-4 md:w-auto md:items-start [&_ul]:md:min-w-96">
          <SelectPremierDetenteur />
        </div>
      )}
    </>
  );
}

import type { SerializeFrom } from "@remix-run/node";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { action as searchUserAction } from "~/routes/action.trouver-premier-detenteur";

function SelectPremierDetenteur() {
  const { user, detenteursInitiaux, fei } = useLoaderData<typeof clientLoader>();
  const nextRole = UserRoles.PREMIER_DETENTEUR;
  const nextOwnerSelectLabel = "Sélectionnez le Premier Détenteur de pour cette FEI";

  const nextOwnerIsUser = nextRole === UserRoles.PREMIER_DETENTEUR || nextRole === UserRoles.EXAMINATEUR_INITIAL;

  const nextOwnerName = useMemo(() => {
    const nextOwner = detenteursInitiaux.find((owner) => {
      owner.id === fei.fei_next_owner_user_id;
    }) as SerializeFrom<User>;
    return `${nextOwner?.prenom} ${nextOwner?.nom_de_famille}`;
  }, [detenteursInitiaux, fei.fei_next_owner_user_id]);

  const nextOwnerFetcher = useFetcher({ key: "select-next-owner" });
  const searchUserFetcher = useFetcher<typeof searchUserAction>({ key: "search-user" });

  if (user.id !== fei.fei_current_owner_user_id) {
    return null;
  }

  return (
    <>
      <nextOwnerFetcher.Form
        id="select-next-owner"
        preventScrollReset
        method="POST"
        onChange={(event) => {
          const formData = new FormData(event.currentTarget);
          formData.append("route", `/action/fei/${fei.numero}`);
          nextOwnerFetcher.submit(formData, {
            method: "POST",
            preventScrollReset: true, // Prevent scroll reset on submission
          });
        }}
      >
        <input type="hidden" name="route" value={`/action/fei/${fei.numero}`} />
        <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
        <div className="fr-fieldset__element grow">
          <Select
            label="Quel Premier Détenteur doit désormais agir sur la FEI ?"
            className="!mb-0 grow"
            key={fei.fei_next_owner_user_id ?? fei.fei_next_owner_entity_id ?? "no-choice-yet"}
            nativeSelectProps={{
              name: nextOwnerIsUser
                ? Prisma.FeiScalarFieldEnum.fei_next_owner_user_id
                : Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id,
              defaultValue: (nextOwnerIsUser ? fei.fei_next_owner_user_id : fei.fei_next_owner_entity_id) ?? "",
            }}
          >
            <option value="">{nextOwnerSelectLabel}</option>
            {detenteursInitiaux.map((potentielOwner) => {
              return <NextOwnerOption key={potentielOwner.id} potentielOwner={potentielOwner} user={user} />;
            })}
          </Select>
        </div>
      </nextOwnerFetcher.Form>
      {!fei.fei_next_owner_user_id && (
        <>
          <searchUserFetcher.Form className="fr-fieldset__element flex w-full flex-row items-end gap-4" method="POST">
            <input type="hidden" name="route" value="/action/trouver-premier-detenteur" />
            <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
            <Input
              label="...ou saisissez l'email du Premier Détenteur si vous ne le trouvez pas"
              className="!mb-0"
              hintText="Nous l'ajouterons automatiquement à la liste de vos partenaires pour la prochaine fois"
              nativeInputProps={{
                id: Prisma.UserScalarFieldEnum.email,
                name: Prisma.UserScalarFieldEnum.email,
                autoComplete: "off",
              }}
            />
            <Button type="submit">Envoyer</Button>
          </searchUserFetcher.Form>
          {searchUserFetcher.data?.error === "L'utilisateur n'existe pas" && (
            <Alert
              severity="error"
              title="Nous ne connaissons pas cet email"
              description="Vérifiez avec le Premier Détenteur s'il est avec vous ?"
            />
          )}
        </>
      )}

      {(fei.fei_next_owner_user_id || fei.fei_next_owner_entity_id) && (
        <Alert
          severity="success"
          description={`${nextOwnerName} a été notifié. Vous ne pouvez plus modifier votre FEI.`}
          title="Attribution effectuée"
        />
      )}
    </>
  );
}

type NextOwnerOptionProps = {
  potentielOwner: SerializeFrom<User> | SerializeFrom<Entity>;
  nextOwnerIsEntity: boolean;
  nextOwnerIsUser: boolean;
  user: SerializeFrom<User>;
};

const NextOwnerOption = ({ potentielOwner, user }: NextOwnerOptionProps) => {
  let label = "";
  potentielOwner = potentielOwner as unknown as SerializeFrom<User>;
  label = `${potentielOwner.prenom} ${potentielOwner.nom_de_famille} - ${potentielOwner.code_postal} ${potentielOwner.ville}`;

  if (potentielOwner.id === user.id) {
    label = `Vous (${label})`;
  }
  return (
    <option key={potentielOwner.id} value={potentielOwner.id}>
      {label}
    </option>
  );
};
