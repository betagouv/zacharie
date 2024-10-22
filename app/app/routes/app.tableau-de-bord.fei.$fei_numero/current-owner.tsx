import { Highlight } from "@codegouvfr/react-dsfr/Highlight";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { clientLoader } from "./route";
import { useLoaderData } from "@remix-run/react";
import { getUserRoleLabelPrefixed } from "@app/utils/get-user-roles-label";
import { UserRoles } from "@prisma/client";

export default function CurrentOwner() {
  const { fei, currentOwnerUser, currentOwnerEntity } = useLoaderData<typeof clientLoader>();

  if (fei.svi_signed_at) {
    return (
      <div className="bg-alt-blue-france pb-8">
        <div className="bg-white">
          <Alert
            severity="success"
            description="Merci à l'ensemble des acteurs pour la prise en charge de cette fiche."
            title="Fiche clôturée"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-alt-blue-france pb-8">
      <Highlight
        className="m-0"
        classes={{
          root: "fr-highlight--green-emeraude",
        }}
      >
        Cette fiche est présentement sous la responsabilité
        <b> {getUserRoleLabelPrefixed(fei.fei_current_owner_role as UserRoles)}</b>.<br />
        {currentOwnerEntity?.raison_sociale && (
          <>
            <b>{currentOwnerEntity.raison_sociale}</b> - {currentOwnerEntity.code_postal} {currentOwnerEntity.ville}
            <br />
          </>
        )}
        {currentOwnerUser?.prenom && (
          <>
            <b>
              {currentOwnerUser.prenom} {currentOwnerUser.nom_de_famille}
            </b>
            {" - "}
            {currentOwnerUser.code_postal} {currentOwnerUser.ville}
            <br />
          </>
        )}
      </Highlight>
    </div>
  );
}
