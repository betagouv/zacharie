import { type Fei, type User, type Entity, type ETGAndEntityRelations } from '@prisma/client';
import { type UserForFei } from './user';
import { type FeiDone, type FeiWithIntermediaires, type FeiPopulated } from './fei';
import { type EntityWithUserRelation } from './entity';

export interface SearchResponse {
  ok: boolean;
  data: {
    searchQuery: string;
    redirectUrl: string;
    carcasse_numero_bracelet: string;
    fei_numero: string;
  };
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
  };
  error: '';
}

export interface FeiResponse {
  ok: boolean;
  data: {
    fei: FeiPopulated;
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
