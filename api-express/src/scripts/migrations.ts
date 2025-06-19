import prisma from '~/prisma';
import { EntityTypes, UserRoles } from '@prisma/client';
import { formatCountCarcasseByEspece } from '~/utils/count-carcasses';
/* 
prisma.fei
  .findMany({
    where: {
      numero: 'ZACH-20250130-BK7LC-195237',
    },
    include: {
      Carcasses: true,
    },
  })
  .then(async (feis) => {
    for (const fei of feis) {
      const nombreDAnimaux = formatCountCarcasseByEspece(fei.Carcasses).filter(Boolean).join('\n');
      await prisma.fei.update({
        where: { numero: fei.numero },
        data: { resume_nombre_de_carcasses: nombreDAnimaux },
      });
    }
    console.log('done renaming all resume_nombre_de_carcasses');
  });
 */
// prisma.user
//   .findMany({
//     where: {
//       at_least_one_fei_treated: null,
//       roles: { hasSome: [UserRoles.PREMIER_DETENTEUR, UserRoles.EXAMINATEUR_INITIAL] },
//     },
//     include: {
//       FeiExaminateurInitialUser: true,
//       FeiPremierDetenteurUser: true,
//     },
//   })
//   .then(async (users) => {
//     console.log(users.length);
//     for (const user of users) {
//       let atLeastOneFeiTreated = false;
//       if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
//         if (user.FeiExaminateurInitialUser.length > 0) {
//           const feis = user.FeiExaminateurInitialUser.filter(
//             (fei) =>
//               !fei.deleted_at &&
//               fei.examinateur_initial_date_approbation_mise_sur_le_marche &&
//               fei.examinateur_initial_user_id === user.id,
//           ).sort((a, b) => {
//             return (
//               a.examinateur_initial_date_approbation_mise_sur_le_marche.getTime() -
//               b.examinateur_initial_date_approbation_mise_sur_le_marche.getTime()
//             );
//           });
//           if (feis.length > 0) {
//             atLeastOneFeiTreated = true;
//             await prisma.user.update({
//               where: { id: user.id },
//               data: {
//                 at_least_one_fei_treated: feis[0].examinateur_initial_date_approbation_mise_sur_le_marche,
//               },
//             });
//           }
//         }
//       }
//       if (atLeastOneFeiTreated) {
//         continue;
//       }
//       if (user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
//         if (user.FeiPremierDetenteurUser.length > 0) {
//           const feis = user.FeiPremierDetenteurUser.filter(
//             (fei) =>
//               !fei.deleted_at &&
//               fei.fei_current_owner_user_id !== user.id &&
//               fei.premier_detenteur_user_id === user.id,
//           ).sort((a, b) => {
//             return (
//               a.updated_at.getTime() -
//               b.updated_at.getTime()
//             );
//           });
//           if (feis.length > 0) {
//             await prisma.user.update({
//               where: { id: user.id },
//               data: {
//                 at_least_one_fei_treated: feis[0].updated_at,
//               },
//             });
//           }
//         }
//       }
//     }
//   });

// prisma.carcasse
//   .findMany({
//     where: {},
//   })
//   .then(async (carcasses) => {
//     for (const carcasse of carcasses) {
//       const status = updateCarcasseStatus(carcasse);
//       await prisma.carcasse.update({
//         where: { zacharie_carcasse_id: carcasse.zacharie_carcasse_id },
//         data: { svi_carcasse_status: status },
//       });
//     }
//     console.log('done');
//   });

