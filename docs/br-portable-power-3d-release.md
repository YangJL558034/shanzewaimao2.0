# BR 便携储能电源 3D 展示 / 独立站发布说明

适用提交：`fd2bf97`（feat(products): BR portable power 3D viewers, landing page and per-model specs）

本文件是给**在服务器上执行发布的执行方（人或 AI）**的操作手册。请完整读完再动手；本仓库的通用规则见 [生产发布检查清单](production-release-checklist.md) 与 [网站内容发布说明](website-content-release.md)。

---

## 1. 本次发布改了什么

| 类型 | 内容 |
| --- | --- |
| 新增页面 | `/portable-power` 便携储能落地页（两型号 3D 卡片、双列参数表、咨询 CTA） |
| 新增静态页 | `/3d/sz68dbgb23.html`、`/3d/sz68dbgb26.html`（各约 1MB，three.js 已内联，完全离线） |
| 新增素材 | `public/portable-power/` 下 9 张 webp |
| 新增代码 | `lib/product-3d.ts`（SKU → 3D 文件约定）、`lib/product-categories.ts`（分类 → 独立页映射）、`components/public/header-nav.css` |
| 修改代码 | 产品中心导航二级菜单、产品卡片链接、目录卡片等高对齐、`proxy.ts` 的 `/3d/` 安全策略 |
| 内容包 | 新增两款产品（SZ68DBGB26 / SZ68DBGB23）、便携式储能分类的名称/描述/slug、对应中英文翻译 |
| 数据库结构 | **无变化，无新增迁移** |
| 依赖 | **无变化**（`package.json` / `package-lock.json` 未改） |

**关键结论：本次不需要执行任何数据库迁移，也不会改动已有业务表结构。**

---

## 2. 执行前必须确认的事

1. **确认工作目录**：服务器上的仓库根目录（含 `package.json`、`prisma/`、`content/`）。
2. **确认没有未提交的本地改动**：
   ```bash
   git status --porcelain
   ```
   若有输出（尤其是有人改过源码），**停止并报告**，不要 `git reset --hard` 或 `git stash drop`。
3. **确认迁移状态**：
   ```bash
   npx prisma migrate status
   ```
   预期：`Database schema is up to date!`。若显示有待执行/历史不一致，**停止**，改读 [迁移历史修复说明](migration-history-repair.md)。
4. **确认「便携式储能」分类的 slug**（决定导入行为，见第 4 节）：
   ```bash
   sqlite3 prisma/dev.db "select slug,name from ProductCategory where name like '%portable%' or name like '%储能%' or slug like 'portable%';"
   ```
   若 `sqlite3` 不可用，可在后台「产品中心 → 产品分类」页查看 Slug 列。

---

## 3. 备份（不可跳过）

```bash
STAMP=$(date +%F-%H%M)
mkdir -p ~/backup
# 数据库：用仓库自带的一致性快照，不要直接 cp 正在写入的 db 文件
cp -a prisma/dev.db ~/backup/dev.db.$STAMP
cp -a prisma/dev.db-wal ~/backup/dev.db-wal.$STAMP 2>/dev/null || true
cp -a prisma/dev.db-shm ~/backup/dev.db-shm.$STAMP 2>/dev/null || true
# 持久化目录
tar czf ~/backup/persist.$STAMP.tgz storage/private public/uploads backups 2>/dev/null || true
ls -lh ~/backup | tail -5
```

`.env`、`prisma/*.db*`、`public/uploads/*`、`storage/private/*` 都在 `.gitignore` 中，`git pull` 不会覆盖它们；但备份仍然必须做。

---

## 4. 升级步骤

```bash
git pull --ff-only
npm ci --include=dev
npx prisma migrate status      # 应为 up to date

# 4.0 先预览内容导入（只读，不写数据库），确认 created / updated / skipped / conflicts
npm run content:preview

npm run db:deploy              # storage:prepare → migrate deploy → 导入 content/site-content.json
npm run build
# 重启进程（按实际使用的管理器，二选一）
pm2 restart <应用名>
# systemctl restart <服务名>
```

`content:preview` 输出示例与判读：

```json
{ "mode": "preview", "created": 2, "updated": 19, "skipped": 340, "conflicts": [] }
```

- `created`：内容包里新增、线上没有的记录（本次预期包含两款 BR 产品、便携式储能分类）
- `updated`：线上已有且将被覆盖为内容包版本的记录
- `skipped`：内容未变化，无需处理
- `conflicts`：线上在最近一次导入后被人工修改过，**会被保留并跳过**。若这里有输出，先确认这些线上修改要不要保留，不要把 `conflicts` 当成错误

`npm run db:deploy` 在导入内容前会把一致性快照写入 `storage/private/content-release-backups/`，每个版本都留有回滚点。

### 4.0.1 导入是增量操作，不会删除线上数据

导入实现（`scripts/lib/content-release.mjs`）**只有 INSERT 与 UPDATE，没有 DELETE**：

