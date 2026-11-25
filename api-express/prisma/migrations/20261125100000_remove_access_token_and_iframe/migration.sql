-- Le lien de création de fiche ne connecte plus l'utilisateur (plus d'access token) et Zacharie
-- ne s'affiche plus dans une iframe tierce.

-- DropIndex
DROP INDEX "ApiKeyApprovalByUserOrEntity_access_token_key";

-- AlterTable
ALTER TABLE "ApiKeyApprovalByUserOrEntity" DROP COLUMN "access_token",
DROP COLUMN "access_token_created_at";

-- AlterTable
ALTER TABLE "ApiKey" DROP COLUMN "frame_ancestors";

-- AlterEnum
UPDATE "ApiKey" SET "scopes" = array_remove("scopes", 'USER_LOGIN_FOR_USER');
BEGIN;
CREATE TYPE "ApiKeyScope_new" AS ENUM ('FEI_READ_FOR_USER', 'FEI_READ_FOR_ENTITY', 'CARCASSE_READ_FOR_USER', 'CARCASSE_READ_FOR_ENTITY');
ALTER TABLE "ApiKey" ALTER COLUMN "scopes" TYPE "ApiKeyScope_new"[] USING ("scopes"::text::"ApiKeyScope_new"[]);
ALTER TYPE "ApiKeyScope" RENAME TO "ApiKeyScope_old";
ALTER TYPE "ApiKeyScope_new" RENAME TO "ApiKeyScope";
DROP TYPE "ApiKeyScope_old";
COMMIT;
