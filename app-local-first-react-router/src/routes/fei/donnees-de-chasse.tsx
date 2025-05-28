import { useMemo } from 'react';
import { useParams } from 'react-router';
import { Carcasse, CarcasseType, Prisma, UserRoles } from '@prisma/client';
import InputNotEditable from '@app/components/InputNotEditable';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';

export default function FEIDonneesDeChasse({
  carcasseId,
}: {
  carcasseId?: Carcasse['zacharie_carcasse_id'];
}) {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);
  const latestIntermediaire = intermediaires[0];
  // console.log('fei', fei);
  const carcasses = (carcasseId ? [carcasseId] : state.carcassesIdsByFei[params.fei_numero!] || [])
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

  const intermediairesInputs = useMemo(() => {
    const lines = [];
    let collecteurs = 0;
    for (const intermediaire of intermediaires) {
      const intermediaireLines = [];
      const isCollecteur = intermediaire.fei_intermediaire_role === UserRoles.COLLECTEUR_PRO;
      const label = isCollecteur
        ? `Collecteur ${collecteurs + 1}`
        : 'Établissement de Traitement du Gibier Sauvage';
      const entity = state.entities[intermediaire.fei_intermediaire_entity_id!];
      intermediaireLines.push(entity.nom_d_usage);
      intermediaireLines.push(entity.siret);
      intermediaireLines.push(`${entity.code_postal} ${entity.ville}`);
      lines.push({ label, value: intermediaireLines });
    }
    return lines;
  }, [intermediaires, state.entities]);

  const ccgDate =
    fei.premier_detenteur_depot_type === 'CCG'
      ? dayjs(fei.premier_detenteur_date_depot_quelque_part).format('dddd DD MMMM YYYY à HH:mm')
      : null;
  const etgDate = latestIntermediaire
    ? dayjs(latestIntermediaire.check_finished_at).format('dddd DD MMMM YYYY à HH:mm')
    : null;

  const milestones = useMemo(() => {
    const _milestones = [
      `Date de mise à mort: ${dayjs(fei.date_mise_a_mort).format('dddd DD MMMM YYYY')}`,
      `Heure de mise à mort de la première carcasse de la fiche: ${fei.heure_mise_a_mort_premiere_carcasse!}`,
    ];
    if (onlyPetitGibier) {
      _milestones.push(
        `Heure d'éviscération de la dernière carcasse de la fiche: ${fei.heure_evisceration_derniere_carcasse!}`,
      );
    }
    if (ccgDate) _milestones.push(`Date et heure de dépôt dans le CCG: ${ccgDate}`);
    if (etgDate) _milestones.push(`Date et heure de prise en charge par l'ETG: ${etgDate}`);
    return _milestones;
  }, [
    ccgDate,
    etgDate,
    onlyPetitGibier,
    fei.date_mise_a_mort,
    fei.heure_mise_a_mort_premiere_carcasse,
    fei.heure_evisceration_derniere_carcasse,
  ]);

  return (
    <>
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
      {intermediairesInputs.map((intermediaireInput) => {
        const value = intermediaireInput.value.join('\n');
        return (
          <InputNotEditable
            key={value}
            label={intermediaireInput.label}
            textArea
            nativeTextAreaProps={{
              rows: intermediaireInput.value.length,
              defaultValue: intermediaireInput.value.join('\n'),
            }}
          />
        );
      })}
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
        label="Épisodes clés"
        textArea
        nativeTextAreaProps={{
          rows: milestones.length,
          defaultValue: milestones.join('\n'),
        }}
      />
      <InputNotEditable
        label={carcasses.length > 1 ? 'Espèces' : 'Espèce'}
        nativeInputProps={{
          defaultValue: [...new Set(carcasses.map((c) => c.espece))].join(', '),
        }}
      />
    </>
  );
}
