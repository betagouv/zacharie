-- Add the new column
ALTER TABLE "Carcasse" ADD COLUMN "latest_intermediaire_signed_at" TIMESTAMP(3);

-- Copy data from old column to new column
UPDATE "Carcasse" 
SET "latest_intermediaire_signed_at" = "intermediaire_carcasse_signed_at";