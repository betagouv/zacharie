import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { RequestWithUser } from '~/types/request';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import {
  createBrevoContact,
  linkBrevoCompanyToContact,
  sendEmail,
  unlinkBrevoCompanyToContact,
  updateBrevoChasseurDeal,
  updateBrevoContact,
} from '~/third-parties/brevo';
import { capture } from '~/third-parties/sentry';
import createUserId from '~/utils/createUserId';
import { comparePassword, hashPassword } from '~/service/crypto';
import { userFeiSelect, type UserForFei } from '~/types/user';
import type {
  UserConnexionResponse,
  UserMyRelationsResponse,
  UserForFeiResponse,
  UserEntityResponse,
} from '~/types/responses';
import type { EntityWithUserRelation } from '~/types/entity';
import {
  EntityRelationType,
  EntityTypes,
  Prisma,
  Entity,
  ETGAndEntityRelations,
  User,
  UserNotifications,
  UserRelationType,
  UserRoles,
  FeiOwnerRole,
  UserEtgRoles,
  EntityRelationStatus,
  ApiKeyApprovalStatus,
} from '@prisma/client';
import { authorizeUserOrAdmin } from '~/utils/authorizeUserOrAdmin.server';
import { cookieOptions, JWT_MAX_AGE, logoutCookieOptions } from '~/utils/cookie';
import sendNotificationToUser from '~/service/notifications';
import { SECRET } from '~/config';
import { autoActivatePremierDetenteur, hasAllRequiredFields } from '~/utils/user';
// import { refreshMaterializedViews } from '~/utils/refreshMaterializedViews';
import { z } from 'zod';
import { sanitize } from '~/utils/sanitize';
// import { refreshMaterializedViews } from '~/utils/refreshMaterializedViews';

const connexionSchema = z.object({
  email: z.string().email(),
  username: z.string().optional(),
  passwordUser: z.string(),
  connexionType: z.enum(['creation-de-compte', 'compte-existant']),
  resetPasswordRequest: z.boolean().optional(),
  resetPasswordToken: z.string().optional(),
});

router.post(
  '/connexion',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<UserConnexionResponse>,
      next: express.NextFunction,
    ) => {
      let result = connexionSchema.safeParse(req.body);
      let { email, username, passwordUser, connexionType, resetPasswordRequest, resetPasswordToken } =
        result.data;
      if (!result.success) {
        res.status(400).send({
          ok: false,
          data: { user: null },
          message: '',
          error: result.error.message,
        });
        return;
      }

      email = email.toLowerCase().trim();
      if (username) {
        capture(new Error('Spam detected'), {
          extra: { email, message: 'Spam detected' },
        });
        // honey pot
        res.status(200).send({ ok: true, data: null, message: null, error: null });
        return;
      }
      if (!email) {
        res.status(400).send({
          ok: false,
          data: { user: null },
          message: '',
          error: 'Veuillez renseigner votre email',
        });
        return;
      }
      if (resetPasswordRequest) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user?.email) {
          const password = await prisma.password.findFirst({
            where: { user_id: user.id },
          });
          if (!password) {
            res.status(200).send({
              ok: true,
              data: { user: null },
              error: '',
              message: 'Vous pouvez désormais vous connecter avec votre email et créer un mot de passe',
            });
            return;
          }
          if (password?.reset_password_last_email_sent_at) {
            const sentMinutesAgo = dayjs().diff(password.reset_password_last_email_sent_at, 'minute');
            if (sentMinutesAgo < 5) {
              res.status(400).send({
                ok: false,
                data: { user: null },
                error: '',
                message: `Un email de réinitialisation a déjà été envoyé, veuillez patienter encore ${
                  5 - sentMinutesAgo
                } minutes`,
              });
              return;
            }
          }
          const token = crypto.randomUUID();
          await prisma.password.update({
            where: { user_id: user.id },
            data: {
              reset_password_token: token,
              reset_password_last_email_sent_at: new Date(),
            },
          });
          const text = `Bonjour, vous avez demandé à réinitialiser votre mot de passe. Pour ce faire, veuillez cliquer sur le lien suivant : https://zacharie.beta.gouv.fr/app/connexion?reset-password-token=${token}&type=compte-existant`;
          sendEmail({
            emails: process.env.NODE_ENV !== 'production' ? ['arnaud@ambroselli.io'] : [user.email!],
            subject: '[Zacharie] Réinitialisation de votre mot de passe',
            text,
          });
          res.status(200).send({
            ok: true,
            data: { user: null },
            error: '',
            message: 'Un email de réinitialisation de mot de passe a été envoyé',
          });
          return;
        }
      }
      if (resetPasswordToken) {
        const password = await prisma.password.findFirst({
          where: { reset_password_token: resetPasswordToken },
        });
        if (!password) {
          res.status(400).send({
            ok: false,
            data: { user: null },
            error: '',
            message: 'Le lien de réinitialisation de mot de passe est invalide. Veuillez réessayer.',
          });
          return;
        }
        if (dayjs().diff(password.reset_password_last_email_sent_at, 'minutes') > 60) {
          res.status(400).send({
            ok: false,
            data: { user: null },
            error: '',
            message: 'Le lien de réinitialisation de mot de passe a expiré. Veuillez réessayer.',
          });
          return;
        }
        await prisma.password.delete({
          where: { user_id: password.user_id },
        });
      }
      if (!passwordUser) {
        res.status(400).send({
          ok: false,
          data: { user: null },
          message: '',
          error: 'Veuillez renseigner votre mot de passe',
        });
        return;
      }
      if (!connexionType) {
        res.status(400).send({
          ok: false,
          data: { user: null },
          message: '',
          error: "L'URL de connexion est incorrecte",
        });
        return;
      }

      let user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        if (connexionType === 'creation-de-compte') {
          res.status(400).send({
            ok: false,
            data: { user: null },
            message: '',
            error: 'Un compte existe déjà avec cet email',
          });
          return;
        }
      }
      if (!user) {
        if (connexionType === 'compte-existant') {
          res.status(400).send({
            ok: false,
            data: { user: null },
            message: '',
            error: "L'email est incorrect, ou vous n'avez pas encore de compte",
          });
          return;
        }
        user = await prisma.user.create({
          data: {
            id: await createUserId(),
            email,
            activated: false,
            prefilled: false,
            // depuis le 14 octobre 2025, on ne peut plus créer de compte ETG/SVI/COLLECTEUR_PRO
            // sans avoir au préalable été invité par un membre de son entreprise/service
            // de sorte que tous les utilisateurs créés depuis le 14 octobre 2025 sont CHASSEURS
            // et qu'en mettant ce rôle ici, on permet de passer à l'étape suivante dans l'onboarding (ie. mes coordonnées)
            roles: [UserRoles.CHASSEUR],
          },
        });
        await createBrevoContact(user, 'USER');
        await updateBrevoChasseurDeal(user);
      }
      const hashedPassword = await hashPassword(passwordUser);

      const existingPassword = await prisma.password.findFirst({
        where: { user_id: user.id },
      });
      if (!existingPassword) {
        await prisma.password.create({
          data: { user_id: user.id, password: hashedPassword },
        });
      } else {
        const isOk = await comparePassword(passwordUser, existingPassword.password);
        if (!isOk) {
          if (connexionType === 'compte-existant') {
            res.status(400).send({
              ok: false,
              data: { user: null },
              message: '',
              error: 'Le mot de passe est incorrect',
            });
            return;
          } else {
            res.status(400).send({
              ok: false,
              data: { user: null },
              message: '',
              error: 'Un compte existe déjà avec cet email',
            });
            return;
          }
        }
      }
      const token = jwt.sign({ userId: user.id }, SECRET, {
        expiresIn: JWT_MAX_AGE,
      });
      user = await prisma.user.update({
        where: { id: user.id },
        data: { last_login_at: new Date() },
      });
      // refreshMaterializedViews();
      res.cookie(
        'zacharie_express_jwt',
        token,
        cookieOptions(req.headers.host.includes('localhost') ? true : false),
      );
      res.status(200).send({ ok: true, data: { user }, message: '', error: '' });
    },
  ),
);

