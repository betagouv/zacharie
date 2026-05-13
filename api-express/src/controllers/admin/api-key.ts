import express from 'express';
import { catchErrors } from '~/middlewares/errors';
import crypto from 'crypto';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { ApiKeyApprovalStatus, ApiKeyScope, Entity, EntityTypes, Prisma, User } from '@prisma/client';
import type {
  AdminApiKeysResponse,
  AdminApiKeyResponse,
  AdminApiKeyAndApprovalsResponse,
} from '~/types/responses';
import slugify from 'slugify';

router.get(
  '/api-keys',
  catchErrors(
    async (req: express.Request, res: express.Response<AdminApiKeysResponse>, next: express.NextFunction) => {
      const apiKeys = await prisma.apiKey.findMany({
        orderBy: {
          created_at: 'desc',
        },
        include: {
          approvals: {
            include: {
              User: true,
              Entity: true,
            },
          },
        },
      });

      res.status(200).send({ ok: true, data: { apiKeys }, error: '' });
    }
  )
);

router.post(
  '/api-key/nouvelle',
  catchErrors(
    async (req: express.Request, res: express.Response<AdminApiKeyResponse>, next: express.NextFunction) => {
      const body = req.body;
      const createdApiKey = await prisma.apiKey.create({
        data: {
          name: body[Prisma.ApiKeyScalarFieldEnum.name],
          slug_for_context: slugify(body[Prisma.ApiKeyScalarFieldEnum.name], {
            replacement: '-', // replace spaces with replacement character
            remove: undefined, // remove colons and parentheses
            lower: true, // convert to lower case, defaults to `false`
            strict: true, // strip special characters except replacement, defaults to `false`
            locale: 'fr',
            trim: true, // trim leading and trailing replacement chars, defaults to `true`
          }),
          description: body[Prisma.ApiKeyScalarFieldEnum.description],
          private_key: crypto.randomBytes(32).toString('hex'),
          public_key: crypto.randomBytes(32).toString('hex'),
          scopes: body[Prisma.ApiKeyScalarFieldEnum.scopes] as ApiKeyScope[],
          active: true,
        },
      });

      res.status(200).send({ ok: true, data: { apiKey: createdApiKey }, error: '' });
    }
  )
);

router.post(
  '/api-key/new-access-token/:api_key_id',
  catchErrors(
    async (req: express.Request, res: express.Response<AdminApiKeyResponse>, next: express.NextFunction) => {
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: req.params.api_key_id },
      });
      if (!apiKey) {
        res.status(404).send({ ok: false, data: null, error: 'API key not found' });
        return;
      }
      const accessToken = crypto.randomBytes(32).toString('hex');
      const updatedApiKey = await prisma.apiKey.update({
        where: { id: req.params.api_key_id },
        data: {
          access_token: accessToken,
          access_token_read_at: null,
        },
      });
      res.status(200).send({ ok: true, data: { apiKey: updatedApiKey }, error: '' });
    }
  )
);

router.get(
  '/api-key/:api_key_id',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminApiKeyAndApprovalsResponse>,
      next: express.NextFunction
    ) => {
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: req.params.api_key_id },
        include: {
          approvals: {
            include: {
              User: true,
              Entity: true,
            },
          },
        },
      });
      if (!apiKey) {
        res.status(404).send({ ok: false, data: null, error: 'API key not found' });
        return;
      }
      const approvalsRecord: Record<string, boolean> = {};
      for (const approval of apiKey.approvals) {
        if (approval.user_id) {
          approvalsRecord[approval.user_id] = true;
        }
        if (approval.entity_id) {
          approvalsRecord[approval.entity_id] = true;
        }
      }
      const allUsers = await prisma.user.findMany({ where: { deleted_at: null } }).then((users) => {
        const allUsersRecord: Record<string, User> = {};
        for (const user of users) {
          if (approvalsRecord[user.id]) {
            continue;
          }
          allUsersRecord[user.id] = user;
        }
        return allUsersRecord;
      });
      const allEntities = await prisma.entity
        .findMany({ where: { deleted_at: null, type: { not: EntityTypes.CCG } } })
        .then((entities) => {
          const allEntitiesRecord: Record<string, Entity> = {};
          for (const entity of entities) {
            if (approvalsRecord[entity.id]) {
              continue;
            }
            allEntitiesRecord[entity.id] = entity;
          }
          return allEntitiesRecord;
        });
      res.status(200).send({ ok: true, data: { apiKey: apiKey, allUsers, allEntities }, error: '' });
    }
  )
);

router.post(
  '/api-key-approval',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminApiKeyAndApprovalsResponse>,
      next: express.NextFunction
    ) => {
      const action = req.body.action as 'create' | 'delete' | 'update';
      const body: Prisma.ApiKeyApprovalByUserOrEntityUncheckedCreateInput = {
        user_id: req.body.user_id,
        entity_id: req.body.entity_id,
        api_key_id: req.body.api_key_id,
        status: req.body.status as ApiKeyApprovalStatus,
      };
      const where: Prisma.ApiKeyApprovalByUserOrEntityWhereUniqueInput | undefined = body.user_id
        ? {
            api_key_id_user_id: {
              api_key_id: body.api_key_id,
              user_id: body.user_id,
            },
          }
        : body.entity_id
          ? {
              api_key_id_entity_id: {
                api_key_id: body.api_key_id,
                entity_id: body.entity_id,
              },
            }
          : undefined;
      if (action === 'delete') {
        await prisma.apiKeyApprovalByUserOrEntity.delete({
          where,
        });
      } else {
        await prisma.apiKeyApprovalByUserOrEntity.upsert({
          where,
          update: body,
          create: body,
        });
      }
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: body.api_key_id },
        include: {
          approvals: {
            include: {
              User: true,
              Entity: true,
            },
          },
        },
      });
      if (!apiKey) {
        res.status(404).send({ ok: false, data: null, error: 'API key not found' });
        return;
      }
      const approvalsRecord: Record<string, boolean> = {};
      for (const approval of apiKey.approvals) {
        if (approval.user_id) {
          approvalsRecord[approval.user_id] = true;
        }
        if (approval.entity_id) {
          approvalsRecord[approval.entity_id] = true;
        }
      }
      const allUsers = await prisma.user.findMany({ where: { deleted_at: null } }).then((users) => {
        const allUsersRecord: Record<string, User> = {};
        for (const user of users) {
          if (approvalsRecord[user.id]) {
            continue;
          }
          allUsersRecord[user.id] = user;
        }
        return allUsersRecord;
      });
      const allEntities = await prisma.entity.findMany({ where: { deleted_at: null } }).then((entities) => {
        const allEntitiesRecord: Record<string, Entity> = {};
        for (const entity of entities) {
          if (approvalsRecord[entity.id]) {
            continue;
          }
          allEntitiesRecord[entity.id] = entity;
        }
        return allEntitiesRecord;
      });
      res.status(200).send({ ok: true, data: { apiKey: apiKey, allUsers, allEntities }, error: '' });
    }
  )
);

export default router;
