import { PrismaClient } from "@prisma/client";
import { defaultPageSections, defaultPageSectionZh } from "../lib/page-defaults";

const db = new PrismaClient();

async function main() {
  const zh = await db.locale.findUnique({ where: { code: "zh" }, select: { id: true } });
  let created = 0;
  let completed = 0;

  for (const defaults of defaultPageSections) {
    const existing = await db.pageSection.findUnique({
      where: { page_key: { page: defaults.page, key: defaults.key } },
    });
    const section = existing
      ? await db.pageSection.update({
          where: { id: existing.id },
          data: {
            sortOrder: defaults.sortOrder,
            items: existing.items === "[]" ? defaults.items : existing.items,
          },
        })
      : await db.pageSection.create({
          data: {
            page: defaults.page,
            key: defaults.key,
            title: defaults.title,
            subtitle: defaults.subtitle,
            content: defaults.content,
            image: defaults.image,
            buttonLabel: defaults.buttonLabel,
            buttonHref: defaults.buttonHref,
            items: defaults.items,
            sortOrder: defaults.sortOrder,
            isVisible: true,
          },
        });

    if (!existing) created += 1;
    else if (existing.items === "[]" && defaults.items !== "[]") completed += 1;

    const localized = defaultPageSectionZh[`${defaults.page}:${defaults.key}`];
    if (!zh || !localized) continue;
    for (const [field, value] of Object.entries(localized)) {
      const translation = await db.translation.findUnique({
        where: {
          localeId_entityType_entityId_field: {
            localeId: zh.id,
            entityType: "PageSection",
            entityId: section.id,
            field,
          },
        },
        select: { id: true },
      });
      if (!translation) {
        await db.translation.create({
          data: {
            localeId: zh.id,
            entityType: "PageSection",
            entityId: section.id,
            field,
            value,
          },
        });
      }
    }
  }

  console.log(`Page content ready: ${created} sections created, ${completed} existing sections completed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
