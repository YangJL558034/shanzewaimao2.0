import "server-only";
import { db } from "@/lib/db";
import { getSmtpConfig } from "@/lib/smtp-settings";

const keys = ["customer_whatsapp_number", "customer_linkedin_url", "customer_support_email", "customer_catalog_url", "customer_welcome_message"] as const;
export type CustomerChannelConfig = { whatsappNumber: string; linkedinUrl: string; supportEmail: string; catalogUrl: string; welcomeMessage: string };
export type CustomerNotificationConfig = { adminNotificationEmail: string; salesNotificationEmails: string };

export async function getCustomerNotificationConfig(): Promise<CustomerNotificationConfig> {
  const [rows, smtp, channels] = await Promise.all([
    db.setting.findMany({ where: { key: { in: ["customer_admin_notification_email", "customer_sales_notification_emails"] } } }),
    getSmtpConfig(), getCustomerChannelConfig(),
  ]);
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { adminNotificationEmail: values.customer_admin_notification_email || smtp.notifyTo, salesNotificationEmails: values.customer_sales_notification_emails || channels.supportEmail };
}

export async function saveCustomerNotificationConfig(input: CustomerNotificationConfig) {
  await db.$transaction([
    ["customer_admin_notification_email", input.adminNotificationEmail],
    ["customer_sales_notification_emails", input.salesNotificationEmails],
  ].map(([key, value]) => db.setting.upsert({ where: { key }, update: { value, group: "customer_service", isPublic: false }, create: { key, value, group: "customer_service", isPublic: false } })));
}

export async function getCustomerChannelConfig(): Promise<CustomerChannelConfig> {
  const rows = await db.setting.findMany({ where: { key: { in: [...keys] } } });
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { whatsappNumber: values.customer_whatsapp_number || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "", linkedinUrl: values.customer_linkedin_url || process.env.NEXT_PUBLIC_LINKEDIN_URL || "", supportEmail: values.customer_support_email || process.env.NEXT_PUBLIC_SALES_EMAIL || "sales@shanzesz.com", catalogUrl: values.customer_catalog_url || process.env.NEXT_PUBLIC_CATALOG_URL || "/contact#quote", welcomeMessage: values.customer_welcome_message || "Hi 👋\nWelcome to Shanze.\n\nAre you looking for:\n1. Power Bank OEM\n2. Magnetic Power Bank\n3. Wireless Charger\n4. Custom Solution\n\nHow can we help you?" };
}

export async function saveCustomerChannelConfig(input: CustomerChannelConfig) {
  const entries: Array<[string, string, string]> = [["customer_whatsapp_number", input.whatsappNumber, "text"], ["customer_linkedin_url", input.linkedinUrl, "url"], ["customer_support_email", input.supportEmail, "email"], ["customer_catalog_url", input.catalogUrl, "url"], ["customer_welcome_message", input.welcomeMessage, "textarea"]];
  await db.$transaction(entries.map(([key, value, type]) => db.setting.upsert({ where: { key }, update: { value, type, group: "customer_service", isPublic: true }, create: { key, value, type, group: "customer_service", isPublic: true } })));
}
