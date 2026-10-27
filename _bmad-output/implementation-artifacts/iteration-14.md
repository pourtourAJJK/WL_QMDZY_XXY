# Iteration 14 — XLSX 导入导出：导出迁移至后端 openpyxl

**Date:** 2026-10-27
**Branch:** `feature/backend-xlsx-export` → merge to `main`
**类型:** 功能补全 + 依赖精简（前端 SheetJS → 后端 openpyxl）

## 问题描述

用户要求"添加一个导入导出 xlsx 格式的"。核对现状后确认：

| 能力 | 迭代 13 时的状态 | 问题 |
|------|------------------|------|
| 导入 .xlsx | 已实现：上传到后端，`importers.py` 用 openpyxl 解析并逐行校验 | 无 |
| 导出 Excel | 仅前端：`data-store.exportExcel()` 依赖 CDN 上的 SheetJS | ① 与"所有数据操作走后端校验"的迭代 13 目标不一致；② jsDelivr 在当前网络不可达，CDN 挂掉即无法导出；③ 导出文件无表头样式、列宽、金额格式 |

因此本轮不改重复造轮子，而是把"导出"补齐为与服务端一致的实现，并去掉前端第三方表格库依赖。

## 改动说明

### 后端

| 文件 | 变化 |
|------|------|
| `expenses/exporters.py` | **新增**：`build_workbook()` 用 openpyxl 生成工作簿，表头加粗 + 底色、列宽固定、冻结首行、自动筛选、金额 `0.00` 格式 |
| `expenses/views.py` | **新增** `ExpenseExportView`：仅导出当前用户数据，`ScopedRateThrottle` scope `export`，返回 xlsx 字节流与 `Content-Disposition` |
| `expenses/urls.py` | **新增** `GET /api/expenses/export/` |
| `config/settings.py` | 限流新增 `"export": "30/hour"` |
| `expenses/tests.py` | **新增** `ExportTests` 4 条：需 JWT、仅本人数据、空数据仅表头、导出→再导入回环 |

导出列与导入别名保持一致（日期 / 类别 / 金额 / 备注 / 创建时间），因此导出的文件可以直接再导入，形成闭环。

### 前端

| 文件 | 变化 |
|------|------|
| `src/js/api.js` | **新增** `download(path)`：带 Bearer 下载二进制，401 自动 refresh 后重试一次（防无限递归），从 `Content-Disposition` 解析文件名 |
| `src/js/data-store.js` | **删除** `exportExcel()`（SheetJS 依赖方法）；JSON / CSV 仍由本地快照生成 |
| `src/js/main.js` | `doExport('excel')` 改为 `await api.download('/api/expenses/export/')` 后触发浏览器下载；移除 `global.XLSX` 检查；401 触发登出 |
| `src/index.html` | **删除** SheetJS 的两段 CDN `<script>`；导入 `accept` 收紧为 `.json,.csv,.xlsx`（旧版 `.xls` 后端本就拒绝） |

## 技术决策

1. **导出放后端而非继续用 SheetJS**：导入已经在服务端用 openpyxl，导出复用同一套列定义可保证"导出 → 再导入"字段完全对齐；同时前端不再依赖 CDN 上的第三方表格库，弱网/离线 CDN 失效时 Excel 导出仍可用。
2. **下载单独实现而非复用 `request()`**：`request()` 统一按 JSON 解析响应，而 xlsx 是二进制；`download()` 直接取 `blob`，并从响应头取服务端生成的文件名，避免前端硬编码。
3. **只导出当前用户**：视图基于 `request.user.expenses` 查询，与列表接口同一隔离边界，避免越权导出他人数据。
4. **导出也限流**：`export` scope 30/hour，防止被当作批量拉取接口滥用。
5. **表头中文化且与导入别名一致**：`日期 / 类别 / 金额 / 备注 / 创建时间`，导入端已支持这些中文别名，因此手工在 Excel 里编辑后仍能导回。

## 验证结果

- 后端单元测试：`python manage.py test expenses accounts` → **28/28 PASS**（新增 4 条导出用例）
- 导出/导入回环联调（真实 HTTP + 真实 xlsx 文件）：**30/30 PASS**
  - 未认证导出 401；导出 `Content-Type`、`Content-Disposition`、`X-Exported-Count`、`PK` 魔数、文件体积
  - 用 openpyxl 反读：表头、工作表名"开销记录"、行数、冻结首行、金额为数值且与写入一致、备注中的逗号原样保留
  - 清空后上传刚导出的 xlsx → `{"imported": 3}` → 回读金额/日期/类别/备注全部一致
  - 旧版 `.xls` 返回 400 且原数据不受影响
- 前端语法：`node --check` 10 个 JS 文件全部通过
- **未完成**：浏览器 UI 逐点击验证（浏览器插件连接失败 `os error 10061`），建议人工在 `http://localhost:8080` 点一次"导出 → 导入"

## 已知局限

- 导出为一次性全量生成，未做流式响应；数据量远超当前 `MAX_ROWS`（5000）时应改为分块写入
- 导出的"创建时间"为只读列，重新导入时会被忽略（以导入时刻为准），这是有意的：避免客户端伪造审计字段
- 未提供按日期区间/类别筛选后导出的能力
- 前端 JSON / CSV 导出仍基于内存快照（登录后已全量拉取，与服务端一致），若在另一设备同时修改，需先刷新再导出
