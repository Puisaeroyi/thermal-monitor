-- AlterTable
ALTER TABLE "cameras" ADD COLUMN     "password" TEXT,
ADD COLUMN     "port" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "username" TEXT;
