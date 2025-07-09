-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityRelationType" ADD VALUE 'CAN_TRANSMIT_CARCASSES_TO_ENTITY';
ALTER TYPE "EntityRelationType" ADD VALUE 'CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY';
ALTER TYPE "EntityRelationType" ADD VALUE 'WORKING_FOR_ENTITY_RELATED_WITH';
ALTER TYPE "EntityRelationType" ADD VALUE 'NONE';
