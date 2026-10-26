---
status: final
stepsCompleted: [overview, requirements, epics]
inputDocuments: [product-brief.md, prd.md, architecture.md]
---

# Personal Expense Dashboard - Epic Breakdown

## Overview

本项目为《未来技术》课程大作业，是一款纯前端开销统计仪表盘。本任务拆分将 PRD 的 13 条功能需求（FR-1 ~ FR-13）分解为 5 个 Epic、12 个 Story，每个 Story 可在一个 feature 分支中独立实现并合并回 main。

## Requirements Inventory

### Functional Requirements (from PRD)

| FR | Description |
|----|-------------|
| FR-1 | 录入表单：金额、类别、日期、备注 |
| FR-2 | 预置 7 类别 + 自定义类别 |
| FR-3 | 删除开销 |
| FR-4 | 类别占比环形图 |
| FR-5 | 月度支出柱状图 |
| FR-6 | 支出趋势折线图 |
| FR-7 | 统计卡片（总支出、本月支出、最高单笔） |
| FR-8 | 开销列表（日期倒序） |
| FR-9 | 类别筛选 |
| FR-10 | localStorage 持久化 |
| FR-11 | JSON 导出 |
| FR-12 | JSON 导入 |
| FR-13 | 清空数据 |

### Non-Functional Requirements

| NFR | Description |
|-----|-------------|
| NFR-1 | 打开 HTML 即可运行，无需构建 |
| NFR-2 | 现代浏览器兼容（Chrome/Edge/Firefox 最新版） |
| NFR-3 | 核心演示路径 < 30 秒 |
| NFR-4 | localStorage 写入失败时不崩溃 |

### FR Coverage Map

| Epic | Stories | FRs Covered |
|------|---------|-------------|
| Epic 1: 基础设施与数据层 | 1.1, 1.2 | FR-2, FR-10 |
| Epic 2: 开销录入 | 2.1, 2.2 | FR-1, FR-2, FR-3 |
| Epic 3: 可视化仪表盘 | 3.1, 3.2, 3.3, 3.4 | FR-4, FR-5, FR-6, FR-7 |
| Epic 4: 开销列表与筛选 | 4.1, 4.2 | FR-8, FR-9 |
| Epic 5: 数据管理与整合 | 5.1, 5.2 | FR-11, FR-12, FR-13 |

## Epic List

| # | Epic | Stories | Est. | Feature Branch |
|---|------|---------|------|----------------|
| 1 | 基础设施与数据层 | 2 | 10 min | `feature/data-layer` |
| 2 | 开销录入表单 | 2 | 15 min | `feature/expense-form` |
| 3 | 可视化仪表盘 | 4 | 25 min | `feature/chart-dashboard` |
| 4 | 开销列表与筛选 | 2 | 10 min | `feature/expense-list` |
| 5 | 数据管理与整合 | 2 | 10 min | `feature/data-management` |
| **Total** | | **12** | **70 min** | |

---

## Epic 1: 基础设施与数据层

**Goal:** 建立项目骨架（HTML/CSS 框架），实现 categories.js（类别定义+颜色）和 data-store.js（localStorage 读写），让数据层可被其他模块调用。

### Story 1.1: 项目骨架与类别定义

As a developer,
I want a可用的 index.html 页面框架（布局 + CDN 引入 ECharts）、基础 CSS、以及 categories.js 模块，
So that 后续功能模块有可挂载的 DOM 结构和稳定的类别/颜色映射。

**Acceptance Criteria:**

**Given** 项目根目录结构已创建
**When** 创建 `src/index.html`（包含 3 张图表容器 div + 3 张卡片容器 + 列表容器 + 表单容器）、`src/css/style.css`（Grid/Flex 布局）、`src/js/categories.js`（7 个预置类别 + 固定颜色色板）
**Then** 用浏览器打开 index.html 时，页面布局正确展示（空容器占位）、控制台无报错

**Given** categories.js 已实现 `Categories.PRESET`、`Categories.COLORS`、`Categories.getColorByName(name)`、`Categories.all`、`Categories.addCustom(name)`
**When** 调用 `Categories.getColorByName("餐饮")`
**Then** 返回预置颜色值（如 "#FF6B6B"）

---

### Story 1.2: localStorage 数据层

As a developer,
I want data-store.js 提供统一的开销 CRUD 接口，
So that 所有数据读写通过同一模块，不散落。

**Acceptance Criteria:**

**Given** dataStore 模块已实现 `getAll()`, `add(expense)`, `delete(id)`
**When** 调用 `dataStore.add({ id: "test1", amount: 35, category: "餐饮", date: "2026-10-26", note: "" })`
**Then** localStorage key `expense_dashboard_data` 中可查到该记录；`getAll()` 返回包含此记录的数组

**Given** `dataStore.delete("test1")` 被调用
**When** 调用 `dataStore.getAll()`
**Then** 返回数组不再包含 id="test1" 的记录

---

## Epic 2: 开销录入表单

**Goal:** 实现录入表单 UI、表单校验、提交后数据写入并触发刷新。

### Story 2.1: 表单 UI 与校验

As a user,
I want一个录入表单，填写金额、选择类别、设置日期、添加备注，
So that 能快速添加一笔开销。

**Acceptance Criteria:**

**Given** 页面已加载
**When** 表单显示
**Then** 金额输入框 type=number，类别下拉框包含预置类别，日期默认今天，备注可选

**Given** 金额为空或 ≤ 0
**When** 用户尝试提交
**Then** 提交按钮禁用或校验提示，记录不写入

---

### Story 2.2: 提交后数据写入与刷新

As a user,
I want提交表单后数据自动保存并页面刷新显示新数据，
So that 我能立即看到开销已被记录。

**Acceptance Criteria:**