const accessTokenSchema = z.object({
  accessToken: z.string(),
});
router.post(
  '/access-token',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<UserConnexionResponse>,
      next: express.NextFunction,
    ) => {
      let result = accessTokenSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).send({
          ok: false,
          data: { user: null },
          message: '',
          error: result.error.message,
        });
        return;
      }
      let { accessToken } = result.data;
      if (!accessToken) {
        res.status(400).send({
          ok: false,
          data: { user: null },
          message: '',
          error: 'Veuillez renseigner votre access token',
        });
        return;
      }

      let user = await prisma.apiKeyApprovalByUserOrEntity
        .findUnique({
          where: { access_token: accessToken },
          include: {
            User: true,
          },
        })
        .then((approval) => {
          if (!approval) {
            res.status(400).send({
              ok: false,
              data: { user: null },
              message: '',
              error: 'Le lien de connexion est invalide. Veuillez réessayer.',
            });
            return;
          }
          if (dayjs().diff(approval.access_token_created_at, 'minutes') > 5) {
            res.status(400).send({
              ok: false,
              data: { user: null },
              message: '',
              error: 'Le lien de connexion a expiré. Veuillez réessayer.',
            });
            return;
          }
          if (approval.status !== ApiKeyApprovalStatus.APPROVED) {
            res.status(400).send({
              ok: false,
              data: { user: null },
              message: '',
              error: "Le lien de connexion n'a pas été approuvé. Veuillez réessayer.",
            });
            return;
          }
          return approval.User;
        });

      if (!user) {
        res.status(400).send({
          ok: false,
          data: { user: null },
          message: '',
          error: 'Une erreur est survenue. Veuillez réessayer.',
        });
        return;
      }

      const token = jwt.sign({ userId: user.id }, SECRET, {
        expiresIn: JWT_MAX_AGE,
      });
      user = await prisma.user.update({
        where: { id: user.id },
        data: { last_login_at: new Date() },
      });
      // refreshMaterializedViews();
      res.cookie(
        'zacharie_express_jwt',
        token,
        cookieOptions(req.headers.host.includes('localhost') ? true : false),
      );
      res.status(200).send({ ok: true, data: { user }, message: '', error: '' });
    },
  ),
);

const userEntitySchema = z.object({
  owner_id: z.string(),
  entity_id: z.string(),
  numero_ddecpp: z.string().optional(),
  type: z.enum(Object.values(EntityTypes) as [EntityTypes, ...EntityTypes[]]),
  _action: z.enum(['create', 'delete', 'update']),
  relation: z.enum(Object.values(EntityRelationType) as [EntityRelationType, ...EntityRelationType[]]),
  status: z
    .enum(Object.values(EntityRelationStatus) as [EntityRelationStatus, ...EntityRelationStatus[]])
    .optional(),
});

