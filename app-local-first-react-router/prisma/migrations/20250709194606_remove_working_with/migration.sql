/*
  Warnings:

  - The values [WORKING_FOR,WORKING_WITH] on the enum `EntityRelationType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EntityRelationType_new" AS ENUM ('CAN_TRANSMIT_CARCASSES_TO_ENTITY', 'CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY', 'WORKING_FOR_ENTITY_RELATED_WITH', 'NONE');
ALTER TABLE "EntityAndUserRelations" ALTER COLUMN "relation" TYPE "EntityRelationType_new" USING ("relation"::text::"EntityRelationType_new");
ALTER TYPE "EntityRelationType" RENAME TO "EntityRelationType_old";
ALTER TYPE "EntityRelationType_new" RENAME TO "EntityRelationType";
DROP TYPE "EntityRelationType_old";
COMMIT;
