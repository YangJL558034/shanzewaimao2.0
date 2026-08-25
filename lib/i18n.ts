import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export async function getLocale() {
  const requested = (await cookies()).get("locale")?.value || "en";
  const locale = await db.locale.findUnique({ where: { code: requested } }).catch(() => null);
  return locale?.isActive ? locale.code : "en";
}

export async function translateEntity<T extends Record<string, unknown>>(entityType: string, entity: T, fields: string[], locale: string) {
  if (locale === "en" || !entity.id) return entity;
  const translations = await db.translation.findMany({ where: { entityType, entityId: String(entity.id), locale: { code: locale } } });
  const result = { ...entity };
  for (const t of translations) if (fields.includes(t.field)) (result as Record<string, unknown>)[t.field] = t.value;
  return result;
}

export async function translateEntities<T extends Record<string, unknown>>(
  entityType: string,
  entities: T[],
  fields: string[],
  locale: string,
) {
  return Promise.all(
    entities.map((entity) =>
      translateEntity(entityType, entity, fields, locale),
    ),
  );
}
