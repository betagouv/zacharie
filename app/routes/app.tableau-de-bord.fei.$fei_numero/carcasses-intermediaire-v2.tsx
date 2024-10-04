import { useFetcher, useLoaderData } from "@remix-run/react";
import { Fragment, useState } from "react";
import { clientLoader } from "./route";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Prisma, Carcasse } from "@prisma/client";
import refusIntermedaire from "~/data/refus-intermediaire.json";
import dayjs from "dayjs";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import type { SerializeFrom } from "@remix-run/node";
import InputForSearchPrefilledData from "~/components/InputForSearchPrefilledData";

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
  const { fei } = useLoaderData<typeof clientLoader>();
  const intermediaireCarcasseFetcher = useFetcher({ key: `intermediaire-carcasse-${carcasse.numero_bracelet}` });
  const intermediaire = fei.FeiIntermediaires[0];
  const intermediaireCarcasse = intermediaire.CarcasseIntermediaire.find(
    (_intermediaireCarcasse) => _intermediaireCarcasse.numero_bracelet === carcasse.numero_bracelet,
  );

  const [showRefuser, setShowRefuser] = useState(!!intermediaireCarcasse?.refus);
  const [refus, setRefus] = useState(intermediaireCarcasse?.refus ?? "");
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
                <span className="m-0 block font-bold">
                  {carcasse.examinateur_anomalies_abats?.length || "Pas d'"} anomalie
                  {carcasse.examinateur_anomalies_abats?.length > 1 ? "s" : ""} abats
                </span>
                <span className="m-0 block font-bold">
                  {carcasse.examinateur_anomalies_carcasse?.length || "Pas d'"} anomalie
                  {carcasse.examinateur_anomalies_carcasse?.length > 1 ? "s" : ""} carcasse
                </span>
                {intermediaireCarcasse?.commentaire && (
                  <>
                    <br />
                    <span className="m-0 block font-bold">
                      Commentaire de l'examinateur&nbsp;:&nbsp;
                      <span className="m-0 font-normal">{intermediaireCarcasse?.commentaire}</span>
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
        <intermediaireCarcasseFetcher.Form method="POST" id={`intermediaire-carcasse-${carcasse.numero_bracelet}`}>
          <input
            type="hidden"
            name="route"
            value={`/api/action/carcasse-suivi/${carcasse.numero_bracelet}/${intermediaire.id}`}
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
                    defaultValue: intermediaireCarcasse?.commentaire || "",
                  }}
                />
              </div>
              <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
                <ButtonsGroup
                  buttons={
                    intermediaireCarcasse?.prise_en_charge
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
                    defaultValue: intermediaireCarcasse?.commentaire || "",
                  }}
                />
              </div>
              <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
                <ButtonsGroup
                  buttons={
                    intermediaireCarcasse?.refus
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
