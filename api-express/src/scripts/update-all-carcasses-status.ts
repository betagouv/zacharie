import { CarcasseStatus } from '@prisma/client';
import dayjs from 'dayjs';
import prisma from '~/prisma';
import updateCarcasseStatus from '~/utils/get-carcasse-status';

(async () => {
  const carcasses = await prisma.carcasse.findMany({
    where: {
      deleted_at: null,
    },
    orderBy: {
      created_at: 'asc',
    },
    include: {
      Fei: true,
    },
  });
  for (const [index, carcasse] of carcasses.entries()) {
    if (!carcasse.svi_assigned_to_fei_at && carcasse.Fei.svi_assigned_at) {
      console.log(index, 'NO svi_assigned_to_fei_at', carcasse.zacharie_carcasse_id, carcasse.Fei.numero);
      await prisma.carcasse.update({
        where: { zacharie_carcasse_id: carcasse.zacharie_carcasse_id },
        data: { svi_assigned_to_fei_at: carcasse.Fei.svi_assigned_at },
      });
    } else {
      const newStatus = updateCarcasseStatus(carcasse);
      if (newStatus === 'SANS_DECISION') {
        if (
          dayjs(carcasse.Fei.svi_assigned_at).isBefore(dayjs().subtract(10, 'days').startOf('day').toDate())
        ) {
          console.log(
            index,
            'SANS_DECISION PROBLEMATIC',
            carcasse.svi_carcasse_status,
            newStatus,
            carcasse.zacharie_carcasse_id,
            carcasse.Fei.automatic_closed_at,
            carcasse.Fei.svi_closed_at,
            carcasse.Fei.svi_assigned_at,
          );
        }
      }
      if (newStatus !== carcasse.svi_carcasse_status) {
        if (!carcasse.svi_carcasse_status) {
          console.log(
            index,
            'NOTHING BEFORE NOW NEW STATUS',
            carcasse.svi_carcasse_status,
            newStatus,
            carcasse.zacharie_carcasse_id,
            carcasse.Fei.automatic_closed_at,
          );
          // await prisma.carcasse.update({
          //   where: { zacharie_carcasse_id: carcasse.zacharie_carcasse_id },
          //   data: {
          //     svi_carcasse_status: newStatus,
          //     svi_carcasse_status_set_at: carcasse.Fei.automatic_closed_at,
          //   },
          // });
        } else {
          console.log(
            index,
            'CHANGE STATUS',
            carcasse.svi_carcasse_status,
            newStatus,
            carcasse.zacharie_carcasse_id,
            carcasse.Fei.automatic_closed_at,
            carcasse.Fei.svi_closed_at,
            carcasse.Fei.svi_assigned_at,
          );
          await prisma.carcasse.update({
            where: { zacharie_carcasse_id: carcasse.zacharie_carcasse_id },
            data: {
              svi_carcasse_status: newStatus,
              svi_carcasse_status_set_at: carcasse.Fei.automatic_closed_at || carcasse.Fei.svi_closed_at,
            },
          });
        }
      } else {
        // console.log(index, 'NO CHANGE', carcasse.svi_carcasse_status, newStatus);
      }
    }
  }
  console.log('DONE');
})();
