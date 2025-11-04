-- AlterTable
ALTER TABLE "public"."podcasts" DROP COLUMN "mediaType",
DROP COLUMN "videoUrl",
ALTER COLUMN "audioUrl" SET NOT NULL;

