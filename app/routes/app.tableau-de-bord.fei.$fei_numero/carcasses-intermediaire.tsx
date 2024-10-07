import { useFetcher, useLoaderData } from "@remix-run/react";
import { Fragment, useMemo, useState } from "react";
import { clientLoader } from "./route";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Prisma, Carcasse } from "@prisma/client";
import refusIntermedaire from "~/data/refus-intermediaire.json";
import dayjs from "dayjs";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import type { SerializeFrom } from "@remix-run/node";
import InputForSearchPrefilledData from "~/components/InputForSearchPrefilledData";
import { mergeCarcasseIntermediaire } from "~/db/carcasse-intermediaire.client";

const style = {
  boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
};

export default function CarcassesIntermediaire({
  canEdit,
  carcasses,
}: {
  canEdit: boolean;
  carcasses: SerializeFrom<Carcasse>[];
}) {
  return (
    <>
      {carcasses.map((carcasse, index, array) => {
        return (
          <Fragment key={carcasse.numero_bracelet}>
            <CarcasseAVerifier canEdit={canEdit} carcasse={carcasse} />
            {index < array.length - 1 && <hr />}
          </Fragment>
        );
      })}
    </>
  );
}

interface CarcasseAVerifierProps {
  carcasse: SerializeFrom<Carcasse>;
  canEdit: boolean;
}

