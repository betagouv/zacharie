import { useFetcher, useLoaderData } from "@remix-run/react";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import { useIsModalOpen } from "@codegouvfr/react-dsfr/Modal/useIsModalOpen";
import { Carcasse, Prisma } from "@prisma/client";
import grandGibier from "~/data/grand-gibier.json";
import grandGibierCarcasse from "~/data/grand-gibier-carcasse.json";
import grandGibierAbats from "~/data/grand-gibier-abats.json";
import { useRef, useState } from "react";
import InputForSearchPrefilledData from "~/components/InputForSearchPrefilledData";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { SerializeFrom } from "@remix-run/node";
import { loader } from "./route";
import { Input } from "@codegouvfr/react-dsfr/Input";
import dayjs from "dayjs";
import e from "express";

const style = {
  boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
};

type CarcasseReadAndWrite = {
  carcasse: SerializeFrom<Carcasse>;
};

export default function CarcasseReadAndWrite({ carcasse }: CarcasseReadAndWrite) {
  const { fei } = useLoaderData<typeof loader>();
  const carcasseFetcher = useFetcher({ key: "carcasse-edit-fetcher" });
  const [heureEvisceration, setHeureEvisceration] = useState(carcasse.heure_evisceration);
  const [heureEviscerationValidated, setHeureEviscerationValidated] = useState(!!carcasse.heure_evisceration);
  const [heureMiseAMort, setHeureMiseAMort] = useState(carcasse.heure_mise_a_mort);
  const [heureMiseAMortValidated, setHeureMiseAMortValidated] = useState(!!carcasse.heure_mise_a_mort);
  const [espece, setEspece] = useState(carcasse.espece);
  const [categorie, setCategorie] = useState(carcasse.categorie);
  const [anomaliesAbats, setAnomaliesAbats] = useState<Array<string>>(carcasse.examinateur_anomalies_abats);
  const [anomaliesCarcasse, setAnomaliesCarcasse] = useState<Array<string>>(carcasse.examinateur_anomalies_carcasse);
  const [addAnomalieAbats, setAddAnomalieAbats] = useState(false);
  const [addAnomalieCarcasse, setAddAnomalieCarcasse] = useState(false);

  function reset() {
    setEspece("");
    setCategorie("");
    setAnomaliesAbats([]);
    setAnomaliesCarcasse([]);
    setAddAnomalieAbats(false);
    setAddAnomalieCarcasse(false);
  }

  const modal = useRef(
    createModal({
      id: carcasse.numero_bracelet,
      isOpenedByDefault: false,
    })
  ).current;

  useIsModalOpen(modal, {
    onDisclose: () => console.log("modal opened"),
  });

  const noAnomalie = !anomaliesAbats.length && !anomaliesCarcasse.length;

  return (
    <>
      <Notice
        className="fr-fieldset__element [&_p.fr-notice\_\_title]:before:hidden fr-text-default--grey fr-background-contrast--grey"
        key={carcasse.id}
        style={style}
        isClosable
        onClose={() => {
          if (window.confirm("Voulez-vous supprimer cette carcasse ? Cette opération est irréversible")) {
            carcasseFetcher.submit(
              {
                numero_bracelet: carcasse.numero_bracelet,
                _action: "delete",
              },
              {
                method: "POST",
                action: `/action/carcasse/${carcasse.numero_bracelet}`,
                preventScrollReset: true,
              }
            );
          }
        }}
        title={
          carcasse.espece ? (
            <button
              onClick={modal.open}
              className="p-0 m-0 border-none shadow-none text-left -my-4 -ml-8 py-4 pl-4 md:pl-8 w-full"
            >
              {carcasse.espece} - {carcasse.categorie}
              <br />
              <span className="block font-normal">Numéro de bracelet&nbsp;: {carcasse.numero_bracelet}</span>
              {!!carcasse.heure_mise_a_mort && (
                <span className="block font-normal">Mise à mort&nbsp;: {carcasse.heure_mise_a_mort}</span>
              )}
              {!!carcasse.heure_evisceration && (
                <span className="block font-normal">Éviscération&nbsp;: {carcasse.heure_evisceration}</span>
              )}
              <br />
              {carcasse.examinateur_anomalies_abats?.length || "Pas d'"} anomalies abats
              <br />
              {carcasse.examinateur_anomalies_carcasse?.length || "Pas d'"} anomalies carcasse
            </button>
          ) : (
            <button
              onClick={modal.open}
              className="p-0 m-0 border-none shadow-none text-left -my-4 -ml-8 py-4 pl-4 md:pl-8 w-full"
            >
              Nouvelle carcasse à examiner
              <br />
              Numéro de bracelet&nbsp;: {carcasse.numero_bracelet}
            </button>
          )
        }
      />
      <modal.Component
        title="🐗 Grand Gibier"
        size="large"
        buttons={
          !espece || !categorie
            ? [
                {
                  children: "Annuler",
                  priority: "tertiary",
                  doClosesModal: true,
                  onClick: () => {
                    modal.close();
                  },
                },
              ]
            : carcasse.espece
            ? [
                {
                  iconId: "ri-check-line",
                  doClosesModal: true,
                  onClick: () => {
                    modal.close();
                  },
                  nativeButtonProps: {
                    type: "submit",
                    form: "carcasse-edit-form",
                  },
                  children: noAnomalie ? "Enregistrer sans anomalie" : "Enregistrer",
                },
              ]
            : [
                {
                  children: "Annuler",
                  priority: "tertiary",
                  doClosesModal: true,
                  onClick: () => {
                    reset();
                    modal.close();
                  },
                },
                {
                  iconId: "ri-check-line",
                  doClosesModal: true,
                  onClick: () => {
                    modal.close();
                  },
                  nativeButtonProps: {
                    type: "submit",
                    form: "carcasse-edit-form",
                  },
                  children: noAnomalie ? "Enregistrer sans anomalie" : "Enregistrer",
                },
              ]
        }
      >
        <carcasseFetcher.Form
          id="carcasse-edit-form"
          className="py-2"
          method="POST"
          action={`/action/carcasse/${carcasse.numero_bracelet}`}
        >
          <div className="min-h-[75vh] md:min-h-0">
            <input type="hidden" name={Prisma.CarcasseScalarFieldEnum.fei_numero} value={fei.numero} />
            <input type="hidden" name={Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort} value={heureMiseAMort || ""} />
            <input
              type="hidden"
              name={Prisma.CarcasseScalarFieldEnum.heure_evisceration}
              value={heureEvisceration || ""}
            />
            <input type="hidden" name={Prisma.CarcasseScalarFieldEnum.espece} value={espece || ""} />
            <input type="hidden" name={Prisma.CarcasseScalarFieldEnum.categorie} value={categorie || ""} />
            <input
              type="hidden"
              name={Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie}
              value={!anomaliesCarcasse?.length ? "true" : "false"}
            />
            <input
              type="hidden"
              name={Prisma.CarcasseScalarFieldEnum.examinateur_abats_sans_anomalie}
              value={!anomaliesAbats?.length ? "true" : "false"}
            />
            {anomaliesAbats?.map((anomalie, index) => (
              <input
                key={anomalie + index}
                type="hidden"
                name={Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats}
                value={anomalie || ""}
              />
            ))}
            {anomaliesCarcasse?.map((anomalie, index) => (
              <input
                key={anomalie + index}
                type="hidden"
                name={Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse}
                value={anomalie || ""}
              />
            ))}

            <CallOut className="p-2 md:p-4">
              {heureMiseAMort && <span className="block font-normal">Mise à mort&nbsp;: {heureMiseAMort}</span>}
              {heureEvisceration && <span className="block font-normal">Éviscération&nbsp;: {heureEvisceration}</span>}
              {espece ? <>Espèce: {espece}</> : null}
              {categorie ? (
                <>
                  <br />
                  Catégorie: {categorie}
                </>
              ) : null}
              {!!anomaliesCarcasse?.length && (
                <>
                  <br />
                  <br />
                  <b>Anomalie carcasse</b>&nbsp;:
                  {anomaliesCarcasse.map((anomalie, index) => (
                    <span className="block ml-2" key={anomalie + index}>
                      - {anomalie.split(" - ").reverse().join(" - ")}
                    </span>
                  ))}
                </>
              )}
              {!!anomaliesAbats?.length && (
                <>
                  <br />
                  <b>Anomalie abats</b>&nbsp;:
                  {anomaliesAbats.map((anomalie, index) => (
                    <span className="block ml-2" key={anomalie + index}>
                      - {anomalie.split(" - ").reverse().join(" - ")}
                    </span>
                  ))}
                </>
              )}
            </CallOut>
            {!heureMiseAMortValidated && (
              <div className="fr-fieldset__element flex md:flex-row flex-col md:items-end gap-4 w-full items-stretch">
                <Input
                  label="Heure de la mise à mort"
                  className="!mb-0 grow"
                  nativeInputProps={{
                    type: "time",
                    id: "heure-mise-a-mort-input",
                    onChange: (e) => setHeureMiseAMort(e.currentTarget.value),
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    setHeureMiseAMortValidated(true);
                  }}
                >
                  Valider
                </Button>
              </div>
            )}
            {!heureEviscerationValidated && (
              <div className="fr-fieldset__element flex md:flex-row flex-col md:items-end gap-4 w-full items-stretch">
                <Input
                  label="Heure de l'évisceration"
                  className="!mb-0 grow"
                  nativeInputProps={{
                    type: "time",
                    id: "heure-evisceration-input",
                    onChange: (e) => setHeureEvisceration(e.currentTarget.value),
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    setHeureEviscerationValidated(true);
                  }}
                >
                  Valider
                </Button>
              </div>
            )}
            {!espece && (
              <div className="fr-fieldset__element">
                <InputForSearchPrefilledData
                  data={Object.keys(grandGibier.especes_categories)}
                  label="Sélectionnez l'espèce de la carcasse"
                  hintText=""
                  placeholder="Cerf, Sanglier..."
                  hideDataWhenNoSearch={false}
                  onSelect={setEspece}
                />
              </div>
            )}
            {espece && !categorie && (
              <div className="fr-fieldset__element">
                <InputForSearchPrefilledData
                  // @ts-expect-error we dont type this json
                  data={grandGibier.especes_categories[espece]}
                  label="Sélectionnez la catégorie de l'espèce"
                  hintText=""
                  hideDataWhenNoSearch={false}
                  // @ts-expect-error we dont type this json
                  placeholder={grandGibier.especes_categories[espece].join(", ")}
                  onSelect={setCategorie}
                />
              </div>
            )}
            {espece && categorie && (
              <>
                <div className="fr-fieldset__element flex gap-2 flex-wrap">
                  <Button onClick={() => setAddAnomalieCarcasse(true)} type="button" iconId="ri-add-box-fill">
                    Anomalie carcasse
                  </Button>
                  <Button onClick={() => setAddAnomalieAbats(true)} type="button" iconId="ri-add-box-fill">
                    Anomalie abat
                  </Button>
                </div>
                {addAnomalieCarcasse && (
                  <div className="fr-fieldset__element">
                    <InputForSearchPrefilledData
                      data={grandGibierCarcasse}
                      label="Sélectionnez l'anomalie de la carcasse"
                      hintText=""
                      hideDataWhenNoSearch
                      onSelect={(newAnomalie) => {
                        setAddAnomalieCarcasse(false);
                        setAnomaliesCarcasse([...anomaliesCarcasse, newAnomalie]);
                      }}
                    />
                  </div>
                )}
                {addAnomalieAbats && (
                  <div className="fr-fieldset__element">
                    <InputForSearchPrefilledData
                      data={grandGibierAbats}
                      label="Sélectionnez l'anomalie des abats"
                      hintText=""
                      hideDataWhenNoSearch
                      onSelect={(newAnomalie) => {
                        setAddAnomalieAbats(false);
                        setAnomaliesAbats([...anomaliesAbats, newAnomalie]);
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </carcasseFetcher.Form>
      </modal.Component>
    </>
  );
}
