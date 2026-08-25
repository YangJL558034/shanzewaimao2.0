# ENERCORE B2B 官网与 CMS

这是一套面向国际 B2B 制造业的完整 Next.js 官网与后台管理系统。前台内容来自 SQLite 数据库，后台通过 Prisma 执行真实 CRUD，并包含 Session 认证、RBAC、询盘 CRM、SMTP 邮件队列、媒体管理、操作审计、回收站和数据库备份。

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript
- Tailwind CSS + 响应式、无障碍与图片优化
- SQLite + Prisma ORM
- bcrypt 密码哈希、自建服务端 Session、RBAC
- Nodemailer SMTP 队列与指数退避重试
- Zod 服务端校验、CSRF、持久化 Rate Limit、安全 Headers

## 本地启动

要求 Node.js 22.5 或更高版本，生产服务器推荐使用 Node.js 22 LTS。数据库备份完整性校验使用了 Node.js 内置 `node:sqlite`，不要使用 Node.js 20 部署。

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed
npm run dev
```

Windows PowerShell 可将复制命令替换为 `Copy-Item .env.example .env`。

交付包不包含当前运行中的 `prisma/dev.db`，避免泄露管理员修改、Session、询盘和审计数据。执行 `npx prisma migrate dev` 会从迁移文件创建 SQLite，随后运行 `npm run db:seed` 写入可幂等重复执行的初始数据。

访问：

- 前台：`http://localhost:3000`
- 后台：`http://localhost:3000/admin/login`

`npm run dev` 和 `npm start` 均固定监听 `0.0.0.0`，同一局域网设备可使用服务器的 IPv4 地址访问，例如 `http://192.168.0.208:3000`。部署到公网时仍应通过 HTTPS 反向代理暴露服务。

种子默认管理员由 `.env` 中以下变量控制：

```env
DEFAULT_ADMIN_EMAIL="admin@enercore.com"
DEFAULT_ADMIN_PASSWORD="ChangeMe123!"
```

首次登录后请立即在“用户与权限”中更换为仅自己掌握的高强度密码，并在生产环境替换 `APP_SECRET`、`EMAIL_CRON_SECRET` 和所有 SMTP 凭据。再次执行 Seed 不会明文保存密码。

## 前台页面与后台联动

后台不设置额外的“前台页面修改”入口，而是按业务模块直接更新对应前台内容。每个模块中的新增、编辑、删除、启用/停用按钮都会调用真实 API 并写入 SQLite；前台服务端渲染读取同一份数据。

对应管理入口：

- 产品、分类、可视化规格键值、特性卡片、FAQ、封面、产品轮播多图和下载资料：产品管理
- 新闻与新闻分类：新闻管理
- 工厂设备、车间环境、证书：制造与质量
- 首页/页面区块标题、正文、背景图和按钮：页面区块
- 页面正文、Banner 背景图、导航、SEO、Schema：内容与营销
- 公司名称、Logo、联系方式、CTA、页脚栏目与中英文内容：网站设置
- 媒体与安全文件上传：媒体文件；产品封面、产品详情轮播和各页首屏 Banner 支持图片、本地 MP4/WebM 视频，以及 YouTube、Vimeo、Bilibili、Youku 视频链接；Seed 会把 `public/references` 中当前网站模板素材登记到媒体库
- 多语言语言开关与字段翻译：编辑业务内容时直接填写 English / 简体中文，语言管理仍可控制启用状态
- 询盘状态、销售分配、下次跟进和跟进日志：询盘 CRM
- SMTP 模板、发送队列、失败原因和重试：邮件模板、邮件队列
- 管理员、角色、权限、Session 下线、账号锁定：用户与权限

## 询盘与邮件可靠性

`POST /api/inquiries` 会按以下顺序处理：

1. CSRF、Origin、Rate Limit、蜜罐和 Zod 校验。
2. 校验附件扩展名、MIME、大小和文件签名。
3. 先把询盘和附件元数据写入 SQLite。
4. 再创建 `EmailQueue` 任务并尝试发送。
5. SMTP 失败不会丢失询盘；任务保留 `FAILED` 状态和错误信息，按指数退避安排重试。

后台可手动点击“重试待发送”。生产环境也可定时调用：

```http
POST /api/admin/email/process
X-Cron-Secret: <EMAIL_CRON_SECRET>
```

或在服务器执行 `npm run email:worker`。

## SMTP 配置

推荐直接登录后台，打开“系统管理 → 邮件服务器”（`/admin/smtp`），填写 SMTP 服务器、端口、邮箱账号、授权密码、发件人和“询盘最终收件邮箱”。授权密码会使用 `APP_SECRET` 派生密钥加密后保存，不会在后台接口中返回明文。系统每分钟自动重试待发送或失败邮件。

