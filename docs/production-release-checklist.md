# Shanze 原项目生产发布检查清单

检查日期：2026-10-14。继续使用当前 Next.js / Prisma / SQLite 架构，不新建项目。

## 当前结论与已修复项目

不能把“Windows 构建通过”理解为“整目录直接覆盖 Linux 即可”。源码可以增量发布，但必须保留服务器数据，在 Linux 安装依赖、核对迁移并重新构建。

- 本次环境为 Windows、Node.js `v24.15.0`、npm `11.12.1`，没有可用 WSL 发行版/Docker，也未连接 Linux 服务器；尚未进行真实 Linux 运行验收。
- `node scripts/check-linux-imports.mjs` 检查源码/样式的本地静态导入大小写和缺失路径。动态路径、数据库内文件路径和服务器权限仍需在 Linux 验证。
- **生产依赖漏洞已修复：**升级至 Next.js 16.3.8、Nodemailer 10.1.1，保留现有 Next.js 16 / React 19 / Tailwind 3 架构。使用官方 npm registry 的 `npm audit --omit=dev` 为 0 项漏洞；Nodemailer 离线 MIME/收件人兼容检查不发送真实邮件。
- **构建依赖有明确残余风险：**完整 `npm audit` 仍报告 5 项 high，均来自 Tailwind 构建链的 `braces` 3.0.3 嵌套 AST 漏洞。上游尚无修复版，本项目通过安装时的固定版本/文件 SHA-256 校验补丁限制递归深度，构建前再检查补丁。没有伪造版本或隐藏 audit；这不是上游正式修复，应跟踪 [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)，不能宣称全依赖零漏洞。构建仍应只处理受信任源码。
- **本地迁移历史已安全补齐：**13 条源码迁移的完整结构与现库 96 个对象逐项一致后，先创建私有一致性备份，再仅补齐 12 条缺失账本记录。记录明确采用当前业务内容、没有执行历史 SQL；41 张业务表完整内容指纹前后一致，`prisma migrate status` 正常。此结果不代表服务器迁移记录也已修复。线上必须独立审核，见 [迁移历史修复说明](migration-history-repair.md)。
- **备份与恢复跟随真实数据库地址：**统一解析 `DATABASE_URL` 并核对 Prisma 实际连接；使用 SQLite 原生一致性快照包含已提交 WAL，不再直接复制数据库或删除 WAL/SHM。10 组隔离测试覆盖自定义路径、重复准备、WAL、恢复失败回滚及错库阻止。
- `storage:prepare` 现在加载 `.env*` 并保留环境变量优先级；数据库路径使用 Prisma 文件路径语义，`%20` 不会擅自解码。重复执行不会截断现有库。运行进程和部署命令仍必须指向同一个数据库。

生产模式回归结果见运行后生成的 `outputs/production-release-check.json`；这是隔离数据库副本上的检查，不是线上已经发布的证明。

## 网站内容一起发布

开发站后台填写的内容已导出为 `content/site-content.json`，包含完整新闻和博客正文、翻译、证书分类及图片关联。`npm run db:deploy` 在迁移成功后自动导入，`npm start` 也会检查；新站 Seed 改为初始化账号并加载实际内容。首次应用更新匹配的网站记录并保留运营数据，后续版本保留线上已修改的冲突记录，实际应用前自动生成私有 SQLite 快照。详见 [网站内容发布说明](website-content-release.md)。未来新的后台修改需先运行 `npm run content:export` 再提交。

## 可以更新与必须保留的文件

| 分类 | 发布规则 |
| --- | --- |
| `app/`、`components/`、`lib/`、`scripts/`、`docs/`、根目录配置 | 发布已审核的新增和修改源码，保持大小写；不是只复制几个页面文件 |
| `package.json` 与 `package-lock.json` | 一起更新，在目标 Linux 平台安装依赖 |
| `prisma/schema.prisma`、`prisma/migrations/` | 一起更新；完整保留迁移历史，不删除或重写线上已执行的迁移 |
| `public/generated/`、`public/company-profile/`、`public/optimized/`、`public/references/` | 包含本次正式素材与图片映射清单；只更新属于本次发布的文件，不能漏掉未跟踪文件 |
| `.env`、真实 SQLite 数据库及其 `-wal`/`-shm` 文件 | **保留服务器版本，禁止用本地文件覆盖** |
| `public/uploads/`、`storage/private/`、`backups/` | **持久化保留，不能覆盖或递归清空**；包含上传响应式图片、私有询盘附件及图片原件 |
| Windows `node_modules/`、`.next/`、`.npm-cache/`、`outputs/`、`work/` | 不作为 Linux 发布产物复制；目标环境重新安装/构建 |

本次完整提交包含业务源码、3 个新迁移目录以及 `public/generated/`、`public/company-profile/`、`public/optimized/`。发布时使用完整提交，而不是仅复制几个页面或省略新增素材。

`.gitignore` 有意排除 `.env`、`prisma/*.db*`、`public/uploads/*`、`storage/private/*`、`backups/*`。排除不等于可以删除，它们需单独备份。不要使用未经审核的 `rsync --delete` 或“清空目录后上传”。

图片优化中已落盘的数据库内容变化不会随源码自动同步到线上。`public/optimized/image-seo-manifest.json` 提供旧路径映射，但线上独有图片不一定在清单中；后续正常上传会自动优化。若需处理线上历史图片，先运行 `npm run images:optimize` 预览，在独立备份和内容确认后再决定是否 `--apply`，不要覆盖线上数据库来同步本地媒体记录。询盘附件和备份记录可能保存绝对路径，Windows 数据库尤其不能直接替换 Linux 运营库。

