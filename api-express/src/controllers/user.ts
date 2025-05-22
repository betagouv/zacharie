import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { RequestWithUser } from '~/types/request';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import jwt from 'jsonwebtoken';
import dayjs from 'dayjs';
import { createBrevoContact, sendEmail, updateBrevoContact } from '~/third-parties/brevo';
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
import type { EntityWithUserRelation, EntityWithUserRelationType } from '~/types/entity';
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
} from '@prisma/client';
import { authorizeUserOrAdmin } from '~/utils/authorizeUserOrAdmin.server';
import { cookieOptions, JWT_MAX_AGE, logoutCookieOptions } from '~/utils/cookie';
import sendNotificationToUser from '~/service/notifications';
import { SECRET } from '~/config';
// import { refreshMaterializedViews } from '~/utils/refreshMaterializedViews';

router.post(
  '/connexion',
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { email, username, passwordUser, connexionType, resetPasswordRequest, resetPasswordToken } =
      req.body;

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
      } satisfies UserConnexionResponse);
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
          } satisfies UserConnexionResponse);
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
        } satisfies UserConnexionResponse);
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
      } satisfies UserConnexionResponse);
      return;
    }
    if (!connexionType) {
      res.status(400).send({
        ok: false,
        data: { user: null },
        message: '',
        error: "L'URL de connexion est incorrecte",
      } satisfies UserConnexionResponse);
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
        } satisfies UserConnexionResponse);
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
        } satisfies UserConnexionResponse);
        return;
      }
      user = await prisma.user.create({
        data: {
          id: await createUserId(),
          email,
          activated: false,
          prefilled: false,
        },
      });
      await createBrevoContact(user, 'USER');
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
          } satisfies UserConnexionResponse);
          return;
        } else {
          res.status(400).send({
            ok: false,
            data: { user: null },
            message: '',
            error: 'Un compte existe déjà avec cet email',
          } satisfies UserConnexionResponse);
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
    res.cookie('zacharie_express_jwt', token, cookieOptions());
    res
      .status(200)
      .send({ ok: true, data: { user }, message: '', error: '' } satisfies UserConnexionResponse);
  }),
);

