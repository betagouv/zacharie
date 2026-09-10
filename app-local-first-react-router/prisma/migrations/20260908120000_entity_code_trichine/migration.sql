-- Code court de l'établissement, imprimé dans les références trichine
-- (E/P/F-{YY}-{code}-{séquence}). Distinct de code_etbt_certificat, qui sert
-- au numérotage des certificats ETG et ne doit pas bouger.
ALTER TABLE "Entity" ADD COLUMN "code_trichine" TEXT;

CREATE UNIQUE INDEX "Entity_code_trichine_key" ON "Entity"("code_trichine");
