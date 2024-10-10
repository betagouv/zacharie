import { useFetcher, useLoaderData } from "@remix-run/react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { clientLoader } from "./route";
import { type CarcasseIntermediaireActionData } from "~/routes/api.fei-carcasse-intermediaire.$fei_numero.$intermediaire_id.$numero_bracelet";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Prisma, type Carcasse, type CarcasseIntermediaire } from "@prisma/client";
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
  intermediaire,
}: {
  canEdit: boolean;
  carcasses: SerializeFrom<Carcasse>[];
  intermediaire: SerializeFrom<typeof clientLoader>["inetermediairesPopulated"][0];
}) {
  return (
    <>
      {carcasses.map((carcasse, index, array) => {
        return (
          <Fragment key={carcasse.numero_bracelet}>
            <CarcasseAVerifier intermediaire={intermediaire} canEdit={canEdit} carcasse={carcasse} />
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
  intermediaire: SerializeFrom<typeof clientLoader>["inetermediairesPopulated"][0];
}

function CarcasseAVerifier({ carcasse, canEdit, intermediaire }: CarcasseAVerifierProps) {
  const { fei } = useLoaderData<typeof clientLoader>();
  const intermediaireCarcasseFetcher = useFetcher<CarcasseIntermediaireActionData>({
    key: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
  });
  const formRef = useRef<HTMLFormElement>(null);
  const carcasseFetcher = useFetcher({ key: `carcasse-from-intermediaire-${carcasse.numero_bracelet}` });

  const intermediaireCarcasse: SerializeFrom<CarcasseIntermediaire> = useMemo(() => {
    if (intermediaireCarcasseFetcher.state === "loading") {
      if (intermediaireCarcasseFetcher.data?.data?.carcasseIntermediaire) {
        return intermediaireCarcasseFetcher.data.data.carcasseIntermediaire;
      }
    }
    if (intermediaire.carcasses[carcasse.numero_bracelet]) {
      return intermediaire.carcasses[carcasse.numero_bracelet];
    }
    return {
      fei_numero__bracelet__intermediaire_id: `${fei.numero}__${carcasse.numero_bracelet}__${intermediaire.id}`,
      fei_numero: fei.numero,
      numero_bracelet: carcasse.numero_bracelet,
      fei_intermediaire_id: intermediaire.id,
      fei_intermediaire_user_id: intermediaire.fei_intermediaire_user_id,
      fei_intermediaire_entity_id: intermediaire.fei_intermediaire_entity_id,
      created_at: dayjs().toISOString(),
      updated_at: dayjs().toISOString(),
      prise_en_charge: true,
      refus: null,
      commentaire: null,
      carcasse_check_finished_at: null,
      deleted_at: null,
    };
  }, [intermediaire, carcasse, fei, intermediaireCarcasseFetcher.state, intermediaireCarcasseFetcher.data]);

  const initiated = useRef(false);
  useEffect(() => {
    if (!intermediaire.carcasses[carcasse.numero_bracelet] && !initiated.current) {
      initiated.current = true;
      const nextIntermediaire = mergeCarcasseIntermediaire(intermediaireCarcasse);
      nextIntermediaire.append(
        "route",
        `/api/fei-carcasse-intermediaire/${fei.numero}/${intermediaire.id}/${carcasse.numero_bracelet}`,
      );
      intermediaireCarcasseFetcher.submit(nextIntermediaire, {
        method: "POST",
        preventScrollReset: true,
      });
    }
  }, [intermediaire, carcasse, fei, intermediaireCarcasseFetcher, intermediaireCarcasse]);

  const [showRefuser, setShowRefuser] = useState(!!intermediaireCarcasse.refus);
  const [refus, setRefus] = useState(intermediaireCarcasse.refus ?? "");

  return (
    <div
      key={carcasse.numero_bracelet}
      className={[
        "border-4 border-transparent p-4",
        !!intermediaireCarcasse.refus && "!border-red-500",
        intermediaireCarcasse.prise_en_charge && "!border-action-high-blue-france",
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
                            <span className="m-0 ml-2 block font-normal">{anomalie}</span>
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
                            <span className="m-0 ml-2 block font-normal">{anomalie}</span>
                          </>
                        );
                      })}
                    </>
                  )}
                </>
                {!canEdit && intermediaireCarcasse.refus && (
                  <>
                    <br />
                    <span className="m-0 block font-bold">
                      Motif du refus de l'examinateur&nbsp;:&nbsp;
                      <br />
                      <span className="m-0 ml-2 block font-normal">{intermediaireCarcasse.refus}</span>
                    </span>
                  </>
                )}
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
          ref={formRef}
          id={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
        >
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
              <div className="fr-fieldset__element">
                <Input
                  label="Commentaire"
                  hintText="Un commentaire à ajouter ?"
                  textArea
                  nativeTextAreaProps={{
                    name: Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire,
                    form: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
                    defaultValue: intermediaireCarcasse.commentaire || "",
                    onBlur: (e) => {
                      console.log("submit comment");
                      const form = new FormData();
                      form.append(Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire, e.target.value);
                      console.log("form", Object.fromEntries(form));
                      const nextIntermediaire = mergeCarcasseIntermediaire(intermediaireCarcasse, form);
                      nextIntermediaire.append(
                        "route",
                        `/api/fei-carcasse-intermediaire/${fei.numero}/${intermediaire.id}/${carcasse.numero_bracelet}`,
                      );
                      intermediaireCarcasseFetcher.submit(nextIntermediaire, {
                        method: "POST",
                        preventScrollReset: true,
                      });
                    },
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
                              onClick: (e) => {
                                console.log("submit accept");
                                e.preventDefault();
                                const form = new FormData(formRef.current!);
                                form.append(Prisma.CarcasseIntermediaireScalarFieldEnum.refus, "");
                                form.append(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge, "true");

                                const nextIntermediaire = mergeCarcasseIntermediaire(intermediaireCarcasse, form);
                                nextIntermediaire.append(
                                  "route",
                                  `/api/fei-carcasse-intermediaire/${fei.numero}/${intermediaire.id}/${carcasse.numero_bracelet}`,
                                );
                                intermediaireCarcasseFetcher.submit(nextIntermediaire, {
                                  method: "POST",
                                  preventScrollReset: true,
                                });

                                // we do it server side too, to make sure good thiings happen
                                // but we do it client side too to simplify code offline mode
                                const carcasseForm = new FormData();
                                carcasseForm.append(
                                  Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_commentaire,
                                  "",
                                );
                                carcasseForm.append(
                                  Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif,
                                  "",
                                );
                                carcasseForm.append(
                                  Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id,
                                  "",
                                );
                                carcasseForm.append(
                                  Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_signed_at,
                                  "",
                                );
                                carcasseForm.append(
                                  "route",
                                  `/api/fei-carcasse/${fei.numero}/${carcasse.numero_bracelet}`,
                                );
                                carcasseFetcher.submit(carcasseForm, {
                                  method: "POST",
                                  preventScrollReset: true,
                                });
                              },
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
                name={Prisma.CarcasseIntermediaireScalarFieldEnum.refus}
                value={refus}
              />
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
              <Input
                label="Commentaire"
                hintText="Un commentaire à ajouter ?"
                textArea
                nativeTextAreaProps={{
                  name: Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire,
                  form: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
                  defaultValue: intermediaireCarcasse.commentaire || "",
                  onBlur: (e) => {
                    console.log("submit comment");
                    const form = new FormData();
                    form.append(Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire, e.target.value);
                    console.log("form", Object.fromEntries(form));
                    const nextIntermediaire = mergeCarcasseIntermediaire(intermediaireCarcasse, form);
                    nextIntermediaire.append(
                      "route",
                      `/api/fei-carcasse-intermediaire/${fei.numero}/${intermediaire.id}/${carcasse.numero_bracelet}`,
                    );
                    intermediaireCarcasseFetcher.submit(nextIntermediaire, {
                      method: "POST",
                      preventScrollReset: true,
                    });
                  },
                }}
              />
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
                              onClick: (e) => {
                                console.log("submit refus");
                                e.preventDefault();
                                const form = new FormData(formRef.current!);
                                form.append(Prisma.CarcasseIntermediaireScalarFieldEnum.refus, refus);
                                form.append(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge, "false");
                                const nextIntermediaire = mergeCarcasseIntermediaire(intermediaireCarcasse, form);
                                nextIntermediaire.append(
                                  "route",
                                  `/api/fei-carcasse-intermediaire/${fei.numero}/${intermediaire.id}/${carcasse.numero_bracelet}`,
                                );
                                console.log("nextIntermediaire", Object.fromEntries(nextIntermediaire));
                                intermediaireCarcasseFetcher.submit(nextIntermediaire, {
                                  method: "POST",
                                  preventScrollReset: true,
                                });

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
                                carcasseForm.append(
                                  "route",
                                  `/api/fei-carcasse/${fei.numero}/${carcasse.numero_bracelet}`,
                                );
                                carcasseFetcher.submit(carcasseForm, {
                                  method: "POST",
                                  preventScrollReset: true,
                                });
                              },
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
    </div>
  );
}
