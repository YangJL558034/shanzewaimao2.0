# 山泽新能源科技 / Shanze New Energy Technology B2B 官网与 CMS

这是一套面向国际 B2B 制造业的完整 Next.js 官网与后台管理系统。前台内容来自 SQLite 数据库，后台通过 Prisma 执行真实 CRUD，并包含 Session 认证、RBAC、询盘 CRM、SMTP 邮件队列、媒体管理、操作审计、回收站和数据库备份。

## 技术栈

- Next.js 16（App Router）+ React 19 + TypeScript
- Tailwind CSS + 响应式、无障碍与图片优化
- SQLite + Prisma ORM
- bcrypt 密码哈希、自建服务端 Session、RBAC
- Nodemailer SMTP 队列与指数退避重试
- Zod 服务端校验、CSRF、持久化 Rate Limit、安全 Headers

## 本地启动

要求 Node.js 22.16+（22 LTS）或 24+，生产服务器推荐 Node.js 24 LTS。数据库一致性备份与恢复使用内置 `node:sqlite.backup`，不要使用 Node.js 20 或早期 22/23 版本部署。已有站点更新请先阅读 [发布检查清单](docs/production-release-checklist.md)，不要用开发数据库覆盖线上数据。

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

## 统一客服中心与海外渠道

后台「客户与邮件 → 统一客服中心」会将官网询盘、Email、WhatsApp Business、LinkedIn 与 Crisp Live Chat 的客户消息按邮箱或手机号归并为同一客户会话。销售可分配负责人、设置待处理/等待客户/已解决状态，并保留完整消息历史；官网询盘会自动同步到该中心和原有询盘 CRM。

官网点击右侧 **Live Chat** 开始沟通。首次填写姓名和邮箱后，后续只需发送消息；同一浏览器、同一网站地址刷新或关闭窗口后仍可恢复会话。前台通过认证的 SSE 连接接收销售回复（服务器每 2 秒检查变更），连接中断时自动重连并使用 5 秒轮询恢复，内部备注不会对访客公开。聊天窗收起后继续接收消息，显示未读数量和回复摘要；客户打开窗口阅读时发送已读回执，CRM 中可查看“客户已读”。读取与续聊均需要独立会话凭证，凭证不放在 URL 中。

移动端默认只显示 48px 客服图标，点击才展开紧凑联系渠道。聊天窗口限制在屏幕可见高度的 74% 以内，消息区独立滚动，输入栏固定底部；公司和电话折叠为可选资料，键盘打开时窗口跟随可见区域调整。

在「系统管理 → 客服渠道配置」(`/admin/customer-channels`) 设置管理员通知邮箱和销售通知邮箱（多个销售地址用逗号分隔）。每条访客消息都会创建通知邮件，重复收件人自动去重；通知地址不会暴露给前台。SMTP 必须在 `/admin/smtp` 配置并测试成功后才能真实投递；未配置时任务保持在邮件队列，配置完成后由现有邮件调度器自动处理。

本地联动验证：保持开发服务运行，执行 `node scripts/check-live-chat.mjs`。该检查覆盖 CRM 询盘创建、续聊鉴权、实时回复流、已读回执、内部备注隔离和管理员/销售通知去重，结束后清理测试数据。为避免发送测试通知，仅允许在未配置 SMTP 的本地实例执行。

在 `.env` 中设置以下变量后即可启用外部入口：

```env
NEXT_PUBLIC_CRISP_WEBSITE_ID="your-crisp-website-id"
CRISP_WEBHOOK_SECRET="a-long-random-secret"
CRISP_WEBSITE_ID="your-crisp-website-id"
CRISP_IDENTIFIER="crisp-rest-api-identifier"
CRISP_KEY="crisp-rest-api-key"
NEXT_PUBLIC_WHATSAPP_NUMBER="8613800000000"
WHATSAPP_VERIFY_TOKEN="a-random-verify-token"
WHATSAPP_APP_SECRET="meta-app-secret"
WHATSAPP_ACCESS_TOKEN="meta-permanent-access-token"
WHATSAPP_PHONE_NUMBER_ID="meta-phone-number-id"
WHATSAPP_GRAPH_API_VERSION="vX.Y"
NEXT_PUBLIC_LINKEDIN_URL="https://www.linkedin.com/company/your-company/"
LINKEDIN_WEBHOOK_SECRET="a-long-random-secret"
INBOUND_EMAIL_WEBHOOK_SECRET="a-long-random-secret"
```

