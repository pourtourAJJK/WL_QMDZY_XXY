# Iteration 1 — Epic 1 基础设施与数据层

**Date:** 2026-10-26
**Branch:** `feature/data-layer` → merge to `main`
**Stories:** Story 1.1 (项目骨架 + 类别定义), Story 1.2 (localStorage 数据层)

## 改动说明

| 文件 | 用途 |
|------|------|
| `src/index.html` | 入口页面，包含所有容器 div + ECharts CDN + JS 模块加载顺序 |
| `src/css/style.css` | 全部样式：Grid 布局、渐变背景、卡片/图表/列表组件样式、响应式 |
| `src/js/categories.js` | 7 个预置类别 + 扩展色板，提供 `Categories.all()`, `getColorByName()`, `addCustom()` API |
| `src/js/data-store.js` | 开销 CRUD + JSON 导入导出 + 清空，暴露 `dataStore.getAll/add/delete/exportJSON/importJSON/clear` |

## 技术决策

1. **IIFE + window global 暴露模块**（而非 ES Module import/export）：避免 file:// 打开时 CORS 限制，零构建直接运行
2. **localStorage key 统一为常量**（`expense_dashboard_data`），数据格式 `{ expenses: [...] }`，便于将来加 schema_version 迁移
3. **类别颜色在 categories.js 集中定义**，其他模块通过 `Categories.getColorByName()` 取色，保证跨组件一致性（符合 AD-3）
4. **data-store 的 generateId 用时间戳 + 随机后缀**，够用且避免依赖 UUID 库

## 验证结果

- [x] 用浏览器直接打开 `src/index.html`，页面布局正确展示
- [x] 控制台无报错（ECharts CDN 可访问时）
- [x] 打开 DevTools Console 可手动测试 `Categories.all()`、`dataStore.add({amount:100, category:'餐饮', date:'2026-10-26'})`、`dataStore.getAll()`
- [x] 刷新页面后数据保留（localStorage 持久化生效）

## 已知局限

- 还没有 ECharts 实例初始化和图表渲染（Epic 3 实现）
- 还没有表单绑定（Epic 2 实现）
- 还没有 renderer.js 统一刷新协调（Epic 5 实现）
- 类别颜色仅在 categories.js 静态定义，未在 ECharts 中动态传入（Epic 3 打通）
