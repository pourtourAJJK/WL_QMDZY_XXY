# Iteration 3 — Epic 3 可视化仪表盘

**Date:** 2026-10-26
**Branch:** `feature/chart-dashboard` → merge to `main`
**Stories:** Story 3.1 (环形图), 3.2 (柱状图), 3.3 (折线图), 3.4 (统计卡片)

## 改动说明

| 文件 | 改动 |
|------|------|
| `src/js/charts.js` | **重写**。从 stub 升级为完整 ECharts 实现：`init()` 创建三个实例，`renderCategoryPie()` 环形图、`renderMonthBar()` 柱状图、`renderTrendLine()` 折线图，`refreshAll(filter)` 统一刷新 |
| `src/js/cards.js` | **重写**。从 stub 升级为三张卡片渲染：`refreshAll()` 从 dataStore 读取数据并计算 total/month/max，格式化为 ¥1,234.56 |

## 技术决策

1. **ECharts 通过 CDN 引入**（`https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js`），HTML 中在业务 JS 之前加载
2. **图表实例在 `charts.init()` 中创建**（DOM ready 后），不重复创建，只 `setOption` 更新
3. **类别颜色通过 `Categories.getColorByName()` 动态取**（符合 AD-3 稳定性约束）
4. **无数据时显示空状态**：用 innerHTML 覆盖图表容器，有数据时 ECharts.setOption 自动恢复
5. **折线图只展示本月**（按 `YYYY-MM` 前缀匹配），X 轴为当月日期序列
6. **柱状图按月份聚合**（`date.slice(0, 7)`），按时间排序

## 验证结果

- [x] 录入测试数据后刷新页面，三张图表正确展示
- [x] 类别颜色与 categories.js 定义一致（环形图 + 图例）
- [x] 窗口 resize 时图表自适应（window resize 监听）
- [x] 无数据时显示空状态文案
- [x] 统计卡片正确：总支出/本月支出/最高单笔
- [x] 最高单笔卡片显示金额 + 类别 + 日期
- [x] 金额格式化为千分位（¥1,234.56）

## 已知局限

- charts.init() 还没有在 main.js 入口里调用（main.js 还是 stub），所以当前需要手动在 Console 里执行 `charts.init(); charts.refreshAll()`
- 类别筛选（filter）还未打通到下拉框事件（Epic 4 实现 list-view.js 后打通）
- 折线图的空状态目前没有在 filterCategory 过滤导致空数据时显式处理（逻辑已兼容，待实际测试）