**Given** 表单填写正确
**When** 点击"添加"按钮或回车提交
**Then** 调用 `dataStore.add()` 写入 localStorage，表单重置（金额清空、日期重置今天、类别保留上次选择）

**Given** 数据已写入
**When** 提交完成 1 秒内
**Then** 页面上所有图表、列表、卡片自动刷新（后续 Epic 实现 renderer 时打通，此处先留 hook 调用占位函数）

---

## Epic 3: 可视化仪表盘

**Goal:** 实现三张 ECharts 图表和三张统计卡片，构成仪表盘核心视图。

### Story 3.1: 类别占比环形图

As a user,
I want一个环形图展示各类别开销占比，
So that 一眼看到钱花到哪了。

**Acceptance Criteria:**

**Given** localStorage 中有开销数据
**When** 页面加载
**Then** 环形图按类别聚合金额并显示，每类颜色与 categories.js 一致

**Given** localStorage 为空
**When** 页面加载
**Then** 图表容器显示空状态文字"暂无数据，快去录入第一笔开销吧！"

---

### Story 3.2: 月度支出柱状图

As a user,
I want一个柱状图展示各月总支出，
So that 看到消费的月度对比。

**Acceptance Criteria:**

**Given** localStorage 中有多个月份的开销
**When** 页面加载
**Then** 每个月份一根柱子，柱子标注金额，按时间顺序排列

---

### Story 3.3: 支出趋势折线图

As a user,
I want一个折线图展示当月每日支出趋势，
So that 看到本月哪天花钱最多。

**Acceptance Criteria:**

**Given** localStorage 中有当月数据
**When** 页面加载
**Then** X 轴为日期，Y 轴为支出金额，数据点悬停显示具体金额

---

### Story 3.4: 统计卡片

As a user,
I want页面顶部显示总支出、本月支出、最高单笔三张卡片，
So that 关键数字一眼看到。

**Acceptance Criteria:**

**Given** localStorage 有数据
**When** 页面加载
**Then** 三张卡片显示正确数字，格式化为 ¥1,234.56（千分位）

**Given** localStorage 为空
**When** 页面加载
**Then** 所有卡片显示 ¥0.00

---

## Epic 4: 开销列表与筛选

**Goal:** 实现开销列表渲染（日期倒序）、删除操作、类别筛选。

### Story 4.1: 开销列表渲染与删除

As a user,
I want一个列表按日期倒序展示所有开销记录，每条可删除，
So that 能回看每一笔消费并删除错误录入。

**Acceptance Criteria:**

**Given** localStorage 中有多条记录
**When** 页面加载
**Then** 列表按日期倒序（新→旧）显示，每条含日期、类别（带颜色标签）、金额、备注、删除按钮

**Given** 用户点击某条记录的删除按钮
**When** 确认删除（如需二次确认可后续加）
**Then** 该记录从 localStorage 移除，列表和图表自动刷新

---

### Story 4.2: 类别筛选

As a user,
I want通过下拉框筛选只看某个类别的开销，
So that 聚焦查看某一类消费的明细。

**Acceptance Criteria:**

**Given** 页面上有筛选下拉框
**When** 选择"餐饮"类别
**Then** 列表只显示类别为"餐饮"的记录，图表同步只包含"餐饮"数据

**Given** 筛选状态激活
**When** 选择"全部"
**Then** 恢复显示所有数据

---

## Epic 5: 数据管理与整合

**Goal:** 实现 JSON 导出/导入/清空，以及 renderer.js 统一刷新协调、main.js 入口串联所有模块。

### Story 5.1: JSON 导出/导入/清空

As a user,
I want能导出全部数据为 JSON 文件备份、从 JSON 文件恢复数据、一键清空所有数据，
So that 数据安全可控。

**Acceptance Criteria:**

**Given** 页面有"导出备份"按钮
**When** 点击
**Then** 浏览器下载 JSON 文件，文件名 `expense-backup-YYYY-MM-DD.json`，内容包含 schema_version、exported_at、expenses 数组

**Given** 页面有"导入备份"按钮
**When** 选择一个有效的备份 JSON 文件
**Then** 弹窗"导入将覆盖当前数据，确定继续？"，确认后数据替换并刷新

**Given** 用户确认清空
**When** 点击"清空所有数据"并二次确认
**Then** localStorage 清空，所有 UI 归零

---

### Story 5.2: Renderer 协调与 Main 入口整合

As a developer,
I want一个 renderer.js 统一协调所有子模块的刷新，main.js 作为唯一入口串联整个应用，
So that 应用启动和刷新的调用链清晰可维护。

**Acceptance Criteria:**

**Given** renderer.js 实现了 `refreshAll(filter?)` 方法
**When** 任何数据变更或筛选变更时调用 `renderer.refreshAll()`
**Then** 依次调用 charts、cards、listView 各自的刷新方法，filter 参数正确传递

**Given** main.js 作为入口，在 DOMContentLoaded 时执行
**When** 页面加载
**Then** 初始化 ECharts 实例、绑定表单提交事件、绑定筛选变更事件、绑定按钮事件、首次调用 renderer.refreshAll() 渲染全页面

---

## 执行顺序与 Git 分支策略

```
feature/data-layer ── Epic 1 (骨架 + data-store + categories)
        │
        ▼
feature/expense-form ── Epic 2 (表单 UI + 校验 + 提交)
        │
        ▼
feature/chart-dashboard ── Epic 3 (3 图表 + 3 卡片)
        │
        ▼
feature/expense-list ── Epic 4 (列表 + 删除 + 筛选)
        │
        ▼
feature/data-management ── Epic 5 (导出/导入/清空 + renderer + main)
```

每个 feature 分支开发完成后，`git merge feature/xxx` 回 main，产生 merge commit 痕迹。
