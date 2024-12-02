import type {
  User,
  ETGAndEntityRelations,
  Entity,
  EntityAndUserRelations,
  Carcasse,
  FeiIntermediaire,
  CarcasseIntermediaire,
} from '@prisma/client';
import type { UserForFei, UserForAdmin } from './user';
import type { FeiDone, FeiWithIntermediaires, FeiPopulated } from './fei';
import type { EntityForAdmin, EntityWithUserRelation, EntitiesByTypeAndId } from './entity';

export interface SearchResponse {
  ok: boolean;
  data: Array<{
    searchQuery: string;
    redirectUrl: string;
    carcasse_numero_bracelet: string;
    fei_numero: string;
    fei_date_mise_a_mort: string;
    fei_commune_mise_a_mort: string;
  }>;
  error: string;
}

export interface UserConnexionResponse {
  ok: boolean;
  data: {
    user: User | null;
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
    entitiesWorkingFor: Array<EntityWithUserRelation>;
    collecteursProsRelatedWithMyETGs: Array<ETGAndEntityRelations>;
    etgsRelatedWithMyEntities: Array<ETGAndEntityRelations>;
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

export interface CarcasseResponse {
  ok: boolean;
  data: {
    carcasse: Carcasse | null;
  };
  error: string;
}

export interface FeiIntermediaireResponse {
  ok: boolean;
  data: {
    feiIntermediaire: FeiIntermediaire | null;
  };
  error: string;
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
    usersWithEntityType: Array<UserForAdmin>;
    potentialPartenaires: Array<UserForAdmin>;
    collecteursRelatedToETG: Array<Entity>;
    potentialCollecteursRelatedToETG: Array<Entity>;
    svisRelatedToETG: Array<Entity>;
    potentialSvisRelatedToETG: Array<Entity>;
    etgsRelatedWithEntity: Array<Entity>;
    potentialEtgsRelatedWithEntity: Array<Entity>;
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
    userEntitiesRelations: Array<EntityWithUserRelation>;
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
