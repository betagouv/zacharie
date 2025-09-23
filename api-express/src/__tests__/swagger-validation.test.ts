import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import swaggerEntityDocument from '../controllers/v1/swagger-cle-dediee.json';
import swaggerThirdPartyDocument from '../controllers/v1/swagger-tierce-partie.json';
import v1Router from '../controllers/v1/index';

// Mock app setup for testing
const app = express();
app.use(express.json());
app.use('/v1', v1Router);

describe('Swagger Documentation Validation', () => {
  describe('Entity Swagger JSON Structure', () => {
    test('should have valid OpenAPI structure', () => {
      expect(swaggerEntityDocument.openapi).toBe('3.0.0');
      expect(swaggerEntityDocument.info).toBeDefined();
      expect(swaggerEntityDocument.info.title).toBe('API Zacharie v1 - Accès Direct Entité');
      expect(swaggerEntityDocument.paths).toBeDefined();
      expect(swaggerEntityDocument.components).toBeDefined();
    });

    test('should have security schemes configured', () => {
      expect(swaggerEntityDocument.components.securitySchemes.ApiKeyAuth).toBeDefined();
      expect(swaggerEntityDocument.components.securitySchemes.ApiKeyAuth.type).toBe('apiKey');
      expect(swaggerEntityDocument.components.securitySchemes.ApiKeyAuth.in).toBe('header');
      expect(swaggerEntityDocument.components.securitySchemes.ApiKeyAuth.name).toBe('Authorization');
    });
  });

  describe('Third-party Swagger JSON Structure', () => {
    test('should have valid OpenAPI structure', () => {
      expect(swaggerThirdPartyDocument.openapi).toBe('3.0.0');
      expect(swaggerThirdPartyDocument.info).toBeDefined();
      expect(swaggerThirdPartyDocument.info.title).toBe('API Zacharie v1 - Accès Tiers');
      expect(swaggerThirdPartyDocument.paths).toBeDefined();
      expect(swaggerThirdPartyDocument.components).toBeDefined();
    });

    test('should have security schemes configured', () => {
      expect(swaggerThirdPartyDocument.components.securitySchemes.ApiKeyAuth).toBeDefined();
      expect(swaggerThirdPartyDocument.components.securitySchemes.ApiKeyAuth.type).toBe('apiKey');
      expect(swaggerThirdPartyDocument.components.securitySchemes.ApiKeyAuth.in).toBe('header');
      expect(swaggerThirdPartyDocument.components.securitySchemes.ApiKeyAuth.name).toBe('Authorization');
    });
  });

  describe('API Endpoints Match Swagger Paths', () => {
    test('entity swagger should have FEI and direct carcasse endpoints only', () => {
      const entityPaths = Object.keys(swaggerEntityDocument.paths);

      // Should have FEI endpoint
      expect(entityPaths).toContain('/fei');

      // Should have direct carcasse endpoints (no /user routes)
      expect(entityPaths).toContain('/carcasse');
      expect(entityPaths).toContain('/carcasse/{date_mise_a_mort}/{numero_bracelet}');

      // Should NOT have user routes
      expect(entityPaths).not.toContain('/carcasse/user');
      expect(entityPaths).not.toContain('/carcasse/user/{date_mise_a_mort}/{numero_bracelet}');
    });

    test('third-party swagger should have user carcasse, approval request, and FEI user endpoints', () => {
      const thirdPartyPaths = Object.keys(swaggerThirdPartyDocument.paths);

      // Should have user carcasse endpoints
      expect(thirdPartyPaths).toContain('/carcasse/user');
      expect(thirdPartyPaths).toContain('/carcasse/user/{date_mise_a_mort}/{numero_bracelet}');

      // Should have approval request endpoints
      expect(thirdPartyPaths).toContain('/approval-request/user');
      expect(thirdPartyPaths).toContain('/approval-request/entite');

      // Should have FEI user endpoint
      expect(thirdPartyPaths).toContain('/fei/user');

      // Should NOT have FEI or direct carcasse routes
      expect(thirdPartyPaths).not.toContain('/fei');
      expect(thirdPartyPaths).not.toContain('/carcasse');
      expect(thirdPartyPaths).not.toContain('/carcasse/{date_mise_a_mort}/{numero_bracelet}');
    });
  });

  describe('Response Schemas Match TypeScript Types', () => {
    test('entity swagger should have FeiResponse schema', () => {
      const feiResponseSchema = swaggerEntityDocument.components.schemas.FeiResponse;
      expect(feiResponseSchema.properties.ok).toBeDefined();
      expect(feiResponseSchema.properties.data).toBeDefined();
      expect(feiResponseSchema.properties.data.properties.feis).toBeDefined();
      expect(feiResponseSchema.properties.message).toBeDefined();
    });

    test('third-party swagger should have FeiResponse and ApprovalRequestResponse schemas', () => {
      const feiResponseSchema = swaggerThirdPartyDocument.components.schemas.FeiResponse;
      expect(feiResponseSchema.properties.ok).toBeDefined();
      expect(feiResponseSchema.properties.data).toBeDefined();
      expect(feiResponseSchema.properties.data.properties.feis).toBeDefined();
      expect(feiResponseSchema.properties.message).toBeDefined();

      const approvalRequestResponseSchema =
        swaggerThirdPartyDocument.components.schemas.ApprovalRequestResponse;
      expect(approvalRequestResponseSchema.properties.ok).toBeDefined();
      expect(approvalRequestResponseSchema.properties.data).toBeDefined();
      expect(approvalRequestResponseSchema.properties.data.properties.approvalStatus).toBeDefined();
      expect(approvalRequestResponseSchema.properties.message).toBeDefined();
    });

    test('both swaggers should have CarcasseResponse schema', () => {
      [swaggerEntityDocument, swaggerThirdPartyDocument].forEach((doc) => {
        const carcasseResponseSchema = doc.components.schemas.CarcasseResponse;
        expect(carcasseResponseSchema.properties.ok).toBeDefined();
        expect(carcasseResponseSchema.properties.data).toBeDefined();
        expect(carcasseResponseSchema.properties.data.properties.carcasse).toBeDefined();
        expect(carcasseResponseSchema.properties.message).toBeDefined();
      });
    });

    test('both swaggers should have CarcassesResponse schema', () => {
      [swaggerEntityDocument, swaggerThirdPartyDocument].forEach((doc) => {
        const carcassesResponseSchema = doc.components.schemas.CarcassesResponse;
        expect(carcassesResponseSchema.properties.ok).toBeDefined();
        expect(carcassesResponseSchema.properties.data).toBeDefined();
        expect(carcassesResponseSchema.properties.data.properties.carcasses).toBeDefined();
        expect(carcassesResponseSchema.properties.message).toBeDefined();
      });
    });

    test('both swaggers should have ErrorResponse schema', () => {
      [swaggerEntityDocument, swaggerThirdPartyDocument].forEach((doc) => {
        const errorResponseSchema = doc.components.schemas.ErrorResponse;
        expect(errorResponseSchema.properties.ok).toBeDefined();
        expect(errorResponseSchema.properties.error).toBeDefined();
        expect(errorResponseSchema.properties.message).toBeDefined();
      });
    });
  });

  describe('Parameter Validation', () => {
    test('FEI endpoint should have correct query parameters', () => {
      const feiEndpoint = swaggerEntityDocument.paths['/fei'].get;
      const parameters = feiEndpoint.parameters;

      const dateFromParam = parameters.find((p) => p.name === 'date_from');
      const dateToParam = parameters.find((p) => p.name === 'date_to');

      expect(dateFromParam).toBeDefined();
      expect(dateFromParam.required).toBe(true);
      expect(dateFromParam.schema.pattern).toBe('^\\d{4}-\\d{2}-\\d{2}$');

      expect(dateToParam).toBeDefined();
      expect(dateToParam.required).toBe(true);
      expect(dateToParam.schema.pattern).toBe('^\\d{4}-\\d{2}-\\d{2}$');
    });

    test('FEI user endpoint should have correct query parameters', () => {
      const feiUserEndpoint = swaggerThirdPartyDocument.paths['/fei/user'].get;
      const parameters = feiUserEndpoint.parameters;

      const dateFromParam = parameters.find((p) => p.name === 'date_from');
      const dateToParam = parameters.find((p) => p.name === 'date_to');
      const emailParam = parameters.find((p) => p.name === 'email');

      expect(dateFromParam).toBeDefined();
      expect(dateFromParam.required).toBe(true);
      expect(dateFromParam.schema.pattern).toBe('^\\d{4}-\\d{2}-\\d{2}$');

      expect(dateToParam).toBeDefined();
      expect(dateToParam.required).toBe(true);
      expect(dateToParam.schema.pattern).toBe('^\\d{4}-\\d{2}-\\d{2}$');

      expect(emailParam).toBeDefined();
      expect(emailParam.in).toBe('query');
      expect(emailParam.required).toBe(true);
      expect(emailParam.schema.format).toBe('email');
    });

    test('Approval request endpoints should have correct request body schemas', () => {
      const userApprovalEndpoint = swaggerThirdPartyDocument.paths['/approval-request/user'].post;
      const entiteApprovalEndpoint = swaggerThirdPartyDocument.paths['/approval-request/entite'].post;

      // User approval endpoint
      const userRequestBody = userApprovalEndpoint.requestBody.content['application/json'].schema;
      expect(userRequestBody.properties.email).toBeDefined();
      expect(userRequestBody.properties.email.format).toBe('email');
      expect(userRequestBody.required).toContain('email');

      // Entity approval endpoint
      const entiteRequestBody = entiteApprovalEndpoint.requestBody.content['application/json'].schema;
      expect(entiteRequestBody.properties.siret).toBeDefined();
      expect(entiteRequestBody.properties.siret.pattern).toBe('^\\d{14}$');
      expect(entiteRequestBody.required).toContain('siret');
    });

    test('Carcasse user endpoint should have correct path and query parameters', () => {
      const carcasseUserEndpoint =
        swaggerThirdPartyDocument.paths['/carcasse/user/{date_mise_a_mort}/{numero_bracelet}'].get;
      const parameters = carcasseUserEndpoint.parameters;

      const dateMiseAMortParam = parameters.find((p) => p.name === 'date_mise_a_mort');
      const numeroBraceletParam = parameters.find((p) => p.name === 'numero_bracelet');
      const emailParam = parameters.find((p) => p.name === 'email');

      expect(dateMiseAMortParam).toBeDefined();
      expect(dateMiseAMortParam.in).toBe('path');
      expect(dateMiseAMortParam.required).toBe(true);
      expect(dateMiseAMortParam.schema.pattern).toBe('^\\d{4}-\\d{2}-\\d{2}$');

      expect(numeroBraceletParam).toBeDefined();
      expect(numeroBraceletParam.in).toBe('path');
      expect(numeroBraceletParam.required).toBe(true);

      expect(emailParam).toBeDefined();
      expect(emailParam.in).toBe('query');
      expect(emailParam.required).toBe(true);
      expect(emailParam.schema.format).toBe('email');
    });

    test('Entity carcasse endpoint should NOT have email parameter', () => {
      const carcasseEntityEndpoint =
        swaggerEntityDocument.paths['/carcasse/{date_mise_a_mort}/{numero_bracelet}'].get;
      const parameters = carcasseEntityEndpoint.parameters;

      const emailParam = parameters.find((p) => p.name === 'email');
      expect(emailParam).toBeUndefined();
    });
  });

  describe('HTTP Status Codes', () => {
    test('all entity endpoints should have proper error responses defined', () => {
      const paths = Object.values(swaggerEntityDocument.paths);

      paths.forEach((pathItem: any) => {
        const methods = Object.keys(pathItem);
        methods.forEach((method) => {
          const operation = pathItem[method];
          expect(operation.responses['400']).toBeDefined();
          expect(operation.responses['403']).toBeDefined();
          expect(operation.responses['200']).toBeDefined();
        });
      });
    });

    test('all third-party endpoints should have proper error responses defined', () => {
      const paths = Object.values(swaggerThirdPartyDocument.paths);

      paths.forEach((pathItem: any) => {
        const methods = Object.keys(pathItem);
        methods.forEach((method) => {
          const operation = pathItem[method];
          expect(operation.responses['400']).toBeDefined();
          expect(operation.responses['403']).toBeDefined();
          expect(operation.responses['200']).toBeDefined();
        });
      });
    });

    test('specific endpoints should have 404 responses', () => {
      // Entity specific endpoint
      const entitySpecificEndpoint =
        swaggerEntityDocument.paths['/carcasse/{date_mise_a_mort}/{numero_bracelet}'].get;
      expect(entitySpecificEndpoint.responses['404']).toBeDefined();

      // Third-party specific endpoint
      const thirdPartySpecificEndpoint =
        swaggerThirdPartyDocument.paths['/carcasse/user/{date_mise_a_mort}/{numero_bracelet}'].get;
      expect(thirdPartySpecificEndpoint.responses['404']).toBeDefined();
    });
  });

  describe('Swagger UI Integration', () => {
    test('should serve Entity Swagger UI at /docs/cle-dediee', async () => {
      const response = await request(app).get('/v1/docs/cle-dediee/').expect(200);
      expect(response.text).toContain('swagger-ui');
    });

    test('should serve Third-party Swagger UI at /docs/tierces-parties', async () => {
      const response = await request(app).get('/v1/docs/tierces-parties/').expect(200);
      expect(response.text).toContain('swagger-ui');
    });

    // test('should redirect /api-docs to /docs/cle-dediee', async () => {
    //   const response = await request(app).get('/v1/api-docs').expect(302);
    //   expect(response.headers.location).toBe('/v1/docs/cle-dediee');
    // });
  });

  describe('API Key Authentication', () => {
    test('endpoints should require authentication', async () => {
      // Test FEI endpoint without auth
      await request(app).get('/v1/fei?date_from=2025-01-01&date_to=2025-01-31').expect(401);

      // Test Carcasse endpoint without auth
      await request(app).get('/v1/carcasse/2025-01-01/BRACELET123').expect(401);

      // Test User Carcasse endpoint without auth
      await request(app).get('/v1/carcasse/user/2025-01-01/BRACELET123?email=test@example.com').expect(401);
    });

    test('approval request endpoints should require authentication', async () => {
      // Test user approval endpoint without auth
      await request(app).post('/v1/approval-request/user').send({ email: 'test@example.com' }).expect(401);

      // Test entity approval endpoint without auth
      await request(app).post('/v1/approval-request/entite').send({ siret: '12345678901234' }).expect(401);
    });

    test('FEI user endpoint should require authentication', async () => {
      await request(app)
        .get('/v1/fei/user?date_from=2025-01-01&date_to=2025-01-31&email=test@example.com')
        .expect(401);
    });

    test('endpoints should reject invalid API keys', async () => {
      // Test with invalid API key
      await request(app)
        .get('/v1/fei?date_from=2025-01-01&date_to=2025-01-31')
        .set('Authorization', 'Bearer invalid-key')
        .expect(401);
    });
  });

  describe('Parameter Validation Integration', () => {
    test('should validate date format in FEI endpoint', async () => {
      await request(app)
        .get('/v1/fei?date_from=invalid-date&date_to=2025-01-31')
        .set('Authorization', 'Bearer test-api-key')
        .expect(400);
    });

    test('should validate email format in carcasse user endpoint', async () => {
      await request(app)
        .get('/v1/carcasse/user/2025-01-01/BRACELET123?email=invalid-email')
        .set('Authorization', 'Bearer test-api-key')
        .expect(400);
    });

    test('should validate request body in approval request endpoints', async () => {
      // Test invalid email format
      await request(app)
        .post('/v1/approval-request/user')
        .set('Authorization', 'Bearer test-api-key')
        .send({ email: 'invalid-email' })
        .expect(400);

      // Test invalid SIRET format
      await request(app)
        .post('/v1/approval-request/entite')
        .set('Authorization', 'Bearer test-api-key')
        .send({ siret: '123' })
        .expect(400);
    });

    test('should validate parameters in FEI user endpoint', async () => {
      await request(app)
        .get('/v1/fei/user?date_from=invalid-date&date_to=2025-01-31&email=test@example.com')
        .set('Authorization', 'Bearer test-api-key')
        .expect(400);
    });
  });
});

