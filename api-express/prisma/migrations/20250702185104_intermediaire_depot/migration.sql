-- AlterTable
ALTER TABLE "CarcasseIntermediaire" ADD COLUMN     "intermediaire_depot_ccg_at" TIMESTAMP(3),
ADD COLUMN     "intermediaire_depot_entity_id" TEXT,
ADD COLUMN     "intermediaire_depot_type" "DepotType",
ADD COLUMN     "intermediaire_prochain_detenteur_id_cache" TEXT,
ADD COLUMN     "intermediaire_prochain_detenteur_type_cache" "EntityTypes",
ADD COLUMN     "intermediaire_transport_date" TIMESTAMP(3),
ADD COLUMN     "intermediaire_transport_type" "TransportType";
