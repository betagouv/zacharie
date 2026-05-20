import { useMemo } from 'react';
import type { Carcasse } from '@prisma/client';
import { CarcasseType } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import { ModalCard, formatModalDate } from '../_helpers';

interface TabIdentiteProps {
  carcasse: Carcasse;
  feiNumero: string;
}

export default function TabIdentite({ carcasse, feiNumero }: TabIdentiteProps) {
  const fei = useZustandStore((state) => state.feis[feiNumero]);
  const users = useZustandStore((state) => state.users);

  const examinateurInitialUser = fei?.examinateur_initial_user_id
    ? users[fei.examinateur_initial_user_id]
    : null;

  const examinateurName = useMemo(() => {
    if (!examinateurInitialUser) return '—';
    return (
      [examinateurInitialUser.prenom, examinateurInitialUser.nom_de_famille]
        .filter(Boolean)
        .join(' ')
        .trim() || '—'
    );
  }, [examinateurInitialUser]);

  return (
    <div className="pt-4">
      <ModalCard title="Informations de chasse">
        <ul className="space-y-1">
          <li>Chasse du {formatModalDate(fei?.date_mise_a_mort)}</li>
          <li>{carcasse.espece || '—'}</li>
          {carcasse.numero_bracelet && <li>N° bracelet : {carcasse.numero_bracelet}</li>}
          <li>Prélevé à {fei?.commune_mise_a_mort || '—'}</li>
          <li>Examiné par {examinateurName}</li>
          {carcasse.heure_mise_a_mort_premiere_carcasse_fei && (
            <li>
              Heure de mise à mort de la première carcasse&nbsp;:{' '}
              {carcasse.heure_mise_a_mort_premiere_carcasse_fei}
            </li>
          )}
          {carcasse.type === CarcasseType.PETIT_GIBIER &&
            carcasse.heure_evisceration_derniere_carcasse_fei && (
              <li>
                Heure d'éviscération de la dernière carcasse&nbsp;:{' '}
                {carcasse.heure_evisceration_derniere_carcasse_fei}
              </li>
            )}
        </ul>
      </ModalCard>

      {carcasse.examinateur_anomalies_carcasse?.length > 0 && (
        <ModalCard title="Anomalies carcasse">
          <ul className="ml-4 list-inside list-disc space-y-0.5 text-sm">
            {carcasse.examinateur_anomalies_carcasse.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </ModalCard>
      )}

      {carcasse.examinateur_anomalies_abats?.length > 0 && (
        <ModalCard title="Anomalies abats">
          <ul className="ml-4 list-inside list-disc space-y-0.5 text-sm">
            {carcasse.examinateur_anomalies_abats.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </ModalCard>
      )}
    </div>
  );
}
