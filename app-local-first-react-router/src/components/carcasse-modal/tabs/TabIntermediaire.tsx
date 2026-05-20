import { useMemo } from 'react';
import dayjs from 'dayjs';
import type { Carcasse } from '@prisma/client';
import { UserRoles } from '@prisma/client';
import { Button } from '@codegouvfr/react-dsfr/Button';
import useZustandStore from '@app/zustand/store';
import { useCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';
import { useCarcasseStatusAndRefus } from '@app/utils/useCarcasseStatusAndRefus';
import type { CarcasseCapabilities } from '@app/utils/carcasse-permissions';
import { ModalCard } from '../_helpers';

interface TabIntermediaireProps {
  carcasse: Carcasse;
  feiNumero: string;
  capabilities: CarcasseCapabilities;
  onAfterNavigate?: () => void;
}

export default function TabIntermediaire({
  carcasse,
  feiNumero,
  capabilities,
  onAfterNavigate,
}: TabIntermediaireProps) {
  const fei = useZustandStore((state) => state.feis[feiNumero]);
  const entities = useZustandStore((state) => state.entities);
  const carcassesIntermediaires = useCarcassesIntermediairesForCarcasse(carcasse.zacharie_carcasse_id);
  const { motifRefus } = useCarcasseStatusAndRefus(carcasse, fei);

  const editPath = useMemo(() => {
    switch (capabilities.primaryRole) {
      case 'etg':
        return `/app/etg/fei/${feiNumero}`;
      case 'collecteur':
        return `/app/collecteur/fei/${feiNumero}`;
      default:
        return null;
    }
  }, [capabilities.primaryRole, feiNumero]);

  const history = useMemo(() => {
    return carcassesIntermediaires.map((ci) => {
      const entity = entities[ci.intermediaire_entity_id];
      const isEtg = ci.intermediaire_role === UserRoles.ETG;
      return {
        id: ci.intermediaire_id,
        title: `${isEtg ? 'ETG' : 'Collecteur'} ${entity?.nom_d_usage ?? ''}`.trim(),
        decisionAt: ci.decision_at,
        priseEnChargeAt: ci.prise_en_charge_at,
        prise_en_charge: ci.prise_en_charge,
        manquante: ci.manquante,
        refus: ci.refus,
        ecartePourInspection: ci.ecarte_pour_inspection,
        poids: ci.intermediaire_poids,
        commentaire: ci.commentaire,
        nombreAcceptes: ci.nombre_d_animaux_acceptes,
      };
    });
  }, [carcassesIntermediaires, entities]);

  return (
    <div className="pt-4">
      {capabilities.canActIntermediaire && editPath && (
        <ModalCard
          title="Actions disponibles"
          accentColor="blue"
        >
          <p className="mb-3 text-sm">
            Vous pouvez agir sur cette carcasse (accepter, refuser, déclarer manquante, écarter pour
            inspection).
          </p>
          <Button
            linkProps={{
              to: editPath,
              onClick: onAfterNavigate,
            }}
            priority="primary"
          >
            Ouvrir la fiche pour agir
          </Button>
        </ModalCard>
      )}

      {motifRefus && (
        <ModalCard
          title={motifRefus.split(':')[0]}
          accentColor="red"
        >
          <p>{motifRefus.split(':')[1]?.trim() || "Aucun motif de refus n'a été renseigné"}</p>
        </ModalCard>
      )}

      <ModalCard title="Historique des intermédiaires">
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun intermédiaire pour cette carcasse.</p>
        ) : (
          <div className="space-y-4">
            {history.map((h) => (
              <div
                key={h.id}
                className="rounded border border-gray-200 bg-white p-3 text-sm"
              >
                <p className="font-semibold">{h.title}</p>
                <ul className="mt-1 space-y-0.5">
                  {h.priseEnChargeAt && (
                    <li>Prise en charge le {dayjs(h.priseEnChargeAt).format('DD/MM/YYYY HH:mm')}</li>
                  )}
                  {h.decisionAt && (
                    <li>Décision le {dayjs(h.decisionAt).format('DD/MM/YYYY HH:mm')}</li>
                  )}
                  {h.manquante && <li className="text-red-700">Déclarée manquante</li>}
                  {h.refus && <li className="text-red-700">Refusée : {h.refus}</li>}
                  {h.ecartePourInspection && (
                    <li className="text-orange-700">Écartée pour inspection SVI</li>
                  )}
                  {h.prise_en_charge && !h.manquante && !h.refus && (
                    <li className="text-blue-700">Acceptée</li>
                  )}
                  {h.nombreAcceptes !== null && h.nombreAcceptes !== undefined && (
                    <li>Animaux acceptés : {h.nombreAcceptes}</li>
                  )}
                  {h.poids !== null && h.poids !== undefined && <li>Poids enregistré : {h.poids} kg</li>}
                  {h.commentaire && <li className="italic">« {h.commentaire} »</li>}
                </ul>
              </div>
            ))}
          </div>
        )}
      </ModalCard>
    </div>
  );
}
