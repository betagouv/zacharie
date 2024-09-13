import { Highlight } from "@codegouvfr/react-dsfr/Highlight";
import { loader } from "./route";
import { useLoaderData } from "@remix-run/react";
import { getUserRoleLabelPrefixed } from "~/utils/get-user-roles-label";
import { UserRoles } from "@prisma/client";

export default function CurrentOwner() {
  const { fei } = useLoaderData<typeof loader>();

  return (
    <div className="bg-alt-blue-france pb-8">
      <Highlight
        className="m-0"
        classes={{
          root: "fr-highlight--green-emeraude",
        }}
      >
        Cette FEI est présentement sous la responsabilité
        <b> {getUserRoleLabelPrefixed(fei.fei_current_owner_role as UserRoles)}</b>.<br />
        {fei.FeiCurrentEntity?.raison_sociale && (
          <>
            <b>{fei.FeiCurrentEntity.raison_sociale}</b> - {fei.FeiCurrentEntity.code_postal}{" "}
            {fei.FeiCurrentEntity.ville}
            <br />
          </>
        )}
        {fei.FeiCurrentUser?.prenom && (
          <>
            <b>
              {fei.FeiCurrentUser.prenom} {fei.FeiCurrentUser.nom_de_famille}
            </b>
            {" - "}
            {fei.FeiCurrentUser.code_postal} {fei.FeiCurrentUser.ville}
            <br />
          </>
        )}
      </Highlight>
    </div>
  );
}
