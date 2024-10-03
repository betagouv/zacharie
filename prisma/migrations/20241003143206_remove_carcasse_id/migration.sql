-- Step 1: Drop foreign key constraints that reference Carcasse.numero_bracelet
ALTER TABLE
  "CarcasseIntermediaire" DROP CONSTRAINT IF EXISTS "CarcasseIntermediaire_numero_bracelet_fkey";

ALTER TABLE
  "_FeiIntermediairesCarcasse" DROP CONSTRAINT IF EXISTS "_FeiIntermediairesCarcasse_A_fkey";

-- Step 2: Drop the existing primary key on Carcasse
ALTER TABLE
  "Carcasse" DROP CONSTRAINT IF EXISTS "Carcasse_pkey";

-- Step 3: Rename the existing unique index instead of dropping it
ALTER INDEX IF EXISTS "Carcasse_numero_bracelet_key" RENAME TO "Carcasse_pkey";

-- Step 4: Set the renamed index as the primary key
ALTER TABLE
  "Carcasse"
ADD
  CONSTRAINT "Carcasse_pkey" PRIMARY KEY USING INDEX "Carcasse_pkey";

-- Step 5: Drop the id column from Carcasse
ALTER TABLE
  "Carcasse" DROP COLUMN IF EXISTS "id";

-- Step 6: Modify CarcasseIntermediaire table
ALTER TABLE
  "CarcasseIntermediaire" DROP CONSTRAINT IF EXISTS "CarcasseIntermediaire_pkey";

ALTER TABLE
  "CarcasseIntermediaire" DROP COLUMN IF EXISTS "id";

ALTER TABLE
  "CarcasseIntermediaire"
ADD
  CONSTRAINT "CarcasseIntermediaire_pkey" PRIMARY KEY ("fei_numero__bracelet__intermediaire_id");

-- Step 7: Recreate foreign key constraints
ALTER TABLE
  "CarcasseIntermediaire"
ADD
  CONSTRAINT "CarcasseIntermediaire_numero_bracelet_fkey" FOREIGN KEY ("numero_bracelet") REFERENCES "Carcasse"("numero_bracelet") ON DELETE CASCADE;

ALTER TABLE
  "_FeiIntermediairesCarcasse"
ADD
  CONSTRAINT "_FeiIntermediairesCarcasse_A_fkey" FOREIGN KEY ("A") REFERENCES "Carcasse"("numero_bracelet") ON DELETE CASCADE ON UPDATE CASCADE;

-- Optional: Drop the unused index if it still exists
DROP INDEX IF EXISTS "CarcasseIntermediaire_fei_numero__bracelet__intermediaire_i_key";