router.post(
  '/user-entity/:user_id',
  passport.authenticate('user', { session: false, failWithError: true }),
  // authorizeUserOrAdmin,
  catchErrors(
    async (req: RequestWithUser, res: express.Response<UserEntityResponse>, next: express.NextFunction) => {
      let result = userEntitySchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).send({
          ok: false,
          data: { relation: null, entity: null },
          error: result.error.message,
        });
        return;
      }
      let body = result.data;
      const userId = req.params.user_id;
      let isAdmin = req.user.roles.includes(UserRoles.ADMIN);

      if (!body.owner_id) {
        res
          .status(400)
          .send({ ok: false, data: { relation: null, entity: null }, error: 'Missing owner_id' });
        return;
      }

      let entityId: string = body.entity_id;
      if (body.numero_ddecpp && body.type === EntityTypes.CCG) {
        const sanitizedNumeroDdecpp = body.numero_ddecpp.toLowerCase().includes('ccg')
          ? body.numero_ddecpp
              .split('-')
              .map((part: string, index: number) => {
                if (index === 2) {
                  return part.replace(/^0+/, '');
                }
                if (index === 1) {
                  return part.toLocaleUpperCase();
                }
                return part;
              })
              .join('-')
          : body.numero_ddecpp;
        const entity = await prisma.entity.findFirst({
          where: {
            deleted_at: null,
            numero_ddecpp: sanitizedNumeroDdecpp,
            type: body.type as EntityTypes,
          },
        });
        if (!entity) {
          res.status(404).send({
            ok: false,
            data: { relation: null, entity: null },
            error: "Ce Centre de Collecte n'existe pas",
          });
          return;
        }
        entityId = entity?.id || '';
      }

      if (!entityId) {
        res.status(400).send({
          ok: false,
          data: { relation: null, entity: null },
          error: 'Missing entity_id',
        });
        return;
      }

      if (!isAdmin) {
        const isCurrentUserAdminOfEntity = await prisma.entityAndUserRelations.findFirst({
          where: {
            owner_id: userId,
            entity_id: entityId,
            relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
            status: EntityRelationStatus.ADMIN,
            deleted_at: null,
          },
        });
        if (isCurrentUserAdminOfEntity) {
          isAdmin = true;
        }
      }

      if (!isAdmin && userId !== body.owner_id) {
        res.status(401).send({
          ok: false,
          data: { relation: null, entity: null },
          error: 'Unauthorized',
        });
        return;
      }

      // Handle create action
      if (body._action === 'create') {
        if (!body.relation) {
          res.status(400).send({
            ok: false,
            data: { relation: null, entity: null },
            error: 'Missing relation',
          });
          return;
        }

        const nextEntityRelation: Prisma.EntityAndUserRelationsUncheckedCreateInput = {
          owner_id: body.owner_id,
          entity_id: entityId,
          relation: body.relation,
          deleted_at: null,
        };
        if (body.hasOwnProperty(Prisma.EntityAndUserRelationsScalarFieldEnum.status)) {
          nextEntityRelation.status = body.status;
        }

        const existingEntityRelation = await prisma.entityAndUserRelations.findFirst({
          where: nextEntityRelation,
        });

        if (existingEntityRelation) {
          res.status(409).send({
            ok: false,
            data: { relation: null, entity: null },
            error: 'Vous avez déjà ajouté cette entité',
          });
          return;
        }

        const relation = await prisma.entityAndUserRelations.create({
          data: nextEntityRelation,
        });

        const entity = await prisma.entity.findUnique({
          where: {
            id: entityId,
            deleted_at: null,
          },
        });

        if (relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
          await linkBrevoCompanyToContact(entity, req.user);
          if (relation.status === EntityRelationStatus.REQUESTED) {
            const isAdminSettingRolesToOtherUser =
              req.user.roles.includes(UserRoles.ADMIN) && req.user.id !== body.owner_id;
            if (!isAdminSettingRolesToOtherUser) {
              const entityAdmins = await prisma.entityAndUserRelations.findMany({
                where: {
                  entity_id: entityId,
                  relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                  status: EntityRelationStatus.ADMIN,
                  deleted_at: null,
                },
                include: {
                  UserRelatedWithEntity: true,
                },
              });
              for (const entityAdminRelation of entityAdmins) {
                const email = [
                  'Bonjour,',
                  `${req.user.prenom} ${req.user.nom_de_famille} (${req.user.email}) vient de s'inscrire sur Zacharie au sein de ${entity.nom_d_usage}.`,
                  `Pour l'autoriser à traiter des fiches au nom de ${entity.nom_d_usage}, veuillez cliquer sur le lien suivant : https://zacharie.beta.gouv.fr/app/tableau-de-bord/mon-profil/mes-coordonnees?open-entity=${entity.id}`,
                  `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
                ].join('\n\n');
                await sendNotificationToUser({
                  user: entityAdminRelation.UserRelatedWithEntity,
                  title: "Un nouvel utilisateur s'est inscrit sur Zacharie au sein de votre entité",
                  body: email,
                  email: email,
                  notificationLogAction: `NEW_USER_IN_ENTITY_${entity.id}`,
                });
              }
            }
          }
        }

        res.status(200).send({ ok: true, data: { relation, entity }, error: '' });
        return;
      }

      // Handle create action
      if (body._action === 'update') {
        if (!body.relation) {
          res.status(400).send({
            ok: false,
            data: { relation: null, entity: null },
            error: 'Missing relation',
          });
          return;
        }

        const existingEntityRelation = await prisma.entityAndUserRelations.findFirst({
          where: {
            owner_id: body.owner_id,
            entity_id: entityId,
            relation: body.relation,
            deleted_at: null,
          },
        });

        if (!existingEntityRelation) {
          res.status(404).send({
            ok: false,
            data: { relation: null, entity: null },
            error: 'Relation non trouvée',
          });
          return;
        }

        const nextEntityRelation: Prisma.EntityAndUserRelationsUncheckedUpdateInput = {
          owner_id: body.owner_id,
          entity_id: entityId,
          relation: body.relation,
          deleted_at: null,
        };
        if (body.hasOwnProperty('status')) {
          nextEntityRelation.status = body.status;
        }

        const relation = await prisma.entityAndUserRelations.update({
          where: {
            id: existingEntityRelation.id,
          },
          data: nextEntityRelation,
        });

        const entity = await prisma.entity.findUnique({
          where: {
            id: entityId,
            deleted_at: null,
          },
        });

        if (relation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
          await linkBrevoCompanyToContact(entity, req.user);
        }

        res.status(200).send({ ok: true, data: { relation, entity }, error: '' });
        return;
      }

      // Handle delete action
      if (body._action === 'delete') {
        const existingEntityRelation = await prisma.entityAndUserRelations.findFirst({
          where: {
            deleted_at: null,
            owner_id: body.owner_id,
            relation: body.relation as EntityRelationType,
            entity_id: entityId,
          },
        });

        if (existingEntityRelation) {
          await prisma.entityAndUserRelations.delete({
            where: {
              id: existingEntityRelation.id,
            },
          });
        }

        if (existingEntityRelation.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
          const entity = await prisma.entity.findUnique({
            where: {
              id: entityId,
              deleted_at: null,
            },
          });

          await unlinkBrevoCompanyToContact(entity, req.user);
        }

        res.status(200).send({ ok: true, data: { relation: null, entity: null }, error: '' });
        return;
      }

      res.status(400).send({
        ok: false,
        data: { relation: null, entity: null },
        error: 'Invalid action',
      });
    },
  ),
);

router.post(
  '/logout',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.clearCookie(
      'zacharie_express_jwt',
      logoutCookieOptions(req.headers.host.includes('localhost') ? true : false),
    );
    res.status(200).send({ ok: true });
  }),
);

const trouverPremierDetenteurBodySchema = z.object({
  email: z.string().email(),
  numero: z.string(),
});
router.post(
  '/fei/trouver-premier-detenteur',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(
    async (req: RequestWithUser, res: express.Response<UserForFeiResponse>, next: express.NextFunction) => {
      const user = req.user!;
      let result = trouverPremierDetenteurBodySchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).send({
          ok: false,
          data: { user: null },
          error: result.error.message,
        });
        return;
      }
      let body = result.data;

      if (!body.hasOwnProperty(Prisma.UserScalarFieldEnum.email)) {
        res.status(400).send({
          ok: false,
          data: {
            user: null,
          },
          error: "L'email est obligatoire",
        });
        return;
      }
      if (!body.hasOwnProperty(Prisma.FeiScalarFieldEnum.numero)) {
        res.status(400).send({
          ok: false,
          data: { user: null },
          error: 'Le numéro de la fiche est obligatoire',
        });
        return;
      }
      const fei = await prisma.fei.findUnique({
        where: {
          numero: body[Prisma.FeiScalarFieldEnum.numero],
          fei_current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
        },
      });
      if (!fei) {
        res.status(400).send({
          ok: false,
          data: { user: null },
          error: "La fiche n'existe pas",
        });
        return;
      }
      const nextPremierDetenteur = await prisma.user.findUnique({
        where: {
          email: body[Prisma.UserScalarFieldEnum.email].toLowerCase(),
        },
      });
      if (!nextPremierDetenteur) {
        res.status(400).send({
          ok: false,
          data: { user: null },
          error: "L'utilisateur n'existe pas",
        });
        return;
      }

      const existingRelation = await prisma.userRelations.findFirst({
        where: {
          owner_id: user.id,
          related_id: nextPremierDetenteur.id,
          relation: UserRelationType.PREMIER_DETENTEUR,
        },
      });

      if (!existingRelation) {
        await prisma.userRelations.create({
          data: {
            owner_id: user.id,
            related_id: nextPremierDetenteur.id,
            relation: UserRelationType.PREMIER_DETENTEUR,
          },
        });
      }

      await prisma.fei.update({
        where: {
          numero: fei.numero,
        },
        data: {
          fei_next_owner_user_id: nextPremierDetenteur.id,
        },
      });

      if (nextPremierDetenteur.id !== user.id) {
        const email = [
          `Bonjour,`,
          `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Rendez vous sur Zacharie pour la traiter.`,
          `Pour consulter la fiche, rendez-vous sur Zacharie : https://zacharie.beta.gouv.fr/app/tableau-de-bord/fei/${fei.numero}`,
          `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
        ].join('\n\n');
        await sendNotificationToUser({
          user: nextPremierDetenteur!,
          title: `${user.prenom} ${user.nom_de_famille} vous a attribué la fiche ${fei?.numero}`,
          body: email,
          email: email,
          notificationLogAction: `FEI_ASSIGNED_TO_${UserRelationType.PREMIER_DETENTEUR}_${fei.numero}`,
        });
      }

      const nextPremierDetenteurForFei = await prisma.user.findUnique({
        where: {
          email: body[Prisma.UserScalarFieldEnum.email].toLowerCase(),
        },
        select: userFeiSelect,
      });

      res.status(200).send({ ok: true, data: { user: nextPremierDetenteurForFei }, error: '' });
    },
  ),
);

const inviteUserBodySchema = z.object({
  email: z.string().email(),
  entity_id: z.string(),
});

router.post(
  '/invite-user',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;
    let result = inviteUserBodySchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).send({
        ok: false,
        data: { newUser: null },
        error: result.error.message,
      });
      return;
    }
    let body = result.data;
    const email = body[Prisma.UserScalarFieldEnum.email]?.toLowerCase()?.trim();
    if (!email) {
      const error = new Error('Email non valide');
      res.status(400);
      return next(error);
    }
    const entity_id = body[Prisma.EntityAndUserRelationsScalarFieldEnum.entity_id];
    const entity = await prisma.entity.findUnique({
      where: {
        id: entity_id,
      },
    });
    if (!entity) {
      const error = new Error('Entité non trouvée');
      res.status(400);
      return next(error);
    }
    const myRelation = await prisma.entityAndUserRelations.findFirst({
      where: {
        owner_id: user.id,
        entity_id: entity_id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      },
    });
    if (myRelation?.status !== EntityRelationStatus.ADMIN) {
      const error = new Error("Vous n'avez pas les permissions pour inviter des utilisateurs à cette entité");
      res.status(400);
      return next(error);
    }
    let newUser = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });
    if (!newUser) {
      newUser = await prisma.user.create({
        data: {
          id: await createUserId(),
          email,
          roles: req.user.roles.filter((role) => role !== UserRoles.ADMIN),
          activated: true,
          prefilled: false,
        },
      });
    }
    await prisma.entityAndUserRelations.create({
      data: {
        owner_id: newUser.id,
        entity_id: entity_id,
        status: EntityRelationStatus.MEMBER,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      },
    });
    const invitationEmail = [
      `Bonjour,`,
      `Votre compte Zacharie a été créé, vous pouvez désormais accéder à l'application en cliquant sur le lien suivant: https://zacharie.beta.gouv.fr/app/connexion?type=compte-existant.`,
      `N’hésitez pas à nous contacter si besoin,`,
      `L’équipe Zacharie`,
      `Ce message a été généré automatiquement par l’application Zacharie. Si c'est une erreur, veuillez ignorer ce message.`,
    ].join('\n\n');
    await sendEmail({
      emails: [newUser.email],
      subject: `${user.prenom} ${user.nom_de_famille} vous a invité à rejoindre Zacharie`,
      text: invitationEmail,
    });
    res.status(200).send({ ok: true, error: '', data: { newUser } });
  }),
);

const userUpdateSchema = z.object({
  [Prisma.UserScalarFieldEnum.activated]: z.enum(['true', 'false']).optional(),
  [Prisma.UserScalarFieldEnum.user_entities_vivible_checkbox]: z.enum(['true', 'false']).optional(),
  [Prisma.UserScalarFieldEnum.prefilled]: z.enum(['true', 'false']).optional(),
  [Prisma.UserScalarFieldEnum.checked_has_asso_de_chasse]: z.enum(['true', 'false']).optional(),
  [Prisma.UserScalarFieldEnum.checked_has_ccg]: z.enum(['true', 'false']).optional(),
  [Prisma.UserScalarFieldEnum.nom_de_famille]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.prenom]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.prochain_bracelet_a_utiliser]: z.number().optional(),
  [Prisma.UserScalarFieldEnum.telephone]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.email]: z.string().email().optional(),
  [Prisma.UserScalarFieldEnum.addresse_ligne_1]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.addresse_ligne_2]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.code_postal]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.ville]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.etg_role]: z
    .enum(Object.values(UserEtgRoles) as [UserEtgRoles, ...UserEtgRoles[]])
    .optional(),
  [Prisma.UserScalarFieldEnum.notifications]: z
    .enum(Object.values(UserNotifications) as [UserNotifications, ...UserNotifications[]])
    .optional(),
  web_push_token: z.string().optional(),
  native_push_token: z.string().optional(),
  [Prisma.UserScalarFieldEnum.numero_cfei]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.est_forme_a_l_examen_initial]: z.enum(['true', 'false']).optional(),
  onboarding_finished: z.boolean().optional(),
});
router.post(
  '/:user_id',
  passport.authenticate('user', { session: false, failWithError: true }),
  authorizeUserOrAdmin,
  catchErrors(
    async (
      req: RequestWithUser,
      res: express.Response<UserConnexionResponse>,
      next: express.NextFunction,
    ) => {
      let result = userUpdateSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).send({
          ok: false,
          data: { user: null },
          error: result.error.message,
          message: '',
        });
        return;
      }
      let body = result.data;
      const user = await prisma.user.findUnique({
        where: {
          id: req.params.user_id,
        },
      });
      if (!user) {
        res.status(400).send({
          ok: false,
          data: { user: null },
          error: 'User not found',
          message: '',
        });
        return;
      }

      const nextUser: Prisma.UserUpdateInput = {};

      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.activated)) {
        nextUser.activated = body[Prisma.UserScalarFieldEnum.activated] === 'true' ? true : false;
        if (nextUser.activated && !user.activated) {
          nextUser.activated_at = new Date();
        }
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.user_entities_vivible_checkbox)) {
        nextUser.user_entities_vivible_checkbox =
          body[Prisma.UserScalarFieldEnum.user_entities_vivible_checkbox] === 'true' ? true : false;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.prefilled)) {
        nextUser.prefilled = body[Prisma.UserScalarFieldEnum.prefilled] === 'true' ? true : false;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.checked_has_asso_de_chasse)) {
        nextUser.checked_has_asso_de_chasse =
          body[Prisma.UserScalarFieldEnum.checked_has_asso_de_chasse] === 'true' ? new Date() : null;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.checked_has_ccg)) {
        nextUser.checked_has_ccg =
          body[Prisma.UserScalarFieldEnum.checked_has_ccg] === 'true' ? new Date() : null;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.nom_de_famille)) {
        nextUser.nom_de_famille = sanitize(body[Prisma.UserScalarFieldEnum.nom_de_famille] as string);
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.prenom)) {
        nextUser.prenom = sanitize(body[Prisma.UserScalarFieldEnum.prenom] as string);
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.prochain_bracelet_a_utiliser)) {
        nextUser.prochain_bracelet_a_utiliser = body[
          Prisma.UserScalarFieldEnum.prochain_bracelet_a_utiliser
        ] as number;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.telephone)) {
        nextUser.telephone = sanitize(body[Prisma.UserScalarFieldEnum.telephone] as string);
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.email)) {
        nextUser.email = sanitize(body[Prisma.UserScalarFieldEnum.email].toLowerCase() as string);
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.addresse_ligne_1)) {
        nextUser.addresse_ligne_1 = sanitize(body[Prisma.UserScalarFieldEnum.addresse_ligne_1] as string);
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.addresse_ligne_2)) {
        nextUser.addresse_ligne_2 = sanitize(body[Prisma.UserScalarFieldEnum.addresse_ligne_2] as string);
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.code_postal)) {
        nextUser.code_postal = sanitize(body[Prisma.UserScalarFieldEnum.code_postal] as string);
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.ville)) {
        nextUser.ville = sanitize(body[Prisma.UserScalarFieldEnum.ville] as string);
      }
      // if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.roles)) {
      //   nextUser.roles = [...new Set(body[Prisma.UserScalarFieldEnum.roles] as Array<UserRoles>)].sort(
      //     (a, b) => b.localeCompare(a),
      //   );
      // }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.etg_role)) {
        nextUser.etg_role = body[Prisma.UserScalarFieldEnum.etg_role] as UserEtgRoles;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.notifications)) {
        nextUser.notifications = body[
          Prisma.UserScalarFieldEnum.notifications
        ] as unknown as UserNotifications[];
      }
      if (body.hasOwnProperty('web_push_token')) {
        const web_push_token = sanitize(body.web_push_token as string);
        const existingSubscriptions = user.web_push_tokens || [];
        if (!existingSubscriptions.includes(web_push_token)) {
          nextUser.web_push_tokens = [...existingSubscriptions, web_push_token];
        }
      }
      if (body.hasOwnProperty('native_push_token')) {
        const native_push_token = sanitize(body.native_push_token as string);
        const existingSubscriptions = user.native_push_tokens || [];
        if (!existingSubscriptions.includes(native_push_token)) {
          nextUser.native_push_tokens = [...existingSubscriptions, native_push_token];
        }
      }

      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.numero_cfei)) {
        nextUser.numero_cfei = sanitize(body[Prisma.UserScalarFieldEnum.numero_cfei] as string);
        if (!req.isAdmin && nextUser.numero_cfei !== user.numero_cfei) {
          nextUser.activated = false;
          if (nextUser.activated_at) nextUser.activated_at = new Date();
        }
      }

      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.est_forme_a_l_examen_initial)) {
        nextUser.est_forme_a_l_examen_initial =
          body[Prisma.UserScalarFieldEnum.est_forme_a_l_examen_initial] === 'true' ? true : false;
        if (!req.isAdmin && !nextUser.est_forme_a_l_examen_initial && user.numero_cfei) {
          nextUser.activated = false;
          nextUser.numero_cfei = null;
          if (nextUser.activated_at) nextUser.activated_at = new Date();
        }
      }

      if (body.hasOwnProperty('onboarding_finished')) {
        nextUser.onboarded_at = new Date();
      }

      let savedUser: User | null = null;
      const userId = req.params.user_id;
      if (!userId) {
        res.status(400).send({
          ok: false,
          data: {
            user: null,
          },
          error: 'Missing user_id',
          message: '',
        });
        return;
      }

      console.log('nextUser', nextUser);
      // user update / self-update
      savedUser = await prisma.user.update({
        where: { id: userId },
        data: nextUser,
      });
      await updateBrevoContact(savedUser);
      await updateBrevoChasseurDeal(savedUser);

      const userHasNowAllRequiredFields =
        !hasAllRequiredFields(user, `original user update ${savedUser.id}`) &&
        hasAllRequiredFields(savedUser, `saved user update ${savedUser.id}`);
      const userChangedCFEINumber = user.numero_cfei !== savedUser.numero_cfei;

      if (userHasNowAllRequiredFields || userChangedCFEINumber) {
        let subject = `Inscription finie pour ${savedUser.email} (${savedUser.prenom} ${savedUser.nom_de_famille})`;
        if (userChangedCFEINumber) {
          subject = `Numéro CFEI changé pour ${savedUser.email} (${savedUser.prenom} ${savedUser.nom_de_famille})`;
        }
        await sendEmail({
          emails: ['contact@zacharie.beta.gouv.fr'],
          subject: `Inscription finie pour ${savedUser.email} (${savedUser.prenom} ${savedUser.nom_de_famille})`,
          text: `L'utilisateur ${savedUser.email} a ${
            userHasNowAllRequiredFields ? 'fini son inscription' : 'changé son numéro CFEI'
          } :
- Roles\u00A0: ${savedUser.roles.join(', ')}
- Prénom et nom\u00A0: ${savedUser.prenom} ${savedUser.nom_de_famille}
- Adresse\u00A0: ${savedUser.addresse_ligne_1}
- Code postal et ville\u00A0: ${savedUser.code_postal} ${savedUser.ville}
- Email\u00A0: ${savedUser.email}
- Téléphone\u00A0: ${savedUser.telephone}
- Formé à l'examen initial\u00A0: ${savedUser.est_forme_a_l_examen_initial ? 'Oui' : 'Non'}
${
  savedUser.roles.includes(UserRoles.CHASSEUR) && savedUser.est_forme_a_l_examen_initial
    ? `- Numéro CFEI\u00A0: ${savedUser.numero_cfei}`
    : ''
}
          `,
        });
      }

      if (autoActivatePremierDetenteur(savedUser, `check auto activate ${savedUser.id}`)) {
        nextUser.activated = true;
        nextUser.activated_at = new Date();
        savedUser = await prisma.user.update({
          where: { id: userId },
          data: nextUser,
        });
      }

      if (savedUser.activated && !user.activated) {
        const email = [
          `Bonjour,`,
          `Votre compte Zacharie a été activé, vous pouvez désormais accéder à l'application en cliquant sur le lien suivant: https://zacharie.beta.gouv.fr/app/connexion?type=compte-existant`,
          "Attention : pour l'instant, seuls certains collecteurs et ateliers de traitement du gibier acceptent des fiches en format numérique. En cas de doute, merci de contacter le destinataire de vos carcasses avant de créer votre première fiche numérique.",
          // "Des manuels d'utilisation de Zacharie sont disponibles en cliquant ici.",
          `N’hésitez pas à nous contacter,`,
          `L’équipe Zacharie`,
          `Ce message a été généré automatiquement par l’application Zacharie. Si c'est une erreur, veuillez ignorer ce message.`,
        ].join('\n\n');
        await sendEmail({
          emails: [savedUser.email],
          subject: 'Votre compte Zacharie a été activé',
          text: email,
        });
      }

      res.status(200).send({ ok: true, data: { user: savedUser }, error: '', message: '' });
    },
  ),
);