router.post(
  '/user-entity/:user_id',
  passport.authenticate('user', { session: false, failWithError: true }),
  authorizeUserOrAdmin,
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const body = req.body;
    const userId = req.params.user_id;
    const isAdmin = req.isAdmin;

    if (!body.owner_id) {
      res.status(400).send({ ok: false, data: { relation: null, entity: null }, error: 'Missing owner_id' });
      return;
    }

    let entityId: string = body.entity_id;
    if (body.numero_ddecpp) {
      const entity = await prisma.entity.findFirst({
        where: {
          numero_ddecpp: body.numero_ddecpp,
          type: body.type as EntityTypes,
        },
      });
      if (!entity) {
        res.status(404).send({
          ok: false,
          data: { relation: null, entity: null },
          error: "Ce Centre de Collecte n'existe pas",
        } satisfies UserEntityResponse);
        return;
      }
      entityId = entity?.id || '';
    }

    if (!entityId) {
      res.status(400).send({
        ok: false,
        data: { relation: null, entity: null },
        error: 'Missing entity_id',
      } satisfies UserEntityResponse);
      return;
    }

    if (!isAdmin && userId !== body.owner_id) {
      res.status(401).send({
        ok: false,
        data: { relation: null, entity: null },
        error: 'Unauthorized',
      } satisfies UserEntityResponse);
      return;
    }

    // Handle create action
    if (body._action === 'create') {
      if (!body.relation) {
        res.status(400).send({
          ok: false,
          data: { relation: null, entity: null },
          error: 'Missing relation',
        } satisfies UserEntityResponse);
        return;
      }

      const nextEntityRelation = {
        owner_id: body.owner_id,
        entity_id: entityId,
        relation: body.relation as EntityRelationType,
      };

      const existingEntityRelation = await prisma.entityAndUserRelations.findFirst({
        where: nextEntityRelation,
      });

      if (existingEntityRelation) {
        res.status(409).send({
          ok: false,
          data: { relation: null, entity: null },
          error: 'Vous avez déjà ajouté cette entité',
        } satisfies UserEntityResponse);
        return;
      }

      const relation = await prisma.entityAndUserRelations.create({
        data: nextEntityRelation,
      });

      const entity = await prisma.entity.findUnique({
        where: {
          id: entityId,
        },
      });

      res.status(200).send({ ok: true, data: { relation, entity }, error: '' } satisfies UserEntityResponse);
      return;
    }

    // Handle delete action
    if (body._action === 'delete') {
      const existingEntityRelation = await prisma.entityAndUserRelations.findFirst({
        where: {
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
      res
        .status(200)
        .send({ ok: true, data: { relation: null, entity: null }, error: '' } satisfies UserEntityResponse);
      return;
    }

    res.status(400).send({
      ok: false,
      data: { relation: null, entity: null },
      error: 'Invalid action',
    } satisfies UserEntityResponse);
  }),
);

router.post(
  '/user-relation/:user_id',
  passport.authenticate('user', { session: false, failWithError: true }),
  authorizeUserOrAdmin,
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const body = req.body;
    const userId = req.params.user_id;

    if (!body.hasOwnProperty(Prisma.UserRelationsScalarFieldEnum.owner_id)) {
      res.status(400).send({ ok: false, data: null, error: 'Missing owner_id' });
      return;
    }
    if (!body.hasOwnProperty(Prisma.UserRelationsScalarFieldEnum.related_id)) {
      res.status(400).send({ ok: false, data: null, error: 'Missing related_id' });
      return;
    }
    if (userId !== body[Prisma.UserRelationsScalarFieldEnum.owner_id]) {
      res.status(401).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    if (body._action === 'create') {
      if (!body.hasOwnProperty(Prisma.UserRelationsScalarFieldEnum.relation)) {
        res.status(400).send({ ok: false, data: null, error: 'Missing relation' });
        return;
      }

      const nextUserRelation = {
        owner_id: body.hasOwnProperty(Prisma.UserRelationsScalarFieldEnum.owner_id) as User['id'],
        related_id: body.hasOwnProperty(Prisma.UserRelationsScalarFieldEnum.related_id) as User['id'],
        relation: body.hasOwnProperty(Prisma.UserRelationsScalarFieldEnum.relation) as UserRelationType,
      };

      const existingEntityRelation = await prisma.userRelations.findFirst({
        where: nextUserRelation,
      });
      if (existingEntityRelation) {
        res.status(409).send({
          ok: false,
          data: null,
          error: 'EntityRelation already exists',
        });
        return;
      }
      const relation = await prisma.userRelations.create({
        data: nextUserRelation,
      });

      res.status(200).send({ ok: true, data: { relation }, error: '' });
      return;
    }

    if (body._action === 'delete') {
      const existingEntityRelation = await prisma.userRelations.findFirst({
        where: {
          owner_id: body.hasOwnProperty(Prisma.UserRelationsScalarFieldEnum.owner_id) as User['id'],
          related_id: body.hasOwnProperty(Prisma.UserRelationsScalarFieldEnum.related_id) as User['id'],
          relation: body.hasOwnProperty(Prisma.UserRelationsScalarFieldEnum.relation) as UserRelationType,
        },
      });
      if (existingEntityRelation) {
        await prisma.userRelations.delete({
          where: {
            id: existingEntityRelation.id,
          },
        });

        res.status(200).send({ ok: true, data: null, error: '' });
        return;
      }
    }

    res.status(400).send({ ok: false, data: null, error: 'Invalid action' });
  }),
);

router.post(
  '/logout',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.clearCookie('zacharie_express_jwt', logoutCookieOptions());
    res.status(200).send({ ok: true });
  }),
);