function CarcasseAVerifier({ carcasse, canEdit }: CarcasseAVerifierProps) {
  const { fei, inetermediairesPopulated } = useLoaderData<typeof clientLoader>();
  const intermediaireCarcasseFetcher = useFetcher({ key: `intermediaire-carcasse-${carcasse.numero_bracelet}` });
  const carcasseFetcher = useFetcher({ key: `carcasse-from-intermediaire-${carcasse.numero_bracelet}` });
  const intermediaire = inetermediairesPopulated[0];
  const intermediaireCarcasse = useMemo(() => {
    return (
      intermediaire.carcasses[carcasse.numero_bracelet] ?? {
        fei_numero__bracelet__intermediaire_id: `${fei.numero}__${carcasse.numero_bracelet}__${intermediaire.id}`,
        fei_numero: fei.numero,
        numero_bracelet: carcasse.numero_bracelet,
        fei_intermediaire_id: intermediaire.id,
        fei_intermediaire_user_id: intermediaire.fei_intermediaire_user_id,
        fei_intermediaire_entity_id: intermediaire.fei_intermediaire_entity_id,
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString(),
        prise_en_charge: null,
        refus: null,
        commentaire: null,
        carcasse_check_finished_at: null,
        deleted_at: null,
      }
    );
  }, [intermediaire, carcasse, fei]);

  const [showRefuser, setShowRefuser] = useState(!!intermediaireCarcasse.refus);
  const [refus, setRefus] = useState(intermediaireCarcasse.refus ?? "");
  return (
    <Fragment key={carcasse.numero_bracelet}>
      <Notice
        className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\_\_title]:!block [&_p.fr-notice\_\_title]:before:hidden"
        key={carcasse.numero_bracelet}
        style={style}
        title={
          <span className="w-full !border-none !bg-none text-left !no-underline !shadow-none [&_*]:no-underline [&_*]:hover:no-underline">
            {carcasse.espece ? (
              <>
                <span className="block font-bold">
                  {carcasse.espece} - {carcasse.categorie}
                </span>
                <span className="block font-normal">Numéro de bracelet&nbsp;: {carcasse.numero_bracelet}</span>
                {!!carcasse.heure_mise_a_mort && (
                  <span className="block font-normal" suppressHydrationWarning>
                    Mise à mort&nbsp;: {dayjs(fei.date_mise_a_mort).format("DD/MM/YYYY")} {carcasse.heure_mise_a_mort}
                  </span>
                )}
                {!!carcasse.heure_evisceration && (
                  <span className="block font-normal" suppressHydrationWarning>
                    Éviscération&nbsp;: {dayjs(fei.date_mise_a_mort).format("DD/MM/YYYY")} {carcasse.heure_evisceration}
                  </span>
                )}
                <br />
                <>
                  {!carcasse.examinateur_anomalies_abats?.length ? (
                    <span className="m-0 block font-bold">Pas d'anomalie abats</span>
                  ) : (
                    <>
                      <span className="m-0 block font-bold">Anomalies abats:</span>
                      {carcasse.examinateur_anomalies_abats.map((anomalie) => {
                        return (
                          <>
                            <span className="m-0 ml-2 block font-bold">{anomalie}</span>
                          </>
                        );
                      })}
                    </>
                  )}
                </>
                <>
                  {!carcasse.examinateur_anomalies_carcasse?.length ? (
                    <span className="m-0 block font-bold">Pas d'anomalie carcasse</span>
                  ) : (
                    <>
                      <span className="m-0 block font-bold">Anomalies carcasse:</span>
                      {carcasse.examinateur_anomalies_carcasse.map((anomalie) => {
                        return (
                          <>
                            <span className="m-0 ml-2 block font-bold">{anomalie}</span>
                          </>
                        );
                      })}
                    </>
                  )}
                </>
                {!canEdit && intermediaireCarcasse.commentaire && (
                  <>
                    <br />
                    <span className="m-0 block font-bold">
                      Commentaire de l'examinateur&nbsp;:&nbsp;
                      <span className="m-0 font-normal">{intermediaireCarcasse.commentaire}</span>
                    </span>
                  </>
                )}
              </>
            ) : (
              <>
                <span className="block font-bold md:-mt-4">Nouvelle carcasse à examiner</span>
                <span className="block font-normal md:-mb-4">Numéro de bracelet&nbsp;: {carcasse.numero_bracelet}</span>
              </>
            )}
          </span>
        }
      />
      {canEdit && (
        <intermediaireCarcasseFetcher.Form
          method="POST"
          id={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
          onBlur={(e) => {
            console.log("submit or what");
            const form = new FormData(e.currentTarget);
            intermediaireCarcasseFetcher.submit(
              {
                ...mergeCarcasseIntermediaire(intermediaireCarcasse, form),
                route: `/api/fei-carcasse-intermediaire/${fei.numero}/${carcasse.numero_bracelet}/${intermediaire.id}`,
              },
              {
                method: "POST",
                preventScrollReset: true,
              },
            );
            if (form.get(Prisma.CarcasseIntermediaireScalarFieldEnum.refus) === "true") {
              // we do it server side too, to make sure good thiings happen
              // but we do it client side too to simplify code offline mode
              const carcasseForm = new FormData();
              carcasseForm.append(
                Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_commentaire,
                form.get(Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire) as string,
              );
              carcasseForm.append(
                Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif,
                form.get(Prisma.CarcasseIntermediaireScalarFieldEnum.refus) as string,
              );
              carcasseForm.append(
                Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id,
                intermediaire.id,
              );
              carcasseForm.append(
                Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_signed_at,
                new Date().toISOString(),
              );
              carcasseFetcher.submit(carcasseForm, {
                method: "POST",
                preventScrollReset: true,
              });
            }
            if (form.get(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge) === "true") {
              // we do it server side too, to make sure good thiings happen
              // but we do it client side too to simplify code offline mode
              const carcasseForm = new FormData();
              carcasseForm.append(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_commentaire, "");
              carcasseForm.append(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif, "");
              carcasseForm.append(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id, "");
              carcasseForm.append(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_signed_at, "");
              carcasseFetcher.submit(carcasseForm, {
                method: "POST",
                preventScrollReset: true,
              });
            }
          }}
        >
          <input
            type="hidden"
            name="route"
            value={`/api/fei-carcasse-intermediaire/${fei.numero}/${carcasse.numero_bracelet}/${intermediaire.id}`}
          />
          <input
            form={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
            type="hidden"
            name={Prisma.CarcasseIntermediaireScalarFieldEnum.fei_numero__bracelet__intermediaire_id}
            value={`${fei.numero}__${carcasse.numero_bracelet}__${intermediaire.id}`}
          />
          <input
            form={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
            type="hidden"
            name={Prisma.CarcasseIntermediaireScalarFieldEnum.fei_numero}
            value={fei.numero}
          />
          <input
            type="hidden"
            form={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
            name={Prisma.CarcasseIntermediaireScalarFieldEnum.numero_bracelet}
            value={carcasse.numero_bracelet}
          />
          <input
            type="hidden"
            form={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
            name={Prisma.CarcasseIntermediaireScalarFieldEnum.fei_intermediaire_id}
            value={intermediaire.id}
          />
          <input
            type="hidden"
            form={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
            name={Prisma.CarcasseIntermediaireScalarFieldEnum.fei_intermediaire_user_id}
            value={intermediaire.fei_intermediaire_user_id}
          />
          <input
            type="hidden"
            form={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
            name={Prisma.CarcasseIntermediaireScalarFieldEnum.fei_intermediaire_entity_id}
            value={intermediaire.fei_intermediaire_entity_id}
          />
          {!showRefuser ? (
            <>
              <input
                form={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
                type="hidden"
                name={Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge}
                value="true"
              />
              <input
                form={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
                type="hidden"
                name={Prisma.CarcasseIntermediaireScalarFieldEnum.refus}
                value=""
              />
              <div className="fr-fieldset__element">
                <Input
                  label="Commentaire"
                  hintText="Un commentaire à ajouter ?"
                  textArea
                  nativeTextAreaProps={{
                    name: Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire,
                    form: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
                    defaultValue: intermediaireCarcasse.commentaire || "",
                  }}
                />
              </div>
              <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
                <ButtonsGroup
                  buttons={
                    intermediaireCarcasse.prise_en_charge
                      ? [
                          {
                            children: "Refuser",
                            priority: "secondary",
                            type: "button",
                            nativeButtonProps: {
                              onClick: () => setShowRefuser(true),
                            },
                          },
                        ]
                      : [
                          {
                            children: "Accepter",
                            type: "submit",
                            nativeButtonProps: {
                              form: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
                            },
                          },
                          {
                            children: "Refuser",
                            type: "button",
                            nativeButtonProps: {
                              onClick: () => setShowRefuser(true),
                            },
                          },
                        ]
                  }
                />
              </div>
            </>
          ) : (
            <>
              <input
                form={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
                type="hidden"
                name={Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge}
                value="false"
              />
              <input
                form={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
                type="hidden"
                name={Prisma.CarcasseIntermediaireScalarFieldEnum.refus}
                value={refus}
              />
              <div className="fr-fieldset__element">
                <InputForSearchPrefilledData
                  canEdit
                  data={refusIntermedaire}
                  label="Motif du refus"
                  hideDataWhenNoSearch={false}
                  required
                  placeholder="Tapez un motif de refus"
                  onSelect={setRefus}
                  defaultValue={refus ?? ""}
                />
              </div>
              <div className="fr-fieldset__element">
                <Input
                  label="Commentaire"
                  hintText="Un commentaire à ajouter ?"
                  textArea
                  nativeTextAreaProps={{
                    name: Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire,
                    form: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
                    defaultValue: intermediaireCarcasse.commentaire || "",
                  }}
                />
              </div>
              <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
                <ButtonsGroup
                  buttons={
                    intermediaireCarcasse.refus
                      ? [
                          {
                            children: "Annuler",
                            priority: "secondary",
                            type: "button",
                            nativeButtonProps: {
                              onClick: () => setShowRefuser(false),
                            },
                          },
                        ]
                      : [
                          {
                            children: "Refuser",
                            type: "submit",
                            nativeButtonProps: {
                              form: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
                            },
                          },
                          {
                            children: "Annuler",
                            priority: "secondary",
                            type: "button",
                            nativeButtonProps: {
                              onClick: () => setShowRefuser(false),
                            },
                          },
                        ]
                  }
                />
              </div>
            </>
          )}
        </intermediaireCarcasseFetcher.Form>
      )}
    </Fragment>
  );
}
