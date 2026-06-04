import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import jwt from 'jsonwebtoken';
import createUserId from '~/utils/createUserId';
import { Prisma, User, UserEtgRoles, UserNotifications, UserRoles } from '@prisma/client';
import { cookieOptions, JWT_MAX_AGE } from '~/utils/cookie';
import { SECRET } from '~/config';
import { z } from 'zod';
import { sanitize } from '~/utils/sanitize';
import { hasAllRequiredFields } from '~/utils/user';
import type {
  AdminUsersResponse,
  AdminUserDataResponse,
  AdminNewUserDataResponse,
  UserConnexionResponse,
} from '~/types/responses';
import { entityAdminInclude } from '~/types/entity';
import {
  createBrevoContact,
  sendEmail,
  updateBrevoChasseurDeal,
  updateBrevoContact,
} from '~/third-parties/brevo';
import { getDefaultScopeDepartementsForRoles } from '~/utils/federation-stats';
import { sendOnboardingEmailOnce } from '~/utils/send-onboarding-email';
import { formatCompteActiveEmail } from '~/utils/format-inscription-email';

router.post(
  '/user/connect-as',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<UserConnexionResponse>,
      next: express.NextFunction
    ) => {
      const body = req.body;
      const email = body.email;
      console.log('body', body);
      console.log('Email:', email);
      if (!email) {
        res.status(400).send({
          ok: false,
          data: null,
          message: null,
          error: 'Veuillez renseigner votre email',
        });
        return;
      }
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(400).send({
          ok: false,
          data: null,
          message: null,
          error: "Cet utilisateur n'existe pas",
        });
        return;
      }
      const token = jwt.sign({ userId: user.id }, SECRET, {
        expiresIn: JWT_MAX_AGE,
      });
      res.cookie('zacharie_express_jwt', token, cookieOptions(req));
      res.status(200).send({
        ok: true,
        data: { user, token },
        error: null,
        message: '',
      });
    }
  )
);

router.post(
  '/user/nouveau',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminNewUserDataResponse>,
      next: express.NextFunction
    ) => {
      const body = req.body;

      const roles = body[Prisma.UserScalarFieldEnum.roles] as UserRoles[];
      const createdUser = await prisma.user.create({
        data: {
          id: await createUserId(),
          email: body[Prisma.UserScalarFieldEnum.email],
          roles,
          isZacharieAdmin: body[Prisma.UserScalarFieldEnum.isZacharieAdmin] ? true : false,
          scope_departements_codes: getDefaultScopeDepartementsForRoles(roles),
        },
      });

      await createBrevoContact(createdUser, 'ADMIN');

      res.status(200).send({ ok: true, data: { user: createdUser }, error: '' });
    }
  )
);

const adminUserUpdateSchema = z.object({
  [Prisma.UserScalarFieldEnum.activated]: z.enum(['true', 'false']).optional(),
  [Prisma.UserScalarFieldEnum.user_entities_vivible_checkbox]: z.enum(['true', 'false']).optional(),
  [Prisma.UserScalarFieldEnum.prefilled]: z.enum(['true', 'false']).optional(),
  [Prisma.UserScalarFieldEnum.checked_has_asso_de_chasse]: z.enum(['true', 'false']).optional(),
  [Prisma.UserScalarFieldEnum.checked_has_ccg]: z.enum(['true', 'false']).optional(),
  [Prisma.UserScalarFieldEnum.checked_has_partenaires]: z.enum(['true', 'false']).optional(),
  [Prisma.UserScalarFieldEnum.onboarding_chasse_info_done_at]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.nom_de_famille]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.prenom]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.prochain_bracelet_a_utiliser]: z.number().optional(),
  [Prisma.UserScalarFieldEnum.telephone]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.email]: z.string().email().optional(),
  [Prisma.UserScalarFieldEnum.addresse_ligne_1]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.addresse_ligne_2]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.code_postal]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.roles]: z
    .array(
      z.enum(Object.values(UserRoles).filter((r) => r !== UserRoles.ADMIN) as [UserRoles, ...UserRoles[]])
    )
    .optional(),
  [Prisma.UserScalarFieldEnum.scope_departements_codes]: z.array(z.string()).optional(),
  [Prisma.UserScalarFieldEnum.isZacharieAdmin]: z.boolean().optional(),
  [Prisma.UserScalarFieldEnum.ville]: z.string().optional(),
  [Prisma.UserScalarFieldEnum.etg_role]: z
    .enum(Object.values(UserEtgRoles) as [UserEtgRoles, ...UserEtgRoles[]])
    .optional(),
  [Prisma.UserScalarFieldEnum.notifications]: z
    .array(z.enum(Object.values(UserNotifications) as [UserNotifications, ...UserNotifications[]]))
    .optional(),
  [Prisma.UserScalarFieldEnum.numero_cfei]: z.string().optional().nullable(),
  [Prisma.UserScalarFieldEnum.est_forme_a_l_examen_initial]: z.enum(['true', 'false']).optional(),
  onboarding_finished: z.boolean().optional(),
});

