-- AlterTable
ALTER TABLE "InquiryNote" ADD COLUMN "result" TEXT;
ALTER TABLE "InquiryNote" ADD COLUMN "statusAfter" TEXT;

-- CreateTable
CREATE TABLE "InquiryAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inquiryId" TEXT NOT NULL,
    "fromAssigneeId" TEXT,
    "toAssigneeId" TEXT,
    "assignedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InquiryAssignment_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InquiryAssignment_fromAssigneeId_fkey" FOREIGN KEY ("fromAssigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InquiryAssignment_toAssigneeId_fkey" FOREIGN KEY ("toAssigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InquiryAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebsiteVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitorHash" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "device" TEXT NOT NULL DEFAULT 'desktop',
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "InquiryAssignment_inquiryId_createdAt_idx" ON "InquiryAssignment"("inquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "InquiryAssignment_toAssigneeId_createdAt_idx" ON "InquiryAssignment"("toAssigneeId", "createdAt");

-- CreateIndex
CREATE INDEX "WebsiteVisit_createdAt_idx" ON "WebsiteVisit"("createdAt");

-- CreateIndex
CREATE INDEX "WebsiteVisit_visitorHash_createdAt_idx" ON "WebsiteVisit"("visitorHash", "createdAt");

-- CreateIndex
CREATE INDEX "WebsiteVisit_path_createdAt_idx" ON "WebsiteVisit"("path", "createdAt");

-- CreateIndex
CREATE INDEX "InquiryNote_inquiryId_createdAt_idx" ON "InquiryNote"("inquiryId", "createdAt");
