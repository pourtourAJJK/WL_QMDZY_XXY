# Personal Expense Dashboard — 个人开销统计仪表盘

《未来技术》课程大作业 · 纯前端零依赖开销可视化工具

---

## 项目简介

一个**打开 HTML 就能用**的个人开销统计仪表盘。快速录入每一笔消费，自动按类别/月份/日期生成可视化图表，让"钱花到了哪里"一目了然。

- **零安装、零后端** — 双击 `src/index.html` 即可运行
- **隐私优先** — 所有数据 100% 存在浏览器 localStorage，不上传任何服务器
- **本地账户体系** — 注册 / 登录 / 登出，密码 SHA-256 哈希存储，连续 5 次失败锁定 5 分钟
- **即时可视化** — 录入后环形图、月度柱状图、类别堆叠图、每日折线图自动刷新
- **数据可迁移** — JSON / CSV / Excel 三种格式导出与导入

## 启动方式（3 选 1）

### 方式 1：直接双击（最简单）
```
src/index.html
```

### 方式 2：Python 本地服务器
```powershell
cd src
python -m http.server 8080
# 打开 http://localhost:8080
```

### 方式 3：Node.js serve
```powershell
npx serve src -p 8080
# 打开 http://localhost:8080
```

> **端口固定为 8080**：localStorage 按 origin（协议 + 域名 + 端口）隔离，换端口会导致账户与数据"消失"，因此演示时请始终使用同一端口。
>
> **CDN 依赖**：ECharts 5.5.0 与 SheetJS 0.18.5 走 jsDelivr，并内置 bootcdn 国内备用源；两者均加载失败时页面会给出降级提示（图表区显示"图表库加载失败"，Excel 导入导出自动禁用）。

## 核心功能

| 模块 | 功能 | 说明 |
|------|------|------|
| 认证 | 注册 / 登录 / 登出 | 账号 ≥3 位、密码 ≥6 位，SHA-256 哈希后存储 |
| 认证 | 失败锁定 | 连续 5 次密码错误锁定账户 5 分钟，锁定状态持久化 |
| 录入 | 开销录入 | 金额 + 类别 + 日期 + 备注，提交后全部视图同步刷新 |
| 录入 | 7 个预置类别 | 餐饮、交通、购物、娱乐、居住、医疗、其他，支持自定义 |
| 可视化 | 环形图 | 类别占比，中心显示总金额，颜色按类别稳定映射 |
| 可视化 | 月度柱状图 | 各月支出对比，柱顶标注金额 |
| 可视化 | 类别堆叠柱状图 | 每月内各类别构成，一眼看出结构变化 |
| 可视化 | 每日折线图 | 当月每日支出趋势，areaStyle 面积填充 |
| 统计 | 三张统计卡片 | 累计总支出、本月支出、最高单笔（含类别） |
| 列表 | 明细列表 | 日期倒序、类别标签、单条删除 |
| 列表 | 类别筛选 | 下拉筛选，列表与所有图表同步刷新 |
| 数据 | 三格式导出 | JSON / CSV（含 UTF-8 BOM，Excel 打开不乱码）/ Excel |
| 数据 | 三格式导入 | 按文件扩展名分派解析，导入前二次确认 |
| 数据 | 清空数据 | 双重确认，防止误触 |

## 技术栈

| 层 | 选型 |
|----|------|
| 语言 | 原生 JavaScript（ES2020，IIFE 模块化，零构建） |
| 图表 | ECharts 5.5.0（jsDelivr + bootcdn 双源） |
| 表格 | SheetJS 0.18.5（CSV / Excel 解析与生成，可选降级） |
| 认证 | Web Crypto API `crypto.subtle.digest('SHA-256')` |
| 样式 | 原生 CSS 3 + CSS 自定义属性设计令牌（无框架） |
| 存储 | localStorage（业务数据 / 账户）+ sessionStorage（登录态） |
| 构建 | 无需构建（纯 HTML 打开即用） |

## 项目结构

```
WEILAI_BYSJ_X/
├── src/
│   ├── index.html           入口页面
│   ├── css/
│   │   └── style.css        全部样式
│   └── js/
│       ├── auth.js          注册 / 登录 / 登出 + 5 次锁定 + SHA-256 哈希
│       ├── categories.js    类别定义 + 颜色映射
│       ├── data-store.js    数据层：CRUD + JSON/CSV/Excel 导入导出
│       ├── charts.js        四张 ECharts 图表（环形/月度/堆叠/折线）
│       ├── cards.js         三张统计卡片
│       ├── list-view.js     开销列表 + 筛选 + 删除
│       ├── form.js          录入表单 + 校验 + 提交
│       ├── renderer.js      统一刷新协调器
│       └── main.js          应用入口 + 登录态路由守卫
├── _bmad-output/
│   ├── planning-artifacts/  BMAD 阶段一、二产物（需求/设计）
│   └── implementation-artifacts/  BMAD 阶段三、四产物（迭代/报告）
├── AGENTS.md                大作业规则文件
├── README.md                本文件
└── .gitignore
```

## Git 工作流记录

本项目严格遵循 conventional commit 格式，每个功能或修复均建 feature 分支开发后 merge 回 main。截至本次文档同步，仓库共 **32 次提交**，其中 **11 次**为 merge 提交（本次文档同步分支为第 12 个 feature 分支）：

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
| 迭代 · 文档同步 | `implementation-artifacts/iteration-12.md` | README 与仓库现状对齐 | 本次提交 |
| 阶段四 · 验证改进 | `implementation-artifacts/build-report.md` | 构建报告（零构建说明） | `3df6fbc` |
| 阶段四 · 验证改进 | `implementation-artifacts/test-report.md` | E2E 测试报告（22/22 PASS） | `9ce9cbb` |

## 快速演示路径（< 30 秒）

1. 打开 `src/index.html`（或 `http://localhost:8080`）
2. 首次使用先注册：账号 `demo` / 密码 `123456`，注册成功后切回登录页用该账号登录
3. 在录入表单里依次输入 3 条数据：
   - `35 / 餐饮 / 今天 / 外卖`
   - `120 / 购物 / 今天 / 超市`
   - `8 / 交通 / 今天 / 地铁`
4. 点击"添加"按钮（每条都会自动刷新所有图表）
5. 查看环形图（餐饮/购物/交通各占比、中心 ¥163）、月度柱状图、堆叠图、折线图（今天的点）、卡片（总支出 ¥163.00，最高单笔 ¥120.00）
6. 在"数据管理"区导出 CSV，再用"导入备份"选回该文件，验证数据完整恢复

## 限制与未来方向

- **认证为纯前端实现**：密码虽经 SHA-256 哈希，但账号与锁定状态保存在浏览器本地，仅适用于课程演示；生产环境需改为后端校验 + 加盐哈希 + JWT + 服务端限流
- v1 明确不做：预算提醒、收入管理、跨设备同步、移动端 App
- 未来可扩展：Vite 构建打包、PWA 离线安装、CSV 导入微信/支付宝账单

---

*Made for 《未来技术》course project · BMAD-Method workflow · Conventional Commits*
