import {
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  FeiOwnerRole,
  User,
  UserRoles,
} from '@prisma/client';
import prisma from '~/prisma';
import sendNotificationToUser from '~/service/notifications';
import { formatManualValidationSviEmail, formatSviAssignedEmail } from '~/utils/formatCarcasseEmail';
import { sendWebhook } from '~/utils/api';
import {
  updateBrevoChasseurDeal,
  updateBrevoETGDealPremiereFiche,
  updateBrevoSVIDealPremiereFiche,
} from '~/third-parties/brevo';
import { getFichePdf } from '~/templates/get-fiche-pdf';
import type { FeiPopulated } from '~/types/fei';

export async function webhookApprobation(existingFei: FeiPopulated, savedFei: FeiPopulated) {
  if (
    existingFei.examinateur_initial_date_approbation_mise_sur_le_marche !==
    savedFei.examinateur_initial_date_approbation_mise_sur_le_marche
  ) {
    await sendWebhook(savedFei.examinateur_initial_user_id!, 'FEI_APPROBATION_MISE_SUR_LE_MARCHE', {
      feiNumero: savedFei.numero,
    });
  }
}

export async function syncCarcasseDates(existingFei: FeiPopulated, savedFei: FeiPopulated) {
  if (existingFei.date_mise_a_mort !== savedFei.date_mise_a_mort) {
    await prisma.carcasse.updateMany({
      where: { fei_numero: savedFei.numero },
      data: { date_mise_a_mort: savedFei.date_mise_a_mort },
    });
  }
}

export async function trackFirstFeiTreated(existingFei: FeiPopulated, savedFei: FeiPopulated, user: User) {
  if (user.at_least_one_fei_treated) return;

  if (user.roles.includes(UserRoles.CHASSEUR)) {
    if (savedFei.examinateur_initial_user_id === user.id) {
      if (savedFei.examinateur_initial_date_approbation_mise_sur_le_marche) {
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            at_least_one_fei_treated: savedFei.examinateur_initial_date_approbation_mise_sur_le_marche,
          },
        });
        await updateBrevoChasseurDeal(updatedUser);
      }
    } else if (savedFei.premier_detenteur_user_id === user.id) {
      if (savedFei.fei_current_owner_user_id !== user.id) {
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: { at_least_one_fei_treated: savedFei.updated_at },
        });
        await updateBrevoChasseurDeal(updatedUser);
      }
    }
  }
}

export async function trackEtgFirstFei(existingFei: FeiPopulated, savedFei: FeiPopulated) {
  if (
    existingFei.fei_current_owner_role === UserRoles.ETG &&
    savedFei.fei_current_owner_role !== UserRoles.ETG
  ) {
    const etg = await prisma.entity.findUnique({
      where: {
        id: savedFei.fei_current_owner_entity_id,
        deleted_at: null,
      },
    });
    if (etg?.type === EntityTypes.ETG) {
      if (!etg.at_least_one_fei_treated) {
        await updateBrevoETGDealPremiereFiche(etg);
      }
    }
  }
}

export async function webhookOwnerChange(existingFei: FeiPopulated, savedFei: FeiPopulated) {
  if (existingFei.fei_current_owner_role !== savedFei.fei_current_owner_role) {
    await sendWebhook(savedFei.fei_current_owner_user_id!, 'FEI_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      feiNumero: savedFei.numero,
    });
  }
}

/**
 * Notifies SVI users when a FEI is assigned to them.
 * Returns true if this side effect fired (to skip generic next-owner notifications).
 */
export async function notifySviAssignment(existingFei: FeiPopulated, savedFei: FeiPopulated): Promise<boolean> {
  if (
    existingFei.fei_next_owner_role === FeiOwnerRole.SVI ||
    savedFei.fei_next_owner_role !== FeiOwnerRole.SVI
  ) {
    return false;
  }

  const sviUsers = await prisma.user.findMany({
    where: {
      roles: { has: UserRoles.SVI },
      EntityAndUserRelations: {
        some: {
          entity_id: savedFei.svi_entity_id!,
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: {
            in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
          },
        },
      },
    },
  });
  for (const sviUser of sviUsers) {
    const [object, email] = await formatSviAssignedEmail(savedFei);
    await sendNotificationToUser({
      user: sviUser,
      title: object,
      body: email,
      email: email,
      notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
    });
  }

  const svi = await prisma.entity.findUnique({
    where: {
      deleted_at: null,
      id: savedFei.fei_current_owner_entity_id,
    },
  });
  if (svi?.type === EntityTypes.SVI) {
    if (!svi.at_least_one_fei_treated) {
      await updateBrevoSVIDealPremiereFiche(svi);
    }
  }

  const examinateur = savedFei.FeiExaminateurInitialUser;
  if (examinateur) {
    await sendWebhook(examinateur.id, 'FEI_ASSIGNEE_AU_SVI', { feiNumero: savedFei.numero });
  }
  const premierDetenteur = savedFei.FeiPremierDetenteurUser;
  if (premierDetenteur && premierDetenteur.id !== examinateur?.id) {
    await sendWebhook(premierDetenteur.id, 'FEI_ASSIGNEE_AU_SVI', { feiNumero: savedFei.numero });
  }

  return true;
}

