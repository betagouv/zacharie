import { z } from 'zod';
import type { Prisma } from '@prisma/client';

/////////////////////////////////////////
// HELPER FUNCTIONS
/////////////////////////////////////////


/////////////////////////////////////////
// ENUMS
/////////////////////////////////////////

export const TransactionIsolationLevelSchema = z.enum(['ReadUncommitted','ReadCommitted','RepeatableRead','Serializable']);

export const UserScalarFieldEnumSchema = z.enum(['id','email','telephone','prenom','nom_de_famille','numero_cfei','addresse_ligne_1','addresse_ligne_2','code_postal','ville','user_entities_vivible_checkbox','roles','created_at','updated_at','last_login_at','last_seen_at','deleted_at','onboarded_at','notifications','web_push_tokens','prefilled','activated']);

export const EntityScalarFieldEnumSchema = z.enum(['id','raison_sociale','address_ligne_1','address_ligne_2','code_postal','ville','siret','numero_ddecpp','type','created_at','updated_at','deleted_at','onboarded_at','coupled_entity_id','prefilled']);

export const PasswordScalarFieldEnumSchema = z.enum(['id','user_id','password','created_at','updated_at','deleted_at']);

export const UserRelationsScalarFieldEnumSchema = z.enum(['id','owner_id','related_id','relation','created_at','updated_at','deleted_at']);

export const EntityRelationsScalarFieldEnumSchema = z.enum(['id','owner_id','entity_id','relation','created_at','updated_at','deleted_at']);

export const LogsScalarFieldEnumSchema = z.enum(['id','user_id','action','created_at','updated_at','deleted_at']);

export const FeiScalarFieldEnumSchema = z.enum(['id','numero','date_mise_a_mort','commune_mise_a_mort','created_by_user_id','fei_current_owner_user_id','fei_current_owner_entity_id','fei_current_owner_role','fei_current_owner_wants_to_transfer','fei_next_owner_user_id','fei_next_owner_entity_id','fei_next_owner_role','fei_prev_owner_user_id','fei_prev_owner_entity_id','fei_prev_owner_role','examinateur_initial_user_id','examinateur_initial_approbation_mise_sur_le_marche','examinateur_initial_date_approbation_mise_sur_le_marche','premier_detenteur_user_id','premier_detenteur_date_depot_quelque_part','premier_detenteur_depot_entity_id','premier_detenteur_depot_sauvage','svi_entity_id','svi_user_id','svi_carcasses_saisies','svi_aucune_carcasse_saisie','svi_commentaire','svi_signed_at','created_at','updated_at','deleted_at']);

export const CarcasseScalarFieldEnumSchema = z.enum(['numero_bracelet','fei_numero','heure_mise_a_mort','heure_evisceration','espece','categorie','examinateur_carcasse_sans_anomalie','examinateur_anomalies_carcasse','examinateur_anomalies_abats','examinateur_commentaire','examinateur_signed_at','intermediaire_carcasse_refus_intermediaire_id','intermediaire_carcasse_refus_motif','intermediaire_carcasse_signed_at','intermediaire_carcasse_commentaire','svi_carcasse_saisie','svi_carcasse_saisie_motif','svi_carcasse_saisie_at','svi_carcasse_signed_at','svi_carcasse_commentaire','created_at','updated_at','deleted_at']);

export const InterventionOnFeiScalarFieldEnumSchema = z.enum(['id','fei_numero','user_id','entity_id','role','created_at','updated_at','deleted_at']);

export const FeiIntermediaireScalarFieldEnumSchema = z.enum(['id','fei_numero','fei_intermediaire_user_id','fei_intermediaire_entity_id','fei_intermediaire_role','commentaire','received_at','check_finished_at','handover_at','created_at','updated_at','deleted_at']);

export const CarcasseIntermediaireScalarFieldEnumSchema = z.enum(['fei_numero__bracelet__intermediaire_id','fei_numero','numero_bracelet','fei_intermediaire_id','fei_intermediaire_user_id','fei_intermediaire_entity_id','prise_en_charge','refus','commentaire','carcasse_check_finished_at','created_at','updated_at','deleted_at']);

export const NotificationLogScalarFieldEnumSchema = z.enum(['id','type','email','web_push_token','user_id','action','payload','created_at','updated_at','deleted_at']);

export const SortOrderSchema = z.enum(['asc','desc']);

export const QueryModeSchema = z.enum(['default','insensitive']);

export const NullsOrderSchema = z.enum(['first','last']);

