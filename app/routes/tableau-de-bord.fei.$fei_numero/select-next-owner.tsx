import { Select } from "@codegouvfr/react-dsfr/Select";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { loader } from "./route";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { UserRoles, Entity, User, Prisma } from "@prisma/client";
import { useMemo, useState } from "react";
import { getUserRoleLabel } from "~/utils/get-user-roles-label";
import { SerializeFrom } from "@remix-run/node";

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
        <Alert
          severity="success"
          description={`${nextOwnerName} a été notifié. Vous ne pouvez plus modifier votre FEI.`}
          title="Attribution effectuée"
        />
      )}
    </>
  );
}