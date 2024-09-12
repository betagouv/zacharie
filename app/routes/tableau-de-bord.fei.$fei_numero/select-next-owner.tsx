import { Select } from "@codegouvfr/react-dsfr/Select";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { loader } from "./route";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { UserRoles, Entity, User, Prisma } from "@prisma/client";
import { useMemo, useState } from "react";
import { getUserRoleLabel } from "~/utils/get-user-roles-label";
import { SerializeFrom } from "@remix-run/node";

export default function SelectNextOwner() {
  const { user, detenteursInitiaux, examinateursInitiaux, centresCollecte, collecteursPro, etgs, svis, fei } =
    useLoaderData<typeof loader>();
  const [nextRole, setNextRole] = useState<UserRoles | "">(fei.fei_next_owner_role ?? "");

  const nextOwners = useMemo(() => {
    switch (nextRole) {
      case UserRoles.DETENTEUR_INITIAL:
        return detenteursInitiaux;
      case UserRoles.EXAMINATEUR_INITIAL:
        return examinateursInitiaux;
      case UserRoles.EXPLOITANT_CENTRE_COLLECTE:
        return centresCollecte;
      case UserRoles.COLLECTEUR_PRO:
        return collecteursPro;
      case UserRoles.ETG:
        return etgs;
      case UserRoles.SVI:
        return svis;
      default:
        return [];
    }
  }, [nextRole, detenteursInitiaux, examinateursInitiaux, centresCollecte, collecteursPro, etgs, svis]);
  const nextOwnerSelectLabel = useMemo(() => {
    switch (nextRole) {
      case UserRoles.DETENTEUR_INITIAL:
        return "Sélectionnez le Détenteur Initial de pour cette FEI";
      case UserRoles.EXAMINATEUR_INITIAL:
        return "Sélectionnez l'Examinateur Initial de pour cette FEI";
      case UserRoles.EXPLOITANT_CENTRE_COLLECTE:
        return "Sélectionnez un Exploitant de Centre de Collecte pour cette FEI";
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

  const nextOwnerIsUser = nextRole === UserRoles.DETENTEUR_INITIAL || nextRole === UserRoles.EXAMINATEUR_INITIAL;
  const nextOwnerIsEntity = nextRole !== UserRoles.DETENTEUR_INITIAL && nextRole !== UserRoles.EXAMINATEUR_INITIAL;

  const nextOwnerName = useMemo(() => {
    let nextOwner = nextOwners.find((owner) => {
      if (nextOwnerIsUser) {
        return owner.id === fei.fei_next_owner_user_id;
      }
      if (nextOwnerIsEntity) {
        return owner.id === fei.fei_next_owner_entity_id;
      }
      return false;
    });
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

  const fetcher = useFetcher({ key: "select-next-owner" });

  const showDetenteurInitial = useMemo(() => {
    if (fei.fei_current_owner_role !== UserRoles.EXAMINATEUR_INITIAL) {
      return false;
    }
    return !fei.detenteur_initial_date_depot_centre_collecte;
  }, [fei.detenteur_initial_date_depot_centre_collecte, fei.fei_current_owner_role]);

  const showIntermediaires = useMemo(() => {
    if (!fei.examinateur_initial_approbation_mise_sur_le_marche) {
      return false;
    }
    if (fei.fei_current_owner_role === UserRoles.EXAMINATEUR_INITIAL) {
      if (fei.examinateur_initial_user_id === fei.detenteur_initial_user_id) {
        return true;
      }
    }
    if (!fei.detenteur_initial_date_depot_centre_collecte) {
      return false;
    }
    if (
      UserRoles.DETENTEUR_INITIAL !== fei.fei_current_owner_role &&
      UserRoles.EXPLOITANT_CENTRE_COLLECTE !== fei.fei_current_owner_role &&
      UserRoles.COLLECTEUR_PRO !== fei.fei_current_owner_role
    ) {
      return false;
    }
    return true;
  }, [
    fei.detenteur_initial_user_id,
    fei.fei_current_owner_role,
    fei.examinateur_initial_user_id,
    fei.examinateur_initial_approbation_mise_sur_le_marche,
    fei.detenteur_initial_date_depot_centre_collecte,
  ]);

  const showSvi = useMemo(() => {
    if (fei.fei_current_owner_role !== UserRoles.ETG) {
      return false;
    }
    if (!fei.etg_check_finished_at) {
      return false;
    }
    return true;
  }, [fei.fei_current_owner_role, fei.etg_check_finished_at]);

  if (user.id !== fei.fei_current_owner_user_id) {
    return null;
  }

  return (
    <>
      <fetcher.Form
        id="select-next-owner"
        preventScrollReset
        method="POST"
        action={`/action/fei/${fei.numero}`}
        onChange={(event) => {
          const formData = new FormData(event.currentTarget);
          fetcher.submit(formData, {
            method: "POST",
            action: `/action/fei/${fei.numero}`,
            preventScrollReset: true, // Prevent scroll reset on submission
          });
        }}
        className="md:w-auto mt-8 pt-4 z-50 flex flex-col md:items-start [&_ul]:md:min-w-96 bg-white"
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
            {showDetenteurInitial ? (
              <option value={UserRoles.DETENTEUR_INITIAL}>{getUserRoleLabel(UserRoles.DETENTEUR_INITIAL)}</option>
            ) : showIntermediaires ? (
              <>
                <option value={UserRoles.EXPLOITANT_CENTRE_COLLECTE}>
                  {getUserRoleLabel(UserRoles.EXPLOITANT_CENTRE_COLLECTE)}
                </option>
                <option value={UserRoles.COLLECTEUR_PRO}>{getUserRoleLabel(UserRoles.COLLECTEUR_PRO)}</option>
                <option value={UserRoles.ETG}>{getUserRoleLabel(UserRoles.ETG)}</option>
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
              {nextOwners.map((potentielOwner) => {
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
              })}
            </Select>
          </div>
        )}
      </fetcher.Form>

      {(fei.fei_next_owner_user_id || fei.fei_next_owner_entity_id) && (
        <Alert severity="success" description={`${nextOwnerName} a été notifié`} title="Attribution effectuée" />
      )}
    </>
  );
}
