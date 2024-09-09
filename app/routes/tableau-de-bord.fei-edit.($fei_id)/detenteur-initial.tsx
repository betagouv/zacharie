import { useCallback, useEffect, useState } from "react";
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { getUserFromCookie } from "~/services/auth.server";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Stepper } from "@codegouvfr/react-dsfr/Stepper";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { EntityTypes, RelationType, UserRoles, type Entity } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import { loader } from "./route";

export default function FEIDetenteurInitial() {
  const { user, fei } = useLoaderData<typeof loader>();
  const [meIsDetenteurInitial, setMeIsDetenteurInitial] = useState(false);

  return (
    <>
      <Checkbox
        options={[
          {
            label: "Je suis le Détenteur Initial de cette FEI",
            hintText: "Chasseur, société de chasse, association de chasse",
            nativeInputProps: {
              name: "detenteur_initial_id",
              defaultChecked: meIsDetenteurInitial,
              onChange: (e) => setMeIsDetenteurInitial(e.target.checked),
            },
          },
        ]}
      />
      <>
        <div className="fr-fieldset__element">
          <Input
            label="Date de mise à mort et d'éviscération"
            nativeInputProps={{
              id: "date_mise_a_mort",
              name: "date_mise_a_mort",
              type: "date",
              autoComplete: "off",
              defaultValue: fei?.date_mise_a_mort ?? new Date().toISOString().split("T")[0],
            }}
          />
        </div>
        <div className="fr-fieldset__element">
          <Input
            label="Commune de mise à mort"
            nativeInputProps={{
              id: "commune_mise_a_mort",
              name: "commune_mise_a_mort",
              type: "text",
              autoComplete: "off",
              defaultValue: fei?.commune_mise_a_mort ?? "",
            }}
          />
        </div>
      </>
    </>
  );
}
