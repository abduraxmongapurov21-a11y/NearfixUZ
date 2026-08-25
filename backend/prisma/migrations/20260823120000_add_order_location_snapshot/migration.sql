-- Persist the service location on the Order so later Address edits or deletion
-- cannot rewrite historical order data.
ALTER TABLE "Order"
ADD COLUMN "locationLabel" TEXT,
ADD COLUMN "locationAddressText" TEXT,
ADD COLUMN "locationDistrict" TEXT,
ADD COLUMN "locationLat" DECIMAL(10,7),
ADD COLUMN "locationLng" DECIMAL(10,7);

-- Preserve the current canonical Address values for Orders whose relation still
-- exists. Invalid or incomplete legacy coordinate pairs remain unknown.
UPDATE "Order" AS orders
SET
  "locationLabel" = addresses."label",
  "locationAddressText" = addresses."addressText",
  "locationDistrict" = addresses."district",
  "locationLat" = CASE
    WHEN addresses."lat" BETWEEN -90 AND 90
      AND addresses."lng" BETWEEN -180 AND 180
    THEN addresses."lat"
    ELSE NULL
  END,
  "locationLng" = CASE
    WHEN addresses."lat" BETWEEN -90 AND 90
      AND addresses."lng" BETWEEN -180 AND 180
    THEN addresses."lng"
    ELSE NULL
  END
FROM "Address" AS addresses
WHERE orders."addressId" = addresses."id";

ALTER TABLE "Order"
ADD CONSTRAINT "Order_location_pair_check"
CHECK (("locationLat" IS NULL) = ("locationLng" IS NULL)),
ADD CONSTRAINT "Order_location_lat_range_check"
CHECK ("locationLat" IS NULL OR "locationLat" BETWEEN -90 AND 90),
ADD CONSTRAINT "Order_location_lng_range_check"
CHECK ("locationLng" IS NULL OR "locationLng" BETWEEN -180 AND 180);
