type AuditSource = Record<string, unknown> & {
  user?: { name?: string | null; email?: string | null } | null;
};

const actionLabels: Record<string, string> = {
  CREATE: "新增内容",
  UPDATE: "修改内容",
  DELETE: "删除内容",
  BACKUP: "创建数据库备份",
  DOWNLOAD_BACKUP: "下载数据库备份",
  IMPORT_BACKUP: "导入数据库备份",
  RESTORE_BACKUP: "恢复数据库备份",
  DELETE_BACKUP: "删除数据库备份",
  UPDATE_BACKUP_SCHEDULE: "修改自动备份设置",
  CRM_ASSIGN: "分配询盘负责人",
  CRM_FOLLOW_UP: "添加询盘跟进记录",
  CREATE_ADMIN: "新增管理员",
  UPDATE_ADMIN: "修改管理员资料",
  DELETE_ADMIN: "删除管理员账号",
  UPDATE_ROLE: "修改管理员角色",
  CHANGE_PASSWORD: "修改管理员密码",
  LOGIN: "登录后台",
  LOGOUT: "退出后台",
  UPLOAD: "上传文件",
  PUBLISH: "发布内容",
  SEND_EMAIL: "发送邮件",
  RETRY_EMAIL: "重试发送邮件",
};

const entityLabels: Record<string, string> = {
  product: "产品",
  productcategory: "产品分类",
  productdownload: "下载资料",
  productimage: "产品图片",
  news: "新闻",
  newscategory: "新闻分类",
  page: "独立页面",
  pagesection: "页面内容区块",
  banner: "首屏轮播",
  setting: "站点设置",
  navigationitem: "导航菜单",
  seometa: "SEO 设置",
  factoryequipment: "工厂设备",
  workshop: "车间环境",
  certificate: "认证证书",
  inquiry: "客户询盘",
  inquirynote: "询盘跟进记录",
  inquiryassignment: "询盘交接记录",
  media: "媒体文件",
  user: "管理员账号",
  role: "角色权限",
  database: "SQLite 数据库",
  emailtemplate: "邮件内容模板",
  emailqueue: "邮件发送任务",
  newslettersubscriber: "订阅用户",
  locale: "网站语言",
  translation: "翻译内容",
  trashitem: "回收站内容",
};

function parseSnapshot(value: unknown) {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function auditActionLabel(action: unknown) {
  const code = String(action || "").toUpperCase();
  if (actionLabels[code]) return actionLabels[code];
  if (code.includes("DELETE")) return "删除内容";
  if (code.includes("RESTORE")) return "恢复内容";
  if (code.includes("DOWNLOAD")) return "下载文件";
  if (code.includes("UPLOAD") || code.includes("IMPORT")) return "导入文件";
  if (code.includes("ASSIGN")) return "分配负责人";
  if (code.includes("FOLLOW")) return "添加跟进记录";
  if (code.includes("UPDATE") || code.includes("EDIT")) return "修改内容";
  if (code.includes("CREATE") || code.includes("ADD")) return "新增内容";
  if (code.includes("LOGIN")) return "登录后台";
  if (code.includes("LOGOUT")) return "退出后台";
  if (code.includes("SEND")) return "发送内容";
  return "执行系统操作";
}

export function auditEntityLabel(entityType: unknown) {
  const key = String(entityType || "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  return entityLabels[key] || "系统数据";
}

export function prepareAuditRow(row: AuditSource) {
  const after = parseSnapshot(row.afterJson);
  const before = parseSnapshot(row.beforeJson);
  const snapshot = after || before;
  const entityLabel = auditEntityLabel(row.entityType);
  const targetValue = snapshot
    ? [
        snapshot.referenceNo,
        snapshot.name,
        snapshot.title,
        snapshot.label,
        snapshot.fileName,
        snapshot.companyName,
        snapshot.email,
        snapshot.key,
      ].find((value) => typeof value === "string" && value.trim())
    : null;

  return {
    ...row,
    actor: String(row.actorName || "").trim() || row.user?.name?.trim() || String(row.actorEmail || "").trim() || row.user?.email?.trim() || (row.userId ? "已删除的管理员" : "系统自动任务"),
    actionLabel: auditActionLabel(row.action),
    entityLabel,
    targetLabel: targetValue ? String(targetValue) : `${entityLabel}记录`,
  };
}
