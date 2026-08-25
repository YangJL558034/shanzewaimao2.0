import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

const smtpKeys = [
  "smtp_host",
  "smtp_port",
  "smtp_secure",
  "smtp_user",
  "smtp_password",
  "smtp_from",
  "inquiry_notify_to",
] as const;

function encryptionKey() {
  return createHash("sha256")
    .update(process.env.APP_SECRET || "local-development-smtp-secret")
    .digest();
}

export function encryptSmtpPassword(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptSmtpPassword(value: string) {
  if (!value.startsWith("enc:v1:")) return value;
  try {
    const [, , ivValue, tagValue, encryptedValue] = value.split(":");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  notifyTo: string;
};

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const settings = await db.setting.findMany({
    where: { key: { in: [...smtpKeys] } },
  });
  const values = Object.fromEntries(settings.map((item) => [item.key, item.value]));
  return {
    host: values.smtp_host || process.env.SMTP_HOST || "",
    port: Number(values.smtp_port || process.env.SMTP_PORT || 587),
    secure: (values.smtp_secure || process.env.SMTP_SECURE || "false") === "true",
    user: values.smtp_user || process.env.SMTP_USER || "",
    password: decryptSmtpPassword(values.smtp_password || process.env.SMTP_PASSWORD || ""),
    from: values.smtp_from || process.env.SMTP_FROM || "ENERCORE Website <website@enercore.com>",
    notifyTo: values.inquiry_notify_to || process.env.INQUIRY_NOTIFY_TO || "sales@enercore.com",
  };
}

export async function saveSmtpConfig(input: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  from: string;
  notifyTo: string;
}) {
  const entries: Array<[string, string, string]> = [
    ["smtp_host", input.host, "text"],
    ["smtp_port", String(input.port), "number"],
    ["smtp_secure", String(input.secure), "boolean"],
    ["smtp_user", input.user, "text"],
    ["smtp_from", input.from, "text"],
    ["inquiry_notify_to", input.notifyTo, "email"],
  ];
  if (input.password) entries.push(["smtp_password", encryptSmtpPassword(input.password), "secret"]);
  await db.$transaction(
    entries.map(([key, value, type]) =>
      db.setting.upsert({
        where: { key },
        update: { value, type, group: "smtp", isPublic: false },
        create: { key, value, type, group: "smtp", isPublic: false },
      }),
    ),
  );
}
