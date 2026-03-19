import { vi } from 'vitest';

// Mock Prisma for tests
vi.mock('./src/prisma', () => ({
  default: {
    fei: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
    },
    carcasse: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
    },
    apiKey: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    apiKeyLog: {
      create: vi.fn(),
    },
    apiKeyApprovalByUserOrEntity: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    entity: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    entityAndUserRelations: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock passport authentication for tests
vi.mock('passport', () => ({
  default: {
    authenticate: vi.fn((strategy: string, options: any) => (req: any, res: any, next: any) => {
      // 'user' strategy: set req.user from x-test-user header (JSON-encoded user object)
      if (strategy === 'user') {
        const testUser = req.headers['x-test-user'];
        if (!testUser) {
          return res.status(401).json({ ok: false, error: 'Unauthorized', message: 'Unauthenticated' });
        }
        try {
          req.user = JSON.parse(testUser);
        } catch {
          return res.status(401).json({ ok: false, error: 'Unauthorized', message: 'Invalid test user' });
        }
        return next();
      }

      // API key strategy (used by v1 routes)
      const authHeader = req.headers.authorization;

      if (!authHeader || authHeader === 'Bearer invalid-key') {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized',
          message: 'Invalid API key',
        });
      }

      if (authHeader === 'Bearer test-api-key') {
        req.apiKey = {
          id: 'test-key-id',
          active: true,
          expires_at: null,
          scopes: ['FEI_READ_FOR_ENTITY', 'CARCASSE_READ_FOR_ENTITY'],
          dedicated_to_entity_id: 'test-entity-id',
        };
        return next();
      }

      return res.status(401).json({
        ok: false,
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
    }),
    initialize: vi.fn(() => (req: any, res: any, next: any) => next()),
  },
}));

// Mock the API utilities
vi.mock('./src/utils/api', async () => {
  const actual = await vi.importActual('./src/utils/api');
  return {
    ...actual,
    checkApiKeyIsValidMiddleware: vi.fn((scopes: any) => (req: any, res: any, next: any) => {
      // Mock successful scope validation for test API key
      if (req.apiKey && req.apiKey.id === 'test-key-id') {
        return next();
      }
      return res.status(401).json({
        ok: false,
        error: 'Unauthorized',
        message: 'Invalid API key scope',
      });
    }),
    getDedicatedEntityLinkedToApiKey: vi.fn().mockResolvedValue({
      id: 'test-entity-id',
      type: 'SVI',
      raison_sociale: 'Test Entity',
    }),
  };
});
