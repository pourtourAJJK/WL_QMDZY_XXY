# Iteration 11 — UI 规范化：建立设计令牌系统

**Date:** 2026-10-27
**Branch:** `feature/ui-redesign` → merge to `main`（合并提交 `384124e`）
**Commit:** `3b0436b` style: UI全面优化-去渐变去重阴影去emoji-建立设计令牌系统

## 问题描述

经过 10 次迭代堆叠，`style.css` 已膨胀到 700+ 行，出现明显的"AI 生成感"：

- 大面积装饰性渐变（登录卡片、按钮、图表容器背景）
- 多层重阴影（`0 20px 60px` 级别的投影），视觉脏且拖慢合成
- 圆角不统一（有的 20px、有的 12px、有的 8px）
- 页面标题、按钮、区块标题里大量 emoji（🔐 💰 📊 📈 🏗️ 📉 📋 ⚙️ 📤 📥 🗑️）
- 同一语义的颜色散落在十几处硬编码值（`#2563eb` / `#3b82f6` / `#1d4ed8` 混用）

## 改动说明

| 文件 | 改动 |
|------|------|
| `src/css/style.css` | 全量重写（543 → 521 行，diff 约 717 行）：顶部新增 `:root` 设计令牌；移除全部装饰性渐变与重阴影；统一圆角/间距/字号/过渡 |
| `src/index.html` | 删除 17 处 emoji；`auth-hint` 由 class 样式改为内联样式；移除脚本行尾行内注释 |

### 设计令牌（Design Tokens）

在 `:root` 中集中定义，后续所有规则只引用变量，不再出现魔法值：

| 令牌组 | 内容 |
|--------|------|
| 颜色 | 中性灰阶（`--color-bg/surface/border/text/muted/subtle`）+ 单一品牌蓝 `#2563eb` + 语义色（danger/success） |
| 圆角 | `--radius-sm 4px` / `md 6px` / `lg 8px` / `xl 10px`（按控件层级收敛，不再出现 20px） |
| 阴影 | `--shadow-sm 0 1px 2px` / `md 0 1px 3px` / `lg 0 4px 12px`（`lg` 仅用于浮层）+ 焦点环 `--shadow-focus` |
| 间距 | 4px 基准：`--space-1..8`（4/8/12/16/20/24/32） |
| 字号 | `--font-size-xs 12px` 到 `--font-size-2xl 24px` 共 7 级 |
| 字体 | 系统字体栈（`-apple-system` / `PingFang SC` / `Microsoft YaHei`） |
| 动效 | `--ease: cubic-bezier(0.4, 0, 0.2, 1)` 统一过渡曲线 |

## 技术决策

1. **只用 CSS 自定义属性，不引入框架** —— 项目定位是"零构建、双击即用"，引入 Tailwind/UnoCSS 会破坏该前提；`var(--token)` 已足以覆盖全部场景。
2. **单色品牌而非渐变** —— 渐变在低端设备上会造成整层重绘，且与"财务工具"的克制气质不符；按钮 hover 只做 `--color-brand-hover` 的纯色切换。
3. **阴影降级为 1px 级别** —— 卡片靠 `1px solid var(--color-border)` 而非投影建立层级，浮层（下拉菜单）才允许 `--shadow-lg`。
4. **彻底去 emoji** —— emoji 在不同系统渲染宽度不一致（Windows 是彩色字形、部分 Linux 是黑白），会破坏表格/按钮对齐；图标信息改由文字或 CSS 图形承担。

## 验证结果

- [x] `src/index.html` 已无 emoji 字符残留（逐处 diff 核对，共删除 17 处）
- [x] `style.css` 中 `linear-gradient` / `radial-gradient` 计数为 0
- [x] 三层阴影令牌均收敛到 `0 1px 2px` ~ `0 4px 12px`，重投影已移除
- [x] 本次仅改 CSS 与 HTML 文案，无 JS 变更，功能链路不受影响
- [ ] 视觉验收（1440×900 桌面 / 375×812 移动）尚未在浏览器中执行，需人工确认
- [ ] 仍有 6 处硬编码色值（`#fecaca` / `#fff` / `#1e40af` / `#fee2e2`，见 `style.css` 第 230/337/341/365/368/493 行）未收敛到令牌

## 已知局限

- 小屏（< 640px）下单行表单与图表容器仍偏挤，移动端适配留待后续迭代
- 设计令牌尚未覆盖 ECharts 内部配色（图表色板仍由 `categories.js` 单独维护），两处色值未来可考虑收敛为同一份 token
- 上述 6 处硬编码色值需在下一轮样式清理中替换为 `var(--color-*)`