## 迁移审核要点

本次未读消息、客服统计和图表沿用现有表及 `ConversationMessage.readAt`，没有新增 schema。之前功能仍依赖以下迁移：

- `20261014000000_unified_customer_center`：客户、会话、消息表。
- `20261014010000_conversation_public_token`：官网续聊令牌及历史值回填。
- `20261014020000_certificate_categories`：证书分类及旧记录初始分类。

另外两条历史 SEO 迁移不是纯结构变更：`20260919093000_seo_data_cleanup` 会修改公司/邮箱/站址、部分产品规格和新闻状态；`20260919100000_refresh_public_seo` 会修改公开 SEO/文案。若服务器尚未执行，必须审核实际受影响记录，不能未经确认宣称迁移不改内容。迁移是否已经执行，要以服务器的记录为准，不能只看本地库。

## Linux 发布步骤（维护者核对服务器状态后）

先确认实际项目目录、服务名称、数据库地址及运行用户。留存旧源码/锁文件、数据库一致性快照及持久化目录备份。迁移窗口暂停会写库的业务进程和邮件调度器，避免在同一运行目录构建时继续使用旧 `.next`。

以下命令在**已确认的现有项目根目录**执行。不要直接沿用 README 中针对全新安装的 `.env` 复制或 Seed 步骤。

```bash
node --version
npm --version

# 使用锁文件安装，并保留构建所需开发依赖及平台可选依赖。
npm ci --include=dev
node scripts/patch-build-dependencies.mjs --check
npm audit --omit=dev

# 只读核对；若记录不一致，停止，不执行下面迁移。
npx prisma migrate status
# 若历史缺失，先停止正常部署流程，阅读迁移历史修复说明。
# npm run db:history:check 只读检查，不会自动采用当前内容或写入账本。

# 仅在历史一致、数据变更已确认、真实数据库已备份后执行。
# DATABASE_URL 来自环境或 .env，必须与生产服务一致。
npm run db:deploy
npm run build

# 在正式切换前，可用隔离端口做进程启动检查。
npm start -- --port 3100
```

`npm ci`/构建中的 `prisma generate` 必须在目标 Linux 上执行，不能复用 Windows Prisma 查询引擎。锁文件已包含 Linux glibc/musl、x64/arm64 的 Next SWC 和 Sharp/Libvips 可选依赖；不要使用 `--omit=optional`。实际 CPU、libc/OpenSSL、文件权限和原生模块加载以服务器实测为准。

要求 Node.js 22.16+（22 LTS）或 24+，推荐 24 LTS；早期版本缺少 SQLite 一致性备份 API。Linux 路径使用 `file:/srv/shanze/data/site.db` 或相对 `prisma/` 的 `file:../data/site.db`，不要复制 Windows 路径或使用 `file://` URL。

若 `.env` 是唯一数据库配置来源，Next.js、Prisma 和存储准备命令会加载它；服务管理器显式注入的同名变量优先。不要盲目 `source .env` 执行未知内容，也不要把新数据库路径当成绕过迁移冲突的方法。不要在日志输出密钥。构建补丁由 `postinstall` 执行，`build` 会校验；不要使用 `--ignore-scripts` 跳过安装安全步骤。

构建、迁移和独立端口检查全部通过后，按现有 systemd/PM2 配置重启原服务，不能凭空假定服务名称。保留既有 Nginx/Caddy 配置，不把 3000 端口直接开放到公网；HTTPS 代理需保留 Host、X-Forwarded-Host、X-Forwarded-Proto 和真实 IP。聊天 SSE 路由需关闭响应缓冲并允许长连接；不能把聊天接口错误地缓存。

## 上线验收与回退

- 前台：首页、关于、产品列表/详情、工厂、品质、新闻/博客、联系/询盘、Cookie 中英文、旧 SEO 落地页、Sitemap。
- 图片：旧素材和 WebP/响应式版本返回 200；新图片上传生成 WebP；证书原件和 PDF 下载仍可用；上传目录由实际运行用户可写。
- 客服：访客提交入库、后台侧栏/铃铛未读计数、打开并阅读才清除已显示消息、并发新消息保持未读、回复传回前台、手机显示；今日/历史统计按上海时区。
- 权限：无客服权限不暴露客服数量/客户详情；未登录接口拒绝；POST 已读/回复校验 CSRF；原产品/新闻/CRM/媒体管理仍工作。
- 外部服务：SMTP、WhatsApp/Crisp、真实病毒引擎和 Google 配置需用服务器配置分别验收；本地隔离测试不证明外部投递已成功。
- 安全：修改默认管理员密码；保持原生产 `APP_SECRET`，不可随意轮换导致已加密 SMTP 配置无法解密；解决依赖漏洞并检查正式 HTTPS/Cookie。
- 回退：保留旧发布源码和锁文件；若已运行迁移，不可只恢复旧代码或套用开发库。恢复前停止写入，由维护者选择匹配的代码/数据库快照并核对迁移版本，保护迁移后新增的客户与消息。

禁止在生产更新时运行 `npm run db:seed`、`prisma migrate dev`、`prisma migrate reset`、`prisma db push --force-reset`，也禁止用本地 `prisma/dev.db` 或 `.env.example` 覆盖服务器数据与密钥。
