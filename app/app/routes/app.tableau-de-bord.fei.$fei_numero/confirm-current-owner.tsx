import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { clientLoader } from "./route";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useMemo } from "react";
import { getUserRoleLabel } from "@app/utils/get-user-roles-label";
import { Prisma, UserRoles } from "@prisma/client";
import dayjs from "dayjs";
import { mergeFeiIntermediaire } from "@app/db/fei-intermediaire.client";
import { mergeFei } from "@app/db/fei.client";

export default function ConfirmCurrentOwner() {
  const {
    user,
    relationsCatalog: { entitiesWorkingFor },
    fei,
    nextOwnerEntity,
  } = useLoaderData<typeof clientLoader>();

  const fetcher = useFetcher({ key: "confirm-current-owner" });
  const intermediaireFetcher = useFetcher({ key: "create-intermediaire-fetcher" });
  const nextEntity = useMemo(
    () => entitiesWorkingFor.find((entity) => entity.id === fei.fei_next_owner_entity_id),
    [entitiesWorkingFor, fei.fei_next_owner_entity_id],
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

  const needNextOwnerButNotMe = useMemo(() => {
    if (!fei.fei_next_owner_user_id && !fei.fei_next_owner_entity_id) {
      return false;
    }
    if (canConfirmCurrentOwner) {
      return false;
    }
    return true;
  }, [fei, canConfirmCurrentOwner]);

  if (!fei.fei_next_owner_role) {
    return null;
  }
  if (!canConfirmCurrentOwner) {
    if (needNextOwnerButNotMe) {
      return (
        <div className="bg-alt-blue-france pb-8">
          <div className="bg-white">
            <Alert
              severity="info"
              description={`Cette fiche a été attribuée à un intervenant que vous ne pouvez pas représenter.\u00a0C'est à elle ou lui d'intervenir.`}
              title="Fiche en attente de prise en charge par l'intervenant suivant."
            />
          </div>
        </div>
      );
    }
    return null;
  }

  function handlePriseEnCharge(transfer: boolean) {
    const formData = new FormData();
    formData.set(Prisma.FeiScalarFieldEnum.numero, fei.numero);
    formData.set(Prisma.FeiScalarFieldEnum.fei_current_owner_role, fei.fei_next_owner_role as string);
    formData.set(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id, fei.fei_next_owner_entity_id || "");
    formData.set(
      Prisma.FeiScalarFieldEnum.fei_current_owner_entity_name_cache,
      fei.fei_next_owner_entity_name_cache || "",
    );
    formData.set(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id, fei.fei_next_owner_user_id || user.id);
    formData.set(
      Prisma.FeiScalarFieldEnum.fei_current_owner_user_name_cache,
      fei.fei_next_owner_user_name_cache || `${user.prenom} ${user.nom_de_famille}`,
    );
    formData.set(Prisma.FeiScalarFieldEnum.fei_current_owner_wants_to_transfer, transfer ? "true" : "");
    formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_role, "");
    formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id, "");
    formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_user_name_cache, "");
    formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id, "");
    formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_name_cache, "");
    formData.set(Prisma.FeiScalarFieldEnum.fei_prev_owner_role, fei.fei_current_owner_role || "");
    formData.set(Prisma.FeiScalarFieldEnum.fei_prev_owner_user_id, fei.fei_current_owner_user_id || "");
    formData.set(Prisma.FeiScalarFieldEnum.fei_prev_owner_entity_id, fei.fei_current_owner_entity_id || "");
    if (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_role) === UserRoles.EXAMINATEUR_INITIAL) {
      formData.set(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id, user.id);
    }
    if (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_role) === UserRoles.PREMIER_DETENTEUR) {
      formData.set(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id, user.id);
    }
    if (formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_role) === UserRoles.SVI) {
      formData.set(Prisma.FeiScalarFieldEnum.svi_user_id, user.id);
    }
    const nextFei = mergeFei(fei, formData);
    nextFei.set("route", `/api/fei/${fei.numero}`);
    fetcher.submit(nextFei, {
      method: "POST",
      preventScrollReset: true, // Prevent scroll reset on submission
    });

    const intermediaireRole: (keyof typeof UserRoles)[] = [UserRoles.COLLECTEUR_PRO, UserRoles.ETG, UserRoles.CCG];
    if (
      intermediaireRole.includes(
        formData.get(Prisma.FeiScalarFieldEnum.fei_current_owner_role) as keyof typeof UserRoles,
      )
    ) {
      const newId = `${user.id}_${fei.numero}_${dayjs().format("HHmmss")}`;
      const newIntermediaire = mergeFeiIntermediaire({
        id: newId,
        fei_numero: fei.numero,
        fei_intermediaire_user_id: user.id,
        fei_intermediaire_role: fei.fei_next_owner_role!,
        fei_intermediaire_entity_id: fei.fei_next_owner_entity_id || "",
        check_finished_at: null,
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString(),
        commentaire: null,
        deleted_at: null,
        handover_at: null,
        received_at: null,
      });
      newIntermediaire.append("route", `/api/fei-intermediaire/${fei.numero}/${newId}`);
      intermediaireFetcher.submit(newIntermediaire, {
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
            ? "🫵  Cette fiche vous a été attribuée"
            : "🫵  Vous pouvez prendre en charge cette fiche"
        }
        className="m-0 bg-white"
      >
        En tant que <b>{getUserRoleLabel(fei.fei_next_owner_role)}</b>
        {nextOwnerEntity?.nom_d_usage ? ` (${nextOwnerEntity?.nom_d_usage})` : ""}, vous pouvez prendre en charge cette
        fiche et les carcasses associées.
        <br />
        <Button type="submit" className="my-4 block" onClick={() => handlePriseEnCharge(false)}>
          Je prends en charge cette fiche et les carcasses associées
        </Button>
        <span>
          Vous souhaitez la transférer à un autre acteur&nbsp;? (exemple: erreur d'attribution, assignation à un autre
          collecteur)
        </span>
        <Button priority="tertiary" type="button" className="!mt-2 block" onClick={() => handlePriseEnCharge(true)}>
          Transférer la fiche
        </Button>
        <span className="mt-4 inline-block text-sm">Vous souhaitez la renvoyer à l'expéditeur&nbsp;?</span>
        <Button
          priority="tertiary no outline"
          type="submit"
          className="!mt-0 text-sm"
          onClick={() => {
            const formData = new FormData();
            formData.set(Prisma.FeiScalarFieldEnum.numero, fei.numero);
            formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id, "");
            formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_name_cache, "");
            formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id, "");
            formData.set(Prisma.FeiScalarFieldEnum.fei_next_owner_user_name_cache, "");
            formData.set(Prisma.FeiScalarFieldEnum.numero, fei.numero);
            const nextFei = mergeFei(fei, formData);
            nextFei.set("route", `/api/fei/${fei.numero}`);
            fetcher.submit(nextFei, {
              method: "POST",
              preventScrollReset: true, // Prevent scroll reset on submission
            });
          }}
        >
          Renvoyer la fiche
        </Button>
      </CallOut>
    </div>
  );
}
