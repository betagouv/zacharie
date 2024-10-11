import { useFetcher, useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import { clientLoader } from "./route";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Prisma, Carcasse, CarcasseType } from "@prisma/client";
import saisieSvi from "~/data/saisie-svi.json";
import dayjs from "dayjs";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import type { SerializeFrom } from "@remix-run/node";
import InputForSearchPrefilledData from "~/components/InputForSearchPrefilledData";

const style = {
  boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
};

export default function CarcassesSvi({
  canEdit,
  carcasses,
}: {
  canEdit: boolean;
  carcasses: SerializeFrom<Carcasse>[];
}) {
  return (
    <>
      {carcasses.map((carcasse) => {
        return <CarcasseAVerifier canEdit={canEdit} key={carcasse.numero_bracelet} carcasse={carcasse} />;
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
  const sviCarcasseFetcher = useFetcher({ key: `svi-carcasse-${carcasse.numero_bracelet}` });

  const [showSaisir, setShowSaisir] = useState(!!carcasse?.svi_carcasse_saisie);
  const [motifsSaisie, setMotifsSaisie] = useState(carcasse?.svi_carcasse_saisie_motif?.filter(Boolean) ?? []);
  const priseEnCharge = !carcasse.svi_carcasse_saisie;
  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const intermediaire of inetermediairesPopulated) {
      const intermediaireCarcasse = intermediaire.carcasses[carcasse.numero_bracelet];
      if (intermediaireCarcasse?.commentaire) {
        commentaires.push(`${intermediaire.entity?.raison_sociale}: ${intermediaireCarcasse?.commentaire}`);
      }
    }
    return commentaires;
  }, [inetermediairesPopulated, carcasse]);

  return (
    <div
      key={carcasse.updated_at}
      className={[
        "border-4 border-transparent p-4",
        !!carcasse.svi_carcasse_saisie && "!border-red-500",
        priseEnCharge && "!border-action-high-blue-france",
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
            <span className="block font-bold">
              {carcasse.espece} - {carcasse.categorie}
            </span>
            <span className="block font-normal">Numéro de bracelet&nbsp;: {carcasse.numero_bracelet}</span>
            {carcasse.type === CarcasseType.PETIT_GIBIER && (
              <span className="block font-normal">
                Nombre de carcasses dans le lot&nbsp;: {carcasse.nombre_d_animaux || "À REMPLIR"}
              </span>
            )}
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
            <span className="m-0 block font-bold">Examen Initial&nbsp;:</span>
            <span className="list-inside list-disc">
              {carcasse.type === CarcasseType.GROS_GIBIER && (
                <span className="m-0 block pl-2 font-medium">
                  {carcasse.examinateur_anomalies_abats?.length === 0 ? (
                    "- Pas d'anomalie abats"
                  ) : (
                    <span className="m-0 block pl-2 font-medium">
                      - Anomalies abats&nbsp;:
                      {carcasse.examinateur_anomalies_abats.map((anomalie, index) => (
                        <span className="m-0 block font-medium" key={anomalie + index}>
                          - {anomalie}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              )}
              <span className="m-0 block pl-2 font-medium">
                {carcasse.examinateur_anomalies_carcasse?.length === 0 ? (
                  "- Pas d'anomalie carcasse"
                ) : (
                  <span className="m-0 block pl-2 font-medium">
                    - Anomalies carcasse&nbsp;:
                    {carcasse.examinateur_anomalies_carcasse.map((anomalie, index) => (
                      <span className="m-0 block font-medium" key={anomalie + index}>
                        - {anomalie}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </span>
            <br />
            {commentairesIntermediaires.length > 0 && (
              <>
                <span className="m-0 block font-bold">Commentaires des intermédiaires&nbsp;:</span>
                {commentairesIntermediaires.map((commentaire, index) => (
                  <span
                    className="m-0 ml-2 block border-l-2 border-l-gray-400 pl-4 font-medium"
                    key={commentaire + index}
                  >
                    {commentaire}
                  </span>
                ))}
                <br />
              </>
            )}
            {(!canEdit || motifsSaisie.length > 0) && (
              <span className="m-0 block font-bold" key={JSON.stringify(carcasse.svi_carcasse_saisie_motif)}>
                Inspection SVI&nbsp;:
                {motifsSaisie.length > 0 ? (
                  <>
                    {motifsSaisie.map((motif, index) => {
                      if (canEdit) {
                        return (
                          <span
                            className="m-0 ml-2 flex items-center justify-between border-b border-b-gray-300 font-medium"
                            key={motif + index}
                          >
                            - {motif}
                            <button
                              className="block px-4 py-1 font-medium"
                              title="Supprimer"
                              key={motif + index}
                              onClick={() => {
                                setMotifsSaisie((motifsSaisie) => {
                                  return motifsSaisie.filter((motifSaisie) => motifSaisie !== motif);
                                });
                              }}
                            >
                              {`\u0078`}
                            </button>
                          </span>
                        );
                      }
                      return (
                        <span className="m-0 ml-2 block font-medium" key={motif + index}>
                          - {motif}
                        </span>
                      );
                    })}
                  </>
                ) : (
                  <span className="m-0 ml-2 block font-medium">- Pas de saisie</span>
                )}
              </span>
            )}
            {!canEdit && carcasse.svi_carcasse_commentaire && (
              <>
                <br />
                <span className="m-0 block font-bold">Commentaire du SVI&nbsp;:</span>
                <span className="m-0 ml-2 block border-l-2 border-l-gray-400 pl-4 font-medium">
                  {carcasse.svi_carcasse_commentaire}
                </span>
              </>
            )}
          </span>
        }
      />
      {canEdit && (
        <sviCarcasseFetcher.Form method="POST" id={`svi-carcasse-${carcasse.numero_bracelet}`}>
          <input type="hidden" name="route" value={`/api/fei-carcasse/${fei.numero}/${carcasse.numero_bracelet}`} />
          <input
            form={`svi-carcasse-${carcasse.numero_bracelet}`}
            type="hidden"
            name={Prisma.CarcasseScalarFieldEnum.fei_numero}
            value={fei.numero}
          />
          <input
            type="hidden"
            form={`svi-carcasse-${carcasse.numero_bracelet}`}
            name={Prisma.CarcasseScalarFieldEnum.numero_bracelet}
            value={carcasse.numero_bracelet}
          />
          {!showSaisir ? (
            <>
              <input
                form={`svi-carcasse-${carcasse.numero_bracelet}`}
                type="hidden"
                name={Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie}
                value="false"
              />
              <input
                form={`svi-carcasse-${carcasse.numero_bracelet}`}
                type="hidden"
                name={Prisma.CarcasseScalarFieldEnum.svi_carcasse_signed_at}
                value={new Date().toISOString()}
              />
              <div className="fr-fieldset__element">
                <Input
                  label="Commentaire"
                  hintText="Un commentaire à ajouter ?"
                  textArea
                  nativeTextAreaProps={{
                    name: Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire,
                    form: `svi-carcasse-${carcasse.numero_bracelet}`,
                    defaultValue: carcasse?.svi_carcasse_commentaire || "",
                    onBlur: (e) => {
                      console.log("submit comment");
                      const form = new FormData();
                      form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire, e.target.value);
                      form.append("route", `/api/fei-carcasse/${fei.numero}/${carcasse.numero_bracelet}`);
                      form.append(Prisma.CarcasseScalarFieldEnum.fei_numero, fei.numero);
                      console.log("form", Object.fromEntries(form));
                      sviCarcasseFetcher.submit(form, {
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
                    !carcasse.svi_carcasse_saisie_motif?.length
                      ? [
                          {
                            children: "Saisir",
                            priority: "secondary",
                            type: "button",
                            nativeButtonProps: {
                              onClick: () => setShowSaisir(true),
                            },
                          },
                        ]
                      : [
                          {
                            children: "Accepter",
                            type: "submit",
                            nativeButtonProps: {
                              form: `svi-carcasse-${carcasse.numero_bracelet}`,
                              name: Prisma.CarcasseScalarFieldEnum.svi_carcasse_signed_at,
                              suppressHydrationWarning: true,
                              value: dayjs().toISOString(),
                            },
                          },
                          {
                            children: "Saisir",
                            priority: "secondary",
                            type: "button",
                            nativeButtonProps: {
                              onClick: () => setShowSaisir(true),
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
                form={`svi-carcasse-${carcasse.numero_bracelet}`}
                type="hidden"
                name={Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie}
                value="true"
              />
              {motifsSaisie.map((motifSaisie, index) => {
                return (
                  <input
                    key={motifSaisie + index}
                    form={`svi-carcasse-${carcasse.numero_bracelet}`}
                    type="hidden"
                    required
                    name={Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif}
                    value={motifSaisie}
                  />
                );
              })}
              <div className="fr-fieldset__element">
                <InputForSearchPrefilledData
                  canEdit
                  data={saisieSvi[carcasse.type ?? CarcasseType.GROS_GIBIER]}
                  label="Motif de la saisie"
                  hideDataWhenNoSearch
                  clearInputOnClick
                  placeholder="Commencez à taper un motif de saisie"
                  onSelect={(newMotifSaisie) => {
                    setMotifsSaisie([...motifsSaisie, newMotifSaisie]);
                  }}
                />
              </div>
              <div className="fr-fieldset__element">
                <Input
                  label="Commentaire"
                  hintText="Un commentaire à ajouter ?"
                  textArea
                  nativeTextAreaProps={{
                    name: Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire,
                    form: `svi-carcasse-${carcasse.numero_bracelet}`,
                    defaultValue: carcasse?.svi_carcasse_commentaire || "",
                    onBlur: (e) => {
                      console.log("submit comment");
                      const form = new FormData();
                      form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire, e.target.value);
                      form.append("route", `/api/fei-carcasse/${fei.numero}/${carcasse.numero_bracelet}`);
                      console.log("form", Object.fromEntries(form));
                      sviCarcasseFetcher.submit(form, {
                        method: "POST",
                        preventScrollReset: true,
                      });
                    },
                  }}
                />
              </div>
              <input
                form={`svi-carcasse-${carcasse.numero_bracelet}`}
                type="hidden"
                name={Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at}
                value={new Date().toISOString()}
              />
              <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
                <ButtonsGroup
                  buttons={
                    !motifsSaisie.length ||
                    JSON.stringify(carcasse.svi_carcasse_saisie_motif) !== JSON.stringify(motifsSaisie)
                      ? [
                          {
                            children: "Saisir",
                            type: "submit",
                            nativeButtonProps: {
                              onClick: (e) => {
                                console.log({ motifsSaisie });
                                if (!motifsSaisie.length) {
                                  e.preventDefault();
                                  alert("Veuillez ajouter au moins un motif de saisie");
                                  return;
                                }
                              },
                              form: `svi-carcasse-${carcasse.numero_bracelet}`,
                              name: Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at,
                              suppressHydrationWarning: true,
                              value: dayjs().toISOString(),
                            },
                          },
                          {
                            children: "Annuler",
                            priority: "secondary",
                            type: "button",
                            nativeButtonProps: {
                              onClick: () => setShowSaisir(false),
                            },
                          },
                        ]
                      : [
                          {
                            children: "Annuler",
                            priority: "secondary",
                            type: "button",
                            nativeButtonProps: {
                              onClick: () => setShowSaisir(false),
                            },
                          },
                        ]
                  }
                />
              </div>
            </>
          )}
        </sviCarcasseFetcher.Form>
      )}
    </div>
  );
}
