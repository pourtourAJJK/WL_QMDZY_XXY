# Test Report — Personal Expense Dashboard（后端认证版）

**Date:** 2026-10-27
**验证方式:** 自动化测试（Django 单测 + 真实 HTTP 联调 + 前端模块联调）+ 静态语法检查

## 环境

- 操作系统：Windows 11
- 后端：Python 3.12 / Django 5.2.6 / DRF 3.18.3 / SimpleJWT 5.5.1 / openpyxl
- 前端：Node 24（VM 加载真实模块）+ 浏览器（`http://localhost:8080`）
- 数据库：SQLite `backend/db.sqlite3`（已 gitignore）

## 1. 后端单元测试 —— 34/34 PASS

执行：`cd backend && python manage.py test`

| 分组 | 用例 | 结果 |
|------|------|------|
| 注册 | 密码以 `pbkdf2_sha256$` 开头、明文不落库、盐段非空、同密码不同用户哈希不同 | PASS |
| 注册 | 用户名重复（大小写不敏感）拒绝 / 密码过短拒绝 | PASS |
| 登录 | 返回 access+refresh，`/me/` 可访问 | PASS |
| 登录 | `/me/` 无令牌 401、伪造令牌 401 | PASS |
| 登出 | 205 后 refresh 再用 → 401（黑名单生效） | PASS |
| 锁定 | 前 4 次 401、第 5 次 423，锁定后正确密码仍 423 且 `retry_after > 0` | PASS |
| 锁定 | 账号 A 锁定不影响账号 B | PASS |
| 锁定 | 锁定到期后自动清零并可正常登录 | PASS |
| 锁定 | 登录成功清零失败计数 | PASS |
| 锁定 | 不存在的账号返回统一错误且不产生记录 | PASS |
| 限流 | 登录接口超过阈值返回 429 | PASS |
| 开销 | 未认证 401；新增后列表仅返回本人记录 | PASS |
| 开销 | 越权删除他人记录 → 404 且数据仍在 | PASS |
| 开销 | 清空仅影响当前用户 | PASS |
| 导入 | JSON 导入覆盖旧数据、条数正确 | PASS |
| 导入 | CSV（UTF-8 BOM + 引号内逗号）解析正确 | PASS |
| 导入 | XLSX（中文表头）解析正确 | PASS |
| 导入 | 单行金额非法 → 整份 400 且原数据不变 | PASS |
| 导入 | 未认证 401；未知扩展名 400；导入不影响其他用户 | PASS |
| 导出 | 未认证 401；仅返回本人记录 | PASS |
| 导出 | `Content-Type` 为 xlsx、`Content-Disposition` 带文件名、PK 魔数、表头与行数正确 | PASS |
| 导出 | 无数据时仅表头一行 | PASS |
| 导出 | 导出文件可直接再导入（round-trip） | PASS |
| 导入 | HTML 表格伪装 .xlsx / .xls（UTF-8 与 GB18030）导入成功 | PASS |
| 导入 | 无 `<table>` 的网页 → 400 + 中文另存指引；二进制 .xls → 400 | PASS |
| 导入 | HTML 导入失败时原数据不变 | PASS |

## 2. XLSX 导出 / 导入回环联调（真实服务）—— 30/30 PASS

执行：后端 `runserver 127.0.0.1:8000`，Python `requests` + `openpyxl` 真实下载并反读导出的工作簿。

覆盖：
- 未认证访问 `GET /api/expenses/export/` → 401
- 写入 3 条含逗号备注的记录 → 导出：HTTP 200、`Content-Type` 为 spreadsheetml、`Content-Disposition` 带 `expenses-YYYYMMDD.xlsx`、`X-Exported-Count: 3`、文件头 `PK`、体积 5,344 bytes
- openpyxl 反读：表头「日期/类别/金额/备注/创建时间」、工作表名「开销记录」、4 行（1 表头 + 3 数据）、`freeze_panes = A2`、金额为数值且 `[8.0, 35.5, 120.0]`、备注 `外卖,含饮料` 原样保留
- 清空 → 重新导入刚导出的 xlsx → `{"imported": 3}` → 回读金额/日期/类别/备注全部一致
- 旧版 `.xls` 上传 → 400「暂不支持旧版 .xls，请用 Excel 另存为 .xlsx 后重试」，且原数据仍为 3 条

结果：`总计 30/30 PASS`

## 3. 接口联调（真实服务）—— 23/23 PASS + HTML 导入 5/5 PASS

执行：后端 `runserver 127.0.0.1:8000` + 前端 `http.server 8080`，Python requests 脚本逐项请求。

覆盖：注册 → 登录 → `/me/`（带/不带/伪造令牌）→ 未认证访问 → 新增 → 列表 → CSV 导入 → 覆盖校验 → 非法金额 400 → 原数据未损 → XLSX 导入 → 内容比对 → 第二用户数据隔离 → 登出 205 → refresh 401 → 5 次错误锁定 → 锁定后正确密码 423 → CORS 预检放行 `http://localhost:8080` → 前端首页/api.js 可访问。

结果：`总计 23/23 PASS`

补充（iteration-15 真实 HTTP）：HTML 表伪装 `.xls` 导入 2 条且回读金额/日期/备注正确；无 `<table>` 网页与二进制 `.xls` 均返回 400 中文指引；原数据不受影响。`总计 5/5 PASS`（脚本中一处断言把金额写成字符串 `"35.50"`，接口实际返回数值 `35.5`，属脚本期望错误而非功能缺陷，已在 iteration-15.md 记录）。

## 4. 前端模块联调（Node VM + 真实后端）—— 15/15 PASS

执行：在 Node 24 的 `vm` 沙箱中加载仓库真实的 `src/js/api.js`、`src/js/data-store.js`，用 fake `sessionStorage` 对齐浏览器行为，直接请求运行中的 Django。

覆盖：注册 → 登录写 JWT → `/me/` → 伪造 access 后自动 refresh 并重试 → 快照加载 → 新增 → CSV 上传 → 非法文件拒绝且数据不变 → 删除 → 清空 → 登出后 401。

结果：`总计 15/15 PASS`

## 5. 静态检查

| 检查 | 结果 |
|------|------|
| `node --check` 全部 10 个前端 JS 文件 | 10/10 通过 |
| `python manage.py check` | 无告警 |
| 篡改路径复核：`grep auth_accounts / auth_lock` | 仅 `auth.js` 的清理函数命中，无读写逻辑 |
| 敏感信息：`db.sqlite3`、`.env` 是否被忽略 | 已忽略 |

## 6. 未执行项（明确说明）

- **浏览器 UI 逐点击验证未完成**：浏览器自动化插件连接失败（`os error 10061`），无法驱动 Chrome。已改为上方第 4 节的模块级联调替代，仍建议人工在 `http://localhost:8080` 走一次"注册 → 登录 → 录入 → 导出 Excel → 清空 → 导入 xlsx"。
- **PDF 导入 / 内容转写测试未执行**：功能本身尚未实现（需求 1 被中断），不属于本轮范围。
- 多进程部署下的限流共享（Redis）未验证：当前 LocMem 缓存仅单进程有效。

## 结论

后端认证链路（注册、登录、JWT、锁定、限流、登出拉黑）、开销导入服务端校验，以及新增的 XLSX 服务端导出与"导出→再导入"回环均通过自动化验证。前端已移除 SheetJS 依赖，旧版 localStorage 账号/锁定逻辑已彻底移除。剩余风险集中在部署形态（SQLite/LocMem）与浏览器人工复核。
