# Iteration 7 — 多格式数据导出导入（JSON / CSV / Excel）

**Date:** 2026-10-26
**Branch:** `feature/data-export-import` → merge to `main`
**Story:** 导出和导入兼容三种格式：JSON、CSV、Excel (.xlsx/.xls)

## 改动说明

| 文件 | 改动 |
|------|------|
| `src/js/data-store.js` | **扩展**。新增 `exportCSV()`、`exportExcel()`、`importCSV(text)`、`importExcel(arrayBuffer)`；保留原 `exportJSON()` / `importJSON()` 不动；新增辅助函数 `parseCSV()`、`escapeCSVField()`、`csvRowToExpense()`、`excelRowToExpense()`、`extractExpenses()`、`validateExpenses()` |
| `src/index.html` | **更新**。SheetJS CDN 引入（在 ECharts 之后、业务 JS 之前）；导出按钮改为下拉菜单（JSON/CSV/Excel 三选项）；导入 file input accept 改为 `.json,.csv,.xlsx,.xls` |
| `src/js/main.js` | **重写** `bindDataManagement()`。新增导出下拉菜单事件绑定 + `doExport(format)` 函数 + `doImport(file, ext)` 按扩展名分派 + `triggerDownload()` 下载辅助；SheetJS 存在性检查，缺失时降级提示 |
| `src/css/style.css` | **新增**。下拉菜单全套样式（`.dropdown-wrapper`、`.dropdown-toggle`、`.dropdown-menu`、`.dropdown-item`） |

## 技术决策

### 1. CSV 用原生 JS 实现（零依赖）
- 手写 CSV 解析器（`parseCSV()`），支持引号包裹、字段内逗号和双引号转义
- 导出加 **UTF-8 BOM**（`\ufeff`），保证 Excel 打开中文不乱码（重要！）
- 字段转义规则：含逗号/引号/换行时用引号包裹，内部引号翻倍

### 2. Excel 用 SheetJS（xlsx 库）
- CDN 引入：`https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js`
- 放在 ECharts 之后、业务 JS 之前加载
- 导出：`XLSX.utils.aoa_to_sheet()` + `XLSX.write(wb, { bookType: 'xlsx', type: 'array' })`
- 导入：`XLSX.read(arrayBuffer, { type: 'array' })` + `XLSX.utils.sheet_to_json(ws, { header: 1 })`

### 3. SheetJS 缺失时的降级处理（关键！）
- 经验教训：之前出现过 `XLSX is not defined` 错误
- **所有 Excel 操作前都先检查 `global.XLSX` 是否存在**
- 缺失时给明确提示："Excel 导出需要 SheetJS 库，请检查网络后刷新页面，或改用 JSON/CSV 格式"
- CSV/JSON 不受影响（零依赖，永远可用）

### 4. 导入按扩展名分派
- 不依赖文件 MIME type（浏览器可能不可靠），只用文件扩展名 `.json` / `.csv` / `.xlsx` / `.xls`
- 未知扩展名直接报错，提示支持的格式列表

### 5. 导出字段顺序一致性
- 三种格式导出字段统一：`id / date / category / amount / note / created_at`
- Excel 用中文表头（ID/日期/类别/金额/备注/创建时间），CSV 用英文（data-store.js 内部处理）
- 导入 CSV 和 Excel 时按**列索引**映射（不是表头名字匹配），避免表头改名导致导入失败

### 6. JSON 导入向后兼容
- `importJSON()` 原来只接受 `{ expenses: [...] }` 结构
- 现在用 `extractExpenses()` 同时兼容**直接数组**（`[ {...}, {...} ]`）和**带包装对象**（`{ schema_version, expenses: [...] }`）两种格式
- 这样 CSV 导出再 JSON 导入也能通（虽然不需要这么做，但健壮性更好）

## 核心功能点

### 三种导出格式
| 格式 | 方法 | 扩展名 | 零依赖 |
|------|------|--------|--------|
| JSON | `dataStore.exportJSON()` | .json | ✅ |
| CSV | `dataStore.exportCSV()` | .csv | ✅ |
| Excel | `dataStore.exportExcel()` | .xlsx | ❌ 需 SheetJS |

### 四种导入扩展名
- `.json` → `dataStore.importJSON()`
- `.csv` → `dataStore.importCSV()`
- `.xlsx` / `.xls` → `dataStore.importExcel()`

### SheetJS 降级
```js
if (!global.XLSX) {
  alert('Excel 导出需要 SheetJS 库，请检查网络后刷新页面');
  return;  // 不崩溃，不继续
}
```

## 验证结果

- [x] SheetJS CDN 加载成功（页面打开后 Console 检查 `typeof XLSX === 'object'`）
- [x] 导出下拉菜单点击展开/收起
- [x] CSV 导出：Excel 打开中文不乱码（BOM 生效）
- [x] CSV 导出再导入：数据完整恢复
- [x] Excel 导出：生成 .xlsx 文件，Excel 正常打开
- [x] Excel 导出再导入：数据完整恢复
- [x] JSON 导出再导入：向后兼容（原有功能不受影响）
- [x] 导入非支持格式（如 .txt）：友好报错
- [x] 导入格式错误的文件：友好报错
- [x] SheetJS 缺失时导出 Excel：降级提示，不崩溃
- [x] 所有导出文件名带日期：`expense-backup-YYYY-MM-DD.{json|csv|xlsx}`

## 已知局限

- **Excel 导入时日期字段**：SheetJS 可能把 `2026-10-26` 解析成 Excel 内部日期序列号（如果单元格是日期格式），导致日期变成数字。当前 `excelRowToExpense()` 直接用 `String(row[1])`，可能需要后续加日期格式兼容（课程大作业场景下导出再自己导入没问题）
- **SheetJS 版本硬编码**（0.18.5）：CDN 地址固定，如果该版本下线需要手动更新
- **没有 Excel 多 sheet 支持**：只读写第一个 sheet

## 经验教训（来自 ExperienceRecall）

> "SheetJS 加载位置不对会导致 XLSX is not defined —— 必须在业务 JS 之前引入"

本迭代的正确做法：
```html
<!-- ECharts CDN -->
<script src="echarts..."></script>
<!-- SheetJS CDN — 必须在业务 JS 之前 -->
<script src="xlsx..."></script>
<!-- 业务 JS（auth.js, categories.js, ...）-->
<script src="js/auth.js"></script>
...
```

> "导出 CSV 给 Excel 打开中文乱码 —— 必须加 UTF-8 BOM"

本迭代的做法：`return '\ufeff' + [headerLine, ...rows].join('\r\n');`
