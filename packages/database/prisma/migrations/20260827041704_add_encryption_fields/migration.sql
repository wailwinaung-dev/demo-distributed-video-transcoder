-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "aesIv" TEXT,
ADD COLUMN     "aesKey" TEXT,
ADD COLUMN     "isEncrypted" BOOLEAN NOT NULL DEFAULT true;
