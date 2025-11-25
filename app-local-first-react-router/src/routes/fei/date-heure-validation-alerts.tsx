import { useMemo } from 'react';
import dayjs from 'dayjs';
import Alert from '@codegouvfr/react-dsfr/Alert';
import type { Fei } from '@prisma/client';

interface DateHeureValidationAlertsProps {
  fei: Fei;
  showDateAlert?: boolean;
  showHeureMiseAMortAlert?: boolean;
  showHeureEviscerationAlert?: boolean;
}

export default function DateHeureValidationAlerts({
  fei,
  showDateAlert = true,
  showHeureMiseAMortAlert = true,
  showHeureEviscerationAlert = true,
}: DateHeureValidationAlertsProps) {
  const isDateMiseAMortAfterToday = useMemo(() => {
    if (!fei.date_mise_a_mort) {
      return false;
    }
    const today = dayjs().startOf('day');
    const dateMiseAMort = dayjs(fei.date_mise_a_mort).startOf('day');
    return dateMiseAMort.isAfter(today);
  }, [fei.date_mise_a_mort]);

  const isDateMiseAMortToday = useMemo(() => {
    if (!fei.date_mise_a_mort) {
      return false;
    }
    const today = dayjs().startOf('day');
    const dateMiseAMort = dayjs(fei.date_mise_a_mort).startOf('day');
    return dateMiseAMort.isSame(today);
  }, [fei.date_mise_a_mort]);

  const isHeureMiseAMortAfterNow = useMemo(() => {
    if (!isDateMiseAMortToday || !fei.heure_mise_a_mort_premiere_carcasse) {
      return false;
    }
    const timeParts = fei.heure_mise_a_mort_premiere_carcasse.split(':');
    if (timeParts.length !== 2) {
      return false;
    }
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    if (isNaN(hour) || isNaN(minute)) {
      return false;
    }
    const now = dayjs();
    const heureMiseAMort = dayjs(fei.date_mise_a_mort).hour(hour).minute(minute).second(0);
    return heureMiseAMort.isAfter(now);
  }, [isDateMiseAMortToday, fei.date_mise_a_mort, fei.heure_mise_a_mort_premiere_carcasse]);

  const isHeureEviscerationAfterNow = useMemo(() => {
    if (!isDateMiseAMortToday || !fei.heure_evisceration_derniere_carcasse) {
      return false;
    }
    const timeParts = fei.heure_evisceration_derniere_carcasse.split(':');
    if (timeParts.length !== 2) {
      return false;
    }
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    if (isNaN(hour) || isNaN(minute)) {
      return false;
    }
    const now = dayjs();
    const heureEvisceration = dayjs(fei.date_mise_a_mort).hour(hour).minute(minute).second(0);
    return heureEvisceration.isAfter(now);
  }, [isDateMiseAMortToday, fei.date_mise_a_mort, fei.heure_evisceration_derniere_carcasse]);

  return (
    <>
      {showDateAlert && isDateMiseAMortAfterToday && (
        <Alert
          title="Attention"
          className="mt-4"
          severity="warning"
          description="La date de mise à mort ne peut pas être postérieure à aujourd'hui."
        />
      )}
      {showHeureMiseAMortAlert && isHeureMiseAMortAfterNow && (
        <Alert
          title="Attention"
          className="mt-4"
          severity="warning"
          description="L'heure de mise à mort de la première carcasse ne peut pas être postérieure à l'heure actuelle."
        />
      )}
      {showHeureEviscerationAlert && isHeureEviscerationAfterNow && (
        <Alert
          title="Attention"
          className="mt-4"
          severity="warning"
          description="L'heure d'éviscération de la dernière carcasse ne peut pas être postérieure à l'heure actuelle."
        />
      )}
    </>
  );
}
