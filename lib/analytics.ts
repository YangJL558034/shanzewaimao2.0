import "server-only";

import { db } from "@/lib/db";

export type AnalyticsPoint = {
  key: string;
  label: string;
  views: number;
  visitors: number;
  subscribers: number;
  inquiries: number;
};

export type DashboardAnalyticsData = {
  daily: AnalyticsPoint[];
  monthly: AnalyticsPoint[];
  yearly: AnalyticsPoint[];
  summary: {
    todayViews: number;
    todayVisitors: number;
    monthViews: number;
    monthVisitors: number;
    yearViews: number;
    yearVisitors: number;
    totalSubscribers: number;
    activeSubscribers: number;
    monthSubscribers: number;
    yearSubscribers: number;
  };
};

type VisitRow = { period: string; views: bigint | number; visitors: bigint | number };
type CountRow = { period: string; total: bigint | number };

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatExpression(granularity: "day" | "month" | "year") {
  if (granularity === "day") return "%Y-%m-%d";
  if (granularity === "month") return "%Y-%m";
  return "%Y";
}

async function visitSeries(granularity: "day" | "month" | "year", start: Date) {
  const format = formatExpression(granularity);
  return db.$queryRawUnsafe<VisitRow[]>(
    `SELECT strftime('${format}', createdAt / 1000, 'unixepoch', 'localtime') AS period,
            COUNT(*) AS views,
            COUNT(DISTINCT visitorHash) AS visitors
       FROM WebsiteVisit
      WHERE createdAt >= ${start.getTime()}
      GROUP BY period
      ORDER BY period ASC`,
  );
}

async function countSeries(table: "NewsletterSubscriber" | "Inquiry", granularity: "day" | "month" | "year", start: Date) {
  const format = formatExpression(granularity);
  return db.$queryRawUnsafe<CountRow[]>(
    `SELECT strftime('${format}', createdAt / 1000, 'unixepoch', 'localtime') AS period,
            COUNT(*) AS total
       FROM ${table}
      WHERE createdAt >= ${start.getTime()}
      GROUP BY period
      ORDER BY period ASC`,
  );
}

function mapVisits(rows: VisitRow[]) {
  return new Map(rows.map((row) => [row.period, { views: Number(row.views), visitors: Number(row.visitors) }]));
}

function mapCounts(rows: CountRow[]) {
  return new Map(rows.map((row) => [row.period, Number(row.total)]));
}

function buildPoints(
  keys: { key: string; label: string }[],
  visits: VisitRow[],
  subscribers: CountRow[],
  inquiries: CountRow[],
): AnalyticsPoint[] {
  const visitMap = mapVisits(visits);
  const subscriberMap = mapCounts(subscribers);
  const inquiryMap = mapCounts(inquiries);
  return keys.map(({ key, label }) => ({
    key,
    label,
    views: visitMap.get(key)?.views || 0,
    visitors: visitMap.get(key)?.visitors || 0,
    subscribers: subscriberMap.get(key) || 0,
    inquiries: inquiryMap.get(key) || 0,
  }));
}

export async function getDashboardAnalytics(): Promise<DashboardAnalyticsData> {
  const now = new Date();
  const dailyStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
  const monthlyStart = new Date(now.getFullYear(), 0, 1);
  const yearlyStart = new Date(now.getFullYear() - 4, 0, 1);

  const dailyKeys = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(dailyStart.getFullYear(), dailyStart.getMonth(), dailyStart.getDate() + index);
    return { key: dayKey(date), label: `${pad(date.getMonth() + 1)}-${pad(date.getDate())}` };
  });
  const monthlyKeys = Array.from({ length: now.getMonth() + 1 }, (_, index) => {
    const date = new Date(now.getFullYear(), index, 1);
    return { key: monthKey(date), label: `${index + 1}月` };
  });
  const yearlyKeys = Array.from({ length: 5 }, (_, index) => {
    const year = yearlyStart.getFullYear() + index;
    return { key: String(year), label: `${year}年` };
  });

  const [
    dayVisits,
    monthVisits,
    yearVisits,
    daySubscribers,
    monthSubscribers,
    yearSubscribers,
    dayInquiries,
    monthInquiries,
    yearInquiries,
    totalSubscribers,
    activeSubscribers,
  ] = await Promise.all([
    visitSeries("day", dailyStart),
    visitSeries("month", monthlyStart),
    visitSeries("year", yearlyStart),
    countSeries("NewsletterSubscriber", "day", dailyStart),
    countSeries("NewsletterSubscriber", "month", monthlyStart),
    countSeries("NewsletterSubscriber", "year", yearlyStart),
    countSeries("Inquiry", "day", dailyStart),
    countSeries("Inquiry", "month", monthlyStart),
    countSeries("Inquiry", "year", yearlyStart),
    db.newsletterSubscriber.count(),
    db.newsletterSubscriber.count({ where: { isActive: true } }),
  ]);

  const daily = buildPoints(dailyKeys, dayVisits, daySubscribers, dayInquiries);
  const monthly = buildPoints(monthlyKeys, monthVisits, monthSubscribers, monthInquiries);
  const yearly = buildPoints(yearlyKeys, yearVisits, yearSubscribers, yearInquiries);
  const today = daily.at(-1)!;
  const month = monthly.at(-1)!;
  const year = yearly.at(-1)!;

  return {
    daily,
    monthly,
    yearly,
    summary: {
      todayViews: today.views,
      todayVisitors: today.visitors,
      monthViews: month.views,
      monthVisitors: month.visitors,
      yearViews: year.views,
      yearVisitors: year.visitors,
      totalSubscribers,
      activeSubscribers,
      monthSubscribers: month.subscribers,
      yearSubscribers: year.subscribers,
    },
  };
}
