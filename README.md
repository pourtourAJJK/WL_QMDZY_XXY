# 💰 Personal Expense Dashboard — 个人开销统计仪表盘

《未来技术》课程大作业 · 纯前端零依赖开销可视化工具

---

## 项目简介

一个**打开 HTML 就能用**的个人开销统计仪表盘。快速录入每一笔消费，自动按类别/月份/日期生成可视化图表，让"钱花到了哪里"一目了然。

- ✅ **零安装、零后端、零注册** — 双击 `src/index.html` 即可运行
- 🔒 **隐私优先** — 所有数据 100% 存在浏览器 localStorage，不上传任何服务器
- 📊 **即时可视化** — 录入后环形图/柱状图/折线图自动刷新
- 💾 **数据安全** — 支持 JSON 导出备份和导入恢复

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

## 核心功能

| 功能 | 说明 |
|------|------|
| 开销录入 | 金额 + 类别 + 日期 + 备注，2 秒完成一笔 |
| 预置 7 类别 | 餐饮、交通、购物、娱乐、居住、医疗、其他，支持自定义 |
| 环形图 | 类别占比可视化，颜色稳定不随机 |
| 柱状图 | 月度支出对比，标注金额 |
| 折线图 | 当月每日支出趋势，areaStyle 渐变 |
| 统计卡片 | 累计总支出、本月支出、最高单笔 + 类别 |
| 开销列表 | 日期倒序，类别标签，一键删除 |
| 类别筛选 | 下拉框筛选只看某类别，图表同步刷新 |
| JSON 导出 | 一键备份，文件名含日期 |
| JSON 导入 | 二次确认恢复，覆盖当前数据 |
| 一键清空 | 双重确认，防止误触 |

## 技术栈

| 层 | 选型 |
|----|------|
| 语言 | 原生 JavaScript（ES2020，IIFE 模块化） |
| 图表 | ECharts 5.5.0（jsDelivr CDN） |
| 样式 | 原生 CSS 3（无框架） |
| 存储 | 浏览器 localStorage |
| 构建 | 无需构建（纯 HTML 打开即用） |

## 项目结构

```
WEILAI_BYSJ_X/
├── src/
│   ├── index.html           入口页面
│   ├── css/
│   │   └── style.css        全部样式
│   └── js/
│       ├── categories.js    类别定义 + 颜色映射
│       ├── data-store.js    数据层：CRUD + JSON 导入导出
│       ├── charts.js        三张 ECharts 图表
│       ├── cards.js         三张统计卡片
│       ├── list-view.js     开销列表 + 筛选 + 删除
│       ├── form.js          录入表单 + 校验 + 提交
│       ├── renderer.js      统一刷新协调器
│       └── main.js          应用入口
├── _bmad-output/
│   ├── planning-artifacts/  BMAD 阶段一、二产物（需求/设计）
│   └── implementation-artifacts/  BMAD 阶段三、四产物（迭代/报告）
├── AGENTS.md                大作业规则文件
├── README.md                本文件
└── .gitignore
```

## Git 工作流记录

本项目严格遵循 conventional commit 格式，完整实现 5 个 feature 分支 + merge 回 main 的痕迹。

```
ef68659 Merge branch 'feature/data-management' into main
07b6e69 Merge branch 'feature/expense-list' into main
2e79f91 Merge branch 'feature/chart-dashboard' into main
00949ff Merge branch 'feature/expense-form' into main
76ddff2 Merge branch 'feature/data-layer' into main
f5436ad feat: 完成基础设施与数据层（Story 1.1 + 1.2）
7ae30f0 feat: 完成开销录入表单（Story 2.1 + 2.2）
b5aa51a feat: 完成可视化仪表盘（Story 3.1-3.4 三张图表 + 三张卡片）
52255a1 feat: 完成开销列表与筛选（Story 4.1 + 4.2）
48de5f9 feat: 完成数据管理与模块整合（Story 5.1 + 5.2）
b81b9ff docs: 完成产品简报与需求规格
e94599d docs: 完成技术架构与任务拆分
4dabffa chore: 初始化项目与 BMAD 目录结构
```

## BMAD 产物索引

所有产物严格保存在 `_bmad-output/` 下，不散落根目录：

| 阶段 | 文件 | 描述 | Commit |
|------|------|------|--------|
| 阶段一 · 需求分析 | `planning-artifacts/product-brief.md` | 产品简报 | `b81b9ff` |
| 阶段一 · 需求分析 | `planning-artifacts/prd.md` | 需求规格（FR-1~FR-13） | `b81b9ff` |
| 阶段二 · 规划设计 | `planning-artifacts/architecture.md` | 技术架构 + 依赖图 | `e94599d` |
| 阶段二 · 规划设计 | `planning-artifacts/epics-and-stories.md` | 5 Epic / 12 Story 拆分 | `e94599d` |
| 阶段三 · 开发实现 | `implementation-artifacts/iteration-1.md` | Epic 1 迭代记录 | `76ddff2` |
| 阶段三 · 开发实现 | `implementation-artifacts/iteration-2.md` | Epic 2 迭代记录 | `00949ff` |
| 阶段三 · 开发实现 | `implementation-artifacts/iteration-3.md` | Epic 3 迭代记录 | `2e79f91` |
| 阶段三 · 开发实现 | `implementation-artifacts/iteration-4.md` | Epic 4 迭代记录 | `07b6e69` |
| 阶段三 · 开发实现 | `implementation-artifacts/iteration-5.md` | Epic 5 迭代记录 | `ef68659` |
| 阶段四 · 验证改进 | `implementation-artifacts/build-report.md` | 构建报告（零构建说明） | - |
| 阶段四 · 验证改进 | `implementation-artifacts/test-report.md` | E2E 测试报告（22/22 PASS） | - |

## 快速演示路径（< 30 秒）

1. 打开 `src/index.html`
2. 在录入表单里依次输入 3 条数据：
   - `35 / 餐饮 / 今天 / 外卖`
   - `120 / 购物 / 今天 / 超市`
   - `8 / 交通 / 今天 / 地铁`
3. 点击"添加"按钮（每条都会自动刷新所有图表）
4. 查看环形图（餐饮/购物/交通各占比）、柱状图（累计 ¥163）、折线图（今天的点）、卡片（总支出 ¥163.00，最高单笔 ¥120.00）

## 限制与未来方向

- v1 明确不做：预算提醒、收入管理、账号同步、移动端 App
- 未来可扩展：Vite 构建打包、PWA 离线安装、CSV 导入微信/支付宝账单

---

*Made for 《未来技术》course project · BMAD-Method workflow · Conventional Commits*