也可以使用环境变量作为未配置后台设置时的默认值：

```env
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="website@example.com"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="ENERCORE Website <website@example.com>"
INQUIRY_NOTIFY_TO="sales@example.com"
```

SMTP 留空时，询盘仍然正常入库，邮件任务保持待发送状态，配置完成后可重试。

## 安全措施

- bcrypt（cost 12）密码哈希
- 随机 Session Token 仅以 SHA-256 哈希形式存库
- HttpOnly、SameSite Lax Cookie；Secure 根据访客 HTTPS 或反向代理 `X-Forwarded-Proto` 自动启用
- 登录 IP 限流、连续失败账号锁定、登录日志
- 每个后台 API 的服务端 RBAC 权限校验
- 双提交 CSRF Token 与同源检查
- Zod 白名单校验、文本清理、Prisma 参数化查询
- CSP、HSTS、X-Frame-Options、nosniff、Permissions-Policy
- 上传类型、扩展名、大小、文件头签名和随机文件名检查
- 询盘附件存于非公开目录，仅授权管理员可下载
- 新增、修改、删除、登录、上传、跟进、备份和恢复操作审计

## 数据备份与恢复

后台“数据备份”会在 WAL checkpoint 后复制 SQLite 文件并记录 SHA-256 校验值。恢复前必须输入 `RESTORE DATABASE`，系统会先保存当前数据库安全副本，校验备份后再覆盖；恢复完成需要重启服务。

后台可直接启用自动备份并选择 1 小时至 7 天的周期。Node.js 长进程内置调度器会检查到期状态；手动备份和自动备份共用同一套保留策略，始终只保存最新 5 份记录和数据库文件，超出后自动删除最旧备份。

生产环境务必同时做主机级快照，并把 `backups/` 复制到独立存储。SQLite 部署需要持久化磁盘；无状态 Serverless 实例不适合直接保存本地 SQLite 文件。

## 生产构建与部署

Linux 云服务器从 GitHub 克隆后，使用生产迁移和生产启动命令：

```bash
npm ci
cp .env.example .env
# 编辑 .env，设置正式域名、随机密钥、管理员初始账号和 SMTP
npm run db:deploy
npm run db:seed
npm run build
npm start
```

`npm run db:deploy` 会先创建 SQLite 文件及 `public/uploads`、`storage/private`、`backups` 持久化目录，再执行全部已提交迁移，适用于一台全新的 Linux 服务器。

`npm start` 会以 Next.js 生产模式监听 `0.0.0.0:3000`。推荐交给 systemd、PM2 或同类进程管理器守护，并由 Nginx/Caddy 反向代理正式 HTTPS 域名。更新代码时执行：

```bash
git pull
npm ci
npm run db:deploy
npm run build
# 再由进程管理器平滑重启服务
```

首次部署前创建运行目录并保证运行服务的 Linux 用户拥有写权限：

```bash
mkdir -p public/uploads storage/private backups
```

不要在生产服务器运行 `prisma migrate dev` 或 `npm run dev`；前者只用于本地创建迁移，后者是开发服务器。

生产启动的核心命令是：

```bash
npm start
```

反向代理需要转发真实 IP（`X-Forwarded-For`）和 HTTPS。生产环境建议：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
```

- 把 `NEXT_PUBLIC_SITE_URL` 设为正式 HTTPS 域名。
- 使用支持持久化磁盘和 Node.js 长进程的平台（VPS、Docker、Railway Volume、Render Disk 等）。
- 将 `prisma/dev.db`、`storage/private`、`public/uploads`、`backups` 挂载为持久化目录。
- 使用专门的 SMTP 凭据，并由定时任务调用邮件处理接口。
- 在反向代理限制请求体大小，并对上传目录启用备份与恶意文件扫描。

## 主要目录

```text
app/                  前台、后台页面与 Route Handlers
components/public/    前台组件
components/admin/     CMS 组件
lib/                  数据库、认证、安全、邮件、i18n、CMS 配置
prisma/               Schema、迁移、Seed 与 SQLite
public/references/    用户提供的视觉参考素材
public/uploads/       公开媒体文件
storage/private/      私有询盘附件
backups/              SQLite 备份
```

## 发布前清单

- 修改所有示例公司联系方式、管理员密码与环境密钥。
- 配置 SMTP 并验证失败重试流程。
- 替换或确认所有参考图片的正式商用版权。
- 执行实际设备响应式、表单、权限矩阵和备份恢复验收。
- 配置隐私政策、Cookie/数据保留期限和目标市场法律文本。
