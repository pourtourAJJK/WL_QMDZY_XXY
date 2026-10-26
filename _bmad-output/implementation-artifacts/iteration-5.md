# Iteration 5 — Epic 5 数据管理与整合

**Date:** 2026-10-26
**Branch:** `feature/data-management` → merge to `main`
**Stories:** Story 5.1 (导出/导入/清空), Story 5.2 (renderer 协调 + main 入口)

## 改动说明

| 文件 | 改动 |
|------|------|
| `src/js/renderer.js` | **重写**。从 stub 升级为真实协调器：按 charts → cards → listView 顺序调用 refreshAll(filter)，统一 filter 参数传递 |
| `src/js/main.js` | **重写**。从 stub 升级为完整入口：DOM ready 后依次初始化 ECharts 实例 → form → listView → 绑定数据管理按钮（导出/导入/清空）→ 首次全量刷新 |

## 技术决策

1. **renderer 协调顺序**：charts（图表）→ cards（卡片）→ listView（列表）。符合 AD-2（单向流动）和 AD-4（依赖方向），所有子模块都只依赖 dataStore，互相不依赖
2. **卡片不接受 filter 参数**：筛选场景下卡片显示的是"筛选后的数字"——这符合直觉（用户筛选某个类别后，卡片总支出应该变成该类别的总支出）
3. **导入用两次 confirm**：清空操作不可逆，加双重确认防止误触
4. **导入后清空 input file**：允许用户选择同一个文件再次导入（否则 change 事件不会触发）
5. **导出文件名**：`expense-backup-YYYY-MM-DD.json`，与 PRD FR-11 格式一致

## 验证结果

- [x] 打开 `src/index.html`，控制台显示 `[main] App ready ✅`
- [x] 录入一笔开销后，三张图表 + 三张卡片 + 列表全部自动刷新
- [x] 类别筛选下拉框切换时，图表和列表同步刷新（卡片显示筛选后的数字）
- [x] 导出按钮触发下载 JSON 文件，文件名格式正确
- [x] 导入：弹窗二次确认 → 恢复数据 → 全页面刷新
- [x] 清空：两次 confirm → 数据清空 → 全部归零
- [x] 刷新浏览器后数据完整保留（localStorage 持久化生效）
- [x] 关闭浏览器重开后数据完整保留

## 已知局限

- 没有构建步骤（纯 HTML 直接 file:// 打开可用），build-report.md 可说明用 `npx serve` 本地预览
- 没有单元测试框架，test-report.md 用手动 E2E 测试替代
- 没有"编辑已录入开销"功能（PRD v1 明确不做，删除重录代替）
