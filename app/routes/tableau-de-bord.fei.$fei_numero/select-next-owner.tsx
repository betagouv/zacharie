import { Select } from "@codegouvfr/react-dsfr/Select";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { loader } from "./route";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { UserRoles, Entity, User, Prisma } from "@prisma/client";
import { useMemo, useState } from "react";
import { getUserRoleLabel, getUserRoleLabelPlural } from "~/utils/get-user-roles-label";
import { SerializeFrom } from "@remix-run/node";
import { action as searchUserAction } from "~/routes/action.trouver-premier-detenteur";

export default function SelectNextOwner() {
  const { user, detenteursInitiaux, examinateursInitiaux, ccgs, collecteursPro, etgs, svis, fei } =
    useLoaderData<typeof loader>();
  const [nextRole, setNextRole] = useState<UserRoles | "">(fei.fei_next_owner_role ?? "");

  const nextOwners = useMemo(() => {
    switch (nextRole) {
      case UserRoles.PREMIER_DETENTEUR:
        return detenteursInitiaux;
      case UserRoles.EXAMINATEUR_INITIAL:
        return examinateursInitiaux;
      case UserRoles.CCG:
        return ccgs;
      case UserRoles.COLLECTEUR_PRO:
        return collecteursPro;
      case UserRoles.ETG:
        return etgs;
      case UserRoles.SVI:
        return svis;
      default:
        return [];
    }
  }, [nextRole, detenteursInitiaux, examinateursInitiaux, ccgs, collecteursPro, etgs, svis]);
  const nextOwnerSelectLabel = useMemo(() => {
    switch (nextRole) {
      case UserRoles.PREMIER_DETENTEUR:
        return "Sélectionnez le Premier Détenteur de pour cette FEI";
      case UserRoles.EXAMINATEUR_INITIAL:
        return "Sélectionnez l'Examinateur Initial de pour cette FEI";
      case UserRoles.CCG:
        return "Sélectionnez un CCG pour cette FEI";
      case UserRoles.COLLECTEUR_PRO:
        return "Sélectionnez un Collecteur Pro pour cette FEI";
      case UserRoles.ETG:
        return "Sélectionnez un ETG pour cette FEI";
      case UserRoles.SVI:
        return "Sélectionnez le Service Vétérinaire d'Inspection pour cette FEI";
      default:
        return [];
    }
  }, [nextRole]);

  const nextOwnerIsUser = nextRole === UserRoles.PREMIER_DETENTEUR || nextRole === UserRoles.EXAMINATEUR_INITIAL;
  const nextOwnerIsEntity = nextRole !== UserRoles.PREMIER_DETENTEUR && nextRole !== UserRoles.EXAMINATEUR_INITIAL;

  const nextOwnerName = useMemo(() => {
    let nextOwner = nextOwners.find((owner) => {
      if (nextOwnerIsUser) {
        return owner.id === fei.fei_next_owner_user_id;
      }
      if (nextOwnerIsEntity) {
        return owner.id === fei.fei_next_owner_entity_id;
      }
      return false;
    }) as SerializeFrom<User> | SerializeFrom<Entity> | undefined;
    if (nextOwnerIsUser) {
      nextOwner = nextOwner as unknown as SerializeFrom<User>;
      return `${nextOwner?.prenom} ${nextOwner?.nom_de_famille}`;
    }
    if (nextOwnerIsEntity) {
      nextOwner = nextOwner as unknown as SerializeFrom<Entity>;
      return nextOwner?.raison_sociale;
    }
    return undefined;
  }, [nextOwners, fei.fei_next_owner_user_id, fei.fei_next_owner_entity_id, nextOwnerIsUser, nextOwnerIsEntity]);

  const nextOwnerFetcher = useFetcher({ key: "select-next-owner" });
  const searchUserFetcher = useFetcher<typeof searchUserAction>({ key: "search-user" });

  const showDetenteurInitial = useMemo(() => {
    if (fei.fei_current_owner_role !== UserRoles.EXAMINATEUR_INITIAL) {
      return false;
    }
    return !fei.premier_detenteur_date_depot_quelque_part;
  }, [fei.premier_detenteur_date_depot_quelque_part, fei.fei_current_owner_role]);

  const showIntermediaires = useMemo(() => {
    if (!fei.examinateur_initial_approbation_mise_sur_le_marche) {
      return false;
    }
    if (fei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL) {
      if (fei.examinateur_initial_user_id === fei.premier_detenteur_user_id) {
        return true;
      }
    }
    if (!fei.premier_detenteur_date_depot_quelque_part) {
      return false;
    }
    if (
      UserRoles.PREMIER_DETENTEUR !== fei.fei_current_owner_role &&
      UserRoles.CCG !== fei.fei_current_owner_role &&
      UserRoles.COLLECTEUR_PRO !== fei.fei_current_owner_role
    ) {
      return false;
    }
    return true;
  }, [
    fei.premier_detenteur_user_id,
    fei.fei_current_owner_role,
    fei.examinateur_initial_user_id,
    fei.examinateur_initial_approbation_mise_sur_le_marche,
    fei.premier_detenteur_date_depot_quelque_part,
  ]);

  const showSvi = useMemo(() => {
    if (fei.fei_current_owner_role !== UserRoles.ETG) {
      return false;
    }
    const latestIntermediaire = fei.FeiIntermediaires[0];
    if (!latestIntermediaire) {
      return false;
    }
    if (latestIntermediaire.fei_intermediaire_role !== UserRoles.ETG) {
      return false;
    }
    if (!latestIntermediaire.check_finished_at) {
      return false;
    }
    return true;
  }, [fei]);

  if (user.id !== fei.fei_current_owner_user_id) {
    return null;
  }
  if (fei.svi_signed_at) {
    return null;
  }

  const nextOwnersWorkingWith = nextOwners.filter((o) => !!o.relation);
  const nextOwnersNotWorkingWith = nextOwners.filter((o) => !o.relation);

  return (
    <>
      <nextOwnerFetcher.Form
        id="select-next-owner"
        preventScrollReset
        method="POST"
        action={`/action/fei/${fei.numero}`}
        onChange={(event) => {
          const formData = new FormData(event.currentTarget);
          nextOwnerFetcher.submit(formData, {
            method: "POST",
            action: `/action/fei/${fei.numero}`,
            preventScrollReset: true, // Prevent scroll reset on submission
          });
        }}
      >
        <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
        <div className="fr-fieldset__element">
          <Select
            label="Qui doit désormais agir sur la FEI ?"
            className="!mb-0 grow"
            nativeSelectProps={{
              name: Prisma.FeiScalarFieldEnum.fei_next_owner_role,
              value: nextRole,
              onChange: (e) => setNextRole(e.target.value as UserRoles),
            }}
          >
            <option value="">Sélectionnez le prochain type d'acteur à agir sur la FEI</option>
            <hr />
            {showDetenteurInitial ? (
              <option value={UserRoles.PREMIER_DETENTEUR}>{getUserRoleLabel(UserRoles.PREMIER_DETENTEUR)}</option>
            ) : showIntermediaires ? (
              <>
                <option value={UserRoles.COLLECTEUR_PRO}>{getUserRoleLabel(UserRoles.COLLECTEUR_PRO)}</option>
                <option value={UserRoles.ETG}>{getUserRoleLabel(UserRoles.ETG)}</option>
                <option value={UserRoles.CCG}>{getUserRoleLabel(UserRoles.CCG)}</option>
              </>
            ) : showSvi ? (
              <option value={UserRoles.SVI}>{getUserRoleLabel(UserRoles.SVI)}</option>
            ) : null}
          </Select>
        </div>
        {nextRole && (
          <div className="fr-fieldset__element grow">
            <Select
              label={`Quel ${getUserRoleLabel(nextRole)} ?`}
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
              {nextOwnersWorkingWith.length > 0 && (
                <>
                  <optgroup label={`Mes ${getUserRoleLabelPlural(nextRole)}`}>
                    {nextOwnersWorkingWith.map((potentielOwner) => {
                      return (
                        <NextOwnerOption
                          key={potentielOwner.id}
                          potentielOwner={potentielOwner}
                          nextOwnerIsEntity={nextOwnerIsEntity}
                          nextOwnerIsUser={nextOwnerIsUser}
                          user={user}
                        />
                      );
                    })}
                  </optgroup>
                  <hr />
                </>
              )}
              {nextOwnersNotWorkingWith.map((potentielOwner) => {
                return (
                  <NextOwnerOption
                    key={potentielOwner.id}
                    potentielOwner={potentielOwner}
                    nextOwnerIsEntity={nextOwnerIsEntity}
                    nextOwnerIsUser={nextOwnerIsUser}
                    user={user}
                  />
                );
              })}
            </Select>
          </div>
        )}
      </nextOwnerFetcher.Form>
      {nextRole === UserRoles.PREMIER_DETENTEUR && !fei.fei_next_owner_user_id && (
        <>
          <searchUserFetcher.Form
            className="fr-fieldset__element flex w-full flex-row items-end gap-4"
            method="POST"
            action="/action/trouver-premier-detenteur"
          >
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

const NextOwnerOption = ({ potentielOwner, nextOwnerIsEntity, nextOwnerIsUser, user }: NextOwnerOptionProps) => {
  let label = "";
  if (nextOwnerIsEntity) {
    potentielOwner = potentielOwner as unknown as SerializeFrom<Entity>;
    label = `${potentielOwner.raison_sociale} - ${potentielOwner.code_postal} ${potentielOwner.ville}`;
  }
  if (nextOwnerIsUser) {
    potentielOwner = potentielOwner as unknown as SerializeFrom<User>;
    label = `${potentielOwner.prenom} ${potentielOwner.nom_de_famille} - ${potentielOwner.code_postal} ${potentielOwner.ville}`;
  }
  if (potentielOwner.id === user.id) {
    label = `Vous (${label})`;
  }
  return (
    <option key={potentielOwner.id} value={potentielOwner.id}>
      {label}
    </option>
  );
};
