-- CreateEnum
CREATE TYPE "BoardVersionKind" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "BoardActivityType" AS ENUM ('CREATE', 'EDIT', 'VERSION_RESTORE', 'MANUAL_VERSION', 'ARCHIVE', 'DELETE', 'RESTORE');

-- AlterTable
ALTER TABLE "boards" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "board_versions" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "kind" "BoardVersionKind" NOT NULL DEFAULT 'AUTO',
    "note" VARCHAR(255),
    "data" JSONB NOT NULL DEFAULT '{}',
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "element_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_activity" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "type" "BoardActivityType" NOT NULL,
    "actor_id" UUID NOT NULL,
    "version_no" INTEGER,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "board_versions_board_id_version_no_key" ON "board_versions"("board_id", "version_no");

-- CreateIndex
CREATE INDEX "board_versions_board_id_created_at_idx" ON "board_versions"("board_id", "created_at");

-- CreateIndex
CREATE INDEX "board_versions_created_by_id_idx" ON "board_versions"("created_by_id");

-- CreateIndex
CREATE INDEX "board_activity_board_id_created_at_idx" ON "board_activity"("board_id", "created_at");

-- CreateIndex
CREATE INDEX "board_activity_actor_id_idx" ON "board_activity"("actor_id");

-- AddForeignKey
ALTER TABLE "board_versions" ADD CONSTRAINT "board_versions_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_versions" ADD CONSTRAINT "board_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_activity" ADD CONSTRAINT "board_activity_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_activity" ADD CONSTRAINT "board_activity_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
