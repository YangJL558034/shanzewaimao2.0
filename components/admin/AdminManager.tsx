"use client";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ArchiveRestore,
  Boxes,
  CalendarDays,
  CircleCheck,
  CircleDashed,
  Copy,
  Download,
  Edit3,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type { CmsField, CmsSection } from "@/lib/cms";
import { getFreshCsrfToken } from "@/lib/csrf-client";
import { getVideoEmbedUrl, isSupportedVisualMedia, visualMediaKind } from "@/lib/media-url";

type RecordItem = Record<string, unknown> & { id: string };
type RelationItem = {
  id: string;
  name: string;
  code?: string;
  path?: string;
  mimeType?: string;
  alt?: string | null;
};
type AdminPresentation = "table" | "home-banners" | "home-sections" | "page-banners" | "page-sections";

function AdminModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

function contentItemsWithCurrentMedia(formData: FormData, fieldName: string, rawValue: FormDataEntryValue | null) {
  try {
    const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : [];
    if (!Array.isArray(parsed)) return rawValue || "[]";
    return JSON.stringify(parsed.map((item, index) => {
      const current = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const mediaValue = formData.get(`${fieldName}__image_${index}`);
      return {
        ...current,
        image: typeof mediaValue === "string" ? mediaValue : String(current.image || ""),
      };
    }));
  } catch {
    return rawValue || "[]";
  }
}

function VisualMediaPreview({ source, mimeType, alt = "媒体预览", compact = false }: { source: string; mimeType?: string; alt?: string; compact?: boolean }) {
  const kind = visualMediaKind(source, mimeType);
  if (kind === "video") return <video className={compact ? "visual-preview compact" : "visual-preview"} src={source} muted controls={!compact} playsInline preload="metadata" />;
  if (kind === "embed") return <iframe className={compact ? "visual-preview compact" : "visual-preview"} src={getVideoEmbedUrl(source) || undefined} title={alt} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />;
  if (kind === "image") return <img className={compact ? "visual-preview compact" : "visual-preview"} src={source} alt={alt} />;
  return <ImageIcon size={compact ? 32 : 44} className="text-brand-600" />;
}

type DatedLogDay = {
  key: string;
  label: string;
  rows: RecordItem[];
};

type DatedLogMonth = {
  key: string;
  label: string;
  days: DatedLogDay[];
  count: number;
};

type DatedLogYear = {
  key: string;
  label: string;
  months: DatedLogMonth[];
  count: number;
};

function groupLogsByCalendar(rows: RecordItem[]): DatedLogYear[] {
  const years = new Map<string, Map<string, Map<string, RecordItem[]>>>();

  for (const row of rows) {
    const date = new Date(String(row.createdAt || ""));
    if (Number.isNaN(date.getTime())) continue;
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year)!;
    if (!months.has(month)) months.set(month, new Map());
    const days = months.get(month)!;
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(row);
  }

  return [...years.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, months]) => {
      const monthGroups = [...months.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, days]) => {
          const dayGroups = [...days.entries()]
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([day, dayRows]) => ({
              key: `${year}-${month}-${day}`,
              label: `${Number(day)} 日`,
              rows: dayRows,
            }));
          return {
            key: `${year}-${month}`,
            label: `${Number(month)} 月`,
            days: dayGroups,
            count: dayGroups.reduce((total, group) => total + group.rows.length, 0),
          };
        });
      return {
        key: year,
        label: `${year} 年`,
        months: monthGroups,
        count: monthGroups.reduce((total, group) => total + group.count, 0),
      };
    });
}

