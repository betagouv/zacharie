import type { SerializeFrom } from "@remix-run/node";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { clientLoader } from "./route";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { UserRoles, Entity, User, Prisma } from "@prisma/client";
import { useMemo, useState } from "react";
import { getUserRoleLabel, getUserRoleLabelPlural } from "~/utils/get-user-roles-label";
import type { FeiAction } from "~/db/fei.client";

export default function SelectNextOwner() {
  const { user, ccgs, collecteursPro, etgs, svis, fei } = useLoaderData<typeof clientLoader>();
  const [nextRole, setNextRole] = useState<UserRoles | "">(() => {
    if (fei.fei_next_owner_role) {
      return fei.fei_next_owner_role;
    }
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
      const depotAtEntityId = fei.premier_detenteur_depot_entity_id;
      if (depotAtEntityId) {
        const potentielDepotEntity = [...collecteursPro, ...etgs].find((entity) => entity.id === depotAtEntityId);
        if (potentielDepotEntity) {
          return potentielDepotEntity.type;
        }
      }
    }
    return fei.fei_next_owner_role ?? "";
  });

  const nextOwners = useMemo(() => {
    switch (nextRole) {
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
  }, [nextRole, ccgs, collecteursPro, etgs, svis]);
  const nextOwnerSelectLabel = useMemo(() => {
    switch (nextRole) {
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
      return undefined;
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

  const savedNextOwner = nextOwnerIsUser ? fei.fei_next_owner_user_id : fei.fei_next_owner_entity_id;
  const [nextOwnerValue, setNextOwnerValue] = useState(() => {
    const savedNextOwner = nextOwnerIsUser ? fei.fei_next_owner_user_id : fei.fei_next_owner_entity_id;
    if (savedNextOwner) {
      return savedNextOwner;
    }
    if (fei.fei_current_owner_role === UserRoles.PREMIER_DETENTEUR) {
      return fei.premier_detenteur_depot_entity_id ?? "";
    }
    return "";
  });

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
        onSubmit={(event) => {
          const formData = new FormData(event.currentTarget);
          nextOwnerFetcher.submit(formData, {
            method: "POST",
            preventScrollReset: true, // Prevent scroll reset on submission
          });
        }}
      >
        <input type="hidden" name="route" value={`/api/action/fei/${fei.numero}`} />
        <input type="hidden" name="step" value={"fei_action_next_role" satisfies FeiAction} />
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
            {showIntermediaires ? (
              <>
                <option value={UserRoles.COLLECTEUR_PRO}>{getUserRoleLabel(UserRoles.COLLECTEUR_PRO)}</option>
                <option value={UserRoles.ETG}>{getUserRoleLabel(UserRoles.ETG)}</option>
                {/* <option value={UserRoles.CCG}>{getUserRoleLabel(UserRoles.CCG)}</option> */}
              </>
            ) : showSvi ? (
              <option value={UserRoles.SVI}>{getUserRoleLabel(UserRoles.SVI)}</option>
            ) : null}
          </Select>
        </div>
        {nextRole && (
          <>
            <div className="fr-fieldset__element grow">
              <Select
                label={`Quel ${getUserRoleLabel(nextRole)} ?`}
                className="!mb-0 grow"
                key={fei.fei_next_owner_user_id ?? fei.fei_next_owner_entity_id ?? "no-choice-yet"}
                nativeSelectProps={{
                  name: nextOwnerIsUser
                    ? Prisma.FeiScalarFieldEnum.fei_next_owner_user_id
                    : Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id,
                  value: nextOwnerValue,
                  onChange: (e) => setNextOwnerValue(e.target.value),
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
              {(!nextOwnerValue || nextOwnerValue !== savedNextOwner) && (
                <Button type="submit" className="mt-2" disabled={!nextOwnerValue}>
                  Envoyer
                </Button>
              )}
            </div>
          </>
        )}
      </nextOwnerFetcher.Form>
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
