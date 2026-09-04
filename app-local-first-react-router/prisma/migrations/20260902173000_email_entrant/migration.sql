-- Journal des emails entrants (webhook Brevo Inbound Parsing) : sans lui, un message perdu,
-- un expéditeur inconnu ou un rapport non rattaché ne laissent aucune trace consultable.
CREATE TABLE "EmailEntrant" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "brevo_uuid" TEXT,
    "expediteur" TEXT NOT NULL,
    "destinataires" TEXT[],
    "sujet" TEXT,
    "recu_at" TIMESTAMP(3) NOT NULL,
    "spam_score" DOUBLE PRECISION,
    "nb_pieces_jointes" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL,
    "motif_ignore" TEXT,
    "laboratoire_reconnu" BOOLEAN NOT NULL DEFAULT false,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEntrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailEntrant_message_id_key" ON "EmailEntrant"("message_id");
CREATE INDEX "EmailEntrant_recu_at_idx" ON "EmailEntrant"("recu_at");
CREATE INDEX "EmailEntrant_statut_idx" ON "EmailEntrant"("statut");
CREATE INDEX "EmailEntrant_expediteur_idx" ON "EmailEntrant"("expediteur");
