-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "BoardMemberRole" AS ENUM ('OWNER', 'EDITOR', 'COMMENTER', 'VIEWER');

-- CreateEnum
CREATE TYPE "BoardStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShareLinkMode" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateTable
CREATE TABLE "boards" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "thumbnail_url" VARCHAR(2048),
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "status" "BoardStatus" NOT NULL DEFAULT 'ACTIVE',
    "member_count" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_members" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "BoardMemberRole" NOT NULL DEFAULT 'VIEWER',
    "added_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_favourites" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_favourites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "token" VARCHAR(128) NOT NULL,
    "role" "BoardMemberRole" NOT NULL DEFAULT 'VIEWER',
    "mode" "ShareLinkMode" NOT NULL DEFAULT 'PRIVATE',
    "created_by_id" UUID,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_invites" (
    "id" UUID NOT NULL,
    "board_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "role" "BoardMemberRole" NOT NULL DEFAULT 'VIEWER',
    "invited_by_id" UUID NOT NULL,
    "token" VARCHAR(128),
    "expires_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boards_created_by_id_idx" ON "boards"("created_by_id");

-- CreateIndex
CREATE INDEX "boards_is_archived_idx" ON "boards"("is_archived");

-- CreateIndex
CREATE INDEX "boards_status_idx" ON "boards"("status");

-- CreateIndex
CREATE INDEX "boards_title_idx" ON "boards"("title");

-- CreateIndex
CREATE INDEX "boards_title_trgm_idx" ON "boards" USING gin ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "boards_updated_at_idx" ON "boards"("updated_at");

-- CreateIndex
CREATE INDEX "boards_deleted_at_idx" ON "boards"("deleted_at");

-- CreateIndex
CREATE INDEX "board_members_user_id_idx" ON "board_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_members_board_id_user_id_key" ON "board_members"("board_id", "user_id");

-- CreateIndex
CREATE INDEX "board_favourites_user_id_idx" ON "board_favourites"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_favourites_board_id_user_id_key" ON "board_favourites"("board_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "share_links_board_id_idx" ON "share_links"("board_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_invites_token_key" ON "pending_invites"("token");

-- CreateIndex
CREATE INDEX "pending_invites_email_idx" ON "pending_invites"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pending_invites_board_id_email_key" ON "pending_invites"("board_id", "email");

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_favourites" ADD CONSTRAINT "board_favourites_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_favourites" ADD CONSTRAINT "board_favourites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_invites" ADD CONSTRAINT "pending_invites_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_invites" ADD CONSTRAINT "pending_invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
