import { useMemo } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { clientLoader } from "./route";
import { Prisma, UserRoles, Entity, User } from "@prisma/client";
import { Button } from "@codegouvfr/react-dsfr/Button";
import type { SerializeFrom } from "@remix-run/node";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { action as searchUserAction } from "~/routes/action.trouver-premier-detenteur";

export default function SelectPremierDetenteur() {
  const { user, detenteursInitiaux, fei } = useLoaderData<typeof clientLoader>();
  const nextRole = UserRoles.PREMIER_DETENTEUR;
  const nextOwnerSelectLabel = "Sélectionnez le Premier Détenteur de pour cette FEI";

  const nextOwnerIsUser = nextRole === UserRoles.PREMIER_DETENTEUR || nextRole === UserRoles.EXAMINATEUR_INITIAL;

  const nextOwnerName = useMemo(() => {
    const nextOwner = detenteursInitiaux.find((owner) => {
      return owner.id === fei.fei_next_owner_user_id;
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
        onSubmit={(event) => {
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
          <Button className="mt-2" type="submit">
            Envoyer
          </Button>
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