export const UserRolesSchema = z.enum(['ADMIN','EXAMINATEUR_INITIAL','PREMIER_DETENTEUR','CCG','COLLECTEUR_PRO','ETG','SVI']);

export type UserRolesType = `${z.infer<typeof UserRolesSchema>}`

export const UserNotificationsSchema = z.enum(['EMAIL','SMS','PUSH']);

export type UserNotificationsType = `${z.infer<typeof UserNotificationsSchema>}`

export const EntityTypesSchema = z.enum(['COLLECTEUR_PRO','CCG','ETG','SVI']);

export type EntityTypesType = `${z.infer<typeof EntityTypesSchema>}`

export const UserRelationTypeSchema = z.enum(['PREMIER_DETENTEUR','EXAMINATEUR_INITIAL']);

export type UserRelationTypeType = `${z.infer<typeof UserRelationTypeSchema>}`

export const EntityRelationTypeSchema = z.enum(['WORKING_FOR','WORKING_WITH']);

export type EntityRelationTypeType = `${z.infer<typeof EntityRelationTypeSchema>}`

/////////////////////////////////////////
// MODELS
/////////////////////////////////////////

/////////////////////////////////////////
// USER SCHEMA
/////////////////////////////////////////

export const UserSchema = z.object({
  roles: UserRolesSchema.array(),
  notifications: UserNotificationsSchema.array(),
  id: z.string(),
  email: z.string().nullable(),
  telephone: z.string().nullable(),
  prenom: z.string().nullable(),
  nom_de_famille: z.string().nullable(),
  numero_cfei: z.string().nullable(),
  addresse_ligne_1: z.string().nullable(),
  addresse_ligne_2: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  user_entities_vivible_checkbox: z.boolean().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  last_login_at: z.coerce.date().nullable(),
  last_seen_at: z.coerce.date().nullable(),
  deleted_at: z.coerce.date().nullable(),
  onboarded_at: z.coerce.date().nullable(),
  web_push_tokens: z.string().array(),
  prefilled: z.boolean(),
  activated: z.boolean(),
})

export type User = z.infer<typeof UserSchema>

/////////////////////////////////////////
// ENTITY SCHEMA
/////////////////////////////////////////

export const EntitySchema = z.object({
  type: EntityTypesSchema,
  id: z.string(),
  raison_sociale: z.string().nullable(),
  address_ligne_1: z.string().nullable(),
  address_ligne_2: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  siret: z.string().nullable(),
  numero_ddecpp: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
  onboarded_at: z.coerce.date().nullable(),
  coupled_entity_id: z.string().nullable(),
  prefilled: z.boolean(),
})

export type Entity = z.infer<typeof EntitySchema>

/////////////////////////////////////////
// PASSWORD SCHEMA
/////////////////////////////////////////

export const PasswordSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  password: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
})

export type Password = z.infer<typeof PasswordSchema>

/////////////////////////////////////////
// USER RELATIONS SCHEMA
/////////////////////////////////////////

export const UserRelationsSchema = z.object({
  relation: UserRelationTypeSchema,
  id: z.string(),
  owner_id: z.string(),
  related_id: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
})

export type UserRelations = z.infer<typeof UserRelationsSchema>

/////////////////////////////////////////
// ENTITY RELATIONS SCHEMA
/////////////////////////////////////////

export const EntityRelationsSchema = z.object({
  relation: EntityRelationTypeSchema,
  id: z.string(),
  owner_id: z.string(),
  entity_id: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
})

export type EntityRelations = z.infer<typeof EntityRelationsSchema>

/////////////////////////////////////////
// LOGS SCHEMA
/////////////////////////////////////////

export const LogsSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  action: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
})

export type Logs = z.infer<typeof LogsSchema>

/////////////////////////////////////////
// FEI SCHEMA
/////////////////////////////////////////

