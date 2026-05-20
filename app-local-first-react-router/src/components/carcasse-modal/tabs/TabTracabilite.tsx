import { useMemo } from 'react';
import type { Carcasse } from '@prisma/client';
import { UserRoles } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import { useCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import { ModalCard, ModalTimeline, ModalActeurBlock, buildModalTimeline } from '../_helpers';

interface TabTracabiliteProps {
  carcasse: Carcasse;
  feiNumero: string;
}

export default function TabTracabilite({ carcasse, feiNumero }: TabTracabiliteProps) {
  const fei = useZustandStore((state) => state.feis[feiNumero]);
  const users = useZustandStore((state) => state.users);
  const entities = useZustandStore((state) => state.entities);
  const carcassesIntermediaires = useCarcassesIntermediairesForCarcasse(carcasse.zacharie_carcasse_id);

  const examinateurInitialUser = fei?.examinateur_initial_user_id
    ? users[fei.examinateur_initial_user_id]
    : null;
  const premierDetenteurUser = fei?.premier_detenteur_user_id ? users[fei.premier_detenteur_user_id] : null;
  const premierDetenteurEntity = fei?.premier_detenteur_entity_id
    ? entities[fei.premier_detenteur_entity_id]
    : null;

  const examinateurInitialInput = useMemo(() => {
    if (!examinateurInitialUser) return [];
    return [
      `${examinateurInitialUser.prenom ?? ''} ${examinateurInitialUser.nom_de_famille ?? ''}`,
      examinateurInitialUser.telephone,
      examinateurInitialUser.email,
      examinateurInitialUser.numero_cfei,
      `${examinateurInitialUser.code_postal ?? ''} ${examinateurInitialUser.ville ?? ''}`,
    ];
  }, [examinateurInitialUser]);

  const premierDetenteurInput = useMemo(() => {
    if (premierDetenteurEntity) {
      return [
        premierDetenteurEntity.nom_d_usage,
        premierDetenteurEntity.siret,
        `${premierDetenteurEntity.code_postal ?? ''} ${premierDetenteurEntity.ville ?? ''}`,
      ];
    }
    if (premierDetenteurUser) {
      return [
        `${premierDetenteurUser.prenom ?? ''} ${premierDetenteurUser.nom_de_famille ?? ''}`,
        premierDetenteurUser.telephone,
        premierDetenteurUser.email,
        premierDetenteurUser.numero_cfei,
        `${premierDetenteurUser.code_postal ?? ''} ${premierDetenteurUser.ville ?? ''}`,
      ];
    }
    return [];
  }, [premierDetenteurEntity, premierDetenteurUser]);

  const intermediairesInputs = useMemo(() => {
    const lines: Array<{ label: string; value: Array<string | null | undefined> }> = [];
    let collecteurs = 0;
    for (const ci of carcassesIntermediaires) {
      const isCollecteur = ci.intermediaire_role === UserRoles.COLLECTEUR_PRO;
      const label = isCollecteur
        ? `Collecteur ${++collecteurs}`
        : 'Établissement de Traitement du Gibier Sauvage';
      const entity = entities[ci.intermediaire_entity_id];
      if (!entity) continue;
      lines.push({
        label,
        value: [
          entity.nom_d_usage,
          entity.siret,
          `${entity.code_postal ?? ''} ${entity.ville ?? ''}`,
        ],
      });
    }
    return lines;
  }, [carcassesIntermediaires, entities]);

  const timelineEvents = useMemo(
    () => buildModalTimeline({ fei, carcasse, intermediaires: carcassesIntermediaires, entities }),
    [fei, carcasse, carcassesIntermediaires, entities]
  );

  return (
    <div className="pt-4">
      <ModalCard title="Traçabilité">
        <ModalTimeline events={timelineEvents} />
      </ModalCard>

      <ModalCard title="Acteurs de la chasse">
        <div className="space-y-3">
          <ModalActeurBlock
            label="Examinateur Initial"
            lines={examinateurInitialInput}
          />
          <ModalActeurBlock
            label="Premier Détenteur"
            lines={premierDetenteurInput}
          />
          {intermediairesInputs.map((intermediaireInput, index) => (
            <ModalActeurBlock
              key={index}
              label={intermediaireInput.label}
              lines={intermediaireInput.value}
            />
          ))}
        </div>
      </ModalCard>
    </div>
  );
}
