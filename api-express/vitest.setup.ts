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
    },
  },
}));

// Mock passport authentication for tests
vi.mock('passport', () => ({
  default: {
    authenticate: vi.fn((strategy: string, options: any) => (req: any, res: any, next: any) => {
      // Check if we're in a test that should fail authentication
      const authHeader = req.headers.authorization;

      if (!authHeader || authHeader === 'Bearer invalid-key') {
        // Simulate authentication failure
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized',
          message: 'Invalid API key',
        });
      }

      if (authHeader === 'Bearer test-api-key') {
        // Simulate successful authentication with a mock API key
        req.apiKey = {
          id: 'test-key-id',
          active: true,
          expires_at: null,
          scopes: ['FEI_READ_FOR_ENTITY', 'CARCASSE_READ_FOR_ENTITY'],
          dedicated_to_entity_id: 'test-entity-id',
        };
        return next();
      }

      // Default to authentication failure for unknown keys
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
