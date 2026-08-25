-- Keep a permanent operator snapshot so audit records remain attributable
-- even after the administrator account is deleted.
ALTER TABLE "AuditLog" ADD COLUMN "actorName" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "actorEmail" TEXT;

UPDATE "AuditLog"
SET
  "actorName" = (SELECT "name" FROM "User" WHERE "User"."id" = "AuditLog"."userId"),
  "actorEmail" = (SELECT "email" FROM "User" WHERE "User"."id" = "AuditLog"."userId")
WHERE "userId" IS NOT NULL;

CREATE TRIGGER "AuditLog_actor_snapshot_after_insert"
AFTER INSERT ON "AuditLog"
FOR EACH ROW
WHEN NEW."userId" IS NOT NULL AND NEW."actorName" IS NULL
BEGIN
  UPDATE "AuditLog"
  SET
    "actorName" = (SELECT "name" FROM "User" WHERE "User"."id" = NEW."userId"),
    "actorEmail" = (SELECT "email" FROM "User" WHERE "User"."id" = NEW."userId")
  WHERE "id" = NEW."id";
END;