/**
 * Notifies circuit court entity users (commerce de détail, repas de chasse, consommateur final).
 * Returns true if this side effect fired (to skip generic next-owner notifications).
 */
export async function notifyCircuitCourt(
  existingFei: FeiPopulated,
  savedFei: FeiPopulated,
  user: User,
): Promise<boolean> {
  if (existingFei.fei_next_owner_role === savedFei.fei_next_owner_role) {
    return false;
  }

  const circuitCourtRoles: Array<FeiOwnerRole> = [
    FeiOwnerRole.COMMERCE_DE_DETAIL,
    FeiOwnerRole.REPAS_DE_CHASSE_OU_ASSOCIATIF,
    FeiOwnerRole.CONSOMMATEUR_FINAL,
  ];
  if (!circuitCourtRoles.includes(savedFei.fei_next_owner_role)) {
    return false;
  }

  const usersWorkingForEntity = (
    await prisma.entityAndUserRelations.findMany({
      where: {
        entity_id: savedFei.fei_next_owner_entity_id!,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: {
          in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
        },
        deleted_at: null,
      },
      include: {
        UserRelatedWithEntity: {
          select: {
            id: true,
            web_push_tokens: true,
            native_push_tokens: true,
            notifications: true,
            prenom: true,
            nom_de_famille: true,
            email: true,
          },
        },
      },
    })
  ).map((relation) => relation.UserRelatedWithEntity);

  for (const nextOwner of usersWorkingForEntity) {
    if (nextOwner.id !== user.id) {
      const email = [
        `Bonjour,`,
        `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Vous trouverez un résumé en pièce jointe, à conserver pour votre enregistrement.`,
        `Pour consulter la fiche, rendez-vous sur Zacharie avec votre email ${nextOwner.email} : https://zacharie.beta.gouv.fr/app/tableau-de-bord/fei/${savedFei.numero}`,
        `Ce message a été généré automatiquement par l'application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
      ].join('\n\n');
      await sendNotificationToUser({
        user: nextOwner as User,
        title: `${user.prenom} ${user.nom_de_famille} vous a attribué une fiche d'examen initial du gibier sauvage n° ${savedFei?.numero}`,
        body: email,
        email: email,
        notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
        attachments: [
          {
            content: await getFichePdf(savedFei),
            name: `${savedFei.numero}.pdf`,
          },
        ],
      });
    }
  }

  const examinateur = savedFei.FeiExaminateurInitialUser;
  if (examinateur) {
    await sendWebhook(examinateur.id, 'FEI_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      feiNumero: savedFei.numero,
    });
  }
  const premierDetenteur = savedFei.FeiPremierDetenteurUser;
  if (premierDetenteur && premierDetenteur.id !== examinateur?.id) {
    await sendWebhook(premierDetenteur.id, 'FEI_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      feiNumero: savedFei.numero,
    });
  }

  return true;
}

export async function notifyNextOwnerUser(existingFei: FeiPopulated, savedFei: FeiPopulated, user: User) {
  const nextOwnerId = savedFei.fei_next_owner_user_id;
  if (!nextOwnerId || nextOwnerId === existingFei.fei_next_owner_user_id) {
    return;
  }

  if (nextOwnerId !== user.id) {
    const nextOwner = await prisma.user.findUnique({
      where: { id: nextOwnerId },
    });
    const email = [
      `Bonjour,`,
      `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Rendez vous sur Zacharie pour la traiter.`,
      `Pour consulter la fiche, rendez-vous sur Zacharie : https://zacharie.beta.gouv.fr/app/tableau-de-bord/fei/${savedFei.numero}`,
      `Ce message a été généré automatiquement par l'application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
    ].join('\n\n');
    await sendNotificationToUser({
      user: nextOwner!,
      title: `${user.prenom} ${user.nom_de_famille} vous a attribué la fiche ${savedFei?.numero}`,
      body: email,
      email: email,
      notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
    });
  } else {
    console.log('next owner is the same user', nextOwnerId, user.id);
  }

  if (existingFei.fei_next_owner_user_id) {
    console.log('need to send notification remove fiche');
    const exNextOwner = await prisma.user.findUnique({
      where: { id: existingFei.fei_next_owner_user_id },
    });
    const email = [
      `Bonjour,`,
      `${user.prenom} ${user.nom_de_famille} vous avait attribué par erreur la fiche d'examen initial n° ${savedFei?.numero}.`,
      'Cette erreur vient d\u2019être corrigée : vous n\u2019êtes plus destinataire de cette fiche.',
      `Pour consulter la fiche, rendez-vous sur Zacharie : https://zacharie.beta.gouv.fr/app/tableau-de-bord/fei/${savedFei.numero}`,
      `Ce message a été généré automatiquement par l'application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
    ].join('\n\n');
    await sendNotificationToUser({
      user: exNextOwner!,
      title: `La fiche n° ${savedFei?.numero} ne vous est plus attribuée`,
      body: email,
      email: email,
      notificationLogAction: `FEI_REMOVED_FROM_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
    });
  }
}