function GroupedLogTable({
  rows,
  fields,
  fieldLabel,
  display,
}: {
  rows: RecordItem[];
  fields: string[];
  fieldLabel: (field: string) => string;
  display: (value: unknown) => string;
}) {
  const groups = groupLogsByCalendar(rows);

  if (!groups.length) {
    return (
      <div className="admin-log-empty">
        <CalendarDays size={28} />
        <strong>目前没有记录</strong>
        <span>产生访问或后台操作后，会自动按年月日归档在这里。</span>
      </div>
    );
  }

  return (
    <div className="admin-log-groups">
      <div className="admin-log-retention-note">
        <CalendarDays size={17} />
        <span>记录按年、月、日折叠显示；系统仅保留最近 3 个月，过期数据每天自动清理。</span>
      </div>
      {groups.map((year, yearIndex) => (
        <details className="admin-log-year" key={year.key} open={yearIndex === 0}>
          <summary>
            <strong>{year.label}</strong>
            <span>{year.count} 条记录</span>
          </summary>
          <div className="admin-log-year-body">
            {year.months.map((month, monthIndex) => (
              <details className="admin-log-month" key={month.key} open={yearIndex === 0 && monthIndex === 0}>
                <summary>
                  <strong>{month.label}</strong>
                  <span>{month.count} 条</span>
                </summary>
                <div className="admin-log-month-body">
                  {month.days.map((day, dayIndex) => (
                    <details className="admin-log-day" key={day.key} open={yearIndex === 0 && monthIndex === 0 && dayIndex === 0}>
                      <summary>
                        <strong>{day.label}</strong>
                        <span>{day.rows.length} 条</span>
                      </summary>
                      <div className="admin-table-wrap admin-log-table-wrap">
                        <table className="admin-table">
                          <thead>
                            <tr>{fields.map((field) => <th key={field}>{fieldLabel(field)}</th>)}</tr>
                          </thead>
                          <tbody>
                            {day.rows.map((row) => (
                              <tr key={row.id}>
                                {fields.map((field) => <td key={field}>{display(row[field])}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export function AdminManager({ sectionKey, fixedFilter, headingOverride, descriptionOverride, presentation = "table", pageLabel = "前台页面" }: { sectionKey: string; fixedFilter?: Record<string, string>; headingOverride?: string; descriptionOverride?: string; presentation?: AdminPresentation; pageLabel?: string }) {
  const bannerPresentation = presentation === "home-banners" || presentation === "page-banners";
  const sectionPresentation = presentation === "home-sections" || presentation === "page-sections";
  const [section, setSection] = useState<CmsSection | null>(null);
  const [rows, setRows] = useState<RecordItem[]>([]);
  const [relations, setRelations] = useState<
    Record<string, RelationItem[]>
  >({});
  const [csrf, setCsrf] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RecordItem | null | undefined>(
    undefined,
  );
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [trashPreview, setTrashPreview] = useState<RecordItem | null>(null);
  const [backupImporting, setBackupImporting] = useState(false);
  const [bannerBatchProgress, setBannerBatchProgress] = useState("");
  const backupImportInputRef = useRef<HTMLInputElement>(null);
  const bannerBatchInputRef = useRef<HTMLInputElement>(null);
  const bannerModalBatchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (loading || !sectionPresentation || !window.location.hash.startsWith("#page-section-")) return;
    const target = document.getElementById(window.location.hash.slice(1));
    if (!target) return;
    window.requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [loading, rows.length, sectionPresentation]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getFreshCsrfToken();
      setCsrf(token);
      const query = fixedFilter ? `?${new URLSearchParams(fixedFilter).toString()}` : "";
      const response = await fetch(`/api/admin/${sectionKey}${query}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || "加载失败");
      else {
        setSection(data.section);
        setRows(data.data);
        setRelations(data.relations || {});
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [sectionKey, fixedFilter]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (editing === undefined && !trashPreview) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [editing, trashPreview]);
  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        JSON.stringify(row).toLowerCase().includes(query.toLowerCase()),
      ),
    [rows, query],
  );
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!section) return;
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    for (const field of section.fields) {
      const value = fd.get(field.key);
      body[field.key] = field.type === "boolean"
        ? value === "on"
        : field.jsonKind === "contentItems"
          ? contentItemsWithCurrentMedia(fd, field.key, value)
          : value;
    }
    Object.assign(body, fixedFilter || {});
    if (sectionKey === "banners") {
      body.key = editing?.key || `${String(body.page || "banner")}_slide_${Date.now()}`;
    }
    const translations: Record<string, Record<string, unknown>> = {};
    for (const locale of relations.translationLocales || []) {
      if (!locale.code) continue;
      translations[locale.code] = {};
      for (const field of section.fields.filter((item) => item.translatable)) {
        const translatedFieldName = `__i18n__${locale.code}__${field.key}`;
        const translatedValue = fd.get(translatedFieldName);
        translations[locale.code][field.key] = field.jsonKind === "contentItems"
          ? contentItemsWithCurrentMedia(fd, translatedFieldName, translatedValue)
          : translatedValue || "";
      }
    }
    if (Object.keys(translations).length) body._translations = translations;
    const token = await getFreshCsrfToken();
    setCsrf(token);
    const response = await fetch(
      editing?.id
        ? `/api/admin/${sectionKey}/${editing.id}`
        : `/api/admin/${sectionKey}`,
      {
        method: editing?.id ? "PUT" : "POST",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "保存失败");
      return;
    }
    setEditing(undefined);
    await load();
  }
  async function remove(row: RecordItem) {
    if (
      !confirm(`确认删除此${section?.singular || "记录"}？删除后将进入回收站。`)
    )
      return;
    const token = await getFreshCsrfToken();
    setCsrf(token);
    const response = await fetch(`/api/admin/${sectionKey}/${row.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": token },
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "删除失败");
      return;
    }
    await load();
  }
  async function toggle(
    row: RecordItem,
    field: "status" | "isVisible" | "isActive",
  ) {
    const value =
      field === "status"
        ? row.status === "PUBLISHED"
          ? "DRAFT"
          : "PUBLISHED"
        : !row[field];
    const token = await getFreshCsrfToken();
    setCsrf(token);
    const response = await fetch(`/api/admin/${sectionKey}/${row.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-csrf-token": token },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "状态更新失败");
    else load();
  }
  async function clone(row: RecordItem) {
    if (!section) return;
    const body: Record<string, unknown> = {};
    for (const field of section.fields) body[field.key] = row[field.key];
    Object.assign(body, fixedFilter || {});
    body._translations = row._translations;
    const suffix = Date.now().toString().slice(-6);
    if (body.key) body.key = `${body.key}-copy-${suffix}`;
    if (body.slug) body.slug = `${body.slug}-copy-${suffix}`;
    if (body.sku) body.sku = `${body.sku}-COPY-${suffix}`;
    if (body.name) body.name = `${body.name} Copy`;
    if (body.title) body.title = `${body.title} Copy`;
    const token = await getFreshCsrfToken();
    setCsrf(token);
    const response = await fetch(`/api/admin/${sectionKey}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": token },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "复制失败");
    else load();
  }
  async function runAction(action: string) {
    const token = await getFreshCsrfToken();
    setCsrf(token);
    const response = await fetch(`/api/admin/${action}`, {
      method: "POST",
      headers: { "x-csrf-token": token },
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "操作失败");
    else {
      alert(action === "backup" ? "数据库备份已创建" : "邮件队列已处理");
      load();
    }
  }
  async function importBackupFile(file: File) {
    setBackupImporting(true);
    setError("");
    try {
      const token = await getFreshCsrfToken();
      setCsrf(token);
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/admin/backup/import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-csrf-token": token },
        body,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "数据库备份导入失败");
        return;
      }
      alert("数据库备份已安全导入。请在新记录右侧点击“恢复”即可导入其中的数据。");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "数据库备份导入失败");
    } finally {
      setBackupImporting(false);
      if (backupImportInputRef.current) backupImportInputRef.current.value = "";
    }
  }
  async function uploadBannerBatch(files: File[], templateOverride?: RecordItem | null) {
    if (!files.length || !section || sectionKey !== "banners") return;
    setError("");
    const template = templateOverride || rows.find((row) => row.status === "PUBLISHED") || rows[0];
    const page = String(fixedFilter?.page || template?.page || "home");
    const nextSortOrder = rows.reduce((maximum, row) => Math.max(maximum, Number(row.sortOrder || 0)), -1) + 1;
    let completed = 0;
    try {
      for (const [index, file] of files.entries()) {
        setBannerBatchProgress(`${index + 1}/${files.length}`);
        const uploadBody = new FormData();
        uploadBody.set("file", file);
        uploadBody.set("name", file.name);
        uploadBody.set("alt", file.name.replace(/\.[^.]+$/, ""));
        uploadBody.set("folder", `banners/${page}`);
        const uploadToken = await getFreshCsrfToken();
        const uploadResponse = await fetch("/api/admin/upload", {
          method: "POST",
          credentials: "same-origin",
          headers: { "x-csrf-token": uploadToken },
          body: uploadBody,
        });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(`${file.name}：${uploadData.error || "上传失败"}`);

        const now = Date.now();
        const bannerBody = {
          key: `${page}_slide_${now}_${index}`,
          page,
          title: String(template?.title || `${pageLabel}首屏轮播`),
          subtitle: String(template?.subtitle || ""),
          description: String(template?.description || ""),
          image: String(uploadData.data.path),
          ctaLabel: String(template?.ctaLabel || "了解更多"),
          ctaHref: String(template?.ctaHref || "/contact"),
          sortOrder: nextSortOrder + index,
          status: "PUBLISHED",
          ...(template?._translations ? { _translations: template._translations } : {}),
        };
        const createToken = await getFreshCsrfToken();
        const createResponse = await fetch("/api/admin/banners", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json", "x-csrf-token": createToken },
          body: JSON.stringify(bannerBody),
        });
        const createData = await createResponse.json();
        if (!createResponse.ok) throw new Error(`${file.name}：${createData.error || "轮播创建失败"}`);
        completed += 1;
      }
      alert(`已成功上传并发布 ${completed} 张${pageLabel}首屏轮播图。`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "批量上传轮播图失败");
      if (completed) await load();
    } finally {
      setBannerBatchProgress("");
      if (bannerBatchInputRef.current) bannerBatchInputRef.current.value = "";
      if (bannerModalBatchInputRef.current) bannerModalBatchInputRef.current.value = "";
    }
  }
  async function restore(row: RecordItem) {
    if (sectionKey === "trash") {
      if (!confirm("确认恢复此记录？若原 ID 已被占用，恢复会失败。")) return;
      const token = await getFreshCsrfToken();
      setCsrf(token);
      const response = await fetch(`/api/admin/trash/${row.id}/restore`, {
        method: "POST",
        headers: { "x-csrf-token": token },
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || "恢复失败");
      else load();
      return;
    }
    const phrase = prompt(
      "数据库恢复会覆盖当前数据库并自动保留安全副本。请输入 RESTORE DATABASE 继续：",
    );
    if (phrase !== "RESTORE DATABASE") return;
    const token = await getFreshCsrfToken();
    setCsrf(token);
    const response = await fetch(`/api/admin/backup/${row.id}/restore`, {
      method: "POST",
      headers: { "x-csrf-token": token, "x-restore-confirmation": phrase },
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "恢复失败");
    else alert("数据库已恢复，请重启服务后继续使用。");
  }
  async function purgeTrash(row: RecordItem) {
    if (!confirm(`确认永久删除“${String(row.displayName || row.entityId)}”？该操作不可恢复。`)) return;
    const token = await getFreshCsrfToken();
    setCsrf(token);
    const response = await fetch(`/api/admin/trash/${row.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": token },
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "永久删除失败");
    else await load();
  }
  async function deleteBackup(row: RecordItem) {
    if (!confirm(`确认永久删除数据库备份“${String(row.fileName || row.id)}”？该操作不可恢复。`)) return;
    const token = await getFreshCsrfToken();
    setCsrf(token);
    const response = await fetch(`/api/admin/backup/${row.id}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "x-csrf-token": token },
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "备份删除失败");
    else await load();
  }
  if (loading)
    return (
      <div className="admin-panel p-10 text-center text-slate-500">
        <RefreshCw className="mx-auto mb-3 animate-spin" />
        正在加载真实数据库数据…
      </div>
    );
  if (!section)
    return (
      <div className="form-status error">{error || "Unknown section"}</div>
    );
  const friendlyValues: Record<string, string> = {
    home: "首页",
    about: "关于我们区域",
    products: "产品区域",
    equipment: "生产设备区域",
    workshop: "车间环境区域",
    quality: "品质认证区域",
    PUBLISHED: "已发布",
    DRAFT: "草稿",
    HEADER: "顶部菜单",
    FOOTER: "底部菜单",
    PRODUCTS: "产品菜单",
    completed: "备份完成",
    imported: "已导入，待恢复",
  };
  const commonFieldLabels: Record<string, string> = {
    key: "内容位置",
    page: "所属页面",
    title: "前台标题",
    status: "发布状态",
    sortOrder: "显示顺序",
    isVisible: "前台显示",
    isActive: "启用状态",
    updatedAt: "最后修改时间",
    createdAt: "创建时间",
    route: "页面地址",
    label: "菜单名称",
    href: "跳转地址",
    location: "显示位置",
    action: "操作类型",
    entityType: "内容类型",
    entityId: "记录编号",
    ip: "来源 IP",
  };
  const fieldLabel = (key: string) =>
    section.fields.find((field) => field.key === key)?.label ||
    commonFieldLabels[key] ||
    key;
  const display = (value: unknown) => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "是" : "否";
    if (typeof value === "object") return JSON.stringify(value);
    const text = String(value);
    if (friendlyValues[text]) return friendlyValues[text];
    if (/^\d{4}-\d{2}-\d{2}T/.test(text))
      return new Date(text).toLocaleString("zh-CN");
    return text.length > 90 ? text.slice(0, 90) + "…" : text;
  };
  const statSections = [
    "products",
    "news",
    "inquiries",
    "banners",
    "categories",
  ];
  const statusCount = (...values: string[]) =>
    rows.filter((r) => values.includes(String(r.status))).length;
  const restorable = sectionKey === "trash" || sectionKey === "backups";
  const cloneable = [
    "products",
    "categories",
    "news",
    "banners",
    "pages",
  ].includes(sectionKey);
  const homeSectionMeta: Record<string, { order: string; title: string; location: string }> = {
    about: { order: "01", title: "关于我们", location: "首屏下方的公司介绍" },
    products: { order: "02", title: "产品栏目", location: "产品分类卡片上方" },
    equipment: { order: "03", title: "生产设备", location: "生产设备图片卡片上方" },
    workshop: { order: "04", title: "车间环境", location: "车间与产线图片上方" },
    quality: { order: "05", title: "品质与认证", location: "首页底部品质认证区域" },
    partners: { order: "04", title: "合作伙伴公司", location: "关于我们页面的自动滚动 Logo 区域" },
  };
  return (
    <>
      {presentation === "table" && statSections.includes(sectionKey) && (
        <div className="manager-stats">
          {[
            [Boxes, "总记录", rows.length],
            [
              CircleCheck,
              "已发布 / 完成",
              statusCount("PUBLISHED", "WON", "SENT"),
            ],
            [
              CircleDashed,
              "草稿 / 待跟进",
              statusCount("DRAFT", "NEW", "ASSIGNED", "PENDING"),
            ],
            [
              FileText,
              "本月新增",
              rows.filter(
                (r) =>
                  r.createdAt &&
                  new Date(String(r.createdAt)).getMonth() ===
                    new Date().getMonth(),
              ).length,
            ],
          ].map(([Icon, label, value]) => {
            const C = Icon as typeof Boxes;
            return (
              <div className="admin-panel manager-stat" key={String(label)}>
                <div>
                  <small>{String(label)}</small>
                  <strong>{String(value)}</strong>
                </div>
                <span className="icon-badge">
                  <C size={19} />
                </span>
              </div>
            );
          })}
        </div>
      )}
      {sectionKey === "settings" && (
        <BrandSettingsPanel
          rows={rows}
          csrf={csrf}
          media={relations.media || []}
          onDone={load}
        />
      )}
      {sectionKey === "backups" && <BackupSchedulePanel csrf={csrf} />}
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>
              {headingOverride || (sectionKey === "settings" ? "其他高级设置" : section.label)}
            </h2>
            <p>
              {descriptionOverride || section.description} · 共 {filtered.length} 条
            </p>
          </div>
          <div className="admin-toolbar">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-2.5 text-slate-400"
              />
              <input
                className="rounded border py-1.5 pl-8 pr-2 text-xs"
                placeholder="搜索当前列表"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {sectionKey === "backups" && (
              <>
                <input
                  ref={backupImportInputRef}
                  className="sr-only"
                  type="file"
                  accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3,application/x-sqlite3"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void importBackupFile(file);
                  }}
                />
                <button
                  className="btn btn-outline btn-sm"
                  disabled={backupImporting}
                  onClick={() => backupImportInputRef.current?.click()}
                >
                  <Upload size={14} />
                  {backupImporting ? "正在校验并导入…" : "导入数据库备份"}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={backupImporting}
                  onClick={() => runAction("backup")}
                >
                  创建备份
                </button>
              </>
            )}
            {sectionKey === "email-queue" && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => runAction("email/process")}
              >
                重试待发送
              </button>
            )}
            {sectionKey === "media" && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setEditing(null)}
              >
                <Upload size={14} />
                上传文件
              </button>
            )}
            {bannerPresentation && (
              <>
                <input
                  ref={bannerBatchInputRef}
                  className="sr-only"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.mp4,.webm"
                  multiple
                  onChange={(event) => void uploadBannerBatch(Array.from(event.currentTarget.files || []))}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm banner-batch-upload-btn"
                  disabled={Boolean(bannerBatchProgress)}
                  onClick={() => bannerBatchInputRef.current?.click()}
                >
                  <Upload size={14} />
                  {bannerBatchProgress ? `正在上传 ${bannerBatchProgress}` : "批量上传多张轮播图"}
                </button>
              </>
            )}
            {!section.readonly && (
              <button
                className="btn btn-primary btn-sm"
                disabled={Boolean(bannerBatchProgress)}
                onClick={() => setEditing(null)}
              >
                <Plus size={14} />
                {bannerPresentation
                  ? `新增一张${pageLabel}首屏轮播`
                  : sectionPresentation
                    ? `新增${pageLabel}内容区块`
                    : `新增${section.singular}`}
              </button>
            )}
            <button className="icon-btn" onClick={load} aria-label="刷新">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
        {error && <div className="form-status error m-4">{error}</div>}
        {bannerPresentation && (
          <div className="banner-carousel-guide">
            <div>
              <strong>{pageLabel}首屏已配置 {filtered.length} 张</strong>
              <span>其中 {filtered.filter((row) => row.status === "PUBLISHED").length} 张已发布</span>
            </div>
            <p>同一页面可添加多张图片或视频；发布 2 张及以上后，前台会按“显示顺序”每 2 秒自动轮播。每一张都能单独修改中英文文字、按钮和背景媒体。</p>
          </div>
        )}
        {sectionKey === "media" ? (
          <div className="media-grid-admin">
            {filtered.map((row) => (
              <article className="admin-panel media-card-admin" key={row.id}>
                <div className="media-preview">
                  <VisualMediaPreview source={String(row.path)} mimeType={String(row.mimeType)} alt={String(row.alt || row.name || "")} compact />
                </div>
                <div className="media-meta">
                  <strong>{String(row.name)}</strong>
                  <small>
                    {String(row.mimeType)} ·{" "}
                    {Math.ceil(Number(row.size) / 1024)} KB
                  </small>
                  <span className="block mt-2 text-[10px] text-emerald-600">
                    替代文本：{row.alt ? "已设置" : "未设置"}
                  </span>
                  <div className="media-usage-row">
                    <span className={`media-usage ${Number(row.count || 0) ? "is-used" : "is-free"}`}>
                      {Number(row.count || 0) ? "使用中" : "空闲"}
                    </span>
                    <small>{Number(row.count || 0)} 个前台引用</small>
                  </div>
                  {Array.isArray(row.references) && row.references.length > 0 && (
                    <div className="media-references" title={row.references.join("\n")}>
                      {row.references.slice(0, 2).map((reference) => <span key={reference}>{reference}</span>)}
                      {row.references.length > 2 && <span>+{row.references.length - 2} 个</span>}
                    </div>
                  )}
                  <button
                    className="btn btn-danger btn-sm media-delete-btn"
                    disabled={Number(row.count || 0) > 0}
                    onClick={() => remove(row)}
                    title={Number(row.count || 0) ? "请先移除前台引用" : "删除后进入回收站"}
                  >
                    <Trash2 size={13} />
                    {Number(row.count || 0) ? "使用中不可删" : "删除"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : bannerPresentation ? (
          <div className="home-banner-manager-grid">
            {filtered.map((row, index) => (
              <article className="home-banner-manager-card" key={row.id}>
                <div className="home-banner-manager-preview">
                  {row.image ? <VisualMediaPreview source={String(row.image)} alt={String(row.title || `轮播 ${index + 1}`)} compact /> : <div><ImageIcon size={32} /><span>尚未选择背景图片或视频</span></div>}
                  <span className="home-banner-number">第 {index + 1} 张</span>
                  <span className={`home-content-status ${row.status === "PUBLISHED" ? "is-live" : "is-hidden"}`}>
                    {row.status === "PUBLISHED" ? "前台展示中" : "草稿未展示"}
                  </span>
                </div>
                <div className="home-banner-manager-copy">
                  <small>前台主标题</small>
                  <h3>{String(row.title || "未填写标题")}</h3>
                  {Boolean(row.subtitle) && <strong>{String(row.subtitle)}</strong>}
                  <p>{String(row.description || "尚未填写说明文字")}</p>
                  <div className="home-card-meta"><span>按钮：{String(row.ctaLabel || "未设置")}</span><span>顺序：{String(row.sortOrder ?? 0)}</span></div>
                </div>
                <div className="home-card-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => setEditing(row)}><Edit3 size={14} />编辑文字与图片/视频</button>
                  <button className="btn btn-outline btn-sm" onClick={() => toggle(row, "status")}>{row.status === "PUBLISHED" ? "暂时隐藏" : "发布到前台"}</button>
                  <button className="btn btn-outline btn-sm" onClick={() => clone(row)}><Copy size={13} />复制</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(row)}><Trash2 size={13} />删除</button>
                </div>
              </article>
            ))}
            {!filtered.length && <div className="home-manager-empty"><ImageIcon size={32} /><strong>还没有{pageLabel}首屏内容</strong><span>点击右上角新增轮播，设置前台标题、按钮和背景图片/视频。</span></div>}
          </div>
        ) : sectionPresentation ? (
          <div className="home-section-manager-list">
            {filtered.map((row, index) => {
              const meta = homeSectionMeta[String(row.key)] || { order: String(index + 1).padStart(2, "0"), title: String(row.title || "自定义区块"), location: `${pageLabel}内容区域` };
              return (
                <article className="home-section-manager-card" id={`page-section-${String(row.key)}`} key={row.id}>
                  <div className="home-section-order"><strong>{meta.order}</strong><span>前台顺序</span></div>
                  <div className="home-section-thumb">{row.image ? <img src={String(row.image)} alt="" /> : <LayoutTemplate size={28} />}</div>
                  <div className="home-section-copy">
                    <div><strong>{meta.title}</strong><span>{meta.location}</span></div>
                    <h3>{String(row.title || "未填写标题")}</h3>
                    <p>{String(row.content || "尚未填写说明文字")}</p>
                  </div>
                  <span className={`home-content-status ${row.isVisible ? "is-live" : "is-hidden"}`}>{row.isVisible ? "前台显示中" : "已隐藏"}</span>
                  <div className="home-card-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => setEditing(row)}><Edit3 size={14} />编辑文字与图片</button>
                    <button className="btn btn-outline btn-sm" onClick={() => toggle(row, "isVisible")}>{row.isVisible ? "隐藏此区域" : "恢复显示"}</button>
                  </div>
                </article>
              );
            })}
            {!filtered.length && <div className="home-manager-empty"><LayoutTemplate size={32} /><strong>还没有{pageLabel}内容区块</strong><span>点击右上角新增区块，保存后会直接显示在前台。</span></div>}
          </div>
        ) : sectionKey === "website-visits" || sectionKey === "audit" ? (
          <GroupedLogTable
            rows={filtered}
            fields={section.listFields}
            fieldLabel={fieldLabel}
            display={display}
          />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {section.listFields.map((field) => (
                    <th key={field}>{fieldLabel(field)}</th>
                  ))}
                  {(!section.readonly || restorable) && <th>操作</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    {section.listFields.map((field) => {
                      const value = row[field];
                      if (
                        !section.readonly &&
                        field === "status" &&
                        ["PUBLISHED", "DRAFT"].includes(String(value))
                      )
                        return (
                          <td key={field}>
                            <button
                              className={`admin-switch ${value === "PUBLISHED" ? "on" : ""}`}
                              onClick={() => toggle(row, "status")}
                              aria-label="切换发布状态"
                            />
                            <span className="ml-2 text-[10px] text-slate-500">
                              {display(value)}
                            </span>
                          </td>
                        );
                      if (
                        !section.readonly &&
                        (field === "isVisible" || field === "isActive")
                      )
                        return (
                          <td key={field}>
                            <button
                              className={`admin-switch ${value ? "on" : ""}`}
                              onClick={() => toggle(row, field)}
                              aria-label="切换启用状态"
                            />
                          </td>
                        );
                          return (
                            <td key={field}>
                          {field === "displayName" && sectionKey === "trash" ? (
                            <button className="text-link" onClick={() => setTrashPreview(row)}>
                              {display(value)}
                            </button>
                          ) : field === "image" && value ? (
                            <img className="admin-table-image" src={String(value)} alt={String(row.name || row.title || "内容图片")} />
                          ) : field === "image" ? (
                            <span className="admin-table-image-empty"><ImageIcon size={18} />未上传</span>
                          ) : field === "status" || field === "success" ? (
                            <span className={`status-pill ${String(value)}`}>
                              {field === "success"
                                ? value
                                  ? "成功"
                                  : "失败"
                                : display(value)}
                            </span>
                          ) : (
                            display(value)
                          )}
                        </td>
                      );
                    })}
                    {!section.readonly && (
                      <td>
                        <div className="admin-actions">
                          <button
                            className="btn btn-outline btn-sm admin-action-btn"
                            onClick={() => setEditing(row)}
                            aria-label="编辑"
                          >
                            <Edit3 size={14} />
                            <span>编辑</span>
                          </button>
                          {cloneable && (
                            <button
                              className="btn btn-outline btn-sm admin-action-btn"
                              onClick={() => clone(row)}
                              aria-label="复制"
                            >
                              <Copy size={14} />
                              <span>复制</span>
                            </button>
                          )}
                          <button
                            className="btn btn-danger btn-sm admin-action-btn"
                            onClick={() => remove(row)}
                            aria-label="删除"
                          >
                            <Trash2 size={14} />
                            <span>删除</span>
                          </button>
                        </div>
                      </td>
                    )}
                    {restorable && (
                      <td>
                        <div className="admin-actions">
                          {sectionKey === "backups" && (
                            <a className="btn btn-outline btn-sm" href={`/api/admin/backup/${row.id}`} download>
                              <Download size={13} />
                              下载
                            </a>
                          )}
                          <button className="btn btn-outline btn-sm" onClick={() => restore(row)}>
                            <ArchiveRestore size={13} />
                            {sectionKey === "backups" ? "恢复 / 导入数据" : "恢复"}
                          </button>
                          {sectionKey === "trash" && (
                            <button className="btn btn-danger btn-sm" onClick={() => purgeTrash(row)}>
                              <Trash2 size={13} />
                              永久删除
                            </button>
                          )}
                          {sectionKey === "backups" && (
                            <button className="btn btn-danger btn-sm" onClick={() => deleteBackup(row)}>
                              <Trash2 size={13} />
                              删除
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td
                      colSpan={section.listFields.length + 1}
                      className="!py-12 text-center text-slate-400"
                    >
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing !== undefined && (
        <AdminModalPortal><div className="modal-backdrop" role="dialog" aria-modal="true">
          <form
            className="admin-modal"
            onSubmit={sectionKey === "media" ? undefined : save}
          >
            <div className="modal-head">
              <h2>
                {sectionKey === "media"
                  ? "上传媒体文件"
                  : editing?.id
                    ? bannerPresentation
                      ? `编辑${pageLabel}首屏文字与背景媒体`
                      : sectionPresentation
                        ? `编辑${pageLabel}内容区块`
                        : `编辑${section.singular}`
                    : bannerPresentation
                      ? `新增${pageLabel}首屏轮播`
                      : `新增${section.singular}`}
              </h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setEditing(undefined)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                {sectionKey === "media" ? (
                  <MediaUpload
                    csrf={csrf}
                    onDone={() => {
                      setEditing(undefined);
                      load();
                    }}
                  />
                ) : (
                  <>
                    <CmsEditorFields
                      section={section}
                      editing={editing}
                      relations={relations}
                      csrf={csrf}
                      hiddenFieldKeys={[
                        ...Object.keys(fixedFilter || {}),
                        ...(sectionKey === "banners" ? ["key"] : []),
                      ]}
                    />
                    {bannerPresentation && (
                      <section className="banner-modal-batch-panel">
                        <div className="banner-modal-batch-copy">
                          <strong>继续添加多张轮播图片或视频</strong>
                          <span>可一次选择多张图片、MP4 或 WebM；每个文件会自动成为一张新轮播，并沿用当前这张的中英文文字和按钮。</span>
                        </div>
                        <input
                          ref={bannerModalBatchInputRef}
                          className="sr-only"
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.mp4,.webm"
                          multiple
                          onChange={(event) => void uploadBannerBatch(
                            Array.from(event.currentTarget.files || []),
                            editing,
                          )}
                        />
                        <button
                          type="button"
                          className="btn btn-primary banner-modal-batch-button"
                          disabled={Boolean(bannerBatchProgress)}
                          onClick={() => bannerModalBatchInputRef.current?.click()}
                        >
                          <Upload size={16} />
                          {bannerBatchProgress ? `正在上传 ${bannerBatchProgress}` : "选择并上传多张轮播图 / 视频"}
                        </button>
                      </section>
                    )}
                  </>
                )}
              </div>
              {sectionKey === "inquiries" && editing?.id && (
                <CrmPanel inquiry={editing} csrf={csrf} onDone={load} />
              )}
            </div>
            {sectionKey !== "media" && (
              <div className="modal-foot">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setEditing(undefined)}
                >
                  取消
                </button>
                <button className="btn btn-primary btn-sm">保存并更新前台</button>
              </div>
            )}
          </form>
        </div></AdminModalPortal>
      )}
      {trashPreview && sectionKey === "trash" && (
        <AdminModalPortal><div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="admin-modal trash-preview-modal">
            <div className="modal-head">
              <h2>已删除内容</h2>
              <button type="button" className="icon-btn" onClick={() => setTrashPreview(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="trash-preview-meta">
                <strong>{String(trashPreview.displayName || trashPreview.entityId)}</strong>
                <span>{String(trashPreview.entityType)} · 删除于 {display(trashPreview.deletedAt)}</span>
              </div>
              <pre className="trash-json-preview">{JSON.stringify(trashPreview.deletedContent || {}, null, 2)}</pre>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setTrashPreview(null)}>关闭</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { setTrashPreview(null); restore(trashPreview); }}>恢复此内容</button>
            </div>
          </section>
        </div></AdminModalPortal>
      )}
    </>
  );
}

const brandFieldGroups = [
  {
    title: "品牌与公司资料",
    description: "修改后会同步显示在前台页头、页脚和版权信息中。",
    fields: [
      ["site_name", "品牌名称", "text"],
      ["site_tagline", "品牌口号", "text"],
      ["logo_url", "公司 Logo", "media"],
      ["company_name", "公司全称", "text"],
      ["company_description", "公司简介", "textarea"],
      ["quote_label", "顶部报价按钮文字", "text"],
      ["quote_href", "顶部报价按钮链接", "text"],
    ],
  },
  {
    title: "联系信息",
    description: "会显示在前台 Contact 页面和网站底部。",
    fields: [
      ["phone", "联系电话 / WhatsApp", "text"],
      ["email", "业务邮箱", "email"],
      ["address", "公司地址", "textarea"],
      ["google_maps_embed_url", "Google 地图嵌入链接", "url"],
      ["google_maps_directions_url", "Google 地图导航链接", "url"],
    ],
  },
  {
    title: "国外社媒链接",
    description: "填写完整的 https 地址后，前台页脚会显示可点击图标；TikTok 已内置支持。",
    fields: [
      ["social_facebook", "Facebook 地址", "url"],
      ["social_linkedin", "LinkedIn 地址", "url"],
      ["social_youtube", "YouTube 地址", "url"],
      ["social_tiktok", "TikTok 地址", "url"],
    ],
  },
  {
    title: "全站行动按钮",
    description: "管理前台底部蓝色报价区域，后台管理页面不会显示该区域。",
    fields: [
      ["cta_title", "主标题", "text"],
      ["cta_description", "说明文字", "textarea"],
      ["cta_label", "按钮文字", "text"],
      ["cta_href", "按钮链接", "text"],
    ],
  },
  {
    title: "网站底部栏目",
    description: "修改页脚各栏目标题和订阅说明；链接内容由“导航管理”和“产品分类”维护。",
    fields: [
      ["footer_quick_title", "快速链接栏目标题", "text"],
      ["footer_products_title", "产品栏目标题", "text"],
      ["footer_contact_title", "联系栏目标题", "text"],
      ["footer_newsletter_title", "订阅栏目标题", "text"],
      ["footer_newsletter_description", "订阅栏目说明", "textarea"],
      ["footer_copyright", "版权文字", "text"],
      ["footer_legal", "底部政策文字", "text"],
    ],
  },
  {
    title: "简体中文版本",
    description: "访客在前台切换为简体中文时显示。",
    fields: [
      ["site_name_zh", "中文品牌名称", "text"],
      ["site_tagline_zh", "中文品牌口号", "text"],
      ["company_name_zh", "中文公司全称", "text"],
      ["company_description_zh", "中文公司简介", "textarea"],
      ["quote_label_zh", "中文顶部报价按钮文字", "text"],
      ["address_zh", "中文公司地址", "textarea"],
      ["cta_title_zh", "中文行动标题", "text"],
      ["cta_description_zh", "中文行动说明", "textarea"],
      ["cta_label_zh", "中文按钮文字", "text"],
      ["footer_quick_title_zh", "中文快速链接标题", "text"],
      ["footer_products_title_zh", "中文产品栏目标题", "text"],
      ["footer_contact_title_zh", "中文联系栏目标题", "text"],
      ["footer_newsletter_title_zh", "中文订阅栏目标题", "text"],
      ["footer_newsletter_description_zh", "中文订阅栏目说明", "textarea"],
      ["footer_copyright_zh", "中文版权文字", "text"],
      ["footer_legal_zh", "中文底部政策文字", "text"],
    ],
  },
] as const;

function BackupSchedulePanel({ csrf }: { csrf: string }) {
  const [enabled, setEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState(24);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/admin/backup/settings")
      .then((response) => response.json())
      .then((result) => {
        if (!result.data) return;
        setEnabled(result.data.enabled ?? true);
        setIntervalHours(result.data.intervalHours || 24);
        setLastRun(result.data.lastRun);
      })
      .catch(() => undefined);
  }, []);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const token = await getFreshCsrfToken();
      const response = await fetch("/api/admin/backup/settings", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ enabled, intervalHours }),
      });
      const result = await response.json();
      setMessage(response.ok ? "自动备份设置已保存。" : result.error || "保存失败");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-panel backup-schedule-panel">
      <div>
        <strong>自动数据库备份</strong>
        <p>服务会按设定周期自动创建 SQLite 备份，并始终只保留最新 5 份；更早的文件和数据库记录会自动清理。</p>
        {lastRun && <small>上次自动备份：{new Date(lastRun).toLocaleString("zh-CN")}</small>}
      </div>
      <label className="cms-checkbox">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span>启用自动备份</span>
      </label>
      <label>
        <span>备份周期</span>
        <select value={intervalHours} onChange={(event) => setIntervalHours(Number(event.target.value))}>
          <option value={1}>每 1 小时</option>
          <option value={6}>每 6 小时</option>
          <option value={12}>每 12 小时</option>
          <option value={24}>每天</option>
          <option value={72}>每 3 天</option>
          <option value={168}>每 7 天</option>
        </select>
      </label>
      <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? "保存中…" : "保存自动备份设置"}</button>
      {message && <small className="text-emerald-600">{message}</small>}
    </section>
  );
}

function BrandSettingsPanel({
  rows,
  csrf,
  media,
  onDone,
}: {
  rows: RecordItem[];
  csrf: string;
  media: RelationItem[];
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const byKey = Object.fromEntries(rows.map((row) => [String(row.key), row]));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const token = await getFreshCsrfToken();
      for (const group of brandFieldGroups) {
        for (const [key] of group.fields) {
          const existing = byKey[key];
          const body = {
            group:
              key === "phone" || key === "email" || key.includes("address") || key.startsWith("google_maps_")
                ? "contact"
                : key.includes("company")
                  ? "company"
                  : "general",
            key,
            value: String(data.get(key) || ""),
            type: "text",
            isPublic: true,
          };
          const response = await fetch(
            existing?.id
              ? `/api/admin/settings/${existing.id}`
              : "/api/admin/settings",
            {
              method: existing?.id ? "PUT" : "POST",
              headers: {
                "content-type": "application/json",
                "x-csrf-token": token,
              },
              body: JSON.stringify(body),
            },
          );
          if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || `保存 ${key} 失败`);
          }
        }
      }
      setMessage("品牌与前台全局内容已保存，刷新前台即可看到更新。 ");
      await onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-panel brand-settings-panel">
      <div className="admin-panel-head">
        <div>
          <h2>品牌与前台全局内容</h2>
          <p>无需接触代码，直接修改公司名称、Logo、联系方式及中英文公共内容。</p>
        </div>
      </div>
      <form onSubmit={save} className="brand-settings-form">
        {brandFieldGroups.map((group) => (
          <fieldset key={group.title}>
            <legend>{group.title}</legend>
            <p>{group.description}</p>
            <div className="form-grid">
              {group.fields.map(([key, label, type]) => (
                <div
                  className={`field ${type === "textarea" || type === "media" ? "full" : ""}`}
                  key={key}
                >
                  <label htmlFor={`brand-${key}`}>{label}</label>
                  {type === "media" ? (
                    <MediaField
                      name={key}
                      initial={byKey[key]?.value}
                      csrf={csrf}
                      library={media}
                      fileMode={false}
                    />
                  ) : type === "textarea" ? (
                    <textarea
                      id={`brand-${key}`}
                      name={key}
                      rows={3}
                      defaultValue={String(byKey[key]?.value || "")}
                    />
                  ) : (
                    <input
                      id={`brand-${key}`}
                      name={key}
                      type={type}
                      defaultValue={String(byKey[key]?.value || "")}
                    />
                  )}
                </div>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="brand-settings-actions">
          {message && <span>{message}</span>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "正在保存…" : "保存并更新前台"}
          </button>
        </div>
      </form>
    </section>
  );
}

function CmsEditorFields({
  section,
  editing,
  relations,
  csrf,
  hiddenFieldKeys = [],
}: {
  section: CmsSection;
  editing: RecordItem | null | undefined;
  relations: Record<string, RelationItem[]>;
  csrf: string;
  hiddenFieldKeys?: string[];
}) {
  const translated =
    editing?._translations && typeof editing._translations === "object"
      ? (editing._translations as Record<
          string,
          Record<string, unknown>
        >)
      : {};
  const locales = relations.translationLocales || [];
  return (
    <>
      {locales.length > 0 && (
        <div className="field full cms-language-heading">
          <strong>英文内容（前台英文版）</strong>
          <span>下方带“可翻译”的内容同时提供中文版输入框。</span>
        </div>
      )}
      {section.fields.filter((field) => !hiddenFieldKeys.includes(field.key)).map((field) => (
        <CmsFieldEditor
          key={field.key}
          field={field}
          name={field.key}
          initial={editing?.[field.key]}
          relations={relations}
          csrf={csrf}
        />
      ))}
      {locales.map((locale) => {
        if (!locale.code) return null;
        return (
          <div className="contents" key={locale.code}>
            <div className="field full cms-language-heading is-translation">
              <strong>{locale.name}内容</strong>
              <span>
                保存后，访客切换到{locale.name}时会读取这里的内容；留空则回退到英文。
              </span>
            </div>
            {section.fields
              .filter((field) => field.translatable && !hiddenFieldKeys.includes(field.key))
              .map((field) => (
                <CmsFieldEditor
                  key={`${locale.code}-${field.key}`}
                  field={{ ...field, required: false }}
                  name={`__i18n__${locale.code}__${field.key}`}
                  label={`${field.label}（${locale.name}）`}
                  initial={translated[locale.code!]?.[field.key]}
                  relations={relations}
                  csrf={csrf}
                />
              ))}
          </div>
        );
      })}
    </>
  );
}

function CmsFieldEditor({
  field,
  name,
  label,
  initial,
  relations,
  csrf,
}: {
  field: CmsField;
  name: string;
  label?: string;
  initial: unknown;
  relations: Record<string, RelationItem[]>;
  csrf: string;
}) {
  const id = `cms-${name.replaceAll("_", "-")}`;
  const options = field.relation
    ? relations[field.relation] || []
    : field.options || [];
  const full = ["textarea", "json", "media", "mediaGallery", "visualMedia", "visualGallery", "file"].includes(
    field.type || "text",
  );
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label htmlFor={id}>
        {label || field.label}
        {field.required ? " *" : ""}
      </label>
      {field.type === "json" && field.jsonKind === "contentItems" ? (
        <ContentItemsEditor
          name={name}
          initial={initial}
          csrf={csrf}
          library={relations.media || []}
        />
      ) : field.type === "json" && field.jsonKind ? (
        <FriendlyJsonEditor
          name={name}
          kind={field.jsonKind as "keyValue" | "cards" | "faqs"}
          initial={initial}
        />
      ) : field.type === "json" ? (
        <FriendlyJsonEditor name={name} kind="keyValue" initial={initial} />
      ) : field.type === "mediaGallery" || field.type === "visualGallery" ? (
        <MediaGalleryField
          name={name}
          initial={initial}
          csrf={csrf}
          library={relations.media || []}
          allowVideo={field.type === "visualGallery"}
        />
      ) : field.type === "media" || field.type === "visualMedia" || field.type === "file" ? (
        <MediaField
          name={name}
          initial={initial}
          csrf={csrf}
          library={relations.media || []}
          fileMode={field.type === "file"}
          allowVideo={field.type === "visualMedia"}
        />
      ) : field.type === "textarea" ? (
        <textarea
          id={id}
          name={name}
          required={field.required}
          defaultValue={initial == null ? "" : String(initial)}
          rows={5}
        />
      ) : field.type === "boolean" ? (
        <label className="cms-checkbox">
          <input
            id={id}
            name={name}
            type="checkbox"
            defaultChecked={Boolean(initial)}
          />
          <span>启用</span>
        </label>
      ) : field.type === "select" ? (
        <select
          id={id}
          name={name}
          required={field.required}
          defaultValue={initial == null ? "" : String(initial)}
        >
          <option value="">请选择</option>
          {options.map((option) => {
            const value = "value" in option ? option.value : option.id;
            const optionLabel = "label" in option ? option.label : option.name;
            return (
              <option key={value} value={value}>
                {optionLabel}
              </option>
            );
          })}
        </select>
      ) : (
        <input
          id={id}
          name={name}
          type={
            field.type === "number"
              ? "number"
              : field.type === "date"
                ? "datetime-local"
                : field.type === "email"
                  ? "email"
                  : "text"
          }
          required={field.required}
          defaultValue={
            field.type === "date" && initial
              ? String(initial).slice(0, 16)
              : initial == null
                ? ""
                : String(initial)
          }
        />
      )}
      {field.help && <small className="text-slate-500">{field.help}</small>}
    </div>
  );
}

function parseJson(value: unknown, fallback: unknown) {
  try {
    if (value == null || value === "") return fallback;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

type ContentItemEditorValue = {
  title: string;
  text: string;
  value: string;
  image: string;
  label: string;
  href: string;
};

function ContentItemsEditor({
  name,
  initial,
  csrf,
  library,
}: {
  name: string;
  initial: unknown;
  csrf: string;
  library: RelationItem[];
}) {
  const parsed = parseJson(initial, []);
  const empty = (): ContentItemEditorValue => ({ title: "", text: "", value: "", image: "", label: "", href: "" });
  const [items, setItems] = useState<ContentItemEditorValue[]>(() => {
    if (!Array.isArray(parsed) || !parsed.length) return [empty()];
    return parsed.map((entry) => {
      const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
      return {
        title: String(item.title || ""),
        text: String(item.text || ""),
        value: String(item.value || ""),
        image: String(item.image || ""),
        label: String(item.label || ""),
        href: String(item.href || ""),
      };
    });
  });
  const serialized = useMemo(
    () => JSON.stringify(items.filter((item) => Object.values(item).some((value) => value.trim()))),
    [items],
  );
  function change(index: number, key: keyof ContentItemEditorValue, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }
  return (
    <div className="content-items-editor">
      <input type="hidden" name={name} value={serialized} />
      {items.map((item, index) => (
        <section className="content-item-editor" key={`${name}-${index}`}>
          <div className="content-item-editor-head">
            <strong>第 {index + 1} 项</strong>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setItems((current) => current.length === 1 ? [empty()] : current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={13} />删除此项</button>
          </div>
          <div className="form-grid">
            <div className="field"><label>标题 / 名称</label><input value={item.title} onChange={(event) => change(index, "title", event.target.value)} placeholder="例如：我们的使命" /></div>
            <div className="field"><label>数字 / 短标签</label><input value={item.value} onChange={(event) => change(index, "value", event.target.value)} placeholder="例如：20,000+ m²" /></div>
            <div className="field full"><label>说明文字</label><textarea rows={3} value={item.text} onChange={(event) => change(index, "text", event.target.value)} placeholder="填写该项目在前台显示的说明" /></div>
            <div className="field full"><label>项目图片（可选）</label><MediaField name={`${name}__image_${index}`} initial={item.image} csrf={csrf} library={library} fileMode={false} onValueChange={(value) => change(index, "image", value)} /></div>
            <div className="field"><label>按钮文字（可选）</label><input value={item.label} onChange={(event) => change(index, "label", event.target.value)} /></div>
            <div className="field"><label>按钮链接（可选）</label><input value={item.href} onChange={(event) => change(index, "href", event.target.value)} placeholder="/contact 或 https://..." /></div>
          </div>
        </section>
      ))}
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setItems((current) => [...current, empty()])}><Plus size={14} />添加一项</button>
    </div>
  );
}

function FriendlyJsonEditor({
  name,
  kind,
  initial,
}: {
  name: string;
  kind: "keyValue" | "cards" | "faqs";
  initial: unknown;
}) {
  const parsed = parseJson(initial, kind === "keyValue" ? {} : []);
  const emptyItem = (): Record<string, string> =>
    kind === "keyValue"
      ? { key: "", value: "" }
      : kind === "faqs"
        ? { question: "", answer: "" }
        : { title: "", text: "" };
  const [items, setItems] = useState<Record<string, string>[]>(() => {
    if (kind === "keyValue") {
      const object =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      const rows = Object.entries(object).map(([key, value]) => ({
        key,
        value: String(value ?? ""),
      }));
      return rows.length ? rows : [emptyItem()];
    }
    const rows = Array.isArray(parsed)
      ? parsed.map((item) => {
          const value = item as Record<string, unknown>;
          return (kind === "faqs"
            ? {
                question: String(value.question ?? ""),
                answer: String(value.answer ?? ""),
              }
            : {
                title: String(value.title ?? ""),
                text: String(value.text ?? ""),
              }) as Record<string, string>;
        })
      : [];
    return rows.length ? rows : [emptyItem()];
  });
  const serialized = useMemo(() => {
    if (kind === "keyValue") {
      return JSON.stringify(
        Object.fromEntries(
          items
            .filter((item) => item.key.trim())
            .map((item) => [item.key.trim(), item.value.trim()]),
        ),
      );
    }
    return JSON.stringify(
      items.filter((item) =>
        kind === "faqs"
          ? item.question?.trim() || item.answer?.trim()
          : item.title?.trim() || item.text?.trim(),
      ),
    );
  }, [items, kind]);
  const keys =
    kind === "keyValue"
      ? (["key", "value"] as const)
      : kind === "faqs"
        ? (["question", "answer"] as const)
        : (["title", "text"] as const);
  const labels =
    kind === "keyValue"
      ? ["规格名称，例如 Battery Capacity", "规格内容，例如 5000mAh"]
      : kind === "faqs"
        ? ["问题", "答案"]
        : ["标题", "说明"];
  function change(index: number, key: string, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  }
  function add() {
    setItems((current) => [...current, emptyItem()]);
  }
  return (
    <div className="friendly-json-editor">
      <input type="hidden" name={name} value={serialized} />
      {items.map((item, index) => (
        <div className="friendly-json-row" key={`${name}-${index}`}>
          {keys.map((key, keyIndex) => (
            <input
              key={key}
              value={item[key] || ""}
              onChange={(event) => change(index, key, event.target.value)}
              placeholder={labels[keyIndex]}
              aria-label={labels[keyIndex]}
            />
          ))}
          <button
            type="button"
            className="icon-btn danger"
            onClick={() =>
              setItems((current) =>
                current.length === 1
                  ? current.map(() => emptyItem())
                  : current.filter((_, itemIndex) => itemIndex !== index),
              )
            }
            aria-label="删除此项"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm" onClick={add}>
        <Plus size={14} />
        {kind === "keyValue"
          ? "添加规格"
          : kind === "faqs"
            ? "添加问题"
            : "添加一项"}
      </button>
    </div>
  );
}

function MediaGalleryField({
  name,
  initial,
  csrf,
  library,
  allowVideo = false,
}: {
  name: string;
  initial: unknown;
  csrf: string;
  library: RelationItem[];
  allowVideo?: boolean;
}) {
  const parsed = parseJson(initial, []);
  const [items, setItems] = useState<{ url: string; alt: string }[]>(() =>
    Array.isArray(parsed)
      ? parsed
          .map((item) => ({
            url: String(item?.url || item?.path || ""),
            alt: String(item?.alt || ""),
          }))
          .filter((item) => item.url)
      : [],
  );
  const [busy, setBusy] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [error, setError] = useState("");
  const available = library.filter((item) => item.mimeType?.startsWith("image/") || (allowVideo && item.mimeType?.startsWith("video/")));
  function addFromLibrary() {
    const selected = available.find((item) => item.path === selectedPath);
    if (!selected?.path || items.some((item) => item.url === selected.path)) return;
    setItems((current) => [
      ...current,
      { url: selected.path!, alt: selected.alt || selected.name },
    ]);
    setSelectedPath("");
  }
  function addExternal() {
    const source = externalUrl.trim();
    if (!source || !allowVideo || !isSupportedVisualMedia(source) || visualMediaKind(source) === "image") {
      setError("请输入受支持的 YouTube、Vimeo、Bilibili、Youku 或 HTTPS MP4/WebM 视频链接");
      return;
    }
    if (!items.some((item) => item.url === source)) setItems((current) => [...current, { url: source, alt: "外部视频" }]);
    setExternalUrl("");
    setError("");
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    const formData = new FormData();
    formData.set("file", file);
    formData.set("name", file.name);
    formData.set("alt", file.name.replace(/\.[^.]+$/, ""));
    formData.set("folder", "products");
    const token = await getFreshCsrfToken();
    const response = await fetch("/api/admin/upload", {
      method: "POST",
      headers: { "x-csrf-token": token },
      body: formData,
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) setError(data.error || "上传失败");
    else
      setItems((current) => [
        ...current,
        { url: String(data.data.path), alt: String(data.data.alt || file.name) },
      ]);
  }
  function move(index: number, direction: -1 | 1) {
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  return (
    <div className="cms-gallery-field">
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      <div className="cms-gallery-actions">
        <label className="btn btn-primary btn-sm cms-upload-button">
          <Upload size={14} /> {busy ? "上传中…" : allowVideo ? "上传图片或视频" : "上传多张图片"}
          <input
            type="file"
            accept={allowVideo ? ".jpg,.jpeg,.png,.webp,.mp4,.webm" : ".jpg,.jpeg,.png,.webp"}
            multiple
            disabled={busy}
            onChange={async (event) => {
              const files = Array.from(event.target.files || []);
              for (const file of files) await upload(file);
              event.target.value = "";
            }}
          />
        </label>
        <select
          value={selectedPath}
          onChange={(event) => setSelectedPath(event.target.value)}
        >
          <option value="">从媒体库选择图片或视频…</option>
          {available.map((item) => (
            <option key={item.id} value={item.path}>{item.name}</option>
          ))}
        </select>
        <button type="button" className="btn btn-outline btn-sm" onClick={addFromLibrary}>
          添加所选媒体
        </button>
      </div>
      {allowVideo && <div className="cms-external-media-row">
        <input type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="粘贴 YouTube / Vimeo / Bilibili / Youku 或 MP4/WebM 链接" />
        <button type="button" className="btn btn-outline btn-sm" onClick={addExternal}>添加视频链接</button>
      </div>}
      {items.length ? (
        <div className="cms-gallery-grid">
          {items.map((item, index) => (
            <article key={`${item.url}-${index}`}>
              <VisualMediaPreview source={item.url} alt={item.alt || `产品媒体 ${index + 1}`} />
              <input
                value={item.alt}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((currentItem, itemIndex) =>
                      itemIndex === index
                        ? { ...currentItem, alt: event.target.value }
                        : currentItem,
                    ),
                  )
                }
                placeholder="图片说明或视频标题"
              />
              <div>
                <button type="button" className="icon-btn" onClick={() => move(index, -1)} disabled={index === 0}>←</button>
                <button type="button" className="icon-btn" onClick={() => move(index, 1)} disabled={index === items.length - 1}>→</button>
                <button type="button" className="icon-btn danger" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="cms-gallery-empty">尚未添加轮播媒体。可混合添加图片、本地视频和受支持的平台视频链接。</div>
      )}
      {error && <small className="text-red-600">{error}</small>}
    </div>
  );
}

function MediaField({
  name,
  initial,
  csrf,
  library,
  fileMode,
  allowVideo = false,
  onValueChange,
}: {
  name: string;
  initial: unknown;
  csrf: string;
  library: RelationItem[];
  fileMode: boolean;
  allowVideo?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial == null ? "" : String(initial));
  const updateValue = (next: string) => {
    setValue(next);
    onValueChange?.(next);
  };
  const [busy, setBusy] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [error, setError] = useState("");
  const selected = library.find((item) => item.path === value);
  const available = fileMode
    ? library
    : library.filter((item) => item.mimeType?.startsWith("image/") || (allowVideo && item.mimeType?.startsWith("video/")));
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    const formData = new FormData();
    formData.set("file", file);
    formData.set("name", file.name);
    formData.set("alt", fileMode ? "" : file.name.replace(/\.[^.]+$/, ""));
    formData.set("folder", fileMode ? "downloads" : "images");
    const token = await getFreshCsrfToken();
    const response = await fetch("/api/admin/upload", {
      method: "POST",
      headers: { "x-csrf-token": token },
      body: formData,
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) setError(data.error || "上传失败");
    else updateValue(String(data.data.path));
  }
  function useExternalVideo() {
    const source = externalUrl.trim();
    if (!allowVideo || !source || !isSupportedVisualMedia(source) || visualMediaKind(source) === "image") {
      setError("请输入受支持的 YouTube、Vimeo、Bilibili、Youku 或 HTTPS MP4/WebM 视频链接");
      return;
    }
    updateValue(source);
    setExternalUrl("");
    setError("");
  }
  return (
    <div className="cms-media-field">
      <input type="hidden" name={name} value={value} />
      {value && (
        <div className="cms-media-current">
          {fileMode ? <FileText size={34} /> : <VisualMediaPreview source={value} mimeType={selected?.mimeType} alt={selected?.alt || selected?.name || "预览"} />}
          <div>
            <strong>{selected?.name || value.split("/").pop()}</strong>
            <small>{value}</small>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => updateValue("")}
          >
            移除
          </button>
        </div>
      )}
      <div className="cms-media-actions">
        <label className="btn btn-primary btn-sm cms-upload-button">
          <Upload size={14} />
          {busy ? "上传中…" : "从本地上传"}
          <input
            type="file"
            disabled={busy}
            accept={
              fileMode
                ? ".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.docx"
                : allowVideo
                  ? ".jpg,.jpeg,.png,.webp,.mp4,.webm"
                  : ".jpg,.jpeg,.png,.webp"
            }
            onChange={(event) => upload(event.target.files?.[0])}
          />
        </label>
        <select value={value} onChange={(event) => updateValue(event.target.value)}>
          <option value="">从媒体库选择…</option>
          {available.map((item) => (
            <option key={item.id} value={item.path}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {allowVideo && <div className="cms-external-media-row">
        <input type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="粘贴视频平台链接或 HTTPS MP4/WebM 链接" />
        <button type="button" className="btn btn-outline btn-sm" onClick={useExternalVideo}>使用视频链接</button>
      </div>}
      {error && <small className="text-red-600">{error}</small>}
    </div>
  );
}

function MediaUpload({ csrf, onDone }: { csrf: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const altRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("请选择需要上传的文件");
      return;
    }
    setBusy(true);
    setError("");
    const formData = new FormData();
    formData.set("file", file);
    formData.set("name", nameRef.current?.value.trim() || file.name);
    formData.set("alt", altRef.current?.value.trim() || "");
    formData.set("folder", folderRef.current?.value.trim() || "general");
    const token = await getFreshCsrfToken();
    const response = await fetch("/api/admin/upload", {
      method: "POST",
      headers: { "x-csrf-token": token },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "上传失败");
      setBusy(false);
    } else onDone();
  }
  return (
    <div className="field full">
      {error && <div className="form-status error">{error}</div>}
      <label>文件</label>
      <input
        ref={fileRef}
        type="file"
        required
        accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.webm,.xlsx,.docx"
      />
      <label>显示名称</label>
      <input ref={nameRef} required />
      <label>替代文字（图片无障碍）</label>
      <input ref={altRef} />
      <label>文件夹</label>
      <input ref={folderRef} defaultValue="general" />
      <button
        type="button"
        className="btn btn-primary mt-4"
        disabled={busy}
        onClick={upload}
      >
        {busy ? "安全检查与上传中..." : "上传并写入媒体库"}
      </button>
    </div>
  );
}

function CrmPanel({
  inquiry,
  csrf,
  onDone,
}: {
  inquiry: RecordItem;
  csrf: string;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const notes = Array.isArray(inquiry.notes)
    ? (inquiry.notes as Record<string, unknown>[])
    : [];
  const files = Array.isArray(inquiry.attachments)
    ? (inquiry.attachments as Record<string, unknown>[])
    : [];
  async function addNote() {
    if (note.trim().length < 2) return;
    setBusy(true);
    const token = await getFreshCsrfToken();
    const response = await fetch(`/api/admin/inquiries/${inquiry.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": token },
      body: JSON.stringify({
        content: note,
        type: "note",
        contactedAt: new Date().toISOString(),
      }),
    });
    setBusy(false);
    if (response.ok) {
      setNote("");
      onDone();
    }
  }
  return (
    <section className="mt-6 rounded border bg-slate-50 p-4">
      <h3 className="flex items-center gap-2 text-sm">
        <MessageSquarePlus size={16} />
        销售跟进记录
      </h3>
      <div className="flex gap-2">
        <textarea
          className="min-h-20 flex-1 rounded border p-2 text-xs"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="记录电话、邮件、报价或下一步行动…"
        />
        <button
          type="button"
          className="btn btn-primary btn-sm self-end"
          onClick={addNote}
          disabled={busy}
        >
          添加跟进
        </button>
      </div>
      {notes.length > 0 && (
        <div className="mt-3 grid gap-2">
          {notes.slice(0, 5).map((n) => (
            <div className="rounded bg-white p-2 text-xs" key={String(n.id)}>
              <strong>{String(n.type)}</strong>　{String(n.content)}
              <small className="block text-slate-400">
                {new Date(String(n.createdAt)).toLocaleString("zh-CN")}
              </small>
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="mt-3">
          <strong className="text-xs">客户附件</strong>
          {files.map((f) => (
            <a
              className="ml-2 text-xs text-brand-600"
              href={`/api/admin/inquiries/attachments/${f.id}`}
              key={String(f.id)}
            >
              {String(f.fileName)} ↓
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
