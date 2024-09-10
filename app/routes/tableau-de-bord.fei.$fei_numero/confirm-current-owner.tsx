import { Select } from "@codegouvfr/react-dsfr/Select";
import { loader } from "./route";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { UserRoles, Entity, User } from "@prisma/client";
import { useMemo, useState } from "react";
import getUserRoleLabel from "~/utils/get-user-roles-label";
import { SerializeFrom } from "@remix-run/node";

export default function ConfirmCurrentOwner() {
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
  const nextOwnerLabel = useMemo(() => {
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

  const fetcher = useFetcher({ key: "select-next-owner" });

  return (
    <fetcher.Form
      id="select-next-owner"
      preventScrollReset
      method="POST"
      onChange={(event) => {
        const formData = new FormData(event.currentTarget);
        fetcher.submit(formData, {
          method: "POST",
          action: `/action/fei/${fei.numero}`,
          preventScrollReset: true, // Prevent scroll reset on submission
        });
      }}
      className="w-full md:w-auto p-4 z-50 flex flex-col md:items-center [&_ul]:md:min-w-96 bg-white shadow-2xl md:shadow-none"
    >
      <input type="hidden" name="fei_numero" value={fei.numero} />
      <div className="fr-fieldset__element">
        <Select
          label="Qui doit désormais agir sur la FEI ?"
          className="!mb-0 grow"
          nativeSelectProps={{
            name: "fei_next_owner_role",
            value: nextRole,
            onChange: (e) => setNextRole(e.target.value as UserRoles),
          }}
        >
          <option value="">Sélectionnez le prochain type d'acteur à agir sur la FEI</option>
          <option value={UserRoles.DETENTEUR_INITIAL}>{getUserRoleLabel(UserRoles.DETENTEUR_INITIAL)}</option>
          <option value={UserRoles.EXAMINATEUR_INITIAL}>{getUserRoleLabel(UserRoles.EXAMINATEUR_INITIAL)}</option>
          <option value={UserRoles.EXPLOITANT_CENTRE_COLLECTE}>
            {getUserRoleLabel(UserRoles.EXPLOITANT_CENTRE_COLLECTE)}
          </option>
          <option value={UserRoles.COLLECTEUR_PRO}>{getUserRoleLabel(UserRoles.COLLECTEUR_PRO)}</option>
          <option value={UserRoles.ETG}>{getUserRoleLabel(UserRoles.ETG)}</option>
          <option value={UserRoles.SVI}>{getUserRoleLabel(UserRoles.SVI)}</option>
        </Select>
      </div>
      {nextRole && (
        <div className="fr-fieldset__element grow">
          <Select
            label={`Quel ${getUserRoleLabel(nextRole)}`}
            className="!mb-0 grow"
            nativeSelectProps={{
              name: nextOwnerIsUser ? "fei_next_owner_user_id" : "fei_next_owner_entity_id",
              defaultValue: (nextOwnerIsUser ? fei.fei_next_owner_user_id : fei.fei_next_owner_entity_id) ?? "",
            }}
          >
            <option value="">{nextOwnerLabel}</option>
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
  );
}
