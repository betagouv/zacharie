import { useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { clientLoader } from "./route";
import { type CarcasseIntermediaireActionData } from "@api/routes/api.fei-carcasse-intermediaire.$fei_numero.$intermediaire_id.$numero_bracelet";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { CarcasseType, Prisma, type Carcasse, type CarcasseIntermediaire } from "@prisma/client";
import refusIntermedaire from "@app/data/refus-intermediaire.json";
import dayjs from "dayjs";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { RadioButtons } from "@codegouvfr/react-dsfr/RadioButtons";
import type { SerializeFrom } from "@remix-run/node";
import InputForSearchPrefilledData from "@app/components/InputForSearchPrefilledData";
import { mergeCarcasseIntermediaire } from "@app/db/carcasse-intermediaire.client";
import { CustomNotice } from "@app/components/CustomNotice";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { mergeCarcasse } from "@app/db/carcasse.client";

interface CarcasseIntermediaireProps {
  carcasse: SerializeFrom<Carcasse>;
  canEdit: boolean;
  intermediaire: SerializeFrom<typeof clientLoader>["inetermediairesPopulated"][0];
}

export default function CarcasseIntermediaire({ carcasse, canEdit, intermediaire }: CarcasseIntermediaireProps) {
  const { fei, inetermediairesPopulated } = useLoaderData<typeof clientLoader>();
  const intermediaireCarcasseFetcher = useFetcher<CarcasseIntermediaireActionData>({
    key: `intermediaire-carcasse-${carcasse.numero_bracelet}`,
  });

  const formRef = useRef<HTMLFormElement>(null);
  const carcasseFetcher = useFetcher({ key: `carcasse-from-intermediaire-${carcasse.numero_bracelet}` });

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const _intermediaire of inetermediairesPopulated) {
      const _intermediaireCarcasse = _intermediaire.carcasses[carcasse.numero_bracelet];
      if (_intermediaireCarcasse?.commentaire) {
        console.log("commentaire", `${_intermediaire.entity?.raison_sociale} : ${_intermediaireCarcasse?.commentaire}`);
        commentaires.push(
          `Commentaire de ${_intermediaire.entity?.raison_sociale} : ${_intermediaireCarcasse?.commentaire}`,
        );
      }
    }
    return commentaires;
  }, [inetermediairesPopulated, carcasse]);

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
      prise_en_charge: !carcasse.intermediaire_carcasse_manquante,
      manquante: carcasse.intermediaire_carcasse_manquante,
      refus: null,
      commentaire: null,
      carcasse_check_finished_at: null,
      deleted_at: null,
    };
  }, [intermediaire, carcasse, fei, intermediaireCarcasseFetcher.state, intermediaireCarcasseFetcher.data]);

  const refusIntermediaireModal = useRef(
    createModal({
      isOpenedByDefault: false,
      id: `refus-intermediaire-modal-carcasse-${intermediaireCarcasse.fei_numero__bracelet__intermediaire_id}`,
    }),
  );

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

  const [carcasseManquante, setCarcasseManquante] = useState(!!carcasse.intermediaire_carcasse_manquante);
  const [refus, setRefus] = useState(carcasse.intermediaire_carcasse_refus_motif ?? intermediaireCarcasse.refus ?? "");

  const Component = canEdit ? "button" : "div";

  return (
    <div
      key={carcasse.numero_bracelet}
      className={[
        "mb-2 border-4 border-transparent",
        !!refus && "!border-red-500",
        carcasseManquante && "!border-red-500",
        // intermediaireCarcasse.prise_en_charge && "!border-action-high-blue-france",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <CustomNotice
        key={carcasse.numero_bracelet}
        className={`${carcasse.type === CarcasseType.PETIT_GIBIER ? "!bg-gray-300" : ""}`}
      >
        <Component
          className="block w-full p-4 text-left [&_*]:no-underline [&_*]:hover:no-underline"
          type={canEdit ? "button" : undefined}
          onClick={canEdit ? () => refusIntermediaireModal.current.open() : undefined}
        >
          <span className="block font-bold">
            {carcasse.espece}
            {carcasse.categorie && ` - ${carcasse.categorie}`}
          </span>
          <span className="absolute right-8 top-2.5 block text-sm font-normal italic opacity-50">
            {carcasse.type === CarcasseType.PETIT_GIBIER ? "Petit gibier" : "Grand gibier"}
          </span>
          <span className="block font-normal">
            Numéro de bracelet&nbsp;: <span className="whitespace-nowrap">{carcasse.numero_bracelet}</span>
          </span>
          {carcasse.type === CarcasseType.PETIT_GIBIER && (
            <span className="block font-normal">
              Nombre de carcasses dans le lot&nbsp;: {carcasse.nombre_d_animaux || "À REMPLIR"}
            </span>
          )}
          {carcasse.intermediaire_carcasse_manquante && (
            <span className="ml-4 mt-4 block font-bold">Carcasse manquante</span>
          )}
          {carcasse.heure_evisceration && (
            <span className="block font-normal">Éviscération&nbsp;: {carcasse.heure_evisceration || "À REMPLIR"}</span>
          )}
          {!!carcasse.examinateur_anomalies_abats?.length && (
            <>
              <br />
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
          {!!carcasse.examinateur_anomalies_carcasse?.length && (
            <>
              <br />
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
          {commentairesIntermediaires.map((commentaire, index) => {
            return (
              <span key={commentaire + index} className="mt-2 block font-normal">
                {commentaire}
              </span>
            );
          })}
          {!!intermediaireCarcasse.refus && (
            <span className="mt-2 block font-normal">Motif de refus&nbsp;: {intermediaireCarcasse.refus}</span>
          )}
        </Component>
      </CustomNotice>
      {canEdit && (
        <refusIntermediaireModal.current.Component
          title={
            <>
              {carcasse.espece}
              <br />
              <small>
                {carcasse.type === CarcasseType.PETIT_GIBIER ? "Lot " : "Carcasse "} {carcasse.numero_bracelet}
              </small>
            </>
          }
        >
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
            <input
              form={`intermediaire-carcasse-${carcasse.numero_bracelet}`}
              type="hidden"
              name={Prisma.CarcasseIntermediaireScalarFieldEnum.refus}
              value={refus}
            />
            <div className="mt-4">
              <RadioButtons
                options={[
                  {
                    nativeInputProps: {
                      required: true,
                      name: Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante,
                      value: "false",
                      checked: !carcasseManquante,
                      onChange: () => {
                        setCarcasseManquante(false);
                      },
                    },
                    label: "Carcasse présente",
                  },
                  {
                    nativeInputProps: {
                      required: true,
                      name: Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante,
                      value: "true",
                      checked: carcasseManquante,
                      onChange: () => {
                        setCarcasseManquante(true);
                        refusIntermediaireModal.current.close();
                        setRefus("");
                        console.log("submit refus cannuler");
                        const form = new FormData(formRef.current!);
                        form.append(Prisma.CarcasseIntermediaireScalarFieldEnum.refus, "");
                        form.append(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge, "false");
                        form.append(Prisma.CarcasseIntermediaireScalarFieldEnum.manquante, "true");
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
                        carcasseForm.append(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante, "true");
                        carcasseForm.append(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif, "");
                        carcasseForm.append(
                          Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id,
                          intermediaire.id,
                        );
                        carcasseForm.append(
                          Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_signed_at,
                          new Date().toISOString(),
                        );
                        const nextCarcasseForm = mergeCarcasse(carcasse, carcasseForm);
                        nextCarcasseForm.append("route", `/api/fei-carcasse/${fei.numero}/${carcasse.numero_bracelet}`);
                        carcasseFetcher.submit(nextCarcasseForm, {
                          method: "POST",
                          preventScrollReset: true,
                        });
                      },
                    },
                    label: "Carcasse manquante",
                  },
                ]}
              />
            </div>
            <Input
              label="Commentaire"
              className="mt-2"
              hintText={
                carcasseManquante
                  ? `Un commentaire à ajouter\u00A0?`
                  : `Un commentaire à ajouter\u00A0? Une carcasse retirée\u00A0?`
              }
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
            {!carcasseManquante && (
              <div className="mb-2">
                <InputForSearchPrefilledData
                  canEdit
                  data={refusIntermedaire}
                  label="Vous refusez cette carcasse ? Indiquez le motif"
                  hideDataWhenNoSearch={false}
                  required
                  placeholder="Tapez un motif de refus"
                  onSelect={setRefus}
                  defaultValue={refus ?? ""}
                  key={refus ?? ""}
                />
              </div>
            )}

            <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
              <ButtonsGroup
                buttons={
                  intermediaireCarcasse.refus
                    ? [
                        {
                          children: "Enregistrer",
                          nativeButtonProps: {
                            onClick: () => {
                              refusIntermediaireModal.current.close();
                            },
                          },
                        },
                        {
                          children: "Annuler",
                          priority: "secondary",
                          type: "button",
                          nativeButtonProps: {
                            onClick: () => {
                              refusIntermediaireModal.current.close();
                              setRefus("");
                              console.log("submit refus cannuler");
                              const form = new FormData(formRef.current!);
                              form.append(Prisma.CarcasseIntermediaireScalarFieldEnum.refus, "");
                              form.append(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge, "true");
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
                                "",
                              );
                              carcasseForm.append(
                                Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif,
                                "",
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
                      ]
                    : [
                        {
                          children: carcasseManquante ? "Enregistrer" : "Refuser",
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
                              refusIntermediaireModal.current.close();
                            },
                          },
                        },
                        {
                          children: "Fermer",
                          priority: "secondary",
                          type: "button",
                          nativeButtonProps: {
                            onClick: () => refusIntermediaireModal.current.close(),
                          },
                        },
                      ]
                }
              />
            </div>
          </intermediaireCarcasseFetcher.Form>
        </refusIntermediaireModal.current.Component>
      )}
    </div>
  );
}
