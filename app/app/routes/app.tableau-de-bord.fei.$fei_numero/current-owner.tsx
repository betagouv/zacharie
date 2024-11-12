import { useMemo } from "react";
import { Highlight } from "@codegouvfr/react-dsfr/Highlight";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { clientLoader } from "./route";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { getUserRoleLabelPrefixed } from "@app/utils/get-user-roles-label";
import { UserRoles } from "@prisma/client";
import DeleteButtonAndConfirmModal from "@app/components/DeleteButtonAndConfirmModal";

export default function CurrentOwner() {
  const { fei, currentOwnerUser, currentOwnerEntity, user } = useLoaderData<typeof clientLoader>();

  const navigate = useNavigate();
  const deleteFeiFetcher = useFetcher({ key: "delete-fei" });

  const canDeleteFei = useMemo(() => {
    if (user.roles.includes(UserRoles.ADMIN)) {
      return true;
    }
    if (!user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
      return false;
    }
    return fei.fei_current_owner_user_id === user.id;
  }, [user.roles, fei.fei_current_owner_user_id, user.id]);

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
        Cette fiche est présentement sous la responsabilité{" "}
        <b>{getUserRoleLabelPrefixed(fei.fei_current_owner_role as UserRoles)}</b>.<br />
        {currentOwnerEntity?.nom_d_usage && (
          <>
            <b>{currentOwnerEntity.nom_d_usage}</b> - {currentOwnerEntity.code_postal} {currentOwnerEntity.ville}
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
      {canDeleteFei && (
        <div className="mt-2 flex justify-start border-l-4 border-l-red-500 pl-8">
          <DeleteButtonAndConfirmModal
            title="Supprimer la fiche"
            buttonText="Supprimer la fiche"
            textToConfirm="SUPPRIMER LA FICHE"
            onConfirm={() => {
              deleteFeiFetcher.submit(
                {
                  _action: "delete",
                  route: `/api/fei/${fei.numero}`,
                  numero: fei.numero,
                },
                {
                  method: "POST",
                  preventScrollReset: true,
                },
              );
              navigate(-1);
            }}
          />
        </div>
      )}
    </div>
  );
}
