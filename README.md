# Personal Expense Dashboard — 个人开销统计仪表盘

《未来技术》课程大作业 · 前后端分离开销可视化工具（Django + JWT + 原生 JS）

---

## 项目简介

一个前后端分离的个人开销统计仪表盘。快速录入每一笔消费，自动按类别/月份/日期生成可视化图表，让"钱花到了哪里"一目了然。

- **数据在后端** — 开销记录存于 Django + SQLite，按登录用户隔离，不只是浏览器本地数据
- **生产级认证** — 服务端 PBKDF2 加盐哈希、JWT 会话（access 30 分钟 / refresh 1 天）、5 次失败锁定 5 分钟、接口限流
- **即时可视化** — 录入后环形图、月度柱状图、类别堆叠图、每日折线图自动刷新
- **数据可迁移** — JSON / CSV / Excel 三种格式导出，Excel（.xlsx）由后端 openpyxl 生成，导入由后端逐行校验后覆盖写入
- **零构建前端** — 仍然是原生 JavaScript + CSS，不需要打包工具

## 启动方式（前后端各起一个进程）

### 1. 启动后端（端口 8000）

```powershell
cd backend
pip install -r requirements.txt        # 首次运行
python manage.py migrate               # 首次运行（生成 SQLite 表）
python manage.py runserver 127.0.0.1:8000
```

### 2. 启动前端（端口 8080）

```powershell
cd src
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

> **必须以 http://localhost:8080 访问**：前端通过 CORS 白名单调用 `http://127.0.0.1:8000`，直接双击 `index.html`（file://）会被浏览器跨域策略拦截。
>
> **端口固定为 8080**：后端 CORS 只放行 8080 / 5500，换端口需同步修改 `backend/config/settings.py` 的 `CORS_ALLOWED_ORIGINS`。
>
> **生产环境**：必须通过环境变量注入 `DJANGO_SECRET_KEY`，并设置 `DJANGO_DEBUG=0`；数据库与限流缓存应替换为 PostgreSQL + Redis。
>
> **CDN 依赖**：仅 ECharts 5.5.0 走 jsDelivr（内置 bootcdn 国内备用源）；xlsx 导出由后端 openpyxl 生成，前端不再依赖 SheetJS CDN。

## 核心功能

| 模块 | 功能 | 说明 |
|------|------|------|
| 认证 | 注册 / 登录 / 登出 | 后端 PBKDF2-SHA256 加盐哈希，JWT 令牌存 sessionStorage |
| 认证 | 失败锁定 | 服务端累计连续 5 次失败后锁定 5 分钟（`LoginAttempt` 表），跨设备生效 |
| 认证 | 接口限流 | 登录 10/min、注册 5/hour、导入 10/hour、导出 30/hour，全站匿名 30/min、登录用户 120/min |
| 认证 | 会话续期 | access 过期自动用 refresh 换取新令牌；登出时后端拉黑 refresh |
| 录入 | 开销录入 | 金额 + 类别 + 日期 + 备注，提交后全部视图同步刷新 |
| 录入 | 7 个预置类别 | 餐饮、交通、购物、娱乐、居住、医疗、其他，支持自定义 |
| 可视化 | 环形图 | 类别占比，中心显示总金额，颜色按类别稳定映射 |
| 可视化 | 月度柱状图 | 各月支出对比，柱顶标注金额 |
| 可视化 | 类别堆叠柱状图 | 每月内各类别构成，一眼看出结构变化 |
| 可视化 | 每日折线图 | 当月每日支出趋势，areaStyle 面积填充 |
| 统计 | 三张统计卡片 | 累计总支出、本月支出、最高单笔（含类别） |
| 列表 | 明细列表 | 日期倒序、类别标签、单条删除 |
| 列表 | 类别筛选 | 下拉筛选，列表与所有图表同步刷新 |
| 数据 | 三格式导出 | JSON / CSV（含 UTF-8 BOM，Excel 打开不乱码）/ XLSX（后端 openpyxl 生成，带表头样式、列宽、冻结首行、金额格式） |
| 数据 | 三格式导入 | 上传至后端逐行校验（JSON/CSV/XLSX），任一行非法则整份拒绝且原数据不变；导出的 xlsx 可直接再导入 |
| 数据 | 清空数据 | 双重确认，防止误触 |

## 后端接口

所有接口统一返回 JSON，错误体为 `{"detail": "...", "retry_after"?: n}`；除注册/登录/刷新外均需 `Authorization: Bearer <access>`。

| 方法 | 路径 | 说明 | 权限 / 限流 |
|------|------|------|-------------|
| POST | `/api/auth/register/` | 注册（PBKDF2 哈希落库） | 匿名 · 5/hour |
| POST | `/api/auth/login/` | 登录，返回 access + refresh | 匿名 · 10/min |
| POST | `/api/auth/refresh/` | 刷新 access（轮换 refresh） | 匿名 |
| GET | `/api/auth/me/` | 当前用户信息 | JWT |
| POST | `/api/auth/logout/` | 拉黑 refresh 令牌 | JWT |
| GET/POST | `/api/expenses/` | 列出 / 新增开销（按 user 隔离） | JWT · 120/min |
| DELETE | `/api/expenses/<id>/` | 删除单条 | JWT |
| DELETE | `/api/expenses/clear/` | 清空本人数据 | JWT |
| POST | `/api/expenses/import/` | 上传 JSON/CSV/XLSX，服务端解析校验后覆盖 | JWT · 10/hour |
| GET | `/api/expenses/export/` | 导出当前用户数据为 XLSX（`application/vnd...spreadsheetml.sheet`） | JWT · 30/hour |

