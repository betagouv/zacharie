import dayjs from 'dayjs';
import type { Carcasse } from '@prisma/client';

type SviDateCarcasse = Pick<Carcasse, 'svi_assigned_at' | 'svi_closed_at' | 'svi_automatic_closed_at'>;

// La clôture/assignation SVI vit par carcasse : une transmission peut agréger plusieurs carcasses
// aux dates différentes. On retient la date la plus tardive de chaque type pour l'affichage
// « Données de chasse ». Les trois types sont bien distincts (assignation, clôture manuelle,
// clôture automatique) — ne pas confondre svi_closed_at et svi_automatic_closed_at.
export function getLatestSviDates(carcasses: Array<SviDateCarcasse>) {
  const latest = (pick: (c: SviDateCarcasse) => Date | null) =>
    carcasses.reduce<Date | null>((acc, c) => {
      const value = pick(c);
      if (!value) return acc;
      const d = dayjs(value).toDate();
      return !acc || d > acc ? d : acc;
    }, null);

  return {
    sviAssignedAt: latest((c) => c.svi_assigned_at),
    sviClosedAt: latest((c) => c.svi_closed_at),
    sviAutomaticClosedAt: latest((c) => c.svi_automatic_closed_at),
  };
}