router.post(
  '/user/:user_id',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<UserConnexionResponse>,
      next: express.NextFunction
    ) => {
      const result = adminUserUpdateSchema.safeParse(req.body);
      if (!result.success) {
        const error = new Error(result.error.message);
        res.status(406);
        return next(error);
      }
      const body = result.data;
      const userId = req.params.user_id;
      const user = await prisma.user.findUnique({ where: { id: userId } });
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
        nextUser.activated = body[Prisma.UserScalarFieldEnum.activated] === 'true';
        if (nextUser.activated && !user.activated) {
          nextUser.activated_at = new Date();
        }
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.user_entities_vivible_checkbox)) {
        nextUser.user_entities_vivible_checkbox =
          body[Prisma.UserScalarFieldEnum.user_entities_vivible_checkbox] === 'true';
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.prefilled)) {
        nextUser.prefilled = body[Prisma.UserScalarFieldEnum.prefilled] === 'true';
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.onboarding_chasse_info_done_at)) {
        nextUser.onboarding_chasse_info_done_at = new Date(
          body[Prisma.UserScalarFieldEnum.onboarding_chasse_info_done_at] as string
        );
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.checked_has_asso_de_chasse)) {
        nextUser.checked_has_asso_de_chasse =
          body[Prisma.UserScalarFieldEnum.checked_has_asso_de_chasse] === 'true' ? new Date() : null;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.checked_has_ccg)) {
        nextUser.checked_has_ccg =
          body[Prisma.UserScalarFieldEnum.checked_has_ccg] === 'true' ? new Date() : null;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.checked_has_partenaires)) {
        nextUser.checked_has_partenaires =
          body[Prisma.UserScalarFieldEnum.checked_has_partenaires] === 'true' ? new Date() : null;
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
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.roles)) {
        nextUser.roles = ([...new Set(body[Prisma.UserScalarFieldEnum.roles])] as UserRoles[]).sort((a, b) =>
          b.localeCompare(a)
        );
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.scope_departements_codes)) {
        nextUser.scope_departements_codes = (
          [...new Set(body[Prisma.UserScalarFieldEnum.scope_departements_codes])] as string[]
        ).sort((a, b) => b.localeCompare(a));
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.isZacharieAdmin)) {
        nextUser.isZacharieAdmin = body[Prisma.UserScalarFieldEnum.isZacharieAdmin] ? true : false;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.etg_role)) {
        nextUser.etg_role = body[Prisma.UserScalarFieldEnum.etg_role] as UserEtgRoles;
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.notifications)) {
        nextUser.notifications = body[Prisma.UserScalarFieldEnum.notifications];
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.numero_cfei)) {
        nextUser.numero_cfei = sanitize(body[Prisma.UserScalarFieldEnum.numero_cfei] as string);
      }
      if (body.hasOwnProperty(Prisma.UserScalarFieldEnum.est_forme_a_l_examen_initial)) {
        nextUser.est_forme_a_l_examen_initial =
          body[Prisma.UserScalarFieldEnum.est_forme_a_l_examen_initial] === 'true';
      }
      if (body.hasOwnProperty('onboarding_finished')) {
        nextUser.onboarded_at = new Date();
      }

      let savedUser: User = await prisma.user.update({
        where: { id: userId },
        data: nextUser,
      });
      await updateBrevoContact(savedUser);
      await updateBrevoChasseurDeal(savedUser);

      const userHasNowAllRequiredFields =
        !hasAllRequiredFields(user, `admin user update ${savedUser.id}`) &&
        hasAllRequiredFields(savedUser, `admin saved user update ${savedUser.id}`);
      const userChangedCFEINumber = user.numero_cfei !== savedUser.numero_cfei;

      if (userHasNowAllRequiredFields || userChangedCFEINumber) {
        let subject = `Inscription finie pour ${savedUser.email} (${savedUser.prenom} ${savedUser.nom_de_famille})`;
        if (userChangedCFEINumber) {
          subject = `Numéro CFEI changé pour ${savedUser.email} (${savedUser.prenom} ${savedUser.nom_de_famille})`;
        }
        await sendEmail({
          emails: ['contact@zacharie.beta.gouv.fr'],
          subject,
          text: `L'utilisateur ${savedUser.email} a ${userHasNowAllRequiredFields ? 'fini son inscription' : 'changé son numéro CFEI'} :
- Roles : ${savedUser.roles.join(', ')}
- Prénom et nom : ${savedUser.prenom} ${savedUser.nom_de_famille}
- Adresse : ${savedUser.addresse_ligne_1}
- Code postal et ville : ${savedUser.code_postal} ${savedUser.ville}
- Email : ${savedUser.email}
- Téléphone : ${savedUser.telephone}
- Formé à l'examen initial : ${savedUser.est_forme_a_l_examen_initial ? 'Oui' : 'Non'}
${savedUser.roles.includes(UserRoles.CHASSEUR) && savedUser.est_forme_a_l_examen_initial ? `- Numéro CFEI : ${savedUser.numero_cfei}` : ''}
          `,
        });
      }

      // Mail « compte activé » dédupliqué une seule fois par compte (voir controllers/user.ts).
      if (savedUser.activated && !user.activated) {
        const { subject, text } = formatCompteActiveEmail();
        await sendOnboardingEmailOnce({ user: savedUser, subject, text, action: 'COMPTE_ACTIVE' });
      }

      res.status(200).send({ ok: true, data: { user: savedUser }, error: '', message: '' });
    }
  )
);