describe('Documentation Completeness', () => {
  test('entity swagger should document all response fields', () => {
    const responseSchemas = ['FeiResponse', 'CarcasseResponse', 'CarcassesResponse', 'ErrorResponse'];

    responseSchemas.forEach((schemaName) => {
      const schema = (swaggerEntityDocument.components.schemas as any)[schemaName];
      expect(schema).toBeDefined();
      expect(schema.properties.ok).toBeDefined();

      if (schemaName === 'ErrorResponse') {
        expect(schema.properties.error).toBeDefined();
      } else {
        expect(schema.properties.data).toBeDefined();
      }

      expect(schema.properties.message).toBeDefined();
    });
  });

  test('third-party swagger should document all response fields', () => {
    const responseSchemas = [
      'FeiResponse',
      'CarcasseResponse',
      'CarcassesResponse',
      'ApprovalRequestResponse',
      'ErrorResponse',
    ];

    responseSchemas.forEach((schemaName) => {
      const schema = (swaggerThirdPartyDocument.components.schemas as any)[schemaName];
      expect(schema).toBeDefined();
      expect(schema.properties.ok).toBeDefined();

      if (schemaName === 'ErrorResponse') {
        expect(schema.properties.error).toBeDefined();
      } else {
        expect(schema.properties.data).toBeDefined();
      }

      expect(schema.properties.message).toBeDefined();
    });
  });

  test('entity swagger should have proper tags for organization', () => {
    const paths = Object.values(swaggerEntityDocument.paths);

    paths.forEach((pathItem: any) => {
      const methods = Object.keys(pathItem);
      methods.forEach((method) => {
        const operation = pathItem[method];
        expect(operation.tags).toBeDefined();
        expect(operation.tags.length).toBeGreaterThan(0);
        expect(['FEI - Accès Direct', 'Carcasses - Accès Direct']).toContain(operation.tags[0]);
      });
    });
  });

  test('third-party swagger should have proper tags for organization', () => {
    const paths = Object.values(swaggerThirdPartyDocument.paths);

    paths.forEach((pathItem: any) => {
      const methods = Object.keys(pathItem);
      methods.forEach((method) => {
        const operation = pathItem[method];
        expect(operation.tags).toBeDefined();
        expect(operation.tags.length).toBeGreaterThan(0);
        expect(['Carcasses - Accès Tiers', 'Approbations - Accès Tiers', 'FEI - Accès Tiers']).toContain(
          operation.tags[0],
        );
      });
    });
  });

  test('should have proper separation of concerns', () => {
    // Entity swagger should not have FeiResponse in third-party swagger
    expect('ApprovalRequestResponse' in swaggerEntityDocument.components.schemas).toBe(false);

    // Both should have their own specific descriptions
    expect(swaggerEntityDocument.info.description).toContain('accès direct');
    expect(swaggerThirdPartyDocument.info.description).toContain('consentement');
  });
});
