# Iteration 12 — README 与仓库现状对齐

**Date:** 2026-10-27
**Branch:** `feature/docs-sync-readme` → merge to `main`

## 问题描述

`README.md` 停留在 Epic 1–5 完成时的状态，与仓库当前实现严重脱节：

- 仍写"零注册"、"完整实现 5 个 feature 分支"，实际已有注册/登录且合并了 11 个分支
- 功能表缺少登录锁定、类别堆叠柱状图、CSV/Excel 导入导出、8 个自定义类别
- 技术栈未提 SheetJS、Web Crypto、设计令牌
- 项目结构缺 `auth.js`，`charts.js` 仍标注"三张图表"（实际四张）
- BMAD 产物索引只列到 iteration-5，缺 6–10 与两份验证报告的真实提交号
- 演示路径没有登录步骤，新用户照做会卡在登录页

## 改动说明

| 文件 | 改动 |
|------|------|
| `README.md` | 项目简介、启动方式、核心功能表、技术栈、项目结构、Git 工作流记录、BMAD 产物索引、演示路径、限制与未来方向，共 8 节重写 |
| `_bmad-output/implementation-artifacts/iteration-11.md` | 补记 UI 规范化迭代（此前 `3b0436b` 有代码提交但缺迭代文档） |
| `_bmad-output/implementation-artifacts/iteration-12.md` | 本文件 |

### 关键修正点

1. **Git 记录改为按阶段归档**：列出 11 条 merge 提交原文 + 四阶段提交对应表（阶段一 `b81b9ff`、阶段二 `e94599d`、阶段三 5 个 feat、阶段四 test/fix/style），评审可直接按哈希核验。
2. **功能表按"模块 → 功能 → 说明"三段式组织**，认证/录入/可视化/统计/列表/数据管理 6 个模块共 14 项。
3. **补全 CDN 与端口说明**：明确 8080 固定端口的 origin 隔离原因，以及 jsDelivr + bootcdn 双源与降级行为。
4. **补全产物索引**：iteration-1~12 全部对应真实提交号，`build-report.md` → `3df6fbc`，`test-report.md` → `9ce9cbb`。
5. **演示路径补登录步骤**：注册后需切回登录页登录（`auth.register()` 不自动建会话），并追加"导出 CSV → 再导入"的证据链。

## 技术决策

- **不重排历史**：iteration-11 文档缺失属"补记"，不与 `3b0436b` 的代码一起改写提交（禁止 rebase 改历史），而是在本次文档提交中补齐，正文标注原始提交号，保证可追溯。
- **README 只描述已验证事实**：写作前逐项核对 `src/index.html`、`categories.js`（7 个预置类别）、`auth.js`（注册不自动登录）、`index.html` 脚本依赖顺序，避免文档再次超前于实现。

## 验证结果

- [x] `README.md` 中出现的每个提交哈希均可用 `git log` 检索到
- [x] 功能表逐项对照 `src/index.html` 与 `src/js/*.js` 确认存在（7 个预置类别、4 张图表、3 种导出格式）
- [x] 结构树与 `src/` 实际文件一一对应（9 个 JS 模块 + 1 个 CSS）
- [x] 演示路径逐条对照 `auth.js` / `main.js` 的控制流核对（注册后需手动登录为真实行为，非臆测）
- [x] 本次改动仅涉及文档，无源码变更，不影响构建与运行
- [ ] 演示路径尚未在浏览器中逐步实跑，需人工确认一次

## 已知局限

- 提交哈希表为静态快照，后续新增提交需再次同步
- README 暂未附界面截图，答辩材料需另行补拍