// Soft delete : pose deleted_at. L'utilisateur ne peut plus se connecter ni agir
// (voir middlewares/passport.ts et controllers/user.ts /login), mais ses données
// historiques (fiches, carcasses) restent référencées.
router.post(
  '/user/:user_id/soft-delete',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<UserConnexionResponse>,
      next: express.NextFunction
    ) => {
      const userId = req.params.user_id;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(400).send({ ok: false, data: { user: null }, error: 'User not found', message: '' });
        return;
      }
      const savedUser = await prisma.user.update({
        where: { id: userId },
        data: { deleted_at: new Date() },
      });
      res.status(200).send({ ok: true, data: { user: savedUser }, error: '', message: '' });
    }
  )
);

// Restaure un utilisateur soft-deleted : remet deleted_at à null.
router.post(
  '/user/:user_id/restore',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<UserConnexionResponse>,
      next: express.NextFunction
    ) => {
      const userId = req.params.user_id;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(400).send({ ok: false, data: { user: null }, error: 'User not found', message: '' });
        return;
      }
      const savedUser = await prisma.user.update({
        where: { id: userId },
        data: { deleted_at: null },
      });
      res.status(200).send({ ok: true, data: { user: savedUser }, error: '', message: '' });
    }
  )
);

router.get(
  '/user/:user_id',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminUserDataResponse>,
      next: express.NextFunction
    ) => {
      const userId = req.params.user_id;
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });
      if (!user) {
        res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
        return;
      }
      const allEntities = await prisma.entity.findMany({
        where: {
          deleted_at: null,
        },
        orderBy: {
          updated_at: 'desc',
        },
      });
      const userEntitiesRelations = await prisma.entity.findMany({
        where: {
          EntityRelationsWithUsers: {
            some: {
              owner_id: user.id,
              deleted_at: null,
            },
          },
          deleted_at: null,
        },
        orderBy: {
          updated_at: 'desc',
        },
        include: entityAdminInclude,
      });

      let officialCfei = null;
      if (user.numero_cfei) {
        officialCfei = await prisma.officialCfei.findUnique({
          where: { numero_cfei: user.numero_cfei.toUpperCase() },
          select: {
            numero_cfei: true,
            nom: true,
            prenom: true,
            departement: true,
          },
        });
      }

      res.status(200).send({
        ok: true,
        data: {
          user,
          identityDone:
            !!user.nom_de_famille &&
            !!user.prenom &&
            !!user.telephone &&
            !!user.addresse_ligne_1 &&
            !!user.code_postal &&
            !!user.ville,
          examinateurDone: !user.roles.includes(UserRoles.CHASSEUR)
            ? true
            : !!user.est_forme_a_l_examen_initial && !!user.numero_cfei,
          allEntities,
          userEntitiesRelations,
          officialCfei,
        },
        error: '',
      });
    }
  )
);

router.get(
  '/users',
  catchErrors(
    async (req: express.Request, res: express.Response<AdminUsersResponse>, next: express.NextFunction) => {
      const users = await prisma.user.findMany({
        orderBy: {
          last_seen_at: { sort: 'desc', nulls: 'last' },
        },
      });
      res.status(200).send({
        ok: true,
        data: { users },
        error: '',
      });
    }
  )
);

export default router;
