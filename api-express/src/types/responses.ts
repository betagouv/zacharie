import type {
  User,
  Entity,
  EntityAndUserRelations,
  Carcasse,
  CarcasseIntermediaire,
  Log,
  CarcasseCertificat,
  ApiKey,
  ApiKeyApprovalByUserOrEntity,
  Fei,
} from '@prisma/client';
import type { UserForFei, UserForAdmin } from './user';
import type { FeiDone, FeiWithIntermediaires, FeiPopulated } from './fei';
import type { EntityForAdmin, EntityWithUserRelation, EntitiesByTypeAndId, EntitiesById } from './entity';
import { CarcasseForResponseForRegistry } from './carcasse';

export interface SyncRequest {
  feis: Array<Partial<Fei> & { numero: string }>;
  carcasses: Array<Partial<Carcasse> & { fei_numero: string; zacharie_carcasse_id: string }>;
  carcassesIntermediaires: Array<
    Partial<CarcasseIntermediaire> & {
      fei_numero: string;
      intermediaire_id: string;
      zacharie_carcasse_id: string;
    }
  >;
  logs: Array<Partial<Log> & { id: string }>;
}

export interface SyncResponse {
  ok: boolean;
  data: {
    feis: Array<FeiPopulated>;
    carcasses: Array<Carcasse>;
    carcassesIntermediaires: Array<CarcasseIntermediaire>;
    syncedLogIds: Array<string>;
  } | null;
  error: string;
}

export interface SearchResponse {
  ok: boolean;
  data: Array<{
    searchQuery: string;
    redirectUrl: string;
    carcasse_numero_bracelet: string;
    carcasse_espece: string;
    carcasse_type: Carcasse['type'] | '';
    fei_numero: string;
    fei_date_mise_a_mort: string;
    fei_svi_assigned_at: string;
    fei_commune_mise_a_mort: string;
  }>;
  error: string;
}

export interface UserConnexionResponse {
  ok: boolean;
  data: {
    user: User | null;
    apiKeyApprovals?: Array<
      ApiKeyApprovalByUserOrEntity & {
        ApiKey: Omit<
          ApiKey,
          'private_key' | 'public_key' | 'access_token' | 'access_token_read_at' | 'slug_for_context'
        >;
      }
    >;
    contexte?: string;
  };
  error: string;
  message: string;
}

export interface UserForFeiResponse {
  ok: boolean;
  data: {
    user: UserForFei | null;
  };
  error: string;
}

export interface UserEntityResponse {
  ok: boolean;
  data: {
    entity: Entity | null;
    relation: EntityAndUserRelations | null;
  };
  error: string;
}

export interface UserCCGsResponse {
  ok: boolean;
  data: {
    userCCGs: Array<Entity>;
  };
  error: string;
}

export interface UserMyRelationsResponse {
  ok: true;
  data: {
    user: User;
    detenteursInitiaux: Array<UserForFei>;
    // examinateursInitiaux:  Array<User>,
    associationsDeChasse: Array<EntityWithUserRelation>;
    ccgs: Array<EntityWithUserRelation>;
    collecteursPro: Array<EntityWithUserRelation>;
    etgs: Array<EntityWithUserRelation>;
    svis: Array<EntityWithUserRelation>;
    entitiesICanHandleCarcassOnBehalf: Array<EntityWithUserRelation>;
    circuitCourt: Array<EntityWithUserRelation>;
  };
  error: '';
}

export interface FeiResponse {
  ok: boolean;
  data: {
    fei: FeiPopulated | null;
  };
  error: string;
}

export interface FeiRefreshResponse {
  ok: boolean;
  data: {
    feis: Array<FeiPopulated>;
  };
  error: string;
}

export interface FeisResponse {
  ok: boolean;
  data: {
    user: User;
    feisUnderMyResponsability: Array<FeiWithIntermediaires>;
    feisToTake: Array<FeiWithIntermediaires>;
    feisOngoing: Array<FeiWithIntermediaires>;
  };
  error: string;
}

export interface FeisDoneResponse {
  ok: boolean;
  data: {
    user: User;
    feisDone: Array<FeiDone>;
  };
  error: string;
}

export interface EntitiesWorkingForResponse {
  ok: true;
  data: {
    allEntitiesByTypeAndId: EntitiesByTypeAndId;
    userEntitiesByTypeAndId: EntitiesByTypeAndId;
  };
  error: '';
}

export interface PartenairesResponse {
  ok: true;
  data: {
    allEntitiesById: EntitiesById;
    userEntitiesById: EntitiesById;
  };
  error: '';
}

export interface CarcasseIntermediaireResponse {
  ok: boolean;
  data: {
    carcasseIntermediaire: CarcasseIntermediaire | null;
  };
  error: string;
}

export interface AdminGetEntityResponse {
  ok: boolean;
  data: null | {
    entity: EntityForAdmin;
    dedicatedApiKey: ApiKey | null;
    canTakeFichesForEntity: Array<UserForAdmin>;
    canSendFichesToEntity: Array<UserForAdmin>;
    sviRelatedToETG: Entity | null;
    potentialSvisRelatedToETG: Array<Entity>;
    etgsRelatedWithSvi: Array<Entity>;
    potentialEtgsRelatedWithSvi: Array<Entity>;
  };
  error: string;
}

export interface AdminActionEntityResponse {
  ok: boolean;
  data: {
    entity: EntityForAdmin;
  };
  error: string;
}

export interface AdminNewEntityResponse {
  ok: boolean;
  data: {
    entity: Entity;
  };
  error: string;
}

export interface AdminEntitiesResponse {
  ok: boolean;
  data: {
    entities: Array<Entity>;
  };
  error: string;
}

export interface AdminUsersResponse {
  ok: boolean;
  data: {
    users: Array<User>;
  };
  error: string;
}

export interface AdminUserDataResponse {
  ok: boolean;
  data: null | {
    user: User;
    identityDone: boolean;
    examinateurDone: boolean;
    allEntities: Array<Entity>;
    userEntitiesRelations: Array<EntityForAdmin>;
  };
  error: string;
}

export interface AdminNewUserDataResponse {
  ok: boolean;
  data: null | {
    user: User;
  };
  error: string;
}

export interface LogResponse {
  ok: boolean;
  data: {
    log: Log | null;
  };
  error: string;
}

export interface CarcasseResponse {
  ok: boolean;
  data: {
    carcasse: Carcasse | null;
  };
  error: string;
}

export interface CarcassesGetForRegistryResponse {
  ok: boolean;
  data: {
    carcasses: Array<CarcasseForResponseForRegistry>;
    hasMore: boolean;
    total: number;
  };
  error: string;
}

export interface CertificatResponse {
  ok: boolean;
  data: {
    certificat: CarcasseCertificat | null;
  };
  error: string;
}

export interface AdminApiKeysResponse {
  ok: boolean;
  data: {
    apiKeys: Array<
      ApiKey & { approvals: Array<ApiKeyApprovalByUserOrEntity & { User: User; Entity: Entity }> }
    >;
  };
  error: string;
}

export interface AdminApiKeyResponse {
  ok: boolean;
  data: {
    apiKey: ApiKey;
  };
  error: string;
}

export interface AdminApiKeyAndApprovalsResponse {
  ok: boolean;
  data: {
    apiKey: ApiKey & { approvals: Array<ApiKeyApprovalByUserOrEntity & { User: User; Entity: Entity }> };
    allUsers: Record<string, User>;
    allEntities: Record<string, Entity>;
  };
  error: string;
}
