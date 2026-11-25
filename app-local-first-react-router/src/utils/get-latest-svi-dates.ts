import dayjs from 'dayjs';
import type { Carcasse } from '@prisma/client';

type SviDateCarcasse = Pick<Carcasse, 'svi_assigned_at' | 'svi_closed_at' | 'svi_automatic_closed_at'>;

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
