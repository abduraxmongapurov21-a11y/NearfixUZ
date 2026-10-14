CREATE TYPE "BannerPlacement" AS ENUM ('HOME', 'CATEGORY');
CREATE TYPE "BannerMediaType" AS ENUM ('IMAGE', 'VIDEO');

ALTER TABLE "Banner"
  ADD COLUMN "placement" "BannerPlacement" NOT NULL DEFAULT 'HOME',
  ADD COLUMN "mediaType" "BannerMediaType" NOT NULL DEFAULT 'IMAGE';

CREATE INDEX "Banner_placement_isActive_sortOrder_idx" ON "Banner"("placement", "isActive", "sortOrder");