router.post(
  '/fei/trouver-premier-detenteur',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;
    const body = req.body as Record<'email' | 'numero', string>;
    const userId = req.params.user_id;

    console.log('body', body);
    if (!body.hasOwnProperty(Prisma.UserScalarFieldEnum.email)) {
      res.status(400).send({
        ok: false,
        data: {
          user: null,
        },
        error: "L'email est obligatoire",
      } satisfies UserForFeiResponse);
      return;
    }
    if (!body.hasOwnProperty(Prisma.FeiScalarFieldEnum.numero)) {
      res.status(400).send({
        ok: false,
        data: { user: null },
        error: 'Le numéro de la fiche est obligatoire',
      } satisfies UserForFeiResponse);
      return;
    }
    const fei = await prisma.fei.findUnique({
      where: {
        numero: body[Prisma.FeiScalarFieldEnum.numero],
        fei_current_owner_role: UserRoles.EXAMINATEUR_INITIAL,
      },
    });
    if (!fei) {
      res.status(400).send({
        ok: false,
        data: { user: null },
        error: "La fiche n'existe pas",
      } satisfies UserForFeiResponse);
      return;
    }
    const nextPremierDetenteur = await prisma.user.findUnique({
      where: {
        email: body[Prisma.UserScalarFieldEnum.email],
      },
    });
    if (!nextPremierDetenteur) {
      res.status(400).send({
        ok: false,
        data: { user: null },
        error: "L'utilisateur n'existe pas",
      } satisfies UserForFeiResponse);
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
      await sendNotificationToUser({
        user: nextPremierDetenteur!,
        title: 'Vous avez une nouvelle fiche à traiter',
        body: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Rendez vous sur Zacharie pour la traiter.`,
        email: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche, la ${fei?.numero}. Rendez vous sur Zacharie pour la traiter.`,
        notificationLogAction: `FEI_ASSIGNED_TO_${UserRelationType.PREMIER_DETENTEUR}_${fei.numero}`,
      });
    }

    const nextPremierDetenteurForFei = await prisma.user.findUnique({
      where: {
        email: body[Prisma.UserScalarFieldEnum.email],
      },
      select: userFeiSelect,
    });

    res
      .status(200)
      .send({ ok: true, data: { user: nextPremierDetenteurForFei }, error: '' } satisfies UserForFeiResponse);
  }),
);

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
      const user = req.user!;
      const body = req.body;

      const nextUser: Prisma.UserUpdateInput = {};

      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.activated)) {
        nextUser.activated = body[Prisma.UserScalarFieldEnum.activated] === 'true' ? true : false;
        if (nextUser.activated) {
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
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.nom_de_famille)) {
        nextUser.nom_de_famille = body[Prisma.UserScalarFieldEnum.nom_de_famille] as string;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.prenom)) {
        nextUser.prenom = body[Prisma.UserScalarFieldEnum.prenom] as string;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.prochain_bracelet_a_utiliser)) {
        nextUser.prochain_bracelet_a_utiliser = body[
          Prisma.UserScalarFieldEnum.prochain_bracelet_a_utiliser
        ] as number;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.telephone)) {
        nextUser.telephone = body[Prisma.UserScalarFieldEnum.telephone] as string;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.email)) {
        nextUser.email = body[Prisma.UserScalarFieldEnum.email] as string;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.addresse_ligne_1)) {
        nextUser.addresse_ligne_1 = body[Prisma.UserScalarFieldEnum.addresse_ligne_1] as string;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.addresse_ligne_2)) {
        nextUser.addresse_ligne_2 = body[Prisma.UserScalarFieldEnum.addresse_ligne_2] as string;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.code_postal)) {
        nextUser.code_postal = body[Prisma.UserScalarFieldEnum.code_postal] as string;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.ville)) {
        nextUser.ville = body[Prisma.UserScalarFieldEnum.ville] as string;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.roles)) {
        nextUser.roles = body[Prisma.UserScalarFieldEnum.roles] as Array<UserRoles>;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.notifications)) {
        nextUser.notifications = body[Prisma.UserScalarFieldEnum.notifications] as Array<UserNotifications>;
      }
      if (body.hasOwnProperty('web_push_token')) {
        const web_push_token = body.web_push_token as string;
        const existingSubscriptions = user.web_push_tokens || [];
        if (!existingSubscriptions.includes(web_push_token)) {
          nextUser.web_push_tokens = [...existingSubscriptions, web_push_token];
        }
      }

      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.numero_cfei)) {
        nextUser.numero_cfei = body[Prisma.UserScalarFieldEnum.numero_cfei] as string;
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

      // user update / self-update
      savedUser = await prisma.user.update({
        where: { id: userId },
        data: nextUser,
      });

      await updateBrevoContact(savedUser);

      res.status(200).send({ ok: true, data: { user: savedUser }, error: '', message: '' });
    },
  ),
);

