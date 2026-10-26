# Iteration 2 — Epic 2 开销录入表单

**Date:** 2026-10-26
**Branch:** `feature/expense-form` → merge to `main`
**Stories:** Story 2.1 (表单 UI + 校验), Story 2.2 (提交写入 + 刷新 hook)

## 改动说明

| 文件 | 改动 |
|------|------|
| `src/js/form.js` | **新增**。完整的表单模块：`init()`, `populateCategories()`, `validate()`, `handleSubmit()`, `handleAddCustomCategory()`, `resetForm()` |
| `src/js/charts.js` | **新增 stub**。空壳占位，Epic 3 填充真实渲染 |
| `src/js/cards.js` | **新增 stub**。空壳占位，Epic 3 填充真实渲染 |
| `src/js/list-view.js` | **新增 stub**。空壳占位，Epic 4 填充真实渲染 |
| `src/js/renderer.js` | **新增 stub**。空壳占位，Epic 5 填充协调逻辑 |
| `src/js/main.js` | **新增 stub**。空壳占位，Epic 5 填充入口串联 |

## 技术决策

1. **IIFE + window global**（同 Epic 1）：保持一致，避免 file:// CORS 问题
2. **submit 时优先调 renderer.refreshAll()，兜底直接调各模块**：Epic 2 还没有完整 renderer 协调，但需要保证录入后有刷新触发路径。Epic 5 实现完整 renderer 后可清理兜底代码
3. **自定义类别用 `prompt()` 弹窗**：最小化实现，课程大作业场景下够用；生产级应用应替换为页面内联 modal
4. **表单校验：金额 ≤ 0 时禁用提交按钮**：实时监听 input 事件，避免空/无效数据写入

## 验证结果

- [x] 打开 `src/index.html` 控制台无 JS 报错（所有 script 标签对应的文件都存在了）
- [x] 类别下拉框正确显示 7 个预置类别
- [x] 日期默认填今天
- [x] 金额为空时提交按钮禁用
- [x] 点击"添加"后 DevTools Console 可见 `[form] expense added: ...` 日志（写入已发生，图表还没实现刷新）
- [x] localStorage 中可查到新增记录（DevTools → Application → Local Storage）
- [x] 自定义类别功能：点击"+ 自定义类别"，输入名称后自动添加到下拉框
- [x] 刷新页面后自定义类别持久化（存在 localStorage 的 `expense_dashboard_custom_categories`）

## 已知局限

- charts/cards/list-view/renderer/main 都是 stub，不具备真实渲染能力
- 录入后"刷新图表"只是 console.log，看不到实际效果（Epic 3 解决）
- 自定义类别无法删除（PRD v1 明确不做）
- 没有编辑已录入开销的能力（PRD v1 明确用删除重录代替）