const feiUserGetSchema = z.object({
  fei_numero: z.string(),
  user_id: z.string(),
});
router.get(
  '/fei/:fei_numero/:user_id',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(
    async (req: RequestWithUser, res: express.Response<UserForFeiResponse>, next: express.NextFunction) => {
      let result = feiUserGetSchema.safeParse(req.params);
      if (!result.success) {
        res.status(400).send({
          ok: false,
          data: null,
          error: result.error.message,
        });
        return;
      }
      let params = result.data;
      if (!params.fei_numero) {
        res.status(401).send({ ok: false, data: null, error: 'Missing fei_numero' });
        return;
      }
      const fei = await prisma.fei.findUnique({
        where: {
          numero: params.fei_numero as string,
          deleted_at: null,
        },
      });
      if (!fei) {
        res.status(401).send({
          ok: false,
          data: null,
          error: 'Unauthorized',
        });
        return;
      }
      if (!params.user_id) {
        res.status(400).send({
          ok: false,
          data: null,
          error: 'Missing user_id',
        });
        return;
      }
      const feiUser = await prisma.user.findUnique({
        where: {
          id: params.user_id,
        },
        select: userFeiSelect,
      });
      if (!feiUser) {
        res.status(200).send({
          ok: true,
          data: {
            user: {
              id: params.user_id,
              prenom: 'Jean',
              nom_de_famille: 'Le Chasseur',
              telephone: '0123456789',
              email: 'jean@lechasseur.com',
              addresse_ligne_1: '1 rue de la forêt',
              addresse_ligne_2: '',
              code_postal: '12345',
              ville: 'La Forêt',
              numero_cfei: '1234567890123456',
              est_forme_a_l_examen_initial: true,
            },
          },
          error: '',
        });
        return;
      }

      res.status(200).send({
        ok: true,
        data: {
          user: feiUser,
        },
        error: '',
      });
    },
  ),
);

