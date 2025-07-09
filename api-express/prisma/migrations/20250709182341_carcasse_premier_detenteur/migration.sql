-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "premier_detenteur_depot_ccg_at" TIMESTAMP(3),
ADD COLUMN     "premier_detenteur_depot_entity_id" TEXT,
ADD COLUMN     "premier_detenteur_depot_type" "DepotType",
ADD COLUMN     "premier_detenteur_prochain_detenteur_id_cache" TEXT,
ADD COLUMN     "premier_detenteur_prochain_detenteur_type_cache" "EntityTypes",
ADD COLUMN     "premier_detenteur_transport_date" TIMESTAMP(3),
ADD COLUMN     "premier_detenteur_transport_type" "TransportType";