## 技术栈

| 层 | 选型 |
|----|------|
| 前端 | 原生 JavaScript（ES2020，IIFE 模块化，零构建）+ 原生 CSS 3 设计令牌 |
| 图表 | ECharts 5.5.0（jsDelivr + bootcdn 双源） |
| 后端 | Django 5.2 + Django REST Framework 3.18 |
| 认证 | SimpleJWT（access 30min / refresh 1d，轮换 + 黑名单） |
| 密码 | Django PBKDF2-SHA256（随机盐，1,000,000 次迭代） |
| 限流 | DRF Throttle（Anon/User/ScopedRateThrottle，LocMem，生产换 Redis） |
| 数据库 | SQLite（`backend/db.sqlite3`，已 gitignore） |
| CORS | django-cors-headers 白名单（仅 8080 / 5500） |
| 文件解析/导出 | openpyxl（服务端解析与生成 .xlsx） |

## 项目结构

```
WEILAI_BYSJ_X/
├── src/
│   ├── index.html           入口页面
│   ├── css/
│   │   └── style.css        全部样式
│   └── js/
│       ├── api.js           后端客户端：JWT 附加 + 401 自动刷新 + 统一错误
│       ├── auth.js          注册 / 登录 / 登出 / 路由守卫（无本地账号逻辑）
│       ├── categories.js    类别定义 + 颜色映射
│       ├── data-store.js    后端数据层：内存快照 + CRUD + 文件导入（Excel 导出走后端接口）
│       ├── charts.js        四张 ECharts 图表（环形/月度/堆叠/折线）
│       ├── cards.js         三张统计卡片
│       ├── list-view.js     开销列表 + 筛选 + 删除
│       ├── form.js          录入表单 + 校验 + 提交
│       ├── renderer.js      统一刷新协调器
│       └── main.js          应用入口 + 业务模块初始化
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/              settings（JWT/限流/CORS）、统一异常、路由
│   │   ├── settings.py
│   │   ├── exceptions.py
│   │   └── urls.py
│   ├── accounts/            注册/登录/me/登出 + LoginAttempt 锁定模型
│   └── expenses/            开销 CRUD + 服务端导入解析（importers.py）+ XLSX 导出（exporters.py）
├── _bmad-output/
│   ├── planning-artifacts/  BMAD 阶段一、二产物（需求/设计）
│   └── implementation-artifacts/  BMAD 阶段三、四产物（迭代/报告）
├── AGENTS.md                大作业规则文件
├── README.md                本文件
└── .gitignore
```

## Git 工作流记录

本项目严格遵循 conventional commit 格式，每个功能或修复均建 feature 分支开发后 merge 回 main。截至 XLSX 服务端导出迭代开始前，仓库共 **38 次提交**，其中 **13 次**为 merge 提交（本次 `feature/backend-xlsx-export` 为第 14 个 feature 分支）：

```
384124e Merge branch 'feature/ui-redesign' into main
9f2faf4 Merge branch 'feature/fix-chart-promise-auth-persist' into main
569b860 Merge branch 'feature/fix-chart-render' into main
65ad638 Merge branch 'feature/chart-enhancement' into main
a85d9c5 Merge branch 'feature/data-export-import' into main
6c6da6e Merge branch 'feature/auth-login' into main
ef68659 Merge branch 'feature/data-management' into main
07b6e69 Merge branch 'feature/expense-list' into main
2e79f91 Merge branch 'feature/chart-dashboard' into main
00949ff Merge branch 'feature/expense-form' into main
76ddff2 Merge branch 'feature/data-layer' into main
```

**四阶段提交对应关系**：

| BMAD 阶段 | 提交 |
|-----------|------|
| 阶段一 · 需求分析 | `b81b9ff` docs: 完成产品简报与需求规格 |
| 阶段二 · 规划与设计 | `e94599d` docs: 完成技术架构与任务拆分 |
| 阶段三 · 开发实现 | `f5436ad` / `7ae30f0` / `b5aa51a` / `52255a1` / `48de5f9`（Epic 1–5 五个功能模块） |
| 迭代增强 | `b312312` 登录认证 · `9672769` 三格式导入导出 · `78c2f3d` 图表增强 · `cbada44` / `9a7f96c` 图表白屏修复 |
| 阶段四 · 验证改进 | `3df6fbc` E2E 沙箱验证 22/22 PASS · `9ce9cbb` 修正测试报告 · `c9f046f` CDN 双源 · `3b0436b` UI 规范化 |

## BMAD 产物索引

所有产物严格保存在 `_bmad-output/` 下，不散落根目录：