router.get(
  '/me',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(
    async (
      req: RequestWithUser,
      res: express.Response<UserConnexionResponse>,
      next: express.NextFunction,
    ) => {
      const user = req.user!;
      const entites = await prisma.entityAndUserRelations.findMany({
        where: {
          owner_id: user.id,
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        },
      });
      if (
        user.roles.includes(UserRoles.ETG) ||
        user.roles.includes(UserRoles.SVI) ||
        user.roles.includes(UserRoles.COLLECTEUR_PRO)
      ) {
        const approvedRelations = entites?.filter(
          (entity) =>
            entity.status === EntityRelationStatus.MEMBER || entity.status === EntityRelationStatus.ADMIN,
        );
        if (!approvedRelations?.length) {
          req.user.activated = false;
          res.status(200).send({ ok: true, data: { user: req.user }, error: null, message: '' });
          return;
        }
      }
      const apiKeyApprovals = await prisma.apiKeyApprovalByUserOrEntity.findMany({
        where: {
          OR: [
            {
              user_id: user.id,
            },
            {
              entity_id: {
                in: entites.map((entity) => entity.entity_id),
              },
            },
          ],
        },
        include: {
          ApiKey: {
            select: {
              id: true,
              dedicated_to_entity_id: true,
              name: true,
              description: true,
              active: true,
              webhook_url: true,
              expires_at: true,
              last_used_at: true,
              scopes: true,
              rate_limit: true,
              created_at: true,
              updated_at: true,
              deleted_at: true,
            },
          },
        },
      });
      res.status(200).send({ ok: true, data: { user: req.user, apiKeyApprovals }, error: null, message: '' });
    },
  ),
);

