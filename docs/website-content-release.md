# 网站内容随 GitHub 发布

`content/site-content.json` 保存开发站当前填写的网站内容：页面和区块、首屏背景、产品与分类、工厂设备、车间、证书、新闻、行业博客、SEO、导航、公开网站设置、邮件文案及对应翻译。发布/草稿、显示开关、分类、排序、日期、图片和完整正文一并保留。

引用的本地图片和公开文件有 SHA-256 校验。`public/generated/`、`public/optimized/`、`public/company-profile/` 和 `public/references/` 随仓库提供；上传目录中仍被引用的文件会复制到可提交的 `public/content-assets/`，引用同步改成可移植地址。不会依赖开发机路径。

账号、密码、Session、客户、询盘、聊天、订阅者、访问记录、审计、邮件队列、SMTP 密钥、私有附件及运维配置不在这个内容包中。已有服务器的这些数据保持原样。

## 新站部署

配置服务器自己的 `.env` 后执行：

```sh
npm ci --include=dev
npm run db:deploy
npm run db:seed
npm run build
npm start
```

`db:deploy` 在迁移成功后自动导入实际内容；`db:seed` 只初始化本机管理员与权限，使用内容包，不再用旧示例覆盖网页。`npm start` 也检查内容包是否已经导入。同一版本重复执行不会重新覆盖后台后来修改的内容。2GB 服务器仍建议在适配的 Linux 构建环境完成构建。

## 已有正式站更新内容

先备份并安排维护窗口，确认当前进程和命令使用相同 `DATABASE_URL`。已有数据库迁移历史需按发布检查清单核对。

```sh
git pull --ff-only
npm run content:preview
npm run content:import
```

当前这一轮只改导入脚本和数据包，已运行上一轮页面代码的服务器可直接导入后刷新，无需再次编译页面。使用 `npm run db:deploy` 的标准部署流程已包含自动导入；直接调用 `next start` 或独立服务入口的部署，请显式执行一次 `content:import`。

首次导入会将内容包中的网站记录按 slug、页面编号等匹配并更新，同时保留原数据库 ID 和服务器独有记录，客户关联不会改变。每次实际应用前，一致性数据库快照保存在 `storage/private/content-release-backups/`，不上传 GitHub。

后续不同版本采用已导入内容指纹判断：服务器后台后来修改过的记录会保留并输出 `conflicts`，其余记录更新。若维护者明确选择用开发站内容替换这些冲突，可执行 `node scripts/import-content-release.mjs --apply --force-content`；同样先创建私有备份。不会删除线上独有产品、文章或客户数据。

## 后续发布开发站的新内容

后台保存并核对内容后，在开发项目目录执行：

```sh
npm run content:export
npm run content:test
```

将更新的 `content/site-content.json` 和新增公共素材连同代码一起提交并推送 GitHub。后台保存是数据库操作，不会自动发起 Git 提交；执行 `content:export` 才生成本次要发布的内容包。

`npm run content:test` 使用独立临时数据库，验证完整恢复、生产 ID 映射、客户资料保留、重复部署、线上修改冲突及文件校验；`node scripts/check-content-clone.mjs` 验证空数据库的实际 `db:deploy` / `db:seed` / 生产启动和页面访问。
