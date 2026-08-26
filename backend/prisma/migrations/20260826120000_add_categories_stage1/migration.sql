-- Stage 1 is intentionally additive. Legacy profession/professions/serviceType
-- values remain untouched for released-client compatibility and history.

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "nameUz" TEXT NOT NULL,
  "nameRu" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "iconKey" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkerCategory" (
  "workerId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkerCategory_pkey" PRIMARY KEY ("workerId", "categoryId")
);

ALTER TABLE "Order" ADD COLUMN "categoryId" TEXT;

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_isActive_sortOrder_idx" ON "Category"("isActive", "sortOrder");
CREATE INDEX "Category_sortOrder_idx" ON "Category"("sortOrder");
CREATE INDEX "WorkerCategory_categoryId_idx" ON "WorkerCategory"("categoryId");
CREATE INDEX "WorkerCategory_workerId_sortOrder_idx" ON "WorkerCategory"("workerId", "sortOrder");
CREATE INDEX "Order_categoryId_idx" ON "Order"("categoryId");

ALTER TABLE "WorkerCategory"
ADD CONSTRAINT "WorkerCategory_workerId_fkey"
FOREIGN KEY ("workerId") REFERENCES "WorkerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkerCategory"
ADD CONSTRAINT "WorkerCategory_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Category" ("id", "slug", "nameUz", "nameRu", "nameEn", "iconKey", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('cat_plumbing', 'plumbing', 'Santexnik', 'Сантехник', 'Plumber', 'wrench', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_electric', 'electric', 'Elektrik', 'Электрик', 'Electrician', 'zap', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_welding', 'welding', 'Payvandchi', 'Сварщик', 'Welder', 'flame', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_repair', 'repair', 'Usta', 'Мастер', 'Handyman', 'hammer', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_ac', 'ac', 'Konditsioner', 'Кондиционеры', 'Air conditioning', 'snowflake', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_renovation', 'renovation', 'Ta''mirlash', 'Ремонт', 'Renovation', 'paint', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cat_cleaning', 'cleaning', 'Tozalash', 'Уборка', 'Cleaning', 'sparkles', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Only exact, case-insensitive matches to the released standard UZ names or
-- stable slugs are backfilled. Unknown/free-form values remain only in legacy fields.
WITH standard_values(value, category_id) AS (
  VALUES
    ('santexnik', 'cat_plumbing'), ('plumbing', 'cat_plumbing'),
    ('elektrik', 'cat_electric'), ('electric', 'cat_electric'),
    ('payvandchi', 'cat_welding'), ('welding', 'cat_welding'),
    ('usta', 'cat_repair'), ('repair', 'cat_repair'),
    ('konditsioner', 'cat_ac'), ('ac', 'cat_ac'),
    ('ta''mirlash', 'cat_renovation'), ('renovation', 'cat_renovation'),
    ('tozalash', 'cat_cleaning'), ('cleaning', 'cat_cleaning')
), worker_values AS (
  SELECT wp."id" AS worker_id, wp."profession" AS value, 0 AS position, true AS is_primary
  FROM "WorkerProfile" wp
  WHERE wp."profession" IS NOT NULL
  UNION ALL
  SELECT wp."id", item.value, item.position::integer, false
  FROM "WorkerProfile" wp
  CROSS JOIN LATERAL unnest(wp."professions") WITH ORDINALITY AS item(value, position)
), matched AS (
  SELECT DISTINCT ON (wv.worker_id, sv.category_id)
    wv.worker_id,
    sv.category_id,
    wv.position,
    wv.is_primary
  FROM worker_values wv
  JOIN standard_values sv ON lower(btrim(wv.value)) = sv.value
  ORDER BY wv.worker_id, sv.category_id, wv.is_primary DESC, wv.position ASC
)
INSERT INTO "WorkerCategory" ("workerId", "categoryId", "sortOrder", "isPrimary", "createdAt")
SELECT worker_id, category_id, position, is_primary, CURRENT_TIMESTAMP
FROM matched
ON CONFLICT ("workerId", "categoryId") DO NOTHING;

WITH standard_values(value, category_id) AS (
  VALUES
    ('santexnik', 'cat_plumbing'), ('plumbing', 'cat_plumbing'),
    ('elektrik', 'cat_electric'), ('electric', 'cat_electric'),
    ('payvandchi', 'cat_welding'), ('welding', 'cat_welding'),
    ('usta', 'cat_repair'), ('repair', 'cat_repair'),
    ('konditsioner', 'cat_ac'), ('ac', 'cat_ac'),
    ('ta''mirlash', 'cat_renovation'), ('renovation', 'cat_renovation'),
    ('tozalash', 'cat_cleaning'), ('cleaning', 'cat_cleaning')
)
UPDATE "Order" o
SET "categoryId" = sv.category_id
FROM standard_values sv
WHERE lower(btrim(o."serviceType")) = sv.value
  AND o."categoryId" IS NULL;
