import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { Fragment, useState } from "react";
import { loader } from "./route";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Prisma, Carcasse } from "@prisma/client";
import refusIntermedaire from "~/data/refus-intermediaire.json";
import dayjs from "dayjs";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { SerializeFrom } from "@remix-run/node";
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

function CarcasseAVerifier({ carcasse }: CarcasseAVerifierProps) {
  const { fei } = useLoaderData<typeof loader>();
  const intermediaireCarcasseFetcher = useFetcher({ key: `intermediaire-carcasse-${carcasse.id}` });
  const intermediaire = fei.FeiIntermediaires[0];
  const intermediaireCarcasse = intermediaire.CarcasseIntermediaire.find(
    (_intermediaireCarcasse) => _intermediaireCarcasse.numero_bracelet === carcasse.numero_bracelet,
  );

  console.log({ carcasse, intermediaireCarcasse, intermediaire });

  const [showRefuser, setShowRefuser] = useState(!!intermediaireCarcasse?.refus);
  const [refus, setRefus] = useState(intermediaireCarcasse?.refus ?? "");
  console.log({ carcasse, intermediaireCarcasse, refus });
  return (
    <Fragment key={carcasse.id}>
      <Notice
        className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\\_\\_title]:before:hidden"
        key={carcasse.id}
        style={style}
        title={
          <Link
            to={`/tableau-de-bord/carcasse/${fei.numero}/${carcasse.numero_bracelet}`}
            className="w-full !border-none !bg-none text-left !no-underline !shadow-none md:pl-8 [&_*]:no-underline [&_*]:hover:no-underline"
          >
            {carcasse.espece ? (
              <>
                <span className="block font-bold md:-mt-4">
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
                <span className="m-0 block font-bold">
                  {carcasse.examinateur_anomalies_abats?.length || "Pas d'"} anomalies abats
                </span>
                <span className="m-0 block font-bold md:-mb-4">
                  {carcasse.examinateur_anomalies_carcasse?.length || "Pas d'"} anomalies carcasse
                </span>
              </>
            ) : (
              <>
                <span className="block font-bold md:-mt-4">Nouvelle carcasse à examiner</span>
                <span className="block font-normal md:-mb-4">Numéro de bracelet&nbsp;: {carcasse.numero_bracelet}</span>
              </>
            )}
          </Link>
        }
      />
      <intermediaireCarcasseFetcher.Form
        method="POST"
        action="/action/carcasse-suivi"
        id={`intermediaire-carcasse-${carcasse.id}`}
      >
        <input
          form={`intermediaire-carcasse-${carcasse.id}`}
          type="hidden"
          name={Prisma.CarcasseIntermediaireScalarFieldEnum.fei_numero}
          value={fei.numero}
        />
        <input
          type="hidden"
          form={`intermediaire-carcasse-${carcasse.id}`}
          name={Prisma.CarcasseIntermediaireScalarFieldEnum.numero_bracelet}
          value={carcasse.numero_bracelet}
        />
        <input
          type="hidden"
          form={`intermediaire-carcasse-${carcasse.id}`}
          name={Prisma.CarcasseIntermediaireScalarFieldEnum.fei_intermediaire_id}
          value={intermediaire.id}
        />
        {!showRefuser ? (
          <>
            <input
              form={`intermediaire-carcasse-${carcasse.id}`}
              type="hidden"
              name={Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge}
              value="true"
            />
            <input
              form={`intermediaire-carcasse-${carcasse.id}`}
              type="hidden"
              name={Prisma.CarcasseIntermediaireScalarFieldEnum.refus}
              value=""
            />
            <Input
              label="Commentaire"
              hintText="Un commentaire à ajouter ?"
              textArea
              nativeTextAreaProps={{
                name: Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire,
                form: `intermediaire-carcasse-${carcasse.id}`,
                defaultValue: intermediaireCarcasse?.commentaire || "",
              }}
            />
            <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: "Accepter",
                    type: "submit",
                    nativeButtonProps: {
                      form: `intermediaire-carcasse-${carcasse.id}`,
                    },
                  },
                  {
                    children: "Refuser",
                    priority: "secondary",
                    type: "button",
                    nativeButtonProps: {
                      onClick: () => setShowRefuser(true),
                    },
                  },
                ]}
              />
            </div>
          </>
        ) : (
          <>
            <input
              form={`intermediaire-carcasse-${carcasse.id}`}
              type="hidden"
              name={Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge}
              value="false"
            />
            <input
              form={`intermediaire-carcasse-${carcasse.id}`}
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
                form: `intermediaire-carcasse-${carcasse.id}`,
                defaultValue: intermediaireCarcasse?.commentaire || "",
              }}
            />
            <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
              <ButtonsGroup
                buttons={[
                  {
                    children: "Refuser",
                    type: "submit",
                    nativeButtonProps: {
                      form: `intermediaire-carcasse-${carcasse.id}`,
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
                ]}
              />
            </div>
          </>
        )}
      </intermediaireCarcasseFetcher.Form>
    </Fragment>
  );
}