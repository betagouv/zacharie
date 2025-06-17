import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import dayjs from 'dayjs';
import { CarcasseStatus, Fei, Prisma, UserRoles } from '@prisma/client';
import InputNotEditable from '@app/components/InputNotEditable';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import CardCarcasseSvi from '@app/components/CardCarcasseSvi';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { sortCarcassesApproved } from '@app/utils/sort';
import FEIDonneesDeChasse from './donnees-de-chasse';
import Section from '@app/components/Section';
import CardCarcasse from '@app/components/CardCarcasse';

export default function FEI_SVI() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const updateFei = state.updateFei;
  const updateCarcasse = state.updateCarcasse;
  const addLog = state.addLog;
  const allCarcassesForFei = useMemo(
    () =>
      (state.carcassesIdsByFei[params.fei_numero!] || [])
        .map((cId) => state.carcasses[cId])
        .sort(sortCarcassesApproved)
        .filter((carcasse) => !carcasse.deleted_at),
    [state.carcassesIdsByFei, params.fei_numero, state.carcasses],
  );

  const carcassesDejaRefusees = useMemo(
    () => allCarcassesForFei.filter((c) => !!c.intermediaire_carcasse_refus_intermediaire_id),
    [allCarcassesForFei],
  );

  const carcassesAAfficher = useMemo(
    () => allCarcassesForFei.filter((c) => !c.intermediaire_carcasse_refus_intermediaire_id),
    [allCarcassesForFei],
  );

  const [showRefusedCarcasses, setShowRefusedCarcasses] = useState(false);

  const isSviWorkingFor = useMemo(() => {
    if (fei.svi_entity_id) {
      if (user.roles.includes(UserRoles.SVI)) {
        const svi = state.entities[fei.svi_entity_id];
        if (svi?.relation === 'WORKING_FOR') {
          return true;
        }
      }
    }
    return false;
  }, [fei, user, state.entities]);

  const canEdit = useMemo(() => {
    if (fei.automatic_closed_at) {
      return false;
    }
    if (isSviWorkingFor) {
      return true;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.SVI) {
      return false;
    }
    return true;
  }, [fei, user, isSviWorkingFor]);

  const DateFinInput = canEdit ? Input : InputNotEditable;

  return (
    <>
      <Section open={false} title="Données de chasse">
        <FEIDonneesDeChasse />
      </Section>
      <Section title={`Carcasses à inspecter (${carcassesAAfficher.length})`}>
        {canEdit && (
          <p className="mb-8 text-sm text-gray-600">
            Veuillez cliquer sur une carcasse pour la saisir ou l'annoter
          </p>
        )}
        <div className="flex flex-col gap-4">
          {carcassesAAfficher.map((carcasse) => {
            return <CardCarcasseSvi canClick key={carcasse.numero_bracelet} carcasse={carcasse} />;
          })}
        </div>
        {carcassesDejaRefusees.length > 0 && (
          <div className="my-8 flex justify-center">
            <Button
              onClick={() => {
                setShowRefusedCarcasses(!showRefusedCarcasses);
              }}
              priority="secondary"
            >
              {showRefusedCarcasses ? 'Masquer' : 'Afficher'} les carcasses déjà refusées (
              {carcassesDejaRefusees.length})
            </Button>
          </div>
        )}
        {showRefusedCarcasses && (
          <div className="flex flex-col gap-4">
            {carcassesDejaRefusees.map((carcasse) => {
              return <CardCarcasse carcasse={carcasse} key={carcasse.numero_bracelet} />;
            })}
          </div>
        )}
      </Section>
      <Section title="Validation de la fiche">
        <form
          method="POST"
          id="svi_check_finished_at"
          onSubmit={(e) => {
            e.preventDefault();
            const nextFei: Partial<Fei> = {
              svi_closed_at: dayjs().toDate(),
              svi_assigned_at: fei.svi_assigned_at ?? dayjs().toDate(),
            };
            if (fei.fei_current_owner_role !== UserRoles.SVI) {
              nextFei.fei_current_owner_role = UserRoles.SVI;
              nextFei.fei_current_owner_entity_id = fei.fei_next_owner_entity_id;
              nextFei.fei_current_owner_entity_name_cache = fei.fei_next_owner_entity_name_cache;
              nextFei.fei_current_owner_user_id = user.id;
              nextFei.fei_current_owner_user_name_cache =
                fei.fei_next_owner_user_name_cache || `${user.prenom} ${user.nom_de_famille}`;
              nextFei.fei_next_owner_role = null;
              nextFei.fei_next_owner_user_id = null;
              nextFei.fei_next_owner_user_name_cache = null;
              nextFei.fei_next_owner_entity_id = null;
              nextFei.fei_next_owner_entity_name_cache = null;
              nextFei.fei_prev_owner_role = fei.fei_current_owner_role || null;
              nextFei.fei_prev_owner_user_id = fei.fei_current_owner_user_id || null;
              nextFei.fei_prev_owner_entity_id = fei.fei_current_owner_entity_id || null;
              nextFei.svi_user_id = user.id;
            }
            updateFei(fei.numero, nextFei);
            addLog({
              user_id: user.id,
              action: 'svi-check-finished-at',
              fei_numero: fei.numero,
              history: createHistoryInput(fei, nextFei),
              user_role: UserRoles.SVI,
              entity_id: fei.svi_entity_id,
              zacharie_carcasse_id: null,
              carcasse_intermediaire_id: null,
              fei_intermediaire_id: null,
            });
            for (const carcasse of carcassesAAfficher) {
              if (
                !carcasse.svi_carcasse_status ||
                carcasse.svi_carcasse_status === CarcasseStatus.SANS_DECISION
              ) {
                updateCarcasse(carcasse.zacharie_carcasse_id, {
                  svi_carcasse_status: CarcasseStatus.ACCEPTE,
                  svi_carcasse_status_set_at: dayjs().toDate(),
                });
              }
            }
          }}
        >
          {!fei.automatic_closed_at && (
            <>
              <Checkbox
                className={!canEdit ? 'checkbox-black' : ''}
                options={[
                  {
                    label: "J'ai fini l'inspection de toutes les carcasses et je clôture la fiche.",
                    nativeInputProps: {
                      required: true,
                      name: 'svi_finito',
                      value: 'true',
                      readOnly: !!fei.svi_closed_at || !!fei.automatic_closed_at,
                      defaultChecked: fei.svi_closed_at ? true : false,
                    },
                  },
                ]}
              />
              <Button type="submit" className="my-4" disabled={!canEdit}>
                Enregistrer
              </Button>
            </>
          )}

          {!!fei.svi_closed_at && (
            <DateFinInput
              label="Date de fin d'inspection"
              nativeInputProps={{
                id: Prisma.FeiScalarFieldEnum.svi_closed_at,
                name: Prisma.FeiScalarFieldEnum.svi_closed_at,
                type: 'datetime-local',
                autoComplete: 'off',
                onBlur: (e) => {
                  const nextFei: Partial<Fei> = {
                    svi_closed_at: dayjs(e.target.value).toDate(),
                    svi_assigned_at: fei.svi_assigned_at ?? dayjs(e.target.value).toDate(),
                  };
                  if (fei.fei_current_owner_role !== UserRoles.SVI) {
                    nextFei.fei_current_owner_role = UserRoles.SVI;
                    nextFei.fei_current_owner_entity_id = fei.fei_next_owner_entity_id;
                    nextFei.fei_current_owner_entity_name_cache = fei.fei_next_owner_entity_name_cache;
                    nextFei.fei_current_owner_user_id = user.id;
                    nextFei.fei_current_owner_user_name_cache =
                      fei.fei_next_owner_user_name_cache || `${user.prenom} ${user.nom_de_famille}`;
                    nextFei.fei_next_owner_role = null;
                    nextFei.fei_next_owner_user_id = null;
                    nextFei.fei_next_owner_user_name_cache = null;
                    nextFei.fei_next_owner_entity_id = null;
                    nextFei.fei_next_owner_entity_name_cache = null;
                    nextFei.fei_prev_owner_role = fei.fei_current_owner_role || null;
                    nextFei.fei_prev_owner_user_id = fei.fei_current_owner_user_id || null;
                    nextFei.fei_prev_owner_entity_id = fei.fei_current_owner_entity_id || null;
                    nextFei.svi_user_id = user.id;
                  }
                  updateFei(fei.numero, nextFei);
                  addLog({
                    user_id: user.id,
                    action: 'svi-check-finished-at-update',
                    fei_numero: fei.numero,
                    history: createHistoryInput(fei, nextFei),
                    user_role: UserRoles.SVI,
                    entity_id: fei.svi_entity_id,
                    zacharie_carcasse_id: null,
                    carcasse_intermediaire_id: null,
                    fei_intermediaire_id: null,
                  });
                  for (const carcasse of carcassesAAfficher) {
                    if (
                      !carcasse.svi_carcasse_status ||
                      carcasse.svi_carcasse_status === CarcasseStatus.SANS_DECISION
                    ) {
                      updateCarcasse(carcasse.zacharie_carcasse_id, {
                        svi_carcasse_status: CarcasseStatus.ACCEPTE,
                        svi_carcasse_status_set_at: dayjs(e.target.value).toDate(),
                      });
                    }
                  }
                },
                suppressHydrationWarning: true,
                defaultValue: dayjs(fei.svi_closed_at).format('YYYY-MM-DDTHH:mm'),
              }}
            />
          )}
          {!!fei.automatic_closed_at && (
            <DateFinInput
              label="Date de clôture automatique"
              hintText="La fiche a été clôturée automatiquement par le système 10 jours après la date d'assignation au SVI"
              nativeInputProps={{
                id: Prisma.FeiScalarFieldEnum.automatic_closed_at,
                name: Prisma.FeiScalarFieldEnum.automatic_closed_at,
                type: 'datetime-local',
                autoComplete: 'off',
                suppressHydrationWarning: true,
                defaultValue: dayjs(fei.automatic_closed_at).format('YYYY-MM-DDTHH:mm'),
              }}
            />
          )}
        </form>
      </Section>
      {(fei.svi_closed_at || fei.automatic_closed_at || fei.intermediaire_closed_at) && (
        <div className="bg-white px-4 pb-4 md:px-8 md:pb-8">
          <Alert
            severity="success"
            className="md:mx-4"
            description="L'inspection des carcasses est terminée, cette fiche est clôturée. Merci !"
            title="Fiche clôturée"
          />
        </div>
      )}
    </>
  );
}
