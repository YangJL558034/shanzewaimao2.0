import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/security";

const schema = z.object({
  enabled: z.boolean(),
  intervalHours: z.number().int().min(1).max(168),
});

export async function GET() {
  const auth = await requireApiUser("settings.read");
  if ("error" in auth) return auth.error;
  const settings = await db.setting.findMany({
    where: {
      key: {
        in: ["backup_enabled", "backup_interval_hours", "backup_last_run"],
      },
    },
  });
  const map = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  return NextResponse.json({
    data: {
      enabled: map.backup_enabled !== "false",
      intervalHours: Number(map.backup_interval_hours) || 24,
      lastRun: map.backup_last_run || null,
      retention: 5,
    },
  });
}

export async function PUT(request: Request) {
  const auth = await requireApiUser("settings.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const input = schema.parse(await request.json());
  await db.$transaction([
    db.setting.upsert({
      where: { key: "backup_enabled" },
      update: { value: String(input.enabled) },
      create: {
        group: "backup",
        key: "backup_enabled",
        value: String(input.enabled),
        type: "boolean",
        isPublic: false,
      },
    }),
    db.setting.upsert({
      where: { key: "backup_interval_hours" },
      update: { value: String(input.intervalHours) },
      create: {
        group: "backup",
        key: "backup_interval_hours",
        value: String(input.intervalHours),
        type: "number",
        isPublic: false,
      },
    }),
    db.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "UPDATE_BACKUP_SCHEDULE",
        entityType: "settings",
        afterJson: JSON.stringify(input),
      },
    }),
  ]);
  return NextResponse.json({ data: { ...input, retention: 5 } });
}
