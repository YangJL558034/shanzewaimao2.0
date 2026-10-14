import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

// Read-only verification after the PDF-backed company content is imported.
// Source: supplied 2026 Shanze company profile, pages 2–5, 7, 25–26.
const base = new URL(process.env.COMPANY_CHECK_BASE_URL || "http://localhost:3000");
const db = new PrismaClient();
const expectedYears = ["1999", "2003", "2014", "2022"];
const targetKeys = new Set(["home:about", "home:stats", "about:story", "about:stats", "about:purpose", "about:global", "factory:overview", "factory:stats"]);
const oldClaims = /20,000\+?|1,000,000\+?|100\s*万|300\+|100\+\s*(?:countries|country|国家|出口国)|(?:over|超过|遍及)\s*100\s*(?:countries|个国家)|12(?:\+|年以上)|(?:^|[^\d])2012(?:[^\d]|$)/i;
const pass = [];
function assertNoOldClaims(text, label) {
  assert.ok(!oldClaims.test(text), `${label}: obsolete seed facts must not remain`);
}
function items(value) {
  const parsed = JSON.parse(value || "[]");
  assert.ok(Array.isArray(parsed), "Company section items must be an array");
  return parsed;
}
function flatCopy(row) {
  return [row.title, row.subtitle, row.content, row.items].filter(Boolean).join(" ");
}
function visibleText(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
}

try {
  const sections = await db.pageSection.findMany({ where: { page: { in: ["home", "about", "factory"] } } });
  const targets = sections.filter((row) => targetKeys.has(`${row.page}:${row.key}`));
  assert.equal(targets.length, targetKeys.size, "All company content positions must exist");
  const translations = await db.translation.findMany({ where: { entityType: "PageSection", entityId: { in: targets.map((row) => row.id) }, locale: { code: "zh" } } });
  const maps = new Map(targets.map((row) => [`${row.page}:${row.key}`, row]));
  const localized = new Map(targets.map((row) => [`${row.page}:${row.key}`, { ...row, ...Object.fromEntries(translations.filter((translation) => translation.entityId === row.id).map((translation) => [translation.field, translation.value])) }]));

  for (const locale of ["en", "zh"]) {
    const map = locale === "zh" ? localized : maps;
    for (const [key, row] of map) assertNoOldClaims(flatCopy(row), `${locale} ${key}`);
    const timeline = items(map.get("about:story").items);
    assert.deepEqual(timeline.map((item) => String(item.value || "").match(/\d{4}/)?.[0]), expectedYears, `${locale}: exact chronological milestones`);
    assert.ok(timeline.every((item) => item.title && item.text), `${locale}: every milestone has a title and explanation`);
    assert.ok(flatCopy(map.get("about:story")).includes("BarryT"), `${locale}: 2022 brand milestone`);
    const statItems = ["home:stats", "about:stats", "factory:stats"].map((key) => items(map.get(key).items));
    for (const stat of statItems) assert.ok(stat.length > 0 && JSON.stringify(stat).includes("27"), `${locale}: 27-year expertise from dated source`);
    assert.deepEqual(statItems[0], statItems[1], `${locale}: homepage and about company facts consistent`);
    assert.deepEqual(statItems[1], statItems[2], `${locale}: about and factory company facts consistent`);
    for (const key of ["home:about", "factory:overview", "about:global"]) assert.ok(locale === "zh" ? flatCopy(map.get(key)).includes("东莞") : /Dongguan/i.test(flatCopy(map.get(key))), `${locale} ${key}: Dongguan manufacturing base`);
  }
  pass.push("PASS EN/ZH CMS: 1999/2003/2014/2022 timeline, milestone details, BarryT, consistent source facts and Dongguan base");

  const settings = await db.setting.findMany({ where: { isPublic: true, key: { in: ["founded", "factory_area", "monthly_output", "export_countries"] } }, select: { key: true, value: true } });
  for (const setting of settings) {
    assertNoOldClaims(setting.value, `Public setting ${setting.key}`);
    if (setting.key === "export_countries") assert.ok(!/^100\+?$/.test(setting.value.trim()), "Old country count must not persist in a public setting");
  }
  const aboutDocument = await db.page.findUnique({ where: { slug: "about" } });
  if (aboutDocument) assertNoOldClaims(aboutDocument.content, "Legacy CMS Page/about content");
  pass.push("PASS public company settings and legacy About document: no old seed numbers");

  for (const locale of ["en", "zh"]) {
    for (const route of ["/", "/about", "/factory"]) {
      const response = await fetch(new URL(route, base), { headers: { "User-Agent": "Googlebot", Cookie: `locale=${locale}` }, signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200, `${locale} ${route}`);
      const html = await response.text();
      const text = visibleText(html);
      assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${locale} ${route}: one H1`);
      assertNoOldClaims(text, `${locale} ${route} visible page`);
      assert.ok(locale === "zh" ? text.includes("东莞") : /Dongguan/i.test(text), `${locale} ${route}: sourced manufacturing location visible`);
      if (route === "/about") {
        for (const year of expectedYears) assert.ok(text.includes(year), `${locale} /about renders milestone ${year}`);
        const timeline = items((locale === "zh" ? localized : maps).get("about:story").items);
        for (const milestone of timeline) {
          assert.ok(text.includes(String(milestone.title).replace(/\s+/g, " ")), `${locale}: milestone title rendered`);
          assert.ok(text.includes(String(milestone.text).replace(/\s+/g, " ")), `${locale}: milestone explanation rendered`);
        }
      }
    }
  }
  pass.push("PASS six EN/ZH public page renders: history details visible, Dongguan base, one H1 and no old unsupported numbers");

  const defaults = await readFile("lib/page-defaults.ts", "utf8");
  const seed = await readFile("prisma/seed.ts", "utf8");
  const statComponent = await readFile("components/public/StatGrid.tsx", "utf8");
  assertNoOldClaims(defaults, "PageSection EN/ZH defaults");
  assertNoOldClaims(statComponent, "StatGrid fallback");
  // Limit the seed check to founding/history; product capacities and customer contacts are out of scope.
  assert.ok(!/Since 2012|自\s*2012|['"]founded['"]\s*,\s*['"]2012['"]/.test(seed), "Seed must not restore old founding/history dates");
  pass.push("PASS code defaults: future PageSection/translation/stat fallback initialization does not restore old facts");
  console.log(pass.join("\n"));
} finally {
  await db.$disconnect();
}