将各服务商或中间件的入站 Webhook 指向 `POST /api/webhooks/crisp`、`/api/webhooks/whatsapp`、`/api/webhooks/linkedin` 或 `/api/webhooks/email`。除 WhatsApp 外，Webhook 使用 `x-shanze-webhook-secret`；WhatsApp 使用 Meta 的 `x-hub-signature-256` 签名，并通过 `GET /api/webhooks/whatsapp` 完成验证。未配置密钥的入口会拒绝请求。配置 Crisp REST 网站令牌或 WhatsApp Cloud API 凭据后，销售在统一客服中心发送的回复会直接外发；未配置 WhatsApp Cloud API 时会安全降级为官方 click-to-chat。

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

## 后台安全中心

后台导航已整理为常用入口和折叠菜单，桌面支持展开/收起，移动端使用抽屉菜单。「安全与数据 → 安全中心」(`/admin/system`) 替代原系统状态；「用户与权限」仍在 `/admin/security`，两者功能独立。

安全中心集成 [ClamAV](https://github.com/Cisco-Talos/clamav) 的 ClamD INSTREAM 协议及本地 `clamscan`，Windows 可使用已启用的 Defender 检测模式。参考 [OWASP 文件上传规范](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) 执行上传白名单、文件头验证、脚本扩展名检查和上传前病毒扫描。没有可用病毒引擎时只进行文件规则和 SHA-256 完整性检查，报告显示「部分完成 / 病毒未检测」，不会将规则检查等同于杀毒。

检查范围固定为网站 `app/`、`components/`、`lib/`、`scripts/`、核心配置与迁移文件，以及 `public/uploads/`、`storage/private/`。不扫描主机其他目录、`.env`、数据库、依赖目录或用户提供的任意路径；符号链接跳过并记录风险。单次默认最多 1000 个文件、单文件 40MB、运行 90 秒，未覆盖项如实记录。结果和可信源码基线保存在私有数据库设置中，操作写入审计日志；不会自动删除或隔离原文件。

Linux/VPS 可按 [官方 Docker 文档](https://docs.clamav.net/manual/Installing/Docker.html) 启动引擎：

```bash
docker run -d --name shanze-clamav -p 127.0.0.1:3310:3310 --mount source=shanze-clamav-db,target=/var/lib/clamav clamav/clamav:stable
```

设置 `CLAMAV_HOST=127.0.0.1`、`CLAMAV_PORT=3310`，首次病毒库更新完成后在后台刷新引擎状态；不要把 ClamD 无认证端口暴露到公网。如使用本地命令行，安装 `clamscan`、执行 `freshclam` 更新病毒库，并配置 `CLAMAV_BINARY` 的完整路径。引擎连接验证成功后可以启用 `ANTIVIRUS_REQUIRE_CLEAN=true`：任何未扫描完成、超出限制或命中病毒的媒体/询盘附件都会拒绝上传；默认 `false` 为监测模式，病毒命中仍始终阻止上传。

首次建立源码基线需确认当前代码可信；部署更新后检查变更，再手动接受新基线。基线只保存源码指纹，不将上传文件视为可信代码；询盘附件还会与上传时保存的 SHA-256 比较。

本地验证命令：

```bash
node --import tsx scripts/check-antivirus.mjs
node scripts/check-security-center.mjs
node scripts/check-admin-ui.mjs
```

第一项使用内存中的模拟 ClamD 验证协议，不生成恶意文件，不代表真实病毒库扫描。第二项仅用于没有可用杀毒引擎、没有其他同时操作的本地实例，临时建立并还原测试源码基线。第三项用独立临时 Chrome/Edge 配置验证桌面侧栏与 390px 移动抽屉，截图保存在 `outputs/`，不读取用户浏览器会话。生产部署前仍需对真实引擎、病毒库更新和正式运行权限做验收。

## SMTP 配置

推荐直接登录后台，打开“系统管理 → 邮件服务器”（`/admin/smtp`），填写 SMTP 服务器、端口、邮箱账号、授权密码、发件人和“询盘最终收件邮箱”。授权密码会使用 `APP_SECRET` 派生密钥加密后保存，不会在后台接口中返回明文。系统每分钟自动重试待发送或失败邮件。

也可以使用环境变量作为未配置后台设置时的默认值：

```env
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="website@example.com"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="Shanze New Energy Technology Website <website@example.com>"
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

以下仅用于**没有任何现有业务数据的全新安装**，不要在更新已有站点时复制 `.env` 或执行 Seed。Linux 云服务器首次克隆后，使用生产迁移和生产启动命令：

```bash
npm ci --include=dev
cp .env.example .env
# 编辑 .env，设置正式域名、随机密钥、管理员初始账号和 SMTP
npm run db:deploy
npm run db:seed
npm run build
npm start
```

`npm run db:deploy` 会先创建 SQLite 文件及 `public/uploads`、`storage/private`、`backups` 持久化目录，再执行全部已提交迁移，适用于一台全新的 Linux 服务器。

`npm start` 会以 Next.js 生产模式监听 `0.0.0.0:3000`。推荐交给 systemd、PM2 或同类进程管理器守护，并由 Nginx/Caddy 反向代理正式 HTTPS 域名。**更新已有站点前**，按 [发布检查清单](docs/production-release-checklist.md) 备份真实数据库和持久化文件、安排维护窗口；迁移历史不一致时先停止部署并阅读 [迁移修复说明](docs/migration-history-repair.md)。核对通过后：

```bash
git pull --ff-only
npm ci --include=dev
npx prisma migrate status
# 历史不一致或待执行迁移含未确认的数据改写时，停止；不要继续下面命令。
npm run db:deploy
npm run build
# 再由进程管理器平滑重启服务
```

首次部署前创建运行目录并保证运行服务的 Linux 用户拥有写权限：

```bash
mkdir -p public/uploads storage/private backups
```

不要在生产服务器运行 `prisma migrate dev` 或 `npm run dev`；前者只用于本地创建迁移，后者是开发服务器。

安装时会对构建依赖 `braces` 应用固定校验和的本地安全补丁，构建前再次校验。完整 `npm audit` 仍会显示未获上游修复的开发依赖告警，详见发布检查清单；不要使用 `--ignore-scripts` 绕过检查。部署不需要重新生成图片，正式素材已在 `public/`。如自行重建生成图片，可通过 `GENERATED_IMAGES_DIR` 指定原图目录，默认读取 `work/generated-images/`，原图不随源码提交。

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

### 海外 B2B SEO 与行业博客

正式域名为 `https://shanzesz.com`。`NEXT_PUBLIC_SITE_URL` 必须使用公网 HTTPS，localhost、局域网与无效配置不会进入 canonical、Schema 或 Sitemap。英文为默认抓取内容；现有 Cookie 语言切换不具备独立语言 URL，因此不虚构 hreflang。以后为更多国家建站时应先建立可抓取的语言目录，再配置 hreflang。

核心采购入口为 `/power-bank-manufacturer`、`/magnetic-power-bank-oem`、`/wireless-charger-manufacturer`、`/custom-power-bank-supplier`；原七个落地页保持兼容。产品保留真实规格和 CMS SEO 覆盖，RFQ 网站不虚构 Offer、价格、评分或认证。FAQ 与结构化数据匹配可见内容，不保证 Google 展示 FAQ 或产品富结果。

`/blog` 复用后台“博客与新闻”和“文章分类”，支持分类、搜索、分页、目录、相关推荐及中英文。`industry-insights`、`industry-guides`、`oem-guides`、`buying-guides` 分类发布到博客，其余发布到新闻。正文支持安全 Markdown 子集（`##`、`###`、列表、粗体、链接），不用 HTML。旧新闻路径的行业文章返回永久重定向到 `/blog/{slug}`。草稿不公开，noindex 不进入 XML Sitemap，筛选/搜索页禁止索引。

在现有数据库增量导入四篇原创中英文采购指南与唯一的初始页面元数据：

```bash
npm run seo:seed
```

脚本仅新增缺失文章，保留自定义 SEO、已有文章及翻译；仅升级已知的重复初始描述。原页面元数据备份在 `outputs/seo-metadata-backup-*.json`。不会自动发订阅邮件。不要用全量 `db:seed` 覆盖正在运营的数据库。

Google 配置入口：后台“网站内容 → Google 与 SEO 配置” (`/admin/seo-tools`)。需要 `seo.read/seo.write` 权限；保存操作有 CSRF 和审计。

1. GA4 创建网站数据流，填入 `G-...` 衡量 ID。关闭该数据流的“增强型衡量”和用户提供的数据收集，避免自动历史变更导致重复 page_view、自动表单/搜索/外链采集携带客户数据。本站手动记录不含 query/hash 的页面浏览以及 `generate_lead`、`chat_started`、`chat_message_sent`、`contact_click`、`catalog_click`；可把 `generate_lead` 设为关键事件。渠道点击不代表外部平台已收到客户消息。
2. Search Console 添加 `https://shanzesz.com/` **URL 前缀资源**，将 HTML 标签的 `content` token 填入后台并在正式上线后验证；完整“域名资源”只能通过 DNS 验证。提交 `https://shanzesz.com/sitemap.xml`，使用网址检查工具检查核心页面。此代码不自动创建 Google 账号、不写 DNS，也不宣称已验证或被收录。
3. 可使用环境变量 `NEXT_PUBLIC_GA4_MEASUREMENT_ID` 和 `GOOGLE_SITE_VERIFICATION`。后台一旦保存则优先于环境变量，保存空值可关闭接入。GA4 仅生产环境、Cookie 同意且未启用 Do Not Track 时加载，后台和取消订阅页面不统计；可在页脚撤回同意。

检查命令（需要本地网站运行）：

```bash
npm run seo:test
npm run seo:audit
```

生产 GA4/CSP 浏览器回归可在 `npx next build` 后运行 `npm run seo:browser`（需要 Chrome/Edge；可设置 `SEO_TEST_BROWSER`）。测试使用独立 SQLite 副本、隔离浏览器并拦截 Google 请求，不修改正式接入配置，不发送真实 Google 统计。

品牌更名的公开 CMS 文案增量工具：`npm run brand:rename` 默认只读预览，`npm run brand:rename -- --apply` 在备份后替换旧中文公司名及旧英文品牌；保留域名、邮箱、身份标识和 CRM/聊天/审计记录。备份位于 `outputs/brand-backups/`。图片内嵌文字需另行更新源图片。

公司资料已按用户提供的 2026 年公司简介整理在 `lib/company-profile.ts`：发展历程为 1999/2003/2014/2022，区分技术积累与品牌落地；不把 1999 认定为当前法人登记日期。27 年为资料截至 2026 年的描述，不是自动更新的公司经营年限。首页、关于页、工厂页使用一致数据；不保留资料未提供的示例面积、月产量和出口数量。

当前资料维护入口为后台页面管理的对应区块及中英文翻译。增量导入先用 `npm run company:import` 预览；确认后用 `npm run company:import -- --apply --source "公司简介 PDF 的绝对路径"`，会在 `outputs/company-profile-backups/` 保存原记录后事务更新，不改客户、聊天、账号、联系方式或客服渠道。`npm run company:test` 核对内容；`node scripts/check-admin-ui.mjs --company` 核对中英文、桌面与移动展示。`public/company-profile/` 照片为源 PDF 的未修改提取图片；历史客户标识仅按资料展示，不宣称当前合作或背书。

SEO 审计 JSON 保存于 `outputs/seo-audit-after.json`，检查 HTTP、唯一标题/描述、单一 H1、生产 canonical、ALT、JSON-LD 与 Sitemap。开发服务器测试不代表公网部署或 Google 收录验收。持续补充实际产品照片、准确测试报告、真实客户案例，并在 Search Console/GA4 跟踪自然搜索与询盘转化；已有示例新闻和产品认证文案需要运营人员核实，不能将种子示例当作实际获证证据。

### 认证资料与分类轮播

后台“产品与制造 → 认证资质与证书照片” (`/admin/certificates`) 支持“管理体系 / 产品认证与报告”分类、分类筛选、图片/原文件上传、排序及显示开关。分类保存在数据库，前台 `/quality` 按保存的分类分组，不再由 ISO 名称强制覆盖。所有开启显示的条目都会出现：没有图片时用资料名称占位，不伪造证书图或获证状态。桌面按四列宽度显示，平板两列、手机单张可滑动；两组均可左右切换和自动轮播，悬停、键盘聚焦、大图预览及减少动态偏好会暂停自动切换。到期日期保留在后台与原图中，前台不额外展示过期提示框。

源 PDF 第 19–20 页的证书与产品资料原图位于 `public/company-profile/`。ISO 9001/14001/45001 按证书正文匹配，不沿用幻灯片中互换的标题；PSE 文件为第 1/2 页，3C 为标识与查询码图，不作为完整证书。资料未提供 CE、FCC、UN38.3 原件，相关后台条目保留。可运行 `npm run certificates:import` 预览增量导入；`--apply` 会备份目标记录后导入，不要对运营数据库执行全量 seed。重新导入源资料会更新对应资料字段，后期人工维护的文件应以后台记录为准。

正常部署通过 `prisma migrate deploy` 应用 `20261014020000_certificate_categories` 后重新生成 Prisma 客户端。仅旧本地 SQLite 存在迁移历史缺口时，使用 `npm run certificates:migrate` 预览、`npm run certificates:migrate -- --apply` 备份并增量添加分类；确认成功后执行 `npx prisma migrate resolve --applied 20261014020000_certificate_categories` 记录本次迁移，再运行 `npx prisma generate`。该工具不重置数据库、不覆盖已有分类，不处理其他迁移的历史差异。

回归：`npm run certificates:test` 核对分类、图片、无图占位和后台日期；`npm run certificates:browser` 使用隔离 Chrome/Edge 检查后台新增/编辑/分类筛选、API 约束、四列布局、自动切换、手机触摸滑动和大图预览。浏览器测试只清理自己创建的临时账号及测试资料，不修改已有记录。

实现依据：[Google SEO 入门指南](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)、[GA4 手动页面浏览](https://developers.google.com/analytics/devguides/collection/ga4/views)、[Search Console 验证方法](https://support.google.com/webmasters/answer/9008080)。

客服浮窗只保留在线聊天、WhatsApp、LinkedIn 和邮件四个入口，目录下载仍可通过网站原有入口与后台配置维护。电脑按住顶部把手或渠道卡片拖动，手机按住把手拖动；支持任意方向，松手后保持高度并自动吸附到屏幕右侧，范围自动避让隐私提示及手机键盘。右上角关闭会隐藏整个浮窗，本次客户端换页不会重新弹出；刷新页面恢复默认位置。聊天窗口的减号仅用于最小化，关闭浮窗不会删除聊天记录。隐私提示与页脚偏好入口使用服务器当前语言，中英文分别完整显示，保留既有统计同意机制。`npm run support:browser` 使用独立浏览器验证鼠标/触摸拖动、右侧吸附、关闭/换页/刷新恢复、两种语言和隐私提示避让，不发送聊天消息或 Google 统计。

- 修改所有示例公司联系方式、管理员密码与环境密钥。
- 配置 SMTP 并验证失败重试流程。
- 替换或确认所有参考图片的正式商用版权。
- 执行实际设备响应式、表单、权限矩阵和备份恢复验收。
- 配置隐私政策、Cookie/数据保留期限和目标市场法律文本。

### 图片自动优化与图片 Sitemap

后台普通图片上传会自动生成 WebP、英文文件名与替代文字（ALT）。产品图优先使用当前编辑表单的英文 slug，其余图片使用名称或页面标题作为主题，不把相机编号或本地文件名当成图片描述。单图上传前可填写真实 ALT；产品图库里的图片说明可逐张编辑。后台“媒体文件”上传也支持自定义显示名称与 ALT。文档与视频保持原格式；证书预览上传保留高清文字细节，证书原文件不会转成普通图片。图片压缩不改变页面已有卡片尺寸、每排数量或布局。

已有图片通过 `public/optimized/image-seo-manifest.json` 的映射使用优化版本，后期公开上传自动进入同一图片信息流程。页面分享图与 `/sitemap.xml` 优先指向映射后的公开图片。图片 Sitemap 从已发布产品的封面、悬停图、图库，以及文章封面、已发布横幅、开启显示的页面区块与区块图片、设备、车间和认证图片动态生成。每页图片去重并限制为 1,000 张；不会收录私有媒体、视频、PDF、草稿、隐藏记录或 noindex 详情页，也不新增后台尚无公开路由的页面。更新内容无需手工维护 XML。Google 图片收录仍取决于实际公网可抓取性与 Search Console 的处理结果。

历史文件批处理：`npm run images:optimize` 默认只读预览；`npm run images:optimize -- --apply` 保存记录备份后更新引用，不删除原图。备份与来源指纹位于 `outputs/image-seo-backups/`，部署时同时保留 `public/optimized/`、`public/uploads/optimized/` 和数据库。后台新上传无需运行此命令，原件另存于非公开的 `storage/private/image-originals/`，请纳入服务器备份。SVG 矢量图、网站图标与 PDF/视频不强制转换；外部图片地址不自动抓取。

照片最大长边 1920px，不放大或裁切；证书保留原分辨率并使用高质量 WebP 预览，原文件下载不变。自动生成 320/640/960/1440/1920px 中小于原图的响应式版本，由 `srcset`/`sizes` 按屏幕和像素密度选择。首屏图优先加载，其余图片默认懒加载；保留透明度和支持的动画帧并移除 EXIF/GPS。英文文件名和 ALT 根据表单主题/slug/名称生成，不是图像内容识别；不同角度、型号和细节仍可填写准确描述。回归测试：`npm run images:test`。
