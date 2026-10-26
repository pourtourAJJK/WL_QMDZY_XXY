# Iteration 4 — Epic 4 开销列表与筛选

**Date:** 2026-10-26
**Branch:** `feature/expense-list` → merge to `main`
**Stories:** Story 4.1 (列表 + 删除), 4.2 (类别筛选)

## 改动说明

| 文件 | 改动 |
|------|------|
| `src/js/list-view.js` | **重写**。从 stub 升级为完整实现：`init()`、`populateCategoryFilter()`、`refreshAll(filter)`、`renderItem()`、`handleDelete()` |

## 技术决策

1. **日期倒序**：先按 date 字符串逆序，同日按 created_at 逆序，让最新的开销出现在列表顶部
2. **删除用原生 confirm() 弹窗**：最小化实现，不引入自定义 modal 组件
3. **删除按钮用事件委托**：renderItem 里用 data-id，点击时 querySelectorAll 绑定，避免 innerHTML 覆盖后事件丢失
4. **筛选 filterCategory 参数空字符串表示"全部"**，与 charts/cards 保持一致语义
5. **populateCategoryFilter 每次刷新都重建下拉框**：因为自定义类别可能在任何时候添加，需要同步更新

## 验证结果

- [x] 列表正确按日期倒序展示
- [x] 每条记录显示：日期、类别标签（带颜色）、备注、金额、删除按钮
- [x] 无数据时显示"暂无记录"
- [x] 点击删除弹出 confirm，确认后从 localStorage 移除
- [x] 删除后列表自动刷新
- [x] 筛选下拉框包含"全部" + 所有类别
- [x] 选择某个类别后，列表只显示该类别记录
- [x] 自定义类别添加后，筛选下拉框自动包含新类别名

## 已知局限

- 筛选下拉框的 refreshAll(filter) 目前通过 renderer.refreshAll 优先调用，renderer 还是 stub，所以实际走兜底路径（分别调 charts/cards/listView 的 refreshAll）。Epic 5 实现完整 renderer 后统一走协调路径
- 删除没有回收站/撤销能力（PRD v1 明确不做）
- 列表没有分页/虚拟滚动，数据量很大时可能性能下降（但个人开销场景下不会遇到）
