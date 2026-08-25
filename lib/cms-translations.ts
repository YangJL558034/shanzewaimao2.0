import { db } from "@/lib/db";
import type { CmsSection } from "@/lib/cms";
import { translationEntityType } from "@/lib/cms";

export type InlineTranslations = Record<string, Record<string, unknown>>;

type TranslationSyncContext = {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

const localizedItemFields = ["title", "text", "value", "label"] as const;

function parseContentItems(value: unknown): Record<string, unknown>[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item === "object") as Record<string, unknown>[]
      : [];
  } catch {
    return [];
  }
}

function normalizedJson(value: unknown) {
  try {
    return JSON.stringify(typeof value === "string" ? JSON.parse(value) : value);
  } catch {
    return String(value ?? "").trim();
  }
}

function normalizedContentItems(value: unknown) {
  return JSON.stringify(parseContentItems(value).map((item) => ({
    title: String(item.title ?? ""),
    text: String(item.text ?? ""),
    value: String(item.value ?? ""),
    image: String(item.image ?? ""),
    label: String(item.label ?? ""),
    href: String(item.href ?? ""),
  })));
}

function mergeContentItemStructure(previousBase: unknown, nextBase: unknown, localizedValue: unknown) {
  const previousItems = parseContentItems(previousBase);
  const nextItems = parseContentItems(nextBase);
  const localizedItems = parseContentItems(localizedValue);

  return nextItems.map((nextItem, index) => {
    const previousItem = previousItems[index] || {};
    const localizedItem = localizedItems[index] || {};
    const merged: Record<string, unknown> = { ...nextItem };

    for (const field of localizedItemFields) {
      const previous = String(previousItem[field] ?? "");
      const localized = String(localizedItem[field] ?? "");
      const next = String(nextItem[field] ?? "");
      merged[field] = !localized || localized === previous ? next : localized;
    }

    // Media and destinations are shared business data, not translated copy.
    merged.image = String(nextItem.image ?? "");
    merged.href = String(nextItem.href ?? "");
    return merged;
  });
}

export async function attachInlineTranslations(
  section: CmsSection,
  records: Record<string, unknown>[],
) {
  const fields = section.fields.filter((field) => field.translatable);
  if (!fields.length || !records.length) return records;
  const ids = records.map((record) => String(record.id));
  const translations = await db.translation.findMany({
    where: {
      entityType: translationEntityType(section.model),
      entityId: { in: ids },
      field: { in: fields.map((field) => field.key) },
    },
    include: { locale: { select: { code: true } } },
  });
  const byEntity: Record<string, Record<string, Record<string, string>>> = {};
  for (const translation of translations) {
    byEntity[translation.entityId] ??= {};
    byEntity[translation.entityId][translation.locale.code] ??= {};
    byEntity[translation.entityId][translation.locale.code][translation.field] =
      translation.value;
  }
  return records.map((record) => ({
    ...record,
    _translations: byEntity[String(record.id)] || {},
  }));
}

export async function saveInlineTranslations(
  section: CmsSection,
  entityId: string,
  input: unknown,
  context: TranslationSyncContext = {},
) {
  if (!input || typeof input !== "object") return;
  const translations = input as InlineTranslations;
  const allowed = new Set(
    section.fields
      .filter((field) => field.translatable)
      .map((field) => field.key),
  );
  if (!allowed.size) return;
  const locales = await db.locale.findMany({
    where: { code: { in: Object.keys(translations) }, isActive: true },
    select: { id: true, code: true },
  });
  const entityType = translationEntityType(section.model);
  const currentTranslations = await db.translation.findMany({
    where: {
      entityType,
      entityId,
      localeId: { in: locales.map((locale) => locale.id) },
      field: { in: [...allowed] },
    },
  });
  const currentByKey = new Map(
    currentTranslations.map((translation) => [
      `${translation.localeId}:${translation.field}`,
      translation.value,
    ]),
  );
  const operations = [];
  for (const locale of locales) {
    const values = translations[locale.code] || {};
    for (const [field, rawValue] of Object.entries(values)) {
      if (!allowed.has(field)) continue;
      const definition = section.fields.find((item) => item.key === field);
      const existingValue = currentByKey.get(`${locale.id}:${field}`) || "";
      let value = rawValue == null ? "" : String(rawValue).trim();
      if (definition?.jsonKind === "contentItems" && normalizedJson(value) === normalizedJson([])) value = "";
      const normalize = definition?.jsonKind === "contentItems" ? normalizedContentItems : normalizedJson;
      const baseChanged = context.before && context.after
        ? normalize(context.before[field]) !== normalize(context.after[field])
        : false;
      const translationWasUntouched = normalize(value) === normalize(existingValue);
      if (definition?.jsonKind === "contentItems" && baseChanged && translationWasUntouched && existingValue) {
        value = JSON.stringify(mergeContentItemStructure(context.before?.[field], context.after?.[field], existingValue));
      }
      const where = {
        localeId_entityType_entityId_field: {
          localeId: locale.id,
          entityType,
          entityId,
          field,
        },
      };
      operations.push(
        value
          ? db.translation.upsert({
              where,
              create: {
                localeId: locale.id,
                entityType,
                entityId,
                field,
                value,
              },
              update: { value },
            })
          : db.translation.deleteMany({
              where: { localeId: locale.id, entityType, entityId, field },
            }),
      );
    }
  }
  if (operations.length) await db.$transaction(operations);
}
