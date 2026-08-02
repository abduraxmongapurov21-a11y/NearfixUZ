-- Add nullable service-location fields without rewriting or invalidating existing worker rows.
ALTER TABLE "WorkerProfile"
ADD COLUMN "serviceLat" DECIMAL(10,7),
ADD COLUMN "serviceLng" DECIMAL(10,7),
ADD COLUMN "serviceLocationUpdatedAt" TIMESTAMP(3);

-- A service location is valid only when both coordinates are present and in range.
ALTER TABLE "WorkerProfile"
ADD CONSTRAINT "WorkerProfile_service_location_pair_check"
CHECK (
  ("serviceLat" IS NULL AND "serviceLng" IS NULL)
  OR
  ("serviceLat" IS NOT NULL AND "serviceLng" IS NOT NULL)
),
ADD CONSTRAINT "WorkerProfile_service_lat_range_check"
CHECK ("serviceLat" IS NULL OR "serviceLat" BETWEEN -90 AND 90),
ADD CONSTRAINT "WorkerProfile_service_lng_range_check"
CHECK ("serviceLng" IS NULL OR "serviceLng" BETWEEN -180 AND 180);
