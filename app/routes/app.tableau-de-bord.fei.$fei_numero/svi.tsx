import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { clientLoader } from "./route";
import { Prisma, Carcasse, UserRoles } from "@prisma/client";
import InputNotEditable from "~/components/InputNotEditable";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import dayjs from "dayjs";
import CarcassesSvi from "./carcasse-svi";
import type { SerializeFrom } from "@remix-run/node";
import EntityNotEditable from "~/components/EntityNotEditable";

export default function FEI_SVI() {
  const { fei, user } = useLoaderData<typeof clientLoader>();

  const sviFinished = useFetcher({ key: "prise-en-charge" });

  const carcassesUnsorted = fei.Carcasses;
  const carcassesSorted = useMemo(() => {
    const carcassesValidated: Record<string, SerializeFrom<Carcasse>> = {};
    const carcassesSaisies: Record<string, SerializeFrom<Carcasse>> = {};
    const carcassesToCheck: Record<string, SerializeFrom<Carcasse>> = {};
    for (const carcasse of carcassesUnsorted) {
      if (carcasse.examinateur_refus || carcasse.intermediaire_carcasse_refus_intermediaire_id) {
        continue;
      }
      if (carcasse.svi_carcasse_saisie_motif?.length) {
        carcassesSaisies[carcasse.numero_bracelet] = carcasse;
        continue;
      }
      if (carcasse.svi_carcasse_signed_at) {
        carcassesValidated[carcasse.numero_bracelet] = carcasse;
        continue;
      }
      carcassesToCheck[carcasse.numero_bracelet] = carcasse;
    }
    return {
      carcassesValidated: Object.values(carcassesValidated),
      carcassesSaisies: Object.values(carcassesSaisies),
      carcassesToCheck: Object.values(carcassesToCheck),
    };
  }, [carcassesUnsorted]);

  const canEdit = useMemo(() => {
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (fei.svi_signed_at) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.SVI) {
      return false;
    }
    return true;
  }, [fei, user]);

  const jobIsDone = carcassesSorted.carcassesToCheck.length === 0;

  const prevCarcassesToCheckCount = useRef(carcassesSorted.carcassesToCheck.length);
  const [carcassesAValiderExpanded, setCarcassesAValiderExpanded] = useState(
    carcassesSorted.carcassesToCheck.length > 0,
  );
  const [carcassesAccepteesExpanded, setCarcassesAccepteesExpanded] = useState(false);
  const [carcassesRefuseesExpanded, setCarcassesRefuseesExpanded] = useState(false);

  useEffect(() => {
    if (prevCarcassesToCheckCount.current > 0 && carcassesSorted.carcassesToCheck.length === 0) {
      setCarcassesAValiderExpanded(false);
      setCarcassesAccepteesExpanded(false);
      setCarcassesRefuseesExpanded(false);
    }
    prevCarcassesToCheckCount.current = carcassesSorted.carcassesToCheck.length;
  }, [carcassesSorted.carcassesToCheck.length]);

  const labelInscectionDone = useMemo(() => {
    let label = "J'ai fini l'inspection de toutes les carcasses.";
    const nbCarcassesValidated = carcassesSorted.carcassesValidated.length;
    if (nbCarcassesValidated > 0) {
      if (nbCarcassesValidated === 1) {
        label += " 1 carcasse validée.";
      } else {
        label += ` ${nbCarcassesValidated} carcasses validées.`;
      }
    }
    const nbCarcassesSaisies = carcassesSorted.carcassesSaisies.length;
    if (nbCarcassesSaisies > 0) {
      if (nbCarcassesSaisies === 1) {
        label += " 1 carcasse saisie.";
      } else {
        label += ` ${nbCarcassesSaisies} carcasses saisies.`;
      }
    }
    return label;
  }, [carcassesSorted.carcassesValidated.length, carcassesSorted.carcassesSaisies.length]);

  return (
    <>
      <Accordion titleAs="h3" label={`Identité du SVI ${canEdit ? "🔒" : ""}`}>
        <EntityNotEditable user={fei.FeiSviUser} entity={fei.FeiSviEntity} />
      </Accordion>
      {carcassesSorted.carcassesToCheck.length > 0 && (
        <Accordion
          titleAs="h3"
          label={`Carcasses à vérifier (${carcassesSorted.carcassesToCheck.length})`}
          expanded={carcassesAValiderExpanded}
          onExpandedChange={setCarcassesAValiderExpanded}
        >
          <CarcassesSvi canEdit={canEdit} carcasses={carcassesSorted.carcassesToCheck} />
        </Accordion>
      )}
      <Accordion
        titleAs="h3"
        label={`Carcasses validées (${carcassesSorted.carcassesValidated.length})`}
        expanded={carcassesAccepteesExpanded}
        onExpandedChange={setCarcassesAccepteesExpanded}
      >
        {carcassesSorted.carcassesValidated.length === 0 ? (
          <p>Pas de carcasse acceptée</p>
        ) : (
          <CarcassesSvi canEdit={canEdit} carcasses={carcassesSorted.carcassesValidated} />
        )}
      </Accordion>
      <Accordion
        titleAs="h3"
        label={`Carcasses saisies (${carcassesSorted.carcassesSaisies.length})`}
        expanded={carcassesRefuseesExpanded}
        onExpandedChange={setCarcassesRefuseesExpanded}
      >
        {carcassesSorted.carcassesSaisies.length === 0 ? (
          <p>Pas de carcasse refusée</p>
        ) : (
          <CarcassesSvi canEdit={canEdit} carcasses={carcassesSorted.carcassesSaisies} />
        )}
      </Accordion>
      <Accordion titleAs="h3" label="Validation de la FEI" defaultExpanded>
        <sviFinished.Form method="POST" id="svi_check_finished_at">
          <input type="hidden" name="route" value={`/action/fei/${fei.numero}`} />
          <input
            form="svi_check_finished_at"
            type="hidden"
            name={Prisma.FeiScalarFieldEnum.numero}
            value={fei.numero}
          />
          <input
            type="hidden"
            form="svi_check_finished_at"
            name={Prisma.FeiScalarFieldEnum.svi_signed_at}
            suppressHydrationWarning
            value={dayjs().toISOString()}
          />
          <div className={["fr-fieldset__element", fei.svi_signed_at ? "pointer-events-none" : ""].join(" ")}>
            <Checkbox
              options={[
                {
                  label: labelInscectionDone,
                  nativeInputProps: {
                    required: true,
                    name: "svi_finito",
                    value: "true",
                    disabled: !jobIsDone,
                    readOnly: !!fei.svi_signed_at,
                    defaultChecked: fei.svi_signed_at ? true : false,
                  },
                },
              ]}
            />
            {!fei.svi_signed_at && (
              <Button type="submit" disabled={!jobIsDone}>
                Enregistrer
              </Button>
            )}
          </div>
          {!!fei.svi_signed_at && (
            <div className="fr-fieldset__element">
              <InputNotEditable
                label="Date de fin d'inspection"
                nativeInputProps={{
                  id: Prisma.FeiScalarFieldEnum.svi_signed_at,
                  name: Prisma.FeiScalarFieldEnum.svi_signed_at,
                  type: "datetime-local",
                  autoComplete: "off",
                  suppressHydrationWarning: true,
                  defaultValue: dayjs(fei.svi_signed_at).format("YYYY-MM-DDTHH:mm"),
                }}
              />
            </div>
          )}
        </sviFinished.Form>
      </Accordion>
      {fei.svi_signed_at && (
        <Alert
          severity="success"
          description="L'inspection des carcasses est terminée, cette FEI est clôturée. Merci !"
          title="FEI clôturée"
        />
      )}
    </>
  );
}