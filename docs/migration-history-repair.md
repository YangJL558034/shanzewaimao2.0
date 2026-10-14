# 现有 SQLite 迁移历史修复

本工具只处理已核验的 2026-10-14 版本：数据库结构已包含全部功能，但 Prisma 迁移账本缺少历史条目。它不是数据库升级、数据导入或重置工具。

## 先判断是否需要

在项目目录使用与生产服务完全相同的 `DATABASE_URL`；工具会加载现有 `.env`，不会输出密码。

```sh
node scripts/reconcile-migration-history.mjs --dry-run
```

默认只读。只有满足以下全部条件才允许补齐账本：

- 所有表、列、默认值、CHECK/外键约束、索引、视图和触发器的 SQL 定义，与 13 个已审核迁移构建的参考数据库完全一致（仅忽略 SQL 语句外空白和注释）。
- 数据库完整性与外键检查通过。
- 已有迁移均成功，名称和 SQL 校验和符合已审核历史；没有未知、失败、回滚或重复条目。
- 历史 SQL 与工具固定的审核校验和一致；未来新增迁移不会被自动纳入基线。

任何不满足都会退出，不会尝试删表、改字段、补业务数据。尚未升级到此完整结构的旧数据库，需要单独核对升级路径，不能强行使用这个工具。

## 明确采用当前业务内容

历史迁移含有修改 SEO、公司名称、产品规格及新闻状态的数据语句。当前内容可能已经被管理员更新，因此**不重新执行这些 SQL**，也不声称它们过去确实执行过。选择 `--adopt-existing-content` 表示维护者明确认可现有业务内容作为基线。

停掉站点进程及后台任务后执行：

```sh
node scripts/reconcile-migration-history.mjs --apply --adopt-existing-content
npx prisma migrate status
npx prisma migrate deploy
```

工具先用 SQLite 一致性备份保存真实数据库至 `storage/private/migration-history/`，再取得写锁重新核验。事务内只向 `_prisma_migrations` 补充缺失条目，`applied_steps_count=0`，日志记录 `baseline=true`、`policy=adopt-existing-content`、`sqlExecuted=false` 及操作编号。

提交前逐表逐字段计算业务内容摘要，与备份进行比对，证明客户、聊天、询盘、图片路径和内容等完全保留；任何变化都回滚。重复执行无副作用。新库正常运行原始 `prisma migrate deploy`，不需要这个基线工具。

备份旁的 JSON 审计记录不包含业务正文，记录结构摘要、各表行数及内容摘要。审计文件在提交前写入，标为 prepared；核对迁移账本中的同一 `operationId` 才能确认提交完成。备份含客户资料，不应上传 GitHub，也不能放进 `public/`。

## 验证

```sh
node scripts/check-migration-history.mjs
```

测试只读源数据库，在临时副本验证修复、拒绝漂移、幂等及 Prisma `status` / `deploy`；同时验证新库全部原始迁移可正常应用。不会运行 seed、reset，也不会将本地数据库覆盖到服务器。

迁移基线原理参考 [Prisma v6 官方 Baselining 文档](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/baselining)。此工具采用一次原子账本事务实现该机制，并加上适用于本项目的结构与内容保护。