- 线上有、内容包里没有的记录（例如运营在后台新增的其它产品、新闻、页面）→ **不做任何操作，原样保留**
- 内容包里有、线上也有（按 `Product.slug`／`Product.sku`、`ProductCategory.slug` 等键匹配）→ 更新
- 线上最近一次导入后被人工改过的同名记录 → 跳过并记录到 `conflicts`
- 写入前执行 `PRAGMA foreign_key_check`，关联失败会整体回滚

因此「线上已有其它产品」不会因本次发布而丢失。唯一需要注意的是排序：本次内容包把两款 BR 产品设为 `sortOrder 1、2`，其余已知产品为 3–12；**线上独有的产品保留它们自己的排序值**，可能与这些数字交叉。若在后台看到顺序不理想，直接在「产品管理 → 排序」里调整即可，不涉及数据丢失。


### 4.1 分类 slug 的三种情况

内容包里「便携式储能」分类的 slug 是 **`portable-power`**，导航下拉和 3D 落地页的映射都依赖这个值。

| 线上现状 | 结果 | 需要做什么 |
| --- | --- | --- |
| 没有该分类 | 自动新建，slug=`portable-power` | 无 |
| 已有且 slug=`portable-power` | 更新名称/描述 | 无 |
| 已有但 slug 不同（例如 `portable-power-copy-163224`） | **会多出一个分类** | 导入前先在后台把旧分类删除，或把它的 slug 改为 `portable-power` 后再导入 |

若导入后才发现重复：在后台删除 slug 不是 `portable-power` 的那个，产品关联会随分类删除策略影响，删前先确认该分类下没有产品（本次两款产品都在 `portable-power` 分类下）。

---

## 5. 验收（必须逐项通过）

| # | 检查 | 预期 |
| --- | --- | --- |
| 1 | `curl -o /dev/null -w '%{http_code}' https://<域名>/portable-power` | `200` |
| 2 | `curl -o /dev/null -w '%{http_code}' https://<域名>/3d/sz68dbgb26.html` | `200`，响应体约 1MB |
| 3 | `curl -s https://<域名>/3d/sz68dbgb26.html \| grep -c 'Content-Security-Policy'` | 头部含 `script-src 'self' 'unsafe-inline'`（仅此路径） |
| 4 | 打开 `/products` | BR 两款（SZ68DBGB26、SZ68DBGB23）排在最前，「查看详情」跳到 `/3d/…?lang=…` |
| 5 | 打开 `/portable-power` | 两张卡片内嵌 3D：自动旋转、每 2 秒换色、有「拆解/复原」按钮，「查看详细」可跳转 |
| 6 | 打开 `/3d/sz68dbgb26.html?lang=zh` 与 `?lang=en` | 中文页全中文、英文页全英文（仅语言下拉里的「简体中文」保留母语写法） |
| 7 | 首页其它页面 | `/`、`/about`、`/quality`、`/news` 均 200，CSP 仍为 `nonce + strict-dynamic` |
| 8 | 后台「产品分类」 | 便携式储能只有一个，slug = `portable-power` |
| 9 | 后台「产品管理」总数 | **不少于**升级前数量（线上原有产品未丢失），且能看到 2 款新 BR 产品 |
| 10 | `npm run content:preview` 再跑一次 | `created: 0`、`conflicts: []`，说明本次已全部落实 |

第 5 项用浏览器实际打开确认；`/portable-power` 首次加载会请求两个约 1MB 的 iframe（`loading="lazy"`），属正常。

---

## 6. 回滚

```bash
git log --oneline -3                 # 找到上一个提交（应为 e79ab73）
git reset --hard e79ab73
npm ci --include=dev
npm run build
pm2 restart <应用名>
```

数据库内容回滚（仅当内容导入造成问题时）：

```bash
ls -lt storage/private/content-release-backups/ | head
# 用导入前生成的那份快照覆盖当前库，再重启
```

注意：回滚代码**不会**自动回滚内容包导入的产品/分类记录；如需一并回滚，用上面的快照恢复数据库。

---

## 7. 执行方的硬性约束

- 不得覆盖或删除服务器上的 `.env`、`prisma/dev.db*`、`public/uploads/`、`storage/private/`、`backups/`。
- 不得使用 `rsync --delete`、`rm -rf` 清空站点目录。
- 不得运行 `prisma migrate dev`、`npm run dev`。
- 不得使用 `content:import --force-content` 覆盖线上内容，除非明确得到授权（该操作会先存快照，但会覆盖线上人工修改）。
- 遇到迁移历史不一致、`git pull` 非快进、构建失败中的任意一种，**停止并把完整报错贴回**，不要自行重置仓库或重建数据库。
- 本次发布不涉及 schema 变更；如果发现系统提示有待执行迁移，说明服务器版本与预期不符，先核对 `git log -1` 提交号。
