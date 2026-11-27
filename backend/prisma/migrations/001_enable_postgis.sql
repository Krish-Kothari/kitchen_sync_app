CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "Kitchen"
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326);

ALTER TABLE "OrderPool"
  ADD COLUMN IF NOT EXISTS center_location geography(Point, 4326);

UPDATE "Kitchen"
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE location IS NULL;

UPDATE "OrderPool"
SET center_location = ST_SetSRID(ST_MakePoint("centerLongitude", "centerLatitude"), 4326)::geography
WHERE center_location IS NULL;

CREATE INDEX IF NOT EXISTS idx_kitchen_location_gist
  ON "Kitchen" USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_order_pool_center_gist
  ON "OrderPool" USING GIST (center_location);

CREATE OR REPLACE FUNCTION sync_kitchen_geography()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_kitchen_geography ON "Kitchen";
CREATE TRIGGER trg_sync_kitchen_geography
BEFORE INSERT OR UPDATE OF latitude, longitude ON "Kitchen"
FOR EACH ROW EXECUTE FUNCTION sync_kitchen_geography();

CREATE OR REPLACE FUNCTION sync_pool_geography()
RETURNS TRIGGER AS $$
BEGIN
  NEW.center_location := ST_SetSRID(ST_MakePoint(NEW."centerLongitude", NEW."centerLatitude"), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_pool_geography ON "OrderPool";
CREATE TRIGGER trg_sync_pool_geography
BEFORE INSERT OR UPDATE OF "centerLatitude", "centerLongitude" ON "OrderPool"
FOR EACH ROW EXECUTE FUNCTION sync_pool_geography();