// prisma.entity
//   .findMany({
//     where: {
//       at_least_one_fei_treated: null,
//       type: { in: [EntityTypes.ETG, EntityTypes.SVI] },
//     },
//     include: {
//       FeiIntermediairesEntity: {
//         where: {
//           fei_intermediaire_entity_id: {
//             not: '57c2c9bc-1d4a-4098-8f81-014200966233',
//           },
//           Fei: {
//             premier_detenteur_entity_id: {
//               notIn: [
//                 'd207597a-5526-4fcf-989d-dc3f70fbc2eb',
//                 '895aa9a6-afd4-42c1-b7d6-f632145b7471',
//                 '5fb179a9-87d4-416b-a52b-ccf127b97926',
//                 '86c9cec6-2f0e-4df1-adb2-d8bac3566dfd',
//               ],
//             },
//           },
//         },
//       },
//       FeisSviEntity: {
//         where: {
//           premier_detenteur_entity_id: {
//             notIn: [
//               'd207597a-5526-4fcf-989d-dc3f70fbc2eb',
//               '895aa9a6-afd4-42c1-b7d6-f632145b7471',
//               '5fb179a9-87d4-416b-a52b-ccf127b97926',
//               '86c9cec6-2f0e-4df1-adb2-d8bac3566dfd',
//             ],
//           },
//           svi_entity_id: {
//             not: '9a8d515e-2ede-4519-b21c-de7568ea5ae0',
//           },
//         },
//       },
//     },
//   })
//   .then(async (entities) => {
//     for (const entity of entities) {
//       if (entity.type === EntityTypes.ETG) {
//         if (entity.FeiIntermediairesEntity.length > 0) {
//           await prisma.entity.update({
//             where: { id: entity.id },
//             data: {
//               at_least_one_fei_treated: entity.FeiIntermediairesEntity[0].created_at,
//             },
//           });
//         }
//       }
//       if (entity.type === EntityTypes.SVI) {
//         if (entity.FeisSviEntity.length > 0) {
//           await prisma.entity.update({
//             where: { id: entity.id },
//             data: {
//               at_least_one_fei_treated: entity.FeisSviEntity[0].created_at,
//             },
//           });
//         }
//       }
//     }
//   });
/* 
prisma.carcasseIntermediaire
  .findMany({
    where: {
      intermediaire_id: null,
    },
    include: {
      CarcasseIntermediaireFeiIntermediaire: true,
    },
  })
  .then(async (carcasseIntermediaires) => {
    for (const carcasseIntermediaire of carcasseIntermediaires) {
      const feiIntermediaire = carcasseIntermediaire.CarcasseIntermediaireFeiIntermediaire;
      if (feiIntermediaire) {
        const feiIntermediaireId = feiIntermediaire.id; // {user_id}_{fei_numero}_{HHMMSS}
        const newIntermediaireId = feiIntermediaireId
          .split('_')
          .filter((str, index) => index !== 1)
          .join('_');
        await prisma.carcasseIntermediaire.update({
          where: {
            fei_numero__bracelet__intermediaire_id:
              carcasseIntermediaire.fei_numero__bracelet__intermediaire_id,
          },
          data: {
            id: crypto.randomUUID(),
            decision_at: carcasseIntermediaire.carcasse_check_finished_at,
            prise_en_charge_at: feiIntermediaire.check_finished_at,
            intermediaire_id: newIntermediaireId,
            intermediaire_entity_id: feiIntermediaire.fei_intermediaire_entity_id,
            intermediaire_user_id: feiIntermediaire.fei_intermediaire_user_id,
            intermediaire_role: feiIntermediaire.fei_intermediaire_role,
          },
        });
      }
    }
    console.log('done migrating carcasseIntermediaire');
  });
  */
/* prisma.carcasseIntermediaire.findMany({ where: {} }).then(async (carcasseIntermediaires) => {
  for (const carcasseIntermediaire of carcasseIntermediaires) {
    await prisma.carcasseIntermediaire.update({
      where: {
        fei_numero_zacharie_carcasse_id_intermediaire_id: {
          fei_numero: carcasseIntermediaire.fei_numero,
          zacharie_carcasse_id: carcasseIntermediaire.zacharie_carcasse_id,
          intermediaire_id: carcasseIntermediaire.intermediaire_id,
        },
      },
      data: {
        intermediaire_id: carcasseIntermediaire.fei_intermediaire_id,
      },
    });
  }
  console.log('done migrating carcasseIntermediaire');
});
 */
