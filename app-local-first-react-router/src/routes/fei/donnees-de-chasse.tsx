import { useMemo } from 'react';
import { useParams } from 'react-router';
import { CarcasseType, Prisma } from '@prisma/client';
import InputNotEditable from '@app/components/InputNotEditable';
import { Accordion } from '@codegouvfr/react-dsfr/Accordion';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';
import PencilStrikeThrough from '@app/components/PencilStrikeThrough';

export default function FEIDonneesDeChasse() {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  // console.log('fei', fei);
  const carcasses = (state.carcassesIdsByFei[params.fei_numero!] || [])
    .map((cId) => state.carcasses[cId])
    .filter((c) => !c.deleted_at);
  const examinateurInitialUser = fei.examinateur_initial_user_id
    ? state.users[fei.examinateur_initial_user_id!]
    : null;
  const premierDetenteurUser = fei.premier_detenteur_user_id
    ? state.users[fei.premier_detenteur_user_id!]
    : null;
  const premierDetenteurEntity = fei.premier_detenteur_entity_id
    ? state.entities[fei.premier_detenteur_entity_id!]
    : null;

  const onlyPetitGibier = useMemo(() => {
    for (const carcasse of carcasses) {
      if (carcasse?.type !== CarcasseType.PETIT_GIBIER) {
        return false;
      }
    }
    return true;
  }, [carcasses]);

  const examinateurInitialInput = useMemo(() => {
    const lines = [];
    lines.push(`${examinateurInitialUser?.prenom} ${examinateurInitialUser?.nom_de_famille}`);
    lines.push(examinateurInitialUser?.telephone);
    lines.push(examinateurInitialUser?.email);
    lines.push(examinateurInitialUser?.numero_cfei);
    lines.push(`${examinateurInitialUser?.code_postal} ${examinateurInitialUser?.ville}`);
    return lines;
  }, [examinateurInitialUser]);

  const premierDetenteurInput = useMemo(() => {
    const lines = [];
    if (premierDetenteurEntity) {
      lines.push(premierDetenteurEntity.nom_d_usage);
      lines.push(premierDetenteurEntity.siret);
      lines.push(`${premierDetenteurEntity.code_postal} ${premierDetenteurEntity.ville}`);
      return lines;
    }
    lines.push(`${premierDetenteurUser?.prenom} ${premierDetenteurUser?.nom_de_famille}`);
    lines.push(premierDetenteurUser?.telephone);
    lines.push(premierDetenteurUser?.email);
    lines.push(premierDetenteurUser?.numero_cfei);
    lines.push(`${premierDetenteurUser?.code_postal} ${premierDetenteurUser?.ville}`);
    return lines;
  }, [premierDetenteurEntity, premierDetenteurUser]);

  return (
    <Accordion
      titleAs="h3"
      label={
        <>
          Données de chasse <PencilStrikeThrough />
        </>
      }
      defaultExpanded={false}
    >
      <InputNotEditable
        label="Examinateur Initial"
        textArea
        nativeTextAreaProps={{
          rows: examinateurInitialInput.length,
          defaultValue: examinateurInitialInput.join('\n'),
        }}
      />
      <InputNotEditable
        label="Premier Détenteur"
        textArea
        nativeTextAreaProps={{
          rows: premierDetenteurInput.length,
          defaultValue: premierDetenteurInput.join('\n'),
        }}
      />
      <InputNotEditable
        label="Date de mise à mort (et d'éviscération)"
        nativeInputProps={{
          id: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
          name: Prisma.FeiScalarFieldEnum.date_mise_a_mort,
          type: 'text',
          defaultValue: dayjs(fei.date_mise_a_mort).format('dddd D MMMM YYYY'),
        }}
      />
      <InputNotEditable
        label="Commune de mise à mort"
        nativeInputProps={{
          id: Prisma.FeiScalarFieldEnum.commune_mise_a_mort,
          name: Prisma.FeiScalarFieldEnum.commune_mise_a_mort,
          type: 'text',
          defaultValue: fei?.commune_mise_a_mort ?? '',
        }}
      />
      <InputNotEditable
        label="Heure de mise à mort de la première carcasse"
        nativeInputProps={{
          id: Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse,
          name: Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse,
          type: 'time',
          defaultValue: fei?.heure_mise_a_mort_premiere_carcasse ?? '',
        }}
      />
      {!onlyPetitGibier && (
        <InputNotEditable
          label="Heure d'éviscération de la dernière carcasse"
          nativeInputProps={{
            id: Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse,
            name: Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse,
            type: 'time',
            defaultValue: fei?.heure_evisceration_derniere_carcasse ?? '',
          }}
        />
      )}

      <InputNotEditable
        label="Date de validation de l’examen initial et de mise sur le marché"
        nativeInputProps={{
          id: Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche,
          name: Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche,
          type: 'text',
          defaultValue: dayjs(fei?.examinateur_initial_date_approbation_mise_sur_le_marche).format(
            'dddd D MMMM YYYY, HH:mm',
          ),
        }}
      />
    </Accordion>
  );
}