router.get(
  '/fei/:fei_numero/:user_id',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;
    if (!req.params.fei_numero) {
      res.status(401).send({ ok: false, data: null, error: 'Missing fei_numero' });
      return;
    }
    const fei = await prisma.fei.findUnique({
      where: {
        numero: req.params.fei_numero as string,
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
    if (!req.params.user_id) {
      res.status(400).send({
        ok: false,
        data: null,
        error: 'Missing user_id',
      });
      return;
    }
    const feiUser = await prisma.user.findUnique({
      where: {
        id: req.params.user_id,
      },
      select: userFeiSelect,
    });
    if (!feiUser) {
      res.status(200).send({
        ok: true,
        data: {
          user: {
            id: req.params.user_id,
            prenom: 'Jean',
            nom_de_famille: 'Le Chasseur',
            telephone: '0123456789',
            email: 'jean@lechasseur.com',
            addresse_ligne_1: '1 rue de la forêt',
            addresse_ligne_2: '',
            code_postal: '12345',
            ville: 'La Forêt',
            numero_cfei: '1234567890123456',
          } satisfies UserForFei,
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
  }),
);

router.get(
  '/me',
  passport.authenticate('user', { session: false, failWithError: true }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    res.status(200).send({ ok: true, data: { user: req.user }, error: null });
  }),
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
          relation: EntityRelationType.WORKING_WITH,
          EntityRelatedWithUser: {
            type: EntityTypes.CCG,
          },
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
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
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
          relation: EntityRelationType.WORKING_FOR,
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
            relation: 'WORKING_FOR' satisfies EntityWithUserRelationType,
          }),
        ),
      );

    const etgsRelatedWithMyEntities = await prisma.eTGAndEntityRelations.findMany({
      where: {
        entity_id: {
          in: entitiesWorkingDirectlyFor.map((entity) => entity.id),
        },
      },
      include: {
        ETGRelatedWithEntity: true,
      },
    });

    const svisRelatedWithMyETGs = await prisma.eTGAndEntityRelations.findMany({
      where: {
        etg_id: {
          in: entitiesWorkingDirectlyFor.map((entity) => entity.id),
        },
        entity_type: EntityTypes.SVI,
      },
      include: {
        EntityRelatedWithETG: true,
      },
    });

    const collecteursProsRelatedWithMyETGs = await prisma.eTGAndEntityRelations.findMany({
      where: {
        etg_id: {
          in: entitiesWorkingDirectlyFor.map((entity) => entity.id),
        },
        entity_type: EntityTypes.COLLECTEUR_PRO,
      },
      include: {
        EntityRelatedWithETG: true,
      },
    });

    const entitiesWorkingForObject: Record<string, EntityWithUserRelation> = {};
    for (const svi of svisRelatedWithMyETGs.map((r) => r.EntityRelatedWithETG)) {
      entitiesWorkingForObject[svi.id] = {
        ...svi,
        relation: 'WORKING_FOR_ENTITY_RELATED_WITH' satisfies EntityWithUserRelationType,
      };
    }
    for (const etg of etgsRelatedWithMyEntities.map((r) => r.ETGRelatedWithEntity)) {
      entitiesWorkingForObject[etg.id] = {
        ...etg,
        relation: 'WORKING_FOR_ENTITY_RELATED_WITH' satisfies EntityWithUserRelationType,
      };
    }
    for (const collecteurPro of collecteursProsRelatedWithMyETGs.map((r) => r.EntityRelatedWithETG)) {
      entitiesWorkingForObject[collecteurPro.id] = {
        ...collecteurPro,
        relation: 'WORKING_FOR_ENTITY_RELATED_WITH' satisfies EntityWithUserRelationType,
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
          relation: EntityRelationType.WORKING_WITH,
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
            relation: 'WORKING_WITH' satisfies EntityWithUserRelationType,
          }),
        ),
      );

    const allOtherEntities = await prisma.entity
      .findMany({
        where: {
          id: {
            notIn: [
              ...entitiesWorkingFor.map((entity) => entity.id),
              ...entitiesWorkingWith.map((entity) => entity.id),
            ],
          },
          type: {
            notIn: [
              EntityTypes.CCG, // les CCG doivent rester confidentiels contrairement aux ETG et SVI
              EntityTypes.PREMIER_DETENTEUR, // les associations de chasse doivent rester confidentielles
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
    if (user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
      detenteursInitiaux.unshift(user);
    }

    // const examinateursInitiaux = userRelationsWithOtherUsers
    //   .filter((userRelation) => userRelation.relation === UserRelationType.EXAMINATEUR_INITIAL)
    //   .map((userRelation) => ({ ...userRelation.UserRelatedOfUserRelation, relation: userRelation.relation }));
    // if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
    //   examinateursInitiaux.unshift({ ...user, relation: UserRelationType.EXAMINATEUR_INITIAL });
    // }

    const allEntities = [
      ...entitiesWorkingFor.filter(
        (entity) =>
          entity.type !== EntityTypes.CCG &&
          ['WORKING_FOR', 'WORKING_FOR_ENTITY_RELATED_WITH'].includes(entity.relation),
      ),
      ...entitiesWorkingWith.map((entity) => ({
        ...entity,
        relation: 'WORKING_WITH' as EntityWithUserRelationType,
      })),
      ...allOtherEntities.map((entity) => ({ ...entity, relation: 'NONE' as EntityWithUserRelationType })),
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
        ['WORKING_WITH', 'WORKING_FOR_ENTITY_RELATED_WITH'].includes(entity.relation),
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
        collecteursProsRelatedWithMyETGs:
          collecteursProsRelatedWithMyETGs satisfies Array<ETGAndEntityRelations>,
        etgsRelatedWithMyEntities: etgsRelatedWithMyEntities satisfies Array<ETGAndEntityRelations>,
      },
      error: '',
    } satisfies UserMyRelationsResponse);
  }),
);

export default router;
