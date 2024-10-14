import { useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { clientLoader } from "./route";
import { Prisma, Entity, User, UserRoles } from "@prisma/client";
import { Button } from "@codegouvfr/react-dsfr/Button";
import type { SerializeFrom } from "@remix-run/node";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { action as searchUserAction } from "~/routes/api.fei-trouver-premier-detenteur";
import { useIsOnline } from "~/components/OfflineMode";
import { mergeFei } from "~/db/fei.client";

export default function SelectPremierDetenteur() {
  const {
    user,
    relationsCatalog: { detenteursInitiaux },
    fei,
  } = useLoaderData<typeof clientLoader>();
  const isOnline = useIsOnline();
  const nextOwnerSelectLabel = "Sélectionnez le Premier Détenteur de pour cette FEI";

  const nextOwnerName = useMemo(() => {
    const nextOwner = detenteursInitiaux.find((owner) => {
      return owner.id === fei.fei_next_owner_user_id;
    }) as SerializeFrom<User>;
    return `${nextOwner?.prenom} ${nextOwner?.nom_de_famille}`;
  }, [detenteursInitiaux, fei.fei_next_owner_user_id]);

  const nextOwnerFetcher = useFetcher({ key: "select-next-premier-detenteur" });
  const searchUserFetcher = useFetcher<typeof searchUserAction>({ key: "search-user" });
  const [nextValue, setNextValue] = useState(fei.fei_next_owner_user_id ?? "");

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
          if (formData.get(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id) === fei.fei_current_owner_user_id) {
            formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id, "");
            formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_role, "");
            formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id, "");
            formData.append(Prisma.FeiScalarFieldEnum.fei_current_owner_role, UserRoles.PREMIER_DETENTEUR);
          }
          const nextFei = mergeFei(fei, formData);
          nextFei.append("route", `/api/fei/${fei.numero}`);
          nextOwnerFetcher.submit(nextFei, {
            method: "POST",
            preventScrollReset: true,
          });
          window.scrollTo(0, 0);
        }}
      >
        <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
        <input type="hidden" name={Prisma.FeiScalarFieldEnum.fei_next_owner_role} value={UserRoles.PREMIER_DETENTEUR} />
        <div className="fr-fieldset__element grow">
          <Select
            label="Quel Premier Détenteur doit désormais agir sur la FEI ?"
            className="!mb-0 grow"
            key={fei.fei_next_owner_user_id ?? "no-choice-yet"}
            nativeSelectProps={{
              name: Prisma.FeiScalarFieldEnum.fei_next_owner_user_id,
              value: nextValue,
              onChange: (event) => {
                setNextValue(event.target.value);
              },
            }}
          >
            <option value="">{nextOwnerSelectLabel}</option>
            {detenteursInitiaux.map((potentielOwner) => {
              return <NextOwnerOption key={potentielOwner.id} potentielOwner={potentielOwner} user={user} />;
            })}
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
          description={`${nextOwnerName} a été notifié. Vous ne pouvez plus modifier votre FEI.`}
          title="Attribution effectuée"
        />
      )}
    </>
  );
}

type NextOwnerOptionProps = {
  potentielOwner: SerializeFrom<User> | SerializeFrom<Entity>;
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
