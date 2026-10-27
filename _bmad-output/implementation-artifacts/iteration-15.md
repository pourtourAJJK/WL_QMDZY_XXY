# Iteration 15 — 修复 xlsx 导入报错：兼容"HTML 伪 Excel" + 前端防缓存

**Date:** 2026-10-27
**Branch:** `feature/fix-xlsx-html-import` → merge to `main`
**类型:** 缺陷修复（用户实测导入 xlsx 报错 `Invalid HTML: could not find <table>`）

## 问题描述

用户在浏览器中导入一个 .xlsx 文件，弹窗报错：

```
导入失败：Invalid HTML: could not find <table>
```

## 根因分析（逐层验证）

1. **该字符串不是后端产生的**：全仓库 grep 无匹配；对运行中的后端复现 5 种异常文件（HTML 伪装 xlsx / 标题行 xlsx / 空 xlsx / CSV 改名 xlsx），后端只返回中文提示（如"Excel 文件损坏或不是 .xlsx 格式"）。
2. **字符串来自 SheetJS**：下载 xlsx@0.18.5 源码确认其中包含 `throw new Error("Invalid HTML: could not find <table>")`（2 处）；旧版前端（commit `9672769`）的 `importExcel()` 正是用 `XLSX.read(arrayBuffer)` 在浏览器端解析文件。
3. **结论**：用户浏览器标签页运行的是**旧版前端缓存代码**（当时 import 由 SheetJS 前端解析）；且该文件**内容实际是 HTML 而非 xlsx**（真 xlsx 以 `PK` 开头，SheetJS 只有嗅探到 HTML 时才会去找 `<table>`）。两个因素叠加产生了这条英文报错。

## 改动说明

### 后端（`backend/expenses/importers.py`）

| 改动 | 说明 |
|------|------|
| 内容嗅探优先于扩展名 | `_looks_like_html()` 检测 `<!doctype` / `<html` / `<table` 等开头；`_looks_like_binary_xls()` 检测 OLE2 魔数 |
| 新增 `_parse_html()` | 用标准库 `html.parser` 提取第一张 `<table>` 的 tr/td/th 文本；UTF-8 失败回退 GB18030；无表格 → 明确中文指引"请用 Excel/WPS 另存为 .xlsx 再导入" |
| 抽出 `_records_from_rows()` | xlsx 与 HTML 解析共用表头别名识别 + 逐行校验逻辑，行为一致 |
| `.xls` 重新放行 | HTML 表格型 .xls 可导入；二进制 .xls 返回"暂不支持旧版二进制 .xls，请另存为 .xlsx" |

### 前端（`src/index.html`）

| 改动 | 说明 |
|------|------|
| 全部本地 css/js 加 `?v=20261027` | 防止浏览器沿用旧缓存模块（`python -m http.server` 不发 Cache-Control，存在启发式缓存风险），避免"新后端 + 旧前端"混跑 |
| `accept` 恢复 `.xls` | 配合后端 HTML 表格兼容 |

## 验证结果

- 后端单元测试：`python manage.py test expenses accounts` → **34/34 PASS**（新增 6 条：HTML 表 .xlsx/.xls/GB18030 导入、无表格网页拒绝、二进制 .xls 拒绝、失败不改原数据）
- 真实 HTTP 联调（重启后的服务）：
  - HTML 表格伪装 `bill.xlsx` → `200 {"imported":1}`（修复前为 SheetJS 英文报错路径）
  - 无 `<table>` 网页 → 400「文件内容实际是网页而不是 Excel 表格（未找到 \<table\>），请用 Excel/WPS 打开后另存为 .xlsx 再导入」
  - 二进制 .xls（OLE2 魔数）→ 400「暂不支持旧版二进制 .xls…」
  - HTML 表格 .xls 导入 2 条，回读金额（¥35.50→35.5）、斜杠日期（2026/10/26→2026-10-26）、含逗号备注全部正确

## 已知局限

- HTML 解析只取第一张 `<table>`，多表格账单（如按月份分表）只导入第一张
- 真正的 Excel 2003 XML（SpreadsheetML）格式按"无表格网页"处理，提示另存为 .xlsx
- 用户侧仍需一次强制刷新（Ctrl+F5）让旧标签页加载新前端；`?v=` 只能防止未来再次混跑
