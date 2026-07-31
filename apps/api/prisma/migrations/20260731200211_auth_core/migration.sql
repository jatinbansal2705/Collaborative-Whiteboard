/*
  Warnings:

  - You are about to drop the column `user_agent` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the column `email_verified` on the `users` table. All the data in the column will be lost.
  - Added the required column `family_id` to the `sessions` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `email` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- Enable citext extension for case-insensitive unique email addresses
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "user_agent",
ADD COLUMN     "device" VARCHAR(512),
ADD COLUMN     "family_id" UUID NOT NULL,
ADD COLUMN     "last_used_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" DROP COLUMN "email_verified",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "email_verified_at" TIMESTAMP(3),
ADD COLUMN     "provider" "AuthProvider" NOT NULL DEFAULT 'EMAIL',
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER',
DROP COLUMN "email",
ADD COLUMN     "email" CITEXT NOT NULL,
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "sessions_family_id_idx" ON "sessions"("family_id");

-- CreateIndex
CREATE INDEX "sessions_refresh_token_hash_idx" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");
