// import { User, Prisma } from "@prisma/client";

// type FeiWithRelations = Prisma.FeiGetPayload<{
//   include: {
//     Carcasse: true;
//     FeiDetenteurInitialUser: true;
//     FeiExaminateurInitialUser: true;
//     FeiCollecteurProEntity: true;
//     FeiCollecteurProUser: true;
//     FeiEtgEntity: true;
//     FeiCreatedByUser: true;
//     FeiEtgUser: true;
//     FeiExploitantCentreCollecteEntity: true;
//     FeiExploitantCentreCollecteUser: true;
//     FeiSviEntity: true;
//     FeiSviUser: true;
//   };
// }>;

// enum FeiStatus {
//   NOT_READY,
//   READY,
//   DONE,
// }

// export function getFeiActionToDoForCurrentUser(user: User, fei: FeiWithRelations) {
//   if (fei.fei_current_owner_user_id === user.id) {
//   }

//   export function feiStatusWithExaminateurInitial(fei: FeiWithRelations): FeiStatus {
//     console.log("CHECK STATUS FEI POUR EXAMINATEUR INITIAL");
//     if (!fei.examinateur_initial_user_id) {
//       // ce n'est pas encore au tour de l'examinateur initial
//       return FeiStatus.NOT_READY;
//     }
//     // deux choses à faire: examen des carcasses, données de chasse, responsable suivant
//     // carcasses
//     if (!fei.Carcasse?.length) {
//       return FeiStatus.READY;
//     }
//     // données de chasse
//     if (!fei.examinateur_initial_approbation_mise_sur_le_marche || !fei.commune_mise_a_mort || !fei.date_mise_a_mort) {
//       return FeiStatus.READY;
//     }
//     // c'est bon, tout est fait
//     return FeiStatus.DONE;
//   }

//   export function feiStatusWithDetenteurInitial(fei: FeiWithRelations): FeiStatus {
//     console.log("CHECK STATUS FEI POUR DETENTEUR INITIAL");
//     if (!fei.premier_detenteur_user_id) {
//       // ce n'est pas encore au tour du détenteur initial
//       return FeiStatus.NOT_READY;
//     }
//     // une chose à faire: dépot au centre de collecte
//     if (!fei.date_depot_centre_collecte) {
//       return FeiStatus.READY;
//     }
//   }
//   // c'est bon, tout est fait
//   return FeiStatus.DONE;
// }

// export function feiStatusWithExploitantCentreDeCollecte(fei: FeiWithRelations): FeiStatus {
//   if (!fei.exploitant_centre_collecte_user_id || !fei.exploitant_centre_collecte_entity_id) {
//     // ce n'est pas encore au tour de l'exploitant du centre de collecte
//     return FeiStatus.NOT_READY;
//   }
//   // une choses à faire: récupérer les carcasses
//   // responsable suivant
//   if (!fei.exploitant_centre_collecte_signed_at) {
//     return FeiStatus.READY;
//   }
//   // c'est bon, tout est fait
//   return FeiStatus.DONE;
// }

// export function feiStatusWithCollecteurPro(fei: FeiWithRelations): FeiStatus {
//   if (!fei.collecteur_pro_entity_id || !fei.collecteur_pro_user_id) {
//     // ce n'est pas encore au tour du collecteur pro
//     return FeiStatus.NOT_READY;
//   }
//   // une choses à faire: récupérer les carcasses
//   // responsable suivant
//   if (!fei.collecteur_pro_signed_at || !fei.date_prise_en_charge_collecteur_pro) {
//     return FeiStatus.READY;
//   }
//   // c'est bon, tout est fait
//   return FeiStatus.DONE;
// }

// export function feiStatusWithETG(fei: FeiWithRelations): FeiStatus {
//   if (!fei.etg_entity_id || !fei.etg_user_id) {
//     // ce n'est pas encore au tour de l'etg
//     return FeiStatus.NOT_READY;
//   }
//   // une choses à faire: récupérer les carcasses
//   // responsable suivant
//   if (!fei.etg_signed_at || !fei.date_prise_en_charge_etg) {
//     return FeiStatus.READY;
//   }
//   // c'est bon, tout est fait
//   return FeiStatus.DONE;
// }

// export function feiStatusWithSVI(fei: FeiWithRelations): FeiStatus {
//   if (!fei.svi_entity_id || !fei.svi_user_id) {
//     // ce n'est pas encore au tour de la svi
//     return FeiStatus.NOT_READY;
//   }
//   // une choses à faire: récupérer les carcasses et saisir celles à saisir
//   if (!fei.svi_signed_at) {
//     return FeiStatus.READY;
//   }
//   // c'est bon, tout est fait
//   return FeiStatus.DONE;
// }
