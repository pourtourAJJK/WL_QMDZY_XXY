# Iteration 13 — 认证迁移至后端：PBKDF2 + JWT + 服务端限流

**Date:** 2026-10-27
**Branch:** `feature/backend-auth-jwt` → merge to `main`
**类型:** 安全重构（纯前端认证 → 生产级后端认证）

## 问题描述

旧版认证完全运行在浏览器里，存在不可接受的安全缺陷：

| 缺陷 | 具体表现 | 风险 |
|------|----------|------|
| 凭证可被本地篡改 | 账号表存在 `localStorage['auth_accounts']`，密码为前端 `SHA-256(password)` | 任何人打开 DevTools 即可读出哈希、改写账号或直接注入登录态 |
| 无盐哈希 | 前端 SHA-256 不带盐，相同密码哈希值恒定 | 彩虹表可直接反查，且同一密码在多账号间可识别 |
| 锁定可被绕过 | 失败次数与锁定截止时间存在 `localStorage['auth_lock:*']` | 清缓存 / 换浏览器 / 无痕窗口即可重置，锁定形同虚设 |
| 无服务端校验 | 所有业务数据也在 localStorage | 数据不隔离、无审计、无法限流 |

## 改动说明

### 后端（新增 `backend/`，Django 5.2 + DRF 3.18）

| 文件 | 作用 |
|------|------|
| `config/settings.py` | JWT 生命周期、PBKDF2 hasher、DRF 全站限流、CORS 白名单、Cookie 安全项 |
| `config/exceptions.py` | 统一错误体 `{detail, retry_after?, remaining_attempts?}` |
| `accounts/models.py` | `LoginAttempt`：服务端记录连续失败次数与 `locked_until` |
| `accounts/serializers.py` | 账号/密码校验，密码经 `create_user` → PBKDF2 + 随机盐 |
| `accounts/views.py` | 注册 / 登录（锁定判定）/ 当前用户 / 登出（拉黑 refresh） |
| `expenses/models.py` | `Expense`（UUID 主键 + `user` 外键 + 索引） |
| `expenses/importers.py` | 服务端解析 JSON / CSV / XLSX，逐行校验、整份拒绝 |
| `expenses/views.py` | 用户隔离的 CRUD、清空、文件导入（事务内替换） |
| `accounts/tests.py` `expenses/tests.py` | 24 条自动化用例 |

### 前端（移除本地认证，改为 API 客户端）

| 文件 | 变化 |
|------|------|
| `src/js/api.js` | **新增**：统一 fetch 封装、Bearer 注入、401 自动 refresh、错误归一 |
| `src/js/auth.js` | **重写**：删除 `auth_accounts` / `auth_lock:*` 全部逻辑与 SHA-256 代码；改为调用后端；启动时清理旧版本地数据；令牌仅存 sessionStorage |
| `src/js/data-store.js` | **重写**：唯一事实源改为后端，内存快照供同步渲染；新增/删除/清空/导入全部异步走后端 |
| `src/js/main.js` | 初始化改为 `await dataStore.load()` 后再渲染；导入改为上传文件给后端；清空走 API |
| `src/js/form.js` `src/js/list-view.js` | 提交/删除改为 `async/await`，失败提示后端 detail，401 触发登出 |
| `src/index.html` | 引入 `api.js`（先于 auth.js），锁定提示改为"服务端锁定" |

## 技术决策

1. **用 Django 自带 User + PBKDF2，不手写加密**：`create_user` 自动生成随机盐并按 Django 版本维护迭代次数（当前 1,000,000 次），避免自研加密的常见误区（固定盐、弱迭代、错误比较方式）。
2. **JWT 双令牌 + 轮换 + 黑名单**：access 30 分钟，refresh 1 天；`ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION` 使登出真正失效而不是"前端删掉令牌"。
3. **锁定状态放数据库而非缓存**：`LoginAttempt` 按账号唯一，5 次失败写入 `locked_until = now + 5min`；重启服务、换浏览器、换 IP 都不会解锁（按账号而非按会话）。
4. **限流用 DRF Throttle 而非额外依赖**：项目环境已具备 DRF，`ScopedRateThrottle` 可为登录（10/min）、注册（5/hour）、导入（10/hour）分别设限，避免引入 `django-ratelimit` 的额外依赖。注意 DRF 的 `THROTTLE_RATES` 在导入时绑定为类属性，因此限流单测通过临时替换类属性验证。
5. **不存在的账号不落库**：登录时先判断用户是否存在，避免攻击者用随机用户名把 `LoginAttempt` 表撑爆；对外仍返回同一句"账号或密码错误"，不泄露账号存在性。
6. **导入必须服务端校验**：文件上传到后端，由 `importers.py` 逐行解析；任一行非法则整份拒绝，且在事务内先删后插，失败自动回滚，保护既有数据。

## 验证结果

- 后端单元测试：`python manage.py test` → **24/24 PASS**（PBKDF2 盐值随机、JWT 校验、5 次锁定、锁定到期、账号隔离、限流 429、refresh 拉黑、导入 JSON/CSV/XLSX、非法文件拒绝、越权删除 404）
- 接口联调（真实 HTTP + 真实服务）：**23/23 PASS**（注册/登录/me/伪造令牌/CRUD/CSV/XLSX/非法导入/用户隔离/登出拉黑/锁定/CORS）
- 前端模块联调（Node VM 加载真实 `api.js` + `data-store.js` 请求真实后端）：**15/15 PASS**（含 access 失效自动刷新、导入后快照更新、登出后 401）
- 前端语法：`node --check` 10 个 JS 文件全部通过
- **未完成**：浏览器 UI 逐点击验证（浏览器自动化插件连接失败 `os error 10061`），需人工在 `http://localhost:8080` 走一遍注册→登录→录入

## 已知局限

- SQLite + LocMem 限流仅适合单进程演示；生产需 PostgreSQL + Redis（否则多 worker 下限流失效）
- access 令牌在 30 分钟内即使"登出"仍可用（无状态 JWT 特性），敏感场景需引入短时效 + 每次请求校验黑名单
- 未实现邮箱验证、找回密码、CSV 列名自定义映射
- PDF 文档导入与内容转写不在本次范围（功能 1 被中断），后续接口需复用同一 JWT + 限流 + 服务端解析模式
