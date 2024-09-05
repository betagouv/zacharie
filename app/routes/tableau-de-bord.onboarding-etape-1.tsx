import { json, LoaderFunctionArgs } from "@remix-run/node";
import { redirect, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { UserRoles } from "@prisma/client";
import { getUserOnboardingRoute } from "~/utils/user-onboarded.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) throw redirect("/connexion?type=compte-existant");
  if (!user?.roles?.length) {
    return json({ user });
  }
  const onboardingRoute = getUserOnboardingRoute(user);
  if (onboardingRoute) throw redirect(onboardingRoute);
  return redirect("/tableau-de-bord");
}

export default function TableauDeBord() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <div className="p-6">
      <Stepper currentStep={1} nextTitle="Votre identité" stepCount={3} title="Vos rôles" />
      <CallOut iconId="ri-information-line" title="Un seul compte pour toutes vos casquettes">
        Les acteurs de la chasse sont nombreux : examinateur, centre de collecte, etc. et parfois
        vous combinez plusieurs rôles. Zacharie vous permet de jongler entre tous très facilement.
        Lesquels êtes-vous ?
      </CallOut>
      <Checkbox
        legend="Sélectionnez tous les rôles qui vous correspondent"
        options={[
          {
            hintText: "Chasseur, société de chasse, association de chasse",
            label: "Détenteur initial",
            nativeInputProps: {
              name: UserRoles.DETENTEUR_INITIAL,
              value: UserRoles.DETENTEUR_INITIAL,
            },
          },
          {
            hintText:
              "Munissez-vous de votre numéro d'attestation (de la forme CFEI-DEP-YY-001) pour l'étape suivante",
            label: "Examinateur initial",
            nativeInputProps: {
              name: UserRoles.EXAMINATEUR_INITIAL,
              value: UserRoles.EXAMINATEUR_INITIAL,
            },
          },
          {
            hintText:
              "Local réfrigéré où le gibier en entreposé. Le nom de l'établissement sera demandé à l'étape suivante",
            label: "Exploitant d'un Centre de Collecte",
            nativeInputProps: {
              name: UserRoles.EXPLOITANT_CENTRE_COLLECTE,
              value: UserRoles.EXPLOITANT_CENTRE_COLLECTE,
            },
          },
          {
            hintText:
              "Récupère les carcasses et les livre aux ETG. Le nom de l'établissement sera demandé à l'étape suivante",
            label: "Collecteur Professionnel",
            nativeInputProps: {
              name: UserRoles.COLLECTEUR_PRO,
              value: UserRoles.COLLECTEUR_PRO,
            },
          },
          {
            hintText: "Le nom de l'établissement sera demandé à l'étape suivante",
            label: "Etablissement de Traitement du Gibier (ETG)",
            nativeInputProps: {
              name: UserRoles.ETG,
              value: UserRoles.ETG,
            },
          },
          {
            label: "Service Vétérinaire d'Inspection (SVI)",
            hintText: "Le nom de l'établissement sera demandé à l'étape suivante",
            nativeInputProps: {
              name: UserRoles.SVI,
              value: UserRoles.SVI,
            },
          },
          // {
          //   label: "Restaurateur",
          //   hintText:
          //     "Seulement pour les professionnels de la restauration qui cuisinent du gibier",
          //   nativeInputProps: {
          //     name: UserRoles.RESTAURATEUR,
          //     value: UserRoles.RESTAURATEUR,
          //   },
          // },
          // {
          //   label: "Boucher",
          //   hintText: "Seulement pour les bouchers qui reçoivent du gibier",
          //   nativeInputProps: {
          //     name: UserRoles.BOUCHER,
          //     value: UserRoles.BOUCHER,
          //   },
          // },
          // {
          //   label: "Repas de chasse ou associatif",
          //   nativeInputProps: {
          //     name: UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF,
          //     value: UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF,
          //   },
          // },
          // {
          //   label: "Consommateur final",
          //   hintText: "Vous êtes un particulier consommateur de gibier sauvage",
          //   nativeInputProps: {
          //     name: UserRoles.CONSOMMATEUR_FINAL,
          //     value: UserRoles.CONSOMMATEUR_FINAL,
          //   },
          // },
          // {
          //   label: "Commerce de détail",
          //   nativeInputProps: {
          //     name: UserRoles.COMMERCE_DE_DETAIL,
          //     value: UserRoles.COMMERCE_DE_DETAIL,
          //   },
          // },
        ]}
      />
    </div>
  );
}
