-- AlterTable
ALTER TABLE "WebsiteVisit" ADD COLUMN "city" TEXT;
ALTER TABLE "WebsiteVisit" ADD COLUMN "country" TEXT;
ALTER TABLE "WebsiteVisit" ADD COLUMN "countryCode" TEXT;
ALTER TABLE "WebsiteVisit" ADD COLUMN "geoSource" TEXT;
ALTER TABLE "WebsiteVisit" ADD COLUMN "ip" TEXT;
ALTER TABLE "WebsiteVisit" ADD COLUMN "region" TEXT;

-- CreateTable
CREATE TABLE "GeoIpCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ipHash" TEXT NOT NULL,
    "countryCode" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "source" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GeoIpCache_ipHash_key" ON "GeoIpCache"("ipHash");

-- CreateIndex
CREATE INDEX "GeoIpCache_expiresAt_idx" ON "GeoIpCache"("expiresAt");

-- CreateIndex
CREATE INDEX "WebsiteVisit_countryCode_createdAt_idx" ON "WebsiteVisit"("countryCode", "createdAt");
