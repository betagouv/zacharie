import { useFetcher, useLoaderData } from "@remix-run/react";
import { Fragment, useState } from "react";
import { loader } from "./route";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Prisma, Carcasse } from "@prisma/client";
import saisieSvi from "~/data/saisie-svi.json";
import dayjs from "dayjs";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { SerializeFrom } from "@remix-run/node";
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
        return <CarcasseAVerifier canEdit={canEdit} key={carcasse.id} carcasse={carcasse} />;
      })}
    </>
  );
}

interface CarcasseAVerifierProps {
  carcasse: SerializeFrom<Carcasse>;
  canEdit: boolean;
}

function CarcasseAVerifier({ carcasse, canEdit }: CarcasseAVerifierProps) {
  const { fei } = useLoaderData<typeof loader>();
  const sviCarcasseFetcher = useFetcher({ key: `svi-carcasse-${carcasse.id}` });

  const [showSaisir, setShowSaisir] = useState(!!carcasse?.svi_carcasse_saisie);
  const [motifsSaisie, setMotifsSaisie] = useState(carcasse?.svi_carcasse_saisie_motif ?? []);
  return (
    <Fragment key={carcasse.id}>
      <Notice
        className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\_\_title]:!block [&_p.fr-notice\_\_title]:before:hidden"
        key={carcasse.id}
        style={style}
        title={
          <span className="w-full !border-none !bg-none text-left !no-underline !shadow-none [&_*]:no-underline [&_*]:hover:no-underline">
            <span className="block font-bold">
              {carcasse.espece} - {carcasse.categorie}
            </span>
            <span className="block font-normal">Numéro de bracelet&nbsp;: {carcasse.numero_bracelet}</span>
            {!!carcasse.heure_mise_a_mort && (
              <span className="block font-normal">
                Mise à mort&nbsp;: {dayjs(fei.date_mise_a_mort).format("DD/MM/YYYY")} {carcasse.heure_mise_a_mort}
              </span>
            )}
            {!!carcasse.heure_evisceration && (
              <span className="block font-normal">
                Éviscération&nbsp;: {dayjs(fei.date_mise_a_mort).format("DD/MM/YYYY")} {carcasse.heure_evisceration}
              </span>
            )}
            <br />
            <span className="m-0 block font-bold">Examen Initial&nbsp;:</span>
            <span className="list-inside list-disc">
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
            {motifsSaisie.length > 0 && (
              <>
                <br />
                <span className="m-0 block font-bold">
                  Saisie SVI&nbsp;:
                  {motifsSaisie.map((motif, index) => (
                    <span className="m-0 block font-medium" key={motif + index}>
                      - {motif}
                    </span>
                  ))}
                </span>
              </>
            )}
          </span>
        }
      />
      {canEdit && (
        <sviCarcasseFetcher.Form
          method="POST"
          action={`/action/carcasse/${carcasse.numero_bracelet}`}
          id={`svi-carcasse-${carcasse.id}`}
        >
          <input
            form={`svi-carcasse-${carcasse.id}`}
            type="hidden"
            name={Prisma.CarcasseScalarFieldEnum.fei_numero}
            value={fei.numero}
          />
          <input
            type="hidden"
            form={`svi-carcasse-${carcasse.id}`}
            name={Prisma.CarcasseScalarFieldEnum.numero_bracelet}
            value={carcasse.numero_bracelet}
          />
          {!showSaisir ? (
            <>
              <input
                form={`svi-carcasse-${carcasse.id}`}
                type="hidden"
                name={Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie}
                value="false"
              />
              <div className="fr-fieldset__element">
                <Input
                  label="Commentaire"
                  hintText="Un commentaire à ajouter ?"
                  textArea
                  nativeTextAreaProps={{
                    name: Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire,
                    form: `svi-carcasse-${carcasse.id}`,
                    defaultValue: carcasse?.svi_carcasse_commentaire || "",
                  }}
                />
              </div>
              <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
                <ButtonsGroup
                  buttons={[
                    {
                      children: "Accepter",
                      type: "submit",
                      nativeButtonProps: {
                        form: `svi-carcasse-${carcasse.id}`,
                        name: Prisma.CarcasseScalarFieldEnum.svi_carcasse_signed_at,
                        value: new Date().toISOString(),
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
                  ]}
                />
              </div>
            </>
          ) : (
            <>
              <input
                form={`svi-carcasse-${carcasse.id}`}
                type="hidden"
                name={Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie}
                value="true"
              />
              {motifsSaisie.map((motifSaisie, index) => {
                return (
                  <input
                    key={motifSaisie + index}
                    form={`svi-carcasse-${carcasse.id}`}
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
                  data={saisieSvi}
                  label="Motif de la sasie"
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
                    form: `svi-carcasse-${carcasse.id}`,
                    defaultValue: carcasse?.svi_carcasse_commentaire || "",
                  }}
                />
              </div>
              <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
                <ButtonsGroup
                  buttons={[
                    {
                      children: "Saisir",
                      type: "submit",
                      nativeButtonProps: {
                        form: `svi-carcasse-${carcasse.id}`,
                        name: Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at,
                        value: new Date().toISOString(),
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
                  ]}
                />
              </div>
            </>
          )}
        </sviCarcasseFetcher.Form>
      )}
    </Fragment>
  );
}
