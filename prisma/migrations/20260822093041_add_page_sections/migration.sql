-- CreateTable
CREATE TABLE "PageSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "page" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "content" TEXT,
    "image" TEXT,
    "buttonLabel" TEXT,
    "buttonHref" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PageSection_page_sortOrder_idx" ON "PageSection"("page", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PageSection_page_key_key" ON "PageSection"("page", "key");
