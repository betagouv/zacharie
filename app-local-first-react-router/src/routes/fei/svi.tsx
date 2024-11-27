import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import dayjs from 'dayjs';
import { Prisma, Carcasse, UserRoles } from '@prisma/client';
import InputNotEditable from '@app/components/InputNotEditable';
import { Accordion } from '@codegouvfr/react-dsfr/Accordion';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import EntityNotEditable from '@app/components/EntityNotEditable';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import CarcasseSVI from './svi-carcasse';
import { Input } from '@codegouvfr/react-dsfr/Input';

export default function FEI_SVI() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const updateFei = state.updateFei;
  const sviUser = fei.svi_user_id ? state.users[fei.svi_user_id] : null;
  const svi = fei.svi_entity_id ? state.entities[fei.svi_entity_id] : null;
  const carcassesUnsorted = (state.carcassesIdsByFei[params.fei_numero!] || [])
    .map((cId) => state.carcasses[cId])
    .filter((carcasse) => !carcasse.intermediaire_carcasse_refus_intermediaire_id);

  const carcassesSorted = useMemo(() => {
    const carcassesValidated: Record<Carcasse['zacharie_carcasse_id'], Carcasse> = {};
    const carcassesSaisies: Record<Carcasse['zacharie_carcasse_id'], Carcasse> = {};
    // const carcassesToCheck: Record<Carcasse['zacharie_carcasse_id'], Carcasse> = {};
    for (const carcasse of carcassesUnsorted) {
      if (carcasse.svi_carcasse_saisie_motif?.filter(Boolean)?.length) {
        carcassesSaisies[carcasse.zacharie_carcasse_id] = carcasse;
        continue;
      }
      // if (carcasse.svi_carcasse_signed_at) {
      carcassesValidated[carcasse.zacharie_carcasse_id] = carcasse;
      // continue;
      // }
      // carcassesToCheck[carcasse.zacharie_carcasse_id] = carcasse;
    }
    return {
      carcassesValidated: Object.values(carcassesValidated),
      carcassesSaisies: Object.values(carcassesSaisies),
      // carcassesToCheck: Object.values(carcassesToCheck),
    };
  }, [carcassesUnsorted]);

  const canEdit = useMemo(() => {
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    // if (fei.svi_signed_at) {
    //   return false;
    // }
    if (fei.fei_current_owner_role !== UserRoles.SVI) {
      return false;
    }
    return true;
  }, [fei, user]);

  // const jobIsDone = carcassesSorted.carcassesToCheck.length === 0;
  const DateFinInput = canEdit ? Input : InputNotEditable;

  const [carcassesAValiderExpanded, setCarcassesAValiderExpanded] = useState(true);
  const [carcassesAccepteesExpanded, setCarcassesAccepteesExpanded] = useState(true);
  const [carcassesRefuseesExpanded, setCarcassesRefuseesExpanded] = useState(true);

  return (
    <>
      <Accordion titleAs="h3" label={`Identité du SVI ${canEdit ? '🔒' : ''}`}>
        <EntityNotEditable user={sviUser!} entity={svi!} />
      </Accordion>
      {canEdit ? (
        <Accordion
          titleAs="h3"
          // label={`Carcasses à vérifier (${carcassesSorted.carcassesToCheck.length})`}
          label={`Carcasses à vérifier (${carcassesUnsorted.length})`}
          expanded={carcassesAValiderExpanded}
          onExpandedChange={setCarcassesAValiderExpanded}
        >
          <p className="text-sm text-gray-600">
            Veuillez cliquer sur une carcasse pour la saisir ou l'annoter
          </p>
          {carcassesUnsorted.map((carcasse) => {
            return <CarcasseSVI canEdit={canEdit} key={carcasse.numero_bracelet} carcasse={carcasse} />;
          })}
        </Accordion>
      ) : (
        <>
          <Accordion
            titleAs="h3"
            label={`Carcasses validées (${carcassesSorted.carcassesValidated.length})`}
            expanded={carcassesAccepteesExpanded}
            onExpandedChange={setCarcassesAccepteesExpanded}
          >
            {carcassesSorted.carcassesValidated.length === 0 ? (
              <p>Pas de carcasse acceptée</p>
            ) : (
              carcassesSorted.carcassesValidated.map((carcasse) => {
                return <CarcasseSVI canEdit={canEdit} key={carcasse.numero_bracelet} carcasse={carcasse} />;
              })
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
              carcassesSorted.carcassesSaisies.map((carcasse) => {
                return <CarcasseSVI canEdit={canEdit} key={carcasse.numero_bracelet} carcasse={carcasse} />;
              })
            )}
          </Accordion>
        </>
      )}
      <Accordion titleAs="h3" label="Validation de la fiche" defaultExpanded>
        <form
          method="POST"
          id="svi_check_finished_at"
          onSubmit={(e) => {
            e.preventDefault();
            updateFei(fei.numero, {
              svi_signed_at: dayjs().toDate(),
            });
          }}
        >
          <div className={['fr-fieldset__element', !canEdit ? 'pointer-events-none' : ''].join(' ')}>
            <Checkbox
              options={[
                {
                  label: "J'ai fini l'inspection de toutes les carcasses et je clôture la fiche.",
                  nativeInputProps: {
                    required: true,
                    name: 'svi_finito',
                    value: 'true',
                    readOnly: !!fei.svi_signed_at,
                    defaultChecked: fei.svi_signed_at ? true : false,
                  },
                },
              ]}
            />
            <Button type="submit" disabled={!canEdit}>
              Enregistrer
            </Button>
          </div>
          {!!fei.svi_signed_at && (
            <div className="fr-fieldset__element">
              <DateFinInput
                label="Date de fin d'inspection"
                nativeInputProps={{
                  id: Prisma.FeiScalarFieldEnum.svi_signed_at,
                  name: Prisma.FeiScalarFieldEnum.svi_signed_at,
                  type: 'datetime-local',
                  autoComplete: 'off',
                  onBlur: (e) => {
                    updateFei(fei.numero, {
                      svi_signed_at: dayjs(e.target.value).toDate(),
                    });
                  },
                  suppressHydrationWarning: true,
                  defaultValue: dayjs(fei.svi_signed_at).format('YYYY-MM-DDTHH:mm'),
                }}
              />
            </div>
          )}
        </form>
      </Accordion>
      {fei.svi_signed_at && (
        <Alert
          severity="success"
          description="L'inspection des carcasses est terminée, cette fiche est clôturée. Merci !"
          title="Fiche clôturée"
        />
      )}
    </>
  );
}