export const FeiSchema = z.object({
  fei_current_owner_role: UserRolesSchema.nullable(),
  fei_next_owner_role: UserRolesSchema.nullable(),
  fei_prev_owner_role: UserRolesSchema.nullable(),
  id: z.number().int(),
  numero: z.string(),
  date_mise_a_mort: z.coerce.date().nullable(),
  commune_mise_a_mort: z.string().nullable(),
  created_by_user_id: z.string(),
  fei_current_owner_user_id: z.string().nullable(),
  fei_current_owner_entity_id: z.string().nullable(),
  fei_current_owner_wants_to_transfer: z.boolean().nullable(),
  fei_next_owner_user_id: z.string().nullable(),
  fei_next_owner_entity_id: z.string().nullable(),
  fei_prev_owner_user_id: z.string().nullable(),
  fei_prev_owner_entity_id: z.string().nullable(),
  examinateur_initial_user_id: z.string().nullable(),
  examinateur_initial_approbation_mise_sur_le_marche: z.boolean().nullable(),
  examinateur_initial_date_approbation_mise_sur_le_marche: z.coerce.date().nullable(),
  premier_detenteur_user_id: z.string().nullable(),
  premier_detenteur_date_depot_quelque_part: z.coerce.date().nullable(),
  premier_detenteur_depot_entity_id: z.string().nullable(),
  premier_detenteur_depot_sauvage: z.string().nullable(),
  svi_entity_id: z.string().nullable(),
  svi_user_id: z.string().nullable(),
  svi_carcasses_saisies: z.number().int().nullable(),
  svi_aucune_carcasse_saisie: z.boolean().nullable(),
  svi_commentaire: z.string().nullable(),
  svi_signed_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
})

export type Fei = z.infer<typeof FeiSchema>

/////////////////////////////////////////
// CARCASSE SCHEMA
/////////////////////////////////////////

export const CarcasseSchema = z.object({
  numero_bracelet: z.string(),
  fei_numero: z.string(),
  heure_mise_a_mort: z.string().nullable(),
  heure_evisceration: z.string().nullable(),
  espece: z.string().nullable(),
  categorie: z.string().nullable(),
  examinateur_carcasse_sans_anomalie: z.boolean().nullable(),
  examinateur_anomalies_carcasse: z.string().array(),
  examinateur_anomalies_abats: z.string().array(),
  examinateur_commentaire: z.string().nullable(),
  examinateur_signed_at: z.coerce.date().nullable(),
  intermediaire_carcasse_refus_intermediaire_id: z.string().nullable(),
  intermediaire_carcasse_refus_motif: z.string().nullable(),
  intermediaire_carcasse_signed_at: z.coerce.date().nullable(),
  intermediaire_carcasse_commentaire: z.string().nullable(),
  svi_carcasse_saisie: z.boolean().nullable(),
  svi_carcasse_saisie_motif: z.string().array(),
  svi_carcasse_saisie_at: z.coerce.date().nullable(),
  svi_carcasse_signed_at: z.coerce.date().nullable(),
  svi_carcasse_commentaire: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
})

export type Carcasse = z.infer<typeof CarcasseSchema>

/////////////////////////////////////////
// INTERVENTION ON FEI SCHEMA
/////////////////////////////////////////

export const InterventionOnFeiSchema = z.object({
  role: UserRolesSchema,
  id: z.string(),
  fei_numero: z.string(),
  user_id: z.string(),
  entity_id: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
})

export type InterventionOnFei = z.infer<typeof InterventionOnFeiSchema>

/////////////////////////////////////////
// FEI INTERMEDIAIRE SCHEMA
/////////////////////////////////////////

export const FeiIntermediaireSchema = z.object({
  fei_intermediaire_role: UserRolesSchema.nullable(),
  id: z.string(),
  fei_numero: z.string(),
  fei_intermediaire_user_id: z.string(),
  fei_intermediaire_entity_id: z.string(),
  commentaire: z.string().nullable(),
  received_at: z.coerce.date().nullable(),
  check_finished_at: z.coerce.date().nullable(),
  handover_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
})

export type FeiIntermediaire = z.infer<typeof FeiIntermediaireSchema>

/////////////////////////////////////////
// CARCASSE INTERMEDIAIRE SCHEMA
/////////////////////////////////////////

export const CarcasseIntermediaireSchema = z.object({
  fei_numero__bracelet__intermediaire_id: z.string(),
  fei_numero: z.string(),
  numero_bracelet: z.string(),
  fei_intermediaire_id: z.string(),
  fei_intermediaire_user_id: z.string(),
  fei_intermediaire_entity_id: z.string(),
  prise_en_charge: z.boolean().nullable(),
  refus: z.string().nullable(),
  commentaire: z.string().nullable(),
  carcasse_check_finished_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
})

export type CarcasseIntermediaire = z.infer<typeof CarcasseIntermediaireSchema>

/////////////////////////////////////////
// NOTIFICATION LOG SCHEMA
/////////////////////////////////////////

export const NotificationLogSchema = z.object({
  type: UserNotificationsSchema,
  id: z.string(),
  email: z.string().nullable(),
  web_push_token: z.string().nullable(),
  user_id: z.string(),
  action: z.string(),
  payload: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  deleted_at: z.coerce.date().nullable(),
})

export type NotificationLog = z.infer<typeof NotificationLogSchema>
