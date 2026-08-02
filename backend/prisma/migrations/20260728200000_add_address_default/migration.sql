-- Persist the client's default address without changing existing address data.
ALTER TABLE "Address"
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- A client can have at most one default address.
CREATE UNIQUE INDEX "Address_one_default_per_user"
ON "Address" ("userId")
WHERE "isDefault" = true;