router.get(
  '/my-ccgs',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;
    const userCCGs = (
      await prisma.entityAndUserRelations.findMany({
        where: {
          owner_id: user.id,
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
          EntityRelatedWithUser: {
            type: EntityTypes.CCG,
          },
          deleted_at: null,
        },
        include: {
          EntityRelatedWithUser: true,
        },
      })
    ).map((relation) => relation.EntityRelatedWithUser) satisfies Array<Entity>;

    res.status(200).send({ ok: true, data: { userCCGs }, error: null });
  }),
);

router.get(
  '/my-relations',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(
    async (
      req: RequestWithUser,
      res: express.Response<UserMyRelationsResponse>,
      next: express.NextFunction,
    ) => {
      const user = req.user!;
      /*
      I need to fetch
      - the entities the user is working for (salarié, dirigeant, etc.)
      - teh entities working with the entities the user is working for (ETG, SVI, etc.)
      - the entities the user is working with (partnership)

      I need to return
      - the entities I work for, including the entities working with them (because it's LIKE I'm also working with them)
      - the entities I work with  (partnership confirmed)
      - the other entities I could work with (partnership not confirmed), which are all the rest

      */

      /* ENTITIES WORKING FOR */

      const entitiesWorkingDirectlyFor = await prisma.entityAndUserRelations
        .findMany({
          where: {
            owner_id: user.id,
            relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
            deleted_at: null,
          },
          include: {
            EntityRelatedWithUser: true,
          },
          orderBy: {
            updated_at: 'desc',
          },
        })
        .then((entityRelations) =>
          entityRelations.map(
            (rel): EntityWithUserRelation => ({
              ...rel.EntityRelatedWithUser,
              relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
            }),
          ),
        );

      const etgsRelatedWithMySvis = !user.roles.includes(UserRoles.SVI)
        ? []
        : await prisma.eTGAndEntityRelations.findMany({
            where: {
              entity_id: {
                in: entitiesWorkingDirectlyFor.map((entity) => entity.id),
              },
              entity_type: EntityTypes.SVI,
              deleted_at: null,
            },
            include: {
              ETGRelatedWithEntity: true,
            },
          });

      const svisRelatedWithMyETGs = !user.roles.includes(UserRoles.ETG)
        ? []
        : await prisma.eTGAndEntityRelations.findMany({
            where: {
              etg_id: {
                in: entitiesWorkingDirectlyFor.map((entity) => entity.id),
              },
              entity_type: EntityTypes.SVI,
              deleted_at: null,
            },
            include: {
              EntityRelatedWithETG: true,
            },
          });

      const entitiesWorkingForObject: Record<string, EntityWithUserRelation> = {};
      for (const svi of svisRelatedWithMyETGs.map((r) => r.EntityRelatedWithETG)) {
        entitiesWorkingForObject[svi.id] = {
          ...svi,
          relation: EntityRelationType.WORKING_FOR_ENTITY_RELATED_WITH,
        };
      }
      for (const etg of etgsRelatedWithMySvis.map((r) => r.ETGRelatedWithEntity)) {
        entitiesWorkingForObject[etg.id] = {
          ...etg,
          relation: EntityRelationType.WORKING_FOR_ENTITY_RELATED_WITH,
        };
      }
      for (const entity of entitiesWorkingDirectlyFor) {
        entitiesWorkingForObject[entity.id] = entity;
      }
      const entitiesWorkingFor = Object.values(entitiesWorkingForObject);

      const entitiesWorkingWith = await prisma.entityAndUserRelations
        .findMany({
          where: {
            owner_id: user.id,
            relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
            deleted_at: null,
          },
          include: {
            EntityRelatedWithUser: true,
          },
          orderBy: {
            updated_at: 'desc',
          },
        })
        .then((entityRelations) =>
          entityRelations.map(
            (rel): EntityWithUserRelation => ({
              ...rel.EntityRelatedWithUser,
              relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
            }),
          ),
        );

      const allOtherEntities = await prisma.entity
        .findMany({
          where: {
            // for_testing: ETG test, CCG test, SVI test, etc.
            ...(user.roles.includes(UserRoles.ADMIN) ? {} : { for_testing: false }),
            type: {
              notIn: [
                EntityTypes.CCG, // les CCG doivent rester confidentiels contrairement aux ETG et SVI
                EntityTypes.PREMIER_DETENTEUR, // les associations de chasse doivent rester confidentielles
                EntityTypes.SVI, // les SVI sont déjà inclus dans les ETGs
              ],
            },
            id: {
              notIn: [
                ...entitiesWorkingFor.map((entity) => entity.id),
                ...entitiesWorkingWith.map((entity) => entity.id),
              ],
            },
          },
          orderBy: {
            updated_at: 'desc',
          },
        })
        .then((entities) =>
          entities.map((entity): EntityWithUserRelation => ({ ...entity, relation: 'NONE' })),
        );

      const userRelationsWithOtherUsers = await prisma.userRelations.findMany({
        where: {
          owner_id: user.id,
        },
        include: {
          UserRelatedOfUserRelation: {
            select: userFeiSelect,
          },
        },
        orderBy: {
          updated_at: 'desc',
        },
      });

      const detenteursInitiaux = userRelationsWithOtherUsers
        .filter((userRelation) => userRelation.relation === UserRelationType.PREMIER_DETENTEUR)
        .map((userRelation) => userRelation.UserRelatedOfUserRelation);
      if (user.roles.includes(UserRoles.CHASSEUR)) {
        detenteursInitiaux.unshift(user);
      }

      const allEntities = [
        ...entitiesWorkingFor.filter(
          (entity) =>
            entity.type !== EntityTypes.CCG &&
            ['CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY', 'WORKING_FOR_ENTITY_RELATED_WITH'].includes(
              entity.relation,
            ),
        ),
        ...entitiesWorkingWith.map((entity) => ({
          ...entity,
          relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
        })),
        ...allOtherEntities.map((entity) => ({ ...entity, relation: EntityRelationType.NONE })),
      ].filter((entity, index, array) => array.findIndex((e) => e.id === entity.id) === index); // remove duplicates

      const ccgs = entitiesWorkingWith.filter((entity) => entity.type === EntityTypes.CCG);

      const associationsDeChasse = entitiesWorkingDirectlyFor.filter(
        (entity) => entity.type === EntityTypes.PREMIER_DETENTEUR,
      );

      const collecteursPro = allEntities.filter((entity) => entity.type === EntityTypes.COLLECTEUR_PRO);

      const etgs = allEntities.filter((entity) => entity.type === EntityTypes.ETG);

      const svis = allEntities.filter(
        (entity) =>
          entity.type === EntityTypes.SVI &&
          ['CAN_TRANSMIT_CARCASSES_TO_ENTITY', 'WORKING_FOR_ENTITY_RELATED_WITH'].includes(entity.relation),
      );

      res.status(200).send({
        ok: true,
        data: {
          user: user satisfies User,
          detenteursInitiaux: detenteursInitiaux satisfies Array<UserForFei>,
          // examinateursInitiaux: examinateursInitiaux satisfies Array<User>,
          associationsDeChasse: associationsDeChasse satisfies Array<EntityWithUserRelation>,
          ccgs: ccgs satisfies Array<EntityWithUserRelation>,
          collecteursPro: collecteursPro satisfies Array<EntityWithUserRelation>,
          etgs: etgs satisfies Array<EntityWithUserRelation>,
          svis: svis satisfies Array<EntityWithUserRelation>,
          entitiesWorkingFor: entitiesWorkingFor satisfies Array<EntityWithUserRelation>,
        },
        error: '',
      });
    },
  ),
);

export default router;
