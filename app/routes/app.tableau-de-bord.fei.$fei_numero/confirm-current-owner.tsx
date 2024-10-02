import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { clientLoader } from "./route";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useMemo } from "react";
import { getUserRoleLabel } from "~/utils/get-user-roles-label";
import { Prisma, UserRoles } from "@prisma/client";

export default function ConfirmCurrentOwner() {
  const { user, entitiesUserIsWorkingFor, fei } = useLoaderData<typeof clientLoader>();

  const fetcher = useFetcher({ key: "confirm-current-owner" });
  const intermediaireFetcher = useFetcher({ key: "create-intermediaire-fetcher" });
  const nextEntity = useMemo(
    () => entitiesUserIsWorkingFor.find((entity) => entity.id === fei.fei_next_owner_entity_id),
    [entitiesUserIsWorkingFor, fei],
  );

  const canConfirmCurrentOwner = useMemo(() => {
    if (fei.fei_next_owner_user_id === user.id) {
      return true;
    }
    if (nextEntity) {
      return true;
    }
    return false;
  }, [fei, user, nextEntity]);

  if (!fei.fei_next_owner_role) {
    return null;
  }
  if (!canConfirmCurrentOwner) {
    return null;
  }

  function handlePriseEnCharge(transfer: boolean) {
    const formData = new FormData();
    formData.append(Prisma.FeiScalarFieldEnum.numero, fei.numero);
    formData.append(Prisma.FeiScalarFieldEnum.fei_current_owner_role, fei.fei_next_owner_role as string);
    formData.append(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id, fei.fei_next_owner_entity_id || "");
    formData.append(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id, fei.fei_next_owner_user_id || user.id);
    formData.append(Prisma.FeiScalarFieldEnum.fei_current_owner_wants_to_transfer, transfer ? "true" : "false");
    formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_role, "");
    formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id, "");
    formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id, "");
    formData.append(Prisma.FeiScalarFieldEnum.fei_prev_owner_role, fei.fei_current_owner_role || "");
    formData.append(Prisma.FeiScalarFieldEnum.fei_prev_owner_user_id, fei.fei_current_owner_user_id || "");
    formData.append(Prisma.FeiScalarFieldEnum.fei_prev_owner_entity_id, fei.fei_current_owner_entity_id || "");
    if (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_role) === UserRoles.EXAMINATEUR_INITIAL) {
      formData.append(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id, user.id);
    }
    if (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_role) === UserRoles.PREMIER_DETENTEUR) {
      formData.append(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id, user.id);
    }
    formData.append("route", `/api/action/fei/${fei.numero}`);
    formData.append(Prisma.FeiScalarFieldEnum.manually_updated_at, new Date().toISOString());
    fetcher.submit(formData, {
      method: "POST",
      preventScrollReset: true, // Prevent scroll reset on submission
    });

    const intermediaireRole: (keyof typeof UserRoles)[] = [UserRoles.COLLECTEUR_PRO, UserRoles.ETG, UserRoles.CCG];
    if (
      intermediaireRole.includes(
        formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_role) as keyof typeof UserRoles,
      )
    ) {
      const newInteremdaire = new FormData();
      newInteremdaire.append(Prisma.FeiIntermediaireScalarFieldEnum.fei_numero, fei.numero);
      newInteremdaire.append(Prisma.FeiIntermediaireScalarFieldEnum.fei_intermediaire_user_id, user.id);
      newInteremdaire.append(Prisma.FeiIntermediaireScalarFieldEnum.fei_intermediaire_role, fei.fei_next_owner_role!);
      newInteremdaire.append(
        Prisma.FeiIntermediaireScalarFieldEnum.fei_intermediaire_entity_id,
        fei.fei_next_owner_entity_id || "",
      );
      newInteremdaire.append("route", `/api/action/fei-intermediaire/nouveau`);
      intermediaireFetcher.submit(newInteremdaire, {
        method: "POST",
        preventScrollReset: true, // Prevent scroll reset on submission
      });
    }
  }

  return (
    <div className="bg-alt-blue-france pb-8">
      <CallOut
        title={
          fei.fei_next_owner_user_id
            ? "🫵  Cette FEI vous a été attribuée"
            : "🫵  Vous pouvez prendre en charge cette FEI"
        }
        className="m-0 bg-white"
      >
        En tant que <b>{getUserRoleLabel(fei.fei_next_owner_role)}</b>
        {fei.FeiNextEntity?.raison_sociale ? ` (${fei.FeiNextEntity?.raison_sociale})` : ""}, vous pouvez prendre en
        charge cette FEI et les carcasses associées.
        <br />
        <Button type="submit" className="my-4 block" onClick={() => handlePriseEnCharge(false)}>
          Je prends en charge cette FEI et les carcasses associées
        </Button>
        <span>
          Vous souhaitez la transférer à un autre acteur&nbsp;? (exemple: erreur d'attribution, assignation à un autre
          collecteur)
        </span>
        <Button priority="tertiary" type="button" className="!mt-2 block" onClick={() => handlePriseEnCharge(true)}>
          Transférer la FEI
        </Button>
        <span className="mt-4 inline-block text-sm">Vous souhaitez la renvoyer à l'expéditeur&nbsp;?</span>
        <Button
          priority="tertiary no outline"
          type="submit"
          className="!mt-0 text-sm"
          onClick={() => {
            const formData = new FormData();
            formData.append(Prisma.FeiScalarFieldEnum.numero, fei.numero);
            formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id, "");
            formData.append(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id, "");
            formData.append("route", `/api/action/fei/${fei.numero}`);
            formData.append(Prisma.FeiScalarFieldEnum.manually_updated_at, new Date().toISOString());
            fetcher.submit(formData, {
              method: "POST",
              preventScrollReset: true, // Prevent scroll reset on submission
            });
          }}
        >
          Renvoyer la FEI
        </Button>
      </CallOut>
    </div>
  );
}