| 阶段 | 文件 | 描述 | Commit |
|------|------|------|--------|
| 阶段一 · 需求分析 | `planning-artifacts/product-brief.md` | 产品简报 | `b81b9ff` |
| 阶段一 · 需求分析 | `planning-artifacts/prd.md` | 需求规格（FR-1~FR-13） | `b81b9ff` |
| 阶段二 · 规划设计 | `planning-artifacts/architecture.md` | 技术架构 + 依赖图 | `e94599d` |
| 阶段二 · 规划设计 | `planning-artifacts/epics-and-stories.md` | 5 Epic / 12 Story 拆分 | `e94599d` |
| 阶段三 · 开发实现 | `implementation-artifacts/iteration-1.md` | Epic 1 数据层迭代记录 | `76ddff2` |
| 阶段三 · 开发实现 | `implementation-artifacts/iteration-2.md` | Epic 2 录入表单迭代记录 | `00949ff` |
| 阶段三 · 开发实现 | `implementation-artifacts/iteration-3.md` | Epic 3 可视化迭代记录 | `2e79f91` |
| 阶段三 · 开发实现 | `implementation-artifacts/iteration-4.md` | Epic 4 列表与筛选迭代记录 | `07b6e69` |
| 阶段三 · 开发实现 | `implementation-artifacts/iteration-5.md` | Epic 5 数据管理迭代记录 | `ef68659` |
| 迭代 · 认证 | `implementation-artifacts/iteration-6.md` | 注册/登录/锁定迭代记录 | `b312312` |
| 迭代 · 数据迁移 | `implementation-artifacts/iteration-7.md` | JSON/CSV/Excel 导入导出 | `9672769` |
| 迭代 · 图表增强 | `implementation-artifacts/iteration-8.md` | 堆叠图 + 视觉升级 | `78c2f3d` |
| 迭代 · 缺陷修复 | `implementation-artifacts/iteration-9.md` | 图表白屏（时序 + 重复调用） | `cbada44` |
| 迭代 · 缺陷修复 | `implementation-artifacts/iteration-10.md` | Promise 消除竞态 + 端口固定 | `9a7f96c` |
| 迭代 · UI 规范 | `implementation-artifacts/iteration-11.md` | 去渐变/去重阴影/去 emoji + 设计令牌 | `3b0436b` |
| 迭代 · 文档同步 | `implementation-artifacts/iteration-12.md` | README 与仓库现状对齐 | `4a1f742` |
| 迭代 · 后端认证 | `implementation-artifacts/iteration-13.md` | 认证迁移 Django：PBKDF2 + JWT + 限流 + 服务端导入 | 本次提交 |
| 迭代 · XLSX 导出 | `implementation-artifacts/iteration-14.md` | XLSX 导出迁移后端 + 导出/导入回环 | 本次提交 |
| 阶段四 · 验证改进 | `implementation-artifacts/build-report.md` | 构建报告（零构建说明） | `3df6fbc` |
| 阶段四 · 验证改进 | `implementation-artifacts/test-report.md` | 测试报告（后端单测 + 联调） | `9ce9cbb` / 本次提交 |

## 快速演示路径（< 1 分钟）

1. 启动后端 `python manage.py runserver 127.0.0.1:8000`，再启动前端 `python -m http.server 8080`（在 `src/` 下）
2. 打开 `http://localhost:8080`，注册 `demo` / `secret123`，切回登录页登录（JWT 由后端签发）
3. 在录入表单里依次输入 3 条数据：
   - `35 / 餐饮 / 今天 / 外卖`
   - `120 / 购物 / 今天 / 超市`
   - `8 / 交通 / 今天 / 地铁`
4. 点击"添加"按钮（后端落库，前端拉取后刷新所有图表）
5. 查看环形图（餐饮/购物/交通各占比、中心 ¥163）、月度柱状图、堆叠图、折线图（今天的点）、卡片（总支出 ¥163.00，最高单笔 ¥120.00）
6. 数据管理区：导出 Excel（xlsx 由后端生成）→ 清空 → 用"导入备份"上传刚下载的 xlsx，验证数据完整恢复；JSON / CSV 同样可回环
7. 安全演示：连续输错 5 次密码 → 第 5 次即返回锁定（界面显示服务端倒计时）；同时刷新页面或换浏览器仍保持锁定

## 限制与未来方向

- **认证已迁移到后端**：PBKDF2 加盐哈希 + JWT + 服务端锁定与限流；但 SQLite 与 LocMem 限流仅适合单进程演示，生产环境需 PostgreSQL + Redis，并通过环境变量注入 `DJANGO_SECRET_KEY`
- **尚未实现**：PDF 文档导入与内容转写（原计划的功能 1 被中断），其接口落地后同样需走 JWT + 限流 + 服务端解析
- 未实现邮箱验证、找回密码、多设备会话管理
- v1 明确不做：预算提醒、收入管理、移动端 App
- 未来可扩展：PDF/Word 表格导入、语音转写、PWA 离线安装

---

*Made for 《未来技术》course project · BMAD-Method workflow · Conventional Commits*
