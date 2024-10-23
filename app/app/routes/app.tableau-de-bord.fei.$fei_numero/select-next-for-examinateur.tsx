import { useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { clientLoader } from "./route";
import { Prisma, Entity, User, UserRoles } from "@prisma/client";
import { Button } from "@codegouvfr/react-dsfr/Button";
import type { SerializeFrom } from "@remix-run/node";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { action as searchUserAction } from "@api/routes/api.fei-trouver-premier-detenteur";
import { useIsOnline } from "@app/components/OfflineMode";
import { mergeFei } from "@app/db/fei.client";

export default function SelectNextForExaminateur() {
  const {
    user,
    relationsCatalog: { detenteursInitiaux, associationsDeChasse },
    fei,
  } = useLoaderData<typeof clientLoader>();
  const isOnline = useIsOnline();
  const nextOwnerSelectLabel = "Sélectionnez le Premier Détenteur de pour cette fiche";
  const nextOwnerFetcher = useFetcher({ key: "select-next-premier-detenteur" });
  const searchUserFetcher = useFetcher<typeof searchUserAction>({ key: "search-user" });
  const [nextValue, setNextValue] = useState(fei.fei_next_owner_user_id ?? fei.fei_next_owner_entity_id ?? "");

  const { nextOwnerUser, nextOwnerEntity } = useMemo(() => {
    const _nextOwner = detenteursInitiaux.find((owner) => {
      return owner.id === nextValue;
    }) as SerializeFrom<User>;
    if (_nextOwner) {
      return { nextOwnerUser: _nextOwner, nextOwnerEntity: null };
    }
    const _nextEntity = associationsDeChasse.find((entity) => {
      return entity.id === nextValue;
    }) as SerializeFrom<Entity>;
    if (_nextEntity) {
      return { nextOwnerUser: null, nextOwnerEntity: _nextEntity };
    }
    return { nextOwnerUser: null, nextOwnerEntity: null };
  }, [detenteursInitiaux, associationsDeChasse, nextValue]);

  const nextOwnerName = useMemo(() => {
    if (nextOwnerUser) {
      return `${nextOwnerUser.prenom} ${nextOwnerUser.nom_de_famille}`;
    }
    if (nextOwnerEntity) {
      return nextOwnerEntity.nom_d_usage;
    }
    return "";
  }, [nextOwnerUser, nextOwnerEntity]);

  if (user.id !== fei.fei_current_owner_user_id) {
    return null;
  }

  return (
    <>
      <nextOwnerFetcher.Form
        id="select-next-owner"
        preventScrollReset
        method="POST"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const nextIsMe = nextOwnerUser?.id === user.id;
          const nextIsMyAssociation = !!nextOwnerEntity?.id;
          if (nextIsMe) {
            console.log("nextIsMe");
            formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id, "");
            formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_role, "");
            formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id, "");
            formData.set(Prisma.FeiScalarFieldEnum.fei_current_owner_role, UserRoles.PREMIER_DETENTEUR);
            formData.set(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id, user.id);
            formData.set(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id, user.id);
            formData.set(Prisma.FeiScalarFieldEnum.premier_detenteur_name_cache, user.nom_de_famille ?? "");
          } else if (nextIsMyAssociation) {
            console.log("nextIsMyAssociation");
            formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id, "");
            formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_role, "");
            formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id, "");
            formData.set(Prisma.FeiScalarFieldEnum.fei_current_owner_role, UserRoles.PREMIER_DETENTEUR);
            formData.set(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id, nextOwnerEntity.id);
            formData.set(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id, user.id);
            formData.set(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id, user.id);
            formData.set(Prisma.FeiScalarFieldEnum.premier_detenteur_entity_id, nextOwnerEntity.id);
            formData.set(Prisma.FeiScalarFieldEnum.premier_detenteur_name_cache, nextOwnerEntity?.nom_d_usage ?? "");
          } else {
            console.log("nextIsSomeoneElse");
          }
          const nextFei = mergeFei(fei, formData);
          nextFei.append("route", `/api/fei/${fei.numero}`);
          nextOwnerFetcher.submit(nextFei, {
            method: "POST",
            preventScrollReset: true,
          });
        }}
      >
        <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
        <input type="hidden" name={Prisma.FeiScalarFieldEnum.fei_next_owner_role} value={UserRoles.PREMIER_DETENTEUR} />
        {nextOwnerUser && (
          <input type="hidden" name={Prisma.FeiScalarFieldEnum.fei_next_owner_user_id} value={nextOwnerUser.id} />
        )}
        {nextOwnerEntity && (
          <input type="hidden" name={Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id} value={nextOwnerEntity.id} />
        )}
        <div className="fr-fieldset__element grow">
          <Select
            label="Quel Premier Détenteur doit désormais agir sur la fiche ?"
            className="!mb-0 grow"
            key={fei.fei_next_owner_user_id ?? "no-choice-yet"}
            nativeSelectProps={{
              name: "next_owner",
              value: nextValue,
              onChange: (event) => {
                setNextValue(event.target.value);
              },
            }}
          >
            <option value="">{nextOwnerSelectLabel}</option>
            <optgroup label="Vos associations">
              {associationsDeChasse.map((potentielOwner) => {
                return (
                  <NextOwnerOption
                    nextOwnerIsEntity
                    key={potentielOwner.id}
                    potentielOwner={potentielOwner}
                    user={user}
                  />
                );
              })}
            </optgroup>
            <optgroup label="Autres personnes">
              {detenteursInitiaux.map((potentielOwner) => {
                return (
                  <NextOwnerOption
                    nextOwnerIsUser
                    key={potentielOwner.id}
                    potentielOwner={potentielOwner}
                    user={user}
                  />
                );
              })}
            </optgroup>
          </Select>
          {!nextValue ||
            (nextValue !== fei.fei_next_owner_user_id && (
              <Button className="mt-2" type="submit" disabled={!nextValue}>
                Envoyer
              </Button>
            ))}
        </div>
      </nextOwnerFetcher.Form>
      {!fei.fei_next_owner_user_id && !nextValue && (
        <>
          <searchUserFetcher.Form
            className="fr-fieldset__element relative flex w-full flex-row items-end gap-4"
            method="POST"
          >
            <input type="hidden" name="route" value="/api/fei-trouver-premier-detenteur" />
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
            <Button type="submit" disabled={searchUserFetcher.state !== "idle"}>
              {searchUserFetcher.state === "idle" ? "Envoyer" : "Recherche en cours..."}
            </Button>
            {!isOnline && (
              <div className="absolute inset-0 z-50 flex items-end bg-white/70">
                <p className="bg-action-high-blue-france px-4 py-2 text-sm text-white">
                  ✋ ❌ Cette fonctionnalité n'existe pas encore sans connexion internet.
                </p>
              </div>
            )}
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

      {fei.fei_next_owner_user_id && (
        <Alert
          severity="success"
          description={`${nextOwnerName} a été notifié. Vous ne pouvez plus modifier votre fiche.`}
          title="Attribution effectuée"
        />
      )}
    </>
  );
}

type NextOwnerOptionProps = {
  potentielOwner: SerializeFrom<User> | SerializeFrom<Entity>;
  user: SerializeFrom<User>;
  nextOwnerIsEntity?: boolean;
  nextOwnerIsUser?: boolean;
};

const NextOwnerOption = ({ potentielOwner, nextOwnerIsEntity, nextOwnerIsUser, user }: NextOwnerOptionProps) => {
  let label = "";
  if (nextOwnerIsEntity) {
    potentielOwner = potentielOwner as unknown as SerializeFrom<Entity>;
    label = `${potentielOwner.nom_d_usage}`;
    if (potentielOwner.code_postal) {
      label += ` - ${potentielOwner.code_postal} ${potentielOwner.ville}`;
    }
  }
  if (nextOwnerIsUser) {
    potentielOwner = potentielOwner as unknown as SerializeFrom<User>;
    label = `${potentielOwner.prenom} ${potentielOwner.nom_de_famille}`;
    if (potentielOwner.code_postal) {
      label += ` - ${potentielOwner.code_postal} ${potentielOwner.ville}`;
    }
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