export async function notifyNextOwnerEntity(existingFei: FeiPopulated, savedFei: FeiPopulated, user: User) {
  if (
    !savedFei.fei_next_owner_entity_id ||
    savedFei.fei_next_owner_entity_id === existingFei.fei_next_owner_entity_id
  ) {
    return;
  }

  const usersWorkingForEntity = (
    await prisma.entityAndUserRelations.findMany({
      where: {
        entity_id: savedFei.fei_next_owner_entity_id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: {
          in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
        },
        deleted_at: null,
      },
      include: {
        UserRelatedWithEntity: {
          select: {
            id: true,
            web_push_tokens: true,
            native_push_tokens: true,
            notifications: true,
            prenom: true,
            nom_de_famille: true,
            email: true,
          },
        },
      },
    })
  ).map((relation) => relation.UserRelatedWithEntity);

  for (const nextOwner of usersWorkingForEntity) {
    if (nextOwner.id !== user.id) {
      const email = [
        `Bonjour,`,
        `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Rendez vous sur Zacharie pour la traiter.`,
        `Pour consulter la fiche, rendez-vous sur Zacharie : https://zacharie.beta.gouv.fr/app/tableau-de-bord/fei/${savedFei.numero}`,
        `Ce message a été généré automatiquement par l'application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
      ].join('\n\n');
      await sendNotificationToUser({
        user: nextOwner as User,
        title: `${user.prenom} ${user.nom_de_famille} vous a attribué la fiche ${savedFei?.numero}`,
        body: email,
        email: email,
        notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
      });
    }
  }

  const examinateur = savedFei.FeiExaminateurInitialUser;
  if (examinateur) {
    await sendWebhook(examinateur.id, 'FEI_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      feiNumero: savedFei.numero,
    });
  }
  const premierDetenteur = savedFei.FeiPremierDetenteurUser;
  if (premierDetenteur && premierDetenteur.id !== examinateur?.id) {
    await sendWebhook(premierDetenteur.id, 'FEI_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      feiNumero: savedFei.numero,
    });
  }
}

export async function notifySviClose(existingFei: FeiPopulated, savedFei: FeiPopulated) {
  if (existingFei.svi_closed_by_user_id || !savedFei.svi_closed_by_user_id) {
    return;
  }

  const [object, email] = await formatManualValidationSviEmail(savedFei, savedFei.Carcasses);
  const notification = {
    title: object,
    body: email,
    email: email,
    notificationLogAction: `FEI_AUTO_CLOSED_${savedFei.numero}`,
  };

  const examinateur = savedFei.FeiExaminateurInitialUser;
  if (examinateur) {
    await sendNotificationToUser({
      user: examinateur,
      ...notification,
    });
    await sendWebhook(examinateur.id, 'FEI_CLOTUREE', { feiNumero: savedFei.numero });
  }

  const premierDetenteur = savedFei.FeiPremierDetenteurUser;
  if (premierDetenteur && premierDetenteur.id !== examinateur?.id) {
    await sendNotificationToUser({
      user: premierDetenteur,
      ...notification,
    });
    await sendWebhook(premierDetenteur.id, 'FEI_CLOTUREE', { feiNumero: savedFei.numero });
  }
}

export async function webhookIntermediaireClose(existingFei: FeiPopulated, savedFei: FeiPopulated) {
  if (existingFei.intermediaire_closed_at || !savedFei.intermediaire_closed_at) {
    return;
  }

  const examinateur = savedFei.FeiExaminateurInitialUser;
  if (examinateur) {
    await sendWebhook(examinateur.id, 'FEI_CLOTUREE', { feiNumero: savedFei.numero });
  }
  const premierDetenteur = savedFei.FeiPremierDetenteurUser;
  if (premierDetenteur && premierDetenteur.id !== examinateur?.id) {
    await sendWebhook(premierDetenteur.id, 'FEI_CLOTUREE', { feiNumero: savedFei.numero });
  }
}

/**
 * Runs all side effects after a FEI update.
 * SVI assignment and circuit court notifications are mutually exclusive
 * with generic next-owner notifications (matches original early-return flow).
 */
export async function runFeiUpdateSideEffects(existingFei: FeiPopulated, savedFei: FeiPopulated, user: User) {
  await webhookApprobation(existingFei, savedFei);
  await webhookOwnerChange(existingFei, savedFei);
  await syncCarcasseDates(existingFei, savedFei);
  await trackFirstFeiTreated(existingFei, savedFei, user);
  await trackEtgFirstFei(existingFei, savedFei);

  // Mutually exclusive notification paths (matches original early-return flow)
  const handledBySvi = await notifySviAssignment(existingFei, savedFei);
  if (handledBySvi) return;

  const handledByCircuitCourt = await notifyCircuitCourt(existingFei, savedFei, user);
  if (handledByCircuitCourt) return;

  await notifyNextOwnerUser(existingFei, savedFei, user);
  await notifyNextOwnerEntity(existingFei, savedFei, user);
  await notifySviClose(existingFei, savedFei);
  await webhookIntermediaireClose(existingFei, savedFei);
}
